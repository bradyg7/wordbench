// Public release contract shared by the website and release preflight. No secrets belong here.
export const DOWNLOAD_PREFIX = 'https://github.com/bradyg7/wordbench-releases/releases/';
export const STABLE_DOWNLOAD = `${DOWNLOAD_PREFIX}latest/download/Bible-Workbench-setup.exe`;
export function parseRelease(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 2) {
    throw new Error('Unsupported release metadata.');
  }
  if (value.status === 'unavailable') {
    return { schemaVersion: 2, status: 'unavailable' };
  }
  if (value.status !== 'published') throw new Error('This release is not published.');
  for (const key of ['version', 'publishedAt', 'minimumWindows', 'downloadUrl']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`Missing release field: ${key}.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version)) throw new Error('Invalid release version.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt))) throw new Error('Invalid publication date.');
  if (value.bytes !== undefined && (!Number.isSafeInteger(value.bytes) || value.bytes <= 0)) throw new Error('Invalid installer size.');
  if (value.downloadUrl !== STABLE_DOWNLOAD
    && value.downloadUrl !== `${DOWNLOAD_PREFIX}download/v${value.version}/Bible-Workbench-setup.exe`) throw new Error('Invalid download link.');
  const out = {};
  for (const key of ['schemaVersion', 'status', 'version', 'publishedAt', 'bytes', 'downloadUrl', 'minimumWindows']) if (value[key] !== undefined) out[key] = value[key];
  return out;
}
