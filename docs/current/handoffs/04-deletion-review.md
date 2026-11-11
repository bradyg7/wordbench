# H04 Delete and Undo — review draft

Design reviewed at HEAD `3078edebf9d0f3ee26e8a23ef277ea43eb931cca`. The user authorized the recommended changes. Keep the original deadlines across restart, leave old Trash on its existing policy, promote children on single-parent delete, and exclude thread records. For Delete All, use the narrower ordinary Pages tree scope and list any retained children in the preview. Implementation follows H03 and the H06 editor contract. This review records approval of the design. Erasure is exercised only on scratch data during implementation.

## Evidence first

All sources below are **Identified Primary**: repository instructions, recorded decisions, or actual source inspected in this checkout. Source inspection establishes code paths, not passing runtime behavior. No external sources or study-folder contents were consulted.

| Source | What it establishes |
|---|---|
| `CLAUDE.md`, “Rules that never change” | Notes/questions wait seven days; explicit Erase now exists. Other Trash is retained. Real study files must not be test targets. |
| `docs/archive/debug-spec.md:312–351`, D1 | Recorded intent: permanent deletion after Undo; 10 seconds single, 30 seconds batch; no single-item confirmation; Delete All confirms count and excludes templates, Pinned, and days unless selected. Threads are expressly exempt. It calls for user-approved CLAUDE.md changes. |
| Same D1 text | Restart policy is inconsistent: the mechanism says sweep items older than one minute, while acceptance says closing within ten seconds causes erasure on next open. It does not distinguish old Trash from new pending deletes. |
| `crates/wb-core/src/pages.rs:354`, `release` | Deleting a parent promotes direct children into its position and renumbers affected siblings. It does not delete descendants. Changes are successive writes without an operation record. |
| `crates/wb-cli/src/study.rs:105`, `:373`; `notebook.rs:277` | Note, trail and Inbox removals release children before deleting the file. A failed final deletion can therefore follow successful hierarchy changes. |
| `crates/wb-core/src/store.rs:514`, `:1314–1380` | Trash filenames have second-resolution timestamps. Restore renames one file to an inferred destination and rejects an occupied destination. It preserves that file's bytes but has no child/sibling restoration. Sweep and erase recognize note/question/day filenames, not all file types. |
| `app/src-tauri/src/main.rs:290`; `ui/src/notebook.ts:1563`, `:1629` | Startup still runs the seven-day sweep. UI confirms removal, routes by page kind, and exposes Trash. No D1 timed operation exists here. |
| `crates/wb-core/src/threadpage.rs:1–42`; `pages.rs`, `Tree::children` | R1 displays threads as pages; pins live in `settings/pages.json`. A thread's displayed children are associated notes, not ordinary parent edges. H03 may change this relationship. |
| `crates/wb-cli/src/lib.rs:175`; `pages.rs`, `block rm`; `ui/src/actions.ts:265` | `page rm` currently falls back to `note rm`. Block removal is an edit. Existing command-field Undo covers selected earlier writes, not deletion restoration. |
| `crates/wb-core/tests/study.rs:70`; `store_cache.rs:71` | Existing assertions expect deleted files retained in Trash. They do not establish D1 behavior. |

## Policy questions from the design review

1. **What should happen when you reopen before Undo expires?** Recommended: resume the remaining 10/30 seconds; if the recorded deadline has passed, finish erasing that operation. CLI deletion would use the same deadline, return the operation ID and exact restore command, and physically erase at the next sweep if no app is running. Alternatives recorded in D1 are immediate erasure on reopen or a separate one-minute grace. Which rule should govern both UI and terminal? `--now` would explicitly bypass Undo.
2. **Should files already in Trash keep their original seven-day policy?** Recommended: yes, and never enroll unrecorded Trash files in the new seconds-long sweep. Keep legacy files accessible through the terminal while removing the window's Trash view as D1 requests. Extending accelerated erasure to existing Trash needs an explicit decision.
3. **What does deleting pages include now that threads are pages?** Recommended: an ordinary parent's Delete removes only that parent and promotes its children, with 30 seconds to undo the whole change; Delete All removes the explicitly previewed eligible pages, including eligible descendants, while preserving unchecked Pinned pages, templates and days. Keep thread records exempt, and clearly disclose their exclusion, until you explicitly include them. Should Delete All cover every ordinary Notebook page, including anchored notes/questions, or only the Pages tree? This scope must be named in the confirmation and CLI preview.

