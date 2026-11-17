// Measures the release app against the budgets of docs/PLAN.md section 6, at the phone window size:
//   start-up (process start to the last place on screen) and memory, five launches;
//   then, with the web view's CPU slowed 4x over the DevTools protocol: a chapter drawn, a tap card (real touch input
//   through WebView2's touch path), a hover card, a long press and drag, and scrolling Psalm 119 with marks on.
// Writes measure/out/results.json.     npm run measure   (after: npx tauri build --no-bundle)
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { acquire, freePort } from './instance.mjs';

const root = new URL('..', import.meta.url);
// --debug: the debug app (it loads the UI from `npm run dev`); --chapters: only the chapter draws, for quick profiling.
const debug = process.argv.includes('--debug'), only = process.argv.includes('--chapters'), sheets = process.argv.includes('--sheets');
const exe = new URL(`target/${debug ? 'debug' : 'release'}/bible-workbench.exe`, root).pathname.slice(1);
const out = new URL('measure/out/', root);
const profile = path.join(os.tmpdir(), 'bible-workbench-rs', 'measure-webview');
await acquire('measure');
mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = xs => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

function launch(env) {
  const ready = new URL(`ready-${Date.now()}.json`, out).pathname.slice(1);
  const t0 = Date.now();
  // its own web view profile, so a watch window open at the same time (another profile's options) does not stop it
  const proc = spawn(exe, [], { env: { ...process.env, WB_WINDOW: 'phone', WB_MEASURE_OUT: ready, WEBVIEW2_USER_DATA_FOLDER: profile, ...env }, stdio: 'ignore' });
  return { proc, t0, ready };
}

async function waitReady(l) {
  for (let i = 0; i < 300; i++) {
    if (existsSync(l.ready)) {
      await sleep(50);
      try { const r = JSON.parse(readFileSync(l.ready, 'utf8')); rmSync(l.ready); return r; } catch { /* still being written */ }
    }
    await sleep(20);
  }
  throw new Error('the app did not report ready');
}

const memory = pid => JSON.parse(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', new URL('measure/memory.ps1', root).pathname.slice(1), '-ProcessId', String(pid)]).toString());
const kill = pid => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' }); } catch { /* gone */ } };

// The measured instances write their wb do address over the watch window's; it is put back at the end.
const appJson = path.join(process.env.WB_CACHE_DIR || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'bible-workbench-rs', 'cache'), 'app.json');
const appJsonBefore = existsSync(appJson) ? readFileSync(appJson) : null;

const results = { when: new Date().toISOString(), exe_mb: +(statSync(exe).size / 1048576).toFixed(1), startup: [], memory: [] };

// ---- start-up and memory ------------------------------------------------------------------------------------------
for (let run = 0; run < (only || sheets ? 0 : 6); run++) {
  const l = launch({});
  const r = await waitReady(l);
  const ms = r.ready_wall_ms - l.t0;
  await sleep(2500);
  const mem = memory(l.proc.pid);
  if (run > 0) {   // the first launch warms the disk cache and the web view's profile; it is reported apart
    results.startup.push({ ms, main_to_ready_ms: r.main_to_ready_ms, ui_nav_to_ready_ms: r.ui.nav_to_ready_ms, chapter_ms: r.ui.perf[0]?.ms });
    results.memory.push({ total_ws_mb: mem.total_ws_mb, total_private_mb: mem.total_private_mb, processes: mem.processes.length });
  } else {
    results.first_launch = { ms, main_to_ready_ms: r.main_to_ready_ms, memory: mem };
  }
  kill(l.proc.pid);
  await sleep(800);
}

// ---- budgets with the CPU slowed 4x ---------------------------------------------------------------------------------
const port = await freePort();
const l = launch({ WB_CDP_PORT: String(port) });
await waitReady(l);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page = browser.contexts()[0].pages()[0];
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
results.throttle = 4;

const entries = async name => (await page.evaluate(() => window.__wb.perf.entries)).filter(e => e.name === name);
const clear = () => page.evaluate(() => { window.__wb.perf.entries.length = 0; });

