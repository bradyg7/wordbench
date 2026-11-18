import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { attachDemoBackend } from './demo-backend.mjs';

export async function recordScenarios(scenarios, selected = process.argv.slice(2)) {
const out = resolve('site/public/demo');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', args: ['--disable-gpu'] });

try {
for (const [id, scenario] of Object.entries(scenarios)) {
  if (selected.length && !selected.includes(id)) continue;
  const context = await browser.newContext({ viewport: { width:1280, height:800 }, deviceScaleFactor:1,
    recordVideo: { dir: resolve('release-staging/feature-videos'), size: {width:1280,height:800} } });
  const p = await context.newPage();
  const backend = scenario.backend ? await scenario.backend(p, id) : await attachDemoBackend(p, { studyDir: `release-staging/feature-demo-${id}-${Date.now()}`, bibleDb:'release-staging/source-audit/workbench.db', wbPath:'target/debug/wb.exe' });
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
  const u={backend,pause,click,move,center,caption:async text=>{await p.locator('#demo-caption').evaluate((el,text)=>el.textContent=text,text);await pause(900);},
    type:async(loc,text)=>{await click(loc);for(const c of text){if(c==='\n')await p.keyboard.press('Enter');else await p.keyboard.type(c);await pause(c===' '?100:65);}await pause(600);},
    drag:async(a,b)=>{const s=await center(a),e=await center(b);await move(s.x,s.y);await p.mouse.down();await pause(220);await move(e.x,e.y,1500);await pause(300);await p.mouse.up();await pause(700);},
    scroll:async(loc,dy)=>{const c=await center(loc);await move(c.x,c.y);for(let i=0;i<12;i++){await p.mouse.wheel(0,dy/12);await pause(70);}await pause(700);},
    shot:async()=>{await p.screenshot({path:resolve(out,`${id}.png`)});},
  };
  try {
    if (scenario.prepare) await scenario.prepare(backend);
    await p.goto(scenario.url || `http://127.0.0.1:4187/?at=${scenario.startAt || 'JHN.1'}&notebook=0`);
    if (scenario.ready) await p.locator(scenario.ready).waitFor();
    else await p.waitForFunction(()=>window.__wbReady);
    await p.evaluate(()=>document.fonts.ready);
    await pause(1400);
    await (scenario.run || scenario)(p,u);
    await backend.flush();
    await pause(1200);
    if(errors.length)throw Error(errors.join('\n'));
    const video=p.video();await context.close();await video.saveAs(resolve(out,`${id}.webm`));
    await writeFile(resolve('release-staging',`${id}-capture.json`),JSON.stringify({id,backend:'Real Rust CLI; disposable study folder',calls:backend.calls,errors},null,2));
    console.log(`Captured ${id}`);
  } catch(e){await p.screenshot({path:resolve('release-staging',`${id}-failure.png`)});console.log(await p.locator('button, input, textarea').evaluateAll(els=>els.map(el=>({tag:el.tagName,text:el.getAttribute('aria-label')||el.textContent,placeholder:el.getAttribute('placeholder')}))));throw e;}
}
} finally {await browser.close();}

}
