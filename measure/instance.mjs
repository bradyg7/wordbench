// One real window at a time, across every session and checkout on this computer.
//
// The measure scripts start the real app, drive it, and (some) delete and rebuild their work folder first. Two sessions
// doing that at once used to collide: the same debugging port, the same work folder (one run wiping the folder the
// other's window was using), the speed budgets disturbed by a second window, and a pile of windows on the person's
// screen. `acquire` makes a run wait for the one before it; `freePort` gives each run a port nobody holds.
//
//   await acquire('desk');                       // first thing, before touching the work folder or starting the app
//   const cdpPort = process.env.WB_DESK_PORT || String(await freePort());
//
// The lock is a file in the temp folder naming the process that holds it. A holder that has gone (a crashed run, a closed
// terminal) is noticed by its process number and its lock is taken over, so a dead run never blocks the next.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const dir = path.join(os.tmpdir(), 'bible-workbench-rs');
const lockFile = path.join(dir, 'measure.lock');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const alive = pid => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

const holder = () => {
  try { return JSON.parse(fs.readFileSync(lockFile, 'utf8')); } catch { return null; }
};

let held = false;
const release = () => {
  if (!held) return;
  held = false;
  // only remove a lock that is still ours
  const h = holder();
  if (h && h.pid === process.pid) { try { fs.rmSync(lockFile, { force: true }); } catch { /* gone */ } }
};

export async function acquire(label, { waitMs = 30 * 60_000 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const me = JSON.stringify({ pid: process.pid, label, checkout: process.cwd(), since: new Date().toISOString() });
  const t0 = Date.now();
  let told = false;
  for (;;) {
    try {
      fs.writeFileSync(lockFile, me, { flag: 'wx' });
      held = true;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const h = holder();
    if (!h || !alive(h.pid)) { try { fs.rmSync(lockFile, { force: true }); } catch { /* raced */ } continue; }
    if (Date.now() - t0 > waitMs) throw new Error(`Waited ${Math.round(waitMs / 60000)} minutes for ${h.label} (process ${h.pid}, ${h.checkout}) to finish with the real window.`);
    if (!told) { console.log(`Waiting for ${h.label} (process ${h.pid}, in ${h.checkout}) to finish with the real window...`); told = true; }
    await sleep(1000);
  }
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(sig, () => { release(); process.exit(130); });
  return release;
}

// A port nobody is listening on, found by asking the system for one.
export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}
