# Bible Workbench current specification

Reviewed 2026-11-10 against the local Git refs and Phase 2 plans. Bible Workbench is a personal study tool for reading Scripture, looking up source material, and organizing the reader's own work. The Rust core serves the `wb` CLI and Tauri app. Rust is the target for all continuing development. Preserve access to existing study files and exports during the transition, then archive the Python app once Rust can stand alone. Improve legacy workflows where Rust offers a better implementation. [Repository rules and commands](../AGENTS.md)

## Revisions reviewed

| Local ref at review | Evidence |
| --- | --- |
| `main` / local `origin/main` at `d7384be` | Windows ZIP packaging and landing page, H02 reader fixes (`a420781`), and desktop debugging implementation (`2137c3b`). |
| `codex/landing-distribution-spec` at `dbce604`, this checkout | Separate landing site, customer NSIS packaging preparation and manual pilot activation. The desktop closeout on `main` is absent from this branch. |
| `codex/installer-port` at `248c45a` | Builds on `dbce604` with an optional Tauri updater. The real signed update path remains unverified. |

Use the exact base revision when starting a task. A combined build of the three lines above remains to be integrated and checked if the private pilot is selected as the release path.

## Product phases

| Phase | Current state | Remaining work and acceptance |
| --- | --- | --- |
| 0 · Prototypes | Complete. Reader, scratch Git sync and Typst experiments exist. | The sync spike is evidence for Phase 3. [Phase 0 results](archive/2026-11-10/docs/phase0-results.md) |
| 1 · Core and CLI | Complete as a phase. Rust/Python parity has a golden harness and documented exceptions. | Run the relevant parity checks on future changes. [Phase 1 results](archive/2026-11-10/docs/phase1-results.md) |
| 2 and 2b · Desktop | Desktop implementation and the follow-up debugging are on `main`. Includes reader and word cards, dock, Notebook, Shelf, reading plans, settings, layouts, Help and early exports. | Close the user study week, verify real Word/PDF outputs, and collect one current-revision desktop baseline. See the closeout below. [Phase 2b plan](archive/2026-11-10/docs/PLAN-phase2b.md) · [Build sequence](archive/2026-11-10/docs/PLAN-phase2b-build.md) · [Phase 2 results from main](archive/2026-11-10/main-d7384be/docs/phase2-results.md) |
| 3 · Phone and sync | Partial. Compact reader, selection and sheets have browser coverage. | Finish and validate the complete Compact study flow, including Notebook, Shelf, navigation and return to the originating verse. Choose the private sync remote and credential model. Integrate sync with offline use, conflict recovery and a two-copy scratch test. Complete a week of touch reading and note taking with notes reaching the desktop. |
| 4 · Tablet and native mobile | Pending. | Design and verify Medium layout, external keyboard and touch. Build for Android and iOS, arrange a Mac or cloud build for iOS, and repeat the same study flow on each size and native target. |
| 5 · Documents | Partial. Word and Typst PDF generation, templates, Looks, parts controls and PDF page counting are already in the product or on `main`. | Replace the remaining Python-only export workflows in Rust. Compare approved existing source fixtures in real Word and PDF, and in PowerPoint if that format ships. Preserve database-backed verse checks. |
| 6 · Remaining tools | Partial. Help, layouts, sets and the reading log already have implementations. | Reconcile the old checklist against the current UI. Read aloud, recordings, the select box and R6 Mark Read after Listen are still roadmap items. Determine which workflows already exist in Python and belong in the retirement checklist. |

