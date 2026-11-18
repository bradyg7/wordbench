// The desk lines of design/features/reading-plans (run inside measure/desk.mjs on its scratch study; never the real folder):
// RP-20, "marks a part, reads on from the strip, and sees the counter", and RP-21, the reader's place kept by Read, the strip,
// Mark read · next and Reading. Scripture is never typed; the places are read from the screen.
import { execFileSync } from 'node:child_process';

export async function readingPlansChecks({ page, check, env, wbExe, sleep }) {
  const wb = (...a) => execFileSync(wbExe, a, { env }).toString();
  const json = (...a) => JSON.parse(wb(...a));
  const where = () => page.evaluate(() => ({ place: document.querySelector('#place .place-label')?.textContent, top: window.__wb.drawn ? document.querySelector('#reader')?.scrollTop : 0 }));

  // a plan three days behind (it started on a day far enough back), with days of Numbers
  const start = new Date(Date.now() - 3 * 86400000).toLocaleDateString('en-CA');
  wb('plan', 'start', 'Desk reading', '--books', 'Num', '--days', '30', '--start', start);
  wb('read', 'mark', 'Num 25:1-5', '--plan', 'desk-reading');
  await page.evaluate(() => window.__wb.open('NUM', 25, 1));
  await sleep(700);

  // a part: Mark read to here in a verse's right click, a thin line in the margin, the counter in the pane
  await page.locator('.vn[data-v="9"]').click({ button: 'right' });
  await page.locator('.verse-menu [data-act="read-to-here"]').click();
  await sleep(600);
  const times = json('read', 'times', 'Num 25')['NUM.25'];
  check('Mark read to here in the verse right click writes a part line and the margin line follows (RP-16)', times?.read_to === 9 && times.whole === false && await page.locator('.vn.vread-run').count() === 9, JSON.stringify(times));

  await page.evaluate(() => window.__wb.run('plans'));
  await page.waitForSelector('.pane-plans .plan-card', { timeout: 10000 });
  const line = await page.locator('.pane-plans .plan-where').first().innerText();
  check('the counter says how many days behind, quietly (RP-17)', /\d+ days? behind/.test(line) && await page.locator('.pane-plans .plan-choices, .pane-plans .plan-missed').count() === 0, line);

  // Read opens the day with the strip; the reader goes to the first reading not yet read
  const before = await where();
  await page.locator('.pane-plans [data-act="read"]').first().click();
  await page.waitForSelector('#planstrip .plan-strip-chip', { timeout: 10000 });
  await sleep(600);
  const strip = await page.locator('#planstrip .plan-strip-label').innerText();
  check('Read opens the day in the reader with the strip under the bar (RP-12)', /Desk reading · Day \d+/.test(strip) && await page.locator('#planstrip .plan-strip-chip').count() > 0, strip);

  // read on from the strip: Mark read · next
  const chip = await page.locator('#planstrip .plan-strip-chip.open').first().innerText().catch(() => '');
  const next = page.locator('.plan-end .plan-end-next');
  await next.waitFor({ timeout: 10000 }).catch(() => {});
  const had = await next.count();
  if (had) {
    const asked = await next.innerText();
    const placeBefore = (await where()).place;
    await next.click();
    await sleep(800);
    const after = await where();
    check('Mark read · next marks the reading and opens the next one (RP-13)', /next:/.test(asked) && after.place !== placeBefore && json('read', 'progress').chapters >= 1, `${chip} → ${after.place}`);
  } else {
    check('Mark read · next marks the reading and opens the next one (RP-13)', false, 'the end card did not come');
  }

  // the reader's place is kept (RP-21): the strip's chip, Reading and back
  await page.evaluate(() => window.__wb.open('NUM', 25, 11));
  await sleep(700);
  const at = await where();
  await page.evaluate(() => window.__wb.run('plans'));
  await page.locator('.pane-plans [data-act="reading"]').click();
  await page.waitForSelector('.pane-reading .rd-map', { timeout: 10000 });
  await page.locator('.pane-reading [data-act="plan"]').click();
  await sleep(500);
  const kept = await where();
  check('Reading and ‹ Plan leave the reader on the verse it was on (RP-21)', kept.place === at.place && Math.abs(kept.top - at.top) < 4, `${at.place} ${at.top} / ${kept.place} ${kept.top}`);
  void before;

  // clean up what this made in the scratch copy
  wb('plan', 'rm', 'desk-reading');
}