// A chapter drawn (open → on screen), several chapters, three times each.
await clear();
for (let i = 0; i < (sheets ? 0 : 3); i++) for (const [b, c] of [['NUM', 24], ['NUM', 25], ['NUM', 26], ['JHN', 3], ['PSA', 119]]) await page.evaluate(([b, c]) => window.__wb.open(b, c), [b, c]);
const ch = await entries('chapter');
if (only) {
  for (const e of ch.slice(-5)) console.log(e.at, Object.entries(e).filter(([k]) => k.endsWith('_ms') || k === 'ms').map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  '));
  await browser.close().catch(() => {}); kill(l.proc.pid); process.exit(0);
}
if (!sheets) {
await sleep(1500);   // let the last chapter's later parts finish
const done = (await entries('chapter-complete')).filter(e => e.at === 'PSA 119').map(e => e.ms);
results.psalm119_complete_ms = done.length ? +median(done).toFixed(0) : null;
results.chapter = Object.fromEntries(['NUM 24', 'NUM 25', 'NUM 26', 'JHN 3', 'PSA 119'].map(at => {
  const xs = ch.filter(e => e.at === at);
  const md = f => +median(xs.map(f)).toFixed(1);
  return [at, { median_ms: md(e => e.ms), rust_ms: md(e => e.rust_ms), ipc_ms: md(e => e.ipc_ms), html_ms: md(e => e.html_ms), refs_ms: md(e => e.refs_ms), frame_ms: md(e => e.frame_ms), first_words: xs[0].first_words, words: xs[0].words }];
}));

}
// A plain search (PLAN.md section 6: under 50 ms): the data through the wb command, and the whole line, typed and run,
// until the results are drawn in their pane.
if (!sheets) {
  const qs = ['grace', 'love', 'zeal', 'mercy', 'beginning', 'peace', 'faith hope', 'covenant'];
  const data = await page.evaluate(async qs => {
    const out = [];
    for (const q of qs) {
      const t = performance.now();
      const r = await window.__TAURI_INTERNALS__.invoke('wb', { argv: ['search', q] });
      out.push({ q, ms: performance.now() - t, rust_ms: r.rust_ms, verses: r.data.json.verses });
    }
    return out;
  }, qs);
  const drawn = [];
  // as the person searches: the command field parses the words for its suggestions while they are typed, so Enter
  // only runs them; timed from Enter (the run) to the results drawn
  for (const q of qs.slice(0, 5)) {
    await page.evaluate(q => window.__wb.parse(`search ${q}`), q);
    await sleep(300);
    drawn.push(await page.evaluate(async q => {
      const t = performance.now();
      window.__wb.run(`search ${q}`);
      for (let i = 0; i < 500 && ![...document.querySelectorAll('.pane-search')].some(p => !p.hidden && p.querySelector('.row') && p.querySelector('.pane-title')?.textContent === `“${q}”`); i++) await new Promise(r => requestAnimationFrame(r));
      return performance.now() - t;
    }, q));
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of [...d.panes]) d.close(p); });
  }
  results.search = {
    data_median_ms: +median(data.map(x => x.ms)).toFixed(1), data_max_ms: +Math.max(...data.map(x => x.ms)).toFixed(1), rust_median_ms: +median(data.map(x => x.rust_ms)).toFixed(2),
    pane_drawn_median_ms: +median(drawn).toFixed(1), pane_drawn_max_ms: +Math.max(...drawn).toFixed(1), each: data.map(x => [x.q, Math.round(x.ms), x.verses]),
  };
}

