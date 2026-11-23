# The app's identity: a clean, professional look of its own

**State:** exploring, round 1 (2026-11-22) · **Sheets:** `node design/features/identity/frames.mjs` writes `rows/<id>.png`
and `rows/index.json` from `frames.html` (scripture is filled in from `data/`, made by `wb text`) · Nothing built. ·
**Review page:** `node design/review.mjs identity`.

The person, 2026-11-22, after the [notebook-shell](../notebook-shell/README.md) frames: they look like Notion, not
like the app. If that shell is the way forward, the whole app needs a clean, professional feel, **while keeping the
design unique**. This folder is the design-system round that comes first (order decided below); the Notebook shell
is built in its tokens, then the rest of the app is reskinned pane by pane.

## Decisions (the person, 2026-11-22)

- **A new identity.** Not the warm cream-and-brown of today cleaned up, and not Notion's neutral grey: a fresh
  palette and type pairing, designed first, then applied everywhere.
- **Literata is open.** The scripture serif may be replaced by a better contender; round 1 compares candidates.
- **The page-like surface stays**, with its colors customizable through themes.
- **The annotation palette (marks and folder colors) stays**, because it is the person's own and fully customizable.
- **The rail is replaced by a dock** (the person's sketch): like the Mac's Dock, it appears on hover and shows the
  app's "apps" (Reader, Notebook, Search, …); the **Workbench is the home screen**. For Windows users a **static
  taskbar** can be switched on instead of the hover dock. To be designed with the person, clean and user-friendly
  first.
- **Order: design system first.** Tokens (color, type, spacing, menus, icons), then the Notebook shell in them, then
  every other pane.
- **References are not limited to Notion or note apps.** The design agent is the most capable model, always, and
  researches other apps' designs (any kind, especially for the non-note features) to make the result both
  innovative and fitting.

- **The dock (round 0 answers).** The edge is the person's choice in Settings; **bottom, centred** is the default, and the
  static taskbar follows the same edge. Inspiration is the Mac's Dock (the person's sketch is hand-drawn and not to be
  used). The **home screen is "where you left off"**: the reading place, recent pages, open questions, today's
  reading plan, each one click to resume.
- **Panes are open to replacement.** The one need: several things working together and on screen at once. If a better
  idea than panes wins, panes are scrapped. Opening an app from the dock (full screen and snap, panes, attachments,
  or something else) is sketched together in round 1, not decided now.

## What round 1 learned from (described, never copied)

| App | What it does well | Taken for |
|---|---|---|
| macOS Dock | Hidden until the pointer reaches the edge; icons grow under the pointer; a dot under open apps; a divider before system items | The dock (rows 5–8) |
| Windows 11 taskbar and Snap layouts | A bar always shown, icons centred; dragging a window to the top edge offers layouts | The static taskbar (row 9), Together A (row 13) |
| macOS Stage Manager | The working set in the middle, other sets as small cards at the side, one click swaps | Together B (row 14) |
| Arc spaces, Linear workspaces | A named place per task that keeps its own arrangement | Together C, Desks (row 15) |
| iPadOS and Things home | Calm tiles that resume work in one tap | The home screen (row 11) |
| Linear, Raycast | Quiet chrome, one accent, airy type, keyboard first | The tokens (rows 1–3) |
| Readwise Reader, Apple Books | A reading surface with themes (paper, sepia, night) and a choice of face | Themes and the scripture face (rows 3–4) |
| Logos, Accordance | What Bible tools get wrong: crowded toolbars, many panes always open | What to avoid |

## Directions

