import { expect, test } from '@playwright/test';

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
