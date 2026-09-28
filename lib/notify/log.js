// "Not configured" is logged once per instance, not once per alert: a
// channel with no keys is an expected state before launch, not an error.
const said = new Set()
export function infoOnce(key, message) {
  if (said.has(key)) return
  said.add(key)
  console.info(message)
}
