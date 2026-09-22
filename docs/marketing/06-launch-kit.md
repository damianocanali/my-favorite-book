# Launch Kit — Press, Product Hunt, Email, Outreach

> **Verification note.** Everything below is written against code I read in this session. Where a claim could not be verified in code, it is marked `[UNVERIFIED — confirm before publishing]`. Three infrastructure facts discovered during this pass change the plan and are flagged inline:
> 1. **No email service is installed anywhere** — `grep` for `resend|sendgrid|postmark|nodemailer` across `api/`, `src/`, `lib/` returns nothing. The email sequence in §4 is a *spec for a system that does not exist yet*, not copy you can schedule tomorrow.
> 2. **The site is a client-rendered SPA with no per-route metadata.** `vercel.json` rewrites `/((?!api/).*)` → `/index.html`, and all OG/Twitter tags are static in `index.html`. Every shared `/view/:slug` link currently previews as the generic "My Book Lab" card with `/icon-1024.png`. This is the single biggest constraint on §7.
> 3. **The live App Store URL exists in the repo**: `https://apps.apple.com/us/app/my-book-lab/id6761641708` (`src/components/book/BackMatterPages.jsx:13`). It appears in the *printed book* and **nowhere on the website**. Confirm the listing is live before using it publicly.

---

# 1. Press blurbs

## One-paragraph blurb (boilerplate, ~65 words)

My Book Lab is a children's creative-writing app for iPhone and iPad in which the child writes every word. A step-by-step wizard replaces the blank page, an AI helper offers opening sentences and questions but is built so it cannot write the story, and the illustrate button stays disabled until the page has words on it. Finished stories can be ordered as real printed books. Available on the App Store; a companion web app runs at mybooklab.app.

## 100-word version

**My Book Lab: the kids' writing app whose AI won't write the story**

My Book Lab is an iPad-first creative-writing app for children aged roughly 4–12. It walks a child through building a book one screen at a time — hero, setting, title, pages — instead of handing them a blank page. Its AI helper, Story Buddy, offers three opening sentences or three questions; the questions have no insert button, so the child has to answer them in their own words. The illustrate button is disabled until the page has text. Children can also draw pages by hand with an Apple Pencil. Finished books can be ordered printed and shipped in the US.

*(100 words exactly, excluding headline.)*

## 300-word version

**My Book Lab: a children's writing app built around what its AI refuses to do**

My Book Lab is a creative-writing app for children, built iPad-first as a native SwiftUI app (v2.0.0, iOS 17+), with a companion web app at mybooklab.app.

The premise is a constraint rather than a capability. Most AI tools for children are racing to generate more. My Book Lab ships with the generation removed from the child's writing surface. Its helper, Story Buddy, has exactly two modes in the iOS app: "Give me ideas," which returns three one-sentence story openers the child can tap to insert, and "Help me think," which returns three questions about the child's own story — rendered deliberately with no way to insert an answer. The page itself is a plain text editor: no autocomplete, no predictive continuation, no ghost text. A paragraph-writing function exists in the backend and is never called by the iOS app.

The same logic governs the artwork. The Illustrate button is disabled while the page is empty, so a picture is a reward for writing rather than a substitute for it. Children who would rather not use AI art can draw the page themselves with a finger or Apple Pencil; the app's badge for a hand-drawn illustration is worth more coins than the badge for an AI-generated one.

The app is designed for the child who stalls at the start rather than the child who is already fluent. Story Buddy adapts its language to the child's stated age; free-text chat is hidden entirely below age 9. Every badge in the catalogue is awarded for effort or completion — first page written, five pages written, book finished — and nothing in the app scores or grades writing quality.

Finished books can be ordered as printed softcover ($19.99) or hardcover ($39.99) with $4.99 US shipping (US only, 1–10 copies per order). The iOS privacy manifest declares no cross-app tracking, and there is no advertising or analytics SDK in the app. Accounts can be deleted in-app with a seven-day grace period.

**Press contact:** support@mybooklab.app · mybooklab.app

### Guardrails for anyone editing these

- Never add an efficacy number. There is no study, no data, no measured outcome anywhere in this product. "Children improve X%" is an invention.
- Never say "COPPA compliant" or "WCAG compliant." Say "the app's stated privacy policy" and "designed with Universal Design for Learning principles in mind."
- Never claim voice input, a dyslexia font, high-contrast mode, or classroom features **for the iOS app**. All four are web-only or nonexistent.
- Do not quote an iOS subscription price. It comes from App Store Connect at runtime (`PaywallView.swift:166` uses `localizedPriceString`). Print prices are hard-coded and safe: $19.99 / $39.99 / $4.99 shipping.
- The name is **My Book Lab**. `STORE_LISTING.md` says "My Favorite Book" and is stale.

---

# 2. Product Hunt launch

## Positioning decision first

Product Hunt's audience is builders, not the parent ICP. Do not try to convert parents there. **The PH launch is for backlinks, a permanent credible artifact, press-and-newsletter pickup, and one strong "here's how it's built" story.** Optimise for that, and the parent traffic is a bonus.

The story that works on PH is *the restraint*, not *the AI*. "An AI app for kids where we deleted the generate button" is a genuinely contrarian take in a feed saturated with generation. It is also true and checkable, which is the only kind of contrarian take that survives the comments.

## Tagline

Product Hunt taglines cap at 60 characters. Options, in preference order:

1. **`The kids' writing app whose AI won't write the story`** (51 chars) ← recommended
2. `We removed the "generate" button from our kids' AI app` (54)
3. `Kids write the book. The AI is not allowed to.` (46)

Do not use "AI-powered," "unleash," or "reimagined." PH punishes them by indifference.

## Description (the ~260-char field + the long description)

**Short description (shown in feed):**
> Kids write every word. Story Buddy gives them a first sentence or asks a question — it can't write the story, and the illustrate button is disabled until the page has words on it. Finished books can be ordered printed.

**Long description:**

> **My Book Lab** is a creative-writing app for kids (roughly 4–12), built iPad-first.
>
> The blank page is the actual problem. A kid who tells a twenty-minute dragon story in the car will write four sentences for school and conclude they're bad at writing. So the app removes the blank page — a wizard walks them through hero, setting, title, pages — without removing the writing.
>
> **What the AI does:**
> - **"Give me ideas"** → three one-sentence openers. Tap one, keep writing.
> - **"Help me think"** → three questions about their story. There is deliberately no button to insert an answer. They have to think of it and type it.
> - That's it, on iOS. A paragraph-writer exists in the API. The iOS app never calls it.
>
> **What else is true:**
> - The Illustrate button is `.disabled` while the page text is empty.
> - Kids can draw pages by hand (PencilKit / Apple Pencil), and the hand-drawn badge pays more coins than the AI one.
> - Free-text chat with the helper is hidden entirely below age 9.
> - Every badge is for effort or completion. Nothing scores writing quality.
> - No ads, no analytics SDK, no tracking (`NSPrivacyTracking = false`).
> - Books can be ordered printed: softcover $19.99, hardcover $39.99, +$4.99 shipping, US only for now.
>
> **What it isn't:** there's no dyslexia font, no high-contrast mode and no voice input in the iOS app — those live in the web version or not at all. No efficacy data. No classroom features on iOS; the teacher side is web-only at mybooklab.app/teacher.
>
> Free tier: one book, 3 helper uses/day, 2 illustrations/day — enough to build a book end to end and check the claims yourself before paying.

## First comment from the maker

