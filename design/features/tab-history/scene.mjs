// Going back inside a tab, drawn in the app as installed, mid-study (the way design/features/concordance/scene.mjs
// does on feature/concordance): the person's own build from %LOCALAPPDATA%\bible-workbench-rs\app, run as its own
// instance on its own copy of the scratch study folder (never the real folder), driven over the DevTools protocol.
// The reader, the rail, the top bar, the tab strips and the trail line are the app's own; the back and forward buttons,
// the tab's history menu, the copied tab and the extra trail steps are a prototype drawn on top with the app's CSS
// classes and tokens. The Concordance pane is a stand-in (its own folder designs it); every word in it is a `wb` answer.
//   node design/features/tab-history/scene.mjs               every shot
//   node design/features/tab-history/scene.mjs t03-copy      only those named
// WB_APP_DIR picks another build; WB_BIBLE_DB another database.
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
if (!only.length) for (const f of readdirSync(shots)) if (/^t\d\d-/.test(f)) rmSync(path.join(shots, f));
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'tab-history-scene');
const cdpPort = process.env.WB_DESK_PORT || '9337';
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
rmSync(path.join(study, 'history'), { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_BIBLE_DB: db, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const wb = (...a) => JSON.parse(execFileSync(wbExe, a, { env, maxBuffer: 1 << 26 }).toString());

const DATA = {
  h7068: wb('strong', 'H7068'),
  uses7068: wb('uses', 'H7068'),
  zealous: wb('uses', 'zealous'),
  zeal: wb('uses', 'zeal'),
};

const CSS = `
.th-nav { display: flex; align-items: center; flex: none; border-right: 1px solid var(--line); padding: 0 2px; }
.th-nav button, .th-in { display: grid; place-items: center; width: 26px; height: 100%; min-height: 30px; color: var(--fg); border-radius: 6px; }
.th-nav button:disabled { color: var(--muted); opacity: .35; }
.th-nav button:not(:disabled):hover, .th-in:hover { background: var(--accent-soft); }
.th-in { width: 22px; min-height: 22px; height: 22px; margin-left: 6px; color: var(--accent); }
.tab .th-in + .tab-name { padding-left: 4px; }
.th-line { display: inline-flex; gap: 2px; flex: none; margin-right: 4px; }
.th-line button { display: grid; place-items: center; width: 24px; height: 22px; border-radius: 6px; color: var(--fg); }
.th-line button:disabled { opacity: .35; }
.th-hint { position: fixed; z-index: 99; background: var(--fg); color: var(--bg); font: var(--type-caption); padding: 4px 8px; border-radius: 6px; white-space: nowrap; }
.th-menu { position: fixed; z-index: 99; width: 300px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 12px 32px rgba(0,0,0,.25); padding: 6px; font: var(--type-small); }
.th-menu .label { margin: 6px 8px 2px; }
.th-row { display: flex; gap: 8px; align-items: center; padding: 5px 8px; border-radius: 6px; }
.th-row.on { background: var(--accent-soft); font: var(--type-small-strong); }
.th-row .grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-row .muted { font: var(--type-caption); }
.th-row.from { color: var(--muted); }
.th-sep { border-top: 1px solid var(--line); margin: 6px 4px; }
.th-copy { box-shadow: inset 0 2px 0 var(--accent); }
.cc-head { display: flex; gap: 10px; align-items: baseline; margin: 10px 0 4px; }
.cc-head h3 { font: var(--type-heading); letter-spacing: .04em; margin: 0; }
.cc-line { display: flex; gap: 8px; align-items: baseline; padding: 4px 6px; border-radius: 6px; font: var(--type-small); }
.cc-line .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; font-family: var(--font-scripture, serif); }
.cc-line.cc-open { background: var(--accent-soft); }
.cc-nav { display: flex; gap: 8px; align-items: center; padding: 4px 0 8px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
.cc-nav .field { width: 180px; }
`;

/** Runs in the page: draws one shot on top of the app as it stands. */
function mount({ shot, D, CSS }) {
  if (!document.getElementById('th-proto')) {
    const s = document.createElement('style'); s.id = 'th-proto'; s.textContent = CSS; document.head.append(s);
  }
  for (const x of document.querySelectorAll('.th-nav, .th-in, .th-line, .th-hint, .th-menu, .th-extra')) x.remove();
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const chev = (d, size = 14) => {
    const ns = 'http://www.w3.org/2000/svg'; const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('width', size); s.setAttribute('height', size);
    const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d === 'l' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5');
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.6'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.append(p); return s;
  };
  const btn = (d, label, off) => { const b = h('button'); b.append(chev(d)); b.title = label; b.setAttribute('aria-label', label); b.disabled = !!off; return b; };
  const seg = (opts, on) => { const s = h('div', 'seg small'); for (const o of opts) s.append(h('button', o === on ? 'on' : '', o)); return s; };
  const line = (el, r) => {
    const k = Math.max(0, r.words.findIndex(w => w.m)); const a = Math.max(0, k - 5), b = Math.min(r.words.length, k + 6);
    const ln = h('div', 'cc-line'); const t = h('span', 't');
    if (a > 0) t.append('… ');
    for (const w of r.words.slice(a, b)) { t.append(w.lead || ''); t.append(w.m ? h('mark', `found m-${w.m}`, w.t) : document.createTextNode(w.t)); t.append(w.trail || ''); }
    if (b < r.words.length) t.append(' …');
    const ref = h('span', 'vref', `${r.ref.name} ${r.ref.c}:${r.ref.v}`); ref.style.minWidth = '118px';
    ln.append(ref, t); el.append(ln); return ln;
  };
  // the Concordance stand-in: an entry page (H7068) and a word page (zealous)
  const entryPage = el => {
    el.replaceChildren();
    const n = h('div', 'cc-nav'); const f = h('input', 'field'); f.value = 'H7068'; n.append(f, seg(['English', 'Hebrew', 'Greek', 'Interlinear'], 'Hebrew')); el.append(n);
    const d = D.h7068; const top = h('div', 'lemma-row'); const l = h('span', 'lemma', d.lemma); l.lang = 'he';
    const tr = h('div'); tr.append(h('div', 'translit', d.translit || ''), h('div', 'muted small', `${d.strong} · ${d.occurrences}×`)); top.append(l, tr); el.append(top);
    if (d.definition) el.append(h('p', 'def', d.definition));
    el.append(h('div', 'label', `Every place · ${D.uses7068.occurrences} times in ${D.uses7068.verses} verses`));
    D.uses7068.rows.slice(0, 18).forEach((r, i) => { const ln = line(el, r); if (r.ref.c === 25 && r.ref.v === 11 && r.ref.name.startsWith('Num')) ln.classList.add('cc-open'); });
  };
  const wordPage = el => {
    el.replaceChildren();
    const n = h('div', 'cc-nav'); const f = h('input', 'field'); f.value = 'zealous'; n.append(f, seg(['English', 'Hebrew', 'Greek', 'Interlinear'], 'English')); el.append(n);
    const hd = h('div', 'cc-head'); hd.append(h('h3', '', 'ZEALOUS'), h('span', 'muted small', String(D.zealous.occurrences))); el.append(hd);
    for (const r of D.zealous.rows) line(el, r);
    const more = h('div', 'muted small'); more.style.margin = '8px 6px'; more.textContent = `Other forms: zeal ${D.zeal.occurrences}`; el.append(more);
  };
  const dock = window.__wb.dock();
  const W = (window.__th ||= {});
  if (!W.cc) W.cc = dock.open('concordance', 'Concordance', 'concordance', 'left', entryPage);
  entryPage(W.cc.el);
  const copy = shot === 'copy' || shot === 'copyMenu' || shot === 'copyTrail';
  if (copy && !W.cp) W.cp = dock.open('concordance', 'zealous', 'concordance|zealous', 'left', wordPage);
  if (copy) { wordPage(W.cp.el); dock.show(W.cp); } else dock.show(W.cc);
  const front = copy ? W.cp : W.cc;
  const tab = document.querySelector(`.tab[data-pane="${front.id}"]`);
  const strip = tab?.closest('.tabstrip');
  if (!tab || !strip) return 'no tab';
  if (copy) tab.classList.add('th-copy');

  // this tab's own history, oldest first; a copy carries the history of the tab it came from
  const own = [
    { t: 'Concordance', s: 'the opening of the book' },
    { t: 'zeal', s: 'English · all forms' },
    { t: 'H7068 קִנְאָה', s: 'Hebrew · every place' },
  ];
  const hist = copy ? [...own, { t: 'zealous', s: 'English · this word', copy: true }] : own;

  // the trail line: the moves inside the tab are steps, after the app's own steps
  const tl = document.querySelector('.trail-line');
  // drawn as the sitting stands: the reader, a lookup, back to the reader, the Concordance and two moves inside it
  const extraSteps = () => {
    if (!tl) return;
    const real = [...tl.querySelectorAll('.trail-step')];
    const iconFor = k => real.find(s => s.querySelector('.trail-title')?.textContent === k)?.querySelector('svg')?.cloneNode(true);
    const ico = { reader: iconFor('Numbers 25'), word: iconFor('H7068'), book: iconFor('Concordance') || iconFor('zealous') };
    const chip = tl.querySelector('.trail-chip'); const grow = tl.querySelector('.grow');
    while (chip.nextSibling && chip.nextSibling !== grow) chip.nextSibling.remove();
    const add = (t, kind, on, fork, first) => {
      if (!first) grow.before(chev('r', 12));
      const b = h('button', `trail-step${on ? ' on' : ''}`); if (ico[kind]) b.append(ico[kind].cloneNode(true)); b.append(h('span', 'trail-title', t)); grow.before(b);
      if (fork) grow.before(h('span', 'trail-fork'));
    };
    add('Numbers 25', 'reader', false, false, true); add('H7068', 'word'); add('Numbers 25', 'reader');
    add('Concordance', 'book'); add('zeal', 'book'); add('H7068', 'book', !copy, copy); if (copy) add('zealous', 'book', true);
    const c = tl.querySelector('.trail-count'); if (c) c.textContent = copy ? '7 steps · 1 fork' : '6 steps';
  };

  const pairStrip = () => { const n = h('div', 'th-nav'); n.append(btn('l', `Back to ${hist[hist.length - 2].t}`), btn('r', 'Forward', true)); strip.prepend(n); return n; };
  const inTab = () => { const b = h('button', 'th-in'); b.append(chev('l', 13)); b.title = `Back to ${hist[hist.length - 2].t}`; tab.prepend(b); return b; };
  const onLine = () => { const n = h('span', 'th-line'); n.append(btn('l', 'Back in the front tab'), btn('r', 'Forward', true)); tl.prepend(n); return n; };
  const hint = (el, text) => { const r = el.getBoundingClientRect(); const t = h('div', 'th-hint', text); t.style.left = `${r.left}px`; t.style.top = `${r.bottom + 6}px`; document.body.append(t); };
  const menu = el => {
    const r = el.getBoundingClientRect(); const m = h('div', 'th-menu');
    m.style.left = `${r.left}px`; m.style.top = `${r.bottom + 6}px`;
    m.append(h('div', 'label', copy ? 'This tab · zealous' : 'This tab · Concordance'));
    [...hist].reverse().forEach((s, i) => {
      if (copy && i === 1) { m.append(h('div', 'th-sep'), h('div', 'label', 'Before it: copied from Concordance')); }
      const row = h('div', `th-row${i === 0 ? ' on' : ''}${copy && i > 0 ? ' from' : ''}`);
      row.append(h('span', 'grow', s.t), h('span', 'muted', s.s)); m.append(row);
    });
    m.append(h('div', 'th-sep'));
    const all = h('div', 'th-row'); all.append(h('span', 'grow', 'Show on the trail')); m.append(all);
    document.body.append(m);
  };

  extraSteps();
  if (shot === 'strip') { const n = pairStrip(); hint(n, `Back to ${hist[hist.length - 2].t} · Alt+←`); }
  if (shot === 'inTab') { const b = inTab(); hint(b, `Back to ${hist[hist.length - 2].t}`); }
  if (shot === 'line') { const n = onLine(); hint(n, 'Back in the front tab (Concordance): zeal'); }
  if (shot === 'menu') { const n = pairStrip(); menu(n); }
  if (shot === 'copy') { const n = pairStrip(); hint(n, 'Back to H7068 קִנְאָה (copied from Concordance)'); }
  if (shot === 'copyMenu') { const n = pairStrip(); menu(n); }
  if (shot === 'copyTrail') { pairStrip(); hint(tl.querySelector('.trail-step.on'), 'zealous · its own tab, forked from H7068 in Concordance'); }
  return 'ok';
}

/** Runs in the page: the reader as a tab of its own: its back goes through the places it was moved to. */
function readerBack({ CSS, where }) {
  if (!document.getElementById('th-proto')) { const s = document.createElement('style'); s.id = 'th-proto'; s.textContent = CSS; document.head.append(s); }
  for (const x of document.querySelectorAll('.th-nav, .th-in, .th-line, .th-hint, .th-menu, .th-extra')) x.remove();
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const steps = [...document.querySelectorAll('.trail-line .trail-step .trail-title')].map(x => x.textContent);
  const tl = document.querySelector('.trail-line');
  const n = h('span', 'th-line');
  const mk = (d, t, off) => { const b = h('button'); b.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`; b.title = t; b.disabled = off; return b; };
  n.append(mk('M10 3L5 8l5 5', 'Back', false), mk('M6 3l5 5-5 5', 'Forward', true));
  if (where === 'line') tl.prepend(n);
  else { const r = document.querySelector('#scroller') || document.querySelector('#reader'); const box = h('div', 'th-nav'); box.style.cssText = 'position:fixed;z-index:50;background:var(--sunken);border:1px solid var(--line);border-radius:8px;height:30px'; box.append(...n.children); const b = r.getBoundingClientRect(); box.style.left = `${b.left + 10}px`; box.style.top = `${b.top + 8}px`; document.body.append(box); n.replaceChildren(box); }
  const t = h('div', 'th-hint', `Back in the reader: ${steps.filter(s => /\d/.test(s)).slice(-2, -1)[0] || 'the last place'}`);
  const r = (where === 'line' ? n : n.firstChild).getBoundingClientRect(); t.style.left = `${r.left}px`; t.style.top = `${r.bottom + 6}px`; document.body.append(t);
  return steps.join(' > ');
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
  const base = page.url().replace(/\?.*$/, '');
  const type = async text => {
    await page.locator('#cmd').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(text);
    await sleep(400);
    await page.keyboard.press('Enter');
    await sleep(1500);
  };
  // mid-study, set up afresh for every shot: on Numbers 25:11, a lookup made, so the trail and the dock hold real steps
  const prepare = async reader => {
    await page.goto(base + '?at=NUM.25');
    await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
    await sleep(800);
    await type('Numbers 25:11');
    await type('lex strongs H7068');
    await type('Numbers 25:11');
    if (reader) { await page.keyboard.press('Escape'); await type('Psalms 69:9'); await type('John 2:17'); }
  };
  const shot = async (name, fn, arg, reader) => {
    if (only.length && !only.includes(name)) return;
    await prepare(reader);
    console.log('scene', name, await page.evaluate(fn, arg));
    await sleep(900);
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
  };
  await shot('t01-a-back-in-the-strip', mount, { shot: 'strip', D: DATA, CSS });
  await shot('t01-b-back-in-the-tab', mount, { shot: 'inTab', D: DATA, CSS });
  await shot('t01-c-back-on-the-trail-line', mount, { shot: 'line', D: DATA, CSS });
  await shot('t02-the-tabs-history', mount, { shot: 'menu', D: DATA, CSS });
  await shot('t03-copy-opened', mount, { shot: 'copy', D: DATA, CSS });
  await shot('t03-copy-history', mount, { shot: 'copyMenu', D: DATA, CSS });
  await shot('t03-copy-on-the-trail', mount, { shot: 'copyTrail', D: DATA, CSS });
  // the reader is a tab too: moved Numbers 25 -> Psalms 69 -> John 2, its back goes through those places
  await shot('t04-a-reader-back-on-the-trail-line', readerBack, { CSS, where: 'line' }, true);
  await shot('t04-b-reader-back-at-its-head', readerBack, { CSS, where: 'head' }, true);
} finally {
  await browser?.close().catch(() => {});
  kill();
}
