# Draft: AGENTS.md "How work is done" (separate change, not F2)

Replaces the numbered list under **How work is done** in the main repo's `AGENTS.md`. Proposed 2026-11-20; not
applied until the person approves.

---

## How work is done

Decided by the person on 2026-11-18 and revised 2026-11-20 and 2026-11-21.

1. **Who does what.**
   - **The person** approves product decisions, held questions, merges, tags, releases and installs, and tries each
     running build.
   - **The feature lead** (Claude Opus, low effort) designs with the person, cuts an accepted design into tickets,
     delegates them one at a time, verifies each one, and writes the handoffs. The lead never builds a ticket itself.
   - **The builder** (a Claude Sonnet subagent) builds one ticket in the Build checkout and reports. It never invents
     behavior a row leaves open: it stops and the lead brings the question to the person.
   - **Mechanical checks** (every row has a test, packaging, counts) go to Haiku or Windows Codex. **Release and
     updater verification** goes to Windows Codex.
   - Several tasks may run at once, each in its own agent with only the context it needs: one writer per checkout,
     and no two agents on the same files.
2. **Checkouts** under `wordbench-workspaces\`: `Main` mirrors published `main` (read-only for agents); `Build`
   holds the one `feature/<folder>` branch; `Fix` holds one `fix/<what>`; `Design` holds design rounds. Local managed
   changes to `AGENTS.md` and `CLAUDE.md` are never committed with a feature or fix; stage files by name.
3. **Reading code cheaply.** Agents look code up through the code graph before reading whole files, and read only the
   parts they need. The graph is CodeGraph (`@colbymchenry/codegraph`, installed 2026-11-22, telemetry off): the MCP
   server `codegraph` in the checkout's `.mcp.json`, with its index in `.codegraph/` (excluded locally, never
   committed; `codegraph init` once per checkout, and it keeps itself in step as files change). Start with
   `codegraph_explore` (an area: the matching symbols' source and call paths), then `codegraph_node`,
   `codegraph_callers` / `codegraph_callees` and `codegraph_impact`; Grep and Read only for what the graph does not
   answer. Builders have these tools in `.claude/agents/builder.md`.
4. **One drawn frame per interaction, and the review deck** (the person, 2026-11-20; replaces the single board).
   One row per thing a person can do, with its `wb` command and its test, and **one polished, screenshot-quality frame
   per row** (`design/features/<folder>/rows/<id>.png`, listed in `rows/index.json`; a row with alternatives gets
   `12a`, `12b`). No whole-board PDF is made for review. A row without its frame is not designed. Every round ends with
   `node design/review.mjs <folder>`: a slide deck (← →) showing each frame large beside its row, a comment box per
   row, and Copy/Download notes; the notes come back under `## Directions`. Each row is rated Perfect, Satisfactory,
   Not great or Horrible, with clickable reason chips in categories, and the deck exports the round as JSON
   (`review-<folder>-round<N>.json`). The lead answers each JSON worst first in a Directions table. A row rated Perfect
   with no change asked is approved (its Built cell says `approved`) and is hidden from later rounds; every question
   the person asks about an action becomes its own row with its own frame. The round number comes from the README's
   State line.
5. **Tickets.** The lead cuts a design into tickets of a few rows (the folder's `## Tickets` table). Before
   delegating, the lead checks that the design is accepted and that the checkout, branch and base commit are what the
   record says. A ticket is done only when every one of its rows has a passing test on synthetic scratch data, at
   desktop and phone widths. The table records which ticket built each row; a row built only in part is marked
   `[ ] partly (…)`, never built, and what is missing goes first in the next ticket's brief as its Part A.
   - **File forms.** How something is kept in Markdown or settings (the person, 2026-11-21) is the lead's call: the
     most compatible form (Obsidian's where one exists), recorded dated under `## Decisions`. Other questions a row
     leaves open still go to the person.
   - **Testing a ticket** (the person, 2026-11-21). While working and fixing, the builder runs only the ticket's own
     specs (`npx playwright test a.spec b.spec`), and `cargo test -p <crate>` only for a crate it changed. Once at the
     end, the full `npm run test:webkit` and, if any Rust changed, the full `cargo test`; both gate the ticket and the
     merge. No parallel test workers and no linker change. Editor specs also run in a Chromium project on `msedge`,
     the engine of the Windows app (WebView2). A failure that passes when run alone goes on the brief's known-flake
     list; one that fails every time is a bug for the next ticket's Part A.
   - **No unattended runs.** Every test runs in the foreground with a time limit. A builder never leaves work
     running in the background; on a hang it stops leftover processes and reports. A builder that stalls or drops is
     not restarted from scratch: the next one reads `git diff` and continues from the uncommitted work.
6. **The review handoff** after each ticket, from the lead to the person:
   - the tested commit, and the base it sits on;
   - each row: its test name and result;
   - suite counts: Rust, UI unit, frontend build, WebKit desktop and phone;
   - a running scratch preview, with the window and control to use, the synthetic data to expect and the expected
     counts before and after each row;
   - any question held for the person.
7. **Where the person approves the next step.**
   1. A design round is marked accepted.
   2. Each held question is answered (recorded under `## Decisions`, dated).
   3. After each ticket's handoff: go on to the next ticket. The person may instead tell the lead to run the tickets
      through to the end (2026-11-21), and then the lead starts each next ticket as soon as the last one is verified.
   4. After the last ticket: the lead runs one Design review and the desktop check in the real app
      (`node measure/desk.mjs`), then merges to `main` and pushes, with the person's go-ahead (given up front with
      "run to the end" on 2026-11-21).
   5. Version bump, release notes, tag and push (`v<version>`).
   6. Install through the updater, verified by Windows Codex. Shipped means installed.
   Nothing is merged, tagged, pushed, released or installed without that step's go-ahead.
8. **Findings.** A scheduled review (kept paused until the person turns it on) reads new top-level findings and writes
   a private, ranked draft with proposed status changes. It changes nothing: the person approves any status change,
   and the lead turns accepted findings into tickets, fixes or design questions.
