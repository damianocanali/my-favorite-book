// Whose data is sitting in this browser's localStorage (books, the book in
// progress, print address…). Persisted stores don't record an owner, so
// without this a page load that starts signed in as someone new — a reset
// or confirmation link, an OAuth return, an expired session followed by a
// different login — adopted the previous person's local books and then
// uploaded the "local-only" ones into the new account.
//
// null = nobody's yet (a visitor's drafts): those are adopted by the first
// account that signs in, which is the intended guest → sign-up path.
export const LOCAL_OWNER_KEY = 'mbl-local-owner'

function storage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function readLocalOwner(store = storage()) {
  try { return store?.getItem(LOCAL_OWNER_KEY) || null } catch { return null }
}

export function writeLocalOwner(userId, store = storage()) {
  try {
    if (userId) store?.setItem(LOCAL_OWNER_KEY, userId)
    else store?.removeItem(LOCAL_OWNER_KEY)
  } catch { /* private mode etc.: the in-memory checks still run */ }
}

/// True when the local data belongs to someone other than `userId` and must
/// be cleared before `userId` sees or syncs it.
export function belongsToSomeoneElse(userId, owner) {
  return Boolean(owner && userId && owner !== userId)
}
