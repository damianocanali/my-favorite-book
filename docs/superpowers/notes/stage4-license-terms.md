# Stage 4: license terms and the one class print per term

**For:** whoever builds Stage 4 (per-seat pricing and Stripe purchase).
**Why it matters:** printing spends real money.

## The rule Stage 3 depends on

A class print request ("Print the class books", migration 024) is tied to the class license **and its term**. The term is identified by `class_licenses.starts_at`:

- When the teacher asks, the request records the license `id` and the `starts_at` value at that moment, in the columns `license_id` and `term_start`.
- A partial unique index allows only one non-canceled request per `(license_id, term_start)`.
- This is controller ruling R3: each child gets one printed copy per license term, and re-prints are a later feature.

So `starts_at` is what opens the next free print. Every change to it gives the class another round of books.

## What Stage 4 must do

1. **Set a new `starts_at` only when a genuinely new paid term starts.** That means a renewal or new purchase whose payment has succeeded and whose period begins after the previous term.
2. **Never move `starts_at` in any of these cases:**
   - **Grace:** the license enters or leaves `grace`.
   - **Late payment:** a late invoice is paid for the *same* term. Update `status` and `expires_at` only.
   - **Webhook replay:** the same event is delivered twice or out of order. Stripe idempotency must make the second delivery a no-op for `starts_at`.
   - **Admin edits:** seat-count changes, comp/uncomp, or switching the billing method.
   - **Retries:** a failed payment that is later retried for the same period.
3. **Pick one way to recognise a term and use it everywhere.**
   - **Recommended:** set `starts_at` from Stripe's `current_period_start` of the *new* period. Only change it when that value moves forward.
   - Never use `now()` at webhook time.
4. **If Stage 4 keeps one license row across years and only extends `expires_at`,** then `starts_at` must still advance at each new paid term. Otherwise the class can never order books again.

## Tests Stage 4 must add

- A renewal into a new paid period moves `starts_at` forward, and a new class print request is then allowed.
- None of these change `starts_at`, and a second request in the same term is still refused (409 `already_requested`):
  - entering or leaving grace;
  - a late payment for the current period;
  - the same webhook replayed;
  - an out-of-order older event.
- A trial is never printable: a trial license converting to paid starts the first paid term, and that term can print once.

## Where to look

- `supabase-migrations/024_writing_year.sql`: `class_print_requests.license_id`, `term_start`, `class_print_requests_live_uniq`, and `school_create_class_print`, which reads the license `FOR SHARE`.
- `api/school/writing-year.js`: `liveRequestFor(license)`, the pre-check, and the overview's `current_request`.
