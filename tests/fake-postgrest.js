// A tiny in-memory PostgREST for the billing tests: enough of GET / POST /
// PATCH / DELETE with eq / neq / is.null / in.() filters, unique keys that
// answer 409, and `Prefer: return=representation`. Rows are plain objects.
let seq = 0
export const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

const UNIQUE = {
  stripe_school_events: [['event_id']],
  school_plans: [['stripe_subscription_id']],
  class_licenses: [['classroom_id']],
}

const DEFAULTS = {
  class_licenses: () => ({ seats: 35, image_allowance: 300, images_used: 0, starts_at: new Date().toISOString(), pending_seats: null, school_plan_id: null, stripe_subscription_id: null, stripe_customer_id: null, stripe_price_id: null, stripe_period_start: null, stripe_event_at: null, cancel_at_period_end: false, billing_method: null, price_tier: null, school_name: null, dpa_version: null }),
  school_plans: () => ({ pending_seats: null, starts_at: new Date().toISOString(), stripe_period_start: null, stripe_event_at: null, cancel_at_period_end: false, dpa_version: null }),
}

function matches(row, key, raw) {
  const [op, ...rest] = raw.split('.')
  const v = rest.join('.')
  const cell = row[key]
  if (op === 'eq') return cell != null && String(cell) === v
  if (op === 'neq') return cell == null || String(cell) !== v
  if (op === 'is') return v === 'null' ? cell == null : String(cell) === v
  if (op === 'in') return v.replace(/^\(|\)$/g, '').split(',').includes(String(cell))
  if (op === 'gte') return cell != null && String(cell) >= v
  if (op === 'lt') return cell != null && String(cell) < v
  return true
}

export function fakeDb(seed = {}) {
  const tables = {}
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }))
  const t = (name) => (tables[name] ??= [])
  const calls = []

  function select(name, params) {
    return t(name).filter((row) => {
      for (const [k, v] of params) {
        if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue
        if (k.includes('.')) continue // embedded filter (e.g. class_students.status): ignore
        if (!matches(row, k, v)) return false
      }
      return true
    })
  }

  async function sb(path, init = {}) {
    const method = init.method || 'GET'
    const u = new URL(`https://db${path}`)
    const name = u.pathname.replace('/rest/v1/', '')
    const params = [...u.searchParams.entries()]
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method, name, params: Object.fromEntries(params), body })
    const prefer = init.headers?.Prefer ?? ''
    const json = (status, data) => new Response(data === undefined ? null : JSON.stringify(data), { status })

    if (name.startsWith('rpc/')) return json(404, { message: 'no rpc in fake' })
    if (method === 'GET' || method === 'HEAD') return json(200, select(name, params).map((r) => ({ ...r })))
    if (method === 'POST') {
      const items = Array.isArray(body) ? body : [body]
      const out = []
      for (const item of items) {
        const row = { id: newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(DEFAULTS[name]?.() ?? {}), ...item }
        for (const cols of UNIQUE[name] ?? []) {
          if (cols.every((c) => row[c] != null) && t(name).some((r) => cols.every((c) => r[c] === row[c]))) return json(409, { code: '23505' })
        }
        t(name).push(row)
        out.push({ ...row })
      }
      return json(201, prefer.includes('return=representation') ? out : undefined)
    }
    if (method === 'PATCH') {
      const hit = select(name, params)
      for (const row of hit) Object.assign(row, body)
      return json(200, prefer.includes('return=representation') ? hit.map((r) => ({ ...r })) : undefined)
    }
    if (method === 'DELETE') {
      const hit = new Set(select(name, params))
      tables[name] = t(name).filter((r) => !hit.has(r))
      return json(204)
    }
    return json(405, {})
  }

  return { sb, tables, t, calls }
}
