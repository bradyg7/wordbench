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

**Round 7, draft 2 (the person's review notes, 2026-11-18):**

| # | Decision | From |
|---|---|---|
| MK7-8 | **Each kind has its own icon in the bar, its name on hover.** The six icons: highlighter (Highlight, H), underline (Underline, U), ring (Circle, C), square (Box, B), arrow (Arrow, A), notepad (Margin note, N). The Legend is its own icon and word in the bar. No kind is a long text button. | the person, row 1, 13 |
| MK7-9 | **The bar does not show every legend chip.** It shows the person's **quick styles** (up to 5, chosen by the person, the most used until they choose), then the Legend icon, which opens the whole legend as a short searchable list right there. The legend grows from the bar: picking a kind and a color is "picking up a new pen", named on the spot. | the person, row 1, 8, 16 |
| MK7-10 | **The legend is visible wherever a color is picked.** Recent styles show their legend names, never bare color dots, so nobody picks a color blindly or gives one a meaning by accident. The picker is a rainbow circle beside the 5 most recent styles. Organization is encouraged from the first mark. | the person, row 5, 8 |
| MK7-11 | **A new style is named as it is made.** Picking a kind and color that no legend entry has puts a name field in the bar, focused. Enter with a name adds the entry; Enter or Esc with none leaves it **Unnamed** (listed in the legend as "Unnamed yellow highlight", nameable later). Unnamed is better than a lost mark. | the person, row 18, 32 |
| MK7-12 | **The selection looks like a browser's text selection**: no handles at its ends, nothing artificial. | the person, row 2 |
| MK7-13 | **A verse span:** click the first verse number, shift-click the last; it may cross chapters within a book. The bar for a span also offers **Open as a passage** (its own reader) and **Add to…** (a page, a folder, a save). | the person, row 3 |
| MK7-14 | **Add to… is in the bar** for any selection: to a page, a folder or a save, as the reader's Add does today. | the person, row 1 |
| MK7-15 | **Underlines thin as they stack:** one line is the thickest; double and triple are thinner lines, so a triple underline never looks heavy. A folder's color is never drawn on the words: it shows as a small tab in the gutter beside the verse (MK7-7), so an underline and a folder never look alike. | the person, row 7 |
| MK7-16 | **Keys:** with the bar open, H U C B A N pick a kind; 1 to 5 the quick styles in bar order; any other style by typing its name in the Legend list. Anywhere in the reader, Ctrl+1 to Ctrl+9 apply styles the person assigns (in the Legend), so a selection and Ctrl+7 can circle it at once. A kind's key pressed twice repeats its last style; the colors stay open after one press, so a different one is one click. | the person, row 8, 15-17 |
| MK7-17 | **The Legend has its own icon on the rail**, replacing today's highlight icon: the legend, each entry's count, and where each style is used. | the person, row 9, 27 |
| MK7-18 | **The margin is a column always beside the text**, marked off by a thin line, like a Bible's margin. Click into it beside a verse to write there; a note may also sit in the chapter's margin without a verse, still shown, searched and read. The margin can be minimized to its **signs** (a small notepad beside each verse with a note); a click on a sign opens the note. The bar's notepad is a shortcut to the same place. | the person, row 13, 34, 41 |
| MK7-19 | **Change replaces, a new mark adds.** On a mark's card, Change restyles that one mark (for a misclick). Selecting the same words again and picking a style adds another mark on top. These are two different gestures. | the person, row 22, 26 |
| MK7-20 | **The mark's card is small and anchored** beside the mark, not draggable, closed by Esc or a click away. Toasts and cards take the person's theme. | the person, row 20, 23 |
| MK7-21 | **A legend entry lists where it is used**, and marks can be removed from that list, one or many (recoverable, as any delete). | the person, row 32, 33 |
| MK7-22 | **The bar keeps fixed sizes.** Two layouts only (wide, narrow), switched at one width; it never stretches or shrinks with each window change. | the person, row 41 |
| MK7-24 | **The mark bar sits above the selection.** | the person, 2026-11-18, open question 1 |
| MK7-25 | **Arrows stay within one chapter.** Linking places across chapters or books is the cross-reference graph's (the Library map, Later), not a mark. While choosing an arrow's target the reader stays in its chapter. | the person, open question 2 |
| MK7-26 | **A new Library starts with an empty legend.** Every entry is the person's own. | the person, open question 3 |
| MK7-27 | **A margin note covers verses of one chapter** for now (it is just a note); across chapters stays a maybe for a later round. | the person, open question 4 |
| MK7-28 | **A margin note is text.** Scripture references and questions in it are found by themselves, as in pages; no headings or blocks; anything bigger grows into a page. Marks on a margin note's own words: deferred to a later round, if wanted. | the person, open question 5 |
| MK7-29 | **The whole-Bible color view is designed here** (sheet F): where each legend style, and each folder's color, appears across the Bible, and its gaps. | the person, open question 6 |
| MK7-30 | **The bar is icons only, one size everywhere** (supersedes the chips of MK7-9, the color row of MK7-10 and the two layouts of MK7-22): the six kinds, the Legend, Add to… (and, for a span, Open as a passage), about 360 px wide, so the same bar fits a phone. A tap on a kind opens a **small drop-down from that icon, on the side away from the selection** (upward when the bar is above it): its named styles (the most recent first, the person's quick styles pinned on top, at most 6 shown), then Any color…; for an underline, 1 / 2 / 3 lines at its top. The Legend icon opens the same drop-down for the whole legend, with a filter. Nothing in the bar grows with the legend. | the person, 2026-11-18 ("clunky and too large… would not migrate over to mobile") |
| MK7-31 | **On a phone** the bar is the same icons (44 px targets) above the selection; the drop-down, the legend, a mark's card and a margin note open as a **bottom sheet**; the margin is always signs at the text's right edge. Keys are a desktop extra. | the person, 2026-11-18 (a mobile design) |
| MK7-23 | **A verse's card is reachable from a page's scripture block** as well as from the reader. | the person, row 44 |

## The leading design (draft 2, for the person's review)

- **Making a mark.** Select words, or click a verse number (shift-click a second for a span). The selection looks like
  a browser's. The **mark bar** appears just above it: the six kind icons, the quick styles (named chips, up to 5), the
  Legend icon, and Add to…. A quick style is one click. A kind icon opens the color row: the 5 recent styles with their
  names, the rainbow picker; a new kind-plus-color asks for its name in the bar (Unnamed if skipped).
- **The legend** lives on the rail (replacing the highlight icon), in the bar (its icon), and grows as pens are picked up.
  Each entry: a sample, a name, an optional meaning, its key (Ctrl+n, optional), whether it is a quick style, its count,
  and where it is used.
- **Layers stay readable.** Drawn in a fixed order: highlight beneath, box and circle, underlines (thinning as they
  stack), arrows on top. The marks panel hides or shows by kind or by legend entry; Reading mode shows plain text.
  Folder colors stay in the gutter, never on the words.
- **The margin** is an open column beside the text, minimizable to signs. Arrows never cross the margin: a cross-chapter
  arrow is a label in the margin's edge, not a line.
- **An arrow** goes from a selection to a second selection in the same chapter, drawn in the gutter beside the verse
  numbers so it never crosses the words or the margin. While choosing the target the bar shows Back (a misclick) and
  Cancel. Across chapters is the cross-reference graph's, later. Arrow line styles (dotted, bold, heads) are later.
- **Every mark is findable:** the Library's search by kind, color, legend entry, book or date; a verse's card lists every
  mark on it, from the reader or a page's scripture block.

**For the sheets to show** (the person asked to see these before accepting): a highlight from selection to legend chip,
step by step; marks over marks (row 26); arrows (next verse, several verses away, crossing, a misclick undone) beside
margin notes; a chapter with years of marks (row 40); the narrow window with the
margin as signs (row 41).

## Interaction table (draft 2)

Window tags (R = reader, B = mark bar, L = legend, P = marks panel, M = margin) are placeholders until the sheets are
drawn. `Test` names the kind of test: **rust** (wb-core), **wb** (the command), **ui** (Playwright WebKit), **app** (the
real app). `Built` is ticked only when the test passes.

### Making marks

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | R | Select words in a verse | A browser-like selection; the mark bar above it, icons only: six kinds (name on hover), the Legend, Add to… | nothing | | ui | [ ] |
| 2 | R | Click a verse number | The whole verse selected, no handles; the bar appears | nothing | | ui | [ ] |
| 3 | R | Click a verse number, then shift-click another | The span between is selected (across chapters within one book); the bar adds Open as a passage | nothing | | ui | [ ] |
| 4 | B | Click a style in a kind's drop-down | The mark is drawn at once; the bar closes; the selection clears | mark added to `marks/<BOOK>.json` | `wb mark add <ref> --style <legend name>` | wb, ui | [ ] |
| 5 | B | Click a kind icon (Highlight, Underline, Circle, Box) | A small drop-down under the icon: that kind's styles by name (quick ones pinned, then recent; 6 at most), Any color…; Underline adds 1 / 2 / 3 at its top | nothing | | ui | [ ] |
| 6 | B | Click a recent style | The mark is drawn in it; the bar closes | mark added | as 4 | wb, ui | [ ] |
| 7 | B | Pick a color in the rainbow picker that no entry has | The mark is drawn; the bar keeps a name field, focused: "Name this pen" | mark added | `wb mark add <ref> --kind <k> --color <c> [--lines n]` | wb, ui | [ ] |
| 8 | B | Type a name, Enter | The entry is added to the legend; the bar closes | entry in `settings/legend.json` | `wb legend add --kind --color --name` | wb, ui | [ ] |
| 9 | B | Enter or Esc with no name | The bar closes; the legend lists it as "Unnamed <color> <kind>" | unnamed entry added | | ui | [ ] |
| 10 | B | Click the Legend icon | The same drop-down for the whole legend, a filter field focused; a click or Enter applies an entry | nothing | | ui | [ ] |
| 11 | B | Click Add to… | A page, a folder or a save, as the reader's Add | as the reader's Add | `wb set add`, `wb page add` (existing) | ui | [ ] |
| 12 | B | Click Open as a passage (a span) | The span opens in its own reader tab; Back returns to the verse | trail step | `wb text <span>` | ui | [ ] |
| 13 | B | Click Arrow | "Select where it points"; the bar shrinks to Back and Cancel | nothing | | ui | [ ] |
| 14 | R | Select the target in the same chapter | The arrow is drawn between them, above the text, never across the margin | mark added (from, to) | `wb mark add <from> --kind arrow --to <ref>` | wb, ui | [ ] |
| 15 | R | While choosing a target, try to leave the chapter | The reader stays; the bar says arrows stay in one chapter | nothing | | ui | [ ] |
| 16 | B | Back while choosing a target | The reader returns to the start, the selection kept, the bar open | nothing | | ui | [ ] |
| 17 | M | Click into the margin beside a verse, or press N / the notepad icon | An empty note there, the cursor in it | nothing until typed | | ui | [ ] |
| 18 | M | Click into the margin away from any verse | A note for the chapter, not tied to a verse | nothing until typed | | ui | [ ] |
| 19 | M | Type, then click away or press Esc | The note is kept; its sign shows | `margin/<BOOK>/<chapter>.md` | `wb mark note <ref\|chapter> "text"` | wb, ui | [ ] |
| 20 | B | Press H, U, C, B, A, N | As clicking that kind (Highlight, Underline, Circle, Box, Arrow, margin Note) | | | ui | [ ] |
| 21 | B | Press 1 to 6 (a drop-down open) | As clicking that row of the drop-down | as 4 | | ui | [ ] |
| 22 | B | Press a kind's key twice | Its last style is applied | as 4 | | ui | [ ] |
| 23 | R | Select, then Ctrl+1 to Ctrl+9 | The style assigned to that key is applied, no bar needed | as 4 | | ui | [ ] |
| 24 | B | Esc, or click outside | The bar closes; nothing is made | nothing | | ui | [ ] |

### Changing and removing

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 25 | R | Click a mark | A small card anchored beside it (not draggable): its style, legend name, date, Change, Delete; for a note, its text | nothing | `wb mark show <id>` | wb, ui | [ ] |
| 26 | R | Click words with several marks | The card lists every mark there, topmost first, each with Change and Delete | nothing | `wb mark at <ref>` | wb, ui | [ ] |
| 27 | card | Change | The color row for that mark; a pick replaces its style (that mark only) | mark updated, date kept, `changed` added | `wb mark style <id> ...` | wb, ui | [ ] |
| 28 | card | Delete | The mark goes; a toast in the theme's colors: "Mark deleted · Undo", 10 seconds | moved to the trash, recoverable | `wb mark rm <id>`, `wb mark restore <id>` | wb, ui | [ ] |
| 29 | M | Edit a note's text | Saved as typed | note rewritten, `changed` date | `wb mark note <id> --text` | wb, ui | [ ] |
| 30 | M | Note menu: Grow into a page | A page opens holding the note; the note stays, with "grew into <page>" | page made; note gains its link | `wb mark grow <id>` | wb, ui | [ ] |
| 31 | R | Select words that already have marks, pick a style | A new mark is added on top; nothing replaced | mark added | as 4 | ui | [ ] |

### The legend

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 32 | rail | Click the Legend icon (replaces the highlight icon) | The legend: each entry's sample, name, meaning, key, quick-style pin, count | nothing | `wb legend` | wb, ui | [ ] |
| 33 | L | Add | A row: pick kind, color (and lines), type a name | `settings/legend.json` | `wb legend add` | wb, ui | [ ] |
| 34 | L | Rename or edit meaning | Every mark in that style shows the new name | entry updated | `wb legend set` | wb, ui | [ ] |
| 35 | L | Change an entry's color | "Change the 40 marks in this style too?" Yes restyles them; No changes the entry only | entry (and marks) | `wb legend set --restyle` | wb, ui | [ ] |
| 36 | L | Pin or unpin as a quick style | The bar's quick styles follow (5 at most; a sixth asks which to replace) | entry | `wb legend set --quick` | ui | [ ] |
| 37 | L | Assign a key (Ctrl+1 to 9) | Shown on the entry; a key already used asks to move it | entry | `wb legend set --key` | ui | [ ] |
| 38 | L | Drag to reorder | Order of the list and the quick styles | entry order | `wb legend move` | ui | [ ] |
| 39 | L | Remove an entry | Its marks stay, listed as Unnamed | entry removed | `wb legend rm` | wb, ui | [ ] |
| 40 | L | Click an entry's count | Where it is used: each mark with its words and reference; a click opens the reader there | nothing | `wb find --kind mark --style <name>` | wb, ui | [ ] |
| 41 | L | In that list, select marks and Delete | They go, recoverable; one toast with Undo | moved to the trash | `wb mark rm <id>...` | wb, ui | [ ] |

### Seeing marks

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 42 | R | Open a chapter | Marks in the fixed layer order; the margin open beside the text (or as signs, as last left); folder colors as gutter tabs | nothing (no page files read) | `wb marks <chapter>` | rust, app (speed) | [ ] |
| 43 | M | Minimize or open the margin | Signs only, or the notes in full | `settings/marks.json` | `wb settings marks` | ui | [ ] |
| 44 | P | Toggle a kind | Marks of that kind hide or show | as 43 | as 43 | ui | [ ] |
| 45 | P | Toggle a legend entry | Marks in that style hide or show | as 43 | as 43 | ui | [ ] |
| 46 | P | Reading mode | Only the text; one line says marks are hidden, with Show | as 43 | as 43 | ui | [ ] |
| 47 | R | Hover a mark | Its legend name | nothing | | ui | [ ] |
| 48 | R | Click an arrow's end | The card for the arrow: its two verses, style, Change, Delete | nothing | `wb mark show <id>` | ui | [ ] |
| 49 | R | A chapter with years of marks (generated) | Readable: layers in order, underlines thinning, no mark hides the words, arrows clear of the margin | nothing | | app | [ ] |
| 50 | R | Narrow window | The same bar (one size); the margin as signs; a sign opens its note in a popover beside the verse | nothing | | ui | [ ] |

### On a phone (sheet G)

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 59 | phone R | Long-press a word, drag to extend | The selection; the bar's icons (44 px) above it | nothing | | ui (phone) | [ ] |
| 60 | phone B | Tap a kind or the Legend | A bottom sheet: the styles by name, Any color…, a filter for the Legend | nothing | | ui (phone) | [ ] |
| 61 | phone sheet | Tap a style | The mark is drawn; the sheet and bar close | as 4 | as 4 | ui (phone) | [ ] |
| 62 | phone R | Tap a mark | Its card as a bottom sheet: every mark there, Change, Delete | nothing | `wb mark at` | ui (phone) | [ ] |
| 63 | phone R | Tap a margin sign | The note as a bottom sheet, editable; Grow into a page | as 29 | as 29 | ui (phone) | [ ] |

### Finding marks

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 51 | Library search | Filter by mark: kind, color, legend entry, book, date | Matching marks, each with its words and reference; a click opens the reader there | nothing | `wb find --kind mark --style <name> --book <b>` | wb, ui | [ ] |
| 52 | Library search | Type words | Margin notes' text is searched with pages | nothing | `wb find <words>` | wb | [ ] |
| 57 | Library search | Open Colors across the Bible | Every book as a row of chapter cells; each cell shows the styles and folder colors in it; a filter picks one style or folder, and the empty cells are its gaps | nothing | `wb marks map [--style <name>|--folder <name>]` | wb, ui | [ ] |
| 58 | color view | Click a cell | The reader opens that chapter with the chosen style shown | trail step | | ui | [ ] |
| 53 | verse card | Open a verse's card, from the reader or a page's scripture block | Every mark on that verse, and the margin notes covering it | nothing | `wb mark at <ref>` | wb, ui | [ ] |

### Disk and moving forward

| # | Where | Action | What the person sees | On disk | `wb` | Test | Built |
|---|---|---|---|---|---|---|---|
| 54 | | Open a study folder with `highlights/*.json` | Every old highlight shows as a highlight in its color | nothing until the move | | rust | [ ] |
| 55 | | The move (once, after a backup, with the person's go-ahead) | `wb study check` lists what will move first; afterwards every old highlight is a mark with its id, color, words and date | `highlights/` read into `marks/`; old files kept in `.archive/` | `wb study move-marks --dry-run` then `--go` | rust, wb | [ ] |
| 56 | | Delete a mark, then Empty trash after 7 days | Gone for good only then | | `wb trash` | rust | [ ] |

## Disk (proposed)

- **Drawn marks:** `marks/<BOOK>.json`, one file per book: each mark `{id, kind, color, lines?, at, to?, created, changed?}`,
  where `at` and `to` are anchors (`NUM.25:11.3-25:11.9`: verse and word positions, as highlights use today).
- **Margin notes:** `margin/<BOOK>/<chapter>.md`, readable Markdown, each note under a line naming its verse, span or
  the chapter, with its id and dates. A span across chapters is kept in the chapter where it starts.
- **The legend:** `settings/legend.json`, entries in order: `{kind, color, lines?, name?, meaning?, quick?, key?}`.
- **Today's 26 highlight files** are read as they are until the move (row 55).

## Open questions

None (all six answered 2026-11-18, MK7-24 to MK7-29).

## Rounds

| Round | Date | What | Review |
|---|---|---|---|
| 1 to 6 | to 2026-11-17 | see [archive](archive/rounds-1-6-README.md) | accepted, then built badly |
| 7 | 2026-11-18 | fresh start: decisions MK7-1 to MK7-7, interaction table draft 1 | the person's notes on rows 1-44, 2026-11-18 |
| 7, draft 2 | 2026-11-18 | notes folded in: MK7-8 to MK7-23, table draft 2, 6 open questions | answered: MK7-24 to MK7-29 |
| 7, sheets | 2026-11-18 | sheets A to F drawn from the table (`python design/features/marks/marks.py`) | the person: the bar too large for a phone |
| 7, sheets 2 | 2026-11-18 | MK7-30, MK7-31: the bar icons only with a drop-down; sheet G, the phone | waiting for the person |
