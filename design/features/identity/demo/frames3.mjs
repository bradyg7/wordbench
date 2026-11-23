// Draws a frame for every round-3 interaction row (17-54) by putting the working demo into that row's state in Edge
// (the engine the Windows app uses, so the liquid glass shows), and checks R1 (no overlaps) after each.
//   node design/features/identity/demo/frames3.mjs   (after build.mjs)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rowsDir = join(here, '..', 'rows');
for (const f of readdirSync(rowsDir)) { const n = parseInt(f, 10); if (n >= 17) rmSync(join(rowsDir, f)); }
const url = pathToFileURL(join(here, 'index.html')).href;
const browser = await chromium.launch({ channel: 'msedge' });
const out = [], broken = [];
const settle = p => p.waitForTimeout(1100);
async function fresh() {
  const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto(url); await p.addStyleTag({ content: '#stage{bottom:44px}' }); await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelector('.hint')?.classList.add('gone'));
  return p;
}
const bar = (p, sel) => p.locator(`${sel} .bar`).first().boundingBox();
const bub = (p, sel) => p.locator(sel).first().boundingBox();
async function grab(p, sel) { const b = await bar(p, sel); await p.mouse.move(b.x + 160, b.y + 18); await p.mouse.down(); return b; }
const moveTo = async (p, x, y) => { await p.mouse.move(x, y, { steps: 24 }); await p.waitForTimeout(700); };
const word = async (p, n, sel = '.bub.t-bible') => { await p.locator(`${sel} .w[data-s]`).nth(n).click(); await settle(p); };
const opt = (p, k, v) => p.evaluate(([k, v]) => { window.__demo.OPT[k] = v; document.body.classList.toggle('phone', window.__demo.OPT.device === 'phone'); window.__demo.drawOpts(); window.__demo.draw(); }, [k, v]);
async function shot(p, row, caption, { check = true } = {}) {
  if (check) { const n = await p.evaluate(() => { const r = [...document.querySelectorAll('.bub')].filter(e => e.style.opacity !== '0' && !e.classList.contains('lifted')).map(e => e.getBoundingClientRect()); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], c = r[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) n++; } return n; }); if (n) broken.push(row); }
  await p.evaluate(c => { const d = document.createElement('div'); d.textContent = c; Object.assign(d.style, { position: 'fixed', left: 0, right: 0, bottom: 0, height: '44px', padding: '11px 24px', background: '#1d1d1f', color: '#fff', font: '15px Inter, sans-serif', zIndex: 99999 }); document.body.append(d); }, `${row} · ${caption}`);
  await p.screenshot({ path: join(rowsDir, `${row}.jpg`), type: 'jpeg', quality: 82 });
  out.push({ id: String(row), row, file: `rows/${row}.jpg`, caption: `${row} · ${caption}` });
}
const ROWS = [
  [17, 'Dragging a title: it lifts and eases to a handy size under the pointer; the others hold', async p => { await grab(p, '.bub.t-folder'); await moveTo(p, 1000, 760); }, { check: false }],
  [18, 'Over John 1\'s right side: the others make room live; the outline names the new column', async p => { const j = await bub(p, '.bub.t-bible'); await grab(p, '.bub.t-folder'); await moveTo(p, j.x + j.width - 40, j.y + j.height / 2); }, { check: false }],
  [19, 'Over John 1\'s top: its column splits live; the outline says Above John 1', async p => { const j = await bub(p, '.bub.t-bible'); await grab(p, '.bub.t-folder'); await moveTo(p, j.x + j.width / 2, j.y + 90); }, { check: false }],
  [20, 'Over John 1\'s middle: the outline says Swap with John 1', async p => { const j = await bub(p, '.bub.t-bible'); await grab(p, '.bub.t-folder'); await moveTo(p, j.x + j.width / 2, j.y + j.height / 2); }, { check: false }],
  [21, 'At the desk\'s left edge: a new column there', async p => { await grab(p, '.bub.t-folder'); await moveTo(p, 18, 500); }, { check: false }],
  [22, 'Let go: it lands exactly where the outline was, on the spring', async p => { const j = await bub(p, '.bub.t-bible'); await grab(p, '.bub.t-folder'); await moveTo(p, j.x + j.width / 2, j.y + 90); await p.mouse.up(); await settle(p); }],
  [23, 'Dragging the gap between two: both resize live and stop at the smallest size', async p => { const g = await p.locator('.gut.v').first().boundingBox(); await p.mouse.move(g.x + 7, g.y + 300); await p.mouse.down(); await p.mouse.move(g.x - 260, g.y + 300, { steps: 20 }); await p.waitForTimeout(400); }],
  [24, 'At the window\'s top edge: four layouts drop down in glass; the one under the pointer lights', async p => { await grab(p, '.bub.t-folder'); await moveTo(p, 800, 40); const l = await p.locator('.lay').nth(2).boundingBox(); await moveTo(p, l.x + 40, l.y + 30); }, { check: false }],
  [25, 'Let go on Thirds: the desk arranges itself in three', async p => { await grab(p, '.bub.t-folder'); await moveTo(p, 800, 40); const l = await p.locator('.lay').nth(2).boundingBox(); await moveTo(p, l.x + 40, l.y + 30); await p.mouse.up(); await settle(p); }],
  [26, 'Onto another desk\'s name: it rings; let go and the bubble moves there', async p => { const d = await p.locator('.dk[data-desk="d2"]').boundingBox(); await grab(p, '.bub.t-folder'); await moveTo(p, d.x + 50, d.y + 14); }, { check: false }],
  [27, 'A drop that would overfill: the oldest bubble dims and the outline says it goes to the tray', async p => { for (const n of [6, 9, 12, 15, 18, 21, 24]) await word(p, n); const j = await bub(p, '.bub.t-bible'); await grab(p, '.bub.t-page'); await moveTo(p, j.x + j.width / 2, j.y + j.height - 40); }, { check: false }],
  [28, 'Ctrl+Shift+→ trades the focused bubble with its neighbour (Ctrl+arrows only move the focus)', async p => { await p.locator('.bub.t-bible .body').click({ position: { x: 30, y: 400 } }); await p.keyboard.press('Control+Shift+ArrowRight'); await settle(p); }],
  [29, 'Opening more than fits: the bubble used longest ago flies into a pill at the dock\'s end', async p => { await p.evaluate(async () => { const d = window.__demo; const keys = Object.keys(DATA.lex).slice(0, 13); const src = d.allIds(d.D().cols)[0]; for (const k of keys) { d.openApp('word', k, src); await new Promise(r => setTimeout(r, 120)); } }); await settle(p); await p.mouse.move(800, 953); await p.waitForTimeout(900); await p.mouse.move(1180, 960); await p.waitForTimeout(500); }],
  [30, 'Clicking a pill: it grows back out of the pill beside the focused bubble', async p => { await p.evaluate(async () => { const d = window.__demo; const keys = Object.keys(DATA.lex).slice(0, 13); const src = d.allIds(d.D().cols)[0]; for (const k of keys) { d.openApp('word', k, src); await new Promise(r => setTimeout(r, 120)); } }); await settle(p); await p.mouse.move(800, 953); await p.waitForTimeout(900); await p.locator('.pill').first().dispatchEvent('click'); await p.waitForTimeout(250); }, { check: false }],
  [31, 'Bubble ⋯ › Put in the tray', async p => { await p.locator('.bub.t-folder .bar .ib', { hasText: '⋯' }).click(); await p.waitForTimeout(300); }, { check: false }],
  [32, 'Three passages, each its own bubble with its own ← →', async p => { await p.locator('.bub.t-folder [data-open="bible|Genesis 1"]').click(); await settle(p); await p.locator('.bub.t-folder [data-open="bible|Romans 5"]').click(); await settle(p); }],
  [33, 'Bubble ⋯ › Gather: the other Bible bubbles fold in as columns', async p => { await p.locator('.bub.t-folder [data-open="bible|Genesis 1"]').click(); await settle(p); await p.locator('.bub.t-folder [data-open="bible|Romans 5"]').click(); await settle(p); await p.locator('.bub.t-bible .bar .ib', { hasText: '⋯' }).first().click(); await p.locator('.pop button', { hasText: 'Gather' }).click(); await settle(p); }],
  [34, '⇱ pop out: a gathered column becomes its own bubble again', async p => { await p.locator('.bub.t-folder [data-open="bible|Genesis 1"]').click(); await settle(p); await p.locator('.bub.t-bible .bar .ib', { hasText: '⋯' }).first().click(); await p.locator('.pop button', { hasText: 'Gather' }).click(); await settle(p); await p.locator('.cols h5 button').first().click(); await settle(p); }],
  [35, 'Clicking a word: its entry grows out of the word into a place beside; ↖ John 1 in its title', async p => { await p.locator('.bub.t-bible .w[data-s]').nth(6).click(); await p.waitForTimeout(140); }, { check: false }],
  [36, 'Clicking ↖ John 1: the bubble it came from rings and takes focus', async p => { await word(p, 6); await p.locator('.from').first().click(); await p.waitForTimeout(250); }],
  [37, 'Alt+click: the same bubble becomes the entry; ← returns to the passage', async p => { await p.locator('.bub.t-bible .w[data-s]').nth(6).click({ modifiers: ['Alt'] }); await settle(p); }],
  [38, 'Options › Ask: a glass menu at the pointer: Beside, Here, On a new desk', async p => { await opt(p, 'rabbit', 'ask'); await p.locator('.bub.t-bible .w[data-s]').nth(6).click(); await p.waitForTimeout(300); }],
  [39, 'Opening something already open: that bubble rings instead of a copy (R11)', async p => { await word(p, 6); await p.locator('.bub.t-bible .w[data-s]').nth(6).click(); await p.waitForTimeout(250); }],
  [40, '◷ History: a glass bar with the scope, the view and the steps from earlier to now', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.waitForTimeout(400); }],
  [41, 'Scrubbing back: the desk replays on the springs, tinted warm as the past', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 1; r.dispatchEvent(new Event('input')); }); await settle(p); }],
  [42, 'Let go and act: a branch begins; the later steps are kept', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 0; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }); await settle(p); await p.click('#histbtn'); await p.locator('.bub.t-folder [data-open="bible|Romans 5"]').click(); await settle(p); }],
  [43, 'The map: dots, a second lane where the branch began; click a dot to go there', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 0; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }); await settle(p); await p.click('#histbtn'); await p.locator('.bub.t-folder [data-open="bible|Romans 5"]').click(); await settle(p); await p.click('#histbtn'); await p.locator('#hist .seg button', { hasText: 'Map' }).click(); await p.waitForTimeout(400); }],
  [44, 'Bubble ⋯ › This bubble\'s history', async p => { await p.locator('.bub.t-bible .w[data-s]').nth(6).click({ modifiers: ['Alt'] }); await settle(p); await p.locator('.bub.t-word .bar .ib', { hasText: '⋯' }).click(); await p.locator('.pop button', { hasText: 'history' }).click(); await p.waitForTimeout(400); }],
  [45, 'Scrubbing back past an edit: the page shows its words as they were', async p => { const ed = p.locator('.bub.t-page [contenteditable]'); await ed.click(); await p.keyboard.press('End'); await p.keyboard.type(' Bring a list of every use.'); await p.waitForTimeout(1100); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 0; r.dispatchEvent(new Event('input')); }); await settle(p); }],
  [46, 'Ctrl+Z on the desk: one step back, replayed on the springs', async p => { await word(p, 6); await p.mouse.click(800, 20); await p.keyboard.press('Control+z'); await p.waitForTimeout(220); }, { check: false }],
  [47, 'The pointer at the bottom edge: the glass dock rises', async p => { await p.mouse.move(800, 953); await p.waitForTimeout(900); }],
  [48, 'Along the dock: the icons swell like a lens under the pointer; the name floats above', async p => { await p.mouse.move(800, 953); await p.waitForTimeout(800); const i = await p.locator('.ai').nth(3).boundingBox(); await p.mouse.move(i.x + i.width / 2, i.y + i.height / 2, { steps: 10 }); await p.waitForTimeout(700); }],
  [49, 'Clicking Notebook in the dock: the icon bounces and the bubble grows out of it', async p => { await p.mouse.move(800, 953); await p.waitForTimeout(800); await p.locator('.ai').nth(2).click(); await p.waitForTimeout(160); }, { check: false }],
  [50, 'Clicking a desk: the green pill slides to it; its bubbles slide in from that side', async p => { await p.locator('.dk[data-desk="d2"]').click(); await p.waitForTimeout(170); }, { check: false }],
  [51, '+ makes a new empty desk; double-click a name to rename it', async p => { await p.locator('.dk', { hasText: '+' }).click(); await settle(p); }],
  [52, 'Workbench in the dock: where you left off, today\'s reading, an open question, every desk', async p => { await p.evaluate(() => window.__demo.toggleHome()); await p.waitForTimeout(500); }],
  [53, 'Phone: each bubble a full card to swipe; the dock always shown', async p => { await opt(p, 'device', 'phone'); await p.waitForTimeout(600); }],
  [55, 'Double-click a title (or ⤢, or Ctrl+Enter): it grows over the desk on the spring; the desk waits underneath, dimmed', async p => { await p.locator('.bub.t-bible .bar').dblclick({ position: { x: 300, y: 18 } }); await p.waitForTimeout(160); }, { check: false }],
  [56, 'Settled in full view: ⤡, Esc or another double-click springs it back to exactly where it was', async p => { await p.locator('.bub.t-bible .bar').dblclick({ position: { x: 300, y: 18 } }); await settle(p); }, { check: false }],
  [57, 'Back on the desk: the same place, the same size, nothing else moved', async p => { await p.locator('.bub.t-bible .bar').dblclick({ position: { x: 300, y: 18 } }); await settle(p); await p.keyboard.press('Escape'); await p.waitForTimeout(170); }, { check: false }],
  [54, 'Glass: a soft highlight follows the pointer; what lies behind bends through it', async p => { await p.mouse.move(800, 953); await p.waitForTimeout(800); await p.mouse.move(560, 960, { steps: 8 }); await p.waitForTimeout(500); await p.evaluate(() => document.querySelector('#dock').style.setProperty('--mx', '200px')); }, { check: false }],
];
for (const [row, caption, fn, o] of ROWS) {
  const p = await fresh(); try { await fn(p); } catch (e) { console.error('row', row, e.message.split('\n')[0]); }
  await shot(p, row, caption, o); await p.close();
}
const idx = JSON.parse(readFileSync(join(rowsDir, 'index.json'), 'utf8')).filter(f => f.row < 17);
writeFileSync(join(rowsDir, 'index.json'), JSON.stringify([...idx, ...out], null, 2) + '\n');
await browser.close();
console.log(out.length, 'frames;', broken.length ? 'R1 broken in rows ' + broken.join(', ') : 'R1 held in every checked row');
