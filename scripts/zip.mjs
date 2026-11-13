// A small ZIP writer and reader for the package build, with no dependency. Kurodyne refuses ZIP files with a comment
// (`git archive` and GitHub's source downloads add one), so the archive is built here from a plain folder and the
// comment is always empty. Names use forward slashes, there are no directory entries and no symbolic links.
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** A portable name inside the archive: forward slashes, no leading slash, no `..`, no empty segment. */
export function cleanName(name) {
  const n = String(name).replaceAll('\\', '/').replace(/^\.\/+/, '');
  if (!n) throw new Error('A package file needs a name.');
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n)) throw new Error(`The package name must be relative: ${name}`);
  if (n.split('/').some(part => part === '' || part === '..' || part === '.')) throw new Error(`The package name is not portable: ${name}`);
  return n;
}

function dosTime(d) {
  return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
}
function dosDate(d) {
  return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
}

/**
 * Writes `entries` as one ZIP file. Each entry is `{name, data}` or `{name, path}`; `mtime` is optional.
 * Returns the archive's own figures for the size checks.
 */
export function writeZip(outPath, entries, { mtime = new Date() } = {}) {
  if (entries.length > 65534) throw new Error('Too many package entries (the ZIP format holds 65,534 here).');
  const local = [];
  const central = [];
  let offset = 0;
  let raw = 0;
  let packed = 0;
  for (const entry of entries) {
    const name = Buffer.from(cleanName(entry.name), 'utf8');
    const data = entry.data !== undefined ? Buffer.from(entry.data) : readFileSync(entry.path);
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 6 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const flags = 0x0800; // UTF-8 file names
    const time = dosTime(mtime);
    const date = dosDate(mtime);

    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(flags, 6);
    head.writeUInt16LE(method, 8);
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    local.push(head, name, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);       // version made by
    dir.writeUInt16LE(20, 6);       // version needed
    dir.writeUInt16LE(flags, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt16LE(0, 30);       // extra
    dir.writeUInt16LE(0, 32);       // comment
    dir.writeUInt16LE(0, 34);       // disk
    dir.writeUInt16LE(0, 36);       // internal attributes
    dir.writeUInt32LE(0, 38);       // external attributes (no symbolic links)
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += head.length + name.length + body.length;
    raw += data.length;
    packed += body.length;
    if (offset > 0xFFFFFFFF) throw new Error('The package is too large for a ZIP without ZIP64 (4 GB).');
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);         // no archive comment
  writeFileSync(outPath, Buffer.concat([...local, cd, end]));
  return { entries: entries.length, raw, packed };
}

/** Reads the archive's directory without unpacking it: names, sizes, flags and the archive comment. */
export function readZip(file) {
  const buf = readFileSync(file);
  let eocd = -1;
  const first = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= first; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${file} is not a ZIP file (no end record).`);
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const commentLength = buf.readUInt16LE(eocd + 20);
  const comment = buf.subarray(eocd + 22, eocd + 22 + commentLength).toString('utf8');
  if (cdOffset + cdSize > eocd) throw new Error('The ZIP directory points outside the file.');
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLength = buf.readUInt16LE(p + 28);
    const extraLength = buf.readUInt16LE(p + 30);
    const noteLength = buf.readUInt16LE(p + 32);
    const external = buf.readUInt32LE(p + 38);
    const at = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    entries.push({ name, flags, method, crc, compressed, size, external, offset: at });
    p += 46 + nameLength + extraLength + noteLength;
  }
  return { file, comment, entries };
}

/** One entry's bytes (inflated when it was deflated). */
export function readEntry(file, entry) {
  const buf = readFileSync(file);
  const at = entry.offset;
  if (buf.readUInt32LE(at) !== 0x04034b50) throw new Error(`Bad local header for ${entry.name}`);
  const nameLength = buf.readUInt16LE(at + 26);
  const extraLength = buf.readUInt16LE(at + 28);
  const start = at + 30 + nameLength + extraLength;
  const body = buf.subarray(start, start + entry.compressed);
  if (entry.method === 0) return body;
  if (entry.method === 8) return inflateRawSync(body);
  throw new Error(`Unsupported compression method ${entry.method} in ${entry.name}`);
}
