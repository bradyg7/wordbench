import { test, expect, type Page } from '@playwright/test';

async function mockSpeech(page: Page) {
  await page.addInitScript(() => {
    const utterances: any[] = [];
    class MockUtterance {
      text: string; voice: any = null; lang = ''; rate = 1;
      onstart: (() => void) | null = null; onend: (() => void) | null = null;
      onboundary: ((event: any) => void) | null = null; onerror: ((event: any) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    const voices = [{ name: 'Local Test English', lang: 'en-US', localService: true, default: true }];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => voices, addEventListener: () => {}, cancel: () => {}, pause: () => {}, resume: () => {},
      speak: (u: any) => { utterances.push(u); u.onstart?.(); },
    } });
    (window as any).__speech = { utterances, voices };
  });
}

test('reads a bounded passage, highlights words, and supports pause, resume and stop', async ({ page }) => {
  await mockSpeech(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);

  await page.evaluate(() => (window as any).__wb.run('listen Numbers 25:11-12'));
  await expect(page.locator('#listenbar')).toBeVisible();
  await expect(page.locator('.w.reading').first()).toBeVisible();
  await page.evaluate(() => {
    const first = (window as any).__speech.utterances[0];
    first.onboundary?.({ name: 'word', charIndex: 0 });
  });
  await expect(page.locator('.w.reading-word')).toHaveCount(1);

  await page.evaluate(() => (window as any).__wb.run('listen pause'));
  await expect(page.locator('[data-listen="pause"]')).toHaveText('Resume');
  await page.evaluate(() => (window as any).__wb.run('listen resume'));
  await expect(page.locator('[data-listen="pause"]')).toHaveText('Pause');
  await page.evaluate(() => (window as any).__wb.run('listen stop'));
  await expect(page.locator('#listenbar')).toBeHidden();
});

test('back returns to the original chapter and cancels a pending read-aloud start', async ({ page }) => {
  await mockSpeech(page);
  await page.goto('/?at=NUM.25');
  await page.waitForFunction(() => (window as any).__wbReady);
  await page.evaluate(() => {
    window.speechSynthesis.getVoices = () => [];
    (window as any).__pendingSpeech = (window as any).__wb.run('listen Numbers 26:1');
  });
  await expect(page.locator('.ch-title')).toHaveText('Numbers 26');
  await page.evaluate(() => (window as any).__wb.run('back'));
  await expect(page.locator('.ch-title')).toHaveText('Numbers 25');
  const result = await page.evaluate(() => (window as any).__pendingSpeech);
  expect(result).toEqual({ ok: true, said: 'Read-aloud canceled' });
  expect(await page.evaluate(() => (window as any).__speech.utterances.length)).toBe(0);
});
