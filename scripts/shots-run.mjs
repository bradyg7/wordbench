// `npm run shots`: run on purpose, it re-takes the committed screenshots (docs/phase2 and design/features/marks/build)
// by running the specs that save them with WB_SHOTS=1 (see scripts/shots.mjs). Nothing else writes those files.
// The measure/*.mjs desk scripts save their pictures the same way: `WB_SHOTS=1 node measure/desk.mjs`.
import { spawnSync } from 'node:child_process';

const specs = ['reader', 'marks-arrows', 'marks-card', 'marks-colormap', 'marks-find', 'marks-legend', 'marks-margin', 'marks-phone'];
const args = ['playwright', 'test', ...specs.map(s => `ui/tests/${s}.spec.ts`), '--project', 'webkit-phone', '--project', 'webkit-desktop', ...process.argv.slice(2)];
const r = spawnSync('npx', args, { stdio: 'inherit', shell: true, env: { ...process.env, WB_SHOTS: '1' } });
process.exit(r.status ?? 1);
