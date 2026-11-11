# Private pilot download listener

This provider-neutral Node service implements the website's same-origin `/downloads/<release-id>` contract. It does not issue app licenses, publish releases, host the static site, or collect study data. Download invitations are separate from permanent offline app activation.

Run `node services/distribution/server.mjs <private-config.json>` on the server. It binds only to `127.0.0.1`, port 4180 (`WB_DOWNLOAD_PORT` overrides). Put it behind an HTTPS reverse proxy on the site's domain. The proxy must replace `X-Forwarded-Proto` with `https` after TLS termination, not pass that header from clients. Never expose the listener directly. TLS, request/header limits, access-log redaction, host hardening and rate limits belong to deployment acceptance.

Keep configuration and immutable installer artifacts outside `site/dist`, the repository, and public static storage. Restart the listener when changing invitations or releases. The private configuration has this schema:

```json
{
  "schemaVersion": 1,
  "artifactRoot": "<absolute-private-artifact-folder>",
  "artifacts": [{ "id": "pilot-0.1.0", "path": "installer.exe", "release": "<full validated published release object>" }],
  "invitations": [{ "id": "<opaque-invitation-id>", "secretSha256": "<64 lowercase hex characters>", "expiresAt": "<ISO UTC date>", "releases": ["pilot-0.1.0"] }]
}
```

The `release` value is an object with all fields required by `distribution/release.mjs`, not the placeholder string above. Its download path must equal `/downloads/` plus the artifact id. Load only a release that has passed the candidate verifier and owner approval. Configuration is not itself proof of approval.

Generate each invitation secret with 32 cryptographically random bytes, encoded as base64url (43 characters), and store only its SHA-256 in configuration. Supply the opaque id and secret privately to the invited person. The browser's HTTP Basic prompt accepts the id as username and secret as password. Do not put credentials in URLs, query strings, public metadata, shell history, or logs. The service logs no requests or credentials. An invitation can authorize specified installer versions and expires independently of the installed app's permanent offline license.

The listener rejects invalid/expired credentials, unlisted release IDs, non-HTTPS proxy requests, traversal, and changed artifact hashes/sizes. It opens and hashes the same file handle it then streams; keep files immutable while serving. Failed validation returns an unavailable response without sending artifact bytes. All responses disable caching. HTTP Basic credentials can remain cached by the browser; use a private browser session on shared computers. Removing an invitation and restarting revokes future downloads, not installed offline use.

Run `node --test services/distribution/server.test.mjs` for synthetic local endpoint tests. A local test is not evidence that the production reverse proxy, invitations, final signed artifact or hosting privacy policy are ready.
