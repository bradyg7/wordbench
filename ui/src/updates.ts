// Updates (design/features/updates, UP1 and UP2): the dot on the rail's Settings gear, and the Updates section of the
// Settings menu. What is known comes from `wb update status`, which only reads what the last look kept beside the app;
// nothing here asks the network except Check now. No dialog, toast or tab ever announces an update (U-1).
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { inApp, wb } from './api';
import { flushPageWriters } from './pagewriters';
import { h } from './ui';

export interface UpdateStatus {
  installed: string;
  self_updating: boolean;
  message: string | null;
  commit: string;
  look: 'open' | 'ask';
  looks_by_itself: boolean;
  last_look: string | null;
  newer: { version: string; date: string; size: number; size_text: string; moved?: string; study?: string } | null;
  ready: string | null;
  skipped?: boolean;
  /** What the gear says: the version that is ready, or (after a download the person asked for failed) the failure, until Updates is opened. */
  dot?: string | null;
  /** How far a download has come, 0 to 1, while one runs; null otherwise. */
  ring?: number | null;
  failure?: string | null;
  download?: Download | null;
}

/** A download as `wb update status` gives it (UP4). */
export interface Download { version: string; state: 'downloading' | 'ready' | 'stopped' | 'refused'; got: number; total: number; got_text: string; total_text: string; fraction: number; message: string; seen?: boolean }

/** What the gear's dot says (the older status fixtures carry only `ready`). */
export const dotOf = (s: UpdateStatus | null) => (!s?.self_updating ? null : s.dot !== undefined ? s.dot : s.ready);

/** One release's notes as `wb update notes --json` gives them (UP3). */
export interface ReleaseNotes { version: string; date: string; open: boolean; moved: string[]; moved_something: boolean; new: string[]; changed: string[]; fixed: string[]; study: string[] }

let status: UpdateStatus | null = null;
const watchers = new Set<(s: UpdateStatus | null) => void>();

/** What the last look found, as the window last read it (null until `wb update status` has answered). */
export const updateStatus = () => status;
/** Called whenever the status is read again. */
export const onUpdateStatus = (f: (s: UpdateStatus | null) => void) => { watchers.add(f); return () => watchers.delete(f); };

/** Reads `wb update status` (no network) and tells whoever draws the dot. A failure to read leaves things as they were. */
export async function refreshUpdates(): Promise<UpdateStatus | null> {
  try { status = (await wb(['update', 'status'])) as UpdateStatus; } catch { return status; }
  // while a download runs the window reads again each second (the ring fills; the section shows how far it has come)
  if (status?.download?.state === 'downloading') { if (!poll) poll = window.setInterval(() => void refreshUpdates(), 1000); }
  else if (poll) { clearInterval(poll); poll = 0; }
  for (const f of watchers) f(status);
  return status;
}
let poll = 0;

/** Once, when the window starts: read the state, and read it again when the shell finds a newer version by itself. */
export function startUpdates() {
  void refreshUpdates();
  if (inApp) void listen('wb-update', () => void refreshUpdates());
}

/** Check now: "Looking…", then the answer in the words of `wb update check`. Resolves to what to say. */
export async function checkNow(): Promise<{ ok: boolean; said: string }> {
  try {
    const said = inApp ? await invoke<string>('update_check') : await wb(['update', 'check']);
    await refreshUpdates();
    return { ok: true, said: String(said).trim() };
  } catch (e) {
    return { ok: false, said: String(e instanceof Error ? e.message : e).replace(/^error: /, '').trim() };
  }
}

/** The look setting, written beside the app (`wb settings updates open|ask`). */
export async function setLook(look: 'open' | 'ask') {
  await wb(['settings', 'updates', look]);
  await refreshUpdates();
}

/** Install (U-7, UP4): the download starts in the background and this returns at once. Nothing is installed until Restart now,
 *  or the window is closed. */
export async function startInstall(): Promise<{ ok: boolean; said: string }> {
  try {
    if (inApp) await invoke('update_install'); else await wb(['update', 'install']);
    await refreshUpdates();
    return { ok: true, said: '' };
  } catch (e) {
    return { ok: false, said: String(e instanceof Error ? e.message : e).replace(/^error: /, '').trim() };
  }
}

/** Stop: a download is given up (its partial file removed), or a download waiting for a restart is. */
export async function stopInstall(): Promise<{ ok: boolean; said: string }> {
  try {
    const said = inApp ? await invoke<string>('update_stop') : await wb(['update', 'stop']);
    await refreshUpdates();
    return { ok: true, said: String(said).trim() };
  } catch (e) {
    return { ok: false, said: String(e instanceof Error ? e.message : e).replace(/^error: /, '').trim() };
  }
}

/** Restart now (U-8): every open page is saved by the ordinary save first; if one cannot be saved the app is not restarted
 *  and says so. Then the installer runs and the app opens again in the new version. */
