// Named layout data is separate from live DOM identities and temporary focus.
export const LAYOUT_VERSION = 2;
export type LayoutSide = 'left' | 'right' | 'top' | 'bottom' | 'float';
export interface Box { x: number; y: number; w: number; h: number }
export interface PaneView { scroll: { path: number[]; top: number; left: number }[]; state?: unknown }
export interface SavedPane { key: string; title?: string; kind?: string; home?: LayoutSide; view?: PaneView }
export interface SavedGroup { side: LayoutSide; keys: string[]; front?: string; rect?: Box; share?: number; min?: boolean; z?: number; strip?: number }
export interface LayoutState {
  app: 'bible-workbench-rs'; version: 2; panes: SavedPane[]; groups: SavedGroup[];
  widths: Partial<Record<'left' | 'right', number>>; wide: Partial<Record<'left' | 'right', boolean>>;
  bands: Partial<Record<'top' | 'bottom', number>>; active?: string;
}
export const canonicalKey = (key: string) => key.startsWith('doc|') ? `doc:${key.split('|')[1]}` : key;
const sides = ['left', 'right', 'top', 'bottom', 'float'];
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: any) => typeof v === 'number' && Number.isFinite(v);
const bad = (): never => { throw new Error('This layout is invalid; the current arrangement was left unchanged.'); };

/** Parse before opening or closing anything. Old Rust snapshots have no version or groups. */
export function readLayout(raw: any): LayoutState {
  if (!object(raw) || raw.app !== 'bible-workbench-rs') throw new Error('This window cannot read layouts from the Python app.');
  if (raw.version !== undefined && raw.version !== LAYOUT_VERSION) throw new Error('This layout uses an unsupported version; the current arrangement was left unchanged.');
  if (!Array.isArray(raw.panes) || raw.panes.length > 500) bad();
  const seen = new Set<string>();
  const panes: SavedPane[] = raw.panes.map((p: any) => {
    if (!object(p) || typeof p.key !== 'string' || !p.key || p.key.length > 4000) bad();
    const key = canonicalKey(p.key);
    if (seen.has(key)) bad();
    seen.add(key);
    if (p.home !== undefined && !sides.includes(p.home)) bad();
    if (p.view !== undefined) {
      if (!object(p.view) || !Array.isArray(p.view.scroll) || p.view.scroll.length > 1000) bad();
      for (const s of p.view.scroll) if (!object(s) || !Array.isArray(s.path) || s.path.length > 100 || !s.path.every((n: any) => Number.isInteger(n) && n >= 0) || !number(s.top) || !number(s.left)) bad();
    }
    return { key, title: typeof p.title === 'string' ? p.title : undefined, kind: typeof p.kind === 'string' ? p.kind : undefined, home: p.home, view: p.view };
  });
  let groups: SavedGroup[];
  if (raw.version === undefined) {
    groups = [];
    for (const p of raw.panes) {
      const side: LayoutSide = sides.includes(p.side) ? p.side : 'right';
      const rect = p.rect;
      if (rect !== undefined && (!object(rect) || !['x', 'y', 'w', 'h'].every(k => number(rect[k])) || rect.w <= 0 || rect.h <= 0)) bad();
      let g = groups.find(g => g.side === side && (side !== 'float' || JSON.stringify(g.rect) === JSON.stringify(rect)));
      if (!g) { g = { side, keys: [], ...(rect ? { rect } : {}) }; groups.push(g); }
      const key = canonicalKey(p.key); g.keys.push(key);
      if (p.front || !g.front) g.front = key;
    }
  } else {
    if (!Array.isArray(raw.groups) || raw.groups.length > 500) bad();
    const grouped = new Set<string>();
    groups = raw.groups.map((g: any) => {
      if (!object(g) || !sides.includes(g.side) || !Array.isArray(g.keys) || !g.keys.length) bad();
      const keys = g.keys.map((k: any) => {
        if (typeof k !== 'string') bad();
        const key = canonicalKey(k);
        if (!seen.has(key) || grouped.has(key)) bad();
        grouped.add(key); return key;
      });
      if (g.front !== undefined && typeof g.front !== 'string') bad();
      const front = g.front === undefined ? keys[0] : canonicalKey(g.front);
      if (!keys.includes(front)) bad();
      if (g.rect !== undefined && (!object(g.rect) || !['x', 'y', 'w', 'h'].every(k => number(g.rect[k])) || g.rect.w <= 0 || g.rect.h <= 0)) bad();
      for (const k of ['share', 'z', 'strip']) if (g[k] !== undefined && (!number(g[k]) || g[k] < 0 || (k === 'share' && g[k] === 0))) bad();
      if (g.min !== undefined && typeof g.min !== 'boolean') bad();
      return { side: g.side, keys, front, rect: g.rect, share: g.share, z: g.z, strip: g.strip, min: g.min };
    });
    if (grouped.size !== seen.size) bad();
  }
  const sizes = (v: any, keys: string[], bool = false) => {
    if (v === undefined) return {};
    if (!object(v) || Object.entries(v).some(([k, n]) => !keys.includes(k) || (bool ? typeof n !== 'boolean' : !number(n) || (n as number) < 0))) bad();
    return { ...v };
  };
  if (raw.active !== undefined && (typeof raw.active !== 'string' || !seen.has(canonicalKey(raw.active)))) bad();
  return { app: 'bible-workbench-rs', version: 2, panes, groups, widths: sizes(raw.widths, ['left', 'right']), wide: sizes(raw.wide, ['left', 'right'], true), bands: sizes(raw.bands, ['top', 'bottom']), active: raw.active && canonicalKey(raw.active) };
}

export function captureScroll(root: HTMLElement): PaneView['scroll'] {
  const out: PaneView['scroll'] = [];
  const visit = (el: HTMLElement, path: number[]) => {
    if (el.scrollTop || el.scrollLeft || !path.length) out.push({ path, top: el.scrollTop, left: el.scrollLeft });
    [...el.children].forEach((c, i) => { if (c instanceof HTMLElement) visit(c, [...path, i]); });
  };
  visit(root, []); return out;
}
export function restoreScroll(root: HTMLElement, scroll: PaneView['scroll']) {
  for (const s of scroll) {
    let el: Element | undefined = root;
    for (const i of s.path) el = el?.children[i];
    if (el instanceof HTMLElement) { el.scrollTop = s.top; el.scrollLeft = s.left; }
  }
}
