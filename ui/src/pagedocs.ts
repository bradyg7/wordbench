// A document from a page (W6 of "The Notebook as a workspace"; sheets W7.1–W7.4): a page and the pages inside it made into
// a Speaker Script (Word) and Verse by Verse (PDF pages) on tier 4's renderer. Make a document (a page's ⋯, or the
// Documents pane) asks what to make (W7.1), then what goes in, a switch for each block with what it becomes (W7.2), then
// says what was made, each verse checked against the Bible in the finished files (W7.3). The page keeps its documents at
// its foot, each Up to date or changed since, with Make again; a click previews the file in a pane (W7.4). Every step
// is a wb command: wb craft parts --page, wb craft word|deck --page, wb docs list --page, wb docs preview, wb docs reveal.
import { wb } from './api';
import { app } from './app';
import { lookFields } from './documents';
import { adjust, type Chosen } from './looks';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, icon } from './ui';

interface Row { key: string; kind: string; label: string; text: string; on: boolean; default: boolean; becomes: string; problem?: string }
interface Parts { id: string; title: string; inside: number; rows: Row[]; version: string; made: { script: boolean; verse: boolean } }

const ICONS: Record<string, string> = { heading: 'heading', paragraph: 'lines', list: 'shelf', todo: 'check', quote: 'quote', table: 'shelf', scripture: 'book', view: 'filter', page: 'notebook', fence: 'lines' };
const WHAT: Record<string, string> = { word: 'Speaker Script', pdf: 'Verse by Verse' };

/** "today 14:20", "Thursday", "Nov 2": when a document was made. */
export function madeWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return '';
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `today ${time}`;
  if (+now - +d < 6 * 864e5) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const size = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** The modal the three steps are drawn in (the plan modal's frame). */
export function modal(label: string) {
  const overlay = document.getElementById('overlay')!;
  overlay.querySelectorAll('.pd-wrap').forEach(x => x.remove());
  const wrap = h('div', 'plan-modal-wrap pd-wrap');
  const box = h('section', 'plan-modal pd-modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', label);
  wrap.append(box);
  overlay.append(wrap);
  const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key, true); };
  document.addEventListener('keydown', key, true);
  wrap.onmousedown = ev => { if (ev.target === wrap) close(); };
  const head = (title: string, sub: string) => {
    const top = h('header', 'plan-modal-head');
    const tt = h('div');
    tt.append(h('h2', 'plan-modal-title', title), h('div', 'muted small pd-sub', sub));
    const x = button('icon-btn pd-close', '', close, 'x');
    x.setAttribute('aria-label', 'Close');
    top.append(tt, x);
    return top;
  };
  return { box, close, head };
}