// Tap cards with real touch events (WebView2's own touch path, as a finger on the touchscreen would give).
await page.evaluate(() => window.__wb.open('NUM', 25));
const center = async sel => page.evaluate(sel => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const r = e.getClientRects()[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const wordSel = (v, i) => page.evaluate(([v, i]) => { const d = window.__wb.drawn; return `.w[data-k="${d.v.findIndex((x, k) => x === v && d.i[k] === i)}"]`; }, [v, i]);
const touchAt = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
await clear();
for (const [v, i] of [[11, 24], [7, 2], [13, 20], [3, 5], [15, 9], [11, 0]]) {
  const p = await center(await wordSel(v, i));
  await touchAt('touchStart', p); await sleep(60); await touchAt('touchEnd', p);
  await sleep(700);
  await page.keyboard.press('Escape');
  await sleep(200);
}
for (const v of [11, 6, 14]) {
  const p = await center(`.vn[data-v="${v}"]`);
  await touchAt('touchStart', p); await sleep(60); await touchAt('touchEnd', p);
  await sleep(700);
  await page.keyboard.press('Escape');
  await sleep(200);
}
const ws = (await entries('word-sheet')).map(e => e.ms), vs = (await entries('verse-sheet')).map(e => e.ms);
const wsE = await entries('word-sheet');
results.word_sheet = { n: ws.length, median_ms: +median(ws).toFixed(1), max_ms: +Math.max(...ws).toFixed(1), rust_ms: +median(wsE.map(e => e.rust_ms)).toFixed(1), call_ms: +median(wsE.map(e => e.call_ms)).toFixed(1), each: wsE.map(e => [e.word, Math.round(e.ms)]) };
results.verse_sheet = { n: vs.length, median_ms: +median(vs).toFixed(1), max_ms: +Math.max(...vs).toFixed(1) };
if (sheets) {
  console.log(JSON.stringify({ word_sheet: results.word_sheet, verse_sheet: results.verse_sheet }));
  await browser.close().catch(() => {}); kill(l.proc.pid);
  if (appJsonBefore) writeFileSync(appJson, appJsonBefore);
  process.exit(0);
}

// Press and hold, then drag across verses, with real touch events: does the web view scroll instead?
{
  const a = await center(await wordSel(7, 2));
  const scroll0 = await page.evaluate(() => document.getElementById('scroller').scrollTop);
  await touchAt('touchStart', a);
  await sleep(650);
  const b = await page.evaluate(sel => { const r = document.querySelector(sel).getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; }, await wordSel(8, 3));
  for (let s = 1; s <= 8; s++) { await touchAt('touchMove', { x: a.x + (b.x - a.x) * s / 8, y: a.y + (b.y - a.y) * s / 8 }); await sleep(30); }
  await touchAt('touchEnd', b);
  await sleep(300);
  results.long_press = await page.evaluate(s0 => {
    const s = window.__wb.selector.sel, d = window.__wb.drawn;
    return { selected: s ? `${d.v[s.a]}:${d.i[s.a]} – ${d.v[s.b]}:${d.i[s.b]}` : null, bar: !!document.querySelector('.selbar'), scrolled_px: document.getElementById('scroller').scrollTop - s0, menu_or_native_selection: String(getSelection()) };
  }, scroll0);
  await page.keyboard.press('Escape');
}

// Hover card with the mouse (hover cards are off by default; turned on for this).
await clear();
await page.evaluate(() => window.__wb.run('hover on'));
for (const [v, i] of [[11, 24], [7, 2], [13, 20], [3, 5]]) {
  const p = await center(await wordSel(v, i));
  await page.mouse.move(p.x, p.y, { steps: 2 });
  await sleep(900);
  await page.mouse.move(5, 300);
  await sleep(400);
}
const hc = (await entries('hover-card')).map(e => e.ms);
results.hover_card = { n: hc.length, median_ms: hc.length ? +median(hc).toFixed(1) : null, note: 'from the card being asked for (after the 280 ms hover delay) to drawn' };

// Psalm 119 with layers on: highlights on every other verse and two thread lines on every third, then a scroll
// gesture through the compositor while frames are timed in the page.
await page.evaluate(() => window.__wb.open('PSA', 119));
await page.waitForFunction(() => window.__wb.drawn.el.filter(Boolean).length === window.__wb.drawn.v.length);
await page.evaluate(() => {
  const d = window.__wb.drawn, m = d.marks, ch = d.chapter.chapter;
  const colors = ['yellow', 'green', 'blue', 'pink', 'orange'];
  for (let v = 1; v <= 176; v++) {
    if (v % 2) m.highlights.push({ kind: 'verse', code: 'PSA', c1: ch, v1: v, i1: null, c2: null, v2: null, i2: null, id: 'x' + v, color: colors[v % 5] });
    if (v % 3 === 0) for (const t of ['a', 'b']) m.threads.push({ kind: 'verse', code: 'PSA', c1: ch, v1: v, i1: null, c2: null, v2: null, i2: null, id: t, color: t === 'a' ? 'orange' : 'blue' });
  }
  window.__wb.repaint();
  window.__frames = [];
  let last = performance.now();
  const tick = now => { window.__frames.push(now - last); last = now; if (window.__frames.length < 100000) window.__raf = requestAnimationFrame(tick); };
  window.__raf = requestAnimationFrame(tick);
});
await sleep(300);
await page.evaluate(() => { window.__frames.length = 0; });
for (let n = 0; n < 4; n++) {
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 500, yDistance: n % 2 ? 2500 : -2500, speed: 1800, gestureSourceType: 'touch', repeatCount: 1 });
}
const frames = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__frames; });
const typical = median(frames);
results.psalm119_scroll = {
  frames: frames.length, median_frame_ms: +typical.toFixed(2), p95_frame_ms: +p95(frames).toFixed(2), max_frame_ms: +Math.max(...frames).toFixed(1),
  long_frames: frames.filter(f => f > typical * 1.8).length,
  marked_words: await page.evaluate(() => document.querySelectorAll('.w.hl').length),
};
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await browser.close().catch(() => {});
kill(l.proc.pid);

const s = results.startup.map(x => x.ms), m = results.memory.map(x => x.total_private_mb), w = results.memory.map(x => x.total_ws_mb);
results.summary = {
  startup_median_ms: median(s), startup_max_ms: Math.max(...s),
  memory_private_median_mb: median(m), memory_working_set_median_mb: median(w),
};
writeFileSync(new URL('results.json', out), JSON.stringify(results, null, 1));
if (appJsonBefore) writeFileSync(appJson, appJsonBefore);
console.log(JSON.stringify({ exe_mb: results.exe_mb, first_launch_ms: results.first_launch.ms, ...results.summary, chapter: results.chapter, word_sheet: results.word_sheet, verse_sheet: results.verse_sheet, hover_card: results.hover_card, search: results.search, long_press: results.long_press, psalm119_scroll: results.psalm119_scroll }, null, 1));
process.exit(0);
