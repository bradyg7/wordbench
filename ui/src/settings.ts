// Settings (R4, docs/archive/2026-11-10/docs/redesign-R4.md): one pane for what the window can be set to, and the person's own theme. Each change
// is saved the moment it is made, per key, in settings/<part>.json (`wb settings <part> <key> <value>` does the same from
// a terminal); the browser's localStorage still keeps a copy so the window starts in the right theme before the files
// are read. Nothing here interprets scripture: it is color, type and switches.
import { invoke } from '@tauri-apps/api/core';
import { api, inApp, wb } from './api';
import { customize as customizeToolbar } from './toolbar';
import { guideRows, hasKeyboard, keysRows, manualRows } from './guide';
import { toast } from './sheets';
import { h, hoverMode, icon, setHover } from './ui';
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
export const themeState: { active: string; themes: Theme[]; italics: Record<string, string>; marks: Record<string, string> } =
  { active: 'System', themes: [], italics: {}, marks: {} };

/** How italic words (the translators' added words) are drawn, per theme (design/features/settings TH1; e31a, 6bb0). */
export const ITALICS: [string, string][] = [['italic', 'Italic'], ['grey', 'Grey'], ['grey-italic', 'Grey italic'], ['underline', 'Underlined'], ['plain', 'Plain']];
const darkNow = (base: string) => base === 'dark' || (base === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
export function italicStyle(name = themeState.active): string {
  const saved = themeState.italics[name];
  if (saved && ITALICS.some(([k]) => k === saved)) return saved;
  return darkNow(baseOf(name).base) ? 'grey-italic' : 'italic';
}
/** A mark's name (b99f: a color can stand for a topic), else its color's. */
export const markName = (c: string) => themeState.marks[c]?.trim() || c[0].toUpperCase() + c.slice(1);

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
  root().dataset.italic = italicStyle();
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
    if (t.italics && typeof t.italics === 'object') themeState.italics = t.italics;
    if (t.marks && typeof t.marks === 'object') themeState.marks = t.marks;
    if (typeof t.active === 'string') themeState.active = t.active;
    else {
      const old = localStorage.getItem('wb.theme');
      if (old && BASE_NAMES[old]) { themeState.active = BASE_NAMES[old]; await save('theme', 'active', themeState.active); }
    }
    applyTheme();
    const r: any = await wb(['settings', 'reading']);
    if (typeof r.size === 'number') bridge.setSize(r.size); else if (bridge.size() !== 100) await save('reading', 'size', bridge.size());
    for (const [k, key] of Object.entries(MIRROR)) if (typeof r[key] === 'string') { try { localStorage.setItem(k, r[key]); } catch { /* this run only */ } }
    if (typeof r.version === 'string' && r.version.toUpperCase() !== bridge.version()) await bridge.setVersion(r.version);
    else if (typeof r.version !== 'string' && bridge.version() !== 'KJV') await save('reading', 'version', bridge.version());
    const hv: any = await wb(['settings', 'hover']);
    if (typeof hv.mode === 'string') setHover(hv.mode); else if (hoverMode() !== 'off') await save('hover', 'mode', hoverMode());
  } catch { /* the window's own copy stands */ }
}