> Hi Product Hunt 👋
>
> I built My Book Lab because of a specific thing I kept watching: a kid who can tell you an elaborate story out loud, sitting in front of a piece of paper producing four labored sentences, and concluding out loud that they're bad at writing.
>
> The obvious move is to have an AI help. The obvious implementation of that is a "write this for me" button, and the obvious result is a kid who never finds out they can do it.
>
> So the interesting engineering problem here was subtractive. The backend has three helper modes — starters, questions, and a full paragraph. The iOS client only ever sends two of them. The "questions" cards are rendered as plain views with no tap handler, so the single most-used help mode is *structurally* incapable of putting a word in the book. The Illustrate button carries `.disabled(... || currentPageText.isEmpty)`. Under age 9, the free-text chat isn't in the interface at all.
>
> Things I'd rather you hear from me than find out:
> - **The web version has a "Write for Me" button that generates a paragraph.** It's not in the iOS app. If you're comparing, the iPad app is the stricter one.
> - **From age 9 up, a kid can unlock free-text chat with the helper, and a reply from that chat can be added to the page.** It's short and steered toward ideas, but a determined 11-year-old could lean on it. I'd rather say that than get caught not saying it.
> - **There's no efficacy data.** I haven't measured anything. I'm not going to tell you it improves writing by some percentage.
> - **The accessibility features are split across platforms.** Dyslexia font, focus mode and voice dictation are web-only. The iOS app has read-aloud (slowed), Reduce Motion support throughout, and that's honestly it.
> - **Teachers: the classroom side is web-only.** If you download the app looking for a teacher tab, it isn't there. mybooklab.app/teacher is the thing.
>
> Free tier is one book, 3 helper uses and 2 illustrations a day — deliberately sized so you can build a whole short book and press every button before deciding anything.
>
> Happy to answer anything, including the uncomfortable ones. Especially those.

**Why this comment works:** the volunteered limitations are the persuasion. On PH, the top comment thread is usually someone poking a hole; pre-poking your own holes converts that thread from adversarial to collaborative.

## Gallery plan

PH shows the **thumbnail** (240×240) and a gallery (1270×760 recommended). Order matters enormously — most people see images 1 and 2 only.

| # | Asset | Content | Notes |
|---|---|---|---|
| — | **Thumbnail** | App icon (open book + gold star) on the cosmic gradient. Nothing else. | Must read at 60px. No text. |
| 1 | **The claim** | Split frame. Left: the Story Buddy "Help me think" screen with three question cards. Right: 24pt annotation — "These cards have no insert button. On purpose." | This is the whole pitch. It must be image 1. |
| 2 | **The disabled button** | The page editor with an empty text field and the Illustrate button greyed out, then the same shot with two sentences typed and the button live. Annotated "Illustrate is disabled on an empty page." | Second-strongest proof. |
| 3 | **The output** | The finished book in the reader on cream paper — illustration above, serif text below — iPad landscape two-page spread. | Emotional payoff; also the one warm light frame among dark ones. |
| 4 | **The hand-drawn path** | DrawingCanvasView with Apple's tool picker, a child's hand (no face) with an Apple Pencil. Annotated "Or skip the AI entirely — the drawing gets printed." | Disarms the AI-slop objection. |
| 5 | **The physical book** | Photo of a printed hardcover, open, with the "About the Author" page visible. Fictional demo name. | Proof the loop closes. `[UNVERIFIED — needs a real printed copy in hand; do not mock this up]` |
| 6 | **What it doesn't do** | A plain text card, cosmic background, SF Rounded: "No voice input on iOS. No dyslexia font on iOS. No classroom features on iOS. No efficacy data. Here's what's actually in it →" | Unusual on PH, which is why it gets screenshotted. |
| 7 | **Optional: video, 30–45s** | Silent, captioned, native app recording: wizard → type a sentence → Illustrate goes live → picture appears → save → confetti. No speed ramping on the AI generation. | Follow the shooting rules: no real children's faces, demo name, "Theo and the Star Bear" as the demo book, clean status bar. |

**Shooting constraints that apply here** (from the visual system, all verified): no real children's faces anywhere including reflections; no real names in any field; no empty states, spinners or loading placeholders; no real order addresses; Reduce Motion off while recording; and **do not film the mascot inside the iOS app** — the `Assets.xcassets` mascot imagesets declare no files, so the shipping build falls back to emoji. Composite the mascot into designed graphics only.

## Timing and tactics that actually matter now

