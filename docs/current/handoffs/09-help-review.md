# H09 Help and command parity — audit inventory

**Status:** Audit complete; implementation and final task labels await H05 (Dock, Shelf and focus) and H08 (Study-tool interaction review). This is an inventory and proposal, not approved UI copy. No behavior or command semantics are changed here.

## Evidence inspected

- `docs/current/handoffs/09-help.md`, `docs/current/handoffs/README.md`, `docs/current/README.md`, and `docs/current/findings-2026-11-09.md` establish scope and the H05/H08 label gate.
- `CLAUDE.md` establishes verbatim Scripture, no interpretation, study-folder protection, CLI coverage for core actions, Python compatibility, and reader-place rules.
- `crates/wb-core/src/guide.rs` is the source for Guide entries and their prose. Current topics: Templates, The Shelf, Views, Threads, Questions, and Word blocks. `wb guide` exposes the entries and `wb guide <topic>` exposes one.
- `crates/wb-core/src/manual.json` is the source for command names/usages, sections, command descriptions/examples, topics, and shortcuts. `wb manual` returns this; `wb manual <topic>` finds a doc entry.
- `crates/wb-core/src/commands.rs` contains the typed capture-field parser, the Help action, manual lookup, and view-line parser. Its tests compare parser cases with `crates/wb-core/tests/commands-cases.json` and cover `help templates`, `help views`, and view lines.
- CLI entry points are registered across `crates/wb-cli/src/{lib,read,study,reading,mycommands,notebook,pages,docs}.rs`. `wb help` derives its listing from that registry; `wb guide` is registered in `pages.rs`; `wb manual` is registered in `notebook.rs`.
- UI entry points: `ui/src/main.ts` exposes Help from More and the Study tab; `ui/src/toolbar.ts` exposes Help and Layout; `ui/src/panes.ts` renders Guide, Commands, and Keys. `ui/src/actions.ts` routes parsed `help`, `layout`, and `notebook` actions. `ui/src/layouts.ts` owns saved pane arrangements.

## Route inventory

| Surface | Current route / content | Notes for parity review |
|---|---|---|
| Window Help | More → Help; Study tab also opens Help. Pane tabs are Guide, Commands, Keys. | Guide loads `wb guide --json`; Commands loads `wb manual`; Keys are a local `KEYS` array in `panes.ts`. Guide/command content is searchable within its selected tab. |
| Help from command field | `help [topic]` parses to a Help action and opens Help with that topic. A topic is initially routed to Guide when it matches a guide name/title prefix; otherwise the Commands tab is selected. | Parser resolves manual topics or Guide topics. UI's Guide-routing test checks starts-with against name/title, while `guide_entry` accepts exact names/titles, singular/plural equivalence, or a unique name prefix. Edge cases can therefore route differently. |
| Guide CLI | `wb guide [topic] [--json]`. | Guide topics are distinct from the command manual. Guide descriptions and terminal output share `guide.rs` data. |
| Command manual CLI | `wb manual [topic] [--json]`. | `manual.json` also supplies command names used by the capture-field suggestions. |
| General CLI help | `wb help [topic]`; no topic lists registered CLI commands, a topic shows registered command summaries. | This is a separate CLI command registry from the capture-field manual and Guide. Don't describe it as identical to the typed command field. |
| Typed command field | `ui/src/actions.ts` parses through wb-core; actions dispatch to UI behavior and/or CLI commands. Includes navigation, capture, notebook queries, help, and layout actions. | `notebook …` with filters produces the same result rows as a page View and `wb view run`. Existing parser compatibility corpus is generated from Python cases. |
| Saved pane arrangements | Toolbar Layout menu and Settings → Layouts; `layout save|load|list|rm` in the command field, plus `wb layout …` CLI forms. | The current UI and `layouts.ts` call these **Layouts**. Older redesign sheets called this feature “view”; the current Notebook feature also has “Views,” so preserve the distinction. |

## “View” and “Layout” distinction

