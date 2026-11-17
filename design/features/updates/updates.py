"""Updates, round 1 (2026-11-16): how the installed app says a newer Bible Workbench is ready, shows what changed and
takes it. One direction, decided by the overseer from existing decisions (U-1 to U-19 in README.md), not yet reviewed by
the person. The notice is a dot on the Settings gear and never sits over the reader; everything else is one section of
the Settings menu. Scripture (Numbers 25:10-13) is fetched with wb into data/; nothing is typed. Version numbers, dates,
sizes, notes and page names are a drawn sample: no such release exists.

    python design/features/updates/updates.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

PG = "Updates"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
REG = []          # (png name, window title), for the render script

# ---- the sample release (a drawn sample, as the README says) ---------------------------------------------------------
INSTALLED, NEWER = "0.2.4", "0.3.0"
CARD_TITLE = "Bible Workbench 0.3.0 · 14 November 2026 · 84 MB"
MOVED = ["The toolbar is gone. Its buttons are in the top bar's More and in Settings.",
         "Kept commands moved from the toolbar to the rail."]
NEW = ["The Concordance opens a picked word in a new tab.", "A back button in every tab."]
CHANGED = ["Settings opens as a menu in the middle of the window."]
FIXED = ["Italic words are no longer grey in night mode."]
U4 = "Looking asks one address for one small file. It sends nothing about you or your study."
SETTINGS_SECTIONS = ["Reading", "Theme", "Notebook", "Layouts", "Commands", "Study folder", "Documents", "Updates"]
HELP_SECTIONS = ["Guide", "Keys", "Manual"]
CHOICES = ["When the app opens", "Only when I ask"]


def win(r, png, title, about, w=W, h=H):
    REG.append((png, title))
    return Q.win(r, PG, title, about, w=w, h=h)


def part(cv, s):
    text(cv, s, "title", fontSize=26, lineHeight="32px")


# ---- the app, with the gear's mark -----------------------------------------------------------------------------------
GEAR_X, GEAR_W, GEAR_Y = 7, 38, 341          # rail5: pad 7, buttons 38 wide; the Settings button is its last item (y 341 as rail5 draws it)


def gear_mark(f, state, h=H, tip=False):
    """The one sign of an update (U-1): a small accent dot at the gear's upper right ('dot'), or a ring partly filled
    while a download runs ('ring'). Optionally the tooltip beside the gear, as if the pointer rests on it."""
    y0 = GEAR_Y
    if state == "dot":
        m = frame(f, "gear mark: dot", x=GEAR_X + 24, y=y0 + 1, w=14, h=14, radius=7, fill="sunken", W="fixed",
                  H="fixed", layout="horizontal", mainAlign="center", crossAlign="center")
        K.F.dot(m, "accent", 10, name="update dot")
    elif state == "ring":
        m = frame(f, "gear mark: ring", x=GEAR_X + 20, y=y0 - 3, w=20, h=20, radius=10, fill="sunken", W="fixed",
                  H="fixed")
        for nm, d, col_ in (("track", "M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14z", "muted"),
                            ("filled 31 of 84", "M10 3A7 7 0 0 1 15.1 14.2", "accent")):
            K.S.do("vector.create", {"path": d, "x": 0, "y": 0, "parent": m, "name": nm,
                                     "props": {"stroke": K.F.c(col_), "strokeWeight": 1.6 if col_ == "muted" else 2.6, "strokeCap": "round",
                                               "fill": "none"}})
    if tip:
        t = row(f, "tooltip", gap=0, pad=[6, 10, 6, 10], fill="fg", radius=8, W="fixed")
        Q.put(t, GEAR_X + GEAR_W + 6, y0 - 2, 128)
        para(t, "Bible Workbench 0.3.0 is ready", "smallStrong", "bg")
        shadow(t, 4, 12, "#00000033")


def lines(p, widths):
    for w_ in widths:
        b = frame(p, "stand-in line", w=w_, h=9, radius=4, fill="line", W="fixed", H="fixed")
    return p


def app(f, gear=None, tip=False, tabs=("Phinehas", "Concordance"), front="Phinehas", pane_w=480, h=H, wide=W,
        rail_h=None):
    """The window as in the other folders (rail, slim bar, reader at Numbers 25, one side pane) with the gear's mark."""
    w = K.app(f)
    pw = pane_w
    K.reader(f, w, wide - w - pw, NUM25, "Numbers 25")
    body = K.M.pane(f, wide - pw, TB, pw, H - TB, list(tabs), front)
    if front == "Notebook":
        return body
    text(body, front, "title")
    lines(body, [380, 300, 340, 220])
    gear_mark(f, gear, tip=tip) if gear else None
    return body


