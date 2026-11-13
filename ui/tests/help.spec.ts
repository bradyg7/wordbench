import { test, expect } from '@playwright/test';

// Help is the second half of the Settings menu (design/features/help, 2026-11-13): Guide cards, Keys, Manual.

test('Help opens in the Settings menu: Guide cards, Keys, Manual, one search', async ({ page }, info) => {
  const phone = info.project.name === 'webkit-phone';
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.keyboard.press('F1');
  const menu = page.getByRole('dialog', { name: 'Settings and Help' });
  await expect(menu.locator('.set-heading')).toHaveText('Guide');
  await expect(menu.locator('.guide-group')).toHaveCount(4);
  await expect(menu.locator('.guide-card')).toHaveCount(15);
  // the steps come last: each card names what it will guide, and says so
  await expect(menu.locator('.guide-card', { hasText: 'Read a chapter' })).toContainText('Coming soon');
  await expect(menu.locator('.guide-steps')).toHaveCount(0);

  // Keys: the only keys section; a row lights its keys on the keyboard
  // narrow (a phone) the sections are a menu; F1 was pressed, so a keyboard is known and Keys is listed
  const go = (name: string) => phone ? menu.getByRole('combobox', { name: 'Settings section' }).selectOption(name) : menu.getByRole('button', { name }).click();
  await go('Keys');
  await expect(menu.locator('.kb')).toBeVisible();
  await menu.locator('.key-line', { hasText: 'Ctrl+F' }).first().click();
  await expect(menu.locator('.kb-key.lit')).toHaveText(['F', 'Ctrl']);

  // Manual: what the command field understands
  await go('Manual');
  await expect(menu.locator('details.doc summary code', { hasText: /^uses$/ })).toBeVisible();

  // one search across settings and help
  await menu.getByRole('searchbox', { name: phone ? 'Search settings (narrow)' : 'Search settings' }).fill('interlinear');
  await expect(menu.locator('.guide-card', { hasText: 'The interlinear' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('typed Help opens a command in Manual and a topic at its card', async ({ page }) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  const run = (line: string) => page.evaluate(command => (window as any).__wb.run(command), line);
  const menu = page.getByRole('dialog', { name: 'Settings and Help' });

  expect(await run('help threads')).toMatchObject({ ok: true });
  await expect(menu.locator('.set-heading')).toHaveText('Manual');
  await expect(menu.locator('details.doc[open] summary code')).toHaveText('threads');

  expect(await run('help The Shelf')).toMatchObject({ ok: true });
  await expect(menu.locator('.set-heading')).toHaveText('Guide');
  await expect(menu.locator('.guide-card.focus')).toContainText('The Shelf');
});

test('the ? in a pane head opens Help at that pane’s cards', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'a phone shows panes as sheets, without a tab strip');
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await page.getByRole('button', { name: 'Help with this' }).first().click();
  const menu = page.getByRole('dialog', { name: 'Settings and Help' });
  await expect(menu.locator('.guide-card.focus').first()).toBeVisible();
});
