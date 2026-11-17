import { expect, test } from '@playwright/test';

// trash T14 (TR-4): 214 waiting items, grouped by the day of deletion with a count, folded to 5 rows, searchable.
test('a large Trash is grouped by day, folded, and narrowed by the search field', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'The Trash tab is opened from the desktop Notebook.');
  const notes: unknown[] = [];
  const add = (day: string, n: number, word: string) => {
    for (let i = 0; i < n; i++) notes.push({ name: `${day.replaceAll('-', '')}-100000-n_${word}${i}.md`, id: `n_${word}${i}`, anchor: '', kind: 'jot', question: false, text: `${word} page ${i}`, deleted: `${day}T10:00:00Z`, days_left: 5 });
  };
  add('2026-11-16', 180, 'apple');
  add('2026-11-15', 34, 'pear');
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (name === 'trash.json') return route.fulfill({ json: { days: 7, notes } });
    if (name === 'page-sweep.json') return route.fulfill({ json: { operations: [], errors: [] } });
    if (name.startsWith('notebook-group-')) return route.fulfill({ json: { groups: [] } });
    if (name.startsWith('notebook-sidebar')) return route.fulfill({ json: { today: [], pinned: [], pages: [], questions: [], templates: [] } });
    if (name === 'page-tree.json') return route.fulfill({ json: { pinned: [], pages: [] } });
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await page.locator('.pane-notebook .nb-section[data-section="pages"]').click();
  const trash = page.locator('.pane-notebook .nb-trash-groups');
  await page.locator('.pane-notebook .nb-trash-line').click();
  await expect(trash.locator('.nb-trash-group')).toHaveCount(2);
  await expect(trash.locator('.nb-trash-group').first().locator('.nb-trash-rows .trashed')).toHaveCount(5);
  await expect(trash.locator('.nb-trash-day .nb-trash-count').first()).toHaveText('180');
  await page.getByRole('button', { name: 'Show all 180' }).click();
  await expect(trash.locator('.nb-trash-group').first().locator('.nb-trash-rows .trashed')).toHaveCount(180);
  await page.getByRole('searchbox', { name: 'Search the Trash' }).fill('pear page 3');
  await expect(trash.locator('.trashed')).toHaveCount(5);
});
