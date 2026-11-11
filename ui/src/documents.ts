// Word and PDF exports, and the records that keep them up to date (wb docs …, wb craft …).
import { wb } from './api';
import { app } from './app';
import type { Side } from './dock';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, popMenu } from './ui';
import { adjust, type Chosen } from './looks';
import { makeFromPage, previewDoc } from './pagedocs';

const MINE: Side = 'right';

/** What each made here is, as the Make menu offers it: [to (craft word|deck), structure, label, what it is]. */
export const KINDS: [string, string, string, string][] = [
  ['word', 'script', 'Speaker Script', 'Word: everything in large print, with a cue where each slide comes up'],
  ['word', 'share', 'Share Copy', 'Word: speech and scriptures, to send to a friend; no notes'],
  ['word', 'study', 'Study Sheet', 'Word: each passage with your notes and lines to write on'],
  ['word', 'reading', 'Reading Sheet', 'Word: only the scriptures, in two columns'],
  ['deck', 'verse', 'Verse by Verse', 'Slides as PDF pages: one verse to a slide, your highlights showing'],
  ['deck', 'reader', 'Reader', 'Slides as PDF pages: scripture only, each verse alone'],
];

const STATES: Record<string, [string, string]> = {
  current: ['Up to date', 'ok'],
  behind: ['Out of date', 'warn'],
  edited: ['Changed by hand', 'warn'],
  old_design: ['Old design', 'muted'],
  missing: ['File missing', 'warn'],
  gone: ['Its source is gone', 'muted'],
  unreadable: ['Cannot read its source', 'warn'],
  forgotten: ['Not kept up to date', 'muted'],
  elsewhere: ['Kept by the Python app', 'muted'],
};

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

type ExportSource = { kind: 'thread' | 'lesson' | 'passage'; name: string; version?: string };
type ExportOptions = { structure?: string; theme?: string; look?: string; ink?: string; dials?: [string, string][]; newCopy?: boolean; format?: string };

function sourceArgs(source: ExportSource): string[] {
  return [`--${source.kind}`, source.name, ...(source.version ? ['--version', source.version] : [])];
}

/** Make or bring up to date a document from the given source. */
export async function makeDoc(source: ExportSource, to: string, { structure, theme, look, ink, dials = [], newCopy, format }: ExportOptions = {}): Promise<string> {
  const argv = ['craft', to, ...(format === 'pptx' && to === 'deck' ? ['--format', format] : []), ...sourceArgs(source)];
  if (structure) argv.push('--structure', structure);
  if (theme) argv.push('--theme', theme);
  if (look) argv.push('--look', look);
  if (ink) argv.push('--set', `ink=${ink}`);
  if (newCopy) argv.push('--new');
  for (const [k, v] of dials) argv.push('--set', `${k}=${v}`);
  const r = await wb(argv);
  app.changed('documents');
  if (!r.changed) return `${r.name} is already up to date`;
  const checked = r.checked?.verses ? `, every verse checked (${r.checked.verses})` : '';
  return `Made ${r.name}${checked}${r.kept_now ? `; your edits were kept as ${r.kept_now}` : ''}`;
}

async function act(argv: string[], said: (r: any) => string) {
  try {
    const r = await wb(argv);
    app.changed('documents');
    toast(said(r));
  } catch (e) {
    toast(String((e as Error).message || e));
  }
}

