// Adjust (R3, sheets D10, D12, D14, D15): a document's Look and its dials, with the page drawn live from the source's own
// plan (wb docs plan), so the person sees their own verses change as they choose. Every choice is a dial of
// wb-core's docs::look; Make passes them as --look and --set, Save as a Look runs wb docs look NAME --save.

import { wb } from './api';
import { modal } from './pagedocs';
import { toast } from './sheets';
import { button, h } from './ui';

export type Chosen = { look: string; dials: [string, string][] };

type Dial = { key: string; label: string; about?: string; options: [string, string][]; word?: boolean; slides?: boolean };

const DIALS: Dial[] = [
  { key: 'typeface', label: 'Typeface', about: 'Headings / scripture', options: [['inter-literata', 'Inter / Literata'], ['literata', 'Literata / Literata'], ['inter', 'Inter / Inter']] },
  { key: 'size', label: 'Size', options: [['small', 'Small'], ['regular', 'Regular'], ['large', 'Large'], ['largest', 'Largest']], word: true },
  { key: 'spacing', label: 'Spacing', about: 'Room between lines and around passages', options: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['airy', 'Airy']], word: true },
  { key: 'title', label: 'Title', options: [['left', 'Left'], ['center', 'Centered']], word: true },
  { key: 'numbers', label: 'Verse numbers', options: [['accent', 'In the accent'], ['plain', 'Plain']], word: true },
  { key: 'under_title', label: 'Under the title', options: [['none', 'Nothing'], ['rule', 'A thin rule']], word: true },
  { key: 'paper', label: 'Paper', options: [['letter', 'Letter'], ['a4', 'A4']], word: true },
  { key: 'cover', label: 'Cover page', options: [['false', 'Off'], ['true', 'On']], word: true },
  { key: 'running_head', label: 'Running head', options: [['true', 'On'], ['false', 'Off']], word: true },
  { key: 'page_numbers', label: 'Page numbers', options: [['of', 'Page x of y'], ['plain', 'x'], ['none', 'None']], word: true },
  { key: 'columns', label: 'Columns', about: 'Two only when the document is scripture only', options: [['1', 'One'], ['2', 'Two']], word: true },
  { key: 'neighbours', label: 'Neighbours', about: 'The verses either side', options: [['faint', 'Faint'], ['hidden', 'Hidden']], slides: true },
  { key: 'reference', label: 'Reference', options: [['top', 'Top'], ['bottom', 'Bottom']], slides: true },
  { key: 'ink', label: 'Ink', about: 'Saver: greys, no rules, highlights underlined. Black only: black and white.', options: [['full', 'Full color'], ['saver', 'Saver'], ['black', 'Black only']], word: true },
];

