# Plan: the next phase — finish the desktop (phase 2b)

Status: accepted, 2026-11-03 ("Desktop first, as planned"): phase 2b comes before the phone, with the defaults below
(documents brought forward, the phase 2 check runs to 2026-11-09, the dock decided by the spike, no third translation
yet). Steps 1 to 3 are built (2026-11-03 and 11-04; [phase2-results.md](phase2-results.md) section 11).

## 1. Where things stand

- Phase 2 is built and its check is running: a week of daily study on the real folder, started 2026-11-02 about 23:15,
  so it would end about **2026-11-09**. Day 2's 22 findings are listed in [phase2-results.md](phase2-results.md) section
  10: the eleven bugs and the four decisions are built (fc88cda); seven items wait for design (16–22).
- **The check's rule was broken once, for a good reason.** On 2026-11-03 at 18:16 the Python app built two documents
  from the Phinehas thread (`documents/thread-phinehas-script.json`, a Speaker Script in Word, and
  `thread-phinehas-verse.json`, a verse deck, theme olivet). Documents are phase 5 in PLAN.md, so the Rust app cannot do
  this yet. Until it can, "a week without the Python app" cannot pass as written.
- **Since the day-2 list**, the person wrote two notes about the app:

| Note | What it says | Where it goes |
|---|---|---|
| `7a77` (John 3:16, edited) | "need to make room for translation changes" (again; item 21) | Section 3, step 2 |
| `564e` (Inbox) | Verses and words should be clickable, not hoverable; once clicked they should be tabs that can be dragged: "a replication of the dockview type system of dragging tabs" | Section 3, steps 1 and 4 |

  `564e` reverses part of a phase 2 decision ("dockview-core was not used": fixed columns, no free tiling) and joins item
  18 (dropping a tab at the top middle floats it; want fixed zones there; view presets).

PLAN.md's next phase is 3, the phone. This plan proposes finishing the desktop first, because the person's notes are
nearly all about the desktop, and the phone is built from the same UI: what is settled here (click instead of hover,
cards as tabs, the Journal) is what the phone needs anyway.

## 2. What phase 2b is for

The desktop replaces the Python app for everything the person does day to day, **documents from a thread included**,
and the open design items are designed and built. Then phase 3 (the phone) starts from a desktop that is finished.

*Check:* a week of daily study, including building a lesson's documents from a thread, without opening the Python app.

## 3. The work, in order

Each step ends with `node measure/desk.mjs` passing (new checks added for it), the WebKit tests, `cargo test`, and the
golden suite where a `wb` command changed; and a `wb` command for any new core action.

### Step 1 — click, not hover (built 2026-11-03)

- A verse number, a word and a reference in a note open their card **on a click** at every size, as a tap does on the
  phone. Hover cards become a setting, off by default (`hover on|off` already exists for references in notes; it covers
  the reader too).
- One way to open a card on every device makes phase 3 simpler: the desktop and the phone share the cards.

### Step 2 — translations (built 2026-11-04)

- A translation switch in the reader: KJV or YLT (both in the database; `compare` already shows the YLT). The place,
  marks and notes stay with the KJV's words; on the YLT the reader shows the text and its verse-level notes, and says
  that highlights are drawn on the KJV. `wb text --version ylt` already gives the text; `version ylt` in the command
  field switches the reader.
- **Room for more:** the database's text tables keyed by version, so a third translation is data, not code. Which ones
  (public-domain texts, or licensed ones) is the person's choice, each with its source and license checked before it is
  built into `workbench.db` (the database stays read-only for the app; it is built by the Python repo's scripts).

### Step 3 — reading plans pane (built 2026-11-04; item 20)

wb-core and `wb` already have plans and progress. A pane: the plans there are, today's reading, start a preset plan,
make one's own (books, days), change it later, and see what was read when (`reading/log.jsonl`). Plans keep the Python
app's formats.

### Step 4 — design round (FigCraft sheets, then the person's review)

One round, in the same FigCraft file as the phase 2 sheets, covering:

1. **The dock, dockview-style** (`564e`, item 18): a clicked card (verse, word, reference) opens as a tab; any tab can be
   dragged to a column, to a top or bottom zone across the middle, split beside another, or floated; drop zones shown
   while dragging. The sheets settle whether this is built on our dock (475 lines today) or on dockview-core; a spike of
   each on the WebKit tests decides, since the phone must keep the "one pane as a screen" form.
2. **View presets** (item 18; the layouts of phase 6 brought forward): "word study mode" and the like, saved and
   chosen from the toolbar or `layout <name>`.
3. **The Journal as a writing space** (item 16): a long page per day, references in it as links and hover/click cards,
   Markdown as plain text in the file. The lesson half (the Notebook as a lesson's staging area) is drawn here and built
   with documents (step 6).
4. **The Shelf as folders** (item 17): sets as folders of places, notes, threads and panes; opening a set opens its tabs.
5. **Settings and Customize** (item 19): which toolbar buttons show, the command bar, the reading font and italics (item
   10's first try), hover on or off. Themes and more fonts (item 22) are drawn here, built with documents (they share
   the themes).

*Check:* the person accepts or changes each sheet before it is built.

### Step 5 — build the design round

In the order the person picks; the dock first unless they say otherwise, because cards as tabs touch every pane.

### Step 6 — documents from a thread, brought forward from phase 5

The two the person built on 2026-11-03, from the Phinehas thread with its notes (item 14 made thread notes for this):

- **Speaker Script** (`.docx`, structure `script`) with `docx-rs`, from the Python app's `craft_plan.py` plans carried
  over as they are.
- **The verse deck**: first as PDF pages through Typst (spike (c) in `spikes/pdf`), since `.pptx` has no mature crate;
  `.pptx` from a template per theme follows in phase 5 if the person still needs PowerPoint itself.
- The present rule: after rendering, every verse in the file is checked against the database. The files in
  `documents/` keep the Python app's format (`plan` and `file` fingerprints), so both apps see the same documents.
- *Check:* the Phinehas Speaker Script and deck rebuilt and compared with the Craft-built ones, opened in real Word and
  a PDF viewer.

Lessons, the other structures and purpose presets, and `.pptx` stay in phase 5.

## 4. What does not move

- Phase 3 (the phone) follows phase 2b as planned; the sync remote is chosen at its start.
- The iPad design (Medium) stays before phase 4.
- Read aloud, recordings and the select box stay in phase 6.
- The study folder rules: the scratch copy for tests, the real folder only through the person's own shortcut, the backup
  script before any build that writes a new kind of file reaches it.

## 5. Decisions for the person

1. **Finish the desktop first (this plan), or go to the phone now** and leave steps 4–6 for later?
2. **Documents now** (step 6), or keep using the Python app for documents until phase 5 and let the check allow that?
3. **The phase 2 check:** let it run to 2026-11-09 as it is (findings listed by day, as on day 2) while steps 1–3 are
   built and installed with `scripts/install-app.ps1`; or close it now and run phase 2b's check at the end.
4. **The dock:** keep ours and extend it, or adopt dockview-core (decided by the spike in step 4.1 unless the person
   already prefers one).
5. **Translations beyond the YLT:** which, if any; each needs its source and license checked.
