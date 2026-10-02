// The typed-name confirmation for a permanent delete (a student, a class):
// the teacher retypes the name exactly as shown, ignoring case, extra
// spaces and accents-by-composition. Shared by the API (the real check)
// and the web dialog (which only enables its button on a match).
const norm = (s) => String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function namesMatch(typed, expected) {
  const e = norm(expected)
  return e.length > 0 && norm(typed) === e
}
