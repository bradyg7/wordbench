// The Concordance: the printed Strong's as a book on the rail (design/features/concordance, accepted 2026-11-16).
// One tab with four tabs inside it: English, Hebrew, Greek, Interlinear. Everything drawn is a `wb` answer
// (wb concordance, wb strong, wb uses --by, wb interlinear); no scripture is typed or kept here. A word picked in the box
// opens in a new tab beside this one (C-13); the back button of every tab is tab-history's, not built here.
import './concordance.css';
import { wb } from './api';
import { dock } from './panes';
import type { Pane } from './dock';
import { verseCard } from './verses';
import { toast } from './sheets';
import { button, h } from './ui';

type Tab = 'english' | 'hebrew' | 'greek' | 'interlinear';
const TABS: [Tab, string][] = [['english', 'English'], ['hebrew', 'Hebrew'], ['greek', 'Greek'], ['interlinear', 'Interlinear']];

/** What one tab shows: kept with the tab, and copied into a tab opened from it. */
interface State {
  tab: Tab;
  word: string;
  mode: 'all' | 'one';
  /** The letter clicked in the strip (a list of the words that start with it), and the word it was clicked after. */
  letter: string;
  back: string;
  entry: string;
  by: 'word' | 'book';
  ref: string;
  /** Where the dictionary's list starts (a number), and the first verse of the interlinear page. */
  from: string;
  offset: number;
  /** The pages this tab has shown, oldest first: a tab opened from this one starts with them (C-13). */
  steps: string[];
}

export interface Open {
  /** An English word's page. */
  word?: string;
  /** An entry (H7068). */
  strong?: string;
  /** A verse, passage or chapter in the Interlinear tab. */
  ref?: string;
  mode?: 'all' | 'one';
  /** Open in a tab of its own beside the one in front (the default for a word, a number or a sound picked in the box). */
  from?: State;
}

const fresh = (): State => ({ tab: 'english', word: '', mode: 'one', letter: '', back: '', entry: '', by: 'word', ref: '', from: '', offset: 0, steps: [] });
const langOf = (n: string): Tab => (n.toUpperCase().startsWith('H') ? 'hebrew' : 'greek');
const isNumber = (s: string) => /^[HhGg]\d{1,4}$/.test(s.trim());
const lemmaEl = (text: string, lang?: string) => {
  const l = h('span', 'lemma', text);
  const greek = lang === 'grk' || lang === 'grc';
  l.lang = greek ? 'grc' : 'he';
  l.dir = greek ? 'ltr' : 'rtl';
  return l;
};

function keyOf(o: Open): { key: string; title: string } {
  if (o.word) return { key: `concordance|english|${o.word}`, title: o.word };
  if (o.strong) return { key: `concordance|entry|${o.strong.toUpperCase()}`, title: o.strong.toUpperCase() };
  if (o.ref) return { key: `concordance|ref|${o.ref}`, title: o.ref };
  return { key: 'concordance', title: 'Concordance' };
}

/** The rail's Concordance (no argument), or a tab named for a word, an entry or a place. */
export function openConcordance(o: Open = {}) {
  const { key, title } = keyOf(o);
  return dock.open('concordance', title, key, 'left', (el, pane) => {
    const st: State = { ...fresh(), ...(o.from ? { ...o.from, steps: [...o.from.steps], letter: '', back: '' } : {}) };
    if (o.word) Object.assign(st, { tab: 'english', word: o.word, mode: o.mode ?? 'one' });
    else if (o.strong) Object.assign(st, { tab: langOf(o.strong), entry: o.strong.toUpperCase() });
    else if (o.ref) Object.assign(st, { tab: 'interlinear', ref: o.ref });
    new Book(el, pane, st).start();
  });
}

