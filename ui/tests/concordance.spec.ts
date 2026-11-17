import { expect, test, type Page } from '@playwright/test';

// design/features/concordance (accepted 2026-11-16), "What the build must satisfy": the book on the rail, its four tabs, the
// English page, picking a word, the letter strip, numbers and sounds, the Hebrew entry. The answers are the `wb` commands'
// (npm run fixtures makes them from the database); the scripture on the page is compared with `wb text`, never typed here.
const ready = async (page: Page) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
};
const fixture = async (page: Page, name: string) => (await page.request.get(`/fixtures/wb/${name}.json`)).json();
const open = (page: Page, o: object = {}) => page.evaluate(o => (window as any).__wb.concordance(o), o);
const tabs = (page: Page) => page.evaluate(() => (window as any).__wb.dock().panes.filter((p: any) => p.kind === 'concordance').map((p: any) => p.title));
const front = (page: Page) => page.locator('.pane-concordance:visible').last();

test('the rail opens one Concordance tab with four tabs inside it', async ({ page }, info) => {
  await ready(page);
  if (info.project.name === 'webkit-desktop') await page.locator('#rail').getByRole('button', { name: 'Concordance', exact: true }).click();
  else await open(page);
  const c = front(page);
  await expect(c.locator('.conc-tab')).toHaveText(['English', 'Hebrew', 'Greek', 'Interlinear']);
  expect(await tabs(page)).toEqual(['Concordance']);
});

test('typing zea gives the forms wb gives, and picking zealous opens a tab of its own', async ({ page }) => {
  await ready(page);
  await open(page);
  const c = front(page);
  await c.locator('.conc-input').fill('zea');
  const forms = (await fixture(page, 'concordance-box-zea')).english;
  await expect(c.locator('.conc-form')).toHaveCount(forms.length);
  for (const f of forms) await expect(c.locator(`.conc-form[data-form="${f.form}"]`)).toContainText(String(f.n));
  await expect(c.locator('[data-group="number"], [data-group="sounds-like"]')).toHaveCount(0);
  // the box with zealous typed; choosing the English word opens a new tab named zealous, the old one keeps its page
  await c.locator('.conc-input').fill('zealous');
  await c.locator('.conc-form[data-form="zealous"]').click();
  expect(await tabs(page)).toEqual(['Concordance', 'zealous']);
  const alone = await fixture(page, 'concordance-zealous-forms-one');
  expect(alone.places).toBe(8);
  const t = front(page);
  await expect(t.locator('.conc-word')).toHaveText('zealous');
  await expect(t.locator('.conc-line')).toHaveCount(alone.places);
  // the other forms are at the foot, each a button
  await expect(t.locator('.conc-other')).toHaveText(['zeal 16', 'zealously 2']);
});

test('the English page is the places of wb concordance, a long word is under its books', async ({ page }) => {
  await ready(page);
  await open(page, { word: 'zeal', mode: 'one' });
  const c = front(page);
  const zeal = await fixture(page, 'concordance-zeal-forms-one');
  await expect(c.locator('.conc-line')).toHaveCount(zeal.places);
  await expect(c.locator('.conc-group')).toHaveCount(0);
  // a line is the verse's own words: the words around the marked word are in the verse wb text gives
  const first = zeal.lines[0];
  const text = (await fixture(page, 'text-2sa-21-2-json')).verses[0].text.replace(/\s+/g, ' ');
  const shown = `${first.before}${first.word}${first.after}`;
  await expect(c.locator('.conc-line').first().locator('.conc-ctx')).toHaveText(shown);
  expect(text).toContain(shown.trim());
  await expect(c.locator('.conc-line').first().locator('.conc-mark')).toHaveText('zeal');
  // heart: 54 books, each with its count, 4 lines and "N more", which shows the rest of that book
  await open(page, { word: 'heart', mode: 'one' });
  const h = front(page);
  const heart = await fixture(page, 'concordance-heart-forms-one');
  expect(heart.groups.length).toBe(54);
  await expect(h.locator('.conc-group')).toHaveCount(54);
  const gen = h.locator('.conc-group').first();
  await expect(gen.locator('.chip').first()).toHaveText(String(heart.groups[0].count));
  await expect(gen.locator('.conc-line')).toHaveCount(4);
  const psa = h.locator('.conc-group[data-group="PSA"]');
  await psa.locator('.conc-more').click();
  await expect(psa.locator('.conc-line')).toHaveCount((await fixture(page, 'concordance-heart-forms-one-book-psa')).groups[0].count);
});

test('a letter after a search shows its words, a letter with none is dimmed, Back returns to the search', async ({ page }) => {
  await ready(page);
  await open(page);
  const c = front(page);
  await c.locator('.conc-input').fill('zeal');
  await c.locator('.conc-input').press('Enter');
  await expect(c.locator('.conc-word')).toHaveText('zeal');
  await expect(c.locator('.conc-letter[data-letter="x"]')).toBeDisabled();
  await expect(c.locator('.conc-letter[data-letter="j"]')).toBeEnabled();
  await c.locator('.conc-letter[data-letter="j"]').click();
  const j = await fixture(page, 'forms-j');
  await expect(c.locator('.conc-form-btn')).toHaveCount(j.forms.length);
  await c.getByRole('button', { name: 'Back to zeal' }).click();
  await expect(c.locator('.conc-word')).toHaveText('zeal');
});

test('a number or a sound opens its entry in a tab; the entry lists every place by English word or book', async ({ page }) => {
  await ready(page);
  await open(page);
  const c = front(page);
  await c.locator('.conc-input').fill('H7068');
  await expect(c.locator('[data-group="number"] .conc-sug-row')).toHaveCount(1);
  await expect(c.locator('[data-group="number"]')).toContainText('43 places');
  await c.locator('[data-group="number"] .conc-sug-row').click();
  expect(await tabs(page)).toEqual(['Concordance', 'H7068']);
  const e = front(page);
  await expect(e.locator('.conc-tab.on')).toHaveText('Hebrew');
  const by = await fixture(page, 'uses-h7068-by-word');
  await expect(e.locator('.conc-group').first().locator('.chip').first()).toHaveText(String(by.groups[0].count));
  await expect(e.locator('.conc-group').first().locator('.conc-line')).toHaveCount(4);
  await e.locator('.conc-sw[data-by="book"]').click();
  await expect(e.locator('.conc-group').first().locator('.conc-group-name')).toHaveText('Numbers');
  await c.locator('.conc-input').fill('kanna');
  await expect(c.locator('[data-group="sounds-like"] .conc-sug-row')).toHaveCount(1);
});

test('the Interlinear tab shows the verse as wb text gives it, with the words and their numbers', async ({ page }) => {
  await ready(page);
  await open(page, { ref: 'Numbers 25:11' });
  const c = front(page);
  const want = (await fixture(page, 'text-numbers-25-11-json')).verses[0].text;
  await expect(c.locator('.conc-verse-text').first()).toHaveText(want);
  const inter = await fixture(page, 'interlinear-numbers-25-11');
  await expect(c.locator('.conc-words .inter-card')).toHaveCount(inter.verses[0].words.length);
  await expect(c.locator('.conc-words .inter-strong').first()).toHaveText(inter.verses[0].words[0].strong);
});
