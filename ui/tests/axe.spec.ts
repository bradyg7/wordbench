import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// DESIGN_STANDARDS.md: WCAG 2.2 AA, checked by axe on the reader at desktop and at phone size (the two projects).
// Any violation fails, except the ones named in KNOWN: they exist only until the UI is fixed, the list may only
// shrink (a new entry needs the person's go-ahead), and a fixed one must be removed so the list cannot go stale.
// A margin note's id is made when the fixture is read, so a target shows it as "ID".
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
type Known = { project: string; rule: string; target: string };
const NOTE_EDIT = 'div[data-note="ID"] > .mg-body[role="button"][aria-label="Edit the margin note"]';
const KNOWN: Known[] = [
  { project: 'webkit-phone', rule: 'label-content-name-mismatch', target: '#place' },
  { project: 'webkit-desktop', rule: 'label-content-name-mismatch', target: '#place' },
  { project: 'webkit-desktop', rule: 'label-content-name-mismatch', target: NOTE_EDIT },
];
const same = (a: Known, b: Known) => a.project === b.project && a.rule === b.rule && a.target === b.target;

test('the_reader_has_no_wcag_22_aa_violations', async ({ page }, info) => {
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as unknown as { __wbReady?: unknown }).__wbReady);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found: Known[] = violations.flatMap((v) => v.nodes.map((n) => ({
    project: info.project.name,
    rule: v.id,
    target: n.target.join(' ').replace(/data-note="[^"]*"/g, 'data-note="ID"'),
  })));
  const fresh = found.filter((f) => !KNOWN.some((k) => same(k, f)));
  expect(fresh, 'new accessibility violations').toEqual([]);
  const gone = KNOWN.filter((k) => k.project === info.project.name && !found.some((f) => same(k, f)));
  expect(gone, 'fixed: remove these from KNOWN').toEqual([]);
});
