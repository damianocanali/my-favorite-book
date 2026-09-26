import { useAuthStore, selectIsStudent } from '../stores/useAuthStore'

/**
 * Whether the signed-in account is a class (student) account. The one check
 * every consumer-only surface (pricing, purchases, print orders, the
 * teacher console, the coin store, photo avatar upload, …) gates on.
 * Thin wrapper over selectIsStudent so every caller reads
 * `app_metadata.role` the same, trusted way — never `user_metadata`, which
 * is user-writable and must never gate anything (see selectIsStudent's own
 * comment in useAuthStore.js).
 * @returns {boolean}
 */
export function useIsStudent() {
  return useAuthStore(selectIsStudent)
}
