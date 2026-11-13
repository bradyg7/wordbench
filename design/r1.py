"""R1 of the redesign round (docs/archive/2026-11-10/docs/debug-spec.md R1, findings 38c2, 7d00 and d84d, 2026-11-09): the sheets for "everything
is a page", drawn with FigCraft as the workspace and filter rounds were (it reuses workspace.py's, filter.py's and
phase2b.py's helpers, so the sheets look alike). Nothing is built from these sheets until the person accepts them; the
reasons and the other choices are in docs/archive/2026-11-10/docs/redesign-R1.md.

    python design/r1.py     # writes design/r1.figcraft and design/exports/r1/*.png

What the sheets show, in one line: nothing in the study folder moves. The window stops showing "notes", "threads" and
"questions" as separate kinds and shows pages; a thread is the thread file read as a page (its note as blocks, its places
as blocks, the pages written on it); `/?`, `/~` and `/word` are three more blocks in the / menu.

Scripture on the sheets comes only from content.json (fetched from the database with wb text); the lexicon lines are
`wb preview`'s. Everything else is demo writing about the Phinehas demo, never scripture and never commentary.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import workspace as WS  # noqa: E402
from figlib import S, col, frame, icon, para, rect, row, shadow, spacer, text  # noqa: E402

C = B.C
W, H, TB = Q.W, Q.H, Q.TB
BOARD = "R1"
PG = "Everything is a page"
READER_W, NB_X, NB_W, SIDE_W = WS.READER_W, WS.NB_X, WS.NB_W, WS.SIDE_W


# ---- the pieces ---------------------------------------------------------------------------------------------------------
def toolbar(f, active="Notebook"):
    """The toolbar as built, without Threads: the Notebook holds them now (R1)."""
    bar = row(f, "toolbar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, 0, 0, W, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "accent")
    text(pl, "Numbers 25", "bodyStrong")
    icon(pl, "down", 14, "muted")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1,
              W="fixed", H="fixed")
    Q.put(cmd, 0, 0, 420, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "Search, go to a place, or type a command", "small", "muted", W="fill", maxLines=1)
    P.kbd(cmd, "`")
    spacer(bar)
    tools = row(bar, "tools", gap=4)
    P.tool(tools, "KJV", "book")
    P.tool(tools, "Notebook", "notebook", active == "Notebook", count=None)
    P.tool(tools, "Shelf", "shelf")
    P.tool(tools, "Highlights", "highlight", caret=True)
    P.icon_button(tools, "more", "fg", size=34, icon_size=20)
    return bar


def window(parent, title, about, reader_first=6, reader_last=10, reader=True, marks=None):
    f = Q.win(parent, PG, title, about)
    toolbar(f)
    if reader:
        B.desk_reader(f, 0, TB, READER_W, H - TB, first=reader_first, last=reader_last, marks=marks or WS.MARKS)
    return f


def thread_item(side, title, color="threadA", depth=0, on=False, kids=None, sub=None):
    """A thread in the tree: a page with its color's dot where other pages have the page icon."""
    r = row(side, f"thread/{title}", gap=6, pad=[6, 8, 6, 8 + 16 * depth], radius=8, fill="accentSoft" if on else None,
            W="fill")
    if kids is None:
        frame(r, "no arrow", w=14, h=14, W="fixed", H="fixed")
    else:
        icon(r, "down" if kids else "right", 14, "muted")
    F.dot(r, color, 10)
    text(r, title, "smallStrong" if on else "small", "accent" if on else "fg", W="fill", maxLines=1)
    if sub:
        text(r, sub, "caption", "muted")
    return r


def question_item(side, title, depth=0, answered=False):
    r = row(side, f"question/{title}", gap=6, pad=[6, 8, 6, 8 + 16 * depth], radius=8, W="fill")
    frame(r, "no arrow", w=14, h=14, W="fixed", H="fixed")
    icon(r, "check" if answered else "question", 16, "ok" if answered else "question")
    text(r, title, "small", "muted" if answered else "fg", W="fill", maxLines=1)
    return r


