# Landing page, packaged distribution, updates, and licensing

Historical proposal. The current approved pilot scope, policy and acceptance gates are in [RELEASE.md](RELEASE.md). Online activation APIs and expiring leases below are not current pilot requirements.

Date: 2026-11-09. Status: implementation proposal; business policies are not approved.
Repository baseline: `3078edebf9d0f3ee26e8a23ef277ea43eb931cca`.
Working branch: `codex/landing-distribution-spec`.

Implementation update (2026-11-09): the owner authorized implementation and selected a private pilot with manually issued licenses and permanent offline use after activation. This supersedes the expiring-lease proposal below: activated pilot certificates must not expire or require a renewal heartbeat. Device limits and update entitlement remain undecided. The first implemented milestone is the separate preview site, public release validation, pilot policy record, and read-only packaging preflight; see `distribution/README.md`. No installer, activation service, or updater has shipped.

Second implementation milestone (2026-11-09): added explicit customer-build resource resolution for GUI/CLI, version/hash/basic database-schema validation, first-run path entry and configuration persistence, CLI setup parity, and isolated NSIS-overlay preparation with offline WebView2. Recorded the predecessor's source inventory without treating its license labels as verified clearance. Packaging mechanics are implemented; release artifacts, signing, license activation, and clean-machine validation remain outstanding. See `distribution/README.md` for commands and limitations.

Third implementation milestone (2026-11-09): manual file-exchange activation is implemented for the private pilot. The issuer validates a signed device request and returns a signed non-expiring certificate. Windows protects the client identity with current-user DPAPI. Customer GUI/CLI operations share an activation gate; recovery exposes the user's folder without activation. The pilot's file exchange takes the place of the proposed online activation API for now. No production issuer key or license has been created, and hosted downloads/updates remain unimplemented. See `distribution/LICENSING.md`.

## 1. Verified repository state

The evidence below is from the checked-out source, not an inference from the README's phase status. Existing result documents record historical checks; those checks were not rerun for this documentation-only change.

| Evidence | Current state | Release consequence |
| --- | --- | --- |
| `Cargo.toml`, `crates/wb-cli/src/lib.rs` | Rust workspace with shared core, CLI, and desktop app; CLI dispatch is also used in-process by the app | Package both executables; shared behavior and licensing must cover both entry points |
| `package.json`, `ui/vite.config.ts` | Plain TypeScript/CSS with Vite; bundled UI, not an existing public website | Create a separate landing-page build; do not publish the desktop UI as a website |
| `app/src-tauri/tauri.conf.json` | Tauri 2, version `0.0.1`, identifier `app.bibleworkbench.desktop`, `bundle.active: false` | There is no enabled installer configuration |
| `scripts/install-app.ps1` | Copies `bible-workbench.exe` and `wb.exe` into a local app folder | Developer installation helper, not a complete customer installer |
| `crates/wb-core/src/lib.rs` | Bible DB defaults to the sibling Python repo's `datasets/workbench.db`; study defaults to a temporary scratch directory | Fresh machines cannot run a self-contained release as configured |
| `crates/wb-core/src/dictionary.rs`, `scripts/build-dictionary.py` | Dictionary DB is separately built/downloaded and resolved in local app data | Prepare and bundle an approved dictionary artifact |
| `app/src-tauri/src/main.rs` | Opens DB and study store before Tauri setup; fatal startup failure if unavailable | Resolve installed resources and first-run configuration before creating normal app state |
| `crates/wb-core/src/cache.rs` | Derived caches already live separately from the read-only Bible DB | Preserve that separation |
| `crates/wb-core/src/docs/mod.rs` | Some document structures and PowerPoint remain delegated to the Python app | Do not advertise complete Python-feature parity or bundle the Python app implicitly |
| `app/src-tauri/Cargo.toml`, capabilities | No updater plugin configured; capability currently grants `core:default` | Add update integration and narrowly scoped permissions |
| Tauri config and startup | CSP is null; measurement environment option enables remote debugging | Review content policy; exclude measurement/debug overrides from customer release builds |
| Tracked repository files | No release workflow or root application license found; font license files exist | Establish release automation and application/third-party terms before shipping |
| `CLAUDE.md`, `store.rs` | Plain-file study compatibility and protection for the owner's real folder are explicit constraints | Packaging, testing, activation, and updates must preserve them |

The baseline includes desktop reader, lookup, search, pages/notebook, highlights, threads, and document-related code. Launch claims must be verified individually against the final packaged build. Mobile layouts and the README's mobile ambition are not evidence of shipped mobile installers.

