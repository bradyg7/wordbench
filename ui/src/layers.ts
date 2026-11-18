// Which marks the reader draws: the person's own highlights, the underlines of folders with a color (each folder's eye is kept in the study's settings: wb folder shown), or no
// highlights at all. Kept in this browser's storage; the study files are not touched by showing or hiding.

const STORE = 'wb.layers.v1';

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE) || '{}');
    return { mine: x.mine !== false, all: x.all !== false, margin: x.margin !== false };
  } catch {
    return { mine: true, all: true, margin: true };
  }
}

export const layers = {
  ...load(),
  highlightsShown() {
    return this.all && this.mine;
  },
  save() {
    try { localStorage.setItem(STORE, JSON.stringify({ mine: this.mine, all: this.all, margin: this.margin })); } catch { /* kept for this run */ }
  },
};
