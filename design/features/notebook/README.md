# The Notebook, with Notion's quality as the template

**State:** exploring (round 1: the inventory) · **Sheets:** none yet; round 2 draws the adopted lines as windows ·
Nothing here is built. · **Review page:** `node design/review.mjs notebook` writes `review.html`.

The person, 2026-11-20: Notion's quality is the template; Wordbench comes in and changes it for studying the Bible.
Not every Notion command is kept, and Wordbench adds its own Bible-specific versions. This folder is the
[Library map](../../LIBRARY.md)'s Open item 5, "the Notebook's feature inventory": every line is marked **adopt**,
**adapt** or **skip**, with the reason. The redesign's interaction table is built from the adopted and adapted lines.

Sources: the person's 23 screenshots of Notion (2026-11-20, kept outside the repo; named below as N02…N24) and their
written "feel" spec (`notion_feel_spec.md`, summarised here, not copied). Notion's brand, icons and exact visuals are
never copied; its interaction model and proportions are.

## How this fits what is already accepted

The [library](../library/README.md) folder's round 4 (S25–S36, accepted 2026-11-17) already designed "the Notebook
works like Notion": one folding side list (Today only when on, Pinned, Folders, Pages, Margin notes, the Shelf), one
right-click menu, one filter line instead of the Filters form and the Days/Pages/Places/Threads/Questions/All tabs,
a centred page with a title, / and a selection bar, side by side at full width, the page's ⋯, several pages at once.
None of its window work is built. **This inventory does not replace round 4; it raises it to Notion's quality and
fills what round 4 left out** (Turn into, the block handle, markdown shortcuts, toggles, drag to reorder, focus
rules, the feel). Where a line below says "round 4", that part is already decided.

Questions stay a study object: written in a page as a callout and listed by the [questions](../questions/README.md)
folder, not as a Notebook tab.

## Decisions (the person, 2026-11-20)

- **Pause Filters after F2.** F1–F2 stay on `feature/filters`, tested, unmerged. F3 (section independence, Places) is
  not built: those sections go. Filters resumes for surfaces outside the Notebook after this redesign.
- **Notion's quality is the template.** Its feel and interaction model are the starting point; Wordbench changes it
  for Bible study. Inspiration, not a checklist.

## The feel (adopt, all)

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| F1 | A calm page that becomes what you need when you type for it; UI out of the way until summoned | adopt | The person's stated goal |
| F2 | Controls appear on intent: + and grip on hover left of a block; bar only on a selection; title buttons only on hover | adopt | Round 4 already does hover-only ⋯/+ in the side list (L-12); extend to blocks |
| F3 | Every menu is searchable and filters as you type; Enter picks, Esc closes; one menu component for /, block menu, page ⋯, quick search | adopt | One component means one feel; also faster to build |
| F4 | No Save button; quiet "Edited just now" | adopt | Pages already save as you type; add the quiet status |
| F5 | Local-first: typing never waits | adopt | Already true (files on disk); keep the typing budget in `npm run measure` |
| F6 | Menus fade in place (~100–150 ms), anchored to the caret or the control; nothing on the page jumps | adopt | "Nothing jumps" is the premium feel |
| F7 | Focus is handled: after / the caret is in the new block; Enter continues a list; Enter on an empty item leaves it; Tab/Shift+Tab indent; new page puts the caret in the title, Enter moves to the body | adopt | Round 4 S29 has Enter; the rest is new |
| F8 | Quiet empty states with a hint ("Press / for blocks"), no illustration | adopt | Teaches without a tutorial; answers "hard to learn" (tester 1) |
| F9 | Small calm chrome around larger comfortable content; consistent density | adopt | |
| F10 | Destructive actions only in menus, always recoverable | adopt | Matches the 7-day Trash and page Undo |

## Look

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| L1 | Narrow centred column (~700 px), wide margins; Full width toggle | adopt | Round 4 S28/S30 |
| L2 | Warm off-white canvas, near-black text; warm gray side list; small 13–14 px side text; ~6 px rounded hover | adapt | Through our `tokens.css`, light and dark |
| L3 | Title ~40 px bold, H1 ~30, body 16, line height ~1.5, tight block gaps | adapt | Scripture stays in Literata; the scale in tokens |
| L4 | Page font: Default / Serif / Mono, instant, page-wide | adapt | Default (Inter) and Serif (Literata); skip Mono |
| L5 | Almost monochrome UI; color is for content only; one saturated accent | adopt | Our color already belongs to marks and folders |
| L6 | 10 text colors and 10 pale backgrounds for page text | adapt | **Open:** use the Legend's highlight styles so a page's color means the same as a mark's, or a separate plain palette? |
| L7 | Popovers: soft, large-radius, low-opacity shadows; no hard outlines | adopt | |
| L8 | Every menu row has an icon; shortcuts right-aligned and muted | adopt | |

