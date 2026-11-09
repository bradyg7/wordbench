# R3 design round: documents in the preview's look, and a template builder

Finding `868e`, item R3 of [debug-spec.md](debug-spec.md). **A design round only: nothing here is built**, and nothing is
built until the person accepts a design. The sheets are `design/r3.py` → `design/r3.figcraft` and
[design/exports/r3/](../design/exports/r3/) (`all.png` is the whole board). Every verse on them comes from
`design/content.json` (fetched with `wb text`); note lines on them are placeholders that say what goes there.

The person said: *"i much prefer the in-app viewer and style of the docx over the original python app design … scrap
those designs of the docx and pdf/pptx slides … an in-depth design spec … a document template builder."* So the
direction is fixed: **the file is made to look like the preview**, not the other way round.

## What the preview's look is (the source of the design)

Read from `ui/src/desk.css` (`.pd-pv-*`, `.dp-*`), which draws a Word file's paragraphs by their style names:

| Style in the file | The preview draws it | Today's Word file (`docx.rs`, WordCraft's) |
|---|---|---|
| Title | Inter 600, 26 px, near-black | the theme's heading font, 30 pt, on a colored band |
| Subtitle | Inter 13 px, grey `#777` | 11 pt, accent or muted |
| Heading 1 / 2 | Inter 600, 20 / 16 px | the heading font, 15 / 12 pt bold, accent |
| Slide Cue | Inter 700, 11 px, tracked, `#8E1B14` | heading font bold, size - 3 |
| Scripture Reference | Inter 600, 13 px, `#8E1B14` | heading font bold, accent |
| Scripture | Literata 15 px / 1.5, the number Inter bold in `#8E1B14` | the theme's *Word* body font (not on every computer) |
| Study Note | Inter 13 px, `#666`, indented 12 px | body font, size - 1.5 |
| Delivery Note | Inter italic 13 px, `#8E1B14` | heading font italic, accent |
| page | white, generous padding, no band | theme paper colors, a band behind the title |

The difference the person sees is mostly three things: **the fonts** (Literata and Inter against the themes' Word
fonts), **the band and fills** (the preview has none), and **color restraint** (one accent, grey notes).

## The sheets

| Sheet | What it shows |
|---|---|
| **D1 · The Word styles** | The ten named styles, each with its font, weight, size and line spacing, drawn at Letter scale. Same names as today (Restyle in Word still works in one place). |
| **D2 · Speaker Script, page 1** | The Phinehas thread as a Speaker Script: large print (1.17 ×), cues, references, scripture in Literata, a note under its verse, a delivery note. Numbers 25:10–13 and Psalms 106:30–31. |
| **D3 · Share Copy, from a page** | The same styles at 12 pt: what a page's blocks become (W7.2). No cues, no notes. |
| **D4 · The template builder** | The editor (below). |
| **D5 · Title slide**, **D7 · Section slide** | The deck in the preview's look: white, Inter, the accent only for the subtitle and a short rule. |
| **D6 · Verse by Verse** | One verse large in Literata, the verses either side faint, the reference in the accent. The boxes are DeckCraft's (the fit sizes carry over); only fonts, colors and weights change. |
| **D8 · Verse by Verse, dark** | A theme is a color set over the same boxes (Vigil here). |

### The proposed Word styles (D1)

