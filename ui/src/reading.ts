// Reading (reading-plans RP-19; sheets R13, R15, R16): the plan going now, Past plans, and the map of the whole Bible with
// its two layers, Read and Written about. The Library is to become a directory (not designed yet); until then Reading is
// reached from the plan pane's foot, and ‹ Plan goes back. Plan and Reading are one thing seen two ways, the day and everything.
import { wb } from './api';
import { app, goTo } from './app';
import { dock } from './panes';
import { openNote } from './notebook';
import { openPlans, pastRow, head, plural, dayName } from './plans';
import { button, h } from './ui';

type Layer = 'read' | 'written';
let layer: Layer = 'read';
let picked = '';

export function openReading() {
  return dock.open('reading', 'Reading', 'reading', 'right', async (into, pane) => {
    const el = h('div', 'reading-pane');
    const redraw = () => { void pane.refresh?.(); };
    const back = button('link-btn reading-back', '‹ Plan', () => void openPlans(), 'left');
    back.dataset.act = 'plan';
    el.append(back);
    head(el, 'Reading', 'What you have read, and what you have written about');
    const [list, past, overall, map]: any[] = await Promise.all([wb(['plan', 'list']), wb(['plan', 'past']), wb(['read', 'progress']), wb(['read', 'map'])]);

    // the plan going now
    el.append(h('div', 'label', 'Going now'));
    for (const p of list) {
      const row = h('div', 'plan-past-row reading-going');
      row.dataset.plan = p.id;
      const info = h('div');
      info.append(h('div', 'plan-past-name', p.name), h('div', 'muted small', p.finished ? `Finished · ${plural(p.days, 'day')}` : `${p.done} of ${p.cycle ? 'no end' : plural(p.days, 'day')} read${p.dated && p.behind > 0 ? ` · ${plural(p.behind, 'day')} behind` : ''}`));
      row.append(info, button('btn small', 'Plan', () => void openPlans()));
      el.append(row);
    }
    if (!list.length) el.append(h('p', 'muted small', 'No reading plans going.'));

    // Past plans: how far each got, and Use again
    el.append(h('div', 'label', `Past plans (${past.length})`));
    const pastBox = h('div', 'plan-past-list');
    for (const p of past) pastBox.append(pastRow(p, redraw));
    if (!past.length) pastBox.append(h('p', 'muted small', 'A plan you stop, or finish, waits here to be used again.'));
    el.append(pastBox);

    // the map: every chapter, two layers
    el.append(h('div', 'label', 'What you have read'));
    el.append(h('p', 'small plan-overall', `${overall.chapters} of ${overall.of} chapters (${overall.percent}%)${overall.partial?.length ? ` · ${overall.partial.length} read in part` : ''}`));
    const layers = h('div', 'rd-layers');
    const grid = h('div', 'rd-map');
    const list2 = h('div', 'rd-list');
    const paint = () => {
      layers.replaceChildren(
        ...(['read', 'written'] as Layer[]).map(l => {
          const b = h('button', `chip link${layer === l ? ' on' : ''}`, l === 'read' ? 'Read' : 'Written about');
          b.dataset.layer = l;
          b.setAttribute('aria-pressed', String(layer === l));
          b.onclick = () => { layer = l; paint(); };
          return b;
        }));
      grid.replaceChildren(...map.books.map((b: any) => {
        const row = h('div', 'rd-book');
        const have = new Map<number, number[]>((layer === 'read' ? b.read : b.written).map((x: number[]) => [x[0], x]));
        row.append(h('div', 'rd-book-name', b.name));
        const chs = h('div', 'rd-chs');
        for (let c = 1; c <= b.chapters; c++) {
          const x = have.get(c);
          const cell = h('button', 'rd-ch') as HTMLButtonElement;
          cell.dataset.ch = `${b.code}.${c}`;
          cell.setAttribute('aria-label', `${b.name} ${c}`);
          if (x) {
            if (layer === 'read') {
              const [, times, part] = x;
              cell.classList.add(`t${Math.min(3, Math.max(1, times))}`);
              if (times === 0) { cell.classList.add('t1', 'part'); cell.style.background = `linear-gradient(90deg, var(--accent) ${Math.round(part * 100)}%, var(--sunken) ${Math.round(part * 100)}%)`; }
              cell.dataset.times = String(times);
              cell.title = `${b.name} ${c}: ${times === 0 ? 'read in part' : plural(times, 'time')}`;
            } else {
              cell.classList.add(x[1] > 1 ? 'w2' : 'w1');
              cell.dataset.refs = String(x[1]);
              cell.title = `${b.name} ${c}: ${plural(x[1], 'reference')}`;
            }
          } else cell.title = `${b.name} ${c}`;
          if (picked === cell.dataset.ch) cell.classList.add('sel');
          chs.append(cell);
        }
        row.append(chs);
        return row;
      }));
    };
    grid.addEventListener('click', async e => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.rd-ch');
      if (!cell) return;
      picked = cell.dataset.ch!;
      grid.querySelectorAll('.rd-ch.sel').forEach(x => x.classList.remove('sel'));
      cell.classList.add('sel');
      const [code, c] = picked.split('.');
      const name = app.books.find(b => b.code === code)?.name ?? code;
      list2.replaceChildren(h('div', 'plan-past-name', `${name} ${c}`));
      list2.append(button('btn small', `Open ${name} ${c}`, () => goTo(`${code} ${c}`), 'book'));
      try {
        const about: any[] = await wb(['read', 'about', `${name} ${c}`]);
        const times = Object.values((await wb(['read', 'times', `${name} ${c}`])) ?? {})[0] as any;
        list2.append(h('div', 'muted small', times ? `${times.times === 0 ? 'Read in part' : `Read ${plural(times.times, 'time')}`} · last ${dayName(String(times.last).slice(0, 10))}` : 'Not read yet'));
        if (!about.length) list2.append(h('div', 'muted small', 'Nothing refers to it yet.'));
        for (const x of about) list2.append(button('ref-link rd-ref', `${x.title || x.kind} · ${x.kind}`, () => { if (x.kind === 'highlight' || x.kind === 'folder') goTo(x.anchor); else openNote(x.id); }));
      } catch { /* the chapter opens from its button */ }
    });
    paint();
    el.append(layers, grid, list2);
    into.replaceChildren(...el.childNodes);
  });
}
