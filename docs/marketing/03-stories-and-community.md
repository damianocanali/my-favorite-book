# Stories, Community & Outreach

though# My Book Lab — Instagram Stories + Engagement Playbook

---

## 0. Read this before you post anything

Six constraints that override every creative idea in this document. All verified in code today.

| Constraint | Verified at | What it means for Stories |
|---|---|---|
| **Printed books ship to the US only.** | `api/print-orders/create.js:96` hard-rejects any address where `country !== 'US'`; `ios-native/MyBookLab/Views/PrintOrderView.swift:284` hardcodes `country: "US"` | Never run a print/unboxing Story without a US-only line in-frame. Non-US followers will DM, and "coming soon" is a lie you cannot date. |
| **There is no delivery-time estimate anywhere in the product.** | `api/print-orders/submit-to-lulu.js` uses `shipping_level: 'MAIL'`; no SLA, no turnaround field, no copy | Never say "arrives in X days." Say "it ships from the printer" and stop. |
| **The iOS app shows the wrong hardcover price.** | `PrintOrderView.swift:38,117` shows **$34.99**; the server charges **$39.99** (`lib/print/pricing.js:2`) | **Ops blocker.** Do not run Sequence 7 (unboxing) or answer any print price question publicly until this is fixed. Quoting either number is wrong somewhere. Fix first, post second. |
| **The teacher product is web-only.** | No teacher/classroom view in `ios-native/MyBookLab/Views/`; `src/App.jsx` routes `/teacher` and `/classroom/:code` | Educator Stories link to **mybooklab.app/teacher**, never to the App Store. Mixing them produces a public churn comment other teachers read. |
| **The drawn mascot does not render in the shipping iOS build.** | Every mascot imageset in `ios-native/MyBookLab/Assets.xcassets` declares 1x/2x/3x slots with no filenames; `Mascot.swift` falls back to emoji | You may use the mascot PNGs freely in *designed graphics*. You may not screen-record the app and imply he appears there. Check the build in your hand. |
| **There is no Android app.** | `/android` is a retired Capacitor shell | Answer: iPhone/iPad, or any browser. Never "Android coming soon." |

**Standing bans in every frame, caption, and reply:** no real child's face, no real child's full name, no real school or teacher name, no efficacy statistic, no WCAG/UDL/COGA compliance claim, no "4 kid profiles," no voice input on iOS, no dyslexia font on iOS, no word-highlighting read-aloud on iOS, no "2 books free."

---

## 1. Eight Story sequences

Format notes that apply to all eight: 1080×1920, cosmic gradient ground (`#0D0A29 → #1A0D3D → #2E1252 → #1C0A2E`), top 250px and bottom 420px clear of type, right 180px clear of content. Headline type SF Pro Rounded Heavy (Fredoka 700 is the only approved substitute). Text over the bright `#2E1252` stop needs a `rgba(0,0,0,0.35)` 20px-blur backing. One mascot maximum per sequence, always with the `#BF59F2` 45% halo.

---

### Sequence 1 — Launch Day Countdown (6 frames, run across 4 days)

**Goal:** convert existing followers into day-one App Store downloads, and build a countdown subscriber list that auto-notifies them at launch. Secondary goal: pre-empt the "is this AI slop" objection *before* launch, so the comment section on launch day is already answered.

Run frames 1–2 on day −3, frame 3 on day −2, frame 4 on day −1, frames 5–6 on launch morning.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Cosmic Hero. App icon at 380px inside the purple halo. Nothing else. | **"Tuesday."** / small line beneath: "That's it. That's the story." | **Countdown** — name it `MY BOOK LAB 2.0`, set to launch morning local time | The countdown sticker is the whole point of frame 1. Everything else is decoration around a subscribe button. |
| 2 | Device Showcase, iPad portrait, real capture of the create wizard step 1 (author name = a demo name). | "Six screens. Not a blank page." | None — let it breathe | Screenshot must be a real current build. Demo account only. |
| 3 | Split frame. Left: Story Buddy's two buttons, real capture. Right: nothing. | "One of these buttons cannot put a single word into your child's book." | **Quiz**: *"Which one refuses to write anything?"* → `Give me ideas` / `Help me think` — correct answer: **Help me think** | This is the trust frame. Answer card copy: "Right. 'Help me think' returns three questions and gives your child no way to paste an answer in. They have to think of it and type it. We built it that way." |
| 4 | Paper Quote template. A finished page from *Theo and the Star Bear* on the `#FAF7ED` card, rotated −2°. | "This is what comes out the other end." / attribution beneath the card: "from the sample story that ships in the app" | **Countdown** (re-sticker, it now reads hours) | The one warm object against the dark. Highest-stopping frame in the set. |
| 5 | Cosmic Hero, wordmark gradient headline. | **"It's live."** | **Link** — App Store, label the tap "Open on iPad" | Post at the exact countdown time so subscribers get the ping and the frame simultaneously. |
| 6 | Story Reel Cover layout, mascot in the Welcoming pose at 900px, halo on. | "Free to try: build a whole book before you pay anything." / smaller: "iPhone + iPad. No Android." | **Question box**: *"What's the first thing your kid will write about?"* | The Android line kills a dozen DMs. The question box seeds Sequence 8's material. |

---

### Sequence 2 — "Help me name the next art style" (5 frames)

**Goal:** community co-creation on a decision that is genuinely still open, which is the cheapest real engagement a small account can generate. Secondary: teach the coin economy without it reading as a monetisation pitch.