| Style | Font | pt | Line | Color | Space |
|---|---|---|---|---|---|
| Normal / Body | Inter Regular | 11 (structure's body size) | 1.5 | ink `#222` | 8 after |
| Title | Inter SemiBold | 20 | 1.25 | ink | 2 after |
| Subtitle | Inter Regular | 10 | 1.4 | `#777` | 14 after |
| Heading 1 | Inter SemiBold | 15 | 1.3 | ink | 16 before, keep with next |
| Heading 2 | Inter SemiBold | 12 | 1.3 | ink | 12 before, keep with next |
| Slide Cue | Inter Bold, caps, +0.8 tracking | 8.5 | 1.4 | accent | keep with next |
| Scripture Reference | Inter SemiBold | 10 | 1.4 | accent | 10 before, 2 after, keep with next |
| Scripture | Literata Regular | 12 (body + 1) | 1.5 | ink | verse number: Inter Bold, superscript, accent |
| Scripture End | as Scripture | | | | 12 after |
| Study Note | Inter Regular | 10 | 1.45 | `#666` | indent 9 pt |
| Delivery Note | Inter Italic | 10 | 1.45 | accent | |
| Footer | Inter Regular | 9 | | `#999` | "Page x of y" |

Every size is multiplied by the structure's print size (the Speaker Script's large print is 14/12 = 1.17 ×, as
`doc_type` already says). Page: Letter (A4 a setting), 1-inch margins, white. **No band, no paper fill**: themes color
only the accent and, for slides, the paper. The Print theme becomes the default for Word (ink only, an almost-black
accent), since paper is printed. Headings change from accent to ink: in the preview only references, cues, verse
numbers and delivery notes carry the accent, and that is what makes it calm.

### The slides (D5–D8)

DeckCraft's boxes stay (`deck.rs`: title at 64,176 832×130; reference at 64,38; before 64,84; verse 64,170 832×240;
after 64,420), so the fit sizes and the verse check carry over unchanged. What changes:

- Fonts: Inter for the title, reference and section; Literata for scripture (already so).
- Weight: titles SemiBold, not regular-on-a-band; the reference SemiBold in the accent.
- The section slide is no longer filled with the theme's color: a 56 × 4 accent rule above a left-set title.
- The default theme is **Paper** (white, ink `#222`, accent `#8E1B14`), the preview's own; the six themes stay as color
  sets (paper, ink, accent, faint) for rooms that need them (Vigil for a dim room, D8).
- Highlights stay as a soft fill behind the words (as today; not drawn on D6).

## The questions the spec asks, answered

### 1. Which structures survive

| Structure | Today | Proposal |
|---|---|---|
| **Speaker Script** (Word) | built | **Keeps**, restyled (D2). |
| **Verse by Verse** (PDF) | built | **Keeps**, restyled (D6). |
| **Share Copy** (Word) | greyed | **Keeps**, built next: speech and scripture, no notes (D3). It is the Speaker Script with cues and notes switched off, so it is a *template* of one Word layout, not new code. |
| **Reader** (slides) | greyed | **Keeps** as a template of Verse by Verse: scripture only, a passage to a slide instead of a verse (no faint neighbours). |
| Pulpit (slides) | greyed | **Dropped.** It is Reader + speaker notes, and a PDF has no speaker notes. The Speaker Script, whose cues number the slides, is the Pulpit's notes on paper. |
| Study Sheet (Word) | greyed | **Becomes a template** of the Word layout: notes on, *Room to write after each passage* on. |
| Reading Sheet (Word) | greyed | **Becomes a template**: scripture only (two columns is a later option of the page setup). |
| Study Table, Thread Map (slides) | greyed | **Dropped** for now. A table on a slide is unreadable from the back of a room; the Thread Map's jumps need an interactive PDF. Say so; they can come back as templates if missed. |
| Thread Dossier (Word) | greyed | **Dropped** for now: the Notebook's thread pane is the reference file, live. |

So: **two layouts** (a Word document, a PDF deck), and **structures become named starting templates** over them:
Speaker Script, Share Copy, Study Sheet, Reading Sheet (Word); Verse by Verse, Reader (PDF).

### 2. Fonts that travel

**Recommendation: embed Literata and Inter in the .docx.** Word for Windows and Mac honor fonts embedded in the file
(ECMA-376 §17.8: `word/fonts/*.odttf`, obfuscated with the key in `fontTable.xml`'s `w:embedRegular` / `w:embedBold` /
`w:embedItalic`, and `w:embedTrueTypeFonts` in `settings.xml`). Both fonts are OFL, which allows embedding. The bundled
files are the Latin and Latin-Ext subsets as WOFF (`crates/wb-core/fonts`, about 280 KB in all); `deck.rs` already turns
WOFF into SFNT, so the same bytes serve. A document grows by about 300 KB.

