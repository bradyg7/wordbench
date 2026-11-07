// What each line of the command language does in the window. The line is parsed once, by wb-core (`wb parse`); the
// action that comes back is carried out here: a pane, a move of the reader, or a write through a `wb` command. Every
// action answers with a short sentence (shown under the field, and sent back to `wb do`).
import { api, inApp, wb } from './api';
import { app, book, goTo, here, type At } from './app';
import { layers } from './layers';
import { CHANGES, type Change } from './dock';
import { countInbox, openNotebook } from './notebook';
import {
  dock, frontResults, jumpTo, openBdb, openCount, openDefine, openFind, openForms, openHelp, openInterlinear, openKeys, openLesson, openLexiconc,
  openMarked, openNear, openPlace, openPassage, openPlans, openSearch, openShelf, openStrong, openThread, openThreads, openToday, openUses,
} from './panes';
import { setHover } from './ui';
import { addFinding, openFindings } from './findings';
import { KINDS, makeDoc, openDocuments } from './documents';

// The last write, so `undo` can take it back.
type Undo = { kind: 'note'; id: string } | { kind: 'hl'; record: unknown } | { kind: 'trail'; id: string } | { kind: 'thread'; name: string; anchor: string } | { kind: 'jot'; id: string };
let last: Undo | null = null;

const later = (what: string, phase: number) => `${what} comes in phase ${phase}; the Python app still does it for now.`;
const at = (a: { at?: At }) => a.at ?? here();

function spanPlace(s: { book: string; c1: number; v1: number; c2: number; v2: number }) {
  const b = book(s.book)!;
  const one = s.c1 === s.c2;
  if (!s.v1 && !s.v2) return one ? `${b.code} ${s.c1}` : `${b.code} ${s.c1}-${s.c2}`;
  if (one) return s.v2 && s.v2 !== s.v1 ? `${b.code} ${s.c1}:${s.v1}-${s.v2}` : `${b.code} ${s.c1}:${s.v1 || 1}`;
  return `${b.code} ${s.c1}:${s.v1 || 1}-${s.c2}:${s.v2 || 999}`;
}

function spanLabel(s: { book: string; c1: number; v1: number; c2: number; v2: number }) {
  const b = book(s.book)!;
  if (s.c1 === 1 && !s.v1 && s.c2 === b.chapters && !s.v2 && b.chapters > 1) return b.name;
  const headTxt = `${b.name} ${s.c1}${s.v1 ? ':' + s.v1 : ''}`;
  if (s.c2 === s.c1) return s.v2 && s.v2 !== s.v1 ? `${headTxt}–${s.v2}` : headTxt;
  return `${headTxt}–${s.c2}${s.v2 ? ':' + s.v2 : ''}`;
}

/** After a write: the panes that show what it changed are drawn again (all of them when it is not said), the reader's
 * marks when notes, threads or highlights changed. */
export function written(...what: Change[]) {
  const w = what.length ? what : CHANGES;
  if (w.some(c => c === 'notes' || c === 'threads' || c === 'highlights')) void app.refreshMarks();
  dock.refresh(w);
}

