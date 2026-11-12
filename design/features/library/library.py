"""The Notebook and the Shelf as one library, and what keeping (a bookmark) means. Nothing is built from this until the
person accepts it. Scripture shown comes from design/content.json (generated from the database).

    python design/features/library/library.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE.parent / "minimize"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
from figlib import S, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
C = B.C
BOARD = "Library"
PG = "Library"


def verse(key, v):
    return next(x for x in C[key]["verses"] if x["v"] == v)["text"]


def drawer(f, x, w=290, open_folder="Phinehas", shelf_on=None):
    """The Notebook drawer: Pages (folders hold pages and kept things alike) and the Shelf (kept, not yet filed)."""
    d = col(f, "library drawer", gap=3, pad=[14, 10, 14, 10], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(d, x, TB, w, H - TB)
    sr = row(d, "find", gap=8, W="fill", pad=[0, 0, 8, 0])
    P.field(sr, "Find in the library", None, icon_name="search", height=32)

    def node(label, ic, depth=0, on=False, kind=None, muted=False):
        it = row(d, f"node/{label}", gap=8, pad=[5, 8, 5, 8 + 16 * depth], radius=8, fill="accentSoft" if on else None,
                 W="fill")
        icon(it, ic, 16, "accent" if on else "muted")
        text(it, label, "smallStrong" if on else "small", "accent" if on else ("muted" if muted else "fg"), W="fill",
             maxLines=1)
        if kind:
            text(it, kind, "caption", "muted")

    hd = row(d, "pages head", gap=6, W="fill", pad=[6, 4, 2, 4])
    text(hd, "PAGES AND FOLDERS", "label", "muted", W="fill")
    icon(hd, "plus", 14, "muted")
    node("Phinehas", "folder", on=(open_folder == "Phinehas" and shelf_on is None))
    if open_folder == "Phinehas":
        node("Phinehas", "page", 1, kind="page")
        node("Numbers 25:11", "book", 1, kind="verse")
        node("H7065", "word", 1, kind="word")
        node("Trail from Numbers 25:11", "trail", 1, kind="trail")
        node("Phinehas.pdf", "docs", 1, kind="document")
    node("Covenant of peace", "folder")
    node("Zeal", "page")
    node("Today · Wednesday 11 November", "page", muted=True, kind="optional")
    hd = row(d, "shelf head", gap=6, W="fill", pad=[12, 4, 2, 4])
    text(hd, "SHELF · KEPT, NOT YET FILED", "label", "muted", W="fill")
    for label, ic, kind in (("Psalms 106:30", "book", "verse"), ("Every use: zeal", "list", "search"),
                            ("G2205", "word", "word"), ("Malachi 2:5", "book", "verse")):
        node(label, ic, on=(label == shelf_on), kind=kind)
    return d


def keep_button(parent, on=False):
    b = row(parent, "keep", gap=6, pad=[6, 10, 6, 8], radius=8, fill="accentSoft" if on else "surface",
            stroke="accent" if on else "line", sw=1)
    icon(b, "bookmark", 16, "accent")
    text(b, "Kept" if on else "Keep", "smallStrong", "accent" if on else "fg")
    return b


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "The library: pages, folders and keeping",
                  "One idea for what a bookmark is. To keep something is one step (the bookmark, or K) on anything you "
                  "can open: a verse, a word, a Concordance entry, a search, a page, a document, a trail. Kept things "
                  "land on the Shelf; putting one in a folder is the optional second step. A folder holds pages and "
                  "kept things alike, and is today's Shelf set under a new name (same file, so nothing moves).")

    r = row(cv, "row 1", gap=64, align="min")
    f = Q.win(r, PG, "S1 · Keep a verse: one step",
              "Select a verse; Keep is on the selection bar (or press K). It lands on the Shelf at once. The toast "
              "offers the second step, a folder, and Undo. A kept verse shows a ribbon at its number.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13, sel=(11, 0, 999))
    bar = row(f, "selection bar", gap=6, pad=[6, 8, 6, 8], fill="surface", radius=12, stroke="line", sw=1)
    Q.put(bar, w + 420, TB + 345)
    shadow(bar, 8, 24, "#00000026")
    for c_ in ("hlYellow", "hlGreen", "hlBlue", "hlPink"):
        frame(bar, f"color/{c_}", w=22, h=22, radius=11, fill=c_, W="fixed", H="fixed")
    keep_button(bar, on=True)
    for lab, ic in (("Note", "pen"), ("Thread", "threads"), ("Copy", "copy")):
        b = row(bar, f"tool/{lab}", gap=6, pad=[6, 8, 6, 8])
        icon(b, ic, 16, "fg")
        text(b, lab, "smallStrong")
    rib = frame(f, "ribbon", x=w + 752, y=TB + 84, w=10, h=8, fill="accent", W="fixed", H="fixed")
    toast = row(f, "toast", gap=12, pad=[10, 14, 10, 14], fill="fg", radius=10)
    Q.put(toast, w + 380, H - 80)
    icon(toast, "bookmark", 16, "bg")
    text(toast, "Numbers 25:11 kept on the Shelf", "smallStrong", "bg")
    text(toast, "Put in a folder…", "smallStrong", "accentSoft")
    text(toast, "Undo", "smallStrong", "accentSoft")

    f = Q.win(r, PG, "S2 · The second step: a folder",
              "Put in a folder… opens a small picker: the folders you used last, a search, New folder. Choosing one "
              "moves the verse off the Shelf into it. Pressing K twice does the same.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13, sel=(11, 0, 999))
    pk = col(f, "folder picker", gap=4, pad=[10, 10, 10, 10], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pk, w + 420, H - 380, 320)
    shadow(pk, 8, 28, "#00000033")
    P.field(pk, "Find or name a folder", None, icon_name="search", height=32)
    text(pk, "  USED LAST", "label", "muted")
    for t, on in (("Phinehas", True), ("Covenant of peace", False), ("Zeal", False)):
        it = row(pk, f"folder/{t}", gap=8, pad=[7, 8, 7, 8], radius=8, fill="accentSoft" if on else None, W="fill")
        icon(it, "folder", 16, "accent" if on else "muted")
        text(it, t, "smallStrong" if on else "body", W="fill")
    P.divider(pk)
    it = row(pk, "new", gap=8, pad=[7, 8, 7, 8], W="fill")
    icon(it, "plus", 16, "accent")
    text(it, "New folder", "smallStrong", "accent")

    r = row(cv, "row 2", gap=64, align="min")
    f = Q.win(r, PG, "S3 · The library drawer",
              "The Notebook button opens one drawer: pages and folders above (a folder holds pages and kept things "
              "together), the Shelf below (kept, not yet filed, newest first). Drag from the Shelf onto a folder to "
              "file it. No Inbox and no Questions list (decided in the minimize rounds).")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    drawer(f, w)
    b = M.pane(f, w + 290, TB, 560, H - TB, ["Phinehas"], "Phinehas", side="left")
    text(b, "Phinehas", "title")
    para(b, "Your page’s text sits here.", "body", "muted")
    B.desk_reader(f, w + 850, TB, W - w - 850, H - TB, first=10, last=13)

    f = Q.win(r, PG, "S4 · A folder opened",
              "A folder opens as a page of cards: each kept thing as itself (a verse with its text, a word with its "
              "entry line, a page, a document). Open all as tabs brings the whole folder back to the desk; closing "
              "those tabs never takes anything out of the folder.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    drawer(f, w)
    pg = col(f, "folder page", gap=12, pad=[22, 28, 22, 28], fill="surface", W="fixed", H="fixed")
    Q.put(pg, w + 290, TB, W - w - 290, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "folder", 22, "accent")
    text(hd, "Phinehas", "title", W="fill")
    P.button(hd, "Open all as tabs", "secondary", size="sm")
    text(pg, "5 things · kept 9 Nov – 11 Nov", "caption", "muted")
    grid = row(pg, "cards", gap=12, W="fill", wrap=True, align="min")

    def card(title, kind, body_, ic, serif=False):
        cd = col(grid, f"card/{title}", gap=6, pad=[12, 14, 12, 14], fill="bg", radius=12, stroke="line", sw=1,
                 W="fixed")
        Q.put(cd, 0, 0, 340)
        h_ = row(cd, "h", gap=8, W="fill")
        icon(h_, ic, 16, "accent")
        text(h_, title, "smallStrong", W="fill")
        text(h_, kind, "caption", "muted")
        para(cd, body_, "readSmall" if serif else "small", "fg" if serif else "muted")

    card("Numbers 25:11", "verse", verse("num25", 11), "book", True)
    card("Psalms 106:30", "verse", verse("ps106", 30), "book", True)
    lx = C["lexicon"]["H7065"].splitlines()
    card("H7065", "word", lx[1], "word")
    card("Phinehas", "page", "Your page.", "page")
    card("Trail from Numbers 25:11", "trail", "31 tabs · 9:14 – 10:24 · kept as a page", "trail")
    card("Phinehas.pdf", "document", "Slides made from this folder's verses.", "docs")

    r = row(cv, "row 3", gap=64, align="min")
    f = Q.win(r, PG, "S5 · Keep from anywhere: the same mark everywhere",
              "The bookmark sits in the same corner of everything that can be kept: a Concordance entry and its "
              "place lines, a tab's strip, a trail step, the word card. Filled means kept; a click on a filled one "
              "shows which folder holds it.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = frame(f, "concordance", x=w, y=TB, w=W - w, h=H - TB, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True)
    M.folder_strip(cp, ["Concordance"], "Concordance", actions=("bookmark", "minimize", "expand", "float", "close"))
    pg = col(cp, "page", gap=10, pad=[22, 28, 22, 28], W="fill", H="fill")
    e = row(pg, "entry", gap=10, pad=[12, 14, 12, 14], radius=10, fill="accentSoft", stroke="accent", sw=1, W="fill")
    text(e, "H7065", "smallStrong", "accent")
    text(e, lx[0].split(" ", 2)[1], "heading")
    text(e, lx[1], "small", W="fill")
    keep_button(e, on=True)
    for ref, key, v in (("Numbers 25:11", "num25", 11), ("Numbers 25:13", "num25", 13)):
        ln = row(pg, f"place/{ref}", gap=12, W="fill", pad=[4, 6, 4, 6])
        t = text(ln, ref, "caption", "muted", W="fixed")
        Q.put(t, 0, 0, 120)
        text(ln, verse(key, v), "small", "fg", W="fill", maxLines=1, fontFamily=F.READ)
        icon(ln, "bookmark", 15, "accent" if v == 11 else "muted")
    tip = col(f, "where kept", gap=2, pad=[8, 12, 8, 12], fill="fg", radius=8, W="hug", H="hug")
    Q.put(tip, W - 360, TB + 150)
    text(tip, "Kept in Phinehas", "smallStrong", "bg")
    text(tip, "Move to another folder · Take off the Shelf", "caption", "bg")

    f = Q.win(r, PG, "S6 · Kept is not open",
              "Finding 9413 asked why taking a tab out of a set did not close it. Here the two are separate on "
              "purpose: keeping is the library, tabs are the desk. Closing a tab never unkeeps it (it stays on the "
              "trail too); taking something out of a folder never closes its tab.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    drawer(f, w, shelf_on="Psalms 106:30")
    body = col(f, "two", gap=18, pad=[40, 40, 40, 40], W="fixed")
    Q.put(body, w + 330, TB + 40, W - w - 380)
    for title, lines in (("The library (kept)", ["Pages and folders", "The Shelf", "Lasts until you take it out"]),
                         ("The desk (open)", ["Tabs, columns, floating windows", "Minimized ones wait on the rail",
                                              "Every tab joins the trail"])):
        cd = col(body, title, gap=6, pad=[16, 18, 16, 18], fill="surface", radius=12, stroke="line", sw=1, W="fill")
        text(cd, title, "heading")
        for l_ in lines:
            text(cd, "· " + l_, "body", "muted")
    text(body, "Open all as tabs: library → desk.   Keep: desk → library.", "bodyStrong", "accent")


def checkbox(parent, on):
    b = frame(parent, "check", w=16, h=16, radius=4, fill="accent" if on else "surface", stroke="accent" if on else "line",
              sw=1.5, W="fixed", H="fixed", layout="vertical", mainAlign="center", crossAlign="center")
    if on:
        icon(b, "check", 12, "onAccent")
    return b


def picker(f, x, y, title, rows, shelf_only=False, w=330):
    """The save picker: opened by Save (or K). Folders used last, each a checkbox (a save can sit in several),
    Just the Shelf, New folder. Enter saves to the ticked folders."""
    pk = col(f, "save picker", gap=4, pad=[10, 10, 10, 10], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pk, x, y, w)
    shadow(pk, 8, 28, "#00000033")
    hd = row(pk, "head", gap=8, pad=[2, 4, 4, 4], W="fill")
    icon(hd, "bookmark", 16, "accent")
    text(hd, title, "smallStrong", W="fill")
    text(hd, "K", "caption", "muted")
    P.field(pk, "Find or name a folder", None, icon_name="search", height=32)
    for t, on, sub in rows:
        it = row(pk, f"folder/{t}", gap=8, pad=[7, 8, 7, 8], radius=8, fill="accentSoft" if on else None, W="fill")
        checkbox(it, on)
        icon(it, "folder", 16, "accent" if on else "muted")
        text(it, t, "smallStrong" if on else "body", W="fill")
        if sub:
            text(it, sub, "caption", "muted")
    P.divider(pk)
    it = row(pk, "shelf only", gap=8, pad=[7, 8, 7, 8], radius=8, W="fill", fill="accentSoft" if shelf_only else None)
    checkbox(it, shelf_only)
    icon(it, "shelf", 16, "muted")
    tc = col(it, "t", gap=0, W="fill")
    text(tc, "Just the Shelf", "body")
    text(tc, "saved, in no folder yet", "caption", "muted")
    it = row(pk, "new", gap=8, pad=[7, 8, 7, 8], W="fill")
    icon(it, "plus", 16, "accent")
    text(it, "New folder", "smallStrong", "accent")
    ft = row(pk, "foot", gap=8, pad=[6, 4, 0, 4], W="fill")
    text(ft, "Enter saves · Esc keeps it on the Shelf", "caption", "muted", W="fill")
    P.button(ft, "Save", "primary", size="sm")
    return pk


def round2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Round 2: Save opens the folders, marks in the text, and the three viewers",
                  "From the review: Save (K) opens the folder picker at once; a save can sit in several folders; the "
                  "Shelf is the bookmark manager (everything saved, filed or not); folders hold anything and nest; "
                  "opening a folder never floods the desk.")

    r = row(cv, "row 2a", gap=64, align="min")
    f = Q.win(r, "Round 2", "S7 · Save opens the picker",
              "Save on the selection bar (or K) saves and opens the picker in the same motion. The folder you used "
              "last is ticked; tick more to save into several. Just the Shelf saves it unfiled; Esc does the same, so "
              "nothing is lost by closing.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13, sel=(11, 0, 999))
    bar = row(f, "selection bar", gap=6, pad=[6, 8, 6, 8], fill="surface", radius=12, stroke="line", sw=1)
    Q.put(bar, w + 420, TB + 345)
    shadow(bar, 8, 24, "#00000026")
    for c_ in ("hlYellow", "hlGreen", "hlBlue", "hlPink"):
        frame(bar, f"color/{c_}", w=22, h=22, radius=11, fill=c_, W="fixed", H="fixed")
    sv = row(bar, "save", gap=6, pad=[6, 10, 6, 8], radius=8, fill="accentSoft", stroke="accent", sw=1)
    icon(sv, "bookmark", 16, "accent")
    text(sv, "Save", "smallStrong", "accent")
    for lab, ic in (("Note", "pen"), ("Copy", "copy")):
        b = row(bar, f"tool/{lab}", gap=6, pad=[6, 8, 6, 8])
        icon(b, ic, 16, "fg")
        text(b, lab, "smallStrong")
    picker(f, w + 420, TB + 400, "Save Numbers 25:11 to",
           [("Phinehas", True, "last used"), ("Covenant of peace", False, None), ("Zeal", False, None)])

    f = Q.win(r, "Round 2", "S8 · How saves show in the text",
              "No square at the number. A save sits in the margin beside the line it starts on: a bookmark for a "
              "whole verse, a bookmark with a short rule for a phrase (the phrase itself gets a faint underline only "
              "while you hover the mark), a small number when one line holds several saves. Hovering the margin "
              "lists them.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rx = w + 160
    B.desk_reader(f, rx, TB, W - rx - 300, H - TB, first=10, last=13)
    gut = frame(f, "save margin", x=rx - 6, y=TB + 80, w=40, h=360, W="fixed", H="fixed")
    for y_, kind in ((97, "verse"), (238, "two"), (274, "phrase")):
        m = row(f, f"mark/{kind}", gap=2)
        Q.put(m, w + 252, TB + y_ - 8)
        icon(m, "bookmark", 16, "accent", fill="accent" if kind != "phrase" else None)
        if kind == "phrase":
            frame(m, "rule", w=8, h=2, fill="accent", W="fixed", H="fixed")
        if kind == "two":
            text(m, "2", "caption", "accent")
    hv = col(f, "margin list", gap=4, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(hv, w + 300, TB + 400, 330)
    shadow(hv, 6, 20)
    text(hv, "Saved on this line", "caption", "muted")
    for t, s in (("Numbers 25:12 · whole verse", "in Phinehas, Covenant of peace"),
                 ("“my covenant of peace” · phrase", "on the Shelf")):
        it = row(hv, f"s/{t}", gap=8, W="fill", pad=[4, 4, 4, 4])
        icon(it, "bookmark", 15, "accent", fill="accent")
        tc = col(it, "t", gap=0, W="fill")
        text(tc, t, "smallStrong")
        text(tc, s, "caption", "muted")
    side = col(f, "legend", gap=10, pad=[18, 18, 18, 18], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(side, W - 280, TB + 40, 250)
    text(side, "In the margin", "heading")
    for ic_fill, lab in ((True, "a whole verse saved"), (False, "a phrase saved"), (True, "2  several on one line")):
        lr = row(side, f"legend/{lab}", gap=8)
        icon(lr, "bookmark", 16, "accent", fill="accent" if ic_fill else None)
        text(lr, lab, "small")
    para(side, "Highlights stay the colors on the words; saves never color text, so the two never fight.", "caption",
         "muted")

    r = row(cv, "row 2b", gap=64, align="min")
    f = Q.win(r, "Round 2", "S9 · What + adds",
              "The + beside a folder (or Pages) says exactly what it can add: a new page or folder inside, anything "
              "already saved (from the Shelf), what is open now, or a verse by its reference.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    drawer(f, w)
    mn = col(f, "plus menu", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(mn, w + 260, TB + 160, 320)
    shadow(mn, 8, 28, "#00000033")
    text(mn, "  ADD TO PHINEHAS", "label", "muted")
    for lab, ic, sub in (("New page", "page", "a page inside this folder"),
                         ("New folder", "folder", "a folder inside this one"),
                         ("From the Shelf…", "shelf", "anything you saved"),
                         ("What is open now", "layers", "the tab in front: Numbers 25"),
                         ("A verse or passage…", "book", "type a reference")):
        it = row(mn, f"add/{lab}", gap=10, pad=[7, 8, 7, 8], radius=8, W="fill", fill="accentSoft" if lab == "From the Shelf…" else None)
        icon(it, ic, 17, "accent")
        tc = col(it, "t", gap=0, W="fill")
        text(tc, lab, "smallStrong")
        text(tc, sub, "caption", "muted")
    B.desk_reader(f, w + 600, TB, W - w - 600, H - TB, first=10, last=13)

    f = Q.win(r, "Round 2", "S10 · A big folder: open what you choose",
              "No Open all. A folder of 120 lessons opens as a list you can scroll, filter and sort; tick the ones "
              "you want and Open 3 opens just those. A nested folder opens in place (its own page), never as tabs. "
              "More than 10 at once asks first.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    pg = col(f, "folder page", gap=10, pad=[22, 28, 22, 28], fill="surface", W="fixed", H="fixed")
    Q.put(pg, w, TB, W - w, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "folder", 22, "accent")
    text(hd, "Sunday lessons", "title", W="fill")
    P.segmented(hd, ["Cards", "List"], "List", W="hug")
    P.button(hd, "Open 3", "primary", size="sm")
    tl = row(pg, "tools", gap=8, W="fill")
    ff = P.field(tl, "Filter this folder", None, icon_name="search", height=32, W="fixed")
    S.do("node.set", {"ids": [ff], "props": {"width": 220}}, ref=False)
    P.chip(tl, "All kinds", "outline", icon_name="down")
    P.chip(tl, "Newest first", "outline", icon_name="down")
    spacer(tl)
    text(tl, "3 folders · 117 pages · 3 selected", "caption", "muted")
    for i, (t, kind, on) in enumerate((("2025", "folder · 52 things", False), ("2024", "folder · 48 things", False),
                                       ("Guest speakers", "folder · 6 things", False),
                                       ("Lesson · 9 November", "page", True), ("Lesson · 2 November", "page", True),
                                       ("Lesson · 26 October", "page", True), ("Lesson · 19 October", "page", False),
                                       ("Lesson · 12 October", "page", False), ("Lesson · 5 October", "page", False))):
        it = row(pg, f"item/{t}", gap=12, pad=[8, 10, 8, 10], radius=8, W="fill", fill="accentSoft" if on else None,
                 stroke="line", strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
        if kind == "page":
            checkbox(it, on)
        else:
            frame(it, "pad", w=16, h=16, W="fixed", H="fixed")
        icon(it, "folder" if "folder" in kind else "page", 17, "accent" if "folder" in kind else "muted")
        text(it, t, "body", W="fill")
        text(it, kind, "caption", "muted")
    text(pg, "108 more", "caption", "accent")

    r = row(cv, "row 2c", gap=64, align="min")
    f = Q.win(r, "Round 2", "S11 · One save, several folders",
              "The filled mark opens the same picker, now showing where it is saved. Tick another folder to add it "
              "there too; untick to take it out. It is one save in several places, not copies: a note written on it "
              "shows everywhere.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = frame(f, "concordance", x=w, y=TB, w=W - w, h=H - TB, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True)
    M.folder_strip(cp, ["Concordance"], "Concordance")
    pgc = col(cp, "page", gap=10, pad=[22, 28, 22, 28], W="fill", H="fill")
    lx = C["lexicon"]["H7065"].splitlines()
    e = row(pgc, "entry", gap=10, pad=[12, 14, 12, 14], radius=10, fill="accentSoft", stroke="accent", sw=1, W="fill")
    text(e, "H7065", "smallStrong", "accent")
    text(e, lx[0].split(" ", 2)[1], "heading")
    text(e, lx[1], "small", W="fill")
    sb = row(e, "saved", gap=6, pad=[6, 10, 6, 8], radius=8, fill="accentSoft", stroke="accent", sw=1)
    icon(sb, "bookmark", 16, "accent", fill="accent")
    text(sb, "Saved in 2", "smallStrong", "accent")
    picker(f, W - 420, TB + 150, "H7065 is saved in",
           [("Phinehas", True, None), ("Covenant of peace", True, None), ("Zeal", False, "add here too")])

    f = Q.win(r, "Round 2", "S12 · The Shelf: every save",
              "The Shelf is the bookmark manager: everything you saved, filed or not, newest first. Filter by kind or "
              "folder; Unfiled shows what still needs a home. A line under the title says what the Shelf is.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    pg = col(f, "shelf", gap=10, pad=[22, 28, 22, 28], fill="surface", W="fixed", H="fixed")
    Q.put(pg, w, TB, W - w, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "shelf", 22, "accent")
    text(hd, "Shelf", "title", W="fill")
    P.segmented(hd, ["Notebook", "Folders", "Shelf"], "Shelf", W="hug")
    para(pg, "Everything you saved with Save (K), wherever it is filed. Folders are where you sort it; the Shelf is "
             "where you find it again.", "small", "muted")
    tl = row(pg, "filters", gap=8, W="fill")
    ff = P.field(tl, "Find a save", None, icon_name="search", height=32, W="fixed")
    S.do("node.set", {"ids": [ff], "props": {"width": 200}}, ref=False)
    for c_ in ("All", "Unfiled · 4", "Verses", "Words", "Pages", "Searches", "Trails", "Documents"):
        P.chip(tl, c_, "selected" if c_ == "All" else "outline")
    for t, kind, where, when in (("Numbers 25:11", "verse", "Phinehas", "today 9:15"),
                                 ("H7065", "word", "Phinehas · Covenant of peace", "today 9:16"),
                                 ("Psalms 106:30", "verse", "unfiled", "today 9:22"),
                                 ("Every use: zeal", "search", "unfiled", "today 9:41"),
                                 ("Trail from Numbers 25:11", "trail", "Phinehas", "today 10:24"),
                                 ("“an everlasting priesthood” · Numbers 25:13", "phrase", "unfiled", "today 10:30"),
                                 ("Phinehas.pdf", "document", "Phinehas", "yesterday"),
                                 ("G2205", "word", "unfiled", "yesterday")):
        it = row(pg, f"save/{t}", gap=12, pad=[8, 10, 8, 10], W="fill", stroke="line", strokeBottomWeight=1,
                 strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
        icon(it, "bookmark", 16, "accent", fill="accent")
        text(it, t, "body", W="fill", maxLines=1)
        text(it, kind, "caption", "muted")
        wt = text(it, where, "caption", "muted" if where != "unfiled" else "accent", W="fixed")
        Q.put(wt, 0, 0, 200)
        text(it, when, "caption", "muted")

    r = row(cv, "row 2d", gap=64, align="min")
    f = Q.win(r, "Round 2", "S13 · Folders: the library's home",
              "Folders as a page: your folders as cards with what they hold, nested ones inside. The same tree is in "
              "the drawer for quick reach; this view is for sorting (drag cards between folders).")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    pg = col(f, "folders", gap=12, pad=[22, 28, 22, 28], fill="surface", W="fixed", H="fixed")
    Q.put(pg, w, TB, W - w, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "folder", 22, "accent")
    text(hd, "Folders", "title", W="fill")
    P.segmented(hd, ["Notebook", "Folders", "Shelf"], "Folders", W="hug")
    P.button(hd, "New folder", "secondary", icon_name="plus", size="sm")
    grid = row(pg, "cards", gap=14, W="fill", wrap=True, align="min")
    for t, n, inside in (("Phinehas", "6 things", "1 page · 2 verses · 1 word · 1 trail · 1 document"),
                         ("Covenant of peace", "4 things", "2 verses · 1 word · 1 page"),
                         ("Sunday lessons", "120 things", "3 folders · 117 pages"),
                         ("Zeal", "2 things", "1 page · 1 search")):
        cd = col(grid, f"folder/{t}", gap=6, pad=[14, 16, 14, 16], fill="bg", radius=12, stroke="line", sw=1, W="fixed")
        Q.put(cd, 0, 0, 300)
        h_ = row(cd, "h", gap=8, W="fill")
        icon(h_, "folder", 18, "accent")
        text(h_, t, "bodyStrong", W="fill")
        text(h_, n, "caption", "muted")
        text(cd, inside, "caption", "muted")

    f = Q.win(r, "Round 2", "S14 · The Notebook: your pages",
              "The Notebook view is your writing: pages and the pages inside them, most recent first, each with its "
              "first lines. A page can sit in folders too; the Notebook shows every page wherever it is filed.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    pg = col(f, "notebook", gap=10, pad=[22, 28, 22, 28], fill="surface", W="fixed", H="fixed")
    Q.put(pg, w, TB, W - w, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "notebook", 22, "accent")
    text(hd, "Notebook", "title", W="fill")
    P.segmented(hd, ["Notebook", "Folders", "Shelf"], "Notebook", W="hug")
    P.button(hd, "New page", "primary", icon_name="plus", size="sm")
    for t, depth, sub, where in (("Phinehas", 0, "edited today · 2 pages inside", "in Phinehas"),
                                 ("Zeal", 1, "edited today", "in Zeal"),
                                 ("Covenant", 1, "edited yesterday", ""),
                                 ("Lesson · 9 November", 0, "edited 9 Nov", "in Sunday lessons"),
                                 ("Today · Wednesday 11 November", 0, "today's page (optional)", "")):
        it = row(pg, f"page/{t}", gap=12, pad=[10, 10, 10, 10 + 22 * depth], W="fill", stroke="line",
                 strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
        icon(it, "page", 17, "muted")
        tc = col(it, "t", gap=0, W="fill")
        text(tc, t, "bodyStrong")
        text(tc, sub, "caption", "muted")
        if where:
            P.chip(it, where, "quiet", icon_name="folder")


def tree_row(parent, label, depth, ic="folder", open_=None, on=False, check=None, sub=None, name=None):
    it = row(parent, name or f"tree/{label}/{depth}", gap=7, pad=[5, 8, 5, 8 + 18 * depth], radius=8, W="fill",
             fill="accentSoft" if on else None)
    if open_ is None:
        frame(it, "pad", w=12, h=12, W="fixed", H="fixed")
    else:
        icon(it, "down" if open_ else "right", 12, "muted")
    if check is not None:
        checkbox(it, check)
    icon(it, ic, 16, "accent" if (on or check) else "muted")
    text(it, label, "smallStrong" if (on or check) else "small", W="fill", maxLines=1)
    if sub:
        text(it, sub, "caption", "muted")
    return it


def lib_head(pg, title, ic, right=None):
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, ic, 22, "accent")
    text(hd, title, "title", W="fill")
    if right:
        right(hd)
    return hd


def library_shell(f, w, on="Library", tree_on=None):
    """Round 3's one Library: a tree on the left (Unsorted, folders, pages not in a folder), its search on top."""
    M.slim_bar(f, x=w, w=W - w)
    t = col(f, "library tree", gap=2, pad=[12, 10, 12, 10], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(t, w, TB, 270, H - TB)
    sf = P.field(t, "Search the library", None, icon_name="search", height=32)
    tree_row(t, "Library home", 0, "home", on=(tree_on == "home"))
    tree_row(t, "Unsorted", 0, "inbox", sub="4", on=(tree_on == "unsorted"))
    text(t, "  FOLDERS", "label", "muted")
    tree_row(t, "Phinehas", 0, open_=True, on=(tree_on == "Phinehas"))
    tree_row(t, "Phinehas", 1, "page", sub="page")
    tree_row(t, "Covenant of peace", 0, open_=False)
    tree_row(t, "Sunday lessons", 0, open_=True, on=(tree_on == "Sunday lessons"))
    tree_row(t, "2025", 1, open_=False, sub="52")
    tree_row(t, "2024", 1, open_=False, sub="48")
    tree_row(t, "Guest speakers", 1, open_=False, sub="6")
    tree_row(t, "Zeal", 0, open_=False)
    text(t, "  PAGES IN NO FOLDER", "label", "muted")
    tree_row(t, "Today · Wednesday 11 November", 0, "page")
    tree_row(t, "Questions about the covenant", 0, "page")
    return w + 270


def round3(board):
    cv = Q.section(board, "Round 3", 3200)
    Q.sheet_title(cv, "Round 3: the library at real scale, one search, and the page editor",
                  "Dozens of folders in the picker; thirty saves on one verse; notes beside the text on the right; one "
                  "Library with one search instead of three tabs; what a page, a folder and a save each are; and the "
                  "page editor.")

    # --- S15, S16
    r = row(cv, "row 3a", gap=64, align="min")
    f = Q.win(r, "Round 3", "S15 · The picker with dozens of folders",
              "Where it is already saved sits at the top (ticked). Then the folders you used last. Then the whole tree, "
              "folders inside folders folded until opened. Typing filters the tree and shows each match's path.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, 700, H - TB, first=10, last=13)
    pk = col(f, "picker", gap=3, pad=[10, 10, 10, 10], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pk, w + 720, TB + 20, 400)
    shadow(pk, 8, 28, "#00000033")
    hd = row(pk, "h", gap=8, pad=[2, 4, 4, 4], W="fill")
    icon(hd, "bookmark", 16, "accent", fill="accent")
    text(hd, "Save Numbers 25:11 to", "smallStrong", W="fill")
    P.field(pk, "Find or name a folder", None, icon_name="search", height=32)
    text(pk, "  SAVED IN (2)", "label", "muted")
    tree_row(pk, "Phinehas", 0, check=True, name="in/1")
    tree_row(pk, "Sunday lessons › 2025 › Numbers series", 0, check=True, name="in/2")
    text(pk, "  USED LAST", "label", "muted")
    tree_row(pk, "Covenant of peace", 0, check=False, name="last/1")
    tree_row(pk, "Zeal", 0, check=False, name="last/2")
    text(pk, "  ALL FOLDERS (38)", "label", "muted")
    tree_row(pk, "Covenant of peace", 0, open_=False, check=False, name="all/1")
    tree_row(pk, "Phinehas", 0, open_=False, check=True, name="all/2")
    tree_row(pk, "Sunday lessons", 0, open_=True, check=False, name="all/3")
    tree_row(pk, "2025", 1, open_=True, check=False, name="all/4")
    tree_row(pk, "Numbers series", 2, open_=None, check=True, name="all/5")
    tree_row(pk, "Romans series", 2, open_=None, check=False, name="all/6")
    tree_row(pk, "2024", 1, open_=False, check=False, sub="12 folders", name="all/7")
    tree_row(pk, "Word studies", 0, open_=False, check=False, sub="9 folders", name="all/8")
    text(pk, "  31 more folders, scroll", "caption", "muted")
    ft = row(pk, "foot", gap=8, pad=[6, 4, 0, 4], W="fill")
    text(ft, "Saved in 2 · Enter", "caption", "muted", W="fill")
    P.button(ft, "Done", "primary", size="sm")

    f = Q.win(r, "Round 3", "S16 · Two margins: saves left, your writing right",
              "Left margin: what you saved. Right margin: your pages that refer to this verse, each its title and a "
              "first line, so your thinking sits beside the text like notes in a printed margin. Hover or click opens "
              "the page; a page referring to a phrase underlines it faintly on hover.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rx = w + 160
    B.desk_reader(f, rx, TB, 760, H - TB, first=10, last=13)
    for y_, kind in ((97, "verse"), (238, "two")):
        m = row(f, f"mark/{kind}", gap=2)
        Q.put(m, w + 168, TB + y_ - 8)
        icon(m, "bookmark", 16, "accent", fill="accent")
        if kind == "two":
            text(m, "2", "caption", "accent")
    rm = col(f, "right margin", gap=14, W="fixed")
    Q.put(rm, rx + 780, TB + 85, 300)
    for t, s, y_ in (("Phinehas", "The first line of your page…", 0),
                     ("Covenant", "The first line of your page…", 0)):
        nc = col(rm, f"note/{t}", gap=2, pad=[8, 10, 8, 10], radius=8, stroke="accentSoft", sw=1, W="fill",
                 strokeLeftWeight=3, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
        h_ = row(nc, "h", gap=6)
        icon(h_, "page", 14, "accent")
        text(h_, t, "smallStrong", "accent")
        text(nc, s, "caption", "muted", maxLines=2)
    para(rm, "These lines are your own page text, shown as written.", "caption", "muted")

    # --- S17, S18
    r = row(cv, "row 3b", gap=64, align="min")
    f = Q.win(r, "Round 3", "S17 · Thirty saves on one verse",
              "The margin shows one mark and the count. A click opens a panel grouped by folder: each folder once, how "
              "many saves it holds here, whole verse or phrase. Long groups fold; a filter finds one. Clicking a line "
              "opens that folder with the save marked.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rx = w + 160
    B.desk_reader(f, rx, TB, 760, H - TB, first=10, last=13)
    m = row(f, "mark/30", gap=2, pad=[2, 6, 2, 4], radius=999, fill="accentSoft")
    Q.put(m, w + 150, TB + 89)
    icon(m, "bookmark", 15, "accent", fill="accent")
    text(m, "30", "caption", "accent")
    pn = col(f, "saves panel", gap=4, pad=[12, 12, 12, 12], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pn, rx + 790, TB + 80, 400)
    shadow(pn, 10, 30, "#00000033")
    hd = row(pn, "h", gap=8, W="fill")
    text(hd, "Numbers 25:11 · 30 saves in 14 folders", "smallStrong", W="fill")
    P.field(pn, "Filter folders", None, icon_name="search", height=30)
    for t, n, open_ in (("Phinehas", "3 · whole verse, 2 phrases", True), ("Sunday lessons › 2025 › Numbers series", "6", False),
                        ("Covenant of peace", "2", False), ("Word studies › Zeal", "4", False),
                        ("Unsorted", "5", False)):
        tree_row(pn, t, 0, open_=open_, sub=n, name=f"g/{t}")
        if open_:
            for s in ("Whole verse", "“while he was zealous”", "“my wrath away”"):
                it = row(pn, f"s/{s}", gap=8, pad=[3, 8, 3, 46], W="fill")
                icon(it, "bookmark", 13, "accent", fill="accent" if s == "Whole verse" else None)
                text(it, s, "caption", "fg")
    text(pn, "   9 more folders", "caption", "accent")

    f = Q.win(r, "Round 3", "S18 · What is open now, with ten tabs",
              "The menu line names the tab in front and how many are open. Hovering it opens the list of open tabs, "
              "front one ticked; tick more to add several at once.")
    w = M.rail5(f, on="Notebook")
    x0 = library_shell(f, w, tree_on="Phinehas")
    mn = col(f, "plus menu", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(mn, w + 240, TB + 140, 300)
    shadow(mn, 8, 28, "#00000033")
    text(mn, "  ADD TO PHINEHAS", "label", "muted")
    for lab, ic, sub, on in (("New page", "page", "a page inside this folder", False),
                             ("New folder", "folder", "a folder inside this one", False),
                             ("From your saves…", "bookmark", "anything you saved", False),
                             ("What is open now", "layers", "Numbers 25 and 9 more", True),
                             ("A verse or passage…", "book", "type a reference", False)):
        it = row(mn, f"add/{lab}", gap=10, pad=[7, 8, 7, 8], radius=8, W="fill", fill="accentSoft" if on else None)
        icon(it, ic, 17, "accent")
        tc = col(it, "t", gap=0, W="fill")
        text(tc, lab, "smallStrong")
        text(tc, sub, "caption", "muted")
        if on:
            icon(it, "right", 14, "muted")
    sm = col(f, "open tabs", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(sm, w + 548, TB + 250, 320)
    shadow(sm, 8, 28, "#00000033")
    text(sm, "  OPEN NOW · 10", "label", "muted")
    for t, ic, on in (("Numbers 25 (in front)", "book", True), ("H7065", "word", True), ("Every use: zealous", "list", False),
                      ("Concordance", "word", False), ("Phinehas", "page", False), ("Search: “zeal of God”", "search", False),
                      ("Psalms 106", "book", False), ("BDB H7065", "lexicon", False), ("Phinehas.pdf", "docs", False),
                      ("Romans 10", "book", False)):
        it = row(sm, f"tab/{t}", gap=8, pad=[5, 8, 5, 8], radius=8, W="fill", fill="accentSoft" if on else None)
        checkbox(it, on)
        icon(it, ic, 15, "muted")
        text(it, t, "small", W="fill", maxLines=1)
    ft = row(sm, "f", gap=8, pad=[6, 4, 0, 4], W="fill")
    text(ft, "2 ticked", "caption", "muted", W="fill")
    P.button(ft, "Add 2", "primary", size="sm")

    # --- S19, S20
    r = row(cv, "row 3c", gap=64, align="min")
    f = Q.win(r, "Round 3", "S19 · How you reach a folder: click it",
              "Clicking a folder in the tree (or its card) opens it as a tab in the Library, with its path above. "
              "Cards view: folders inside first, as cards with what they hold, then pages and saves as cards.")
    w = M.rail5(f, on="Notebook")
    x0 = library_shell(f, w, tree_on="Sunday lessons")
    pg = col(f, "folder", gap=10, pad=[18, 24, 18, 24], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x0, TB, W - x0, H - TB)
    crumbs_ = row(pg, "path", gap=6)
    for i, t in enumerate(("Library", "Sunday lessons")):
        if i:
            icon(crumbs_, "right", 12, "muted")
        text(crumbs_, t, "caption", "muted" if i == 0 else "fg")
    lib_head(pg, "Sunday lessons", "folder",
             lambda hd: (P.segmented(hd, ["Cards", "List"], "Cards", W="hug"), P.button(hd, "Add", "secondary", icon_name="plus", size="sm")))
    text(pg, "3 folders · 117 pages", "caption", "muted")
    grid = row(pg, "cards", gap=12, W="fill", wrap=True, align="min")
    for t, n, inside, ic in (("2025", "52 things", "4 folders · 48 pages", "folder"),
                             ("2024", "48 things", "12 folders · 36 pages", "folder"),
                             ("Guest speakers", "6 things", "6 pages", "folder"),
                             ("Lesson · 9 November", "page", "edited 9 Nov · 3 verses, 1 word", "page"),
                             ("Lesson · 2 November", "page", "edited 2 Nov · 5 verses", "page"),
                             ("Lesson · 26 October", "page", "edited 26 Oct · 2 verses, 1 trail", "page")):
        cd = col(grid, f"card/{t}", gap=6, pad=[14, 16, 14, 16], fill="bg" if ic == "folder" else "surface",
                 radius=12, stroke="line", sw=1, W="fixed")
        Q.put(cd, 0, 0, 255)
        h_ = row(cd, "h", gap=8, W="fill")
        icon(h_, ic, 18, "accent")
        text(h_, t, "bodyStrong", W="fill", maxLines=1)
        text(cd, f"{n} · {inside}" if ic == "folder" else inside, "caption", "muted")
    text(pg, "111 more pages · List view sorts and filters them", "caption", "accent")

    f = Q.win(r, "Round 3", "S20 · Four pieces, one library",
              "What each piece is, so none overlaps another. The Shelf as a separate place goes: what it held (saves "
              "in no folder) is Unsorted, and finding anything is the Library's one search.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    body = row(f, "pieces", gap=20, pad=[40, 40, 40, 40], W="fixed", align="min", wrap=True)
    Q.put(body, w, TB + 20, W - w)
    for t, ic, what, holds, not_ in (
            ("Page", "page", "Something you write.", "Your text and blocks: verses, words, questions, tables; pages "
             "inside it, which are parts of the same writing (sections, chapters).", "Not a place to store saves."),
            ("Folder", "folder", "A place you sort into.", "Pages, saves and folders. It has a name and, if you like, a "
             "line saying what it is for; no writing of its own.", "Not something you write in."),
            ("Save", "bookmark", "A pointer to a thing you want back.", "One verse, phrase, word, search, trail, "
             "document or page. It can sit in several folders, or in none (Unsorted).", "Not a copy: the thing stays "
             "where it is."),
            ("Library", "notebook", "Where all of it lives.", "One tree (Unsorted, folders, pages in no folder) and one "
             "search over every page's text, every folder and every save.", "Replaces the Notebook / Folders / "
             "Shelf tabs.")):
        cd = col(body, f"piece/{t}", gap=8, pad=[18, 20, 18, 20], fill="surface", radius=14, stroke="line", sw=1,
                 W="fixed")
        Q.put(cd, 0, 0, 290)
        h_ = row(cd, "h", gap=10)
        icon(h_, ic, 22, "accent")
        text(h_, t, "title")
        text(cd, what, "bodyStrong")
        para(cd, holds, "small", "fg")
        para(cd, not_, "caption", "muted")

    # --- S21, S22
    r = row(cv, "row 3d", gap=64, align="min")
    f = Q.win(r, "Round 3", "S21 · One search over the whole library",
              "Typing in the Library's search finds pages by their text, folders by name, and saves by what they point "
              "to, each with where it lives. It answers “where did I put that?”")
    w = M.rail5(f, on="Notebook")
    x0 = library_shell(f, w)
    pg = col(f, "results", gap=8, pad=[18, 24, 18, 24], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x0, TB, W - x0, H - TB)
    sf = P.field(pg, "covenant", "covenant", icon_name="search", height=36)
    text(pg, "12 found · pages 5 · saves 4 · folders 1 · documents 2", "caption", "muted")
    for kind, items in (("PAGES", (("Covenant", "…compare the covenant of peace with…", "Phinehas"),
                                   ("Lesson · 9 November", "…the covenant made at…", "Sunday lessons › 2025"))),
                        ("SAVES", (("Numbers 25:12", "verse", "Phinehas · Covenant of peace"),
                                   ("“an everlasting priesthood”", "phrase · Numbers 25:13", "Unsorted"))),
                        ("FOLDERS", (("Covenant of peace", "4 things", "Library"),))):
        text(pg, kind, "label", "muted")
        for t, s, where in items:
            it = row(pg, f"res/{t}", gap=12, pad=[8, 10, 8, 10], W="fill", stroke="line", strokeBottomWeight=1,
                     strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
            icon(it, {"PAGES": "page", "SAVES": "bookmark", "FOLDERS": "folder"}[kind], 16, "accent")
            tc = col(it, "t", gap=0, W="fill")
            text(tc, t, "bodyStrong")
            text(tc, s, "caption", "muted")
            P.chip(it, where, "quiet", icon_name="folder")

    f = Q.win(r, "Round 3", "S22 · Cards: click, drag, and their menu",
              "A card opens on click. Dragged, it lifts and every folder in the tree and on the page becomes a target; "
              "dropping moves it, Alt-drop adds it to a second folder. Its ⋯ menu: Open, Open in a new tab, Add to "
              "another folder, Move, Rename, Remove from this folder.")
    w = M.rail5(f, on="Notebook")
    x0 = library_shell(f, w, tree_on="Phinehas")
    pg = col(f, "folder", gap=10, pad=[18, 24, 18, 24], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x0, TB, W - x0, H - TB)
    lib_head(pg, "Phinehas", "folder")
    grid = row(pg, "cards", gap=12, W="fill", wrap=True, align="min")
    for t, ic, s, state in (("Numbers 25:11", "book", "verse", "menu"), ("H7065", "word", "word", "normal"),
                            ("Phinehas", "page", "page · 2 pages inside", "normal"),
                            ("Trail from Numbers 25:11", "trail", "trail · 31 tabs", "normal")):
        cd = col(grid, f"card/{t}", gap=6, pad=[14, 16, 14, 16], fill="surface", radius=12,
                 stroke="accent" if state == "menu" else "line", sw=1.5 if state == "menu" else 1, W="fixed")
        Q.put(cd, 0, 0, 255)
        h_ = row(cd, "h", gap=8, W="fill")
        icon(h_, ic, 18, "accent")
        text(h_, t, "bodyStrong", W="fill")
        icon(h_, "more", 16, "muted")
        text(cd, s, "caption", "muted")
    mn = col(f, "card menu", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(mn, x0 + 200, TB + 175, 250)
    shadow(mn, 8, 28, "#00000033")
    for lab in ("Open", "Open in a new tab", "Add to another folder…", "Move to…", "Rename", "Remove from Phinehas"):
        it = row(mn, f"m/{lab}", gap=8, pad=[6, 8, 6, 8], radius=8, W="fill")
        text(it, lab, "small", "fg" if not lab.startswith("Remove") else "warn")
    ghost = row(f, "dragging", gap=8, pad=[10, 14, 10, 12], fill="surface", radius=12, stroke="accent", sw=1.5)
    Q.put(ghost, w + 150, TB + 330)
    shadow(ghost, 14, 30, "#00000040")
    icon(ghost, "word", 16, "accent")
    text(ghost, "H7065 → Covenant of peace", "smallStrong")
    hl = frame(f, "drop target", x=w + 6, y=TB + 181, w=258, h=30, radius=8, stroke="accent", sw=2, dashes=[5, 4],
               W="fixed", H="fixed")

    # --- S23, S24
    r = row(cv, "row 3e", gap=64, align="min")
    f = Q.win(r, "Round 3", "S23 · The page editor, and New page",
              "New page opens a blank page as a tab: a title, “in Unsorted” (click to choose a folder), and the cursor. "
              "Writing works like Notion: / opens the blocks, each line has a handle to drag and a + to insert. App "
              "blocks are first-class: a verse block shows the verse verbatim from the database, a word block its "
              "entry, a question a callout. No toolbar across the top; selecting text shows a small bar.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    ed = frame(f, "editor", x=w, y=TB, w=W - w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True)
    M.folder_strip(ed, ["Untitled", "Phinehas"], "Untitled")
    pg = col(ed, "page", gap=10, pad=[36, 0, 36, 260], W="fill", H="fill")
    loc = row(pg, "where", gap=6)
    icon(loc, "inbox", 14, "muted")
    text(loc, "in Unsorted", "caption", "muted")
    icon(loc, "down", 12, "muted")
    text(pg, "Zeal in Numbers 25", "display")
    ln = row(pg, "line", gap=8)
    text(ln, "⋮⋮", "caption", "muted")
    icon(ln, "plus", 14, "muted")
    text(ln, "Where the word first appears:", "body")
    vb = col(pg, "verse block", gap=6, pad=[12, 16, 12, 16], radius=10, fill="bg", stroke="line", sw=1, W="fixed")
    Q.put(vb, 0, 0, 640)
    h_ = row(vb, "h", gap=8)
    icon(h_, "book", 15, "accent")
    text(h_, "Numbers 25:11", "smallStrong", "accent")
    para(vb, verse("num25", 11), "readSmall")
    ln = row(pg, "slash", gap=6)
    text(ln, "/", "body", "accent")
    sl = col(pg, "slash menu", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(sl, 0, 0, 300)
    shadow(sl, 8, 28, "#00000033")
    text(sl, "  BLOCKS", "label", "muted")
    for lab, ic, sub in (("Text", "type", "plain writing"), ("Heading", "type", "three sizes"),
                         ("Verse or passage", "book", "verbatim, with its reference"),
                         ("Word", "word", "a Strong's entry"), ("Question", "question", "a callout you can answer"),
                         ("Page", "page", "a page inside this one"), ("Table", "list", "rows and columns"),
                         ("Saved thing", "bookmark", "anything you saved")):
        it = row(sl, f"b/{lab}", gap=10, pad=[5, 8, 5, 8], radius=8, W="fill", fill="accentSoft" if lab == "Verse or passage" else None)
        icon(it, ic, 15, "accent")
        text(it, lab, "smallStrong", W="fill")
        text(it, sub, "caption", "muted")

    f = Q.win(r, "Round 3", "S24 · The Library in a narrow column",
              "Docked in a 420px column beside the reader: the tree folds into a path at the top (tap to open it as a "
              "list), cards become one column, the view switch becomes icons.", w=1100)
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=1100 - w)
    B.desk_reader(f, w, TB, 1100 - w - 420, H - TB, first=10, last=13)
    lb = frame(f, "library column", x=1100 - 420, y=TB, w=420, h=H - TB, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    M.folder_strip(lb, ["Library"], "Library", actions=("minimize", "expand", "close"))
    pg = col(lb, "page", gap=10, pad=[14, 16, 14, 16], W="fill", H="fill")
    P.field(pg, "Search the library", None, icon_name="search", height=32)
    pth = row(pg, "path", gap=6, pad=[6, 10, 6, 10], radius=8, fill="sunken", W="fill")
    icon(pth, "folder", 15, "accent")
    text(pth, "Library › Phinehas", "smallStrong", W="fill")
    icon(pth, "down", 13, "muted")
    sw_ = row(pg, "switch", gap=4)
    for ic_, on in (("layers", True), ("list", False)):
        b = frame(sw_, f"v/{ic_}", w=30, h=28, radius=6, fill="accentSoft" if on else None, W="fixed", H="fixed",
                  layout="vertical", mainAlign="center", crossAlign="center")
        icon(b, ic_, 15, "accent" if on else "muted")
    for t, ic, s in (("Numbers 25:11", "book", "verse"), ("H7065", "word", "word"),
                     ("Phinehas", "page", "page · 2 inside"), ("Trail from Numbers 25:11", "trail", "trail")):
        cd = row(pg, f"card/{t}", gap=10, pad=[10, 12, 10, 12], fill="bg", radius=10, stroke="line", sw=1, W="fill")
        icon(cd, ic, 16, "accent")
        text(cd, t, "bodyStrong", W="fill")
        text(cd, s, "caption", "muted")


def main():
    F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    round2(board)
    round3(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "library.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "library.figcraft"
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
    tmp = build / "library-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window\W+(S\d+)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
