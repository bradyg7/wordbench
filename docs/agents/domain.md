# Domain docs: where the engineering skills look

For Matt Pocock's skills (`mattpocock-skills` plugin, project scope in `.claude/settings.json`). They expect a
root `GLOSSARY.md` and `docs/adr/`; this repo keeps the same things elsewhere. Read these instead.

## The glossary: `design/LIBRARY.md`

The Library map is the app's one glossary: its objects (Library, Bible, Page, Folder, Save, Mark, Legend…) and
their words. Root `GLOSSARY.md` points to it for the app's words and holds the development words (CI, clippy,
ratchet…) itself; step 3 of the turnaround moves the Library map's words into it.

- Use its words in code, tests, issue titles, refactor proposals and test names.
- A new object or word changes `design/LIBRARY.md` first, **with the person's go-ahead** ([how work is done](how-work-is-done.md), Cohesion).
  Never add app words to `GLOSSARY.md` before that move, and never mint a term silently.
- Retired words stay retired: "thread" is now "folder with a color"; "note" is now "page".

## Decisions (the repo's ADRs)

There is no `docs/adr/` yet. Decisions live in two places:

1. `AGENTS.md`, "Rules that never change": the standing rules, each with "(the person, <date>)".
2. `design/features/<folder>/README.md`: each folder's dated decisions.

If your output contradicts one of these, say so plainly rather than overriding it:
*"Contradicts the threads decision TH-1 (2026-11-17), but worth reopening because…"*

## Process vocabulary: the AI Coding Dictionary

Words about how agents work (context window, smart zone, harness, effort, automated check, handoff, grilling…)
follow Matt Pocock's AI Coding Dictionary: https://github.com/mattpocock/dictionary-of-ai-coding
(one file per term in `dictionary/`). Use its words in process documents, retros and reviews.
