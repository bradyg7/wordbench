# Bible Workbench

Bible Workbench is a Windows desktop app for reading source text, looking up words, and keeping your own notes in local Markdown and JSON files. The Rust core serves both the app and the `wb` command line.

## Release status

Version 0.1.0 is a development version, not an available signed pilot installer. The release integration combines the current desktop and standalone data provisioning with customer setup, manual activation, installer preparation, and the separate six-page website. Public release metadata remains unavailable.

Start with [the current specification](docs/SPEC.md), [the pilot release checklist](docs/RELEASE.md), [distribution operations](distribution/README.md), and [repository instructions](AGENTS.md). Historical desktop results are in [docs/phase2-results.md](docs/phase2-results.md).

## Private pilot

Each invited person may activate two computers. The owner can issue a replacement activation when a computer is replaced. Pilot updates are included. Once activated, that version works permanently offline without a renewal check. Pricing is not set. Activation uses a manually exchanged request and signed certificate; no online activation service is required.

The customer NSIS installer is prepared by `npm run release:prepare -- --staging <approved-folder>`. Customer builds include both executables, reviewed Bible and dictionary databases, application terms, and third-party notices. They validate bundled resources and use a separately chosen study folder. Missing or damaged resources require repair; they do not fall back to a developer checkout.

The optional automatic updater is excluded from pilot packages until its own signed update and recovery checks pass. Pilot updates can be delivered through a new approved installer.

## Development

```text
npm ci
npm run build
cargo test -p wb-core -p wb-cli -p wb-license
npm run site:build
npm run test:distribution
npm run test:setup
npm run test:site
```

Provision local data using [data/README.md](data/README.md). Use disposable study folders for tests. Never run tests against the owner's real study folder or alter the read-only Bible database.

`npm run package -- --development-only` retains the older portable ZIP workflow for internal developer testing. It is not the licensed pilot release route. `scripts/install-app.ps1` is also a developer helper.

## Reading and study

- **Read.** The KJV and the YLT, chapter by chapter, in light, dark or e-ink colors. The app returns to the last place
  you were reading, with its scroll position.
- **Look at a word.** Click any word for its Strong's number, the original Hebrew or Greek, the transliteration, the
  lexicon entry, its parsing and the English rendering. Open the interlinear for a verse, a range, a chapter or a whole
  book; Hebrew reads right to left with its combining marks.
- **Study a word.** Every use, a count by book, the forms of an English word, words that come near each other, and BDB
  for Hebrew and Aramaic. A rendering can be followed on its own: the verses where this word is translated that way.
- **Write.** Notes on a word, a phrase, a verse or a Strong's number; highlights in layers; threads that collect places
  in the order you choose; questions queued for later. The Notebook gathers your Journal, Inbox, all notes, and a place
  to put an unplaced note.
- **Find.** Search the KJV, including phrases and regular expressions; search your own notes, threads and questions; or
  jump straight to a reference.
- **Keep your place.** Passages open in panes beside the chapter, not instead of it. Closing a pane or following a
  reference always brings you back to the verse you came from.
- **Plan.** Reading plans with today's reading, what you have read, and ways to catch up or spread the rest.
- **Drive it from the keyboard.** A command field takes the same language as `wb.exe`, with a command list and a full
  manual in **Help**.

The reader shows scripture verbatim, with its reference. It adds no commentary, devotionals or doctrine.

## Study files and recovery

Study files remain outside the installation. Licensing does not encrypt or delete them. `wb license recovery` reports the configured folder without activation. Back up your study folder before changing versions. Verify upgrade and uninstall preservation with disposable data before any customer release.

Legacy Trash and transactional page Undo have different retention behavior; use the app's current action descriptions. Existing Python-format study files remain readable. Rust now owns continued development and standalone provisioning.

## Pilot command line

```text
wb setup
wb setup new <absolute-folder>
wb setup open <absolute-folder>
wb license request
wb license import <certificate-file>
wb license status
wb license recovery
```

`wb build-info --json` reports the public build identity without setup or activation. Study commands require activation in a customer build. Developer builds retain their separate setup and scratch workflows.

## Distribution and ownership

Application terms are separate from third-party licenses and must be reviewed before release. The [data inventory](distribution/DATA-INVENTORY.md) records exact source evidence and unresolved conditions. Existing third-party notices are not blanket clearance of every candidate database. No source, personal study files, issuer key, or operator audit ledger is implicitly included in a customer installer.