/** A key the dock kept, opened again. */
export function reopenConcordance(key: string) {
  const [, kind = '', value = ''] = key.split('|');
  if (kind === 'english') return openConcordance({ word: value });
  if (kind === 'entry') return openConcordance({ strong: value });
  if (kind === 'ref') return openConcordance({ ref: value });
  return openConcordance();
}

class Book {
  private body = h('div', 'conc-body');
  private sug = h('div', 'conc-sug');
  private strip = h('div', 'conc-letters');
  private tabs = h('div', 'conc-tabs');
  private input = h('input', 'field conc-input') as HTMLInputElement;
  private seq = 0;
  private letters: { letter: string; words: number; places: number }[] = [];

  constructor(private el: HTMLElement, private pane: Pane, private st: State) {}

  async start() {
    const box = h('div', 'conc-box');
    this.input.type = 'search';
    this.input.placeholder = 'A word, a number (H7068) or a sound (kanna)';
    this.input.setAttribute('aria-label', 'Search the Concordance');
    this.input.autocomplete = 'off';
    this.input.oninput = () => void this.suggest();
    this.input.onkeydown = e => {
      if (e.key === 'Escape') { this.sug.replaceChildren(); return; }
      if (e.key === 'Enter') { e.preventDefault(); void this.enter(this.input.value.trim()); }
    };
    box.append(this.input, this.sug);
    this.tabs.setAttribute('role', 'tablist');
    this.el.replaceChildren(h('div', 'conc'));
    const root = this.el.firstElementChild as HTMLElement;
    root.append(box, this.strip, this.tabs, this.body);
    this.pane.captureView = () => ({ ...this.st, steps: [...this.st.steps] });
    this.pane.restoreView = async (s: State) => { if (s?.tab) { Object.assign(this.st, s); await this.draw(); } };
    if (!this.st.word) this.st.mode = (await wb(['settings', 'concordance']).catch(() => ({})))?.forms === 'all' ? 'all' : 'one';
    try { this.letters = (await wb(['concordance', 'letters'])).letters; } catch { this.letters = []; }
    this.drawLetters();
    await this.draw();
  }

  // ---- the box (C2, C21, C25) ----------------------------------------------------------------------------------------
  private async suggest() {
    const q = this.input.value.trim();
    const mine = ++this.seq;
    if (!q) { this.sug.replaceChildren(); return; }
    let d: any;
    try { d = await wb(['concordance', 'box', q]); } catch { return; }
    if (mine !== this.seq) return;
    this.sug.replaceChildren();
    const group = (label: string, rows: HTMLElement[]) => {
      if (!rows.length) return;
      const g = h('div', 'conc-sug-group');
      g.dataset.group = label.toLowerCase().replace(/\s+/g, '-');
      g.append(h('div', 'label', label), ...rows);
      this.sug.append(g);
    };
    const entry = (e: any, places?: number) => {
      const b = h('button', 'entry-row conc-sug-row');
      b.dataset.strong = e.strong;
      const top = h('div', 'entry-top');
      top.append(lemmaEl(e.lemma ?? '', e.lang), h('span', 'translit', e.translit || ''), h('span', 'muted small', ` ${e.strong}`));
      const n = places ?? e.occurrences ?? e.n;
      if (n !== undefined) top.append(h('span', 'chip', `${n} places`));
      b.append(top);
      if (e.definition) b.append(h('p', 'small', e.definition));
      b.onclick = () => this.pick({ strong: e.strong });
      return b;
    };
    // a typed number goes first, being exact; the groups after it are the box's own (C-12)
    group('Number', (d.number || []).map((e: any) => entry(e)));
    group('English words', (d.english || []).map((f: any) => {
      const b = h('button', 'conc-sug-row conc-form');
      b.dataset.form = f.form;
      b.append(h('span', 'conc-form-word', f.form), h('span', 'muted small', `${f.n}`));
      b.onclick = () => this.pick({ word: f.form });
      return b;
    }));
    group('Original words', (d.original || []).map((e: any) => entry(e)));
    group('Sounds like', (d.sounds || []).map((e: any) => entry(e)));
    if (!this.sug.childElementCount) this.sug.append(h('p', 'muted small conc-none', `Nothing begins with “${q}”.`));
  }

