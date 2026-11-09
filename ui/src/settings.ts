// Settings (R4, docs/redesign-R4.md): one pane for what the window can be set to, and the person's own theme. Each change
// is saved the moment it is made, per key, in settings/<part>.json (`wb settings <part> <key> <value>` does the same from
// a terminal); the browser's localStorage still keeps a copy so the window starts in the right theme before the files
// are read. Nothing here interprets scripture: it is color, type and switches.
import { api, inApp, wb } from './api';
import { dock } from './panes';
import { toast } from './sheets';
import { h, hoverMode, setHover } from './ui';
import { section as layoutsSection } from './layouts';
import { form, kept, loadKept, remove as removeKept, run as runKept, save as saveKept, topUsed, type Kept } from './mycommands';
import { perf } from './perf';

/** What main.ts lends: the text size and the version live there. */
export const bridge = {
  size: () => 100,
  setSize: (_n: number) => {},
  version: () => 'KJV',
  setVersion: async (_v: string): Promise<string> => '',
  openKeys: () => {},
  inputMode: () => 'auto',
  setInputMode: (_m: string) => {},
};

type Json = unknown;
const save = (part: string, key: string, value: Json | null) =>
  wb(['settings', part, key, value === null ? 'default' : JSON.stringify(value)]).catch(e => toast(String(e)));

// ---- the theme: a base plus only the colors changed --------------------------------------------------------------------
/** The colors a theme can set: token → [its CSS variable, what it is called here, its group]. */
export const TOKENS: [string, string, string, string][] = [
  ['bg', '--bg', 'Page behind the text', 'Surfaces'],
  ['surface', '--surface', 'Cards, panes', 'Surfaces'],
  ['sunken', '--sunken', 'Toolbars, wells', 'Surfaces'],
  ['line', '--line', 'Lines', 'Surfaces'],
  ['fg', '--fg', 'Text', 'Text'],
  ['muted', '--muted', 'Secondary text', 'Text'],
  ['accent', '--accent', 'Accent', 'Text'],
  ['accentSoft', '--accent-soft', 'Selection', 'Text'],
  ['onAccent', '--on-accent', 'Text on the accent', 'Text'],
  ['jesus', '--jesus', 'Words of Jesus', 'Scripture'],
  ['hlYellow', '--hl-yellow', 'Yellow mark', 'Scripture'],
  ['hlGreen', '--hl-green', 'Green mark', 'Scripture'],
  ['hlBlue', '--hl-blue', 'Blue mark', 'Scripture'],
  ['hlPink', '--hl-pink', 'Pink mark', 'Scripture'],
  ['hlOrange', '--hl-orange', 'Orange mark', 'Scripture'],
  ['threadA', '--thread-a', 'Thread underline A', 'Threads'],
  ['threadB', '--thread-b', 'Thread underline B', 'Threads'],
  ['question', '--question', 'An open question', 'Threads'],
];
const BASES = ['system', 'light', 'dark', 'eink'];
const BASE_NAMES: Record<string, string> = { system: 'System', light: 'Light', dark: 'Dark', eink: 'E-ink' };

export interface Theme { name: string; base: string; colors: Record<string, string>; fonts?: { read?: string; ui?: string } }
export const themeState: { active: string; themes: Theme[] } = { active: 'System', themes: [] };

const READ_FACES = ['Literata', 'Iowan Old Style', 'Palatino', 'Georgia', 'serif'];
const UI_FACES = ['Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'];

const root = () => document.documentElement;
const baseOf = (active: string): { base: string; theme?: Theme } => {
  const b = BASES.find(x => BASE_NAMES[x] === active);
  if (b) return { base: b };
  const t = themeState.themes.find(x => x.name === active);
  return t ? { base: BASES.includes(t.base) ? t.base : 'system', theme: t } : { base: 'system' };
};

