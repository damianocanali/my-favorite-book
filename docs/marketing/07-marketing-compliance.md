# Marketing Compliance & Claim Guardrails

# Marketing Compliance & Risk Guardrails — My Book Lab

**Scope:** paid and organic social, landing pages, App Store metadata, creator partnerships.
**Governing constraint:** the end user is a child, the buyer is a parent, and the audience is disproportionately parents of children with an ADHD, dyslexia, or dysgraphia diagnosis. Every claim in this category is read by a parent who has already been burned, and by regulators who treat health-adjacent claims about children as the highest-risk category there is.

Everything below is checked against the repo. File:line citations are load-bearing — if a line moves, re-verify before you rely on it.

---

## 0. Five things to fix in the product before the campaign runs

These are not copy problems. They are shipped over-claims that make honest marketing impossible, and three of them are in the app a reviewer or a journalist can open.

| # | Issue | Location | Why it blocks the campaign |
|---|---|---|---|
| 1 | Paywall claims **"Voice input & read aloud"** | `ios-native/MyBookLab/Views/PaywallView.swift:113` | There is no speech recognition anywhere in `ios-native/`. A paid feature list that names a feature that doesn't exist is a consumer-protection problem and an App Review 2.3.1 problem. Pull the line. |
| 2 | Paywall claims **"Up to 4 kid profiles"** | `ios-native/MyBookLab/Views/PaywallView.swift:114` | No profile model, table, or switcher exists in `ios-native/`, `src/`, or `api/`. This is a paid-benefit claim with zero implementation. Pull the line. |
| 3 | **Hardcover price mismatch** — app displays $34.99, server charges $39.99 | `ios-native/MyBookLab/Views/PrintOrderView.swift:117` vs `lib/print/pricing.js:2` (`hardcover: 3999`) | This is a live billing/display defect, and the *approved positioning brief itself* repeats $34.99 in two objection answers and a differentiator. Any ad quoting $34.99 is a documented price misrepresentation. **Freeze all print pricing in creative until this is fixed**, then quote $39.99 + $4.99 shipping. |
| 4 | **Microphone purpose string for a non-existent feature** | `ios-native/project.yml:82` → `Info.plist:58-59`: *"Used to dictate your story when you tap the microphone button."* | Apple rejects unused purpose strings, and it corroborates the false voice-input claim. Delete it. |
| 5 | **Public gallery exposes a child's first name + age with no auth** | `api/publish-book.js:51,60` — the `featured` and `recent` selects both return `author_name,author_age` on an unauthenticated GET | Independent of marketing, this is the single riskiest data surface in the product. For marketing it means: **never screenshot the live gallery.** Doing so republishes a real child's first name and age into a paid ad. |

Add a sixth, lower-urgency: the privacy policy is out of sync with the code in four places (§1.4).

---

## 1. Advertising to and about children

### 1.1 The structural fact: child user, adult buyer

This is a **mixed-audience** product with an **adult purchase decision**. That distinction drives everything:

