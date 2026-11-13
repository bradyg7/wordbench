# H05 · Dock, Shelf and focus — review gate

2026-11-09. **Design only; implementation requires review.** Audited checkout HEAD `3078ede` with existing uncommitted distribution, workflow and documentation changes. Only this review file was added by H05. No study-folder writes, application launch, document generation or image generation.

## Evidence before proposals

**Identified Primary:** current repository source and handoffs below. Existing design records establish intent; source inspection establishes implementation paths, not a fresh runtime pass. **Identified Secondary:** none used. **Unverified/Flagged:** pointer, touch, fullscreen and restoration outcomes remain runtime checks; historic test totals are not new results.

| Area | Observed implementation and consequence |
|---|---|
| Open All: regular and thread pages | `ui/src/shelf.ts:79` collects both `note|` and `thread|` items and opens only the first page; neither receives a folder mark. `panes.ts:523` routes threads through `notebook.ts:2150` to `openNote(thread:<id>)`. Notebook has module-level pane/editor state (`notebook.ts:72`, `430`). Multiple page tabs require isolating that state. `measure/shelf-checks.mjs:51` explicitly excludes both kinds from the expected marked-tab count. |
| Layout contents and restoration | `dock.ts:936` describes title, kind, key, side, front and optional float rectangle. `actions.ts:395` saves that array but loads only keys. Group membership/order, split shares, column/band sizes, minimized state, focus and view state are absent. `dock.ts:351` separately remembers widths, bands and per-key spots in local storage; that is not a named layout. The main reader position is not part of the saved payload. |
| Reopen identity mismatch | `pagedocs.ts:270` opens a document as `doc:<id>`; `actions.ts:414` splits keys on `|` and recognizes `doc`, so a saved document key does not reopen. `verses.ts:173` uses `versecard|<ref>`, also absent from the reopen table. Unknown kinds silently do nothing. Other pane kinds need an exhaustive inventory before a new schema is considered complete. |
| Shared Shelf ownership | `shelf.ts:95` marks an existing or new pane with a single folder after reopening it; another folder can overwrite that mark. `closeAll` closes matching marks without distinguishing tabs previously opened by the person. Ownership must be settled before page tabs multiply this behavior. |
| Pointer drops | Dock tabs use custom pointer movement and dock-only targets (`dock.ts:806`); Shelf rows use HTML drag/drop with their own `dragging` state (`shelf.ts:462`). No bridge appears between them. Existing Shelf checks drag a Shelf item to a folder and add an open tab through a menu; they do not prove a real Dock-tab drop. |
| Phone actions | Folder rows have a visible More button; item rows have Remove plus a context-menu-only Move/Also keep menu (`shelf.ts:224–277`). Open All is offered unconditionally (`214`, `300`), unlike the accepted R2 design's phone rule. This is a source-level discrepancy, not a touch reproduction. |
| Reference previews | Notebook inline references and thread-place references invoke `verseCard` (`notebook.ts:1225`, `2253`). Its desktop popover has a fixed maximum width of 560px (`verses.ts:145`). **Promotion already exists:** icon-only “Keep it as a pane” calls `openCardPane`, preserving the selected lookup tab (`verses.ts:194`). The pane still limits visible verses to 12. The separate `panes.ts:146` reference card offers “Open as a tab” only outside compact mode; hover previews have no actions. These are distinct surfaces. |
| PDF stepping | Existing document previews support Previous/Next, Left/Right, Home/End and One at a time/Show all (`pagedocs.ts:293–349`). Slide index is local to the preview fill; rebuilding resets it. Left/Right stop propagation to avoid turning the Bible chapter. Focus mode should preserve this viewer, not recreate it. This applies to the existing generated-document preview; saved PDF/packet commands remain deferred (`actions.ts:225`). |
| Shortcuts | Saved-command keys reject duplicates only among saved commands (`mycommands.rs:35`); `ui/src/main.ts:1056` and Notebook register other keys separately. Layouts have no assignment control. A collision check limited to layout names would miss existing shortcuts. |

## Proposed shared contract

Use a pane descriptor with a stable resource identity, separate from its transient DOM id and displayed title. Each supported kind supplies an opener that resolves to a ready pane plus capture/restore of its own view state. Do not serialize DOM nodes, editor drafts, source text or temporary focus mode. Normalize legacy aliases centrally, including `doc:<id>`, `doc|<id>|…`, and thread names resolved to stable page ids. Report unsupported and missing resources explicitly instead of claiming complete restoration.

Keep three responsibilities separate:

- **Named layout:** a versioned arrangement and view-state snapshot in the existing `sessions/layouts` wrapper. Store groups with ordered pane identities and selected tabs; side, float bounds, split share and minimized state; column/band dimensions; active pane; per-pane scroll/selection descriptors. Preserve the primary reader's current place by default when applying a layout.
- **Live pane state:** existing pane instances retain scroll, editor selection and PDF slide position during moves. Page editors require instance-local state, coordinated with H03/H06; one canonical live page pane per page is the proposed default to avoid independent editors silently competing.
- **Temporary focus:** an in-memory presentation of one existing pane. Leave its underlying group and geometry intact. Save Layout captures the underlying arrangement. Focus entry/exit does not write layout or study data.

Loading validates and resolves the snapshot before closing unrelated panes. Keep current Settings-open behavior. Reuse matching live panes; wait for newly opened content before applying scroll and selected tabs. Present a list of missing/unsupported items and allow cancellation before replacing the current arrangement. Clamp offscreen geometry to the current viewport while retaining the saved desktop arrangement across temporary phone presentation.

