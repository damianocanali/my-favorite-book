# App Store Listing & ASO

# My Book Lab — App Store Optimization & Store Assets (v2.0.0)

Everything below is written against the shipping SwiftUI app at `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab`. `STORE_LISTING.md` is superseded in full — it describes the retired Capacitor v1.0 and contains at least seven claims that are false for the App Store build.

> **Revision — re-verified against the working tree.** Three things changed since the first draft of this document and all three are load-bearing for the copy below:
>
> 1. **Two of the three launch blockers are fixed** (print price, Gallery moderation). One is not (the paywall). §0 is rewritten.
> 2. **Three claims in the description were wrong or overstated** and are corrected in §1.5 — the drawing-vs-AI reward claim, the on-screen AI label, and the moderation claim. The corrected wording, and the code that forced each correction, is recorded in §1.5 under "The three corrections the fact-check forced".
> 3. **The app is localised into Italian**, so §5 is no longer a "don't translate yet" memo. It now carries a complete **Italian App Store listing** (§5.4) with its own keyword field.
>
> An AI-disclosure line has been added to the description in both languages (§1.5, §5.4) because EU AI Act Art. 50 has applied since 2 August 2026.

---

## 0. Blockers — one still open, two closed

These are not ASO notes. Each one is a code fact, and each is a plausible rejection or refund event.

### 0.1 Still open

| # | Problem | Evidence | Why it blocks the listing |
|---|---|---|---|
| 1 | **Paywall over-claims two features that do not exist, and is not translated.** | `ios-native/MyBookLab/Views/PaywallView.swift:122` `benefit("🎙️", "Voice input & read aloud")` and `:123` `benefit("👨‍👩‍👧", "Up to 4 kid profiles")` | There is no `SFSpeechRecognizer` and no `AVAudioEngine` capture anywhere in `ios-native/` — the only speech API present is `AVSpeechSynthesizer` in `Services/SpeechSpeaker.swift:14`, which is output, not input. No profile model, table or switcher exists in `ios-native/`, `src/` or `api/`. App Review reads the paywall under Guideline 3.1.2 (accurate subscription information) and 2.3.1 (accurate metadata). Delete both lines. Replace with verified ones: `"✏️ Draw your own illustrations"`, `"🔊 Read your finished book aloud"`. |
| 1b | **The same five paywall lines are invisible to the Italian build.** | `benefit(_ emoji: String, _ text: String)` at `PaywallView.swift:131` takes `String`, not `LocalizedStringKey`, so none of the five benefit strings is extracted — they are absent from `Localizable.xcstrings`. | An Italian buyer reaches the purchase screen and reads five English lines, two of which describe features that don't exist. This is the single worst screen in the Italian build and it is the screen Apple checks hardest. Change the signature to `LocalizedStringKey` and re-extract **before** the Italian metadata goes live. |
| 2 | **`NSMicrophoneUsageDescription` now has an Italian translation for a feature that does not exist.** | `ios-native/MyBookLab/InfoPlist.xcstrings` → `it`: *"Per dettare la tua storia quando tocchi il pulsante del microfono."* There is no microphone button and no capture code. | A permission string is metadata under 2.3.1, and a *translated* dead string reads as deliberate rather than vestigial. Delete the key from `Info.plist` and from the catalog. |

### 0.2 Closed since the first draft — and each one is now a copy asset

| # | Was | Now | Evidence |
|---|---|---|---|
| 1 | Print price mismatch: app showed `$34.99`, server charged `$39.99`. | **Fixed.** Display and total both derive from one table. | `ios-native/MyBookLab/Models/PrintOrder.swift:44-64` — `PrintPricing.unitCents` returns `3999` hardcover / `1999` softcover, matching `lib/print/pricing.js:2`. `PrintOrderView.swift:50` and `:140-142` both read from it. `priceLabel` formats via `Int.asPrice` (`Models/PriceFormatting.swift`), which keeps the currency at USD but takes grouping and decimal separators from the reader's locale. |
| 2 | Gallery shipped UGC with no report, block, filter or published contact. | **Fixed, and it is now the strongest safety paragraph in the listing.** | Screening: `api/publish-book.js:135-152` refuses to publish at all when `OPENAI_API_KEY` is unset and moderates the joined title, author name, character names and every page before insert. Report: `GalleryView.swift:103-107` (long-press on any gallery card) and `:217-227` (a Report button on the opened book), both opening `ReportBookSheet.swift`. Block: `ReportBookSheet.swift:129-184` → `APIClient.blockAuthor` → `api/report-book.js`. Auto-hide: two distinct reports hide a book (`supabase-migrations/016_book_reports.sql`). Published contact: `ReportBookSheet.swift:139` shows `support@mybooklab.app`. |
| 3 | Parental gate covered only the photo picker. | **Fixed — it now precedes every purchase.** | `Views/ParentalGate.swift:79` exposes a `.parentalGate(isPresented:onPass:)` modifier, applied at `PrintOrderView.swift:95` (print order), `PaywallView.swift:72` (subscription) and `CoinStoreView.swift:305` (coin packs), alongside the original photo-picker gate at `CreateBookView.swift:358-361`. |
| 4 | No Terms of Use page. | **Fixed.** | `src/pages/TermsPage.jsx`, routed at `src/App.jsx:92`, linked from the iOS paywall at `PaywallView.swift:225`. This satisfies the App Store Connect EULA field and Guideline 3.1.2's terms requirement. |

Three standing cautions, unchanged: **the free-tier book cap is not enforced on iOS** (no `maxBooks` check anywhere in `ios-native/`), so never promise a free-tier limit in iOS copy; **iOS still cannot publish to the gallery** (`APIClient.swift` has GET paths to `/api/publish-book` at `:236` and `:268` and no POST), so never imply a child can share from the app; and **all six mascot imagesets are empty** — every `Assets.xcassets/Mascot*.imageset/Contents.json` declares 1x/2x/3x slots with no filenames, so `Mascot.swift` falls through to its emoji fallback. The shipping app shows ⭐👋🤗🎉🤔🏅 where the drawn character should be, which means **the mascot may not appear in any screenshot or preview frame captured from the app.**

---

## 1. The rewritten listing

### 1.1 App name — recommendation: **My Book Lab**

Adopt "My Book Lab" everywhere and retire "My Favorite Book" completely.

The inconsistency is already resolved in the code; only the store metadata lags. `project.yml` sets `CFBundleDisplayName: My Book Lab`, `Info.plist:9` matches, and the gradient wordmark in `HeroLanding.swift:102` reads "My Book Lab". The only surviving trace of the old name is the bundle identifier `com.myfavoritebook.app`, which is immutable, invisible to users, and irrelevant to ASO.

Four reasons beyond consistency:

1. **"My Favorite Book" describes reading, not making.** A parent searching that phrase is looking for a book they love, not a tool that builds one. It positions the app against Epic! and Libby, categories it will always lose to.
2. **It has a spelling fork.** "Favorite" / "Favourite" splits your US and UK/AU/CA keyword surface in half, which is a real cost given English-language markets are your entire tier-0 localisation plan (§5).
3. **"Lab" carries the product's actual thesis.** A lab is where you make things and the outcome isn't guaranteed. That is exactly the honest promise here — the app supplies the equipment, the child does the work.
4. **The domain already agrees.** `mybooklab.app` is the support and privacy URL; a name mismatch between the store page and the URL on that page reads as a scam signal to exactly the suspicious parent you're targeting.

**App Store name field (30 char max) — use the full 30:**

> `My Book Lab: Kids Story Maker` — **29 characters**

The name field carries the heaviest keyword weight of any indexed field, so it should not be just the brand. This buys you `kids`, `story`, and `maker`, and Apple will combine them with keyword-field tokens into phrases (`kids story writing`, `story book maker`, `picture story maker`).

Alternates if the team objects to the suffix:
- `My Book Lab: Write & Illustrate` — 31, too long
- `My Book Lab: Kids Write Books` — 29
- `My Book Lab: Story Writing` — 26

Keep `CFBundleDisplayName` at plain `My Book Lab` — the home-screen label should stay short, and Apple explicitly allows the store name and the bundle display name to differ.

### 1.2 Subtitle (30 char max)

> `Write, draw and print stories` — **29 characters**

Every one of those three verbs is verified in the shipping build: writing is a bare `TextEditor` in `CreateBookView`, drawing is `DrawingCanvasView.swift` (PencilKit, exported at 1536×1024 for print), printing is `PrintOrderView.swift` → `api/print-orders/create.js`.

It deliberately does not say "AI". That is the single most important restraint in this whole document. To the buyer described in the positioning brief, "AI-powered" as a headline reads as *the computer does it*, which is the exact thing she is trying to avoid. AI belongs in the body, framed as the reward for writing.

Alternates:
- `Your child's book, start to finish` — 33, too long
- `Where kids become real authors` — 30
- `Story writing that gets unstuck` — 30

Avoid: anything with "publish" (a child **cannot** publish to the gallery from iOS — `APIClient.swift` has no POST to `/api/publish-book`), and anything with "voice" or "dictation".

### 1.3 Keyword field (100 char max)

Apple indexes the name, subtitle, and keyword field, plus your category. Do not repeat any token already in the name or subtitle, do not use spaces after commas, do not use plurals of words you already have, and never use a competitor's name — Apple rejects for that.

Already indexed by name + subtitle: `my, book, lab, kids, story, maker, write, draw, and, print, stories`.

**Recommended keyword string (exactly 100 characters):**

```
writing,author,dyslexia,adhd,storybook,creative,illustrate,homeschool,literacy,child,picture,journal
```

#### The reasoning

The competitive set a parent actually meets when she searches is three distinct clusters, and you want to be indexed against all three while being confusable with none:

**Cluster A — "make your own book" tools.** Book Creator (dominant in schools, iPad-native), StoryJumper (the closest true competitor — kids write a book, you order a printed copy), Storybird, Toontastic 3D. These own `book creator`, `story maker`, `make a book`. You compete here on the printed artefact and the iPad drawing canvas.

**Cluster B — writing instruction / literacy.** Night Zookeeper is the important one: it is heavily marketed to exactly your ICP (parents of 6-12s with ADHD/dyslexia who "won't write"), it advertises hard on Instagram, and a parent who has heard of it will search its category terms. Also Writing Legends, Squiggle Park/Dreamscape, Nessy (the dyslexia incumbent). These own `writing for kids`, `creative writing`, `dyslexia`.

**Cluster C — AI story generators.** Bedtimestory.ai, Oscar Stories, StoryBee, and a long tail of "AI makes a personalised story for your child" apps. They own `ai story`. **You should not chase these terms.** Their users want a story generated *for* the child; yours is defined by refusing to do that. Ranking there buys installs that churn in a day and leave 2-star reviews saying "it made my kid do all the writing" — which is a review that will actually appear, and which you'd rather not have.

Token-by-token:

- `writing` — the single highest-intent head term you don't already have. Combines with name tokens into `kids writing`, `story writing`, `writing maker`.
- `author` — parent-facing emotional term ("my child is an author") and combines to `kid author`, `child author`, `story author`.
- `dyslexia` / `adhd` — the sharpest ICP segment and genuinely low-competition on the *writing* side (most results are reading and phonics apps). See the caveat below.
- `storybook` — distinct token from `story`; combines to `storybook maker`, `picture storybook`.
- `creative` — makes `creative writing`, which is a real high-volume parent search.
- `illustrate` — differentiates you from text-only writing apps and is under-used by competitors.
- `homeschool` — your fastest-converting secondary segment per the positioning brief, and a high-intent, low-cost term.
- `literacy` — teacher-adjacent and parent-adjacent; catches the "science of reading" audience.
- `child` — singular complement to `kids`; combines to `child author`, `child writing`.
- `picture` — makes `picture book`, which is a genuinely large search and precisely what the product outputs.
- `journal` — adjacent-intent catch. Parents searching kids' journalling apps are the same buyer and there is no better fit for them.

#### Caveat on `adhd` and `dyslexia`