# ---- the Settings menu (help.py's centred menu over the dimmed app) -------------------------------------------------
def gap(parent, h):
    frame(parent, "gap", w=10, h=h, W="fill", H="fixed")


def ready_line(parent):
    """U-1: the one line at the top of every other section."""
    r = row(parent, "ready line", gap=8, pad=[9, 14, 9, 14], fill="accentSoft", radius=8, W="fill")
    text(r, "Bible Workbench 0.3.0 is ready", "smallStrong", W="fill")
    icon(r, "right", 14, "muted")
    return r


def menu(f, active, title, size=(1100, 720), back=False, ready=False, gear=None, scrim=True):
    mw, mh = size
    if scrim:
        frame(f, "scrim", x=0, y=0, w=W, h=H, fill="scrim", W="fixed", H="fixed")
    d = frame(f, "settings menu", x=(W - mw) // 2, y=(H - mh) // 2, w=mw, h=mh, fill="bg", layout="horizontal",
              radius=14, stroke="line", sw=1, W="fixed", H="fixed", clip=True)
    shadow(d, 12, 40, "#00000040")
    nav = col(d, "sections", gap=2, pad=[16, 10, 16, 10], fill="sunken", W="fixed", H="fill")
    K.S.do("node.set", {"ids": [nav], "props": {"width": 210}}, ref=False)
    P.field(nav, "Find", height=32)
    gap(nav, 6)
    text(nav, "SETTINGS", "label", "muted")
    for s in SETTINGS_SECTIONS:
        K.line(nav, s, on=(s == active))
    gap(nav, 10)
    text(nav, "HELP", "label", "muted")
    for s in HELP_SECTIONS:
        K.line(nav, s)
    content = col(d, "content", gap=12, pad=[20, 24, 20, 24], W="fill", H="fill", clip=True)
    if ready:
        ready_line(content)
    hd = row(content, "head", gap=8, W="fill")
    if back:
        P.button(hd, "Updates", "ghost", "left", size="sm")
    tc = col(hd, "title", gap=2, W="fill")
    text(tc, title, "title")
    P.icon_button(hd, "close", "muted", size=28, icon_size=14)
    return content


def app_behind(f, gear="dot"):
    """The app under the scrim (U1's window, dimmed by the menu)."""
    return app(f, gear=gear)


# ---- pieces of the Updates section ----------------------------------------------------------------------------------
def ver_line(c, have=f"You have {INSTALLED}", last="Last looked today, 9:12", stacked=False):
    r = (col if stacked else row)(c, "version", gap=2 if stacked else 10, W="fill")
    text(r, have, "bodyStrong")
    if not stacked:
        text(r, "·", "small", "muted")
    if last:
        text(r, last, "small", "muted")
    return r


def release_card(c, buttons=("Install", "What changed", "Not this version"), stacked=False, title=CARD_TITLE,
                 first_only=True):
    k = col(c, "release", gap=10, pad=[16, 16, 16, 16], fill="surface", radius=12, stroke="line", sw=1, W="fill")
    para(k, title, "heading")
    text(k, "MOVED OR REMOVED", "label", "muted")
    para(k, MOVED[0], "body")
    sf = row(k, "study folder", gap=6, W="fill")
    text(sf, "Your study folder:", "smallStrong")
    text(sf, "Not changed by this update.", "small")
    b = (col if stacked else row)(k, "buttons", gap=8, W="fill")
    for lab in buttons:
        kind = "primary" if lab == "Install" else "ghost"
        P.button(b, lab, kind, size="sm", **({"W": "fill"} if stacked else {}))
    return k


def radio(parent, label, on):
    r = row(parent, f"choice/{label}", gap=10, pad=[10, 12, 10, 12], radius=8, W="fill",
            fill="accentSoft" if on else "surface", stroke="accent" if on else "line", sw=1)
    o = frame(r, "radio", w=16, h=16, radius=8, stroke="accent" if on else "muted", sw=1.5, W="fixed", H="fixed",
              layout="horizontal", mainAlign="center", crossAlign="center")
    if on:
        K.F.dot(o, "accent", 8)
    text(r, label, "smallStrong" if on else "small", "fg" if on else "muted", W="fill")
    return r


