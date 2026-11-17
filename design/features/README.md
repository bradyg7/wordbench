# Feature designs

Each feature of the app is designed in its own folder here, in rounds of FigCraft sheets the person reviews. A folder
is written so that a person or an AI can build the feature from it without the conversation that made it.

| Folder | Feature | State | Last round | Readiness |
|---|---|---|---|---|
| [panels](panels/README.md) | The panel template: bands, a tab's top, buttons, text roles | Accepted (2026-11-16) | 2026-11-16 | not assessed |
| [minimize](minimize/README.md) | Minimized panes, full screen, the side rail, the trail | Rail and trail accepted to build (2026-11-13); the rest exploring | 2026-11-13 | not assessed |
| [concordance](concordance/README.md) | The Concordance: the printed Strong's as a book (English, Hebrew, Greek, Interlinear) | Rounds 1-4 reviewed; direction settled 2026-11-16; the real conditions drawn (C15-C20); round 4's decisions drawn (C21-C25); exploring | 2026-11-16 | likely finished (2026-11-16, fifth pass): all ten checks pass; the person looks at C22, C21, C23-C25 then C19, C20, C15-C18, C8 to accept (C-9, C-11, C-12 are inferences; the back button is designed for every tab in tab-history) |
| [tab-history](tab-history/README.md) | Going back inside a tab: a back button in every tab that goes back through the tab's own history; a new tab copies it | Seeded 2026-11-16 from the person's round 3 and 4 words; nothing drawn; exploring | 2026-11-16 | unfinished (2026-11-16): no sheets, no build list; holds only what the person said |
| [library](library/README.md) | The Notebook and the Shelf as one library; what keeping (a bookmark) means | Rounds 1-4 drawn; round 4 leads by L-9 (not reviewed by the person); exploring | 2026-11-16 | likely finished (2026-11-16, the Notebook pass): all ten checks pass; L-9 to L-20 are inferences; formats are "Needs the person" 1-5; the person looks at S25, S28, S29, S26, S27, S31, S32, S30, S33-S36, then rounds 1-3 |
| [threads](threads/README.md) | Threads beside Page, Folder, Save and Library: a thread is a folder with a color | Round 2 drawn (A alone, the real conditions); exploring | 2026-11-16 | likely finished (2026-11-16, the Notebook pass): all ten checks pass; TH-1 changes the thread model, so the person answers "Needs the person" 1 first, then looks at T1, T2, T7, T8-T11 |
| [reader](reader/README.md) | The Reader: click, right click and selection; marks over the text or in a margin; a second reader; a verse alone | Round 2 drawn; exploring | 2026-11-11 | not assessed |
| [reading-plans](reading-plans/README.md) | Reading plans: the plan leading the reader, the day as a checklist, starting from a kind, what was read as a whole | Round 2 drawn; exploring | 2026-11-11 | not assessed |
| [search](search/README.md) | Search: filters you click, one box for everything, counts by book as the filter | Round 2 drawn; exploring | 2026-11-11 | not assessed |
| [highlights](highlights/README.md) | Highlights and the palette: colors with names, layers by year with an eye each, a light and a dark form for every color; when everything is colored | Rounds 1-2 drawn; exploring | 2026-11-12 | not assessed |
| [books](books/README.md) | BDB and Webster's 1913 as books: paging, an index, one card with three sources | Round 1 drawn; exploring | 2026-11-12 | not assessed |
| [command](command/README.md) | The top bar and the command box: the trail under the bar, the box keeps its line; suggestions | Round 2 accepted; building | 2026-11-13 | not assessed |
| [words](words/README.md) | The word sheet, the verse sheet and the hover card | Round 1 reviewed: B chosen; the real conditions drawn (W6-W11); exploring | 2026-11-16 | likely finished (2026-11-16, fourth pass): all ten checks pass; the person looks at W4-W11 to accept |
| [marks](marks/README.md) | Marks: lines on the words, the margin as the verse's store, margin notes and pages, Scripture in this page, a passage with its marks | Rounds 1-6 drawn; rounds 2-5 decided by the overseer (MK-1 to MK-16); exploring | 2026-11-16 | likely finished (2026-11-16, the Notebook pass): all ten checks pass; nothing built before "Needs the person" 1 (the margin's files); the person looks at M26, M25, M27, M28, M32-M35, M30, M31, M22, M23, M13-M15, M6, M7, M21, then the real conditions |
| [questions](questions/README.md) | Questions: lines in pages or margin notes, one list with two doors; asking and answering | Rounds 1-3 drawn; exploring | 2026-11-16 | likely finished (2026-11-16, the Notebook pass): all ten checks pass; QN-1 to QN-7 are inferences; the person looks at Q4, Q5, Q6, Q8, then Q12-Q15 |
| [documents](documents/README.md) | Lessons and documents: a builder from a page, the viewer, Looks | Rounds 1-2 drawn; exploring | 2026-11-16 | likely finished (2026-11-16, the Notebook pass): all ten checks pass; DC-1 to DC-10 are inferences; the person looks at D2, D11, D6, D3, D4, D5, then D7-D10 |
| [trash](trash/README.md) | Trash: a timed Undo, then 7 days; Empty trash; deleting several pages | Accepted (rounds 1-2, 2026-11-13), built `4f4f4d0`; round 3 (T10-T14) for the person's look | 2026-11-16 | likely finished (2026-11-16, the Notebook pass): all ten checks pass; TR-1 to TR-4 are inferences; the person looks at T10, then T14, T11, T12, T13 |
| [findings](findings/README.md) | Findings: a small movable box, the pane, `!` in the field | Round 1 drawn; exploring | 2026-11-12 | not assessed |
| [settings](settings/README.md) | Settings, layouts and views: italic words, scroll bars, layouts as pictures | Round 1 drawn; exploring | 2026-11-12 | not assessed |
| [help](help/README.md) | Help: the Guide as cards, commands to try, keys on a keyboard | Round 1 drawn; exploring | 2026-11-12 | not assessed |
Every general feature, button and command is designed here before it is built; [coverage.md](coverage.md) lists
every area of the app and the folder that designs it; [overlaps.md](overlaps.md) lists the parts several folders draw, and
which directions conflict. The round-1 folders of 2026-11-12 share [kit.py](kit.py) for their sheets.

