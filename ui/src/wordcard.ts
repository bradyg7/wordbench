// The word card and the hover card (design/features/words, W5, W6, W11; W-5, W-7, W-8).
//
// - A click on a word opens the word card: W4's frame (a handle to drag it by, a corner to size it from, Float, close), the
//   lemma, its sound, Strong's words and the renderings, ONE count line for the pages that name the word, the one door
//   (In the Concordance) and under it the BDB and Webster's buttons. It never draws a page's text or Markdown (2bc9).
// - Resting on a word (Cards on hover: Everything) shows what `wb preview H7065` prints: lemma, sound, Strong's words,
//   and nothing that can be clicked.
// - At phone width the word card is a sheet over the bottom with the same parts.
// The verse card is in verses.ts; this file also holds the count line it shares (`pagesLine`).
import { api, wb, type WordView } from './api';
import { frameCard, grip } from './cardframe';
import { dock, openBdb, openInterlinear, openStrong } from './panes';
import { closeSheet, compact, openSheet } from './sheets';
import { button, h } from './ui';

/** Where "In the Concordance" goes. The Concordance's own build replaces this (design/features/concordance); until it is
 * built the door opens the word's entry, which is where Strong's led before. */
export const doors = {
  concordance: (strong: string) => { openStrong(strong); },
};

/** One count line for the pages whose text names a word or a verse (W-5): "412 pages name this word". A click opens their
 * list (titles only); a page opens as a tab. `place` is what `wb anchor <place> --pages` takes. Null if it cannot be asked. */
export async function pagesLine(place: string, noun: 'word' | 'verse'): Promise<HTMLElement | null> {
  const d = await wb(['anchor', ...place.split(' '), '--pages']).catch(() => null);
  if (!d || typeof d.count !== 'number') return null;
  const wrap = h('div', 'wc-pages-wrap');
  const n: number = d.count;
  const text = n === 0 ? `No page names this ${noun}` : `${n} ${n === 1 ? 'page names' : 'pages name'} this ${noun}`;
  const line = h('button', `wc-pages${n === 0 ? ' none' : ''}`, text);
  line.dataset.count = String(n);
  line.disabled = n === 0;
  const list = h('div', 'wc-page-list');
  list.hidden = true;
  line.onclick = () => {
    list.hidden = !list.hidden;
    if (!list.hidden && !list.childElementCount) {
      for (const p of d.pages.slice(0, 50)) {
        list.append(button('', p.title || 'Untitled', async () => {
          const { openPageTab, pageTabKey } = await import('./notebook');
          closeSheet();
          await openPageTab(pageTabKey(p.id));
        }));
      }
      if (d.pages.length > 50) list.append(h('p', 'muted small', `and ${d.pages.length - 50} more`));
    }
  };
  wrap.append(line, list);
  return wrap;
}

function lemmaRow(w: WordView): HTMLElement {
  const lx = w.lexicon!;
  const row = h('div', 'lemma-row');
  const lemma = h('span', 'lemma', lx.lemma);
  lemma.lang = lx.lang === 'grk' ? 'grc' : 'he';
  lemma.dir = lx.lang === 'grk' ? 'ltr' : 'rtl';
  const tr = h('div');
  tr.append(h('div', 'translit', lx.translit || ''), h('div', 'muted small', `${lx.strong} · Strong's${lx.pron ? ` · ${lx.pron}` : ''}`));
  row.append(lemma, tr);
  return row;
}

/** The hover card: what `wb preview` prints for the word, and nothing that can be clicked (W5). */
export function wordHover(w: WordView): HTMLElement {
  const b = h('div', 'lex hover-lex');
  b.append(h('div', 'card-head', `${w.text} · ${w.reference}`));
  if (!w.lexicon) {
    b.append(h('p', 'muted', w.strong ? `No lexicon entry for ${w.strong}.` : 'No direct Strong’s tag on this word.'));
    return b;
  }
  b.append(lemmaRow(w));
  if (w.lexicon.definition) b.append(h('p', 'def', w.lexicon.definition));
  if (w.lexicon.usage) b.append(h('p', 'usage', `KJV: ${w.lexicon.usage}`));
  return b;
}

/** A click on a word: the word card. Returns the panel. */
export function openWordCard(w: WordView, from: HTMLElement, closed?: () => void): HTMLElement {
  const strong = w.lexicon?.strong ?? w.strong;
  const phone = compact();
  const body = h('div', 'lex word-body');
  const panel = openSheet(body, from, { closed, stays: true });
  panel.classList.add('word-card');
  if (phone) {
    body.append(h('h2', 'sheet-title', w.text), h('div', 'sheet-sub', w.reference));
  } else {
    const head = h('div', 'wc-head');
    head.append(grip(), h('span', 'wc-title', strong || w.text));
    const fl = button('icon-btn wc-float', '', () => { closeSheet(); floatWord(w); }, 'float');
    fl.title = 'Float: keep it as a floating pane';
    fl.setAttribute('aria-label', 'Float');
    const x = button('icon-btn wc-close', '', () => closeSheet(), 'x');
    x.title = 'Close';
    x.setAttribute('aria-label', 'Close');
    head.append(fl, x);
    body.append(head, h('div', 'wc-text', `${w.text} · ${w.reference}`));
    frameCard(panel, head, true);
  }
  fillWord(body, w, strong);
  if (!phone) positionNear(panel, from);
  return panel;
}

