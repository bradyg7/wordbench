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
from kit import F, P, Q, S, col, frame, icon, para, row, shadow, text  # noqa: E402
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


def fchip(r, prop, value, open_=False, gone=False):
    """An applied filter: one pill, 'Property: value', its ▾ opens the picker, × takes it away."""
    ch = row(r, f"chip/{prop}", gap=6, pad=[4, 8, 4, 12], radius=999, fill="accentSoft" if not gone else "sunken",
             stroke="accent" if open_ else ("line" if gone else None), sw=1 if (open_ or gone) else None)
    text(ch, f"{prop}:", "small", "muted")
    text(ch, value, "smallStrong", "muted" if gone else "fg")
    icon(ch, "down", 11, "muted")
    icon(ch, "close", 12, "muted")
    return ch


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
        cr = row(pg, "chips", gap=6, pad=[0, 0, 8, 40], W="fill")
        for c in chips:
            fchip(cr, *c)
        if add:
            a = row(cr, "add", gap=4, pad=[4, 8, 4, 8], radius=999)
            icon(a, "plus", 12, "muted")
            text(a, "Filter", "small", "muted")
        if clear:
            text(cr, "Clear", "small", "muted")
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
    for o in ("is", "is not", "is empty", "is not empty"):
        t = row(r, o, pad=[3, 8, 3, 8], radius=6, fill="accentSoft" if o == on else None)
        text(t, o, "caption", "fg" if o == on else "muted")


FOLDERS = (("Phinehas", 3, "#D9822B"), ("Salt", 2, "#3B7A3B"), ("Anna", 1, "#B0457E"))
STATUS = (("Open", 3, None), ("Done", 2, None))


# ---- A list in a page --------------------------------------------------------------------------------------------------
@r_(1, "Filter on a list in a page: a searchable menu of what the list can be filtered by — its folders, callout kind, "
       "when pages were written or edited, and every page property the list's pages hold.")
def _r1(f):
    x, pg = lpage(f)
    head(pg, filter_on=True)
    table(pg, PAGES)
    m = pop(f, CW - 520, 150, 300)
    msearch(m)
    mgroup(m, "Filter by")
    mrow(m, "Folder", "folder")
    mrow(m, "Callout kind", "question")
    mrow(m, "Edited", "trail")
    mrow(m, "Written", "pen")
    mgroup(m, "Page properties")
    mrow(m, "Status", "list")
    mrow(m, "Book", "book")


@r_(2, "Pick Status: its values as a checklist with how many pages hold each. Ticking Open applies at once — the "
       "list narrows behind the menu and the chip appears. No Apply button.")
def _r2(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "Open", True),), shown=3, filter_on=True)
    table(pg, pick(PAGES, status="Open"))
    m = pop(f, N.cxof(x) - 4, 238, 280)
    ops(m)
    checks(m, STATUS, on=("Open",))
    sep(m)
    mrow(m, "Remove filter", "trash", danger=True)


@r_(3, "Click a chip to change it: the same picker opens under the chip, with is, is not, is empty and is not empty.")
def _r3(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "not Done", True),), shown=4)
    table(pg, [p for p in PAGES if p[3] != "Done"])
    m = pop(f, N.cxof(x) - 4, 238, 280)
    ops(m, "is not")
    checks(m, STATUS, on=("Done",))


@r_(4, "× on a chip takes that filter away; the list widens at once and focus moves to the next chip, or to Filter.")
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


@r_(11, "Kept in the page: open it again and the chips are as they were. The ```view fence holds one filter: line each "
        "(shown here as the file holds it).")
def _r11(f):
    x, pg = lpage(f)
    head(pg, chips=(("Status", "Open"), ("Edited", "Last 30 days")), shown=3)
    table(pg, [p for p in pick(PAGES, status="Open")])
    code = col(f, "file", gap=2, pad=[14, 16, 14, 16], radius=8, fill="sunken", W="fixed")
    Q.put(code, CW - 520, CH - 260, 440)
    for ln in ("```view", "notebook", "view: table", "columns: Folder, Status, Book", "filter: Status is Open",
               "filter: Edited last 30 days", "```"):
        text(code, ln, "small", "fg")


