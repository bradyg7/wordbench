// The restart after an update (design/features/updates U-8): the window is kept as it is, and the next start puts it back. The
// reader's place is already kept between runs; this keeps what is not: the panes, tabs, the tab in front and the floating
// tabs (as a layout describes them, without Settings), the line being typed in the command box and a finding half written.
// It is kept in the window's storage, which an update does not clear, and used once.
import { applyState } from './actions';
import { findingBox } from './findings';
import { current } from './layouts';
import { readLayout } from './layout-state';

const KEY = 'wb.restart.v1';

/** Before the app restarts into a new version. */
export function captureRestart() {
  const cmd = document.getElementById('cmd') as HTMLInputElement | null;
  const finding = document.querySelector<HTMLTextAreaElement>('.finding-box .finding-field');
  try {
    localStorage.setItem(KEY, JSON.stringify({ layout: current(), command: cmd?.value ?? '', finding: finding?.value ?? null }));
  } catch { /* storage off: the app still restarts, and the place is kept as it always is */ }
}

/** At the start after a restart: the window as it was. Nothing happens on an ordinary start. */
export async function restoreRestart() {
  let kept: { layout?: unknown; command?: string; finding?: string | null } | null = null;
  try { kept = JSON.parse(localStorage.getItem(KEY) || 'null'); localStorage.removeItem(KEY); } catch { return; }
  if (!kept) return;
  if (kept.finding) {
    findingBox();
    const f = document.querySelector<HTMLTextAreaElement>('.finding-box .finding-field');
    if (f) f.value = kept.finding;
  }
  if (kept.layout) {
    try { await applyState(readLayout(kept.layout), 'Restored', true); } catch { /* the window opens as it does on any start */ }
  }
  // last: the box shows the line of the tab in front until a line is being typed, so the typed line goes back after the panes
  const cmd = document.getElementById('cmd') as HTMLInputElement | null;
  if (kept.command && cmd) { cmd.value = kept.command; cmd.focus(); }
}