// the contrast rule of docs::look (D15), the same arithmetic
const lum = (hex: string) => {
  const c = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export function readable(hex: string, paper = 'FFFFFF'): string {
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const dark = lum(paper) < 0.5;
  let f = 1;
  let out = hex.toUpperCase();
  while (contrast(out, paper) < 4.5 && f > 0) {
    f -= 0.05;
    out = rgb.map(c => Math.round(dark ? c + (255 - c) * (1 - f) : c * f).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return out;
}

const str = (v: unknown) => String(v);

/** The Adjust panel. `planArgs`: the wb docs plan arguments for the source (to word or pdf). → the Look and dials chosen. */
export async function adjust(kind: 'word' | 'pdf', planArgs: string[], start: Chosen, themeAccent = '8E1B14'): Promise<Chosen | null> {
  let looks: any, plan: any;
  try { [looks, plan] = await Promise.all([wb(['docs', 'looks']), wb(['docs', 'plan', ...planArgs])]); }
  catch (x) { toast(String((x as Error).message || x)); return null; }
  const base = (key: string) => (looks.looks.find((l: any) => l.key === key) || looks.looks[0]).values;
  let lookKey = start.look || looks.saved || 'preview';
  const vals: Record<string, string> = {};
  const reset = () => { for (const [k, v] of Object.entries(base(lookKey))) vals[k] = str(v); for (const [k, v] of start.dials) vals[k.replace(/-/g, '_')] = v; };
  reset();
  let grey = false;

  return new Promise(done => {
    const m = modal('Adjust the look', true, () => done(null));
    m.box.classList.add('lk-modal');
    const finish = (r: Chosen) => { done(r); m.close(); };
    const side = h('div', 'lk-side');
    const stage = h('div', kind === 'pdf' ? 'lk-stage lk-with-count' : 'lk-stage');
    const pageCount = h('p', 'muted small lk-page-count');
    pageCount.setAttribute('aria-live', 'polite');
    let countKey = '';
    let countTimer: ReturnType<typeof setTimeout> | undefined;
    const body = h('div', 'lk-body');
    body.append(side, stage);
    const changed = (): [string, string][] => {
      const b = base(lookKey);
      return Object.entries(vals).filter(([k, v]) => k !== 'name' && str(b[k]) !== v).map(([k, v]) => [k, v]);
    };

    const updatePageCount = () => {
      const args = ['docs', 'plan', ...planArgs, '--pages', '--look', lookKey,
        ...changed().flatMap(([k, v]) => ['--set', `${k}=${v}`])];
      const key = JSON.stringify(args);
      if (key === countKey) return;
      countKey = key;
      clearTimeout(countTimer);
      pageCount.textContent = 'Counting PDF pages…';
      pageCount.removeAttribute('title');
      countTimer = setTimeout(async () => {
        if (!m.box.isConnected) return;
        try {
          const result = await wb(args);
          if (key === countKey) pageCount.textContent = `${result.pages} PDF page${result.pages === 1 ? '' : 's'}`;
        } catch (x) {
          if (key === countKey) {
            pageCount.textContent = 'PDF page count unavailable';
            pageCount.title = String((x as Error).message || x);
          }
        }
      }, 160);
    };

    const seg = (d: Dial) => {
      const row = h('div', 'lk-dial');
      row.append(h('div', 'lk-dial-name', d.label));
      if (d.about) row.append(h('div', 'muted small', d.about));
      const s = h('div', 'lk-seg');
      for (const [v, label] of d.options) {
        const b = button(`lk-opt${vals[d.key] === v ? ' on' : ''}`, label, () => { vals[d.key] = v; draw(); });
        b.dataset.dial = d.key;
        b.dataset.value = v;
        s.append(b);
      }
      row.append(s);
      return row;
    };

    const accentRow = () => {
      const row = h('div', 'lk-dial');
      row.append(h('div', 'lk-dial-name', 'Accent'), h('div', 'muted small', 'References, verse numbers, cues'));
      const s = h('div', 'lk-swatches');
      const cur = (vals.accent || themeAccent).toUpperCase();
      const theme = button(`lk-swatch lk-theme${vals.accent ? '' : ' on'}`, 'Theme', () => { vals.accent = ''; draw(); });
      s.append(theme);
      for (const sw of looks.swatches) {
        const b = button(`lk-swatch${vals.accent.toUpperCase() === sw.hex ? ' on' : ''}`, '', () => { vals.accent = sw.hex; draw(); });
        b.style.background = `#${sw.hex}`;
        b.title = sw.name;
        b.setAttribute('aria-label', sw.name);
        s.append(b);
      }
      const own = h('input', 'lk-own') as HTMLInputElement;
      own.type = 'color';
      own.value = `#${cur}`;
      own.title = 'Your own';
      own.onchange = () => { vals.accent = own.value.slice(1).toUpperCase(); draw(); };
      s.append(own);
      row.append(s);
      // D15: a too-light accent is darkened for text, kept for rules
      if (vals.accent && vals.ink === 'full' && readable(vals.accent) !== vals.accent.toUpperCase()) {
        const note = h('div', 'lk-warn small', 'This color is hard to read as text on white, so references and verse numbers use a darker shade. Rules keep your color.');
        row.append(note);
      }
      return row;
    };

    const live = () => {
      const fonts = vals.typeface === 'literata' ? ['Literata', 'Literata'] : vals.typeface === 'inter' ? ['Inter', 'Inter'] : ['Inter', 'Literata'];
      const ink = vals.ink;
      const text = ink === 'black' ? '#000' : ink === 'saver' ? '#444' : `#${readable(vals.accent || themeAccent)}`;
      const scale = ({ small: 0.92, regular: 1, large: 1.17, largest: 1.33 } as Record<string, number>)[vals.size] || 1;
      const line = ({ compact: 1.38, comfortable: 1.5, airy: 1.62 } as Record<string, number>)[vals.spacing] || 1.5;
      const sheet = h('div', `lk-page${kind === 'pdf' ? ' lk-slide' : ''}${grey ? ' lk-grey' : ''}`);
      sheet.style.setProperty('--lk-head', fonts[0]);
      sheet.style.setProperty('--lk-scripture', fonts[1]);
      sheet.style.setProperty('--lk-accent', text);
      sheet.style.setProperty('--lk-scale', String(scale));
      sheet.style.setProperty('--lk-line', String(line));
      sheet.style.setProperty('--lk-num', vals.numbers === 'plain' ? (ink === 'black' ? '#000' : '#555') : text);
      sheet.style.setProperty('--lk-rule', ink === 'full' ? `#${vals.accent || themeAccent}` : 'transparent');
      sheet.classList.toggle('center', vals.title === 'center');
      sheet.classList.toggle('rule', vals.under_title === 'rule' && ink === 'full');
      sheet.classList.toggle('two', vals.columns === '2');
      if (kind === 'pdf') {
        const v = plan.plan.find((s: any) => s.kind === 'verse');
        if (v) {
          const verse = (o: any, cls: string) => {
            const p = h('p', cls);
            if (o?.v != null) p.append(h('span', 'lk-num', `${o.v} `));
            p.append(document.createTextNode(o?.text || ''));
            return p;
          };
          const ref = h('div', 'lk-sref', v.ref);
          if (vals.reference !== 'bottom') sheet.append(ref);
          if (vals.neighbours !== 'hidden' && v.before) sheet.append(verse(v.before, 'lk-near'));
          sheet.append(verse(v.verse, `lk-verse${vals.neighbours === 'hidden' ? ' alone' : ''}`));
          if (vals.neighbours !== 'hidden' && v.after) sheet.append(verse(v.after, 'lk-near'));
          if (vals.reference === 'bottom') sheet.append(ref);
        }
        return sheet;
      }
      // the Word plan's paragraphs, in the styles the file will have (first ones only: a page, not the whole document)
      const ops = (plan.plan || []).filter((op: any) => op[0] === 'para').slice(0, 16);
      for (const op of ops) {
        const style = String(op[1]).replace(/ /g, '');
        if (ink !== 'full' && style === 'DeliveryNote') { /* kept, in grey: drawn by the style */ }
        const p = h('p', `lk-p dp-${style}`);
        for (const r of op[2]) {
          const t = String(r[0] ?? '');
          if (r[1] === 'num') p.append(h('sup', 'lk-num', t));
          else if (r[1] === 'mark') p.append(h('span', ink === 'full' ? 'lk-mark' : 'lk-under', t));
          else p.append(document.createTextNode(t));
        }
        sheet.append(p);
      }
      return sheet;
    };

    const draw = () => {
      side.replaceChildren();
      const lk = h('div', 'lk-dial');
      lk.append(h('div', 'lk-dial-name', 'Look'));
      const s = h('div', 'lk-seg wrap');
      for (const l of looks.looks) s.append(button(`lk-opt${l.key === lookKey ? ' on' : ''}`, l.name, () => { lookKey = l.key; start = { look: l.key, dials: [] }; reset(); draw(); }));
      lk.append(s);
      side.append(lk, accentRow());
      for (const d of DIALS) if ((kind === 'word' && !d.slides) || (kind === 'pdf' && !d.word) || d.key === 'typeface') side.append(seg(d));
      const g = h('label', 'lk-grey-toggle small');
      const cb = h('input') as HTMLInputElement;
      cb.type = 'checkbox';
      cb.checked = grey;
      cb.onchange = () => { grey = cb.checked; draw(); };
      g.append(cb, document.createTextNode(' See it in grey'));
      side.append(g);
      const acts = h('div', 'lk-acts');
      acts.append(
        button('btn primary lk-use', 'Use these', () => finish({ look: lookKey, dials: changed() })),
        button('btn lk-save', 'Save as a Look…', async () => {
          const name = prompt('A name for this Look');
          if (!name) return;
          try {
            const args = ['docs', 'look', name, '--from', lookKey, ...changed().flatMap(([k, v]) => ['--set', `${k}=${v}`]), '--save'];
            const r = await wb(args);
            toast(`Saved the Look ${r.name}`);
            looks = await wb(['docs', 'looks']);
            lookKey = r.key;
            start = { look: r.key, dials: [] };
            reset();
            draw();
          } catch (x) { toast(String((x as Error).message || x)); }
        }),
        button('btn quiet lk-reset', 'Reset', () => { start = { look: lookKey, dials: [] }; reset(); draw(); }),
      );
      side.append(acts);
      stage.replaceChildren(live());
      if (kind === 'pdf') {
        stage.append(pageCount);
        updatePageCount();
      }
    };
    m.box.replaceChildren(m.head('Adjust the look', kind === 'pdf' ? 'Slides: the first verse of your source' : 'Word: the first page of your source'), body);
    draw();
  });
}