def look_setting(c, on=CHOICES[0], stacked=False):
    if stacked:
        s = col(c, "look for updates", gap=8, W="fill")
        text(s, "Look for updates", "bodyStrong")
        for o in CHOICES:
            radio(s, o, o == on)
        return s
    s = row(c, "look for updates", gap=16, pad=[6, 0, 6, 0], W="fill")
    text(s, "Look for updates", "bodyStrong", W="fill")
    P.segmented(s, CHOICES, on, W="hug")
    return s


def say(c, s, tone="muted", ic=None):
    """A plain statement in the section, with what still works (U-11)."""
    r = row(c, "statement", gap=10, pad=[12, 14, 12, 14], fill="sunken", radius=10, W="fill", align="min")
    if ic:
        icon(r, ic, 18, tone)
    para(r, s, "body")
    return r


def foot(c, stacked=False, check=True, line=True, on=CHOICES[0], setting=True):
    if setting:
        look_setting(c, on, stacked)
    if check:
        P.button(c, "Check now", "secondary", size="sm", **({"W": "fill"} if stacked else {}))
    if line:
        para(c, U4, "caption", "muted")


# ---- the sheets -----------------------------------------------------------------------------------------------------
def notice(cv):
    part(cv, "The notice")
    r = row(cv, "U1", gap=64, align="min")
    f = win(r, "U01", "U1 · The notice: a dot on the Settings gear",
            "U-1: a newer version is known, and the only sign anywhere is a small accent dot on the Settings gear at the "
            "rail's foot; resting on the gear says what it is. Nothing is over the reader's text, the top bar or the tabs. "
            "The smaller dot under the Trail icon is the rail's own and is not the update dot.")
    app(f, gear="dot", tip=True)
    K.note(f, "The one sign of an update: this dot. No toast, no dialog, no window on start. The smaller dot under the Trail icon is the rail's own, not the update dot.", 70, H - 190, 330)

    r = row(cv, "U2", gap=64, align="min")
    f = win(r, "U02a", "U2 · The Updates section, an update ready",
            "U-2, U-3, U-4, U-5: Updates is one more section of the Settings menu. The version, when it last looked, "
            "the newer version with its first Moved or removed line, Install as the one primary button, the setting, "
            "Check now, and the line that says what a look sends.")
    app_behind(f)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    release_card(c)
    foot(c)

    f = win(r, "U02b", "U2 · Another section, with the one line at its top",
            "U-1: with Settings open on any other section while an update is ready, one line at its top says so and "
            "opens Updates. Nothing else in the section changes.")
    app_behind(f)
    c = menu(f, "Reading", "Reading", ready=True)
    lines(c, [520, 440, 480, 300])
    gap(c, 6)
    lines(c, [460, 520, 380])
    gap(c, 6)
    lines(c, [500, 420, 340, 460])


def notes_body(c, moved=True, install=True):
    def heading(s):
        text(c, s, "smallStrong", "accent")

    def item(s):
        r = row(c, "note line", gap=8, W="fill", align="min")
        text(r, "–", "body", "muted")
        para(r, s, "body")

    heading("Moved or removed")
    for s in (MOVED if moved else ["Nothing was moved or removed."]):
        if moved:
            item(s)
        else:
            para(c, s, "body")
    for h_, items in (("New", NEW), ("Changed", CHANGED), ("Fixed", FIXED)):
        heading(h_)
        for s in items:
            item(s)
    r = row(c, "study folder", gap=6, pad=[10, 14, 10, 14], fill="sunken", radius=8, W="fill")
    text(r, "Your study folder:", "smallStrong")
    text(r, "Not changed by this update.", "small")
    if install:
        P.button(c, "Install", "primary", size="sm")


