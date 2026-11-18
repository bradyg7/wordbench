// Browser read-aloud for the text already drawn in the reader. Speech is local to this device; no audio or study data
// is stored. The command language owns command names; this module owns speech state and its small reader control bar.
import { wb, type Book, type Chapter } from './api';
import type { Drawn } from './reader';
import { button, h } from './ui';
import { markReading } from './planreading';

export interface ListenSpan { book: string; c1: number; v1: number; c2: number; v2: number }
export interface ListenCommand { action: string; span?: ListenSpan; rate?: number; name?: string }

interface Unit { v: number; text: string; starts: { i: number; at: number }[] }
interface State { span: ListenSpan; open: boolean; book: Book; ch: number; units: Unit[]; at: number; paused: boolean }
interface Host {
  books: () => Book[];
  drawn: () => Drawn | null;
  topVerse: () => number;
  rememberPlace: () => void;
  show: (code: string, chapter: number, verse: number) => Promise<Drawn | null>;
  root: HTMLElement;
  scroller: HTMLElement;
}

const VOICE_KEY = 'wb.listen.voice';
const RATE_KEY = 'wb.listen.rate';
const DEFAULT_RATE = 1;
const clampRate = (n: number) => Number.isFinite(n) ? Math.min(2, Math.max(.5, n)) : DEFAULT_RATE;
const stored = (key: string) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode: this run only */ } };
const spokenWord = (word: string) => word.replace(/[A-Z]{2,}/g, x => x[0] + x.slice(1).toLowerCase());

function spokenHeading(book: Book, chapter: number): string {
  const name = book.name.replace(/^([123]) /, (_, n: string) => ({ '1': 'First', '2': 'Second', '3': 'Third' }[n]!));
  if (book.chapters === 1) return name;
  return name === 'Psalms' ? `Psalm ${chapter}` : `${name} chapter ${chapter}`;
}

function verseUnit(verse: Chapter['verses'][number]): Unit {
  let text = '';
  const starts: Unit['starts'] = [];
  for (const word of verse.words) {
    text += (word.lead || '').replace(/¶\s*/g, '');
    starts.push({ i: word.i, at: text.length });
    text += spokenWord(word.text) + (word.trail || '');
  }
  return { v: verse.v, text: text.trim(), starts };
}

function chapterUnits(chapter: Chapter, book: Book, from: number, to: number): Unit[] {
  const verses = chapter.verses.filter(v => (!from || v.v >= from) && (!to || v.v <= to));
  const includeHeading = from <= 1 && verses.length > 0;
  const units: Unit[] = includeHeading ? [{ v: 0, text: spokenHeading(book, chapter.chapter), starts: [] }] : [];
  if (includeHeading && chapter.title) units.push({ v: 0, text: chapter.title, starts: [] });
  return [...units, ...verses.map(verseUnit)];
}

function chooseVoice(voices: SpeechSynthesisVoice[], wanted = ''): SpeechSynthesisVoice | null {
  const english = voices.filter(v => v.localService && v.name && !/undefined/i.test(v.name) && /^en\b/i.test((v.lang || '').replace('_', '-')));
  if (wanted) {
    const match = english.find(v => v.name.toLowerCase().includes(wanted.toLowerCase()));
    if (match) return match;
  }
  const natural = (v: SpeechSynthesisVoice) => /natural/i.test(v.name) && !/multiling/i.test(v.name);
  return english.find(v => natural(v) && /^en[-_]us/i.test(v.lang)) || english.find(natural) || english.find(v => v.default)
    || english.find(v => /^en[-_]us/i.test(v.lang)) || english[0] || null;
}

