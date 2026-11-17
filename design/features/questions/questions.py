"""Questions. A question is stored only as a callout line (> [!question], answered > [!done]), in a page or in a margin
note beside a verse; the list of them is the Library's search with its field menu set to Questions (marks M21) and a
saved list block in any page (Q6). The questions on the sheets are a drawn sample, not anyone's study; scripture is
fetched with wb text (data/num25-6-13.json).

    python design/features/questions/questions.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text, shadow  # noqa: E402

PG = "Questions"
NUM25 = K.verses_of(K.fetch(HERE, "num25-6-13", ["text", "Num 25:6-13"], as_json=False))
NUM25_10_13 = [v for v in NUM25 if 10 <= v["v"] <= 13]
QPH = "A question of yours, as you wrote it"
QPH2 = "Another question of yours"
OWN = "Your own words, as you wrote them"
TYPED = "? " + QPH
SAMPLE = [  # (place, question, open, where it is written); the questions are placeholders, never the person's words
    ("Numbers 25:11", QPH, True, "in the margin"),
    ("Numbers 25:13", QPH2, True, "in the page Phinehas"),
    ("Psalms 106:30", QPH, False, "in the page Phinehas"),
    (None, QPH2, True, "in the page Tuesday study"),
]
OPEN = [s for s in SAMPLE if s[2]]
PICKER = ("Tuesday study", "Phinehas", "Reading notes")


def where_line(place, where):
    return (place + " · " + where) if place else where


def qrow(p, place, q, open_, where):
    it = row(p, f"q/{q[:20]}", gap=10, pad=[10, 10, 10, 10], radius=8, stroke="line", sw=1, W="fill",
             align="min")
    frame(it, "tick", w=18, h=18, radius=9, stroke="question" if open_ else "ok", sw=2,
          fill=None if open_ else "ok", W="fixed", H="fixed")
    tc = col(it, "text", gap=2, W="fill")
    para(tc, q, "body", "fg" if open_ else "muted")
    text(tc, where_line(place, where), "caption", "muted")
    return it


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "Q1 · Today: three kinds, three places",
              "As built: a question at a verse is a trail (a ? on the verse number); a question jotted with no place "
              "waits in the Inbox; a question written in a page is a callout block. The Notebook's Questions filter "
              "lists them, and wb question list joins them, but each is asked, answered and deleted its own way.")
    w = K.app(f)
    K.reader(f, w, W - w - 420, NUM25, "Numbers 25")
    p = K.M.pane(f, W - 420, TB, 420, H - TB, ["Notebook"], "Notebook")
    P.segmented(p, ["Pages", "Questions", "Days"], "Questions")
    for s in SAMPLE:
        qrow(p, s[0], s[1], s[2], "at the verse" if s[3] == "in the margin" else
             s[3].replace("in the page Tuesday study", "with no place"))


def tick(parent, open_, size=22):
    """The round tick that answers a question: empty for an open one, filled with a check for an answered one."""
    t = frame(parent, "tick/open" if open_ else "tick/answered", w=size, h=size, radius=size / 2,
              stroke="question" if open_ else "ok", sw=2, fill=None if open_ else "ok", layout="horizontal",
              mainAlign="center", crossAlign="center", W="fixed", H="fixed")
    if not open_:
        icon(t, "check", 14, "surface")
    return t


def callout(p, q, open_=True, place=None):
    it = row(p, "callout", gap=10, pad=[10, 12, 10, 12], radius=8, fill="accentSoft" if open_ else "sunken", W="fill",
             stroke="question" if open_ else "ok", strokeLeftWeight=3, strokeRightWeight=0, strokeTopWeight=0,
             strokeBottomWeight=0, align="min")
    tick(it, open_)
    tc = col(it, "text", gap=2, W="fill")
    para(tc, q, "body", "fg" if open_ else "muted")
    if place:
        para(tc, place, "caption", "muted")
    if open_:
        icon(it, "question", 16, "question")
    return it


def page_lines(pg, qs=(QPH, QPH2)):
    para(pg, "A drawn sample of a page's paragraph.", "body", "muted")
    for q in qs:
        callout(pg, q, True)


def margin_col(f, x, w, head_text, qs):
    mg = col(f, "margin", gap=10, pad=[16, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, x, TB, w, H - TB)
    frame(mg, "space", w=10, h=60, W="fixed", H="fixed")
    hd = row(mg, "head", gap=6)
    icon(hd, "question", 14, "muted")
    text(hd, head_text, "caption", "muted")
    for q in qs:
        callout(mg, q, True)
    return mg


def line_in_page_and_margin(f):
    """Q4's body: a page holding two question lines, and the reader with a margin note that is the same line."""
    w = K.app(f, on="Notebook")
    pw = 470
    pg = K.panel(f, w, TB, pw, H - TB, "Phinehas", None, fill="bg")
    page_lines(pg)
    mw = 330
    K.reader(f, w + pw, W - w - pw - mw, NUM25_10_13, "Numbers 25", sel=(11, 0, 999))
    margin_col(f, W - mw, mw, "Margin · Numbers 25:11", [QPH])


