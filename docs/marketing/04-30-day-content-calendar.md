# 30-Day Launch Content Calendar

# My Book Lab — 30-Day Launch Content Calendar

**Product:** My Book Lab (mybooklab.app · iOS app, bundle `com.myfavoritebook.app`)
**Primary surface:** Instagram (Reels-led) · Secondary: Pinterest (search) · Stories daily
**Two funnels, never mixed in one post:** Parents → App Store. Educators → mybooklab.app/teacher (browser).

---

## 0. Read this before anything gets filmed

Three things in the shipping build will make you publish a false claim if you point a camera at them. All three verified in the repo today:

| Blocker | Verified | Consequence for this calendar |
|---|---|---|
| **Hardcover price mismatch** | `ios-native/MyBookLab/Views/PrintOrderView.swift:117` displays `"$34.99"`; the server charges $39.99 (`src/lib/printPricing.js:8` → `hardcover: { cents: 3999 }`) | **R-10 "From Sentence to Softcover" (Day 17) is BLOCKED** until the iOS display is corrected to $39.99. Do not film the print flow. Do not write $34.99 in any caption — including in copy inherited from the parent-positioning brief, which still quotes the stale number. Softcover $19.99 + $4.99 flat US shipping, US only, 1–10 copies, is safe. |
| **Paywall over-claims** | `PaywallView.swift` benefits list contains `"🎙️ Voice input & read aloud"` and `"👨‍👩‍👧 Up to 4 kid profiles"`. There is no speech recognition in the iOS app and no profile model anywhere in the codebase. | **Never film or screenshot the paywall.** Not in a Reel, not in a Story, not blurred in the background. Flag both lines to engineering as ship-blockers; the pricing carousel (C-03) uses designed graphics only. |
| **Mascot assets are empty** | Every mascot imageset in `Assets.xcassets` declares 1x/2x/3x slots with no filenames; `Mascot.swift` falls back to emoji (⭐ 👋 🤗 🎉 🏅) | The drawn mascot may appear in **designed graphics** (the PNGs in `/public/mascot` are real). He may **not** appear in a screen recording, and no post may imply he's in the app, until the art is dropped into the catalog. Check the build in hand on every shoot day. |

**No waitlist infrastructure exists.** A grep across `src/` and `api/` returns no waitlist, newsletter, or email-capture code. The pre-launch week below needs one of: (a) an off-the-shelf hosted form linked from bio, (b) App Store Connect pre-orders, or (c) the manual fallback — a Story question sticker plus a DM list. Decide this on D-14; it is the only hard engineering/ops dependency in the pre-launch week.

### Per-post compliance checklist (pin this in the content doc)

Every post, before it goes out, must survive all of these:

