# Feature designs

Each feature of the app is designed in its own folder here, in rounds of FigCraft sheets the person reviews. A folder
is written so that a person or an AI can build the feature from it without the conversation that made it.

| Folder | Feature | State | Last round |
|---|---|---|---|
| [minimize](minimize/README.md) | Minimized panes, full screen, the side rail, the trail | Rounds 1-6 drawn; not accepted | 2026-11-11 |
| [concordance](concordance/README.md) | The Concordance: the printed Strong's as a book (English, Hebrew, Greek, Interlinear) | Rounds 1-2 drawn; exploring | 2026-11-11 |
| [library](library/README.md) | The Notebook and the Shelf as one library; what keeping (a bookmark) means | Rounds 1-3 drawn; exploring | 2026-11-11 |
| [threads](threads/README.md) | Threads beside Page, Folder, Save and Library: legacy, or a role of their own | Round 2 drawn; exploring | 2026-11-11 |
| [reader](reader/README.md) | The Reader: click, right click and selection; marks over the text or in a margin; a second reader; a verse alone | Round 2 drawn; exploring | 2026-11-11 |
| [reading-plans](reading-plans/README.md) | Reading plans: the plan leading the reader, the day as a checklist, starting from a kind, what was read as a whole | Round 2 drawn; exploring | 2026-11-11 |
| [search](search/README.md) | Search: filters you click, one box for everything, counts by book as the filter | Round 2 drawn; exploring | 2026-11-11 |
| [highlights](highlights/README.md) | Highlights and the palette: colors with names, layers by year with an eye each, a light and a dark form for every color; when everything is colored | Rounds 1-2 drawn; exploring | 2026-11-12 |
| [books](books/README.md) | BDB and Webster's 1913 as books: paging, an index, one card with three sources | Round 1 drawn; exploring | 2026-11-12 |
| [command](command/README.md) | The top bar and the command box: suggestions, kept commands, the ⋯ | Round 1 drawn; exploring | 2026-11-12 |
| [words](words/README.md) | The word sheet, the verse sheet and the hover card | Round 1 drawn; exploring | 2026-11-12 |
| [marks](marks/README.md) | Marks: the two layers on the text, the margin as a view of pages and saves, a passage with its marks | Round 1 drawn; exploring | 2026-11-12 |
| [questions](questions/README.md) | Questions: one list or lines in pages; asking and answering | Round 1 drawn; exploring | 2026-11-12 |
| [documents](documents/README.md) | Lessons and documents: a builder from a page, the viewer, Looks | Round 1 drawn; exploring | 2026-11-12 |
| [trash](trash/README.md) | Trash: Undo only, or the 7 days kept; deleting several pages | Round 1 drawn; exploring | 2026-11-12 |
| [findings](findings/README.md) | Findings: a small movable box, the pane, `!` in the field | Round 1 drawn; exploring | 2026-11-12 |
| [settings](settings/README.md) | Settings, layouts and views: italic words, scroll bars, layouts as pictures | Round 1 drawn; exploring | 2026-11-12 |
| [help](help/README.md) | Help: the Guide as cards, commands to try, keys on a keyboard | Round 1 drawn; exploring | 2026-11-12 |
Every general feature, button and command is designed here before it is built; [coverage.md](coverage.md) lists
every area of the app and the folder that designs it; [overlaps.md](overlaps.md) lists the parts several folders draw, and
which directions conflict. The round-1 folders of 2026-11-12 share [kit.py](kit.py) for their sheets.

State is one of: *exploring* (rounds being drawn), *accepted* (the person accepted the design; ready to build),
*building*, *built* (link the commit or spec section), *dropped*.

## Keeping folders small: the leading design (the person, 2026-11-12)

A folder's board, and the PDF made from it, hold only its **leading** windows: the ones that still stand for a part of the
feature. When a later window replaces an earlier one, the earlier one leaves the script and the board, and
gets one line in the README's **Leading design** table (what replaced it). Before a trim, the folder is committed, so
every earlier window stays in git history and can be drawn again from there. The board is grouped by part, not by
round, so it never needs deep zoom. The script exports the board as one vector PDF, `<feature>.pdf`, in the board's order: its text stays sharp at any zoom and can be searched, and there are no PNGs. Window numbers
never change or get reused, so a window named in a decision is always the same one.

## A folder

```
design/features/<feature>/
  README.md          decisions (dated), open questions, rounds, what the build must satisfy
  <feature>.py       the FigCraft source script (imports figlib, parts, build, phase2b from design/)
  <feature>.figcraft written by the script; open it in FigCraft
  <feature>.pdf      written by the script: the board as one vector PDF, in part order
  data/*.json        lookups the sheets show (scripture, concordance, lexicon), fetched from the database with wb,
                     never typed; say in the README which command made each one
```

Run a feature's script from the repo root: `python design/features/<feature>/<feature>.py`. Its intermediate
step files go to `design/build/` (ignored by git), as for the older boards.

Start a new feature by copying [`_template/`](_template/README.md). The shared helpers (`figlib.py`, `parts.py`,
`build.py`, `phase2b.py`, `fonts/`) stay in `design/`; the boards made before this folder existed (`build.py`,
`phase2b.py`, `r1.py`-`r4.py`, `workspace.py`, `filter.py`) stay where they are.
