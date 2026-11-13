// The command field: search and the capture box merged into one (docs/archive/2026-11-10/docs/PLAN-design.md, decided in review). Backtick
// opens it from anywhere. As words are typed, suggestions come in groups: what the line means as a command, commands
// that start with the first word, your threads (for +name), and a plain search of the KJV. Enter runs the one marked.
import { wb } from './api';
import { app, here } from './app';
import { parse, runLine } from './actions';
import { manual } from './panes';
import { toast } from './sheets';
import { h, icon } from './ui';

interface Suggestion { group: string; line: string; what: string; ico: string }

// ---- the history of lines run (note 797d): as PowerShell keeps it, failed lines too. ↑ in the empty field (or while
// going through it) brings back the line before, ↓ the next; the empty field lists the last few as "Recent". Kept in
// the window's storage; the first time, it starts from the study folder's log of the last few days (wb log), which has
// the lines that worked. ------------------------------------------------------------------------------------------------
interface Ran { line: string; ok: boolean }
const HISTORY = 'wb.cmdhistory.v1', HISTORY_MAX = 500;
let history: Ran[] = (() => { try { return JSON.parse(localStorage.getItem(HISTORY) || '[]'); } catch { return []; } })();
function keep() { try { localStorage.setItem(HISTORY, JSON.stringify(history)); } catch { /* this run only */ } }
export function remember(line: string, ok: boolean) {
  const t = line.trim();
  if (!t) return;
  history = history.filter(r => r.line !== t);
  history.push({ line: t, ok });
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
  keep();
}
/** The history, oldest first (for `history` and the tests). */
export const commandHistory = () => history.slice();
async function seedHistory() {
  if (history.length || localStorage.getItem(HISTORY) !== null) return;
  try {
    const today = await wb(['log']);
    const days: string[] = (today.days || []).slice(0, 3).reverse();
    const seen: Ran[] = [];
    for (const d of days) {
      const log = d === today.day ? today : await wb(['log', d]);
      for (const e of log.entries || []) if (e.text) seen.push({ line: e.text, ok: true });
    }
    if (history.length) return;   // something was run meanwhile
    for (const r of seen) { history = history.filter(x => x.line !== r.line); history.push(r); }
    keep();
  } catch { /* outside the app */ }
}

let threads: { name: string; color: string }[] = [];
export async function loadThreads() {
  try { threads = await wb(['thread', 'list']); } catch { threads = []; }
}

// What an action does, in a few words (the right side of a suggestion).
function describe(a: any): string {
  const where = a.scope && a.scope !== 'all' ? ' in the part named' : '';
  switch (a.cmd) {
    case 'search': return `search the KJV for these words${a.scope ? ' in the part named' : ''}`;
    case 'uses': return a.strong && a.word ? `every use of ${a.strong} as “${a.word}”` : a.strong ? `every use of ${a.strong} by Strong's number${where}` : `every verse with the English word${where}`;
    case 'first': case 'last': return `go to its ${a.cmd} occurrence`;
    case 'def': return 'the original words behind it';
    case 'go': return 'move the reader there';
    case 'open': case 'excerpt': return a.version === 'PAR' ? 'the KJV with the YLT under it, in a pane' : 'in a pane, the reader stays';
    case 'note': return `a note on ${a.at?.label ?? here().label}`;
    case 'ask': return `a question at ${a.at?.label ?? here().label}`;
    case 'thread': return `add ${a.at?.label ?? here().label} to ${a.name}`;
    case 'hl': return `color ${a.at?.label ?? here().label}`;
    case 'jot': return a.question ? 'a question with no place yet, in Pages' : 'a thought with no place yet: a page of its own';
    case 'place': return `give that note its place: ${a.at.label}`;
    case 'interlinear': return 'the original, word by word';
    case 'find': return 'your notes, threads and questions';
    case 'openthread': return 'open the thread';
    default: return '';
  }
}

/** What the box shows when it is not being typed in (the line of the tab in front, command C14), and the hooks that let
 * Enter change the tab in front while Alt+Enter opens a new one; set by main.ts. */
export const box = {
  shows: () => '',
  before: () => '',
  after: (_was: string, _newTab: boolean) => {},
};

export class CommandField {
  private list: HTMLElement;
  private items: Suggestion[] = [];
  private sel = 0;
  private seq = 0;
  private status: HTMLElement;
  /** The line the suggestions were made for: Enter runs a suggestion only if it was made for the line as it is now
   * (typed fast, Enter could run one made for the first word). */
  private itemsFor = '';
  /** Where ↑ ↓ are in the history (null: not going through it). */
  private back: number | null = null;

