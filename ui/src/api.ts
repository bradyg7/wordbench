// The one door to Rust. In the app every call goes to a Tauri command (app/src-tauri/src/main.rs), which calls wb-core.
// Outside the app (the WebKit tests) the same answers come from fixtures that `wb fixture` generated from the database.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface Word { i: number; lead?: string; text: string; trail?: string; strong?: string; italic?: boolean; nd?: boolean; wj?: boolean; para?: string }
export interface Verse { v: number; words: Word[] }
export interface Chapter { code: string; name: string; chapter: number; chapters: number; title?: string; verses: Verse[]; version?: string }
export interface Mark { kind: string; code: string; c1: number; v1: number; i1: number | null; c2: number | null; v2: number | null; i2: number | null; id: string; color?: string }
export interface Marks { highlights: Mark[]; notes: Mark[]; threads: Mark[]; thread_names: Record<string, string> }
export interface Question { id: string; v: number; text: string }
export interface ReaderView { chapter: Chapter; marks: Marks; questions?: Question[] }
export interface Lexicon { strong: string; lang: string; lemma: string; translit?: string; pron?: string; pos?: string; derivation?: string; definition?: string; usage?: string }
export interface Count { strong: string; times: number; verses: number; books: number }
export interface Note { id: string; anchor: string; kind: string; quote: string; strong: string; created: string; text: string }
export interface WordView { reference: string; anchor: string; text: string; strong?: string; lexicon?: Lexicon; count?: Count; notes: Note[] }
export interface VerseView { reference: string; anchor: string; text: string; color?: string; notes: Note[]; threads: { id: string; name: string; color: string }[] }
export interface Book { id: number; code: string; name: string; chapters: number; testament?: string }
export interface PlanDay { day: number; date: string | null; label: string; entries: string[]; done: boolean; skipped?: boolean }
export interface Today { date: string; plans: { plan: string; id: string; day: number | null; of: number; behind: number; ahead: number; finished: boolean; to_read: PlanDay[]; next: PlanDay | null }[] }

export const inApp = '__TAURI_INTERNALS__' in window;

interface Answer<T> { data: T; rust_ms: number }

const fixtures = new Map<string, Promise<any>>();
function fixture(code: string, chapter: number): Promise<any> {
  const key = `${code}.${chapter}`;
  if (!fixtures.has(key)) fixtures.set(key, fetch(`fixtures/${key}.json`).then(r => {
    if (!r.ok) throw new Error(`No fixture for ${key} (npm run fixtures)`);
    return r.json();
  }));
  return fixtures.get(key)!;
}

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<Answer<T>> {
  if (inApp) return invoke<Answer<T>>(cmd, args);
  const a = args as any;
  if (cmd === 'books') return { data: (await fetch('fixtures/books.json').then(r => r.json())) as T, rust_ms: 0 };
  const f = await fixture(a.code, a.chapter);
  const data = cmd === 'reader' ? f.reader : cmd === 'word' ? f.words[`${a.verse}.${a.word}`] : f.verses[String(a.verse)];
  if (!data) throw new Error(`Not in the fixture: ${cmd} ${JSON.stringify(args)}`);
  return { data, rust_ms: 0 };
}

export const api = {
  /** `version`: KJV (the default) or another in the database; see wb reader --version. */
  reader: (code: string, chapter: number, version = 'KJV') => call<ReaderView>('reader', { code, chapter, version }),
  word: (code: string, chapter: number, verse: number, word: number) => call<WordView>('word', { code, chapter, verse, word }),
  verse: (code: string, chapter: number, verse: number) => call<VerseView>('verse', { code, chapter, verse }),
  books: () => call<Book[]>('books', {}),
  highlight: (anchor: string, color: string | null) => invoke<Answer<unknown>>('highlight', { anchor, color }),
  planToday: () => invoke<Answer<Today>>('plan_today', {}),
  readMark: (place: string) => invoke<Answer<unknown>>('read_mark', { place }),
  setWindow: (preset: string) => invoke<any>('set_window', { preset }),
  uiReady: (report: unknown) => (inApp ? invoke<any>('ui_ready', { report }) : Promise.resolve(null)),
};

// ---- every other action: the `wb` command table, run in-process (the UI and `wb` are one set of actions) -------------
// Outside the app (the WebKit tests) answers come from fixtures named by the command line (scripts/fixtures.mjs).
export const wbFixtureName = (argv: string[]) => argv.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

export async function wb(argv: string[], input?: string): Promise<any> {
  if (inApp) {
    const r = await invoke<Answer<{ json?: unknown; text?: string }>>('wb', { argv, input });
    return r.data.json !== undefined ? r.data.json : r.data.text;
  }
  const r = await fetch(`fixtures/wb/${wbFixtureName(argv)}.json`);
  if (!r.ok) throw new Error(`Not in the app: wb ${argv.join(' ')}`);
  return r.json();
}

/** A file dropped, pasted or picked, attached to a finding: its bytes go to Rust as they are (wb finding attach takes a
 *  path; a page has the bytes and no path). Outside the app there is nowhere to keep it. */
export async function attachToFinding(id: string, name: string, bytes: ArrayBuffer): Promise<any> {
  if (!inApp) throw new Error('Files are attached in the app');
  const r = await invoke<Answer<any>>('finding_attach', bytes, { headers: { 'wb-finding': encodeURIComponent(id), 'wb-name': encodeURIComponent(name) } });
  return r.data;
}

// `wb do` from a terminal: each line arrives as an event; the answer goes back with do_done.
export function onDo(run: (line: string) => Promise<{ ok: boolean; said?: string; error?: string }>) {
  if (!inApp) return;
  listen<{ id: number; line: string }>('wb-do', async e => {
    let reply;
    try { reply = await run(e.payload.line); } catch (x) { reply = { ok: false, error: String(x) }; }
    invoke('do_done', { id: e.payload.id, reply }).catch(() => {});
  });
}
