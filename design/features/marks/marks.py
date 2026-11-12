"""Marks, round 1 (2026-11-12). The person's answers to the concept (marks/README.md): a margin note in a printed Bible
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
# highlights; a pencil underline (threads token used for the solid line) on 25:11; dotted = something written on words
MARKS = {11: {"hl": "green", "note": [12, 13, 14, 15]}, 12: {"hl": "yellow"}, 13: {"hl": "yellow"}}
PENCIL = {11: {"hl": "green", "threads": {0: ["threadA"]}, "note": [12, 13, 14, 15]}, 12: {"hl": "yellow"},
          13: {"hl": "yellow"}}
FOLDERS = [("Phinehas", "threadA"), ("Covenant", "accent")]
MINE = "Your own words, as you wrote them"


def text_col(f, x, w, marks, width=600, title="Numbers 25"):
    rd = frame(f, "text", x=x, y=TB, w=w, h=H - TB, layout="vertical", pad=[32, 24, 32, 24], W="fixed", H="fixed",
               clip=True)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": width}}, ref=False)
    text(inner, title, "chapter", fontSize=30, lineHeight="40px")
    K.F.verses(inner, NUM25, "readDesk", marks)
    return rd


def left_saves(f, x):
    """Saves in the left margin (library S8, liked): a ribbon in the folder's color, a number when several."""
    for y, color, n in ((TB + 112, "threadA", 2), (TB + 300, "accent", 1)):
        r_ = row(f, "save", gap=2)
        Q.put(r_, x, y)
        icon(r_, "bookmark", 16, color)
        if n > 1:
            text(r_, str(n), "caption", "muted")


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


