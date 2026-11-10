import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const slug = 'phone-test-thread';
const thread = {
  id: 'thread:' + slug,
  slug,
  kind: 'thread',
  title: 'Phone test thread',
  color: 'green',
  text: 'A note about mulberries.',
  preview: 'A note about mulberries.',
  placed: false,
  anchor: '',
};

test('Search every page opens a thread page by touch', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'phone');
  await page.route('**/fixtures/wb/*.json', async route => {
    const command = new URL(route.request().url()).pathname.split('/').at(-1);
    const verse = fx.verses['11'];
    const answers: Record<string, unknown> = {
      'notebook-group-day.json': { groups: [] },
      'notebook-group-none-search-mulberries.json': { groups: [{ entries: [thread] }] },
      'docs-list-thread-phone-test-thread.json': [],
      'docs-looks.json': {},
      'craft-designs.json': { themes: {}, theme: '' },
      'note-show-thread-phone-test-thread.json': thread,
      'page-blocks-thread-phone-test-thread.json': { id: thread.id, text: thread.text, blocks: [{ n: 1, kind: 'paragraph', text: thread.text, start: 0, end: thread.text.length }] },
      'thread-show-phone-test-thread.json': { members: [{ anchor: verse.anchor, label: verse.reference, quote: verse.text }] },
    };
    if (command && command in answers) await route.fulfill({ json: answers[command] });
    else await route.fulfill({ status: 404 });
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).tap();
  const notebook = page.locator('.pane-notebook');
  await notebook.getByRole('textbox', { name: 'Search every page' }).fill('mulberries');
  const result = notebook.locator('.nb-item').filter({ hasText: thread.title });
  await expect(result).toHaveText(/Phone test thread.*A note about mulberries.*Thread/);
  await result.tap();
  await expect(notebook.locator('.nb-title')).toHaveText(thread.title);
  await expect(notebook.locator('.nb-thread-places .ref-link')).toHaveText(fx.verses['11'].reference);
  await expect(notebook.locator('.nb-thread-places .scripture-row')).toHaveText(fx.verses['11'].text);
  await notebook.locator('.nb-back').tap();
  await expect(result).toBeVisible();
});