/** Make a document from a page (sheets W7.1–W7.3). */
export async function makeFromPage(pageId: string) {
  let parts: Parts, designs: any, looks: any;
  try { [parts, designs, looks] = await Promise.all([wb(['craft', 'parts', '--page', pageId]), wb(['craft', 'designs']), wb(['docs', 'looks'])]); }
  catch (x) { toast(String((x as Error).message || x)); return; }
  const m = modal('Make a document');
  const want = { word: true, pdf: true };
  let theme: string = designs.theme;
  let lookKey: string = looks?.saved || 'preview';
  let inkMode = '';
  let extra: [string, string][] = [];
  let version = parts.version || 'page';
  const switches = new Map(parts.rows.map(r => [r.key, r.on]));
  const fromLine = () => `From the page ${parts.title}${parts.inside ? ` and the ${parts.inside === 1 ? 'page' : `${parts.inside} pages`} inside it` : ''}`;
  const themeName = () => designs.themes[theme]?.name || theme;
  const versionName = () => version === 'page' ? 'each block’s version' : version;

  // ---- W7.1: what to make ----
  const drawWhat = () => {
    const cols = h('div', 'pd-cols');
    const col = (label: string, to: 'word' | 'pdf', table: Record<string, any>, order: string[]) => {
      const here = order[0];
      const c = h('div', 'pd-col');
      c.append(h('div', 'label pd-col-label', label));
      for (const k of order.filter(x => table[x])) {
        const s = table[k];
        const made = k === here;
        const opt = h('label', `pd-opt${made ? '' : ' later'}${made && want[to] ? ' on' : ''}`);
        opt.dataset.structure = k;
        const cb = h('input') as HTMLInputElement;
        cb.type = 'checkbox';
        cb.checked = made && want[to];
        cb.disabled = !made;
        cb.onchange = () => { want[to] = cb.checked; opt.classList.toggle('on', cb.checked); next.disabled = !want.word && !want.pdf; };
        const t = h('div');
        t.append(h('div', 'pd-opt-name', made ? s.label : `${s.label} · phase 5`), h('div', 'muted small', made && to === 'pdf' ? `${s.about} As PDF pages.` : s.about));
        opt.append(cb, t);
        c.append(opt);
      }
      return c;
    };
    cols.append(col('Word', 'word', designs.docs, ['script', 'share', 'study', 'reading']), col('Slides', 'pdf', designs.decks, ['verse', 'reader', 'pulpit', 'table']));
    const opts = h('div', 'pd-options');
    const th = h('select', 'field small pd-theme') as HTMLSelectElement;
    for (const [k, t] of Object.entries<any>(designs.themes)) th.append(new Option(t.name, k));
    th.value = theme;
    const best = h('span', 'muted small pd-best', designs.themes[theme]?.best_for || '');
    th.onchange = () => { theme = th.value; best.textContent = designs.themes[theme]?.best_for || ''; };
    const ver = h('select', 'field small pd-version') as HTMLSelectElement;
    ver.append(new Option('As each block shows', 'page'), new Option('KJV', 'KJV'), new Option('YLT', 'YLT'));
    ver.value = version;
    ver.title = 'As each block shows: each scripture block in its own version (KJV, or YLT where you chose it). KJV or YLT: every block in that version, in the documents only.';
    ver.onchange = () => { version = ver.value; };
    const lt = h('label', 'pd-field'); lt.append(h('span', 'pd-field-name', 'Theme'), th);
    const lv = h('label', 'pd-field'); lv.append(h('span', 'pd-field-name', 'Version'), ver);
    const lf = lookFields(looks);
    lf.look.value = lookKey;
    lf.ink.value = inkMode;
    lf.look.onchange = () => { lookKey = lf.look.value; };
    lf.ink.onchange = () => { inkMode = lf.ink.value; };
    const ll = h('label', 'pd-field'); ll.append(h('span', 'pd-field-name', 'Look'), lf.look);
    const li = h('label', 'pd-field'); li.append(h('span', 'pd-field-name', 'Ink'), lf.ink);
    const adj = button('btn small pd-adjust', extra.length ? `Adjust… (${extra.length})` : 'Adjust…', async () => {
      const to = want.word ? 'word' : 'pdf';
      const start: Chosen = { look: lookKey, dials: [...extra, ...(inkMode ? [['ink', inkMode] as [string, string]] : [])] };
      const r = await adjust(to, ['--page', pageId, '--to', to], start, designs.themes[theme]?.doc_accent || '8E1B14');
      if (!r) return;
      lookKey = r.look;
      inkMode = r.dials.find(d => d[0] === 'ink')?.[1] || '';
      extra = r.dials.filter(d => d[0] !== 'ink');
      lf.look.value = lookKey;
      lf.ink.value = inkMode;
      adj.textContent = extra.length ? `Adjust… (${extra.length})` : 'Adjust…';
    });
    opts.append(lt, best, h('span', 'grow'), lv, ll, li, adj);
    const foot = h('div', 'plan-modal-foot');
    const next = button('btn primary pd-next', 'Next: what goes in', () => void drawParts());
    foot.append(h('span'), button('btn pd-cancel', 'Cancel', m.close), next);
    m.box.replaceChildren(m.head('Make a document', fromLine()), cols, opts, foot);
  };

  // ---- W7.2: what goes in ----
  const switchArgs = () => parts.rows.flatMap(r => [switches.get(r.key) ? '--on' : '--off', r.key]);
  const drawParts = async () => {
    try { parts = await wb(['craft', 'parts', '--page', pageId, '--version', version, ...switchArgs()]); }
    catch (x) { toast(String((x as Error).message || x)); return; }
    const made = [want.word && WHAT.word, want.pdf && WHAT.pdf].filter(Boolean).join(' and ');
    const list = h('div', 'pd-rows');
    for (const r of parts.rows) {
      const row = h('div', `pd-row${r.on ? '' : ' off'}`);
      row.dataset.key = r.key;
      row.dataset.kind = r.kind;
      const sw = h('input', 'switch pd-switch') as HTMLInputElement;
      sw.type = 'checkbox';
      sw.checked = r.on;
      sw.setAttribute('aria-label', `${r.label}: ${r.text}`);
      sw.onchange = () => { switches.set(r.key, sw.checked); void drawParts(); };
      const what = h('div', 'pd-what');
      what.append(h('div', 'muted small pd-kind', r.label), h('div', 'pd-text', r.text || '—'));
      const to = h('div', `pd-becomes${r.problem ? ' problem' : ''}`, r.becomes);
      if (r.problem) to.title = r.problem;
      row.append(sw, icon(ICONS[r.kind] || 'lines'), what, icon('right'), to);
      list.append(row);
    }
    if (!parts.rows.length) list.append(h('p', 'muted small', 'The page has nothing under its title yet: the documents would hold its title only.'));
    const note = h('div', 'pd-note muted small');
    note.append(icon('file'), h('span', '', 'The document is planned from the page each time it is made, the way the Python app plans one from a thread; nothing is copied into the page, and scripture comes from the database only.'));
    const foot = h('div', 'plan-modal-foot');
    const go = button('btn primary pd-make', 'Make them', () => void makeThem(go));
    foot.append(h('span'), button('btn pd-back', 'Back', drawWhat), go);
    m.box.replaceChildren(m.head('What goes in', `${made} · ${themeName()} · ${versionName()}`), list, note, foot);
  };

  // ---- W7.3: made, and every verse checked ----
  const makeThem = async (go: HTMLButtonElement) => {
    go.disabled = true;
    go.textContent = 'Making…';
    const done: { to: string; r?: any; error?: string }[] = [];
    for (const to of (['word', 'pdf'] as const).filter(t => want[t])) {
      try { done.push({ to, r: await wb(['craft', to === 'word' ? 'word' : 'deck', '--page', pageId, '--theme', theme, '--version', version, '--look', lookKey, ...(inkMode ? ['--set', `ink=${inkMode}`] : []), ...extra.flatMap(([k, v]) => ['--set', `${k}=${v}`]), ...switchArgs()]) }); }
      catch (x) { done.push({ to, error: String((x as Error).message || x) }); }
    }
    app.changed('documents');
    drawMade(done);
  };
  const drawMade = (done: { to: string; r?: any; error?: string }[]) => {
    const ok = done.filter(d => d.r);
    const when = ok[0]?.r?.built ? new Date(ok[0].r.built).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    const files = h('div', 'pd-files');
    for (const d of done) {
      const card = h('div', `pd-file${d.error ? ' failed' : ''}`);
      card.dataset.to = d.to;
      const t = h('div', 'pd-file-main');
      if (d.r) {
        t.append(h('div', 'pd-file-name', d.r.name), h('div', 'muted small pd-file-meta', d.to === 'word' ? `Word · ${size(d.r.size)}` : `PDF · ${d.r.pages ?? d.r.checked?.pages ?? '?'} slides`));
        card.append(icon('file'), t, button('btn small pd-open', 'Open', () => void wb(['docs', 'open', d.r.id]).catch(x => toast(String(x)))));
      } else {
        t.append(h('div', 'pd-file-name', WHAT[d.to]), h('div', 'small pd-file-error', d.error!));
        card.append(icon('file'), t);
      }
      files.append(card);
    }
    // each verse, where it is: the check was made on each finished file, and a file missing one would not have been kept
    const where = new Map<string, Set<string>>();
    for (const d of ok) for (const ref of d.r.checked?.refs || []) {
      if (!where.has(ref)) where.set(ref, new Set());
      where.get(ref)!.add(d.to === 'word' ? 'Script' : 'slides');
    }
    const checked = h('div', 'pd-checked');
    if (where.size) {
      const versions = [...new Set([...where.keys()].map(k => /\(([^)]+)\)$/.exec(k)?.[1] || 'KJV'))].join(' and ');
      const head = h('div', 'pd-checked-head');
      head.append(icon('check'), document.createTextNode(`${where.size} of ${where.size} verses match the Bible (${versions}), ${ok.length > 1 ? 'in both files' : 'in the file'}`));
      checked.append(head);
      for (const [ref, ins] of where) {
        const r = h('div', 'pd-verse');
        r.append(icon('check'), h('span', 'pd-verse-ref', ref.replace(/ \((KJV)\)$/, '')), h('span', 'grow'), h('span', 'muted small', ins.size > 1 ? 'Script and slides' : [...ins][0] === 'Script' ? 'Script' : 'Slides'));
        checked.append(r);
      }
    } else if (ok.length) checked.append(h('div', 'muted small', 'No scripture in it: there were no verses to check.'));
    const note = h('div', 'pd-note muted small');
    note.append(icon('file'), h('span', '', `Kept in documents/ as page-${pageId}-script.json and page-${pageId}-verse.json, with the plan and file fingerprints, as the thread’s are. The Python app passes over them, as it does the thread’s PDF pages.`));
    const foot = h('div', 'plan-modal-foot');
    const folder = button('btn pd-folder', 'Show in folder', () => void wb(['docs', 'reveal', ok[0]?.r.id]).catch(x => toast(String(x))));
    folder.disabled = !ok.length;
    foot.append(h('span'), folder, button('btn primary pd-done', 'Done', m.close));
    m.box.classList.add('pd-made');
    m.box.replaceChildren(m.head(ok.length ? 'Made' : 'Not made', `${ok.length} file${ok.length === 1 ? '' : 's'} from ${parts.title}${when ? ` · ${when}` : ''}`), files, checked, note, foot);
  };

  drawWhat();
}

