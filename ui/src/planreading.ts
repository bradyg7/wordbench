// The plan leading the reader (reading-plans RP-12 to RP-14, RP-16; sheets R2, R3, R8, R18, R19): the strip under the bar holding
// the day's readings, the card at the end of a reading ("Mark read · next: …", never marked without a click), and the thin
// line in the margin of the verses read, with Mark read to here in a verse's right click. Nothing here reminds, nags or
// counts streaks; nothing follows the last reading of a day.
import { wb } from './api';
import type { Drawn } from './reader';
import { app, goTo } from './app';
import { toast } from './sheets';
import { button, h } from './ui';

/** One reading of the day, as the strip and the pane's checklist show it. */
export interface Reading { entry: string; label: string; read: boolean; fraction: number; readTo: number | null; parts: string; verses: string }

interface Day { id: string; name: string; day: number; of: number | null; cycle: boolean; readings: Reading[] }

let day: Day | null = null;
let hidden = false;

const bookName = (code: string) => app.books.find(b => b.code === code)?.name ?? code;

/** "GEN.2" → "Genesis 2"; "PSA.119:1-119:88" → "Psalms 119:1–88". */
export function entryLabel(e: string): string {
  const [code, rest] = e.split('.');
  const m = /^(\d+)(?::(\d+)-(\d+):(\d+))?$/.exec(rest || '');
  if (!m) return e;
  if (!m[2]) return `${bookName(code)} ${m[1]}`;
  const end = m[4] === '999' ? 'end' : m[4];
  return m[1] === m[3] ? `${bookName(code)} ${m[1]}:${m[2]}–${end}` : `${bookName(code)} ${m[1]}:${m[2]}–${m[3]}:${end}`;
}

/** The place text `wb read mark` takes for an entry (a chapter, or the verses of a part of one). */
export function entryPlace(e: string): string {
  const [code, rest] = e.split('.');
  const m = /^(\d+)(?::(\d+)-(\d+):(\d+))?$/.exec(rest || '');
  if (!m) return e;
  if (!m[2]) return `${code} ${m[1]}`;
  return m[1] === m[3] ? `${code} ${m[1]}:${m[2]}-${m[4]}` : `${code} ${m[1]}:${m[2]}-${m[3]}:${m[4]}`;
}

const chapterOf = (e: string) => e.split(':')[0];
const sameChapter = (e: string, d: Drawn | null) => !!d && chapterOf(e) === `${d.chapter.code}.${d.chapter.chapter}`;

export function readingsOf(row: any): Reading[] {
  return (row.entries as string[]).map((entry, k) => {
    const p = row.parts?.[k] || {};
    return { entry, label: entryLabel(entry), read: !!row.read?.[k], fraction: row.read?.[k] ? 1 : p.fraction ?? 0, readTo: p.read_to ?? null, parts: p.parts || '', verses: p.verses || '' };
  });
}

async function load(id: string, dayNo?: number): Promise<Day | null> {
  const full = await wb(['plan', 'show', id]);
  const n: number | undefined = dayNo ?? day?.day ?? full.today ?? full.next?.day;
  const row = n ? full.schedule[n - 1] : null;
  if (!row) return null;
  return { id: full.id, name: full.name, day: row.day, of: full.cycle ? null : full.days, cycle: !!full.cycle, readings: readingsOf(row) };
}

function host(): HTMLElement | null { return document.getElementById('planstrip'); }

/** Read: opens the day in the reader (at its first reading not yet read) with the strip under the bar. */
export async function startDay(id: string, dayNo?: number, entry?: string) {
  const d = await load(id, dayNo);
  if (!d) return;
  day = d; hidden = false;
  drawStrip();
  const first = (entry && d.readings.find(r => r.entry === entry)) || d.readings.find(r => !r.read) || d.readings[0];
  if (first) goTo(first.entry);
}

/** The strip and everything that shows the day, read again (after a mark). */
export async function refreshStrip() {
  if (day) {
    try { const d = await load(day.id, day.day); if (d) day = d; } catch { /* the plan is gone: the strip goes */ day = null; }
  }
  drawStrip();
}

/** The reader moved to another chapter: the strip says which reading is open. */
export function moved() {
  drawStrip();
}

export function stripLabel(): string | null { return day ? `${day.name} · Day ${day.day}` : null; }

function drawStrip() {
  const el = host();
  if (!el) return;
  if (!day || hidden) { el.hidden = true; el.replaceChildren(); return; }
  const d = day;
  el.hidden = false;
  const row = h('div', 'plan-strip-row');
  const label = button('link-btn plan-strip-label', `${d.name} · Day ${d.day}`, () => void import('./plans').then(m => m.openPlans()));
  label.title = 'The plan pane';
  row.append(label);
  const open = d.readings.findIndex(r => sameChapter(r.entry, app.drawn));
  const SHOWN = 4;
  const order = d.readings.map((_, k) => k);
  let shown = order.slice(0, SHOWN);
  if (open >= SHOWN) shown = [...order.slice(0, SHOWN - 1), open];
  const chips = h('span', 'plan-strip-chips');
  for (const k of shown) {
    const r = d.readings[k];
    const c = button(`plan-strip-chip${r.read ? ' done' : ''}${k === open ? ' open' : ''}`, '', () => goTo(r.entry));
    c.dataset.entry = r.entry;
    c.append(h('span', 'plan-strip-box', r.read ? '✓' : ''), h('span', '', r.label));
    if (!r.read && r.fraction > 0) c.title = `${r.label}: read to verse ${r.readTo ?? '…'}`;
    chips.append(c);
  }
  row.append(chips);
  if (d.readings.length > shown.length) row.append(h('span', 'muted small plan-strip-more', `+${d.readings.length - shown.length}`));
  const n = d.readings.filter(r => r.read).length;
  row.append(h('span', 'muted small plan-strip-count', `${n} of ${d.readings.length}`));
  const close = button('icon-btn plan-strip-close', '×', () => { hidden = true; drawStrip(); });
  close.setAttribute('aria-label', 'Close the day’s strip');
  row.append(close);
  el.replaceChildren(row);
}

