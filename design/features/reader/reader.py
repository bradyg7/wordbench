"""The Reader, round 1: the reader as built, drawn for the first time in design/features/, inside the evolving app (the
left rail, the trail, the Library). It asks how a click, a right click and a selection should behave (findings dc65,
32be), whether the person's marks belong over the text or in a margin beside it (5a80, 64f0), and how a second reader
and a single verse should look (b59b, 94a1). Nothing is built from this until the person accepts it. Scripture shown
comes from design/content.json (generated from the database) through build.C and figlib.verses; nothing is typed.

    python design/features/reader/reader.py
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
sys.path.insert(0, str(HERE.parent / "library"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
from figlib import S, col, frame, icon, para, row, shadow, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Reader"
PG = "Reader"
C = B.C
MARKS = B.NUM25_MARKS


def floating(f, name, x, y, w, pad=(10, 10, 10, 10), gap=4, r=12):
    p = col(f, name, gap=gap, pad=list(pad), fill="surface", radius=r, stroke="line", sw=1, W="fixed")
    Q.put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def menu_row(parent, label, ic, key=None, muted=False, on=False):
    it = row(parent, f"menu/{label}", gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if on else None)
    icon(it, ic, 16, "muted" if muted else "fg")
    text(it, label, "small", "muted" if muted else "fg", W="fill")
    if key:
        P.kbd(it, key)
    return it


def reader_at(f, x, w, first=10, last=13, sel=None, marks=MARKS):
    return B.desk_reader(f, x, TB, w, H - TB, first=first, last=last, sel=sel, marks=marks)


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "R1 · Today: a click on a verse number",
              "As built (ui/src/main.ts showBar): a click on a verse number selects the verse and opens the color bar: "
              "five colors, the three latest threads, and Note, Question, Thread, Copy, Notes & lookup, Open as a tab. "
              "A click on a word opens its sheet with everything about it. Findings dc65 and 32be: it opens "
              "everything and gets in the way.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader_at(f, w, W - w, sel=(12, 0, 999))
    bar = floating(f, "color bar", w + 300, 470, 640, pad=(10, 12, 10, 12), gap=8)
    top = row(bar, "top", gap=12, W="fill")
    P.color_row(top, size=26)
    for name in ("Phinehas", "Phinehas echoes", "Covenant"):
        P.chip(top, name, "outline")
    acts = row(bar, "actions", gap=6, W="fill", wrap=True)
    for lbl in ("Note", "Question", "Thread", "Copy", "Notes & lookup", "Open as a tab"):
        P.button(acts, lbl, "secondary", size="sm")


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "R2 · A: a click colors, a right click asks",
              "A click on a verse number (or a drag over words) shows only the colors, small, beside the verse: one "
              "click colors it, nothing else opens. Everything else moves to the right click (finding dc65).")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader_at(f, w, W - w, sel=(12, 0, 999))
    dots = row(f, "colors", gap=8, pad=[6, 10, 6, 10], fill="surface", radius=999, stroke="line", sw=1)
    Q.put(dots, w + 380, 455)
    shadow(dots, 6, 18, "#00000026")
    P.color_row(dots, size=20)

    f = Q.win(r, PG, "R3 · A: the right click",
              "One clean menu (finding 32be's dropdown), the colors on its top line. Lookups first, then writing, "
              "then keeping. Save (K) is the library's keep (library S20); Thread follows whatever threads round 1 "
              "decides. Each line is also a key and a wb command.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader_at(f, w, W - w, sel=(12, 0, 999))
    mn = floating(f, "menu", w + 520, 430, 300, pad=(8, 6, 8, 6), gap=1)
    hd = row(mn, "colors", gap=6, pad=[4, 8, 8, 8], W="fill")
    P.color_row(hd, size=20, with_more=False)
    text(mn, "  NUMBERS 25:12", "label", "muted")
    menu_row(mn, "Interlinear", "interlinear", "I")
    menu_row(mn, "Strong's and every use", "word", "S")
    menu_row(mn, "Open this verse alone", "book")
    P.divider(mn)
    menu_row(mn, "Write in a page", "pen", "N")
    menu_row(mn, "Ask a question", "question", "?")
    P.divider(mn)
    menu_row(mn, "Save", "bookmark", "K")
    menu_row(mn, "Thread", "threads", muted=True)
    menu_row(mn, "Copy with reference", "copy", "C")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "R4 · B: a selection shows in the top bar",
              "Nothing floats over the text. A selection puts its tools in the top bar, where the place button was "
              "(finding 32be: the option on the toolbar): the colors to the left, then a few buttons and a dropdown "
              "for the rest. Esc or a click away gives the bar back.")
    w = M.rail5(f)
    bar = row(f, "top bar", gap=10, pad=[0, 12, 0, 12], fill="accentSoft", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, w, 0, W - w, TB)
    text(bar, "Numbers 25:12", "bodyStrong")
    P.color_row(bar, size=22, with_more=False)
    for lbl, ic in (("Interlinear", "interlinear"), ("Strong's", "word"), ("Write", "pen"), ("Save", "bookmark")):
        P.button(bar, lbl, "secondary", icon_name=ic, size="sm")
    dd = row(bar, "more", gap=4, pad=[4, 8, 4, 10], radius=8, stroke="line", sw=1, fill="surface")
    text(dd, "More", "small")
    icon(dd, "down", 14, "muted")
    frame(bar, "space", w=10, h=8, W="fill", H="fixed")
    P.icon_button(bar, "close", "muted", size=30, icon_size=16)
    reader_at(f, w, W - w, sel=(12, 0, 999))

    f = Q.win(r, PG, "R5 · B: the dropdown opened",
              "The rest, in the same order as A's right click. The place button comes back when the selection is "
              "cleared; the reader does not move.")
    w = M.rail5(f)
    bar = row(f, "top bar", gap=10, pad=[0, 12, 0, 12], fill="accentSoft", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, w, 0, W - w, TB)
    text(bar, "Numbers 25:12", "bodyStrong")
    P.color_row(bar, size=22, with_more=False)
    for lbl, ic in (("Interlinear", "interlinear"), ("Strong's", "word"), ("Write", "pen"), ("Save", "bookmark")):
        P.button(bar, lbl, "secondary", icon_name=ic, size="sm")
    dd = row(bar, "more", gap=4, pad=[4, 8, 4, 10], radius=8, stroke="accent", sw=1, fill="surface")
    text(dd, "More", "smallStrong", "accent")
    icon(dd, "down", 14, "accent")
    reader_at(f, w, W - w, sel=(12, 0, 999))
    mn = floating(f, "dropdown", w + 690, TB + 4, 260, pad=(6, 6, 6, 6), gap=1)
    menu_row(mn, "Ask a question", "question", "?")
    menu_row(mn, "Thread", "threads")
    menu_row(mn, "Open this verse alone", "book")
    menu_row(mn, "Open as a tab", "float")
    menu_row(mn, "Copy with reference", "copy", "C")


def direction_c(cv):
    r = row(cv, "C", gap=64, align="min")
    f = Q.win(r, PG, "R6 · C: the margin, like a printed Bible",
              "Finding 5a80: marks as a layer on the text, not pop-ups. The color and the underline stay on the "
              "words; what you wrote sits in a margin beside its verse, as a pencil note does: a page's mark, a "
              "question, a thread's name. Nothing in the margin is text the app wrote; each item opens what it names.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rd = frame(f, "reader", x=w, y=TB, w=W - w, h=H - TB, layout="horizontal", mainAlign="center", gap=28,
               pad=[32, 32, 32, 32], W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": 640}}, ref=False)
    text(inner, "Numbers 25", "chapter", fontSize=30, lineHeight="40px")
    F.verses(inner, B.vv("num25", 8, 13), "readDesk", MARKS, paragraphs=(10,))
    mg = col(rd, "margin", gap=10, pad=[64, 0, 0, 14], W="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    S.do("node.set", {"ids": [mg], "props": {"width": 230}}, ref=False)
    for ref, lbl, ic, color, gap_ in (("25:8", "a page", "pen", "accent", 0), ("25:9", "a question", "question",
                                      "question", 40), ("25:11", "Phinehas", "threads", "threadA", 150),
                                      ("25:11", "a page", "pen", "accent", 0), ("25:13", "a page", "pen", "accent", 120)):
        if gap_:
            frame(mg, "space", w=10, h=gap_, W="fixed", H="fixed")
        it = row(mg, f"margin/{ref}/{lbl}", gap=6)
        icon(it, ic, 14, color)
        text(it, ref, "caption", "muted")
        text(it, lbl, "small", color if color != "accent" else "fg")
    text(mg, "names only; a click opens it", "caption", "muted")

    f = Q.win(r, PG, "R7 · C: one switch for every mark",
              "Finding 64f0: highlights and thread bars can be hidden, page marks and question marks cannot. In C the "
              "Highlights button on the rail lists every kind of mark with an eye, and the margin itself can be "
              "folded away for plain reading.")
    w = M.rail5(f, on="Highlights")
    M.slim_bar(f, x=w, w=W - w)
    pn = col(f, "marks", gap=4, pad=[14, 12, 14, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
             strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(pn, w, TB, 280, H - TB)
    text(pn, "SHOWN ON THE TEXT", "label", "muted")
    for ic, color, name, on in (("highlight", "hlYellow", "Highlights", True), ("threads", "threadA", "Thread underlines",
                                True), ("pen", "accent", "Pages written on a verse", False),
                                ("question", "question", "Questions", True), ("list", "muted", "The margin", False)):
        it = row(pn, f"mark/{name}", gap=8, pad=[6, 6, 6, 6], radius=8, W="fill")
        icon(it, ic, 16, color)
        text(it, name, "small", "fg" if on else "muted", W="fill")
        icon(it, "eye" if on else "eyeOff", 14, "fg" if on else "muted")
    marks = {k: {kk: vv for kk, vv in m.items() if kk != "note"} for k, m in MARKS.items()}
    B.desk_reader(f, w + 280, TB, W - w - 280, H - TB, first=8, last=13, marks=marks)


def second_reader(cv):
    r = row(cv, "panes", gap=64, align="min")
    f = Q.win(r, PG, "R8 · A second reader, the same as the first",
              "Finding b59b: a reader opened beside the first gets the same place button and arrows, the same "
              "KJV/YLT switch, a slightly smaller type, and none of the explaining text. Its one extra is an arrow "
              "that sends its place to the main reader.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rw = 560
    B.desk_reader(f, w, TB, W - w - rw, H - TB, first=10, last=13)
    d = frame(f, "pane/second reader", x=W - rw, y=TB, w=rw, h=H - TB, fill="surface", layout="vertical", W="fixed",
              H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
              strokeBottomWeight=0)
    M.folder_strip(d, ["Numbers 25 · YLT", "Numbers 25 · KJV"], "Numbers 25 · YLT")
    nav = row(d, "nav", gap=6, pad=[8, 12, 8, 12], W="fill")
    P.icon_button(nav, "left", "fg", size=28, icon_size=16)
    pl = row(nav, "place button", gap=6, pad=[4, 10, 4, 10], radius=8, fill="bg", stroke="line", sw=1)
    text(pl, "Numbers 25", "smallStrong")
    icon(pl, "down", 12, "muted")
    P.icon_button(nav, "right", "fg", size=28, icon_size=16)
    P.segmented(nav, ["KJV", "YLT"], "YLT", W="hug")
    frame(nav, "space", w=8, h=8, W="fill", H="fixed")
    sr = row(nav, "send", gap=4, pad=[4, 8, 4, 8], radius=8, stroke="line", sw=1)
    text(sr, "Send to reader", "caption", "accent")
    icon(sr, "back", 14, "accent")
    b = col(d, "text", gap=8, pad=[8, 28, 24, 28], W="fill", H="fill", clip=True)
    F.verses(b, B.vv("num25_ylt", 10, 13), "readSmall", {})


def verse_alone(cv):
    r = row(cv, "verse", gap=64, align="min")
    f = Q.win(r, PG, "R9 · A verse opened by itself",
              "Finding 94a1: a verse opened from a page opens that verse only, not the chapter, with its lookups one "
              "tab away: Interlinear, Strong's, Definitions. Read the chapter opens it in the reader at the verse.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    pw = 640
    B.desk_reader(f, w, TB, W - w - pw, H - TB, first=10, last=13)
    d = frame(f, "pane/verse", x=W - pw, y=TB, w=pw, h=H - TB, fill="surface", layout="vertical", W="fixed",
              H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
              strokeBottomWeight=0)
    M.folder_strip(d, ["Covenant of peace", "Numbers 25:11"], "Numbers 25:11")
    b = col(d, "body", gap=14, pad=[16, 24, 16, 24], W="fill", H="fill", clip=True)
    hd = row(b, "head", gap=8, W="fill")
    text(hd, "Numbers 25:11", "title", W="fill")
    text(hd, "Read the chapter", "smallStrong", "accent")
    F.verses(b, B.vv("num25", 11, 11), "readDesk", {11: MARKS[11]})
    P.segmented(b, ["Interlinear", "Strong's", "Definitions"], "Interlinear")
    cells = row(b, "words", gap=8, W="fill", align="min", wrap=True)
    for w_ in C["interlinear"][:6]:
        cell = P.interlinear_cell(cells, w_)
        Q.put(cell, 0, 0, 92)


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "The Reader, round 1",
                  "The reader is the app's centre and was built before design/features/ existed. This round draws it "
                  "as it is (R1), then three directions for what a click and a right click do and where the marks "
                  "sit: A, a click colors and a right click asks; B, a selection's tools go to the top bar; C, what "
                  "you wrote sits in a margin beside the verse. Then two things the person asked for in findings: a "
                  "second reader like the first (R8), and a verse opened alone (R9). The study files do not change.")
    today(cv)
    direction_a(cv)
    direction_b(cv)
    direction_c(cv)
    second_reader(cv)
    verse_alone(cv)


# windows that no longer lead (see the README's Leading design table)
DROP = ['R4', 'R5']


def main():
    sys.path.insert(0, str(HERE.parent))
    import lead  # noqa: E402
    lead.drop(Q, DROP)
    F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
    F.ICONS.setdefault("eyeOff", "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16")
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "reader.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "reader.figcraft"
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
