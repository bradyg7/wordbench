import { expect, test, type Page } from '@playwright/test';

const id = 'visual-page';
const title = 'Visual editor scratch page';
const table = '| Alpha | Beta |\n| :--- | ---: |\n| Left | Right |';
const first = 'First block';
const last = 'Last block';

async function notebook(page: Page, template = false) {
  let texts = [first, table, last];
  const blocks = () => ({ id, title: { text: title, start: 0, end: title.length }, blocks: texts.map((text, i) => ({
    n: i + 1, kind: text.startsWith('|') ? 'table' : 'paragraph', text, start: 0, end: text.length,
  })) });
  const tpl = { id, title, headings: [], summary: 'One field', asks: 'place', new_name: '{place} notes', used: 0 };
  const entry = () => ({
    id, title, kind: 'note', template, placed: false, text: [title, ...texts].join('\n\n'), preview: 'Test fixture', linked_from: [], also: [], threads: [],
  });
  await page.route('**/fixtures/wb/*.json', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (name.startsWith('notebook-group-')) return route.fulfill({ json: { groups: [{ key: 'one', label: 'Scratch', entries: [entry()] }] } });
    if (name.startsWith('notebook-sidebar')) return route.fulfill({ json: { today: [], pinned: [], pages: [entry()], questions: [], templates: [] } });
    if (name === 'note-show-visual-page.json') return route.fulfill({ json: entry() });
    if (name === 'template-list.json') return route.fulfill({ json: { templates: template ? [tpl] : [] } });
    if (name.startsWith('template-show-visual-page')) {
      const name = route.request().url().includes('-title-custom') ? 'Custom title' : 'Numbers 25 notes';
      return route.fulfill({ json: { ...tpl, made: { title: name, text: `${name}\n\nPage title field became ${name}.` } } });
    }
    if (name === 'page-blocks-visual-page.json') return route.fulfill({ json: blocks() });
    if (name.startsWith('block-rm-visual-page-2-')) {
      texts.splice(1, 1);
      return route.fulfill({ json: { ...blocks(), undo: { test: true } } });
    }
    if (name === 'block-undo-visual-page.json') {
      texts.splice(1, 0, table);
      return route.fulfill({ json: blocks() });
    }
    if (name.startsWith('block-set-visual-page-2-')) {
      texts[1] = table.replace('Left', 'Edited');
      return route.fulfill({ json: { ...blocks(), n: 2, count: 1 } });
    }
    if (name === 'view-run-notebook-kind-question-answered-days-7.json') {
      return route.fulfill({ json: { rows: [{ id, kind: 'question', title: 'Answered scratch question', status: 'done' }], count: 1 } });
    }
    if (name === 'thread-list.json') return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
}

test('table fields and editor Undo work with keyboard and touch', async ({ page, hasTouch }) => {
  await notebook(page);
  const row = page.getByText(title, { exact: true }).first();
  if (hasTouch) await row.tap(); else await row.click();
  const editor = page.locator('.nb-editor');
  const block = editor.locator('.nb-b-table');
  await block.getByRole('button', { name: 'Edit table' }).click();
  const left = block.getByRole('textbox', { name: 'Row 1, column 1' });
  await expect(left).toHaveValue('Left');
  await left.fill('Edited');
  await block.getByRole('button', { name: 'Add column' }).click();
  await expect(block.getByRole('textbox', { name: 'Column 3 heading' })).toBeFocused();
  await block.getByRole('button', { name: 'Remove column 3' }).click();
  await block.getByRole('button', { name: 'Save block' }).click();
  await expect(block.getByRole('cell', { name: 'Edited' })).toBeVisible();

  const grip = editor.getByRole('button', { name: 'Actions for block 2' });
  if (hasTouch) await grip.tap(); else await grip.press('Enter');
  await page.getByRole('button', { name: 'Delete block', exact: true }).click();
  await expect(editor.locator('.nb-b-table')).toHaveCount(0);
  await expect(editor.getByText(first)).toBeVisible();
  await expect(editor.getByText(last)).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Actions for block 2' })).toBeFocused();
  if (hasTouch) await editor.getByRole('button', { name: 'Undo block deletion' }).tap();
  else await page.keyboard.press('Control+z');
  await expect(block.getByRole('cell', { name: 'Left' })).toBeVisible();

  await editor.getByText(first).click();
  const input = editor.locator('.nb-block-input');
  await input.press('Shift+Enter');
  await input.type('New line');
  await expect(input).toHaveValue('First block\nNew line');
});

test('Notebook filters show the exact view command and its result', async ({ page }) => {
  await notebook(page);
  const panel = page.locator('.nb-filters');
  await panel.locator('summary').click();
  await panel.getByLabel('Kind').selectOption('question');
  await panel.getByLabel('Questions', { exact: true }).selectOption('answered');
  await panel.getByLabel('Written in the last N days').fill('7');
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(panel.getByRole('textbox', { name: 'View command' })).toHaveValue('notebook kind question answered days 7');
  await expect(panel.getByRole('button', { name: /Answered scratch question/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await expect(panel.getByRole('textbox', { name: 'View command' })).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});


test('a template test fill previews a manual name without a create action', async ({ page }) => {
  await notebook(page, true);
  await page.getByText(title, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Test fill' }).click();
  const dialog = page.getByRole('dialog', { name: 'Test template fill' });
  const name = dialog.getByRole('textbox', { name: 'The new page’s name' });
  await expect(name).toHaveValue('Numbers 25 notes');
  await name.fill('Custom title');
  await expect(dialog.getByText('Page title field became Custom title.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Make the page' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
});
