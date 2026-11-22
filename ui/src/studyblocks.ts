// The Study blocks of the / menu beyond Scripture and Word (notebook rows 51 to 55, NB12): Interlinear, Cross references,
// Concordance, Margin notes for a passage, Marks in a passage. Each block's fence holds one reference or one English word and
// nothing else; what it shows is read each time the page is drawn (`wb page study`, one call for the page) from the database
// or the study folder. A block only reads: it never writes the margin notes or the marks it lists.
import { wb } from './api';
import { app } from './app';
import { refChip } from './chapterpanel';
import { sampleOf, type Kind } from './markbar';
import { openStrong } from './panes';
import { button, h, icon, popMenu } from './ui';

export const REF_LANGS = ['interlinear', 'xrefs', 'margin', 'marks'] as const;
export const STUDY_LANGS = [...REF_LANGS, 'concordance'] as const;
export type StudyLang = typeof STUDY_LANGS[number];
export const isStudyLang = (l: string): l is StudyLang => (STUDY_LANGS as readonly string[]).includes(l);
export const isRefLang = (l: string) => (REF_LANGS as readonly string[]).includes(l);

/** What each block is called, what its field asks for, and what it shows in its head's right corner. */
export const STUDY_LABEL: Record<StudyLang, string> = {
  interlinear: 'Interlinear', xrefs: 'Cross references', concordance: 'Concordance', margin: 'Margin notes', marks: 'Marks',
};

export interface StudyData { id: string; got: Promise<any> }

/** The block's number's entry in `wb page study`, when the page has been asked. */
function entryFor(state: StudyData | null, id: string, n: number): Promise<any | undefined> {
  if (!state || state.id !== id) return Promise.resolve(undefined);
  return state.got.then(d => (d?.blocks || []).find((x: any) => x.n === n));
}

const say = (text: string, cls = '') => h('p', `small nbv-note ${cls}`.trim(), text);

/** A Study block: its head (what it holds; its name at the right), its body from the page's study data. */
export function studyBlock(lang: StudyLang, held: string, n: number, id: string, state: StudyData | null): HTMLElement {
  const box = h('div', `nb-study nb-study-${lang}`);
  box.dataset.study = lang;
  const head = h('div', 'nbs-head');
  const what = h('span', 'nbs-what', held || STUDY_LABEL[lang]);
  const kind = h('span', 'nbs-kind muted small', STUDY_LABEL[lang]);
  head.append(what, h('span', 'grow'), kind);
  const body = h('div', 'nbs-body');
  box.append(head, body);
  if (!held) body.append(say(lang === 'concordance' ? 'No word yet. Choose Edit card to enter one.' : 'No reference yet. Choose Edit card to enter one.', 'muted'));
  else body.append(say('Reading…', 'muted'));
  void entryFor(state, id, n).then(mine => {
    if (!mine) return;
    if (mine.error) { if (held) body.replaceChildren(say(mine.error, 'nbv-error')); return; }
    const d = mine.data;
    body.replaceChildren();
    if (lang === 'interlinear') drawInterlinear(d, what, kind, body);
    else if (lang === 'xrefs') drawXrefs(d, what, body);
    else if (lang === 'concordance') drawConcordance(d, what, kind, body);
    else if (lang === 'margin') drawMargin(d, what, kind, body);
    else drawMarks(d, what, kind, body);
  }).catch(x => { body.replaceChildren(say(String(x), 'nbv-error')); });
  return box;
}

// ---- Interlinear (row 51) ---------------------------------------------------------------------------------------------------

/** The verse's original words in a row that scrolls sideways inside the block: sound, gloss and number under each word. The
 *  block is as wide as the column, grows in height with its words, and is not resized by dragging. */
