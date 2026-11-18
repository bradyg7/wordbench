# Bible Workbench minimized tabs design handoff

Review the Rust app on `codex/rust-python-retirement`, starting from `9823f5e`. The local checkout is `C:\Users\brady\.codex\worktrees\rust-python-retirement\bible-workbench-rs`. Export and read-aloud work is underway separately. This handoff asks for a design proposal in text, but also to create a design in FigCraft. Bring the proposal back to the parent Codex chat for review before implementation or Git changes.

## What exists today

- Minimize acts on the tab group containing the active pane. In a split column, it hides one group and leaves the other group, opposite column, and bands in place. A column drawn as one strip minimizes as a unit.
- A fully minimized column gets a vertical restore button. A minimized group within a split column gets a bar at the column foot. Minimized floating groups and bands use chips near the bottom of the reader.
- The app supports saved layouts. An individual minimized tab should not be treated as a saved or bookmarked pane. The reader also uses transient surfaces such as click-a-word cards, so inspect which surfaces actually participate in the dock.
- The user finds the current minimized presentation visually awkward. They want to reconsider multi-selection at the same time, because the Rust app has a different mix of tabs and transient surfaces from the Python app.

## Proposal to return

1. Walk through the current behavior with two tabs in one group, two groups in a split column, and two floats. Identify where the restore control appears, what its label means, and what restores on pointer or keyboard activation.
2. Propose a minimized state and restore affordance that fit the reader layout. Describe how it behaves at desktop, medium, and compact widths. Include labels and discoverability when several groups are minimized or titles are long.
3. Decide which units the proposal treats as individually restorable and which move together. Specify what happens to active tabs, scroll, focus, group placement and size, and the reader's verse position on restore. Cover the distinction between minimize, close, and saved layout.
4. Assess whether multi-selection serves a specific task in Rust. If it does, specify the eligible surfaces, bulk actions, keyboard or pointer entry, and how selection is cleared. If the current app has no concrete use for it, recommend leaving it deferred. Include the word card as an example when evaluating eligibility.
5. Identify implementation touchpoints, regression cases, and the decisions the user needs to make. Consider the new reader controls and document preview/open actions as integration points. Give one recommended direction and explain the tradeoff if another direction is viable.

## Source entry points

| Location | What to inspect |
| --- | --- |
| [Dock](../ui/src/dock.ts#L351) | Group minimization, restore bars and chips, floating groups, tab-strip controls, layout restore. |
| [Desktop styles](../ui/src/desk.css#L65) | Vertical restore button, split-column restore bar, and minimized chips. |
| [Command actions](../ui/src/actions.ts#L507) | Typed pane minimize and restore, including the minimized group target. |
| [Layout state](../ui/src/layout-state.ts) | Pane identity, saved layout, and scroll state. |
| [Reader](../ui/src/main.ts) and [panes](../ui/src/panes.ts) | Reader position and the distinction between transient controls and docked tabs. |
| [Reader browser tests](../ui/tests/reader.spec.ts#L275) and [native desk checks](../measure/desk.mjs#L1917) | Existing restore behavior and unaffected neighboring groups. Read the checks as evidence for this design pass. |

Please keep this pass read-only. Return the proposal to the parent chat. The user will review design, implementation timing, commits, merges, and pushes there.
