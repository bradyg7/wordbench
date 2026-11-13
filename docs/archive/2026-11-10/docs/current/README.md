# Current debugging queue

Reviewed 2026-11-09 against [Phase 2 results](../phase2-results.md), the [original debugging spec](../../../debug-spec.md), the [redesign handoff](../../../handoff-redesign.md), source code and all 39 finding filenames. The 13 findings absent from the original spec are scoped in [New findings](findings-2026-11-09.md). Finding status belongs to the study folder. An open file can describe work already integrated.

## Integrated

- M1–M6 and S1–S7 are built (§§26–27). M5 ships a provisional 90% second-reader text size. C2 and C1 are built (§§28–29).
- R1's page model, R2's Shelf tree, R3's export styling, Looks, templates and Adjust pane, and R4's toolbar, Settings, themes and basic Layouts are integrated. R5 is integrated with Webster's 1913 and requires a local dictionary database. See the [archived R5 record](../../../redesign-R5.md).
- The handoff's merged desktop check is recorded as **420/420** at `3078ede`. The earlier 375/375 in §35 is the pre-merge result. The handoff lists other checks separately.

## Still current

| ID | Remaining scope and acceptance |
|---|---|
| D1 | Implement single and batch delete with Undo, including Delete All Pages, per the [original decision](../../../debug-spec.md#decided). Before coding, settle the repo rule change and clarify how a restart treats a pending undo versus older Trash entries. Test restored parent/order/pin/anchor and children, 10-second single and 30-second batch windows, restart behavior, and CLI parity. |
| S8 | Review the [filter sheets](../../../../../design/exports/filter) against the post-R1 page kinds and the new request for visual controls. Build after acceptance. |
| [R1](../redesign-R1.md) | Verify real-mouse reorder, phone thread pages, and the `/~` and `/word` picker flows. Search Every Page should find thread names and notes. Expose question fold/unfold. Confirm nesting via a sidecar before changing hierarchy or persistence. |
| [R2](../redesign-R2.md) | Drag an open tab onto a Shelf folder, verify phone actions, and decide how to open multiple pages as separate tabs. Verify what Open All does with ordinary pages and thread pages separately on the merged build. |
| [R3](../redesign-R3.md) | D4 parts builder and D11 ink measure. Decide whether to show an explicitly labeled Word estimate or leave pagination unavailable. Retain plan and verse checks. W-5 still calls for opening actual generated Word and PDF outputs, including Word on a machine without the fonts. |
| [R4](../redesign-R4.md) | Layouts should restore pane placement, bands, floats and sizes, including older saved layouts. Add shortcut assignment with collision checks. Coordinate with the new fullscreen finding. |
| Merged verification | Keep the recorded desktop result. Collect results on one merged revision for real drag, WebKit, golden suite, document plans, Python compatibility, and Rust if a current full run cannot be established. Refresh Phase 2 results when checked. |
| Waiting or deferred | W-1 tablet keyboard retest, W-2 chronological reading-plan source, W-4 user marking handled findings, M5 size confirmation, and R6 Mark Read after phase-6 Listen. R5 resolves W-3's source choice. The Phase 2 week has a recorded start (§9). Confirm its closeout separately from the desktop pass. |

[Daily findings workflow](findings-workflow.md). Phase 1 results stay at their existing path as the live Python compatibility reference. Phase 2 results stay at their existing path as the integration record. Broader roadmap and distribution documents sit outside this queue.

[Session handoffs and sequencing](handoffs/README.md).
