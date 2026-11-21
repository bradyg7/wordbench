import { expect, test, type Page } from '@playwright/test';

// design/features/notebook rows 1 and 2 (N1, accepted 2026-11-20): the one menu component.
const GROUPS = [
  { title: 'Basic', items: [
    { id: 'text', label: 'Text', icon: 'T' },
    { id: 'h1', label: 'Heading 1', icon: 'T', hint: '#' },
    { id: 'h2', label: 'Heading 2', icon: 'T', hint: '##' },
    { id: 'h3', label: 'Heading 3', icon: 'T', hint: '###' },
    { id: 'bullet', label: 'Bullet list', icon: '•', hint: '-' },
  ] },
  { title: 'Study', items: [{ id: 'scripture', label: 'Scripture', icon: 'S' }, { id: 'word', label: 'Word', icon: 'W' }] },
];

const ready = async (page: Page) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  // A plain editable line standing in for the page's caret.
  await page.evaluate(() => {
    const line = document.createElement('div');
    line.id = 'menu-test-line';
    line.contentEditable = 'true';
    line.textContent = '/';
    line.style.cssText = 'position:fixed;left:200px;top:120px;width:300px;z-index:49;background:#fff;color:#000';
    document.body.append(line);
    (window as any).__picked = [];
    (window as any).__open = () => (window as any).__wb.menu({
      groups: (window as any).__groups, at: { x: 200, y: 160 },
      onPick: (i: { id: string }) => (window as any).__picked.push(i.id),
    });
    line.focus();
  });
};
const open = async (page: Page) => {
  await page.evaluate((g) => { (window as any).__groups = g; (window as any).__open(); }, GROUPS);
  await expect(page.locator('.wbm')).toBeVisible();
};

test('menu_filters_as_you_type', async ({ page }) => {
  await ready(page);
  await open(page);
  const rows = page.locator('.wbm .wbm-row');
  await expect(rows).toHaveCount(7);
  await expect(page.locator('.wbm-group')).toHaveText(['Basic', 'Study']);
  await expect(page.locator('.wbm-row.on')).toHaveText(/Text/);
  await page.keyboard.type('hea');
  await expect(rows).toHaveText([/Heading 1/, /Heading 2/, /Heading 3/]);
  await expect(page.locator('.wbm-row.on')).toHaveText(/Heading 1/);   // the first match is highlighted
  await expect(page.locator('.wbm-group')).toHaveText(['Basic']);      // Study has no match, so it hides
  await page.keyboard.type('zzq');
  await expect(page.locator('.wbm-none')).toHaveText('No results');
  await expect(rows).toHaveCount(0);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('scr');
  await expect(rows).toHaveText([/Scripture/]);                         // found by name in any group
});

test('menu_keys_and_focus_return', async ({ page }) => {
  await ready(page);
  const before = async () => page.evaluate(() => { const r = document.getElementById('menu-test-line')!.getBoundingClientRect(); return [r.x, r.y, scrollX, scrollY]; });
  const start = await before();
  // ↓ ↓ then Enter picks the third row.
  await open(page);
  expect(await before()).toEqual(start);                                // opening moves nothing
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.wbm-row.on')).toHaveText(/Heading 2/);
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.wbm-row.on')).toHaveText(/Heading 1/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wbm')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__picked)).toEqual(['h2']);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('menu-test-line');
  // Esc closes, picks nothing, focus returns.
  await open(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__picked)).toEqual(['h2']);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('menu-test-line');
  // A click outside closes it and focus returns.
  await open(page);
  await page.mouse.click(5, 5);
  await expect(page.locator('.wbm')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('menu-test-line');
  // A click on a row picks it.
  await open(page);
  await page.locator('.wbm-row', { hasText: 'Heading 3' }).click();
  expect(await page.evaluate(() => (window as any).__picked)).toEqual(['h2', 'h3']);
  expect(await before()).toEqual(start);                                // and nothing moved
});
