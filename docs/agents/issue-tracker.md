# Issue tracker: design folders, not GitHub Issues

For Matt Pocock's skills (`to-spec`, `to-tickets`, `implement-spec`, `triage`). This repo does not use GitHub
Issues. Work is tracked in the design folders:

- **Spec** = `design/features/<folder>/README.md`: dated decisions, what the person said at play, and the "what must
  be true" items. Building starts only from a folder the person marked *accepted* (none is, 2026-11-24).
- **Tickets** = a few of that folder's "what must be true" items, each buildable and testable on its own. Each item
  records which ticket built it.
- **Index** = `design/features/coverage.md` (every area of the app and the folder that designs it).
- **Branches**: `feature/<folder>` for a design, `fix/<what>` for a bug, from an up-to-date `main`, in this one
  checkout (no worktrees).

`to-spec` writes into the folder's README; `to-tickets` cuts its "what must be true" items. Neither creates GitHub issues
or `.scratch/` files.