- [ ] No real child's face, anywhere in frame, including reflections in the device glass
- [ ] Every visible name fictional — the wizard's first step asks "Who's the author?", so a name field *will* be on screen
- [ ] Demo content only: **"Theo and the Star Bear"** (12 illustrated pages, ships in the app, designed to be shown)
- [ ] No empty states, no spinners, no "Thinking…", no AsyncImage placeholder, no error copy
- [ ] Clean status bar, 9:41, notifications off, Reduce Motion **off** for filming
- [ ] Not claimed: voice input on iOS · dyslexia font on iOS · read-aloud word highlighting on iOS · focus mode on iOS · word banks/progress map/idle nudges on iOS · classroom on iOS · offline writing on iOS · PDF export on iOS · high-contrast mode anywhere · adjustable fonts · "2 books free" (it's 1) · "20 badges" on iOS (11 are reachable) · WCAG/UDL/COGA compliance · COPPA *certification* · Android · push notifications/reminders · "4 kid profiles" · $34.99
- [ ] iOS subscription price, if mentioned at all, is read from App Store Connect — never from `plans.js` (that's the web/Stripe price)
- [ ] Educator post? CTA is the **web**, never "download on the App Store"

---

## 1. Weekly themes — the month's narrative shape

The arc is deliberately trust-first. This buyer has been burned by two "educational" apps already and reads the 2-star reviews before she downloads. Selling the feature list in week one would put us in the same bucket as everything she's deleted. So: prove the constraint, then earn the features.

| Window | Theme | The single sentence it's arguing | Dominant emotion |
|---|---|---|---|
| **Days -7 to 0** | *"Have you been in my house?"* | We can describe your Tuesday evening more accurately than you expected a stranger to. | Recognition |
| **Week 1 (D1–7)** | **It will not write the story.** | The AI is deliberately less capable than it could be, and that's the product. | Relief / suspicion lifting |
| **Week 2 (D8–14)** | **Built for the kid who stalls.** | Getting started is the specific thing that breaks, and every support aims at that. | Being understood |
| **Week 3 (D15–21)** | **Screen time that ends in something you can hold.** | The session terminates, and what it produces leaves the screen. | Guilt relief |
| **Week 4 (D22–28)** | **Open it before your child does.** | You can verify every claim in ten minutes. Here's exactly what's missing, too. | Confidence to buy |
| **D29–30** | **What you asked us.** | We read the comments, we answered the hard ones, here's what's honestly not there yet. | Belonging |

Educator content runs as a **thin parallel lane** — one post per week from Day 9 — because the teacher product is web-only and pointing that audience at the App Store creates a public, loud churn moment in a comment thread other teachers read.

---

## 2. Concept index

These IDs are the join key between this calendar, the feed-post deck and the Reels deck. Every row in the day-by-day table references one.

### Reels (17 used)

| ID | Concept name | What it shows | Verified in |
|---|---|---|---|
| R-01 | **The Greyed-Out Button** | Illustrate is disabled on an empty page; child types; it enables; picture appears | `CreateBookView.swift` — `.disabled(… \|\| currentPageText.isEmpty)`; generation at 883-908 |
| R-02 | **Three Questions, No Paste** | "Help me think" returns three questions with no insert control — camera lingers on the absence of a button | `StoryBuddyView.swift:104-108` — `questionCard` is a plain view; only `starterCard` is a Button |
| R-03 | **Shake for an Idea** | Shake the iPad, purple card springs in with a prompt. Offline, instant, no account | `MainTabView.swift:67-75`; `StoryIdeas.swift:8-45` (30 on-device prompts) |
| R-04 | **Own Two Hands** | Apple Pencil drawing → "Use it" → the drawing on the page. 25 coins vs 15 for the AI path | `DrawingCanvasView.swift:16-140`; `CreateBookView.swift:865-881` |
| R-05 | **The Ten-Minute Parent Test** | Founder POV: opens the app, presses both help buttons, narrates what comes back | Free tier: 1 book, 3 Buddy uses/day, 2 illustrations/day |
| R-06 | **What It Won't Do** | Straight-to-camera list of the five things the app does *not* have | See compliance checklist above |
| R-07 | **The Shelf** | Coloured spines on the wooden shelf; tap; spine lifts 10pt, glows, opens | `BookshelfView.swift:246-395` |
| R-08 | **The End** | iPad landscape two-page spread, page turns at a child's pace, "The End" fires 50-piece confetti | `BookDetailView.swift:225-263, 315-332, 107-118` |
| R-09 | **Grown-Up Check** | The maths gate appears before the photo picker. Let it read; never show it dismissed fast | `CreateBookView.swift:442-475` (both addends 11–19) |
| R-10 | **From Sentence to Softcover** ⛔ | Print order → Live Activity walking 🖨️ → 📚 → 🚚 | `PrintOrderLiveActivity.swift:28-88`. **BLOCKED on the $34.99 fix.** Live Activity only advances while the app is open — never imply background updates |
| R-11 | **Sixty-Four Heroes** | Fast scroll of the 64 emoji heroes + 6 story worlds; pick 🐉, the AI draws a dragon | `CreateBookView.swift:257-267, 483-490`; species map `Book.swift:143-165` |
| R-12 | **The Car Story** | No product. Voiceover over B-roll: the forty-minute dragon story in the car vs four sentences for school | Positioning brief, sample sentence 1 |
| R-13 | **Reduce Motion** | Settings toggle on → loops stop, confetti still appears but doesn't fall or spin | `ReduceMotion.swift:15-51`; `Confetti.swift:42-58` |
| R-14 | **The Class Code** | *Educator, web.* Chromebook: name a class, get a 6-char code, write it on the board | `api/classroom.js` `CODE_CHARS` (no O/0/I/1); `TeacherPage.jsx:35-56` |
| R-15 | **Two of Three Helpers** | *Educator.* Names all three Story Buddy intents including "Write for Me" — and says there's no teacher switch for it | `api/story-buddy.js` (starters / questions / paragraph); `StoryBuddy.jsx:9` |
| R-16 | **Badges Are for Showing Up** | Badge popup; reads three badge names aloud; states that nothing in the catalog scores writing | `RewardsStore.swift:24-51`; `BadgePopup.swift:16-69` |
| R-17 | **Read It Back** | iOS reader reads a finished page aloud at rate 0.45 — slower than the system default. **No word highlighting on iOS** | `SpeechSpeaker.swift:16-26`; `BookDetailView.swift:356-369` |

### Carousels (6)

| ID | Concept name | Template |
|---|---|---|
| C-01 | **Six Screens to a Book** — the wizard, one card per step | Card Grid → Device Showcase frames |
| C-02 | **What's Actually In It (and What Isn't)** — the honest iOS/web map | Card Grid |
| C-03 | **The Free Tier, Plainly** — 1 book, 3 Buddy uses/day, 2 illustrations/day; print is one-off, never a subscription | Card Grid |
| C-04 | **Nine Questions Parents Asked Us** — the objection set, answered in their own words | Card Grid |
| C-05 | **For the Kid Who Stalls** — the stall described, then each support named against it | Card Grid, promoted card |
| C-06 | **Teacher Reality Check** — web-only, text-only submissions, localStorage class list, 20/hr rate limit, no student seats | Card Grid, educator |

### Static feed (4)

| ID | Concept name | Template |
|---|---|---|
| F-01 | **"It will not write the story."** — launch anchor | Cosmic Hero |
| F-02 | **Theo and the Star Bear** — a page excerpt on paper | Paper Quote |
| F-03 | **First Books Finished** — community milestone | Reward Beat |
| F-04 | **Blank Page → Printed Page** | Before/After Spread |

### Story-only sequences (3)

| ID | Concept name |
|---|---|
| S-A | **Behind the Gate** — the parental gate, frame by frame, + a poll: "Would this stop your 7-year-old?" |
| S-B | **Ask Me Anything About the AI** — question sticker, answered in-frame the next morning |
| S-C | **Building a Book in Real Time** — 6 frames, start to "The End", with a quiz sticker on the page count |

---

## 3. Pre-launch week — Days -7 to 0

Day 0 is **App Store availability day** (target a Tuesday). Day 1 of the 30-day calendar is the Wednesday after.

Goal for this week is not installs — it's a **cold audience that recognises itself** and a small list of people who will convert in the first 24 hours, which is what gives the launch-day posts enough early engagement to escape the sub-500-reach floor a zero-history account otherwise sits at.

| Day | Weekday | Surface | Concept | Audience | Goal | Time (ET) |
|---|---|---|---|---|---|---|
| **D-7** | Tue | Reel | **R-12 The Car Story** *(no product in frame — pure problem)* | Parents (cold) | Reach. Seed the account with the recognition post, not a product post | 7:00pm |
| **D-6** | Wed | Story ×5 | S-B *Ask Me Anything About the AI* — question sticker | Parents | Harvest the exact objections; they become C-04's nine cards | 8:50pm |
| **D-5** | Thu | Carousel | **C-05 For the Kid Who Stalls** | Parents | Saves. This is the screenshot-to-a-friend post | 8:45pm |
| **D-4** | Fri | Reel | **R-06 What It Won't Do** — before launch, deliberately | Parents | Trust. Naming the limits before the product exists is the whole positioning in one move | 6:45pm |
| **D-3** | Sat | Story ×4 | Waitlist push + countdown sticker | Parents | List. Every reply gets a personal DM on launch day | 9:15am + 8:50pm |
| **D-2** | Sun | Feed (static) | **F-02 Theo and the Star Bear** *(Paper Quote)* | Parents | Show the output before the app. Warm paper on the dark ground is the strongest scroll-stopper in the system | 8:30pm |
| **D-1** | Mon | Reel | **R-01 The Greyed-Out Button** — teaser cut, 12s, no CTA | Parents | Reach + priming. The proof lands 24h before it can be bought, so launch day converts warm | 7:00pm |
| **D0** | **Tue** | **Feed (F-01) + Reel (R-02) + Story ×8** | **LAUNCH** — see runbook below | Parents | Install | Runbook |

**Waitlist mechanics (decide D-14):** no capture code exists in the repo. Cheapest honest path is an off-the-shelf hosted form behind a bio link, with the copy promising exactly one email. Do not promise "early access" — there is no TestFlight distribution plan in this brief and the claim would be unbacked. App Store Connect **pre-orders** are the stronger option if the release date is fixed, because they convert the list into day-zero downloads automatically; it needs a decision two weeks out, not one.

---

## 4. Launch day runbook — Day 0, hour by hour

Times ET. The shape of the day is: **be live before you announce, announce into your warmest window, then spend the evening in the comments, not making more content.**

| Time | Action | Owner | Notes |
|---|---|---|---|
| **06:30** | Confirm the app is actually live on the US store. Search "My Book Lab" on a device that has never had it | Founder | Apple's release can lag the scheduled time by hours. **Nothing publishes until a stranger's phone can find it.** |
| **06:45** | Verify the store listing: name reads "My Book Lab" (not "My Favorite Book"), screenshots current, no stale v1.0 copy from `STORE_LISTING.md` | Founder | `STORE_LISTING.md` claims voice input, OpenDyslexic, focus mode and classroom mode — all false for iOS. If any of that reached the listing, **stop the launch and fix it first**; a rejected/pulled listing mid-campaign costs more than a day |
| **07:00** | Generate the App Store **Campaign Link** with `ct=ig-launch-d0` (and per-post `ct` values for the month). Put it in bio | Founder | This is the only way you'll see social→install attribution in App Analytics → Campaigns |
| **07:15** | Bio updated: one line, the campaign link, and a second link to mybooklab.app/teacher behind a two-door `/start` page | Founder | Never swap the bio link daily — build the two-door page once |
| **07:30** | **Story frames 1–3** go live: "It's live", the icon, the campaign link sticker | Founder | Early Story taps signal the account before the feed post lands |
| **08:00** | Personal DMs to the entire waitlist. Individually written, no broadcast tool | Founder | 40 warm DMs out-convert 4,000 cold impressions on day zero |
| **09:00** | **F-01 "It will not write the story."** (Cosmic Hero) posts to feed | — | The anchor. Pinned to profile for the full 30 days |
| **09:00–11:00** | Comment duty. Reply to every comment within 10 minutes | Founder | Reply speed in the first two hours is the single biggest lever on a cold post's distribution |
| **11:00** | **Story frames 4–5**: the Greyed-Out Button clip + "ask me anything" sticker | — | |
| **12:30** | Pinterest: 4 pins published (F-01, F-02, C-05, R-12 cover), all keyworded | — | Pinterest is search, not launch — these compound over months, not hours |
| **14:00** | Post the launch to owned/adjacent surfaces: any parenting or homeschool community you are *already a member of*, personal accounts, email signature | Founder | Do not drop links in communities you joined this week. It reads exactly as it is |
| **16:00** | **Story frames 6–7**: behind-the-scenes, the founder's own kid's book (**face never in frame**, name fictional) | Founder | |
| **18:30** | **R-02 "Three Questions, No Paste"** publishes as a Reel | — | The deepest proof post lands in the ramp-up to the 9pm window and keeps working for 72h |
| **19:00–22:00** | Comment duty round two. Answer the AI objection in full every single time it appears; never link-drop as a reply | Founder | Every "isn't this just AI doing homework" comment is a free chance to perform the differentiator publicly |
| **21:00** | **Story frame 8**: thank-you + campaign link sticker one more time | — | |
| **22:30** | Log day-zero baseline: reach, saves, shares, profile visits, link taps, App Store impressions + product page views + downloads | Founder | This is the denominator for the whole month. Record it before you sleep or you will never reconstruct it |

**Two rules for the day.** Do not make new content — you will need every hour for replies. And do not check the App Store rank; day-zero rank for a cold launch is noise and it will wreck the evening.

---

## 5. The 30-day calendar

All times ET (subtract 3 for PT). Reels are scheduled for **6:30–7:30pm** — the ramp into the buyer's 9:40pm one-handed scroll, with Reels distribution building over 48–72h regardless. Static and carousel posts sit at **8:45pm**, in the window itself, because they're read rather than watched. Educator posts run **5:45am** (before-school scroll) or **Sunday 6:30pm** (planning night).

| Day | Wk | Surface | Concept | Audience | Goal | Time | Same-day Story layer |
|---|---|---|---|---|---|---|---|
| 1 | Wed | Reel | **R-01 The Greyed-Out Button** (full cut) | Parents | Proof · saves | 6:45pm | 3 frames: reshare + poll "would this be enough for your kid?" |
| 2 | Thu | Carousel | **C-04 Nine Questions Parents Asked Us** | Parents | Saves · objection clearing | 8:45pm | 4 frames: one card per frame, question sticker on the last |
| 3 | Fri | Reel | **R-03 Shake for an Idea** | Parents (+kid appeal) | Reach · shares | 6:30pm | 2 frames: "shake yours and screenshot what you get" |
| 4 | Sat | Feed (static) | **F-02 Theo and the Star Bear** (Paper Quote) | Parents | Warmth · profile visits | 9:15am | 2 frames, morning |
| 5 | Sun | Reel | **R-05 The Ten-Minute Parent Test** | Parents | Trust · install intent | 7:00pm | S-A *Behind the Gate*, 5 frames + poll |
| 6 | Mon | Reel | **R-07 The Shelf** | Parents | Reach · emotional proof | 7:00pm | 2 frames: "what would be on your kid's shelf?" |
| 7 | Tue | Reel | **R-06 What It Won't Do** (full cut) | Parents | Trust · comments | 6:45pm | 3 frames: the five limitations, one per frame |
| 8 | Wed | Reel | **R-02 Three Questions, No Paste** (re-cut, new hook) | Parents | Saves · the differentiator | 6:45pm | 2 frames |
| 9 | Thu | Reel | **R-14 The Class Code** | **Educators** | Web traffic · list | 5:45am | 4 frames, educator-targeted, link to /teacher |
| 10 | Fri | Reel | **R-11 Sixty-Four Heroes** | Parents | Reach · light relief | 6:30pm | 2 frames + "which hero would yours pick?" quiz |
| 11 | Sat | **Story only** | **S-C Building a Book in Real Time** (6 frames) | Parents | Depth with the warm audience; no grid post | 9:00am + 8:50pm | — |
| 12 | Sun | Carousel | **C-05 For the Kid Who Stalls** (refreshed) | Parents | Saves — the send-to-a-friend post | 8:45pm | 3 frames |
| 13 | Mon | Reel | **R-17 Read It Back** | Parents | Accessibility, honestly scoped | 7:00pm | 2 frames stating plainly: no word highlighting on iOS |
| 14 | Tue | Feed (static) | **F-04 Blank Page → Printed Page** (Before/After) | Parents | Bridge into week 3 | 8:45pm | 2 frames |
| 15 | Wed | Reel | **R-04 Own Two Hands** | Parents | Anti-AI-art objection · shares | 6:45pm | 3 frames: the coin comparison, 25 vs 15 |
| 16 | Thu | Reel | **R-16 Badges Are for Showing Up** | Parents | Anti-gamification objection | 6:45pm | 2 frames + poll: "streaks — helpful or hostile?" |
| 17 | Fri | Reel | **R-10 From Sentence to Softcover** ⛔ *or* **R-08 The End** | Parents | The artefact | 6:30pm | 3 frames |
| 18 | Sat | **Story only** | S-B *Ask Me Anything*, round two | Parents | Fuel for week 4's carousel | 9:00am + 8:50pm | — |
| 19 | Sun | Carousel | **C-06 Teacher Reality Check** | **Educators** | Trust · web traffic | 6:30pm | 4 frames |
| 20 | Mon | Reel | **R-08 The End** *(or R-13 if R-08 ran on Day 17)* | Parents | Emotional close · saves | 7:00pm | 2 frames |
| 21 | Tue | Feed (static) | **F-03 First Books Finished** (Reward Beat) | Parents | Community · social proof | 8:45pm | 3 frames: reshare user replies (permission first, no names) |
| 22 | Wed | Reel | **R-09 Grown-Up Check** | Parents | Safety objection | 6:45pm | 2 frames — gate shown at full length, never dismissed fast |
| 23 | Thu | Reel | **R-15 Two of Three Helpers** | **Educators** | Trust — disclose "Write for Me" | 5:45am | 3 frames |
| 24 | Fri | Carousel | **C-01 Six Screens to a Book** | Parents | Save-driver · how-it-works | 8:45pm | 3 frames |
| 25 | Sat | **Story only** | S-A *Behind the Gate*, extended + Q&A replies | Parents | Warm-audience depth | 9:00am + 8:50pm | — |
| 26 | Sun | Carousel | **C-03 The Free Tier, Plainly** | Parents | Convert the fence-sitters | 8:45pm | 4 frames |
| 27 | Mon | Reel | **R-13 Reduce Motion** *(or best-performing Reel re-cut)* | Parents | Accessibility credibility | 7:00pm | 2 frames |
| 28 | Tue | Reel | **R-12 The Car Story** (re-cut, new hook, new audio) | Parents (cold) | Reach — reopen the top of funnel | 6:45pm | 2 frames |
| 29 | Wed | Carousel | **C-02 What's Actually In It (and What Isn't)** | Parents | The month's thesis, in one saveable asset | 8:45pm | 4 frames |
| 30 | Thu | Reel | **Best performer of Days 1–28, re-cut** | Depends | Compound the winner; set week 5's baseline | 6:45pm | 3 frames + the month's honest numbers |