## 2. Outcome and scope

A visitor can understand the app, obtain the supported Windows installer, activate a license, use the packaged app without a development environment, and receive authenticated updates. The website and desktop Settings show the same published release version and release notes.

“Full app” means the Rust desktop app, CLI, bundled UI/fonts, and all redistribution-approved runtime data required for its supported features. It does not mean distributing this repository, personal study files, developer tooling, or the predecessor Python app. Any Python-dependent feature must be completed in Rust or explicitly excluded from the launch feature list.

This spec does not implement or deploy anything. Source hosting visibility, domain, vendors, billing, supported OS versions, and launch scope remain decisions for the owner.

### Reasoning and relationship to the request

- **Aligns with your request:** a dedicated landing page, complete installer, signed update channel, licensing controls, and a separate branch directly support distribution and ownership protection.
- **Conflicts with your request:** no deliverable can honestly satisfy an absolute guarantee that nobody can steal or copy a distributed app. A user-controlled computer can inspect or patch local code. This proposal reduces casual sharing and unauthorized access; it does not promise piracy prevention.
- **Not prompted by you, but relevant:** portable resource paths, dataset redistribution rights, recovery access to personal files, and the CLI enforcement path are prerequisites exposed by the actual source. Windows-first delivery is a proposal based on the existing Windows installation workflow, not an approved restriction on future platforms.

## 3. Proposed architecture

| Component | Responsibility | Proposed location |
| --- | --- | --- |
| Public site | Product information, download, release notes, support, terms/privacy links | `site/`, separate Vite/TypeScript build |
| Distribution API | Activation, license refresh/deactivation, authenticated download grants, update checks | `services/distribution/`, runtime/provider selected before implementation |
| Release storage | Immutable versioned installers, signatures, checksums, resource manifests | Private object storage/CDN with short-lived download URLs |
| Desktop integration | Installed-resource resolution, first run, license status, update UI | Tauri shell plus shared Rust modules |
| Shared entitlement policy | Signature verification and operation authorization for GUI and CLI | New `crates/wb-license/`; no UI dependencies |
| Release automation | Test, package, sign, validate, upload, promote | `.github/workflows/release.yml` if GitHub is selected; equivalent CI otherwise |

Use a static host for the site and a separately secured API. Sites is an available hosting option, not a selected provider. Publishing a landing page alone cannot package or license a native executable. The build pipeline produces packages; the site distributes them. Keep accounts, payment tokens, signing keys, and storage credentials out of static assets and desktop binaries.

Do not introduce a public repository as a prerequisite. Remote hosting and pushing require the owner's go-ahead under `CLAUDE.md`.

## 4. Landing-page requirements

Routes: `/`, `/download`, `/releases`, `/support`, `/license`, `/privacy`. Add `/account` only if the selected entitlement provider requires it.

1. Introduce Bible Workbench as a personal study tool using approved factual copy. Show only features verified in the packaged release. Do not author doctrinal teaching or claim the app interprets Scripture.
2. Show real, owner-approved application screenshots made from scratch/sample data; no private notes and no generated imagery. Reuse the app's Literata/Inter typography and existing visual tokens where suitable.
3. Main action: “Download for Windows” for a released build, or an accurately labeled preview action until release gates pass. Display version, architecture, supported OS range, installer size, published date, and release notes from release metadata.
4. Explain the chosen license, activation requirement, device allowance, offline policy, update entitlement, and whether payment is required before download. Do not invent prices or show a functioning purchase button before billing exists.
5. Unsupported platforms receive an honest availability message, not a Windows download disguised as compatible. Manual platform selection remains available.
6. Explain local file ownership and support/recovery steps. Avoid an absolute “no data leaves your device” claim: activation and update checks contact the service even though study content must not be transmitted.
7. Include keyboard navigation, visible focus, semantic headings, useful image alternatives, readable contrast, responsive layout, and clear loading/error/retry states.
8. Fetch only sanitized public release metadata. No license key in a URL, analytics event, HTML, log, or screenshot. Do not collect email unless a working, disclosed flow needs it.

## 5. Packaging and first run

### Initial target, pending approval

Windows x86_64, per-user NSIS installer. Tauri supports NSIS and MSI; select one initial format to reduce release variation [T1]. Confirm the supported Windows versions through actual clean-machine testing. Other architectures and platforms need their own builds and release gates.

### Package inventory

