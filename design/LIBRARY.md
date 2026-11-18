# The Library: the map of the app

**State:** draft, round 2 (2026-11-18, the person's notes on round 1 folded in). Built from a read-only survey of `main` on 2026-11-18. Every design folder uses
this map's objects and words; a folder that needs a new object or word changes this file first, with the person's
go-ahead.

## What the Library is (the person, 2026-11-18)

The Library is one person's whole workbench: what used to fill an office (the Bible written in, the notebooks, the
dictionaries and concordances) in one app with unlimited room, where everything is connected, searchable and traceable,
so nobody has to remember which page, which book or what a color meant. It holds sources and the person's own work,
never commentary or answers: people explore truth for themselves.

- **One person, one computer** today. **Sync between a person's devices is required later**, and a teacher sharing a
  folder may come later: nothing in the foundation may make either impossible.
- **One Bible: the KJV.** YLT is archived.
- **One Notebook**, organized by folders.
- **Reference works are curated by the person** (public domain or freely licensed, long-lasting). People do not add
  their own yet. No commentaries, ever.
- **Each person keeps their own legend** for what their marks mean, and it must be easy for anyone, including the
  least technical, to make, change and read.

## The objects

Marked **keep** (works, stays), **change** (exists, will change), **new** (not built). Each says what it links to; a
link is always readable from both ends.

| Object | What it is | Today | Links to | Mark |
|---|---|---|---|---|
| **Library** | the whole workbench | the study folder plus the read-only database | everything | keep; **change**: must become syncable |
| **Bible** | the KJV text | read-only DB; `bible`, `lookup` | verses ← marks, pages, saves, words | keep |
| **Reference works** | the curated books: Strong's concordance, BDB, Webster's 1913, the interlinear. Separate books, reached through one smooth way in (open: one "book" with every feature at hand, or a shelf of books; never clunky) | DB and `dictionary.db` | words ↔ verses; any entry ↔ pages | keep; **change**: any entry can be saved, and so referenced in a page (books K5) |
| **Notebook** | the person's one notebook. Fast, good-looking, never annoying; Notion is the model to learn from | `notes/`, `notebook`, `library` | holds folders and pages | keep; **change**: redesign for feel and speed |
| **Folder** | a group of pages and saves, which may keep a color. The color shows quietly wherever the folder's things appear (a page, a verse, a Strong's entry), and its name on hover or click. There is no separate "thread" | `sets/`, legacy `threads/` | pages, saves; a page may be in several | keep; **change**: "thread" is retired and its files are archived into colored folders (TH-2, a backed-up move with the person's go-ahead) |
| **Page** | anything written: study, lesson, sermon, prayer, thought | `notes/**.md` | anything in the Library: verses, words, entries, pages, folders, saves | keep; **change**: anything in the Library can be referenced (a `/` command or the page's properties); every reference links both ways, found by itself as it is written (no manual linking); the text is searchable |
| **Question** | a question the person wrote anywhere (a page or a margin note), open or done | today a callout line only | where it was written, the verses near it | **change**: found by itself in what is written, as scripture references are, so a question asked without the command is not lost; the callout stays as a way to mark one explicitly |
| **Save** | a pointer to a verse, phrase, word, page, search or document; never a copy | set items, `library` | what it points to | keep; **change**: a pointer that no longer resolves is shown, not hidden |
| **Mark** | anything the person puts *on* the Bible text | see the kinds below | its verse(s); the legend | **change**: one family with one legend |
| — highlight | any color on words, assigned near-instantly | `highlights/` | verse, legend | keep; **new**: a whole-Bible view of where each color (highlight or folder) appears, and its gaps |
| — underline (today "pencil line") | a line under words; the name is open | `pencil/` | verse, legend | keep; **change**: in search and the verse index; **open**: how it differs from a colored mark (see Open) |
| — margin note | writing beside a verse or verses | `margin/` | verse(s); can grow into a page | keep; **change**: any span of verses, as other marks |
| — circle, arrow, double/triple underline | the paper marks not yet built | none | verse(s), legend | **new** (marks folder) |
| **Legend** | what each of the person's marks means | none | every mark | **new** |
| **Trail** | back and forward through where the person has been | `history/` | every step's place | keep; **change**: its menu is clunky, redesign |
| **Document** | a Word or PDF made from a folder or page | `documents/` | its source | keep; **change**: its menu is clunky and its value unclear, redesign |
| **Reading plan** | plans and what has been read | `plans`, `reading` | verses | keep |
| **Finding** | the person's notes about the app itself, not study | `findings/` | none in the study | keep (outside the Library proper) |

## Open (from round 1)

1. **Shelf or no Shelf.** If every save lives in a folder of the Notebook, the Shelf may go. What must hold: the person
   can always see clearly where a saved thing went. Proposal: no Shelf; a save not put in a folder lands in one fixed
   place in the Notebook ("Unfiled"), shown like any folder.
2. **Marks in layers.** Over years, marks pile up: highlights, underlines, circles, folder colors. Needed: a mark's
   kind and color are separate (an underline may be any color, a highlight any color), layers can be shown or hidden
   by kind, by color or by legend entry, and a chapter with years of marks stays readable. This also settles what an
   underline is versus a black-colored folder (a folder's color is where its things are; a mark is something drawn on
   the text) and the underline's name. Designed in marks, round 1.
3. **Reference works: one book or several.** Decided in books.
4. **Search in pages.** Where it lives (the Library's one search, a Notebook search, or both) is decided in search;
   what must hold: anything written or saved, the person's or a source's, is found by a word, topic or verse.

## The words

One word per thing. A builder never uses a retired word in the window.

| Use | Not | Decided |
|---|---|---|
| page | note (except "margin note") | 2026-11-09 |
| folder | thread (in the window; `wb thread` keeps its name) | 2026-11-17 |
| **trail** = back/forward history only | trail for questions to follow up | the person, 2026-11-18 |
| **mark** = the umbrella for anything on the Bible text | mark for anything else (a lexicon entry is *saved*, not marked) | the person, 2026-11-18 |
| save | place (as a set item) | 2026-11-17 |
| Shelf | Unsorted | L-5 |
| saved list | view | settings S5 |
| folder (with a color) | thread | the person, 2026-11-18 |

**Decided (the person, 2026-11-18):** the study `trails/` files (questions to follow up) fold into Questions; `wb trail`
and `trails/` are read and moved forward by a designed, backed-up move with the person's go-ahead.

## Search

The goal is one search over the whole Library. Today it is two: the Bible (`wb search`), and the person's own work
(`wb find`: pages, folders, saves, questions, margin notes, highlights). **Not searched yet:** pencil lines, documents,
findings, lessons, reference-work text. Designed in `search` (exploring).

## Known drift to clear

- `docs/SPEC.md` is stale and AGENTS.md sends every agent to it first.
- `store.rs` and `threadpage.rs` comments still keep "the Python app's format".
- Two delete paths: `.trash/` and `deletion.rs`.
- Set kinds still named `note`, `place`, `thread`.
- `wb find --kind highlight` works but its help omits it.

## Priority (most foundational first)

Each line: folder, state, then rows built of rows designed (filled in once every folder has its table).

1. This map: draft
2. updates: accepted; slice 1 built
3. marks (redesign from this map, with the legend): to redesign
4. search (one search over the Library): exploring
5. library, threads, questions: accepted, partly built; re-check against this map
6. concordance and words: accepted; add Greek and Hebrew alphabet selection, minimizable interlinear, optimize
7. everything else, each re-checked against this map when it comes up
