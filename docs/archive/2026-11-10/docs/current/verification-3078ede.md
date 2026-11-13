# H01 and H02 at 3078ede

## H01 merged verification

**Revision** `3078edebf9d0f3ee26e8a23ef277ea43eb931cca`. The checks used a fresh Git archive extracted into `target/handoff-3078ede/src`. The managed worktree was read-only in the execution environment. The archive excluded the planning checkout's uncommitted distribution and documentation work.

**Fixture** Copied the study folder with `scripts/scratch-study.ps1 -Dest <audit>/tmp/bible-workbench-rs/study-scratch`. Each mutating suite used its own copy or a new scratch directory. Rust and Python read the local Bible database. Its SHA-256 matched before and after the checks (`FE8778FD97BC8491EEC476F5BD209D168BDAC09760ABE6DACE1D3DEBBF7A750C`). The control fixture retained the same 249 file paths and differed in bytes only in `sets/nt.md`. The Python checkout's HEAD was `768f2987245704eb85a6a5ef5d8b4590760400e1`.

| Check | Command and inputs | Fresh result |
| --- | --- | --- |
| Rust workspace | `cargo test --workspace --locked --offline -j 2` with temporary files under the audit directory | **172 passed, 0 failed**. The initial restricted run stopped at Windows linker error LNK1104. The retry used normal file access. |
| Fresh release CLI | `cargo build --release -p wb-cli --locked --offline` | Built successfully. Used for the golden, plan, Python-open and browser fixture checks. |
| WebKit | `node scripts/fixtures.mjs` then `npm.cmd run test:webkit -- --workers=2`, port 1939, Playwright WebKit 27.2 build 2370 | **20 passed, 10 project-specific skips, 0 failed**. Generated Numbers 24–26, Psalm 119 and the book list. The browser download and loopback connection required normal network access. |
| Golden, full fixture | `python -u scripts/golden.py`, port 1940 | **93 of 103 matched**. The first mismatch was `wb set list` keeping a document item on the Rust side that the Python reader skips by design. |
| Golden, control fixture | Same command, port 1941, with a fresh copy of the same fixture and only the single document row omitted from `sets/nt.md` | **103 of 103 matched**, including all ten cases that diverged on the full fixture. |
| Document plans | `python -u scripts/doc-plans.py` | **16 of 16 matched** across eight threads, two plan types each. |
| Python open | `python -u scripts/py-opens.py` | **5 of 5 counts matched**. Both read 42 anchored notes, 8 threads, 146 thread places, 8 trails and 3 sets. |
| Native real mouse | `cargo build --locked --offline -p bible-workbench -p wb-cli`, Vite on 1938 via `TAURI_CONFIG`, then `node measure/real-drag.mjs` with its own scratch copy and WebView2 on 9335 | **5 of 5 passed**. Block reorder and page nesting persisted. The OS file drop and native Browse worked. All three attachments persisted, and the dropped files were checked byte for byte. |

The previously recorded **420 of 420** merged desktop checks are historical. The five real-mouse checks above are the fresh desktop baseline for this handoff.

The first golden failure inserts a key and a note ID into Rust's side of the harness's run-wide ID and key normalization tables. Later cases depend on those same ordinal aliases and on state created by preceding cases. The control confirms that removing the one Rust-only row resolves the downstream failures. The full-fixture result still stands. Review whether the golden harness should explicitly account for the documented Rust-only set item when comparing a real-world fixture.

## H02 reader diagnostics

### 0590 highlight visibility

**Reported context** 1 Corinthians 13:10, KJV, build `3078ede`, with a secondary reader open. The copied study had one personal highlight elsewhere in chapter 13 and no highlight or colored thread mark at verse 10. The report did not identify the exact visible mark. The reproduction seeded a new scratch study with a yellow fill and a verse note at 13:10 and a green thread covering 13:10–11. Both native readers opened the same chapter. Measurements count word spans with fill or thread underlines, excluding marked spaces.

| Action | Main fill / thread | Open secondary fill / thread |
| --- | ---: | ---: |
| Open both with all layers on | 18 / 49 | 18 / 49 |
| Your highlights off | 0 / 49 | 18 / 49 |
| Your highlights on | 18 / 49 | 18 / 49 |
| Green thread off | 18 / 0 | 18 / 49 |
| Green thread on | 18 / 49 | 18 / 49 |
| Master off | 0 / 0 | 18 / 49 |
| Reload and reopen secondary with master off | 0 / 0 | 0 / 0 |
| Master on with secondary still open | 18 / 49 | 0 / 0 |
| Reload and reopen secondary with master on | 18 / 49 | 18 / 49 |
| Both individual layers off, master on | 0 / 0 | 18 / 49 |
| Reload and reopen with both individual layers off | 0 / 0 | 0 / 0 |

