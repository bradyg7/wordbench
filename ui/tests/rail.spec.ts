import { expect, test, type Page } from '@playwright/test';

// design/features/command round 2 (accepted 2026-11-13) with minimize's rail and trail: no toolbar; the rail on the left;
// the box keeps the line of the tab in front; the trail line under the top bar; the box pops off; narrow folds.
const ready = async (page: Page) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
};
const openPane = (page: Page, key: string, side = 'right') => page.evaluate(([key, side]) => {
  (window as any).__wb.dock().open('test', key, key, side, (el: HTMLElement) => { el.textContent = key; });
}, [key, side]);

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'webkit-phone', 'desktop: the phone keeps its own bar'); });

test('the rail sits left of everything, and Show names opens it out and is remembered', async ({ page }) => {
  await ready(page);
  const rail = page.locator('#rail');
  await expect(rail).toBeVisible();
  for (const name of ['Notebook', 'Shelf', 'Legend', 'Trail', 'Reading plans', 'Findings', 'Documents', 'Concordance', 'Help', 'Settings']) {
    await expect(rail.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const w = (await rail.boundingBox())!.width;
  expect(Math.round((await page.locator('#bar').boundingBox())!.x)).toBe(Math.round(w));
  expect(Math.round((await page.locator('#scroller').boundingBox())!.x)).toBe(Math.round(w));
  await rail.getByRole('button', { name: 'Show names' }).click();
  await expect(rail.locator('.rail-name', { hasText: 'Notebook' })).toBeVisible();
  const wide = (await rail.boundingBox())!.width;
  expect(wide).toBeGreaterThan(w + 100);
  expect(Math.round((await page.locator('#scroller').boundingBox())!.x)).toBe(Math.round(wide));
  await page.reload();
  await page.waitForFunction(() => (window as any).__wbReady);
  expect((await rail.boundingBox())!.width).toBe(wide);
  await rail.getByRole('button', { name: 'Hide names' }).click();
  expect((await rail.boundingBox())!.width).toBe(w);
});

test('every tab joins the trail; the box shows the line of the tab in front', async ({ page }) => {
  await ready(page);
  const line = page.locator('#trailline');
  await expect(line.locator('.trail-step.on')).toHaveText('Numbers 25');
  await openPane(page, 'H7068');
  await openPane(page, 'Every use: zeal');
  await expect(line.locator('.trail-step')).toHaveText(['Numbers 25', 'H7068', 'Every use: zeal']);
  await expect(page.locator('#cmd')).toHaveValue('Every use: zeal');
  // a pane in front hides the reader's tools; a press in the reader brings them back and the box shows the place
  await expect(page.locator('#hl-menu')).toBeHidden();
  await page.locator('#reader .vn[data-v="3"]').click();
  await expect(page.locator('#cmd')).toHaveValue('Numbers 25');
  await expect(page.locator('#hl-menu')).toBeVisible();
  // a step clicked in the drawer brings its tab to the front
  await page.locator('#rail').getByRole('button', { name: 'Trail', exact: true }).click();
  const drawer = page.locator('.trail-drawer');
  await expect(drawer.locator('.trail-step')).toHaveText(['Numbers 25', 'H7068', 'Every use: zeal']);
  await drawer.locator('.trail-step', { hasText: 'H7068' }).click();
  await expect(page.locator('#cmd')).toHaveValue('H7068');
  await expect(line.locator('.trail-step.on')).toHaveText('H7068');
  // focusing the box gives the line back to change; Esc leaves it as it was
  await page.locator('#cmd').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmd')).toHaveValue('H7068');
});

test('years of study: forty steps fold into "… N" and the line never overflows', async ({ page }) => {
  await ready(page);
  for (let i = 1; i <= 40; i++) await openPane(page, `Step ${i} with a long title for the trail line`);
  const line = page.locator('#trailline');
  await expect(line.locator('.trail-fold')).toHaveText(/… \d+/);
  await expect(line.locator('.trail-step')).toHaveCount(4);   // where it began and the last three
  await expect(line.locator('.trail-count')).toHaveText('41 steps');
  const over = await line.evaluate(el => el.scrollWidth - el.clientWidth);
  expect(over).toBeLessThanOrEqual(2);
  await line.locator('.trail-fold').click();
  await expect(page.locator('.trail-drawer .trail-step')).toHaveCount(41);
});

test('the box pops off the bar by its search icon, and a double-click puts it back', async ({ page }) => {
  await ready(page);
  const box = page.locator('#cmdbox');
  await expect(box.locator('.cmd-grip')).toHaveCount(0);
  const grip = box.locator('.cmd-handle');
  const g = (await grip.boundingBox())!;
  await page.mouse.move(g.x + 3, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(500, 600, { steps: 6 });
  await page.mouse.up();
  await expect(box).toHaveClass(/popped/);
  expect((await box.boundingBox())!.y).toBeGreaterThan(400);
  await page.reload();
  await page.waitForFunction(() => (window as any).__wbReady);
  await expect(box).toHaveClass(/popped/);
  await grip.dblclick();
  await expect(box).not.toHaveClass(/popped/);
  expect((await box.boundingBox())!.y).toBeLessThan(56);
});

test('half a screen: the place button hides, the reader\'s tools fold into More', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await ready(page);
  await expect(page.locator('#place')).toBeHidden();
  await expect(page.locator('#hl-menu')).toBeHidden();
  await expect(page.locator('#cmd')).toHaveValue('Numbers 25');
  await page.locator('#more').click();
  await expect(page.locator('.more-menu').getByRole('button', { name: /^Highlights/ })).toBeVisible();
  await expect(page.locator('.more-menu').getByRole('button', { name: /^Full screen/ })).toBeVisible();
});

test('a rail icon opens its pane on the left, beside the rail, and a second click closes it', async ({ page }) => {
  await ready(page);
  const plans = page.locator('#rail [data-rail="plans"]');
  await plans.click();
  await expect(page.locator('.dock-left.open .pane-plans')).toHaveCount(1);
  await expect(plans).toHaveClass(/\bon\b/);
  await plans.click();
  await expect(page.locator('.pane-plans')).toHaveCount(0);
  await expect(plans).not.toHaveClass(/\bon\b/);
  await plans.click();
  await expect(page.locator('.dock-left.open .pane-plans')).toHaveCount(1);
});

test('minimize round 7: a minimized tab is a link in the rail, opened again with its place', async ({ page }) => {
  await ready(page);
  // test panes stand for lookups: they open again from their key, as a layout opens them
  await page.evaluate(() => {
    const d = (window as any).__wb.dock();
    d.canReopen = () => true;
    d.reopen = async (k: string) => d.open('test', k, k, 'right', (el: HTMLElement) => { el.textContent = k; });
  });
  await openPane(page, 'H7068');
  const rail = page.locator('#rail');
  const min = rail.locator('[data-rail="minimized"]');
  await expect(min).toBeHidden();
  await page.locator('.dock-group', { hasText: 'H7068' }).locator('.strip-btn[aria-label="Minimize"]').click();
  // the pane is closed, not hidden; no chip over the reader; Minimized shows, marked as holding something
  await expect(page.locator('.pane-test')).toHaveCount(0);
  await expect(page.locator('.dock-chip')).toHaveCount(0);
  await expect(min).toBeVisible();
  await expect(min).toHaveClass(/has/);
  expect(await page.evaluate(() => (window as any).__wb.dock().links.map((l: any) => l.key))).toEqual(['H7068']);
  await min.click();
  const row = page.locator('.rail-menu .rail-link', { hasText: 'H7068' });
  await expect(row).toHaveCount(1);
  await row.locator('.rail-link-go').click();
  await expect(page.locator('.pane-test', { hasText: 'H7068' })).toHaveCount(1);
  await expect(min).toBeHidden();
  expect(await page.evaluate(() => (window as any).__wb.dock().links.length)).toBe(0);
});

test('minimize round 7: past eight, the menu shows the newest eight and a find field', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const d = (window as any).__wb.dock();
    d.canReopen = () => true;
    for (let i = 1; i <= 10; i++) d.open('test', `T${i}`, `T${i}`, 'right', (el: HTMLElement) => { el.textContent = `T${i}`; });
    await d.toLinks(d.panes.filter((p: any) => p.kind === 'test'));
  });
  await page.locator('#rail [data-rail="minimized"]').click();
  await expect(page.locator('.rail-menu .rail-link')).toHaveCount(8);
  await page.locator('.rail-menu-find').fill('T10');
  await expect(page.locator('.rail-menu .rail-link')).toHaveCount(1);
  await expect(page.locator('.rail-menu-foot')).toContainText('Show all 10');
});

