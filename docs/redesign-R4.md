# Redesign R4: the toolbar, the More menu, Settings, a person's own theme

2026-11-09. A design round only: nothing here is built, and no production code changed. It answers R4 in
[debug-spec.md](debug-spec.md) (findings `bc42`, `8810`, `c551`, `93b2`). The sheets are `design/r4.py` →
`design/r4.figcraft` → `design/exports/r4/` (the board: [all.png](../design/exports/r4/all.png)). The scripture on them is the
reader behind the windows, from `content.json`; the rest is interface.

## 1. The old sheets against the window as it is now

| Sheet (2026-11-04) | What it drew | What the window has now | Verdict |
|---|---|---|---|
| S2 Settings: Customize | a toggle list, one switch per button | toolbar fixed in `ui/index.html`: KJV, Notebook, Threads, Shelf, Highlights, ⋯ | too thin: only shows what is already there |
| TB1 Customize: add anything | a search box listing Panes, Views, Commands | none of it built | the right *idea* (anything can be a button) but no way to reorder or take away, and it hides the toolbar behind a modal |
| TB2 My commands | kept commands with a key, "used most" from the log | the command field and its history (window storage, F.11); `sessions/<day>.jsonl` logs lines typed | keep; its counts need the log to hold command lines (see §5) |
| V1 / D3 / D2 Views | layouts as a map of the window | `layout save/load/list` exists (`sessions/layouts/*.json`, `ui/src/actions.ts`); no UI | build on `layout`, and **rename** (§4) |
| S2's list, N4 (Notebook settings) | a Settings window | Notebook's own ⋯ menu holds N4 and Templates; More ⋯ holds eighteen unrelated things | the Settings window is what ties them |

Two facts the old sheets did not know:

- **Settings today live in the wrong place.** Theme, hover mode, text size and version are in the browser's
  `localStorage` (`wb.theme`, `wb.hover`, `wb.size.v1`, `wb.version`), so they are not in the study folder and would not travel to
  a phone. Only the Notebook's settings (`settings/notebook.json`) and the palette are files. R4 moves the rest into
  `settings/*.json`, per key, as `wb settings` already does.
- **The name "view" now means two things.** W5 built views as Notebook lists (`notebook @Num 25 questions open`, `wb view run`).
  V1 meant an arrangement of panes. This round calls the second a **Layout** (the command is already `layout`).

## 2. What `bc42` says is unsettled, and the answer

"The more button needs a redesign, and the customizable settings bar needs designed tool." Two things.

**The customize tool: customize in place (B1, B2, B3).** Not a list of switches in a dialog.
- More ⋯ ▸ *Customize toolbar…* turns the real toolbar into the editor: every button gets a grip (drag to reorder) and a ×
  (put away). **Add** opens a catalog in a drawer at the right edge, beside the live window rather than over it. **Done** keeps; Esc
  undoes the visit; **Reset to the standard toolbar** is in the drawer.
- The catalog holds everything that can be a button, grouped: **Panes** (every pane that opens, Help and the Guide included),
  **Layouts**, **Reading controls** (Text size, Theme, Version), **Commands** (My commands; *A command of your own…*).
  A search finds by name. Anything already on the bar shows a ✓ and cannot be added twice.
- **A command of your own** (B2): name on the button, the line as typed in the field, an icon, an optional key. `{word}` is the
  word selected in the reader, `{place}` the verse picked or at the top, `{chapter}` the chapter in the reader. **Test** shows
  what the line would run with the current selection, writing nothing. The button greys out when it needs a selection and none exists.
- **When it does not fit** (B3): buttons leave from the right end, in the order the person set, into More ⋯ under *Hidden to
  fit*. This replaces the one hard-coded rule (`.tb.roomy`, the Shelf hides under 1366 px). The toolbar never wraps or clips.
- Each button may show icon and label, or icon only. (Not drawn; one switch per button in the edit state.)

**More ⋯ cut down (A2).** More is **Settings…**, **Customize toolbar…**, **Help**, and the toolbar's overflow:
*Not on your toolbar* lists every pane the person put away (or never added), each with a + to put it back. So hiding a button
never loses it, and More is no longer a place where things are kept. It is a short menu, the same on every window size.