### Identity A · Vellum
Warm-white paper (#FBFAF7), near-black ink, a deep teal accent (#1F6F6B). Inter for the interface, Source Serif 4 for
scripture. The calmest and most "professional tool"; teal is rare among Bible apps, so it reads as its own.

### Identity B · Ink
Cool paper (#F7F8FA), an indigo accent (#3346B8). IBM Plex Sans with Newsreader. A scholarly instrument: crisp, but the
coolest and least warm.

### Identity C · Olive press
Stone paper (#F7F5EF), an olive accent (#5D6B2E). Instrument Sans with Literata. Old-world and calm, the closest to
today's warmth without its brown.

### Together: how several apps share the screen
- **A · Snap.** Each app fills the window; drag its title to the top edge for layouts (halves, two-thirds, thirds,
  quarters), like Windows snap. Familiar to Windows users; arrangements are not kept by name.
- **B · Stage.** The working set sits in the middle; other sets wait as small cards at the left; one click swaps. Keeps
  work apart without tabs; uses a strip of the screen.
- **C · Desks.** A named, saved arrangement per task (Sunday lesson, Word study: zeal); switching swaps the whole
  screen; nothing stays open unseen. Answers "getting lost" and "wasting memory" in the tab findings (f_…175000,
  f_…180004); Snap's layouts work inside a desk.

### Recommendation
**Identity A (Vellum)** with **Together C (Desks), Snap's layouts inside each desk**. Vellum is the cleanest and most
distinct; desks keep several things on screen at once without tabs, and each remembers itself. The dock holds the
apps; the desks are named on the top line. The scripture face is the person's eye: row 4 sets four side by side.

## Open questions

- Which identity: A, B, C, or a mix (one's palette with another's faces).
- Which scripture face (row 4).
- How apps share the screen: Snap, Stage, Desks, or Desks with Snap inside (rows 13–15). This replaces
  [notebook-shell](../notebook-shell/README.md) direction C.
- The dock's apps: is Marks an app of its own, or part of the Bible (row 6)?

## Rounds

| Round | Date | What | Review |
|---|---|---|---|
| 0 | 2026-11-22 | Questions: base look, what stays, order, references | Answers above |
| 1 | 2026-11-22 | Three identities (light and dark), four scripture faces, the dock hidden and shown, the static taskbar, the home screen, three ways to share the screen | pending |

## Interaction table

Objects and words from [the Library map](../../LIBRARY.md). New words this round proposes (the map changes only with
the person's go-ahead): **dock**, **app** (Bible, Notebook, Search, Words, Marks, Reading plans), **Workbench** (the
home screen), **desk** (if Together C wins), **theme**.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Settings › Look | Choose an identity | The whole app takes its palette and faces at once | `settings/look.json` `identity` | *proposed:* `wb settings look --identity vellum` | `identity_applies_everywhere` | [ ] |
| 2 | Settings › Look | Light, Dark, or As the system | The identity's light or dark form | `settings/look.json` `mode` | *proposed:* `wb settings look --mode dark` | `identity_dark_mode` | [ ] |
| 3 | Settings › Look | Page theme: Paper, Sepia, Night, or custom | Only the page-like surface (reader and pages) changes; the chrome keeps the identity | `settings/look.json` `page_theme` | *proposed:* `wb settings look --page sepia` | `page_theme_only_the_surface` | [ ] |
| 4 | Settings › Look | Scripture face | Every verse in that face; the interface face is unchanged | `settings/look.json` `scripture_face` | *proposed:* `wb settings look --scripture source-serif` | `scripture_face_applies` | [ ] |
| 5 | Anywhere | Pointer to the dock's edge | After 120 ms the dock rises; nothing covers the text before | Nothing | — | `dock_appears_on_edge` | [ ] |
| 6 | Dock | Hover an app | It grows gently; its name shows above; a dot marks an app that is open | Nothing | — | `dock_hover_names_app` | [ ] |
| 7 | Dock | Click an app | It opens, or comes forward, on the current desk; the dock sinks when the pointer leaves | The desk's arrangement | *proposed:* `wb desk open notebook` | `dock_opens_app` | [ ] |
| 8 | Dock | Right-click an app | Its menu: New window, Recent (its last items), Keep in dock or Remove | `settings/dock.json` | — | `dock_app_menu` | [ ] |
| 9 | Settings › Dock | Always shown (taskbar) | The same apps in a bar always visible; the reader stops above it | `settings/dock.json` `mode` | *proposed:* `wb settings dock --always` | `taskbar_mode` | [ ] |
| 10 | Settings › Dock | Edge: bottom (default), left, right | The dock and the taskbar move to that edge | `settings/dock.json` `edge` | *proposed:* `wb settings dock --edge left` | `dock_edge` | [ ] |
| 11 | Dock | Workbench (home) | Where you left off, today's reading, open questions, recent pages; each resumes in one click | Nothing | `wb history list`; `wb question list` | `home_resumes` | [ ] |
| 12 | Home | Continue reading | The Bible at the verse left, on the desk it was on | Trail step | `wb history list` | `home_continue_reading` | [ ] |
| 13 | An app's title | Drag to the top edge | Layouts: halves, two-thirds, thirds, quarters; drop on one to place it | The desk's arrangement | — | `snap_layouts` | [ ] |
| 14 | Window | Stage (if B) | Other sets wait as cards at the left; a click swaps one in | Sets kept | — | `stage_swaps_sets` | [ ] |
| 15 | Top line | Desks (if C): click a desk | The whole screen becomes that desk's apps where they were; + New desk names a new one | `settings/desks.json` | *proposed:* `wb desk list`, `wb desk new NAME` | `desks_switch_whole_screen` | [ ] |
| 16 | Keys | Ctrl+1…9, Ctrl+Space | Ctrl+1…9 opens the dock's apps in order; Ctrl+Space shows the dock | Nothing | — | `dock_keys` | [ ] |

## What the build must satisfy

Written once the person chooses an identity and a way to share the screen.
