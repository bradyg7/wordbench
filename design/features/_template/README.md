# <Feature name>

**State:** grilling · **Prototype:** `prototype/` (how to open it) · Nothing here is built yet.

One paragraph: what the feature is for, in the person's words, and which part of the app it touches. Words come from
[the glossary](../../../GLOSSARY.md); a new word is added there first, with the person's go-ahead.

How a feature is designed: [how work is done](../../../docs/agents/how-work-is-done.md#designing-a-feature). The State
is one of *grilling*, *prototype* (being played), *accepted* (the person's word, dated), *building*, *built*.

## Decisions (the person, YYYY-MM-DD)

Written as the grilling answers them, dated, newest last. Each says what was chosen and what was rejected, so the
build does not reopen it.

- **Short name.** What was decided. What was rejected, and why if the person said.

## What the person said at play

What worked and what did not, each time the person plays the prototype, dated.

## What must be true

One item per thing a person does. The person writes and checks the first four lines; the builder fills the last, and
the reviewer checks it. *Before* and *after* use [named states](../../../GLOSSARY.md#named-states).

**1.**
> **You see before:** [state], …
> **You do:** …
> **You see after:** [state], …
> **You feel:** the one or two feel qualities most at risk, or "checked at play"
> — *for the builder:* **on disk** … · **`wb`** `wb …` (or "none: view only") · **proven by** `…` · built in ticket … [ ]

## Tickets

| Ticket | Items | Branch | State |
|---|---|---|---|
| 1 | 1, 2 | `feature/<folder>` | |

## Out of scope / later

- Things raised that belong to another feature (link its folder), or to [the parking lot](../../../docs/turnaround-parked.md).
