# Review Notes

Two independent reviewers read the whole campaign before it shipped.

## Fact-check (hostile, code-verified)

**Verdict:** ship-with-edits · 16 required fixes

METHOD: I read the shipping Swift and the API/web source directly rather than trusting the product-truth brief. Files checked: CreateBookView.swift, StoryBuddyView.swift, PrintOrderView.swift, BookDetailView.swift, BookshelfView.swift, DrawingCanvasView.swift, GalleryView.swift, PaywallView.swift, AppIconPickerView.swift, OrderDetailView.swift, MainTabView.swift, SpeechSpeaker.swift, StoryIdeas.swift, RewardsStore.swift, all six Mascot*.imageset/Contents.json; api/story-buddy.js, generate-image.js, _aiGuard.js, _appAttest.js, classroom.js, classroom-submit.js, print-orders/create.js, lib/print/pricing.js; src/components/editor/PageEditor.jsx, AccessibilityToolbar.jsx, WritingScaffold.jsx, StoryBuddy.jsx, IllustrationGenerator.jsx, StoryEditor.jsx, StoryProgressMap.jsx, src/hooks/useSpeechSynthesis.js, useSpeechRecognition.js, src/stores/useAccessibilityStore.js, src/lib/sentenceStarters.js, plans.js, src/pages/PreviewPage.jsx, PricingPage.jsx, TeacherPage.jsx.

