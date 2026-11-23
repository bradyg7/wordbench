# Lessons and documents (Word, PDF, Present)

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** accepted by the person 2026-11-17 (ready to build); was exploring (round 2 drawn 2026-11-16) · **Sheets:** `python design/features/documents/documents.py` writes `documents.figcraft` and
`documents.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · The new design is not built; `wb craft …`
and `wb docs …` exist today. What other tools get wrong, and so what this folder avoids:
[bible-software-complaints](../../research/bible-software-complaints.md) (theme 4: exports that drop the verse
reference; work trapped in the app).

**Readiness: likely finished** (2026-11-16, the Notebook pass, by [ready-criteria](../ready-criteria.md)); the person
accepted it on 2026-11-17, with DC-1 to DC-10 as written and the recommendation on lessons (DC-11). Inferences first:
DC-1 to DC-10 (below); DC-1 (A and B joined) and DC-2 (no document template) carried the most.

- **1** one design (DC-1); D2's template link superseded (DC-2) and not drawn. The board shows D1-D11 only (read from
  `documents.figcraft`); D11, the Word half of D2's switch, was added to the Leading table on this pass.
- **2** no open question; "Needs the person" 1 (lessons as pages) was the foundation's, with a recommendation, and
  D2-D11 never need it. Decided by the person 2026-11-17 (DC-11).
- **3** D7-D10 drawn. **4** every line names inputs and a result; the reader's place is its own line.
- **5** existing `wb craft`, `wb docs`, `wb lesson` named; `wb docs like` and `wb craft … --folder` named as required.
- **6** [overlaps](../overlaps.md) "Templates: pages and documents" resolved (DC-2, library L-14); "Documents' Present"
  agrees with minimize.
- **7** agrees with `AGENTS.md` (every verse checked, DC-8) and `docs/SPEC.md:33` (where files go, DC-4).
- **8** Numbers 25:11-13 from `data/num25-11-13.json` (`documents.py:42`); shortened verses cut by word position.
- **9** no suggestion or commentary; a Look is styling only (DC-7). **10** no format change; a field added to the
  app's own `documents/` record is read as absent in old records.

The person accepted D2 and D11 (the builder), D6 (Make another like this), D3 (the viewer), D4 (Looks), D5 (where it
went) and D7-D10 on 2026-11-17. D1 is today, for comparison.

Documents made from a page, a folder, a passage or a lesson; 868e asks for an in-depth design and a builder like the
page templates.

## Leading design (2026-11-16)

| Part | Leading | Superseded (and by what) |
|---|---|---|
| Today | D1 (as built, for comparison) | |
| Making a document | D2 (the builder from a page's parts, as slides), D11 (the same parts as a Word document), D6 (a document's menu; Make another like this) | D2's link "Keep as a document template" (by DC-2) |
| Looking at it | D3 (the viewer: arrow keys, Present) | |
| Looks | D4 (chosen from pictures) | |
| Where it went | D5 (the line after Make) | |
| The real conditions | D7 (among other tabs), D8 (floating), D9 (narrow), D10 (years of study) | |

## The person's findings that touch it (read only, `bible-study-data/findings`)

| Finding | In short |
|---|---|
| 868e | Scrap the old Word and slide designs; design them in depth; a document template builder |
| a148 | ← → through slides in the viewer |
| 2089 | Show in folder goes to the wrong place |

## Decisions (the person)

- **2026-11-17:** the design accepted as drawn (rounds 1-2, DC-1 to DC-10), and the recommendation on lessons (DC-11).

Round 1 was not reviewed on its own. Decided elsewhere and binding here: Present is for documents only
([minimize](../minimize/README.md)); every verse in a made file is checked after it is made, and one that fails is not
kept (`AGENTS.md`).

## Decisions (2026-11-16)

Each is **decided by overseer from existing decisions (inference)**, dated 2026-11-16.

| # | Decision | Rests on |
|---|---|---|
| DC-1 | **A and B are one design**, not alternatives: the builder from a page's parts (D2), the viewer (D3), Looks from pictures (D4), the line saying where the file is (D5). Each answers a different finding. | 868e, a148, 2089 |
| DC-2 | **A document keeps its own choices; there is no separate document template.** Which parts are in, what each becomes and the Look stay with the document (`documents/` record), as `wb craft` already does ("the switches it was last made with stay"). The "template builder" 868e asks for is **Make another like this…** in a document's menu: the builder opens on another page with the same choices and Look (D6). A page template (`wb template`) makes a page; it is a different thing and stays the library's. | 868e; `wb craft word` help; overlaps "Templates" |
| DC-3 | **A source is a page, a folder (what a thread was: its saves in order and its pages), a passage or a lesson.** `wb craft --thread NAME` keeps working on a folder with a color. | [threads](../threads/README.md) TH-1, TH-3 |
| DC-4 | **Where the file is, is said, not guessed (2089).** The line after Make names the folder the file is really in, and Show in folder opens that folder with the file picked out; a file that is gone says so instead of opening another folder. Where new files go is the spec's rule (`docs/SPEC.md:33`: `<study>/exports/`, `WB_DOCS_DIR` over it, old locations still found), not a choice of this folder. | 2089; `docs/SPEC.md:33`; `wb docs reveal` |
| DC-5 | **Formats are a Word document and PDF slides**, as built. PowerPoint is not in this design (the spec leaves it to the person). | `docs/SPEC.md` (Retiring the Python app) |
| DC-6 | **The viewer** pages with ← and →, shows "2 of 4", a strip of the slides, and Present for the whole screen; a Word document is paged the same way (D3). | a148; minimize (Present) |
| DC-7 | **Looks are chosen from pictures of the same slide**, whole, with the one new documents use marked "In use" (D4). A Look is styling only. | 868e; `wb docs looks` |
| DC-8 | **The verse check is shown**: after Make, a quiet second line says how many verses were checked (D5); a failure says which verse and keeps no file. | `AGENTS.md` |
| DC-9 | **Many documents** are grouped by what each was made from, folded, with a search field, the count behind and "Update the N" (D10). A row's actions are in its menu (D6), not a line of links. | index, "the real conditions" |
| DC-10 | **Lessons stay a source as they are** (`lessons/*.md`, `wb lesson …`, `wb craft --lesson`). Whether they become pages was the person's ("Needs the person" 1; now DC-11). | `AGENTS.md` ("Everything is a page" names notes, questions, days and threads, not lessons) |

## Decisions (the person, 2026-11-17)

Each is **decided by the person 2026-11-17 (accepted the recommendation)**: the overseer's recommendation under "Needs
the person", accepted as written.

| # | Decision | Rests on |
|---|---|---|
| DC-11 | **Lessons become pages, later, as their own one-time move**, so there is one kind of writing (a page) with one builder. Not now: until that move is designed and run, lessons are read where they are and made into documents as today (DC-10), and D2-D11 start from a page and never need a lesson to move. The move is designed first (a lesson's slide marks need a page block before it, or moving early would lose how a lesson builds), reads the old form, is tried on a scratch copy after a hashed backup (`scripts/backup-study.ps1`), and runs on the real folder only with the person's go-ahead for that run; this decision moves no file. | The person, 2026-11-17 (was "Needs the person" 1); `AGENTS.md` (a move is designed first, scratch copy, hashed backup, go-ahead) |

## Needs the person

Nothing. ~~1. Do lessons become pages?~~ Decided by the person 2026-11-17 (accepted the recommendation): DC-11.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-12 | D1-D5 | today; a builder from a page's parts and the viewer; Looks and where files go | Not reviewed by the person. A and B joined by the overseer (DC-1, 2026-11-16) |
| 2 | 2026-11-16 | D2, D4, D5 redrawn; D6-D11 | no document template (D2); Looks as whole pictures (D4); the real folder and the verse check (D5); Make another like this (D6); the real conditions | Accepted by the person, 2026-11-17 (with DC-11) |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-11-13.json` | `wb text "Num 25:11-13"` |

Scripture is fetched from the database, never typed; a shortened verse on a small picture is cut by word position
(`cut`, asserted inside the verse). Names of pages, folders and documents are a drawn sample.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | D7 (the viewer as one tab of four beside the reader) |
| Floating | D8 (the viewer as a 340 px floating pane) |
| Narrow | D9 (the builder in a 420 px column: parts, Make, then the preview) |
| Years of study | D10 (318 documents, 12 behind, grouped by source) |

## What the build must satisfy

Each line is checked in a Rust test or the desk check, on a scratch study whose documents go to a scratch folder
(never the person's documents).

- [ ] **The builder.** From the page "Phinehas", Make a document… lists the page's parts exactly as `wb craft parts --page ID` does, each with a tick and what it becomes; unticking a part and pressing Make gives a file equal to `wb craft deck --page ID --off KEY` (D2).
- [ ] **Word or Slides.** The switch makes a `.docx` or a PDF deck from the same parts; the preview beside the list changes with it before Make (D2, D11).
- [ ] **Choices stay with the document.** Making it again with no change keeps the same parts and Look (`wb docs show` says so); there is no "document template" anywhere in the window (D2, DC-2).
- [ ] **Make another like this.** From "Phinehas · Slides", Make another like this… on the page "Tuesday study" opens the builder with the same Look and the same choice for each kind of part; the first document is not changed (D6).
- [ ] **The viewer.** → and ← move one slide, stop at the first and last, and the count reads "2 of 4"; Present fills the screen and Esc returns to the same slide (D3; `wb docs preview`).
- [ ] **Looks.** The Looks pane shows one picture per Look from `wb docs looks`, each of the same slide and whole; choosing one and making a document equals `wb craft deck --look NAME`; "In use" marks the Look `wb docs look NAME --use` set (D4).
- [ ] **Where it went.** After Make the line reads "Made <name>, in <folder>" with the folder the file is in; Show in folder opens that folder with the file selected (`wb docs reveal`); with the file deleted by hand it says the file is gone and opens nothing (D5, 2089).
- [ ] **The verse check.** After Make the line says how many verses were checked; with a source verse altered in a test double, no file is kept and the line names the verse (D5).
- [ ] **A folder as a source.** `wb craft word --thread Phinehas` on a folder with a color gives the same plan fingerprint as before the change (`wb docs plan`) (DC-3).
- [ ] **Among other tabs, floating, narrow.** As one tab of four the viewer keeps the count and Present in its head; floated at 340 px the slide is whole with both arrows; at 420 px the builder stacks parts, Make, then the preview, and Make is visible without scrolling when the page has 6 parts or fewer (D7, D8, D9).
- [ ] **Years of study.** With 318 document records (12 behind) the pane shows the head line "318 documents · 12 behind", the groups folded with counts, and opens inside the list budget of `npm run measure`; "Update the 12" equals `wb docs update` with no name (D10).
- [ ] **The reader's place is kept.** From Numbers 25:11, opening a document's viewer as a tab, presenting it, leaving Present and closing the tab leaves the reader at Numbers 25:11 at the same scroll position; a document made from a page returns to that page at the block it was opened from.
- [ ] **Commands.** Existing: `wb craft parts | word | deck | designs | theme`, `wb docs list | show | plan | update | open | open-preview | preview | reveal | looks | look | forget | remember | delete`, `wb lesson list | show | save | rm | check | build`, `wb packet`, `wb pdf`, `wb pdfs`. Required and missing today: `wb docs like <document> --page ID` (Make another like this), and `wb craft word | deck --folder NAME` as the new name beside `--thread`.
- [ ] **Lessons as they are.** `wb lesson list` and `wb craft word --lesson NAME` on a scratch study's `lessons/` give the same output as before the change, and nothing under `lessons/` is written by this build (DC-10, DC-11).
- [ ] **The study files.** No format change: `documents/` records as today. If "Make another like this" needs a field the record lacks, it is added to the record (the app's own file, not the person's writing) and old records are read without it. Lessons are not moved by this build: their move into pages (DC-11) happens once, designed, tried on a scratch copy after a hashed backup (`scripts/backup-study.ps1`), with the person's go-ahead.

## Out of scope / later

- Page templates (`wb template`): [library](../library/README.md). Present and full screen:
  [minimize](../minimize/README.md). The Settings tab for documents: [settings](../settings/README.md).
- PowerPoint, PDF packets and editing a PDF: the spec's retirement list, not designed here.

## Overlaps

[overlaps.md](../overlaps.md): "Templates: pages and documents" (resolved, DC-2), "Documents' Present" (agrees).
