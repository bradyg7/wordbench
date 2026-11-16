# Third-Party Notices

Bible Workbench 0.1.0 includes the scripture, study data, fonts and software listed here. The full text of every license
named below is in `licenses/`, and every software package in the build is listed in `DEPENDENCIES.md`.

Bible Workbench's own code and text are copyright © 2026 its author, all rights reserved. See the License section of
`README.md`.

## Scripture

### King James Version (KJV)

The King James Version, 1611, in the public-domain text used by the database (marginal notes are not included). The KJV
is in the public domain in the United States. In the United Kingdom the KJV is subject to the Crown's letters
patent, administered by Cambridge University Press, Oxford University Press and the Royal Printer.

The text is shown verbatim, with its reference. Bible Workbench adds no words to it.

### Young's Literal Translation (YLT)

Robert Young, *The Holy Bible, Translated According to the Letter* (1862; revised 1898). Public domain.

The text is shown verbatim, including its own quotation marks and punctuation.

## Study data

### Strong's Greek and Hebrew dictionaries

James Strong, *The Exhaustive Concordance of the Bible* (1890; Hebrew dictionary 1894). The dictionaries are in the
public domain.

The Hebrew dictionary data used here is the edition prepared by the **Open Scriptures Hebrew Bible Project**
(<https://github.com/openscriptures/HebrewLexicon>), whose files are licensed under the
[Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/) (CC BY 4.0).
The project asks to be credited as:

> Original language data from the Open Scriptures Hebrew Bible Project.

Changes: the XML entries were converted into SQLite tables and indexes; duplicated entries were combined as the source
provides; no definition, transliteration or KJV-usage line was reworded. The underlying dictionary text remains in the
public domain.

### Brown-Driver-Briggs Hebrew and English Lexicon (BDB)

Francis Brown, S. R. Driver and C. A. Briggs, *A Hebrew and English Lexicon of the Old Testament* (1906). The lexicon is
in the public domain.

The digitized text used here is the XML edition prepared by the **Open Scriptures Hebrew Bible Project**
(<https://github.com/openscriptures/HebrewLexicon>), licensed CC BY 4.0. Attribution as above.

Changes: the entries were converted into SQLite tables and an index; entries are shown with the source file's own
transcription status, including where an entry is only partly transcribed. No entry was completed, abridged or
reworded by Bible Workbench.

### STEP Bible interlinear

The original-language text, word parsing, transliterations and English glosses in the interlinear come from **STEP
Bible** (<https://www.STEPBible.org>), whose data is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution:

> Data created by www.STEPBible.org based on work at Tyndale House, Cambridge. Text, parsing and glosses are from STEP
> Bible (www.STEPBible.org), licensed CC BY 4.0.

Changes: the data was converted into SQLite tables and joined to the KJV's verse numbers; words are shown in the order
the source gives them, and the gloss shown under each word is the source's gloss for that word in its sentence. The
source's own note applies: a Greek word that the Textus Receptus places in a different order from Nestlé-Aland keeps the
Nestlé-Aland position. No parsing or gloss was rewritten.

### Search index and word positions

The search index and the word positions used to draw and select words are derived from the KJV text (public domain) by
the database build. They contain no third-party text.

## Fonts

The app bundles three fonts through the Fontsource packages. Each is licensed under the
[SIL Open Font License, Version 1.1](https://openfontlicense.org/) (OFL-1.1); the full text is in
`licenses/OFL-1.1.txt`.

| Font | Copyright | Used for |
|---|---|---|
| Literata | Copyright 2017 The Literata Project Authors (<https://github.com/googlefonts/literata>) | Scripture |
| Inter | Copyright 2016 The Inter Project Authors (<https://github.com/rsms/inter>) | Interface |
| Noto Sans Hebrew | Copyright 2024 The Noto Project Authors (<https://github.com/notofonts/hebrew>) | Hebrew |

The fonts are included unmodified inside `Bible Workbench.exe`; they are not installed on the computer.

## Software

Bible Workbench is built with Rust and TypeScript. The complete, generated list of the Rust crates and JavaScript
packages in this build, with versions and license expressions, is in `DEPENDENCIES.md`. Their license texts are in
`licenses/`. The principal components are:

| Component | License | What it does |
|---|---|---|
| Tauri 2 and its plugins | MIT OR Apache-2.0 | The desktop shell and its native dialogs |
| `@tauri-apps/api` | Apache-2.0 OR MIT | The interface's calls into the shell |
| rusqlite / libsqlite3-sys | MIT | Reads the Bible database (SQLite) |
| serde / serde_json | MIT OR Apache-2.0 | Data between Rust and the interface |
| chrono | MIT OR Apache-2.0 | Dates in reading plans |
| fancy-regex / regex | MIT OR Apache-2.0 | Search and the command language |
| Fontsource packages | MIT (packages); OFL-1.1 (fonts) | Loading the three fonts |

No third-party source was modified for Bible Workbench. Where a package offers a choice of licenses, the permissive
option named in `DEPENDENCIES.md` is used; where a package requires several licenses, all of them are listed.

JavaScript packages are bundled into the interface; Rust crates are statically linked into `Bible Workbench.exe`. The
source code in `source/` is included for reading, not as a grant to redistribute the product.

## License texts

| License | File |
|---|---|
| 0BSD | `licenses/0BSD.txt` |
| Apache License 2.0 | `licenses/Apache-2.0.txt` |
| BSD 2-Clause | `licenses/BSD-2-Clause.txt` |
| BSD 3-Clause | `licenses/BSD-3-Clause.txt` |
| Boost Software License 1.0 | `licenses/BSL-1.0.txt` |
| Creative Commons Attribution 4.0 | `licenses/CC-BY-4.0.txt` |
| Creative Commons Zero 1.0 | `licenses/CC0-1.0.txt` |
| ISC | `licenses/ISC.txt` |
| GNU Lesser General Public License 2.1 or later | `licenses/LGPL-2.1-or-later.txt` |
| MIT | `licenses/MIT.txt` |
| MIT No Attribution | `licenses/MIT-0.txt` |
| Mozilla Public License 2.0 | `licenses/MPL-2.0.txt` |
| SIL Open Font License 1.1 | `licenses/OFL-1.1.txt` |
| Unicode License 3.0 | `licenses/Unicode-3.0.txt` |
| The Unlicense | `licenses/Unlicense.txt` |
| zlib License | `licenses/Zlib.txt` |

If a license text is missing from a copy of the package, the license is also published at
<https://spdx.org/licenses/> under the name in the table.