export async function restartNow(): Promise<{ ok: boolean; said: string }> {
  try { await flushPageWriters(); } catch (e) {
    return { ok: false, said: `A page could not be saved, so Bible Workbench was not restarted. ${String(e instanceof Error ? e.message : e)}`.trim() };
  }
  try {
    if (!inApp) return { ok: false, said: 'Installing works in the app.' };
    await invoke('update_restart');
    return { ok: true, said: 'Restarting…' };
  } catch (e) {
    return { ok: false, said: String(e instanceof Error ? e.message : e) };
  }
}

/** Not this version (U-10): set the newer version aside, so the dot goes; or put it back. */
export async function setAside(on: boolean) {
  await wb(on ? ['update', 'skip'] : ['update', 'skip', '--clear']);
  await refreshUpdates();
}

/** What changed (U-6): every release newer than the one running, newest first, as plain text. The newest is open under
 *  its four headings in order, then Your study folder; the older ones are folded to their version and date, and one that
 *  moved or removed something still shows that line. Everything here is set with textContent: no link is followed, no
 *  markup drawn, nothing fetched. */
export function drawNotes(releases: ReleaseNotes[]): HTMLElement {
  const box = h('div', 'set-upd-notes');
  box.setAttribute('aria-label', 'What changed');
  const list = (title: string, lines: string[]) => {
    const part = h('div', 'set-upd-part');
    part.append(h('h4', 'set-upd-heading', title));
    if (lines.length) { const ul = h('ul', 'set-upd-lines'); for (const l of lines) ul.append(h('li', '', l)); part.append(ul); }
    return part;
  };
  const body = (r: ReleaseNotes) => [list('Moved or removed', r.moved), list('New', r.new), list('Changed', r.changed), list('Fixed', r.fixed), list('Your study folder', r.study)];
  const title = (r: ReleaseNotes) => `Bible Workbench ${r.version}${r.date ? ` (${r.date})` : ''}`;
  for (const r of releases) {
    if (r.open) {
      const sec = h('section', 'set-upd-release open');
      sec.append(h('h3', 'set-upd-version', title(r)), ...body(r));
      box.append(sec);
      continue;
    }
    const d = h('details', 'set-upd-release folded');
    const sum = h('summary', 'set-upd-folded', title(r));
    d.append(sum);
    if (r.moved_something) sum.append(h('span', 'set-upd-folded-moved muted small', `Moved or removed: ${r.moved[0]}`));
    d.append(...body(r));
    box.append(d);
  }
  return box;
}

/** "19 Nov 2026, 08:00" for the last look. */
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The line of U-4, said in the section. */
export const SENDS_NOTHING = 'A look asks one address for one small file and sends nothing about you: no account, no licence, no computer id, nothing from your study folder.';

type Row = (name: string, what: string, ctl: HTMLElement, keywords?: string) => HTMLElement;
type Seg = (opts: string[], cur: string, pick: (o: string) => void) => HTMLElement;

/** The Updates section's rows. `row` and `seg` are the Settings menu's own; `redraw` makes the section again. */
export async function updatesRows(row: Row, seg: Seg, redraw: () => void): Promise<HTMLElement[]> {
  // opening Updates puts a failure's dot away (U-11); a version still ready keeps its own
  if (status?.download && !status.download.seen && status.failure) { try { await wb(['update', 'status', '--seen']); } catch { /* the dot stays until the next look */ } }
  const s = (await refreshUpdates()) ?? status;
  const out: HTMLElement[] = [];
  if (!s) { out.push(h('p', 'muted', 'Updates could not be read.')); return out; }
  out.push(row('Installed version', `Bible Workbench ${s.installed}`, h('span', 'muted small', ''), 'version update'));
  if (!s.self_updating) {
    // U-14: a copy built from source offers nothing else
    out.push(h('p', 'muted set-upd-source', s.message ?? ''));
    return out;
  }
  out.push(row('Last looked', s.last_look ? when(s.last_look) : 'Not yet', h('span', 'muted small', ''), 'update look'));
  const WORDS: Record<string, string> = { open: 'When the app opens', ask: 'Only when I ask' };
  out.push(row('Look for updates', 'The app looks once when it opens, and not again within a day; or only when you ask.',
    seg(['When the app opens', 'Only when I ask'], WORDS[s.look], o => void setLook(o === 'Only when I ask' ? 'ask' : 'open').then(redraw)), 'update look check automatic'));

  const said = h('div', 'set-upd-said muted small');
  said.setAttribute('role', 'status');
  const check = h('button', 'btn', 'Check now') as HTMLButtonElement;
  check.onclick = async () => {
    check.disabled = true;
    said.textContent = 'Looking…';
    const r = await checkNow();
    check.disabled = false;
    said.textContent = r.said;
    said.classList.toggle('error', !r.ok);
    if (r.ok) setTimeout(redraw, 0);
  };
  const checkRow = row('Check now', 'Look for a newer version now.', check, 'update look check');
  checkRow.querySelector('.set-text')!.append(said);
  out.push(checkRow);
  out.push(h('p', 'muted small set-upd-sends', SENDS_NOTHING));

  if (s.newer) {
    out.push(drawCard(s, redraw));
  } else if (s.last_look) {
    out.push(h('p', 'muted set-upd-newest', `Bible Workbench ${s.installed} is the newest`));
  }
  return out;
}

