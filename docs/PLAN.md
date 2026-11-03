# Plan: Bible Workbench on every device, rebuilt in Rust

Status: reviewed, 2026-11-02 (decisions in section 10). Nothing built. For the person to accept, change or cut before any code.
When the review is done, phase 0 starts in a new session, handed this plan.

**What the person decided (2026-11-02):** the phone is an iPhone, but the app must work on iPhone, iPad, Android and the
desktop alike; the app is rebuilt in Rust in a **new repository**, moving away from the Python/Windows build (this
repository stays, with its `design/` sources); the e-reader is parked. The goal is the same functionality everywhere, as
far as each device allows, shaped for the device rather than shrunk onto it.

**Testing (the person, 2026-11-02):** no iPhone builds for now. "Mobile" is tested as the app at phone and tablet window
sizes, and by touch on the person's touchscreen Windows laptop (section 7). iPhone builds come later, when a Mac or
cloud builds are in place.

The layouts this plan builds are in [design/](design/README.md) (phone and desktop/laptop sheets; iPad still to design).
The questions they answered are in [PLAN-design.md](PLAN-design.md), section 5.

## 1. What does not change

- **Berean rule.** Scripture verbatim with its reference; no interpretation, commentary or doctrine; nothing suggested.
- **The study folder is the person's work, in plain files** they can read by hand and open in Obsidian: the same
  `bible-study-data` layout and file formats as today, so the Python app and the Rust app can both open the same folder
  while one replaces the other.
- **Never lose the place.** On every device, anything opened from the text comes back to the verse it came from.
- **Distraction-free.** No notifications, no feeds, no accounts beyond the person's own sync remote.
- **Works with no network.** Everything but sync is local on every device.

## 2. Architecture

### 2.1 Recommended: a Rust core, one web UI, Tauri 2 as the shell on all five platforms

```
 iPhone · iPad · Android · Windows · macOS/Linux
 ┌───────────────────────────────────────────────┐
 │  UI: HTML/CSS + TypeScript in the system web  │  one UI, responsive by size class (section 3)
 │  view (WKWebView, Android WebView, WebView2)  │  tokens.css generated from design/figlib.py
 ├───────────────────────────────────────────────┤
 │  Tauri 2 shell: commands, events, plugins     │  native bits in Swift / Kotlin where needed
 ├───────────────────────────────────────────────┤
 │  wb-core (Rust library)                       │  everything that is not drawing
 └───────────────────────────────────────────────┘
 wb (Rust CLI) uses wb-core directly on the desktop; `wb do` talks to the running desktop app.
```

**wb-core** holds everything that is not drawing, once, tested once:

| Today | In wb-core |
|---|---|
| `workbench/db.py`, `api.py` (passages, lexicons, BDB, interlinear, uses, count, near, forms, the search index) | `bible`: read-only SQLite (rusqlite), with the search index built into the database file at build time (FTS5 or the present word index), so a phone does not build it at start |
| `anchors.py`, `refs.py` and the reference parser in `web/commands.js` | `places`: anchors and references, one parser (today there are two, kept equal by a test) |
| `web/commands.js` (the capture-box grammar) | `commands`: the command language, returning a typed action; the desktop field and the phone palette both call it, and so does `wb do` |
| `study.py`, `study_api.py` (notes, highlights and their splitting, threads, trails, sets, palette, lessons, sessions) | `study`: the same files, same formats, same rules (a highlight never overlaps another; deletes go to `.trash`) plus the Notebook (unplaced notes in `notes/_inbox/`) |
| `web/markrange.js`, `study.chapter_marks` | `marks`: what to draw on a chapter, as word ranges |
| `craft_plan.py`, `craft_render.py`, `documents.py`, `lessons.py` | `docs`: document plans and their fingerprints (unchanged idea), rendered without the Craft apps (section 5) |
| (new) | `sync`: git with the private remote (section 4) |

**Why a web UI** for a Rust app: this is a reading app. It needs word-level spans with highlight fills and stacked
underlines, right-to-left Hebrew and Greek with combining marks, wrapping, text selection, find-in-page, accessibility
(VoiceOver and TalkBack read the text), Dynamic Type and printing. The system web views do all of that well and the same
on every platform; Rust-native UI kits (egui, Slint, iced) are weakest exactly there. It also means `chapter.js`,
`markrange.js`, the dock (dockview) and much of the present web code can be carried over and reshaped rather than
rewritten, and the design system lands as CSS variables, exactly as FigCraft holds it (one variable per token, modes as
Light / Dark / E-ink).

