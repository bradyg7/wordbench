// First run: the window opens here when there is no Bible database or no folder for the person's notes, instead of
// closing with a message box. The choices are saved by the Tauri side (wb_core::setup), so `wb` in a terminal sees the
// same ones. Only the app can do this; the browser tests never call it.
import { invoke } from '@tauri-apps/api/core';
import { inApp } from './api';

interface Slot { path: string | null; ok: boolean; detail: string; configured?: boolean }
interface Status { ok: boolean; db: Slot; study: Slot; suggested_study: string; version?: string }

/** True when the setup screen was drawn (the rest of the window should not start). */
export async function setupIfNeeded(): Promise<boolean> {
  if (!inApp) return false;
  let status: Status;
  try {
    status = await invoke<Status>('setup_status');
  } catch {
    return false;   // an older shell without setup: let the window show its own error
  }
  if (status.ok) return false;
  draw(status);
  return true;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function draw(initial: Status) {
  let status = initial;

  const root = el('div', 'setup');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'setup-title');

  const card = el('div', 'setup-card');
  card.append(el('p', 'setup-eyebrow', 'Bible Workbench'));
  const title = el('h1', '', 'Set up your workbench');
  title.id = 'setup-title';
  card.append(title);
  card.append(el('p', 'setup-lede', 'Two things and you are reading. The Bible stays read-only, and your notes stay in a folder you choose, as plain Markdown files that you own.'));

  // ---- the Bible ----
  const dbStep = el('section', 'setup-step');
  const dbHead = el('div', 'setup-head');
  dbHead.append(el('h2', '', 'The Bible'));
  const dbState = el('span', 'setup-state', '');
  dbHead.append(dbState);
  dbStep.append(dbHead);
  const dbPath = el('p', 'setup-path', '');
  const dbDetail = el('p', 'setup-detail', '');
  const dbButton = el('button', 'btn', 'Choose the database…');
  dbButton.type = 'button';
  dbStep.append(dbPath, dbDetail, dbButton);

  // ---- the study folder ----
  const studyStep = el('section', 'setup-step');
  const studyHead = el('div', 'setup-head');
  studyHead.append(el('h2', '', 'The folder for your notes'));
  const studyState = el('span', 'setup-state', '');
  studyHead.append(studyState);
  studyStep.append(studyHead);
  studyStep.append(el('p', 'setup-detail', 'This is where your notes, highlights, threads and reading plans are kept. Make a new folder here, or choose one you already use.'));
  const pathRow = el('div', 'setup-row');
  const input = el('input', 'setup-input');
  input.type = 'text';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'The folder for your notes');
  const useButton = el('button', 'btn', 'Use this folder');
  useButton.type = 'button';
  pathRow.append(input, useButton);
  const studyButton = el('button', 'btn soft', 'Choose a folder…');
  studyButton.type = 'button';
  studyStep.append(pathRow, studyButton);

  // ---- the end ----
  const message = el('p', 'setup-error', '');
  message.setAttribute('role', 'status');
  const start = el('button', 'btn primary wide', 'Start reading');
  start.type = 'button';
  const foot = el('p', 'setup-foot', 'Nothing is uploaded and no account is needed. Your files stay in the folder above. Page deletion has a short Undo window; legacy deletions use Trash.');

  card.append(dbStep, studyStep, message, start, foot);
  root.append(card);

  const paint = () => {
    dbState.textContent = status.db.ok ? 'Ready' : 'Needed';
    dbState.classList.toggle('ok', status.db.ok);
    dbPath.textContent = status.db.path || '';
    dbDetail.textContent = status.db.ok ? 'The Bible database is open, read-only.' : status.db.detail;
    studyState.textContent = status.study.ok ? 'Ready' : 'Needed';
    studyState.classList.toggle('ok', status.study.ok);
    if (!input.value) input.value = status.study.path || status.suggested_study;
    if (status.study.ok) input.value = status.study.path || input.value;
    start.disabled = !status.ok;
    start.textContent = status.ok ? 'Start reading' : 'Choose both to start';
  };

  const apply = async (command: string, args: Record<string, unknown> = {}) => {
    message.textContent = '';
    try {
      status = await invoke<Status>(command, args);
      paint();
    } catch (e) {
      message.textContent = String(e);
    }
  };

  dbButton.onclick = () => apply('choose_bible_db');
  studyButton.onclick = () => apply('choose_study_dir');
  useButton.onclick = () => {
    const path = input.value.trim();
    if (!path) {
      message.textContent = 'Type the folder to use, or choose one.';
      return;
    }
    void apply('set_study_dir', { path });
  };
  start.onclick = () => {
    if (status.ok) location.reload();
  };

  paint();
  document.body.append(root);
  (status.study.ok ? start : useButton).focus();
}