/** The card for the newer version (row 5): what it is, What changed, Not this version, and the one filled button for the
 *  step the install is at: Install (or Try again), Stop while it downloads, Restart now once it is whole and signed. It
 *  paints again whenever the status is read again, so a download's progress shows without the section being made again. */
function drawCard(s0: UpdateStatus, redraw: () => void): HTMLElement {
  const n = s0.newer!;
  const card = h('div', 'set-upd-card');
  card.setAttribute('aria-label', `Bible Workbench ${n.version}`);
  card.append(h('div', 'set-name', `Bible Workbench ${n.version}`));
  card.append(h('div', 'muted small', [n.date, n.size_text].filter(Boolean).join(' · ')));
  if (n.moved) card.append(h('div', 'set-upd-moved', n.moved));
  if (n.study) card.append(h('div', 'set-upd-study muted small', n.study));

  const note = h('div', 'set-upd-said muted small');
  note.setAttribute('role', 'status');
  const bar = h('progress', 'set-upd-bar') as HTMLProgressElement;
  bar.max = 1;
  bar.hidden = true;
  const notes = h('div', 'set-upd-notes-slot');
  const what = h('button', 'btn', 'What changed') as HTMLButtonElement;
  what.setAttribute('aria-expanded', 'false');
  what.onclick = async () => {
    if (what.getAttribute('aria-expanded') === 'true') { notes.replaceChildren(); what.setAttribute('aria-expanded', 'false'); return; }
    what.disabled = true;
    try {
      const r = await wb(['update', 'notes', '--json']) as { releases: ReleaseNotes[] };
      notes.replaceChildren(drawNotes(r.releases));
      what.setAttribute('aria-expanded', 'true');
    } catch (e) {
      notes.replaceChildren(h('div', 'set-upd-said error muted small', String(e instanceof Error ? e.message : e).replace(/^error: /, '')));
    }
    what.disabled = false;
  };
  const aside = h('button', 'btn') as HTMLButtonElement;
  const step = h('span', 'set-upd-step');
  const acts = h('div', 'set-upd-acts');
  acts.append(step, what, aside);
  card.append(acts, bar, note, notes);

  let kept = '';
  let keptError = false;
  const say = (text: string, error = false) => { kept = text; keptError = error; note.textContent = text; note.classList.toggle('error', error); };
  const button = (label: string, primary: boolean, run: () => Promise<void>) => {
    const b = h('button', primary ? 'btn primary' : 'btn', label) as HTMLButtonElement;
    b.onclick = async () => { b.disabled = true; try { await run(); } finally { b.disabled = false; } };
    return b;
  };
  const paint = (s: UpdateStatus | null) => {
    if (!s?.newer) return;
    const d = s.download && s.download.version === s.newer.version ? s.download : null;
    aside.textContent = s.skipped ? 'Tell me about this version again' : 'Not this version';
    aside.onclick = async () => { aside.disabled = true; try { await setAside(!s.skipped); } finally { redraw(); } };
    bar.hidden = d?.state !== 'downloading';
    if (d?.state === 'downloading') {
      bar.value = d.fraction;
      const of = d.total_text ? `${d.got_text || '0 KB'} of ${d.total_text}` : d.got_text;
      note.textContent = `Downloading ${of}. You can close Settings and keep reading.`;
      note.classList.remove('error');
      step.replaceChildren(button('Stop', false, async () => { const r = await stopInstall(); say(r.said, !r.ok); }));
    } else if (d?.state === 'ready') {
      note.textContent = kept;
      note.classList.toggle('error', keptError);
      step.replaceChildren(
        button('Restart now', true, async () => { say('Saving your pages…'); const r = await restartNow(); say(r.said, !r.ok); }),
        button('When I close the app', false, async () => { say('Bible Workbench will install it when you close the app.'); }),
      );
    } else if (d?.state === 'refused') {
      // there is no button that installs it anyway (U-12)
      say(s.failure || d.message, true);
      step.replaceChildren();
    } else {
      if (d?.state === 'stopped') say(s.failure || d.message, true);
      else { note.textContent = kept; note.classList.toggle('error', keptError); }
      step.replaceChildren(button(d?.state === 'stopped' ? 'Try again' : 'Install', true, async () => {
        say('');
        const r = await startInstall();
        if (!r.ok) say(r.said, true);
      }));
    }
  };
  paint(s0);
  const off = onUpdateStatus(s => { if (!card.isConnected) { off(); return; } paint(s); });
  return card;
}
