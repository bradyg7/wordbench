import { wb } from './api';
import { button, h } from './ui';

type Choice = 'kind' | 'status' | 'place' | 'folder' | 'days';
type Choices = Partial<Record<Choice, { value: string; label: string }>>;
type Folder = { id: string; name: string };

const pageKinds = [['', 'Any page kind'], ['note', 'Regular pages'], ['day', 'Day pages'], ['question', 'Question pages'], ['thread', 'Folder pages']];
const statuses = [['', 'Any status'], ['open', 'Open'], ['answered', 'Answered']];

export function notebookFilters(questions: boolean, renderRow: (entry: any) => HTMLElement) {
  const root = h('section', 'nb-scope');
  const title = questions ? 'Questions' : 'All';
  const statusLabel = questions ? 'Status' : 'Pages with questions';
  const labels = { kind: 'Page kind', status: statusLabel, place: 'Book and place', folder: 'Folder', days: 'Written' };
  const heading = h('div', 'nb-scope-heading');
  const count = h('span', 'muted small');
  count.setAttribute('aria-live', 'polite');
  const toggle = button('btn soft small nb-scope-toggle', 'Filters', open);
  toggle.setAttribute('aria-expanded', 'false');
  heading.append(h('h2', '', title), count, toggle);
  const active = h('div', 'nb-scope-applied');
  active.hidden = true;
  const rows = h('div', 'nb-scroll nb-scope-rows');
  const error = h('p', 'small nbv-error');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  root.append(heading, active, error, rows);

  let applied: Choices = {};
  let words = '';
  let run = 0;
  let timer = 0;
  let panel: HTMLFormElement | null = null;
  let submission: Choices | null = null;

  function command(choices: Choices) {
    const { kind, status, place, folder, days } = choices;
    if (questions) return ['question', 'list', '--status', status?.value === 'answered' ? 'done' : status?.value || 'all',
      ...(place ? ['--at', place.value] : []), ...(words.trim() ? ['--search', words.trim()] : [])];
    const line = ['notebook', 'section', 'all'];
    for (const word of words.trim().split(/\s+/).filter(Boolean)) line.push(JSON.stringify(word));
    if (kind) line.push('kind', kind.value);
    if (status) line.push('page-questions', status.value);
    if (place) line.push('@', JSON.stringify(place.value));
    if (folder) line.push('folder', JSON.stringify(folder.value));
    if (days) line.push('days', days.value);
    return ['notebook', '--view', line.join(' ')];
  }

  async function load() {
    clearTimeout(timer);
    const current = ++run;
    const pending = submission;
    const from = pending ? panel : null;
    try {
      const data = await wb(command(pending ?? applied));
      if (current !== run || (from && panel !== from)) return;
      const entries = questions
        ? data.questions.map((q: any) => ({ ...q, kind: 'question', title: q.title ?? q.text, placed: !!q.anchor, label: q.label ?? data.label }))
        : data.groups.flatMap((group: any) => group.entries);
      rows.replaceChildren(...entries.map(renderRow));
      if (!entries.length) rows.append(h('p', 'muted nb-empty', `No ${questions ? 'questions' : 'pages'} match.`));
      const noun = questions ? 'question' : 'page';
      count.textContent = `${entries.length} ${noun}${entries.length === 1 ? '' : 's'}`;
      error.hidden = true;
      if (pending) {
        applied = pending;
        submission = null;
        const keys = (Object.keys(labels) as Choice[]).filter(key => applied[key]);
        active.replaceChildren(...keys.map(key => h('div', '', `${labels[key]} · ${applied[key]!.label}`)));
        active.hidden = !keys.length;
        toggle.textContent = keys.length ? `Filters · ${keys.length}` : 'Filters';
        close();
      }
    } catch (reason) {
      if (current !== run || (from && panel !== from)) return;
      submission = null;
      const message = from?.querySelector<HTMLElement>('.nb-scope-error') ?? error;
      message.textContent = String(reason);
      message.hidden = false;
    }
  }

  function close() {
    if (submission) {
      submission = null;
      void load();
    }
    panel?.remove();
    panel = null;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus({ preventScroll: true });
  }

  function open() {
    if (panel) return;
    const form = h('form', 'nb-scope-panel');
    panel = form;
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-label', 'Filters');
    const head = h('div', 'nb-scope-panel-head');
    const dismiss = button('link-btn small', 'Close', close);
    dismiss.type = 'button';
    head.append(h('h2', '', 'Filters'), dismiss);
    const body = h('div', 'nb-scope-fields');
    const message = h('p', 'small nbv-error nb-scope-error');
    message.hidden = true;
    message.setAttribute('role', 'alert');
    const fields = new Map<Choice, HTMLInputElement | HTMLSelectElement>();

    function field<T extends HTMLInputElement | HTMLSelectElement>(key: Choice, input: T) {
      const label = h('label', 'nb-filter-field');
      input.setAttribute('aria-label', labels[key]);
      label.append(h('span', '', labels[key]), input);
      body.append(label);
      fields.set(key, input);
      return input;
    }

    function addOptions(input: HTMLSelectElement, options: string[][]) {
      for (const [value, label] of options) input.add(new Option(label, value));
    }

    function select(key: Choice, options: string[][]) {
      const input = field(key, h('select', 'field'));
      addOptions(input, options);
      input.value = applied[key]?.value ?? '';
      return input;
    }

    if (!questions) select('kind', pageKinds);
    select('status', statuses);
    const place = field('place', h('input', 'field'));
    place.placeholder = questions ? 'Any place' : 'Reference or Strong’s number';
    place.value = applied.place?.value ?? '';
    if (!questions) {
      const folder = select('folder', [['', 'Any folder']]);
      if (applied.folder) {
        addOptions(folder, [[applied.folder.value, applied.folder.label]]);
        folder.value = applied.folder.value;
      }
      void wb(['folder', 'list']).then((list: Folder[]) => {
        if (panel !== form) return;
        const selected = folder.value;
        const options = list.sort((a, b) => a.name.localeCompare(b.name)).map(f => [f.id, f.name]);
        if (applied.folder && !options.some(([id]) => id === applied.folder?.value)) {
          options.push([applied.folder.value, applied.folder.label]);
        }
        folder.length = 1;
        addOptions(folder, options);
        folder.value = selected;
      }).catch(reason => {
        if (panel !== form) return;
        message.textContent = String(reason);
        message.hidden = false;
      });
      const days = field('days', h('input', 'field'));
      days.type = 'number';
      days.min = '1';
      days.max = '3650';
      days.placeholder = 'Any date, or enter a number of days';
      days.value = applied.days?.value ?? '';
    }
    body.append(message);
    const foot = h('div', 'nb-scope-panel-foot');
    foot.append(h('button', 'btn', 'Apply'));
    form.append(head, body, foot);
    form.onsubmit = event => {
      event.preventDefault();
      const pending: Choices = {};
      for (const [key, input] of fields) {
        const value = input.value.trim();
        if (!value) continue;
        const label = input instanceof HTMLSelectElement ? input.selectedOptions[0].text
          : key === 'days' ? `Last ${value} ${value === '1' ? 'day' : 'days'}` : value;
        pending[key] = { value, label };
      }
      submission = pending;
      void load();
    };
    form.onkeydown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    root.append(form);
    toggle.setAttribute('aria-expanded', 'true');
    fields.values().next().value?.focus({ preventScroll: true });
  }

  return {
    root,
    get words() { return words; },
    search(value: string) {
      words = value;
      ++run;
      clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 220);
    },
    refresh: () => void load(),
  };
}