  constructor(private input: HTMLInputElement, private box: HTMLElement) {
    this.list = h('div', 'suggest');
    this.list.hidden = true;
    this.status = h('div', 'cmd-status');
    this.status.hidden = true;
    box.append(this.list, this.status);
    input.addEventListener('input', () => { this.back = null; this.suggest(); });
    input.addEventListener('focus', () => { loadThreads(); void seedHistory(); this.suggest(); });
    input.addEventListener('blur', () => setTimeout(() => { if (!box.contains(document.activeElement)) this.close(); }, 120));
    input.addEventListener('keydown', e => this.key(e));
    document.addEventListener('keydown', e => {
      if (e.key === '`' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        this.open();
      }
    });
  }

  open(text?: string) {
    if (text !== undefined) this.input.value = text;
    this.input.focus();
    this.input.select();
  }

  close() {
    this.list.hidden = true;
  }

  private key(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.input.value = box.shows(); this.close(); this.input.blur(); return; }
    // ↑ ↓ go through the history when the field is empty or already going through it (as PowerShell does)
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (this.back !== null || (!this.input.value.trim() && e.key === 'ArrowUp'))) {
      e.preventDefault();
      if (!history.length) return;
      const at = this.back ?? history.length;
      const to = e.key === 'ArrowUp' ? Math.max(0, at - 1) : at + 1;
      this.close();
      this.items = [];
      if (to >= history.length) { this.back = null; this.input.value = ''; return; }
      this.back = to;
      this.input.value = history[to].line;
      this.input.setSelectionRange(this.input.value.length, this.input.value.length);
      this.input.classList.toggle('from-history-failed', !history[to].ok);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.items.length) return;
      this.sel = (this.sel + (e.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
      this.draw();
      return;
    }
    if (e.key === 'Tab' && this.items[this.sel]) {
      e.preventDefault();
      this.input.value = this.items[this.sel].line;
      this.suggest();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const s = this.back === null && this.itemsFor === this.input.value.trim() ? this.items[this.sel] : undefined;
      this.run(s ? s.line : this.input.value, e.altKey);
    }
  }

  async run(line: string, newTab = false) {
    const was = box.before();
    this.close();
    this.input.blur();
    this.back = null;
    this.input.classList.remove('from-history-failed');
    const r: { ok: boolean; said?: string; error?: string } = await runLine(line).catch(x => ({ ok: false, error: String(x) }));
    remember(line, r.ok);
    this.say(r.ok ? r.said || '' : r.error || 'That did not work', !r.ok);
    if (r.ok) { box.after(was, newTab); this.input.value = box.shows(); }
    else { this.input.focus(); this.input.value = line; }
  }

  say(text: string, error = false) {
    if (!text) return;
    if (!error) { this.status.hidden = true; toast(text); return; }
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
    this.status.hidden = false;
    clearTimeout((this.status as any).t);
    (this.status as any).t = setTimeout(() => { this.status.hidden = true; }, error ? 6000 : 3000);
  }

  private async suggest() {
    const line = this.input.value;
    const seq = ++this.seq;
    const t = line.trim();
    if (!t) {
      // the empty field: the last lines run, newest first (a line that did not work says so)
      this.items = history.slice(-6).reverse().map(r => ({ group: 'Recent · ↑ goes back through them', line: r.line, what: r.ok ? '' : 'did not work', ico: 'prompt' }));
      this.itemsFor = '';
      this.sel = -1;   // none marked: Enter in the empty field runs nothing; a click or ↓ then Enter does
      this.draw();
      return;
    }
    const out: Suggestion[] = [];
    const parsed = await parse(t).catch(() => null);
    if (seq !== this.seq) return;
    const a = parsed?.action;
    if (a && a.cmd !== 'search') out.push({ group: 'Commands', line: t, what: describe(a), ico: 'prompt' });
    if (parsed?.error) out.push({ group: 'Commands', line: t, what: parsed.error, ico: 'prompt' });
    const head = t.split(/\s+/)[0].toLowerCase();
    if (!t.includes(' ')) {
      const m = await manual().catch(() => null);
      for (const c of (m?.commands || []).filter((c: any) => c.name.startsWith(head) && c.name !== head).slice(0, 5)) {
        out.push({ group: 'Commands', line: `${c.name} `, what: c.help, ico: 'prompt' });
      }
    }
    if (t.startsWith('+')) {
      const n = t.slice(1).trim().toLowerCase();
      for (const th of threads.filter(x => x.name.toLowerCase().startsWith(n)).slice(0, 5)) {
        out.push({ group: 'Your threads', line: `+${th.name}`, what: `add ${here().label} to ${th.name}`, ico: 'threads' });
      }
    } else if (head === 'thread' || head === 'threads') {
      const n = t.slice(head.length).trim().toLowerCase();
      for (const th of threads.filter(x => x.name.toLowerCase().includes(n)).slice(0, 5)) out.push({ group: 'Your threads', line: `thread ${th.name}`, what: 'open the thread', ico: 'threads' });
    }
    if (a?.cmd === 'search' && !a.suspect) {
      const go = await parse(`go ${t}`).catch(() => null);
      if (seq !== this.seq) return;
      if (go?.action) out.unshift({ group: 'Places', line: `go ${t}`, what: 'move the reader there', ico: 'book' });
    }
    if (a?.cmd === 'search') {
      out.push({ group: 'Search the KJV', line: t.startsWith('search ') ? t : `search ${t}`, what: a.suspect ? `or did you mean ${a.suspect}?` : `every verse with ${t.includes(' ') ? 'all these words' : `“${t}”`}`, ico: 'search' });
    }
    this.items = out;
    this.itemsFor = t;
    this.sel = 0;
    this.draw();
  }

  private draw() {
    this.list.replaceChildren();
    this.list.hidden = !this.items.length;
    if (!this.items.length) return;
    const at = h('div', 'suggest-at');
    at.append(h('span', 'muted', 'At '));
    const pill = h('span', 'pill place-pill');
    pill.append(icon('pin', 13), document.createTextNode(here().label));
    at.append(pill, h('span', 'grow'), h('span', 'muted small', 'click a word or verse number to change'));
    this.list.append(at);
    let group = '';
    this.items.forEach((s, k) => {
      if (s.group !== group) { group = s.group; this.list.append(h('div', 'suggest-group', group)); }
      const row = h('button', `suggest-row${k === this.sel ? ' on' : ''}`);
      row.append(icon(s.ico), h('span', 'suggest-line', s.line.trim()), h('span', 'suggest-what', s.what));
      if (k === this.sel) row.append(h('kbd', '', 'Enter'));
      row.onmousedown = e => e.preventDefault();
      row.onclick = () => this.run(s.line);
      this.list.append(row);
    });
  }
}