def sidebar(side, on=None, threads_open=True, questions_open=False):
    """The sidebar after R1: no Threads section (a thread is a page in Pages), Questions as a view of every question."""
    P.field(side, "Search every page", None, icon_name="search", height=34)
    row(side, "gap", W="fill", pad=[2, 0, 2, 0])
    WS.side_head(side, "Today")
    WS.side_item(side, "Monday, November 9", icon_name="pen")
    WS.side_head(side, "Pinned", 2)
    WS.side_item(side, "Lesson: Phinehas", icon_name="notebook")
    thread_item(side, "Phinehas", on=on == "Phinehas (pinned)")
    WS.side_head(side, "Pages", 7, plus=True)
    WS.side_item(side, "Lesson: Phinehas", kids=True, on=on == "Lesson: Phinehas")
    WS.side_item(side, "Outline", depth=1)
    WS.side_item(side, "The passage", depth=1)
    thread_item(side, "Phinehas", kids=threads_open, on=on == "Phinehas")
    if threads_open:
        WS.side_item(side, "Which Phinehas is which", depth=1, icon_name="notebook")
        WS.side_item(side, "Read these in order", depth=1, icon_name="notebook")
    thread_item(side, "Phinehas echoes", color="threadB", kids=False)
    WS.side_item(side, "Word study: H7065", kids=False, icon_name="word", on=on == "Word study: H7065")
    question_item(side, "24,000 or 23,000?")
    WS.side_head(side, "At the reader", 6, open_=False)
    WS.side_head(side, "Questions", 3, open_=questions_open)
    if questions_open:
        question_item(side, "How do the two numbers relate?")
        question_item(side, "Where else is the word used?")
        question_item(side, "Who was the daughter of Zur?")
    spacer(side)
    foot = row(side, "foot", gap=14, pad=[8, 6, 2, 6], W="fill")
    for lbl, ic in (("Templates", "docs"), ("Trash", "close")):
        b = row(foot, f"foot/{lbl}", gap=6)
        icon(b, ic, 15, "muted")
        text(b, lbl, "small", "muted")
    return side


