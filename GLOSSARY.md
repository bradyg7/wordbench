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

### Arrow
A mark: a line drawn from one place in the text to another in the same chapter. *Not yet grilled.*
*In code:* `wb mark add … --kind arrow --to PLACE`. Decided in marks (MK7-1, the person, 2026-11-18).

## B

### Baseline
The committed number a ratchet compares against. Lowering it after a clean-up is a normal edit.

### Bible
The KJV text, the only Bible in the app; YLT is archived. Read-only: the app never changes it. *Not yet grilled.*
*In code:* the Bible database (`bible`, `lookup`), opened with SQLite's read-only flag.

### Blocked, blocked by
An issue is blocked while another issue it waits on is still open: its question cannot be answered well until that
answer exists. It is unblocked when every issue blocking it is closed. On GitHub this is the issue's own "blocked by"
link, shown as a badge. Being blocked never takes an issue off the map; it only sets when it is taken (the person,
2026-11-25).

### Box
A mark: a box drawn around words. *Not yet grilled.* Decided in marks (MK7-1, the person, 2026-11-18).
*Avoid* it for a **callout**, which is a block in a page, not something on the Bible text.

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
A mark: a ring drawn around words. *Not yet grilled.* Decided in marks (MK7-1, the person, 2026-11-18).

### Claim
Assigning an issue on GitHub to the person, first, before any work on it, so another session does not take the same
one. An open issue with no one assigned is unclaimed.

### clippy
Rust's own code checker. It reads the code without running it and warns about mistakes and clumsy ways of writing
things.

## D

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
A Word or PDF file made from a folder or a page. *Not yet grilled*: its menu is clunky and its worth unclear (the
person, 2026-11-18). *In code:* `documents/`.

## F

### Feel check
The person's short play of a release build before it is published, for how it feels, not a list of functions.

