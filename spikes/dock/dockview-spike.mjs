// Phase 2b tier 1, step 1: a short spike of dockview-core in WebKit, against what our dock must do (PLAN-phase2b-build
// tier 1). The library is read from the Python app's vendored copy (that repository is only read), so nothing is added
// to this one. A reader panel in the middle, a column each side, a float; then the phone size.
//
//   node spikes/dock/dockview-spike.mjs
import { webkit } from '@playwright/test';
import { readFileSync } from 'node:fs';

const lib = readFileSync('C:/Users/brady/github/bible-workbench/web/vendor/dockview-core/dockview-core.min.js', 'utf8');
const css = (() => { try { return readFileSync('C:/Users/brady/github/bible-workbench/web/vendor/dockview-core/dockview.css', 'utf8'); } catch { return ''; } })();
// placeholder lines only (no scripture here): the reader's scroll position is what is checked
const lines = Array.from({ length: 200 }, (_, i) => `<p data-v="${i + 1}">line ${i + 1}</p>`).join('');
const html = `<!doctype html><html><head><style>${css} html,body{margin:0;height:100%} #host{position:fixed;inset:0}
.reader{height:100%;overflow:auto;font:18px/32px serif;padding:0 24px}</style></head><body><div id="host"></div>
<script>${lib}</script><script>
const t0 = performance.now();
const D = window['dockview-core'];
class Part { constructor(id){ this._el = document.createElement('div'); this._el.style.height='100%'; this.id=id; }
  get element(){ return this._el; } init(p){ if (this.id==='reader') { this._el.className='reader'; this._el.innerHTML=${JSON.stringify(lines)}; } else this._el.textContent=p.params?.text||this.id; } }
const api = D.createDockview(document.getElementById('host'), { createComponent: o => new Part(o.name) });
api.addPanel({ id: 'reader', component: 'reader', title: 'Numbers 25' });
api.addPanel({ id: 'left', component: 'pane', title: 'H7065', position: { referencePanel: 'reader', direction: 'left' }, initialWidth: 440 });
api.addPanel({ id: 'right', component: 'pane', title: 'Notebook', position: { referencePanel: 'reader', direction: 'right' }, initialWidth: 420 });
api.addPanel({ id: 'f1', component: 'pane', title: 'Interlinear', floating: { x: 500, y: 100, width: 420, height: 300 } });
api.addPanel({ id: 'f2', component: 'pane', title: 'Every use', floating: { x: 600, y: 450, width: 420, height: 300 } });
window.__spike = { api, built: performance.now() - t0 };
</script></body></html>`;

const browser = await webkit.launch();
const out = {};
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setContent(html);
  await page.waitForFunction(() => window.__spike);
  const r = await page.evaluate(async () => {
    const { api, built } = window.__spike;
    const reader = document.querySelector('.reader');
    reader.querySelector('[data-v="50"]').scrollIntoView();
    const before = reader.scrollTop;
    // closing a column widens the reader: does it keep its place?
    api.getPanel('left').api.close();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = reader.scrollTop;
    const topLine = [...reader.querySelectorAll('p')].find(p => p.getBoundingClientRect().bottom > reader.getBoundingClientRect().top + 1)?.dataset.v;
    return {
      built_ms: Math.round(built), groups: api.groups.length, floats: api.groups.filter(g => g.api.location.type === 'floating').length,
      readerWidth: Math.round(reader.getBoundingClientRect().width), scrollKept: before === after, topLineAfterClose: topLine,
    };
  });
  out[name] = { ...r, errors };
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ libKB: Math.round(lib.length / 1024), ...out }, null, 2));