/** Runs one parsed action. → what it did, in a sentence. */
export async function perform(a: any, line: string): Promise<string> {
  switch (a.cmd) {
    case 'none': return '';
    // ---- moving the reader ----
    case 'go': {
      await app.go(a.book, a.ch, a.v || 1);
      return `${book(a.book)!.name} ${a.ch}${a.v ? ':' + a.v : ''}`;
    }
    case 'next': app.step(1); return 'The next chapter';
    case 'prev': app.step(-1); return 'The previous chapter';
    case 'back': return app.back() ? 'Back where you were' : 'Nowhere to go back to';
    case 'first':
    case 'last': return jumpTo(a.cmd, a.strong, a.word, a.scope);
    // ---- panes ----
    case 'open': {
      const b = book(a.book)!;
      const place = a.v ? `${b.code} ${a.ch}:${a.v}${a.v2 ? '-' + a.v2 : ''}` : `${b.code} ${a.ch}`;
      const label = `${b.name} ${a.ch}${a.v ? ':' + a.v : ''}${a.v2 ? '–' + a.v2 : ''}`;
      openPassage([place], a.version, label);
      return `${label} in a pane`;
    }
    case 'excerpt': {
      openPassage(a.spans.map(spanPlace), a.version, a.spans.map(spanLabel).join('; '));
      return `${a.spans.length} place${a.spans.length === 1 ? '' : 's'} in a pane`;
    }
    case 'search': openSearch(a.q, a.scope || 'all'); return `Searching for “${a.q}”`;
    case 'uses': openUses(a.strong, a.word, a.scope); return `Every use of ${[a.strong, a.word].filter(Boolean).join(' ')}`;
    case 'count': openCount(a.strong || a.word); return `Counted ${a.strong || a.word} by book`;
    case 'def': {
      if (/^[HG]\d+$/i.test(a.q)) { openStrong(a.q.toUpperCase()); return `The entry for ${a.q.toUpperCase()}`; }
      openDefine(a.q);
      return `The original words behind ${a.q}`;
    }
    case 'lex': (a.source === 'bdb' ? openBdb : openStrong)(a.strong); return `${a.source === 'bdb' ? 'BDB' : 'Strong’s'} ${a.strong}`;
    case 'forms': openForms(a.word); return `The forms of ${a.word}`;
    case 'lexiconc': openLexiconc(a.q); return `Original words defined by ${a.q}`;
    case 'near': openNear(a.a, a.b, a.within, a.scope); return `${a.a} near ${a.b}`;
    case 'interlinear': openInterlinear(spanPlace(a.span), spanLabel(a.span)); return `The interlinear for ${spanLabel(a.span)}`;
    case 'preview': {
      const d = await wb(['preview', a.q, '--version', a.version]);
      return String(d).split('\n').slice(0, 3).join(' ');
    }
    case 'find': openFind(a.q); return `Your notes, threads and questions with “${a.q}”`;
    case 'marked': {
      let color = a.color;
      if (a.saved) color = (await wb(['palette'])).colors[a.saved - 1] || '';
      openMarked(color, a.scope, a.thread);
      return 'Your highlights';
    }
    case 'threads': openThreads(); return 'Your threads';
    case 'openthread': openThread(a.name); return `The thread ${a.name}`;
    case 'trails': openNotebook('journal', { questions: true }); return 'Your questions';
    case 'today': openToday(a.day); return a.day ? `The log of ${a.day}` : 'Today’s log';
    case 'help': openHelp(a.topic); return a.topic ? `Help: ${a.topic}` : 'Help';
    case 'keys': openKeys(); return 'The keys';
    case 'sets': openShelf(); return 'The Shelf';
    case 'notes': {
      const p = at(a);
      if (a.action === 'open') { openPlace(p.anchor, p.label); return `Your notes on ${p.label}`; }
      return changeNote(a, p);
    }
    // ---- writing (each through a wb command, then drawn again) ----
    case 'note': {
      const p = at(a);
      const n = await wb(['note', 'add', p.anchor, '-'], a.text);
      last = { kind: 'note', id: n.id };
      written('notes');
      return `Note on ${p.label}`;
    }
    case 'ask': {
      const p = at(a);
      const t = await wb(['trail', 'add', p.anchor, a.text]);
      last = { kind: 'trail', id: t.id };
      written('notes');
      return `Question on ${p.label}`;
    }
    case 'jot': {
      const n = await wb(a.question ? ['note', 'jot', '-', '--question'] : ['note', 'jot', '-'], a.text);
      last = { kind: 'jot', id: n.id };
      written('notes');
      return a.question ? 'A question with no place yet: in Pages' : 'A page of its own (no place yet): in Pages';
    }
    case 'place': {
      const r = await wb(['note', 'place', a.part, a.at.anchor]);
      written('notes');
      return `Placed on ${r.label}`;
    }
    case 'journal': openNotebook('journal'); return 'The Notebook: Days';
    case 'inbox': openNotebook('inbox'); return `The Notebook: Pages, the notes with no place yet (${await countInbox()})`;
    case 'notebook': openNotebook(); return 'The Notebook';
    case 'thread': {
      const p = at(a);
      await wb(['thread', 'add', a.name, p.anchor]);
      last = { kind: 'thread', name: a.name, anchor: p.anchor };
      written('threads');
      return `${p.label} added to ${a.name}`;
    }
    case 'threadrm': await wb(['thread', 'rm', a.name, a.at.anchor]); written('threads'); return `${a.at.label} taken out of ${a.name}`;
    case 'threadset': return changeThread(a);
    case 'hl': {
      const p = at(a);
      let color: string | null = a.color ?? null;
      if (a.saved) {
        color = (await wb(['palette'])).colors[a.saved - 1];
        if (!color) return `You have no saved color c${a.saved}.`;
      }
      const r = color ? await wb(['hl', 'set', p.anchor, color]) : await wb(['hl', 'clear', p.anchor]);
      last = { kind: 'hl', record: r.undo };
      written('highlights');
      return color ? `${p.label} ${color}` : `${p.label} cleared`;
    }
    case 'undo': return undo();
    case 'trail': return changeTrail(a);
    case 'palette': {
      if (a.action === 'list') return `Saved colors: ${(await wb(['palette'])).colors.join(', ') || 'none'}`;
      const c = a.color || (await wb(['palette'])).colors[a.saved - 1];
      await wb(['palette', 'rm', c]);
      return `Forgot ${c}`;
    }
    case 'results': return results(a);
    case 'set': return changeSet(a);
    case 'layout': return layout(a);
    case 'lesson': {
      if (a.action === 'list') { const ls = await wb(['lesson', 'list']); return `Lessons: ${ls.map((l: any) => l.name).join(', ')}`; }
      if (a.action === 'show') { openLesson(a.name); return `The lesson ${a.name}`; }
      if (a.action === 'check') { const r = await wb(['lesson', 'check', a.name]); return r.ok === false ? r.error : `${a.name}: ${r.slides ?? '?'} slides, every scripture read`; }
      return later('Building a lesson’s documents', 5);
    }
    // ---- the window ----
    case 'layers': return changeLayers(a);
    case 'highlights': layers.all = a.on; layers.save(); app.refreshMarks(); return a.on ? 'Highlights shown' : 'Highlights hidden';
    case 'size': {
      const p = a.percent ?? app.size() + a.step * 10;
      app.setSize(p);
      return `Text size ${app.size()}%`;
    }
    case 'toolbar': document.documentElement.classList.toggle('no-toolbar', !a.show); return a.show ? 'The toolbar is shown' : 'The toolbar is hidden (toolbar show brings it back)';
    case 'findpage': app.findInChapter(a.q); return a.q ? `Finding “${a.q}” in this chapter` : 'Find in this chapter';
    case 'panes': return dock.describe().map(p => p.title).join(' · ') || 'No panes open';
    case 'pane': return paneAction(a);
    case 'hover': setHover(a.mode); return `Hover cards: ${a.mode}`;
    case 'copy': {
      if (a.action === 'format') { localStorage.setItem('wb.copy', JSON.stringify({ format: a.format, short: a.short })); return `Copies are laid out as ${a.format}${a.short ? ', short' : ''}`; }
      const saved = (() => { try { return JSON.parse(localStorage.getItem('wb.copy') || '{}'); } catch { return {}; } })();
      const place = a.ref || here().label;
      const argv = ['copy', place, '--version', a.version, '--format', a.format || saved.format || 'lines', '--no-clip'];
      if (a.short || saved.short) argv.push('--short');
      const text = String(await wb(argv));
      try { await navigator.clipboard.writeText(text); } catch { return 'Copy is not allowed here'; }
      return `Copied ${place} with its reference`;
    }
    case 'window': {
      if (!inApp) return 'Window sizes work in the app';
      const r = await api.setWindow(a.size);
      return `${a.size}: ${r.got[0]}×${r.got[1]}`;
    }
    case 'plans': openPlans(); return 'Reading plans';
    case 'findings': openFindings(); return 'Your findings about the app';
    case 'finding': return addFinding(a.text);
    case 'version': return a.version ? app.setVersion(a.version) : `The reader is in the ${app.version()}`;
    case 'listen': return later('Read aloud', 6);
    case 'make': return makeFrom(a);
    case 'docs': return docs(a);
    case 'theme': {
      if (!a.theme) return `New documents are made in ${(await wb(['craft', 'theme'])).theme}`;
      await wb(['craft', 'theme', a.theme]);
      app.changed('documents');
      return `New documents are made in ${a.theme}`;
    }
    case 'pdf': case 'pdfs': case 'packet': return later('Saved PDFs and packets', 5);
    default: return `“${line}” is understood, but the window does not do it yet.`;
  }
}