These are legitimate discovery terms and I'd keep them, but three rules travel with them:

1. **The description must never make a clinical claim.** Not "helps children with ADHD", not "designed for dyslexia", not "supports learning differences". Apple's Guideline 1.4.1 and the FTC both treat those as health claims. Describe the *behaviour* — "for the child who freezes at a blank page" — and let the parent make the connection.
2. **You cannot claim the dyslexia font on iOS.** `grep -ri "dyslex" ios-native/` returns nothing. OpenDyslexic is a web-only toggle (`src/stores/useAccessibilityStore.js`). A parent who downloads on the strength of a `dyslexia` keyword and finds no font is a refund and a specific, damaging 1-star review. Mitigate this in the description by naming what iOS *does* offer for the stall (sentence starters, non-insertable questions, offline shake-for-an-idea, slowed read-aloud, effort-only badges) rather than staying silent.
3. If Review pushes back, swap `adhd,dyslexia` (13 chars) for `pencil,drawing` and re-balance.

**Conservative alternate (no health terms, exactly 100 chars):**

```
writing,author,storybook,creative,illustrate,homeschool,literacy,child,picture,journal,pencil,notebook
```

*(That reads 102 — trim `notebook` to fit at 93, or drop `journal` for 94. Use the first string unless Review objects.)*

### 1.4 Promotional text (170 char max — updatable without a build)

This field sits above the description, is not indexed, and can be changed any time. Use it as the live campaign slot that matches whatever Instagram is running.

**Default:**

> New in 2.0: draw your own pictures with Apple Pencil, a Home Screen widget with your writing streak, and Face ID sign-in. Shake the iPad for a story idea.

*(155 characters.)*

**Seasonal / gifting variant (Nov–Dec):**

> Finish a book by Dec 10 and the hardcover arrives before Christmas. Your child writes every word — we just print it properly. US shipping.

*(139 characters. Only run this if you have verified fulfilment lead times — I have not, and there is nothing in the repo that establishes them.)*

### 1.5 Full description

The collapsed preview on iPhone shows roughly the first three lines (~150–170 characters) before "more". Everything that matters must land there. The first line is doing the entire job of a scroll-stopper for a parent who has already been failed by two educational apps.

```
Your child can tell you a forty-minute story in the car and then write four
sentences for school and say they're bad at writing.

They're not. They're stuck at the start. That's a different problem.

My Book Lab is a writing app for children aged roughly 5 to 12 that walks them
through making one real book — one small screen at a time. Who's the hero.
Where it happens. What it's called. Then a page, and another page. At the end
it's a book you can flip through, and one you can order printed and hold.


THE APP WILL NOT WRITE THE STORY

This is the part worth knowing before you download it.

When your child gets stuck, Story Buddy has exactly two buttons. "Give me
ideas" hands back three opening sentences — one line each, the kind a teacher
writes on the board — and your child taps one and keeps going. "Help me think"
hands back three questions about their own story, and gives them no way to
paste an answer in. They have to think of it and type it.

The writing page itself is an empty text box. No autocomplete. No suggested
next sentence. No "finish this for me". Under age nine, the free-text chat
with Story Buddy isn't in the interface at all.

Open it yourself before you hand it over and press the buttons. It takes ten
minutes and then you'll know.


THE WORDS COME FIRST, THEN THE PICTURE

The Illustrate button doesn't work on an empty page. It's greyed out until
your child has written something, and the picture it makes comes from the
sentence they actually wrote. Writing is the price of admission to the fun
part, not the other way round.

And they can skip the AI entirely. There's a Draw button right next to
Illustrate, the same size: your child draws the page with a finger or an Apple
Pencil, using Apple's own pencils, crayons and markers, and that drawing is
what goes into the printed book. Drawing it and generating it earn exactly the
same badge, so nothing in the app nudges your child toward the AI one.

The illustrations and the cover are generated by AI from the words your child
wrote. AI pictures get things wrong — six fingers, a hat that changes colour
between pages — and the Draw button is there for when your child would rather
do it properly.


IT ENDS IN SOMETHING YOU CAN HOLD

Most iPad sessions have no exit. This one does — there's a last step and an
"I'm done writing" button, not a feed.

The finished story reads like a picture book: cream pages, an illustration
above, the story below, a cover, and a "The End" page. On iPad in landscape it
opens as a genuine two-page spread. It reads aloud, page by page, at a
deliberately slowed speech rate.

And you can order it as a real book — softcover or hardcover, shipped to your
house, with your child's name on the cover. Ordering is separate and one-off;
you're never subscribed into a book you didn't order. US shipping only for now.


WHAT'S IN IT

- A six-step wizard: author, hero, world, title, pages, done
- 64 emoji heroes and 6 story worlds to build from
- Turn a photo into a cartoon hero of your child — behind a grown-up check
- Draw your own illustrations with a finger or Apple Pencil
- AI illustrations and a painted cover, made from what your child wrote
- Read the finished book aloud
- Shake the iPad for a story idea — 30 of them, stored on the device, works
  with no internet
- 20 effort badges, a day-streak, and coins that buy art styles and app icons
- A Home Screen widget with the newest book and the writing streak
- Sign in with Apple, or Face ID / Touch ID in one tap
- Siri: "Start a story in My Book Lab"
- Reduce Motion is honoured throughout


REWARDS FOR SHOWING UP, NEVER FOR WRITING "WELL"

Every badge in the catalogue is for doing something — wrote your first page,
wrote five pages, drew your own picture, ordered a printed copy. Nothing in
this app scores, grades, corrects or flags your child's writing. Spelling is
never marked wrong.

There's a day-streak. It counts days your child wrote, not words. There is no
leaderboard, no comparison to other children, no notification chasing them to
protect it, no lives, no energy that runs out. If it's not for you, it's
peripheral — the app works fine ignored.


SAFETY, PLAINLY

- The illustrations and the cover are made by AI. The words are your child's.
- No ads. No analytics tracker. No data sold. The privacy manifest declares no
  cross-app tracking.
- A grown-up check — a two-digit addition problem — before the photo picker,
  and before every purchase: the subscription, coins, and a printed book.
- If a photo is used to make a cartoon hero, the original photo is never saved.
  Only the cartoon is kept.
- What your child writes is checked for unsafe content before it's sent to
  Story Buddy, and blocked with a kind message rather than an error.
- Story Buddy is instructed to refuse anything scary or inappropriate, and to
  ignore attempts — including from your child — to change what it is.
- Books stay private on your child's shelf. Nothing is shared unless someone
  deliberately publishes it, and a book can only be published from the website,
  never from this app.
- Every book in the public Gallery is screened before it appears, and every
  book in the Gallery has a Report action — long-press it, or use the button on
  the open book. You can also hide everything by one author. Reports reach a
  person, and enough of them hide a book on the spot.
- You can delete your account and everything in it from inside the app, with
  seven days to change your mind.

What we won't tell you is that it's impossible for an AI to say something
unexpected, or that a filter catches everything. It's constrained, checked and
rate-limited, and we'd rather say that than promise perfection. Report anything
that gets through: support@mybooklab.app.


BEFORE YOU BUY

There's a free tier so you can build a book and see exactly how the help
behaves before paying anything. Subscription prices are shown in the App Store
at the moment you subscribe, and it's an Apple subscription — cancel it in
Settings, no email to us. Printing is a separate one-off purchase.

Made for iPad first, and it works on iPhone.

Privacy policy: https://mybooklab.app/privacy
Support: https://mybooklab.app
```

#### The three corrections the fact-check forced, and the code that forced them

Each of these was in the previous draft of the description and each was wrong. They are recorded rather than quietly deleted, because two of them describe a feature the product *should* have and the gap is now a backlog item rather than a sentence.

**1. "The app rewards that path more than the AI one." — false.**

Drawing a page and generating one award **the same badge at the same value.** `CreateBookView.swift:921` (`saveDrawing`, the hand-drawing path) and `CreateBookView.swift:951` (`generateIllustration`, the AI path) both call `RewardsStore.shared.earn("added_illustration")`, worth 15 coins in the server-authoritative table at `api/claim-badge.js:23`. There *is* a 25-coin `drew_illustration` badge defined in `Stores/RewardsStore.swift:114-117` and in `api/claim-badge.js:35` — **iOS never earns it.** No call site exists.

The corrected sentence says the two paths earn the same badge, which is both true and a better line: it is checkable in ten seconds by a parent who reads the badge list, and "we don't nudge you toward the AI" is a more credible claim than "we punish it".

*Backlog, worth doing before the next metadata pass:* have `saveDrawing` earn `drew_illustration`. It is a one-line change, the badge and its coin value already exist on both sides of the wire, and it would make the original, stronger sentence true.

**2. "Every AI picture is labelled on screen as AI-generated." — false.**

No such label exists. `grep -ri "ai.generated" ios-native/` returns one code comment in `Models/Book.swift:103` and nothing rendered. The illustration slot in `CreateBookView` and the page card in `BookDetailView` show the image with no provenance marking of any kind.

The corrected copy states in the description that the illustrations and the cover are AI-generated — twice, once in the body and once as the first line of SAFETY — which is a **listing** disclosure, not an in-app one.

*This is now a code obligation, not a copy preference.* EU AI Act Art. 50 has applied since 2 August 2026, and the sourced finding at `docs/ITALY-LEGAL-FINDINGS.md` concludes My Book Lab is a **provider**, not merely a deployer, because it ships an AI system under its own name — so Art. 50(2) machine-readable marking falls on the company and not on Together AI. Art. 50(5) additionally requires the disclosure to be given "in a clear and distinguishable manner at the latest at the time of the first interaction or exposure" and to meet accessibility requirements. A store description is not first exposure. Until an on-screen label ships, **no marketing asset anywhere may claim one exists.**

**3. "Everything your child types is run through a content check before it reaches any AI." — overstated in two separate ways.**

- **It fails open.** `api/_aiGuard.js:102-127`: `moderatePrompt` returns `null` — meaning *allow* — when `OPENAI_API_KEY` is unset, when the OpenAI request returns non-OK, and on any thrown exception. In each case the content goes to the model unscreened. "Everything is run through a check" describes the happy path only.
- **The two AI paths check different things.** Story Buddy moderates the child's free-text message (`api/story-buddy.js:243`) and the full page text on an intent call (`:260`). The illustration path moderates the constructed image prompt (`api/generate-image.js:69`), and that prompt contains only the **first 200 characters** of the page — `CreateBookView.swift:929` builds `scene` with `.prefix(200)`. Text beyond character 200 never reaches the moderation endpoint on the illustration path.

The corrected bullet is scoped to Story Buddy, which is the path the sentence was really about and the one where the claim holds. The closing paragraph now explicitly declines to promise the filter catches everything, and publishes a reporting address.

Worth stating because it is genuinely good and the copy should use it: **publishing fails closed.** `api/publish-book.js:138` refuses with a 503 when the moderation key is unset rather than letting unscreened text into a gallery children browse, and `:145-152` screens the title, author name, character names and every page before insert. That asymmetry — fail open on a private draft, fail closed on public content — is defensible and is exactly what the new Gallery bullet claims.

#### What I deliberately left out, and why

