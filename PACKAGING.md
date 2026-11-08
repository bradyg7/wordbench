# Building the package, the installer and the updates

Two things come out of this checkout. The **ZIP package** (`npm run package`) is what the store sells: the app, the
database, the notices and readable source in one archive. The **installer** (`npm run release`) is what the landing page
offers, and it updates itself: the page is published to GitHub Pages and the installer and update file are GitHub release
assets.

Build both on Windows. This checkout contains the scripts, but the Bible database (about 118 MB) lives outside git, and
the Tauri shell needs the Windows toolchain and WebView2.

## What the build needs

- Windows 10 or 11, 64-bit.
- Node.js 20 or newer (`npm ci` uses the committed `package-lock.json`).
- Rust stable with the MSVC toolchain (`rustup default stable-msvc`).
- Visual Studio Build Tools with **Desktop development with C++**.
- The Bible database. It is not committed; use the copy built by the Python repository, or pass any verified
  `workbench.db`. The build refuses a file that is not SQLite or is smaller than 1 MB.

## Build the ZIP the store sells

```bat
npm ci
npm run package -- --db "%USERPROFILE%\github\bible-workbench\datasets\workbench.db"
```

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

The bundle settings (`bundle.active`, `createUpdaterArtifacts`) belong to the installer and do not affect this ZIP: the
package builds with `--no-bundle`.

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

## The installer, and automatic updates

```bat
set TAURI_SIGNING_PRIVATE_KEY=%USERPROFILE%\.tauri\bible-workbench.key
npm run release -- --db "%USERPROFILE%\github\bible-workbench\datasets\workbench.db"
```

It checks that the three versions agree, that the endpoint is a GitHub release asset and the public key is set, and that
the signing key is in the environment; builds the interface, `wb.exe` and the Tauri app as an NSIS installer; copies the
installer (under its version's name and under the page's stable name), its signature and `latest.json` into
`dist\release\`; fills the version, the size and the download links into `site/index.html`; and prints the one
`gh release create` line that publishes it. It uploads nothing itself. `npm run check:release` runs the checks without
building, on any OS.

### Why the installer is not on the Pages site

GitHub Pages serves `site/`, and it cannot hold the installer: a release is about 150 MB (the Bible database is inside
it), past GitHub's 100 MB per-file limit for a repository and close to the 1 GB limit for a published site. So the
installer, its signature and `latest.json` are **release assets**, which GitHub serves from
`https://github.com/<owner>/<repo>/releases/latest/download/<name>` with no practical size problem.

That address is also what makes the updates work. `plugins.updater.endpoints` in `tauri.conf.json` is
`https://github.com/bradyg7/wordbench/releases/latest/download/latest.json`, and the page's buttons point at
`.../releases/latest/download/Bible-Workbench-setup.exe`. Because both read `releases/latest`, publishing a release
updates the page and the app's feed together with nothing to edit by hand. The endpoint is the only place the host is
written; the release script derives the page's links and the update file's URL from it.

**The repository has to be public.** Release assets of a private repository need a signed-in token, so a buyer's
download and the app's update check would both get a 404. If the source must stay private, keep this repository private
and put the installer and `latest.json` in a small public repository of their own, then change that one endpoint to it —
the page's links follow. GitHub Pages on a private repository also needs a paid plan, and the page itself has to be
public to be a public landing page.

### Turning the page on, once

1. Push the repository to GitHub (`bradyg7/wordbench`).
2. Settings → Pages → **Source: GitHub Actions**. `.github/workflows/pages.yml` publishes `site/` on every push that
   touches it, and can be run from the Actions tab (**Run workflow**).
3. The page is then `https://bradyg7.github.io/wordbench/` — that address is what to give people.

### One time: the update keys

Tauri refuses an update it cannot verify, so a release needs a key pair:

```bat
npm run tauri signer generate -- -w "%USERPROFILE%\.tauri\bible-workbench.key"
```

The updater plugin is in `app/src-tauri/Cargo.toml`; run `cargo check -p bible-workbench` once so `Cargo.lock` carries
it before packaging (the lockfile is committed and the package build uses `--locked`).

Put the public key (the one-line contents of the `.key.pub` file it writes) in `app/src-tauri/tauri.conf.json` at
`plugins.updater.pubkey`, and keep the private key outside the repository and backed up: **losing it stops updates for
every copy already installed**, and a leaked one lets someone else sign an update. `npm run release` refuses an empty
`pubkey`.

### Publishing a release

1. Change the version in `Cargo.toml`, `package.json` and `tauri.conf.json` (they must agree), add the release to
   `CHANGELOG.md`, and refresh the lockfiles (see **A new version** below).
2. Set the signing key, then run `npm run release -- --db <workbench.db>`.
3. Publish `dist\release\`: either the `gh release create` line the script prints, or a draft release on GitHub with the
   four files attached. `latest.json` must be an asset of the **latest** release, because that is what both the page and
   the app read.
4. Commit the page the script filled in (`site/index.html`, with the version, the size and the links) and push it; the
   workflow publishes the site.
5. Install the previous version on a clean VM and watch it offer this one (below).

Older releases and their installers stay online, so nothing has to be kept by hand. The update file names the version
and the signature of that version's installer; the app compares its own version with it, so publishing a lower version
does not push a downgrade.

### What the installer puts where

- The app, `wb.exe`, `README.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, `licenses/` and `datasets/workbench.db` are
  installed together in one folder under the account's `%LOCALAPPDATA%`, with no administrator rights. The Bible is
  found beside the program, as in the ZIP (`wb setup` names every place it looks).
- Settings stay in `%APPDATA%\Bible Workbench\settings.json`. The study folder is not touched by install, update or
  uninstall.
- An update downloads the whole installer again — the Bible database is part of it — so an update is about the size of
  the install. It runs in Tauri's "passive" mode: a small progress window, no questions beyond the one the app asks in
  its own dialog.

### Test an update before announcing it

On a clean Windows VM with no development tools:

1. Install the version that is published now, from the landing page.
2. Build and publish the next version.
3. Open the app: within about ten seconds it offers the new version. Accept. The window closes, the progress window
   runs, and the app opens again where it was, on the new version (the version is shown on the setup screen and in
   **More**).
4. Check that the study folder is untouched and that `datasets\workbench.db` still opens.
5. Open it again to check it does not offer the same update twice.

If the app never offers it: open the endpoint in a browser (it should download `latest.json`), check that
`plugins.updater.endpoints` and `pubkey` belong to the same key pair that signed the build, and check the app's version
is lower than the one in the file. `WB_NO_UPDATE_CHECK=1` opens a build without the check (the measuring scripts use
it).

## A new version

Change the version in all three places, then refresh the lockfiles:

```bat
npm version <version> --no-git-tag-version
cargo check -p wb-core -p wb-cli
```

Edit the version in `Cargo.toml` under `[workspace.package]` and in `app/src-tauri/tauri.conf.json`; the build stops if
they disagree. Add the release to `CHANGELOG.md`, then rebuild and test both the ZIP (`npm run package`) and the
installer (`npm run release`).
