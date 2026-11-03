// The command field: search and the capture box merged into one (docs/PLAN-design.md, decided in review). Backtick
// opens it from anywhere. As words are typed, suggestions come in groups: what the line means as a command, commands
// that start with the first word, your threads (for +name), and a plain search of the KJV. Enter runs the one marked.
import { wb } from './api';
import { app, here } from './app';
import { parse, runLine } from './actions';
import { manual } from './panes';
import { toast } from './sheets';
import { h, icon } from './ui';

interface Suggestion { group: string; line: string; what: string; ico: string }

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
    case 'jot': return a.question ? 'a question with no place yet, into the Inbox' : 'a thought with no place yet, into the Inbox';
    case 'place': return `give that Inbox note its place: ${a.at.label}`;
    case 'interlinear': return 'the original, word by word';
    case 'find': return 'your notes, threads and questions';
    case 'openthread': return 'open the thread';
    default: return '';
  }
}

export class CommandField {
  private list: HTMLElement;
  private items: Suggestion[] = [];
  private sel = 0;
  private seq = 0;
  private status: HTMLElement;

  constructor(private input: HTMLInputElement, private box: HTMLElement) {
    this.list = h('div', 'suggest');
    this.list.hidden = true;
    this.status = h('div', 'cmd-status');
    this.status.hidden = true;
    box.append(this.list, this.status);
    input.addEventListener('input', () => this.suggest());
    input.addEventListener('focus', () => { loadThreads(); this.suggest(); });
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
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.input.value = ''; this.close(); this.input.blur(); return; }
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
      const s = this.items[this.sel];
      this.run(s ? s.line : this.input.value);
    }
  }

  async run(line: string) {
    this.close();
    this.input.blur();
    const r: { ok: boolean; said?: string; error?: string } = await runLine(line).catch(x => ({ ok: false, error: String(x) }));
    this.say(r.ok ? r.said || '' : r.error || 'That did not work', !r.ok);
    if (r.ok) this.input.value = '';
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
    if (!t) { this.items = []; this.draw(); return; }
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
