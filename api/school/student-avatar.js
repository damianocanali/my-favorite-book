export const config = { runtime: 'edge' }

// The teacher creates a student's avatar from the class roster feature
// picker — never a photo, and never the student's own session (students
// can no longer open /avatar at all; see api/generate-avatar.js's
// rejectStudent). This mirrors generate-avatar.js's text-to-image path but:
//   - meters the CLASS's daily image allowance for the target student
//     (school_bump_image), not the consumer daily cap;
//   - skips the paid-style ownership check — the school already paid for
//     the license, so every art style is available to every class account;
//   - stores the result under the STUDENT's own auth_user_id (looked up
//     server-side from classId+studentId), never the teacher's, so the
//     avatar follows the child's account exactly like a self-made one would.
import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, sb, json, isUuid, bumpStudentImage, refundStudentImage } from '../_school.js'
import { buildAvatarPrompt, isValidFeatures, isValidArtStyle } from '../../lib/avatarPrompt.js'
import { storeIllustration, isFetchableImage } from '../_imageStore.js'
import { logUsage, estimateTogetherImageCostCents } from '../_usage.js'
import { checkImage } from '../_aiGuard.js'
import { safeDetail } from '../_logSafe.js'

const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations'
// Same serverless text-to-image model generate-avatar.js uses for its
// feature-builder path (contrast its photo-cartoonify path, which this
// endpoint has no equivalent of — teachers never upload a child's photo).
const MODEL = 'black-forest-labs/FLUX.2-dev'

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const isGet = req.method === 'GET'
    const isPost = req.method === 'POST'
    if (!isGet && !isPost) return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })

    const url = new URL(req.url)
    const body = isPost ? await req.json().catch(() => ({})) : {}
    const classId = isGet ? url.searchParams.get('classId') : body.classId
    const studentId = isGet ? url.searchParams.get('studentId') : body.studentId

    const o = await requireClassOwner(req, classId)
    if (!o.ok) return o.response

    // Separate buckets: the editor's GET (loading the current avatar to
    // show it, e.g. every time the modal opens) is much more frequent and
    // much cheaper than a POST (a real Together generation), so it must not
    // eat into the same 60/hour budget a burst of creates would need.
    const rateLimitKey = isGet ? `school-avatar-read:${o.auth.userId}` : `school-avatar:${o.auth.userId}`
    const rateLimitMax = isGet ? 300 : 60
    if (!checkRateLimit(rateLimitKey, rateLimitMax).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    if (!isUuid(studentId)) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

    // Same "doesn't exist" answer for a bad id, a foreign student, and a
    // removed one — ids must not be probeable. Unlike student-books.js
    // (which lets a removed student's books stay visible for review), a
    // removed student can no longer have an avatar (re)created for them.
    const studentRes = await sb(
      `/rest/v1/class_students?id=eq.${studentId}&classroom_id=eq.${o.classroom.id}&select=id,status,auth_user_id`
    )
    if (!studentRes.ok) throw new Error(`class_students lookup failed: ${studentRes.status}`)
    const studentRows = await studentRes.json()
    const student = studentRows?.[0]
    if (!student || student.status === 'removed') {
      return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
    }

    if (isGet) {
      const invRes = await sb(
        `/rest/v1/user_inventory?user_id=eq.${encodeURIComponent(student.auth_user_id)}&select=avatar_url`
      )
      if (!invRes.ok) throw new Error(`user_inventory lookup failed: ${invRes.status}`)
      const rows = await invRes.json()
      return json(req, 200, { avatar_url: rows?.[0]?.avatar_url ?? null })
    }

    // POST — generate a fresh avatar for this student.
    const { features, artStyle } = body
    // No free-text moderation pass here (contrast generate-avatar.js) — a
    // teacher's request has no prose, only picks from the catalog, so
    // catalog membership IS the moderation.
    if (!isValidFeatures(features) || !isValidArtStyle(artStyle)) {
      return json(req, 400, { error: 'Invalid avatar features', code: 'bad_request' })
    }

    // Meter BEFORE the Together call: a spent allowance for a generation
    // that then fails to come back is an acceptable tradeoff (same one
    // enforceStudentImageCap already makes); metering after would let a
    // class burn unlimited Together calls while the allowance check itself
    // is slow or retried.
    const meterErr = await bumpStudentImage(studentId, req)
    if (meterErr) return meterErr

    const apiKey = process.env.TOGETHER_API_KEY
    if (!apiKey) return json(req, 500, { error: 'API key not configured', code: 'upstream' })

    // All art styles are allowed for a class account — the school paid for
    // the license, so there's no per-style ownership to check (contrast
    // generate-avatar.js's ownsStyle gate for consumer accounts).
    const prompt = buildAvatarPrompt(features, artStyle || 'cartoon')

    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL, prompt,
        // FLUX.2-dev's default is ~28 steps; 4 was a FLUX.1-schnell leftover
        // and produced under-cooked avatars.
        width: 512, height: 512, steps: 28, n: 1,
        response_format: 'b64_json',
        // PNG explicitly: output moderation and Storage both label it image/png
        // (api/_aiGuard.js sniffs the bytes anyway).
        output_format: 'png',
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[school/student-avatar] Together error', response.status, safeDetail(detail))
      return json(req, 502, { error: 'Avatar generation failed. Please try again.', code: 'upstream' })
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) return json(req, 500, { error: 'No image data returned', code: 'upstream' })

    logUsage({
      service: 'together',
      feature: 'school-avatar',
      model: MODEL,
      images: 1,
      cost_cents: estimateTogetherImageCostCents({ model: MODEL, images: 1 }),
    })

    // Screen the finished avatar before it is stored (review §7 item 11).
    // It lands on a CHILD's account, so an outage fails closed even though
    // the caller is the teacher.
    const verdict = await checkImage(b64)
    if (verdict === 'flagged') {
      return json(req, 400, { error: "That picture didn't turn out right. Try different choices.", code: 'image_flagged' })
    }
    if (verdict === 'unavailable') {
      // Fail closed, but give the student's picture back (review fix I4).
      await refundStudentImage(studentId)
      return json(req, 503, { error: 'Try again in a moment', code: 'moderation_unavailable' })
    }

    // Stored under the STUDENT's own auth id, never the teacher's — the
    // avatar belongs to the child's account and must follow it the same
    // way a self-made consumer avatar does.
    const stored = await storeIllustration(b64, student.auth_user_id, 'avatar')
    const avatar_url = stored ?? `data:image/png;base64,${b64}`

    // storeIllustration falls back to a data: URI when Storage is
    // unreachable (best-effort upload — see api/_imageStore.js). That's
    // fine to hand back for an immediate preview, but it must NEVER be
    // written to user_inventory: a few-hundred-KB base64 blob in a database
    // row is exactly the bloat storeIllustration exists to avoid, and this
    // student's account would carry it forever. Same guard api/sync-books.js
    // and useAvatarStore.setAvatarImage already apply before persisting an
    // avatar/illustration URL.
    if (!isFetchableImage(avatar_url)) {
      return json(req, 200, { avatar_url, saved: false })
    }

    const upsertRes = await sb('/rest/v1/user_inventory?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: student.auth_user_id, avatar_url }),
    })
    if (!upsertRes.ok) return json(req, 503, { error: 'Try again in a minute', code: 'upstream' })

    return json(req, 200, { avatar_url, saved: true })
  } catch (e) {
    console.error('school/student-avatar: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