**Day 17 branch.** If the hardcover price is fixed and shipped before Day 14, run R-10 on Day 17 and R-08 on Day 20. If not, R-08 moves to Day 17, R-13 to Day 20, and R-10 is held for month two. Do not film the print flow "and fix it in post" — the price is on screen for the length of the shot.

**Day 27 and Day 30 are deliberately unassigned-ish.** By Day 27 you will have three weeks of data. Day 27 and 30 are where you spend it, per the decision rule in §8.

---

## 6. Cadence rationale

**The shape: 4 Reels + 1 carousel + 1 static per week, plus daily Stories, with one Story-only Saturday from week 2.** Twenty-seven grid posts across thirty days — 17 Reels (63%), 6 carousels (22%), 4 static (15%).

**Why Reels-dominant at 63%.** An account starting near zero has no follower graph to distribute into. Feed posts are shown overwhelmingly to people who already follow you, which for the first fortnight is a rounding error. Reels are the only surface on Instagram where a cold account's post is routinely served to non-followers. For the first 30 days, Reels are the acquisition channel and everything else is the conversion channel. Inverting that ratio — the instinct when you have beautiful designed feed assets and a strong visual system — is the most common way a launch account posts twenty-five times and reaches four hundred people.

**Why not 7 Reels a week.** Two reasons, one strategic and one physical. Strategically, this buyer's decision isn't made in a Reel — it's made in a carousel she saved and reopened at 9:40pm, or in a comment thread where she watched you answer the AI objection without flinching. Carousels and static posts are where saves come from, and saves are the metric that actually predicts installs here. Physically, a solo founder posting daily Reels while doing comment duty will be producing content instead of talking to people by Day 9, and the comment replies are worth more than the marginal Reel.