  /** Picking opens a new tab beside this one, a copy of it with its pages kept (C-13). */
  private pick(o: Open) {
    this.sug.replaceChildren();
    this.input.value = '';
    openConcordance({ ...o, from: { ...this.st, steps: [...this.st.steps] } });
  }

  private async enter(q: string) {
    if (!q) return;
    this.sug.replaceChildren();
    if (isNumber(q)) return this.pick({ strong: q });
    // what is typed never starts with a dash: it would reach wb as a flag
    if (q.startsWith('-')) { toast('Type a word, a number like H7068 or a place'); return; }
    // Enter on a word is a pick like a click on a suggestion: a new tab, the word alone (C-13)
    if (/^[a-z’'][a-z’'-]*$/i.test(q)) return this.pick({ word: q.toLowerCase() });
    this.input.value = '';
    Object.assign(this.st, { tab: 'interlinear', ref: q, offset: 0 });
    return this.draw();
  }

  // ---- the letter strip (C24) -------------------------------------------------------------------------------------------
  private drawLetters() {
    this.strip.replaceChildren();
    this.strip.setAttribute('aria-label', 'Letters');
    for (const l of this.letters) {
      const b = button('conc-letter', l.letter.toUpperCase(), () => void this.letter(l.letter));
      b.dataset.letter = l.letter;
      if (!l.words) { b.disabled = true; b.title = 'No word starts with this letter'; }
      else b.title = `${l.words} words, ${l.places.toLocaleString()} places`;
      b.classList.toggle('on', this.st.letter === l.letter);
      this.strip.append(b);
    }
  }

  private async letter(c: string) {
    // after a search the letter does not clear it: Back to <word> returns (C-11)
    if (this.st.word && !this.st.letter) this.st.back = this.st.word;
    Object.assign(this.st, { tab: 'english', letter: c });
    await this.draw();
  }