def place_row(pg, key, first, last, ref, marks=None, grip=True, name=None):
    """One place of a thread, drawn on its page as a scripture block: its reference and the passage from the database."""
    r = row(pg, name or f"place/{ref}", gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    if grip:
        icon(g, "drag", 16, "muted")
    card = col(r, "place", gap=8, pad=[10, 14, 12, 14], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    head = row(card, "head", gap=8, W="fill")
    icon(head, "book", 15, "accent")
    text(head, ref, "smallStrong", "accent")
    text(head, "· KJV", "caption", "muted")
    spacer(head)
    WS.chip_menu(head, "Open", "book")
    icon(head, "close", 14, "muted")
    F.verses(card, B.vv(key, first, last), "readSmall", marks or {})
    return card


def word_block(pg, strong, grip=False, name="word block", compact=False):
    """A word block: the lexicon's entry for a Strong's number, drawn from the database; the file keeps the number."""
    r = row(pg, name, gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    if grip:
        icon(g, "drag", 16, "muted")
    card = col(r, "entry", gap=10, pad=[12, 14, 14, 14], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    head = row(card, "head", gap=8, W="fill")
    icon(head, "word", 15, "accent")
    text(head, strong, "smallStrong", "accent")
    text(head, "· Strong's", "caption", "muted")
    spacer(head)
    WS.chip_menu(head, "Open", "word")
    P.lexicon_block(card, C["lexicon"][strong], None if compact else C["count"].get(strong), compact=compact)
    return card


def thread_block(pg, name, color, refs, grip=False, n=None):
    """A `~` block: a thread's places in a page, kept up to date (like a view). References only; Open shows the page."""
    r = row(pg, "thread block", gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    if grip:
        icon(g, "drag", 16, "muted")
    card = col(r, "thread", gap=8, pad=[12, 14, 12, 14], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    head = row(card, "head", gap=8, W="fill")
    F.dot(head, color, 10)
    text(head, name, "smallStrong")
    text(head, f"· {n or len(refs)} places", "caption", "muted")
    spacer(head)
    WS.chip_menu(head, "Open the page", "notebook")
    ch = row(card, "refs", gap=6, wrap=True, W="fill")
    for rf in refs:
        P.chip(ch, rf, "place", icon_name="place")
    if n and n > len(refs):
        P.chip(ch, f"+ {n - len(refs)} more", "quiet")
    return card


def question_block(pg, s, answered=False, grip=False, editing=False, name=None):
    """A `/?` block: the question, open until it is answered (a tick, as a to-do has). In the file: a callout line."""
    r = row(pg, name or f"question/{s[:24]}", gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    if grip:
        icon(g, "drag", 16, "muted")
    if editing:
        box = row(r, "editing", pad=[6, 10, 6, 10], radius=8, stroke="accent", sw=1, fill="surface", W="fill")
        text(box, s, "body", W="fill", fontFamily="Inter")
        return r
    card = row(r, "question", gap=10, pad=[9, 12, 9, 12], radius=10, W="fill", stroke="line" if answered else "question",
               sw=1, fill="sunken" if answered else None)
    icon(card, "check" if answered else "question", 17, "ok" if answered else "question")
    text(card, s, "body", "muted" if answered else "fg", W="fill")
    P.chip(card, "Answered" if answered else "Mark answered", "quiet")
    return card


def page_top(pg, crumbs, title, chips=(), sub=None):
    """WS.page_head, with chips as (kind, label[, color]): place, thread (in its color) or quiet."""
    WS.page_head(pg, crumbs, title, [], sub=sub)
    if chips:
        ch = row(pg, "places and threads", gap=8, wrap=True, W="fill")
        for k, lbl, *rest in chips:
            if k == "thread":
                P.chip(ch, lbl, "outline", dot_color=rest[0] if rest else "threadA")
            elif k == "quiet":
                P.chip(ch, lbl, "quiet")
            else:
                P.chip(ch, lbl, "place", icon_name="place")


def new_tag(parent):
    b = row(parent, "new", pad=[1, 6, 1, 6], fill="accent", radius=999)
    text(b, "new", "caption", "onAccent", fontSize=10, lineHeight="14px")
    return b


# ---- the table: what each thing is ---------------------------------------------------------------------------------------
COLS = (360, 380, 520, 700)


def trow(parent, cells, head=False, shade=False):
    r = row(parent, f"row/{cells[0][:24]}", gap=0, pad=[8, 12, 8, 12], fill="sunken" if head else ("bg" if shade else None),
            radius=8, W="fill", align="min")
    for i, (w, s) in enumerate(zip(COLS, cells)):
        c_ = col(r, f"cell {i}", gap=0, W="fixed")
        Q.put(c_, 0, 0, w - 16)
        if head:
            text(c_, s, "label", "muted")
        else:
            para(c_, s, "small" if i != 0 else "smallStrong", "fg" if i != 1 else "muted", fontFamily="Inter")
    return r


def what_is_what(parent):
    card = col(parent, "what each thing is", gap=2, pad=[16, 14, 16, 14], fill="surface", radius=16, stroke="line", sw=1,
               W="fixed")
    Q.put(card, 0, 0, sum(COLS) + 28)
    text(card, "What each thing is: the files stay, the window says \"page\"", "title")
    para(card, "The first column is what the person sees today. The second is its file, which does not move and keeps "
         "the Python app's format. The third is what the window calls it after R1. The last is what is new in a file, "
         "and only when the person writes the new thing.", "small", "muted")
    trow(card, ("Today", "Its file (unchanged)", "In the window after R1", "What is new in a file"), head=True)
    for i, cells in enumerate((
            ("A note on a verse, word or phrase", "notes/<BOOK>/n_….md, with an anchor", "A page with a place (the place is a chip)", "Nothing."),
            ("A note with no place (a page since W1)", "notes/_inbox/n_….md", "A page", "Nothing. parent, order and pinned, as W3 made them."),
            ("A note written on a thread", "notes/_threads/n_….md, threads: [id]", "A page on a thread: listed under the thread's page, and on its own", "Nothing."),
            ("Today's page", "notes/_days/<day>.md", "Today's page", "Nothing."),
            ("A question at a verse (Ctrl+J, the pen's ?)", "trails/q_….md, status open or done (the Python app's trails)", "A question: a page that is one question, listed in Questions and at its verse", "Nothing."),
            ("A question while writing", "(none yet)", "A question block in the page, ticked when answered; listed in Questions and at its page's place", "A callout line in the page's Markdown: > [!question] …"),
            ("A thread", "threads/<slug>.md: name, color, its note, its places", "A page: the note as blocks, the places as blocks, the pages on it, its documents. Pinned or in the tree like any page", "Nothing in the thread file. Its place in the tree is in settings/pages.json (new; the Python app passes over it)."),
            ("A word note", "notes/_words/n_….md, anchor H7065", "A page placed at H7065, with a word block at its top if the person adds one", "A fenced word block: ```word then H7065 (the number only)."),
            ("A thread inside another page", "(none yet)", "A thread block (/~): the thread's places, kept up to date, like a view", "A fenced thread block: ```thread then the thread's id."),
            ("A document from a thread or a page", "documents/thread-….json, page-….json", "Made from the thread page or from any page, as now", "Nothing. Thread records keep source: thread, so both apps still list them."))):
        trow(card, cells, shade=i % 2 == 0)
    return card


# ---- the sheet ------------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "Everything is a page", "R1 of the debug spec, findings 38c2, 7d00 and d84d: \"we need to get rid "
                  "of 'notes'. everything needs to appear as a page, even notes in threads\"; \"threads, questions, "
                  "notes etc. were different block options within a page\"; \"the separate threads tab ... just seems "
                  "like legacy stuff\". Eight windows. The idea they draw: the window says page for everything and no "
                  "file in the study folder moves. A thread is its thread file read as a page; a question and a word "
                  "become blocks you can write; the Threads button goes. The reasons and the other ways are in "
                  "docs/archive/2026-11-10/docs/redesign-R1.md; nothing is built until the person accepts a way.")
    what_is_what(cv)

    # R1.1 the sidebar after ------------------------------------------------------------------------------------------------
    r = row(cv, "row 1", gap=64, align="min")
    f = window(r, "R1.1 · One list: the Notebook after R1", "No Threads section and no Threads button. A thread is in "
               "Pages with its color's dot, and the notes written on it are inside it (a note can be on several "
               "threads; it shows under each). A question is a page with a ? and, answered, a tick. Questions stays "
               "as a section, now a view of every question, wherever it is written. The page on the right is any "
               "page; what it has (a place, a thread, a question) shows as chips, not as a kind.")
    side, pg = WS.notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    WS.page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25", "+ Place"])
    WS.block(pg, "h", "Aim")
    WS.block(pg, "p", "Read Numbers 25 with the group, then Psalm 106:28–31 beside it.")
    question_block(pg, "How do the two numbers relate?", name="question block")
    WS.block(pg, "h", "Before Tuesday")
    WS.block(pg, "todo", "Print the verse deck")
    WS.page_foot(pg, kids=("Outline", "The passage"), linked=[("Monday, November 9", "today's page")])
    Q.files_note(pg, "Files: nothing moved. The sidebar reads the same folders as before; the Threads section is gone "
                 "because the threads are in Pages.")

    # R1.2 a thread as a page -----------------------------------------------------------------------------------------------
    f = window(r, "R1.2 · A thread as a page", "The thread's file, read as a page. Its note is the page's text, written in "
               "blocks; its places are scripture blocks and word blocks in the thread's own order (drag by the grip, "
               "× takes one out, Open asks where); the pages written on the thread are listed under them. The color "
               "is still the underline in the reader. Sort, Filter and Make a document are what the Threads window "
               "had. The verses show here, which was the first half of finding d84d.")
    side, pg = WS.notebook(f)
    sidebar(side, on="Phinehas")
    WS.page_head(pg, ["Pages", "Phinehas"], "Phinehas", [])
    ctl = row(pg, "thread controls", gap=8, W="fill")
    WS.chip_menu(ctl, "Orange", None, strong=True)
    WS.chip_menu(ctl, "Your order", "list")
    P.chip(ctl, "Filter places", "quiet", icon_name="filter")
    spacer(ctl)
    P.button(ctl, "Make a document", "soft", "docs", size="sm")
    WS.block(pg, "p", "The places I am gathering where the name is used, in the order I mean to read them.")
    head = row(pg, "places head", gap=8, W="fill")
    text(head, "Places", "smallStrong", "muted")
    text(head, "7 · 6 verses, 1 word", "caption", "muted")
    spacer(head)
    P.chip(head, "+ Place", "quiet")
    place_row(pg, "num25", 7, 7, "Numbers 25:7", {7: WS.MARKS[7]}, grip=True)
    place_row(pg, "ps106", 30, 30, "Psalms 106:30", grip=True)
    fold = row(pg, "more places", gap=8, pad=[4, 0, 4, 24], W="fill")
    text(fold, "4 more places", "small", "muted")
    word_block(pg, "H6372", compact=True, name="word place")
    WS.page_foot(pg, kids=("Which Phinehas is which", "Read these in order"))
    Q.files_note(pg, "Files: threads/phinehas.md as it is: its note above the anchors list, its places in it. A note "
                 "edited here is saved there, and the Python app reads it as it always did.")

    # R1.3 / menu -----------------------------------------------------------------------------------------------------------
    r = row(cv, "row 2", gap=64, align="min")
    f = window(r, "R1.3 · Writing: three new blocks", "Three more blocks in the / menu, beside Scripture and View. /? is a "
               "question, open until it is answered (the tick is the to-do's). /~ is a thread block: that thread's "
               "places, kept up to date, so a lesson can hold a thread without copying it. /word is a word block: a "
               "Strong's entry from the lexicon (R1.5). The existing \"Page inside this one\" is the /note of finding 7d00. In the "
               "file: a question is a callout line (> [!question] …, > [!done] … when answered); a thread and a word "
               "are fenced blocks that hold only an id and a number, as a view holds only its line.")
    side, pg = WS.notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    WS.page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25"])
    WS.block(pg, "h", "Questions for the group")
    question_block(pg, "How do the two numbers relate?", grip=True)
    question_block(pg, "Where else is the word used?", answered=True)
    thread_block(pg, "Phinehas", "threadA", ["Numbers 25:7", "Psalms 106:30", "Judges 20:28"], n=7)
    WS.block(pg, "editing", "/", grip=True)
    m = Q.popover(f, NB_X + SIDE_W + 70, 600, 380, name="slash menu")
    text(m, "Add a block · type to narrow it", "caption", "muted")
    for lbl, sub_, ic, on, kb in (("Question", "Open until you answer it", "question", True, "/?"),
                                  ("Thread", "A thread's places, kept up to date", "threads", False, "/~"),
                                  ("Word", "A Strong's entry from the lexicon", "word", False, "/word"),
                                  ("Scripture", None, "book", False, None)):
        it = Q.menu_item(m, lbl, sub_, on=on, icon_name=ic, kbd=kb)
        if kb:
            new_tag(it)

    # R1.4 questions ----------------------------------------------------------------------------------------------------------
    num9 = C["num25"]["verses"][8]["text"]
    part = " ".join(num9.rstrip(".").split()[-4:])
    f = window(r, "R1.4 · Questions: written anywhere, found at the verse", "A question written in a page, or asked at "
               "a verse as now, is one question to the person: Questions lists both, the reader shows a ? on the verse "
               "of the page it is written in, and the card at a verse lists every question there, including one asked "
               "of part of a verse (finding c39a). The verse's own questions come first.",
               marks={9: {"question": True}, 11: WS.MARKS[11]})
    side, pg = WS.notebook(f)
    sidebar(side, on="Questions", questions_open=True)
    WS.page_head(pg, ["Questions"], "Questions", [], sub="open · 3 found")
    WS.view_block(pg, "notebook questions open",
                  [("How do the two numbers relate?", "its own page · Numbers 25:9", True),
                   ("Where else is the word used?", "in Lesson: Phinehas", True),
                   ("Who was the daughter of Zur?", "its own page · Numbers 25:15", True)], name="questions view")
    Q.files_note(pg, "Files: the two ways are kept: the pen's ? still writes a trail (the Python app's Trails shows it); "
                 "a /? is a line in its page. The list does not care which.")
    m = Q.popover(f, 40, 268, 420, name="card at the verse")
    hd = row(m, "head", gap=8, W="fill")
    text(hd, "Numbers 25:9", "smallStrong", "accent")
    text(hd, "· pages and questions here", "caption", "muted")
    spacer(hd)
    P.icon_button(hd, "close", "muted", size=28, icon_size=14)
    text(m, "Questions · 2", "label", "muted")
    for t_, where, sub_ in (("How do the two numbers relate?", "its own page", None),
                            ("Where else is the word used?", "Lesson: Phinehas", f"on “{part}”")):
        q = col(m, f"q/{t_[:18]}", gap=3, pad=[8, 10, 8, 10], radius=8, fill="bg", W="fill")
        qr = row(q, "row", gap=8, W="fill")
        icon(qr, "question", 16, "question")
        text(qr, t_, "body", W="fill")
        qc = row(q, "where", gap=6, pad=[0, 0, 0, 24])
        P.chip(qc, where, "quiet", icon_name="notebook")
        if sub_:
            text(qc, sub_, "caption", "muted")
    text(m, "Pages · 1", "label", "muted")
    pr = row(m, "page", gap=8, pad=[8, 10, 8, 10], radius=8, fill="bg", W="fill")
    icon(pr, "notebook", 16, "accent")
    text(pr, "24,000 or 23,000?", "body", W="fill")

    # R1.5 word studies ------------------------------------------------------------------------------------------------------
    r = row(cv, "row 3", gap=64, align="min")
    f = window(r, "R1.5 · A word study", "A word study is a page placed at a Strong's number: the person's own writing. "
               "A word block at its top draws the entry from the lexicon (the number is all the file keeps). The "
               "English definition waits for the person's choice of source (R5); the slot is held, empty. The threads "
               "that hold the word are chips, as a note's threads are.")
    side, pg = WS.notebook(f)
    sidebar(side, on="Word study: H7065")
    page_top(pg, ["Pages", "Word study: H7065"], "Word study: H7065", [("place", "H7065"), ("thread", "Phinehas echoes", "threadB")])
    word_block(pg, "H7065", grip=True)
    slot = row(pg, "definition slot", gap=8, pad=[10, 12, 10, 12], radius=10, stroke="line", sw=1, fill="surface",
               W="fill", dashes=[4, 4])
    icon(slot, "docs", 16, "muted")
    text(slot, "English definition", "smallStrong", "muted")
    text(slot, "waits for the source you choose (R5)", "small", "muted", W="fill")
    WS.block(pg, "h", "Renderings")
    WS.block(pg, "p", "List the KJV's renderings first, then read each verse before writing anything about it.")
    WS.block(pg, "h", "Every use in the Psalms")
    WS.block(pg, "li", "Numbers 25:11 and 25:13")
    Q.files_note(pg, "Files: the existing notes/_words/ note is this page (its anchor is H7065). The word block is two "
                 "lines of fence: ```word, then H7065. The entry is never copied into the file.")

    # R1.6 documents -------------------------------------------------------------------------------------------------------------
    f = window(r, "R1.6 · Documents from a thread page", "A thread page makes its documents exactly as the thread does: "
               "the source is still the thread, so the records keep their names (thread-phinehas-script.json) and "
               "both apps still list them, and nothing about a plan changes, so the two apps' fingerprints still "
               "agree. Make again, the preview and the rest are the page's, as W7.4 drew them.")
    side, pg = WS.notebook(f)
    sidebar(side, on="Phinehas")
    WS.page_head(pg, ["Pages", "Phinehas"], "Phinehas", [])
    ctl = row(pg, "thread controls", gap=8, W="fill")
    WS.chip_menu(ctl, "Orange", None, strong=True)
    WS.chip_menu(ctl, "Your order", "list")
    spacer(ctl)
    P.button(ctl, "Make a document", "primary", "docs", size="sm")
    place_row(pg, "num25", 7, 7, "Numbers 25:7", {7: WS.MARKS[7]}, grip=True)
    fold = row(pg, "more places", gap=8, pad=[4, 0, 4, 24], W="fill")
    text(fold, "6 more places", "small", "muted")
    WS.docs_foot(pg, [("Speaker Script - Phinehas.docx", "docs", "made 9 Nov, 14:20", True),
                      ("Verse by Verse - Phinehas.pdf", "pdf", "made 8 Nov, 03:08", False)])
    Q.files_note(pg, "Files: documents/thread-phinehas-script.json and thread-phinehas-verse-pdf.json, as today, with "
                 "source: thread. scripts/doc-plans.py keeps comparing this app's plans with the Python app's, thread by thread.")

    # R1.7 what goes in for a page with a thread block -----------------------------------------------------------------------------
    r = row(cv, "row 4", gap=64, align="min")
    f = window(r, "R1.7 · A page that holds a thread block, made into a document", "In What goes in, a question is a "
               "row (your words, as lines), and a thread block is a row: its places go in as a thread's do, each verse "
               "from the Bible with your notes there as Study lines. A word block is left out unless switched on. "
               "These make page-… records, which only this app lists, as W6 did for pages.", reader=False)
    side, pg = WS.notebook(f, x=0, w=W)
    sidebar(side, on="Lesson: Phinehas")
    WS.page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    md = Q.modal(f, 780, title="What goes in", sub="Lesson: Phinehas · Speaker Script and Verse by Verse · Olivet · KJV", y=140)
    tbl = col(md, "blocks", gap=2, pad=[6, 8, 6, 8], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    for kind_, what, becomes, ic, on in (
            ("Heading", "Questions for the group", "A section", "type", True),
            ("Question", "2 questions", "Your words, as lines (answered ones too)", "question", True),
            ("Thread", "Phinehas · 7 places", "The verses from the Bible, with your notes there as Study lines", "threads", True),
            ("Word", "H7065", "Left out (switch it on for the entry as a Study line)", "word", False)):
        it = row(tbl, f"goes in/{what[:20]}", gap=10, pad=[8, 8, 8, 8], radius=8, W="fill")
        Q.toggle(it, on)
        icon(it, ic, 16, "accent" if on else "muted")
        tc = col(it, "what", gap=0, W="fixed")
        Q.put(tc, 0, 0, 200)
        text(tc, kind_, "caption", "muted")
        text(tc, what, "body", "fg" if on else "muted", maxLines=1)
        icon(it, "right", 16, "muted")
        text(it, becomes, "small", "fg" if on else "muted", W="fill")
    Q.buttons(md, ("Back", "secondary"), ("Make them", "primary"))

    # R1.8 the check before anything is written ------------------------------------------------------------------------------------
    f = window(r, "R1.8 · The check: nothing is rewritten", "Before the first build touches the person's real folder, and any "
               "time after, Check the study folder reads every file (it opens the folder the way the Python app does "
               "and the way this one does) and reports what it holds. It writes nothing. The counts are the real "
               "folder's on 9 November, read only. With this design the answer to \"which files would change\" is none; "
               "the sheet is the check a larger migration would also need.", reader=False)
    side, pg = WS.notebook(f, x=0, w=W)
    sidebar(side, on="Lesson: Phinehas")
    WS.page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    md = Q.modal(f, 760, title="Check the study folder", sub="Reads only. A copy first: scripts/backup-study.ps1 (hashed).", y=80)
    box = col(md, "counts", gap=0, pad=[6, 12, 6, 12], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    for k, v in (("Notes: 96 files", "40 at a place, 52 with no place, 3 on a thread, 1 on a word"),
                 ("Threads: 7 files", "146 places in all; 5 colors in use"),
                 ("Questions: 8 trails, 1 in the Inbox", "all open"),
                 ("Sets: 4 · Lessons: 1 · Documents: 3 records", "1 from a thread, 1 page's (a script and a deck)"),
                 ("Highlights: 17 books' files", "")):
        rr = row(box, f"count/{k[:14]}", gap=10, pad=[8, 4, 8, 4], W="fill")
        text(rr, k, "smallStrong")
        spacer(rr)
        text(rr, v, "small", "muted")
    for ok_, s in ((True, "The Python app opens it: 41 notes (those with a place), 7 threads, 8 trails, 4 sets, 146 places"),
                   (True, "Every thread's documents plan to the same fingerprint in both apps (14 of 14)"),
                   (True, "Files that would be written: 0")):
        rr = row(md, "result", gap=8, W="fill")
        icon(rr, "check", 16, "ok")
        text(rr, s, "small", W="fill")
    Q.files_note(md, "The Python check is scripts/py-opens.py (new, built with the first change): the Python app's own "
                 "Study over a scratch copy, before and after. scripts/doc-plans.py is the fingerprint half.")
    Q.buttons(md, ("Copy the report", "secondary"), ("Close", "primary"))


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "r1.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "r1.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports" / "r1"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.5", "--out",
                    str(dest / "all.png")], check=True, capture_output=True)
    for title in Q.TITLES.get(PG, []):
        file = dest / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", "Window · " + title,
                        "--scale", "1", "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