| Left out | Reason |
|---|---|
| Voice input / dictation | No `SFSpeechRecognizer`, no `AVAudioEngine` in `ios-native/`. Only a dead `NSMicrophoneUsageDescription` at `Info.plist:58-59`. |
| Read-aloud **with word highlighting** | `SpeechSpeaker.swift:16-26` has no boundary callback. Highlighting is web-only (`src/hooks/useSpeechSynthesis.js:31-40`). The description says "reads the finished book aloud" — no highlighting claimed. |
| OpenDyslexic font, focus mode, high-contrast, adjustable fonts | None exist in `ios-native/`. The most sensitive possible over-claim given the audience. |
| Word banks, sentence-starter library, story progress map, idle nudges | All web-only (`WritingScaffold.jsx`, `StoryProgressMap.jsx`, `lib/sentenceStarters.js`). iOS starters are AI-generated through Story Buddy, which is a different, network-dependent thing. |
| Classroom / teacher mode | No classroom view in `ios-native/Views/`; `APIClient.swift` never calls `/api/classroom`. Web-only. Also — Apple discourages describing functionality that lives on another platform. |
| PDF export | iOS has no PDF or export path at all. |
| "Works offline for writing" | `BookDraftStore.swift` has no persistence; `BookshelfStore.swift:30-37` reads straight from Supabase. Only the shake-for-an-idea prompts are genuinely offline, and that's the only offline claim made. |
| "2 books free" / any free-tier book cap | `plans.js` says 1 on web, and iOS enforces **no** cap. Claiming either number is wrong somewhere. |
| A specific hardcover price | **No longer blocked** — `PrintPricing` (`Models/PrintOrder.swift:44-64`) now agrees with `lib/print/pricing.js`. You may add "softcover $19.99, hardcover $39.99, $4.99 US shipping" to the print paragraph in the **en-US** description; it's a real conversion asset. Do **not** carry those figures into the Italian description — see §5.4. |
| "Up to 4 kid profiles", "20 badges to collect" | No profile implementation exists. Only 11 of the 20 badges are reachable from iOS, so the description says "20 effort badges" as a catalogue fact and makes no completion promise. |
| COPPA compliant, WCAG, UDL | Policy statements and design intents, not certifications. No audit or VPAT exists in the repo. |
| "AI-powered" as a headline | Positioning decision. It appears only in the body, framed as the reward for writing. |
| Publishing to the gallery | iOS can read the gallery but cannot post to it. |

---

## 2. What's New — version 2.0.0

App Store Connect allows 4,000 characters; the first two lines are what most people see.

```
2.0 is a complete rebuild. My Book Lab is now a native iPad and iPhone app —
faster, smoother, and it finally works the way an iPad should.

NEW: DRAW IT YOURSELF
A Draw button now sits next to Illustrate. Your child draws the page with a
finger or an Apple Pencil using Apple's own pencils, crayons and markers, and
that drawing goes into the book — and into the printed copy. No AI involved.

NEW: SHAKE FOR AN IDEA
Stuck before you've started? Shake the iPad and a story idea appears. Thirty of
them, stored on the device, so it works with no internet and no waiting.

NEW: A HOME SCREEN WIDGET
Your child's newest book and their writing streak, on the Home Screen.

NEW: FASTER, SAFER SIGN-IN
Sign in with Apple, or come back with one tap using Face ID or Touch ID. We
store a session token in the Keychain and never your password.

NEW: TRACK A PRINT ORDER FROM THE LOCK SCREEN
Order a printed book and a Live Activity follows it from "sent to printer" to
"on its way", in the Dynamic Island and on the Lock Screen while the app is open.

NEW: A REAL BOOKSHELF
Finished books now stand as coloured spines on a wooden shelf. Tap one and it
lifts off the shelf and opens.

ALSO IN THIS RELEASE
- On iPad in landscape, a finished book opens as a genuine two-page spread
- Unlockable app icons: Rocket, Rainbow, and Night Owl for a seven-day streak
- Siri and Shortcuts: "Start a story in My Book Lab"
- Your books are searchable from the Home Screen with Spotlight
- Ambient music for each part of the app, with a single on/off switch in Account
- Reduce Motion is now honoured throughout — looping animations stop, and
  confetti appears without falling or spinning
- Delete your account and everything in it from inside the app, with seven days
  to change your mind

The app used to be called My Favorite Book. Same team, same books — clearer name.
```

If Apple flags the rename as user-confusing, the first line becomes the mitigation: keep "The app used to be called My Favorite Book" in the release notes for at least three versions, and also add it to the top of the description body for 2.0.0 only.

---

## 3. Screenshot sets

### Shared production rules

**Sizes.** iPhone 6.9" = 1290 × 2796 or 1320 × 2868 portrait. iPad 13" = 2064 × 2752 portrait / 2752 × 2064 landscape. Apple now accepts these two sizes only as the required uploads; everything smaller is scaled down automatically.

**Layout system, identical across all twelve** so the set reads as one object when a parent swipes:

- Canvas: the cosmic gradient, `#0D0A29 → #1A0D3D → #2E1252 → #1C0A2E`, topLeading to bottomTrailing, seeded 70-star field, all three nebula blobs at their canonical offsets (purple 35% / 320pt at −120,−200; pink 22% / 280pt at 140,260; cyan 18% / 220pt at 60,−80).
- Top 26% is the caption band. Headline in SF Pro Rounded **Heavy**, pure white, two lines maximum, with an `rgba(0,0,0,0.35)` 20px-blur backing so it survives the `#2E1252` bright stop. Sub-caption directly beneath in SF Rounded **Semibold** at `rgba(255,255,255,0.70)`, one line, never wrapping to three.
- The device capture sits below, straight on, 0° tilt, no faux-3D, in a current unbranded iPhone/iPad frame at its real corner radius, bleeding off the bottom edge of the canvas. Purple glow behind it: `rgba(191,90,242,0.45)`, 60px blur, 20px down.
- Exactly three drifting sparkles per frame, all outside the device silhouette, none touching type. No confetti except on screenshot 6 of the iPhone set.
- **No mascot anywhere.** The imagesets are empty and the app renders emoji; compositing the drawn mascot over an app capture would misrepresent the build.

**Content rules (from the shooting brief, all mandatory):** demo account only, "Theo and the Star Bear" as the book, fictional author name typed into the wizard before recording, no real faces, no real names, no real order or address, no empty states, no spinners, no `AsyncImage` placeholder, clean status bar at 9:41 with full battery and notifications off, Reduce Motion **off** during capture.

**Ordering logic.** App Store search results show the first three portrait screenshots inline, so 1–3 must carry acquisition and 4–6 carry the deeper sell for someone who has tapped through to the page. The spine of the order is: *this is what it makes* → *this is why it isn't cheating* → *this is your child's own hand* → *this is the object you get* → *this is the library that accumulates* → *this is why it's safe to hand over*. Emotional payoff (the artefact) is deliberately at 4, not 1, because at position 1 a parent doesn't yet believe her child made it — the frame has to prove authorship first.

---

### 3.1 iPhone 6.9" — six screenshots

**Screenshot 1 — carries the whole pitch**

- **Screen:** `CreateBookView` step 4, the page editor (`Views/CreateBookView.swift:674-788`). Page 3 of the demo book, showing typed story text in the `TextEditor` **and** a completed illustration in the slot above it, with the purple "Illustrate" button visible in its normal enabled state and the "Draw" button beside it. The numbered page-tab strip visible at the bottom.
- **Headline:** `Your child writes it. Every word.`  *(5 words)*
- **Sub-caption:** `Then the picture comes from what they wrote.`
- **Background:** standard system above. Give this one frame slightly more scale — device at 72% of canvas height rather than 68% — so it reads at thumbnail size in search results.
- **Why first:** it is the only frame that contains the entire proposition in one image — a child's sentence, and the picture that sentence produced, in the same rectangle, with both the AI and the hand-drawing routes visible as buttons. It also silently answers the "is this just a picture generator" question, because the text box is the larger element.

**Screenshot 2**

- **Screen:** `StoryBuddyView` (`Views/StoryBuddyView.swift`), showing the two idea buttons (💡 "Give me ideas", 🤔 "Help me think"), the on-screen line at `:95` — *"Stuck? Tap a button and I'll help with ideas — I never write your story for you. ✨"* — legible, and three returned **question** cards below (the non-insertable kind). Capture from a book whose `authorAge` is under 9 so the free-text chat field is genuinely absent from the interface.
- **Headline:** `It never writes the story.`  *(5 words)*
- **Sub-caption:** `Questions to think with. No way to paste an answer in.`
- **Background:** standard.
- **Why second:** this is the objection-killer and the single most checkable claim in the product. Put it before the beauty shots because a suspicious parent needs permission to keep looking.

**Screenshot 3**

- **Screen:** `DrawingCanvasView` (`Views/DrawingCanvasView.swift:29-127`) on the white 3:2 sheet, mid-drawing, with Apple's real `PKToolPicker` visible below and the "Use it" button in frame. On iPhone this is finger-drawing; the caption should not imply Pencil on this set.
- **Headline:** `Or draw it by hand.`  *(5 words)*
- **Sub-caption:** `Their drawing goes into the printed book.`
- **Background:** standard, but dim the cosmic canvas an extra 10% — the white drawing sheet is the brightest object in the whole set and needs the surround to recede.
- **Why third:** it completes the trust arc from 1 and 2 and is the answer to "AI slop". It is also the last frame visible in search results, so the three-frame story a parent gets for free is *writes → isn't cheating → draws it herself*, which is the entire campaign compressed.

**Screenshot 4**

- **Screen:** `BookDetailView` page card (`Views/BookDetailView.swift:225-263`) — the `#FAF7ED` cream paper page, illustration above, black serif story text below, coloured circular page-number badge, reading "Page 5 of 12". Portrait.
- **Headline:** `It ends in a real book.`  *(5 words)*
- **Sub-caption:** `Flip through it. Read it aloud. Order it printed.`
- **Background:** standard, star field at half density so the warm paper card is unambiguously the focal point.
- **Why fourth:** the payoff. One warm light object against the dark set — the strongest single scroll-stopper in the visual system, and it is placed exactly where a parent who has tapped through is deciding.

**Screenshot 5**

- **Screen:** `BookshelfView` (`Views/BookshelfView.swift:246-379`) — the wooden shelf with coloured book spines standing vertically, titles rotated, gilded top/bottom bands, purple underglow. Populate the demo account with 5–7 fictional books so the shelf is genuinely full.
- **Headline:** `A shelf that fills up.`  *(5 words)*
- **Sub-caption:** `Every book they finish stands on it.`
- **Background:** standard.
- **Why fifth:** this is the retention and "worth subscribing" frame — it shows the future state, a child with a library. Nothing else in the category looks like a bookcase, so it also does brand-recognition work.

**Screenshot 6**

- **Screen:** the grown-up check — `HeroParentalGate` in `CreateBookView.swift:442-475`, showing "👋 Grown-up check" and a two-digit addition problem. Do **not** show it being dismissed.
- **Headline:** `A grown-up check first.`  *(4 words)*
- **Sub-caption:** `Before the camera roll. Before any purchase. No ads, no tracking.`
- **Background:** standard, plus a light confetti scatter (~25 rectangles, top third only, fading below the midline) to close the set warmly rather than on a security note.
- **Why last:** it is the frame that converts the parent who has already decided she likes it and is looking for one reason not to. Ending on safety rather than on a paywall or a price is deliberate.

**Deliberately excluded from the iPhone set:** the paywall (over-claims two features), `PrintOrderView` (price bug), the empty bookshelf and signed-out create screen (empty states), `AvatarEditorView` photo flow (child-safety rule), and anything showing a mascot.

---

### 3.2 iPad 13" — six screenshots

The iPad set is not the iPhone set rescaled. Three frames are iPad-exclusive and they should lead, because iPad is where the app is actually best and where the ICP's device is.

**Screenshot 1 — carries the whole pitch (landscape)**

- **Screen:** same as iPhone 1 — `CreateBookView` step 4 page editor with typed text and a finished illustration — but captured in **landscape** on iPad, where `Adaptive.swift:6-31` caps the reading column and the layout breathes. The Draw and Illustrate buttons both clearly visible.
- **Headline:** `Your child writes it. Every word.`
- **Sub-caption:** `Then the picture comes from what they wrote.`
- **Background:** standard. Landscape device bleeding off both the left and right edges is acceptable here; do not float it with margins on all four sides.
- **Ordering note:** keeping headline parity with iPhone screenshot 1 matters — a parent who saw the Instagram ad and then the store page on a different device should hit the same sentence.

**Screenshot 2 (landscape)**