/** The page's documents, at its foot (sheet W7.4): each with when it was made and how it stands, Make again when the
 * page has changed since; a click on its name previews the file. Draws nothing when the page has none. */
export async function pageDocuments(pageId: string, into: HTMLElement) {
  let docs: any[] = [];
  try { docs = await wb(['docs', 'list', '--page', pageId]); } catch { docs = []; }
  into.replaceChildren();
  into.hidden = !docs.length;
  if (!docs.length) return;
  into.append(h('div', 'nb-linked-head', `Documents · ${docs.length}`));
  for (const d of docs) {
    const row = h('div', `pd-doc state-${d.state}`);
    row.dataset.id = d.id;
    const name = button('pd-doc-name', d.name, () => previewDoc(d), 'file');
    name.title = d.exists ? 'Preview it here' : 'The file is not there; Make again makes it';
    const when = h('span', 'muted small pd-doc-when', madeWhen(d.built));
    row.append(name, h('span', 'grow'), when);
    const again = () => button('btn small soft pd-again', 'Make again', async () => {
      try {
        const r = await wb(['docs', 'update', d.id]);
        app.changed('documents');
        toast(r.changed ? `Made ${r.name} again, every verse checked${r.kept_now ? `; your edits kept as ${r.kept_now}` : ''}` : `${r.name} is up to date`);
      } catch (x) { toast(String((x as Error).message || x)); }
    }, 'again');
    if (d.state === 'current') {
      const st = h('span', 'pd-doc-state ok');
      st.append(icon('check'), document.createTextNode('Up to date'));
      row.append(st);
    } else if (d.state === 'behind') {
      when.textContent = `${madeWhen(d.built)} · changed since`;
      row.append(again());
    } else if (d.state === 'missing' || d.state === 'edited' || d.state === 'old_design') {
      when.textContent = `${madeWhen(d.built)} · ${d.state === 'missing' ? 'file missing' : d.state === 'edited' ? 'changed by hand' : 'old design'}`;
      row.append(again());
    } else row.append(h('span', 'muted small pd-doc-state', d.state === 'forgotten' ? 'not kept up to date' : d.state));
    into.append(row);
  }
}

