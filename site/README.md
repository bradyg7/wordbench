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
- Keep preview `noindex, nofollow` metadata until the owner approves public indexing. The owner has no production domain, hosting, or support email selected; nothing has been deployed by this change. Source readiness for merge does not make a pilot installer available.

## Release behavior

Home, Download, and Releases read the same validated release record. An unavailable, malformed, or failed response never creates an installer link. A failed fetch offers Retry. Published notes are rendered as text and download paths are restricted by the shared release contract to the same-origin download service. Manual activation remains an exchange between the installed app and pilot issuer; there is no mandatory online renewal.

## Launch verification

On the selected host, verify all six direct URLs and slash redirects, a real 404 for an unknown path, cache behavior for a newly promoted version, and authenticated download success/denial. Confirm the downloaded file's size and SHA-256 against the release record. Local browser tests do not prove hosting authentication or an installed Windows workflow.
