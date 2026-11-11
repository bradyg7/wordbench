# Pilot integration verification - 2026-11-11

Scope: `codex/pilot-release`, integrating `origin/main` at `6de3ef0` and `codex/installer-port` at `248c45a`. This record describes source verification, not a production release. No push or deployment was performed.

## Passed checks

| Check | Result |
| --- | --- |
| `cargo test -p wb-core -p wb-cli -p wb-license --locked` | 214 passed, 0 failed, 0 ignored; real read-only local Bible DB supplied, disposable study paths. |
| Distribution library tests (same crates, `--features distribution --lib`) | 51 core + 1 CLI authorization + 5 license tests passed, including Windows DPAPI. |
| `cargo check --workspace --all-features --locked` | Passed after final runtime/build-info changes. |
| `cargo build -p wb-cli --locked` and `cargo check -p bible-workbench --locked` | Default developer mode passed; build-info reports distribution false. |
| `npm run build` | Integrated UI type check and production bundle passed. |
| `npm run test:site` | 14 passed, desktop and phone, built production site. |
| `npm run test:setup` | 5 passed, mocked Tauri setup/license bridge. |
| `npm run test:webkit -- --workers=2` | 55 passed, 15 intentional device-specific skips. |
| `npm run test:distribution` | 8 passed, including staged CLI identity rejection and exact-artifact candidate evidence checks. |
| `npm run test:downloads` | Synthetic HTTP endpoint suite passed: HTTPS proxy requirement, authorization, expiry, release allowlist, traversal, exact bytes and tampering. |
| `python -B scripts/release/smoke-cli.py --binary <customer-wb>` | 11 native CLI checks passed, synthetic DBs, isolated LOCALAPPDATA, unrelated working directory. No production issuer or real study data. |
| `python -B -m unittest discover -s scripts/release/tests -p test_dictionary_build.py` | 5 passed, including internal uppercase tables, suffix headings, duplicate senses, source pin and no overwrite. |
| Read-only data audit | All 14 raw input hashes, 11 Bible table fingerprints, corrected 102,572-entry dictionary fingerprint, and bundled export-font hashes verified. |
| Dependency notice collection | 497 package identities collected with available original texts; 29 missing local license-text records flagged for review. This is not redistribution approval. |
| Legacy ZIP entry point | Refused without explicit `--development-only`, before artifact writes. |

The exact data audit and outstanding dependency records are under [distribution/evidence](../distribution/evidence/). The dictionary's earlier 102,487-entry attempt was rejected during independent review because uppercase tables were misidentified as headings and suffix headings were missed. The final parser and tests correct those cases; only the final fingerprint is authoritative.

Browser fixtures were generated from the newly built, hash-audited Bible DB using the existing fixture script with its cargo-release invocation substituted in memory by the freshly built default debug CLI. No scripture fixtures were manually authored. The first WebKit attempt failed before test execution because the matching Playwright browser was absent; after installing that exact browser revision the suite passed. Initial sandboxed Python tests could not access new temporary directories; the same tests passed outside the sandbox using isolated disposable state. Generated screenshots and Tauri schema output are not release approval.

## Review fixes

- Preserved developer setup and moved customer setup to its separate installation entry point.
- Prevented customer IPC from selecting developer resources; kept recovery available with missing resources.
- Routed actual startup-open errors to setup instead of leaving the reader without a store.
- Made staged CLI version, distribution mode and public issuer trust mandatory packaging checks.
- Kept automatic update installation disabled; the optional feature only reports availability.
- Replaced the GPL-labeled third-party dictionary JSON with an independently parsed original source and recorded the behavior change.
- Added a read-only candidate gate binding recorded acceptance and review evidence to installer bytes and publisher identity.

## Unverified release gates

No final signed NSIS installer was built or exercised on a clean Windows machine. Native GUI activation with a production issuer, installer upgrade/uninstall/interruption, real publisher signing, deployed HTTPS/authenticated downloads, final application/privacy/support terms, territory disposition and complete third-party notice review remain open. No production key or real pilot license was generated. The service's loopback tests do not validate a production reverse proxy. The candidate verifier checks recorded assertions and signatures; it does not independently establish rights or run acceptance tests.

The source can be reviewed and merged separately from launch approval. Keep `site/public/release.json` unavailable until [the release checklist](RELEASE.md) is satisfied.
