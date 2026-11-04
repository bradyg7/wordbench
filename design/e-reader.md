# The distraction-free reading device: findings and a recommendation

Status: **parked** (2026-11-02, the person: not the first priority; phone, tablet and desktop come first). Research only;
nothing has been tried on a device, no device is chosen and no layout is designed. When it comes back: the app will be
the Rust rebuild ([../PLAN-mobile.md](../PLAN-mobile.md)), which runs as a native Android app, so the Android route
below becomes "install the Android build and lock it with lock task mode", with no server or browser in between. The
E-ink color mode in the design system stays, as it costs nothing to keep.

## What the device has to do

Boot into the workbench and nothing else: the Bible, the Notebook, threads and word study. No notifications, no other apps, no
store, no browser chrome. Grayscale, slow visible refresh (paging, not scrolling; no animation), no hover, large tap targets,
readable at arm's length, and usable with no network. The design system already has an **E-ink** mode for every color (see
`exports/design-system.png`, "One system, three modes"), so the layout will be the same components in that mode.

Two questions decide everything else:

1. **Can it be locked to one app?** Without that it is a small tablet with distractions one swipe away.
2. **Where does the data live?** The app is a Python server today. The device either reaches the desktop's server on the
   home network (simple, but nothing works away from home), or carries the database and study files and runs the server
   itself (works anywhere, needs a way to sync the study folder, which is already a git repository).

## The routes

### 1. An Android e-ink tablet (Boox and similar): recommended first

- **What it is.** Boox sells grayscale e-ink tablets with full Android and the Google Play Store, from pocket size (Go 7,
  Android 13) to letter size (Go 10.3 Gen II, Android 15, 300 ppi, front light). Reviews and retailer listings agree on
  the Go 10.3 Gen II's Android 15 and Play Store; figures for other models vary between listings, so check the exact
  model. Boox's new Picco does **not** run Android, so it is out.
- **Running the app.** The same web app runs in a browser or as an installed web app; nothing has to be rewritten to try it.
  Boox lets each app have its own refresh mode (EinkWise: HD for reading, Speed for scrolling lists), which suits a reader
  that pages. Whether an installed web app gets its own refresh profile, or shares the browser's, is not documented: test it.
- **Locking it down.** Android has two levels. *App pinning* (a setting) keeps one app in front, but the person can unpin
  it. *Lock task mode* is the real kiosk: Home and Recents do nothing and the app cannot be left. It needs a small
  "device owner" app, set once over USB with `adb shell dpm set-device-owner ...` while no accounts are on the device.
  That means a tiny Android shell (a WebView or a trusted web activity around the workbench page) instead of a browser
  tab. An open-source kiosk launcher (password to exit) is a lighter middle step. Nothing found confirms that Boox's
  firmware allows a device owner, and Boox replaces the stock Android launcher with its own, so the first test on a
  device is: does `dpm set-device-owner` work on it?
- **Data.** Either the desktop's server over Wi-Fi (works on day one), or the same Python server running on the tablet in
  Termux with the study folder kept in step by git. The second keeps one code base and works offline; it is the
  natural end state.
- **Cost of trying.** Low: buy one device, open the scratch server's page in its browser on the home network, and see
  how the reader feels on the panel before writing any device code.

### 2. Kobo: possible, more work

