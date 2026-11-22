import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 50-55 (NB12, accepted 2026-11-20): the Word, Interlinear, Cross references, Concordance,
// Margin notes for a passage and Marks in a passage blocks. Each holds one value; what it shows is read each time the page is
// drawn. Everything shown comes from fixtures `wb` generated from the database and the fixture study (npm run fixtures).
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../public/fixtures/wb/${name}.json`, import.meta.url), 'utf8'));
const TITLE = 'Study page';

type B = { kind: string; text: string; lang?: string };
const fence = (lang: string, value: string): B => ({ kind: 'fence', lang, text: ['```' + lang, value, '```'].join('\n') });
const study = fx('study-blocks');
const strong = fx('strong-h7065');
const BODIES: B[] = [fence('word', 'H7065'), fence('interlinear', 'Numbers 25:11'), fence('xrefs', 'Numbers 25:11'), fence('concordance', 'zealous'), fence('margin', 'Numbers 25'), fence('marks', 'Numbers 25')];

async function studyPage(page: Page, bodies: B[] = BODIES, studyData: any = study, size?: { width: number; height: number }) {
  if (size) await page.setViewportSize(size);
  const blocks = () => {
    let at = TITLE.length + 2;
    return { id: 'w1', title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: bodies.map((b, i) => { const start = at; at += b.text.length + 2; return { n: i + 1, ...b, start, end: start + b.text.length }; }) };
  };
  const detail = () => ({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: [TITLE, ...bodies.map(b => b.text)].join('\n\n'), linked_from: [], also: [], threads: [] });
  const words = { id: 'w1', blocks: [{ n: 1, held: 'H7065', strong: strong.strong, lemma: strong.lemma, translit: strong.translit, pron: strong.pron, pos: strong.pos,
    definition: strong.definition, usage: strong.usage, occurrences: strong.occurrences, renderings: strong.renderings.slice(0, 6) }] };
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const send = (json: unknown) => route.fulfill({ json });
    if (name === 'note-show-w1.json') return send(detail());
    if (name === 'page-blocks-w1.json') return send(blocks());
    if (name.startsWith('block-set-w1-') || name.startsWith('block-add-w1-')) return send({ ...blocks(), n: 1, count: 1 });
    if (name === 'page-study-w1.json') return send(studyData);
    if (name === 'page-words-w1.json') return send(words);
    if (name === 'page-scripture-w1.json') return send({ id: 'w1', blocks: [] });
    if (name === 'settings-notebook.json') return send({});
    if (name === 'page-sweep.json') return send({ operations: [], errors: [] });
    if (name === 'docs-looks.json') return send({ looks: [] });
    if (name === 'craft-designs.json') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list.json') return send({ templates: [] });
    if (name.startsWith('page-overview-')) return send({});
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
}

const dataOf = (lang: string) => study.blocks.find((b: any) => b.lang === lang).data;

test('study_word_block', async ({ page }) => {
  await studyPage(page);
  const block = page.locator('.nb-wordblock');
  await expect(block).toBeVisible();
  // the number is all the file holds; the entry is the lexicon's
  expect(BODIES[0].text.split('\n')).toEqual(['```word', 'H7065', '```']);
  await expect(block.locator('.nbw-num')).toHaveText('H7065');
  await expect(block.locator('.nbw-lemma')).toHaveText(strong.lemma);
  await expect(block.locator('.nbw-sound')).toHaveText(`${strong.translit} · ${strong.pron} · ${strong.pos}`);
  await expect(block.locator('.nbw-def')).toHaveText(strong.definition);
  const used = strong.renderings.slice(0, 6).map((r: any) => `${r.w} (${r.n})`).join(', ');
  await expect(block.locator('.nbw-used')).toHaveText(`KJV: ${used}`);
});

test('study_interlinear_block', async ({ page }) => {
  const one = dataOf('interlinear');
  const two = fx('interlinear-numbers-25-11-12');
  const reduce = (d: any, label: string) => ({ label, lang: d.lang, total: d.verses.length, more: false, verses: d.verses.map((v: any) => ({ c: v.c, v: v.v, words: v.words.map((w: any) => ({ original: w.original, translit: w.translit, gloss: w.gloss, strong: w.strong })) })) });
  const bodies = [fence('interlinear', 'Numbers 25:11'), fence('interlinear', 'Numbers 25:11-12')];
  const data = { id: 'w1', blocks: [{ n: 1, lang: 'interlinear', held: 'Numbers 25:11', data: one }, { n: 2, lang: 'interlinear', held: 'Numbers 25:11-12', data: reduce(two, 'Numbers 25:11–12') }] };
  await studyPage(page, bodies, data, { width: 1440, height: 900 });
  const blocks = page.locator('.nb-study-interlinear');
  await expect(blocks).toHaveCount(2);
  const first = blocks.nth(0), second = blocks.nth(1);
  // each word: the original, its sound, its gloss and its number, in the verse's order, from the database
  const words = one.verses[0].words;
  const cells = first.locator('.nbi-word');
  await expect(cells).toHaveCount(words.length);
  for (const [i, w] of words.entries()) {
    const c = cells.nth(i);
    await expect(c.locator('.nbi-orig')).toHaveText(w.original);
    await expect(c.locator('.nbi-sound')).toHaveText(w.translit);
    await expect(c.locator('.nbi-gloss')).toHaveText(w.gloss);
    await expect(c.locator('.nbi-num')).toHaveText(w.strong);
  }
  await expect(first.locator('.nbs-kind')).toHaveText('Interlinear · Hebrew');
  await expect(first.locator('.nbs-foot')).toHaveText(`Numbers 25:11, ${words.length} words`);
  // a long verse scrolls sideways inside the block: the block does not widen, and the scroller moves
  const scroll = first.locator('.nbi-scroll');
  const metrics = await scroll.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, ox: getComputedStyle(e).overflowX }));
  expect(metrics.ox).toBe('auto');
  expect(metrics.sw).toBeGreaterThan(metrics.cw);
  await scroll.evaluate(e => { e.scrollLeft = 300; });
  expect(await scroll.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
  const col = (await page.locator('.nb-pagecol').boundingBox())!;
  const box = (await first.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(col.x + col.width + 1);
  // as wide as the column (the block's body is the column's width)
  const body = (await page.locator('.nb-block-body').first().boundingBox())!;
  expect(Math.abs(box.width - body.width)).toBeLessThan(2);
  // its height grows with its words: two verses are taller than one
  expect((await second.boundingBox())!.height).toBeGreaterThan(box.height + 20);
  expect(await first.evaluate(e => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  // no drag-to-resize
  expect(await first.evaluate(e => getComputedStyle(e).resize)).toBe('none');
  await expect(first.locator('.nb-resize, .resize-handle, [data-resize]')).toHaveCount(0);
  // at Full width the block is as wide as the wider column
  await page.evaluate(() => { const ed = document.querySelector<HTMLElement>('.nb-editor'); if (ed) ed.dataset.full = '1'; });
  const wide = (await first.boundingBox())!;
  expect(wide.width).toBeGreaterThanOrEqual(box.width);
  const colWide = (await page.locator('.nb-pagecol').boundingBox())!;
  expect(Math.abs(wide.width - (await page.locator('.nb-block-body').first().boundingBox())!.width)).toBeLessThan(2);
  expect(wide.x + wide.width).toBeLessThanOrEqual(colWide.x + colWide.width + 1);
});

test('study_cross_references', async ({ page }) => {
  await studyPage(page);
  const block = page.locator('.nb-study-xrefs');
  await expect(block.locator('.nbs-what')).toHaveText('Numbers 25:11');
  await expect(block.locator('.nbs-kind')).toHaveText('Cross references');
  // the app has no cross-reference source: the block says so and lists nothing
  await expect(block.locator('.nbs-none')).toHaveText('No cross references: the app has no cross-reference source yet.');
  await expect(block).toContainText('Proposed: wb xrefs REF, after a source is chosen.');
  await expect(block.locator('.nb-chip')).toHaveCount(0);
});

test('study_concordance_block', async ({ page }) => {
  await studyPage(page);
  const d = dataOf('concordance');
  const block = page.locator('.nb-study-concordance');
  await expect(block.locator('.nbs-what')).toHaveText('zealous');
  await expect(block.locator('.nbs-kind')).toHaveText('Concordance');
  const rows = block.locator('.nbc-row');
  await expect(rows).toHaveCount(d.lines.length);
  // every place in Bible order, the words either side and the original number
  for (const [i, l] of d.lines.entries()) {
    const r = rows.nth(i);
    await expect(r.locator('.nb-chip-text')).toHaveText(l.ref);
    await expect(r.locator('.nbc-word')).toHaveText(l.word);
    await expect(r.locator('.nbc-ctx')).toContainText(l.before.trim());
    await expect(r.locator('.nbc-ctx')).toContainText(l.after.trim());
    await expect(r.locator('.nbc-num')).toHaveText(l.strong);
  }
  await expect(block.locator('.nbs-foot')).toHaveText(`${d.places} places`);
  expect(d.lines[0].ref).toBe('Numbers 25:11');
});

test('study_margin_notes_block', async ({ page }) => {
  await studyPage(page);
  const d = dataOf('margin');
  const block = page.locator('.nb-study-margin');
  await expect(block.locator('.nbs-what')).toHaveText('Numbers 25');
  await expect(block.locator('.nbs-kind')).toHaveText(`Margin notes · ${d.count}`);
  const rows = block.locator('.nbm-row');
  await expect(rows).toHaveCount(d.notes.length);
  for (const [i, n] of d.notes.entries()) {
    await expect(rows.nth(i).locator('.nbm-where')).toHaveText(n.label);
    await expect(rows.nth(i).locator('.nbm-text')).toHaveText(n.text.split('\n')[0]);
  }
  // each opens its note: the reader shows the chapter with that note in its margin
  const last = d.notes.at(-1);
  await rows.last().locator('.nbm-where').click();
  await expect(page.locator(`.mg-card[data-note="${last.id}"], .mg-sign[data-note="${last.id}"]`).first()).toBeAttached();
});

test('study_marks_block', async ({ page }) => {
  await studyPage(page);
  const d = dataOf('marks');
  const block = page.locator('.nb-study-marks');
  await expect(block.locator('.nbs-what')).toHaveText('Numbers 25');
  await expect(block.locator('.nbs-kind')).toHaveText(`Marks · ${d.count}`);
  const rows = block.locator('.nbk-row');
  await expect(rows).toHaveCount(d.marks.length);
  // each mark: its look, where it is, its Legend style and the words it marks (the Bible's)
  for (const [i, m] of d.marks.entries()) {
    const r = rows.nth(i);
    await expect(r.locator('.nb-chip-text')).toHaveText(m.label);
    await expect(r.locator('.nbk-legend')).toHaveText(m.legend);
    if (m.words) await expect(r.locator('.nbk-words')).toHaveText(`“${m.words}”`);
    await expect(r.locator('.mk-sample, [class*="sample"]').first()).toBeAttached();
  }
  expect(d.marks.some((m: any) => m.legend === 'Fixture double')).toBe(true);
});

test('study_blocks_hold_only_a_value_and_say_what_is_missing', async ({ page }) => {
  // a block with nothing in it says what to write; one the database cannot read shows why, and the file stays as it was
  const bodies = [fence('marks', ''), fence('interlinear', 'Nowhere 3:1')];
  const data = { id: 'w1', blocks: [{ n: 1, lang: 'marks', held: '', error: 'No reference yet: write one under ```marks.' }, { n: 2, lang: 'interlinear', held: 'Nowhere 3:1', error: 'No book called “Nowhere”.' }] };
  await studyPage(page, bodies, data);
  await expect(page.locator('.nb-study-marks')).toContainText('No reference yet');
  await expect(page.locator('.nb-study-interlinear .nbv-error')).toHaveText('No book called “Nowhere”.');
});

