// Public release contract shared by the website and release preflight. No secrets belong here.
export function parseRelease(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) {
    throw new Error('Unsupported release metadata.');
  }
  if (value.status === 'unavailable') {
    return { schemaVersion: 1, status: 'unavailable' };
  }
  if (value.status !== 'published') throw new Error('This release is not published.');
  for (const key of ['version', 'publishedAt', 'minimumWindows', 'notes', 'downloadPath', 'sha256']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`Missing release field: ${key}.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version)) throw new Error('Invalid release version.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt))) throw new Error('Invalid publication date.');
  if (value.platform !== 'windows' || value.architecture !== 'x86_64' || value.channel !== 'pilot') throw new Error('Unsupported release target.');
  if (!Number.isSafeInteger(value.bytes) || value.bytes <= 0) throw new Error('Invalid installer size.');
  if (!/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error('Invalid installer checksum.');
  // Same-origin, authenticated download entry point. No arbitrary URLs or activation secrets in metadata.
  if (!/^\/downloads\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.downloadPath)) throw new Error('Invalid download path.');
  return Object.fromEntries(['schemaVersion', 'status', 'version', 'publishedAt', 'minimumWindows', 'notes', 'downloadPath', 'sha256', 'platform', 'architecture', 'channel', 'bytes'].map(key => [key, value[key]]));
}
