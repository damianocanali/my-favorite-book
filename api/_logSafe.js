// Upstream error bodies are logged for debugging, but they can echo what we
// sent (a child's prompt, story text, an email). safeDetail keeps a short,
// prompt-free excerpt (review §4.4, §7 item 20): anything from a
// "messages"/"prompt"/"input"/"system"/"content" key onward is cut, then the
// rest is capped at 200 characters.
const ECHO = /"(messages|prompt|input|system|content|text)"\s*:/i

export function safeDetail(text, max = 200) {
  let s = String(text ?? '')
  const m = ECHO.exec(s)
  if (m) s = `${s.slice(0, m.index)}[redacted]`
  return s.replace(/\s+/g, ' ').slice(0, max)
}
