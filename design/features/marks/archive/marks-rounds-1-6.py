"""Marks (rounds 1-5, 2026-11-12; trimmed and given its real conditions 2026-11-16). The person's answers to the concept (marks/README.md): a margin note in a printed Bible
is apart from the notebook, but here notes must be connected and editable; every verse could have its own page with
its notes and, below them, every reference to the verse or a word in it; a passage shown in a page with its marks is
like a photograph of an annotated Bible; questions are a search filter at most; a thread is a folder of saves, which
asks what an underline then means. This board draws that model. Scripture is fetched with wb text; what the person
wrote is shown as placeholders, never as text.

    python design/features/marks/marks.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, S, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Marks"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
V11 = next(v["text"] for v in NUM25 if v["v"] == 11)
# highlights, and a saved line under the first word of 25:11 (the threads token is a folder's color); nothing dotted
PENCIL = {11: {"hl": "green", "threads": {0: ["threadA"]}}, 12: {"hl": "yellow"}, 13: {"hl": "yellow"}}
FOLDERS = [("Phinehas", "threadA"), ("Phinehas echoes", "threadB")]
MINE = "Your own words, as you wrote them"


def place_bar(f, x, w, place="Numbers 25"):
    """The slim top bar with its place button saying `place` (minimize.slim_bar hard-codes Numbers 25)."""
    bar = row(f, "top bar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, x, 0, w, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "fg")
    text(pl, place, "bodyStrong")
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


def app_at(f, place, on=None):
    """K.app with the place button naming `place`. Returns the rail's width."""
    w = K.M.rail5(f, on=on)
    place_bar(f, w, W - w, place)
    return w


def vspace(parent, h):
    return frame(parent, "space", w=10, h=max(0, h), W="fixed", H="fixed")


def level_rows(parent, rows, top, rh=20):
    """Rows of a margin column that starts at window y `top` (no padding above): each row is centred on the window y
    given for it (the middle of its verse's first line), so a mark sits level with its verse."""
    cur = top
    for yc, build in rows:
        vspace(parent, round(yc - rh / 2 - cur))
        it = row(parent, "level row", gap=6, W="fill", H="fixed")
        S.do("node.set", {"ids": [it], "props": {"height": rh}}, ref=False)
        build(it)
        cur = yc + rh / 2


def margin_note(parent, verse, lines=2, refs=0, q=False, editing=False):
    box = col(parent, f"margin/{verse}", gap=4, pad=[8, 10, 8, 10], radius=8, W="fill",
              fill="surface" if editing else None, stroke="accent" if editing else "line", sw=1,
              strokeLeftWeight=2, strokeRightWeight=1 if editing else 0, strokeTopWeight=1 if editing else 0,
              strokeBottomWeight=1 if editing else 0)
    hd = row(box, "head", gap=6, W="fill")
    text(hd, verse, "caption", "accent")
    spacer(hd)
    if refs:
        icon(hd, "list", 12, "muted")
        text(hd, f"{refs}", "caption", "muted")
    for i in range(lines):
        para(box, MINE + ("…" if i == lines - 1 else ""), "small", "muted")
    if q:
        qr = row(box, "question", gap=6)
        icon(qr, "question", 12, "question")
        text(qr, "a question line", "caption", "question")
    return box


# ---- M6 a passage in a page, with its marks ------------------------------------------------------------------------

