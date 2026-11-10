# The landing page

A single static page for Bible Workbench, in the app's own tokens (`../ui/tokens.css`): warm paper, Literata for the
large type, Inter for the interface, light and dark from the system.

```
python -m http.server 3000 --directory site
```

Then open http://localhost:3000. There is no build step and no dependency. The screenshots in `assets/` are the app in
WebView2, copied from [../docs/phase2/](../docs/phase2/); the numbers on the page are the phase 2 measurements
([../docs/phase2-results.md](../docs/phase2-results.md), section 7). Nothing on the page quotes scripture.
