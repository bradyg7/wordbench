# Tether: finding the scripture in a long note

**State:** accepted by the person 2026-11-17: Named and Quoted tiers only; no suggestion by meaning (tier 3 dropped, the "Needs the person" question closed) · **Sheets:** `python design/features/tether/tether.py` writes `tether.figcraft` and
`tether.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet. What other tools
get wrong, and so what this folder avoids: [bible-software-complaints](../../research/bible-software-complaints.md)
(theme 4, exports that drop the verse reference; theme 5, AI features users did not ask for).

**Readiness: likely finished** (2026-11-17, first pass, by [ready-criteria](../ready-criteria.md); never "accepted").
Every decision (TG-1 to TG-14) is the overseer's inference; the person has reviewed nothing here.

- **1** one direction, nothing superseded (Leading design). **2** one question left, and it is the person's: a change to an `AGENTS.md` rule ("Needs the person" 1, with a recommendation). **3** the four real conditions are drawn (TG9 to TG13). **4** the build list names inputs and results, with the return case. **5** every action has a named `wb tether …` command (none exists; Commands table). **6** [overlaps](../overlaps.md) rows added, all resolved; [coverage](../coverage.md) has the area and command rows. **7** the page, block, scripture-fence, `--expect` and Undo parts it relies on exist (`pages.rs:876`, `:927`, `:952`); nothing writes the study folder except Accept. **8** `tether.pdf` was rendered and its windows looked at (TG1, TG2, TG6, TG7, TG10 by the overseer; all by the builder); the verses come from `wb text`, quoted words are cut from them by code, and counts on the sheet are computed. **9** no score, no "strong/likely", no order by strength; the AI tier is drawn only as what would leave the computer (TG8). **10** no format change: accepted tethers are scripture fences in a page; skips are app state (TG-10).
- Known limits of the sheets: TG13 shows "66 new · 61 in the page · 52 skipped" (179 − 61 − 52); TG4 shows blocks 14, 15 (scripture), 16; TG10 is a card with a handle, as words' card is; TG3's parallel row says "6 of the 6 words are in this verse" because `wb search` is not an in-order match (the build's matcher is).
- **For the person, to look at, in this order:** **TG1** (the entry), **TG2** (a reference named), **TG3** (a quotation), **TG4** and **TG5** (what Accept does to the page), **TG7** (the handoff to slides), then **TG6**, **TG12**, **TG13**, and the real conditions **TG9**, **TG10**, **TG11**; **TG8** is the question, not a design.

The person's request (2026-11-17): a script in the Notebook that reads through their own notes and finds the scripture
references to **tether** to the page, and at what point in the page each belongs. Purpose: building slide decks and
lesson scripts from a long (about 40 minute) spoken "word dump" of notes, where finding each exact scripture by hand is
tiring. They want to begin work on it while other designs are still being drawn. It touches the Notebook (a page's ⋯
and a pane beside the page), the page's own scripture blocks, and the document builder ([documents](../documents/README.md)).

## The tension with `AGENTS.md`, handled first

`AGENTS.md` says: *No interpretation. The app shows source text, the person's own notes and lookups. No commentary,
no doctrine, nothing suggested.* A tool that suggests verses by what a note means would break it. So this design is
built on the one reading of the request that does not: **the app finds only what the person's own words already
contain, and shows the evidence.** The person asked for the feature and may change the rule; the design stays as far
inside it as it can and says where it steps outside.

| Tier | What it finds | Inside the rule? | Built? |
|---|---|---|---|
| **1 · Named** | A reference the person wrote or spoke, in any usual form: "Romans 8:28", "Rom 8 verse 28", "John chapter 3 verse 16", "second Timothy two fifteen". | **Inside.** It reads what the person said; it is `wb refs` taught to hear. No judgment about meaning. | Yes |
| **2 · Quoted** | Words in the note that are, in order, the words of a verse in the Bible database (a quotation, or nearly one, as speech to text makes it). Shown with the matched words marked in the note and in the verse. | **Inside, at its edge** (TG-1): it is a string match like `wb search`, run for the person. It never says a verse is relevant, ranks one over another by meaning, or chooses between verses that share words: where several verses match, it lists them all and the person chooses. | Yes |
| **3 · By meaning** | A verse the note is *about*, though no word of it is quoted (a paraphrase, an idea). Needs an AI service. | **Outside.** It is a suggestion by meaning, and the person's notes would leave the machine. | **No.** "Needs the person" 1; TG8 draws only what it would send, so the question can be answered. |

Tiers 1 and 2 need no network and no AI: they run from the database on the person's computer. Nothing is attached by
the tool: every candidate waits for **Accept**.

## Leading design (2026-11-17)

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The entry and the list | TG1 (Find scripture… in the page's ⋯; the Tether pane) | |
| One candidate | TG2 (a reference named), TG3 (a quotation) | |
| What Accept does | TG4 (preview), TG5 (after) | |
| What is not offered | TG6 (phrases found in many verses) | |
| The handoff to documents | TG7 (verses in order of place) | |
| The optional AI tier | TG8 (the disclosure only; not built) | |
| The real conditions | TG9 (among other tabs), TG10 (floating), TG11 (narrow), TG12 and TG13 (a 40 minute note; years of study) | |

## Decisions (2026-11-17)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-17, unless it names the person.
The person's request is the only decision of theirs here.

| # | Decision | Rests on |
|---|---|---|
| TG-1 | **Tiers 1 and 2 are inside "no interpretation"; tier 3 is not and is not built.** The test used: does the tool say anything the person's own words do not? Tier 1 reads a reference the person said; tier 2 reports that some words in the note equal some words in a verse, and the evidence is those words. Neither says what a verse means, which fits a note, or which of two verses is better. Where this is the edge: the list is a list of verses the person did not look up. It is the same as `wb search` run once for every sentence, and nothing in it is a view. | `AGENTS.md` ("no interpretation … nothing suggested"); `wb search` (`crates/wb-cli/src/read.rs:69`) |
| TG-2 | **Evidence, never a score.** Every candidate says why it matched in words and counts only: "You said 'second Timothy two fifteen'", or "11 of this verse's 12 words, in order (the sheet's Proverbs 27:17 sample, counted by code)". There is no percentage, no "strong" or "likely", no order by strength. The list is in the order of place in the page. | TG-1; ready-criteria check 9 |
| TG-3 | **A tether is a reference the page names, and Accept writes one.** Pages have no places; a reference written in a page tethers it ([marks](../marks/README.md), the person, 2026-11-12). So Accept adds a scripture block (a ```` ```scripture ```` fence holding only the reference, never the verse: `AGENTS.md`) to the page, at the place the reference came from. Nothing is kept beside the page: no list of anchors, no front matter. A reference the person typed ("Romans 8:28") already tethers the page; Accept still adds the block, because the document builder's verse slide is a scripture block (TG-9). | marks 2026-11-12; `scripture_fence` (`crates/wb-core/src/pages.rs:952`); documents D2 |
| TG-4 | **The place is "after the sentence the words are in".** A candidate's anchor is the block and the character range of the words (the person's words or the quoted words). Accept puts the scripture block after the sentence that holds the end of the range. If that sentence ends the block, nothing is split. If the block continues, it is split into two blocks of the same kind at the sentence end, and the scripture block goes between: the person's characters are never changed or lost, only a break is added, and one Undo takes it back. A spoken dump often has no punctuation: when no sentence end is within 40 words after the range, the split is at the range's end. In a list item, a quote or a heading (no split makes sense) the scripture block goes after that block whole. | `AGENTS.md` ("what the person already wrote must never be lost"); pages' guarded edit and block Undo (`edit_guarded`, `undo_block`, `pages.rs:876`, `:927`) |
| TG-5 | **Nothing is attached until Accept, and Accept can be undone.** Finding writes nothing to the study folder. Accept is one transaction with an Undo token (a batch of 61 is one token); it refuses with "the page has changed since it was read" if the block's text no longer matches what was found (`--expect`, as `wb block rm` does). | `wb block rm --expect`; page Undo on `main` (spec) |
| TG-6 | **Where several verses match, all are listed and the person chooses.** A run of words found in 2 or 3 verses (the Gospels' parallels) gives one candidate per verse, shown together, marked "also in …"; Accept on one marks the others skipped (reversible). A run found in more than 3 verses ("thus saith the LORD") is not a candidate: it is one line in a folded group, "In many verses · 35", with the count and nothing to Accept (TG6). The tool never picks. | TG-1; the person owns the choice |
| TG-7 | **What counts as a quotation is fixed, not a setting.** Words are lower-cased and stripped of punctuation. A quotation is at least 6 words of one verse appearing in the note in the verse's order, with at most 2 other words in any gap (speech fillers) and at most 2 verse words skipped in any gap. Consecutive verses quoted together in one stretch (within 30 words) make one passage candidate. The words found are the only evidence. `wb tether --min-words N` changes the 6 for one run; the window has no knob (a design choice is not a setting). The Bible text matched is the KJV, the version the search uses; `--version ylt` matches the YLT. | index "A design choice is not a setting"; `wb search` is KJV |
| TG-8 | **Spoken forms are read by new code that sits beside `find_refs`, not inside it.** Today `find_refs` reads "Rom 8:28" but reads "Romans 8 verse 28" as the whole of Romans 8 and finds nothing in "John chapter 3 verse 16" or "second Timothy two fifteen" (run 2026-11-17: `wb refs --json` on those lines). A spoken-form pass turns number words and "first/second/third", "chapter", "verse", "through" into the written form, keeps a map from every character back to the person's original text, runs the existing `find_refs`, and maps the range back, so the anchor points at the person's words. A reading that is not a verse of the Bible is dropped, as today ("a reference that is not in the Bible stays text"). Where "one twenty three" can be 1:23 and 123, both valid readings are offered together (TG-6). The fix for "Romans 8 verse 28" is part of the same change and is a bug fix under the existing design. A bare "verse 28" with no book is not read (the book would be a guess). | `crates/wb-core/src/commands.rs:1570` (`find_refs`); `places.rs` (`parse_span`, `match_book`) |
| TG-9 | **The handoff is the page itself.** Accepted tethers are scripture blocks in the page, in order of place, so `wb craft deck --page ID` and `wb craft word --page ID` already take them in that order (documents D2: each scripture block is a part). `wb tether verses <page>` prints the same list outside the builder: the reference and the verse text (verbatim, from the database), in page order, each with the first words of the sentence it follows, as plain lines for a lesson script (`--text`) or as JSON. The lesson file format is unchanged; `--text` can be piped to `wb lesson save <name> --append` (lessons are not pages: [documents](../documents/README.md) DC-10). | documents DC-1, DC-3, DC-10; `wb lesson save` reads standard input |
| TG-10 | **Skipped candidates are remembered, out of the study folder.** After 214 candidates and 52 skips, running again must not show the 52 again. The skips are kept in the app's own state folder (the one [updates](../updates/README.md) U-15 names), keyed by page id and candidate id; losing them only brings candidates back. A candidate's id is a hash of its tier, reference, the normalized words found and which occurrence of those words it is, never of a character position, so editing elsewhere in the page does not change it. "Show skipped (52)" lists them; Skip can be undone per candidate. | updates U-15; no study-folder format change |
| TG-11 | **One page at a time; a run is read-only and background.** `wb tether <page>` reads one page and prints candidates; it writes only the derived index (the cache, as `cache.rs` already keeps the search index). The window runs it without blocking the page and lists candidates as they are found, in the page's order. There is no "tether every page" action. | the person's request (a note at a time); `cache.rs` |
| TG-12 | **Where the window is.** The page's ⋯ holds **Find scripture…** beside Make a document…. It opens the Tether pane as a tab beside the page (a floating tab and a phone sheet are drawn, TG10, TG11). One more row in the page's ⋯ is recorded in [overlaps](../overlaps.md) with library's list (S31). Keys in the pane: ↓ ↑ step the candidates, **A** accepts, **S** skips, Esc leaves the pane; the page scrolls to the candidate on the person's step only and returns to where it was on Esc. | library S31, L-9 line 210; [panels](../panels/README.md) |
| TG-13 | **Accept all named is the one bulk action, and it asks.** "Add the 61 named references" shows the count and the first and last, and adds them as one Undo. There is no Accept all for quotations: each is looked at (TG-2), though the keys make it a run of A and S. | TG-1; the person's tiredness is by-hand lookup, not the choosing |
| TG-14 | **The AI step is not built. If the person turns the rule's exception on, it is a separate tier with its own switch, off by default, drawn in TG8.** What it would send is fixed in "Needs the person" 1. | `AGENTS.md`; TG-1 |

## Needs the person

The one fundamental question is a change to a rule in `AGENTS.md`. Nothing in the build waits on it: tiers 1 and 2 are
complete without it.

1. **Should the app ever suggest a verse by meaning, using an AI service, when you turn it on?** Recommended: **no, not
   now; build tiers 1 and 2 first and look at what is left on a real dump.** Reasons: (a) it is the one step that breaks
   "nothing suggested", and your notes (your thinking, possibly your doctrine) would leave your computer; (b) tiers 1
   and 2 are exact, offline and free, and they do the tiring part of a word dump, which is the stretches where you named
   or quoted a verse; (c) the window already shows how many stretches of the note were not matched to anything, as a
   count only, so you can judge from your own dump whether a third tier is worth the rule changing. Main risk: if a
   large part of a talk is paraphrase (you describe a verse in your own words), tiers 1 and 2 find nothing there and
   those places stay by hand. If the answer is yes, the design is TG8: the switch is in Settings and is off; the app
   asks before each use; **what leaves the computer is exactly** the text of the paragraphs you select (not the page,
   not other pages, no page title, no file names or folder paths, no verse text from the database) with a fixed
   instruction ("name the Bible references this passage quotes or paraphrases; answer with references only"), sent to
   the AI service you choose with your own key, one paragraph per request, shown to you in full before it is sent; what
   comes back is references only, each checked against the database (one that is not a verse is dropped, any
   quotation the service adds is discarded), shown as a third kind of candidate labeled "From an AI, by meaning, your
   decision", never accepted in bulk and never by default. The `AGENTS.md` line would then read "…nothing suggested,
   except what you ask the AI tier for". Until you answer, the AI tier is neither built nor drawn beyond TG8.

## Open questions

None the existing decisions can answer. (Struck, answered by TG-3: does Accept write beside the page or into it? Into
it, as a scripture block. Struck, answered by TG-10: where do skips live? In the app's state folder.)

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-17 | TG1-TG13 | the one design: the three tiers, the pane, Accept's place, the handoff, the real conditions | not reviewed by the person; every decision is the overseer's inference (TG-1 to TG-14) |

## Data the sheets show

| File | Made by |
|---|---|
| `data/2ti2-15.json`, `data/rom8-28.json`, `data/pro27-17.json`, `data/num25-11-13.json`, `data/phi4-13.json` | `wb text "<reference>"` |
| `data/refs-spoken.json` | `wb refs --json "<the sample sentence>"` (shows today's reader of references, for TG2's note) |
| `data/parallel-search.json` | `wb search --json` on a 6-word window of Matthew 3 found in exactly 2 verses (Matthew 3:3, Romans 15:21): TG3's "also in" |
| `data/many-1.json` to `many-4.json` | `wb search --json` on 6-word windows of Jeremiah 7 found in more than 3 verses (15, 13, 82, 36): TG6 |

Scripture and lookups are fetched from the database, never typed. The note's own sentences on the sheets are a drawn
sample; where a sentence quotes a verse, the quoted words are cut from the fetched verse by word position (with a
filler word added between two of them, as speech makes it), never typed.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | TG9 (the Tether pane as one tab of four beside the page, the page's scroll untouched) |
| Floating | TG10 (the pane as a 340 px floating tab over the reader) |
| Narrow | TG11 (a 390 px phone: the page, and the candidate as a sheet reaching the bottom) |
| Years of study | TG12 (a 40 minute note: 6,412 words, one block, 179 candidates and 35 phrases; the strip), TG13 (the same page found again after 61 were added and 52 skipped; a study of 420 pages) |

## What the build must satisfy

Not built until the person marks the folder accepted. Each line is checked in a Rust test or the desk check on the
**generated scratch study** below, never the real folder. The corpus knows what it planted, so each line has an exact
expected result.

**The scratch study** (made by a generator in `scripts/`, from the database; `WB_STUDY_DIR` points at it): 420 pages;
one page "Word dump" of 7,500 words as a single block (a raw transcript) and one of 90 paragraphs; planted in them,
each from `wb text` or the database and never typed: 40 references written in usual forms; 25 spoken ("second
Timothy two fifteen", "Romans eight verse twenty eight", "John chapter three verse sixteen"); 60 exact quotations of 6
to 25 words; 30 quotations with 20% of the words dropped and two filler words inserted; 15 phrases found in more than
3 verses; 10 stretches that match 2 or 3 verses (parallels); 20 paraphrases made by dropping 50% of a verse's words so
no run of 6 survives; 5 decoys that are not verses ("Romans 40:2"). Its `expected.json` lists, for each planted item,
its block, character range and reference. The filler speech is from a fixed list and a test shows the list alone finds
no candidate.

- [ ] **Named, written.** `wb tether "Word dump" --json` lists each of the 40 written references with `tier: "named"`, the right reference and a `range` whose text equals what the person wrote; `wb refs --json` on the same text still prints what it did (TG2).
- [ ] **Named, spoken.** Each of the 25 spoken references is found with the range on the spoken words ("second Timothy two fifteen" → 2 Timothy 2:15; "Romans 8 verse 28" → Romans 8:28 and not the chapter); "one twenty three" after Psalms gives Psalm 123 and 1:23 is absent because Psalm 1 has 6 verses; a case that is valid both ways lists both (TG2, TG-8).
- [ ] **Not guessed.** None of the 5 decoys is a candidate; "verse 28" with no book before it is not a candidate; the two-letter words `wb refs` already refuses ("is 5:2") stay text.
- [ ] **Quoted.** At least 57 of the 60 exact quotations and 27 of the 30 with dropout are found, each with `tier: "quoted"`, the verse, `matched` and `of` word counts, and the range of the words; the `matched` words of the evidence are exactly those words in the note and in the verse, in order (TG3). A paraphrase (no run of 6) is not a candidate, and the window shows no verse for it (TG-7).
- [ ] **No false matches.** The filler-only page gives zero candidates. The 15 phrases found in more than 3 verses are not candidates and are counted in `many` (TG6, TG-6); the 10 parallels give 2 or 3 candidates each, linked by `also`, with no one preferred (TG-6).
- [ ] **Evidence, no score.** No field or word in the output or the window is a percentage, "strong", "likely", "best" or an order by strength; `wb tether` lists candidates in page order, by block then range (TG-2).
- [ ] **Accept writes a scripture block at the place.** `wb tether accept "Word dump" <id>` on a quotation in the middle of a paragraph splits that block at the sentence end after the range and puts ```` ```scripture ```` with only the reference between the halves; the two halves joined with one space equal the original block's text apart from whitespace at the cut; no verse text is in the file; `wb page blocks` shows block numbers up by 2 (TG4, TG5).
- [ ] **The place without punctuation.** In the single-block raw transcript with no full stops, Accept splits at the range's end; with a full stop within 40 words after the range, at it (TG-4).
- [ ] **A list item or a quote is not split.** On a candidate in an item, the scripture block goes after the item and the item's text is unchanged (TG-4).
- [ ] **Undo and the guard.** `wb tether accept … --undo TOKEN` (the token Accept printed) restores the page byte for byte; Accept on a block whose text changed since the run refuses with "the page has changed" and writes nothing (TG-5).
- [ ] **Accept all named.** `wb tether accept "Word dump" --all-named` adds all 65 named references in one operation and one token; undoing it once restores the page exactly. The quoted ones are not touched (TG-13).
- [ ] **Run again.** After accepting, `wb tether "Word dump"` lists those candidates with `status: "in_page"` and `new` reduced by the same number; after Skip, a candidate is `skipped` and stays so after the app restarts; deleting the app's state folder brings skips back and changes no page (TG-10).
- [ ] **Alternatives.** Accepting one verse of a parallel marks its others skipped; Skip on that one brings them back (TG-6).
- [ ] **The handoff.** After accepting 37 tethers, `wb tether verses "Word dump" --json` lists 37 references in page order, each with the verse text equal to `wb text` for the reference; `wb craft deck --page ID` and `wb docs plan` list the same 37 verses in the same order; every verse is checked in the finished file (documents D5, `AGENTS.md`) (TG7, TG-9).
- [ ] **Speed.** On the 7,500-word page, a run takes under 2 s with the index built and under 15 s without it, and the page stays editable during the run; the first candidates reach the list before the run ends (TG12). Added to `npm run measure`.
- [ ] **The Tether pane.** Find scripture… in the page's ⋯ opens the pane; the head reads "179 found in your words · 35 phrases in many verses"; ↓ steps candidates in page order and the page scrolls to each with the words marked; A accepts, S skips; the groups fold (TG1, TG2, TG3, TG12).
- [ ] **Among other tabs, floating, narrow.** As one tab of four, opening and closing the pane leaves the four tabs, the tab in front and the page's scroll as they were; floated at 340 px the evidence line, verse and the two buttons are whole; at 390 px the candidate is a sheet reaching the bottom edge with the same two buttons (TG9, TG10, TG11).
- [ ] **Years of study.** In the 420-page study the run reads only the page it is asked about; the page's list opens inside the list budget; "Show skipped (52)" lists the 52 (TG12, TG13).
- [ ] **No AI.** With the network blocked, every line above passes. Nothing in the run opens a connection (tested by the build's offline switch) (TG-1, TG-14).
- [ ] **The reader's place is kept.** Stepping through candidates, accepting some, and pressing Esc returns the page to the scroll position and selection it had before Find scripture… was opened; a candidate's reference clicked in the list opens the verse alone in a card ([words](../words/README.md) W4), and Back returns to the same candidate with the page where it was; Accept leaves the page scrolled to the new scripture block, and closing the pane leaves it there.
- [ ] **Commands.** Each action above is a `wb` command (below). `wb tether <page>` run twice on an unchanged page prints the same candidates and ids.
- [ ] **The study files.** Nothing changes format. The only writes are Accept's: scripture fences and a break in a block, in the page. The tests assert the study folder is untouched by `wb tether <page>` (a hash of the folder before and after).

### Commands (all required; none exists today)

| Window action | Command |
|---|---|
| Find scripture… (the run) | `wb tether <page> [--tier named\|quoted\|all] [--min-words N] [--version kjv\|ylt] [--json]`: prints a summary (`words`, `blocks`, counts of `named`, `quoted`, `many`, `new`, `in_page`, `skipped`) and candidates in page order. Each candidate: `id`, `tier`, `ref`, `verses`, `version`, `block`, `range` (characters in that block's Markdown), `words` (the person's words found), `evidence` (`kind`: `written`, `spoken`, `quote`; `matched`; `of`; the matched words in order), `text` (the verse, from the database), `place` (`after_block`, `split_at`), `also` (ids of the other verses the same words fit), `status` (`new`, `in_page`, `skipped`). Reads only; writes the index to the cache. |
| Phrases in many verses (TG6) | the summary's `many` list: `{words, verses: N, block, range}`; no id to accept |
| Preview (TG4) | `wb tether accept <page> <id…> --dry-run`: the blocks as they would be (before and after), no write |
| Accept (TG5) | `wb tether accept <page> <id…> [--expect HASH] [--json]` prints the block numbers added and an undo token; `--undo TOKEN` restores the page |
| Accept all named | `wb tether accept <page> --all-named` |
| Skip, Show again | `wb tether skip <page> <id…>`; `wb tether unskip <page> <id…>`; `wb tether skipped <page>` lists them |
| The verses in order (TG7) | `wb tether verses <page> [--text\|--json]` |
| Make slides… from here | `wb craft deck --page ID` (exists; documents D2) |
| Close the pane | no command (a window action; `wb do` reaches the line the command box takes if minimize gives it one) |

## Build plan (for helper agents; not started until the folder is accepted)

Each piece is its own branch-sized unit inside `feature/tether` (one branch, per `AGENTS.md`); the pieces are
separate files in a new `crates/wb-core/src/tether/` module, so they do not touch the same files. Do step 0 first.

| Step | Piece | Needs from others | Runs in parallel with |
|---|---|---|---|
| 0 | **The contract and the corpus.** (a) `tether/types.rs`: the candidate and summary structs above, with serde, and a JSON example in `crates/wb-core/tests/`. (b) The generator for the scratch study and `expected.json` (the planted items above), as `scripts/tether-corpus.*` and a Rust test helper; it uses only the database for scripture. | nothing | alone first; short |
| 1 | **Spoken and written references** (`tether/spoken.rs`): number words, "first/second/third", chapter and verse words, the offset map, `find_refs` through it; the "Romans 8 verse 28" fix; both readings when valid both ways. Unit tests from the corpus's spoken list. | 0 (types) and `commands::find_refs`, `places` | 2, 4, 6 |
| 2 | **The quotation matcher** (`tether/quote.rs` and `index.rs`): the word shingle index from the database (cached through `cache.rs`), the run rule of TG-7, the 1-3 and more-than-3 verse rule, consecutive verses into a passage, `--min-words`. Tests: the corpus's exact, dropout, phrase, parallel, paraphrase and filler sets. | 0 | 1, 4, 6 |
| 3 | **Anchoring** (`tether/anchor.rs`): a page's blocks (`pages::blocks`, kinds that are searched), the sentence end rule of TG-4, merging steps 1 and 2 into one candidate list in page order, `status` (`in_page` by the scripture fences already there), the candidate id (TG-10). | 1, 2 (their outputs; they can be stubbed with corpus candidates) | 4, 5 after 1 and 2 land |
| 4 | **Accept** (`tether/accept.rs`): the split and the fence through `edit_guarded`, `--expect`, one undo token for a batch, `--dry-run`, alternatives (TG-6); `tether::verses`. Tests on `expected.json` places, byte-for-byte undo. | 0 (types); a candidate list (a fixture is enough) | 1, 2, 6 |
| 5 | **The `wb` commands** (`crates/wb-cli/src/tether.rs`): `tether`, `accept`, `skip`, `unskip`, `skipped`, `verses`, the app's skip store (TG-10), the offline test, the folder-untouched test. | 0 for the shape; 3 and 4 to be real | 6 |
| 6 | **The UI** (`ui/src/tether.ts`, the Tauri commands in `app/src-tauri`): the pane, groups, candidate rows, the marks in the page, keys, the phone sheet, floating and tab forms, the strip (TG12). Built first against the JSON from step 0's example; wired to the real commands when 5 lands. | 0's JSON; 5 to be real | 1, 2, 4 |
| 7 | **Integration**: the corpus through the window (`measure/desk.mjs`), the speed budget, the return case, the deck plan check (TG-9), `coverage.md` row done, the guide entry. | all | last |

Parallel: after step 0, steps **1, 2, 4 and 6** are independent (four helpers). Step 3 starts when 1 and 2 have
stable outputs; step 5 when 3 and 4 do; step 7 last. The slowest line is 2 (the matcher), so it starts first. A helper
reads its piece's rows in this README and nothing else of the design.

## Out of scope / later

- The AI tier (TG8, "Needs the person" 1): neither built nor drawn beyond its disclosure.
- Matching a modern translation's wording: the database holds the KJV and the YLT; a note quoting another version
  will match few words (it says so in the summary as a count, not a suggestion).
- Reading audio, or importing a transcript: the person pastes or writes the dump into a page ([library](../library/README.md)).
- Lessons as pages and a lesson-script format: [documents](../documents/README.md) "Needs the person" 1.
- A reader's margin that lists the pages that name a verse: [marks](../marks/README.md) (Accept's blocks feed it once built).

## Overlaps

[overlaps.md](../overlaps.md): "The page's ⋯ menu" (library S31 adds one row, resolved here), "Tethers: written in
a page" (marks owns the model; tether only writes a reference into a page), "A verse's card from a list" (words W4,
agrees).
