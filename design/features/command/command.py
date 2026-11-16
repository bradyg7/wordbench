"""The top bar and the command box, round 1. With the tools on the rail (minimize round 5) the top bar holds the place
and the command field. This round asks what the command field shows while you type (so a person never has to know the
command language, 8353), where kept commands go when the bar is full (36d7, bc42), and where full screen for the whole
app lives (0e94). Examples in the field are wb manual's own; scripture is fetched with wb text.

    python design/features/command/command.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
import minimize as M  # noqa: E402
from kit import P, Q, S, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Command"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
MANUAL = K.fetch(HERE, "manual-uses", ["manual", "uses"], as_json=False)


def field(f, x, w, value, open_=False):
    cmd = row(f, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="accent" if open_ else
              "line", sw=1, W="fixed", H="fixed")
    Q.put(cmd, x, (TB - 34) // 2, w, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, value, "small", "fg", W="fill", maxLines=1)
    P.kbd(cmd, "Esc")
    return cmd


def base(f, value=None, open_=False):
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    if value is not None:
        field(f, FX(w), 522, value, open_)
    return w


def FX(w):
    return w + (W - w - 520) // 2 + 43  # over the slim bar's own field


def group(p, title):
    text(p, title.upper(), "label", "muted")


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "C1 · Today: the toolbar and kept commands",
              "As built: the toolbar holds Notebook, Threads, Shelf, Plans, Help, the place, the command field and the "
              "kept commands as buttons. With a few kept commands the bar overflows and shortcuts go off screen "
              "(36d7); the More button and the bar's settings want a design (bc42). Typing in the field needs the "
              "command language (8353).")
    Q.toolbar(f)
    Q.reader(f, 0, W)


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "C2 · A: the field suggests as you type",
              "Typing “zeal” offers what it could mean, in plain words, each with the line it stands for in small type: "
              "go to a place, every use of a word, search the text, your pages. ↑ ↓ and Enter, or a click. The "
              "command language still works, but nobody has to learn it.")
    w = base(f, "zeal", True)
    p = K.floating(f, "suggestions", FX(w), TB - 6, 520, gap=2)
    group(p, "Look up")
    K.line(p, "Every use of “zeal”", "uses zeal", "list", on=True)
    K.line(p, "Search the text for zeal, zealous, zealously", "search zeal*", "search")
    K.line(p, "“zeal” in the Concordance", "define zeal", "word")
    K.line(p, "Webster's 1913: zeal", "word-define zeal", "dictionary")
    K.rule(p)
    group(p, "Your study")
    K.line(p, "Pages with “zeal”", "find zeal", "page")
    K.line(p, "A thread named Zeal", None, "threads")

    f = Q.win(r, PG, "C3 · A: narrowing without typing",
              "Once a suggestion is chosen, its choices are chips under the field (8353): where to look, which word "
              "form. Each chip changes the line in small type, so the command is learned by looking, not required.")
    w = base(f, "Every use of “zeal”", True)
    p = K.floating(f, "choices", FX(w), TB - 6, 520, gap=10)
    group(p, "Where")
    ch = row(p, "scope", gap=6, wrap=True, W="fill")
    for c, on in (("Whole Bible", False), ("Old Testament", False), ("New Testament", False), ("Gospels", True),
                  ("Choose books…", False)):
        P.chip(ch, c, "selected" if on else "outline")
    group(p, "Forms")
    ch = row(p, "forms", gap=6, wrap=True, W="fill")
    for c, on in (("zeal", True), ("zealous", False), ("zealously", False)):
        P.chip(ch, c, "selected" if on else "outline")
    K.rule(p)
    rr = row(p, "line", gap=8, W="fill")
    text(rr, "uses zeal gospels", "caption", "muted", W="fill")
    P.button(rr, "Open", "primary", size="sm")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "C4 · B: kept commands on the rail, not the bar",
              "Kept commands leave the top bar, so it never overflows (36d7): they sit at the rail's foot as icons, "
              "with their names when Show names is on, and the field lists them first when it is empty.")
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    p = K.floating(f, "kept commands", 6, H - 300, 260, gap=2)
    group(p, "Your commands")
    for name, line, key in (("Uses of a word", "uses {word}", "Ctrl+U"), ("Interlinear here", "interlinear {place}",
                            "Ctrl+I"), ("Today's reading", "plan today", None)):
        it = K.line(p, name, line, "type", right=key)
    P.button(p, "Keep a command", "ghost", "plus", size="sm")

    f = Q.win(r, PG, "C5 · B: the ⋯ menu, with the app's own full screen",
              "One ⋯ at the end of the top bar holds what is about the window, not the study: full screen for the "
              "whole app (0e94, beside each pane's own), the layout, the theme, and Settings. Hiding the top bar "
              "after that gives the reader the whole screen.")
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    mb = P.icon_button(f, "more", "accent", size=32, icon_size=18, fill="accentSoft")
    Q.put(mb, W - 48, (TB - 32) // 2)
    p = K.floating(f, "window menu", W - 300, TB - 6, 280, gap=2)
    K.line(p, "Full screen", None, "expand", right="F11", on=True)
    K.line(p, "Hide the top bar", None, "minimize", right="Ctrl+\\")
    K.rule(p)
    K.line(p, "Layout", "Reading", "panel")
    K.line(p, "Theme", "Light", "sun")
    K.rule(p)
    K.line(p, "Settings", None, "gear", right="Ctrl+,")


# ---- round 2: the top bar with the trail line (c9a2, 3a9f, c567, 36d7) -----------------------------------------------
# The browser-tab try (C6-C12, 2026-11-13) left the board the same day: one tab row cannot say which pane a tab is in,
# and it made the reader one tab among many. It was never committed; the README keeps its record. Window numbers are not reused.
TL = 34          # the trail line under the top bar
TOP = TB + TL    # the top bar and the trail line together
KIND = {"verse": "book", "word": "word", "uses": "list", "search": "search", "page": "page", "bdb": "lexicon",
        "def": "dictionary"}
PS106 = K.verses_of(K.fetch(HERE, "ps106-28-31", ["text", "Ps 106:28-31"], as_json=False))
MAL2 = K.verses_of(K.fetch(HERE, "mal2-4-7", ["text", "Mal 2:4-7"], as_json=False))
PATH = [("verse", "Numbers 25:11", False), ("word", "H7068", True), ("uses", "Every use: zeal", False),
        ("verse", "Romans 10:2", True), ("search", "Search: “zeal of God”", False)]


def top_bar(f, x, w, place="Numbers 25", line=None, tools=("KJV", "highlight", "listen", "search"), focused=False,
            box=True, compact=False):
    """The top bar: back and forward, the place, the command box holding the front tab's line (3a9f) with the reader's
    tools at its end, and one More for the window (C5). No toolbar buttons."""
    bar = row(f, "top bar", gap=8, pad=[0, 10, 0, 10], fill="sunken", W="fixed", H="fixed")
    Q.put(bar, x, 0, w, TB)
    P.icon_button(bar, "left", "fg", size=30, icon_size=17)
    P.icon_button(bar, "right", "muted", size=30, icon_size=17)
    if not compact:
        pl = row(bar, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
        icon(pl, "book", 18, "fg")
        text(pl, place, "bodyStrong")
        icon(pl, "down", 14, "muted")
    if box:
        b = row(bar, "command box", gap=8, pad=[0, 8, 0, 12], radius=8, fill="surface",
                stroke="accent" if focused else "line", sw=1.5 if focused else 1, W="fill", H="fixed")
        S.do("node.set", {"ids": [b], "props": {"height": 34}}, ref=False)
        icon(b, "search", 16, "accent" if focused else "muted")
        text(b, line or "Search, go to a place, or type a command", "body", "fg" if line else "muted", W="fill",
             maxLines=1)
        for t in tools:
            if t == "KJV":
                v = row(b, "version", pad=[2, 8, 2, 8], radius=999, fill="sunken", stroke="line", sw=1)
                text(v, "KJV", "caption", "fg")
            else:
                P.icon_button(b, t, "muted", size=26, icon_size=15)
    else:
        spacer(bar)
    P.icon_button(bar, "more", "fg", size=30, icon_size=17)
    return bar


def trail_line(f, x, w, steps=PATH, right="31 tabs · 3 forks", folded=None, sitting="Today 9:14", compact=False):
    """The trail (minimize I2, sittings N + O) as a line under the top bar: the sitting, where it began, the way to
    here, forks as small marks. folded: how many steps fold into one ... after the start."""
    b = row(f, "trail line", gap=6, pad=[0, 12, 0, 12], fill="bg", W="fixed", H="fixed", stroke="line",
            strokeBottomWeight=1, strokeTopWeight=1, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(b, x, TB, w, TL)
    if sitting:
        s = row(b, "sitting", gap=4, pad=[2, 8, 2, 8], radius=999, fill="accentSoft")
        icon(s, "trail", 13, "accent")
        text(s, sitting, "caption", "accent")
        icon(s, "down", 11, "accent")
    for i, (kind, t, fork) in enumerate(steps):
        if i:
            icon(b, "right", 12, "muted")
        if folded and i == 1:
            fb = row(b, "folded", pad=[1, 6, 1, 6], radius=6, fill="sunken")
            text(fb, f"… {folded}", "caption", "muted")
            icon(b, "right", 12, "muted")
        last = i == len(steps) - 1
        st = row(b, f"step/{t}", gap=4, pad=[2, 6, 2, 6], radius=6, fill="surface" if last else None,
                 stroke="line" if last else None, sw=1 if last else None)
        if not compact or last or i == 0:
            icon(st, KIND[kind], 13, "accent" if (last or i == 0) else "muted")
            text(st, t, "smallStrong" if last else "small", "fg" if (last or i == 0) else "muted", maxLines=1)
        else:
            icon(st, KIND[kind], 13, "muted")
        if fork:
            frame(b, "fork", w=5, h=5, radius=3, fill="muted", W="fixed", H="fixed")
    spacer(b)
    if right:
        text(b, right, "caption", "muted")
    return b


def round2_shape(cv):
    r = row(cv, "shape", gap=64, align="min")
    f = Q.win(r, PG, "C13 · The top bar with the trail under it",
              "The top bar holds back and forward, the place, the command box and one More for the window (C5); the "
              "reader's tools (KJV, highlights, listen, find in chapter) sit at the box's end while the reader is in "
              "front. Under it, the trail line (minimize I2) is where c9a2 put the trail: the sitting, where it began, "
              "the way to here, forks marked. Panes keep their own folder tabs; the reader stays in the middle. The "
              "toolbar goes, with Customize toolbar… and Settings ▸ Toolbar (36d7, bc42).")
    w = K.app(f, bar=False)
    top_bar(f, w, W - w, line="Numbers 25")
    trail_line(f, w, W - w)
    pw = 420
    K.reader(f, w, W - w - pw, NUM25, "Numbers 25", top=TOP, width=560)
    body = M.pane(f, W - pw, TOP, pw, H - TOP, ["H7068", "Every use: zeal", "Search: “zeal of God”"],
                  "Search: “zeal of God”")
    para(body, "The search as it is today.", "small", "muted")
    K.note(f, "Gone: the toolbar, its catalog, Customize toolbar…, Settings ▸ Toolbar and the buttons in "
              "settings/toolbar.json. Panes are on the rail; window things in More.", w + 24, H - 110, 460)

    f = Q.win(r, PG, "C14 · The box keeps the line: tweak it and run again",
              "Click the box and the front tab's line is there to change (3a9f): “uses zeal” becomes "
              "“uses zeal gospels” without retyping. Enter changes that tab, and the trail gains a step; "
              "Alt+Enter opens a new tab beside it, a fork on the trail. Suggestions in plain words (C2) open under "
              "the box.")
    w = K.app(f, bar=False)
    top_bar(f, w, W - w, line="uses zeal gospels", tools=(), focused=True)
    trail_line(f, w, W - w, steps=PATH[:3], right="9 tabs · 1 fork")
    pw = 520
    K.reader(f, w, W - w - pw, NUM25, "Numbers 25", top=TOP, width=480)
    body = M.pane(f, W - pw, TOP, pw, H - TOP, ["H7068", "Every use: zeal"], "Every use: zeal")
    para(body, "The list as it is today.", "small", "muted")
    p = K.floating(f, "suggestions", w + 300, TB - 4, 620, gap=2)
    K.line(p, "Change this tab: every use of “zeal” in the Gospels", "uses zeal gospels", "list",
           right="Enter", on=True)
    K.line(p, "In a new tab", "uses zeal gospels", "plus", right="Alt+Enter")
    K.rule(p)
    group(p, "Look up")
    K.line(p, "Search the Gospels for zeal, zealous", "search zeal* gospels", "search")
    K.line(p, "“zeal” in the Concordance", "define zeal", "word")


def round2_conditions(cv):
    r = row(cv, "conditions", gap=64, align="min")
    f = Q.win(r, PG, "C15 · Among other panes, and a tab floating",
              "The Notebook open on the left, word studies on the right, a word card popped out over the reader. "
              "Each pane keeps its folder tabs; the trail line runs over all of them, because the trail is the "
              "order you went, not where a tab sits. Clicking a step brings its tab to the front wherever it is (and "
              "restores it if minimized). The box follows the pane last clicked: here, the reader.")
    w = K.app(f, on="Notebook", bar=False)
    top_bar(f, w, W - w, place="Psalms 106", line="Psalms 106")
    steps = [("verse", "Numbers 25:11", False), ("word", "H7068", True), ("verse", "Psalms 106:30", False)]
    trail_line(f, w, W - w, steps=steps, right="12 tabs · 1 fork")
    lw, rw = 300, 380
    nb = M.pane(f, w, TOP, lw, H - TOP, ["Zeal", "Notebook"], "Zeal", side="left")
    para(nb, "Your page, as today.", "small", "muted")
    K.reader(f, w + lw, W - w - lw - rw, PS106, "Psalms 106", top=TOP, width=520)
    body = M.pane(f, W - rw, TOP, rw, H - TOP, ["H7068", "H7065", "Every use: zeal"], "H7068")
    para(body, "The word study, as today.", "small", "muted")
    fl = K.floating(f, "floating tab", w + lw + 60, H - 250, 360, gap=8, pad=(0, 0, 12, 0))
    M.folder_strip(fl, ["H6372"], "H6372", actions=("dock", "close"), w=360)
    fb = col(fl, "body", pad=[0, 14, 0, 14], W="fill")
    para(fb, "The word card, floating; it is a step on the trail like any tab.", "caption", "muted")

    f = Q.win(r, PG, "C16 · Years of study: a long trail, earlier sittings",
              "Ninety steps today: the line keeps where it began and the last few, and folds the middle into "
              "“… 84”; a click opens the whole trail in the drawer (minimize N + O). The sitting chip "
              "opens earlier sittings, newest first, older days folded, so years of study never crowd the bar.")
    w = K.app(f, bar=False)
    top_bar(f, w, W - w, place="Malachi 2", line="Malachi 2")
    steps = [("verse", "Numbers 25:11", False), ("uses", "Every use: zeal", True), ("verse", "Romans 10:2", True),
             ("search", "Search: “covenant of peace”", False), ("verse", "Malachi 2:5", False)]
    trail_line(f, w, W - w, steps=steps, folded=84, right="90 steps · 41 tabs · 9 forks")
    K.reader(f, w, W - w, MAL2, "Malachi 2", top=TOP)
    m = K.floating(f, "sittings", w + 8, TOP - 2, 340, gap=2)
    group(m, "Today")
    K.line(m, "9:14 · Numbers 25:11", "90 steps · going", "trail", on=True)
    K.line(m, "7:02 · Psalms 1", "6 steps", "trail")
    group(m, "Earlier")
    K.line(m, "Yesterday · Romans 10:2", "kept as a page", "trail")
    K.line(m, "This week", "5 sittings", "down", muted=True)
    K.line(m, "2025", "312 sittings, compacted", "down", muted=True)
    K.rule(m)
    K.line(m, "Show the whole trail", None, "panel")

    f = Q.win(r, PG, "C17 · Narrow: half a screen", w=720,
              about="At half the screen the place button folds into the box (it holds the place anyway), the reader's "
              "tools go into More, and the trail line keeps where it began and where you are, the steps between as "
              "icons.")
    w = K.app(f, bar=False)
    top_bar(f, w, 720 - w, line="Numbers 25", tools=(), compact=True)
    trail_line(f, w, 720 - w, compact=True, right=None)
    K.reader(f, w, 720 - w, NUM25, "Numbers 25", top=TOP, width=560)


def round2_open(cv):
    r = row(cv, "open", gap=64, align="min")
    f = Q.win(r, PG, "C18 · Open question: the box popped off the bar (c567)",
              "Drag the box by its grip and it floats where you put it, keeping its line; the top bar keeps back, "
              "forward, the place and More, and the trail line stays. Double-click the grip to put it back. Drawn to "
              "ask whether this is still wanted with this bar.")
    w = K.app(f, bar=False)
    top_bar(f, w, W - w, box=False)
    trail_line(f, w, W - w)
    K.reader(f, w, W - w, NUM25, "Numbers 25", top=TOP)
    box = K.floating(f, "floating box", w + 300, H - 120, 560, gap=0, pad=(6, 8, 6, 12), r=999)
    br = row(box, "box", gap=8, W="fill")
    icon(br, "drag", 16, "muted")
    text(br, "Numbers 25", "body", W="fill")
    P.kbd(br, "`")


def sheets(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Top bar and the command box, round 2: the trail under the bar",
                  "c9a2, redrawn 2026-11-13: the toolbar goes; the top bar is back, forward, the place, the command box "
                  "(which keeps its line, 3a9f) and More; the trail line from minimize (I2) sits under it. Panes keep "
                  "their folder tabs and the reader stays in the middle. C13 the shape; C14 the box keeps the line; "
                  "C15-C17 the real conditions; C18 the box popped off (c567), an open question.")
    round2_shape(cv)
    round2_conditions(cv)
    round2_open(cv)
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Top bar and the command box, round 1",
                  "Today (C1); A, the field suggests in plain words and narrows with chips (C2, C3); B, kept commands "
                  "move to the rail and one ⋯ holds the app's full screen (C4, C5). A and B can go together.")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Command", sheets)
