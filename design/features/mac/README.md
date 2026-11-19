# Wordbench on a Mac

**State:** accepted (the person, 2026-11-19), round 1 · No sheets: what a Mac user sees is macOS's own windows and the site's
guide, drawn in the guide itself.

Roadmap step 3 (the person, 2026-11-19): a free, updateable Mac download with a clear install guide, on the website
beside Windows. Until both platforms have this, feature work waits.

## What stands in the way today (survey of `main`, 2026-11-19)

| Where | Windows-only today | On a Mac |
|---|---|---|
| `wb-core/src/runtime.rs`, `cache.rs`, `dictionary.rs` | `LOCALAPPDATA`, and runtime refuses to start without it | `~/Library/Application Support/bible-workbench-rs/` (setup.rs already does this) |
| `wb-core/src/docs/mod.rs`, `findings.rs` | "Show in folder" runs `explorer.exe` | `open -R <file>` / `open <folder>` |
| `app/src-tauri/src/main.rs` `fail()` | a Windows message box | a native alert (or stderr only; the window cannot open anyway) |
| `wb-license` | `#[cfg(windows)]` parts | already has a `not(windows)` branch; check it builds |
| `tauri.release.conf.json` | `targets: ["nsis"]` | adds `app` and `dmg`; the updater uses `.app.tar.gz` + `.sig` |
| `release.yml`, `publish.mjs` | one Windows job; `latest.json` lists `windows-x86_64` only | a macOS job building one universal app (Apple silicon and Intel); `latest.json` lists `darwin-aarch64` and `darwin-x86_64` too, written once both jobs finish |
| site Download | Windows only | a Mac button (stable link `Wordbench-mac.dmg`) and the Mac guide |

Icons: `icon.icns` already exists.

## Proposed (round 1, for the person's review)

- **M-1 Unsigned first.** The Mac app is built without an Apple Developer account (no $99/year): ad-hoc signed only,
  which Apple silicon requires and Tauri does by itself. macOS then refuses the first open with "Apple could not verify
  Wordbench is free of malware". The guide shows the way past it (M-3). Signing and notarizing later removes the step
  and changes nothing else.
- **M-2 One download for every Mac.** A universal `.dmg` (Apple silicon and Intel), macOS 11 or newer. Drag Wordbench
  to Applications, as usual.
- **M-3 The guide**, on the Download page under "Mac", with pictures:
  1. Open the `.dmg`, drag Wordbench into Applications.
  2. Open Wordbench. macOS says it could not verify it: choose **Done** (not Move to Bin).
  3. Open **System Settings → Privacy & Security**, scroll down, choose **Open Anyway** beside the Wordbench line,
     confirm with your password or Touch ID. (On macOS 15 and later, right-click → Open no longer skips this.)
  4. It opens from then on like any app. Updates arrive inside the app and need none of this.
- **M-4 Updates on the Mac** work as on Windows: the app checks `latest.json` when it opens and offers the new version;
  the same update key signs both.
- **M-5 Study folder and Bible database** are where a Mac keeps app data (`~/Library/Application Support`); the study
  folder is the one the person chooses at setup, as on Windows.

## Decisions (the person, 2026-11-19)

- **M-1 accepted: unsigned first.** No Apple Developer account yet.
- **M-6 No Mac to test on yet.** The Mac download is built and published anyway, and the site marks it **"Not yet tried
  on a real Mac"** until rows 3 and 6 are checked by someone with one; then the line is removed. GitHub's Mac machine
  proves it builds and its tests pass (row 4).

## Open questions

None.

## Interaction table

| # | Where | Action | What the person sees | What changes | Command | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | site Download | **Download for Mac** | the browser downloads `Wordbench-mac.dmg` | none | none | site.spec | [ ] |
| 2 | site Download | read the Mac guide | steps M-3 with pictures, and "Not yet tried on a real Mac" (M-6) | none | none | site.spec | [ ] |
| 3 | Finder | open the dmg, drag to Applications, open, Open Anyway | the app's setup screen | app data folder made | none | a real Mac (open question 1) | [ ] |
| 4 | the app on a Mac | everything Windows does | the same app | the same files | `wb` (built for Mac) | `cargo test` and the webkit tests on GitHub's Mac machine | [ ] |
| 5 | the app on a Mac | Show in folder (documents, findings) | Finder with the file selected | none | none | a Rust test of the command line built | [x] |
| 6 | the app on a Mac | opens when a newer release exists | the update offer; after it, the new version | the app replaced | none | a real Mac, across two releases | [ ] |
| 7 | GitHub | push a tag `v*` | both platforms built and published; `latest.json` lists both | releases repo | none | the release run | [ ] |

## Tickets

- **M1** The code: app data paths, Show in folder, `fail()`, wb-license; a CI job running `cargo test` on macOS (rows 4, 5).
  **M1 built** (2026-11-19): `platform.rs` (data folder, Show in folder commands, test `show_commands_per_platform`), `.github/workflows/mac-tests.yml`. Row 5 ticked; row 4 stays open until that workflow's first green run.
- **M2** The release: a macOS job in `release.yml` (universal dmg and `.app.tar.gz`), `publish.mjs` writing one
  `latest.json` for both, the stable `Wordbench-mac.dmg` (row 7).
  M2 built (row 7 proven by the first release run).
- **M3** The site: the Mac button and the guide (rows 1, 2), pictures drawn as the Windows warning is.
- **M4** The first real-Mac check (rows 3, 6), with the person or a tester.

## Out of scope / later

- Signing and notarizing (Apple Developer account).
- The app rename to Wordbench (site S-10); the Mac files are named Wordbench from the start.