**Timing**
- Launch **Tuesday, Wednesday or Thursday**, **12:01am PT**. PH's day runs midnight-to-midnight Pacific; launching at 9am PT throws away a third of your day.
- Avoid Monday (crowded with weekend backlog) and Friday/weekend (low traffic, though easier to rank — a #1 on a dead Saturday is worth less than a #4 on a Wednesday for the backlink and press value you actually want).
- Check the PH homepage the evening before. If a funded launch with a big list is going, **move**. Ranking against a company with a 200k-person newsletter is not a fair fight and there's no prize for losing it.

**Before launch day**
- Put up a **"Coming soon" page** 1–2 weeks ahead and drive your Instagram audience to *follow* it. Followers get notified at launch — this is the only fully sanctioned way to pre-load day-one traffic.
- **Add every contributor as a maker** so the launch shows on their profiles and in their followers' feeds.
- Write the first comment *in advance* and post it within 60 seconds of the launch going live. An empty comment section at 12:05am reads as abandoned.
- Have the **five or six hardest questions answered in a doc** before you start: "isn't this just ChatGPT for kids," "where does my kid's writing go," "what's the actual difference from the web version," "is there a teacher version," "what data do you collect," "why should I trust the AI won't say something weird." Answer #4 with "no, and here's why" — never bluff it.

**Rules you must not break**
- **Do not ask for upvotes.** Not in DMs, not on Instagram, not in a Slack. PH detects vote-canvassing and de-ranks or removes launches for it, and asking publicly is the fastest way to get reported by a competitor. You may say "we launched today, here's the link" — you may not say "upvote us."
- **Do not use vote-exchange groups.** Same outcome, worse.
- Share the link with `?ref=producthunt`-style tracking on *your* end only; don't wrap PH's link in a redirector.

**During the day**
- **Comments outrank votes for durable value.** Reply to every single comment, within minutes early on, with substance rather than "thanks!" A thread where you explain the `.disabled` modifier line-by-line is the thing that gets quoted elsewhere.
- The **first four hours** set the ranking trajectory. Be at a keyboard from 12:01am PT.
- Post the launch to your Instagram Story with the link sticker, and to any founder communities you're *already a member of* — never a community you joined that morning.
- Email your existing signup list `[UNVERIFIED — I found no email infrastructure, so there may be no list; see §4]`.

**After**
- The PH page is a permanent, well-indexed backlink for "kids writing app" and "AI writing app for kids." Keep it updated — PH launches can be edited, and a stale gallery a year later is worse than none.
- Newsletters and journalists browse the PH daily digest. A launch that ranks top 5 with 40+ substantive comments gets picked up; one that ranks #1 with 200 hollow votes doesn't.
- **Expect a hostile comment** about AI and children. Answer it in full, publicly, with the code detail. That exchange is more valuable than the ranking.

---

# 3. Reddit / forum strategy

## The rule that governs everything

**Astroturfing is off-limits. No sock puppets, no "my friend told me about," no seeded testimonials, no paid accounts, no asking anyone to post as an organic user.** Not "risky" — prohibited.

Why it would backfire specifically here, worse than for almost any other product:

1. **The audience is definitionally suspicious.** The ICP is a parent who reads the 2- and 3-star App Store reviews first and has been burned by two "educational" apps already. Sniffing out marketing is a skill she practises daily. r/ADHD and r/Teachers users check account history reflexively; a two-week-old account enthusing about a $6.99/mo app gets forensically dismantled in public within an hour.
2. **The positioning is "check it yourself."** Every pillar of this product's messaging is an invitation to verify. Getting caught faking a recommendation doesn't just cost a post — it retroactively invalidates the one thing the product is selling. There is no recovery narrative for "the app that says don't trust marketing, trust the code" being caught buying comments.
3. **The blast radius is permanent and it's the top search result.** A "is My Book Lab astroturfing r/ADHD_Parenting?" thread will outrank mybooklab.app for brand-plus-modifier searches indefinitely. The exact parent doing due diligence is the exact person who finds it.
4. **These communities are interconnected.** Mods of r/Teachers, r/specialed and r/slp overlap; parenting and neurodivergence subs share moderators and screenshot each other. One ban propagates.
5. **Reddit sitewide rules prohibit vote manipulation and undisclosed commercial accounts** — enforcement is a sitewide domain ban on mybooklab.app, which kills the channel forever, including the honest use of it.

**The compliant alternative is not weaker, it's stronger:** post as the maker, with the maker's real account, disclosing it, and lead with something useful whether or not anyone downloads anything.

## Community map

> `[UNVERIFIED — subreddit rules change constantly. Read the sidebar, the wiki and the pinned mod post of every community below on the day you post, and if the rule is ambiguous, modmail first. Everything in the "self-promo posture" column is my best current understanding and must be re-checked.]`

### Tier 1 — worth real effort

| Community | Who's there | Self-promo posture | How to actually be there |
|---|---|---|---|
| **r/ADHD_Parenting** | Exactly the sharpest ICP segment | Generally hostile to product posts; some allowance for disclosed makers answering direct questions | Do not post a launch. Set an alert for "won't write," "writing meltdown," "homework tears," "dysgraphia." Answer the *parenting* question fully; mention the app only if it's genuinely responsive, prefixed "disclosure: I make one of these." |
| **r/dyslexia** and **r/dysgraphia** | Adults with dyslexia + parents | Very protective; wary of apps that "help" by doing the work | The honest disclosure that the iOS app has **no dyslexia font** is your entry ticket. Post a comment that says which platform has which support and lets them judge. Never claim the accessibility you don't ship. |
| **r/homeschool** | Highest-converting secondary ICP | Usually restricts promo to a recurring thread (often weekly/monthly) — find it and use it | Use the designated thread properly, with price, limits and platform stated up front. Homeschool subs reward directness and punish coyness. |
| **r/secularhomeschool** | Secular/eclectic — the right sub-segment | Smaller, more permissive, still expects disclosure | Same as above. Skip classical/CM-focused subs; they'll object to the screen on principle and you'll deserve the downvotes. |
| **r/slp** | SLPs running narrative-language therapy | Strict; vendor posts get removed | Only enter via a genuine answer about narrative-language tasks. The web Story Blanks tap-only path is the relevant thing, not the app. |

### Tier 2 — real value, handle carefully

| Community | Notes |
|---|---|
| **r/Parenting** | Huge, very strict on self-promotion, low tolerance for anything reading as an ad. Treat as read-only unless answering a specific question, disclosed. |
| **r/ADHD** | Mostly adults with ADHD, not parents. Rules typically prohibit product/self-promo outright. **Assume you cannot post here.** |
| **r/specialed** and **r/Teachers** | r/Teachers is famously and correctly hostile to vendors. Do not post a product there. If you go anywhere, go to r/specialed with a disclosed, honest limitations post — and expect skepticism. |
| **r/ELATeachers** | More receptive to writing-instruction discussion; still no promo posts. |
| **r/homeschoolcoop-adjacent groups, r/HomeschoolAcademy** | Co-op leaders are the easiest converters. Follow each sub's promo thread rules. |
| **r/iPad, r/ApplePencil** | Legitimately interesting angle: PencilKit + the tool picker + the drawing ending up in a printed book. This is a *tech* post, not a parenting one. Check each sub's app-promo rule. |
| **r/SideProject, r/indiehackers-adjacent** | Fine for a build story. Low ICP density; useful for the PH launch day and for feedback. |
| **Hacker News — Show HN** | The "we removed the generate button" story is a genuine HN story. One shot; follow Show HN rules exactly (working link, maker present in comments all day, no marketing voice). Expect hard questions about AI and children — answer them. |

### Tier 3 — non-Reddit forums worth more per hour than Reddit

- **ADDitude Magazine's community/webinar audience** — the single most concentrated ADHD-parent audience online. Pitch a *contributed article* about the blank-page stall, not an ad. `[UNVERIFIED — check current contributor guidelines]`
- **Understood.org** and dyslexia-org communities — same posture: contribute expertise, not product.
- **Facebook groups** for ADHD/dyslexia parenting and homeschool co-ops — nearly all require admin permission for any commercial mention. Ask the admin. Many will say yes to a disclosed, honest post; all will ban you for an undisclosed one.
- **Mumsnet** (UK segment) — has a strict, enforced policy on undisclosed commercial posting, with a paid route for legitimate promotion. Do not freelance it.
- **Homeschool curriculum review sites and co-op newsletters** — small, slow, and they convert.

## The value-first post template

Use this shape. The rule: **the post must be worth reading by someone who never downloads anything.** If deleting the last paragraph destroys the post, it's an ad and it will be removed.

> **Title:** What actually helps a kid who can tell a great story but freezes when asked to write one
>
> **Body:**
>
> Disclosure up front so nobody has to work it out: I build a kids' writing app. This post is mostly not about it, and I'll flag the part that is. Mods, happy to remove if this is the wrong sub.
>
> I've spent about [N] months watching kids do this specific thing, and reading a lot about why, and the short version that helped me most is:
>
> **The stall is at initiation, not at composition.** A kid who narrates a forty-minute dragon saga in the car has the composition. What they don't have is a way to start — and every additional "just write anything!" adds load rather than removing it. The fix that works is almost stupidly small: give them the *first four words* and get out of the way.
>
> Three things that helped, none of which need an app:
>
> 1. **Hand them a sentence stem, not a topic.** "Topic: a dragon" is another blank page. "The dragon was not supposed to be there, but—" is a running start. Position matters too: a kid stuck on page four needs "Just when things seemed hopeless," not another "Once upon a time."
> 2. **Separate having the idea from forming the letters.** For a kid where handwriting is the bottleneck, the story evaporates before it reaches the paper. Let them dictate to you, or type, or draw the page first and caption it. You're not lowering the bar, you're removing a tax that has nothing to do with storytelling.
> 3. **Ask questions you won't answer for them.** "What did it smell like in there?" is worth more than any suggestion, because the answer has to come from them. This one is the hardest to hold to — the instinct to fill the silence is strong.
>
> The thing I got wrong for a long time: I thought the goal was to make writing easy. It isn't. It's to make *starting* easy and leave the writing hard, because the hard part is the part they need to find out they can do.
>
> ---
>
> **The app part, clearly marked so you can skip it:** I make [name], which is basically these three things in software. It's not free (there's a free tier: one book, a few helper uses a day). The parts I'd want to know as a parent: the AI helper's most-used mode gives questions with no way to paste an answer in, and the illustrate button doesn't work on an empty page. The parts I'd want to know before paying: no dyslexia font on the iPad app, no voice input on the iPad app, and I have no efficacy data of any kind. Happy to answer anything, including "why should I believe you," and happy to talk about the three things above with people who never touch it.

**Rules for running this template:**
- Post it from the maker's real, aged account with genuine post history in unrelated subs.
- One community per week maximum. Never the same text twice — cross-posted identical copy is the single most reliable astroturf tell.
- **Answer every reply, including hostile ones, including "this is an ad."** The right answer to that is "yes, partly, that's why I labelled it — here's the useful bit either way."
- If a mod removes it, thank them and do not repost.
- Never link the App Store in a first post. Link nothing, or link the free web version if the sub allows links at all.
- **The educator funnel never links to the App Store.** A teacher who downloads the app finds five tabs and no classroom feature and says so loudly in a thread other teachers read. Educator posts point to `mybooklab.app/teacher`, always.

---

# 4. Email sequence for new signups

> **BLOCKER, read first.** There is no email-sending infrastructure in this codebase. `grep -rl "resend\|sendgrid\|postmark\|nodemailer" api/ src/ lib/` returns nothing. Supabase Auth will be sending confirmation/reset emails, but there is no lifecycle-email system, no template store, no send endpoint, and no scheduler beyond the single `purge-deletions` cron in `vercel.json`. **Shipping this sequence requires building it** — an ESP (Resend is the lightest fit given the Vercel/edge stack), a `subscribers`-style table or a Supabase view over `auth.users`, a send endpoint, an unsubscribe route, and a cron to evaluate the schedule. Budget that before promising the sequence to anyone.
>
> **Second blocker:** every trigger below depends on knowing whether the user has saved a book, illustrated a page, used Story Buddy, or ordered a print. Those facts live in Supabase and are queryable, but nothing currently assembles them into a per-user lifecycle state. Build a small `user_lifecycle` view first, or the "feature you haven't tried" email will tell people to try things they've already done — which with this audience is worse than sending nothing.
>
> **Third:** if a child's account can exist, be extremely careful whom you're emailing. The stated policy is that accounts aren't knowingly created for under-13s without parental consent (`PrivacyPage.jsx:27-29`). Marketing email should go to the account holder, be plainly parent-addressed, and carry a one-click unsubscribe in every send. `[Legal review recommended before the first send.]`

