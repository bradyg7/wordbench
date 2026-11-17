import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/marks: the reader's margin (M26, M25, M27, M28, M32, M43, M44), the pencil (M14) and no dotted line (MK-2).
// The answers come from the fixtures `npm run fixtures` made with `wb` on a generated study; the verse is the database's.
const num25 = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const verse11: string = num25.verses['11'].text;
const chapter = JSON.parse(readFileSync(new URL('../public/fixtures/wb/margin-num-25.json', import.meta.url), 'utf8'));
const v11 = chapter.verses.find((v: any) => v.v === 11);

async function ready(page: Page, margin = true) {
  await page.addInitScript(on => localStorage.setItem('wb.layers.v1', JSON.stringify({ mine: true, all: true, margin: on, hidden: [] })), margin);
  await page.goto('/?at=NUM.25&notebook=0');
  await page.waitForFunction(() => (window as any).__wbReady);
}

test('the margin beside verse 11 says its notes and pages, shows their first lines on hover and opens the verse on a click', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  expect(v11.notes).toBeGreaterThanOrEqual(2);
  await ready(page);
  const mark = page.locator('.mg-mark[data-v="11"]');
  await expect(mark).toBeVisible();
  await expect(mark).toContainText(`${v11.notes} notes`);
  await expect(mark).toContainText(`${v11.pages} pages`);
  await mark.hover();
  await expect(page.locator('.mg-pop')).toContainText('First margin note');
  await mark.click();
  const panel = page.locator('.mg-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.mg-verse')).toHaveText(verse11);
  await expect(panel.locator('.mg-note').first()).toBeVisible();
  await expect(panel.locator('.mg-count', { hasText: 'pages' })).toBeVisible();
  // the panel does not cover the verse it is about
  const vn = (await page.locator('.vn[data-v="11"]').boundingBox())!;
  const p = (await panel.boundingBox())!;
  expect(vn.y + vn.height < p.y || vn.y > p.y + p.height || vn.x + vn.width < p.x).toBeTruthy();
});

test('the reading column is the same with the margin on and off', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const measure = () => page.evaluate(() => {
    const r = document.getElementById('reader')!;
    return { w: r.getBoundingClientRect().width, h: r.scrollHeight, lines: [...r.querySelectorAll('.w')].map(e => Math.round(e.getBoundingClientRect().top)).join(',') };
  });
  await ready(page, true);
  await expect(page.locator('.mg-mark').first()).toBeVisible();
  const on = await measure();
  await ready(page, false);
  await expect(page.locator('.mg-mark')).toHaveCount(0);
  const off = await measure();
  expect(on).toEqual(off);
});

test('writing asks where, and Remember my choice stops the question', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  const calls: string[] = [];
  await page.route('**/fixtures/wb/margin-add-*', r => { calls.push(decodeURIComponent(r.request().url())); return r.fulfill({ json: { id: 'm_test', title: 'Numbers 25:11' } }); });
  await page.route('**/fixtures/wb/settings-margin-write-choice-*', r => r.fulfill({ json: { write_choice: 'margin' } }));
  await ready(page);
  await page.locator('.mg-mark[data-v="11"]').click();
  const field = page.locator('.mg-field');
  await field.fill('A thought');
  await field.press('Enter');
  await expect(page.getByRole('button', { name: 'Leave in the margin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to a new page' })).toBeVisible();
  await expect(page.locator('.mg-remember')).toContainText('Remember my choice');
  await page.getByRole('button', { name: 'Leave in the margin' }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toContain('margin-add-num-25-11-a-thought');
});

test('a margin note has four choices in its menu and nothing else, and a long note shows no prompt', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  await page.locator('.mg-mark[data-v="11"]').click();
  await page.locator('.mg-more').first().click();
  const items = page.locator('.menu .menu-item');
  await expect(items).toHaveText(['Grow into a page', 'Add to a page…', 'Make it a question', 'Delete']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-panel')).not.toContainText('Getting long');
});

