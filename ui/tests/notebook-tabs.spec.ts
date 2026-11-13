import { expect, test } from '@playwright/test';

test('two Notebook page tabs keep their edits and Shelf ownership separate', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'Open all is a wide-screen action.');
  const entries = [
    { id: 'alpha', title: 'Alpha scratch page', body: 'Alpha block' },
    { id: 'beta', title: 'Beta scratch page', body: 'Beta block' },
  ];
  const saves: string[] = [];
  const events: string[] = [];
  let deleted = false;
  const detail = (e: typeof entries[number]) => ({
    ...e, kind: 'note', placed: false, text: e.title + '\n\n' + e.body,
    linked_from: e.id === 'beta' ? [{ id: 'alpha', title: entries[0].title, kind: 'note' }] : [], also: [], threads: [],
  });
  const blocks = (e: typeof entries[number]) => ({
    id: e.id, title: { text: e.title, start: 0, end: e.title.length },
    blocks: [{ n: 1, kind: 'paragraph', text: e.body, start: e.title.length + 2, end: e.title.length + 2 + e.body.length }],
  });
  const items = entries.map(e => ({ key: e.id, kind: 'note', label: e.title, ref: e.id, open: `note|${e.id}` }));
  items.push({ key: 'orchard', kind: 'thread', label: 'Orchard thread', ref: 'orchard', open: 'thread|Orchard thread' });
  const folder = { id: 'scratch-set', name: 'Scratch folder', parent: '', depth: 0, items, folders: [] };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name.startsWith('notebook-group-')) return send({ groups: [{ key: 'one', label: 'Scratch', entries: entries.map(detail) }] });
    if (name.startsWith('notebook-sidebar')) return send({ today: [], pinned: [], pages: entries.map(detail), questions: [], templates: [] });
    if (name === 'shelf.json') return send({ folders: [folder] });
    if (name === 'set-open-scratch-set.json' || name === 'set-show-scratch-set.json') return send(folder);
    if (name === 'thread-list.json') return send([]);
    if (name === 'settings-notebook.json') return send({ links: true });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'craft-designs.json') return send({ themes: {}, theme: '' });
    if (name === 'docs-looks.json') return send({ looks: [] });
    if (name === 'thread-show-orchard-thread.json' || name === 'thread-show-orchard.json') return send({ id: 'orchard', members: [] });
    const thread = { id: 'thread:orchard', title: 'Orchard thread', body: 'Thread block' };
    if (name === 'note-show-thread-orchard.json') return send({ ...detail(thread), kind: 'thread', slug: 'orchard' });
    if (name === 'page-blocks-thread-orchard.json') return send(blocks(thread));
    if (name === 'page-sweep.json') return send({ operations: [], errors: [] });
    const deletion = { operation: 'scratch-delete', count: 1, moved: 0, deadline_ms: Date.now() + 10000, deleted: ['alpha'], retained_moved: [] };
    if (name === 'page-rm-alpha.json') {
      events.push('delete');
      deleted = true;
      return send({ ...deletion, state: 'pending' });
    }
    if (name === 'page-undo-scratch-delete.json') {
      deleted = false;
      return send({ ...deletion, state: 'restored' });
    }
    if (name === 'page-title-alpha-edited-scratch-title.json') {
      events.push('title');
      entries[0].title = 'Edited scratch title';
      return send({ id: 'alpha' });
    }
    for (const e of entries) {
      if (name === `note-show-${e.id}.json`) {
        if (e.id === 'alpha' && deleted) return route.fulfill({ status: 404 });
        return send(detail(e));
      }
      if (name === `page-blocks-${e.id}.json`) return send(blocks(e));
      if (name.startsWith(`block-set-${e.id}-1-`)) {
        saves.push(e.id);
        e.body += ' updated';
        return send({ ...blocks(e), n: 1, count: 1 });
      }
    }
    return route.fallback();
  });

  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await page.getByText(entries[0].title, { exact: true }).first().click({ button: 'right' });
  await page.getByRole('button', { name: 'Open in a tab', exact: true }).click();
  const alpha = page.locator('[data-page-tab="alpha"]');
  await expect(alpha.getByText('Alpha block', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Shelf', exact: true }).first().click();
  await page.getByText('Scratch folder', { exact: true }).click();
  await page.getByRole('button', { name: 'Open all', exact: true }).click();
  const orchard = page.locator('[data-page-tab="thread:orchard"]');
  await expect(orchard.getByText('Thread block', { exact: true })).toBeVisible();
  await page.locator('.tab-name').filter({ hasText: 'Beta scratch page' }).click();
  const beta = page.locator('[data-page-tab="beta"]');
  await expect(beta.getByText('Beta block', { exact: true })).toBeVisible();
  await beta.getByText('Beta block', { exact: true }).click();
  await beta.locator('.nb-block-input').fill('Beta block updated');
  await expect.poll(() => saves).toEqual(['beta']);

  await beta.getByRole('button', { name: 'Alpha scratch page', exact: true }).click();
  await alpha.getByRole('button', { name: 'Back to Beta scratch page' }).click();
  await expect(beta.getByText('Beta block updated', { exact: true })).toBeVisible();

  await page.locator('.tab-name').filter({ hasText: 'Alpha scratch page' }).click();
  await expect(alpha.getByText('Alpha block', { exact: true })).toBeVisible();
  await alpha.getByText('Alpha block', { exact: true }).click();
  await alpha.locator('.nb-block-input').fill('Alpha block updated');
  await expect.poll(() => saves).toEqual(['beta', 'alpha']);

  await page.locator('.tab-name').filter({ hasText: /^Shelf$/ }).click();
  await page.getByRole('button', { name: 'Close all', exact: true }).click();
  await expect(beta).toHaveCount(0);
  await expect(orchard).toHaveCount(0);
  await expect(alpha).toBeAttached();
  await expect(alpha.getByText('Alpha block updated', { exact: true })).toBeAttached();

  await page.locator('.tab-name').filter({ hasText: 'Alpha scratch page' }).click();
  await alpha.getByRole('heading', { name: 'Alpha scratch page', exact: true }).click();
  await alpha.getByRole('textbox', { name: 'The page’s title' }).fill('Edited scratch title');
  await alpha.getByRole('button', { name: 'Change this page' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => events).toEqual(['title', 'delete']);
  await expect(alpha.getByText(/That page is gone/)).toBeVisible();
  await page.getByRole('button', { name: /^Undo deletion of 1 page/ }).click();
  await expect(alpha.getByRole('heading', { name: 'Edited scratch title' })).toBeVisible();
  await expect(alpha.getByText('Alpha block updated', { exact: true })).toBeVisible();
});