## Writing in a page

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| W1 | Everything is a block; **Turn into** changes a block's kind without losing its text (N10) | adopt | New; round 4 lacks it |
| W2 | Markdown shortcuts as you type: `# ` `## ` `### `, `- `, `1. `, `[] `, `---`, `**b**`, `*i*` | adopt | The files are Markdown already, so the shortcut is the file's own form |
| W3 | `> ` makes a toggle (Notion) | adapt | `> ` makes a quote, as in Markdown; a toggle comes from / or Turn into. `> [!question]` stays the question callout |
| W4 | / menu grouped (Suggested, Basic, …) with shortcut hints (N02–N04) | adopt | Round 4 S29's list, grouped: Basic (text, headings 1–3, lists, to-do, toggle, quote, divider, table, page) and **Study** (scripture, word, question, Saved thing, verse link) |
| W5 | Heading 4 | skip | Three levels are enough for a study page |
| W6 | Toggle list and toggle headings (N05) | adopt | Folding long passages and notes |
| W7 | Callout with an icon (N05) | adapt | The question callout is ours; a plain callout for "key point" is **open** |
| W8 | Code block, equation (N11, N13) | skip | Not Bible study |
| W9 | Selection bar: Turn into, bold, italic, underline, strike, link, color (N06) | adopt | Round 4 S29 has bold, italic, heading, link, highlight; add Turn into, underline, strike, color |
| W10 | Selection bar: inline code, equation, comment, AI actions | skip | Not study; no collaborators; no interpretation (AGENTS rule) |
| W11 | Selection bar: **Mark** (highlight with a Legend style) and **Margin note** on scripture text in a page | adapt | Wordbench's own; the same marks as the reader |
| W12 | Block handle (grip) menu: Turn into, Color, Copy link to block, Duplicate (Ctrl+D), Move to, Delete; last edited and word count at the foot (N07, N08) | adopt | New; "copy link to block" gives a link that opens this page at the block |
| W13 | Block menu: Comment, Suggest edits, Ask AI, Skills | skip | One person's study; no AI interpretation |
| W14 | Drag the grip to reorder blocks | adopt | Finding 64c7 ("dragging blocks does not work yet") |
| W15 | Select several blocks, then move, delete or turn them into one kind | adopt | Not in Notion's screenshots but expected; round 4 has several pages, not several blocks |
| W16 | Columns side by side | adopt | Round 4 S30 |
| W17 | @ mention: date and sub-page (N12) | adapt | @ offers a **verse** (inline reference that opens the reader), a page, a folder, and a date; people skipped |
| W18 | Ctrl+B/I/U, Ctrl+D, Ctrl+Z/Y, Esc, Tab/Shift+Tab on day one | adopt | Ctrl+Shift+M (comment) skipped |

## The page

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| P1 | Page ⋯ menu, searchable (N20): copy link, copy contents, duplicate, move to, version history, appearance, lock, move to Trash | adopt | Round 4 S31 is the page's ⋯; add copy contents, lock |
| P2 | Updates & analytics, Use with AI, Suggest edits, Notify me | skip | One person; no AI |
| P3 | Version history | adapt | Round 4's Page history (L-16) |
| P4 | Appearance: font, small text, full width, table of contents (N22, N23) | adopt | Table of contents useful for long lessons |
| P5 | Icon on a page | adopt | Helps find pages in the side list |
| P6 | Cover band and cover gallery (N23, N24) | **open** | Pleasant; images cost space; ask the person |
| P7 | Lock page (read-only) | adopt | Protects finished lessons |

## Finding and listing

| # | Line | Mark | Why / Wordbench's version |
|---|---|---|---|
| S1 | Ctrl+K quick search: recent pages, filters (in, title only), live preview pane (N21) | adapt | The Library's one search ([search](../search/README.md)) with a preview; Recents first |
| S2 | Side list groups Private / Shared / Recents | adapt | Round 4's groups; **open:** add Recents? |
| S3 | A database as a block with views: table, board, gallery, timeline, filter, sort, group (N14–N19) | adapt | A **list in a page** (Filters rows 14–15's saved list, a `view` fence): table view first; board, gallery, timeline skipped for now |
| S4 | Filter menu (N19) | adapt | The shared Filters panel (F1–F2) is the control a list in a page uses |

## Removed from the Notebook

| # | Line | Mark | Why |
|---|---|---|---|
| R1 | Days, Places, Questions (and Threads, Inbox, All) as tabs | skip | The person, 2026-11-20: a legacy workflow; round 4 already removed them (S27). Today stays a page you can show; questions are listed by the questions folder; a place is reached from the reader's margin |

## Open questions

- L6: page text colors from the Legend's styles, or a separate palette?
- W7: a plain callout besides the question callout?
- P6: covers on pages, yes or no?
- S2: a Recents group in the side list?
- Order of building: the feel and writing (F, W) before the side list and page ⋯ (round 4)?

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-20 | none | The inventory: adopt, adapt or skip for each Notion line, against round 4 of library | Pending |

## Directions

### Recommendation

Adopt the feel (F1–F10) and writing (W) lines whole: they are what makes Notion feel like Notion, and round 4 does
not have them. Then round 2 draws them on top of round 4's accepted windows (S28 page, S29 writing, S31 ⋯), so the
interaction table has one row per key, menu item and shortcut. Build order: one menu component (F3), then writing
(W1–W4, W9, W12, W14), then the page (P), then the side list (round 4 S25).
