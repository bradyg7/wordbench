# The website

The public site for Wordbench, deployed to `https://bradyg7.github.io/` (design: [../design/features/site/](../design/features/site/README.md)).
A small Vite site (TypeScript, no framework) in the app's own look: warm paper, Literata and Inter, light and dark from the system.

```
npm run site:dev      # http://127.0.0.1:4175
npm run site:build    # site/dist
npm run test:site     # Playwright, desktop and phone
```

- The Download page's release box reads `public/release.json`, written at build time by
  `node scripts/site/fetch-release.mjs` from the newest release's `latest.json` (the checked-in file is a 0.2.0 fixture).
  `distribution/release.mjs` checks its shape; a bad or missing file shows "Not available right now" and no button.
- The Releases page is built from `../docs/releases/*.md`, newest first.
- The screenshots in `assets/` are older than marks and are not shown on the pages. Nothing on the site quotes scripture.