**Why week 1 gets seven posts and weeks 2–4 get six.** Launch week needs density: a new visitor who lands on the profile from the launch post must find a grid that already looks like a going concern, not three posts. After that, the Saturday Story-only day is a real rest day for production and a real depth day for the warm audience — Story completion rates on a small account are far higher than feed reach, so the trade is good.

**Why Stories run every single day, including rest days.** Stories reach the people who already trust you, which in month one is the group most likely to install and most likely to send the app to a friend. They're also nearly free — every one is a byproduct of a Reel or carousel already made. The two-pulse pattern (morning ~9:00am, evening ~8:50pm) matches the buyer: a school-run scroll and a bedtime scroll.

**Why the educator lane is thin (5 of 27 posts).** The educator product is real but web-only, has no student seats, and stores the class list in browser localStorage. It converts homeschool co-op leaders and individual SLPs, not schools. One post a week keeps the lane warm and builds a list for a proper educator push in month two — without spending launch-month attention on a funnel that can't take an App Store CTA.

---

## 7. Recycling plan — 10 shoots → 30 days

Each **shoot bundle** produces one hero Reel, one re-cut Reel with a different hook, a feed or carousel asset, a 2–4 frame Story sequence, and two Pinterest pins. The rule is: **film once at 60fps native resolution, cut many times.** Never re-shoot for a re-cut — change the first two seconds and the audio, keep the body.

