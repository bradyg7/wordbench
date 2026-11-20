import { expect, test, type Page } from '@playwright/test';
import { notebookRoutes } from './notebook-fixtures';

async function openNotebook(page: Page, section = 'All') {
  const desktop = page.viewportSize()!.width > 600;
  if (desktop) {
    await page.setViewportSize({ width: 2000, height: 900 });
  }
  await notebookRoutes(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  if (desktop) {
    await page.getByRole('button', { name: 'Expand to half the window' }).click();
    await expect(page.locator('.pane-notebook .nb.two')).toBeVisible();
  }
  await page.getByRole('navigation', { name: 'Notebook sections' }).getByRole('button', { name: section, exact: true }).click();
  const scope = page.locator('.nb-scope');
  await expect(scope.getByRole('heading', { name: section, exact: true })).toBeVisible();
  await expect(scope.locator('.nb-item').first()).toBeVisible();
  return scope;
}

test('row 1: filters_open_in_tab_or_phone_sheet', async ({ page }, info) => {
  const scope = await openNotebook(page);
  const trigger = scope.getByRole('button', { name: 'Filters', exact: true });
  const phone = info.project.name === 'webkit-phone';
  if (phone) await trigger.tap();
  else await trigger.click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await expect(panel.getByLabel('Page kind')).toHaveValue('');
  await expect(panel.getByRole('button', { name: 'Apply' })).toBeInViewport();
  const tab = (await scope.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " nb ")]').boundingBox())!;
  const box = (await panel.boundingBox())!;
  expect(box.x + box.width).toBeCloseTo(tab.x + tab.width, 0);
  if (phone) {
    expect(box.y).toBeGreaterThan(tab.y);
    expect(box.width).toBeCloseTo(tab.width, 0);
    expect(box.y + box.height).toBeCloseTo(tab.y + tab.height, 0);
  } else {
    expect(box.y).toBeCloseTo(tab.y, 0);
    expect(box.width).toBeLessThan(tab.width / 2);
  }
});

test('row 2: filters_open_with_keyboard', async ({ page }) => {
  const scope = await openNotebook(page);
  const trigger = scope.getByRole('button', { name: 'Filters', exact: true });
  await page.getByRole('button', { name: 'All', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(trigger).toBeFocused();
  for (const key of ['Enter', 'Space']) {
    await page.keyboard.press(key);
    const panel = scope.getByRole('dialog', { name: 'Filters' });
    await expect(panel.getByLabel('Page kind')).toBeFocused();
    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(trigger).toBeFocused();
  }
});

test('rows 3, 12 and 22: filters_hold_choices_until_apply and notebook_words_search_within_the_current_section', async ({ page }) => {
  const scope = await openNotebook(page);
  const words = page.getByRole('textbox', { name: 'Search pages' });
  const titles = scope.locator('.nb-item-title');
  const requests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/fixtures/wb/notebook-view-')) requests.push(request.url());
  });
  await words.fill('prayer');
  await expect(titles).toHaveCount(3);
  await expect(scope.getByText('3 pages', { exact: true })).toBeVisible();
  const trigger = scope.getByRole('button', { name: /^Filters/ });
  await trigger.click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  const before = requests.length;
  await panel.getByLabel('Folder', { exact: true }).selectOption({ label: 'Acts study' });
  await panel.getByLabel('Pages with questions').focus();
  await page.keyboard.press('ArrowDown');
  await expect(panel.getByLabel('Pages with questions')).toHaveValue('open');
  await expect(trigger).toHaveText('Filters');
  await expect(titles).toHaveCount(3);
  expect(requests).toHaveLength(before);
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Filters · 2');
  await expect(titles).toHaveText(['Prayer in the upper room']);
  await expect(scope.getByText('Pages with questions · Open')).toBeVisible();
  await expect(scope.getByText('Folder · Acts study')).toBeVisible();
  await expect(words).toHaveValue('prayer');
  await expect(scope.getByRole('heading', { name: 'All' })).toBeVisible();
  await trigger.click();
  await expect(panel.getByLabel('Pages with questions')).toHaveValue('open');
  await expect(panel.getByLabel('Folder', { exact: true }).locator('option:checked')).toHaveText('Acts study');
  await panel.getByRole('button', { name: 'Close' }).click();
  await words.clear();
  await expect(titles).toHaveCount(2);
  await expect(titles.filter({ hasText: 'Travel notes' })).toBeVisible();
  await expect(trigger).toHaveText('Filters · 2');
  expect(await page.evaluate(() => (window as any).__wb.drawn.chapter.chapter)).toBe(25);
});

