# Phase 0 results: the three spikes

2026-11-02. Phase 0 of [PLAN.md](2026-11-10/docs/PLAN.md), section 8. All three spikes run. The numbers below come from the release
build on the touchscreen laptop, in the phone-size window, with the web view's CPU slowed 4× over the DevTools protocol
(as section 6 asks). The raw numbers are in [phase0/measured.json](../phase0/measured.json), and the screenshots are in
[phase0/](../phase0). The person's own check of spike (a) passed; see the end.

| Spike | Runs | Result |
|---|---|---|
| (a) Tauri reader | `scripts/try-reader.ps1`, `npm run test:webkit`, `npm run measure` | Works in WebView2 and in WebKit. Every measured budget is met except scrolling Psalm 119 (5 long frames in 810) |
| (b) git sync | `cargo run -p spike-sync --release` | Clone, commit, rejected push, pull, push, and a same-note and overlapping-highlight conflict merged by the rules |
| (c) Typst PDF | `cargo run -p spike-pdf --release -- NUM 25` | Numbers 25 laid out in 15 ms. Every verse in the pages checked against the database |

The layout follows section 9 of the plan: `crates/wb-core` (with `wb-cli`), `app/src-tauri` and `ui/` are the start of the
real app. `spikes/sync` and `spikes/pdf` are kept for reference until their code moves into wb-core.

## (a) The reader: Tauri 2, plain TypeScript, wb-core over rusqlite

**What it does.** The reader opens `workbench.db` read-only through wb-core (SQLite's read-only flag plus `query_only`).
It draws Numbers 25 (or any chapter) with the person's highlights, thread underlines, and note marks (a dotted underline
on words, a dot after the verse number for a verse note), all read from a scratch copy of the study folder.

- Touch:
  - A tap on a word opens the word sheet: the Strong's entry, lemma, transliteration, definition, KJV usage, how many
    times and in how many books, and notes on the word.
  - A tap on a verse number opens the verse sheet: the verse verbatim, its color, notes, and the threads it is in.
  - Press and hold starts a selection with two handles that snap to whole words, across verses. You can keep the finger
    down and drag, or drag a handle afterwards.
  - The selection bar has five colors, Note, Thread, Look up and Copy. Copy gives the text with its reference.
- Mouse:
  - Hovering a word or a verse number shows a hover card.
  - Press and drag selects, and the color bar appears.
  - A click opens the same sheet, as a popover at widths of 600 px and more.
- Sheets have two heights. They close by dragging down, by tapping above them, or with Esc. The reader under a sheet does
  not move, and closing a sheet returns to exactly the same place.
- Window presets (More → Spike settings): phone 390×844, phone landscape, iPad portrait and landscape, laptop 1280×800
  and 1440×900, desktop 1920×1080. The `set_window` Tauri command sets them, so tests can use them too.
- The input mode can be set to auto, touch or pointer, so you can try the phone behavior with a mouse attached.
- Themes: system, light, dark and e-ink.
- Literata (scripture), Inter (interface) and Noto Sans Hebrew ship inside the app from `@fontsource`, all under the OFL.
  `ui/tokens.css` is generated from the design's `figlib.py` by `scripts/tokens.py`, with one CSS variable per token and
  Light/Dark/E-ink modes.
- The place is kept as the verse at the top of the screen plus the offset into it, not as a pixel count, so it holds
  when the window is a different size. The app reopens there.