| # | Shoot bundle | Hero Reel | Second cut | Feed / Carousel | Story sequence | Pinterest (2 pins) |
|---|---|---|---|---|---|---|
| 1 | **Story Buddy** — both help buttons, both results, the absent insert button | R-02 (D0) | R-02 re-cut (D8) | C-04 cards 1–3 | D0, D8 | "Does the AI write it for them?" (1000×1500 text-on-image) + Story Reel Cover 1080×1920 |
| 2 | **The Illustrate gate** — empty page → typed → enabled → picture | R-01 (D1) | R-01 teaser (D-1) | F-04 Before/After (D14) | D1, D14 | "Writing unlocks the picture" + before/after pin |
| 3 | **Founder to camera** — the ten-minute test, the limitations list, the car story | R-05 (D5), R-06 (D7), R-12 (D-7) | R-12 re-cut (D28), R-06 story cuts | C-05 (D-5, D12) | D-6, D18, D25 | "What this app won't do" + "For the kid who stalls" |
| 4 | **Shelf & reader** — spines, the pull-off, iPad landscape spread, page turns, The End | R-07 (D6), R-08 (D17/20) | R-08 short cut | F-02 Paper Quote (D-2, D4), F-03 (D21) | D4, D6, D11 (S-C), D21 | "What a finished page looks like" + shelf pin |
| 5 | **Wizard run-through** — all six steps end to end, 64 heroes, 6 worlds | R-11 (D10) | wizard cutdown | C-01 Six Screens (D24) | D10, D11 (S-C), D24 | "How a 7-year-old makes a book in 6 steps" (high-save pin) + hero grid pin |
| 6 | **Drawing** — Apple Pencil on the 3:2 sheet, tool picker, "Use it", into the page | R-04 (D15) | drawing cutdown | C-02 card (D29) | D15 | "No AI art required" + Pencil pin |
| 7 | **Safety** — the grown-up check at full length, twice, on two entry points | R-09 (D22) | gate cutdown | C-04 cards 4–6 | D5 (S-A), D22, D25 | "The maths problem that guards the photo picker" |
| 8 | **Rewards & motion** — badge popup, StatPills, confetti, then Reduce Motion on | R-16 (D16), R-13 (D27) | reward cutdown | F-03 Reward Beat (D21) | D16, D21, D27 | "Badges for effort, not quality" + reduce-motion pin |
| 9 | **Read-aloud** — reader speaking a page at rate 0.45, caption stating the honest scope | R-17 (D13) | audio-led cutdown | C-02 card | D13 | "Read-aloud, and exactly where it works" |
| 10 | **Educator (web, Chromebook)** — class creation, the 6-char code, the class gallery | R-14 (D9), R-15 (D23) | educator cutdown | C-06 (D19) | D9, D19, D23 | "Class code, no roster" + "Two of three helpers" — both keyworded for teacher search |

