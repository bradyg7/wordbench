# Issue tracker: design folders, not GitHub Issues

For Matt Pocock's skills (`to-spec`, `to-tickets`, `implement-spec`, `triage`). This repo does not use GitHub
Issues. Work is tracked in the design folders:

- **Spec** = `design/features/<folder>/README.md`: dated decisions, the interaction table, "what the build must
  satisfy". Building starts only from a folder the person marked *accepted*.
- **Tickets** = a few rows of that folder's interaction table, each buildable and testable on its own. The table
  records which rows are built.
- **Index** = `design/features/coverage.md` (every area of the app and the folder that designs it).
- **Branches**: `feature/<folder>` for a design, `fix/<what>` for a bug, from an up-to-date `main`, in this one
  checkout (no worktrees).

`to-spec` writes into the folder's README; `to-tickets` cuts rows of its table. Neither creates GitHub issues
or `.scratch/` files.
