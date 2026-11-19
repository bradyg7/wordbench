import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STABLE = 'https://github.com/bradyg7/wordbench-releases/releases/latest/download/Bible-Workbench-setup.exe';

test('overview: Wordbench, the text, the download button (rows 1, 3)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Wordbench/);
  await expect(page.locator('h1')).toHaveText('Wordbench');
  await expect(page.getByText('Study the text for yourself.')).toBeVisible();
  await expect(page.getByText('Read the King James Bible, look closely at its words, and keep your own work beside it.')).toBeVisible();
  await expect(page.getByText('Free. Mac coming soon.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', STABLE);
  await expect(page.getByText('The conclusions are yours.')).toBeVisible();
  const body = await page.locator('body').innerText();
  for (const word of ['Bible Workbench', 'pilot', 'license', 'YLT', 'price', 'thread']) expect(body.toLowerCase()).not.toContain(word.toLowerCase());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('nav: four links, the current one marked; footer Privacy and Help (rows 2, 7)', async ({ page }) => {
  for (const [path, current] of [['/', 'Overview'], ['/download/', 'Download'], ['/releases/', 'Releases'], ['/support/', 'Help']]) {
    await page.goto(path);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Download', 'Releases', 'Help']);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(current);
    await expect(page.getByRole('navigation', { name: 'Footer' }).getByRole('link')).toHaveText(['Privacy', 'Help']);
    await expect(page.locator('.brand')).toHaveText('Wordbench');
  }
});

test('help and privacy pages exist; there is no License page (row 7)', async ({ page }) => {
  await page.goto('/support/');
  await expect(page.getByRole('heading', { name: 'Back up your study folder' })).toBeVisible();
  await expect(page.getByText('Ask the person who sent you the link.')).toBeVisible();
  await page.goto('/privacy/');
  await expect(page.getByText('This website has no accounts, analytics or cookies')).toBeVisible();
  await page.goto('/license/');
  await expect(page.getByText('This page does not exist.')).toBeVisible();
  expect(existsSync(fileURLToPath(new URL('../license', import.meta.url)))).toBe(false);
  await page.goto('/download/');
  await expect(page.getByRole('link', { name: /license/i })).toHaveCount(0);
});

test('download: the release box comes from release.json (row 4)', async ({ page }) => {
  await page.goto('/download/');
  await expect(page.getByRole('heading', { name: 'Version 0.2.0' })).toBeVisible();
  await expect(page.locator('#release')).toContainText('Windows 10 or 11, 64-bit · 40 MB · 19 November 2026');
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', STABLE);
  await expect(page.getByText('Windows protected your PC').first()).toBeVisible();
  await expect(page.getByText('More info').first()).toBeVisible();
  await expect(page.getByText('Run anyway').first()).toBeVisible();
  await expect(page.getByText('An example of the warning, drawn here.')).toBeVisible();
});

test('download: no release found shows no button (row 5)', async ({ page }) => {
  await page.route('**/release.json', route => route.fulfill({ json: { schemaVersion: 2, status: 'unavailable' } }));
  await page.goto('/download/');
  await expect(page.getByRole('heading', { name: 'Not available right now' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveCount(0);
});

test('download: a broken or foreign release.json offers no button (row 5)', async ({ page }) => {
  await page.route('**/release.json', route => route.fulfill({ json: { schemaVersion: 2, status: 'published', version: '0.2.0', publishedAt: '2026-11-19T00:00:00Z', minimumWindows: '10', downloadUrl: 'https://evil.example/x.exe' } }));
  await page.goto('/download/');
  await expect(page.getByRole('heading', { name: 'Not available right now' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveCount(0);
});

test('releases: every version, newest first (row 6)', async ({ page }) => {
  await page.goto('/releases/');
  await expect(page.locator('.release-notes-page h2')).toHaveText(['0.2.0', '0.1.1', '0.1.0']);
  await expect(page.getByText('The legend: what each of your styles means')).toBeVisible();
  await expect(page.locator('.release-notes-page code').first()).toBeVisible();
});

test('keyboard skip link reaches main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});
