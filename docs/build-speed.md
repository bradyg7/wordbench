# Build and test speed

> History, measured for worktrees in 2026-11. Today there is one Main clone, builders run only their own tests, and CI
> runs the full suites ([CODING_STANDARDS.md](../CODING_STANDARDS.md)); the `-j` and worktree advice below no longer applies.

Set 2026-11-17 (the person asked for a shared cache, a light test profile, a faster linker and nextest, measured).
Machine: Ryzen 7 8840HS, 16 threads, `-j 2`. Wall times were taken while another builder was sometimes compiling; CPU
seconds are the whole process tree. Everything was run from this branch; the suite is the same 275 tests, 0 failed,
before and after.

## Results

| Step | Command | Wall | CPU | Note |
|---|---|---|---|---|
| Baseline, clean | `cargo test -j 2 --no-run` | 932 s | n/a | fresh `target`, machine at ~26% load |
| Baseline, incremental (touch `wb-core/src/lib.rs`) | same | 181 s | 445 s | machine at ~59% load |
| Baseline, full run | `cargo test -j 2 --no-fail-fast` | 131 s | 309 s | `search_index` 44 s, `tether` 42 s, `cli` 15 s |
| + rust-lld, clean | same as clean | 893 s | 1583 s | quiet machine; changing the linker rebuilds everything once |
| + rust-lld, incremental | same, after touch | 98 s | 312 s | link of ~25 test binaries is the saving |
| + light dev profile, clean | clean, shared target | 4376 s | 3521 s | `opt-level = 1` for dependencies more than doubles the **first** build's CPU |
| + light dev profile, full run | `cargo test -j 2 --no-fail-fast` | 83 s (65 s warm) | 165 s (161 s) | `search_index` gone from the slow list, `tether` 42 s to 27 s |
| Second worktree, first build, shared target | `cargo test -j 2 --no-run` | **85 s** | 159 s | only 6 crates compiled; the clean build was 479 |
| nextest | `cargo nextest run -j 2 --no-fail-fast` | 239 s (193 s of tests) | 211 s | slower than `cargo test` (65 s) here |

### Release build (the installer)

| Build | Wall | CPU | Note |
|---|---|---|---|
| `npm ci`, `npx tauri build --no-bundle`, then `cargo build --release -p wb-cli`, with rust-lld | 2461 s (41 min) | 4384 s | the wb-cli step recompiled 136 crates, among them typst, krilla, resvg, hayro and wb-core |
| ONE call: `cargo build --release -j 2 -p wb-cli -p bible-workbench -F tauri/custom-protocol` | 1829 s (30 min) | 3237 s | every crate once; machine at ~36% load, so the saving is if anything understated |

Saving about 26% of the wall and the CPU (the first row includes about a minute of `npm ci`). `[profile.release]` is unchanged; rust-lld links the release app and wb-cli without errors, and the app executable comes out the same size from both routes (61 496 832 bytes; `wb.exe` differs by 54 KB because its features are now shared with the app's). The installer path is `npm run build` then the one cargo call; I did not run the desk checks on that executable, so the first install should be looked at by the person.

`marks_years.rs` does not exist on `main` yet, so it was not measured.

## What is kept

1. **Shared target folder.** Cargo keys third-party crates by name and version, not by where the checkout is, so a
   second worktree reuses all of them and rebuilds only the workspace crates (479 crates compiled once, then 6). Set it
   in the session that builds, not machine-wide:
   `$env:CARGO_TARGET_DIR = 'C:\Users\brady\cargo-target\wb'` (PowerShell). Cargo's lock makes two builds wait for each
   other, which is fine because builders run one at a time. Do **not** set it for the installer build in `wb-install`,
   which keeps its own `target`.
2. **rust-lld** (`.cargo/config.toml`, `linker = "rust-lld.exe"`). It ships with the Rust toolchain, so nothing is
   installed. `-C link-arg=-fuse-ld=lld` does nothing on the MSVC target (it keeps calling `link.exe`), which is why the
   linker is set instead. Incremental rebuild 181 s to 98 s. See the release check below.
3. **Light dev profile** (`Cargo.toml`: `debug = "line-tables-only"`, `[profile.dev.package."*"] opt-level = 1`;
   `[profile.release]` untouched). The full test run falls from 131 s to 65-83 s. The price is a much longer first
   build of the dependencies, paid once in the shared target and again only when `Cargo.lock` changes a dependency.
   Without the shared target this profile would be a loss on every new worktree.

## What is dropped

- **cargo-nextest**: slower than `cargo test` here (each test runs in its own process, and the tether and search tests
  repeat heavy set-up); it also skips doctests. It stays installed but is not the way tests run.
- **sccache**: not installed. The shared target gives the same reuse for dependencies without an extra daemon.

## A new worktree

```
npm install; npm run fixtures
$env:CARGO_TARGET_DIR = 'C:\Users\brady\cargo-target\wb'
cargo test -j 2
```
`.cargo/config.toml` and the profile come with the checkout. The very first build on a computer that has no shared
target yet takes about an hour (one-off).

## Estimates, not changed

- `spikes/sync` and `spikes/pdf` are workspace members and do compile and run in a plain `cargo test` (they showed in
  the run). `spikes/pdf` pulls typst-render, typst-assets and more. Setting `default-members` to the crates and the app
  would drop them from `cargo test` and `cargo build`; `cargo test --workspace` still runs them. Saving: roughly 5-10%
  of the first build, and nothing once the shared target holds them.
- Typst behind a feature of `wb-core`: `wb-core` depends on four typst crates (14 typst packages in `Cargo.lock`, plus
  fonts and their dependencies). Estimate, unmeasured: a third to a half of a clean build's CPU, and the same share of a
  `wb-core` rebuild's link time. It would need every test that makes a document to turn the feature on, so it is a
  design question for the person.

## Needs the person

- Windows Defender exclusions for the repo folder, `C:\Users\brady\cargo-target` and `%USERPROFILE%\.cargo`/`.rustup`
  (real-time scanning of thousands of small build files is a common source of slow builds). Only the person can set them.