/** Create the local browser speech controller. `show` redraws the main reader without adding a history entry. */
export function createReadAloud(host: Host) {
  let now: State | null = null;
  let voice: SpeechSynthesisVoice | null = null;
  let utterance: SpeechSynthesisUtterance | null = null;
  let run = 0;
  let bar: HTMLElement | null = null;
  let mark: HTMLElement[] = [];
  let markWord: HTMLElement | null = null;
  let lastScroll = 0;
  let rate = clampRate(Number(stored(RATE_KEY)) || DEFAULT_RATE);

  const speech = () => window.speechSynthesis;
  const clearMark = () => {
    mark.forEach(e => e.classList.remove('reading'));
    mark = [];
    markWord?.classList.remove('reading-word');
    markWord = null;
  };
  const stop = () => {
    run++;
    if (window.speechSynthesis) speech().cancel();
    utterance = null;
    now = null;
    clearMark();
    if (bar) bar.hidden = true;
  };
  const sayStatus = (text: string) => {
    const status = bar?.querySelector<HTMLElement>('.listen-status');
    if (status) status.textContent = text;
  };
  const updateBar = () => {
    if (!now) return;
    ensureBar();
    const unit = now.units[now.at];
    const where = `${now.book.name} ${now.ch}${unit?.v ? `:${unit.v}` : ''}`;
    bar!.querySelector<HTMLElement>('.listen-place')!.textContent = where;
    const pause = bar!.querySelector<HTMLButtonElement>('[data-listen=pause]')!;
    pause.textContent = now.paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-label', now.paused ? 'Resume read-aloud' : 'Pause read-aloud');
    const select = bar!.querySelector<HTMLSelectElement>('.listen-voice')!;
    if (voice && select.value !== voice.name) select.value = voice.name;
    const speed = bar!.querySelector<HTMLSelectElement>('.listen-speed')!;
    speed.value = String(rate);
    bar!.hidden = false;
  };
  const ensureBar = () => {
    if (bar) { bar.hidden = false; return; }
    bar = h('div', 'listenbar');
    bar.id = 'listenbar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Read aloud');
    const place = h('span', 'listen-place');
    const status = h('span', 'listen-status');
    status.setAttribute('aria-live', 'polite');
    const pause = button('btn', 'Pause', () => { void execute({ action: now?.paused ? 'resume' : 'pause' }); });
    pause.dataset.listen = 'pause';
    const stopButton = button('btn', 'Stop', () => { stop(); });
    stopButton.dataset.listen = 'stop';
    const voiceSelect = h('select', 'listen-voice');
    voiceSelect.setAttribute('aria-label', 'Speech voice');
    voiceSelect.onchange = () => { const hit = getVoices().find(v => v.name === voiceSelect.value); if (hit) setVoice(hit); };
    const speedSelect = h('select', 'listen-speed');
    speedSelect.setAttribute('aria-label', 'Speech speed');
    for (const n of [.5, .75, 1, 1.25, 1.5, 2]) {
      const o = document.createElement('option'); o.value = String(n); o.textContent = `${n}×`; speedSelect.append(o);
    }
    speedSelect.value = String(rate);
    speedSelect.onchange = () => { rate = clampRate(Number(speedSelect.value)); save(RATE_KEY, String(rate)); if (now && !now.paused) speakCurrent(true); };
    bar.append(place, status, voiceSelect, speedSelect, pause, stopButton);
    document.body.append(bar);
  };
  const getVoices = () => window.speechSynthesis ? speech().getVoices() : [];
  const fillVoices = () => {
    if (!bar) return;
    const select = bar.querySelector<HTMLSelectElement>('.listen-voice')!;
    const list = getVoices().filter(v => v.localService && /^en\b/i.test((v.lang || '').replace('_', '-')) && v.name && !/undefined/i.test(v.name));
    const names = list.map(v => v.name).join('|');
    if (select.dataset.names !== names) {
      select.dataset.names = names;
      select.replaceChildren(...list.map(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name; return o; }));
    }
    if (voice && list.some(v => v.name === voice!.name)) select.value = voice.name;
  };
  const markVerse = (v: number) => {
    clearMark();
    if (!v) return;
    const drawn = host.drawn();
    if (!drawn) return;
    mark = drawn.el.filter((_, k) => drawn.v[k] === v);
    mark.forEach(e => e.classList.add('reading'));
    if (!mark.length || Date.now() - lastScroll < 8000) return;
    const first = mark[0], area = host.scroller.getBoundingClientRect(), box = first.getBoundingClientRect();
    if (box.height && (box.top < area.top + area.height * .1 || box.top > area.top + area.height * .75)) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  host.scroller.addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true });
  const markAt = (unit: Unit, charIndex: number) => {
    let i: number | null = null;
    for (const start of unit.starts) { if (start.at > charIndex) break; i = start.i; }
    if (i === null) return;
    const drawn = host.drawn();
    const k = drawn?.v.findIndex((v, at) => v === unit.v && drawn.i[at] === i) ?? -1;
    const next = k >= 0 ? drawn?.el[k] : undefined;
    if (!next || next === markWord) return;
    markWord?.classList.remove('reading-word');
    next.classList.add('reading-word');
    markWord = next;
  };
  const currentVoice = async () => {
    let list = getVoices();
    if (!list.length && window.speechSynthesis) {
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(resolve, 1500);
        speech().addEventListener('voiceschanged', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      list = getVoices();
    }
    voice = chooseVoice(list, stored(VOICE_KEY));
    rate = clampRate(Number(stored(RATE_KEY)) || rate); // Settings ▸ Reading may have changed it since
    fillVoices();
    return voice;
  };
  const speakCurrent = (restart = false) => {
    if (!now || now.paused) return;
    if (restart) { run++; if (window.speechSynthesis) speech().cancel(); }
    const token = run;
    const unit = now.units[now.at];
    if (!unit) return void advance(token);
    markVerse(unit.v);
    updateBar();
    sayStatus(voice?.name || '');
    const u = new SpeechSynthesisUtterance(unit.text);
    u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = rate;
    u.onstart = () => { if (token === run) sayStatus(voice?.name || ''); };
    u.onboundary = e => { if (token === run && e.name === 'word') markAt(unit, e.charIndex); };
    u.onend = () => { if (token !== run) return; now!.at++; speakCurrent(); };
    u.onerror = e => {
      if (token !== run || e.error === 'canceled' || e.error === 'interrupted') return;
      sayStatus(e.error === 'not-allowed' ? 'Speech was blocked. Start again from the Listen button.' : `Speech stopped (${e.error}).`);
      run++;
      now = null;
      clearMark();
      if (bar) bar.hidden = false;
    };
    utterance = u;
    speech().speak(u);
  };
  const nextChapter = (): { book: Book; chapter: number } | null => {
    if (!now) return null;
    if (!now.open && now.ch >= now.span.c2) return null;
    if (now.ch < now.book.chapters) return { book: now.book, chapter: now.ch + 1 };
    if (!now.open) return null;
    const list = host.books(), index = list.findIndex(b => b.code === now!.book.code);
    return list[index + 1] ? { book: list[index + 1], chapter: 1 } : null;
  };
  async function advance(token: number) {
    if (!now || token !== run) return;
    void offerMarkRead(now.book, now.ch);
    const next = nextChapter();
    if (!next) { stop(); return; }
    const view = await host.show(next.book.code, next.chapter, 1);
    if (!view || !now || token !== run) return;
    now.book = next.book;
    now.ch = next.chapter;
    now.units = chapterUnits(view.chapter, next.book, 0, !now.open && now.ch === now.span.c2 ? now.span.v2 : 0);
    now.at = 0;
    speakCurrent();
  }
  function setVoice(v: SpeechSynthesisVoice) {
    voice = v;
    save(VOICE_KEY, v.name);
    if (now && !now.paused) speakCurrent(true);
    updateBar();
  }
  async function start(span?: ListenSpan): Promise<string> {
    if (!window.speechSynthesis) throw new Error('This browser cannot read aloud.');
    stop();
    const token = run;
    let current = host.drawn();
    const openEnded = !span;
    if (!span) {
      if (!current) throw new Error('There is no chapter in the reader to read yet.');
      const verse = host.topVerse();
      span = { book: current.chapter.code, c1: current.chapter.chapter, v1: verse > 1 ? verse : 0, c2: current.chapter.chapter, v2: 0 };
    }
    const book = host.books().find(b => b.code === span!.book);
    if (!book) throw new Error(`No book ${span.book} is open in this reader.`);
    if (!current || current.chapter.code !== book.code || current.chapter.chapter !== span.c1) {
      host.rememberPlace();
      current = await host.show(book.code, span.c1, span.v1 > 1 ? span.v1 : 1);
    }
    if (token !== run) return 'Read-aloud canceled';
    if (!current) throw new Error('The passage could not be opened.');
    voice = await currentVoice();
    if (token !== run) return 'Read-aloud canceled';
    if (!voice) throw new Error('This device has no local English speech voice.');
    const units = chapterUnits(current.chapter, book, span.v1, span.c1 === span.c2 ? span.v2 : 0);
    if (!units.length) throw new Error('That passage has no readable verses.');
    now = { span, open: openEnded, book, ch: span.c1, units, at: 0, paused: false };
    run++;
    updateBar();
    speakCurrent();
    return `Reading ${book.name} ${span.c1}${span.v1 > 1 ? `:${span.v1}` : ''} aloud with ${voice.name}`;
  }
  async function execute(command: ListenCommand): Promise<string> {
    switch (command.action) {
      case 'start': return start(command.span);
      case 'pause':
        if (!now) throw new Error('Nothing is being read.');
        if (!now.paused) { now.paused = true; run++; speech().cancel(); updateBar(); sayStatus('Paused'); }
        return 'Paused';
      case 'resume':
        if (!now) throw new Error('Nothing is being read. To start: listen');
        if (now.paused) { now.paused = false; run++; speakCurrent(); }
        return 'Reading again from the start of the verse';
      case 'stop':
        if (!now) throw new Error('Nothing is being read.');
        stop(); return 'Stopped reading';
      case 'voices': {
        const list = getVoices().filter(v => v.localService && /^en\b/i.test((v.lang || '').replace('_', '-')));
        return `Local English voices: ${list.map(v => `${v.name}${voice?.name === v.name ? ' (in use)' : ''}`).join(' · ') || 'none'}`;
      }
      case 'speed':
        rate = clampRate(command.rate ?? DEFAULT_RATE); save(RATE_KEY, String(rate));
        if (now && !now.paused) speakCurrent(true);
        updateBar(); return `Reading speed ${rate}`;
      case 'voice': {
        const hits = getVoices().filter(v => v.localService && /^en\b/i.test((v.lang || '').replace('_', '-')) && v.name.toLowerCase().includes((command.name || '').toLowerCase()));
        if (!hits.length) throw new Error(`No local English voice called “${command.name}”. Use listen voices to list them.`);
        if (hits.length > 1) throw new Error(`Which voice? ${hits.map(v => v.name).join(' · ')}`);
        setVoice(hits[0]); return `Reading with ${voice!.name}`;
      }
      case 'mine': throw new Error('Personal recordings are not part of read-aloud yet.');
      default: throw new Error('Not a read-aloud command.');
    }
  }
  function stopForNavigation() { stop(); }
  function state() { return now ? { place: `${now.book.name} ${now.ch}${now.units[now.at]?.v ? `:${now.units[now.at].v}` : ''}`, paused: now.paused, voice: voice?.name || '', rate } : null; }
  if (window.speechSynthesis) speech().addEventListener('voiceschanged', fillVoices);
  return { execute, stopForNavigation, state };
}