/** One document: its name, how it stands, when it was made, and what can be done with it. */
function docRow(d: any): HTMLElement {
  const row = h('div', `doc-row state-${d.state}`);
  row.dataset.id = d.id;
  const main = h('div', 'doc-main');
  const name = button('doc-name', d.name, () => act(['docs', 'open', d.id], () => `Opened ${d.name}`));
  name.title = d.exists ? `Open ${d.path}` : 'The file is not there; Update makes it again';
  const [label, tone] = STATES[d.state] || [d.state, 'muted'];
  const meta = h('div', 'doc-meta muted small');
  meta.append(h('span', `doc-state tone-${tone}`, label), document.createTextNode(` · ${d.theme || ''}${d.built ? ` · made ${when(d.built)}` : ''}`));
  main.append(name, meta);
  if (d.problem) main.append(h('div', 'muted small', d.problem));
  if (d.kept?.length) main.append(h('div', 'muted small', `Your edits kept as ${d.kept.join(', ')}`));
  const acts = h('div', 'doc-acts');
  const pptx = d.to === 'deck';
  const here = ['thread', 'page', 'passage', 'lesson'].includes(d.source?.kind) && ((d.to === 'word' && d.structure === 'script') || (d.to === 'pdf' && d.structure === 'verse')
    || (pptx && ['reader', 'verse'].includes(d.structure))
    || (d.design && ((d.to === 'word' && ['share', 'study', 'reading'].includes(d.structure)) || (d.to === 'pdf' && d.structure === 'reader'))));
  if (!here && !d.problem) main.append(h('div', 'muted small', 'This legacy structure is available as its existing file.'));
  if (here && ['behind', 'missing', 'edited', 'old_design'].includes(d.state)) {
    acts.append(button('btn small primary doc-update', 'Update', () => act(['docs', 'update', d.id], r => r.changed ? `Updated ${r.name}` : `${r.name} is up to date`)));
  }
  const more = button('icon-btn doc-more', '', () => {
    const box = h('div', 'menu-list');
    const item = (lbl: string, fn: () => void) => box.append(button('menu-item', lbl, () => { close(); fn(); }));
    if (pptx && d.pdf) item('Open saved PDF preview', () => void wb(['docs', 'open-preview', d.id]).catch(e => toast(String(e.message || e))));
    else if (here && d.exists && !pptx) item('Preview it here', () => previewDoc(d));
    if (here && d.state !== 'forgotten') item('Make again now', () => act(['docs', 'update', d.id, '--force'], r => `Made ${r.name} again`));
    if (d.state === 'forgotten') item('Keep it up to date again', () => act(['docs', 'remember', d.id], r => `${r.name}: ${STATES[r.state]?.[0] || r.state}`));
    else item('Stop keeping it up to date', () => act(['docs', 'forget', d.id], () => `${d.name} is left as it is from now on`));
    item('Delete…', () => {
      if (!confirm(`Delete ${d.name}? The file${d.kept?.length ? ' and your kept copies' : ''} are erased from the computer; its record goes to the study folder's .trash.`)) return;
      void act(['docs', 'delete', d.id], r => `Deleted ${r.deleted.length ? r.deleted.join(', ') : d.name}`);
    });
    const close = popMenu(more, box, { align: 'right', width: 260 });
  }, 'more');
  more.setAttribute('aria-label', `More for ${d.name}`);
  acts.append(more);
  row.append(main, acts);
  return row;
}

/** A Look picker (R3, sheet D9) and the Ink dial (D10), shared by the Make row and Make a document. */
export function lookFields(looks: any): { look: HTMLSelectElement; ink: HTMLSelectElement } {
  const look = h('select', 'field doc-look') as HTMLSelectElement;
  for (const l of looks?.looks || []) look.append(new Option(l.name, l.key));
  look.value = looks?.saved || 'preview';
  look.title = 'The Look: fonts, accent, size and spacing (wb docs looks)';
  const ink = h('select', 'field doc-ink') as HTMLSelectElement;
  ink.append(new Option('Full color', ''), new Option('Ink saver', 'saver'), new Option('Black only', 'black'));
  ink.title = 'Ink: for printing. Saver: greys, no rules, highlights underlined. Black only: black and white.';
  return { look, ink };
}

/** The Make row's last choices: the pane is drawn again after Make, and the row keeps what was chosen (the desk check
 * found the next Make going to the first thread, in Preview, after the redraw). */
const lastMake: { source?: ExportSource; kind?: string; theme?: string; look?: string; ink?: string; format?: string; extra: [string, string][] } = { extra: [] };

