// Which marks the reader draws: the person's own highlights, every thread's underline (each can be hidden), or no
// highlights at all. Kept in this browser's storage; the study files are not touched by showing or hiding.

const STORE = 'wb.layers.v1';

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE) || '{}');
    return { mine: x.mine !== false, all: x.all !== false, hidden: new Set<string>(x.hidden || []) };
  } catch {
    return { mine: true, all: true, hidden: new Set<string>() };
  }
}

export const layers = {
  ...load(),
  shown(threadId: string) {
    return this.all && !this.hidden.has(threadId);
  },
  highlightsShown() {
    return this.all && this.mine;
  },
  save() {
    try { localStorage.setItem(STORE, JSON.stringify({ mine: this.mine, all: this.all, hidden: [...this.hidden] })); } catch { /* kept for this run */ }
  },
};
