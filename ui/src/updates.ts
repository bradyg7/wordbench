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
}

let status: UpdateStatus | null = null;
const watchers = new Set<(s: UpdateStatus | null) => void>();

/** What the last look found, as the window last read it (null until `wb update status` has answered). */
export const updateStatus = () => status;
/** Called whenever the status is read again. */
export const onUpdateStatus = (f: (s: UpdateStatus | null) => void) => { watchers.add(f); return () => watchers.delete(f); };

/** Reads `wb update status` (no network) and tells whoever draws the dot. A failure to read leaves things as they were. */
export async function refreshUpdates(): Promise<UpdateStatus | null> {
  try { status = (await wb(['update', 'status'])) as UpdateStatus; } catch { return status; }
  for (const f of watchers) f(status);
  return status;
}

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

/** Install for now (Directions, until UP4): every open page is saved by the ordinary save first; if one cannot be saved
 *  the app is not restarted and says so. Then the download and installer run and the app restarts into the new version. */
export async function installNow(): Promise<{ ok: boolean; said: string }> {
  try { await flushPageWriters(); } catch (e) {
    return { ok: false, said: `A page could not be saved, so Bible Workbench was not restarted. ${String(e instanceof Error ? e.message : e)}`.trim() };
  }
  try {
    if (!inApp) return { ok: false, said: 'Installing works in the app.' };
    await invoke('update_install');
    return { ok: true, said: 'Restarting…' };
  } catch (e) {
    return { ok: false, said: String(e instanceof Error ? e.message : e) };
  }
}

/** "19 Nov 2026, 08:00" for the last look. */
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The line of U-4, said in the section. */
export const SENDS_NOTHING = 'A look asks one address for one small file and sends nothing about you: no account, no licence, no computer id, nothing from your study folder.';

type Row = (name: string, what: string, ctl: HTMLElement, keywords?: string) => HTMLElement;
type Seg = (opts: string[], cur: string, pick: (o: string) => void) => HTMLElement;

/** The Updates section's rows. `row` and `seg` are the Settings menu's own; `redraw` makes the section again. */
export async function updatesRows(row: Row, seg: Seg, redraw: () => void): Promise<HTMLElement[]> {
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
    const n = s.newer;
    const card = h('div', 'set-upd-card');
    card.setAttribute('aria-label', `Bible Workbench ${n.version}`);
    card.append(h('div', 'set-name', `Bible Workbench ${n.version}`));
    card.append(h('div', 'muted small', [n.date, n.size_text].filter(Boolean).join(' · ')));
    if (n.moved) card.append(h('div', 'set-upd-moved', n.moved));
    if (n.study) card.append(h('div', 'set-upd-study muted small', n.study));
    const note = h('div', 'set-upd-said muted small');
    note.setAttribute('role', 'status');
    const install = h('button', 'btn primary', 'Install') as HTMLButtonElement;
    install.onclick = async () => {
      install.disabled = true;
      note.textContent = 'Saving your pages…';
      const r = await installNow();
      note.textContent = r.said;
      note.classList.toggle('error', !r.ok);
      if (!r.ok) install.disabled = false;
    };
    card.append(install, note);
    out.push(card);
  } else if (s.last_look) {
    out.push(h('p', 'muted set-upd-newest', `Bible Workbench ${s.installed} is the newest`));
  }
  return out;
}
