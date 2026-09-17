# App Store Listing & ASO

# My Book Lab — App Store Optimization & Store Assets (v2.0.0)

Everything below is written against the shipping SwiftUI app at `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab`. `STORE_LISTING.md` is superseded in full — it describes the retired Capacitor v1.0 and contains at least seven claims that are false for the App Store build.

---

## 0. Three blockers to fix before you submit 2.0.0

These are not ASO notes. Each one is a code fact I verified, and each one is a plausible rejection or refund event. Fix them before screenshots are shot, because two of them are *on screens the screenshots need*.

| # | Problem | Evidence | Why it blocks the listing |
|---|---|---|---|
| 1 | **Print price mismatch.** The app displays `$34.99` for hardcover; the server charges `$39.99`. | `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/PrintOrderView.swift:38` (`unitCents = format == .hardcover ? 3499 : 1999`) and line ~117 (`price: "$34.99"`) vs `/Users/damianocanali/Documents/my-favorite-book/lib/print/pricing.js:2` (`hardcover: 3999`) | A displayed price that differs from the charged price is a chargeback generator and a Guideline 3.1.1 / consumer-law problem. It also means **`PrintOrderView` cannot appear in any screenshot or preview** until it's corrected. |
| 2 | **Paywall over-claims two features that do not exist.** | `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/PaywallView.swift:113` `"🎙️ Voice input & read aloud"` and `:114` `"👨‍👩‍👧 Up to 4 kid profiles"` | There is no `SFSpeechRecognizer`, no `AVAudioEngine` capture, and no profile model/table/switcher anywhere in `ios-native/`, `src/`, or `api/`. App Review reads the paywall as part of Guideline 3.1.2 (accurate subscription information) and 2.3.1 (accurate metadata). Delete both lines. Replace with verified ones: `"✏️ Draw your own illustrations"`, `"🔊 Read your finished book aloud"`. |
| 3 | **The public Gallery ships user-generated content with no report, block, or moderation affordance on iOS.** | `/Users/damianocanali/Documents/my-favorite-book/ios-native/MyBookLab/Views/GalleryView.swift:129-144` reads `APIClient.fetchGallery()` and renders other children's books. I found no report/block/flag control in the view. | Guideline 1.2 requires UGC apps to ship a content filter, a mechanism to report offensive content, a mechanism to block abusive users, and published developer contact. This is the single highest rejection risk in the submission, and it is amplified because the content is authored by children. Add a "Report this book" control on the published-book view and a contact line before submitting. |

Two more, lower severity but worth knowing while writing copy: **the free-tier book cap is not enforced on iOS** (there is no `maxBooks` check anywhere in `ios-native/`), so never promise a free-tier limit in iOS copy; and **all six mascot imagesets are empty** — every `Assets.xcassets/Mascot*.imageset/Contents.json` declares 1x/2x/3x slots with no filenames, so `Mascot.swift` falls through to its emoji fallback. The shipping app shows ⭐👋🤗🎉🤔🏅 where the drawn character should be. Consequence for this brief: **the mascot may not appear in any screenshot or preview frame captured from the app.**

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
Illustrate: your child draws the page with a finger or an Apple Pencil, using
Apple's own pencils, crayons and markers, and that drawing is what goes into
the printed book. The app rewards that path more than the AI one.

Every AI picture is labelled on screen as AI-generated and may not be perfect.
We'd rather your child know.


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

- No ads. No analytics tracker. No data sold. The privacy manifest declares no
  cross-app tracking.
- A grown-up check — a two-digit addition problem — before the photo picker
  and before any purchase.
- If a photo is used to make a cartoon hero, the original photo is never saved.
  Only the cartoon is kept.
- Everything your child types is run through a content check before it reaches
  any AI, and blocked with a kind message rather than an error.
- Story Buddy is instructed to refuse anything scary or inappropriate, and to
  ignore attempts — including from your child — to change what it is.
- Books stay private on your child's shelf. Nothing is shared unless someone
  deliberately publishes it.
- You can delete your account and everything in it from inside the app, with
  seven days to change your mind.

What we won't tell you is that it's impossible for an AI to say something
unexpected. It's constrained, moderated and rate-limited, and we'd rather say
that than promise perfection.


BEFORE YOU BUY

There's a free tier so you can build a book and see exactly how the help
behaves before paying anything. Subscription prices are shown in the App Store
at the moment you subscribe, and it's an Apple subscription — cancel it in
Settings, no email to us. Printing is a separate one-off purchase.

Made for iPad first, and it works on iPhone.

