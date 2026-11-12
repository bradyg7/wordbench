"""Highlights and the palette, round 1: the five colors, the saved custom colors and the Highlights switch, drawn for the
first time in design/features/, inside the evolving app (the rail and trail from minimize, the reader's click from
reader). It asks whether a color can mean something (b99f), whether highlights can be layered by year of reading and
shown or hidden by layer (ad4c, 0590, 64f0), and whether every color has a light and a dark form, custom ones included
(31da). Nothing is built from this until the person accepts it. Scripture is fetched from the database with `wb text`;
the color names and layers are a drawn sample, not anyone's study.

    python design/features/highlights/highlights.py
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
REPO = LIB.parent
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE.parent / "minimize"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
from figlib import S, col, frame, icon, para, row, shadow, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Highlights"
PG = "Highlights"
PW = 420

# the five named colors (tokens with a light and a dark form) and two saved custom colors (hex, light form only today)
NAMED = ["yellow", "green", "blue", "pink", "orange"]
CUSTOM = [("#E3D3F2", "#3B2A4A"), ("#CDEBE6", "#1F3D38")]  # (light, dark): today only the first is kept
# a sample of meanings and layers, drawn for the sheets
MEANS = {"yellow": "Promises", "green": "Commands", "blue": "Places", "pink": "", "orange": ""}
MARKS_2025 = {3: {"hl": "blue"}, 7: {"hl": "green"}}
MARKS_2026 = {5: {"hl": "yellow"}, 9: {"hl": "yellow"}, 8: {"hl": "green"}}


def wb(*args):
    exe = REPO / "target" / "release" / "wb.exe"
    if not exe.exists():
        exe = REPO / "target" / "debug" / "wb.exe"
    env = dict(os.environ)
    env.setdefault("WB_BIBLE_DB", str(REPO.parent / "bible-workbench" / "datasets" / "workbench.db"))
    out = subprocess.run([str(exe), *args], capture_output=True, text=True, encoding="utf-8", env=env, check=True)
    return out.stdout


def chapter(ref):
    vs = []
    for ln in wb("text", ref).splitlines()[1:]:
        m = re.match(r"(\d+) (.*)", ln)
        if m:
            vs.append({"v": int(m.group(1)), "text": m.group(2)})
    return vs


JOSH1 = chapter("Josh 1:1-9")
VERSE = {v["v"]: v["text"] for v in JOSH1}


def floating(f, name, x, y, w, pad=(12, 14, 12, 14), gap=8, r=12):
    p = col(f, name, gap=gap, pad=list(pad), fill="surface", radius=r, stroke="line", sw=1, W="fixed")
    Q.put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def reader(f, x, w, marks, title="Joshua 1", top=TB, sel=None):
    rd = frame(f, "reader", x=x, y=top, w=w, h=H - top, layout="vertical", crossAlign="center", pad=[32, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": min(680, w - 64)}}, ref=False)
    text(inner, title, "chapter", fontSize=30, lineHeight="40px")
    F.verses(inner, JOSH1, "readDesk", marks, selected=sel)
    return rd, inner


def swatch(parent, color, size=22, on=False):
    fill = F.HL.get(color, color)
    s = frame(parent, f"swatch/{color}", w=size, h=size, radius=size / 2, fill=fill, stroke="accent" if on else "line",
              sw=2 if on else 1, W="fixed", H="fixed")
    return s


def eye(parent, on):
    icon(parent, "eye", 18, "fg" if on else "muted")
    if not on:
        text(parent, "hidden", "caption", "muted")


def base(f, marks, pane=None):
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rw = W - w - (PW if pane else 0)
    rd = reader(f, w, rw, marks)
    if pane:
        return w, rd, M.pane(f, W - PW, TB, PW, H - TB, pane[0], pane[1])
    return w, rd, None


def both(a, b):
    m = {k: dict(v) for k, v in a.items()}
    m.update(b)
    return m


# ---- R1 today ---------------------------------------------------------------------------------------------------------

def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "R1 · Today: five colors, eight saved, one switch",
              "As built: a click on a verse number opens the color bar with yellow, green, blue, pink and orange, then "
              "the saved custom colors (settings/palette.json, c1..c8, one hex each). A highlight keeps its color and "
              "nothing else. The Highlights switch hides every fill at once, but nothing tells which colors mean what. "
              "A custom color is one hex, so a dark one picked in dark mode stays dark in light mode (31da). "
              "Findings 0590, b99f, ad4c, 31da.")
    w, rd, _ = base(f, both(MARKS_2025, MARKS_2026), )
    bar = row(f, "color bar", gap=8, pad=[8, 12, 8, 12], fill="surface", radius=12, stroke="line", sw=1)
    Q.put(bar, w + 120, TB + 200)
    shadow(bar, 8, 28, "#00000033")
    for c in NAMED:
        swatch(bar, c)
    frame(bar, "rule", w=1, h=20, fill="line", W="fixed", H="fixed")
    for lt, _dk in CUSTOM:
        swatch(bar, lt)
    P.icon_button(bar, "plus", "muted", size=28, icon_size=16)
    frame(bar, "rule", w=1, h=20, fill="line", W="fixed", H="fixed")
    text(bar, "Note · Question · Thread · Copy · ⋯", "small", "muted")
    sw = floating(f, "highlights switch", W - 300, TB + 16, 260)
    rr = row(sw, "switch", gap=10, W="fill")
    icon(rr, "highlight", 18)
    text(rr, "Highlights", "smallStrong", W="fill")
    P.chip(rr, "Shown", "selected")
    text(sw, "One switch for every fill.", "caption", "muted")


# ---- A: a color can mean something -------------------------------------------------------------------------------------

def direction_a(cv):
    r = row(cv, "direction A", gap=64, align="min")
    f = Q.win(r, PG, "R2 · A: a color can carry a name",
              "The colors beside a selection are the same five and the saved ones, each with its own name when you give "
              "it one (Promises, Commands). A name is kept with the palette, not with each highlight, so renaming a "
              "color renames all its verses. A color with no name is just a color. b99f.")
    w, rd, _ = base(f, MARKS_2026, )
    pop = floating(f, "colors with names", w + 150, TB + 230, 300, gap=4)
    for c in NAMED:
        it = row(pop, f"color/{c}", gap=10, pad=[6, 4, 6, 4], W="fill", fill="accentSoft" if c == "yellow" else None,
                 radius=8)
        swatch(it, c, 18)
        text(it, MEANS[c] or "Name this color", "small", "fg" if MEANS[c] else "muted", W="fill")
        text(it, {"yellow": "41", "green": "17", "blue": "6"}.get(c, ""), "caption", "muted")
    frame(pop, "rule", w=10, h=1, fill="line", W="fill", H="fixed")
    for i, (lt, _dk) in enumerate(CUSTOM):
        it = row(pop, f"custom {i + 1}", gap=10, pad=[6, 4, 6, 4], W="fill")
        swatch(it, lt, 18)
        text(it, ["Names of God", "Name this color"][i], "small", "fg" if i == 0 else "muted", W="fill")
    text(pop, "Right click a color to rename it", "caption", "muted")

    f = Q.win(r, PG, "R3 · A: the Highlights pane lists verses by color",
              "Highlights opens as a pane: every color with its name and how many verses, opened to the verses in Bible "
              "order (wb hl list --color). A click goes to the verse. Where a color overlaps a thread (b99f): a color is "
              "quick and has no text; a thread has order and a note. Make a thread from these turns a color's verses "
              "into a thread, and the highlights stay.")
    w, rd, b = base(f, MARKS_2026, (["Notebook", "Highlights"], "Highlights"))
    head = row(b, "filter", gap=8, W="fill")
    P.segmented(head, ["By color", "In order"], "By color")
    for c in ["yellow", "green", "blue"]:
        g = col(b, f"group/{c}", gap=8, pad=[10, 12, 10, 12], radius=10, stroke="line", sw=1, W="fill")
        hd = row(g, "head", gap=10, W="fill")
        swatch(hd, c, 16)
        text(hd, MEANS[c], "smallStrong", W="fill")
        text(hd, {"yellow": "41 verses", "green": "17 verses", "blue": "6 verses"}[c], "caption", "muted")
        icon(hd, "down" if c == "yellow" else "right", 16, "muted")
        if c == "yellow":
            for v in (5, 9):
                it = col(g, f"Joshua 1:{v}", gap=2, W="fill")
                text(it, f"Joshua 1:{v}", "caption", "accent")
                text(it, VERSE[v], "small", W="fill")
            text(g, "39 more", "caption", "muted")
            P.button(g, "Make a thread from these", "secondary", "threads", size="sm")


# ---- B: layers -----------------------------------------------------------------------------------------------------------

def marks_panel(f, x, y, shown_2025):
    p = floating(f, "marks panel", x, y, 300, gap=6)
    text(p, "Marks", "smallStrong")
    text(p, "Highlights by layer", "caption", "muted")
    for name, n, on in [("2026 reading", 3, True), ("2025 reading", 2, shown_2025), ("No layer", 0, True)]:
        it = row(p, f"layer/{name}", gap=10, pad=[4, 4, 4, 4], W="fill")
        icon(it, "layers", 16, "muted")
        text(it, name, "small", W="fill")
        text(it, f"{n} here", "caption", "muted")
        eye(it, on)
    P.button(p, "New layer", "ghost", "plus", size="sm")
    frame(p, "rule", w=10, h=1, fill="line", W="fill", H="fixed")
    text(p, "Every kind of mark", "caption", "muted")
    for name, ic in [("Highlights", "highlight"), ("Thread bars", "threads"), ("Page marks", "notebook"),
                     ("Questions", "question"), ("Margin", "more")]:
        it = row(p, f"kind/{name}", gap=10, pad=[4, 4, 4, 4], W="fill")
        icon(it, ic, 16, "muted")
        text(it, name, "small", W="fill")
        eye(it, True)
    return p


def direction_b(cv):
    r = row(cv, "direction B", gap=64, align="min")
    f = Q.win(r, PG, "R5 · B: which layer a new highlight goes in",
              "The colors beside a selection say which layer they write to, and a click changes it for the rest of the "
              "session. A new year asks once, on the first highlight after 1 January: start 2027 reading, or keep "
              "2026. A layer is a field on the highlight (layer: \"2026 reading\"), one the Python app passes over.")
    w, rd, _ = base(f, both(MARKS_2025, MARKS_2026))
    bar = col(f, "colors and layer", gap=8, pad=[10, 12, 10, 12], fill="surface", radius=12, stroke="line", sw=1,
              W="hug")
    Q.put(bar, w + 120, TB + 380)
    shadow(bar, 8, 28, "#00000033")
    cs = row(bar, "colors", gap=8)
    for c in NAMED:
        swatch(cs, c, on=c == "yellow")
    ly = row(bar, "layer", gap=8)
    icon(ly, "layers", 16, "muted")
    text(ly, "Into", "caption", "muted")
    P.chip(ly, "2026 reading", "selected")
    icon(ly, "down", 14, "muted")
    ask = floating(f, "new year", W - 360, H - 200, 320)
    text(ask, "A new year of reading?", "smallStrong")
    text(ask, "Highlights so far this year go in 2026 reading.", "caption", "muted")
    bt = row(ask, "choices", gap=8)
    P.button(bt, "Start 2027 reading", "primary", size="sm")
    P.button(bt, "Keep 2026", "secondary", size="sm")


# ---- C: colors that follow the theme --------------------------------------------------------------------------------

def direction_c(cv):
    r = row(cv, "direction C", gap=64, align="min")
    f = Q.win(r, PG, "R6 · C: every color has a light and a dark form",
              "Settings › Colors shows each color as a pair. The five named ones already are; a custom color is now "
              "saved as a pair too: you pick it in either mode and its other form is worked out (the same hue, the "
              "other lightness), and you can change it. E-ink keeps its grey. Old one-hex colors read as their light "
              "form, and the dark form is worked out on opening. 31da.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    p = floating(f, "colors", w + 80, TB + 40, 620, pad=(18, 20, 18, 20), gap=10)
    text(p, "Colors", "chapter", fontSize=22, lineHeight="30px")
    hd = row(p, "head", gap=16, W="fill")
    text(hd, "", "caption", W="fill")
    for m in ("Light", "Dark", "E-ink"):
        cell = row(hd, m, w=56, W="fixed", mainAlign="center")
        text(cell, m, "caption", "muted")
    pairs = [(c, F.COLORS[F.HL[c]]) for c in NAMED]
    for c, (lt, dk, ek, _a) in pairs:
        it = row(p, f"pair/{c}", gap=16, W="fill")
        text(it, (MEANS[c] or c.title()) + ("" if not MEANS[c] else f"  ·  {c}"), "small", W="fill")
        for hx in (lt, dk, ek):
            frame(it, "form", w=56, h=24, radius=6, fill=hx, stroke="line", sw=1, W="fixed", H="fixed")
    frame(p, "rule", w=10, h=1, fill="line", W="fill", H="fixed")
    for i, (lt, dk) in enumerate(CUSTOM):
        it = row(p, f"custom {i + 1}", gap=16, W="fill")
        text(it, ["Names of God", "Custom 2"][i], "small", W="fill")
        frame(it, "light", w=56, h=24, radius=6, fill=lt, stroke="line", sw=1, W="fixed", H="fixed")
        frame(it, "dark", w=56, h=24, radius=6, fill=dk, stroke="accent" if i == 0 else "line", sw=2 if i == 0 else 1,
              W="fixed", H="fixed")
        frame(it, "e-ink", w=56, h=24, radius=6, fill="#D9D9D9", stroke="line", sw=1, W="fixed", H="fixed")
    note = row(p, "worked out", gap=8)
    icon(note, "check", 16, "ok")
    text(note, "Dark form worked out from the light one. Click to change it.", "caption", "muted")
    P.button(p, "Add a color", "secondary", "plus", size="sm")

    f = Q.win(r, PG, "R7 · C: the same chapter in dark mode", "The reader in dark mode: every highlight, custom ones "
              "included, is drawn in its dark form, and switching back draws the light form. 31da.", m="Dark")
    base(f, both(MARKS_2025, MARKS_2026))


# ==== Round 2 (2026-11-12): highlights as wallpaper =================================================================
# From marks round 5 (M36): after fifteen years nearly every verse is colored, and a color that is everywhere says
# nothing. Drawn on John 3 with a projected 18,000 highlights (not the person's data). Scripture is fetched.

sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402

JOHN3 = K.verses_of(K.fetch(HERE, "john3-14-21", ["text", "John 3:14-21"], as_json=False))
# faded forms of the five colors (an older layer, or a color not in the lens): drawn, not yet tokens
F.HL.update({"fy": "#FAF3DA", "fg_": "#E9F2E3", "fb": "#E6EEF8", "fp": "#F8E6EC", "fo": "#FBE9DA"})
FADE = {"yellow": "fy", "green": "fg_", "blue": "fb", "pink": "fp", "orange": "fo"}
WALL = {14: ("yellow", 2031), 15: ("yellow", 2041), 16: ("green", 2027), 17: ("blue", 2035), 18: ("pink", 2041),
        19: ("orange", 2029), 20: ("yellow", 2038), 21: ("green", 2041)}
MEAN = {"yellow": "Promises", "green": "Gospel", "blue": "Sending", "pink": "Belief", "orange": "Light and darkness"}


def wall(rule=lambda v, c, y: c):
    out = {}
    for v, (c_, y) in WALL.items():
        got = rule(v, c_, y)
        if got:
            out[v] = {"hl": got}
    return out


def _john(f, x, w, marks, top=TB):
    rd = frame(f, "reader", x=x, y=top, w=w, h=H - top, layout="vertical", crossAlign="center", pad=[32, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": min(640, w - 64)}}, ref=False)
    text(inner, "John 3", "chapter", fontSize=30, lineHeight="40px")
    F.verses(inner, JOHN3, "readDesk", marks)
    return inner


def side(f, title, rows_, w=300):
    p = floating(f, title, W - w - 24, TB + 16, w, gap=6)
    text(p, title, "smallStrong")
    for ic, label, right, on in rows_:
        it = row(p, label, gap=10, pad=[4, 4, 4, 4], W="fill", fill="accentSoft" if on else None, radius=6)
        if ic.startswith("sw:"):
            swatch(it, ic[3:], 16)
        else:
            icon(it, ic, 16, "muted")
        text(it, label, "small", W="fill")
        if right:
            text(it, right, "caption", "muted")
    return p


def round2(board):
    cv = Q.section(board, "When everything is colored", 3200)
    Q.sheet_title(cv, "When everything is colored (round 2)",
                  "Marks round 5 found highlights turn into wallpaper after years (M36). Today, at 18,000 highlights "
                  "(H8); A, a lens: one meaning at a time (H9); B, this year's reading only (H10); C, older highlights "
                  "fade like ink (H11); D, a quiet reading mode with color in the gutter (H12); E, a verse marked in "
                  "many layers (H13). They can go together; H14 proposes how.")
    r = row(cv, "a", gap=64, align="min")
    f = Q.win(r, PG, "H8 · The wallpaper: fifteen years of color",
              "Every verse of John 3:14-21 colored, by five meanings across fifteen years. Nothing stands out, so "
              "nothing is said; the text is harder to read than plain.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    _john(f, w, W - w, wall())

    f = Q.win(r, PG, "H9 · A, a lens: one meaning at a time",
              "The marks panel's colors, by their names, can be chosen as a lens: Promises only. Its verses keep "
              "their full color; every other highlight drops to a faint wash, still there, no longer loud. Esc (or "
              "the lens again) gives everything back.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    _john(f, w, W - w - 340, wall(lambda v, c_, y: c_ if c_ == "yellow" else FADE[c_]))
    side(f, "Lens", [("sw:" + c_, MEAN[c_], {"yellow": "2,140"}.get(c_, ""), c_ == "yellow")
                     for c_ in ("yellow", "green", "blue", "pink", "orange")] + [("eye", "Everything", "", False)])

    f = Q.win(r, PG, "H10 · B, this year's reading only",
              "Highlights belong to a year of reading (round 1, B). Showing 2041 only: what you marked this time "
              "through, on a clean page; earlier years are a click away in the marks panel.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    _john(f, w, W - w - 340, wall(lambda v, c_, y: c_ if y == 2041 else None))
    side(f, "Layers", [("layers", "2041 reading", "3 here", True), ("layers", "2038 reading", "1 here", False),
                       ("layers", "2035 reading", "1 here", False), ("layers", "2027–2031", "3 here", False)])

    r = row(cv, "b", gap=64, align="min")
    f = Q.win(r, PG, "H11 · C, older highlights fade",
              "As ink fades on paper: this year's highlights are full, older ones paler with each year, never gone. "
              "The page shows where your attention is now without hiding where it was. One switch turns fading off.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    _john(f, w, W - w, wall(lambda v, c_, y: c_ if y >= 2038 else FADE[c_]))

    f = Q.win(r, PG, "H12 · D, a quiet reading mode",
              "Reading, not studying: the words are plain and each highlight is a short bar of its color in the "
              "gutter beside its verse. Select or hover a verse and its colors come back on the words. Study mode "
              "is today's. One key (Q) switches.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rd = frame(f, "reader", x=w, y=TB, w=W - w, h=H - TB, layout="vertical", crossAlign="center", pad=[32, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=10, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": 680}}, ref=False)
    hd = row(inner, "head", gap=12, W="fill")
    text(hd, "John 3", "chapter", fontSize=30, lineHeight="40px", W="fill")
    P.segmented(hd, ["Reading", "Study"], "Reading", W="hug")
    for v in JOHN3:
        it = row(inner, f"v{v['v']}", gap=10, align="min", W="fill")
        c_ = WALL[v["v"]][0]
        frame(it, "gutter bar", w=4, h=22, radius=2, fill=F.HL[c_], W="fixed", H="fixed")
        F.verses(it, [v], "readDesk", {})

    f = Q.win(r, PG, "H13 · E, a verse marked in many layers",
              "John 3:16 highlighted in four years, in three colors. The words show the newest (or the lens's); the "
              "gutter shows a small stack, one tick per layer, oldest at the bottom. Hover lists them with their "
              "years and names.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    inner = _john(f, w + 30, W - w - 30, wall())
    st = col(f, "stack", gap=2, W="hug")
    Q.put(st, w + (W - w - 30 - 640) // 2 + 14, TB + 168)
    for c_ in ("green", "yellow", "green", "pink"):
        frame(st, "tick", w=8, h=4, radius=1, fill=F.HL[c_], W="fixed", H="fixed")
    h_ = floating(f, "layers here", w + 30, TB + 220, 260, gap=4)
    text(h_, "John 3:16 · 4 layers", "smallStrong")
    for y, c_ in (("2041", "green"), ("2038", "pink"), ("2031", "yellow"), ("2027", "green")):
        it = row(h_, y, gap=8)
        swatch(it, c_, 14)
        text(it, f"{y} · {MEAN[c_]}", "caption")

    r = row(cv, "c", gap=64, align="min")
    f = Q.win(r, PG, "H14 · Proposed together: quiet by default, lenses to study",
              "Reading mode (D) is where you start: plain words, color in the gutter. Study mode shows the color on "
              "the words, this year's in full and older faded (B with C), with the lens (A) for one meaning. The "
              "stack (E) appears only where a verse has more than one layer. Nothing is deleted at any step.")
    body = col(f, "body", gap=18, pad=[56, 64, 56, 64], W="fixed", H="fixed")
    Q.put(body, 0, 0, W, H)
    for title_, about in (("Reading (default)", "Plain words; each verse's colors as a gutter bar (D). Hover or select brings them onto the words."),
                          ("Study", "Colors on the words. This year's reading full, older years faded (B + C). Layers listed with an eye each."),
                          ("Lens", "In Study, choose one named color: it stays full, everything else faint (A). Esc to leave."),
                          ("Many layers", "Only where a verse has more than one: a small stack in the gutter (E); hover lists them.")):
        it = col(body, title_, gap=4, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface", W="fill")
        text(it, title_, "heading")
        para(it, about, "small", "muted")


# ==== Round 3 (2026-11-12): seeing the layers ========================================================================
# The person: how do I see what the layers of my highlights look like? Layers do not exist in the app yet; this round
# designs them as a whole: two years side by side, a year slider, a layers overview, one layer opened alone.

YEARS = {2027: {16: "green", 21: "green"}, 2031: {14: "yellow", 16: "yellow", 19: "orange"},
         2038: {16: "pink", 20: "yellow", 17: "blue"}, 2041: {15: "yellow", 16: "green", 18: "pink", 21: "green"}}


def upto(year):
    out = {}
    for y in sorted(YEARS):
        if y <= year:
            for v, c_ in YEARS[y].items():
                out[v] = {"hl": c_}
    return out


def only(year):
    return {v: {"hl": c_} for v, c_ in YEARS[year].items()}


def mini_reader(parent, title, marks, w):
    c = col(parent, title, gap=8, pad=[16, 18, 16, 18], radius=12, fill="bg", stroke="line", sw=1, W="fixed")
    S.do("node.set", {"ids": [c], "props": {"width": w}}, ref=False)
    hd = row(c, "head", gap=8, W="fill")
    text(hd, title, "heading", W="fill")
    F.verses(c, JOHN3, "readSmall", marks)
    return c


def slider(parent, years, on, w=None):
    tl = row(parent, "years", gap=0, W="fill", align="min")
    for y in years:
        ev = col(tl, str(y), gap=6, W="fill", crossAlign="center")
        track = row(ev, "track", gap=0, W="fill", align="center")
        frame(track, "seg", w=10, h=2, fill="line", W="fill", H="fixed")
        F.dot(track, "accent" if y == on else "muted", 16 if y == on else 10)
        frame(track, "seg", w=10, h=2, fill="line", W="fill", H="fixed")
        text(ev, str(y), "smallStrong" if y == on else "caption", "accent" if y == on else "muted")
    return tl


def round3(board):
    cv = Q.section(board, "Layers", 3200)
    Q.sheet_title(cv, "Seeing the layers (round 3)",
                  "How your highlights look layer by layer, which the app cannot show today. Two years side by side "
                  "(H15); a year slider under the chapter (H16, H17); a layers overview (H18); one layer opened alone "
                  "(H19). Drawn on John 3:14-21 with a sample of four years of reading.")
    r = row(cv, "compare", gap=64, align="min")
    f = Q.win(r, PG, "H15 · Two years side by side",
              "Compare layers (in the marks panel's ⋯): the chapter twice, as you marked it in each year you choose. "
              "Scrolling one scrolls the other. A verse marked in one and not the other is easy to see; the count "
              "under each says how many.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    body = row(f, "compare", gap=24, pad=[24, 24, 24, 24], align="min", W="fixed", H="fixed")
    Q.put(body, w, TB, W - w, H - TB)
    half = (W - w - 72) // 2
    for y in (2031, 2041):
        c = mini_reader(body, f"{y} reading", only(y), half)
        hd = row(c, "pick", gap=6)
        text(hd, f"{len(YEARS[y])} highlights in this chapter", "caption", "muted")
        P.button(hd, "Change year", "ghost", "down", size="sm")

    f = Q.win(r, PG, "H16 · A year slider under the chapter",
              "A thin line of your years of reading under the chapter title. Drag (or ← →) and the text redraws as "
              "it stood at the end of that year: every highlight made up to then. It is a way of looking only; "
              "nothing changes until you let go, and letting go changes nothing either.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rd = frame(f, "reader", x=w, y=TB, w=W - w, h=H - TB, layout="vertical", crossAlign="center", pad=[24, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=10, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": 680}}, ref=False)
    text(inner, "John 3", "chapter", fontSize=30, lineHeight="40px")
    sl = col(inner, "slider", gap=4, pad=[8, 12, 8, 12], radius=10, fill="sunken", W="fill")
    hd = row(sl, "head", gap=8, W="fill")
    icon(hd, "layers", 14, "muted")
    text(hd, "As it stood at the end of 2031", "caption", "fg", W="fill")
    text(hd, "Esc: now", "caption", "muted")
    slider(sl, (2027, 2031, 2038, 2041), 2031)
    F.verses(inner, JOHN3, "readDesk", upto(2031))

    f = Q.win(r, PG, "H17 · The slider at now",
              "The same chapter at the right end of the line: everything, each verse in its newest color. Between "
              "H16 and H17 is how your reading of the chapter grew; a verse that changed color changed meaning to "
              "you that year.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rd = frame(f, "reader", x=w, y=TB, w=W - w, h=H - TB, layout="vertical", crossAlign="center", pad=[24, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=10, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": 680}}, ref=False)
    text(inner, "John 3", "chapter", fontSize=30, lineHeight="40px")
    sl = col(inner, "slider", gap=4, pad=[8, 12, 8, 12], radius=10, fill="sunken", W="fill")
    hd = row(sl, "head", gap=8, W="fill")
    icon(hd, "layers", 14, "muted")
    text(hd, "Now", "caption", "fg", W="fill")
    slider(sl, (2027, 2031, 2038, 2041), 2041)
    F.verses(inner, JOHN3, "readDesk", upto(2041))

    r = row(cv, "overview", gap=64, align="min")
    f = Q.win(r, PG, "H18 · Your layers, as a whole",
              "Highlights › Layers: each year of reading as a row: how many highlights, its colors in proportion, the "
              "books it touched most, and an eye. A row opens that layer alone (H19). New layer and Merge are here; a "
              "highlight with no layer sits in No layer.")
    w = M.rail5(f, on="Highlights")
    M.slim_bar(f, x=w, w=W - w)
    p = col(f, "layers", gap=12, pad=[24, 28, 24, 28], W="fixed", H="fixed")
    Q.put(p, w, TB, W - w, H - TB)
    text(p, "Layers", "title")
    para(p, "Each year of reading, and what you marked in it", "small", "muted")
    for name, n, mix, books, on in (("2041 reading", 1240, [("green", 5), ("yellow", 3), ("pink", 2)],
                                     "John · Romans · Psalms", True),
                                    ("2038 reading", 2010, [("yellow", 4), ("blue", 3), ("pink", 3)],
                                     "Isaiah · Hebrews · John", True),
                                    ("2031 reading", 3380, [("yellow", 6), ("orange", 2), ("green", 2)],
                                     "Genesis · Psalms · Matthew", False),
                                    ("2027 reading", 2950, [("green", 7), ("blue", 3)], "Romans · John · Acts", False),
                                    ("No layer", 420, [("yellow", 5), ("green", 5)], "older highlights", True)):
        it = row(p, name, gap=16, pad=[12, 14, 12, 14], radius=10, stroke="line", sw=1, fill="surface", W="fill")
        icon(it, "layers", 18, "muted")
        tc = col(it, "name", gap=2, W="fixed")
        S.do("node.set", {"ids": [tc], "props": {"width": 200}}, ref=False)
        text(tc, name, "bodyStrong")
        text(tc, f"{n:,} highlights", "caption", "muted")
        bar = row(it, "mix", gap=0, W="fixed", radius=4, clip=True)
        S.do("node.set", {"ids": [bar], "props": {"width": 260}}, ref=False)
        total = sum(pt for _, pt in mix)
        for c_, part in mix:
            frame(bar, c_, w=round(260 * part / total), h=12, fill=F.HL[c_], W="fixed", H="fixed")
        text(it, books, "small", "muted", W="fill")
        icon(it, "eye", 18, "fg" if on else "muted")
    b = row(p, "buttons", gap=8)
    P.button(b, "New layer", "secondary", "plus", size="sm")
    P.button(b, "Merge two layers", "ghost", size="sm")
    P.button(b, "Compare two years", "ghost", size="sm")

    f = Q.win(r, PG, "H19 · One layer opened alone",
              "2031 reading opened from H18: its highlights only, in the reader, with a band saying so and where to "
              "go back. The left list walks its chapters in order, so a year of marking can be read through again.")
    w = M.rail5(f, on="Highlights")
    M.slim_bar(f, x=w, w=W - w)
    lst = col(f, "chapters", gap=2, pad=[16, 12, 16, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(lst, w, TB, 260, H - TB)
    text(lst, "2031 READING · 3,380", "label", "muted")
    for ch, n, on in (("Genesis 1", 14, False), ("Psalms 23", 6, False), ("Matthew 5", 22, False),
                      ("John 3", 3, True), ("Romans 8", 19, False)):
        it = row(lst, ch, gap=8, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if on else None)
        text(it, ch, "small", W="fill")
        text(it, str(n), "caption", "muted")
    band = row(f, "band", gap=10, pad=[8, 16, 8, 16], fill="accentSoft", W="fixed", H="fixed")
    Q.put(band, w + 260, TB, W - w - 260, 40)
    icon(band, "layers", 16, "accent")
    text(band, "Showing 2031 reading only", "smallStrong", "accent", W="fill")
    P.button(band, "Show everything", "ghost", size="sm")
    _john(f, w + 260, W - w - 260, only(2031), top=TB + 40)


def sheets(board):
    """The leading windows only, grouped by part (the person, 2026-11-12). R4 (superseded by H10 and H18) is in git
    history (commit 0d59600) and listed in the README's Leading table."""
    cv = Q.section(board, "Colors", 3200)
    Q.sheet_title(cv, "Colors: today, names, and a light and a dark form",
                  "Today (R1); a color can carry a name and the Highlights pane lists verses by color (R2, R3); every "
                  "color, custom ones too, has a light and a dark form (R6, R7).")
    today(cv)
    direction_a(cv)
    direction_c(cv)
    round3(board)
    cv = Q.section(board, "A new highlight's layer", 3200)
    Q.sheet_title(cv, "Which layer a new highlight goes in", "R5, beside the layers above.")
    direction_b(cv)
    round2(board)


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "highlights.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "highlights.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    # no all.png: the board is read window by window (the person, 2026-11-12)
    tmp = build / "highlights-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window\W+([A-Z]+\d+)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
