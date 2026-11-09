# R5: A word's English definition (`0e98`): the choice of source

Prepared 2026-11-09. This compares candidates and sketches the build. It does not choose, and nothing is built. Sources
were checked live on 2026-11-09; samples were pulled to a scratch folder outside the repo, none are in it.

The rule it is measured against (CLAUDE.md): *no interpretation: the app shows source text, the person's notes and lookups;
no commentary, no doctrine.* A plain dictionary defines; a Bible dictionary explains and teaches.

## The words used for the samples

From `words` in the Bible database (789,691 rows; 12,826 distinct lower-cased forms; KJV). The note's own example is
"envious":

| Word | Rows | Strong's it carries | First place |
|---|---|---|---|
| envious | 4 | H7065 | Psalm 37:1 (book 19, from the database) |
| charity | 28 | G26 | not looked up |
| prevent | 7 | H6923, G5348 | not looked up |

"prevent" is the useful test: its KJV sense ("go before") is the reverse of today's.

## The candidates

| | Webster's 1913 | Webster's 1828 | King James word list | Easton's (1897) | Tyndale Open Bible Dictionary |
|---|---|---|---|---|---|
| Kind | General dictionary | General dictionary | Glossary of KJV archaisms | Bible dictionary | Bible dictionary |
| Licence | Public domain (text); the Gutenberg copy carries Project Gutenberg's terms | Public domain (published 1828); the *digital* copies' terms are not stated | None found that I can confirm | Public domain; the CCEL file says so in its own `<DC.Rights>` | CC BY-SA 4.0, © 2023 Tyndale House Publishers (per freely-given.org) |
| Machine-readable form (checked live) | Gutenberg #29765 plain text, 29 MB: `https://www.gutenberg.org/cache/epub/29765/pg29765.txt` (HTTP 200). Already parsed to JSON: `https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json` (200, 22.5 MB, 102,217 headwords, word to one text string) | **No confirmed file.** Only `CrossCrusaders/Websters1828API` surfaced (MIT code; its `src/` holds just `main.js`, and the per-word files it reads are not in the repo I could reach). archive.org was unreachable from here | **No open file found.** Candidates seen: a blog's archaic-word list (licence not stated), `zweatshirt/bible_project` (marked "No Licence", so not usable), commercial products | CCEL ThML (XML): `https://www.ccel.org/ccel/easton/ebd2.xml` (200, 7.5 MB, 3,962 entries, 2.5 MB of text) | The site `tyndaleopenresources.com` returned HTTP 520 (down) on 2026-11-09. I could not find or fetch a zip; the licence comes only from the Open Bible Data site's page. Format unverified |
| Size | ~22 MB JSON | not known | small (hundreds to ~1,000 words) | ~7.5 MB source, ~2.5 MB text | not verified |
| Joins to the database's words | Headword is the plain lower-case word; exact match on `lower(words.text)`, then a small plural/-ed/-ing fold. Covers every English word, including ones that are not Bible words | Same, if a file is found | Fits best by design (words whose KJV meaning changed), but small coverage | By headword, but it holds Bible terms (people, places, objects), not ordinary words | Same as Easton's |
| Strong's join | None directly. A Strong's entry has no English headword; go through `words`: a Strong's number to the English forms it is rendered as, to the dictionary. That path already exists | same | same | same, plus scripture refs in entries | same |

Reading the table:
- **Webster's 1913** is the only candidate with a confirmed, open, complete, machine-readable file that covers ordinary
  English. It is dated: Webster's marks senses `[Obs.]`, and the 1913 text includes some obsolete senses, which is what a
  KJV reader needs (see "prevent").
- **Webster's 1828** is the better period match for the KJV (Noah Webster knew the KJV and quotes it), but I found no
  confirmed machine-readable copy whose terms I can state. Picking it means someone has to find one first.
- **A King James word list** is closest to the need and smallest, but no open, licensed list exists that I could verify.
  It would have to be compiled, and a compiled list is the app's own work, not a source.
- **Easton's** has a clean public-domain file but has few ordinary words (no entry at all for "envious", "envy" or
  "prevent"; "charity" is there).
- **Tyndale** is share-alike (a derivative database would carry the same licence, plus attribution), its file is not
  confirmed, and its home site was down.

## Three sample entries, quoted from the sources

Webster's 1913, from `matthewreagan/WebstersEnglishDictionary` (Webster's Revised Unabridged Dictionary, 1913, via
Project Gutenberg, 2009 edition; the README warns of known errors and omissions). Cut for length where marked.

**envious**: "2. Feeling or exhibiting envy; actuated or directed by, or proceeding from, envy; -- said of a person,
disposition, feeling, act, etc.; jealously pained by the excellence or good fortune of another; maliciously grudging; ...
Neither be thou envious at the wicked. Prov. xxiv. 19. Keble." (Sense 1: "Malignant; mischievous; spiteful. [Obs.]")

**prevent**: "1. To go before; to precede; hence, to go before as a guide; to direct. [Obs.] We which are alive and remain
unto the coming of the Lord shall not prevent them which are asleep. 1 Thess. iv. 15." Then "2. To be beforehand with"
and "3. To intercept; to hinder; to frustrate."

**charity**: "1. Love; universal benevolence; good will. Defn: Now abideth faith, hope, charity, three; but the greatest of
these is charity. 1. Cor. xiii. 13. ... 2. Liberality in judging of men and their actions; ... 3. Liberality to the poor ...
4. Whatever is bestowed gratuitously on the needy ... alms; any act of kindness."

Easton's Bible Dictionary (M. G. Easton, 1897; CCEL ThML), the same three words:

**charity**: "(1 Cor. 13), the rendering in the Authorized Version of the word which properly denotes love, and is
frequently so rendered (always so in the Revised Version). It is spoken of as the greatest of the three Christian graces
(1 Cor. 12:31-13:13)."

