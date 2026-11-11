# Bible Workbench current specification

Reviewed 2026-11-11 for the private Windows pilot integration. Rust owns continuing development; preserve existing plain-file study work and read-only Bible data. See [repository rules](../AGENTS.md).

## Integrated source

The release integration is based on `origin/main` at `6de3ef0` and incorporates `codex/installer-port` at `248c45a` (which includes the landing/licensing work at `dbce604`). Main includes the desktop debugging closeout, standalone database provisioning, direct and existing-file exports, editable PowerPoint, ordered PDF packets, and local speech. The installer branch adds the separate site, distribution resource/setup paths, manually issued offline licenses, and an optional updater.

Default developer setup and customer setup are distinct. Customer resources come from the installed resource manifest; customer operations require activation. Developer overrides and measurement entry points must not bypass those contracts. The optional updater is not enabled in the pilot installer and does not install updates in the background.

## Current release requirements

[RELEASE.md](RELEASE.md) is the active scope, acceptance checklist, and remaining launch gates. It supersedes the rollout sequence in [the original distribution proposal](SPEC-landing-distribution-licensing.md). Approved policy: manual issuance, two computers per invited person, owner-assisted replacement activation, included pilot updates, and permanent offline use after activation. Pricing remains undecided.

The website must not offer a download before an exact signed installer has passed release acceptance. Data provenance evidence must identify the shipped inputs and transformations. The release checker verifies integrity and recorded evidence; it cannot establish rights or perform a clean-machine test by itself.

## Desktop and migration

Current desktop implementation remains on the integrated base. Historical test results in [phase2-results.md](phase2-results.md) apply to their stated revisions, not automatically to this release candidate. User study-week closeout and real Office output inspection remain separate acceptance work. Preserve page Undo, legacy Trash compatibility, current export path resolution, and source-backed Scripture checks.

[Local data provisioning](../data/README.md) and Rust-owned regression fixtures remove the normal dependency on the predecessor checkout. Broader migration validation, PDF editing, edited-Office conversion, layout migration, and a complete clean-environment run remain before retiring the predecessor. Phone/sync and native mobile phases are outside the Windows pilot scope; do not advertise them as shipped.

## Entry points

| Work | Source | Verification |
| --- | --- | --- |
| Installer and runtime | `scripts/release/`, `crates/wb-core/src/runtime.rs`, `app/src-tauri/src/main.rs` | Distribution tests, Rust default/distribution checks, native install acceptance |
| Licensing | `crates/wb-license/`, `scripts/release/issuer.mjs`, `ui/src/installation.ts` | Certificate/DPAPI/CLI tests, setup browser tests, installed activation |
| Landing site | `site/` | Production build and desktop/phone browser tests |
| Data and notices | `data/`, `distribution/DATA-INVENTORY.md`, `scripts/build-dictionary.py` | Hash-locked build, source audit, recorded notice review |
| Reader/Notebook/exports | `ui/src/`, `crates/wb-core/src/`, `crates/wb-cli/src/` | Rust integration tests, browser and native checks relevant to changed behavior |

## Evidence

Identified Primary: source files, Git refs, upstream records linked by the redistribution inventory, and revision-specific test outputs. Historical handoffs are secondary summaries. Signed installer, hosted authenticated download, clean-machine validation, and final distribution approval remain Unverified/Flagged until evidence exists. Never convert a planned check into a passed result.