def answering(f):
    """Q5's body: the page Phinehas, one open line with its empty tick, one answered with the check and, under it,
    the person's optional line."""
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, W - w, H - TB, "Phinehas", None, fill="bg")
    callout(pg, QPH, True)
    callout(pg, QPH2, False)
    ans = col(pg, "answer", gap=4, pad=[0, 12, 8, 44], W="fill")
    para(ans, OWN, "body")


def list_head(blk, line_kept):
    hd = row(blk, "head", gap=8, W="fill")
    icon(hd, "list", 16, "muted")
    text(hd, "Questions · open · every place", "smallStrong", W="fill", maxLines=1)
    P.icon_button(hd, "pen", "muted", size=26, icon_size=14)
    text(blk, line_kept, "caption", "muted")


def list_block(parent, rows, answered=None, width=None, more=None, kept="notebook questions open", pad=None):
    """The saved list block (Q6, Q12, Q13, Q15): one plain line of what it holds with a small pencil, the line as kept,
    then the rows. rows: [(place, question, where)]; `answered` is the index of a row shown answered in place (Q12);
    `width` makes the block that wide (a floating pane); `more` is the label of a Show all button under the rows."""
    blk = col(parent, "saved list", gap=8, pad=pad or [12, 14, 12, 14], radius=10, stroke="line", sw=1, fill="surface",
              W="fixed" if width else "fill")
    if width:
        K.S.do("node.set", {"ids": [blk], "props": {"width": width}}, ref=False)
    list_head(blk, kept)
    for i, (place, q, where) in enumerate(rows):
        callout(blk, q, i != answered, where_line(place, where))
        if i == answered:
            ans = col(blk, "answer", gap=4, pad=[0, 0, 0, 32], W="fill")
            P.field(ans, "A line of your own (optional)", icon_name="pen", height=36)
    if more:
        P.button(blk, more, "secondary", size="sm")
    return blk


def list_rows():
    return [(s[0], s[1], s[3]) for s in OPEN]


def more_rows(places):
    return [(pl, QPH if i % 2 else QPH2, wh) for i, (pl, wh) in enumerate(places)]


def _vpad(r, pad):
    K.S.do("node.set", {"ids": [r], "props": {"paddingTop": pad, "paddingBottom": pad}}, ref=False)


def picker(p, pad=8):
    """Q8's picker: the last three pages written in, and a new page."""
    for i, n in enumerate(PICKER):
        r = K.line(p, n, None, "page", on=i == 0)
        if pad != 8:
            _vpad(r, pad)
    r = K.line(p, "A new page", None, "plus")
    if pad != 8:
        _vpad(r, pad)


def half_label(f, x, w, label):
    r = row(f, "label", gap=0, pad=[0, 22, 0, 22], W="fixed", H="fixed")
    Q.put(r, x, TB, w, 40)
    text(r, label, "smallStrong", "muted")
    return r


def no_verse(f):
    """Q8: two cases side by side, a page in front (left) and no page open (right)."""
    w = K.app(f, on="Notebook")
    hw = (W - w) // 2
    half_label(f, w, hw, "A page is in front")
    half_label(f, w + hw, hw, "No page is open")
    # left: the field above, the page, the new line as its last block
    pg = K.panel(f, w, TB + 120, hw, H - TB - 120, "Tuesday study", None, fill="bg")
    para(pg, "A drawn sample of a page's paragraph.", "body", "muted")
    callout(pg, QPH2, True)
    callout(pg, QPH, True)
    fl = K.floating(f, "command field", w + 22, TB + 44, hw - 44, pad=(8, 8, 8, 8), gap=0)
    P.field(fl, "", value=TYPED, icon_name="search")
    # right: the desk, the reader only, the field and the picker under it
    K.reader(f, w + hw, hw, NUM25, "Numbers 25", top=TB + 40, width=hw - 64)
    fr = K.floating(f, "command field", w + hw + 22, TB + 44, hw - 44, pad=(8, 8, 8, 8), gap=0)
    P.field(fr, "", value=TYPED, icon_name="search")
    pk = K.floating(f, "which page", w + hw + 22, TB + 120, hw - 44, gap=2)
    text(pk, "Write the question in:", "small", "muted")
    picker(pk)
    dv = frame(f, "divider", w=1, h=H - TB, fill="line", W="fixed", H="fixed")
    Q.put(dv, w + hw, TB, 1, H - TB)


