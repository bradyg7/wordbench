"""Filters, round 1 of the new design (2026-11-22): Notion-style filter chips on a list in a page and on the Library's
lists, pickers only. Reuses the Notebook's drawing (its accepted look) and its frame-per-row pipeline. Page titles,
folders and properties are a drawn sample, never anyone's study; no scripture is drawn.

    python -B design/features/filters-v2/filters2.py
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent / "library"))
sys.path.insert(0, str(HERE.parent / "notebook"))

import kit as K  # noqa: E402
from kit import F, M, P, Q, S, col, frame, icon, para, row, shadow, text  # noqa: E402
import notebook as N  # noqa: E402  (the accepted Notebook's drawing)

N.ROWS.clear()               # only this folder's frames
r_, pop, mgroup, mrow, msearch, sep = N.r_, N.pop, N.mgroup, N.mrow, N.msearch, N.sep
CW, CH = N.CW, N.CH

PAGES = (  # title, folder, folder color, Status, Book, edited, days ago
    ("Zeal", "Phinehas", "#D9822B", "Open", "Numbers", "3 Nov", 2),
    ("Zeal in Psalms 106", "Phinehas", "#D9822B", "Open", "Psalms", "1 Nov", 4),
    ("Covenant of peace", "Phinehas", "#D9822B", "Done", "Numbers", "28 Oct", 8),
    ("Haste", "Salt", "#3B7A3B", "Open", "Proverbs", "20 Oct", 16),
    ("Courage", "Salt", "#3B7A3B", "Done", "Joshua", "12 Oct", 24),
    ("Prayer list", "Anna", "#B0457E", "", "", "2 Oct", 34),
)
ALL = len(PAGES)


def dot(r, c_, s=8):
    frame(r, "dot", w=s, h=s, radius=s // 2, fill=c_, W="fixed", H="fixed")


def fchip(r, prop, value, open_=False, gone=False, big=False):
    """An applied filter, drawn as a button (round 2: the person found round 1's pills did not look clickable): a
    bordered, filled pill 'Property: value ▾' that opens its picker, and a separate × that takes it away."""
    p = [8, 10, 8, 14] if big else [5, 8, 5, 12]
    ch = row(r, f"chip/{prop}", gap=8, pad=p, radius=999, fill="accentSoft" if not gone else "sunken",
             stroke="accent" if (open_ or not gone) else "line", sw=1.5 if open_ else 1)
    text(ch, f"{prop}:", "body" if big else "small", "muted")
    text(ch, value, "bodyStrong" if big else "smallStrong", "muted" if gone else "fg")
    icon(ch, "down", 14 if big else 12, "fg")
    frame(ch, "rule", w=1, h=16 if big else 12, fill="line", W="fixed", H="fixed")
    icon(ch, "close", 16 if big else 13, "fg")
    return ch


def addchip(r, big=False):
    """'+ Add filter': a dashed-looking bordered button, labelled, never a bare icon."""
    a = row(r, "add", gap=6, pad=[8, 12, 8, 10] if big else [5, 10, 5, 8], radius=999, stroke="line", sw=1,
            fill="surface")
    icon(a, "plus", 14 if big else 12, "accent")
    text(a, "Add filter", "body" if big else "small", "accent")
    return a


def head(pg, view="Table", chips=(), shown=ALL, searching=None, add=True, clear=True, filter_on=False):
    tr = row(pg, "list head", gap=8, W="fill", pad=[6, 0, 6, 40])
    vb = row(tr, "view", gap=4, pad=[4, 8, 4, 8], radius=6, fill="sunken")
    icon(vb, {"Table": "table", "List": "list", "Gallery": "layers", "Board": "dock"}[view], 14, "fg")
    text(vb, view, "small")
    icon(vb, "down", 12, "muted")
    text(tr, f"All study pages · {shown} of {ALL} pages" if shown != ALL else f"All study pages · {ALL} pages",
         "caption", "muted", W="fill")
    if searching is not None:
        sb = row(tr, "search", gap=6, pad=[4, 10, 4, 8], radius=6, stroke="accent", sw=1, fill="surface")
        icon(sb, "search", 13, "muted")
        text(sb, searching or "Search this list", "small", "fg" if searching else "muted")
        frame(sb, "caret", w=2, h=16, fill="fg", W="fixed", H="fixed")
    else:
        icon(tr, "search", 15, "muted")
    fb = P.button(tr, f"Filter · {len(chips)}" if chips else "Filter", icon_name="filter", size="sm",
                  kind="soft" if filter_on else "secondary")
    cr = None
    if chips:
        # desktop: chips wrap onto a second line rather than squish or scroll (round 2, row 4); per_line chips a line
        per_line = 3
        lines = [chips[i:i + per_line] for i in range(0, len(chips), per_line)]
        for li, part in enumerate(lines):
            cr = row(pg, f"chips/{li}", gap=6, pad=[0, 0, 6, 40], W="fill")
            for c in part:
                fchip(cr, *c)
            if li == len(lines) - 1:
                if add:
                    addchip(cr)
                if clear:
                    cl = row(cr, "clear", pad=[5, 8, 5, 8], radius=6)
                    text(cl, "Clear all", "small", "accent")
    return tr, cr, fb


def table(pg, rows_):
    tbl = col(pg, "table", gap=0, W="fill", pad=[0, 0, 0, 40])
    hdr = ("Title", "Folder", "Status", "Book", "Edited")
    for i, cells in enumerate([hdr] + [(t, fo, st, bk, e) for t, fo, _, st, bk, e, _ in rows_]):
        r = row(tbl, f"tr/{i}", gap=0, W="fill", stroke="line", strokeBottomWeight=1, strokeTopWeight=0,
                strokeLeftWeight=0, strokeRightWeight=0)
        for j, c_ in enumerate(cells):
            cc = row(r, f"td/{j}", gap=6, pad=[8, 8, 8, 8], W="fill" if j == 0 else "fixed")
            if j:
                S.do("node.set", {"ids": [cc], "props": {"width": 112}}, ref=False)
            if i and j == 0:
                icon(cc, "page", 14, "muted")
            if i and j == 1:
                dot(cc, rows_[i - 1][2])
            text(cc, c_ or " ", "caption" if i == 0 else "small", "muted" if (i == 0 or j) else "fg")
    return tbl


def lpage(f, title="All study pages", side=False):
    x, pg = N.full(f, title, path=f"Pages  /  {title}", side=side)
    return x, pg


def pick(rows_, **want):
    keys = {"folder": 1, "status": 3, "book": 4}
    out = list(rows_)
    for k, v in want.items():
        out = [r for r in out if r[keys[k]] in (v if isinstance(v, tuple) else (v,))]
    return out


def checks(m, values, on=()):
    for v, n, c_ in values:
        r = row(m, f"v/{v}", gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="sunken" if v in on else None)
        b = frame(r, "box", w=14, h=14, radius=3, stroke="accent" if v in on else "line", sw=1.5,
                  fill="accent" if v in on else None, W="fixed", H="fixed")
        if c_:
            dot(r, c_)
        text(r, v, "small", W="fill")
        text(r, str(n), "caption", "muted")


def ops(m, on="is"):
    r = row(m, "ops", gap=4, pad=[2, 4, 6, 4], W="fill")
    for o in ("is", "is not", "is not set", "is set"):
        t = row(r, o, pad=[3, 8, 3, 8], radius=6, fill="accentSoft" if o == on else None)
        text(t, o, "caption", "fg" if o == on else "muted")


FOLDERS = (("Phinehas", 3, "#D9822B"), ("Salt", 2, "#3B7A3B"), ("Anna", 1, "#B0457E"))
STATUS = (("Open", 3, None), ("Done", 2, None))


# ---- A list in a page --------------------------------------------------------------------------------------------------
def filter_menu(f, y=150, on=None, custom=True):
    m = pop(f, CW - 520, y, 320)
    msearch(m, hint="Filter by…")
    mgroup(m, "About the page")
    mrow(m, "Folder", "folder", sub="the folder it is in", on=on == "Folder")
    mrow(m, "Edited", "trail", sub="when it was last changed", on=on == "Edited")
    mrow(m, "Written", "pen", sub="when it was first made", on=on == "Written")
    mrow(m, "Callout kind", "question", sub="questions, key points, notes in it", on=on == "Callout kind")
    mrow(m, "Book", "book", sub="the books of the Bible it names", on=on == "Book")
    mgroup(m, "Your own properties")
    mrow(m, "Status", "list", sub="a column you added", on=on == "Status")
    if custom:
        mrow(m, "Speaker", "list", sub="a column you added", on=on == "Speaker")
    return m


def explain(f, title, plain, example, chip, note=None):
    """A plain-words card beside the menu: what the property means, and one worked example."""
    c = col(f, f"explain/{title}", gap=10, pad=[18, 20, 18, 20], radius=12, fill="surface", stroke="line", sw=1,
            W="fixed")
    Q.put(c, 160, 540, 620)
    shadow(c, 4, 18, N.SOFT)
    text(c, title, "heading")
    para(c, plain, "body")
    text(c, "For example", "label", "muted")
    cr = row(c, "ex", gap=6)
    fchip(cr, *chip)
    para(c, example, "small")
    if note:
        para(c, note, "caption")


@r_("1a", "Step 1: every list in a page has a head. Click Filter (it says Filter, with its icon) to open the menu.")
def _r1a(f):
    x, pg = lpage(f)
    tr, _, fb = head(pg, filter_on=True)
    table(pg, PAGES)
    N.label(f, "Click Filter", CW - 330, 96)


@r_("1b", "Step 2: the Filter menu, each choice with a short line saying what it is. Your own properties (columns you "
          "added with + Property) are listed under their own heading.")
def _r1b(f):
    x, pg = lpage(f)
    head(pg, filter_on=True)
    table(pg, PAGES)
    filter_menu(f)


@r_("2a", "Pick Status: its values as a checklist with how many pages hold each. Ticking Open applies at once: the "
          "list narrows behind the menu and the chip appears. The four ways read in plain words.")
def _r2a(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "Open", True),), shown=3, filter_on=True)
    table(pg, pick(PAGES, status="Open"))
    m = pop(f, N.cxof(x) - 4, 238, 300)
    ops(m)
    checks(m, STATUS, on=("Open",))
    sep(m)
    mrow(m, "Remove filter", "trash", danger=True)


@r_("2b", "What the four ways mean, each with an example from the same list of six pages.")
def _r2b(f):
    c = col(f, "ways", gap=14, pad=[28, 32, 28, 32], W="fixed")
    Q.put(c, 120, 60, CW - 240)
    text(c, "The four ways a filter can read", "title")
    for way, plain, chip, shown in (
            ("is", "Show pages whose Status is one of the ticked values.", ("Status", "Open"), "3 of 6 pages"),
            ("is not", "Show pages whose Status is anything except the ticked values (and pages with none).",
             ("Status", "not Done"), "4 of 6 pages"),
            ("is not set", "Show pages that have no Status at all: the column is empty for them.",
             ("Status", "not set"), "1 of 6 pages: Prayer list"),
            ("is set", "Show pages that have any Status, whatever it is.", ("Status", "set"), "5 of 6 pages")):
        r = row(c, way, gap=20, pad=[14, 18, 14, 18], radius=10, fill="surface", stroke="line", sw=1, W="fill")
        w_ = row(r, "way", pad=[4, 12, 4, 12], radius=6, fill="accentSoft", W="fixed")
        S.do("node.set", {"ids": [w_], "props": {"width": 130}}, ref=False)
        text(w_, way, "bodyStrong")
        para(r, plain, "body")
        fchip(r, *chip)
        text(r, shown, "small", "muted")
    para(c, "Round 2 recommends these words over round 1's \"is empty\" and \"is not empty\": \"not set\" says the "
            "page has nothing in that column, which reads plainer for a property nobody typed yet.", "small")


@r_(3, "Click a chip to change it: the same picker opens under the chip, with is, is not, is not set and is set.")
def _r3(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "not Done", True),), shown=4)
    table(pg, [p for p in PAGES if p[3] != "Done"])
    m = pop(f, N.cxof(x) - 4, 238, 300)
    ops(m, "is not")
    checks(m, STATUS, on=("Done",))


@r_("4b", "Many filters at the full width: the chips wrap onto a second line; nothing is squeezed or hidden, and "
          "Add filter and Clear all stay at the end.")
def _r4b(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "Open"), ("Folder", "Phinehas, Salt"), ("Book", "Numbers"), ("Edited", "Last 30 days"),
                    ("Speaker", "J. Moore"), ("Callout kind", "Question")), shown=1)
    table(pg, pick(PAGES, status="Open", book="Numbers"))


@r_("4a", "× on a chip takes that filter away; the list widens at once and focus moves to the next chip, or to Filter.")
def _r4(f):
    l_, r = N.halves(f)
    for side, chips, rows_ in ((l_, (("Status", "Open"), ("Folder", "Phinehas")), pick(PAGES, status="Open", folder="Phinehas")),
                               (r, (("Status", "Open"),), pick(PAGES, status="Open"))):
        pg = N.page(side, 0, CW // 2, "All study pages", path="Pages  /  All study pages", colw=560)
        head(pg, chips=chips, shown=len(rows_))
        table(pg, rows_)
    K.note(f, "Before: × on Folder: Phinehas.  After: only Status: Open is left.", 60, CH - 120, 520)


@r_(5, "Clear takes every filter away; the list shows all its pages again and the search words, if any, stay.")
def _r5(f):
    l_, r = N.halves(f)
    pg = N.page(l_, 0, CW // 2, "All study pages", path="Pages  /  All study pages", colw=560)
    head(pg, chips=(("Status", "Open"), ("Book", "Numbers")), shown=1)
    table(pg, pick(PAGES, status="Open", book="Numbers"))
    pg2 = N.page(r, 0, CW // 2, "All study pages", path="Pages  /  All study pages", colw=560)
    head(pg2)
    table(pg2, PAGES)


@r_(6, "Two filters: a page must match both. The head counts what is shown, 2 of 6 pages.")
def _r6(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "Open"), ("Folder", "Phinehas")), shown=2)
    table(pg, pick(PAGES, status="Open", folder="Phinehas"))
    K.note(f, "Every chip must match (and). A chip with several ticked values matches any of them: Folder: Phinehas, Salt.",
           N.cxof(x) + 40, 420, 480)


@r_(7, "Edited or Written: fixed choices only — Today, Last 7 days, Last 30 days, Last year, Any time. No typed dates.")
def _r7(f):
    x, pg = lpage(f)
    head(pg, chips=(("Edited", "Last 7 days", True),), shown=2)
    table(pg, [p for p in PAGES if p[6] <= 7])
    m = pop(f, N.cxof(x) - 4, 238, 240)
    for lab in ("Today", "Last 7 days", "Last 30 days", "Last year", "Any time"):
        mrow(m, lab, check=lab == "Last 7 days")


@r_(8, "Search this list: the only typed field. Its words narrow the list together with the chips, and Esc empties it.")
def _r8(f):
    x, pg = lpage(f)
    head(pg, chips=(("Folder", "Phinehas"),), shown=2, searching="zeal")
    table(pg, [p for p in pick(PAGES, folder="Phinehas") if "Zeal" in p[0]])


@r_(9, "The same chips on every view. On a Board grouped by Status, a column whose pages are all filtered out shows "
       "its heading with 0 and stays, so a card can still be dragged into it.")
def _r9(f):
    x, pg = lpage(f)
    head(pg, view="Board", chips=(("Folder", "Salt"),), shown=2)
    bd = row(pg, "board", gap=14, W="fill", align="min", pad=[0, 0, 0, 40])
    for st in ("Open", "Done", "No Status"):
        items = [p for p in pick(PAGES, folder="Salt") if (p[3] or "No Status") == st]
        c = col(bd, st, gap=8, pad=[10, 10, 10, 10], radius=10, fill="sunken", W="fill")
        hr = row(c, "h", gap=6)
        text(hr, st, "smallStrong")
        text(hr, str(len(items)), "caption", "muted")
        for t_, fo, c_, *_ in items:
            cd = row(c, t_, gap=8, pad=[10, 12, 10, 12], radius=8, fill="surface", stroke="line", sw=1, W="fill")
            dot(cd, c_)
            text(cd, t_, "small")


@r_(10, "Nothing matches: one quiet line and Clear filters, in the list's own place; the chips stay so one can be changed.")
def _r10(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "Done"), ("Book", "Psalms")), shown=0)
    e = col(pg, "empty", gap=8, pad=[40, 0, 40, 40], W="fill", crossAlign="center")
    text(e, "No pages match these filters.", "body", "muted")
    P.button(e, "Clear filters", size="sm")


def fence(f, lines, x, y, w=440):
    code = col(f, "file", gap=2, pad=[14, 16, 14, 16], radius=8, fill="sunken", W="fixed")
    Q.put(code, x, y, w)
    text(code, "What the page's file holds", "caption", "muted")
    for ln in lines:
        text(code, ln, "small", "fg")


@r_("11a", "Monday: two filters are added to the list in the Zeal page. The page keeps them as it keeps your words; "
           "there is nothing to save.")
def _r11a(f):
    l_, r = N.halves(f, "Monday: filters added", "Then: the page is closed")
    pg = N.page(l_, 0, CW // 2, "Zeal", path="Phinehas  /  Zeal", colw=560)
    head(pg, chips=(("Status", "Open"), ("Edited", "Last 30 days")), shown=3)
    table(pg, pick(PAGES, status="Open"))
    e = col(r, "closed", gap=10, pad=[160, 40, 0, 40], W="fixed", crossAlign="center")
    Q.put(e, 0, 0, CW // 2)
    icon(e, "page", 40, "muted")
    para(e, "The Zeal page is closed. Nothing asks to save.", "body")


@r_("11b", "Tuesday: open the Zeal page again and the same two chips are on its list, showing the same 3 of 6 pages.")
def _r11b(f):
    x, pg = N.full(f, "Zeal", path="Phinehas  /  Zeal")
    head(pg, chips=(("Status", "Open"), ("Edited", "Last 30 days")), shown=3)
    table(pg, pick(PAGES, status="Open"))
    N.label(f, "Tuesday, opened again", N.cxof(x) + 40, 60)
    fence(f, ("```view", "notebook", "view: table", "filter: Status is Open", "filter: Edited last 30 days", "```"),
          CW - 500, CH - 250)



@r_(12, "A filter whose value is gone (its folder deleted, a property removed): the chip shows the value struck and "
        "'gone'; the list ignores it; × takes it away. Nothing is changed on disk until then.")
def _r12(f):
    x, pg = lpage(f)
    _, cr, _ = head(pg, chips=(("Status", "Open"), ("Folder", "Salt (gone)", False, True)), shown=3)
    table(pg, pick(PAGES, status="Open"))


# ---- The Library's lists -----------------------------------------------------------------------------------------------
def side_q(f, on="Questions"):
    """The side list as NB13 built it: Recents, Pinned, Folders, Pages, then Questions, Margin notes and the Shelf."""
    x = 72
    t = col(f, "side list", gap=2, pad=[12, 10, 12, 10], fill="sunken", W="fixed", H="fixed")
    Q.put(t, x, 0, 270)
    S.do("node.set", {"ids": [t], "props": {"height": CH}}, ref=False)

    M.rail5(f, on="Notebook")
    P.field(t, "Search pages", None, icon_name="search", height=30)
    for lab, n in (("Recents", "8"), ("Pinned", "2"), ("Folders", "5"), ("Pages", "75")):
        hd = row(t, lab, gap=6, W="fill", pad=[10, 6, 4, 6])
        text(hd, lab.upper(), "label", "muted", W="fill")
        text(hd, n, "caption", "muted")
        icon(hd, "down", 11, "muted")
    frame(t, "gap", w=10, h=CH - 360, W="fixed", H="fixed")
    for lab, ic, n in (("Questions", "question", "12"), ("Margin notes", "list", "86"), ("The Shelf", "layers", "4")):
        r = row(t, lab, gap=8, pad=[8, 8, 8, 8], radius=8, W="fill",
                fill="accentSoft" if lab == on else None, stroke="accent" if lab == on else None,
                sw=1.5 if lab == on else None)
        icon(r, ic, 15, "question" if ic == "question" else "muted")
        text(r, lab, "smallStrong" if lab == on else "small", W="fill")
        text(r, n, "caption", "muted")
    return x + 270


@r_("13a", "Step 1: the Questions list is at the foot of the side list, above Margin notes. Click Questions.")
def _r13a(f):
    side_q(f)
    N.label(f, "Click Questions", 360, CH - 150)


@r_("13b", "Step 2: the Questions list. All, Question and Answered stay as built; Add filter beside them adds a Folder "
           "or Book chip from the same picker.")
def _r13(f):
    x = side_q(f)
    pn = col(f, "questions", gap=10, pad=[20, 24, 20, 24], W="fixed")
    Q.put(pn, x, 40, CW - x)
    text(pn, "Questions", "heading")
    cr = row(pn, "kinds", gap=6)
    for k in ("All", "Question", "Answered"):
        P.chip(cr, k, kind="selected" if k == "Question" else "outline")
    fchip(cr, "Folder", "Phinehas")
    addchip(cr)
    for q, p in (("Why is zeal counted to him for righteousness?", "Zeal"),
                 ("What is the covenant of an everlasting priesthood?", "Covenant of peace")):
        r = row(pn, q[:10], gap=10, pad=[10, 4, 10, 4], W="fill", stroke="line", strokeBottomWeight=1,
                strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
        icon(r, "question", 15, "question")
        text(r, q, "small", W="fill")
        text(r, p, "caption", "muted")
    K.note(f, "The questions drawn are samples, not anyone's study.", x + 24, CH - 110, 420)



@r_(14, "Ctrl+K: the same chips under the search field narrow the one search — a kind (Pages, Questions, Key points, "
        "Notes, Folders) and a folder. Esc clears the words first, then closes.")
def _r14(f):
    frame(f, "scrim", x=0, y=0, w=CW, h=CH, fill="#0000001F")
    m = pop(f, 360, 90, 720, pad=8)
    msearch(m, "zeal")
    cr = row(m, "chips", gap=6, pad=[2, 8, 8, 8], W="fill")
    fchip(cr, "Kind", "Pages")
    fchip(cr, "Folder", "Phinehas")
    a = row(cr, "add", gap=4, pad=[4, 8, 4, 8])
    icon(a, "plus", 12, "muted")
    text(a, "Filter", "small", "muted")
    mgroup(m, "Pages")
    mrow(m, "Zeal", "page", sub="Phinehas")
    mrow(m, "Zeal in Psalms 106", "page", sub="Phinehas")


VERSES = [f"Numbers 25:{v}" for v in range(1, 19)] + [f"Psalms 106:{v}" for v in range(28, 32)] + \
         [f"Exodus 32:{v}" for v in range(25, 30)] + [f"1 Corinthians 10:{v}" for v in range(6, 12)]
WORDS = ["H7065", "H7068", "H3722", "H7965", "H1285", "H3550", "G2205", "G2206"]
FPAGES = ["Zeal", "Zeal in Psalms 106", "Covenant of peace", "Atonement in Numbers", "Priesthood", "Baal-peor"]


@r_(15, "An opened folder holding about a hundred saves of every kind: grouped by kind with counts, scrolling, with "
        "Add filter for a kind of save and a book. Here 120 saves (Salt); the Verse and Numbers chips show 18 of them.")
def _r15(f):
    x = N.app(f, list_kw={"on": "Salt"})
    pn = col(f, "folder", gap=6, pad=[20, 28, 20, 28], W="fixed", H="fixed", clip=True)
    Q.put(pn, x, 0, CW - x)
    S.do("node.set", {"ids": [pn], "props": {"height": CH}}, ref=False)
    hr = row(pn, "h", gap=8)
    text(hr, "Salt", "heading")
    text(hr, "120 saves: 72 verses, 18 words, 24 pages, 6 searches", "caption", "muted")
    cr = row(pn, "chips", gap=6, pad=[4, 0, 8, 0])
    fchip(cr, "Save", "Verse")
    fchip(cr, "Book", "Numbers")
    addchip(cr)
    cl = row(cr, "clear", pad=[5, 8, 5, 8])
    text(cl, "Clear all", "small", "accent")
    text(pn, "Showing 18 of 120", "caption", "muted")
    hd = row(pn, "g/verses", gap=6, pad=[8, 0, 4, 0], W="fill")
    icon(hd, "down", 11, "muted")
    text(hd, "VERSES", "label", "muted", W="fill")
    text(hd, "18", "caption", "muted")
    grid = row(pn, "grid", gap=8, W="fill")
    for ci in range(3):
        c = col(grid, f"c{ci}", gap=2, W="fill")
        for ref in VERSES[ci * 6:(ci + 1) * 6]:
            r = row(c, ref, gap=8, pad=[7, 8, 7, 8], radius=6, W="fill", stroke="line", sw=1, fill="surface")
            icon(r, "place", 14, "accent")
            text(r, ref, "small", "accent")
    para(pn, "Without the chips the same folder shows every group in its own order:", "caption")
    for lab, n, items, ic in (("VERSES", "72", VERSES[18:24], "place"), ("WORDS", "18", WORDS, "book"),
                              ("PAGES", "24", FPAGES, "page"), ("SEARCHES", "6", ["zeal", "jealous for my sake"], "search")):
        hd = row(pn, f"g/{lab}", gap=6, pad=[8, 0, 4, 0], W="fill")
        icon(hd, "down", 11, "muted")
        text(hd, lab, "label", "muted", W="fill")
        text(hd, n, "caption", "muted")
        r = row(pn, f"items/{lab}", gap=6, W="fill")
        for it in items[:6]:
            ch = row(r, it, gap=6, pad=[6, 10, 6, 8], radius=6, stroke="line", sw=1, fill="surface")
            icon(ch, ic, 13, "muted")
            text(ch, it, "small")
    sb = frame(f, "scrollbar", x=CW - 14, y=60, w=6, h=180, radius=3, fill="line", W="fixed", H="fixed")
    K.note(f, "Saves drawn are references and Strong's numbers only; no scripture is drawn.", x + 28, CH - 60, 520)


@r_("16a", "Phone: the list's head has a clear Filter button with its count, the chips are big buttons that wrap onto "
           "as many lines as they need, and nothing runs off the screen.")
def _r16a(f):
    ph = frame(f, "phone", x=200, y=30, w=390, h=800, fill="bg", radius=28, stroke="line", sw=1, W="fixed",
               H="fixed", clip=True)
    shadow(ph, 8, 30, N.SOFT)
    pg = col(ph, "page", gap=10, pad=[28, 16, 0, 16], W="fixed")
    Q.put(pg, 0, 0, 390)
    text(pg, "All study pages", "heading")
    hd = row(pg, "head", gap=8, W="fill")
    text(hd, "3 of 6 pages", "small", "muted", W="fill")
    P.button(hd, "Filter · 3", icon_name="filter", size="md", kind="soft")
    for part in ((("Status", "Open"),), (("Folder", "Phinehas"),), (("Edited", "Last 7 days"),)):
        cr = row(pg, "chips", gap=8, W="fill")
        for c in part:
            fchip(cr, *c, big=True)
    cr = row(pg, "acts", gap=8, W="fill")
    addchip(cr, big=True)
    cl = row(cr, "clear", pad=[8, 10, 8, 10])
    text(cl, "Clear all", "body", "accent")
    for t_, fo, c_, *_ in pick(PAGES, status="Open"):
        r = row(pg, t_, gap=10, pad=[14, 4, 14, 4], W="fill", stroke="line", strokeBottomWeight=1, strokeTopWeight=0,
                strokeLeftWeight=0, strokeRightWeight=0)
        dot(r, c_, 10)
        text(r, t_, "body", W="fill")
        icon(r, "right", 14, "muted")
    K.note(f, "Every chip is a button: a border, a fill, its ▾ and a separate ×, at least 44 px tall to tap.", 640, 200, 480)
    K.note(f, "The desktop chips take the same look, smaller.", 640, 300, 480)


@r_("16b", "Phone: tapping a chip or Filter opens a bottom sheet with big rows, the four ways as buttons, and Done; "
           "the list behind narrows as you tick.")
def _r16b(f):
    ph = frame(f, "phone", x=200, y=30, w=390, h=800, fill="bg", radius=28, stroke="line", sw=1, W="fixed",
               H="fixed", clip=True)
    shadow(ph, 8, 30, N.SOFT)
    frame(ph, "scrim", x=0, y=0, w=390, h=800, fill="#00000033")
    sh = col(ph, "sheet", gap=8, pad=[12, 18, 28, 18], fill="surface", radius=20, W="fixed")
    Q.put(sh, 0, 360, 390)
    frame(sh, "grab", w=40, h=5, radius=3, fill="line", W="fixed", H="fixed")
    top = row(sh, "top", gap=8, W="fill")
    text(top, "Status", "heading", W="fill")
    P.button(top, "Done", size="md", kind="primary")
    wr = row(sh, "ways", gap=6, W="fill")
    for o in ("is", "is not", "is not set", "is set"):
        w_ = row(wr, o, pad=[8, 12, 8, 12], radius=8, fill="accentSoft" if o == "is" else "sunken",
                 stroke="accent" if o == "is" else None, sw=1 if o == "is" else None)
        text(w_, o, "small", "fg")
    for v, n in (("Open", 3), ("Done", 2)):
        r = row(sh, v, gap=14, pad=[14, 12, 14, 12], radius=10, W="fill", fill="sunken" if v == "Open" else None,
                stroke="line", sw=1)
        frame(r, "box", w=22, h=22, radius=5, stroke="accent" if v == "Open" else "line", sw=2,
              fill="accent" if v == "Open" else None, W="fixed", H="fixed")
        text(r, v, "body", W="fill")
        text(r, f"{n} pages", "small", "muted")
    mr = row(sh, "remove", gap=8, pad=[12, 12, 4, 12], W="fill")
    icon(mr, "trash", 16, "warn")
    text(mr, "Remove this filter", "body", "warn")


def prop_row(rid, prop, plain, example, chip, values, on_menu=None, note=None):
    @r_(rid, f"{prop}: {plain}")
    def _f(f):
        x, pg = lpage(f)
        head(pg, chips=(chip,), shown=example[1], filter_on=True)
        table(pg, example[0])
        filter_menu(f, on=on_menu or prop)
        explain(f, prop, plain, example[2], chip, note)
    return _f


prop_row("17", "Folder", "the folder a page is in. A list that gathers pages from several folders can be narrowed "
         "to one or more of them.", (pick(PAGES, folder="Phinehas"), 3, "Folder: Phinehas shows only the 3 pages in the "
         "Phinehas folder."), ("Folder", "Phinehas"), FOLDERS)
prop_row("18", "Status", "a column you add yourself with + Property, such as Open and Done for a study you are still "
         "working on. Status means only what you make it mean; the app never sets it.",
         (pick(PAGES, status="Open"), 3, "Status: Open shows the 3 pages you marked Open."), ("Status", "Open"), STATUS,
         note="A question's Answered and Question come from its callout, not from Status: use Callout kind for those.")
prop_row("19", "Edited and Written", "Edited is when the page was last changed; Written is when it was first made. "
         "Both pick from fixed choices: Today, Last 7 days, Last 30 days, Last year.",
         ([p for p in PAGES if p[6] <= 7], 2, "Edited: Last 7 days shows the 2 pages changed this week, however old "
          "they are."), ("Edited", "Last 7 days"), (), on_menu="Edited")
prop_row("20", "Book", "the books of the Bible a page names in its references and Scripture blocks. A page that names "
         "Numbers and Psalms is found under both.",
         (pick(PAGES, book="Numbers"), 2, "Book: Numbers shows the 2 pages whose references are in Numbers."),
         ("Book", "Numbers"), (), note="Chapter, when it is wanted, is picked inside Book: Numbers › 25.")
prop_row("21", "Callout kind", "the callouts written in a page: Question, Answered, Key point or Note. A page with a "
         "question still open shows under Question.",
         (pick(PAGES, status="Open")[:2], 2, "Callout kind: Question shows the 2 pages that hold an open question."),
         ("Callout kind", "Question"), ())
prop_row("22", "Your own properties", "any column you added to the list with + Property (here Speaker, for lessons "
         "taught by different people). It is offered in the Filter menu with the values your pages hold.",
         (PAGES[:2], 2, "Speaker: J. Moore shows the 2 lessons with that speaker."), ("Speaker", "J. Moore"), (),
         on_menu="Speaker", note="A property is kept in each page's own file, on its props: line.")


@r_("23a", "Where a list comes from: in any page, type / and pick List in a page. It is not a separate place; any "
           "page can hold one.")
def _r23a(f):
    x, pg = N.full(f, "Phinehas index", path="Phinehas  /  Phinehas index")
    N.caret_line(pg, "", "/list")
    m = pop(f, N.cxof(x) + 40, 210, 320)
    mgroup(m, "Basic")
    mrow(m, "List in a page", "table", sub="a folder's pages, in a table or board", on=True)
    mrow(m, "Table", "table", sub="a plain table you type into")


@r_("23b", "Then pick which folder's pages it lists. The list shows those pages; its head carries the view, Search "
           "and Filter. 'All study pages' in these frames is such a list, placed in a page of that name.")
def _r23b(f):
    x, pg = N.full(f, "Phinehas index", path="Phinehas  /  Phinehas index")
    head(pg)
    table(pg, PAGES)
    m = pop(f, N.cxof(x) + 40, 170, 300)
    msearch(m, hint="List the pages of…")
    for fo, n, c_ in FOLDERS:
        mrow(m, fo, "folder", sub=f"{n} pages", on=fo == "Phinehas")
    mrow(m, "Every page", "page", sub="all your pages")



ORDER = list(range(1, 24))


def write_rows(cli, target):
    out = HERE / "rows"
    out.mkdir(exist_ok=True)
    idx = []
    for rid, num, cap, _ in sorted(N.ROWS, key=lambda r: (ORDER.index(r[1]), r[0])):
        png = out / f"{rid}.png"
        idx.append({"id": rid, "row": num, "file": f"rows/{rid}.png", "caption": cap})
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", N.BOARD, "--node",
                        f"Row frame {rid}", "--format", "png", "--out", str(png)], check=True, capture_output=True)
    (out / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(idx), "row frames ->", out)


def main():
    F.define_tokens()
    S.do("page.rename", {"name": N.BOARD}, ref=False)
    N.row_frames(0)
    build = K.LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "filters2.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = K.B.find_cli()
    target = build / "filters2.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed: " + " | ".join(failed[-3:]) + out.stderr[-2000:])
    write_rows(cli, target)


if __name__ == "__main__":
    main()