def changed(cv):
    part(cv, "What changed")
    r = row(cv, "U3", gap=64, align="min")
    f = win(r, "U03a", "U3 · What changed",
            "U-6: the release's own notes under four headings in a fixed order, Moved or removed first, then the "
            "line about the study folder; Install at the foot; the way back to the section is at the head.")
    app_behind(f)
    c = menu(f, "Updates", "What changed in 0.3.0", size=(1100, 760), back=True)
    notes_body(c)

    f = win(r, "U03b", "U3 · A release with nothing moved",
            "U-6: when nothing was moved or removed, the heading is still first and says so in a sentence.")
    app_behind(f)
    c = menu(f, "Updates", "What changed in 0.3.0", size=(1100, 760), back=True)
    notes_body(c, moved=False)


def installing(cv):
    part(cv, "Installing and restarting")
    r = row(cv, "U4", gap=64, align="min")
    f = win(r, "U04a", "U4 · Downloading",
            "U-7: Install downloads in the background. The section shows the progress, Stop, and that Settings can be "
            "closed.")
    app_behind(f, gear="ring")
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    k = col(c, "downloading", gap=10, pad=[16, 16, 16, 16], fill="surface", radius=12, stroke="line", sw=1, W="fill")
    text(k, "Downloading 0.3.0 · 31 of 84 MB", "heading")
    bar = frame(k, "progress", w=10, h=8, radius=4, fill="sunken", W="fill", H="fixed")
    frame(bar, "done 31 of 84", x=0, y=0, w=int(808 * 31 / 84), h=8, radius=4, fill="accent", W="fixed", H="fixed")
    P.button(k, "Stop", "secondary", size="sm")
    para(k, "You can close Settings and keep reading.", "small", "muted")

    f = win(r, "U04b", "U4 · Downloading, Settings closed",
            "U-1, U-7: the same reader and tabs as before the download; the gear's dot has become a small ring, "
            "partly filled. Nothing else changes.")
    app(f, gear="ring")

    r = row(cv, "U5", gap=64, align="min")
    f = win(r, "U05", "U5 · Ready to restart",
            "U-7, U-8: the file is whole and checked. Restart now (the one primary) or When I close the app; doing "
            "neither is the same as the second. The section says what is saved first and what comes back.")
    app_behind(f)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    k = col(c, "ready to restart", gap=10, pad=[16, 16, 16, 16], fill="surface", radius=12, stroke="line", sw=1,
            W="fill")
    text(k, "0.3.0 is downloaded and checked.", "heading")
    para(k, "1 page with writing (Phinehas) is saved first. Bible Workbench opens again where you are: Numbers 25, "
            "your tabs and floating tabs.", "body")
    b = row(k, "buttons", gap=8)
    P.button(b, "Restart now", "primary", size="sm")
    P.button(b, "When I close the app", "secondary", size="sm")

    r = row(cv, "U6", gap=64, align="min")
    f = win(r, "U06a", "U6 · After the restart: the app as it was",
            "U-8, U-9: the app reopened as in U1 and nothing is over the reader: the same reader place and tabs, "
            "Settings closed, and no dot on the gear.")
    app(f, gear=None)

    f = win(r, "U06b", "U6 · After the restart: the section",
            "U-9, U-13: the section says what the installed version is, with its notes and a way back to 0.2.4 "
            "(bordered, not primary), then the setting and Check now as in U2.")
    app_behind(f, gear=None)
    c = menu(f, "Updates", "Updates")
    text(c, "You have 0.3.0, updated today from 0.2.4", "bodyStrong")
    b = row(c, "buttons", gap=8)
    P.button(b, "What changed", "ghost", size="sm")
    P.button(b, "Go back to 0.2.4", "secondary", size="sm")
    foot(c)


def by_hand(cv):
    part(cv, "Checking by hand, and the setting")
    r = row(cv, "U7", gap=64, align="min")
    f = win(r, "U07a", "U7 · Checking by hand: nothing newer",
            "U-3: after Check now, with nothing newer, the section says so and when it looked; the setting is "
            "When the app opens, the default.")
    app_behind(f, gear=None)
    c = menu(f, "Updates", "Updates")
    text(c, f"You have {INSTALLED}", "bodyStrong")
    say(c, f"Bible Workbench {INSTALLED} is the newest. Looked just now.", "ok", "check")
    foot(c)

    f = win(r, "U07b", "U7 · The setting: Only when I ask",
            "U-3: with Only when I ask chosen, the app makes no look by itself; Check now still looks.")
    app_behind(f, gear=None)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    foot(c, on=CHOICES[1])

    r = row(cv, "U10", gap=64, align="min")
    f = win(r, "U10", "U10 · A copy built from source",
            "U-14: a copy built by scripts/install-app.ps1 has no update code; its section holds only the one "
            "statement, with no buttons and no setting.")
    app_behind(f, gear=None)
    c = menu(f, "Updates", "Updates", size=(1100, 720))
    para(c, "This copy was built from source (40a91dc). It does not update itself.", "body")


