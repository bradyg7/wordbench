import { demos, features } from './demo-data';

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const categories = [...new Set([...demos, ...features].map(item => item.category))];
export const demoLibrary = `<section id="demo" class="demo-section" aria-labelledby="demo-title">
  <div class="demo-heading"><div><span class="eyebrow">THE DEMO LIBRARY</span><h2 id="demo-title">See the workbench.<br> One feature at a time.</h2></div><p>Follow a guided walkthrough, look at the screenshots, or browse the feature guide. Each recording uses the real development interface and a disposable sample workspace.</p></div>
  <div class="library-tools"><label class="library-search" for="feature-search"><span>Find a feature</span><input id="feature-search" type="search" placeholder="Try pages, highlights, or reading…" autocomplete="off"></label><div class="library-filters" role="group" aria-label="Filter by category"><button type="button" aria-pressed="true" data-category="">All features</button>${categories.map(category => `<button type="button" aria-pressed="false" data-category="${esc(category)}">${esc(category)}</button>`).join('')}</div></div>
  <p id="library-count" class="library-count" role="status" aria-live="polite"></p>
  <div class="library-layout"><div class="demo-playlist" role="group" aria-label="Feature walkthroughs"></div><article class="demo-player" aria-labelledby="selected-demo-title"></article></div>
  <p class="media-note">Guided recordings show visible pointer movement, clicks, and typing. They are demonstrations of the development app, not customer recordings or an interactive app in your browser. No personal notes are shown.</p>
  <div class="feature-guide-heading"><div><span class="eyebrow">EXPLORE THE DETAILS</span><h3>Feature guide</h3></div><p>Expand a feature for its actions and limits. A documented feature does not necessarily have a recording yet.</p></div>
  <div class="feature-guide"></div><p class="library-empty" hidden>No features match that search. Try another word or choose All features.</p>
</section>`;

