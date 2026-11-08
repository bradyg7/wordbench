# The landing page

A single static page for Bible Workbench, in the app's own tokens (`../ui/tokens.css`): warm paper, Literata for the
large type, Inter for the interface, light and dark from the system.

```
python -m http.server 3000 --directory site
```

Then open http://localhost:3000. There is no build step and no dependency. The screenshots in `assets/` are the app in
WebView2, copied from [../docs/phase2/](../docs/phase2/); the numbers on the page are the phase 2 measurements
([../docs/phase2-results.md](../docs/phase2-results.md), section 7). Nothing on the page quotes scripture.

## Hosting

The page is published to GitHub Pages by [.github/workflows/pages.yml](../.github/workflows/pages.yml): Settings →
Pages → **Source: GitHub Actions**, then every push that touches `site/` publishes it to
`https://bradyg7.github.io/wordbench/`. The workflow uploads `site/` as it is — no build step, nothing generated.

## The download

The page's buttons point at `https://github.com/bradyg7/wordbench/releases/latest/download/Bible-Workbench-setup.exe`,
a GitHub release asset. The installer is about 150 MB, which is past GitHub's per-file limit for a repository and too
close to the Pages size limit, so it is not in this folder and never should be.

`npm run release` on Windows builds it, writes it with its signature and `latest.json` to `dist/release/`, and fills the
version, the size and the links into the `<span data-release="version">`, `<span data-release="size">` and
`<a data-release="link">` markers here. `npm run check:release` fails if a marker goes missing or if the links stop
matching the updater's endpoint. See [../PACKAGING.md](../PACKAGING.md).
