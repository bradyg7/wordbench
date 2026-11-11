export type Category = 'Reading' | 'Word study' | 'Notes & highlights' | 'Workspace' | 'Reading plans' | 'Documents' | 'Help & setup';

export interface Demo {
  id: string;
  category: Category;
  title: string;
  description: string;
  steps: string[];
  duration?: string;
}

export interface Feature {
  id: string;
  category: Category;
  title: string;
  description: string;
  details: string[];
  demoId?: string;
  status?: string;
}

export const demos: Demo[] = [
  {
    id: 'reading-navigation', duration: '28 sec', category: 'Reading', title: 'Find your place in the reader',
    description: 'Choose a chapter, find a word within it, and change the displayed version using the reader controls.',
    steps: ['Open the book and chapter picker and choose a chapter.', 'Open Find in chapter and type a search term.', 'Inspect the matching words, then switch the displayed Bible version.'],
  },
  {
    id: 'word-study', duration: '20 sec', category: 'Word study', title: 'Follow a word to its uses',
    description: 'Click a word, inspect its source-backed entry, and open the list of its occurrences.',
    steps: ['Move to a word in the reader and click it.', 'Read the word card and its identified lexical source.', 'Choose Every use and browse the matching occurrences.'],
  },
  {
    id: 'highlighting', duration: '24 sec', category: 'Notes & highlights', title: 'Select and highlight a passage',
    description: 'Drag across words, choose a highlight color, and return to see the saved mark.',
    steps: ['Drag the pointer across a run of words in the reader.', 'Choose a color from the selection actions.', 'Leave the passage and return to check that the highlight remains.'],
  },
  {
    id: 'pages', duration: '38 sec', category: 'Notes & highlights', title: 'Create a page of your own',
    description: 'Start with a blank page, give it a name, type a short sample note, and reopen the saved page.',
    steps: ['Open the Notebook and choose a new blank page.', 'Type a page name and sample text.', 'Leave the page, then reopen it to see the saved writing.'],
  },
  {
    id: 'parallel-reading', duration: '27 sec', category: 'Reading', title: 'Keep two passages open',
    description: 'Open a passage beside the main reader and navigate the second reader independently.',
    steps: ['Open the verse actions and choose Open in a new tab.', 'Use the second reader’s book and chapter controls.', 'Keep both passages visible without replacing the main reader.'],
  },
  {
    id: 'appearance', duration: '28 sec', category: 'Workspace', title: 'Choose a reading appearance',
    description: 'Open Settings and try the built-in appearance choices while keeping the reader in view.',
    steps: ['Open Settings and choose Theme.', 'Select a built-in appearance and see the reader update.', 'Return to the preferred appearance for continued reading.'],
  },
];

const feature = (id: string, category: Category, title: string, description: string, details: string[], demoId?: string, status?: string): Feature =>
  ({ id, category, title, description, details, ...(demoId ? { demoId } : {}), ...(status ? { status } : {}) });
const nativePending = 'Native demonstration pending';

