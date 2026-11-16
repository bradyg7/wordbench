// The Concordance's round 3 (C11-C14), drawn in the real app in the middle of a study: its own instance on its own
// copy of the scratch study folder (the person's notes, highlights and threads, never the real folder), driven over the
// DevTools protocol as measure/rail.mjs does. The reader, the rail, the top bar, the trail line and the docked panes are
// the app's own; only the Concordance pane is a prototype, mounted with the dock's own open() and drawn with the app's
// CSS classes and tokens (plus the few cc-* rules below). Every word, verse and entry in it is a `wb` answer from the
// database. Nothing here is the build: the feature is built from the accepted folder, on its own branch.
// Each open question is drawn both ways (a and b), and long original words on the cards both ways (fit, grow).
//
//   npx tauri build --no-bundle   (once, for target/release)
//   node design/features/concordance/scene.mjs
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const root = new URL('../../../', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const exe = file('target/release/bible-workbench.exe');
const wbExe = file('target/release/wb.exe');
const shots = file('design/features/concordance/scenes/');
mkdirSync(shots, { recursive: true });
if (!process.argv.includes('--c12')) for (const f of readdirSync(shots)) if (f.startsWith('round3-')) rmSync(path.join(shots, f));
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'concordance-scene');
const cdpPort = process.env.WB_DESK_PORT || '9336';
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const db = process.env.WB_BIBLE_DB || file('../bible-workbench/datasets/workbench.db');
if (!existsSync(db)) throw new Error(`No Bible database at ${db} (set WB_BIBLE_DB)`);

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
rmSync(path.join(study, 'history'), { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_BIBLE_DB: db, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const wb = (...a) => JSON.parse(execFileSync(wbExe, a, { env, maxBuffer: 1 << 26 }).toString());

// every answer the pane shows, from the database
const DATA = {
  john: wb('interlinear', 'John 2:17'),
  num25: wb('interlinear', 'Num 25'),
  g2205: wb('strong', 'G2205'),
  h7068: wb('strong', 'H7068'),
  uses7068: wb('uses', 'H7068'),
  usesG2205: wb('uses', 'G2205'),
};

const CSS = `
.cc-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 4px 0 10px; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
.cc-nav .field { width: 170px; }
.cc-scope { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 6px 0 10px; }
.cc-scope .grow { flex: 1; }
.cc-verse { font: var(--type-scripture); font-size: 16px; line-height: 1.6; margin: 4px 0 12px; }
.cc-verse .vref { margin-right: 6px; }
.inter-card { min-width: 0; overflow: hidden; }
.inter-card.cc-on { background: var(--accent-soft); }
.inter-card.cc-picked { border: 2px solid var(--accent); background: var(--accent-soft); }
.inter-gloss, .inter-translit { overflow-wrap: anywhere; }
/* long words, option A: the grid stays even; a long word's type shrinks until it fits its card */
.cc-fit .inter-orig { white-space: nowrap; }
/* long words, option B: each card is as wide as its word; the line wraps like text */
.cc-grow.inter-grid { display: flex; flex-wrap: wrap; }
.cc-grow .inter-card { flex: 0 0 auto; min-width: 92px; padding: 12px 12px 10px; }
.cc-grow .inter-orig { white-space: nowrap; }
.cc-opened { border: 1px solid var(--line); border-radius: var(--radius-card); padding: 12px 14px; margin: 14px 0; background: var(--surface); }
.cc-parse { font: var(--type-caption); color: var(--muted); margin: 2px 0 8px; }
.cc-line { display: flex; gap: 8px; align-items: baseline; padding: 4px 6px; border-radius: 6px; font: var(--type-small); }
.cc-line.cc-open { background: var(--accent-soft); }
.cc-line .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.cc-line.cc-open .t { white-space: normal; }
.cc-from { display: flex; gap: 8px; align-items: center; background: var(--accent-soft); border-radius: var(--radius-control); padding: 6px 10px; margin: 6px 0 10px; font: var(--type-small); }
.cc-from b { color: var(--accent); }
.cc-from .grow { flex: 1; color: var(--muted); }
`;

/** Runs in the page: mounts the prototype pane for one window, in one of its versions. */
function mount({ scene, v: ver, cards, D, CSS }) {
  if (!document.getElementById('cc-proto')) {
    const s = document.createElement('style'); s.id = 'cc-proto'; s.textContent = CSS; document.head.append(s);
  }
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const seg = (opts, on) => { const s = h('div', 'seg small'); for (const o of opts) s.append(h('button', o === on ? 'on' : '', o)); return s; };
  const nav = (el, q, tab) => {
    const n = h('div', 'cc-nav'); const f = h('input', 'field'); f.value = q;
    n.append(f, seg(['English', 'Hebrew', 'Greek', 'Interlinear'], tab)); el.append(n);
  };
  const scope = (el, ref, on, extra) => {
    const s = h('div', 'cc-scope'); s.append(h('h2', 'pane-title', ref), seg(['Verse', 'Passage', 'Chapter'], on));
    if (extra) s.append(h('span', 'grow'), extra);
    el.append(s);
  };
  const verseText = (el, v) => { const p = h('p', 'cc-verse'); p.append(h('span', 'vref', `${v.c}:${v.v}`), v.text); el.append(p); };
  const grid = (el, words, rtl, mark = [], pick = '') => {
    const g = h('div', `inter-grid cc-${cards}`); g.dir = rtl ? 'rtl' : 'ltr';
    for (const w of words) {
      const c = h('div', `inter-card${w.strong === pick ? ' cc-picked' : mark.includes(w.strong) ? ' cc-on' : ''}`);
      const o = h('div', 'inter-orig', w.original); o.lang = rtl ? 'he' : 'grc';
      c.append(o, h('div', 'inter-translit', w.translit || ''), h('div', 'inter-strong', w.strong || ''), h('div', 'inter-gloss', w.gloss || ''));
      g.append(c);
    }
    el.append(g);
  };
  // option A: shrink each long word until it fits its card (never under 13px)
  const fitAll = el => {
    if (cards !== 'fit') return;
    for (const o of el.querySelectorAll('.inter-orig')) {
      let size = parseFloat(getComputedStyle(o).fontSize);
      const room = o.parentElement.clientWidth - 12;
      while (o.scrollWidth > room && size > 13) { size -= 1; o.style.fontSize = `${size}px`; }
    }
  };
  const entry = (el, d) => {
    const top = h('div', 'lemma-row'); const l = h('span', 'lemma', d.lemma); l.lang = d.lang === 'heb' ? 'he' : 'grc';
    const tr = h('div'); tr.append(h('div', 'translit', d.translit || ''), h('div', 'muted small', `${d.strong} · ${d.pron || ''}${d.pos ? ` · ${d.pos}` : ''} · ${d.occurrences}×`));
    top.append(l, tr); el.append(top);
    if (d.definition) el.append(h('p', 'def', d.definition));
    if (d.usage) el.append(h('p', 'usage', `KJV: ${d.usage.replace(/\[\[(\w+)\]\]/g, '$1')}`));
    if (d.renderings?.length) { const r = h('div', 'chips'); for (const x of d.renderings) r.append(h('span', 'chip', `${x.w} ${x.n}`)); el.append(r); }
  };
  // a place line keeps a few words around the word (round 2 review), one line each
  const places = (el, uses, n) => {
    el.append(h('div', 'label', `Every place · ${uses.occurrences} times in ${uses.verses} verses`));
    for (const r of uses.rows.slice(0, n)) {
      const k = Math.max(0, r.words.findIndex(w => w.m));
      const a = Math.max(0, k - 5), b = Math.min(r.words.length, k + 6);
      const ln = h('div', 'cc-line'); const t = h('span', 't'); t.style.fontFamily = 'var(--font-scripture, serif)';
      if (a > 0) t.append('… ');
      for (const w of r.words.slice(a, b)) { t.append(w.lead || ''); t.append(w.m ? h('mark', `found m-${w.m}`, w.t) : document.createTextNode(w.t)); t.append(w.trail || ''); }
      if (b < r.words.length) t.append(' …');
      const ref = h('span', 'vref', `${r.ref.name} ${r.ref.c}:${r.ref.v}`); ref.style.minWidth = '112px';
      ln.append(ref, t); el.append(ln);
    }
  };
  const from = (el, ref, here) => {
    const b = h('div', 'cc-from');
    if (here) b.append(h('b', '', `Back at ${ref}`), h('span', 'grow', 'the book stays on this page'));
    else b.append(h('b', '', `From ${ref}`), h('span', 'grow', 'the reader is still there'), h('button', 'btn small', 'Back to the verse'));
    el.append(b);
  };
  const john = D.john.verses[0];
  const v11 = D.num25.verses.find(x => x.v === 11);
  const fills = {
    c11: el => {
      if (ver === 'b') {   // the word goes straight to its tab: the entry and every place, with the way back to the verse
        nav(el, 'G2205', 'Greek');
        from(el, 'John 2:17 (interlinear)');
        entry(el, D.g2205); places(el, D.usesG2205, 14);
        return;
      }
      nav(el, 'John 2:17', 'Interlinear'); scope(el, 'John 2:17', 'Verse'); verseText(el, john);
      grid(el, john.words, false, [], 'G2205');
      const w = john.words.find(x => x.strong === 'G2205');
      const o = h('div', 'cc-opened');
      o.append(h('div', 'cc-parse', `As written here: ${w.original} · ${w.morph} · ${(w.parse || []).map(p => p.text).join(' / ')}`));
      entry(o, D.g2205);
      const a = h('div', 'acts two'); a.append(h('button', 'btn primary small', 'In the Greek tab'), h('button', 'btn small', 'Every place')); o.append(a);
      el.append(o);
    },
    c12: el => {
      nav(el, 'Numbers 25', 'Interlinear');
      if (ver === 't') {   // round 3 review: each verse toggles its words; Expand all / Collapse all do every verse
        const all = h('span', 'cc-follow'); all.append(h('button', 'btn small', 'Expand all'), h('button', 'btn small', 'Collapse all'));
        scope(el, 'Numbers 25', 'Chapter', all);
        for (const v of D.num25.verses) {
          const open = v.v === 11 || v.v === 13;
          const ln = h('div', `cc-line${open ? ' cc-open' : ''}`);
          ln.append(h('span', 'muted', open ? '▾' : '▸'), h('span', 'vref', `${v.c}:${v.v}`), h('span', 't', v.text)); el.append(ln);
          if (open) grid(el, v.words, true, ['H7065', 'H7068']);
        }
        return;
      }
      scope(el, 'Numbers 25', 'Chapter', seg(['One verse open', 'Every verse'], ver === 'b' ? 'Every verse' : 'One verse open'));
      for (const v of D.num25.verses) {
        const open = ver === 'b' || v.v === 11;
        const ln = h('div', `cc-line${v.v === 11 ? ' cc-open' : ''}`);
        ln.append(h('span', 'vref', `${v.c}:${v.v}`), h('span', 't', v.text)); el.append(ln);
        if (open) grid(el, v.words, true, ['H7065', 'H7068']);
      }
    },
    c13: el => {
      nav(el, 'Numbers 25:11', 'Interlinear');
      const on = ver !== 'b';
      const v = on ? v11 : D.num25.verses.find(x => x.v === 7);
      const f = h('span'); f.append(h('span', 'chip', `Follows the reader: ${on ? 'on' : 'off'}`));
      scope(el, `Numbers 25:${v.v}`, 'Verse', f);
      if (!on) { const b = h('div', 'cc-from'); b.append(h('span', 'grow', 'The reader is at Numbers 25:11'), h('button', 'btn small', 'Show 25:11')); el.append(b); }
      verseText(el, v); grid(el, v.words, true, ['H7065', 'H7068']);
    },
    c14: el => {
      nav(el, 'H7068', 'Hebrew');
      from(el, 'Numbers 25:11', ver === 'b');
      entry(el, D.h7068); places(el, D.uses7068, 18);
    },
  };
  window.__ccPane = window.__wb.dock().open('concordance', 'Concordance', `concordance|${scene}|${ver}|${cards}`, 'left', el => { el.replaceChildren(); fills[scene](el); fitAll(el); });
}

/** Runs in the page: scrolls the pane to the part a window is about. */
function focusPart(sel) {
  const t = document.querySelector(sel);
  const s = t?.closest('.pane');
  if (!t || !s) return 'not found';
  const top = t.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop;
  s.scrollTop = sel === '.cc-opened' ? top + t.offsetHeight - s.clientHeight + 16 : top - 120;
  return s.scrollTop;
}

const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
let browser;
try {
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); } catch { await sleep(300); }
  }
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
  await type('uses H7068');
  await type('Numbers 25:11');
  const shot = async (scene, v, cards, name, part, after) => {
    await page.evaluate(mount, { scene, v, cards, D: DATA, CSS });
    await sleep(1200);
    if (part) console.log('  scrolled to', await page.evaluate(focusPart, part));
    if (after) await after();
    await sleep(400);
    await page.screenshot({ path: shots + name });
    console.log('scene', name);
  };
  if (process.argv.includes('--c12')) {   // only the redrawn C12 (round 3 review)
    await shot('c12', 't', 'fit', 'round3-c12-toggles.png', '.cc-line.cc-open');
    await browser.close().catch(() => {}); kill(); process.exit(0);
  }
  // long words on the cards: A shrinks the word to fit an even grid, B lets each card be as wide as its word
  await shot('c11', 'a', 'fit', 'round3-cards-a-fit-greek.png');
  await shot('c11', 'a', 'grow', 'round3-cards-b-grow-greek.png');
  await shot('c13', 'a', 'fit', 'round3-cards-a-fit-hebrew.png');
  await shot('c13', 'a', 'grow', 'round3-cards-b-grow-hebrew.png');
  // each question, both answers (cards: fit)
  await shot('c11', 'a', 'fit', 'round3-c11-a-opens-under-the-verse.png', '.cc-opened');
  await shot('c11', 'b', 'fit', 'round3-c11-b-goes-to-its-tab.png');
  await shot('c12', 'a', 'fit', 'round3-c12-a-one-verse-open.png', '.cc-line.cc-open');
  await shot('c12', 'b', 'fit', 'round3-c12-b-every-verse.png', '.cc-line.cc-open');
  await shot('c13', 'a', 'fit', 'round3-c13-a-follows-the-reader.png');
  await shot('c13', 'b', 'fit', 'round3-c13-b-does-not-follow.png');
  await type('lex strongs H7068');
  await shot('c14', 'a', 'fit', 'round3-c14-before-back-to-the-verse.png');
  // C14 a: Back to the verse puts the reader in front on the verse and minimizes the book at its page
  await shot('c14', 'a', 'fit', 'round3-c14-a-minimized-to-the-rail.png', null, async () => {
    await type('Numbers 25:11');
    await page.evaluate(() => window.__wb.dock().minimize(window.__ccPane));
  });
  // C14 b: the reader goes to the verse and the book stays open beside it, on its page
  await shot('c14', 'b', 'fit', 'round3-c14-b-stays-open-beside.png');
} finally {
  await browser?.close().catch(() => {});
  kill();
}
