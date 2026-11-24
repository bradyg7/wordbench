# Minimized panes, full screen and the side rail

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** up for redesign (the person, 2026-11-24); was: the rail and the trail accepted to build (2026-11-13); minimized tabs, folder tabs and full screen accepted (round 7, 2026-11-16); the Shelf still exploring · **Sheets:**
`python design/features/minimize/minimize.py` writes `minimize.figcraft` and `minimize.pdf` (the board, one vector
page) · The rail and the trail are building on `feature/command`.

## Leading design (2026-11-12)

The board and its PDF hold only these windows. Superseded ones are left off the board by the script's `DROP` list (see [lead.py](../lead.py)); their drawings are in git history (commit `0d59600`).

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Floating windows as folders | B2 | B1 (rejected: tabs on the reader's edges) |
| Full screen and Present | C1, C2, E2, F2 |  |
| Minimized tabs | round 7: R1-R4 (open), R5, R6 in `round7.html` | M1-M5 (the tray, A: by the rail and the trail), D1, D2 (by the rail of round 5), E1 (by the trail) |
| The trail | I2 (the line under the top bar), N1 + O1 (sittings with side trips folded; chosen) | I1 (by N1 + O1), P1 (rejected) |
| The rail's books | [concordance](../concordance/README.md), [books](../books/README.md) | G1-G3, J1, J2 (by the concordance folder), K1 (by books) |
| Notebook and Shelf | [library](../library/README.md) | F1, H1, H2, L1 (by library S20) |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| c301 (2026-11-09) | The Notebook's side panel can be minimized |
| c43b (2026-11-11) | A verse goes into a thread quickly but not onto the Shelf; bookmarking in one or two steps |
| 9413 (2026-11-11) | Removing a tab from a Shelf set does not close it; what the Shelf is for |
| f54e (2026-11-09) | Full screen for any one tab (present slides, read notes, a Strong's entry), and back to the same view |
| 7e04 (2026-11-10) | Tabs shaped like a folder tab; a floating pane shows only its tabs, perhaps curved |
| c9a2 (2026-11-12) | Panes and tabs like browser tabs in the top bar, with the search bar as the command box |

## Decisions so far (the person, 2026-11-11)

- **Direction.** D (one rail for everything) is the favorite. The minimal looks of C and D and the floating folder tabs of B2 are liked.
  B (folder tabs standing on the reader's edges for minimized panes) is rejected. A (tray of pills) and C (tray under a
  full-screen pane) may still have a part; to be worked out.
- **Rail icons by kind.** Each rail icon stands for a kind of pane (word study, search, interlinear, Notebook...).
  Clicking it shows the minimized tabs of that kind; clicking one restores that pane.
- **Folder tabs everywhere.** The folder-tab look (only the tabs show, the front one joined to its page) restyles every
  tab strip in the app, not only minimized ones.
- **Full screen is the minimize model.** "Focus" is renamed Full screen and shown as an icon, not words. Full screen
  minimizes everything else; leaving it puts every pane back exactly.
- **Present is for documents only**, for now.
- **The Notebook follows the same rail**, perhaps persistent. A persistent side rail in place of the top toolbar's
  tools is to be explored.
- **Phone deferred.** The desktop app is finished first.

## For later: the Shelf

Raised while deciding how rail menus relate to the Shelf. Not designed yet; the rail rounds only sketch where a
"keep on the Shelf" action could sit.

- f_20261108005250_1d0e: the Shelf needs to be figured out soon.
- f_20261111002622_9413: removing a tab from a Shelf set does not close the tab; walk through what the Shelf is for and
  make it a mainstay beside the Notebook and the reader. Should it work as the bookmark feature?
- f_20261111150806_c43b: a verse goes into a thread quickly but not onto the Shelf or a Shelf folder; bookmarking
  should be one step, two at most, and so should getting it back. Plan one integration of these systems.
- f_20261109183247_f54e: full screen would make the Shelf and views stronger: go full screen, switch view, come back
  without minimizing or closing the tab.

Open question for the Shelf round: is a minimized tab a short-lived bookmark, and the Shelf the lasting one? If so,
the rail menu's "keep on the Shelf" is the one-step bookmark c43b asks for.

## Round 3 review (2026-11-11)

- The rail goes on the **left**. The Notebook appears on it **once**; its minimized pages live in its own menu.
- Icons only by default, names on hover; **Show names** opens the rail out with labels.
- The bookmark beside each minimized tab ("keep on the Shelf") is the starting point for the Shelf round.
- **No red count badges.** Round 4 tries up to three short ticks under an icon, and "N waiting" when names are shown.
- New: a **Concordance** on the rail, a full Strong's interface (index, entry, by book, every use). Its menu holds
  the minimized word studies and opens the whole Concordance. The idea: a workbench of real books on a desk.
- New: **Notebook and Shelf together.** Folders and pages need not be separate. Round 4 draws H1 (one tree: folders
  hold pages, verses, words, documents; the Shelf button goes) and H2 (one drawer, a Shelf section of quick
  bookmarks under the folders).

## Round 4 review (2026-11-11)

- **Ticks fail at scale.** A study runs to 20-50+ tabs. Round 5 drops counting: every tab joins a **trail** that
  remembers which tab it was opened from, back to where it began, and can be retraced or kept as a page.
- **The Concordance is the printed Strong's**: English words A to Z with every place and the original word's number,
  the Hebrew and Greek dictionaries, and an interlinear for a verse, passage or chapter. To be mapped further.
- **Notebook = pages and the Shelf.** Inbox goes (nothing is received; a page need not have a place). The Questions tab
  goes (questions stay in pages). Today becomes an optional page.
- **BDB and Webster's 1913 are books of their own** on the rail, like the Concordance.
- Naming note: "trail" was the old word for a question (`wb trail`, `.trash`, actions.ts). If the new trail keeps the
  name, the old command name needs retiring or a different word is needed (path, thread of study...).

## Round 5 review (2026-11-11)

- **"Trail" now means this history.** The old trail (a question: `wb trail`, `trail` in actions.ts) is retired; its
  command and code names move to "question" when this is built.
- **The trail records whenever the app is used.** To keep it from bloating, round 6 draws three ways: N sittings
  (a 30-minute gap starts a new one), O main path with side trips folded, P marked starts with plain history.
- **Both views stay**: the full drawer and the line under the top bar (the line keeps the trail in view while the
  drawer is folded).
- **Closed tabs stay on the trail**: it records history, not only open tabs.
- **Hebrew and Greek are tabs inside the Concordance.**

## Open questions


- Is a minimized tab a short-lived bookmark, and the Shelf the lasting one? (the Shelf round)
- Which of A (tray of pills) and C (tray under a full-screen pane) keeps a part.
- A persistent side rail in place of the top toolbar's tools.
- The trail's shape: N sittings, O main path with side trips folded, or P marked starts (round 6, awaiting review).

## Rounds

| Round | Windows | What it tried |
|---|---|---|
| 1-2 | B-G | Ways to minimize: tray of pills (A), folder tabs on the reader's edges (B), tray under full screen (C), one rail (D) |
| 3 | H, I | The rail on the left, the Notebook once, Show names, the Concordance, Notebook and Shelf together (H1, H2) |
| 4 | J, K, L | Ticks under icons, the Concordance as the printed Strong's, BDB and Webster's as books |
| 5 | M1-M5 | Every tab joins a trail; the drawer and the line under the top bar |
| 6 | N1, O1, P1 | Keeping the trail from bloating |
| 7 (2026-11-16) | R0-R6 | Minimized tabs in the rail's menus: what a click does (R1a/b), kinds with no icon (R2a/b), 20+ tabs (R3a/b), what else shows a minimized tab (R4a/b), folder tabs (R5), full screen (R6). Drawn in `round7.html` (open it in a browser), not on the FigCraft board. Reviewed 2026-11-16 |

Window tags are the names on the board (M1, H8…); each round's review is its dated section above. (The round-to-window
mapping here is read from the script's function names; correct it if a window sits in another round.)

## Data the sheets show

| File | What |
|---|---|
| `data/concordance-zeal.json` | Every place of "zeal" with its Strong's number, from the database |
| `data/bdb-H7065.json` | The BDB entry for H7065, from the database |
| `data/webster-zealous.json` | Webster's 1913 on "zealous" (`wb word-define zealous`) |

Fetched on 2026-11-11 (the commands were not recorded); refetch with `wb` if the database changes, never edit by hand.

## What the build must satisfy

### Minimized tabs, folder tabs and full screen (round 7, accepted 2026-11-16)

Minimized tabs:

- [ ] **A minimized tab is a link, not a loaded pane.** Minimize saves the pane's view (`captureView`) and any writing
  (`beforeClose`), closes the pane, and keeps a link: kind, title, trail line, view, when it was minimized. Restoring
  runs the line, puts the view back and brings the pane to the front where it was docked (or its kind's usual place).
- [ ] A link whose line cannot open it again (nothing to run) is not offered as minimized; Minimize on such a pane is
  Close, and it stays on the trail.
- [ ] Minimized links last across restarts (kept with the window's layout, not in the study folder).
- [ ] **No "· minimized" chips** over the reader. Minimize folds the pane toward its rail icon (none with reduced motion).
- [ ] A rail icon with minimized links gets a short bar at its left edge; no count (R1).
- [ ] **A click on such an icon opens its menu** (R1a): the kind's name and Open <pane> at the top, then the links newest
  first with when each was minimized; on hover, Keep on the Shelf and Close. A second click, Esc or a click outside closes
  the menu. An icon with nothing minimized keeps today's rule (opens its pane; clicked again, closes it).
- [ ] **Kinds with no rail icon** (word studies, search, a verse alone, a second reader) wait under one **Minimized**
  icon under the rule, grouped by kind inside (R2a). It shows only while something waits there.
- [ ] **More than eight**: the menu shows the newest eight, a find field over all of them, Show all and Close all; Close
  all asks first; closed links stay on the trail (R3a).
- [ ] Only the rail shows a minimized tab; the trail line is unchanged (R4a).
- [ ] `wb` reaches it: the window's `minimize` / `restore` actions in the command language (`minimize <name>`,
  `restore <name>`, `restore minimized`), as `actions.ts` already has for `minimize`.

Folder tabs (R5):

- [ ] Every tab strip draws folder tabs: the front tab shares the page's color with no rule under it; the others sit
  back on the strip's color. Minimize and Full screen are icons at the strip's end.

Full screen (R6):

- [ ] Full screen (an icon, no word) shows one pane with the rail beside it; every other pane is hidden **but stays
  loaded**. The same icon or Esc puts every pane back exactly where it was.

Not changed: the study folder (no file changes); the trail's steps; the reader's place.

### Build go-ahead (2026-11-13)

The person accepted command round 2 (the top bar with the trail line under it) and asked for "the full rail and toolbar
feature redesign" to be built in its own branch. That builds the parts of this folder those windows stand on: the
round-5 rail and the trail (I2's line; N + O's sittings with side trips folded). Minimized tabs in rail menus, folder
tabs everywhere, full screen and the Shelf stay as they are today and are not part of this build.

The rail:

- [ ] **On the left, always**, icons only; the name on hover; **Show names** at its foot opens it out with labels and
  is remembered. No count badges.
- [ ] Top: Notebook (once), Shelf, Highlights; under a rule: Trail (a dot while a sitting is going), Reading plans,
  Findings, Documents; foot: Show names, Help, Settings. The Concordance, BDB and Webster's join when their own folders
  are accepted and built.
- [ ] A rail icon opens its pane **in the left column, beside the rail** (floating if it was last left floating), or
  brings it to the front, and shows as on while that pane is in front. **Clicked again while on, it closes that pane**
  (the person, 2026-11-13, after trying the build).
- [ ] The dock's columns, bands and floats start right of the rail; the reader's place is kept when it opens out.

The trail:

- [ ] **Every tab opened is a step**: each pane opened and each place the reader goes to. A step keeps the step it was
  opened from (the pane or reader last clicked), its kind, title and the line that opens it again.
- [ ] **Sittings**: a 30-minute gap starts a new one. The line under the top bar shows the sitting chip, where the
  sitting began and the way from there to the step in front, forks marked; a long way folds its middle into "… N".
  Clicking a step brings its tab to the front, opening it again from its line if it was closed.
- [ ] **The drawer** (the rail's Trail, the chip's Show the whole trail, a click on "… N"): the sitting as a tree with
  side trips folded (O); earlier sittings newest first, folded by day (N). Keep as a page writes the sitting's steps
  into a new page.
- [ ] **Closed tabs stay on the trail.**
- [ ] **Kept in the study folder** as `history/<yyyy-mm-dd>.jsonl`, one step per line (`id`, `at`, `from`, `kind`,
  `title`, `line`). The folder is `history/` because `trails/` holds the old questions. No file that exists today
  changes. (Compacting old sittings, decided in round 6, waits for a size that needs it; a later round says how.)
- [ ] `wb history add|list|sittings|keep` reaches every action from a terminal.
- [ ] Naming: the window says "trail"; the store and command say `history` until the old `wb trail` (questions) is
  retired to `question`, which is not part of this build.

## Round 7 review (the person, 2026-11-16)

- **All of round 7's a, with R5 and R6.** R1a: a click on a rail icon opens its menu of minimized tabs (Open <pane> at
  the top; Keep on the Shelf and Close on hover). R2a: tabs with no rail icon wait under one Minimized icon, grouped by
  kind. R3a: the newest eight and a find field, Show all and Close all. R4a: only the rail shows a minimized tab; it
  folds toward its icon and today's "· minimized" chips go. R5: folder tabs on every strip. R6: full screen as drawn.
- **Raised: a minimized tab as a link, not a loaded tab.** Today minimizing hides a group and keeps every pane in it
  alive (`dock.minimize` sets `min` on the group; the panes stay in the page and are still redrawn when the study
  changes). The person asked whether a minimized tab could be a clickable link instead, and chose links (2026-11-16): minimizing
  closes the pane and keeps its trail line (the command that opens it again) and its view (`captureView`: scroll, the
  open tab inside it); restoring runs the line and puts the view back. A pane with writing not yet saved saves it first
  (`beforeClose`). Nothing is lost that the trail and the study folder do not already keep. Full screen is not
  minimizing: the panes it hides stay loaded, so leaving it puts every pane back exactly.

## Round 6 review (the person, 2026-11-11)

- **N and O together.** Sittings (N's look: a 30-minute gap starts a new sitting, newest first, older days folded)
  with O's side-trip folding inside each sitting. P (marked starts) is not chosen.
- **Trails are kept, compacted with age** to keep the app light. Kept trails are worth having for handing study data
  to an AI, looking back, and appending a trail to a page as a record of the study.
- Next: the Concordance in detail (its own folder, `design/features/concordance/`). Still to settle: the Notebook and
  Shelf together, and what a bookmark means in the app.
