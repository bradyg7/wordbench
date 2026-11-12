"""Minimized panes, redrawn on the app as it is now (toolbar, reader, dock chrome, colors and pane titles from ui/src).

One look for a minimized group wherever it waits: the reader's tray row (floats and bands), the column foot (one part of
a split column) and the rail (a whole column). Nothing is built from this until the person accepts it.

    python design/features/minimize/minimize.py   # writes minimize.figcraft and exports/*.png beside it
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent  # this feature folder
LIB = HERE.parents[1]  # design/: figlib, parts, build, phase2b
sys.path.insert(0, str(LIB))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
from figlib import S, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
C = B.C
BOARD = "Minimize"
PG = "Minimized panes"
TRAY = 44
RAIL = 44
# a window glyph: the restore mark (today's chips and bars use the float icon, which reads as "float it")
F.ICONS.setdefault("restore", "M4.5 6.5h15v11h-15zM4.5 9.5h15")


def toolbar(f, w=W):
    bar = row(f, "toolbar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, 0, 0, w, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "fg")
    text(pl, "Numbers 25", "bodyStrong")
    icon(pl, "down", 14, "muted")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1,
              W="fixed", H="fixed")
    Q.put(cmd, 0, 0, min(460, int(w * 0.32)), 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "Search, go to a place, or type a command", "small", "muted", W="fill", maxLines=1)
    P.kbd(cmd, "`")
    spacer(bar)
    tools = row(bar, "tools", gap=4)
    text(tools, "KJV", "smallStrong")
    P.tool(tools, "Notebook", "notebook")
    P.tool(tools, "Shelf", "shelf")
    P.tool(tools, "Highlights", "highlight", caret=True)
    P.icon_button(tools, "more", "fg", size=34, icon_size=20)
    return bar


# ---- the one item ----------------------------------------------------------------------------------------------------
def item(parent, title, more=0, state="default", host=None, w=None):
    fill, stroke, sw = {"default": ("surface", "line", 1), "hover": ("accentSoft", "line", 1),
                        "focus": ("surface", "accent", 2)}[state]
    it = row(parent, f"min item/{title}", gap=7, pad=[5, 8, 5, 8], radius=8, fill=fill, stroke=stroke, sw=sw,
             W="fixed" if w else "hug")
    if w:
        Q.put(it, 0, 0, w)
    icon(it, "restore", 15, "accent")
    label = f"{title} ({host})" if host else title
    text(it, label, "smallStrong", "fg", W="fill" if w else "hug", maxLines=1)
    if more:
        bd = row(it, "more tabs", pad=[0, 6, 0, 6], fill="sunken", radius=999)
        text(bd, f"+{more}", "caption", "muted", fontSize=11, lineHeight="16px")
    return it


def link(parent, s):
    text(parent, s, "smallStrong", "accent")


def tray(f, x, w, items, overflow=None):
    """The reserved row at the reader's foot: verses end above it, never under it."""
    t = row(f, "tray", gap=8, pad=[0, 12, 0, 16], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeTopWeight=1, strokeBottomWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(t, x, H - TRAY, w, TRAY)
    text(t, "Minimized", "caption", "muted")
    for args in items:
        item(t, *args)
    if overflow:
        o = item(t, f"{overflow} minimized", state="focus")
        icon(o, "down", 14, "muted")
    spacer(t)
    link(t, "Restore all")
    return t


def rail(f, groups, active=None):
    r = col(f, "rail", gap=8, pad=[10, 6, 10, 6], fill="sunken", W="fixed", H="fixed", crossAlign="center",
            stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(r, W - RAIL, TB, RAIL, H - TB)
    for n, on in groups:
        b = frame(r, f"rail/{n}", w=30, h=30, radius=8, fill="accentSoft" if on else "surface",
                  stroke="accent" if on else "line", sw=1.5 if on else 1, W="fixed", H="fixed", layout="vertical",
                  mainAlign="center", crossAlign="center")
        icon(b, "restore", 16, "accent")
    return r


def note(parent, s, x, y, w=560):
    n = row(parent, "design note", gap=10, x=x, y=y, W="fixed", align="min")
    Q.put(n, x, y, w)
    frame(n, "bar", w=3, h=18, fill="accent", W="fixed", H="fill")
    para(n, s, "small", "muted")
    return n


def foot(f, x, w, title, more):
    """One part of a split column minimized on its own: it keeps its place at the column's foot."""
    ft = col(f, "column foot", gap=6, pad=[8, 12, 8, 12], fill="sunken", W="fixed", stroke="line", strokeTopWeight=1,
             strokeBottomWeight=0, strokeLeftWeight=0, strokeRightWeight=1)
    Q.put(ft, x, H - 74, w, 74)
    text(ft, "MINIMIZED IN THIS COLUMN", "label", "muted", fontSize=10)
    r = row(ft, "row", gap=8, W="fill")
    item(r, title, more, w=w - 110)
    spacer(r)
    link(r, "Restore")


# ---- sheets ----------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "Minimized panes: one look, three places",
                  "Redrawn on the app as it is now. Today a minimized float or band is a chip floating over the verses "
                  "(“Two · minimized”), a minimized column is a vertical stub with clipped titles, and a split part "
                  "is a bar with the float icon. Here every one is the same item: a window glyph, the front tab's "
                  "title, +N for the other tabs, and the full list in its tooltip and aria-label.")
    lw = 380

    # M1: everything at once on a wide desktop
    r1 = row(cv, "row 1", gap=64, align="min")
    f = Q.win(r1, PG, "M1 · Wide desktop: tray, column foot and rail",
              "The left column is split: H7065 and Interlinear above, Every use: zealous minimized at its foot. The "
              "right column (Notebook, Shelf, Findings) is minimized to the rail; clicking its button asks before "
              "the column takes room back. A float (Search: lion) and the bottom band wait in the tray, which has "
              "its own height, so the last verse is never covered.")
    toolbar(f)
    b = Q.column(f, 0, lw, ["Interlinear", "H7065"], "H7065", side="left", h=H - TB - 74)
    P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])
    foot(f, 0, lw, "Every use: zealous", 0)
    B.desk_reader(f, lw, TB, W - lw - RAIL, H - TB - TRAY, first=10, last=15)
    tray(f, lw, W - lw - RAIL, [("Search: lion", 1, "default", "float"), ("Interlinear", 0, "hover", "band")])
    rail(f, [("Right column", True)])
    pop = col(f, "rail popover", gap=8, pad=[12, 14, 12, 14], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pop, W - RAIL - 290, TB + 8, 280)
    shadow(pop, 8, 28, "#00000033")
    text(pop, "Right column · 3 tabs", "smallStrong")
    text(pop, "Notebook · Shelf · Findings", "caption", "muted")
    br = row(pop, "buttons", gap=10)
    P.button(br, "Restore", "primary", size="sm")
    P.button(br, "Keep minimized", "ghost", size="sm")

    # M2: many items
    f = Q.win(r1, PG, "M2 · Many items collapse to one control",
              "Past four items, or when the tray is too narrow, the rest go into one “N minimized” menu. Arrows "
              "move, Enter restores, focus lands on the restored pane. `pane restore minimized` does it from the "
              "command field and `wb do`.")
    toolbar(f)
    B.desk_reader(f, 0, TB, W, H - TB - TRAY, first=10, last=15)
    tray(f, 0, W, [("H7065", 1, "default", "float"), ("Notebook", 0, "default", "band")], overflow=4)
    m = Q.popover(f, 420, H - TRAY - 300, 320, "overflow menu")
    for t, s, n, on in (("Every use: zealous", "float", 3, True), ("Search: lion", "left column", 2, False),
                        ("Interlinear", "bottom band", 0, False), ("Findings", "right column", 2, False)):
        Q.menu_item(m, f"{t}{'  +' + str(n) if n else ''}", s, on, "restore")
    P.divider(m)
    Q.menu_item(m, "Restore all", None, False, "restore")

    # M3: medium width, M4: the hosts and states
    r2 = row(cv, "row 2", gap=64, align="min")
    f = Q.win(r2, PG, "M3 · Medium and Expanded: one rail button",
              "At these widths the app draws the columns as one strip, so they minimize as one: one rail button "
              "restores both. The float's item stays in the tray as on a wide desktop.", w=1100)
    toolbar(f, 1100)
    B.desk_reader(f, 0, TB, 1100 - RAIL, H - TB - TRAY, first=10, last=15)
    t = row(f, "tray", gap=8, pad=[0, 12, 0, 16], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeTopWeight=1, strokeBottomWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(t, 0, H - TRAY, 1100 - RAIL, TRAY)
    text(t, "Minimized", "caption", "muted")
    item(t, "H7065", 1, host="float")
    r = col(f, "rail", gap=8, pad=[10, 6, 10, 6], fill="sunken", W="fixed", H="fixed", crossAlign="center",
            stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(r, 1100 - RAIL, TB, RAIL, H - TB)
    b = frame(r, "rail/columns", w=30, h=30, radius=8, fill="surface", stroke="line", sw=1, W="fixed", H="fixed",
              layout="vertical", mainAlign="center", crossAlign="center")
    icon(b, "restore", 16, "accent")

    f = Q.win(r2, PG, "M4 · One item, three hosts",
              "The same item in the tray, at a column's foot and in the rail popover; three states. On a phone panes "
              "are sheets and the back pill is the minimize, so there is no tray and no rail: a saved layout keeps "
              "its minimized flag until the window is wide again.", w=1100)
    body = col(f, "spec", gap=22, pad=[32, 36, 32, 36], W="fixed", H="fixed")
    Q.put(body, 0, 0, 1100, H)
    states = row(body, "states", gap=32, align="min", W="hug", H="hug")
    for s in ("default", "hover", "focus"):
        c_ = col(states, s, gap=8, W="hug", H="hug")
        text(c_, {"default": "DEFAULT", "hover": "HOVER", "focus": "KEYBOARD FOCUS"}[s], "label", "muted")
        item(c_, "H7065", 1, s, w=230)
    tip = col(body, "tooltip", gap=4, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(tip, 0, 0, 420)
    shadow(tip, 6, 18)
    text(tip, "Restore H7065 and 1 other tab", "smallStrong")
    text(tip, "Floating window · H7065, Interlinear", "caption", "muted")
    para(body, "aria-label: “Restore H7065 and 1 other tab, floating window”", "small", "muted")
    P.divider(body)
    text(body, "TODAY, FOR COMPARISON", "label", "warn")
    today = row(body, "today", gap=40, align="min", W="hug", H="hug")
    stub = col(today, "stub", gap=6, W="hug", H="hug")
    s_ = frame(stub, "vertical stub", w=30, h=150, fill="sunken", radius=8, stroke="line", sw=1, W="fixed", H="fixed",
               layout="vertical", crossAlign="center", pad=[8, 0, 8, 0])
    text(s_, "Interlinear · H70”¦", "smallStrong", "muted", rotation=-90)
    text(stub, "Column stub: titles clipped", "caption", "muted")
    bar = col(today, "bar", gap=6, W="hug", H="hug")
    rb = row(bar, "restore bar", gap=6, pad=[8, 12, 8, 12], fill="sunken", stroke="line", sw=1, W="fixed")
    Q.put(rb, 0, 0, 220)
    icon(rb, "float", 14, "muted")
    text(rb, "Every use: zealous", "smallStrong", "muted")
    text(bar, "Split part: float icon on a restore", "caption", "muted")
    chip = col(today, "chip", gap=6, W="hug", H="hug")
    ch = row(chip, "chip", gap=6, pad=[8, 14, 8, 14], fill="surface", radius=999, stroke="line", sw=1)
    shadow(ch, 4, 12)
    icon(ch, "float", 14, "fg")
    text(ch, "Two · minimized", "smallStrong")
    text(chip, "Float: chip over the verses", "caption", "muted")
    text(body, "Three looks, two wordings, a float icon on a restore control.", "small", "warn")

    # M5: phone
    r3 = row(cv, "row 3", gap=64, align="min")
    f = Q.win(r3, PG, "M5 · Phone: no tray", "Panes are sheets; Back to Numbers 25 is the minimize.", w=390, h=844)
    hd = row(f, "top bar", gap=8, pad=[0, 16, 0, 16], fill="bg", W="fixed", H="fixed")
    Q.put(hd, 0, 0, 390, 52)
    text(hd, "Numbers 25", "title")
    rd = frame(f, "reader", x=0, y=52, w=390, h=844 - 52, layout="vertical", pad=[8, 20, 16, 20], gap=8, W="fixed",
               H="fixed", clip=True)
    F.verses(rd, B.vv("num25", 10, 13), "readPhone", B.NUM25_MARKS, paragraphs=(10,))
    pill = P.return_pill(f, "Numbers 25", x=0, y=0)
    Q.put(pill, 100, 770)


def folder_tab(f, x, y, title, more=0, on=False, vertical=False):
    """A minimized group as a folder tab: only the tab shows, its open edge tucked under the window's edge."""
    if vertical:
        t = frame(f, f"folder/{title}", x=x, y=y, w=44, h=150, radius=12, fill="accentSoft" if on else "surface",
                  stroke="line", sw=1, W="fixed", H="fixed", layout="vertical", crossAlign="center", gap=8, pad=[10, 0, 10, 0])
        shadow(t, 2, 8, "#00000014")
        icon(t, "restore", 15, "accent")
        text(t, title + (f"  +{more}" if more else ""), "smallStrong", "fg", rotation=-90)
        return t
    t = row(f, f"folder/{title}", gap=7, pad=[8, 14, 18, 12], radius=12, fill="accentSoft" if on else "surface",
            stroke="line", sw=1)
    Q.put(t, x, y)
    shadow(t, -2, 8, "#00000014")
    icon(t, "restore", 15, "accent")
    text(t, title, "smallStrong")
    if more:
        bd = row(t, "more tabs", pad=[0, 6, 0, 6], fill="sunken", radius=999)
        text(bd, f"+{more}", "caption", "muted", fontSize=11, lineHeight="16px")
    return t


def label_version(parent, letter, name, about):
    Q.design_label(parent, letter, name, about)


def versions(board):
    cv = Q.section(board, "Versions", 3200)
    Q.sheet_title(cv, "Three more versions",
                  "Each answers a finding: folder tabs (7e04, softer tabs), one pane in focus with the rest waiting "
                  "(f54e, 0e94), and one rail for everything, the same rail the Notebook's side panel folds to (c301). "
                  "Version A is M1 above: the tray of pills.")
    lw = 380

    # B: folder tabs
    label_version(cv, "B", "Folder tabs", "No tray bar. A minimized float or band is a tab standing on the reader's "
                  "bottom edge; a minimized column is a tab on the window's right edge. The tab is the pane, folded: "
                  "click it and the pane opens upward or leftward from it. Floats lose their filled header: only the "
                  "tabs show, as in 7e04.")
    r = row(cv, "row B", gap=64, align="min")
    f = Q.win(r, "Versions", "B1 · Folder tabs on the reader's edges",
              "The verses run to the bottom edge; the tabs sit in the reader's last 34px, which stays empty.")
    toolbar(f)
    b = Q.column(f, 0, lw, ["Interlinear", "H7065"], "H7065", side="left")
    P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])
    B.desk_reader(f, lw, TB, W - lw, H - TB - 34, first=10, last=15)
    edge = frame(f, "reader edge", x=lw, y=H - 6, w=W - lw, h=6, fill="sunken", W="fixed", H="fixed")
    folder_tab(f, lw + 24, H - 40, "Search: lion", 1)
    folder_tab(f, lw + 210, H - 40, "Interlinear", 0, on=True)
    folder_tab(f, W - 30, TB + 40, "Notebook", 2, vertical=True)

    f = Q.win(r, "Versions", "B2 · A floating window drawn as a folder",
              "The float has no filled header bar: its tabs stand on its top edge, the front one joined to the page. "
              "Minimize folds it to its front tab at the reader's foot.")
    toolbar(f)
    B.desk_reader(f, 0, TB, W, H - TB - 34, first=10, last=15)
    fw = frame(f, "float folder", x=820, y=150, w=520, h=460, W="fixed", H="fixed")
    tb = frame(fw, "front tab", x=0, y=0, w=150, h=46, radius=12, fill="surface", stroke="line", sw=1, W="fixed",
               H="fixed", layout="horizontal", crossAlign="center", pad=[0, 12, 8, 14], gap=6)
    text(tb, "H7065", "smallStrong")
    tb2 = frame(fw, "back tab", x=154, y=6, w=130, h=40, radius=12, fill="sunken", stroke="line", sw=1, W="fixed",
                H="fixed", layout="horizontal", crossAlign="center", pad=[0, 12, 8, 14])
    text(tb2, "Interlinear", "small", "muted")
    pg = col(fw, "page", gap=12, pad=16, fill="surface", radius=12, stroke="line", sw=1, W="fixed", H="fixed")
    Q.put(pg, 0, 36, 520, 424)
    shadow(pg, 14, 40, "#00000026")
    P.lexicon_block(pg, C["lexicon"]["H7065"], C["count"]["H7065"])
    ctl = row(fw, "controls", gap=2, x=430, y=8)
    Q.put(ctl, 430, 6)
    for a in ("minimize", "float", "close"):
        P.icon_button(ctl, a, "muted", size=26, icon_size=14)
    folder_tab(f, 24, H - 40, "Search: lion", 1)

    # C: focus
    label_version(cv, "C", "One pane in focus", "Any tab can fill the window (Focus, F11 on a pane, `pane focus`). "
                  "Everything else is minimized into one strip, in the same order and places it had, and Exit focus "
                  "(Esc) puts every pane back exactly. Switching view while focused leaves focus first, so the layout "
                  "comes back as it was.")
    r = row(cv, "row C", gap=64, align="min")
    f = Q.win(r, "Versions", "C1 · H7065 in focus", "The reader waits too: its item is first and keeps its verse.")
    toolbar(f)
    pane = frame(f, "focused pane", x=0, y=TB, w=W, h=H - TB - TRAY, fill="surface", layout="vertical", W="fixed",
                 H="fixed", clip=True)
    P.pane_header(pane, ["H7065"], "H7065", actions=("close",))
    pb = col(pane, "body", gap=12, pad=[40, 0, 40, 0], W="fill", crossAlign="center")
    inner = col(pb, "inner", gap=12, W="fixed")
    Q.put(inner, 0, 0, 760)
    P.lexicon_block(inner, C["lexicon"]["H7065"], C["count"]["H7065"])
    t = tray(f, 0, W, [("Numbers 25:11", 0, "default", "reader"), ("Interlinear", 0, "default", "left"),
                       ("Notebook", 2, "default", "right"), ("Search: lion", 0, "default", "float")])
    ex = row(f, "exit focus", gap=8, pad=[6, 12, 6, 12], radius=999, fill="fg")
    Q.put(ex, W - 170, TB + 6)
    text(ex, "Exit focus  Esc", "smallStrong", "bg")

    f = Q.win(r, "Versions", "C2 · A document in focus as a presentation",
              "The same focus with the toolbar hidden (f54e: present mode). The strip hides too and comes back on "
              "hover at the bottom edge.")
    slide = frame(f, "slide", x=0, y=0, w=W, h=H, fill="fg", layout="vertical", mainAlign="center", crossAlign="center",
                  W="fixed", H="fixed", gap=24)
    text(slide, "Numbers 25:11", "display", "bg", fontSize=44, lineHeight="54px")
    vv = next(x for x in C["num25"]["verses"] if x["v"] == 11)
    box = col(slide, "verse box", gap=0, W="fixed")
    Q.put(box, 0, 0, 1000)
    para(box, vv["text"], "readDesk", "bg", fontSize=30, lineHeight="48px")
    hint = row(f, "hint", gap=8, pad=[8, 12, 8, 12], fill="surface", radius=999)
    Q.put(hint, W // 2 - 150, H - 56)
    text(hint, "Move to the bottom edge for your panes · Esc", "smallStrong")

    # D: one rail
    label_version(cv, "D", "One rail for everything", "No tray and no column foot. Every minimized group, float, "
                  "band or column, waits as a button on one rail at the window's right edge, in the order it was "
                  "minimized; hover names it. The Notebook's side panel folds to the same rail look.")
    r = row(cv, "row D", gap=64, align="min")
    f = Q.win(r, "Versions", "D1 · The rail with a name on hover",
              "Four groups waiting. The reader keeps its full height.")
    toolbar(f)
    B.desk_reader(f, 0, TB, W - RAIL, H - TB, first=10, last=15)
    rl = col(f, "rail", gap=8, pad=[10, 6, 10, 6], fill="sunken", W="fixed", H="fixed", crossAlign="center",
             stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(rl, W - RAIL, TB, RAIL, H - TB)
    for n, ic, on in (("H7065", "word", False), ("Notebook", "notebook", True), ("Interlinear", "interlinear", False),
                      ("Search: lion", "search", False)):
        bt = frame(rl, f"rail/{n}", w=32, h=32, radius=8, fill="accentSoft" if on else "surface",
                   stroke="accent" if on else "line", sw=1, W="fixed", H="fixed", layout="vertical",
                   mainAlign="center", crossAlign="center")
        icon(bt, ic, 17, "accent")
    tip = col(f, "tip", gap=2, pad=[8, 12, 8, 12], fill="fg", radius=8, W="hug", H="hug")
    Q.put(tip, W - RAIL - 220, TB + 48)
    text(tip, "Notebook +2 · right column", "smallStrong", "bg")
    text(tip, "Notebook, Shelf, Findings", "caption", "bg")

    f = Q.win(r, "Versions", "D2 · Same rail inside the Notebook",
              "The Notebook open in the right column with its side panel folded (c301): the fold is the same rail, "
              "same buttons, so one control means “folded away” everywhere.")
    toolbar(f)
    B.desk_reader(f, 0, TB, W - 640, H - TB, first=10, last=15)
    nb = Q.column(f, W - 640, 640, ["Notebook", "Shelf"], "Notebook")
    rl = frame(f, "notebook rail", x=W - 640, y=TB + 40, w=RAIL, h=H - TB - 40, fill="sunken", W="fixed", H="fixed",
               layout="vertical", crossAlign="center", gap=8, pad=[10, 6, 10, 6], stroke="line", strokeRightWeight=1,
               strokeLeftWeight=1, strokeTopWeight=0, strokeBottomWeight=0)
    for ic in ("list", "pen"):
        bt = frame(rl, f"nb rail/{ic}", w=32, h=32, radius=8, fill="surface", stroke="line", sw=1, W="fixed", H="fixed",
                   layout="vertical", mainAlign="center", crossAlign="center")
        icon(bt, ic, 17, "accent")
    pgc = col(f, "page", gap=10, pad=[24, 28, 24, 28], W="fixed")
    Q.put(pgc, W - 640 + RAIL, TB + 40, 640 - RAIL)
    text(pgc, "Phinehas", "title")
    para(pgc, "Your page’s text sits here, at full width while the side panel is folded.", "body", "muted")


F.ICONS.setdefault("expand", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5")
F.ICONS.setdefault("shrink", "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5")
F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
F.ICONS.setdefault("present", "M4 5h16v11H4zM12 16v4M8 20h8")
F.ICONS.setdefault("gear", "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1")
RW = 52  # the side rail


def slim_bar(f, x=0, w=W):
    """The top bar once the tools live on the rail: the place and the command field only."""
    bar = row(f, "top bar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, x, 0, w, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "fg")
    text(pl, "Numbers 25", "bodyStrong")
    text(pl, "KJV", "caption", "muted")
    icon(pl, "down", 14, "muted")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    spacer(bar)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1,
              W="fixed", H="fixed")
    Q.put(cmd, 0, 0, 520, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "Search, go to a place, or type a command", "small", "muted", W="fill", maxLines=1)
    P.kbd(cmd, "`")
    spacer(bar)
    frame(bar, "balance", w=170, h=8, W="fixed", H="fixed")
    return bar


def rail_btn(parent, name, ic, on=False, open_=False):
    b = frame(parent, f"rail/{name}", w=38, h=38, radius=10, fill="accentSoft" if (on or open_) else None,
              stroke="accent" if open_ else None, sw=1.5 if open_ else None, W="fixed", H="fixed", layout="vertical",
              mainAlign="center", crossAlign="center")
    icon(b, ic, 20, "accent" if (on or open_) else "fg")
    return b


def side_rail(f, x, top=None, waiting=None, open_=None, h=H):
    """The persistent rail: the tools at the top, what is minimized (by kind) under a rule, settings at the foot."""
    top = top or [("Notebook", "notebook", True), ("Shelf", "shelf", False), ("Highlights", "highlight", False)]
    r = col(f, "side rail", gap=6, pad=[10, 7, 10, 7], fill="sunken", W="fixed", H="fixed", crossAlign="center",
            stroke="line", strokeLeftWeight=1 if x > 0 else 0, strokeRightWeight=0 if x > 0 else 1,
            strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(r, x, 0, RW, h)
    for n, ic, on in top:
        rail_btn(r, n, ic, on=on)
    if waiting:
        P.divider(r)
        for n, ic, cnt in waiting:
            rail_btn(r, n, ic, open_=(n == open_))
            if cnt > 1:
                bd = row(r, f"count/{n}", pad=[0, 5, 0, 5], fill="accent", radius=999)
                text(bd, str(cnt), "caption", "onAccent", fontSize=10, lineHeight="14px")
    spacer(r)
    rail_btn(r, "More", "more")
    rail_btn(r, "Settings", "gear")
    return r


def folder_strip(parent, tabs, active, actions=("minimize", "expand", "float", "close"), w=None, present=False):
    """The tab strip restyled as folder tabs: no filled header, only the tabs; the front one joins its page."""
    h = row(parent, "folder strip", gap=4, pad=[6, 6, 0, 8], fill="bg", W="fill" if w is None else "fixed", H="fixed",
            align="max", stroke="line", strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    S.do("node.set", {"ids": [h], "props": {"height": 40, **({"width": w} if w else {})}}, ref=False)
    for t in tabs:
        on = t == active
        tb = row(h, f"tab/{t}", gap=8, pad=[7, 10, 7, 12], radius=10, fill="surface" if on else None,
                 stroke="line" if on else None, sw=1 if on else None)
        text(tb, t, "smallStrong" if on else "small", "fg" if on else "muted")
        if on:
            icon(tb, "close", 13, "muted")
    spacer(h)
    ctl = row(h, "controls", gap=0, pad=[0, 0, 4, 0])
    if present:
        P.icon_button(ctl, "present", "accent", size=28, icon_size=16)
    for a in actions:
        P.icon_button(ctl, a, "muted", size=28, icon_size=15)
    return h


def pane(f, x, y, w, h, tabs, active, side="right", **kw):
    d = frame(f, f"pane/{active}", x=x, y=y, w=w, h=h, fill="surface", layout="vertical", W="fixed", H="fixed",
              clip=True, stroke="line", strokeLeftWeight=1 if side == "right" else 0,
              strokeRightWeight=1 if side == "left" else 0, strokeTopWeight=0, strokeBottomWeight=0)
    folder_strip(d, tabs, active, **kw)
    return col(d, "pane body", gap=12, pad=16, W="fill", H="fill", clip=True)


def kind_menu(f, x, y, title, rows, w=340):
    m = col(f, f"menu/{title}", gap=2, pad=[10, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(m, x, y, w)
    shadow(m, 8, 28, "#00000033")
    hd = row(m, "head", gap=8, pad=[2, 8, 6, 8], W="fill")
    text(hd, title, "smallStrong", W="fill")
    text(hd, f"{len(rows)} minimized", "caption", "muted")
    for t, where, on in rows:
        it = row(m, f"row/{t}", gap=10, pad=[7, 8, 7, 8], radius=8, fill="accentSoft" if on else None, W="fill")
        tc = col(it, "text", gap=0, W="fill")
        text(tc, t, "smallStrong" if on else "body")
        text(tc, where, "caption", "muted")
        P.icon_button(it, "bookmark", "muted", size=26, icon_size=15)
    P.divider(m)
    ft = row(m, "foot", gap=8, pad=[6, 8, 2, 8], W="fill")
    link(ft, "Restore all")
    spacer(ft)
    text(ft, "bookmark: keep on the Shelf", "caption", "muted")
    return m


def rail_round(board):
    cv = Q.section(board, "Rail", 3200)
    Q.sheet_title(cv, "Round 3: the side rail is the toolbar",
                  "From D and the review: the tools move from the top bar to a persistent rail; under them, what is "
                  "minimized waits by kind. Clicking a kind lists its tabs; clicking one restores that pane. Every tab "
                  "strip becomes folder tabs; full screen is an icon in each strip and minimizes everything else; "
                  "Present is only on documents. The bookmark beside each minimized tab keeps it on the Shelf (a "
                  "sketch only: the Shelf gets its own round, see design/features/minimize/README.md).")
    lw = 380

    Q.design_label(cv, "E", "Rail on the right", "The top bar keeps the place and the command field; the rail holds "
                   "Notebook, Shelf, Highlights, then what is waiting, then More and Settings.")
    r = row(cv, "row E", gap=64, align="min")
    f = Q.win(r, "Rail", "E1 · A kind's menu: word studies",
              "Three word-study tabs are minimized under one icon. The menu says where each was; a click restores it "
              "there. The reader and the left column keep their place.")
    slim_bar(f, w=W - RW)
    b = pane(f, 0, TB, lw, H - TB, ["Interlinear", "Search: lion"], "Interlinear", side="left")
    for w_ in C["interlinear"][:3]:
        P.interlinear_cell(b, w_)
    B.desk_reader(f, lw, TB, W - lw - RW, H - TB, first=10, last=15)
    side_rail(f, W - RW, waiting=[("Word studies", "word", 3), ("Notebook pages", "notebook", 2),
                                  ("Searches", "search", 1)], open_="Word studies")
    kind_menu(f, W - RW - 352, TB + 150, "Word studies",
              [("H7065", "floating window", True), ("Every use: zealous", "left column, behind Interlinear", False),
               ("BDB H7065", "right column", False)])

    f = Q.win(r, "Rail", "E2 · H7065 full screen",
              "The full-screen icon in the strip (now shrink) fills the window with one pane; everything else is "
              "minimized onto the rail by kind, the reader first. Shrink or Esc puts every pane back.")
    slim_bar(f, w=W - RW)
    b = pane(f, 0, TB, W - RW, H - TB, ["H7065"], "H7065", side="left", actions=("minimize", "shrink", "close"))
    inner = col(b, "inner", gap=12, W="fixed", pad=[24, 0, 0, 300])
    Q.put(inner, 0, 0, 1100)
    P.lexicon_block(inner, C["lexicon"]["H7065"], C["count"]["H7065"])
    side_rail(f, W - RW, waiting=[("Reader", "book", 1), ("Interlinear", "interlinear", 1),
                                  ("Notebook pages", "notebook", 2), ("Searches", "search", 1)])

    Q.design_label(cv, "F", "Rail on the left", "The same rail at the left edge, like an editor's activity bar; "
                   "the Notebook opens beside it and its side panel is the rail's own drawer, so there is one rail, not two.")
    r = row(cv, "row F", gap=64, align="min")
    f = Q.win(r, "Rail", "F1 · Notebook open from the rail",
              "The Notebook button is held down; the Notebook's list is the drawer beside the rail (finding c301 "
              "answered by the rail: click the button again and the list folds away).")
    side_rail(f, 0, waiting=[("Word studies", "word", 3), ("Searches", "search", 1)])
    slim_bar(f, x=RW, w=W - RW)
    dr = col(f, "notebook drawer", gap=6, pad=[14, 12, 14, 12], fill="sunken", W="fixed", H="fixed",
             stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(dr, RW, TB, 250, H - TB)
    text(dr, "NOTEBOOK", "label", "muted")
    for t, on in (("Today", False), ("Phinehas", True), ("Zeal", False), ("Questions", False), ("Inbox", False)):
        it = row(dr, f"page/{t}", pad=[6, 10, 6, 10], radius=8, fill="accentSoft" if on else None, W="fill")
        text(it, t, "smallStrong" if on else "body", "accent" if on else "fg")
    b = pane(f, RW + 250, TB, 560, H - TB, ["Phinehas", "Zeal"], "Phinehas", side="left")
    text(b, "Phinehas", "title")
    para(b, "Your page’s text sits here.", "body", "muted")
    B.desk_reader(f, RW + 810, TB, W - RW - 810, H - TB, first=10, last=13)

    f = Q.win(r, "Rail", "F2 · A document: Present lives only here",
              "A floating document in folder tabs. Its strip has Present (documents only) beside minimize, full "
              "screen, float and close.")
    side_rail(f, 0, waiting=[("Word studies", "word", 3)])
    slim_bar(f, x=RW, w=W - RW)
    B.desk_reader(f, RW, TB, W - RW, H - TB, first=10, last=15)
    fl = frame(f, "float", x=760, y=130, w=600, h=520, fill="surface", radius=12, stroke="line", sw=1, layout="vertical",
               W="fixed", H="fixed", clip=True)
    shadow(fl, 16, 44, "#00000030")
    folder_strip(fl, ["Phinehas.pdf", "Notes.docx"], "Phinehas.pdf", present=True)
    sl = col(fl, "slide", gap=14, pad=[40, 36, 40, 36], fill="fg", W="fill", H="fill", mainAlign="center")
    text(sl, "Numbers 25:11", "title", "bg")
    vv = next(x for x in C["num25"]["verses"] if x["v"] == 11)
    para(sl, vv["text"], "readSmall", "bg", fontSize=18, lineHeight="30px")


F.ICONS.setdefault("folder", "M3.5 6.5h6l2 2h9v10h-17z")
F.ICONS.setdefault("page", "M7 3.5h7l4 4v13H7zM14 3.5v4h4")
F.ICONS.setdefault("panel", "M4 5h16v14H4zM9 5v14")
RW4, RWX = 52, 230  # the rail: icons only, and opened out with names


def pips(parent, n):
    """How many wait under a kind, without a badge: up to three short ticks at the icon's foot."""
    p = row(parent, "waiting ticks", gap=3)
    for _ in range(min(n, 3)):
        frame(p, "tick", w=5, h=2, radius=1, fill="accent", W="fixed", H="fixed")
    return p


def rail_item(parent, name, ic, n=0, on=False, open_=False, wide=False):
    if wide:
        it = row(parent, f"rail/{name}", gap=10, pad=[8, 10, 8, 10], radius=10, W="fill",
                 fill="accentSoft" if (on or open_) else None, stroke="accent" if open_ else None,
                 sw=1.5 if open_ else None)
        icon(it, ic, 19, "accent" if (on or open_) else "fg")
        text(it, name, "smallStrong" if (on or open_) else "body", "accent" if (on or open_) else "fg", W="fill", maxLines=1)
        if n:
            text(it, f"{n} waiting", "caption", "muted")
        return it
    c_ = col(parent, f"rail/{name}", gap=3, crossAlign="center")
    b = frame(c_, "button", w=38, h=38, radius=10, fill="accentSoft" if (on or open_) else None,
              stroke="accent" if open_ else None, sw=1.5 if open_ else None, W="fixed", H="fixed", layout="vertical",
              mainAlign="center", crossAlign="center")
    icon(b, ic, 20, "accent" if (on or open_) else "fg")
    if n:
        pips(c_, n)
    return c_


TOOLS = [("Notebook", "notebook"), ("Concordance", "word"), ("Highlights", "highlight")]


def rail4(f, waiting=None, open_=None, on="Notebook", wide=False, h=H):
    """Left rail. Each tool also holds its own minimized tabs (the Notebook its pages, the Concordance its words);
    kinds with no tool of their own (searches, interlinear) wait under the rule."""
    waiting = waiting or {}
    w = RWX if wide else RW4
    r = col(f, "rail", gap=6, pad=[10, 7, 10, 7], fill="sunken", W="fixed", H="fixed",
            crossAlign="min" if wide else "center", stroke="line", strokeRightWeight=1, strokeLeftWeight=0,
            strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(r, 0, 0, w, h)
    for n, ic in TOOLS:
        rail_item(r, n, ic, waiting.get(n, 0), on=(n == on), open_=(n == open_), wide=wide)
    others = [(k, v) for k, v in waiting.items() if k not in dict(TOOLS)]
    if others:
        P.divider(r)
        icons = {"Searches": "search", "Interlinear": "interlinear", "Documents": "docs"}
        for k, v in others:
            rail_item(r, k, icons[k], v, open_=(k == open_), wide=wide)
    spacer(r)
    rail_item(r, "Narrow the rail" if wide else "Show names", "panel", wide=wide)
    rail_item(r, "Settings", "gear", wide=wide)
    return w


def menu4(f, x, y, title, top_action, rows, w=330):
    m = col(f, f"menu/{title}", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(m, x, y, w)
    shadow(m, 8, 28, "#00000033")
    if top_action:
        a = row(m, "open whole", gap=10, pad=[8, 8, 8, 8], radius=8, W="fill")
        icon(a, top_action[1], 18, "accent")
        tc = col(a, "text", gap=0, W="fill")
        text(tc, top_action[0], "smallStrong", "accent")
        text(tc, top_action[2], "caption", "muted")
        P.divider(m)
    text(m, f"  {title.upper()}", "label", "muted")
    for t, where, on in rows:
        it = row(m, f"row/{t}", gap=10, pad=[7, 8, 7, 8], radius=8, fill="accentSoft" if on else None, W="fill")
        tc = col(it, "text", gap=0, W="fill")
        text(tc, t, "smallStrong" if on else "body")
        text(tc, where, "caption", "muted")
        P.icon_button(it, "bookmark", "muted", size=26, icon_size=15)
    return m


def concordance(f, x, w):
    """The concordance as a book on the desk: an index of the words in front of you, one entry, every place it stands."""
    cp = frame(f, "concordance", x=x, y=TB, w=w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True)
    folder_strip(cp, ["Concordance"], "Concordance")
    body = row(cp, "three", gap=0, W="fill", H="fill", align="min")
    idx = col(body, "index", gap=4, pad=[16, 12, 16, 12], fill="sunken", W="fixed", H="fill", stroke="line",
              strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(idx, 0, 0, 230)
    fld = P.field(idx, "Word or number", None, icon_name="search", height=34)
    text(idx, "WORDS IN NUMBERS 25:11", "label", "muted")
    for wd in C["interlinear"]:
        on = wd["strong"] == "H7065"
        it = row(idx, f"index/{wd['strong']}", gap=8, pad=[5, 8, 5, 8], radius=8, fill="accentSoft" if on else None,
                 W="fill")
        text(it, wd["strong"], "caption", "accent" if on else "muted")
        text(it, wd["gloss"], "smallStrong" if on else "small", "fg", W="fill", maxLines=1)
    mid = col(body, "entry", gap=14, pad=[22, 24, 22, 24], W="fixed", H="fill")
    Q.put(mid, 0, 0, 420)
    P.lexicon_block(mid, C["lexicon"]["H7065"], C["count"]["H7065"])
    text(mid, "BY BOOK", "label", "muted")
    bb = C["count"]["H7065"]["by_book"]
    top = max(bb.values())
    for book, n in bb.items():
        br = row(mid, f"book/{book}", gap=8, W="fill")
        t = text(br, book, "caption", "fg", W="fixed")
        Q.put(t, 0, 0, 90)
        frame(br, "bar", w=int(200 * n / top), h=8, radius=4, fill="accent" if book == "Numbers" else "line",
              W="fixed", H="fixed")
        text(br, str(n), "caption", "muted")
    uses = col(body, "every use", gap=10, pad=[22, 22, 22, 22], W="fill", H="fill", stroke="line", strokeLeftWeight=1,
               strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    text(uses, "Every use · 33 in 28 verses", "heading")
    for key, v, ref in (("num25", 11, "Numbers 25:11"), ("num25", 13, "Numbers 25:13"), ("ps106", 30, "Psalms 106:30")):
        vv = next(z for z in C[key]["verses"] if z["v"] == v)
        P.verse_line(uses, ref, vv["text"], max_lines=3)
    return cp


def library_drawer(f, x, w, merged=True):
    d = col(f, "drawer", gap=4, pad=[14, 10, 14, 10], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(d, x, TB, w, H - TB)

    def node(label, ic, depth=0, on=False, kind=None):
        it = row(d, f"node/{label}", gap=8, pad=[5, 8, 5, 8 + 16 * depth], radius=8, fill="accentSoft" if on else None,
                 W="fill")
        icon(it, ic, 16, "accent" if on else "muted")
        text(it, label, "smallStrong" if on else "small", "accent" if on else "fg", W="fill", maxLines=1)
        if kind:
            text(it, kind, "caption", "muted")

    def head(s):
        h = row(d, "head", pad=[10, 8, 2, 8], W="fill")
        text(h, s, "label", "muted")

    head("TODAY")
    node("Wednesday 11 November", "page")
    node("Inbox", "inbox")
    head("FOLDERS" if merged else "PAGES")
    node("Phinehas", "folder", 0, kind=None)
    node("Phinehas", "page", 1, on=True, kind="page")
    node("Numbers 25:11", "book", 1, kind="verse")
    node("H7065", "word", 1, kind="word")
    node("Phinehas.pdf", "docs", 1, kind="document")
    node("Zeal", "page", 2, kind="page")
    node("Covenant of peace", "folder")
    node("Questions", "question")
    if not merged:
        head("SHELF (BOOKMARKS)")
        node("Numbers 25:11", "bookmark")
        node("H7065", "bookmark")
        node("Phinehas.pdf", "bookmark")
    return d


def round4(board):
    cv = Q.section(board, "Round 4", 3200)
    Q.sheet_title(cv, "Round 4: the left rail, a concordance, and one place for pages and bookmarks",
                  "The rail is on the left. No red counters: up to three short ticks under an icon say something waits "
                  "there. Each tool holds its own minimized tabs: the Notebook its pages (it appears once), the new "
                  "Concordance its words. Show names opens the rail out with labels. The Shelf and the Notebook are "
                  "drawn two ways as one tree of folders.")

    Q.design_label(cv, "G", "The rail and the Concordance",
                   "A concordance is a book you keep open on the desk: an index of words, one entry, every place it "
                   "stands. The rail's Concordance button opens it whole; its menu also holds the word studies you "
                   "minimized.")
    r = row(cv, "row G1", gap=64, align="min")
    f = Q.win(r, "Round 4", "G1 · The Concordance menu",
              "Open the concordance first, then the words waiting: three word studies, each with where it was and a "
              "bookmark to keep it on the Shelf.")
    w = rail4(f, {"Concordance": 3, "Notebook": 2, "Searches": 1}, open_="Concordance")
    slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=15)
    menu4(f, w + 8, TB + 40, "Minimized words", ("Open the Concordance", "word", "every Hebrew and Greek word, by number"),
          [("H7065", "floating window", True), ("Every use: zealous", "left column", False),
           ("BDB H7065", "right column", False)])

    f = Q.win(r, "Round 4", "G2 · Names shown",
              "Show names (at the rail's foot) opens it out; the ticks become “2 waiting”. The choice is remembered.")
    w = rail4(f, {"Concordance": 3, "Notebook": 2, "Searches": 1}, wide=True)
    slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=15)

    r = row(cv, "row G3", gap=64, align="min")
    f = Q.win(r, "Round 4", "G3 · The Concordance open",
              "An index of the words in the verse you came from (searchable by word, number or English), the entry, "
              "how it falls by book, and every use. A word opened from it is a word study that can be minimized back "
              "into the Concordance's menu.")
    w = rail4(f, {"Notebook": 2}, on="Concordance")
    slim_bar(f, x=w, w=W - w)
    concordance(f, w, W - w)

    Q.design_label(cv, "H", "Notebook and Shelf together",
                   "Pages and bookmarks are the same kind of thing kept for later; a folder can hold both. H1 makes "
                   "them one tree (the Shelf becomes folders); H2 keeps a Shelf section as quick bookmarks under the "
                   "same tree.")
    r = row(cv, "row H", gap=64, align="min")
    for name, merged, about in (
            ("H1 · One tree: folders hold pages, verses, words and documents", True,
             "The Shelf button leaves the rail; bookmarking puts a thing in a folder (or the Inbox) in one step. "
             "A folder is a Shelf set; a page can hold pages as now."),
            ("H2 · One drawer, two sections: folders and the Shelf", False,
             "The Shelf stays as a list of quick bookmarks at the foot of the same drawer; dragging one into a "
             "folder files it.")):
        f = Q.win(r, "Round 4", name, about)
        w = rail4(f, {"Concordance": 1}, on="Notebook")
        slim_bar(f, x=w, w=W - w)
        library_drawer(f, w, 270, merged)
        b = pane(f, w + 270, TB, 560, H - TB, ["Phinehas", "Zeal"], "Phinehas", side="left")
        text(b, "Phinehas", "title")
        para(b, "Your page’s text sits here.", "body", "muted")
        B.desk_reader(f, w + 830, TB, W - w - 830, H - TB, first=10, last=13)


F.ICONS.setdefault("trail", "M6 17.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM18 2.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM8 19.5h5a3.5 3.5 0 0 0 0-7h-2a3.5 3.5 0 0 1 0-7h5")
F.ICONS.setdefault("lexicon", "M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11M9 8h6")
F.ICONS.setdefault("dictionary", "M6 4h12v16H6zM9 8h6M9 11h6M9 14h4")
CONC = json.loads((HERE / "data" / "concordance-zeal.json").read_text(encoding="utf-8"))
BDB = json.loads((HERE / "data" / "bdb-H7065.json").read_text(encoding="utf-8"))
WEB = json.loads((HERE / "data" / "webster-zealous.json").read_text(encoding="utf-8"))

TOOLS5 = [("Notebook", "notebook"), ("Concordance", "word"), ("Brown-Driver-Briggs", "lexicon"),
          ("Webster's 1913", "dictionary"), ("Highlights", "highlight")]


def rail5(f, on=None, trail_open=False, h=H):
    """Left rail, round 5: the books and the Notebook; the Trail under a rule (its dot: a trail is going)."""
    r = col(f, "rail", gap=6, pad=[10, 7, 10, 7], fill="sunken", W="fixed", H="fixed", crossAlign="center",
            stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(r, 0, 0, RW4, h)
    for n, ic in TOOLS5:
        rail_item(r, n, ic, on=(n == on))
    P.divider(r)
    t = rail_item(r, "Trail", "trail", open_=trail_open)
    frame(t, "going", w=6, h=6, radius=3, fill="accent", W="fixed", H="fixed")
    spacer(r)
    rail_item(r, "Show names", "panel")
    rail_item(r, "Settings", "gear")
    return RW4


KIND_ICON = {"verse": "book", "word": "word", "uses": "list", "bdb": "lexicon", "search": "search",
             "page": "page", "def": "dictionary", "doc": "docs"}
TRAIL = [  # depth, kind, title, time, state (open, minimized, closed)
    (0, "verse", "Numbers 25:11", "9:14", "open"),
    (1, "word", "H7065", "9:15", "minimized"),
    (2, "uses", "Every use: zealous", "9:17", "minimized"),
    (3, "verse", "Numbers 25:13", "9:19", "closed"),
    (3, "verse", "Psalms 106:30", "9:22", "minimized"),
    (4, "word", "H6372", "9:24", "closed"),
    (2, "bdb", "BDB H7065", "9:31", "minimized"),
    (2, "def", "Webster's: zealous", "9:33", "closed"),
    (1, "word", "H7068", "9:40", "minimized"),
    (2, "uses", "Every use: zeal", "9:41", "minimized"),
    (3, "verse", "Romans 10:2", "9:46", "open"),
    (4, "search", "Search: “zeal of God”", "9:52", "minimized"),
    (4, "page", "Zeal (your page)", "10:05", "open"),
    (1, "search", "Search: “covenant of peace”", "10:20", "minimized"),
    (2, "verse", "Malachi 2:5", "10:24", "open"),
]


def trail_tree(parent, rows=TRAIL, w=330):
    for depth, kind, title, time, state in rows:
        it = row(parent, f"trail/{title}", gap=7, pad=[4, 8, 4, 6 + 16 * depth], radius=8, W="fill",
                 fill="accentSoft" if title == "Romans 10:2" else None)
        if depth:
            frame(it, "branch", w=8, h=1, fill="line", W="fixed", H="fixed")
        col_ = {"open": "accent", "minimized": "fg", "closed": "muted"}[state]
        icon(it, KIND_ICON[kind], 15, col_)
        text(it, title, "smallStrong" if depth == 0 else "small", col_, W="fill", maxLines=1,
             **({"textDecoration": "STRIKETHROUGH"} if False else {}))
        text(it, {"open": "open", "minimized": "", "closed": "closed"}[state], "caption", "muted")
        text(it, time, "caption", "muted")


def trail_drawer(f, x, w=360):
    d = col(f, "trail drawer", gap=6, pad=[14, 12, 14, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(d, x, TB, w, H - TB)
    hd = col(d, "head", gap=2, pad=[0, 6, 6, 6], W="fill")
    text(hd, "This trail", "heading")
    para(hd, "Began at Numbers 25:11, 9:14 · 31 tabs, 9 open · 1 h 10 min", "caption", "muted")
    acts = row(d, "actions", gap=6, pad=[0, 6, 6, 6], W="fill")
    P.button(acts, "Back to the start", "secondary", size="sm")
    P.button(acts, "Keep as a page", "ghost", size="sm")
    P.divider(d)
    trail_tree(d)
    mr = row(d, "more", gap=6, pad=[4, 8, 4, 30], W="fill")
    text(mr, "16 more under these, folded", "caption", "muted")
    spacer(d)
    P.divider(d)
    text(d, "EARLIER TRAILS", "label", "muted")
    for t, s in (("Romans 10:2", "yesterday · 12 tabs · kept as a page"), ("H2205", "Monday · 8 tabs")):
        er = row(d, f"earlier/{t}", gap=8, pad=[4, 6, 4, 6], W="fill")
        icon(er, "trail", 15, "muted")
        tc = col(er, "t", gap=0, W="fill")
        text(tc, t, "small")
        text(tc, s, "caption", "muted")
    return w


def crumbs(f, x, w):
    """The trail as a line under the top bar: where it began, the way back to here, forks as small marks."""
    b = row(f, "trail line", gap=6, pad=[0, 14, 0, 14], fill="bg", W="fixed", H="fixed", stroke="line",
            strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(b, x, TB, w, 34)
    icon(b, "trail", 15, "accent")
    for i, (t, fork) in enumerate((("Numbers 25:11", False), ("H7068", True), ("Every use: zeal", False),
                                   ("Romans 10:2", True), ("Search: “zeal of God”", False))):
        if i:
            icon(b, "right", 12, "muted")
        last = i == 4
        text(b, t, "smallStrong" if (i == 0 or last) else "small", "accent" if i == 0 else "fg")
        if fork:
            frame(b, "fork", w=5, h=5, radius=3, fill="muted", W="fixed", H="fixed")
    spacer(b)
    text(b, "31 tabs · 3 forks", "caption", "muted")
    link(b, "Show the whole trail")


def conc_page(f, x, w, tab="Concordance"):
    cp = frame(f, "concordance", x=x, y=TB, w=w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True)
    folder_strip(cp, ["Concordance"], "Concordance")
    nav = row(cp, "navigator", gap=10, pad=[10, 16, 10, 16], W="fill", stroke="line", strokeBottomWeight=1,
              strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    fld = P.field(nav, "zeal", "zeal", icon_name="search", height=34, W="fixed")
    S.do("node.set", {"ids": [fld], "props": {"width": 240}}, ref=False)
    P.segmented(nav, ["Concordance", "Hebrew", "Greek", "Interlinear"], tab, W="hug")
    spacer(nav)
    az = row(nav, "letters", gap=5)
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        text(az, ch, "caption", "accent" if ch == "Z" else "muted")
    return col(cp, "page", gap=0, pad=[18, 28, 18, 28], W="fill", H="fill", clip=True)


def conc_lines(parent, word, lines):
    blk = col(parent, f"heading/{word}", gap=2, pad=[0, 0, 14, 0], W="fill")
    hd = row(blk, "head", gap=10, W="fill", pad=[0, 0, 4, 0])
    text(hd, word.upper(), "heading", "fg", fontFamily=F.READ)
    text(hd, f"{len(lines)}", "caption", "muted")
    for ln in lines:
        r = row(blk, f"line/{ln['ref']}", gap=12, W="fill")
        t = text(r, ln["ref"], "caption", "muted", W="fixed")
        Q.put(t, 0, 0, 110)
        text(r, ln["frag"], "small", "fg", W="fill", maxLines=1, fontFamily=F.READ)
        text(r, ln["strong"] or "·", "caption", "accent")


def round5(board):
    cv = Q.section(board, "Round 5", 3200)
    Q.sheet_title(cv, "Round 5: the trail, the books, and the Notebook as pages and shelf",
                  "Ticks counted to three; a two-hour study opens fifty tabs. So nothing is counted on the rail: every "
                  "tab you open joins a trail that remembers what it came from, back to where it began. The "
                  "Concordance reads like the printed Strong's; BDB and Webster's are books of their own. The "
                  "Notebook is pages and the Shelf; Inbox and the Questions tab go.")

    Q.design_label(cv, "I", "The trail", "Each tab remembers the tab it was opened from, so the tabs of a study form "
                   "a tree rooted at the thought that started it. Open tabs are brown, minimized ones plain, closed ones "
                   "grey; any of them opens again where it was. Minimizing no longer needs its own place: it is the "
                   "trail.")
    r = row(cv, "row I", gap=64, align="min")
    f = Q.win(r, "Round 5", "I1 · The whole trail",
              "Opened from the Trail button. Back to the start returns to Numbers 25:11; Keep as a page saves the tree "
              "into the Notebook (a page that lists the trail, each line a link). A new trail starts when you go to a "
              "new place from the top bar; the old one is kept under Earlier trails.")
    w = rail5(f, trail_open=True)
    tw = trail_drawer(f, w)
    slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w + tw, TB, W - w - tw, H - TB, first=10, last=15)

    f = Q.win(r, "Round 5", "I2 · The way back, always in view",
              "A line under the top bar: from where the trail began to the tab in front, forks marked. Each step "
              "opens that tab; Show the whole trail opens I1.")
    w = rail5(f)
    slim_bar(f, x=w, w=W - w)
    crumbs(f, w, W - w)
    b = pane(f, w, TB + 34, 520, H - TB - 34, ["Search: “zeal of God”", "Romans 10:2"], "Search: “zeal of God”",
             side="left")
    for ln in CONC["zeal"][-4:]:
        text(b, ln["ref"], "smallStrong", "accent")
        text(b, ln["frag"], "small", fontFamily=F.READ)
    B.desk_reader(f, w + 520, TB + 34, W - w - 520, H - TB - 34, first=10, last=13)

    Q.design_label(cv, "J", "The Concordance as the book",
                   "Like Strong's on the desk: English words A to Z, every place each stands with a few words around it "
                   "and the number of the original word; the Hebrew and Greek dictionaries behind it; the interlinear "
                   "for a verse, passage or chapter. The lines are generated from the database (wb uses).")
    r = row(cv, "row J", gap=64, align="min")
    f = Q.win(r, "Round 5", "J1 · Zeal, zealous, zealously",
              "Type a word or click a letter; a number opens its entry in the Hebrew or Greek tab.")
    w = rail5(f, on="Concordance")
    slim_bar(f, x=w, w=W - w)
    pg = conc_page(f, w, W - w)
    two = row(pg, "columns", gap=40, W="fill", align="min")
    c1 = col(two, "column 1", gap=0, W="fill")
    c2 = col(two, "column 2", gap=0, W="fill")
    conc_lines(c1, "zeal", CONC["zeal"])
    conc_lines(c2, "zealous", CONC["zealous"])
    conc_lines(c2, "zealously", CONC["zealously"])

    f = Q.win(r, "Round 5", "J2 · The interlinear inside the Concordance",
              "The same book, its Interlinear tab: a verse, a passage or a chapter, word by word; each number opens "
              "its entry.")
    w = rail5(f, on="Concordance")
    slim_bar(f, x=w, w=W - w)
    pg = conc_page(f, w, W - w, tab="Interlinear")
    sc = row(pg, "scope", gap=10, pad=[0, 0, 16, 0])
    text(sc, "Numbers 25:11", "heading")
    P.segmented(sc, ["Verse", "Passage", "Chapter"], "Verse", W="hug")
    cells = row(pg, "words", gap=8, W="fill", wrap=True, align="min")
    for w_ in C["interlinear"]:
        cell = P.interlinear_cell(cells, w_)
        Q.put(cell, 0, 0, 120)

    Q.design_label(cv, "K", "Books of their own",
                   "Brown-Driver-Briggs and Webster's 1913 each have a button on the rail and open as their own book, "
                   "with the same search and A to Z.")
    r = row(cv, "row K", gap=64, align="min")
    f = Q.win(r, "Round 5", "K1 · BDB and Webster's side by side",
              "Both books open in one split column beside the reader; each entry verbatim with its source.")
    w = rail5(f, on="Brown-Driver-Briggs")
    slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, 640, H - TB, first=10, last=13)
    b = pane(f, w + 640, TB, W - w - 640, (H - TB) // 2, ["Brown-Driver-Briggs"], "Brown-Driver-Briggs")
    e = BDB["entries"][0]
    hd = row(b, "head", gap=12, align="baseline")
    text(hd, BDB["lemma"], "hebrew")
    text(hd, f"{BDB['translit']} · {BDB['strong']}", "caption", "muted")
    for ln in e["text"].splitlines():
        text(b, ln.strip(), "body", W="fill")
    b = pane(f, w + 640, TB + (H - TB) // 2, W - w - 640, (H - TB) // 2, ["Webster's 1913"], "Webster's 1913")
    text(b, WEB["headword"], "title", fontFamily=F.READ)
    para(b, WEB["text"], "body")
    text(b, f"{WEB['source']['name']}, {WEB['source']['edition']} · public domain", "caption", "muted")

    Q.design_label(cv, "L", "The Notebook: pages and the Shelf",
                   "No Inbox (a page needs no place to belong) and no Questions tab (questions stay inside pages). "
                   "Today is a page you can choose to show. A folder holds pages and kept things alike.")
    r = row(cv, "row L", gap=64, align="min")
    f = Q.win(r, "Round 5", "L1 · Pages and the Shelf",
              "Today's page shows only when the setting is on. Keep as a page from a trail lands here.")
    w = rail5(f, on="Notebook")
    slim_bar(f, x=w, w=W - w)
    d = col(f, "drawer", gap=4, pad=[14, 10, 14, 10], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(d, w, TB, 270, H - TB)

    def node(label, ic, depth=0, on=False, kind=None, muted=False):
        it = row(d, f"node/{label}", gap=8, pad=[5, 8, 5, 8 + 16 * depth], radius=8, fill="accentSoft" if on else None,
                 W="fill")
        icon(it, ic, 16, "accent" if on else "muted")
        text(it, label, "smallStrong" if on else "small", "accent" if on else ("muted" if muted else "fg"), W="fill",
             maxLines=1)
        if kind:
            text(it, kind, "caption", "muted")

    text(d, "PAGES", "label", "muted")
    node("Today · Wednesday 11 November", "page", muted=True, kind="optional")
    node("Phinehas", "folder")
    node("Phinehas", "page", 1, on=True)
    node("Trail from Numbers 25:11", "trail", 1, kind="kept trail")
    node("Zeal", "page", 1)
    node("Covenant of peace", "folder")
    text(d, "SHELF", "label", "muted")
    node("Numbers 25:11", "bookmark", kind="verse")
    node("H7065", "bookmark", kind="word")
    node("Phinehas.pdf", "bookmark", kind="document")
    b = pane(f, w + 270, TB, 560, H - TB, ["Phinehas"], "Phinehas", side="left")
    text(b, "Phinehas", "title")
    para(b, "Your page’s text sits here; a question written in it stays a callout in the page.", "body", "muted")
    B.desk_reader(f, w + 830, TB, W - w - 830, H - TB, first=10, last=13)


def trail_panel(f, x, title, sub, w=380):
    d = col(f, "trail drawer", gap=6, pad=[14, 12, 14, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(d, x, TB + 34, w, H - TB - 34)
    hd = col(d, "head", gap=2, pad=[0, 6, 6, 6], W="fill")
    text(hd, title, "heading")
    para(hd, sub, "caption", "muted")
    return d


def group_head(d, label, sub, open_=True, on=False):
    g = row(d, f"group/{label}", gap=8, pad=[7, 8, 7, 8], radius=8, fill="accentSoft" if on else "surface",
            stroke="line", sw=1, W="fill")
    icon(g, "down" if open_ else "right", 14, "muted")
    icon(g, "trail", 16, "accent" if on else "fg")
    tc = col(g, "t", gap=0, W="fill")
    text(tc, label, "smallStrong", "accent" if on else "fg", maxLines=1)
    text(tc, sub, "caption", "muted")
    return g


def round6(board):
    cv = Q.section(board, "Round 6", 3200)
    Q.sheet_title(cv, "Round 6: a trail that is always on, without the bloat",
                  "The trail records all the time, as history does: closed tabs stay on it. Three ways to keep it "
                  "readable. Each keeps the full drawer and the line under the top bar (the line is how the trail "
                  "stays in view while the drawer is folded).")

    Q.design_label(cv, "N", "Sittings", "The trail breaks itself where you stopped: a gap of 30 minutes or more begins a "
                   "new sitting. Today's sittings are listed newest first; older days fold to one line each.")
    r = row(cv, "row N", gap=64, align="min")
    f = Q.win(r, "Round 6", "N1 · Today in sittings",
              "The open sitting shows its tree; earlier ones show where they began and how far they went. Keep as a "
              "page saves one sitting. The gap is a setting.")
    w = rail5(f, trail_open=True)
    d = trail_panel(f, w, "Trail", "Recording · this sitting began 9:14")
    group_head(d, "Numbers 25:11", "9:14 – now · 31 tabs", on=True)
    trail_tree(d, TRAIL[:9])
    group_head(d, "Romans 10:2", "7:02 – 7:40 · 12 tabs", open_=False)
    group_head(d, "H2205", "6:30 – 6:50 · 6 tabs", open_=False)
    spacer(d)
    text(d, "EARLIER DAYS", "label", "muted")
    for t in ("Yesterday · 3 sittings · 44 tabs", "Monday · 1 sitting · 8 tabs"):
        text(d, t, "small", "muted")
    slim_bar(f, x=w, w=W - w)
    crumbs(f, w, W - w)
    B.desk_reader(f, w + 380, TB + 34, W - w - 380, H - TB - 34, first=10, last=13)

    Q.design_label(cv, "O", "Main path and side trips", "One trail, but only the way you went on (each step that led "
                   "somewhere further) is drawn in full. A step you opened, glanced at and left becomes a side trip, "
                   "folded into the step it came from as “+3 side trips”.")
    r = row(cv, "row O", gap=64, align="min")
    f = Q.win(r, "Round 6", "O1 · The main path, side trips folded",
              "Forty tabs read as nine steps. A side trip opens on click; one you come back to joins the main path.")
    w = rail5(f, trail_open=True)
    d = trail_panel(f, w, "Trail", "Began 9:14 at Numbers 25:11 · 9 steps, 31 side trips")
    for depth, kind, title, time, state in [TRAIL[0], TRAIL[1], TRAIL[2], TRAIL[4], TRAIL[8], TRAIL[9], TRAIL[10],
                                            TRAIL[11], TRAIL[12]]:
        trail_tree(d, [(min(depth, 1) if False else 0, kind, title, time, state)])
        if title in ("H7065", "Every use: zealous", "Every use: zeal"):
            s = row(d, "side trips", gap=6, pad=[0, 8, 2, 34], W="fill")
            text(s, {"H7065": "+2 side trips", "Every use: zealous": "+5 side trips",
                     "Every use: zeal": "+11 side trips"}[title], "caption", "muted")
    slim_bar(f, x=w, w=W - w)
    crumbs(f, w, W - w)
    B.desk_reader(f, w + 380, TB + 34, W - w - 380, H - TB - 34, first=10, last=13)

    Q.design_label(cv, "P", "Marked starts", "History records everything, quietly. You mark where a study begins "
                   "(Start a trail here, on any tab or from the line); the trail shows from that mark. Unmarked time "
                   "is plain history, listed by day.")
    r = row(cv, "row P", gap=64, align="min")
    f = Q.win(r, "Round 6", "P1 · A marked trail and plain history",
              "The marked trail is named after its start and can be renamed (“Phinehas and zeal”). Below, today's "
              "history keeps everything else, newest first.")
    w = rail5(f, trail_open=True)
    d = trail_panel(f, w, "Trails", "1 marked today · history keeps the rest")
    group_head(d, "Phinehas and zeal", "marked at Numbers 25:11, 9:14 · 31 tabs", on=True)
    trail_tree(d, TRAIL[:6])
    text(d, "HISTORY · TODAY", "label", "muted")
    for t, tm in (("Search: “covenant of peace”", "10:20"), ("Malachi 2:5", "10:24"), ("Romans 10:2", "7:02"),
                  ("H2205", "6:30")):
        hr = row(d, f"history/{t}", gap=8, pad=[3, 8, 3, 8], W="fill")
        text(hr, t, "small", "muted", W="fill", maxLines=1)
        text(hr, tm, "caption", "muted")
    slim_bar(f, x=w, w=W - w)
    crumbs(f, w, W - w)
    B.desk_reader(f, w + 380, TB + 34, W - w - 380, H - TB - 34, first=10, last=13)
    mk = row(f, "start mark", gap=8, pad=[8, 12, 8, 12], fill="fg", radius=999)
    Q.put(mk, w + 420, H - 70)
    icon(mk, "trail", 15, "bg")
    text(mk, "Start a trail here  ·  on any tab’s menu", "smallStrong", "bg")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    versions(board)
    rail_round(board)
    round4(board)
    round5(board)
    round6(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "minimize.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "minimize.figcraft"
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
    tmp = LIB / "build" / "minimize-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window\W+([MBCDEFGHIJKLNOP]\d)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
