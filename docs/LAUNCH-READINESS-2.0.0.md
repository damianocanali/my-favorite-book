# My Book Lab 2.0.0 — Launch Readiness

Audit date: 2026-09-01. Target: App Store submission this week.

Scope: the native iOS app (`ios-native/`), the web app (`src/`), the shared
API (`api/`), and the Supabase schema. The Capacitor shell in `ios/` is
retired and was excluded.

**Method.** 110 findings were produced by eight parallel auditors and then
adversarially re-verified against the source; 4 were rejected as wrong or
inflated. Build claims below are from real runs, not inspection.

---

## Build status — verified, not assumed

| Check | Result |
|---|---|
| `xcodegen` + Release build, simulator | ✅ BUILD SUCCEEDED, 0 errors, 0 warnings |
| Release **archive**, `generic/platform=iOS` | ✅ ARCHIVE SUCCEEDED, signed, widget embedded |
| App / widget version keys | ✅ both `2.0.0 (1)` — no extension-mismatch rejection |
| Entitlements in the built archive | ✅ Sign in with Apple, App Attest (production), App Group |
| 1024 marketing icon | ✅ 1024×1024, `hasAlpha: no` |
| Web `vite build` | ✅ built in 2.51s |
| Web test suite | ✅ 15 files, 158 tests passed |
| **App Store export** | ❌ **FAILED** — see blocker 1 |

---

## Fixed in this pass (code, already applied)

These were live defects. All are in the working tree, unstaged — review
and commit them.

1. **Print payments were impossible on iOS.** `PaymentSheet` was built
   without a publishable key ever being set anywhere in the app, so the
   sheet could not present. `api/print-orders/create.js` now returns the
   publishable key that matches the PaymentIntent's live/test mode, and
   `PrintOrderView` sets it before constructing the sheet. Returning it
   from the server is deliberate: `lib/print/stripe-key.js` switches
   secret keys by deployment, and a hardcoded client key would silently
   mismatch on preview builds.
   <br>`lib/print/stripe-key.js`, `api/print-orders/create.js`,
   `Models/PrintOrder.swift`, `Views/PrintOrderView.swift`

2. **Every hardcover order was billed $5 more than quoted.** iOS showed
   `$34.99`; the server charges `$39.99` (`lib/print/pricing.js`). The web
   was correct — an iOS-only drift. Prices now come from a single
   `PrintPricing` type with the display string derived from the cents, so
   a label can no longer disagree with the total.
   <br>`Models/PrintOrder.swift`, `Views/PrintOrderView.swift`

3. **Photo-to-cartoon was broken on the happy path.** `generate-avatar`
   and `generate-image` return a Supabase Storage **URL** when upload
   succeeds (the normal case) and only fall back to a base64 data URL.
   Three iOS sites decoded data URLs only, so the avatar editor showed
   "Couldn't decode cartoon" and the wizard's hero preview and character
   thumbnail rendered nothing. A shared `GeneratedImage` loader now
   handles both forms.
   <br>`Services/GeneratedImage.swift` (new), `Views/AvatarEditorView.swift`,
   `Views/CreateBookView.swift`

4. **No parental gate before any purchase on iOS** — contradicting the
   store listing, the privacy policy, and the App Review notes you were
   about to submit. The gate existed only before the photo picker, in two
   duplicated copies. Extracted to one shared `ParentalGate` with a
   `.parentalGate(...)` modifier, now applied before the subscription
   purchase, the coin-pack purchase, and the print-order payment.
   (Spending already-earned coins on an art style is deliberately not
   gated — no money changes hands.)
   <br>`Views/ParentalGate.swift` (new), `Views/PaywallView.swift`,
   `Views/CoinStoreView.swift`, `Views/PrintOrderView.swift`

5. **Guideline 1.2 — unmoderated user content with no way to report it.**
   The Gallery is a top-level tab, visible signed-out, showing other
   children's books with no filter, no report, and no block. Added:
   moderation of title/author/character names/page text at publish time
   which **fails closed**; a `report-book` endpoint; auto-hide at two
   distinct reports; per-viewer author blocking; `hidden` filtering on
   every public read; a report action in the gallery and a visible flag
   button in the reader.
   <br>`supabase-migrations/016_book_reports.sql` (new),
   `api/report-book.js` (new), `api/publish-book.js`,
   `Views/ReportBookSheet.swift` (new), `Views/GalleryView.swift`,
   `Services/APIClient.swift`, `Models/PublishedBook.swift`

