# Panels: the template every side panel and tab fills in

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** accepted (2026-11-16) · **Sheet:** open `design/features/panels/panels.html` in a browser (drawn with `ui/tokens.css`,
no new colors) · Nothing here is built yet.

The person (2026-11-16): a design for what side panels generally look like — what a tab's content shows at its top,
how buttons are formatted, how text is formatted — so later designs (the Concordance, the dictionary, a verse alone)
fill in a template instead of each inventing its own. It touches every docked pane and tab; it does not change the
dock, the tab strip or the rail ([minimize](../minimize/README.md)).

## Leading design

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Anatomy (bands, top to bottom) | P1 | |
| A tab's top | P2a, P2b, P2c (open) | |
| Buttons | P3 | |
| Text | P4 | |
| Narrow, dark, empty | P5 | |

## The proposal (round 1)

**P1, the bands.** A panel is, top to bottom:

1. **The way back** (only when opened from the text): `‹ From Numbers 25:11`, the reference a link to the verse.
   Keeps "never lose the reader's place" visible in every panel the same way.
2. **Kind:** a small-caps label saying what the panel is (`Concordance · English`, `Verse`, `Page`).
3. **Title** and the panel's own icon buttons beside it: at most two, then More (`…`).
4. **Subtitle:** one muted line of counts or scope.
5. **Tools row:** switches and chips that change what is shown. Never actions on the study.
6. **Body:** section labels (small caps, with a count at the right), rows divided by a rule, or cards.
7. **Foot** (optional): one or two actions on the whole panel, a primary at the right.

**P2, a tab's top** is drawn three ways on the same verse; see open questions.

**P3, buttons.** One ladder: icon button (head tools, 30 px, no border) · quiet (accent text, goes somewhere:
Open in reader, Show all) · button (bordered, an action on this content) · primary (filled accent, at most one per
panel) · segmented switch and chips (tools row only). Delete is a button in the words-of-Jesus red only where it
already deletes; it is never primary.

**P4, text.** The existing tokens, fixed to roles: title `--type-title`; kind and section labels `--type-label`
muted; subtitle and counts `--type-small` muted; references `--type-small-strong` accent, always a link; scripture
`--type-read-small` (Literata), verbatim; the person's writing `--type-body`; lookup text (BDB, Webster's) small at
14/22; times and parsing `--type-caption`. Scripture is the only serif in a panel.

**P5.** At 280 px Keep folds into More, chips wrap, the title wraps (never cut). Dark uses the dark tokens. An empty
panel says what was asked and one next step.

Today's CSS already has most of these pieces (`.pane-head`, `.pane-title`, `.pane-sub`, `.label`, `.btn`, `.btn.small`,
`.icon-btn`, `.link-btn`, `.seg`, `.chip`, `.row`); the template names which to use where and adds the way back, the
kind label and the foot.

## Decisions (the person, 2026-11-16)

- **A tab's top: P2a**, the title block that scrolls away with the body (as today's `.pane-head`). P2b (slim bar
  that stays) and P2c (block that shrinks) are not chosen.
- **The kind label stays** above the title.
- **The foot is allowed**, for one or two actions on the whole panel.
- **Head icons: two, then More.** At 280 px the second folds into More.
- P1's bands, P3's button ladder and P4's text roles are accepted as drawn.

## Open questions

- None for the template. Each panel's own content is its folder's.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-16 | P1-P5 | The bands, three tops, the button ladder, text roles, narrow/dark/empty, in `panels.html` | Decisions above, 2026-11-16 |

## Data the sheets show

| File | Made by |
|---|---|
| `data/verses.txt` | `wb text "Num 25:11"`, `wb text "Ps 69:9"`, `wb text "John 2:17"` (release `wb`, `WB_BIBLE_DB` the Python checkout's `datasets/workbench.db`) |

The count "16 places" is `totals.e` from `wb uses zeal` on the same day. Scripture on the sheet is copied from
`data/verses.txt`, never typed.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | P1 (tab strip) |
| Floating | — (round 2, as a scene) |
| Narrow | P5 narrow |
| Years of study | — (round 2: a long list in the body) |

## What the build must satisfy

- [ ] Every docked pane and tab draws its head as P1/P2a: the way back (`‹ From <ref>`, a link to the verse) only when opened from the text; the kind label; the title with at most two icon buttons, then More; one muted subtitle line.
- [ ] A tools row holds only switches and chips that change what is shown, never actions on the study.
- [ ] Body: section labels in `--type-label` with a count at the right; rows divided by a rule, or cards.
- [ ] An optional foot holds one or two actions; at most one primary in the whole panel.
- [ ] Buttons follow P3: icon button (30 px, no border), quiet (accent text, goes somewhere), bordered button (an action), primary (filled), switch and chips (tools row only).
- [ ] Text follows P4; scripture is the only serif in a panel and is always verbatim from the database.
- [ ] At 280 px the second head icon folds into More, chips wrap, the title wraps. Dark uses the dark tokens. An empty panel says what was asked and one next step.
- [ ] The shared pieces are one set of CSS classes (today's `.pane-head`, `.btn`, `.seg`, `.chip`, `.row` grown to fit), not each pane's own.
- [ ] No `wb` command: this is how the window draws, not an action. No study files change. The reader's place is kept (the way back).

## Out of scope / later

- The dock, tab strip and rail: [minimize](../minimize/README.md).
- Each panel's content: [concordance](../concordance/README.md), [books](../books/README.md), [words](../words/README.md).
