# Turnaround: from between-the-extremes to a well-kept codebase

Drafted 2026-11-23 from Matt Pocock's interview (NetworkChuck, "How to Actually Code with AI"). Revised the same day
against what is actually in flight: `origin/main` at `v0.3.0` (`18150f4`), the four clones in
`C:\Users\brady\github\wordbench-workspaces` (Main, Design, Build, Fix) and the 0.3.0 play-test.

**The person, 2026-11-23: we stick to this plan no matter what.** New ideas and findings are written down in
[the parking lot](turnaround-parked.md) as they come up. None of them is built until the last step of this plan is
done. The point is to finish one process.

## How to use this document

- **[The order](#the-order)** below is the plan. Do the steps in that order, one at a time. A step is finished only when
  its "Done when" holds.
- **Every step begins with grilling** (`/grilling`). The agent questions the person until the step's open decisions are
  settled and its scope is fixed. Only then does work start. Answers are written into the step here, dated.
- **One step per session where possible.** Keep each agent in the smart zone, with small context. A long step ends with
  this document brought up to date, then a compact.
- **Anything off the plan goes to [the parking lot](turnaround-parked.md):** a new idea, a bug that is not in a step, a
  design thought or a "while we're here". It gets a dated line, and nothing more is done with it. **The one exception:**
  a finding that could lose the person's written work is told to the person at once. The person decides what happens.
- **The step that is under way** is marked **▶** below. When a step is finished, tick it, date it and move the marker.

## The idea in one paragraph

Agents are good at **tactical** work (today's task) and poor at **strategic** work (keeping the codebase easy to
change). The codebase is the agent's environment: when it degrades, every agent gets worse. So the person's job is
the environment. Trust comes from **feedback loops** (types, tests, lint, CI). Whenever there is a choice, choose
**determinism** (a check that fails) over non-determinism (a sentence in AGENTS.md). Keep each agent in the
**smart zone** (small context, one ticket per session). Fix the environment instead of waiting for a better model.

## Where we stand (2026-11-23)

### What 0.3.0 proved

0.3.0 shipped on 2026-11-22 with the Notebook broken in the window. The
[play-test](../design/features/notebook-shell/playtest-0.3.0.md) found these problems:

- The new side list never drew in the app. The window's in-process path refused a second borrow of the study folder, but
  the tests run the terminal path, **so they passed**.
- Typed words were lost in two places.
- No check drives the real app through writing a page.

That is the turnaround's argument made real. A release can pass every test and still be broken in use, because the
tests check code, not use, and no gate sits in front of a release. Six releases went out in five days (0.1.0 to 0.3.0)
with no test gate before the tag.

### Checkouts and work in flight

| Where | Branch | State |
|---|---|---|
| `wordbench-workspaces\Main`, `\Design` | `main` @ `4180312` | **21 commits not pushed**: identity rounds 0–3, principles round 1, notebook-shell design (accepted), CodeGraph, U-1 |
| `wordbench-workspaces\Build` | `feature/notebook` | Merged into 0.3.0 |
| `wordbench-workspaces\Fix` | `fix/notebook-tier0` | **34 commits not pushed** (the 21 above plus Tier 0): B1, B8, B11 done; B14, B21 to do; then 0.3.1 |
| `bible-workbench-rs` | `main` @ `83abcdd` | 72 commits behind `origin/main`; drafted this document (moved to Main 2026-11-23) |
| `wb-install`, `wb-b-reading-plans` | worktrees of `bible-workbench-rs` | Old: detached install copy; reading plans branch |

AGENTS.md says "one checkout, no worktrees" (2026-11-18). In practice there are about seven checkouts.

### Already strategic (keep)

- **A glossary.** `design/LIBRARY.md` is a real shared language, with a rule that new words need the person's
  go-ahead. That is the core of Matt's `grill-with-docs`.
- **One list of standing decisions.** Principles round 1 (`design/features/principles/README.md` on Main) holds every
  standing decision by area, and AGENTS.md on Main says to read it first.
- **Specs before code.** Design folders with interaction tables and "what the build must satisfy" are specs; their rows
  are the tickets.
- **Rules enforced in code**, not just prose: the Bible database opens read-only; documents are checked verse by verse
  after they are made; wb-core refuses `github\bible-study-data` without `WB_ALLOW_REAL_STUDY`. *But see drift 1: the
  folder the person now uses is not guarded.*
- **A full CLI** (`wb`) for every core action: the best possible surface for agents to check their own work.
- **Strong types**: Rust, and TypeScript with `strict: true`. About 413 Rust tests and 48 Playwright specs (WebKit and
  `chromium-editor`). Signed releases through CI to `bradyg7/wordbench-releases`. Mac tests are green.
- **A review bar** (2026-11-23, Tier 0): each fix gets its own test and a `reviewer` score, and nothing ships under 90/100.

### Drifting (fix)

1. **The person's real work is not guarded.** `real_study_dir()` (`crates/wb-core/src/lib.rs:103`) is only
   `github\bible-study-data`. The installed app keeps the person's work since 11-19 in `Documents\wordbench-study-data`
   (play-test X1). A dev build or test pointed there, by `WB_STUDY_DIR` or the saved setup choice, is not refused.
2. **Releases have no gate.** `release.yml` builds and signs whatever is tagged. No CI runs on Windows (the person's
   machine), on pull requests or on the UI tests. Without the database, Rust tests report SKIPPED and pass unless
   `WB_REQUIRE_DB=1`. 2–3 `chromium-editor` specs flake under load. Nothing tests the window's in-process path
   (`Ctx::lent`) except B1's new sweep, and nothing drives the real window.
3. **Guardrails are mostly prose.** There is no `cargo fmt --check` or `clippy` gate and no linter for the UI. Clippy
   reports about 60 warnings, all minor, so a `-D warnings` gate costs about one session. `ui/src` has about 240
   `any`-typed spots, and non-test Rust has about 680 `unwrap()`/`expect()` calls.
4. **The checkouts and the steering disagree.** About seven checkouts, against "one checkout". `AGENTS.md` (~150 lines)
   carries process history. `docs/agent-workflow.md` and four of the six `.claude/agents/*.md` still describe worktrees.
   `docs/SPEC.md` is stale. Some memory notes are superseded. The process changed on 11-16, 17, 18, 19 and 20, and again
   on 11-22 and 23: CodeGraph in every session, the 90/100 review bar, context kept under 200k, and a spec kept in the
   design folder to survive a compact. 55 commits are not pushed.
5. **More designed than built, and a redesign of the whole app on top.** There are 38 design folders, 27 marked
   accepted, and several "ready to build" since 11-16 or 11-17. The identity and principles rounds (11-22) reshape the
   whole app (desks, bubbles, dock, tray, history), with 23 conflicts waiting on the person. The accepted notebook-shell
   (SH1–SH6) is not built.
6. **A few very large modules.** `ui/src/notebook.ts` (2,852 lines), `ui/src/blocks.ts` (2,098), `ui/src/main.ts`
   (1,581), `wb-core/src/store.rs` (1,893), `commands.rs` (1,786). wb-core exposes about 790 `pub fn`s. Wide interfaces
   mean tests tend to pin internals instead of behavior.
7. **Running the tests changes tracked files.** Test runs rewrite the screenshots in `docs/phase2/` and
   `design/features/marks/build/`, in every clone, so no checkout is ever clean. That fights the rule "files found
   changed that are not this feature's are never committed".

## The order

Each step begins with `/grilling`. The person's decisions for a step are listed in it and settled in that grilling,
not before.

### ✅ Step 0: tools (done 2026-11-23)

- `mattpocock-skills` installed at project scope (`.claude/settings.json`).
- Pointers so his skills use what exists: root `GLOSSARY.md` points at `design/LIBRARY.md`;
  `docs/agents/domain.md` and `docs/agents/issue-tracker.md` map his GLOSSARY/ADR/issues to the Library map and
  design folders; `AGENTS.md` has an "Agent skills" block; the AI Coding Dictionary is the process vocabulary.
- CodeGraph in every session (2026-11-22; `.mcp.json`, `scripts\setup-codegraph.ps1`).

### ✅ Step 1: land what is in flight, then freeze (done 2026-11-23)

Finish the work already under way so the plan starts from one known state. Start nothing new.

- Bring this document and `docs/agents/`, `GLOSSARY.md` and `.claude/settings.json` from `bible-workbench-rs` into Main,
  and commit them there. From then on, the plan lives in Main.
- Finish Tier 0 on `fix/notebook-tier0`: B14 (stray `/`) and B21 (bullet drag), each with its own test and a review of
  90 or more. Then check the five fixes together in the real window.
- Push Main's 21 commits and merge `fix/notebook-tier0`, with the person's go-ahead. Release **0.3.1** and install it
  through the updater.
- **Freeze:** identity and principles rounds stop where they are. Their 23 conflicts stay open until step 4. No design
  round starts before step 4.
- Leave `wb-b-reading-plans` and `wb-install` as they are until step 3 decides what happens to them.

**Decisions for the person:** none new. The go-ahead to push, merge and release 0.3.1.

**Grilled 2026-11-23** (the person's answers):
1. One commit on Main's `main` brings in: these two documents, `docs/agents/`, `GLOSSARY.md`, the "Agent skills" block
   of `AGENTS.md`, and `.claude/settings.json` with both keys merged (the plugin and CodeGraph). `docs/drafts/` and
   the `site` entry in `.claude/launch.json` stay in `bible-workbench-rs` (parked: save them before that checkout is
   retired).
2. Main's uncommitted `.claude/agents/builder.md` (the CodeGraph lines of 11-22) goes into the same commit.
3. The uncommitted OpenRig blocks in Build (`AGENTS.md`, `CLAUDE.md`) and Design (`CLAUDE.md`) are thrown away
   (`git restore`).
4. Screenshots, `gen/schemas` and `package-lock.json` changed by test runs are never committed in this step. They are
   restored only where a clean tree is needed to merge.
5. B14, then B21, in the Fix clone on `fix/notebook-tier0`, one bug per session. Each gets its own test and a `reviewer`
   score of 90 or more. The play-test page is brought up to date before each compact.
6. B21: only finding 2766's own files are read in `Documents\wordbench-study-data`. The drag is reproduced on a scratch
   copy.
7. The plan is committed in Main now. When Tier 0 is done, `fix/notebook-tier0` is merged into Main's `main` with a
   merge commit. Then `main` is pushed once, with the person's go-ahead.
8. Before the 0.3.1 tag, the agent checks the five fixes in the real window (release build, scratch copy, over CDP).
   Then **the person plays the release build**, and only then is it tagged.
9. The freeze lasts until step 4. It covers:
   - no design round, and no edits to identity or principles;
   - nothing from the parking lot (including B1's leftovers and X3);
   - the Build clone left as it is.

   A second bug found during a fix goes to the parking lot, unless it is in the same lines and blocks the fix.
**Done when:** 0.3.1 is installed through the updater; `origin/main` holds every commit from Main and Fix; this document
is committed in Main.

**Progress 2026-11-23:**
- Tier 0 is done: B1, B8, B11, B14 and B21 were each reviewed at 90 or more, and all 14 checks passed in the real window.
- The person played the release build and wrote four findings (parked). The person asked whether to revert the Notebook.
  We decided not to: ship 0.3.1 and keep this order. Whether the Notebook is redesigned from scratch is settled in
  step 4's grilling.
- `fix/notebook-tier0` was merged into `main` (68fbe6f), the version bumped (63b47a5), `main` pushed and `v0.3.1` tagged.
- The release workflow published 0.3.1, and the person installed it through the updater.

### ▶ Step 2: guardrails that fail (deterministic)

**Grilled 2026-11-23** (the person's answers, Q1–Q30). The tickets, in this order, each small, built and tested on its
own:

1. **The folder guard.** wb-core refuses `github\bible-study-data`, `Documents\wordbench-study-data`, and whatever
   folder the installed app's settings name as its study folder (so a moved folder stays guarded), unless
   `WB_ALLOW_REAL_STUDY=1` is set or the `installed` feature is on. Tests prove each refusal, and that both exceptions
   still open the folder.
2. **Words and standards.** The development words (CI, clippy, ratchet, flaky, smoke run, `any`, `unwrap`, spec,
   prototype), each in plain English, go into `GLOSSARY.md`. `CODING_STANDARDS.md` and `DESIGN_STANDARDS.md` are
   written, and **both builders and reviewers read them** (replacing step 3's "the reviewer reads, not the builder").
   Each rule is one line naming its check if a machine checks it; judgment rules get one short real example at most.
   - Coding sources: clippy's defaults plus a chosen set of its stricter lints; strict TypeScript and typescript-eslint
     strict-type-checked; Pocock (deep modules, small interfaces, tests through the public surface, no `any`).
   - Coding rules from the grilling: a comment says *why*, never *what*; a checker is switched off (`#[allow]`,
     `@ts-ignore`, `eslint-disable`) only with a reason recorded in the standards, and the 9 `#[allow]` today are
     reviewed; no TODO notes in merged code (open thoughts go to the parking lot).
   - Design sources: WCAG 2.2 AA, Nielsen's 10 heuristics, the Windows design guidelines and Apple's HIG. Machine-checked
     where possible (axe for contrast and labels, speed budgets); the rest is checked when the person plays a prototype.
3. **Zero warnings.** One session fixes the ~60 clippy warnings, then `-D warnings` refuses any new one ("above
   reproach"). The same ticket installs typescript-eslint with `strict-type-checked` (the person, 2026-11-23), clears
   its warnings and from then refuses new ones. The `any` rules (`no-explicit-any` and the `no-unsafe-*` family) are the
   one exception: about 240 `any` cannot be retyped safely in one session, so those rules are counted by ticket 7's
   ratchet instead, and the count only goes down.
4. **CI on GitHub, and nobody waits on it.**
   - Quick checks on every branch push (fmt, clippy, `tsc`, about 3 minutes). The full Windows suite (`cargo test` with
     `WB_REQUIRE_DB=1`, `test:unit`, `test:webkit`, `chromium-editor`, axe) on pull requests to `main` and on `main`. A
     merge waits for green; the person never watches it.
   - Builders never run a full suite locally. They run only the test they are writing or fixing, and quick checks for
     the area they touched.
   - The database: `data-v1` downloaded and checked by its fingerprint, as the Mac and release jobs do, and cached
     between runs.
   - Minutes (the repo stays private, 2,000 a month on the free plan, Windows ×2, Mac ×10): the Mac job runs only for
     releases; `warm-cache.yml` loses its weekly run and runs only when the Rust libraries change; path filters (a
     docs-only change runs nothing); a newer push cancels the older run; a $0 spending limit, which **the person sets**
     on GitHub. If a month passes 75%, a self-hosted runner on the person's PC is the fallback.
5. **Flakes are fixed, not quarantined.** The three named specs (`writing_at_every_width`,
   `mark_from_a_page_is_the_reader_s_mark`, `own_property_add_and_type`) are each run 90 times under load and fixed at
   the cause, in the test or in the app. Every fixed-time wait becomes a wait for the thing itself. From then on, a flake
   found is fixed in that feature's review, before it merges. Nothing is held back.
6. **The release gate.**
   - `release.yml` refuses a tag unless the full Windows suite passed on that commit.
   - Every command in the `wb` table is either run the window's way in `crates/wb-cli/tests/lent.rs` or listed as
     excluded with a reason; a new command with neither fails.
   - A smoke run on GitHub's Windows machine starts the release build on a scratch study folder, writes a page, presses
     Enter, reopens it and checks the file on disk; nothing is published if it fails (about 5 counted minutes). If
     GitHub's machines cannot open the window reliably, the person's PC runs it unattended at release time.
   - The person's play before a release is a short feel check, not a functional checklist: functional bugs are caught
     at the prototype stage (step 3's process).
7. **Ratchets.** A script counts `any` in `ui/src`, `unwrap()` in non-test Rust, and checker switches, against a
   committed baseline. CI fails if a count rises; lowering the baseline is a normal edit.
8. **Tests never change committed files.** Tests save their pictures to ignored scratch folders. Committed screenshots
   change only through `npm run shots`, run on purpose. CI fails if a test run leaves any committed file changed.
9. **Two AGENTS.md rules become checks.** "Scripture is generated, not typed": CI rebuilds every scripture fixture from
   the database and fails on a difference. "Every action has a `wb` command": CI compares the window's command list with
   the `wb` table. These never replace real-window tests of drags, clicks and feel, or the person's play.

**Estimated time per feature, once this lands** (to be measured): the person is active 1–2½ hours (grilling, playing
the prototype, the feel check) and waits about 2 minutes (the install). Agent and GitHub time runs in the background.
About 200 counted CI minutes per feature, plus about 110 per release.

**Done when:** each item above is a check that fails when broken, and the next release (0.3.2 or later) has gone through
the gate.

**Progress 2026-11-23:**
- Ticket 1 done: `fix/study-guard` merged into Main's `main` (bab3d7f), not pushed. The guard refuses all three real
  locations and folders inside them; 5 tests; checked with the real paths through a read-only `wb study check`. The
  saved choice is `%APPDATA%\Bible Workbench\settings.json` (`study_dir`); a saved choice under the temp folder is not
  guarded.
- Found for ticket 3: the Rust code has never been through rustfmt (no `rustfmt.toml`; about 1,970 differences). Ticket
  3 starts with one commit that only reformats.
- Ticket 2 drafted on `docs/words-and-standards`: the development words in `GLOSSARY.md`, `CODING_STANDARDS.md`
  (with the nine checker switches reviewed: one kept, eight removed in ticket 3) and `DESIGN_STANDARDS.md` (the seven
  feel qualities). The builder and reviewer agents read both. Found: axe is not installed yet (ticket 4 adds it); typescript-eslint joins ticket 3.
- Ticket 3 built on `fix/zero-warnings`, not merged: rustfmt commit (about 1,970 differences), then 68 clippy warnings fixed (`cargo clippy --workspace --all-targets -- -D warnings` passes); the eight old switches are removed; nine `expect(dead_code)` on `mod common;` remain, one row in the Checker switches table. typescript-eslint is NOT installed: it supports TypeScript below 6.1 only (typescript-eslint 8.74.0), and the repo uses 7.0.2; the person decides.
- Ticket 4 built on `fix/ci` (stacked on `fix/zero-warnings`), not pushed, so GitHub has not run it yet: `ci.yml` (quick
  checks on every branch push, the full Windows suite on pull requests to `main` and on `main`), the Mac tests only
  for tags, `warm-cache.yml` without its weekly run, and `ui/tests/axe.spec.ts` (WCAG 2.2 AA, with 3 known violations named in it).
- Ticket 5 built on `fix/flakes` (stacked on `fix/ci`), not merged. Each of the three specs was run 90 times in Chromium
  (`chromium-editor`) with 16 workers, which is more than this machine carries: before 20, 44 and 9 failures
  (`mark_from_a_page_is_the_reader_s_mark`, `own_property_add_and_type`, `writing_at_every_width`); after 0, 0 and
  (16 workers) still a few setup timeouts, or (8 workers) 0 of 90 against 15 before. Causes: the scripture card was filled
  only if it was already in the window, but the page is drawn before it is put in, so marks that came back first left it at
  "Reading the verses…" (an app race, fixed in `blocks.ts`); the test opened the filter menu before the list was drawn
  again with the new column type; the width test measured while the page was drawn again (after a block was left, and in
  the floating tab that shows the old drawing first). Fixed-time waits that remain are listed in the ticket report.
- Ticket 6 built on `fix/release-gate` (stacked on `fix/flakes`), not pushed: `release.yml` has a `gate` job (a
  successful run of `ci.yml` on the tagged commit whose job `full` succeeded, else "The full test suite has not passed on
  this commit. Merge to main and wait for CI before tagging."), `windows` and `mac` wait for it; a `smoke` job runs
  `measure/smoke.mjs` on the built exe and `publish` waits for it. `lent.rs` now fails on a command that is neither swept
  in the window's way nor in its `EXCLUDED` list (14 entries, each with a reason). Only a tag on GitHub proves the gate and
  the smoke job; `smoke.mjs` was not run locally (no release build here). `mac-tests.yml` still runs beside the release,
  not before it.
- Next: the person reads the two standards, then ticket 3. `main` is pushed with the person's go-ahead, once CI
  (ticket 4) can run on it.

### Step 3: lean steering

- Run `/retro` on the last few build sessions, including Tier 0. It looks for exactly these things: missing checks,
  instructions that do nothing, a long AGENTS.md.
- **Decide the checkout model:** write the Main / Design / Build / Fix clones into AGENTS.md as the way work is done, or
  go back to fewer. Then retire the old worktrees (`wb-install`, `wb-b-reading-plans`) and the stale `bible-workbench-rs`
  checkout, after saving anything that exists only there.
- Cut `AGENTS.md` to the rules that never change and pointers for finding things. Move process to `docs/agents/`.
  Judgment calls live in step 2's `CODING_STANDARDS.md` and `DESIGN_STANDARDS.md`, which builders and reviewers both
  read. Fold in the 11-22 and 11-23 process: CodeGraph, the 90/100 review bar, context under 200k.
- **`design/LIBRARY.md` becomes `GLOSSARY.md`** (decided 2026-11-23): moved over as it is, every link updated, since
  "Library" may be retired as a word. Its contents are reworked in later grillings, not here.
- **Rewrite the design process** (decided 2026-11-23). It becomes: grilling with the docs, then a throwaway prototype
  (`/prototype`), then the person plays it, then tickets cut from the prototype. Design boards (FigCraft), sheets,
  `review.html` and full interaction tables are retired; AGENTS.md's "Designed before it is built" rule is rewritten as a
  dated decision of the person's. What stays is a short list of **what must be true**, one item per thing a person does,
  in two halves:

  > **You see before:** [wide Notebook], a page open, the side list showing
  > **You do:** drag the pane narrower
  > **You see after:** [narrow Notebook], the same page still open, no older view shown
  > **You feel:** smooth, no flash *(something noticeable; otherwise "checked at play")*
  > — *for the builder:* **on disk** nothing changes · **proven by** `notebook-width.spec`

  The person writes and checks the top four lines; the builder fills the bottom line and the reviewer checks it. The
  format is a draft, revised when something proves missing. Before and after (the person, 2026-11-23, Q31) record how
  one state becomes another, so two features that meet the same state are checked against each other.
- **Named states** (Q31): every "before" and "after" uses a state name in brackets, like `[narrow Notebook]`, from one
  list in `GLOSSARY.md`, grouped by area, one line each. A new state is added there first. A reviewer or a check searches
  for the bracketed name across all features to find every item that meets it, and a combination no item covers is a
  blind spot found before building. Watch the list's size; merge names that mean the same state.
- **"You feel" (Q32, the person, 2026-11-23):** `DESIGN_STANDARDS.md` defines a small fixed set of feel qualities,
  each with its standard and a bar where one exists: **Instant** (under 0.1 s, Nielsen's response-time limits),
  **Quick** (under 1 s; over 1 s shows progress), **Steady** (nothing flashes, jumps or moves unasked), **Clear** (a
  visible result for every action, Nielsen #1), **Forgiving** (Undo or a confirm, Nielsen #3), **Familiar** (Enter, Esc
  and drag behave like Windows and Mac, Nielsen #4 and the platform guidelines), **Readable** (WCAG 2.2 AA, contrast of
  4.5:1 or more). Every item gets all of them by default; its "You feel" line names only the one or two most at risk,
  plus what the person's play revealed. At the prototype the person judges the named ones; at build each quality with a
  bar gets a machine check (speed budgets, a no-shift check, axe); the release feel check covers only lines marked
  "checked at play". The set grows only through retros.
- Make `docs/agent-workflow.md` and `.claude/agents/*.md` agree with the checkout model. Archive `docs/SPEC.md`. Prune
  superseded memory.
- The hard-to-reverse decisions (study-folder formats, the read-only database, the Library map's retired words, the
  installed-release exception, where the real study folder is) live in **principles §3**, not a new `docs/adr/`.
  Mark each one-way door there.

**Decisions for the person:** the checkout model.
**Done when:** AGENTS.md is short and no steering file contradicts another; every one-way door is in principles §3.

### Step 4: build what is accepted before designing more

- **A work-in-progress limit** (the person's number): no new design round while more than that many accepted folders
  are unbuilt.
- **Settle where identity and principles stand.** Either they count as one design, or the 23 conflicts are settled first
  because they change what the accepted folders mean. The person decides in this step's grilling, and that decision
  sets the build order.
- **The Notebook redesign is the first feature through step 3's new process** (decided 2026-11-23): grilling, a
  prototype the person plays, then tickets. This replaces building the accepted notebook-shell folder as it stands.
  Which other accepted folders still get built from their tables, or go back through the new process, is decided here.
- For each accepted folder kept, in the glossary's priority order: `/to-tickets` over its interaction table, then `/implement` one ticket per session (a few rows, about 150k
  tokens at most), then `/code-review` (spec review and standards review), then `/pr`, which states the **merge danger**.
  Each release goes through step 2's gate.

**Decisions for the person:** the limit's number; identity and principles: one design, or settle first; the build order.
**Done when:** the unbuilt accepted folders are at or under the limit.

### Step 5: deep modules

- `notebook.ts` and `blocks.ts` are reshaped inside the notebook-shell tickets of step 4, not as a separate refactor.
- Run `/improve-codebase-architecture` on what remains hot (`main.ts`, `store.rs`, `commands.rs`). Take one "Strong"
  candidate at a time through the normal loop: a deep module with a small interface, tested from the outside (through
  `wb` where possible). The ratchets of step 2 go down as each one lands.

**Decisions for the person:** whether a scheduled run may later open one pull request a day for two-way-door refactors
only.
**Done when:** each hot module has been through the loop once.

### Step 6: open the parking lot

Only now: go through [the parking lot](turnaround-parked.md) with the person, line by line, using the loop below.
First item: the language conversation (stay with Rust, or rebuild in another language), with the compile and CI times
step 2 measured.

## The loop from then on

`/grilling` (with the docs; the Library map grows only with the person's go-ahead), then:

- a small change: `/implement`;
- a large one: a prototype the person plays, its "what must be true" list, then `/to-tickets`, then one ticket per
  session.

Then `/code-review`, `/pr` with its merge danger, merge, the release gate, `/retro`, and the lesson becomes a check where
it can.

**Human review is mandatory for one-way doors**: any change to how the study folder is written, any move of the
person's files, any release. Two-way doors with a small blast radius (UI layout, internal refactors behind green tests)
can be sampled instead.

## Decided

- 2026-11-23: the plan is followed in order, no matter what; new ideas and findings go to the parking lot until step 6.
- 2026-11-23: every step begins with grilling.
- 2026-11-23: in-flight Tier 0 work finishes and ships as 0.3.1 before step 2 (step 1).
- 2026-11-23: no revert of the Notebook. 0.3.1 shipped, and whether the Notebook is redesigned is settled in step 4 (after the person played 0.3.1).
