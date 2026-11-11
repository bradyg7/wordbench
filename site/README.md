# Pilot website

The six-page site is a separate Vite build, with local Inter and Literata fonts. It does not publish the desktop UI or include the legacy screenshot assets. No image generation, analytics, payments, or activation service is included.

```text
npm run site:dev
npm run site:build
npm run test:site
```

The production output is `site/dist/`. Browser checks build and serve that output on a dedicated port, and cover desktop and phone. Do not serve the repository's `site/` directory as the public site: it also contains source and historical assets.

## Hosting contract

- Serve the root and `/download/`, `/releases/`, `/support/`, `/license/`, `/privacy/` using their built `index.html` files. Redirect the corresponding paths without a trailing slash to the directory form.
- Return HTTP **404** for unknown paths, using the built `404.html` as the optional error body. Do not configure an SPA fallback to `index.html`; this is a multipage site.
- Serve `/release.json` with revalidation or no-store. Immutable hashed `/assets/` files may be cached long term. HTML should revalidate on deployment.
- Reserve `/downloads/<opaque-release-id>` for the authenticated download service. The local [download listener](../services/distribution/README.md) implements invitation authentication and exact-byte validation. Static hosting alone does not implement that endpoint; deploy it behind the same HTTPS origin. Never place private storage URLs, keys, licenses, or customer records in the public directory.
- Published metadata must identify the exact tested installer and must not be promoted until download access, signing, notices, policy, and clean-machine acceptance are verified. Keep the checked-in status `unavailable` until then.
- Use HTTPS. Supply the final domain, support contact, host/provider privacy and retention details, and approved application terms before launch. The license page records the approved two-computer pilot, owner-assisted replacements, included pilot updates, and permanent offline use. Pricing and final application/privacy terms remain unfinished; these pages are not final legal terms.
- The owner requested a public customer preview on 2026-11-11; its pages allow indexing. The public preview uses Sites hosting. Installer distribution hosting, a support inbox and signed release readiness remain separate.

## Release behavior

Home, Download, and Releases read the same validated release record. An unavailable, malformed, or failed response never creates an installer link. A failed fetch offers Retry. Published notes are rendered as text and download paths are restricted by the shared release contract to the same-origin download service. Manual activation remains an exchange between the installed app and pilot issuer; there is no mandatory online renewal.

## Launch verification

On the selected host, verify all six direct URLs and slash redirects, a real 404 for an unknown path, cache behavior for a newly promoted version, and authenticated download success/denial. Confirm the downloaded file's size and SHA-256 against the release record. Local browser tests do not prove hosting authentication or an installed Windows workflow.

## Public product preview (2026-11-11)

A standalone static copy is published through OpenAI Sites for anyone with the URL. The application GitHub repository is not connected to hosting. The managed Sites source contains only built website assets, notices and demo media.

- Site project: `appgprj_6af4af3798d48191b6cc033b113ebf31`
- Live public origin: https://bible-workbench-preview.satinscone16.chatgpt.site
- Standalone source workspace: the chat's `bible-workbench-public` artifact folder, with its own `.openai/hosting.json` and Git history. Do not publish the application repository or change its Git remotes for a website update.
- Website includes database-backed interface screenshots and a short screen recording from a disposable study folder. `scripts/capture-public-demo.mjs` captures the media from the local development interface; it requires prepared fixtures and the local UI server on port 4185.
- `site/public/release.json` remains unavailable. Hosting this preview does not distribute the installer or databases, and does not enable activation, purchases, sign-ups or downloads.
- Rebuild and test the site, copy only `site/dist` to the standalone Site's `dist`, then use the Sites source workflow to publish. Do not copy personal study files, source databases, signing keys, or the app source. Keep Site identity and the established public audience unchanged on updates.

## Feature guide and guided recordings

`src/demo-data.ts` is the searchable public catalog. Its 70 entries are grounded in [the source inventory](../docs/FEATURES.md). Only actions actually shown in a completed recording receive a walkthrough link. Other implemented features remain documented, and OS-dependent demonstrations are marked pending.

`scripts/capture-feature-demos.mjs` records six focused workflows with eased pointer motion, visible click feedback, paced typing, drag selection, short action captions, and pauses to inspect results. These are scripted guided demonstrations, not footage of a customer. They drive the unchanged interface through pointer and keyboard events; they do not execute application commands to jump between views.

The local-only `scripts/demo-backend.mjs` connects UI requests to the real default-development Rust CLI. A separate disposable folder under `release-staging` is created for each recording. The read-only Bible database supplies source text; page edits, highlights and settings use real saved files. Native clipboard, file launching, activation and audio integrations are not simulated. Never include this bridge, the database, the scratch folder or capture logs in the published static files.

To reproduce: prepare `target/debug/wb.exe` and the audited database at `release-staging/source-audit/workbench.db`, serve the UI on local port 4187, then run `node scripts/capture-feature-demos.mjs` (optional arguments select demo IDs). Captures are 1280×800 WebM and PNG. Verify each clip and its saved result before publication. The library loads only the selected video's media on demand, includes written walkthrough steps, and supports direct `#demo-<id>` links.
