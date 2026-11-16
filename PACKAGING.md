# Building the package

The package is a Windows app, so build it on Windows. This checkout contains the build scripts, but the Bible database
(about 118 MB) lives outside git, and the Tauri shell needs the Windows toolchain and WebView2.

## What the build needs

- Windows 10 or 11, 64-bit.
- Node.js 20 or newer (`npm ci` uses the committed `package-lock.json`).
- Rust stable with the MSVC toolchain (`rustup default stable-msvc`).
- Visual Studio Build Tools with **Desktop development with C++**.
- A verified Bible database. Follow the [local provisioning instructions](data/README.md) to build
  `datasets/workbench.db` from the locked inputs. The package script requires SQLite and at least 1 MB.

## Build it

```bat
npm ci
npm run package
```

The packager checks `--db <file>`, `WB_BIBLE_DB`, then this checkout’s `datasets/workbench.db` in that order.

The script:

1. checks that `Cargo.toml`, `package.json` and `app/src-tauri/tauri.conf.json` all carry the same version;
2. builds the interface, the Tauri app (`--no-bundle`) and the `wb` CLI;
3. stages `dist\Bible Workbench-<version>\` with the two programs, `datasets\workbench.db`, the README, notices,
   changelog, license texts and `source/`;
4. writes a `DEPENDENCIES.md` from the app's own Cargo dependency graph (resolved for Windows) and checks that every
   license it names has a text in `licenses/`;
5. writes `dist\Bible-Workbench-<version>-windows-x64.zip` with no archive comment and no symbolic links;
6. runs the package checks and exits non-zero if one fails.

`--skip-build` packages programs already in `target\release` (for trying the checks); `--skip-deps` skips the inventory.
Do not use either for a package you intend to upload.

If `npm run package` stops for a missing license text, add the named file to `licenses/` (the SPDX identifier is the
file name) and run it again.

## Test the ZIP before uploading

Test the ZIP itself, not the staging folder, on a clean Windows machine or VM with no development tools:

1. Copy the ZIP over, unzip it somewhere writable, and run `Bible Workbench.exe`.
2. Choose a new, empty notes folder on the setup screen and start reading.
3. Open a chapter, click a word, open the interlinear, search, make a note, a highlight and a thread, and close and
   reopen the app to check that it returns to the same place.
4. In a terminal in that folder, run `wb.exe status`, `wb.exe reader NUM 25` and `wb.exe do "go John 3:16"` while the
   window is open.
5. Disconnect the network and repeat the reading and note taking; nothing in the app needs it.
6. Check that `datasets\workbench.db` is unchanged after the run, and that the notes folder holds plain files.

Only upload the ZIP the script wrote. A ZIP made by `git archive`, GitHub's **Download ZIP**, or re-zipped by hand can
carry a comment or directory entries that the package rules refuse.

## The rules the checks cover

The archive is checked for: no comment; at most 10,000 entries; at most 250 MB compressed and 1 GB extracted; at most
100:1 overall and 200:1 per file; names that work on Windows and on case-sensitive systems; no blocked executable
types, device names, trailing periods or spaces; no symbolic links; a top-level README, third-party notices, dependency
inventory and license texts; a SQLite database at `datasets/workbench.db`; at least one `.exe`; and readable `source/`.

## A new version

Change the version in all three places, then refresh the lockfiles:

```bat
npm version <version> --no-git-tag-version
cargo check -p wb-core -p wb-cli
```

Edit the version in `Cargo.toml` under `[workspace.package]` and in `app/src-tauri/tauri.conf.json`; the build stops if
they disagree. Add the release to `CHANGELOG.md`, rebuild, and test the new ZIP.