**Sequence-wide rules:** plain text or near-plain text (renders better and reads more like a person); one link per email; no emoji in subject lines; no countdowns or fake scarcity; sender is a person's name, not "The My Book Lab Team"; every email works for a parent who never opens the app again.

---

### Email 1 — Welcome
**Send:** immediately on signup.
**Subject:** `Before you hand it to your kid, press these two buttons`
**Preview text:** `Ten minutes of you checking it beats any promise I could make.`

> Hi,
>
> Thanks for signing up. Most emails like this tell you what the product does. I'd rather you check.
>
> Open it yourself first — it takes about ten minutes and you'll know more than any description gives you. Two buttons in particular:
>
> **"Help me think."** It gives your child three questions about their own story. Look for the button to insert an answer. There isn't one. That's deliberate — they have to think of it and type it.
>
> **"Illustrate."** Try tapping it on an empty page. It's greyed out. The picture is a reward for writing the page, not a replacement for it.
>
> That's the whole design argument, and you can verify both in under a minute.
>
> Two things I'd rather tell you now than have you discover later:
>
> - There's no efficacy data. I haven't measured anything and I'm not going to pretend otherwise.
> - The accessibility supports are split. The web version at mybooklab.app has a dyslexia font, a focus mode and voice dictation. **The iPhone/iPad app does not have those.** It has read-aloud (deliberately slowed) and full Reduce Motion support. If a dyslexia font is the thing you need, use the web version.
>
> Your free account gives you one book, three Story Buddy uses a day and two illustrations a day — enough to build a short book start to finish before deciding anything.
>
> [Start a book →]
>
> — [Name]
> P.S. Reply to this if something's broken or something's missing. I read them.

---

### Email 2 — First book nudge
**Send:** 3 days after signup, **only if no book has been saved.** Suppress if a book exists.
**Subject:** `The first page is the hard one (here's the shortcut)`
**Preview text:** `Shake the iPad. Genuinely.`

> Hi,
>
> If you haven't opened it yet, that's normal — this is the point where most people mean to and don't.
>
> The fastest possible start, if your child is with you: **shake the iPad.** A story idea appears. There are 30 of them, they're stored on the device so they work with no internet, and it takes about two seconds. "Write it!" drops them straight into the wizard.
>
> If you'd rather steer it yourself, the wizard asks six small questions instead of showing a blank page — who's writing it, who the hero is, where it happens, what it's called. Nobody has to invent anything from nothing.
>
> One thing worth knowing about the first session: **don't aim for a whole book.** One page is a complete outcome. The app has a badge for exactly that — "First Page" — and the badges are all like this: they're for doing a thing, not for doing it well. Nothing in the app scores or grades your child's writing.
>
> [Open the app →]
>
> — [Name]
>
> P.S. If your child's reaction to writing is a fight, the drawing route is a legitimate way in. There's a Draw button next to Illustrate — finger or Apple Pencil — and whatever they draw is what goes on the page. Some kids draw the whole book first and write it afterwards. That counts.

---

### Email 3 — The feature they haven't tried
**Send:** 7–10 days after signup, **only to users with at least one saved book.** Choose *one* variant based on actual usage; do not send a list.
**Subject (variant A, has never used Story Buddy):** `You haven't pressed the help button yet`
**Subject (variant B, has never drawn a page):** `The part of the app with no AI in it`
**Subject (variant C, has only one page):** `A one-page book is still a book`