Legacy unversioned Rust layouts migrate in memory: honor available side/rectangle/front fields; use deterministic defaults for absent grouping and sizes, without claiming exact recovery. Do not rewrite them merely by opening. Python layouts remain explicitly unsupported unless separately authorized; invalid or future versions leave the current arrangement intact.

## Three separately reviewable slices

### 1. Layout restoration and shortcuts

Build the descriptor/reopen inventory, versioned serializer and restore path first. Keep `layout save/load/list/rm` and existing storage; add CLI-visible shortcut assignment with the same validation as the UI. Use one normalized shortcut registry covering built-ins, capture, saved commands and layouts. Refuse collisions with an explanation naming the owner; no silent reassignment. Do not choose a new default key in this review.

Acceptance: legacy and new layouts; two split groups on one side; top/bottom bands; multiple floats; tab ordering/selection; minimized state; changed viewport; missing/unsupported panes; document and verse-card reopening; content-ready scroll restoration; rapid repeated loads. Verify reserved and customized-key conflicts, exact modifier matching and typing behavior. Add parser/golden cases for any new CLI action.

### 2. Shelf page tabs, pointer drops and phone actions

Retain Notebook as the browsing pane. Add explicit **Open in a tab** for an ordinary or thread page and have Open All open each distinct page in a dedicated pane. Navigation within a page tab should preserve that tab's identity; cross-page links need the reviewed navigation rule below. No file-format changes to page or thread content.

Recommended folder ownership: track only panes newly created by a folder operation; already-open panes remain open when that folder closes. For panes newly shared by multiple folder operations, retain them until the final owning folder closes. Show already-open versus newly-opened counts. This intentionally changes the current single-mark behavior and requires review.

Bridge Dock pointer dragging to a Shelf folder target with visible **Keep in [folder]** feedback. Dropping adds a pointer, leaving the tab in place. Cancellation must perform no write. Keep Add → A tab as the keyboard alternative. Add a visible item More button on phones for Move/Also keep/Remove. Recommended: retain R2's hidden Open All on compact screens until a phone tab-switching interaction is accepted; individual item opening and Back must preserve the underlying desktop arrangement.

Acceptance: two regular pages, two thread pages, mixed nested folders, repeated Open All, one resource in two folders, preexisting panes, save failure on close, real pointer drag from Dock to Shelf, canceled drag, and keyboard/touch equivalents. Coordinate page refresh/deletion with H03/H04 and editor-state extraction with H06 before implementation.

### 3. Focus, fullscreen and preview promotion

Add visible **Focus pane** / **Return to layout** controls for docked and floating panes, including pages, Strong's and document previews. Focus fills the app content area. Offer a separate explicit **Enter fullscreen** action for hiding operating-system/window chrome; never imply the two modes are identical.

Recommended exits: Escape first dismisses an open child menu/dialog, then exits focus; changing layouts or deliberately activating another pane exits focus before proceeding. Return restores prior placement, size, active tabs and keyboard focus while keeping reading progress made inside focus (including the current PDF slide). Closing the focused pane exits focus through normal close behavior. Unsupported or rejected OS fullscreen leaves app-content focus usable. On compact screens, reuse the existing full-screen pane presentation and Back behavior.

Replace the reference-card promotion icon's discoverability problem with a visible **Keep as pane** action, available by keyboard and touch, retaining the reference, version, lookup tab and source-page return target. It then uses normal Move/Float/Resize/Focus controls. Preserve an explicit larger-reader action for passages exceeding the card's 12-verse limit. Hover remains transient; clicking its source opens the actionable card. Coordinate labels with H08/H09; do not redesign lookup content here.

Acceptance: enter/exit from docked, floating and minimized groups; Escape hierarchy; switch layout; resize while focused; OS fullscreen denial/exit; PDF controls without chapter changes; page editor selection; Strong's scroll; promotion from inline, title and thread-place references; return to the originating page without moving the main reader.

## Decisions needed before coding

1. Should layouts restore saved pane scroll/tab/view state while preserving the main reader's current location, or should named layouts also restore the main reader location?
2. Accept dedicated page tabs with one live pane per page, the proposed folder ownership rules, and hiding phone Open All pending a phone tab-switching design? For links inside page tabs, the recommendation is to open/focus the linked page's own tab and provide Back to the source.
3. Accept temporary app-content focus plus a separate OS-fullscreen action, with the proposed exit and return rules? The focused pane keeps reading progress made during focus; the surrounding layout returns unchanged.

**Aligns with your request:** groups R2/R4/f54e/dfce around pane identity and restoration, preserves reader position and file compatibility, and stops at design review. **Conflicts with your request:** none identified; proposed ownership and page-tab behavior are explicitly unapproved. **Not prompted by you, but relevant:** a missing reopen adapter can make an apparently saved pane vanish on load; resolving descriptor coverage and close/save failures is necessary before testing geometric restoration.

## Check record and boundary

- `git rev-parse --short HEAD` → `3078ede`; `git status --short` → existing modified/untracked work confirmed. No clean-checkout claim.
- Read shared rules, current queue, new findings, `CLAUDE.md`, R2/R4 design records, source paths above and existing desktop-check assertions. Repository search found no additional `AGENTS.md`/`AGENTS.override.md`; the supplied instructions apply.
- Source checks above completed. Some initial filename-glob searches did not resolve on Windows; direct paths and `rg -g` searches supplied the cited evidence.
- **Runtime checks executed: none. Tests executed: none.** This is a design gate. Historical `420/420` is not validation of these proposed changes. Later checks require a clean/isolate checkout, scratch study data and a dedicated test port.
- **File changed by H05:** `docs/current/handoffs/05-dock-review.md` only. Implementation, installation and study-folder edits remain outside this deliverable.