def tabs_among(f):
    """Q12: the saved list as one tab of four in a side pane, the reader beside it, one row answered in place."""
    w = K.app(f)
    pw = 560
    K.reader(f, w, W - w - pw, NUM25, "Numbers 25")
    p = K.M.pane(f, W - pw, TB, pw, H - TB, ["Open questions", "Phinehas", "Concordance", "Trash"], "Open questions")
    text(p, "Open questions", "title")
    rows = list_rows()
    rows.append((None, QPH2, "in the page Phinehas"))
    list_block(p, rows, answered=0)


def floating_list(f):
    """Q13: the list as a small floating pane (320 wide) over the reader, drawn by list_block."""
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    fw = 320
    c = K.floating(f, "floating list", W - fw - 40, TB + 60, fw, pad=(8, 8, 8, 8), gap=6)
    hd = row(c, "head", gap=8, pad=[0, 0, 0, 6], W="fill")
    text(hd, "Open questions", "smallStrong", W="fill")
    P.icon_button(hd, "close", "muted", size=32, icon_size=14)
    list_block(c, list_rows(), width=fw - 16, pad=[10, 10, 10, 10])


def phone_bar(f, pw):
    """The phone's top bar: the time and the place button."""
    bar = row(f, "top bar", gap=10, pad=[0, 16, 0, 16], fill="bg", W="fixed", H="fixed")
    Q.put(bar, 0, 0, pw, 52)
    text(bar, "9:41", "smallStrong", W="fill")
    pb = row(bar, "place button", gap=6, pad=[0, 12, 0, 12], radius=10, stroke="line", sw=1, fill="surface", H="fixed")
    K.S.do("node.set", {"ids": [pb], "props": {"height": 44}}, ref=False)
    text(pb, "Numbers 25", "bodyStrong")
    icon(pb, "down", 13, "muted")


def phone_ask(f, pw, ph):
    """Q14: 390 wide, a question asked with no page open; the sheet reaches the bottom edge, every row 44 px or more."""
    phone_bar(f, pw)
    K.reader(f, 0, pw, NUM25, "Numbers 25", top=52, width=pw - 40)
    top = 440
    c = col(f, "page sheet", gap=6, pad=[10, 14, 14, 14], fill="surface", radius=14, stroke="line", sw=1, W="fixed",
            H="fixed")
    Q.put(c, 0, ph - top, pw, top + 16)
    shadow(c, 8, 28, "#00000033")
    g = row(c, "grabber", mainAlign="center", W="fill")
    frame(g, "grab", w=40, h=4, radius=2, fill="line", W="fixed", H="fixed")
    hd = row(c, "head", gap=8, W="fill")
    text(hd, "Write the question in:", "smallStrong", W="fill")
    P.icon_button(hd, "close", "muted", size=44, icon_size=16, fill="sunken")
    q = row(c, "question", gap=8, pad=[12, 12, 12, 12], radius=8, fill="accentSoft", W="fill")
    icon(q, "question", 16, "question")
    para(q, QPH, "small")
    picker(c, pad=13)


def years_library(p):
    """Q15 left: the Library's search, its field menu reading Questions · open, results grouped by book."""
    fld = row(p, "search field", gap=8, pad=[0, 12, 0, 8], fill="surface", radius=10, stroke="line", sw=1, W="fill",
              H="fixed")
    K.S.do("node.set", {"ids": [fld], "props": {"height": 44}}, ref=False)
    mn = row(fld, "field menu", gap=6, pad=[5, 4, 5, 4])
    text(mn, "Questions · open", "smallStrong")
    icon(mn, "down", 13, "muted")
    icon(fld, "search", 18, "muted")
    text(fld, "Search", "body", "muted", W="fill")
    text(p, "212 open of 640 questions", "caption", "muted")
    groups = (("Numbers", 14), ("Psalms", 31), ("Isaiah", 27), ("Matthew", 22), ("Romans", 19))
    for i, (b, n) in enumerate(groups):
        g = row(p, f"group/{b}", gap=8, pad=[6, 8, 6, 8], radius=8, W="fill", fill="sunken" if i == 0 else None)
        icon(g, "down" if i == 0 else "right", 14, "muted")
        text(g, b + " · " + str(n), "smallStrong", W="fill")
        if i == 0:
            for place, q, where in list_rows():
                callout(p, q, True, where_line(place, where))
            callout(p, QPH2, True, "Numbers 25:1 · in the margin")
    text(p, "and 9 more books · 99 questions", "caption", "muted")
    P.button(p, "Show all 212", "secondary", size="sm")


