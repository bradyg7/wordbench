# Changelog

All notable changes to Bible Workbench are recorded here. The version matches the app, the package and the source.

## 0.1.0 — 2026-11-07

The first packaged release for Windows.

- **First-run setup.** If the Bible database or the notes folder is missing, the app opens a setup screen instead of
  closing: choose the database and the folder for your notes, with native file and folder pickers or a typed path.
  Settings are kept in `%APPDATA%\Bible Workbench\settings.json`.
- **The package finds its Bible.** The database is read from `datasets/workbench.db` beside the program, then from the
  application-data folder, then from the earlier development path. `WB_BIBLE_DB` and `--db` still win.
- **`wb setup`.** The same choices from a terminal: `wb setup` shows the paths and where the app looked,
  `wb setup study <folder>` and `wb setup database <file>` set them.
- **Readable source and notices in the download.** `source/`, `DEPENDENCIES.md`, `THIRD_PARTY_NOTICES.md` and the full
  license texts in `licenses/` ship with the app.
- **A package build.** `npm run package` builds the app and the CLI, stages the database and documents, and writes a
  ZIP with no archive comment; `npm run check:package` checks it against the package rules.
- **Version 0.1.0.** The workspace, the app and the package now carry one honest pre-1.0 version.

The desktop features of phase 2b are unchanged: the reader (KJV and YLT), Strong's, BDB, the interlinear, search and
word study, notes, highlights, threads, the Notebook, questions, reading plans and the `wb` command language.
