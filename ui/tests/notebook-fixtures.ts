// What the Notebook asks for when a page is opened in the WebKit tests (no Rust there): the answers `wb` gave on the
// generated study (npm run fixtures) are served from files; the few that are only "nothing yet" are given here.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const marksPage: { id: string } = JSON.parse(readFileSync(new URL('../public/fixtures/wb/marks-page.json', import.meta.url), 'utf8'));

const quiet: Record<string, unknown> = {
  'settings-notebook.json': {},
  'notebook-group-day.json': { groups: [] },
  'page-sweep.json': { operations: [] },
  'docs-looks.json': {},
  'craft-designs.json': { themes: {}, theme: '' },
};

export async function notebookRoutes(page: Page, extra: Record<string, unknown> = {}) {
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const all = { ...quiet, ...extra };
    if (name in all) return route.fulfill({ json: all[name] });
    if (name.startsWith('history-add-')) return route.fulfill({ json: {} });
    if (name.startsWith('docs-list-')) return route.fulfill({ json: [] });
    return route.fallback();
  });
}

/** `wide`: the Notebook's column widened to half the window (the dock keeps it), so its pane is at least 560 px. */
export async function openMarksPage(page: Page, wide = false) {
  if (wide) await page.setViewportSize({ width: 2000, height: 900 });
  if (wide) await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(id => (window as any).__wb.note(id), marksPage.id);
}
