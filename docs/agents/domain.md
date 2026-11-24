# Domain docs: where the engineering skills look

For Matt Pocock's skills (`mattpocock-skills` plugin, project scope in `.claude/settings.json`). They expect a
root `GLOSSARY.md` and `docs/adr/`; this repo keeps the glossary where they expect it and its decisions elsewhere.

## The glossary: `GLOSSARY.md`

The one glossary, A to Z: the app's words (Bible, page, folder, save, mark, legend…), the development words (CI,
clippy, ratchet…) and the process words (grilling, prototype, *what must be true*…), each with *Avoid* for the words
not to use. Its **Named states** section lists the states that *what must be true* items start and end in.

- Use its words in code, tests, issue titles, refactor proposals and test names.
- A new word, or a new meaning for one, is added there first, **with the person's go-ahead**; never mint a term
  silently. A word marked *not yet grilled* may still change: check it with the person when a design leans on it.
- Retired words stay retired: they appear only in *Avoid* lines ("thread" is now "folder with a color"; "note" is now
  "page", though a **margin note** is its own thing).

Why the app works as it does (what it is, its goals and rules) is in
[the principles](../../design/features/principles/README.md), read first.

## Decisions (the repo's ADRs)

There is no `docs/adr/`. Decisions live in three places:

1. `AGENTS.md`, "Rules that never change": the standing rules, each with "(the person, <date>)".
2. [The principles](../../design/features/principles/README.md), §3: every standing decision by area, the one-way
   doors marked.
3. `design/features/<folder>/README.md`: each folder's dated decisions.

If your output contradicts one of these, say so plainly rather than overriding it:
*"Contradicts the threads decision TH-1 (2026-11-17), but worth reopening because…"*

## Process vocabulary: the AI Coding Dictionary

Words about how agents work (context window, smart zone, harness, effort, automated check, handoff, grilling…)
follow Matt Pocock's AI Coding Dictionary: https://github.com/mattpocock/dictionary-of-ai-coding
(one file per term in `dictionary/`). Use its words in process documents, retros and reviews.