The opening status records the accepted implementation direction. Single-item versus multi-file hierarchy changes, and an excluded descendant inside an included parent, must be shown distinctly in the preview: “X pages deleted; Y retained pages moved up.” Counts use unique physical page IDs, never appearances in multiple lists. An empty deletion set is refused.

## Proposed operation contract

- One core service plans, commits, restores, expires and recovers deletions. UI, aliases (`note rm`, `inbox rm`, `trail rm`, `day rm`, `template rm`, `page rm`) and command-field deletion use it. Do not extend the generic low-level `trash()` to silently accelerate plans, findings, document records, reading logs, thread records, or question-fold backups.
- Preview resolves the approved scope against H03's actual page relationships. It captures deleted paths, promoted children, affected siblings, relevant pin/parent/order fields, and original file hashes. Revalidate the plan before mutation; if files changed, return a refreshed preview instead of executing stale consent.
- Record an operation before changing live files: unique ID, schema version, source, state, original relative paths, byte snapshots, expected before/after hashes, changed fields, and expiry. Proposed storage is a private operation directory under `.trash/`; its exact layout and Python compatibility require validation. Preserve existing page formats and ordinary legacy Trash names. Never overwrite a same-second Trash filename or an existing destination.
- States: preparing → pending → restoring/restored or erasing/erased; interrupted/conflicted states remain recoverable. Start the Undo clock only after the complete pending operation is committed. File publication must be atomic per file, with a durable journal and a study-root writer lock shared by Rust CLI and app. Multiple files are not assumed atomic. Python or manual writes still require hash checks.
- Save editor work before planning, then cancel/await queued autosaves for affected pages so a late save cannot resurrect a deleted file. Deleted page tabs enter a known removed state; Undo restores their page/focus where still applicable without moving the reader. Independent delete notifications retain independent operation IDs; another toast must not destroy an active Undo.
- Undo restores deleted bytes and reverses hierarchy/pin changes as one recoverable operation. Preserve missing-versus-present fields, original paths, anchors, ordering, and unknown front matter. With no intervening edits, every affected file must match its original bytes. With later edits, do not overwrite them: compare the touched fields and merge only verified safe inverse changes; otherwise report a conflict and retain the recoverable snapshot. Never announce successful restoration while part of the operation is incomplete.
- If staging or a hierarchy write fails, roll back completed mutations where hashes still match. A crash during preparing/restoring triggers recovery before expiry is considered. Unknown versions, missing journals, corrupt snapshots, path escapes, occupied restore destinations and changed payloads are retained and reported, never treated as permission to erase.
- Expiry and Undo compete under the same operation lock. Once irreversible erasure has begun, Undo cannot report success. Erase only payloads owned by a committed, expired operation; remove all operation snapshots containing deleted content when completion succeeds. If erasure fails, report “Deletion cleanup incomplete,” retain the journal, and retry idempotently. Do not promise exact physical erasure at a deadline while the app is closed or storage rejects deletion.
- Repeated deletion of the same ID, nested batches, intervening hierarchy changes and multiple running clients must either serialize safely or return a clear conflict. A second deletion must not erase the only recoverable copy of an earlier operation. Never sweep all of `.trash/` based on filename age for D1.

## UI and CLI shape for review

Single ordinary page: `Deleted “title” · Undo` for 10 seconds. A parent that promotes children or any multi-page batch gets one 30-second operation and Undo. The result distinguishes deleted pages from moved survivors. Delete All belongs in the Pages heading menu and previews scope, exclusions and counts before one confirmation. Pinned/template/day options start unchecked; excluded descendants survive and are promoted to the nearest surviving eligible parent or root.

Proposed terminal surface: `wb page rm ID`; `wb page rm --all` returns a preview without mutation; `--yes` commits an explicit batch; `--now` requests immediate irreversible finalization. Exact inclusion flags follow the user's scope answer. Add `wb page undo OPERATION`, operation inspection and a sweep command; expose every core action to CLI. Return structured counts, state, deadline and restore command. Keep existing `wb trash`, `restore`, `erase`, and `empty` for legacy entries; operation-owned files must route through the whole operation or refuse a destructive partial action. Do not claim legacy Trash commands currently support arbitrary non-note files: the implementation rejects them.

