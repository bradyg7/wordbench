import { test, expect } from '@playwright/test';

test('all public pages load; unavailable release offers no download', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const path of ['/', '/download/', '/releases/', '/support/', '/license/', '/privacy/']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    if (['/', '/download/', '/releases/'].includes(path)) await expect(page.getByRole('heading', { name: 'Not available yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download for Windows', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('network failure offers retry without exposing a download', async ({ page }) => {
  let requests = 0;
  await page.route('**/release.json', route => {
    requests++;
    return requests === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: { schemaVersion: 1, status: 'unavailable' } });
  });
  await page.goto('/download/');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Not available yet' })).toBeVisible();
});

test('published metadata is rendered as text and enables only a same-origin download', async ({ page }) => {
  await page.route('**/release.json', route => route.fulfill({ json: {
    schemaVersion: 1, status: 'published', version: '0.0.1', publishedAt: '2026-11-09T12:00:00Z',
    platform: 'windows', architecture: 'x86_64', channel: 'pilot', minimumWindows: '11', bytes: 1048576,
    notes: '<img src=x onerror="window.injected=true">', sha256: 'a'.repeat(64), downloadPath: '/downloads/test-pilot',
  } }));
  await page.goto('/download/');
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', '/downloads/test-pilot');
  await expect(page.locator('#release img')).toHaveCount(0);
  await expect(page.locator('.release-notes')).toContainText('<img');
});

test('keyboard skip link reaches main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.screenshot({ path: `test-results/site/landing-${test.info().project.name}.png`, fullPage: true });
});
