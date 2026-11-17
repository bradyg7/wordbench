"""Threads: a folder with a color. The overseer's 2026-11-16 decision: direction A leads (a thread is a folder with a
color; its places are the saves in the folder, its note is a page in it, and the folder can be shown on the text, every
verse carries the folder's color in the margin, a phrase saved in it a line under it). Directions B and C are superseded
and cut. Scripture shown comes
from design/content.json (generated from the database) through build.C; nothing is typed, and a phrase is cut from the
fetched verse by word position.

    python design/features/threads/threads.py
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE.parent / "minimize"))
sys.path.insert(0, str(HERE.parent / "library"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
import library as L  # noqa: E402
from figlib import S, c, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Threads"
PG = "Threads"

# More folder colors than the two the app has today (a folder with a color may have any color the person picks).
F.COLORS.update({
    "folderC": ("#2F8F5B", "#6FCB9A", "#000000", "folder color: green"),
    "folderD": ("#7A4FB0", "#B79AE6", "#000000", "folder color: purple"),
    "folderE": ("#1F8A9E", "#6FC6D6", "#000000", "folder color: teal"),
    "folderF": ("#C2415E", "#EE8FA5", "#000000", "folder color: rose"),
})

# Drawn sample folders: name -> (color, saves). The names are samples of the person's own, not content.
FOLDERS = {
    "Phinehas": ("threadA", 56),
    "Phinehas echoes": ("threadB", 19),
    "Zeal": ("folderC", 23),
    "Anna": ("folderD", 14),
    "Tuesday study": ("folderE", 9),
    "Reading 2025": ("folderF", 412),
}
# The references the Phinehas folder holds (from threads/phinehas.md's anchors; references only, no verse text).
PLACES = ["Exodus 6:25", "Numbers 25:7", "Numbers 25:11", "Numbers 31:6", "Joshua 22:13", "Joshua 22:30"]


# ---- scripture with underlines (up to two lines under a run of words) ------------------------------------------------------
def words_of(n):
    return B.verse("num25", n).split(" ")


def all_idx(n):
    return range(len(words_of(n)))


def phrase_idx(n, phrase):
    """The word positions of a phrase inside verse n of Numbers 25 (the phrase comes from the library's fetched list)."""
    t = B.verse("num25", n)
    assert phrase in t, phrase
    start = t[:t.index(phrase)].count(" ")
    k = phrase.count(" ") + 1
    got = " ".join(t.split(" ")[start:start + k])
    assert got.rstrip(",;:.") == phrase, (got, phrase)  # a trailing mark of the verse is part of the last word
    return range(start, start + k)


def add(marks, n, idxs, *tokens):
    d = marks.setdefault(n, {})
    for i in idxs:
        d.setdefault(i, []).extend(tokens)


def base_marks():
    """(lines, margin). A whole verse saved in a folder shows as a small mark in the left margin in the folder's color
    (Phinehas on 11 and 13, Phinehas echoes on 12); a phrase saved in one gets a line under it (a phrase of verse 11
    in Phinehas echoes' blue, a phrase of verse 13 in Phinehas' orange)."""
    m = {}
    add(m, 11, phrase_idx(11, L.S17_PHRASES[0]), "threadB")
    add(m, 13, phrase_idx(13, L.S21_PHRASE), "threadA")
    return m, {11: ["threadA"], 12: ["threadB"], 13: ["threadA"]}


def verses_marked(parent, verses, style, marks, paragraphs=(), selected=None):
    """Scripture as the reader draws it. A run of words saved in a folder is drawn as ONE piece, so its line under it is
    one continuous line (as marks M13), with up to two lines stacked. marks: {verse: {word index: [folder color
    tokens]}}. selected: (verse, first word, last word)."""
    fam, fstyle, size, lh, _, _ = F.TYPE[style]
    block = col(parent, "Scripture", gap=round(lh * 0.35), W="fill")
    flow = None
    for vi, verse in enumerate(verses):
        n = verse["v"]
        if flow is None or n in paragraphs:
            flow = frame(block, "Paragraph", layout="horizontal", wrap=True, gap=0, crossGap=0, crossAlign="baseline",
                         W="fill", H="hug")
        m = marks.get(n, {})
        num_box = row(flow, f"v{n}", gap=0, align="baseline", pad=[0, 0, 0, 0 if vi == 0 else 4])
        text(num_box, str(n) + " ", "verseNum", "accent", lineHeight=f"{lh}px", fontSize=max(11, round(size * 0.6)))
        words = verse["text"].split(" ")
        tprops = dict(fontFamily=fam, fontStyle=fstyle, fontSize=size, lineHeight=f"{lh}px", fill=c("fg"))
        wi = 0
        while wi < len(words):
            tl = tuple(m.get(wi, []))
            sel = selected and selected[0] == n and selected[1] <= wi <= selected[2]
            box_parent = num_box if wi == 0 else flow
            if sel or not tl:
                last = wi == len(words) - 1
                s_ = words[wi] + (" " if not last or vi < len(verses) - 1 else "")
                if not sel:
                    S.do("text.create", {"text": s_, "parent": box_parent, "x": 0, "y": 0, "props": tprops,
                                         "name": words[wi]}, ref=False)
                else:
                    inner = S.do("frame.create", {"name": f"w{n}.{wi}", "parent": box_parent, "props": {
                        "layout": "horizontal", "sizingH": "hug", "sizingV": "hug", "fill": c("accentSoft"),
                        "cornerRadius": 3}})
                    S.do("text.create", {"text": s_, "parent": inner, "x": 0, "y": 0, "props": tprops,
                                         "name": words[wi]}, ref=False)
                wi += 1
                continue
            e = wi
            while e + 1 < len(words) and tuple(m.get(e + 1, [])) == tl and not (
                    selected and selected[0] == n and selected[1] <= e + 1 <= selected[2]):
                e += 1
            run = " ".join(words[wi:e + 1]) + (" " if e < len(words) - 1 or vi < len(verses) - 1 else "")
            line = {"strokeTopWeight": 0, "strokeLeftWeight": 0, "strokeRightWeight": 0, "strokeBottomWeight": 3,
                    "strokeAlign": "inside"}
            holder = box_parent
            if len(tl) >= 2:
                holder = S.do("frame.create", {"name": f"run{n}.{wi}", "parent": holder, "props": {
                    "layout": "horizontal", "sizingH": "hug", "sizingV": "hug", "fill": "none", "padding": [0, 0, 5, 0],
                    "stroke": c(tl[1]), **line}})
            inner = S.do("frame.create", {"name": f"run{n}.{wi}", "parent": holder, "props": {
                "layout": "horizontal", "sizingH": "hug", "sizingV": "hug", "fill": "none", "stroke": c(tl[0]), **line}})
            S.do("text.create", {"text": run, "parent": inner, "x": 0, "y": 0, "props": tprops, "name": run.strip(" ")},
                 ref=False)
            wi = e + 1
    return block


# The line each verse starts on in a reading column, per layout (read off the exported windows), for the margin marks.
PHONE_Y0 = 151
HOVER_Y = 215
VLINE = {"desk": {10: 0, 11: 0, 12: 3, 13: 4}, "phone": {10: 0, 11: 1, 12: 7, 13: 8}, "t11": {10: 0, 11: 1, 12: 6, 13: 8}, "pane": {10: 0, 11: 0, 12: 5, 13: 6}}


def margin_marks(f, mx, y0, lh, margin, lines, size=14):
    """The save's mark in the reader's left margin beside the verse it belongs to (library S8): a bookmark in the
    folder's color; at most two colored marks stacked at a verse."""
    for n, toks in margin.items():
        for k, t in enumerate(toks[:2]):
            m = row(f, f"margin mark/{n}/{t}", gap=0)
            Q.put(m, mx, y0 + lines[n] * lh + (lh - size) // 2 + k * (size + 1))
            icon(m, "bookmark", size, t, fill=t)


def reader(f, x, y, w, h, marks, first=10, last=13, sel=None, parent_fills=False, origin=None, lay="desk", colw=None,
           left=None, win=None):
    """The reader pane. With parent_fills it sits inside an auto-layout parent and fills it (x and y are ignored).
    marks is (lines, margin) from base_marks(); origin is the pane's top-left in the window (for the margin marks)."""
    lines, margin = marks
    kw = dict(W="fill", H="fill") if parent_fills else dict(W="fixed", H="fixed")
    pad_l = 32 if left is None else left
    rd = frame(f, "reader", x=x, y=y, w=w, h=h, layout="vertical", crossAlign="center" if left is None else "min",
               pad=[32, 32, 32, pad_l], clip=True, **kw)
    cw = colw or min(680, w - 64)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": cw}}, ref=False)
    text(inner, "Numbers 25", "chapter", fontSize=30, lineHeight="40px")
    verses_marked(inner, B.vv("num25", first, last), "readDesk", lines, paragraphs=(6, 10, 14), selected=sel)
    ox, oy = origin if origin else (x, y)
    colx = ox + (pad_l if left is not None else (w - cw) // 2)
    margin_marks(win or f, colx - 24, oy + 32 + 40 + 8, 34, margin, VLINE[lay])
    return rd


# ---- small parts -------------------------------------------------------------------------------------------------------------
def swatch(parent, token, size=12):
    return frame(parent, f"swatch/{token}", w=size, h=size, radius=size // 2, fill=token, W="fixed", H="fixed")


def folder_row(parent, name, on, count=None, big=False):
    """A colored folder in a marks list: its dot, its name, its saves, its eye (shown / hidden). big: a row for a
    finger (48 px high)."""
    kw = dict(H="fixed") if big else {}
    it = row(parent, f"folder/{name}", gap=10 if big else 8, pad=[10, 6, 10, 6] if big else [5, 6, 5, 6], radius=8,
             W="fill", **kw)
    if big:
        S.do("node.set", {"ids": [it], "props": {"height": 48}}, ref=False)
    swatch(it, FOLDERS[name][0], 16 if big else 12)
    text(it, name, "body" if big else "small", "fg" if on else "muted", W="fill", maxLines=1)
    if count is not None:
        text(it, str(count), "caption", "muted")
    icon(it, "eye" if on else "eyeOff", 22 if big else 15, "fg" if on else "muted")
    return it


def shown_panel(pn, shown, big=False, title="SHOWN ON THE TEXT", head=None, search=False, counts=False,
                not_shown=None, shown_label=None):
    """The panel Shown on the text, one drawing for the small panel (T1), the sheet on a phone (T10) and the panel
    at real scale (T11): an optional head line, a search field, the colored folders each with its eye, and, when
    given, the folded parent folders under NOT SHOWN. big: rows for a finger."""
    if title:
        text(pn, title, "label" if not big else "bodyStrong", "muted" if not big else "fg")
    if head:
        hl = row(pn, "head line", gap=8, W="fill", pad=[2, 6, 8, 6])
        text(hl, head, "smallStrong", W="fill")
        text(hl, "Hide all", "small", "muted")
    if search:
        P.field(pn, "Find a folder with a color", None, icon_name="search", height=32)
    if shown_label:
        text(pn, shown_label, "label", "muted")
    for name, on in shown:
        folder_row(pn, name, on, count=FOLDERS[name][1] if counts else None, big=big)
    if not_shown:
        text(pn, not_shown[0], "label", "muted")
        for lab in not_shown[1]:
            it = row(pn, f"parent/{lab}", gap=8, pad=[5, 6, 5, 6], radius=8, W="fill")
            icon(it, "right", 12, "muted")
            icon(it, "folder", 15, "muted")
            text(it, lab, "small", "muted", W="fill")
    return pn


def legend(f, x, y, shown):
    """The small panel Shown on the text, floating over the reader."""
    lg = col(f, "shown", gap=2, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(lg, x, y, 260)
    shadow(lg, 6, 20, "#00000022")
    return shown_panel(lg, shown)


def place_card(parent, ref):
    cd = row(parent, f"save/{ref}", gap=10, pad=[8, 10, 8, 10], fill="bg", radius=8, stroke="line", sw=1, W="fill")
    icon(cd, "bookmark", 14, "accent", fill="accent")
    text(cd, ref, "smallStrong", W="fill")
    return cd


def side_list(f, w, on="Phinehas"):
    """The library's side list as library decides it (the library folder owns it): PINNED, FOLDERS, PAGES, then two
    folded rows at the foot, MARGIN NOTES and THE SHELF. A folder with a color shows its dot."""
    M.slim_bar(f, x=w, w=W - w)
    t = col(f, "side list", gap=1, pad=[10, 8, 10, 8], fill="sunken", W="fixed", H="fixed", stroke="line",
            strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0, clip=True)
    Q.put(t, w, TB, 270, H - TB)
    P.field(t, "Search the library", None, icon_name="search", height=32)

    def head(label, n=None, fold="down"):
        hd = row(t, f"head/{label}", gap=6, W="fill", pad=[10, 6, 3, 6])
        text(hd, label, "label", "muted", W="fill")
        if n:
            text(hd, n, "caption", "muted")
        icon(hd, fold, 11, "muted")

    head("PINNED", "2")
    L.side_row(t, "Zeal in Numbers 25", 0, ic="page")
    L.side_row(t, "Haste study", 0, ic="page")
    head("FOLDERS", "5")
    L.side_row(t, "Phinehas", 0, open_=True, on=(on == "Phinehas"), dot="threadA", sub="56")
    L.side_row(t, "Phinehas", 1, ic="page")
    L.side_row(t, "Phinehas echoes", 0, dot="threadB", open_=False, sub="19")
    L.side_row(t, "Salt", 0, ic="folder", open_=False, sub="7")
    L.side_row(t, "Anna", 0, dot="folderD", open_=False, sub="14")
    L.side_row(t, "Findings to sort", 0, ic="folder", open_=False, sub="31")
    head("PAGES", "75")
    for lab in ("Prayer list", "Sermon ideas", "Reading plan", "Notes on Sunday"):
        L.side_row(t, lab, 0, ic="page")
    spacer(t)
    P.divider(t)
    L.foot_rows(t, "86", "4")
    return w + 270


def folder_page(pg, places, more, compact=False, name="Phinehas", color="threadA", count="56 saves · 1 page", dense=False,
                more_strong=False):
    """A folder opened (what was the thread Phinehas): name, its color, the eye, its saves in the folder's own order,
    its note as a page in it. One drawing for the desktop window, the tab, the floating pane and the 412-save folder."""
    hd = row(pg, "head", gap=10 if not compact else 8, W="fill")
    icon(hd, "folder", 22 if not compact else 18, "accent")
    text(hd, name, "title" if not compact else "heading", W="fill")
    swatch(hd, color, 14)
    ey = row(hd, "eye", gap=6)
    icon(ey, "eye", 18, "accent")
    if not (compact or dense):
        text(ey, "Shown on the text", "smallStrong", "accent")
    text(pg, count, "caption", "muted")
    it = row(pg, "note page", gap=10, pad=[10, 12, 10, 12] if not dense else [6, 12, 6, 12], fill="surface", radius=10,
             stroke="line", sw=1, W="fill")
    icon(it, "page", 16, "accent")
    text(it, name, "bodyStrong", W="fill")
    text(it, "note page" if (compact or dense) else "the folder's note, a page in it", "caption", "muted")
    if dense:
        lst = col(pg, "saves", gap=0, W="fill")
        for ref in places:
            r_ = row(lst, f"save/{ref}", gap=8, pad=[3, 10, 3, 10], W="fill")
            icon(r_, "bookmark", 13, "accent", fill="accent")
            text(r_, ref, "small", W="fill")
    else:
        for ref in places:
            place_card(pg, ref)
    text(pg, more, "smallStrong" if more_strong else "caption", "accent" if more_strong else "muted")


# ---- the board -----------------------------------------------------------------------------------------------------------
def windows_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "T1 · A folder with a color, shown on the text",
              "The library's side list (PINNED 2, FOLDERS 5, PAGES 75, and the two folded rows MARGIN NOTES and THE "
              "SHELF) with Phinehas open. A folder with a color shows its dot in FOLDERS. With its eye on, a whole "
              "verse saved in it carries the folder's color in the margin (Phinehas at verses 11 and 13, Phinehas "
              "echoes at verse 12) and a saved phrase carries a line under it (a phrase of verse 11 in Phinehas "
              "echoes' blue, a phrase of verse 13 in Phinehas' orange). The text of a whole saved verse is never "
              "underlined or colored. The small panel Shown on the text lists the colored folders with their eyes "
              "(Anna is hidden).")
    w = M.rail5(f)
    x = side_list(f, w)
    reader(f, x, TB, W - x - 290, H - TB, base_marks())
    legend(f, W - 280, TB + 20, [("Phinehas", True), ("Phinehas echoes", True), ("Anna", False)])

    f = Q.win(r, PG, "T2 · The folder opened",
              "What was the thread Phinehas, read as a folder: its places are the saves in the folder, in the folder's "
              "own order (draggable); its note is a page in it; its color and the eye (Shown on the text) sit in the "
              "header. The file threads/phinehas.md stays where it is and is read as this folder; no file is moved.")
    w = M.rail5(f, on="Notebook")
    x = side_list(f, w)
    pg = col(f, "folder", gap=10, pad=[24, 32, 24, 32], W="fixed", H="fixed")
    Q.put(pg, x, TB, W - x, H - TB)
    folder_page(pg, PLACES, "50 more saves, in the folder's order")


def save_picker(f, x, y, w=380):
    pk = col(f, "save picker", gap=3, pad=[10, 10, 10, 10], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pk, x, y, w)
    shadow(pk, 8, 28, "#00000033")
    hd = row(pk, "head", gap=8, pad=[2, 4, 4, 4], W="fill")
    icon(hd, "bookmark", 16, "accent", fill="accent")
    text(hd, "Save Numbers 25:12 to", "smallStrong", W="fill")
    text(hd, "K", "caption", "muted")
    P.field(pk, "Find or name a folder", None, icon_name="search", height=32)
    for name, on, sub in (("Phinehas", False, "56"), ("Phinehas echoes", True, "19"), ("Zeal", False, "23"),
                          ("Anna", False, "14"), ("Sunday lessons", False, "117")):
        it = row(pk, f"folder/{name}", gap=8, pad=[7, 8, 7, 8], radius=8, fill="accentSoft" if on else None, W="fill")
        L.checkbox(it, on)
        if name in FOLDERS:
            swatch(it, FOLDERS[name][0], 12)
        else:
            icon(it, "folder", 16, "muted")
        text(it, name, "smallStrong" if on else "body", W="fill")
        text(it, sub, "caption", "muted")
    P.divider(pk)
    it = row(pk, "shelf only", gap=8, pad=[7, 8, 7, 8], radius=8, W="fill")
    L.checkbox(it, False)
    icon(it, "shelf", 16, "muted")
    tc = col(it, "t", gap=0, W="fill")
    text(tc, "Just the Shelf", "body")
    text(tc, "saved, in no folder yet", "caption", "muted")
    ft = row(pk, "foot", gap=8, pad=[6, 4, 0, 4], W="fill")
    text(ft, "Saved in 1", "caption", "muted", W="fill")
    P.button(ft, "Done", "primary", size="sm")
    return pk


def windows_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "T7 · Saving into a folder with a color",
              "The reader on Numbers 25 with the Save picker open on verse 12 (library S7): one list of folders with "
              "tick boxes, the colored folders carrying their dot, and Just the Shelf as the last row. Phinehas echoes "
              "is ticked, and the verse takes its blue mark in the margin at once (a whole verse saved is never "
              "underlined). Save is the library's picker; the only thing a color adds is the margin mark's color, and a "
              "line under a saved phrase.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader(f, w, TB, W - w - 400, H - TB, base_marks(), sel=(12, 0, 999))
    save_picker(f, W - 410, TB + 120)

    f = Q.win(r, PG, "T8 · Among other tabs",
              "The folder Phinehas is one tab of four (Phinehas, Concordance, Zeal in Numbers 25, Trash) in a pane "
              "beside the reader. The reader's own pane has two tabs (Numbers 25, Psalms 106; only Numbers 25 is "
              "drawn) and keeps its margin marks and the line under a saved phrase. The folder's body is the same "
              "drawing as T2.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    rw = 600
    rp = frame(f, "reader pane", x=w, y=TB, w=rw, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True)
    M.folder_strip(rp, ["Numbers 25", "Psalms 106"], "Numbers 25", actions=("minimize", "expand", "float", "close"))
    reader(rp, 0, 0, rw, H - TB - 40, base_marks(), parent_fills=True, origin=(w, TB + 40), win=f, lay="pane")
    body = M.pane(f, w + rw, TB, W - w - rw, H - TB, ["Phinehas", "Concordance", "Zeal in Numbers 25", "Trash"],
                  "Phinehas")
    folder_page(body, PLACES, "50 more saves, in the folder's order")


def windows_c(cv):
    r = row(cv, "C", gap=64, align="min")
    f = Q.win(r, PG, "T9 · Floating",
              "The folder opened as a small floating pane (320 wide) over the reader: its name, its color, the eye, "
              "56 saves and 1 page, the first saves and 50 more. Nothing is cut, and the pane sits to the right of the "
              "reading column, clear of the margin marks and the saved phrases it is about.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader(f, w, TB, W - w - 340, H - TB, base_marks())
    fw = col(f, "float", gap=0, fill="surface", radius=12, stroke="line", sw=1, W="fixed", clip=True)
    Q.put(fw, W - 340, TB + 60, 320)
    shadow(fw, 16, 44, "#00000030")
    M.folder_strip(fw, ["Phinehas"], "Phinehas", actions=("minimize", "expand", "close"))
    body = col(fw, "folder", gap=8, pad=[12, 12, 14, 12], W="fill")
    folder_page(body, PLACES[:4], "50 more", compact=True)

    # --- T10: a 390 px phone
    f = Q.win(r, PG, "T10 · Narrow",
              "A 390 px phone: the reader with the margin marks and the line under a saved phrase, and Shown on the "
              "text opened as a sheet over the bottom (from the eye in the top bar), listing the colored folders each "
              "with its dot and eye, in rows 48 px high for a finger. The sheet reaches the window's bottom edge.",
              w=390, h=844)
    P.status_bar(f, 390)
    tb = P.top_bar(f, "Numbers 25", None, ["eye", "search"], title_icon="down")
    B.place(tb, 0, 47)
    b = B.body(f, pad=20, gap=6)
    text(b, "Numbers 25", "chapter")
    lines, margin = base_marks()
    verses_marked(b, B.vv("num25", 10, 13), "readPhone", lines, paragraphs=(6, 10))
    margin_marks(f, 3, PHONE_Y0, 32, margin, VLINE["phone"], size=13)
    frame(f, "scrim", x=0, y=0, w=390, h=844, fill="scrim", W="fixed", H="fixed")
    sh = col(f, "sheet", gap=2, pad=[8, 16, 34, 16], fill="surface", W="fixed", H="fixed", cornerRadius=[22, 22, 0, 0],
             stroke="line", sw=1)
    Q.put(sh, 0, 844 - 392, 390, 392)
    shadow(sh, 10, 30, "#00000040")
    gr = row(sh, "grab", W="fill", mainAlign="center", pad=[0, 0, 8, 0])
    frame(gr, "grab bar", w=40, h=4, radius=2, fill="line", W="fixed", H="fixed")
    shown_panel(sh, [("Phinehas", True), ("Phinehas echoes", True), ("Zeal", False), ("Anna", False),
                     ("Tuesday study", False)], big=True, title="Shown on the text", counts=True)


def hover_card(f, x, y, names, w=250):
    hc = col(f, "hover", gap=2, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(hc, x, y, w)
    shadow(hc, 8, 28, "#00000033")
    text(hc, f"Saved in {len(names)} folders", "smallStrong")
    for n in names:
        it = row(hc, f"in/{n}", gap=8, pad=[3, 0, 3, 0], W="fill")
        swatch(it, FOLDERS[n][0], 12)
        text(it, n, "small", "accent", W="fill")
    return hc


def windows_d(cv):
    r = row(cv, "D", gap=64, align="min")
    f = Q.win(r, PG, "T11 · Years of study",
              "Left, Shown on the text with 34 colored folders (the same panel as T1 and T10): a head line, a search "
              "field, the six shown folders first, the rest folded under their parent folder with counts (folders "
              "inside folders follow the library's folder form), and Hide all as quiet text. Middle, the reader where "
              "one run of words is saved in five shown folders: two lines under it, and a hover card in the margin "
              "naming all five (each name opens that folder). Right, a folder holding 412 saves, drawn as T2 draws a "
              "folder, shows its first 20, in its own order, and Show all 412.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    pw, sw_ = 300, 340
    pn = col(f, "marks panel", gap=2, pad=[14, 12, 14, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
             strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0, clip=True)
    Q.put(pn, w, TB, pw, H - TB)
    shown_panel(pn, [(n, True) for n in FOLDERS], head="34 folders with a color · 6 shown", search=True, counts=True,
                shown_label="  SHOWN · 6",
                not_shown=("  NOT SHOWN · 28", ["Sunday lessons · 12", "Word studies · 9", "Salt · 7"]))

    marks = {}
    add(marks, 11, phrase_idx(11, L.S17_PHRASES[0]), "threadB", "folderC", "folderD", "folderE")
    add(marks, 13, phrase_idx(13, L.S21_PHRASE), "threadA")
    margin = {11: ["threadA"], 12: ["threadB"], 13: ["threadA"]}
    rx = w + pw
    colw = 420
    reader(f, rx, TB, W - rx - sw_, H - TB, (marks, margin), first=10, last=13, colw=colw, left=48, lay="t11")
    hover_card(f, rx + 48 + colw + 10, TB + HOVER_Y, ["Phinehas", "Phinehas echoes", "Zeal", "Anna", "Tuesday study"],
               w=W - sw_ - (rx + 48 + colw + 10) - 6)

    body = M.pane(f, W - sw_, TB, sw_, H - TB, ["Reading 2025"], "Reading 2025", actions=("minimize", "expand", "close"))
    folder_page(body, [f"Psalms {i}:1" for i in range(1, 21)], "Show all 412", name="Reading 2025", color="folderF",
                count="412 saves · 1 page", dense=True, more_strong=True)


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "A folder with a color (what a thread was)",
                  "Direction A leads (2026-11-16): a thread is a folder with a color. Its places are the saves in the "
                  "folder, in its own order; its note is a page in it; a colored folder can be shown on the text: a "
                  "whole verse saved in it carries the folder's color in the margin, a saved phrase carries a line "
                  "under it, and each folder has an eye in the reader's Shown on the text.")
    windows_a(cv)
    windows_b(cv)
    windows_c(cv)
    windows_d(cv)


def main():
    F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
    F.ICONS.setdefault("eye", "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z")
    F.ICONS.setdefault("eyeOff", "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16")
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "threads.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "threads.figcraft"
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