// ---- documents from a thread (tier 4) ----

async function makeFrom(a: any): Promise<string> {
  if (!a.thread) return 'Documents from a passage come in phase 5 (the Python app still makes them); here, from a thread: doc thread Phinehas';
  // the window starts on what it makes (a thread's default in the Python app is its Dossier or Map, made there until phase 5)
  const structure = a.structure || KINDS.find(k => k[0] === a.kind)?.[1];
  const said = await makeDoc(a.thread, a.kind === 'deck' ? 'deck' : 'word', structure, a.theme);
  openDocuments();
  return said;
}

async function docs(a: any): Promise<string> {
  const name = (a.name || '').trim();
  if (a.action === 'list' || (a.action === 'open' && !name)) { openDocuments(); return 'Your documents'; }
  if (a.action === 'open') { const r = await wb(['docs', 'open', name]); return `Opened ${r.name}`; }
  if (a.action === 'update') {
    const argv = ['docs', 'update', ...(name ? [name] : []), ...(name && a.theme ? ['--theme', a.theme] : []), ...(name && a.force ? ['--force'] : [])];
    const r = await wb(argv);
    app.changed('documents');
    if (!name) return r.updated.length || r.failed.length ? `Updated ${r.updated.length}${r.failed.length ? `; ${r.failed.length} could not be: ${r.failed[0].error}` : ''}` : 'Every document is up to date';
    return r.changed ? `Updated ${r.name}` : `${r.name} is up to date`;
  }
  if (a.action === 'forget') { const r = await wb(['docs', 'forget', name]); app.changed('documents'); return `${r.name} is left as it is from now on`; }
  if (a.action === 'remember') { const r = await wb(['docs', 'remember', name]); app.changed('documents'); return `${r.name} is kept up to date again`; }
  if (a.action === 'delete') {
    const d = await wb(['docs', 'show', name]);
    if (!confirm(`Delete ${d.name}? The file is erased from the computer; its record goes to the study folder's .trash.`)) return 'Nothing was deleted';
    const r = await wb(['docs', 'delete', d.id]);
    app.changed('documents');
    return `Deleted ${r.deleted.join(', ') || r.name}`;
  }
  openDocuments();
  return 'Your documents';
}

