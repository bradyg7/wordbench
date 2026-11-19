export type PublicRelease = { schemaVersion: 2; status: 'unavailable' } | {
  schemaVersion: 2; status: 'published'; version: string; publishedAt: string;
  minimumWindows: string; downloadUrl: string; bytes?: number;
};
export const STABLE_DOWNLOAD: string;
export function parseRelease(value: unknown): PublicRelease;