- **Screen:** `DrawingCanvasView` on iPad, with the full `PKToolPicker` — pen, pencil, marker, crayon, eraser, colour wheel — and a partially finished drawing on the white 3:2 sheet. The on-screen prompt *"Use your finger or Apple Pencil ✏️"* should be legible.
- **Headline:** `Apple Pencil, real tools.`  *(4 words)*
- **Sub-caption:** `Their own drawing. Printed in the finished book.`
- **Background:** standard, dimmed an extra 10%.
- **Why second on iPad and third on iPhone:** on iPad this is the platform-defining frame and it earns an earlier slot; it also pre-empts the AI objection before the AI illustration is even discussed.

**Screenshot 3 (portrait)**

- **Screen:** `StoryBuddyView`, same content as iPhone screenshot 2 — two buttons, the "I never write your story for you" line, three question cards.
- **Headline:** `It never writes the story.`
- **Sub-caption:** `Questions to think with. No way to paste an answer in.`
- **Background:** standard.

**Screenshot 4 (landscape) — the iPad-only frame**

- **Screen:** `BookDetailView` in **landscape**, showing the genuine two-page spread (`Views/BookDetailView.swift:229-261`) — illustration on the left leaf, serif story text on the right, on cream paper, with the page controls reading "Page 6 of 12".
- **Headline:** `A real two-page spread.`  *(4 words)*
- **Sub-caption:** `On iPad, the finished book opens like a book.`
- **Background:** standard, star field at half density.
- **Why:** this frame does not exist on iPhone and is the strongest single argument for the app being iPad-first rather than a phone app stretched. It is also the most beautiful frame in the product.

**Screenshot 5 (portrait)**

- **Screen:** `BookshelfView` on iPad — the wider grid means more spines per shelf and two or three shelf rows visible at once. Populate with 9–12 fictional books.
- **Headline:** `A shelf that fills up.`
- **Sub-caption:** `Every book they finish stands on it.`
- **Background:** standard.

**Screenshot 6 (portrait)**

- **Screen:** the grown-up check, same as iPhone 6.
- **Headline:** `A grown-up check first.`
- **Sub-caption:** `Before the camera roll. Before any purchase. No ads, no tracking.`
- **Background:** standard, with the light confetti scatter.

**Orientation note:** App Store Connect allows mixing portrait and landscape iPad screenshots within a set, and mixing is the right call here — the two landscape frames (1, 2, 4) are the ones whose value depends on width, and the contrast makes the set more scannable, not less. Upload in the order given; the store preserves it.

---

## 4. App Preview video — 30 seconds

### Constraints being honoured

Apple requires app previews to be **15–30 seconds**, captured on device (screen recording), showing the app in use. **No hands, fingers, or external footage.** No device frames inside the video. No price references. No "Download now". Text overlays and cuts are permitted. Audio may be captured or added. A poster frame must be selected. Up to three previews per localisation; ship **one**.

Two additional constraints from this product: the AI illustration takes real time and **must not be speed-ramped** to look faster than it is, and the mascot must not appear because the asset catalog is empty.

Capture at native resolution, 60fps, deliver 30fps. iPad 13" is the primary preview; produce the iPhone 6.9" cut from the same session, not by cropping the iPad file.

### Shot list

| Time | Duration | Shot | On-screen text overlay | Audio |
|---|---|---|---|---|
| 0:00–0:02 | 2.0s | `HeroLanding` — the purple halo pulsing behind the logo, the "My Book Lab" gradient wordmark, the 📖 on the CTA wiggling. Let one full wiggle cycle land. | none | App's own ambient home track, at level |
| 0:02–0:05 | 3.0s | `AuthorIntroStep` — "Who's the author of this story?" A fictional name types into the field, an age of 7 is entered, tap Continue. | `Six small steps.` (SF Rounded Heavy, lower third, appears at 0:03) | ambient continues |
| 0:05–0:08 | 3.0s | `CharacterStep` — scroll the emoji hero grid, land on 🐉, it selects with the purple glow ring. | none | soft select tap (app SFX) |
| 0:08–0:10 | 2.0s | `SettingStep` — the six world cards, tap "The Glowing Forest 🌲". | none | select tap |
| 0:10–0:15 | 5.0s | `PagesStep` page editor. Story text types into the `TextEditor` a line at a time. **Hold on the Illustrate button while the page is empty so it reads as greyed out**, then let the text arrive and the button come alive. Tap it; it turns to "Making…". | `The Illustrate button doesn't work on an empty page.` (appears 0:11, holds to 0:15) | typing SFX, then the sparkle-burst SFX on the button press |
| 0:15–0:16 | 1.0s | **Hard cut**, black-free, straight to the filled illustration slot. | `(real generation takes a few seconds)` — small, `rgba(255,255,255,0.55)`, bottom edge, 0:15–0:16.5 | — |
| 0:16–0:19 | 3.0s | `StoryBuddyView` — the two buttons, tap "Help me think", three question cards spring in. Hold long enough that a viewer can read one question and see there is no insert affordance. | `It never writes the story.` (0:17) | soft chime |
| 0:19–0:22 | 3.0s | `DrawingCanvasView` — a drawing appears stroke by stroke on the white sheet with the tool picker visible. Because this is a screen recording, the Apple Pencil strokes appear with no hand in frame, which satisfies Apple's rule. Tap "Use it". | `Or they draw it themselves.` (0:20) | pencil-on-paper foley or silence; do not over-score |
| 0:22–0:25 | 3.0s | `ReadyStep` → tap "Save to bookshelf" → the 130-piece confetti burst over the finished cover. Let the burst run its natural arc; do not cut on top of it. | none | the app's celebration SFX, at full level — this is the emotional peak |
| 0:25–0:29 | 4.0s | `BookDetailView` in landscape (iPad cut) — two horizontal page-turn swipes at roughly one page per 1.5s on the cream two-page spread, landing on the "The End" card and its 50-piece confetti. | `And then it's a book.` (0:26) | the app's page-turn sound on each swipe |
| 0:29–0:30 | 1.0s | End card: the app icon on the cosmic gradient with the gradient wordmark beneath. | `My Book Lab` | music resolves |

**Poster frame:** the 0:15 frame — the page editor with the child's typed sentence and the finished illustration together. Same image as screenshot 1, so the still and the video agree.

**Music:** use the app's own ambient tracks from `MyBookLab/Resources/audio/` where licensing permits, ducked under the app SFX. Do not replace the app's sound with a library track — the page-turn and celebration sounds are the product's personality and they are what make the video feel like a real recording rather than an ad.

**iPhone cut:** identical timing and overlays, but shot 0:25–0:29 uses the portrait single-page reader rather than the spread, and the overlay at 0:26 changes to `And then it's a book.` unchanged. Do not substitute the iPhone reader in the iPad preview.

---

## 5. Localisation

### 5.0 The determining fact has changed: Italian has shipped

The previous draft of this section opened by reporting that no localisation infrastructure existed. That is no longer true, and the whole section is rewritten on the new state.

What I verified in the working tree:

| Catalog | Strings | Italian |
|---|---|---|
| `ios-native/MyBookLab/Localizable.xcstrings` | 413 | **411** |
| `ios-native/MyBookLab/InfoPlist.xcstrings` (permission dialogs) | 5 | **5** |
| `ios-native/MyBookLab/AppShortcuts.xcstrings` (Siri phrases) | 14 | **14** |
| `ios-native/MyBookLabWidgets/Localizable.xcstrings` | 19 | **19** |

The two app strings without an Italian value are the empty key and `DELETE` — the word typed to confirm account deletion (`Views/AccountView.swift:417-420`), deliberately left untranslated so the typed token matches what the sheet displays. Neither is a gap.

`ios-native/project.yml:72-74` declares `CFBundleLocalizations: [en, it]`, which is what gives the app its own entry in iOS Settings → My Book Lab → Language.

The translation is real work, not machine output. Spot checks: plural inflection is handled with iOS's automatic grammar agreement (`^[%lld giorno](inflect: true) di fila`), argument order is re-indexed where Italian word order differs (`"%@, by %@"` → `"%1$@, di %2$@"`), and the Story Buddy promise reads *"Non sai come continuare? Tocca un pulsante e ti do qualche idea: la tua storia non la scrivo mai io. ✨"* — which keeps the English line's meaning and its register. The badge labels were deliberately authored as objects and exclamations rather than agent nouns, because Italian cannot render "Storyteller" without choosing *narratore* or *narratrice* and the app never learns the child's gender (`Stores/RewardsStore.swift:31-38`).

The web is separately and fully localised (`src/i18n/locales/it/`, fourteen namespaces).

**So Italian metadata is unblocked — with four conditions, all listed in §5.4.** Every other language remains blocked by §5.2.

### 5.1 Tier 0 — do immediately, zero engineering

Add App Store Connect metadata localisations for **en-GB**, **en-AU**, **en-CA**. These are free, need no build, and each one gets its **own 100-character keyword field** — which is the actual prize. You roughly quadruple your indexed keyword surface for a day's work.

Practical notes:
- The en-GB localisation serves the UK, Ireland, Australia, and New Zealand storefronts, so at minimum ship en-GB even if you skip en-AU.
- Change spellings that matter to a parent's eye: *colour*, *favourite*, *practise*, *maths*. Getting these wrong is a small, specific credibility hit with exactly the audience that reads 2-star reviews before downloading.
- Use different keyword tokens per storefront, not translations of the same ones. UK/AU/IE parents search school-system vocabulary the US doesn't have: `ks1`, `ks2`, `year2`, `sats`, `eyfs`, `send`, `ehcp`, `handwriting`. Australia adds `naplan`, `foundation`. Canada uses US vocabulary but has a French-language requirement (below).
- The UK is also disproportionately valuable for this specific product: the dyslexia-parent community there is large, well-organised, and heavily active on the Instagram accounts named in the positioning brief.

### 5.2 The bar every other language still has to clear

A translated store page that leads to an English-only writing app is worse than no translation. The child cannot write in their own language, the AI helper answers in English, and the emotional payoff — the printed book — **is unavailable**: `api/print-orders/create.js:96` still hard-rejects any country other than US. A German parent would download a translated page, find an English interface, and discover she cannot order the book.

That produces refunds, one-star reviews in a language you may not read, and a permanently damaged storefront rating that is very hard to recover. **Do not localise metadata into any further language until all three of these are true:**

1. Strings translated in the `.xcstrings` catalogues — the infrastructure now exists, so this is a translation cost rather than an engineering project, but it is still 413 app strings plus the widget, Siri and permission catalogs.
2. `api/story-buddy.js` prompts localised and moderation verified in the target language. **Italian has cleared this one:** `api/story-buddy.js:236-240` takes a `locale` from the request body, falling back to `Accept-Language`, and passes it into `buildSystemPrompt(book, locale)`, so Story Buddy replies in the language the app is actually rendering in.
3. Print fulfilment extended beyond the US, **or** the description honestly scoped and the print claim removed in non-US storefronts. Italian clears this by the second route — see §5.4, where the Italian description does not promise a printed book.

### 5.3 The order to translate in, once those are true

Ranked on: iOS revenue per user, parental spend on education apps, size and organisation of the dyslexia/ADHD parent community, Latin script (so the keyboard, the drawing export, and the AI illustration pipeline need no rework), and whether print fulfilment can plausibly reach them.

| # | Language / markets | Why it's first | Cost signal |
|---|---|---|---|
| 1 | **German** — DE, AT, CH | Highest-paying European market for paid education apps, very high iPad-in-the-home penetration, and *Legasthenie* is a mainstream, well-funded parental concern with an established diagnosis-and-support culture. Parents there are used to paying for a tool rather than expecting free. | Moderate. German strings run ~30% longer than English — the wizard steps and button labels in `CreateBookView` will need layout checks. |
| 2 | **French** — FR, CA, BE, CH | The *"dys"* (dyslexie/dyspraxie/dysgraphie) parent community in France is large and highly networked, mirroring your ICP almost exactly. French also unlocks **Canada**, which matters commercially and where French-language expectations are strong. | Moderate; similar expansion issue to German. |
| 3 | **Spanish** — ES, then MX/AR/CO | Enormous volume, materially lower ARPU. Do **es-ES first for revenue**, es-MX later for volume, and treat them as separate metadata localisations with separate keyword sets. | Low linguistic cost, high support cost. |
| 4 | **Dutch** — NL | Small market, but extraordinary iPad penetration in primary education and a well-funded parental education-spend culture. Unusual option: because English fluency is very high, you can get most of the benefit by localising **metadata only** and leaving the UI English — the one case where Tier-1's blocker is genuinely softer. | Very low if metadata-only. |
| 5 | **Portuguese (BR), Nordic** | Reasonable next wave; neither is individually decisive. | — |