async function undo(): Promise<string> {
  const u = last;
  last = null;
  if (!u) return 'Nothing to undo';
  if (u.kind === 'note') await wb(['note', 'rm', u.id]);
  else if (u.kind === 'jot') await wb(['inbox', 'rm', u.id]);
  else if (u.kind === 'trail') await wb(['trail', 'rm', u.id]);
  else if (u.kind === 'thread') await wb(['thread', 'rm', u.name, u.anchor]);
  else await wb(['hl', 'undo', '-'], JSON.stringify(u.record));
  written();
  return 'Taken back (deleted notes go to .trash)';
}

// notes edit|delete <part of it> [= new text] [@place]
async function changeNote(a: any, p: At): Promise<string> {
  const d = await wb(['anchor', p.anchor]);
  const notes: any[] = d.notes || [];
  const part = (a.part || '').toLowerCase();
  const hit = notes.filter(n => !part || n.text.toLowerCase().includes(part));
  if (!hit.length) return `No note on ${p.label} has “${a.part}”.`;
  if (hit.length > 1) return `Which note? ${hit.length} on ${p.label} fit; give more of its words.`;
  if (a.action === 'delete') await wb(['note', 'rm', hit[0].id]);
  else await wb(['note', 'edit', hit[0].id, hit[0].anchor, '-'], a.text);
  written('notes');
  return a.action === 'delete' ? 'Deleted (to .trash)' : 'Changed';
}

async function changeTrail(a: any): Promise<string> {
  const qs = (await wb(['trail', 'list', '--status', 'all'])).trails as any[];
  const part = a.part.toLowerCase();
  const tiers = [(t: string) => t === part, (t: string) => t.startsWith(part), (t: string) => t.includes(part)];
  let hit: any[] = [];
  for (const fits of tiers) { hit = qs.filter(t => fits(t.text.toLowerCase())); if (hit.length) break; }
  if (!hit.length) return `No question has “${a.part}”.`;
  if (hit.length > 1) return `Which question? ${hit.length} fit; give more of its words.`;
  const id = hit[0].id;
  if (a.action === 'edit') await wb(['trail', 'edit', id, a.text]);
  else if (a.action === 'delete') await wb(['trail', 'rm', id]);
  else await wb(['trail', a.action, id]);
  written('notes');
  return a.action === 'done' ? 'Marked answered' : a.action === 'reopen' ? 'Open again' : a.action === 'delete' ? 'Deleted (to .trash)' : 'Changed';
}

