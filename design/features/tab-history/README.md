# Going back inside a tab

**State:** exploring · **Shots:** `node design/features/tab-history/scene.mjs` draws them in the app as built, mid-study,
into `scenes/t*.png` · Nothing here is built yet.

Every tab keeps its own history and has a back button that goes back through it: the reader, the Concordance, the
dictionaries (BDB, Webster's), the Notebook and every docked pane. It came out of the Concordance's round 4 review
(the person, 2026-11-16, [concordance](../concordance/README.md), shot 1): a word picked there opens in a new tab that
is a copy of the old one with its history, and back in the new tab goes back through where it came from. "This is
useful across all tabs", so it is designed here, app-wide, beside the trail ([minimize](../minimize/README.md)).

## Decisions (the person, 2026-11-16)

- **Its own folder**, `tab-history/`, not a round in minimize (asked and answered 2026-11-16): the trail there is
  accepted and building; this links to it.
- **Moving inside a tab is a step on the trail** (concordance round 3 review): a new page in the Concordance, an entry
  opened in a dictionary, the reader going to another chapter, a page opened in the Notebook. Each move is its own step.
- **Each tab has a back button** that goes back through that tab's own history, not the whole trail.
- **A tab opened from another is a copy of it, with its history.** Back in the new tab goes back through where it came
  from; the tab it came from keeps its own place.

## How the two histories sit together (as drawn)

The **trail** is the whole sitting across tabs (the line under the top bar); **a tab's history** is the part of the
trail that happened inside one tab. They are the same steps seen two ways, so nothing is recorded twice:

- A move inside a tab adds a step on the trail whose `from` is the step before it in that tab.
- A copy is a fork on the trail: its first step's `from` is the step it was copied at (the dot after H7068 in
  `t03-copy-on-the-trail`). Its back list is its own steps, then the steps of the tab it came from up to the fork.
- Back moves the tab, but adds no new step (as a browser's back does not add history); the trail's front step moves
  back with it. Forward is there until a new move is made, which drops the forward steps from the tab (not the trail:
  the trail keeps them as a side trip, and its drawer still shows them).

## Shots (drawn 2026-11-16 on the 14:19 release build)

The app's own window: the rail, the top bar, the trail line, the dock and the Notebook. The study is a copy of the
scratch folder; a lookup was made (H7068) and the reader is on Numbers 25. The Concordance is a stand-in pane, its
words `wb` answers; the back buttons, the history menu, the copy and the extra trail steps are drawn on top.

| Shot | What it shows |
|---|---|
| `t01-a-back-in-the-strip` | **A:** ‹ › at the head of each tab strip, for the front tab. Hover: "Back to zeal · Alt+←" |
| `t01-b-back-in-the-tab` | **B:** a ‹ inside the front tab, before its name |
| `t01-c-back-on-the-trail-line` | **C:** one ‹ › pair at the start of the trail line, for whichever tab is in front |
| `t02-the-tabs-history` | Held or right-clicked, back lists the tab's history, newest first, the place now marked; Show on the trail |
| `t03-copy-opened` | zealous picked in the Concordance opens as a copy, beside it (marked with a line on top); back goes to H7068 |
| `t03-copy-history` | The copy's back list: zealous, then "Before it: copied from Concordance" and that tab's steps |
| `t03-copy-on-the-trail` | The trail line: the fork dot at H7068, zealous after it as its own tab |
| `t04-a-reader-back-on-the-trail-line` | The reader as a tab: moved Numbers 25 → Psalms 69 → John 2; C's pair at the line's start goes back to Psalms 69 |
| `t04-b-reader-back-at-its-head` | The reader's back at the head of the reader instead, the way a docked pane has it in A |

Found while drawing: the top bar's ‹ › beside the book name are already the chapter before and the next chapter. A
back button for the reader must not look like them or sit beside them, or they will be confused (one reason for C or a
reader head, not the top bar).

## Open questions (2026-11-16)

1. **Where does back sit?** A (the head of each tab strip, for the front tab), B (inside the front tab), or C (one pair
   on the trail line, for whichever tab is in front). A and B give a floating window its own back; C keeps one place to
   look. The reader has no tab strip: under A or B it needs a head of its own (t04-b).
2. **Forward too, or back only?** Drawn with forward, greyed until back has been used.
3. **The history list:** held or right-clicked on back (t02), or always a small ▾ beside it?
4. **Does every tab copy when it opens another, or only some moves?** The decision names a word picked in the
   Concordance. Is a reference clicked in a Notebook page a move inside the Notebook (back returns to the page) or a copy?
   And a verse opened from a pane into the reader: the reader moves (its own history), the pane stays.
5. **Keys:** Alt+← and Alt+→ (as browsers), and the mouse's back and forward buttons, for the tab in front (or the tab
   under the mouse)?
6. **What a move is, kind by kind.** The Concordance: a new word, entry, tab (English, Hebrew, Greek, Interlinear),
   grouping or Near? The reader: each chapter, or each verse gone to? Scrolling is never a step. A tab's own small
   controls (All forms / This word, Expand all) are part of the step, not steps of their own?
7. **After the window reopens:** does each tab keep its history (from `history/<day>.jsonl`, which already holds every
   step and its `from`), or start fresh?
8. **The way back of panels** (`‹ From Numbers 25:11`, [panels](../panels/README.md) P1): it returns to the verse in the
   reader. Does it stay as it is beside the tab's back (which stays inside the tab), or become the oldest entry of the
   tab's history list?

## What the build must satisfy

Not written yet: the person has not chosen where back sits.

To be settled with it: the `wb` command for the same action (likely `wb history back <tab>` and a `from` on
`wb history add` for a copy), and that the study folder's `history/` lines need no new field (a tab's history is read
from the steps' `from`; to be confirmed when the build is planned).

## Out of scope / later

- The trail itself (its line, drawer, sittings): [minimize](../minimize/README.md), building.
- What the Concordance shows on each page: [concordance](../concordance/README.md).