Privacy policy: https://mybooklab.app/privacy
Support: https://mybooklab.app
```

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
| A specific hardcover price | Blocked by the $34.99/$39.99 bug. Once fixed, add "softcover $19.99, hardcover $39.99, $4.99 US shipping" to the print paragraph — it's a real conversion asset. |
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

## 5. Localisation priorities

### The determining fact

`find /Users/damianocanali/Documents/my-favorite-book/ios-native -name "*.strings" -o -name "*.xcstrings" -o -name "*.lproj"` returns **nothing**. Every string in the app is a hardcoded Swift literal (`Text("Who's the author of this story?")`). There is no localisation infrastructure at all, and the AI prompts in `api/story-buddy.js` and `api/generate-image.js` are English.

That means store-metadata localisation and app localisation are two entirely separate projects with different costs, and only one of them is available now.

### Tier 0 — do immediately, zero engineering

Add App Store Connect metadata localisations for **en-GB**, **en-AU**, **en-CA**. These are free, need no build, and each one gets its **own 100-character keyword field** — which is the actual prize. You roughly quadruple your indexed keyword surface for a day's work.

Practical notes:
- The en-GB localisation serves the UK, Ireland, Australia, and New Zealand storefronts, so at minimum ship en-GB even if you skip en-AU.
- Change spellings that matter to a parent's eye: *colour*, *favourite*, *practise*, *maths*. Getting these wrong is a small, specific credibility hit with exactly the audience that reads 2-star reviews before downloading.
- Use different keyword tokens per storefront, not translations of the same ones. UK/AU/IE parents search school-system vocabulary the US doesn't have: `ks1`, `ks2`, `year2`, `sats`, `eyfs`, `send`, `ehcp`, `handwriting`. Australia adds `naplan`, `foundation`. Canada uses US vocabulary but has a French-language requirement (below).
- The UK is also disproportionately valuable for this specific product: the dyslexia-parent community there is large, well-organised, and heavily active on the Instagram accounts named in the positioning brief.

### Tier 1 — do not translate yet, and here's the blocker

A translated store page that leads to an English-only writing app is worse than no translation. The child cannot write in their own language, the AI helper answers in English, and the emotional payoff — the printed book — **is unavailable**: `api/print-orders/create.js:96` hard-rejects any country other than US. So a German parent would download a translated page, find an English interface, and discover she cannot order the book.

That produces refunds, one-star reviews in a language you may not read, and a permanently damaged storefront rating that is very hard to recover. **Do not localise metadata into any non-English language until all three of these are true:**

1. Strings extracted to an `.xcstrings` catalogue and translated (this is a real engineering project — 50+ view files with inline literals).
2. `api/story-buddy.js` and `api/generate-image.js` prompts localised, and moderation verified in the target language.
3. Print fulfilment extended beyond US, or the description honestly scoped and the print CTA hidden in non-US storefronts.

### Tier 2 — the order to translate in, once those are true

Ranked on: iOS revenue per user, parental spend on education apps, size and organisation of the dyslexia/ADHD parent community, Latin script (so the keyboard, the drawing export, and the AI illustration pipeline need no rework), and whether print fulfilment can plausibly reach them.

| # | Language / markets | Why it's first | Cost signal |
|---|---|---|---|
| 1 | **German** — DE, AT, CH | Highest-paying European market for paid education apps, very high iPad-in-the-home penetration, and *Legasthenie* is a mainstream, well-funded parental concern with an established diagnosis-and-support culture. Parents there are used to paying for a tool rather than expecting free. | Moderate. German strings run ~30% longer than English — the wizard steps and button labels in `CreateBookView` will need layout checks. |
| 2 | **French** — FR, CA, BE, CH | The *"dys"* (dyslexie/dyspraxie/dysgraphie) parent community in France is large and highly networked, mirroring your ICP almost exactly. French also unlocks **Canada**, which matters commercially and where French-language expectations are strong. | Moderate; similar expansion issue to German. |
| 3 | **Spanish** — ES, then MX/AR/CO | Enormous volume, materially lower ARPU. Do **es-ES first for revenue**, es-MX later for volume, and treat them as separate metadata localisations with separate keyword sets. | Low linguistic cost, high support cost. |
| 4 | **Dutch** — NL | Small market, but extraordinary iPad penetration in primary education and a well-funded parental education-spend culture. Unusual option: because English fluency is very high, you can get most of the benefit by localising **metadata only** and leaving the UI English — the one case where Tier-1's blocker is genuinely softer. | Very low if metadata-only. |
| 5 | **Italian, Portuguese (BR), Nordic** | Reasonable next wave; none is individually decisive. | — |

### Explicitly deprioritised

**Japanese, Korean, Simplified Chinese.** Japan and Korea are top-tier App Store revenue markets and it is tempting. Don't. A writing app for children is the worst possible category to machine-translate into: Japanese needs vertical text support, an IME-aware text editor, kanji-level awareness in the Story Buddy age-scaling logic, and an entirely different children's-literature register. The serif book-page rendering (`.system(.body, design: .serif)` → New York) has no meaningful CJK equivalent in the current code. Print fulfilment doesn't reach them. This is a product project, not a translation project, and it should wait until the app has proven itself in Anglophone markets.

**Right-to-left languages (Arabic, Hebrew).** The entire reader, the page-turn `TabView`, the drawing canvas orientation, and the printed-book layout assume LTR. Not a translation task.

### Recommended sequencing

Ship 2.0.0 with **en-US + en-GB + en-AU + en-CA metadata only**. Spend the next two quarters on Anglophone growth, where the Instagram campaign, the positioning, and the print fulfilment all already work. Revisit German only after (a) strings are extracted, (b) print ships outside the US, and (c) you have enough US/UK retention data to know the product is worth translating.

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
3. **Front-load the review buffer.** Budget for at least one rejection round given §0 — specifically the Guideline 1.2 UGC exposure in the Gallery. Submit at least 10 working days before the campaign date.
4. **Prepare the App Review notes deliberately.** Reviewers of a children's app with AI and a subscription will look for exactly the things you're vulnerable on. In the notes: give a working demo account with books already saved (never a signed-out or empty state), state that the parental gate appears before the photo picker and before purchase and how to pass it, state where the report-content control lives in the Gallery, state that account deletion is at Account → Delete Account, and state plainly that the AI is constrained to sentence starters and questions on iOS.
5. **App Privacy labels.** Verify they match `PrivacyInfo.xcprivacy:11-16` (`NSPrivacyTracking = false`, empty tracking domains) and the actual collection. A mismatch here is a slow, expensive rejection.
6. **Age rating.** Recommend **4+, Education primary / Books secondary** — but the rating questionnaire will ask about user-generated content, and the Gallery means you must answer yes. Answering yes with moderation in place keeps you at 4+; answering yes with no moderation pushes you to 12+ and torpedoes the whole positioning. This is the second reason §0 item 3 is a launch blocker rather than a backlog item.
7. **Kids Category: opt out.** It is tempting for a children's writing app, but Kids Category apps face additional scrutiny on UGC and on any data leaving the device, and your Gallery displays content authored by other children. Education + 4+ gets you the audience without the extra surface. Revisit only if the Gallery gains real moderation.
8. **Apple Search Ads from day one, small budget.** Bid on your own brand name first — this is defensive and cheap, and it stops StoryJumper or Night Zookeeper buying "my book lab". Then a small discovery campaign on `creative writing kids`, `make a book kids`, `kids story writing`. Point each ad group at a matching CPP (below).

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
- **Blocked until §0 item 1 is fixed** if you want to name a price anywhere on this page.

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
| T−15 working days | Fix §0 items 1–3. Rename SKU to "My Book Lab: Kids Story Maker". Capture all 12 screenshots and both preview cuts from the fixed build. |
| T−10 | Submit for review, release set to **Manual**. Submit App Review notes with the demo account. |
| T−7 | Build CPP-1, -2, -3 in App Store Connect (they can be created while the version is in review, but each CPP must itself be approved — allow the time). |
| T−5 | Add en-GB, en-AU, en-CA metadata localisations with their own keyword fields. |
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
- **Price or "Free".** Apple removes pricing references from screenshots. Nothing in your set may say "Free", "$19.99", "50% off", or "Try free". This is why §3 puts no price in any caption, and it's a second reason `PrintOrderView` is a bad screenshot candidate.
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
| **1.2** — UGC apps need filtering, reporting, blocking, and published contact | ❌ **Not met.** The Gallery displays other children's books with no report or block control on iOS. Highest rejection risk in the submission. See §0. |
| **3.1.2** — accurate subscription information at the point of purchase | ⚠️ The paywall lists two features that don't exist. See §0. |
| **1.3 / age rating** — accurate questionnaire answers | ⚠️ Must answer "yes" to user-generated content because of the Gallery; keeping a 4+ rating depends on moderation being in place. |
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
- `/Users/damianocanali/Documents/my-favorite-book/lib/print/pricing.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/print-orders/create.js`
- `/Users/damianocanali/Documents/my-favorite-book/api/publish-book.js`