A note dot remained in each reader, and the secondary reader kept its verse-location badge in every row. The menu wrote `mine`, `all` and `hidden` to browser storage. Toggle-only operations left every scratch study file byte-for-byte unchanged. Reload also ran the existing startup migration that wrote the default System theme to `settings/theme.json`. Highlight, thread and note files were unchanged across reload.

In `ui/src/main.ts`, the menu calls `refreshMarks()`, which only paints the main reader. The secondary reader calls the same painter when opening, redrawing a chapter or refreshing its pane from study changes. In `ui/src/reader.ts`, the painter filters personal highlights and colored threads separately and still paints notes and questions. Selection, find emphasis and the secondary location badge have separate display rules.

### 149b direct Strong's links

**Identified Primary** for this import trace means the bundled eBible KJV USFM, the imported SQLite rows and the checked application source and outputs. Read-only SQLite inspection used `mode=ro`. The indices below are zero-based. The original-language observation is limited to the stored Strong's tags. No lexical or doctrinal conclusion is drawn.

| KJV reference | Index | Stored token | Strong's / group / italic | Source and CLI |
| --- | ---: | --- | --- | --- |
| 1 Corinthians 13:4 | 1 | suffereth | NULL / 0 / 0 | Plain USFM token. `wb word` returns no lexicon. |
| 1 Corinthians 13:4 | 2 | long | G3114 / 2 / 0 | Tagged token. `wb word` returns G3114. |
| 1 Corinthians 13:4 | 3 | and | NULL / 0 / 1 | Inside `\add`. `wb word` returns no lexicon. |
| 1 Corinthians 13:10 | 2 | that | NULL / 0 / 0 | Plain USFM token. `wb word` returns no lexicon. |
| 1 Corinthians 13:10 | 6 | is | NULL / 0 / 0 | Plain token before the tagged `come`. `wb word` returns no lexicon. |
| 1 Corinthians 13:10 | 7 | come | G2064 / 5 / 0 | Tagged token. `wb word` returns G2064. |
| 1 Corinthians 13:10 | 14 | shall | NULL / 0 / 0 | Plain token before the tagged `away`. `wb word` returns no lexicon. |
| 1 Corinthians 13:10 | 17 | away | G2673 / 10 / 0 | Tagged token. `wb word` returns G2673. |

Python's `workbench/kjv_import.py` handles `\w` tags and `\add` italics independently. Rust reads the nullable `strong` column and italic flag in `crates/wb-core/src/bible.rs`. The word view in `crates/wb-core/src/views.rs` looks up a lexicon entry only from the stored number. Both readers share the same word card and renderer. Clicking the unlinked `is` and tagged `come` in each native reader confirmed all four card results. The card has a “No Strong’s number on this word” state, and the italic CSS class is derived independently. Nearby tagged English words are evidence of the source's tag placement. Extending any tag to nearby words would require separate alignment evidence.

### Italic styling

Computed on the native main and secondary readers using unmarked tokens from 1 Corinthians 13:1. Both use Literata. Upright text is weight 400. An italicized word is weight 500 with italic styling and an sRGB mix of 78% foreground and 22% accent.

| Built-in theme | Page | Upright | Italic, rounded | Upright / italic contrast against page |
| --- | --- | --- | --- | --- |
| Light | `#FBF9F4` | `#231F1A` | `#3A291B` | 15.56:1 / 13.25:1 |
| Dark | `#17140F` | `#E9E2D4` | `#E7D4BD` | 14.25:1 / 12.76:1 |

The text colors are close to each other (about 1.17:1 in light and 1.12:1 in dark). Slant and weight supply most of the distinction. These are the default, unmarked samples. Red-letter and current search-hit rules can override the italic color, and custom themes change its inputs.

### Review gate

- **Aligns with your request.** Repaint every open reader when layer visibility changes. The bounded change is to reuse the shared painter on the already drawn views for both menu and command actions. Add a two-reader regression check for hide, restore and reload while preserving location and verifying that notes and question badges are independent.
- **Conflicts with your request.** No conflict identified. A guessed Strong's link would conflict with the requirement to follow the stored alignment. Keep direct links source-backed. For review, an unlinked word card could offer the verse interlinear with wording that identifies the missing direct tag.
- **Not prompted by you, but relevant.** A label or hint can distinguish study fills and thread lines from note and navigation marks. The two built-in themes already tint italics, so a stronger tint is a readability decision. Review it in both themes over plain and marked text before changing tokens.

The diagnostic command was `node measure/h02-audit.mjs` in the isolated source tree with WebView2 on 9338. The first probe navigated before the initial WebView URL was ready. A second probe proved fill behavior but used an uncolored thread. The final probe waited for navigation, seeded an explicitly colored thread and completed both persistence and card checks.

No product source was changed. Diagnostic code, build output and logs are under the ignored `target/handoff-3078ede` directory. The final run logs are `rust-retry.log`, `release.log`, `webkit.log`, `golden-network.log`, `golden-compatible.log`, `doc-plans.log`, `py-opens.log`, `real-drag.log` and `h02-final.log`.