/** A finished file in a pane of its own (sheet W7.4), read from the file: a Word document's paragraphs in their styles, or
 * the PDF's pages. */
export function previewDoc(d: { id: string; name: string }) {
  if (!dock.find(`doc:${d.id}`)) dock.apart();
  return dock.open('docpreview', d.name, `doc:${d.id}`, 'left', async el => {
    const head = h('header', 'pane-head pd-pv-head');
    const acts = h('div', 'pd-pv-acts');
    acts.append(button('btn small pd-pv-open', 'Open', () => void wb(['docs', 'open', d.id]).catch(x => toast(String(x)))),
      button('btn small pd-pv-folder', 'Show in folder', () => void wb(['docs', 'reveal', d.id]).catch(x => toast(String(x)))));
    head.append(h('h2', 'pane-title', d.name), acts);
    let p: any;
    try { p = await wb(['docs', 'preview', d.id]); }
    catch (x) { el.replaceChildren(head, h('p', 'muted', String((x as Error).message || x))); return; }
    const body = h('div', 'pd-pv-body');
    if (p.paras) {
      const sheet = h('div', 'pd-pv-sheet');
      for (const para of p.paras) {
        const e = h('p', `pd-pv-p dp-${para.style}`);
        for (const r of para.runs) e.append(r.num ? h('sup', 'pd-pv-num', r.t) : document.createTextNode(r.t));
        sheet.append(e);
      }
      body.append(sheet);
    } else if (p.slides) {
      // the deck's pages, drawn by the same layout that made the PDF (it is up to date, so they are the file's pages)
      // (debug-spec S4, finding a148) a slide at a time with ‹ ›, the keys ← → Home End, and "3 of 9"; a switch to the
      // column of every slide. A deck opens one at a time; the choice is kept in the window's storage.
      const slides: string[] = p.slides;
      const urls = slides.map(svg => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
      const n = slides.length;
      const img = (i: number) => {
        const e = h('img', 'pd-pv-slide') as HTMLImageElement;
        e.alt = `Slide ${i + 1}`;
        e.src = urls[i];
        return e;
      };
      let single = true, cur = 0;
      try { single = localStorage.getItem('wb.deck.preview') !== 'all'; } catch { /* one at a time */ }
      const bar = h('div', 'pd-pv-bar');
      const prev = button('icon-btn pd-pv-prev', '', () => go(cur - 1), 'left');
      prev.title = 'The slide before (←)';
      prev.setAttribute('aria-label', 'The slide before');
      const count = h('span', 'muted small pd-pv-count');
      count.setAttribute('aria-live', 'polite');
      const next = button('icon-btn pd-pv-next', '', () => go(cur + 1), 'right');
      next.title = 'The next slide (→)';
      next.setAttribute('aria-label', 'The next slide');
      const mode = button('link-btn pd-pv-mode', '', () => {
        single = !single;
        try { localStorage.setItem('wb.deck.preview', single ? 'one' : 'all'); } catch { /* not kept */ }
        show();
      });
      bar.append(prev, count, next, h('span', 'grow'), mode);
      const stage = h('div', 'pd-pv-slides');
      const go = (i: number) => { cur = Math.max(0, Math.min(n - 1, i)); show(); };
      const show = () => {
        prev.hidden = next.hidden = !single;
        prev.disabled = cur === 0;
        next.disabled = cur === n - 1;
        count.textContent = single ? `${cur + 1} of ${n}` : `${n} slides`;
        mode.textContent = single ? 'Show all' : 'One at a time';
        mode.title = single ? 'Every slide in a column' : 'A slide at a time, with ← →';
        body.dataset.mode = single ? 'one' : 'all';
        stage.classList.toggle('one', single);
        stage.replaceChildren(...(single ? [img(cur)] : slides.map((_, i) => img(i))));
      };
      // the keys act when the pane has the focus; they never turn the reader's chapter from here
      body.tabIndex = -1;
      body.dataset.deck = String(n);
      body.addEventListener('pointerdown', ev => { if (!(ev.target as Element).closest('button')) body.focus({ preventScroll: true }); });
      body.addEventListener('keydown', ev => {
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
          ev.stopPropagation();
          if (!single) return;
          ev.preventDefault();
          go(cur + (ev.key === 'ArrowRight' ? 1 : -1));
        } else if (single && (ev.key === 'Home' || ev.key === 'End')) { ev.preventDefault(); go(ev.key === 'Home' ? 0 : n - 1); }
      });
      show();
      body.append(bar, stage);
      setTimeout(() => body.focus({ preventScroll: true }));
    } else if (p.stale) {
      body.append(h('p', 'muted pd-pv-stale', p.stale), button('btn small soft pd-again', 'Make again', async () => {
        try { await wb(['docs', 'update', d.id]); app.changed('documents'); void dock.find(`doc:${d.id}`)?.refresh?.(); }
        catch (x) { toast(String((x as Error).message || x)); }
      }, 'again'));
    }
    el.replaceChildren(head, body);
  });
}
