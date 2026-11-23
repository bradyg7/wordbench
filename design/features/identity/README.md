# The app's identity: a clean, professional look of its own

**State:** exploring, round 2 (2026-11-22) · **Demo:** open `demo/index.html` in a browser (built by `node design/features/identity/demo/data.mjs` then `build.mjs`; round 2's frames by `demo/frames2.mjs`) · **Sheets:** `node design/features/identity/frames.mjs` writes `rows/<id>.png`
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
- **Legend is an app; marks are everywhere** (the person, 2026-11-22). The dock holds Legend (what each mark means) as
  its own app; marks are not an app, they are made anywhere in the app (the Bible, a page, a scripture block).
- **Twenty palettes, not three** (the person, 2026-11-22): Settings › Look offers about twenty to choose from.
- **Every interaction row has its frame** (the person, 2026-11-22): a review page with placeholders is not handed over.
- **Twelve base themes, Sage the default** (the person, 2026-11-22, from the twenty of round 1): Sage, Plum, Clay rose,
  Heather, Harbor, Lapis, Juniper, Terracotta, Slate, Graphite, Cedar, Linen. Vellum, Ink, Olive press, Parchment, Moss,
  Saffron, Glacier and Sandstone are not kept. A palette is now called a **theme** in the window.
- **Desks, with Snap inside** (the person, 2026-11-22, rows 13 and 15). Several apps share the screen on a desk;
  dragging an app to the top edge offers Snap's layouts within the desk. Stage (row 14) is not built.
- **Next, in conversation (the person, 2026-11-22):** (1) windows on a desk that flow like bubbles, draggable and fluid,
  stacking and sitting side by side neatly, still structured, with a liquid-glass feel, "a mashup of rows 13 and 15 but
  more so"; (2) several of the same app at once (passages, words, pages, folders) for a pastor's, teacher's or deep
  student's rabbit holes; (3) the trail becomes the app's history you can turn back in time, for one window and for a
  whole desk. Each gets an in-depth interaction table, frames for every row, and a working demo to feel it, not only
  pictures.
- **Round 3 answers (the person, 2026-11-22), after trying the round 2 demo:**
  - The fanned cards are clunky; dragging is only somewhat fluid; a bubble must go **above or below** another, not only
    behind; the liquid glass was lost; the dock is not fluid; the interactions are too basic.
  - **Quality first:** "committed to premium quality design: smooth transitions, not breaking cards, clean and
    user-friendly UI." Goals decide the rules, the rules decide the style (see Goals and the rules, below).
  - **Desk limit:** by screen size, never more than 4 columns × 3 high (R2).
  - **When full:** the oldest bubble goes to the tray (R3), not into a pile.
  - **Glass:** controls are liquid glass, reading and writing sit on paper (R7).
  - **Decisions are written down as they are made**, in this folder, and committed each time.
- **Panes are open to replacement.** The one need: several things working together and on screen at once. If a better
  idea than panes wins, panes are scrapped. Opening an app from the dock (full screen and snap, panes, attachments,
  or something else) is sketched together in round 1, not decided now.

## Goals and the rules that keep them (the person, 2026-11-22, round 3)

The person, after trying the round 2 demo: the fanned cards are clunky, the dragging is only somewhat fluid, a bubble
must go *above or below* another and not only behind, the liquid glass was lost, the dock is not fluid, and the
interactions are basic. "Whatever we choose, we have to be committed to premium quality design: smooth transitions, not
breaking cards, clean and user-friendly UI. If we knew what goals we were trying to accomplish, we'd be able to choose
what UI style would be best." So the goals come first, the rules follow from them, and the style follows from both.
**Every future feature is checked against these rules before it is designed; a design that breaks one is redrawn, not
excused.**

### The goals

| # | Goal | Whose words |
|---|---|---|
| G1 | **Study deeply without losing your way.** Many passages, words, pages and folders open at once, for a pastor's, teacher's or student's rabbit holes, and always knowing what led where. | the person, rows 29–36 |
| G2 | **Never lose anything.** Every step can be turned back, for one bubble, a desk or the whole app; going back keeps the later path as a branch. | the person, history answers |
| G3 | **The text comes first.** Scripture and the person's writing are calm and readable; everything else recedes until it is wanted. | the identity decisions |
| G4 | **Premium in the hand.** Smooth, physical, never broken; it should feel as good as the best software on the machine. | the person, round 3 |
| G5 | **Light everywhere.** The same app on a phone and a desktop, quick on a modest laptop. | the person, history answers |

### The rules (every feature keeps all of them)

| # | Rule | Serves | How it is checked |
|---|---|---|---|
| R1 | **Nothing hides.** A desk is columns; a column holds bubbles above and below. No bubble ever overlaps or sits behind another. | G1, G3 | After any action, no two bubbles' rectangles intersect (a test runs this after every row's script). |
| R2 | **The desk has a limit, set by the screen.** A bubble has a smallest readable size (360 × 220 px); a desk shows as many as fit, never more than 4 columns × 3 high. | G3, G5 | Opening one more never shrinks a bubble below its smallest size. |
| R3 | **Full means the tray, not a pile.** When one more will not fit, the bubble used longest ago shrinks into a pill in the tray beside the dock; one click brings it back (and the next-oldest takes its place in the tray). Nothing is closed. | G1, G2 | The count of bubbles plus pills never drops when opening. |
| R4 | **What you see while dragging is what you get.** As a bubble is dragged, the others make room live, and an outline shows exactly where it will land; letting go only completes what was shown. | G4 | The landed rectangle equals the last outline drawn. |
| R5 | **One motion for everything.** Every change of place or size moves on one spring (stiffness 420, damping 34: settles in about 0.3 s with no wobble you notice); nothing jumps, nothing fades in from nowhere. Only the dragged bubble follows the pointer directly. | G4 | No frame changes a bubble's rectangle by more than its spring allows. |
| R6 | **One gesture, one meaning, everywhere.** Drag a title to move. Drop on a bubble's left or right side for a column beside it, its top or bottom for above or below it, its middle to swap. Drag a gap between bubbles to resize both. Drag to the window's top edge for a layout. Nowhere does the same gesture mean something else. | G4 | The drop zones are the same for every app's bubble. |
| R7 | **Controls are glass, reading is paper.** The dock, the desks line, menus, the history bar and each bubble's title bar are liquid glass (light bends through them, a highlight follows the pointer). The text you read and write sits on solid paper and is never behind glass. | G3, G4 | Text contrast on paper meets WCAG AA in every theme. |
| R8 | **Never broken.** Titles end with an ellipsis, never mid-glyph; a bubble never renders smaller than its smallest size; a resize stops at the neighbour's smallest size; the layout is valid after every action, undo and history jump. | G4 | The layout check runs after every action in the tests. |
| R9 | **Everything can be turned back.** Every action is one step in history (G2), including layouts, resizes, moves to the tray and desk switches. | G2 | Each row's action adds exactly one step. |
| R10 | **Every action has a key and a `wb` command.** The pointer is never the only way. | G1, AGENTS.md | Each table row names both. |

