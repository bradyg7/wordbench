# How builds, reviews and merges work

Set 2026-11-17 (the person asked that builders work to completion). One page.

## A build

1. The overseer starts a `builder` with a short brief: worktree, branch, design folder. The common rules live in [`builder.md`](../.claude/agents/builder.md), not in the brief.
2. The builder works until every line of the folder's "What the build must satisfy" is built and ticked with evidence, or stops on a named blocker (a decision missing from the README, a missing tool, a design contradiction).
3. Its report begins "N of M lines done".

## Desk lines

A checklist line that needs the real app (desk.mjs, `npm run measure`, "the reader's place is kept" in the running window) is marked `(desk)` in the README. Builders tick the other lines. The builder runs them itself at the end, alone on the machine, on a scratch copy, and ticks the `(desk)` lines; if it cannot, the `installer` or another named agent runs them alone afterwards. If desk.mjs lacks the case, the builder adds it as part of the build.

## Review before merge

After each builder reports, the overseer starts a `reviewer` on the diff against the folder's list. The reviewer returns a numbered list: lines unbuilt or stand-ins, ticks without evidence, conflict markers, commands without a test, a rule from `AGENTS.md` broken. The overseer sends that list to the same builder (SendMessage, so it keeps its context), and repeats until the list is empty. Only then is the branch offered for a pull request.

## Machine load

One builder at a time (the person, 2026-11-17: feature by feature, never many at once). A builder has the machine to itself, so it may build the Tauri app and run the desk and measure checks itself; start the next builder only when the last one has finished and passed review. Each uses `-j 2`. Never merge a partial build as a plan: a feature merges when every line is ticked, or when the one remaining blocker is named and is the person's.

## Open after merge

If the person merges a partial build, the unticked lines are copied under an "Open after merge" heading in the folder's README (line text, the reason). A completion builder's brief is then the folder name: close the open lines. Remove the heading when empty.

## After a pull request merges

Each build lives in its own worktree and branch (`feature/<folder>`), and the worktree is removed once the work is on `main`. From the main checkout, in the person's terminal:

```
powershell -ExecutionPolicy Bypass -File scripts\finish-worktree.ps1           # dry run: says what it would remove
powershell -ExecutionPolicy Bypass -File scripts\finish-worktree.ps1 -Apply    # removes them
```

A worktree and its local branch are removed only when its work is on `origin/main` (the branch is an ancestor, or its pull request is merged with the same last commit; a squash merge counts), nothing is uncommitted or untracked in it, it is not locked, and no process has it open. Otherwise it is kept, with the reason. A branch with no pull request that only sits on `main` (perhaps just made) is kept unless `-IncludeEmpty`; worktrees made by other tools (Codex, Gemini) are kept unless `-IncludeOtherTools`. Remote branches and the main checkout are never touched. The checklist ("What the build must satisfy") is checked before the pull request, by the builder and reviewer; the merge is the signal that it was accepted.

## Waiting on a build

Builders never wait with `timeout`/`until`/`sleep` loops. A long command is started with `run_in_background`, and the builder does other work or looks at its log once; one wait is at most 45 seconds. (2026-11-17: one builder made 347 such loops, and three runs were stopped by the 600 s stall watchdog.)
