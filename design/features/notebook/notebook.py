"""The Notebook, round 2: Notion's quality as the template (N1-N12). Nothing is built from this until the person
accepts it. Scripture comes from `wb` (read-only database) via kit.fetch into data/; page titles and notes are a drawn
sample, never anyone's study.

    python -B design/features/notebook/notebook.py
"""
import json
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
         add_icon=False, bar=True, empty_title=False, lock=False, title_style="display"):
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
        para(tr, title, title_style, fontSize=40, lineHeight="48px")
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
            "Answered, and the questions list still finds them. The word for this block is open: the panel offers "
            "three names for the person to choose.")
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
    pn = col(f, "names", gap=8, pad=[14, 16, 14, 16], fill="surface", radius=12, W="fixed")
    Q.put(pn, W - 330, 640, 300)
    shadow(pn, 6, 28, SOFT)
    text(pn, "For the person: one word for this block", "smallStrong")
    for nm, sub in (("Callout", "as in Notion; “/callout”"), ("Box", "short; “/box”"),
                    ("Note box", "plain; may be confused with a note")):
        r = row(pn, f"name/{nm}", gap=10, pad=[6, 8, 6, 8], radius=6, fill="sunken", W="fill")
        frame(r, "radio", w=14, h=14, radius=7, stroke="muted", sw=1.5, W="fixed", H="fixed")
        tc = col(r, "t", gap=0, W="fill")
        text(tc, nm, "small")
        text(tc, sub, "caption", "muted")


TEXT_COLORS = (("Gray", "#787774"), ("Brown", "#9F6B53"), ("Orange", "#D9730D"), ("Yellow", "#CB912F"),
               ("Green", "#448361"), ("Teal", "#2B8A86"), ("Blue", "#337EA9"), ("Purple", "#9065B0"),
               ("Pink", "#C14C8A"), ("Red", "#D44C47"))
BG_COLORS = (("Gray", "#F1F1EF"), ("Brown", "#F4EEEE"), ("Orange", "#FBECDD"), ("Yellow", "#FBF3DB"),
             ("Green", "#EDF3EC"), ("Teal", "#E7F3F2"), ("Blue", "#E7F3F8"), ("Purple", "#F6F3F9"),
             ("Pink", "#FAF1F5"), ("Red", "#FDEBEC"))
FOLDER_COLORS = (("Phinehas", "#D9822B", "#F7DCC2"), ("Phinehas echoes", "#2E6FB8", "#D3E2F3"),
                 ("Salt", "#3B7A3B", "#D6E9CC"), ("Anna", "#B0457E", "#F3D6E5"), ("Sunday lessons", "#8A6D1F", "#F4E3A1"))


def the_page(board):
    cv = Q.section(board, "The page and color", 3200)
    Q.sheet_title(cv, "The page and color (N7 to N9)",
                  "Rows 25-33. An icon before the title (no cover), toggles, the page's three dots with Appearance, and the "
                  "page's colors: their own palette, or the folders' colors, for the person to choose.")
    rr = row(cv, "row d", gap=64, align="min")
    f = win(rr, "N7 · The page: an icon, Add icon on hover, toggles",
            "Rows 9, 27-28. The icon sits before the title and in the side list. Hovering the title of a page "
            "without one shows “Add icon” above it (inset). A toggle list folds its children; a heading can be a "
            "toggle too (Ctrl+Enter or the triangle). Folded or not is kept in settings/pages.json.")
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
    f = win(rr, "N9 · Color: the page's own palette, or the folders' colors",
            "Rows 25-26. Left: the page's own palette, ten text colors and ten pale backgrounds plus Default, the "
            "last used first. Right: the same menu when Settings › Notebook says “Page colors: Folder colors”, so a "
            "color in a page means the same as a folder's. The Legend's styles stay for marks. Drawn for the person "
            "to choose.", w=W, h=H)
    w = M.rail5(f, on="Notebook")
    frame(f, "canvas", x=w, y=0, w=W - w, h=H, fill="bg")
    text(f, "Own palette", "smallStrong", "muted", x=w + 40, y=30)
    m = pop(f, w + 40, 60, 250)
    mgroup(m, "Last used")
    mrow(m, "Blue background", swatch=("fg", "#E7F3F8"))
    mgroup(m, "Text color")
    mrow(m, "Default", swatch=("fg", None), check=True)
    for nm, c_ in TEXT_COLORS:
        mrow(m, nm, swatch=(c_, None))
    m = pop(f, w + 300, 60, 250)
    mgroup(m, "Background")
    mrow(m, "Default background", swatch=("fg", None))
    for nm, c_ in BG_COLORS:
        mrow(m, f"{nm} background", swatch=("fg", c_))
    text(f, "Folder colors", "smallStrong", "muted", x=w + 640, y=30)
    m = pop(f, w + 640, 60, 270)
    mgroup(m, "Text color")
    mrow(m, "Default", swatch=("fg", None), check=True)
    for nm, c_, _ in FOLDER_COLORS:
        mrow(m, nm, swatch=(c_, None))
    mgroup(m, "Background")
    mrow(m, "Default background", swatch=("fg", None))
    for nm, _, b_ in FOLDER_COLORS:
        mrow(m, f"{nm} background", swatch=("fg", b_))
    st = col(f, "Settings › Notebook", gap=10, pad=[18, 20, 18, 20], fill="surface", radius=12, stroke="line", sw=1,
             W="fixed")
    Q.put(st, w + 960, 60, 360)
    text(st, "Settings › Notebook", "heading")
    text(st, "Page colors", "smallStrong")
    P.segmented(st, ["Own palette", "Folder colors"], "Own palette")
    para(st, "Folder colors offers each folder's color, so a page's color and a folder's mean the same. "
             "Changing this never rewrites a page: a color already used stays as written.", "caption", "muted")
    K.note(f, "Open question for the person: which palette (README, Open questions).", w + 960, 330, 360)


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


def sheets(board):
    menu_and_writing(board)
    blocks(board)
    the_page(board)
    finding(board)
    conditions(board)


if __name__ == "__main__":
    K.run_board(HERE, BOARD, sheets)
