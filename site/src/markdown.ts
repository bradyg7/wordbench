// A tiny Markdown to HTML for the release notes: headings, lists, paragraphs, bold and code. Everything is escaped first.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export function markdownToHtml(source: string, headingLevel = 3): string {
  const out: string[] = [];
  let list = false, para: string[] = [];
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const closeList = () => { if (list) out.push('</ul>'); list = false; };
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) { flushPara(); closeList(); const level = Math.min(6, headingLevel + heading[1].length - 2); out.push(`<h${level}>${inline(heading[2])}</h${level}>`); }
    else if (item) { flushPara(); if (!list) out.push('<ul>'); list = true; out.push(`<li>${inline(item[1])}</li>`); }
    else if (!line.trim()) { flushPara(); closeList(); }
    else { closeList(); para.push(line.trim()); }
  }
  flushPara(); closeList();
  // A heading with nothing under it (an empty section) is dropped.
  return out.join('\n').replace(/<h(\d)>[^\n]*<\/h\1>(?:\n(?=<h\d>)|\n?$)/g, '');
}

export function versionParts(v: string): number[] { return v.split('-')[0].split('.').map(Number); }
export function compareVersions(a: string, b: string): number {
  const x = versionParts(a), y = versionParts(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}