// ---- the pane -----------------------------------------------------------------------------------------------------------
// design/features/settings (accepted 2026-11-13): eight tabs became these; Hover and cards joined Reading, Advanced
// became Study folder (window size and timings only with the developer switch), Documents is new.
// Help is the menu's second half (design/features/help, 2026-11-13): Guide, Keys (the only keys section), Manual.
const SECTIONS = ['Reading', 'Theme', 'Notebook', 'Layouts', 'Commands', 'Study folder', 'Documents', 'Guide', 'Keys', 'Manual'] as const;
type Section = (typeof SECTIONS)[number];
let current: Section = 'Reading';
/** Older names still open the tab that holds them now (`settings advanced`, `settings hover`). */
const OLD: Record<string, Section> = { advanced: 'Study folder', hover: 'Reading', study: 'Study folder', docs: 'Documents', help: 'Guide', commands: 'Commands' };
/** Where Help opens: a Guide group or topic to outline, or a Manual command to open. */
let focus = '';
/** Keys shows only with a keyboard (a phone or tablet has none until a key is pressed). */
const keyed = () => hasKeyboard(bridge.inputMode());
const shown = () => SECTIONS.filter(x => x !== 'Keys' || keyed());

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
export function openSettings(section: string = '', at = '') {
  const want = section.trim().toLowerCase();
  const s = want ? (OLD[want.split(' ')[0]] ?? SECTIONS.find(x => x.toLowerCase().startsWith(want))) : undefined;
  if (s) current = s;
  if (current === 'Keys' && !keyed()) current = 'Guide';
  focus = at;
  // Settings is its own menu, pulled to the front over the blurred app (the person, 2026-11-13): a customizer, not
  // a pane of the study. One at a time; Esc, × or a click outside closes it.
  let back = document.querySelector<HTMLElement>('.set-backdrop');
  if (back) { const el = back.querySelector<HTMLElement>('.set-pane')!; draw(el); return el; }
  const before = document.activeElement as HTMLElement | null;
  back = h('div', 'set-backdrop');
  const box = h('div', 'set-modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Settings and Help');
  const x = h('button', 'icon-btn set-close', '×');
  x.title = 'Close Settings (Esc)'; x.setAttribute('aria-label', 'Close Settings');
  const el = h('div', 'set-modal-body');
  box.append(x, el);
  back.append(box);
  const app = [...document.body.children].filter(c => c !== back) as HTMLElement[];
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    for (const c of app) c.inert = false;
    back!.remove();
    before?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if ((e.target as HTMLElement).closest?.('.menu-list, .popmenu')) return;
    e.preventDefault(); e.stopPropagation(); close();
  };
  x.onclick = close;
  back.onpointerdown = e => { if (e.target === back) close(); };
  document.addEventListener('keydown', onKey, true);
  document.body.append(back);
  for (const c of app) c.inert = true;
  draw(el);
  x.focus();
  return el;
}

/** Each tab's icon and the groups the list is split into (as a settings panel: lines between groups). */
const ICON_OF: Record<Section, string> = {
  Reading: 'book', Theme: 'eye', Notebook: 'notebook', Layouts: 'sidebar', Commands: 'prompt', Keys: 'lines',
  'Study folder': 'folder', Documents: 'file', Guide: 'help', Manual: 'book',
};
const GROUPS: Section[][] = [['Reading', 'Theme'], ['Notebook', 'Layouts', 'Commands'], ['Study folder', 'Documents'], ['Guide', 'Keys', 'Manual']];

/** The Settings menu: a title bar, the search and tabs down the left (still), the chosen tab on the right (scrolls).
 *  Built once per opening; typing in the search only filters (the person, 2026-11-13: it froze on every letter, because
 *  each letter rebuilt the menu and asked every tab for its rows again). */