What must be checked before building (a spike, half a day): that the WOFFs are TrueType-flavoured (Word embeds only
TrueType outlines, not CFF); that Word on Windows shows them on a computer without them installed; what Word does when a
person types a character outside the subset (it falls back per character, which is acceptable).

**Fallbacks** for readers that ignore embedded fonts (Word on the web, Google Docs, Pages, LibreOffice partly): in
`fontTable.xml`, `w:altName` and `w:family` so Literata falls to **Georgia** (then any serif) and Inter to **Segoe UI /
Arial** (then any sans). The design survives the substitution because it relies on size, weight and color, not on
glyph shapes. The **PDF needs nothing**: Typst embeds the fonts already.

The alternative, *substitute only* (write Georgia and Arial in the file), matches everywhere a little and the preview
nowhere exactly; not recommended.

### 3. A template per structure, per page, or per theme

Three things, kept apart:

- **The layout** (Word document, PDF deck): code.
- **A template**: the parts in order, what is on, the style values (font of the two, size, color role), print size,
  page size. A structure is a template that ships with the app. **Chosen per document** (Make asks, the record keeps it),
  with a default **per kind of source** (a thread → Speaker Script; a page → Share Copy) as today's `default_structure`.
- **A theme**: colors only (paper, ink, accent, faint). Chosen per document too, default per kind of file (Word: Print;
  PDF: Paper).

Not per page: a page does not carry a template. A page's document record does (Make again makes the same choice), which
is the same rule W6 follows for the switches in What goes in.

### 4. What a block becomes

W7.2 (`page.rs`) stands, with the styles named:

| Block | Word | PDF deck |
|---|---|---|
| heading | Heading 1 (a Slide Cue first, in the Speaker Script) | a section slide (D7) |
| paragraph, list, quote | Body (a list keeps its bullets or numbers; a quote is indented Body, italic) | left out of Verse by Verse and Reader (scripture only) |
| table | a Word table, Inter 10 pt, hairline rules | left out |
| to-do | left out, unless switched on | left out |
| scripture | Scripture Reference, then Scripture; your notes on it as Study Note (when the template has notes on) | a verse slide per verse (Verse by Verse) or a passage slide (Reader) |
| view | its list as it is when made, as Body lines | left out |
| page inside | Heading 1 with its title, then its blocks | a section slide, then its slides |

### 5. Does the PDF deck replace PowerPoint

**Yes.** The PDF opens full-screen in every PDF reader and on every projector computer, shows exactly the fonts, and
is checked verse for verse after it is made. What PowerPoint gave that PDF does not is speaker notes (Pulpit) and editing
a slide by hand; the Speaker Script answers the first, and a template answers the second better than hand edits that the
next Make would overwrite. The Python app's existing .pptx decks stay where they are and are still listed (*elsewhere*).

### 6. The cost of breaking the fingerprint agreement

Smaller than the spec feared. The fingerprint (`plan::fingerprint`, checked by `scripts/doc-plans.py`, 6 of 6) is of
the **plan**: which verses, notes, cues and sections go where. **Styles are not in the plan**; they live in `docx.rs`
and `deck.rs`. So restyling alone (D1–D8) does **not** break the agreement: both apps still agree a document is up to
date.

That is also the catch: a file made before the restyle would read *Up to date* while it has the old look. So:

- The record gains `"design": 2` (the Python app passes over unknown fields, as it does `to: pdf`). A record without it
  reads **Old design** in the Documents pane, with Update. Nothing is rebuilt without being asked.
- If the person updates such a document **from the Python app**, it is rebuilt in the old look and loses `design`; it
  then reads Old design here again. That is honest and harmless.

