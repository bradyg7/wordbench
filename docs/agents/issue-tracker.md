# Issue tracker: GitHub issues for decisions, design folders for building

For Matt Pocock's skills (`wayfinder`, `to-spec`, `to-tickets`, `implement-spec`, `triage`). **Issues hold the process,
the repo holds the results** (the person, 2026-11-25): a decision is worked in a GitHub issue on `bradyg7/wordbench`,
and its result is written into the repo's files when the issue closes, so nothing decided lives only on GitHub.

## Building: design folders

Build work is tracked in the design folders (until the map decides "Where build tickets live"):

- **Spec** = `design/features/<folder>/README.md`: dated decisions, what the person said at play, and the "what must
  be true" items. Building starts only from a folder the person marked *accepted* (none is, 2026-11-24).
- **Tickets** = a few of that folder's "what must be true" items, each buildable and testable on its own. Each item
  records which ticket built it.
- **Index** = `design/features/coverage.md` (every area of the app and the folder that designs it).
- **Branches**: `feature/<folder>` for a design, `fix/<what>` for a bug, from an up-to-date `main`, in the Main clone.

`to-spec` writes into the folder's README; `to-tickets` cuts its "what must be true" items. Neither creates GitHub issues
or `.scratch/` files.

## Wayfinding operations

What the wayfinder skill calls a "ticket" is an **issue** here (glossary).

- **The map** is one issue labelled `wayfinder:map` (today: [Map: Wordbench's words, ideas and design order](https://github.com/bradyg7/wordbench/issues/45)). Its decisions are its **sub-issues**, each labelled with one of
  `wayfinder:grilling`, `wayfinder:prototype`, `wayfinder:research` or `wayfinder:task`, and no other label.
- **Blocking** is GitHub's own "blocked by" link (`gh api repos/bradyg7/wordbench/issues/<n>/dependencies/blocked_by`,
  POST `{"issue_id": <id>}`). Sub-issues: `.../issues/<map>/sub_issues`, POST `{"sub_issue_id": <id>}`. Both take the
  issue's `id`, not its number.
- **Claim** = assign the issue to `bradyg7` before any work (`gh issue edit <n> --add-assignee bradyg7`).
- **The frontier**: `gh api repos/bradyg7/wordbench/issues/<map>/sub_issues` and keep the open, unassigned ones whose
  `issue_dependencies_summary.blocked_by` is 0.
- **Read one issue**: `gh issue view <n> --comments`. Load the map's body once per session; never every issue.
- **Resolve**: post the answer as a comment, write the result into the repo (Design clone, `design/map` or the branch
  the session names), link that commit in the comment, close the issue, and add one line to the map's *Decisions so
  far*. Research findings stay in comments, split if long; no `research/*` branches.
- **Export**: `gh issue list --label wayfinder:map --state all --json number,title,body` and `gh issue view <n>
  --comments --json comments` save everything to a file if ever needed.
