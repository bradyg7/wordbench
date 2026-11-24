# How builds, reviews and merges work

Set 2026-11-17 (the person asked that builders work to completion); the clones and CI as of 2026-11-23. One page.

## A build

1. The main session starts a `builder` with a short brief: the branch and the design folder or ticket. The builder works in the Main clone (see AGENTS.md, "Two clones"). The common rules live in [`builder.md`](../.claude/agents/builder.md), not in the brief.
2. The builder works until every line of the folder's "What the build must satisfy" is built and ticked with evidence, or stops on a named blocker (a decision missing from the README, a missing tool, a design contradiction).
3. Its report begins "N of M lines done".

## Desk lines

A checklist line that needs the real app (desk.mjs, `npm run measure`, "the reader's place is kept" in the running window) is marked `(desk)` in the README. Builders tick the other lines. The builder runs the desk cases itself at the end, on a scratch copy, and ticks the `(desk)` lines; if it cannot, the `installer` or another named agent runs them afterwards. If desk.mjs lacks the case, the builder adds it as part of the build.

## Review before merge

After each builder reports, the main session starts one `reviewer` on the diff against the folder's list. The reviewer runs the new tests and the quick checks, shows each new test failing with the change undone, and returns a numbered list: lines unbuilt or stand-ins, ticks without evidence, tests that never failed, commands without a test, a rule from `AGENTS.md` or `CODING_STANDARDS.md` broken. The list goes back to the same builder (SendMessage, so it keeps its context), until it is empty.

## Merge

The branch is pushed, and CI (`.github/workflows/ci.yml`) runs the full suites. It reaches `main` when CI passes and the person says go. One builder at a time (the person, 2026-11-17: feature by feature). Never merge a partial build as a plan: a feature merges when every line is ticked, or when the one remaining blocker is named and is the person's.

## Open after merge

If the person merges a partial build, the unticked lines are copied under an "Open after merge" heading in the folder's README (line text, the reason). A completion builder's brief is then the folder name: close the open lines. Remove the heading when empty.

## Waiting on a build

A long command is started with `run_in_background`; the agent does other work, and when nothing is left it ends its turn with a one-line note. The harness resumes it when the command finishes. A hook refuses `sleep` and wait loops (2026-11-17: one builder made 347 of them and three runs were stopped by the 600 s stall watchdog; 2026-11-22: a builder ran one spec 44 times in 139 minutes).
