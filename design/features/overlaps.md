# Overlaps between the designs

Many folders draw the same part of the app from their own side. This list names each shared part, the folders that
design it, and how they stand against each other, so that when the designs are merged it is clear which can go
together and which need one decision first (the person, 2026-11-12). [coverage.md](coverage.md) says which folder
owns an area; this says where a folder reaches into another's.

**Status:** *agrees* (the directions fit; merge as drawn) · *conflict* (they cannot both be built; the person
chooses) · *open* (it depends on a choice not made yet) · *owner* names the folder whose decision the others follow.

Keep it current: when a folder's round draws a part another folder owns, or a decision settles a row, change the row.

## Conflicts to settle first

| Part | Folders | Status | What has to be chosen |
|---|---|---|---|
| Deleting: 7 days or destroyed | AGENTS.md (decided 2026-11-03/04: 7 days, Erase now), [trash](trash/README.md) A (Undo only, finding cf09) and B (7 days kept) | conflict | Trash A reverses a standing decision; only the person can. B keeps it. |
| Layers, eyes and what can be hidden | [highlights](highlights/README.md) B (layers by year, one eye per kind), [reader](reader/README.md) C R7 (decided: one panel shows or hides every kind of mark), [threads](threads/README.md) C (a thread becomes a layer) | open | Reader's decision makes one marks panel. Highlights B and threads C both put layers in it. Are threads layers too? This decides what the panel lists. |
| What sits on the rail | [minimize](minimize/README.md) (owner: rail 5 has Notebook, Concordance, BDB, Webster's, Highlights, Trail, Settings), [command](command/README.md) B (kept commands at the rail's foot), [books](books/README.md) (BDB, Webster's) | open | Command B adds a group to the rail. Does minimize's rail have room, or do kept commands go in the ⋯? |
| The toolbar's buttons in Settings | [settings](settings/README.md) (accepted: Reading lists "the toolbar's buttons"), [command](command/README.md) round 2 C13 (the toolbar and Settings ▸ Toolbar go) | conflict | If C13 is chosen, settings' accepted line about the toolbar's buttons is struck before it is built. |
| The trail line under the top bar | [minimize](minimize/README.md) (owner: I2, sittings N + O), [command](command/README.md) round 2 C13-C16 (the line under the new top bar, the sitting chip) | agrees | Command draws minimize's decision in the new bar; the sitting chip's menu is new and minimize should take it. |
| A word or verse card vs a tab | [words](words/README.md) A (a card that moves, sizes and pins), [minimize](minimize/README.md) (decided: floating panes, folder tabs) | open | A pinned card is close to a floating pane. Is it one, or something of its own? |

## Parts drawn by more than one folder

| Part | Folders | Status | Note |
|---|---|---|---|
| What a mark is; the margin; the verse's page | [marks](marks/README.md) (round 1: the right margin is the verse's page, edited in place; references found, not stored), [reader](reader/README.md) C (decided: names only in the margin), [library](library/README.md) S16 (right margin not liked yet) | open | The person likes R6's names as the first view, perhaps mixed with M2 (marks open question 8). Library S16's right margin is replaced by marks M2 if accepted. |
| Questions in the Library | [marks](marks/README.md), [questions](questions/README.md) Q7, [library](library/README.md) S21 | agrees | Settled 2026-11-12: a filter of the Library's one search (marks M8). Questions Q7 (a section) is dropped. |
| What an underline means | [marks](marks/README.md) M5, M13-M17 (the dotted line too), [threads](threads/README.md) (a thread as a folder of saves, leaning), [highlights](highlights/README.md) (styles beside colors), [reader](reader/README.md) | open | Once threads are folders, the underline is free: a pencil line (U-A), a saved phrase (U-B) or your own styles (U-C). |
| Places: a page's anchor vs tethers | [marks](marks/README.md) (decided 2026-11-12: no places; a page's references tether it and show as its scripture overview; the margin is the verse's page and store), AGENTS.md (rewritten 2026-11-12: the Python app is no constraint), [questions](questions/README.md) B and Q10 ("the verse's page"), [library](library/README.md), [reading-plans](reading-plans/README.md) | open | AGENTS.md now agrees. Questions B and Q10 read "the verse's page" as the margin: a question asked there is a margin note or goes to a new page, as writing in the margin asks. Moving old notes' places into references is a one-time move, designed first, with the person's go-ahead. |
| Margin notes in the Library | [marks](marks/README.md) M30-M35 (proposed: a section of jots in the Bible's order), [library](library/README.md) S20 (the four pieces: Page, Folder, Save, Library), S21 (one search) | open | Adds a fifth kind beside Page, Folder and Save: the jot, kept in the Bible's order and never filed. Library S20's line needs the person's word to take it. |
| Too many highlights (reading vs study) | [highlights](highlights/README.md) round 2 (a quiet Reading mode, a lens, this year only, fading), [marks](marks/README.md) M36 (the margin's counts), [reader](reader/README.md) R7 (decided: one panel shows or hides every kind of mark) | open | Reading / Study is a reader-wide switch: does it also quiet the margin and thread lines? The lens and layers live in reader R7's one panel. |
| Where questions live | [library](library/README.md), [questions](questions/README.md) | agrees | Settled 2026-11-12: questions are only lines in pages (questions B, as library decided), with one list of them as a view, not a tab. |
| The command box: suggestions | [search](search/README.md) (owner, decided: one box, the command first, then suggestions), [command](command/README.md) A, [findings](findings/README.md) F4 (`!` keeps a finding) | agrees | Command A draws search's decision from the box's side. F4 is one more suggestion row. Its chips (C3) must be search's filters, not a second set. |
| Full screen | [minimize](minimize/README.md) (decided: a pane's full screen, an icon), [command](command/README.md) C5 and [settings](settings/README.md) S3 (the whole app, 0e94) | agrees | Two different things: a pane and the app. Name them apart in the build ("Full screen" and "Full screen (app)"). The app's goes in one place only: the ⋯ (C5) or Settings (S3). |
| A verse opened alone | [reader](reader/README.md) R9 (needs more design), [words](words/README.md) W4 | open | The same part. Merge it into one design (words W4 is the newer drawing). |
| A click on a word | [reader](reader/README.md) (open question), [words](words/README.md) | open | Words assumes a click opens the card. Reader's answer decides it. |
| The lexicons as books | [concordance](concordance/README.md) (owner, decided: BDB and Webster's are books on the rail), [books](books/README.md) A (paging and an index), B (one card with three sources) | agrees | Books A builds concordance's decision. Books B is the card's side, the same as [words](words/README.md) W2. Pick the card in one folder. |
| An index of every Strong's word (b537) | [concordance](concordance/README.md) (Hebrew and Greek tabs), [books](books/README.md) K3 | open | One index or two? It may be the Concordance's own contents. |
| Marks on things other than verses | [highlights](highlights/README.md) (owner of colors), [books](books/README.md) K5 (marking part of a lexicon entry) | open | Uses the same palette. Where the mark is kept follows highlights' file format. |
| The reader's margin | [reader](reader/README.md) C (decided), [questions](questions/README.md) Q3 | agrees | Q3 asks in the margin reader C made; Q10 (round 2) keeps it, writing into the verse's page. |
| Templates: pages and documents | library/Notebook templates (`wb template`), [documents](documents/README.md) D2 (a document builder), [help](help/README.md) (76bf: template help unclear) | open | Is a document build a kind of page template? One builder would serve both. |
| Today's page | [library](library/README.md) (decided: Today is optional), [reading-plans](reading-plans/README.md) (the day's checklist), [questions](questions/README.md) B (placeless questions go in today's page) | open | Questions B (chosen) puts a placeless question in today's page, but library made Today optional; questions round 2 draws two answers that never need Today (Q8 the page in front, Q9 a Questions page). |
| What was written about a chapter | [reading-plans](reading-plans/README.md) R13 (decided: the map is in the Library), [library](library/README.md) | agrees | Reading-plans owns the map, and library hosts it. |
| Settings and the ⋯ | [settings](settings/README.md), [command](command/README.md) C5 (the ⋯ holds layout, theme, Settings), [minimize](minimize/README.md) (a Settings gear on the rail) | open | Settings opens from two places, the gear and the ⋯. Pick one, or make them the same menu. |
| Saved views / "a saved list" | [settings](settings/README.md) S5 (renames view), [search](search/README.md), [library](library/README.md), [questions](questions/README.md) Q6 (the questions list as a saved list) | open | A saved list is a search kept in a page. The name should match whatever search and library call kept searches. |
| Layouts | [settings](settings/README.md) S4, [minimize](minimize/README.md) (panes, the trail) | agrees | A layout saves minimize's panes and does not change them. |
| Keys | [settings](settings/README.md) (a Keys tab), [help](help/README.md) H5 | resolved | One menu, two halves (help, 2026-11-13): Keys is Help's section of the Settings menu; Settings has none of its own. |
| Help beside a part | [help](help/README.md) H4 (a ? in each pane's head), [minimize](minimize/README.md) (folder-strip actions) | open | One more icon in every tab strip. Minimize decides if there is room. |
| Tabs' look | [minimize](minimize/README.md) (decided: folder tabs everywhere) | owner | Every board drawn after 2026-11-11 should use folder tabs. Kit.py's panes do (`M.pane`). |
| Documents' Present | [minimize](minimize/README.md) (decided: Present for documents only), [documents](documents/README.md) D3 | agrees | |
| Finding attachments and the pane | [findings](findings/README.md) | — | Drawn by findings only. |