async function changeThread(a: any): Promise<string> {
  switch (a.action) {
    case 'color': {
      let c = a.color;
      if (a.saved) c = (await wb(['palette'])).colors[a.saved - 1];
      await wb(['thread', 'edit', a.name, '--color', c || 'none']);
      break;
    }
    case 'rename': await wb(['thread', 'edit', a.name, '--rename', a.to]); break;
    case 'note': await wb(['thread', 'edit', a.name, '--note', a.note]); break;
    case 'delete': await wb(['thread', 'delete', a.name]); break;
    case 'sort': await wb(['thread', 'sort', a.name]); break;
    case 'move': await wb(['thread', 'move', a.name, String(a.place), a.to]); break;
  }
  written('threads', 'notes');
  return `${a.name}: ${a.action === 'move' ? `${a.label} moved ${a.to}` : a.action}`;
}

async function changeLayers(a: any): Promise<string> {
  const ts: any[] = await wb(['thread', 'list']);
  const named = (n: string) => ts.find(t => t.name.toLowerCase() === n.toLowerCase()) || ts.find(t => t.name.toLowerCase().startsWith(n.toLowerCase()));
  switch (a.action) {
    case 'all': layers.all = true; layers.mine = true; layers.hidden.clear(); break;
    case 'none': layers.all = false; break;
    case 'mine': layers.mine = a.on; break;
    case 'show': case 'hide': {
      const t = named(a.name);
      if (!t) return `No thread called “${a.name}”.`;
      if (a.action === 'show') { layers.hidden.delete(t.id); layers.all = true; } else layers.hidden.add(t.id);
      layers.save();
      app.refreshMarks();
      return `${a.action === 'show' ? 'Showing' : 'Hiding'} “${t.name}”`;
    }
    case 'panel': document.getElementById('hl-menu')?.click(); return 'The layers';
    default: return `Drawn: ${layers.highlightsShown() ? 'your highlights' : 'no highlights'}; threads: ${ts.filter(t => layers.shown(t.id)).map(t => t.name).join(', ') || 'none'}`;
  }
  layers.save();
  app.refreshMarks();
  return 'Layers changed';
}

async function results(a: any): Promise<string> {
  const r = frontResults;
  if (!r) return 'No list in front: search or uses first.';
  const anchors = r.anchors();
  const inSpan = (an: string, s: any) => {
    const m = /^([1-3A-Z]{3})\.(\d+):(\d+)/.exec(an)!;
    const [c, v] = [+m[2], +m[3]];
    return m[1] === s.book && c >= s.c1 && c <= s.c2 && !(c === s.c1 && s.v1 && v < s.v1) && !(c === s.c2 && s.v2 && v > s.v2);
  };
  switch (a.action) {
    case 'status': return `${r.ticked.size} of ${anchors.length} ticked; shaped as ${r.shape}`;
    case 'all': anchors.forEach(x => r.ticked.add(x)); break;
    case 'none': r.ticked.clear(); break;
    case 'tick': case 'untick': {
      for (const an of anchors) if (a.spans.some((s: any) => inSpan(an, s))) { if (a.action === 'tick') r.ticked.add(an); else r.ticked.delete(an); }
      break;
    }
    case 'as': r.shape = a.as; return `Added as ${a.as}`;
    case 'add': {
      const places = r.ticked.size ? [...r.ticked] : anchors;
      const words = r.shape === 'words' && r.words ? r.words().filter(w => places.some(p => w.startsWith(p + '.'))) : places;
      await wb(['thread', 'add-many', a.name, ...words]);
      written('threads');
      return `${places.length} added to ${a.name}`;
    }
  }
  r.redraw();
  return `${r.ticked.size} ticked`;
}