**Variant B, written out (the strongest one — send it by default if you can't segment):**

> Hi,
>
> You've got a book going, which is the hard part. There's one thing in the app that most people don't find, and it's the part I'd most want a skeptical parent to see.
>
> **The Draw button.** It sits next to Illustrate in the page editor. Your child draws the page themselves — finger or Apple Pencil, with Apple's real tool picker: pen, crayon, marker, colours. What they draw is uploaded properly, so it survives into the printed book at full print resolution. No AI touches it.
>
> The badge for it is called "Own Two Hands," and it's worth more coins than the badge for an AI illustration. That's not an accident. If you'd rather your child never used the AI art at all, the app works completely without it — you lose nothing except the AI pictures.
>
> A few other things that are in there and easy to miss:
>
> - **Read-aloud** in the finished-book reader, at a deliberately slowed speech rate so a child can follow their own words back.
> - **Shake for an idea** — works on any screen, offline, instantly.
> - **The streak** counts days your child wrote, not minutes in the app. If streaks aren't for you, it's genuinely peripheral; ignoring it costs nothing.
>
> [Open your book →]
>
> — [Name]

---

### Email 4 — The printed book
**Send:** within 24 hours of a book being *finished* (all pages have text). This is an event-triggered email, not a scheduled one — it has to land while the feeling is fresh.
**Subject:** `[Child's book title] can be an actual book`
**Preview text:** `Softcover $19.99, hardcover $39.99. US only for now.`

> Hi,
>
> **[Book title]** is finished. That's a real thing — most kids who start one don't.
>
> The part I'd gently point at: you can have it printed. Not a PDF, not a mockup — a physical book, with your child's name on the cover, that arrives at your house.
>
> - **Softcover — $19.99**
> - **Hardcover — $39.99**
> - $4.99 shipping, flat. 1–10 copies per order.
> - **US shipping only at the moment.** If you're outside the US, I'm sorry — it's not available to you yet and I'd rather say so than let you find out at checkout.
>
> The printed copy includes the story plus a few extra pages: a dedication page to fill in by hand, an "About the Author" page with your child's name and the date, a page about the characters, and some blank lines at the back for whoever reads it to write a note.
>
> Whatever your child drew by hand gets printed exactly as they drew it.
>
> One honest note on why I think this matters more than it sounds: almost nothing a child makes survives. Drawings go in the recycling and school work comes home in a crumpled folder in July. This is a thing that sits on a shelf with their name on the spine.
>
> [See it as a printed book →]
>
> — [Name]
>
> P.S. You can also just… not. The book stays on their shelf in the app either way, and you can read it aloud from the app any time.

---

### Email 5 — Win-back
**Send:** 30 days after last activity, to lapsed users. Send **once**. If it doesn't land, stop emailing them.
**Subject:** `Should I stop emailing you?`
**Preview text:** `Genuine question, one click either way.`

> Hi,
>
> You signed up about a month ago and haven't been back. That's completely fine, and this is the last thing I'll send unless you want otherwise.
>
> Before you go, in case it's useful — the three reasons people tell me it didn't stick:
>
> **"We never got past the first screen."** Try the shake. Shake the iPad anywhere in the app and a story idea appears. It's the shortest possible on-ramp; there's no setup and it works offline.
>
> **"My kid can't type well enough yet."** Fair, and the iPad app doesn't fix that — there's no voice input in it, despite what you might have read elsewhere. What does exist: the web version at mybooklab.app has voice dictation (Chrome or Edge), a dyslexia font and a focus mode, and it has two tap-only games — Story Blanks and Story Builder — where a whole story gets built by tapping word choices. A child who can't yet spell "dinosaur" can still finish a story that way.
>
> **"It's another subscription."** Then don't. The free account stays free — one book, three helper uses and two illustrations a day. Books already on the shelf stay there. You can also delete the whole account from inside the app, in Settings; you get seven days to change your mind and then everything goes.
>
> If none of that lands, no hard feelings — one click below and you're off the list for good.
>
> [Unsubscribe] · [Come back and finish a book →]
>
> — [Name]
>
> P.S. If you're willing to tell me what actually stopped you, replying to this is the most useful thing anyone does for me all week.

---

# 5. Teacher / school outreach kit

> **Read this before sending anything.** The educator product is **100% web-only**. There is no teacher view, no classroom view, and no submit-to-class control anywhere in the iOS app — `MainTabView` ships Books, Gallery, Create, Orders, Account. Every educator asset must point at `mybooklab.app/teacher` and must never mention the App Store. A librarian who downloads the app, finds no teacher tab and emails you back is a lost lead *and* a story they tell in the staff room.
>
> **Second:** there is no invoicing, PO, quote, or district-billing path in the code — Stripe self-serve checkout only (`src/pages/PricingPage.jsx` → `/api/create-checkout`). Position Teacher as a personal-card subscription. Anything pitched as a school purchase will die in procurement and waste the relationship.
>
> **Third, and this is the one that gets you blacklisted if you fudge it:** there is **no DPA process, no signed student-data agreement, no FERPA or COPPA attestation flow, and no accessibility audit or VPAT** in this product. A SPED coordinator will ask. Answer honestly and early. Being the vendor who volunteered "we don't clear that bar yet" is a *better* long-term position than being the vendor who was vague and got caught by the district's tech director.

## Cold email — school librarian / SPED coordinator

**Subject:** `A writing tool for the kids who freeze — and three reasons it may not suit you`

> Dear [Name],
>
> I build a creative-writing tool called My Book Lab and I'm writing to a small number of [librarians / special education coordinators] rather than doing a mailout, because I'd rather have five real conversations than five hundred opens.
>
> **The one thing it does:** students who stall at the blank page get a running start instead of a rescue. The writing screen carries the supports on it, not behind a settings menu — a row of four buttons above the text box for read-aloud, voice dictation, an OpenDyslexic toggle and a focus mode; sentence starters that change depending on where in the story the student is, so page four offers "Just when things seemed hopeless," not another story opener; a word bank of feelings and actions; and a visible dot map reading "4 of 8 pages written." The interface itself changes with the student's age — at seven and under, larger type, larger touch targets, and a book capped at 12 pages and 100 characters per page.
>
> There's also a tap-only path: a fill-in-the-blanks story mode where every blank is chosen from a word bank, so a student who can't yet spell the word can still author the story.
>
> **Collection, if you want it:** you create a class, get a six-character code (no O, no zero, no I, no one — because you'll be reading it aloud), students submit with that code, and the finished writing lands in one gallery you can open on a projector. Students don't need to sign in to submit.
>
> **Three reasons this may not suit you, up front:**
>
> 1. **It's web-only for teachers.** mybooklab.app in a browser — fine on a Chromebook, nothing to install, nothing for IT to approve. But the App Store app has no teacher or classroom features at all, so don't download it looking for them.
> 2. **It doesn't clear a district data review.** There's no signed data-processing agreement, no FERPA or COPPA attestation, and no accessibility audit or VPAT. Submitted work is stored on our servers against the class code, and the code is effectively the password — anyone holding it can open the gallery. For a resource room, a small group or a co-op that's usually fine. For a district rollout it is not, and I'd rather tell you than have your tech director tell you.
> 3. **There are no student seats.** A Teacher subscription upgrades *your* account. Students each need a free account to save work, and free is capped at one saved book. Realistically that's one book per student per term, or a small group — not unlimited class-wide writing.
>
> **Two things I want to be careful not to claim:** the marketing site says the app "follows UDL and WCAG guidelines" and that teachers can "track writing progress." Neither is accurate — there's no conformance evidence and no progress tracking exists. I'm having both fixed. I mention it because you'll see it and I'd rather you hear it from me.
>
> If a low-floor writing task that produces a real artifact is useful to you, the fastest test is fifteen minutes with your own hands: mybooklab.app/teacher, make a class, and try the writing screen as a student would. Teacher is $13.99/month or $109.99/year with a 14-day free trial, on a personal card — there's no invoicing or PO process, so please don't route it through procurement.
>
> If it's not a fit, a one-line "no" is genuinely welcome and I won't follow up.
>
> Best,
> [Name]
> [Role] · mybooklab.app · support@mybooklab.app

**Sending notes:**
- Individually addressed, ≤50 per week, from a real person's mailbox. This audience forwards mass mail to a "look at this vendor" thread.
- Personalise line one with something specific and true about their school or their posted work. If you can't, don't send.
- **One follow-up only**, 8–10 days later, three sentences, offering to just answer a question. Then stop.
- Never CC a principal. Never say "I noticed your school doesn't have…"
- Check your jurisdiction's rules on unsolicited commercial email before sending; some districts and countries treat this restrictively. `[Legal review recommended.]`

## One-page PDF — outline

Single side of A4/Letter. Cosmic gradient ground, glass cards, SF Pro Rounded (or Fredoka 700 if unavailable). No mascot — this document is quiet.

| Zone | Content |
|---|---|
| **Header strip** | `MY BOOK LAB — FOR CLASSROOMS` + one line: *"A low-floor writing task that ends in a finished book."* Then, in the same size, not smaller: **"Teacher tools are web-only: mybooklab.app/teacher"** |
| **Band 1 — What a student sees** (one screenshot, annotated) | The web page editor with the four-button toolbar visible. Callouts: read-aloud with word-by-word highlighting · voice dictation (Chrome/Edge) · OpenDyslexic toggle · focus mode. Plus: position-aware sentence starters · word bank · "4 of 8 pages written" progress map. |
| **Band 2 — Three ways in, same finished book** | Three glass cards. **Type** (age-adaptive editor: 7-and-under gets larger type, 12 pages, 100 chars/page; 8+ gets 24 pages, 500 chars). **Speak** (browser dictation, Chrome/Edge only). **Tap** (Story Blanks — every blank chosen from a word bank; 3 templates today). |
| **Band 3 — The AI, stated plainly** | "Story Buddy has three modes. Two of them cannot write your student's story — three one-sentence openers, or three questions to think with. The third is labelled **Write for Me** and generates a 2–4 sentence paragraph. **There is no teacher switch to turn it off.** Decide with your class whether it's allowed, the way you would with a thesaurus. The iOS app ships only the first two modes." |
| **Band 4 — Class collection in three steps** | 1. Make a class → get a 6-character code (no O/0/I/1). 2. Write it on the board. Students submit — no student login needed to submit. 3. Open `/classroom/CODE` on the projector. |
| **Band 5 — Read this before you try it with 28 students** (the honesty box — bordered, prominent, not a footnote) | • Submitted books arrive **text-only** — illustrations and covers are stripped on submission. • **Anyone with the code can open the gallery.** The code is the password: don't post it publicly, don't reuse it across years. • Your class list is stored **in the browser you created it in**. There's no way to look it up from another device. **Write the code down.** • Submissions are rate-limited to ~20/hour per network IP — a 30-student class submitting at once will hit it. Stagger or split across periods. • **No** delete, edit, moderation, comment, rubric, grade or bulk export of submissions. • **No DPA, no FERPA/COPPA attestation, no accessibility audit, no VPAT, no standards alignment.** |
| **Band 6 — What it costs** | Teacher $13.99/mo or $109.99/yr, 14-day free trial, personal card via Stripe. **No student seats** — students need a free account to save, and free is capped at 1 saved book. No invoicing, quotes or POs. |
| **Band 7 — What it produces** | One image: a printed book open to the "About the Author" page. Caption: "PDF export on paid plans (browser print dialog). Printed books: softcover $19.99, hardcover $39.99, +$4.99 shipping, US only, 1–10 copies." |
| **Footer** | mybooklab.app/teacher · support@mybooklab.app · "No efficacy data. No standards alignment. Try it for fifteen minutes and judge it yourself." |

**Do not put on this page:** any WCAG/UDL/COGA compliance claim, "track student writing progress," "high contrast mode," any App Store badge, any efficacy statistic, or any stock photo of children.

## Free-trial offer structure

The existing 14-day Teacher trial is the right primitive but the wrong shape for a classroom, because two weeks is not a writing unit and the trial upgrades the wrong account. Structure it in three tiers of commitment:

**Tier 0 — "Fifteen minutes, no account needed"** *(top of funnel, the actual CTA in every educator asset)*
Send them to the writing screen with the sample book, not to a signup form. The ask is "press the four toolbar buttons and the three Story Buddy modes." Costs nothing, requires nothing, and it's the mechanic that converts this audience: the product survives inspection.

**Tier 1 — The existing 14-day Teacher trial** *(verified: `PricingPage.jsx:15-40`)*
Position it as **"one class, one book, one unit"** — enough to run a single short writing project end to end. Be explicit that the trial upgrades the teacher's account and grants students nothing. State the cancellation path in the same breath.

**Tier 2 — A "pilot term" offer** `[NOT BUILT — this requires work before you can offer it]`
The genuine unlock for classrooms isn't a longer teacher trial, it's **student capacity**: free accounts cap at 1 saved book, so a class writing a second book is blocked regardless of what the teacher pays. Two options, both requiring engineering:
- **(a) Classroom-code book allowance** — students who joined via a class code get a raised `maxBooks` for the term. Cleanest fit with the existing model.
- **(b) A pilot voucher** — a coupon granting a teacher a term of Teacher plus N student allowances, issued manually to schools you actually talk to.

Until one exists, **do not imply class-wide writing is possible on a Teacher subscription.** Say "one book per student per term, or a small group." A teacher who plans a unit around a capability that doesn't exist becomes a public complaint in a sub full of other teachers.

**Never offer:** a free plan "for schools" with no defined limit, a discount contingent on a testimonial, or anything requiring a PO. And do not offer free access in exchange for a review — App Store and most district ethics rules both frown on it, and this audience will say so publicly.

---

# 6. Landing page critique — `src/pages/LandingPage.jsx`

**Context assumed:** traffic arriving from Instagram, on a phone, from a parent-targeted ad or Reel. She has ~3 seconds and one thumb.

## P0 — Fix before running a single dollar of Instagram traffic

### P0-1. There is no App Store link anywhere on this page. The entire parent funnel dead-ends.

The parent funnel is supposed to point at the App Store. I grepped `src/` for `apps.apple.com`: the **only** occurrence is `src/components/book/BackMatterPages.jsx:13` — inside the *printed book*. There is no App Store badge, link or smart banner on the landing page, in `AppShell`, or in `index.html`.

So: a parent taps your Instagram link expecting the iPad app, lands on a web app, and the only button is:

```jsx
<SparkleButton onClick={() => navigate('/create')} ...>
  Create a Book 📖
</SparkleButton>
```

…which starts the *web* wizard on a phone — a worse first experience than the product you advertised, and one that will teach her the app is mediocre.

**Fix:** below the hero CTA, an Apple-supplied "Download on the App Store" badge linking to `https://apps.apple.com/us/app/my-book-lab/id6761641708`, with a `?pt=&ct=instagram_launch&mt=8` campaign token so you can attribute installs in App Store Connect. Detect iOS/iPadOS UA and make the badge the **primary** action there, demoting "Create a Book" to the secondary text link. Use Apple's official badge artwork at its published minimum sizes — a hand-drawn approximation is a guideline problem.

### P0-2. `'2 books'` is factually wrong on a pricing table.

```jsx
{['2 books', '3 Story Buddy chats/day', '2 AI illustrations per day', 'Read aloud & voice input'].map(...)}
```

`PLANS.free.maxBooks` is **1** (`src/lib/plans.js:8`), `PricingPage.jsx` says "1 book total," and `CreatePage.jsx:138` enforces 1. A parent who signs up expecting two books and is blocked at one has caught you lying on the first day. With this ICP that is unrecoverable.

**Change to:** `'1 free book'`.

While there: `'Read aloud & voice input'` is true *on the web only*. If the same page also carries an App Store badge (P0-1), it now reads as an app claim and becomes an over-claim. **Change to** `'Read aloud & voice input (web)'`.

### P0-3. The accessibility callout makes three claims that are false in code, on the page selling to dyslexia and ADHD parents.

```jsx
Adjustable fonts, high contrast mode, text-to-speech, and scaffolding tools support UDL and WCAG standards.
```
```jsx
My Book Lab follows Universal Design for Learning (UDL) principles and WCAG/COGA accessibility guidelines.
```

- **"high contrast mode"** — `useAccessibilityStore.js` contains only `dyslexiaFont` and `focusMode`. It does not exist anywhere.
- **"Adjustable fonts"** — font *size* is set automatically from the author's age (`useAgeAdaptive.js`). The user never adjusts it. The dyslexia font is a binary toggle, not adjustable fonts.
- **"WCAG/COGA guidelines"** — no audit, no VPAT, no conformance artifact, no automated a11y testing in the repo.

This is the highest-liability copy on the site. The parent most likely to read it closely is the one who has read a VPAT before.

**Replace the callout with:**

> **Designed with every child in mind**
>
> My Book Lab is designed with Universal Design for Learning principles in mind: more than one way to get words onto the page, and supports that sit on the writing screen rather than in a settings menu.
>
> On the web: read-aloud with word-by-word highlighting, voice dictation (Chrome and Edge), an OpenDyslexic font toggle, a focus mode, sentence starters and word banks, and a visual progress map. On iPhone and iPad: read-aloud in the book reader at a slowed speech rate, and full Reduce Motion support throughout.
>
> We haven't had an independent accessibility audit and we don't claim conformance with any standard. Try it and judge it yourself — the free tier needs no card.

### P0-4. `'Classroom Ready — ...and track writing progress'` describes a feature that does not exist.

```jsx
{ icon: Users, ..., title: 'Classroom Ready', desc: 'Teachers can create classrooms, collect student stories, and track writing progress.' }
```

There is no progress tracking of any kind for classrooms in `api/classroom.js`, `TeacherPage.jsx` or `ClassroomPage.jsx`. **Change to:** `'Create a class, get a 6-character code, and collect finished stories in one gallery. Web only — the iOS app has no classroom features.'`

### P0-5. `'gives ideas, not answers'` is contradicted by this very web app.

```jsx
{ icon: Wand2, ..., title: 'AI Story Buddy', desc: 'A friendly writing assistant that gives ideas, not answers — encouraging kids to build their own stories.' }
```

`src/components/editor/StoryBuddy.jsx` exposes a third mode labelled **"Write for Me"** that generates a full paragraph (`api/story-buddy.js`). The sentence is false on the platform it's printed on. Worse, it's false in the *exact* way the ICP is scanning for.

**Change to:** `'Two of its three helpers can't write your child's story — three opening lines, or three questions to think with. The third is labelled "Write for Me" and does write a paragraph. On the iPhone/iPad app, only the first two exist.'`

That is longer than the other cards and it should be. It is the single most persuasive thing on the page.

### P0-6. The mobile headline is 24px. On the ad's own landing page.

```jsx
<h1 className="font-heading text-2xl sm:text-7xl font-bold mb-4 leading-tight">
```

`text-2xl` is 1.5rem. Every other breakpoint jump on this page is proportionate; this one goes 24px → 72px at 640px. On the phone where 100% of Instagram traffic lands, the brand wordmark is smaller than the pricing headings below it. This looks like a typo for `text-5xl`.

**Fix:** `text-5xl sm:text-7xl`.

## P1 — Restructure for Instagram traffic

### P1-1. The hero says nothing about the problem.

```jsx
Create your own story in the stars ✨
```

That's an app-store subtitle for a child. The person reading it is a 38-year-old woman at 9:40pm who just watched a Reel about a kid who freezes at the blank page. She needs one line confirming she's in the right place.

**Replace the subtitle** (keep the animated wordmark above it — it's the brand asset and it's good):

> **He can tell you the whole story. He just can't start writing it.**
> A writing app that hands your child the first sentence — and then gets out of the way.

Then the CTA stack becomes: App Store badge (primary on iOS) → `Try it free in your browser` (secondary) → a quiet text link `See a finished book →` to `/example`.

### P1-2. Mobile-first ordering. The page currently buries every persuasive element.

Current order on a phone: logo → wordmark → subtitle → one CTA → ~6 floating emoji → "Every child has a story to tell" → 6 feature cards → accessibility callout → pricing → footer. The strongest argument (the AI can't write it) is card #1 of six, roughly 1,600px down.

**Proposed order for cold Instagram traffic:**

1. **Hero** — wordmark, problem subtitle, App Store badge + web CTA. *Nothing else above the fold.*
2. **The one-line proof, immediately** — a single full-width band, no card, large type:
   > **The Illustrate button doesn't work on an empty page.**
   > Your child writes first, then gets the picture. That's the whole trade.
3. **Social proof band** (see P1-3).
4. **"What it won't do"** — three short items: it won't write the story on iOS · it won't score or grade their writing · it won't run out of lives or nag them to come back. This inverted-feature block is the highest-trust unit available to you with an AI-skeptical buyer, and nothing like it is on the page today.
5. **The feature grid** — kept, but rewritten per P0-3/4/5 and **platform-labelled**. Add a small `iOS` / `Web` chip to every card. Right now a parent cannot tell which product she's reading about, which is the root cause of four of the six P0s.
6. **The output** — one image of a finished page on cream paper, or a printed book. This page currently shows *zero* pictures of what the product makes. That's the biggest missed asset on it.
7. **Pricing.**
8. **Footer.**

### P1-3. There is no social proof of any kind anywhere on this page.

No reviews, no counts, no gallery preview, no press, no quote. For a parent who reads 2- and 3-star reviews before downloading, an empty page reads as a brand-new app with nothing to show.

You have a real, honest asset sitting unused: **the public gallery**. `api/publish-book.js` serves `?recent=true` (30 newest) and `?featured=true` (up to 20) with no auth. `GalleryPage.jsx` already consumes it.

**Add a "Written by kids using My Book Lab" strip to the landing page** — 4–6 featured book covers pulled from `/api/publish-book?featured=true`, each linking to `/view/:slug`, with a `Read more stories →` link to `/gallery`. This is proof, not a claim; it's real children's work; and it feeds §7's SEO bet by internally linking your indexable pages from your highest-authority page.

**Guardrails:** curate via the `featured` flag only — never auto-surface `recent` on the landing page, since it's unmoderated. Show first names/initials as authored. Have a documented takedown path.

Never fabricate a review, a rating, a user count or a testimonial. This audience finds those, and this product's entire pitch is verifiability.

## P2 — Cleanups worth doing

- **`maximum-scale=1.0, user-scalable=no`** in `index.html:5` disables pinch-zoom. On a site marketed to parents of children with dyslexia, blocking zoom is both an accessibility failure and an easy screenshot for a critic. Remove both tokens.
- **Terms of Service links to the Privacy Policy.** `LandingPage.jsx:302-308` — both `<Link>`s point to `/privacy`. If ToS lives inside that page, deep-link an anchor; if it doesn't, that's a legal gap, not a styling one.
- **OG metadata says the wrong thing for parent traffic.** `index.html:12` — `"Build your own illustrated story book with AI help, share it with your class, and collect badges as you write."` leads with AI, which the ICP reads as "the computer does it," and mentions class-sharing to a parent audience. Rewrite as parent-facing; see §7 for the per-route fix.
- **Six animated floating emoji** (`🚀🪐⭐🌙✨🌟`) run infinite loops with `Math.random()` durations re-evaluated on every render, and only the logo/halo carry `motion-reduce:animate-none`. Add `motion-reduce` handling to `FloatingElement`, and consider cutting to three — the brief's own rule is 3–6 sparkles maximum, and six emoji plus a wordmark animation plus a halo pulse on a mid-range phone is a lot of jank in the first second.
- **`'PDF & print export'`** in the Family plan list — on web this is `window.print()` (`PreviewPage.jsx:44-50`), the browser's print dialog, not a generated file. Say `'Print or save as PDF from your browser'`.
- **Add an FAQ block** answering the four questions this ICP actually types: *Will it write the story for my child? · What data do you collect? · What's the difference between the app and the website? · Can I cancel?* Each three sentences, each honest. These are also your best organic-search surface (§7).

## Suggested measurement

Nothing on this page is instrumented, and `package.json` contains no analytics dependency — which is a genuine privacy asset and should stay that way for the child-facing app. For the marketing landing page you still need *something* to decide with: the minimum viable version is server-side counts you already control (signups per day, App Store badge clicks via a redirect route you own, `create-checkout` starts) rather than adding a third-party tracker. **Do not add an analytics SDK to the app bundle** — "no analytics trackers" is a verified, differentiating claim and worth more than a funnel chart.

---

# 7. 90-day growth plan (days 31–120)

## What compounds and what doesn't

**Doesn't compound:** Instagram posts, the PH launch, Reddit threads, cold email. All valuable, all linear — you stop, they stop.

**Does compound:** organic search, the public gallery as an indexable and shareable surface, and the printed book as a physical referral object. All three are currently **structurally blocked**, and unblocking them is the work of this quarter.

### The blocker, stated once

`vercel.json` rewrites `/((?!api/).*)` → `/index.html`, and every OG/Twitter tag is static in `index.html`. Therefore:

- Every `/view/:slug` share — the child's proudest moment, sent to a grandparent, posted in a Facebook group — previews as **"My Book Lab · Build your own illustrated story book with AI help"** with the generic app icon. The book's title, its author, its cover: invisible.
- `ViewBookPage.jsx:88` compounds it: `navigator.share({ title: book?.title || 'My Favorite Book', url })` — the fallback leaks the **stale product name** into the OS share sheet.
- There is **no `public/robots.txt` and no `public/sitemap.xml`**. Nothing tells a crawler that ~50 published-book URLs exist; they're reachable only by rendering `/gallery`'s client-side fetch.

Your best organic surface — real children's stories, at real URLs, growing without you — is invisible to both search and social. **Fixing this is the highest-leverage engineering work in the next 90 days, and it is worth more than any campaign in this document.**

---

## Bet 1 (highest leverage) — Make `/view/:slug` and `/gallery` real, shareable, indexable pages

**Days 31–50.**

1. **Server-render metadata for `/view/:slug`.** Add an edge function or Vercel middleware that intercepts these routes, fetches the row from the existing public `GET /api/publish-book?slug=` endpoint, and returns HTML with real `<title>`, `<meta description>`, `og:title`, `og:description`, `og:image` and `twitter:card` before handing off to the SPA. You already have the read path, unauthenticated, returning the full `book_data`.
2. **Generate an OG image per book.** `qrcode`, `puppeteer-core` and `@sparticuz/chromium` are already dependencies — the print pipeline proves you can render HTML to an image server-side. A 1200×630 card: the book's cover colour, its title, "by [first name], age N", one illustration. Cache it. This turns every share into a picture of the child's actual book instead of your app icon.
3. **Fix the share-sheet fallback** — `ViewBookPage.jsx:88`, `'My Favorite Book'` → `'My Book Lab'`, and add a `text:` field: `"[Title] — written by [name], age [n]"`.
4. **Ship `robots.txt` and a dynamic `sitemap.xml`** listing `/`, `/gallery`, `/example`, `/pricing`, `/privacy`, `/support`, plus every published slug, generated from the same public endpoint. Submit to Search Console.
5. **Link the gallery from the landing page** (P1-3 above) so the published books inherit some authority.
6. **Curate `featured`.** The flag exists and the endpoint serves it. A handful of genuinely good, safely-authored books, refreshed weekly, is the difference between a gallery that reads as a showcase and one that reads as a dump.

**Why this is bet #1:** it converts an existing, growing, zero-marginal-cost asset — children publishing books — into two compounding channels at once (organic search and organic social sharing), and it needs no new content, no ad spend and no ongoing labour after it ships.

**Measure:** indexed pages in Search Console; referral sessions to `/view/*`; signups whose first landing page was `/view/*` or `/gallery`.

**Safety gate before shipping — do this first, not after:** making children's writing more discoverable raises the stakes on moderation. Before you improve indexing, confirm what's actually publishable — `api/publish-book.js` and the moderation path in `api/_aiGuard.js` — and put in place: a documented takedown route, an author-name convention (first name or initial only), a `noindex` default with `featured` as the opt-in for indexing, and someone who reviews the queue. **Do not make this faster to find until you're confident in what will be found.** If that review isn't ready, ship items 1–3 (sharing) and hold items 4–6 (indexing) until it is.

---

## Bet 2 — Turn the printed book into a tracked referral loop

**Days 40–65.**

The loop is already 80% built and nobody is counting it. `src/components/book/BackMatterPages.jsx` and `lib/print/pdf-html.js` both put a **QR code, "Scan to download," mybooklab.app and @mybooklab.app** into the back of every printed book. That book goes to a house, gets shown to grandparents, goes to school for show-and-tell, sits on a shelf for years. It is the best-targeted physical advertisement this product could buy, and it's free.

Three problems:

1. **The QR encodes a bare App Store URL** (`APP_STORE_URL`, both files). No campaign token, no attribution. You cannot tell whether a single install ever came from a printed book — so you can't justify investing in the loop.
2. **There's no reason for the recipient to act.** "Scan to download" is an ad. The strong version is an *invitation from the child*.
3. **The child who wrote it gets nothing for it.**

**Do:**

- Point the QR at a short branded redirect you own (`mybooklab.app/r/<code>`) that logs the hit and forwards to the App Store with `pt`/`ct` campaign parameters. Now you have a number.
- Rewrite `PromoPage` from an ad into an invitation, in the author's voice: *"[Name] wrote this book in My Book Lab. Yours could be next — scan to start one."* Same footprint, different genre.
- **Consider a coin reward for the author when their code converts.** The coin economy exists and is server-authoritative (`api/spend-coins.js`, `api/claim-badge.js`), so this is a small addition. But keep it modest and never notify a child to chase it — the ICP is explicitly suspicious of apps that turn kids into a growth mechanism, and the objection handling promises "no notification pressure." A quiet coin credit on next open is the ceiling.
- **Second surface, cheaper and faster:** the same idea on `/view/:slug`. A published book page should carry a soft, unobtrusive "make one of these" line for the grandparent who just opened the link. Depends on Bet 1 shipping first.

**Measure:** scans per printed order; installs attributed to the `ct` token in App Store Connect; print orders per active family.

**Why bet #2 and not #1:** it's smaller in absolute reach than search, but the conversion quality is extraordinary — you are reaching a parent who is *holding a printed book a child made* — and the asset already exists. It's mostly a two-day instrumentation job.

---

## Bet 3 — Own the long-tail search that your ICP actually types

**Days 55–120, publishing throughout.**

The ICP's search behaviour is documented in the brief: *"creative writing app for dyslexic child," "how to help my ADHD child start writing," "is it bad if my kid uses AI for schoolwork."* These are low-volume, high-intent, low-competition queries that a small site can genuinely rank for, and they compound for years.

There is currently no `/blog`, no articles, no content routes at all in `App.jsx`.

**Publish one substantial piece per week, 8–12 over the quarter.** Each must be genuinely useful with the product removed. Starting set, mapped to real queries:

1. *Why your child can tell a great story and can't write one* — the initiation-vs-composition explainer. The pillar piece.
2. *Sentence starters that actually work, by where you are in the story* — a free, printable list. You already have 28 position-sorted starters in `src/lib/sentenceStarters.js`; give them away. This is the most linkable asset you can make.
3. *Is it bad if my child uses AI to write? A framework for deciding* — argue the position honestly, including where AI *does* undermine the work. Directly addresses the campaign-deciding objection at the moment of search.
4. *What "dyslexia-friendly" actually means in an app — and what most apps mean by it* — high trust, high risk if you overclaim. State your own gaps in it.
5. *Screen time that ends: what to look for in an app with a finish line.*
6. *Handwriting is not writing: separating having the idea from forming the letters.*
7. *How to respond when your child says "I'm bad at writing."*
8. *A writing block that works on Chromebooks* — the educator-side piece; targets teacher search, links to `/teacher`.

**Rules:** no efficacy claims, ever. Cite real sources where you cite anything. Every piece names a limitation of your own product somewhere in it — that's both what makes it credible and what makes it link-worthy. Each piece ends with a soft, honest CTA, never a hard sell.

**Distribution:** each article is the *source material* for a week of Instagram, one Reddit comment where it genuinely answers a question, and one email. The article compounds; the posts don't. That asymmetry is the whole reason this is bet #3 rather than "post more."

**Also fix, cheaply:** per-route `<title>` and `<meta description>` for `/`, `/gallery`, `/example`, `/pricing`, `/teacher`. The whole site currently shares one title, "My Book Lab" (`index.html:26`) — which caps what any of it can rank for.

---

## Sequencing across the 90 days

| Days | Ship | Publish | Watch |
|---|---|---|---|
| **31–45** | Landing page P0 fixes (§6). Safety/moderation review for the gallery. Per-route meta. `robots.txt`. | 2 articles. Continue IG. | Landing page conversion vs. baseline. |
| **46–60** | Bet 1: SSR metadata + OG images for `/view/:slug`. Share-sheet fix. Gallery strip on the landing page. | 2 articles. First disclosed Reddit value posts. | Indexed pages; referral traffic to `/view/*`. |
| **61–75** | Bet 2: tracked QR redirect, rewritten `PromoPage`. Sitemap live and submitted. | 2 articles. Teacher outreach — 50 individually addressed emails. | Attributed installs from print; teacher trial starts. |
| **76–90** | Email infrastructure (§4 blocker) — ESP, lifecycle view, unsubscribe, cron. Then emails 1, 2 and 4 live. | 2 articles. | Signup→first-book conversion; finished-book→print-order rate. |
| **91–120** | Emails 3 and 5. Whichever of the two paywall over-claims survived triage (`PaywallView.swift:113` "Voice input & read aloud", `:114` "Up to 4 kid profiles") and the **$34.99 vs $39.99 hardcover price bug** must be gone before you scale print-order volume. | 3–4 articles. Evaluate the classroom pilot tier. | Organic sessions; gallery publishes per week; print orders per active family. |

## Two things that will quietly cost you the quarter if left alone

1. **The hardcover price bug.** `PrintOrderView.swift:38,117` displays **$34.99**; the server charges **$39.99** (`lib/print/pricing.js:2`). Every print order placed from the iOS app is a customer being charged $5 more than the screen said. That is a chargeback, a one-star review and a consumer-protection problem, and it sits directly on the conversion path you're about to invest in. **Fix before promoting print orders anywhere.**
2. **The in-app over-claims.** `PaywallView.swift:113` promises "Voice input & read aloud" (there is no speech recognition in the iOS app) and `:114` promises "Up to 4 kid profiles" (no profile model, table or switcher exists anywhere in the codebase). These are in the *shipping build*, on the *purchase screen*. Every honest thing in this document is undermined by a parent paying for two features that don't exist — and it's an App Store review risk on top. Pull both lines.

---

## Files referenced in this document

- `/Users/damianocanali/Documents/my-favorite-book/src/pages/LandingPage.jsx` — critiqued in §6
- `/Users/damianocanali/Documents/my-favorite-book/src/App.jsx` — routes; confirms `/view/:slug`, `/gallery`, `/teacher` (protected), no content routes
- `/Users/damianocanali/Documents/my-favorite-book/vercel.json` — SPA rewrite `/((?!api/).*)` → `/index.html`; single cron
- `/Users/damianocanali/Documents/my-favorite-book/index.html` — static OG/Twitter tags; `user-scalable=no`; single global `<title>`
- `/Users/damianocanali/Documents/my-favorite-book/src/lib/plans.js` — `free.maxBooks: 1`; Family $6.99/$54.99; Teacher $13.99/$109.99
- `/Users/damianocanali/Documents/my-favorite-book/lib/print/pricing.js` — hardcover 3999, softcover 1999
- `/Users/damianocanali/Documents/my-favorite-book/src/components/book/BackMatterPages.jsx` — App Store URL, QR promo page, Instagram handle
- `/Users/damianocanali/Documents/my-favorite-book/lib/print/pdf-html.js` — same untracked App Store QR in the print pipeline
- `/Users/damianocanali/Documents/my-favorite-book/api/publish-book.js` — public unauthenticated GET by slug / featured / recent
- `/Users/damianocanali/Documents/my-favorite-book/src/pages/ViewBookPage.jsx` — share handler with the stale `'My Favorite Book'` fallback at line 88
- `/Users/damianocanali/Documents/my-favorite-book/src/pages/GalleryPage.jsx` — consumes `?recent=true`, splits featured/recent
- `/Users/damianocanali/Documents/my-favorite-book/api/classroom.js` — 6-char code, `CODE_CHARS` excludes O/0/I/1
- `/Users/damianocanali/Documents/my-favorite-book/src/pages/SupportPage.jsx` — `support@mybooklab.app`

