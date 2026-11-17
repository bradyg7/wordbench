# How builds, reviews and merges work

Set 2026-11-17 (the person asked that builders work to completion). One page.

## A build

1. The overseer starts a `builder` with a short brief: worktree, branch, design folder. The common rules live in [`builder.md`](../.claude/agents/builder.md), not in the brief.
2. The builder works until every line of the folder's "What the build must satisfy" is built and ticked with evidence, or stops on a named blocker (a decision missing from the README, a missing tool, a design contradiction).
3. Its report begins "N of M lines done".

## Desk lines

A checklist line that needs the real app (desk.mjs, `npm run measure`, "the reader's place is kept" in the running window) is marked `(desk)` in the README. Builders tick the other lines. One desk check step, run alone afterwards by the `installer` or another named agent, with no other build compiling, runs those checks on a scratch copy and ticks the `(desk)` lines. If desk.mjs lacks the case, the builder adds it as part of the build.

## Review before merge

After each builder reports, the overseer starts a `reviewer` on the diff against the folder's list. The reviewer returns a numbered list: lines unbuilt or stand-ins, ticks without evidence, conflict markers, commands without a test, a rule from `AGENTS.md` broken. The overseer sends that list to the same builder (SendMessage, so it keeps its context), and repeats until the list is empty. Only then is the branch offered for a pull request.

## Machine load

At most 2 builders compile or run tests at once; start the rest when one finishes. Each uses `-j 2`.

## Open after merge

If the person merges a partial build, the unticked lines are copied under an "Open after merge" heading in the folder's README (line text, the reason). A completion builder's brief is then the folder name: close the open lines. Remove the heading when empty.
