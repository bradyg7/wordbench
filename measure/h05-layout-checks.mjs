// Isolated Dock/layout contract checks. No Bible or study-folder reads/writes.
// WB_TOOL_ROOT may point at an existing dependency checkout; it never installs anything.
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readLayout } from '../ui/src/layout-state.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const deps = process.env.WB_TOOL_ROOT || root;
const { createServer } = await import(pathToFileURL(resolve(deps, 'node_modules/vite/dist/node/index.js')));
const { chromium, webkit } = await import(pathToFileURL(resolve(deps, 'node_modules/playwright/index.mjs')));
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const legacy = { app: 'bible-workbench-rs', panes: [
  { key: 'doc|sample|Sample', side: 'float', front: true, rect: { x: 10, y: 60, w: 320, h: 400 } },
  { key: 'strong|H1', side: 'left', front: true },
] };
check('legacy geometry/front migrates and document key normalizes', () => {
  const s = readLayout(legacy); assert.equal(s.panes[0].key, 'doc:sample'); assert.equal(s.groups[0].front, 'doc:sample'); assert.equal(s.groups[1].side, 'left');
});
for (const [name, value] of [
  ['future version', { ...legacy, version: 3 }], ['Python layout', { app: 'python', panes: [] }],
  ['duplicate aliases', { ...legacy, panes: [...legacy.panes, { key: 'doc:sample' }] }],
  ['invalid float bounds', { ...legacy, panes: [{ key: 'help', rect: { x: 0, y: 0, w: -2, h: 1 } }] }],
  ['missing group member', { ...readLayout(legacy), groups: [{ side: 'left', keys: ['absent'] }] }],
  ['malformed view state', { ...legacy, panes: [{ key: 'help', view: { scroll: [{ path: [-1], top: 0, left: 0 }] } }] }],
]) check(`reject ${name}`, () => assert.throws(() => readLayout(value)));
const port = Number(process.env.WB_UI_PORT || 1865);
const server = await createServer({ configFile: false, root: resolve(root, 'ui'), cacheDir: resolve(root, 'target/h05-vite-cache'),
  optimizeDeps: { noDiscovery: true, entries: [] },
  resolve: { alias: { '@fontsource': resolve(deps, 'node_modules/@fontsource'), '@tauri-apps/api': resolve(deps, 'node_modules/@tauri-apps/api') } },
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root, deps] } },
  plugins: [{ name: 'h05-shell', configureServer(s) { s.middlewares.use('/h05-check', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html style="--bar-h:56px"><head><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/desk.css"></head><body><header id="bar" style="height:56px"></header><div id="scroller"></div><div id="host"></div><div id="overlay"></div></body></html>'); }); } }],
});
await server.listen();
try {
  for (const engine of process.env.WB_BROWSER_CHANNEL ? [chromium] : [chromium, webkit]) {
    const browser = await engine.launch({ headless: true, ...(process.env.WB_BROWSER_CHANNEL ? { channel: process.env.WB_BROWSER_CHANNEL } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      await page.goto(`http://127.0.0.1:${port}/h05-check`);
      const result = await page.evaluate(async () => {
        const { Dock } = await import('/src/dock.ts');
        const { readLayout } = await import('/src/layout-state.ts');
        const d = new Dock(document.getElementById('host'));
        window.testDock = d;
        let restores = 0;
        d.keepPlace = () => () => restores++;
        const add = (key, side) => d.open('test', key, key, side, (el, p) => {
          el.innerHTML = '<div style="height:140px;overflow:auto" class="nested"><div style="height:900px">Test content</div></div>';
          let slide = 7;
          p.captureView = () => ({ slide }); p.restoreView = state => { slide = state.slide; };
        });
        add('a', 'left'); add('b', 'left'); add('c', 'right'); add('d', 'float'); add('e', 'top'); add('f', 'bottom');
        const saved = readLayout({ app: 'bible-workbench-rs', version: 2,
          panes: d.snapshot().panes.map(p => ({ ...p, view: { scroll: [{ path: [0], top: 117, left: 0 }], state: { slide: 4 } } })),
          groups: [
            { side: 'left', keys: ['a', 'b'], front: 'b', share: 2, strip: 20 },
            { side: 'left', keys: ['c'], front: 'c', share: 1, min: true },
            { side: 'float', keys: ['d'], rect: { x: 700, y: 140, w: 350, h: 440 }, z: 12 },
            { side: 'top', keys: ['e'] }, { side: 'bottom', keys: ['f'] },
          ], widths: { left: 355, right: 320 }, wide: {}, bands: { top: 160, bottom: 180 }, active: 'b' });
        await d.restore(saved);
        const out = d.snapshot();
        return { out, restores, active: document.activeElement === d.find('b').el, scroll: d.find('b').el.firstElementChild.scrollTop };
      });
      check(`${engine.name()}: split groups, tab order/front, bands and float restored`, () => {
        assert.deepEqual(result.out.groups.map(g => [g.side, g.keys, g.front]), [['left', ['a', 'b'], 'b'], ['left', ['c'], 'c'], ['float', ['d'], 'd'], ['top', ['e'], 'e'], ['bottom', ['f'], 'f']]);
        assert.equal(result.out.groups[0].share, 2); assert.equal(result.out.groups[1].min, true); assert.equal(result.out.widths.left, 355); assert.equal(result.out.bands.bottom, 180); assert.equal(result.out.groups[2].rect.w, 350);
      });
      check(`${engine.name()}: active pane, nested scroll, custom slide state, reader preservation`, () => {
        assert.equal(result.active, true); assert.equal(result.scroll, 117); assert.ok(result.restores > 0); assert.equal(result.out.panes.find(p => p.key === 'b').view.state.slide, 4);
      });
      const rollback = await page.evaluate(async () => {
        const d = window.testDock, before = d.snapshot(), p = d.find('b'), restore = p.restoreView;
        const next = structuredClone(before); next.panes = next.panes.filter(p => p.key !== 'f'); next.groups = next.groups.filter(g => !g.keys.includes('f'));
        p.restoreView = () => { throw new Error('simulated read failure'); };
        let rejected = false;
        try { await d.restore(next); } catch { rejected = true; }
        const oldPaneAlive = !!d.find('f'); p.restoreView = restore; await d.restore(before);
        return { rejected, oldPaneAlive, restored: d.snapshot().groups.map(g => [g.side, g.keys]) };
      });
      check(`${engine.name()}: failed view-state read retains old panes for rollback`, () => {
        assert.equal(rollback.rejected, true); assert.equal(rollback.oldPaneAlive, true); assert.deepEqual(rollback.restored, result.out.groups.map(g => [g.side, g.keys]));
      });
      const focus = await page.evaluate(async () => {
        const d = window.testDock, p = d.find('b');
        const input = document.createElement('textarea'); input.value = 'An editor selection'; p.el.append(input); input.focus(); input.setSelectionRange(3, 8);
        const before = d.snapshot(); d.focusPane(p);
        const focused = p.el.closest('.dock-focus') !== null;
        const backgroundInert = document.getElementById('scroller').inert;
        const sameInput = document.activeElement === input && input.selectionStart === 3 && input.selectionEnd === 8;
        p.el.firstElementChild.scrollTop = 151;
        const during = d.snapshot(); d.exitFocus();
        return { focused, backgroundInert, backgroundRestored: !document.getElementById('scroller').inert, sameInput, before, during, after: d.snapshot(), scroll: p.el.firstElementChild.scrollTop, returned: document.activeElement === input };
      });
      check(`${engine.name()}: focus preserves layout, editor identity, selection and reading progress`, () => {
        assert.equal(focus.focused, true); assert.equal(focus.sameInput, true); assert.equal(focus.returned, true); assert.equal(focus.scroll, 151);
        assert.equal(focus.backgroundInert, true); assert.equal(focus.backgroundRestored, true);
        assert.deepEqual(focus.before.groups, focus.during.groups); assert.deepEqual(focus.before.groups, focus.after.groups);
      });
      await page.evaluate(() => { const d = window.testDock; d.focusPane(d.find('d')); });
      await page.keyboard.press('Escape');
      check(`${engine.name()}: Escape returns a floating pane`, () => {});
      assert.equal(await page.locator('.dock-focus').isVisible(), false);
      await page.evaluate(() => { const d = window.testDock; d.focusPane(d.find('b')); d.show(d.find('a')); });
      check(`${engine.name()}: activating another pane exits focus`, () => {});
      assert.equal(await page.locator('.dock-focus').isVisible(), false);
      await page.evaluate(() => {
        const d = window.testDock; window.keptDrops = 0;
        const target = document.createElement('div'); target.id = 'external-target'; target.textContent = 'Folder target';
        Object.assign(target.style, { position: 'fixed', left: '550px', top: '70px', width: '200px', height: '60px', zIndex: '20' }); document.body.append(target);
        d.externalDrop = (x, y) => x >= 550 && x <= 750 && y >= 70 && y <= 130 ? { label: 'Keep in Folder target', box: { x: 550, y: 70, w: 200, h: 60 }, drop: () => window.keptDrops++ } : null;
      });
      const drag = page.locator('.tab-name').filter({ hasText: /^a$/ }).first();
      await drag.hover();
      const start = await drag.boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down(); await page.mouse.move(620, 100, { steps: 12 });
      assert.equal(await page.locator('.drop-label').textContent(), 'Keep in Folder target');
      await page.mouse.up();
      check(`${engine.name()}: real pointer drop calls external destination without moving tab`, () => {});
      assert.equal(await page.evaluate(() => window.keptDrops), 1);
      assert.equal(await page.evaluate(() => window.testDock.find('a').side), 'left');
      await drag.hover();
      await page.mouse.down(); await page.mouse.move(620, 100, { steps: 12 });
      await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));
      await page.mouse.up();
      check(`${engine.name()}: canceled pointer drag performs no external write`, () => {});
      assert.equal(await page.evaluate(() => window.keptDrops), 1);
      await page.setViewportSize({ width: 390, height: 844 });
      const compact = await page.evaluate(() => window.testDock.snapshot());
      check(`${engine.name()}: phone presentation preserves saved groups`, () => assert.deepEqual(compact.groups.map(g => [g.side, g.keys]), result.out.groups.map(g => [g.side, g.keys])));
      // The actual Shelf uses mocked wb responses: no filesystem study data is involved.
      await page.setViewportSize({ width: 1600, height: 1000 });
      const folders = ['alpha', 'beta'].map(id => ({ id, name: id, parent: '', depth: 0, folders: [], items: [{ key: 'item-keys', kind: 'pane', label: 'Keys', open: 'keys' }] }));
      let shelfWrites = 0;
      await page.route('**/fixtures/wb/*.json', route => {
        const name = new URL(route.request().url()).pathname.split('/').pop();
        if (name === 'shelf.json') return route.fulfill({ json: { folders } });
        const plan = /set-(?:open|show)-(alpha|beta)\.json/.exec(name);
        if (plan) return route.fulfill({ json: folders.find(f => f.id === plan[1]) });
        if (name.startsWith('set-add-alpha-')) { shelfWrites++; return route.fulfill({ json: { added: true } }); }
        return route.fulfill({ json: {} });
      });
      await page.goto(`http://127.0.0.1:${port}/h05-check`);
      const ownership = await page.evaluate(async () => {
        const panes = await import('/src/panes.ts'); const shelf = await import('/src/shelf.ts');
        panes.initPanes(document.getElementById('host')); window.shelfDock = panes.dock;
        const p = shelf.openShelf(); await p.ready;
        await shelf.openAll('alpha'); await shelf.openAll('beta');
        const owners = panes.dock.find('keys').owners.map(m => m.set);
        await shelf.closeAll('alpha'); const sharedRemains = !!panes.dock.find('keys');
        await shelf.closeAll('beta'); const sharedCloses = !panes.dock.find('keys');
        const manual = panes.openKeys(); await manual.ready;
        await shelf.openAll('alpha'); await shelf.closeAll('alpha');
        const manualRemains = !!panes.dock.find('keys');
        panes.dock.move(manual, 'left'); panes.dock.show(p);
        return { owners, sharedRemains, sharedCloses, manualRemains };
      });
      check(`${engine.name()}: Shelf shared ownership and preexisting pane preservation`, () => {
        assert.deepEqual(ownership.owners, ['alpha', 'beta']); assert.equal(ownership.sharedRemains, true); assert.equal(ownership.sharedCloses, true); assert.equal(ownership.manualRemains, true);
      });
      const keysTab = page.locator('.tab-name').filter({ hasText: /^Keys$/ });
      await keysTab.hover();
      const tab = await keysTab.boundingBox();
      const folder = await page.locator('.shelf-folder[data-folder="alpha"]').boundingBox();
      await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2); await page.mouse.down();
      await page.mouse.move(folder.x + folder.width / 2, folder.y + folder.height / 2, { steps: 15 });
      assert.equal(await page.locator('.drop-label').textContent(), 'Keep in alpha');
      await page.mouse.up();
      await page.waitForFunction(() => !document.querySelector('.tab-ghost'));
      await page.waitForTimeout(150);
      check(`${engine.name()}: real Dock-to-Shelf pointer writes one pointer and retains placement`, () => assert.equal(shelfWrites, 1));
      assert.equal(await page.evaluate(() => window.shelfDock.find('keys').side), 'left');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.shelfDock.show(window.shelfDock.find('shelf')));
      await page.locator('.shelf-item[data-folder="alpha"] .shelf-more').click();
      assert.equal(await page.getByText('Move to…', { exact: true }).isVisible(), true);
      await page.keyboard.press('Escape');
      await page.locator('.shelf-folder[data-folder="alpha"] .shelf-more').click();
      assert.equal(await page.getByText('Open all', { exact: true }).count(), 0);
      check(`${engine.name()}: phone item menu is visible and folder Open All is absent`, () => {});
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
console.log(`${checks}/${checks} H05 layout checks passed`);
