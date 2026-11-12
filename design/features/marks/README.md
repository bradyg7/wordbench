# Marks

**State:** exploring · **Sheets:** `python design/features/marks/marks.py` writes `marks.figcraft` and `exports/*.png`
(it uses [kit.py](../kit.py)) · Nothing here is built yet.

What "a mark" is, how marks relate to pages, the reader's margin, the Library and the questions list. Asked by the
person on 2026-11-12, after questions round 2: questions look like a kind of marking beside the text, and it was not
clear whether marks replace notes, whether they only stick to scripture, whether a page can bring in a passage with
its marks, or how a list of them fits the Library. "Mark" is already the word: `wb marks` ("what is drawn on a
chapter"), and the reader's one panel for "every kind of mark" (reader R7, decided).

## Leading design (2026-11-12)

The board and `exports/` hold only these windows, grouped by part. Superseded windows are in git history (commit
`0d59600`, before the trim); their lines below say what replaced them.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The margin: the verse's page and store | M25 (opened), M26 (names first, lines on hover), M27 (writing asks where), M28 (passages and chapters) | M2, M3 (by M26, M27), M4 and M9-M11 (by the margin decision and M25), M29 (by M32) |
| Jots and pages; Margin notes in the Library | M30-M35 | |
| A page's scripture overview | M22-M24 | M1's model (by the no-places and margin decisions) |
| Marks on the words | M13 (one line under a run), M14-M16 (pencil, saved phrase, your own styles), M17 (the dotted line) | M5 (by M13-M16) |
| A passage with its marks, and history | M6, M7 (the photograph), M18, M19 (history) | |
| Many tabs open | M12 | |
| A full vault | M36-M41 | |
| Filters | M20, M21 | M8 (chips; not liked) |

## What is already decided elsewhere (the frame this must fit)

- **Everything you write is a page** (R1, 2026-11-09). A note at a verse is a page whose place is that verse; the
  files do not move.
- **Questions are only lines in pages**, with one list of them as a view (questions, 2026-11-12).
- **What you wrote sits in a margin beside its verse, names only, each a link** (reader C, 2026-11-11).
- **Saves show in the left margin** (library S8, S16 liked); how pages are listed on the right is not liked yet (S16).
- **The Library is four pieces** (library S20): Page (you write it), Folder (you sort into it), Save (a pointer),
  Library (one tree, one search).
- **One panel shows or hides every kind of mark** (reader R7).

## The concept proposed (2026-11-12, for the person's review)

### 1. A mark is how the text shows something of yours. It is not a new thing you make.

Two layers, and nothing else draws on the text:

| Layer | Kinds | Has words of yours? | Where it is kept |
|---|---|---|---|
| **On the words** | a highlight (a color, maybe a named one or a layer: [highlights](../highlights/README.md)), a thread's underline | no | `highlights/`, `threads/` (as now) |
| **In the margin** | a save (left margin), and beside the verse: a page at that place, a question line, a page that mentions the verse | yes, or a name | the page or the save that holds it (as now) |

So the margin is **a view, not a store**. A question in the margin *is* the question line in a page, shown again where
its verse is; a page "on" a verse is listed there by its title. Taking the margin away loses nothing.

### 2. Marks do not replace notes; the note became "the verse's page".

What used to be a note at a verse is the page whose place is that verse (it already is, in the files). Writing in the
margin writes into that page: a question becomes a question line at its end, a quick thought a paragraph. The page is
made the first time, named by its place ("Numbers 25:11"). So there is one kind of writing (a page) and many ways in:
from the reader's margin, from the Notebook, from a verse's right-click.

Anything that can be opened can carry a mark only if it has a **place**: a verse, a run of words, a chapter, a book, or
a Strong's number (a page at H7065 is already possible). Marks on a lexicon entry (books K5) are highlights at a
Strong's number, the same model. Nothing else (a search, a document) gets marks; those are saved, not marked.

### 3. A page can bring in a passage with its marks.

The scripture block (`wb page scripture`) already shows a passage with its highlights. It gains a switch:
**Just the text · With my marks**. With marks, the block draws the passage as the reader does, with its margin: the
questions, saves and pages on those verses, each a link. This is how a page "references a passage and its markings"
without copying them: they stay where they live and are shown again. A **chapter** in a scripture block is the same.

### 4. The questions list is a list of marks of one kind; in the Library it is a search, not a place.

The Library's tree holds things you sort (pages, folders, saves). Questions are lines inside pages, not things you
sort, so a Questions *section* in the tree (questions Q7) breaks library S20's line. Instead:

- **In the Library**: its one search (library S21) has kind filters, the same as the marks panel's kinds: Pages, Saves,
  Questions, Highlights. "Questions · open" is one click there. Nothing new in the tree.
- **In a page**: a saved list block (questions Q6, settings S5) with the same line (`notebook questions open @Num 25`).
  A page called Questions holding only that block is the old tab, if the person wants one.
- **At the reader**: the marks panel (reader R7) shows the chapter's marks by kind with a count each; a click on
  Questions lists this chapter's.

So one list engine, three doors: the Library's search, a block in a page, the reader's marks panel. All three are the
same `wb` line.

## The person's answers to the concept (2026-11-12)

- **1. Is the margin its own store?** That is the real question. A margin note in a printed Bible is apart from the
  notebook, but this app's point is that notes are accessible, connected, expandable and freely editable (reader R6,
  library S16).
