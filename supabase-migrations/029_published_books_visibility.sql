-- published_books: hidden books and author account ids stay private
-- (privacy review §4.2 / §7.8).
--
-- 001 created "Published books are publicly readable" USING (true), so the
-- anon key could read every row straight from PostgREST — reported books
-- that were auto-hidden (016) included — with user_id, the author's
-- account UUID (often a child's).
--
-- No client reads this table directly: the web app and the iOS app both go
-- through api/publish-book.js (service role), which now returns is_owner
-- and an opaque author handle instead of user_id (lib/authorRef.js), and
-- api/report-book.js resolves that handle for "block this author". So:
--   * the read policy only shows visible books;
--   * anon/authenticated lose SELECT on user_id (and on the moderation
--     columns), keeping column-level SELECT on the public ones. A
--     column-level REVOKE does nothing while a table-level grant exists,
--     hence revoke-all-then-grant-columns.
-- The service role (API) is unaffected.
--
-- Deploy the API change first or together; this only removes access no
-- shipped client uses. Idempotent.

drop policy if exists "Published books are publicly readable" on public.published_books;
drop policy if exists "Visible published books are publicly readable" on public.published_books;
create policy "Visible published books are publicly readable"
  on public.published_books for select
  using (hidden = false);

revoke select on public.published_books from anon, authenticated;
grant select (
  id, slug, title, author_name, author_age, cover_emoji, cover_color,
  book_data, reaction_counts, featured, featured_at, published_at, created_at
) on public.published_books to anon, authenticated;