## 3. Inventory: every item in today's More ⋯ (A1), and where it goes

`ui/src/main.ts` `settings()`. Eighteen items, in this order today.

| # | Today | Goes to |
|---|---|---|
| 1 | Today's reading (each plan's days, as buttons) | the Reading plans pane, which already opens on its Today card; not a menu's business. (On the phone, whose More is a tab, it stays as the sheet's first block until phase 3 decides.) |
| 2 | Find in chapter | Ctrl+F and `find` in the field (both already work); can be a toolbar button |
| 3 | Help | **stays in More** (F1) |
| 4 | Keys | Help ▸ Keys (reading); Settings ▸ Keys is where a key is changed |
| 5 | Reading plans | *Not on your toolbar* (a pane; can be added) |
| 6 | Today's log | *Not on your toolbar* |
| 7 | Shelf | already on the toolbar (a button; hides into More when narrow) |
| 8 | Findings | *Not on your toolbar* (Ctrl+Shift+J still opens the box) |
| 9 | Documents | *Not on your toolbar* |
| 10 | Text size A− 100% A+ | Settings ▸ Reading; Ctrl+= / Ctrl+- stay; a *Text size* toolbar button is offered |
| 11 | Version KJV · YLT | the toolbar's KJV button; Settings ▸ Reading sets the one at start |
| 12 | Hover cards off · refs · on | Settings ▸ Hover and cards |
| 13 | Theme system · light · dark · e-ink | Settings ▸ Theme; a *Theme* toolbar button flips light ↔ dark |
| 14 | Window size (seven presets) | Settings ▸ Advanced (a checking tool, not a daily one) |
| 15 | Input auto · touch · pointer | Settings ▸ Advanced |
| 16 | Later phases (a note) | Help ▸ Guide, under what the Python app still does |
| 17 | Go to [Psalm 119] | removed: the place button and the command field (`go psalm 119`) do it |
| 18 | Measured this run | Settings ▸ Advanced (attached to a finding when one is written, as now) |

Also looked at and **left alone**: the Highlights menu (layers and threads drawn in the reader; a toolbar button with its own
menu), the Notebook's own ⋯ (W1 cut it to what acts on the Notebook; its settings move into Settings ▸ Notebook, Templates
beside them), and the phone's bottom tabs.

## 4. Settings (C1)

- **A pane**, not a modal: it floats with no dimming and can be docked like any other, so the reader stays visible and live
  behind it. This is what makes a theme possible to judge as it is made.
- Nine sections: **Toolbar** (the in-place editor, for those who prefer a page; the same state), **Layouts**, **Reading**,
  **Notebook**, **Hover and cards**, **Theme**, **Commands** (kept commands, the most used), **Keys**, **Advanced**.
  *Find a setting* searches names and descriptions across every section.
- A change is saved the moment it is made, per key, with Undo in the toast. No Save button. *Reset this page* per section.
- Every setting is reachable from a terminal: `wb settings <part> [key [value]]` (already built for the Notebook), so a person
  (or an AI) can do from `wb` anything the window does.
- **Layouts**: a layout is where each pane goes plus a name, an optional key, whether it shows in the toolbar's Layout menu.
  Built on the existing `layout save/load/list` and the dock's `panes` description; V1/D3/D2 stand as drawn, with this word.

## 5. A theme of your own (C2)

- Beside System, Light, Dark and E-ink, the person's themes. A theme is **a base plus only the colors changed**
  (`settings/theme.json`: a list of `{name, base, colors, fonts}`, and which is active). It stays right when a new color token is
  added, and *Reset* can mean one color or the whole theme.
