"""The Notebook and the Shelf as one library, and what keeping (a bookmark) means. Nothing is built from this until the
person accepts it. Scripture shown comes from design/content.json (generated from the database).

    python design/features/library/library.py
"""
import json
import re
import shutil
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


def cut(key, v, i, j):
    """A phrase cut from the database's verse by word position (words i up to j), trailing punctuation dropped."""
    ws = verse(key, v).split()
    assert 0 <= i < j <= len(ws), (key, v, i, j)
    p = " ".join(ws[i:j]).rstrip(",.;:!?")
    assert p in verse(key, v)
    return p


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
        node("Sitting from Numbers 25:11", "trail", 1, kind="sitting")
        node("Phinehas.pdf", "docs", 1, kind="document")
    node("Phinehas echoes", "folder")
    node("Zeal", "page")
    node("Today · Wednesday 11 November", "page", muted=True, kind="optional")
    hd = row(d, "shelf head", gap=6, W="fill", pad=[12, 4, 2, 4])
    text(hd, "THE SHELF · SAVED, NOT YET FILED", "label", "muted", W="fill")
    for label, ic, kind in (("Psalms 106:30", "book", "verse"), ("Every use: zeal", "list", "search"),
                            ("G2205", "word", "word"), ("Malachi 2:5", "book", "verse")):
        node(label, ic, on=(label == shelf_on), kind=kind)
    return d