**Italian is no longer on this list — it has shipped.** It was ranked fifth here on market size, and the app was localised into it first anyway. That ordering decision is now sunk, and the argument for it is the one in §5.4: Italy is where the legal research was actually done, so it is the one non-English market whose claim rules are established fact rather than assumption.

### 5.3.1 Explicitly deprioritised

**Japanese, Korean, Simplified Chinese.** Japan and Korea are top-tier App Store revenue markets and it is tempting. Don't. A writing app for children is the worst possible category to machine-translate into: Japanese needs vertical text support, an IME-aware text editor, kanji-level awareness in the Story Buddy age-scaling logic, and an entirely different children's-literature register. The serif book-page rendering (`.system(.body, design: .serif)` → New York) has no meaningful CJK equivalent in the current code. Print fulfilment doesn't reach them. This is a product project, not a translation project, and it should wait until the app has proven itself in Anglophone markets.

**Right-to-left languages (Arabic, Hebrew).** The entire reader, the page-turn `TabView`, the drawing canvas orientation, and the printed-book layout assume LTR. Not a translation task.

### 5.3.2 Recommended sequencing

Ship 2.0.0 with **en-US + en-GB + en-AU + en-CA + it** metadata. Spend the next two quarters on Anglophone growth plus Italy, where the app itself now speaks the language. Revisit German only after (a) the catalogs are translated, (b) print ships outside the US, and (c) you have enough US/UK/IT retention data to know the product is worth translating again.

### 5.4 The Italian App Store listing

Italian ASO is a **separate keyword space**, not a translation of the English one. An Italian parent does not type the Italian words for the English keywords; she types what she would say out loud to another parent at the school gate. Everything below is chosen on that basis.

#### Four conditions before this listing goes live

Apple will not let you ship a half-localised build quietly, and this listing makes promises the build has to keep.

1. **Fix the paywall (§0.1 items 1 and 1b).** An Italian buyer currently reaches the purchase screen and reads five English lines, two describing features that do not exist. This is the single hardest-blocking item.
2. **Delete `NSMicrophoneUsageDescription` and its Italian translation (§0.1 item 2).**
3. **Do not promise a printed book.** `api/print-orders/create.js:96` rejects every non-US shipping country. The description below therefore describes the finished book as something to read and keep on the shelf, and says the printed copy is US-only. Do not "fix" this by translating the English print paragraph.
4. **Prices stay in USD.** `Models/PriceFormatting.swift` fixes the currency at USD and takes only the separators from the reader's locale, so an Italian device shows `39,99 USD`. There are no EUR price points in the code. Never write a euro figure in Italian metadata until there is one in `PrintPricing`. Subscription prices are a separate matter — those come from App Store Connect pricing tiers and are shown by StoreKit in euro automatically, which is why the description sends the reader to the App Store for them rather than naming a number.

#### 5.4.1 App name — do not translate it

**Keep `My Book Lab`.** The code already decided this: `InfoPlist.xcstrings` gives `CFBundleDisplayName` the Italian value `My Book Lab`, and the Siri phrases interpolate `${applicationName}` rather than a translated string. An Italian store name that differs from the home-screen label, from the Siri phrase, and from `mybooklab.app` would be a scam signal to exactly the cautious parent this product is sold to.

English product names are entirely normal on the Italian App Store, and "lab" is transparent to an Italian reader — *laboratorio* is the word an Italian primary school uses for hands-on activity time, so the name lands closer to its intended meaning in Italian than it does in English.

**App Store name field (30 char max):**

> `My Book Lab: storie per bimbi` — **29 characters**

*storie* and *bimbi* are the two highest-value tokens to buy in the name field. *bimbi* over *bambini* is deliberate: it is what parents actually type, it is four characters shorter, and Apple will still combine it into phrases. Consider it against the alternates:

- `My Book Lab: scrivi una storia` — 30. Better verb, weaker noun coverage.
- `My Book Lab: libri per bambini` — 30. **Avoid** — it reads as a *reading* app and puts you against Storytel and the publisher apps, the same trap "My Favorite Book" set in English.
- `My Book Lab: storie da scrivere` — 31, too long.

#### 5.4.2 Subtitle (30 char max)

> `Scrivi, disegna, pubblica` — **25 characters**

Rejected, and worth recording why:

- `Scrivi e illustra le tue storie` — 31, too long.
- `Il libro lo scrive tuo figlio` — 29. Strong line, but it gendered the child in the subtitle, which is the one field you cannot vary.
- `Storie scritte dai bambini` — 26. Accurate, but it describes the output rather than the activity.

**Do not use *stampa* (print) in the Italian subtitle.** It is the strongest word available and it is unavailable to you: the app cannot ship a printed book to Italy. *pubblica* is honest — a child's book does become publicly readable in the gallery, from the web.

#### 5.4.3 Keyword field (100 char max) — Italian

Already indexed from the name and subtitle: `my, book, lab, storie, per, bimbi, scrivi, disegna, pubblica`.

**Recommended keyword string (98 characters):**

```
scrittura,bambini,creativa,italiano,favole,racconti,illustrare,fantasia,leggere,compiti,diario,dsa
```

Token by token, and why each is not simply the Italian for the English one:

- `scrittura` — the head term. Combines with the name into `scrittura bambini`, `scrittura creativa`.
- `bambini` — the plural *bimbi* doesn't cover it; Apple does not reliably bridge the two, and `bambini` is what appears in every competitor's metadata.
- `creativa` — makes **`scrittura creativa`**, which is the single highest-volume Italian parent search in this space and the direct analogue of "creative writing".
- `italiano` — this has no English equivalent and it is the most valuable token in the string. *Italiano* is the **name of the school subject** — the class where a child writes *temi*. A parent looking for help with writing searches the subject name, exactly as a UK parent searches `literacy`. Missing this is the classic failure of a translated keyword set.
- `favole` / `racconti` — the two Italian words for the thing being made. *Favola* is the bedtime-story register, *racconto* the school register. Both are searched; they are not interchangeable and both are cheap.
- `illustrare` — the verb, not the noun. Italian search skews to infinitives here.
- `fantasia` — high-volume, warm, parent-facing; combines into `storie di fantasia`.
- `leggere` — catches the very large "get my child reading" intent that then discovers a writing tool. Justified by the read-aloud feature (`Services/SpeechSpeaker.swift`, which selects an Italian voice for an Italian book).
- `compiti` — homework. The highest-intent Italian parent term that exists, and entirely absent from the English set because "homework" carries the wrong connotation in English-language ASO. In Italian it is simply where the parent already is.
- `diario` — the school diary and the personal journal share one word in Italian, so this buys two intents for one token. Cheap and precise.
- `dsa` — **the Italian ICP term, and the reason the conservative alternate below exists.** *DSA* = *Disturbi Specifici dell'Apprendimento*, the statutory category under Legge 170/2010 covering dyslexia, dysgraphia, dysorthographia and dyscalculia. Every Italian parent of a diagnosed child knows this acronym, has a *certificazione DSA* in a drawer, and searches it. It is three characters and it is the sharpest segment in the Italian market.

Deliberately **not** included:

- `intelligenza artificiale` / `ia` — 25 characters for the audience you are trying not to attract. Same reasoning as Cluster C in §1.3, and in Italian the volume is dominated by adult productivity tools.
- `stampa` / `libro stampato` — you cannot fulfil it in Italy.
- `scuola`, `maestra`, `insegnante` — teacher-facing, and the Italian teacher surface is web-only, same as English (§6.3 CPP-3).
- `dislessia` spelled out — 9 characters against `dsa`'s 3, for a narrower slice of the same parents. Keep `dsa` and spend the six characters elsewhere.

##### The claim rules that travel with `dsa` — these are established law, not caution

From `docs/ITALY-LEGAL-FINDINGS.md`, which is sourced and adversarially verified:

**MDCG 2019-11 Rev.1 contains an explicit worked example of software "intended to treat children with dyslexia" being a medical device under the EU MDR.** Intended purpose under MDR art. 2(1) and 2(12) is established by *what the manufacturer claims in its marketing*. So an efficacy claim does not merely risk a fine — it can reclassify the product, and that is a category change no App Store listing is worth.

Layered on top: Codice del consumo art. 23 co. 1 lett. s) makes falsely claiming a product cures a dysfunction misleading *per se*, and art. 27 co. 5 puts the burden of proof on the company. There is no efficacy data for this product.

| Allowed — design claims | Banned — outcome claims |
|---|---|
| *progettata pensando a…* | *migliora la lettura* |
| *pensata per chi fatica a iniziare* | *aiuta con la dislessia* |
| *include un carattere ad alta leggibilità* (web only — see below) | *clinicamente testato* |
| *niente correzioni, niente voti* | *riduce i sintomi* |
| *nessun errore segnato in rosso* | *terapeutico*, *tratta*, *cura* |

**A second, harder constraint: on iOS you cannot claim the high-legibility font at all.** `grep -ri "dyslex\|leggibil" ios-native/` returns one code comment and no implementation; the OpenDyslexic toggle is web-only (`src/stores/useAccessibilityStore.js:7-9`). *Include un carattere ad alta leggibilità* is a true statement about the website and a false one about the app. It must not appear in App Store metadata.

The description below therefore does what §1.3's caveat prescribes for English: it describes the **behaviour** — the child who freezes at a blank page, the absence of red pen — and lets the parent make the connection herself. It names no condition.

**Conservative alternate (no `dsa`, 99 characters), if Review or counsel objects:**

```
scrittura,bambini,creativa,italiano,favole,racconti,illustrare,fantasia,leggere,compiti,diario,temi
```

*temi* (the Italian school essay) replaces `dsa` and is a genuinely good token in its own right.

#### 5.4.4 Promotional text (170 char max, updatable without a build)

> Tuo figlio ti racconta una storia lunghissima in macchina e poi per la scuola scrive quattro righe. Non è pigrizia: è che non sa da dove partire.

*(145 characters.)*

Note the construction. Italian consumer law — Codice del consumo art. 26 co. 1 lett. e) — makes any direct exhortation to a child to buy, or to nag a parent into buying, an aggressive practice **per se**: a hard ban, not a balancing test. Every line of Italian marketing copy must address the parent as an adult. The *tu* form here is aimed at the parent, never at the child.

#### 5.4.5 Full Italian description

Authored in Italian, not translated. The English original leans on rhythms that do not survive word-for-word — the first three lines have to land on their own in the collapsed preview, and Italian runs roughly 15–20% longer, so the opening is shortened rather than transposed.