function draw(el: HTMLElement, query = '') {
  el.replaceChildren();
  el.classList.add('set-pane');
  const bar = h('header', 'set-titlebar');
  bar.append(h('h2', 'set-title', 'Settings'));
  el.append(bar);

  const find = h('input', 'field set-find') as HTMLInputElement;
  find.type = 'search';
  find.placeholder = 'Search';
  find.setAttribute('aria-label', 'Search settings');
  find.value = query;

  // narrow (a phone): the tabs become a menu above the settings, with the same search
  const menu = h('select', 'field set-nav-menu') as HTMLSelectElement;
  menu.setAttribute('aria-label', 'Settings section');
  for (const name of shown()) { const o = h('option', '', name) as HTMLOptionElement; o.value = name; o.selected = name === current; menu.append(o); }
  const narrow = h('div', 'set-narrow-bar');
  const find2 = h('input', 'field') as HTMLInputElement;
  find2.type = 'search'; find2.placeholder = 'Search'; find2.setAttribute('aria-label', 'Search settings (narrow)');
  narrow.append(menu, find2);
  el.append(narrow);

  const wrap = h('div', 'set-wrap');
  const nav = h('nav', 'set-nav');
  nav.setAttribute('aria-label', 'Settings sections');
  const searchBox = h('div', 'set-search');
  searchBox.append(icon('search', 15), find);
  nav.append(searchBox);
  const buttons = new Map<Section, HTMLButtonElement>();
  GROUPS.forEach((g, i) => {
    if (i === GROUPS.length - 1) nav.append(h('div', 'set-group-label', 'Help'));
    else if (i) nav.append(h('hr', 'set-sep'));
    for (const name of g) {
      if (name === 'Keys' && !keyed()) continue;
      const b = h('button', 'set-tab') as HTMLButtonElement;
      b.append(icon(ICON_OF[name], 17), h('span', '', name));
      b.onclick = () => { find.value = ''; find2.value = ''; current = name; menu.value = name; show(); };
      buttons.set(name, b);
      nav.append(b);
    }
  });
  const body = h('div', 'set-body');
  wrap.append(nav, body);
  el.append(wrap);

  // rows are made once per tab and kept until something changes (redraw), so a search never asks again
  const cache = new Map<Section, Promise<HTMLElement[]>>();
  const rowsOf = (name: Section) => { if (!cache.has(name)) cache.set(name, section(name, redraw)); return cache.get(name)!; };
  let token = 0;
  const show = async () => {
    const mine = ++token;
    const q = find.value.trim().toLowerCase();
    for (const [n, b] of buttons) b.classList.toggle('on', !q && n === current);
    if (!q) {
      const rows = await rowsOf(current);
      if (mine !== token) return;
      body.replaceChildren(h('h3', 'set-heading', current), ...rows);
      const at = body.querySelector<HTMLElement>('.guide-card.focus, details.doc[open]');
      if (at) at.scrollIntoView({ block: 'center' }); else body.scrollTop = 0;
      focus = '';
      return;
    }
    const parts: HTMLElement[] = [];
    for (const name of shown()) {
      const rows = (await rowsOf(name)).filter(x => x.dataset.find?.includes(q));
      if (rows.length) parts.push(h('h3', 'set-heading', name), ...rows);
    }
    if (mine !== token) return;
    body.replaceChildren(...(parts.length ? parts : [h('p', 'muted', `No setting matches “${find.value.trim()}”.`)]));
  };
  // something was changed in a tab: its rows are made again, the search and the tab stay as they were
  function redraw() { cache.clear(); void show(); }
  let wait = 0;
  const typed = (from: HTMLInputElement, to: HTMLInputElement) => () => {
    to.value = from.value;
    clearTimeout(wait);
    wait = window.setTimeout(() => void show(), 120);
  };
  find.oninput = typed(find, find2);
  find2.oninput = typed(find2, find);
  menu.onchange = () => { find.value = ''; find2.value = ''; current = menu.value as Section; void show(); };
  void show();
  setTimeout(() => find.focus());
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
    out.push(row('Cards on hover', 'Off: a click opens a card, as a tap does. References: only references in pages show a card on hover. Everything: every word and reference.',
      seg(['Off', 'References', 'Everything'], { off: 'Off', refs: 'References', on: 'Everything' }[hoverMode()] ?? 'Off',
        m => { const v = m === 'Off' ? 'off' : m === 'References' ? 'refs' : 'on'; setHover(v); void save('hover', 'mode', v); }), 'hover tooltip preview cards'));
    out.push(...readAloudRows());
    out.push(copyRow());
    const tb = h('button', 'btn', 'Choose…');
    tb.onclick = () => customizeToolbar();
    out.push(row('Toolbar', 'Which buttons sit on the top bar, and in what order', tb, 'toolbar buttons bar customize'));
    out.push(reset('reading', ['size', 'version']));
  } else if (name === 'Notebook') {
    let about: any[] = [];
    try { about = await wb(['settings', 'notebook', '--about']); } catch { /* none */ }
    // Follow the reader is set where it acts (the Places list's own switch), not here (design, e09e)
    for (const a of about.filter(x => x.key !== 'follow')) {
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
  } else if (name === 'Theme') {
    out.push(await themeSection(redraw));
  } else if (name === 'Layouts') {
    out.push(...(await layoutsSection(redraw)));
  } else if (name === 'Commands') {
    out.push(...(await commandsSection(redraw)));
  } else if (name === 'Guide') {
    out.push(...guideRows(focus));
  } else if (name === 'Keys') {
    out.push(...keysRows());
  } else if (name === 'Manual') {
    out.push(...(await manualRows(focus)));
  } else if (name === 'Study folder') {
    out.push(...(await studyRows(redraw)));
    out.push(row('Input', 'Auto follows the device; touch or pointer forces the other (bigger targets, handles on selections)',
      seg(['auto', 'touch', 'pointer'], bridge.inputMode(), m => bridge.setInputMode(m)), 'touch mouse'));
    // window size and timings are for building the app: shown only with `wb settings window developer true`
    let dev = false;
    try { dev = (await wb(['settings', 'window'])).developer === true; } catch { /* off */ }
    if (dev && inApp) {
      const PRESETS = [['phone', 'Phone 390×844'], ['phone-landscape', 'Phone landscape'], ['ipad', 'iPad portrait'], ['ipad-landscape', 'iPad landscape'], ['laptop', 'Laptop 1280×800'], ['laptop-large', 'Laptop 1440×900'], ['desktop', 'Desktop 1920×1080']];
      const ctl = h('div', 'wrap');
      for (const [id, nm] of PRESETS) {
        const x = h('button', 'btn', nm);
        x.onclick = async () => { const r = await api.setWindow(id); toast(`${r.got[0]}×${r.got[1]}`); };
        ctl.append(x);
      }
      out.push(row('Window size', 'For checking how the window looks at other sizes', ctl, 'resize preset'));
      const pre = h('pre', 'perf', perf.summary());
      out.push(row('Measured this run', 'Timings since the window opened', pre, 'speed performance'));
    }
  } else if (name === 'Documents') {
    out.push(...(await documentRows(redraw)));
  }
  return out;
}

