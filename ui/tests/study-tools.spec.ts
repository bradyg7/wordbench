import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// All scripture and word anchors come from the existing database-generated fixture.
const fx = JSON.parse(readFileSync(new URL('../public/fixtures/NUM.25.json', import.meta.url), 'utf8'));
const word = fx.words['11.24'];
const strong = word.lexicon.strong;
const verses = fx.reader.chapter.verses.slice(0, 2);
const rows = verses.map((v: any) => ({
  ref: { code: 'NUM', name: 'Numbers', c: 25, v: v.v },
  words: v.words.map((w: any, i: number) => ({ t: w.text, lead: w.lead, trail: w.trail || ' ', m: i === 0 ? 'both' : null })),
  runs: [{ anchor: `NUM.25:${v.v}.${v.words[0].i}` }],
}));

async function ready(page: Page) {
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = route.request().url().split('/').pop()!;
    let data: any = {};
    if (name.startsWith('uses-')) data = { rows, occurrences: 2, verses: 2, more: false };
    else if (name.startsWith('strong-')) data = { ...word.lexicon, renderings: [] };
    else if (name.startsWith('count-')) data = { occurrences: word.count.times, verses: word.count.verses, by_book: {} };
    else if (name.startsWith('anchor-')) data = {
      label: `${strong} everywhere`, kind: 'lemma', ok: true, notes: [], nearby: [], threads: [], strongs: [],
      everywhere: { strong, word_notes: [], occurrence_notes: [{ anchor: word.anchor, label: word.reference, quote: word.text, text: 'An existing occurrence note' }] },
    };
    else if (name.startsWith('trail-list')) data = { trails: [] };
    else if (name.startsWith('thread-list')) data = [];
    else if (name.startsWith('thread-add-many')) data = { added: ['fixture'] };
    await route.fulfill({ json: data });
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
}

async function uses(page: Page, term = strong) {
  await page.evaluate(async term => {
    const path = '/src/panes.ts';
    (await import(path)).openUses(term, '');
  }, term);
  await expect(page.locator('.results-count').last()).toContainText('adds all 2 loaded');
}

test('Every use exposes selection counts and word or verse choices, including typed changes', async ({ page }) => {
  await ready(page);
  await uses(page);
  const select = page.getByRole('combobox', { name: 'What to add to the thread' });
  await expect(select).toHaveValue('words');
  await page.locator('.tick').first().check();
  await expect(page.getByRole('status')).toHaveText('1 ticked · 2 loaded');
  await select.selectOption('verses');
  expect(await page.evaluate(async () => {
    const path = '/src/panes.ts'; return (await import(path)).frontResults.shape;
  })).toBe('verses');
  await page.evaluate(async () => {
    const path = '/src/actions.ts'; await (await import(path)).perform({ cmd: 'results', action: 'as', as: 'words' }, 'results as words');
  });
  await expect(select).toHaveValue('words');
  await page.getByRole('button', { name: 'Tick all loaded' }).click();
  await expect(page.locator('.tick:checked')).toHaveCount(2);
  await expect(page.getByRole('status')).toHaveText('2 ticked · 2 loaded');
  await page.getByRole('button', { name: 'None', exact: true }).click();
  await expect(page.locator('.tick:checked')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('None ticked · adds all 2 loaded');
  // The wrapped controls fit even in a compact pane.
  expect(await page.locator('.results-bar').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('result selection sends word anchors or whole verses through the existing command', async ({ page }) => {
  await ready(page);
  await uses(page);
  await page.locator('.tick').first().check();
  const sent: string[] = [];
  page.on('request', request => { if (request.url().includes('thread-add-many-')) sent.push(request.url()); });
  const add = async () => {
    await page.getByRole('button', { name: 'Add to a thread…', exact: true }).click();
    await page.getByPlaceholder('A thread, or a new name').fill('Selection fixture');
    await page.getByPlaceholder('A thread, or a new name').press('Enter');
  };
  await add();
  await expect.poll(() => sent.length).toBe(1);
  const anchor = rows[0].runs[0].anchor.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  expect(sent[0]).toContain(`selection-fixture-${anchor}.json`);
  await page.getByRole('combobox', { name: 'What to add to the thread' }).selectOption('verses');
  await add();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toContain(`selection-fixture-num-25-${rows[0].ref.v}.json`);
});

test('Strong’s pane keeps a route to notes everywhere and notes at occurrences', async ({ page }) => {
  await ready(page);
  await page.evaluate(async strong => { const path = '/src/panes.ts'; (await import(path)).openStrong(strong); }, strong);
  await page.getByRole('button', { name: `Notes on ${strong} everywhere` }).click();
  await expect(page.getByText(`Notes where ${strong} appears`, { exact: true })).toBeVisible();
  await expect(page.getByText('An existing occurrence note', { exact: true })).toBeVisible();
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
});
