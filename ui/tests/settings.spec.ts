import { test, expect } from '@playwright/test';

// design/features/settings (accepted 2026-11-13): the tabs as remodelled, Hover joined to Reading, the keys listed,
// and a narrow pane that reflows (a menu for the sections) instead of squeezing its text.
test('Settings has the remodelled tabs, and reflows when narrow', async ({ page }, info) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.locator('#more').click();
  await page.getByRole('button', { name: /^Settings/ }).click();
  const pane = page.locator('.set-pane');
  await expect(pane).toBeVisible();

  const names = ['Reading', 'Theme', 'Notebook', 'Layouts', 'Commands', 'Keys', 'Study folder', 'Documents'];
  const menu = pane.getByRole('combobox', { name: 'Settings section' });
  const narrow = (await pane.evaluate(el => el.clientWidth)) < 520;
  if (info.project.name === 'webkit-phone') expect(narrow).toBe(true);
  const go = async (name: string) => {
    if (narrow) await menu.selectOption(name);
    else await pane.locator('.set-nav').getByRole('button', { name }).click();
  };
  if (narrow) {
    // narrow (docked beside the reader, or a phone): the sections are a menu, the buttons hidden, rows stacked
    await expect(menu).toBeVisible();
    await expect(pane.locator('.set-nav')).toBeHidden();
    await expect(menu.locator('option')).toHaveText(names);
  } else {
    await expect(menu).toBeHidden();
    await expect(pane.locator('.set-nav button')).toHaveText(names);
  }
  await go('Keys');
  // Keys lists the keys themselves, F11 among them
  await expect(pane.locator('.set-row', { hasText: 'Full screen' })).toBeVisible();

  // Hover and cards now lives in Reading
  await go('Reading');
  await expect(pane.locator('.set-row', { hasText: 'Cards on hover' })).toBeVisible();
  await expect(pane.locator('.set-row', { hasText: 'Copying verses' })).toBeVisible();
  if (narrow) {
    // a stacked row: the control sits under its words, not squeezed beside them
    const r = pane.locator('.set-row', { hasText: 'Cards on hover' });
    expect(await r.evaluate(el => getComputedStyle(el).flexDirection)).toBe('column');
  }

  // Layouts: one grid, New layout first, opening the builder from the window as it is (L3)
  await go('Layouts');
  const grid = pane.locator('.lay-grid');
  await expect(grid.locator('.lay-card').first()).toHaveText(/New layout/);
  expect(await grid.evaluate(el => getComputedStyle(el).display)).toBe('grid');
  await grid.locator('.lay-new').click();
  await expect(pane.getByRole('combobox', { name: 'Add a pane' })).toBeVisible();
  await expect(pane.getByRole('textbox', { name: 'Layout name' })).toBeVisible();
  await pane.getByRole('button', { name: 'Cancel' }).click();

  // Theme: italic words, kept per theme, drawn through the root
  await go('Theme');
  const italics = pane.locator('.set-row', { hasText: 'Italic words' });
  await italics.getByRole('button', { name: 'Grey', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-italic', 'grey');
  await expect(pane.locator('.theme-marks input')).toHaveCount(5);
});
