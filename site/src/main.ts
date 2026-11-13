import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-500.css';
import './style.css';
import { parseRelease } from '../../distribution/release.mjs';

const page = location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
const links = [['/', 'Overview'], ['/download/', 'Download'], ['/releases/', 'Releases'], ['/support/', 'Help']];
const titles: Record<string, string> = { '/': 'A place for your study.', '/download': 'Get Bible Workbench.', '/releases': 'Follow the work.', '/support': 'Help with your workbench.', '/license': 'Your pilot license.', '/privacy': 'Your study stays yours.' };
const title = titles[page] ?? 'Page not found.';
document.title = `${page === '/' ? 'Personal Bible study' : title} — Bible Workbench`;

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
  <a class="skip" href="#main">Skip to content</a>
  <header class="wrap masthead"><a class="brand" href="/">Bible Workbench<span>PERSONAL STUDY, IN YOUR HANDS</span></a>
    <nav aria-label="Main navigation">${links.map(([url, label]) => `<a href="${url}" ${page === (url.replace(/\/$/, '') || '/') ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  </header>
  <main id="main" class="wrap"><div class="eyebrow">BIBLE WORKBENCH · PRIVATE PILOT</div><h1>${title}</h1><div id="content"></div></main>
  <footer class="wrap"><p>Bible Workbench<span>A personal place to read, look closely, and keep your work.</span></p><nav aria-label="Footer"><a href="/license/">Pilot license</a><a href="/privacy/">Privacy</a><a href="/support/">Help</a></nav></footer>`;

const content = document.querySelector<HTMLElement>('#content')!;
const releasePanel = `<section class="release-panel" aria-labelledby="release-heading"><div><div class="eyebrow">WINDOWS · PRIVATE PILOT</div><h2 id="release-heading">Release availability</h2></div><div id="release" aria-live="polite"><p>Checking release availability…</p></div></section>`;
const pages: Record<string, string> = {
  '/': `<section class="intro"><p class="lead">Read the text. Explore its words.<br>Keep your own notes beside it.</p><div class="actions"><a class="button" href="/download/">Check pilot availability <span aria-hidden="true">↗</span></a><a class="text-link" href="#workbench">Explore the workbench ↓</a></div><p class="quiet">A desktop app in development. Public downloads are not yet available.</p></section>
    <section id="workbench" class="features" aria-label="Inside the workbench"><div class="section-heading"><span class="eyebrow">ONE WORKSPACE, YOUR OWN WORK</span><h2>Room to read.<br>Room to return.</h2></div><div class="feature-list"><article><span class="number">01</span><div><h3>Read and look closely</h3><p>The reader brings KJV and YLT text together with search, word lookups, and interlinear views.</p></div></article><article><span class="number">02</span><div><h3>Keep the connections</h3><p>Pages, highlights, and threads give your notes a place beside the passages you are studying.</p></div></article><article><span class="number">03</span><div><h3>Keep your files</h3><p>Your study uses local Markdown and JSON files. Your notes remain your own work, in your own folder.</p></div></article></div></section>
    <section class="ownership"><span class="eyebrow">BUILT FOR PERSONAL STUDY</span><h2>The sources in view.<br>The conclusions are yours.</h2><p>A workspace for source text, lookups, and the notes you write. The app does not supply doctrinal conclusions.</p></section>${releasePanel}`,
  '/download': `<p class="lead">The first release is a private Windows pilot.</p><p class="measure">Pilot licenses will be issued manually. Once activated, a licensed copy can be used permanently offline. Pricing and future update terms have not been set.</p>${releasePanel}<section class="prose"><h2>Before a download is offered</h2><p>The installer must pass packaging, signing, and clean-machine checks. The download listing will show its Windows requirements, version, file size, and checksum.</p><h2>Using another platform?</h2><p>No macOS, Linux, iPhone, iPad, or Android release is available here yet.</p><a href="/license/">Read the pilot license policy →</a></section>`,
  '/releases': `<p class="lead">Version details and release notes, in one place.</p>${releasePanel}<p class="measure">A development version number is not a released installer. Only published pilot builds will appear here.</p>`,
  '/license': `<p class="lead">Manually issued. Permanently offline after activation.</p><section class="prose"><h2>The approved pilot approach</h2><p>The pilot uses manually issued licenses. After activation, a licensed copy will not need recurring online renewal to keep working.</p><h2>What is still being decided</h2><p>Device allowances, transfer arrangements, future update entitlement, and pricing are not yet set. Final application terms will be provided before distribution.</p><h2>Your own work remains yours</h2><p>Study files are separate from the installed app. Licensing must not encrypt or delete your notes, or prevent you from recovering your files.</p><h2>Release status</h2><p>License activation is not available on this preview website. No payments or license keys are collected here.</p></section>`,
  '/privacy': `<p class="lead">Local study files. Clear boundaries.</p><section class="prose"><h2>This website preview</h2><p>This page has no account, payment, analytics, or email sign-up integration. It requests release availability from the same website. Hosting infrastructure may process ordinary request information; the final hosting details and privacy notice will be supplied before launch.</p><h2>The desktop design</h2><p>Notes and highlights live in your study folder. Activation and update services will need limited license and device information; they must not receive your study content.</p><h2>Before the pilot launches</h2><p>The privacy notice will identify the service provider, information retained, retention periods, and a working contact route.</p></section>`,
  '/support': `<p class="lead">Keep your study files safe and within reach.</p><section class="prose"><h2>For pilot participants</h2><p>Use the contact route included with your pilot invitation. Public support and activation recovery are not open yet.</p><h2>Back up your study folder</h2><p>Keep a separate backup of your personal study files before installing an update. Your study folder is separate from the app installer.</p><h2>When reporting a problem</h2><p>Include the app version, Windows version, and what you were doing. Do not include a license key or private study content.</p><a href="/releases/">Check release availability →</a></section>`,
};
content.innerHTML = pages[page] ?? '<p>This page does not exist. <a href="/">Return to the overview.</a></p>';

async function loadRelease() {
  const panel = document.querySelector<HTMLElement>('#release');
  if (!panel) return;
  panel.textContent = 'Checking release availability…';
  try {
    const response = await fetch('/release.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Release information unavailable.');
    const release = parseRelease(await response.json());
    if (release.status === 'unavailable') {
      panel.innerHTML = '<h3>Not available yet</h3><p>The pilot installer is being prepared. No download or purchase is available at this time.</p>';
      return;
    }
    const heading = document.createElement('h3');
    heading.textContent = `Version ${release.version}`;
    const detail = document.createElement('p');
    detail.textContent = `Windows ${release.minimumWindows} · x86_64 · ${(release.bytes / 1048576).toFixed(1)} MB · ${release.publishedAt.slice(0, 10)}`;
    const notes = document.createElement('p');
    notes.className = 'release-notes'; notes.textContent = release.notes;
    const download = document.createElement('a');
    download.className = 'button'; download.href = release.downloadPath; download.textContent = 'Download for Windows';
    const hash = document.createElement('p');
    hash.className = 'checksum'; hash.textContent = `SHA-256: ${release.sha256}`;
    panel.replaceChildren(heading, detail, notes, download, hash);
  } catch {
    panel.innerHTML = '<h3>Could not check availability</h3><p>Please try again. No download is offered until its release details can be verified.</p><button type="button" class="button">Try again</button>';
    panel.querySelector('button')!.addEventListener('click', loadRelease);
  }
}
void loadRelease();
