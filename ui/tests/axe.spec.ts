import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// DESIGN_STANDARDS.md: WCAG 2.2 AA, checked by axe on the reader at desktop and at phone size. The two projects
// (webkit-desktop, webkit-phone) give the two sizes. Any violation fails, except the ones named in KNOWN: each entry
// is "<project> <rule id> <target>", exists only until the UI is fixed, and the list may only shrink (a new entry
// needs the person's go-ahead). A fixed one must be removed here too, so the list cannot go stale. A margin note's id
// is replaced by "ID" in a target because it is made when the fixture is read.
// Found 2026-11-23 when axe was added (the UI is not fixed in that ticket): the place box's visible text is not at
// the start of its accessible name, and the same for the margin note's edit button.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const KNOWN: string[] = [
  'webkit-phone label-content-name-mismatch #place',
  'webkit-desktop label-content-name-mismatch #place',
  'webkit-desktop label-content-name-mismatch div[data-note="ID"] > .mg-body[role="button"][aria-label="Edit the margin note"]',
];

test('the_reader_has_no_wcag_22_aa_violations', async ({ page }, info) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = violations.flatMap((v) => v.nodes.map((n) => `${info.project.name} ${v.id} ${n.target.join(' ').replace(/data-note="[^"]*"/, 'data-note="ID"')}`));
  const fresh = found.filter((f) => !KNOWN.includes(f));
  expect(fresh, 'new accessibility violations').toEqual([]);
  const gone = KNOWN.filter((k) => k.startsWith(info.project.name + ' ') && !found.includes(k));
  expect(gone, 'fixed: remove these from KNOWN').toEqual([]);
});