6. **`/terms` returned the 404 page.** The paywall's required Terms of Use
   link (Guideline 3.1.2) pointed at a route that did not exist. Real
   `/terms` page added, now covering auto-renewal, cancellation via Apple
   ID, coins as non-refundable consumables, and printed-book refunds —
   none of which the old buried text covered.
   <br>`src/pages/TermsPage.jsx` (new), `src/App.jsx`

7. **Privacy policy was materially wrong.** It claimed no personal
   information reaches AI providers (children's photos go to Together AI),
   listed three third parties when seven receive data, described books as
   living on the device when they always sync, and described a voice
   feature the native app does not have. Rewritten to match the code.
   <br>`src/pages/PrivacyPage.jsx`

8. **Recovered a lost on-device illustration fix.** Illustrations were
   stripped to `[saved-locally]` before the cloud save, but the app had no
   on-device image store, so base64 images were unrecoverable on reopen.
   The fix exists in commit `e6f1353` — on no branch. Cherry-picked and
   merged by hand: the lost commit blanket-stripped everything (the older
   behaviour that broke printing), so the newer URL-preserving guard was
   kept and only the local store layered on top.
   <br>`Services/IllustrationStore.swift` (recovered), `Stores/BookshelfStore.swift`

---

## Blockers — must clear before you can submit

### 0. Check the build number before you archive

Both `main` and this branch sit at `2.0.0 (1)`. But the commits behind an
earlier "build 3" (`e6f1353`, `5fd1e33`, `d3d31bf`) exist in the object
store and belong to **no branch** — history was reset at some point. If a
2.0.0 build was already uploaded, App Store Connect rejects a re-used
build number and the upload fails at the last step.

Check the TestFlight build list for 2.0.0, set `CURRENT_PROJECT_VERSION`
above the highest you find, then re-run `xcodegen`.

### 1. Distribution signing (blocks the upload itself)

The App Store export fails today:

```
error: No signing certificate "iOS Distribution" found
error: No profiles for 'com.myfavoritebook.app.widgets' were found
error: Provisioning profile ... doesn't include the App Attest capability
error: Provisioning profile ... doesn't support the group.com.myfavoritebook.app App Group
```

Decoding the profiles on disk shows why — and shows the fix is smaller
than the errors suggest:

| Profile | Type | App Group | App Attest |
|---|---|---|---|
| `com.myfavoritebook.app` | Development | ✅ | ✅ |
| `com.myfavoritebook.app.widgets` | Development | ✅ | — |
| `com.myfavoritebook.app` | **Store** | ❌ | ❌ |
| `com.myfavoritebook.app.widgets` | **Store** | **missing entirely** | — |

The App ID capabilities are already correct in the portal — the
development profiles prove the App Group exists and App Attest is
enabled. (`ios-native/README.md` still lists creating the App Group as a
to-do; it is done.) What is stale is the **distribution** side: the Store
profile was minted 2026-04-04, before those capabilities were added, and
the widget has no Store profile at all. There is also no Apple
Distribution certificate on this machine — only `Apple Development`.

**Do this:** open the project in Xcode signed in to the account, then
Product → Archive → Distribute App. With automatic signing, Xcode creates
the distribution certificate and regenerates both Store profiles with the
current capabilities. This needs your Apple ID to hold Account Holder or
Admin. If it does not, that role has to be granted first — it is the one
step here with a human dependency, so check it before submission day.

### 2. Apply migrations 012–016

Shipping code calls RPCs that these create. If they are unapplied, coin
spending 500s, streaks fail, and print orders break — and 016 is new in
this pass, so the report/block feature needs it.

```sql
-- Supabase SQL editor, in order:
-- 012_user_streaks.sql
-- 013_app_attest.sql
-- 014_illustration_storage.sql
-- 015_user_inventory.sql
-- 016_book_reports.sql   ← new

-- then verify:
select proname from pg_proc
where proname in ('spend_coins_for','touch_streak','bump_generation',
                  'consume_attest_challenge','report_published_book');
-- expect 5 rows

select id, public from storage.buckets where id = 'book-illustrations';
-- expect 1 row
```

`ios-native/README.md` only mentions 012 and 013 — 014 and 015 appear in
no runbook at all, which is how they came to be missed.

### 3. Set `OPENAI_API_KEY` in Vercel production

Publishing now **refuses** when moderation cannot run, rather than letting
unscreened text into a gallery children browse. Without this key set,
publishing returns 503 for everyone. This is a deliberate fail-closed
choice; the alternative was shipping a children's UGC surface with
moderation silently disabled.

Note the generation endpoints still fail **open** — `_aiGuard.js`
`moderatePrompt` returns null when the key is unset or the provider
errors. Worth tightening after launch.

### 4. Coin consumables in App Store Connect + RevenueCat

`coinPurchasesEnabled` is true, so the app sells coin packs. Create three
Consumables with these exact IDs, then **check them under In-App
Purchases on the 2.0.0 version page** so they are reviewed with the
build:

| Product ID | Name | Price |
|---|---|---|
| `com.myfavoritebook.app.coins.small` | 50 Coins | $0.99 |
| `com.myfavoritebook.app.coins.medium` | 200 Coins | $2.99 |
| `com.myfavoritebook.app.coins.large` | 500 Coins | $4.99 |

Import the same IDs into RevenueCat as consumables. `LAUNCH-2.0.0.md`
contradicts itself here — it lists coin IAP under "Known non-blockers"
while also making it required. It is required.

### 5. Decide the Gallery identity question

Published books currently expose **a child's first name and age**
publicly, to signed-out viewers. Combined with a kids-facing app, this is
the riskiest remaining surface for review and the weakest point in the
COPPA claim.

Cheapest safe fix — drop age from the public payload:
- `api/publish-book.js:51,62` — remove `author_age` from both `select=` lists
- `ios-native/.../GalleryView.swift` — remove the `, age N` suffix
- `src/pages/GalleryPage.jsx` — same

I did not make this change: it alters what the product shows, which is
your call. The privacy policy I rewrote describes the **current**
behaviour, so if you make this change, update that section too.

---

## App Store Connect answers

Derived from what the code actually does — these are not guesses.

**Age rating.** Violence, sexual content, nudity, profanity,
alcohol/drugs, horror, gambling, contests: **None**. Unrestricted web
access: **No**. Messaging between users: **No** (Story Buddy is AI-only;
there is no user-to-user messaging). User-generated content: **Yes** —
the Gallery. **Age Assurance and In-App Controls: None** — this is the
question that sank 1.5.0.

**Privacy nutrition labels.** Contact Info → Email, Name, Physical
Address, Phone (all *Linked*, *App Functionality*, **not** used for
tracking). User Content → Photos or Videos **and** Other User Content
(*Linked*, *App Functionality*) — check Photos honestly, the photo leaves
the device. Identifiers → User ID only; **do not** check Device ID.
Purchases → Purchase History. Nothing is used for tracking, so every
"Used for Tracking" box stays unchecked.

**Export compliance.** `ITSAppUsesNonExemptEncryption=false` is correct.
No action.

**Review notes.** Keep the physical-goods (3.1.1) and Sign in with Apple
(4.8) notes. You can now truthfully add: *"A parental gate appears before
the camera and before every purchase,"* and *"Published books are
screened before publication and every book carries a Report action."*
Both became true in this pass — neither was before.

---

## The store listing is stale and must be rewritten

`STORE_LISTING.md` was written for the Capacitor 1.0 build. It advertises
at least eight things the shipping native app does not have — classroom
and teacher mode, OpenDyslexic, focus mode, voice input, word
highlighting, word banks, the progress map, idle nudges, PDF export.
Submitting it as-is means the listing describes an app the reviewer will
not find.

A rewritten listing, built against the 31 views that actually ship, is in
[`docs/marketing/05-app-store-listing-and-aso.md`](marketing/05-app-store-listing-and-aso.md),
along with screenshot specs and the App Preview script.

It also resolves the name collision: the listing says *My Favorite Book*,
the bundle says *My Book Lab*, the domain is mybooklab.app. Pick one — the
recommendation and reasoning are in that document.

---

## iOS↔web parity — the real gap map

You asked to bring iOS up to the web. Here is what that actually means.
The core loop (create → shelf → read → order print) is genuinely at
parity. The divergence is concentrated in three areas.

| Capability | Web | iOS |
|---|---|---|
| Voice input / dictation | ✅ | ❌ *(mic permission string ships, no implementation)* |
| Read-aloud word highlighting | ✅ | ❌ |
| OpenDyslexic font | ✅ | ❌ |
| Focus mode | ✅ | ❌ |
| Word bank | ✅ | ❌ |
| Story progress map | ✅ | ❌ |
| Idle nudges | ✅ | ❌ |
| Sentence starters | ✅ inline, offline | ⚠️ AI sheet only |
| Classroom / teacher dashboard | ✅ | ❌ |
| Publish / unpublish to Gallery | ✅ | ❌ *(browse only)* |
| Sticker reactions, share link | ✅ | ❌ |
| Delete a book | ✅ | ❌ *(store method exists, unwired)* |
| PDF export | ✅ plan-gated | ❌ |
| **Plan limits enforced** | ✅ | ❌ **— free iOS users get paid features** |
| Wizard: colours, time period | ✅ | ❌ |
| Badges awardable | 19 of 20 | 11 of 20 |
| Drawing canvas | ❌ | ✅ |
| Widgets, Live Activity, Siri, alt icons | ❌ | ✅ |
| Cancel scheduled deletion | ❌ | ✅ |

**Two of these are not cosmetic.**

*Plan limits are unenforced on iOS.* `src/lib/plans.js` caps free accounts
at one book and gates PDF export; the iOS app has no equivalent — no
`planKey`, no `maxBooks`, no gate. A free iOS user gets what web charges
for. That is revenue leaking on the platform you are about to promote.

*Voice input is advertised but absent.* The mic usage string ships, so
Apple sees the permission declared with nothing behind it, while the
listing sells the feature.

**Recommended sequencing given a submission this week:** ship 2.0.0 with
the corrected listing (which does not claim the missing features), then
close the gaps in 2.0.1. Trying to build dictation, the accessibility
layer, and classroom before submitting will cost more than a week and put
a large untested surface in front of review. The one exception worth
pulling forward is plan gating — it is small, self-contained, and every
day it ships unenforced is revenue you do not get back.

---

## Worth fixing soon (not blockers)

- **Print pipeline hand-offs are fire-and-forget.** `api/stripe-webhook.js`
  dispatches to the PDF worker with an un-awaited `fetch` and no
  `waitUntil`, then returns 200. An order can stall at `paid` with the
  money taken. Wrap each dispatch in `waitUntil` from `@vercel/functions`
  and add a reconciliation cron.
- **`pdf-worker` computes the wrong interior page count** for books with
  26+ pages, so the cover spread is sized wrong.
- **The three alternate app icons are blank gradients**, and two are sold
  for coins bought with real money. Draw them or make them free before
  launch.
- **Lulu webhook guesses its signature scheme**; if none matches, orders
  freeze at `submitted`. Register the webhook and confirm the
  `verified via <scheme>` log line on a real order.
- **`LULU_API_BASE` defaults to Lulu's sandbox** — if the production var
  is ever unset, paid orders print nowhere. Make it throw in production.
- **`classrooms` / `submissions` / `subscriptions` tables have no
  migration** and are reached with the anon key. Verify RLS in production
  now: `select tablename, rowsecurity from pg_tables where tablename in
  ('classrooms','submissions')`.
- **`.env.example` documents 5 of ~30 server env vars.**
- **Shipping is a flat $4.99 with $0.00 tax**, hardcoded.

---

## Marketing

A full campaign, fact-checked against the code, is in
[`docs/marketing/`](marketing/):

| File | What |
|---|---|
| `00-brand-foundation.md` | Product truth, positioning, visual system |
| `01-instagram-feed-posts.md` | 16 posts, captions final |
| `02-reels-and-video-scripts.md` | 12 scripts with shot lists |
| `03-stories-and-community.md` | Story sequences, outreach, reply templates |
| `04-30-day-content-calendar.md` | Day-by-day plan |
| `05-app-store-listing-and-aso.md` | Rewritten listing, screenshots, preview script |
| `06-launch-kit.md` | Press, Product Hunt, email, teacher outreach |
| `07-marketing-compliance.md` | Claim guardrails for a kids' app |
| `08-review-notes.md` | Both reviewers' required fixes |

A hostile fact-checker read the campaign against the source and found 16
claims to correct — including two that describe behaviour the code does
not have. **Those corrections are attached inline to the posts and reels
they affect, as warning boxes.** Resolve each one before that piece goes
out.
