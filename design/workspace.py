"""W2 of "The Notebook as a workspace" (2026-11-07): the design round for the workspace, drawn with FigCraft as the phase 2b
round was (it reuses phase2b.py's and build.py's helpers, so the sheets look alike). Second pass the same day, after the
person's review: W1.2, W3's Lines, W5c as the verse card (W5.1, W5.2), W6.1-W6.3 and W7.1-W7.4.

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


ONE_READER = (("Numbers 25", "the reader", 6),)
TEMPLATES = ("Chapter study", "Word study", "Lesson outline")


def sidebar(side, on=None, lesson_open=True, readers=ONE_READER, templates=False):
    """readers: (chapter, which reader, notes there) for each reader open, the reader first (At the reader lists the
    notes and pages placed in each one's chapter). templates: Templates opened as a section, not only at the foot."""
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
    side_head(side, "At the reader" if len(readers) == 1 else "At the readers", sum(n for *_, n in readers))
    for ch, which, n in readers:
        side_item(side, ch, icon_name="place" if which == "the reader" else "dock", sub=f"{which} · {n}",
                  on=on == ch)
    side_head(side, "Threads", 2, open_=False)
    side_head(side, "Questions", 3, open_=False)
    if templates:
        side_head(side, "Templates", len(TEMPLATES), plus=True)
        for t in TEMPLATES:
            side_item(side, t, icon_name="docs", on=on == t)
    spacer(side)
    foot = row(side, "foot", gap=14, pad=[8, 6, 2, 6], W="fill")
    for lbl, ic in (() if templates else (("Templates", "docs"),)) + (("Trash", "close"),):
        b = row(foot, f"foot/{lbl}", gap=6)
        icon(b, ic, 15, "muted")
        text(b, lbl, "small", "muted")
    return side


def chip_menu(parent, label, icon_name=None, name=None, strong=False):
    """A chip that opens a menu: its label, then a down arrow."""
    ch = row(parent, name or f"menu chip/{label}", gap=5, pad=[5, 8, 5, 10], fill="accentSoft" if strong else "sunken",
             radius=999)
    fg = "accent" if strong else "muted"
    if icon_name:
        icon(ch, icon_name, 15, fg)
    text(ch, label, "smallStrong", fg)
    icon(ch, "down", 13, fg)
    return ch


def seg_small(parent, options, active, name="view as"):
    """A small two-way switch in a block's head (Paragraph | Lines)."""
    s = row(parent, name, gap=2, pad=[2, 2, 2, 2], fill="sunken", radius=8)
    for o in options:
        on = o == active
        b = row(s, f"option/{o}", pad=[3, 9, 3, 9], radius=6, fill="surface" if on else None)
        if on:
            shadow(b, 1, 3, "#00000014")
        text(b, o, "caption", "fg" if on else "muted")
    return s


def reader_choice(f, x, y, what, here="Numbers 25:6", w=380, name="open menu"):
    """Where a place opens: the reader (it moves, and Back returns it) or a new reader (a pane; the reader stays put).
    The ticked one is what a plain click does; Ctrl+click is the other."""
    m = Q.popover(f, x, y, w, name=name)
    text(m, f"Open {what}", "caption", "muted")
    Q.menu_item(m, "In the reader", f"The reader goes there; Back returns it to {here}", on=True, icon_name="book",
                kbd="Click")
    Q.menu_item(m, "In a new reader", f"A second reader in a pane; the reader stays at {here}", icon_name="dock",
                kbd="Ctrl+click")
    para(m, "A plain click does the ticked one; Notebook settings → Places open in… changes which.", "caption", "muted")
    return m


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


def scripture_block(pg, key, first, last, ref, marks=None, ylt=False, name="scripture block", lines=False,
                    open_on=False):
    """A scripture block: its reference, the passage from the database (content.json) with the person's marks, and what
    it can do. Nothing of the text is kept in the file, only the reference (and lines, when it is shown a verse to a
    line). lines: one verse per line (for the Psalms); otherwise a paragraph, as the reader draws it."""
    r = row(pg, name, gap=8, W="fill", align="min")
    g = row(r, "grip", W="fixed")
    Q.put(g, 0, 0, 16, 22)
    card = col(r, "passage", gap=10, pad=[14, 16, 16, 16], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    head = row(card, "head", gap=8, W="fill")
    icon(head, "book", 16, "accent")
    text(head, ref, "smallStrong", "accent")
    text(head, "· YLT" if ylt else "· KJV", "caption", "muted")
    spacer(head)
    seg_small(head, ["Paragraph", "Lines"], "Lines" if lines else "Paragraph")
    P.chip(head, "KJV" if ylt else "YLT", "quiet")
    chip_menu(head, "Open", "book", strong=open_on)
    F.verses(card, B.vv(key, first, last), "readSmall", marks or {},
             paragraphs=tuple(range(first, last + 1)) if lines else ())
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


def window(parent, title, about, reader_first=6, reader_last=10, reader=True):
    f = Q.win(parent, PG, title, about)
    Q.toolbar(f, active="Notebook", inbox=None)
    if reader:
        Q.reader(f, 0, READER_W, first=reader_first, last=reader_last)
    return f


def left_pane(f, tabs, active, y=TB, h=H - TB, pad=(20, 22, 20, 22), gap=14):
    """A pane in the left column instead of the reader (a second reader, Help, a document's preview). → its body."""
    lp = frame(f, f"left pane/{active}", x=0, y=y, w=READER_W, h=h, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True, stroke="line", strokeRightWeight=1, strokeLeftWeight=0,
               strokeTopWeight=1 if y > TB else 0, strokeBottomWeight=0)
    P.pane_header(lp, tabs, active)
    return col(lp, "body", gap=gap, pad=list(pad), W="fill", H="fill", clip=True)


def word_cell(parent, w):
    """An interlinear word, as parts.interlinear_cell, with − at its corner to put it away."""
    cell = col(parent, f"word/{w['strong']}", gap=2, pad=[6, 8, 10, 8], fill="surface", radius=10, stroke="line",
               sw=1, crossAlign="center", W="fill")
    top = row(cell, "put away", W="fill")
    spacer(top)
    icon(top, "minimize", 14, "muted")
    text(cell, w["original"], "hebrew", fontSize=24, lineHeight="32px")
    text(cell, w["translit"], "caption", "muted")
    text(cell, w["strong"], "caption", "accent")
    text(cell, w["gloss"], "small", textAlign="center", W="fill")
    return cell


def verse_card(f, x, y, w=560, step=None, name="verse card"):
    """The verse card (W5c, chosen 2026-11-07): Numbers 25:11 at its link, the steps, Open the chapter ▾."""
    m = Q.popover(f, x, y, w, name=name)
    hd = row(m, "head", gap=8, W="fill")
    text(hd, "Numbers 25:11", "smallStrong", "accent")
    text(hd, "· KJV", "caption", "muted")
    spacer(hd)
    P.icon_button(hd, "float", "muted", size=28, icon_size=14)
    P.icon_button(hd, "close", "muted", size=28, icon_size=14)
    F.verses(m, B.vv("num25", 11, 11), "readSmall", {11: MARKS[11]})
    br = row(m, "steps", gap=8, W="fill")
    for lbl, ic in (("Interlinear", "interlinear"), ("Strong's", "word"), ("Definitions", "docs")):
        P.button(br, lbl, "primary" if step == lbl else "secondary", icon_name=ic, size="sm")
    spacer(br)
    chip_menu(br, "Open the chapter", "book", strong=step == "open")
    return m


def docs_foot(pg, docs):
    """Documents made from this page: each file, when it was made, and whether the page has changed since."""
    d = col(pg, "documents", gap=6, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill")
    text(d, f"Documents · {len(docs)}", "smallStrong", "muted")
    for name, ic, when, fresh in docs:
        r_ = row(d, f"doc/{name}", gap=8, W="fill")
        icon(r_, ic, 15, "accent")
        text(r_, name, "body", "accent", W="fill", maxLines=1)
        text(r_, when, "caption", "muted")
        if fresh:
            P.chip(r_, "Up to date", "quiet", icon_name="check")
        else:
            P.chip(r_, "Make again", "selected", icon_name="sync")
    return d


MARKS = {k: v for k, v in B.NUM25_MARKS.items()}


# ---- the sheets ----------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "The Notebook as a workspace", "W2 of the plan, second pass after the person's review of 7 "
                  "November: the sidebar with pages inside pages and At the reader with two readers, a page written "
                  "in blocks, scripture blocks as a paragraph or a verse to a line, a view, the verse card (W5c, "
                  "chosen), templates (a new page, editing one, Help), and a page made into a document, step by "
                  "step. Every Open of a place asks: in the reader, or in a new reader.")

    # W1 the sidebar and a page ----------------------------------------------------------------------------------------
    r = row(cv, "row 1", gap=64, align="min")
    f = window(r, "W1.1 · The sidebar: pages inside pages", "The Notebook expanded beside the reader. The sidebar: "
               "Today, Pinned, Pages (a page can hold pages: drag one onto another; + starts one), At the reader, "
               "Threads, Questions; Templates and the Trash at its foot. Each section folds. The page shows its path, "
               "its title, its places and threads, its blocks, then the pages inside it and Linked from. At the "
               "reader lists the notes and pages placed in the chapter the reader is showing (W1.2).")
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

    # W1.2 At the reader with a second reader open (the person's question, 2026-11-07) ------------------------------
    f = window(r, "W1.2 · At the reader, with a second reader open", "At the reader answers: what have I written "
               "where I am reading? It lists the notes and pages placed in the chapter each reader shows, and follows "
               "it as it moves; it never opens or moves a reader itself. With a second reader open (Open in a new "
               "reader, or a verse's Open in a new tab), each reader gets its own row, the reader first, so nothing has "
               "to be picked. A row opens that chapter's notes on the page side; a place in a note asks where to open "
               "(the menu: in the reader, or in a new reader).", reader=False)
    half = (H - TB) // 2
    B.desk_reader(f, 0, TB, READER_W, half, first=10, last=11)
    body = left_pane(f, ["Psalms 106"], "Psalms 106", y=TB + half, h=H - TB - half, pad=(14, 22, 14, 22), gap=8)
    text(body, "A second reader: clicks here never move the reader", "caption", "muted")
    text(body, "Psalms 106", "chapter", fontSize=24, lineHeight="32px")
    F.verses(body, B.vv("ps106", 28, 31), "readSmall", {})
    side, pg = notebook(f)
    sidebar(side, on="Psalms 106", lesson_open=False,
            readers=(("Numbers 25", "the reader", 6), ("Psalms 106", "new reader", 2)))
    page_head(pg, ["At the readers", "Psalms 106"], "Psalms 106", [], sub="in the new reader · 2 notes")
    Q.files_note(pg, "Places (the section) keeps its Follow the reader switch, which follows the reader at the left, "
                 "as now; a second reader never moves it. Nothing here is written to the study folder.")
    P.note_card(pg, "H6419 is mostly 'pray' in the KJV. Is Phinehas here judging, interceding, or both?",
                "Psalms 106:30", "Sun 21:40", "question", compact=True)
    P.note_card(pg, "Psalm 106:30 names Phinehas too. Put it on the Phinehas thread, then read Malachi 2:5–6 beside "
                "it.", "Psalms 106:30", "Sat 09:12")
    reader_choice(f, NB_X + SIDE_W + 40, 474, "Psalms 106:30", here="Numbers 25:10")

    # W2 blocks and the / menu -----------------------------------------------------------------------------------------
    r = row(cv, "row 2", gap=64, align="min")
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

    # W3 scripture blocks: a paragraph or a verse to a line; where Open goes ---------------------------------------
    f = window(r, "W3 · Scripture blocks: a paragraph, or a verse to a line", "A scripture block shows the passage "
               "from the Bible with the person's highlights, thread lines and note marks, as the reader draws them. "
               "Paragraph | Lines in its head: Lines puts each verse on its own line (for the Psalms); the block keeps "
               "the choice. YLT shows the other text. Open ▾ asks where: in the reader (it moves; Back returns it), "
               "or in a new reader (a pane; the reader stays put). The file keeps only the reference.",
               reader_first=1, reader_last=5)
    side, pg = notebook(f)
    sidebar(side, on="The passage")
    page_head(pg, ["Pages", "Lesson: Phinehas", "The passage"], "The passage", [])
    scripture_block(pg, "num25", 10, 13, "Numbers 25:10–13",
                    {k: v for k, v in MARKS.items() if 10 <= k <= 13}, open_on=True)
    block(pg, "p", "Then the psalm, a verse to a line:")
    scripture_block(pg, "ps106", 28, 31, "Psalms 106:28–31", name="second scripture block", lines=True)
    Q.files_note(pg, "In the file: a fenced block with the reference and nothing else — ```scripture, then "
                 "Num 25:10-13; lines and ylt after it when chosen. Obsidian and the Python app show the reference.")
    reader_choice(f, W - 404, 318, "Numbers 25:10–13", here="Numbers 25:1")

    # W4 a view block -----------------------------------------------------------------------------------------------
    r = row(cv, "row 3", gap=64, align="min")
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

    # W5 a verse opened from a note: the card (W5c, chosen 2026-11-07; finding 94a1) --------------------------------
    words = C["interlinear"]
    f = window(r, "W5.1 · A verse from a note: the card", "Finding 94a1, as chosen (W5c): a click on Numbers 25:11 "
               "in a note opens a small card at the link with the verse and its steps: Interlinear, Strong's and "
               "Definitions open in the card, one at a time. Open the chapter ▾ asks where: in the reader, or in a "
               "new reader. The pin (top right) keeps the card as a pane of its own; × or Escape closes it, and the "
               "note stays where it was.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    block(pg, "p", "Phinehas is named at Numbers 25:11; then Psalm 106:30.")
    block(pg, "p", "Then the group reads it aloud.")
    verse_card(f, NB_X + SIDE_W + 70, 250, step="open")
    reader_choice(f, W - 420, 436, "Numbers 25, at verse 11", here="Numbers 25:6")

    r = row(cv, "row 4", gap=64, align="min")
    f = window(r, "W5.2 · The card's interlinear: words put away, and brought back", "Interlinear in the card shows "
               "every word of the verse. Each word's − puts it away, so only the words being studied take room; the "
               "words put away stay in a row of small names in their order, and a click brings one back (Show all "
               "brings every one). Which words are put away is kept per verse on this computer, not in the study "
               "folder. Definitions waits for the dictionary chosen in tier 7.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", [])
    block(pg, "p", "Phinehas is named at Numbers 25:11; then Psalm 106:30.")
    m = verse_card(f, NB_X + SIDE_W + 70, 232, step="Interlinear")
    keep = (0, 6, 12, 14)
    cnt = row(m, "shown", gap=10, W="fill")
    text(cnt, f"{len(keep)} of {len(words)} words shown", "caption", "muted")
    spacer(cnt)
    text(cnt, f"Show all {len(words)}", "smallStrong", "accent")
    text(cnt, "Put all away", "small", "muted")
    g = row(m, "words", gap=6, W="fill")
    for i in keep:
        word_cell(g, words[i])
    text(m, "Put away · a click brings one back", "caption", "muted")
    away = row(m, "put away", gap=4, W="fill", wrap=True, crossGap=4)
    for i, w_ in enumerate(words):
        if i in keep:
            continue
        ch = row(away, f"away/{i}", gap=4, pad=[2, 8, 2, 8], radius=999, fill="sunken")
        text(ch, w_["gloss"], "caption", "muted")
        icon(ch, "plus", 11, "muted")

    # W6 templates: a new page from one, editing one, and Help -----------------------------------------------------
    f = window(r, "W6.1 · A new page from a template", "New page → From a template copies a template's blocks. A "
               "template is a page the person wrote under Templates: headings, empty to-dos and a scripture block for "
               "{place}, filled with the place picked; the new page's name comes from the template's own. The app "
               "ships none with words in them. Edit your templates opens them (W6.2); ? opens Help (W6.3).")
    side, pg = notebook(f)
    sidebar(side)
    page_head(pg, ["Pages"], "A new page", [])
    md = Q.modal(f, 800, title="A new page", sub="Blank, or from one of your templates", y=100)
    two = row(md, "two", gap=18, W="fill", align="min")
    lst = col(two, "templates", gap=4, W="fixed")
    Q.put(lst, 0, 0, 250)
    Q.menu_item(lst, "Blank page", None, icon_name="notebook")
    text(lst, "Your templates", "caption", "muted")
    Q.menu_item(lst, "Chapter study", "3 headings, a scripture block", on=True, icon_name="docs")
    Q.menu_item(lst, "Word study", "Renderings, every use", icon_name="docs")
    Q.menu_item(lst, "Lesson outline", "Aim, the passage, questions", icon_name="docs")
    ed = row(lst, "edit templates", gap=8, pad=[10, 10, 4, 10], W="fill")
    icon(ed, "pen", 15, "accent")
    text(ed, "Edit your templates", "smallStrong", "accent")
    spacer(ed)
    icon(ed, "question", 15, "muted")
    prev = col(two, "preview", gap=10, pad=[14, 16, 14, 16], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    text(prev, "Chapter study", "heading")
    Q.form_field(prev, "For", "Numbers 25", hint="Fills {place} in the template", required=True)
    Q.kv(prev, "The new page's name", "Chapter study: Numbers 25", strong=True)
    Q.kv(prev, "Goes in", "Pages")
    for kind, s_ in (("h", "Read"), ("slot", "Scripture: {place}, from the Bible"), ("h", "What I noticed"), ("li", "…"),
                     ("h", "Questions"), ("todo", "…")):
        block(prev, kind, s_)
    Q.buttons(md, ("Cancel", "secondary"), ("Make the page", "primary"))

    r = row(cv, "row 5", gap=64, align="min")
    f = window(r, "W6.2 · Editing a template", "Templates opens as a section of the sidebar; a template is edited "
               "like any page, block by block. Typing { offers the blanks: {place}, {date}, {title}, {reader}. The "
               "template's own settings sit under its title: the name new pages get, whether it asks for a place, "
               "where they go. A page's … → Save as a template copies a page already written. Changing a template "
               "never changes the pages made from it before.")
    side, pg = notebook(f)
    sidebar(side, on="Chapter study", lesson_open=False, templates=True)
    page_head(pg, ["Templates", "Chapter study"], "Chapter study", [], sub="a template · used 4 times")
    ban = row(pg, "a template", gap=10, pad=[10, 12, 10, 12], fill="accentSoft", radius=10, W="fill", align="min")
    icon(ban, "docs", 18, "accent")
    para(ban, "A template. New page → From a template copies these blocks into a new page and fills the blanks in "
         "braces then.", "small")
    st = col(pg, "its settings", gap=6, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill")
    Q.kv(st, "Names new pages", "Chapter study: {place}", strong=True)
    Q.kv(st, "Asks for", "A place")
    Q.kv(st, "Puts them in", "Pages")
    block(pg, "h", "Read")
    block(pg, "editing", "```scripture\n{pl", grip=True)
    block(pg, "h", "What I noticed")
    block(pg, "li", "…")
    block(pg, "h", "Questions")
    block(pg, "todo", "…")
    m = Q.popover(f, NB_X + SIDE_W + 150, 482, 380, name="blanks menu")
    text(m, "A blank · filled when a page is made", "caption", "muted")
    Q.menu_item(m, "{place}", "The place picked: Numbers 25", on=True, icon_name="place")
    Q.menu_item(m, "{date}", "The day it is made: Saturday, November 7", icon_name="pen")
    Q.menu_item(m, "{title}", "The new page's name", icon_name="type")
    Q.menu_item(m, "{reader}", "The chapter in the reader then", icon_name="book")

    f = window(r, "W6.3 · Templates in Help", "Help gets an entry for templates (tier 6's guide, its text kept in "
               "wb-core so wb guide templates prints the same): what a template is, making one, the blanks, changing "
               "one, where it lives, and the wb commands. The Templates page lists them with How templates work, "
               "which opens this entry.", reader=False)
    body = left_pane(f, ["Help"], "Help", gap=10)
    P.segmented(body, ["Guide", "Commands", "Keys"], "Guide", W="hug")
    P.field(body, "Search Help", "templates", icon_name="search", height=36)
    text(body, "Templates", "title")
    for head_, s_ in (
            ("What a template is", "A page under Templates. New page → From a template copies its blocks into a new "
             "page and fills its blanks."),
            ("Making one", "+ beside Templates starts an empty one. On any page, … → Save as a template copies it, "
             "with its places taken out."),
            ("The blanks", "{place} the place picked · {date} the day · {title} the new page's name · {reader} the "
             "chapter in the reader. Type { in a template to add one."),
            ("Changing one", "Open it under Templates and edit it like a page. Its … sets the name new pages get, "
             "whether it asks for a place, and where they go. Pages made before keep their own blocks."),
            ("Where it lives", "An ordinary note in the study folder, with template: true in its front matter."),
            ("From a terminal", "wb template list · wb template show \"Chapter study\" · wb page new --template "
             "\"Chapter study\" --place \"Num 25\"")):
        text(body, head_, "smallStrong")
        para(body, s_, "small", "muted")
    side, pg = notebook(f)
    sidebar(side, on="Templates", lesson_open=False, templates=True)
    page_head(pg, [], "Templates", [], sub="3 templates")
    hw = row(pg, "how", gap=8)
    icon(hw, "question", 16, "accent")
    text(hw, "How templates work", "smallStrong", "accent")
    for t, about_, used in (("Chapter study", "Read, What I noticed, Questions · asks for a place", "used 4 times"),
                            ("Word study", "Renderings, Every use · asks for a place", "used 2 times"),
                            ("Lesson outline", "Aim, The passage, Questions for the group", "used once")):
        tr_ = row(pg, f"template/{t}", gap=10, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1,
                  W="fill")
        icon(tr_, "docs", 18, "accent")
        tc = col(tr_, "text", gap=2, W="fill")
        text(tc, t, "bodyStrong")
        text(tc, about_, "caption", "muted")
        text(tr_, used, "caption", "muted")
        icon(tr_, "more", 18, "muted")
    Q.files_note(pg, "Templates are notes like any other (template: true), so the Python app and Obsidian open them; "
                 "the Notebook leaves them out of Pages, Places and search unless asked.")

    # W7 a page made into a document: choose, what goes in, made and checked, kept on the page --------------------
    r = row(cv, "row 6", gap=64, align="min")
    f = window(r, "W7.1 · A page made into a document: what to make", "On a page's … (or a thread's): Make a "
               "document…. The page is the source, as a thread is: the Python app's structures, their own words "
               "about each. Tier 4 makes the Speaker Script (Word) and Verse by Verse (PDF pages); the rest of the "
               "structures, the presets (Teach it, Hand it out…) and .pptx come in phase 5 and are shown greyed. A "
               "theme is picked for both.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25"])
    md = Q.modal(f, 860, title="Make a document", sub="From the page Lesson: Phinehas and the 3 pages inside it",
                 y=90)
    two = row(md, "two", gap=18, W="fill", align="min")
    for head_, items in (("Word", (("Speaker Script", "Everything in large print, with a cue where each Pulpit slide "
                                    "comes up.", True, True),
                                   ("Share Copy", "Speech and scriptures, to send to a friend. No notes.", False, False),
                                   ("Study Sheet", "Each verse beside your notes, with room to write.", False, False),
                                   ("Reading Sheet", "Only the scriptures, in two columns.", False, False))),
                         ("Slides", (("Verse by Verse", "One verse to a slide, the verses either side faint, your "
                                      "highlights showing. As PDF pages.", True, True),
                                     ("Reader", "Scripture only. Nothing else, on screen or off.", False, False),
                                     ("Pulpit", "The same screen as the Reader, with your speech and notes in the "
                                      "speaker notes.", False, False),
                                     ("Study Table", "The verse on the left and your notes beside it, on the slide.",
                                      False, False)))):
        c_ = col(two, head_, gap=4, W="fill")
        text(c_, head_, "label", "muted")
        for lbl, about_, now, on in items:
            it = row(c_, f"structure/{lbl}", gap=10, pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None,
                     W="fill", align="min")
            bx = frame(it, "box", w=16, h=16, radius=4, fill="accent" if on else None,
                       stroke=None if on else "muted", sw=1.5, W="fixed", H="fixed", layout="horizontal",
                       mainAlign="center", crossAlign="center")
            if on:
                icon(bx, "check", 12, "onAccent", weight=2.5)
            tc = col(it, "text", gap=0, W="fill")
            text(tc, lbl if now else f"{lbl} · phase 5", "bodyStrong" if on else "body", "fg" if now else "muted")
            para(tc, about_, "caption", "muted")
    th = row(md, "theme", gap=12, W="fill")
    text(th, "Theme", "smallStrong")
    chip_menu(th, "Olivet", None, strong=True)
    text(th, "Small rooms, classrooms, LED screens", "small", "muted")
    spacer(th)
    text(th, "Version", "smallStrong")
    chip_menu(th, "KJV")
    Q.buttons(md, ("Cancel", "secondary"), ("Next: what goes in", "primary"))

    f = window(r, "W7.2 · What goes in, and what each block becomes", "The second step shows the page's blocks in "
               "order and what each becomes in the Speaker Script: a heading starts a section (a new page, and its "
               "slide's cue); a paragraph is your words; a scripture block is its verses, drawn from the Bible when "
               "the file is made, with your notes at those verses as Study lines. To-dos are left out unless switched "
               "on; the pages inside follow in their order. Nothing is typed into the document by hand.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25"])
    md = Q.modal(f, 860, title="What goes in", sub="Speaker Script and Verse by Verse · Olivet · KJV", y=80)
    tbl = col(md, "blocks", gap=2, pad=[6, 8, 6, 8], fill="bg", radius=12, stroke="line", sw=1, W="fill")
    for kind_, what, becomes, ic, on in (
            ("Heading", "Aim", "A section: a new page, SLIDE cue", "type", True),
            ("Paragraph", "Read Numbers 25 with the group, then…", "Your words, in large print", "list", True),
            ("Heading", "Before Tuesday", "A section", "type", True),
            ("To-do", "3 to-dos: Read Numbers 25 twice…", "Left out: to-dos are for you", "check", False),
            ("Page inside", "Outline", "Its blocks, after this page's", "notebook", True),
            ("Page inside", "The passage · 2 scripture blocks", "The verses from the Bible, with "
             "your notes there as Study lines", "book", True),
            ("Page inside", "Questions for the group · a view", "The view's list as it is when made", "filter", True)):
        it = row(tbl, f"goes in/{what[:20]}", gap=10, pad=[8, 8, 8, 8], radius=8, W="fill")
        Q.toggle(it, on)
        icon(it, ic, 16, "accent" if on else "muted")
        tc = col(it, "what", gap=0, W="fixed")
        Q.put(tc, 0, 0, 330)
        text(tc, kind_, "caption", "muted")
        text(tc, what, "body", "fg" if on else "muted", maxLines=1)
        icon(it, "right", 16, "muted")
        text(it, becomes, "small", "fg" if on else "muted", W="fill")
    Q.files_note(md, "The document is planned from the page each time it is made, the way the Python app plans one "
                 "from a thread; nothing is copied into the page, and scripture comes from the database only.")
    Q.buttons(md, ("Back", "secondary"), ("Make them", "primary"))

    r = row(cv, "row 7", gap=64, align="min")
    f = window(r, "W7.3 · Made, and every verse checked", "When the files are made, every verse in them is checked "
               "against the Bible (the present rule) and listed with its result; a verse that does not match is "
               "named with where it is in the file. Open opens the file in Word or the PDF viewer; Show in folder "
               "opens documents/. Both apps list what is made, since documents/ keeps the Python app's format.")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25"])
    md = Q.modal(f, 760, title="Made", sub="2 files from Lesson: Phinehas · 14:20", y=90)
    for name_, ic, size_ in (("Speaker Script - Lesson Phinehas.docx", "docs", "Word · 9 pages"),
                             ("Verse by Verse - Lesson Phinehas.pdf", "pdf", "PDF · 9 slides")):
        fr = row(md, f"file/{name_}", gap=10, pad=[10, 12, 10, 12], fill="bg", radius=10, stroke="line", sw=1,
                 W="fill")
        icon(fr, ic, 20, "accent")
        tc = col(fr, "text", gap=0, W="fill")
        text(tc, name_, "bodyStrong")
        text(tc, size_, "caption", "muted")
        P.button(fr, "Open", "secondary", size="sm")
    ck = col(md, "verse check", gap=4, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill")
    hr = row(ck, "head", gap=8, W="fill")
    icon(hr, "check", 16, "ok")
    text(hr, "8 of 8 verses match the Bible (KJV), in both files", "smallStrong", "ok")
    for ref_ in ("Numbers 25:10", "Numbers 25:11", "Numbers 25:12", "Numbers 25:13", "Psalms 106:28",
                 "Psalms 106:29", "Psalms 106:30", "Psalms 106:31"):
        vr = row(ck, f"checked/{ref_}", gap=8, W="fill")
        icon(vr, "check", 14, "ok")
        text(vr, ref_, "small", W="fill")
        text(vr, "Script and slides", "caption", "muted")
    Q.files_note(md, "Kept in documents/ as page-<id>-script.json and page-<id>-verse.json, with the plan and file "
                 "fingerprints, as the thread's are. A page as the source is new: whether the Python app lists it is "
                 "checked in tier 4.")
    Q.buttons(md, ("Show in folder", "secondary"), ("Done", "primary"))

    f = window(r, "W7.4 · The page keeps its documents", "Documents made from a page are listed at its foot, each "
               "with when it was made; when the page has changed since (the plan's fingerprint differs), Make again "
               "replaces the file. Opening one shows a preview in the left column (the Speaker Script's first pages "
               "here, drawn roughly: the structure's layout is the Python app's).", reader=False)
    body = left_pane(f, ["Speaker Script - Lesson Phinehas.docx"], "Speaker Script - Lesson Phinehas.docx",
                     pad=(18, 26, 18, 26), gap=10)
    paper = col(body, "page 1", gap=8, pad=[26, 30, 26, 30], fill="surface", radius=4, stroke="line", sw=1, W="fill")
    shadow(paper, 4, 14, "#0000001A")
    text(paper, "Lesson: Phinehas", "display", fontSize=24, lineHeight="30px")
    text(paper, "Speaker's script", "small", "muted")
    text(paper, "Aim", "title")
    text(paper, "SLIDE 2", "label", "accent")
    para(paper, "Read Numbers 25 with the group, then Psalm 106:28–31 beside it. Questions come from the group.",
         "body", fontSize=16, lineHeight="24px")
    text(paper, "The passage", "title")
    text(paper, "SLIDE 4", "label", "accent")
    text(paper, "Numbers 25:10–11 (KJV)", "smallStrong", "accent")
    F.verses(paper, B.vv("num25", 10, 11), "readSmall", {})
    para(paper, "Study: Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.", "small", "muted")
    side, pg = notebook(f)
    sidebar(side, on="Lesson: Phinehas")
    page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["thread:Phinehas", "Numbers 25"])
    block(pg, "h", "Aim")
    block(pg, "p", "Read Numbers 25 with the group, then Psalm 106:28–31 beside it. Questions come from the group.")
    block(pg, "h", "Before Tuesday")
    block(pg, "todo", "Read Numbers 25 twice, KJV then YLT", done=True)
    block(pg, "todo", "Print the verse deck", grip=True)
    page_foot(pg, kids=("Outline", "The passage", "Questions for the group"))
    docs_foot(pg, [("Speaker Script - Lesson Phinehas.docx", "docs", "today 14:20", True),
                   ("Verse by Verse - Lesson Phinehas.pdf", "pdf", "Thursday · changed since", False)])


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
    for old in OUT.glob("*.png"):          # windows renamed or dropped (W5a, W5b) leave no stale picture behind
        old.unlink()
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.5", "--out",
                    str(OUT / "all.png")], check=True, capture_output=True)
    for title in Q.TITLES.get(PG, []):
        file = OUT / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", "Window · " + title,
                        "--scale", "1", "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