def failure(cv):
    part(cv, "Failure and refusal")
    r = row(cv, "U8", gap=64, align="min")
    f = win(r, "U08a", "U8 · No connection",
            "U-11: a look by hand with no network says so in plain words and what still works. It is looked for "
            "again with Check now. The setting, Check now and the line about what a look sends stay.")
    app_behind(f, gear=None)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    say(c, "Could not reach the update site. Bible Workbench works as it is.", "warn", "close")
    foot(c)

    f = win(r, "U08b", "U8 · A download that stopped",
            "U-11: a download cut off halfway says where it stopped and that the installed version is unchanged, "
            "with Try again. The dot shows because the person had asked for the install.")
    app_behind(f)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    say(c, "The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench 0.2.4 works as it is.", "warn", "close")
    P.button(c, "Try again", "secondary", size="sm")
    foot(c)

    r = row(cv, "U9", gap=64, align="min")
    f = win(r, "U09a", "U9 · Refused: not signed",
            "U-12: an update whose signature does not match is thrown away. There is no button that installs it "
            "anyway; only Check now.")
    app_behind(f, gear=None)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    say(c, "This update was not installed: it was not signed by Bible Workbench. Nothing was changed.", "warn",
        "close")
    P.button(c, "Check now", "secondary", size="sm")
    look_setting(c)
    para(c, U4, "caption", "muted")

    f = win(r, "U09b", "U9 · A page that could not be saved",
            "U-8: a page that cannot be saved stops the restart; the update waits with the same two buttons.")
    app_behind(f)
    c = menu(f, "Updates", "Updates")
    ver_line(c)
    k = col(c, "waiting", gap=10, pad=[16, 16, 16, 16], fill="surface", radius=12, stroke="warn", sw=1, W="fill")
    text(k, "Phinehas could not be saved, so Bible Workbench was not restarted", "heading")
    para(k, "0.3.0 is still waiting.", "body")
    b = row(k, "buttons", gap=8)
    P.button(b, "Restart now", "primary", size="sm")
    P.button(b, "When I close the app", "secondary", size="sm")


# ---- the real conditions --------------------------------------------------------------------------------------------
def other_tabs(f, gear, front="Phinehas", tabs=("Numbers 25", "Psalms 106", "Phinehas", "Concordance"), pane_w=600,
               tip=False):
    w = K.app(f)
    K.reader(f, w, W - w - pane_w, NUM25, "Numbers 25")
    body = K.M.pane(f, W - pane_w, TB, pane_w, H - TB, list(tabs), front)
    return body


def conditions(cv):
    part(cv, "The real conditions")
    r = row(cv, "U11", gap=64, align="min")
    f = win(r, "U11", "U11 · Among other tabs",
            "A pane with four tabs, the third in front, while a download runs and Settings is closed. The ring on the "
            "gear is the only change; no tab moves and nothing opens.")
    body = other_tabs(f, "ring")
    text(body, "Phinehas", "title")
    lines(body, [400, 340, 380, 260])
    gear_mark(f, "ring")
    K.note(f, "A download is running. The ring on the gear is the only change: no tab moves, no tab opens.", 70,
           H - 150, 330)

    r = row(cv, "U12", gap=64, align="min")
    fx, fy, fw = 950, 230, 300
    for png, ttl, about, before in (
            ("U12a", "U12 · A floating tab, before the restart",
             "U-8: the menu opens over the floated tab; closing it or restarting leaves the tab where it was.", True),
            ("U12b", "U12 · A floating tab, after the restart",
             "U-8, U-9: the same reader place, the floated tab at the same spot and size, no menu and no dot.",
             False)):
        f = win(r, png, ttl, about)
        w = K.app(f)
        K.reader(f, w, W - w, NUM25, "Numbers 25")
        fl = K.floating(f, "floating tab", fx, fy, fw)
        hb = row(fl, "handle", gap=6, W="fill")
        icon(hb, "drag", 16, "muted")
        text(hb, "Phinehas", "smallStrong", W="fill")
        P.icon_button(hb, "close", "muted", size=26, icon_size=14)
        lines(fl, [250, 200, 230, 150])
        if before:
            gear_mark(f, "dot")
            c = menu(f, "Updates", "Updates", size=(800, 720))
            ver_line(c)
            k = col(c, "ready to restart", gap=10, pad=[16, 16, 16, 16], fill="surface", radius=12, stroke="line",
                    sw=1, W="fill")
            text(k, "0.3.0 is downloaded and checked.", "heading")
            para(k, "1 page with writing (Phinehas) is saved first. Bible Workbench opens again where you are: "
                    "Numbers 25, your tabs and floating tabs.", "body")
            b = row(k, "buttons", gap=8)
            P.button(b, "Restart now", "primary", size="sm")
            P.button(b, "When I close the app", "secondary", size="sm")

    r = row(cv, "U13", gap=64, align="min")
    narrow_menu(r)
    narrow_window(r)

    r = row(cv, "U14", gap=64, align="min")
    years_behind(r)
    years_after(r)