**Story derivation is mechanical, so nobody has to invent it at 8:40pm.** Every Reel yields the same four-frame pattern: (1) the Reel reshared with a "new post" sticker, (2) one still from the shoot with the single hardest sentence overlaid, (3) an interactive sticker — poll on an objection, question on a fear, quiz on a number, (4) the CTA with the campaign link sticker. Every carousel yields one Story frame per card, plus a question sticker on the last.

**Pinterest is a different animal and should be treated as such.** It's a search engine with a six-month tail, not a feed. Two pins per bundle, twenty pins over the month, each with a **keyworded title and description** aimed at what this buyer actually types: *creative writing app for dyslexic child*, *how to help my ADHD child start writing*, *writing activities for a child who hates writing*, *is it bad if my kid uses AI for schoolwork*, *make your own book kids*. Vertical 1000×1500 for static, 1080×1920 for idea pins. Use the Paper Quote and Card Grid templates — Pinterest rewards text-on-image far more than Instagram does, and the warm paper card against the cosmic ground is unusually strong at pin thumbnail size. Do not expect Pinterest results inside 30 days; measure it at 90.

---

## 8. Metrics

### What to measure, and what to ignore

Likes are the worst signal available for this product. This buyer reads at 9:40pm one-handed and does not like things; she **saves** them to reopen when she isn't tired, and she **shares** them to the friend whose kid also melts down over writing. Optimising on likes will point you at the light, playful posts (R-03, R-11) and away from the posts that actually sell (R-02, R-06, C-04).

