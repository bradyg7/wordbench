# Minimized panes, full screen and the side rail

**State:** exploring · **Sheets:** `python design/features/minimize/minimize.py` writes `minimize.figcraft` and
`exports/*.png` (all.png and one per window, b1 ... p1) · Nothing here is built yet.

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

Window tags are the `exports/<tag>.png` names; each round's review is its dated section above. (The round-to-window
mapping here is read from the script's function names; correct it if a window sits in another round.)

## Data the sheets show

| File | What |
|---|---|
| `data/concordance-zeal.json` | Every place of "zeal" with its Strong's number, from the database |
| `data/bdb-H7065.json` | The BDB entry for H7065, from the database |
| `data/webster-zealous.json` | Webster's 1913 on "zealous" (`wb word-define zealous`) |

Fetched on 2026-11-11 (the commands were not recorded); refetch with `wb` if the database changes, never edit by hand.

## What the build must satisfy

Not written yet: the person has not accepted a direction. When they do, each accepted decision above becomes a
checkable line here (behaviour, the `wb` command for it, what happens to the study files, the reader's place kept),
naming the window that shows it.

## Round 6 review (the person, 2026-11-11)

- **N and O together.** Sittings (N's look: a 30-minute gap starts a new sitting, newest first, older days folded)
  with O's side-trip folding inside each sitting. P (marked starts) is not chosen.
- **Trails are kept, compacted with age** to keep the app light. Kept trails are worth having for handing study data
  to an AI, looking back, and appending a trail to a page as a record of the study.
- Next: the Concordance in detail (its own folder, `design/features/concordance/`). Still to settle: the Notebook and
  Shelf together, and what a bookmark means in the app.