- `wb` has the same views as the window: `wb text`, `wb chapter`, `wb marks`, `wb reader`, `wb word`, `wb verse`,
  `wb strong`, `wb count`, `wb books`, and `wb fixture` (which makes the WebKit tests' data from the database).

**Measured** (release build, phone window, CPU slowed 4×; median of several runs):

| Budget (PLAN.md §6) | Measured | |
|---|---|---|
| Cold start to the last place < 1.5 s | **677 ms** (5 launches; range 665–765 ms; 718 ms on the first launch after the build) | Met. About 520 ms of that is WebView2 starting before the page loads; the UI itself takes about 140 ms. This one is measured without the CPU slowdown, which can only be applied once the web view exists |
| A chapter drawn < 100 ms | Numbers 25 **89 ms**, Numbers 24 80, Numbers 26 81, John 3 81, Psalm 119 **87 ms** | Met (to the first screen; Psalm 119 is complete after 268 ms, in parts between frames). Before the rework of the drawing it was 95 ms for Numbers 25 and 364 ms for Psalm 119 |
| A tap card < 100 ms | Word sheet **62 ms** (max 88), verse sheet **43 ms** (max 52) | Met. Measured from the touch to the sheet drawn, with touch events sent through WebView2's input path. The word sheet was 110 ms before it read one word instead of the whole chapter |
| Hover card | **33 ms** after the hover delay (280 ms) | Fine |
| Plain search < 50 ms | Not measured | The spike has no search yet (phase 2) |
| No frame drops scrolling Psalm 119 with layers on | 810 frames, median 16.7 ms, p95 16.9 ms, but **5 long frames** (worst 384 ms) | **Not met yet.** The test put highlights on every other verse and two thread lines on every third (1,220 marked words). The long frames are not located yet; they may come at the starts of the synthetic gestures. To trace in phase 2 |
| Long press and drag across verses (touch events through WebView2) | Selected 7:2–8:3, the bar shown, **0 px scrolled**, no system menu, no native selection | Works |
| Memory | Rust process **6 MB** private. Web view **~198 MB** private (6 WebView2 processes; 407 MB working set, counting shared pages) | The GPU process (100 MB) and the browser process (43 MB) are most of it. That is WebView2's own floor on Windows. WKWebView on an iPhone is one web content process, so it cannot be judged from here |
| Size | `bible-workbench.exe` **11.5 MB** with the UI inside (the UI is 3.2 MB, nearly all fonts) | Fonts can drop to the woff2 files for Latin, Greek and Hebrew (about 0.3 MB, with the extended Latin and Greek ranges the lexicon needs). The 118 MB database is separate |

Where a chapter's time goes now (Psalm 119, 4×): about 5 ms in Rust, 25–45 ms for the call and its JSON, 10 ms to build
the markup, 2 ms to find the elements, and 30 ms for the first frame. The call and its JSON are now the largest part.
A more compact chapter format (lists rather than objects per word) is the next saving.

**WebKit** (Playwright's WebKit for Windows, the engine in iPhone and iPad web views). All 10 tests pass, at phone size
with touch and at desktop size with a mouse:

- The chapter is drawn in Literata, with the marks, and line spacing is even.
- Tap a word: the sheet's definition and counts equal the database's.
- Tap a verse number: the sheet shows the verse verbatim.
- Press and hold, then drag across verses, then drag a handle, then a color from the bar.
- Hover card and color bar with the mouse.
- A mark made while a long chapter is still drawing reaches its last verses.

Screenshots: [phone reader](../phase0/webkit-phone-reader.png), [word sheet](../phase0/webkit-phone-word-sheet.png),
[verse sheet](../phase0/webkit-phone-verse-sheet.png), [selection](../phase0/webkit-phone-selection.png),
[hover card](../phase0/webkit-desktop-hover-card.png), [color bar](../phase0/webkit-desktop-color-bar.png). The real app (WebView2):
[phone](../phase0/app-phone-reader.png), [laptop](../phase0/app-laptop-reader.png). Both engines drew the same page. The one
layout bug found, lines with a verse number sitting 4 px taller, was in both engines; it is fixed and now tested.

**What worked**

- The reader handles touch itself, and it works in both engines:
  - `touch-action: pan-y` leaves scrolling to the web view until a hold starts a selection.
  - From then on, `touchmove` is cancelled.
  - The context menu and native selection are turned off on the reader only.
  - No fallback reader approach was needed (section 8 allowed for one).
- Tauri 2's in-process commands: the database call itself takes 2–5 ms. Tauri 2.x on crates.io builds cleanly on Windows
  with no extra setup (Tauri 3 is in alpha; this stays on 2).
- One wb-core `views` module answers both the app and `wb`. The WebKit tests' data comes from `wb fixture`, so no
  scripture is ever typed into a test.

**What fell short or is not tested**

- **Psalm 119 scrolling has a few long frames** (above). It is the one budget not met.
- **These are touch events, not a finger.** The measurement sends touches over the DevTools protocol into WebView2's
  input handling. That covers `touch-action`, pointer events, the hold and the context menu, but not Windows' own touch
  layer above it: press-and-hold feedback, palm rejection, and the touch keyboard. The person's finger test is the real
  check.
- **Playwright's WebKit is not iOS.** Section 7's list of what waits for an iPhone build is unchanged: the iOS callout and
  selection behavior, the keyboard, safe areas, Dynamic Type, VoiceOver, haptics, and speed on a phone.
- **Highlights from the spike are not saved.** They last for the session only. Writing them needs the no-overlap rule
  (phase 1). Note, Thread, Question, Every use and Interlinear show a "phase n" message.
- The person's real `highlights/NUM.json` already has overlapping highlights: the whole of 25:14 in pink over a blue
  phrase and a pink phrase in the same verse. The Python app's rule says they never overlap, so they probably date from
  before the rule. The reader draws the last one on top, as the old reader does. Phase 1's golden tests should decide
  what to do with them.
- The selection bar sits above the selection and covers two lines there. The note dot after a verse number crowds the
  next word ("11•Phinehas"). Both are small design points for phase 2 or 3.
- The word sheet reads the book's note files from disk on every tap. That is fine here but slow on a phone with many
  notes, so wb-core needs a cached `Study` in phase 1.

## (b) git sync with git2

Two "devices" clone one bare remote on disk, all under `%TEMP%\bible-workbench-rs\sync-spike`. The run is made fresh each
time from the scratch copy, and it refuses the real folder. git2 0.21 is built with only the `https` feature, which
uses WinHTTP on Windows and needs no OpenSSL.

| Step | Time |
|---|---|
| Init the bare remote, commit the scratch study folder (all files), push | 2.1 s |
| Clone to A and B | 0.6 s |
| A: commit and push | 177 ms |
| B: push before pulling | Rejected (not a fast-forward), as it should be |
| B: pull with a different note changed on each side | 111 ms, a clean merge |
| A: pull | 37 ms, a fast-forward |
| B: pull with **the same note** edited on both sides and **overlapping highlights** (A green on 25:7 words 3–9, B pink on words 6–14, made later, and B blue on all of 25:8) | 160 ms, merged by the rules |
| B: push the merge; A: pull | 48 ms; 45 ms, a fast-forward. Both trees are the same |

**The rules as built** (PLAN.md §4, `spikes/sync/src/merge.rs`). Every file changed on both sides goes through them,
whether git found a conflict or not. That way two edits to one note are both kept, never mixed line by line.

- **The same note on both sides:** the newer front matter is kept. The body is this device's text, then a marker
  `<!-- wb: needs a look (edited on two devices) -->` and *The other device's version:*, then the other text. The
  Notebook can find "needs a look" by the marker. The front matter keeps today's fields, so the Python app still reads
  the note.
- **Highlights:**
  - Merged by id, three-way: a change on one side beats no change, and a delete holds unless the other side changed that
    highlight.
  - Then the no-overlap rule is run again for the highlights the merge brought in, in the order they were made. Each one
    cuts back what it touches, as saving it in the Python app does.
  - In the run, B's later pink cut A's green back to "the son of" (words 3–5). The quotes come from the database's words,
    verbatim.
  - Overlaps that were already in the file are left alone.
  - The file is written in the Python app's layout (one-space indent, keys in order, not ASCII-escaped).
- **Nothing is dropped.** Both sides' versions of every resolved file go to `.trash/` on the device that merged.

**Findings**

- **The real study folder is barely in git today.** It has one commit ("Scaffold the study-data repo"), and most files are
  untracked (`documents/`, `.obsidian/`, notes and highlights). Before sync touches it in phase 3, the person has to
  decide what is tracked (`.obsidian/`? `sessions/`?), and it needs a real first commit.
- Keeping both note texts repeats the paragraphs the two sides share (in the run, two of three paragraphs appear twice).
  Phase 3 should keep the shared part once and mark only the parts that differ, still with the marker.
- `.trash/` is gitignored in the study folder, so the kept versions live only on the device that did the merge. That is
  probably right (it is a safety copy, not data), but it is the person's call.
- Merging highlights needs the Bible database, to turn anchors into word spans. So sync belongs in wb-core, beside
  `bible`, which the plan already has.
- Not tested: a network remote, an access token, the Keychain or Keystore, and pulling when the app comes to the
  foreground (phase 3).

## (c) A chapter PDF with Typst as a library

`spikes/pdf` holds a Typst `World` in memory:

- The chapter goes in as `data.json` built from the database, never as typed text, and a short template lays it out:
  title, verse numbers, the person's highlights, and a footer with the reference.
- Literata is the same font the UI ships. Its WOFF files are converted to OpenType in about 5 ms, because Typst reads
  TTF/OTF only.
- After layout, the text of every page is checked against the database. That is the present rule that every verse in a
  finished file is checked. The check had to skip the page footer and join words broken at a line-end hyphen
  ("Baal-" / "peor"); until it did, it reported verses missing.

| | Numbers 25 | Psalm 119 |
|---|---|---|
| Pages, size | 1 page, 34 KB | 5 pages, 56 KB |
| Compile (cold; again, cached) | 15 ms; 0 ms | 84 ms; 0 ms |
| PDF written | 4 ms | 10 ms |
| Verses found verbatim in the pages | 18 of 18 | 176 of 176 |

Page 1 is also written as a PNG (`spikes/pdf/out/NUM-25-page1.png`) to look at without a PDF viewer. It looks right:
Literata, justified, the yellow and pink highlights, and a verse number never ends a line.

**Fell short:** the spike binary is 53 MB, because it carries Typst's own bundled fonts. For the app, drop them and ship
only Literata (and Inter and Noto Sans Hebrew if documents need them) as OTF files. The fontsource packages have only
web formats, and the Latin subset alone will not cover Hebrew or Greek in a document. The LORD in small capitals is not
done yet.

## Recommendation for phase 1

**Go on with the plan as written: Tauri 2 with a plain TypeScript UI, wb-core in Rust, git2 for sync, Typst for PDFs.**
None of the spikes found a reason to change course, and the reader's own touch handling works in both engines. That
holds unless the person's finger test says the reader does not feel right; if so, that comes first.

Phase 1 is wb-core at parity, with no UI work beyond what the spike has. From phase 0, carry these into it:

1. **Writes, with the no-overlap rule:** highlights (saving and splitting, as `study_api.save_highlight`), notes and
   threads through one `Study` that caches the files and watches for outside changes (the Python app's `_sync`). Deletes
   go to `.trash/`.
2. **Golden tests against the Python app** on the same scratch folder: passages, marks, notes, highlight splits, threads.
   Decide what to do with the overlaps already in `highlights/NUM.json`.
3. **The `wb` CLI at parity**, with a test that every wb-core action has a `wb` command (the rule in CLAUDE.md).
4. **Keep from the spikes:** the shared `views`, the place kept by verse, drawing in parts, and fixtures from `wb fixture`.
5. Small items:
   - A compact chapter format for the app call.
   - Trim the fonts to woff2 Latin, Greek and Hebrew.
   - Move the sync merge rules into `wb-core::sync`, with a test suite of conflicting edits.
   - Move the PDF code into `wb-core::docs`, without Typst's bundled fonts.

**Decisions for the person** (none is urgent before phase 3):

- The marker for a note edited on two devices (above). Is it acceptable in Obsidian?
- What the study folder tracks in git, and the first real commit, before sync.
- Whether the kept versions in `.trash/` stay on the merging device only.

## The person's check (PLAN.md phase 0)

**Passed, 2026-11-02:** the person tried the reader and said it feels right. Phase 0 is complete; phase 1 starts on the
person's go-ahead.

How to try the reader by mouse, at phone size, and by finger on the touchscreen laptop:

```
powershell -ExecutionPolicy Bypass -File scripts\try-reader.ps1            # phone size
powershell -ExecutionPolicy Bypass -File scripts\try-reader.ps1 -Size laptop
```

- **By finger (phone size):**
  - Tap a word, then a verse number.
  - Press and hold a word, then drag into the next verse.
  - Drag a handle, then pick a color.
  - Drag a sheet up, then down to close it.
  - Scroll fast through Psalm 119 (More → Go to → Psalm 119).
- **With the mouse (laptop size):** hover a word, a verse number; press and drag to select; click a word.
- **What to notice:**
  - Does a hold ever scroll instead of selecting, or bring up a Windows menu or the press-and-hold square?
  - Do the handles feel easy to catch?
  - Does closing a sheet always leave the text where it was?

Highlights made in the spike disappear when the window closes. Nothing is written to the real study folder.