THE BRIEF'S OWN BIGGEST CLAIMS, SPOT-CHECKED — most held up:
- Story Buddy mechanics: CONFIRMED exactly. `starterCard` is wrapped in a Button calling `onInsert`; `questionCard` is a plain HStack with no interaction (StoryBuddyView.swift). `allowsChat` is `(book.authorAge ?? 0) >= 9`, and the chat bubble does carry an "Add to my page" button. The intro string is verbatim. `storyBuddyIdeas` only ever sends "starters" or "questions" — the API's `paragraph` intent is never called from iOS.
- Illustrate gating: CONFIRMED. `.disabled(generatingIllustration || savingDrawing || currentPageText.isEmpty)` at CreateBookView.swift:706.
- Print: CONFIRMED. Softcover 1999 in both app and server; shipping 499; quantity 1–10 (create.js:90); `country !== 'US'` hard-rejected (create.js:96). Apple Pay commented out at PrintOrderView.swift:296-299 — card-only is correct. Hardcover mismatch 3499 (app) vs 3999 (server) is REAL and blocks any hardcover pricing copy.
- Classroom: CONFIRMED IN FULL. CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' — the alphabet printed on post 12 slide 4 is character-for-character correct. classroom-submit.js is unauthenticated, nulls `coverImage` and every `illustrationData`, rate-limits 20/hr per IP; GET is deliberately public; TeacherPage stores classes in localStorage key 'my-favorite-book-teacher-classes'; no delete/edit/moderate/rubric/export endpoints exist; no student-seat code anywhere. Post 12 and Reel 8 are the most accurate deliverables in the set — no edits needed.
- Web starters: CONFIRMED. 8 opening / 12 middle / 8 ending = 28; 10 feelings, 10 actions. All five starters quoted in post 3 exist verbatim and are in the buckets claimed. Idle nudge is exactly 15000ms from 8 nudges. Post 3 needs no changes. (Minor, no fix needed: the editor surfaces only 4 random starters from the matching pool at a time — post 3 doesn't claim otherwise.)
- Offline: CONFIRMED. BookDraftStore.swift has no persistence; the only genuinely offline iOS feature is the 30 on-device shake prompts (StoryIdeas.swift — exactly 30). No deliverable over-claims offline.
- No push: CONFIRMED. grep for UNUserNotification / aps-environment / registerForRemote across ios-native/ returns nothing. Post 5's push claim is safe. PrintOrderActivityManager.swift's own header comment concedes the Live Activity only advances while the app is open — the ASO What's New handles this correctly.
- Reduce Motion, 4 app icons (Classic free / Rocket 100 / Rainbow 100 / Night Owl at streak_7), 64 emoji heroes (32+20+12), 6 worlds, 12-page sample book shown signed-out, 130-piece save confetti, 50-piece "The End" confetti, read-aloud rate 0.45 vs iOS default 0.5, 4-segment Live Activity bar, timeline labels ("Order placed / Payment confirmed / Sent to printer / In production / Shipped / Delivered") and Live Activity labels (🖨️ Sent to printer / 📚 Being printed / 🚚 On its way!): ALL CONFIRMED as written.
- ASO §0 blockers: all three CONFIRMED. PaywallView.swift:113-114 does ship "🎙️ Voice input & read aloud" and "👨‍👩‍👧 Up to 4 kid profiles" with nothing behind either. GalleryView.swift has zero occurrences of report/flag/block. All six Mascot imagesets declare 1x/2x/3x slots with no filenames.

UNVERIFIABLE RATHER THAN FALSE (leave as-is, but never harden):
- Print turnaround, delivery dates, fulfilment SLAs. Nothing in the repo establishes them; every deliverable correctly refuses to quote one. Keep that discipline — the seasonal ASO promo variant ("arrives before Christmas") is flagged in the doc as conditional and must not run without verified lead times.
- Efficacy, WCAG/UDL/COGA conformance, COPPA certification. No audit, VPAT or standards mapping exists. Post 13's slide 7 disclosure is the correct treatment.
- iOS subscription prices. PaywallView.swift:166 uses `localizedPriceString` from RevenueCat — no repo figure is authoritative. No deliverable quotes one. Good.
- Reel 1's "he's told you the same dragon story four times in the car" is archetypal framing, not a factual claim about a specific child — it passes. Reel 11's VO did not, which is why it's in the fix list.

ONE THING THE BRIEF GOT WRONG THAT I'D CORRECT UPSTREAM: the positioning docs state as VERIFIED that the hand-drawn badge is worth 25 coins vs the AI one's 15, and that "the app rewards that path more than the AI one". It does not — CreateBookView.swift:877 awards `added_illustration` for a hand drawing. This is a one-line code fix (`earn("drew_illustration")`) that would make three separate pieces of copy true, and I'd push for the fix rather than the edits, since the differential is one of the campaign's better differentiators. Until it ships, the copy must not claim it.

PRODUCTION NOTE FOR THE SHOOT: "Create a Book" from HeroLanding prompts sign-in when signed out (CreateBookView.swift:26-32), and Story Buddy hard-returns without an access token. Post 10's four checks and Reel 12's demo all require a signed-in free account, not a fresh install — the copy says "free tier", not "no account", so it's accurate, but budget for account creation in the ten-minute claim.

### Required fixes

#### ASO / Store Listing — §1.5 full description, "THE WORDS COME FIRST, THEN THE PICTURE" section

**Problem:** FALSE ON iOS. "The app rewards that path more than the AI one." It does not. `saveDrawing()` in CreateBookView.swift:877 awards `added_illustration` — the SAME badge, worth the SAME 15 coins, as the AI path at CreateBookView.swift:904. The `drew_illustration` badge ("Own Two Hands", 25 coins) exists at RewardsStore.swift:48 but is never awarded anywhere in ios-native/ — a grep for `earn("drew_illustration")` returns nothing. Worse, the badge a child actually receives for drawing by hand is labelled "Illustrator" and described on screen as "Generated an illustration". This claim recurs in the positioning brief and must be struck everywhere.

**Replacement:** And they can skip the AI entirely. There's a Draw button right next to
Illustrate: your child draws the page with a finger or an Apple Pencil, using
Apple's own pencils, crayons and markers, and that drawing is what goes into
the printed book. It exports at double resolution, so a hand-drawn page prints
exactly as well as a generated one.

#### Reel 3 ("The greyed-out button") — caption, third paragraph

**Problem:** FALSE ON iOS, same root cause. "the badge for using it is worth more coins than the badge for the AI one" — both routes award `added_illustration` at 15 coins (CreateBookView.swift:877 and :904). There is no coin differential in the shipping build. Do not publish this until `saveDrawing` is changed to `earn("drew_illustration")`.

**Replacement:** There's also a Draw button right next to it with no AI in it whatsoever — finger or Apple Pencil, Apple's own tool picker — and the drawing gets printed in the book exactly like a generated one.

#### ASO / Store Listing — §1.5 full description, closing line of "THE WORDS COME FIRST" section

**Problem:** FALSE ON iOS. "Every AI picture is labelled on screen as AI-generated and may not be perfect." A grep for "AI-generated" across ios-native/ returns only one hit — a code comment in Models/Book.swift:92. There is no on-screen label in any Swift view. The "AI-generated — may not be perfect" caption exists only in the web app (src/components/editor/PageEditor.jsx:105-107). Shipping this in App Store metadata is a Guideline 2.3.1 accuracy problem on exactly the claim a suspicious parent would check. Either add the label to CreateBookView's illustration slot before submitting, or cut the sentence.

**Replacement:** (Delete both sentences — "Every AI picture is labelled on screen as AI-generated and may not be perfect. We'd rather your child know." — and end the section at "The app also lets them skip it entirely." Restore the claim only after an "AI-generated — may not be perfect" overlay is added to the illustration slot in CreateBookView.swift, matching PageEditor.jsx:105-107.)

#### Feed post 13 (educators) — hook, slide 1 headline, slide 2 visual brief, and caption first line

**Problem:** FALSE. The toolbar is not above the text box. In src/components/editor/PageEditor.jsx the render order inside the text area is: read-aloud overlay → textarea (~line 172) → voice interim → WritingScaffold (line 206) → character counter → AccessibilityToolbar (line 226) → StoryBuddy. The toolbar sits BELOW the writing area, under the scaffold and the character count. The defensible half of the claim — always visible on the writing screen, never in a settings menu — is true and should carry the post. A teacher will screenshot this and correct you in the comments.

**Replacement:** Hook: "Four supports. On the writing screen. Never in a menu."
Slide 1 headline: "Four supports. / On the writing screen. / Never in a menu."
Slide 2 visual brief: "...real screenshot of the web page editor with the accessibility toolbar visible in the same view as the writing area, directly beneath it, all four controls legible."
Caption first line: "Four supports sit on the writing screen itself in the web editor — right under the text box, not in a settings menu three taps deep, which is the difference between a support existing and a nine-year-old actually using it."

#### Reel 8 ("Six characters on the whiteboard") — shot list 0:10-0:18

**Problem:** Same error as post 13. "the web PageEditor with the AccessibilityToolbar visible above the writing area" — it renders below the textarea (PageEditor.jsx:226). Filming it as directed will produce a shot that contradicts the direction.

**Replacement:** "Cut to the student side: the web PageEditor with the AccessibilityToolbar visible in the same view, directly below the writing area — four buttons: Read Aloud, Voice Input, Dyslexia Font, Focus Mode. Click Dyslexia Font and show the body type swap live. Then click Read Aloud and show the word-by-word yellow highlighting move across the text. THIS IS WEB ONLY — label it on screen."

#### Feed post 16 (educators) — caption paragraph 3 and first_comment

**Problem:** OVERSTATED. "the finished book exports to PDF through a dedicated print layout" and "PDF export is on the paid plans". There is no PDF generation anywhere. src/pages/PreviewPage.jsx:44-50 gates `plan.pdfExport` and then calls `window.print()` — it opens the browser's print dialog, rendering src/components/print/PrintableBook.jsx. No file is produced; the teacher must choose "Save as PDF" in the OS print sheet. iOS has no export path at all. This audience will hold you to the word "export".

**Replacement:** Caption: "On a paid plan the finished book opens in a dedicated print layout — not a screenshot of the editor, an actual laid-out book — which you print, or save as a PDF from your browser's print dialog. That's your hallway wall, your portfolio, the thing you hand a parent across the table in November."
first_comment: "If printing isn't in the budget: printing the book to PDF from your browser covers the hallway-wall and conference-night use, and a stapled colour print of it still reads as a book to a seven-year-old. The physical order is the upgrade, not the requirement."

#### Feed post 7 (printed book spotlight) — caption, first bullet

**Problem:** MISLEADING GIVEN A KNOWN BILLING BUG. "Hardcover also available — the current price is shown at checkout." The price shown in the app is wrong: PrintOrderView.swift:38 sets `unitCents = format == .hardcover ? 3499 : 1999` and line 117 displays "$34.99", while the server charges 3999 (lib/print/pricing.js:2). Pointing a parent at the in-app price as authoritative directs her to a figure $5 below what her card is charged. Say nothing about hardcover pricing until the app is fixed.

**Replacement:** → Softcover $19.99. A hardcover option exists too — we're not quoting its price here until a display bug on that screen is fixed.

#### Feed post 8 (gift angle) — caption, "practical bits" paragraph, and the on-image line

**Problem:** Same billing bug. "hardcover priced at checkout" points the buyer at PrintOrderView's $34.99 display, which does not match the $39.99 the server charges (lib/print/pricing.js:2 vs PrintOrderView.swift:38). A gifting post is the worst possible place for a price a parent will later dispute.

**Replacement:** The practical bits so you can plan: softcover $19.99, $4.99 flat shipping, US only right now, up to 10 copies in one order — which covers both sets of grandparents and a spare. (A hardcover option exists; we'll post its price once a display bug on that screen is fixed.)

#### Feed post 10 ("Open it before your child does") — caption paragraph after CHECK 4, and slide 6 body line

**Problem:** FALSE FOR THE AI HELPER. "There are daily caps on the AI helper and the illustrations." `enforceDailyCap` is imported and called only in api/generate-image.js — api/story-buddy.js never calls it. Story Buddy has an hourly rate limit only (STORY_BUDDY_LIMIT = 30/hr, halved to 15 for unattested requests via hourlyLimitFor). Separately, the web plan numbers (3 Story Buddy uses/day, 2 illustrations/day in src/lib/plans.js) are not enforced on iOS at all — there is no plan-based check anywhere in ios-native/, and the server's image cap is a flat per-user figure (50 attested / 20 unattested per day, api/_appAttest.js:193-197) independent of plan.

**Replacement:** Caption: "You can do all four with a free account without paying us anything. There are usage limits on the AI helper and the illustrations — enough to build a short book start to finish and see exactly how the help behaves."
Slide 6 body line: "You can build a book on a free account without paying. Usage limits apply to the AI helper and illustrations."

#### Feed post 15 (educators, "Three helpers") — caption, second mitigation bullet

**Problem:** NOT ENFORCED. "On the free tier the AI helper is capped at three uses a day, which is a natural ceiling while you trial it." `storyBuddyPerDay: 3` exists in src/lib/plans.js:9 but src/components/editor/StoryBuddy.jsx never reads it — there is no counter, no gate, no daily check anywhere in the component. (Contrast IllustrationGenerator.jsx:36-38, which does enforce `plan.imagesPerDay` client-side.) The only real ceiling is the server's hourly rate limit of 30 requests/hour in api/story-buddy.js. Offering an unenforced cap as a mitigation to the audience most likely to test it is the single riskiest line in the educator set.

**Replacement:** → The native iPad app ships only the starters and questions modes. The paragraph writer does not exist there.
→ The free plan advertises three Story Buddy uses a day, but I'll be straight with you: that cap isn't actually enforced in the browser yet — the only live ceiling is a server rate limit of about 30 requests an hour. Don't plan a class rule around the daily number.

#### Feed post 6 ("How the picture actually gets made") — caption steps 2 and 3, and slides 3 and 4

**Problem:** TWO PRECISION FAILURES. (a) Step 2 states moderation as unconditional. api/_aiGuard.js:102-127 fails OPEN twice: if OPENAI_API_KEY is unset it logs and returns null (allows), and on a transient provider error it also allows. Only the constructed image prompt is checked, and CreateBookView.swift:884 sends only `text.prefix(200)` — the first 200 characters of the page. (b) Step 3 says the style instruction "ends with" that phrase. The style constant (CreateBookView.swift:12) ends there, but the assembled prompt continues ", wide scene, landscape composition".

**Replacement:** Caption steps 2–3: "2. What they wrote goes through a content-moderation check before any image model sees it. If it trips, nothing is generated and your child gets a kid-safe message: \"Let's keep our story kind and friendly — try different words!\" It's a check, not a guarantee — if the moderation service is unreachable the request goes through rather than failing your child mid-sentence, and I'd rather tell you that than imply it's airtight.

3. Their sentence is joined to a fixed style instruction that's the same every time, and it includes: \"safe for kids, no text, no words, no letters.\" The \"no letters\" part is there for a boring practical reason — without it the model tries to print the story sentence inside the picture."
Slide 3 body: "...the text is checked by a moderation service. If it trips, nothing is generated and the child sees: [quote]. It's a check, not a guarantee."
Slide 4 body: "Every image request carries the same fixed style instruction, and it includes:"

#### ASO / Store Listing — §1.5 full description, "SAFETY, PLAINLY" bullet 4

**Problem:** OVER-CLAIM IN APP STORE METADATA. "Everything your child types is run through a content check before it reaches any AI." Three ways this is untrue: (1) api/_aiGuard.js moderatePrompt fails open when OPENAI_API_KEY is unset or the provider errors; (2) the illustration path only sends `text.prefix(200)` (CreateBookView.swift:884); (3) in api/story-buddy.js only the CURRENT page's text is moderated (line 217) — `buildSystemPrompt` then sends up to 30 previously written pages to the model unmoderated. The paragraph two lines below already says you won't promise perfection, so hedging here is consistent with the document's own voice.

**Replacement:** - What your child writes on the page they're working on is run through a
  content check before it reaches the AI, and blocked with a kind message
  rather than an error. It's a check, not a guarantee.

#### Feed post 1 caption (para 3) + ASO description ("THE APP WILL NOT WRITE THE STORY") + Reel 4 voiceover

**Problem:** IMPRECISE. All three say "Give me ideas" returns "three opening sentences". api/story-buddy.js:14-18 only asks for opening lines when `page.pageNumber === 1`; on every other page the prompt is "These should continue from where my story left off." So on pages 2+ a child gets continuation starters, not openings. A parent checking on page 3 sees something different from what you described.

**Replacement:** Post 1 caption: "\"Give me ideas\" gives your child three sentence starters — one line each, the kind a teacher writes on the board. On page one they're opening lines; after that they pick up from where the story left off. They tap one, and then they keep writing."
ASO description: "When your child gets stuck, Story Buddy has exactly two buttons. \"Give me ideas\" hands back three one-line sentence starters — opening lines on page one, and lines that pick up the story after that — and your child taps one and keeps going."
Reel 4 VO: "'Give me ideas' hands them three sentence starters — one line each, the kind of thing a teacher writes on the board — and they tap one and keep going."

#### Feed post 6 — slide 6 label on the right half

**Problem:** WRONG. "The Draw button is never greyed out." CreateBookView.swift:688 carries `.disabled(savingDrawing || generatingIllustration)` — Draw IS disabled while an illustration is generating or a drawing is uploading. The real and stronger point is that it has no text requirement, unlike Illustrate.

**Replacement:** "Or skip all of it. The Draw button has no text requirement at all — it never needed words. The drawing exports at 1536×1024, so it prints at the same size as a generated one."

#### Reel 11 ("Unboxing a book a seven-year-old wrote") — hook_line, voiceover, caption

**Problem:** FABRICATED FIRST-PERSON TESTIMONIAL. The shot list correctly mandates a demo book, a fictional author name and a demo order — yet the hook, VO and caption all assert a specific real event: "This came in the post today", "a seven-year-old typed every word in it", "There's a spelling mistake on page four and I asked them to leave it in", "it's been pulled off that shelf and read to us twice already". None of that is verifiable and the reel's own production notes say the artefact is staged. Feed post 9 explicitly bans inventing quotes; this is the same offence in VO form, aimed at the buyer who reads two-star reviews first.

**Replacement:** hook_line: "This is a real printed book made in the app, and every word in it was typed by a child — spelling mistakes and all, which we left in."
voiceover: "This is what actually arrives. It's a real softcover — nineteen ninety-nine — and every word in it is typed by the child, not generated. This is our demo book, so I'm not going to pretend it came out of my own letterbox this morning. The page here was drawn by hand, with a finger, and it printed at full resolution exactly like the AI ones did. And this is the bit that changes things: it goes on the shelf with the actual books."
caption: "Nineteen ninety-nine for the softcover, plus $4.99 shipping. US only at the moment.\n\nThis is our demo book, printed for real — not a customer's, and not a mockup.\n\nThe thing worth knowing: spelling isn't corrected, flagged or marked anywhere in the app. Whatever your child types is what prints. The second an adult starts fixing it, it stops being theirs.\n\nAnd it doesn't end up on the fridge for a month and then in the recycling in July. It's a book. It goes on the shelf."

#### Feed post 8 (gift angle) — caption "The versions that land hardest, from what parents tell us" + first_comment

**Problem:** UNVERIFIABLE SOCIAL PROOF PRESENTED AS REPORTED FACT. There is no research, no review corpus and no support archive in the repo to back "from what parents tell us", and the first_comment ("Genuinely the best version of this I've seen described: a parent who let their kid write a story about the family dog and gave a copy to every relative...") reads as a testimonial with an invented source. Post 9 sets the house rule that quotes must be real, verbatim and permissioned; this breaks it in the same set.

**Replacement:** Caption: "Three versions of this that we think work best — take them as suggestions, not as data:"
first_comment: "If you've done a version of this with your own child, tell us in the replies — we'd rather post your actual words than our guesses. House rule on this account: no invented quotes, first name and initial only, no photos of children."

## Creative director

**Verdict:** ship-with-edits · 9 required fixes

SHIP WITH EDITS. This is materially better than most funded work I see in this category. The voice is one human being with a point of view, the disclosure discipline is genuinely differentiating, and the CTA routing (parents → App Store, educators → mybooklab.app/teacher, never crossed) is correct in all 21 places it appears. The must-fix list is short because the spine is sound. But there are two structural problems that will cost you more than any single line.

PROBLEM 1 — PROOF MONOCULTURE. Two demonstrations carry the entire campaign. The non-insertable question card appears in posts 1 and 10, Reels 4, 7 and 12, Story Sequences 1, 3 and 6, and Comment Template A — nine placements. The greyed-out Illustrate button appears in posts 2, 6 and 10, Reels 2, 3, 7 and 12, Sequences 3 and 5, and Template B — ten. Both are excellent. Neither survives being shown nineteen times in six weeks. By week three the feed reads as one post posted repeatedly, and the very audience you have trained to inspect will notice you only have two things to show. Fix: assign each proof a lane. Question card = Reels only. Greyed button = feed only. Everything else has to find a third and fourth mechanic — the age-9 chat gate, the 30 on-device shake prompts, the moderation refusal string, the effort-only badge catalog, the parental gate — each of which is unused or used once.

Related: the car-story anecdote runs with the same numbers in post 4, post 11, Reel 1 and Sequence 6 frame 1. Four assets, one story. Keep it in Reel 1 (where it is a scene) and Sequence 6 (where it is a mirror). Cut it from post 4 and rewrite post 11 per the must-fix.

PROBLEM 2 — VALUE-FIRST IS 11%. Across 36 assets, exactly four give something away that works without the app: post 3, post 14, Reel 9, and post 11 once fixed. Everything else is a product demonstration, however honest. For a small account whose growth model is saves and staff-room screenshots, that ratio needs to be closer to one in three. The good news: post 3 proves you can do it well and cheaply — five real strings from src/lib/sentenceStarters.js, on paper cards, no app required. Commission five more in that mould before launch: the 10 feeling / 10 action words as a fridge printable, the position-aware three-pile method as a teacher one-pager, the three questions to ask a stalled writer, a "what to say instead of 'just write anything'" card, and the shake-prompt list as a car-journey game.

EDUCATOR GAP. Five posts and one reel, and four of the six are disclosure documents. Post 12 is six limits. Post 13 ends on "no VPAT, no conformance." Post 15 concedes Write for Me. Post 16 concedes there is no PO path. All correct, all necessary — but a teacher scrolling this gets a legal brief and no reason to want it. Post 14 is the only educator asset with something usable tomorrow. You need two more like it before this funnel converts.

THE THREE WEAKEST

1. Post 8 (gift angle). Generic gift-guide open ("Every year there's a present that gets played with for four days"), an unverifiable "from what parents tell us," a hardcover price you cannot currently quote, and a first comment containing an invented-sounding anecdote — in a campaign that ships post 9 specifically to refuse doing that. Rewrites in must-fix. The hook should also change: "The gift is the book she wrote" is fine but soft. Use "Ten pages, printed, with her name on the cover" — concrete beats sentimental with this buyer every time.

2. Post 11 (meme). The register slips exactly once in the whole campaign and it slips here: the child's meltdown becomes the punchline and the post is tagged as humour. Panel rewrite in must-fix. Keep the format — a two-panel diagnosis on the brand's own system rather than borrowed meme chrome is smart, and "Same kid. Same story. Different job." is the best single line in the set.

3. Reel 10 (mascot). Weakest hook in the campaign — "a first sentence, a question, and a high five" is brand-voice filler, not an open loop. No product proof in it. Hashtags reach developers. The naming ask duplicates Story Sequence 2. And the caption publishes "the App Store build shows a placeholder." Hold it until the art is in the asset catalog; the fix is an engineering ticket, not a copy edit. Caption rewrite in must-fix for the version that runs anyway.

THE TWO STRONGEST — AND THE PATTERN

1. Reel 3, "The greyed-out button." Thirty-four seconds, one screen recording, one voice memo, zero production cost, and a hook that is a genuine open loop: "I want to show you a button that doesn't work." The resolution IS the value proposition, so retention and message are the same thing. No adjectives anywhere. THE PATTERN TO REPEAT: negative demonstration — find a constraint in the product, film the constraint failing, let it resolve into the reason. It works because a constraint cannot be faked in a screen recording, and this buyer trusts mechanism over claim. Reel 7 executes the same pattern with one extra craft move worth institutionalising: cutting the music entirely at the concession (0:24) so the honesty is audible. Make that a house rule — silence marks every admission, in every asset.

2. Post 12, "Read this before you try it with a class." The limits are the pitch, not the footnote. Slide 6 — six constraints on recessed cards — is the most screenshot-worthy frame in the campaign and the one that will actually travel through staff-room group chats, which is how this audience buys. It also routes correctly to the web and nowhere near the App Store. THE PATTERN TO REPEAT: pre-emptive disclosure as the hook. "Including the parts that will annoy you" is a better opening line than anything a benefit-led headline would produce, and it works on parents too — post 4's slide 5 ("Not in the iPad app. Know before you pay.") and post 1's slide 7 are the same move and are the strongest slides in both carousels.

VOICE. Consistent and human throughout, with one systemic slip: the narrator alternates between "I" (Reel 4, Reel 3, post 12) and "we" (posts 1, 4, 5, 10, 13). On a founder-led account that difference is legible — she is deciding whether this is a person or a company. Pick "I" everywhere except where a policy is being stated on behalf of the product, and be consistent inside a single caption; post 4 uses both in four paragraphs.

OPS BLOCKERS, unchanged and now urgent because the calendar depends on them: (1) the $34.99/$39.99 hardcover mismatch blocks posts 7 and 8 and Sequence 7; (2) PaywallView.swift:113–114 still advertises voice input and four kid profiles, either of which a gifted creator will screenshot; (3) the drawing path awarding `added_illustration` instead of `drew_illustration` is now a marketing dependency, not just a bug — fix it and the coin claim in Template C becomes true and you get your best objection answer back.

### Required fixes

#### Stories/Community playbook — §3, "is this AI slop?" Comment Template C (the AI-illustration objection)

**Problem:** The coin figures are false in the shipping iOS app, and this is the single most-repeated trust anchor in the campaign. CreateBookView.swift:877 — the Draw/"Use it" path — awards `added_illustration`, which is 15 coins and labelled "Generated an illustration" in RewardsStore.swift:32. The 25-coin `drew_illustration` / "Own Two Hands" badge exists in the catalog (RewardsStore.swift:44) but is never awarded by any iOS code path. A parent who takes your advice and presses the buttons will draw a picture, see "Illustrator — Generated an illustration, +15", and screenshot it. You would be caught over-claiming on the one objection where you asked to be trusted.

**Replacement:** That one I'll give you — the illustrations are AI-generated and I'm not going to dress that up. Two things though. There's a Draw button right next to Illustrate: your kid draws it with a finger or an Apple Pencil, and *their* drawing is what goes into the book, printed at double resolution so it comes out as sharp as a generated one. And the Illustrate button won't fire on an empty page at all — the words have to exist first. If you'd rather your child never touch the AI art, the app works completely without it.

#### Reel 3 ("The greyed-out button") — caption, final paragraph

**Problem:** Same false claim: "the badge for using it is worth more coins than the badge for the AI one." Drawing awards the identical 15-coin `added_illustration` badge as generating. This is in the caption of your single strongest asset, which is the one most likely to be saved and re-checked.

**Replacement:** There's also a Draw button right next to it with no AI in it whatsoever — finger or Apple Pencil, and that drawing is what gets printed in the book.

Open it yourself before you hand it over. Takes ten minutes.

#### Feed post 2 caption, final paragraph — and the identical line on post 6, slide 6

**Problem:** "The Draw button is never greyed out" is not true. CreateBookView.swift:688 carries `.disabled(savingDrawing || generatingIllustration)` — it greys out while an illustration is generating or a drawing is uploading. Tiny inaccuracy, but this campaign's entire conversion mechanic is "go and verify me," and a parent who taps Draw mid-generation sees a greyed button ten minutes into the inspection you invited.

**Replacement:** One more thing worth knowing: there's a Draw button sitting right next to Illustrate, and that one has no text requirement at all. Finger or Apple Pencil, Apple's own tool picker, and the drawing goes into the book — including the printed copy. If you'd rather your child never touch the AI art, the app works completely without it.

#### Feed post 7 ("The last step is a book in the post") — caption, pricing block

**Problem:** "Hardcover also available — the current price is shown at checkout" is misleading given a live billing bug. PrintOrderView.swift:117 displays $34.99 on the format card; lib/print/pricing.js:2 charges $39.99. The price shown in the app is wrong, so pointing at it is worse than quoting a number. Your own Stories playbook declares this an ops blocker and then two feed posts ship hardcover copy anyway.

**Replacement:** → Softcover $19.99. (Hardcover is coming back to this post — we're fixing a price-display bug in the app first and I'm not going to quote a number I don't trust.)
→ $4.99 flat shipping.

#### Feed post 8 ("The gift is the book she wrote") — first comment

**Problem:** It is an unattributed, unverifiable, testimonial-shaped anecdote ("a parent who let their kid write a story about the family dog and gave a copy to every relative at once. Nobody put it down.") in a campaign that ships an entire post (9) refusing to write a fake quote, with a caption that says "We don't write these. We can't." This is the campaign contradicting itself in the same week, and it is the exact line a skeptical account would screenshot next to post 9.

**Replacement:** One practical thing: the order caps at 10 copies, which is usually two sets of grandparents and a spare. If you want one for each relative, do it as a single order rather than several — the $4.99 shipping is flat.

#### Feed post 8 caption — the "versions that land hardest" block and the pricing line

**Problem:** "from what parents tell us" is unverifiable social proof presented as a finding, and "hardcover priced at checkout" points at the wrong displayed price ($34.99 shown, $39.99 charged). Both fail the campaign's own standard.

**Replacement:** Three versions of this that are worth considering:

→ A book written FOR the person opening it. A story about grandma, given to grandma.
→ Siblings writing one each and swapping.
→ The child illustrating it by hand rather than generating the pictures, because the wobbly drawings are the whole charm in ten years. The Draw button is right there and the drawing prints at full size.

The practical bits so you can plan: softcover $19.99, $4.99 flat shipping, US only right now, up to 10 copies in one order — which covers both sets of grandparents and a spare.

#### Feed post 11 (the meme) — bottom panel copy and hashtags

**Problem:** "45 minutes. One meltdown." makes the child's meltdown the punchline, and #parentinghumour files a neurodivergent child's shutdown under comedy. This ICP is watching that exact meltdown at 8pm; she does not experience it as a bit. It is the one asset in the set where she would feel used rather than seen, and it undercuts the gentle-parenting frame every other asset holds perfectly.

**Replacement:** TOP PANEL: "The story he told me in the car:" / "40 minutes. Three characters. A twist."
BOTTOM PANEL: "The story that made it onto the page:" / "Four sentences."
BENEATH: "Same kid. Same story. Different job."

Hashtags: drop #parentinghumour. Replace with #writingsupport.

#### Reel 10 ("The guide who won't hold the pencil") — caption, final paragraph

**Problem:** You are announcing to a parenting audience that the shipping App Store build renders a placeholder where the character should be. Honest, but it publishes "our released app is unfinished" as a headline, in a reel that carries no product proof, whose hashtags (#mascot #characterdesign #indiedev #buildinpublic) reach developers rather than buyers, and whose naming ask collides with the naming mechanic already running in Story Sequence 2. My recommendation is to hold this reel until the art is in Assets.xcassets. If it must run now, cut the naming ask and reframe the disclosure so it is about the artwork, not about the build.

**Replacement:** Our story guide. His whole job is the first sentence and the question — he has no way to write the page and no way to finish it. The confetti is the only thing he's actually good at.

This one's animation, not a screen recording: he lives in the artwork and on the website while we finish bringing him into the app properly. I'll show you the real thing in-app the day he's there.

#### All 16 feed posts + all 12 reels — hashtag blocks

**Problem:** The Stories playbook sets the rule at 8–12 per feed post and names #edtech as a banned primary. The feed posts run 15–17 each and posts 12, 13, 15, 16 all carry #edtech. Two deliverables in one campaign giving different instructions is how a social manager ends up doing neither. Pick the playbook's rule and cut every set to it — the tail tags (#familylife, #thoughtfulgifts, #handmadegift, #bookishkids) are adding reach you don't want.

**Replacement:** Rule for every feed post: 10 tags maximum — 2 broad, 5 ICP, 3 rotating. Example, post 5: #screentimebalance #gentleparenting #parentingtips #creativewritingforkids #kidswriting #raisingreaders #homeschoolmom #ipadapps #adhdparenting #childrensbooks. Educator posts swap the ICP block for #teachersfollowteachers #writersworkshop #specialeducationteacher #slpsofinstagram #assistivetechnology and drop #edtech entirely.
