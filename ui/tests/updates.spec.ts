import { expect, test, type Page } from '@playwright/test';

// design/features/updates, tickets UP1 and UP2 (rows 1 to 8): a newer version is a dot on the Settings gear and one line at
// the top of Settings, never a dialog; Settings has an Updates section. The window reads `wb update status`; outside the
// app that answer comes from a fixture, which these tests serve themselves.
const status = (over: object = {}) => ({
  installed: '0.2.4', self_updating: true, message: null, commit: 'abc1234', look: 'open', looks_by_itself: true,
  last_look: '2026-11-19T08:00:00Z',
  newer: { version: '0.3.0', date: '2026-11-19', size: 84000000, size_text: '84 MB', moved: 'The Trail moved into the rail.', study: 'Nothing in your study folder changes.' },
  ready: 'Bible Workbench 0.3.0 is ready', ...over,
});
const serve = async (page: Page, s: object | null) => {
  await page.unroute('**/fixtures/wb/update-status.json');
  await page.route('**/fixtures/wb/update-status.json', r => (s ? r.fulfill({ json: s }) : r.fulfill({ status: 404, body: 'no' })));
};
const ready = async (page: Page) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
};
const openSettings = async (page: Page) => {
  await page.locator('#more').click();
  await page.locator('.more-menu').getByRole('button', { name: /^Settings/ }).click();
  await expect(page.locator('.set-pane')).toBeVisible();
};
const toUpdates = async (page: Page) => {
  const pane = page.locator('.set-pane');
  const narrow = (await pane.evaluate(el => el.clientWidth)) < 520;
  if (narrow) await pane.getByRole('combobox', { name: 'Settings section' }).selectOption('Updates');
  else await pane.locator('.set-nav').getByRole('button', { name: 'Updates' }).click();
  return narrow;
};
const gear = (page: Page) => page.locator('#rail [data-rail="settings"]');

test('a newer version is one dot on the gear, with its tooltip, and nothing else changes (rows 1, 3)', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'the rail is the desktop');
  await serve(page, null);
  await ready(page);
  await expect(gear(page)).not.toHaveClass(/update-ready/);
  const look = () => page.evaluate(() => ({
    scroll: document.querySelector('#scroller')!.scrollTop,
    selection: String(getSelection()),
    tabs: document.querySelectorAll('.dock-group, .dock-tab, [role="tab"]').length,
    panes: ((window as any).__wb.dock().panes as unknown[]).length,
    layers: document.querySelectorAll('[role="dialog"], [role="alertdialog"], .toast, .sheet, .set-backdrop').length,
    gearBox: JSON.stringify(document.querySelector('#rail [data-rail="settings"]')!.getBoundingClientRect()),
  }));
  const before = await look();
  await serve(page, status());
  await page.evaluate(() => (window as any).__wb.refreshUpdates());
  await expect(gear(page)).toHaveClass(/update-ready/);
  // resting on the gear says what is ready
  await expect(gear(page)).toHaveAttribute('title', 'Bible Workbench 0.3.0 is ready');
  const after = await look();
  expect(after).toEqual(before);
  // the Trail's own dot is another thing
  await expect(page.locator('#rail [data-rail="trail"]')).not.toHaveClass(/update-ready/);
  const dot = await gear(page).evaluate(el => { const c = getComputedStyle(el, '::before'); return { w: c.width, content: c.content }; });
  expect(dot.content).not.toBe('none');
  expect(dot.w).toBe('8px');
  // a version that is no newer, or a copy built from source, has no dot
  await serve(page, status({ newer: null, ready: null }));
  await page.evaluate(() => (window as any).__wb.refreshUpdates());
  await expect(gear(page)).not.toHaveClass(/update-ready/);
  await expect(gear(page)).toHaveAttribute('title', 'Settings');
  await serve(page, status({ self_updating: false, message: 'This copy was built from source (abc1234). It does not update itself.' }));
  await page.evaluate(() => (window as any).__wb.refreshUpdates());
  await expect(gear(page)).not.toHaveClass(/update-ready/);
});

test('Settings shows one line at the top of the other sections, and it opens Updates (row 4)', async ({ page }) => {
  await serve(page, status());
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  const line = pane.locator('.set-upd-line');
  await expect(line).toHaveText('Bible Workbench 0.3.0 is ready');
  // it is the first thing in the body, above the section's heading
  expect(await pane.locator('.set-body > *').first().evaluate(el => el.classList.contains('set-upd-line'))).toBe(true);
  await line.click();
  await expect(pane.locator('.set-heading')).toHaveText('Updates');
  // inside Updates the line is not repeated
  await expect(pane.locator('.set-upd-line')).toHaveCount(0);
});

