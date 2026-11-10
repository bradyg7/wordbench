// Editor saves participate in page deletion without sharing Notebook pane state.
const writers = new Map<HTMLElement, { id: string; flush: () => Promise<void>; stop: () => void }>();
export const removedPages = new Set<string>();
export function registerPageWriter(el: HTMLElement, id: string, flush: () => Promise<void>, stop: () => void) {
  writers.set(el, { id, flush, stop });
}
export async function flushPageWriters(ids?: string[]) {
  for (const [el, writer] of writers) {
    if (!el.isConnected) { writers.delete(el); continue; }
    if (!ids || ids.includes(writer.id)) await writer.flush();
  }
}
export function stopPageWriters(ids: string[]) {
  for (const id of ids) removedPages.add(id);
  for (const [el, writer] of writers) if (ids.includes(writer.id)) { writer.stop(); writers.delete(el); }
}