- `bible-workbench.exe`, separately built `wb.exe`, bundled `ui/dist`, and necessary app icons/fonts.
- `workbench.db`, `dictionary.db`, and any other runtime resources discovered by a dependency inventory. Stage these as Tauri resources from controlled, hashed build inputs; the repository currently ignores `*.db`.
- `resources-manifest.json`: resource name, version, SHA-256, schema version, source identifier, and associated notice file.
- Application license/terms and `THIRD-PARTY-NOTICES` covering code dependencies, fonts, datasets, dictionary, and any runtime redistribution.
- WebView2 handling: choose an embedded offline installer for a genuinely offline installation, or clearly disclose the internet requirement of a bootstrapper. Measure actual installer sizes; do not estimate them as facts [T1].

Inventory every DB table/source and obtain redistribution evidence. A text's age or name does not prove rights in a particular digital dataset. **Unverified/Flagged:** redistribution permission for the existing Bible/lexicon/interlinear/dictionary artifacts has not been established by this inspection. Do not ship them until resolved. Do not assign proprietary ownership to third-party content through the app license.

### Runtime paths

Introduce one shared path configuration used by both the Tauri shell and standalone CLI:

- Developer/test overrides remain available for scratch operation; production defaults never depend on the developer's checkout.
- Installed DBs resolve from the application's installed resource directory; CLI uses its co-installed resource location, independent of current working directory.
- First run offers a persistent user-owned study folder or an explicitly selected existing folder. Never use a temporary folder as the customer default and never silently import the owner's data.
- Settings/license state live in per-user app data; caches remain disposable; documents stay outside the installation directory.
- Do not remove the existing real-study guard for development/tests. Persist the customer-selected folder without globally setting `WB_ALLOW_REAL_STUDY`.
- Move initialization that depends on Tauri's resource resolver into setup or an equivalent bootstrap step. Render recoverable setup/error UI rather than exiting before a missing-resource explanation can be shown.
- Validate resource hashes/schema before normal use; offer repair without modifying study files.

Installation, upgrades, and uninstall preserve study files and exported documents. Uninstall may remove app binaries and caches, but no study-data deletion checkbox should be selected implicitly.

## 6. Licensing and entitlement model

Keep three controls distinct: application terms describe permitted use; activation enforces commercial entitlements; signing authenticates distributed binaries. None substitutes for the others. Final legal terms and distribution territories require an appropriate review; this document specifies technical behavior, not legal conclusions.

### Business decisions required before implementing policy

| Decision | Proposed starting point, not approval |
| --- | --- |
| Revenue model | Approved: manually issued private pilot licenses; pricing later |
| Device allowance | Configurable per entitlement; choose the actual count |
| Offline use | Approved: permanent offline use after activation; signed non-expiring certificate |
| End of entitlement | Preserve access/export of personal files; define which application features remain enabled |
| Trial | Omit initially unless requested |
| Activation recovery | Owner-assisted transfer initially, with auditable device deactivation |
| Payments | Manual pilot license issuance first is an option; paid public launch requires a selected checkout/provider |

The owner selected perpetual offline use. An activated copy therefore cannot be promptly revoked while offline. Revocation restricts future server operations and additional activations; it does not retroactively expire the already-issued pilot certificate.

### Minimum data contracts

All identifiers are opaque; timestamps are UTC. Keep migrations versioned.

| Record | Required fields/constraints |
| --- | --- |
| Entitlement | `id`, `customer_id`, hashed high-entropy activation secret, `product_id`, `status`, `plan`, `device_limit`, `features`, `valid_until` nullable, `updates_until` nullable, `policy_version` |
| Activation | `id`, `entitlement_id`, device public-key hash, `created_at`, `last_seen_at`, `revoked_at`; transactional device-limit enforcement |
| Signed pilot certificate payload | `schema_version`, `key_id`, `product_id`, `entitlement_id`, `activation_id`, device key hash, `features`, `issued_at`, `updates_until`, `policy_version`; no runtime expiry or required refresh |
| Release | `version`, `channel`, `platform`, `architecture`, `published_at`, `notes`, storage object key, byte size, SHA-256, updater signature, resource-manifest hash, minimum supported data schema, `status` |
| Audit event | event id, actor/service, action, target opaque id, timestamp, request id; no raw activation secret or study content |

Use an established signing implementation (for example Ed25519 with a specified byte encoding); never invent cryptography. The issuer alone holds the certificate-signing private key. Clients embed verification public keys and reject wrong product, device, signature, and policy/schema. Keep this key distinct from updater and Windows signing keys.

### Service contract and activation flow