- **2. Every verse could have its own page:** its main notes, and below them a references section listing every
  reference to the verse or to a word in it, so any page placed at a verse is a reference on that verse's page. It may
  need more storage and could expand things more than needed, but it is exactly how people keep margin notes over the
  years (a second Bible, a journal). Interconnection and organization, with reading and learning first, and
  user-friendly.
- **3. A passage in a page, with or without marks: wanted.** Like a photograph of an annotated Bible. Keep it clean;
  how to show everything without clutter needs working through.
- **4. Questions: a search filter at most.** (Questions Q7, a Library section, is dropped.)
- **5. A thread is a folder of saves** (leaning). Then what does an underline mean? Give a system people can understand
  that does not fight their own way of organizing.

## Decisions (the person, 2026-11-12)

- **Questions are a filter of the Library's search**, not a Library section (answer 4).
- **A passage can be shown in a page with your marks** (answer 3); how it stays uncluttered is round 1's M6-M7.

## Round 1 (2026-11-12): the model drawn

- **M1, the model.** On the words: a highlight (meaning), a pencil underline (attention), the dotted underline
  (something written on these words). Left margin: saves. Right margin: the verse's page. Under it all, the verse's
  page; any other page; the Library.
- **The verse's page answers 1 and 2 together.** The margin note *is* the verse's page: its notes, edited right in the
  margin (M2, M3), opened whole with ⤢ (M4). So the margin is not a separate store, yet it reads like a margin.
- **References need no new storage (M4).** They are found when the page opens, from the files and the cache that
  already index places (`wb anchor` lists everything on a place today). Nothing is copied into the verse's page, so a
  new page placed at the verse just appears there, and deleting it takes it away.
- **Only the notes are kept.** The verse's page is an ordinary page file at that place (a note with an anchor, as the
  Python app already has), titled by the place and made the first time you write.
- **M5, the underline, three meanings:** U-A a pencil line (emphasis with no meaning, one key); U-B the way a saved
  phrase shows (a thread's verses are underlined because they are saved in it); U-C your own named styles (underline,
  box, circle, wavy).
- **M6, M7, a passage in a page:** Just the text · With my marks. With marks: colors and pencil on the words, one dot
  per verse with a page and a count; a click opens a small card, and the page you write in never moves. "As of a
  date…" is offered for the photograph idea.
- **M8, questions as the search's filter**, with Keep as a list in a page.

## Decision: no places, only tethers (the person, 2026-11-12)

- **A page has no place.** The place feature (a page anchored to a verse, `anchor` in its front matter) is removed.
- **A reference written in a page tethers it** to that verse, passage, chapter or word: wherever the page names it
  (a reference in a paragraph, a scripture block, a word block). A tether is not an anchor: a page can have many, none
  is its home, and the page is never weighed down by them. They make it traversable: from the text to the pages that
  name it, and from a page to the text it names. The app already finds references in text (`wb refs`).