- A **View** is a read-only, live list of Notebook pages/questions matching a `notebook` query. It can be opened in the Notebook main column, saved as a ` ```view ` page block, run from the command field, or inspected with `wb view run`. One shared `view_line` parser is intended to keep these inputs aligned. It returns rows; it does not arrange panes or write study content.
- A **Layout** is a saved arrangement of open panes. The Layout menu / Settings → Layouts and `layout` commands save, list, load, or remove that arrangement. Loading one applies pane state. It does not query Notebook pages.
- Recommendation: keep “View” for Notebook query lists and “Layout” for pane arrangements in all new task labels, Guide text, manual entries, and examples. Add a short cross-link under each Help topic (“Notebook Views” vs “pane Layouts”) only if H05/H08 review confirms it helps discovery.

## Current discoverability gaps / discrepancies to resolve in implementation review

1. Guide has six broad nouns, not task-oriented entry labels. The current pane lists all matching entries but offers no explicit topic index beyond the prose headings and search.
2. The Guide and Commands datasets have separate schemas and separate source files. Command examples live in manual metadata; Guide examples are embedded in paragraph strings. This means examples and task names are not centrally enumerable or mechanically checked against runnable parser/CLI actions.
3. Help's Commands pane is backed by `manual.json`; the core parser accepts a command language, while the `wb` CLI has a distinct command table. They overlap in purpose but are not interchangeable inventories. Help should say “command field” for manual/parser entries and `wb` when referring to terminal commands.
4. Keys in the UI are not drawn from the manual metadata. They can drift unless included in the parity checklist or moved to a shared data source.
5. Topic routing/search differs at the edges: initial Help tab routing uses a Guide prefix check; the Guide resolver supports exact title and singular/plural matching plus unique prefixes; parser routing checks manual entries before Guide entries. Test ambiguous prefixes and words matching both catalogs before changing labels or routing.
6. Some Guide examples are CLI commands, some are UI instructions, and some are prose examples of command-field syntax. Label examples by surface and ensure each typed example says whether it is for the field or terminal.
7. Command-manual example buttons call `app.run(typed)`, so examples are executable, not copy-only. The implementation pass should verify each button's route and side effects and keep any write examples on scratch data. Do not finalize task-oriented labels or decide where Help sits in the interface until H05 and H08 findings are available. Their pane and study-tool decisions may change the destinations and user-facing names Help should point to.

## Proposed task-oriented topic labels (provisional; gated)

Use a browsable topic list grouped by what someone is trying to do, with each item retaining a precise destination and surface. These are candidate labels only; H05/H08 may require adjustment.

| Candidate task label | Existing source / destination |
|---|---|
| Find a page from a template | Guide: Templates |
| Organize pages and open items together | Guide: The Shelf |
| Show a live list of pages | Guide: Views; command field `notebook …`; `wb view run` |
| Keep related places together | Guide: Threads |
| Write and track questions | Guide: Questions |
| Look up a Strong’s entry from a page | Guide: Word blocks |
| Arrange and restore panes | Layouts Help; command field `layout …`; `wb layout …` |
| Search, go to a passage, or run a command | Commands manual and command field |
| Use a keyboard shortcut | Keys |

Suggested organization: **Find and open**, **Write and organize**, **Arrange the window**, **Commands and keys**. Keep guide entries browsable without requiring exact command knowledge. These group names and task labels remain proposals until H05/H08.

## Shared-source proposal for examples

Keep `guide.rs` as the Guide text owner and `manual.json` as the existing parser/manual catalog during this audit. For a later approved change, add machine-readable example records with fields such as `surface` (`window`, `command_field`, `terminal`), `task`, `input`, `expected_route`, and `description`. Render the same applicable examples in Help and CLI documentation where formats allow. Keep all Scripture examples generated from the Bible database; don't embed verse wording. Add no example that writes to the real study folder, and use scratch data for verification. Since current Help examples execute on click, verify their actions and any writes explicitly.

## Command and Help parity checklist for implementation

- Inventory every parser `Action` and capture-field alias against `manual.json`; identify intentional UI-only actions and command-only topics explicitly.
- Inventory every registered `wb` command separately against terminal examples and `wb help`; do not claim parser/CLI equivalence just because names overlap.
- For each task label, show the window destination, typed command-field equivalent where one exists, and `wb` terminal command where one exists. Mark unavailable routes plainly.
- Verify `help` topic resolution for exact names, titles, singular/plural, unique prefixes, ambiguous prefixes, and strings present in both Guide and manual catalogs. Ensure displayed tab and selected content agree.
- Verify Help search over Guide, Commands, and Keys; empty results; case handling; and link/route behavior after H05/H08 settle pane destinations.
- Check all typed examples against `parse` and their expected UI route; check terminal examples against CLI registrations and usage. Preserve parser compatibility cases and existing command semantics.
- Verify every core action's window path has a `wb` command as required by `CLAUDE.md`; document exceptions that are genuinely view-only or helper functions, rather than silently implying parity.
- Keep View and Layout names distinct in labels, topic search, command docs, keyboard help, and examples.
- Run command-case, CLI help/manual, targeted UI route, golden/Python compatibility, and relevant WebKit checks only during an authorized implementation pass, on scratch study data and isolated ports; no real study-folder writes.

## Decisions still requiring review

- Approve the proposed task-grouped topic index and final labels after H05/H08.
- Decide whether example metadata should be consolidated, and whether Guide examples need first-class records instead of prose-only examples.
- Decide whether Help should link directly to destinations (pane/tab/action) and how those links behave with the eventual H05 pane/focus design.
- Decide whether `Keys` stays a UI-owned catalog or joins shared Help metadata.
- Decide how to make parser/manual/CLI mismatches visible to maintainers without changing accepted command semantics.

## Files changed

- Added only `docs/current/handoffs/09-help-review.md`.

## Checks

- Read-only source and documentation inspection only. No tests or app runs were requested or performed. No study-folder files were accessed or changed.
