import { expect, test } from '@playwright/test';

test('Delete All previews the chosen scope and offers Undo only after confirmation', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'The desktop sidebar exposes Delete All.');
  const requests: string[] = [];
  let pending = false;
  const deletion = {
    operation: 'delete_scratch', state: 'pending', deadline_ms: Date.now() + 30_000,
    count: 1, moved: 0, deleted: ['scratch'], retained_moved: [],
  };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'page-sweep.json') return send({ operations: pending ? [deletion] : [], errors: [] });
    if (name.startsWith('notebook-group-')) return send({ groups: [] });
    if (name.startsWith('notebook-sidebar')) return send({ today: [], pinned: [], pages: [], questions: [], templates: [] });
    if (name === 'page-tree.json') return send({ pinned: [], pages: [] });
    if (name === 'page-rm-all.json') {
      requests.push('preview');
      return send({ ...deletion, state: 'preview', token: 'scratch' });
    }
    if (name === 'page-rm-all-yes-expect-scratch.json') {
      requests.push('commit');
      pending = true;
      return send(deletion);
    }
    if (name === 'page-undo-delete-scratch.json') {
      requests.push('undo');
      pending = false;
      return send({ ...deletion, state: 'restored' });
    }
    return route.fallback();
  });

  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await page.locator('.pane-notebook .nb-section[data-section="pages"]').click();
  const deleteAll = page.getByRole('button', { name: 'Delete All…', exact: true });
  await deleteAll.click();
  const review = page.getByRole('button', { name: 'Preview Delete All' });
  const confirm = page.getByRole('button', { name: 'Delete 1 page', exact: true });
  const includePinned = page.getByRole('checkbox', { name: 'Include Pinned pages' });
  await expect(includePinned).not.toBeChecked();
  await review.click();
  await expect(confirm).toBeVisible();
  await includePinned.check();
  await expect(confirm).toHaveCount(0);
  await includePinned.uncheck();
  await review.click();
  await expect(confirm).toBeVisible();
  expect(requests).toEqual(['preview', 'preview']);

  await confirm.click();
  const undo = page.getByRole('button', { name: 'Undo deletion of 1 page', exact: true });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(undo).toHaveCount(0);
  expect(requests).toEqual(['preview', 'preview', 'commit', 'undo']);
});
