// The Shelf as a tree (R2, docs/redesign-R2.md), checked in the real app: run by measure/desk.mjs, or alone by
// measure/shelf.mjs. Everything is compared with what `wb` says and with the files in the desk's own scratch copy.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export async function shelfChecks({ page, check, env, wbExe, study, shots, sleep }) {
  const wbj = (...a) => JSON.parse(execFileSync(wbExe, a, { env }).toString());
  const rows = () => page.locator('.pane-shelf .shelf-row');
  const marked = () => page.locator('.tab.tab-marked').count();
  const flat = t => t.folders.flatMap(f => [f, ...flat(f)]);
  const setFile = id => readFileSync(path.join(study, 'sets', `${id}.md`), 'utf8');

  await page.evaluate(() => { try { localStorage.removeItem('wb.shelf.folded.v1'); } catch { /* none */ } });
  await page.locator('#tb-shelf').click();
  await page.waitForSelector('.pane-shelf .shelf-row', { timeout: 10000 });
  let tree = wbj('shelf');
  const want = flat(tree).reduce((n, f) => n + 1 + f.items.length, 0);
  check('the Shelf draws every folder and item wb shelf has, as a tree', await rows().count() === want, `${await rows().count()} rows, wb shelf ${want}`);
  await page.screenshot({ path: shots + '1440-shelf-tree.png' });

  // Open all (a484): each item where its kind goes, the reader not moved, the tabs marked
  const placeBefore = await page.locator('#place .place-label').textContent();
  const plan = wbj('set', 'open', 'phinehas study');
  const openable = new Set(plan.items.filter(i => i.open && !i.open.startsWith('note|')).map(i => i.open));
  await page.locator('.pane-shelf .shelf-folder[data-folder="phinehas-study"] .shelf-name').click();
  await page.locator('.pane-shelf .shelf-open-all').click();
  await page.waitForFunction(n => document.querySelectorAll('.tab.tab-marked').length >= n, openable.size, { timeout: 20000 }).catch(() => {});
  check('Open all opens every item of the folder as a tab, each carrying the folder’s mark', await marked() === openable.size, `${await marked()} marked, ${openable.size} to open: ${[...openable].join(', ')}`);
  check('Open all does not move the reader (a place opens as a second reader)', (await page.locator('#place .place-label').textContent()) === placeBefore);
  check('a kept interlinear pane (the Python app’s shape) opens as the interlinear', await page.locator('.tab.tab-marked', { hasText: 'Interlinear' }).count() === 1);
  await page.screenshot({ path: shots + '1440-shelf-open-all.png' });
  await page.locator('#tb-shelf').click(); // the tabs it opened are in front of the Shelf now
  await page.locator('.pane-shelf .shelf-close-all').click();
  await sleep(300);
  check('Close all closes exactly the tabs it opened', await marked() === 0);

  // the person's own set of kept word panes: entry, uses, search, interlinear (the same pane twice opens once)
  const ruth = wbj('set', 'open', 'ruth');
  const ruthKeys = new Set(ruth.items.filter(i => i.open).map(i => i.open));
  const said = await page.evaluate(() => window.__wb.run('set open ruth'));
  await page.waitForFunction(n => document.querySelectorAll('.tab.tab-marked').length >= n, ruthKeys.size, { timeout: 30000 }).catch(() => {});
  check('set open in the command field opens a set of kept word panes (Strong’s, every use, search, interlinear)', await marked() === ruthKeys.size && ruth.items.every(i => i.open), `${await marked()} of ${ruthKeys.size}: ${JSON.stringify(said)}`);
  execFileSync(wbExe, ['do', 'set close ruth'], { env });
  await sleep(400);
  check('wb do "set close ruth" closes them from a terminal', await marked() === 0);

  await page.locator('#tb-shelf').click();
  // a new folder, named first: a set file in the Python app's format, its place in settings/shelf.json
  await page.locator('.pane-shelf .shelf-new').click();
  const box = page.locator('.shelf-name-new .field');
  await box.waitFor({ timeout: 5000 });
  await box.fill('Word study: zeal');
  await box.press('Enter');
  await page.waitForSelector('.pane-shelf .shelf-folder[data-folder="word-study-zeal"]', { timeout: 5000 });
  const file = setFile('word-study-zeal');
  check('+ makes a folder, named first: an ordinary set file with only name, created, updated', /^---\nname: "Word study: zeal"\ncreated: "[^"]+"\nupdated: "[^"]+"\n---\n/.test(file), file.slice(0, 120));

  await sleep(800); // the Shelf drawn again after the folder was made
  // dragged onto another folder: inside it
  await page.locator('.shelf-folder[data-folder="word-study-zeal"]').dragTo(page.locator('.shelf-folder[data-folder="phinehas-study"]'), { targetPosition: { x: 120, y: 18 } });
  await sleep(600);
  const placing = () => JSON.parse(readFileSync(path.join(study, 'settings', 'shelf.json'), 'utf8')).folders;
  check('a folder dragged onto another goes inside it (settings/shelf.json)', placing()['word-study-zeal']?.parent === 'phinehas-study', JSON.stringify(placing()['word-study-zeal']));

  // an item dragged onto a folder moves into it; the thing itself is untouched
  const thread = plan.items.find(i => i.kind === 'thread');
  await page.locator(`.shelf-item[data-folder="phinehas-study"][data-key="${thread.key}"]`).dragTo(page.locator('.shelf-folder[data-folder="word-study-zeal"]'), { targetPosition: { x: 120, y: 15 } });
  await sleep(600);
  const zeal = wbj('set', 'show', 'word-study-zeal'), ph = wbj('set', 'show', 'phinehas-study');
  check('an item dragged onto a folder moves into it, and out of the folder it was in', zeal.items.some(i => i.kind === 'thread' && i.ref === thread.ref) && !ph.items.some(i => i.key === thread.key));

  // + Add: a tab that is open, kept in the Python app's shape
  await page.evaluate(() => window.__wb.run('def H7065'));
  await page.waitForSelector('.pane-strong', { timeout: 10000 });
  await page.locator('#tb-shelf').click();
  await page.locator('.pane-shelf .shelf-folder[data-folder="word-study-zeal"] .shelf-name').click();
  await page.locator('.pane-shelf .shelf-add').click();
  await page.locator('.shelf-menu .menu-item', { hasText: 'A tab…' }).click();
  await page.locator('.shelf-choose .menu-item', { hasText: 'H7065' }).first().click();
  await sleep(600);
  const kept = wbj('set', 'show', 'word-study-zeal').items.find(i => i.kind === 'pane');
  check('+ Add → A tab keeps it as the Python app keeps a pane ({type: entry, params: {sid}})', kept?.type === 'entry' && kept.params?.sid === 'H7065', JSON.stringify(kept));

  // F2 renames; Del takes an item out (not deleted)
  await page.locator('.pane-shelf .shelf-folder[data-folder="word-study-zeal"] .shelf-name').click();
  await page.keyboard.press('F2');
  await page.locator('.pane-shelf .shelf-rename').fill('Zeal');
  await page.keyboard.press('Enter');
  await sleep(500);
  check('F2 renames a folder (its set file keeps its id)', wbj('set', 'show', 'word-study-zeal').name === 'Zeal');

  // Find
  await page.locator('.pane-shelf .shelf-find').fill('interlinear');
  await sleep(200);
  const found = await page.locator('.pane-shelf .shelf-item').allTextContents();
  check('Find in the Shelf keeps only what matches, with its folders', found.length > 0 && found.every(t => /interlinear/i.test(t)), found.join(' | '));
  await page.locator('.pane-shelf .shelf-find').fill('');

  // removing a folder: to .trash, the folders inside move up
  page.once('dialog', d => d.accept());
  await page.locator('.pane-shelf .shelf-folder[data-folder="phinehas-study"]').click({ button: 'right' });
  await page.locator('.shelf-menu .menu-item', { hasText: 'Remove the folder' }).click();
  await sleep(600);
  tree = wbj('shelf');
  check('a folder removed goes to .trash and the folder inside it moves up a level', !existsSync(path.join(study, 'sets', 'phinehas-study.md')) && readdirSync(path.join(study, '.trash')).some(f => f.includes('phinehas-study')) && tree.folders.some(f => f.id === 'word-study-zeal'));

  // the Python app still reads every set as before (the nesting is apart, in settings/)
  const py = 'C:/Users/brady/github/bible-workbench';
  if (existsSync(py)) {
    const out = JSON.parse(execFileSync('python', ['-I', '-c', `import sys, json; sys.path.insert(0, r'${py}'); from pathlib import Path; from workbench.study import Study; st = Study(Path(r'${study}')); print(json.dumps(sorted([t['id'], len(t['items'])] for t in st.sets())))`]).toString());
    const ours = wbj('set', 'list').map(t => [t.id, t.items.length]).sort();
    check('the Python app reads every folder as a set with the same items', JSON.stringify(out) === JSON.stringify(ours), `${JSON.stringify(out)} | ${JSON.stringify(ours)}`);
  }
}
