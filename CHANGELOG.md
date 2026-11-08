# Changelog

All notable changes to Bible Workbench are recorded here. The version matches the app, the package and the source.

## Unreleased — the installer, and updates

- **A Windows installer.** `npm run release` builds an NSIS installer that puts the app, `wb.exe`, the notices and the
  Bible database in one folder under the account's `%LOCALAPPDATA%`, with no administrator rights and an uninstaller in
  Settings → Apps. The ZIP package is unchanged and still the one the store sells.
- **Automatic updates.** The app reads a signed update file when it opens, asks before installing, and opens again where
  it was. The check runs ten seconds after the first chapter is on screen, never during a note; `WB_NO_UPDATE_CHECK=1`
  turns it off. The update file is `latest.json`, a release asset, written by the release command.
- **The landing page offers the download, and is published on GitHub Pages.** A download section and a header link point
  at the release asset `Bible-Workbench-setup.exe`; `site/` is published by `.github/workflows/pages.yml`, and the
  version, size and links on the page are filled in by the release command.

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