**envious**, **prevent**: no entry. (Easton's has "Jealousy" and "Publican", but not these.)

Not sampled: the 1828, the KJV list and Tyndale (no file reachable, see above). I will not paste a definition I have not
read from its file.

Note the pattern: the 1913 text defines; Easton's "charity" names a Christian grace, which is an explanation of the
word's use, not its meaning, and it tells the reader what to take from the verse. That is the line the rule draws.

## Doctrinal content in each source

- **Webster's 1913**: mostly plain. It also defines religious words, and some of those read as one tradition's view,
  for example "baptism" ("...as a sacrament or religious ceremony, by which he is initiated into the visible church of
  Christ. This is performed by immersion, sprinkling, or pouring."). Its quotations also come from Milton, Shakespeare
  and others, so a long entry is a lot of text that is not the definition. Each entry would need to be shown only
  as far as its numbered senses.
- **Webster's 1828**: known for definitions with Christian content, because Webster wrote theology into many entries.
  I could not read a file to cite examples, so this is from general knowledge, unverified here.
- **King James word list**: low, if it is limited to word meanings. Any compiled list's "meaning in this verse" notes
  would be interpretation.
- **Easton's**: heavy. Its own description says its theology "is decidedly Protestant". Entries read in the file: "Justification"
  ("A forensic term... the judicial act of God, by which he pardons all the sins of those who believe in Christ...");
  "Holy Ghost" ("The third Person of the adorable Trinity. His personality is proved (1) from..."); "Atonement". Also
  most doctrinal terms. Entries such as "Publican", "Jealousy" or "Conversation" are close to plain definition. It is a
  teaching text throughout, so it cannot be used without a filter, and a filter is the app deciding which entries teach.
- **Tyndale**: a modern teaching dictionary, with articles for each book, people, places and terms, so it has the same
  problem as Easton's. (From its description; the text itself was not reachable.)

## Where it shows, and which `wb` command

The verse card's *Definitions* tab (workspace-design W5, today blank "until tier 7's dictionary is chosen"):

- Tap a word in the verse, or a word in a Strong's / BDB entry or in the person's own notes, and the Definitions tab
  lists the words of that verse: each English word (underlined where the source has an entry), and the entry beneath it
  as the source's numbered senses, verbatim.
- Under every entry: the source's name, year, and licence ("Webster's Revised Unabridged Dictionary, 1913. Public
  domain."), as the Bible versions show theirs.
- A word with no entry says "not in this dictionary" and nothing else. Nothing is suggested or chosen for the person.
  Which sense applies in this verse is the person's call; the app does not mark it (the 1913's `[Obs.]` tag is shown, as the
  source's own text).
- The reader's place is untouched: closing the tab returns to the verse.

Build, once chosen: a read-only dictionary database file made by a script like the Bible's (text kept verbatim, source
and licence stored with it), opened with SQLite's read-only flag, in `wb-core` as a `dictionary` module.

```
wb word-define <word>             # the entry, verbatim, with source and licence
wb word-define <word> --verse "Prov 14:30"   # the words of that verse that have entries
wb word-define --strong H7065     # the entries for the English words that Strong's number is rendered as
wb word-define --source           # which dictionary, its licence and where it came from
```

It would get a case in `tests/golden/cases.json` only if the Python app gains the same command (it has none), so it is
listed as a known difference in `docs/phase1-results.md`.

## The question for the person

Which source should the Definitions tab use?

1. **Webster's 1913**: the only complete, open, machine-readable choice I could confirm; plain definitions, shown as
   numbered senses only; includes the obsolete senses KJV reading needs. Costs ~22 MB.
2. **Webster's 1828**: the better period fit, but a clean copy and its terms must first be found; I could not confirm one.
3. **A King James word list**: the closest fit to the need, but there is no open list to take; one would have to be
   compiled, which I recommend against (it becomes the app's own interpretation).
4. **Easton's or Tyndale's**: rule out under the no-doctrine rule as a whole source (Easton's has no entry for
   "envious" or "prevent" either); only if you want a separate, clearly labelled Bible-dictionary tab, which is a
   decision that the rule would need to allow.

Which, and if 1828, do you have a copy you trust?

## Decision (2026-11-09)

The person chose Webster's ("lets go with webster's"), taken as **Webster's 1913**, the only edition with a confirmed open
file (Gutenberg #29765 via `matthewreagan/WebstersEnglishDictionary`); if the 1828 was meant, a trusted copy is needed
first.

## Built (2026-11-09)

- `scripts/build-dictionary.py` makes the read-only `dictionary.db` (102,217 entries, headword and text verbatim, the
  source and licence in `meta`). Default place: `%LOCALAPPDATA%ible-workbench-rs\dictionary.db`, or `WB_DICT_DB`.
  It is not in the repository (22 MB); run the script once on a new computer (it downloads the JSON to a temp file).
- `wb-core::dictionary`: opens it read-only; `entry` (the word, else with an ending taken off: ies, ed, ing, eth, s...),
  `words_of` (a place's words, each once, with its entry).
- `wb word-define <word>`, `--verse <place>`, `--source`. Not in the Python `wb`, so no golden case.
- The verse card's Definitions tab: the verse's words that have an entry as buttons; a click shows the entry with the
  dictionary's name, year and licence under it. No dictionary built: the tab says so and how.
- Differences from the sketch above: an entry is shown whole, as stored. Cutting it to its numbered senses would mean
  rewriting the source's text. Some entries begin with a cross-reference line ("See 1st Frith.") as the source has it.
- Tests: `crates/wb-cli/tests/dictionary.rs` (a small dictionary made in the test; no dictionary text typed).
