// The hub the shell, the panes and the command language share: the reader's place and how to move it, the place the
// person last clicked (where a note, a highlight or a thread-add goes), and the layers drawn. main.ts fills it in.
import type { Book } from './api';
import type { Drawn } from './reader';
import type { Change } from './dock';

export interface At { anchor: string; label: string }

export const app = {
  books: [] as Book[],
  drawn: null as Drawn | null,
  /** The place last clicked or selected in the reader; null until then (the verse at the top stands in). */
  picked: null as At | null,
  go: async (_code: string, _chapter: number, _verse = 1): Promise<void> => {},
  step: (_n: number) => {},
  back: () => false as boolean,
  /** Reads the chapter's marks again (after a note, highlight or thread change) and draws them. */
  refreshMarks: async () => {},
  /** Applies visibility preferences to the marks already loaded in every reader. */
  repaintLayers: () => {},
  topVerse: () => 1,
  /** The reader's version (KJV, YLT); setting it redraws the chapter with the same verse at the top. */
  version: () => 'KJV',
  setVersion: async (_v: string): Promise<string> => '',
  /** The text size, as a percent. */
  setSize: (_percent: number) => {},
  size: () => 100,
  findInChapter: (_q: string) => {},
  /** Opens a place as a second reader in a pane (never moves the reader). */
  secondReader: (_ref: string, _version?: string) => {},
  /** The second readers open, in the order they were opened: each one's pane and the chapter it shows. */
  readers: (): { pane: string; code: string; chapter: number; label: string }[] => [],
  /** Runs a line as if typed into the command field. */
  run: async (_line: string): Promise<string> => '',
  /** Something changed in the study folder (what, or everything when not said): the panes that show it read it again. */
  changed: (..._what: Change[]) => {},
};

export const book = (code: string) => app.books.find(b => b.code === code);

/** Where a capture goes: the place picked, else the verse at the top of the reader. */
export function here(): At {
  if (app.picked) return app.picked;
  const d = app.drawn;
  if (!d) return { anchor: 'GEN.1:1', label: 'Genesis 1:1' };
  const v = app.topVerse();
  return { anchor: `${d.chapter.code}.${d.chapter.chapter}:${v}`, label: `${d.chapter.name} ${d.chapter.chapter}:${v}` };
}

/** "JHN 3:16", "NUM.25:11.3-25:12.5", "Numbers 25:11" → the reader goes there (the place it left is kept for back). */
export function goTo(ref: string) {
  const m = /^([1-3A-Z]{3})[ .](\d+)(?::(\d+))?/.exec(ref);
  if (m && book(m[1])) return app.go(m[1], +m[2], m[3] ? +m[3] : 1);
  return app.run(`go ${ref}`);
}