function makeForm(threads: any[], fixed: string | null, themes: Record<string, any>, saved: string, done: () => void, looks?: any, lessons: any[] = []): HTMLElement {
  const f = h('form', 'doc-make');
  const from = h('select', 'field doc-source');
  from.setAttribute('aria-label', 'Export source');
  from.append(new Option('Thread', 'thread'), new Option('Passage', 'passage'), new Option('Existing lesson', 'lesson'));
  const thread = h('select', 'field doc-thread');
  thread.setAttribute('aria-label', 'Thread');
  const lesson = h('select', 'field doc-lesson');
  lesson.setAttribute('aria-label', 'Existing lesson');
  const passage = h('input', 'field doc-passage');
  passage.setAttribute('aria-label', 'Passage reference');
  passage.placeholder = 'Passage reference';
  const version = h('select', 'field doc-version');
  version.setAttribute('aria-label', 'Passage version');
  version.append(new Option('KJV'), new Option('YLT'));
  const copyLabel = h('label', 'doc-new');
  const newCopy = h('input');
  newCopy.type = 'checkbox';
  copyLabel.append(newCopy, ' Make a new copy');
  if (!fixed) {
    for (const t of threads) thread.append(new Option(t.name, t.name));
    for (const l of lessons) lesson.append(new Option(l.title, l.id));
    const previous = lastMake.source;
    if (previous) {
      from.value = previous.kind;
      if (previous.kind === 'thread' && threads.some(t => t.name === previous.name)) thread.value = previous.name;
      if (previous.kind === 'lesson' && lessons.some(l => l.id === previous.name)) lesson.value = previous.name;
      if (previous.kind === 'passage') {
        passage.value = previous.name;
        version.value = previous.version || 'KJV';
      }
    }
    f.append(from, thread, passage, version, lesson, copyLabel);
  }
  const input = (): ExportSource => {
    if (fixed) return { kind: 'thread', name: fixed };
    if (from.value === 'lesson') return { kind: 'lesson', name: lesson.value };
    if (from.value === 'passage') return { kind: 'passage', name: passage.value.trim(), version: version.value };
    return { kind: 'thread', name: thread.value };
  };
  const missingSource = (source: ExportSource) =>
    source.kind === 'passage' ? 'Enter a passage reference' : source.kind === 'lesson' ? 'Choose an existing lesson' : 'Choose a thread';
  const what = h('select', 'field doc-kind') as HTMLSelectElement;
  for (const [to, st, label] of KINDS) what.append(new Option(label, `${to}|${st}`));
  const format = h('select', 'field doc-slide-format');
  format.setAttribute('aria-label', 'Slide format');
  format.append(new Option('PDF', 'pdf'), new Option('PowerPoint with PDF preview', 'pptx'));
  format.value = lastMake.format || 'pdf';
  const theme = h('select', 'field doc-theme') as HTMLSelectElement;
  for (const [k, t] of Object.entries(themes)) theme.append(new Option(t.name, k));
  theme.value = lastMake.theme || saved;
  theme.title = 'The theme: colors and fonts';
  if (lastMake.kind) what.value = lastMake.kind;
  const go = h('button', 'btn primary', 'Make');
  const { look, ink } = lookFields(looks);
  if (lastMake.look) look.value = lastMake.look;
  if (lastMake.ink !== undefined) ink.value = lastMake.ink;
  let extra: [string, string][] = [...lastMake.extra];
  const adj = button('btn doc-adjust', 'Adjust…', async () => {
    const source = input();
    if (!source.name) { toast(missingSource(source)); return; }
    const [to, st] = what.value.split('|');
    const kind = to === 'word' ? 'word' : 'pdf';
    const start: Chosen = { look: look.value, dials: [...extra, ...(ink.value ? [['ink', ink.value] as [string, string]] : [])] };
    const r = await adjust(kind, [...sourceArgs(source), '--to', kind, '--structure', st, '--theme', theme.value], start, themes[theme.value]?.doc_accent || '8E1B14');
    if (!r) return;
    look.value = r.look;
    ink.value = r.dials.find(d => d[0] === 'ink')?.[1] || '';
    extra = r.dials.filter(d => d[0] !== 'ink');
    adj.textContent = extra.length ? `Adjust… (${extra.length})` : 'Adjust…';
  });
  adj.type = 'button';
  if (extra.length) adj.textContent = `Adjust… (${extra.length})`;
  f.append(what, format, theme, look, ink, adj, go);
  const about = h('p', 'muted small doc-about');
  const say = () => {
    const k = KINDS.find(x => `${x[0]}|${x[1]}` === what.value);
    format.hidden = k?.[0] !== 'deck';
    const description = format.value === 'pptx' && !format.hidden ? k?.[3]?.replace('Slides as PDF pages:', 'Editable slides:') : k?.[3];
    about.textContent = `${description || ''}. ${themes[theme.value]?.best_for || ''}.`;
  };
  const showSource = () => {
    thread.hidden = from.value !== 'thread';
    lesson.hidden = from.value !== 'lesson';
    passage.hidden = version.hidden = from.value !== 'passage';
    copyLabel.hidden = from.value === 'thread';
  };
  from.onchange = () => {
    showSource();
    newCopy.checked = false;
    what.value = from.value === 'passage' ? 'word|reading' : 'word|script';
    say();
  };
  showSource();
  what.onchange = theme.onchange = format.onchange = say;
  say();
  f.onsubmit = async e => {
    e.preventDefault();
    const source = input();
    if (!source.name) { toast(missingSource(source)); return; }
    const [to, st] = what.value.split('|');
    go.disabled = true;
    go.textContent = 'Making…';
    if (!fixed) Object.assign(lastMake, { source, kind: what.value, theme: theme.value, look: look.value, ink: ink.value, format: format.value, extra: [...extra] });
    try {
      toast(await makeDoc(source, to, { structure: st, theme: theme.value, look: look.value, ink: ink.value, dials: extra, newCopy: newCopy.checked, format: format.value }));
      done();
    }
    catch (x) { toast(String((x as Error).message || x)); }
    finally { go.disabled = false; go.textContent = 'Make'; }
  };
  const wrap = h('div', 'doc-make-wrap');
  wrap.append(f, about);
  return wrap;
}

