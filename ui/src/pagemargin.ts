// A margin note written from scripture in a page (notebook design row 40, NB8): Margin note on the selection bar opens a card in the margin
// beside the selected words, with a grip to drag it. The note is that verse's margin note (`wb mark note`, kept in margin/<BOOK>/<chapter>.md),
// so the reader shows it too. References in its words are found as in a page (`wb refs --plain`) and drawn as the link chip of row 12 (the
// same module, chapterpanel.ts), which opens the compact chapter panel; the file keeps the plain words. Nothing is kept until the note has text.
import { wb, inApp } from './api';
import { h } from './ui';
import { refChip } from './chapterpanel';
import { toast } from './sheets';
import { app } from './app';
import type { Picked } from './pagescripture';

interface Found { start: number; end: number; ref: string; hash: string }

let open: HTMLElement | null = null;

/** The card's words with each reference a chip. */
async function words(text: string): Promise<DocumentFragment> {
  const f = document.createDocumentFragment();
  let found: Found[] = [];
  if (/\d/.test(text)) { try { found = await wb(['refs', '--plain', text]); } catch { found = []; } }
  const chars = [...text];
  let at = 0;
  for (const r of found) {
    if (r.start < at) continue;
    f.append(chars.slice(at, r.start).join(''));
    f.append(refChip(chars.slice(r.start, r.end).join(''), r.ref));
    at = r.end;
  }
  f.append(chars.slice(at).join(''));
  return f;
}

/** The verses the words lie in, as the place a note is made at: NUM.25:11 or NUM.25:11-13 (a note covers verses of one chapter). */
function placeOf(p: Picked): { place: string; label: string; v1: number } | null {
  if (p.from.c !== p.to.c) { toast('A margin note covers verses of one chapter'); return null; }
  const v1 = Math.min(p.from.v, p.to.v), v2 = Math.max(p.from.v, p.to.v);
  const book = p.box.closest('.nb-block')?.querySelector('.sv-ref')?.textContent?.replace(/\s*\d.*$/, '') || p.code;
  return { place: `${p.code}.${p.from.c}:${v1}${v2 > v1 ? `-${v2}` : ''}`, label: `${book} ${p.from.c}:${v1}${v2 > v1 ? `–${v2}` : ''}`, v1 };
}

export function closeMarginNote() { open?.remove(); open = null; }

/** The verse's own margin note, when it has one (the note whose place is exactly these verses), read from the reader's store. */
async function existingNote(at: { place: string; label: string }): Promise<{ id: string; text: string } | null> {
  try {
    const r = await wb(['mark', 'notes', at.label.replace(/:.*$/, '')]);
    const mine = (Array.isArray(r?.notes) ? r.notes : []).find((n: any) => n.at === at.place);
    return mine ? { id: String(mine.id), text: String(mine.text ?? '') } : null;
  } catch { return null; }
}

/** Open the verse's margin note beside the picked words: the one it has (to read and change), else an empty one. */
export async function startMarginNote(p: Picked, rect: DOMRect) {
  const at = placeOf(p);
  if (!at) return;
  const had = await existingNote(at);
  closeMarginNote();
  const card = h('section', 'pm-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', `Margin note at ${at.label}`);
  card.dataset.place = at.place;
  const grip = h('span', 'pm-grip');
  grip.title = 'Drag to move';
  grip.setAttribute('role', 'img');
  grip.setAttribute('aria-label', 'Drag the margin note');
  grip.textContent = '⠿';
  const title = h('span', 'pm-title', `Margin note · ${at.label}`);
  const close = h('button', 'pm-close', '×') as HTMLButtonElement;
  close.type = 'button';
  close.title = 'Close (Esc)';
  close.setAttribute('aria-label', 'Close');
  const head = h('header', 'pm-head');
  head.append(grip, title, close);
  const body = h('div', 'pm-body');
  card.append(head, body);
  document.body.append(card);
  open = card;

  // beside the words: to the right of the block they are in, level with them; where there is no room, over its right edge
  const block = p.box.closest<HTMLElement>('.nb-block')?.getBoundingClientRect() ?? rect;
  const w = card.offsetWidth || 280;
  const room = block.right + 12 + w <= innerWidth - 8;
  // with no room beside the block (a phone, a narrow pane) the card sits under the words instead
  const left = room ? block.right + 12 : Math.max(8, Math.min(rect.left, innerWidth - w - 8));
  const top = room ? Math.max(8, Math.min(rect.top, innerHeight - 120)) : Math.max(8, Math.min(rect.bottom + 8, innerHeight - 140));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;

  // the grip drags the card
  grip.onpointerdown = ev => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const sx = ev.clientX - card.offsetLeft, sy = ev.clientY - card.offsetTop;
    grip.setPointerCapture(ev.pointerId);
    const move = (e: PointerEvent) => {
      card.style.left = `${Math.max(0, Math.min(e.clientX - sx, innerWidth - card.offsetWidth))}px`;
      card.style.top = `${Math.max(0, Math.min(e.clientY - sy, innerHeight - 40))}px`;
    };
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); card.classList.remove('moving'); };
    card.classList.add('moving');
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  };

  let id = had?.id ?? '';
  let text = had?.text ?? '';
  let busy = false;
  const view = async () => {
    body.replaceChildren();
    const line = h('p', 'pm-text');
    line.tabIndex = 0;
    line.title = 'Click to change the words';
    line.append(await words(text));
    line.onclick = ev => { if ((ev.target as HTMLElement).closest('a')) return; write(); };
    line.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); write(); } };
    body.append(line);
  };
  const write = () => {
    const ta = h('textarea', 'pm-edit') as HTMLTextAreaElement;
    ta.rows = 3;
    ta.value = text;
    ta.setAttribute('aria-label', id ? 'Edit the margin note' : `Write a margin note at ${at.label}`);
    let done = false;
    const finish = async (andClose: boolean) => {
      if (done) return;
      done = true;
      const now = ta.value.replace(/\s+$/, '');
      if (!now.trim() || now === text) { if (id) await view(); else body.replaceChildren(); if (andClose || !id) closeMarginNote(); return; }
      if (busy) return;
      busy = true;
      try {
        if (!id) {
          const made = await wb(['mark', 'note', at.place, now]);
          id = made?.id || 'made';
        } else await wb(['mark', 'note', id, '--text', now]);
        text = now;
        if (inApp) void app.refreshMarks();
      } catch (x) { toast(String((x as Error)?.message ?? x)); busy = false; done = false; return; }
      busy = false;
      if (andClose) closeMarginNote(); else await view();
    };
    ta.onkeydown = ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); void finish(true); }
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); void finish(false); }
    };
    ta.onblur = () => window.setTimeout(() => { if (document.activeElement !== ta && !done) void finish(false); }, 0);
    body.replaceChildren(ta);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
  };
  close.onclick = () => {
    const ta = body.querySelector<HTMLTextAreaElement>('textarea');
    if (ta) { ta.onblur = null; ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); } else closeMarginNote();
  };
  card.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !body.querySelector('textarea')) { ev.stopPropagation(); closeMarginNote(); } });
  if (id) await view(); else write();
}