@r_(12, "A filter whose value is gone (its folder deleted, a property removed): the chip shows the value struck and "
        "'gone'; the list ignores it; × takes it away. Nothing is changed on disk until then.")
def _r12(f):
    x, pg = lpage(f)
    _, cr, _ = head(pg, chips=(("Status", "Open"), ("Folder", "Salt (gone)", False, True)), shown=3)
    table(pg, pick(PAGES, status="Open"))


# ---- The Library's lists -----------------------------------------------------------------------------------------------
@r_(13, "The Questions list in the side list: All, Question and Answered stay as built; + Filter beside them adds a "
        "Folder or Book chip from the same picker.")
def _r13(f):
    x = N.app(f, list_kw={"on": "Questions"})
    pn = col(f, "questions", gap=8, pad=[20, 24, 20, 24], W="fixed")
    Q.put(pn, x, 60, CW - x)
    text(pn, "Questions", "heading")
    cr = row(pn, "kinds", gap=6)
    for k in ("All", "Question", "Answered"):
        P.chip(cr, k, kind="selected" if k == "Question" else "outline")
    fchip(cr, "Folder", "Phinehas")
    a = row(cr, "add", gap=4, pad=[4, 8, 4, 8])
    icon(a, "plus", 12, "muted")
    text(a, "Filter", "small", "muted")
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


@r_(15, "An opened folder with many saves: + Filter offers what its saves are — a kind of save (verse, word, page, "
        "search) and a book — as chips over the folder's own order.")
def _r15(f):
    x = N.app(f, list_kw={"on": "Phinehas"})
    pn = col(f, "folder", gap=8, pad=[20, 24, 20, 24], W="fixed")
    Q.put(pn, x, 60, CW - x)
    hr = row(pn, "h", gap=8)
    dot(hr, "#D9822B", 10)
    text(hr, "Phinehas", "heading")
    text(hr, "56 pages and saves", "caption", "muted")
    cr = row(pn, "chips", gap=6)
    fchip(cr, "Save", "Verse")
    fchip(cr, "Book", "Numbers")
    text(cr, "Clear", "small", "muted")
    for t_, ic in (("Numbers 25:11", "place"), ("Numbers 25:12", "place"), ("Numbers 25:13", "place")):
        r = row(pn, t_, gap=10, pad=[8, 4, 8, 4], W="fill")
        icon(r, ic, 15, "muted")
        text(r, t_, "small", "accent")


# ---- Real conditions ---------------------------------------------------------------------------------------------------
@r_(16, "Phone and narrow panes: the chips stay on one line and scroll sideways; Filter and a chip's picker open as a "
        "bottom sheet with the same checklist.")
def _r16(f):
    ph = frame(f, "phone", x=520, y=30, w=390, h=800, fill="bg", radius=28, stroke="line", sw=1, W="fixed", H="fixed",
               clip=True)
    shadow(ph, 8, 30, N.SOFT)
    pg = col(ph, "page", gap=6, pad=[24, 16, 0, 16], W="fixed")
    Q.put(pg, 0, 0, 390)
    text(pg, "All study pages", "heading")
    cr = row(pg, "chips", gap=6, W="fill", clip=True)
    fchip(cr, "Status", "Open", True)
    fchip(cr, "Folder", "Phinehas")
    fchip(cr, "Edited", "Last 7 days")
    for t_, fo, c_, *_ in pick(PAGES, status="Open"):
        r = row(pg, t_, gap=8, pad=[10, 0, 10, 0], W="fill")
        dot(r, c_)
        text(r, t_, "small")
    sh = col(ph, "sheet", gap=4, pad=[10, 16, 24, 16], fill="surface", radius=18, W="fixed")
    Q.put(sh, 0, 600, 390)
    shadow(sh, -4, 24, N.SOFT)
    frame(sh, "grab", w=36, h=4, radius=2, fill="line", W="fixed", H="fixed")
    text(sh, "Status", "smallStrong")
    ops(sh)
    checks(sh, STATUS, on=("Open",))


ORDER = list(range(1, 17))


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