- NickelMenu (a launcher for scripts in Kobo's own menus) and KOReader install without much trouble on firmware 4.x.
  NickelMenu does **not** load on firmware 5.x, and KOReader then needs a separate installer. Kobo's built-in browser is an
  old, hidden, experimental one.
- To run the workbench, it would be a new front end: a KOReader plugin in Lua, or a page in the weak browser. The data
  would have to be on the device (KOReader can read files) or reached over Wi-Fi. No kiosk lock beyond "launch KOReader
  at boot".
- Worth it only if a Kobo is already in hand.

### 3. Kindle: the hardest

- Needs a jailbreak, and which one works depends on the exact model and firmware; sources disagree on the cut-off
  versions, and the newest Scribes have none. Updates must then be blocked by hand, and a firmware update can close the
  door for good. The stock browser is limited.
- A custom app would again be KOReader-based. Not recommended for something meant to be dependable for years.

### 4. reMarkable (Paper Pro and 2): open, but for writing

- Developer mode is official (it wipes the device and shows a warning at every boot) and allows custom software over SSH;
  community launchers (AppLoad) run full-screen apps. There is no browser in the stock system; an Android port has been
  shown but is not public.
- The pen is its real strength, and it brings back the parked "stylus drawing mode" (SPEC section 2). As a reader that
  runs only this app it would mean writing a native front end. A later project, not the first device.

## Recommendation

Start with **an Android e-ink tablet with the Play Store**, a mono panel (the E-ink mode is designed for grays, and a
color panel's filter layer makes the page dimmer; a color model is worth a look only if highlight colors matter more than
contrast). The **Boox Go 10.3 Gen II** if the device is for the desk and lap (a full chapter per
page, room for a side panel); a **7-inch** model if it should fit a coat pocket. Then, in order:

1. Open the workbench from the desktop server in the device's browser on the home network. Judge text, refresh and taps.
2. If it is worth going on: test `dpm set-device-owner` on that device. If it works, a small Android shell app in lock
   task mode; if not, a kiosk launcher with a password.
3. Move the server onto the device (Termux + git sync of `bible-study-data`) so it works away from home.

Only after step 1, design the e-reader layout for that screen, in the E-ink mode of the design system.

**Decision for the person:** which device (and which size) to buy or use. Nothing has been bought or chosen.

## Sources

- [Boox Go 6 (Forbes, 2026)](https://www.forbes.com/sites/ewanspence/2026/09/07/boox-go-6-gen-2-epaper-ebook-reader-eink-notepad-android/),
  [Boox Picco has no Android (9to5Google)](https://9to5google.com/2026/09/08/boox-picco-teased-without-android/),
  [Boox Go 10.3 Gen II hands-on (Notebookcheck)](https://www.notebookcheck.net/Boox-Go-10-3-Gen-II-Lumi-hands-on-review-Lightweight-ePaper-tablet-with-Android-apps.1288284.0.html),
  [Go 10.3 Gen II (AndroidGuys)](https://androidguys.com/news/boox-go-10-3-gen-ii-e-ink-tablets-target-digital-nomads/),
  [Go 7 vs Go 10.3 (comparisontabl.es)](https://comparisontabl.es/e-readers/boox-go-7-vs-boox-go-10-3/)
- [Boox refresh modes](https://help.boox.com/hc/en-us/articles/10701257029780-Refresh-Modes),
  [EinkWise](https://help.boox.com/hc/en-us/articles/10990010331156-EinkWise)
- [Android lock task mode (AOSP docs)](https://android.googlesource.com/platform/frameworks/base/+/d9f38b1/docs/html/work/cosu.jd),
  [Lock task mode overview (Hexnode)](https://www.hexnode.com/blogs/what-is-android-lock-task-mode/),
  [Making an Android kiosk app with adb and dpm](http://wenchaojiang.github.io/blog/realise-Android-kiosk-mode/),
  [Kiosk Launcher (open source)](https://github.com/osamaalek/Kiosk-Launcher)
- [NickelMenu](https://github.com/pgaskin/NickelMenu),
  [KOReader on Kobo 5.x installer discussion](https://github.com/koreader/koreader/discussions/16001),
  [KoboPatch WebUI](https://github.com/nicoverbruggen/kobopatch-webui)
- [Kindle jailbreak guide 2026 (iTechGuides)](https://www.itechguides.com/this-is-the-kindle-jailbreak-guide-amazon-doesnt-want-you-to-read-but-it-isnt-universal/),
  [Kindle modding guide](https://boredom-at-work.com/kindle-modding-guide/),
  [Newest Kindles without a jailbreak](https://rottenwifi.com/the-kindle-jailbreak-guide-amazon-doesnt-want-you-to-read-what-actually-works-in-2026/)
- [reMarkable developer mode](https://developer.remarkable.com/documentation/developer-mode),
  [Android 13 on the Paper Pro (Android Authority)](https://www.androidauthority.com/remarkable-paper-pro-running-android-13-3700212/),
  [awesome-reMarkable](https://github.com/rehackable/awesome-remarkable)

These are mostly reviews, retailer listings and community guides, not manufacturers' spec sheets; check a model's page
before buying.