test('with nothing newer, Settings has no line at the top (row 4)', async ({ page }) => {
  await serve(page, status({ newer: null, ready: null }));
  await ready(page);
  await openSettings(page);
  await expect(page.locator('.set-pane .set-heading')).toHaveText('Reading');
  await expect(page.locator('.set-upd-line')).toHaveCount(0);
});

test('the Updates section holds every part, whole at any width (row 5)', async ({ page }) => {
  await serve(page, status());
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  const narrow = await toUpdates(page);
  const body = pane.locator('.set-body');
  await expect(body.locator('.set-heading')).toHaveText('Updates');
  await expect(body.getByText('Bible Workbench 0.2.4', { exact: true })).toBeVisible();
  await expect(body.locator('.set-row', { hasText: 'Last looked' })).toContainText('2026');
  const look = body.locator('.set-row', { hasText: 'Look for updates' });
  await expect(look.locator('.seg button')).toHaveText(['When the app opens', 'Only when I ask']);
  await expect(look.locator('.seg button.on')).toHaveText('When the app opens');
  await expect(body.getByRole('button', { name: 'Check now' })).toBeVisible();
  await expect(body.locator('.set-upd-sends')).toContainText('sends nothing about you');
  const card = body.locator('.set-upd-card');
  await expect(card).toContainText('Bible Workbench 0.3.0');
  await expect(card).toContainText('2026-11-19');
  await expect(card).toContainText('84 MB');
  await expect(card).toContainText('The Trail moved into the rail.');
  await expect(card).toContainText('Nothing in your study folder changes.');
  // one filled button
  await expect(body.locator('.btn.primary')).toHaveCount(1);
  await expect(card.getByRole('button', { name: 'Install' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'What changed' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Not this version' })).toBeVisible();
  // nothing is cut off sideways, and every part sits inside the pane
  expect(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const box = (await body.boundingBox())!;
  for (const part of [card, body.getByRole('button', { name: 'Check now' }), look]) {
    const b = (await part.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  if (narrow) expect(await look.evaluate(el => getComputedStyle(el).flexDirection)).toBe('column');
});

test('a copy built from source shows only its own line (row 5, U-14)', async ({ page }) => {
  await serve(page, status({ self_updating: false, newer: null, ready: null, message: 'This copy was built from source (abc1234). It does not update itself.' }));
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  await expect(pane.locator('.set-upd-source')).toHaveText('This copy was built from source (abc1234). It does not update itself.');
  await expect(pane.getByRole('button', { name: 'Check now' })).toHaveCount(0);
  await expect(pane.locator('.set-body .seg')).toHaveCount(0);
});

test('Check now looks and says the answer; the setting is saved (rows 6, 8)', async ({ page }) => {
  await serve(page, status({ newer: null, ready: null }));
  const asked: string[] = [];
  await page.route('**/fixtures/wb/update-check.json', r => { asked.push('check'); return r.fulfill({ json: 'Bible Workbench 0.2.4 is the newest' }); });
  await page.route('**/fixtures/wb/settings-updates-ask.json', r => { asked.push('ask'); return r.fulfill({ json: { look: 'ask' } }); });
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  await pane.getByRole('button', { name: 'Check now' }).click();
  await expect(pane.locator('.set-upd-said').first()).toHaveText('Bible Workbench 0.2.4 is the newest');
  await expect.poll(() => asked).toContain('check');
  await serve(page, status({ newer: null, ready: null, look: 'ask' }));
  await pane.locator('.set-row', { hasText: 'Look for updates' }).getByRole('button', { name: 'Only when I ask' }).click();
  await expect(pane.locator('.set-row', { hasText: 'Look for updates' }).locator('.seg button.on')).toHaveText('Only when I ask');
  await expect.poll(() => asked).toContain('ask');
});

// UP3 (rows 9 and 10): What changed, and Not this version.
const rel = (version: string, date: string, over: object = {}) => ({
  version, date, open: false, moved: ['Nothing was moved or removed.'], moved_something: false, new: [`New in ${version}`], changed: [], fixed: [], study: ['Nothing changes in your study folder.'], ...over,
});

test('What changed shows the newest open under its headings in order, plain text only (row 9)', async ({ page }) => {
  await serve(page, status());
  const fetched: string[] = [];
  page.on('request', r => { if (/x\.png|evil/.test(r.url())) fetched.push(r.url()); });
  await page.route('**/fixtures/wb/update-notes-json.json', r => r.fulfill({ json: { releases: [
    rel('0.3.0', '2026-11-19', { open: true, moved: ['<img src="http://evil.test/x.png"> and [a link](http://evil.test/y)'], moved_something: true, new: ['Updates in Settings.'], changed: ['A line changed.'], fixed: ['A thing was fixed.'] }),
  ] } }));
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await card.getByRole('button', { name: 'What changed' }).click();
  const notes = card.locator('.set-upd-notes');
  await expect(notes.locator('.set-upd-heading')).toHaveText(['Moved or removed', 'New', 'Changed', 'Fixed', 'Your study folder']);
  await expect(notes.locator('.set-upd-lines').first()).toHaveText('<img src="http://evil.test/x.png"> and [a link](http://evil.test/y)');
  await expect(notes.locator('img, a')).toHaveCount(0);
  await expect(notes).toContainText('Nothing changes in your study folder.');
  expect(fetched).toEqual([]);
  // one filled button still
  await expect(pane.locator('.set-body .btn.primary')).toHaveCount(1);
  // closing it
  await card.getByRole('button', { name: 'What changed' }).click();
  await expect(notes).toHaveCount(0);
});

test('a release that moved nothing says so, and fourteen behind folds the older ones (rows 9, U14)', async ({ page }) => {
  await serve(page, status());
  const older = Array.from({ length: 13 }, (_, i) => rel(`0.2.${20 - i}`, `2026-10-${String(20 - i).padStart(2, '0')}`, i % 4 === 0 ? { moved: [`Moved thing ${i}`], moved_something: true } : {}));
  await page.route('**/fixtures/wb/update-notes-json.json', r => r.fulfill({ json: { releases: [rel('0.3.0', '2026-11-19', { open: true }), ...older] } }));
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await card.getByRole('button', { name: 'What changed' }).click();
  const notes = card.locator('.set-upd-notes');
  await expect(notes.locator('.set-upd-release.open')).toHaveCount(1);
  await expect(notes.locator('.set-upd-release.open .set-upd-lines').first()).toHaveText('Nothing was moved or removed.');
  await expect(notes.locator('details.folded')).toHaveCount(13);
  // folded to version and date; open, none of the older bodies show
  await expect(notes.locator('details.folded').first().locator('summary')).toContainText('Bible Workbench 0.2.20 (2026-10-20)');
  await expect(notes.locator('details.folded').first().locator('summary')).toContainText('Moved or removed: Moved thing 0');
  await expect(notes.locator('details.folded').nth(1).locator('summary .set-upd-folded-moved')).toHaveCount(0);
  await expect(notes.locator('details.folded[open]')).toHaveCount(0);
  await expect(notes.getByText('New in 0.2.19')).toBeHidden();
  // the list scrolls inside the section
  const box = await notes.evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight, overflow: getComputedStyle(el).overflowY }));
  expect(box.overflow).toBe('auto');
  // a folded release opens to its notes
  await notes.locator('details.folded').nth(1).locator('summary').click();
  await expect(notes.getByText('New in 0.2.19')).toBeVisible();
});

test('Not this version sets the version aside, and the same button puts it back (row 10)', async ({ page }) => {
  await serve(page, status());
  const asked: string[] = [];
  await page.route('**/fixtures/wb/update-skip.json', r => { asked.push('skip'); return r.fulfill({ json: 'set aside' }); });
  await page.route('**/fixtures/wb/update-skip-clear.json', r => { asked.push('clear'); return r.fulfill({ json: 'cleared' }); });
  await ready(page);
  await expect(gear(page)).toHaveClass(/update-ready/);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await serve(page, status({ ready: null, skipped: true }));
  await card.getByRole('button', { name: 'Not this version' }).click();
  await expect.poll(() => asked).toEqual(['skip']);
  // the dot is gone; the version is still listed with Install
  await expect(gear(page)).not.toHaveClass(/update-ready/);
  await expect(pane.locator('.set-upd-card')).toContainText('Bible Workbench 0.3.0');
  await expect(pane.locator('.set-upd-card').getByRole('button', { name: 'Install' })).toBeVisible();
  await serve(page, status());
  await pane.locator('.set-upd-card').getByRole('button', { name: 'Tell me about this version again' }).click();
  await expect.poll(() => asked).toEqual(['skip', 'clear']);
  await expect(gear(page)).toHaveClass(/update-ready/);
});
