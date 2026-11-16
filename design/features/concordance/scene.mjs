// The Concordance, drawn in the app as installed (the person, 2026-11-16: "redraw the design according to the current
// install"): the person's own build from %LOCALAPPDATA%\bible-workbench-rs\app, run as its own instance on its own copy
// of the scratch study folder (never the real folder), driven over the DevTools protocol as measure/rail.mjs does.
// The reader, the rail, the top bar, the trail line, the Notebook and the word sheet are the app's own; the Concordance
// is a prototype pane, one tab, mounted with the dock's own open() and drawn with the app's CSS classes and tokens (plus
// the few cc-* rules below). Every word, verse and entry in it is a `wb` answer from the database. Nothing here is the
// build: the feature is built from the accepted folder, on its own branch. (Round 3's own shots, scenes/round3-*.png,
// were made by this script's earlier form and are kept as they were.)
//
// It draws every window the folder leads with, as the person's decisions stand (README, rounds 1-3):
//   node design/features/concordance/scene.mjs                                   every window
//   node design/features/concordance/scene.mjs c12-chapter-toggles               only those named
// WB_APP_DIR picks another build (e.g. target\release); WB_BIBLE_DB another database.
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.slice(1));
const app = process.env.WB_APP_DIR || path.join(process.env.LOCALAPPDATA, 'bible-workbench-rs', 'app');
const exe = path.join(app, 'bible-workbench.exe');
const wbExe = path.join(app, 'wb.exe');
const db = process.env.WB_BIBLE_DB || path.join(app, 'datasets', 'workbench.db');
for (const f of [exe, wbExe, db]) if (!existsSync(f)) throw new Error(`Not found: ${f}`);
const shots = path.join(here, 'scenes');
mkdirSync(shots, { recursive: true });
const only = process.argv.slice(2);
if (!only.length) for (const f of readdirSync(shots)) if (/^c\d\d-/.test(f)) rmSync(path.join(shots, f));
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'concordance-scene');
const cdpPort = process.env.WB_DESK_PORT || '9336';
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
rmSync(path.join(study, 'history'), { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_BIBLE_DB: db, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const wb = (...a) => JSON.parse(execFileSync(wbExe, a, { env, maxBuffer: 1 << 26 }).toString());

// every answer the pane shows, from the database
const uses = w => {
  const d = wb('uses', w);
  for (const r of d.rows) {   // each place's original word: its number, from the word itself
    const k = r.words.findIndex(x => x.m);
    r.strong = k < 0 ? '' : (wb('word', r.ref.code, String(r.ref.c), String(r.ref.v), String(r.words[k].i)).strong || '');
  }
  return d;
};
const DATA = {
  forms: wb('forms', 'zea'),
  lexc: wb('lexiconc', 'zeal'),
  english: { zeal: uses('zeal'), zealous: uses('zealous'), zealously: uses('zealously') },
  h7065: wb('strong', 'H7065'),
  h7068: wb('strong', 'H7068'),
  g2205: wb('strong', 'G2205'),
  uses7068: wb('uses', 'H7068'),
  usesG2205: wb('uses', 'G2205'),
  john: wb('interlinear', 'John 2:17'),
  num25: wb('interlinear', 'Num 25'),
};

const CSS = `
.cc-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 4px 0 8px; }
.cc-nav .field { width: 180px; }
.cc-az { display: flex; flex-wrap: wrap; gap: 2px 7px; font: var(--type-caption); color: var(--muted); padding: 0 0 8px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
.cc-az .on { color: var(--accent); font-weight: 600; }
.cc-suggest { border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--surface); box-shadow: 0 12px 32px rgba(0,0,0,.25); padding: 6px; margin: -2px 0 10px; }
.cc-suggest .label { margin: 8px 8px 2px; }
.cc-sug { display: flex; gap: 10px; align-items: baseline; padding: 6px 8px; border-radius: 6px; font: var(--type-small); }
.cc-sug.on { background: var(--accent-soft); }
.cc-sug .grow { flex: 1; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-sug .num { color: var(--accent); font: var(--type-caption); }
.cc-scope { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 6px 0 10px; }
.cc-scope .grow { flex: 1; }
.cc-head { display: flex; gap: 10px; align-items: baseline; margin: 14px 0 4px; }
.cc-head h3 { font: var(--type-heading); letter-spacing: .04em; margin: 0; }
.cc-verse { font: var(--type-scripture); font-size: 16px; line-height: 1.6; margin: 4px 0 12px; }
.cc-verse .vref { margin-right: 6px; }
.inter-card { min-width: 0; overflow: hidden; }
.inter-card.cc-on { background: var(--accent-soft); }
.inter-card.cc-picked { border: 2px solid var(--accent); background: var(--accent-soft); }
.inter-gloss, .inter-translit { overflow-wrap: anywhere; }
.cc-fit .inter-orig { white-space: nowrap; }
.cc-opened { border: 1px solid var(--line); border-radius: var(--radius-card); padding: 12px 14px; margin: 8px 0 14px; background: var(--surface); }
.cc-parse { font: var(--type-caption); color: var(--muted); margin: 2px 0 8px; }
.cc-line { display: flex; gap: 8px; align-items: baseline; padding: 4px 6px; border-radius: 6px; font: var(--type-small); }
.cc-line.cc-open { background: var(--accent-soft); }
.cc-line .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; font-family: var(--font-scripture, serif); }
.cc-line.cc-open .t { white-space: normal; }
.cc-line .num { color: var(--accent); font: var(--type-caption); }
.cc-line .tog { width: 16px; color: var(--fg); font-size: 15px; }
.cc-more { font: var(--type-small-strong); color: var(--accent); padding: 2px 6px 8px; }
.cc-group { font: var(--type-small-strong); margin: 12px 0 2px; display: flex; gap: 8px; }
.cc-group span { color: var(--muted); font-weight: normal; }
.cc-bars { display: grid; grid-template-columns: 110px 1fr 28px; gap: 3px 8px; align-items: center; font: var(--type-caption); margin: 4px 0 10px; }
.cc-bars i { display: block; height: 8px; border-radius: 4px; background: var(--accent); }
.cc-from { display: flex; gap: 8px; align-items: center; background: var(--accent-soft); border-radius: var(--radius-control); padding: 6px 10px; margin: 2px 0 10px; font: var(--type-small); }
.cc-from b { color: var(--accent); }
.cc-from .grow { flex: 1; color: var(--muted); }
.cc-from .btn { white-space: nowrap; }
`;

/** Runs in the page: draws one window in the Concordance pane (one tab; each window is a move inside it). */
function mount({ scene, D, CSS }) {
  if (!document.getElementById('cc-proto')) {
    const s = document.createElement('style'); s.id = 'cc-proto'; s.textContent = CSS; document.head.append(s);
  }
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const seg = (opts, on) => { const s = h('div', 'seg small'); for (const o of opts) s.append(h('button', o === on ? 'on' : '', o)); return s; };
  const letters = { English: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), Hebrew: 'א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת'.split(' '), Greek: 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω'.split(' ') };
  const nav = (el, q, tab, on) => {
    const n = h('div', 'cc-nav'); const f = h('input', 'field'); f.value = q; f.placeholder = 'Word, number or sound';
    n.append(f, seg(['English', 'Hebrew', 'Greek', 'Interlinear'], tab)); el.append(n);
    const az = h('div', 'cc-az'); az.dir = tab === 'Hebrew' ? 'rtl' : 'ltr';
    if (letters[tab]) for (const c of letters[tab]) az.append(h('span', c === on ? 'on' : '', c));
    el.append(az);
  };
  const scope = (el, ref, on, extra) => {
    const s = h('div', 'cc-scope'); s.append(h('h2', 'pane-title', ref), seg(['Verse', 'Passage', 'Chapter'], on));
    if (extra) s.append(h('span', 'grow'), extra);
    el.append(s);
  };
  const verseText = (el, v) => { const p = h('p', 'cc-verse'); p.append(h('span', 'vref', `${v.c}:${v.v}`), v.text); el.append(p); };
  const grid = (el, words, rtl, mark = [], pick = '') => {
    const g = h('div', 'inter-grid cc-fit'); g.dir = rtl ? 'rtl' : 'ltr';
    for (const w of words) {
      const c = h('div', `inter-card${w.strong === pick ? ' cc-picked' : mark.includes(w.strong) ? ' cc-on' : ''}`);
      const o = h('div', 'inter-orig', w.original); o.lang = rtl ? 'he' : 'grc';
      c.append(o, h('div', 'inter-translit', w.translit || ''), h('div', 'inter-strong', w.strong || ''), h('div', 'inter-gloss', w.gloss || ''));
      g.append(c);
    }
    el.append(g);
  };
  const entry = (el, d) => {
    const top = h('div', 'lemma-row'); const l = h('span', 'lemma', d.lemma); l.lang = d.lang === 'heb' ? 'he' : 'grc';
    const tr = h('div'); tr.append(h('div', 'translit', d.translit || ''), h('div', 'muted small', `${d.strong} · ${d.pron || ''}${d.pos ? ` · ${d.pos}` : ''} · ${d.occurrences}×`));
    top.append(l, tr); el.append(top);
    if (d.definition) el.append(h('p', 'def', d.definition));
    if (d.usage) el.append(h('p', 'usage', `KJV: ${d.usage.replace(/\[\[(\w+)\]\]/g, '$1')}`));
  };
  // a place line: its reference, a few words around the word (round 2), and the original word's number
  const line = (el, r, num = true) => {
    const k = Math.max(0, r.words.findIndex(w => w.m));
    const a = Math.max(0, k - 5), b = Math.min(r.words.length, k + 6);
    const ln = h('div', 'cc-line'); const t = h('span', 't');
    if (a > 0) t.append('… ');
    for (const w of r.words.slice(a, b)) { t.append(w.lead || ''); t.append(w.m ? h('mark', `found m-${w.m}`, w.t) : document.createTextNode(w.t)); t.append(w.trail || ''); }
    if (b < r.words.length) t.append(' …');
    const ref = h('span', 'vref', `${r.ref.name} ${r.ref.c}:${r.ref.v}`); ref.style.minWidth = '118px';
    ln.append(ref, t);
    if (num) ln.append(h('span', 'num', r.strong || '·'));
    el.append(ln);
    return ln;
  };
  const tools = (el, on) => {
    const t = h('div', 'cc-scope'); t.append(seg(['By English word', 'By book'], on), h('span', 'grow'));
    t.append(h('button', 'btn small', 'Whole Bible ▾'), h('button', 'btn small', 'Near…')); el.append(t);
  };
  const v11 = D.num25.verses.find(x => x.v === 11);
  const S = {
    // C2: one box for a word, a number or a sound; it suggests as you type
    search: el => {
      nav(el, 'zea', 'English', 'Z');
      const s = h('div', 'cc-suggest');
      s.append(h('div', 'label', 'English words'));
      D.forms.forms.forEach((f, i) => { const r = h('div', `cc-sug${i === 1 ? ' on' : ''}`); r.append(h('b', '', f.form), h('span', 'grow', ''), h('span', 'muted', `${f.n} places`)); s.append(r); });
      s.append(h('div', 'label', 'Original words defined with “zeal”'));
      for (const e of D.lexc.entries) { const r = h('div', 'cc-sug'); const l = h('b', '', e.lemma); l.lang = e.lang === 'heb' ? 'he' : 'grc'; r.append(h('span', 'num', e.strong), l, h('span', 'grow', `${e.translit} · ${e.definition}`)); s.append(r); }
      el.append(s);
    },
    // C1 + C7: the English page as the printed Strong's; All forms; a number opens its entry under the line
    english: el => {
      nav(el, 'zealous', 'English', 'Z');
      const t = h('div', 'cc-scope'); t.append(seg(['All forms', 'This word'], 'All forms'), h('span', 'grow'), h('span', 'muted small', `zeal, zealous, zealously · ${D.forms.total} places`)); el.append(t);
      for (const w of ['zeal', 'zealous', 'zealously']) {
        const hd = h('div', 'cc-head'); hd.append(h('h3', '', w.toUpperCase()), h('span', 'muted small', String(D.english[w].occurrences))); el.append(hd);
        for (const r of D.english[w].rows) {
          const ln = line(el, r);
          if (w === 'zealous' && r.ref.c === 25 && r.ref.v === 11) {
            ln.classList.add('cc-open');
            const o = h('div', 'cc-opened'); entry(o, D.h7065);
            const a = h('div', 'acts two'); a.append(h('button', 'btn small', 'In the Hebrew tab'), h('button', 'btn small', 'Every place')); o.append(a);
            el.append(o);
          }
        }
      }
    },
    // C8: an entry with every place, grouped by how the KJV renders it: 4 lines and "N more" each
    hebrew: el => {
      nav(el, 'H7068', 'Hebrew', 'ק');
      entry(el, D.h7068);
      el.append(h('div', 'label', `Every place · ${D.uses7068.occurrences} times in ${D.uses7068.verses} verses`));
      tools(el, 'By English word');
      const groups = {};
      for (const r of D.uses7068.rows) { const w = (r.words.find(x => x.m)?.t || '').toLowerCase().replace(/[^a-z]/g, ''); (groups[w] ||= []).push(r); }
      for (const [w, rows] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
        const g = h('div', 'cc-group'); g.append(document.createTextNode(w), h('span', '', String(rows.length))); el.append(g);
        for (const r of rows.slice(0, 4)) line(el, r, false);
        if (rows.length > 4) el.append(h('div', 'cc-more', `${rows.length - 4} more`));
      }
    },
    // C9: the same entry page grouped by book: how the uses fall, then the places in Bible order
    greek: el => {
      nav(el, 'G2205', 'Greek', 'Ζ');
      entry(el, D.g2205);
      el.append(h('div', 'label', `Every place · ${D.usesG2205.occurrences} times in ${D.usesG2205.verses} verses`));
      tools(el, 'By book');
      const by = {};
      for (const r of D.usesG2205.rows) (by[r.ref.name] ||= []).push(r);
      const bars = h('div', 'cc-bars'); const max = Math.max(...Object.values(by).map(x => x.length));
      for (const [b, rows] of Object.entries(by)) {
        const track = h('span'); const i = h('i'); i.style.width = `${(rows.length / max) * 100}%`; track.append(i);
        bars.append(h('span', '', b), track, h('span', 'muted', String(rows.length)));
      }
      el.append(bars);
      for (const [b, rows] of Object.entries(by)) {
        const g = h('div', 'cc-group'); g.append(document.createTextNode(b), h('span', '', String(rows.length))); el.append(g);
        for (const r of rows.slice(0, 4)) line(el, r, false);
        if (rows.length > 4) el.append(h('div', 'cc-more', `${rows.length - 4} more`));
      }
    },
    // C11 (a): a verse; the chosen word opens under it with its parsing and entry; Every place only if wanted
    verse: el => {
      nav(el, 'John 2:17', 'Interlinear'); scope(el, 'John 2:17', 'Verse');
      const john = D.john.verses[0]; verseText(el, john);
      grid(el, john.words, false, [], 'G2205');
      const w = john.words.find(x => x.strong === 'G2205');
      const o = h('div', 'cc-opened');
      o.append(h('div', 'cc-parse', `As written here: ${w.original} · ${w.morph} · ${(w.parse || []).map(p => p.text).join(' / ')}`));
      entry(o, D.g2205);
      const a = h('div', 'acts two'); a.append(h('button', 'btn small', 'In the Greek tab'), h('button', 'btn small', 'Every place')); o.append(a);
      el.append(o);
    },
    // C12: a chapter; each verse toggles its words, Expand all / Collapse all do every verse
    chapter: el => {
      nav(el, 'Numbers 25', 'Interlinear');
      const all = h('span'); all.append(h('button', 'btn small', 'Expand all'), ' ', h('button', 'btn small', 'Collapse all'));
      scope(el, 'Numbers 25', 'Chapter', all);
      for (const v of D.num25.verses) {
        const open = v.v === 1 || v.v === 11;
        const ln = h('div', `cc-line${open ? ' cc-open' : ''}`);
        ln.append(h('span', 'tog', open ? '▾' : '▸'), h('span', 'vref', `${v.c}:${v.v}`), h('span', 't', v.text)); el.append(ln);
        if (open) grid(el, v.words, true, ['H7065', 'H7068']);
      }
    },
    // C13: opened from a word in the reader, it goes there; after that it is the person's to move
    opened: el => {
      nav(el, 'Numbers 25:11', 'Interlinear');
      scope(el, 'Numbers 25:11', 'Verse');
      const b = h('div', 'cc-from'); b.append(h('b', '', 'Opened from Numbers 25:11 · zealous'), h('span', 'grow', ''), h('button', 'btn small', '‹ 25:10'), h('button', 'btn small', '25:12 ›')); el.append(b);
      verseText(el, v11); grid(el, v11.words, true, ['H7068'], 'H7065');
    },
    // C14 (before): deep in the book, the way back to the verse
    deep: el => {
      nav(el, 'H7068', 'Hebrew', 'ק');
      const b = h('div', 'cc-from'); b.append(h('b', '', 'From Numbers 25:11'), h('span', 'grow', 'the reader is still there'), h('button', 'btn small', 'Back to the verse')); el.append(b);
      entry(el, D.h7068);
      el.append(h('div', 'label', `Every place · ${D.uses7068.occurrences} times in ${D.uses7068.verses} verses`));
      for (const r of D.uses7068.rows.slice(0, 16)) line(el, r, false);
    },
    // C14 (b): back at the verse; the book stays open beside the reader on its page
    back: el => {
      nav(el, 'H7068', 'Hebrew', 'ק');
      const b = h('div', 'cc-from'); b.append(h('b', '', 'Back at Numbers 25:11'), h('span', 'grow', 'the book stays on this page')); el.append(b);
      entry(el, D.h7068);
      el.append(h('div', 'label', `Every place · ${D.uses7068.occurrences} times in ${D.uses7068.verses} verses`));
      for (const r of D.uses7068.rows.slice(0, 16)) line(el, r, false);
    },
  };
  const fill = el => {
    el.replaceChildren(); S[window.__ccScene](el); el.scrollTop = 0;
    for (const o of el.querySelectorAll('.cc-fit .inter-orig')) {   // long words: fit (round 3)
      let size = parseFloat(getComputedStyle(o).fontSize); const room = o.parentElement.clientWidth - 12;
      while (o.scrollWidth > room && size > 13) { size -= 1; o.style.fontSize = `${size}px`; }
    }
  };
  window.__ccScene = scene;
  const p = window.__wb.dock().open('concordance', 'Concordance', 'concordance', 'left', fill);
  fill(p.el);
}

/** Runs in the page: scrolls the Concordance pane to a part. */
function focusPart(sel) {
  const t = document.querySelector(`.pane-concordance ${sel}`);
  const s = t?.closest('.pane');
  if (!t || !s) return 'not found';
  s.scrollTop = t.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - 120;
  return s.scrollTop;
}

const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
let browser;
try {
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); } catch { await sleep(300); }
  }
  if (!browser) throw new Error(`The app did not open its DevTools port ${cdpPort}`);
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', e => console.log('page error:', String(e)));
  for (let i = 0; i < 100 && !/^(https?|tauri):/.test(page.url()); i++) await sleep(200);
  await page.waitForLoadState('load');
  await page.goto(page.url().replace(/\?.*$/, '') + '?at=NUM.25');
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
  await sleep(800);
  const type = async text => {
    await page.locator('#cmd').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(text);
    await sleep(400);
    await page.keyboard.press('Enter');
    await sleep(1500);
  };
  // the middle of a study: on Numbers 25:11, a few lookups made, so the trail and the dock hold real steps
  await type('Numbers 25:11');
  await type('lex strongs H7068');
  await type('Numbers 25:11');
  const shot = async (name, scene, part, before) => {
    if (only.length && !only.includes(name)) return;
    if (before) await before();
    if (scene) await page.evaluate(mount, { scene, D: DATA, CSS });
    await sleep(1200);
    if (part) console.log('  scrolled', await page.evaluate(focusPart, part));
    await sleep(400);
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
    console.log('scene', name);
  };
  // the reader's word, by its place (verse, word number)
  const clickWord = async (v, i) => {
    const k = await page.evaluate(([v, i]) => { const d = window.__wb.drawn; for (let k = 0; k < d.v.length; k++) if (d.v[k] === v && d.i[k] === i) return k; return -1; }, [v, i]);
    await page.locator(`#reader .w[data-k="${k}"]`).click();
    await sleep(1500);
  };

  await shot('c02-search', 'search');
  await shot('c01-english-page', 'english', '.cc-line.cc-open');
  await shot('c08-hebrew-by-english-word', 'hebrew');
  await shot('c09-greek-by-book', 'greek');
  // C10: the app's own word sheet for "zealous", its actions as decided: one In the Concordance door, BDB, Webster's
  await shot('c10-word-card-door', null, null, async () => {
    await clickWord(11, 24);
    console.log('  word sheet:', await page.evaluate(() => {
      const acts = [...document.querySelectorAll('.lex .acts')].pop();
      if (!acts) return 'no actions found';
      const b = (cls, t) => { const x = document.createElement('button'); x.className = cls; x.textContent = t; return x; };
      const lex = acts.closest('.lex');
      // the old actions go (Every use, Interlinear, Keep as pane); the door and the two books come in their place
      lex.querySelectorAll('.acts, .actions').forEach(x => x.remove());
      const door = document.createElement('div'); door.className = 'acts'; const go = b('btn primary', 'In the Concordance'); go.style.width = '100%'; door.append(go);
      const two = document.createElement('div'); two.className = 'acts two'; two.append(b('btn', 'BDB'), b('btn', 'Webster’s'));
      const after = lex.querySelector('.chips') || lex.querySelector('.usage') || lex.querySelector('.def');
      after.after(door, two);
      return 'changed';
    }));
  });
  await page.keyboard.press('Escape');
  await sleep(500);
  await shot('c11-verse-word-opened', 'verse', '.cc-opened');
  await shot('c12-chapter-toggles', 'chapter');
  await shot('c13-opened-from-the-reader', 'opened', '.cc-picked');
  await shot('c14-before-back-to-the-verse', 'deep');
  await shot('c14-back-at-the-verse', 'back', null, async () => { await type('Numbers 25:11'); });
} finally {
  await browser?.close().catch(() => {});
  kill();
}
