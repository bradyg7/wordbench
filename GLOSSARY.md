# Glossary

The words this project has defined, one heading each, A to Z: the app's words (what the person sees) and the words
used about building and checking it. It is not complete yet: a word a design uses that is not here is added first. Search for a heading, or for a word in an *Avoid* line to find what replaced it. Why the app
works the way it does is in [the principles](design/features/principles/README.md#1-goals-and-rules), read first.

**How an entry reads.** A short meaning in plain English. *Avoid:* words not to use for this thing; when an avoided word
has its own entry, a few words say how they differ. *In code:* the name in files, code or `wb`, where it differs.
*Not yet grilled* marks a word moved here from the old Library map (2026-11-24) whose meaning and worth to the app
have not been tested in a grilling since; the mark comes off when one settles it.

**Rules** (the person, 2026-11-24):
- A new word, or a new meaning for an existing word, is the person's decision, dated, and is written here first.
- A word that changes meaning keeps one line, "Until <date>: meant …", and the code and docs are searched for the old
  use.
- A retired word gets no entry of its own: it lives in the *Avoid* line of the word that replaced it, so a compound that
  keeps it (a **margin note**) is never confused with it.
- A builder never uses an avoided word in the window.

## A

### Accepted
A design folder the person has marked ready to build, after playing its prototype. Building starts only from an
accepted folder. On 2026-11-24 the person took every folder back to *up for redesign*.

### `any`
A TypeScript type that means "anything". The compiler stops checking a value typed `any`, and the unchecking spreads to
everything it touches (it "leaks").

### Annotation
Anything the person puts *on* a source text, the Bible first and any **reference works** entry too, as one marks up
a textbook: a **highlight**, **underline**, **circle**, **box**, **arrow** or **margin note**. It never changes the
text. All annotations are one family, named in one **Legend**, and stay easy to reach and to search. To *mark up* is
the act of adding any of them. This is how the person makes their Bible their own and stays organized in it. Whether
a margin note can sit on a reference-work entry is open (the person, 2026-11-25). Until 2026-11-25: called a mark, and
only on the Bible.
*Avoid:* mark, markup. *In code:* `marks/<BOOK>.json`, `wb mark` (renamed by a designed ticket; the files on disk only
by a designed, backed-up move). Decided by the person, 2026-11-18 (marks MK7-1) and 2026-11-25 (the word).

### Arrow
An **annotation**: a line drawn from one place in the text to another in the same chapter. Whether it stays, beside a
personal cross-reference feature still to be designed, is settled in the annotations grilling. *In code:* `wb mark add
… --kind arrow --to PLACE`. Decided in marks (MK7-1, the person, 2026-11-18).

## B

### Baseline
The committed number a ratchet compares against. Lowering it after a clean-up is a normal edit.

### Bible
The KJV text, the only Bible in the app and its steady centre; YLT is archived. Read-only: the app never changes it.
No other translation for a long time, and then only a public-domain one from credible manuscripts. The app exists to
get the person reading the Word and making it their own, never to stand in for reading it (the person, 2026-11-25).
*In code:* the Bible database (`bible`, `lookup`), opened with SQLite's read-only flag.

### Blocked, blocked by
An issue is blocked while another issue it waits on is still open: its question cannot be answered well until that
answer exists. It is unblocked when every issue blocking it is closed. On GitHub this is the issue's own "blocked by"
link, shown as a badge. Being blocked never takes an issue off the map; it only sets when it is taken (the person,
2026-11-25).

### Box
An **annotation**: a box drawn around words; its form is settled in the annotations grilling. Decided in marks (MK7-1,
the person, 2026-11-18). *Avoid* it for a **callout**, which is in a page, not on the Bible text.

### Builder
The agent that builds one ticket in the Main clone and reports. It never invents behavior the design leaves open: it
stops, and the lead brings the question to the person.

## C

### Callout
A highlighted block in a page, of one kind: Question, Answered, Key point or Note. *Not yet grilled.*
*Avoid:* box (a **box** is a mark on the Bible text), note box. Decided by the person, 2026-11-20.

### Checker switch
A line in the code that turns a checker off for one spot: `#[allow(...)]` in Rust, `@ts-ignore` or `eslint-disable` in
TypeScript. Allowed only with a recorded reason.

### CI
Continuous integration: GitHub's own computers run the checks and tests on every push, so nobody waits for them on this
PC. A change reaches `main` only when they pass ("green").

### Circle
An **annotation**: a ring drawn around words; its form is settled in the annotations grilling. Decided in marks
(MK7-1, the person, 2026-11-18).

### Claim
Assigning an issue on GitHub to the person, first, before any work on it, so another session does not take the same
one. An open issue with no one assigned is unclaimed.

### clippy
Rust's own code checker. It reads the code without running it and warns about mistakes and clumsy ways of writing
things.

## D

### Concordance
The list of every place a word appears in the Bible: one part of a **word study**. Strong's is its model.

### Design clone
`C:\Users\brady\github\wordbench-workspaces\Design`: where designing with the person happens. It never changes existing
code, starts from an up-to-date `main`, and designs at most the next feature (the person, 2026-11-23).

### Design folder
`design/features/<folder>/`: one feature's README (its decisions and its *what must be true* items) and its
`prototype/`.
[`coverage.md`](design/features/coverage.md) lists every area and its folder.

### Destination
What reaching the end of a **map** looks like: the decision, spec or change it is finding its way to. It is named first
and fixes what is in scope.

### Document
A finished, well-made file (Word, PDF or the like) put together from what the person studied, to share and use: a
lesson, a handout, a sermon. A mainstay of the app: how a study leaves it. Its menu is clunky today and is redesigned,
not cut (the person, 2026-11-25). *In code:* `documents/`.

## F

### Feedback
The person's note about the app itself (a bug, a wish, a kindly meant complaint), not about study, kept outside the
study proper. Meant to reach the project from every user, not only by text message. Until 2026-11-25: called a
finding. *Avoid:* finding (in the app). *In code:* `findings/`, `wb finding`.

### Feel check
The person's short play of a release build before it is published, for how it feels, not a list of functions.

### Feel quality
One of the fixed set of ways an action should feel: Instant, Quick, Steady, Clear, Forgiving, Familiar, Readable, each
with its standard and bar in [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md#the-feel-qualities). A *what must be true*
item's "You feel" line names the one or two most at risk. The set grows only through retros.

### Filter
A chip that narrows a list by one property. Every chip must match; the values in one chip match any. Every list that
can be narrowed uses the one chip component and the one `--filter` form. Kept (the person, 2026-11-25).
*Avoid:* applied value, typed filter. Decided by the person, 2026-11-22 (filters-v2).

### Fixture
Test data kept in the repo. A fixture that holds scripture is generated from the database, never typed.

### Flaky test, flake
A test that passes and fails on the same code. Usually it waits a fixed time instead of waiting for the thing itself.
Fixed at the cause, never hidden.

### Fog
Decisions a **map** can tell are coming but cannot yet ask precisely, because they hang on answers still open. Written
loosely in the map's *Not yet specified* section; a patch becomes one or more issues once the answers before it exist.
*Avoid:* backlog (a backlog holds work already sharp enough to do).

### Folder
A group of pages and saves, which may keep a color: what keeps one study or topic apart from another (a study of
baptism may begin as a folder of saves, then gain a page). The color shows quietly wherever the folder's things appear
(a page, a verse, a Strong's entry), and its name on hover or click. A page may be in several folders. Kept; research
may yet find a better way to organize (the person, 2026-11-25).
*Avoid:* thread, which is retired; its files are moved into colored folders by a designed, backed-up move.
*In code:* `sets/`, legacy `threads/`, `folders.rs`; `wb folder list`; `wb thread` keeps its name. Decided 2026-11-17 and by the person,
2026-11-18.

### Frontier
The issues on a **map** that can be taken now: open, unblocked and unclaimed.

### Full suite
Every test: `cargo test`, the UI unit tests, the WebKit and Chromium tests and axe. It runs in CI on pull requests and
on `main`, and never on this PC, with one exception: while Actions minutes are out, through `scripts/ci-local.ps1`
(the person, 2026-11-24).

## G

### Grilling
A session where the lead asks the person every open decision in rounds, each with a recommended answer, until nothing
is left assumed. Every design, and every turnaround step, starts with one (`/grilling`).

### Guide
The app's help: a walk-through the first time it opens, and explanations of each feature, grown as the app is built
(the person, 2026-11-25).

## H

### Highlight
An **annotation**: a color laid over words, put on near-instantly; its forms are settled in the annotations grilling.
*In code:* `highlights/` (old highlights),
`wb mark add … --kind highlight`.

## I

### Issue
One item on the repository's GitHub issue tracker (`bradyg7/wordbench`), with a number, a title, labels and comments.
In this project an issue holds a **map** or one decision on it; the result of a decision is written into the repo's
files when the issue closes, so nothing decided lives only on GitHub (the person, 2026-11-25). Outside this project
"issue" is the general word on GitHub and GitLab for any tracked item: a bug, a request or a task. *Avoid* calling a
map's decision a **ticket**. *In code:* `gh issue`, labels `wayfinder:*`.

## L

### Lead
The agent (Claude Opus) that designs with the person, cuts a design into tickets, delegates each one, has it reviewed
and writes the handoffs. The lead does not build a ticket itself.

### Legend
The person's own list of what each of their **annotations** means: a name for each style. It must be easy for anyone,
the least technical included, to make, change and read. Kept (the person, 2026-11-25). *In code:* `settings/legend.json`,
`wb legend`.

### Link
A reference from a **page** to anything in the app, found by itself as it is written and shown from both ends, so
pages stay connected and build on each other. Kept; how it works and how easy it is to reach is redesigned (the person,
2026-11-25).

### Lint, linter
A rule a code checker applies, and the checker itself (clippy for Rust, typescript-eslint for TypeScript).

## M

### Main clone
`C:\Users\brady\github\wordbench-workspaces\Main`: where all code work happens, one branch at a time (the person,
2026-11-23).

### Map
The one **issue** labelled `wayfinder:map` that lists the way toward a **destination**: the decisions made so far (one
line each, linking the issue that holds it), the **fog** and what is out of scope. Its decisions are its sub-issues.
It is an index: a decision lives only in its own issue. Made and worked with `/mattpocock-skills:wayfinder`.

### Margin note
An **annotation**: writing in the margin, where thoughts have always been written. It always sits beside some place,
from one verse to a whole book, so it can be found again from the text; a thought that belongs to no place is a
**page**. It can grow into a page. Kept (the person, 2026-11-25). *In code:* `margin/`, `margin.rs`.

### Live list
A list kept inside a **page** that shows what matches its **filters** each time the page is opened, like a database
view in Notion; built from filters, not typed words. Until 2026-11-25: called a saved list. *Avoid:* saved list, view.
*In code:* `pageviews.rs` (a ```` ```view ```` block). Decided by the person, 2026-11-25; whether a folder's index is
one is open in the Notebook issue.

## N

### Named state
A name in brackets, like `[narrow Notebook]`, for one state of the app that a *what must be true* item starts or ends
in. All of them are listed under [Named states](#named-states) below. A reviewer searches for the bracketed name to find
every item that meets that state (the person, 2026-11-23, Q31).

### Notebook
The person's one notebook, organized by folders: it holds the folders and the pages. It must be fast, good-looking and
never annoying; Notion is the model to learn from, through a written list of its features. Kept (the person,
2026-11-25). *Avoid:* journal, workbook.
*In code:* `notes/`, `notebook.rs`.

## O

### Original word
The one Hebrew or Greek word behind one or more English words of the Bible. Pointing at any of those English words
shows all of them with a **passing outline**, with its definition (the person, 2026-11-25).

### One-way door
A decision that is hard to reverse (a study-folder format, the read-only database, a retired word). Each is listed in
[principles §3](design/features/principles/README.md#one-way-doors).

## P

### Page
Anything written: a study, a lesson, a sermon, a prayer, a thought. Anything in the app can be referenced from it (a `/`
command or the page's properties), and each reference links both ways, found by itself as it is written, with no
manual linking. Its text is searchable. Kept, as Notion uses it (the person, 2026-11-25).
*Avoid:* note (a **margin note** is its own thing), entry. *In code:* `notes/**.md`, `pages.rs`. Decided 2026-11-09.

### Page property
A named value kept in a page's front matter (`props:`), shown as a column in a list. Kept, under the word Notion and
Obsidian use; making properties the person's own and easy to learn is designed after research (the person,
2026-11-25). *Avoid:* field, attribute, detail. Decided by the person, 2026-11-22 (filters-v2, NB14).

### Parking lot
[docs/turnaround-parked.md](docs/turnaround-parked.md): where new ideas wait while the turnaround is followed in order.

### Passing outline
How the app shows, for a moment, which words belong together (the English words of one **original word**). It is not
an annotation, is never kept, and goes at the next click. *Avoid:* highlight (that is an annotation). Decided by the
person, 2026-11-25.

### Play
What the person does with a prototype: use it as if it were the app, to judge how it works and feels before it is built.

### Prototype
A throwaway version of a feature, made quickly (`/prototype`) so the person can play it and judge how it feels before
the real one is built. It reads the app's code but adds only its own files.

## Q

### Question
A question the person wrote anywhere (a page or a margin note), open or done. It is found by itself in what is
written, as scripture references are; the Question callout is a way to mark one explicitly. *On trial*: it stays only
if its feature's grilling shows it earns its place (the person, 2026-11-25).
*In code:* `questions.rs`. The old `trails/` files (questions to follow up) fold into Questions by a designed,
backed-up move (the person, 2026-11-18).

### Quick checks
The CI checks that take about 3 minutes: formatting, clippy, the TypeScript compiler and the search for TODO notes. They
run on every branch push.

## R

### Ratchet
A count that may go down but never up. A script counts something unwanted (`any`, `unwrap()`, checker switches) and CI
fails if the count rises above the committed number.

### Reading plan
A plan of what to read, and a record of what has been read: the person's own work, made and changed to fit them.
Kept (the person, 2026-11-25). *In code:* `plans`, `reading`.

### Real study folder
The person's own study files (`github\bible-study-data`, `Documents\wordbench-study-data`, or the folder the installed
app names). Tests use a scratch copy.

### Reference works
The books the person curates beside the Bible: Strong's (with its interlinear, part of it, not a book of its own),
BDB and Webster's 1913 (not yet in the app without a script). Only works that define and do not steer doctrine,
public domain or freely licensed and long-lasting, as Strong's has stayed true to the KJV for centuries; no
commentaries or devotional material, ever, nothing that crowds out reading the Word; people do not add their own yet.
Any entry can be saved, annotated, and so referenced in a page. Kept (the person, 2026-11-25); whether they are one
book or a shelf is open in books.
*In code:* the Bible database and `dictionary.db`.

### Resolve (an issue)
Answer a map's issue in the way its type asks (a grilling, a prototype the person plays, research, or a task done),
then post the answer as a comment, close the issue, write the result into the repo's files and add one line to the
map's *Decisions so far*. One issue per session, except research. *Avoid:* fix (an issue here is a decision, not a
bug).

### Reviewer
The agent that checks one ticket's diff against its design and the rules, runs its new tests, and shows each new test
failing with the change reverted. It reports; it does not edit.

## S

### Save
A pointer to a verse, phrase, word, page, search or document; never a copy. A save that no longer points anywhere is
shown, not hidden. Kept, and revisited when saves are designed (the person, 2026-11-25). *Avoid:* place (as a set
item), bookmark (it reads as one's place in a book). *In code:* set items, `places.rs`; `wb save`,
`wb save rm`, `wb save where`. Decided 2026-11-17.

### Search
Finding anything written or saved, the person's or a source's, by a word, a topic or a verse. The goal is one search
over everything; today it is two, the Bible (`wb search`) and the person's own work (`wb find`: pages, folders,
saves, questions, margin notes, highlights). Not searched yet: underlines, documents, findings, lessons and
reference-work text. Kept; the many commands that reach it today are overhauled (the person, 2026-11-25).

### Smoke run
A short run of the real release build: open it on a scratch study folder, write a page, press Enter, reopen, check the
file on disk. If it fails, nothing is published.

### Spec
One test file of the UI tests (`ui/tests/*.spec.ts`), usually one feature or behavior.

### Study folder
The one folder on the computer that holds everything the person has made: pages, annotations, folders, saves, reading
plans, feedback and settings, in this app's formats. Back it up and the whole study is backed up. The Bible and
reference works are not in it; they come with the app. The app makes it by itself, and settings can point to another.
See **Real study folder** for the one that must never be touched by tests. *Avoid:* Library (until 2026-11-25 the
study folder and the Bible database together, and a page's name; *in code:* `library.rs`). Decided by the person,
2026-11-25.

## T

### Ticket
A few *what must be true* items cut from a design, each buildable and testable on its own, built by one builder in one
session and checked by one reviewer. Outside this project (Jira, help desks) "ticket" means any tracked item and is
often the same thing as an **issue**; here it is narrower: a unit of building, never a decision. Matt Pocock's skills
call a map's decisions "tickets"; in this project they are **issues** (the person, 2026-11-25). Where tickets are kept
is decided on the map.

### Trash
Where deleted things wait until it is emptied, so a delete can be turned back (the person, 2026-11-25).

### Trail
Back and forward through where the person has been, and only that: what makes a rabbit trail rewarding instead of a
way to get lost. Kept; it may grow into the app's history, as its prototype shows, and its clunky menu is redesigned
(the person, 2026-11-18 and 2026-11-25). *Avoid* it for questions to follow up: those are **questions**. *In code:* `history/`, `history.rs`.

## U

### Underline
An **annotation**: a line under words, single, double or triple; whether all three stay is settled in the
annotations grilling. *Avoid:* pencil, pencil line. *In code:*
`pencil/` (old lines), `wb mark add … --kind underline --lines 1|2|3`. Decided in marks (MK7-1, the person,
2026-11-18).

### Unfiled
The one fixed folder where a save put in no folder lands: shown like any folder, its saves searchable as any, and filed
from there. Kept (the person, 2026-11-25). *Avoid:* Shelf, Unsorted, Inbox. *In code:* `shelf.rs`, `wb shelf saves`. Decided by the person, 2026-11-18.

### `unwrap()`
Rust for "this cannot fail". If it does fail, the program stops (it "panics") instead of showing a message.

## W

### Wayfinding
Finding the way to a **destination** too large and unclear for one session: chart a **map** of decision issues, then
resolve them one per session until nothing is left to decide. It plans; it builds nothing. The words it uses are
**map**, **issue**, **blocked**, **claim**, **frontier**, **fog** and **resolve**.

### What must be true
The short list in a design folder that replaces the interaction table: one item per thing a person does, in the form
set out in [how work is done](docs/agents/how-work-is-done.md#designing-a-feature). The person writes and checks the
first four lines (before, do, after, feel); the builder fills the last (on disk, `wb`, proven by) and the reviewer
checks it.

### Word study
Everything about one word, reached from any word in the text: its **original word**, its definitions and its
**concordance**. The plain way in for someone who does not know what a concordance, an interlinear or a lexicon is.
Whether it is one place or several stays open, so it is never clunky to find one thing (the person, 2026-11-25).
*Avoid:* concordance for the whole.

## Named states

Every *before* and *after* in a *what must be true* item uses a name from this list, in brackets. A new state is added
here first, one line each, grouped by area; names that mean the same state are merged. If the list grows large it may
move to its own file. **Empty for now**: the first names come from the first grillings and prototypes.

*An example of the form, not a real state:* `[narrow Notebook]`: the Notebook pane narrower than its side list needs,
so the list is hidden.
