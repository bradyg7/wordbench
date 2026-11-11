// Inspect published-format recordings without altering them.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const ids=['reading-navigation','word-study','highlighting','pages','parallel-reading','appearance'];
const browser=await chromium.launch({channel:'msedge',args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const results=[];
try {
  await page.goto('http://127.0.0.1:4177/');
  for(const id of ids){
    await page.evaluate(id=>{document.body.innerHTML='<video muted style="width:1280px;height:800px;display:block"></video>';document.body.style.cssText='margin:0;background:black';const v=document.querySelector('video');v.src=`/demo/${id}.webm`;v.load();},id);
    await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
    const meta=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));
    if(meta.duration<15 || meta.width!==1280 || meta.height!==800)throw Error(`Invalid ${id}: ${JSON.stringify(meta)}`);
    for(const [label,time] of [['middle',Math.min(12,meta.duration/2)],['end',meta.duration-2]]){
      await page.locator('video').evaluate((v,time)=>new Promise(resolve=>{v.onseeked=()=>resolve();v.currentTime=time;}),time);
      await page.screenshot({path:`release-staging/${id}-${label}-frame.png`});
    }
    results.push({id,...meta});
  }
  await writeFile('release-staging/demo-media-verification.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
