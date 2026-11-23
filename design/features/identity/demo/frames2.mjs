// Draws a frame for every round-2 interaction row (17 onward) by putting the working demo into that row's state, and
// adds them to ../rows/index.json beside round 1's frames.   node design/features/identity/demo/frames2.mjs (after build.mjs)
import { webkit } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rowsDir = join(here, '..', 'rows');
const url = pathToFileURL(join(here, 'index.html')).href;
const browser = await webkit.launch();
const out = [];

async function fresh(viewport = { width: 1600, height: 1000 }) {
  const p = await browser.newPage({ viewport });
  await p.goto(url); await p.waitForTimeout(500);
  await p.addStyleTag({ content: '.hint{display:none}' });
  return p;
}
const opt = (p, key, val) => p.evaluate(([k, v]) => { const d = window.__demo; d.OPT[k] = v; document.body.classList.toggle('phone', d.OPT.device === 'phone'); if (k === 'arrange' && v === 'tiled') d.tile(); d.drawOpts(); d.draw(); }, [key, val]);
const box = (p, sel) => p.locator(sel).first().boundingBox();
async function dragTo(p, fromSel, to, { release = true, steps = 14 } = {}) {
  const b = await box(p, fromSel); await p.mouse.move(b.x + 120, b.y + 16); await p.mouse.down();
  await p.mouse.move(to[0], to[1], { steps }); await p.waitForTimeout(150); if (release) { await p.mouse.up(); await p.waitForTimeout(450); }
}
async function shot(p, row, id, caption) {
  const file = `rows/${id}.jpg`;
  await p.evaluate(c => { document.querySelector('#cap')?.remove(); const d = document.createElement('div'); d.id = 'cap'; d.textContent = c;
    Object.assign(d.style, { position: 'fixed', left: 0, right: 0, bottom: 0, height: '44px', padding: '11px 24px', background: '#1d1d1f', color: '#fff', font: '15px Inter, sans-serif', zIndex: 99999 }); document.body.append(d); }, caption);
  await p.screenshot({ path: join(rowsDir, `${id}.jpg`), type: 'jpeg', quality: 80 });
  out.push({ id, row, file, caption });
}
const word = (p, n) => p.locator('.w[data-s]').nth(n).click();