test('full screen is an icon; leaving puts the panes back', async ({ page }) => {
  await ready(page);
  await openPane(page, 'One');
  // another kind, so it opens in its own group on the left
  await page.evaluate(() => (window as any).__wb.dock().open('test2', 'Two', 'Two', 'left', (el: HTMLElement) => { el.textContent = 'Two'; }));
  await page.locator('.dock-group', { has: page.locator('.pane-test', { hasText: 'One' }) }).locator('.strip-btn[aria-label="Full screen"]').click();
  await expect(page.locator('.dock-focus .pane-test')).toHaveText('One');
  await expect(page.locator('#rail')).toBeVisible();
  await page.locator('.dock-focus-return').click();
  await expect(page.locator('.dock-group .pane-test2', { hasText: 'Two' })).toHaveCount(1);
  await expect(page.locator('.dock-group .pane-test', { hasText: 'One' })).toHaveCount(1);
});

test('a minimized Concordance tab waits under the Concordance button, and opens again', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as any).__wb.concordance({ strong: 'H7068' }));
  await page.evaluate(async () => { const d = (window as any).__wb.dock(); await d.toLinks(d.panes.filter((p: any) => p.kind === 'concordance')); });
  const rail = page.locator('#rail');
  await expect(rail.locator('[data-rail="concordance"]')).toHaveClass(/has/);
  await expect(rail.locator('[data-rail="minimized"]')).toBeHidden();
  await rail.locator('[data-rail="concordance"]').click();
  await page.locator('.rail-link-go', { hasText: 'H7068' }).click();
  expect(await page.evaluate(() => (window as any).__wb.dock().panes.some((p: any) => p.key === 'concordance|entry|H7068'))).toBe(true);
});
