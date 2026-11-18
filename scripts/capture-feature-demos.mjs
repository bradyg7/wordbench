// Guided UI recordings: real pointer/keyboard input and real Rust actions.
import { recordScenarios } from './demo-recorder.mjs';
const scenarios = {
  'reading-navigation': async (p, u) => {
    await u.caption('Choose a chapter from the reader');
    await u.click(p.locator('#place'));
    await u.click(p.getByRole('button', { name: '2', exact: true }));
    await u.pause(1800);
    await u.click(p.getByRole('button', { name: 'Previous chapter', exact: true }));
    await u.caption('Find a word within this chapter');
    await p.keyboard.press('Control+f');
    await u.type(p.getByPlaceholder('Find in this chapter'), 'John');
    await u.pause(2200);
    await u.shot();
    await p.keyboard.press('Escape');
    await u.caption('Switch translations without leaving the passage');
    await u.click(p.locator('#tb-version'));
    await u.pause(2500);
    await u.click(p.locator('#tb-version'));
  },
  'word-study': async (p, u) => {
    await u.caption('Click a word to open its source entry');
    await u.click(p.locator('#reader .w').nth(5));
    await u.pause(2800);
    await u.shot();
    await u.caption('Explore every occurrence');
    await u.click(p.getByRole('button', { name: 'Every use', exact: true }));
    await u.pause(2200);
    await u.scroll(p.locator('.pane-uses'), 320);
    await u.pause(2200);
  },
  'highlighting': async (p, u) => {
    await u.caption('Drag across the words you want to mark');
    await u.drag(p.locator('#reader .w').nth(0), p.locator('#reader .w').nth(5));
    await u.pause(1100);
    await u.click(p.getByRole('button', { name: 'yellow', exact: true }));
    await u.pause(1700);
    await u.shot();
    await u.caption('The highlight stays when you return');
    await u.click(p.locator('#next'));
    await u.pause(1300);
    await u.click(p.locator('#prev'));
    await u.pause(2000);
    if (!await p.locator('#reader .w.hl').count() && !await p.locator('#reader [class*="yellow"]').count()) {
      const marks = await u.backend.run(['reader', 'JHN', '1']);
      if (!marks.marks.highlights.length) throw new Error('Highlight was not saved');
    }
  },
  'pages': async (p, u) => {
    await u.caption('Open the notebook and make a page');
    await u.click(p.getByRole('button', { name: 'Notebook', exact: true }));
    await u.click(p.getByRole('button', { name: 'A new page', exact: true }).first());
    if (await p.getByRole('button', { name: 'Make the page', exact: true }).isVisible()) await u.click(p.getByRole('button', { name: 'Make the page', exact: true }));
    await u.caption('Write your own title and notes');
    await u.type(p.locator('textarea.nb-input'), '# Reading workspace\n\nA sample page for collecting references.\n\n- Revisit this chapter\n- Keep related passages together');
    await u.pause(1600);
    await u.click(p.locator('.nb-title'));
    await p.keyboard.press('Escape');
    await u.pause(1200);
    await u.shot();
    await u.caption('Return to the notebook to find the saved page');
    await u.click(p.locator('.nb-back'));
    await u.pause(1600);
    const target = p.locator('.nb-item, .nb-tree-row').filter({ hasText: 'Reading workspace' }).first();
    if (await target.isVisible()) await u.click(target);
    await u.pause(1800);
  },
  'parallel-reading': async (p, u) => {
    await u.caption('Keep a passage in a second reading pane');
    await u.click(p.locator('#reader .vn[data-v="1"]'), 'right');
    await u.click(p.getByRole('button', { name: 'Open in a new tab', exact: true }));
    await u.pause(1800);
    await u.caption('Move the main reader independently');
    await u.click(p.locator('#next'));
    await u.pause(2200);
    await u.shot();
    await u.scroll(p.locator('#scroller'), 350);
    await u.pause(1800);
    await u.caption('Each pane has its own chapter controls');
    await u.click(p.locator('.reader2-next'));
    await u.pause(2200);
  },
  'appearance': async (p, u) => {
    await u.caption('Make the reader comfortable for you');
    await u.click(p.getByRole('button', { name: 'More', exact: true }));
    await u.click(p.getByRole('button', { name: /Settings…/ }));
    await u.pause(1400);
    await u.click(p.getByRole('button', { name: 'Theme', exact: true }));
    await u.click(p.getByRole('button', { name: 'Dark', exact: true }));
    await u.pause(2500);
    await u.shot();
    await u.caption('Choose another built-in theme');
    await u.click(p.getByRole('button', { name: 'E-ink', exact: true }));
    await u.pause(2500);
    await u.click(p.getByRole('button', { name: 'Light', exact: true }));
    await u.pause(1800);
  },
};

await recordScenarios(scenarios);