export const features: Feature[] = [
  feature('book-chapter-navigation', 'Reading', 'Book and chapter navigation', 'Pick a book and chapter, move between chapters, or enter a reference.', ['The reader draws text from a read-only Bible database.'], 'reading-navigation'),
  feature('bible-versions', 'Reading', 'KJV and YLT', 'Switch the displayed version in the main reader or an individual secondary reader.', ['Word-level Strong’s mapping is KJV-based. Other versions show whole-verse marks.'], 'reading-navigation'),
  feature('parallel-readers', 'Reading', 'Parallel readers', 'Keep passages open in separate reader tabs and navigate them independently.', ['A secondary reader can send its place to the main reader. This is a local workspace feature, not device synchronization.'], 'parallel-reading'),
  feature('reading-history', 'Reading', 'Return to a place', 'Follow a reference and return through the reader’s navigation history.', ['Navigation keeps track of reading places so a lookup does not become a new starting point.']),
  feature('find-in-chapter', 'Reading', 'Find in chapter', 'Search within the current chapter and move between matches.', ['This is separate from full-Bible text search.'], 'reading-navigation'),
  feature('find-in-pane', 'Reading', 'Find in a pane', 'Find text within the active pane.', ['The search stays within that pane’s displayed content.']),
  feature('copy-scripture', 'Reading', 'Copy referenced text', 'Copy a selected passage with its reference and supported formatting.', ['The copied text comes from the source database.', 'Clipboard integration requires a supported desktop environment.'], undefined, nativePending),
  feature('reference-cards', 'Reading', 'Reference cards', 'Open a reference in a compact card without replacing the reader.', ['Hover behavior can be turned off, limited to references, or enabled for words and references.', 'Cards show source text, not generated explanations.']),
  feature('read-aloud', 'Reading', 'Local read-aloud', 'Listen from the current passage, pause or resume, and change voice or speed.', ['Requires an installed local English speech voice.', 'The reader can follow the spoken verse and word where the voice supplies word boundaries.', 'Personal audio recordings are not implemented.'], undefined, nativePending),

  feature('word-cards', 'Word study', 'Word cards', 'Click a mapped KJV word to inspect its original word, Strong’s entry, usage counts, and attached notes.', ['Coverage follows the installed source data. Not every English token has a Strong’s mapping.', 'Entries identify lexical source material.'], 'word-study'),
  feature('strongs-lookup', 'Word study', 'Strong’s lookup', 'Open a Hebrew or Greek entry directly by its Strong’s number.', ['Displays the lexical entry from the installed data, rather than generating an interpretation.']),
  feature('bdb-lookup', 'Word study', 'Hebrew and Aramaic BDB lookup', 'Read an available Brown–Driver–Briggs entry with its source status.', ['Coverage depends on the installed dataset. Missing or qualified source entries remain identified.']),
  feature('english-dictionary', 'Word study', 'English dictionary', 'Look up English definitions from Webster’s 1913.', ['Requires the dictionary resource.', 'These are historical source definitions, not generated modern definitions.']),
  feature('word-occurrences', 'Word study', 'Every use', 'Browse occurrences of an English word or Strong’s number.', ['Where available, narrow results by scope, rendering, or category.', 'The walkthrough shows opening the occurrence list; these additional filters are documented features.'], 'word-study'),
  feature('counts-and-forms', 'Word study', 'Counts and word forms', 'Inspect occurrence counts by book and English forms of a word.', ['Counts describe the source data and do not supply a conclusion about it.']),
  feature('bible-search', 'Word study', 'Bible text search', 'Find KJV verses containing all search terms, quoted phrases, or prefix matches.', ['Results come from the KJV corpus. This is separate from searching personal pages.']),
  feature('near-search', 'Word study', 'Nearby words', 'Find two words or Strong’s numbers within a selected word distance.', ['Shows matching verses from the source database.']),
  feature('definition-search', 'Word study', 'Search lexical definitions', 'Find original-word entries whose Strong’s definition or usage text contains an English term.', ['This searches lexical entries, not Scripture text.']),
  feature('interlinear', 'Word study', 'Interlinear', 'Inspect a verse word by word in Hebrew or Greek with KJV alignment.', ['Available alignment and linguistic details depend on the installed source data.']),

  feature('word-selection', 'Notes & highlights', 'Select words and verses', 'Drag across words or select a verse to open the available actions.', ['Selections can be used for marking or opening actions on that place.'], 'highlighting'),
  feature('highlights', 'Notes & highlights', 'Highlights', 'Save a highlight on a selected place and keep it when you return.', ['Built-in and custom colors, removal, and highlight Undo are supported.', 'Marks are stored in study files; the Bible database stays unchanged.'], 'highlighting'),
  feature('highlight-list', 'Notes & highlights', 'Highlight visibility and lists', 'Choose which marks appear and browse saved highlights by color, scope, or thread.', ['Hiding a mark does not delete it.']),
  feature('placed-notes', 'Notes & highlights', 'Notes at a place', 'Attach your writing to words, verses, passages, books, or an original-word number.', ['You supply the writing. The application does not suggest theological content.']),
  feature('threads', 'Notes & highlights', 'Threads', 'Collect places under a name, choose a color, reorder them, and write on the thread’s page.', ['Threads are collections you create, not automatically inferred topics.']),
  feature('collect-results', 'Notes & highlights', 'Collect search results', 'Add ticked results or the loaded result set to a thread.', ['The interface distinguishes selected results from all currently loaded results.']),
  feature('notebook', 'Notes & highlights', 'Notebook', 'Browse Today, Pinned, nested Pages, places at the reader, Threads, and Questions.', ['Search personal pages from the Notebook.', 'Notes, days, and threads retain their plain-file storage formats.']),
  feature('new-pages', 'Notes & highlights', 'Create and reopen pages', 'Name a new page, write in it, and reopen the saved writing.', ['Pages can also be renamed. The walkthrough uses disposable sample writing.'], 'pages'),
  feature('daily-capture', 'Notes & highlights', 'Daily page and quick capture', 'Write in today’s page or capture writing before assigning it a place.', ['Captured content is your own writing.']),
  feature('page-hierarchy', 'Notes & highlights', 'Nested pages and pinning', 'Create pages inside pages, move or reorder them, and pin frequently used pages.', ['The displayed hierarchy is separate from the location of source files.']),
  feature('page-associations', 'Notes & highlights', 'Places and thread associations', 'Give a page one or more places and associate it with a thread.', ['Associations can be added or removed without inventing a second copy of the writing.']),
  feature('page-links', 'Notes & highlights', 'Links and backlinks', 'Link to another page by title, follow it, and inspect pages that link back.', ['Links can be updated after a page is renamed.', 'A missing target can be represented before its page exists.']),
  feature('writing-blocks', 'Notes & highlights', 'Writing blocks', 'Use paragraphs, headings, lists, to-dos, quotes, dividers, tables, and fenced content.', ['Blocks can be edited, moved, or removed.', 'Markdown remains the stored representation.']),
  feature('scripture-blocks', 'Notes & highlights', 'Scripture blocks', 'Insert a passage by reference and choose paragraph or verse-line display.', ['Choose KJV or YLT for the block.', 'The file holds the reference; the displayed words come from the database.']),
  feature('word-thread-blocks', 'Notes & highlights', 'Word and thread blocks', 'Include a numbered lexical entry or a live view of a thread’s places in a page.', ['Blocks store identifiers rather than copied lexical entries or thread contents.']),
  feature('questions', 'Notes & highlights', 'Questions', 'Keep questions in pages or at a place, mark them answered, and reopen them when needed.', ['Browse the combined question list.', 'You supply the questions and answers.']),
  feature('question-placement', 'Notes & highlights', 'Move a question into a page', 'Fold a placed question into a page or give a page question a place of its own.', ['The available action depends on the relationship between the question, page, and place.']),
  feature('live-views', 'Notes & highlights', 'Live notebook views', 'Keep a filtered list of existing notebook results inside a page.', ['Filter by place, kind, question status, thread, time, or words.', 'Views read existing work; they do not write notes for you.']),
  feature('templates', 'Notes & highlights', 'Page templates', 'Save a reusable page structure, preview it, and choose where new pages belong.', ['Templates can fill place, date, title, and current-reader blanks.', 'You provide the reusable structure.']),
  feature('deletion-recovery', 'Notes & highlights', 'Deletion and recovery', 'Use timed page Undo, undo a removed block, or inspect legacy Trash.', ['Page Undo and legacy seven-day Trash have different recovery rules.', 'Recovery is not unlimited.']),

  feature('tabs-panes', 'Workspace', 'Tabs and panes', 'Open, close, focus, arrange, and resize panes and tab groups.', ['Desktop layouts allow multiple reading and study views together.']),
  feature('saved-layouts', 'Workspace', 'Saved layouts', 'Save an arrangement by name, load it later, or assign a shortcut.', ['Saved arrangements are local.']),
  feature('shelf', 'Workspace', 'Shelf folders', 'Group references, pages, threads, panes, documents, and PDFs in nested folders.', ['Rename, move, copy, or remove entries.', 'Removing a folder entry does not delete the item it points to.']),
  feature('shelf-open-all', 'Workspace', 'Open a folder’s items together', 'Open a set of items together, then close the tabs that belong to the set.', ['Open all is available in wider windows.', 'Standalone PDFs open in the system viewer.']),
  feature('toolbar', 'Workspace', 'Customize the toolbar', 'Add buttons, put them away, or drag them into a preferred order.', ['Buttons hidden because of available space remain accessible through More.']),
  feature('appearance', 'Workspace', 'Built-in appearances', 'Choose Light, Dark, System, or E-ink appearance.', ['Changing appearance leaves the text and study content unchanged.'], 'appearance'),
  feature('custom-appearance', 'Workspace', 'Text size and custom themes', 'Adjust reading size or create a theme with your own colors and fonts.', ['Custom appearance settings are separate from the source text.']),
  feature('preferences', 'Workspace', 'Notebook and input preferences', 'Adjust notebook behavior, hover cards, and pointer or touch interaction preferences.', ['Responsive layouts do not imply that a native mobile app has shipped.']),
  feature('saved-commands', 'Workspace', 'Saved commands and shortcuts', 'Keep a named action with an icon, context placeholders, and an optional shortcut.', ['This is an optional way to reach frequently used actions.']),

  feature('build-plan', 'Reading plans', 'Build a reading plan', 'Choose books, duration or pace, a start date, and a name.', ['Built-in ordering is canonical. Other schedules, such as chronological plans, can be imported.']),
  feature('arrange-plan', 'Reading plans', 'Arrange plan days', 'Move readings, add or remove chapters, and retain days you arranged by hand.', ['Adjust the remaining schedule by pace.']),
  feature('import-plan', 'Reading plans', 'Import a plan', 'Paste a day-by-day list of references and record where the plan came from.', ['The application does not provide every publisher’s reading schedule.']),
  feature('today-reading', 'Reading plans', 'Today’s reading', 'Open the readings assigned for a day and mark them read.', ['Progress reflects the marks you enter.']),
  feature('revise-plan', 'Reading plans', 'Revise a plan or handle missed days', 'Rename a plan, change its start, edit its text, or choose how to handle missed readings.', ['Missed days can be shifted, fitted into remaining time, moved later, or skipped.', 'Each choice changes the schedule differently.']),
  feature('past-plans', 'Reading plans', 'Past plans', 'Stop, review, reuse, or delete a reading plan.', ['The reading log remains when a plan is deleted.']),
  feature('reading-progress', 'Reading plans', 'Reading log and progress', 'Mark chapters read or unread, inspect previous reading counts, and view progress by book.', ['Unmarking removes the latest reading mark for a chapter, rather than all its history.']),

  feature('word-export', 'Documents', 'Word documents', 'Export existing passages, pages, or threads to Word with selected content and appearance.', ['This formats existing source content. It does not author teaching or conclusions.'], undefined, nativePending),
  feature('slides-export', 'Documents', 'PDF and editable PowerPoint', 'Export supported slide structures as PDF or editable PowerPoint.', ['Saved PDF previews are available where produced.', 'Native output and Office inspection remain separate acceptance checks.'], undefined, nativePending),
  feature('chapter-pdf', 'Documents', 'Chapter print PDF', 'Save a chapter with its existing notes and optional highlights.', ['Scripture is checked against source data before the export is retained.'], undefined, nativePending),
  feature('export-content', 'Documents', 'Choose what goes into an export', 'Select page blocks and nested pages for each supported output.', ['The selection uses content that already exists in the source.'], undefined, nativePending),
  feature('document-looks', 'Documents', 'Document Looks and previews', 'Choose preset appearances, themes, and supported formatting adjustments.', ['Preview the resulting layout.', 'This is not a complete arbitrary document-editing workflow.'], undefined, nativePending),
  feature('saved-documents', 'Documents', 'Saved documents', 'Browse, preview, open, reveal, update, or remake saved exports.', ['You can stop tracking an export without deleting its file.', 'Deleting an exported document can erase its files.'], undefined, nativePending),
  feature('pdf-packets', 'Documents', 'Ordered PDF packets', 'Join saved PDFs and existing PDF companions in your chosen order.', ['This does not imply arbitrary Office-to-PDF conversion is complete.'], undefined, nativePending),
  feature('legacy-document-files', 'Documents', 'Existing document-file compatibility', 'Read, check, and export the supported legacy lesson-file format.', ['Compatibility uses existing authored files; the application does not create their teaching content.'], undefined, nativePending),

  feature('help-shortcuts', 'Help & setup', 'Help and keyboard shortcuts', 'Search task guidance, command documentation, and the list of keyboard shortcuts.', ['Help explains the application’s controls and workflows.']),
  feature('command-field-cli', 'Help & setup', 'Command field and command-line access', 'Run explicit application actions through the command field or the wb command-line tool.', ['These are application operations, not an AI assistant.', 'The underlying data contracts remain the same.']),
  feature('findings', 'Help & setup', 'Findings about the app', 'Keep a local issue record with screen context, edit it, and mark it handled or reopen it.', ['Findings do not automatically send a support request.']),
  feature('finding-attachments', 'Help & setup', 'Finding attachments', 'Attach files to a finding and open or remove them later.', ['Attachments are copied into the local study folder, with a 10 MB limit per file.'], undefined, nativePending),
  feature('study-folder', 'Help & setup', 'Choose a study folder', 'Select or create a folder for personal study files during customer setup.', ['The setup flow checks installed resources before proceeding.', 'The production installer is not available for download yet.'], undefined, nativePending),
  feature('pilot-activation', 'Help & setup', 'Pilot activation', 'Create an activation request and import a manually issued pilot certificate.', ['Approved policy: two computers per invited person, owner-assisted replacement activation, and included pilot updates.', 'Production issuance and clean-machine acceptance remain release requirements.'], undefined, nativePending),
  feature('offline-files', 'Help & setup', 'Offline use and accessible files', 'Continue using the activated version offline and retain direct access to personal study files.', ['The activated version does not expire under the approved pilot policy.', 'Study files remain ordinary accessible files even without activation.', 'Cross-device synchronization and native mobile apps are not shipped features.']),
];