- Every color token in `ui/tokens.css` that a theme sets: the page, cards, toolbars, lines; text, secondary text, the accent and
  selection; the words of Jesus; the five highlight colors; the two thread colors and the open question. Each: swatch, hex, a
  picker, a dot when changed. (The Highlights bar's custom palette, `settings/palette.json`, stays its own thing.)
- **Contrast is measured, not decided:** the text against the page, the accent, the words of Jesus, text on a highlight, with
  the 4.5:1 floor shown as a ✓ or a warning. Never enforced.
- **Fonts go with the theme** (note `0863`): scripture face, interface face, scripture size and line height. The faces we bundle
  (Literata, Inter) are the choices; a system font is allowed.
- Light and dark: a theme names its base, so a person who wants a light theme and a dark theme makes two and sets which one
  *System* follows (a question below).
- Applied as CSS variables on the root over the base theme; the e-ink base keeps its own large type and 56 px touch targets.
- Nothing about a theme is interpretation: it is color and type.

## 6. Files and `wb`

| New file (the Python app passes over it) | Holds |
|---|---|
| `settings/toolbar.json` | the buttons in order: `{kind: pane\|layout\|command\|control, id, label?, icon?, show: icon\|both}`; hidden ones are simply absent |
| `settings/commands.json` | kept commands: name, line, icon, key |
| `settings/layouts.json`, or `sessions/layouts/*.json` kept | Layout names, keys; (the existing layout files stay as they are) |
| `settings/theme.json` | themes and the active one |
| `settings/reading.json`, `settings/hover.json`, `settings/advanced.json` | what now lives in `localStorage`, moved (first run reads the old value once) |

`wb` gains: `wb toolbar [list|add|rm|move|reset]`, `wb commands [list|add|rm|run|top]`, `wb theme [list|set|new|color|reset]`,
and `wb settings` learns the new parts. `wb do` carries the in-window ones (`customize`). *Most used* counts command lines in
`sessions/<day>.jsonl`; that log holds what was typed into the capture box today, so the core must also log run command lines
(a new `kind` field on the entry, ignored by the Python app) before this counts anything.

## 7. Recommendation and order

Accept this design as one piece, built in the order below (each step ships and is checked alone; the person runs
`scripts/backup-study.ps1` before the first that writes a new settings file):

1. **Settings pane and More ⋯ cut down** (C1, A2): the pane, the nine sections, the move out of `localStorage`, `wb settings` parts. No toolbar change yet.
2. **Theme** (C2): the largest single ask in the findings (`93b2`), independent of the rest.
3. **Toolbar in place** (B1, B3): `settings/toolbar.json`, edit mode, the catalog, overflow.
4. **Commands** (B2, TB2): own commands, keys, most used.
5. **Layouts** (V1): the map; the name change.

Phone (phase 3) is not drawn: the bottom tabs (Read, Notebook, Threads, Study, More) would draw from the same catalog, with a
cap of four plus More, and More ⋯'s phone sheet is the same short list.

## 8. Questions for the person

1. **Settings as a pane or a dialog?** Recommended: a pane that floats without dimming (the reader stays live; a theme can be
   judged while made). A dialog is simpler and dims the reader.
2. **Is "customize in place" the tool `bc42` meant,** with the catalog in a drawer; or would a page in Settings (a list with
   switches, as S2) be closer to what you pictured? Both edit the same file, so we could have both.
3. **Layouts, not Views,** for arrangements of panes, since *view* now means a Notebook list. Agreed?
4. **What stays on the default toolbar?** Today: KJV, Notebook, Threads, Shelf, Highlights. Recommended: the same, plus a
   *Layout* menu once Layouts exist. Findings, Documents, Reading plans and Today's log move to More's overflow (they are there already).
5. **Phone toolbar:** customize the bottom tabs too (four plus More), or leave them fixed?
6. **Light and dark:** one theme for each, with *System* choosing between two you name; or one theme with both variants in it?
7. **Moving the settings out of `localStorage`** into `settings/*.json` means they travel with the study folder (and a phone
   later). Fine, or keep window-only settings (size, input mode) per machine?
8. **Keys:** may a person rebind keys (Settings ▸ Keys), or only set the keys of their own commands, layouts and the capture
   key? The first is more work and risks clashes with the OS.
9. **Remove "Go to" and "Later phases"** from More with no replacement (the field and Help ▸ Guide do their jobs). Agreed?