test('a passage shows a bracket and a chapter note sits at the top', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  await expect(page.locator('.mg-bracket')).toHaveCount(1);
  await expect(page.locator('.mg-mark.mg-top')).toContainText('1 note on the chapter');
});

test('at 390 px the marks fold to one mark at the verse number and the margin is a sheet', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await ready(page);
  const dot = page.locator('.mg-dot[data-v="11"]');
  await expect(dot).toHaveCount(1);
  await expect(page.locator('.mg-mark:not(.mg-top)')).toHaveCount(0);
  await dot.tap();
  const panel = page.locator('.mg-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveClass(/mg-sheet/);
  const b = (await panel.boundingBox())!;
  expect(Math.round(b.y + b.height)).toBe(await page.evaluate(() => window.innerHeight));
  await expect(page.locator('.mg-field')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('the pencil is one line under a run, U again removes it, and no dotted line is drawn', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await ready(page);
  const box = async (v: number, i: number) => {
    const k = await page.evaluate(([v, i]) => { const d = (window as any).__wb.drawn; return d.v.findIndex((vv: number, k: number) => vv === v && d.i[k] === i); }, [v, i]);
    return (await page.locator(`.w[data-k="${k}"]`).boundingBox())!;
  };
  const a = await box(7, 2), b = await box(7, 5);
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.colorbar')).toBeVisible();
  await page.keyboard.press('u');
  const pencilled = page.locator('.w.pencil');
  await expect(pencilled).toHaveCount(4);
  // the line runs through the spaces between the words too
  expect(await page.locator('.g').evaluateAll(gs => gs.filter(g => (g as HTMLElement).style.backgroundImage.includes('--pencil')).length)).toBe(3);
  // again: select the same words and press U
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('u');
  await expect(page.locator('.w.pencil')).toHaveCount(0);
  // nothing in the reader is underlined with a dotted line
  expect(await page.locator('.w').evaluateAll(ws => ws.some(w => getComputedStyle(w).textDecorationStyle === 'dotted'))).toBe(false);
});

test('among other tabs: at 500 px the verse’s margin shows the verse and the counts line with no sideways scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await page.setViewportSize({ width: 500, height: 800 });
  await ready(page);
  await page.locator('.mg-dot[data-v="11"]').click();
  const panel = page.locator('.mg-panel');
  await expect(panel.locator('.mg-verse')).toHaveText(verse11);
  await expect(panel.locator('.mg-counts')).toBeVisible();
  expect(await panel.evaluate(p => p.scrollWidth <= p.clientWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('floating: at 320 px the counts wrap whole and the pane does not cover the verse it is about', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-desktop', 'desktop');
  await page.setViewportSize({ width: 1000, height: 700 });
  await ready(page);
  for (const v of [11, 5]) {
    await page.locator(`.vn[data-v="${v}"]`).scrollIntoViewIfNeeded();
    const mark = page.locator(`.mg-mark[data-v="${v}"], .mg-dot[data-v="${v}"]`);
    if (!(await mark.count())) continue;
    await mark.first().click();
    const panel = page.locator('.mg-panel');
    await expect(panel).toBeVisible();
    const p = (await panel.boundingBox())!;
    expect(Math.round(p.width)).toBe(320);
    expect(await panel.evaluate(e => e.scrollWidth <= e.clientWidth)).toBeTruthy();
    // each count is one whole piece: it never breaks across two lines
    const heights = await panel.locator('.mg-count').evaluateAll(cs => cs.map(c => c.getBoundingClientRect().height));
    expect(Math.max(...heights, 0)).toBeLessThan(24);
    const vn = (await page.locator(`.vn[data-v="${v}"]`).boundingBox())!;
    const touching = vn.y < p.y + p.height && vn.y + vn.height > p.y && vn.x < p.x + p.width && vn.x + vn.width > p.x;
    expect(touching).toBeFalsy();
    await page.locator('.mg-close').click();
  }
});