**Honesty rule for this sequence:** the five shipping styles are Cartoon (free), Pixar 3D, Anime, Watercolor, Pixel Art — the last four at 15 coins each (`CoinStoreView.swift:356-369`). A sixth does not exist. Say so on frame 1, in those words. If you imply it's already built, you have over-claimed to the exact audience that checks.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Card Grid, 1×3, glass cards at 8% — three real avatar-style examples generated in-app. | "There are five art styles in the app." / beneath: "We're building a sixth. It doesn't exist yet. That's why I'm asking you." | None | Stating the absence up front is the entire credibility of the sequence. |
| 2 | Two glass cards side by side, each with a real example render. | "Round one." | **Poll**: `Crayon / storybook chalk` vs `Stop-motion clay` | Keep polls to two options — four-option quizzes tank completion on Stories. |
| 3 | Same layout, second pair. | "Round two." | **Poll**: `Papercut / collage` vs `Comic-book ink` | Run frames 2 and 3 back to back; screenshot both results for frame 4. |
| 4 | Screenshot of the two winning poll results, re-shared onto the cosmic ground. | "You picked [X]. Now it needs a name a seven-year-old would say out loud." | **Question box**: *"Name it."* | Constraint in the prompt matters — "a name a seven-year-old would say" filters out adult-clever answers you can't ship. |
| 5 | Reward Beat template, 1080×1080 cropped into 9:16. Gold ribbon banner with the winning name in the `#3A1163`-stroked gold lettering. Mascot in the Presenting Badge pose, lower right (crop the stray head sprite out of `badge.png`). | "[WINNING NAME]" in the ribbon / beneath: "Going into the build queue. I'll show you the first render when it's ugly." | **Question box** or reply prompt: *"Want to see the first bad version?"* | "When it's ugly" is the line that buys you Sequence 3's audience. Do not promise a ship date. |

---

### Sequence 3 — Behind the Build (5 frames, founder voice)

**Goal:** convert the AI-skeptical parent by showing the decision-making, not the feature. This is the sequence that produces saves and shares among people who will never buy — which is exactly how a small account grows.

Shoot this on a phone, handheld, at a desk. Do not design it prettily. The visual grammar of "founder at 11pm" is the credibility.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Handheld shot of the code editor, `api/story-buddy.js` open, the three intents visible. | "There are three help modes in the backend. The app your kid touches ships with two of them." | None | Do not zoom in far enough to read anything that isn't the intent names. No keys, no env, no URLs. |
| 2 | Screen recording of the iOS app: tapping "Help me think," three question cards appear, then a finger taps a card and *nothing happens*. | "Watch. I'm tapping the answer. It doesn't go anywhere." | None | This clip is the single most valuable asset in the whole account. Record it once, use it forever. Real build only. |
| 3 | Talking head or text on cosmic ground. | "The paragraph writer exists. I wrote it. It's on the website and it's labelled 'Write for Me.' It is not in the iPad app, and I'd rather tell you that than have you find it." | **Poll**: *"Was that the right call?"* → `Yes, keep it out` / `No, let parents choose` | Volunteering the web "Write for Me" mode is the trust move. Hiding it is the thing that eventually costs you a screenshot thread. |
| 4 | Screen recording: an empty page, the Illustrate button greyed out. Type one sentence. The button lights up. | "The Illustrate button doesn't work on an empty page. Words first. Picture second. That's the trade." | None | Verified: `.disabled(... || currentPageText.isEmpty)` in `CreateBookView.swift`. |
| 5 | Cosmic Hero, quiet. | "If you want to check any of this, the free tier lets you build a whole book without paying. Open it before your kid does." | **Link** — App Store | The invitation-to-inspect close. Never close a founder sequence with a discount. |

---

### Sequence 4 — Teacher Takeover (6 frames)

**Goal:** qualified educator signups at **mybooklab.app/teacher**, with the limitations disclosed *before* the click so nobody churns loudly in a comment thread.

Two ways to run it: a real teacher guest (run the release checklist in section 4 first, and remember: no student faces, no student names, no school name, no class name), or the founder shooting the web app on a laptop with fabricated demo student work. The second is safer and nearly as effective — teachers respond to seeing the actual tool, not to seeing a stranger.

**Do not put an App Store link anywhere in this sequence.**

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Laptop, browser, `mybooklab.app/teacher`. Real screen. | "Everything for teachers is a website. There is no teacher section in the App Store app. Saying that first so you don't download it and get annoyed." | None | This frame prevents the single most damaging educator comment you can get. |
| 2 | Screen recording: type a class name, click create, a six-character code appears. Stopwatch overlay optional. | "Name a class. Get a code. That's the roster." | None | Real timing. Don't speed-ramp. |
| 3 | Close crop of the code. | "Six characters. No letter O, no zero, no capital I, no number one — because you're reading it out loud to twenty-eight second graders." | **Quiz**: *"Which of these can't appear in a class code?"* → `Q` / `0` — correct: **0** | Verified: `CODE_CHARS` in `api/classroom.js`. This detail is the one teachers screenshot. |
| 4 | The `/classroom/CODE` gallery with demo submissions, on a projector or a laptop screen. | "Submitted books arrive text-only. The illustrations are stripped on the way in." / smaller: "Which, honestly, is easier to read." | **Poll**: *"Text-only submissions — good or bad?"* → `Good, I want the writing` / `I want the pictures` | Verified: `classroom-submit.js` nulls `coverImage` and every page's `illustrationData`. Naming it as a limit that happens to help you is more persuasive than hiding it. |
| 5 | Card Grid, 1×3 glass cards. | Card 1: "Your class list lives in that browser. Write the code down." Card 2: "About 20 submissions per hour from one network. Stagger a full class." Card 3: "No student seats. Free accounts save one book." | None | All three verified. Frame 5 is the churn-prevention frame; do not cut it to make the sequence prettier. |
| 6 | Cosmic Hero, restrained. | "Teacher plan is $13.99/mo or $109.99/yr, 14-day trial. Your card, not the district's — there's no PO flow." | **Link** — mybooklab.app/teacher | Verified in `src/lib/plans.js` / `PricingPage.jsx`. Never imply a school purchase path exists. |