**Tier 1 — the ones that decide things**

| Metric | Where | Why it matters here |
|---|---|---|
| **Saves ÷ reach** | IG post insights | The intent signal. She saves what she intends to act on later |
| **Shares ÷ reach** | IG post insights | The distribution signal, and the only reason a cold account grows fast |
| **Profile visits ÷ reach** | IG post insights | Whether the post made anyone curious about the product, not just the idea |
| **Link taps ÷ profile visits** | IG account insights | Bio quality. If this is low, the post isn't the problem |
| **App Store product page views (Web referrer)** | App Store Connect → App Analytics → Sources | The real hand-off point from social to store |
| **Downloads by Campaign** (`ct=` values) | App Store Connect → Campaigns | Per-post attribution. Requires the Campaign Link set up on Day 0 |
| **Product page conversion** = downloads ÷ product page views | App Store Connect | Isolates a listing problem from a content problem |

**Tier 2 — diagnostics, checked weekly not daily**

Reel 3-second hook rate (viewers who didn't scroll past); average watch time as a % of length; comment count and, more importantly, comment *substance* — a comment asking "is it on Android?" or "does it work for a 6-year-old?" is a qualified lead and belongs in a running doc; follower growth; Story completion rate and sticker interaction rate; DMs received.

**Tier 3 — do not optimise on these in month one**

Likes. Follower count as a headline. App Store rank. Impressions without a rate attached to them.

### Realistic cold-start benchmarks

An account starting near zero, posting 27 grid posts in 30 days, in a category with real but not enormous search volume. These are planning numbers to judge yourself against, not promises:

| | Poor | Working | Strong |
|---|---|---|---|
| Median Reel reach, week 1 | <300 | 500–1,500 | 3,000+ |
| Median Reel reach, week 4 | <500 | 1,500–4,000 | 8,000+ |
| At least one breakout in 30 days | 0 | 1 post >10k | 1 post >50k |
| Saves ÷ reach (carousel) | <0.5% | 1–2% | 3%+ |
| Saves ÷ reach (Reel) | <0.3% | 0.7–1.5% | 2%+ |
| Shares ÷ reach | <0.2% | 0.5–1% | 1.5%+ |
| Profile visits ÷ reach | <1% | 1.5–3% | 4%+ |
| Link taps ÷ profile visits | <5% | 8–15% | 20%+ |
| Followers gained, 30 days | <150 | 400–900 | 2,000+ (usually one breakout carrying it) |
| App Store product page conversion | <15% | 25–35% | 40%+ |
| Installs attributed to social, 30 days | <50 | 150–500 | 1,500+ |

Two calibrations worth holding onto. **Total month-one installs from organic social will be in the hundreds, not thousands**, and that is a normal, healthy launch — the month's real output is a content library that works, a validated hook, and 400–900 people who now recognise the account. And **profile-visit-to-install will look bad and isn't**: a large share of profile visits come from Android users, from browsers who can't install from a desktop, and from people saving for later. Judge it against your own week-one number, never against an absolute.

If product page conversion sits below 20% while link taps are healthy, the problem is the **App Store listing**, not the content — check the screenshots and the first three lines of the description, and check the app name reads "My Book Lab" everywhere.

### Decision rule: kill or double down

Evaluate a **format** (not a single post) once it has **three posts and at least seven days** of maturity. Reels need a full 72 hours before their reach is even readable.

Let **M** = the account's rolling median reach across all posts in the trailing 14 days.

- **Double down** — if the format's median reach ≥ **1.5 × M** *and* its median saves ÷ reach ≥ **1.0%**. Increase it to a minimum of two posts per week and re-cut its best performer within 10 days with a new hook. This is what Days 27 and 30 exist for.
- **Kill** — if the format's median reach ≤ **0.6 × M** *and* saves ÷ reach < **0.5%** across all three posts. Stop making it. Do not "try once more with better design"; the format is not what this audience wants from you.
- **Iterate, once** — everything in between. Change **one variable only** — the first two seconds, or the audio, or the caption's first line — and re-test once. If it still doesn't clear the double-down bar after that single iteration, kill it.

Two overrides. **A high-save, low-reach post is never killed** — a post at 0.5×M with a 3% save rate is finding exactly the right person and belongs in Stories, on Pinterest, and in the ad account, not in the bin. And **a post that generates substantive comments is never killed on reach alone** — R-06 "What It Won't Do" and R-02 "Three Questions, No Paste" may under-reach and still be the two posts that convert, because they're what she screenshots for her partner.

Do not make any format decisions before **Day 10**. Three posts of data on a cold account is noise, and the temptation to swerve in week one is the single most reliable way to end the month with no consistent library.

---

## 9. Production schedule

Six shoot days produce all ten bundles. Everything else is editing, which is scheduled in two weekly blocks so no one is cutting a Reel at 6:15pm for a 6:45pm post.

| Date | Block | What happens | Output |
|---|---|---|---|
| **D-14** | **Prep** | Demo account built and populated (never a real user's shelf). Second demo book authored fresh as demo content. Device prep: iPad Pro 11" + iPhone, 9:41, notifications off, Reduce Motion **off**, 100% battery. **Verify the mascot state in the build in hand** — if it renders as emoji, that's what ships and no recording may imply otherwise. Waitlist mechanism decided. App Store Connect campaign links generated. Two-door `/start` page live. | Shoot-ready environment |
| **D-13** | **Blocker escalation** | File the three ship-blockers with engineering: hardcover $34.99 → $39.99, paywall "Voice input" line, paywall "4 kid profiles" line. Confirm the App Store listing carries none of the stale `STORE_LISTING.md` claims. | Written, dated, tracked |
| **D-11** | **Shoot Block 1** — bundles 1, 2, 5 | Story Buddy (both modes, slow, let the empty space under the questions read), the Illustrate gate, the full wizard run-through. All iPad portrait, straight on. | Covers D-1, D0, D1, D8, D10, D14, D24 |
| **D-10** | **Shoot Block 2** — bundles 3, 4 | Founder to camera ×3 scripts, in one sitting, same shirt, different framings. Then shelf + reader: iPad **landscape** for the two-page spread, page turns at ~1 per 1.5s, capture the app's own page-turn audio. | Covers D-7, D-5, D-2, D4, D5, D6, D7, D11, D12, D17/20, D21, D28 |
| **D-9 → D-8** | **Edit Block A** | Cut everything for D-7 through D7. Design F-01, F-02, C-04, C-05. Build all pre-launch Story frames. | 8 pre-launch + 7 week-1 assets, finished and scheduled |
| **D-4** | **Shoot Block 3** — bundle 10 (educator, web) | Chromebook or laptop, browser, real class creation, real 6-char code (**burn the code after filming — anyone holding it can open the gallery**). Fictional class name, fictional student names, no school name. | Covers D9, D19, D23 |
| **D0** | **Launch** | No filming. Runbook only. | — |
| **Day 3** | **Shoot Block 4** — bundles 6, 7 | Drawing on the 3:2 sheet with an Apple Pencil (**hands only, unidentifiable, no face**), then the grown-up check at both entry points, filmed at full length twice. | Covers D15, D22, D25 |
| **Day 4–5** | **Edit Block B** | Cut D8–D14. Design C-01, C-06, F-04. Re-cut R-02 with a new hook using week-1 comment language. | Week 2 finished and scheduled |
| **Day 10** | **First format review** | Apply the §8 decision rule for the first time. Reassign Days 27 and 30 provisionally. | A written call, not a vibe |
| **Day 11** | **Shoot Block 5** — bundles 8, 9 | Badge popup, StatPills, confetti — then the same beats again with Reduce Motion **on**, so R-13 is a genuine A/B in one take. Then read-aloud, capturing the app's own audio clean. | Covers D13, D16, D21, D27 |
| **Day 12–13** | **Edit Block C** | Cut D15–D21. Design F-03 and C-03. **Check the hardcover fix status — this is the Day 17 branch decision point.** | Week 3 finished and scheduled |
| **Day 17** | **Shoot Block 6** — bundle 6b / R-10 pickup, *conditional* | Only if the price display is fixed and shipped. Otherwise this slot becomes a pickup day for whatever the Day 10 review said to double down on. | Covers D17 or month two |
| **Day 19–20** | **Edit Block D** | Cut D22–D30. Design C-02 as the month's thesis asset — it should be the single best thing produced all month, because it's the one that outlives the launch. | Week 4 finished and scheduled |
| **Day 24** | **Second format review** | Apply the decision rule again with three weeks of data. Lock Days 27 and 30. Draft the month-two plan off what actually worked, not what you hoped would. | Month-two brief |

**Two scheduling notes.** Comment duty is a daily 45-minute block (20 min morning, 25 min evening) and it is not optional — on a cold account it outperforms an extra post. And every shoot day starts with the compliance checklist read aloud from §0, because the expensive mistakes here are the ones you don't notice until a parent points at a $34.99 in your Reel and asks why she was charged $39.99.

