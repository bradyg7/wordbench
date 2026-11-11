# Private Windows pilot release

Updated 2026-11-11. This is the current release contract. The older distribution proposal remains historical background; its online activation service, expiring leases, billing, and automatic updater are not pilot requirements.

## Scope and approved policy

- Windows x86_64 app and CLI with reviewed bundled Bible and dictionary resources.
- Manual activation request/certificate exchange. No recurring online check or expiration.
- Two computers per invited person, tracked manually by the operator under one license id.
- The owner may issue replacement activation when a computer is replaced. Record the replaced activation in the private operator ledger. Offline copies cannot be remotely disabled.
- Pilot updates included, delivered through approved installers. No promise about post-pilot prices or future commercial entitlements.
- Personal study data remains separate, recoverable without activation, and outside installer-owned removal paths.
- Optional automatic updater excluded. Its feature only reports availability; signed update delivery and coordinated safe replacement require separate acceptance before enabling it.

## Completed source work

The integration combines desktop/data work through `6de3ef0` with installer work through `248c45a`. It preserves default developer setup while separating customer installation setup. The six-page site has production-output browser coverage, an unavailable release state, manual activation instructions, approved policy, and a built 404 page. The installer preparation accepts reviewed staging inputs, checks hashes, and emits a per-user NSIS overlay with offline WebView2. Customer builds enforce one shared license policy in GUI and CLI. A local download listener implements expiring, release-scoped invitation credentials and exact artifact validation behind an HTTPS proxy; deployment remains unverified. The release-candidate verifier checks exact installer bytes, Windows publisher signature, and hash-bound acceptance/review records without publishing.

See [release verification evidence](release-verification.md) for the exact commands and current results. Source readiness is distinct from a signed, hosted release.

## Operator sequence

1. Start from a reviewed clean commit. Build GUI and CLI at the same version and revision with `distribution` enabled and the same public issuer key/id. Keep issuer secrets outside all source, staging, and artifacts.
2. Build the databases from pinned inputs. Run the data audit and review each source, territory, transformation, notice and dependency. Never label an unresolved input approved to make preflight pass.
3. Sign the customer CLI with the selected Windows publisher signing arrangement before calculating its staging hash. Supply the six-role staging manifest: app, CLI, Bible, dictionary, application terms, third-party notices. Run `npm run release:check -- --staging <folder>` then `npm run release:prepare -- --staging <folder>`. The staged GUI is an inventory input; Tauri rebuilds the actual GUI. Confirm final executable hashes and build identity after building. Preparation runs the staged CLI's side-effect-free `build-info --json` and rejects developer mode, a different version, or different issuer trust.
4. Configure publisher signing for the rebuilt Tauri GUI before bundling, so the installer contains signed GUI and CLI executables. Build the printed NSIS command without the optional updater, then sign the final installer. Compute final hashes only after signing. Do not change signed bytes or sign only a loose executable after it was already embedded in the installer.
5. Test the actual installer on a clean Windows machine without developer tools, prior installation state or the Python app. Use disposable study data. Run every acceptance case below, recording the source commit, final installer hash, Windows version, tester and results.
6. Provide a real support/contact route, final application terms, privacy details reflecting the chosen host, and the protected download route documented in [site/README.md](../site/README.md). Test the downloaded bytes against the final installer hash.
7. Run `npm run release:verify -- <candidate-folder>` with the records below. This is read-only: it does not sign, host, approve rights, publish metadata or run a VM. The owner reviews the actual package and final pages before publication.
8. Only then publish the approved installer and matching release metadata. Keep earlier approved packages available for recovery. A source push alone does not publish a release.

## Clean-machine acceptance

Each result includes an observation and associated log or screen evidence. Preserve test files separately from user work.

| Check key | Required observation |
| --- | --- |
| signed-executables | Installed GUI and CLI signatures identify the selected publisher; record final executable hashes and build-info version/trust. |
| failed-upgrade-recovery | Interrupted or failed installation leaves scratch study files intact and the prior or repaired installation usable. |
| fresh-install | Per-user NSIS install and Start Menu launch work without developer dependencies; WebView2 prerequisite works. |
| cli-unrelated-directory | Installed wb launches from another working directory using installed resources. |
| gui-and-cli-activation | Synthetic issuer request/import succeeds through both entry points, then repeat the production trust workflow before real issuance. |
| invalid-certificate-rejected | Tampered, wrong-device and wrong-issuer certificates fail without replacing a valid certificate. |
| permanent-offline-use | Disconnect network and restart; a valid activated copy remains usable. |
| resource-repair | Missing/corrupt DB shows repair guidance; recovery remains accessible; no developer fallback. |
| upgrade-preserves-study | Install a higher-version candidate over a previous build; hash-check untouched scratch study files and test normal use after restart. |
| uninstall-preserves-study | Uninstall removes app files and leaves externally stored study files recoverable. |
| advertised-features | Reader, search, lookup, dictionary, pages and each advertised export work against packaged resources. |
| download-matches-installer | The protected download returns the exact tested final installer; unauthorized requests fail. |

Native UI tests on the development machine and mocked setup browser tests do not substitute for these checks. Test interrupted/failed upgrade and data recovery before approving an installer upgrade workflow. Automatic update failure modes remain outside the pilot until that channel is enabled.

## Candidate record

Store `candidate.json` in a private candidate folder. All file paths are relative to that folder and must remain inside it. Required fields:

- `schemaVersion: 1`, full 40-character `sourceCommit`, `installer`, expected `publisherThumbprint`.
- `release`: the proposed published object matching `distribution/release.mjs`, including final SHA-256 and bytes. This object is not copied into the website by verification.
- `acceptance`, `acceptanceSha256`: path/hash of the acceptance JSON.
- `reviews.redistribution`, `reviews.applicationTerms`, `reviews.privacyAndSupport`: each has `status: "approved"`, reviewer name, review-record path and SHA-256. Approval is a real recorded human review, not a generated assertion.

Acceptance JSON requires `schemaVersion: 1`, `sourceCommit`, `version`, `installerSha256`, `cleanMachine: true`, `windowsVersion`, `tester`, ISO `testedAt`, and `checks` keyed by the table above. Each check requires `status: "passed"` and nonempty `detail`. Attach logs to the record's directory and reference them in detail. Integrity checks detect changed records, not dishonest assertions.

## Remaining launch gates

The owner confirmed no domain/hosting, Windows signing arrangement, support email or clean Windows VM is available yet. Production issuer provisioning also remains outstanding. These are real external setup requirements, not hidden completed tasks.

Redistribution conditions are tracked in [DATA-INVENTORY.md](../distribution/DATA-INVENTORY.md). Final application terms, deployment privacy/contact details, deployment of the tested authenticated download listener, publisher signing, real installed activation and clean-machine acceptance must be completed before publishing. The site stays unavailable until then. Pricing can remain deferred for an invitation-only pilot.

## Reasoning and relationship to the request

Aligns with your request: one integrated release source and explicit acceptance evidence make the work reviewable for merge and eventual release.

Conflicts with your request: none with preparing mergeable source. Claiming a completely shipped release without signing, rights review, hosting and installed evidence would be inaccurate.

Not prompted by you, but relevant: the legacy portable ZIP route is now explicitly development-only, so it cannot be mistaken for the licensed customer installer. The optional updater is excluded until it can preserve pending work during replacement.