---

### Sequence 5 — The Bedtime Story Routine (5 frames)

**Goal:** give the app a *slot* in the day. Apps without a slot get downloaded and forgotten. This sequence sells a 20-minute ritual, not a feature.

Warm, slow, quiet. No confetti in this one.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Dim room, iPad on a bed, screen showing the bookshelf as wooden spines. No child in frame, no hands. | "7:40pm. One page. Not a chapter — a page." | None | Room must be plausibly a real home. No stock imagery. |
| 2 | Screen recording: shake the iPad, the purple idea card springs in with a real prompt from the on-device set. | "Stuck? Shake it. Thirty ideas live on the device — no internet, no waiting, no AI call." | **Poll**: *"Would your kid shake it forty times before writing anything?"* → `Absolutely` / `He'd write immediately` | Verified: `StoryIdeas.swift` holds 30 prompts on-device. The self-deprecating poll option is what makes this shareable. |
| 3 | Screen recording: a page written, Illustrate tapped, the slot fills. Real speed, unedited. | "Write the page. Then you get the picture." | None | Do not speed-ramp AI generation. Ever. |
| 4 | iPad in landscape, the reader's two-page spread, read-aloud playing. Capture the app's own audio. | "It reads it back. Slower than the iOS default, on purpose, so they can follow their own words." | **Slider** or none | Verified: rate 0.45 vs iOS default 0.5. Do **not** claim word highlighting — that's web only. |
| 5 | The finished page on the `#FAF7ED` paper card, Paper Quote template. Mascot in the Welcoming Back pose (the kneeling, arms-open one) at the bottom-left corner, halo on. | "Then it ends. That's the part I actually built it for." | **Question box**: *"What's your 7:40pm right now?"* | The Welcoming Back pose is the parent-facing pose. Use it here and almost nowhere else. |

---

### Sequence 6 — ADHD Parenting Q&A (6 frames, run as a two-day loop)

**Goal:** the highest-intent audience in the entire ICP. This sequence is not a pitch — it is a public demonstration that you understand the problem, with a *disclosure* of what the iPad app does not have. Run frame 1 on day one, collect questions overnight, answer on day two.

**Hard rule:** no clinical advice, no diagnosis talk, no "this helps ADHD." You describe mechanics and let the parent decide.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Plain cosmic ground, big type, no product. | "He can tell you a forty-minute story about a dragon in the car and then write four sentences for school and say he's bad at writing." | **Question box**: *"Ask me anything about the writing stall. I'll answer tomorrow, including the stuff we don't have."* | Frame 1 is a mirror, not a hook. It should be uncomfortable to read. |
| 2 | Re-share a real question screenshot (crop the username unless they're a public account and you've asked). | Answer over cosmic ground, 3–4 short lines. | None | Answer the question about *getting started*, because that's the one that will come. |
| 3 | Screen recording of "Give me ideas" returning three one-sentence starters, and a tap inserting one. | "One tap gives them a first sentence to push off from. That's the exact intervention a good teacher makes at a desk." | None | |
| 4 | Screen recording of "Help me think" — three questions, no insert button. | "This one gives them three questions and no way to paste an answer. They have to think of it and type it." | **Quiz**: *"Can your child paste a Help-Me-Think answer into their book?"* → `Yes` / `No` — correct: **No** | |
| 5 | Card Grid, 1×3, quiet, no mascot, no sparkles. Title strip: **"What the iPad app does NOT have."** | Card 1: "No dyslexia font. Web only." Card 2: "No voice input. Web only." Card 3: "No high-contrast mode. Anywhere." | None | This frame will out-save every other frame you post this month. Do not soften it, do not add a "but." |
| 6 | Cosmic Hero. | "Nothing in the app scores or grades what your child writes. Not one badge. If they've been assessed to exhaustion, that might matter more than any feature." | **Link** — App Store | Verified: every badge in `RewardsStore.swift:24-51` is effort- or completion-based. |

---

### Sequence 7 — Printed Book Unboxing (5 frames)

**Goal:** the emotional close. This is the frame parents send to their partner. Also the sequence with the most legal and factual exposure, so it has the most rules.

**Blocked until the $34.99 / $39.99 display bug is fixed.** Do not run it before then.

**Shooting rules for this one specifically:** the book is *Theo and the Star Bear*, ordered on a demo account. No child's hands with identifying marks. No shipping label in focus. No order screen with a real address. No delivery-time claim. US-only stated in-frame.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | The sealed mailer on a kitchen table, overhead, natural light. Label deliberately out of frame or blurred to illegibility. | "This started as one sentence typed on an iPad." | **Countdown** is *not* appropriate here — use none | |
| 2 | Hands opening it. Adult hands, or unidentifiable child hands, nothing distinctive. | No copy. Let it be quiet for one frame. | None | Silence in the middle of a sequence is a pattern interrupt. Use it once. |
| 3 | The cover, held up, filling the frame. `#5B3FA8` cover of the demo book. | "Softcover $19.99. Hardcover $39.99. Flat $4.99 shipping." | **Poll**: `Softcover` / `Hardcover` | Quote the **server** prices. `lib/print/pricing.js` is authoritative. |
| 4 | Flipping to an interior spread. Illustration and serif text on cream paper. | "US shipping only right now. I'd rather say that than take your money and figure it out." | None | Verified: `create.js:96`. This line pre-empts the entire non-US DM wave. |
| 5 | The book closed, on the shelf, next to real books. | "One to ten copies per order. Grandparents, mostly." | **Link** — App Store | "Grandparents, mostly" is the Christmas/birthday trigger doing its work without a promo. |

