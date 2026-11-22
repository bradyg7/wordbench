import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// design/features/notebook rows 29, 30, 31, 32, 33, 45 (NB11): the page's top bar ("Edited just now", the quiet lock, no Save button), the
// searchable page ⋯ menu, Appearance ▸ (Font, Small text, Full width, Table of contents), Lock page, Copy contents, and the contents bar that
// folds to a rail. No Rust here: a small page server stands in for `wb` (the blocks as text; `wb page look`, `wb page lock` and `wb page text`
// as the core answers them), and what the window sent is read back from the calls. The words are the test's own; scripture is read from the
// generated fixtures (npm run fixtures), never typed.
const TITLE = 'Salt lessons 2025';
const verse11: string = JSON.parse(readFileSync('ui/public/fixtures/wb/scripture-numbers-25-11.json', 'utf8')).verses[0].text;

interface Call { name: string; input: string }
interface Look { full_width: boolean; small_text: boolean; font: string; toc: boolean; locked: boolean }

const local = (ms: number) => {
  const d = new Date(ms), pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function openPage(page: Page, start: string[], opts: { updated?: string; look?: Partial<Look>; text?: string } = {}) {
  const texts = [...start];
  const calls: Call[] = [];
  const look: Look = { full_width: false, small_text: false, font: 'default', toc: false, locked: false, ...opts.look };
  const kindOf = (t: string) => (/^#{1,3} /.test(t) ? 'heading' : 'paragraph');
  const blocks = () => {
    let pos = TITLE.length + 2;
    return { id: 'w1', folds: [], title: { text: TITLE, start: 0, end: TITLE.length },
      blocks: texts.map((text, i) => { const start = pos; pos += text.length + 2; const k = kindOf(text); return { n: i + 1, kind: k, text, start, end: start + text.length, ...(k === 'heading' ? { level: text.match(/^#+/)![0].length } : {}) }; }) };
  };
  const updated = opts.updated ?? local(Date.now() - 2 * 60_000);
  const full = () => [TITLE, ...texts].join('\n\n');
  const entry = (id: string, title: string) => ({ id, title, kind: 'note', placed: false, label: '', preview: '', updated: '2026-11-20', created: '2026-11-20' });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!.replace(/\.json$/, '');
    const input = decodeURIComponent(route.request().headers()['x-wb-input'] ?? '');
    const send = (json: unknown) => route.fulfill({ json });
    let m: RegExpExecArray | null;
    if (name === 'note-show-w1') return send({ id: 'w1', title: TITLE, kind: 'note', placed: false, text: full(), updated, linked_from: [], also: [], threads: [], refs: [] });
    if (name === 'page-blocks-w1') return send(blocks());
    if (name === 'page-scripture-w1') return send({ blocks: [] });
    if (name === 'page-look-w1') return send({ id: 'w1', ...look });
    if (name.startsWith('page-look-w1-')) {
      calls.push({ name, input });
      if ((m = /^page-look-w1-font-(default|serif)$/.exec(name))) look.font = m[1];
      else if ((m = /^page-look-w1-small-text-(on|off)$/.exec(name))) look.small_text = m[1] === 'on';
      else if ((m = /^page-look-w1-full-width-(on|off)$/.exec(name))) look.full_width = m[1] === 'on';
      else if ((m = /^page-look-w1-toc-(on|off)$/.exec(name))) look.toc = m[1] === 'on';
      return send({ id: 'w1', ...look });
    }
    if ((m = /^page-lock-w1-(on|off)$/.exec(name))) { calls.push({ name, input }); look.locked = m[1] === 'on'; return send({ id: 'w1', ...look }); }
    if (name === 'page-text-w1') { calls.push({ name, input }); return send(opts.text ?? full()); }
    if (name === 'page-link-w1') return send(`[[${TITLE}]]`);
    if (name.startsWith('refs-plain-')) return send([]);
    if ((m = /^block-set-w1-(\d+)/.exec(name))) {
      calls.push({ name, input });
      texts.splice(Number(m[1]) - 1, 1, input);
      return send({ ...blocks(), n: Number(m[1]), count: 1 });
    }
    if (name.startsWith('notebook-sidebar-')) {
      const base = JSON.parse(readFileSync('ui/public/fixtures/wb/notebook-sidebar-at-num-25.json', 'utf8'));
      return send({ ...base, questions: [], pages: [{ id: 'w1', title: TITLE, kind: 'note', placed: false, anchor: '', label: '', color: null, status: null, pinned: null, order: null, parent: null, created: '2026-11-20', updated: '2026-11-20', children: [] }] });
    }
    if (name === 'notebook-group-none') return send({ groups: [{ key: 'all', label: 'All', count: 1, entries: [entry('w1', TITLE)] }] });
    if (name === 'settings-notebook') return send({});
    if (name === 'page-sweep') return send({ operations: [], errors: [] });
    if (name === 'docs-looks') return send({ looks: [] });
    if (name === 'craft-designs') return send({ themes: {}, theme: '' });
    if (name.startsWith('docs-list-')) return send([]);
    if (name === 'template-list') return send({ templates: [] });
    if (name.startsWith('page-overview-')) return send({});
    return route.fallback();
  });
  await page.addInitScript(() => localStorage.setItem('wb.dock.v1', JSON.stringify({ wide: { left: true, right: true } })));
  await page.goto('/?at=NUM.26');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
  await page.waitForSelector('.pane-notebook');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await page.waitForSelector('.nb-block[data-n="1"]');
  return { texts: () => [...texts], calls, look };
}

const block = (page: Page, n: number) => page.locator(`.nb-block[data-n="${n}"]`);
const pageMore = (page: Page) => page.locator('.nb-ed-head .nb-more');
const menuRows = (page: Page, label: string) => page.locator(`.wbm[aria-label="${label}"] .wbm-row .wbm-label`);
const BODY = ['Notes for this part of the lesson.', 'More notes, a second block.'];
const HEADED = ['## Numbers 25', BODY[0], '### The act', BODY[1], '## Psalm 106', BODY[0], '## Questions for Tuesday', BODY[1]];

test('edited_status_updates', async ({ page }) => {
  const s = await openPage(page, BODY);
  // 29: "Edited 2m ago" in the top bar, quiet; no Save button
  const status = page.locator('.nb-ed-head .nb-edited');
  await expect(status).toHaveText('Edited 2m ago');
  await expect(page.locator('.nb-ed-head').getByRole('button', { name: /save/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^save$/i })).toHaveCount(0);
  // typing in a block keeps the page as it goes, and the bar says "Edited just now"
  await block(page, 1).locator('.nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' Added');
  await expect.poll(() => s.texts()[0]).toBe(`${BODY[0]} Added`);
  await expect(status).toHaveText('Edited just now');
  // a page last edited long ago is named by its date
  await expect(status).toHaveCSS('white-space', 'nowrap');
});

test('edited_status_words', async ({ page }) => {
  await openPage(page, BODY, { updated: local(Date.now() - 3 * 3600_000) });
  await expect(page.locator('.nb-ed-head .nb-edited')).toHaveText('Edited 3h ago');
  const gone = await page.evaluate(async () => { const m = await import('/src/pagemenu.ts'); return [m.editedAgo(undefined), m.editedAgo('2026-11-20', Date.parse('2026-11-20T12:00:00')), m.editedAgo('2026-11-18T10:00:00', Date.parse('2026-11-20T12:00:00')), m.editedAgo('2026-11-01T10:00:00', Date.parse('2026-11-20T12:00:00'))]; });
  expect(gone).toEqual(['Edited', 'Edited today', 'Edited 2d ago', 'Edited 2026-11-01']);
});

test('page_menu_items', async ({ page }) => {
  await openPage(page, BODY);
  await pageMore(page).click();
  const menu = page.locator('.wbm[aria-label="Page actions"]');
  await expect(menu).toBeVisible();
  // 30: searchable, in the frame's order
  await expect(menu.locator('.wbm-input')).toBeFocused();
  await expect(menuRows(page, 'Page actions')).toHaveText(['Copy link', 'Copy contents', 'Duplicate', 'Move to', 'Page history', 'Appearance', 'Lock page', 'Move to Trash', /^More/]);
  // the foot: when it was edited, and the word count (the title is not counted; the page's text is)
  await expect(menu.locator('.wbm-foot')).toContainText('Edited 2m ago');
  await expect(menu.locator('.wbm-foot')).toContainText(/\d+ words?/);
  // typing filters; Esc closes
  await page.keyboard.type('lock');
  await expect(menuRows(page, 'Page actions')).toHaveText(['Lock page']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  // Copy link puts the page's [[link]] on the clipboard and says so
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Copy link' }).click();
  await expect(page.locator('.toast')).toHaveText('Link copied');
  // the older page actions are still there, under More
  await pageMore(page).click();
  await page.keyboard.type('template');
  await expect(menuRows(page, 'Page actions')).toHaveText(['Save as a template']);
});

test('appearance_changes_at_once', async ({ page }) => {
  const s = await openPage(page, BODY);
  const ed = page.locator('.nb-editor').first();
  const col = page.locator('.nb-pagecol');
  const titleFont = () => page.locator('.nb-title').evaluate(e => getComputedStyle(e).fontFamily);
  const titleSize = () => page.locator('.nb-title').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  const colWidth = async () => (await col.boundingBox())!.width;
  const base = { font: await titleFont(), size: await titleSize(), width: await colWidth() };
  expect(base.font).not.toContain('Literata');
  // 31: Appearance ▸ opens Font (Default, Serif), Small text, Full width, Table of contents
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Appearance' }).click();
  const menu = page.locator('.wbm[aria-label="Appearance"]');
  await expect(menu.locator('.wbm-group')).toHaveText(['Font']);
  await expect(menuRows(page, 'Appearance')).toHaveText(['Default', 'Serif', 'Small text', 'Full width', 'Table of contents']);
  await expect(menu.locator('.wbm-row', { hasText: 'Default' }).locator('.wbm-hint')).toHaveText('✓');
  // Serif: the page changes at once, the menu stays with its tick moved
  await menu.locator('.wbm-row', { hasText: 'Serif' }).click();
  await expect(ed).toHaveAttribute('data-font', 'serif');
  expect(await titleFont()).toContain('Literata');
  await expect(page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Serif' }).locator('.wbm-hint')).toHaveText('✓');
  // Small text
  await page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Small text' }).click();
  await expect(ed).toHaveAttribute('data-small', '1');
  expect(await titleSize()).toBeLessThan(base.size);
  // Full width: the column takes the pane (the page is never wider than the pane)
  await page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Full width' }).click();
  await expect(ed).toHaveAttribute('data-full', '1');
  await page.keyboard.press('Escape');
  expect(await colWidth()).toBeGreaterThanOrEqual(base.width);
  expect(s.calls.map(c => c.name)).toEqual(['page-look-w1-font-serif', 'page-look-w1-small-text-on', 'page-look-w1-full-width-on']);
  // back to Default and off: the choices are the page's own, so they are read again when the page is opened again
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Appearance' }).click();
  await page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Default' }).click();
  await expect(ed).not.toHaveAttribute('data-font', /./);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__wb.note('w1'));
  await expect(page.locator('.nb-editor').first()).toHaveAttribute('data-small', '1');
  await expect(page.locator('.nb-editor').first()).toHaveAttribute('data-full', '1');
});

test('toc_bar_folds_to_rail', async ({ page }) => {
  const s = await openPage(page, HEADED);
  await expect(page.locator('.nb-toc')).toHaveCount(0);
  // 45: Appearance › Table of contents turns the bar on
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Appearance' }).click();
  await page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Table of contents' }).click();
  expect(s.calls.at(-1)!.name).toBe('page-look-w1-toc-on');
  await expect(page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Table of contents' }).locator('.wbm-hint')).toHaveText('✓');
  await page.keyboard.press('Escape');
  await expect(page.locator('.wbm')).toHaveCount(0);
  const toc = page.locator('.nb-toc');
  await expect(toc).toBeVisible();
  await expect(toc).toHaveAttribute('data-state', 'open');
  await expect(toc.locator('.nb-toc-row')).toHaveText(['Numbers 25', 'The act', 'Psalm 106', 'Questions for Tuesday']);
  await expect(toc.locator('.nb-toc-row.on')).toHaveText('Numbers 25');
  // 45a: in the page's right side, inside its own pane
  const inside = async () => {
    const t = await toc.boundingBox(), e = await page.locator('.nb-editor').first().boundingBox(), p = await page.locator('.pane-notebook').boundingBox();
    if (!t || !e || !p) return false;
    return t.x + t.width <= e.x + e.width + 1 && t.x + t.width <= p.x + p.width + 1 && t.x + t.width / 2 > e.x + e.width / 2;
  };
  expect(await inside()).toBe(true);
  // a click on a heading goes to it and lights it
  await toc.locator('.nb-toc-row', { hasText: 'Psalm 106' }).click();
  await expect(toc.locator('.nb-toc-row.on')).toHaveText('Psalm 106');
  // 45b: the button folds it to a thin rail of ticks (one a heading); the page keeps its column
  const openWidth = (await toc.boundingBox())!.width;
  await toc.getByRole('button', { name: 'Fold the contents to a rail' }).click();
  await expect(toc).toHaveAttribute('data-state', 'rail');
  await expect(toc.locator('.nb-toc-tick')).toHaveCount(4);
  await expect(toc.locator('.nb-toc-row')).toHaveCount(0);
  expect((await toc.boundingBox())!.width).toBeLessThan(openWidth / 4);
  expect(await inside()).toBe(true);
  // a tick goes to its heading; the rail's button opens it again
  await toc.locator('.nb-toc-tick').nth(3).click();
  await toc.getByRole('button', { name: 'Open the contents' }).click();
  await expect(toc).toHaveAttribute('data-state', 'open');
  await expect(toc.locator('.nb-toc-row.on')).toHaveText('Questions for Tuesday');
  // 45c: it stays inside the page's own pane when the pane is narrower (other panes beside it)
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(toc).toBeVisible();
  await expect.poll(inside).toBe(true);
  // off again: no bar
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Appearance' }).click();
  await page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Table of contents' }).click();
  await expect(page.locator('.wbm[aria-label="Appearance"] .wbm-row', { hasText: 'Table of contents' }).locator('.wbm-hint')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.nb-toc')).toHaveCount(0);
});

test('locked_page_does_not_edit', async ({ page }) => {
  const s = await openPage(page, BODY);
  await expect(page.locator('.nb-lock')).toHaveCount(0);
  await expect(block(page, 1).locator('.nb-grip')).toBeAttached();
  // 32: Lock page: a quiet lock in the top bar, the handle hides, typing does nothing
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Lock page' }).click();
  expect(s.calls.at(-1)!.name).toBe('page-lock-w1-on');
  const lock = page.locator('.nb-ed-head .nb-lock');
  await expect(lock).toBeVisible();
  await expect(lock).toHaveAttribute('aria-label', 'Locked');
  await expect(page.locator('.nb-editor').first()).toHaveAttribute('data-locked', '1');
  await expect(block(page, 1).locator('.nb-grip')).toBeHidden();
  await expect(block(page, 1).locator('.nb-plus')).toBeHidden();
  await expect(page.locator('.nb-block-add')).toBeHidden();
  await block(page, 1).locator('.nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
  await page.keyboard.type('Nothing should land here');
  await page.locator('.nb-title').click({ force: true });
  await expect(page.locator('.nb-title-input')).toHaveCount(0);
  expect(s.texts()).toEqual(BODY);
  expect(s.calls.filter(c => c.name.startsWith('block-'))).toEqual([]);
  // the menu offers the way back; unlocked, the page takes typing again
  await pageMore(page).click();
  await expect(menuRows(page, 'Page actions')).toContainText(['Unlock page']);
  await page.locator('.wbm-row', { hasText: 'Unlock page' }).click();
  expect(s.calls.at(-1)!.name).toBe('page-lock-w1-off');
  await expect(page.locator('.nb-lock')).toHaveCount(0);
  await block(page, 1).locator('.nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' Now');
  await expect.poll(() => s.texts()[0]).toBe(`${BODY[0]} Now`);
});

test('locked_page_stays_locked_when_opened_again', async ({ page }) => {
  const s = await openPage(page, BODY, { look: { locked: true } });
  await expect(page.locator('.nb-ed-head .nb-lock')).toBeVisible();
  await block(page, 1).locator('.nb-block-body').click();
  await expect(page.locator('.nb-block-input')).toHaveCount(0);
  expect(s.calls).toEqual([]);
});

test('copy_contents_expands_scripture', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // what `wb page text` gives: the page's Markdown with the scripture block written out in full from the database (the core's own test checks it)
  const text = `# ${TITLE}\n\nWhere the word first appears in this story:\n\n**Numbers 25:11** (KJV)\n> 11 ${verse11}\n\nAfter the passage`;
  const s = await openPage(page, ['Where the word first appears in this story:'], { text });
  await pageMore(page).click();
  await page.locator('.wbm-row', { hasText: 'Copy contents' }).click();
  await expect(page.locator('.toast')).toHaveText('Contents copied');
  expect(s.calls.map(c => c.name)).toContain('page-text-w1');
  // the clipboard holds that text, the verse verbatim, never a stand-in
  if (browserName === 'chromium') {
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip.split('\r\n').join('\n')).toBe(text);
    expect(clip).toContain(verse11);
  }
});