Readiness is the overseer's mark from [ready-criteria.md](ready-criteria.md): *unfinished* (with the failing checks) or *likely finished*; it is never *accepted*, which only the person says.

State is one of: *exploring* (rounds being drawn), *accepted* (the person accepted the design; ready to build),
*building*, *built* (link the commit or spec section), *dropped*.

## Keeping folders small: the leading design (the person, 2026-11-12)

A folder's board, and the PDF made from it, hold only its **leading** windows: the ones that still stand for a part of the
feature. When a later window replaces an earlier one, the earlier one leaves the board (cut from the script, or listed in the script's `DROP`
list for the older scripts whose rounds share helpers: [lead.py](lead.py)), and
gets one line in the README's **Leading design** table (what replaced it). Before a trim, the folder is committed, so
every earlier window stays in git history and can be drawn again from there. The board is grouped by part, not by
round, so it never needs deep zoom. The script exports the board as one vector PDF, `<feature>.pdf`, in the board's order: its text stays sharp at any zoom and can be searched, and there are no PNGs. Window numbers
never change or get reused, so a window named in a decision is always the same one.

## Every design is drawn in the real conditions (the person, 2026-11-13)

A window drawn alone on an empty desk hides what goes wrong. Before a folder can be accepted, its board shows the
part in each of these, and its "What the build must satisfy" checks each in the app:

1. **Among other tabs:** opened while the reader and other panes are open (a tab beside others in a pane).
2. **As a floating tab:** popped out over the reader, at a small size.
3. **Narrow:** in a side pane or at phone width.
4. **Years of study:** with a study the size of years of daily use (hundreds of pages, many threads, highlights,
   layouts and kept commands), not a handful of samples. Tests use a generated scratch study of that size, never the
   person's real folder.

## A design choice is not a setting (the person, 2026-11-13)

A setting is something a person would really want different from someone else (text size, a layout, a key). How the
app is drawn (scroll bars, spacing, the shape of a control) is decided once, in the design, for the whole app, and is
not made a toggle.

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
