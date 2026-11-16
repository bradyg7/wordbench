# Design coverage

Every general feature, button and command of the app has a planned design before it is built (the person,
2026-11-11; the rule is in `AGENTS.md`). This list is every area of the app and the folder that designs it.
A new button or command gets a row here, and its folder, before it is built.

**Design** is the folder under `design/features/`, or — when none exists yet. **State** is the folder's state
(see [the index](README.md)). Where folders draw the same part, [overlaps.md](overlaps.md) says whether they agree or conflict. Things built before 2026-11-11 were designed in the older boards (`design/*.py`,
`docs/archive/`); they get a folder when they are next changed, not before.

## The window

| Area | Buttons and parts | Design | State |
|---|---|---|---|
| What every panel looks like | a tab's top, the way back, buttons, text roles, foot | [panels](panels/README.md) | accepted |
| Panes, tabs, minimizing, full screen | tab strips, minimize, Full screen, Present | [minimize](minimize/README.md) | accepted (round 7; Present exploring) |
| The side rail | one icon per kind of pane, its menus, Show names | [minimize](minimize/README.md) | building (the rail; its menus exploring) |
| The trail (history of tabs) | drawer, line under the top bar | [minimize](minimize/README.md), [command](command/README.md) C13-C16 | building |
| The Concordance | English, Hebrew, Greek, Interlinear | [concordance](concordance/README.md) | exploring |
| BDB and Webster's 1913 as books | paging, the index, one card with three sources | [books](books/README.md) | exploring |
| Top bar and the command box | the box keeps its line and pops off, the reader's tools at its end, More; suggestions (round 1) | [command](command/README.md) | round 2 merged; round 3 (⋯ into Settings, kept commands on the rail, suggestions) to draw |
| Reader | verses, versions, marks, selection | [reader](reader/README.md) | exploring |
| Word sheet, verse sheet, hover card | a card that moves, a verse alone, hover | [words](words/README.md) | exploring |
| Highlights and the palette | colors with names, layers by year, light and dark forms | [highlights](highlights/README.md) | exploring |
| Notebook: pages, Pinned, blocks | folders, the library drawer | [library](library/README.md) | exploring |
| Shelf and sets, bookmarks (Keep) | Keep on anything, the folder picker, a folder opened | [library](library/README.md) | exploring |
| Threads | a thread as a colored folder (A), a page with Places (B), or a layer (C) | [threads](threads/README.md) | exploring |
| Marks: what the text shows of yours | on the words, in the margin, a passage with its marks | [marks](marks/README.md) | exploring |
| Questions | asking, the list, answering | [questions](questions/README.md) | exploring |
| Day page, journal, inbox | Today optional; Inbox removed (minimize round 5) | [library](library/README.md) | exploring |
| Search, uses, count, near, forms | asking and narrowing a search | [search](search/README.md) | exploring |
| Reading plans and the reading log | a plan's day, starting a plan, what was read | [reading-plans](reading-plans/README.md) | exploring |
| Lessons and documents (Word, PDF, Present) | the builder, the viewer, Looks | [documents](documents/README.md) | exploring |
| Trash | Undo, the 7 days, Empty trash, the way in, deleting a block | [trash](trash/README.md) | accepted |
| Updates | the notice that a new version is ready, what changed, install and restart | [updates](updates/README.md) | exploring |
| Findings | the box, the pane, `!` in the field | [findings](findings/README.md) | accepted |
| Settings, layout, views | italic words, scroll bars, layouts, saved lists | [settings](settings/README.md) | accepted |
| Help, guide, manual | Guide cards, commands to try, keys | [help](help/README.md) | accepted |
| Phone | (deferred until the desktop is finished) | — | |

## `wb` commands

The terminal side of each area above; a command is designed with the area whose action it reaches. Families from
`wb help` on 2026-11-11:

| Commands | Area | Design |
|---|---|---|
| `text`, `scripture`, `copy`, `chapter`, `reader`, `books`, `refs`, `parse` | Reader | [reader](reader/README.md) |
| `preview`, `word`, `verse`, `anchor`, `fixture` | Word sheet, verse sheet, hover card | [words](words/README.md) |
| `strong`, `bdb`, `define`, `lexiconc`, `interlinear`, `word-define` | Concordance, BDB, Webster's | [concordance](concordance/README.md), [books](books/README.md) |
| `search`, `find`, `uses`, `count`, `forms`, `near` | Search | [search](search/README.md) |
| `hl`, `marks`, `palette` | Highlights | [highlights](highlights/README.md) |
| `note`, `page`, `block`, `notebook`, `template` | Notebook | [library](library/README.md) |
| `thread` | Threads | [threads](threads/README.md) |
| `trail`, `question`, `questions` | Questions (`trail` is retired to "question" by [minimize](minimize/README.md)) | [questions](questions/README.md) |
| `day`, `journal`, `inbox` | Day page, journal, inbox | [library](library/README.md) |
| `set`, `shelf` | Shelf and sets | [library](library/README.md) |
| `read`, `plan`, `log` | Reading plans | [reading-plans](reading-plans/README.md) |
| `lesson`, `docs`, `craft` | Lessons and documents | [documents](documents/README.md) |
| `trash` | Trash | [trash](trash/README.md) |
| `finding`, `findings` | Findings | [findings](findings/README.md) |
| `history` | The trail (`trail` is still the old questions) | [minimize](minimize/README.md) |
| `settings`, `layout`, `view` | Settings, layout, views | [settings](settings/README.md) |
| `help`, `guide`, `manual`, `commands` | Help ([command](command/README.md) for kept `commands`) | [help](help/README.md) |
| `status`, `study`, `do` | Not shown in the window (checks and the relay) | not needed |