/** Listen read a chapter through that today's plan asks for: offer Mark read (2dcf; Settings ▸ Reading, on by default). */
async function offerMarkRead(book: Book, ch: number) {
  if (stored('wb.listen.markRead') === 'off') return;
  let today: any;
  try { today = await wb(['plan', 'today']); } catch { return; }
  const key = `${book.code}.${ch}`;
  const plan = (today?.plans || []).find((p: any) => (p.today?.entries || []).includes(key) && !p.today?.done);
  if (!plan) return;
  let rail = document.querySelector<HTMLElement>('.page-deletions');
  if (!rail) { rail = h('div', 'page-deletions'); document.body.append(rail); }
  const row = h('div', 'page-deletion');
  row.setAttribute('role', 'status');
  const place = `${book.name} ${ch}`;
  row.append(h('span', '', `Listened to ${place}. `), button('btn small', 'Mark read', async () => {
    try { await markReading(plan.id, `${book.code}.${ch}`); row.replaceChildren(h('span', '', `${place} marked read`)); setTimeout(() => row.remove(), 2500); }
    catch (x) { row.replaceChildren(h('span', '', String(x))); }
  }), button('btn small ghost', 'Not now', () => row.remove()));
  rail.append(row);
  setTimeout(() => row.remove(), 30000);
}
