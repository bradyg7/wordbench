import { expect, test } from '@playwright/test';

test('Documents exports a chosen passage and an existing lesson', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = route.request().url().split('/').pop()!;
    const responses: Record<string, unknown> = {
      'craft-designs.json': { themes: { vellum: { name: 'Vellum', best_for: '' } }, theme: 'vellum' },
      'docs-looks.json': { looks: [{ name: 'Preview', key: 'preview' }], saved: 'preview' },
      'lesson-list.json': [{ id: 'existing-file', title: 'Existing file' }],
      'page-tree.json': { pages: [] },
    };
    if (name.startsWith('craft-word-')) {
      calls.push(name);
      await route.fulfill({ json: { name: 'Saved.docx', changed: true, checked: { verses: 1 } } });
      return;
    }
    await route.fulfill({ json: responses[name] ?? [] });
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.locator('#more').click();
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  const form = page.locator('.pane-documents .doc-make');
  await form.getByRole('combobox', { name: 'Export source' }).selectOption('passage');
  await form.getByRole('textbox', { name: 'Passage reference' }).fill('Num 25:11');
  await form.getByRole('combobox', { name: 'Passage version' }).selectOption('YLT');
  await form.getByRole('button', { name: 'Make', exact: true }).click();
  await expect.poll(() => calls[0]).toContain('craft-word-passage-num-25-11-version-ylt-structure-reading');
  await expect(form.getByRole('textbox', { name: 'Passage reference' })).toHaveValue('Num 25:11');

  await form.getByRole('combobox', { name: 'Export source' }).selectOption('lesson');
  await expect(form.getByRole('combobox', { name: 'Existing lesson' })).toHaveValue('existing-file');
  await form.getByRole('button', { name: 'Make', exact: true }).click();
  await expect.poll(() => calls[1]).toContain('craft-word-lesson-existing-file-structure-script');
});
