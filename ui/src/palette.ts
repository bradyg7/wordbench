// The page's plain colors (notebook design row 25, NB4): eight and Default, for emphasis only. A color on words is a
// `<span data-c="red">` (text) or `<span data-bg="red">` (background) in the page; the look of each name is the
// theme's (notebook.css), so a page reads right in light, dark and e-ink. A text color carries no meaning: marks do.

export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'red'] as const;
export type ColorName = typeof COLORS[number];
export type ColorKind = 'text' | 'bg';
export const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
export const isColor = (c: string): c is ColorName => (COLORS as readonly string[]).includes(c);
/** The attribute a span carries for each kind. */
export const attrOf = (k: ColorKind) => (k === 'text' ? 'data-c' : 'data-bg');
