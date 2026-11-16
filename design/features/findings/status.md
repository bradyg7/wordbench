# Where each finding stands (checked 2026-11-13)

Checked against the code on `bea541a` and the design folders. Every design folder is still **exploring** (round 1
drawn, none reviewed), so nothing below can be built further until the person accepts that folder's direction.

## Built: confirm in the app, then mark handled

| Finding | What is in the code |
|---|---|
| 707d | The findings box moves by its head and opens where it was last left (`ui/src/findings.ts`) |
| 0ade | Delete All… for pages, with a preview first (`ui/src/notebook.ts`) |
| d2a1 | A block's grab handle shows only on hover (`.nb-block:hover > .nb-grip`) |
| 252c, 1bad | The command field suggests commands as you type, in groups (`ui/src/command.ts`) |
| fe4d (half) | Tags on findings are built; the states (seen, designed, coming soon, finished) are not |
| b737 (half) | File attachments on findings are built; right-click on pages in the Notebook is not |

## Partly built: the rest belongs to a design folder

| Finding | Built | Missing |
|---|---|---|
| bd7b | an `undo` command for the last write | Ctrl+Z and the usual editor keys inside a page (library) |
| 0e94 | Enter fullscreen in the dock menu | a plain app-fullscreen button in settings (command, settings) |
| 2c00 | Open in a new tab | the verse is not selected in the new reader (reader) |
| 6bb0, e31a | KJV italics in their own ink | gray in night mode; a theme option for colour, bold, underline (settings) |
| cd59 | scrollbars follow the theme | thin, hidden when idle, no arrows (settings) |
| 66b8 | Webster's 1913 is built (`wb word-define`) | the word card still says "waits for the source you choose" (books) |

## Needs the person's answer

| Finding | Why |
|---|---|
| cf09 | "Deletes should just be destroyed" conflicts with the decisions of 2026-11-03 (erased after 7 days) and 2026-11-04 (Erase now). Which stands? |
| 9e35, 6b66 | Written after the tagging; both are about the interlinear and a word's card. Tag them words (and concordance)? |

## Waiting on a design review (everything else)

| Folder | Findings |
|---|---|
| library | ad58, 929e, 6ed1, 4463, 1d0e, 23f1, bd54, 64c7, c301, f990, 2c9c, c940, 65b1, 6e30, f126, 9b88, 0960, 6659, b91a, c43b, 95db, 5f45, 9413 |
| words | 94a1, dfce, 149b, 2bc9, ebdf, efc3, 2cd1 |
| reader | 94a1, b59b, 605c, 32be, 64f0, 5a80, dc65 |
| threads | 38c2, 7d00, 4c02, d84d, d0d0, c9c3 |
| command | bc42, 8353, 36d7, c9a2, 3a9f, c567 |
| highlights | 0590, b99f, 64f0, ad4c, 31da |
| marks | 240e, 5a80, b91a, ed73, 95db |
| minimize | c301, f54e, 7e04, 9413, c43b, c9a2 |
| reading-plans | 2dcf, 7cef, bad6, 540e |
| books | b537, ea54, 2cd1, f73d |
| documents | a148, 868e, 2089 |
| settings | e09e, 25c6 |
| help | 0050, 76bf |
| trash | 9ed7 |
| questions | c7ab, 38c2, 7d00 |
| search | 149b, 8353, a9d5 |