---

### Sequence 8 — "Reply with your kid's weirdest story idea" (4 frames)

**Goal:** pure engagement volume and DM-thread warmth. Cheapest sequence to make, highest reply rate, and it generates a month of caption material. Run it monthly.

| # | Visual | On-screen copy | Sticker | Notes |
|---|---|---|---|---|
| 1 | Shake-idea card screen recording, one real on-device prompt visible. | "The app has thirty of these. My favourite: 'A dragon who is afraid of the dark finds a glowing friend.'" | None | Use a genuine prompt from `StoryIdeas.swift`. |
| 2 | Plain cosmic ground, big type. | "Yours are better. Reply with the weirdest story idea your kid has ever said out loud." | **Question box**: *"Weirdest idea. Go."* | The question box out-performs "reply to this story" because it's anonymous by default. |
| 3 | (Next day) Three replies re-shared as glass cards on the cosmic ground, 1×3 Card Grid. **Usernames cropped. First names removed. Ages generalised.** | "Three of yours." | None | **Never** post a reply with a child's name attached, even a first name, even if the parent included it. Strip it. |
| 4 | The winning idea typed into the app for real — screen recording of it becoming a page, then an illustration. Mascot in the Cheering pose in the *graphic overlay only*, two bounces, not looping. | "Made this one. It took four minutes." | **Question box**: *"Want me to make yours next month?"* | Cheering pose is reserved for genuine achievement — a follower's idea becoming a real page qualifies. Don't use it as decoration elsewhere. |

---

## 2. Highlight covers

Seven buckets. All covers share one system so the row reads as a single object: 1080×1920 cosmic gradient, one centred glyph at 420px, one word beneath in SF Rounded Heavy 88px white. **No two covers use the same accent colour glow.** Instagram crops highlight covers to a circle — keep the glyph inside a 640px centred safe circle.

| # | Name | Cover art direction | What lives here |
|---|---|---|---|
| 1 | **Start Here** | Open-book-and-star app icon at 420px inside a `#BF5AF2` 55% radial halo. The brand's primary symbol, used once. | The 60-second what-is-it, the free-tier explanation, the platform answer (iPhone/iPad/web, no Android). |
| 2 | **What It Won't Do** | A greyed-out capsule CTA — the primary gradient desaturated to 20% — with a thin `#C4BBD6` slash across it. Deliberately the dullest cover in the row. | Sequence 3 and Sequence 6 frame 5. The "Help me think" no-insert clip lives here permanently. This is your most-visited highlight; put it second. |
| 3 | **Real Pages** | The `#FAF7ED` paper card, rotated −2°, floating on the gradient with its black-40% shadow. The only warm cover in the row. | Finished pages, story excerpts, Paper Quote posts. Zero UI. |
| 4 | **For Teachers** | A six-character class code set in SF Rounded Heavy on a glass card at 8%, cyan `#64D2FF` glow behind it. Cyan is used *only* here so educators can find it instantly. | Sequence 4 in full, the limitations grid, the mybooklab.app/teacher link. |
| 5 | **Printed** | The demo book's `#5B3FA8` spine standing on a hint of the wooden shelf, warm `#FF9E5C` rim light. | Sequence 7, the US-only shipping answer, the price answer. |
| 6 | **Behind It** | The mascot in the Welcoming pose at 45% frame height, halo on, standing on the bottom edge of a glass card. The only mascot cover. | Founder sequences, build decisions, the "we took the paragraph writer out" story. |
| 7 | **Your Questions** | The gold ribbon banner shape, empty, with a single `#FFD60A` question mark in the stroked gold lettering treatment. Gold is used *only* here and never for a feature. | Answered question-box rounds, the price/safety/age FAQ, Sequence 8 results. |

Optional eighth once you have real permissioned material: **Parents Say** — a glass card at 12% (the raised variant) with a purple glow, no glyph, no quote on the cover itself. Do not create this bucket until you have three signed releases in hand (section 4).

---

## 3. The 30-minute daily engagement routine

Thirty minutes, one block, ideally 8:30–9:00pm — that is when the ICP is on her phone one-handed. Do not split it into five-minute checks; fragmented engagement produces fragmented comments.

### The daily 30

| Minutes | Activity |
|---|---|
| **0–5** | Clear your own notifications. Reply to every comment on your last 48 hours of posts, in order, no exceptions. A comment older than 24 hours is worth roughly nothing. |
| **5–20** | **The 15 comments.** Fifteen substantive comments on other people's posts, from the rotation below. Not fifteen likes. Fifteen comments. |
| **20–27** | DMs. Answer everything with a template from section 6, edited. Never leave a question DM overnight — the ICP reads slow replies as "small operation that will disappear." |
| **27–30** | Save one thing. Screenshot a comment, question, or objection worth turning into a Story frame. Drop it in a note. This is where next week's content comes from. |

### Weekly rotation for the 15 comments

Rotate the *tier*, not the accounts — commenting on the same five accounts every day reads as farming.

- **Mon — Neurodivergent parenting.** `@theadhd.couple`, `@understood.org`, `@the.dyslexia.classroom`, `@thedyslexicevolution`, `@adhd_love`, `@connectionsinmind`, `@drhayleywatson`
- **Tue — Gentle parenting.** `@drbeckyatgoodinside`, `@biglittlefeelings`, `@curious.parenting`, `@janetlansbury`
- **Wed — Teachers and SLPs.** Search `#writersworkshop`, `#specialeducationteacher`, `#slpeeps`, `#speechtherapyideas`. Comment on *teacher-made* posts, never on TPT sales posts.
- **Thu — Homeschool.** `@homeschool.thehappyway`, `@wildandfreechildren`, `@blossomandroot`, plus `#homeschoolcoop`
- **Fri — Kids' activities and screen-time.** `@busytoddler`, `@daysw.grey`, `@happilyevermom`, plus the anti-screen-time voices. Comment on the anti-screen-time accounts *sincerely and without pitching*. Ever.
- **Weekend — Reply-only.** No outbound. Answer what came in.

