// The @ menu (notebook design row 12, NB5): `@` typed at the start of a line or after a space opens one menu (ui/src/menu.ts)
// of verses, pages, folders and Today. Typing a reference ("josh 1:9") offers that verse, its words read from the database
// to confirm it exists. A verse is placed as its plain reference text (the file keeps only the reference, decided
// 2026-11-21) and the page draws it as a chip; a page, a folder or Today is placed as a [[link]].
import { wb } from './api';
import { app } from './app';
import { bookMatches, splitReference } from './scripturefield';
import { filterGroups, openMenu, type MenuGroup, type MenuItem } from './menu';
import type { Host } from './blocks';
import type { Writer } from './blockedit';

type Titled = { id: string; title: string; insert: string; kind: string };
const norm = (s: string) => s.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').replace(/^([1-3])(?=[a-z])/, '$1 ').trim();

/** The reference a typed line names, as the database spells it ("josh 1:9" → "Joshua 1:9"), or null. */
export function referenceOf(line: string): string | null {
  const { book, rest } = splitReference(line);
  if (!book || !/\d/.test(rest)) return null;
  const hits = bookMatches(app.books, book);
  const chosen = hits.find(b => norm(b.name) === norm(book)) ?? (hits.length === 1 ? hits[0] : undefined);
  return chosen ? `${chosen.name} ${rest.replace(/\s+/g, '')}` : null;
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function atMenu(ta: Writer, host: Pick<Host, 'state' | 'titles'>, self?: string) {
  const at = ta.selectionStart - 1;
  if (at < 0 || ta.value[at] !== '@' || (at > 0 && !/\s/.test(ta.value[at - 1]))) return;
  host.state.menuClose?.();
  let picked = false;
  let titles: Titled[] = [];
  const seen = new Map<string, string | null>();   // a reference → its first words (the database accepted it), or null (it did not)
  let handle: ReturnType<typeof openMenu> | null = null;

  const takeOut = () => {
    if (!ta.isConnected || ta.value[at] !== '@') return;
    ta.value = ta.value.slice(0, at) + ta.value.slice(at + 1);
    ta.setSelectionRange(at, at);
    ta.dispatchEvent(new Event('input'));
  };
  const place = (text: string) => {
    if (!ta.isConnected || ta.value[at] !== '@') return;
    ta.value = ta.value.slice(0, at) + text + ta.value.slice(at + 1);
    ta.setSelectionRange(at + text.length, at + text.length);
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  const check = (ref: string) => {
    if (seen.has(ref)) return;
    seen.set(ref, null);
    void wb(['scripture', ref]).then(d => {
      const first = d?.verses?.[0];
      if (first) seen.set(ref, String(first.text).slice(0, 48));
      else seen.delete(ref);
    }).catch(() => seen.delete(ref)).finally(() => { if (handle?.open) handle.refresh(); });
  };

  const groupsFor = (q: string): MenuGroup[] => {
    const out: MenuGroup[] = [];
    const ref = referenceOf(q);
    if (ref) {
      check(ref);
      const first = seen.get(ref);
      if (first) out.push({ title: 'Verses', items: [{ id: `verse:${ref}`, label: ref, icon: '¶', hint: first }] });
    }
    const item = (t: Titled): MenuItem => ({ id: `${t.kind === 'thread' ? 'folder' : 'page'}:${t.insert}`, label: t.title, icon: t.kind === 'thread' ? '▢' : '↗', keywords: [t.insert] });
    const day = today();
    const rest: MenuGroup[] = [
      { title: 'Today', items: [{ id: `day:${day}`, label: 'Today', icon: '◷', hint: day, keywords: ['today', day] }] },
      { title: 'Pages', items: titles.filter(t => t.kind !== 'thread' && t.kind !== 'day').map(item) },
      { title: 'Folders', items: titles.filter(t => t.kind === 'thread').map(item) },
    ];
    // with nothing typed a long list is cut to the first few of each group; typing finds them all
    const shown = filterGroups(rest, q);
    return [...out, ...(q.trim() ? shown : shown.map(g => ({ ...g, items: g.items.slice(0, 6) })))];
  };

  handle = openMenu({
    groups: [], groupsFor, label: 'Place a verse, page, folder or Today', placeholder: 'A verse, page, folder or Today',
    at: (() => {
      const sel = window.getSelection();
      const r = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
      const box = r && (r.width || r.height) ? r : ta.getBoundingClientRect();
      return { x: box.left, y: box.bottom + 6 };
    })(),
    onPick: it => {
      picked = true;
      const [kind, ...v] = it.id.split(':');
      const value = v.join(':');
      if (kind === 'verse') place(value);
      else place(`[[${value}]]`);
    },
    onClose: () => {
      if (host.state.menuClose === handle?.close) { host.state.menuClose = null; host.state.menuKey = null; }
      // closed with nothing picked (Esc, a click outside): the @ typed goes out of the line. A pick runs just after the close.
      queueMicrotask(() => { if (!picked) takeOut(); });
    },
  });
  host.state.menuClose = handle.close;
  void host.titles().then(list => { titles = list.filter(t => t.id !== self); if (handle?.open) handle.refresh(); }).catch(() => {});
}
