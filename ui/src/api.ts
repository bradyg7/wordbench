// The one door to Rust. In the app every call goes to a Tauri command (app/src-tauri/src/main.rs), which calls wb-core.
// Outside the app (the WebKit tests) the same answers come from fixtures that `wb fixture` generated from the database.
import { invoke } from '@tauri-apps/api/core';

export interface Word { i: number; lead?: string; text: string; trail?: string; strong?: string; italic?: boolean; nd?: boolean; wj?: boolean; para?: string }
export interface Verse { v: number; words: Word[] }
export interface Chapter { code: string; name: string; chapter: number; chapters: number; title?: string; verses: Verse[] }
export interface Mark { kind: string; code: string; c1: number; v1: number; i1: number | null; c2: number | null; v2: number | null; i2: number | null; id: string; color?: string }
export interface Marks { highlights: Mark[]; notes: Mark[]; threads: Mark[]; thread_names: Record<string, string> }
export interface ReaderView { chapter: Chapter; marks: Marks }
export interface Lexicon { strong: string; lang: string; lemma: string; translit?: string; pron?: string; pos?: string; derivation?: string; definition?: string; usage?: string }
export interface Count { strong: string; times: number; verses: number; books: number }
export interface Note { id: string; anchor: string; kind: string; quote: string; strong: string; created: string; text: string }
export interface WordView { reference: string; anchor: string; text: string; strong?: string; lexicon?: Lexicon; count?: Count; notes: Note[] }
export interface VerseView { reference: string; anchor: string; text: string; color?: string; notes: Note[]; threads: { id: string; name: string; color: string }[] }
export interface Book { id: number; code: string; name: string; chapters: number }

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
  reader: (code: string, chapter: number) => call<ReaderView>('reader', { code, chapter }),
  word: (code: string, chapter: number, verse: number, word: number) => call<WordView>('word', { code, chapter, verse, word }),
  verse: (code: string, chapter: number, verse: number) => call<VerseView>('verse', { code, chapter, verse }),
  books: () => call<Book[]>('books', {}),
  setWindow: (preset: string) => invoke<any>('set_window', { preset }),
  uiReady: (report: unknown) => (inApp ? invoke<any>('ui_ready', { report }) : Promise.resolve(null)),
};
