// What is on a verse, in its card (design/features/marks T12, row 53, MK7-23): every mark on the verse and the margin notes
// covering it. One call, `wb mark at <place>` ({marks, notes}). The reader's verse card (hover and the phone's sheet), the
// verse card a page's scripture block opens, and the card from a reference in a note all show this section; it stays hidden
// when the verse has neither. It only lists what was written (no suggestions, MK-10).
import { wb } from './api';
import { app } from './app';
import { sampleOf, type Kind } from './markbar';
import { closeSheet, hideCard } from './sheets';
import { h } from './ui';

const KIND_NAME: Record<string, string> = { highlight: 'highlight', underline: 'underline', circle: 'circle', box: 'box', arrow: 'arrow' };

/** A section that fills itself with the marks and margin notes at `place` (an anchor or a reference). */
export function marksOnVerse(place: string): HTMLElement {
  const box = h('div', 'vm');
  box.hidden = true;
  void (async () => {
    let at: any;
    try { at = await wb(['mark', 'at', place]); } catch { return; }
    const marks: any[] = Array.isArray(at?.marks) ? at.marks : [];
    const notes: any[] = Array.isArray(at?.notes) ? at.notes : [];
    if (!marks.length && !notes.length) return;
    if (marks.length) {
      box.append(h('div', 'vm-head', marks.length === 1 ? '1 mark' : `${marks.length} marks`));
      for (const m of marks) {
        const row = h('div', 'vm-mark');
        row.dataset.mark = m.id;
        row.append(sampleOf(m.kind as Kind, m.color, m.lines), h('span', 'vm-legend', `${m.legend ?? ''}`), h('span', 'muted small', KIND_NAME[m.kind] ?? m.kind));
        box.append(row);
      }
    }
    if (notes.length) {
      box.append(h('div', 'vm-head', notes.length === 1 ? '1 margin note' : `${notes.length} margin notes`));
      for (const n of notes) {
        const b = h('button', 'vm-note');
        b.type = 'button';
        b.dataset.note = n.id;
        b.title = `Open ${n.label} in the reader, with its margin note`;
        b.append(h('span', 'vm-where', n.label), h('span', 'vm-text muted', String(n.text || '').split('\n')[0]));
        b.onclick = () => { hideCard(); closeSheet(); void app.showMarginNote(n.id, n.at); };
        box.append(b);
      }
    }
    box.hidden = false;
  })();
  return box;
}
