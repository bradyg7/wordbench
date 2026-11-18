import { demos, features } from './demo-data';

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const categories = [...new Set([...demos, ...features].map(item => item.category))];
const categoryId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const featured = ['reading-navigation', 'word-study', 'pages'].map(id => demos.find(demo => demo.id === id)).filter(demo => !!demo);
export const demoTeaser = `<section class="demo-teaser" aria-labelledby="demo-teaser-title"><div class="teaser-heading"><div><span class="eyebrow">TAKE A CLOSER LOOK</span><h2 id="demo-teaser-title">See it in use.</h2></div><p>Explore the workspace through guided recordings and a feature-by-feature guide.</p><a class="button" href="/demos/">Browse the demo library &rarr;</a></div><div class="teaser-grid">${featured.map(demo => `<a class="teaser-card" href="/demos/#demo-${esc(demo.id)}"><span class="teaser-image"><img src="/demo/${esc(demo.id)}.png" width="1280" height="800" alt="" loading="lazy"><span class="play-icon" aria-hidden="true">▶</span></span><span class="demo-card-category">${esc(demo.category)}</span><strong>${esc(demo.title)}</strong></a>`).join('')}</div></section>`;
export const demoLibrary = `<section id="demo" class="demo-section demo-library-page" aria-label="Demo and feature library">
  <div class="library-intro"><p class="lead">A closer look at the tools.<br> A clear path to what you need.</p><p>Browse guided recordings by category, or open the feature guide for each tool’s actions and limits. These previews use the real development interface and a disposable sample workspace.</p></div>
  <div class="library-tabs" role="group" aria-label="Library view"><button type="button" aria-pressed="true" data-view="recordings">Watch the walkthroughs <span>${demos.length}</span></button><button type="button" aria-pressed="false" data-view="features">Read the feature guide <span>${features.length}</span></button></div>
  <div class="library-tools"><label class="library-search" for="feature-search"><span>Find a feature</span><input id="feature-search" type="search" placeholder="Try pages, highlights, or reading…" autocomplete="off"></label><div class="library-filters" role="group" aria-label="Filter by category"><button type="button" aria-pressed="true" data-category="">All categories</button>${categories.map(category => `<button type="button" aria-pressed="false" data-category="${esc(category)}">${esc(category)}</button>`).join('')}</div></div>
  <p id="library-count" class="library-count" role="status" aria-live="polite"></p>
  <div class="demo-gallery" aria-label="Walkthroughs by category"></div><div class="feature-guide" aria-label="Feature guide by category" hidden></div><p class="library-empty" hidden>No results in this view. Try another search, category, or library view.</p>
  <p class="media-note">Guided recordings show visible pointer movement, clicks, and typing. They are demonstrations of the development app, not customer recordings or an interactive app in your browser. No personal notes are shown. A documented feature does not necessarily have a recording yet.</p>
  <dialog class="demo-dialog" aria-labelledby="selected-demo-title"><div class="demo-dialog-bar"><span>INSIDE BIBLE WORKBENCH</span><button type="button" class="demo-close" aria-label="Close walkthrough">Close <span aria-hidden="true">×</span></button></div><article class="demo-player"></article></dialog>
</section>`;