### The style that follows

A **tiling desk with springs** (columns that split into above and below, the way the best tiling window managers and
iPad's Split View keep things orderly), **under liquid-glass controls** (R7), with **a tray for overflow** (R3) instead
of piles. Free canvas, always-tiled without rows, Stage and the fanned cards of round 2 are retired by R1, R3 and R4.

## Round 2: desks that flow, many of one app, the trail as history (2026-11-22)

The person's answers this round, kept as asked: **show every option in a demo before deciding.**

- **Bubbles:** magnetic, always tiled and free canvas are all built in the demo (Options ▸ Bubbles on a desk), to try
  before choosing; a merge of them is welcome.
- **Stacks:** fanned cards on the desktop (the person's lean); the phone's form is drawn (row 28) to compare.
- **Several of one app:** each its own bubble, one app with many inside, and both are in the demo (rows 29–32).
- **Following a word:** all three are in the demo: a new bubble linked by a thread, replace in place, ask each time.
- **History can turn back** one bubble, a whole desk, the whole app, and the writing too (the person chose all four).
  Both views, the scrubber and the branching map, are in the demo. **Going back never loses the later steps: they are
  kept as a branch.**
- **The demo is a page in the browser**, with real verses and lexicon entries from the database (`wb chapter`,
  `wb strong`; 5 chapters, 500 entries), so it can change quickly between rounds.

### Is it light enough, even on a phone? (the person asked)

Yes, if history keeps **steps, not pictures**:

- **A step** is one small record, about 200 bytes: when, which desk, which bubble, what it now shows (an app and a
  reference such as `John 1:8` or `G3056`), and where it sits. A busy day of study is a few thousand steps, under
  1 MB. Going back replays the steps; nothing is re-read from the database until a bubble is drawn.
- **A desk at a moment** is rebuilt from its steps; to keep that fast, a checkpoint (the desk's bubbles, a few KB) is
  kept every 100 steps, so going back never replays more than 100.
- **Writing** keeps versions as the words that changed (a diff), one version per pause in typing (30 seconds), not a
  copy per keystroke. A page edited all year is a few hundred KB of versions.
- **On a phone** the device keeps the last 14 days of steps; older steps fold into one checkpoint per day (still
  turn-backable by day). Page versions are kept whole on every device, since they are the person's work.
- **Nothing runs in the background**: a step is written when it happens (one append to the day's file); the map and
  the scrubber read only the scope shown.

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

### Twenty palettes (round 1; twelve kept, see Decisions; frames 1 and 2 now show the twelve)
Each palette is paper, ink and one accent, in light and dark: Vellum, Ink, Olive press, Parchment, Slate, Sage, Plum,
Harbor, Terracotta, Graphite, Moss, Clay rose, Lapis, Saffron, Cedar, Glacier, Heather, Juniper, Sandstone, Linen. The
person chooses one; marks and folder colors are the person's own in all of them. The faces (interface and scripture)
are chosen apart from the palette (row 4), so any palette goes with any face. 

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
**Sage, the person's default,** with **Together C (Desks), Snap's layouts inside each desk**. Vellum is the cleanest and most
distinct; desks keep several things on screen at once without tabs, and each remembers itself. The dock holds the
apps; the desks are named on the top line. The scripture face is the person's eye: row 4 sets four side by side.

## Open questions

- Which scripture face (row 4).
- How apps share the screen: Snap, Stage, Desks, or Desks with Snap inside (rows 13–15). This replaces
  [notebook-shell](../notebook-shell/README.md) direction C.

## Rounds

| Round | Date | What | Review |
|---|---|---|---|
| 0 | 2026-11-22 | Questions: base look, what stays, order, references | Answers above |
| 1 | 2026-11-22 | Three identities (light and dark), four scripture faces, the dock hidden and shown, the static taskbar, the home screen, three ways to share the screen | Twelve themes, Sage default; Desks with Snap inside |
| 2 | 2026-11-22 | A working demo: bubbles (magnetic, tiled, free), stacks, several of one app (three ways), following a word (three ways), history by bubble, desk and app (scrubber and map, branches kept), phone; 34 frames taken from it | pending |

## The codebase (the person asked, 2026-11-22: does this need a new one?)

No. The redesign changes the window, not what the app knows or does. About 34,000 lines are the Rust core
(`crates/wb-core`, `crates/wb-cli`): the Bible database, the study files, every `wb` command and their tests; the
dock, desks and palettes do not touch them. What changes is `ui/` (about 24,000 lines of TypeScript, 2,400 of CSS):
**a new shell is built beside the old one in `ui/src/shell/`** (tokens, dock, desks, the Workbench home), switched on
by a setting while it grows; each app moves into it one at a time (the Notebook shell first), and the old rail, panes
and tabs are deleted as each app leaves them. The 10,000 lines of window tests keep proving each app as it moves.
A new codebase would throw away the tested core and the `wb` contracts for no gain.

## Interaction table

Objects and words from [the Library map](../../LIBRARY.md). New words this round proposes (the map changes only with
the person's go-ahead): **dock**, **app** (Bible, Notebook, Search, Words, Legend, Reading plans), **Workbench** (the
home screen), **desk** (if Together C wins), **theme**.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | Settings › Look | Choose one of twelve themes (Sage by default) | The whole app takes its paper, ink and accent at once | `settings/look.json` `theme` | *proposed:* `wb settings look --theme sage` | `identity_applies_everywhere` | [ ] |
| 2 | Settings › Look | Light, Dark, or As the system | The palette's light or dark form | `settings/look.json` `mode` | *proposed:* `wb settings look --mode dark` | `identity_dark_mode` | [ ] |
| 3 | Settings › Look | Page surface: Paper, Sepia, Night, or custom | Only the page-like surface (reader and pages) changes; the chrome keeps the identity | `settings/look.json` `page_surface` | *proposed:* `wb settings look --page sepia` | `page_surface_only` | [ ] |
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

### Round 2: bubbles on a desk (frames from the demo)

A **bubble** is one opened thing on a desk (a passage, a word, a page, a folder, the Legend): glass over the desk, a
3 px tint of its app along the top, ← → for its own history, ◷ for its history, ✕ to close. Proposed words: **bubble**,
**stack**, **thread** is not used (it is retired); the line between a bubble and the one it came from is a **link line**.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 17 | A bubble's title | Press and drag | It lifts (1.5% larger, deeper shadow) and follows the pointer without lag; the others stay | Nothing until let go | — | `bubble_lifts_on_drag` | [ ] |
| 18 | Dragging, magnetic | Near another bubble's edge (60 px) | A soft outline shows where it will sit: beside it (left or right, same top and height) or under it (same left and width), 12 px apart; let go and it springs there (0.28 s, a slight overshoot) | `settings/desks.json` the bubble's place; a step | *proposed:* `wb desk place BUBBLE --beside OTHER` | `magnetic_pulls_beside` | [ ] |
| 19 | Dragging, any mode | Over the middle of another bubble (its title, in free canvas) | The outline wraps that bubble; let go and they stack, the dragged one in front | A step; the stack in `desks.json` | *proposed:* `wb desk stack BUBBLE OTHER` | `drop_on_bubble_stacks` | [ ] |
| 20 | Options ▸ Always tiled | Open or drop anything | The desk reflows into columns, never overlapping; a stack is one column | `desks.json` | — | `tiled_never_overlaps` | [ ] |
| 21 | Options ▸ Free canvas | Drop anywhere | It stays exactly there, overlapping if dropped so; no magnet | `desks.json` | — | `free_canvas_stays` | [ ] |
| 22 | Dragging | To the top edge (30 px) | The layouts appear under the desks line: halves, two-thirds, thirds, quarters; the cell under the pointer lights | Nothing | — | `top_edge_shows_layouts` | [ ] |
| 23 | Layouts | Let go on a cell | The bubble takes that cell; the desk's other bubbles fill the other cells left to right; any beyond the cells stack on the last one | `desks.json`; a step | *proposed:* `wb desk layout thirds` | `layout_fills_cells` | [ ] |
| 24 | Dragging | Onto another desk's name | The name is outlined; let go and the bubble moves to that desk (with its own history) | `desks.json`; a step on both desks | *proposed:* `wb desk move BUBBLE --to DESK` | `drag_to_desk_moves` | [ ] |

### Stacks

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 25 | A stack | At rest | Fanned cards: each one behind shows 10 px up and right, a little fainter; the front's title says "3 stacked" | Nothing | — | `stack_fans` | [ ] |
| 26 | A stack | Click a card behind | It comes to the front | A step | — | `stack_brings_forward` | [ ] |
| 27 | Front of a stack | ⤫ | It leaves the stack and finds room beside (or the desk reflows when there is none) | A step | *proposed:* `wb desk unstack BUBBLE` | `unstack_finds_room` | [ ] |
| 28 | Phone | A stack | One card with dots under it, one dot a card; swipe sideways through the desk | Nothing | — | `phone_stack_dots` | [ ] |

### Several of one app

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 29 | Options ▸ Each its own bubble | Open three passages | Three Bible bubbles, tinted alike, each with its own ← → and history | A step each | *proposed:* `wb desk open bible "Romans 5"` | `each_its_own_bubble` | [ ] |
| 30 | Options ▸ One app, many inside | Open a second passage | It becomes a column inside the Bible bubble already open, which widens; each column has its heading | A step | — | `many_inside_columns` | [ ] |
| 31 | Options ▸ Both | ⇲ on a bubble | The app's other bubbles on the desk gather into it as columns | A step | *proposed:* `wb desk gather BUBBLE` | `gather_into_columns` | [ ] |
| 32 | A column | ⇱ pop out | The column leaves and becomes its own bubble beside, linked | A step | — | `pop_out_column` | [ ] |

### Following a word (the rabbit hole)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 33 | A passage | Click a word (Options ▸ New bubble, linked) | The word's entry opens beside, with a dashed link line from the passage; the desk makes room if needed | A step | `wb strong G3056` | `word_opens_beside_linked` | [ ] |
| 34 | A passage | Click a word (Options ▸ Replace), or Alt+click in any mode | The same bubble becomes the word; ← returns to the passage at the same place | A step on the bubble | — | `word_replaces_in_place` | [ ] |
| 35 | A passage | Click a word (Options ▸ Ask) | A small menu at the pointer: Here, Beside, On a new desk | A step after the choice | — | `word_asks_where` | [ ] |
| 36 | A word's entry | Click a verse that uses it | That passage opens lit at the verse (the verse shaded briefly); the link lines trace passage → word → passage | A step | `wb uses G3056` | `rabbit_hole_chain` | [ ] |

### History (the trail, turned back in time)

The **trail** becomes the app's history (the Library map's "trail = back and forward" grows to this; the map changes
with the person's go-ahead). Three scopes: **this bubble**, **this desk**, **the whole app**.

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 37 | ◷ History (bottom right) | Open | A glass bar over the desk: the scope (This bubble, This desk, The whole app), Scrubber or Map, and a line from Earlier to Now with the step's words and time | Nothing | `wb history list --desk DESK` | `history_bar_opens` | [ ] |
| 38 | Scrubber | Drag back | The desk replays live to that moment (bubbles move, open, close), tinted faintly to say it is the past | Nothing | — | `scrub_replays_desk` | [ ] |
| 39 | Scrubber | Let go, then do anything | The desk stays there; what you do starts a new branch; the later steps are kept | A step whose parent is the moment chosen | `wb history at STEP` | `acting_in_past_branches` | [ ] |
| 40 | Map | Open | Each step a dot on a line; a second lane where a branch began; the current step filled; hover names a step; click goes there | Nothing | `wb history tree --desk DESK` | `history_map_branches` | [ ] |
| 41 | A bubble's ◷ | Open | The same bar, scope This bubble: only what that bubble showed (passages, words, pages) | Nothing | `wb history list --bubble BUBBLE` | `bubble_history_scope` | [ ] |
| 42 | History | The whole app | Every desk's steps on one line, switching desks among them | Nothing | `wb history list` | `app_history_scope` | [ ] |
| 43 | Scrubber | Back past an edit | The page shows its words as they were then; letting go and typing keeps the later words as a version (nothing lost) | A page version on the next edit | *proposed:* `wb page versions ID`, `wb page at ID VERSION` | `writing_returns_with_time` | [ ] |
| 44 | Desk (not in a page) | Ctrl+Z / Ctrl+Shift+Z | The desk steps back or forward one step; inside a page the keys undo typing as before | A step | — | `ctrl_z_steps_desk` | [ ] |

### Desks, the phone, home and the dock in the demo

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 45 | Phone | Open the app | Each bubble a full card; desks along the top; swipe between cards; the dock always shown | Nothing | — | `phone_cards` | [ ] |
| 46 | Phone | Follow a word | It opens as the next card, beside the passage card | A step | — | `phone_word_next_card` | [ ] |
| 47 | Desks line | + New desk | An empty desk, named "Desk 4" until renamed (double-click the name) | `desks.json` | *proposed:* `wb desk new NAME` | `new_desk` | [ ] |
| 48 | Desks line | Click a desk | The screen becomes that desk, its bubbles where they were | A step | *proposed:* `wb desk open DESK` | `switch_desk` | [ ] |
| 49 | Dock | Workbench | Home over the desk: where you left off (the desk and its bubbles), today's reading, an open question, every desk with its count | Nothing | — | `home_over_desk` | [ ] |
| 50 | Desk | Pointer to the bottom edge | The dock rises after 120 ms; a dot under each app open on this desk; it sinks 0.4 s after the pointer leaves | Nothing | — | `dock_rises` | [ ] |

### On disk (proposed, for the person's go-ahead before any build)

- `settings/desks.json`: the desks, their names, and each bubble's app, reference, place, size and stack.
- `history/<YYYY-MM-DD>.jsonl`: one line a step (`{t, desk, bubble, parent, what, ref, place}`), appended as it happens;
  a checkpoint line every 100 steps.
- `history/pages/<page id>/`: a page's versions as diffs, one a pause in typing.
- The study folder's other files do not change. Today's `history/` (the trail) is read as the first steps.

## What the build must satisfy

Written once the person chooses an identity and a way to share the screen.
