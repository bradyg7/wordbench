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

### ▶ Step 1: land what is in flight, then freeze

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

### Step 2: guardrails that fail (deterministic)

In this order, because the first item protects the person's work:

1. **Guard the real study folder wherever it is.** wb-core refuses the folder the installed app uses
   (`Documents\wordbench-study-data`, or whatever the person chose) as well as `github\bible-study-data`, unless
   `WB_ALLOW_REAL_STUDY=1` is set or the `installed` feature is on. A test proves the refusal for both.
2. **CI on Windows, on every push and pull request**, with `WB_REQUIRE_DB=1` and the `data-v1` database: `cargo fmt
   --check`, `cargo clippy -- -D warnings` (after one session of fixes), `cargo test`, `tsc -p ui`, `npm run test:unit`,
   `npm run test:webkit` and the `chromium-editor` project. Flaky specs are fixed or quarantined by name, not retried
   blindly. Keep the Mac job.
3. **Release gate.** `release.yml` runs only when the Windows test job is green on that commit. Before a tag:
   - the `Ctx::lent` sweep (`crates/wb-cli/tests/lent.rs`) covers every read command, from a hard list rather than an 80%
     threshold;
   - a smoke run in the real window writes a page in the release build (scratch study folder, driven over CDP);
   - the person plays the release before tagging.
4. **Ratchets, not big-bang cleanups.** A small script counts `any` in `ui/src` and `unwrap()` in non-test Rust and
   fails if the count rises. Lower the ceiling as modules are cleaned.
5. **Tests write only to ignored folders** (`test-results/`, temp). Committed screenshots are refreshed on purpose, by a
   named command.
6. **Each AGENTS.md rule that a machine can check becomes a check.** "Scripture is generated, not typed": the fixtures
   match the database. "The database is read-only": already in code. "Every core action has a `wb` command": a test
   compares the Tauri command list with the `wb` table.

**Decisions for the person:** CI on Windows for every push (yes or no); whether a release needs the person's play-test
or the smoke run alone.
**Done when:** each item above is a check that fails when broken, and the next release (0.3.2 or later) has gone through
the gate.

### Step 3: lean steering

- Run `/retro` on the last few build sessions, including Tier 0. It looks for exactly these things: missing checks,
  instructions that do nothing, a long AGENTS.md.
- **Decide the checkout model:** write the Main / Design / Build / Fix clones into AGENTS.md as the way work is done, or
  go back to fewer. Then retire the old worktrees (`wb-install`, `wb-b-reading-plans`) and the stale `bible-workbench-rs`
  checkout, after saving anything that exists only there.
- Cut `AGENTS.md` to the rules that never change and pointers for finding things. Move process to `docs/agents/`, and
  move judgment calls made at review time to a `CODING_STANDARDS.md` the reviewer reads (not the builder). Fold in the
  11-22 and 11-23 process: CodeGraph, the 90/100 review bar, context under 200k, the spec in the folder.
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
- For each accepted folder, in the Library map's priority order, starting with the notebook-shell (SH1–SH6, the Tier 1
  bugs): `/to-tickets` over its interaction table, then `/implement` one ticket per session (a few rows, about 150k
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

## The loop from then on

`/grilling` (with the docs; the Library map grows only with the person's go-ahead), then:

- a small change: `/implement`;
- a large one: a design folder (`/to-spec`), then `/to-tickets`, then one ticket per session.

Then `/code-review`, `/pr` with its merge danger, merge, the release gate, `/retro`, and the lesson becomes a check where
it can.

**Human review is mandatory for one-way doors**: any change to how the study folder is written, any move of the
person's files, any release. Two-way doors with a small blast radius (UI layout, internal refactors behind green tests)
can be sampled instead.

## Decided

- 2026-11-23: the plan is followed in order, no matter what; new ideas and findings go to the parking lot until step 6.
- 2026-11-23: every step begins with grilling.
- 2026-11-23: in-flight Tier 0 work finishes and ships as 0.3.1 before step 2 (step 1).