**Why Tauri 2:** Rust is the host process on every platform, so wb-core is called directly (no server, no ports); iOS
and Android have been supported since Tauri 2.0 (stable, October 2024); native plugins can be written in Swift and
Kotlin for what the web view cannot do (speech, a share sheet, a folder from the Files app, haptics, the keychain).
Mobile is younger than Tauri's desktop side and not every official plugin works on mobile, which is why phase 0 starts
with a spike on an iPhone.

**Alternatives weighed:**

| | For | Against |
|---|---|---|
| **Tauri 2 + web UI** (recommended) | One UI; best text rendering; carries the present web code over; Rust core called in-process | The UI is TypeScript, not Rust; mobile plugins less mature than desktop |
| **Dioxus 0.7** (UI written in Rust, drawn in a web view on mobile) | Everything is Rust, one language; hot reload on devices | Same web view underneath, so no gain in text rendering; younger; the present web code would be rewritten |
| **Native UIs** (SwiftUI and Jetpack Compose) over wb-core with UniFFI | The most native feel | Three UIs to build and keep equal (plus desktop); too much for one person's tool |
| **A web app (PWA)** with wb-core in WebAssembly | No app store; nothing to install | On iOS no access to a folder in Files/iCloud, storage can be cleared by the system, no background sync: wrong for the person's irreplaceable files |

**Decided (review, 2026-11-02):** the person asked for whatever is most flexible on every platform without losing
features, and lightest in memory, size and start-up time. That is **Tauri 2 with the UI in plain TypeScript**:

- *Flexibility:* Tauri has the larger set of ready plugins on desktop and mobile (files, dialogs, sharing, updates,
  secure storage), and Swift/Kotlin plugins for anything missing; Dioxus has fewer. Both run on all five platforms.
- *Size and memory:* both use the system web view, so neither ships a browser; the app is a few megabytes plus the
  Bible database. With no UI framework (as today's app has none) the UI code stays small: no virtual DOM, no framework
  runtime in memory.
- *Start-up:* the UI loads as static files from inside the app, the Rust core opens the database in-process, and the
  reader is drawn straight from the last place; panes and their code load only when first opened.
- The real weight is the 118 MB database: it ships compressed, the search index is built into it ahead of time, and
  optional parts (BDB, YLT, the interlinear) can become separate downloads if size ever matters.

Dioxus stays the fallback if a Rust-only UI is ever wanted; the core does not change either way.

### 2.2 The command language and the `wb` CLI

The command language stays: it is how the desktop is driven by keyboard, how an iPad with a keyboard is driven, and how
an AI drives the app. In Rust it is parsed once (`wb-core::commands`) and returns an action; the UI decides how to show
it (a pane on the desktop, a screen or sheet on a phone). `wb` becomes a Rust binary over wb-core with the same
commands as today (`wb text`, `wb uses`, `wb note add` ...), and `wb do` sends lines to the running desktop app over a
local socket instead of the present HTTP long-poll. The rule from CLAUDE.md carries over as a test: every core action
must be reachable from a `wb` command.

## 3. Sizes, not devices

The UI picks its layout from the window's width, live (an iPad in split view or Stage Manager, a phone turned, a
desktop window dragged narrower), not from what kind of device it is:

| Size class | Width | Where | Layout (from the design sheets) |
|---|---|---|---|
| Compact | < 600 | phone portrait, narrow iPad split view | One stack: tabs (Read, Notebook, Threads, Study, More), sheets over the reader, full-screen panes with "Back to …" |
| Medium | 600–1023 | phone landscape, iPad portrait, small windows | Reader plus one side panel (the Notebook or the last pane); sheets become popovers beside the tapped word |
| Expanded | 1024–1439 | iPad landscape, laptops | The laptop layout: toolbar with the command field, reader, one docked column of tabbed panes |
| Large | ≥ 1440 | desktops | Docked columns on both sides; floating panes on request |

Input is decided separately from size: touch gets tap cards, the selection bar and the palette; a pointer gets hover
cards and the color bar; a hardware keyboard (desktop, or an iPad with a keyboard) gets backtick, the arrow keys and
shortcuts. An iPad with a keyboard and trackpad at Expanded width therefore works like the laptop.