- `POST /v1/activations`: accepts activation secret and device public key over TLS; atomically validates status and available seats, returning a signed non-expiring certificate. Rate-limit attempts and make retries idempotent.
- No mandatory refresh endpoint or heartbeat for the approved pilot. Future server operations can validate current entitlement independently without expiring offline use.
- `DELETE /v1/activations/{id}`: requires authenticated device/owner proof and releases that device seat; knowing an id is not authorization.
- `GET /v1/releases/latest?platform=...&arch=...&channel=...`: returns public metadata only.
- `POST /v1/download-grants`: checks entitlement and selected release eligibility, then returns a short-lived URL. A copied URL can work until expiry; it is not a license.
- `GET /v1/updates/{target}/{arch}/{current_version}`: authenticates the activation, selects a newer eligible release, and returns the Tauri updater response (`version`, `url`, `signature`, optional notes/date) or HTTP 204. Use a dynamic response so URLs are fresh [T2].

Store a generated device key using OS-protected credential storage; never hard-code a shared client secret. Device cloning remains possible to a sufficiently privileged attacker. Do not fingerprint unrelated hardware or collect study text. Define key replacement and license recovery for OS reinstalls.

Pilot app states: unactivated, activating, active, invalid certificate, activation service unavailable. Update/service eligibility is separate from offline app activation. Network loss, a clock change, or an unavailable service must not invalidate an authentic non-expiring pilot certificate. Deactivation cannot prove that a permanently offline copy has been erased; transfers need an explicit policy.

Implement enforcement below the frontend, at shared operation boundaries used by both CLI and GUI. Define an explicit allowlist for activation, status, update checks, and personal-data access/export when activation is missing or invalid. Test direct IPC and `wb.exe` calls. Do not lock or encrypt users' study files as an enforcement mechanism.

If payments are added, issue entitlements only after verified server-side webhook events; enforce event idempotency, reject replay, and map refunds/cancellations to the approved policy. A browser redirect after checkout is not proof of payment.

## 7. Signed updates and release operation

Tauri updater signatures and Windows publisher signing are separate requirements. Configure the updater plugin, verification public key, HTTPS endpoint, generated updater artifacts, and narrowly scoped integration. Tauri requires signed updater artifacts [T2]. Sign the Windows executables/installer with the selected publisher certificate/service; signing does not guarantee immediate SmartScreen reputation [T3].

Release sequence:

1. Build an approved commit/tag with pinned lockfiles and a controlled Windows toolchain. Fail on version mismatch between Cargo, Tauri, release metadata, and both binaries. Reject dirty release inputs.
2. Run applicable Rust/UI checks and resource provenance/hash verification. Build the CLI and Tauri installer from the same source revision.
3. Package binaries/resources/notices; Windows-sign the final deliverables before generating signatures/checksums over their final bytes. Never mutate an artifact after signing it.
4. Install/test on a clean Windows VM with no Rust, Node, Python, sibling repo, environment overrides, or pre-existing DB. Record actual size and startup behavior.
5. Upload immutable versioned objects and verify downloads/signatures. Keep the release staged and unavailable to normal users until all gates pass.
6. Promote a release record atomically. The landing page and update endpoint derive their visible release from that record; failed uploads must never become “latest.”
7. Retain prior known-good packages and an audit trail. Withdraw a bad release from selection, then issue a higher-version repair build. Do not assume automatic downgrade is supported or safe for data formats.

The app checks in the background after startup when enabled and exposes “Check for updates.” Show the version, release notes, size, and download progress; ask before installing/restarting. Flush pending edits and coordinate all windows/CLI processes before replacement. Do not silently terminate a process with unsaved changes. Interrupted downloads, expired URLs, bad signatures, and install failure leave a recoverable current install; refresh the download grant when needed.

Resource updates travel with the initial installer/update package to avoid mismatched code and DB versions. Later independent content updates require their own signed manifest and compatibility checks. Study schema changes require backups and explicit migration compatibility; installation is not permission to rewrite the user's Markdown/JSON format.

Protect signing credentials in CI secret storage with restricted release permissions. Document backup/recovery and public-key rotation: ship trust in a replacement key before using it, or provide a trusted manually signed recovery installer. Never put private keys in the repository or logs.

## 8. Implementation sequence and file map

