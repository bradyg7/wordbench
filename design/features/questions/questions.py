"""Questions, round 1. Today a question lives three ways: a trail at a place (wb trail), an Inbox question (wb note jot
--question), and a callout written in a page (> [!question], wb question add); `wb question list` already reads them as
one list. This round asks how a person asks, sees and answers questions in the window, with the reader's margin
(reader C) and the library (library) as they now stand. The questions on the sheets are a drawn sample, not anyone's
study; scripture is fetched with wb text.

    python design/features/questions/questions.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Questions"
NUM25 = K.verses_of(K.fetch(HERE, "num25-6-13", ["text", "Num 25:6-13"], as_json=False))
SAMPLE = [  # (place, question, open, where it is written)
    ("Numbers 25:11", "What is the covenant of peace given here?", True, "at the verse"),
    ("Numbers 25:13", "Where else is an everlasting priesthood promised?", True, "in the page Phinehas"),
    ("Psalms 106:30", "Why does the psalm say judgment where Numbers says zeal?", False, "in the page Phinehas"),
    (None, "Read the whole of Numbers 22–25 together?", True, "with no place"),
]


def qrow(p, place, q, open_, where):
    it = row(p, f"q/{q[:20]}", gap=10, pad=[10, 10, 10, 10], radius=8, stroke="line", sw=1, W="fill",
             align="min")
    box = frame(it, "tick", w=18, h=18, radius=9, stroke="question" if open_ else "ok", sw=2,
                fill=None if open_ else "ok", W="fixed", H="fixed")
    tc = col(it, "text", gap=2, W="fill")
    para(tc, q, "body", "fg" if open_ else "muted")
    text(tc, (place or "no place") + " · " + where, "caption", "muted")
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
        qrow(p, *s)


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "Q2 · A: one Questions list, by place",
              "One list for every question, wherever it was written: open first, by place in Bible order, then those "
              "with no place. A click goes to where it was written (the verse, or the page at its line); the circle "
              "answers it. Its writing place is a caption, not a kind.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Questions", "3 open · 1 answered · wb question list")
    tb = row(p, "filter", gap=8, W="fill")
    P.segmented(tb, ["Open", "Answered", "All"], "Open", W="hug")
    P.field(tb, "Narrow by words or a place")
    text(p, "NUMBERS", "label", "muted")
    for s in SAMPLE[:2]:
        qrow(p, *s)
    text(p, "NO PLACE", "label", "muted")
    qrow(p, *SAMPLE[3])

    f = Q.win(r, PG, "Q3 · A: asking from the reader",
              "Ask a question (?) on a verse writes it beside the verse in the margin (reader C), with the cursor in "
              "it; Enter keeps it. It is a question at that place; a later page on the verse can take it in (wb "
              "question fold).")
    w = K.app(f)
    K.reader(f, w, W - w - 300, NUM25, "Numbers 25", sel=(11, 0, 999))
    mg = col(f, "margin", gap=10, pad=[16, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    K.Q.put(mg, W - 300, TB, 300, H - TB)
    frame(mg, "space", w=10, h=250, W="fixed", H="fixed")
    box = col(mg, "asking", gap=6, pad=[10, 10, 10, 10], radius=8, stroke="question", sw=1, fill="surface", W="fill")
    rr = row(box, "head", gap=6)
    icon(rr, "question", 14, "question")
    text(rr, "25:11", "caption", "muted")
    para(box, "What is the covenant of peace given here?|", "small")
    text(box, "Enter keeps it · Esc leaves it", "caption", "muted")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "Q4 · B: a question is only ever a line in a page",
              "Every question is a callout in some page: a question at a verse goes in that verse's page (made if "
              "there is none), a placeless one in today's page. One way to ask, answer and delete. The trail and "
              "Inbox kinds are folded in once, with the person's go-ahead (wb question fold).")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, W - w, H - TB, "Numbers 25:11", "the verse's page", fill="bg")
    para(pg, "A drawn sample of a page's paragraph.", "body", "muted")
    for q, open_ in (("What is the covenant of peace given here?", True), ("Where else is an everlasting priesthood "
                                                                           "promised?", True)):
        it = row(pg, "callout", gap=10, pad=[10, 12, 10, 12], radius=8, fill="accentSoft" if open_ else "sunken",
                 W="fill", stroke="question", strokeLeftWeight=3, strokeRightWeight=0, strokeTopWeight=0,
                 strokeBottomWeight=0)
        icon(it, "question", 18, "question")
        para(it, q, "body")
        P.button(it, "Answered", "ghost", "check", size="sm")

    f = Q.win(r, PG, "Q5 · Answering: a line under the question",
              "Answered asks for an optional line, kept under the question in the same page (an ordinary paragraph "
              "after the > [!done] callout). The answer is the person's own words; the app suggests none.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, W - w, H - TB, "Numbers 25:11", "the verse's page", fill="bg")
    it = row(pg, "callout", gap=10, pad=[10, 12, 10, 12], radius=8, fill="sunken", W="fill", stroke="ok",
             strokeLeftWeight=3, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    icon(it, "check", 18, "ok")
    para(it, "What is the covenant of peace given here?", "body", "muted")
    ans = col(pg, "answer", gap=4, pad=[8, 12, 8, 40], W="fill")
    text(ans, "Your answer (optional)", "caption", "muted")
    P.field(ans, "Write what you found…", icon_name="pen")


def callout(p, q, open_=True, place=None):
    it = row(p, "callout", gap=10, pad=[10, 12, 10, 12], radius=8, fill="accentSoft" if open_ else "sunken", W="fill",
             stroke="question" if open_ else "ok", strokeLeftWeight=3, strokeRightWeight=0, strokeTopWeight=0,
             strokeBottomWeight=0)
    icon(it, "question" if open_ else "check", 18, "question" if open_ else "ok")
    tc = col(it, "text", gap=2, W="fill")
    para(tc, q, "body", "fg" if open_ else "muted")
    if place:
        text(tc, place, "caption", "muted")
    return it


def round2(board):
    """Round 2 (2026-11-12): the person chose B plus a list view. Every question is a callout line in a page; this
    round draws where the list of them lives, where a question with no place goes, and asking from the reader."""
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Questions, round 2",
                  "Questions are only lines in pages (decided 2026-11-12). The list as a block in a page (Q6) or as a "
                  "Library section (Q7); a question with no place when Today is off (Q8, Q9); asking from the reader "
                  "writes into the verse's page, shown in the margin (Q10, Q11).")
    r = row(cv, "the list", gap=64, align="min")
    f = Q.win(r, PG, "Q6 · List 1: a saved list in a page",
              "The list is a block you put in any page: a saved list (settings S5) whose line is notebook questions, "
              "optionally @a place or open only. It lists each question with the page it is in; ticking one answers "
              "it in its own page. A page called Questions holding only this block is the old tab, kept by choice.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, W - w, H - TB, "Open questions", "a page holding one saved list", fill="bg")
    blk = col(pg, "saved list", gap=8, pad=[12, 14, 12, 14], radius=10, stroke="line", sw=1, fill="surface", W="fill")
    hd = row(blk, "head", gap=8, W="fill")
    icon(hd, "list", 16, "muted")
    text(hd, "notebook questions open", "caption", "muted", W="fill")
    P.chip(hd, "Open", "selected")
    P.chip(hd, "All places", "outline")
    for place, q, open_, where in SAMPLE:
        if open_:
            callout(blk, q, True, (place or "no place") + " · " + where.replace("at the verse", "in the page Numbers 25:11")
                    .replace("with no place", "in the page Tuesday study"))

    f = Q.win(r, PG, "Q7 · List 2: a Questions section in the Library",
              "The Library's drawer has a Questions section under Pages: a count of open ones, opened to the list "
              "grouped by book. Nothing to set up; it cannot be put in a page. The list is the same as Q6's.")
    w = K.app(f, on="Notebook")
    lib = K.panel(f, w, TB, 340, H - TB, "Library", None, fill="sunken")
    for n, ic, on, right in (("Pinned", "bookmark", False, "4"), ("Pages", "page", False, "38"),
                             ("Questions", "question", True, "3 open"), ("Shelf", "shelf", False, "")):
        K.line(lib, n, None, ic, right=right, on=on)
    p = K.panel(f, w + 340, TB, W - w - 340, H - TB, "Questions", "3 open · in 2 pages", fill="bg")
    P.segmented(p, ["Open", "Answered", "All"], "Open", W="hug")
    text(p, "NUMBERS", "label", "muted")
    for place, q, open_, where in SAMPLE[:2]:
        callout(p, q, True, place + " · in a page")
    text(p, "NO PLACE", "label", "muted")
    callout(p, SAMPLE[3][1], True, "in a page")

    r = row(cv, "no place", gap=64, align="min")
    f = Q.win(r, PG, "Q8 · No place 1: it goes in the page you are in",
              "A question asked with no verse is written in the page open in front, at the cursor, as any block is. "
              "With no page open, the command field asks which page (the last few first, or a new one). Today is "
              "never made for it.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, 640, H - TB, "Tuesday study", "the page in front (a drawn sample)", fill="bg")
    para(pg, "A drawn sample of a page's paragraph.", "body", "muted")
    callout(pg, SAMPLE[3][1])
    p = K.floating(f, "which page", w + 680, TB + 60, 380, gap=2)
    text(p, "No page is open. Write the question in:", "small", "muted")
    for n, on in (("Tuesday study", True), ("Phinehas", False), ("Reading notes", False)):
        K.line(p, n, None, "page", on=on)
    K.line(p, "A new page", None, "plus")

    f = Q.win(r, PG, "Q9 · No place 2: a Questions page of its own",
              "A question with no verse and no page goes in one page named Questions, made the first time (a page "
              "like any other, pinned or not). Today stays optional and is never needed. Moving the line to another "
              "page later is a drag.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, W - w, H - TB, "Questions", "a page made for questions with no place", fill="bg")
    callout(pg, SAMPLE[3][1])
    callout(pg, "Look up every use of the covenant of peace?")
    K.note(f, "Q8 and Q9 can go together: the page in front when there is one, the Questions page when not.",
           W - 470, H - 90, 420)

    r = row(cv, "asking", gap=64, align="min")
    f = Q.win(r, PG, "Q10 · Asking from the reader, into the verse's page",
              "Ask a question (?) on a verse opens a line in the margin beside it, as in round 1, but Enter writes "
              "it as a callout at the end of the verse's page (Numbers 25:11, made if there is none). The margin "
              "shows the question's words, which are the page's line.")
    w = K.app(f)
    K.reader(f, w, W - w - 300, NUM25, "Numbers 25", sel=(11, 0, 999))
    mg = col(f, "margin", gap=10, pad=[16, 14, 16, 14], W="fixed", H="fixed", stroke="line", strokeLeftWeight=1,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(mg, W - 300, TB, 300, H - TB)
    frame(mg, "space", w=10, h=250, W="fixed", H="fixed")
    box = col(mg, "asking", gap=6, pad=[10, 10, 10, 10], radius=8, stroke="question", sw=1, fill="surface", W="fill")
    rr = row(box, "head", gap=6)
    icon(rr, "question", 14, "question")
    text(rr, "25:11", "caption", "muted")
    para(box, SAMPLE[0][1] + "|", "small")
    text(box, "Enter writes it in the page Numbers 25:11", "caption", "muted")

    f = Q.win(r, PG, "Q11 · The verse's page after asking",
              "The verse's page as it then is: its title is the place, the question its last line. Opening it from "
              "the margin's line goes to that line; answering there or in the list is the same tick.")
    w = K.app(f, on="Notebook")
    K.reader(f, w, W - w - 520, NUM25, "Numbers 25")
    p = K.M.pane(f, W - 520, TB, 520, H - TB, ["Numbers 25:11"], "Numbers 25:11")
    text(p, "Numbers 25:11", "title")
    text(p, "a page at a place · made when the question was asked", "caption", "muted")
    callout(p, SAMPLE[0][1])


def sheets(board):
    round2(board)
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Questions, round 1",
                  "Today (Q1); A, one Questions list and asking in the reader's margin (Q2, Q3); B, a question is only "
                  "a line in a page, answered with an optional line (Q4, Q5).")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Questions", sheets)