export function mountDemoLibrary() {
  const section = document.querySelector<HTMLElement>('#demo');
  if (!section) return;
  const search = section.querySelector<HTMLInputElement>('#feature-search')!;
  const playlist = section.querySelector<HTMLElement>('.demo-playlist')!;
  const player = section.querySelector<HTMLElement>('.demo-player')!;
  const guide = section.querySelector<HTMLElement>('.feature-guide')!;
  const count = section.querySelector<HTMLElement>('#library-count')!;
  const empty = section.querySelector<HTMLElement>('.library-empty')!;
  let category = '';
  let selected = '';
  const pauseVideo = () => player.querySelector<HTMLVideoElement>('video')?.pause();
  const selectDemo = (id: string, navigation: 'none' | 'push' | 'replace' = 'none') => {
    const demo = demos.find(item => item.id === id);
    if (!demo) return;
    if (navigation !== 'none' && location.hash !== `#demo-${id}`) history[navigation === 'push' ? 'pushState' : 'replaceState'](null, '', `#demo-${id}`);
    if (selected === id && player.querySelector('video')) return;
    pauseVideo();
    selected = id;
    player.innerHTML = `<div class="player-heading"><span class="eyebrow">${esc(demo.category)}</span><h3 id="selected-demo-title" tabindex="-1">${esc(demo.title)}</h3><p>${esc(demo.description)}</p></div><div class="video-frame"><video controls playsinline preload="none" poster="/demo/${esc(demo.id)}.png" aria-label="${esc(demo.title)} walkthrough" aria-describedby="selected-demo-description"><source src="/demo/${esc(demo.id)}.webm" type="video/webm"><a href="/demo/${esc(demo.id)}.webm">Open the recording</a></video></div><div class="player-links"><a class="player-screenshot" href="/demo/${esc(demo.id)}.png" target="_blank" rel="noopener" aria-label="Open full-size screenshot: ${esc(demo.title)}"><img src="/demo/${esc(demo.id)}.png" width="1280" height="800" alt="" loading="lazy"><span>View screenshot<span class="screenshot-title">${esc(demo.title)} &nearr;</span></span></a><a href="#demo-${esc(demo.id)}" class="demo-permalink">Link to this demo</a></div><details class="demo-transcript" open><summary>Walkthrough steps</summary><ol id="selected-demo-description">${demo.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol></details>`;
    for (const button of playlist.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.demo === id));
  };
  const render = () => {
    const term = search.value.trim().toLocaleLowerCase();
    const matches = (item: { title: string; category: string; description: string }) => (!category || item.category === category) && `${item.title} ${item.category} ${item.description}`.toLocaleLowerCase().includes(term);
    const visibleDemos = demos.filter(matches);
    const visibleFeatures = features.filter(item => matches({ ...item, description: `${item.description} ${item.details.join(' ')}` }));
    count.textContent = `${visibleDemos.length} walkthrough${visibleDemos.length === 1 ? '' : 's'} · ${visibleFeatures.length} feature${visibleFeatures.length === 1 ? '' : 's'}`;
    playlist.innerHTML = visibleDemos.map((demo, i) => `<button type="button" class="demo-card" data-demo="${esc(demo.id)}" aria-label="Watch ${esc(demo.title)}" aria-pressed="${selected === demo.id}"><span class="demo-thumb"><img src="/demo/${esc(demo.id)}.png" alt="" width="1280" height="800" loading="lazy"><span class="play-icon" aria-hidden="true">▶</span></span><span class="demo-card-copy"><span class="demo-card-category">${esc(demo.category)}${demo.duration ? ` · ${esc(demo.duration)}` : ''}</span><strong>${esc(demo.title)}</strong><span class="demo-card-index">${String(i + 1).padStart(2, '0')} / WALKTHROUGH</span></span></button>`).join('');
    if (!visibleDemos.length) playlist.innerHTML = '<p class="no-walkthroughs">No walkthroughs in this view. Browse the feature guide below, or change your search.</p>';
    guide.innerHTML = visibleFeatures.map(feature => `<details class="feature-entry" id="feature-${esc(feature.id)}"><summary><span><span class="demo-card-category">${esc(feature.category)}</span><strong>${esc(feature.title)}</strong></span><span class="feature-status">${feature.demoId ? 'Walkthrough available' : esc(feature.status || 'Documented feature')}<span aria-hidden="true"> +</span></span></summary><div class="feature-entry-body"><p>${esc(feature.description)}</p><ul>${feature.details.map(detail => `<li>${esc(detail)}</li>`).join('')}</ul>${feature.demoId ? `<button type="button" class="feature-watch" data-demo="${esc(feature.demoId)}">Watch this feature →</button>` : ''}</div></details>`).join('');
    empty.hidden = visibleDemos.length > 0 || visibleFeatures.length > 0;
    // A hidden recording must stop. Preserve its time when it becomes visible again.
    if (!visibleDemos.length) pauseVideo();
    player.hidden = !visibleDemos.length;
    if (visibleDemos.length && !visibleDemos.some(demo => demo.id === selected)) selectDemo(visibleDemos[0].id, location.hash.startsWith('#demo-') ? 'replace' : 'none');
  };
  section.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!target) return;
    if (target.dataset.category !== undefined) {
      category = target.dataset.category;
      for (const button of section.querySelectorAll<HTMLButtonElement>('[data-category]')) button.setAttribute('aria-pressed', String(button === target));
      render();
    } else if (target.dataset.demo) {
      player.hidden = false;
      selectDemo(target.dataset.demo, 'push');
      player.querySelector<HTMLElement>('h3')!.focus({ preventScroll: true });
      player.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  });
  search.addEventListener('input', render);
  const restoreHash = () => {
    const id = location.hash.replace(/^#demo-/, '');
    if (!demos.some(demo => demo.id === id)) return;
    category = ''; search.value = '';
    for (const button of section.querySelectorAll<HTMLButtonElement>('[data-category]')) button.setAttribute('aria-pressed', String(button.dataset.category === ''));
    selectDemo(id); render();
    section.scrollIntoView();
  };
  if (demos.some(demo => `#demo-${demo.id}` === location.hash)) restoreHash();
  else render();
  window.addEventListener('hashchange', restoreHash);
}
