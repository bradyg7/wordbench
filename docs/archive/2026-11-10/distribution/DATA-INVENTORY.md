# Runtime data inventory — 2026-11-09

Evidence tier: **Identified Primary (local record)**. Inspected the predecessor app's `datasets/provenance.jsonl` and this repository's `scripts/build-dictionary.py`; those files record the following origins and license labels. This inventory does not independently establish redistribution rights. No study content was read or copied.

| Bundled component | Recorded source | Recorded license label |
| --- | --- | --- |
| KJV text/Strong's tagging | eBible/CrossWire `eng-kjv2006_usfm.zip` | Public domain; record flags UK printing restriction |
| Greek Strong's dictionary | morphgnt/strongs-dictionary-xml | CC0 1.0 |
| Hebrew Strong's, BDB, lexical index | openscriptures/HebrewLexicon | CC BY 4.0 |
| YLT | scrollmapper/bible_databases | Public domain; repository code separately MIT |
| Greek/Hebrew interlinear and morphology | STEPBible/STEPBible-Data, TAGNT, TAHOT, TEGMC, TEHMC | CC BY 4.0 |
| Webster's dictionary | Project Gutenberg 29765 through matthewreagan/WebstersEnglishDictionary | Builder labels underlying text public domain |
| UI/export fonts | Fontsource packages and `crates/wb-core/fonts/` | Local font license files must be included/reconciled |

**Unverified/Flagged before distribution:** reconcile this list with actual built DB tables; pin source revisions and hashes; verify each upstream notice; retain attribution and transformation descriptions; resolve territorial restrictions and dictionary redistribution conditions; inventory Rust/JavaScript/runtime dependency notices. Do not enter `redistribution: approved` until a review record supports it. Application terms remain separate from third-party notices.

No datasets have been added to the repository or prepared for public distribution by this milestone.