/** The Make row for a page: which page, then Make a document… opens its steps. */
function pageForm(tree: any): HTMLElement {
  const f = h('form', 'doc-page-make');
  const pick = h('select', 'field doc-page') as HTMLSelectElement;
  const walk = (rows: any[], depth: number) => { for (const r of rows) { pick.append(new Option(`${'  '.repeat(depth)}${r.title || 'Untitled'}`, r.id)); walk(r.children || [], depth + 1); } };
  walk(tree?.pages || [], 0);
  const go = h('button', 'btn primary', 'Make a document…');
  go.disabled = !pick.options.length;
  f.append(pick, go);
  f.onsubmit = e => { e.preventDefault(); if (pick.value) void makeFromPage(pick.value); };
  return f;
}

/** The Documents pane. Asked for again, it is drawn again: a document's state also changes outside the window (a file
 * edited in Word, a note written from a terminal), which no write here announces. */
export function openDocuments() {
  const open = dock.find('documents');
  if (open) {
    dock.show(open);
    void open.refresh?.();
    return open;
  }
  return dock.open('documents', 'Documents', 'documents', MINE, async (el, pane) => {
    const [docs, threads, designs, tree, looks, lessons]: any[] = await Promise.all([
      wb(['docs', 'list']), wb(['thread', 'list']), wb(['craft', 'designs']), wb(['page', 'tree']), wb(['docs', 'looks']), wb(['lesson', 'list']),
    ]);
    el.replaceChildren();
    const hd = h('header', 'pane-head');
    hd.append(h('h2', 'pane-title', 'Documents'),
      h('div', 'pane-sub', 'Word documents and slides from your passages, threads, pages and existing lessons. Every verse is checked against the Bible before an export is kept.'));
    el.append(hd);
    el.append(h('div', 'label', 'Make a document'));
    el.append(makeForm(threads, null, designs.themes, designs.theme, () => { void pane.refresh?.(); }, looks, lessons));
    // W6 (sheet W7.1): from a page and the pages inside it, in the steps of Make a document
    el.append(h('div', 'label', 'Make one from a page'));
    el.append(pageForm(tree));
    el.append(h('div', 'label', `Your documents · ${docs.length}`));
    const list = h('div', 'doc-list');
    for (const d of docs) list.append(docRow(d));
    if (!docs.length) list.append(h('p', 'muted', 'None yet. Make one above, or type doc thread Phinehas script in the command field.'));
    el.append(list);
    const folder = docs[0]?.path ? docs[0].path.replace(/[\\/][^\\/]*$/, '') : '';
    if (folder) el.append(h('p', 'muted small doc-folder', `Files are in ${folder}.`));
  });
}

/** A thread's documents, at the foot of its pane: each with how it stands, and Make for this thread. */
export async function threadDocuments(t: any, into: HTMLElement) {
  const [docs, designs, looks]: any[] = await Promise.all([wb(['docs', 'list', '--thread', t.name]), wb(['craft', 'designs']), wb(['docs', 'looks'])]);
  into.replaceChildren(h('div', 'label', `Documents · ${docs.length}`));
  for (const d of docs) into.append(docRow(d));
  into.append(makeForm([], t.name, designs.themes, designs.theme, () => {}, looks));
}

// back from Word or a PDF viewer: the pane says how each document stands now
window.addEventListener('focus', () => { const p = dock?.find('documents'); if (p) void p.refresh?.(); });
