// The mark card (design/features/marks T8, MK7-19, MK7-20; rows 25 to 28). A click on words that carry a mark opens a small
// card beside them (a bottom sheet on a phone, the reader's own sheet): not draggable, closed by Esc or a click away. It
// lists every mark there, topmost first as `wb mark at` gives them, each with its style sample, legend name and date, Change
// and Delete. Change opens that kind's drop-down (the bar's own rows) and replaces that one mark's style (`wb mark style`);
// Delete runs `wb mark rm` and offers Undo for 10 seconds (`wb mark restore`). Look up is the way on to the word's own card.
import { wb, type DrawnMark } from './api';
import { h, icon } from './ui';
import { openSheet, closeSheet, hideCard, toast, toastUndo } from './sheets';
import { changeMenu, sampleOf, type Kind } from './markbar';

export interface CardEnv {
  /** The word as a place (`NUM.25:11.3`), for `wb mark at`. */
  place: string;
  /** The marks the reader holds on the word: used when the core cannot be asked. */
  local: DrawnMark[];
  chapterMarks(): DrawnMark[];
  /** A mark's style was replaced: the core's answer. */
  restyled(m: DrawnMark): void;
  removed(id: string): void;
  restored(m: DrawnMark): void;
  /** Look up the word (its card, or the Concordance, as a plain click does with no mark there). */
  lookup(): void;
}

const LAYER: Record<string, number> = { arrow: 0, underline: 1, circle: 2, box: 2, highlight: 3 };
/** Topmost first, as `wb mark at` orders them: by layer, the newest first within one. */
const topmost = (l: DrawnMark[]) => [...l].reverse().sort((a, b) => (LAYER[a.kind] ?? 3) - (LAYER[b.kind] ?? 3) || (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
const day = (s: string) => s.slice(0, 10);

export async function openMarkCard(from: HTMLElement, env: CardEnv): Promise<void> {
  hideCard();
  let list: DrawnMark[] = env.local.length ? topmost(env.local) : [];
  try {
    const at = await wb(['mark', 'at', env.place]);
    if (Array.isArray(at?.marks) && at.marks.length) list = at.marks.filter((m: DrawnMark) => m.kind !== 'arrow');
  } catch { /* the reader's own marks stand */ }
  if (!list.length) return;
  const body = h('div', 'mark-card');
  body.dataset.markcard = '';
  const shut = () => closeSheet();
  const render = () => {
    body.replaceChildren();
    for (const m of list) body.append(entry(m));
    const look = h('button', 'mc-look', 'Look up the word');
    look.type = 'button';
    look.onclick = () => { shut(); env.lookup(); };
    body.append(h('hr', 'mc-rule'), look);
  };

  function entry(m: DrawnMark): HTMLElement {
    const box = h('div', 'mc-mark');
    box.dataset.mark = m.id;
    box.dataset.kind = m.kind;
    const head = h('div', 'mc-head');
    const sam = sampleOf(m.kind as Kind, m.color, m.lines);
    sam.classList.add('mc-sample');
    const text = h('div', 'mc-text');
    text.append(h('div', 'mc-name', m.legend || `Unnamed ${m.color} ${m.kind}`), h('div', 'mc-date muted small', m.changed ? `${day(m.created)} · changed ${day(m.changed)}` : day(m.created)));
    const change = h('button', 'mc-change', 'Change');
    change.type = 'button';
    change.setAttribute('aria-expanded', 'false');
    const del = h('button', 'mc-delete');
    del.type = 'button';
    del.title = 'Delete';
    del.setAttribute('aria-label', 'Delete');
    del.append(icon('trash', 16));
    head.append(sam, text, change, del);
    box.append(head);
    if (m.words !== undefined) box.append(h('div', 'mc-hint muted small', 'An old highlight: only its color can change.'));

    let drop: HTMLElement | null = null;
    change.onclick = async () => {
      if (drop) { drop.remove(); drop = null; change.setAttribute('aria-expanded', 'false'); return; }
      change.setAttribute('aria-expanded', 'true');
      const menu = await changeMenu(m.kind as Kind, env.chapterMarks, s => void restyle(m, s));
      if (drop || change.getAttribute('aria-expanded') !== 'true') return;
      drop = h('div', 'mc-drop');
      drop.append(menu);
      box.append(drop);
    };
    del.onclick = () => void remove(m);
    return box;
  }

  async function restyle(m: DrawnMark, s: { kind: Kind; color: string; lines?: number }) {
    try {
      // an old highlight keeps its kind (the core says so): only its color goes
      const args = m.words !== undefined ? ['--color', s.color] : ['--kind', s.kind, '--color', s.color, ...(s.kind === 'underline' ? ['--lines', String(s.lines ?? 1)] : [])];
      const out = await wb(['mark', 'style', m.id, ...args]);
      const now = { ...m, ...out } as DrawnMark;
      now.style = now.kind === 'underline' ? `underline:${now.color}:${now.lines ?? 1}` : `${now.kind}:${now.color}`;
      try { now.legend = (await wb(['mark', 'show', m.id]))?.legend; } catch { now.legend = `Unnamed ${now.color} ${now.kind}`; }
      env.restyled(now);
      shut();
    } catch (x) { toast(String((x as Error)?.message ?? x)); }
  }

  async function remove(m: DrawnMark) {
    try {
      await wb(['mark', 'rm', m.id]);
    } catch (x) { toast(String((x as Error)?.message ?? x)); return; }
    env.removed(m.id);
    list = list.filter(x => x.id !== m.id);
    if (list.length) render(); else shut();
    toastUndo('Mark deleted ·', async () => {
      try { await wb(['mark', 'restore', m.id]); env.restored(m); } catch (x) { toast(String((x as Error)?.message ?? x)); }
    });
  }

  render();
  // a click away closes it (on a phone the sheet's scrim does; beside the words there is none, so the page listens)
  const away = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.mark-card-panel, .toast')) closeSheet(); };
  const panel = openSheet(body, from, { stays: true, closed: () => document.removeEventListener('pointerdown', away, true) });
  panel.classList.add('mark-card-panel');
  setTimeout(() => { if (panel.isConnected) document.addEventListener('pointerdown', away, true); });
}
