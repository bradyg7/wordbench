# Handoff: the Windows installer, automatic updates, and the landing page on GitHub Pages

For a Claude Code session on the Windows machine. Read `CLAUDE.md` first; its rules still hold throughout (scripture
verbatim from the database, no interpretation, never write to the real study folder, the Bible database is read-only,
every core action also reachable from `wb`, and **do not push anything without the person's go-ahead**).

## Where this stands

The code is written and inspected, but **nothing has been compiled, bundled or installed**: the machine that wrote it
had no Rust or Windows toolchain. The release script's checks pass; the Tauri build has never run.

Seven files are modified and two are new (as of this handoff):

```
 M CHANGELOG.md                       M app/src-tauri/src/main.rs              M site/README.md
 M PACKAGING.md                       M app/src-tauri/tauri.conf.json         M site/index.html
 M README.md                          M package.json                          M site/site.css
 M app/src-tauri/Cargo.toml           ?? .github/workflows/pages.yml          ?? scripts/release.mjs
 ?? docs/handoff-installer.md         (this file)
```

**Step 0 — get the change set.** It is uncommitted on branch `freebuff/314597166dc5cf47ed63049d` in the cloud
worktree. Either the person approves a commit and push of that branch and you `git fetch` it, or the files are copied
across. Check `git status` against the list above before starting; if it is already committed on the branch, just check
the branch out.

## What is already built

- `app/src-tauri/tauri.conf.json`: `bundle.active`, `targets: ["nsis"]`, `createUpdaterArtifacts: true`,
  `windows.nsis.installMode: "currentUser"`, resources (Bible database → `datasets/workbench.db`, `wb.exe`, README,
  notices, changelog, `licenses/`), and `plugins.updater` with `active`, `windows.installMode: "passive"`, an endpoint of
  `https://github.com/bradyg7/wordbench/releases/latest/download/latest.json`, and an **empty `pubkey`**.
- `app/src-tauri/Cargo.toml`: `tauri-plugin-updater = "2"`.
- `app/src-tauri/src/main.rs`: `check_for_update` (a thread that waits 10 s, `app.updater()?.check()`, a dialog with
  "Install it" / "Not now", `download_and_install`, then `app.restart()`; `WB_NO_UPDATE_CHECK=1` turns it off), the
  plugin registered, and the call at the end of `setup`. It must not block the reader: the first chapter is on screen
  before anything touches the network.
- `scripts/release.mjs` (+ `npm run release`, `npm run check:release`): version agreement, endpoint and pubkey checks,
  build, copy the installer, signature and `latest.json` into `dist/release/`, fill the page's markers, and print the
  `gh release create` line. It never uploads.
- `site/index.html` + `site/site.css`: a `#download` section and header link whose anchors carry `data-release="link"`
  (rewritten from the endpoint), with `data-release="version"` and `data-release="size"` markers.
- `.github/workflows/pages.yml`: publishes `site/` with `actions/deploy-pages` on pushes to `main` that touch `site/**`.
- `PACKAGING.md` and `site/README.md` describe all of the above, including why the installer is a release asset.

## The task, in order

### 1. Give the lockfile the new crate

```powershell
cargo check -p bible-workbench
git diff --stat Cargo.lock
```

`Cargo.lock` is committed and the release build is reproducible against it. Expect only `tauri-plugin-updater` and its
dependencies added. Fix any compile error in `main.rs` here — the updater API is the one part written blind. The calls
used are `UpdaterExt::updater(&AppHandle)`, `Update::check()`, `Update::download_and_install(|chunk, total| {}, || {})`,
`AppHandle::restart()`, and `MessageDialogButtons::OkCancelCustom(a, b)` whose `blocking_show()` returns `true` for the
first button.

### 2. Make the update key pair, once

```powershell
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\bible-workbench.key"
```

Put the one-line public key into `plugins.updater.pubkey` in `app/src-tauri/tauri.conf.json`. The private key stays
outside the repository and backed up — losing it ends updates for every installed copy; leaking it lets someone else
sign one. `npm run check:release` reports the empty key as a FAIL until this is done.

### 3. Check the pieces

```powershell
npm ci
npm run check:release
```

Every line must PASS. Before step 2 the public key and the three artifact checks fail; that is the only acceptable
failure.

### 4. Build the installer

```powershell
npm run release -- --db "$env:USERPROFILE\github\bible-workbench\datasets\workbench.db"
```

Watch for these, none of which the writing machine could test:

- `bundle.resources` reads `../../target/release/wb.exe`, so `cargo build --release -p wb-cli` has to run **before** the
  Tauri bundle (the script does it). A hand-run `npm run tauri build` will fail or ship a stale `wb.exe`.
- The 118 MB database is copied into the bundle: expect a slow NSIS link step and a ~150 MB installer.
- Tauri needs `TAURI_SIGNING_PRIVATE_KEY` to produce `*-setup.exe.sig`; without it `createUpdaterArtifacts` fails.
- After it finishes, `dist/release/` must hold `Bible-Workbench-setup.exe`, `Bible-Workbench-<version>-x64-setup.exe`,
  its `.sig`, `latest.json` and `notes.md`, and `site/index.html` must show the new version, size and link.

### 5. Install and uninstall it, on a clean VM

1. No administrator prompt; one folder under `%LOCALAPPDATA%`; an entry in Settings → Apps.
2. `datasets\workbench.db`, `wb.exe`, `README.md`, `THIRD_PARTY_NOTICES.md`, `CHANGELOG.md` and `licenses/` all beside
   `Bible Workbench.exe`, and the app opens a chapter without a setup screen.
3. `wb.exe status` from a terminal in that folder, and `wb.exe do "go John 3:16"` reaching the running window.
4. Uninstall removes the programs from that folder and leaves the study folder and `%APPDATA%\Bible Workbench` alone.

### 6. Decide where the assets live

Release assets of a **private** repository need a token, so a buyer's download and the app's update check would both
404. Either make `bradyg7/wordbench` public, or keep it private and create a small public releases-only repository —
then change **only** `plugins.updater.endpoints` to that repository and run `npm run release` again: the page's links and
`latest.json`'s URL are derived from it. GitHub Pages on a private repository also needs a paid plan.

Also note, for the person to decide: the installer is **not Authenticode-signed**, so SmartScreen will warn on first
download. The update key pair signs updates for the updater, not the file on disk. Fixing that needs a code-signing
certificate; do not pretend otherwise on the page.

### 7. Publish, then test the update path

```powershell
git push -u origin <branch>          # only with the go-ahead
gh release create v<version> --repo bradyg7/wordbench --title "Bible Workbench <version>" `
  --notes-file dist/release/notes.md --latest dist/release/Bible-Workbench-setup.exe `
  dist/release/Bible-Workbench-<version>-x64-setup.exe dist/release/Bible-Workbench-<version>-x64-setup.exe.sig `
  dist/release/latest.json
```

Then Settings → Pages → Source: **GitHub Actions**, and confirm `https://bradyg7.github.io/wordbench/` serves the page
with a download button that fetches the installer.

The update test, on the clean VM, with the previous version installed:

1. Open the app; within about ten seconds it offers the new version. Accept.
2. The window closes, the passive progress window runs, and the app reopens on the new version, in the same place,
   with the study folder untouched.
3. Open it again: it must not offer the same update twice.

If it never offers anything, in this order: fetch the endpoint in a browser (it should download `latest.json`), confirm
the app's version is lower than the file's, and confirm `pubkey` and the signing key are one pair.

### 8. Settle the version

`CHANGELOG.md` has the installer under "Unreleased" while `0.1.0` is already dated as released, so the first installer
should ship as **0.2.0**: `npm version 0.2.0 --no-git-tag-version`, then the same version in `Cargo.toml` under
`[workspace.package]` and in `tauri.conf.json` (the release script stops if the three disagree), then move that
changelog section to `## 0.2.0 — <date>`.

## Notes and traps

- `datasets/workbench.db` is gitignored and is never committed; `npm run package` for the store must keep working
  (`tauri build --no-bundle`, unaffected by the bundling settings).
- Do not hand-edit the page's version, size or link: `npm run release` writes them, and `npm run check:release` fails if
  a marker disappears or a link stops matching the endpoint.
- Keep `latest.json` on the *latest* release only; both the page and the app read `releases/latest`.
- The dialog and the restart loop were written from the API docs, not observed. If `download_and_install` returns
  `Ok` but the app stays on the old version, check whether the passive installer needs to own the process: on Windows
  the installer relaunches the app, so a second `restart()` can be wrong. Test on the VM before announcing anything.
- Say plainly what was verified and what was not. A green `npm run check:release` means the pieces agree, not that the
  installer runs.
