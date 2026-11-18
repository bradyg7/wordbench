import { test, expect } from '@playwright/test';
import { demos, features } from '../src/demo-data';

test('all public pages load; unavailable release offers no download', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const path of ['/', '/demos/', '/download/', '/releases/', '/support/', '/license/', '/privacy/']) {
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
  await page.goto('/');
  await expect(page.getByText('Public downloads are not yet available.', { exact: false })).toHaveCount(0);
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


test('invalid release metadata never exposes a download', async ({ page }) => {
  await page.route('**/release.json', route => route.fulfill({ json: {
    schemaVersion: 1, status: 'published', version: '0.0.1', publishedAt: '2026-11-09T12:00:00Z',
    platform: 'windows', architecture: 'x86_64', channel: 'pilot', minimumWindows: '11', bytes: 1048576,
    notes: 'Pilot', sha256: 'a'.repeat(64), downloadPath: 'https://untrusted.example/installer.exe',
  } }));
  await page.goto('/download/');
  await expect(page.getByRole('heading', { name: 'Could not check availability' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download for Windows' })).toHaveCount(0);
});

test('unknown paths return a real 404 and the built error page offers recovery', async ({ page }) => {
  const response = await page.request.get('/not-a-public-route');
  expect(response.status()).toBe(404);
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
  await page.getByRole('link', { name: 'Return to the overview.' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('direct built routes and manual activation guidance remain available without a release', async ({ page }) => {
  await page.goto('/download/index.html');
  await expect(page.getByRole('heading', { name: 'Install and activate' })).toBeVisible();
  await expect(page.getByText('Create an activation request in the app', { exact: false })).toBeVisible();
  await page.goto('/support/');
  await expect(page.getByText('wb license recovery', { exact: true })).toBeVisible();
  await page.goto('/license/');
  await expect(page.getByText('This website does not collect payments', { exact: false })).toBeVisible();
  await expect(page.getByText('Each invited participant may activate two computers.', { exact: false })).toBeVisible();
  await expect(page.getByText('Pilot updates are included', { exact: false })).toBeVisible();
});

test('homepage stays concise and links to the separate library', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('.demo-library-page')).toHaveCount(0);
  await expect(page.locator('.teaser-card')).toHaveCount(3);
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('link', { name: 'Browse the demo library' }).click();
  await expect(page).toHaveURL(/\/demos\/$/);
  await expect(page.getByRole('heading', { name: 'The demo library.', exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
});

test('library groups cards by category and searches either library view', async ({ page }) => {
  await page.goto('/demos/');
  const search = page.getByRole('searchbox', { name: 'Find a feature' });
  await expect(page.locator('.demo-card')).toHaveCount(demos.length);
  await expect(page.locator('.demo-category')).toHaveCount(new Set(demos.map(demo => demo.category)).size);
  await search.fill('Select and highlight');
  await expect(page.locator('.demo-card')).toHaveCount(demos.filter(demo => `${demo.title} ${demo.category} ${demo.description}`.toLowerCase().includes('select and highlight')).length);
  await search.fill('no-such-feature-xyzz');
  await expect(page.locator('.library-empty')).toBeVisible();
  await search.fill('');
  const category = page.locator('[data-category="Reading"]');
  await category.click();
  await expect(category).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.demo-card')).toHaveCount(demos.filter(demo => demo.category === 'Reading').length);
  await page.getByRole('button', { name: 'All categories', exact: true }).click();
  await page.getByRole('button', { name: /Read the feature guide/ }).click();
  await expect(page.locator('.demo-gallery')).toBeHidden();
  await expect(page.locator('.feature-guide')).toBeVisible();
  await expect(page.locator('.feature-entry')).toHaveCount(features.length);
  await search.fill('highlight');
  await expect(page.locator('.feature-entry')).not.toHaveCount(0);
  await page.locator('.feature-entry summary').first().click();
  await expect(page.locator('.feature-entry[open]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('old homepage demo links redirect and deep links play the chosen recording', async ({ page }) => {
  await page.goto('/#demo-pages');
  await expect(page).toHaveURL(/\/demos\/#demo-pages$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('video source')).toHaveAttribute('src', '/demo/pages.webm');
  const video = page.locator('video');
  await video.evaluate(async (el: HTMLVideoElement) => { el.muted = true; await el.play(); });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.1);
  expect(await video.evaluate((el: HTMLVideoElement) => el.duration)).toBeGreaterThan(5);
  await expect(page.getByRole('link', { name: /Open full-size screenshot: Create a page/ })).toHaveAttribute('href', '/demo/pages.png');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await page.goto('/#demo');
  await expect(page).toHaveURL(/\/demos\/$/);
});

test('gallery opens a focused viewer, closes with focus restored, and supports Back', async ({ page }) => {
  await page.goto('/demos/');
  const card = page.locator('.demo-card[data-demo="pages"]');
  await card.click();
  await expect(page.locator('#selected-demo-title')).toBeFocused();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `test-results/site/demo-viewer-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Next walkthrough' }).click();
  const next = demos[(demos.findIndex(demo => demo.id === 'pages') + 1) % demos.length];
  await expect(page.locator('video source')).toHaveAttribute('src', `/demo/${next.id}.webm`);
  await page.goBack();
  await expect(page).toHaveURL(/#demo-pages$/);
  await expect(page.locator('video source')).toHaveAttribute('src', '/demo/pages.webm');
  await page.getByRole('button', { name: 'Close walkthrough', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/site/demo-gallery-${test.info().project.name}.png`, fullPage: true });
});
