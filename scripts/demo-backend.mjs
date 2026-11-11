// Recording-only bridge: the unchanged UI talks to the real default-development
// wb binary. No answers or study mutations are fabricated. Never ship this bridge.
import { spawn } from 'node:child_process';
import { mkdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';

export async function attachDemoBackend(page, { studyDir, bibleDb, wbPath }) {
  const staging = await realpath(resolve('release-staging'));
  const requested = resolve(studyDir);
  const within = path => {
    const rel = relative(staging, path);
    return rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel);
  };
  if (!within(requested)) throw new Error('Demo study must be inside this checkout’s release-staging directory.');
  await mkdir(requested, { recursive: true });
  const study = await realpath(requested);
  if (!within(study) || /bible-study-data/i.test(study)) throw new Error('Refusing a real study folder or a link outside release-staging.');
  const binary = await realpath(resolve(wbPath));
  const database = await realpath(resolve(bibleDb));
  const env = { ...process.env, WB_STUDY_DIR: study, WB_BIBLE_DB: database,
    WB_APP_DIR: resolve(study, '.demo-app'), WB_DOCS_DIR: resolve(study, '.demo-documents') };
  delete env.WB_ALLOW_REAL_STUDY;
  const calls = [];
  let queue = Promise.resolve();
  const execute = (argv, input) => new Promise((done, fail) => {
    const child = spawn(binary, argv, { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', fail);
    child.on('close', code => code === 0 ? done(stdout.trim()) : fail(new Error(stderr.trim() || `wb exited ${code}`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
  const info = JSON.parse(await execute(['build-info', '--json']));
  if (info.distribution !== false) throw new Error('Demo capture requires a verified default developer wb binary, not a customer build.');
  const run = async (argv, input) => {
    if (!Array.isArray(argv) || argv.some(a => typeof a !== 'string')) throw new Error('Invalid demo command');
    // These launch external programs, change setup, or reach arbitrary filesystem
    // targets; they require separate native capture rather than this adapter.
    if (['setup', 'license', 'do', 'sync', 'open', 'copy'].includes(argv[0]) || argv.includes('--open')) throw new Error(`Native-only demonstration: ${argv[0]}`);
    const text = await execute(argv.includes('--json') ? argv : [...argv, '--json'], input);
    return text ? JSON.parse(text) : null;
  };
  const dispatch = async (command, a = {}) => {
    if (command === 'ui_ready' || command === 'do_done') return null;
    if (command.startsWith('plugin:event|')) return 1;
    const start = performance.now();
    let data;
    switch (command) {
      case 'reader': data = await run(['reader', a.code, String(a.chapter), '--version', a.version || 'KJV']); break;
      case 'word': data = await run(['word', a.code, String(a.chapter), String(a.verse), String(a.word)]); break;
      case 'verse': data = await run(['verse', a.code, String(a.chapter), String(a.verse)]); break;
      case 'books': data = (await run(['books'])).books; break;
      case 'highlight': data = await run(a.color ? ['hl', 'set', a.anchor, a.color] : ['hl', 'clear', a.anchor]); break;
      case 'plan_today': data = await run(['plan', 'today']); break;
      case 'read_mark': data = await run(['read', 'mark', a.place]); break;
      case 'wb': {
        const value = await run(a.argv, a.input);
        data = typeof value === 'string' ? { text: value } : { json: value };
        break;
      }
      default: throw new Error(`Native-only command is not simulated: ${command}`);
    }
    calls.push({ command, argv: a.argv, elapsedMs: Math.round(performance.now() - start) });
    return { data, rust_ms: performance.now() - start };
  };
  await page.exposeFunction('__demoInvoke', (command, args) => {
    // Independent CLI processes must not race store writes, unlike native wb's mutex.
    const next = queue.then(() => dispatch(command, args));
    queue = next.catch(() => {});
    return next;
  });
  await page.addInitScript(() => {
    let callbackId = 0;
    window.__TAURI_INTERNALS__ = {
      invoke: (command, args) => window.__demoInvoke(command, args),
      transformCallback: () => ++callbackId,
      unregisterCallback: () => {},
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  });
  return { studyDir: study, calls, run: (argv, input) => {
    const next = queue.then(() => run(argv, input));
    queue = next.catch(() => {});
    return next;
  }, flush: () => queue };
}
