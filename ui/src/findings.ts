// Findings about the app (note 50c1, decided 2026-11-06): the person's own debug place while the app is built. Ctrl+Shift+J
// (or `finding <words>`) writes one, with what was on screen kept beside it: the size, the window, the panes open, the
// place, the version, the build. They live in findings/ in the study folder, apart from the study (the Notebook does
// not list them; the Python app passes over the folder), and a development session reads them with `wb findings`.
import { wb } from './api';
import { app, here } from './app';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, movable, sizeClass } from './ui';

declare const __WB_BUILD__: string;
export const BUILD = typeof __WB_BUILD__ === 'string' ? __WB_BUILD__ : 'dev';

/** What is on screen now, kept with a finding. */
export function screenContext() {
  const input = document.documentElement.dataset.input || 'auto';
  return {
    size: sizeClass(), window: `${innerWidth}×${innerHeight}`, input, touch: navigator.maxTouchPoints > 0,
    panes: dock.describe().map(p => `${p.title} (${p.side}${p.front ? '' : ', behind'})`),
    place: here().label, version: app.version(), build: BUILD,
  };
}

export async function addFinding(text: string): Promise<string> {
  const f = await wb(['finding', 'add', '-', '--context', JSON.stringify(screenContext())], text);
  app.changed('findings');
  return `Finding kept (${String(f.id).slice(-4)}): Findings lists it`;
}

let boxEl: HTMLElement | null = null;

/** Ctrl+Shift+J: a small box for a finding, from anywhere; Enter keeps it, Esc closes. */
export function findingBox() {
  boxEl?.remove();
  const box = h('div', 'capture finding-box');
  boxEl = box;
  const ctx = screenContext();
  const head = h('div', 'capture-head');
  const shut = button('icon-btn finding-close', '', () => close(), 'x');
  shut.setAttribute('aria-label', 'Close without keeping it');
  head.append(h('span', 'capture-title', 'A finding about the app'), h('span', 'grow'), h('kbd', '', 'Ctrl+Shift+J'), shut);
  const input = h('textarea', 'capture-field finding-field') as HTMLTextAreaElement;
  input.rows = 2;
  input.placeholder = 'What did you notice? (kept apart from your study)';
  const foot = h('div', 'capture-foot');
  foot.append(h('span', 'muted small finding-ctx', `${ctx.size} ${ctx.window} · ${ctx.place} · ${ctx.panes.length} panes · ${ctx.build}`), h('span', 'grow'), h('span', 'muted small', 'Enter keeps it · Shift+Enter: a new line'));
  box.append(head, input, foot);
  document.getElementById('overlay')!.append(box);
  const w = Math.min(520, innerWidth - 24);
  Object.assign(box.style, { width: `${w}px`, left: `${Math.round((innerWidth - w) / 2)}px`, top: '90px' });
  // moved by its head, and opens where it was last left (finding 707d)
  movable(box, head, 'wb.findingBox.at');
  const close = () => { box.remove(); if (boxEl === box) boxEl = null; document.removeEventListener('pointerdown', outside, true); };
  // a click elsewhere closes it only while nothing is written, so what was written is never lost to a stray click
  const outside = (e: PointerEvent) => { if (!box.contains(e.target as Node) && !input.value.trim()) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  input.onkeydown = async e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    try { const said = await addFinding(text); close(); toast(said); } catch (x) { toast(String(x)); }
  };
  input.focus();
}

let showHandled = false;

/** The Findings pane: the open findings, newest first, each with what was on screen; Handled, Open again, Delete. */
export function openFindings() {
  return dock.open('findings', 'Findings', 'findings', 'right', async el => {
    const d = await wb(['findings', ...(showHandled ? ['--all'] : [])]);
    el.replaceChildren();
    const hd = h('header', 'pane-head');
    hd.append(h('h2', 'pane-title', 'Findings'), h('div', 'pane-sub', `About the app, apart from your study · ${d.counts.open} open, ${d.counts.handled} handled · wb findings`));
    el.append(hd);
    const acts = h('div', 'wrap findings-acts');
    acts.append(button('btn small primary', '+ A finding', () => findingBox()));
    acts.append(button('btn small', showHandled ? 'Only the open ones' : 'Show the handled too', () => { showHandled = !showHandled; void dock.find('findings')?.refresh?.(); }));
    el.append(acts);
    if (!d.findings.length) el.append(h('p', 'muted small', showHandled ? 'No findings yet.' : 'No open findings. Ctrl+Shift+J writes one from anywhere.'));
    for (const f of d.findings) {
      const c = h('div', `note-card finding${f.status === 'handled' ? ' done' : ''}`);
      c.dataset.id = f.id;
      const top = h('div', 'nb-top');
      top.append(h('span', 'pill', f.status === 'handled' ? '✓ Handled' : 'Open'), h('span', 'muted small', ` ${new Date(f.created).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${String(f.id).slice(-4)}`), h('span', 'grow'));
      const flip = async () => { await wb(['finding', 'handled', f.id, ...(f.status === 'handled' ? ['--open'] : [])]); app.changed('findings'); };
      top.append(button('link-btn', f.status === 'handled' ? 'Open again' : '✓ Handled', flip));
      top.append(button('link-btn danger', 'Delete', async () => {
        if (!confirm('Delete this finding? It goes to .trash in the study folder.')) return;
        await wb(['finding', 'rm', f.id]);
        app.changed('findings');
      }, 'trash'));
      c.append(top, h('p', 'nb-text', f.text));
      const x = f.context;
      if (x) c.append(h('p', 'muted small finding-ctx', [x.size && `${x.size} ${x.window ?? ''}`, x.place, x.version, x.panes?.length ? `panes: ${x.panes.join(', ')}` : '', x.build && `build ${x.build}`].filter(Boolean).join(' · ')));
      el.append(c);
    }
  });
}