// ---- Reading: read aloud and copying (kept in this window's storage, as Listen and copy keep them) -----------------
const ls = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
/** Kept where Listen and copy read them (this window's storage) and in settings/reading.json, so `wb settings reading`
 *  reaches them too; the files win when the window opens. */
const MIRROR: Record<string, string> = { 'wb.listen.voice': 'listen_voice', 'wb.listen.rate': 'listen_rate', 'wb.listen.markRead': 'listen_mark_read', 'wb.copy': 'copy' };
const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* this run only */ }
  if (MIRROR[k]) void save('reading', MIRROR[k], v);
};

function readAloudRows(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const voices = (() => { try { return speechSynthesis.getVoices().filter(v => v.localService && /^en\b/i.test((v.lang || '').replace('_', '-'))); } catch { return []; } })();
  const sel = h('select', 'field') as HTMLSelectElement;
  const dflt = h('option', '', 'The device’s') as HTMLOptionElement; dflt.value = ''; sel.append(dflt);
  for (const v of voices) { const o = h('option', '', v.name) as HTMLOptionElement; o.value = v.name; o.selected = v.name === ls('wb.listen.voice'); sel.append(o); }
  sel.title = sel.selectedOptions[0]?.text ?? '';
  sel.onchange = () => { sel.title = sel.selectedOptions[0]?.text ?? ''; lsSet('wb.listen.voice', sel.value); toast('Read aloud voice saved'); };
  out.push(row('Read aloud: voice', 'The voice Listen reads with (a voice on this device)', sel, 'listen voice speech'));
  const rates = ['0.8', '1', '1.2', '1.5'];
  const cur = rates.find(r => Number(r) === Number(ls('wb.listen.rate') || 1)) ?? '1';
  out.push(row('Mark read after Listen', 'When Listen finishes a chapter today’s plan asks for, offer Mark read',
    toggle(ls('wb.listen.markRead') !== 'off', v => lsSet('wb.listen.markRead', v ? 'on' : 'off')), 'listen plan mark read'));
  out.push(row('Read aloud: speed', 'How fast Listen reads', seg(rates.map(r => `${r}×`), `${cur}×`, v => lsSet('wb.listen.rate', v.replace('×', ''))), 'listen rate speed'));
  return out;
}

function copyRow(): HTMLElement {
  const saved = (() => { try { return JSON.parse(ls('wb.copy') || '{}'); } catch { return {}; } })();
  const names: Record<string, string> = { lines: 'Lines', block: 'Block', para: 'Paragraph', quote: 'Quote' };
  const by = Object.fromEntries(Object.entries(names).map(([k, v]) => [v, k]));
  const wrap = h('div', 'wrap');
  wrap.append(seg(Object.values(names), names[saved.format || 'lines'], v => { saved.format = by[v]; lsSet('wb.copy', JSON.stringify(saved)); }));
  const short = toggle(!!saved.short, v => { saved.short = v; lsSet('wb.copy', JSON.stringify(saved)); });
  const lab = h('label', 'set-inline');
  lab.append(short, h('span', 'small', 'Short reference'));
  wrap.append(lab);
  return row('Copying verses', 'How a copied verse is laid out (always with its reference)', wrap, 'copy clipboard format');
}

// ---- Study folder: where the study and the Bible are -------------------------------------------------------------
async function studyRows(redraw: () => void): Promise<HTMLElement[]> {
  const out: HTMLElement[] = [];
  if (!inApp) return out;
  let st: any = null;
  try { st = await invoke('setup_status'); } catch { /* an older shell */ }
  if (!st) return out;
  const change = (cmd: string) => {
    const b = h('button', 'btn', 'Change…');
    b.onclick = async () => { try { await invoke(cmd); toast('Saved'); redraw(); } catch (e) { toast(String(e)); } };
    return b;
  };
  out.push(row('Study folder', `${st.study.path} · ${st.study.detail}`, change('choose_study_dir'), 'study folder notes path'));
  out.push(row('Bible database', `${st.db.path} · read-only · ${st.db.detail}`, change('choose_bible_db'), 'bible database db'));
  return out;
}