test('rows 12 and 22: notebook_and_questions_use_shared_choices', async ({ page }) => {
  const scope = await openNotebook(page, 'Questions');
  const titles = scope.locator('.nb-item-title');
  await expect(titles).toHaveCount(4);
  await scope.getByRole('button', { name: 'Filters' }).click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await panel.getByLabel('Status', { exact: true }).selectOption('answered');
  await panel.getByLabel('Book and place').fill('Acts 2');
  await expect(titles).toHaveCount(4);
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(titles).toHaveText(['Prayer after the gathering follow-up?']);
  const words = page.getByRole('textbox', { name: 'Search questions' });
  await words.fill('travel');
  await expect(titles).toHaveCount(0);
  await expect(scope.getByRole('heading', { name: 'Questions' })).toBeVisible();
  await words.fill('prayer');
  await expect(titles).toHaveText(['Prayer after the gathering follow-up?']);
});

async function applyAll(scope: ReturnType<Page['locator']>, folder = true) {
  await scope.getByRole('button', { name: /^Filters/ }).click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await panel.getByLabel('Pages with questions').selectOption('open');
  if (folder) await panel.getByLabel('Folder', { exact: true }).selectOption({ label: 'Acts study' });
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel).toHaveCount(0);
}

test('row 5: filters_close_discards_pending_choices', async ({ page }) => {
  const scope = await openNotebook(page);
  const requests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/fixtures/wb/notebook-view-')) requests.push(request.url());
  });
  const trigger = scope.getByRole('button', { name: /^Filters/ });
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await applyAll(scope);
  await expect(trigger).toHaveText('Filters · 2');
  const before = requests.length;
  await trigger.click();
  await panel.getByLabel('Pages with questions').selectOption('answered');
  await panel.getByLabel('Page kind').selectOption('day');
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Filters · 2');
  await expect(scope.getByText('Pages with questions · Open')).toBeVisible();
  await trigger.click();
  await panel.getByLabel('Pages with questions').selectOption('answered');
  await panel.getByLabel('Page kind').focus();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel.getByLabel('Pages with questions')).toHaveValue('open');
  await expect(panel.getByLabel('Page kind')).toHaveValue('');
  await panel.getByRole('button', { name: 'Close' }).click();
  expect(requests).toHaveLength(before);
  await expect(scope.locator('.nb-item-title')).toHaveText(['Travel notes', 'Prayer in the upper room']);
});

test('row 6: filters_remove_one_keeps_the_others', async ({ page }) => {
  const scope = await openNotebook(page);
  const titles = scope.locator('.nb-item-title');
  const trigger = scope.getByRole('button', { name: /^Filters/ });
  const total = await titles.count();
  await applyAll(scope);
  await expect(titles).toHaveCount(2);
  const status = scope.getByRole('button', { name: 'Remove Pages with questions · Open' });
  const folder = scope.getByRole('button', { name: 'Remove Folder · Acts study' });
  await status.click();
  await expect(scope.getByText('Pages with questions · Open')).toHaveCount(0);
  await expect(scope.getByText('Folder · Acts study')).toBeVisible();
  await expect(titles).toHaveCount(3);
  await expect(trigger).toHaveText('Filters · 1');
  await expect(folder).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(titles).toHaveCount(total);
  await expect(scope.locator('.nb-scope-applied')).toBeHidden();
  await expect(trigger).toHaveText('Filters');
  await expect(trigger).toBeFocused();
  await expect(scope.getByText(`${total} pages`, { exact: true })).toBeVisible();
});

test('row 6: filters_remove_one_keeps_the_others in Questions', async ({ page }) => {
  const scope = await openNotebook(page, 'Questions');
  const titles = scope.locator('.nb-item-title');
  await scope.getByRole('button', { name: 'Filters' }).click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await panel.getByLabel('Status', { exact: true }).selectOption('answered');
  await panel.getByLabel('Book and place').fill('Acts 2');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(titles).toHaveCount(1);
  await scope.getByRole('button', { name: 'Remove Book and place · Acts 2' }).click();
  await expect(scope.getByText('Status · Answered')).toBeVisible();
  await expect(scope.getByText('Book and place · Acts 2')).toHaveCount(0);
  await expect(scope.getByRole('button', { name: /^Filters/ })).toBeFocused();
  await scope.getByRole('button', { name: 'Remove Status · Answered' }).click();
  await expect(titles).toHaveCount(4);
  await expect(scope.getByRole('button', { name: /^Filters$/ })).toBeFocused();
});