### Hashtags

Use 8–12 per feed post, never on Stories. Three tiers, mixed:

- **Broad (2–3):** `#creativewritingforkids` `#kidsbooks` `#writingforkids`
- **ICP-specific (4–5):** `#dyslexiaawareness` `#adhdkids` `#adhdparenting` `#dysgraphia` `#neurodivergentkids` `#reluctantwriter` — **note:** you may use `#reluctantwriter` as a *discovery tag* because that is what parents search, but never use the word "reluctant" in your own copy. It blames the child.
- **Educator (3–4, educator posts only):** `#teachersfollowteachers` `#writersworkshop` `#slpsofinstagram` `#assistivetechnology` `#udl` — use `#udl` to be *found*, never to claim alignment.

Never use: `#ai` `#aiart` `#aiforkids` `#edtech` as a primary. They deliver the wrong audience and the wrong first impression.

### What a good comment looks like

A good comment is **specific to that post, adds something the author didn't say, and mentions your product zero times.** Three or four sentences maximum.

**Bad:** "Love this! 🙌 This is why we built My Book Lab — check it out!"

**Good, on a post about a child freezing at a writing task:**
> The bit people miss is that it's almost never the whole task — it's the first sentence. Once there's ink on the line the rest usually comes. I've started just handing my kid an opening clause and letting him argue with it, which he loves doing.

**Good, on a teacher's post about collecting student writing:**
> The logistics tax on this is so underrated. Twenty-eight kids, twenty-eight permission states, and the actual writing takes eleven minutes. Curious whether you've found anything that survives a Chromebook cart.

You will get profile clicks from the second kind and blocked for the first. The rule: **your bio does the selling, your comments do not.**

### DM etiquette

1. **Never send a cold pitch DM to a parent.** Only creators (section 5) and only people who have engaged first.
2. **Reply to every inbound DM within 12 hours**, even if the reply is "good question, checking and coming back to you tonight."
3. **Never ask a parent to send you a photo of their child.** Not once, not framed as flattery, not "if you're comfortable." The answer is always no and the ask itself is the damage.
4. **If someone volunteers a child's photo or name unprompted:** do not save it, do not reshare it, reply warmly and redirect. Template in section 4.
5. **Answer the price question with the number**, immediately, no "DM me for details." Coyness with this ICP reads as a scam.
6. **When you don't know, say you don't know**, and say when you'll know. "I don't have a date" beats every soft-promise you could write.
7. **Never DM a competitor's commenters.** It will be screenshotted.

### The "is this AI slop?" comment

It is coming, it is coming publicly, and how you answer it in front of everyone else is worth more than the answer itself. Three rules: reply within the hour, never defensive, always end with something checkable.

**Template A — the flat, factual one (default; use for a genuine skeptic).**

> Fair question, so here's the actual answer. On the iPad app the AI helper has two buttons. One gives your child three opening sentences to push off from. The other gives three questions — and there's deliberately no way to paste an answer in, so they have to think of it and type it. There's no autocomplete and no "write this for me" on the page a child touches. The website version does have a paragraph writer labelled "Write for Me"; I left it out of the iPad app. Free tier lets you build a whole book without paying, so you can press the buttons yourself before you decide.

**Template B — the short, confident one (use when the comment is a drive-by one-liner and a long reply would look rattled).**

> The Illustrate button doesn't work on an empty page — your kid writes the words first, then gets the picture. That's the whole trade. Worth ten minutes of pressing buttons before you decide, it's free to try.

**Template C — the one for "the illustrations are AI slop" specifically (a different, fairer objection — do not use A or B here).**

> That one I'll give you — the illustrations are AI-generated and I'm not going to dress that up. Two things though. There's a Draw button right next to Illustrate: your kid draws it with a finger or an Apple Pencil, and *their* drawing is what gets printed in the book. The app pays more for that one — 25 coins for hand-drawn versus 15 for AI. If you'd rather your child never touch the AI art, the app works completely without it.

**Never:** delete the comment, argue in a thread longer than two exchanges, use the word "actually," reply with a link only, or say "we're not like other AI apps." Answer once well, then let it sit. Other parents read the reply, not the argument.

---

## 4. UGC and community strategy when the users are children

The uncomfortable structural fact: **your users are children and your buyers are their parents.** Every piece of user-generated content is therefore content *about a child*, created by a child, owned by a family. Treat it accordingly and you get a moat. Get it wrong once and the account is finished.

### The two absolute rules

1. **No child's face is ever posted.** Not in a photo, not in a video, not blurred, not from behind, not a reflection in the iPad glass, not in the background of an unboxing, not a school photo on the fridge. If the parent sends one, you thank them and you do not use it.
2. **No child's full name is ever posted.** First name only, and only with explicit written permission — and if the child is identifiable from context (a named school, a named town, a rare first name plus a visible location), not even that. Default to no name at all: *"a seven-year-old in Ohio"* is better content than a name anyway.

### What you *can* post

- **The book, not the child.** A page, a cover, a spine on a shelf. This is the strongest asset you have and it carries no child in it.
- **Hands only**, unidentifiable, no jewellery, no distinguishing marks, no visible skin conditions or scars.
- **The parent, on camera, talking about their child** — with the child neither seen nor named.
- **Text quotes from a child's story**, set in serif on the `#FAF7ED` paper card, with the author line generalised to age only.
- **A parent's or teacher's own words**, screenshot with the username cropped unless you have permission for it.

