import { test, expect } from '@playwright/test';

test('first run persists requested folder before offering restart', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { cmd: string; args: unknown }[] = [];
    Object.assign(window, { setupCalls: calls, __TAURI_INTERNALS__: { invoke: async (cmd: string, args: unknown) => {
      calls.push({ cmd, args });
      if (cmd === 'installation_status') return { ready: false, resources_ok: true, study_dir: null, suggested_dir: 'C:\\Users\\Pilot\\Documents\\Study', problem: null };
      if (cmd === 'pilot_license') return { active: true, problem: null };
      return null;
    } } });
  });
  await page.goto('/setup.html');
  await expect(page.getByLabel('Full folder path')).toHaveValue('C:\\Users\\Pilot\\Documents\\Study');
  await page.getByRole('button', { name: 'Save study folder' }).click();
  await expect(page.getByRole('button', { name: 'Open my workbench' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { setupCalls: unknown[] }).setupCalls)).toContainEqual({ cmd: 'installation_configure', args: { path: 'C:\\Users\\Pilot\\Documents\\Study', create: true } });
});

test('damaged resources cannot create a study folder and can be retried', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: { invoke: async () => ({ ready: false, resources_ok: false, problem: 'Resource checksum mismatch', suggested_dir: '', study_dir: null }) } }));
  await page.goto('/setup.html');
  await expect(page.getByRole('status')).toHaveText('Resource checksum mismatch');
  await expect(page.getByRole('button', { name: 'Save study folder' })).toBeHidden();
  await page.getByRole('button', { name: 'Check installation again' }).click();
  await expect(page.getByRole('status')).toHaveText('Resource checksum mismatch');
});

test('configuration failure retains input and a usable retry', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: { invoke: async (cmd: string) => {
    if (cmd === 'installation_status') return { ready: false, resources_ok: true, study_dir: null, suggested_dir: '', problem: null };
    throw new Error('Folder already exists');
  } } }));
  await page.goto('/setup.html');
  await page.getByLabel('Full folder path').fill('C:\\Existing');
  await page.getByRole('button', { name: 'Save study folder' }).click();
  await expect(page.getByRole('status')).toContainText('Folder already exists');
  await expect(page.getByLabel('Full folder path')).toHaveValue('C:\\Existing');
  await expect(page.getByRole('button', { name: 'Save study folder' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/setup/first-run.png' });
});

test('unactivated users can recover files and request/import a license before restart', async ({ page }) => {
  await page.addInitScript(() => {
    let active = false;
    Object.assign(window, { __TAURI_INTERNALS__: { invoke: async (cmd: string, args: { action?: string }) => {
      if (cmd === 'installation_status') return { ready: true, resources_ok: true, study_dir: 'C:\\Pilot\\Study', suggested_dir: '', problem: null };
      if (args?.action === 'status') return { active, problem: active ? null : 'Activation required' };
      if (args?.action === 'request') return { request: 'synthetic public device request' };
      if (args?.action === 'import') { active = true; return { active }; }
      return null;
    } } });
  });
  await page.goto('/setup.html');
  await expect(page.getByRole('button', { name: 'Open my workbench' })).toBeHidden();
  await expect(page.locator('#recovery')).toContainText('C:\\Pilot\\Study');
  await page.getByRole('button', { name: 'Create activation request' }).click();
  await expect(page.locator('#request-text')).toHaveValue('synthetic public device request');
  await page.screenshot({ path: 'test-results/setup/activation.png', fullPage: true });
  await page.locator('#certificate').setInputFiles({ name: 'test-license.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('button', { name: 'Open my workbench' })).toBeVisible();
});

test('invalid license import does not unlock the workspace', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: { invoke: async (cmd: string, args: { action?: string }) => {
    if (cmd === 'installation_status') return { ready: true, resources_ok: true, study_dir: 'C:\\Pilot\\Study', suggested_dir: '', problem: null };
    if (args?.action === 'status') return { active: false, problem: 'Activation required' };
    throw new Error('License signature did not verify.');
  } } }));
  await page.goto('/setup.html');
  await page.locator('#certificate').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('#license-status')).toContainText('signature did not verify');
  await expect(page.getByRole('button', { name: 'Open my workbench' })).toBeHidden();
});