export function attachCommandField(): CommandField {
  const input = document.getElementById('cmd') as HTMLInputElement;
  const field = new CommandField(input, document.getElementById('cmdbox')!);
  app.run = async line => {
    const r = await runLine(line);
    field.say(r.ok ? r.said || '' : r.error || '', !r.ok);
    return r.ok ? r.said || '' : r.error || '';
  };
  return field;
}

/** The box popped off the bar (design/features/command C18, c567): dragged by its grip it floats where it is put and
 *  keeps its line; a double-click on the grip puts it back. Where it floats is kept in the window's storage. */
export function initPopOff() {
  const cb = document.getElementById('cmdbox')!;
  const grip = cb.querySelector<HTMLElement>('.cmd-grip');
  if (!grip) return;
  const KEY = 'wb.cmdbox.at';
  const place = (x: number, y: number) => {
    const w = cb.offsetWidth || 480, hh = cb.offsetHeight || 36;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - hh - 8, y));
    cb.style.left = `${x}px`; cb.style.top = `${y}px`;
    return { x, y };
  };
  const putBack = () => {
    cb.classList.remove('popped');
    cb.style.left = cb.style.top = '';
    try { localStorage.removeItem(KEY); } catch { /* storage off */ }
  };
  try {
    const at = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (at && typeof at.x === 'number') { cb.classList.add('popped'); requestAnimationFrame(() => place(at.x, at.y)); }
  } catch { /* storage off */ }
  grip.addEventListener('dblclick', e => { e.preventDefault(); putBack(); });
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = cb.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, x0 = e.clientX, y0 = e.clientY;
    let moved = false, at = { x: r.left, y: r.top };
    grip.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return;
      if (!moved) { moved = true; cb.style.width = `${r.width}px`; cb.classList.add('popped', 'dragging'); cb.style.width = ''; }
      at = place(m.clientX - dx, m.clientY - dy);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      cb.classList.remove('dragging');
      if (moved) { try { localStorage.setItem(KEY, JSON.stringify(at)); } catch { /* storage off */ } }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });
  window.addEventListener('resize', () => { if (cb.classList.contains('popped')) place(parseFloat(cb.style.left) || 0, parseFloat(cb.style.top) || 0); });
}
