import { test, expect } from '@playwright/test';

test('Help browses tasks, explains Layouts, and searches each tab', async ({ page }) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.locator('#more').click();
  await page.getByRole('button', { name: 'Help Guide · Commands · Keys' }).click();

  const help = page.locator('.pane-help');
  const filter = help.getByRole('textbox', { name: 'Search Help' });
  const index = help.getByRole('navigation', { name: 'Browse Help by task' });
  await index.getByRole('button', { name: 'Show a live list of Notebook pages' }).click();
  await expect(help.locator('.guide-entry')).toHaveCount(1);
  await expect(help.locator('.guide-entry')).toContainText('wb view run');
  await expect(help.locator('.guide-entry')).toContainText('A Layout saves an arrangement of panes');

  await filter.fill('LIVE LIST');
  await expect(help.locator('.guide-entry')).toHaveAttribute('data-name', 'views');
  await filter.fill('');
  await index.getByRole('button', { name: 'Save and restore pane layouts' }).click();
  await expect(help.getByRole('tab', { name: 'Commands' })).toHaveAttribute('aria-selected', 'true');
  await expect(help.locator('details[open]')).toContainText('wb layout list');
  await help.getByRole('button', { name: 'Browse Help tasks' }).click();
  await index.getByRole('button', { name: 'Find a command' }).click();
  await filter.fill('no matches for this');
  await expect(help.getByText('No command topics match your search.')).toBeVisible();

  await help.getByRole('tab', { name: 'Keys' }).click();
  await expect(help.getByText('No keyboard shortcuts match your search.')).toBeVisible();
  await filter.fill('CTRL+F');
  await expect(help.locator('.key-row')).toContainText('Ctrl+F');
  await help.getByRole('tab', { name: 'Guide' }).click();
  await expect(help.getByText('No Guide topics match your search.')).toBeVisible();
});

test('typed Help uses the resolved topic even when Help is already open', async ({ page }) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  const help = page.locator('.pane-help');
  const run = (line: string) => page.evaluate(command => (window as any).__wb.run(command), line);

  const field = page.getByRole('textbox', { name: 'Command field' });
  if (await field.isVisible()) {
    await field.fill('help view');
    await field.press('Enter');
  } else {
    expect(await run('help view')).toMatchObject({ ok: true });
  }
  await expect(help.locator('.guide-entry')).toHaveAttribute('data-name', 'views');

  expect(await run('help threads')).toMatchObject({ ok: true });
  await expect(help.getByRole('tab', { name: 'Commands' })).toHaveAttribute('aria-selected', 'true');
  await expect(help.locator('details[open] summary code')).toHaveText('threads');

  expect(await run('help The Shelf')).toMatchObject({ ok: true });
  await expect(help.getByRole('tab', { name: 'Guide' })).toHaveAttribute('aria-selected', 'true');
  await expect(help.locator('.guide-entry')).toHaveAttribute('data-name', 'shelf');

  expect(await run('help vie')).toMatchObject({ ok: true });
  await expect(help.locator('.guide-entry')).toHaveAttribute('data-name', 'views');
  expect(await run('help t')).toMatchObject({ ok: false });
  await expect(help.locator('.guide-entry')).toHaveAttribute('data-name', 'views');

  expect(await run('help layout')).toMatchObject({ ok: true });
  await expect(help.locator('details[open] summary code')).toHaveText('layout');
  expect(await run('help')).toMatchObject({ ok: true });
  await expect(help.getByRole('navigation', { name: 'Browse Help by task' })).toBeVisible();
});
