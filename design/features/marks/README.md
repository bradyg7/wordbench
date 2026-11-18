# Marks

**State:** exploring, round 7 (a fresh start, 2026-11-18). Table first, then sheets. Rounds 1 to 6 (accepted
2026-11-17, built badly) are kept for history in [archive/](archive/rounds-1-6-README.md); what still holds is carried
into the decisions below by name. Objects and words: [the Library map](../../LIBRARY.md).

A mark is anything the person puts **on the Bible text**: the paper habits of a study Bible (highlighting, underlining,
circling, boxing, drawing an arrow, writing in the margin), with unlimited room, every mark findable, and a legend that
says what each one means.

## Decisions (the person, 2026-11-18)

| # | Decision | From |
|---|---|---|
| MK7-1 | **The kinds of mark:** highlight; underline (single, double, triple); circle; box; arrow; margin note. "Pencil" is retired as a word: it is an underline. | the person, 2026-11-18 |
| MK7-2 | **A mark's look is a *style*: its kind plus its color** (plus, for an underline, how many lines). Any color is allowed, for every kind. | the person; Library map, Open 2 |
| MK7-3 | **The legend gives meaning to a style** ("yellow highlight = promise", "red double underline = warning"). The same color can mean different things on different kinds. A mark in a style with no legend entry is still a mark. | the person, 2026-11-18 |
| MK7-4 | **Table first, then sheets.** This folder's interaction table is drafted and reviewed before anything is drawn. | the person, 2026-11-18 |
| MK7-5 | **The code built from rounds 1 to 6 is archived, not reshaped** (`margin.rs`, `pencil.rs`, the margin UI). The first ticket of the build removes it from the app; what the person wrote with it is read and moved forward (see Disk). | the person, 2026-11-18 ("it basically did nothing right") |
| MK7-6 | **A margin note can cover a verse or any span of verses**, as the drawn marks can. | the person, 2026-11-18 (Library map) |
| MK7-7 | **A folder's color is not a mark.** A folder's color shows where that folder's things are; a mark is drawn on the text. The two are drawn differently, so a black underline and a black folder never look alike. | Library map, Open 2 |

