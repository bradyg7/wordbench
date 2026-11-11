# Manual pilot activation

Implemented policy: manual issuance, permanent offline use after activation. No expiry, heartbeat, clock enforcement, payment integration, automatic seat limit, or online revocation is imposed. The owner approved two computers per invited person, owner-assisted replacement activation when a computer is replaced, and included pilot updates on 2026-11-11. Pricing remains undecided. These limits are administered by the issuer, not an online service.

## Trust and storage

`wb-license` verifies Ed25519 signatures with `verify_strict`. The issuer signs the exact UTF-8 payload bytes; the JSON envelope stores those bytes and the signature as standard base64. The payload has a fixed schema and is bound to the product, issuer key id, device public key, and `pilot` feature. Unknown certificate fields and oversized/malformed envelopes are rejected.

The trusted public key is embedded at compile time using `WB_LICENSE_PUBLIC_KEY` (64 lowercase hex characters) and `WB_LICENSE_KEY_ID`. Both the customer CLI and GUI must be built with the same values. These are public values, not private signing keys. If either value is absent, activation fails closed. Runtime environment changes cannot select a different issuer. `build.rs` tracks these variables so changing them rebuilds the verifier. No production key has been generated or selected in this milestone.

The client generates a device Ed25519 seed when the user requests activation. Windows DPAPI protects it for the current Windows account. The protected identity and signed certificate live under the installation settings `licensing/` folder, separate from study files. Corrupt identity storage is never silently replaced. A transferred certificate alone cannot activate another device identity. A privileged user can still patch software or extract keys; this is not an absolute piracy guarantee.

Successful verification is cached for the running process. Every customer command dispatch checks that authorization, while direct Tauri study handlers require the same gate. No study state is created in an unactivated desktop session. The standalone CLI has the same gate. Developer builds retain unrestricted development behavior; never distribute those binaries as licensed customer builds.

## Recipient workflow

1. Select the study folder in setup.
2. Click **Create activation request**, copy the request, and send it through the pilot invitation contact. It contains a public device key and proof of possession, not notes or a private key.
3. The issuer checks eligibility manually and returns a signed JSON license.
4. Select that file in setup; the app verifies it before replacing any existing certificate. A valid license reveals **Open my workbench** once the study folder is ready.

CLI equivalents in a distribution build:

```text
wb license status
wb license request
wb license import <certificate-file>
wb license recovery
```

`request` prints public request JSON so the operator can redirect it to a file. `recovery` reports the configured study folder without requiring activation; the user can copy/read their Markdown and JSON with ordinary file tools. Setup also displays that folder. Licensing never encrypts, deletes, or changes study content. Unlicensed in-app study editing is blocked; recovering files through the filesystem remains available.

## Issuer workflow

Run `node scripts/release/issuer.mjs` with a JSON object on stdin supplied by a secure operator tool. Never place the passphrase in command-line arguments, checked-in files, or shell history. Do not store the private issuer key inside the source repository or installer staging. The command refuses interactive terminal input and logs no secret values on failure.

Key generation input fields: `action: "keygen"`, `keyId`, `passphrase` (at least 16 characters), `privateKeyPath`, `publicKeyPath`. It writes a password-encrypted PKCS#8 private key and a public-key record, refusing existing files. Securely back up the encrypted private key and passphrase separately. No production keys are generated automatically.

Issuance fields: `action: "issue"`, `privateKeyPath`, `passphrase`, `requestPath`, `keyId`, `licenseId`, `activationId`, `outputPath`, `auditPath`. Use the public record's key id and matching private key. The tool checks device proof, signs permanent pilot rights, writes an immutable authorization audit record, then writes the certificate. Audit/output paths must be unused. A failure after audit creation may leave an authorized attempt without a certificate; inspect the paths before retrying with new paths. Issuance success does not mean delivery.

Keep one stable license id per invited person. Before issuance, review all audit records for that license: allow two current computers. For replacement, record the activation being replaced and the owner approval in the private operator ledger; then issue a new activation id. Pilot updates are included. An old offline installation cannot be remotely disabled, so a replacement is an operational agreement, not proof of erasure. Manually review the audit ledger for duplicate issuance and transfer decisions. The tool is not an account database and cannot automatically prevent a human from issuing another activation under a different id. Do not package the issuer script, audit ledger, or private key. Offline copies cannot be reliably revoked, and an OS/account reinstall that loses DPAPI access requires issuer-assisted reactivation. Device transfer cannot prove an old offline copy was erased.

## Remaining release gates

Select and securely provision the production issuer; build both customer binaries with its public trust; define the operational ledger/device policy; test request/issuance/import in a clean installed GUI and CLI; sign executable and update artifacts; finish data redistribution review. The development setup browser uses a mocked Tauri bridge. Tests use explicitly synthetic keys; the interoperability fixture is public test data and must never be a trusted release issuer.

Primary technical references: [ed25519-dalek verification](https://docs.rs/ed25519-dalek/latest/ed25519_dalek/struct.VerifyingKey.html), [Microsoft DPAPI](https://learn.microsoft.com/en-us/windows/win32/seccrypto/example-c-program-using-cryptprotectdata). These establish API behavior, not immunity from local tampering.

## Validation

The licensing tests cover valid permanent certificates, altered payload/signature, wrong device/issuer/product/policy, oversized input, Node-to-Rust signature interoperability, DPAPI-protected identity persistence, damaged identity, valid import, and preservation of an existing license after an invalid import. Issuer tests cover encrypted private-key generation, proof validation, signing, duplicate-output refusal, and missing public trust during packaging. Setup browser tests cover request/import/recovery and prevent invalid imports from revealing the restart action. A customer CLI library test confirms that direct command dispatch fails before activation bootstrap.

The browser tests mock the Tauri bridge; they are not a native end-to-end activation test. Test issuer keys are synthetic. A production key, operational eligibility review, and clean installed GUI/CLI test remain required before issuing real pilot licenses.