def years_block(pg):
    """Q15 right: the saved list block, its first 20 rows (about 8 drawn), then Show all 212."""
    rows = list_rows() + more_rows((("Psalms 19:2", "in the margin"), ("Isaiah 6:1", "in the page Phinehas"),
                                    ("Matthew 5:3", "in the page Tuesday study"), ("Romans 3:1", "in the margin"),
                                    ("Romans 8:2", "in the page Reading notes")))
    list_block(pg, rows, more="Show all 212", kept="notebook questions open · the first 20 of 212")


def years(f):
    w = K.app(f, on="Notebook")
    lw = 600
    lib = K.panel(f, w, TB, lw, H - TB, "Library", None, fill="sunken")
    years_library(lib)
    pg = K.panel(f, w + lw, TB, W - w - lw, H - TB, "Open questions", None, fill="bg")
    years_block(pg)


def part(cv, title):
    text(cv, title, "display", fontSize=30, lineHeight="38px")


def sheets(board):
    cv = Q.section(board, "Questions", 3200)
    Q.sheet_title(cv, "Questions",
                  "A question is stored only as a callout line (> [!question], answered > [!done]), in a page or in a "
                  "margin note beside a verse: one way to ask, answer and delete. Every open question is seen as one "
                  "list, as a filtered view and never as a Questions tab: the Library's search with its field menu "
                  "set to Questions, and a saved list in any page.")
    part(cv, "Today")
    today(cv)


    part(cv, "A question is a line")
    r = row(cv, "line", gap=64, align="min")
    f = Q.win(r, PG, "Q4 · A question is a line: in a page, or in a verse's margin",
              "One way to ask, answer and delete: the same line in a page (left) and in the margin note beside a verse "
              "(right), in the same look. The old trails and Inbox questions are read as they are until the person "
              "has them folded in (wb question fold).")
    line_in_page_and_margin(f)
    f = Q.win(r, PG, "Q5 · Answering: a line under the question",
              "Answered asks for an optional line, kept under the question in the same page (an ordinary paragraph "
              "after the > [!done] callout). The answer is the person's own words; the app suggests none.")
    answering(f)

    part(cv, "The list")
    r = row(cv, "list", gap=64, align="min")
    f = Q.win(r, PG, "Q6 · The list: a saved list in a page",
              "The list is a block you put in any page: its head says in plain words what it holds, with a pencil to "
              "change it, and under it the line as kept. Each row says where the question lives; ticking one answers "
              "it where it is written.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, W - w, H - TB, "Open questions", None, fill="bg")
    list_block(pg, list_rows())

    part(cv, "A question with no verse")
    r = row(cv, "no verse", gap=64, align="min")
    f = Q.win(r, PG, "Q8 · No verse: it goes in the page you are in",
              "Left: a page is in front, so the question typed in the command field is written as the page's last "
              "block. Right: no page is open, so under the field it asks Write the question in: the last three pages "
              "written in, and A new page.")
    no_verse(f)

    part(cv, "The real conditions")
    r = row(cv, "conditions a", gap=64, align="min")
    f = Q.win(r, PG, "Q12 · Among other tabs",
              "The saved list is a page, one tab of four in a side pane beside the reader. One row is being answered "
              "in place: its tick is on and the optional line of the person's own is under it.")
    tabs_among(f)
    f = Q.win(r, PG, "Q13 · Floating",
              "The same list as a small floating pane, about 320 wide, over the reader: a question wraps to two lines, "
              "the where-line stays whole and the tick stays reachable.")
    floating_list(f)
    r = row(cv, "conditions b", gap=64, align="min")
    pw, ph = 390, 800
    f = Q.win(r, PG, "Q14 · Narrow",
              "At phone width, a question asked with no page open: Write the question in: is a sheet over the bottom "
              "of the screen with the last pages and A new page.", w=pw, h=ph)
    phone_ask(f, pw, ph)
    f = Q.win(r, PG, "Q15 · Years of study",
              "640 questions, 212 open. The Library's search with its field menu at Questions · open: results by "
              "book with counts, the first group opened, Show all 212. The saved list in a page shows its first 20 "
              "rows (about 8 drawn), then Show all 212.")
    years(f)


if __name__ == "__main__":
    K.run_board(HERE, "Questions", sheets)
