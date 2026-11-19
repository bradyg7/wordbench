// The review page for a design folder: its sheet (the folder's PDF, when drawn) beside its interaction table, each row
// with a box for the person's notes, and "Copy my notes" to hand them back. Writes design/features/<folder>/review.html.
//
//   node design/review.mjs marks
//
// Open the written file in a browser (double-click). Notes are kept in that browser until copied.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = process.argv[2];
if (!folder) { console.error('usage: node design/review.mjs <folder>'); process.exit(1); }
const dir = join(dirname(fileURLToPath(import.meta.url)), 'features', folder);
const md = readFileSync(join(dir, 'README.md'), 'utf8');
const pdf = existsSync(join(dir, `${folder}.pdf`)) ? `${folder}.pdf` : null;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const cells = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));

// Sections by "## " heading; the interaction table's "### " groups hold the rows.
const sections = {};
let cur = '_top';
for (const line of md.split('\n')) {
  const h = /^## (.+)/.exec(line);
  if (h) { cur = h[1].trim(); sections[cur] = []; continue; }
  (sections[cur] ||= []).push(line);
}
const tableKey = Object.keys(sections).find(k => k.startsWith('Interaction table'));
const groups = [];
let group = null, header = null;
for (const line of sections[tableKey] || []) {
  const g = /^### (.+)/.exec(line);
  if (g) { group = { name: g[1], rows: [] }; groups.push(group); header = null; continue; }
  if (!line.trim().startsWith('|')) continue;
  if (/^\|\s*-/.test(line.trim())) continue;
  const c = cells(line);
  if (!header) { header = c; if (!group) { group = { name: '', rows: [] }; groups.push(group); } continue; }
  group.rows.push(c);
}
const prose = name => {
  const lines = sections[Object.keys(sections).find(k => k.startsWith(name))] || [];
  let html = '', list = false;
  for (const l of lines) {
    if (/^\s*(-|\d+\.)\s/.test(l)) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(l.replace(/^\s*(-|\d+\.)\s/, ''))}</li>`; continue; }
    if (/^\s{2,}\S/.test(l) && list) { html = html.replace(/<\/li>$/, ' ' + inline(l.trim()) + '</li>'); continue; }
    if (list) { html += '</ul>'; list = false; }
    const sub = /^###\s+(.+)/.exec(l);
    if (sub) { html += `<h3>${inline(sub[1])}</h3>`; continue; }
    if (l.trim().startsWith('|') && !/^\|\s*-/.test(l.trim())) html += `<div class="drow">${cells(l).map(inline).join(' · ')}</div>`;
    else if (l.trim() && !/^\|/.test(l.trim())) html += `<p>${inline(l)}</p>`;
  }
  return html + (list ? '</ul>' : '');
};
const title = (/^# (.+)/m.exec(md) || [, folder])[1];
const state = (/\*\*State:\*\*([^·\n]+)/.exec(md) || [, ''])[1].trim();
const total = groups.reduce((n, g) => n + g.rows.length, 0);
const built = groups.reduce((n, g) => n + g.rows.filter(r => /\[x\]/i.test(r[r.length - 1])).length, 0);

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} review</title>
<style>
:root{--bg:#f7f3ea;--ink:#2b2620;--soft:#6b6257;--line:#ddd3c2;--card:#fffdf8;--accent:#8a5a2b;--hi:#fbeccd}
@media (prefers-color-scheme:dark){:root{--bg:#1d1a16;--ink:#ece5d8;--soft:#a99f90;--line:#3a342c;--card:#25211c;--accent:#d9a066;--hi:#3d3020}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 Inter,system-ui,sans-serif}
header{padding:14px 20px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
h1{font:600 20px Literata,Georgia,serif;margin:0}.state{color:var(--soft)}
.wrap{display:grid;grid-template-columns:${pdf ? 'minmax(0,1fr) minmax(0,1.1fr)' : '1fr'};height:calc(100vh - 56px)}
.sheet{border-right:1px solid var(--line)}.sheet embed{width:100%;height:100%}
.side{overflow:auto;padding:12px 20px 60px}
.tools{position:sticky;top:0;background:var(--bg);padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;z-index:2}
input,button{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:5px 9px}
button{cursor:pointer}button.primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}
h2{font:600 15px Inter,sans-serif;margin:22px 0 6px}h3{font:600 13px Inter,sans-serif;color:var(--accent);margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em}
table{border-collapse:collapse;width:100%;background:var(--card)}td,th{border:1px solid var(--line);padding:5px 7px;vertical-align:top;text-align:left}
th{font-weight:600;color:var(--soft);font-size:12px}tr.picked td{background:var(--hi)}tr.noted td:first-child{box-shadow:inset 3px 0 var(--accent)}
td.note{min-width:180px}td.note textarea{width:100%;min-height:34px;font:inherit;color:inherit;background:transparent;border:1px dashed var(--line);border-radius:4px;resize:vertical}
code{font-size:12px;background:var(--hi);padding:0 3px;border-radius:3px}details{margin:8px 0}summary{cursor:pointer;font-weight:600}
.drow{padding:4px 0;border-bottom:1px solid var(--line)}.copied{color:var(--accent)}
@media (max-width:900px){.wrap{grid-template-columns:1fr;height:auto}.sheet{height:70vh;border-right:0;border-bottom:1px solid var(--line)}}
</style></head><body>
<header><h1>${esc(title)}</h1><span class="state">${inline(state)}</span><span class="state">${built} of ${total} rows built</span></header>
<div class="wrap">
${pdf ? `<div class="sheet"><embed src="${pdf}" type="application/pdf"></div>` : ''}
<div class="side">
<div class="tools"><input id="q" placeholder="Filter rows" size="24"><button id="copy" class="primary">Copy my notes</button><button id="clear">Clear notes</button><span id="msg"></span></div>
${pdf ? '' : '<p class="state">No sheet drawn yet: the table comes first (this folder\'s decision).</p>'}
<details><summary>Decisions</summary>${prose('Decisions')}</details>
<details open><summary>Leading design</summary>${prose('The leading design') || prose('Leading design')}</details>
${sections[Object.keys(sections).find(k => k.startsWith('Directions')) ?? ''] ? `<details open><summary>Directions</summary>${prose('Directions')}</details>` : ''}
<details open><summary>Open questions</summary>${prose('Open questions')}</details>
<h2>Interaction table</h2>
${groups.map(g => `<h3>${inline(g.name)}</h3><table><tr>${header.map(h => `<th>${inline(h)}</th>`).join('')}<th>Your note</th></tr>
${g.rows.map(r => `<tr data-n="${esc(r[0])}">${r.map(c => `<td>${inline(c)}</td>`).join('')}<td class="note"><textarea data-n="${esc(r[0])}"></textarea></td></tr>`).join('\n')}</table>`).join('\n')}
<h2>General note</h2><textarea data-n="general" style="width:100%;min-height:80px;font:inherit;background:var(--card);color:inherit;border:1px solid var(--line);border-radius:6px"></textarea>
</div></div>
<script>
const KEY = 'review:${folder}';
let notes = {}; try { notes = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch {} };
document.querySelectorAll('textarea[data-n]').forEach(t => {
  t.value = notes[t.dataset.n] || '';
  const mark = () => t.closest('tr')?.classList.toggle('noted', !!t.value.trim());
  mark();
  t.addEventListener('input', () => { notes[t.dataset.n] = t.value; save(); mark(); });
});
document.querySelectorAll('tr[data-n]').forEach(tr => tr.addEventListener('click', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  document.querySelectorAll('tr.picked').forEach(x => x.classList.remove('picked')); tr.classList.add('picked');
}));
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('tr[data-n]').forEach(tr => tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none');
});
document.getElementById('copy').addEventListener('click', async () => {
  const lines = ['Notes on ${esc(title)} (review page)'];
  document.querySelectorAll('tr[data-n]').forEach(tr => { const n = notes[tr.dataset.n]; if (n && n.trim()) lines.push('Row ' + tr.dataset.n + ' (' + tr.children[2].textContent.trim() + '): ' + n.trim()); });
  if ((notes.general || '').trim()) lines.push('General: ' + notes.general.trim());
  const text = lines.join('\\n');
  try { await navigator.clipboard.writeText(text); document.getElementById('msg').textContent = 'Copied ' + (lines.length - 1) + ' notes'; }
  catch { prompt('Copy these notes:', text); }
});
document.getElementById('clear').addEventListener('click', () => { if (confirm('Clear every note on this page?')) { notes = {}; save(); location.reload(); } });
</script></body></html>`;
writeFileSync(join(dir, 'review.html'), html);
console.log(`${join(dir, 'review.html')}: ${total} rows in ${groups.length} groups${pdf ? ', with the sheet' : ', no sheet yet'}`);
