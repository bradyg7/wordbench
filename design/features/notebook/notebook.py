"""The Notebook, round 2: Notion's quality as the template (N1-N12). Nothing is built from this until the person
accepts it. Scripture comes from `wb` (read-only database) via kit.fetch into data/; page titles and notes are a drawn
sample, never anyone's study.

    python -B design/features/notebook/notebook.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent / "library"))

import kit as K  # noqa: E402
from kit import F, M, P, Q, S, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402
import library as L  # noqa: E402  (round 4's side list, accepted 2026-11-17)

W, H, TB = K.W, K.H, K.TB
BOARD = "Notebook round 2"

for k, d in {
    "link": "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    "lock": "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
    "palette": "M12 4a8 8 0 1 0 0 16c1 0 1.5-.7 1.5-1.5S13 17 13 16.2c0-.9.7-1.4 1.6-1.4H17a3 3 0 0 0 3-3C20 7.4 16.4 4 12 4zM8 11h.5M11 8h.5M15 8.5h.5",
    "clock": "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 8v4l3 2",
    "star": "M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
    "at": "M16 12a4 4 0 1 1-1.2-2.8M16 9v4.5a2 2 0 0 0 4 0V12a8 8 0 1 0-3 6.2",
    "table": "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
    "toc": "M5 7h14M8 12h11M8 17h11",
    "text": "M6 8V6h12v2M12 6v12M9.5 18h5",
    "full": "M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3",
}.items():
    F.ICONS.setdefault(k, d)

# ---- scripture, fetched (never typed) ---------------------------------------------------------------------------------
WB_MAIN = Path(r"C:\Users\brady\github\bible-workbench-rs")
if not any((K.REPO / "target" / b / "wb.exe").exists() for b in ("release", "debug")):
    K.REPO = WB_MAIN   # this design checkout has no wb build; use the main checkout's (read-only database)


def scripture(name, ref):
    p = HERE / "data" / f"{name}.json"
    out = json.loads(p.read_text(encoding="utf-8"))["output"] if p.exists() else K.fetch(HERE, name, ["text", ref],
                                                                                          as_json=False)
    return out.splitlines()[0], K.verses_of(out)


NUM_REF, NUM = scripture("num25", "Num 25:11-13")
PS_REF, PS = scripture("ps106", "Ps 106:30-31")
V = {**{("num", v["v"]): v["text"] for v in NUM}, **{("ps", v["v"]): v["text"] for v in PS}}


def words(key, i, j):
    """A phrase cut from a fetched verse by word position, trailing punctuation dropped."""
    p = " ".join(V[key].split()[i:j]).rstrip(",.;:!?")
    assert p in V[key]
    return p


# ---- the one menu component (N1) --------------------------------------------------------------------------------------
SOFT = "#0000001A"


def pop(f, x, y, w, name="menu", pad=6):
    """A popover: soft, large radius, low-opacity shadow, no hard outline."""
    m = col(f, name, gap=1, pad=[pad, pad, pad, pad], fill="surface", radius=12, W="fixed")
    Q.put(m, x, y, w)
    shadow(m, 6, 28, SOFT)
    shadow(m, 1, 3, "#0000000F")
    return m


def msearch(m, typed=None, hint="Search"):
    r = row(m, "menu search", gap=8, pad=[6, 8, 8, 8], W="fill")
    icon(r, "search", 14, "muted")
    text(r, typed or hint, "small", "fg" if typed else "muted", W="fill")
    if typed:
        frame(r, "caret", w=1, h=16, fill="fg", W="fixed", H="fixed")


def mgroup(m, s):
    g = row(m, f"group/{s}", W="fill", pad=[8, 8, 3, 8])
    text(g, s, "caption", "muted")


def mrow(m, label, ic=None, key=None, on=False, sub=None, arrow=False, danger=False, check=False, swatch=None):
    r = row(m, f"m/{label}", gap=10, pad=[5, 8, 5, 8], radius=6, W="fill", fill="sunken" if on else None)
    if swatch:
        sw = frame(r, "swatch", w=20, h=20, radius=5, W="fixed", H="fixed", fill=swatch[1] or "surface",
                   stroke="line", sw=1, layout="horizontal", mainAlign="center", crossAlign="center")
        text(sw, "A", "smallStrong", swatch[0])
    elif ic:
        icon(r, ic, 16, "warn" if danger else "muted")
    tc = col(r, "t", gap=0, W="fill")
    text(tc, label, "small", "warn" if danger else "fg")
    if sub:
        text(tc, sub, "caption", "muted")
    if key:
        text(r, key, "caption", "muted")
    if check:
        icon(r, "check", 14, "fg")
    if arrow:
        icon(r, "right", 12, "muted")
    return r


def mfoot(m, *lines):
    P.divider(m)
    ft = col(m, "foot", gap=1, pad=[4, 8, 2, 8], W="fill")
    for s in lines:
        text(ft, s, "caption", "muted")


def sep(m):
    frame(m, "sep", w=10, h=1, fill="line", W="fill", H="fixed")


# ---- a page (built on round 4's S28) ----------------------------------------------------------------------------------
def top_bar(f, x, w, path, edited="Edited just now", lock=False):
    b = row(f, "page bar", gap=10, pad=[0, 16, 0, 16], fill="bg", W="fixed", H="fixed")
    Q.put(b, x, 0, w, TB)
    text(b, path, "small", "muted", maxLines=1)
    spacer(b)
    if lock:
        icon(b, "lock", 14, "muted")
    text(b, edited, "caption", "muted")
    icon(b, "more", 16, "muted")
    return b


def page(f, x, w, title, path="Phinehas", colw=680, top=TB, h=None, edited="Edited just now", ic=None,
         add_icon=False, bar=True, empty_title=False, lock=False, title_style="display", dot=None, serif=False):
    """The calm narrow centred column. Returns the column; each block row carries a 40 px gutter on its left."""
    if bar:
        top_bar(f, x, w, path, edited, lock)
    ed = frame(f, "page", x=x, y=top, w=w, h=(h or H - top), fill="bg", layout="vertical", W="fixed", H="fixed",
               clip=True, crossAlign="center", pad=[40, 0, 40, 0])
    pg = col(ed, "column", gap=4, W="fixed")
    Q.put(pg, 0, 0, colw + 40)
    if add_icon:
        hv = row(pg, "title hover", gap=6, pad=[0, 0, 4, 40])
        r = row(hv, "Add icon", gap=6, pad=[3, 8, 3, 6], radius=6, fill="sunken")
        icon(r, "star", 14, "muted")
        text(r, "Add icon", "small", "muted")
    if ic:
        ir = row(pg, "page icon", pad=[0, 0, 6, 40])
        icon(ir, ic, 44, "accent", weight=1.5)
    tr = row(pg, "title", gap=0, W="fill")
    frame(tr, "gutter", w=40, h=10, W="fixed", H="fixed")
    if empty_title:
        frame(tr, "caret", w=2, h=40, fill="fg", W="fixed", H="fixed")
        text(tr, "Untitled", title_style, "line", fontSize=40, lineHeight="48px")
    else:
        if dot:
            frame(tr, "folder color", w=12, h=12, radius=6, fill=dot, W="fixed", H="fixed")
            frame(tr, "gap", w=12, h=4, W="fixed", H="fixed")
        para(tr, title, "chapter" if serif else title_style, fontSize=40, lineHeight="48px")
    frame(pg, "after title", w=10, h=10, W="fill", H="fixed")
    return pg


def gutter(r, on):
    g = row(r, "gutter", gap=2, W="fixed", H="hug", pad=[3, 0, 0, 0])
    S.do("node.set", {"ids": [g], "props": {"width": 40}}, ref=False)
    if on:
        icon(g, "plus", 16, "muted")
        icon(g, "drag", 16, "muted" if on is True else "fg")
    return g


STY = {"h1": ("title", 28, 36), "h2": ("title", 22, 30), "h3": ("heading", 18, 26)}


def blk(pg, kind, s="", hover=False, sel=False, color=None, bg=None, hint=False, children=(), open_=True, ic=None,
        kname=None, wash=None):
    """One block. kind: p h1 h2 h3 li num todo quote divider toggle th(toggle heading) callout verse."""
    r = row(pg, f"block/{kind}/{s[:16]}", gap=0, W="fill", align="min", radius=4,
            fill=wash or ("#2E6FB81A" if sel else None))
    gutter(r, hover)
    body = row(r, "body", gap=8, W="fill", align="min", pad=[3, 4, 3, 4], radius=4, fill=bg)
    fg = color or "fg"
    if kind in STY:
        st, fs, lh = STY[kind]
        para(body, s, st, fg, fontSize=fs, lineHeight=f"{lh}px")
    elif kind == "li":
        text(body, "•", "body", "muted")
        para(body, s, "body", fg)
    elif kind == "num":
        text(body, kname or "1.", "body", "muted")
        para(body, s, "body", fg)
    elif kind == "todo":
        frame(body, "box", w=16, h=16, radius=3, stroke="muted", sw=1.5, W="fixed", H="fixed")
        para(body, s, "body", fg)
    elif kind == "quote":
        frame(body, "bar", w=3, h=22, fill="fg", W="fixed", H="fixed")
        para(body, s, "body", fg)
    elif kind == "divider":
        frame(body, "rule", w=10, h=1, fill="line", W="fill", H="fixed")
    elif kind in ("toggle", "th"):
        inner = col(body, "toggle", gap=4, W="fill")
        hr = row(inner, "head", gap=6, W="fill")
        icon(hr, "down" if open_ else "right", 14, "fg")
        if kind == "th":
            para(hr, s, "title", fg, fontSize=22, lineHeight="30px")
        else:
            para(hr, s, "body", fg)
        if open_:
            ch = col(inner, "children", gap=4, pad=[0, 0, 0, 20], W="fill")
            for c in children:
                para(ch, c, "body", "fg")
            if not children:
                para(ch, "Empty toggle. Click or drop blocks inside.", "body", "muted")
    elif kind == "callout":
        box = row(body, "callout", gap=10, pad=[12, 14, 12, 14], radius=8, fill=bg or "sunken", W="fill", align="min")
        icon(box, ic or "question", 18, "muted")
        cc = col(box, "c", gap=2, W="fill")
        text(cc, kname, "caption", "muted")
        para(cc, s, "body", fg)
    elif kind == "verse":
        key, vs, label = s
        vb = col(body, "scripture", gap=4, pad=[10, 14, 12, 14], radius=8, fill="surface", W="fill")
        hr = row(vb, "h", gap=8, W="fill")
        icon(hr, "book", 14, "accent")
        text(hr, label, "smallStrong", "accent", W="fill")
        text(hr, "KJV", "caption", "muted")
        for v in vs:
            para(vb, f"{v}  {V[(key, v)]}", "readSmall")
    else:
        if hint:
            para(body, s or "Press / for blocks", "body", "muted")
        else:
            P.rich(body, s) if "**" in s else para(body, s, "body", fg)
    return r


def app(f, on="Notebook", list_kw=None, side=True):
    w = M.rail5(f, on=on)
    if not side:
        return w
    return L.side_list(f, w, **(list_kw or {})) if list_kw is not None else L.side_list(f, w)


def win(parent, tag, about, w=W, h=H):
    return Q.win(parent, BOARD, tag, about, w=w, h=h)


# ---- sheets -----------------------------------------------------------------------------------------------------------
def menu_and_writing(board):
    cv = Q.section(board, "The menu and writing", 3200)
    Q.sheet_title(cv, "The menu and writing (N1 to N4)",
                  "One menu component for every menu (rows 1-2); a new page, the / menu, the selection bar and @ "
                  "(rows 3-12). Almost monochrome chrome, soft popovers, hints in quiet gray.")
    rr = row(cv, "row a", gap=64, align="min")

    f = win(rr, "N1 · The one menu component",
            "Rows 1-2. Every menu (/, block, page's three dots, @, Ctrl+K) is this one: a search line on top, groups in small "
            "gray, an icon on every row, shortcuts right-aligned and muted. Typing filters at once and the first "
            "match is highlighted; a group with no match hides. ↑ ↓ move, Enter picks, Esc or a click outside "
            "closes and the caret returns. It fades in place (about 120 ms); nothing on the page moves.")
    frame(f, "canvas", x=0, y=0, w=W, h=H, fill="bg")
    states = (("Open", None), ("Typing “hea”", "hea"), ("No match", "zzq"))
    for i, (lab, typed) in enumerate(states):
        x = 90 + i * 440
        text(f, lab, "smallStrong", "muted", x=x, y=60)
        m = pop(f, x, 96, 330)
        msearch(m, typed, "Search for a block")
        if typed is None:
            mgroup(m, "Basic")
            mrow(m, "Text", "text", on=True)
            mrow(m, "Heading 1", "text", "#")
            mrow(m, "Heading 2", "text", "##")
            mrow(m, "Bullet list", "list", "-")
            mgroup(m, "Study")
            mrow(m, "Scripture", "book", "/verse")
            mrow(m, "Callout", "question", "/callout")
        elif typed == "hea":
            mgroup(m, "Basic")
            mrow(m, "Heading 1", "text", "#", on=True)
            mrow(m, "Heading 2", "text", "##")
            mrow(m, "Heading 3", "text", "###")
            mrow(m, "Toggle heading", "right", ">#")
        else:
            r = row(m, "none", pad=[10, 8, 12, 8], W="fill")
            text(r, "No results", "small", "muted")
        mfoot(m, "↑↓ to move · Enter to pick · Esc to close")
    K.note(f, "The same component is drawn in N3 (/), N5 (block), N8 (page's three dots), N4 (@) and N10 (Ctrl+K).",
           90, 640, 600)

    f = win(rr, "N2 · A new page",
            "Row 3 and 29. The caret is in the title, a faint “Untitled”; Enter moves to the first line, which hints "
            "“Press / for blocks” in quiet gray. No Save: the bar says “Edited just now”. Nothing else on the page.")
    x = app(f)
    pg = page(f, x, W - x, "", path="Pages  /  Untitled", empty_title=True)
    blk(pg, "p", hint=True)
    K.note(f, "After Enter in the title the caret moves here; the hint goes as soon as a character is typed.",
           x + 170, 300, 420)

    rr = row(cv, "row b", gap=64, align="min")
    f = win(rr, "N3 · The / menu, grouped",
            "Rows 6-7. Typed on an empty line or after a space: the menu at the caret, grouped Basic and Study, with "
            "the Markdown shortcut on the right. Picking one puts the caret inside the new block (Scripture: its "
            "reference field). Heading 4, code and equations are not offered.")
    x = app(f, list_kw={"on": "Zeal in Numbers 25"})
    pg = page(f, x, W - x, "Zeal in Numbers 25", edited="Edited 2m ago")
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    blk(pg, "p", "/", hover=True)
    cx = x + (W - x - 720) // 2 + 44
    m = pop(f, cx, 200, 320)
    msearch(m, None, "Type to filter")
    mgroup(m, "Basic")
    for lab, ic, key in (("Text", "text", None), ("Heading 1", "text", "#"), ("Heading 2", "text", "##"),
                         ("Heading 3", "text", "###"), ("Bullet list", "list", "-"), ("Numbered list", "list", "1."),
                         ("To-do", "check", "[]"), ("Toggle list", "right", None), ("Quote", "text", ">"),
                         ("Divider", "minimize", "---"), ("Table", "table", None), ("Page", "page", None)):
        mrow(m, lab, ic, key, on=lab == "Text")
    m2 = pop(f, cx + 326, 200, 300)
    mgroup(m2, "Study")
    for lab, ic, key in (("Scripture", "book", "/verse"), ("Word", "word", "/word"), ("Callout", "question", "/callout"),
                         ("Saved thing", "bookmark", "/save"), ("List in a page", "table", "/list")):
        mrow(m2, lab, ic, key)
    mfoot(m2, "One menu, scrolled: Study follows Basic", "(drawn beside it here to show both groups)")

    f = win(rr, "N4 · The selection bar and @",
            "Rows 10-12. Selecting text shows a bar above it: Turn into ▾, B I U S, link, color ▾; on scripture "
            "text in a page also Mark ▾ (the Legend's styles, the same mark as the reader) and Margin note. "
            "@ then a reference, a page or a folder: verses, pages, folders and Today; a verse becomes a quiet "
            "link that opens the reader there, and Back returns.")
    x = app(f, list_kw={"on": "Zeal in Numbers 25"})
    pg = page(f, x, W - x, "Zeal in Numbers 25", edited="Edited just now")
    blk(pg, "verse", ("num", [11, 12], "Numbers 25:11–12"))
    blk(pg, "p", "Psalm 106 names him too: @ps 106:3")
    cx = x + (W - x - 720) // 2 + 44
    bar = row(f, "selection bar", gap=2, pad=[4, 6, 4, 6], fill="surface", radius=10)
    Q.put(bar, cx + 30, 200)
    shadow(bar, 4, 20, SOFT)
    tb = row(bar, "turn", gap=4, pad=[4, 8, 4, 8], radius=6)
    text(tb, "Text", "small")
    icon(tb, "down", 12, "muted")
    for s_ in ("B", "I", "U", "S"):
        b = row(bar, f"fmt/{s_}", pad=[4, 9, 4, 9], radius=6)
        text(b, s_, "smallStrong")
    for ic in ("link", "palette"):
        b = row(bar, f"fmt/{ic}", gap=2, pad=[4, 6, 4, 6], radius=6)
        icon(b, ic, 16, "fg")
        if ic == "palette":
            icon(b, "down", 12, "muted")
    frame(bar, "sep", w=1, h=18, fill="line", W="fixed", H="fixed")
    mk = row(bar, "Mark", gap=4, pad=[4, 8, 4, 8], radius=6, fill="sunken")
    icon(mk, "highlight", 15, "fg")
    text(mk, "Mark", "small")
    icon(mk, "down", 12, "muted")
    mn = row(bar, "Margin note", gap=4, pad=[4, 8, 4, 8], radius=6)
    icon(mn, "pen", 15, "fg")
    text(mn, "Margin note", "small")
    lm = pop(f, cx + 420, 244, 230)
    mgroup(lm, "Legend")
    for lab, c_ in (("Zeal", "hlOrange"), ("Covenant", "hlYellow"), ("Promise", "hlGreen"), ("Names", "hlBlue")):
        r = row(lm, f"legend/{lab}", gap=10, pad=[5, 8, 5, 8], radius=6, W="fill", fill="sunken" if lab == "Zeal" else None)
        frame(r, "sample", w=18, h=10, radius=2, fill=c_, W="fixed", H="fixed")
        text(r, lab, "small", W="fill")
    K.note(f, f"Selected: “{words(('num', 11), 18, 23)}” (Numbers 25:11, from the database).", W - 420, 830, 380)
    am = pop(f, cx + 60, 520, 330)
    msearch(am, "ps 106:3")
    mgroup(am, "Verses")
    mrow(am, "Psalm 106:30", "book", on=True, sub=words(("ps", 30), 0, 6) + "…")
    mrow(am, "Psalm 106:31", "book", sub=words(("ps", 31), 0, 6) + "…")
    mgroup(am, "Pages")
    mrow(am, "Zeal in Psalms 106", "page")
    mgroup(am, "Folders")
    mrow(am, "Phinehas", "folder")
    mrow(am, "Today", "pen", sub="Friday, November 20")


def blocks(board):
    cv = Q.section(board, "Blocks", 3200)
    Q.sheet_title(cv, "The block handle and callouts (N5, N6)",
                  "Rows 13-24. The + and grip show only on the block under the pointer, in the gutter, and the text "
                  "never shifts. Questions are one kind of callout.")
    rr = row(cv, "row c", gap=64, align="min")
    f = win(rr, "N5 · The block handle, its menu, a drag, several blocks",
            "Rows 13-21. Left: hover shows + and the grip (⋮⋮) in the gutter; clicking the grip opens the block "
            "menu with its foot (Edited, word count). Right: dragging shows a blue drop line where it lands; "
            "below, three blocks selected (drag across, Shift+click, or Esc) wear a pale wash and the grip menu "
            "acts on all.", w=W, h=H)
    w = M.rail5(f, on="Notebook")
    half = (W - w) // 2
    hv = frame(f, "left", x=w, y=0, w=half, h=H, fill="bg", W="fixed", H="fixed", clip=True)
    pg = page(hv, 0, half, "Haste study", path="Pages  /  Haste study", colw=520, edited="Edited 5m ago")
    blk(pg, "h2", "Running ahead")
    blk(pg, "p", "Read the chapter twice before writing anything about it.", hover="grip")
    blk(pg, "li", "Who acts first, and who waits?")
    blk(pg, "li", "What is promised afterwards?")
    m = pop(hv, 60, 330, 280)
    msearch(m, None, "Search actions")
    mrow(m, "Turn into", "text", arrow=True)
    mrow(m, "Color", "palette", arrow=True)
    sep(m)
    mrow(m, "Copy link to block", "link")
    mrow(m, "Duplicate", "copy", "Ctrl+D")
    mrow(m, "Move to", "folder", "Ctrl+Shift+P")
    mrow(m, "Delete", "trash", "Del", danger=True)
    mfoot(m, "Edited today, 14:02", "11 words")
    tm = pop(hv, 346, 370, 200)
    for lab, ic in (("Text", "text"), ("Heading 1", "text"), ("Heading 2", "text"), ("Heading 3", "text"),
                    ("Bullet list", "list"), ("Numbered list", "list"), ("To-do", "check"), ("Toggle list", "right"),
                    ("Quote", "text"), ("Callout", "question")):
        mrow(tm, lab, ic, check=lab == "Text")

    hv = frame(f, "right", x=w + half, y=0, w=W - w - half, h=H, fill="bg", W="fixed", H="fixed", clip=True,
               stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    pg = page(hv, 0, W - w - half, "Haste study", path="Pages  /  Haste study", colw=520, edited="Edited 5m ago")
    blk(pg, "h2", "Running ahead")
    blk(pg, "li", "Who acts first, and who waits?")
    frame(pg, "drop line", w=10, h=3, fill="#2E6FB8", radius=2, W="fill", H="fixed")
    blk(pg, "li", "What is promised afterwards?")
    ghost = row(hv, "dragged", gap=6, pad=[4, 8, 4, 8], radius=6, fill="surface", opacity=0.75)
    Q.put(ghost, 150, 300)
    shadow(ghost, 6, 20, SOFT)
    icon(ghost, "drag", 16, "fg")
    text(ghost, "Read the chapter twice before writing anything about it.", "body")
    frame(pg, "space", w=10, h=90, W="fill", H="fixed")
    blk(pg, "h3", "Three blocks selected")
    blk(pg, "p", "First reading: KJV.", sel=True, hover=True)
    blk(pg, "p", "Second reading: YLT.", sel=True)
    blk(pg, "p", "Third: aloud, slowly.", sel=True)
    m = pop(hv, 70, 640, 260)
    mgroup(m, "3 blocks")
    mrow(m, "Turn into", "text", arrow=True)
    mrow(m, "Color", "palette", arrow=True)
    mrow(m, "Move to", "folder", "Ctrl+Shift+P")
    mrow(m, "Delete", "trash", "Del", danger=True)

    f = win(rr, "N6 · Callouts: Question, Answered, Key point, Note",
            "Rows 22-24. A callout is a soft box with an icon and a kind. Clicking the icon opens its kind menu; a "
            "Question becomes Answered and back. Today's `> [!question]` and `> [!done]` read as Question and "
            "Answered, and the questions list still finds them.")
    x = app(f, list_kw={"on": "Zeal in Numbers 25"})
    pg = page(f, x, W - x, "Zeal in Numbers 25", edited="Edited just now")
    blk(pg, "verse", ("num", [13], "Numbers 25:13"))
    blk(pg, "callout", "Why “an everlasting priesthood” here, and how does Psalm 106:31 read it?", kname="Question",
        ic="question", bg="#EFEAF7")
    blk(pg, "callout", "Read Psalm 106:30–31 beside it: written on 12 November.", kname="Answered", ic="check",
        bg="#E6F0E3")
    blk(pg, "callout", "The covenant is given to him and to his seed after him.", kname="Key point", ic="star",
        bg="#F7EFD9")
    blk(pg, "callout", "Read the YLT of verse 13 next.", kname="Note", ic="pen", bg="sunken")
    cx = x + (W - x - 720) // 2 + 44
    m = pop(f, cx + 10, 360, 220)
    mgroup(m, "Kind")
    mrow(m, "Question", "question", check=True)
    mrow(m, "Answered", "check")
    mrow(m, "Key point", "star")
    mrow(m, "Note", "pen")
    K.note(f, "Callout is the word (the person, 2026-11-20): /callout makes one.", W - 430, 800, 400)


# The one annotation palette (round 2 answers): the Legend's highlight colors and the folders' colors, nothing else.
ANNOT = (("Yellow", "#A8861A", "hlYellow"), ("Green", "#3B7A3B", "hlGreen"), ("Blue", "#2E6FB8", "hlBlue"),
         ("Pink", "#B0457E", "hlPink"), ("Orange", "#D9822B", "hlOrange"), ("Purple", "#6B4FA0", "#E6DEF3"))


def annot_menu(f, x, y, w=250, on=None):
    m = pop(f, x, y, w)
    msearch(m, None, "Search colors")
    mgroup(m, "Color (marks and folders)")
    mrow(m, "Default", swatch=("fg", None), check=on is None)
    for nm, fg, _ in ANNOT:
        mrow(m, nm, swatch=(fg, None), on=nm == on)
    mgroup(m, "Background")
    for nm, _, bg in ANNOT:
        mrow(m, f"{nm} background", swatch=("fg", bg))
    return m


def folder_color_menu(f, x, y, w=320, added=False):
    m = pop(f, x, y, w)
    mgroup(m, "Phinehas · Color")
    for nm, fg, _ in ANNOT:
        mrow(m, nm, swatch=(fg, fg), check=nm == "Orange")
    if added:
        mrow(m, "Teal (added)", swatch=("#2B8A86", "#2B8A86"), on=True)
    sep(m)
    mrow(m, "Add one color", "plus", sub="joins the palette for marks, folders and pages")
    return m


def the_page(board):
    cv = Q.section(board, "The page and color", 3200)
    Q.sheet_title(cv, "The page and color (N7, N8, N13)",
                  "Rows 25-33. An icon before the title (no cover), toggles (written as <details>), the page's three "
                  "dots with Appearance, and the one annotation palette with a folder's color.")
    rr = row(cv, "row d", gap=64, align="min")
    f = win(rr, "N7 · The page: an icon, Add icon on hover, toggles",
            "Rows 9, 27-28. The icon sits before the title and in the side list. Hovering the title of a page "
            "without one shows “Add icon” above it (inset). A toggle list folds its children; a heading can be a "
            "toggle too (Ctrl+Enter or the triangle). Written as <details> in the page; folded or not is kept in settings/pages.json.")
    x = app(f, list_kw={"on": "Tuesday study"})
    pg = page(f, x, W - x, "Tuesday study", path="Pages  /  Tuesday study", ic="book", edited="Edited 1h ago")
    blk(pg, "th", "Numbers 25", children=("Read twice: the KJV, then the YLT.",))
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    blk(pg, "toggle", "Things to follow up", children=("Psalm 106:30–31 beside it.", "The YLT of verse 13."))
    blk(pg, "th", "Psalm 106", open_=False)
    blk(pg, "toggle", "Questions for Tuesday", open_=False)
    inset = frame(f, "inset", x=W - 470, y=620, w=440, h=230, fill="bg", radius=10, stroke="line", sw=1,
                  layout="vertical", clip=True)
    shadow(inset, 6, 24, SOFT)
    ip = col(inset, "c", gap=4, pad=[24, 20, 10, 20], W="fill")
    text(ip, "Hovering a title without an icon", "caption", "muted")
    hv = row(ip, "Add icon", gap=6, pad=[3, 8, 3, 6], radius=6, fill="sunken")
    icon(hv, "star", 14, "muted")
    text(hv, "Add icon", "small", "muted")
    para(ip, "Haste study", "display", fontSize=34, lineHeight="42px")
    ic_m = row(ip, "picker", gap=8, pad=[6, 0, 0, 0])
    for ic in ("book", "pen", "star", "question", "folder", "word", "highlight", "list"):
        b = row(ic_m, f"pick/{ic}", pad=[5, 5, 5, 5], radius=6, fill="sunken")
        icon(b, ic, 18, "muted")

    f = win(rr, "N8 · The page's three dots menu and Appearance",
            "Rows 30-33. Searchable, the same component: Copy link, Copy contents (scripture expanded verbatim from "
            "the database), Duplicate, Move to, Page history, Appearance ▸, Lock page, Move to Trash; at the foot "
            "Edited and the word count. Appearance changes the page at once. A locked page shows a quiet lock in "
            "the bar, and typing does nothing.")
    x = app(f, list_kw={"on": "Zeal in Numbers 25"})
    pg = page(f, x, W - x, "Zeal in Numbers 25", edited="Edited just now", lock=True)
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    m = pop(f, W - 300, 44, 280)
    msearch(m, None, "Search actions")
    mrow(m, "Copy link", "link")
    mrow(m, "Copy contents", "copy")
    mrow(m, "Duplicate", "copy", "Ctrl+D")
    mrow(m, "Move to", "folder", "Ctrl+Shift+P")
    sep(m)
    mrow(m, "Page history", "clock")
    mrow(m, "Appearance", "type", arrow=True, on=True)
    mrow(m, "Lock page", "lock", check=True)
    sep(m)
    mrow(m, "Move to Trash", "trash", danger=True)
    mfoot(m, "Edited today, 15:33", "412 words")
    ap = pop(f, W - 560, 300, 250)
    mgroup(ap, "Font")
    fr = row(ap, "fonts", gap=8, pad=[4, 8, 8, 8], W="fill")
    for nm, fam, on in (("Default", "fg", True), ("Serif", "fg", False)):
        b = col(fr, f"font/{nm}", gap=2, pad=[8, 8, 8, 8], radius=8, W="fill", fill="sunken" if on else None,
                stroke="accent" if on else "line", sw=1, crossAlign="center")
        if nm == "Serif":
            text(b, "Ag", "chapter", fontSize=22, lineHeight="28px")
        else:
            text(b, "Ag", "title", fontSize=22, lineHeight="28px")
        text(b, nm, "caption", "muted")
    for lab, ic, on in (("Small text", "text", False), ("Full width", "full", False), ("Table of contents", "toc", True)):
        r = row(ap, f"opt/{lab}", gap=10, pad=[5, 8, 5, 8], W="fill")
        icon(r, ic, 16, "muted")
        text(r, lab, "small", W="fill")
        Q.toggle(r, on)

    rr = row(cv, "row e", gap=64, align="min")
    f = win(rr, "N13 · One annotation palette; a folder's color",
            "Rows 25-26 (round 2 answers, replaces N9). Left: Color in the selection bar offers the app's one "
            "annotation palette, the same colors as marks and folders, plus Default; no free picker. Middle: a "
            "folder's three dots › Color picks from the same palette, or adds one new color to it. Right: the "
            "pages in that folder carry its color, a dot by the title and in the side list.", w=W, h=H)
    x = app(f, list_kw={"on": "Zeal in Numbers 25"})
    pg = page(f, x, W - x, "Zeal in Numbers 25", edited="Edited just now", dot="threadA")
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    annot_menu(f, x + 380, 330)
    folder_color_menu(f, x - 10, 160)



def finding(board):
    cv = Q.section(board, "Finding", 3200)
    Q.sheet_title(cv, "Finding (N10, N11)",
                  "Rows 34-36. Ctrl+K is the Library's one search with a live preview; the side list gets Recents "
                  "above round 4's groups; a list in a page is a table with the shared Filters button.")
    rr = row(cv, "row f", gap=64, align="min")
    f = win(rr, "N10 · Ctrl+K quick search",
            "Row 34. Left: empty, it shows Recents. Right: typing groups the results (Pages, Folders, Margin notes, "
            "Verses) and a live preview of the highlighted result fills the right; Enter opens it, Esc returns "
            "where you were.")
    x = app(f, list_kw={"on": "Tuesday study"})
    pg = page(f, x, W - x, "Tuesday study", path="Pages  /  Tuesday study", ic="book", edited="Edited 1h ago")
    blk(pg, "p", "Numbers 25 and Psalm 106.")
    frame(f, "scrim", x=0, y=0, w=W, h=H, fill="#0000001F")
    text(f, "Empty", "smallStrong", "onAccent", x=44, y=84)
    text(f, "Typing “zeal”", "smallStrong", "onAccent", x=434, y=84)
    m = pop(f, 40, 110, 360, pad=8)
    msearch(m, None, "Search pages, folders, verses")
    mgroup(m, "Recents")
    for lab, ic, sub in (("Tuesday study", "book", "Pages"), ("Zeal in Numbers 25", "page", "Phinehas"),
                         ("Haste study", "page", "Pages"), ("Phinehas", "folder", "Folder"),
                         ("Friday, November 20", "pen", "Today"), ("SALT Bible Study Notes: Nov 12", "page", "Salt")):
        mrow(m, lab, ic, sub=sub, on=lab == "Tuesday study")
    mfoot(m, "↑↓ · Enter to open · Esc to return")
    box = row(f, "quick search", gap=0, align="min", fill="surface", radius=12, W="fixed", H="fixed", clip=True)
    Q.put(box, 430, 110, 960, 600)
    shadow(box, 8, 32, SOFT)
    lc = col(box, "results", gap=1, pad=[8, 8, 8, 8], W="fixed", H="fill")
    S.do("node.set", {"ids": [lc], "props": {"width": 420}}, ref=False)
    msearch(lc, "zeal")
    mgroup(lc, "Pages")
    mrow(lc, "Zeal in Numbers 25", "page", sub="Phinehas · Edited 2m ago", on=True)
    mrow(lc, "Zeal", "page", sub="Pages · Edited 3 Nov")
    mrow(lc, "Zeal in Psalms 106", "page", sub="Phinehas · Edited 1 Nov")
    mgroup(lc, "Folders")
    mrow(lc, "Phinehas", "folder", sub="56 saves and pages")
    mgroup(lc, "Margin notes")
    mrow(lc, "Numbers 25:11", "pen", sub="Margin note · 9 Nov")
    mgroup(lc, "Verses")
    mrow(lc, "Numbers 25:11", "book", sub=words(("num", 11), 0, 7) + "…")
    pv = col(box, "preview", gap=8, pad=[24, 28, 24, 28], fill="bg", W="fill", H="fill", clip=True,
             stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    text(pv, "Phinehas  /  Zeal in Numbers 25", "caption", "muted")
    para(pv, "Zeal in Numbers 25", "display")
    para(pv, "Where the word first appears in this story:", "body")
    vb = col(pv, "scripture", gap=4, pad=[10, 14, 12, 14], radius=8, fill="surface", W="fill")
    text(vb, "Numbers 25:11", "smallStrong", "accent")
    para(vb, "11  " + V[("num", 11)], "readSmall")
    para(pv, "And what is promised for it:", "body")

    f = win(rr, "N11 · Recents in the side list; a list in a page",
            "Rows 35-36. Recents (the last 8 pages opened, newest first, folding) sits above round 4's groups: Today "
            "when on, Pinned, Folders, Pages, then Margin notes and the Shelf at the foot. In the page, a list in a "
            "page is a table of the pages matching a line, with the shared Filters button above it.")
    w = M.rail5(f, on="Notebook")
    t = col(f, "side list", gap=1, pad=[10, 8, 10, 8], fill="sunken", W="fixed", H="fixed", clip=True,
            stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(t, w, TB, 270, H - TB)
    top = row(t, "top", gap=6, W="fill", pad=[0, 0, 6, 0])
    P.field(top, "Search pages", None, icon_name="search", height=30)
    icon(top, "pen", 16, "muted")
    hd = row(t, "head/RECENTS", gap=6, W="fill", pad=[10, 6, 3, 6])
    text(hd, "RECENTS", "label", "muted", W="fill")
    text(hd, "8", "caption", "muted")
    icon(hd, "down", 11, "muted")
    for lab in ("Word studies index", "Tuesday study", "Zeal in Numbers 25", "Haste study", "Friday, November 20",
                "SALT Bible Study Notes: Nov 12", "Prayer list", "Zeal"):
        L.side_row(t, lab, on=lab == "Word studies index")
    L.side_list_body(t, today=True, search=False, salt_open=False)
    x = w + 270
    pg = page(f, x, W - x, "Word studies index", path="Pages  /  Word studies index", edited="Edited 3d ago")
    blk(pg, "p", "Every word study page, newest first:")
    tr = row(pg, "list head", gap=8, W="fill", pad=[6, 0, 6, 40])
    text(tr, "Pages · folder Word studies · has a question", "caption", "muted", W="fill")
    P.button(tr, "Filters · 2", icon_name="filter", size="sm")
    tbl = col(pg, "table", gap=0, W="fill", pad=[0, 0, 0, 40])
    for i, cells in enumerate((("Title", "Folder", "Questions", "Edited"),
                               ("Zeal", "Word studies", "2 open", "3 Nov"),
                               ("Zeal in Psalms 106", "Word studies", "1 open", "1 Nov"),
                               ("Covenant of peace", "Word studies", "1 open", "28 Oct"),
                               ("Haste", "Word studies", "3 open", "20 Oct"))):
        r = row(tbl, f"tr/{i}", gap=0, W="fill", stroke="line", strokeBottomWeight=1, strokeTopWeight=1 if i == 0 else 0,
                strokeLeftWeight=0, strokeRightWeight=0)
        for j, c_ in enumerate(cells):
            cc = row(r, f"td/{j}", pad=[7, 8, 7, 8], W="fill" if j == 0 else "fixed")
            if j:
                S.do("node.set", {"ids": [cc], "props": {"width": 120}}, ref=False)
            if i == 0:
                text(cc, c_, "caption", "muted")
            elif j == 0:
                icon(cc, "page", 14, "muted")
                text(cc, c_, "small")
            else:
                text(cc, c_, "small", "muted")
    nr = row(tbl, "new", pad=[7, 8, 7, 8], W="fill")
    text(nr, "4 pages", "caption", "muted")


def conditions(board):
    cv = Q.section(board, "Real conditions", 3200)
    Q.sheet_title(cv, "Real conditions (N12)",
                  "Row 37. The same page as a floating tab over the reader, in a narrow pane beside it, on a phone "
                  "(menus become sheets), and as one tab among others.")
    rr = row(cv, "row g", gap=64, align="min")
    f = win(rr, "N12 · Floating tab",
            "The page floats over the reader at a small size: the column fits, the gutter's + and grip sit inside "
            "the margin, and the selection bar wraps to two lines. The reader's verse stays where it was.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    K.reader(f, w, W - w, NUM, "Numbers 25")
    fw = frame(f, "float", x=w + 520, y=TB + 60, w=520, h=640, fill="bg", radius=12, layout="vertical", W="fixed",
               H="fixed", clip=True)
    shadow(fw, 12, 40, "#00000026")
    M.folder_strip(fw, ["Zeal in Numbers 25", "Haste study"], "Zeal in Numbers 25")
    inner = frame(fw, "inner", w=520, h=600, W="fixed", H="fixed", clip=True)
    pg = page(inner, 0, 520, "Zeal in Numbers 25", colw=420, top=0, h=600, bar=False)
    blk(pg, "p", "Where the word first appears in this story:", hover=True)
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    bar = col(f, "selection bar", gap=2, pad=[4, 6, 4, 6], fill="surface", radius=10, W="fixed")
    Q.put(bar, w + 600, TB + 230, 220)
    shadow(bar, 4, 20, SOFT)
    r1 = row(bar, "l1", gap=6)
    for s_ in ("Text ▾", "B", "I", "U", "S"):
        text(r1, s_, "smallStrong")
    icon(r1, "link", 15, "fg")
    icon(r1, "palette", 15, "fg")
    r2 = row(bar, "l2", gap=8)
    text(r2, "Mark ▾", "smallStrong")
    text(r2, "Margin note", "smallStrong")

    f = win(rr, "N12 · Narrow pane beside the reader",
            "A 420 px pane: the column fills it with a 16 px side gutter; the handle sits inside the margin; the / "
            "menu stays inside the pane, anchored to the caret.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    K.reader(f, w, W - w - 420, NUM, "Numbers 25", width=560)
    pane = frame(f, "pane", x=W - 420, y=TB, w=420, h=H - TB, fill="bg", layout="vertical", W="fixed", H="fixed",
                 clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
                 strokeBottomWeight=0)
    P.pane_header(pane, ["Zeal in Numbers 25"], "Zeal in Numbers 25")
    inner = frame(pane, "inner", w=420, h=H - TB - 40, W="fixed", H="fixed", clip=True)
    pg = page(inner, 0, 420, "Zeal in Numbers 25", colw=340, top=0, h=H - TB - 40, bar=False)
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    blk(pg, "p", "/", hover=True)
    m = pop(f, W - 390, 560, 300)
    msearch(m, None, "Type to filter")
    mgroup(m, "Basic")
    mrow(m, "Text", "text", on=True)
    mrow(m, "Heading 1", "text", "#")
    mgroup(m, "Study")
    mrow(m, "Scripture", "book", "/verse")

    rr = row(cv, "row h", gap=64, align="min")
    f = win(rr, "N12 · Phone: menus as sheets",
            "At phone width the / menu (and every menu) is a bottom sheet with the same search, groups and rows.", w=390, h=844)
    pg = page(f, 0, 390, "Zeal in Numbers 25", colw=320, edited="Edited just now", path="Phinehas")
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    frame(f, "scrim", x=0, y=0, w=390, h=844, fill="#0000002E")
    sh = col(f, "sheet", gap=1, pad=[8, 12, 24, 12], fill="surface", radius=16, W="fixed")
    Q.put(sh, 0, 420, 390)
    grab = row(sh, "grab", W="fill", mainAlign="center", pad=[2, 0, 8, 0])
    frame(grab, "handle", w=36, h=4, radius=2, fill="line", W="fixed", H="fixed")
    msearch(sh, None, "Search for a block")
    mgroup(sh, "Basic")
    for lab, ic, key in (("Text", "text", None), ("Heading 1", "text", "#"), ("Bullet list", "list", "-"),
                         ("To-do", "check", "[]")):
        mrow(sh, lab, ic, key, on=lab == "Text")
    mgroup(sh, "Study")
    mrow(sh, "Scripture", "book", "/verse")
    mrow(sh, "Callout", "question", "/callout")

    f = win(rr, "N12 · Among other tabs",
            "The page as one tab in a pane with others (the reader, a word, another page): the column keeps its "
            "width, the bar's “Edited just now” stays quiet, and switching tabs keeps the caret and scroll.",
            w=W - 454, h=H)
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - 454 - w)
    pane = frame(f, "pane", x=w, y=TB, w=W - 454 - w, h=H - TB, fill="bg", layout="vertical", W="fixed", H="fixed",
                 clip=True)
    P.pane_header(pane, ["Numbers 25", "Zeal in Numbers 25", "H7065", "Haste study", "Tuesday study"],
                  "Zeal in Numbers 25")
    inner = frame(pane, "inner", w=W - 454 - w, h=H - TB - 40, W="fixed", H="fixed", clip=True)
    pg = page(inner, 0, W - 454 - w, "Zeal in Numbers 25", colw=620, top=0, h=H - TB - 40, bar=False)
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11, 12], "Numbers 25:11–12"))
    blk(pg, "callout", "How does Psalm 106:31 read this?", kname="Question", ic="question", bg="#EFEAF7")


# ---- one frame per interaction row (round 2 answers): rows/<id>.png and rows/index.json -------------------------------
RW, RH, CW, CH = 1600, 1000, 1440, 860
ROWS = []          # (id, row, caption, draw)


def r_(rid, caption):
    def deco(fn):
        ROWS.append((str(rid), int(re.match(r"\d+", str(rid)).group()), caption, fn))
        return fn
    return deco


def row_frames(start_y):
    for i, (rid, num, cap, fn) in enumerate(ROWS):
        fr = frame(None, f"Row frame {rid}", x=-4000, y=start_y + i * (RH + 200), w=RW, h=RH, fill="sunken",
                   W="fixed", H="fixed", clip=True)
        hd = row(fr, "head", gap=14, W="fixed")
        Q.put(hd, 80, 32, CW)
        pill = row(hd, "pill", pad=[4, 12, 4, 12], fill="accent", radius=999)
        text(pill, f"Row {rid}", "smallStrong", "onAccent")
        para(hd, cap, "heading")
        c = frame(fr, "content", x=80, y=110, w=CW, h=CH, fill="bg", radius=10, stroke="line", sw=1, W="fixed",
                  H="fixed", clip=True)
        shadow(c, 8, 30, SOFT)
        fn(c)


def label(f, s, x, y):
    t = row(f, f"label/{s}", pad=[3, 10, 3, 10], radius=999, fill="fg")
    Q.put(t, x, y)
    text(t, s, "smallStrong", "onAccent")


def halves(f, a="Before", b="After", w=None):
    w = w or CW // 2
    l_ = frame(f, "left", x=0, y=0, w=w, h=CH, fill="bg", W="fixed", H="fixed", clip=True)
    r = frame(f, "right", x=w, y=0, w=CW - w, h=CH, fill="bg", W="fixed", H="fixed", clip=True, stroke="line",
              strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    label(f, a, 20, 60)
    label(f, b, w + 20, 60)
    return l_, r


def hp(h, title="Haste study", path="Pages  /  Haste study", **kw):
    return page(h, 0, CW // 2, title, path=path, colw=520, **kw)


def full(f, title="Zeal in Numbers 25", side=True, **kw):
    lk = kw.pop("list_kw", {"on": title})
    x = app(f, list_kw=lk) if side else M.rail5(f, on="Notebook")
    return x, page(f, x, CW - x, title, colw=620, h=CH - TB, **kw)


def cxof(x):
    return x + (CW - x - 660) // 2 + 44


def toast(f, s, x=None, y=CH - 80):
    t = row(f, "toast", gap=10, pad=[10, 16, 10, 16], radius=10, fill="fg")
    Q.put(t, x if x is not None else CW // 2 - 140, y)
    shadow(t, 6, 24, SOFT)
    text(t, s, "small", "onAccent")


def caret_line(pg, before, typed, after_hint=None):
    r = row(pg, "typing", gap=0, W="fill")
    gutter(r, False)
    b = row(r, "b", gap=0, pad=[3, 4, 3, 4])
    if typed:
        text(b, typed, "body", "accent")
    if before:
        text(b, before, "body")
    frame(b, "caret", w=2, h=20, fill="fg", W="fixed", H="fixed")
    if after_hint:
        text(b, "   " + after_hint, "caption", "muted")


@r_(1, "Type while a menu is open: rows filter at once, the first match is highlighted, empty groups hide.")
def _r1(f):
    x, pg = full(f)
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "p", "/hea", hover=True)
    m = pop(f, cxof(x), 260, 320)
    msearch(m, "hea")
    mgroup(m, "Basic")
    mrow(m, "Heading 1", "text", "#", on=True)
    mrow(m, "Heading 2", "text", "##")
    mrow(m, "Heading 3", "text", "###")
    mrow(m, "Toggle heading", "right")
    mfoot(m, "Study has no match, so it hides")
    m = pop(f, cxof(x) + 360, 260, 260)
    msearch(m, "zzq")
    r = row(m, "none", pad=[10, 8, 12, 8], W="fill")
    text(r, "No results", "small", "muted")


@r_(2, "↑ ↓ move the highlight, Enter picks, Esc or a click outside closes; the caret returns and nothing moved.")
def _r2(f):
    a, b = halves(f, "↓ ↓ then Enter", "Esc")
    pg = hp(a)
    blk(pg, "p", "/", hover=True)
    m = pop(a, 110, 260, 300)
    msearch(m, None, "Type to filter")
    for i, (lab, ic, k) in enumerate((("Text", "text", None), ("Heading 1", "text", "#"), ("Heading 2", "text", "##"),
                                      ("Bullet list", "list", "-"))):
        mrow(m, lab, ic, k, on=i == 2)
    mfoot(m, "↑↓ to move · Enter to pick · Esc to close")
    pg = hp(b)
    caret_line(pg, "", None, "the menu closed; the caret is back where / was typed")


@r_(3, "A new page: the caret is in a faint “Untitled”; Enter moves to a first line that hints “Press / for blocks”.")
def _r3(f):
    x, pg = full(f, "", empty_title=True, path="Pages  /  Untitled", list_kw={})
    blk(pg, "p", hint=True)


@r_(4, "Type “## ” at the start of a line: it becomes Heading 2 at once. Ctrl+Z gives back the typed characters.")
def _r4(f):
    a, b = halves(f, "Typing “## ”", "At once")
    pg = hp(a)
    caret_line(pg, "", "## ")
    pg = hp(b)
    blk(pg, "h2", "Running ahead")
    K.note(b, "The same for # ### - 1. [] > ---", 80, 400, 360)


@r_(5, "**word** or Ctrl+B makes bold in place; *word* or Ctrl+I italic; Ctrl+U underline.")
def _r5(f):
    a, b = halves(f, "Typing **first**", "In place")
    pg = hp(a)
    caret_line(pg, "Who acts **first**", None)
    pg = hp(b)
    r = row(pg, "line", gap=0, W="fill")
    gutter(r, False)
    bb = row(r, "b", gap=4, pad=[3, 4, 3, 4])
    text(bb, "Who acts", "body")
    text(bb, "first", "bodyStrong")
    text(bb, "?", "body")


@r_(8, "In a list: Enter makes a new item, Tab indents, Shift+Tab outdents, Enter on an empty item leaves the list.")
def _r8(f):
    a, b = halves(f, "Enter, then Tab", "Enter on an empty item")
    pg = hp(a)
    blk(pg, "li", "Who acts first, and who waits?")
    r = row(pg, "nested", gap=8, W="fill", pad=[3, 4, 3, 64])
    text(r, "◦", "body", "muted")
    text(r, "Read verse 7 again", "body")
    frame(r, "caret", w=2, h=20, fill="fg", W="fixed", H="fixed")
    pg = hp(b)
    blk(pg, "li", "Who acts first, and who waits?")
    blk(pg, "li", "What is promised afterwards?")
    caret_line(pg, "", None, "a plain line: the list ended")


@r_(9, "Click the triangle (or Ctrl+Enter): the toggle folds and unfolds; a heading can be a toggle. Kept as <details>.")
def _r9(f):
    a, b = halves(f, "Open", "Folded")
    pg = hp(a, "Tuesday study", "Pages  /  Tuesday study")
    blk(pg, "th", "Numbers 25", children=("Read twice: the KJV, then the YLT.",))
    blk(pg, "toggle", "Things to follow up", children=("Psalm 106:30–31 beside it.", "The YLT of verse 13."))
    pg = hp(b, "Tuesday study", "Pages  /  Tuesday study")
    blk(pg, "th", "Numbers 25", open_=False)
    blk(pg, "toggle", "Things to follow up", open_=False)


def sel_bar(f, x, y, mark=True):
    bar = row(f, "selection bar", gap=2, pad=[4, 6, 4, 6], fill="surface", radius=10)
    Q.put(bar, x, y)
    shadow(bar, 4, 20, SOFT)
    tb = row(bar, "turn", gap=4, pad=[4, 8, 4, 8], radius=6)
    text(tb, "Text", "small")
    icon(tb, "down", 12, "muted")
    for s_ in ("B", "I", "U", "S"):
        b = row(bar, f"fmt/{s_}", pad=[4, 9, 4, 9], radius=6)
        text(b, s_, "smallStrong")
    for ic in ("link", "palette"):
        b = row(bar, f"fmt/{ic}", gap=2, pad=[4, 6, 4, 6], radius=6, fill=None if mark else "sunken")
        icon(b, ic, 16, "fg")
    if mark:
        frame(bar, "sep", w=1, h=18, fill="line", W="fixed", H="fixed")
        mk = row(bar, "Mark", gap=4, pad=[4, 8, 4, 8], radius=6, fill="sunken")
        icon(mk, "highlight", 15, "fg")
        text(mk, "Mark", "small")
        icon(mk, "down", 12, "muted")
        mn = row(bar, "Margin note", gap=4, pad=[4, 8, 4, 8], radius=6)
        icon(mn, "pen", 15, "fg")
        text(mn, "Margin note", "small")
    return bar


@r_(10, "Select text: a bar appears above it. On scripture in a page it adds Mark and Margin note.")
def _r10(f):
    x, pg = full(f)
    blk(pg, "verse", ("num", [11, 12], "Numbers 25:11–12"))
    sel_bar(f, cxof(x) + 40, 190)
    K.note(f, f"Selected: “{words(('num', 11), 18, 23)}” (Numbers 25:11, from the database).", cxof(x) + 40, 600, 420)


@r_(11, "Mark ▾ on scripture in a page: the Legend's styles; the mark is the reader's mark, on the same words.")
def _r11(f):
    a, b = halves(f, "Mark ▾", "In the reader too")
    pg = hp(a, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    lm = pop(a, 200, 330, 230)
    mgroup(lm, "Legend")
    for lab, c_ in (("Zeal", "hlOrange"), ("Covenant", "hlYellow"), ("Promise", "hlGreen")):
        r = row(lm, f"legend/{lab}", gap=10, pad=[5, 8, 5, 8], radius=6, W="fill", fill="sunken" if lab == "Zeal" else None)
        frame(r, "sample", w=18, h=10, radius=2, fill=c_, W="fixed", H="fixed")
        text(r, lab, "small", W="fill")
    rd = col(b, "reader", gap=10, pad=[110, 60, 40, 60], W="fixed")
    Q.put(rd, 0, 0, CW // 2)
    text(rd, "Numbers 25", "chapter")
    para(rd, "11  " + V[("num", 11)], "readDesk")
    hl = row(rd, "marked", gap=8, pad=[4, 8, 4, 8], radius=4, fill="hlOrange")
    text(hl, words(("num", 11), 18, 23), "readSmall")
    text(rd, "Marked: Zeal (the same mark, made from the page)", "caption", "muted")


def at_scene(f, chip):
    a, b = halves(f, "@ then a reference", "Picked")
    pg = hp(a, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "p", "Psalm 106 names him too: @ps 106:3")
    am = pop(a, 120, 250, 330)
    msearch(am, "ps 106:3")
    mgroup(am, "Verses")
    mrow(am, "Psalm 106:30", "book", on=True, sub=words(("ps", 30), 0, 6) + "…")
    mrow(am, "Psalm 106:31", "book", sub=words(("ps", 31), 0, 6) + "…")
    mgroup(am, "Pages")
    mrow(am, "Zeal in Psalms 106", "page")
    mgroup(am, "Folders")
    mrow(am, "Phinehas", "folder")
    mrow(am, "Today", "pen", sub="Friday, November 20")
    pg = hp(b, "Zeal in Numbers 25", "Phinehas")
    r = row(pg, "line", gap=0, W="fill")
    gutter(r, False)
    bb = row(r, "b", gap=6, pad=[3, 4, 3, 4])
    text(bb, "Psalm 106 names him too:", "body")
    if chip:
        P.chip(bb, "Psalm 106:30", "outline", icon_name="book")
    else:
        u = col(bb, "underlined", gap=1, W="hug")
        text(u, "Psalm 106:30", "body")
        frame(u, "underline", w=10, h=1, fill="muted", W="fill", H="fixed")
    K.note(b, "Clicking it opens the reader at Psalm 106:30; Back returns here.", 80, 300, 380)


@r_(13, "Hover a block: + and the grip appear in the gutter. The text does not move.")
def _r13(f):
    a, b = halves(f, "Not hovered", "Hovered")
    for h, on in ((a, False), (b, True)):
        pg = hp(h)
        blk(pg, "h2", "Running ahead")
        blk(pg, "p", "Read the chapter twice before writing anything about it.", hover=on)
        blk(pg, "li", "Who acts first, and who waits?")


@r_(14, "Click +: a new empty line below, with the / menu already open.")
def _r14(f):
    a, b = halves(f, "Click +", "New line, menu open")
    pg = hp(a)
    blk(pg, "p", "Read the chapter twice before writing anything about it.", hover=True)
    pg = hp(b)
    blk(pg, "p", "Read the chapter twice before writing anything about it.")
    blk(pg, "p", "/", hover=True)
    m = pop(b, 110, 300, 280)
    msearch(m, None, "Type to filter")
    mrow(m, "Text", "text", on=True)
    mrow(m, "Heading 1", "text", "#")
    mrow(m, "Bullet list", "list", "-")


@r_(15, "Drag the grip: a blue line shows where the block lands; dropping moves it.")
def _r15(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "h2", "Running ahead")
    blk(pg, "li", "Who acts first, and who waits?")
    frame(pg, "drop line", w=10, h=3, fill="#2E6FB8", radius=2, W="fill", H="fixed")
    blk(pg, "li", "What is promised afterwards?")
    ghost = row(f, "dragged", gap=6, pad=[4, 8, 4, 8], radius=6, fill="surface", opacity=0.8)
    Q.put(ghost, cxof(x) + 30, 360)
    shadow(ghost, 6, 20, SOFT)
    icon(ghost, "drag", 16, "fg")
    text(ghost, "Read the chapter twice before writing anything about it.", "body")


@r_(16, "Click the grip: the block menu, searchable, with Edited and the word count at its foot.")
def _r16(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "p", "Read the chapter twice before writing anything about it.", hover="grip")
    m = pop(f, cxof(x) - 30, 240, 290)
    msearch(m, None, "Search actions")
    mrow(m, "Turn into", "text", arrow=True)
    mrow(m, "Color", "palette", arrow=True)
    sep(m)
    mrow(m, "Copy link to block", "link")
    mrow(m, "Duplicate", "copy", "Ctrl+D")
    mrow(m, "Move to", "folder", "Ctrl+Shift+P")
    mrow(m, "Delete", "trash", "Del", danger=True)
    mfoot(m, "Edited today, 14:02", "11 words")


@r_(17, "Turn into ▸ Heading 2: the block changes kind and keeps its text.")
def _r17(f):
    a, b = halves(f, "Turn into ▸", "Kept its text")
    pg = hp(a)
    blk(pg, "p", "Running ahead", hover="grip")
    m = pop(a, 60, 250, 230)
    mrow(m, "Turn into", "text", arrow=True, on=True)
    tm = pop(a, 300, 250, 200)
    for lab in ("Text", "Heading 1", "Heading 2", "Heading 3", "Bullet list", "Callout"):
        mrow(tm, lab, "text", on=lab == "Heading 2", check=lab == "Text")
    pg = hp(b)
    blk(pg, "h2", "Running ahead")


@r_(19, "Move to: choose a page; the block leaves this page and is last in the chosen one.")
def _r19(f):
    a, b = halves(f, "Move to", "Moved")
    pg = hp(a)
    blk(pg, "p", "Read the chapter twice before writing anything about it.", hover="grip")
    m = pop(a, 100, 250, 320)
    msearch(m, "tues")
    mgroup(m, "Pages")
    mrow(m, "Tuesday study", "book", on=True, sub="Pages")
    mrow(m, "Questions for Tuesday", "page", sub="Salt")
    pg = hp(b, "Tuesday study", "Pages  /  Tuesday study")
    blk(pg, "p", "Numbers 25 and Psalm 106.")
    blk(pg, "p", "Read the chapter twice before writing anything about it.", wash="#2E6FB81A")
    toast(b, "Moved to Tuesday study", 160)


@r_(20, "Delete (or Del on a selected block): it goes, and “Deleted · Undo” offers the page's Undo.")
def _r20(f):
    a, b = halves(f, "Selected, Del", "Gone, with Undo")
    pg = hp(a)
    blk(pg, "h2", "Running ahead")
    blk(pg, "p", "Read the chapter twice before writing anything about it.", sel=True)
    blk(pg, "li", "Who acts first, and who waits?")
    pg = hp(b)
    blk(pg, "h2", "Running ahead")
    blk(pg, "li", "Who acts first, and who waits?")
    toast(b, "Deleted  ·  Undo", 220)


@r_(21, "Several blocks: drag across, Shift+click or Esc; a pale wash on each; the grip menu acts on all.")
def _r21(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "h3", "Readings")
    blk(pg, "p", "First reading: KJV.", sel=True, hover=True)
    blk(pg, "p", "Second reading: YLT.", sel=True)
    blk(pg, "p", "Third: aloud, slowly.", sel=True)
    m = pop(f, cxof(x) - 20, 360, 260)
    mgroup(m, "3 blocks")
    mrow(m, "Turn into", "text", arrow=True)
    mrow(m, "Color", "palette", arrow=True)
    mrow(m, "Move to", "folder", "Ctrl+Shift+P")
    mrow(m, "Delete", "trash", "Del", danger=True)


def callouts(pg):
    blk(pg, "callout", "Why “an everlasting priesthood” here?", kname="Question", ic="question", bg="#EFEAF7")
    blk(pg, "callout", "Read Psalm 106:30–31 beside it.", kname="Answered", ic="check", bg="#E6F0E3")
    blk(pg, "callout", "The covenant is given to him and to his seed after him.", kname="Key point", ic="star",
        bg="#F7EFD9")
    blk(pg, "callout", "Read the YLT of verse 13 next.", kname="Note", ic="pen", bg="sunken")


@r_(22, "/callout in the / menu makes a callout; its kinds are Question, Answered, Key point and Note.")
def _r22(f):
    a, b = halves(f, "/callout", "The four kinds")
    pg = hp(a, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "p", "/callout", hover=True)
    m = pop(a, 110, 250, 320)
    msearch(m, "callout")
    mgroup(m, "Study")
    mrow(m, "Callout", "question", "/callout", on=True, sub="Question, Answered, Key point, Note")
    pg = hp(b, "Zeal in Numbers 25", "Phinehas")
    callouts(pg)


@r_(23, "Click a callout's icon: its kind menu. A Question becomes Answered, and back.")
def _r23(f):
    a, b = halves(f, "Click the icon", "Answered")
    pg = hp(a, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "callout", "Why “an everlasting priesthood” here?", kname="Question", ic="question", bg="#EFEAF7")
    m = pop(a, 130, 250, 220)
    mgroup(m, "Kind")
    mrow(m, "Question", "question", check=True)
    mrow(m, "Answered", "check", on=True)
    mrow(m, "Key point", "star")
    mrow(m, "Note", "pen")
    pg = hp(b, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "callout", "Why “an everlasting priesthood” here?", kname="Answered", ic="check", bg="#E6F0E3")


@r_(24, "Today's pages: `> [!question]` and `> [!done]` show as Question and Answered; the questions list finds them.")
def _r24(f):
    a, b = halves(f, "In the file (unchanged)", "In the window")
    fl = col(a, "file", gap=4, pad=[16, 18, 16, 18], radius=8, fill="surface", stroke="line", sw=1, W="fixed")
    Q.put(fl, 60, 140, 600)
    for s_ in ("> [!question] Why “an everlasting priesthood” here?", " ", "> [!done] Read Psalm 106:30–31 beside it."):
        text(fl, s_, "small", "muted")
    pg = hp(b, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "callout", "Why “an everlasting priesthood” here?", kname="Question", ic="question", bg="#EFEAF7")
    blk(pg, "callout", "Read Psalm 106:30–31 beside it.", kname="Answered", ic="check", bg="#E6F0E3")


@r_(29, "Edit anything: “Edited just now” in quiet gray, later “Edited 2m ago”. There is no Save button.")
def _r29(f):
    a, b = halves(f, "While typing", "Two minutes later")
    pg = hp(a, edited="Edited just now")
    caret_line(pg, "Who acts first", None)
    pg = hp(b, edited="Edited 2m ago")
    blk(pg, "p", "Who acts first")


@r_(30, "The page's three dots: one searchable menu, with Edited and the word count at the foot.")
def _r30(f):
    x, pg = full(f)
    blk(pg, "p", "Where the word first appears in this story:")
    m = pop(f, CW - 300, 44, 280)
    msearch(m, None, "Search actions")
    for lab, ic, k in (("Copy link", "link", None), ("Copy contents", "copy", None), ("Duplicate", "copy", "Ctrl+D"),
                       ("Move to", "folder", "Ctrl+Shift+P")):
        mrow(m, lab, ic, k)
    sep(m)
    mrow(m, "Page history", "clock")
    mrow(m, "Appearance", "type", arrow=True)
    mrow(m, "Lock page", "lock")
    sep(m)
    mrow(m, "Move to Trash", "trash", danger=True)
    mfoot(m, "Edited today, 15:33", "412 words")


@r_(31, "Appearance ▸ Serif (or Small text, Full width, Table of contents): the page changes at once.")
def _r31(f):
    a, b = halves(f, "Default", "Serif")
    for h, serif in ((a, False), (b, True)):
        pg = hp(h, "Zeal in Numbers 25", "Phinehas", serif=serif)
        blk(pg, "p", "Where the word first appears in this story:")
    ap = pop(b, 420, 300, 250)
    mgroup(ap, "Font")
    for nm in ("Default", "Serif"):
        mrow(ap, nm, "type", check=nm == "Serif")
    for lab in ("Small text", "Full width", "Table of contents"):
        r = row(ap, f"opt/{lab}", gap=10, pad=[5, 8, 5, 8], W="fill")
        text(r, lab, "small", W="fill")
        Q.toggle(r, False)


@r_(32, "Lock page: a quiet lock in the bar, no handle, and typing does nothing.")
def _r32(f):
    x, pg = full(f, lock=True)
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    K.note(f, "Hovering shows no + or grip; keys do nothing until Lock page is turned off.", cxof(x), 600, 420)


@r_(33, "Copy contents: the page's Markdown, with scripture expanded verbatim from the database.")
def _r33(f):
    a, b = halves(f, "Copy contents", "On the clipboard")
    pg = hp(a, "Zeal in Numbers 25", "Phinehas")
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    m = pop(a, CW // 2 - 280, 44, 260)
    mrow(m, "Copy link", "link")
    mrow(m, "Copy contents", "copy", on=True)
    fl = col(b, "clipboard", gap=6, pad=[16, 18, 16, 18], radius=8, fill="surface", stroke="line", sw=1, W="fixed")
    Q.put(fl, 60, 140, 600)
    text(fl, "# Zeal in Numbers 25", "small", "muted")
    para(fl, "> Numbers 25:11 (KJV)", "small", "muted")
    para(fl, "> " + V[("num", 11)], "small", "muted")


# ---- round 3 (the person's review of round 2, README Directions) ------------------------------------------------------
APPROVED = {"2", "3", "4", "5", "8", "14", "15", "17", "20", "23", "24", "29", "33"}
ORDER = [1, 2, 3, 4, 5, 6, 7, 44, 8, 9, 10, 11, 39, 40, 12, 13, 41, 14, 15, 16, 17, 42, 18, 19, 20, 21, 43, 22, 23, 24,
         46, 25, 26, 29, 30, 31, 45, 32, 33, 34, 35, 36, 47, 37]


def raw(name, ref):
    """Scripture whose lines carry their own reference (ranges across chapters): [(label, text)]."""
    p = HERE / "data" / f"{name}.json"
    out = json.loads(p.read_text(encoding="utf-8"))["output"] if p.exists() else K.fetch(HERE, name, ["text", ref],
                                                                                          as_json=False)
    res = []
    for ln in out.splitlines()[1:]:
        m = re.match(r"((?:[1-3] )?[A-Za-z]+ \d+:\d+|\d+) (.*)", ln)
        if m:
            res.append((m.group(1), m.group(2)))
    return out.splitlines()[0], res


JOSH_REF, JOSH = raw("josh1", "Josh 1:9")
CROSS_REF, CROSS = raw("num25_26", "Num 25:18-26:1")
PSCH_REF, PSCH = raw("ps106ch", "Ps 106:28-33")
NUM18 = raw("num25_11_13", "Num 25:11-13")[1]

PLAIN = (("Gray", "#787774"), ("Brown", "#9F6B53"), ("Orange", "#C9711A"), ("Yellow", "#A8861A"),
         ("Green", "#3F7A55"), ("Blue", "#2F6FA3"), ("Purple", "#7E5AA6"), ("Red", "#B8433E"))
FOLDERS = (("Phinehas", "#D9822B"), ("Phinehas echoes", "#2E6FB8"), ("Salt", "#3B7A3B"), ("Anna", "#B0457E"),
           ("Word studies", "#6B4FA0"))


def passage(parent, label, lines, w=None, ref_field=False):
    vb = col(parent, f"scripture/{label}", gap=4, pad=[10, 14, 12, 14], radius=8, fill="surface", W="fill" if w is None else "fixed")
    if w:
        S.do("node.set", {"ids": [vb], "props": {"width": w}}, ref=False)
    hr = row(vb, "h", gap=8, W="fill")
    icon(hr, "book", 14, "accent")
    text(hr, label, "smallStrong", "accent", W="fill")
    text(hr, "KJV", "caption", "muted")
    for lab, t in lines:
        para(vb, f"{lab}  {t}", "readSmall")
    return vb


def in_gutter(pg, node_fn):
    r = row(pg, "block", gap=0, W="fill", align="min")
    gutter(r, False)
    b = col(r, "b", gap=0, W="fill", pad=[3, 4, 3, 4])
    return node_fn(b)


@r_("6a", "The / menu is one list: Basic blocks first, Study folded at its end. Typing finds any command by name.")
def _r6a(f):
    x, pg = full(f)
    blk(pg, "p", "Where the word first appears in this story:")
    blk(pg, "p", "/", hover=True)
    m = pop(f, cxof(x), 210, 320)
    msearch(m, None, "Type to filter")
    for lab, ic, k in (("Text", "text", None), ("Heading 1", "text", "#"), ("Heading 2", "text", "##"),
                       ("Heading 3", "text", "###"), ("Bullet list", "list", "-"), ("Numbered list", "list", "1."),
                       ("To-do", "check", "[]"), ("Toggle list", "right", None), ("Quote", "text", ">"),
                       ("Divider", "minimize", "---"), ("Table", "table", None)):
        mrow(m, lab, ic, k, on=lab == "Text")
    sep(m)
    st = row(m, "Study", gap=10, pad=[6, 8, 6, 8], radius=6, W="fill")
    icon(st, "right", 12, "muted")
    text(st, "Study", "smallStrong", "muted")
    text(st, "Scripture, Word, Callout, Saved thing, List", "caption", "muted", W="fill", maxLines=1)


@r_("6b", "Typing “scr” finds Scripture though Study is folded. The same list in a narrow pane and a floating tab.")
def _r6b(f):
    for i, (lab, w_) in enumerate((("Narrow pane", 460), ("Floating tab", 560))):
        x0 = 120 + i * 640
        hv = frame(f, lab, x=x0, y=100, w=w_, h=700, fill="bg", radius=12, stroke="line", sw=1, W="fixed", H="fixed",
                   clip=True)
        shadow(hv, 6, 24, SOFT)
        label(f, lab, x0, 60)
        pg = page(hv, 0, w_, "Zeal in Numbers 25", colw=w_ - 90, h=660, path="Phinehas")
        blk(pg, "p", "Where the word first appears in this story:")
        blk(pg, "p", "/scr", hover=True)
        m = pop(hv, 60, 270, min(320, w_ - 100))
        msearch(m, "scr")
        mgroup(m, "Study")
        mrow(m, "Scripture", "book", "/verse", on=True)
        mrow(m, "Saved thing", "bookmark", "/save", sub="“scr” is in its description")


@r_("7a", "A Scripture block: typing a book completes it (“josh” → Joshua), so the name and numbers cannot be wrong; "
           "the verse previews under the field.")
def _r7a(f):
    x, pg = full(f, "Courage", path="Pages  /  Courage", list_kw={"on": "Prayer list"})
    def fld(b):
        r = row(b, "field", gap=8, pad=[12, 14, 12, 14], radius=8, fill="surface", W="fill", stroke="accent", sw=1)
        icon(r, "book", 16, "accent")
        text(r, "Joshua 1:9", "body")
        frame(r, "caret", w=2, h=20, fill="fg", W="fixed", H="fixed")
        spacer(r)
        text(r, "Enter to place", "caption", "muted")
        pv = col(b, "preview", gap=2, pad=[8, 14, 4, 14], W="fill")
        text(pv, "Preview", "caption", "muted")
        para(pv, f"9  {JOSH[0][1]}", "readSmall", "muted")
    in_gutter(pg, fld)
    m = pop(f, cxof(x) + 40, 330, 300)
    msearch(m, "josh")
    mgroup(m, "Books")
    mrow(m, "Joshua", "book", "Tab", on=True, sub="24 chapters")
    K.note(f, "Drawn as the field fills: josh → Joshua, then 1:9; the preview is the database's text.", cxof(x) + 380,
           330, 300)


@r_("7b", "Several verses and ranges across chapters: Num 25:18–26:1 is one block, each verse with its reference.")
def _r7b(f):
    x, pg = full(f, "Courage", path="Pages  /  Courage", list_kw={"on": "Prayer list"})
    in_gutter(pg, lambda b: passage(b, CROSS_REF.split(" (")[0], CROSS))
    blk(pg, "p", "After the plague, the counting begins.")


def _mark_menu(f, x, y, pick=None):
    lm = pop(f, x, y, 240)
    msearch(lm, None, "Search the Legend")
    mgroup(lm, "Legend")
    for lab, c_ in (("Zeal", "hlOrange"), ("Covenant", "hlYellow"), ("Promise", "hlGreen"), ("Names", "hlBlue")):
        r = row(lm, f"legend/{lab}", gap=10, pad=[5, 8, 5, 8], radius=6, W="fill", fill="sunken" if lab == pick else None)
        frame(r, "sample", w=18, h=10, radius=2, fill=c_, W="fixed", H="fixed")
        text(r, lab, "small", W="fill")




@r_(41, "What + and the grip do: + adds a line below (Alt+click above); the grip drags the block, or opens its menu when clicked.")
def _r41(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "p", "Read the chapter twice before writing anything about it.", hover=True)
    blk(pg, "li", "Who acts first, and who waits?")
    cx = cxof(x)
    for (s_, dx, dy) in (("+  adds an empty line below, with / open", -260, 130),
                         ("⋮⋮  drag: move;  click: Turn into, Color, Duplicate, Move to, Delete", -260, 300)):
        n = col(f, "explain", gap=0, pad=[8, 10, 8, 10], radius=8, fill="#FFF4C2", W="fixed")
        Q.put(n, cx + 40, dy + 150, 460)
        para(n, s_, "small", "#5A4A00")


@r_(42, "Duplicate (Ctrl+D): a copy appears right below the block, with the caret in it.")
def _r42(f):
    a, b = halves(f, "Ctrl+D", "Copied below")
    pg = hp(a)
    blk(pg, "p", "First reading: KJV.", sel=True, hover=True)
    blk(pg, "p", "Second reading: YLT.")
    pg = hp(b)
    blk(pg, "p", "First reading: KJV.")
    blk(pg, "p", "First reading: KJV.", wash="#2E6FB81A")
    blk(pg, "p", "Second reading: YLT.")


@r_(43, "Drag in the margin to select several blocks: a pale band follows the pointer; every block it touches is selected.")
def _r43(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "h3", "Readings")
    blk(pg, "p", "First reading: KJV.", sel=True)
    blk(pg, "p", "Second reading: YLT.", sel=True)
    blk(pg, "p", "Third: aloud, slowly.")
    band = frame(f, "band", x=cxof(x) - 80, y=210, w=560, h=86, fill="#2E6FB814", stroke="#2E6FB8", sw=1, radius=2)


@r_("12a", "@ then a reference: the verse is placed as a link chip with its reference.")
def _r12a2(f):
    at_scene(f, True)


def chip_line(pg):
    r = row(pg, "line", gap=0, W="fill")
    gutter(r, False)
    bb = row(r, "b", gap=6, pad=[3, 4, 3, 4])
    text(bb, "Psalm 106 names him too:", "body")
    P.chip(bb, "Psalm 106:30", "selected", icon_name="book")


def verse_pop(f, x, y, w, h, lines, title, grown=False):
    pp = col(f, "verse popup", gap=8, pad=[10, 16, 14, 16], fill="surface", radius=12, W="fixed", H="fixed", clip=True)
    Q.put(pp, x, y, w, h)
    shadow(pp, 8, 32, "#00000026")
    hd = row(pp, "head", gap=8, W="fill")
    icon(hd, "drag", 16, "muted")
    text(hd, title, "smallStrong", "accent", W="fill")
    for lab in (("Whole chapter" if not grown else "Back to the verse"), "Open beside"):
        b = row(hd, lab, pad=[3, 8, 3, 8], radius=6, fill="sunken")
        text(b, lab, "caption")
    icon(hd, "close", 14, "muted")
    for lab, t in lines:
        para(pp, f"{lab}  {t}", "readSmall")
    return pp


@r_("12b", "Click the chip: a popup with the verse. Drag it by its grip anywhere; Esc closes it and the page is as it was.")
def _r12b2(f):
    x, pg = full(f)
    blk(pg, "p", "Where the word first appears in this story:")
    chip_line(pg)
    verse_pop(f, cxof(x) + 220, 210, 460, 170, [(str(v["v"]), v["text"]) for v in PS[:1]], "Psalm 106:30")


@r_("12d", "Open beside: the passage goes to the side reader at Psalm 106:30; the page stays; Back returns.")
def _r12d(f):
    w = M.rail5(f, on="Notebook")
    pw = 760
    pg = page(f, w, pw, "Zeal in Numbers 25", colw=560, h=CH - TB, path="Phinehas")
    chip_line(pg)
    side = frame(f, "side reader", x=w + pw, y=0, w=CW - w - pw, h=CH, fill="bg", layout="vertical", W="fixed",
                 H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
                 strokeBottomWeight=0)
    P.pane_header(side, ["Psalm 106"], "Psalm 106")
    rd = col(side, "reader", gap=8, pad=[24, 32, 24, 32], W="fill")
    text(rd, "Psalm 106", "chapter")
    for lab, t in PSCH:
        para(rd, f"{lab}  {t}", "readSmall")


@r_(26, "A folder's color is the only organizing color: pick it from the folder colors; its pages show the dot by the "
         "title and in the side list.")
def _r26b(f):
    a, b = halves(f, "Folder › Color", "Its pages carry it")
    t = col(a, "side list", gap=1, pad=[110, 8, 10, 8], fill="sunken", W="fixed", H="fixed", clip=True)
    Q.put(t, 0, 0, 300, CH)
    L.side_row(t, "Phinehas", ic="folder", open_=True, sub="56", hover=True)
    for lab in ("Zeal in Numbers 25", "Zeal in Psalms 106"):
        L.side_row(t, lab, 1)
    m = pop(a, 250, 130, 260)
    mgroup(m, "Phinehas · Color")
    mrow(m, "None", swatch=("fg", None))
    for nm, c_ in zip(("Orange", "Blue", "Green", "Pink", "Purple"), [c for _, c in FOLDERS]):
        mrow(m, nm, swatch=(c_, c_), on=nm == "Orange")
    t = col(b, "side list", gap=1, pad=[110, 8, 10, 8], fill="sunken", W="fixed", H="fixed", clip=True)
    Q.put(t, 0, 0, 280, CH)
    L.side_row(t, "Phinehas", ic="folder", dot="#D9822B", open_=True, sub="56")
    for lab in ("Zeal in Numbers 25", "Zeal in Psalms 106"):
        L.side_row(t, lab, 1, dot="#D9822B", on=lab == "Zeal in Numbers 25")
    pg = page(b, 280, CW // 2 - 280, "Zeal in Numbers 25", colw=330, h=CH - TB, dot="#D9822B", path="Phinehas")
    blk(pg, "p", "Where the word first appears.")


def preview_box(f, sel, body):
    frame(f, "scrim", x=0, y=0, w=CW, h=CH, fill="#0000001F")
    box = row(f, "quick search", gap=0, align="min", fill="surface", radius=12, W="fixed", H="fixed", clip=True)
    Q.put(box, 100, 80, 1240, 700)
    shadow(box, 8, 32, SOFT)
    lc = col(box, "results", gap=1, pad=[8, 8, 8, 8], W="fixed", H="fill")
    S.do("node.set", {"ids": [lc], "props": {"width": 440}}, ref=False)
    msearch(lc, "tuesday")
    mgroup(lc, "Pages")
    for lab, sub in (("Tuesday study", "Pages · a list"), ("Questions for Tuesday", "Salt · callouts"),
                     ("Word studies index", "Pages · a table")):
        mrow(lc, lab, "page", sub=sub, on=lab == sel)
    pv = col(box, "preview", gap=8, pad=[24, 28, 24, 28], fill="bg", W="fill", H="fill", clip=True)
    text(pv, "Preview", "caption", "muted")
    para(pv, sel, "display")
    body(pv)


@r_("34a", "Ctrl+K preview of a page with a list: the list shows as it is in the page.")
def _r34a(f):
    def b(pv):
        for s_ in ("Psalm 106:30–31 beside it.", "The YLT of verse 13.", "Questions for Tuesday."):
            r = row(pv, s_, gap=8)
            text(r, "•", "body", "muted")
            text(r, s_, "body")
    preview_box(f, "Tuesday study", b)


@r_("34b", "Ctrl+K preview of a page with a callout: the callout keeps its color and kind.")
def _r34b(f):
    def b(pv):
        box = row(pv, "callout", gap=10, pad=[12, 14, 12, 14], radius=8, fill="#EFEAF7", W="fill")
        icon(box, "question", 18, "muted")
        cc = col(box, "c", gap=2, W="fill")
        text(cc, "Question", "caption", "muted")
        para(cc, "Who acts first, and who waits?", "body")
    preview_box(f, "Questions for Tuesday", b)


@r_("34c", "Ctrl+K preview of a page with a table (a list in a page): its first rows.")
def _r34c(f):
    def b(pv):
        for i, cells in enumerate((("Title", "Folder", "Edited"), ("Zeal", "Word studies", "3 Nov"),
                                   ("Covenant of peace", "Word studies", "28 Oct"))):
            r = row(pv, f"tr{i}", gap=0, W="fill", stroke="line", strokeBottomWeight=1, strokeTopWeight=0,
                    strokeLeftWeight=0, strokeRightWeight=0)
            for j, c_ in enumerate(cells):
                cc = row(r, f"td{j}", pad=[6, 8, 6, 8], W="fill")
                text(cc, c_, "caption" if i == 0 else "small", "muted" if i == 0 else "fg")
    preview_box(f, "Word studies index", b)


@r_(35, "Recents replaces Today in the side list: the last 8 pages opened, newest first, above Pinned, Folders, Pages.")
def _r35b(f):
    w = M.rail5(f, on="Notebook")
    t = col(f, "side list", gap=1, pad=[10, 8, 10, 8], fill="sunken", W="fixed", H="fixed", clip=True)
    Q.put(t, w, TB, 300, CH - TB)
    hd = row(t, "head/RECENTS", gap=6, W="fill", pad=[10, 6, 3, 6])
    text(hd, "RECENTS", "label", "fg", W="fill")
    text(hd, "8", "caption", "muted")
    icon(hd, "down", 11, "muted")
    for lab in ("Word studies index", "Tuesday study", "Zeal in Numbers 25", "Haste study", "Friday, November 20",
                "SALT Bible Study Notes: Nov 12", "Prayer list", "Zeal"):
        L.side_row(t, lab, on=lab == "Word studies index")
    L.side_list_body(t, today=False, search=False, salt_open=False)
    page(f, w + 300, CW - w - 300, "Word studies index", colw=560, h=CH - TB)


TABLE = (("Zeal", "Word studies", "2 open", "3 Nov", "#6B4FA0"), ("Zeal in Psalms 106", "Phinehas", "1 open", "1 Nov", "#D9822B"),
         ("Covenant of peace", "Phinehas", "1 open", "28 Oct", "#D9822B"), ("Haste", "Salt", "3 open", "20 Oct", "#3B7A3B"),
         ("Courage", "Salt", "0", "12 Oct", "#3B7A3B"), ("Prayer list", "Anna", "1 open", "2 Oct", "#B0457E"))


def list_page(f, view):
    x, pg = full(f, "Word studies index", path="Pages  /  Word studies index", side=False)
    tr = row(pg, "list head", gap=8, W="fill", pad=[6, 0, 6, 40])
    vb = row(tr, "view", gap=4, pad=[4, 8, 4, 8], radius=6, fill="sunken")
    icon(vb, {"Table": "table", "List": "list", "Gallery": "layers", "Board": "dock"}[view], 14, "fg")
    text(vb, view, "small")
    icon(vb, "down", 12, "muted")
    text(tr, "Pages · has a question", "caption", "muted", W="fill")
    P.button(tr, "Filters · 1", icon_name="filter", size="sm")
    return x, pg


@r_("47a", "The view menu of a list in a page: Table, List, Gallery, Board (Calendar and Timeline later); group by folder or callout kind.")
def _r47a(f):
    x, pg = list_page(f, "Table")
    m = pop(f, cxof(x) + 40, 240, 300)
    mgroup(m, "View")
    for lab, ic in (("Table", "table"), ("List", "list"), ("Gallery", "layers"), ("Board", "dock")):
        mrow(m, lab, ic, check=lab == "Table")
    mrow(m, "Calendar", "clock", sub="later")
    mrow(m, "Timeline", "toc", sub="later")
    sep(m)
    mrow(m, "Group by", "folder", "Folder", arrow=True)
    mrow(m, "Sort", "list", "Edited", arrow=True)


@r_("47b", "List view: one quiet line per page, its folder's dot and when it was edited.")
def _r47b(f):
    x, pg = list_page(f, "List")
    for t_, fo, q, e, c_ in TABLE:
        r = row(pg, t_, gap=10, pad=[8, 8, 8, 48], W="fill", stroke="line", strokeBottomWeight=1, strokeTopWeight=0,
                strokeLeftWeight=0, strokeRightWeight=0)
        frame(r, "dot", w=8, h=8, radius=4, fill=c_, W="fixed", H="fixed")
        text(r, t_, "body", W="fill")
        text(r, e, "caption", "muted")


@r_("47c", "Gallery view: a card per page, its first lines as the preview.")
def _r47c(f):
    x, pg = list_page(f, "Gallery")
    gg = col(pg, "gallery", gap=14, W="fill", pad=[0, 0, 0, 40])
    for k, (t_, fo, q, e, c_) in enumerate(TABLE):
        if k % 3 == 0:
            g = row(gg, f"g{k}", gap=14, W="fill", align="min")
        cd = col(g, t_, gap=6, pad=[12, 14, 12, 14], radius=10, fill="surface", stroke="line", sw=1, W="fixed")
        S.do("node.set", {"ids": [cd], "props": {"width": 190}}, ref=False)
        pv = frame(cd, "preview", w=10, h=70, fill="sunken", radius=6, W="fill", H="fixed")
        hr = row(cd, "t", gap=6)
        frame(hr, "dot", w=8, h=8, radius=4, fill=c_, W="fixed", H="fixed")
        text(hr, t_, "smallStrong")
        text(cd, f"{fo} · {q}", "caption", "muted")


@r_("47d", "Board view, grouped by folder: a column per folder; dragging a card to another column moves the page there.")
def _r47d(f):
    x, pg = list_page(f, "Board")
    bd = row(pg, "board", gap=14, W="fill", align="min", pad=[0, 0, 0, 40])
    for fo, c_ in (("Phinehas", "#D9822B"), ("Salt", "#3B7A3B"), ("Word studies", "#6B4FA0"), ("Anna", "#B0457E")):
        cl = col(bd, fo, gap=8, pad=[8, 8, 8, 8], radius=10, fill="sunken", W="fill")
        hr = row(cl, "h", gap=6)
        frame(hr, "dot", w=8, h=8, radius=4, fill=c_, W="fixed", H="fixed")
        text(hr, fo, "smallStrong")
        for t_, fo2, q, e, _ in TABLE:
            if fo2 == fo:
                cd = col(cl, t_, gap=2, pad=[10, 12, 10, 12], radius=8, fill="surface", W="fill")
                text(cd, t_, "small")
                text(cd, q, "caption", "muted")


def width_frame(f, lab, w_, h_, sheet=False):
    x0 = CW - w_ - 120
    if not sheet:
        w = M.rail5(f, on="Notebook")
        K.reader(f, w, CW - w, NUM, "Numbers 25") if lab != "Narrow pane" else None
    hv = frame(f, lab, x=x0 if lab != "Narrow pane" else CW - w_, y=60 if lab != "Narrow pane" else 0, w=w_,
               h=h_, fill="bg", radius=12 if lab != "Narrow pane" else 0, stroke="line", sw=1, W="fixed", H="fixed",
               clip=True)
    shadow(hv, 10, 36, "#00000026")
    pg = page(hv, 0, w_, "Zeal in Numbers 25", colw=w_ - 96, h=h_, path="Phinehas")
    blk(pg, "p", "Where the word first appears in this story:", hover=True)
    blk(pg, "verse", ("num", [11], "Numbers 25:11"))
    blk(pg, "callout", "How does Psalm 106:31 read this?", kname="Question", ic="question", bg="#EFEAF7")
    return hv


@r_("37a", "Floating tab: the page floats over the reader at 560 px; the column keeps a 24 px margin and the gutter fits inside.")
def _r37a(f):
    width_frame(f, "Floating tab", 560, 740)


@r_("37b", "Narrow pane: 460 px beside the reader; the handle sits inside the margin; menus stay inside the pane.")
def _r37b(f):
    w = M.rail5(f, on="Notebook")
    K.reader(f, w, CW - w - 460, NUM, "Numbers 25", width=560)
    hv = width_frame(f, "Narrow pane", 460, CH, sheet=True)


@r_("37c", "Phone: the page at 390 px; every menu is a bottom sheet with the same search, groups and rows.")
def _r37c(f):
    for i, sheet in enumerate((False, True)):
        x0 = 280 + i * 480
        hv = frame(f, f"phone{i}", x=x0, y=50, w=390, h=790, fill="bg", radius=28, stroke="line", sw=1, W="fixed",
                   H="fixed", clip=True)
        shadow(hv, 10, 36, "#00000026")
        pg = page(hv, 0, 390, "Zeal in Numbers 25", colw=310, h=820, path="Phinehas")
        blk(pg, "p", "Where the word first appears in this story:")
        blk(pg, "verse", ("num", [11], "Numbers 25:11"))
        if sheet:
            frame(hv, "scrim", x=0, y=0, w=390, h=820, fill="#0000002E")
            sh = col(hv, "sheet", gap=1, pad=[8, 14, 28, 14], fill="surface", radius=18, W="fixed")
            Q.put(sh, 0, 420, 390)
            grab = row(sh, "grab", W="fill", mainAlign="center", pad=[2, 0, 8, 0])
            frame(grab, "handle", w=36, h=4, radius=2, fill="line", W="fixed", H="fixed")
            msearch(sh, None, "Search for a block")
            for lab, ic, k in (("Text", "text", None), ("Heading 1", "text", "#"), ("Bullet list", "list", "-"),
                               ("To-do", "check", "[]"), ("Scripture", "book", "/verse")):
                mrow(sh, lab, ic, k, on=lab == "Text")
        label(f, "Page" if not sheet else "/ as a sheet", x0, 14)


# ---- round 4 (the person's review of round 3, README Directions) ------------------------------------------------------
APPROVED |= {"1", "6a", "6b", "7a", "7b", "9", "10", "11", "13", "16", "19", "21", "22", "30", "31", "32", "37a", "37b",
             "37c", "41", "42", "43"}
ORDER[ORDER.index(36) + 1:ORDER.index(36) + 1] = [48]
ORDER += [49, 50, 51, 52, 53, 54, 55]


def wbj(name, *cmd):
    p = HERE / "data" / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8"))["output"] if p.exists() else K.fetch(HERE, name, list(cmd))


STRONG = wbj("strong_h7065", "strong", "H7065")
INTER = wbj("interlinear_num25_11", "interlinear", "Num 25:11")
CONC = wbj("concordance_zealous", "concordance", "zealous")
N9 = raw("num25_9", "Num 25:9")[1]
C108 = raw("1cor10_8", "1 Cor 10:8")[1]


def marked_verse(parent, label, num, txt, phrase, fill, chars=64):
    """A verse laid out line by line (wrapped here) so a mark can sit on its own words, as the app draws it."""
    vb = col(parent, f"scripture/{label}", gap=2, pad=[10, 14, 12, 14], radius=8, fill="surface", W="fill")
    hr = row(vb, "h", gap=8, W="fill")
    icon(hr, "book", 14, "accent")
    text(hr, label, "smallStrong", "accent", W="fill")
    text(hr, "KJV", "caption", "muted")
    a = txt.index(phrase)
    pieces = [(t, False) for t in txt[:a].split(" ") if t] + [(phrase, True)] + \
             [(t, False) for t in txt[a + len(phrase):].split(" ") if t]
    lines, cur, n = [], [], len(num) + 2
    for t, m in pieces:
        if n + len(t) > chars and cur:
            lines.append(cur)
            cur, n = [], 0
        cur.append((t, m))
        n += len(t) + 1
    lines.append(cur)
    for k, ln in enumerate(lines):
        r = row(vb, f"line{k}", gap=0)
        if k == 0:
            text(r, num, "readSmall")
            frame(r, "gap", w=8, h=4, W="fixed", H="fixed")
        buf = []
        for t, m in ln:
            if m:
                if buf:
                    text(r, " ".join(buf) + " ", "readSmall")
                    buf = []
                hl = row(r, "mark", pad=[0, 2, 0, 2], radius=3, fill=fill)
                text(hl, t, "readSmall")
                text(r, " ", "readSmall")
            else:
                buf.append(t)
        if buf:
            text(r, " ".join(buf), "readSmall")
    return vb


PH = None


def ph():
    return words(("num", 11), 18, 23)


@r_("39a", "Mark, step 1: select words of scripture in a page; the selection bar opens right above them.")
def _r39a4(f):
    x, pg = full(f)
    in_gutter(pg, lambda b: marked_verse(b, "Numbers 25:11", "11", V[("num", 11)], ph(), "#2E6FB833"))
    sel_bar(f, cxof(x) + 140, 150)


@r_("39b", "Mark, step 2: Mark ▾ opens its menu attached under the bar: the Legend's styles, searchable.")
def _r39b4(f):
    x, pg = full(f)
    in_gutter(pg, lambda b: marked_verse(b, "Numbers 25:11", "11", V[("num", 11)], ph(), "#2E6FB833"))
    sel_bar(f, cxof(x) + 140, 150)
    _mark_menu(f, cxof(x) + 140 + 330, 192)


@r_("39c", "Mark, step 3: pick Zeal; the mark sits on the scripture's own words in the page.")
def _r39c4(f):
    x, pg = full(f)
    in_gutter(pg, lambda b: marked_verse(b, "Numbers 25:11", "11", V[("num", 11)], ph(), "hlOrange"))
    blk(pg, "p", "Where the word first appears in this story:")


@r_("39d", "Mark, step 4: it is the reader's mark. Numbers 25 in the reader shows the same words marked Zeal.")
def _r39d4(f):
    a, b = halves(f, "In the page", "In the reader")
    pg = hp(a, "Zeal in Numbers 25", "Phinehas")
    in_gutter(pg, lambda bb: marked_verse(bb, "Numbers 25:11", "11", V[("num", 11)], ph(), "hlOrange", chars=56))
    rd = col(b, "reader", gap=10, pad=[110, 50, 40, 50], W="fixed")
    Q.put(rd, 0, 0, CW // 2)
    text(rd, "Numbers 25", "chapter")
    marked_verse(rd, "Numbers 25:11", "11", V[("num", 11)], ph(), "hlOrange", chars=56)


@r_("12c", "Whole chapter: a compact panel with a header (reference, ← →, Open in reader, close), sized to its text, "
           "snapped to the top-right corner; drag it to another corner.")
def _r12c4(f):
    x, pg = full(f)
    blk(pg, "p", "Where the word first appears in this story:")
    chip_line(pg)
    pp = col(f, "chapter panel", gap=0, fill="surface", radius=12, W="fixed", clip=True)
    Q.put(pp, CW - 440, 60, 420)
    shadow(pp, 8, 32, "#00000026")
    hd = row(pp, "head", gap=8, pad=[8, 10, 8, 12], fill="sunken", W="fill")
    icon(hd, "drag", 14, "muted")
    text(hd, "Psalm 106", "smallStrong", W="fill")
    icon(hd, "left", 14, "muted")
    icon(hd, "right", 14, "muted")
    b = row(hd, "open", pad=[3, 8, 3, 8], radius=6, fill="surface")
    text(b, "Open in reader", "caption")
    icon(hd, "close", 14, "muted")
    body = col(pp, "verses", gap=4, pad=[10, 14, 12, 14], W="fill")
    for lab, t in PSCH:
        r = col(body, lab, gap=0, pad=[2, 4, 2, 4], radius=4, W="fill", fill="hlYellow" if lab == "30" else None)
        para(r, f"{lab}  {t}", "readSmall")
    for (cx_, cy_) in ((20, 60), (20, CH - 60), (CW - 60, CH - 60)):
        frame(f, "corner", x=cx_, y=cy_, w=40, h=4, fill="muted", radius=2)
    text(f, "the other corners it snaps to", "caption", "muted", x=40, y=CH - 50)


@r_("18a", "Link to a block, step 1: in page A (Haste study), the block's grip › Copy link to block. Where it will "
           "lead is chosen by copying from that block.")
def _r18a(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "h2", "Running ahead")
    blk(pg, "p", "Read the chapter twice before writing anything about it.", hover="grip")
    m = pop(f, cxof(x) - 30, 300, 290)
    mrow(m, "Copy link to block", "link", on=True)
    mrow(m, "Duplicate", "copy", "Ctrl+D")
    toast(f, "Link to block copied")


@r_("18b", "Step 2: paste in page B: a chip “Haste study › Read the chapter twice…”. Scripture references stay "
           "references; this is a link to a place in a page.")
def _r18b4(f):
    x, pg = full(f, "Tuesday study", path="Pages  /  Tuesday study", list_kw={"on": "Tuesday study"})
    r = row(pg, "line", gap=0, W="fill")
    gutter(r, False)
    bb = row(r, "b", gap=6, pad=[3, 4, 3, 4])
    text(bb, "Before Tuesday:", "body")
    ch = row(bb, "chip", gap=6, pad=[4, 10, 4, 8], radius=999, fill="surface", stroke="line", sw=1)
    icon(ch, "page", 14, "muted")
    text(ch, "Haste study  ›  Read the chapter twice…", "small")


@r_("18c", "Step 3: clicking the chip opens Haste study scrolled to that block, which glows for a moment; Back returns "
           "to Tuesday study.")
def _r18c(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    blk(pg, "h2", "Running ahead")
    blk(pg, "p", "Read the chapter twice before writing anything about it.", wash="#F4E3A1")
    blk(pg, "li", "Who acts first, and who waits?")
    bk = row(f, "back", gap=6, pad=[6, 12, 6, 10], radius=999, fill="fg")
    Q.put(bk, cxof(x) + 40, CH - 90)
    icon(bk, "back", 14, "onAccent")
    text(bk, "Back to Tuesday study", "small", "onAccent")


def toc_bar(f, x, y, h, folded=False):
    if folded:
        rl = col(f, "rail", gap=10, pad=[14, 8, 14, 8], W="fixed", H="fixed", crossAlign="center")
        Q.put(rl, x, y, 28, h)
        icon(rl, "left", 12, "muted")
        for w_ in (14, 8, 14, 8, 14):
            frame(rl, "tick", w=w_, h=2, radius=1, fill="line", W="fixed", H="fixed")
        return
    bar = col(f, "contents", gap=4, pad=[14, 14, 14, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
              strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(bar, x, y, 220, h)
    hd = row(bar, "h", gap=6, W="fill")
    text(hd, "Contents", "caption", "muted", W="fill")
    icon(hd, "right", 12, "muted")
    for s_, d, on in (("Numbers 25", 0, True), ("The act", 1, False), ("Psalm 106", 0, False),
                      ("Questions for Tuesday", 0, False)):
        r = row(bar, s_, pad=[4, 6, 4, 6 + 14 * d], radius=5, W="fill", fill="sunken" if on else None)
        text(r, s_, "small", "fg" if on else "muted")


def lesson(pg):
    for s_ in ("Numbers 25", "Psalm 106", "Questions for Tuesday"):
        blk(pg, "h2", s_)
        blk(pg, "p", "Notes for this part of the lesson.")


@r_("45a", "Table of contents: a bar in the page's right side; ▸ folds it.")
def _r45a(f):
    w = M.rail5(f, on="Notebook")
    pg = page(f, w, CW - w - 220, "Salt lessons 2025", colw=620, h=CH - TB, path="Salt  /  Salt lessons 2025")
    lesson(pg)
    toc_bar(f, CW - 220, TB, CH - TB)


@r_("45b", "Folded: a thin rail of ticks at the page's edge; ◂ or a click on the rail opens it again.")
def _r45b(f):
    w = M.rail5(f, on="Notebook")
    pg = page(f, w, CW - w - 28, "Salt lessons 2025", colw=620, h=CH - TB, path="Salt  /  Salt lessons 2025")
    lesson(pg)
    toc_bar(f, CW - 28, TB, CH - TB, folded=True)


@r_("45c", "Among other panes: the contents stay inside the page's own pane, beside the reader.")
def _r45c(f):
    w = M.rail5(f, on="Notebook")
    K.reader(f, w, 560, NUM, "Numbers 25", width=480)
    px = w + 560
    pane = frame(f, "pane", x=px, y=0, w=CW - px, h=CH, fill="bg", layout="vertical", W="fixed", H="fixed", clip=True,
                 stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    P.pane_header(pane, ["Salt lessons 2025", "Haste study"], "Salt lessons 2025")
    pg = page(f, px, CW - px - 200, "Salt lessons 2025", colw=440, top=40, h=CH - 40, bar=False)
    lesson(pg)
    toc_bar(f, CW - 200, 40, CH - 40)


@r_("36", "List in a page: a folder acts as the database; each page in it is a row; a column is a page property from "
         "its front matter. + New page adds a page to the folder; + Property adds a column.")
def _r36_4(f):
    x, pg = full(f, "Word studies index", path="Pages  /  Word studies index", side=False)
    tr = row(pg, "list head", gap=8, W="fill", pad=[6, 0, 6, 40])
    frame(tr, "dot", w=8, h=8, radius=4, fill="#6B4FA0", W="fixed", H="fixed")
    text(tr, "Folder: Word studies · 4 pages", "small", W="fill")
    P.button(tr, "Filters", icon_name="filter", size="sm")
    tbl = col(pg, "table", gap=0, W="fill", pad=[0, 0, 0, 40])
    rows_ = (("Title", "Status", "Book", "Edited", "+ Property"), ("Zeal", "Open", "Numbers", "3 Nov", ""),
             ("Covenant of peace", "Done", "Numbers", "28 Oct", ""), ("Haste", "Open", "Proverbs", "20 Oct", ""),
             ("Courage", "Done", "Joshua", "12 Oct", ""))
    for i, cells in enumerate(rows_):
        r = row(tbl, f"tr/{i}", gap=0, W="fill", stroke="line", strokeBottomWeight=1, strokeTopWeight=0,
                strokeLeftWeight=0, strokeRightWeight=0)
        for j, c_ in enumerate(cells):
            cc = row(r, f"td/{j}", pad=[8, 8, 8, 8], W="fill" if j == 0 else "fixed")
            if j:
                S.do("node.set", {"ids": [cc], "props": {"width": 110}}, ref=False)
            if j == 0 and i:
                icon(cc, "page", 14, "muted")
            text(cc, c_, "caption" if i == 0 else "small", "muted" if (i == 0 or j) else "fg")
    nr = row(tbl, "new", gap=6, pad=[8, 8, 8, 8], W="fill")
    icon(nr, "plus", 14, "muted")
    text(nr, "New page", "small", "muted")
    K.note(f, "Status and Book are properties kept in each page's front matter; a page that lacks one shows an empty cell.",
           cxof(x) + 40, 520, 460)


@r_(48, "A Table: a plain table you type into. + adds a row at the foot or a column at the right; nothing else is linked.")
def _r48(f):
    x, pg = full(f, "Tuesday study", path="Pages  /  Tuesday study", list_kw={"on": "Tuesday study"})
    tbl = col(pg, "table", gap=0, W="fill", pad=[0, 0, 0, 40])
    rows_ = (("Who", "Acts", "Promise"), ("Phinehas", "rose up", "covenant of peace"), ("Moses", "", ""))
    for i, cells in enumerate(rows_):
        r = row(tbl, f"tr/{i}", gap=0, W="fill")
        for j, c_ in enumerate(cells):
            cc = row(r, f"td/{j}", pad=[8, 10, 8, 10], W="fill", stroke="line", sw=1,
                     fill="sunken" if i == 0 else ("#2E6FB814" if (i, j) == (2, 1) else None))
            text(cc, c_ or " ", "smallStrong" if i == 0 else "small")
            if (i, j) == (2, 1):
                frame(cc, "caret", w=2, h=18, fill="fg", W="fixed", H="fixed")
        if True:
            pl = row(r, "add col", pad=[8, 8, 8, 8])
            if i == 0:
                icon(pl, "plus", 14, "muted")
            else:
                frame(pl, "sp", w=14, h=14, W="fixed", H="fixed")
    nr = row(tbl, "add row", gap=6, pad=[6, 10, 6, 10], W="fill")
    icon(nr, "plus", 14, "muted")
    text(nr, "Row", "small", "muted")


@r_("47e", "Group by Folder: rows gather under a heading per folder, each with its count; ▸ folds a group.")
def _r47e(f):
    x, pg = list_page(f, "Table")
    for fo, c_, open_ in (("Phinehas", "#D9822B", True), ("Salt", "#3B7A3B", False), ("Word studies", "#6B4FA0", True)):
        items = [t for t in TABLE if t[1] == fo]
        hd = row(pg, f"group/{fo}", gap=8, pad=[10, 0, 4, 40], W="fill")
        icon(hd, "down" if open_ else "right", 12, "muted")
        frame(hd, "dot", w=8, h=8, radius=4, fill=c_, W="fixed", H="fixed")
        text(hd, fo, "smallStrong")
        text(hd, str(len(items)), "caption", "muted")
        if open_:
            for t_, fo2, q, e, _ in items:
                r = row(pg, t_, gap=0, W="fill", pad=[0, 0, 0, 60], stroke="line", strokeBottomWeight=1,
                        strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
                for j, c_2 in enumerate((t_, q, e)):
                    cc = row(r, f"td{j}", pad=[7, 8, 7, 8], W="fill" if j == 0 else "fixed")
                    if j:
                        S.do("node.set", {"ids": [cc], "props": {"width": 110}}, ref=False)
                    text(cc, c_2, "small", "fg" if j == 0 else "muted")
    m = pop(f, CW - 330, 200, 240)
    mgroup(m, "Group by")
    for lab in ("None", "Folder", "Callout kind", "Status", "Book"):
        mrow(m, lab, check=lab == "Folder")


def compare(f, n):
    x, pg = full(f, side=False, full_width=True) if False else (M.rail5(f, on="Notebook"), None)
    pg = page(f, x, CW - x, "Zeal in Numbers 25", colw=CW - x - 120, h=CH - TB, path="Phinehas")
    row_ = row(pg, "compare", gap=12, W="fill", align="min", pad=[0, 0, 0, 40])
    ps = [("Numbers 25:11–13", NUM18), ("Psalm 106:30–31", [(str(v["v"]), v["text"]) for v in PS]),
          ("Numbers 25:9", N9), ("1 Corinthians 10:8", C108)][:n]
    for lab, lines in ps:
        passage(row_, lab, lines)


@r_("44a", "Three Scripture blocks side by side at Full width.")
def _r44a(f):
    compare(f, 3)


@r_("44b", "Four side by side, the most; as the pane narrows they fall to three, two, then one under another.")
def _r44b(f):
    compare(f, 4)


@r_(40, "Margin note from a page: it opens in the margin beside the selected words; drag it by its grip to move it.")
def _r40_4(f):
    x, pg = full(f)
    in_gutter(pg, lambda b: marked_verse(b, "Numbers 25:11", "11", V[("num", 11)], ph(), "#2E6FB833"))
    nb = col(f, "margin note", gap=6, pad=[10, 12, 12, 12], radius=10, fill="surface", W="fixed")
    Q.put(nb, CW - 300, 170, 270)
    shadow(nb, 6, 24, SOFT)
    hd = row(nb, "h", gap=6, W="fill")
    icon(hd, "drag", 14, "muted")
    text(hd, "Margin note · Numbers 25:11", "caption", "muted", W="fill")
    icon(hd, "close", 12, "muted")
    r = row(nb, "t", gap=0)
    text(r, "Compare Psalm 106:30", "body")
    frame(r, "caret", w=2, h=20, fill="fg", W="fixed", H="fixed")
    frame(f, "leader", x=cxof(x) + 600, y=200, w=CW - 300 - cxof(x) - 600, h=1, fill="line")


@r_("25a", "Color ▾ on selected words: 8 plain colors and Default, for emphasis only. Text color means nothing; "
           "marks carry meaning.")
def _r25a(f):
    a, b = halves(f, "Color ▾", "Colored")
    pg = hp(a, "Haste study")
    blk(pg, "p", "Read the chapter twice before writing anything about it.")
    sel_bar(a, 60, 210, mark=False)
    m = pop(a, 260, 260, 240)
    P.segmented(m, ["Text", "Background"], "Text")
    mrow(m, "Default", swatch=("fg", None), check=True)
    for nm, c_ in PLAIN:
        mrow(m, nm, swatch=(c_, None), on=nm == "Red")
    pg = hp(b, "Haste study")
    blk(pg, "p", "Read the chapter twice before writing anything about it.", color="#B8433E")


PALE = (("Gray", "#F1F1EF"), ("Brown", "#F4EEEE"), ("Orange", "#FBECDD"), ("Yellow", "#FBF3DB"), ("Green", "#EDF3EC"),
        ("Blue", "#E7F3F8"), ("Purple", "#F6F3F9"), ("Red", "#FDEBEC"))


@r_("25b", "Background: the 8 pale backgrounds, on words in a line and on a whole block.")
def _r25b4(f):
    x, pg = full(f, "Haste study", path="Pages  /  Haste study", list_kw={"on": "Haste study"})
    r = row(pg, "line", gap=0, W="fill")
    gutter(r, False)
    bb = row(r, "b", gap=6, pad=[3, 4, 3, 4])
    for nm, c_ in PALE:
        s_ = row(bb, nm, pad=[1, 4, 1, 4], radius=3, fill=c_)
        text(s_, nm, "body")
    for nm, c_ in PALE[:4]:
        blk(pg, "p", f"A whole block on {nm.lower()}.", bg=c_)


@r_("46a", "A callout holds several lines and a nested list.")
def _r46a4(f):
    x, pg = full(f)
    def co(b):
        box = row(b, "callout", gap=10, pad=[14, 16, 14, 16], radius=8, fill="#EFEAF7", W="fill", align="min")
        icon(box, "question", 18, "muted")
        cc = col(box, "c", gap=4, W="fill")
        text(cc, "Question", "caption", "muted")
        para(cc, "Why “an everlasting priesthood” here?", "body")
        para(cc, "Read it beside Psalm 106:31 before answering.", "body")
        for s_, d in (("Who receives the covenant?", 0), ("Numbers 25:13", 1), ("Psalm 106:31", 1),
                      ("What is it called?", 0)):
            r = row(cc, f"li/{s_}", gap=8, pad=[0, 0, 0, 20 * d])
            text(r, "•" if d == 0 else "◦", "body", "muted")
            text(r, s_, "body")
    in_gutter(pg, co)


@r_("46b", "The Questions list (Library) filters by kind: Question or Answered; each shows its first line and its page.")
def _r46b4(f):
    w = M.rail5(f, on="Notebook")
    p_ = col(f, "questions", gap=6, pad=[40, 60, 40, 60], W="fixed")
    Q.put(p_, w + 120, 40, 900)
    text(p_, "Questions", "display")
    seg = row(p_, "kinds", gap=6, pad=[6, 0, 10, 0])
    P.chip(seg, "Question · 3", "selected")
    P.chip(seg, "Answered · 5", "outline")
    for q, pgn in (("Why “an everlasting priesthood” here?", "Zeal in Numbers 25 · 2 more lines, a list"),
                   ("Who acts first, and who waits?", "Haste study"), ("What is promised afterwards?", "Haste study")):
        r = row(p_, f"q/{q}", gap=12, pad=[10, 12, 10, 12], radius=8, W="fill")
        icon(r, "question", 16, "question")
        tc = col(r, "t", gap=1, W="fill")
        text(tc, q, "body")
        text(tc, pgn, "caption", "muted")


@r_("46c", "Key points and notes are found by Ctrl+K (“key point”), grouped as Key points and Notes, each with its page.")
def _r46c(f):
    frame(f, "scrim", x=0, y=0, w=CW, h=CH, fill="#0000001F")
    m = pop(f, 360, 100, 720, pad=8)
    msearch(m, "key point")
    mgroup(m, "Key points")
    mrow(m, "The covenant is given to him and to his seed after him.", "star", sub="Zeal in Numbers 25", on=True)
    mrow(m, "Wait for the word before acting.", "star", sub="Haste study")
    mgroup(m, "Notes")
    mrow(m, "Read the YLT of verse 13 next.", "pen", sub="Zeal in Numbers 25")


@r_("46d", "Or a List in a page grouped by callout kind: Key point and Note as headings, each callout a row with its page.")
def _r46d(f):
    x, pg = list_page(f, "List")
    for kind, ic, items in (("Key point", "star", (("The covenant is given to him and to his seed after him.", "Zeal in Numbers 25"),
                                                   ("Wait for the word before acting.", "Haste study"))),
                            ("Note", "pen", (("Read the YLT of verse 13 next.", "Zeal in Numbers 25"),))):
        hd = row(pg, kind, gap=8, pad=[10, 0, 4, 40], W="fill")
        icon(hd, "down", 12, "muted")
        icon(hd, ic, 14, "muted")
        text(hd, kind, "smallStrong")
        text(hd, str(len(items)), "caption", "muted")
        for t_, p2 in items:
            r = row(pg, t_[:12], gap=10, pad=[7, 8, 7, 60], W="fill", stroke="line", strokeBottomWeight=1,
                    strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
            text(r, t_, "small", W="fill")
            text(r, p2, "caption", "muted")


@r_("34d", "Folders in Ctrl+K: a folder shows its color and its page count; Enter opens it in the side list.")
def _r34d(f):
    frame(f, "scrim", x=0, y=0, w=CW, h=CH, fill="#0000001F")
    m = pop(f, 360, 100, 720, pad=8)
    msearch(m, "phin")
    mgroup(m, "Folders")
    for nm, c_, n in (("Phinehas", "#D9822B", "56 pages and saves"), ("Phinehas echoes", "#2E6FB8", "19 pages and saves")):
        r = row(m, nm, gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="sunken" if nm == "Phinehas" else None)
        icon(r, "folder", 16, "muted")
        frame(r, "dot", w=9, h=9, radius=5, fill=c_, W="fixed", H="fixed")
        text(r, nm, "small", W="fill")
        text(r, n, "caption", "muted")
    mgroup(m, "Pages")
    mrow(m, "Phinehas and Psalm 106", "page", sub="Phinehas")


# ---- Study commands (a brainstorm; the person keeps or cuts each) ----------------------------------------------------
def study_block(f, title, sub, body_fn, cmd):
    x, pg = full(f, "Word studies index", path="Pages  /  Word studies index", side=False)
    def b(bb):
        box = col(bb, title, gap=6, pad=[12, 16, 14, 16], radius=8, fill="surface", W="fill", stroke="line", sw=1)
        hr = row(box, "h", gap=8, W="fill")
        text(hr, title, "smallStrong", "accent", W="fill")
        text(hr, sub, "caption", "muted")
        body_fn(box)
    in_gutter(pg, b)
    fn = row(pg, "source", pad=[10, 0, 0, 44])
    text(fn, f"From: {cmd}", "caption", "muted")


@r_(49, "Study › Scripture: the block keeps only the reference; the words are read from the database each time.")
def _r49(f):
    def body(b):
        for lab, t in NUM18:
            para(b, f"{lab}  {t}", "readSmall")
    study_block(f, "Numbers 25:11–13", "Scripture · KJV", body, "wb text \"Num 25:11-13\"")


@r_(50, "Study › Word: a Strong's entry as a block: the original word, its sound, the definition and the KJV's renderings.")
def _r50(f):
    def body(b):
        r = row(b, "lemma", gap=12)
        text(r, STRONG["lemma"], "hebrew")
        text(r, f'{STRONG["translit"]} · {STRONG["pron"]} · {STRONG["pos"]}', "small", "muted")
        para(b, STRONG["definition"], "body")
        para(b, "KJV: " + ", ".join(f'{x["w"]} {x["n"]}' for x in STRONG["renderings"][:6]), "small", "muted")
    study_block(f, "H7065", "Word · Strong's", body, "wb strong H7065")


@r_(51, "Study › Interlinear: a verse's original words, each with its sound, gloss and Strong's number.")
def _r51(f):
    ws = INTER["verses"][0]["words"][:8]
    def body(b):
        r = row(b, "words", gap=14, align="min")
        for w_ in ws:
            c = col(r, w_["strong"], gap=2, W="hug", crossAlign="center")
            text(c, w_["original"], "hebrew", fontSize=22, lineHeight="30px")
            text(c, w_["translit"], "caption", "muted")
            text(c, w_["gloss"], "small")
            text(c, w_["strong"], "caption", "accent")
        text(b, "Numbers 25:11, first 8 words (right to left in the verse)", "caption", "muted")
    study_block(f, "Numbers 25:11", "Interlinear · Hebrew", body, "wb interlinear \"Num 25:11\"")


@r_(52, "Study › Cross references: proposed. wb has no cross-reference data today, so nothing is listed; the block "
         "would need a source chosen first.")
def _r52(f):
    def body(b):
        para(b, "No cross references: the app has no cross-reference source yet.", "body", "muted")
        para(b, "Proposed: wb xrefs REF, after a source is chosen.", "small", "muted")
    study_block(f, "Numbers 25:11", "Cross references", body, "none yet (proposed)")


@r_(53, "Study › Concordance: every place of a word in Bible order, with words either side and the original number.")
def _r53(f):
    def body(b):
        for ln in CONC["lines"][:6]:
            r = row(b, ln["ref"], gap=8, W="fill")
            t_ = row(r, "ref", W="fixed")
            S.do("node.set", {"ids": [t_], "props": {"width": 130}}, ref=False)
            text(t_, ln["ref"], "smallStrong", "accent")
            text(r, "…" + ln["before"], "small", "muted")
            text(r, ln["word"], "smallStrong")
            text(r, ln["after"] + "…", "small", "muted")
            text(r, ln["strong"], "caption", "muted")
        text(b, f'{CONC["places"]} places', "caption", "muted")
    study_block(f, "zealous", "Concordance", body, "wb concordance zealous")


@r_(54, "Study › Margin notes for a passage: the margin notes on Numbers 25, by verse; each opens its note. "
         "(The notes drawn are samples, not anyone's study.)")
def _r54(f):
    def body(b):
        for at, t in (("Numbers 25", "Read the chapter through twice."), ("Numbers 25:9", "Compare 1 Corinthians 10:8."),
                      ("Numbers 25:11", "Compare Psalm 106:30.")):
            r = row(b, at, gap=10, W="fill", pad=[4, 0, 4, 0])
            icon(r, "pen", 14, "muted")
            t2 = row(r, "at", W="fixed")
            S.do("node.set", {"ids": [t2], "props": {"width": 130}}, ref=False)
            text(t2, at, "smallStrong", "accent")
            text(r, t, "small")
    study_block(f, "Numbers 25", "Margin notes · 3", body, "wb mark notes \"Num 25\" (on the study folder)")


@r_(55, "Study › Marks in a passage: every mark on Numbers 25, with its Legend style and the marked words. "
         "(The marks drawn are samples; the words are the database's.)")
def _r55(f):
    def body(b):
        for at, (st, c_), wd in (("Numbers 25:11", ("Zeal", "hlOrange"), ph()),
                                 ("Numbers 25:13", ("Covenant", "hlYellow"), words(("num", 13), 4, 8)) if False else
                                 ("Numbers 25:12", ("Covenant", "hlYellow"), " ".join(NUM18[1][1].split()[-4:]).rstrip(":"))):
            r = row(b, at, gap=10, W="fill", pad=[4, 0, 4, 0])
            frame(r, "sample", w=18, h=10, radius=2, fill=c_, W="fixed", H="fixed")
            t2 = row(r, "at", W="fixed")
            S.do("node.set", {"ids": [t2], "props": {"width": 130}}, ref=False)
            text(t2, at, "smallStrong", "accent")
            text(r, st, "small", "muted")
            text(r, "“" + wd + "”", "readSmall")
    study_block(f, "Numbers 25", "Marks · 2", body, "wb marks NUM 25 (on the study folder)")


def write_rows(cli, target):
    out = HERE / "rows"
    out.mkdir(exist_ok=True)
    idx = []
    rows_ = sorted(ROWS, key=lambda r: (ORDER.index(r[1]), r[0]))
    keep = {f"{r[0]}.png" for r in rows_}
    for old in out.glob("*.png"):
        if old.name not in keep:
            old.unlink()
    for rid, num, cap, _ in rows_:
        png = out / f"{rid}.png"
        idx.append({"id": rid, "row": num, "file": f"rows/{rid}.png", "caption": cap})
        if rid in APPROVED and png.exists():
            continue
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node",
                        f"Row frame {rid}", "--format", "png", "--out", str(png)], check=True, capture_output=True)
    (out / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(idx), "row frames ->", out)


def sheets(board):
    menu_and_writing(board)
    blocks(board)
    the_page(board)
    finding(board)
    conditions(board)
    row_frames(0)


def main():
    """Only the row frames (the person, 2026-11-20: no whole board). The .figcraft is a build file in design/build."""
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    row_frames(0)
    build = K.LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "notebook.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = K.B.find_cli()
    target = build / "notebook.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed: " + " | ".join(failed[-3:]) + out.stderr[-2000:])
    write_rows(cli, target)


if __name__ == "__main__":
    main()