```
Tuo figlio ti racconta una storia lunghissima in macchina. Poi deve scrivere
un tema e mette giù quattro righe.

Non è pigrizia. È che non sa da dove partire. È un problema diverso, e si
risolve in modo diverso.

My Book Lab è un'app di scrittura per bambini dai 5 ai 12 anni. Li accompagna
a fare un libro vero, un passetto alla volta. Chi è il protagonista. Dove si
svolge. Come si intitola. Poi una pagina, e un'altra. Alla fine c'è un libro
da sfogliare, con il suo nome sulla copertina.


L'APP NON SCRIVE LA STORIA AL POSTO SUO

È la cosa da sapere prima di scaricarla.

Quando tuo figlio si blocca, Story Buddy ha esattamente due pulsanti. "Dammi
delle idee" restituisce tre frasi d'inizio, una riga ciascuna, come quelle che
la maestra scrive alla lavagna: tuo figlio ne sceglie una e va avanti lui.
"Aiutami a pensare" restituisce tre domande sulla sua storia, e non c'è nessun
modo di incollare dentro la risposta. Deve pensarla e scriverla.

Sullo schermo c'è scritto, testuale: "la tua storia non la scrivo mai io".

La pagina di scrittura è una casella di testo vuota. Nessun completamento
automatico. Nessuna frase suggerita. Nessun "finiscila tu". Sotto i nove anni
la chat libera con Story Buddy non compare proprio nell'interfaccia.

Aprila tu prima di dargliela in mano e prova a premere i pulsanti. Ci vuole
un quarto d'ora e dopo lo sai.


PRIMA LE PAROLE, POI IL DISEGNO

Il pulsante Illustra non funziona sulla pagina vuota. Resta spento finché tuo
figlio non ha scritto qualcosa, e il disegno che esce nasce dalla frase che ha
scritto davvero. Scrivere è il biglietto d'ingresso alla parte divertente, non
il contrario.

E può fare a meno dell'intelligenza artificiale. Accanto a Illustra c'è
Disegna, della stessa dimensione: tuo figlio disegna la pagina con il dito o
con l'Apple Pencil, usando matite, pastelli e pennarelli di Apple. Disegnarla
a mano e farla generare danno esattamente la stessa medaglia, quindi niente
nell'app lo spinge verso l'intelligenza artificiale.

Le illustrazioni e la copertina sono generate dall'intelligenza artificiale a
partire dalle parole che tuo figlio ha scritto. Le immagini generate sbagliano
— sei dita, un cappello che cambia colore da una pagina all'altra — e il
pulsante Disegna è lì per quando preferisce farla come si deve.


FINISCE IN UN LIBRO

La maggior parte delle sessioni su un tablet non finisce mai. Questa sì: c'è
un ultimo passo e un pulsante "Ho finito di scrivere", non un feed.

Il libro finito si legge come un albo illustrato: pagine color crema, il
disegno sopra, il testo sotto, una copertina e una pagina "Fine". Su iPad in
orizzontale si apre come una vera doppia pagina. E si fa leggere ad alta voce,
pagina per pagina, con una voce italiana e un ritmo rallentato apposta.


COSA C'È DENTRO

- Una procedura in sei passi: autore, protagonista, mondo, titolo, pagine, fine
- 64 protagonisti emoji e 6 mondi da cui partire
- Trasforma una foto nel protagonista in stile cartone animato — dopo un
  controllo per grandi
- Disegna le illustrazioni a mano, con il dito o con l'Apple Pencil
- Illustrazioni e copertina generate dall'intelligenza artificiale
- Farsi leggere il libro finito ad alta voce, in italiano
- Scuoti l'iPad e arriva un'idea — 30 idee salvate sul dispositivo, funziona
  senza connessione
- 20 medaglie per l'impegno, una serie di giorni e monete per sbloccare stili
  di disegno e icone dell'app
- Un widget nella schermata Home con l'ultimo libro e i giorni di fila
- Accedi con Apple, oppure con Face ID o Touch ID in un tocco
- Siri: "Inizia una nuova storia su My Book Lab"
- L'app è in italiano: interfaccia, Story Buddy e lettura ad alta voce
- Riduci movimento è rispettato in tutta l'app


MEDAGLIE PER L'IMPEGNO, MAI PER AVER SCRITTO "BENE"

Ogni medaglia si prende facendo qualcosa: ho scritto la prima pagina, ho
scritto cinque pagine, ho disegnato io, ho ordinato una copia stampata. Niente
in quest'app dà voti, corregge o segnala quello che tuo figlio scrive. Gli
errori di ortografia non vengono mai segnati in rosso.

C'è una serie di giorni. Conta i giorni in cui ha scritto, non le parole. Non
c'è nessuna classifica, nessun confronto con altri bambini, nessuna notifica
che lo rincorre per non fargliela perdere, nessuna vita e nessuna energia che
si esaurisce. Se non vi interessa, è una cosa laterale: l'app funziona
benissimo anche ignorandola.


LA SICUREZZA, DETTA CHIARA

- Le illustrazioni e la copertina le fa l'intelligenza artificiale. Le parole
  le scrive tuo figlio.
- Niente pubblicità. Nessun tracciamento. Nessun dato venduto.
- Un controllo per grandi — un'addizione a due cifre — prima dell'accesso alle
  foto e prima di ogni acquisto: abbonamento, monete, copia stampata.
- Se usi una foto per fare il protagonista, la foto originale non viene mai
  salvata. Resta solo il disegno.
- Quello che tuo figlio scrive viene controllato prima di arrivare a Story
  Buddy, e se serve viene bloccato con un messaggio gentile, non con un errore.
- A Story Buddy è stato detto di rifiutare qualsiasi cosa spaventosa o poco
  adatta, e di ignorare i tentativi — anche quelli di tuo figlio — di
  cambiargli le istruzioni.
- I libri restano privati sulla libreria di tuo figlio. Non si condivide
  niente se qualcuno non lo pubblica apposta, e da quest'app pubblicare non si
  può: si fa dal sito.
- Ogni libro della Galleria pubblica viene controllato prima di comparire, e su
  ogni libro c'è "Segnala": tieni premuto sulla copertina, o usa il pulsante
  sul libro aperto. Puoi anche nascondere tutto quello che pubblica un autore.
  Le segnalazioni le legge una persona.
- Puoi cancellare l'account e tutto quello che contiene dall'app, con sette
  giorni per ripensarci.

Quello che non ti diremo è che sia impossibile per un'intelligenza artificiale
dire qualcosa di inaspettato, o che un filtro prenda tutto. È vincolata,
controllata e limitata, e preferiamo dirlo così invece di prometterti la
perfezione. Se qualcosa sfugge, scrivici: support@mybooklab.app.


PRIMA DI ABBONARTI

C'è una versione gratuita, così puoi fare un libro e vedere esattamente come
si comporta l'aiuto prima di pagare qualcosa. I prezzi dell'abbonamento te li
mostra l'App Store al momento di abbonarti, ed è un abbonamento Apple: lo
disdici dalle Impostazioni, senza scriverci.

La copia stampata al momento si spedisce solo negli Stati Uniti. Dall'Italia
puoi fare, leggere e tenere il libro; ordinarlo su carta no, non ancora.

Pensata prima di tutto per iPad, funziona anche su iPhone.

Privacy: https://mybooklab.app/privacy
Condizioni d'uso: https://mybooklab.app/terms
Assistenza: https://mybooklab.app
```

##### Every claim in that description, and where it is verified

| Claim | Verified at |
|---|---|
| Two buttons, no way to paste an answer in | `Views/StoryBuddyView.swift` |
| The on-screen line quoted verbatim | `Localizable.xcstrings` → *"Non sai come continuare? Tocca un pulsante e ti do qualche idea: la tua storia non la scrivo mai io. ✨"* |
| Free-text chat absent under nine | `StoryBuddyView` age gate |
| Illustrate disabled on an empty page | `Views/CreateBookView.swift` — the button's enabled state follows page text |
| Draw and Illustrate earn the same badge | `CreateBookView.swift:921` and `:951` both call `earn("added_illustration")`; 15 coins at `api/claim-badge.js:23` |
| Illustrations and cover are AI-generated | `api/generate-image.js`; stated as required by AI Act Art. 50 |
| Read-aloud **in Italian** | `Services/SpeechSpeaker.swift:49-62` — `bestVoice(for:)` selects a voice matching the book's language tag, and `Models/Book.swift:28` carries that tag |
| Two-page spread on iPad landscape | `Views/BookDetailView.swift:229-261` |
| Shake for an idea, 30 prompts, offline | on-device prompt list |
| 20 badges, streak, coins | `Stores/RewardsStore.swift` catalog |
| Widget with newest book and streak | `ios-native/MyBookLabWidgets/` (localised, 19/19) |
| Siri phrase quoted in Italian | `AppShortcuts.xcstrings` → `StartNewStoryIntent.phrase2` = *"Inizia una nuova storia su ${applicationName}"* |
| The app is in Italian | 411/413 + 5/5 + 14/14 + 19/19, §5.0 |
| Grown-up check before the photo picker and every purchase | `ParentalGate.swift:79`; `PrintOrderView.swift:95`, `PaywallView.swift:72`, `CoinStoreView.swift:305`, `CreateBookView.swift:358` |
| Original photo never saved | avatar flow keeps only the cartoon |
| Writing checked before Story Buddy | `api/story-buddy.js:243` and `:260` |
| Story Buddy refuses unsafe content and ignores instruction changes | `buildSystemPrompt` in `api/story-buddy.js` |
| Cannot publish from the app | `APIClient.swift` — GET at `:236` and `:268`, no POST |
| Gallery books screened before appearing | `api/publish-book.js:135-152`, fails closed |
| Report by long-press or button; hide an author | `GalleryView.swift:103-107`, `:217-227`; `ReportBookSheet.swift:129-184` |
| Reports read by a person | `ReportBookSheet.swift:52` — *"Un adulto del nostro team guarderà questo libro"* |
| Account deletion, seven days | `Views/AccountView.swift:397-440` → `api/delete-account.js` |
| Print ships to the US only | `api/print-orders/create.js:96` |
| Reduce Motion honoured | throughout |

Two things the Italian description says that the English one does not, and both are deliberate: **"da quest'app pubblicare non si può: si fa dal sito"** — English readers get this as an omission, but an Italian parent reading a *"Segnala"* paragraph will reasonably ask how a book got there in the first place, and the honest answer strengthens the paragraph. And **the print limitation is stated positively** — *you can make it, read it and keep it; you just can't order it on paper yet* — rather than buried, because discovering it at checkout is the refund scenario §5.2 exists to prevent.

##### Operational commitments this listing makes

Two lines are promises about people, not code, and someone has to own them before the listing ships:

- **"Le segnalazioni le legge una persona."** The app itself is more specific — `ReportBookSheet.swift:52` promises review *entro 24 ore*, in both languages. That is a staffed commitment. If no one is on it, change the string, not the listing.
- **support@mybooklab.app** is published inside the report sheet and in the description. It must be monitored, and it must accept Italian.

##### Two Italian legal points that are not ASO but will land on this listing

Both are from `docs/ITALY-LEGAL-FINDINGS.md` and both need counsel, not a copywriter:

- **Legge 132/2025 art. 4 co. 4 requires parental consent for under-14s to access AI technologies in Italy.** The privacy policy's "under 13" threshold is the wrong number for Italy. This is a policy-document and account-flow question; do not try to solve it in the store description.
- **The public gallery exposes children's first names and ages to signed-out visitors** (`GalleryView.swift:146-149` renders a byline with the author's age). The finding flags this for DSA Art. 28(1) analysis. It is also the detail most likely to be raised by an Italian reviewer or journalist, and the Italian description's gallery paragraph is where it would be quoted back at you.

---

## 6. Launch strategy and Custom Product Pages

### 6.1 Pre-order — probably not available, and probably not what you want

**First, determine one thing I could not from the repo:** whether the v1.0 Capacitor build was ever actually released to the App Store, or only prepared. `STORE_LISTING.md` describes an unreleased-looking listing (it still lists Android and Google Play targets), but it doesn't establish shipment.

**If the app has never been released:** pre-order is available. Set it up to 180 days ahead. All pre-orders download on release day, which concentrates the install spike, and a concentrated day-one spike is worth real category-chart position in Education, which is a shallow enough chart that it's achievable. Run the Instagram campaign into the pre-order page for 2–3 weeks before release.

**If the SKU already exists** (much more likely given the bundle id, the Team ID, and the RevenueCat/Stripe integrations look production-configured): **pre-order is unavailable for updates** and the question is moot.

Either way, **do not create a new SKU to unlock pre-order.** You would forfeit any existing ratings and reviews, forfeit any existing subscriber base tied to the RevenueCat app user IDs, and force existing users to migrate manually. Rename the existing SKU and treat 2.0.0 as a relaunch.

### 6.2 The relaunch mechanics