def margin(f, x, w, editing=False):
    mg = col(f, "margin", gap=14, pad=[150, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, x, TB, w, H - TB)
    margin_note(mg, "25:11", 3, refs=4, q=True, editing=editing)
    frame(mg, "space", w=10, h=40, W="fixed", H="fixed")
    margin_note(mg, "25:13", 1, refs=1)
    return mg


# ---- M1 the model --------------------------------------------------------------------------------------------------

def box(parent, title, lines, fill="surface", stroke="line", w=300):
    b = col(parent, title, gap=6, pad=[14, 16, 14, 16], radius=12, fill=fill, stroke=stroke, sw=1.5, W="fixed")
    Q.put(b, 0, 0, w)
    text(b, title, "heading")
    for ln in lines:
        para(b, ln, "small", "muted")
    return b


def model(cv):
    r = row(cv, "model", gap=64, align="min")
    f = Q.win(r, PG, "M1 · The model: two layers on the text, one page per verse",
              "Everything you write is a page. A verse's own page holds its notes (what you would write in the margin) "
              "and, under them, every reference to the verse or a word in it, found rather than stored. The margin "
              "shows the verse's page; the words show color and pencil. Folders hold saves; a thread is a folder.")
    body = col(f, "diagram", gap=28, pad=[48, 56, 48, 56], W="fixed", H="fixed")
    Q.put(body, 0, 0, W, H)
    top = row(body, "layers", gap=28, align="min")
    box(top, "On the words", ["Highlight: a color, named if you like (Promises, Commands)",
                              "Pencil underline: emphasis with no meaning, as in a printed Bible",
                              "Dotted underline: something you wrote is on these words"], stroke="hlYellow")
    box(top, "The left margin", ["Saves: a ribbon in the folder's color", "A thread is a folder of saves; its "
                                 "color is the folder's"], stroke="threadA")
    box(top, "The right margin", ["The verse's page: its notes, editable where they sit",
                                  "A count of its references, a click lists them"], stroke="accent")
    arrow = row(body, "arrow", gap=10)
    icon(arrow, "down", 20, "muted")
    text(arrow, "the right margin is a window onto the verse's page; nothing is kept in the margin itself", "small",
         "muted")
    bot = row(body, "pages", gap=28, align="min")
    box(bot, "The verse's page (Numbers 25:11)", ["Notes: yours, written in the margin or in the page",
                                                  "References, found each time it opens:",
                                                  "· pages placed at the verse or a word in it",
                                                  "· pages that mention it in their text",
                                                  "· questions written at it",
                                                  "· folders it is saved in"], fill="accentSoft", stroke="accent",
        w=430)
    box(bot, "Any other page", ["Placed at a verse: listed in that verse's references",
                                "A scripture block: the passage, just the text or with your marks",
                                "A saved list: e.g. open questions (the search's filter)"], w=380)
    box(bot, "The Library", ["Pages, folders, saves: one tree, one search (library S20, S21)",
                             "Questions: a filter of the search, not a section"], w=330)


# ---- M2, M3 the reader -------------------------------------------------------------------------------------------

def reader_windows(cv):
    r = row(cv, "reader", gap=64, align="min")
    f = Q.win(r, PG, "M2 · The reader: saves left, the verse's page right",
              "The right margin shows each verse's page where it has one: the first lines of your notes as you wrote "
              "them (reader R6 showed only names; library S16 the first line; this shows your words, short), a "
              "question line if there is one, and a count of references. Saves stay on the left (S8).")
    w = K.app(f)
    left_saves(f, w + 300)
    text_col(f, w + 320, 660, MARKS)
    margin(f, W - 360, 360)

    f = Q.win(r, PG, "M3 · Writing in the margin writes the verse's page",
              "A click in the margin beside a verse with no page, or on its note, edits right there: it is the "
              "verse's page, so it is connected, searchable and can grow. ⤢ opens the whole page; Enter twice "
              "leaves. The page is made the first time you write, named by its place.")
    w = K.app(f)
    left_saves(f, w + 300)
    text_col(f, w + 320, 660, MARKS)
    mg = margin(f, W - 360, 360, editing=True)
    tl = row(f, "tools", gap=6, pad=[4, 6, 4, 6], radius=8, fill="surface", stroke="line", sw=1)
    Q.put(tl, W - 200, TB + 120)
    P.icon_button(tl, "question", "question", size=26, icon_size=14)
    P.icon_button(tl, "expand", "muted", size=26, icon_size=14)


# ---- M4 the verse's page -------------------------------------------------------------------------------------------

def ref_group(p, title, ic, items):
    text(p, title.upper(), "label", "muted")
    for name, sub in items:
        K.line(p, name, sub, ic)


def verse_page(cv):
    r = row(cv, "verse page", gap=64, align="min")
    f = Q.win(r, PG, "M4 · The verse's page: notes, then references",
              "Opened from the margin (or the verse's right-click: Open this verse's page). The verse at the top, "
              "verbatim; your notes; then References, found each time from the files and the cache: nothing is "
              "copied in, so a new page placed at the verse simply appears here. A word's own pages (zealous, H7065) "
              "show under the word.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25:11", "the verse's page · made when you first wrote", fill="bg")
    vq = col(p, "verse", gap=4, pad=[12, 16, 12, 16], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    para(vq, V11, "readSmall")
    text(vq, "Numbers 25:11 KJV", "caption", "muted")
    text(p, "NOTES", "label", "muted")
    para(p, MINE + " (as many paragraphs, questions, blocks as any page).", "body", "muted")
    K.rule(p)
    rh = row(p, "references head", gap=8, W="fill")
    text(rh, "References", "heading", W="fill")
    text(rh, "found when the page opens; nothing copied in", "caption", "muted")
    cols = row(p, "references", gap=28, align="min", W="fill")
    a = col(cols, "a", gap=6, W="fill")
    ref_group(a, "Pages placed here", "page", [("Phinehas", "at Numbers 25:7–13"), ("Covenant", "at 25:11–13")])
    ref_group(a, "Pages that mention it", "page", [("Tuesday study", "in a paragraph")])
    b = col(cols, "b", gap=6, W="fill")
    ref_group(b, "On words in this verse", "word", [("zealous · H7065", "1 page on the word")])
    ref_group(b, "Questions", "question", [("a question line", "in Phinehas")])
    ref_group(b, "Saved in", "bookmark", [("Phinehas", "a folder"), ("Covenant", "a folder")])


# ---- M5 the underline ----------------------------------------------------------------------------------------------

def mini(parent, title, about, marks, legend):
    c = col(parent, title, gap=10, W="fixed")
    Q.put(c, 0, 0, 420)
    text(c, title, "heading")
    para(c, about, "small", "muted")
    v = col(c, "verse", gap=4, pad=[14, 16, 14, 16], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    K.F.verses(v, [x for x in NUM25 if x["v"] == 11], "readSmall", marks)
    para(c, legend, "caption", "muted")


def underline(cv):
    r = row(cv, "underline", gap=64, align="min")
    f = Q.win(r, PG, "M5 · What an underline means, once threads are folders",
              "Today a colored underline means a thread. If a thread is a folder of saves, the underline is free. "
              "Three meanings, each one a person's own habit can live with. The dotted underline (a page on these "
              "words) stays in all three.")
    body = row(f, "three", gap=36, pad=[48, 40, 48, 40], align="min", W="fixed", H="fixed")
    Q.put(body, 0, 0, W, H)
    mini(body, "U-A · A pencil line", "Emphasis with no meaning: the quick mark you make while reading, before you "
         "know why. One style, one key (U), no menu. Color is for meaning; the pencil is for attention.",
         {11: {"threads": {k: ["fg"] for k in range(0, 6)}}}, "Kept with the highlights, as a highlight with no "
         "color (a style field the Python app passes over).")
    mini(body, "U-B · A saved phrase", "The underline is how a save on words shows: a saved phrase is underlined in "
         "its folder's color, a saved verse gets the ribbon. A thread's verses are underlined because they are "
         "saved in it.", {11: {"threads": {k: ["threadA"] for k in range(0, 6)}}}, "Nothing new kept: it is the "
         "save, drawn on the words.")
    mini(body, "U-C · Your own styles", "Underline, box, circle, wavy: styles you name yourself, like colors "
         "(finding 5a80, the analog Bible). Each is a mark with a meaning you give it, shown in the marks panel "
         "with an eye.", {11: {"threads": {k: ["question"] for k in range(0, 6)}}}, "Kept with highlights: a style "
         "and a name in the palette.")


# ---- M6 a passage in a page, with its marks ------------------------------------------------------------------------

def passage(cv):
    r = row(cv, "passage", gap=64, align="min")
    f = Q.win(r, PG, "M6 · A passage in a page, with your marks",
              "A scripture block's switch: Just the text · With my marks. With marks it is the photograph of your "
              "annotated Bible: the colors and pencil on the words, and a narrow margin with one dot per verse that "
              "has a page, a number when it has references. Nothing more until you hover or click a dot.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    para(p, MINE + ".", "body", "muted")
    blk = col(p, "scripture block", gap=10, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface",
              W="fill")
    hd = row(blk, "head", gap=10, W="fill")
    text(hd, "Numbers 25:10–13", "smallStrong", W="fill")
    P.segmented(hd, ["Just the text", "With my marks"], "With my marks", W="hug")
    body = row(blk, "body", gap=14, align="min", W="fill")
    tx = col(body, "text", gap=4, W="fill")
    K.F.verses(tx, NUM25, "readSmall", PENCIL)
    mg = col(body, "dots", gap=8, pad=[0, 0, 0, 10], W="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    S.do("node.set", {"ids": [mg], "props": {"width": 120}}, ref=False)
    frame(mg, "space", w=10, h=18, W="fixed", H="fixed")
    for v, n in (("25:11", 4), ("25:13", 1)):
        it = row(mg, v, gap=6)
        K.F.dot(it, "accent", 8)
        text(it, f"{v} · {n}", "caption", "muted")
        frame(mg, "space", w=10, h=36, W="fixed", H="fixed")
    ft = row(blk, "foot", gap=8, W="fill")
    text(ft, "Live: shows your marks as they are now", "caption", "muted", W="fill")
    P.chip(ft, "As of a date…", "outline")

    f = Q.win(r, PG, "M7 · A dot opened, inside the page",
              "A click on a dot opens that verse's page in a card over the block (names and your first lines, as in "
              "the reader's margin), so the page you are writing never moves. ⤢ opens the verse's page itself.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    blk = col(p, "scripture block", gap=10, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface",
              W="fill")
    text(blk, "Numbers 25:10–13", "smallStrong")
    K.F.verses(blk, NUM25, "readSmall", PENCIL)
    c = K.floating(f, "verse page card", W - 470, TB + 170, 420)
    hd = row(c, "head", gap=6, W="fill")
    text(hd, "Numbers 25:11", "smallStrong", W="fill")
    P.icon_button(hd, "expand", "muted", size=26, icon_size=14)
    P.icon_button(hd, "close", "muted", size=26, icon_size=14)
    para(c, MINE + "…", "small", "muted")
    for name, ic in (("Phinehas · a page", "page"), ("Covenant · a page", "page"), ("zealous · H7065", "word"),
                     ("a question line", "question")):
        it = row(c, name, gap=8)
        icon(it, ic, 14, "muted")
        text(it, name, "small")


# ---- M8 questions as a filter ---------------------------------------------------------------------------------------

def questions(cv):
    r = row(cv, "questions", gap=64, align="min")
    f = Q.win(r, PG, "M8 · Questions: a filter of the Library's search",
              "The Library's one search (S21) has kind chips under it; Questions · Open lists every open question "
              "line, by place, each opening its page at that line. The same line kept in a page is a saved list.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Library", None, fill="sunken")
    P.field(p, "Search pages, folders and saves")
    ch = row(p, "kinds", gap=6, W="fill")
    for c_, on in (("Pages", False), ("Folders", False), ("Saves", False), ("Questions", True), ("Highlights", False)):
        P.chip(ch, c_, "selected" if on else "outline")
    P.segmented(ch, ["Open", "Answered"], "Open", W="hug")
    text(p, "NUMBERS", "label", "muted")
    for place, where in (("Numbers 25:11", "in the page Numbers 25:11"), ("Numbers 25:13", "in Phinehas")):
        K.line(p, "a question line", f"{place} · {where}", "question")
    text(p, "NO PLACE", "label", "muted")
    K.line(p, "a question line", "in Tuesday study", "question")
    rr = row(p, "keep", gap=8)
    text(rr, "notebook questions open", "caption", "muted")
    P.button(rr, "Keep as a list in a page", "ghost", "plus", size="sm")


# ==== Round 2 (2026-11-12) ===========================================================================================

WORDS11 = V11.split()
STYLE = {  # a run of words drawn as one piece: frame props that make a continuous mark under or around it
    "pencil": dict(stroke="muted", strokeBottomWeight=1.5, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0),
    "save": dict(stroke="threadA", strokeBottomWeight=2.5, strokeTopWeight=0, strokeLeftWeight=0,
                 strokeRightWeight=0),
    "save2": dict(stroke="threadB", strokeBottomWeight=2.5, strokeTopWeight=0, strokeLeftWeight=0,
                  strokeRightWeight=0),
    "box": dict(stroke="accent", sw=1.5, radius=3),
    "circle": dict(stroke="question", sw=1.5, radius=999),
    "double": dict(stroke="ok", strokeBottomWeight=1.5, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0),
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
            pad = [1, 4, 1, 4] if n in ("box", "circle") else [0, 1, 2 if i < len(names) - 1 else 1, 1]
            if n == "circle":
                pad = [2, 9, 2, 9]
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


def narrow_reader(f, x, w, title="Numbers 25"):
    rd = frame(f, "narrow reader", x=x, y=TB, w=w, h=H - TB, layout="vertical", pad=[20, 18, 20, 18], W="fixed",
               H="fixed", clip=True, gap=8)
    Q.put(rd, x, TB + 36, w, H - TB - 36)
    text(rd, title, "chapter", fontSize=22, lineHeight="30px")
    return rd


# ---- verse page: three designs, each narrow ----------------------------------------------------------------------

def vp_head(p):
    text(p, "Numbers 25:11", "title")
    para(p, V11, "readSmall")


def verse_pages(cv):
    r = row(cv, "verse pages", gap=64, align="min")
    f = Q.win(r, PG, "M9 · Verse page A: references as one line that opens",
              "In a narrow pane (420 wide, beside a reader). Your notes first; the references are one quiet line of "
              "counts at the foot (4 pages · 1 word · 1 question · saved in 2). A click on a count opens just that "
              "list, in place. Nothing big unless asked.")
    w = K.app(f)
    K.reader(f, w, W - w - 420, NUM25, "Numbers 25")
    p = K.M.pane(f, W - 420, TB, 420, H - TB, ["Numbers 25", "Numbers 25:11"], "Numbers 25:11")
    vp_head(p)
    text(p, "NOTES", "label", "muted")
    para(p, MINE + ".", "small", "muted")
    K.rule(p)
    ln = row(p, "counts", gap=10, wrap=True, W="fill")
    for c_, ic, on in (("3 pages", "page", True), ("1 word", "word", False), ("1 question", "question", False),
                       ("saved in 2", "bookmark", False)):
        it = row(ln, c_, gap=4)
        icon(it, ic, 14, "accent" if on else "muted")
        text(it, c_, "smallStrong" if on else "small", "accent" if on else "muted")
    lst = col(p, "open list", gap=2, pad=[4, 0, 0, 8], W="fill", stroke="line", strokeLeftWeight=2,
              strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    for n, s_ in (("Phinehas", "at 25:7–13"), ("Covenant", "at 25:11–13"), ("Tuesday study", "mentions it")):
        it = row(lst, n, gap=8, pad=[3, 4, 3, 4], W="fill")
        text(it, n, "small", W="fill")
        text(it, s_, "caption", "muted")

    f = Q.win(r, PG, "M10 · Verse page B: references in the margin of the page",
              "The verse's page laid out like the reader: your notes in the column, the references as small names in "
              "a right margin, beside the line they relate to (a word's page beside the word). When the pane is "
              "narrow the margin folds into the line of counts of A.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25:11", "the verse's page, wide", fill="bg")
    body = row(p, "body", gap=24, align="min", W="fill")
    main = col(body, "column", gap=10, W="fill")
    para(main, V11, "readSmall")
    text(main, "NOTES", "label", "muted")
    for _ in range(3):
        para(main, MINE + ".", "body", "muted")
    mg = col(body, "margin", gap=8, pad=[0, 0, 0, 12], W="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    S.do("node.set", {"ids": [mg], "props": {"width": 240}}, ref=False)
    for n, ic in (("zealous · H7065", "word"), ("Phinehas", "page"), ("Covenant", "page"), ("Tuesday study", "page"),
                  ("a question line", "question"), ("Phinehas · Covenant", "bookmark")):
        it = row(mg, n, gap=6)
        icon(it, ic, 12, "muted")
        text(it, n, "caption", "fg")

    f = Q.win(r, PG, "M11 · Verse page C: no writing, only where it is referenced",
              "Answer 6's other way: a verse has no page of its own to write in. Opening a verse shows the verse and "
              "the list of everything that refers to it, grouped small; to write, you write a page placed there "
              "(New page here), which then joins the list. Less to keep, one kind of writing; but no margin note.")
    w = K.app(f)
    K.reader(f, w, W - w - 420, NUM25, "Numbers 25")
    p = K.M.pane(f, W - 420, TB, 420, H - TB, ["Numbers 25", "Numbers 25:11"], "Numbers 25:11")
    vp_head(p)
    P.button(p, "New page here", "secondary", "plus", size="sm")
    for grp, items in (("Pages", ["Phinehas", "Covenant", "Tuesday study"]), ("On its words", ["zealous · H7065"]),
                       ("Questions", ["a question line · in Phinehas"]), ("Saved in", ["Phinehas", "Covenant"])):
        text(p, grp.upper(), "label", "muted")
        for n in items:
            text(p, n, "small")


# ---- marks with many tabs open -------------------------------------------------------------------------------------

def crowded(cv):
    r = row(cv, "crowded", gap=64, align="min")
    f = Q.win(r, PG, "M12 · Marks in a narrow reader, many tabs open",
              "When a reader is narrow (here a third of the window, with a Concordance and a page open) the margins "
              "fold: saves and pages become one small mark at the verse number (a ribbon, a page corner), the words "
              "keep their colors and pencil. Hover shows the names; a click opens the verse's page in that pane.")
    w = K.app(f)
    third = (W - w) // 3
    K.M.pane(f, w, TB, third, H - TB, ["Numbers 25", "Psalms 106", "Romans 10"], "Numbers 25", side="left")
    rd = narrow_reader(f, w, third)
    for v, spans, marks_ in ((10, [(next(x["text"] for x in NUM25 if x["v"] == 10), None)], ""),
                             (11, [(split11(0, 5)[1], "hl"), (split11(5, 99)[2] if False else " ".join(WORDS11[5:]),
                                                                None)], "bookmark,page"),
                             (12, [(next(x["text"] for x in NUM25 if x["v"] == 12), None)], "bookmark")):
        it = row(rd, f"v{v}", gap=6, align="min", W="fill")
        g = col(it, "gutter", gap=2, W="fixed", crossAlign="center")
        S.do("node.set", {"ids": [g], "props": {"width": 22}}, ref=False)
        text(g, str(v), "caption", "accent")
        for ic in filter(None, marks_.split(",")):
            icon(g, ic, 12, "threadA" if ic == "bookmark" else "accent")
        run_text(it, spans, width=third - 80)
    p2 = K.M.pane(f, w + third, TB, third, H - TB, ["Concordance", "H7065"], "H7065", side="left")
    text(p2, "the Concordance (another pane)", "small", "muted")
    p3 = K.M.pane(f, w + 2 * third, TB, W - w - 2 * third, H - TB, ["Tuesday study"], "Tuesday study")
    text(p3, "a page (another pane)", "small", "muted")
    c = K.floating(f, "hover", w + 60, TB + 150, 250, gap=4)
    text(c, "Numbers 25:11", "smallStrong")
    for n, ic in (("Saved in Phinehas", "bookmark"), ("Your notes · 3 pages refer", "page")):
        it = row(c, n, gap=6)
        icon(it, ic, 12, "muted")
        text(it, n, "caption")


# ---- the underline, expanded ----------------------------------------------------------------------------------------

def underlines(cv):
    r = row(cv, "underlines", gap=64, align="min")
    f = Q.win(r, PG, "M13 · One line under the run, not under each word",
              "A mark on a run of words is drawn as one piece: the line goes under the spaces too, and breaks only "
              "where the line of text breaks. Before (today's per-word lines) and after, on the same words.")
    body = col(f, "body", gap=28, pad=[56, 64, 56, 64], W="fixed", H="fixed")
    Q.put(body, 0, 0, W, H)
    a, m, b = split11(0, 5)
    text(body, "TODAY: A LINE UNDER EACH WORD", "label", "muted")
    v = col(body, "today", gap=4, pad=[14, 16, 14, 16], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    K.F.verses(v, [x for x in NUM25 if x["v"] == 11], "readSmall", {11: {"threads": {k: ["threadA"] for k in range(5)}}})
    text(body, "PROPOSED: ONE LINE UNDER THE RUN", "label", "muted")
    verse_box(body, [(m, "save"), (b, None)])
    text(body, "A RUN THAT CROSSES A LINE BREAK: ONE PIECE ON EACH LINE", "label", "muted")
    a2, m2, b2 = split11(14, 22)
    verse_box(body, [(a2, None), (m2, "save"), (b2, None)], width=520)

    f = Q.win(r, PG, "M14 · U-A, the pencil, at work",
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

    f = Q.win(r, PG, "M15 · U-B, a saved phrase",
              "Saving a run of words underlines it in its folder's color. Saved in two folders: two lines, stacked "
              "close. Hover names the folders. Removing it from the folder takes the line away. A whole verse saved "
              "gets the ribbon in the left margin instead, so lines stay for phrases.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25", "saved phrases", fill="bg")
    a, m, b = split11(0, 5)
    verse_box(p, [(m, "save"), (b, None)])
    a, m, b = split11(23, 30)
    verse_box(p, [(a, None), (m, ["save2", "save"]), (b, None)])
    c = K.floating(f, "hover", W - 460, TB + 330, 280, gap=4)
    text(c, "Saved in", "caption", "muted")
    for n, col_ in (("Phinehas", "threadA"), ("Covenant", "threadB")):
        it = row(c, n, gap=6)
        frame(it, "swatch", w=16, h=3, fill=col_, W="fixed", H="fixed")
        text(it, n, "small")

    f = Q.win(r, PG, "M16 · U-C, your own styles",
              "Styles you make and name, beside the colors: a box, a circle, a double line, the pencil. Each has a "
              "name you choose (here a sample: Promise, Name, Command) and an eye in the marks panel. With them a "
              "printed-Bible habit carries over as it is.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w - 330, H - TB, "Numbers 25", "your own styles", fill="bg")
    a, m, b = split11(23, 30)
    verse_box(p, [(a, None), (m, "box"), (b, None)])
    a, m, b = split11(0, 1)
    verse_box(p, [(m, "circle"), (b, None)])
    a, m, b = split11(10, 17)
    verse_box(p, [(a, None), (m, ["double", "double"]), (b, None)])
    st = K.panel(f, W - 330, TB, 330, H - TB, "Styles", "Name a style once; use it like a color")
    for name, s_ in (("Promise", "box"), ("Name", "circle"), ("Command", ["double", "double"]), ("Pencil", "pencil")):
        it = row(st, name, gap=12, pad=[6, 4, 6, 4], W="fill")
        run_text(it, [("word", s_)], width=80)
        text(it, name, "small", W="fill")
        icon(it, "eye", 16, "muted")
    P.button(st, "New style", "ghost", "plus", size="sm")


# ---- the dotted line -----------------------------------------------------------------------------------------------

def dotted(cv):
    r = row(cv, "dotted", gap=64, align="min")
    f = Q.win(r, PG, "M17 · What the dotted line does, and three ways without it",
              "Today a dotted line under words says a page is written on those words. With the margin showing the "
              "verse's page and the pencil and saves under words, it clashes (M6). Three ways to say the same:")
    body = row(f, "three", gap=36, pad=[56, 40, 56, 40], align="min", W="fixed", H="fixed")
    Q.put(body, 0, 0, W, H)
    a, m, b = split11(14, 18)
    for title, about, spans in (
            ("D1 · Drop it", "A page on words is a reference on the verse's page and a mark in the margin, like any "
             "page. The words carry nothing. Simplest; the margin already says it.", [(a, None), (m, None), (b, None)]),
            ("D2 · A small mark after the run", "A tiny page corner after the last word, the way a footnote mark "
             "sits. No line, so it never meets the pencil or a save.", [(a, None), (m + " ⌐", None), (b, None)]),
            ("D3 · Only when asked", "Nothing on the words until you hover the margin's item, which then outlines "
             "the words it is on.", [(a, None), (m, "box"), (b, None)])):
        c = col(body, title, gap=10, W="fixed")
        Q.put(c, 0, 0, 420)
        text(c, title, "heading")
        para(c, about, "small", "muted")
        verse_box(c, spans, width=380)


# ---- history -----------------------------------------------------------------------------------------------------

def history(cv):
    r = row(cv, "history", gap=64, align="min")
    f = Q.win(r, PG, "M18 · The development of your thoughts on a verse",
              "The verse's page has a thin timeline at its foot: each dot a time something of yours came to this "
              "verse (a highlight, a note, a question asked or answered, a page placed here). Dragging back shows the "
              "verse and its notes as they were then. Nothing on a button; the line is the control.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Numbers 25:11", "the verse's page", fill="bg")
    verse_box(p, [(" ".join(WORDS11[:5]), "hl"), (" ".join(WORDS11[5:]), None)])
    text(p, "NOTES · AS THEY WERE IN MARCH 2025", "label", "muted")
    para(p, MINE + " (then).", "body", "muted")
    tl = row(p, "timeline", gap=0, pad=[16, 0, 0, 0], W="fill", align="min", stroke="line", strokeTopWeight=0,
             strokeBottomWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    for label, on in (("2024 · highlighted", False), ("Mar 2025 · a note", True), ("Jan 2026 · a question", False),
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
    f = Q.win(r, PG, "M20 · Filters A: a list down the side, with counts",
              "The Library's search with its kinds as a short list on the left, each with how many it finds, the way "
              "a mail app lists folders. One click shows only that kind; Ctrl+click adds another. Open and Answered "
              "appear under Questions only when it is chosen.")
    w = K.app(f, on="Notebook")
    side = K.panel(f, w, TB, 260, H - TB, "Library", None, fill="sunken")
    for n, ic, c_, on in (("Everything", "search", "41", False), ("Pages", "page", "28", False),
                          ("Folders", "folder", "6", False), ("Saves", "bookmark", "4", False),
                          ("Questions", "question", "3", True), ("Highlights", "highlight", "", False)):
        K.line(side, n, None, ic, right=c_, on=on)
        if on:
            for sub, onn in (("Open", True), ("Answered", False)):
                K.line(side, "   " + sub, None, None, on=False, muted=not onn)
    p = K.panel(f, w + 260, TB, W - w - 260, H - TB, "Questions · open", "3 found", fill="bg")
    P.field(p, "Search")
    for pl, wh in (("Numbers 25:11", "in the page Numbers 25:11"), ("Numbers 25:13", "in Phinehas"),
                   ("no place", "in Tuesday study")):
        K.line(p, "a question line", f"{pl} · {wh}", "question")

    f = Q.win(r, PG, "M21 · Filters B: one menu in the search field",
              "The search field begins with what it searches: Everything ▾. The menu lists the kinds with counts and "
              "a check; the field then reads Questions, open ▾. Nothing sits under the field until you ask.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Library", None, fill="bg")
    fld = row(p, "field", gap=8, pad=[0, 6, 0, 6], radius=8, stroke="accent", sw=1, fill="surface", W="fill",
              H="fixed")
    Q.put(fld, 0, 0, None, 40)
    dd = row(fld, "kind", gap=4, pad=[4, 8, 4, 8], radius=6, fill="accentSoft")
    text(dd, "Questions, open", "smallStrong", "accent")
    icon(dd, "down", 12, "accent")
    text(fld, "Search", "small", "muted", W="fill")
    mn = K.floating(f, "menu", w + 24, TB + 120, 280, gap=1)
    for n, ic, c_, on in (("Everything", "search", "41", False), ("Pages", "page", "28", False),
                          ("Folders", "folder", "6", False), ("Saves", "bookmark", "4", False),
                          ("Questions", "question", "3", True), ("Highlights", "highlight", "", False)):
        K.line(mn, n, None, ic, right=c_, on=on)
    K.rule(mn)
    K.line(mn, "Open only", None, "check", on=True)


def round2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Marks, round 2",
                  "Three designs of a verse's page, narrow (M9-M11); marks with many tabs open (M12); one line under "
                  "a run, and the pencil, saved phrases and your own styles at work (M13-M16); the dotted line (M17); "
                  "the development of your thoughts (M18, M19); filters without chips (M20, M21).")
    verse_pages(cv)
    crowded(cv)
    underlines(cv)
    dotted(cv)
    history(cv)
    filters(cv)


# ==== Round 3 (2026-11-12): a page's scripture overview; the margin as the verse's store ===============================

PS106 = K.verses_of(K.fetch(HERE, "ps106-30-31", ["text", "Ps 106:30-31"], as_json=False))
ROM10 = K.verses_of(K.fetch(HERE, "rom10-2", ["text", "Rom 10:2"], as_json=False))
OVERVIEW = [("Numbers 25:7–13", "a scripture block", True), ("Numbers 25:11", "named in ¶2", True),
            ("Psalms 106:30–31", "a scripture block", True), ("John 2:17", "named in passing in ¶5", False),
            ("Romans 10:2", "named in ¶6", True)]


def overview(p, narrow=False, open_=True, passing_off=False):
    box = col(p, "scripture in this page", gap=6, pad=[10, 12, 10, 12], radius=10, fill="sunken", W="fill")
    hd = row(box, "head", gap=8, W="fill")
    icon(hd, "book", 16, "accent")
    n = sum(1 for o in OVERVIEW if o[2] or not passing_off)
    text(hd, f"Scripture in this page · {n}", "smallStrong", W="fill")
    icon(hd, "down" if open_ else "right", 14, "muted")
    if not open_:
        strip = row(box, "strip", gap=6, wrap=True, W="fill")
        for ref, _, on in OVERVIEW:
            if on or not passing_off:
                text(strip, ref + " ·", "caption", "accent")
        return box
    for ref, where, on in OVERVIEW:
        if passing_off and not on:
            it = row(box, ref, gap=8, pad=[3, 4, 3, 4], W="fill")
            text(it, ref, "small", "muted", W="fill")
            text(it, "left out · in passing", "caption", "muted")
            continue
        it = row(box, ref, gap=8, pad=[3, 4, 3, 4], W="fill")
        text(it, ref, "smallStrong" if not narrow else "small", "accent", W="fill")
        if not narrow:
            text(it, where, "caption", "muted")
    return box


def page_body(p):
    para(p, MINE + ".", "body", "muted")
    blk = col(p, "scripture block", gap=6, pad=[12, 14, 12, 14], radius=10, stroke="line", sw=1, fill="surface",
              W="fill")
    text(blk, "Psalms 106:30–31", "smallStrong")
    K.F.verses(blk, PS106, "readSmall")
    para(p, MINE + ", naming Numbers 25:11 in a sentence.", "body", "muted")


def round3(board):
    cv = Q.section(board, "Round 3", 3200)
    Q.sheet_title(cv, "Marks, round 3",
                  "No places (2026-11-12). A page's scripture overview at its top (M22-M24); the margin as the verse's "
                  "page and store: opened beside the reader (M25), names first in the reader (M26), writing in it asks "
                  "where (M27), a passage's and a chapter's notes (M28), and moving a note between the margin and a "
                  "page (M29).")
    r = row(cv, "overview", gap=64, align="min")
    f = Q.win(r, PG, "M22 · A page's scripture overview",
              "Every scripture the page names, in Bible order, at the top: what a scripture block shows, a "
              "reference in a sentence, a word block's verse. Each opens the place in the page where it is named; "
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
    text(p, "Tuesday study", "title")
    overview(p, narrow=True, open_=False)
    page_body(p)

    f = Q.win(r, PG, "M24 · A reference made only in passing",
              "A reference can be left out of the overview (right-click it in the text: Not a tether). It stays a "
              "link in the sentence; it is listed greyed at the foot of the overview, and the verse's margin does "
              "not list the page.")
    w = K.app(f, on="Notebook")
    p = K.panel(f, w, TB, W - w, H - TB, "Tuesday study", "a page (a drawn sample)", fill="bg")
    overview(p, passing_off=True)

    r = row(cv, "margin", gap=64, align="min")
    f = Q.win(r, PG, "M25 · The verse opened in the margin",
              "Open in the margin (a click on a verse number's margin mark, or M) opens the verse's page beside the "
              "reader: the verse, your margin notes, then what refers to it in one line of counts (M9), each "
              "opening its list: saves, pages that name it, its marks, and notes on the passage and chapter it "
              "is in.")
    w = K.app(f)
    K.reader(f, w, W - w - 420, NUM25, "Numbers 25", sel=(11, 0, 999))
    p = K.M.pane(f, W - 420, TB, 420, H - TB, ["Numbers 25", "Margin · 25:11"], "Margin · 25:11")
    text(p, "Numbers 25:11", "title")
    para(p, V11, "readSmall")
    text(p, "MARGIN NOTES", "label", "muted")
    for _ in range(2):
        para(p, MINE + ".", "small", "muted")
    K.rule(p)
    ln = row(p, "counts", gap=10, wrap=True, W="fill")
    for c_, ic, on in (("3 pages name it", "page", True), ("saved in 2", "bookmark", False),
                       ("2 marks", "highlight", False), ("1 note on 25:10–13", "list", False)):
        it = row(ln, c_, gap=4)
        icon(it, ic, 14, "accent" if on else "muted")
        text(it, c_, "smallStrong" if on else "small", "accent" if on else "muted")
    lst = col(p, "open list", gap=2, pad=[4, 0, 0, 8], W="fill", stroke="line", strokeLeftWeight=2,
              strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    for n_ in ("Phinehas", "Covenant", "Tuesday study"):
        text(lst, n_, "small")

    f = Q.win(r, PG, "M26 · In the reader: names first, lines on hover",
              "The reader's right margin starts as R6 did (liked): a small mark and a name per verse. Hover shows "
              "the first lines of the margin notes and the counts, as M2 drew; a click opens the margin as in M25.")
    w = K.app(f)
    K.reader(f, w, W - w - 320, NUM25, "Numbers 25")
    mg = col(f, "margin", gap=16, pad=[150, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 320, TB, 320, H - TB)
    for v, label in (("25:11", "2 notes · 3 pages"), ("25:13", "1 note")):
        it = row(mg, v, gap=6)
        icon(it, "pen", 14, "accent")
        text(it, v, "caption", "muted")
        text(it, label, "small")
    c = K.floating(f, "hover", W - 560, TB + 170, 300, gap=4)
    text(c, "Numbers 25:11", "smallStrong")
    para(c, MINE + "…", "small", "muted")
    para(c, MINE + "…", "small", "muted")
    text(c, "3 pages name it · saved in 2", "caption", "muted")

    f = Q.win(r, PG, "M27 · Writing in the margin asks where",
              "After the first words, Enter asks once: Leave in the margin (kept with the verse) or Add to a new page "
              "(a page whose first line names the verse, so it is tethered and listed here). Remember my choice "
              "stops the asking.")
    w = K.app(f)
    K.reader(f, w, W - w - 320, NUM25, "Numbers 25", sel=(11, 0, 999))
    mg = col(f, "margin", gap=10, pad=[150, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 320, TB, 320, H - TB)
    margin_note(mg, "25:11", 1, editing=True)
    ask = col(mg, "ask", gap=6, pad=[10, 10, 10, 10], radius=8, fill="surface", stroke="line", sw=1, W="fill")
    text(ask, "Keep this…", "smallStrong")
    P.button(ask, "Leave in the margin", "primary", size="sm", W="fill")
    P.button(ask, "Add to a new page", "secondary", size="sm", W="fill")
    rr = row(ask, "remember", gap=6)
    frame(rr, "box", w=14, h=14, radius=3, stroke="line", sw=1.5, W="fixed", H="fixed")
    text(rr, "Remember my choice", "caption", "muted")

    r = row(cv, "wider", gap=64, align="min")
    f = Q.win(r, PG, "M28 · Notes on a passage or a chapter",
              "Select verses 10–13 and write: the note is kept in that passage's margin. A chapter has a margin too "
              "(beside its title). A verse's margin lists the notes of the passages and chapter it is in, smaller, "
              "under its own.")
    w = K.app(f)
    K.reader(f, w, W - w - 320, NUM25, "Numbers 25")
    mg = col(f, "margin", gap=10, pad=[24, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 320, TB, 320, H - TB)
    margin_note(mg, "Numbers 25 (the chapter)", 1)
    br = row(mg, "bracket", gap=8, align="min", W="fill")
    frame(br, "bracket line", w=3, h=260, radius=2, fill="accentSoft", W="fixed", H="fixed")
    inner = col(br, "passage", gap=8, W="fill")
    margin_note(inner, "25:10–13", 2)
    margin_note(inner, "25:11", 1)

    f = Q.win(r, PG, "M29 · Moving a note between the margin and a page",
              "A margin note's ⋯ has Move to a page (a new one, or a page you pick: it lands as a paragraph naming "
              "the verse) and a page's paragraph has Move to the margin (it must name one place). Nothing is copied: "
              "the note is in one place at a time, and the margin lists the page either way.")
    w = K.app(f)
    K.reader(f, w, W - w - 320, NUM25, "Numbers 25")
    mg = col(f, "margin", gap=10, pad=[150, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 320, TB, 320, H - TB)
    margin_note(mg, "25:11", 2)
    mn = K.floating(f, "menu", W - 560, TB + 230, 260, gap=1)
    for lbl, ic in (("Move to a new page", "page"), ("Move to a page…", "notebook"), ("Ask as a question", "question"),
                    ("Delete", "trash")):
        K.line(mn, lbl, None, ic)


# ==== Round 4 (2026-11-12): jots and pages; Margin notes in the Library ============================================

JOT = "A thought caught while reading, as you wrote it"


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


def library_side(f, w, on="Margin notes", counts=("4", "38", "57", "6", "12")):
    side = K.panel(f, w, TB, 280, H - TB, "Library", None, fill="sunken")
    P.field(side, "Search the Library", height=34)
    for (n, ic), c_ in zip((("Pinned", "bookmark"), ("Pages", "page"), ("Margin notes", "pen"), ("Folders", "folder"),
                            ("Shelf", "shelf")), counts):
        K.line(side, n, None, ic, right=c_, on=(n == on))
    return side


def round4(board):
    cv = Q.section(board, "Round 4", 3200)
    Q.sheet_title(cv, "Marks, round 4",
                  "The margin holds jots; the Notebook holds pages (proposed 2026-11-12). Margin notes in the Library, "
                  "in the Bible's order (M30, M31); a jot's menu and the offer when it grows long (M32); a jot grown "
                  "into a page, with its seed block (M33) and the line left in the margin (M34); adding a jot to a page "
                  "that exists (M35).")
    r = row(cv, "library", gap=64, align="min")
    f = Q.win(r, PG, "M30 · Margin notes in the Library",
              "A section of its own beside Pages: every jot, in the Bible's order, never sorted into folders. Books "
              "open to chapters, with how many jots each holds. It is the contents of your annotated Bible; the "
              "Library's search reaches it like everything else.")
    w = K.app(f, on="Notebook")
    library_side(f, w)
    p = K.panel(f, w + 280, TB, W - w - 280, H - TB, "Margin notes", "57 jots in 9 books · in the Bible's order",
                fill="bg")
    for book, n, open_ in (("Genesis", 12, False), ("Numbers", 9, True), ("Psalms", 21, False),
                           ("John", 6, False), ("Romans", 9, False)):
        it = row(p, book, gap=10, pad=[8, 10, 8, 10], radius=8, W="fill", fill="surface" if open_ else None)
        icon(it, "down" if open_ else "right", 14, "muted")
        text(it, book, "bodyStrong" if open_ else "body", W="fill")
        text(it, f"{n} jots", "caption", "muted")
        if open_:
            for ch, c_ in (("Numbers 22", 4), ("Numbers 25", 4), ("Numbers 31", 1)):
                sub = row(p, ch, gap=10, pad=[6, 10, 6, 40], W="fill")
                text(sub, ch, "small", W="fill")
                text(sub, f"{c_}", "caption", "muted")

    f = Q.win(r, PG, "M31 · A chapter's jots",
              "Numbers 25 opened: each jot under its verse or passage, with the verse's first words so it reads in "
              "place. A click opens the reader at that verse with its margin open; nothing here is edited in a "
              "second way.")
    w = K.app(f, on="Notebook")
    library_side(f, w)
    p = K.panel(f, w + 280, TB, W - w - 280, H - TB, "Numbers 25", "4 jots", fill="bg")
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
    f = Q.win(r, PG, "M32 · A jot's menu, and the offer when it grows",
              "⋯ on a jot: Grow into a page, Add to a page…, Make it a question, Delete. When a jot passes a few "
              "lines, or gets a second reference, a quiet line under it offers to grow it; ignoring it costs nothing.")
    w = K.app(f)
    mg = reader_margin(f, w, sel=(11, 0, 999))
    jot(mg, "Numbers 25:11", long_=True, editing=True)
    off = row(mg, "offer", gap=6, pad=[6, 8, 6, 8], radius=6, fill="accentSoft", W="fill")
    icon(off, "page", 14, "accent")
    text(off, "Getting long: grow it into a page?", "caption", "accent", W="fill")
    mn = K.floating(f, "menu", W - 590, TB + 160, 260, gap=1)
    for lbl, ic, on in (("Grow into a page", "page", True), ("Add to a page…", "notebook", False),
                        ("Make it a question", "question", False), ("Delete", "trash", False)):
        K.line(mn, lbl, None, ic, on=on)

    f = Q.win(r, PG, "M33 · The page a jot grew into",
              "A new page starts with the jot as its seed: quoted, linked, and naming its verse, so the page is "
              "tethered there (the overview lists it). The seed shows the jot as it is now; editing it here edits "
              "the jot. You write on beneath it.")
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
              "The jot is still where you wrote it, as in a paper Bible after the notebook took the thought further. "
              "Under it, grew into Phinehas, a link to the page. The margin also lists Phinehas among the pages that "
              "name the verse, once.")
    w = K.app(f)
    mg = reader_margin(f, w)
    jot(mg, "Numbers 25:11", grew="Phinehas")
    jot(mg, "Numbers 25:11", q=True)
    t = row(mg, "pages", gap=6)
    icon(t, "page", 12, "muted")
    text(t, "3 pages name it", "caption", "muted")

    r = row(cv, "adding", gap=64, align="min")
    f = Q.win(r, PG, "M35 · Adding a jot to a page that exists",
              "Add to a page… lists the pages that already name this verse first, then the last pages you wrote in, "
              "then a search. The seed goes at the page's end (or where you choose in the page); the margin's line "
              "names that page.")
    w = K.app(f)
    mg = reader_margin(f, w)
    jot(mg, "Numbers 25:11", editing=True)
    pk = K.floating(f, "picker", W - 640, TB + 140, 300, gap=2)
    text(pk, "Add to a page", "smallStrong")
    P.field(pk, "Find a page", height=32)
    text(pk, "NAME NUMBERS 25:11", "label", "muted")
    K.line(pk, "Phinehas", None, "page", on=True)
    K.line(pk, "Covenant", None, "page")
    text(pk, "WRITTEN IN LATELY", "label", "muted")
    K.line(pk, "Tuesday study", None, "page")


# ==== Round 5 (2026-11-12): a full vault, fifteen years on =========================================================
# A projection, not anyone's data: the study folder held about 121 pages and 9 threads on 2026-11-12. Drawn here at
# roughly 2,400 pages, 3,100 jots, 18,000 highlights and 140 folders: what a teacher or preacher could have after
# fifteen years of weekly lessons and daily reading. Counts are drawn samples; scripture is fetched.

JOHN3 = K.verses_of(K.fetch(HERE, "john3-14-21", ["text", "John 3:14-21"], as_json=False))
DENSE = {14: {"hl": "yellow"}, 15: {"hl": "yellow", "threads": {2: ["threadA"], 3: ["threadA"]}},
         16: {"hl": "green", "threads": {k: ["threadB"] for k in range(0, 8)}, "note": [9, 10, 11]},
         17: {"hl": "blue"}, 18: {"hl": {0: "pink", 1: "pink", 2: "pink"}}, 19: {"hl": "orange"},
         20: {"threads": {k: ["threadA"] for k in range(3, 9)}}, 21: {"hl": "green"}}
# per verse: jots, pages naming it, saves
LOAD = {14: (3, 18, 2), 15: (2, 11, 1), 16: (41, 312, 9), 17: (6, 44, 2), 18: (2, 9, 0), 19: (4, 15, 1),
        20: (1, 6, 0), 21: (3, 12, 1)}


def round5(board):
    cv = Q.section(board, "Round 5", 3200)
    Q.sheet_title(cv, "Marks, round 5: a full vault, years on",
                  "A projection of a teacher's study after fifteen years (about 2,400 pages, 3,100 jots, 18,000 "
                  "highlights, 140 folders; today's folder holds about 121 pages). The busiest chapter in the reader "
                  "(M36); the margin of a verse with 41 jots and 312 pages (M37); the Library's Margin notes as a map "
                  "of the Bible (M38); a long lesson's overview (M39); the Library's search over everything (M40); the "
                  "Pages tree (M41).")
    r = row(cv, "reader", gap=64, align="min")
    f = Q.win(r, PG, "M36 · The busiest chapter in the reader",
              "John 3 after fifteen years. The margin never lists everything: one line per verse, the counts only "
              "(jots · pages · saves), so a verse with 312 pages takes the same line as one with 6. The words carry "
              "their colors and lines; the marks panel can hide any kind. Reading stays first.")
    w = K.app(f)
    K.reader(f, w, W - w - 300, JOHN3, "John 3", marks=DENSE)
    mg = col(f, "margin", gap=0, pad=[138, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 300, TB, 300, H - TB)
    for v in range(14, 22):
        j, pg, sv = LOAD[v]
        it = row(mg, f"3:{v}", gap=8, pad=[0, 0, 0, 0], W="fill")
        Q.put(it, 0, 0, None, 46 if v in (16, 18) else 34)
        text(it, f"3:{v}", "caption", "accent")
        text(it, f"{j} jots · {pg} pages" + (f" · {sv} saved" if sv else ""), "caption",
             "fg" if v == 16 else "muted")

    f = Q.win(r, PG, "M37 · One verse's margin: 41 jots, 312 pages",
              "John 3:16 opened in the margin. Jots come first, newest first, folded by year: the years read like "
              "rings, and a year opens to its jots. Pages that name it are not listed by the hundred: they are "
              "grouped by folder with counts, with a search to narrow them. The jots that grew show where to.")
    w = K.app(f)
    K.reader(f, w, W - w - 460, JOHN3, "John 3", marks=DENSE)
    p = K.M.pane(f, W - 460, TB, 460, H - TB, ["John 3", "Margin · 3:16"], "Margin · 3:16")
    text(p, "John 3:16", "title")
    P.field(p, "Search this verse's margin", height=32)
    text(p, "JOTS · 41", "label", "muted")
    for yr, n, open_ in (("2041", 3, True), ("2039", 5, False), ("2034", 9, False), ("2030", 11, False),
                         ("2026–2029", 13, False)):
        it = row(p, yr, gap=8, pad=[4, 4, 4, 4], W="fill")
        icon(it, "down" if open_ else "right", 12, "muted")
        text(it, yr, "smallStrong" if open_ else "small", W="fill")
        text(it, f"{n}", "caption", "muted")
        if open_:
            for g in ("Sermon: God so loved", None, None):
                jot(p, "John 3:16", grew=g)
    text(p, "PAGES THAT NAME IT · 312", "label", "muted")
    for fo, n in (("Sermons", 128), ("Lessons", 74), ("Evangelism", 51), ("Daily reading", 38), ("Not in a folder", 21)):
        it = row(p, fo, gap=8, pad=[3, 4, 3, 4], W="fill")
        icon(it, "folder", 14, "muted")
        text(it, fo, "small", W="fill")
        text(it, str(n), "caption", "muted")

    r = row(cv, "library", gap=64, align="min")
    f = Q.win(r, PG, "M38 · Margin notes as a map of the Bible",
              "With 3,100 jots, a list of books is not enough to see where you have lived. Margin notes opens as a map: "
              "every book a bar, as long as its chapters, shaded by how many jots each chapter holds. A click opens "
              "that chapter's jots (M31). Where you have never written is as plain as where you have.")
    w = K.app(f, on="Notebook")
    library_side(f, w, counts=("6", "2,400", "3,100", "140", "310"))
    p = K.panel(f, w + 280, TB, W - w - 280, H - TB, "Margin notes", "3,100 jots in 61 books · darker: more jots",
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
              "“covenant” across 2,400 pages, 3,100 jots and 140 folders. Results come grouped by kind with counts "
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
    text(fld, "covenant", "small", W="fill")
    for kind, ic, n, items in (("Pages", "page", 214, [("Covenant of peace", "Sermons › Numbers"),
                                                       ("The new covenant", "Lessons › Hebrews")]),
                               ("Margin notes", "pen", 97, [("Genesis 15:18", "a jot, 2031"),
                                                            ("Jeremiah 31:31", "a jot, 2037")]),
                               ("Folders", "folder", 3, [("Covenants", "41 pages")]),
                               ("Questions", "question", 12, [("a question line", "in Covenant of peace")])):
        hd = row(p, kind, gap=8, W="fill")
        icon(hd, ic, 14, "muted")
        text(hd, kind.upper(), "label", "muted", W="fill")
        text(hd, f"{n} · show all", "caption", "accent")
        for n_, s_ in items:
            K.line(p, n_, s_, None)

    f = Q.win(r, PG, "M41 · The Pages tree at 2,400 pages",
              "The tree never opens all at once. Pinned and Recent come first (what you use this month); folders show "
              "counts and open one level at a time; a long folder shows its newest twenty and Show all. The tree is "
              "for walking; the search (M40) is for finding.")
    w = K.app(f, on="Notebook")
    side = K.panel(f, w, TB, 360, H - TB, "Library", None, fill="sunken")
    text(side, "PINNED", "label", "muted")
    for n_ in ("This Sunday", "Romans: a 12-week series", "Prayer list"):
        K.line(side, n_, None, "bookmark")
    text(side, "RECENT", "label", "muted")
    for n_ in ("Covenant of peace", "Daily reading: Numbers"):
        K.line(side, n_, None, "page")
    text(side, "FOLDERS · 140", "label", "muted")
    for n_, c_, open_ in (("Sermons", "612", True), ("Lessons", "388", False), ("Daily reading", "940", False),
                          ("Word studies", "164", False)):
        K.line(side, n_, None, "folder", right=c_, on=open_)
        if open_:
            for y_, c2 in (("2041", "31"), ("2040", "48"), ("Show all years", "")):
                K.line(side, "   " + y_, None, None, right=c2, muted=not c2)
    p = K.panel(f, w + 360, TB, W - w - 360, H - TB, "Sermons › 2041", "31 pages · newest first", fill="bg")
    for i in range(6):
        K.line(p, ["God so loved", "Covenant of peace", "Zeal for thy house", "The new covenant", "Psalm 106",
                   "Grace and truth"][i], ["John 3:16 · 4 more", "Numbers 25 · 7 more", "John 2:17 · 3 more",
                                           "Hebrews 8 · 12 more", "Psalms 106 · 2 more", "John 1:14 · 5 more"][i],
               "page")
    text(p, "25 more", "caption", "muted")


def sheets(board):
    round5(board)
    round4(board)
    round3(board)
    round2(board)
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Marks, round 1",
                  "The model (M1); the reader with saves left and the verse's page right, written where it sits (M2, "
                  "M3); the verse's page with its references (M4); three meanings for an underline (M5); a passage in "
                  "a page with your marks (M6, M7); questions as a search filter (M8).")
    model(cv)
    reader_windows(cv)
    verse_page(cv)
    underline(cv)
    passage(cv)
    questions(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Marks", sheets)
