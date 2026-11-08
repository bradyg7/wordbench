# Bible Workbench

**Read the Bible closely, and keep what you find.**

Bible Workbench is a desktop app for your own Bible study. It gives you the King James Version and Young's Literal
Translation, the Hebrew and Greek words behind the English, the lexicons and the interlinear, and a quiet place for your
notes, highlights and threads. Everything you write stays in ordinary files in a folder you choose, so you can read it,
back it up, open it in another editor, or move it to another computer.

It works offline, has no account, no ads and no telemetry, and never changes the Bible text.

Version 0.1.0 · Windows 10 and 11 (64-bit)

## What you get

| File | What it is |
|---|---|
| `Bible Workbench.exe` | The app. |
| `wb.exe` | The same actions from a terminal, for scripts and for AI assistants. |
| `datasets/workbench.db` | The Bible database: KJV, YLT, Strong's, BDB, the interlinear and the search index. Read-only. |
| `README.md` | This file. |
| `THIRD_PARTY_NOTICES.md` | Where the scripture, lexicons, fonts and software come from and under what licenses. |
| `DEPENDENCIES.md` | The generated list of every software package in the build (in the ZIP download). |
| `CHANGELOG.md` | What changed in this version. |
| `licenses/` | The full text of every third-party license. |
| `source/` | The readable source code the app was built from (in the ZIP download). |

Keep the folder together. The app finds the Bible at `datasets\workbench.db` beside the program.

## What you need

- Windows 10 or Windows 11, 64-bit.
- Microsoft Edge WebView2 Runtime. It is already installed on current Windows; if it is missing, Microsoft offers it
  free at <https://developer.microsoft.com/microsoft-edge/webview2/>.
- About 250 MB of free disk space for the installed app and the database, plus the download itself; your notes take
  very little.
- No internet connection, no account and no administrator rights.

## Install and first run

### With the installer

1. Download `Bible-Workbench-setup.exe` from the download link on the Bible Workbench page.
2. Run it. It installs for your Windows account only, so it asks for no administrator password. Windows may show a
   SmartScreen warning because the program is not code-signed; choose **More info → Run anyway**.
3. Open **Bible Workbench** from the Start menu. The Bible is found automatically in `datasets\workbench.db` beside the
   program; if you moved the database, choose **Browse** and pick it.
4. Choose the folder for your notes. The suggested folder is `Documents\Bible Workbench`. Choose an empty folder for a
   new study, or an existing Bible Workbench / `bible-study-data` folder to bring your old notes with you. Bible
   Workbench makes the folders it needs; it does not delete anything that is already there.
5. Choose **Start reading**.

### From the ZIP

1. Unzip the whole folder somewhere you can write, for example `C:\Bible Workbench`, or
   `Documents\Bible Workbench 0.1.0`. Do not run the program from inside the ZIP.
2. Double-click `Bible Workbench.exe`. Windows may show a SmartScreen warning because the program is not code-signed;
   choose **More info → Run anyway**.
3. The Bible is found automatically in `datasets\workbench.db`. If you moved the database, choose **Browse** and pick it.
4. Choose the folder for your notes, as above.
5. Choose **Start reading**.

