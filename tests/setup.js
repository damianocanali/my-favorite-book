process.env.SUPABASE_URL ??= 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'stub-service-key'
process.env.STRIPE_SECRET_KEY ??= 'sk_test_stub'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_stub'
process.env.LULU_CLIENT_KEY ??= 'lulu-stub'
process.env.LULU_CLIENT_SECRET ??= 'lulu-stub-secret'
process.env.LULU_API_BASE ??= 'https://api.sandbox.lulu.com'
process.env.LULU_WEBHOOK_SECRET ??= 'lulu-whsec-stub'
process.env.TOGETHER_API_KEY ??= 'together-stub'

// vitest runs in the node environment, so there is no localStorage. Stores
// that use zustand's persist middleware need one to exercise at all.
// Minimal by design — a real implementation would hide bugs this stub makes
// obvious, like writing objects instead of strings.
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)) },
    removeItem: (k) => { mem.delete(k) },
    clear: () => { mem.clear() },
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size },
  }
}
