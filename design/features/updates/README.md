# Updates

**State:** exploring · **Sheets:** `python design/features/updates/updates.py` writes `updates.figcraft` and
`updates.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet. What other tools
get wrong, and so what this folder avoids: [bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: unfinished** (2026-11-16, first pass, by [ready-criteria](../ready-criteria.md)): check 3 and check 8 wait
on round 1's sheets (nothing is drawn yet). Never "accepted", which is the person's word.

How the installed app (`%LOCALAPPDATA%\bible-workbench-rs\app`) learns that a newer Bible Workbench is ready, shows
what changed, and takes it, in the app, instead of a rebuild and `scripts/install-app.ps1` by hand. Asked for by the
person on 2026-11-13 ("documentation that lays out what an update popup looks like on the app") and again on
2026-11-16 (the installed app should update itself in the app). Today nothing in the window speaks of updates:
`codex/installer-port` (`248c45a`) has an optional Tauri updater in the shell only, which shows a system dialog ten
seconds after the reader opens, and its signed update path is unverified ([spec](../../../docs/SPEC.md), line 11).

## Leading design (2026-11-16)

Round 1 draws one direction (U-1 to U-19 below); nothing is superseded on the board. The system dialog of `248c45a`
was never drawn here and is replaced by U-1.

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The notice that an update is ready | U1 (the dot on the Settings gear), U2 (the Updates section) | the system dialog of `248c45a` (by U-1: it sat over the reader) |
| What changed (the notes) | U3 | |
| Installing and restarting | U4 (downloading), U5 (ready to restart), U6 (after the restart) | |
| Checking by hand, and the setting | U7; U10 (a copy built from source) | |
| Failure and refusal | U8 (no connection, a download that stopped), U9 (signature refused; a page that could not be saved) | |
| The real conditions | U11 (among other tabs), U12 (a floating tab), U13 (narrow), U14 (years: many versions behind, a study of years) | |

## What the person said, and what was already fixed

- The installed app updates itself in the app; no reinstall by hand (the person, 2026-11-16).
- Checking is optional and never needed to keep studying: the pilot is permanent offline use after activation
  ([spec](../../../docs/SPEC.md), line 69).
- The notice never covers the reader or takes its place. The old app keeps working if an update fails or is refused.
  Unsaved writing is never lost on a restart. Nothing in the study folder changes. Every window action has a `wb`
  command.
- From `AGENTS.md`: scripture verbatim from the database, no interpretation, never lose the reader's place.

## Decisions

Each is **decided by overseer from existing decisions (inference), 2026-11-16**. None is the person's own word yet;
the person sees them on the sheets when the folder is offered for acceptance.

| # | Decision | Rests on |
|---|---|---|
| U-1 | **The notice is a dot on the rail's Settings gear, and nothing else outside Settings.** Resting on the gear says "Bible Workbench 0.3.0 is ready". Inside the Settings menu, one line at its top says the same and opens the Updates section. No toast, no dialog, no window on start, nothing in the reader, the top bar or the trail line. The system dialog of `248c45a` is not built. Wherever the gear is folded away (a narrow window's More), the dot rides on what holds it. | the constraint (never covers the reader); research theme 6: pop-ups mid-reading and notices crowding the reading screen ([research](../../research/bible-software-complaints.md), lines 60-62); Settings is "apart from the study tool" ([settings](../settings/README.md), line 67); the gear on the rail ([command](../command/README.md), lines 97-98) |
| U-2 | **Updates is one section of the Settings menu, owned by this folder**, as Keys is Help's section of the same menu. Settings' own tabs stay as accepted. | [overlaps](../overlaps.md), the Keys row; [settings](../settings/README.md), line 68 (every feature already in Settings stays) |
| U-3 | **The app looks by itself, quietly, and that is a setting.** "Look for updates": *When the app opens* (the default) or *Only when I ask*. By itself it looks once, ten seconds after the reader has drawn, and not again within 24 hours. A look that fails (no network, the site down) shows nothing and changes nothing. `WB_NO_UPDATE_CHECK=1` turns looking off whatever the setting says. | the person wants the app to update itself; optional per the spec's offline policy; "a design choice is not a setting" ([index](../README.md), lines 59-63): this one a person offline would really want different; `248c45a` (ten seconds after the reader, `WB_NO_UPDATE_CHECK`) |
| U-4 | **A look asks one address for one small file and sends nothing about the person.** No account, no licence, no computer id, nothing from the study folder. The section says so in one line. | permanent offline use; research themes 1 and 4 (accounts, lock-in: [research](../../research/bible-software-complaints.md), line 121) |
| U-5 | **Nothing is downloaded or installed until the person says Install.** There is no "install by itself" setting and no update the app requires. | research: a past update took away what a person used, and frequent redesigns ([research](../../research/bible-software-complaints.md), lines 51, 72, 115); the old app keeps working |
| U-6 | **What changed is read from the release, in four fixed headings in this order: Moved or removed, New, Changed, Fixed**, then one line, *Your study folder*. Moved or removed is always shown first; when empty it reads "Nothing was moved or removed." The text is plain text written for the release; the window shows it as text only (no links followed, no pictures fetched). Every release newer than the installed one is listed, newest first; older ones are folded to their version and date, with their Moved or removed lines still showing. The notes speak only of the app. | research (the same lines as U-5): what moved is what people most need to hear; no interpretation (`AGENTS.md`) |
| U-7 | **Install is two steps, and the person keeps reading through the first.** *Install* downloads in the background: Settings can be closed, the gear's dot becomes a ring that fills, *Stop* gives it up. When the file is whole and its signature checked, the section offers **Restart now** and **When I close the app**. Doing neither is the same as When I close the app. | studying never waits on an update; the open question (now / next start / later) folded to two buttons |
| U-8 | **Before a restart the app saves as it does when a page is closed, and does not restart if a save fails.** Every open page's writing is written by the ordinary save; if one cannot be saved the app stays open, names the page, and the update waits. A line being typed in the command box and a finding being written are kept in the window's storage and are there after the restart. The app reopens as it was: the reader at the same book, chapter and verse, the same panes, tabs and tab in front, floating tabs where they were. Settings is not reopened, and the restart is not a step on the trail. | "never lose the reader's place" (`AGENTS.md`); the constraint (unsaved writing); research theme 8 ([research](../../research/bible-software-complaints.md), lines 78-79); today's `flushPageWriters` (`ui/src/pagewriters.ts:7`) and the kept place (`ui/src/main.ts:43`) |
| U-9 | **After an update nothing opens over the reader.** The dot is gone. The Updates section reads "You have 0.3.0, updated today from 0.2.4", with what changed in it, readable offline (the installed version's notes come with the app). | U-1 |
| U-10 | **"Not this version" puts the dot away until a newer release.** The version stays listed in the section with Install. | the constraint (refused); U-5 |
| U-11 | **Every failure is said in the Updates section, in plain words, with what still works.** A look by hand with no network: "Could not reach the update site. Bible Workbench works as it is." A download that stopped: the same, with Try again. An install that did not finish: the old version opens, and the section says it was not changed. The gear's dot shows for a failure only when the person had asked for the install; a look made by itself never reports a failure. | the constraint; U-3 |
| U-12 | **An update whose signature does not match is thrown away, and there is no "install anyway".** The section says: "This update was not installed: it was not signed by Bible Workbench. Nothing was changed." The app also refuses a file that is not newer than what is installed, and an address that is not HTTPS. | the spec's "interrupted or rejected update" ([spec](../../../docs/SPEC.md), line 73) |
| U-13 | **The version before is kept, once, and the person can go back to it.** After an update the section offers "Go back to 0.2.4" (the program files kept beside the app, not downloaded again). It is not offered when the newer version's notes say the study folder's form was moved forward. | research: a removed function has no remedy but the old version ([research](../../research/bible-software-complaints.md), line 72); the old app keeps working |
| U-14 | **A copy built from source does not update itself.** A build made by `scripts/install-app.ps1` has no update code switched on; its section reads "This copy was built from source (40a91dc). It does not update itself." and offers nothing else. | `248c45a`: the updater is a Cargo feature, off by default, started only when the build has the key and the address |
| U-15 | **What the app remembers about updates is kept beside the app, not in the study folder**: the setting, when it last looked, a version set aside, a downloaded file, the version before (`%LOCALAPPDATA%\bible-workbench-rs\updates\`). An update writes program files only. If a release ever needs the study folder's form moved, that is its own design with its own go-ahead (`AGENTS.md`); the updater never does it, and the notes' *Your study folder* line says it before Install. | "nothing in the study folder changes"; `AGENTS.md` (the study folder's formats) |
| U-16 | **The commands** are `wb update status`, `check`, `notes`, `install`, `stop`, `skip`, `back`, and `wb settings updates` (below). They work with the window closed. | `AGENTS.md`: every core action is reachable from `wb` |
| U-17 | **Where updates come from, as a requirement:** one public HTTPS address holding the release file and the installer, GitHub Releases of a public repository that holds releases only; each update signed with one key pair made for updates, whose private half the person holds and which is never in the repository; the public half is compiled into the app and cannot be changed while it runs. The updater offers the same installer the release page offers. | `248c45a`'s notes (a private repository's files need a token); [spec](../../../docs/SPEC.md), lines 72-73 (sign the update artifacts; the release page and the updater offer the same approved artifact) |
| U-18 | **An update never asks for activation again**, and an activated copy may take every update. | permanent offline use after activation; no renewal or expiry policy was added ([spec](../../../docs/SPEC.md), line 69). Update entitlement is still listed for the person to confirm in the pilot (spec, line 71) |
| U-19 | **The phone is out of this folder.** A phone's updates come from its store. Narrow here means a narrow window on the desktop and the Settings menu at phone width. | [coverage](../coverage.md) (the phone is deferred) |

One recommendation, where there was a real choice (U-3, the default): **look when the app opens**. Reasons: the person
asked for an app that updates itself, and an app that never looks does not; a look costs one small request and never
holds up the reader; it is one switch to turn off. The main risk: a study tool sold as offline makes a network request
nobody asked for. U-4 (it sends nothing) and the line in the section are the answer to it; if the person would rather
the default be *Only when I ask*, only the default changes.

## Open questions

- ~~Where the notice sits.~~ The gear's dot and the Updates section (U-1, U-2); struck 2026-11-16.
- ~~Does the app look by itself, and how often?~~ Yes, once on opening, at most daily, and it is a setting (U-3); struck 2026-11-16.
- ~~What the notes say and where they come from.~~ The release's own text under four headings (U-6); struck 2026-11-16.
- ~~Install now, on the next start, later; unsaved writing.~~ U-7, U-8; struck 2026-11-16.
- ~~What the person sees when an update fails or is refused.~~ U-10 to U-12; struck 2026-11-16.
- ~~The `wb` command.~~ U-16; struck 2026-11-16.

None is left that the existing decisions can answer. What needs the person is not a design question; it is under
"Needs the person" below.

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | 2026-11-16 | U1-U14 | the one direction of U-1 to U-19, and the real conditions | not reviewed by the person; the overseer's check is in Readiness |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |

Scripture is fetched from the database, never typed. Version numbers (0.2.4, 0.3.0), dates, sizes, the lines of the
notes and the names of pages are a drawn sample; no such release exists.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | to draw, U11 (the reader, a pane with four tabs; the dot's ring while a download runs; nothing else moves) |
| As a floating tab | to draw, U12 (a tab floated over the reader, before and after the restart, in the same spot) |
| Narrow | to draw, U13 (the Settings menu's Updates section at phone width; the dot in a narrow window) |
| Years of study | to draw, U14 (fourteen releases behind, folded; a study of years reopened as it was) |

## Commands

| Command | What it does | The window's part |
|---|---|---|
| `wb update status` | Prints the installed version, whether this copy updates itself, the setting, when it last looked, a newer version it knows of, a download waiting for a restart, the last failure. Reads only; no network. | the dot, the section's first lines |
| `wb update check` | Looks now. Prints the newer version, its size and date, or "Bible Workbench 0.2.4 is the newest", or the failure in U-11's words. Exit 0 for either answer, 1 when it could not look. | Check now |
| `wb update notes [version]` | Prints what changed under the four headings and the study-folder line: for every release newer than the installed one, or for one version (the installed one works offline). | What changed |
| `wb update install [--when-closed]` | Downloads, checks the signature, and installs. With the window open it asks the window (through the relay, as `wb do`) to save and restart; with `--when-closed` it waits for the window to be closed. With no window open it installs at once. | Install, Restart now, When I close the app |
| `wb update stop` | Gives up a download, or a restart that is waiting; the downloaded file is removed. | Stop |
| `wb update skip [version]` | Sets the newer version aside (U-10). `wb update skip --clear` undoes it. | Not this version |
| `wb update back` | Puts back the version before (U-13); refuses, saying why, when there is none or the study folder's form was moved. | Go back to 0.2.4 |
| `wb settings updates [open\|ask]` | Prints or sets "Look for updates" (U-3). | the setting |

## What the build must satisfy

The folder is not accepted. Each line names what is done and what must be seen. Tests use a release served from this
computer (`WB_UPDATE_FEED` names its address) and signed with a test key, a scratch study (`WB_STUDY_DIR`), and a
scratch app folder; never the real release address, the person's study folder or the person's installed app.

- [ ] **Studying never waits (U-3).** With the network off, the app opens and the reader shows Numbers 25 within the
  usual start budget (`npm run measure`); no update text appears anywhere and `wb update status` prints the last look's
  time unchanged. With the test release present, the first look starts no sooner than ten seconds after the reader has
  drawn, and a second start within 24 hours makes no request.
- [ ] **The notice (U1, U-1).** When a look finds 0.3.0 and 0.2.4 is installed, the only change in the window is the dot
  on the Settings gear: the reader's scroll position, the selection, the tab in front and every pane are the same
  before and after, and no dialog, toast or new tab exists. Resting on the gear shows "Bible Workbench 0.3.0 is ready".
- [ ] **The section (U2, U7, U-2).** Settings has a section Updates holding: the installed version; when it last looked;
  the setting with its two choices; Check now; the line of U-4; and, when a newer version is known, its version, date
  and size, What changed, Install and Not this version. Opening Settings on any other section while an update is ready
  shows the one line at the top that opens Updates.
- [ ] **The setting (U-3).** Set to *Only when I ask*, ten starts make no request; Check now and `wb update check`
  still look. `WB_NO_UPDATE_CHECK=1` makes no request by itself under either choice. `wb settings updates` prints and
  sets the same value the section shows.
- [ ] **A look sends nothing (U-4).** The test release's server records one GET for the release file, with no query,
  no cookie and no header that names the computer, the licence or the study folder.
- [ ] **What changed (U3, U-6).** For a release whose notes hold all four headings, the window shows them in the order
  Moved or removed, New, Changed, Fixed, then Your study folder, with the release's words unchanged. For a release with
  no Moved or removed lines it shows "Nothing was moved or removed." Notes holding a link or markup are shown as their
  plain text and nothing is fetched. `wb update notes` prints the same lines.
- [ ] **Nothing by itself (U-5).** After a look finds 0.3.0, with the app left open an hour and closed and opened
  again, no installer has been downloaded and the installed version is still 0.2.4.
- [ ] **Installing (U4, U5, U-7).** Install starts the download and returns at once: with Settings closed, a page can
  be opened, written in and saved while the gear shows the ring. Stop removes the partial file and the dot returns.
  When the download is whole and its signature good, the section shows Restart now and When I close the app. Choosing
  When I close the app and closing the window installs 0.3.0; the next opening is 0.3.0.
- [ ] **Unsaved writing (U5, U-8).** With "Phinehas" open and a sentence typed in it less than a second before Restart
  now, the page's file in the scratch study holds the sentence after the restart. With that page's file made
  unwritable, Restart now does not restart: the section says "Phinehas could not be saved, so Bible Workbench was not
  restarted", the sentence is still in the editor, and 0.2.4 is still running. A line typed in the command box and a
  finding half written are there, unchanged, after the restart.
- [ ] **Return case, the reader's place is kept (U6, U12, U-8).** With the reader at Numbers 25, verse 11 at the top of
  the view, a pane with four tabs with the third in front, and one tab floated at a spot, Restart now reopens 0.3.0
  with the reader at Numbers 25 and verse 11 at the top, the same four tabs with the third in front, the floated tab at
  the same spot and size, Settings closed, and `wb history list` printing the same steps as before (the restart adds
  none). The verses shown equal `wb text "Num 25:10-13"`.
- [ ] **After (U6, U-9).** After that restart the gear has no dot, nothing is over the reader, the section reads "You
  have 0.3.0, updated today from 0.2.4", and with the network off `wb update notes 0.3.0` still prints its notes.
- [ ] **Not this version (U-10).** After it, the dot is gone across restarts and looks; the section still lists 0.3.0
  with Install; a look that finds 0.3.1 brings the dot back.
- [ ] **No connection, a stopped download (U8, U-11).** With the network off, Check now and `wb update check` say
  "Could not reach the update site. Bible Workbench works as it is." (exit 1), and the reader, the Notebook and every
  `wb` reading command work. A download cut off halfway shows the same with Try again; 0.2.4 is unchanged.
- [ ] **Refused (U9, U-12).** An installer whose signature was made with another key, one changed by a byte after
  signing, a release file naming 0.2.3 or 0.2.4, and a release address that is not HTTPS: each is not installed, the
  downloaded file is removed, the section says it in U-12's words, there is no button that installs it anyway, and
  0.2.4 runs as before.
- [ ] **An install that does not finish (U-11).** With the installer stopped partway, opening the app opens 0.2.4 with
  the reader at its place; the gear shows the dot and the section says the update was not installed and nothing was
  changed.
- [ ] **Going back (U6, U-13).** After updating to 0.3.0, Go back to 0.2.4 and `wb update back` restart into 0.2.4
  without the network, with the reader's place and tabs as in the return case. With a release whose notes say the
  study folder's form was moved, neither is offered and `wb update back` says why.
- [ ] **Built from source (U10, U-14).** A build made without the update code shows only "This copy was built from
  source (<commit>). It does not update itself."; `wb update status` says the same and `wb update check` makes no
  request.
- [ ] **The study folder and the database (U-15).** Across check, install, restart and going back, a hash of every
  file in the scratch study differs only by the sentence the person typed (the unsaved-writing case), `wb study check`
  reports what it reported before, and the Bible database is opened read-only as before; a database that came with the
  update replaces the one beside the program only by the installer, never while the app has it open.
- [ ] **Activation (U-18).** An activated distribution copy updated to 0.3.0 with the network off afterwards opens
  without asking for activation.
- [ ] **Commands (U-16).** Each row of the Commands table does what it says with the window closed; with the window
  open, `wb update install` restarts the window as Restart now does, with the same saving.
- [ ] **The real conditions (U11-U14).** Checked in the app on a generated study of years (hundreds of pages, many
  threads, 28 layouts), never the person's folder: among other tabs, the dot and the ring are the only change and no
  tab moves (U11); with a floated tab, the Settings menu opens over it and closing the menu leaves it where it was
  (U12); in a window 390 wide the Updates section's rows stack, every button and the notes' headings are shown whole,
  and the dot shows on whatever holds Settings (U13); fourteen releases behind, the newest release is open, the
  thirteen older are folded with their Moved or removed lines showing, and the list scrolls inside the section (U14);
  and the restart on the study of years takes no longer than an ordinary start of that study, with no file of the study
  read or copied by the installer.
- [ ] **No interpretation.** No text of this feature recommends reading, a passage or a meaning; notes are shown as the
  release wrote them and speak of the app only.

### Build requirements (not the window)

- The update code is the Cargo feature `updater`, apart from `distribution` (`248c45a`), and is reached from one place
  that both the window and `wb` call, so `wb update …` works with the window closed.
- A release is made by one command on the person's computer (`npm run release:publish`, beside
  `scripts/release/prepare.mjs` and `check.mjs`): it builds the installer, signs it with the update key read from a
  file outside the repository (as `license-secrets/` is kept out by `.gitignore`), writes the release file (version,
  date, size, signature, the notes under the four headings, the study-folder line, and the earlier releases' notes),
  and uploads both. A workflow that does this on a tag is allowed later and is not required.
- The notes for a release are a file in the repository, `docs/releases/<version>.md`, with the four headings.
  `scripts/release/check.mjs` already refuses a release whose Cargo, Tauri and site versions differ (`check.mjs:52-56`);
  it also refuses one with no notes file, a missing Moved or removed heading, or no study-folder line.
- The installed copy stays in `%LOCALAPPDATA%\bible-workbench-rs\app`, or `scripts/install-app.ps1` and the installer
  agent move with it in the same change. The window's storage (the kept place, the dock) is not cleared by the
  installer.
- The spec's clean-machine checks (fresh install, upgrade, interrupted or rejected update, uninstall:
  [spec](../../../docs/SPEC.md), line 73) are run with the real signed path before the feature is switched on for a
  release; until then the signed path stays "unverified" in the spec.

### Needs the person

Not design questions: each needs a secret, an account or money, so no agent can do it.

1. **The update signing key.** Made once on the person's computer (`npx tauri signer generate`), its private half and
   password kept by the person outside the repository and backed up. If it is lost, installed copies can never be
   updated by the app again; if it leaks, anyone can sign an update.
2. **Where releases are public.** U-17 recommends GitHub Releases of a public repository holding releases only. Making
   the installer public also makes the bundled Bible database and dictionary public, which waits on the redistribution
   evidence the spec lists (line 72).
3. **Moving the person's own copy onto the updating build, once.** The copy in `%LOCALAPPDATA%\bible-workbench-rs\app`
   is built from source today (U-14). One last install by hand, of the first signed release, after the usual hashed
   backup, starts it updating itself.

A Windows code-signing certificate (so Windows does not warn about the installer) costs money each year and is not
needed for the app to update itself; it is the person's choice for the pilot, not part of this folder.

## Out of scope / later

- The phone and tablet (their stores update them).
- A test channel (early releases for the person only): one address and one channel until someone needs two.
- Moving the study folder's form with a release: its own folder, design and go-ahead each time (`AGENTS.md`).

## Overlaps

[settings](../settings/README.md) (the menu the Updates section sits in), [command](../command/README.md) and
[minimize](../minimize/README.md) (the gear on the rail that carries the dot). [overlaps.md](../overlaps.md) has the rows.
