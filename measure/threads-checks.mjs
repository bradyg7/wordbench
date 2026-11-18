// The desk lines of design/features/threads (run inside measure/desk.mjs on its scratch study; never the real folder):
// "The reader's place is kept" and the line on the text in the real window. Scripture is read from the screen and
// compared with `wb text`, never typed.
import { execFileSync } from 'node:child_process';

export async function threadChecks({ page, check, env, wbExe, sleep }) {
  const wb = (...a) => execFileSync(wbExe, a, { env }).toString();
  wb('thread', 'new', 'Desk folder', '--color', 'blue');
  wb('thread', 'add', 'Desk folder', 'Num 25:11');
  wb('thread', 'add', 'Desk folder', 'Josh 22:13');
  await page.evaluate(() => window.__wb.open('NUM', 25, 11));
  await sleep(700);
  const top = () => page.evaluate(() => document.querySelector('#place .place-label')?.textContent);
  const placeBefore = await top();
  const scrollBefore = await page.evaluate(() => document.querySelector('#reader')?.scrollTop ?? 0);
  check('a folder with a color draws its saved verse as a mark by the number, words not underlined', await page.locator('.vn.vth[data-v="11"]').count() === 1 && await page.locator('.w[data-k]:not([title])[style*="linear-gradient"]').count() === 0);
  await page.evaluate(() => window.__wb.run('folder show Desk folder'));
  await sleep(500);
  await page.evaluate(() => window.__wb.run('open Josh 22:13'));
  await sleep(500);
  await page.keyboard.press('Escape');
  check('opening the folder and a save in it and going back keeps the reader at Numbers 25:11, same scroll', (await top()) === placeBefore && Math.abs((await page.evaluate(() => document.querySelector('#reader')?.scrollTop ?? 0)) - scrollBefore) < 4, `${await top()} / ${placeBefore}`);
  wb('folder', 'shown', 'Desk folder', 'off');
  await page.evaluate(() => window.__wb.refreshMarks?.());
  await sleep(500);
  check('an eye turned off draws nothing and stays off in the study settings', await page.locator('.vn.vth').count() === 0 && JSON.parse(wb('folder', 'shown')).every(f => f.shown === false));
  wb('folder', 'shown', '--all');
}