### The permission and release checklist

Never post family content until every box is ticked. Keep this as a form; do not do it over voice notes.

- [ ] The **parent or legal guardian** gave permission — not the child, not a teacher, not an aunt.
- [ ] Permission is **in writing** (DM, email, or signed form) and you have saved a copy with a date.
- [ ] The parent has **seen the exact asset** you intend to post — the crop, the caption, the frame — not a description of it.
- [ ] The parent has been told **where it will appear** (feed, Stories, highlights, website, paid ads — list each; permission for a Story is not permission for a paid ad).
- [ ] The parent has been told **how long it stays up** and that a highlight is effectively permanent.
- [ ] **No face** appears in the asset. Confirmed by a second look at every frame, including the first and last frame of any video.
- [ ] **No full name** appears — in the asset, in the app UI on screen, in the metadata, or in the filename.
- [ ] **No school, class, teacher, town, street, or team name** is visible or mentioned.
- [ ] **No address, order detail, email, or account screen** is visible.
- [ ] The child has been **asked** and said yes, and the parent confirms that. (Not legally required in most places. Do it anyway. It is the whole ethic of the product.)
- [ ] The parent knows they can **withdraw at any time**, by one message, no reason needed — and you have told them the withdrawal channel.
- [ ] A **withdrawal actually removes it**, within 48 hours, including from highlights. Assign this to a person, not to a hope.
- [ ] Nothing was **paid or traded** for the content without disclosing it (see section 5 — gifted content is an ad and must be labelled).

### Teacher-sourced content: an extra layer

A teacher cannot consent on behalf of a family. If a teacher offers you student work:

- [ ] The teacher confirms **each family** has given permission for public use, not just school-internal use.
- [ ] The **school or district** has approved it, or the teacher confirms no approval is required — get that in writing from the teacher.
- [ ] No **school name, class name, or teacher's full name** appears.
- [ ] You state plainly, once, in the DM: *"Nothing here has been through a student-data privacy review — there's no DPA or FERPA attestation flow in the product yet. If your district requires one, don't submit student content."* That sentence protects the teacher and it protects you.

### How to actually source it

1. **Ask for the artifact, not the child.** *"If your kid's finished a book, I'd love to see the cover — no faces, no names, just the book."* This ask converts because it's obviously safe.
2. **Run a monthly question box** (Sequence 8) and build content from *replies*, which are text and carry no imagery risk.
3. **Ask parents to be the on-camera voice.** A mother describing what changed at her kitchen table is stronger UGC than any child footage would be, and it's fully consentable by the person on camera.
4. **Seed with demo content, honestly labelled.** *Theo and the Star Bear* ships in the app and is designed to be shown. Label it: "the sample story that ships in the app." Never present demo content as a real user's.
5. **Never run a "post your child's book" contest.** Contests generate exactly the material you must not use, from parents who did not read the rules, at volume, with a prize creating pressure to over-share.

---

## 5. Creator and influencer outreach

### The four archetypes, in priority order

**1. Neurodivergent-parenting creators (10k–80k). Highest conversion, highest scrutiny.**
Parents of ADHD/dyslexic/dysgraphic kids who post from lived experience. They will read your privacy policy and they will press the buttons. If one of them endorses you, the endorsement carries further than a 500k account. If one of them catches you over-claiming, the takedown post will follow you.
*Find them:* the comment sections of `@understood.org` and `@the.dyslexia.classroom` — the parents leaving three-paragraph comments are the future creators. Also `#dysgraphia`, `#adhdmom`, `#dyslexiaparent`.
*Brief them on:* the two-button Story Buddy, the greyed-out Illustrate button, effort-only badges — and hand them the "what it doesn't have" list yourself.

**2. Teacher creators, especially SLPs and resource-room teachers (5k–50k). Highest trust density.**
*Find them:* `#slpeeps`, `#speechtherapyideas`, `#specialeducationteacher`, `#writersworkshop`. Look for teachers who post *their own* classroom, not TPT product shots.
*Brief them on:* web only, the class code, text-only submissions, the 20/hour rate limit, no student seats, no DPA. **Send them to mybooklab.app/teacher and never to the App Store.**

**3. Homeschool creators, secular and eclectic (8k–60k). Fastest converters.**
They hold the card, there's no procurement, and they need a writing component their kid doesn't fight. Avoid classical and Charlotte Mason purists — they will object to the screen on principle and you will have spent the relationship for nothing.
*Find them:* `#homeschoolcoop`, `#secularhomeschool`, `#eclectichomeschool`, and the co-op leaders in `@wildandfreechildren`'s comments.

**4. Kids-activity creators (30k–200k). Highest reach, lowest intent.**
Rainy-day-activity accounts. Use for volume at the top of the funnel, not for the ADHD message — they'll flatten it into "cute app."
*Find them:* `@busytoddler` and `@happilyevermom` adjacency, `#rainydayactivities`, `#screentimealternatives`.

### The gifting offer (near-zero cash cost)

Everything here costs you almost nothing because your marginal costs are AI calls and one print job.

- **12 months of the paid plan, comped**, for them and one friend. Cash cost: API calls. Perceived value: $54.99–$109.99.
- **One printed hardcover of their child's finished book, free, shipped.** Cash cost: printing plus $4.99 shipping. This is the single most effective thing in the offer because it is the content — they will film the arrival whether or not you ask. **US addresses only** (`create.js:96`). For non-US creators, substitute a PDF-quality digital copy plus the comped plan, and say why plainly.
- **A named art style or a named mascot.** Your mascot has no name anywhere in the codebase. Letting a creator's audience name him costs you nothing and buys a whole content arc. Same for a sixth art style (Sequence 2).
- **Direct access to the founder** — a real "text me when it breaks" channel. Small creators value this more than money, and it is genuinely free.
- **Early access to what you're building**, with the honest caveat that dates slip.