Core owns deadlines; the window displays them and requests expiry, rather than making toast dismissal the authority to erase. At restart, recover interrupted work first, apply the approved expiry policy, and show remaining Undo opportunities. Keyboard focus can reach Undo, screen readers receive the result, and pointer/touch actions use the same operation.

## H03/H06 coordination: block deletion (`9ed7`)

H03 must supply final page identity, parent/association semantics, inline-question addressing and pin storage before coding. Thread-associated notes can appear under more than one thread; they cannot be recursively deleted just because they are displayed underneath one.

Proposed H06 agreement: removing a table, card, question callout or other block is a page edit with editor Undo, not a page deletion or a timed page-erasure operation. A card referencing a thread/word removes only the reference block. Keep neighboring bytes and focus, and preserve the page even when its last block disappears. Empty-day writes currently can trash the day, so H06 must not route last-block removal through that implicit deletion path. Define a separate empty-page representation if required before coding it.

H06 owns the visible block menu, edit history and matching CLI inverse operation; H04 owns page-level deletion records. Focused-editor Undo applies to editor history; page deletion has its explicit operation Undo. If a page is deleted after a block edit, save the current page first. After page restoration, retained editor history may apply only if its expected revision matches. No competing Undo handler may consume an action silently. This agreement is proposed, not confirmed by an H06 session.

## Acceptance and implementation gate

After approval, use isolated scratch data and deterministic clocks/failure injection:

| Area | Required evidence |
|---|---|
| Restoration | Exact bytes, original paths, unknown fields, anchor, absent/present parent/order/pin, children, siblings and applicable sidecars; no changes to unrelated files. |
| Timing | Before/at/after 10 and 30 seconds; early dismissal; successive deletes; resume/restart before and after deadline; clock movement; CLI without a running app; explicit `--now`. |
| Batch | Mixed roots/descendants; exclusion options including pinned descendants; duplicate appearances; empty selection; stale preview; thread associations; one Undo restores the whole result. |
| Failure | Crash or failure at every journal/file transition; partial erase; repeated recovery; restore collision; malformed journal; path/symlink escape; autosave race; UI/CLI concurrency; external edit conflict. |
| Preservation | Legacy Trash age policy; unrelated thread/plan/highlight/document/finding/reading backups unchanged; question folding unchanged; same-second collision cannot overwrite. |
| Interfaces | UI and CLI use the same operation; accessible Undo; keyboard/touch; page tab restoration; reader place unchanged; H06 block and page Undo do not interfere. |
| Compatibility | Targeted Rust/CLI tests, affected golden cases and documented Python differences, scratch `py-opens.py` and `wb study check`, then affected desktop/WebKit tests on the integrated revision. |

Once H03 and the H06 editor contract are ready, implement the scoped change and include the concrete dated CLAUDE.md retention-rule diff for review. Installation remains a separate decision.

## Reasoning and exact check record

- **Aligns with your request.** This design preserves the recorded Delete/Undo intent and batch controls while stopping at H04's design gate. Evidence precedes proposed policy.
- **Conflicts with your request.** No authorized request is intentionally contradicted. Recommended restart deadlines differ from D1's unconditional next-open sentence, and preserving old Trash narrows its broad sweep wording; both are explicitly awaiting your choice.
- **Not prompted by you, but relevant.** Durable operation records, stale-plan checks, autosave coordination and conflict recovery are needed because current deletion mutates multiple files and a simple file restore cannot restore the tree without risking later edits.

Checks performed: read the shared rules, current queue, new findings, D1, CLAUDE.md, H06 handoff and the source paths above; `git rev-parse HEAD` returned the revision recorded above; `git status --short` confirmed the pre-existing dirty checkout. Relevant memory registry search found no project/deletion entry and supplied no design facts. Some exploratory searches referenced nonexistent convenience/test filenames; subsequent reads used the actual source files listed above. No app, tests, builds, sweeps or deletion commands were run. No runtime pass is claimed.

Files changed by H04: **only `docs/current/handoffs/04-deletion-review.md`**. No study-folder writes, source implementation, repository-rule edits, or other sessions were started.
