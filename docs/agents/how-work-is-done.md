# How work is done

Decided by the person on 2026-11-18, after builds that missed parts of their designs, a build that never landed, and
credits spent too fast; revised 2026-11-20, 2026-11-21 and 2026-11-23 (two clones, CI runs the full suites). Read this
before designing, cutting tickets, building or reviewing. The agents' own rules are in `.claude/agents/`; how a build,
its review and its merge fit together is [agent-workflow.md](../agent-workflow.md).

## Who does what

- **The person** approves product decisions, held questions, merges, pushes, tags, releases and installs, and tries
  each running build.
- **The lead** (Claude Opus, low effort) designs with the person, cuts an accepted design into tickets, delegates them
  one at a time, has each one reviewed, and writes the handoffs. The lead does not build a ticket itself.
- **The builder** (a Claude Sonnet subagent) builds one ticket in the Main clone and reports. It never invents behavior
  a row leaves open: it stops, and the lead brings the question to the person.
- **One reviewer per ticket** (Sonnet) checks the diff and runs its new tests (see `.claude/agents/reviewer.md`).
- **Mechanical checks** (every row has a test, packaging, counts, installing) go to Haiku. **Release and updater
  verification** goes to Windows Codex.
- No overseer runs in a loop. One writer per clone, and no two agents on the same files.

## The interaction table

Every design folder has a table with one row per thing a person can do: where, the action (every button, key and
command), what they see, what changes on disk, the `wb` command, and the test that proves it. Nothing a builder must
guess is left out: if a row is missing, the builder stops and asks; it does not invent. Builders build from the table.

**One drawn frame per row, and the review deck** (the person, 2026-11-19 and 2026-11-20). Each row has one polished,
screenshot-quality frame (`design/features/<folder>/rows/<id>.png`, listed in `rows/index.json`; a row with
alternatives gets `12a`, `12b`). A row without its frame is not designed. Every round ends with
`node design/review.mjs <folder>`, written and committed with the README before the round goes to the person: a deck
showing each frame beside its row, with a comment box, a rating (Perfect, Satisfactory, Not great, Horrible) and reason
chips per row, exported as `review-<folder>-round<N>.json`. The lead answers each JSON worst first in a Directions
table under `## Directions`. A row rated Perfect with no change asked is approved (its Built cell says `approved`) and
hidden from later rounds; every question the person asks about an action becomes its own row with its own frame. The
round number comes from the README's State line. This holds for every agent (Claude, Codex or any other) that drafts
or changes a design folder.

**Cohesion.** No feature invents an object or a word that is not in [the Library map](../../design/LIBRARY.md).
Features are designed one at a time, in the map's priority order, so designs do not drift apart.

## Tickets

- The lead cuts a design into tickets of a few rows (the folder's `## Tickets` table), each buildable and testable on
  its own. Before delegating, the lead checks that the design is accepted and that the branch and its base commit are
  what the record says.
- A ticket is done only when every one of its rows has a passing test on synthetic scratch data, at desktop and phone
  widths; a feature is done only when every row of its table is. The table records which ticket built each row; a row
  built only in part is marked `[ ] partly (…)`, and what is missing goes first in the next ticket's brief as its Part A.
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

From the lead to the person: the tested commit and its base; each row with its test name and result; the CI run and
its suite counts; a running scratch preview, with the window and control to use, the synthetic data to expect and the
counts before and after each row; any question held for the person.

## Where the person approves the next step

1. A design round is marked accepted.
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