| Phase | Deliverables | Exit condition |
| --- | --- | --- |
| A: decisions and inventory | Approved launch platforms, commercial/offline policy, rights inventory, hosting/CI choice, feature matrix | No unverified dependency slated for redistribution; unresolved policies remain blocked, not defaulted |
| B: self-contained desktop | Shared runtime paths; first-run UI; Tauri resource/bundle config; CLI packaging; notices | Clean machine runs all advertised features; existing scratch/real-data safeguards preserved |
| C: release pipeline | Signing, artifact manifest, release storage, staged promotion | Clean install and N-to-N+1 update proven with test keys/staging endpoints |
| D: entitlement service | Migrations, activation/refresh/deactivate, Rust verifier, UI/CLI status, recovery | Auth, concurrency, offline, bypass, and recovery cases pass |
| E: landing page | Separate site, live release metadata, download/license/support flows, approved screenshots/copy | Downloads deliver the exact verified artifact; no dead purchase/support flows |
| F: controlled launch | Pilot licenses, support procedure, production keys/domain, signed public release | Owner approves concrete launch artifacts and policy; actual publish/push separately authorized |

Expected changes: `app/src-tauri/{Cargo.toml,tauri.conf.json,capabilities/default.json,src/main.rs}`, `crates/wb-core/src/lib.rs`, `dictionary.rs`, `crates/wb-cli/src/lib.rs`, `Cargo.toml`, `package.json`/lockfiles, new `crates/wb-license/`, `ui/src/settings.ts` and new onboarding/license/update components, `site/`, `services/distribution/`, `scripts/release/`, and release workflow. Add a root license/terms reference and third-party notices only after ownership/policy review. Keep `scripts/install-app.ps1` explicitly developer-only.

Implement policy/path schemas before UI integration. Preserve the repository's command parity: app-level license and update actions need corresponding CLI affordances, with a documented distinction between checking/downloading and restarting the graphical app.

## 9. Acceptance tests

- Fresh install launches from Start Menu and CLI from an unrelated working directory, with no developer environment. Reader, lookup, dictionary, search, pages, and each advertised export work against packaged resources.
- Missing/corrupt DB gives a repair path; the app never falls back to a developer path. Resources remain read-only and caches writable as a standard user.
- Existing study data survives install, update, failed update, uninstall, and invalid activation state. Use scratch fixtures only. Hash-check data before/after operations expected not to write it.
- Authentic activation succeeds; invalid/wrong-product/wrong-device/tampered certificates fail consistently in GUI, IPC, and CLI. Recovery/export remains available by the approved policy. Revoked entitlements cannot obtain new activations or unauthorized server access, but an already-issued valid offline certificate remains usable.
- Simultaneous activations cannot exceed the seat limit. Retried activation/payment requests do not duplicate seats or entitlements. License keys never appear in client/server logs.
- Active pilot certificates continue to work offline without an expiry or refresh requirement. Time changes, timeout, and service outage do not delete work or disable valid offline use.
- Valid update succeeds; tampered signature, wrong architecture, unauthorized version, expired URL, disk-full, and interrupted download/install are handled. No update loop or downgrade is selected.
- Release page and updater agree on the promoted version. Withdrawn/staged releases are not offered. A browser without a privileged service credential can still read public metadata, but cannot issue licenses or publish artifacts.
- Landing page works with keyboard and narrow/wide viewports; download failures have retry/help; no private content appears in screenshots, bundles, or installers.
- Review CSP against real app behavior; customer builds cannot enable the measurement remote-debugging flag. Verify packaged binaries contain no private signing keys/service credentials.

Existing Rust, golden-output, and Playwright checks run when their associated behavior changes; historical reports do not replace release validation. No application tests are required merely to add this spec.

## 10. Sources and evidence tiers

**Identified Primary — local:** the source paths in section 1, inspected at the recorded commit. These establish current code/configuration, not deployment status or dataset ownership.

**Identified Primary — external:** official Tauri documentation checked while preparing this spec. Reconfirm exact options against installed Tauri versions during implementation.

- [T1: Windows installer formats and WebView2 distribution](https://v2.tauri.app/distribute/windows-installer/).
- [T2: Updater plugin, signing, artifacts, and endpoint protocol](https://v2.tauri.app/plugin/updater/).
- [T3: Windows code signing and reputation](https://v2.tauri.app/distribute/sign/windows/).

**Identified Secondary:** none relied upon.

**Unverified/Flagged:** dataset redistribution rights, final legal terms, current remote visibility, domain/vendor availability and costs, signing-provider eligibility, supported OS matrix, complete packaged feature coverage, and final installer size. These require evidence before launch. Proposed architecture and policy options are engineering recommendations, not sourced facts or approved product decisions.