The agreement *is* broken, on purpose, the day a template changes what goes in (a template that switches notes off, the
Reader's passage slides, Share Copy). From then on:

- A document made from a template other than a structure's shipped one is planned only here; its record names the
  template (`"template": "speaker-script-mine"`), and the Python app, which does not know it, would call it behind and
  rebuild it its own way if asked. To prevent that, such records use `to: word2` / `to: pdf` (the trick tier 4 used for
  the deck), which the Python app passes over.
- `scripts/doc-plans.py` keeps checking the two shipped structures that both apps make (Speaker Script, Verse by Verse)
  until the move off the Python app is done; it is not extended to templates.
- The person's own documents of 2026-11-03 (made by the Python app) read Old design and stay as they are until Update.

### 7. The template builder (D4)

A pane, opened from Documents → Templates (and `wb template …`; every action gets a command). Left: **Made from** (a
thread or page to draw with; the live page uses the real source, so the person sees their own verses), **Parts, in
order** (rows with a grip and a switch: title, cues, scripture with references, your notes on a verse, delivery notes,
highlights as shading, room to write), **Look** (pick a style by clicking it on the page or from a list; then font: the
two only, Literata or Inter; size; color by role from the theme; print size; page size). Right: the page drawn live by
the same code that writes the file (the Word paragraphs as the preview draws them; the deck as Typst's SVG pages, as W7.4
already does). **Save template** writes `settings/doc-templates/<name>.json`; **Back to the structure's own** cannot
lose the shipped template. Slides get the same pane with the slide kinds as parts and the boxes fixed (no free layout:
the boxes are what make the fit sizes and the verse check work).

Deliberately not in it: free fonts (only the two that travel), free colors (roles from the theme, so a theme still
works), dragging boxes on a slide, and anything that writes text into the document (the source is the only content).

### 8. The viewer that matches the file

Once the file's styles *are* the preview's, the preview needs only the page: Letter or A4 proportion, the margins, page
breaks where Word would put them (S4 already pages it). The remaining difference (Word's own line breaking) is not worth
chasing.

## Recommendation

1. Accept D1–D8 as the look: the preview's fonts, sizes and colors as the Word styles; DeckCraft's boxes in the same look.
2. Embed Literata and Inter in the .docx, with Georgia / Segoe UI fallbacks named; spike the embedding first.
3. Two layouts; structures become shipped templates: Speaker Script, Share Copy, Study Sheet, Reading Sheet; Verse by
   Verse, Reader. Drop Pulpit, Study Table, Thread Map, Thread Dossier for now.
4. Build in this order: (a) the restyle and the `design: 2` record field, which keeps the fingerprint agreement;
   (b) font embedding; (c) templates as files and the shipped four plus two; (d) the builder pane.
5. The PDF deck replaces PowerPoint.

## Questions for the person

1. **The look.** Are D2 (Speaker Script) and D6 (Verse by Verse) what you meant by the in-app style? Headings in ink
   rather than red: yes?
2. **Paper.** Letter or A4? White paper for every Word document (themes only tint the accent)?
3. **Structures.** Keep Speaker Script, Share Copy, Study Sheet, Reading Sheet, Verse by Verse, Reader; drop Pulpit,
   Study Table, Thread Map, Thread Dossier. Anything there you use?
4. **Slides' default.** White (Paper) by default, with the dark themes for dim rooms: yes?
5. **Old documents.** Your 2026-11-03 documents would read *Old design* with Update offered, never rebuilt unasked. Fine?
6. **The builder.** Is D4 the kind of tool you meant ("similar to the notes")? Is limiting fonts to the two and colors to
   the theme's roles acceptable?
7. **PowerPoint.** Any reason you still need a .pptx (someone else's projector computer, editing slides by hand)?

---

## Second pass: made yours, without designing (2026-11-09)

The person liked D1–D8 and asked to build on them: *"a bit more customizable (not a full Microsoft-Word feature
integration, but a streamlined customizability that is user-friendly to highly aesthetic folk and folk who want to
minimize printer ink consumption, or those who don't care for designing, but would still want something that looks
nice)."* Sheets D9–D11 (second section of the board, `design/exports/r3/d9…d11`).

### Three depths, each optional

| Who | What they touch | Sheet |
|---|---|---|
| Doesn't care to design | **A Look**: one click on a small page of their own source. Preview is the default. | D9 |
| Cares about how it looks | **Six dials** under the Looks, changing the live page at once | D10 |
| Wants to choose what goes in | **The parts** (the builder, D4) | D4 |
| Wants to save ink | the **Ink** dial, or the *Ink saver* Look; and a line saying pages and ink before printing | D10, D11 |

A **Look is only a named set of the dials' values**. So nothing a Look does is out of reach of the dials, a person's own
Look is just "Save as a Look", and there is one engine, not two.

### The five Looks (D9)

| Look | Headings / scripture | Accent | Size, spacing | Details |
|---|---|---|---|---|
| **Preview** (default) | Inter / Literata | red `#8E1B14` | Regular, Comfortable | title left |
| **Classic** | Literata / Literata | brown `#5A3E1B` | Regular, Comfortable+ | title centered, a thin rule under it |
| **Ink saver** | Inter Medium / Literata | grey `#444` | Small, Compact | no rules or fills; verse numbers plain |
| **Large print** | Inter Bold / Literata | deep red | Largest (1.33 ×), Airy | strong contrast |
| **Modern** | Inter / Inter | blue `#1F4E79` | Regular, Comfortable | |

Every Look uses only the two fonts that travel (embedded, §2), so no Look depends on what is installed.

### The six dials (D10)

1. **Typeface**: pairs only (Inter / Literata, Literata / Literata, Inter / Inter), so headings and scripture always agree.
2. **Accent**: six curated swatches (red, brown, blue, green, plum, graphite) or *Your own…* (a color picker). Used only
   where the preview uses it: references, verse numbers, cues, delivery notes, the rule.
3. **Size**: Small, Regular, Large, Largest (0.92, 1, 1.17, 1.33 × the structure's body size). Words, not points.
4. **Spacing**: Compact, Comfortable, Airy (line height 1.35 / 1.5 / 1.6, and the space around a passage).
5. **Details**: four small menus. Title left or centered; verse numbers in the accent, plain, or in the margin; under the
   title nothing, a thin rule, or space; paper Letter or A4.
6. **Ink**: Full color, Saver, Black only. It is last because it **overrides** the others for printing without changing
   them: Saver turns the accent to grey, drops rules and fills and tightens spacing; Black only also sets verse numbers and
   references in black. Turning it back restores the person's choices.

For slides the same dials apply, minus Size and Spacing (the boxes fit the text) and with **Paper** (the theme's colors:
white, Vellum, Vigil …) in place of Ink. A dark slide theme never reaches a printer.

### Ink, measured (D11)

Under the live page: *"2 pages · ink: light"*. Pages come from laying the document out (Typst already lays out the PDF;
for Word, the preview's paged layout, S4). Ink is the share of the page area covered, weighted by darkness, computed from
the laid-out page, so it is measured, not promised; shown in three words (light, moderate, heavy), not a percentage that
looks more exact than it is. The figures on the sheet are illustrative. Ink saver can be shown beside the current Look.

### What is saved

- A person's own Look: `settings/doc-looks/<name>.json`, the dials' values only. The shipped five are in the app and
  cannot be lost or overwritten (editing one and saving asks for a new name).
- The Look last used for each kind of document is remembered (`settings/export.json`, beside the theme it already keeps).
- A document's record names its Look **and keeps the values it was made with**, so Make again makes the same document
  even if the Look is changed later. Changing a Look does not mark documents out of date; changing a document's own
  choices in Make again does.
- Still nothing in the plan: Looks and dials are styling, so the fingerprint agreement (§6) is unaffected by them.

### Not in it, on purpose

Free fonts, per-paragraph formatting, margins in inches, slide boxes moved by hand, and anything that writes words into
the document. Each would be a step toward Word, and the person asked for the opposite.

### Further questions for the person

8. **Looks.** Are these five the right starting set? One to drop, or one missing (for example a *Two columns* reading Look)?
9. **Accent swatches.** Six curated colors plus your own: enough, or would you rather pick only from the curated six?
10. **Ink.** Is "light / moderate / heavy" with a page count what you want to see, or an actual percentage?
11. **Where it lives.** Looks and dials inside Make (D10), with the parts (D4) one step deeper under *What goes in*: right?

---

## Third pass: deeper (2026-11-09)

The person: *"Go deeper."* Sheets D12–D15 (third section of the board). Same rule as before: every option is a value in
a Look, so the one-click path and the dials stay one engine.

### Slides get the same Looks (D12)

A deck takes the Look's typeface and accent. In place of Ink it has **Paper** (the theme's colors: Paper, Vellum, Vigil,
Olivet, Veil, Daylight). Three dials are its own:

- **Neighbours**: faint (the default: the verse before and after, small and muted), or hidden (the verse alone, larger).
- **Reference**: top or bottom.
- **Typeface**: as for Word.

Size is never a dial for slides. The boxes fit the text (DeckCraft's fit), which is what keeps every verse whole on one
slide and lets the finished file be checked verse by verse.

### Your highlights in print (D13)

A highlight is the person's own mark, so **no ink mode removes it**. Ink changes how it is drawn:

| Ink | A highlight | A note | References, verse numbers |
|---|---|---|---|
| Full color | its own soft fill (yellow, green …) | grey `#666` | accent |
| Saver | a grey underline, no fill | grey | dark grey |
| Black only | a black underline | black | black |

Different highlight colors become different underline styles in Saver and Black only (solid, dashed, dotted, double), so
two colors stay distinct without color. Highlights can still be switched off as a part (D4). In Word a fill is run
shading and an underline is a run underline, both ordinary Word formatting.

### The page around the text (D14)

Four switches, never a layout editor:

| Switch | Values | Default |
|---|---|---|
| Cover page | off / on (title, subtitle, date alone on page 1) | off |
| Running head | off / on (the title, small, on every page after the first) | on |
| Page numbers | Page x of y / x / none | Page x of y |
| Columns | one / two (scripture-only documents: the Reading Sheet) | one |

Two columns only for documents with nothing but scripture, because notes and cues read badly across a column break.

### Guardrails (D15)

The dials should not let someone make something unreadable, and should not nag either:

- **Contrast.** Your own accent is checked against the paper (WCAG 4.5 : 1 for text). Too light: rules and fills keep
  your color, text in the accent is darkened just enough, one quiet line says so, with Undo. On a dark slide theme the
  same rule runs the other way.
- **See it in grey**: the live page shown as a black-and-white printer will print it.
- **Ink and slides**: a dark slide theme is never offered for printing (a deck printed as handouts uses Paper).
- **Size**: Small is not offered with Two columns (the scripture would fall under 9 pt).

### The whole option list, for the record

| Level | Options |
|---|---|
| Look (one click) | Preview, Classic, Ink saver, Large print, Modern; your own saved Looks |
| Dials (Word) | Typeface, Accent, Size, Spacing, Details (title alignment, verse numbers, under the title, paper size), Ink |
| Dials (slides) | Typeface, Accent, Paper, Neighbours, Reference |
| Page (Word) | Cover page, Running head, Page numbers, Columns |
| Parts (D4) | per structure: title, cues, scripture, notes, delivery notes, highlights, room to write … |

About twenty choices in all, every one with a working default, against Word's hundreds.

### Effects on the build order

The recommendation's order (§ Recommendation) gains one step: (a) restyle and `design: 2`; (b) fonts embedded;
**(c) Looks and dials (D9–D11, D13, D15), since they are styling only and need no new structures**; (d) page switches
(D14); (e) templates and the shipped structures; (f) the parts builder (D4); (g) the ink measure (D11), which needs the
paged preview (S4).

### Further questions for the person

12. **Highlights in Saver.** Underlines (different styles per color), as D13: right, or would you rather print them as
    a light grey fill?
13. **The page switches.** Cover page off and running head on by default: right?
14. **Slides.** Neighbours faint by default, hidden as the option: right?
15. **Guardrails.** Darkening a too-light accent for text automatically (with Undo), rather than refusing the color: right?
