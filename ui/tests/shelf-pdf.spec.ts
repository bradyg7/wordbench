import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Shelf opens a saved PDF individually and with its folder', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'Open all is a desktop action');
  const file = { key: 'pdf-older-study', kind: 'pdf', label: 'Older study', ref: 'Older study.pdf', open: 'pdf|Older study.pdf' };
  const folder = { id: 'pdf-archive', name: 'PDF archive', parent: '', depth: 0, items: [file], folders: [] };
  let opens = 0;
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (name === 'shelf.json') return route.fulfill({ json: { folders: [folder] } });
    if (name === 'set-open-pdf-archive.json') return route.fulfill({ json: folder });
    if (name === 'pdfs-older-study-pdf-exact.json') {
      opens += 1;
      return route.fulfill({ json: { ok: true, name: file.ref } });
    }
    return route.fallback();
  });

  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Shelf', exact: true }).first().click();
  await page.getByText(file.label, { exact: true }).click();
  await expect.poll(() => opens).toBe(1);

  await page.getByText(folder.name, { exact: true }).click();
  await page.getByRole('button', { name: 'Open all', exact: true }).click();
  await expect.poll(() => opens).toBe(2);
  await expect(page.getByText(/1 opened in the PDF viewer/)).toBeVisible();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
});

test('Save chapter PDF uses the current chapter and visible layers', async ({ page }, info) => {
  const fixture = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
  fixture.reader.marks.thread_names = { shown: 'Shown thread', hidden: 'Hidden thread' };
  await page.addInitScript(() => localStorage.setItem('wb.layers.v1', JSON.stringify({ mine: false, all: true, hidden: ['hidden'] })));
  await page.route('**/fixtures/NUM.25.json', route => route.fulfill({ json: fixture }));
  let opened = false;
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (name === 'parse-pdf.json') return route.fulfill({ json: { action: { cmd: 'pdf' } } });
    if (name === 'pdf-numbers-25-no-mine-thread-shown-open.json') {
      opened = true;
      return route.fulfill({ json: { name: 'Numbers 25 - saved.pdf' } });
    }
    return route.fallback();
  });

  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.locator(info.project.name === 'webkit-phone' ? '#tab-more' : '#more').click();
  await page.getByRole('button', { name: 'Save chapter PDF', exact: true }).click();
  await expect.poll(() => opened).toBe(true);
  await expect(page.getByText('Saved Numbers 25 - saved.pdf')).toBeVisible();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
});
