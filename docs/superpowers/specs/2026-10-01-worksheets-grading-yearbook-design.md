# Worksheets, grading and the "My Writing Year" book — design

Status: approved by the owner 2026-10-01. Builds on the schools design (`2026-09-26-schools-design.md`).

## Owner decisions

| Topic | Decision |
|---|---|
| Assignments | A teacher assigns either a **book** (as today) or a **worksheet** from a template |
| Worksheets | Filled in on iPad/web **and** printable for paper days |
| Grading | Four child-facing levels + 1–3 tips, with stickers/comments kept |
| Year-end book | **One book per child**, "My Writing Year", collected through the year |
| Printing | A **softcover per child is included** in the license, shipped to the school in one box; free PDF for every child |
| Pricing | **$19 per student per year** (minimum 10), founding $15 for 2026–27; school-wide plan $17 per student (minimum 150) replaces the $1,490 bundle; 300 pictures per child per year; trials don't include printing |

Cost basis (class of 25, per year): softcovers + bulk shipping ≈ $200, pictures ≈ $120 at the old 7,500 allowance, text AI + hosting + fees ≈ $30. At $19/student a class of 25 is $475.

App Store 3.1.3 still applies: no price, purchase or buy link in the iOS app. Schools buy on the web (Stage 4, with Stripe).

## 1. Grading with tips (Stage 1)

- Every hand-in (book or worksheet) can get a **level**: `getting_started` · `growing` · `got_it` · `wow` (EN "Getting started · Growing · Got it! · Wow!", IT authored, gender-neutral).
- **Tips**: 1–3 per grade, chosen from a tip library grouped by skill (ideas, order, word choice, spelling & punctuation), or custom (≤ 140 chars each). Library tips are stored as keys so the child sees them in their app language.
- Existing stickers and comment stay (`submission_feedback`).
- **Return to revise ("Try again")**: the teacher can return a submission with tips; the child sees "Your teacher sent this back with tips", revises, hands in again (version + 1). The teacher sees the version history and the previous grade.
- Teacher views: per assignment, every child's level at a glance; per child, their levels over time. **Export CSV** (student name, assignment, level, version, date) from the web.
- Children see only their own level and tips; never other children's; no rankings or totals across the class.
- Grades are part of the child's data: deleted with the account/class purge.

## 2. Worksheet assignments (Stage 2)

- Templates (v1): story map; character profile; beginning–middle–end; five senses (describe a place); letter to a character; opinion paragraph (OREO); acrostic poem; sequence of events; "my week" journal page.
- A template is a list of boxes, each with a prompt and an optional size; the teacher can edit prompts before assigning. Stored on the assignment as JSON (template id + edited prompts) — prompts are teacher text.
- The child fills it in on iPad/web: big boxes, the prompt above each, read-aloud of prompts, dictation, word help; autosave; hand in like a book.
- Graded with the same levels/tips; can be returned to revise.
- **Turn into book pages**: one tap makes book pages from a finished worksheet (e.g. a story map becomes the start of a story).
- **Print**: every template prints (reuse the `/worksheets` print system); a printed sheet carries the assignment title and the child's name.

## 3. "My Writing Year" book (Stage 3)

- Per child, built during the year: the teacher marks a graded hand-in **"Add to Writing Year"**; the child can suggest a piece (teacher approves).
- Contents: cover (child's avatar + "My Writing Year 2026–27" + name), chosen pieces in order (books as pages, worksheets laid out as pages), an "About me" page the child fills in, optional teacher note at the end.
- Year-end screen (teacher): every child's book, reorder/remove pieces, preview, **Print the class books** → one Lulu order with every softcover, shipped to the school address in one box; no payment step (included in the license). Free PDF per child, downloadable by the teacher.
- A child leaving mid-year: print early or PDF.
- Print uses the existing Lulu pipeline (softcover), the book's language for back matter.

## 4. Pricing and purchase (Stage 4, with Stripe)

- Per-student pricing replaces per-class. A license covers a number of seats (students); the teacher/school buys seats on the web.
- Included per seat: one softcover at year end, 300 pictures/year, all features.
- School-wide plan: $17/seat, minimum 150 seats, one invoice (card or invoice billing as already designed).
- The in-app picture caps change from per-class allowance to per-seat (300 × seats).

## Build order

1. Grading & tips (iPad + web + API + migration).
2. Worksheets (iPad + web + print).
3. Writing Year book + class printing.
4. Pricing + Stripe purchase.

Each stage ships on its own and is usable by itself.
