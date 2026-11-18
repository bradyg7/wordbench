"""Marks, round 7 sheets (2026-11-18), drawn from the interaction table in README.md (rows named on each window).
Scripture (Numbers 25) is fetched with wb into data/; nothing is typed. Legend names, margin notes and counts are a
drawn sample (a new Library starts with an empty legend, MK7-26); what a person writes is shown as stand-in lines.

    python design/features/marks/marks.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, S, W, H, TB, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

F = K.F
PG = "Marks"
NUM25 = K.verses_of(K.fetch(HERE, "num25", ["text", "Num 25"], as_json=False))
BYV = {v["v"]: v for v in NUM25}

# ---- icons for the kinds (MK7-8) and the Legend (MK7-17) ---------------------------------------------------------------
F.ICONS.update({
    "underline": "M7 4v7a5 5 0 0 0 10 0V4M5 20h14",
    "ring": "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z",
    "square": "M5 5h14v14H5z",
    "arrow": "M5 19L19 5M10 5h9v9",
    "notepad": "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
    "legend": "M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10",
    "rainbow": "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z",
    "grid": "M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16",
})
K.M.TOOLS5[-1] = ("Legend", "legend")   # MK7-17: the Legend replaces the rail's highlight icon

KINDS = [("Highlight", "highlight", "H"), ("Underline", "underline", "U"), ("Circle", "ring", "C"),
         ("Box", "square", "B"), ("Arrow", "arrow", "A"), ("Margin note", "notepad", "N")]
INK = {"red": "#B3261E", "blue": "#2E6FB8", "green": "#3B7A3B", "purple": "#6B4FA0", "black": "#231F1A",
       "orange": "#C46A12"}
SEL = "#CFE0F7"   # a browser-like selection (MK7-12)

# the person's legend (a drawn sample): name, kind, color, lines, key, quick, count
LEGEND = [("Person", "highlight", "yellow", 0, "Ctrl+1", True, 212),
          ("Place", "highlight", "green", 0, "Ctrl+2", True, 98),
          ("Repeated word", "underline", "red", 2, "Ctrl+3", True, 61),
          ("Key word", "ring", "blue", 0, "Ctrl+7", True, 44),
          ("Time", "square", "purple", 0, "", True, 17),
          ("Study later", "underline", "black", 1, "", False, 9),
          ("Unnamed pink highlight", "highlight", "pink", 0, "", False, 3)]


# ---- scripture with marks ------------------------------------------------------------------------------------------------
def scripture(parent, vs, marks=None, sel=None, width=600, gutter=None):
    """Verses, one paragraph each, so the gutter can sit level with each verse. marks: {verse: {"hl": {wi: tok},
    "ul": {wi: (lines, ink)}, "groups": [(first, last, "ring"|"box", ink)]}}. sel: (verse, first, last) or
    (first verse, last verse) for whole verses."""
    marks = marks or {}
    fam, fstyle, size, lh, _, _ = F.TYPE["readDesk"]
    block = col(parent, "Scripture", gap=12, W="fixed")
    S.do("node.set", {"ids": [block], "props": {"width": width}}, ref=False)
    for verse in vs:
        n = verse["v"]
        m = marks.get(n, {})
        flow = frame(block, f"v{n}", layout="horizontal", wrap=True, gap=0, crossGap=0, crossAlign="baseline",
                     W="fill", H="hug")
        nb = frame(flow, "number", layout="horizontal", W="hug", H="hug", pad=[0, 5, 0, 0])
        text(nb, f"{n}", "verseNum", "accent", lineHeight=f"{lh}px", fontSize=11)
        words = verse["text"].split(" ")
        groups = {g[0]: g for g in m.get("groups", [])}
        host, gend = flow, None
        for wi, word in enumerate(words):
            if wi in groups:
                g = groups[wi]
                host = frame(flow, f"{g[2]} {g[0]}-{g[1]}", layout="horizontal", gap=0, crossAlign="baseline",
                             W="hug", H="hug", pad=[0, 3, 0, 3], radius=999 if g[2] == "ring" else 2,
                             stroke=INK[g[3]], sw=1.6)
                gend = g[1]
            def fill_of(i):
                if i >= len(words):
                    return None
                if (sel and len(sel) == 2 and sel[0] <= n <= sel[1]) or (sel and len(sel) == 3 and sel[0] == n
                                                                           and sel[1] <= i <= sel[2]):
                    return SEL
                h_ = m.get("hl", {}).get(i)
                return F.c(F.HL[h_]) if h_ else None
            fl = fill_of(wi)
            joined = fl and fill_of(wi + 1) == fl and wi != gend and (wi + 1) not in groups
            ul = m.get("ul", {}).get(wi)
            tp = dict(fontFamily=fam, fontStyle=fstyle, fontSize=size, lineHeight=f"{lh}px", fill=F.c("fg"))
            last_in = wi == len(words) - 1 or wi == gend
            box = frame(host, f"w{n}.{wi}", layout="horizontal", W="hug", H="hug",
                        pad=[0, 0 if last_in else 5, 0, 0], fill=fl if joined else None)
            if fl and not joined:
                box = frame(box, "fill", layout="horizontal", W="hug", H="hug", fill=fl)
            if ul:
                lines, ink = ul
                weights = {1: [2.4], 2: [1.6, 1.6], 3: [1.1, 1.1, 1.1]}[lines]   # thinner as they stack (MK7-15)
                for k, wt in enumerate(weights):
                    box = frame(box, f"underline {k + 1}", layout="horizontal", W="hug", H="hug", pad=[0, 0, 2, 0],
                                stroke=INK[ink], strokeBottomWeight=wt, strokeTopWeight=0, strokeLeftWeight=0,
                                strokeRightWeight=0, strokeAlign="inside")
            S.do("text.create", {"text": word, "parent": box, "x": 0, "y": 0, "props": tp, "name": word}, ref=False)
            if gend is not None and wi == gend:
                if wi < len(words) - 1:
                    frame(flow, "space", w=5, h=4, W="fixed", H="fixed")
                host, gend = flow, None
    return block


def verse_y(vs, first_top, v, cpl=64, lh=34, gap=12):
    """The window y of the middle of verse v's first line (an estimate: one paragraph per verse)."""
    y = first_top
    for verse in vs:
        if verse["v"] == v:
            return y + lh / 2
        lines = -(-(len(verse["text"]) + 4) // cpl)
        y += lines * lh + gap
    return y


def reader(f, x, w, vs, title="Numbers 25", marks=None, sel=None, margin=None, margin_w=300, width=600):
    """The reader with its margin column (MK7-18): text, then a thin line, then the margin (open, 'signs', or None)."""
    rd = frame(f, "reader", x=x, y=TB, w=w, h=H - TB, fill="bg", W="fixed", H="fixed", clip=True)
    tx = 56
    head = col(rd, "title", gap=0, W="fixed", x=tx, y=28)
    S.do("node.set", {"ids": [head], "props": {"width": width}}, ref=False)
    text(head, title, "chapter", fontSize=30, lineHeight="40px")
    body = col(rd, "text", gap=0, W="fixed", x=tx, y=84)
    S.do("node.set", {"ids": [body], "props": {"width": width}}, ref=False)
    scripture(body, vs, marks, sel, width=width)
    if margin:
        mx = tx + width + 28
        frame(rd, "margin line", x=mx, y=24, w=1, h=H - TB - 48, fill="line", W="fixed", H="fixed")
        if margin != "signs":
            mc = col(rd, "margin", gap=0, W="fixed", x=mx + 16, y=84)
            S.do("node.set", {"ids": [mc], "props": {"width": margin_w}}, ref=False)
    return rd, tx, TB + 84


def stand_in(parent, widths, color="line"):
    for w_ in widths:
        frame(parent, "stand-in line", w=w_, h=8, radius=4, fill=color, W="fixed", H="fixed")


def margin_note(f, x, y, w=280, lines=(220, 180), editing=False, chapter=False, span=None, q=False):
    n = col(f, "margin note", gap=6, pad=[8, 10, 8, 10], radius=8, W="fixed",
            fill="surface" if editing else None, stroke="accent" if editing else None, sw=1)
    Q.put(n, x, y, w)
    hd = row(n, "head", gap=6, W="fill")
    icon(hd, "notepad", 14, "muted")
    text(hd, "Chapter" if chapter else (span or ""), "caption", "muted")
    if q:
        P.chip(hd, "question", "question")
    stand_in(n, lines)
    if editing:
        frame(n, "cursor", w=1.5, h=16, fill="accent", W="fixed", H="fixed")
    return n


def sign(f, x, y):
    s = frame(f, "margin sign", x=x, y=y, w=22, h=22, radius=6, fill="surface", stroke="line", sw=1, W="fixed",
              H="fixed", layout="horizontal", mainAlign="center", crossAlign="center")
    icon(s, "notepad", 14, "muted")


def gutter_arrow(f, x, y1, y2, ink="orange", name="arrow"):
    """MK7-25: an arrow in the gutter beside the verse numbers, from y1 to y2, never across the words or the margin."""
    bow = min(40, 10 + abs(y2 - y1) / 8)
    d = f"M{x} {y1}C{x - bow} {y1} {x - bow} {y2} {x - 2} {y2}"
    S.do("vector.create", {"path": d, "x": 0, "y": 0, "parent": f, "name": name,
                           "props": {"stroke": INK[ink], "strokeWeight": 1.8, "strokeCap": "round", "fill": "none"}})
    head = f"M{x - 8} {y2 - 5}L{x - 1} {y2}L{x - 8} {y2 + 5}"
    S.do("vector.create", {"path": head, "x": 0, "y": 0, "parent": f, "name": name + " head",
                           "props": {"stroke": INK[ink], "strokeWeight": 1.8, "strokeCap": "round",
                                     "strokeJoin": "round", "fill": "none"}})


# ---- the mark bar (MK7-8 to MK7-14, MK7-24) ---------------------------------------------------------------------------------
def swatch(parent, kind, color, lines=0, size=18):
    if kind == "highlight":
        return frame(parent, "sample", w=size, h=size * 0.7, radius=3, fill=F.HL[color], W="fixed", H="fixed")
    if kind == "underline":
        s = col(parent, "sample", gap=2, W="fixed", H="fixed")
        S.do("node.set", {"ids": [s], "props": {"width": size, "height": size * 0.7}}, ref=False)
        for _ in range(lines):
            frame(s, "line", w=size, h=1.6, fill=INK[color], W="fixed", H="fixed")
        return s
    return frame(parent, "sample", w=size, h=size * 0.7, radius=999 if kind == "ring" else 2, stroke=INK[color],
                 sw=1.6, W="fixed", H="fixed")


def style_chip(parent, entry, on=False, key=None):
    name, kind, color, lines = entry[:4]
    ch = row(parent, f"style/{name}", gap=6, pad=[4, 10, 4, 8], radius=999, fill="accentSoft" if on else "surface",
             stroke="accent" if on else "line", sw=1)
    swatch(ch, kind, color, lines, 16)
    text(ch, name, "smallStrong" if on else "small", "fg")
    if key:
        P.kbd(ch, key)
    return ch


def kind_btn(parent, label, ic, on=False, tip=False):
    b = frame(parent, f"kind/{label}", w=32, h=32, radius=8, fill="accentSoft" if on else None,
              stroke="accent" if on else None, sw=1, W="fixed", H="fixed", layout="horizontal", mainAlign="center",
              crossAlign="center")
    icon(b, ic, 18, "accent" if on else "fg")
    return b


def vbar(parent):
    frame(parent, "divider", w=1, h=22, fill="line", W="fixed", H="fixed")


def mark_bar(f, x, y, kind=None, quick=True, span=False, tip=None, w=None):
    """The bar above the selection: kind icons, quick styles, the Legend icon, Add to… (and Open as a passage)."""
    b = col(f, "mark bar", gap=8, pad=[6, 8, 6, 8], fill="surface", radius=12, stroke="line", sw=1, W="hug")
    Q.put(b, x, y)
    shadow(b, 6, 20, "#00000026")
    top = row(b, "kinds and styles", gap=4)
    for label, ic, _k in KINDS:
        kind_btn(top, label, ic, on=(label == kind))
    vbar(top)
    if quick:
        for e in LEGEND[:5]:
            if e[5]:
                style_chip(top, e)
        vbar(top)
    kind_btn(top, "Legend", "legend", on=(kind == "Legend"))
    vbar(top)
    P.button(top, "Add to…", "ghost", "plus", size="sm")
    if span:
        P.button(top, "Open as a passage", "ghost", "book", size="sm")
    if tip:
        t = row(f, "tooltip", pad=[4, 8, 4, 8], fill="fg", radius=6)
        Q.put(t, x + 8 + tip[1] * 36, y - 30)
        text(t, tip[0], "caption", "bg")
    return b


def color_row(bar, kind, recent):
    r = row(bar, "colors", gap=6)
    text(r, "Recent", "caption", "muted")
    for e in recent:
        style_chip(r, e)
    vbar(r)
    pk = row(r, "picker", gap=6, pad=[4, 10, 4, 6], radius=999, stroke="line", sw=1)
    icon(pk, "rainbow", 18, "accent")
    text(pk, "Any color", "small")
    if kind == "Underline":
        vbar(r)
        P.segmented(r, ["1", "2", "3"], "1", W="hug")
    return r


def card(f, x, y, w=300):
    c = col(f, "mark card", gap=8, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(c, x, y, w)
    shadow(c, 6, 18, "#00000026")
    return c


def card_row(c, entry, date):
    r = row(c, f"mark/{entry[0]}", gap=8, W="fill")
    swatch(r, entry[1], entry[2], entry[3], 18)
    tc = col(r, "text", gap=0, W="fill")
    text(tc, entry[0], "smallStrong")
    text(tc, date, "caption", "muted")
    P.button(r, "Change", "ghost", size="sm")
    P.icon_button(r, "trash", "muted", size=28, icon_size=16)


def toast(f, s, x, y):
    t = row(f, "toast", gap=12, pad=[10, 14, 10, 14], fill="fg", radius=10)
    Q.put(t, x, y)
    shadow(t, 6, 18, "#00000033")
    text(t, s, "small", "bg")
    text(t, "Undo", "smallStrong", "accentSoft")


# ---- windows ------------------------------------------------------------------------------------------------------------
def win(r, title, about, w=W, h=H):
    return Q.win(r, PG, title, about, w=w, h=h)


def app(f, on=None):
    return K.app(f, on=on)


V = [BYV[n] for n in range(7, 14)]           # Numbers 25:6-13 on most windows
MARKS = {7: {"hl": {2: "yellow"}, "groups": [(16, 16, "ring", "blue")]},
         11: {"hl": {0: "yellow", 4: "yellow", 8: "yellow"}, "ul": {i: (2, "red") for i in (21, 22)}},
         13: {"ul": {i: (2, "red") for i in (21, 22)}}}


def part(cv, s):
    text(cv, s, "title", fontSize=26, lineHeight="32px")


def sheet_a(board):
    cv = Q.section(board, "A · Making a mark", 3200)
    Q.sheet_title(cv, "A · Making a mark", "Rows 1 to 12, 17 to 24. A selection looks like a browser's; the bar sits "
                  "above it with the six kinds as icons, the person's quick styles, the Legend and Add to…. Picking a "
                  "new kind and color is picking up a new pen, named on the spot.")
    r = row(cv, "A1-A2", gap=64, align="min")
    f = win(r, "A1 · Words selected: the mark bar (rows 1, 4, 20, 21)",
            "MK7-8, MK7-9, MK7-12, MK7-24: no handles on the selection; six kind icons (the name on hover, here "
            "Circle), up to 5 quick styles named, the Legend icon, Add to…. A quick style is one click, or 1 to 5.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, sel=(12, 6, 9), margin="open")
    y = verse_y(V, top, 12)
    mark_bar(f, w + tx - 4, y - 74, tip=("Circle · C", 2))
    K.note(f, "Quick styles are the person's choice (pinned in the Legend), the most used until they choose. The rest "
           "of the legend is one click away under its icon, never all shown at once.", W - 470, H - 140)

    f = win(r, "A2 · A kind picked: recent styles with their names (rows 5, 6)",
            "MK7-10: after Highlight, the 5 recent highlight styles, each with its legend name, and the rainbow "
            "picker. No bare color dots: a color is never picked blindly.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, sel=(12, 6, 9), margin="open")
    b = mark_bar(f, w + tx - 4, verse_y(V, top, 12) - 112, kind="Highlight")
    color_row(b, "Highlight", [LEGEND[0], LEGEND[1], LEGEND[6]])

    r = row(cv, "A3-A4", gap=64, align="min")
    f = win(r, "A3 · A new pen: name it as it is made (rows 7, 8, 9)",
            "MK7-11: a color no entry has. The mark is drawn at once; the bar keeps a name field, focused. Enter with a "
            "name adds it to the legend; Enter or Esc with none leaves it Unnamed, nameable later.")
    w = app(f)
    mk = dict(MARKS)
    mk[12] = {"ul": {i: (1, "orange") for i in range(6, 10)}}
    rd, tx, top = reader(f, w, W - w, V, marks=mk, margin="open")
    b = mark_bar(f, w + tx - 4, verse_y(V, top, 12) - 150, kind="Underline")
    color_row(b, "Underline", [LEGEND[2], LEGEND[5]])
    nm = row(b, "name this pen", gap=8, W="fill")
    swatch(nm, "underline", "orange", 1, 18)
    P.field(nm, "Name this pen (Enter to keep, Esc for Unnamed)", icon_name=None, height=32)

    f = win(r, "A4 · The Legend icon: the whole legend, filtered (row 10)",
            "MK7-9, MK7-16: the full legend as a short list in the bar, a filter focused; type to find any entry, "
            "Enter applies it. This is how a person with many styles reaches the ones past the quick five.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, sel=(12, 6, 9), margin="open")
    b = mark_bar(f, w + tx - 4, verse_y(V, top, 12) - 74, kind="Legend")
    lst = card(f, w + tx + 280, verse_y(V, top, 12) - 40, 300)
    P.field(lst, "Find a style", value="st", height=32)
    for i, e in enumerate([LEGEND[5], LEGEND[2]]):
        rr = row(lst, f"entry/{e[0]}", gap=8, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if i == 0 else None)
        swatch(rr, e[1], e[2], e[3])
        text(rr, e[0], "small", W="fill")
        text(rr, e[4], "caption", "muted")
    P.button(lst, "New pen…", "ghost", "plus", size="sm")

    r = row(cv, "A5-A6", gap=64, align="min")
    f = win(r, "A5 · A span of verses (rows 2, 3, 11, 12)",
            "MK7-13: click 8, shift-click 10. Whole verses, selected as a browser would. The bar adds Open as a "
            "passage (its own reader) beside Add to… (a page, a folder, a save).")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, sel=(8, 10), margin="open")
    mark_bar(f, w + tx - 4, verse_y(V, top, 8) - 74, span=True)

    f = win(r, "A6 · Keys, without the bar (rows 20 to 23)",
            "MK7-16: select, then Ctrl+7: the style given that key (Key word, a blue circle) is applied, no bar. With "
            "the bar open, H U C B A N pick a kind, 1 to 5 the quick styles, a kind's key twice its last style.")
    w = app(f)
    mk = {k: dict(v) for k, v in MARKS.items()}
    mk[12] = {"groups": [(8, 8, "ring", "blue")]}
    reader(f, w, W - w, V, marks=mk, margin="open")
    keys = K.floating(f, "keys", W - 420, H - 330, 360)
    text(keys, "Keys", "heading")
    for k_, s_ in (("H U C B A N", "a kind (bar open)"), ("1 to 5", "a quick style (bar open)"),
                   ("H H", "highlight's last style"), ("Ctrl+1 to 9", "a style given that key, anywhere"),
                   ("Esc", "close the bar, nothing made")):
        kr = row(keys, k_, gap=10, W="fill")
        P.kbd(kr, k_)
        text(kr, s_, "small", "muted")


def sheet_b(board):
    cv = Q.section(board, "B · Marks over marks", 3200)
    Q.sheet_title(cv, "B · Changing, and marks over marks", "Rows 25 to 31. Change replaces one mark (a misclick); "
                  "selecting again and picking adds a mark on top. The card is small, beside the mark, not draggable.")
    r = row(cv, "B1-B2", gap=64, align="min")
    f = win(r, "B1 · Words with three marks: the card (rows 25, 26)",
            "MK7-19, MK7-20: 'Phinehas' in 25:11 has a Person highlight, a Key word circle and a Study later "
            "underline. A click lists all three, topmost first, each with Change and Delete.")
    w = app(f)
    mk = {k: dict(v) for k, v in MARKS.items()}
    mk[11] = dict(mk[11], groups=[(0, 0, "ring", "blue")], ul={**mk[11]["ul"], 0: (1, "black")})
    rd, tx, top = reader(f, w, W - w, V, marks=mk, margin="open")
    c = card(f, w + tx + 40, verse_y(V, top, 11) + 24)
    text(c, "3 marks on “Phinehas,”", "caption", "muted")
    card_row(c, LEGEND[5], "Study later · 2 Mar 2025")
    card_row(c, LEGEND[3], "Key word · 14 Jan 2025")
    card_row(c, LEGEND[0], "Person · 3 Sep 2024")

    f = win(r, "B2 · Change, and Add on top (rows 27, 31)",
            "MK7-19: left, Change on one mark opens its colors; a pick replaces that mark's style only. Right, the "
            "same words selected again: the bar, and a pick adds a fourth mark; nothing replaced.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=mk, sel=(11, 0, 0), margin="open")
    b = mark_bar(f, w + tx - 4, verse_y(V, top, 11) - 74)
    K.note(f, "Two gestures, two results: Change (on the card) replaces; a new selection adds.", W - 470, H - 120)

    r = row(cv, "B3", gap=64, align="min")
    f = win(r, "B3 · Delete, with Undo (row 28)",
            "MK7-20: the mark goes; a toast in the theme's colors, Undo for 10 seconds; the mark is in the trash "
            "for 7 days.")
    w = app(f)
    reader(f, w, W - w, V, marks=MARKS, margin="open")
    toast(f, "Mark deleted", W // 2 - 80, H - 80)


def sheet_c(board):
    cv = Q.section(board, "C · Arrows", 3200)
    Q.sheet_title(cv, "C · Arrows, within a chapter", "Rows 13 to 16, 48. MK7-25: an arrow links two places in "
                  "the same chapter, drawn in the gutter by the verse numbers so it never crosses the words or the "
                  "margin. Across chapters is the cross-reference graph's (later).")
    r = row(cv, "C1-C2", gap=64, align="min")
    f = win(r, "C1 · Choosing the target (rows 13, 16)",
            "After Arrow, the bar shrinks to a prompt, Back (a misclick: back to the start, the selection kept) and "
            "Cancel. The start is outlined.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, sel=(11, 0, 0), margin="open")
    b = row(f, "arrow bar", gap=8, pad=[6, 10, 6, 10], fill="surface", radius=12, stroke="line", sw=1)
    Q.put(b, w + tx - 4, verse_y(V, top, 11) - 70)
    shadow(b, 6, 20, "#00000026")
    icon(b, "arrow", 18, "accent")
    text(b, "Select where it points", "small")
    P.button(b, "Back", "ghost", "left", size="sm")
    P.button(b, "Cancel", "ghost", size="sm")

    f = win(r, "C2 · Next verse, and several verses away, crossing (rows 14, 48)",
            "Two arrows: 11 to 12, and 7 to 13. They cross in the gutter, not over the text; the margin notes keep "
            "their column. A click on an arrow's end opens its card.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, margin="open")
    gx = w + tx - 4
    gutter_arrow(f, gx, verse_y(V, top, 11), verse_y(V, top, 12), "orange", "arrow 11-12")
    gutter_arrow(f, gx, verse_y(V, top, 7), verse_y(V, top, 13), "purple", "arrow 7-13")
    mx = w + tx + 600 + 44
    margin_note(f, mx, verse_y(V, top, 7) - 14, span="25:7-8")
    margin_note(f, mx, verse_y(V, top, 11) - 14, span="25:11", q=True)

    r = row(cv, "C3", gap=64, align="min")
    f = win(r, "C3 · Trying to leave the chapter while choosing (row 15)",
            "MK7-25: the reader stays in Numbers 25; the bar says why and what will hold it later.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, sel=(11, 0, 0), margin="open")
    b = row(f, "arrow bar", gap=8, pad=[6, 10, 6, 10], fill="surface", radius=12, stroke="line", sw=1)
    Q.put(b, w + tx - 4, verse_y(V, top, 11) - 70)
    shadow(b, 6, 20, "#00000026")
    icon(b, "arrow", 18, "accent")
    text(b, "An arrow stays in this chapter. Links across chapters come with cross-references, later.", "small")
    P.button(b, "Cancel", "ghost", size="sm")


def sheet_d(board):
    cv = Q.section(board, "D · The margin", 3200)
    Q.sheet_title(cv, "D · The margin", "Rows 17 to 19, 29, 30, 42, 43. MK7-18: a column always beside the text, "
                  "behind a thin line, like a Bible's. Click into it to write. Minimized, it shows only signs.")
    r = row(cv, "D1-D2", gap=64, align="min")
    f = win(r, "D1 · The margin open, writing beside 25:12 (rows 17, 19)",
            "A click in the margin level with 25:12 opens an empty note there, the cursor in it. A note for the "
            "chapter sits at the top. References and questions in a note are found by themselves (MK7-28).")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, margin="open")
    mx = w + tx + 600 + 44
    margin_note(f, mx, top - 70, chapter=True, lines=(240, 160))
    margin_note(f, mx, verse_y(V, top, 7) - 14, span="25:7-8")
    margin_note(f, mx, verse_y(V, top, 11) - 14, span="25:11", q=True)
    margin_note(f, mx, verse_y(V, top, 12) - 14, span="25:12", lines=(80,), editing=True)

    f = win(r, "D2 · The margin as signs (row 43)",
            "Minimized: a small notepad beside each verse with a note; a click opens the note in a popover beside "
            "the verse. The text gets the room.")
    w = app(f)
    rd, tx, top = reader(f, w, W - w, V, marks=MARKS, margin="signs", width=760)
    mx = w + tx + 760 + 44
    for v in (7, 11):
        sign(f, mx, verse_y(V, top, v, cpl=84) - 11)
    sign(f, mx, top - 52)
    c = card(f, mx - 320, verse_y(V, top, 11, cpl=84) + 18, 300)
    text(c, "25:11", "caption", "muted")
    stand_in(c, (240, 200, 160))
    P.button(c, "Grow into a page", "ghost", size="sm")


def sheet_e(board):
    cv = Q.section(board, "E · The legend", 3200)
    Q.sheet_title(cv, "E · The legend on the rail", "Rows 32 to 41. MK7-17: the Legend icon replaces the rail's "
                  "highlight icon. Each entry: a sample, a name, a meaning, its key, whether it is a quick style, how "
                  "many marks use it. A new Library's legend is empty (MK7-26).")
    r = row(cv, "E1-E2", gap=64, align="min")
    f = win(r, "E1 · The legend (rows 32 to 39)",
            "Rename, edit the meaning, change a color (asks about the marks in that style), pin as a quick style "
            "(5 at most), give a key, drag to reorder, remove (its marks stay, Unnamed).")
    w = app(f, on="Legend")
    pw = 520
    reader(f, w, W - w - pw, V, marks=MARKS, margin=None, width=560)
    body = K.M.pane(f, W - pw, TB, pw, H - TB, ["Legend"], "Legend")
    hd = row(body, "head", gap=8, W="fill")
    text(hd, "Legend", "title", W="fill")
    P.button(hd, "New pen", "secondary", "plus", size="sm")
    for e in LEGEND:
        rr = row(body, f"entry/{e[0]}", gap=10, pad=[8, 8, 8, 8], radius=8, W="fill", stroke="line", sw=1)
        icon(rr, "drag", 16, "muted")
        swatch(rr, e[1], e[2], e[3], 22)
        tc = col(rr, "name", gap=1, W="fill")
        text(tc, e[0], "bodyStrong" if not e[0].startswith("Unnamed") else "body",
             "fg" if not e[0].startswith("Unnamed") else "muted")
        text(tc, "Meaning: a line of your own" if e[6] > 20 else "No meaning yet", "caption", "muted")
        if e[4]:
            P.kbd(rr, e[4])
        if e[5]:
            P.chip(rr, "Quick", "quiet")
        text(rr, f"{e[6]} marks", "caption", "accent")

    f = win(r, "E2 · Where a style is used (rows 40, 41)",
            "MK7-21: a click on 'Repeated word · 61 marks' lists each with its words and reference; a click opens the "
            "reader there; several can be selected and deleted, with Undo.")
    w = app(f, on="Legend")
    reader(f, w, W - w - pw, V, marks=MARKS, margin=None, width=560)
    body = K.M.pane(f, W - pw, TB, pw, H - TB, ["Legend"], "Legend")
    hd = row(body, "head", gap=8, W="fill")
    P.icon_button(hd, "left", "fg", size=28, icon_size=16)
    swatch(hd, "underline", "red", 2, 22)
    text(hd, "Repeated word · 61 marks", "title", W="fill")
    P.field(body, "Filter by book", height=32)
    for i, (ref, wds) in enumerate([("Numbers 25:11", "for my sake"), ("Numbers 25:13", "for his God"),
                                    ("Numbers 25:11", "children of Israel"), ("Numbers 25:13", "children of Israel")]):
        rr = row(body, ref, gap=10, pad=[8, 8, 8, 8], radius=8, W="fill", fill="accentSoft" if i < 2 else None)
        frame(rr, "check", w=16, h=16, radius=4, stroke="accent", sw=1.5, fill="accent" if i < 2 else None,
              W="fixed", H="fixed")
        tc = col(rr, "t", gap=0, W="fill")
        text(tc, ref, "smallStrong")
        text(tc, f"“{wds}”", "small", "muted")
    P.button(body, "Delete 2 marks", "secondary", "trash", size="sm")


def sheet_f(board):
    cv = Q.section(board, "F · Years of marks", 3200)
    Q.sheet_title(cv, "F · Years of marks, a narrow window, the whole Bible", "Rows 42, 44 to 46, 49, 50, 57, 58. "
                  "Readable after years: a fixed layer order (highlight, then circle and box, then underlines "
                  "thinning, arrows in the gutter); folder colors as tabs in the gutter, never on the words.")
    r = row(cv, "F1-F2", gap=64, align="min")
    f = win(r, "F1 · A chapter with years of marks (rows 42, 49)",
            "Every kind at once on Numbers 25:6-13, with two folder tabs in the gutter (MK7-7, MK7-15). The marks "
            "panel (top right) hides or shows by kind or legend entry; Reading mode shows the plain text.")
    w = app(f)
    many = {7: {"hl": {0: "yellow", 8: "yellow"}, "groups": [(5, 5, "ring", "blue"), (12, 14, "box", "purple")]},
            8: {"ul": {i: (3, "red") for i in range(2, 6)}, "hl": {i: "green" for i in range(18, 21)}},
            9: {"groups": [(0, 3, "box", "purple")]},
            11: {"hl": {0: "yellow", 4: "yellow", 8: "yellow"}, "ul": {i: (2, "red") for i in (21, 22)},
                 "groups": [(0, 0, "ring", "blue"), (24, 24, "ring", "blue")]},
            12: {"hl": {i: "orange" for i in range(7, 10)}, "groups": [(9, 9, "ring", "blue")]},
            13: {"ul": {i: (2, "red") for i in (21, 22)}, "hl": {i: "green" for i in range(10, 14)}}}
    rd, tx, top = reader(f, w, W - w, V, marks=many, margin="open")
    gx = w + tx - 4
    gutter_arrow(f, gx, verse_y(V, top, 11), verse_y(V, top, 12), "orange", "arrow 11-12")
    gutter_arrow(f, gx, verse_y(V, top, 7), verse_y(V, top, 13), "purple", "arrow 7-13")
    for v, tok in ((11, "threadA"), (12, "threadB")):
        frame(f, f"folder tab {v}", x=w + 6, y=verse_y(V, top, v) - 9, w=5, h=18, radius=2, fill=tok, W="fixed",
              H="fixed")
    mx = w + tx + 600 + 44
    margin_note(f, mx, verse_y(V, top, 7) - 14, span="25:7-8")
    margin_note(f, mx, verse_y(V, top, 11) - 14, span="25:11", q=True)
    pnl = K.floating(f, "marks panel", W - 300, TB + 12, 270)
    text(pnl, "Marks shown", "heading")
    for label, ic, _k in KINDS[:5]:
        rr = row(pnl, label, gap=8, W="fill")
        icon(rr, ic, 16, "fg")
        text(rr, label, "small", W="fill")
        frame(rr, "on", w=14, h=14, radius=3, fill="accent", W="fixed", H="fixed")
    P.button(pnl, "Reading mode", "secondary", "eye", size="sm", W="fill")

    f = win(r, "F2 · Narrow window (row 50)", "MK7-22: the bar's narrow layout, a fixed size (kinds above, styles "
            "below), not stretched; the margin as signs; a sign opens its note in a popover.", w=760)
    w = K.M.rail5(f)
    K.M.slim_bar(f, x=w, w=760 - w)
    rd, tx, top = reader(f, w, 760 - w, V, marks=MARKS, sel=(12, 6, 9), margin="signs", width=560)
    for v in (7, 11):
        sign(f, w + tx + 560 + 20, verse_y(V, top, v, cpl=58) - 11)
    b = col(f, "mark bar (narrow)", gap=6, pad=[6, 8, 6, 8], fill="surface", radius=12, stroke="line", sw=1, W="hug")
    Q.put(b, w + tx - 4, verse_y(V, top, 12, cpl=58) - 96)
    shadow(b, 6, 20, "#00000026")
    k1 = row(b, "kinds", gap=4)
    for label, ic, _k in KINDS:
        kind_btn(k1, label, ic)
    vbar(k1)
    kind_btn(k1, "Legend", "legend")
    P.icon_button(k1, "plus", "accent", size=32, icon_size=18)
    k2 = row(b, "quick", gap=4)
    for e in LEGEND[:3]:
        style_chip(k2, e)

    r = row(cv, "F3", gap=64, align="min")
    f = win(r, "F3 · Colors across the Bible (rows 57, 58)",
            "MK7-29: every book a row of chapter cells; a cell shows the styles in it as small bars. The filter picks "
            "one style or one folder: its chapters fill, and the empty cells are its gaps. A click opens that chapter.")
    w = app(f)
    pnl = K.panel(f, w, TB, W - w, H - TB, "Colors across the Bible", "Filter: Person (yellow highlight) · 212 marks in 61 chapters")
    fr = row(pnl, "filter", gap=6)
    for i, e in enumerate(LEGEND[:5]):
        style_chip(fr, e, on=(i == 0))
    P.chip(fr, "Folder: Phinehas", "outline", dot_color="threadA")
    import random
    rnd = random.Random(7)
    books = [("Genesis", 50), ("Exodus", 40), ("Leviticus", 27), ("Numbers", 36), ("Deuteronomy", 34),
             ("Joshua", 24), ("Judges", 21), ("Ruth", 4), ("1 Samuel", 31), ("2 Samuel", 24), ("1 Kings", 22),
             ("2 Kings", 25), ("Psalms", 150)]
    grid = col(pnl, "grid", gap=5, W="fill")
    for name, n in books:
        br = row(grid, name, gap=2)
        nm = text(br, name, "caption", "muted", width=90)
        S.do("node.set", {"ids": [nm], "props": {"width": 90, "textAutoResize": "none"}}, ref=False)
        for ch in range(min(n, 150)):
            on = (name == "Numbers" and ch == 24) or rnd.random() < 0.18
            frame(br, f"{name} {ch + 1}", w=7, h=14, radius=1.5, fill="hlYellow" if on else "sunken",
                  stroke="accent" if (name == "Numbers" and ch == 24) else None, sw=1.5, W="fixed", H="fixed")
    K.note(f, "Cells drawn here are a sample. Empty cells are the gaps: where this style has never been used.",
           W - 470, H - 120)


def sheets(board):
    sheet_a(board)
    sheet_b(board)
    sheet_c(board)
    sheet_d(board)
    sheet_e(board)
    sheet_f(board)


if __name__ == "__main__":
    K.run_board(HERE, "Marks", sheets)