test('row 7: filters_clear_keeps_words_and_starting_scope', async ({ page }) => {
  const scope = await openNotebook(page);
  const words = page.getByRole('textbox', { name: 'Search pages' });
  const titles = scope.locator('.nb-item-title');
  const trigger = scope.getByRole('button', { name: /^Filters/ });
  await words.fill('prayer');
  await expect(titles).toHaveCount(3);
  await applyAll(scope);
  await expect(titles).toHaveCount(1);
  await trigger.click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await panel.getByLabel('Page kind').selectOption('day');
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Filters');
  await expect(scope.locator('.nb-scope-applied')).toBeHidden();
  await expect(words).toHaveValue('prayer');
  await expect(titles).toHaveCount(3);
  await trigger.click();
  await expect(panel.getByLabel('Page kind')).toHaveValue('');
  await expect(panel.getByLabel('Pages with questions')).toHaveValue('');
});

test('row 7: filters_clear_keeps_words_and_starting_scope in Questions', async ({ page }) => {
  const scope = await openNotebook(page, 'Questions');
  const titles = scope.locator('.nb-item-title');
  await scope.getByRole('button', { name: 'Filters' }).click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  await expect(panel.getByLabel('Status', { exact: true }).locator('option')).toHaveText(['Any status', 'Open', 'Answered']);
  await panel.getByLabel('Status', { exact: true }).selectOption('answered');
  await panel.getByLabel('Book and place').fill('Acts 2');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(titles).toHaveCount(1);
  await scope.getByRole('button', { name: /^Filters/ }).click();
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await expect(panel).toHaveCount(0);
  await expect(titles).toHaveCount(4);
  await expect(scope.getByRole('button', { name: /^Filters$/ })).toBeFocused();
});

test('row 8: filters_distinguish_invalid_and_empty', async ({ page }) => {
  const scope = await openNotebook(page, 'Questions');
  const titles = scope.locator('.nb-item-title');
  const words = page.getByRole('textbox', { name: 'Search questions' });
  await scope.getByRole('button', { name: 'Filters' }).click();
  const panel = scope.getByRole('dialog', { name: 'Filters' });
  // a bad place: explained, focus stays on its control, nothing applied
  await panel.getByLabel('Book and place').fill('Zzz 99');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel.getByRole('alert').filter({ hasText: 'Book and place:' })).toBeVisible();
  await expect(panel.getByLabel('Book and place')).toBeFocused();
  await expect(titles).toHaveCount(4);
  // a valid choice with no matches: choices stay, says nothing matches
  await panel.getByLabel('Status', { exact: true }).selectOption('answered');
  await panel.getByLabel('Book and place').fill('Acts 2');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await words.fill('travel');
  await expect(titles).toHaveCount(0);
  await expect(scope.getByText('No questions match these choices.')).toBeVisible();
  await expect(scope.getByText('Status · Answered')).toBeVisible();
  await expect(scope.getByText('Book and place · Acts 2')).toBeVisible();
  await expect(scope.getByRole('alert')).toHaveCount(0);
  await words.clear();
  await expect(titles).toHaveCount(1);
  // a saved value that no longer exists: explained on its row, focus stays, results stay
  await page.route('**/fixtures/wb/question-list-*acts-2*.json', route => route.fulfill({ status: 404, body: '' }));
  await words.fill('prayer');
  await expect(scope.locator('.nb-scope-invalid')).toContainText('Book and place:');
  await expect(words).toBeFocused();
  await expect(titles).toHaveCount(1);
  await page.unroute('**/fixtures/wb/question-list-*acts-2*.json');
  await words.clear();
  await expect(scope.locator('.nb-scope-invalid')).toHaveCount(0);
  await expect(titles).toHaveCount(1);
});

test('row 8: a failed load keeps the last results with one error line', async ({ page }) => {
  const scope = await openNotebook(page);
  const titles = scope.locator('.nb-item-title');
  const words = page.getByRole('textbox', { name: 'Search pages' });
  await words.fill('prayer');
  await expect(titles).toHaveCount(3);
  let fail = true;
  await page.route('**/fixtures/wb/notebook-view-*.json', route => (fail ? route.fulfill({ status: 500, body: '' }) : route.fallback()));
  await words.fill('prayer upper');
  await expect(scope.getByRole('alert')).toHaveCount(1);
  await expect(scope.getByRole('alert')).toBeVisible();
  await expect(scope.locator('.nb-scope-invalid')).toHaveCount(0);
  await expect(titles).toHaveCount(3);
  fail = false;
  await words.fill('prayer');
  await expect(scope.getByRole('alert')).toBeHidden();
  await expect(titles).toHaveCount(3);
});
