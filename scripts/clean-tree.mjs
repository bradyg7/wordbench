// CI's last step in every job that builds or tests (docs/turnaround.md step 2, ticket 8): the run must leave the
// checkout as it found it. Fails when a tracked file is modified or deleted, or an untracked file is not ignored.
import { execFileSync } from 'node:child_process';

function changedFiles(cwd = process.cwd()) {
  const out = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd, encoding: 'utf8' });
  const files = [];
  const parts = out.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2), file = parts[i].slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++;   // a rename lists the old name next
    files.push({ file, what: code === '??' ? 'a new file that is not ignored' : code.includes('D') ? 'deleted' : 'changed' });
  }
  return files;
}

{
  const files = changedFiles();
  if (files.length === 0) { console.log('The run left every committed file as it was.'); process.exit(0); }
  const list = files.map(f => `${f.file} (${f.what})`).join(', ');
  console.error(`A test or build changed committed files: ${list}. Tests must write to ignored scratch folders; committed screenshots change only through npm run shots.`);
  for (const f of files) console.error(`::error file=${f.file}::${f.file} was ${f.what} by the run`);
  process.exit(1);
}