[Original phase exits and device matrix](archive/2026-11-10/docs/PLAN.md#8-phases) · [Community proposal, awaiting a product decision](archive/2026-11-10/docs/PLAN-community.md)

### Desktop closeout

- `main` has the H02 fixes, transactional page Undo, page and question actions, independent Notebook tabs, dock focus and layout restoration, shortcut assignment, Notebook filters and visual editing, export resolver and page previews, study-tool controls and Help improvements. Keep the older handoffs as provenance. Confirm behavior against `main` when evaluating old findings on another installed build.
- D1 on `main` uses a 10-second single-page window and 30 seconds for batch or child promotion. The original deadline survives restart. Legacy Trash remains available for legacy note and question operations. See `crates/wb-core/src/deletion.rs` at `2137c3b` and the legacy deletion rules in [AGENTS.md](../AGENTS.md).
- On `main`, new exports default to `<study>/exports/` with `WB_DOCS_DIR` as an override. Records stay in `<study>/documents/` and the resolver also checks legacy locations. Verify that Rust can find existing exports, companions and kept versions after the Python checkout is gone.
- Track the tablet keyboard retest (W-1), chronological reading-plan source (W-2), local Webster's dictionary prerequisite (W-3), owner disposition of findings (W-4), real generated Word/PDF inspection including Word without the bundled fonts (W-5), the provisional secondary-reader size (M5), and the study week closeout. The owner marks findings handled.
- Full D4 builder scope beyond current page selection/preview and D11 ink measurement or Word pagination still need product decisions. A PDF page count already exists. Wider thread nesting needs an explicit storage decision. Retest Shelf and Notebook pointer and touch flows on the intended build before reopening implementation.
- Record one integrated Windows run with Rust tests, UI build, WebKit, native WebView2 desk and real drag, document-plan parity, Python-open compatibility and golden output. Use disposable study and export directories and a read-only Bible database. The historical desk run was **420/420** at `3078ede`. H02 subsequently recorded **103/103** golden parity using disposable copies with Rust-only set items omitted. These are historical results. [Baseline](archive/2026-11-10/main-d7384be/docs/current/verification-3078ede.md) · [H08 evidence](archive/2026-11-10/main-d7384be/docs/current/handoffs/08-study-tools-review.md) · [Findings workflow](archive/2026-11-10/docs/current/findings-workflow.md)

## Retiring the Python app

| Work | Evidence and acceptance |
| --- | --- |
| Finish the workflow inventory | Compare the Python UI and CLI against Rust on the chosen base. Record each Python-only workflow, its Rust replacement and the check that proves it. Rust already points users back to Python for direct passage exports, exports from existing lesson records, some legacy document structures such as Thread Dossier, PowerPoint generation and regeneration, and Word PDF companions. Verify those routes on `main`. Decide which can share the existing Rust export pipeline and where an equivalent output is acceptable. |
| Give Rust ownership of its data inputs | The developer DB fallback on this branch points to the Python checkout, and several setup and verification paths expect its built database. Define Rust-owned database inputs, schema/version checks, reproducible provisioning or build steps, and an independent packaging source with provenance. Preserve the read-only DB contract and resolve the dictionary inputs as well. |
| Replace development-time dependencies | `scripts/golden.py`, `doc-plans.py`, and `py-opens.py` use the Python checkout as an oracle. Capture reviewed expected results, legacy study and export fixtures, and document-plan baselines while it is available. Make routine validation use Rust and repository-owned fixtures. Move command/manual and design-token generation to repo-owned inputs so it also works without the old checkout. |
| Verify migration and archive | Open a disposable copy of real-format study data in Rust, resolve old export paths, and test supported reads, edits and export workflows with backups and recovery checks. On a clean Windows environment with no Python app checkout, prove developer setup, build, fixture generation, routine tests, packaging, installed GUI and CLI, and the daily study workflow. Once that passes, archive the Python app and preserve its history. Track Rust-only additions in their own phases unless they are needed for an existing workflow. |

Python compatibility during this transition means Rust can read and preserve existing study work. The old implementation can supply migration evidence and test baselines. New Rust behavior can improve on it with a documented contract and tests.

The handoff review identified additional Python workflows to account for before archive. These include saved chapter PDFs and PDFs on Shelf, ordered PDF packets, PDF inspection and editing, and multi-output export presets. It also confirmed shipped text-to-speech, approved personal recording playback, and desktop multi-selection. Named Python dock layouts use a different format from Rust layouts. Owner decisions on editable PowerPoint, conversion of the actual edited Office file, and layout migration belong with those implementation slices.

Start with three independent changes based on `main` at `d7384be`: add direct passage and existing owner-authored file sources to the Rust export pipeline, make Bible database provisioning independent of the Python checkout, and move design tokens and a legacy study regression fixture into repo-owned verification. Preserve existing data contracts in these first changes. A complete clean-environment run remains the archive gate.

The first three slices are committed as `d5d80a6` on `codex/rust-python-retirement`, based on `d7384be`. Direct passage and existing-file exports use the Rust Word and PDF renderers. The Bible provisioner builds from explicit, hash-locked local inputs. Token generation and a synthetic legacy study projection test now run from repo-owned inputs. The runtime and ZIP packager now use standalone or explicitly selected Bible database paths. The Webster dictionary builder uses a revision and SHA-256 pin. Shelf and the CLI can find and open saved PDFs, and a synthetic Rust test checks Word and slide plan fingerprints against reviewed legacy results. Rust also exports standalone KJV chapter PDFs with existing chapter notes and selected marks. The command cases and manual are maintained in Rust, and running the predecessor comparisons or exporting its command cases requires an explicit legacy checkout. Broader Rust golden coverage, PDF packets and editing, Office workflows, redistribution review, and clean-machine validation are open. The typed legacy build preset still asks for Pulpit, so use an explicit supported structure for existing-file exports until that preset is resolved.

### Subagent assignments

| Assignment | Recommended model and effort | Deliverable |
| --- | --- | --- |
| Workflow migration | GPT-6.1 Sol · high | Compare Python and Rust workflows, confirm export and Phase 6 gaps, and propose the first port with acceptance cases. |
| Database and packaging | GPT-6.1 Sol · high | Trace resource inputs, runtime lookup and packaging across the branches. Propose independent provisioning and a clean-machine check. |
| Independent verification | GPT-6 Luna · medium | Inventory comparison and fixture dependencies. Identify baselines to capture and propose Rust-owned regression checks. |

The first pass is read-only on the current checkout and uses Git to inspect other revisions. Implementation follows from the verified inventory and the selected base. The workflow and verification agents coordinate on legacy examples and expected output. The database and verification agents coordinate on fixture provisioning.

After the first pass, assign implementation by file ownership. Keep desktop closeout and export migration on the desktop base, scope Compact and sync as separate work after Phase 2, and start native mobile validation once the Compact flow works. The Windows pilot needs its own release-base decision. Keep archive closeout with the agent coordinating the clean-environment test so that the archive decision is tied to actual results.

## Windows release and private pilot

`main` contains a Windows ZIP build and separate site. The pilot branch contains a separate six-page site with unavailable release metadata, a reviewed-input staging contract, feature-gated installed resource paths and first-run setup, and GUI/CLI enforcement of manually issued certificates. Approved pilot policy is permanent offline use after activation. The optional updater remains on its own branch.

1. Choose the intended release base and reconcile setup, data paths, version metadata, site and installer/updater entry points. Confirm device allowance, transfers, update entitlement and hosting. Keep release metadata unavailable until there is a release artifact.
2. Finish redistribution evidence and notices for the exact bundled database and dictionary. Supply reviewed inputs, securely provision the production issuer and sign the intended Windows installer and update artifacts. Keep operator credentials and issuer files outside the bundle.
3. Verify fresh install and CLI launch from another directory, GUI and CLI activation, offline access, file recovery, missing or corrupt resources, upgrade, interrupted or rejected update, and uninstall on a clean machine using scratch study data. Confirm that the release page and any updater offer the same approved artifact.

[Pilot staging and operations](archive/2026-11-10/distribution/README.md) · [Licensing procedure](archive/2026-11-10/distribution/LICENSING.md) · [Data inventory](archive/2026-11-10/distribution/DATA-INVENTORY.md) · [Original distribution spec](archive/2026-11-10/docs/SPEC-landing-distribution-licensing.md)

## Repository structure for agent work

### Entry points in use

| Task | Start here | Validate with |
| --- | --- | --- |
| Reader, search or lookup | `ui/src/reader.ts`, `main.ts`, `select.ts`, `panes.ts`; `crates/wb-core/src/{bible,lookup,studyapi}.rs` | WebKit for touch and mouse, native desk for WebView2, golden for lookup or CLI changes |
| Notebook, pages and Shelf | `ui/src/{notebook,blocks,shelf}.ts`; core `{pages,threadpage,store,questions,shelf}.rs`; CLI `pages.rs` | Browser and native drag checks, core persistence tests, Python-open comparison |
| Dock, settings and commands | `ui/src/{dock,layouts,settings,toolbar,command,actions}.ts`; core `{commands,mycommands,relay}.rs` | Command cases, layout and shortcut tests, native desk |
| Exports | `ui/src/{pagedocs,documents,looks}.ts`; core `docs/`; CLI `docs.rs` | Document-plan parity, rendered verse checks, real Word/PDF where relevant |
| Runtime and release | `app/src-tauri/`, CLI dispatch, `site/`; on pilot branch `distribution/`, `scripts/release/` and `crates/wb-license/` | Branch-specific build and setup checks, clean-machine release validation |

### Proposed integration sequence

For desktop and phone development, use `main` as the proposed baseline because it contains the desktop closeout. Resolve the Windows release base separately when the pilot is next in scope.

1. Use root `AGENTS.md` for repository rules and this spec for current requirements. For each cross-cutting change, record the base commit, feature entry point, data contract, impacted GUI/CLI routes, owner decisions and exact acceptance commands in the change description. Update this spec when phase status or a durable requirement changes. Store completed evidence in the archive with its revision.
2. After selecting a shared base, use the next Notebook change to establish a small feature directory under `ui/src/`. Move cohesive Notebook code, styles and tests in reviewable slices behind the existing entry point. Split by page navigation, block editing and templates only where each boundary has a clear dependency direction. Verify both browser and native behavior after the first slice before extending the pattern to Reader, Shelf, Dock or Exports.
3. Keep Rust ownership in `wb-core`, `wb-cli` and the Tauri shell. Define the file or command contract before changing its implementation. For work spanning a UI feature and Rust, record the command and storage owner in the table above and validate it through the normal app and CLI entry points.
4. Route new run artifacts to ignored, worktree-local output. The existing screenshot paths under `docs/phase0/` and `docs/phase2/` are used by scripts and browser tests. Migrate their producers and consumers together in a dedicated change, then retain the reviewed reference captures as evidence.

**Aligns with your request.** The consolidated spec and entry points reduce how much history an agent must read before tracing a feature. The directory proposal uses Notebook as a bounded trial before wider moves.

**Conflicts with your request.** No conflict identified with planning a repository reorganization here. Moving study files would conflict with the existing Python compatibility contract. The proposed layout applies to repository source, tests, and run artifacts.

**Not prompted by you, but relevant.** The release and desktop branches have different setup and packaging paths. Establish the base before moving shared files so the reorganization does not have to be resolved twice.

## Evidence tiers

- **Identified Primary.** Local Git revisions, source, package manifests, original plans and decision records, and recorded test outputs. Historical reports establish results for their stated builds.
- **Identified Secondary.** Earlier queues and handoffs summarize findings and are retained for context in the [archive](archive/2026-11-10/).
- **Unverified/Flagged.** Current integrated runtime results, user closeout, native mobile targets, signed release readiness and production data redistribution evidence remain open.
