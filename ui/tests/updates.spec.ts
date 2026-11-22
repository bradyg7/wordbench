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

// UP4 (rows 11 to 15): Install downloads in the background, the ring on the gear, Stop, the stopped and refused words, and
// the two buttons once the file is whole and signed. The shell is not here: outside the app Install, Stop and the status
// come from fixtures these tests serve themselves.
const download = (over: object = {}) => ({
  version: '0.3.0', state: 'downloading', got: 31_000_000, total: 84_000_000, got_text: '31 MB', total_text: '84 MB', fraction: 31 / 84, message: '', seen: false, ...over,
});

test('Install starts the download and returns; the gear shows a ring that fills and Settings can be closed (row 11)', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'the rail is the desktop');
  await serve(page, status());
  const asked: string[] = [];
  await page.route('**/fixtures/wb/update-install.json', r => { asked.push('install'); return r.fulfill({ json: '' }); });
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await expect(card.getByRole('button', { name: 'Install' })).toBeVisible();
  await serve(page, status({ ring: 31 / 84, download: download() }));
  await card.getByRole('button', { name: 'Install' }).click();
  await expect.poll(() => asked).toEqual(['install']);
  // the section says how far, and that reading goes on; the one button is Stop
  await expect(card.locator('.set-upd-said')).toHaveText('Downloading 31 MB of 84 MB. You can close Settings and keep reading.');
  await expect(card.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Install' })).toHaveCount(0);
  expect(await card.locator('progress').evaluate((el: HTMLProgressElement) => el.value)).toBeCloseTo(31 / 84, 2);
  // Settings closed: the dot became a ring that fills, and the reader is as it was
  await page.keyboard.press('Escape');
  await expect(page.locator('.set-pane')).toHaveCount(0);
  await expect(gear(page)).toHaveClass(/update-ring/);
  expect(await gear(page).evaluate(el => el.style.getPropertyValue('--ring'))).toBe(String(31 / 84));
  await expect(gear(page)).toHaveAttribute('title', 'Downloading Bible Workbench 0.3.0: 31 MB of 84 MB');
  // it fills as the status is read again
  await serve(page, status({ ring: 0.9, download: download({ got: 75_600_000, got_text: '76 MB', fraction: 0.9 }) }));
  await page.evaluate(() => (window as any).__wb.refreshUpdates());
  expect(await gear(page).evaluate(el => el.style.getPropertyValue('--ring'))).toBe('0.9');
  // the reader is as it was while it runs
  await expect(page.locator('#reader')).toContainText('Numbers');
});

test('Stop gives the download up and the dot returns (row 12)', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'the rail is the desktop');
  await serve(page, status({ ring: 0.4, download: download() }));
  const asked: string[] = [];
  await page.route('**/fixtures/wb/update-stop.json', r => { asked.push('stop'); return r.fulfill({ json: 'The download was stopped.' }); });
  await ready(page);
  await expect(gear(page)).toHaveClass(/update-ring/);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  await serve(page, status());
  await pane.locator('.set-upd-card').getByRole('button', { name: 'Stop' }).click();
  await expect.poll(() => asked).toEqual(['stop']);
  await expect(pane.locator('.set-upd-card').getByRole('button', { name: 'Install' })).toBeVisible();
  await expect(pane.locator('.set-upd-card .set-upd-said')).toHaveText('The download was stopped.');
  await expect(gear(page)).not.toHaveClass(/update-ring/);
  await expect(gear(page)).toHaveClass(/update-ready/);
});

test('a download that stopped says where, with Try again; the gear keeps its dot (row 13)', async ({ page }) => {
  const words = 'The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench 0.2.4 works as it is.';
  await serve(page, status({ failure: words, download: download({ state: 'stopped', message: words }) }));
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await expect(card.locator('.set-upd-said')).toHaveText(words);
  await expect(card.locator('.set-upd-said')).toHaveClass(/error/);
  await expect(card.getByRole('button', { name: 'Try again' })).toBeVisible();
  // the setting, Check now and the line of U-4 stay through the failure
  await expect(pane.getByRole('button', { name: 'Check now' })).toBeVisible();
  await expect(pane.locator('.set-upd-sends')).toBeVisible();
  await expect(pane.locator('.set-body .btn.primary')).toHaveCount(1);
});