**Kept from rounds 1 to 6** (each still the person's): the margin never prompts or suggests (MK-10); a margin note can
grow into a page and stays in the margin, saying so (MK-8); a question written in a margin note is found like any
question (MK-11, now the Library map's Question); speed: opening a chapter never reads page files (MK-14); delete is
recoverable (MK-21); every mark keeps the date it was made (MK-19).

**Not a mark, kept for later:** a personal cross-reference graph, the person's own links between scriptures (the
Library map, Later). The arrow here links two places on the text; it does not build that graph.

## The leading design (proposed, for the person's review)

- **Making a mark is one gesture.** Select words (or click a verse number for the whole verse; shift-click for a span),
  and the **mark bar** appears just above the selection, never over the verse being read. It holds the six kinds, then
  the legend's styles as named chips, the most used first. One click on a legend chip makes that mark. Keys do the same
  with the bar open: H highlight, U underline, C circle, B box, A arrow, N margin note, 1 to 9 the legend's chips.
- **The color is near-instant.** After a kind, the bar shows the last colors used and a full picker; the last style
  used is one key (the same key again).
- **The legend** is a short list the person keeps: each entry is a style and a name, optionally a line of meaning.
  It is reached from the mark bar ("Legend…"), from Settings, and from the marks panel. Making a mark in a new style
  offers "Name this style" in the bar, once, and never again for that style if dismissed.
- **Layers stay readable.** The reader's marks panel shows or hides marks by kind, by legend entry, or all at once
  (Reading mode: the plain text). Where marks overlap on the same words they are drawn in a fixed order: highlight
  beneath, then box and circle, then underlines (one line per underline, up to three lines tall), then arrows above.
- **The margin** shows, beside a verse, a small sign for each margin note that covers it; a click opens the note there.
  A note covering a span draws a thin bracket beside its verses.
- **An arrow** starts at a selection and ends at a second selection, in the same chapter (drawn) or another (drawn as a
  short arrow to a label naming the place; a click follows it, and Back returns to the verse it came from).
- **Every mark is findable:** the Library's one search finds marks by kind, color, legend entry, book or date; a verse's
  card lists every mark on it.

## Interaction table (draft 1)

Window tags (R = reader, B = mark bar, L = legend, P = marks panel, M = margin) are placeholders until the sheets are
drawn. `Test` names the kind of test: **rust** (wb-core), **wb** (the command), **ui** (Playwright WebKit), **app** (the
real app). `Built` is ticked only when the test passes.

### Making marks

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | R | Select words in a verse | The mark bar above the selection: six kinds, the legend's chips, "Legend…" | nothing | | ui | [ ] |
| 2 | R | Click a verse number | The whole verse is selected; the bar appears | nothing | | ui | [ ] |
| 3 | R | Shift-click a second verse number | The span between is selected (across chapters within one book); the bar appears | nothing | | ui | [ ] |
| 4 | B | Click a legend chip | The mark is drawn at once in that style; the bar closes; the selection clears | mark added to `marks/<BOOK>.json` | `wb mark add <ref> --style <legend name>` | wb, ui | [ ] |
| 5 | B | Click Highlight | The bar shows the last colors and the picker | nothing | | ui | [ ] |
| 6 | B | Pick a color | The highlight is drawn; the bar closes | mark added | `wb mark add <ref> --kind highlight --color <c>` | wb, ui | [ ] |
| 7 | B | Click Underline | As 5, plus single / double / triple | nothing | | ui | [ ] |
| 8 | B | Pick lines and color | The underline is drawn | mark added | `wb mark add <ref> --kind underline --lines 2 --color <c>` | wb, ui | [ ] |
| 9 | B | Click Circle or Box, pick a color | A ring or box around the selected words | mark added | `--kind circle\|box` | wb, ui | [ ] |
| 10 | B | Click Arrow | "Now select where it points"; the bar shrinks to Cancel | nothing | | ui | [ ] |
| 11 | R | Select the target (same chapter) | The arrow is drawn between the two | mark added (from, to) | `wb mark add <from> --kind arrow --to <ref>` | wb, ui | [ ] |
| 12 | R | Go to another chapter and select the target | The arrow is drawn at the start as a short arrow to a label naming the target; the reader returns to the start | mark added | as 11 | ui | [ ] |
| 13 | B | Click Margin note | The margin opens beside the selected verse(s) with an empty note, the cursor in it | nothing until text is typed | | ui | [ ] |
| 14 | M | Type, then click away or press Esc | The note is kept; its sign shows beside the verse(s) | note written to `margin/<BOOK>/<chapter>.md` | `wb mark note <ref> "text"` | wb, ui | [ ] |
| 15 | B | Press H, U, C, B, A, N | As clicking that kind | | | ui | [ ] |
| 16 | B | Press 1 to 9 | As clicking that legend chip | as 4 | | ui | [ ] |
| 17 | B | Press the kind's key again | The last style used for that kind is applied | as 4 | | ui | [ ] |
| 18 | B | A mark in a style with no legend entry | One line in the bar: "Name this style?" with a field; Esc dismisses it for that style for good | legend entry if named | `wb legend add` | ui | [ ] |
| 19 | B | Esc, or click outside | The bar closes; nothing is made | nothing | | ui | [ ] |

### Changing and removing

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 20 | R | Click a mark | A small card: its style, legend name, date, and Change style, Delete; for a note, its text | nothing | `wb mark show <id>` | wb, ui | [ ] |
| 21 | R | Click words with several marks | The card lists every mark there, topmost first | nothing | `wb mark at <ref>` | wb, ui | [ ] |
| 22 | card | Change style | The bar opens on that mark; a pick restyles it | mark updated, date kept, `changed` added | `wb mark style <id> ...` | wb, ui | [ ] |
| 23 | card | Delete | The mark goes; "Mark deleted · Undo" for 10 seconds | mark moved to the trash, recoverable | `wb mark rm <id>`, `wb mark restore <id>` | wb, ui | [ ] |
| 24 | M | Edit a note's text | Saved as typed | note rewritten, `changed` date | `wb mark note <id> --text` | wb, ui | [ ] |
| 25 | M | Note menu: Grow into a page | A page opens holding the note; the note stays, with "grew into <page>" | page made; note gains its link | `wb mark grow <id>` | wb, ui | [ ] |
| 26 | R | Select words over existing marks | The bar as in 1; a new mark is added on top, nothing replaced | | | ui | [ ] |

### The legend

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 27 | B, Settings, P | Open Legend… | The list of entries: a sample of each style, its name, its meaning, how many marks use it | nothing | `wb legend` | wb, ui | [ ] |
| 28 | L | Add | A row: pick kind, color (and lines), type a name | `settings/legend.json` | `wb legend add --kind --color --name` | wb, ui | [ ] |
| 29 | L | Rename or edit meaning | Saved as typed; every mark in that style now shows the new name | legend entry updated | `wb legend set` | wb, ui | [ ] |
| 30 | L | Change an entry's color | Asks: "Change the 40 marks in this style too?" Yes restyles them; No keeps them and the entry only | entry (and marks) updated | `wb legend set --restyle` | wb, ui | [ ] |
| 31 | L | Drag to reorder | The bar's chips follow the order | entry order | `wb legend move` | ui | [ ] |
| 32 | L | Remove an entry | Its marks stay, as an unnamed style | entry removed | `wb legend rm` | wb, ui | [ ] |
| 33 | L | Click an entry's count | The Library's search opens on marks in that style | nothing | `wb find --style` | ui | [ ] |

### Seeing marks

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 34 | R | Open a chapter | Every shown mark drawn in the fixed layer order; margin signs beside verses | nothing (no page files read) | `wb marks <chapter>` | rust, app (speed) | [ ] |
| 35 | P | Toggle a kind | Marks of that kind hide or show | `settings/marks.json` | `wb settings marks` | ui | [ ] |
| 36 | P | Toggle a legend entry | Marks in that style hide or show | as 35 | as 35 | ui | [ ] |
| 37 | P | Reading mode | Only the text; one line says marks are hidden, with Show | as 35 | as 35 | ui | [ ] |
| 38 | R | Hover a mark | Its legend name, if any | nothing | | ui | [ ] |
| 39 | R | Click an arrow's label | The reader goes to the target; Back returns to the arrow's verse | trail step | | ui | [ ] |
| 40 | R | A chapter with years of marks (generated) | Readable: layers in order, underlines stacked, no mark hides the words | nothing | | app | [ ] |
| 41 | R | Narrow window | The bar wraps to two rows; the margin opens as a sheet below the verse | nothing | | ui | [ ] |

### Finding marks

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 42 | Library search | Filter by mark: kind, color, legend entry, book, date | Matching marks, each with its words and reference; a click opens the reader there | nothing | `wb find --kind mark --style <name> --book <b>` | wb, ui | [ ] |
| 43 | Library search | Type words | Margin notes' text is searched with pages | nothing | `wb find <words>` | wb | [ ] |
| 44 | verse card | Open a verse's card | Every mark on that verse, and the margin notes covering it | nothing | `wb mark at <ref>` | wb, ui | [ ] |

### Disk and moving forward

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 45 | | Open a study folder with `highlights/*.json` | Every old highlight shows as a highlight in its color | nothing until the move | | rust | [ ] |
| 46 | | The move (once, after a backup, with the person's go-ahead) | `wb study check` lists what will move first; afterwards every old highlight is a mark with its id, color, words and date | `highlights/` read into `marks/`; old files kept in `.archive/` | `wb study move-marks --dry-run` then `--go` | rust, wb | [ ] |
| 47 | | Delete a mark, then Empty trash after 7 days | Gone for good only then | | `wb trash` | rust | [ ] |

## Disk (proposed)

- **Drawn marks:** `marks/<BOOK>.json`, one file per book: each mark `{id, kind, color, lines?, at, to?, created, changed?}`,
  where `at` and `to` are anchors (`NUM.25:11.3-25:11.9`: verse and word positions, as highlights use today).
- **Margin notes:** `margin/<BOOK>/<chapter>.md`, readable Markdown, each note under a line naming its verse or span,
  with its id and dates. A span across chapters is kept in the chapter where it starts.
- **The legend:** `settings/legend.json`, entries in order: `{kind, color, lines?, name, meaning?}`.
- **Today's 26 highlight files** are read as they are until the move (row 46).

## Open questions (for the person)

1. **The mark bar's place.** Above the selection (proposed), or fixed at the top of the reader?
2. **Arrow across chapters.** Drawn as a short arrow to a label (proposed), or not allowed until the cross-reference
   graph is designed?
3. **Colors.** Any color from a full picker (decided), but should the bar offer a fixed starter set of, say, 8 colors
   first, so no one has to choose from millions?
4. **Margin notes across chapters.** Allowed (kept where they start, proposed), or one chapter at most as before
   (MK-20)?
5. **The whole-Bible color view** (Library map): part of this folder, or its own later folder?

## Rounds

| Round | Date | What | Review |
|---|---|---|---|
| 1 to 6 | to 2026-11-17 | see [archive](archive/rounds-1-6-README.md) | accepted, then built badly |
| 7 | 2026-11-18 | fresh start: decisions MK7-1 to MK7-7, interaction table draft 1 | waiting for the person |
