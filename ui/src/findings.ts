// Findings about the app (note 50c1, decided 2026-11-06): the person's own debug place while the app is built. Ctrl+Shift+J
// (or `finding <words>`) writes one, with what was on screen kept beside it: the size, the window, the panes open, the
// place, the version, the build. They live in findings/ in the study folder, apart from the study (the Notebook does
// not list them; the Python app passes over the folder), and a development session reads them with `wb findings`.
//
// Files attached to a finding (debug round C1, finding b737): dropped on the box, pasted into it (a screenshot), or picked
// with Browse. They are copied into findings/<id>/ (wb finding attach); the person's own file stays where it was. Tauri's
// file-drop handler is off (M1, so the page's own drags work), and with it off WebView2 hands the page an ordinary HTML5
// drop whose File objects the page reads, so the bytes go to Rust as they are (attachToFinding).
import { attachToFinding, wb } from './api';
import { app, here } from './app';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, icon, movable, sizeClass } from './ui';

/** The most one attached file may hold (wb-core's findings::MAX_ATTACH_BYTES says the same). */
export const MAX_FILE_MB = 10;
const MAX_FILE = MAX_FILE_MB * 1024 * 1024;

const sizeText = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const isFileDrag = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

// A file let go anywhere else in the window would make the web view open it in place of the app (the reader's place
// lost): with Tauri's handler off, nothing else stops it. Only a drop zone (.file-drop) takes a file.
document.addEventListener('dragover', e => {
  if (!isFileDrag(e) || e.defaultPrevented) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'none';
});
document.addEventListener('drop', e => { if (isFileDrag(e)) e.preventDefault(); });

/** A pasted picture is called image.png by the clipboard: it gets the time it was pasted instead. */
function pastedName(f: File): string {
  if (f.name && f.name !== 'image.png') return f.name;
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
  return `pasted ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

/** Files that can be kept (and a word for those over the cap). */
function within(files: File[]): File[] {
  const over = files.filter(f => f.size > MAX_FILE);
  if (over.length) toast(`${over.map(f => f.name).join(', ')}: over the limit (a finding's file can be ${MAX_FILE_MB} MB at most)`);
  return files.filter(f => f.size <= MAX_FILE);
}

/** Attaches files to a finding that is written; → how many were kept, and what to say of those that were not (the rest
 *  still go). */
async function attachAll(id: string, files: { name: string; file: Blob }[]): Promise<{ kept: number; failed: string }> {
  let kept = 0;
  const failed: string[] = [];
  for (const f of files) {
    try { await attachToFinding(id, f.name, await f.file.arrayBuffer()); kept++; } catch (x) { failed.push(`${f.name}: ${x}`); }
  }
  return { kept, failed: failed.length ? `Not attached — ${failed.join('; ')}` : '' };
}

/** Makes `el` take dropped files: `take` gets them; the element is marked while a file is over it. */
function dropZone(el: HTMLElement, take: (files: File[]) => void) {
  el.classList.add('file-drop');
  let depth = 0;
  el.addEventListener('dragenter', e => { if (!isFileDrag(e)) return; e.preventDefault(); depth++; el.classList.add('drop-on'); });
  el.addEventListener('dragover', e => { if (!isFileDrag(e)) return; e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; });
  el.addEventListener('dragleave', e => { if (!isFileDrag(e)) return; if (--depth <= 0) { depth = 0; el.classList.remove('drop-on'); } });
  el.addEventListener('drop', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    el.classList.remove('drop-on');
    const files = Array.from(e.dataTransfer!.files);
    if (files.length) take(files);
  });
}

/** A hidden file picker; `pick()` opens it. */
function picker(take: (files: File[]) => void): { input: HTMLInputElement; pick: () => void } {
  const input = h('input', 'file-pick') as HTMLInputElement;
  input.type = 'file';
  input.multiple = true;
  input.hidden = true;
  input.onchange = () => { const files = Array.from(input.files ?? []); input.value = ''; if (files.length) take(files); };
  return { input, pick: () => input.click() };
}

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