/** Draw the active theme: the base through data-theme, the changed colors and fonts as variables on the root. */
export function applyTheme() {
  const { base, theme } = baseOf(themeState.active);
  if (base === 'system') delete root().dataset.theme; else root().dataset.theme = base;
  try { localStorage.setItem('wb.theme', base); } catch { /* this run only */ }
  for (const [, v] of TOKENS) root().style.removeProperty(v);
  root().style.removeProperty('--font-read');
  root().style.removeProperty('--font-ui');
  if (!theme) return;
  for (const [k, v] of TOKENS) if (theme.colors[k]) root().style.setProperty(v, theme.colors[k]);
  if (theme.fonts?.read) root().style.setProperty('--font-read', `"${theme.fonts.read}", serif`);
  if (theme.fonts?.ui) root().style.setProperty('--font-ui', `"${theme.fonts.ui}", system-ui, sans-serif`);
}

/** The base's own value of a color (what the theme starts from): the variables set aside while the browser is asked. */
function baseColor(cssVar: string): string {
  const style = root().style;
  const held = style.getPropertyValue(cssVar);
  style.removeProperty(cssVar);
  const v = getComputedStyle(root()).getPropertyValue(cssVar).trim();
  if (held) style.setProperty(cssVar, held);
  return v;
}
const hex6 = (c: string) => {
  const m = /^#([0-9a-f]{6})/i.exec(c) ?? /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (!m) return '#000000';
  return m.length === 2 ? `#${m[1]}`.toUpperCase() : `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
};

export function lum(c: string): number {
  const h6 = hex6(c);
  const f = (i: number) => { const v = parseInt(h6.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const saveThemes = async () => {
  await save('theme', 'themes', themeState.themes);
  await save('theme', 'active', themeState.active);
};

/** What the files hold, applied; and anything only the browser had, moved into the files once. */
export async function loadWindowSettings() {
  if (!inApp) return;
  try {
    const t: any = await wb(['settings', 'theme']);
    if (Array.isArray(t.themes)) themeState.themes = t.themes;
    if (typeof t.active === 'string') themeState.active = t.active;
    else {
      const old = localStorage.getItem('wb.theme');
      if (old && BASE_NAMES[old]) { themeState.active = BASE_NAMES[old]; await save('theme', 'active', themeState.active); }
    }
    applyTheme();
    const r: any = await wb(['settings', 'reading']);
    if (typeof r.size === 'number') bridge.setSize(r.size); else if (bridge.size() !== 100) await save('reading', 'size', bridge.size());
    if (typeof r.version === 'string' && r.version.toUpperCase() !== bridge.version()) await bridge.setVersion(r.version);
    else if (typeof r.version !== 'string' && bridge.version() !== 'KJV') await save('reading', 'version', bridge.version());
    const hv: any = await wb(['settings', 'hover']);
    if (typeof hv.mode === 'string') setHover(hv.mode); else if (hoverMode() !== 'off') await save('hover', 'mode', hoverMode());
  } catch { /* the window's own copy stands */ }
}

// ---- the pane -----------------------------------------------------------------------------------------------------------
const SECTIONS = ['Reading', 'Notebook', 'Hover and cards', 'Theme', 'Layouts', 'Commands', 'Keys', 'Advanced'] as const;
type Section = (typeof SECTIONS)[number];
let current: Section = 'Reading';

function row(name: string, what: string, ctl: HTMLElement, keywords = '') {
  const r = h('div', 'set-row');
  const t = h('div', 'set-text');
  t.append(h('div', 'set-name', name), h('div', 'muted small', what));
  r.append(t, ctl);
  r.dataset.find = `${name} ${what} ${keywords}`.toLowerCase();
  return r;
}
function seg(opts: string[], cur: string, pick: (o: string) => void) {
  const s = h('div', 'seg');
  for (const o of opts) {
    const x = h('button', o === cur ? 'on' : '', o);
    x.onclick = () => { s.querySelectorAll('button').forEach(y => y.classList.remove('on')); x.classList.add('on'); pick(o); };
    s.append(x);
  }
  return s;
}
function toggle(on: boolean, flip: (v: boolean) => void) {
  const cb = h('input', 'switch') as HTMLInputElement;
  cb.type = 'checkbox';
  cb.checked = on;
  cb.onchange = () => flip(cb.checked);
  return cb;
}

/** Open Settings (at a section: `settings theme`). */
export function openSettings(section: string = '') {
  const s = SECTIONS.find(x => x.toLowerCase().startsWith(section.trim().toLowerCase()));
  if (s) current = s;
  return dock.open('settings', 'Settings', 'settings', 'right', el => draw(el));
}

function draw(el: HTMLElement, query = '') {
  el.replaceChildren();
  const head = h('header', 'pane-head');
  head.append(h('h2', 'pane-title', 'Settings'), h('div', 'pane-sub', 'Saved as you make each change'));
  const find = h('input', 'field set-find') as HTMLInputElement;
  find.placeholder = 'Find a setting';
  find.value = query;
  head.append(find);
  el.append(head);
  const wrap = h('div', 'set-wrap');
  const nav = h('nav', 'set-nav');
  const body = h('div', 'set-body');
  wrap.append(nav, body);
  el.append(wrap);
  const rebuild = () => draw(el, find.value);
  find.oninput = () => rebuild();
  for (const name of SECTIONS) {
    const b = h('button', name === current && !query ? 'on' : '', name);
    b.onclick = () => { current = name; draw(el); };
    nav.append(b);
  }
  void (async () => {
    if (!query) { body.append(...(await section(current, rebuild))); return; }
    // a search runs across every section and shows the rows that match
    const q = query.toLowerCase();
    let found = 0;
    for (const name of SECTIONS) {
      const rows = (await section(name, rebuild)).filter(x => (x as HTMLElement).dataset.find?.includes(q));
      if (!rows.length) continue;
      body.append(h('div', 'label', name), ...rows);
      found += rows.length;
    }
    if (!found) body.append(h('p', 'muted', `No setting matches “${query}”.`));
  })();
}

async function section(name: Section, redraw: () => void): Promise<HTMLElement[]> {
  const out: HTMLElement[] = [];
  const reset = (part: string, keys: string[], note = 'Reset this page') => {
    const b = h('button', 'link-btn', note);
    b.onclick = async () => { for (const k of keys) await save(part, k, null); if (part === 'reading') { bridge.setSize(100); } if (part === 'hover') setHover('off'); redraw(); };
    return b;
  };
  if (name === 'Reading') {
    let pct = bridge.size();
    const label = h('span', 'size-pct', `${pct}%`);
    const step = (n: number) => { bridge.setSize(n === 100 ? 100 : pct + n); pct = bridge.size(); label.textContent = `${pct}%`; void save('reading', 'size', pct); };
    const ctl = h('div', 'size-row');
    const minus = h('button', 'btn', 'A−'), plus = h('button', 'btn', 'A+'), r100 = h('button', 'btn', '100%');
    minus.onclick = () => step(-10); plus.onclick = () => step(10); r100.onclick = () => step(100);
    ctl.append(minus, label, plus, r100);
    out.push(row('Text size', 'How large scripture is drawn; Ctrl+= and Ctrl+- do the same', ctl, 'font zoom'));
    out.push(row('Version', 'The reader’s version', seg(['KJV', 'YLT'], bridge.version(), v => { void bridge.setVersion(v).then(toast); void save('reading', 'version', v); }), 'translation kjv ylt'));
    out.push(reset('reading', ['size', 'version']));
  } else if (name === 'Notebook') {
    let about: any[] = [];
    try { about = await wb(['settings', 'notebook', '--about']); } catch { /* none */ }
    for (const a of about) {
      let ctl: HTMLElement;
      if (typeof a.default === 'boolean') ctl = toggle(!!a.value, v => void wb(['settings', 'notebook', a.key, v ? 'on' : 'off']).catch(e => toast(String(e))));
      else if (a.key === 'group') ctl = seg(['day', 'chapter', 'thread', 'none', 'pages', 'questions'], a.value, v => void wb(['settings', 'notebook', 'group', v]).catch(e => toast(String(e))));
      else if (a.key === 'places') ctl = seg(['reader', 'new'], a.value, v => void wb(['settings', 'notebook', 'places', v]).catch(e => toast(String(e))));
      else {
        const i = h('input', 'field set-key') as HTMLInputElement;
        i.value = a.value;
        i.onchange = () => void wb(['settings', 'notebook', a.key, i.value]).then(() => toast('Saved'), e => toast(String(e)));
        ctl = i;
      }
      out.push(row(String(a.what).split(':')[0], String(a.what), ctl, a.key));
    }
  } else if (name === 'Hover and cards') {
    out.push(row('Hover cards', 'Off: a click opens a card, as a tap does. Refs: only references in notes show a card on hover. On: every word and reference.',
      seg(['off', 'refs', 'on'], hoverMode(), m => { setHover(m); void save('hover', 'mode', m); }), 'tooltip preview'));
    out.push(reset('hover', ['mode']));
  } else if (name === 'Theme') {
    out.push(await themeSection(redraw));
  } else if (name === 'Layouts') {
    out.push(...(await layoutsSection(redraw)));
  } else if (name === 'Commands') {
    out.push(...(await commandsSection(redraw)));
  } else if (name === 'Keys') {
    const b = h('button', 'btn', 'Open the list of keys (Help ▸ Keys)');
    b.onclick = () => bridge.openKeys();
    out.push(row('Keys', 'Every key the window understands. The quick-capture key is set under Notebook.', b, 'shortcut keyboard'));
  } else if (name === 'Advanced') {
    out.push(row('Input', 'Auto follows the device; touch or pointer forces the other (bigger targets, handles on selections)',
      seg(['auto', 'touch', 'pointer'], bridge.inputMode(), m => bridge.setInputMode(m)), 'touch mouse'));
    if (inApp) {
      const PRESETS = [['phone', 'Phone 390×844'], ['phone-landscape', 'Phone landscape'], ['ipad', 'iPad portrait'], ['ipad-landscape', 'iPad landscape'], ['laptop', 'Laptop 1280×800'], ['laptop-large', 'Laptop 1440×900'], ['desktop', 'Desktop 1920×1080']];
      const ctl = h('div', 'wrap');
      for (const [id, nm] of PRESETS) {
        const x = h('button', 'btn', nm);
        x.onclick = async () => { const r = await api.setWindow(id); toast(`${r.got[0]}×${r.got[1]}`); };
        ctl.append(x);
      }
      out.push(row('Window size', 'For checking how the window looks at other sizes', ctl, 'resize preset'));
    }
    const pre = h('pre', 'perf', perf.summary());
    out.push(row('Measured this run', 'Timings since the window opened', pre, 'speed performance'));
    out.push(row('Later phases', 'Documents: the Speaker Script and Verse by Verse are made from Documents; PowerPoint, lessons and the other structures are phase 5; read aloud and recordings, phase 6. The Python app still does them.', h('span'), 'python'));
  }
  return out;
}

async function themeSection(redraw: () => void): Promise<HTMLElement> {
  const box = h('div', 'theme-ed');
  const chips = h('div', 'theme-chips');
  const pick = (n: string) => { themeState.active = n; applyTheme(); void save('theme', 'active', n); redraw(); };
  for (const n of [...Object.values(BASE_NAMES), ...themeState.themes.map(t => t.name)]) {
    const b = h('button', `theme-chip${n === themeState.active ? ' on' : ''}`, n === 'E-ink' ? 'E-ink' : n);
    b.onclick = () => pick(n);
    chips.append(b);
  }
  const mk = h('button', 'btn soft', '+ New theme');
  mk.onclick = () => {
    const name = freeName('My theme');
    const base = baseOf(themeState.active).base;
    themeState.themes.push({ name, base, colors: {} });
    themeState.active = name;
    applyTheme();
    void saveThemes();
    redraw();
  };
  chips.append(mk);
  box.append(chips);
  const { theme } = baseOf(themeState.active);
  if (!theme) {
    box.append(h('p', 'muted', 'These four come with the app. Make a theme of your own to change colors and fonts: it starts from the one chosen here and keeps only what you change.'));
    return box;
  }
  const changed = () => Object.keys(theme.colors).length;
  const hd = h('div', 'theme-head');
  const nm = h('input', 'field theme-name') as HTMLInputElement;
  nm.value = theme.name;
  nm.onchange = () => {
    const v = nm.value.trim();
    if (!v || Object.values(BASE_NAMES).includes(v) || themeState.themes.some(t => t !== theme && t.name === v)) { toast('That name is taken'); nm.value = theme.name; return; }
    theme.name = v; themeState.active = v; void saveThemes(); redraw();
  };
  const basePick = h('select', 'field') as HTMLSelectElement;
  for (const b of BASES) { const o = h('option', '', `based on ${BASE_NAMES[b]}`) as HTMLOptionElement; o.value = b; o.selected = b === theme.base; basePick.append(o); }
  basePick.onchange = () => { theme.base = basePick.value; applyTheme(); void saveThemes(); redraw(); };
  const count = h('span', 'muted small', `${changed()} color${changed() === 1 ? '' : 's'} changed`);
  const resetAll = h('button', 'link-btn', `Reset to ${BASE_NAMES[theme.base]}`);
  resetAll.onclick = () => { theme.colors = {}; theme.fonts = undefined; applyTheme(); void saveThemes(); redraw(); };
  const del = h('button', 'link-btn danger', 'Delete this theme');
  del.onclick = () => {
    if (!confirm(`Delete the theme “${theme.name}”?`)) return;
    themeState.themes = themeState.themes.filter(t => t !== theme);
    themeState.active = BASE_NAMES[theme.base] ?? 'System';
    applyTheme(); void saveThemes(); redraw();
  };
  hd.append(nm, basePick, count, resetAll);
  box.append(hd);
  const eff = (k: string, v: string) => theme.colors[k] ?? baseColor(v);
  const groups = new Map<string, typeof TOKENS>();
  for (const t of TOKENS) groups.set(t[3], [...(groups.get(t[3]) ?? []), t]);
  const cols = h('div', 'theme-cols');
  const contrastBox = h('div', 'theme-contrast');
  const drawContrast = () => {
    contrastBox.replaceChildren(h('div', 'label', 'Contrast, measured'));
    const pairs: [string, string, string][] = [['Text on page', 'fg', 'bg'], ['Secondary on page', 'muted', 'bg'], ['Accent on page', 'accent', 'bg'], ['Words of Jesus on page', 'jesus', 'bg'], ['Text on yellow', 'fg', 'hlYellow']];
    for (const [lab, a, b] of pairs) {
      const va = TOKENS.find(t => t[0] === a)![1], vb = TOKENS.find(t => t[0] === b)![1];
      const r = contrast(eff(a, va), eff(b, vb));
      const line = h('div', 'contrast-row');
      line.append(h('span', '', lab), h('span', `muted small${r < 4.5 ? ' warn' : ''}`, `${r.toFixed(1)}:1 ${r >= 4.5 ? '✓' : '(low)'}`));
      contrastBox.append(line);
    }
    contrastBox.append(h('p', 'muted small', '4.5:1 is the usual floor for reading text. A low figure is shown, never enforced.'));
  };
  for (const [g, items] of groups) {
    const col = h('div', 'theme-group');
    col.append(h('div', 'label', g));
    for (const [k, v, label] of items) {
      const r = h('div', 'color-row');
      const pickEl = h('input') as HTMLInputElement;
      pickEl.type = 'color';
      pickEl.value = hex6(eff(k, v)).toLowerCase();
      const hx = h('input', 'field hex') as HTMLInputElement;
      hx.value = hex6(eff(k, v));
      const dot = h('i', `changed-dot${theme.colors[k] ? ' on' : ''}`);
      dot.title = 'Put back the base’s color';
      const set = (val: string) => {
        const c = hex6(val);
        theme.colors[k] = c;
        pickEl.value = c.toLowerCase(); hx.value = c; dot.classList.add('on');
        applyTheme(); count.textContent = `${changed()} color${changed() === 1 ? '' : 's'} changed`; drawContrast();
      };
      pickEl.oninput = () => set(pickEl.value);
      pickEl.onchange = () => void saveThemes();
      hx.onchange = () => { if (/^#?[0-9a-f]{6}$/i.test(hx.value.trim())) { set(hx.value.trim().startsWith('#') ? hx.value.trim() : `#${hx.value.trim()}`); void saveThemes(); } else hx.value = hex6(eff(k, v)); };
      dot.onclick = () => { delete theme.colors[k]; applyTheme(); void saveThemes(); redraw(); };
      r.append(pickEl, h('span', 'color-name', label), hx, dot);
      col.append(r);
    }
    cols.append(col);
  }
  const side = h('div', 'theme-group');
  side.append(contrastBox);
  const fonts = h('div', 'theme-fonts');
  fonts.append(h('div', 'label', 'Fonts'));
  const face = (label: string, opts: string[], cur: string | undefined, set: (v: string | undefined) => void) => {
    const sel = h('select', 'field') as HTMLSelectElement;
    const dflt = h('option', '', 'The base’s') as HTMLOptionElement; dflt.value = ''; sel.append(dflt);
    for (const f of opts) { const o = h('option', '', f) as HTMLOptionElement; o.value = f; o.selected = f === cur; sel.append(o); }
    sel.onchange = () => { set(sel.value || undefined); theme.fonts = { ...theme.fonts }; applyTheme(); void saveThemes(); };
    const r = h('div', 'color-row');
    r.append(h('span', 'color-name', label), sel);
    return r;
  };
  fonts.append(face('Scripture', READ_FACES, theme.fonts?.read, v => { theme.fonts = { ...theme.fonts, read: v }; }));
  fonts.append(face('Interface', UI_FACES, theme.fonts?.ui, v => { theme.fonts = { ...theme.fonts, ui: v }; }));
  side.append(fonts);
  cols.append(side);
  drawContrast();
  box.append(cols, del);
  return box;
}

