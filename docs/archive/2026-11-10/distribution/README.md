# Distribution foundation

The owner approved a private pilot with manual license issuance and permanent offline use after activation on 2026-11-09. `pilot-policy.json` records those choices; null values are unresolved, not defaults. Activated licenses must not require a renewal heartbeat or an expiry date. Revocation cannot reliably disable an already-activated permanently offline copy. Update entitlement and device allowance still need decisions.

## What runs now

- `npm run site:dev`: local six-page website at the URL printed by Vite.
- `npm run site:build`: type-check and build to `site/dist`, independently of the desktop UI.
- `npm run test:distribution`: release metadata and packaging-inventory checks, using synthetic temporary files only.
- `npm run test:site`: desktop and phone browser checks (installed Edge on Windows; Playwright Chromium elsewhere).
- `npm run release:check -- --staging <directory>`: read-only version, inventory, checksum, and recorded provenance checks. Without staging inputs this intentionally fails; it must not imply an installer exists.

`site/public/release.json` deliberately reports unavailable. Do not turn it into a published record until the actual signed installer, authenticated download route, activation service, and release acceptance checks exist. The website safely renders only validated public metadata and escapes release notes as text. `/downloads/<opaque-release-id>` is a contract for a future authenticated same-origin service, not an implemented download endpoint. No keys, signed storage URLs, customer data, or private object paths belong in public metadata.

The site builds real HTML entry points for `/`, `/download/`, `/releases/`, `/support/`, `/license/`, and `/privacy/`. Configure the eventual static host to serve directory indexes and return a real 404 for unknown paths. Keep the preview's `noindex` until approved launch copy and final notices are ready. There are no generated images, private screenshots, accounts, payment forms, or analytics integrations.

## Staging contract

Use an ignored `release-staging/` directory, or another explicitly chosen staging folder. Do not copy personal study files. `manifest.json` must have:

```json
{
  "schemaVersion": 1,
  "version": "0.0.1",
  "target": "windows-x86_64",
  "files": []
}
```

Supply exactly one file per role: `app`, `cli`, `bible`, `dictionary`, `application-terms`, `third-party-notices`. Each item has `role`, relative `path`, positive `bytes`, and the actual lowercase SHA-256 in `sha256`. Bible and dictionary entries also require `source`, `resourceVersion`, positive integer `schemaVersion`, `redistribution: "approved"`, and `evidence` pointing to a nonempty review record within staging. The checker resolves real paths to reject traversal/symlinks escaping staging. Never label unresolved rights approved merely to pass a check.

This preflight establishes inventory integrity, not legal clearance or executable authenticity. It does not run the installer, issue licenses, sign binaries, generate updater artifacts, or upload anything.

## Desktop packaging milestone

The explicit Cargo feature `distribution` selects installed paths for both app and CLI. Ordinary builds retain the original environment overrides, Python-repository DB default, scratch-study default, and measurement behavior. Customer builds ignore the developer DB/study overrides and exclude the remote-debugging environment flag.

Windows installed layout: `bible-workbench.exe` and `wb.exe` beside `resources/workbench.db`, `resources/dictionary.db`, and `resources/resources-manifest.json`. The GUI obtains the installation resource root through Tauri; the CLI resolves it beside its executable, independent of working directory. Both use `%LOCALAPPDATA%/bible-workbench-rs/installation/installation.json` for the selected study folder. DB sizes and SHA-256 hashes are checked against a versioned manifest before setup or startup. These hashes detect packaging damage; they are not a replacement for signed distribution.

First run presents a separate setup screen. The user types an absolute path and chooses a new folder or an existing one. A new folder's parent must exist; an existing folder is never silently replaced. Setup preserves the real-study guard and excludes the installation directory. No folder is created just by opening setup. Missing/damaged resources show a retry/repair explanation. The initial UI uses a path field; a native folder picker remains a usability follow-up.

The customer CLI exposes equivalent operations:

```text
wb setup
wb setup new <absolute-folder>
wb setup open <absolute-folder>
```

Prepare packaging only from reviewed, supplied artifacts:

1. Build the CLI with `cargo build --release -p wb-cli --features distribution`; build the app with the same feature and version. Record actual file hashes in the staging inventory. Ordinary developer binaries are not customer artifacts.
2. Supply reviewed DBs, terms, notices, and the six-role staging manifest above. See `DATA-INVENTORY.md` for the recorded source inventory and unresolved evidence.
3. Run `npm run release:prepare -- --staging <folder>`. It validates inputs, copies them into a new ignored bundle directory, verifies copied hashes, writes the runtime manifest, and generates an absolute-resource Tauri overlay. Existing staging folders are not overwritten.
4. Use the printed Tauri build command. The overlay enables the `distribution` feature, per-user NSIS packaging, the CLI and resource files, and offline WebView2 installation. The desktop app is rebuilt by Tauri; the staged app is an inventory input, not copied over that build.
5. Do not distribute the resulting unsigned package. Publisher signing, activation, updater signing, and clean-machine installation/upgrade/uninstall verification remain release gates.

This milestone does not claim a ready installer: approved artifacts, application terms, and signing credentials have not been supplied, and no clean Windows VM has been exercised. UI setup tests mock the Tauri bridge; Rust tests exercise temporary folders and synthetic resources.

## Next implementation boundary

1. Inventory actual database sources and redistribution notices; choose/confirm pilot device limit and future-update policy.
2. Implement shared installed-resource paths and first-run folder selection; preserve developer scratch safeguards.
3. Package CLI/resources through an explicit customer build profile and NSIS configuration; verify on a clean machine.
4. Manual certificates, shared GUI/CLI enforcement, issuance tooling, protected device keys, and recovery are now implemented; provision a production issuer and validate the installed workflow. Do not implement time-based lease expiry for this pilot.
5. Add separately signed updater artifacts, authenticated download grants, staged promotion, and operational key storage once hosting and signing providers are selected.

No online activation service, finished signed installer, or update service is represented as complete by this foundation.

## Automatic updates (off by default)

The app carries the update check behind the Cargo feature `updater` (`app/src-tauri/src/main.rs`, `check_for_update`). It is not part of `distribution` and nothing enables it yet.

- Without the feature, the app has no update code.
- With the feature but no `plugins.updater` configuration (the public key and endpoint), the app still starts: the plugin is not registered and the check does nothing. This was checked by launching the built app.
- With both, the app waits about ten seconds after the reader opens, looks once at the endpoint, and asks before installing. `WB_NO_UPDATE_CHECK=1` turns the check off.

Still to decide before the feature is enabled for a release: the update host and its visibility (a private repository's release assets need a token, so the public endpoint must be public or live elsewhere), the signing key pair (generated and kept by the owner, never committed), and the release script that publishes `latest.json`. Enabling it means adding `updater` to the overlay's features and the endpoint and public key to the overlay's `plugins.updater`. The dialog and the install-and-restart path have not been exercised against a real signed update.

## Manual licensing milestone

The manual issuer, Rust certificate verifier, Windows-protected device identity, setup request/import interface, and shared GUI/CLI authorization are implemented. See [LICENSING.md](LICENSING.md) for the operator and recipient workflows, trust configuration, recovery, and limits. A valid activated pilot copy runs permanently offline. No renewal or expiry policy was added.

The issuer remains an operator-only local tool. No production signing key has been created or provisioned, and no real license has been issued. Customer builds without the compiled issuer public key fail activation. The source includes only synthetic public interoperability fixtures. Server-hosted downloads/updates and clean-machine activation tests remain separate release work.

## Verification (2026-11-09)

`site:build` passed. All four distribution tests and all eight browser checks passed. Desktop and phone screenshots were inspected. The packaging preflight correctly reports missing staging inputs instead of reporting release readiness. Existing desktop app behavior was not changed or retested by this milestone.

Second milestone: the desktop UI production build passed; default and `distribution` GUI/CLI compile checks passed; all 34 core library tests, four distribution tests (including installer-overlay preparation), and three setup browser tests passed. The setup screen was visually inspected. Browser tests use a mocked Tauri bridge; they do not establish native restart or installation behavior. Full installer execution, upgrade/uninstall behavior, and a clean-machine smoke test remain unverified.

Third milestone: the desktop UI build and both GUI/CLI compile modes passed. Five Rust licensing tests, seven distribution/issuer tests, five setup browser tests, and the direct CLI authorization test passed (18 total). The activation screen was visually inspected. Native DPAPI tests used temporary synthetic identities; no production private key or license was created. Full native installed activation remains a release gate.
