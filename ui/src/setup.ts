import { invoke } from '@tauri-apps/api/core';
import '@fontsource/inter/400.css';
import '@fontsource/literata/400.css';
import './setup.css';
type Status = { ready: boolean; resources_ok: boolean; suggested_dir: string; study_dir: string | null; problem: string | null };
const form = document.querySelector<HTMLFormElement>('#setup')!;
const status = document.querySelector<HTMLElement>('#status')!;
const folder = document.querySelector<HTMLInputElement>('#folder')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const restart = document.querySelector<HTMLButtonElement>('#restart')!;
const licensing = document.querySelector<HTMLElement>('#licensing')!;
const licenseStatus = document.querySelector<HTMLElement>('#license-status')!;
const recovery = document.querySelector<HTMLElement>('#recovery')!;
let folderReady = false;
async function checkLicense() {
  restart.hidden = true;
  try {
    const result = await invoke<{ active: boolean; problem: string | null }>('pilot_license', { action: 'status' });
    licensing.hidden = result.active;
    licenseStatus.textContent = result.problem ?? 'Pilot license active. Offline use does not expire.';
    restart.hidden = !(result.active && folderReady);
  } catch (error) { licensing.hidden = false; licenseStatus.textContent = String(error); }
}
async function check() {
  form.hidden = true; retry.hidden = true; restart.hidden = true;
  status.textContent = 'Checking the installation…';
  try {
    const result = await invoke<Status>('installation_status');
    folderReady = result.ready;
    recovery.hidden = !result.study_dir;
    recovery.textContent = result.study_dir ? `Your study files remain accessible without activation. You can copy or back up this folder using your file manager: ${result.study_dir}` : '';
    status.textContent = result.problem ?? (result.ready ? 'Your study folder is ready.' : 'The installed resources are ready. Choose your study folder below.');
    if (!folder.value) folder.value = result.study_dir ?? result.suggested_dir;
    form.hidden = !result.resources_ok || result.ready;
    retry.hidden = result.resources_ok;
    await checkLicense();
  } catch (error) { status.textContent = String(error); retry.hidden = false; }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector<HTMLButtonElement>('button')!;
  submit.disabled = true;
  try {
    await invoke('installation_configure', { path: folder.value.trim(), create: new FormData(form).get('mode') === 'new' });
    form.hidden = true; folderReady = true; status.textContent = 'Study folder saved.';
    recovery.hidden = false; recovery.textContent = `Your study files remain accessible without activation: ${folder.value.trim()}`;
    await checkLicense();
  } catch (error) { status.textContent = String(error); }
  finally { submit.disabled = false; }
});
retry.addEventListener('click', check);
restart.addEventListener('click', async () => {
  try { await invoke('installation_restart'); } catch (error) { status.textContent = String(error); }
});
void check();

document.querySelector<HTMLButtonElement>('#request-license')!.addEventListener('click', async () => {
  try {
    const result = await invoke<{ request: string }>('pilot_license', { action: 'request' });
    const field = document.querySelector<HTMLTextAreaElement>('#request-text')!;
    field.value = result.request; field.focus(); field.select();
    licenseStatus.textContent = 'Copy this request and send it through your pilot invitation contact. It contains a public device key, not your notes.';
  } catch (error) { licenseStatus.textContent = String(error); }
});
document.querySelector<HTMLInputElement>('#certificate')!.addEventListener('change', async event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    if (file.size > 32768) throw new Error('License file is too large.');
    await invoke('pilot_license', { action: 'import', certificate: await file.text() });
    await checkLicense();
  } catch (error) { licenseStatus.textContent = String(error); }
});
