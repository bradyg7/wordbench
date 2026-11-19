// What the marks panel has switched (rows 44 to 46): kinds hidden, legend entries hidden (by style, kind:color[:lines])
// and Reading mode (only the text). Kept by the core in settings/marks.json (wb settings marks); nothing here changes a
// mark. Outside the app (the WebKit tests) the switches live for the session.
import { inApp, wb, type DrawnMark } from './api';

export const KIND_NAMES: [DrawnMark['kind'], string][] = [['highlight', 'Highlight'], ['underline', 'Underline'], ['circle', 'Circle'], ['box', 'Box'], ['arrow', 'Arrow']];

export const panel = {
  kinds: new Set<string>(),
  styles: new Set<string>(),
  reading: false,
  /** The margin beside the text: the notes in full, or only their signs (settings/marks.json, `wb settings marks margin`). */
  margin: 'open' as 'open' | 'signs',
  /** A mark is drawn unless Reading mode, its kind or its legend entry is off. */
  shows(m: DrawnMark): boolean {
    return !this.reading && !this.kinds.has(m.kind) && !this.styles.has(m.style || '');
  },
  apply(s: { hidden_kinds?: string[]; hidden_styles?: string[]; reading?: boolean; margin?: string }) {
    this.kinds = new Set(s.hidden_kinds || []);
    this.styles = new Set(s.hidden_styles || []);
    this.reading = !!s.reading;
    this.margin = s.margin === 'signs' ? 'signs' : 'open';
  },
  async load() {
    try { this.apply(await wb(['settings', 'marks'])); } catch { /* outside the app: nothing kept */ }
  },
  async setKind(kind: string, on: boolean) {
    if (on) this.kinds.delete(kind); else this.kinds.add(kind);
    await this.keep(['kind', kind, on ? 'on' : 'off']);
  },
  async setStyle(style: string, on: boolean) {
    if (on) this.styles.delete(style); else this.styles.add(style);
    await this.keep(['entry', style, on ? 'on' : 'off']);
  },
  async setReading(on: boolean) {
    this.reading = on;
    await this.keep(['reading', on ? 'on' : 'off']);
  },
  /** Open or minimize the margin. Asked of the core even outside the app, so the WebKit tests can see the call. */
  async keepMargin(how: 'open' | 'signs') {
    this.margin = how;
    await wb(['settings', 'marks', 'margin', how]).catch(() => { if (inApp) throw new Error('The margin setting was not kept'); });
  },
  async keep(rest: string[]) {
    if (!inApp) return;
    await wb(['settings', 'marks', ...rest]);
  },
};