- **Fewer, less redundant references:** a page names a verse once, in its own words, instead of a place field and a
  mention that say the same thing twice.
- **The Python app is no longer the measure.** The person accepts that this breaks the Python app's reading of new
  pages: the aim is to make the Rust app far better, not to stay tied to the Python one. (This changes the standing
  rule "Same files, same formats" in AGENTS.md; see below.)

### What follows from it (proposed, for the person's review)

- **(Superseded the same day: the margin is the verse's page.)** With no places, nothing makes one page "the verse's". A verse shows the pages tethered to
  it (round 2's M11 becomes the design: the verse and what names it, with New page here). Open questions 1-3 of round
  2 fall away.
- **Writing in the margin** makes a new page whose first line is the reference ("Numbers 25:11"), so it is tethered by
  its own text; the margin then lists it like any other. Or it adds a paragraph to the last page you wrote on that
  verse. (To choose.)
- **The right margin** lists the pages that name a verse: names first (reader R6, liked), their lines on hover or
  click (M2).
- **Questions** are question lines in pages (decided); a question is tethered by the references in its own line or,
  with none, by its page's. Questions B's "the verse's page" becomes "a page naming the verse".
- **A word's page:** a page tethered to "zealous" in Numbers 25:11 names the run (a word block, or a reference to the
  word); a page about H7065 names the number. Both are found from either side.
- **Old notes with a place** are moved once (with the person's go-ahead, on a scratch copy first): the place becomes a
  reference line at the top of the page, so nothing is lost and every old note stays tethered where it was.
- **Saves are not pages** and keep pointing at what they save (library S20); a save is a pointer, not a tether.
- **What still needs a design:** how a tether shows in the page itself (the reference as a link, a quiet mark), how a
  page that names a whole chapter or book shows in the reader's margin without clutter, and whether a tether can be
  turned off for a reference that is only in passing.

## Decisions: a page's scripture overview, and the margin as the verse's store (the person, 2026-11-12, later)

These refine "no places, only tethers" above.

- **A page keeps a record of the scripture it names.** Instead of a place, the page tracks every reference in it (a
  reference in a paragraph, a scripture block, a word block), found from its text. At the top of the page it is shown
  as a scrollable overview, *Scripture in this page* (name to be settled: Scripture, Scripture references,
  References): every verse, passage and chapter the page names, in Bible order, each a link to where it is in the page
  and to the text. A long page, lesson or study can be seen at a glance by its scriptures. This record is also what
  tethers the page to the text.
- **The margin is the verse's page** (the word "margin" is used for it). It is the store of every note on a verse, a
  passage or a chapter, and it also shows that place's saves, the pages that reference it (cross-references), and its
  marks. To see everything for a verse you *open the verse in the margin*.
- **Writing in the margin asks:** add this to a new page, or just leave it in the margin. Leaving it is a margin note,
  kept with the verse; a new page is an ordinary page whose text names the verse (so it is tethered and listed there).
- **The Python app is not a constraint** (AGENTS.md rewritten the same day): the margin's notes and the page's record
  may take whatever form serves this app best.

### What follows (proposed)

- The verse's page of round 2 comes back as **the margin**, now without a place field: it is keyed by the verse,
  passage or chapter itself. Round 2's M9 (a line of counts) and M10 (names beside) are its two drawn forms; the
  person's earlier liking for reader R6's names as the first view still holds.
- A margin note on a **passage or chapter** sits in that passage's or chapter's margin; the verse's margin lists those
  that cover it, smaller.
- Open: how margin notes are kept on disk (one file per book or chapter, or one per place); whether a margin note can
  later be *moved* into a page (and back); what the page's scripture overview looks like in a narrow pane; whether a
  reference made only in passing can be left out of the overview.

## Review of round 1 (the person, 2026-11-12)

- **M4:** draw a few designs of a verse's page; the references are too big, above all in a narrow pane. The same for
  every mark when many tabs are open (M9-M12).
- **M5:** an underline should join the words of a run, not sit under each word with gaps (M13). Expand the pencil, the
  saved phrase and your own styles to see them at work before choosing; they are not necessarily at odds (M14-M16).
- **M6, M7:** the pencil clashes with the dotted line; revisit what the dotted line does and whether anything else
  already says it (M17). The photograph is liked; a dot may not look clickable, but it is liked.
- **M8:** chips as filters are not liked (M20, M21).
- **Q3:** reader R6 (names only) as the first view, perhaps mixed with M2; M2 not fully liked.
- **Q5:** not a phrase on a button; a cleaner way to show history, to see your thoughts develop (M18, M19).

## Round 2 (2026-11-12)

- **M9, verse page A:** your notes, then the references as one quiet line of counts (3 pages · 1 word · 1 question ·
  saved in 2); a count opens its list in place. Built for a 420-wide pane.
- **M10, verse page B:** the references as small names in a right margin of the page itself, beside what they relate
  to; it folds into A's line when narrow.
- **M11, verse page C:** no writing on the verse: the verse and the list of what refers to it, with New page here.
- **M12, many tabs:** a reader a third of the window folds both margins into small marks at the verse number (a
  ribbon, a page corner); hover names them; a click opens the verse's page in that pane.
- **M13:** one line under a run, broken only where the line of text breaks; today's per-word lines beside it.
- **M14, the pencil:** grey and thin; U, or Pencil under the colors in the right-click menu; U again takes it off.
- **M15, a saved phrase:** its folder's color under the run; two folders, two close lines; hover names them; a whole
  verse saved keeps the ribbon in the margin, so lines are for phrases.
- **M16, your own styles:** box, circle, double line, pencil, each named by you (a sample: Promise, Name, Command),
  each with an eye.
- **M17, the dotted line:** D1 drop it (the margin already says a page is on the verse), D2 a small mark after the run
  like a footnote mark, D3 nothing until you hover the margin's item.
- **M18, history on the verse's page:** a thin timeline at its foot, a dot for each time something of yours came to
  the verse; dragging back shows the notes as they were.
- **M19, the photograph with a date:** the same thin line under a passage block in a page; set once, the block keeps
  that date.
- **M20, M21, filters:** a list of kinds down the side with counts (A), or one menu at the start of the search field,
  "Everything ▾" (B).

## Pros and cons asked for (2026-11-12)

### 1. Which page is "the verse's page" when several pages are placed at one verse?

| Way | For | Against |
|---|---|---|
| **a. The page titled by the place** (made from the margin, "Numbers 25:11") | No new field; the Python app sees an ordinary page; easy to explain | A page titled "Numbers 25:11" by hand becomes it by accident; renaming it silently stops it being the verse's page |
| **b. A field marks it** (`verse: NUM.25:11`, one the Python app passes over) | Exact; survives renaming; the title can be anything | A new field; two pages could claim the same verse and need a rule |
| **c. None is special** (M11: every page at the verse is equal) | Nothing new at all; no "which one" question | No single margin note; the margin is a list, not your note |

**Better, proposed:** b, with a's title as its default. The field is set only by writing in the margin (or Make this
the verse's page), so never by accident; a second claim is refused with "Numbers 25:11 already has a page: open it".
The title starts as the place and can be changed.

### 2. A word's page: "zealous in Numbers 25:11", or H7065 everywhere?

| Way | For | Against |
|---|---|---|
| **a. A page on the run of words in this verse** (an anchor on the words, as notes on words are today) | Exactly what you were looking at; sits beside the word in the margin | The same Hebrew word in 40 other verses knows nothing of it |
| **b. A page on the Strong's number** (H7065, everywhere) | One study of the word gathers everything; every verse with the word can show it | A thought about this verse's use is buried among the word's other uses; English words with no number have nowhere to go |
| **c. Both, linked** | Each in its place | Two pages to choose between when writing |

**Better, proposed:** write where you are (a, the run), and let the word's page (b) list every run-page with that
number as a reference, the way a verse's page lists pages placed at it. One rule throughout: a page is kept where it
was written and listed wherever it refers. Writing a page on H7065 itself stays possible from the Concordance.

### 6. Is a writable verse page too much, or only a list of where the verse is referenced?

| Way | For | Against |
|---|---|---|
| **Writable** (M9, M10) | It is the margin note people keep in a second Bible over the years; one place for "my thoughts on this verse" | A page per verse could mean thousands of near-empty pages; a second place to write besides your pages |
| **A list only** (M11) | Nothing new to keep; every thought lives in a real page you named | No margin note; a quick thought needs a page with a title first |

**Better, proposed:** writable, but made only when you write. A verse never written on has no page, only its list
(M11 is what an unwritten verse shows). So the number of verse pages is the number of verses you actually wrote in a
margin, as in a paper Bible.

## Open questions (round 2)

1-3. Settled 2026-11-12: no place field; references in a page tether it; the margin is the verse's page and the
   store of its notes (see the decisions above).
4. The underline: pencil (M14), saved phrase (M15), your own styles (M16), or more than one? M13's joined line for all.
5. The dotted line: D1, D2 or D3?
6. History (M18, M19) needs what this app does not keep today: when each mark was made and how a page read before.
   Worth keeping (a page's earlier versions in the study folder, a date on each highlight)?
7. Filters: the side list (M20) or the field's menu (M21)?
8. The reader's margin: R6's names as the first view, opening to M2's lines on hover or click? (Drawn in M26.)

## Round 3 (2026-11-12)

- **M22, a page's scripture overview:** at the top, *Scripture in this page · 5*: every scripture the page names, in
  Bible order, each with where it is named (a scripture block, ¶2); a click goes to that spot, its arrow to the text.
  Found from the page's text; it is the page's tether.
- **M23, narrow:** the overview folds to one wrapping line of references; a click opens the full list; a book button in
  the pane's head brings it back after scrolling.
- **M24, a reference in passing:** right-click a reference in the text, Not a tether: it stays a link, is listed greyed
  at the overview's foot, and the verse's margin does not list the page.
- **M25, the verse opened in the margin:** beside the reader: the verse, its margin notes, then one line of counts
  (pages that name it, saves, marks, notes on the passage around it), each opening its list.
- **M26, the reader's margin:** R6's names first (a mark and "2 notes · 3 pages"), M2's lines and counts on hover, M25
  on click.
- **M27, writing asks where:** Leave in the margin, or Add to a new page (whose first line names the verse); Remember
  my choice.
- **M28, a passage and a chapter:** notes on 25:10–13 sit in that passage's margin with a bracket beside the verses;
  the chapter's notes sit at its top; a verse's margin lists them, smaller.
- **M29, moving a note:** a margin note's ⋯: Move to a new page, Move to a page…, Ask as a question, Delete. A page's
  paragraph that names one place has Move to the margin. A note is in one place at a time.

## The margin and the Notebook: a jot and a page (proposed, 2026-11-12)

The person: the margin should have its own place in the Library. How is it kept from becoming a second Notebook? The
way a preacher jots a thought in the Bible, then goes to the notebook and expands it, perhaps starting from that jot.
So making a page out of a thought, or attaching it to an existing page, matters.

**The distinction: the margin holds jots; the Notebook holds pages.**

| | A jot (the margin) | A page (the Notebook) |
|---|---|---|
| What it is | A thought caught while reading | A thought worked out |
| Where it lives | At one verse, passage or chapter; nowhere else | In the Notebook's tree; tethered to every scripture it names |
| Its shape | Plain sentences, references and a question mark; no title, headings, blocks, tables or pages inside | Anything a page can hold |
| How it is ordered | The Bible's order only; no folders, no pinning, no nesting | Nested, pinned, sorted into folders |
| In the Library | **Margin notes**: book › chapter › verse, with counts | **Pages** |

**The way between them: a jot grows into a page; it is not moved.**

- **Grow into a page** (a jot's ⋯, or when a jot passes a few lines the margin offers it): a new page starts with the
  jot as its first block, shown as the seed, quoted and linked, with the verse named so the page is tethered. The jot
  stays in the margin, where it was written, with a small line under it: *grew into Phinehas*. As in a paper Bible: the
  jot is still in the margin after the notebook took it further.
- **Add to a page** (⋯ › Add to a page…): the same, into a page that already exists, at its end or where you choose.
  The margin's line then names that page.
- **Nothing is copied.** The page's seed block shows the jot as it is now (a jot block holds only the jot's id, as a
  thread or word block does); editing the jot in either place edits the one jot. Deleting the page leaves the jot.
- **The other way stays small.** A page's paragraph is not moved into the margin; a page is already listed in the
  margins of every scripture it names. (M29's Move to the margin is dropped; its Move to a page becomes Grow into a
  page.)
- **Questions:** a jot can be a question (a jot that is a question line). Grown into a page, it becomes a question
  line there, still one question.

**What keeps the margin from growing into a Notebook:** a jot has no structure to grow, it has one place and no title,
and the Bible is its only order. When a jot wants more (length, headings, a second scripture worked through), the
margin offers to grow it into a page instead of growing itself.

## Round 4 (2026-11-12)

- **M30, Margin notes in the Library:** a section of its own beside Pages (Pinned, Pages, Margin notes, Folders, Shelf),
  in the Bible's order: books open to chapters, each with how many jots it holds. Never sorted into folders; reached by
  the Library's search like everything else.
- **M31, a chapter's jots:** Numbers 25 opened, each jot under its verse's first words; a jot that grew shows *grew into
  Phinehas*; a question jot shows its mark. A click opens the reader at the verse with its margin open.
- **M32, a jot's menu and the offer:** Grow into a page, Add to a page…, Make it a question, Delete. A jot that runs
  long gets a quiet line under it: *Getting long: grow it into a page?*
- **M33, the page a jot grew into:** the jot as its seed block (*From the margin at Numbers 25:11*), the overview
  listing Numbers 25:11 as the seed, your writing beneath.
- **M34, the margin after:** the jot where it was, with *grew into Phinehas*; the page counted once among the pages
  that name the verse.
- **M35, Add to a page…:** pages that already name the verse first, then the last pages written in, then a search.

## Round 5 (2026-11-12): a full vault, fifteen years on

A projection, not the person's data: on 2026-11-12 the study folder held about 121 pages and 9 threads. Drawn at
about 2,400 pages, 3,100 jots, 18,000 highlights and 140 folders (weekly lessons and daily reading for fifteen years).

- **M36, the busiest chapter:** John 3 with every verse marked. The margin shows one line of counts per verse
  (3:16: 41 jots · 312 pages · 9 saved), the same size however much is behind it.
- **M37, one verse's margin:** John 3:16's 41 jots, newest first, folded by year; its 312 pages grouped by folder with
  counts and a search, never listed by the hundred.
- **M38, Margin notes as a map:** every book a bar of its chapters, shaded by how many jots each holds; where you have
  never written shows as plainly as where you have.
- **M39, a long lesson's overview:** 86 scriptures folded to 14 books with counts, a book opening to its references.
- **M40, searching everything:** results grouped by kind with counts, best first, each showing where it lives; a
  place typed jumps to its margin.
- **M41, the Pages tree:** Pinned and Recent first, folders one level at a time with counts, a long folder showing its
  newest twenty and Show all.

### Does it hold up? Where the model holds, and where it strains

**Holds:**
- **The text stays readable.** Nothing you add grows the reader: the margin is a line of counts per verse whatever
  sits behind it (M36), and everything else is a click away. Reading stays first at any size.
- **Every view has a natural order that scales:** the Bible's order for the margin and Margin notes, time for a
  verse's jots (M37), folders and recency for pages (M41). None of them needs the person to tidy anything.
- **The years become an asset, not clutter:** a verse's jots by year show how a thought grew; the map (M38) shows a
  life of study at a glance; *grew into* links follow a thought from Bible to sermon. This is what a paper Bible and a
  shelf of notebooks cannot do.
- **Nothing is copied**, so nothing goes stale: references and the overview are found from the pages themselves.

**Strains, and what each needs:**
1. **Highlights become wallpaper.** In M36 nearly every verse is colored, and a color that is everywhere says nothing.
   Designed in [highlights](../highlights/README.md) round 2 (H8-H14, 2026-11-12).
   It needs the layers by year from [highlights](../highlights/README.md) B (show this year's only) and named colors,
   and the marks panel's eyes. Without them, highlights stop adding value after a few years.
2. **Hundreds of pages naming one verse.** 312 pages on John 3:16 is a list nobody reads. Grouping by folder (M37)
   helps; it needs the pages' own words to rank them (a page *about* the verse before a page that names it once in
   passing). "Not a tether" (M24) is the person's tool for this; an automatic weight (how often a page names the verse,
   whether in a scripture block) would be the app's.
3. **Search is carrying the weight.** At 2,400 pages the tree is for walking, the search for finding (M40, M41). The
   search must be fast and good (whole words, places, best first) or the Library fails. It needs a full-text index in
   the cache, built in the background, and a speed budget in `npm run measure`.
4. **Speed.** Counting tethers for a chapter with 300 pages per verse must not be done by reading files when the
   chapter opens. The cache must index references (verse → pages, verse → jots) and update one page at a time on
   save. This is a build requirement, not a design choice; it belongs in "what the build must satisfy".
5. **Folders drift.** After fifteen years, folders made in year one stop fitting. Moving many pages at once, merging
   folders, and seeing pages in no folder need a design ([library](../library/README.md)).
6. **The top bar's place button** in these sheets still says Numbers 25 (a sheet shortcut, not a design point).

**Verdict (proposed):** the model holds for a seasoned teacher *if* three things are built with it, not after it:
highlights by layer, ranking of the pages that name a verse, and a cache that indexes references and full text. The
rest scales by its own order.

## Open questions (round 3)

1. The overview's name: Scripture in this page, Scripture, References?
2. Should the overview be shown always, or folded by default (M23's line) in every width?
3. Not a tether (M24): wanted, or does every reference count?
4. How margin notes are kept on disk: one file per chapter (all its verses' and passages' notes), or one per place?
5. Margin notes on a passage (M28): a bracket beside the verses, or listed under the first verse only?
6. The jot and the page (above): accept "grow, not move", with the jot kept and a seed block in the page?
7. When does the margin offer to grow a jot: past a number of lines, on a heading or a second reference, or only from
   the ⋯?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 0 | 2026-11-12 | none | the concept in words | answered above (2026-11-12) |
| 1 | 2026-11-12 | M1-M8 | the model, the reader's two margins, the verse's page, the underline, a passage with marks, questions as a filter | reviewed above (2026-11-12) |
| 2 | 2026-11-12 | M9-M21 | three verse pages, many tabs, one line under a run, the three underlines at work, the dotted line, history, filters | waiting |
| 3 | 2026-11-12 | M22-M29 | a page's scripture overview (wide, narrow, a reference in passing); the margin opened, in the reader, writing asks where, passages and chapters, moving a note | waiting |
| 4 | 2026-11-12 | M30-M35 | jots and pages: Margin notes in the Library, a chapter's jots, growing a jot into a page, the seed block, the margin after, adding to a page | waiting |
| 5 | 2026-11-12 | M36-M41 | a full vault fifteen years on: the busiest chapter, one verse's margin, the map, a long overview, searching everything, the Pages tree | waiting |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |
| `data/ps106-30-31.json`, `data/rom10-2.json` | `wb text "Ps 106:30-31"`, `wb text "Rom 10:2"` |

Scripture is fetched from the database, never typed. What the person wrote is a placeholder ("Your own words, as you
wrote them"); page names are a drawn sample.

## Touches

[reader](../reader/README.md) (the margin, the marks panel), [questions](../questions/README.md),
[library](../library/README.md) (S16, S20, S21), [highlights](../highlights/README.md), [threads](../threads/README.md),
[books](../books/README.md) K5, [settings](../settings/README.md) S5. See [overlaps.md](../overlaps.md).