const ROWS = [
  [17, 'Drag a bubble by its title: it lifts and follows the pointer, a little larger, with a deeper shadow', async p => { const t = await box(p, '.win.t-folder'); await dragTo(p, '.win.t-folder .wt', [t.x + 520, t.y + 140], { release: false }); }],
  [18, 'Magnetic: near another bubble\'s edge a soft outline shows where it will sit beside; let go and it pulls in', async p => { const b = await box(p, '.win.t-page'); await dragTo(p, '.win.t-folder .wt', [b.x + b.width + 160, b.y + 30], { release: false }); }],
  [19, 'Dropped onto another bubble (not its edge) the outline wraps it: let go and the two stack', async p => { const b = await box(p, '.win.t-page'); await dragTo(p, '.win.t-folder .wt', [b.x + b.width / 2, b.y + b.height / 2], { release: false }); }],
  [20, 'Always tiled: bubbles never overlap; every drop reflows the desk into columns', async p => { await opt(p, 'arrange', 'tiled'); await word(p, 6); }],
  [21, 'Free canvas: bubbles float and may overlap; only a drop on a title stacks, only the top edge snaps', async p => { await opt(p, 'arrange', 'free'); const b = await box(p, '.win.t-bible'); await dragTo(p, '.win.t-folder .wt', [b.x + 300, b.y + 260]); }],
  [22, 'Dragged to the top edge: the layouts appear (halves, two-thirds, thirds, quarters); the cell under the pointer lights', async p => { const b = await box(p, '.win.t-page .wt'); await p.mouse.move(b.x + 120, b.y + 16); await p.mouse.down(); await p.mouse.move(b.x + 140, 60, { steps: 10 }); await p.waitForTimeout(300); const c = await box(p, '#zones .zone:nth-child(3) i'); await p.mouse.move(c.x + 10, c.y + 10, { steps: 4 }); await p.waitForTimeout(200); }],
  [23, 'Dropped on a layout cell: the bubble takes it, the desk\'s other bubbles fill the other cells, any extra stack on the last', async p => { const b = await box(p, '.win.t-page .wt'); await p.mouse.move(b.x + 120, b.y + 16); await p.mouse.down(); await p.mouse.move(b.x + 140, 60, { steps: 10 }); await p.waitForTimeout(300); const c = await box(p, '#zones .zone:nth-child(3) i'); await p.mouse.move(c.x + 10, c.y + 10, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(500); }],
  [24, 'Dragged onto a desk\'s name: the name is outlined; let go and the bubble moves to that desk', async p => { const d = await box(p, '.desk[data-desk="d2"]'); await dragTo(p, '.win.t-folder .wt', [d.x + 40, d.y + 12], { release: false }); }],
  [25, 'A stack rests as fanned cards: the edges of the ones behind show up and to the right; its title says how many', async p => { const b = await box(p, '.win.t-page'); await dragTo(p, '.win.t-folder .wt', [b.x + b.width / 2, b.y + b.height / 2]); await word(p, 6); const b2 = await box(p, '.win.t-page'); await dragTo(p, '.win.t-word .wt', [b2.x + b2.width / 2, b2.y + 200]); }],
  [26, 'Click a card behind: it comes to the front of its stack', async p => { const b = await box(p, '.win.t-page'); await dragTo(p, '.win.t-folder .wt', [b.x + b.width / 2, b.y + b.height / 2]); await p.locator('.win.behind').first().click({ position: { x: 60, y: 6 } }); await p.waitForTimeout(400); }],
  [27, '⤫ takes a bubble out of its stack; it finds room beside', async p => { const b = await box(p, '.win.t-page'); await dragTo(p, '.win.t-folder .wt', [b.x + b.width / 2, b.y + b.height / 2]); await p.locator('.win:not(.behind) .wt button[title="Take out of the stack"]').first().click(); await p.waitForTimeout(400); }],
  [28, 'Phone: a stack is one card with dots under it; swipe sideways through the desk\'s cards', async p => { const b = await box(p, '.win.t-page'); await dragTo(p, '.win.t-folder .wt', [b.x + b.width / 2, b.y + b.height / 2]); await opt(p, 'device', 'phone'); await p.locator('#desk').evaluate(d => d.scrollLeft = 380); await p.waitForTimeout(300); }],
  [29, 'Each its own bubble: three passages open as three bubbles, tinted alike; a word opened from each sits beside it', async p => { await p.locator('.win.t-folder [data-open="bible|Genesis 1"]').click(); await p.waitForTimeout(300); await p.locator('.win.t-folder [data-open="bible|Romans 5"]').click(); await p.waitForTimeout(400); }],
  [30, 'One app, many inside: a second and third passage open as columns inside the Bible bubble already there', async p => { await opt(p, 'many', 'inside'); await p.evaluate(() => { window.__demo.openApp('bible', 'Genesis 1'); window.__demo.openApp('bible', 'Romans 5'); }); await p.waitForTimeout(500); }],
  [31, 'Both: each opens as a bubble; ⇲ on one gathers the app\'s bubbles into it as columns', async p => { await opt(p, 'many', 'both'); await p.locator('.win.t-folder [data-open="bible|Genesis 1"]').click(); await p.waitForTimeout(300); await p.locator('.win.t-bible .wt button[title^="Gather"]').first().click(); await p.waitForTimeout(400); }],
  [32, '⇱ pop out: a column leaves the bubble and becomes its own, beside it', async p => { await opt(p, 'many', 'inside'); await p.locator('.win.t-folder [data-open="bible|Genesis 1"]').click(); await p.waitForTimeout(300); await p.locator('.col h5 button').first().click(); await p.waitForTimeout(400); }],
  [33, 'Following a word, linked: it opens beside the passage with a thread showing what led where', async p => { await word(p, 6); }],
  [34, 'Replace in place: the same bubble becomes the word; ← goes back to the passage (Alt+click does this in any mode)', async p => { await opt(p, 'rabbit', 'replace'); await word(p, 6); }],
  [35, 'Ask each time: a small choice where the word goes: here, beside, or on a new desk', async p => { await opt(p, 'rabbit', 'ask'); const w = p.locator('.w[data-s]').nth(6); const b = await w.boundingBox(); await w.click(); await p.waitForTimeout(300); }],
  [36, 'A rabbit hole: passage → word → another verse that uses it, opened lit at that verse; the threads trace the path', async p => { await word(p, 6); await p.locator('.win.t-word [data-go]').nth(3).click(); await p.waitForTimeout(500); }],
  [37, 'History of this desk, as a scrubber: every step on a line from earlier to now, with what it was and when', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.waitForTimeout(300); }],
  [38, 'Dragging the scrubber back replays the desk live, tinted slightly to show it is the past', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 1; r.dispatchEvent(new Event('input')); }); await p.waitForTimeout(400); }],
  [39, 'Let go and act in the past: a new branch begins; the later steps are kept, not lost', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 0; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }); await p.locator('#hist button', { hasText: 'Done' }).click(); await p.locator('.win.t-folder [data-open="bible|Romans 5"]').click(); await p.waitForTimeout(400); }],
  [40, 'The map: each step a dot; a second lane is the branch where you went back and took another way; click a dot to go there', async p => { await word(p, 6); await word(p, 20); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 0; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }); await p.locator('#hist button', { hasText: 'Done' }).click(); await p.locator('.win.t-folder [data-open="bible|Romans 5"]').click(); await p.waitForTimeout(300); await p.click('#histbtn'); await p.locator('#hist button', { hasText: 'Map' }).click(); await p.waitForTimeout(300); }],
  [41, '◷ on a bubble: the history of that bubble only (the passages and words it showed)', async p => { await opt(p, 'rabbit', 'replace'); await word(p, 6); await p.locator('.win.t-word .wt button[title="Back (this bubble)"]').click(); await p.waitForTimeout(200); await p.locator('.win.t-bible .wt button[title^="This bubble"]').click(); await p.waitForTimeout(300); }],
  [42, 'The whole app: every desk\'s steps on one line, switching desks included', async p => { await p.locator('.desk[data-desk="d2"]').click(); await word(p, 4); await p.locator('.desk[data-desk="d1"]').click(); await p.click('#histbtn'); await p.locator('#hist button', { hasText: 'The whole app' }).click(); await p.waitForTimeout(300); }],
  [43, 'Your writing goes back with the desk: scrubbing before an edit shows the page as it was then', async p => { const ed = p.locator('.win.t-page [contenteditable]'); await ed.click(); await p.keyboard.press('End'); await p.keyboard.type(' Bring a Strong\'s list.'); await p.waitForTimeout(900); await p.click('#histbtn'); await p.locator('#hist input[type=range]').evaluate(r => { r.value = 0; r.dispatchEvent(new Event('input')); }); await p.waitForTimeout(400); }],
  [44, 'Ctrl+Z outside a page steps the desk back one step (inside a page it undoes typing)', async p => { await word(p, 6); await p.mouse.click(1500, 900); await p.keyboard.press('Control+z'); await p.waitForTimeout(400); }],
  [45, 'Phone: each bubble is a full card; desks along the top; swipe between cards', async p => { await opt(p, 'device', 'phone'); }],
  [46, 'Phone: the dock is always shown at the bottom; a word opens as the next card', async p => { await opt(p, 'device', 'phone'); await word(p, 6); await p.waitForTimeout(300); await p.locator('#desk').evaluate(d => d.scrollLeft = 380); await p.waitForTimeout(300); }],
  [47, '+ New desk: an empty desk named for now, renamed by double-click; open apps from the dock onto it', async p => { await p.locator('.desk', { hasText: '+ New desk' }).click(); await p.waitForTimeout(200); await p.mouse.move(800, 999); await p.waitForTimeout(400); }],
  [48, 'Click a desk: the whole screen becomes that desk, its bubbles where they were', async p => { await p.locator('.desk[data-desk="d2"]').click(); await p.waitForTimeout(400); }],
  [49, 'The Workbench (home) from the dock: where you left off, today\'s reading, an open question, every desk', async p => { await p.evaluate(() => window.__demo.toggleHome()); await p.waitForTimeout(300); }],
  [50, 'The dock rises when the pointer reaches the bottom edge; a dot under each app open on this desk', async p => { await p.mouse.move(800, 997); await p.waitForTimeout(500); await p.mouse.move(800, 940); await p.waitForTimeout(200); }],
];
for (const [row, caption, fn] of ROWS) {
  const p = await fresh(); try { await fn(p); } catch (e) { console.error('row', row, e.message); }
  await shot(p, row, String(row), `${row} · ${caption}`); await p.close();
}
const idx = JSON.parse(readFileSync(join(rowsDir, 'index.json'), 'utf8')).filter(f => f.row < 17);
writeFileSync(join(rowsDir, 'index.json'), JSON.stringify([...idx, ...out], null, 2) + '\n');
await browser.close();
console.log(out.length, 'frames');
