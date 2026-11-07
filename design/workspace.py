"""W2 of "The Notebook as a workspace" (2026-11-07): the design round for the workspace, drawn with FigCraft as the phase 2b
round was (it reuses phase2b.py's and build.py's helpers, so the sheets look alike).

    python design/workspace.py     # writes design/workspace.figcraft and design/exports/workspace/*.png

One page, "Workspace", holds every window. What each answers is in the plan (a Claude doc, "The Notebook as a
workspace") and the person's findings of 2026-11-06 (docs/phase2-results.md sections 19 and 20); the decisions of
2026-11-07 are drawn in: a note with no place is a page, pages are edited block by block. Scripture comes only from
content.json (fetched from the database with wb text); the writing shown is demo writing about the Phinehas demo, never
scripture and never commentary.
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
import phase2b as Q  # noqa: E402  (its helpers: win, toolbar, reader, put, popover, menu_item, files_note, modal...)
from figlib import S, col, frame, icon, para, rect, row, shadow, spacer, text  # noqa: E402

C = B.C
OUT = HERE / "exports" / "workspace"
W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Workspace"
PG = "The Notebook as a workspace"
READER_W = 500                     # the reader beside an expanded Notebook
NB_X, NB_W = READER_W, W - READER_W
SIDE_W = 270                       # the sidebar inside the Notebook


# ---- the Notebook, expanded: the sidebar and the page ------------------------------------------------------------------
def notebook(f, x=NB_X, w=NB_W):
    """The Notebook's column: its pane header, then the sidebar and the page side by side. → (sidebar, page)."""
    nb = frame(f, "notebook", x=x, y=TB, w=w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed",
               clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    P.pane_header(nb, ["Notebook"], "Notebook")
    two = row(nb, "sidebar and page", gap=0, W="fill", H="fill", align="min")
    side = col(two, "sidebar", gap=2, pad=[12, 10, 12, 10], fill="sunken", W="fixed", H="fill", clip=True,
               stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(side, 0, 0, SIDE_W)
    pg = col(two, "page", gap=14, pad=[22, 32, 22, 32], W="fill", H="fill", clip=True)
    return side, pg


def side_head(side, name, count=None, open_=True, plus=False):
    r = row(side, f"section/{name}", gap=6, pad=[10, 6, 4, 4], W="fill")
    icon(r, "down" if open_ else "right", 14, "muted")
    text(r, name.upper(), "label", "muted")
    if count is not None:
        b = row(r, "count", pad=[0, 6, 0, 6], fill="surface", radius=999)
        text(b, str(count), "caption", "muted", fontSize=11, lineHeight="16px")
    spacer(r)
    if plus:
        icon(r, "plus", 15, "muted")
    return r


def side_item(side, title, depth=0, on=False, kids=None, icon_name="notebook", sub=None, pin=False):
    """A page in the sidebar: an arrow when it has pages inside it, the page's name, a quiet line after it."""
    r = row(side, f"page/{title}", gap=6, pad=[6, 8, 6, 8 + 16 * depth], radius=8, fill="accentSoft" if on else None,
            W="fill")
    if kids is None:
        frame(r, "no arrow", w=14, h=14, W="fixed", H="fixed")
    else:
        icon(r, "down" if kids else "right", 14, "muted")
    icon(r, icon_name, 16, "accent" if on else "muted")
    text(r, title, "smallStrong" if on else "small", "accent" if on else "fg", W="fill", maxLines=1)
    if sub:
        text(r, sub, "caption", "muted")
    if pin:
        icon(r, "place", 13, "muted")
    return r


def sidebar(side, on=None, lesson_open=True):
    P.field(side, "Search every page", None, icon_name="search", height=34)
    row(side, "gap", W="fill", pad=[2, 0, 2, 0])
    side_head(side, "Today")
    side_item(side, "Saturday, November 7", icon_name="pen", on=on == "Saturday, November 7")
    side_head(side, "Pinned", 2)
    side_item(side, "Lesson: Phinehas", icon_name="notebook", on=on == "Lesson: Phinehas (pinned)")
    side_item(side, "Word study: H7065", icon_name="word")
    side_head(side, "Pages", 7, plus=True)
    side_item(side, "Lesson: Phinehas", kids=lesson_open, on=on == "Lesson: Phinehas")
    if lesson_open:
        side_item(side, "Outline", depth=1, on=on == "Outline")
        side_item(side, "The passage", depth=1, on=on == "The passage")
        side_item(side, "Questions for the group", depth=1, on=on == "Questions for the group")
    side_item(side, "Word study: H7065", kids=False, on=on == "Word study: H7065")
    side_item(side, "Numbers: an outline", on=on == "Numbers: an outline")
    side_item(side, "24,000 or 23,000?", on=on == "24,000 or 23,000?")
    side_head(side, "At the reader", 6)
    side_item(side, "Numbers 25", icon_name="place", sub="6 notes", on=on == "Numbers 25")
    side_head(side, "Threads", 2, open_=False)
    side_head(side, "Questions", 3, open_=False)
    spacer(side)
    foot = row(side, "foot", gap=14, pad=[8, 6, 2, 6], W="fill")
    for lbl, ic in (("Templates", "docs"), ("Trash", "close")):
        b = row(foot, f"foot/{lbl}", gap=6)
        icon(b, ic, 15, "muted")
        text(b, lbl, "small", "muted")
    return side


def page_head(pg, crumbs, title, chips=(), sub=None):
    if crumbs:
        cr = row(pg, "path", gap=6)
        for i, c_ in enumerate(crumbs):
            if i:
                text(cr, "/", "caption", "muted")
            text(cr, c_, "caption", "accent" if i < len(crumbs) else "muted")
        spacer(cr)
    tr = row(pg, "title row", gap=10, W="fill", align="center")
    text(tr, title, "display", fontSize=28, lineHeight="36px", W="fill")
    if sub:
        text(tr, sub, "caption", "muted")
    P.icon_button(tr, "more", "muted", size=32, icon_size=18)
    if chips:
        ch = row(pg, "places and threads", gap=8, wrap=True, W="fill")
        for c_ in chips:
            if c_.startswith("thread:"):
                P.chip(ch, c_[7:], "outline", dot_color="threadA")
            elif c_.startswith("+"):
                P.chip(ch, c_, "quiet")
            else:
                P.chip(ch, c_, "place", icon_name="place")


def block(pg, kind, s="", grip=False, editing=False, done=False):
    """One block of a page, drawn as the page shows it. A grip at its left when the pointer is over it; editing: its
    Markdown as written, in a box."""
    r = row(pg, f"block/{kind}/{s[:24]}", gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    if grip:
        icon(g, "drag", 16, "muted")
    if editing or kind == "editing":
        box = row(r, "editing", pad=[6, 10, 6, 10], radius=8, stroke="accent", sw=1, fill="surface", W="fill")
        text(box, s, "body", W="fill", fontFamily="Inter")
        return r
    if kind == "h":
        text(r, s, "title", W="fill")
    elif kind == "li":
        text(r, "•", "body", "muted")
        Q.link_text(r, s)
    elif kind == "todo":
        bx = frame(r, "box", w=16, h=16, radius=4, fill="accent" if done else None, stroke=None if done else "muted", sw=1.5,
                   W="fixed", H="fixed", layout="horizontal", mainAlign="center", crossAlign="center")
        if done:
            icon(bx, "check", 12, "onAccent", weight=2.5)
        if done:
            text(r, s, "body", "muted", W="fill")
        else:
            Q.link_text(r, s)
    elif kind == "slot":
        sl = row(r, "scripture slot", gap=8, pad=[10, 12, 10, 12], radius=10, stroke="line", sw=1, fill="surface", W="fill",
                 dashes=[4, 4])
        icon(sl, "book", 16, "accent")
        text(sl, s, "small", "muted")
    elif kind == "div":
        rect(r, "divider", 560, 1, "line")
    elif kind == "quote":
        rect(r, "bar", 3, 22, "line")
        Q.link_text(r, s)
    else:
        Q.link_text(r, s)
    return r


def scripture_block(pg, key, first, last, ref, marks=None, ylt=False, name="scripture block"):
    """A scripture block: its reference, the passage from the database (content.json) with the person's marks, and what
    it can do. Nothing of the text is kept in the file, only the reference."""
    r = row(pg, name, gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    card = col(r, "passage", gap=10, pad=[14, 16, 16, 16], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    head = row(card, "head", gap=8, W="fill")
    icon(head, "book", 16, "accent")
    text(head, ref, "smallStrong", "accent")
    text(head, "· YLT" if ylt else "· KJV", "caption", "muted")
    spacer(head)
    P.chip(head, "KJV" if ylt else "YLT", "quiet")
    P.chip(head, "Open in the reader", "quiet", icon_name="book")
    F.verses(card, B.vv(key, first, last), "readSmall", marks or {})
    return card


def view_block(pg, line, rows_, name="view block"):
    r = row(pg, name, gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    card = col(r, "view", gap=6, pad=[12, 14, 12, 14], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    head = row(card, "line", gap=8, pad=[6, 10, 6, 10], fill="sunken", radius=8, W="fill")
    icon(head, "filter", 15, "muted")
    text(head, line, "small", W="fill", fontFamily="Inter")
    text(head, f"{len(rows_)} found", "caption", "muted")
    for t, where, q in rows_:
        it = row(card, f"row/{t}", gap=8, pad=[7, 6, 7, 6], radius=8, W="fill")
        if q:
            P.chip(it, "?", "question")
        text(it, t, "body", W="fill", maxLines=1)
        P.chip(it, where, "place", icon_name="place")
    return card


def page_foot(pg, kids=(), linked=()):
    if kids:
        k = col(pg, "pages inside", gap=4, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill")
        text(k, f"Pages inside · {len(kids)}", "smallStrong", "muted")
        for t in kids:
            kr = row(k, f"kid/{t}", gap=8)
            icon(kr, "notebook", 15, "accent")
            text(kr, t, "body", "accent")
    if linked:
        lk = col(pg, "linked from", gap=4, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill")
        text(lk, f"Linked from · {len(linked)}", "smallStrong", "muted")
        for t, where in linked:
            lr = row(lk, f"link/{t}", gap=8, W="fill")
            icon(lr, "notebook", 15, "accent")
            text(lr, t, "body", "accent")
            spacer(lr)
            text(lr, where, "caption", "muted")


def window(parent, title, about, reader_first=6, reader_last=10):
    f = Q.win(parent, PG, title, about)
    Q.toolbar(f, active="Notebook", inbox=None)
    Q.reader(f, 0, READER_W, first=reader_first, last=reader_last)
    return f


MARKS = {k: v for k, v in B.NUM25_MARKS.items()}


# ---- the sheets ----------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "The Notebook as a workspace", "W2 of the plan: the sidebar with pages inside pages, a page "
                  "written in blocks, scripture blocks drawn from the database, a verse opened from a note (finding "
                  "94a1, three ways), views, templates, and a page made into a document. Drawn with the person's "
                  "decisions of 7 November: a note with no place is a page; a page is edited block by block.")

    # W1 the sidebar and a page ----------------------------------------------------------------------------------------
    r = row(cv, "row 1", gap=64, align="min")
    f = window(r, "W1 · The sidebar: pages inside pages", "The Notebook expanded beside the reader. The sidebar: Today, "
               "Pinned, Pages (a page can hold pages: drag one onto another; + starts one), At the reader, Threads, "
               "Questions; Templates and the Trash at its foot. Each section folds. The page shows its path, its "
               "title, its places and threads, its blocks, then the pages inside it and Linked from.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25", "+ Place"])
    block(pg, "h", "Aim")
    block(pg, "p", "Read Numbers 25 with the group, then Psalm 106:28–31 beside it. Questions come from the group.")
    block(pg, "h", "Before Tuesday")
    block(pg, "todo", "Read Numbers 25 twice, KJV then YLT", done=True)
    block(pg, "todo", "List every use of H7065 (see [[Word study: H7065]])", grip=True)
    block(pg, "todo", "Print the verse deck")
    block(pg, "div")
    page_foot(pg, kids=("Outline", "The passage", "Questions for the group"),
              linked=[("Saturday, November 7", "today's page")])
    Q.files_note(pg, "Files: still one note per Markdown file, where it is now. Inside another page = parent: "
                 "\"<its id>\" and order in the front matter; pinned: true. The Python app passes over both.")

    # W2 blocks and the / menu -----------------------------------------------------------------------------------------
    f = window(r, "W2 · Writing in blocks, and the / menu", "A click edits one block, as its Markdown; the rest stay "
               "drawn. Enter at the end starts a new block; Backspace in an empty one takes it away; the grip drags a "
               "block. Typing / at the start of a block opens the menu; the format bar stays for the mouse.")
    side, pg = notebook(f)
    sidebar(side, on="Word study: H7065")
    page_head(pg, ["Pages", "Word study: H7065"], "Word study: H7065", ["H7065 everywhere", "+ Place"])
    block(pg, "h", "Renderings")
    block(pg, "editing", "/", grip=True)
    block(pg, "p", "List the KJV's renderings first, then read each verse before writing anything about it.")
    block(pg, "h", "Every use in the Psalms")
    block(pg, "li", "Numbers 25:11 and 25:13")
    m = Q.popover(f, NB_X + SIDE_W + 72, 302, 300, name="slash menu")
    text(m, "Add a block · type to narrow it", "caption", "muted")
    for lbl, sub_, ic, on in (("Scripture", "A passage, drawn from the Bible", "book", True),
                              ("Heading", None, "type", False), ("List", None, "list", False),
                              ("To-do", None, "check", False), ("Quote", None, "copy", False),
                              ("Divider", None, "minimize", False), ("Table", None, "layers", False),
                              ("Link to a page", None, "notebook", False),
                              ("Page inside this one", None, "plus", False),
                              ("View", None, "filter", False)):
        Q.menu_item(m, lbl, sub_, on=on, icon_name=ic)

    # W3 a scripture block, and its file -----------------------------------------------------------------------------
    r = row(cv, "row 2", gap=64, align="min")
    f = window(r, "W3 · Scripture blocks", "A scripture block shows the passage from the Bible: its reference, the "
               "verses, the person's highlights, thread lines and note marks, as the reader draws them. YLT shows the "
               "other text; Open in the reader goes there and comes back to the page. The file keeps only the "
               "reference, so no page ever holds typed scripture.", reader_first=1, reader_last=5)
    side, pg = notebook(f)
    sidebar(side, on="The passage")
    page_head(pg, ["Pages", "Lesson: Phinehas", "The passage"], "The passage", ["Numbers 25:10–13"])
    block(pg, "p", "Read it aloud first, then again slowly.")
    scripture_block(pg, "num25", 10, 13, "Numbers 25:10–13",
                    {k: v for k, v in MARKS.items() if 10 <= k <= 13})
    block(pg, "p", "Then beside it:")
    scripture_block(pg, "ps106", 30, 31, "Psalms 106:30–31", name="second scripture block")
    Q.files_note(pg, "In the file: a fenced block with the reference and nothing else — ```scripture, then "
                 "Num 25:10-13 (ylt after it for the YLT). Obsidian and the Python app show the reference itself.")

    # W4 a view block -----------------------------------------------------------------------------------------------
    f = window(r, "W4 · A view: a list kept up to date", "A view block runs one line of the command language and lists "
               "what it finds, live: the open questions at Numbers 25 here. The same line in the command field, or "
               "wb view run in a terminal, gives the same list. A view only reads; a row opens its note.")
    side, pg = notebook(f)
    sidebar(side, on="Questions for the group")
    page_head(pg, ["Pages", "Lesson: Phinehas", "Questions for the group"], "Questions for the group", [])
    block(pg, "p", "The group's questions, then mine at Numbers 25:")
    view_block(pg, "notebook @Num 25 questions", [
        ("'tent' (H6898) and 'belly' (H6897): used anywhere else?", "Numbers 25:8", True),
        ("24,000 died here; 1 Cor 10:8 says 23,000. How do they relate?", "Numbers 25:9", True),
        ("Does any verse record the judges carrying out the order?", "Numbers 25:5", True)])
    block(pg, "h", "From the group")
    block(pg, "li", "…")
    Q.files_note(pg, "In the file: ```view, then the line notebook @Num 25 questions. A view writes nothing; the line "
                 "can be changed in place.")

    # W5 a verse opened from a note: three ways (finding 94a1) -------------------------------------------------------
    r = row(cv, "row 3", gap=64, align="min")
    v11 = B.vv("num25", 11, 11)
    words = C["interlinear"]
    f = window(r, "W5a · A verse from a note: opens under its link", "Finding 94a1, first way. A click on Numbers "
               "25:11 in a note opens that verse alone, under the line it is in, with Interlinear, Strong's and "
               "Definitions as tabs. The chapter is one click away (Open the chapter); the note stays where it was.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    block(pg, "p", "Phinehas is named at Numbers 25:11; then Psalm 106:30.")
    card = col(pg, "verse under the link", gap=10, pad=[14, 16, 14, 16], fill="bg", radius=12, stroke="accent", sw=1,
               W="fill")
    hd = row(card, "head", gap=8, W="fill")
    text(hd, "Numbers 25:11", "smallStrong", "accent")
    spacer(hd)
    P.chip(hd, "Open the chapter", "quiet", icon_name="book")
    P.icon_button(hd, "close", "muted", size=28, icon_size=14)
    F.verses(card, v11, "readSmall", {11: MARKS[11]})
    P.segmented(card, ["Interlinear", "Strong's", "Definitions"], "Interlinear", W="hug")
    g = row(card, "words", gap=6, W="fill", wrap=True)
    for w_ in words[:5]:
        P.interlinear_cell(g, w_)
    block(pg, "p", "Then the group reads it aloud.")

    f = window(r, "W5b · A verse from a note: its own pane", "Second way. The verse opens as a pane of its own in the "
               "left column: the verse alone, large; every word of the original under it; a word's Strong's entry "
               "when it is clicked. Go to in the reader moves the reader there; nothing else does.")
    lp = frame(f, "verse pane", x=0, y=TB, w=READER_W, h=H - TB, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True, stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    P.pane_header(lp, ["Numbers 25:11"], "Numbers 25:11")
    body = col(lp, "body", gap=14, pad=[20, 22, 20, 22], W="fill", H="fill", clip=True)
    hd = row(body, "head", gap=8, W="fill")
    text(hd, "Numbers 25:11", "title")
    spacer(hd)
    P.chip(hd, "Go to in the reader", "quiet", icon_name="book")
    F.verses(body, v11, "readDesk", {11: MARKS[11]})
    P.segmented(body, ["Interlinear", "Strong's", "Definitions"], "Interlinear", W="hug")
    for a_, b2 in ((0, 4), (4, 8)):
        g = row(body, f"words {a_}", gap=6, W="fill")
        for w_ in words[a_:b2]:
            P.interlinear_cell(g, w_)
    P.lexicon_block(body, C["lexicon"]["H7065"], compact=True)
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    block(pg, "p", "Phinehas is named at Numbers 25:11; then Psalm 106:30.")

    r = row(cv, "row 4", gap=64, align="min")
    f = window(r, "W5c · A verse from a note: a card, then a step at a time", "Third way. A small card at the link: "
               "the verse, and three buttons. Each opens in the card (Interlinear here); Definitions waits for the "
               "dictionary chosen in tier 7, so it is left blank. The card can be pinned as a pane (W5b).")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    block(pg, "p", "Phinehas is named at Numbers 25:11; then Psalm 106:30.")
    m = Q.popover(f, NB_X + SIDE_W + 70, 250, 560, name="verse card")
    hd = row(m, "head", gap=8, W="fill")
    text(hd, "Numbers 25:11", "smallStrong", "accent")
    spacer(hd)
    P.icon_button(hd, "float", "muted", size=28, icon_size=14)
    P.icon_button(hd, "close", "muted", size=28, icon_size=14)
    F.verses(m, v11, "readSmall", {11: MARKS[11]})
    br = row(m, "steps", gap=8)
    P.button(br, "Interlinear", "primary", icon_name="interlinear", size="sm")
    P.button(br, "Strong's", "secondary", icon_name="word", size="sm")
    P.button(br, "Definitions", "secondary", icon_name="docs", size="sm")
    P.button(br, "Open the chapter", "ghost" if False else "secondary", icon_name="book", size="sm")
    g = row(m, "words", gap=6, W="fill", wrap=True)
    for w_ in words[:4]:
        P.interlinear_cell(g, w_)

    # W6 from a template -------------------------------------------------------------------------------------------
    f = window(r, "W6 · A new page from a template", "New page → From a template copies a template's blocks. A "
               "template is a page the person wrote under Templates: headings, empty to-dos and a scripture block for "
               "{place}, filled with the place picked. The app ships none with words in them.")
    side, pg = notebook(f)
    sidebar(side)
    page_head(pg, ["Pages"], "A new page", [])
    md = Q.modal(f, 760, title="A new page", sub="Blank, or from one of your templates", y=110)
    two = row(md, "two", gap=18, W="fill", align="min")
    lst = col(two, "templates", gap=4, W="fixed")
    Q.put(lst, 0, 0, 250)
    Q.menu_item(lst, "Blank page", None, icon_name="notebook")
    text(lst, "Your templates", "caption", "muted")
    Q.menu_item(lst, "Chapter study", "3 headings, a scripture block", on=True, icon_name="docs")
    Q.menu_item(lst, "Word study", "Renderings, every use", icon_name="docs")
    Q.menu_item(lst, "Lesson outline", "Aim, the passage, questions", icon_name="docs")
    prev = col(two, "preview", gap=10, pad=[14, 16, 14, 16], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    text(prev, "Chapter study", "heading")
    Q.form_field(prev, "For", "Numbers 25", hint="Fills {place} in the template")
    for kind, s_ in (("h", "Read"), ("slot", "Scripture: {place}, from the Bible"), ("h", "What I noticed"), ("li", "…"),
                     ("h", "Questions"), ("todo", "…")):
        block(prev, kind, s_)
    Q.buttons(md, ("Cancel", "secondary"), ("Make the page", "primary"))

    # W7 a page made into a document -------------------------------------------------------------------------------
    r = row(cv, "row 5", gap=64, align="min")
    f = window(r, "W7 · A page made into a document", "On a page's ⋯: Make a Speaker Script, Make a verse deck. The "
               "page's headings are the outline, its scripture blocks the verses; after it is made every verse is "
               "checked against the Bible. documents/ keeps the Python app's format, so both apps list it.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25"])
    md = Q.modal(f, 700, title="Make a Speaker Script", sub="From the page Lesson: Phinehas and the pages inside it",
                 y=120)
    two = row(md, "two", gap=18, W="fill", align="min")
    a = col(two, "outline", gap=6, pad=[12, 14, 12, 14], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    text(a, "The outline (its headings)", "smallStrong", "muted")
    for t in ("Aim", "Outline", "The passage", "Questions for the group"):
        rr = row(a, f"h/{t}", gap=8)
        icon(rr, "type", 14, "muted")
        text(rr, t, "body")
    b_ = col(two, "verses", gap=6, pad=[12, 14, 12, 14], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    text(b_, "The verses (its scripture blocks)", "smallStrong", "muted")
    for t in ("Numbers 25:10–13", "Psalms 106:30–31"):
        rr = row(b_, f"v/{t}", gap=8)
        icon(rr, "book", 14, "accent")
        text(rr, t, "body", "accent")
    Q.kv(md, "Theme", "olivet", strong=True)
    Q.kv(md, "Made as", "Word (.docx)")
    Q.files_note(md, "Every verse in the file is checked against the Bible after it is made. Kept in documents/ with "
                 "the Python app's plan and file fingerprints.")
    Q.buttons(md, ("Cancel", "secondary"), ("Make it", "primary"))


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug",
                  H="hug")
    sheets(board)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "workspace.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "workspace.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.5", "--out",
                    str(OUT / "all.png")], check=True, capture_output=True)
    for title in Q.TITLES.get(PG, []):
        file = OUT / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", "Window · " + title,
                        "--scale", "1", "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
