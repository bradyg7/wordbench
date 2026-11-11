# Runtime data redistribution record

Reviewed 2026-11-11. **Evidence collected; distribution is not approved.** This record replaces the preliminary source-label inventory. It covers the exact locked Bible inputs and the new direct-source dictionary builder. It does not claim that the signed release, territory policy, application terms, dependency notices, or clean-machine acceptance are complete.

## Exact sources and immutable identities

[Machine-readable source evidence](evidence/source-review.json) records each input's original URL, byte size, SHA-256, credit, and immutable Git revision/blob where one exists. All 14 local input hashes were checked against `data/bible-sources.lock.json`. All 13 Git-hosted inputs also matched their upstream Git blobs. The eBible archive is identified by its exact content hash because its URL is mutable.

| Component | Immutable source identity | Primary license evidence | Imported tables |
| --- | --- | --- | --- |
| KJV text, tagging, titles and footnotes | `eng-kjv2006_usfm.zip`, SHA-256 `7c4e29ff3d1a10cef62c9ec3eed53078f1e7f8d0fe7812898b6a48abde965912` | [eBible copyright page](https://ebible.org/eng-kjv2006/copyright.htm): public-domain statement with a UK printing/import caveat | `books`, `chapter_titles`, `verses`, `words`, `footnotes`, KJV row in `versions` |
| Strong's Greek | morphgnt/strongs-dictionary-xml `dd6758b82f46b620804a8ea677d715844679eea1` | [Pinned README](https://github.com/morphgnt/strongs-dictionary-xml/blob/dd6758b82f46b620804a8ea677d715844679eea1/README.md): CC0 1.0, Ulrik Sandborg-Petersen | Greek rows of `lexicon` |
| Hebrew Strong's, BDB and index | openscriptures/HebrewLexicon `21c9add13bc727d3a951361778e97e3ff7afd1ce` | [Pinned readme](https://github.com/openscriptures/HebrewLexicon/blob/21c9add13bc727d3a951361778e97e3ff7afd1ce/readme.md): CC BY 4.0, Open Scriptures Hebrew Bible Project | Hebrew/Aramaic rows of `lexicon`, `bdb` |
| YLT | scrollmapper/bible_databases `59b18c5af5845728c275d5b7178ad0d024172b1f`, `formats/json/YLT.json` | [Translation notice](https://github.com/scrollmapper/bible_databases/blob/59b18c5af5845728c275d5b7178ad0d024172b1f/sources/en/YLT/README.md): public domain | YLT row in `versions`, `verse_texts` |
| TAGNT, TAHOT, TEGMC, TEHMC | STEPBible/STEPBible-Data `95927044f33c540073246306cea5b13f5a16eb02` | [Pinned README](https://github.com/STEPBible/STEPBible-Data/blob/95927044f33c540073246306cea5b13f5a16eb02/README.md) and file headers: CC BY 4.0, STEP Bible | `interlinear`, `morph_codes` |
| Webster dictionary, direct original text | Source SHA-256 `86fb9c28c32008ea288ca4bcf34f4f0d3d11ccf9e0898294d98b73671497f1d3`; header revision 2025-07-06 | [Publisher catalog](https://www.gutenberg.org/ebooks/29765): public domain in USA; [permission guidance](https://www.gutenberg.org/policy/permission.html), [terms](https://www.gutenberg.org/policy/license.html) | Separate database: `entries`, `meta` |

The STEP files' older headers request that raw data be obtained from upstream. Their public license is CC BY 4.0. The [upstream clarification at 5de0a47](https://github.com/STEPBible/STEPBible-Data/commit/5de0a47f35f0fc13dfe1430d104e5db8a4285f9c) clarifies redistribution and changes; it is not silently substituted for the locked input bytes. The application packages transformed tables, with attribution and changes stated in [data notices](notices/data-notices.txt).

## Dictionary source correction and behavior contract

The former builder used `dictionary_compact.json` at matthewreagan/WebstersEnglishDictionary revision `6fb9c92420c3a323e74ffb9d577409f4431cc42a`. Its [license section](https://github.com/matthewreagan/WebstersEnglishDictionary/blob/6fb9c92420c3a323e74ffb9d577409f4431cc42a/README.md#license) applies GPL version 2 to example output files as well as its parser. The public-domain origin alone did not establish that the JSON could be bundled without those obligations.

The default builder now independently parses the original publisher text. No third-party JSON or parsing code is used. `--text` accepts the exact hash-pinned text; automatic download rejects changed bytes. `--json` rejects with migration guidance. Existing dictionary databases remain readable, and builds refuse to overwrite an existing output.

The new database has **102,572 entries**, replacing the old 102,217-entry JSON build. Semicolon aliases share complete entry blocks; repeated headwords retain all senses in source order; wrapped headings are joined for indexing. Entry wording and punctuation are preserved, with transport line endings normalized and blank separators normalized between duplicate blocks. Publisher front/back matter is excluded from definitions; source acknowledgment remains in metadata and notices. This is an intentional source-data change, not byte parity with the old JSON. The independent parser pins the complete parsed-data fingerprint as well as the source hash.

## Reproduce the evidence

Use explicitly selected source folders and new scratch output paths. These commands never read the user's study folder or change an input database:

```powershell
python -B scripts/data/build-bible.py --raw C:\approved-inputs\bible --out C:\release-audit\workbench.db
python -B scripts/build-dictionary.py --text C:\approved-inputs\pg29765.txt --out C:\release-audit\dictionary.db
python -B scripts/release/audit-data.py --raw C:\approved-inputs\bible --bible C:\release-audit\workbench.db --dictionary C:\release-audit\dictionary.db --out C:\release-audit\data-audit.json
python -B -m unittest discover -s scripts/release/tests -p test_dictionary_build.py
```

The audit checks source-review/lock agreement, raw hashes, all 11 Bible table fingerprints and counts, absence of extra tables, read-only database integrity/schema, dictionary metadata and entry fingerprint, and bundled export font/license hashes. It emits no scripture or definition text. Missing optional inputs remain `not-supplied`. A successful audit always retains `redistribution: unreviewed`: integrity is not rights approval. The final staging record must attach the exact final database hashes, applicable territory decision, notices, and actual reviewer disposition.

## Remaining release conditions

1. Record the owner's distribution territories. eBible identifies a UK printing/import caveat, and the Webster publisher only asserts public-domain status in the USA. This review does not resolve the UK digital-use question or establish worldwide rights.
2. Include the data notices and complete relevant font/license texts in the installer. Preserve CC BY data rights in application terms; do not apply the application's copying restrictions to those sources or claim their licensors endorse the app. [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/legalcode.en).
3. Run `python -B scripts/release/collect-notices.py --out <new-private-directory>` to collect locked Windows distribution dependency identities, available original license/notice texts, and export-font licenses. Review missing evidence and obligations for the actual target/features, bundled JavaScript, all shipped font subsets, and the WebView2 distribution mode. The data notices alone are **not** the complete third-party notice artifact.
4. Bind the reviewed evidence to final database/installer bytes. Neither a prior development DB nor a successful raw-data build automatically approves a release.

**Identified Primary:** locally verified input bytes, immutable upstream Git trees, repository importers/schema, original publisher and license pages. **Identified Secondary:** predecessor provenance record, used to locate original sources and independently checked against bytes. **Unverified/Flagged:** final release approval, territories beyond the cited source statements, complete software/runtime notices, and final signed artifact identity.
