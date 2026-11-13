# H08 Study-tool action map and bounded repairs

Reviewed 2026-11-09 against Rust `3078ede`, Python source in the sibling `bible-workbench` checkout, and the H05/H09 working patches. Implementation was authorized by the user after the original design gate. No tools are retired or merged. No Bible mappings, scripture typography, study formats, or stored content change.

## Evidence and action map

These are identified primary sources: the application source files and existing command definitions. The Python behavior below is source-verified, not a claim that both installed applications were exercised side by side.

| User intent / action | Python route | Rust route | Terminal / command-field equivalent | Decision |
|---|---|---|---|---|
| Inspect notes and other work on a passage or selected words | `web/study.js` `openMine` / `renderMine`; My notes includes This place and Everywhere | Reader selection or verse context menu → Notes & lookup → `openPlace`; includes highlight, notes, questions, nearby notes, threads, original words | `wb anchor NUM.25:11`; `wb do "notes @Num 25:11"`; writes use existing note, trail, hl and thread commands | Keep. This is an anchored work overview; the lexicon and Notebook alone are not complete replacements. |
| Inspect one word | `web/lexicon.js` `renderEntry` and `renderPhrase`, via original-word hooks | Click/tap reader word → `lexiconBody`; desktop hover is a transient summary | `wb word NUM 25 11 24`; `wb strong H7065` | Keep hover and actionable card. They have different persistence and input behavior. |
| Find every occurrence | `web/finders.js` occurrences, `web/ticks.js` selection | Card or Strong's pane → Every use → `openUses`; existing rendering/category filtering and More remain | `wb uses H7065`; `wb uses H7065 --rendering zealous`; `wb do "uses H7065"` | Keep. A full result pane is needed beyond the compact word card. |
| Compare original words within a verse | `web/interlinear.js` and lookup hooks | Card → Interlinear; Alt-click reader word; Notes & lookup → Interlinear → `openInterlinear` | `wb interlinear "Num 25:11"`; `wb do "interlinear Num 25:11"` | Keep distinct from Every use: one passage versus occurrences across passages. |
| Keep a word lookup available | Python pane/pin behavior via `openPane`, plus shift-click lookup actions | Word card → **Keep as pane** → existing `openStrong`; normal pane Move/Float controls and H05 Focus pane apply | `wb do "lex H7065"` opens its pane; `wb strong H7065` supplies the content | Rename the word-card action only from Open as a tab to H05's Keep as pane. Passage Open as a tab still opens a second reader and remains unchanged. |
| Write about an original word everywhere | `web/lexicon.js` My notes → `web/study.js` Everywhere tab, original-word note form | Card → Note on H… everywhere; Strong's pane now also offers **Notes on H… everywhere** → existing `openPlace` with a lemma anchor | `wb anchor H7065`; `wb note add H7065 "user-authored text"`; `wb do "notes @H7065"` | Keep both direct writing and the existing-notes overview. Restore the route from a persistent Strong's pane. |
| Find notes at other occurrences of that word | `web/study.js` renders `everywhere.occurrence_notes` | `wb-core/studyapi.rs` already supplies `occurrence_notes`, but `openPlace` did not display them | `wb anchor H7065` or a directly mapped word anchor | Render the existing data under Notes where H… appears, with links to the original anchored overview. No new lookup or mapping. |
| Select results for a thread | Python `tickList`: count, word/verse choice, All, selected-only add, shift selection | Search / Every use / Near → `resultsBar` / `tickable`; typed `results` controls share `ResultList` | `wb do "results as verses"`, `wb do "results tick all"`, `wb do "results add Study"`; durable action `wb thread add-many Study <anchors…>` | Add visible count and marked-words/whole-verses choice where word anchors exist; synchronize typed changes. Identify individual row checkboxes. Follow last pointer/keyboard interaction. |
| Review personal highlights | `web/lists.js` `renderMarked`, titled Highlights | Layer menu → All highlights, or typed marked → `openMarked`, titled Marked | `wb hl list [--color …] [--thread …]`; `wb do "marked blue NT"` (UI also filters scope) | Keep. Highlights and temporary result ticks are separate data and must not be merged. |

## Existing differences that are made explicit

Rust currently selects **loaded** result rows, while Python's All loads remaining pages up to its limit. Rust also adds all loaded rows when nothing is ticked; Python requires a selection. This patch preserves Rust's existing behavior, labels its action **Tick all loaded**, and states **None ticked · adds all N loaded**. It does not silently change which places are written. Full pagination parity, shift selection, and changing the zero-selection rule would be a separate behavior change.

Search and Near retain whole-verse behavior. Every use has stored run anchors and now exposes its already-supported words/verses choice. No selector is offered on lists without those anchors. The typed commands remain compatible.

H02's sampled unmapped Strong's words are source-alignment facts, not inferred missing mappings. Existing italic treatment is retained. H05 owns movable-pane/focus mechanics; H08 uses its Keep as pane label. H09 owns Help organization; its existing Notes & lookup, Every use, Interlinear and Marked destinations remain valid.

## Reasoning and scope

- **Aligns with your request:** preserves each existing study action and adds visible routes for behavior already present in Python or Rust commands. The action map comes before any removal; no removal is proposed here.
- **Conflicts with your request:** none identified. No interpretation, sermon or lesson content is created, and the real study folder remains untouched.
- **Not prompted by you, but relevant:** the existing zero-tick fallback can add every loaded row. Its new status text makes that behavior explicit without changing stored data semantics. The source comparison also found occurrence notes already returned by Rust but omitted from the window.

## Files and checks

- `ui/src/main.ts`: word-card promotion label.
- `ui/src/panes.ts`: result selection controls, Strong's notes route, occurrence-note display.
- `ui/src/actions.ts`: typed shape changes update the visible choice.
- `ui/src/desk.css`: wrapping result controls for narrow panes.
- `ui/tests/study-tools.spec.ts`: browser regression tests using existing database-generated scripture and mocked study responses; no real study writes.
- This action map.

Exact checks in the isolated staging mirror:

- `npm run build`: passed (TypeScript and Vite).
- With `WB_UI_PORT=1899` and `PLAYWRIGHT_BROWSERS_PATH=C:/Users/brady/github/bible-workbench-rs/target/handoff-3078ede/browsers`, `npm run test:webkit -- ui/tests/study-tools.spec.ts --workers=1`: **6 passed in 14.2s**, three each at phone and desktop sizes.
- Initial attempts could not connect to the local server under restricted execution, then could not find WebKit at its default cache path. The passing run used approved local-server access and the already-installed browser above; no browser or app installation was needed.

UI-only changes do not alter CLI command output or require new golden cases. Installed-app checks, full pagination parity and release installation are not claimed by these tests.
