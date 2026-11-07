# Design

**In this repository (2026-11-04):** copied from the Python repository's branch `claude/design-layouts-e1b1df` (commit
321443b), without its `inventory/` screenshots of the Python app. FigCraft is found in `%LOCALAPPDATA%\Programs\ArtCraft`
or `%ProgramFiles%\ArtCraft`. The phase 2b design round is `phase2b.py` → `phase2b.figcraft` and `exports/phase2b/`
(review: [../docs/phase2b-design.md](../docs/phase2b-design.md)). The workspace round (W2 of "The Notebook as a workspace", 2026-11-07) is `workspace.py` → `workspace.figcraft` and `exports/workspace/` (review: [../docs/workspace-design.md](../docs/workspace-design.md)). `content.py` still runs the Python `wb`; the content it
wrote is in `content.json`.

Layouts and the design system for Bible Workbench on a phone, a desktop or laptop, and (later) a dedicated e-ink reader.
For review, not built. The plan and the open questions are in [../PLAN-design.md](../PLAN-design.md).

| What | Where |
|---|---|
| The design file (open in FigCraft) | `workbench.figcraft`: pages *Design system*, *Phone*, *Desktop and laptop* |
| The sheets as images | `exports/design-system.png`, `exports/phone.png`, `exports/desktop.png` |
| Each phone screen (2x) and desktop window | `exports/phone/*.png`, `exports/desktop/*.png` |
| The app as it is today, at five sizes | `inventory/<size>/*.png`, findings in [inventory/INVENTORY.md](inventory/INVENTORY.md) |
| E-reader research (parked) | [e-reader.md](e-reader.md) |
| How this becomes an app on every device (Rust) | [../PLAN-mobile.md](../PLAN-mobile.md) |

## How the file is made

FigCraft has a command line (`figcraft-cli`, beside the app in `%LOCALAPPDATA%\Programs\ArtCraft\FigCraft`, found the way
`workbench/craft_export.py` finds the other Craft CLIs). Its `run` command takes a JSON script of the same commands the app's
menus use, where a step can refer to an earlier step's result. So the design is code:

- `figlib.py`: the tokens (one color collection with Light, Dark and E-ink modes; the type scale; spacing, radius, touch
  sizes; icons) and helpers for frames, text, icons and scripture drawn word by word with highlights, thread underlines and
  note marks.
- `parts.py`: the components (buttons, chips, segmented control, bars, sheets, note card, thread row, pane chrome, hover card,
  capture palette, selection bar).
- `build.py`: the three pages, then `figcraft-cli run` → `workbench.figcraft`, then `render` and `export` → `exports/`.
- `content.py` → `content.json`: every verse, lexicon entry and count shown on a sheet, fetched with `wb text`,
  `wb interlinear`, `wb preview` and `wb count`. Nothing on a sheet is typed from memory.

```
python design/content.py      # needs a workbench server (any; a scratch one is fine: it only reads)
python design/build.py        # about a minute; rewrites workbench.figcraft and exports/
```

Renders use FigCraft's built-in fonts only (`--no-system-fonts`): Inter for the interface, Merriweather for scripture, Noto
Sans Hebrew. The app's reading face is Literata (decided in review); it is not built into FigCraft, so the sheets
keep Merriweather until a Literata font file is loaded with FigCraft's `text.loadFont`. Changes made by hand in FigCraft are lost on the next build, so either change the scripts, or stop building and
keep the file as the source from then on.

`inventory/capture.py` takes the inventory screenshots: a headless Edge driven by `wb do` against a scratch server.