// ---- Documents: what new Word files and slides start with -------------------------------------------------------
async function documentRows(redraw: () => void): Promise<HTMLElement[]> {
  const out: HTMLElement[] = [];
  let d: any = null;
  try { d = await wb(['docs', 'looks']); } catch { /* none */ }
  if (d && Array.isArray(d.looks)) {
    const sel = h('select', 'field') as HTMLSelectElement;
    for (const l of d.looks) {
      const key = String(l.key ?? l.name), o = h('option', '', String(l.name ?? key)) as HTMLOptionElement;
      o.value = key; o.selected = key === d.saved; sel.append(o);
    }
    sel.title = sel.selectedOptions[0]?.text ?? '';
    sel.onchange = async () => { try { await wb(['docs', 'look', sel.value, '--use']); toast('New documents use this Look'); redraw(); } catch (e) { toast(String(e)); } };
    out.push(row('Look', 'The layout new documents are made in; styling only, what goes in does not change', sel, 'docs word pdf slides look'));
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
    const asked = prompt('A name for the new theme', freeName('My theme'))?.trim();
    if (!asked) return;
    if (Object.values(BASE_NAMES).includes(asked) || themeState.themes.some(x => x.name === asked)) { toast('That name is taken'); return; }
    const name = asked;
    const base = baseOf(themeState.active).base;
    themeState.themes.push({ name, base, colors: {} });
    themeState.active = name;
    applyTheme();
    void saveThemes();
    redraw();
  };
  chips.append(mk);
  box.append(chips);
  box.append(italicsRow(redraw), marksRow());
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

// ---- Theme: italic words and the marks' names -----------------------------------------------------------------------
function italicsRow(redraw: () => void): HTMLElement {
  const wrap = h('div', 'theme-italics');
  const cur = italicStyle();
  const labels = Object.fromEntries(ITALICS);
  const keyOf = Object.fromEntries(ITALICS.map(([k, v]) => [v, k]));
  wrap.append(row('Italic words', `The words the translators added. Kept for ${themeState.active} only; each theme has its own.`,
    seg(ITALICS.map(([, v]) => v), labels[cur], v => {
      themeState.italics = { ...themeState.italics, [themeState.active]: keyOf[v] };
      applyTheme(); void save('theme', 'italics', themeState.italics); redraw();
    }), 'italic italics grey underline translators added words'));
  // the preview is real text from the database: Genesis 1, its italic words marked as the reader marks them
  const pv = h('div', 'theme-preview');
  pv.append(h('div', 'label', 'Preview · Genesis 1'));
  wrap.append(pv);
  void api.reader('GEN', 1).then(r => {
    for (const v of r.data.chapter.verses.slice(0, 3)) {
      const p = h('p', 'theme-preview-verse');
      p.append(h('sup', 'muted', String(v.v)), ' ');
      for (const w of v.words) { p.append(w.lead ?? '', h('span', 'w' + (w.italic ? ' it' : ''), w.text), w.trail ?? '', ' '); }
      pv.append(p);
    }
  }).catch(() => pv.append(h('p', 'muted small', 'The preview needs the Bible database.')));
  return wrap;
}

function marksRow(): HTMLElement {
  const wrap = h('div', 'theme-marks');
  wrap.append(h('div', 'label', 'Highlight colors'), h('p', 'muted small', 'Name a color for what it stands for. Each color has a light and a dark form, so a highlight follows the theme.'));
  for (const c of ['yellow', 'green', 'blue', 'pink', 'orange']) {
    const r = h('div', 'color-row');
    const i = h('input', 'field') as HTMLInputElement;
    i.value = themeState.marks[c] ?? '';
    i.placeholder = c[0].toUpperCase() + c.slice(1);
    i.setAttribute('aria-label', `Name for ${c}`);
    i.onchange = () => { themeState.marks = { ...themeState.marks, [c]: i.value.trim() }; void save('theme', 'marks', themeState.marks); };
    r.append(h('span', `swatch c-${c}`), i);
    r.dataset.find = `highlight color name ${c}`;
    wrap.append(r);
  }
  return wrap;
}
