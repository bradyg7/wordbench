// The Scripture block's reference field (notebook design rows 7 and 49, NB3): typing a reference completes the book
// ("josh" → Joshua, Tab), a range may cross chapters, and the words under the field are read from the database
// (`wb scripture`), never typed. The block keeps only the reference.
import { wb } from './api';
import { app } from './app';
import { h, icon } from './ui';
import type { Book } from './api';

const plain = (s: string) => s.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').replace(/^([1-3])(?=[a-z])/, '$1 ').trim();

/** The books a typed name could mean, in Bible order: the name (or its code) begins with what was typed ("1 sam", "1sam"). */
export function bookMatches(books: Book[], typed: string): Book[] {
  const q = plain(typed);
  if (!q) return [];
  return books.filter(b => plain(b.name).startsWith(q) || (q.length > 1 && b.code.toLowerCase().startsWith(q)));
}

/** A typed line cut into its book part and the chapter and verses after it ("josh 1:9" → "josh", "1:9"). */
export function splitReference(line: string): { book: string; rest: string } {
  const m = /^\s*([1-3]?\s*[^\d\s][^\d]*?)\s*(\d[\d:.,;\s\-–—]*)?\s*$/.exec(line);
  if (!m) return { book: line.trim(), rest: '' };
  return { book: m[1].trim(), rest: (m[2] || '').trim() };
}

export type FieldOptions = { start?: string; onPlace: (reference: string) => void; onCancel: () => void };

/** The field, placed in `into` under the block's place. Enter places a reference the database accepted; Esc cancels. */
export function scriptureField(into: HTMLElement, opts: FieldOptions): { el: HTMLElement; focus: () => void; remove: () => void } {
  const el = h('div', 'sf');
  const box = h('div', 'sf-box');
  const input = h('input', 'sf-input') as HTMLInputElement;
  input.type = 'text';
  input.placeholder = 'A reference, like John 3:16 or Num 25:18-26:1';
  input.setAttribute('aria-label', 'Scripture reference');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const hint = h('span', 'sf-hint muted small', 'Enter to place');
  box.append(icon('book', 14), input, hint);
  const list = h('div', 'sf-books');
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  const preview = h('div', 'sf-preview');
  preview.setAttribute('aria-live', 'polite');
  el.append(box, list, preview);
  into.append(el);

  let shown: Book[] = [];
  let on = 0;
  let good = '';     // the reference the database accepted for what is in the field now
  let turn = 0;

  const drawBooks = () => {
    list.textContent = '';
    list.hidden = !shown.length;
    shown.slice(0, 8).forEach((b, i) => {
      const row = h('div', `sf-book${i === on ? ' on' : ''}`);
      row.setAttribute('role', 'option');
      row.dataset.book = b.name;
      const t = h('span', 'sf-book-name');
      t.append(h('span', '', b.name), h('span', 'muted small', `${b.chapters} chapters`));
      row.append(icon('book', 14), t, h('span', 'sf-book-tab muted small', i === on ? 'Tab' : ''));
      row.onmousedown = ev => { ev.preventDefault(); complete(b); };
      list.append(row);
    });
  };
  const complete = (b: Book) => {
    input.value = `${b.name} `;
    input.focus();
    refresh();
  };

  const showVerses = (d: any) => {
    preview.textContent = '';
    preview.append(h('div', 'sf-preview-head muted small', 'Preview'));
    const verses: { ref: string; c: number; v: number; text: string }[] = d.verses || [];
    for (const v of verses.slice(0, 6)) {
      const p = h('p', 'sf-verse');
      p.append(h('span', 'sf-vnum muted', `${v.c === verses[0].c ? '' : `${v.c}:`}${v.v}`), document.createTextNode(` ${v.text}`));
      preview.append(p);
    }
    if (verses.length > 6) preview.append(h('p', 'muted small', `and ${verses.length - 6} more verses`));
  };

  const refresh = () => {
    const mine = ++turn;
    good = '';
    const { book, rest } = splitReference(input.value);
    const hits = bookMatches(app.books, book);
    const exact = hits.find(b => plain(b.name) === plain(book));
    const chosen = exact ?? (hits.length === 1 ? hits[0] : undefined);
    shown = !rest ? hits : [];
    on = 0;
    drawBooks();
    hint.textContent = shown.length ? 'Tab to complete' : 'Enter to place';
    if (!chosen || !rest) { preview.textContent = ''; return; }
    const reference = `${chosen.name} ${rest}`;
    window.setTimeout(async () => {
      if (mine !== turn) return;
      try {
        const d = await wb(['scripture', reference]);
        if (mine !== turn) return;
        good = reference;
        showVerses(d);
      } catch {
        if (mine !== turn) return;
        preview.textContent = '';
        preview.append(h('div', 'sf-preview-head muted small', 'No such passage yet'));
      }
    }, 120);
  };

  input.oninput = refresh;
  input.onkeydown = ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); opts.onCancel(); return; }
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && shown.length) {
      ev.preventDefault();
      const n = Math.min(shown.length, 8);
      on = (on + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n;
      drawBooks();
      return;
    }
    if ((ev.key === 'Tab' || ev.key === 'Enter') && shown.length) { ev.preventDefault(); complete(shown[on]); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); if (good) opts.onPlace(good); }
  };
  input.value = opts.start ?? '';
  if (input.value) refresh();
  return { el, focus: () => input.focus(), remove: () => { turn++; el.remove(); } };
}