  // ---- the page -------------------------------------------------------------------------------------------------------
  private drawTabs() {
    this.tabs.replaceChildren();
    for (const [t, label] of TABS) {
      const b = button(`conc-tab${this.st.tab === t ? ' on' : ''}`, label, () => {
        this.st.tab = t;
        if (t === 'english') this.st.letter = '';
        void this.draw();
      });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(this.st.tab === t));
      b.dataset.tab = t;
      this.tabs.append(b);
    }
  }

  private step(line: string) {
    if (this.st.steps[this.st.steps.length - 1] !== line) this.st.steps.push(line);
  }

  async draw() {
    this.drawTabs();
    this.drawLetters();
    const mine = ++this.seq;
    this.body.replaceChildren();
    try {
      if (this.st.tab === 'english') await this.english();
      else if (this.st.tab === 'interlinear') await this.interlinear();
      else await this.entries();
    } catch (e) {
      if (mine === this.seq) this.body.replaceChildren(h('p', 'error', String(e instanceof Error ? e.message : e)));
    }
  }

  // ---- English (C1, C7, C9, C19, C20, C24) ------------------------------------------------------------------------------
  private async english() {
    const st = this.st;
    if (st.letter) return this.letterPage();
    if (!st.word) {
      this.body.append(h('p', 'muted conc-hint', 'Type a word above, or press a letter, to open its page. The page lists every place of the word in Bible order, like the printed Strong’s.'));
      return;
    }
    const d = await wb(['concordance', st.word, '--forms', st.mode]);
    this.step(`english ${st.word}`);
    const head = h('header', 'conc-head');
    head.append(h('h2', 'conc-word', st.word), h('span', 'muted small conc-count', `${d.places} places in ${d.verses} verses`));
    if (!d.small) {
      const sw = h('div', 'conc-switch');
      for (const [m, label] of [['all', 'All forms'], ['one', 'This word']] as const) {
        const b = button(`conc-sw${st.mode === m ? ' on' : ''}`, label, async () => {
          if (st.mode === m) return;
          st.mode = m;
          await wb(['settings', 'concordance', 'forms', m]).catch(() => {});
          void this.draw();
        });
        b.dataset.mode = m;
        b.setAttribute('aria-pressed', String(st.mode === m));
        sw.append(b);
      }
      head.append(sw);
    }
    this.body.append(head);
    if (d.kind === 'run') {
      const list = h('div', 'conc-lines');
      for (const l of d.lines) list.append(this.line(l, true));
      this.body.append(list);
    } else {
      for (const g of d.groups) this.body.append(this.group(g, async () => (await wb(['concordance', st.word, '--forms', st.mode, '--book', g.code])).groups[0], d.kind === 'books'));
    }
    // the other forms, a click away (C22)
    const others = (d.forms || []).filter((f: any) => f.form !== st.word);
    if (others.length && d.mode === 'one' && !d.small) {
      const foot = h('footer', 'conc-forms');
      foot.append(h('span', 'label', 'Other forms'));
      for (const f of others) {
        const b = button('chip link conc-other', `${f.form} ${f.n}`, () => { st.word = f.form; void this.draw(); });
        b.dataset.form = f.form;
        foot.append(b);
      }
      this.body.append(foot);
    }
  }

  private async letterPage() {
    const st = this.st;
    const d = await wb(['forms', st.letter]);
    this.step(`letter ${st.letter}`);
    const head = h('header', 'conc-head');
    if (st.back) {
      const back = button('link-btn conc-letter-back', `Back to ${st.back}`, () => { st.word = st.back; st.back = ''; st.letter = ''; void this.draw(); }, 'left');
      head.append(back);
    }
    head.append(h('h2', 'conc-word', st.letter.toUpperCase()), h('span', 'muted small conc-count', `${d.forms.length} words, ${d.total.toLocaleString()} places`));
    this.body.append(head);
    const list = h('div', 'conc-forms-list');
    for (const f of d.forms) {
      const b = button('conc-form-btn', '', () => { st.word = f.form; st.letter = ''; st.back = ''; void this.draw(); });
      b.dataset.form = f.form;
      b.append(h('span', 'conc-form-word', f.form), h('span', 'muted small', ` ${f.n}`));
      list.append(b);
    }
    this.body.append(list);
  }

  /** A place: the reference (opens the verse card), the words around the marked word, its number (opens its entry). */
  private line(l: any, withNumber: boolean): HTMLElement {
    const row = h('div', 'conc-line');
    row.dataset.anchor = l.anchor;
    const ref = button('ref-link conc-ref', l.ref, ev => void verseCard(`${l.code} ${l.c}:${l.v}`, ref, ev));
    row.append(ref);
    if (l.word !== undefined) {
      const ctx = h('span', 'conc-ctx');
      ctx.append(document.createTextNode(l.before), h('mark', 'conc-mark', l.word), document.createTextNode(l.after));
      row.append(ctx);
    }
    if (withNumber && l.strong) {
      const n = button('chip link conc-num', l.strong, () => this.pick({ strong: l.strong }));
      n.title = `The entry for ${l.strong}`;
      row.append(n);
    }
    return row;
  }

  /** A group of places: its name and count, 4 lines, and "N more" (which shows the rest of it). */
  private group(g: any, rest: () => Promise<any>, words: boolean): HTMLElement {
    const sec = h('section', 'conc-group');
    sec.dataset.group = g.key ?? g.code;
    const head = h('header', 'conc-group-head');
    head.append(h('h3', 'conc-group-name', g.label ?? g.name), h('span', 'chip', String(g.count)));
    const lines = h('div', 'conc-lines');
    for (const l of g.lines) lines.append(this.line(l, words));
    sec.append(head, lines);
    if (g.more > 0) {
      const more = button('link-btn conc-more', `${g.more} more`, async () => {
        const full = await rest();
        lines.replaceChildren(...full.lines.map((l: any) => this.line(l, words)));
        more.remove();
      });
      sec.append(more);
    }
    return sec;
  }

  // ---- Hebrew and Greek (C3, C4, C8, C9) ---------------------------------------------------------------------------------
  private async entries() {
    const st = this.st;
    const lang = st.tab === 'hebrew' ? 'hebrew' : 'greek';
    if (st.entry && langOf(st.entry) === st.tab) return this.entry();
    // the dictionary in number order: a page from a number
    const find = h('form', 'conc-find');
    const num = h('input', 'field conc-from') as HTMLInputElement;
    num.placeholder = `Go to a number, like ${lang === 'hebrew' ? 'H7068' : 'G2205'}`;
    num.setAttribute('aria-label', 'Go to a number');
    find.append(num, button('btn', 'Go', () => find.requestSubmit()));
    const from = st.from;
    find.onsubmit = e => {
      e.preventDefault();
      const v = num.value.trim();
      if (isNumber(v)) { st.entry = v.toUpperCase(); st.tab = langOf(v); void this.draw(); } else { st.from = v; void this.draw(); }
    };
    this.body.append(find);
    const d = await wb(['strong', '--list', lang, ...(from ? ['--from', from] : [])]);
    this.step(`${lang} ${d.from ?? ''}`);
    const list = h('div', 'conc-entries');
    for (const e of d.entries) {
      const b = h('button', 'entry-row conc-entry-row');
      b.dataset.strong = e.strong;
      const top = h('div', 'entry-top');
      top.append(lemmaEl(e.lemma, lang === 'greek' ? 'grc' : 'heb'), h('span', 'translit', e.translit || ''), h('span', 'muted small', ` ${e.strong}`));
      b.append(top);
      if (e.definition) b.append(h('p', 'small', e.definition));
      b.onclick = () => { st.entry = e.strong; void this.draw(); };
      list.append(b);
    }
    this.body.append(list);
    if (d.next) this.body.append(button('btn conc-next-page', `Next entries, from ${d.next}`, () => { st.from = d.next; void this.draw(); }));
  }

  private async entry() {
    const st = this.st;
    const [e, p] = await Promise.all([wb(['strong', st.entry]), wb(['uses', st.entry, '--by', st.by])]);
    this.step(`entry ${st.entry}`);
    const nav = h('div', 'conc-entry-nav');
    const go = (dir: '--prev' | '--next', label: string, ico: string) => {
      const b = button('icon-btn conc-step', '', async () => {
        const n = await wb(['strong', st.entry, dir]);
        if (!n.strong) { toast(`${st.entry} is the ${n.end} entry`); return; }
        st.entry = n.strong;
        void this.draw();
      }, ico);
      b.title = label;
      b.setAttribute('aria-label', label);
      b.dataset.dir = dir.slice(2);
      return b;
    };
    nav.append(go('--prev', 'The entry before', 'left'), go('--next', 'The entry after', 'right'));
    const back = button('link-btn conc-all-entries', `All ${st.tab === 'hebrew' ? 'Hebrew' : 'Greek'} entries`, () => { st.entry = ''; void this.draw(); });
    nav.append(back);
    this.body.append(nav);
    const head = h('header', 'conc-entry-head');
    const tr = h('div');
    tr.append(h('div', 'translit', e.translit || ''), h('div', 'muted small', `${e.strong} · Strong's${e.pron ? ` · ${e.pron}` : ''} · ${e.occurrences} places`));
    head.append(lemmaEl(e.lemma, e.lang), tr);
    this.body.append(head);
    if (e.definition) this.body.append(h('p', 'def', e.definition));
    if (e.usage) this.body.append(h('p', 'usage', `KJV: ${e.usage}`));
    const sw = h('div', 'conc-switch conc-by');
    for (const [m, label] of [['word', 'By English word'], ['book', 'By book']] as const) {
      const b = button(`conc-sw${st.by === m ? ' on' : ''}`, label, () => { st.by = m; void this.draw(); });
      b.dataset.by = m;
      b.setAttribute('aria-pressed', String(st.by === m));
      sw.append(b);
    }
    this.body.append(sw);
    for (const g of p.groups) this.body.append(this.group(g, async () => (await wb(['uses', st.entry, '--by', st.by, '--group', g.key])).groups[0], false));
  }

  // ---- Interlinear (C11, C12) -------------------------------------------------------------------------------------------
  private async interlinear() {
    const st = this.st;
    const find = h('form', 'conc-find');
    const ref = h('input', 'field conc-ref-input') as HTMLInputElement;
    ref.placeholder = 'A verse, a passage or a chapter, like Numbers 25:11';
    ref.value = st.ref;
    ref.setAttribute('aria-label', 'Place');
    find.append(ref, button('btn', 'Show', () => find.requestSubmit()));
    find.onsubmit = e => { e.preventDefault(); const v = ref.value.trim(); if (v.startsWith('-')) { toast('Type a place, like Numbers 25:11'); return; } st.ref = v; st.offset = 0; void this.draw(); };
    this.body.append(find);
    if (!st.ref) {
      this.body.append(h('p', 'muted conc-hint', 'The original words under each verse of a place, with their numbers.'));
      return;
    }
    const d = await wb(['interlinear', st.ref, ...(st.offset ? ['--offset', String(st.offset)] : [])]);
    this.step(`interlinear ${st.ref}`);
    const rtl = d.lang === 'heb';
    const tools = h('div', 'conc-tools');
    const all = (open: boolean) => this.body.querySelectorAll<HTMLElement>('.conc-verse').forEach(v => v.classList.toggle('open', open));
    tools.append(button('link-btn', 'Expand all', () => all(true)), button('link-btn', 'Collapse all', () => all(false)));
    this.body.append(tools);
    for (const v of d.verses) {
      const sec = h('section', `conc-verse${d.verses.length <= 3 ? ' open' : ''}`);
      sec.dataset.verse = `${d.book.code}.${v.c}:${v.v}`;
      const toggle = button('conc-verse-head', '', () => sec.classList.toggle('open'));
      toggle.setAttribute('aria-expanded', String(sec.classList.contains('open')));
      toggle.append(h('span', 'conc-verse-ref', `${d.book.name} ${v.c}:${v.v}`));
      sec.append(toggle, h('p', 'conc-verse-text', v.text));
      const grid = h('div', 'inter-grid conc-words');
      grid.dir = rtl ? 'rtl' : 'ltr';
      for (const w of v.words) {
        const c = h('div', 'inter-card');
        const o = h('div', 'inter-orig', w.original);
        o.lang = rtl ? 'he' : 'grc';
        const s = button('inter-strong', w.strong || '', () => { if (w.strong) { st.entry = w.strong; st.tab = langOf(w.strong); void this.draw(); } });
        c.append(o, h('div', 'inter-translit', w.translit || ''), s, h('div', 'inter-gloss', w.gloss || ''));
        c.title = (w.parse || []).map((x: any) => x.text).join('; ');
        grid.append(c);
      }
      sec.append(grid);
      toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(sec.classList.contains('open'))));
      this.body.append(sec);
    }
    if (d.more || st.offset) {
      const nav = h('div', 'conc-pages');
      if (st.offset) nav.append(button('btn conc-prev-verses', 'The earlier verses', () => { st.offset = Math.max(0, st.offset - d.verses.length); void this.draw(); }));
      if (d.more) nav.append(button('btn conc-more-verses', `The next verses (${d.total} in all)`, () => { st.offset += d.verses.length; void this.draw(); }));
      this.body.append(nav);
    }
  }
}
