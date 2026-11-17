# When is a design finished?

The overseer marks each design folder with one of three readiness levels in its README header and in the
[index](README.md). Only the person marks a folder *accepted*; "ready for acceptance" means the overseer found
nothing left to do but ask. (Set 2026-11-16 by the person's request; the checks come from the gate in the index and
the template.)

## Levels

| Level | Meaning |
|---|---|
| **Unfinished** | Any "unfinished" sign below is present. |
| **Likely finished** | Every check below passes. The overseer lists the evidence (file:line) for each. |
| **Accepted** | The person said so. Only then may a builder start. |

## Checks for "likely finished" (all must pass)

1. **Direction chosen.** One direction is leading; the others are marked superseded. No window is waiting on a
   round that has not been reviewed.
   *The overseer's reading (2026-11-16):* a round that proposes or changes a direction waits on review (library
   round 4). Windows that only draw the chosen design in the real conditions do not: looking at them is how the
   person decides acceptance, so they are listed for the person, with any inference they carry, and do not fail
   this check.
2. **No open questions** the existing decisions can answer. Questions left are only the person's (a change to an
   `AGENTS.md` rule, a study-folder format, or the foundation), each with a recommendation.
3. **The real conditions are drawn:** the part among other tabs, floating, narrow, and with years of study
   (`README.md` gate, template "The real conditions" table). Every cell is "drawn", none "to draw".
4. **"What the build must satisfy" exists and every line is testable**: it names inputs and the expected result, not a
   feeling. It includes the named return case "the reader's place is kept".
5. **Every action has a `wb` command** (existing or named as required), per `AGENTS.md`.
6. **No overlap left unresolved** in `overlaps.md` and no folder in `coverage.md` claims the same thing.
7. **No contradiction with `AGENTS.md` or an accepted folder.** A change to an accepted folder is recorded in
   `overlaps.md` and agreed, not just drawn.
8. **Sheets match the README.** No window draws something a decision removed. All scripture on a sheet is read from
   the database; none typed or paraphrased.
9. **No interpretation** anywhere: no suggestions, commentary or doctrine.
10. **Format changes are designed.** Anything that changes how the study folder is kept has its migration written
    (read old form, scratch copy, hashed backup, person's go-ahead), or is listed as "Needs the person".

## Signs a design is unfinished

- "Round N not reviewed", "exploring" with unreviewed windows, or a decision recorded only in prose with no sheet.
- A "to draw" cell, an empty or vague "what the build must satisfy", or a command the build would have to invent.
- A question whose answer is already in a dated decision; two folders designing the same card.
- A sheet that still shows a superseded button.

## What the overseer writes

In the folder README header: `Readiness: unfinished | likely finished`, the date, and under it either the list of
failing checks (numbers above, with what is missing) or the evidence for each passing check. It never writes
"accepted".
