export type PublicRelease = { schemaVersion: 1; status: 'unavailable' } | {
  schemaVersion: 1; status: 'published'; version: string; publishedAt: string;
  minimumWindows: string; notes: string; downloadPath: string; sha256: string;
  platform: 'windows'; architecture: 'x86_64'; channel: 'pilot'; bytes: number;
};
export function parseRelease(value: unknown): PublicRelease;
