# The website

**State:** accepted (the person, 2026-11-19), round 1 · **Sheets:** none yet; the page text below is the draft to review, and once
it is accepted the built site is shown in the browser before anything goes live.

The public website, built from `site/`: what Bible Workbench is, the download, the release notes and help. It is the
first step of the roadmap after marks (ship, the website, the download on it, Mac with a guide, then development).
Today's `site/` text was written for a paid, licensed private pilot that never happened; this round replaces it.

## Decisions (the person, 2026-11-19)

- **S-1 Hosting.** A new public repository `bradyg7/bradyg7.github.io` holds only the built site, so the address is
  `https://bradyg7.github.io/` with no sub-path. The code repository stays private; a workflow here builds `site/` and
  pushes `site/dist` there. Rejected: Pages on `wordbench-releases` (a sub-path breaks every link), GitHub Pro (paid).
- **S-9 Help contact.** Testers reach the person who sent them the link; nothing public (no email, no issues page).
- **S-10 The name is Wordbench** (the person, 2026-11-19), on the site and in the app. The site says Wordbench from W1.
  The app is renamed in a later release (window title, installer and Start menu names), designed on its own; the
  updater's link and the releases repository keep their names, so installed copies still update.
- **S-2 Text first.** Nothing goes live until the text below is accepted. Rejected: publishing today's text (it claims
  licenses, pricing and a pilot that are not true).

## Accepted with round 1 (the person, 2026-11-19)

- **S-3 What the site says.** Free. Windows today, Mac coming. Updates arrive inside the app. The KJV only. Your study
  is files in a folder you choose. The app shows the text, its words and your own work, never conclusions.
- **S-4 Pages.** Overview, Download, Releases, Help, Privacy. The License page is removed (nothing is licensed or sold).
- **S-5 The download.** The site reads the newest release when it is built: the workflow fetches `latest.json` from
  `wordbench-releases`, so the Download page shows the version, date and size, and its button is the stable link
  `https://github.com/bradyg7/wordbench-releases/releases/latest/download/Bible-Workbench-setup.exe`. Every release
  rebuilds the site (release.yml starts the site workflow when it has published), so the page never lags.
- **S-6 Releases page.** Built from `docs/releases/*.md`, newest first, the same notes the updater shows.
- **S-7 Windows' warning.** The installer is not code-signed yet, so Windows SmartScreen says "Windows protected your
  PC". The Download page says so plainly and shows the two clicks (More info, Run anyway), with a picture.
- **S-8 Screenshots.** The five in `site/assets/` are older than marks; new ones are taken from the scratch copy (never
  the real study folder) after 0.2.0, showing marks, the margin and the Legend.

## Open questions

None.

## The page text (draft)

**Overview**
- Headline: **Wordbench**, then *Study the text for yourself.*
- Lead: Read the King James Bible, look closely at its words, and keep your own work beside it.
- Button: **Download for Windows** · line under it: Free. Mac coming soon.
- Three points:
  1. **Read and look closely.** Search, the Strong's concordance, the interlinear and word lookups, one click from the text.
  2. **Mark the text as you would on paper.** Highlights, underlines, circles, arrows and margin notes, with your own
     legend for what each means.
  3. **Your work stays yours.** Pages, folders and marks are plain files in a folder you choose. Nothing is uploaded.
- Closing: *The sources in view. The conclusions are yours.* The app shows the text, its words and what you write. It
  never supplies interpretation.

**Download**
- Headline: *Get Wordbench.*
- The release box: Version 0.2.0 · Windows 10 or 11, 64-bit · 40 MB · 19 November 2026 · **Download for Windows**.
- Installing: run the file. Windows may say "Windows protected your PC": choose **More info**, then **Run anyway**.
  This appears because the app is new and not yet signed. (Picture.)
- Updates: the app checks when it opens and offers each new version. Your study folder is never touched by an update.
- Mac: coming soon, with its own guide.

**Releases**: each version's notes, newest first.

**Help**: back up your study folder (where it is, how to copy it); what to include when reporting a problem (the
version, Windows version, what you were doing; never your study files); to reach someone, ask the person who sent you the link (S-9).

**Privacy**: The app sends nothing about your study anywhere. It asks GitHub for the newest version when it opens, which
sends what any web request sends (your address), and nothing else. This website has no accounts, analytics or cookies;
it is hosted by GitHub Pages, which keeps ordinary request logs.

## Interaction table

| # | Where | Action | What the person sees | What changes | Command | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | any page | open `https://bradyg7.github.io/` | the Overview, light or dark from the system | none | none | site.spec: overview | [ ] |
| 2 | any page | the top links | Overview, Download, Releases, Help; the current one marked | none | none | site.spec: nav | [ ] |
| 3 | Overview, Download | **Download for Windows** | the browser downloads `Bible-Workbench-setup.exe` from `wordbench-releases` | none | none | site.spec: link is the stable URL | [ ] |
| 4 | Download | the release box | version, minimum Windows, size and date of the newest release | none | none | site.spec: from a fixture `latest.json` | [ ] |
| 5 | Download | no release found at build | "Not available right now", no button | none | none | site.spec: empty fixture | [ ] |
| 6 | Releases | open | every `docs/releases/*.md`, newest first | none | none | site.spec: three versions in order | [ ] |
| 7 | Help, Privacy, footer | open | the text above | none | none | site.spec: pages exist, no License page | [ ] |
| 8 | GitHub | push to main touching `site/` or `docs/releases/`; or a release published | the site rebuilds and is live in about a minute | `bradyg7.github.io` gets the new build | `gh workflow run site` | a run on the first deploy | [ ] |

## Tickets

- **W1** Text and pages (rows 1, 2, 7), the release box from a build-time `release.json` (rows 3–5), Releases from
  `docs/releases` (row 6); `distribution/release.mjs` takes the new shape. Screenshots replaced (S-8).
- **W2** The deploy (row 8): `.github/workflows/site.yml`, the new public repository, a token that can push to it
  (the person makes it; never in the repo), and release.yml starting it.

## Out of scope / later

- The Mac download and its guide (roadmap step 4): the Download page gains it then.
- Renaming the app to Wordbench (S-10): its own small design, then a release.
- Code-signing the Windows installer (removes S-7's warning; costs money).
