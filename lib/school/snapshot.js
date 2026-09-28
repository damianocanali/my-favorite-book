// Freezes a student's book for a hand-in (class_submissions.book_snapshot).
//
// api/classroom-submit.js drops every illustration outright (coverImage and
// each page's illustrationData become null). A hand-in keeps more: images
// already uploaded to Storage are plain http(s) URLs and cost nothing to keep,
// so only inline data: URIs (megabytes of base64) are dropped — anywhere in
// the tree, not just the two known fields, so a new image field can't
// smuggle a data URI past this. Same 200 KB budget as classroom-submit.js.
export const MAX_SNAPSHOT_BYTES = 200_000

const DATA_URI = /^\s*data:/i

function strip(value) {
  if (typeof value === 'string') return DATA_URI.test(value) ? null : value
  if (Array.isArray(value)) return value.map(strip)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = strip(v)
    return out
  }
  return value
}

/// Returns a data-URI-free deep copy of `book`, or null when there is no
/// book or the copy is still over MAX_SNAPSHOT_BYTES (UTF-8 bytes).
export function snapshotBook(book) {
  if (!book || typeof book !== 'object' || Array.isArray(book)) return null
  const copy = strip(book)
  const bytes = new TextEncoder().encode(JSON.stringify(copy)).length
  return bytes > MAX_SNAPSHOT_BYTES ? null : copy
}
