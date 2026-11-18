// The desk lines of design/features/reading-plans (run inside measure/desk.mjs on its scratch study; never the real folder):
// RP-20, "marks a part, reads on from the strip, and sees the counter", and RP-21, the reader's place kept by Read, the strip,
// Mark read · next and Reading. Scripture is never typed; the places are read from the screen.
//   node measure/desk.mjs --reading-plans    runs only these
import { execFileSync } from 'node:child_process';

export async function readingPlansChecks({ page, check, env, wbExe, sleep }) {
  const wb = (...a) => execFileSync(wbExe, a, { env }).toString();
  const json = (...a) => JSON.parse(wb(...a));
  const where = () => page.evaluate(() => ({ place: document.querySelector('#place .place-label')?.textContent, top: document.querySelector('#scroller')?.scrollTop ?? 0 }));
  const goto = async (code, ch, v) => { await page.evaluate(([c, n, x]) => window.__wb.open(c, n, x), [code, ch, v]); await sleep(800); };
  const books = json('books').books;
  const nameOf = e => `${books.find(b => b.code === e.split('.')[0]).name} ${e.split('.')[1]}`;

  // a plan three days behind: Numbers, a chapter a day
  const start = new Date(Date.now() - 3 * 86400000).toLocaleDateString('en-CA');
  wb('plan', 'start', 'Desk reading', '--books', 'Num', '--days', '12', '--start', start);
  const day = json('plan', 'today', 'desk-reading').plans[0].to_read.at(-1); // today's day: its readings
  const first = day.entries[0];
  const [code, chapter] = [first.split('.')[0], +first.split('.')[1]];

  // a part: Mark read to here in a verse's right click, a thin line in the margin
  await goto(code, chapter, 1);
  await page.locator('.vn[data-v="9"]').click({ button: 'right' });
  await page.locator('.verse-menu [data-act="read-to-here"]').click();
  await sleep(700);
  const times = Object.values(json('read', 'times', `${code} ${chapter}`))[0];
  check('Mark read to here in the verse right click writes a part line and the margin line follows (RP-16)', times?.read_to === 9 && times.whole === false && await page.locator('.vn.vread-run').count() === 9, JSON.stringify(times));

  // the counter, quietly
  await page.evaluate(() => window.__wb.plans());
  await page.waitForSelector('.pane-plans .plan-card', { timeout: 10000 });
  const card = page.locator('.pane-plans .plan-card', { hasText: 'Desk reading' });
  const line = await card.locator('.plan-where').innerText();
  check('the counter says how many days behind, quietly, with no choices (RP-17)', /\d+ days? behind/.test(line) && await page.locator('.pane-plans .plan-choices, .pane-plans .plan-missed').count() === 0, line);
  check('the checklist says where the part stopped (RP-15)', /read to v\. 9/.test(await card.locator('.plan-check', { hasText: nameOf(first) }).first().innerText()));

  // Read opens the day: the reader goes to the first reading not yet read, and the strip is there
  await goto('GEN', 1, 1);
  await card.locator('[data-act="read"]').click();
  await page.waitForSelector('#planstrip .plan-strip-chip', { timeout: 10000 });
  await sleep(900);
  const strip = await page.locator('#planstrip .plan-strip-label').innerText();
  const opened = (await where()).place;
  check('Read opens the day in the reader at its first reading with the strip under the bar (RP-12)', /Desk reading · Day \d+/.test(strip) && opened === nameOf(first), `${strip} · ${opened} (wanted ${nameOf(first)})`);

  // read on from the strip: Mark read · next marks the reading and arrives at the next one
  const next = page.locator('.plan-end .plan-end-next');
  await next.waitFor({ timeout: 15000 }).catch(() => {});
  if (await next.count()) {
    const asked = await next.innerText();
    const wantNext = asked.replace(/^.*next:\s*/, '');
    await next.click();
    await sleep(900);
    const after = (await where()).place;
    const marked = json('read', 'times', `${code} ${chapter}`)[`${code}.${chapter}`]?.whole;
    check('Mark read · next marks the reading and arrives at the next one (RP-13)', marked === true && after === wantNext, `${asked} → ${after}`);
  } else {
    check('Mark read · next marks the reading and arrives at the next one (RP-13)', false, 'the end card did not come (does this day have one reading?)');
  }

  // a strip chip returns to its reading
  const chip = page.locator('#planstrip .plan-strip-chip').first();
  const chipPlace = nameOf(await chip.getAttribute('data-entry'));
  await goto('GEN', 1, 1);
  await chip.click();
  await sleep(900);
  const atChip = await where();
  check('a click on the strip’s chip goes to that reading (RP-12)', atChip.place === chipPlace, `${atChip.place} / ${chipPlace}`);

  // the reader's place is kept (RP-21): Reading and ‹ Plan leave the reader on the verse it was on
  await goto('NUM', 25, 11);
  const at = await where();
  await page.evaluate(() => window.__wb.plans());
  await page.locator('.pane-plans [data-act="reading"]').click();
  await page.waitForSelector('.pane-reading .rd-map', { timeout: 10000 });
  await page.locator('.pane-reading [data-act="plan"]').click();
  await sleep(500);
  const kept = await where();
  check('Reading and ‹ Plan leave the reader on the verse it was on (RP-21)', kept.place === at.place && Math.abs(kept.top - at.top) < 4, `${at.place} ${at.top} / ${kept.place} ${kept.top}`);

  wb('plan', 'rm', 'desk-reading'); // clean up what this made in the scratch copy
}
