// The words on a highlight are drawn in whichever ink, black or white, has the higher WCAG 2.2 contrast
// ratio with the highlight's color; one of the two always reaches 4.58:1 (WCAG AA). So any color can be used on any theme: no light and dark forms, no fixed list
// (the person's decision, 2026-11-16; design/features/highlights).

export const NAMED = new Set(['yellow', 'green', 'blue', 'pink', 'orange']);
export const DARK_INK = '#000000';
export const LIGHT_INK = '#ffffff';

/** sRGB channels 0-255 of a #rgb / #rrggbb / rgb()/rgba() color, or null. */
export function rgbOf(c: string): [number, number, number] | null {
  const s = c.trim();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return [0, 2, 4].map(i => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [0, 1, 2].map(i => parseInt(m![1][i] + m![1][i], 16)) as [number, number, number];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio of two colors, 1 to 21. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The ink for words on this background: the one of the two with the higher contrast. Unknown colors keep the page's. */
export function inkFor(bg: string): string | null {
  const rgb = rgbOf(bg);
  if (!rgb) return null;
  return contrast(rgb, [0, 0, 0]) >= contrast(rgb, [0xff, 0xff, 0xff]) ? DARK_INK : LIGHT_INK;
}

/** Inline style for a highlight: its color and its ink. A named color reads its theme variables, so it follows the theme
 * without redrawing; refreshInks keeps `--hl-<name>-ink` in step. */
export function hlStyle(color: string): string {
  if (NAMED.has(color)) return `background-color:var(--hl-${color});color:var(--hl-${color}-ink);`;
  const ink = inkFor(color);
  return `background-color:${color};${ink ? `color:${ink};` : ''}`;
}

/** Set `--hl-<name>-ink` on the root from each named color as the current theme draws it. Run after any theme change. */
export function refreshInks(root: HTMLElement = document.documentElement) {
  for (const n of NAMED) {
    root.style.removeProperty(`--hl-${n}-ink`);
    const ink = inkFor(getComputedStyle(root).getPropertyValue(`--hl-${n}`));
    if (ink) root.style.setProperty(`--hl-${n}-ink`, ink);
  }
}
