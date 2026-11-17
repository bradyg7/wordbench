# Going back inside a tab

**State:** exploring · **Sheets:** none yet (`python design/features/tab-history/tab-history.py` will write `tab-history.figcraft` and `tab-history.pdf`, the board) · Nothing here is built yet. What other tools get wrong, and so what this folder avoids: [bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: unfinished** (2026-11-16, seeded the same day by the overseer from the concordance folder's round 3 and round 4 reviews, by [ready-criteria](../ready-criteria.md); never "accepted", which is the person's word). Nothing is drawn and there is no "what the build must satisfy" yet: checks 1, 3, 4 and 8 fail by construction. This folder holds only what the person has already said; no feature has been invented to fill it.

A back button in a tab that goes back through that tab's own history, in every tab, not only in the Concordance: the person's request in the [concordance](../concordance/README.md) round 4 review (2026-11-16). It touches every pane's top and the trail ([minimize](../minimize/README.md), [command](../command/README.md) C13-C16 for the line under the top bar).

## What the person has said

All of it is quoted from the concordance README's reviews; nothing is added.

- **Round 3 review (the person, 2026-11-16), a move inside a tab is a step on the trail:** "Moving inside a tab is a step on the trail: inside the Concordance, a dictionary, the reader or any other tab, each move is its own step."
- **Round 4 review, shot 1 (the person, 2026-11-16), picking a word:** the picked word opens in a new tab; "The new tab is a copy of the tab it came from, with that tab's history, and a back button in the tab goes back through it."
- **Round 4 review, shot 1 (the person, 2026-11-16), where it belongs:** "Going back inside a tab is wanted in every tab, not only here, so it is designed as an app-wide feature of its own (with the trail rule above), not in this folder."
- **The way back is a different thing.** [panels](../panels/README.md) (accepted) already has "the way back": `‹ From Numbers 25:11`, shown only when a tab was opened from the text and a link to the verse. This folder's back button goes back through the tab's own steps. They must not be confused on a sheet.
- The Concordance's [C21-C23](../concordance/README.md) draw one place for the button (left of the box, in the new tab) and what it does for one step; they are that folder's drawing of this feature and are not binding on the other tabs until this design is accepted.

## Leading design

Nothing drawn yet.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The back button in a tab's top | | |
| A tab's history | | |

## Decisions (the person, 2026-11-16)

- **App-wide, not Concordance-only.** Every tab has its own history and a back button that goes back through it (round 4).
- **A move inside a tab is a step on the trail** (round 3), so the tab's history and the trail are kept in step; which of the two a button reads is to be designed.
- **A new tab made from a tab copies its history** (round 4, the picked word).

## Open questions

Raised by the quotes above, not answered by any decision; each is for a first round of sheets, with the person's own words where a recommendation can be built on them.

- Where the button sits in a tab's top: [panels](../panels/README.md) P1/P2a say what a tab's top holds (the way back, the kind label, the title, at most two icon buttons, then More); the back button must fit it and not be the way back.
- How a tab's history and the [trail](../minimize/README.md) relate: the person says each move is a step on the trail and that the new tab copies the history. Whether the two are one list read two ways, or the tab's history is the trail filtered to that tab, is to be drawn.
- What happens at the first step (the button's state), and whether a step forward is wanted: the person has asked only for going back.
- The `wb` command for it (every core action has one): `wb history` exists for the trail (`add`, `list`, `sittings`), so the command is probably an extension of it; to be named when the design is drawn.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| none | | | | |

## Data the sheets show

| File | Made by |
|---|---|
| none | |

## The real conditions

The board will show the part among other tabs, as a floating tab, narrow, and with years of study (see the [index](../README.md)).

| Condition | Window |
|---|---|
| Among other tabs | to draw |
| Floating | to draw |
| Narrow | to draw |
| Years of study | to draw |

## What the build must satisfy

Written once the person accepts a direction. Known now, from the person's words:

- [ ] In every tab, a back button goes back through that tab's own history, one step at a time.
- [ ] A tab opened from another tab (a picked word in the Concordance) starts with a copy of that tab's history, and going back in either does not change the other.
- [ ] A move inside a tab is its own step on the trail.
- [ ] The `wb` command that reaches the same action (to be named).
- [ ] No study file changes unless the design says so; the reader's place is kept.

## Out of scope / later

- The way back to the verse (`‹ From Numbers 25:11`): [panels](../panels/README.md).
- How the trail is shown and cut into sittings: [minimize](../minimize/README.md).
