// Timings for the speed budgets (docs/PLAN.md section 6), read by the measuring script and shown under More.

export interface Entry { name: string; ms: number; [k: string]: unknown }

export const perf = {
  entries: [] as Entry[],
  summary(): string {
    const by = new Map<string, number[]>();
    for (const e of this.entries) by.set(e.name, [...(by.get(e.name) || []), e.ms]);
    return [...by].map(([n, ms]) => `${n}: last ${ms[ms.length - 1].toFixed(1)} ms, median ${median(ms).toFixed(1)} ms (${ms.length})`).join('\n') || 'nothing yet';
  },
};

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function record(name: string, ms: number, extra: Record<string, unknown> = {}) {
  perf.entries.push({ name, ms, ...extra });
}

// Resolves after the next frame has been drawn (a frame, then a task after it).
export function afterPaint(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
}