def save_button(parent, on=False):
    b = row(parent, "save", gap=6, pad=[6, 10, 6, 8], radius=8, fill="accentSoft" if on else "surface",
            stroke="accent" if on else "line", sw=1)
    icon(b, "bookmark", 16, "accent")
    text(b, "Saved" if on else "Save", "smallStrong", "accent" if on else "fg")
    return b


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "The library: pages, folders and saving",
                  "One idea for what a bookmark is. To save something is one step (the bookmark, or K) on anything you "
                  "can open: a verse, a word, a Concordance entry, a search, a page, a document, a sitting. Saved things "
                  "land on the Shelf; putting one in a folder is the optional second step. A folder holds pages and "
                  "saved things alike, and is today's Shelf set under a new name (same file, so nothing moves).")

    r = row(cv, "row 1", gap=64, align="min")
    f = Q.win(r, PG, "S1 · Save a verse: one step",
              "Select a verse; Save is on the selection bar (or press K). It lands on the Shelf at once. The toast "
              "offers the second step, a folder, and Undo. A saved verse shows a ribbon at its number.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13, sel=(11, 0, 999))
    bar = row(f, "selection bar", gap=6, pad=[6, 8, 6, 8], fill="surface", radius=12, stroke="line", sw=1)
    Q.put(bar, w + 420, TB + 345)
    shadow(bar, 8, 24, "#00000026")
    for c_ in ("hlYellow", "hlGreen", "hlBlue", "hlPink"):
        frame(bar, f"color/{c_}", w=22, h=22, radius=11, fill=c_, W="fixed", H="fixed")
    save_button(bar, on=True)
    for lab, ic in (("Note", "pen"), ("Folder", "folder"), ("Copy", "copy")):
        b = row(bar, f"tool/{lab}", gap=6, pad=[6, 8, 6, 8])
        icon(b, ic, 16, "fg")
        text(b, lab, "smallStrong")
    rib = frame(f, "ribbon", x=w + 752, y=TB + 84, w=10, h=8, fill="accent", W="fixed", H="fixed")
    toast = row(f, "toast", gap=12, pad=[10, 14, 10, 14], fill="fg", radius=10)
    Q.put(toast, w + 380, H - 80)
    icon(toast, "bookmark", 16, "bg")
    text(toast, "Numbers 25:11 saved on the Shelf", "smallStrong", "bg")
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
    for t, on in (("Phinehas", True), ("Phinehas echoes", False), ("Zeal", False)):
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
    card("Sitting from Numbers 25:11", "trail", "31 tabs · 9:14 – 10:24 · kept as a page", "trail")
    card("Phinehas.pdf", "document", "Slides made from this folder's verses.", "docs")

    r = row(cv, "row 3", gap=64, align="min")
    f = Q.win(r, PG, "S5 · Save from anywhere: the same mark everywhere",
              "The bookmark sits in the same corner of everything that can be saved: a Concordance entry and its "
              "place lines, a tab's strip, a trail step, the word card. Filled means saved; a click on a filled one "
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
    save_button(e, on=True)
    for ref, key, v in (("Numbers 25:11", "num25", 11), ("Numbers 25:13", "num25", 13)):
        ln = row(pg, f"place/{ref}", gap=12, W="fill", pad=[4, 6, 4, 6])
        t = text(ln, ref, "caption", "muted", W="fixed")
        Q.put(t, 0, 0, 120)
        text(ln, verse(key, v), "small", "fg", W="fill", maxLines=1, fontFamily=F.READ)
        icon(ln, "bookmark", 15, "accent" if v == 11 else "muted")
    tip = col(f, "where kept", gap=2, pad=[8, 12, 8, 12], fill="fg", radius=8, W="hug", H="hug")
    Q.put(tip, W - 360, TB + 150)
    text(tip, "Saved in Phinehas · click to change", "smallStrong", "bg")

    f = Q.win(r, PG, "S6 · Saved is not open",
              "Finding 9413 asked why taking a tab out of a set did not close it. Here the two are separate on "
              "purpose: saving is the library, tabs are the desk. Closing a tab never unsaves it (it stays on the "
              "trail too); taking something out of a folder never closes its tab.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    x = side_list(f, w)
    body = col(f, "two", gap=18, pad=[40, 40, 40, 40], W="fixed")
    Q.put(body, x + 60, TB + 40, W - x - 120)
    for title, lines in (("The library (saved)", ["Pinned, folders and pages", "The Shelf", "Lasts until you take it out"]),
                         ("The desk (open)", ["Tabs, columns, floating windows", "Minimized ones wait on the rail",
                                              "Every tab joins the trail"])):
        cd = col(body, title, gap=6, pad=[16, 18, 16, 18], fill="surface", radius=12, stroke="line", sw=1, W="fill")
        text(cd, title, "heading")
        for l_ in lines:
            text(cd, "· " + l_, "body", "muted")
    text(body, "Open all as tabs: library → desk.   Save: desk → library.", "bodyStrong", "accent")


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
    text(ft, "Enter saves · Esc leaves it on the Shelf", "caption", "muted", W="fill")
    P.button(ft, "Save", "primary", size="sm")
    return pk


def round2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Round 2: Save opens the folder picker, saves in the text, and big folders",
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
           [("Phinehas", True, "last used"), ("Phinehas echoes", False, None), ("Zeal", False, None)])

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
    phrase = cut("num25", 12, 7, 11)  # the saved phrase is cut from the database's verse by word position
    for t, s in (("Numbers 25:12 · whole verse", "in Phinehas, Phinehas echoes"),
                 (f"“{phrase}” · phrase", "on the Shelf")):
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
              "The + beside a folder row (it shows under the pointer) says exactly what it can add: a new page or folder inside, anything "
              "already saved (from the Shelf), what is open now, or a verse by its reference.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    x = side_list(f, w, hover="Phinehas")
    mn = col(f, "plus menu", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(mn, x + 10, TB + 250, 320)
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
    B.desk_reader(f, x + 350, TB, W - x - 350, H - TB, first=10, last=13)

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
    text(tl, "All kinds · newest first", "caption", "accent")
    icon(tl, "down", 12, "accent")
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
           [("Phinehas", True, None), ("Phinehas echoes", True, None), ("Zeal", False, "add here too")])

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
    for c_ in ("All", "Unfiled · 4", "Verses", "Words", "Pages", "Searches", "Sittings", "Documents"):
        P.chip(tl, c_, "selected" if c_ == "All" else "outline")
    for t, kind, where, when in (("Numbers 25:11", "verse", "Phinehas", "today 9:15"),
                                 ("H7065", "word", "Phinehas · Phinehas echoes", "today 9:16"),
                                 ("Psalms 106:30", "verse", "unfiled", "today 9:22"),
                                 ("Every use: zeal", "search", "unfiled", "today 9:41"),
                                 ("Sitting from Numbers 25:11", "trail", "Phinehas", "today 10:24"),
                                 (f"“{cut('num25', 13, 14, 17)}” · Numbers 25:13", "phrase", "unfiled", "today 10:30"),
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
    f = Q.win(r, "Round 2", "S13 · Folders as cards",
              "Your folders as cards with what they hold. The same folders are in the side list for quick reach; "
              "this page is for sorting (drag cards between folders).")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, on="Phinehas")
    M.slim_bar(f, x=x, w=W - x)
    pg = col(f, "folders", gap=12, pad=[22, 28, 22, 28], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x, TB, W - x, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "folder", 22, "accent")
    text(hd, "Folders", "title", W="fill")
    P.button(hd, "New folder", "secondary", icon_name="plus", size="sm")
    grid = row(pg, "cards", gap=14, W="fill", wrap=True, align="min")
    for t, n, inside, dot_ in (("Phinehas", "56 things", "40 pages · 12 verses · 4 words", "threadA"),
                               ("Phinehas echoes", "19 things", "14 pages · 5 verses", "threadB"),
                               ("Salt", "120 things", "3 folders · 117 pages", None),
                               ("Anna", "2 things", "1 page · 1 verse", None),
                               ("Findings to sort", "31 things", "31 pages", None)):
        cd = col(grid, f"folder/{t}", gap=6, pad=[14, 16, 14, 16], fill="bg", radius=12, stroke="line", sw=1, W="fixed")
        Q.put(cd, 0, 0, 300)
        h_ = row(cd, "h", gap=8, W="fill")
        if dot_:
            frame(h_, "dot", w=10, h=10, radius=99, fill=dot_, W="fixed", H="fixed")
        else:
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


S17_PHRASES = (cut("num25", 11, 21, 25), cut("num25", 11, 13, 16))  # Numbers 25:11, by word position
S21_PHRASE = cut("num25", 13, 14, 17)  # Numbers 25:13, by word position


def round3(board):
    cv = Q.section(board, "Round 3", 3200)
    Q.sheet_title(cv, "Round 3: the library at real scale, one search, and the page editor",
                  "Dozens of folders in the picker; thirty saves on one verse; one side list and one search; what a "
                  "page, a folder and a save each are; and the page editor.")

    # --- S15, S16
    r = row(cv, "row 3a", gap=64, align="min")
    f = Q.win(r, "Round 3", "S15 · The picker with dozens of folders",
              "The folders you used last come first, ticked where the save already sits. Then the whole tree, folders "
              "inside folders folded until opened. Nine of the 38 folders are drawn (the other 29 are a scroll "
              "away). Typing filters the tree and shows each match's path.")
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
    ul = row(pk, "used last", W="fill", pad=[6, 4, 2, 4])
    text(ul, "Used last", "caption", "muted")
    tree_row(pk, "Phinehas", 0, check=True, name="last/1")
    tree_row(pk, "Phinehas echoes", 0, check=False, name="last/2")
    tree_row(pk, "Salt", 0, check=False, name="last/3")
    text(pk, "  ALL FOLDERS (38)", "label", "muted")
    tree_row(pk, "Phinehas", 0, open_=False, check=True, name="all/1")
    tree_row(pk, "Phinehas echoes", 0, open_=False, check=False, name="all/2")
    tree_row(pk, "Salt", 0, open_=False, check=False, name="all/3")
    tree_row(pk, "Sunday lessons", 0, open_=True, check=False, name="all/4")
    tree_row(pk, "2025", 1, open_=True, check=False, name="all/5")
    tree_row(pk, "Numbers series", 2, open_=None, check=True, name="all/6")
    tree_row(pk, "Romans series", 2, open_=None, check=False, name="all/7")
    tree_row(pk, "2024", 1, open_=False, check=False, sub="12 folders", name="all/8")
    tree_row(pk, "Word studies", 0, open_=False, check=False, sub="9 folders", name="all/9")
    text(pk, "  29 more folders, scroll", "caption", "muted")
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
    text(hd, "Numbers 25:11 · 30 saves in 14 folders and the Shelf", "smallStrong", W="fill", maxLines=1)
    P.field(pn, "Filter folders", None, icon_name="search", height=30)
    for t, n, open_ in (("Phinehas", "3 · whole verse, 2 phrases", True), ("Sunday lessons › 2025 › Numbers series", "6", False),
                        ("Phinehas echoes", "2", False), ("Word studies › Zeal", "4", False),
                        ("The Shelf", "5", False)):
        tree_row(pn, t, 0, open_=open_, sub=n, name=f"g/{t}")
        if open_:
            for s in ("Whole verse",) + tuple(f"“{p_}”" for p_ in S17_PHRASES):
                it = row(pn, f"s/{s}", gap=8, pad=[3, 8, 3, 46], W="fill")
                icon(it, "bookmark", 13, "accent", fill="accent" if s == "Whole verse" else None)
                text(it, s, "caption", "fg")
    text(pn, "   10 more folders", "caption", "accent")

    f = Q.win(r, "Round 3", "S18 · What is open now, with ten tabs",
              "The menu line names the tab in front and how many are open. Hovering it opens the list of open tabs, "
              "front one ticked; tick more to add several at once.")
    w = M.rail5(f, on="Notebook")
    x0 = side_list(f, w, hover="Phinehas")
    M.slim_bar(f, x=x0, w=W - x0)
    mn = col(f, "plus menu", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(mn, x0 + 10, TB + 70, 300)
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
    Q.put(sm, x0 + 320, TB + 150, 320)
    shadow(sm, 8, 28, "#00000033")
    text(sm, "  OPEN NOW · 10", "label", "muted")
    for t, ic, on in (("Numbers 25 (in front)", "book", True), ("H7065", "word", True), ("Every use: zeal", "list", False),
                      ("Concordance", "word", False), ("Phinehas", "page", False), ("Search: zeal", "search", False),
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
              "Clicking a folder in the side list (or its card) opens it as a tab, with its path above. "
              "Cards view: folders inside first, as cards with what they hold, then pages and saves as cards.")
    w = M.rail5(f, on="Notebook")
    x0 = side_list(f, w, on="Salt")
    M.slim_bar(f, x=x0, w=W - x0)
    pg = col(f, "folder", gap=10, pad=[18, 24, 18, 24], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x0, TB, W - x0, H - TB)
    crumbs_ = row(pg, "path", gap=6)
    for i, t in enumerate(("Folders", "Salt")):
        if i:
            icon(crumbs_, "right", 12, "muted")
        text(crumbs_, t, "caption", "muted" if i == 0 else "fg")
    lib_head(pg, "Salt", "folder",
             lambda hd: (P.segmented(hd, ["Cards", "List"], "Cards", W="hug"), P.button(hd, "Add", "secondary", icon_name="plus", size="sm")))
    text(pg, "3 folders · 117 pages", "caption", "muted")
    grid = row(pg, "cards", gap=12, W="fill", wrap=True, align="min")
    for t, n, inside, ic in (("2025", "52 things", "4 folders · 48 pages", "folder"),
                             ("2024", "48 things", "12 folders · 36 pages", "folder"),
                             ("Guest speakers", "6 things", "6 pages", "folder"),
                             ("Lesson · 9 November", "page", "edited 9 Nov · 3 verses, 1 word", "page"),
                             ("Lesson · 2 November", "page", "edited 2 Nov · 5 verses", "page"),
                             ("Lesson · 26 October", "page", "edited 26 Oct · 2 verses, 1 sitting", "page")):
        cd = col(grid, f"card/{t}", gap=6, pad=[14, 16, 14, 16], fill="bg" if ic == "folder" else "surface",
                 radius=12, stroke="line", sw=1, W="fixed")
        Q.put(cd, 0, 0, 255)
        h_ = row(cd, "h", gap=8, W="fill")
        icon(h_, ic, 18, "accent")
        text(h_, t, "bodyStrong", W="fill", maxLines=1)
        text(cd, f"{n} · {inside}" if ic == "folder" else inside, "caption", "muted")
    text(pg, "111 more pages · List view sorts and filters them", "caption", "accent")

    f = Q.win(r, "Round 3", "S20 · Five pieces, one library",
              "What each piece is, so none overlaps another. Saves in no folder are the Shelf, a place in the "
              "one list and not a separate tab; margin notes are kept in the Bible's order, never filed; finding "
              "anything is the one search. (The name Shelf is an inference, L-5.)")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    body = row(f, "pieces", gap=16, pad=[30, 30, 30, 30], W="fixed", align="min")
    Q.put(body, w, TB + 20, W - w)
    for t, ic, what, holds, not_ in (
            ("Page", "page", "Something you write.", "Your text and blocks: verses, words, questions, tables; pages "
             "inside it, which are parts of the same writing (sections, chapters).", "Not a place to store saves."),
            ("Folder", "folder", "A place you sort into.", "Pages, saves and folders. It has a name and, if you like, a "
             "line saying what it is for, and a color that underlines its saves on the text; no writing of its own.",
             "Not something you write in."),
            ("Save", "bookmark", "A pointer to a thing you want back.", "One verse, phrase, word, search, sitting, "
             "document or page. It can sit in several folders, or in none (the Shelf).", "Not a copy: the thing stays "
             "where it is."),
            ("Margin note", "pen", "A thought caught beside a verse.", "Plain sentences at one verse, passage or "
             "chapter. Kept in the Bible's order, never filed. It can grow into a page.",
             "Not a page: no title, no blocks."),
            ("Side list", "notebook", "Where all of it lives.", "Pinned, folders and pages, with margin notes and the "
             "Shelf folded at the foot; one search over every page's text, every folder and every save.",
             "Replaces the Notebook / Folders / Shelf tabs.")):
        cd = col(body, f"piece/{t}", gap=8, pad=[16, 16, 16, 16], fill="surface", radius=14, stroke="line", sw=1,
                 W="fixed")
        Q.put(cd, 0, 0, 236)
        h_ = row(cd, "h", gap=10)
        icon(h_, ic, 22, "accent")
        text(h_, t, "title")
        para(cd, what, "bodyStrong")
        para(cd, holds, "small", "fg")
        para(cd, not_, "caption", "muted")

    # --- S21, S22
    r = row(cv, "row 3d", gap=64, align="min")
    f = Q.win(r, "Round 3", "S21 · One search over the whole library",
              "Typing in the search finds pages by their text, folders by name, saves by what they point "
              "to, and margin notes by their words, each with where it lives. What it looks through is chosen in the "
              "Filter menu (Kind: Pages, Saves, Questions, Margin notes), not by chips; the one line under the field "
              "says what is on. It answers “where did I put that?”")
    w = M.rail5(f, on="Notebook")
    x0 = side_list(f, w)
    M.slim_bar(f, x=x0, w=W - x0)
    pg = col(f, "results", gap=8, pad=[18, 24, 18, 24], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x0, TB, W - x0, H - TB)
    sf = P.field(pg, "zeal", "zeal", icon_name="search", height=36)
    fl = row(pg, "filter line", gap=6, W="fill", pad=[2, 6, 4, 6])
    icon(fl, "list", 13, "accent")
    text(fl, "Pages, Saves, Margin notes, Folders · 6 found", "caption", "accent", W="fill", maxLines=1)
    text(fl, "Clear", "caption", "muted")
    for kind, items in (("PAGES", (("Zeal in Numbers 25", "Your own words, as you wrote them", "Phinehas"),
                                   ("Tuesday study", "Your own words, as you wrote them", "Pages"))),
                        ("SAVES", (("Numbers 25:12", "verse", "Phinehas · Phinehas echoes"),
                                   (f"“{S21_PHRASE}”", f"phrase · Numbers 25:13", "The Shelf"))),
                        ("MARGIN NOTES", (("Numbers 25:12", "Your own words, as you wrote them", "In the Bible's order"),)),
                        ("FOLDERS", (("Phinehas echoes", "19 things", "Folders"),))):
        text(pg, kind, "label", "muted")
        for t, s, where in items:
            it = row(pg, f"res/{t}", gap=12, pad=[8, 10, 8, 10], W="fill", stroke="line", strokeBottomWeight=1,
                     strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
            icon(it, {"PAGES": "page", "SAVES": "bookmark", "FOLDERS": "folder", "MARGIN NOTES": "pen"}[kind], 16,
                 "accent")
            tc = col(it, "t", gap=0, W="fill")
            text(tc, t, "bodyStrong")
            text(tc, s, "caption", "muted")
            text(it, where, "caption", "muted")
    filter_menu(f, x0 + 24, TB + 62)

    f = Q.win(r, "Round 3", "S22 · Cards: click, drag, and their menu",
              "A card opens on click. Dragged, it lifts and every folder in the side list and on the page becomes a target; "
              "dropping moves it, Alt-drop adds it to a second folder. Its three-dots menu: Open, Open in a new tab, Add to "
              "another folder, Move, Rename, Remove from this folder.")
    w = M.rail5(f, on="Notebook")
    x0 = side_list(f, w, on="Phinehas")
    M.slim_bar(f, x=x0, w=W - x0)
    pg = col(f, "folder", gap=10, pad=[18, 24, 18, 24], fill="surface", W="fixed", H="fixed")
    Q.put(pg, x0, TB, W - x0, H - TB)
    lib_head(pg, "Phinehas", "folder")
    grid = row(pg, "cards", gap=12, W="fill", wrap=True, align="min")
    for t, ic, s, state in (("Numbers 25:11", "book", "verse", "menu"), ("H7065", "word", "word", "normal"),
                            ("Phinehas", "page", "page · 2 pages inside", "normal"),
                            ("Sitting from Numbers 25:11", "trail", "sitting · 31 tabs", "normal")):
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
    text(ghost, "H7065 → Phinehas echoes", "smallStrong")
    hl = frame(f, "drop target", x=w + 6, y=TB + 181, w=258, h=30, radius=8, stroke="accent", sw=2, dashes=[5, 4],
               W="fixed", H="fixed")

    # --- S23, S24
    r = row(cv, "row 3e", gap=64, align="min")
    f = Q.win(r, "Round 3", "S23 · The page editor, and New page",
              "New page opens a blank page as a tab that takes its title as you type: the title, “loose” (in no folder; click to choose one), and the cursor. "
              "Writing works like Notion: / opens the blocks, each line has a handle to drag and a + to insert. App "
              "blocks are first-class: a verse block shows the verse verbatim from the database, a word block its "
              "entry, a question a callout. No toolbar across the top; selecting text shows a small bar.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    ed = frame(f, "editor", x=w, y=TB, w=W - w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True)
    M.folder_strip(ed, ["Zeal in Numbers 25", "Phinehas"], "Zeal in Numbers 25")
    pg = col(ed, "page", gap=10, pad=[36, 0, 36, 260], W="fill", H="fill")
    loc = row(pg, "where", gap=6)
    icon(loc, "page", 14, "muted")
    text(loc, "loose", "caption", "muted")
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
    slash_menu(pg, 0, 0, w=300)

    f = Q.win(r, "Round 3", "S24 · A folder in a narrow column",
              "Docked in a 420px column beside the reader: the side list folds into a path at the top (tap to open it as a "
              "list), cards become one column, the view switch becomes icons.", w=1100)
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=1100 - w)
    B.desk_reader(f, w, TB, 1100 - w - 420, H - TB, first=10, last=13)
    lb = frame(f, "library column", x=1100 - 420, y=TB, w=420, h=H - TB, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    M.folder_strip(lb, ["Phinehas"], "Phinehas", actions=("minimize", "expand", "close"))
    pg = col(lb, "page", gap=10, pad=[14, 16, 14, 16], W="fill", H="fill")
    P.field(pg, "Search pages", None, icon_name="search", height=32)
    pth = row(pg, "path", gap=6, pad=[6, 10, 6, 10], radius=8, fill="sunken", W="fill")
    icon(pth, "folder", 15, "accent")
    text(pth, "Phinehas", "smallStrong", W="fill")
    icon(pth, "down", 13, "muted")
    sw_ = row(pg, "switch", gap=4)
    for ic_, on in (("layers", True), ("list", False)):
        b = frame(sw_, f"v/{ic_}", w=30, h=28, radius=6, fill="accentSoft" if on else None, W="fixed", H="fixed",
                  layout="vertical", mainAlign="center", crossAlign="center")
        icon(b, ic_, 15, "accent" if on else "muted")
    for t, ic, s in (("Numbers 25:11", "book", "verse"), ("H7065", "word", "word"),
                     ("Phinehas", "page", "page · 2 inside"), ("Sitting from Numbers 25:11", "trail", "sitting")):
        cd = row(pg, f"card/{t}", gap=10, pad=[10, 12, 10, 12], fill="bg", radius=10, stroke="line", sw=1, W="fill")
        icon(cd, ic, 16, "accent")
        text(cd, t, "bodyStrong", W="fill")
        text(cd, s, "caption", "muted")


def side_row(parent, label, depth=0, ic="page", open_=None, on=False, hover=False, sel=None, dot=None, sub=None):
    """A row of the Notebook's side list, Notion-style: the three dots and + show only on the row under the pointer."""
    it = row(parent, f"side/{label}/{depth}", gap=6, pad=[4, 6, 4, 6 + 16 * depth], radius=6, W="fill",
             fill="accentSoft" if (on or sel) else ("sunken" if hover else None))
    if open_ is None:
        frame(it, "pad", w=12, h=12, W="fixed", H="fixed")
    else:
        icon(it, "down" if open_ else "right", 12, "muted")
    if sel is not None:
        checkbox(it, sel)
    if dot:
        frame(it, "dot", w=8, h=8, radius=99, fill=dot, W="fixed", H="fixed")
    else:
        icon(it, ic, 15, "accent" if on else "muted")
    text(it, label, "smallStrong" if on else "small", W="fill", maxLines=1)
    if sub:
        text(it, sub, "caption", "muted")
    if hover:
        icon(it, "more", 14, "muted")
        icon(it, "plus", 14, "muted")
    return it


def foot_rows(t, margin="86", shelf="4"):
    """The two folded rows at the foot of the side list: margin notes (the marks folder's) and the Shelf."""
    for lab, ic, n in (("MARGIN NOTES", "pen", margin), ("THE SHELF", "shelf", shelf)):
        hd = row(t, f"foot/{lab}", gap=6, W="fill", pad=[6, 6, 6, 6])
        icon(hd, "right", 12, "muted")
        icon(hd, ic, 14, "muted")
        text(hd, lab, "label", "muted", W="fill")
        text(hd, n, "caption", "muted")


PINNED = ("SALT Bible Study Notes", "Zeal in Numbers 25")
LOOSE = (("Tuesday study", True), ("Haste study", True), ("Reading 2025", False), ("Zeal", True),
         ("Word studies index", False), ("Prayer list", False), ("Sunday plan", False))
FOUND = ("Zeal in Numbers 25", "Zeal", "Haste study", "Tuesday study", "Reading 2025", "Zeal in Psalms 106")


def side_list_body(t, hover=None, on=None, selecting=False, filt=None, today=False, many=False, trash=0,
                   label=None, search=True, salt_open=True, deleted=False):
    """What the side list holds, drawn into any column: Today (only when switched on in Settings), Pinned, Folders
    (a folder with a color shows its dot), Pages, each folding, then Margin notes and the Shelf folded at the foot.
    The sample counts are the same on every window: Pinned 2, Folders 5, Pages 75, Margin notes 86, the Shelf 4.
    many: years of study (14 folders, 40 loose pages, 214 margin notes). filt: 'week' or 'found' narrows the list to
    what the line under the search box says is on."""
    if label:
        lb = row(t, "label", W="fill", pad=[2, 6, 6, 6])
        text(lb, label, "caption", "fg")
    if search:
        top = row(t, "top", gap=6, W="fill", pad=[0, 0, 6, 0])
        P.field(top, "Search pages", "zeal" if filt == "found" else None, icon_name="search", height=30)
        icon(top, "pen", 16, "muted")
    if filt:
        # one line of plain text, no chips (marks M8); the filters are search's own (M20, M21), the Filter menu
        fl = row(t, "filter line", gap=6, W="fill", pad=[2, 6, 8, 6])
        icon(fl, "list", 13, "accent")
        text(fl, "Pages · edited this week" if filt == "week" else "Pages · 23 found of 412", "caption",
             "accent", W="fill", maxLines=1)
        text(fl, "Clear", "caption", "muted")

    def head(lab, n=None):
        hd = row(t, f"head/{lab}", gap=6, W="fill", pad=[10, 6, 3, 6])
        text(hd, lab, "label", "muted", W="fill")
        if n:
            text(hd, n, "caption", "muted")
        icon(hd, "down", 11, "muted")

    def r(lab, depth=0, page=False, sel=False, **k):
        side_row(t, lab, depth, on=(lab == on), hover=(hover is True or lab == hover),
                 sel=(sel if (selecting and page) else None), **k)

    def more(s, depth=0, color="muted"):
        mr_ = row(t, f"more/{s}", W="fill", pad=[2, 6, 2, 28 + 16 * depth])
        text(mr_, s, "caption", color)

    if filt == "week":
        head("PAGES", "4")
        for lab in ("Zeal in Numbers 25", "Tuesday study", "Haste study", "SALT Bible Study Notes: Nov 12"):
            r(lab, page=True)
        return
    if filt == "found":
        head("PAGES", "23")
        for lab in FOUND:
            r(lab, page=True)
        more("Show all 23", color="accent")
        return
    if today:
        head("TODAY")
        r("Monday, November 16", ic="pen", sub="today")
    head("PINNED", "2")
    for lab in PINNED:
        r(lab, page=True)
    head("FOLDERS", "14" if many else "5")
    r("Phinehas", ic="folder", dot="threadA", open_=False, sub="56")
    r("Phinehas echoes", ic="folder", dot="threadB", open_=False, sub="19")
    if many:
        r("Salt", ic="folder", open_=False, sub="120")
        r("Sunday lessons", ic="folder", open_=False, sub="117")
        r("Word studies", ic="folder", open_=False, sub="48")
        r("Findings to sort", ic="folder", open_=False, sub="31")
        more("8 more folders")
    else:
        r("Salt", ic="folder", open_=salt_open, sub="120")
        if salt_open:
            r("SALT Bible Study Notes: Nov 12", 1, page=True)
            r("SALT Bible Study Notes: Nov 10", 1, page=True)
            more("118 more", 1)
        r("Anna", ic="folder", open_=False, sub="2")
        r("Findings to sort", ic="folder", open_=False, sub="31")
    head("PAGES", "40" if many else ("72" if deleted else "75"))
    if deleted:  # the three chosen pages are in the Trash: 75 - 3 = 72
        for lab in [l_ for l_, c_ in LOOSE if not c_][:4]:
            r(lab, page=True)
    else:
        for lab, s_ in LOOSE[:6 if many else 4]:
            r(lab, page=True, sel=s_)
    more("Show all 40" if many else ("68 more" if deleted else "71 more"), color="accent")
    spacer(t)
    foot_rows(t, margin="214" if many else "86", shelf="4")
    if trash:
        tr = row(t, "trash", gap=6, W="fill", pad=[8, 6, 2, 6])
        icon(tr, "trash", 13, "muted")
        text(tr, "Trash", "caption", "muted", W="fill")
        text(tr, str(trash), "caption", "muted")


def side_list(f, x=None, w=270, fold=None, path_text=None, **kw):
    """The side list. x given: a column at the left of a window (x, w) and its right edge is returned. x None: drawn
    into the parent f (a row's left column, or a folded one). fold='path' (a floating window, a narrow column): the
    list is folded to a path row; fold='open': the same, tapped open."""
    if fold:
        top = row(f, "top", gap=6, W="fill")
        P.field(top, "Search pages", None, icon_name="search", height=32)
        icon(top, "pen", 16, "muted")
        pth = row(f, "path", gap=6, pad=[6, 10, 6, 10], radius=8, fill="sunken", W="fill")
        icon(pth, "folder", 15, "accent")
        text(pth, path_text, "smallStrong", W="fill", maxLines=1)
        icon(pth, "down", 13, "muted")
        if fold == "open":
            lst = col(f, "open list", gap=1, pad=[6, 6, 6, 6], fill="surface", radius=10, stroke="line", sw=1, W="fill")
            side_list_body(lst, search=False, **kw)
        return None
    t = col(f, "side list", gap=1, pad=[10, 8, 10, 8], fill="sunken", W="fixed", H="fixed" if x is not None else "fill",
            stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0, clip=True)
    if x is not None:
        Q.put(t, x, TB, w, H - TB)
    else:
        Q.put(t, 0, 0, w)
    side_list_body(t, **kw)
    return None if x is None else x + w


def notion_page(f, x, w, title, full=False, hover_line=None, props=True, path="Phinehas", into=None, colw=None,
                crumbs=True):
    """A page as Notion lays it out: a centred, left-aligned column; a path (the folder it was opened from); a title
    field; properties; plain blocks. into: draw inside that column (a half, a float, a narrow column) instead of
    taking the window's right side."""
    if into is None:
        M.slim_bar(f, x=x, w=W - x)
        ed = frame(f, "page", x=x, y=TB, w=W - x, h=H - TB, fill="bg", layout="vertical", W="fixed", H="fixed", clip=True)
    else:
        ed = into
    if crumbs:
        cr = row(ed, "crumbs", gap=6, pad=[10, 16, 10, 16], W="fill")
        text(cr, f"{path}  /  {title}", "caption", "muted", W="fill", maxLines=1)
        for ic in ("check", "more"):
            icon(cr, ic, 15, "muted")
    if colw is None:
        colw = (w - 120) if full else min(720, w - 120)
    wrap = row(ed, "centre", W="fill", mainAlign="center")
    pg = col(wrap, "column", gap=6, W="fixed", pad=[28, 0, 28, 0])
    Q.put(pg, 0, 0, colw)
    text(pg, title, "display")
    if props:
        for k, v, ic in (("Folders", "Phinehas", "folder"),
                         ("Edited", "16 November, 15:33", "pen")):
            pr = row(pg, f"prop/{k}", gap=10, W="fill", pad=[2, 0, 2, 0])
            icon(pr, ic, 14, "muted")
            t_ = text(pr, k, "small", "muted")
            S.do("node.set", {"ids": [t_], "props": {"width": 110}}, ref=False)
            text(pr, v, "small")
        P.divider(pg)
    return pg, colw


def block_line(pg, s, hover=False, style="body", color="fg"):
    ln = row(pg, f"line/{s[:20]}", gap=6, W="fill")
    if hover:
        icon(ln, "plus", 14, "muted")
        icon(ln, "drag", 14, "muted")
    else:
        frame(ln, "gutter", w=34, h=14, W="fixed", H="fixed")
    text(ln, s, style, color, W="fill")
    return ln


def verse_block(parent, key, vs, label, w=None, ylt=False):
    vb = col(parent, f"verse/{label}", gap=6, pad=[10, 14, 12, 14], radius=8, fill="surface", W="fill" if w is None else "fixed")
    if w:
        S.do("node.set", {"ids": [vb], "props": {"width": w}}, ref=False)
    h_ = row(vb, "h", gap=8, W="fill")
    icon(h_, "book", 14, "accent")
    text(h_, label, "smallStrong", "accent", W="fill")
    text(h_, "KJV", "caption", "muted")
    for v in vs:
        para(vb, f"{v}  " + verse(key, v), "readSmall")
    return vb


def menu(f, x, y, title, items, w=250):
    m = col(f, f"menu/{title}", gap=1, pad=[6, 6, 6, 6], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(m, x, y, w)
    shadow(m, 8, 28, "#00000033")
    if title:
        text(m, "  " + title, "label", "muted")
    for it_ in items:
        if it_ == "-":
            P.divider(m)
            continue
        lab, ic, key = (it_ + (None,))[:3] if len(it_) == 2 else it_
        rr = row(m, f"m/{lab}", gap=10, pad=[5, 8, 5, 8], radius=6, W="fill",
                 fill="accentSoft" if key == "on" else None)
        icon(rr, ic, 15, "warn" if lab.startswith("Delete") else "muted")
        text(rr, lab, "small", "warn" if lab.startswith("Delete") else "fg", W="fill")
        if key and key != "on":
            text(rr, key, "caption", "muted")
    return m


def filter_menu(f, x, y, w=230):
    """The one Filter menu of search (the side list's and the library's): Kind opens to its four kinds."""
    m = menu(f, x, y, "Filter", [
        ("Kind", "layers", "on"), ("Folder", "folder"), ("Has a question", "question"), ("Edited", "pen"),
        "-", ("Sort: last edited", "list"), ("Sort: title A-Z", "list"),
        "-", ("Keep as a list in a page", "page")], w=w)
    menu(f, x + w + 4, y + 26, None, [("Pages", "page"), ("Saves", "bookmark"), ("Questions", "question"),
                                      ("Margin notes", "pen")], w=190)
    return m


def slash_menu(parent, x=0, y=0, w=300):
    """The / menu: one list of blocks, in the editor and wherever / is typed."""
    return menu(parent, x, y, "Blocks", [
        ("Text", "type"), ("Heading", "type", "#"), ("List", "list", "-"), ("To-do", "check", "[]"),
        ("Quote", "type", ">"), ("Divider", "more", "---"), ("Table", "layers"),
        ("Verse or passage", "book", "/verse"), ("Interlinear verse", "interlinear", "/inter"),
        ("Word", "word", "/word"), ("Question", "question", "/?"), ("Saved thing", "bookmark", "/save"),
        ("Page inside", "page", "/page")], w=w)


def half_pane(f, x, w, label):
    """One half of a window that shows two states: a small plain label on top."""
    hv = frame(f, f"half/{label}", x=x, y=TB, w=w, h=H - TB, fill="bg", layout="vertical", W="fixed", H="fixed",
               clip=True)
    lb = row(hv, "label", W="fill", pad=[8, 16, 0, 16])
    text(lb, label, "caption", "fg")
    return hv


def round4(board):
    cv = Q.section(board, "Round 4", 3200)
    Q.sheet_title(cv, "Round 4: the Notebook like Notion",
                  "From the installed build (16 November) and the findings asking for Notion (2c9c, 6e30, 6ed1, b737, "
                  "6659, d2a1, fc71): one side list with folders, menus on right-click, one filter line, and a page "
                  "that reads like a Notion page: centred, a real title, properties, no toolbar.")

    # --- S25, S26
    rr = row(cv, "row 4a", gap=64, align="min")
    f = Q.win(rr, "Round 4", "S25 · The side list, Notion-style",
              "Groups, in this order, each folding: Today (only when switched on in Settings), Pinned, Folders, Pages; "
              "then Margin notes (86) and the Shelf (4), folded at the foot. A folder with a color (what a thread was) "
              "shows its dot. A row shows its three dots and + only under the pointer; + makes a page inside it. The "
              "pen at the top is New page. Nothing else on the list.")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, hover="Salt", on="SALT Bible Study Notes: Nov 12", today=True)
    pg, _ = notion_page(f, x, W - x, "SALT Bible Study Notes: Nov 12", props=False, path="Salt")
    block_line(pg, "Loving Our Neighbors", style="title")
    verse_block(pg, "num25", [11], "Numbers 25:11")

    f = Q.win(rr, "Round 4", "S26 · Right-click a page (or its three dots)",
              "The same menu from right-click, the three dots on the row, or the three dots at the top of the open "
              "page; it opens beside the row it belongs to. Move to… opens the folder picker (S15). Delete goes to "
              "the Trash with Undo; Erase stays in the Trash.")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, hover="Haste study")
    notion_page(f, x, W - x, "Haste study", props=False, path="Pages")
    menu(f, x + 6, TB + 380, None, [
        ("Open", "page", "Enter"), ("Open in a new tab", "layers", "Ctrl+click"), ("Open beside the reader", "dock"),
        "-", ("Pin", "check"), ("Move to…", "folder", "Ctrl+Shift+P"), ("Add a page inside", "plus"),
        "-", ("Duplicate", "copy", "Ctrl+D"), ("Rename", "type", "F2"), ("Copy link", "copy"),
        "-", ("Make a document…", "docs"), "-", ("Delete", "trash", "Del")])

    # --- S27, S28
    rr = row(cv, "row 4b", gap=64, align="min")
    f = Q.win(rr, "Round 4", "S27 · One filter line instead of a form and a tab row",
              "Today the Notebook has a Filters form and a tab row: two ways to do one thing. Here: the search box "
              "and one line of plain text under it saying what is on (no chips, marks M8; Clear empties it), and the "
              "list under it shows only what the filter found: the pages edited this week. The filters are search's "
              "own, opened from the field (marks M21), the same Filter menu as S21. A page's properties are the "
              "Folders it sits in and when it was Edited; it has no Place (marks, 2026-11-12).")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, filt="week", on="Zeal in Numbers 25")
    notion_page(f, x, W - x, "Zeal in Numbers 25", props=True)
    filter_menu(f, x + 10, TB + 6)

    f = Q.win(rr, "Round 4", "S28 · The page: centred, a title field, properties, no toolbar",
              "A real title (not the first line, 9b88). Under it the page's properties as Notion shows them: "
              "Folders (the folders it sits in), Edited; click one to change it (a page has no Place, marks 2026-11-12). The column is centred, text left-aligned (6659). Text blocks "
              "are plain lines with no box (6ed1); + and the grip show only on the line under the pointer (d2a1).")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, on="Zeal in Numbers 25")
    pg, _ = notion_page(f, x, W - x, "Zeal in Numbers 25")
    block_line(pg, "Where the word first appears in this story:", hover=True)
    verse_block(pg, "num25", [11], "Numbers 25:11")
    block_line(pg, "And what is promised for it:")
    verse_block(pg, "num25", [12, 13], "Numbers 25:12–13")
    callout = row(pg, "question", gap=8, pad=[8, 12, 8, 12], radius=8, fill="accentSoft", W="fill")
    icon(callout, "question", 15, "question")
    text(callout, "How does Psalm 106 remember this?", "small", W="fill")

    # --- S29, S30
    rr = row(cv, "row 4c", gap=64, align="min")
    f = Q.win(rr, "Round 4", "S29 · Writing: / for blocks, select for formatting",
              "No bar across the top (6e30). Left: typing / on an empty line opens the blocks under it and filters as "
              "you type (/ver). Right: selecting text shows a small bar just above it: Turn into, B, I, U, Link, "
              "Highlight and ? (make it a question). Markdown shortcuts work (# heading, - list, > quote) and Ctrl+Z/Y "
              "undo in the page (bd7b).")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, on="Zeal in Numbers 25")
    M.slim_bar(f, x=x, w=W - x)
    half = (W - x) // 2
    hv = half_pane(f, x, half, "/ on an empty line")
    pg, colw = notion_page(f, x, half, "Zeal in Numbers 25", props=False, into=hv)
    block_line(pg, "Where the word first appears in this story:")
    verse_block(pg, "num25", [11], "Numbers 25:11")
    block_line(pg, "/", color="accent")
    mr = row(pg, "menu row", gap=6, W="fill", align="min")
    frame(mr, "gutter", w=34, h=14, W="fixed", H="fixed")
    slash_menu(mr, 0, 0, w=300)
    hv = half_pane(f, x + half, half, "text selected")
    S.do("node.set", {"ids": [hv], "props": {"strokeLeftWeight": 1, "strokeRightWeight": 0, "strokeTopWeight": 0,
                                              "strokeBottomWeight": 0, "stroke": F.c("line")}}, ref=False)
    pg, colw = notion_page(f, x, half, "Zeal in Numbers 25", props=False, into=hv)
    block_line(pg, "Where the word first appears in this story:")
    verse_block(pg, "num25", [11], "Numbers 25:11")
    br = row(pg, "bar row", gap=6, W="fill")
    frame(br, "gutter", w=34, h=14, W="fixed", H="fixed")
    bar = row(br, "selection bar", gap=12, pad=[6, 10, 6, 10], fill="surface", radius=8, stroke="line", sw=1)
    shadow(bar, 6, 20, "#00000033")
    tu = row(bar, "turn into", gap=4)
    text(tu, "Turn into", "smallStrong")
    icon(tu, "down", 12, "muted")
    for lab in ("B", "I", "U", "Link", "Highlight"):
        text(bar, lab, "smallStrong")
    text(bar, "?", "smallStrong", "question")
    sl_ = row(pg, "selected line", gap=6, W="fill", align="min")
    frame(sl_, "gutter", w=34, h=14, W="fixed", H="fixed")
    # Numbers 25:12 as fetched; the selected phrase is words 7-10 of it, drawn by the verse flow with no added space
    F.verses(sl_, [{"v": 12, "text": verse("num25", 12)}], style="readSmall", selected=(12, 7, 10))

    f = Q.win(rr, "Round 4", "S30 · Full width: blocks side by side",
              "Full width (from the page's three dots) uses the space: drag a block beside another to make columns, as in "
              "Notion (6659). Shrunk into a pane, columns stack again as they are today.")
    w = M.rail5(f, on="Notebook")
    pg, colw = notion_page(f, w, W - w, "Zeal in Numbers 25", full=True, props=False)
    block_line(pg, "The zeal, and what the psalm remembers:")
    cols = row(pg, "columns", gap=16, W="fill", align="min")
    verse_block(cols, "num25", [11], "Numbers 25:11", w=(colw - 16) // 2)
    verse_block(cols, "ps106", [30, 31], "Psalms 106:30–31", w=(colw - 16) // 2)
    block_line(pg, "The covenant that follows:")
    verse_block(pg, "num25", [12, 13], "Numbers 25:12–13")

    # --- S31, S32
    rr = row(cv, "row 4d", gap=64, align="min")
    f = Q.win(rr, "Round 4", "S31 · The page's three dots, and what leaves the Notebook's",
              "The page's own menu holds what belongs to one page: Full width, Small text, Pin, Move to, Copy link, "
              "Make a document, Delete. The Notebook has no menu of its own: Today's page, What it opens with, "
              "Places open in and the Quick capture key are in Settings › Notebook; links between pages are always "
              "on; templates are under New page.")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, on="Zeal in Numbers 25")
    notion_page(f, x, W - x, "Zeal in Numbers 25")
    menu(f, W - 300, TB + 40, None, [
        ("Full width", "layers", "on/off"), ("Small text", "type", "on/off"),
        "-", ("Pin", "check"), ("Move to…", "folder"), ("Copy link", "copy"), ("Make a document…", "docs"),
        "-", ("Delete", "trash")], w=260)

    f = Q.win(rr, "Round 4", "S32 · Choosing many pages, and deleting them",
              "Shift- or Ctrl-click rows (or drag down the list) to choose several; tick boxes show on page rows only. "
              "Left, choosing: a bar says how many and offers Move to…, Pin, Delete (0ade); Move to and Pin act on "
              "every page chosen. Right, after Delete: every chosen page went to the Trash with ONE toast and one "
              "Undo for all (30 seconds for several); the side list's foot shows a quiet Trash line while something "
              "waits there, 7 days (trash T6, T10).")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    half = (W - w) // 2
    x1 = side_list(f, w, w=270, selecting=True, label="choosing")
    hv = frame(f, "page A", x=x1, y=TB, w=half - 270, h=H - TB, fill="bg", layout="vertical", W="fixed", H="fixed",
               clip=True)
    notion_page(f, x1, half - 270, "Zeal in Numbers 25", props=False, into=hv, crumbs=False)
    bb = row(f, "selection bar", gap=14, pad=[8, 14, 8, 14], fill="fg", radius=10)
    Q.put(bb, x1 + 12, H - 70)
    text(bb, "3 pages chosen", "smallStrong", "bg")
    for lab in ("Move to…", "Pin", "Delete"):
        text(bb, lab, "small", "bg")
    icon(bb, "close", 14, "bg")
    x2 = side_list(f, w + half, w=270, label="after Delete", trash=3, deleted=True)
    hv = frame(f, "page B", x=x2, y=TB, w=half - 270, h=H - TB, fill="bg", layout="vertical", W="fixed", H="fixed",
               clip=True)
    notion_page(f, x2, half - 270, "Zeal in Numbers 25", props=False, into=hv, crumbs=False)
    toast = row(f, "toast", gap=12, pad=[10, 14, 10, 14], fill="fg", radius=10)
    Q.put(toast, x2 + 12, H - 70)
    text(toast, "3 pages moved to the Trash", "smallStrong", "bg")
    text(toast, "Undo", "smallStrong", "accentSoft")
    text(toast, "Trash", "smallStrong", "accentSoft")


def conditions(board):
    cv = Q.section(board, "Real conditions", 3200)
    Q.sheet_title(cv, "The real conditions: floating, among other tabs, narrow, and years of study",
                  "Round 4's Notebook (S25-S32, unreviewed) drawn where the person works: as a floating window, as one "
                  "of ten tabs, in a 420px column, and with 412 pages of which forty sit loose. They use the same "
                  "side list and page as S25 and S28. Scripture is read from "
                  "the database. These draw what round 4 already proposes; the open format questions in the README "
                  "(title field, folders, columns, saved sitting) are not decided here.")

    rr = row(cv, "row 5a", gap=64, align="min")
    # --- S33: floating
    f = Q.win(rr, "Real conditions", "S33 · Round 4 as a floating window",
              "The Notebook floats over the reader: its folder tabs stand on the window's top edge, the side list folds "
              "to a path (as in S24) and the page keeps its title, properties and plain lines. The reader's verse "
              "stays where it was; closing or minimizing the float returns to it.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=14)
    fw = frame(f, "float", x=w + 330, y=TB + 70, w=640, h=700, fill="surface", radius=12, stroke="line", sw=1,
               layout="vertical", W="fixed", H="fixed", clip=True)
    shadow(fw, 16, 44, "#00000030")
    M.folder_strip(fw, ["Zeal in Numbers 25", "Phinehas"], "Zeal in Numbers 25")
    body = col(fw, "page", gap=8, pad=[16, 28, 16, 28], W="fill", H="fill", clip=True)
    side_list(body, fold="path", path_text="Phinehas  /  Zeal in Numbers 25")
    pg, _ = notion_page(f, 0, 584, "Zeal in Numbers 25", into=body, colw=584, crumbs=False)
    block_line(pg, "Where the word first appears in this story:")
    verse_block(pg, "num25", [11], "Numbers 25:11")
    block_line(pg, "And what is promised for it:")
    verse_block(pg, "num25", [12], "Numbers 25:12")

    # --- S34: among other tabs
    f = Q.win(rr, "Real conditions", "S34 · Round 4 among other tabs (ten open)",
              "The Notebook is one of ten tabs in the reader's strip. The strip shows what fits and 3 more lists the "
              "rest (BDB H7065, Phinehas.pdf, Malachi 2); the page in front is the Notebook's, its side list at its "
              "left. A page opened from a verse returns to that verse's tab. Ten tabs change nothing the Notebook "
              "shows.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    ed = frame(f, "tabs", x=w, y=TB, w=W - w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True)
    M.folder_strip(ed, ["Numbers 25", "H7065", "Every use: zeal", "Concordance", "Notebook", "Psalms 106",
                        "Romans 10", "3 more"], "Notebook")
    body = row(ed, "body", gap=0, W="fill", H="fill", align="min")
    side_list(body, None, w=270, on="Zeal in Numbers 25")
    pgc = col(body, "page", gap=0, W="fill", H="fill", clip=True)
    pg, _ = notion_page(f, 0, W - w - 270, "Zeal in Numbers 25", into=pgc)
    block_line(pg, "Where the word first appears in this story:")
    verse_block(pg, "num25", [11], "Numbers 25:11")
    hv = col(f, "hidden tabs", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(hv, W - 300, TB + 44, 250)
    shadow(hv, 8, 28, "#00000033")
    text(hv, "  3 MORE OPEN", "label", "muted")
    for t, ic in (("BDB H7065", "lexicon"), ("Phinehas.pdf", "docs"), ("Malachi 2", "book")):
        it = row(hv, f"hidden/{t}", gap=8, pad=[5, 8, 5, 8], radius=8, W="fill")
        icon(it, ic, 15, "muted")
        text(it, t, "small", W="fill", maxLines=1)

    # --- S35, S36
    rr = row(cv, "row 5b", gap=64, align="min")
    f = Q.win(rr, "Real conditions", "S35 · Round 4 narrow (a 420px column)",
              "Docked beside the reader: the side list folds into a path (tap it to open the list, drawn open), the "
              "page keeps its title and properties, lines stay plain, verse blocks fill the width. The three dots and "
              "+ that show only on hover elsewhere are always shown here, since a touch screen has no hover.", w=1100)
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=1100 - w)
    B.desk_reader(f, w, TB, 1100 - w - 420, H - TB, first=10, last=13)
    lb = frame(f, "notebook column", x=1100 - 420, y=TB, w=420, h=H - TB, fill="surface", layout="vertical",
               W="fixed", H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0,
               strokeTopWeight=0, strokeBottomWeight=0)
    M.folder_strip(lb, ["Zeal in Numbers 25"], "Zeal in Numbers 25", actions=("minimize", "expand", "close"))
    pg = col(lb, "page", gap=8, pad=[12, 16, 12, 16], W="fill", H="fill", clip=True)
    side_list(pg, fold="open", path_text="Phinehas  /  Zeal in Numbers 25", hover=True, on="Zeal in Numbers 25",
              salt_open=False)
    pgn, _ = notion_page(f, 0, 388, "Zeal in Numbers 25", into=pg, colw=388, crumbs=False)
    block_line(pgn, "Where the word first appears:")
    verse_block(pgn, "num25", [11], "Numbers 25:11")

    f = Q.win(rr, "Real conditions", "S36 · Round 4 at years of study: 412 pages, forty loose",
              "The side list at 412 pages, drawn twice: left, before any filter (14 folders fold and show their "
              "counts; the forty loose pages show their first rows and Show all 40; 214 margin notes folded); right, "
              "with the search on: one plain line says Pages · 23 found of 412 and the list holds only those 23, "
              "its first rows and Show all 23. The list shows only the rows in view, so it opens at once. What to do "
              "about forty loose pages is the folders' question (README question 2); nothing here sorts them.")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w, w=300, many=True, today=True, label="before the filter")
    x = side_list(f, x, w=300, filt="found", on="Zeal in Numbers 25", label="with the search on")
    pg, _ = notion_page(f, x, W - x, "Zeal in Numbers 25", props=True)
    block_line(pg, "Where the word first appears in this story:")
    verse_block(pg, "num25", [11], "Numbers 25:11")
    block_line(pg, "And the psalm that remembers it:")
    verse_block(pg, "ps106", [30], "Psalms 106:30")


# windows that no longer lead (see the README's Leading design table)
DROP = ['S1', 'S2', 'S3', 'S4', 'S12', 'S14', 'S16']


def main():
    sys.path.insert(0, str(HERE.parent))
    import lead  # noqa: E402
    lead.drop(Q, DROP)
    F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    round2(board)
    round3(board)
    round4(board)
    conditions(board)
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
    # one vector PDF of the board, in the board's order (the person, 2026-11-12): sharp at any zoom, no PNGs
    pdf = HERE / f"{HERE.name}.pdf"
    subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", BOARD, "--format",
                    "pdf", "--out", str(pdf)], check=True, capture_output=True)
    shutil.rmtree(HERE / "exports", ignore_errors=True)
    print("exported", pdf.name)


if __name__ == "__main__":
    main()
