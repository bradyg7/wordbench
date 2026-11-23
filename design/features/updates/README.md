# Updates

> **Read [the principles](../principles/README.md) first** (2026-11-22): it says which of this folder's decisions stand under the new frame (desks, bubbles, the dock) and lists any that conflict, for the person to settle.

**State:** accepted (the person, 2026-11-18, after reviewing every window in FigCraft; U-1 to U-19 are now the person's) · **Release host (the person, 2026-11-18):** a public releases-only repository beside the private code repository, which also carries the website on GitHub Pages; a workflow on a tag builds and signs the release on GitHub's machines (the build requirement's "allowed later" workflow is now the main path) · **Sheets:** `python design/features/updates/updates.py` writes `updates.figcraft` and
`updates.pdf` (the board, one vector page) (it uses [kit.py](../kit.py)) · Nothing here is built yet. What other tools
get wrong, and so what this folder avoids: [bible-software-complaints](../../research/bible-software-complaints.md).

**Readiness: likely finished** (2026-11-16, second pass, by [ready-criteria](../ready-criteria.md); never "accepted", which is the person's word). The overseer checked all ten on its own evidence: `updates.py` read, all 24 windows rendered and looked at, the fetched verses compared with `wb text`, and a reviewer agent's nine findings closed and looked at again. One thing to know before the list: **no decision here is the person's own yet.** U-1 to U-19 are the overseer's inferences from the constraints the person gave, so the person's first look at the sheets is also their first review.

- **1, direction.** One direction, no alternative drawn, nothing superseded on the board (Leading design, line 29; `updates.py:594`). The windows U11 to U14 only draw it in the real conditions.
- **2, open questions.** All six are struck with the decision that answers each (line 86). What is left is not a design question (Needs the person, line 235).
- **3, the real conditions.** All four are "drawn" (line 113): U11 (four tabs, the third in front, the ring on the gear: `updates.py:430`), U12 (the menu over part of a floated tab; the tab at the same spot after: `:443`), U13 (390 wide, and 820 wide: `:481`, `:502`), U14 (fourteen releases behind; 612 pages, 41 threads, 28 layouts: `:533`, `:572`).
- **4, the build list** (line 135): every line names what is done and what must be seen (a served test release, a test key, a scratch study and app folder). The return case is line 172.
- **5, commands** (line 122): `wb update status|check|notes|install|stop|skip|back` and `wb settings updates`, each named as required with what it prints and its exit. None exists today: `wb update status`, run 2026-11-16 on this branch, answers "Unknown command". `wb settings <part>` exists (`crates/wb-cli/src/notebook.rs:176`).
- **6, overlaps.** Two rows, both "agrees": the Updates section of the Settings menu ([overlaps](../overlaps.md):59) and the dot on the gear (:60). [coverage](../coverage.md) gives the area and the `update` commands to this folder alone (:36, :64).
- **7, no contradiction.** `AGENTS.md`: nothing writes the study folder (U-15, line 74), the database stays read-only, the place is kept (U-8), every action has a command. Accepted folders: [settings](../settings/README.md) keeps every tab it has (its line 68 says what is in Settings stays; this adds a section, as help's Keys did); the rail and its gear are drawn as minimize's `rail5` draws them. The addition is recorded in overlaps as the overseer's inference; **the person agrees it by accepting this folder**, where it is drawn (U2, U13).
- **8, sheets match the README.** Seen on the rendered windows: the dot is the only sign in U1, and the tooltip covers no verse; no dot in U6 and after the restart in U12; the headings run Moved or removed, New, Changed, Fixed, then Your study folder in U3 and U14; the card shows the study-folder line above Install in U2 and U13; U8's no-connection state has Check now and no Try again, and its stopped download has Try again; U9's refused state has no button that installs; U10 has no button and no setting; every panel has at most one filled button; nothing is cut at 390 wide. Scripture: only Numbers 25:10-13, through `K.fetch` (`updates.py:19`); `data/num25-10-13.json` equals `wb text "Num 25:10-13"` character for character (run 2026-11-16). Versions, dates, sizes, the notes' lines and page names are a drawn sample and are said to be (line 110).
- **9, no interpretation.** The notes and every caption speak of the app only (the reviewer read each window; the build list's last line, 213, keeps it so).
- **10, formats.** No study-folder format changes. What the app remembers about updates is kept beside the app (U-15); a release that needs the study folder's form moved is its own design and go-ahead, and the updater never does it.

**For the person, to decide acceptance, in this order** (open `updates.pdf`, or `updates.figcraft` in FigCraft): **U1** (the notice: one dot), **U2** (the Updates section), **U3** (what changed), **U4** (downloading while you read), **U5** (ready to restart), **U6** (after); then U7 and U10 (checking by hand, the setting, a copy built from source), U8 and U9 (failure and refusal); then the real conditions U11, U12, U13, U14. The three choices most worth a second look, each one line to change: the default of "Look for updates" (U-3: when the app opens), nothing installing by itself (U-5), and going back one version (U-13).

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
| U-1 | **The notice is a dot on the rail's Settings gear, and nothing else outside Settings.** Resting on the gear says "Bible Workbench 0.3.0 is ready". Inside the Settings menu, one line at its top says the same and opens the Updates section. No toast, no dialog, no window on start, nothing in the reader, the top bar or the trail line. The system dialog of `248c45a` is not built. The rail keeps the gear at every desktop width (a narrow window folds only the place button and the reader's tools: [command](../command/README.md), C17), so the dot is always on the gear. It sits on the gear's corner; the rail's own small dot under the Trail icon is another thing and the build keeps the two apart. | the constraint (never covers the reader); research theme 6: pop-ups mid-reading and notices crowding the reading screen ([research](../../research/bible-software-complaints.md), lines 60-62); Settings is "apart from the study tool" ([settings](../settings/README.md), line 67); the gear on the rail ([command](../command/README.md), lines 97-98) |
| U-2 | **Updates is one section of the Settings menu, owned by this folder**, as Keys is Help's section of the same menu. Settings' own tabs stay as accepted. | [overlaps](../overlaps.md), the Keys row; [settings](../settings/README.md), line 68 (every feature already in Settings stays) |
| U-3 | **The app looks by itself, quietly, and that is a setting.** "Look for updates": *When the app opens* (the default) or *Only when I ask*. By itself it looks once, ten seconds after the reader has drawn, and not again within 24 hours. A look that fails (no network, the site down) shows nothing and changes nothing. `WB_NO_UPDATE_CHECK=1` turns looking off whatever the setting says. | the person wants the app to update itself; optional per the spec's offline policy; "a design choice is not a setting" ([index](../README.md), lines 59-63): this one a person offline would really want different; `248c45a` (ten seconds after the reader, `WB_NO_UPDATE_CHECK`) |
| U-4 | **A look asks one address for one small file and sends nothing about the person.** No account, no licence, no computer id, nothing from the study folder. The section says so in one line. | permanent offline use; research themes 1 and 4 (accounts, lock-in: [research](../../research/bible-software-complaints.md), line 121) |
| U-5 | **Nothing is downloaded or installed until the person says Install.** There is no "install by itself" setting and no update the app requires. | research: a past update took away what a person used, and frequent redesigns ([research](../../research/bible-software-complaints.md), lines 51, 72, 115); the old app keeps working |
| U-6 | **What changed is read from the release, in four fixed headings in this order: Moved or removed, New, Changed, Fixed**, then one line, *Your study folder*. Moved or removed is always shown first; when empty it reads "Nothing was moved or removed." The text is plain text written for the release; the window shows it as text only (no links followed, no pictures fetched). Every release newer than the installed one is listed, newest first; older ones are folded to their version and date, and one that moved or removed something still shows that line while folded (one that moved nothing shows only its version and date). The section's card for the newest release shows its version, date and size, its first Moved or removed line (or "Nothing was moved or removed.") and its *Your study folder* line, above Install. The notes speak only of the app. | research (the same lines as U-5): what moved is what people most need to hear; no interpretation (`AGENTS.md`) |
| U-7 | **Install is two steps, and the person keeps reading through the first.** *Install* downloads in the background: Settings can be closed (the section says "You can close Settings and keep reading."), the gear's dot becomes a ring that fills, *Stop* gives it up. When the file is whole and its signature checked, the section offers **Restart now** and **When I close the app**. Doing neither is the same as When I close the app. | studying never waits on an update; the open question (now / next start / later) folded to two buttons |
| U-8 | **Before a restart the app saves as it does when a page is closed, and does not restart if a save fails.** Every open page's writing is written by the ordinary save; if one cannot be saved the app stays open, names the page ("Phinehas could not be saved, so Bible Workbench was not restarted"), and the update waits ("0.3.0 is still waiting.", with the same two buttons). A line being typed in the command box and a finding being written are kept in the window's storage and are there after the restart. The app reopens as it was: the reader at the same book, chapter and verse, the same panes, tabs and tab in front, floating tabs where they were. Settings is not reopened, and the restart is not a step on the trail. | "never lose the reader's place" (`AGENTS.md`); the constraint (unsaved writing); research theme 8 ([research](../../research/bible-software-complaints.md), lines 78-79); today's `flushPageWriters` (`ui/src/pagewriters.ts:7`) and the kept place (`ui/src/main.ts:43`) |
| U-9 | **After an update nothing opens over the reader.** The dot is gone. The Updates section reads "You have 0.3.0, updated today from 0.2.4", with what changed in it, readable offline (the installed version's notes come with the app). | U-1 |
| U-10 | **"Not this version" puts the dot away until a newer release.** The version stays listed in the section with Install. | the constraint (refused); U-5 |
| U-11 | **Every failure is said in the Updates section, in plain words, with what still works.** A look by hand with no network: "Could not reach the update site. Bible Workbench works as it is." It is looked for again with Check now. A download that stopped: "The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench 0.2.4 works as it is.", with Try again. An install that did not finish: the old version opens, and the section says it was not changed. The setting, Check now and U-4's line stay in the section through every failure. The gear's dot shows for a failure only when the person had asked for the install, and goes once the section has been opened (a version still ready keeps its dot); a look made by itself never reports a failure. | the constraint; U-3 |
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
| 1 | 2026-11-16 | U1-U14 (24 windows: a and b where a part has two states) | the one direction of U-1 to U-19, and the real conditions | not reviewed by the person. Checked by the reviewer agent and the overseer on the rendered windows, 2026-11-16: nine findings, all closed the same day (U8's wording and buttons, U12's menu over the floated tab, U13's caption, U2's line, the study-folder line on the card, U14's scrolling and its signs of years, the place named in U5) |

## Data the sheets show

| File | Made by |
|---|---|
| `data/num25-10-13.json` | `wb text "Num 25:10-13"` |

Scripture is fetched from the database, never typed. Version numbers (0.2.4, 0.3.0), dates, sizes, the lines of the
notes and the names of pages are a drawn sample; no such release exists.

## The real conditions

| Condition | Window |
|---|---|
| Among other tabs | drawn, U11 (the reader, a pane with four tabs; the dot's ring while a download runs; nothing else moves) |
| As a floating tab | drawn, U12 (a tab floated over the reader with the Settings menu open over part of it, and after the restart in the same spot) |
| Narrow | drawn, U13 (the Settings menu's Updates section at phone width, its sections folded to a menu as [settings](../settings/README.md) C1′; the dot on the gear in a window 820 wide) |
| Years of study | drawn, U14 (fourteen releases behind, folded, the section scrolling; a study of 612 pages, 41 threads and 28 layouts reopened as it was) |

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

## Interaction table

Added 2026-11-19 (the person asked that updates move into the window and the system dialog go). It is cut from U-1 to
U-19 and the build list below; nothing in it is new. Today the installed release runs only slice 1: `check_for_update`
in `app/src-tauri/src/main.rs` shows the system dialog. **Ticket UP1 removes that dialog.** Tests use `WB_UPDATE_FEED`
(a release served from this computer and signed with a test key), a scratch study and a scratch app folder.

### The notice

| # | Where (window tag) | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 1 | U1 | The app opens; ten seconds after the reader has drawn it looks by itself (setting *When the app opens*, not looked in 24 h) | Nothing while it looks. If 0.3.0 is newer: a dot on the rail's Settings gear, and nothing else. No dialog, toast or tab | `updates\state.json` beside the app: last look, newest version known | `wb update status` | Rust: no system dialog is created (the `dialog().message` call is gone); WebKit: after a feed with 0.3.0, the gear has the dot, scroll, selection and tabs unchanged | [x] |
| 2 | U1 | A look fails (no network, site down) by itself | Nothing | last look time not changed | `wb update status` | Rust: a dead feed leaves state unchanged and emits nothing to the window | [x] |
| 3 | U1 | Rest on the gear with the dot | Tooltip "Bible Workbench 0.3.0 is ready" | none | | WebKit: tooltip text | [x] |
| 4 | U2 | Open Settings on any other section while an update is ready | One line at the top: "Bible Workbench 0.3.0 is ready"; clicking it opens Updates | none | | WebKit | [x] |

### The Updates section

| # | Where (window tag) | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 5 | U2 | Open Settings → Updates | Installed version; when it last looked; "Look for updates" with its two choices; Check now; U-4's line; when newer is known, the card (version, date, size, first Moved or removed line, Your study folder line, What changed, Install, Not this version). One filled button | none | `wb update status` | WebKit: every part present, at 390 wide stacked and whole (U13) | [x] |
| 6 | U7 | Check now | "Looking…", then the card, or "Bible Workbench 0.2.4 is the newest" | last look | `wb update check` (exit 0) | Rust + WebKit with the test feed | [x] |
| 7 | U8 | Check now with no network | "Could not reach the update site. Bible Workbench works as it is." Check now stays; no Try again | none | `wb update check` (exit 1) | Rust: exit code and words | [x] |
| 8 | U7 | Change "Look for updates" to *Only when I ask* (or back) | The choice shown | the setting in `updates\` beside the app | `wb settings updates ask\|open` | Rust: ten starts with *ask* make no request; `WB_NO_UPDATE_CHECK=1` makes none under either | [x] |
| 9 | U3 | What changed | Every newer release, newest first, under Moved or removed, New, Changed, Fixed, then Your study folder; older folded to version and date (one that moved something keeps that line); plain text only | none | `wb update notes [version]` | Rust: heading order, "Nothing was moved or removed.", markup shown as text; WebKit: fourteen behind folds (U14) | [x] |
| 10 | U2 | Not this version | Dot goes; version still listed with Install; a newer one brings the dot back | the set-aside version | `wb update skip [version]`, `--clear` | Rust | [x] |

### Installing and restarting

| # | Where (window tag) | Action | What the person sees | What changes on disk | `wb` command | Test | Built |
|---|---|---|---|---|---|---|---|
| 11 | U4 | Install | Download starts; "You can close Settings and keep reading."; the gear's dot becomes a ring that fills; a page can be opened and saved meanwhile | the downloaded file in `updates\` | `wb update install` | WebKit: ring; Rust: download returns at once | [~] ring (WebKit) and returns-at-once (Rust) pass; writing in a page during the download is proved only by the call returning at once, not driven in the real window |
| 12 | U4 | Stop | Download given up; dot returns | partial file removed | `wb update stop` | Rust | [x] |
| 13 | U8 | A download that stops partway | "The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench 0.2.4 works as it is." with Try again; the gear's dot shows until Updates is opened | partial file removed | `wb update install` again | Rust: cut-off feed | [x] |
| 14 | U9 | The signature does not match, the version is not newer, or the address is not HTTPS | "This update was not installed: it was not signed by Bible Workbench. Nothing was changed." No button that installs | file removed | `wb update install` (refuses) | Rust: other key, changed byte, 0.2.3/0.2.4, http address | [x] |
| 15 | U5 | The file is whole and checked | Restart now (filled) and When I close the app | file kept | | WebKit | [x] |
| 16 | U5 | Restart now | Every open page saved by the ordinary save; the app restarts into 0.3.0 at the same verse, panes, tabs, tab in front and floating tabs; Settings closed; no trail step | program files only | `wb update install` with the window open (through the relay) | Return case below; `wb history list` unchanged | [~] the window's side is proved (WebKit: the kept window comes back after a reload, once, Settings closed; Rust: the relay line reaches the window and prints its answer; saves first). On a Mac the signed .app.tar.gz is unpacked beside the app and swapped in (unit-tested on any OS; not run on a Mac). Not run: a real installer restart of the Tauri app, the reader at verse 10, and `wb history list` after it |
| 17 | U5 | Restart now when a page cannot be saved | "Phinehas could not be saved, so Bible Workbench was not restarted"; "0.3.0 is still waiting." with the same two buttons; the writing still in the editor | none | | Rust + WebKit: unwritable page file | [~] WebKit proves the words, the buttons and the writing kept, with a page writer that fails; no test makes a real page file unwritable |
| 18 | U5 | When I close the app (or neither button) | Nothing more; closing the window installs; the next opening is 0.3.0 | program files on close | `wb update install --when-closed` | Rust | [x] |
| 19 | U6 | After the restart | No dot, nothing over the reader; the section reads "You have 0.3.0, updated today from 0.2.4" with its notes, offline too | the version before kept once in `updates\` | `wb update notes 0.3.0` offline | WebKit + Rust | [x] |
| 20 | U6 | Go back to 0.2.4 | Restarts into 0.2.4, place kept; not offered when the notes say the study folder's form moved | program files | `wb update back` (refuses saying why) | Rust | [~] kept once, restored without the network, refusal with none kept, the window asked through the relay, and the notes-moved rule (unit) are proved; on a Mac the whole old .app is kept and swapped back (unit-tested, not run on a Mac); the restart into the old version in the real app is not |
| 21 | U10 | A copy built from source opens Updates | Only "This copy was built from source (<commit>). It does not update itself." | none | `wb update status`; `wb update check` makes no request | Rust: built without `updater` | [x] |

## Directions

- 2026-11-19, for the person to confirm: build UP1 and UP2 first, in one release, so no user sees the system dialog
  again. Until UP4, Install on the card runs today's download and installer and then restarts (after saving, U-8).
  The one new choice here is that interim Install; everything else is U-1 to U-19 as accepted.

## Tickets

| Ticket | Rows | First proof |
|---|---|---|
| UP1 | 1–3 | The system dialog is gone. A look found by itself puts the dot on the gear; nothing else in the window changes. |
| UP2 | 4–8 | The Updates section in Settings, Check now, the setting, and `wb update status\|check`, `wb settings updates`. |
| UP3 | 9–10 | What changed under the four headings, and Not this version. |
| UP4 | 11–15 | Install in the background, Stop, the ring, failures and refusals. |
| UP5 | 16–19 | Restart now with saving and the place kept; When I close the app; After. |
| UP6 | 20–21 | Go back, and the built-from-source copy. |

UP1 alone already takes the system message away from users; UP2 has to ship in the same release, or the dot leads
nowhere. So **UP1 and UP2 ship together**; until UP4 is built, the card's Install opens the same download and
installer the dialog uses today, then restarts (U-8's save first).

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
  the setting with its two choices; Check now; the line of U-4; and, when a newer version is known, a card with its version, date
  and size, its first Moved or removed line, its Your study folder line, What changed, Install and Not this version. Opening Settings on any other section while an update is ready
  shows the one line at the top, "Bible Workbench 0.3.0 is ready", that opens Updates.
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
- [ ] **Return case, the reader's place is kept (U6, U12, U-8).** With the reader at Numbers 25, verse 10 at the top of
  the view, a pane with four tabs with the third in front, and one tab floated at a spot, Restart now reopens 0.3.0
  with the reader at Numbers 25 and verse 10 at the top, the same four tabs with the third in front, the floated tab at
  the same spot and size, Settings closed, and `wb history list` printing the same steps as before (the restart adds
  none). The verses shown equal `wb text "Num 25:10-13"`.
- [ ] **After (U6, U-9).** After that restart the gear has no dot, nothing is over the reader, the section reads "You
  have 0.3.0, updated today from 0.2.4", and with the network off `wb update notes 0.3.0` still prints its notes.
- [ ] **Not this version (U-10).** After it, the dot is gone across restarts and looks; the section still lists 0.3.0
  with Install; a look that finds 0.3.1 brings the dot back.
- [ ] **No connection, a stopped download (U8, U-11).** With the network off, Check now and `wb update check` say
  "Could not reach the update site. Bible Workbench works as it is." (exit 1), and the reader, the Notebook and every
  `wb` reading command work. A download cut off at 31 of 84 MB shows "The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench 0.2.4 works as it is." with Try again; 0.2.4 is unchanged.
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
  and in a window 820 wide the rail still holds the gear with its dot (U13); fourteen releases behind, the newest release is open, the
  thirteen older are folded, those that moved or removed something showing that line, and the list scrolls inside the section (U14);
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