1. **Set version release to Manual.** Do not use "Automatically release after approval". You want the store page, the CPP links, the Instagram campaign, and the promotional text to go live in the same hour. Get approved, sit on it, then release on your date.
2. **Turn phased release ON.** Common misconception worth stating plainly: phased release throttles *automatic updates to existing users only*. It has **no effect on new downloads**, so it does not throttle the install spike you're paying Instagram for. It just gives you a 7-day window to catch a crash regression before it reaches your whole existing base. Keep it on, watch crash-free sessions, and use "Release update to all users" to accelerate on day 2 if you're clean.
3. **Front-load the review buffer.** The Guideline 1.2 exposure that justified budgeting for a rejection round is closed (§0.2). The remaining rejection risk is the paywall (§0.1) and, if you ship Italian metadata, a localisation-consistency check. Submit at least 10 working days before the campaign date anyway — a second language doubles the metadata surface a reviewer reads.
4. **App Review notes — rewritten below.** See §6.2.1. This is no longer a list of mitigations; it is a short tour of features that now work, and it should read that way.
5. **App Privacy labels.** Verify they match `PrivacyInfo.xcprivacy:11-16` (`NSPrivacyTracking = false`, empty tracking domains) and the actual collection. A mismatch here is a slow, expensive rejection.
6. **Age rating.** Recommend **4+, Education primary / Books secondary**. The questionnaire asks about user-generated content and the Gallery means you answer yes — but you can now answer yes *with moderation in place*, which is what keeps the rating at 4+ rather than pushing it to 12+. Point the questionnaire at the specifics in §6.2.1: pre-publication screening that fails closed, in-app reporting, author blocking, and two-report auto-hide.
7. **Kids Category: still opt out, but the reason has narrowed.** The original objection was that the Gallery had no moderation at all. That is fixed. What remains is that Kids Category apps face additional scrutiny on any data leaving the device and on third-party analytics, and the Gallery still displays other children's first names and ages to visitors (`GalleryView.swift:146-149`) — which is separately flagged under DSA Art. 28(1) in §5.4. Education + 4+ reaches the same audience without that surface. Revisit after the gallery byline question is resolved, not before.
8. **Apple Search Ads from day one, small budget.** Bid on your own brand name first — this is defensive and cheap, and it stops StoryJumper or Night Zookeeper buying "my book lab". Then a small discovery campaign on `creative writing kids`, `make a book kids`, `kids story writing`. Point each ad group at a matching CPP (below).

#### 6.2.1 App Review notes — paste this into the Notes field

Reviewers of a children's app with AI, a subscription, and a public feed of content authored by children will look for four things: whether a child can be exposed to other children's material, whether a child can spend money, whether the AI is doing the child's work, and whether the metadata is true. The notes should answer all four before the reviewer has to go looking, and every line below points at a screen the reviewer can reach in the demo account.

```
DEMO ACCOUNT
Email: [demo account]
Password: [password]
The account has 6 finished books on the shelf and 1 completed print order,
so no screen in the app is in an empty state.

WHAT THE APP IS
A child writes a story one page at a time. AI generates an illustration
from what the child wrote, and offers writing prompts. The AI does not
write the story. Finished books can be ordered as printed hardcovers or
softcovers (US shipping only).

1. USER-GENERATED CONTENT — GUIDELINE 1.2
The Gallery tab shows books published by other users. All four required
mechanisms are present:

- FILTERING: books are screened before publication. Every published book's
  title, author name, character names and full page text are sent to a
  content-moderation service before insert. If the moderation service is
  unavailable the publish is REFUSED rather than allowed through.
- REPORTING: long-press any book cover in the Gallery, or open a book and
  tap the Report button in the top bar. Six reasons plus a free-text field.
- BLOCKING: the same sheet has "Also hide everything by this author",
  which hides all of that author's books for the reporting user.
- AUTO-HIDE: two distinct reports hide a book immediately, pending review.
- PUBLISHED CONTACT: support@mybooklab.app, shown in the report sheet and
  in the App Store description.

Note: a book CANNOT be published from this app. The app reads the Gallery
but has no publish path. Publishing happens on mybooklab.app. This means
the iOS app cannot itself introduce content into the Gallery.

2. PARENTAL GATE — BEFORE THE CAMERA ROLL AND BEFORE EVERY PURCHASE
A two-digit addition problem gates four flows, each verifiable in the
demo account:
- Create > character step > "Use a photo"  (photo library access)
- Account > Upgrade                        (subscription purchase)
- Account > Coins > any coin pack          (consumable purchase)
- Any finished book > Print                (print order checkout)
To pass it, solve the addition and tap Continue. It cannot be dismissed
by tapping outside.

3. AI — WHAT IT DOES AND DOES NOT DO
Story Buddy offers exactly two actions: "Give me ideas" returns three
opening sentences, and "Help me think" returns three questions about the
child's own story with no control to insert an answer into the page. For
books whose author age is under 9, the free-text chat is not rendered at
all — the demo account's book "Theo and the Star Bear" is set to age 7
and demonstrates this.

The Illustrate button is disabled until the page has text; the generated
image derives from the sentence the child wrote. A Draw button sits beside
it at the same size, using PencilKit, and a hand-drawn page is what goes
into the printed book.

AI DISCLOSURE: illustrations and covers are AI-generated and the App Store
description states this. Text the child writes is not generated or
autocompleted. This is disclosed because EU AI Act Art. 50 transparency
obligations apply from 2 August 2026.

Child-written text is screened for unsafe content before it is sent to
Story Buddy. The system prompt instructs the model to refuse frightening
or age-inappropriate material and to ignore attempts to change its
instructions, including from the child.

4. ACCOUNT DELETION — GUIDELINE 5.1.1(V)
Account > Delete account. Type DELETE to confirm. A 7-day grace period
follows, during which the user can cancel from the same screen.

5. TERMS OF USE
https://mybooklab.app/terms — linked from the paywall in-app and set as
the EULA in App Store Connect. Privacy policy: https://mybooklab.app/privacy

6. PURCHASES
Subscription via StoreKit/RevenueCat. Coins are consumables. Printed books
are a separate one-off purchase via Stripe, not an IAP, because they are
a physical good shipped to the buyer (Guideline 3.1.3(e)). Print ships to
US addresses only; non-US shipping addresses are rejected server-side.

7. LANGUAGES
English and Italian. The app is fully localised in Italian: interface,
Siri phrases, permission dialogs, the Home Screen widget, and Story Buddy,
which replies in the language the app is rendering in. Read-aloud selects
an Italian system voice for an Italian book. To review the Italian build,
set Settings > My Book Lab > Language to Italiano.

8. HARDWARE
Designed for iPad and best in landscape, where a finished book opens as a
two-page spread. Fully functional on iPhone. Apple Pencil supported on
iPad; finger drawing on both.
```

Three notes on the notes:

- **Do not paste a claim from this block that §0.1 has not yet fixed.** In particular, if the paywall still lists "Voice input & read aloud" and "Up to 4 kid profiles" when you submit, a reviewer who reads section 3 above and then opens the paywall has caught you contradicting yourself in your own review notes. Fix the paywall or do not submit.
- **Section 7 is worth its length.** A reviewer testing an Italian localisation will otherwise hunt for the language switch, fail to find one in the app, and may report the Italian metadata as unsupported. Telling them where iOS puts it costs three lines.
- **Section 1's last paragraph is the strongest thing in the notes.** "The iOS app has no publish path" converts the Gallery from a liability into a read-only surface with moderation on it, which is a materially easier thing to approve. Lead the UGC section with the mechanisms, close it with that.

### 6.3 Custom Product Pages — how they actually work, and how to use them

**The mechanics, precisely.** You can create up to **35** custom product pages per app in App Store Connect. Each gets a unique URL with a `?ppid=` parameter. A CPP can override **only three things: the screenshots, the app preview, and the promotional text.** It **cannot** change the app name, subtitle, description, keywords, or icon. CPPs are **not indexed for search** — they only reach people you send there via a link. Each has its own analytics (impressions, downloads, conversion, retention) in App Analytics, which is what makes the whole exercise measurable.

That constraint is the design brief: everything the CPP can change is visual, so a CPP is a *screenshot set plus a headline*, not a different pitch.

#### CPP-1 — "The Stall" (default parent campaign)

- **Audience:** the neurodivergent-parent Instagram traffic — the 32-48 mother of a 7-10 year old whose child talks brilliantly and writes four sentences.
- **Link from:** the main IG bio link, all parent-facing Reels, and the Apple Search Ads brand + discovery campaigns.
- **Promotional text:** *"He can tell you a forty-minute story in the car and then write four sentences for school. He's not lazy. He's stuck at the start — and that's a different problem with a different fix."* (169 chars)
- **Screenshots:** the default six from §3.1, unchanged. This is intentional — the default page is already built for this audience, so CPP-1 exists mainly as a **measurement instrument**: it separates Instagram-sourced conversion from organic search conversion in App Analytics, which the default page cannot do.
- **App preview:** the standard 30s cut.

#### CPP-2 — "The Keepsake" (gifting / print)

- **Audience:** grandparents, gift-buyers, and the November–December seasonal push. Also the parent whose objection is screen time rather than AI.
- **Link from:** gift-angle IG Reels and Stories, any paid seasonal spend.
- **Promotional text:** *"Screen time that ends in something you can hold. Your child writes it, draws it, and it arrives as a real hardcover with their name on the cover."* (149 chars)
- **Screenshots — reordered, not redrawn:** lead with the artefact rather than the authorship proof, because this buyer is not the one worried about cheating.
  1. `BookDetailView` cream page — `It ends in a real book.`
  2. `BookshelfView` spines — `A shelf that fills up.`
  3. Page editor — `Your child writes it. Every word.`
  4. `DrawingCanvasView` — `Or draw it by hand.`
  5. `OrderDetailView` status timeline (**not** `PrintOrderView` — that screen has the price bug, and the timeline is the better emotional frame anyway) — `Watch it get made.` / sub: *"Payment confirmed. Being printed. On its way."*
  6. Grown-up check — `A grown-up check first.`
- **Unblocked.** The price mismatch that made `PrintOrderView` unusable is fixed (§0.2), so that screen may now be captured. The timeline is still the better emotional frame, and screenshot captions still may not contain a price — that is an Apple rule (§7), not a bug.
- **Do not link CPP-2 from Italian-language creative.** Print ships to US addresses only. A gifting page pointed at an Italian audience sells something they cannot buy.

#### CPP-3 — "Homeschool & one-to-one" (the educator page, honestly framed)

This is where I'd push back on the brief slightly, and the reason matters more than the page does.

**A straight "classroom" CPP on the App Store is a trap.** The teacher and classroom surface is 100% web-only — there is no teacher view, no classroom view, and no submit-to-class control anywhere in `ios-native/Views/`, and `APIClient.swift` never calls `/api/classroom`. A teacher who follows a "for your classroom" App Store link, downloads the app, and finds five tabs (Books, Gallery, Create, Orders, Account) with no teacher section will churn — and, worse, will say so in a review that other teachers read. Teacher reviews of edtech are read carefully and shared in staff-room group chats.

There is a second, structural problem: **the App Store description is shared across all CPPs and Apple discourages directing users to another platform.** You cannot use a CPP to say "the classroom part is on the web" in the description, only in the 170-character promotional text and in the screenshot captions.

So: **the primary educator funnel must not point at the App Store at all.** It points at `mybooklab.app/teacher`, in a browser, which is where a teacher is during a writing block anyway. That is not a compromise — it's the accurate destination.

CPP-3 then exists for a narrower, real audience: the homeschool parent, the co-op leader, the SLP working one-to-one, and the resource-room teacher who wants the app for an individual student rather than a class.

- **Link from:** homeschool and SLP content only. Never from a "classroom management" or "collect your students' writing" post.
- **Promotional text — the disclosure is the copy, not a footnote:** *"For one student at a time: homeschool, co-op, or a pull-out session. The class dashboard and code system are on the web, not in this app."* (139 chars)
- **Screenshots:** as CPP-1, with two changes —
  - Screenshot 2's sub-caption becomes: *"Two of three helpers can't write for them. Decide the rule with your student."*
  - Screenshot 6 is replaced with `StoryBuddyView` on a book with `authorAge` set to 6, showing the free-text chat genuinely absent from the interface — headline `Under nine, the chat isn't there.` / sub: *"Younger students only ever get the two buttons."*

