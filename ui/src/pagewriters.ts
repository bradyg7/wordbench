// Editor saves participate in page deletion without sharing Notebook pane state.
const writers = new Map<HTMLElement, { id: string; flush: () => Promise<void>; stop: () => void }>();
export const removedPages = new Set<string>();
export function registerPageWriter(el: HTMLElement, id: string, flush: () => Promise<void>, stop: () => void) {
  writers.set(el, { id, flush, stop });
}
/** A page's title as its editor shows it (the nearest title above the writing). */
function titleNear(el: HTMLElement): string {
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    const t = p.querySelector('.nb-title')?.textContent?.trim();
    if (t) return t;
  }
  return '';
}

/** A page that could not be saved: its title, for the words that say so (updates U-8). */
export class PageNotSaved extends Error {
  constructor(public title: string, why: string) { super(why); }
}

export async function flushPageWriters(ids?: string[]) {
  for (const [el, writer] of writers) {
    if (!el.isConnected) { writers.delete(el); continue; }
    if (!ids || ids.includes(writer.id)) {
      try { await writer.flush(); } catch (e) { throw new PageNotSaved(titleNear(el) || writer.id || 'A page', String(e instanceof Error ? e.message : e)); }
    }
  }
}
export function stopPageWriters(ids: string[]) {
  for (const id of ids) removedPages.add(id);
  for (const [el, writer] of writers) if (ids.includes(writer.id)) { writer.stop(); writers.delete(el); }
}