export async function addFinding(text: string, files: { name: string; file: Blob }[] = []): Promise<string> {
  const f = await wb(['finding', 'add', '-', '--context', JSON.stringify(screenContext())], text);
  const { kept, failed } = files.length ? await attachAll(f.id, files) : { kept: 0, failed: '' };
  app.changed('findings');
  return `Finding kept (${String(f.id).slice(-4)})${kept ? ` with ${kept} file${kept === 1 ? '' : 's'}` : ''}: Findings lists it${failed ? `. ${failed}` : ''}`;
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
  // the files to attach once it is kept: dropped on the box, pasted (a screenshot), or picked with Browse
  const pending: { name: string; file: File }[] = [];
  const chips = h('div', 'finding-files');
  const drawChips = () => {
    chips.replaceChildren();
    for (const p of pending) {
      const c = h('span', 'file-chip');
      c.append(icon('file', 14), h('span', 'file-chip-name', p.name), h('span', 'muted small', sizeText(p.file.size)));
      const x = button('icon-btn file-chip-x', '', () => { pending.splice(pending.indexOf(p), 1); drawChips(); input.focus(); }, 'x');
      x.setAttribute('aria-label', `Leave out ${p.name}`);
      c.append(x);
      chips.append(c);
    }
    box.classList.toggle('has-files', pending.length > 0);
  };
  const take = (files: File[], named = (f: File) => f.name) => { for (const f of within(files)) pending.push({ name: named(f), file: f }); drawChips(); input.focus(); };
  dropZone(box, files => take(files));
  input.addEventListener('paste', e => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    take(files, pastedName);
  });
  const pick = picker(files => take(files));
  const attach = h('div', 'finding-attach');
  attach.append(h('span', 'muted small', `Drop files here or paste a picture (${MAX_FILE_MB} MB each at most)`), h('span', 'grow'), button('link-btn finding-browse', 'Browse…', () => pick.pick(), 'file'), pick.input);
  const foot = h('div', 'capture-foot');
  foot.append(h('span', 'muted small finding-ctx', `${ctx.size} ${ctx.window} · ${ctx.place} · ${ctx.panes.length} panes · ${ctx.build}`), h('span', 'grow'), h('span', 'muted small', 'Enter keeps it · Shift+Enter: a new line'));
  box.append(head, input, chips, attach, foot);
  document.getElementById('overlay')!.append(box);
  const w = Math.min(520, innerWidth - 24);
  Object.assign(box.style, { width: `${w}px`, left: `${Math.round((innerWidth - w) / 2)}px`, top: '90px' });
  // moved by its head, and opens where it was last left (finding 707d)
  movable(box, head, 'wb.findingBox.at');
  const close = () => { box.remove(); if (boxEl === box) boxEl = null; document.removeEventListener('pointerdown', outside, true); };
  // a click elsewhere closes it only while nothing is written, so what was written is never lost to a stray click
  const outside = (e: PointerEvent) => { if (!box.contains(e.target as Node) && !input.value.trim() && !pending.length) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  let busy = false;
  input.onkeydown = async e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { if (pending.length) toast('A finding needs some words as well as its files'); return; }
    // the files take a moment to copy: a second Enter meanwhile does not write the finding twice
    if (busy) return;
    busy = true;
    try { const said = await addFinding(text, pending); close(); toast(said); } catch (x) { toast(String(x)); } finally { busy = false; }
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
      // its attached files (findings/<id>/): a click opens one; a file dropped on the card, or Attach…, adds one
      const files: { name: string; size: number }[] = f.files ?? [];
      const row = h('div', 'finding-files');
      for (const file of files) {
        const chip = h('span', 'file-chip');
        const open = button('link-btn file-chip-open', '', async () => {
          try {
            const r = await wb(['finding', 'open', f.id, file.name]);
            toast(r?.shown_in_folder ? `${file.name} is a program or a script: shown in its folder, not run` : `Opening ${r?.name ?? file.name}…`);
          } catch (x) { toast(String(x)); }
        }, 'file');
        open.append(h('span', 'file-chip-name', file.name));
        open.title = `Open ${file.name}`;
        const x = button('icon-btn file-chip-x', '', async () => {
          if (!confirm(`Take ${file.name} off this finding? It goes to .trash in the study folder.`)) return;
          try { await wb(['finding', 'detach', f.id, file.name]); app.changed('findings'); } catch (err) { toast(String(err)); }
        }, 'x');
        x.setAttribute('aria-label', `Take ${file.name} off`);
        chip.append(open, h('span', 'muted small', sizeText(file.size)), x);
        row.append(chip);
      }
      const add = async (list: File[]) => {
        const ok = within(list);
        if (!ok.length) return;
        const r = await attachAll(f.id, ok.map(file => ({ name: file.name, file })));
        if (r.kept) app.changed('findings');
        if (r.failed) toast(r.failed);
      };
      const pick = picker(list => void add(list));
      row.append(button('link-btn finding-attach-more', files.length ? 'Attach…' : 'Attach a file…', () => pick.pick(), 'plus'), pick.input);
      dropZone(c, list => void add(list));
      c.append(row);
      const x = f.context;
      if (x) c.append(h('p', 'muted small finding-ctx', [x.size && `${x.size} ${x.window ?? ''}`, x.place, x.version, x.panes?.length ? `panes: ${x.panes.join(', ')}` : '', x.build && `build ${x.build}`].filter(Boolean).join(' · ')));
      el.append(c);
    }
  });
}
