// Screenshots of the real app (WebView2) at the phone and laptop window sizes, for docs/phase0.
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const root = new URL('..', import.meta.url);
const exe = new URL('target/release/bible-workbench.exe', root).pathname.slice(1);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const proc = spawn(exe, [], { env: { ...process.env, WB_WINDOW: 'phone', WB_CDP_PORT: '9334' }, stdio: 'ignore' });
let browser;
for (let i = 0; i < 100 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9334'); } catch { await sleep(100); } }
const page = browser.contexts()[0].pages()[0];
await page.waitForFunction(() => window.__wbReady);
const shot = name => page.screenshot({ path: new URL(`docs/phase0/app-${name}.png`, root).pathname.slice(1) });
await page.evaluate(() => window.__wb.open('NUM', 25, 10));
await sleep(500);
await shot('phone-reader');
await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('set_window', { preset: 'laptop' }));
await sleep(800);
await page.evaluate(() => window.__wb.open('NUM', 25, 10));
await sleep(500);
const z = await page.evaluate(() => { const d = window.__wb.drawn; const k = d.v.findIndex((v, k) => v === 11 && d.i[k] === 24); const r = d.el[k].getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2 }; });
await page.mouse.move(z.x, z.y);
await sleep(900);
await shot('laptop-reader');
await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('set_window', { preset: 'phone' }));
await browser.close().catch(() => {});
try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ }
process.exit(0);