#### Product Page Optimization (run in parallel)

Separately from CPPs, use **PPO** to A/B test the *default* page, which is the one search traffic lands on. Up to three treatments against the original, split by traffic percentage, measured on conversion.

- **Test 1 (run first, ~4 weeks):** screenshot 1 only. Original = the page editor with text + illustration. Treatment A = the cream-paper `BookDetailView` page. Treatment B = the bookshelf spines. This answers the highest-value open question in this whole document — whether search traffic converts better on *proof of authorship* or on *proof of artefact*. My prior is authorship for Instagram traffic and artefact for cold search, and PPO is how you find out rather than guess.
- **Test 2:** app icon. The Classic open-book-and-star against the Rocket variant. Icon is the single highest-leverage element in a search-results list.
- Do not run PPO and a major metadata change in the same window; you won't be able to attribute the result.

### 6.4 Launch sequence

| When | Action |
|---|---|
| T−15 working days | Fix §0.1 — the two paywall items and the dead microphone string. Rename SKU to "My Book Lab: Kids Story Maker". Capture all 12 screenshots and both preview cuts from the fixed build. |
| T−12 | **Italian length pass.** Set a simulator to Italiano and walk every screen in §3's shot list plus the paywall and the report sheet. Italian runs 15–20% longer than English; the wizard step buttons and badge labels are where it truncates. This needs a device, not a build. |
| T−10 | Submit for review, release set to **Manual**. Paste the App Review notes from §6.2.1, with the demo account filled in. |
| T−7 | Build CPP-1, -2, -3 in App Store Connect (they can be created while the version is in review, but each CPP must itself be approved — allow the time). |
| T−5 | Add en-GB, en-AU, en-CA metadata localisations with their own keyword fields. Add the **it** localisation from §5.4 — name, subtitle, keywords, promotional text, description. Italian screenshots may reuse the English captures only if the captured UI is Italian; a reviewer or a parent will notice an English page editor under an Italian caption. |
| T−3 | Approval expected. Do not release. Load CPP URLs into the Instagram bio-link tool and into Apple Search Ads ad variations. |
| T−1 | Set the promotional text for launch week. Verify every CPP link resolves and shows the right screenshots on a real device. |
| **T−0** | Release manually in the morning of the campaign day. Instagram goes live within the hour. |
| T+1 | Check crash-free sessions; accelerate phased release to 100% if clean. |
| T+3 | First read on CPP-level conversion in App Analytics. |
| T+14 | Start PPO Test 1. Do not touch keywords until it concludes. |
| T+30 | First keyword iteration, informed by the Search Ads search-term report — which is the only honest source of what parents actually type. |

---

## 7. Rules compliance — what Apple allows in screenshots and previews for a kids-adjacent app

### Screenshots

**Allowed:**
- Text overlays, captions, headlines, and background art around the capture. Apple explicitly permits stylised screenshots.
- Device frames, provided they use current Apple hardware accurately and don't imply an unreleased device.
- Showing UI states that a user will actually reach.
- Localised text in the overlays.

**Not allowed, and each one is a real rejection cause:**
- **Price or "Free".** Apple removes pricing references from screenshots. Nothing in your set may say "Free", "$19.99", "50% off", or "Try free". This is why §3 puts no price in any caption. It remains the reason to prefer `OrderDetailView`'s status timeline over `PrintOrderView` — the price bug that was the *other* reason is fixed (§0.2), so `PrintOrderView` is now merely a worse frame rather than an unusable one, and its format cards display prices.
- **Calls to action to download or rate.** No "Download now", no "Rate us", no App Store badge inside a screenshot.
- **Awards or superlatives you can't substantiate.** No "#1 writing app", no "Best app for ADHD", no "Award-winning". You have no efficacy data and no awards; inventing either is both a rejection and a trust failure with this specific buyer.
- **Fabricated UI.** Every pixel of app content must come from a real build of `ios-native/MyBookLab`. No Figma comps composited into a device frame, no "coming soon" features shown as shipped. This is the rule that forbids compositing the drawn mascot over an app capture, since the app renders emoji.
- **Third-party trademarks or competitor names.** No "better than Book Creator", no visible third-party logos.
- **Health or medical claims.** "Helps children with ADHD" or "improves dyslexia" in a screenshot caption is a Guideline 1.4.1 problem. Describe behaviour, not conditions.
- **Unsubstantiated outcome statistics.** No "3x faster writing", no "92% of parents said". There is no efficacy data for this product; never invent one.

**Kids-adjacent specifics that bite here:**
- **No real children's faces.** Not in a capture, not in a reflection on device glass, not out of focus, not a photo on a shelf behind the iPad, not in a testimonial graphic. If hands appear operating a device in *marketing* material (not in the preview, where hands are banned outright), they must be unidentifiable.
- **No real names, schools, class names, or towns** in any visible UI field. The wizard asks "Who's the author of this story?" on step 0, so a name field *will* be on screen — type a demo name before recording.
- **Never show the photo→cartoon avatar flow with a real photo**, even blurred, even mid-transformation, even the developer's own child. Use the 14 emoji avatars.
- **The parental gate may be shown and should be** — it's a genuine safety feature and it converts. But never show it being bypassed or dismissed quickly. Let it read.
- **No real order details.** `OrderDetailView` contains shipping addresses. If CPP-2 uses the status timeline, the address must be obviously fictional and never fully visible.
- **No credentials, emails, account IDs, or debug overlays.**

### App Previews

**Required:**
- 15–30 seconds. Yours is 30.
- **Captured on device.** Screen recording only.
- Must show the app in actual use, and the majority of the runtime must be app footage. Your shot list is ~29 of 30 seconds in-app, with a 1-second end card — well inside tolerance.
- A poster frame must be chosen.
- Up to three previews per localisation; you're shipping one.

**Not allowed:**
- **Hands, fingers, or any external footage.** No filmed hands on a device, no lifestyle B-roll, no talking head. This is the rule that shapes the whole shot list. Note that a screen-recorded Apple Pencil drawing satisfies it — the strokes appear with no hand in frame.
- **Device frames or hardware imagery inside the video.**
- **Price references or download CTAs**, same as screenshots.
- **Third-party trademarks**, including recognisable music you don't have rights to. Use the app's own audio from `MyBookLab/Resources/audio/` where licensing allows.
- Anything not achievable in the shipping build.

**The rule your product specifically strains against:** speed-ramping. Apple doesn't forbid editing, but your own shooting rules do forbid making AI illustration look faster than it is — and misrepresenting performance is a Guideline 2.3.1 accuracy problem regardless. The shot list handles this with a hard cut at 0:15 plus an honest small-type overlay reading *"(real generation takes a few seconds)"*. Keep that overlay. It costs nothing, it satisfies both Apple and the brief, and with this particular buyer, volunteering the limitation is the single fastest trust-builder available.

### Adjacent submission requirements worth confirming while you're here

| Requirement | Status |
|---|---|
| **5.1.1(v)** — account deletion must be initiable in-app | ✅ `Views/AccountView.swift:365-411` → `api/delete-account.js`, with a 7-day grace period and a typed DELETE confirmation. |
| **4.8** — Sign in with Apple required when a third-party sign-in is offered | ✅ Google Sign-In is present, and Sign in with Apple ships at `Views/SignInView.swift:70-79` with the entitlement in `project.yml`. |
| **1.2** — UGC apps need filtering, reporting, blocking, and published contact | ✅ **Met, all four.** Filtering: `api/publish-book.js:135-152`, fails closed. Reporting: `GalleryView.swift:103-107` and `:217-227` → `ReportBookSheet.swift`. Blocking: `ReportBookSheet.swift:129-184` → `APIClient.blockAuthor`. Contact: `support@mybooklab.app` at `ReportBookSheet.swift:139`. Plus two-report auto-hide, and no publish path in the iOS app at all. |
| **3.1.2** — accurate subscription information at the point of purchase | ❌ **The one still-open blocker.** The paywall lists two features that don't exist (`PaywallView.swift:122-123`), and none of its five benefit lines is localised (`:131` takes `String`, not `LocalizedStringKey`), so an Italian buyer reads them in English. See §0.1. |
| **3.1.2 / EULA** — terms of use available | ✅ `src/pages/TermsPage.jsx`, routed at `src/App.jsx:92`, linked from `PaywallView.swift:225`. Set it as the EULA in App Store Connect. |
| **1.3 / age rating** — accurate questionnaire answers | ✅ Answer "yes" to user-generated content and describe the moderation, which now exists. That keeps the rating at 4+. |
| **2.3.1** — accurate metadata | ⚠️ Two live inaccuracies, both in §0.1: the paywall lines, and `NSMicrophoneUsageDescription` — now translated into Italian — describing dictation the app does not have. |
| **EU AI Act Art. 50** — transparency, applicable since 2 Aug 2026 | ⚠️ **Partly.** The store description now discloses AI-generated illustrations in both languages, which addresses the human-readable side. Art. 50(2) machine-readable marking of generated images, and Art. 50(5)'s "at the latest at the time of first interaction or exposure", are **code obligations that are not met** — there is no on-screen AI label anywhere in the app. Not an App Store rejection cause; it is an EU regulatory one, with penalties under Art. 99(4)(g). See §1.5 ("The three corrections…", item 2) and `docs/ITALY-LEGAL-FINDINGS.md`. |
| **Localisation consistency** (en + it) | ⚠️ 411/413 app strings, 5/5 permission dialogs, 14/14 Siri phrases and 19/19 widget strings are Italian. The gap is the paywall, which is not extracted at all. Fix before the Italian metadata is published. |
| **5.1.4** — kids apps must not send personal info to third parties | ✅ `PrivacyInfo.xcprivacy:11-16` declares `NSPrivacyTracking = false` with an empty tracking-domains list, and no analytics or advertising SDK appears in `package.json` or the Swift package list. |
| **Privacy nutrition labels** | Must be re-verified against actual collection before submitting; a mismatch with the manifest is a slow rejection. |

---

## Files referenced

- `/Users/damianocanali/Documents/my-favorite-book/STORE_LISTING.md` — stale; superseded by this document
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/project.yml`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Info.plist`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/PaywallView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/PrintOrderView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/CreateBookView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/StoryBuddyView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/DrawingCanvasView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/BookDetailView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/BookshelfView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/GalleryView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/MainTabView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/AppIconPickerView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/HeroLanding.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Models/SampleBook.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/PrivacyInfo.xcprivacy`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Assets.xcassets/Mascot*.imageset/Contents.json` — all empty
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/ParentalGate.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/ReportBookSheet.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/CoinStoreView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/AccountView.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Models/PrintOrder.swift` — `PrintPricing`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Models/PriceFormatting.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Stores/RewardsStore.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Services/APIClient.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Services/SpeechSpeaker.swift`
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Localizable.xcstrings` — 411/413 Italian
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/InfoPlist.xcstrings` — 5/5 Italian
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/AppShortcuts.xcstrings` — 14/14 Italian
- `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLabWidgets/Localizable.xcstrings` — 19/19 Italian
- `/Users/damianocanali/Documents/my-favorite-book/lib/print/pricing.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/print-orders/create.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/publish-book.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/report-book.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/claim-badge.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/_aiGuard.js` — `moderatePrompt`, fails open
- `/Users/damianocanali/Documents/my-favorite-book/api/story-buddy.js`
- `/Users/damianocanali/Documents/my-favorite-book/src/pages/TermsPage.jsx`
- `/Users/damianocanali/Documents/my-favorite-book/src/i18n/locales/it/` — the web's Italian bundle
- `/Users/damianocanali/Documents/my-favorite-book/docs/ITALY-LEGAL-FINDINGS.md` — MDR/MDCG claim rules, AI Act Art. 50, Legge 132/2025

