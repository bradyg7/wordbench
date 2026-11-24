# How work is done

Decided by the person on 2026-11-18, after builds that missed parts of their designs, a build that never landed, and
credits spent too fast; revised 2026-11-20, 2026-11-21, 2026-11-23 (two clones, CI runs the full suites) and 2026-11-24 (designing with a
prototype). Read this
before designing, cutting tickets, building or reviewing. The agents' own rules are in `.claude/agents/`; how a build,
its review and its merge fit together is [agent-workflow.md](../agent-workflow.md).

## Who does what

- **The person** approves product decisions, held questions, merges, pushes, tags, releases and installs, and tries
  each running build.
- **The lead** (Claude Opus, low effort) designs with the person, cuts an accepted design into tickets, delegates them
  one at a time, has each one reviewed, and writes the handoffs. The lead does not build a ticket itself.
- **The builder** (a Claude Sonnet subagent) builds one ticket in the Main clone and reports. It never invents behavior
  an item leaves open: it stops, and the lead brings the question to the person.
- **One reviewer per ticket** (Sonnet) checks the diff and runs its new tests (see `.claude/agents/reviewer.md`).
- **Mechanical checks** (every item has a test, packaging, counts, installing) go to Haiku. **Release and updater
  verification** goes to Windows Codex.
- No overseer runs in a loop. Several tasks may run at once (a design in Design while a ticket builds in Main), each
  agent with only the context it needs: one writer per clone, and no two agents on the same files.

## Designing a feature

Decided by the person, 2026-11-23 and 2026-11-24. It replaces the drawn boards (FigCraft), sheets, `review.html` decks
and full interaction tables, which are retired.

1. **Grilling with the docs.** The lead asks the person every open decision in rounds (`/grilling`), against
   [the principles](../../design/features/principles/README.md) and [the glossary](../../GLOSSARY.md). Answers are
   written in the folder's `## Decisions`, dated, as they are given.
2. **A throwaway prototype** (`/prototype`) in the Design clone. It reads the app's code but only adds its own files,
   kept in the design folder; the build later replaces them or folds them into the real ones.
3. **The person plays it**, and says what works and what does not. Another round of grilling and prototype follows
   until the person marks the folder **accepted**.
4. **What must be true**: the folder's short list, one item per thing a person does (below). The person writes and
   checks the first four lines.
5. **Tickets** are cut from those items (below).

**What must be true.** Each item in this form:

> **You see before:** [wide Notebook], a page open, the side list showing
> **You do:** drag the pane narrower
> **You see after:** [narrow Notebook], the same page still open, no older view shown
> **You feel:** Steady, no flash *(the one or two feel qualities most at risk; otherwise "checked at play")*
> — *for the builder:* **on disk** nothing changes · **`wb`** none: view only · **proven by** `notebook-width.spec`

- *Before* and *after* use [named states](../../GLOSSARY.md#named-states) in brackets. A new state is added to the
  glossary first. A reviewer searches for the bracketed name across all folders to find every item that meets it, and
  a combination no item covers is a blind spot found before building.
- *You feel* names only the [feel qualities](../../DESIGN_STANDARDS.md#the-feel-qualities) most at risk, plus what
  the person's play revealed; every item gets all of them by default.
- The builder fills the last line: what changes **on disk**, the **`wb`** command that reaches the same action (every
  core action has one), and the test it is **proven by**. The reviewer checks it. A builder never invents what an item
  leaves open: it stops, and the lead brings the question to the person.
- The format is a draft (2026-11-23), revised when something proves missing.

**Cohesion.** No feature invents a word that is not in [the glossary](../../GLOSSARY.md): a new one is added there
first, with the person's go-ahead. Features are designed one at a time, in the order set by mapping the whole app (the
person, in [the turnaround](../turnaround.md), step 4), so designs do not drift apart.

**No folder is accepted today** (the person, 2026-11-24). Every folder under `design/features/` is up for redesign
through this process; its drawn frames and interaction table are history, not a design to build from.

## Tickets

- The lead cuts an accepted design into tickets of a few *what must be true* items (the folder's `## Tickets`
  table), each buildable and testable on its own. Before delegating, the lead checks that the design is accepted and that the branch and its base commit are
  what the record says.
- A ticket is done only when every one of its items has a passing test on synthetic scratch data, at desktop and phone
  widths; a feature is done only when every item is. Each item records which ticket built it; an item built only in
  part is marked `[ ] partly (…)`, and what is missing goes first in the next ticket's brief as its Part A.
- **File forms** (the person, 2026-11-21): how something is kept in Markdown or settings is the lead's call, in the most
  compatible form (Obsidian's where one exists), recorded dated under `## Decisions`. Other open questions go to the
  person.
- **Testing:** the builder runs only the ticket's own tests and the quick checks; CI runs the full suites on the push
  and gates the merge ([CODING_STANDARDS.md](../../CODING_STANDARDS.md)). Editor specs also run in Chromium on `msedge`,
  the engine of the Windows app (WebView2). A test that passes alone and fails in the suite goes on the brief's
  known-flake list; one that fails every time is a bug for the next ticket's Part A.
- A builder that stalls or drops is not restarted from scratch: the next one reads `git diff` and continues from the
  uncommitted work.

## The handoff after each ticket

From the lead to the person: the tested commit and its base; each item with its test name and result; the CI run and
its suite counts; a running scratch preview, with the window and control to use, the synthetic data to expect and the
counts before and after each item; any question held for the person.

## Where the person approves the next step

1. A design folder is marked accepted, after the person has played its prototype.
2. Each held question is answered (recorded under `## Decisions`, dated).
3. After each ticket's handoff: go on to the next ticket. The person may instead tell the lead to run the tickets
   through to the end (2026-11-21); then the lead starts each next ticket as soon as the last one is reviewed.
4. After the last ticket: one review of the whole feature and the desktop check in the real app
   (`node measure/desk.mjs`), then the push, CI, and the merge to `main` with the person's go-ahead.
5. Version bump, release notes, tag and push (`v<version>`; see [commands.md](commands.md)).
6. Install through the updater, verified by Windows Codex. Shipped means installed.

Nothing is merged, tagged, pushed, released or installed without that step's go-ahead.

## Findings

A scheduled review (kept paused until the person turns it on) reads new top-level findings and writes a private, ranked
draft with proposed status changes. It changes nothing: the person approves any status change, and the lead turns
accepted findings into tickets, fixes or design questions.
