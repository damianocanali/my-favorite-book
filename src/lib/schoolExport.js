// Downloads the teacher's data export (api/school/export.js) as a file.
// Returns { ok, code? } like schoolFetch, so the caller can show
// teacherErrorText for a failure.
import { apiFetchAuthed } from './api.js'

export const exportFileName = (base, date = new Date()) =>
  `${String(base || 'class').replace(/[\\/:*?"<>|]/g, '').trim() || 'class'}-${date.toISOString().slice(0, 10)}.zip`

export async function downloadSchoolExport({ classId, studentId, name }) {
  try {
    const q = `classId=${encodeURIComponent(classId)}` + (studentId ? `&studentId=${encodeURIComponent(studentId)}` : '')
    const res = await apiFetchAuthed(`/api/school/export?${q}`)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return { ok: false, code: data?.code }
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName(name)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
