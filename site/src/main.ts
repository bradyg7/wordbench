import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-500.css';
import './style.css';
import { parseRelease, STABLE_DOWNLOAD, STABLE_MAC_DOWNLOAD } from '../../distribution/release.mjs';
import { markdownToHtml, compareVersions } from './markdown';

const notes = import.meta.glob('../../docs/releases/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// the site may live under a sub-path (GitHub Pages of wordbench-releases: /wordbench-releases/)
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const at = (url: string) => BASE + url;
const page = location.pathname.slice(location.pathname.startsWith(BASE) ? BASE.length : 0).replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
const links = [['/', 'Overview'], ['/download/', 'Download'], ['/releases/', 'Releases'], ['/support/', 'Help']];
const titles: Record<string, string> = { '/': 'Wordbench', '/download': 'Get Wordbench.', '/releases': 'Releases', '/support': 'Help', '/privacy': 'Privacy' };
const title = titles[page] ?? 'Page not found.';
document.title = page === '/' ? 'Wordbench — Study the text for yourself.' : `${title.replace(/\.$/, '')} — Wordbench`;

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
  <a class="skip" href="#main">Skip to content</a>
  <header class="wrap masthead"><a class="brand" href="${at('/')}">Wordbench</a>
    <nav aria-label="Main navigation">${links.map(([url, label]) => `<a href="${at(url)}" ${page === (url.replace(/\/$/, '') || '/') ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  </header>
  <main id="main" class="wrap"><h1>${title}</h1><div id="content"></div></main>
  <footer class="wrap"><p>Wordbench<span>Read, look closely, and keep your own work.</span></p><nav aria-label="Footer"><a href="${at('/privacy/')}">Privacy</a><a href="${at('/support/')}">Help</a></nav></footer>`;

const content = document.querySelector<HTMLElement>('#content')!;
// M-6: removed once someone with a real Mac has checked rows 3 and 6 of design/features/mac
const MAC_UNTRIED = 'Not yet tried on a real Mac.';
const MAC_COMING = 'The Mac version is coming with the next release.';
const downloadButton = `<a class="button" href="${STABLE_DOWNLOAD}">Download for Windows</a>`;

function releasesHtml(): string {
  const versions = Object.entries(notes)
    .map(([path, text]) => ({ version: /([^/]+)\.md$/.exec(path)![1], text }))
    .sort((a, b) => compareVersions(b.version, a.version));
  return `<p class="lead">Each version's notes, newest first.</p><section class="release-notes-page">${versions.map(({ version, text }, i) =>
    `<details id="v${version}"${i === 0 ? ' open' : ''}><summary><h2>${version}</h2></summary>${markdownToHtml(text)}</details>`).join('')}</section>`;
}

const pages: Record<string, string> = {
  '/': `<section class="intro"><p class="lead"><em>Study the text for yourself.</em></p><p class="measure">Read the King James Bible, look closely at its words, and keep your own work beside it.</p><div class="actions">${downloadButton}</div><p class="quiet">Free, for Windows and Mac.</p><p class="mac-link"><a id="mac-link" href="${STABLE_MAC_DOWNLOAD}" hidden>Download for Mac</a></p></section>
    <section class="features" aria-label="What Wordbench does"><div class="feature-list"><article><span class="number">01</span><div><h3>Read and look closely.</h3><p>Search, the Strong's concordance, the interlinear and word lookups, one click from the text.</p></div></article><article><span class="number">02</span><div><h3>Mark the text as you would on paper.</h3><p>Highlights, underlines, circles, arrows and margin notes, with your own legend for what each means.</p></div></article><article><span class="number">03</span><div><h3>Your work stays yours.</h3><p>Pages, folders and marks are plain files in a folder you choose. Nothing is uploaded.</p></div></article></div></section>
    <section class="ownership"><h2><em>The sources in view.<br>The conclusions are yours.</em></h2><p>The app shows the text, its words and what you write. It never supplies interpretation.</p></section>`,
  '/download': `<div id="release" class="release-box" aria-live="polite"><p>Checking the newest version…</p></div>
    <section class="prose"><h2>Installing</h2><p>Run the file. Windows may say “Windows protected your PC”: choose <strong>More info</strong>, then <strong>Run anyway</strong>. This appears because the app is new and not yet signed.</p>
    <div class="warning-art" role="img" aria-label="Example of the Windows warning: the More info link, then the Run anyway button"><div class="bar">Windows protected your PC</div><div class="body">Microsoft Defender SmartScreen prevented an unrecognized app from starting. <span class="more hot">More info</span></div><div class="row"><span class="hot">Run anyway</span><span>Don't run</span></div></div><p class="release-note">An example of the warning, drawn here.</p>
    <h2>Updates</h2><p>The app checks when it opens and offers each new version. Your study folder is never touched by an update.</p>
    <h2>Mac</h2><div id="mac"><p>${MAC_COMING}</p></div></section>`,
  '/releases': releasesHtml(),
  '/privacy': `<section class="prose"><p>The app sends nothing about your study anywhere. It asks GitHub for the newest version when it opens, which sends what any web request sends (your address), and nothing else.</p><p>This website has no accounts, analytics or cookies; it is hosted by GitHub Pages, which keeps ordinary request logs.</p></section>`,
  '/support': `<section class="prose"><h2>Back up your study folder</h2><p>Your study is a folder you chose when you set the app up. Copy that whole folder to another disk or a cloud drive now and then, and before you install an update. The installer and updates never touch it.</p><h2>When you report a problem</h2><p>Say which version of Wordbench you have, which version of Windows, and what you were doing. Never send your study files.</p><h2>To reach someone</h2><p>Ask the person who sent you the link.</p></section>`,
};
content.innerHTML = pages[page] ?? `<p>This page does not exist. <a href="${at('/')}">Return to the overview.</a></p>`;

const macGuide = `<p class="release-note">macOS 11 or newer · Apple silicon and Intel</p><p class="mac-untried"><strong>${MAC_UNTRIED}</strong></p>
  <ol class="mac-guide">
    <li><p>Open the <code>.dmg</code>, drag Wordbench into Applications.</p></li>
    <li><p>Open Wordbench. macOS says it could not verify it: choose <strong>Done</strong> (not Move to Bin).</p>
      <div class="warning-art mac-art" role="img" aria-label="Example of the Mac alert: Apple could not verify Wordbench is free of malware, with the Done button"><div class="body"><strong>“Wordbench” Not Opened</strong><br>Apple could not verify “Wordbench” is free of malware that may harm your Mac or compromise your privacy.</div><div class="row"><span>Move to Bin</span><span class="hot">Done</span></div></div><p class="release-note">An example, drawn here.</p></li>
    <li><p>Open <strong>System Settings → Privacy &amp; Security</strong>, scroll down, choose <strong>Open Anyway</strong> beside the Wordbench line, confirm with your password or Touch ID. (On macOS 15 and later, right-click → Open no longer skips this.)</p>
      <div class="warning-art mac-art" role="img" aria-label="Example of Privacy and Security: Wordbench was blocked to protect your Mac, with the Open Anyway button"><div class="bar">Privacy &amp; Security</div><div class="body">“Wordbench” was blocked to protect your Mac.</div><div class="row"><span class="hot">Open Anyway</span></div></div><p class="release-note">An example, drawn here.</p></li>
    <li><p>It opens from then on like any app. Updates arrive inside the app and need none of this.</p></li>
  </ol>`;

const size = (bytes: number) => `${Math.round(bytes / 1048576)} MB`;
const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function loadRelease() {
  const box = document.querySelector<HTMLElement>('#release');
  const macBox = document.querySelector<HTMLElement>('#mac');
  const macLink = document.querySelector<HTMLAnchorElement>('#mac-link');
  if (!box && !macLink) return;
  const unavailable = () => { if (box) box.innerHTML = '<h2>Not available right now</h2><p>Please try again later.</p>'; };
  try {
    const response = await fetch(at('/release.json'), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Release information unavailable.');
    const release = parseRelease(await response.json());
    if (release.status === 'unavailable') return unavailable();
    if (release.mac) {
      if (macLink) macLink.hidden = false;
      if (macBox) {
        const macDownload = document.createElement('a');
        macDownload.className = 'button'; macDownload.href = STABLE_MAC_DOWNLOAD; macDownload.textContent = 'Download for Mac';
        macBox.replaceChildren(macDownload);
        macBox.insertAdjacentHTML('beforeend', macGuide);
        if (release.macBytes) macBox.querySelector('.release-note')!.textContent += ` · ${size(release.macBytes)}`;
      }
    }
    if (!box) return;
    const heading = document.createElement('h2');
    heading.textContent = `Version ${release.version}`;
    const detail = document.createElement('p');
    detail.textContent = [`Windows ${release.minimumWindows} or 11, 64-bit`, release.bytes ? size(release.bytes) : "", dateText(release.publishedAt)].filter(Boolean).join(" · ");
    const download = document.createElement('a');
    download.className = 'button'; download.href = release.downloadUrl; download.textContent = 'Download for Windows';
    box.replaceChildren(heading, detail, download);
  } catch {
    unavailable();
  }
}
void loadRelease();
