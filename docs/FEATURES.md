# Bible Workbench feature inventory

Reviewed against the source in the private-pilot integration checkout on 2026-11-11. This is an inventory of implemented development features, not a claim that a production installer has shipped. [SPEC.md](SPEC.md) and [RELEASE.md](RELEASE.md) govern release readiness.

Evidence tier: **Identified Primary** — the owning implementation files linked below. A source inspection establishes that controls and operations exist; it does not establish a successful native Windows acceptance run. A demo must show its actual result before being described as demonstrated.

## Read and navigate

Sources: [main.ts](../ui/src/main.ts), [reader.ts](../ui/src/reader.ts), [panefind.ts](../ui/src/panefind.ts), [read.rs](../crates/wb-cli/src/read.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Book and chapter navigation | Pick a book and chapter, move to adjacent chapters, or enter a reference. | Text comes from the installed read-only database. |
| KJV and YLT | Switch the main reader or an individual secondary reader between the available versions. | Word-level Strong's mapping is KJV-based; other versions show whole-verse marks. |
| Parallel readers | Open a passage in another tab, navigate that reader independently, or send its place to the main reader. | A second reader is not a second synced device. |
| Return to a place | Follow references and return through reader navigation history. | Preserve the actual verse and scroll position in a demonstration. |
| Find in chapter or pane | Search the visible reading context and step between matches. | Distinct from searching the full Bible. |
| Copy referenced text | Copy a selected passage with its reference and supported formatting. | Do not type substitute verse text in a demo. |
| Reference cards | Open a referenced passage in a card; configure whether cards appear on hover. | Cards are source text, not generated explanations. |

## Look up words and search

Sources: [panes.ts](../ui/src/panes.ts), [main.ts](../ui/src/main.ts), [read.rs](../crates/wb-cli/src/read.rs), [lookup.rs](../crates/wb-core/src/lookup.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Word cards | Click a KJV word to see its mapped original word, Strong's number, lexicon entry, usage counts, and attached notes. | Coverage follows the source database; not every displayed English token has a mapping. |
| Strong's lookup | Open a numbered Hebrew or Greek entry directly. | Lexical source material is identified; it is not the application's interpretation. |
| Hebrew/Aramaic BDB lookup | Read the available BDB entry and its source status. | Dataset coverage and source status must remain visible. |
| English dictionary | Look up a word in Webster's 1913. | Requires the dictionary resource; historical definitions are not modern generated answers. |
| Every use | List occurrences of an English word or Strong's number; narrow by scope, rendering, or category where available. | Counts and results must come from the database. |
| Counts and forms | Inspect counts by book and English word forms. | A count is not an interpretive conclusion. |
| Bible text search | Find verses containing all terms, quoted phrases, or prefix matches. | Searches the KJV corpus implemented by this command. |
| Near search | Find two words or Strong's numbers within a chosen distance. | Shows matching source results only. |
| Definition search | Search Strong's definition/usage text for an English term. | Different from searching Scripture text. |
| Interlinear | Open a verse's Hebrew or Greek word-by-word view with KJV alignment. | Alignment and available linguistic data come from the installed sources. |

## Highlight and collect places

Sources: [select.ts](../ui/src/select.ts), [marks.ts](../ui/src/marks.ts), [main.ts](../ui/src/main.ts), [panes.ts](../ui/src/panes.ts), [study.rs](../crates/wb-cli/src/study.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Select words and verses | Drag through words or select a verse to open the available actions. | Show a real pointer drag, not a preselected DOM state. |
| Highlights | Apply a built-in or custom color; remove a highlight; undo a highlight change. | Writes only the person's study files, not the Bible database. |
| Highlight visibility and list | Choose which marks are drawn and browse saved highlights by color, scope, or thread. | Hiding marks does not delete them. |
| Notes at a place | Attach a person's own writing to words, verses, passages, books, or an original-word number. | No suggested theological content. |
| Threads | Create a named collection, add or remove places, choose its color, reorder places, and write on its page. | A thread is the person's collection, not an automatically inferred topic. |
| Collect search results | Tick results and add selected or loaded results to a thread. | The interface distinguishes ticked results from the loaded result set. |

## Write and organize pages

Sources: [notebook.ts](../ui/src/notebook.ts), [blocks.ts](../ui/src/blocks.ts), [pagewriters.ts](../ui/src/pagewriters.ts), [notebook.rs](../crates/wb-cli/src/notebook.rs), [pages.rs](../crates/wb-cli/src/pages.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Notebook | Browse Today, Pinned, nested Pages, pages at the reader, Threads, and Questions; search pages. | Notes, days, and threads use existing plain-file formats. |
| New pages | Name a page, type into it, rename it, and reopen it later. | Verify the saved result, not only visible text in an editor. |
| Daily page and quick capture | Write in today's page or capture a page without assigning a place yet. | Capture is personal writing; no generated study content. |
| Page hierarchy and pinning | Create pages inside pages, move/reorder them, and pin frequently used pages. | Page hierarchy is separate from where source files live. |
| Place and thread associations | Assign or remove places, add additional places, or associate a page with a thread. | One page may have more than one association. |
| Links and backlinks | Link to another page by title, follow it, inspect incoming links, and update links after a rename. | Missing targets can be represented without inventing their contents. |
| Writing blocks | Add paragraphs, headings, lists, numbered lists, to-dos, quotes, dividers, tables, and fenced content. Edit, move, and delete blocks. | Markdown remains the stored representation. |
| Scripture blocks | Insert a reference-backed Scripture block; choose paragraph/verse lines and KJV/YLT. | The stored block holds a reference; displayed text is fetched from the database. |
| Word and thread blocks | Insert a numbered lexicon entry or a live view of a thread's places. | Stores identifiers rather than copied source entries. |
| Questions | Add a question block or a question at a place, mark it answered/reopen it, and browse the combined question list. | The person supplies the question and answer. |
| Question placement | Fold a placed question into a page or give a page question its own placed page. | Requires the relevant page/place relationship. |
| Live views | Keep a filtered list of notebook results in a page, using place, kind, status, thread, time, or words. | Views read existing work; they do not generate notes. |
| Templates | Save a page as a template, configure its name/location, preview it, and fill place/date/title/reader blanks. | A template is a person's reusable structure. |
| Deletion and recovery | Delete a page with timed Undo, undo a removed block, and inspect legacy Trash. | Page Undo and legacy seven-day Trash have different contracts; do not promise unlimited recovery. |

## Arrange the workspace

Sources: [dock.ts](../ui/src/dock.ts), [layouts.ts](../ui/src/layouts.ts), [shelf.ts](../ui/src/shelf.ts), [toolbar.ts](../ui/src/toolbar.ts), [settings.ts](../ui/src/settings.ts), [mycommands.ts](../ui/src/mycommands.ts), [study.rs](../crates/wb-cli/src/study.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Tabs and panes | Open, close, focus, rearrange, and resize panes and tab groups. | Demonstrate desktop arrangements at a readable size. |
| Saved layouts | Save an arrangement by name, load it, remove it, and assign a shortcut. | Layout persistence is local. |
| Shelf folders | Group references, pages, threads, saved panes, documents, and PDFs in nested folders; rename, move, copy, or remove items. | Removing a reference from a folder does not delete its target. |
| Open/close a folder's items | Open a set together and close the tabs belonging to that set. | Open all is for wider windows; standalone PDFs use the system viewer. |
| Toolbar customization | Add, remove, and drag toolbar buttons into a preferred order. | Buttons hidden for space remain available through More. |
| Reading appearance | Adjust text size, light/dark/system/E-ink appearance, and custom theme colors/fonts. | Appearance does not change Scripture wording. |
| Preferences | Change notebook behavior, hover cards, and pointer/touch interaction preferences. | Responsive preview does not establish a native mobile release. |
| Saved commands and shortcuts | Save a named command with context placeholders, an icon, and a keyboard shortcut. | This is an optional power-user feature, not the default presentation for all demos. |

## Plan and track reading

Sources: [plans.ts](../ui/src/plans.ts), [main.ts](../ui/src/main.ts), [reading.rs](../crates/wb-cli/src/reading.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Build a plan | Choose Bible books, a duration or pace, a start date, and a name. | Built-in order is canonical; chronological schedules are imported. |
| Arrange plan days | Move days/chapters, add or remove readings, keep manually arranged days, and adjust pace. | Show the actual resulting schedule. |
| Import a plan | Paste a day-by-day reference list and identify its source. | The app does not supply every publisher's plan. |
| Today's reading | Open the day's reading and mark it read. | Progress reflects marks entered by the person. |
| Revise a plan | Rename, change its start, edit as text, or handle missed days by shifting, fitting, postponing, or skipping. | Missed-day choices have different consequences; show the selected option. |
| Past plans | Stop, review, reuse, or delete a plan while retaining the reading log. | Deleting the plan does not erase already-recorded reading. |
| Reading log and progress | Mark chapters read/unread, inspect previous readings and counts, and view progress by book. | Unmark removes the latest mark for a chapter, not all history. |

## Export and revisit documents

Sources: [documents.ts](../ui/src/documents.ts), [pagedocs.ts](../ui/src/pagedocs.ts), [looks.ts](../ui/src/looks.ts), [docs.rs](../crates/wb-cli/src/docs.rs), [docs](../crates/wb-core/src/docs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Word export | Make a Word document from existing passages, pages, or threads; choose content and appearance. | A formatting/export operation, not AI-authored teaching or conclusions. |
| PDF and PowerPoint | Export supported slide structures to PDF or editable PowerPoint, with saved PDF previews where produced. | Native output and Office inspection remain separate acceptance checks. |
| Chapter print PDF | Save a chapter with its existing notes and optional highlights. | Scripture is checked against source data before output is retained. |
| Content selection | Select which page blocks and nested pages go into each output. | Only existing source content is selected. |
| Document Looks | Choose presets, themes, and supported formatting adjustments; preview the resulting layout. | Not every editing/conversion workflow is implemented. |
| Saved documents | Browse, preview, open, reveal, update/remake, or stop tracking an exported document. | Deleting exported documents can erase files; the UI must state that consequence. |
| Ordered PDF packets | Join saved PDFs and existing PDF companions in a selected order. | Does not imply arbitrary Office-to-PDF conversion is complete. |
| Existing legacy files | Read/check/export the existing lesson-file format supported by the project. | Compatibility only; do not create lessons or sermons for a demonstration. |

## Listen, get help, and report findings

Sources: [listen.ts](../ui/src/listen.ts), [panes.ts](../ui/src/panes.ts), [findings.ts](../ui/src/findings.ts), [command.ts](../ui/src/command.ts), [notebook.rs](../crates/wb-cli/src/notebook.rs).

| Feature | What a person can do | Boundary |
| --- | --- | --- |
| Local read-aloud | Start at the current passage, pause/resume/stop, change speed and local English voice, and follow reading highlights. | Requires an installed local English voice. A silent screen recording does not demonstrate audible output. |
| Help and keys | Search task guidance, command reference, and keyboard shortcuts. | Help is application usage guidance, not Scripture instruction. |
| Command field and CLI | Enter an explicit application action, inspect command help, or invoke Rust-owned actions from `wb`. | Backend access supports the same data contracts; it is not an AI assistant. |
| Findings | Record an issue about the app with screen context, attach files, edit it, and mark it handled/reopen it. | Findings are local records, not an automatic support submission. |

## Installation and ownership

Sources: [installation.ts](../ui/src/installation.ts), [runtime.rs](../crates/wb-core/src/runtime.rs), [wb-license](../crates/wb-license), [RELEASE.md](RELEASE.md).

The customer setup flow checks installed resources, selects or creates a study folder, produces an activation request, and imports a manually issued pilot certificate. The approved pilot terms allow two computers per invited person, owner-assisted replacement activation, included pilot updates, and continued offline use of the activated version. Study files remain accessible as ordinary files without activation.

**Unverified/Flagged for public release:** a signed installer, final third-party notice review, production issuance/download arrangements, and clean-machine acceptance. The optional updater is not enabled in the pilot installer. Public website availability is not installer availability.

**Not implemented or not a shipped claim:** native mobile apps, cross-device sync, personal audio recordings, an AI interpretation/sermon writer, automatic doctrinal suggestions, and a complete arbitrary PDF/Office editing-and-conversion workflow. The stale Advanced settings text that places all read-aloud in a later phase is not the current source contract: `listen.ts` implements local read-aloud and explicitly rejects personal recordings.

## Demo recording contract

Use a disposable study folder and read-only source databases. Never use personal notes or write to the real study folder. Record a visible cursor moving between targets, real clicks, paced typing, selections, and the resulting UI. Each clip should complete one understandable workflow and hold on the saved result. Source-backed Scripture and lexical entries must be generated/fetched, not authored for the recording.

The ordinary browser development mode in [api.ts](../ui/src/api.ts) reads fixtures; it does not persist page edits or highlights. Stateful recordings therefore need the native application or a capture-only bridge to the real Rust operations against a disposable folder. A prepared fixture response must not be presented as proof that a save occurred. Any capture bridge must remain local and must not be shipped with the static website.

Recommended recording sequence: (1) navigate and compare passages, (2) inspect a word and its occurrences, (3) drag to highlight and clear a selection, (4) create and reopen a page, (5) add a question and reference-backed block, (6) organize pages and pin one, (7) collect places in a thread, (8) arrange a Shelf folder and panes, (9) build and mark a reading plan, (10) customize appearance/toolbar, (11) choose and preview an export, (12) local read-aloud with verified audio. Features outside a completed clip remain documented rather than labelled as video-demonstrated.
