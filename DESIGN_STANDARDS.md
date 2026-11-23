# Design standards

Builders read this before building anything the person sees, and reviewers check against it. It is also the list the
"**You feel:**" line of a feature's *what must be true* draws on. A rule a machine checks names its check; the rest is
judged when the person plays the prototype. Words: [GLOSSARY.md](GLOSSARY.md#development-words).

**Sources:** WCAG 2.2 at level AA; Jakob Nielsen's 10 usability heuristics and his response-time limits; Microsoft's
Windows app design guidelines; Apple's Human Interface Guidelines. Checked by machine where possible (axe, in the full suite as
`ui/tests/axe.spec.ts`; the speed
budgets in `measure/measure.mjs`); the rest when the person plays.

## The feel qualities

Every item of every feature has all seven by default. Its "**You feel:**" line names only the one or two most at risk
for that item, plus anything the person's play revealed. At the prototype the person judges the named ones; at build,
each quality with a bar gets a machine check; the release feel check covers only the lines marked "checked at play". The
set grows only through retros.

| Quality | What it means | Standard | Bar and check |
|---|---|---|---|
| **Instant** | The screen answers the hand at once: a click, a key, a drag. | Nielsen: 0.1 s feels instant. | Under 0.1 s, with the CPU slowed 4× (`measure/measure.mjs`). |
| **Quick** | A bigger job (a search, a document) finishes without a wait the person notices. | Nielsen: 1 s keeps the flow of thought. | Under 1 s; over 1 s shows progress. Measured the same way. |
| **Steady** | Nothing flashes, jumps or moves on its own: no older view shown for a moment, no text shifting as it loads. | Windows and Apple guidelines on motion. | No layout shift after an action settles (a no-shift check in the spec; ticket to come). |
| **Clear** | Every action has a visible result, and the person can tell where they are. | Nielsen #1, visibility of system status. | Judged at play. |
| **Forgiving** | A mistake can be taken back: Undo, or a confirm before what cannot be undone. | Nielsen #3, user control and freedom; #5, error prevention. | Judged at play; a destructive action without Undo or a confirm fails review. |
| **Familiar** | Keys, drags and menus behave the way Windows and the Mac do: Enter, Esc, Tab, Ctrl/⌘+Z, drag to move. | Nielsen #4, consistency and standards; the platform guidelines. | Judged at play. |
| **Readable** | Text and controls can be seen and reached by everyone. | WCAG 2.2 AA. | Text contrast 4.5:1 (3:1 for large text and controls); every control has a name; axe finds nothing (ticket 4). |

## Readable, in detail (WCAG 2.2 AA)

- **Contrast:** body text 4.5:1 or more; large text, icons and control edges 3:1. *Check: axe (ticket 4).*
- **Names:** every button, field and icon has a name a screen reader reads. *Check: axe (ticket 4).*
- **Keyboard:** everything a mouse can do, a keyboard can do, and the focus is always visible. *Check: the specs drive
  the keyboard; judged at play.*
- **Targets:** anything clicked or tapped is at least 24 × 24 px (WCAG 2.5.8). *Check: axe (ticket 4).*
- **Dragging has another way** (WCAG 2.5.7): a block that can be dragged can also be moved by a command or a menu.

## Speed budgets

From the phone-size window with the web view's CPU slowed 4× (`npm run measure`, after `npx tauri build --no-bundle`):
cold start to the last place under 1.5 s; a chapter drawn under 100 ms; a tap card under 100 ms; a plain search under
50 ms; no dropped frames scrolling Psalm 119 with marks on.

## Nielsen's heuristics, the other six

The four above are in the feel qualities. The rest are checked in review and at play:

- **#2 Match the real world:** the person's words (from [the Library map](design/LIBRARY.md)), never the code's.
- **#6 Recognition over recall:** what can be done is shown, not remembered.
- **#7 Flexibility:** keys and `wb` commands for the practised; the visible way for everyone.
- **#8 Minimal design:** nothing on screen that the task does not need.
- **#9 Help with errors:** a message says what happened and what to do, in plain words.
- **#10 Help and documentation:** a feature that needs explaining explains itself where it is used.

## The rules that never change, for design

- **Scripture is shown verbatim, with its reference**, never paraphrased or summarized.
- **No interpretation:** the app shows the source text, the person's own notes and lookups; nothing suggested.
- **Never lose the reader's place:** anything opened from the text returns to the verse it came from.