To remove the installed app, close it and choose **Settings → Apps → Bible Workbench → Uninstall**; from a ZIP, close it
and delete its folder. Your notes are separate (unless you chose a folder inside the app's folder), so removing the app
does not delete your study.

The Bible database is never written to. It is the same file for every copy of the app and can be replaced on its own.

## Updates

The installed app looks for a new version when it opens, and asks before installing it. **Install it** downloads and
installs the new version and opens the app again where you were reading; **Not now** leaves everything as it is, and it
asks again the next time it opens. Updates are signed with the publisher's key, and the app refuses one that is not.

Your notes are not part of the app: an update replaces the program and its copy of the Bible, and never writes to your
folder. Settings are kept too. A copy that came from the ZIP does not update itself; download the newer one when you
want it.

## Reading and study

- **Read.** The KJV and the YLT, chapter by chapter, in light, dark or e-ink colors. The app returns to the last place
  you were reading, with its scroll position.
- **Look at a word.** Click any word for its Strong's number, the original Hebrew or Greek, the transliteration, the
  lexicon entry, its parsing and the English rendering. Open the interlinear for a verse, a range, a chapter or a whole
  book; Hebrew reads right to left with its combining marks.
- **Study a word.** Every use, a count by book, the forms of an English word, words that come near each other, and BDB
  for Hebrew and Aramaic. A rendering can be followed on its own: the verses where this word is translated that way.
- **Write.** Notes on a word, a phrase, a verse or a Strong's number; highlights in layers; threads that collect places
  in the order you choose; questions queued for later. The Notebook gathers your Journal, Inbox, all notes, and a place
  to put an unplaced note.
- **Find.** Search the KJV, including phrases and regular expressions; search your own notes, threads and questions; or
  jump straight to a reference.
- **Keep your place.** Passages open in panes beside the chapter, not instead of it. Closing a pane or following a
  reference always brings you back to the verse you came from.
- **Plan.** Reading plans with today's reading, what you have read, and ways to catch up or spread the rest.
- **Drive it from the keyboard.** A command field takes the same language as `wb.exe`, with a command list and a full
  manual in **Help**.

The reader shows scripture verbatim, with its reference. It adds no commentary, devotionals or doctrine.

## Your files

Your study folder is a normal folder of plain files:

- notes are Markdown, one note per file, under `notes/`;
- highlights are JSON, one file per book, under `highlights/`;
- threads, questions, lessons, sets and reading plans are Markdown or JSON;
- your day's log and reading history are append-only text files under `sessions/` and `reading/`;
- deleted files go to `.trash/`, which is emptied after seven days.

The same folder and the same formats are used by the earlier Python version of Bible Workbench, so the two can open the
same study while you move from one to the other. Nothing is stored in a database you cannot read. To back up, copy the
folder; to move computers, copy it and choose it on the first run. You can keep the folder in git if you like.

## From a terminal

`wb.exe` runs the same actions as the window. Open a terminal in the app's folder and try:

```
wb.exe status
wb.exe reader NUM 25
wb.exe reader NUM 25 --version ylt
wb.exe search "zeal"
wb.exe uses H7065
wb.exe near Phinehas zealous within 30
wb.exe do "go John 3:16"
```

`wb.exe do` sends a line to the running window, so the window and the terminal stay on the same place. `wb.exe help`
lists every command, and `wb.exe help <command>` explains one. `wb.exe setup` shows where the Bible and your notes are;
`wb.exe setup study "<folder>"` and `wb.exe setup database "<file>"` change them, the same choices the first-run screen
makes.

## If something is wrong

- **The window does not open.** Install the WebView2 Runtime (link above), then try again.
- **The Bible is not found.** Keep `datasets\workbench.db` beside `Bible Workbench.exe`, or choose the file on the
  setup screen. `wb.exe setup` names every place the app looked.
- **Your notes are not there.** Check the folder on the setup screen or in `wb.exe setup`; an existing study folder can
  be chosen at any time with `wb.exe setup study`.
- **A note or highlight looks wrong.** Close the app and look at the file in the study folder; it is plain text and can
  be corrected by hand. The app rereads the folder while it runs.

Questions and problems: use the contact link on the product's store page.

## What this release does not do

Bible Workbench 0.1.0 is the desktop release. It does not yet include:

- iPhone, iPad or Android apps;
- syncing between devices (git sync is planned);
- Word, slide or PDF export;
- translations other than the KJV and the YLT;
- an English dictionary or any commentary.

Your lesson and set files are kept as they are; document building is not part of this release.

## Source and license

`source/` contains the Rust crates (`wb-core`, `wb-cli`), the Tauri shell, the TypeScript interface, the tests and the
build scripts. It is the code this build was made from, included so you can read it and check what the program does.

Bible Workbench is copyright © 2026 its author. All rights reserved. The source is included for reading and personal
study; it is not licensed for redistribution, resale or inclusion in another product. The app and its database are sold
as one product. The third-party components keep their own licenses, listed with full texts in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `licenses/`.

Scripture is shown verbatim. The KJV is public domain in the United States; in the United Kingdom the KJV is subject to
the Crown's letters patent. The YLT, Strong's dictionaries and BDB are public domain; the digitized Hebrew lexicon data
and the STEP Bible interlinear are used under CC BY 4.0, with attribution in the notices.
