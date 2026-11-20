// The review page for a design folder, as a presentation: a title slide, then one slide per interaction row with its
// drawn frame(s) large (rows/index.json) and the row's table data in a compact card, a comment box on each, notes kept in
// the browser and handed back as Markdown. A row without a frame in rows/index.json shows a placeholder.
// Writes design/features/<folder>/review.html. Styles are in review.css, behaviour in review-client.js (both inlined).
//
//   node design/review.mjs marks
//
// rows/index.json = [{"id":"12a","row":12,"file":"rows/12a.png","caption":"..."}], in table order; a row may have
// several entries (shown side by side). Open the written file in a browser (double-click).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = process.argv[2];
if (!folder) { console.error('usage: node design/review.mjs <folder>'); process.exit(1); }
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'features', folder);
const md = readFileSync(join(dir, 'README.md'), 'utf8');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const plain = s => s.replace(/`/g, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const cells = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));

// Sections by "## " heading; the interaction table's "### " groups hold the rows.
const sections = {};
let cur = '_top';
for (const line of md.split('\n')) {
  const h = /^## (.+)/.exec(line);
  if (h) { cur = h[1].trim(); sections[cur] = []; continue; }
  (sections[cur] ||= []).push(line);
}
const sec = name => sections[Object.keys(sections).find(k => k.startsWith(name)) ?? ''] || [];
const groups = [];
let group = null, header = null;
for (const line of sec('Interaction table')) {
  const g = /^### (.+)/.exec(line);
  if (g) { group = { name: g[1], rows: [] }; groups.push(group); header = null; continue; }
  if (!line.trim().startsWith('|')) continue;
  if (/^\|\s*-/.test(line.trim())) continue;
  const c = cells(line);
  if (!header) { header = c; if (!group) { group = { name: '', rows: [] }; groups.push(group); } continue; }
  group.rows.push(c);
}
const col = re => (header || []).findIndex(h => re.test(h));
const C = {
  where: col(/^where/i), action: col(/^action/i), sees: col(/what the person sees/i), disk: col(/on disk/i),
  wb: col(/wb/i), test: col(/test/i), built: (header || []).length - 1,
};

const prose = lines => {
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

// Decisions: only the items of the newest date (items are top-level "- " bullets with their indented lines).
const newestDecisions = () => {
  const lines = sec('Decisions');
  const items = []; let it = null; const lead = [];
  for (const l of lines) {
    if (/^-\s/.test(l)) { it = [l]; items.push(it); }
    else if (it && (/^\s+\S/.test(l))) it.push(l);
    else if (!l.trim()) { /* blank */ }
    else { it = null; lead.push(l); }
  }
  const dateOf = a => (a.join('\n').match(/\d{4}-\d{2}-\d{2}/g) || []).sort().pop() || '';
  const newest = items.map(dateOf).sort().pop() || '';
  const pick = items.filter(a => dateOf(a) === newest);
  return { date: newest, lines: (pick.length ? pick : items).flat() };
};

const title = (/^# (.+)/m.exec(md) || [, folder])[1];
const state = (/\*\*State:\*\*([^·\n]+)/.exec(md) || [, ''])[1].trim();
const roundRows = sec('Rounds').filter(l => /^\|\s*\d+\s*\|/.test(l));
const round = (/round\s+(\d+)/i.exec(state) || (roundRows.length ? [, /^\|\s*(\d+)/.exec(roundRows.at(-1))[1]] : [, '1']))[1];
const total = groups.reduce((n, g) => n + g.rows.length, 0);
const built = groups.reduce((n, g) => n + g.rows.filter(r => /\[x\]/i.test(r[C.built])).length, 0);
const dec = newestDecisions();

// Drawn frames per row.
let frames = null;
const idx = join(dir, 'rows', 'index.json');
if (existsSync(idx)) { try { frames = JSON.parse(readFileSync(idx, 'utf8')); } catch (e) { console.error('rows/index.json unreadable: ' + e.message); } }
const framesFor = n => (frames || []).filter(f => String(f.row) === String(n));
const framesHtml = n => {
  const fs = framesFor(n);
  if (fs.length) return fs.map(f => `<figure><img src="${esc(f.file)}" alt="${esc(f.caption || f.id)}" loading="lazy"><figcaption><b>${esc(f.id)}</b>${f.caption ? ' ' + esc(f.caption) : ''}</figcaption></figure>`).join('');
  return `<figure class="none"><figcaption>No frame drawn for this row yet</figcaption></figure>`;
};

let slideRows = '';
for (const g of groups) for (const r of g.rows) {
  const n = r[0];
  const f = i => (i >= 0 && r[i] ? r[i] : '');
  const dd = (label, i, big) => f(i) ? `<dt>${label}</dt><dd${big ? ' class="big"' : ''}>${inline(f(i))}</dd>` : '';
  const isBuilt = /\[x\]/i.test(r[C.built] || '');
  slideRows += `<section class="slide" data-row="${esc(n)}" data-group="${esc(plain(g.name))}" data-label="${esc(plain(f(C.action) || f(C.where)))}" data-where="${esc(plain(f(C.where)))}" data-action="${esc(plain(f(C.action)))}">
<div class="grp">${inline(g.name)}</div><div class="rowhead"><b>Row ${esc(n)}</b><span>${inline(f(C.where))}</span></div>
<div class="body"><div class="frames">${framesHtml(n)}</div>
<div class="side"><div class="card"><dl>${dd('Action', C.action, true)}${dd('What the person sees', C.sees)}${dd('On disk', C.disk)}${dd('wb command', C.wb)}${dd('Test', C.test)}<dt>Built</dt><dd><span class="built${isBuilt ? ' yes' : ''}">${isBuilt ? 'Built' : 'Not built'}</span></dd></dl></div>
<textarea data-k="${esc(n)}" placeholder="Your comment on row ${esc(n)}" aria-label="Comment on row ${esc(n)}"></textarea></div></div></section>\n`;
}

const noFrames = !frames || !frames.length;
const directions = sec('Directions').some(l => l.trim()) ? `<details><summary>Directions</summary>${prose(sec('Directions'))}</details>` : '';
const data = JSON.stringify({ folder, round, title }).replace(/</g, '\\u003c');
const css = readFileSync(join(here, 'review.css'), 'utf8');
const js = readFileSync(join(here, 'review-client.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(plain(title))} review</title>
<style>
${css}</style></head><body>
<div id="bar"><i></i></div>
<header><span class="name">${inline(title)}</span><span class="sp"></span><span id="count"></span><button id="gbtn" title="Overview of all rows (G)">Rows (G)</button></header>
<main id="stage">
<section class="slide title">
<div class="meta">Design review · round ${esc(round)}</div>
<h1>${inline(title)}</h1>
<p class="meta">${inline(state)}${state ? ' · ' : ''}${built} of ${total} rows built</p>
<div class="links"><button id="start" class="primary">Start: row 1</button> </div>
${noFrames ? '<p class="notice">The interactions of this folder are not drawn yet: every row shows a placeholder until rows/index.json lists frames.</p>' : ''}
${dec.lines.length ? `<h2>Decisions${dec.date ? ', ' + esc(dec.date) : ''}</h2>${prose(dec.lines)}` : ''}
<h2>Open questions</h2>${prose(sec('Open questions')) || '<p class="meta">None listed.</p>'}
${directions}
<h2>General comment</h2><textarea data-k="general" placeholder="Anything about the whole round" aria-label="General comment"></textarea>
<p class="meta">Arrow keys or the buttons move between slides; G shows every row; Esc leaves a comment box. Comments stay in this browser until you copy or download them.</p>
</section>
${slideRows}<div id="grid"></div>
</main>
<nav class="pn"><button id="prev">&larr; Back</button><button id="next" class="primary">Next &rarr;</button><span class="sp"></span><span id="msg"></span><button id="copy">Copy notes</button><button id="dl">Download notes</button></nav>
<div id="zoom"><img alt=""></div>
<script type="application/json" id="data">${data}</script>
<script>
${js}</script></body></html>`;
writeFileSync(join(dir, 'review.html'), html);
console.log(`${join(dir, 'review.html')}: ${total} rows in ${groups.length} groups, ${frames ? frames.length + ' frames' : 'no frames (placeholders)'}`);
