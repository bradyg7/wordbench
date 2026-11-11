// Guided UI recordings: real pointer/keyboard input, real Rust actions, scratch files.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { attachDemoBackend } from './demo-backend.mjs';

const out = resolve('site/public/demo');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', args: ['--disable-gpu'] });
const selected = process.argv.slice(2);
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

try {
for (const [id, scenario] of Object.entries(scenarios)) {
  if (selected.length && !selected.includes(id)) continue;
  const context = await browser.newContext({ viewport: { width:1280, height:800 }, deviceScaleFactor:1,
    recordVideo: { dir: resolve('release-staging/feature-videos'), size: {width:1280,height:800} } });
  const p = await context.newPage();
  const backend = await attachDemoBackend(p, { studyDir: `release-staging/feature-demo-${id}-${Date.now()}`, bibleDb:'release-staging/source-audit/workbench.db', wbPath:'target/debug/wb.exe' });
  const errors=[]; p.on('pageerror', e=>errors.push(e.message));
  await p.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style=document.createElement('style');
      style.textContent='#demo-pointer{position:fixed;left:100px;top:100px;width:18px;height:25px;background:#111;clip-path:polygon(0 0,0 100%,28% 76%,47% 100%,64% 91%,44% 67%,85% 67%);filter:drop-shadow(1px 1px 1px #000);z-index:2147483647;pointer-events:none}#demo-caption{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;background:#222e;color:white;font:500 15px Inter,sans-serif;z-index:2147483646;pointer-events:none;white-space:nowrap}';
      document.head.append(style);
      const pointer=document.createElement('div');pointer.id='demo-pointer';document.body.append(pointer);
      const caption=document.createElement('div');caption.id='demo-caption';caption.textContent='Bible Workbench · Guided demonstration';document.body.append(caption);
      document.addEventListener('pointermove',e=>{pointer.style.left=e.clientX+'px';pointer.style.top=e.clientY+'px';});
      document.addEventListener('pointerdown',()=>pointer.style.background='#eec36f');
      document.addEventListener('pointerup',()=>pointer.style.background='#111');
    });
  });
  let x=100,y=100;
  const pause=ms=>p.waitForTimeout(ms);
  const move=async (nx,ny,ms=850)=>{const sx=x,sy=y;const steps=Math.ceil(ms/22);for(let i=1;i<=steps;i++){const t=i/steps;const e=t*t*(3-2*t);await p.mouse.move(sx+(nx-sx)*e,sy+(ny-sy)*e);await pause(ms/steps);}x=nx;y=ny;};
  const center=async loc=>{await loc.waitFor({state:'visible'});const r=await loc.boundingBox();if(!r)throw Error('No visible target');return {x:r.x+r.width/2,y:r.y+r.height/2};};
  const click=async(loc,button='left')=>{const c=await center(loc);await move(c.x,c.y);await pause(220);await p.mouse.down({button});await pause(110);await p.mouse.up({button});await pause(700);};
  const u={backend,pause,click,caption:async text=>{await p.locator('#demo-caption').evaluate((el,text)=>el.textContent=text,text);await pause(900);},
    type:async(loc,text)=>{await click(loc);for(const c of text){if(c==='\n')await p.keyboard.press('Enter');else await p.keyboard.type(c);await pause(c===' '?100:65);}await pause(600);},
    drag:async(a,b)=>{const s=await center(a),e=await center(b);await move(s.x,s.y);await p.mouse.down();await pause(220);await move(e.x,e.y,1500);await pause(300);await p.mouse.up();await pause(700);},
    scroll:async(loc,dy)=>{const c=await center(loc);await move(c.x,c.y);for(let i=0;i<12;i++){await p.mouse.wheel(0,dy/12);await pause(70);}await pause(700);},
    shot:async()=>{await p.screenshot({path:resolve(out,`${id}.png`)});},
  };
  try {
    await p.goto('http://127.0.0.1:4187/?at=JHN.1&notebook=0');
    await p.waitForFunction(()=>window.__wbReady);
    await p.evaluate(()=>document.fonts.ready);
    await pause(1400);
    await scenario(p,u);
    await backend.flush();
    await pause(1200);
    if(errors.length)throw Error(errors.join('\n'));
    const video=p.video();await context.close();await video.saveAs(resolve(out,`${id}.webm`));
    await writeFile(resolve('release-staging',`${id}-capture.json`),JSON.stringify({id,backend:'Real Rust CLI; disposable study folder',calls:backend.calls,errors},null,2));
    console.log(`Captured ${id}`);
  } catch(e){await p.screenshot({path:resolve('release-staging',`${id}-failure.png`)});console.log(await p.locator('button, input, textarea').evaluateAll(els=>els.map(el=>({tag:el.tagName,text:el.getAttribute('aria-label')||el.textContent,placeholder:el.getAttribute('placeholder')}))));throw e;}
}
} finally {await browser.close();}