**Do not offer:** revenue share (you cannot administer it yet), exclusivity (you cannot enforce it), or a flat fee you cannot repeat next month.

**Disclosure:** a gifted plan and a free book make it an ad. The creator must label it — `#gifted` or a paid-partnership tag — and you must say so in your first DM. Asking for the label yourself is the thing that makes the good creators say yes.

### Three DM templates

Each one names something specific to *that person*. If you can't fill in the specifics from actually reading their last three posts, do not send it.

**Template 1 — neurodivergent-parenting creator**

> Hi [name] — your post about [the specific thing: the 25 minutes with the pencil / "I'm bad at writing" / the car-ride story] is the most accurate description of that gap I've read, and it's the exact problem I've spent the last year building for.
>
> I'd rather show you the limitation than the feature, so: the app's AI helper has two buttons. One hands your child three opening sentences. The other gives three questions — and there's deliberately no way to paste an answer in, so they have to think of it and type it themselves. And the illustrate button doesn't work on an empty page.
>
> What it does *not* have, before you find out the annoying way: no dyslexia font, no voice input, no high-contrast mode on the iPad app. Those exist on the web version only.
>
> If you'd want to try it: a year comped, plus I'll print [child's name if they use it publicly, otherwise "your kid's"] finished book as a real hardcover and post it to you — US addresses only for now. No script, no approval on what you say, and I'd want you to label it as gifted. Happy to just send it with no post at all if you'd rather kick the tyres first.
>
> — [name], I build the thing

**Template 2 — teacher / SLP creator**

> Hi [name] — I saw your [specific thing: narrative-language group / writer's workshop setup / the post about collecting 28 pieces of writing]. I built a writing tool and I want to be upfront that the teacher side is web-only, so please don't download the App Store app expecting a class dashboard. It isn't in there.
>
> What it does: you make a class, get a six-character code (no O, no zero, no I, no one, because you're reading it aloud), and students submit without logging in. Books arrive text-only — illustrations get stripped on the way in, which most teachers seem to prefer.
>
> Real limits before you'd try it with a group: your class list lives in whatever browser you made it in, submissions are capped around 20 per hour from one network, and there's no rubric, comment box, or export. And nothing has been through a student-data privacy review — no DPA, no FERPA attestation — so if your district requires one, this isn't there yet. Small group or a co-op is the realistic fit today.
>
> Happy to comp you the Teacher plan for a year with zero expectation of a post. If you do post, I'd want it labelled as gifted. Either way I'd genuinely like to know what breaks.

**Template 3 — homeschool co-op leader**

> Hi [name] — the [specific: multi-age writing block / the post about the 9-year-old who narrates but won't write] caught me, because that's the whole reason this exists.
>
> Short version: it's a writing app where the child types every word. The AI can hand them a first sentence or ask them a question — it can't write the story, and the illustrate button is greyed out until the page has words on it. It ends in a real printed book, which is the part that seems to matter most for a co-op showcase.
>
> Two things you'd want to know: the free tier saves one book, so it doesn't scale across a group on your account — there are no student seats. And printing is US-only right now.
>
> I'd like to comp you a year and print one finished book for your family, free. No brief, no approvals, label it as gifted. And if it doesn't fit your co-op, telling me why is worth as much to me as a post.

**Follow up once, after 7 days, in one line:** *"No worries if it's a no — just closing the loop so I'm not sitting in your requests."* Never follow up twice.

---

## 6. Comment and DM response templates

Short enough to paste, specific enough to be true. Every number below is verified in code.

---

**1. "How much is it?"**

> Depends where you're using it. On iPad/iPhone the subscription price shows in the App Store when you subscribe — it's an Apple subscription, so you cancel in Settings, no email to me.
>
> On the web at mybooklab.app: Free is $0 and gets you 1 saved book, 3 Story Buddy uses a day and 2 AI illustrations a day. Family is $6.99/month or $54.99/year. Teacher is $13.99/month or $109.99/year with a 14-day trial.
>
> Printing is separate and one-off — you're never subscribed into a book you didn't order.

*(Never quote a dollar figure for the iOS subscription. It comes from RevenueCat at runtime — `PaywallView.swift:166` — and the repo number is the web/Stripe price.)*

---

**2. "What age is it for?"**

> Roughly 6 to 12 is the sweet spot, and it adapts. Story Buddy is told your child's age and switches to simpler words and shorter sentences at 7 and under. The free-text chat with the helper is hidden entirely below age 9 — younger kids only get the two tap buttons.
>
> On the web version the interface itself changes: ages 4–7 get bigger text, bigger buttons, a 100-character page limit and a 12-page book; 8+ get 500 characters and up to 24 pages.
>
> Under about 6 it's a together activity, not a solo one — the typing is real typing.

---

**3. "Is it safe? Where does my child's writing go?"**

> Straight answer. When your child asks the helper for ideas, the text of their story is sent to the AI to generate the suggestion, and it's run through a content-moderation check on the way. The instructions to the AI hard-code that nothing scary, violent or inappropriate comes back, and that it ignores any attempt — including from your child — to change its role.
>
> Books stay private on your child's shelf unless someone deliberately publishes one to the public gallery, which is its own separate action. Buying anything, and any access to the camera or photo library, sits behind a maths problem a seven-year-old isn't going to solve. If you use the photo-to-cartoon feature, the original photo is never stored — only the cartoon is kept.
>
> No ads, no analytics tracker, no data sold. The app's privacy manifest declares no cross-app tracking.
>
> What I won't tell you is that it's impossible for an AI to say something unexpected. It's constrained, moderated and rate-limited, and I'd rather say that plainly.

---

**4. "Does the AI write the story?"**

> No, and it's structural rather than a promise. On the iPad app the helper has exactly two buttons. "Give me ideas" returns three opening sentences — one short sentence each — and your child taps one and keeps writing. "Help me think" returns three questions about their own story, and there is deliberately no button to insert an answer. They have to think of it and type it. The page itself is a plain text box: no autocomplete, no suggested continuation.
>
> Two things to be straight about. From age 9 a child can unlock a free-text chat, and a reply from that chat *can* be added to the page — it's capped to a few sentences and steered toward ideas, but a determined 11-year-old could lean on it. Under 9 that chat isn't in the interface at all. And the *website* version has a "Write for Me" mode that writes a full paragraph. It's not in the App Store app.
>
> Best test: open it yourself and press the buttons. Free tier lets you build a whole book. Ten minutes and you'll know.

---

**5. "Do you have an Android version?"**

> Not right now — it's iPhone and iPad, or any browser at mybooklab.app.
>
> The web version actually has some things the iPad app doesn't (voice-to-text dictation, a dyslexia font, a focus mode), so on an Android tablet in Chrome you'd get a real version of the product, just not a native app. I don't have an Android date and I'd rather not invent one.

*(Do not mention the retired Capacitor shell. Do not say "coming soon.")*

---

**6. "Do you have school or district pricing?"**

> Honestly, no — and I'd rather tell you that than take you through a call. There's no invoicing, no PO, no quote, no per-seat licence and no district billing in the product. It's Stripe self-serve on a personal card: Teacher is $13.99/month or $109.99/year with a 14-day trial.
>
> Be clear-eyed about what that buys, too. The Teacher plan is *your* account — unlimited books, unlimited Story Buddy, 200 illustrations a day, PDF export and the classroom dashboard. There are no student seats. Each student needs a free account to save a book, and free is capped at one saved book. So realistically it fits a small group, a resource room, a co-op, or one book per student per term — not unlimited class-wide writing on your subscription.
>
> Also: the teacher side is web-only at mybooklab.app/teacher. The App Store app has no teacher section at all.

---

**7. "What's your refund policy?"**

> Two different things, so:
>
> **Subscriptions.** If you subscribed on iPhone or iPad it's an Apple subscription — you cancel in Settings, and refunds go through Apple, not me. On the web it's Stripe; cancel any time and email support@mybooklab.app if something went wrong.
>
> **Printed books.** If an order fails on our side before it reaches the printer, it's refunded automatically — that's built in, you don't have to chase it. Once a book is actually at the printer it's a custom one-off with your child's name on it, so it isn't restockable. If something arrives wrong or damaged, email support@mybooklab.app with the order number and a photo and I'll sort it.
>
> If you're unsure, build a book on the free tier first. It costs nothing and it's the whole product.

*(Verified: `api/print-orders/refund.js` is an internal worker endpoint that auto-refunds on fulfilment failure. There is **no** customer-facing self-serve refund button — do not imply one exists. `submit-to-lulu.js` fires a refund automatically when submission fails.)*

---

**8. "Does the printed book ship to my country?"**

> **If they're in the US:**
> > Yes. Softcover $19.99, hardcover $39.99, flat $4.99 shipping, 1 to 10 copies per order. It ships from the print partner — I don't publish a delivery estimate because I don't want to promise a date I don't control.
>
> **If they're anywhere else:**
> > Not yet, and I'll be straight about it: printing is US shipping only right now. The checkout rejects a non-US address outright rather than taking your money and figuring it out later.
> >
> > Everything else works wherever you are — writing, illustrating, drawing, the reader, read-aloud. It's just the physical book that's US-only. I don't have a date for other countries and I'd rather not make one up. If you want, tell me your country and I'll come back to you when it changes.

*(Verified: `api/print-orders/create.js:96` — `if ((shipping.country ?? 'US') !== 'US') return bad(400, 'US shipping only in v1')`. Quantity bounds 1–10 at `create.js:90`. Prices from `lib/print/pricing.js`. Flat $4.99 at `create.js:11`. **The iOS app displays hardcover at $34.99 while the server charges $39.99 — fix this before answering any print price question publicly.**)*

---

### Two bonus templates you will need

**When someone volunteers a photo of their child:**

> Thank you — genuinely, that made my day. I'm not going to save or post it though: I have a hard rule that no child's face or full name ever goes on this account, no exceptions and no case-by-case. What I'd love instead, if you're up for it, is a photo of just the *book* — the cover, or a page. No faces, no names. That's the shot that actually convinces other parents anyway.

**When someone reports something the AI said that they didn't like:**

> Thank you for telling me, and I'm sorry. Can you send me a screenshot and roughly when it happened? I want to see the exact wording. Every prompt goes through a moderation check and the AI's instructions rule out anything scary or inappropriate, but constrained isn't the same as impossible, and I'd rather see the failure than believe it can't happen.

---

## Appendix — three things to fix before this playbook runs at full volume

1. **The hardcover price mismatch.** `PrintOrderView.swift:38,117` shows $34.99; `lib/print/pricing.js:2` charges $39.99. Blocks Sequence 7 and question 6.
2. **The paywall over-claims.** `PaywallView.swift:113` advertises "Voice input & read aloud" (no voice input exists on iOS) and `:114` advertises "Up to 4 kid profiles" (no profile model exists anywhere in the repo). If a creator screenshots the paywall in a gifted post, you have published both claims yourself.
3. **The mascot assets are missing from the iOS catalog.** Every mascot imageset in `Assets.xcassets` declares empty slots, so the shipping app renders emoji. Drop the art in before any Story implies the drawn character appears in-app, and before you brief a creator who will film their own screen.

