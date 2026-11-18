// KJV+, drawn in the app as installed: the person's own build from %LOCALAPPDATA%\bible-workbench-rs\app, run as its
// own instance on its own copy of the scratch study folder (never the real folder), driven over the DevTools protocol
// as design/features/concordance/scene.mjs does. The reader, the bar, the trail and the version button are the app's
// own; the Strong's numbers are put on the reader's own words by this prototype (plus the few kp-* rules below). Every
// word and every number is a `wb chapter` answer from the database. Nothing here is the build.
//
//   node design/features/kjv-plus/scene.mjs                 every window
//   node design/features/kjv-plus/scene.mjs k1-after        only those named
// WB_APP_DIR picks another build; WB_BIBLE_DB another database.
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
mkdirSync(path.join(here, 'data'), { recursive: true });
const only = process.argv.slice(2);
if (!only.length) for (const f of readdirSync(shots)) if (/^k\d-/.test(f)) rmSync(path.join(shots, f));
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'kjv-plus-scene');
const cdpPort = process.env.WB_DESK_PORT || '9337';
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
rmSync(path.join(study, 'history'), { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_BIBLE_DB: db, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const wbRaw = (...a) => execFileSync(wbExe, a, { env, maxBuffer: 1 << 26 }).toString();

// the chapter's words and their numbers, from the database (kept in data/ so the folder shows what the shots show)
const raw = wbRaw('chapter', 'NUM', '25');
writeFileSync(path.join(here, 'data', 'chapter-num25.json'), raw);
const chapter = JSON.parse(raw);
const NUMS = {};   // "v:i" -> number, on the last word of each run of words that render one original word
for (const v of chapter.verses) {
  v.words.forEach((w, k) => {
    const next = v.words[k + 1];
    if (w.s && !(next && next.g === w.g && next.s === w.s)) NUMS[`${v.v}:${w.i}`] = w.s;
  });
}

const CSS = `
#reader.kp-after .kp-n { font: 600 0.62em/1 var(--font-ui, Inter, sans-serif); color: var(--accent); margin-left: 2px; vertical-align: 0.1em; letter-spacing: .01em; }
#reader.kp-above { line-height: 2.3; }
#reader.kp-above ruby { ruby-align: center; }
#reader.kp-above rt.kp-n { font: 600 0.5em/1.1 var(--font-ui, Inter, sans-serif); color: var(--accent); opacity: .9; }
#reader.kp-hover .kp-n { display: none; }
#reader.kp-hover .w.kp-has.kp-hot { background: var(--accent-soft); border-radius: 4px; }
.kp-tip { position: fixed; z-index: 50; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 10px 28px rgba(0,0,0,.22); padding: 6px 10px; font: var(--type-small); }
.kp-tip b { color: var(--accent); }
.kp-menu { position: fixed; z-index: 50; min-width: 230px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 12px 32px rgba(0,0,0,.25); padding: 6px; font: var(--type-small); }
.kp-menu .row { display: flex; gap: 10px; align-items: baseline; padding: 6px 8px; border-radius: 6px; }
.kp-menu .row.on { background: var(--accent-soft); }
.kp-menu .row b { min-width: 42px; }
.kp-menu .row span { color: var(--muted); }
.cmd-tool.kp-on { background: var(--accent-soft); color: var(--accent); font: 600 12px/1 var(--font-ui, Inter, sans-serif); }
`;

/** Runs in the page: puts the numbers on the reader's own words, in one of the ways (after, above, hover). */
function number({ way, NUMS, CSS }) {
  if (!document.getElementById('kp-proto')) { const s = document.createElement('style'); s.id = 'kp-proto'; s.textContent = CSS; document.head.append(s); }
  const reader = document.getElementById('reader');
  reader.classList.remove('kp-after', 'kp-above', 'kp-hover');
  reader.classList.add(`kp-${way}`);
  const d = window.__wb.drawn;
  for (const el of reader.querySelectorAll('.w[data-k]')) {
    const k = Number(el.dataset.k), n = NUMS[`${d.v[k]}:${d.i[k]}`];
    if (!n || el.querySelector('.kp-n')) continue;
    el.classList.add('kp-has'); el.dataset.kp = n;
    const s = document.createElement(way === 'above' ? 'rt' : 'span'); s.className = 'kp-n'; s.textContent = n;
    // right after the word itself, before its punctuation and space
    const t = [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim());
    if (t) {
      const word = t.textContent.match(/^[\w'’-]+/)?.[0];
      if (word) { t.splitText(word.length); const wrap = document.createElement(way === 'above' ? 'ruby' : 'span'); wrap.className = 'kp-word'; el.insertBefore(wrap, t); wrap.append(t, s); continue; }
    }
    el.append(s);
  }
  return reader.querySelectorAll('.kp-n').length;
}

/** Runs in the page: the hover way, a word under the pointer shows its number. */
function hover({ v, i }) {
  const d = window.__wb.drawn;
  let el = null;
  for (let k = 0; k < d.v.length; k++) if (d.v[k] === v && d.i[k] === i) el = document.querySelector(`#reader .w[data-k="${k}"]`);
  if (!el) return 'not found';
  el.classList.add('kp-hot');
  const r = el.getBoundingClientRect();
  const t = document.createElement('div'); t.className = 'kp-tip';
  t.innerHTML = `<b>${el.dataset.kp}</b> · click for its entry`;
  document.body.append(t);
  t.style.left = `${r.left}px`; t.style.top = `${r.top - t.offsetHeight - 6}px`;
  return 'shown';
}

/** Runs in the page: how it is turned on. 'version': KJV+ a reader version beside KJV and YLT; 'toggle': a # tool. */
function turnOn(how) {
  const real = document.getElementById('tb-version') || document.querySelector('.cmd-version');
  let ver = real;
  if (how === 'toggle') { real.textContent = 'KJV'; real.classList.remove('kp-on'); ver = document.createElement('button'); ver.className = real.className + ' kp-on kp-added'; ver.removeAttribute('id'); real.after(ver); }
  if (how === 'version') {
    ver.textContent = 'KJV+'; ver.classList.add('kp-on');
    const r = ver.getBoundingClientRect();
    const m = document.createElement('div'); m.className = 'kp-menu';
    for (const [v, sub, on] of [['KJV', 'the King James text', false], ['KJV+', 'the KJV with Strong’s numbers', true], ['YLT', 'Young’s Literal Translation', false]]) {
      const row = document.createElement('div'); row.className = `row${on ? ' on' : ''}`;
      const b = document.createElement('b'); b.textContent = v; const s = document.createElement('span'); s.textContent = sub;
      row.append(b, s); m.append(row);
    }
    document.body.append(m);
    m.style.left = `${r.right - m.offsetWidth}px`; m.style.top = `${r.bottom + 6}px`;
  } else {
    const b = ver; b.textContent = 'H#';
    b.title = 'Strong’s numbers in the text'; b.setAttribute('aria-pressed', 'true');
    const r = b.getBoundingClientRect();
    const t = document.createElement('div'); t.className = 'kp-tip';
    t.innerHTML = '<b>Strong’s numbers</b> · on (KJV only)';
    document.body.append(t);
    t.style.left = `${r.right - t.offsetWidth}px`; t.style.top = `${r.bottom + 6}px`;
  }
}

// Each window is drawn in an instance of its own, started fresh on a fresh copy of the scratch folder: today's build
// draws a new page as it moves, so one long-running instance cannot be relied on to hold the page the script holds.
const ready = async browser => {
  for (let i = 0; i < 120; i++) {
    for (const p of browser.contexts().flatMap(c => c.pages()).filter(p => !p.isClosed()).reverse()) {
      if (await p.evaluate(() => !!window.__wbReady && !!document.querySelector('#reader .w')).catch(() => false)) return p;
    }
    await sleep(250);
  }
  throw new Error('No ready page');
};
const shot = async (name, fn) => {
  if (only.length && !only.includes(name)) return;
  rmSync(study, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
  rmSync(path.join(study, 'history'), { recursive: true, force: true });
  const proc = spawn(exe, [], { env, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 100 && !browser; i++) {
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); } catch { await sleep(300); }
    }
    if (!browser) throw new Error(`The app did not open its DevTools port ${cdpPort}`);
    let page = await ready(browser);
    const type = async text => {
      await page.locator('#cmd').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(text);
      await sleep(400);
      await page.keyboard.press('Enter').catch(() => {});
      await sleep(1800);
      page = await ready(browser);
    };
    // the middle of a study: a lookup made, then back on Numbers 25:10, so the trail holds real steps
    await type('lex strongs H7068');
    await page.keyboard.press('Escape');
    await type('Numbers 25:10');
    await sleep(4000);   // the reader settles (it redraws once after a move), then the prototype goes on
    page = await ready(browser);
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.click(5, 600);   // the command box closed, as when reading
    await sleep(500);
    await fn(page);
    await sleep(300);
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
    console.log('scene', name);
  } finally {
    await browser?.close().catch(() => {});
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ }
    await sleep(1500);
  }
};

await shot('k0-kjv-today', async () => {});
await shot('k1-after-each-word', async page => console.log('  numbers', await page.evaluate(number, { way: 'after', NUMS, CSS })));
await shot('k2-above-each-word', async page => console.log('  numbers', await page.evaluate(number, { way: 'above', NUMS, CSS })));
await shot('k3-on-hover', async page => {
  await page.evaluate(number, { way: 'hover', NUMS, CSS });
  console.log('  hover', await page.evaluate(hover, { v: 11, i: 24 }));
});
await shot('k4-turned-on-as-a-version', async page => {
  await page.evaluate(number, { way: 'after', NUMS, CSS });
  await page.evaluate(turnOn, 'version');
});
await shot('k5-turned-on-as-a-toggle', async page => {
  await page.evaluate(number, { way: 'after', NUMS, CSS });
  await page.evaluate(turnOn, 'toggle');
});
