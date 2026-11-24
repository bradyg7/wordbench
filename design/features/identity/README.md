# The app's identity: a clean, professional look of its own

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: exploring, round 2 (2026-11-22) · **Demo:** open `demo/index.html` in a browser (built by `node design/features/identity/demo/data.mjs` then `build.mjs`; round 2's frames by `demo/frames2.mjs`) · **Sheets:** `node design/features/identity/frames.mjs` writes `rows/<id>.png`
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
  - **Full view, asked (the person, 2026-11-22):** "what does it look like to make one page full screen and then quickly
    minimize it." Drawn in the demo as rows 55–57; whether it may cover the desk (an exception to R1) is the person's to decide.
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
| R11 | **One thing, one bubble per desk.** Opening something already open on the desk brings that bubble forward and lights it, instead of a copy. | G1, G3 | A desk never holds two bubbles with the same app and reference. |
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

- **Full view and R1.** Full view covers the desk for a moment (rows 55–57). Keep it as the one named exception to
  "nothing hides" (the desk is only dimmed underneath and comes back untouched), or make full view a desk of its own?

- Which scripture face (row 4).
- How apps share the screen: Snap, Stage, Desks, or Desks with Snap inside (rows 13–15). This replaces
  [notebook-shell](../notebook-shell/README.md) direction C.

## Rounds

| Round | Date | What | Review |
|---|---|---|---|
| 0 | 2026-11-22 | Questions: base look, what stays, order, references | Answers above |
| 1 | 2026-11-22 | Three identities (light and dark), four scripture faces, the dock hidden and shown, the static taskbar, the home screen, three ways to share the screen | Twelve themes, Sage default; Desks with Snap inside |
| 2 | 2026-11-22 | A working demo: bubbles (magnetic, tiled, free), stacks, several of one app (three ways), following a word (three ways), history by bubble, desk and app (scrubber and map, branches kept), phone; 34 frames taken from it | The person: fanned cards clunky, not fluid enough, needs above/below, glass lost, dock not fluid; led to round 3 |
| 3 | 2026-11-22 | Goals G1–G5 and rules R1–R11; the demo rebuilt to them: columns with above and below, live make-room dragging, one spring, the tray, glass controls over paper, a lens dock; rows 17–54 rewritten with frames from the demo | pending |

## The codebase (the person asked, 2026-11-22: does this need a new one?)

No. The redesign changes the window, not what the app knows or does. About 34,000 lines are the Rust core
(`crates/wb-core`, `crates/wb-cli`): the Bible database, the study files, every `wb` command and their tests; the
dock, desks and palettes do not touch them. What changes is `ui/` (about 24,000 lines of TypeScript, 2,400 of CSS):
**a new shell is built beside the old one in `ui/src/shell/`** (tokens, dock, desks, the Workbench home), switched on
by a setting while it grows; each app moves into it one at a time (the Notebook shell first), and the old rail, panes
and tabs are deleted as each app leaves them. The 10,000 lines of window tests keep proving each app as it moves.
A new codebase would throw away the tested core and the `wb` contracts for no gain.

## Interaction table

Objects and words from [the glossary](../../../GLOSSARY.md). New words this round proposes (the map changes only with
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

### Round 3: the desk (rows 17–54, frames taken from the demo in Edge, the engine the Windows app uses)

Round 2's rows 17–50 are replaced: the fanned stacks, free canvas and always-tiled options are retired by R1, R3 and
R4. A **bubble** is one opened thing on a desk: paper for its content, a glass title bar floating over it (R7) with
← → (its own history), a dot in its app's color, its title, ↖ where it came from, ⋯ and ✕. Proposed words for the
Library map, with the person's go-ahead: **bubble**, **tray**, **pill** (a bubble in the tray).

#### Moving and sizing (R1, R4, R5, R6, R8)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 17 | A bubble's glass title | Press and drag | It lifts 2% with a deep shadow and eases to a handy size (at most 520 × 380) under the pointer, keeping the point grabbed; the others hold still | Nothing until let go | — | `drag_lifts_and_eases` | [ ] |
| 18 | Dragging | Over a bubble's left or right fifth | The others make room live on the spring; a green outline shows the new column and says "A column left of John 1" | Nothing until let go | — | `drop_side_makes_column` | [ ] |
| 19 | Dragging | Over a bubble's top or bottom third | That column splits live; the outline says "Above John 1" or "Below John 1" | Nothing until let go | — | `drop_top_bottom_splits` | [ ] |
| 20 | Dragging | Over a bubble's middle | The outline covers it and says "Swap with John 1" | Nothing until let go | — | `drop_middle_swaps` | [ ] |
| 21 | Dragging | Within 30 px of the desk's left or right edge | A new column at that edge, outlined | Nothing until let go | — | `drop_edge_new_column` | [ ] |
| 22 | Dragging | Let go | It lands exactly where the outline was, on the spring (about 0.3 s); one step in history | `settings/desks.json`; a step | *proposed:* `wb desk place BUBBLE --above OTHER` (`--below`, `--left`, `--right`, `--swap`) | `lands_where_shown` | [ ] |
| 23 | The gap between two bubbles | Drag it | Both resize live, the grip darkening; it stops at the smaller one's smallest size (360 × 220) | `desks.json`; a step | *proposed:* `wb desk size BUBBLE --width 0.4` | `gap_resizes_both` | [ ] |
| 24 | Dragging | To the window's top edge | Four layouts drop down in glass (halves, two-thirds, thirds, quarters); the one under the pointer lights | Nothing | — | `top_edge_layouts` | [ ] |
| 25 | Layouts | Let go on one | The dragged bubble takes the first place, the others fill the rest in order; any beyond go below in the last column; what will not fit goes to the tray | `desks.json`; a step | *proposed:* `wb desk layout thirds` | `layout_arranges` | [ ] |
| 26 | Dragging | Onto another desk's name | The name rings; let go and the bubble moves to that desk; "Moved to Word study: zeal" | `desks.json`; a step on both desks | *proposed:* `wb desk move BUBBLE --to DESK` | `drag_to_desk` | [ ] |
| 27 | Dragging | A place that would overfill the desk | The bubble used longest ago dims while dragging, and the outline says it goes to the tray | Nothing until let go | — | `overfill_preview` | [ ] |
| 28 | Keys | Ctrl+←↑→↓; Ctrl+Shift+←↑→↓ | Focus moves to the nearest bubble that way (it lights); with Shift the focused bubble trades places with it | A step (Shift) | — | `keys_focus_and_move` | [ ] |

#### The tray (R3)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 29 | Anywhere | Open one more than fits | The bubble used longest ago flies into a pill at the dock's end (its app's dot and title); the rest re-flow | `desks.json` tray; a step | — | `full_goes_to_tray` | [ ] |
| 30 | Dock | Click a pill | It grows out of the pill into a place beside the focused bubble; if that overfills, the next-oldest takes its pill | `desks.json`; a step | *proposed:* `wb desk tray --back BUBBLE` | `pill_comes_back` | [ ] |
| 31 | Bubble ⋯ | Put in the tray | It flies to its pill; the others fill the room | `desks.json`; a step | *proposed:* `wb desk tray BUBBLE` | `put_in_tray` | [ ] |

#### Several of one app

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 32 | Anywhere | Open three passages | Three Bible bubbles, each with its app's green dot and its own ← → | A step each | *proposed:* `wb desk open bible "Romans 5"` | `each_its_own_bubble` | [ ] |
| 33 | Bubble ⋯ | Gather the other Bible bubbles here | They fold into this one as columns side by side, each headed; the desk re-flows | A step | *proposed:* `wb desk gather BUBBLE` | `gather_columns` | [ ] |
| 34 | A gathered column | ⇱ pop out | It becomes its own bubble beside, linked ↖ | A step | — | `pop_out` | [ ] |

#### Following a word (G1)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 35 | A passage | Click a word (Options › Beside) | The entry grows out of the word itself into a new place beside the passage; its title carries ↖ John 1 | A step | `wb strong G3056` | `word_grows_beside` | [ ] |
| 36 | A bubble's title | Click ↖ John 1 | The bubble it came from rings and takes focus; from the tray, a note says to click its pill | Nothing | — | `from_lights_source` | [ ] |
| 37 | A passage | Alt+click a word, or Options › Replace | The same bubble becomes the entry; ← (or Alt+←) returns to the passage where it was | A step | — | `replace_and_back` | [ ] |
| 38 | A passage | Click a word (Options › Ask) | A glass menu at the pointer: Beside, Here, On a new desk | A step after the choice | — | `ask_where` | [ ] |
| 39 | Anywhere | Open something already open on this desk | That bubble rings and takes focus; a verse asked for is lit and scrolled to (R11) | A step | — | `no_duplicate_bubbles` | [ ] |

#### History (G2, R9)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 40 | ◷ History | Open | A glass bar rises: This bubble, This desk, The whole app; Scrubber or Map; Earlier ─ Now with the step's words and time | Nothing | `wb history list --desk DESK` | `history_bar` | [ ] |
| 41 | Scrubber | Drag back | The desk replays on the springs, every bubble moving to where it was, tinted warm to say it is the past | Nothing | — | `scrub_replays` | [ ] |
| 42 | Scrubber | Let go, then act | The desk stays at that moment; acting starts a branch; the later steps are kept | A step whose parent is the moment | `wb history at STEP` | `act_in_past_branches` | [ ] |
| 43 | Map | Open | Dots on a line, a new lane where a branch began, the current one filled; click a dot to go there | Nothing | `wb history tree --desk DESK` | `map_lanes` | [ ] |
| 44 | Bubble ⋯ | This bubble's history | The bar opens scoped to that bubble's own steps | Nothing | `wb history list --bubble BUBBLE` | `bubble_scope` | [ ] |
| 45 | Scrubber | Back past an edit | The page shows its words as they were; typing there keeps the later words as a version | A version on the next edit | *proposed:* `wb page versions ID` | `writing_returns` | [ ] |
| 46 | Desk (not typing) | Ctrl+Z, Ctrl+Y | One step back or forward on the current branch, replayed on the springs; in a page they undo typing as before | Nothing new (moves along the steps) | — | `ctrl_z_steps` | [ ] |

#### The dock, desks, home and the phone (R5, R7)

| # | Where | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 47 | Desk | Pointer to the bottom edge | After 110 ms the glass dock rises on the spring; it sinks 0.45 s after the pointer leaves | Nothing | — | `dock_rises` | [ ] |
| 48 | Dock | Move along it | The icons swell like a lens under the pointer (up to 1.6×), neighbours easing off smoothly; the name floats above in glass | Nothing | — | `dock_magnifies` | [ ] |
| 49 | Dock | Click an app | The icon bounces once; the bubble grows out of the icon into its place beside the focused bubble | A step | *proposed:* `wb desk open APP` | `dock_opens_from_icon` | [ ] |
| 50 | Desks line | Click a desk | The green pill slides to it on a spring; the desk's bubbles slide in from that side | A step | *proposed:* `wb desk open DESK` | `desk_switch_slides` | [ ] |
| 51 | Desks line | + ; double-click a name | A new empty desk; double-click renames | `desks.json`; a step | *proposed:* `wb desk new NAME` | `new_and_rename_desk` | [ ] |
| 52 | Dock | Workbench | Home: where you left off and the last steps, today's reading, an open question, every desk with its count | Nothing | — | `home` | [ ] |
| 53 | Phone | Open the app | Each bubble a full card, swipe between them; the dock always shown; the desks line at the top | Nothing | — | `phone_cards` | [ ] |
| 55 | A bubble's title | Double-click, ⤢, or Ctrl+Enter | It grows over the whole desk on the spring (about 0.3 s); the desk keeps its layout underneath, dimmed and softly blurred | Nothing (a view, not a step) | — | `full_view_grows` | [ ] |
| 56 | Full view | Double-click, ⤡, or Esc | It springs back to exactly the place and size it had; nothing else moved | Nothing | — | `full_view_returns` | [ ] |
| 57 | Full view | Switch desk, or open from the dock | Full view ends first, then the action happens | Nothing | — | `full_view_ends_on_switch` | [ ] |
| 54 | Any glass | Move the pointer over it | A soft highlight follows the pointer across the glass; what lies behind bends gently through it (Edge, Chrome; Safari shows frosted glass) | Nothing | — | `glass_highlight` | [ ] |

### On disk (proposed, for the person's go-ahead before any build)

- `settings/desks.json`: the desks, their names, and each bubble's app, reference, place, size and stack.
- `history/<YYYY-MM-DD>.jsonl`: one line a step (`{t, desk, bubble, parent, what, ref, place}`), appended as it happens;
  a checkpoint line every 100 steps.
- `history/pages/<page id>/`: a page's versions as diffs, one a pause in typing.
- The study folder's other files do not change. Today's `history/` (the trail) is read as the first steps.

## What the build must satisfy

Written once the person chooses an identity and a way to share the screen.