test('a refused update says so in the words, and nothing installs it anyway (row 14)', async ({ page }) => {
  const words = 'This update was not installed: it was not signed by Bible Workbench. Nothing was changed.';
  await serve(page, status({ failure: words, download: download({ state: 'refused', message: words, got: 0 }) }));
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await expect(card.locator('.set-upd-said')).toHaveText(words);
  for (const name of ['Install', 'Try again', 'Restart now', 'When I close the app']) await expect(card.getByRole('button', { name })).toHaveCount(0);
  await expect(pane.locator('.set-body .btn.primary')).toHaveCount(0);
});

test('a failure keeps the gear lit until Updates is opened (row 13)', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'the rail is the desktop');
  const words = 'The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench 0.2.4 works as it is.';
  const failed = status({ newer: null, ready: null, dot: words, failure: words, download: download({ state: 'stopped', message: words }) });
  await serve(page, failed);
  const asked: string[] = [];
  await page.route('**/fixtures/wb/update-status-seen.json', r => { asked.push('seen'); return r.fulfill({ json: { ...failed, dot: null, download: download({ state: 'stopped', message: words, seen: true }) } }); });
  await ready(page);
  await expect(gear(page)).toHaveClass(/update-ready/);
  await expect(gear(page)).toHaveAttribute('title', words);
  await openSettings(page);
  await toUpdates(page);
  await expect.poll(() => asked).toEqual(['seen']);
});

test('once the file is whole and checked, Restart now (filled) and When I close the app (row 15)', async ({ page }) => {
  await serve(page, status({ download: download({ state: 'ready', got: 84_000_000, fraction: 1 }) }));
  await ready(page);
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await expect(card.getByRole('button', { name: 'Restart now' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'When I close the app' })).toBeVisible();
  await expect(pane.locator('.set-body .btn.primary')).toHaveCount(1);
  await expect(card.locator('.btn.primary')).toHaveText('Restart now');
  await expect(card.getByRole('button', { name: 'Install' })).toHaveCount(0);
  await expect(card.locator('progress')).toBeHidden();
  // the same, whole at phone width
  const box = (await pane.locator('.set-body').boundingBox())!;
  for (const name of ['Restart now', 'When I close the app']) {
    const b = (await card.getByRole('button', { name }).boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  // choosing When I close the app says what happens and changes nothing else
  await card.getByRole('button', { name: 'When I close the app' }).click();
  await expect(card.locator('.set-upd-said')).toHaveText('Bible Workbench will install it when you close the app.');
  await expect(card.getByRole('button', { name: 'Restart now' })).toBeVisible();
});

// UP5 (rows 16 to 19): Restart now saves first and keeps what the window was, the case where a page cannot be saved, When I
// close the app, and the section after an update. The shell's restart itself is not here (no Tauri): what is checked is
// the window's side, with its storage and a reload standing for the restart.
const readyDownload = () => status({ download: { version: '0.3.0', state: 'ready', got: 84_000_000, total: 84_000_000, got_text: '84 MB', total_text: '84 MB', fraction: 1, message: '', seen: false } });

test('Restart now with a page that cannot be saved does not restart and says which (row 17)', async ({ page }) => {
  await serve(page, readyDownload());
  await ready(page);
  await page.evaluate(async () => {
    const m = await import('/src/pagewriters.ts');
    const wrap = document.createElement('div');
    wrap.id = 'fake-editor';
    wrap.innerHTML = '<div class="nb-title">Phinehas</div><textarea id="fake-ta">a sentence typed a moment ago</textarea>';
    document.body.append(wrap);
    m.registerPageWriter(wrap.querySelector('textarea')!, 'phinehas', async () => { throw new Error('The page file could not be written'); }, () => {});
  });
  await openSettings(page);
  const pane = page.locator('.set-pane');
  await toUpdates(page);
  const card = pane.locator('.set-upd-card');
  await card.getByRole('button', { name: 'Restart now' }).click();
  await expect(card.locator('.set-upd-said')).toHaveText('Phinehas could not be saved, so Bible Workbench was not restarted. 0.3.0 is still waiting.');
  await expect(card.locator('.set-upd-said')).toHaveClass(/error/);
  // the same two buttons, and the writing is still in the editor
  await expect(card.getByRole('button', { name: 'Restart now' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'When I close the app' })).toBeVisible();
  await expect(page.locator('#fake-ta')).toHaveValue('a sentence typed a moment ago');
});

test('what the window was is kept for the start after a restart, and used once (row 16)', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'panes and floating tabs are the desktop');
  await serve(page, readyDownload());
  await ready(page);
  await page.evaluate(() => { (window as any).__wb.concordance({ strong: 'H7068' }); (window as any).__wb.concordance({ strong: 'H7069' }); });
  await expect.poll(() => page.evaluate(() => (window as any).__wb.dock().panes.filter((p: any) => p.kind === 'concordance').length)).toBe(2);
  await page.locator('#cmd').fill('open John 3');
  const before = await page.evaluate(() => {
    const d = (window as any).__wb.dock();
    return { keys: d.panes.map((p: any) => p.key).filter((k: string) => k !== 'settings').sort() };
  });
  await page.evaluate(async () => { const m = await import('/src/updates.ts'); m.restartHooks.capture(); });
  expect(await page.evaluate(() => localStorage.getItem('wb.restart.v1') !== null)).toBe(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__wbReady);
  await expect(page.locator('#cmd')).toHaveValue('open John 3');
  await expect.poll(() => page.evaluate(() => (window as any).__wb.dock().panes.map((p: any) => p.key).filter((k: string) => k !== 'settings').sort())).toEqual(before.keys);
  // Settings is not reopened, and the kept window is used once
  await expect(page.locator('.set-pane')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('wb.restart.v1'))).toBeNull();
});