function positionNear(panel: HTMLElement, from: HTMLElement) {
  const r = from.getBoundingClientRect();
  const w = Math.min(420, window.innerWidth - 32);
  panel.style.width = `${w}px`;
  panel.style.left = `${Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 16))}px`;
  const hgt = panel.offsetHeight;
  const below = r.bottom + 10;
  panel.style.top = `${below + hgt <= window.innerHeight - 16 ? below : Math.max(16, Math.min(r.top - 10 - hgt, window.innerHeight - hgt - 16))}px`;
}

function fillWord(b: HTMLElement, w: WordView, strong: string | undefined) {
  const lx = w.lexicon;
  if (!lx) {
    b.append(h('p', 'muted', strong ? `No lexicon entry for ${strong}.` : 'No direct Strong’s tag on this word.'));
    const inter = h('button', 'btn', 'Verse interlinear');
    inter.onclick = () => {
      closeSheet();
      const [code, cv] = w.anchor.split('.');
      openInterlinear(`${code} ${cv}`, w.reference);
    };
    b.append(inter);
    return;
  }
  b.append(lemmaRow(w));
  if (lx.definition) b.append(h('p', 'def', lx.definition));
  // the renderings: the English words the KJV puts for this one (what `wb strong` lists), a few, not clickable
  const chips = h('div', 'chips wc-renderings');
  b.append(chips);
  void wb(['strong', lx.strong]).then(d => {
    for (const r of (d.renderings || []).slice(0, 5)) chips.append(h('span', 'chip', `${r.w} ${r.n}`));
  }).catch(() => { if (lx.usage) chips.append(h('span', 'chip', `KJV: ${lx.usage}`)); });
  const pages = h('div', 'wc-pages-slot');
  b.append(pages);
  void pagesLine(lx.strong, 'word').then(l => { if (l) pages.replaceChildren(l); });
  b.append(button('btn primary wc-door', 'In the Concordance', () => { closeSheet(); doors.concordance(lx.strong); }, 'word'));
  const books = h('div', 'wc-books');
  const entry = h('div', 'wc-entry');
  if (lx.strong.startsWith('H')) books.append(button('btn wc-bdb', 'BDB', () => { closeSheet(); openBdb(lx.strong); }));
  books.append(button('btn wc-webster', 'Webster’s', () => void websters(entry, w.text), 'book'));
  b.append(books, entry);
}

/** Webster's 1913 for the word, verbatim with its source (wb word-define), shown under the buttons. */
async function websters(into: HTMLElement, word: string) {
  if (into.childElementCount) { into.replaceChildren(); return; }
  into.replaceChildren(h('p', 'muted small', 'Looking it up…'));
  const d = await wb(['word-define', word]).catch((x: unknown) => String((x as Error)?.message ?? x));
  into.replaceChildren();
  if (typeof d === 'string') { into.append(h('p', 'muted small', d)); return; }
  if (!d.found) { into.append(h('p', 'muted small', `Webster’s 1913 has no entry for “${word}”.`)); return; }
  const src = d.source;
  into.append(h('div', 'label', d.headword), h('p', 'vc-def-text', d.text), h('p', 'muted small', `${src.name}, ${src.edition}. ${src.licence}.`));
}

/** Float: the word as a floating pane (the card closes; a pane has a body of its own, so it is drawn again there). */
function floatWord(w: WordView, side: 'float' | 'left' = 'float') {
  const strong = w.lexicon?.strong ?? w.strong ?? w.text;
  dock.open('wordcard', strong, `wordcard|${w.anchor}`, side, async el => {
    el.replaceChildren();
    const body = h('div', 'lex word-body in-pane');
    body.append(h('div', 'wc-text', `${w.text} · ${w.reference}`));
    fillWord(body, w, w.lexicon?.strong ?? w.strong);
    el.append(body);
  });
}

/** A word card as a pane from its anchor (NUM.25:11.24): a floating pane or a tab. Layout reopen and the `card` line use it. */
export async function openWordPane(anchor: string, how: 'float' | 'tab' = 'float'): Promise<string> {
  const m = /^([A-Z0-9]{3})\.(\d+):(\d+)\.(\d+)$/.exec(anchor);
  if (!m) throw new Error(`${anchor} is not a word`);
  const { data } = await api.word(m[1], +m[2], +m[3], +m[4]);
  floatWord(data, how === 'float' ? 'float' : 'left');
  return `${data.text} as a ${how === 'float' ? 'floating pane' : 'tab'}`;
}