- **All paid media should be targeted to adults (18+ / 25-54), and should read as parent-facing.** Never buy against interests, creators, or placements whose audience skews under 13. Never run creative in which a child is the addressee ("Hey kids — make your own book!").
- **Keep the two funnels separate.** Parent funnel → App Store. Educator funnel → `mybooklab.app/teacher` in a browser. The iOS app has no teacher or classroom surface at all — an educator who taps an App Store CTA will churn loudly and publicly.
- **CARU (Children's Advertising Review Unit) self-regulatory guidelines** attach to advertising *directed to* children under 13, not to advertising *about* a children's product. Staying adult-addressed keeps you out of CARU's scope entirely. That is the cheapest compliance win available. Do not spend it by making a "for kids" Reel.
- **Do not use child-directed persuasion techniques** even in parent-facing creative: no countdown timers, no "limited spots", no artificial scarcity. The ICP brief already flags these as bounce triggers; they are also the exact patterns regulators look at first.

### 1.2 COPPA — what it actually covers, and what it doesn't

COPPA (15 U.S.C. §§6501-6506; 16 C.F.R. Part 312) is **a data-collection statute, not an advertising-claims statute.** It does not police whether your ad copy is truthful — that's FTC Act §5. What COPPA polices is:

> An operator of a website or online service **directed to children under 13**, or with **actual knowledge** it collects personal information from a child under 13, must give notice and obtain **verifiable parental consent** before collection, use, or disclosure.

Two consequences that bite marketing specifically:

**(a) "Personal information" includes persistent identifiers.** Cookies, device IDs, and advertising IDs used to serve behavioural ads are personal information under the Rule. There is a narrow internal-operations exception for persistent identifiers used *solely* to support internal operations — and **behavioural/targeted advertising is expressly outside that exception.**

**(b) The FTC finalised amendments to the COPPA Rule in early 2025** that, among other things, require **separate verifiable parental consent** for disclosing children's personal information to third parties for targeted advertising, and tighten retention limits. Confirm the current compliance dates with counsel before relying on any specific date — but the direction is unambiguous: retargeting a child-directed surface is getting harder, not easier.

**(c) Actual knowledge is a trap you are currently walking toward.** The wizard's first step collects the author's name and an optional age (`ios-native/MyBookLab/Views/CreateBookView.swift:170,199-209`; the age flows to `api/story-buddy.js:48` where it is clamped 4-18). If a user tells you they are 8, you now have actual knowledge. That is fine for the app's own functionality; it is **not** fine if a marketing pixel is firing on the same page.

### 1.3 The pixel audit — what's actually on the site today

I grepped `index.html`, all of `src/`, and `public/` for every mainstream tracker and pixel: `gtag`, `googletagmanager`, `google-analytics`, `fbq`, `connect.facebook.net`, TikTok, Mixpanel, PostHog, Amplitude, Segment, Hotjar, Clarity, Plausible, Fathom, DoubleClick, Snap, Pinterest, LinkedIn, `@vercel/analytics`, `@vercel/speed-insights`, and dynamic `document.createElement('script')` injection.

**Result: zero tracking pixels. Zero analytics SDKs. Zero dynamic script injection.**

- `index.html` (whole file, 30 lines) loads exactly three external resources: `fonts.googleapis.com`, `fonts.gstatic.com`, and `fonts.cdnfonts.com` (the OpenDyslexic stylesheet). No script tag other than `/src/main.jsx`.
- `package.json:19-50` — no analytics or advertising dependency. The only third-party runtime SDKs are Supabase, Stripe, RevenueCat, and Capacitor.
- iOS side: `ios-native/MyBookLab/PrivacyInfo.xcprivacy:11-16` declares `NSPrivacyTracking = false` with an empty `NSPrivacyTrackingDomains` array.

**This is a genuine, verifiable, differentiating asset. Protect it.**

The only matches the grep returned were false positives: `segmentsForPage` in `src/lib/storyBuilder.js:28`, a `'pixel'` art-style id in `src/pages/AvatarPage.jsx:99`, and a code comment in `src/services/purchaseService.js:101`.

### 1.4 What this means for retargeting — the practical rules

You currently have **no** first-party pixel data and **no** on-site conversion signal. Before anyone "just adds the Meta pixel," understand what it costs:

**Rule 1 — Never fire a third-party advertising pixel on any authenticated surface.**
`mybooklab.app` is a single origin where the marketing landing page and the child's writing editor share a domain. A site-wide Meta or TikTok pixel would fire while a child is logged in and writing. Under COPPA that is disclosure of a persistent identifier for targeted advertising, from a service you have actual knowledge is used by under-13s, without verifiable parental consent. Do not do it.

**Rule 2 — If you must measure, scope it to marketing-only routes and use server-side conversions.**
Acceptable pattern: a pixel or CAPI event that fires only on unauthenticated marketing routes (`/`, `/pricing`, `/privacy`) and on the *purchase* event keyed to the **parent's** billing email from Stripe. Never build a custom audience or lookalike seeded from in-app child sessions.

**Rule 3 — Your own privacy policy currently forbids the normal retargeting stack.**
`src/pages/PrivacyPage.jsx:72` states: *"We do not use advertising networks, analytics trackers, or sell data to third parties."* Uploading a hashed customer list to Meta for a lookalike is, at minimum, in tension with that sentence and arguably a disclosure to an advertising network. **You must either (a) keep the promise and forgo pixel-based retargeting, or (b) rewrite the policy first and then run it.** Running paid retargeting against a live policy that says you don't is an FTC Act §5 deception claim on a silver platter — and it's the one thing that would actually hurt, because "no trackers" is a headline promise to this exact buyer.

My recommendation: **keep the promise.** For this ICP, "no ads, no trackers, nothing sold on" is worth more as copy than as targeting data. Run the campaign on creative, broad interest targeting, and App Store / Stripe-side conversion reporting.

**Rule 4 — Four fixes needed in the privacy policy before any paid media runs.** These are code/policy mismatches I verified:

| Policy line | What the code says | Action |
|---|---|---|
| `PrivacyPage.jsx:41` — *"We collect anonymous usage statistics (pages created, features used)"* | Nothing collects this. No analytics exists anywhere. It also directly contradicts line 72 in the same document. | **Delete the line.** Do not implement it to match. |
| `PrivacyPage.jsx:68-70` — third parties listed as Supabase, Stripe, Together AI | Incomplete. `api/story-buddy.js:8` sends story text to `api.anthropic.com`; `api/_aiGuard.js:109` sends prompt text to `api.openai.com/v1/moderations`; RevenueCat processes iOS subscriptions. | **Add Anthropic, OpenAI, and RevenueCat.** The parent-facing objection answer already truthfully says story text goes to Anthropic — the policy must say so too, or the ad copy is more candid than the legal doc. |
| `PrivacyPage.jsx:87` — *"delete their account… by contacting us"* | Self-service deletion ships with a 7-day grace period: `api/delete-account.js`, `api/cancel-deletion.js`, `AccountView.swift:365-411`. | **Update — this is a good-news correction** and a proof point you can market. |
| `PrivacyPage.jsx:38` — "Voice data" section | Voice input is web-only (`src/hooks/useSpeechRecognition.js`). Accurate as written, but scope it to the web app so it doesn't imply an iOS feature. | Add "(web app only)". |

**Rule 5 — Non-US audiences.** The ICP includes UK, CA, AU. The **UK ICO Children's Code** (Age Appropriate Design Code) applies to services likely to be accessed by children in the UK and sets profiling and behavioural advertising **off by default**. Your current zero-tracker posture already satisfies it. Adding a pixel would put UK traffic in scope. Factor that in before anyone argues for "just for a two-week test."

**Rule 6 — If the app is in the Apple Kids Category**, third-party analytics and third-party advertising are **prohibited outright**, and every external link and purchase must sit behind a parental gate. I cannot determine category membership from the repo — it lives in App Store Connect. **Confirm this before any measurement discussion**, because if you're in Kids, Rules 1-4 stop being judgment calls and become policy violations that get the app pulled.

---

## 2. Claim substantiation — the ADHD / dyslexia / UDL line

### 2.1 The line, stated once

> **You may describe what the software does. You may not describe what it does to a child.**

A **design claim** describes a mechanism a parent can verify by opening the app in ten minutes. It is substantiated by the code.

An **efficacy claim** asserts an outcome in a child — better writing, better focus, better reading, reduced anxiety, improved confidence, a clinical benefit. It requires **competent and reliable scientific evidence** under the FTC's substantiation doctrine. For claims that touch a diagnosed condition (ADHD, dyslexia, dysgraphia), the FTC's expectation moves toward the standard it applies to health claims — which in practice means human trials, not testimonials and not a plausible mechanism.

**There is no efficacy data for this product. None. Not a pilot, not a survey, not a teacher case study.** Therefore: **zero efficacy claims, in any channel, from anyone, including creators and including the founder in a comment reply.**

Two things people reach for that do **not** rescue an efficacy claim:
- A "results may vary" or "not typical" disclaimer. Under the FTC's Endorsement Guides, a disclaimer does not cure an unsubstantiated claim; it only addresses atypicality of an otherwise-substantiated one.
- Hedging verbs. "Can help," "may improve," "designed to boost focus," and "supports reading development" are all read as efficacy claims. Softening the verb does not change the net impression, and net impression is the legal test.

### 2.2 The three-bucket test — run this on every sentence

1. **Can I point at a file and line that makes this sentence true?** → Design claim. Ship it.
2. **Does this sentence describe something that happens inside the child?** → Efficacy claim. Cut it, no exceptions.
3. **Is it true on one platform but not the other?** → Scope it explicitly ("in the web app" / "on iPad"). Unscoped cross-platform claims are the single most common failure mode in this product's existing marketing.

### 2.3 Rewrite table

| # | Risky claim (and where it currently lives) | Why it's a problem | Safe rewrite | Evidence |
|---|---|---|---|---|
| 1 | **"ADHD & Dyslexia Friendly"** as a feature-card headline — `src/pages/LandingPage.jsx:176` | Condition-branded headline reads as a therapeutic claim; and the four supports it lists (sentence starters, word banks, progress maps, gentle nudges) are **all web-only**. | "Built for the kid who stalls at the blank page. In the web editor: tap-to-insert sentence starters that change with where you are in the story, a word bank of feelings and actions, a dot-map of which pages are written, and a gentle prompt after 15 seconds of a blank page." | `src/components/editor/WritingScaffold.jsx:6,18-30,56-137`; `src/lib/sentenceStarters.js:5-72,77-88`; `src/components/editor/StoryProgressMap.jsx:15-78`. None exist in `ios-native/`. |
| 2 | **"support UDL and WCAG standards"** — `LandingPage.jsx:178` | A standards-conformance claim with no audit, no VPAT, no conformance report, and no standards mapping anywhere in the repo. This is the most legally exposed sentence on the site. | "Designed with Universal Design for Learning principles in mind. We haven't completed a formal accessibility audit — here's exactly what ships, so you can judge it against your own framework." | No audit artefact exists in the repository. |
| 3 | **"follows … WCAG/COGA accessibility guidelines"** — `LandingPage.jsx:199` | Same as above, stated more strongly. "Follows guidelines" is a conformance assertion. | Delete. Replace with a list of the actual controls and let the reader evaluate. | — |
| 4 | **"high contrast mode"** — `LandingPage.jsx:178` | **The feature does not exist.** `src/stores/useAccessibilityStore.js:7-8` contains exactly two flags: `dyslexiaFont` and `focusMode`. | Delete entirely. Do not replace. | `src/stores/useAccessibilityStore.js:7-8` |
| 5 | **"Adjustable fonts"** — `LandingPage.jsx:178` | Implies a user-facing size control. Font *size* is derived automatically from the author's stated age and is not user-adjustable. | "A dyslexia-friendly font toggle (OpenDyslexic) sits above the writing area in the web editor — one tap, not buried in settings." | `src/stores/useAccessibilityStore.js:7`; `src/components/editor/AccessibilityToolbar.jsx:59-65`; font loaded `index.html:25`; mapped `tailwind.config.js:62`. Size logic: `src/hooks/useAgeAdaptive.js:4-35`. |
| 6 | "Helps children with ADHD focus" / "keeps kids focused" | Pure efficacy claim about a diagnosed condition. | "The task has an end. For an author aged 7 or under, a book is capped at 12 pages and 100 characters a page. There's an 'I'm done writing' button, not a feed." | `src/hooks/useAgeAdaptive.js:4-35`; `ios-native/MyBookLab/Views/CreateBookView.swift:98-109` (6 terminal steps) |
| 7 | "Improves writing / reading scores" / "3x more writing" | Unsubstantiated quantified outcome claim. Also invented — no such data exists. | Never make an outcome claim. Substitute a mechanism: "Your child types every word that ends up in the book." | `ios-native/MyBookLab/Views/StoryBuddyView.swift:29-32,104-108` |
| 8 | "Dyslexia font" / "OpenDyslexic" **in any post featuring the iOS app** | Grep for "dyslex" across `ios-native/` returns nothing. Given the dyslexia-targeted audience, this is the most damaging over-claim available. | Scope it: "in the web app at mybooklab.app." If the post shows an iPad, don't mention it at all. | `src/stores/useAccessibilityStore.js:7`; absent from `ios-native/` |
| 9 | **"gives ideas, not answers"** — `LandingPage.jsx:173` | True of the iOS app. **False of the web app**, which ships a "Write for Me" button that generates a 2-4 sentence paragraph. Stating it on the web landing page is contradicted by the button one click away. | iOS: "Story Buddy has two buttons. Neither one can write your child's story." Web: "Three helpers. Two of them only ask questions or hand over one opening line. The third writes a paragraph and the button says 'Write for Me' — decide with your family whether that one's allowed." | `ios-native/MyBookLab/Views/StoryBuddyView.swift:29-32`; `api/story-buddy.js:11-41` (three intents); `src/components/editor/StoryBuddy.jsx:9,34-36` |
| 10 | **"track writing progress"** for teachers — `LandingPage.jsx:177` | No classroom progress tracking exists. Teachers get a gallery of submitted books and nothing else — no rubric, grade, comment, export, or per-student view. | "Make a class, get a six-character code, write it on the board. Finished books land in one gallery you open on the projector. Text only — illustrations are stripped on submission." | `api/classroom.js:39-93`; `api/classroom-submit.js:44-46` (nulls `coverImage` and `illustrationData`); `src/pages/ClassroomPage.jsx:62-176` |
| 11 | **"2 books" on the free plan** — `LandingPage.jsx:231` | The enforced limit is 1. | "1 free book." And note it is **not enforced on iOS at all** — no `maxBooks` check exists in `ios-native/`, so don't promise a free-tier cap on iOS either. | `src/lib/plans.js:8` (`maxBooks: 1`); `src/pages/CreatePage.jsx:138-181` |
| 12 | **"Hardcover $34.99"** — `PrintOrderView.swift:117`, and in the approved positioning brief | The server charges $39.99. Quoting the lower price in an ad is a price misrepresentation. | Fix the app, then say "$39.99 hardcover, $19.99 softcover, flat $4.99 US shipping, US only, 1-10 copies." | `lib/print/pricing.js:2` (`hardcover: 3999`); `api/print-orders/create.js:90,96` |
| 13 | "Works offline" | True on web (zustand `persist`). **False on iOS** — the draft lives only in memory and the shelf reads straight from Supabase. | "On the web, books you write are kept in your browser. On iPad, books sync once you save them." | `src/stores/useBookStore.js:32-33`; `src/stores/useBookshelfStore.js:11-12`; `ios-native/.../BookDraftStore.swift` (no persistence); `BookshelfStore.swift:30-37` |
| 14 | **"COPPA compliant"** as a badge | COPPA has no certification. There is a safe-harbour program, and you are not in one. | "Our stated policy: we don't knowingly create accounts for under-13s without parental consent." Attribute it as policy, not status. | `src/pages/PrivacyPage.jsx:27-29` |
| 15 | "Every prompt is checked before it reaches the AI" | The moderation call **fails open**: if `OPENAI_API_KEY` is unset or the request errors, `moderatePrompt` returns `null` and the prompt proceeds. | "Prompts are screened by a content-moderation service before they reach the model, and blocked with a kid-safe message." Drop the absolute. | `api/_aiGuard.js:102-127`, esp. `104-107` (`if (!key) … return null`) and the `catch` at 125-128 |
| 16 | "Classroom mode" in **App Store** copy or an App Store-CTA post | No teacher or classroom surface exists in `ios-native/`. `APIClient.swift` never calls `/api/classroom`. | Route educators to `mybooklab.app/teacher` in a browser. Never end an educator asset on "Download on the App Store." | `src/App.jsx` routes `/teacher`, `/classroom/:code`; absent from `ios-native/Views/` |
| 17 | "20 badges to collect" **on iOS** | 20 in the catalog, but only 11 are reachable from iOS code. | "20 badges in the app — 11 of them earnable from the iPad app alone." Or just: "Badges are for effort and finishing, never for writing well." | `ios-native/MyBookLab/Stores/RewardsStore.swift:24-51`; `earn(...)` call sites in `CreateBookView.swift:123-131,737,745,877,904` and `RewardsStore.swift:104-106` |
| 18 | "Voice input" anywhere on iOS | No `SFSpeechRecognizer`, no `AVAudioEngine` capture in `ios-native/`. | Web only, and say so. Remove `PaywallView.swift:113`. | `src/hooks/useSpeechRecognition.js:14-54`; nothing equivalent in `ios-native/` |

### 2.4 The four phrases that are always safe

Memorise these; they cover most of what you'll want to say.

1. **"Designed for…"** / **"Built with X in mind"** — describes intent, not outcome.
2. **"Includes a [feature] option"** — describes what ships.
3. **"Here's exactly what happens when you tap it"** — describes mechanism. Strongest with this ICP.
4. **"Open it yourself before your child does"** — invites verification. Not a claim at all, and it converts better than any claim would, because the product survives inspection.

### 2.5 The one phrase to retire completely

**"Reluctant writer."** It's the category's default term and it's a deficit framing of the child. The ICP brief is explicit that copy implying laziness or defiance is instantly disqualifying with the gentle-parenting audience. Use "stuck," "stalls at the start," or describe the behaviour instead.

---

## 3. AI disclosure

### 3.1 What's actually true — verified

- **Illustrations and avatars are AI-generated.** Images come from Together AI (`api/generate-image.js:9`, `api/generate-avatar.js:9`, `lib/print/upscale.js:9` → `api.together.xyz/v1/images/generations`).
- **Story Buddy is an LLM.** Story text is sent to Anthropic (`api/story-buddy.js:8` → `api.anthropic.com/v1/messages`).
- **Prompts pass through OpenAI's moderation endpoint** before reaching either model (`api/_aiGuard.js:109`) — with the fail-open caveat in §2.3 row 15.
- **The child writes the words.** On iOS the page is a bare SwiftUI `TextEditor` with no autocomplete and no ghost text. Story Buddy exposes exactly two intents — starters and questions — and the question cards are rendered with no insert action at all (`StoryBuddyView.swift:29-32,104-108,299-312`). The API's `paragraph` intent exists but the iOS client never calls it.
- **On the web, "Write for Me" does generate a paragraph** (`src/components/editor/StoryBuddy.jsx:9,34-36`; `api/story-buddy.js:19-29`). There is no teacher or parent switch to disable it.
- **Illustration is gated on the child's own text:** the Illustrate button carries `.disabled(… || currentPageText.isEmpty)` (`CreateBookView.swift`), so an empty page cannot be illustrated.
- **The app already labels its own output** as "AI-generated — may not be perfect" (`src/components/editor/PageEditor.jsx:105-107`).

### 3.2 The framing rule

> **The AI illustrates. The child writes. Say both, in that order, every time.**

The single most damaging thing you can do to this brand is let a post imply the AI is co-authoring. It's false on iOS, it's the exact fear the ICP names as her top objection, and it converts a differentiator into a liability. Conversely: **volunteering the limitation is the fastest trust-builder available with this buyer.** "It can't write the story — we took that out" outperforms any capability claim.

### 3.3 Disclosure lines — use verbatim

**Standard caption line (any post showing an illustration):**

> Illustrations in this app are AI-generated from the sentence the child wrote. The writing is the child's — Story Buddy can offer a first sentence or ask a question, and on iPad it can't write the story.

**Short form (Stories, Reels overlay, character-limited):**

> Pictures: AI, made from what the child wrote. Words: the child's.

**When a post shows the web editor (must be stricter — "Write for Me" exists):**

> Illustrations are AI-generated. In the web editor, Story Buddy has three modes: two give ideas or questions, and a third — labelled "Write for Me" — will draft a paragraph. On the iPad app that third mode doesn't exist.

**When a post shows a hand-drawn page:**

> Drawn by hand with an Apple Pencil, no AI involved. It's uploaded at print resolution and goes into the printed book.
> *(Verified: `DrawingCanvasView.swift:12-14` exports at 1536×1024; `CreateBookView.swift:865-881` uploads a real URL.)*

**When the marketing asset itself is AI-generated** (a generated background, a generated voiceover, a synthetic scene):

> This image/voice was made with AI.

### 3.4 Hard AI rules

1. **Never AI-generate a "child's book page" and present it as a real child's work.** That is a fabricated testimonial and it crosses from AI disclosure into the FTC's fake-review rule. Use the shipped demo book — "Theo and the Star Bear," 12 illustrated pages, designed to be shown publicly (`ios-native/MyBookLab/Models/SampleBook.swift:33-70`).
2. **Never speed-ramp AI generation.** Illustration takes real time. Compressing it misrepresents performance.
3. **Never say "AI-powered" as a headline benefit.** It reads to this buyer as "the computer does it." Lead with the mechanism.
4. **Platform labelling.** Meta and TikTok both require disclosure of AI-generated or materially AI-altered realistic content and apply their own labels. My Book Lab's illustrations are stylised cartoons rather than photorealistic, so the strict photorealism triggers may not attach — but **use the platform's AI-content toggle anyway.** Being labelled by the platform after the fact is worse than labelling yourself, and self-labelling is on-brand for a product whose entire pitch is "we tell you what it does."
5. **Never claim the moderation is absolute.** "Constrained, moderated, and rate-limited" is the honest and already-approved framing. It fails open (§2.3 row 15).

---

## 4. Testimonials, endorsements, and a gifting campaign

### 4.1 The two rules that govern everything here

**16 C.F.R. Part 255 — Endorsement Guides (revised 2023).** Any **material connection** between the brand and an endorser must be **clearly and conspicuously** disclosed. Material connection includes money, free product, free subscription, a discount code, affiliate commission, a contest entry, or a personal/employment relationship.

**16 C.F.R. Part 465 — Rule on the Use of Consumer Reviews and Testimonials (in force since late 2024).** This one carries **civil penalties per violation**. It prohibits: fake or AI-fabricated reviews; buying positive reviews; **incentivising reviews conditioned on their sentiment**; insider reviews (employees, founders, family) without clear disclosure; suppressing negative reviews; and buying followers or engagement.

### 4.2 Applied to a gifting campaign

**Gifting is a material connection.** A free lifetime subscription, a free print credit, or a free hardcover is compensation, whether or not cash changes hands. It must be disclosed in every post that results from it, indefinitely.

**Do this:**

- **Written brief before shipping anything.** Every gifted creator signs a one-page agreement containing: (a) the disclosure requirement and approved wording; (b) the "no efficacy claims" rule with examples; (c) the child-imagery rule; (d) a statement that they may post honestly, including negatively.
- **Never condition the gift, or any future gift, on a positive post.** Do not write "in exchange for a positive review," do not say it on a call, do not imply it. This is the Part 465 trigger and it carries penalties.
- **Disclosure must be in the content, not only in the caption.** For a Reel: on-screen text **and** spoken in the first few seconds. A disclosure below the "more" fold is not clear and conspicuous. The FTC has said explicitly that **platform tools like Instagram's "Paid partnership" label are not sufficient on their own.**
- **Approved wordings:** `#ad`, `#sponsored`, "Paid partnership with My Book Lab", "My Book Lab gave me a free subscription." Place `#ad` **first** in the caption, never buried in a hashtag block.
- **Rejected wordings:** `#sp`, `#collab`, `#partner`, `#thanksmybooklab`, `#gifted` alone, `#ambassador`. Too ambiguous.
- **You are liable for what your creator says.** If a creator says "his reading level jumped," that is your efficacy claim and your §5 exposure. This is why the brief must include the claim rules, and why **someone reviews every post within 24 hours of it going live** and asks for a correction or takedown if a creator has invented a claim.
- **Employees, contractors, the founder, and their families** must disclose in any post or comment. A founder replying "genuinely the best thing we've built" under a review is an undisclosed insider endorsement.
- **App Store reviews are in scope.** Never solicit, incentivise, or gate an App Store review. That is both a Part 465 issue and an App Store Review Guideline 3.2.2 violation.
- **Don't buy followers or engagement.** Explicitly prohibited under Part 465.

### 4.3 On parent testimonials specifically

The single most valuable and most dangerous asset in this campaign is a parent saying what changed for her child.

- **Testimonials about a mechanism are safe.** "He'll actually start now, because there's a first sentence to push off from." Describes behaviour and the feature.
- **Testimonials about an outcome are your claim.** "His writing improved." "His teacher noticed a difference." "It helped his dyslexia." An endorsement can't say what your own advertising can't. If it appears in your feed, in your ad, on your site, or in an ad you boost, **you made that claim.**
- **You cannot fix it with "results not typical."** Without substantiation there is no typical.
- **Practical rule:** when a genuine testimonial contains an outcome claim, edit it out or don't use it. If it's a comment on your own post, leave it (organic UGC you didn't solicit or amplify is different) — but **never screenshot it into creative, never boost that post, and never reply in a way that endorses the claim.**

---

## 5. Child imagery

### 5.1 The default: no children's faces. Ever.

This is already rule 1 of the visual system's shooting rules, and it should stay absolute — no faces in a screen recording, in a reflection on device glass, out of focus in the background, in a photo on a shelf behind the iPad, or in a testimonial graphic. Hands operating a device are permissible only if unidentifiable — no faces, no distinctive marks or jewellery.

**Why this is the right default rather than an over-caution:**

- It removes an entire category of consent risk with no creative cost — the ICP explicitly *doesn't want* stock-photo children; she wants to see a real book with a spelling mistake in it.
- It is congruent with the product's own promise. An app that says "we never store the original photo" and then runs ads full of children's faces is telling on itself.
- It removes any question about whether a competitor, a journalist, or a commenter can reverse-image-search a child in your ad.

### 5.2 If you ever depart from it — the actual requirements

Don't. But if a decision is made above this document:

- **A written release signed by the parent or legal guardian**, not the child. It must be **specific**: named uses (paid social, organic social, website, App Store, press), term (specify — "perpetual" if you need it), territory, and the right to edit. A verbal yes, a DM, or a comment saying "sure!" is not a release.
- **A separate release for each child**, including a creator's own child. A creator agreement does not cover their child's likeness.
- **Jurisdiction matters.** New York Civil Rights Law §§50-51 makes commercial use of a minor's likeness without written parental consent an actionable and criminal offence. California adds Coogan-type requirements when a minor performs for compensation. In the UK/EU, a child's image is personal data under GDPR/UK GDPR with a lawful basis and a high bar for children's data.
- **Never film in a school, classroom, or with an identifiable school in shot.** That adds district permission and FERPA-adjacent obligations on top of individual releases, and the educator funnel doesn't need it. Shoot educator content as the teacher's own screen and hands.
- **Voice counts.** A child's recorded voice is identifying. Same rules.
- **No real names.** The wizard puts a name field on screen at step one (`CreateBookView.swift:170,199-209`). Type a demo name before recording. No real school, class, teacher, or town names in UI or audio.

### 5.3 The gallery landmine — read this before anyone records

`api/publish-book.js:51,60` returns `author_name` and `author_age` on an **unauthenticated** GET for both the featured and recent lists. That means:

- **The live gallery is real children's first names and ages.** Screenshotting or screen-recording it and putting it in an ad republishes a real child's first name and age into paid media, with no consent, no release, and — for any under-13 — a COPPA disclosure question.
- **Hard rule: never film, screenshot, or scroll the production gallery.** If a post needs the gallery, populate a demo account with fictional authors and film that, or composite a graphic.
- **Same rule for the bookshelf, order lists, and order detail.** `OrdersListView` / `OrderDetailView` / `PrintOrderView` contain shipping addresses. Never film a real order.

### 5.4 Parent-submitted UGC

- Get **explicit written permission per post**, via a short form, not a DM reply. State the use and the term.
- **A photo of a child's finished printed book is the best asset in this campaign** — and it doesn't need a face. Hands holding a hardcover. A book on a shelf. A page with a spelling mistake left in. That's the shot.
- Blur or crop any name on a cover before use, or ask the family whether the first name may stay. Get that in writing too.

---

## 6. Apple's marketing rules

Two separate rulebooks apply, and people conflate them:

- **App Store Review Guidelines** govern what's *in* your App Store listing (metadata, screenshots, previews).
- **Apple Identity Guidelines / Marketing Resources** govern how you refer to Apple and use Apple assets *anywhere else* — your ads, your site, your social.

Apple updates both. Pull the current version from Apple's Marketing Resources and Identity Guidelines pages before a launch; specifics below reflect long-standing rules but the numbers move.

### 6.1 The "Download on the App Store" badge

- **Use Apple's official badge artwork, downloaded from Apple's Marketing Resources.** Do not recreate it, retype it, recolour it, outline it, add a gradient, add a drop shadow, rotate it, animate it, or alter its proportions. It comes in black and white variants — pick the one with adequate contrast on your cosmic ground (the white/light variant will read on `#0D0A29`).
- **Maintain clear space around the badge** — Apple specifies a minimum clear space proportional to badge height (historically 1/10 of the badge height on all sides) and a minimum size. Verify current values in the guidelines.
- **The badge must not be the largest element in the layout.** Your app name and your creative are the subject; the badge is the call to action.
- **Never substitute the Apple logo () or the App Store icon for the badge.** Never use the Apple logo in your ads at all.
- **Localise the badge** if you run non-English creative — Apple provides localised versions. Don't translate the English badge yourself.

### 6.2 Wording

| Correct | Wrong |
|---|---|
| "Download on the App Store" | "Download on iTunes", "Get it on the Apple Store", "Available on Apple" |
| "App Store" | "app store", "AppStore", "iTunes App Store", "Apple App Store" |
| "iPad", "iPhone" | "iPads", "iPhones", "iPad's" — Apple product names take no plural or possessive; write "iPad models", "your iPhone" |
| "Made for iPad" / "Works with Apple Pencil" | "iPad app" as a brand name; anything that reads as Apple endorsement |
| "My Book Lab for iPad" | "The Apple iPad app for writing" |

- **The Apple Store** is the retail chain. **The App Store** is the software store. Never mix them.
- **Your app name must be at least as prominent as any Apple product name** in a headline. Never lead a headline with "iPad" in larger type than "My Book Lab."
- **Never imply Apple endorsement, sponsorship, or partnership.** No "Apple loves it," no "Editors' Choice" unless Apple actually awarded it, no invented star ratings, no fabricated "Featured on the App Store."
- **Apple Pencil is a supported claim here** — `DrawingCanvasView.swift:16-140` is real PencilKit with Apple's own tool picker. "Works with Apple Pencil" is accurate. Do not extend to "Apple Pencil Pro" features you haven't implemented.
- **Do not claim Apple Pay.** It's explicitly commented out at `PrintOrderView.swift:296-299`. Card-only via Stripe PaymentSheet.

### 6.3 Device imagery

- **Use only Apple's provided product images**, from Marketing Resources, of **current** shipping models. Don't use a third-party mockup pack, don't use a discontinued device, don't render your own.
- **Don't alter the device image** — no recolouring, no adding a case, no faux-3D perspective. The visual system already mandates straight-on, 0° tilt; that also happens to be Apple's rule.
- **The screen must show your app**, in an accurate, current state. No composited Figma comps, no "coming soon" features, no fabricated light mode — the app forces `.preferredColorScheme(.dark)`, so a light-mode shot would be fabricated.
- **Don't show other companies' apps or content** on the device screen.

### 6.4 App Store listing assets

- **Screenshots and previews must show the app in actual use** and must accurately represent the app (Guidelines 2.3.x). Marketing-only frames, feature claims not in the build, and screens you can't reach in the app are rejection reasons — and, post-approval, a consumer-protection problem.
- **Metadata must be accurate and relevant** (2.3.7). Your current App Store description, if it descends from `STORE_LISTING.md`, contains voice input, OpenDyslexic, focus mode, classroom mode, offline writing, and the old app name "My Favorite Book." **All of those are wrong for the shipping build.** Rewrite the listing against the verified feature set before you drive traffic to it.
- **Don't name other platforms** in App Store metadata (2.3.10) — no "also on Android" (and Android is retired anyway), no "also on the web" phrased as a platform callout in screenshots.
- **Don't reference other purchase mechanisms** in the app or its metadata (3.1.1) — don't point iOS users at Stripe web pricing.
- **iOS subscription pricing is not in the repo.** It comes live from RevenueCat/App Store (`PaywallView.swift:166`, `localizedPriceString`). Any iOS price in an ad must be taken from App Store Connect. The $6.99/mo in `src/lib/plans.js` is the **web/Stripe** price and must be labelled as such.
- **Ads must disclose that the app contains in-app purchases** where the platform requires it, and must not present a paid subscription as free. "Start free" is accurate (`plans.js:5-16`); "free app" without qualification is not.

### 6.5 The App Store badge is a routing decision, not just an asset

Restating, because it's the most likely operational error: **educator creative must never carry the App Store badge.** There is no teacher or classroom surface in `ios-native/`. An educator who downloads the app finds five tabs — Books, Gallery, Create, Orders, Account — and no way to make a class. Educator CTAs go to `mybooklab.app/teacher`.

---

## 7. The 60-second pre-publish checklist

Run top to bottom on every asset. **Any "no" or "not sure" stops the post.**

**Claims (20s)**
1. Does every feature claim in this post have a file I could open right now? If I can't name the file, it doesn't ship.
2. Does any sentence describe a change *inside* a child — focus, confidence, writing, reading, a diagnosis? → Cut it.
3. Do the words "WCAG", "UDL-aligned", "COPPA compliant", "high contrast", "adjustable fonts", "voice input", "kid profiles", "track progress", "2 books", or "$34.99" appear? → Cut or fix.
4. **Platform check:** is every claim in this post true on the platform the post is showing? Dyslexia font, focus mode, word banks, progress map, idle nudges, classroom, offline, PDF, publishing to the gallery = **web only**. Drawing, widgets, Live Activity, shake-for-an-idea, Face ID, Sign in with Apple, alternate icons, Siri = **iOS only**.

**AI (10s)**
5. Does the post show an AI illustration or Story Buddy? → Is the disclosure line present, and does it say the child writes the words?
6. If it shows the **web** editor: does it acknowledge "Write for Me"?

**People (10s)**
7. Any child's face, anywhere in frame — including reflections and backgrounds? → Stop.
8. Any real name, real school, real email, real address, real order, or the **live gallery** on screen? → Stop. Use demo data or "Theo and the Star Bear."

**Endorsement (10s)**
9. Did anyone in this post receive money, product, a subscription, a discount code, or a print credit? → Is `#ad` or equivalent **in the content**, in the first three seconds, and first in the caption — not just the platform label, not below the fold?
10. Does any quoted person make an outcome claim? → Edit it out.

**Platform (10s)**
11. App Store badge: official artwork, unaltered, clear space, and not the biggest thing in frame? "App Store" spelled correctly? No plural or possessive Apple product names? No implied Apple endorsement?
12. Is the CTA routed correctly — **parents → App Store, educators → mybooklab.app/teacher**?

**The 5-second gut check**
13. If a sceptical parent downloaded the app right now, opened it, and pressed the buttons in this post — would she find exactly what I showed her? If there's any gap, that gap is the post's biggest risk, and it's a trust problem before it's a legal one.

---

## Appendix — verification summary

| Question | Answer | Evidence |
|---|---|---|
| Any tracking pixel or analytics on the web app? | **No.** Grepped `index.html`, `src/`, `public/` for gtag, GTM, GA, fbq, Facebook, TikTok, Mixpanel, PostHog, Amplitude, Segment, Hotjar, Clarity, Plausible, Fathom, DoubleClick, Snap, Pinterest, LinkedIn, `@vercel/analytics`, dynamic script injection. Zero hits. | `index.html` (30 lines, only Google Fonts + fonts.cdnfonts.com + `/src/main.jsx`); `package.json:19-50` |
| Any tracking on iOS? | **No.** `NSPrivacyTracking = false`, empty tracking-domains array. | `ios-native/MyBookLab/PrivacyInfo.xcprivacy:11-16` |
| Which third parties actually receive data? | Supabase (auth/db), Stripe (payments), RevenueCat (iOS subs), Together AI (images), **Anthropic** (story text), **OpenAI** (moderation) | `api/generate-image.js:9`; `api/generate-avatar.js:9`; `lib/print/upscale.js:9`; `api/story-buddy.js:8`; `api/_aiGuard.js:109` |
| Does the published privacy policy list all of them? | **No** — Anthropic, OpenAI, and RevenueCat are missing. | `src/pages/PrivacyPage.jsx:68-70` |
| Does the policy claim collection that doesn't happen? | **Yes** — "anonymous usage statistics," contradicted by line 72 and by the code. | `src/pages/PrivacyPage.jsx:41` vs `:72` |
| Is prompt moderation guaranteed? | **No — fails open** if the key is unset or the call errors. | `api/_aiGuard.js:102-127` |
| Are children's names/ages publicly exposed? | **Yes** — `author_name` + `author_age` on an unauthenticated GET. | `api/publish-book.js:51,60` |
| Does a high-contrast mode exist? | **No.** Only `dyslexiaFont` and `focusMode`. | `src/stores/useAccessibilityStore.js:7-8` |
| Free-book limit? | **1**, not 2. Not enforced on iOS. | `src/lib/plans.js:8`; `src/pages/CreatePage.jsx:138-181` |
| Hardcover price? | **$39.99** server-side; app displays $34.99. | `lib/print/pricing.js:2` vs `ios-native/MyBookLab/Views/PrintOrderView.swift:117` |

**Not determinable from the repository — confirm in App Store Connect before any measurement or partnership decision:** whether the app is listed in the **Kids Category** (if so, third-party analytics and ads are prohibited outright), the current App Store privacy nutrition label, and the live iOS subscription prices.

**This is operational guidance, not legal advice.** The COPPA amendment timelines, the Reviews and Testimonials Rule penalty exposure, and any child-likeness release should be reviewed by counsel before a paid campaign of meaningful size goes live.