### Feel quality
One of the fixed set of ways an action should feel: Instant, Quick, Steady, Clear, Forgiving, Familiar, Readable, each
with its standard and bar in [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md#the-feel-qualities). A *what must be true*
item's "You feel" line names the one or two most at risk. The set grows only through retros.

### Filter
A chip that narrows a list by one property. Every chip must match; the values in one chip match any. Every list that
can be narrowed uses the one chip component and the one `--filter` form. *Not yet grilled.*
*Avoid:* applied value, typed filter. Decided by the person, 2026-11-22 (filters-v2).

### Finding
The person's note about the app itself, not about study, kept outside the study proper. *Not yet grilled.*
*In code:* `findings/`, `wb finding`.

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
A group of pages and saves, which may keep a color. The color shows quietly wherever the folder's things appear (a
page, a verse, a Strong's entry), and its name on hover or click. A page may be in several folders. *Not yet grilled.*
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

## H

### Highlight
A mark: a color laid over words, put on near-instantly. *Not yet grilled.* *In code:* `highlights/` (old highlights),
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
The person's own list of what each of their marks means: a name for each style of mark. It must be easy for anyone,
the least technical included, to make, change and read. *Not yet grilled.* *In code:* `settings/legend.json`,
`wb legend`.

### Library
The whole workbench: the study folder and the read-only database together, and the name of a page in the app. *Not
yet grilled*: the person expects the word to be retired or changed (2026-11-24). *In code:* `library.rs` (in wb-core
and wb-cli).

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
A mark: writing beside a verse or a span of verses. It can grow into a page. *Not yet grilled.* *In code:* `margin/`,
`margin.rs`.

### Mark
Anything the person puts *on* the Bible text: a highlight, underline (single, double or triple), circle, box, arrow or
margin note. All marks are one family with one legend. *Not yet grilled.*
*Avoid* it for anything not on the text: a reference-work entry is *saved*, not marked. *In code:* `marks/<BOOK>.json`,
`wb mark`. Decided by the person, 2026-11-18 (marks MK7-1).

## N

### Named state
A name in brackets, like `[narrow Notebook]`, for one state of the app that a *what must be true* item starts or ends
in. All of them are listed under [Named states](#named-states) below. A reviewer searches for the bracketed name to find
every item that meets that state (the person, 2026-11-23, Q31).

### Notebook
The person's one notebook, organized by folders: it holds the folders and the pages. It must be fast, good-looking and
never annoying; Notion is the model to learn from, through a written list of its features. *Not yet grilled.*
*In code:* `notes/`, `notebook.rs`.

## O

### One-way door
A decision that is hard to reverse (a study-folder format, the read-only database, a retired word). Each is listed in
[principles §3](design/features/principles/README.md#one-way-doors).

## P

### Page
Anything written: a study, a lesson, a sermon, a prayer, a thought. Anything in the app can be referenced from it (a `/`
command or the page's properties), and each reference links both ways, found by itself as it is written, with no
manual linking. Its text is searchable. *Not yet grilled.*
*Avoid:* note (a **margin note** is its own thing). *In code:* `notes/**.md`, `pages.rs`. Decided 2026-11-09.

### Page property
A named value kept in a page's front matter (`props:`), shown as a column in a list. *Not yet grilled.*
*Avoid:* field, attribute. Decided by the person, 2026-11-22 (filters-v2, NB14).

### Parking lot
[docs/turnaround-parked.md](docs/turnaround-parked.md): where new ideas wait while the turnaround is followed in order.

### Play
What the person does with a prototype: use it as if it were the app, to judge how it works and feels before it is built.

### Prototype
A throwaway version of a feature, made quickly (`/prototype`) so the person can play it and judge how it feels before
the real one is built. It reads the app's code but adds only its own files.

## Q

### Question
A question the person wrote anywhere (a page or a margin note), open or done. It is found by itself in what is
written, as scripture references are; the Question callout is a way to mark one explicitly. *Not yet grilled.*
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
A plan of what to read, and a record of what has been read. *Not yet grilled.* *In code:* `plans`, `reading`.

### Real study folder
The person's own study files (`github\bible-study-data`, `Documents\wordbench-study-data`, or the folder the installed
app names). Tests use a scratch copy.

### Reference works
The books the person curates beside the Bible: Strong's concordance, BDB, Webster's 1913 and the interlinear. Public
domain or freely licensed and long-lasting; no commentaries, ever; people do not add their own yet. Any entry can be
saved, and so referenced in a page. *Not yet grilled*: whether they are one book or a shelf of books is open in books.
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
shown, not hidden. *Not yet grilled.* *Avoid:* place (as a set item). *In code:* set items, `places.rs`; `wb save`,
`wb save rm`, `wb save where`. Decided 2026-11-17.

### Saved list
A list of things kept with its filters, to open again. *Not yet grilled.* *Avoid:* view. *In code:* `views.rs`,
`pageviews.rs`. Decided in settings (S5).

### Search
Finding anything written or saved, the person's or a source's, by a word, a topic or a verse. The goal is one search
over everything; today it is two, the Bible (`wb search`) and the person's own work (`wb find`: pages, folders,
saves, questions, margin notes, highlights). Not searched yet: underlines, documents, findings, lessons and
reference-work text. *Not yet grilled.*

### Smoke run
A short run of the real release build: open it on a scratch study folder, write a page, press Enter, reopen, check the
file on disk. If it fails, nothing is published.

### Spec
One test file of the UI tests (`ui/tests/*.spec.ts`), usually one feature or behavior.

### Study folder
The folder of the person's own work: pages, marks, folders, saves and settings, in this app's formats. See
**Real study folder** for the one that must never be touched by tests.

## T

### Ticket
A few *what must be true* items cut from a design, each buildable and testable on its own, built by one builder in one
session and checked by one reviewer. Outside this project (Jira, help desks) "ticket" means any tracked item and is
often the same thing as an **issue**; here it is narrower: a unit of building, never a decision. Matt Pocock's skills
call a map's decisions "tickets"; in this project they are **issues** (the person, 2026-11-25). Where tickets are kept
is decided on the map.

### Trail
Back and forward through where the person has been, and only that. *Not yet grilled*: its menu is clunky (the person,
2026-11-18). *Avoid* it for questions to follow up: those are **questions**. *In code:* `history/`, `history.rs`.

## U

### Underline
A mark: a line under words, single, double or triple. *Not yet grilled.* *Avoid:* pencil, pencil line. *In code:*
`pencil/` (old lines), `wb mark add … --kind underline --lines 1|2|3`. Decided in marks (MK7-1, the person,
2026-11-18).

### Unfiled
The one fixed folder where a save put in no folder lands: shown like any folder, its saves searchable as any, and filed
from there. *Not yet grilled.* *Avoid:* Shelf, Unsorted. *In code:* `shelf.rs`, `wb shelf saves`. Decided by the person, 2026-11-18.

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

## Named states

Every *before* and *after* in a *what must be true* item uses a name from this list, in brackets. A new state is added
here first, one line each, grouped by area; names that mean the same state are merged. If the list grows large it may
move to its own file. **Empty for now**: the first names come from the first grillings and prototypes.

*An example of the form, not a real state:* `[narrow Notebook]`: the Notebook pane narrower than its side list needs,
so the list is hidden.