**Design still needed before phase 4** (phase 2 builds Expanded from the laptop sheets): the iPad at Medium and Expanded (portrait, landscape, split view), and the phone
at Medium (landscape), in the same FigCraft file. The e-ink mode stays in the tokens; its layout is parked.

## 4. Data, storage and sync

**On each device:**

- The Bible database (KJV, YLT, Strong's, BDB, the interlinear: about 118 MB today) ships inside the app, read-only,
  with its search index prebuilt. Compressed in the download and unpacked once if size matters. The licenses and credits
  shown today go with it (the Strong's Hebrew is CC BY 4.0 and needs its attribution).
- The study folder lives on the device in the app's own storage, in the same files as today.

**Between devices: git, with a private remote** (the study folder is already a git repository; which host is decided
before sync first touches the real folder, at the phone phase; phase 0 uses a scratch remote):

- The app commits its own changes (a few seconds after the last edit), pulls when it comes to the foreground and pushes
  after committing. With no network it keeps committing locally and catches up later.
- Library: libgit2 through the `git2` crate. It is proven on iOS (shipping iOS apps clone, pull and push with it).
  gitoxide, the pure-Rust git, still cannot push, so it is not used yet.
- The remote's access token is kept in the iOS Keychain or Android Keystore; the person enters it once per device.
- **Merging** is done by wb-core, by kind of file, so a conflict almost never reaches the person:

| Files | Merge |
|---|---|
| `notes/**/*.md`, `notes/_inbox/*.md` (one note per file) | Different notes never conflict. The same note edited on two devices: keep both texts in the note, marked, and list it under "Needs a look" in the Notebook |
| `highlights/<BOOK>.json` | By highlight id, then re-run the no-overlap rule on the result |
| `threads/*.md` | Members as a set, in the order of the side that changed the order last; name, note and color from the newer side |
| `trails/`, `sets/`, `lessons/` | One item per file; a lesson edited on both sides keeps both, as notes do |
| `sessions/*.jsonl` (logs), `reading/log.jsonl` (chapters read) | Append both |
| `reading/plans/*.json` (reading plans) | One plan per file; the same plan changed on both sides keeps the newer and puts the other in `.trash/` |
| `settings/*.json` | Per key, newer wins |

  Nothing is ever dropped: a losing version goes to `.trash/` as deletes do today.
- **Why git and not a sync service:** it works the same on iPhone, iPad, Android, Windows and Mac; the person already
  keeps the folder in git; history is kept; it needs no server of our own.
- **Optional, Apple only (decided: revisit at the first iPhone build):** keep the study folder in iCloud Drive and give
  the app access to it through the Files app, so Obsidian on the iPhone could open the same folder. It does not reach
  Android, so it can only be a second way, not the way.
- Recordings (audio for the recorded-voice playback) are large; they stay out of git and are fetched on demand from a
  folder the person chooses, in phase 6.

## 5. Every feature, per device

Tiers: **Full** (as on the desktop), **Shaped** (all of it, in a form made for the device), **Later**.

| Feature | Phone | iPad | Desktop |
|---|---|---|---|
| Reader, chapters, KJV/YLT, compare | Shaped: swipe for chapters, book picker sheet | Full | Full |
| Highlights, custom colors, layers | Shaped: selection bar; layers are the eye on each thread | Full | Full |
| Hover cards | Shaped: tap cards (verse, word, reference) as sheets | Popovers on touch, hover with a trackpad | Full |
| Notes, My notes, word-everywhere notes | Shaped: verse sheet, word sheet | Full | Full |
| **Notebook** (Journal, Inbox, All notes, Place it, questions) | Full, the home tab for writing | Full, side panel | Full, docked |
| Threads (list, view, reorder, where these words occur) | Shaped: list and thread screens, drag to reorder | Full | Full |
| Search, uses, count, near, forms, first/last, marked, find | Shaped: Study tab | Full | Full |
| Lexicon, BDB, interlinear | Shaped: word sheet, full-screen interlinear | Full | Full |
| Capture box and its language | Shaped: the palette, quick actions first | Full with a keyboard; palette by touch | Full, merged with search |
| Panes, dock, float, minimize, layouts | Shaped: one at a time, "Back to …" | Side panel and tabs; float with a pointer | Full |
| Select box (Alt-drag) and sets (Shelf) | Shaped: a Select mode in lists; Shelf as a list | Full | Full |
| Find in chapter, text size | Full (text size follows Dynamic Type as its start) | Full | Full |
| Read aloud | Full: the platform's own voice (AVSpeechSynthesizer, Android TTS) | Full | Full |
| Recorded-voice playback | Later (needs the recordings folder) | Later | Full |
| Lessons (`lessons/*.md`) | Read and light edits; long editing is for iPad and desktop | Full | Full |
| Documents (slides, Word, PDF) | Shaped: make a PDF on the phone and share it; list and open the rest | Full | Full |
| PDF viewer | Full: the platform's viewer | Full | Full |
| Today's log | Full | Full | Full |
| Reading plans and progress (built 2026-11-02 in wb-core and `wb`) | Full | Full | Full |
| Studying together (a proposal: [PLAN-community.md](PLAN-community.md)) | To decide | To decide | To decide |
| `wb` CLI, `wb do`, AI driving | — | — | Full |

**Documents without the Craft apps.** WordCraft, DeckCraft and PdfCraft are Windows apps; the Rust app cannot depend on
them. The plans in `craft_plan.py` (what goes where, structures, themes, presets) carry over unchanged; only rendering
changes:

- **PDF** (handouts, study sheets, scripts, and slides as PDF pages): Typst, a typesetting engine that is itself a Rust
  library, embedded in wb-core. Runs on a phone, so "Hand it out" works anywhere.
- **Word** (`.docx`): written with a Rust docx crate (for example `docx-rs`).
- **PowerPoint** (`.pptx`): there is no mature Rust crate; written as Office Open XML from a template per theme, with
  wb-core filling slides. Desktop first; the phone gets it too once it works, since nothing in it is platform-specific.
- The present rule stays: after rendering, every verse in the finished file is checked against the source text.
- Look at each in real Word and PowerPoint before trusting it (the Craft previews hid bugs before; the same applies to
  any new writer).

## 6. Shaped for touch: the experience details

- **Selecting words.** The reader handles touch itself instead of the web view's text selection: a tap on a word opens its
  word sheet, a tap on a verse number its verse sheet, a long press starts a selection with two handles snapping to
  whole words, across verses. The system's own callout menu is turned off on the reader (it is kept in note fields).
  A light haptic tick on select and on each color.
- **Sheets** have two heights (half and full) and close by dragging down or tapping above. The reader under a sheet
  does not move, and closing a sheet returns exactly where the person was.
- **Never lose the place:** each tab keeps its own back stack and scroll positions; anything opened from the text carries
  the "Back to Numbers 25:11" pill; reopening the app returns to the last place, scroll position and open sheet.
- **Chapters:** swipe sideways to turn a chapter, or keep scrolling into the next one (a setting); the title opens the
  book and chapter picker; typing a place works in the palette and the picker.
- **The palette:** opened from the pen button or by typing on an iPad keyboard; anchored to the last tapped place;
  quick actions (Jot, Question, Highlight, Thread, Open) first, suggestions from the command language as words are typed.
- **Speed budgets** (measured on the touchscreen laptop in the phone-size window with the web view's CPU slowed 4x in
  its developer tools, as a stand-in for a phone; on a real iPhone once there are builds; checked in each phase): cold start to the last place under 1.5 s;
  a chapter drawn under 100 ms; a tap card under 100 ms; search results under 50 ms for a plain search; no frame drops
  while scrolling a long chapter (Psalm 119) with layers on.
- **Platform manners:** safe areas and the home indicator; the keyboard never covers the field being typed in; the
  system's back gesture (iOS edge swipe, Android predictive back) goes back one step in the tab's stack; light and dark
  follow the system unless chosen; reduced motion honored; VoiceOver and TalkBack read a verse with its reference.
- **Later:** a share extension to send text from other apps into the Notebook as a jot; Apple Pencil (the parked stylus
  mode) on the iPad.

## 7. Testing and building

**Now: no phone builds.** The person's decision: mobile is tested on Windows.

- **By window size.** The desktop app gets test sizes it can snap its window to (a `window phone`, `window ipad`, ... command in the palette and in
  `wb do`, so tests can set them too; `size` already means text size): phone 390 × 844, phone landscape 844 × 390, iPad portrait 820 × 1180, iPad
  landscape 1180 × 820, laptop 1280 × 800 and 1440 × 900, desktop 1920 × 1080. The layout follows the width (section 3),
  so the window is the phone as far as layout goes.
- **By touch** on the touchscreen laptop: real finger taps, long presses, drags and swipes reach the web view (WebView2)
  as touch input, so the tap cards, selection handles, sheets and swiping chapters are tried with a finger, not a mouse.
  A test setting makes the app treat input as a phone would (tap cards instead of hover, the palette instead of the
  command field) even with a mouse attached.
- **For WebKit**, the engine inside every iPhone and iPad web view: the UI is also run in the WebKit build that the
  Playwright test tool ships for Windows, at phone size, in automated tests. That catches most of the rendering and CSS
  differences between Edge's engine and Safari's long before an iPhone build.
- **Optional, closer to a phone:** Tauri builds Android on Windows, so the Android emulator from Android Studio can run
  the real mobile build (system back gesture, on-screen keyboard, safe areas). Worth it from phase 2 if the laptop
  leaves doubts.

**What this cannot test, and so waits for an iPhone build:** iOS's own touch and selection behavior inside WKWebView,
the on-screen keyboard pushing the layout, safe areas and the home indicator, Dynamic Type, VoiceOver, haptics,
Keychain storage of the sync token, speed on real phone hardware, and installing. The code keeps these behind small
platform pieces so nothing has to be redone, and the list is checked off on the first iPhone build.

**Later: iPhone and iPad builds** need a Mac with Xcode (a Mac mini, or a macOS build machine in the cloud such as
GitHub Actions' macOS runners) and the Apple Developer Program (paid yearly) for TestFlight. A TestFlight build stays
installable for 90 days; a free Apple account's installs from Xcode stop after a week. Android can be installed
directly (an APK). The desktop uses Tauri's Windows installer, and macOS/Linux when wanted.

## 8. Phases

Each phase ends with something the person uses, and a check. **Desktop first** (the person's choice in review): the
Rust app first replaces the Python app's daily desktop use, then is shaped for the phone. The UI is one code base from
the start, with the size classes of section 3 in place, so the desktop phase does not paint the phone into a corner.

0. **Spikes.** (a) A Tauri desktop app on Windows that opens the bundled database, draws Numbers 25 with the marks from
   a copy of the study folder, and does tap-a-word, long-press selection across verses and a sheet, at the phone window
   size and by finger on the touchscreen laptop, plus hover and the color bar with a mouse at desktop size; the same page
   in Playwright's WebKit. Measure start-up, memory and the budgets in section 6. If touch selection in the web view
   falls short, try another approach for the reader alone before going on. (b) git2 clone, commit, pull and push of two
   copies of a scratch study folder through a scratch remote, with a conflicting edit merged by the rules in section 4.
   (c) A chapter PDF from Typst. *Check:* the person tries (a) by mouse and by finger and agrees the reader feels right.
1. **wb-core at parity, no UI.** The new repository with `wb-core` and the `wb` CLI. Every present data command gives the
   same answer as the Python app: a golden test runs both on the same inputs (passages, uses, search, marks, notes,
   highlight splits, thread edits) and compares. The Python test cases are carried over as Rust tests.
   *Check:* the Phinehas walkthrough in `demo/phinehas-command-log.md` runs with the Rust `wb` and gives the same results.
2. **Desktop.** The Large and Expanded layouts: reader, toolbar with the command field (search and capture merged),
   hover cards and the color bar, the dock with tabbed panes, the Notebook docked (Journal, Inbox, Place it, questions),
   threads and layers, search and word study, lexicons and the interlinear, find, text size, keyboard use, `wb do`.
   Works on the real study folder directly (same files as the Python app; no sync needed on one machine). Documents
   stay with the Python app until phase 5. *Check:* a week of daily study on the desktop without opening the Python app.
3. **Phone.** The Compact layout from the phone sheets: tabs, tap cards, touch selection and the selection bar, sheets,
   the palette, the Notebook tab, the Study tab, "Back to …"; sync arrives (the remote is chosen here). *Check:* a week of
   reading and note taking in the phone-size window by finger on the touchscreen laptop, with the notes reaching the
   desktop's copy of the folder through git.
4. **iPad sizes and mobile builds.** The Medium layout (after its design), Android builds (emulator or a device), and the
   first iPhone build when a Mac or cloud builds are in place, checking off section 7's list. *Check:* the same study
   followed at each size.
5. **Documents and lessons.** Typst PDFs, `.docx`, `.pptx`, presets and themes, lessons. *Check:* the Phinehas Pulpit deck
   and Speaker Script rebuilt and compared with the Craft-built ones in real PowerPoint and Word; the Python app is then
   no longer needed.
6. **The rest.** Read aloud, recordings, Help, Today's log, layouts, sets and the select box. Then the Python app is
   kept only as history.

## 9. The new repository

- Name: `bible-workbench-rs` (decided in review). Created when phase 0 starts, in a new session handed this plan.
- Layout: `crates/wb-core`, `crates/wb-cli`, `app/` (Tauri: `src-tauri`, the iOS and Android projects), `ui/` (TypeScript and
  CSS), `ui/tokens.css` generated from this repository's `design/figlib.py` tokens (or the tokens move there), `datasets/`
  build scripts (the database is built, not committed, as now), `docs/` (SPEC carried over and revised).
- This repository stays as it is: the Python app keeps working against the same study folder until phase 4, and
  `design/` keeps the FigCraft sources until the person moves them.
- CLAUDE.md for the new repository carries over the rules (verbatim scripture, the study folder is real work, scratch
  folders for tests, a `wb` command for every action).

## 10. Decisions for the person

1. ~~Rust core with a web UI in Tauri, or the UI in Rust too?~~ Decided: Tauri 2, plain TypeScript UI (section 2.1).
2. ~~A Mac, or cloud builds for iOS?~~ Deferred: no iPhone builds for now; mobile is tested on the laptop (section 7).
3. ~~The sync remote?~~ Decided: chosen at the phone phase (3), before sync touches the real folder.
4. ~~The iCloud Drive folder?~~ Decided: revisit at the first iPhone build.
5. ~~The new repository's name?~~ Decided: `bible-workbench-rs`, created at the phase 0 handoff.
6. ~~Phase order?~~ Decided: desktop first (section 8).
7. ~~Search and capture as one command field on the desktop?~~ Decided: merged (backtick still opens it).
8. ~~Trails?~~ Decided: folded into the Notebook as questions; existing trail files are read as questions.
9. ~~The reading font?~~ Decided: **Literata** (SIL Open Font License), shipped inside the app so every device matches;
   chosen from `design/fonts/compare.html`. Inter stays the interface face and Noto Sans Hebrew the Hebrew.

## 11. Risks

- **Touch selection in a web view** may feel less native than the system's own; phase 0 tests it first by finger, with
  another reader approach as the fallback.
- **The first iPhone build comes late.** iOS-only behavior (section 7's list) is untested until then. Mitigation:
  WebKit tests from phase 0, platform pieces kept small, and the list checked off on the first build.
- **Tauri on mobile** is younger than on desktop; plugins may need writing in Swift or Kotlin.
- **Merges of the person's real files.** Mitigation: the merge rules above, a test suite of conflicting edits, nothing
  ever dropped (`.trash/`), and sync (phase 3) run against a copy of the study folder before the real one.
- **Two apps on one folder** during the move: both must keep the same formats; the golden tests of phase 1 guard it.
- **`.pptx` without a mature library**: template-based writing, checked in real PowerPoint.
- **Scope**: about 7,700 lines of Python and 8,200 of JavaScript today; the phases keep a usable app at every step.

## Sources

- [Tauri 2.0 stable with iOS and Android (October 2024)](https://alternativeto.net/news/2024/10/tauri-2-0-enhances-cross-platform-app-development-with-mobile-support-and-improved-plugins),
  [Tauri 2 roadmap](https://v2.tauri.app/blog/roadmap-to-tauri-2-0/),
  [Tauri 2 mobile and desktop from one codebase (2026)](https://www.mayhemcode.com/2026/07/build-mobile-and-desktop-apps-from-one.html)
- [Dioxus releases](https://github.com/dioxuslabs/dioxus/releases/tag/v0.7.0-alpha.2), [dioxus 0.7.8](https://docs.rs/crate/dioxus/0.7.8/source/README.md)
- [gitoxide: missing features compared to git, including push](https://github.com/GitoxideLabs/gitoxide/discussions/2810),
  [libgit2 for Apple platforms](https://github.com/mfcollins3/libgit2-apple),
  [an iOS app that pushes with libgit2](https://syncmd.pages.dev/)