def passage(cv):
    r = row(cv, "passage", gap=64, align="min")
    f = Q.win(r, PG, "M6 · A passage in a page, with your marks",
              "A scripture block's switch: Just the text · With my marks. With marks it is the photograph of your "
              "annotated Bible: a highlight color on one run of words and a saved phrase's line under the same words, "
              "the grey pencil under another run, and a narrow margin with one dot per verse that has a page, level "
              "with the verse's first line, a number when it has references. Nothing more until you hover or click "
              "a dot.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    para(p, MINE + ".", "body", "muted")
    blk = col(p, "scripture block", gap=10, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface",
              W="fill")
    hd = row(blk, "head", gap=10, W="fill")
    text(hd, "Numbers 25:10–13", "smallStrong", W="fill")
    P.segmented(hd, ["Just the text", "With my marks"], "With my marks", W="hug")
    marked_verses(blk)
    ft = row(blk, "foot", gap=8, W="fill")
    text(ft, "Live: shows your marks as they are now", "caption", "muted", W="fill")

    f = Q.win(r, PG, "M7 · A dot opened, inside the page",
              "A click on a dot opens that verse's margin in a card beside the dot (names and your first lines, as in "
              "the reader's margin), so the page you are writing never moves and the verses stay in view. The card's "
              "expand button opens the verse's margin itself.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    blk = col(p, "scripture block", gap=10, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface",
              W="fixed")
    S.do("node.set", {"ids": [blk], "props": {"width": 760}}, ref=False)
    text(blk, "Numbers 25:10–13", "smallStrong")
    marked_verses(blk, on_dot=11)
    c = K.floating(f, "verse margin card", w + 22 + 760 + 14, TB + 150, 420)
    hd = row(c, "head", gap=6, W="fill")
    text(hd, "Numbers 25:11", "smallStrong", W="fill")
    P.icon_button(hd, "expand", "muted", size=26, icon_size=14)
    P.icon_button(hd, "close", "muted", size=26, icon_size=14)
    para(c, MINE + "…", "small", "muted")
    for name, ic in (("Phinehas · a page", "page"), ("Zeal · a page", "page"), ("zealous · H7065", "word"),
                     ("a question line", "question")):
        it = row(c, name, gap=8)
        icon(it, ic, 14, "muted")
        text(it, name, "small")


# ==== Round 2 (2026-11-12) ===========================================================================================

WORDS11 = V11.split()
STYLE = {  # a run of words drawn as one piece: frame props that make a continuous mark under or around it
    "pencil": dict(stroke="muted", strokeBottomWeight=1.5, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0),
    "save": dict(stroke="threadA", strokeBottomWeight=2.5, strokeTopWeight=0, strokeLeftWeight=0,
                 strokeRightWeight=0),
    "save2": dict(stroke="threadB", strokeBottomWeight=2.5, strokeTopWeight=0, strokeLeftWeight=0,
                  strokeRightWeight=0),
    "hl": dict(fill="hlYellow", radius=2),
}


def run_text(parent, spans, style="readSmall", width=None):
    """Words that wrap, with some runs drawn as one piece so a mark joins the words (the person: one line under the
    run, not a line under each word). spans: [(text, None | style name | [style names, outer first])]."""
    flow = frame(parent, "run", layout="horizontal", wrap=True, gap=5, crossGap=4, crossAlign="center",
                 W="fill" if width is None else "fixed", H="hug")
    if width:
        S.do("node.set", {"ids": [flow], "props": {"width": width}}, ref=False)
    for s_, st in spans:
        if not st:
            for wd in s_.split():
                text(flow, wd, style)
            continue
        names = st if isinstance(st, list) else [st]
        outer = flow
        for i, n in enumerate(names):
            pad = [0, 1, 2 if i < len(names) - 1 else 1, 1]
            outer = row(outer, f"mark/{n}", gap=5, pad=pad, **STYLE[n])
        text(outer, s_, style)
    return flow


def split11(a, b):
    """Verse 11 cut into before, the words a..b-1, after (the verse is fetched; only the cut is chosen here)."""
    return " ".join(WORDS11[:a]), " ".join(WORDS11[a:b]), " ".join(WORDS11[b:])


def verse_box(parent, spans, ref="Numbers 25:11", width=None):
    v = col(parent, "verse", gap=6, pad=[14, 16, 14, 16], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    run_text(v, spans, width=width)
    text(v, ref + " KJV", "caption", "muted")
    return v


STYLE["hlGreen"] = dict(fill="hlGreen", radius=2)
STYLE["hlYellow"] = dict(fill="hlYellow", radius=2)


def words_of(v):
    return next(x["text"] for x in NUM25 if x["v"] == v).split()


# the marks drawn on M6/M7's words: (first word, one past the last word or None for the end, style); chosen by position
MARKED = {10: [],
          11: [(0, 5, ["hlGreen", "save"]), (9, 13, "pencil")],  # a color and a saved phrase, then the grey pencil
          12: [(0, None, "hlYellow")],
          13: [(0, 9, "hlYellow")]}
DOTS = {11: "25:11 · 4", 13: "25:13 · 1"}   # the verses that have a page: the dot's label (a number when it has references)


def verse_flow(parent, v, spec, style="readSmall", lh=25):
    """One verse as words that wrap, the verse number first, runs of words drawn as one piece (see run_text)."""
    ws = words_of(v)
    flow = frame(parent, f"v{v}", layout="horizontal", wrap=True, gap=5, crossGap=4, crossAlign="center", W="fill",
                 H="hug")
    text(flow, str(v), "verseNum", "accent", fontSize=11, lineHeight=f"{lh}px")
    i = 0
    for a, b, st in sorted((a, len(ws) if b is None else b, st) for a, b, st in spec):
        assert 0 <= a < b <= len(ws)
        for wd in ws[i:a]:
            text(flow, wd, style)
        names = st if isinstance(st, list) else [st]
        outer = flow
        for k, n in enumerate(names):
            outer = row(outer, f"mark/{n}", gap=5, pad=[0, 1, 2 if k < len(names) - 1 else 1, 1], **STYLE[n])
        text(outer, " ".join(ws[a:b]), style)
        i = b
    for wd in ws[i:]:
        text(flow, wd, style)
    return flow


def marked_verses(blk, on_dot=None):
    """The photograph: each verse in its own row with the words on the left and, at the right, that verse's dot in a
    narrow margin, level with the verse's first line (the dot sits in the verse's own row)."""
    for v in (10, 11, 12, 13):
        it = row(blk, f"verse {v}", gap=14, align="min", W="fill")
        verse_flow(it, v, MARKED[v])
        mg = row(it, "margin", gap=6, pad=[0, 0, 0, 10], W="fixed", H="fixed", align="center")
        S.do("node.set", {"ids": [mg], "props": {"width": 110, "height": 25}}, ref=False)
        if v in DOTS:
            if v == on_dot:   # the dot that was clicked, in its on state
                ring = frame(mg, "dot on", w=20, h=20, radius=10, fill="accentSoft", W="fixed", H="fixed",
                             layout="horizontal", mainAlign="center", crossAlign="center")
                K.F.dot(ring, "accent", 10)
            else:
                K.F.dot(mg, "accent", 8)
            text(mg, DOTS[v], "caption", "accent" if v == on_dot else "muted")


def narrow_reader(f, x, w, title="Numbers 25"):
    rd = frame(f, "narrow reader", x=x, y=TB, w=w, h=H - TB, layout="vertical", pad=[20, 18, 20, 18], W="fixed",
               H="fixed", clip=True, gap=8)
    Q.put(rd, x, TB + 36, w, H - TB - 36)
    text(rd, title, "chapter", fontSize=22, lineHeight="30px")
    return rd


# ---- marks with many tabs open -------------------------------------------------------------------------------------

def folded_verses(rd, text_w, verses=(10, 11, 12)):
    """Verses with their marks folded into the number's gutter (a ribbon, a page corner); words keep their colors."""
    for v, spans, marks_ in ((10, [(next(x["text"] for x in NUM25 if x["v"] == 10), None)], ""),
                             (11, [(split11(0, 5)[1], "hl"), (" ".join(WORDS11[5:]), None)], "bookmark,page"),
                             (12, [(next(x["text"] for x in NUM25 if x["v"] == 12), None)], "bookmark")):
        if v not in verses:
            continue
        it = row(rd, f"v{v}", gap=6, align="min", W="fill")
        g = col(it, "gutter", gap=2, W="fixed", crossAlign="center")
        S.do("node.set", {"ids": [g], "props": {"width": 22}}, ref=False)
        text(g, str(v), "caption", "accent")
        for ic in filter(None, marks_.split(",")):
            icon(g, ic, 12, "threadA" if ic == "bookmark" else "accent")
        run_text(it, spans, width=text_w)


def placeholder_rows(p, widths):
    """Muted bars standing for the lines of another pane's content (a drawn sample, no words)."""
    for wd in widths:
        frame(p, "placeholder row", w=wd, h=10, radius=5, fill="line", W="fixed", H="fixed")


def crowded(cv):
    r = row(cv, "crowded", gap=64, align="min")
    f = Q.win(r, PG, "M12 · Marks in a narrow reader, many tabs open",
              "When a reader is narrow (here a third of the window, with a Concordance and a page open) the margins "
              "fold: saves and pages become one small mark at the verse number (a ribbon, a page corner), the words "
              "keep their colors and pencil. Hover shows the names, in a card beside the verse; a click opens the verse's "
              "margin in that pane.")
    w = K.app(f)
    third = (W - w) // 3
    K.M.pane(f, w, TB, third, H - TB, ["Numbers 25", "Psalms 106", "Romans 10"], "Numbers 25", side="left")
    rd = narrow_reader(f, w, third)
    folded_verses(rd, third - 80)
    p2 = K.M.pane(f, w + third, TB, third, H - TB, ["Concordance", "H7065"], "H7065", side="left")
    text(p2, "H7065", "title")
    para(p2, "a word in the Concordance (a drawn sample)", "small", "muted")
    vspace(p2, 90)   # where the hover card sits, beside verse 11
    placeholder_rows(p2, (300, 240, 270, 180, 250))
    p3 = K.M.pane(f, w + 2 * third, TB, W - w - 2 * third, H - TB, ["Tuesday study"], "Tuesday study")
    text(p3, "Tuesday study", "title")
    para(p3, "a page (a drawn sample)", "small", "muted")
    placeholder_rows(p3, (340, 300, 320, 220, 330, 280))
    c = K.floating(f, "hover", w + third + 12, TB + 118, 300, gap=4)
    text(c, "Numbers 25:11", "smallStrong")
    for n, ic in (("Saved in Phinehas", "bookmark"), ("3 pages name it · 2 margin notes", "page")):
        it = row(c, n, gap=6)
        icon(it, ic, 12, "muted")
        text(it, n, "caption")


# ---- the underline, expanded ----------------------------------------------------------------------------------------

def underlines(cv):
    r = row(cv, "underlines", gap=64, align="min")
    f = Q.win(r, PG, "M13 · One line under the run, not under each word",
              "A mark on a run of words is drawn as one piece: the line goes under the spaces too, and breaks only "
              "where the line of text breaks. A line under each word, and one line under the run, on the same words.")
    body = col(f, "body", gap=28, pad=[56, 64, 56, 64], W="fixed", H="fixed")
    Q.put(body, 0, 0, W, H)
    a, m, b = split11(0, 5)
    text(body, "A LINE UNDER EACH WORD", "label", "muted")
    v = col(body, "today", gap=4, pad=[14, 16, 14, 16], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    K.F.verses(v, [x for x in NUM25 if x["v"] == 11], "readSmall", {11: {"threads": {k: ["threadA"] for k in range(5)}}})
    text(body, "ONE LINE UNDER THE RUN", "label", "muted")
    verse_box(body, [(m, "save"), (b, None)])
    text(body, "A RUN THAT CROSSES A LINE BREAK: ONE PIECE ON EACH LINE", "label", "muted")
    # at 520 wide the line breaks after word 13 ("turned"); the run, words 9-15, is drawn as one piece on each line
    a2, m2, b2 = split11(9, 13)
    verse_box(body, [(a2, None), (m2, "save"), (" ".join(WORDS11[13:16]), "save"), (" ".join(WORDS11[16:]), None)],
              width=520)

    f = Q.win(r, PG, "M14 · The pencil, at work",
              "The pencil is grey, thin and plain: attention, not meaning. Select words and press U (or Pencil in the "
              "right-click menu, under the colors). Press U again on it to take it off. It sits under colors and "
              "saves without fighting them.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25", "three verses with the pencil", fill="bg")
    a, m, b = split11(10, 17)
    verse_box(p, [(a, None), (m, "pencil"), (b, None)])
    a, m, b = split11(0, 5)
    verse_box(p, [(m, ["hl", "pencil"]), (b, None)])
    mn = K.floating(f, "menu", W - 360, TB + 260, 300, gap=1)
    hd = row(mn, "colors", gap=6, pad=[4, 8, 8, 8], W="fill")
    P.color_row(hd, size=20, with_more=False)
    for lbl, ic, key in (("Pencil", "pen", "U"), ("Save", "bookmark", "K"), ("Write in the margin", "page", "N")):
        it = row(mn, lbl, gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if lbl == "Pencil" else None)
        icon(it, ic, 16)
        text(it, lbl, "small", W="fill")
        P.kbd(it, key)

    f = Q.win(r, PG, "M15 · A saved phrase: the folder's color",
              "Saving a run of words underlines it in the color of the folder it is saved in (a folder has a color). "
              "At most two lines are drawn under a run, stacked close; the hover names every folder it is saved in. "
              "Taking it out of a folder takes that line away. A whole verse saved gets the ribbon in the left "
              "margin instead, so lines stay for phrases.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25", "saved phrases", fill="bg")
    a, m, b = split11(0, 5)
    verse_box(p, [(m, "save"), (b, None)])
    a, m, b = split11(23, 30)
    verse_box(p, [(a, None), (m, ["save2", "save"]), (b, None)])
    c = K.floating(f, "hover", W - 460, TB + 330, 280, gap=4)
    text(c, "Saved in", "caption", "muted")
    for n, col_ in (("Phinehas", "threadA"), ("Phinehas echoes", "threadB")):
        it = row(c, n, gap=6)
        frame(it, "swatch", w=16, h=3, fill=col_, W="fixed", H="fixed")
        text(it, n, "small")


# ---- history -----------------------------------------------------------------------------------------------------

def history(cv):
    r = row(cv, "history", gap=64, align="min")
    f = Q.win(r, PG, "M18 · The development of your thoughts on a verse",
              "The verse's margin has a thin timeline at its foot: each dot a time something of yours came to this "
              "verse (a highlight, a margin note, a question asked or answered, a page that names it). Dragging back shows the "
              "verse and its margin notes as they were then. Nothing on a button; the line is the control.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25:11", "the verse's margin", fill="bg")
    verse_box(p, [(" ".join(WORDS11[:5]), "hl"), (" ".join(WORDS11[5:]), None)])
    text(p, "MARGIN NOTES · AS THEY WERE IN MARCH 2025", "label", "muted")
    para(p, MINE + " (then).", "body", "muted")
    tl = row(p, "timeline", gap=0, pad=[16, 0, 0, 0], W="fill", align="min", stroke="line", strokeTopWeight=0,
             strokeBottomWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    for label, on in (("2024 · highlighted", False), ("Mar 2025 · a margin note", True), ("Jan 2026 · a question", False),
                      ("Nov 2026 · answered", False), ("now", False)):
        ev = col(tl, label, gap=6, W="fill", crossAlign="center")
        track = row(ev, "track", gap=0, W="fill", align="center")
        frame(track, "seg", w=10, h=2, fill="line", W="fill", H="fixed")
        K.F.dot(track, "accent" if on else "muted", 14 if on else 10)
        frame(track, "seg", w=10, h=2, fill="line", W="fill", H="fixed")
        text(ev, label, "smallStrong" if on else "caption", "accent" if on else "muted")

    f = Q.win(r, PG, "M19 · The photograph, with its date as a scale",
              "In a page, the passage with your marks carries the same thin line under it: left is the first mark, "
              "right is now. Set it once and the block keeps that date, so a lesson can show the passage as you had "
              "marked it then. The dots are where your marks changed.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    blk = col(p, "scripture block", gap=10, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface",
              W="fill")
    hd = row(blk, "head", gap=10, W="fill")
    text(hd, "Numbers 25:10–13 · with your marks as of March 2025", "smallStrong", W="fill")
    K.F.verses(blk, NUM25, "readSmall", {11: {"hl": "green"}})
    line_ = row(blk, "scale", gap=0, W="fill", align="center")
    for on in (False, True, False, False):
        frame(line_, "seg", w=10, h=2, fill="line", W="fill", H="fixed")
        K.F.dot(line_, "accent" if on else "muted", 12 if on else 8)
    frame(line_, "seg", w=10, h=2, fill="line", W="fill", H="fixed")
    text(line_, "  now", "caption", "muted")


# ---- filters without chips -----------------------------------------------------------------------------------------

def filters(cv):
    r = row(cv, "filters", gap=64, align="min")
    f = Q.win(r, PG, "M21 · Filters: one menu in the search field",
              "The search field begins with what it searches: Everything, as plain text with a small arrow. The menu lists "
              "the kinds, each with its count (Everything, Pages, Saves, Questions, Margin notes, Highlights), and a "
              "check; the field then reads Questions · open. Nothing sits under the field, and nothing else "
              "filters: no chips, no side list.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Library", None, fill="bg")
    fld = row(p, "field", gap=8, pad=[0, 6, 0, 6], radius=8, stroke="accent", sw=1, fill="surface", W="fill",
              H="fixed")
    Q.put(fld, 0, 0, None, 40)
    dd = row(fld, "kind", gap=4, pad=[4, 4, 4, 8])   # plain text with a small arrow, not a filled pill
    text(dd, "Questions · open", "smallStrong", "accent")
    icon(dd, "down", 12, "accent")
    text(fld, "Search", "small", "muted", W="fill")
    mn = K.floating(f, "menu", w + 24, TB + 120, 280, gap=1)
    for n, ic, c_, on in (("Everything", "search", "336", False), ("Pages", "page", "75", False),
                          ("Saves", "bookmark", "23", False), ("Questions", "question", "12", True),
                          ("Margin notes", "pen", "86", False), ("Highlights", "highlight", "140", False)):
        K.line(mn, n, None, ic, right=c_, on=on)
    K.rule(mn)
    K.line(mn, "Open only", None, "check", on=True)


# ==== Round 3 (2026-11-12): a page's scripture overview; the margin as the verse's store ===============================

PS106 = K.verses_of(K.fetch(HERE, "ps106-30-31", ["text", "Ps 106:30-31"], as_json=False))
OVERVIEW = [("Numbers 25:11", "a word block"), ("Numbers 25:13", "named in ¶1"),
            ("Psalms 106:30–31", "a scripture block"), ("John 2:17", "named in ¶2"), ("Romans 10:2", "named in ¶3")]


def overview(p, narrow=False, open_=True):
    box = col(p, "scripture in this page", gap=6, pad=[10, 12, 10, 12], radius=10, fill="sunken", W="fill")
    hd = row(box, "head", gap=8, W="fill")
    icon(hd, "book", 16, "accent")
    text(hd, f"Scripture in this page · {len(OVERVIEW)}", "smallStrong", W="fill")
    icon(hd, "down" if open_ else "right", 14, "muted")
    if not open_:
        strip = row(box, "strip", gap=6, wrap=True, W="fill")
        for ref, _ in OVERVIEW:
            text(strip, ref + " ·", "caption", "accent")
        return box
    for ref, where in OVERVIEW:
        it = row(box, ref, gap=8, pad=[3, 4, 3, 4], W="fill")
        text(it, ref, "smallStrong" if not narrow else "small", "accent", W="fill")
        if not narrow:
            text(it, where, "caption", "muted")
        icon(it, "right", 14, "muted")   # the arrow opens the text; the row itself opens the place in the page
    return box


def linked_para(p, ref):
    """A paragraph placeholder that ends with a reference drawn as a link."""
    fl = frame(p, "paragraph", layout="horizontal", wrap=True, gap=5, crossGap=2, W="fill", H="hug")
    text(fl, MINE + ",", "body", "muted")
    lk = row(fl, "link", gap=0, pad=[0, 0, 1, 0], stroke="accent", strokeBottomWeight=1, strokeTopWeight=0,
             strokeLeftWeight=0, strokeRightWeight=0)
    text(lk, ref, "body", "accent")


def page_body(p):
    """A page naming five places: a word block (25:11), a paragraph ending in 25:13, a scripture block (Psalms
    106:30-31), a paragraph ending in John 2:17, another ending in Romans 10:2."""
    para(p, MINE + ".", "body", "muted")
    linked_para(p, "Numbers 25:13")
    blk = col(p, "scripture block", gap=6, pad=[12, 14, 12, 14], radius=10, stroke="line", sw=1, fill="surface",
              W="fill")
    text(blk, "Psalms 106:30–31", "smallStrong")
    K.F.verses(blk, PS106, "readSmall")
    linked_para(p, "John 2:17")
    wb_ = row(p, "word block", gap=10, pad=[10, 14, 10, 14], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    icon(wb_, "word", 16, "accent")
    text(wb_, "zealous · H7065", "smallStrong")
    text(wb_, "from Numbers 25:11", "caption", "muted", W="fill")
    linked_para(p, "Romans 10:2")


def overview_part(cv):
    r = row(cv, "overview", gap=64, align="min")
    f = Q.win(r, PG, "M22 · A page's scripture overview",
              "Every scripture the page names, in Bible order, at the top: what a scripture block shows, a "
              "reference in a sentence, a word block's verse. Every reference counts. Each opens the place in the page where it is named; "
              "the arrow beside it opens the text. Found from the page's text each time; nothing typed into it. "
              "This list is the page's tether to the text.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    overview(p)
    page_body(p)

    f = Q.win(r, PG, "M23 · The overview in a narrow pane",
              "In a narrow pane it folds to one line of references that wraps; a click on the line opens the full "
              "list over the page. Scrolling the page leaves it behind; a small book button in the pane's head brings "
              "it back.")
    w = K.app(f)
    K.reader(f, w, W - w - 420, NUM25, "Numbers 25")
    p = K.M.pane(f, W - 420, TB, 420, H - TB, ["Numbers 25", "Tuesday study"], "Tuesday study")
    hd = row(p, "pane head", gap=8, W="fill")
    text(hd, "Tuesday study", "title", W="fill")
    P.icon_button(hd, "book", "accent", size=28, icon_size=16)   # brings the overview back after scrolling
    overview(p, narrow=True, open_=False)
    page_body(p)


COUNTS_25_11 = (("3 pages name it", "page", True), ("saved in 2", "bookmark", False),
                ("2 marks", "highlight", False), ("1 margin note on 25:10–13", "list", False))


def verse_margin_body(p, open_list=True, ref="Numbers 25:11", verse=None, counts=COUNTS_25_11, folded=False):
    """M25's body: the verse, its margin notes, then one line of counts (each opens its list). Used wherever the verse's
    margin is drawn (M25, M37, M42, M43, M44), so they cannot drift apart. folded=True: only the verse and the counts
    line (the margin notes and the lists are drawn folded by the caller, as in M37)."""
    text(p, ref, "title")
    para(p, V11 if verse is None else verse, "readSmall")
    if not folded:
        text(p, "MARGIN NOTES", "label", "muted")
        for _ in range(2):
            para(p, MINE + ".", "small", "muted")
        K.rule(p)
    ln = row(p, "counts", gap=10, wrap=True, W="fill")
    for c_, ic, on in counts:
        it = row(ln, c_, gap=4)
        icon(it, ic, 14, "accent" if on else "muted")
        text(it, c_, "smallStrong" if on else "small", "accent" if on else "muted")
    if open_list and not folded:
        lst = col(p, "open list", gap=2, pad=[4, 0, 0, 8], W="fill", stroke="line", strokeLeftWeight=2,
                  strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
        for n_ in ("Phinehas", "Zeal", "Tuesday study"):
            text(lst, n_, "small")


def names_margin(f, x, w, hover=True, hx=None, top=TB, ys=(146, 321)):
    """M26: the reader's margin (a mark and a name per verse) in a column at x, w wide; the hover card in the margin
    under the first row. ys: the window y of the first line of verses 11 and 13 in the reader beside it (read off the
    drawn reader), so each mark sits level with its verse."""
    mg = col(f, "margin", gap=0, pad=[0, 14, 0, 14], W="fixed", H="fixed", stroke="line",
             strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, x, top, w, H - top)

    def mark(v, label):
        def b(it):
            icon(it, "pen", 14, "accent")
            text(it, v, "caption", "muted")
            text(it, label, "small")
        return b
    level_rows(mg, [(ys[0], mark("25:11", "2 margin notes · 3 pages")), (ys[1], mark("25:13", "1 margin note"))], top)
    if hover:
        c = K.floating(f, "hover", x + 10 if hx is None else hx, ys[0] + 22, 300, gap=4)
        text(c, "Numbers 25:11", "smallStrong")
        para(c, MINE + "…", "small", "muted")
        para(c, MINE + "…", "small", "muted")
        text(c, "3 pages name it · saved in 2", "caption", "muted")
    return mg


def ask_block(parent):
    """M27's two choices, asked once after the first words."""
    ask = col(parent, "ask", gap=6, pad=[10, 10, 10, 10], radius=8, fill="surface", stroke="line", sw=1, W="fill")
    text(ask, "Where does this go?", "smallStrong")
    P.button(ask, "Leave in the margin", "primary", size="sm", W="fill")
    P.button(ask, "Add to a new page", "secondary", size="sm", W="fill")
    rr = row(ask, "remember", gap=6)
    frame(rr, "box", w=14, h=14, radius=3, stroke="line", sw=1.5, W="fixed", H="fixed")
    text(rr, "Remember my choice", "caption", "muted")
    return ask


def asks_where(f, x, w):
    """M27: writing in the margin (column at x, w wide) asks once where it goes."""
    mg = col(f, "margin", gap=10, pad=[150, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, x, TB, w, H - TB)
    margin_note(mg, "25:11", 1, editing=True)
    ask_block(mg)
    return mg


def margin_part(cv):
    r = row(cv, "margin", gap=64, align="min")
    f = Q.win(r, PG, "M25 · The verse opened in the margin",
              "Open in the margin (a click on a verse number's margin mark, or M) opens the verse's margin beside "
              "the reader: the verse, your margin notes, then what refers to it in one line of counts, each "
              "opening its list: pages that name it, saves, its marks, and margin notes on the passage and "
              "chapter it is in.")
    w = K.app(f)
    K.reader(f, w, W - w - 420, NUM25, "Numbers 25", sel=(11, 0, 999))
    p = K.M.pane(f, W - 420, TB, 420, H - TB, ["Numbers 25", "Margin · 25:11"], "Margin · 25:11")
    verse_margin_body(p)

    f = Q.win(r, PG, "M26 · In the reader: names first, lines on hover",
              "The reader's right margin starts plain: a small mark and a name per verse. Hover shows the first "
              "lines of the margin notes and the counts; a click opens the margin as in M25.")
    w = K.app(f)
    K.reader(f, w, W - w - 320, NUM25, "Numbers 25")
    names_margin(f, W - 320, 320, hx=W - 310)

    f = Q.win(r, PG, "M27 · Writing in the margin asks where",
              "After the first words, Enter asks once: Leave in the margin (it stays with the verse) or Add to a new "
              "page (a page whose first line names the verse, so it is listed here). Remember my choice stops the "
              "asking.")
    w = K.app(f)
    K.reader(f, w, W - w - 320, NUM25, "Numbers 25", sel=(11, 0, 999))
    asks_where(f, W - 320, 320)

    r = row(cv, "wider", gap=64, align="min")
    f = Q.win(r, PG, "M28 · Margin notes on a passage or a chapter",
              "Select verses 10–13 and write: the margin note stays with that passage. A chapter has a margin too "
              "(beside its title). A verse's margin lists the margin notes of the passages and chapter it is in, "
              "smaller, under its own: here verse 11's margin, opened beside the passage's, lists the passage's note "
              "under \"On Numbers 25:10–13\".")
    w = K.app(f)
    vw = 270   # verse 11's own margin, opened beside the passage's
    K.reader(f, w, W - w - 320 - vw, NUM25, "Numbers 25")
    vm = col(f, "verse 11's margin", gap=10, pad=[24, 14, 16, 14], W="fixed", H="fixed", stroke="line",
             strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(vm, W - 320 - vw, TB, vw, H - TB)
    text(vm, "Verse 11's margin", "label", "muted")
    margin_note(vm, "25:11", 1)
    text(vm, "On Numbers 25:10–13", "caption", "muted")
    sm = col(vm, "passage note", gap=2, pad=[6, 8, 6, 8], radius=6, W="fill", stroke="line", sw=1, strokeLeftWeight=2,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    text(sm, "25:10–13", "caption", "accent")
    text(sm, MINE + "…", "caption", "muted")
    mg = col(f, "margin", gap=10, pad=[24, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 320, TB, 320, H - TB)
    margin_note(mg, "Numbers 25 (the chapter)", 1)
    br = row(mg, "bracket", gap=8, align="min", W="fill")
    frame(br, "bracket line", w=3, h=260, radius=2, fill="accentSoft", W="fixed", H="fixed")
    inner = col(br, "passage", gap=8, W="fill")
    margin_note(inner, "25:10–13", 2)
    margin_note(inner, "25:11", 1)



# ==== Round 4 (2026-11-12): margin notes and pages; Margin notes in the Library ============================================

JOT = MINE


def jot(parent, ref, grew=None, long_=False, q=False, editing=False):
    b = col(parent, f"jot/{ref}", gap=4, pad=[8, 10, 8, 10], radius=8, W="fill", fill="surface" if editing else None,
            stroke="accent" if editing else "line", sw=1, strokeLeftWeight=2, strokeRightWeight=1 if editing else 0,
            strokeTopWeight=1 if editing else 0, strokeBottomWeight=1 if editing else 0)
    hd = row(b, "head", gap=6, W="fill")
    if q:
        icon(hd, "question", 12, "question")
    text(hd, ref, "caption", "accent", W="fill")
    icon(hd, "more", 14, "muted")
    for _ in range(4 if long_ else 1):
        para(b, JOT + ("." if not long_ else ","), "small", "muted")
    if grew:
        g = row(b, "grew", gap=6)
        icon(g, "right", 12, "accent")
        text(g, f"grew into {grew}", "caption", "accent")
    return b


def reader_margin(f, w, sel=None, mw=320):
    K.reader(f, w, W - w - mw, NUM25, "Numbers 25", sel=sel)
    mg = col(f, "margin", gap=10, pad=[150, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - mw, TB, mw, H - TB)
    return mg


# the library as drawn: 86 margin notes in 10 books (the books' counts add up)
NOTE_BOOKS = [("Genesis", 11), ("Exodus", 3), ("Numbers", 9), ("Psalms", 21), ("Isaiah", 7), ("Matthew", 6),
              ("John", 14), ("Acts", 4), ("Romans", 9), ("Hebrews", 2)]
assert sum(n for _, n in NOTE_BOOKS) == 86
LIB_FOLDERS = [("Phinehas", "threadA"), ("Phinehas echoes", "threadB"), ("Salt", "ok"), ("Anna", "accent"),
               ("Findings to sort", "muted")]


def library_side(f, w, on="Margin notes", counts=("2", "75", "86", "5", "4"), open_notes=False):
    """The Library's list: PINNED, FOLDERS, PAGES, then two folded rows at the foot, MARGIN NOTES and THE SHELF (a row
    with a count and a small arrow, not a heading); a folder with a color shows its dot. counts = (pinned, pages,
    margin notes, folders, shelf). open_notes: the Margin notes row open, showing books with counts."""
    side = K.panel(f, w, TB, 280, H - TB, "Library", None, fill="sunken")
    P.field(side, "Search the Library", height=34)
    c_pin, c_pg, c_mn, c_fo, c_sh = counts
    lst = col(side, "list", gap=2, W="fill")

    def head(name, n):
        hd = row(lst, name, gap=8, pad=[8, 10, 2, 10], W="fill")
        text(hd, name, "label", "muted", W="fill")
        text(hd, n, "caption", "muted")

    head("PINNED", c_pin)
    for n_ in ("Tuesday study", "Word studies"):
        K.line(lst, n_, None, "bookmark")
    head("FOLDERS", c_fo)
    for n_, col_ in LIB_FOLDERS:
        it = row(lst, f"folder/{n_}", gap=10, pad=[6, 10, 6, 10], radius=8, W="fill")
        K.F.dot(it, col_, 12)
        text(it, n_, "body", W="fill")
    if c_fo != "5":
        text(lst, "   Show all " + c_fo, "caption", "accent")
    head("PAGES", c_pg)
    for n_ in ("Zeal", "Haste study"):
        K.line(lst, n_, None, "page")
    text(lst, "   Show all " + c_pg, "caption", "accent")
    frame(side, "space", w=1, h=1, W="fixed", H="fill")
    foot = col(side, "folded rows", gap=2, W="fill")

    def fold(name, n, ic, is_on, is_open):
        it = row(foot, f"folded/{name}", gap=10, pad=[8, 10, 8, 10], radius=8, W="fill",
                 fill="accentSoft" if is_on else None)
        icon(it, ic, 18, "accent" if is_on else "muted")
        text(it, name, "bodyStrong" if is_on else "body", W="fill")
        text(it, n, "caption", "muted")
        icon(it, "down" if is_open else "right", 14, "muted")

    fold("Margin notes", c_mn, "pen", on == "Margin notes", open_notes)
    if open_notes:
        for b, n in NOTE_BOOKS[:6]:
            sub = row(foot, f"book/{b}", gap=10, pad=[3, 10, 3, 38], W="fill")
            text(sub, b, "small", W="fill")
            text(sub, str(n), "caption", "muted")
        text(foot, f"      and {len(NOTE_BOOKS) - 6} more books", "caption", "accent")
    fold("The Shelf", c_sh, "shelf", on == "Shelf", False)
    return side


def round4(board):
    cv = Q.section(board, "Margin notes and pages", 3200)
    Q.sheet_title(cv, "Margin notes and pages; Margin notes in the Library",
                  "The margin holds margin notes; the Notebook holds pages. Margin notes in the Library, in the "
                  "Bible's order (M30, M31); a margin note's menu (M32); a margin note grown into a page, with its "
                  "seed block (M33) and the line left in the margin (M34); adding a margin note to a page that "
                  "exists (M35).")
    r = row(cv, "library", gap=64, align="min")
    f = Q.win(r, PG, "M30 · Margin notes in the Library",
              "The Library's list, in its order: Pinned, Folders (a folder with a color shows its dot), Pages, and "
              "two folded rows at the foot, Margin notes and the Shelf. Margin notes (opened here, its arrow down) "
              "are every margin note in the Bible's order, never sorted into folders: books open to chapters, with "
              "how many each holds. The Library's search reaches them like everything else.")
    w = K.app(f, on="Notebook")
    library_side(f, w, open_notes=True)
    p = K.panel(f, w + 280, TB, W - w - 280, H - TB, "Margin notes", "86 margin notes in 10 books · in the Bible's order",
                fill="bg")
    for book, n in NOTE_BOOKS:
        open_ = book == "Numbers"
        it = row(p, book, gap=10, pad=[8, 10, 8, 10], radius=8, W="fill", fill="surface" if open_ else None)
        icon(it, "down" if open_ else "right", 14, "muted")
        text(it, book, "bodyStrong" if open_ else "body", W="fill")
        text(it, f"{n} margin notes", "caption", "muted")
        if open_:
            for ch, c_ in (("Numbers 22", 4), ("Numbers 25", 4), ("Numbers 31", 1)):
                sub = row(p, ch, gap=10, pad=[6, 10, 6, 40], W="fill")
                text(sub, ch, "small", W="fill")
                text(sub, f"{c_}", "caption", "muted")

    f = Q.win(r, PG, "M31 · A chapter's margin notes",
              "Numbers 25 opened: each margin note under its verse or passage, with the verse's first words so it "
              "reads in place. A click opens the reader at that verse with its margin open; nothing here is edited in a "
              "second way.")
    w = K.app(f, on="Notebook")
    library_side(f, w)
    p = K.panel(f, w + 280, TB, W - w - 280, H - TB, "Numbers 25", "4 margin notes", fill="bg")
    seen = set()
    for v, grew, q in ((("25:1–3"), None, False), ("25:11", "Phinehas", False), ("25:11", None, True),
                       ("25:13", None, False)):
        vv = int(v.split(":")[1].split("–")[0])
        first = next((x["text"] for x in NUM25 if x["v"] == vv), None)
        head = col(p, f"at {v}", gap=4, W="fill")
        if first and vv not in seen:
            text(head, first.split(",")[0] + "…", "readSmall", "muted")
        seen.add(vv)
        jot(head, f"Numbers {v}", grew=grew, q=q)

    r = row(cv, "growing", gap=64, align="min")
    f = Q.win(r, PG, "M32 · A margin note's menu",
              "A margin note's menu (its three dots): Grow into a page, Add to a page…, Make it a question, Delete. "
              "The menu opens under the note, in the margin, and is the only place these are: the margin never "
              "offers or asks anything on its own, however long a note gets.")
    w = K.app(f)
    mg = reader_margin(f, w, sel=(11, 0, 999))
    jot(mg, "Numbers 25:11", long_=True, editing=True)
    mn = K.floating(f, "menu", W - 14 - 250, TB + 280, 250, gap=1)
    for lbl, ic, on in (("Grow into a page", "page", True), ("Add to a page…", "notebook", False),
                        ("Make it a question", "question", False), ("Delete", "trash", False)):
        K.line(mn, lbl, None, ic, on=on)

    f = Q.win(r, PG, "M33 · The page a margin note grew into",
              "A new page starts with the margin note as its seed: quoted, linked, and naming its verse, so the "
              "overview lists it. The seed shows the margin note as it is now; editing it here edits the margin "
              "note. You write on beneath it.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Phinehas", "a new page", fill="bg")
    ov = col(p, "overview", gap=4, pad=[8, 12, 8, 12], radius=10, fill="sunken", W="fill")
    hd = row(ov, "head", gap=8, W="fill")
    icon(hd, "book", 14, "accent")
    text(hd, "Scripture in this page · 1", "smallStrong", W="fill")
    text(ov, "Numbers 25:11 · the seed", "small", "accent")
    seed = col(p, "seed block", gap=4, pad=[10, 14, 10, 14], radius=8, fill="surface", W="fill", stroke="accent",
               strokeLeftWeight=3, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    sh = row(seed, "head", gap=6)
    icon(sh, "pen", 12, "accent")
    text(sh, "From the margin at Numbers 25:11", "caption", "accent")
    para(seed, JOT + ".", "body", "muted")
    para(p, MINE + ", working the thought out.", "body", "muted")
    para(p, MINE + ".", "body", "muted")

    f = Q.win(r, PG, "M34 · The margin after",
              "The margin note is still where you wrote it, as in a paper Bible after the notebook took the thought "
              "further. Under it, grew into Phinehas, a link to the page. The margin also lists Phinehas among the pages that "
              "name the verse, once.")
    w = K.app(f)
    mg = reader_margin(f, w)
    jot(mg, "Numbers 25:11", grew="Phinehas")
    jot(mg, "Numbers 25:11", q=True)
    t = row(mg, "pages", gap=6)
    icon(t, "down", 12, "accent")
    icon(t, "page", 12, "accent")
    text(t, "3 pages name it", "caption", "accent")
    lst = col(mg, "pages list", gap=2, pad=[2, 0, 0, 10], W="fill", stroke="line", strokeLeftWeight=2,
              strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    for n_ in ("Phinehas", "Zeal", "Tuesday study"):   # Phinehas, the page it grew into, counted once
        text(lst, n_, "small")

    r = row(cv, "adding", gap=64, align="min")
    f = Q.win(r, PG, "M35 · Adding a margin note to a page that exists",
              "Add to a page… lists the pages that already name this verse first, then the last pages you wrote in, "
              "then a search. The seed goes at the page's end (or where you choose in the page); the margin's line "
              "names that page.")
    w = K.app(f)
    mg = reader_margin(f, w)
    jot(mg, "Numbers 25:11", editing=True)
    pk = K.floating(f, "picker", W - 14 - 292, TB + 240, 292, gap=2)
    text(pk, "Add to a page", "smallStrong")
    P.field(pk, "Find a page", height=32)
    text(pk, "NAME NUMBERS 25:11", "label", "muted")
    K.line(pk, "Phinehas", None, "page", on=True)
    K.line(pk, "Zeal", None, "page")
    text(pk, "WRITTEN IN LATELY", "label", "muted")
    K.line(pk, "Tuesday study", None, "page")


# ==== Round 5 (2026-11-12): a full vault, fifteen years on =========================================================
# A projection, not anyone's data: the study folder held about 121 pages and 9 threads on 2026-11-12. Drawn here at
# roughly 2,400 pages, 3,100 margin notes, 18,000 highlights and 140 folders: what a teacher or preacher could have after
# fifteen years of weekly lessons and daily reading. Counts are drawn samples; scripture is fetched.

JOHN3 = K.verses_of(K.fetch(HERE, "john3-14-21", ["text", "John 3:14-21"], as_json=False))
DENSE = {14: {"hl": "yellow"}, 15: {"hl": "yellow", "threads": {2: ["threadA"], 3: ["threadA"]}},
         16: {"hl": "green", "threads": {k: ["threadB"] for k in range(0, 8)}},
         17: {"hl": "blue"}, 18: {"hl": {0: "pink", 1: "pink", 2: "pink"}}, 19: {"hl": "orange"},
         20: {"threads": {k: ["threadA"] for k in range(3, 9)}}, 21: {"hl": "green"}}
# per verse: margin notes, pages naming it, saves
LOAD = {14: (3, 18, 2), 15: (2, 11, 1), 16: (41, 312, 9), 17: (6, 44, 2), 18: (2, 9, 0), 19: (4, 15, 1),
        20: (1, 6, 0), 21: (3, 12, 1)}


def round5(board):
    cv = Q.section(board, "A full vault", 3200)
    Q.sheet_title(cv, "A full vault, fifteen years on (round 5)",
                  "A projection of a teacher's study after fifteen years (about 2,400 pages, 3,100 margin "
                  "notes, 18,000 highlights, 140 folders). The busiest chapter in the reader (M36); the margin of a "
                  "verse with 41 margin notes and 312 pages (M37); the Library's Margin notes as a map of the Bible "
                  "(M38); a long lesson's overview (M39); the Library's search over everything (M40).")
    r = row(cv, "reader", gap=64, align="min")
    f = Q.win(r, PG, "M36 · The busiest chapter in the reader",
              "John 3 after fifteen years. The margin never lists everything: one line per verse, the counts only "
              "(margin notes · pages · saves), so a verse with 312 pages takes the same line as one with 6. The words carry "
              "their colors and lines; the marks panel can hide any kind. Reading stays first.")
    w = app_at(f, "John 3")
    K.reader(f, w, W - w - 300, JOHN3, "John 3", marks=DENSE)
    mg = col(f, "margin", gap=0, pad=[0, 14, 0, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 300, TB, 300, H - TB)

    def counts(v):   # the counts line for verse v, beside that verse
        def b(it):
            j, pg, sv = LOAD[v]
            text(it, f"3:{v}", "caption", "accent")
            text(it, f"{j} margin notes · {pg} pages" + (f" · {sv} saved" if sv else ""), "caption",
                 "fg" if v == 16 else "muted")
        return b
    # window y of each verse's first line in the reader beside it (read off the drawn reader)
    JOHN_Y = {14: 145, 15: 182, 16: 220, 17: 294, 18: 364, 19: 436, 20: 507, 21: 580}
    level_rows(mg, [(JOHN_Y[v], counts(v)) for v in range(14, 22)], TB)

    f = Q.win(r, PG, "M37 · One verse's margin: 41 margin notes, 312 pages",
              "John 3:16 opened in the margin. Margin notes come first, newest first, folded by year: the years read "
              "like rings, and a year opens to its margin notes. Pages that name it are not listed by the hundred: they are "
              "grouped by folder with counts, with a search to narrow them. The margin notes that grew show where to.")
    w = app_at(f, "John 3")
    K.reader(f, w, W - w - 460, JOHN3, "John 3", marks=DENSE)
    p = K.M.pane(f, W - 460, TB, 460, H - TB, ["John 3", "Margin · 3:16"], "Margin · 3:16")
    p16 = next(x["text"] for x in JOHN3 if x["v"] == 16)
    verse_margin_body(p, ref="John 3:16", verse=p16, folded=True,
                      counts=(("312 pages name it", "page", True), ("saved in 9", "bookmark", False),
                              ("41 margin notes", "pen", False)))
    P.field(p, "Search this verse's margin", height=32)
    text(p, "MARGIN NOTES · 41", "label", "muted")
    for yr, n, open_ in (("2041", 3, True), ("2039", 5, False), ("2034", 9, False), ("2030", 11, False),
                         ("2026–2029", 13, False)):
        it = row(p, yr, gap=8, pad=[4, 4, 4, 4], W="fill")
        icon(it, "down" if open_ else "right", 12, "muted")
        text(it, yr, "smallStrong" if open_ else "small", W="fill")
        text(it, f"{n}", "caption", "muted")
        if open_:
            for g in ("Sunday lesson, 12 March", None):
                jot(p, "John 3:16", grew=g)
    text(p, "PAGES THAT NAME IT · 312", "label", "muted")
    for fo, n in (("Sunday lessons", 128), ("Word studies", 74), ("Salt", 89), ("Not in a folder", 21)):
        it = row(p, fo, gap=8, pad=[3, 4, 3, 4], W="fill")
        icon(it, "folder", 14, "muted")
        text(it, fo, "small", W="fill")
        text(it, str(n), "caption", "muted")

    r = row(cv, "library", gap=64, align="min")
    f = Q.win(r, PG, "M38 · Margin notes as a map of the Bible",
              "With 3,100 margin notes, a list of books is not enough to see where you have lived. Margin notes "
              "opens as a map: every book a bar, as long as its chapters, shaded by how many margin notes each "
              "chapter holds. A click opens that chapter's margin notes (M31). Where you have never written is as plain as where you have.")
    w = K.app(f, on="Notebook")
    library_side(f, w, counts=("6", "2,400", "3,100", "140", "310"))
    p = K.panel(f, w + 280, TB, W - w - 280, H - TB, "Margin notes", "3,100 margin notes in 61 books · darker: more",
                fill="bg")
    import random
    rnd = random.Random(7)
    books = [("Genesis", 50), ("Exodus", 40), ("Numbers", 36), ("Psalms", 150), ("Proverbs", 31), ("Isaiah", 66),
             ("Matthew", 28), ("John", 21), ("Acts", 28), ("Romans", 16), ("Hebrews", 13), ("Revelation", 22)]
    for name, chs in books:
        it = row(p, name, gap=10, W="fill")
        lab = row(it, "label", gap=0, W="fixed")
        S.do("node.set", {"ids": [lab], "props": {"width": 90}}, ref=False)
        text(lab, name, "caption", "muted")
        bar = row(it, "chapters", gap=1, W="fill")
        for c_ in range(min(chs, 75)):
            heat = rnd.random() ** (1.5 if name not in ("John", "Romans", "Psalms") else 0.6)
            fill = "line" if heat < 0.25 else "hlYellow" if heat < 0.5 else "threadA" if heat < 0.8 else "accent"
            frame(bar, f"c{c_ + 1}", w=10, h=14, radius=1, fill=fill, W="fill", H="fixed")
    text(p, "…and 49 more books, the same way", "caption", "muted")

    f = Q.win(r, PG, "M39 · A long lesson's scripture overview",
              "A lesson series page naming 86 scriptures. The overview folds to books with counts (Genesis 4 · "
              "Exodus 2 · … Romans 19), in the Bible's order; a book opens to its references. The page itself stays "
              "the same; only the overview gains the extra level.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Romans: a 12-week series", "a page (a drawn sample)", fill="bg")
    ov = col(p, "overview", gap=6, pad=[10, 12, 10, 12], radius=10, fill="sunken", W="fill")
    hd = row(ov, "head", gap=8, W="fill")
    icon(hd, "book", 16, "accent")
    text(hd, "Scripture in this page · 86 in 14 books", "smallStrong", W="fill")
    strip = row(ov, "books", gap=10, wrap=True, W="fill")
    for b, n in (("Genesis", 4), ("Exodus", 2), ("Deuteronomy", 3), ("Psalms", 9), ("Isaiah", 6), ("Habakkuk", 1),
                 ("Matthew", 5), ("John", 7), ("Acts", 4), ("Romans", 19), ("1 Corinthians", 6), ("Galatians", 8),
                 ("Ephesians", 7), ("Hebrews", 5)):
        it = row(strip, b, gap=4)
        text(it, b, "small", "accent" if b == "Romans" else "fg")
        text(it, str(n), "caption", "muted")
    text(ov, "Romans 1:16–17 · 3:21–26 · 5:1–11 · 6:1–14 · 8:1–39 · … 14 more", "caption", "accent")
    for _ in range(4):
        para(p, MINE + ".", "body", "muted")

    r = row(cv, "search", gap=64, align="min")
    f = Q.win(r, PG, "M40 · Searching everything",
              "“Phinehas” across 2,400 pages, 3,100 margin notes and 140 folders. Results come grouped by kind with counts "
              "(the filter menu, M21), best matches first, and the menu narrows to one kind. Each result shows where "
              "it is (a folder, a verse). Typing a place (Gen 15) jumps to that place's margin instead.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Library", None, fill="bg")
    fld = row(p, "field", gap=8, pad=[0, 6, 0, 6], radius=8, stroke="accent", sw=1, fill="surface", W="fill",
              H="fixed")
    Q.put(fld, 0, 0, None, 40)
    dd = row(fld, "kind", gap=4, pad=[4, 8, 4, 8], radius=6, fill="sunken")
    text(dd, "Everything", "smallStrong")
    icon(dd, "down", 12, "muted")
    text(fld, "Phinehas", "small", W="fill")
    for kind, ic, n, items in (("Pages", "page", 214, [("Phinehas", "Sunday lessons › Numbers"),
                                                       ("Tuesday study", "Word studies")]),
                               ("Margin notes", "pen", 97, [("Numbers 25:11", "a margin note, 2031"),
                                                            ("Psalms 106:30", "a margin note, 2037")]),
                               ("Folders", "folder", 3, [("Phinehas echoes", "41 pages")]),
                               ("Questions", "question", 12, [("a question line", "in Phinehas")])):
        hd = row(p, kind, gap=8, W="fill")
        icon(hd, ic, 14, "muted")
        text(hd, kind.upper(), "label", "muted", W="fill")
        text(hd, f"{n} · show all", "caption", "accent")
        for n_, s_ in items:
            K.line(p, n_, s_, None)


def part(board, name, about):
    cv = Q.section(board, name, 3200)
    Q.sheet_title(cv, name, about)
    return cv


def conditions(cv):
    """M42-M44: the verse's margin (M25's body), the reader's margin (M26) and writing (M27) in the real conditions,
    drawn with the same functions."""
    r = row(cv, "conditions", gap=64, align="min")
    f = Q.win(r, PG, "M42 · Among other tabs",
              "The verse's margin is one tab of four in a side pane (Numbers 25:11, Phinehas, Concordance, Trash), "
              "beside the reader's pane on Numbers 25 (two tabs, Numbers 25 and Psalms 106; the first is in front) "
              "with its margin marks. The margin is M25's, only narrower; the tabs change nothing in it.")
    w = K.app(f)
    sp = 500
    rw = W - w - sp
    K.M.pane(f, w, TB, rw, H - TB, ["Numbers 25", "Psalms 106"], "Numbers 25", side="left", actions=("expand", "close"))
    K.reader(f, w, rw - 300, NUM25, "Numbers 25", top=TB + 40, sel=(11, 0, 999))
    names_margin(f, w + rw - 300, 300, hover=False, top=TB + 40, ys=(185, 396))
    p = K.M.pane(f, W - sp, TB, sp, H - TB, ["Numbers 25:11", "Phinehas", "Concordance", "Trash"], "Numbers 25:11",
                 actions=("close",))
    verse_margin_body(p)

    f = Q.win(r, PG, "M43 · Floating",
              "The verse's margin as a small floating pane (320 wide) over the reader, beside the column of text so "
              "the verse it is about stays in view: the verse, its margin notes, and the line of counts wrapping "
              "whole.")
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25", sel=(11, 0, 999))
    fp = K.floating(f, "floating margin", W - 340, TB + 90, 320, pad=(0, 0, 0, 0), gap=0)
    K.M.folder_strip(fp, ["Numbers 25:11"], "Numbers 25:11", actions=("expand", "close"))
    body = col(fp, "body", gap=12, pad=16, W="fill")
    verse_margin_body(body)

    pw, ph = 390, 844
    f = Q.win(r, PG, "M44 · Narrow",
              "A 390 px phone: the reader keeps its colors and shows its marks folded at the verse number (as M12); "
              "the verse's margin is a sheet over the bottom, reaching the window's bottom edge, with the writing "
              "field and, under it, M27's two choices: Leave in the margin, Add to a new page.", w=pw, h=ph)
    hd = row(f, "top bar", gap=8, pad=[0, 16, 0, 16], fill="bg", W="fixed", H="fixed")
    Q.put(hd, 0, 0, pw, 52)
    text(hd, "Numbers 25", "title")
    rd = frame(f, "reader", x=0, y=52, w=pw, h=ph - 52, layout="vertical", pad=[8, 18, 16, 18], gap=8, W="fixed",
               H="fixed", clip=True)
    folded_verses(rd, 300, verses=(11, 12))
    top = 240
    sh = col(f, "sheet", gap=12, pad=[8, 16, 16, 16], fill="surface", radius=16, stroke="line", sw=1, W="fixed",
             H="fixed", clip=True, crossAlign="center")
    Q.put(sh, 0, top, pw, ph - top)
    K.shadow(sh, 8, 28, "#00000033")
    frame(sh, "grabber", w=40, h=4, radius=2, fill="line", W="fixed", H="fixed")
    inner = col(sh, "sheet body", gap=12, W="fill")
    verse_margin_body(inner, open_list=False)
    margin_note(inner, "25:11", 1, editing=True)
    ask_block(inner)


def sheets(board):
    """The leading windows only, grouped by part (the person, 2026-11-12). Superseded windows (M1-M5, M8-M11, M29) are
    in git history (commit 0d59600) and listed in the README's Leading table. Cut 2026-11-16: M16, M17, M20, M24, M41."""
    margin_part(part(board, "The margin: the verse's margin and store",
                     "Opened beside the reader (M25), names first (M26), writing asks where (M27), a passage's and a "
                     "chapter's margin notes (M28)."))
    round4(board)
    overview_part(part(board, "A page's scripture overview",
                       "Every scripture a page names, at its top (M22) and narrow (M23)."))
    cv = part(board, "Marks on the words",
              "One line under a run (M13), the pencil (M14), a saved phrase in its folder's color (M15).")
    underlines(cv)
    cv = part(board, "A passage with its marks, and history",
              "The photograph of an annotated Bible in a page (M6, M7), the development of your thoughts (M18) and the "
              "photograph's date (M19).")
    passage(cv)
    history(cv)
    crowded(part(board, "Many tabs open", "Marks in a narrow reader (M12)."))
    round5(board)
    filters(part(board, "Filters", "One menu at the start of the search field (M21)."))
    conditions(part(board, "Real conditions",
                    "The verse's margin among other tabs (M42), floating (M43) and on a phone (M44), drawn with the "
                    "same functions as M25-M27. Years of study is M36-M40; many tabs is also M12 and M23."))


if __name__ == "__main__":
    K.run_board(HERE, "Marks", sheets)
