import { test, expect } from '@playwright/test';

// design/features/settings (accepted 2026-11-13): the tabs as remodelled, Hover joined to Reading, the keys listed,
// and a narrow pane that reflows (a menu for the sections) instead of squeezing its text.
test('Settings has the remodelled tabs, and reflows when narrow', async ({ page }, info) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.locator('#more').click();
  await page.locator('.more-menu').getByRole('button', { name: /^Settings/ }).click();
  const pane = page.locator('.set-pane');
  await expect(pane).toBeVisible();
  // its own menu in the centre, over the app (not a pane in the dock)
  await expect(page.locator('.set-backdrop')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Settings and Help' })).toBeVisible();
  if (info.project.name !== 'webkit-phone') expect((await pane.evaluate(el => el.clientWidth)) >= 720).toBe(true);

  // Keys is Help's now (design/features/help); with no keyboard pressed yet a phone has no Keys
  const names = ['Reading', 'Theme', 'Notebook', 'Layouts', 'Commands', 'Study folder', 'Documents', 'Guide', ...(info.project.name === 'webkit-phone' ? [] : ['Keys']), 'Manual'];
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
  await go('Manual');
  // only the settings on the right scroll; the section list on the left stays where it is
  const body = pane.locator('.set-body');
  await expect(pane.locator('details.doc').first()).toBeVisible();
  expect(await body.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
  if (await body.evaluate(el => el.scrollHeight > el.clientHeight)) {
    const navTop = narrow ? 0 : await pane.locator('.set-nav').evaluate(el => el.getBoundingClientRect().top);
    await body.evaluate(el => { el.scrollTop = 400; });
    expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await pane.evaluate(el => el.scrollTop)).toBe(0);
    if (!narrow) expect(await pane.locator('.set-nav').evaluate(el => el.getBoundingClientRect().top)).toBe(navTop);
  }

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

  // no setting's words are squeezed by its control (a long voice or Look name goes under them instead)
  for (const name of ['Reading', 'Documents']) {
    await go(name);
    await page.waitForTimeout(200);
    const squeezed = await pane.locator('.set-row').evaluateAll(rows => rows.map(r => {
      const t = r.querySelector('.set-text') as HTMLElement | null;
      return t ? { name: t.textContent?.slice(0, 30), w: t.clientWidth, row: (r as HTMLElement).clientWidth } : null;
    }).filter(x => x && x.w < Math.min(200, x.row - 1)));
    expect(squeezed, name).toEqual([]);
  }

  // typing in the search filters at once, keeps the box (and its focus), and never rebuilds the menu
  const box = narrow ? pane.getByRole('searchbox', { name: 'Search settings (narrow)' }) : pane.getByRole('searchbox', { name: 'Search settings', exact: true });
  await box.click();
  const started = Date.now();
  await box.pressSequentially('voice', { delay: 30 });
  await expect(pane.locator('.set-row', { hasText: 'Read aloud: voice' })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3000);
  await expect(box).toBeFocused();
  await expect(box).toHaveValue('voice');
  await expect(pane.locator('.set-row', { hasText: 'Text size' })).toHaveCount(0);
  await box.fill('');

  // Esc closes it and the app is usable again
  await page.keyboard.press('Escape');
  await expect(page.locator('.set-backdrop')).toHaveCount(0);
});