test('after an update the section says so, with its notes, and nothing is over the reader (row 19)', async ({ page }, info) => {
  const today = new Date().toISOString().slice(0, 10);
  await serve(page, status({ newer: null, ready: null, dot: null, installed: '0.3.0', updated: { from: '0.2.4', on: today } }));
  await page.route('**/fixtures/wb/update-notes-0-3-0-json.json', r => r.fulfill({ json: { releases: [rel('0.3.0', today, { open: true, new: ['Updates in Settings.'] })] } }));
  await ready(page);
  await expect(page.locator('[role="dialog"], .toast, .sheet')).toHaveCount(0);
  await openSettings(page);
  await toUpdates(page);
  const pane = page.locator('.set-pane');
  await expect(pane.locator('.set-upd-after .set-name')).toHaveText('You have 0.3.0, updated today from 0.2.4');
  await pane.locator('.set-upd-after').getByRole('button', { name: 'What changed' }).click();
  await expect(pane.locator('.set-upd-after .set-upd-notes')).toContainText('Updates in Settings.');
  if (info.project.name !== 'webkit-phone') await expect(gear(page)).not.toHaveClass(/update-ready/);
});

// UP6 (rows 20 and 21): Go back, and the copy built from source.
test('after an update the section offers Go back to the version before, and not when none is kept (row 20)', async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  await serve(page, status({ newer: null, ready: null, dot: null, installed: '0.3.0', updated: { from: '0.2.4', on: today }, back: '0.2.4' }));
  await ready(page);
  await openSettings(page);
  await toUpdates(page);
  const after = page.locator('.set-pane .set-upd-after');
  await expect(after.getByRole('button', { name: 'Go back to 0.2.4' })).toBeVisible();
  // outside the app it cannot restart, and says so without changing anything
  await after.getByRole('button', { name: 'Go back to 0.2.4' }).click();
  await expect(after.locator('.set-upd-said')).toHaveText('Going back works in the app.');
  // the notes say the study folder was moved forward: no Go back
  await serve(page, status({ newer: null, ready: null, dot: null, installed: '0.3.0', updated: { from: '0.2.4', on: today }, back: null, back_refused: 'Going back to 0.2.4 is not offered' }));
  await page.evaluate(() => (window as any).__wb.refreshUpdates());
  await page.keyboard.press('Escape');
  await openSettings(page);
  await toUpdates(page);
  await expect(page.locator('.set-pane .set-upd-after')).toBeVisible();
  await expect(page.getByRole('button', { name: /Go back/ })).toHaveCount(0);
});

// U-1: the notice sits on the rail's Settings gear, so Settings is drawn as a gear (0.3.0 still drew the sliders)
test('Settings on the rail is a gear, not the sliders (U-1)', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit-phone', 'the rail is the desktop');
  await serve(page, null);
  await ready(page);
  const d = await gear(page).locator('svg path').getAttribute('d');


  expect(d).not.toBe('M2.5 5h7M12 5h1.5M2.5 11h1.5M7 11h6.5M10 3.5v3M5 9.5v3');
  expect(d).toContain('a2.2 2.2');
});