function freeName(base: string): string {
  let n = base, i = 2;
  while (themeState.themes.some(t => t.name === n) || Object.values(BASE_NAMES).includes(n)) n = `${base} ${i++}`;
  return n;
}

async function commandsSection(redraw: () => void): Promise<HTMLElement[]> {
  const out: HTMLElement[] = [];
  await loadKept();
  const slot = h('div', 'cmd-slot');
  const edit = (c: Kept | null) => { slot.replaceChildren(form(c, () => { slot.replaceChildren(); redraw(); })); };
  for (const c of kept) {
    const t = h('div', 'set-text');
    t.append(h('div', 'set-name', c.name), h('div', 'muted small', c.line + (c.key ? `   ${c.key}` : '')));
    const ctl = h('div', 'wrap');
    const go = h('button', 'btn', 'Run'); go.onclick = () => void runKept(c);
    const ed = h('button', 'btn', 'Edit'); ed.onclick = () => edit(c);
    const rm = h('button', 'link-btn danger', 'Remove'); rm.onclick = () => void removeKept(c).then(redraw);
    ctl.append(go, ed, rm);
    const r = h('div', 'set-row');
    r.append(t, ctl);
    r.dataset.find = `${c.name} ${c.line} commands`.toLowerCase();
    out.push(r);
  }
  const add = h('button', 'btn soft', '+ A command of your own…');
  add.onclick = () => edit(null);
  out.push(add, slot);
  const top = await topUsed();
  if (top.length) {
    const box = h('div', 'cmd-top');
    box.append(h('div', 'label', 'Used most (from your log)'));
    for (const t of top.slice(0, 8)) {
      const r = h('div', 'set-row');
      const x = h('div', 'set-text');
      x.append(h('div', 'set-name', t.line), h('div', 'muted small', `${t.times} time${t.times === 1 ? '' : 's'}`));
      const k = h('button', 'btn', 'Keep');
      k.onclick = async () => { await saveKept({ name: t.line.slice(0, 40), line: t.line, icon: '', key: '' }); redraw(); };
      r.append(x, k);
      r.dataset.find = `${t.line} used most`.toLowerCase();
      box.append(r);
    }
    out.push(box);
  }
  return out;
}
