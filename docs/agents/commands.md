# Commands, ports and releases

Read this before running the app, the UI tests, the real-app scripts, or making a release. Builders run only the tests
they are writing and the quick checks; CI runs the full suites ([CODING_STANDARDS.md](../../CODING_STANDARDS.md)).
While Actions minutes are out, `powershell -ExecutionPolicy Bypass -File scripts\ci-local.ps1` runs CI's steps here
instead (the person, 2026-11-24); it is the only way the full suite runs on this PC.

```
cargo build                                  # the workspace
cargo run -p wb-cli -- text "Num 25:11"      # verbatim scripture
cargo test -p wb-core <name>                 # one Rust test (the whole workspace runs in CI)
npm install && npm run tauri dev             # the app (from the repo root)
npm run package                              # the buyer's ZIP (BUYER-README.md ships as README.md); npm run check:package checks it
npx playwright test <spec> -g "<title>"      # one UI test in Playwright's WebKit (the whole suite runs in CI)
npm run shots                                # on purpose only: re-takes the committed screenshots; `-- --desk` adds the real-app desk scripts (release build, instance lock); tests save pictures to test-results/shots
node measure/desk.mjs                        # the desktop checked in the real app (its own instance and scratch copy)
npm run measure                              # the speed budgets (after npx tauri build --no-bundle)
python scripts/build-dictionary.py           # Webster's 1913 into dictionary.db (wb word-define, the card's Definitions); once per computer
powershell -File scripts\backup-study.ps1   # a hashed copy of the real study folder (reads it only), before the app uses it
powershell -File scripts\install-app.ps1    # the release build into %LOCALAPPDATA%\bible-workbench-rs\app (refuses while it is open)
```

Preserve established `wb` command contracts unless the change calls for a deliberate improvement. The comparisons with
the Python app (`scripts/golden.py`, `scripts/doc-plans.py`, `scripts/py-opens.py`, `scripts/commands-cases.mjs`,
`tests/golden/cases.json`) are history: run them only to learn how something used to behave, never as a test this app
must pass.

## The real app and ports

Every `measure/*.mjs` script that starts the real app first takes a machine-wide lock (`measure/instance.mjs`, a file in
the temp folder) and gets a free debugging port, so runs wait their turn instead of colliding or piling up windows; a
dead run's lock is taken over. A script that starts the real app must call `await acquire('<name>')` before it touches
its work folder.

`npm run dev` (and `npm run tauri dev`) serve the UI on 1420, which Tauri's `devUrl` expects. The Playwright tests never
use that server: they start this clone's own vite on a port picked from the clone's path (1430-1929; `WB_UI_PORT` sets
it by hand) and never reuse a running one. If the port is taken, the run stops with "is already used". A fresh clone
needs `npm install` and `npm run fixtures` before the tests.

## CodeGraph

(the person, 2026-11-22: in every session.) `.mcp.json` starts the `codegraph` server and `.claude/settings.json` turns
it on without asking, so every Claude session has `codegraph_explore` for finding code. A clone needs its index once:
`powershell -File scripts\setup-codegraph.ps1` (it keeps `.codegraph/` out of git and syncs an existing index). It reads
code only.

## A release

Bump the version in `Cargo.toml` and `app/src-tauri/tauri.conf.json`, write `docs/releases/<version>.md` (headings:
Moved or removed, New, Changed, Fixed, Your study folder), merge to `main`, and push a tag `v<version>` with the
person's go-ahead; `.github/workflows/release.yml` builds, signs and publishes it to `bradyg7/wordbench-releases`. A tag
is refused unless the full suite passed on that commit, and a smoke run of the built app must pass before anything is
published (the person, 2026-11-23): tag only once CI on `main` is green.