// ---- placing them from / › Study -----------------------------------------------------------------------------------------

async function slashOpen(page: Page) {
  await studyPage(page, [{ kind: 'paragraph', text: 'First line' }], { id: 'w1', blocks: [] });
  await page.locator('.nb-block-body').first().click();
  const box = page.locator('.nb-block-input');
  await expect(box).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/');
  await expect(page.locator('.wbm')).toBeVisible();
  await box.evaluate(e => e.addEventListener('input', () => ((window as any).__v = (e as any).value)));
  return box;
}

test('study_blocks_are_in_the_study_group', async ({ page }) => {
  await slashOpen(page);
  await expect(page.locator('.wbm-row.wbm-fold')).toContainText('Scripture, Word, Interlinear, Cross references, Concordance, Margin notes for a passage, Marks in a passage');
  // typing finds each by name though Study is folded
  for (const [typed, label] of [['interlin', 'Interlinear'], ['cross', 'Cross references'], ['concord', 'Concordance'], ['margin', 'Margin notes for a passage'], ['marks in', 'Marks in a passage']]) {
    await page.keyboard.press('Control+a');
    await page.keyboard.type(typed);
    await expect(page.locator('.wbm-row')).toHaveText([new RegExp(label)]);
  }
});

for (const [typed, lang] of [['interlin', 'interlinear'], ['cross', 'xrefs'], ['margin', 'margin'], ['marks in', 'marks']] as const) {
  test(`study_${lang}_is_placed_with_a_reference_field`, async ({ page }) => {
    await slashOpen(page);
    await page.keyboard.type(typed);
    await page.keyboard.press('Enter');
    const field = page.locator('.sf-input');
    await expect(field).toBeFocused();
    await page.keyboard.type('Numbers 25:11');
    await expect(page.locator('.sf-verse')).toHaveCount(1);
    await page.keyboard.press('Enter');
    // the block holds only the reference
    await expect.poll(() => page.evaluate(() => (window as any).__v)).toBe('```' + lang + '\nNumbers 25:11\n```');
  });
}

test('study_concordance_is_placed_with_a_word', async ({ page }) => {
  await slashOpen(page);
  await page.keyboard.type('concord');
  await page.keyboard.press('Enter');
  const input = page.getByLabel('Concordance word');
  await expect(input).toBeFocused();
  await page.keyboard.type('two words');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chooser')).toContainText('Enter one English word');
  await input.fill('Zealous');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__v)).toBe('```concordance\nzealous\n```');
});
