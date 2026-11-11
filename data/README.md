# Local Bible database provisioning

Use Python 3.8 or later with its standard library and a local directory containing the 14 files listed in [bible-sources.lock.json](bible-sources.lock.json). The lock records the filenames, sizes and SHA-256 hashes of the raw inputs verified against the predecessor’s provenance log. These inputs cover the eBible Strong’s-tagged KJV USFM, Scrollmapper YLT, morphgnt Greek Strong’s, the Open Scriptures Hebrew lexicon, BDB and lexical index, and the STEP Bible Greek, Hebrew and morphology files.

From the repository root in PowerShell, set the input directory and choose a new database path.

```powershell
$wbRaw = 'C:\path\to\verified-bible-inputs'
$wbDb = Join-Path (Get-Location) 'datasets\workbench.db'
python scripts/data/build-bible.py --raw $wbRaw --out $wbDb
$env:WB_BIBLE_DB = $wbDb
cargo run -p wb-cli -- books
```

Set `WB_STUDY_DIR` to a disposable study folder for tests and fixture generation. To save a database path for future sessions, use **Browse** in the app’s setup screen or run `wb setup database <absolute-file>`. The app and CLI try `WB_BIBLE_DB`, the saved choice, `datasets/workbench.db` and `workbench.db` beside the executable, then `datasets/workbench.db` in the application-data directory. The ZIP packager also accepts the database built at the checkout’s `datasets/workbench.db`.

For a rebuild, use a fresh output path. The builder publishes a completed database in the requested output directory after all checks pass. It leaves an existing output untouched.

The build-only importers were copied from the predecessor’s data pipeline. The generated database uses the same tables and column order with SQLite `user_version = 1`. Verification runs SQLite `quick_check` and compares the row count and SHA-256 digest of each of the 11 ordered tables to the reference. Each row is serialized as a compact UTF-8 JSON array followed by LF. The `words` digest covers the KJV word positions, text, punctuation, Strong’s links and formatting flags used by existing study anchors. The reference SQLite file’s SHA-256 identifies the file used to establish the baseline. Different SQLite versions can produce a different file hash with identical table content.

For the separate Webster database, the builder downloads the hash-pinned original publisher text or accepts it with `--text`. It uses an independent parser, preserves full entry blocks and repeated senses, and verifies all 102,572 indexed entries against a parsed-data fingerprint. Existing outputs are never overwritten. The old third-party JSON input is no longer used because its repository licenses example output under GPL v2.

```powershell
$wbDictionary = Join-Path (Get-Location) 'datasets\dictionary.db'
python scripts/build-dictionary.py --text 'C:\path\to\pg29765.txt' --out $wbDictionary
$env:WB_DICT_DB = $wbDictionary
cargo run -p wb-cli -- word-define --source
```

Both databases are opened read-only. Source hashes and table fingerprints establish reproducible content, not distribution approval. See the [exact source and redistribution record](../distribution/DATA-INVENTORY.md) for immutable upstream identities, source terms, the dictionary migration contract, notices, and the remaining territory and release checks. Run `python -B scripts/release/audit-data.py --help` for read-only artifact evidence collection.
