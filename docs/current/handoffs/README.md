# Bible Workbench debugging sessions

With 20% of the weekly Claude allowance and 80% of the GPT allowance remaining, Codex owns the required work. Claude Haiku at low effort is reserved for an optional H09 spot-check of the completed inventory. [OpenAI model guidance](https://developers.openai.com/api/docs/guides/model-selection) · [Claude Code model configuration](https://code.claude.com/docs/en/model-config)

| Handoff | Suggested model and effort | Start |
|---|---|---|
| [H01 Merged verification](01-baseline.md) | GPT-6.1 Sol · medium | Start now |
| [H02 Reader diagnostics](02-reader-diagnostics.md) | GPT-6.1 Sol · medium | Can start with isolated scratch data |
| [H03 Thread pages and questions](03-pages.md) | GPT-6.1 Sol · high | After baseline |
| [H04 Delete and Undo](04-deletion.md) | GPT-6 Astra · high | Design now, coding after H03 and user review |
| [H05 Dock, Shelf and focus](05-dock.md) | GPT-6 Astra · high | Design first |
| [H06 Visual Notebook editing](06-notebook.md) | GPT-6.1 Sol · high | Design now, coding after H03 and H04 coordination |
| [H07 Export paths, parts and ink](07-exports.md) | GPT-6.1 Sol · high | Audit now, confirm each code slice |
| [H08 Study-tool interaction review](08-study-tools.md) | GPT-6 Astra · high | Design only until reviewed |
| [H09 Help and command parity](09-help.md) | GPT-6 Luna · medium audit, GPT-6.1 Sol · medium implementation | Audit now, final labels after H05 and H08 |
| [H10 User checks and closeout](10-closeout.md) | GPT-6 Luna · medium tracking, user confirmations | Track throughout |

## Shared session rules

- Read the repository's CLAUDE.md and local instructions. Treat findings as evidence of symptoms and intent. Use the handoff for scope.
- The planning checkout is at HEAD `3078ede` with uncommitted distribution, workflow and documentation work. Start implementation from a verified clean checkout or isolated worktree. Give each harness the handoff and current docs if they are absent there. Keep distribution changes out of the patch.
- Use separate scratch data and test ports. Preserve Python compatibility, the reader's place and CLI/UI parity. Keep actual study data read-only. Fetch fixture scripture from the database.
- Bring design and persistence decisions back at the stated gate. When implementation is authorized, keep it scoped and report exact test results. Leave installation for a separate decision.
- H01 owns the baseline record. Each implementation session runs targeted checks. Merge shared test changes in order and rerun affected checks.

## Why these boundaries

- **Aligns with your request.** The required work fits a GPT-first schedule. Astra owns destructive changes and the hardest shared-state or design decisions. Sol handles implementation and diagnostics. Luna handles bounded inventory and tracking.
- **Conflicts with your request.** None identified. Model choices are recommendations based on the work and its risks.
- **Not prompted by you, but relevant.** Put Shelf, Layouts, fullscreen and preview promotion under one owner because they restore the same pane state. Sequence Notebook implementation through thread pages, delete semantics and visual editing to keep changes to the same editor and tests reviewable. Export path changes get a separate patch from export presentation.