export function mountDemoLibrary() {
  const section = document.querySelector<HTMLElement>('.demo-library-page');
  if (!section) return;
  const search = section.querySelector<HTMLInputElement>('#feature-search')!;
  const gallery = section.querySelector<HTMLElement>('.demo-gallery')!;
  const player = section.querySelector<HTMLElement>('.demo-player')!;
  const dialog = section.querySelector<HTMLDialogElement>('.demo-dialog')!;
  const guide = section.querySelector<HTMLElement>('.feature-guide')!;
  const count = section.querySelector<HTMLElement>('#library-count')!;
  const empty = section.querySelector<HTMLElement>('.library-empty')!;
  let category = '';
  let view = 'recordings';
  let selected = '';
  let opener: HTMLElement | null = null;
  const pauseVideo = () => player.querySelector<HTMLVideoElement>('video')?.pause();
  const selectDemo = (id: string, push = false) => {
    const demo = demos.find(item => item.id === id);
    if (!demo) return;
    if (push && location.hash !== `#demo-${id}`) history.pushState(null, '', `#demo-${id}`);
    if (selected !== id || !player.querySelector('video')) {
      pauseVideo(); selected = id;
      const index = demos.indexOf(demo);
      player.innerHTML = `<div class="player-heading"><span class="eyebrow">${esc(demo.category)}${demo.duration ? ` · ${esc(demo.duration)}` : ''}</span><h2 id="selected-demo-title" tabindex="-1">${esc(demo.title)}</h2><p>${esc(demo.description)}</p></div><div class="video-frame"><video controls playsinline preload="none" poster="/demo/${esc(demo.id)}.png" aria-label="${esc(demo.title)} walkthrough" aria-describedby="selected-demo-description"><source src="/demo/${esc(demo.id)}.webm" type="video/webm"><a href="/demo/${esc(demo.id)}.webm">Open the recording</a></video></div><div class="player-links"><a class="player-screenshot" href="/demo/${esc(demo.id)}.png" target="_blank" rel="noopener" aria-label="Open full-size screenshot: ${esc(demo.title)}"><img src="/demo/${esc(demo.id)}.png" width="1280" height="800" alt="" loading="lazy"><span>View screenshot<span class="screenshot-title">${esc(demo.title)} &nearr;</span></span></a><a href="#demo-${esc(demo.id)}" class="demo-permalink">Link to this demo</a></div><details class="demo-transcript" open><summary>Walkthrough steps</summary><ol id="selected-demo-description">${demo.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol></details><div class="demo-next"><button type="button" data-demo="${esc(demos[(index - 1 + demos.length) % demos.length].id)}">&larr; Previous walkthrough</button><span>${index + 1} of ${demos.length}</span><button type="button" data-demo="${esc(demos[(index + 1) % demos.length].id)}">Next walkthrough &rarr;</button></div>`;
    }
    for (const button of gallery.querySelectorAll<HTMLButtonElement>('[data-demo]')) button.setAttribute('aria-pressed', String(button.dataset.demo === id));
    if (!dialog.open) { opener = document.activeElement as HTMLElement; dialog.showModal(); document.body.classList.add('demo-modal-open'); }
    player.querySelector<HTMLElement>('h2')!.focus({ preventScroll: true });
  };
  const closeDialog = (updateHash: boolean) => {
    pauseVideo();
    if (dialog.open) dialog.close();
    document.body.classList.remove('demo-modal-open');
    if (updateHash && location.hash.startsWith('#demo-')) history.replaceState(null, '', '#demo');
    opener?.focus({ preventScroll: true });
  };
  const render = () => {
    const term = search.value.trim().toLocaleLowerCase();
    const matches = (item: { title: string; category: string; description: string }) => (!category || item.category === category) && `${item.title} ${item.category} ${item.description}`.toLocaleLowerCase().includes(term);
    const visibleDemos = demos.filter(matches);
    const visibleFeatures = features.filter(item => matches({ ...item, description: `${item.description} ${item.details.join(' ')}` }));
    count.textContent = `${visibleDemos.length} walkthrough${visibleDemos.length === 1 ? '' : 's'} · ${visibleFeatures.length} feature${visibleFeatures.length === 1 ? '' : 's'}`;
    gallery.innerHTML = categories.map(group => {
      const items = visibleDemos.filter(demo => demo.category === group);
      if (!items.length) return '';
      return `<section class="demo-category" aria-labelledby="category-${categoryId(group)}"><div class="category-heading"><h2 id="category-${categoryId(group)}">${esc(group)}</h2><span>${items.length} walkthrough${items.length === 1 ? '' : 's'}</span></div><div class="demo-card-grid">${items.map(demo => `<button type="button" class="demo-card" data-demo="${esc(demo.id)}" aria-label="Watch ${esc(demo.title)}" aria-pressed="${selected === demo.id}"><span class="demo-thumb"><img src="/demo/${esc(demo.id)}.png" alt="" width="1280" height="800" loading="lazy"><span class="play-icon" aria-hidden="true">▶</span>${demo.duration ? `<span class="demo-duration">${esc(demo.duration)}</span>` : ''}</span><span class="demo-card-copy"><strong>${esc(demo.title)}</strong><span class="demo-card-description">${esc(demo.description)}</span><span class="demo-card-index">WATCH WALKTHROUGH &rarr;</span></span></button>`).join('')}</div></section>`;
    }).join('');
    guide.innerHTML = categories.map(group => {
      const items = visibleFeatures.filter(feature => feature.category === group);
      if (!items.length) return '';
      return `<section class="feature-category"><div class="category-heading"><h2>${esc(group)}</h2><span>${items.length} feature${items.length === 1 ? '' : 's'}</span></div><div class="feature-category-grid">${items.map(feature => `<details class="feature-entry" id="feature-${esc(feature.id)}"><summary><strong>${esc(feature.title)}</strong><span class="feature-status">${feature.demoId ? 'Walkthrough available' : esc(feature.status || 'Documented feature')}<span aria-hidden="true"> +</span></span></summary><div class="feature-entry-body"><p>${esc(feature.description)}</p><ul>${feature.details.map(detail => `<li>${esc(detail)}</li>`).join('')}</ul>${feature.demoId ? `<button type="button" class="feature-watch" data-demo="${esc(feature.demoId)}">Watch this feature &rarr;</button>` : ''}</div></details>`).join('')}</div></section>`;
    }).join('');
    gallery.hidden = view !== 'recordings'; guide.hidden = view !== 'features';
    empty.hidden = (view === 'recordings' ? visibleDemos : visibleFeatures).length > 0;
  };
  section.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!target) return;
    if (target.dataset.category !== undefined) {
      category = target.dataset.category;
      for (const button of section.querySelectorAll<HTMLButtonElement>('[data-category]')) button.setAttribute('aria-pressed', String(button === target));
      render();
    } else if (target.dataset.view) {
      view = target.dataset.view;
      for (const button of section.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button === target));
      render();
    } else if (target.dataset.demo) selectDemo(target.dataset.demo, true);
    else if (target.closest('.demo-close')) closeDialog(true);
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(true); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(true); } });
  search.addEventListener('input', render);
  const restoreHash = () => {
    const id = location.hash.replace(/^#demo-/, '');
    if (demos.some(demo => demo.id === id)) selectDemo(id);
    else closeDialog(false);
  };
  render(); restoreHash();
  window.addEventListener('hashchange', restoreHash);
}