async function changeSet(a: any): Promise<string> {
  if (a.action === 'list' ) { openShelf(); return 'The Shelf'; }
  const flags = (items: any[]) => items.flatMap(it => it.type === 'place' ? ['--place', it.anchor] : it.type === 'pane' ? [] : [`--${it.type}`, it.name]);
  switch (a.action) {
    case 'new': await wb(['set', 'new', a.name, ...flags(a.items)]); break;
    case 'add': await wb(['set', 'add', a.name, ...flags(a.items)]); break;
    case 'rm': await wb(['set', 'rm', a.name, ...a.parts]); break;
    case 'rename': await wb(['set', 'rename', a.name, a.to]); break;
    case 'delete': await wb(['set', 'delete', a.name]); break;
    default: openShelf(); return `The Shelf (opening a set’s panes comes in phase 6)`;
  }
  dock.refresh(['sets']);
  return `Set ${a.name}: ${a.action}`;
}

async function layout(a: any): Promise<string> {
  if (a.action === 'list') return `Layouts: ${(await wb(['layout', 'list'])).map((l: any) => l.name ?? l).join(', ') || 'none'}`;
  if (a.action === 'save') {
    // kept as the Rust window's own description of its panes (the Python app's dockview layouts are not read)
    const panes = dock.describe();
    await wb(['layout', 'save', a.name], JSON.stringify({ app: 'bible-workbench-rs', panes }));
    return `Layout ${a.name}: ${panes.length} panes`;
  }
  const l = await wb(['layout', 'show', a.name]);
  if (l.app !== 'bible-workbench-rs') return `${a.name} is a layout from the Python app; this window cannot read it yet.`;
  for (const p of l.panes) await reopen(p.key);
  return `Layout ${a.name}`;
}

/** A pane brought back from its key (layouts). */
async function reopen(key: string) {
  const [kind, ...x] = key.split('|');
  const f: Record<string, () => unknown> = {
    search: () => openSearch(x[0], x[1]), uses: () => openUses(x[0], x[1], x[2]), def: () => openDefine(x[0]), strong: () => openStrong(x[0]),
    bdb: () => openBdb(x[0]), count: () => openCount(x[0]), forms: () => openForms(x[0]), lexiconc: () => openLexiconc(x[0]),
    thread: () => openThread(x[0]), threads: () => openThreads(), notebook: () => openNotebook(), help: () => openHelp(), keys: () => openKeys(),
    shelf: () => openShelf(), find: () => openFind(x[0]), interlinear: () => openInterlinear(x[0], x[0]),
    place: () => openPlace(x[0], x[0]),
    passage: () => openPassage(x[0].split(';'), x[1], x[0]), reader2: () => app.secondReader(x[0], x[1]), today: () => openToday(x[0]), lesson: () => openLesson(x[0]), findings: () => openFindings(),
    documents: () => openDocuments(),
  };
  f[kind]?.();
}

function paneAction(a: any): string {
  const ps = a.target.toLowerCase() === 'minimized' ? dock.panes.filter(p => dock.isMinimized(p)) : dock.named(a.target);
  if (!ps.length) return `No pane called “${a.target}” is open.`;
  for (const p of ps) {
    if (a.action === 'close') dock.close(p);
    else if (a.action === 'float') dock.move(p, 'float');
    else if (a.action === 'dock') dock.dockAgain(p);
    else if (a.action === 'minimize') dock.minimize(p);
    else dock.show(p);
  }
  return `${a.action}: ${ps.map(p => p.title).join(', ')}`;
}

/** One line: parsed by wb-core, run here, and kept in the day's log. */
// Lines already parsed (the command field parses as it suggests), so Enter does not wait for the same answer again.
export const parsed = new Map<string, any>();

export async function parse(t: string): Promise<any> {
  const have = parsed.get(t);
  if (have) return have;
  const p = await wb(['parse', t]);
  if (parsed.size > 200) parsed.clear();
  parsed.set(t, p);
  return p;
}

export async function runLine(line: string): Promise<{ ok: boolean; said?: string; error?: string }> {
  const t = line.trim();
  if (!t) return { ok: true, said: '' };
  const p = await parse(t);
  if (p.error) return { ok: false, error: p.error };
  const said = await perform(p.action, t);
  if (inApp && p.action.cmd !== 'today') wb(['log', 'add', t, '--result', said]).catch(() => {});
  return { ok: true, said };
}

export { goTo };