function drawInterlinear(d: any, what: HTMLElement, kind: HTMLElement, body: HTMLElement) {
  what.textContent = d.label;
  kind.textContent = `Interlinear · ${d.lang === 'heb' ? 'Hebrew' : 'Greek'}`;
  const verses: any[] = d.verses || [];
  let words = 0;
  for (const v of verses) {
    words += (v.words || []).length;
    const row = h('div', 'nbi-verse');
    if (verses.length > 1) row.append(h('span', `nbi-vn muted small${v.v === 0 ? ' title' : ''}`, v.v === 0 ? `${v.c}` : `${v.c}:${v.v}`));
    const scroll = h('div', 'nbi-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'group');
    scroll.setAttribute('aria-label', `${d.label}: the original words`);
    scroll.onclick = ev => ev.stopPropagation();       // a click on the words (or on the scroll bar) is not a click to edit the block
    const line = h('div', 'nbi-words');
    for (const w of v.words || []) {
      const cell = h('div', 'nbi-word');
      const orig = h('span', `nbi-orig ${d.lang === 'heb' ? 'hebrew' : 'greek'}`, w.original || '');
      orig.lang = d.lang === 'heb' ? 'he' : 'el';
      orig.dir = d.lang === 'heb' ? 'rtl' : 'ltr';
      cell.append(orig, h('span', 'nbi-sound muted small', w.translit || ''), h('span', 'nbi-gloss', w.gloss || ''));
      const num = String(w.strong || '').toUpperCase();
      if (/^[HG]\d+$/.test(num)) {
        const b = button('nbi-num link-btn small', num, ev => { ev.stopPropagation(); openStrong(num); });
        b.title = `Open ${num}`;
        cell.append(b);
      } else cell.append(h('span', 'nbi-num small', num));
      line.append(cell);
    }
    scroll.append(line);
    row.append(scroll);
    body.append(row);
  }
  if (!verses.length) body.append(say('The database has no original words for this passage.', 'muted'));
  const foot = `${d.label}, ${words} word${words === 1 ? '' : 's'}${d.more ? ` (the first ${verses.length} of ${d.total} verses)` : ''}`;
  body.append(h('p', 'small muted nbs-foot', foot));
}

// ---- Cross references (row 52) ---------------------------------------------------------------------------------------------

/** Proposed in the design: the app has no cross-reference source, so the block says so. */
function drawXrefs(d: any, what: HTMLElement, body: HTMLElement) {
  what.textContent = d.place;
  const refs: string[] = d.references || [];
  if (!refs.length) body.append(h('p', 'nbs-none muted', d.message), h('p', 'small muted nbs-foot', d.note || ''));
  for (const r of refs) body.append(refChip(r, r));
}

// ---- Concordance (row 53) --------------------------------------------------------------------------------------------------

function concLine(l: any): HTMLElement {
  const row = h('div', 'nbc-row');
  const ctx = h('span', 'nbc-ctx');
  ctx.append(document.createTextNode(`…${l.before || ''}`), h('b', 'nbc-word', l.word || ''), document.createTextNode(`${l.after || ''}…`));
  row.append(refChip(l.ref, l.ref), ctx, h('span', 'nbc-num muted small', l.strong || ''));
  return row;
}

/** Every place of the word in Bible order, words either side and the original number (`wb concordance`). */
function drawConcordance(d: any, what: HTMLElement, kind: HTMLElement, body: HTMLElement) {
  what.textContent = d.word;
  kind.textContent = 'Concordance';
  const lines: any[] = d.lines || [];
  for (const l of lines) body.append(concLine(l));
  for (const g of d.groups || []) {
    body.append(h('div', 'nbc-group small', `${g.name} · ${g.count}`));
    for (const l of g.lines || []) body.append(concLine(l));
    if (g.more) body.append(h('p', 'small muted nbs-foot', `and ${g.more} more in ${g.name}`));
  }
  if (!lines.length && !(d.groups || []).length) body.append(say('No place has this word.', 'muted'));
  body.append(h('p', 'small muted nbs-foot', `${d.places} place${d.places === 1 ? '' : 's'}`));
}

// ---- Margin notes for a passage (row 54) ----------------------------------------------------------------------------------

/** The margin notes on the passage, by verse; each opens its note in the reader's margin. Reading only. */
function drawMargin(d: any, what: HTMLElement, kind: HTMLElement, body: HTMLElement) {
  what.textContent = d.label;
  kind.textContent = `Margin notes · ${d.count}`;
  for (const n of d.notes || []) {
    const row = h('div', 'nbm-row');
    row.dataset.note = n.id;
    const open = button('nbm-where link-btn', n.label, ev => { ev.stopPropagation(); void app.showMarginNote(n.id, n.at); });
    open.title = `Open ${n.label} in the reader, with its margin note`;
    open.prepend(icon('pen', 12));
    row.append(open, h('span', 'nbm-text', String(n.text || '').split('\n')[0]));
    body.append(row);
  }
  if (!(d.notes || []).length) body.append(say('No margin notes on this passage yet.', 'muted'));
}

// ---- Marks in a passage (row 55) -------------------------------------------------------------------------------------------

/** Every mark on the passage with its Legend style and the marked words (the Bible's, verbatim). Reading only. */
function drawMarks(d: any, what: HTMLElement, kind: HTMLElement, body: HTMLElement) {
  what.textContent = d.place;
  kind.textContent = `Marks · ${d.count}`;
  for (const m of d.marks || []) {
    const row = h('div', 'nbk-row');
    row.dataset.mark = m.id;
    const words = String(m.words || '');
    row.append(sampleOf(m.kind as Kind, m.color, m.lines), refChip(m.label, m.label), h('span', 'nbk-legend muted small', m.legend || ''));
    if (words) row.append(h('span', 'nbk-words', `“${words}”`));
    body.append(row);
  }
  if (!(d.marks || []).length) body.append(say('No marks on this passage yet.', 'muted'));
}

// ---- placing a Concordance block -----------------------------------------------------------------------------------------

/** The word a Concordance block holds, asked for in a small box (one English word); `pick` gets it lower-cased. */
export function concordanceChooser(from: HTMLElement, pick: (word: string) => void, cancel: () => void) {
  const form = h('form', 'chooser') as HTMLFormElement;
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = 'An English word, like zeal';
  input.setAttribute('aria-label', 'Concordance word');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const go = h('button', 'btn small primary', 'Insert concordance') as HTMLButtonElement;
  go.type = 'submit';
  const error = h('p', 'muted small');
  error.setAttribute('role', 'status');
  form.append(input, go, error);
  const close = popMenu(from, form, { width: 285, onClose: cancel });
  form.onsubmit = async ev => {
    ev.preventDefault();
    const word = input.value.trim().toLowerCase();
    if (!validWord(word)) { error.textContent = 'Enter one English word, like zeal.'; return; }
    go.disabled = true;
    try {
      await wb(['forms', word]);      // the database is asked, so the block is never placed for a word it cannot read
      if (!form.isConnected) return;
      close();
      pick(word);
    } catch (x) { error.textContent = String(x); go.disabled = false; }
  };
  input.focus();
}

/** One English word, as `wb concordance` reads it. */
export const validWord = (w: string) => /^[a-z]+(?:['’-][a-z]+)*$/.test(w);