// ---- marking: one Mark read for the strip, the card, the pane and Listen (2dcf) --------------------------------------------

/** Mark a reading of a plan's day read (one log line, for this plan); the strip, the pane, the margin and the map update. */
export async function markReading(planId: string, entry: string): Promise<void> {
  await wb(['read', 'mark', entryPlace(entry), '--plan', planId]);
  await changed();
}

async function changed() {
  await refreshStrip();
  app.changed('plans');
  if (app.drawn) void paintRead(app.drawn, document.getElementById('reader')!);
}

/** The day open in the strip: which plan, and which of its readings is the chapter the reader is in. */
export function reading(d: Drawn | null = app.drawn): { plan: string; reading: Reading; next: Reading | null; last: boolean } | null {
  if (!day || !d) return null;
  const k = day.readings.findIndex(r => sameChapter(r.entry, d));
  if (k < 0) return null;
  const next = day.readings.slice(k + 1).concat(day.readings.slice(0, k)).find(r => !r.read) ?? null;
  return { plan: day.id, reading: day.readings[k], next, last: !day.readings.some((r, j) => j !== k && !r.read) };
}

/** The card at the end of a reading of the day (R3, R19): one step, and nothing is marked without a click. */
export function endCard(d: Drawn, into: HTMLElement) {
  into.querySelectorAll('.plan-end').forEach(x => x.remove());
  const at = reading(d);
  if (!at || at.reading.read) return;
  const card = h('div', 'plan-end');
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', 'The end of this reading');
  card.append(h('div', 'plan-end-title', `${at.reading.label} · reading ${day!.readings.indexOf(at.reading) + 1} of ${day!.readings.length}`));
  const acts = h('div', 'wrap');
  const mark = async (then?: Reading | null) => {
    try {
      await markReading(at.plan, at.reading.entry);
      card.remove();
      if (then) goTo(then.entry);
    } catch (x) { toast(String(x)); }
  };
  if (at.next && !at.last) acts.append(button('btn primary plan-end-next', `Mark read · next: ${at.next.label}`, () => void mark(at.next)));
  acts.append(button(at.last || !at.next ? 'btn primary plan-end-mark' : 'btn plan-end-mark', 'Mark read', () => void mark()),
    button('link-btn plan-end-skip', 'Not now', () => card.remove()));
  card.append(acts);
  into.append(card);
}

// ---- a part of a chapter read (R18) ---------------------------------------------------------------------------------------

function ranges(text: string): [number, number][] {
  return text.split(',').map(s => s.trim()).filter(Boolean).map(p => { const [a, b] = p.split('-'); return [+a, +(b ?? a)] as [number, number]; });
}

/** A thin line in the margin of the verses read: one line to the last verse of the run from verse 1, and one for each further
 *  range. A chapter read through is a line along all of it. */
export async function paintRead(d: Drawn, root: HTMLElement) {
  const place = `${d.chapter.name} ${d.chapter.chapter}`;
  let r: any;
  try { r = (Object.values((await wb(['read', 'times', place])) ?? {})[0] as any) ?? null; } catch { return; }
  if (app.drawn !== d) return;
  root.querySelectorAll<HTMLElement>('.vn').forEach(v => { v.classList.remove('vread', 'vread-run'); });
  if (!r?.verses) return;
  const run = r.read_to as number | null;
  for (const [a, b] of ranges(r.verses)) {
    for (let v = a; v <= b; v++) {
      const el = root.querySelector<HTMLElement>(`.vn[data-v="${v}"]`);
      if (!el) continue;
      el.classList.add('vread');
      if (run && a === 1) el.classList.add('vread-run');
      el.title = a === 1 && run ? `Read to verse ${run}` : `Read: verses ${a}–${b}`;
    }
  }
}

/** Mark read to here: the verses of the chapter up to this one (the verse's right click; `wb read mark "Gen 2:9" --to-here`). */
export async function readToHere(d: Drawn, verse: number, root: HTMLElement) {
  try {
    const made: any[] = await wb(['read', 'mark', `${d.chapter.code} ${d.chapter.chapter}:${verse}`, '--to-here']);
    toast(made.length ? `${d.chapter.name} ${d.chapter.chapter}: read to verse ${verse}` : `Verse ${verse} is already read`);
    await changed();
    await paintRead(d, root);
  } catch (x) { toast(String(x)); }
}

/** Mark the whole chapter read (the line under Mark read to here). */
export async function readChapter(d: Drawn, root: HTMLElement) {
  try {
    await wb(['read', 'mark', `${d.chapter.code} ${d.chapter.chapter}`]);
    toast(`${d.chapter.name} ${d.chapter.chapter} is marked read`);
    await changed();
    await paintRead(d, root);
  } catch (x) { toast(String(x)); }
}