def narrow_menu(r):
    pw, ph = 390, 800
    f = win(r, "U13a", "U13 · Narrow: the Updates section at phone width",
            "U-19: a narrow window. The sections fold into a menu button, the rows stack, and every button, the "
            "setting's two choices and the notes' headings are shown whole.", w=pw, h=ph)
    d = frame(f, "settings menu", x=0, y=0, w=pw, h=ph, fill="bg", layout="vertical", W="fixed", H="fixed", clip=True)
    top = row(d, "head", gap=6, pad=[10, 14, 6, 14], W="fill")
    text(top, "Settings", "title", W="fill")
    P.icon_button(top, "close", "muted", size=28, icon_size=14)
    sec = row(d, "sections", gap=6, pad=[6, 14, 10, 14], fill="sunken", W="fill")
    P.button(sec, "Updates  ▾", "secondary", size="sm")
    spacer(sec)
    icon(sec, "search", 18, "muted")
    c = col(d, "content", gap=12, pad=[12, 14, 14, 14], W="fill", H="fill", clip=True)
    ver_line(c, stacked=True)
    release_card(c, stacked=True)
    look_setting(c, stacked=True)
    P.button(c, "Check now", "secondary", size="sm", W="fill")
    para(c, U4, "caption", "muted")


def narrow_window(r):
    ww = 820
    f = win(r, "U13b", "U13 · Narrow: a desktop window about 820 wide",
            "U-1: in a narrow window the rail keeps the gear, so the dot is where it always is.", w=ww, h=H)
    rw = K.M.rail5(f)
    bar = row(f, "top bar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, rw, 0, ww - rw, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "fg")
    text(pl, "Numbers 25", "bodyStrong")
    text(pl, "KJV", "caption", "muted")
    icon(pl, "down", 14, "muted")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    spacer(bar)
    P.icon_button(bar, "search", "fg", size=32, icon_size=18)
    K.reader(f, rw, ww - rw, NUM25, "Numbers 25")
    gear_mark(f, "dot")


FOLDED = [("0.2.4", "2 November 2026", None), ("0.2.3", "21 October 2026", "Views are now called saved lists."),
          ("0.2.2", "9 October 2026", None),
          ("0.2.1", "28 September 2026", "Inbox is gone; its pages are in the Notebook."),
          ("0.2.0", "14 September 2026", None), ("0.1.10", "31 August 2026", None),
          ("0.1.9", "19 August 2026", None),
          ("0.1.8", "5 August 2026", "The Shelf button moved from the top bar to the rail."),
          ("0.1.7", "22 July 2026", None), ("0.1.6", "8 July 2026", None), ("0.1.5", "24 June 2026", None),
          ("0.1.4", "10 June 2026", None), ("0.1.3", "27 May 2026", None)]


def years_behind(r):
    f = win(r, "U14a", "U14 · Fourteen releases behind",
            "U-6: 0.1.2 is installed and 0.3.0 is the newest. 0.3.0 is open with its notes; the thirteen older "
            "releases are folded to a line each, newest first, with their Moved or removed line where they have one. "
            "The list scrolls inside the section.")
    app_behind(f)
    c = menu(f, "Updates", "Updates", size=(1100, 740))
    ver_line(c, have="You have 0.1.2")
    # the section's body: one scrolling area, one scroll bar whose track spans the body's full height
    body = row(c, "section body", gap=8, W="fill", H="fill", clip=True, align="min")
    sc = col(body, "scrolling", gap=8, W="fill", H="hug")
    lst = col(sc, "releases", gap=6, pad=[12, 12, 12, 12], radius=12, stroke="line", sw=1, fill="surface", W="fill")
    hd = row(lst, "newest", gap=8, W="fill")
    text(hd, "0.3.0 · 14 November 2026", "bodyStrong", W="fill")
    text(hd, "84 MB", "small", "muted")
    for h_, items in (("Moved or removed", MOVED), ("New", NEW), ("Changed", CHANGED), ("Fixed", FIXED)):
        text(lst, h_, "smallStrong", "accent")
        for s_ in items:
            para(lst, "- " + s_, "small")
    rr = row(lst, "study folder", gap=6, W="fill")
    text(rr, "Your study folder:", "smallStrong")
    text(rr, "Not changed by this update.", "small")
    bt = row(lst, "buttons", gap=8, W="fill")
    P.button(bt, "Install", "primary", size="sm")
    P.button(bt, "Not this version", "ghost", size="sm")
    cl = col(sc, "folded", gap=0, W="fill")
    for ver, date, moved in FOLDED:
        it = col(cl, f"release {ver}", gap=1, pad=[7, 12, 7, 12], W="fill")
        hr = row(it, "line", gap=8, W="fill")
        icon(hr, "right", 14, "muted")
        text(hr, f"{ver} · {date}", "smallStrong", W="fill")
        if moved:
            para(it, "Moved or removed: " + moved, "small", "muted")
    tr = frame(body, "scroll bar", w=6, h=100, radius=3, fill="sunken", W="fixed", H="fill")
    frame(tr, "thumb", x=0, y=0, w=6, h=110, radius=3, fill="muted", W="fixed", H="fixed")
    K.note(f, "13 older releases, newest first; the section scrolls. The setting and Check now are below.", W - 470,
           H - 72, 340)


def years_after(r):
    f = win(r, "U14b", "U14 · A study of years, after the restart",
            "U-8, U-15: the reader at its place, a pane with many tabs and a Notebook of hundreds of pages, as they "
            "were. The restart is an ordinary start of the study.")
    tabs = ["Numbers 25", "Psalms 106", "Phinehas", "Zeal", "Peace", "Priest", "Notebook"]
    w = K.app(f)
    pw = 720
    K.reader(f, w, W - w - pw, NUM25, "Numbers 25")
    body = K.M.pane(f, W - pw, TB, pw, H - TB, tabs, "Notebook")
    hd = col(body, "head", gap=2, W="fill")
    text(hd, "Notebook", "title")
    text(hd, "612 pages · 41 threads · 28 layouts", "small", "muted")
    names = ["Phinehas", "Zeal", "Peace", "Covenant", "Priesthood", "Atonement", "Moses", "Eleazar", "Aaron", "Israel",
             "Moab", "Midian", "Plague", "Jealousy", "Offering", "Sanctuary", "Tabernacle", "Levites", "Census",
             "Inheritance", "Lots", "Judges", "Joshua", "Caleb", "Gilead", "Reuben", "Gad", "Manasseh", "Ephraim",
             "Benjamin"]
    lst = col(body, "pages", gap=2, W="fill", H="fill", clip=True)
    for n_, name in enumerate(names):
        K.line(lst, name, ic="page", right=str(3 + (n_ * 7) % 11))
    K.note(f, "The update reads and copies nothing from the study folder; the restart is an ordinary start.", 70,
           H - 130, 380)


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Updates, round 1",
                  "One direction, decided by the overseer from existing decisions 2026-11-16, not yet reviewed by the "
                  "person; the notice is a dot on the Settings gear and never sits over the reader. U1 to U14.")
    notice(cv)
    changed(cv)
    installing(cv)
    by_hand(cv)
    failure(cv)
    conditions(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Updates", sheets)
    out = K.LIB / "build"
    out.mkdir(exist_ok=True)
    (out / "updates-windows.json").write_text(json.dumps(REG), encoding="utf-8")
