"""The phase 2b design round (docs/archive/2026-11-10/docs/PLAN-phase2b.md, step 4), drawn with FigCraft from scripts like build.py.

    python design/phase2b.py     # writes design/phase2b.figcraft and design/exports/phase2b/*.png

One page, "All designs", holds every design as one board: the Notebook (three designs), reading plans (three builders
and the plan's own view), the dock and views, threads / Help / words, and the Shelf and settings. What each answers is in the person's notes of 2026-11-03 and 11-04
(docs/archive/2026-11-10/docs/phase2-results.md, sections 11 and 12). Scripture comes only from content.json (fetched from the database); the
notes shown are the Phinehas demo's, as on the phase 2 sheets. It reuses build.py's helpers and parts.py's pieces, so the
two files look alike; build.py's own sheets are not changed.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build as B  # noqa: E402  (its helpers; its main() is not run)
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
from figlib import S, col, frame, icon, para, rect, row, shadow, spacer, text  # noqa: E402

C = B.C
OUT = HERE / "exports" / "phase2b"
W, H = 1440, 900
TB = 48                      # toolbar height
TITLES = {}                  # page -> [window titles], for the exports


BOARD = "All designs"


def section(board, name, w):
    """One part of the round on the board (as build.canvas, but inside the board, so every design is on one page)."""
    return frame(board, name, w=w, h=100, fill="bg", layout="vertical", gap=40, pad=64, radius=24, stroke="line", sw=1,
                 W="hug", H="hug")


ROW_W = 2 * W + 64           # two windows side by side: the width a section's titles wrap at


def sheet_title(parent, title, about):
    h = col(parent, "sheet title", gap=6, W="fixed")
    put(h, 0, 0, ROW_W)
    text(h, title, "display", fontSize=40, lineHeight="48px")
    para(h, about, "body", "muted")
    return h


def win(parent, page, title, about, w=W, h=H, m="Light"):
    """A window on a sheet, with its title and what it answers under it (as build.window, kept per page here)."""
    TITLES.setdefault(page, []).append(title)
    holder = col(parent, f"window/{title}", gap=14, W="hug")
    f = frame(holder, f"Window · {title}", w=w, h=h, fill="bg", radius=10, stroke="line", sw=1, W="fixed", H="fixed",
              clip=True)
    shadow(f, 10, 40, "#00000022")
    if m != "Light":
        F.mode(f, m)
    cap = col(holder, "about", gap=4, W="fixed")
    S.do("node.set", {"ids": [cap], "props": {"width": min(w, 1100)}}, ref=False)
    text(cap, title, "heading")
    para(cap, about, "small", "muted")
    return f


def design_label(parent, letter, name, about):
    """A heading over a row of windows: one design among several."""
    h = col(parent, f"design {letter}", gap=6, W="fixed")
    put(h, 0, 0, ROW_W)
    r = row(h, "title", gap=12)
    b = row(r, "letter", pad=[4, 12, 4, 12], fill="accent", radius=999)
    text(b, f"Design {letter}", "smallStrong", "onAccent")
    text(r, name, "title", fontSize=26, lineHeight="32px")
    para(h, about, "body", "muted")
    return h


def put(node, x, y, w=None, h=None):
    props = {"x": x, "y": y}
    if w is not None:
        props["width"] = w
    if h is not None:
        props["height"] = h
    S.do("node.set", {"ids": [node], "props": props}, ref=False)


def toolbar(f, w=W, active=None, inbox=2, view=None, place="Numbers 25"):
    """The toolbar as built (phase 2b steps 1-3: KJV/YLT), with a Views menu where a sheet shows it."""
    bar = row(f, "toolbar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed",
              stroke="line", strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    put(bar, 0, 0, w, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "accent")
    text(pl, place, "bodyStrong")
    icon(pl, "down", 14, "muted")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1,
              W="fixed", H="fixed")
    put(cmd, 0, 0, 420, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "Search, go to a place, or type a command", "small", "muted", W="fill", maxLines=1)
    P.kbd(cmd, "`")
    spacer(bar)
    tools = row(bar, "tools", gap=4)
    if view:
        P.tool(tools, f"View: {view}", "dock", active == "Views", caret=True)
    P.tool(tools, "KJV", "book")
    P.tool(tools, "Notebook", "notebook", active == "Notebook", count=inbox)
    P.tool(tools, "Threads", "threads", active == "Threads")
    P.tool(tools, "Shelf", "shelf", active == "Shelf")
    P.tool(tools, "Highlights", "highlight", caret=True)
    P.icon_button(tools, "more", "fg", size=34, icon_size=20)
    return bar


def reader(f, x, w, first=6, last=13, h=H - TB, sel=None):
    return B.desk_reader(f, x, TB, w, h, first=first, last=last, sel=sel)


def column(f, x, w, tabs, active, side="right", y=TB, h=H - TB):
    return B.dock(f, x, y, w, h, tabs, active, side=side)


def toggle(parent, on=True, name="toggle"):
    t = frame(parent, name, w=36, h=20, radius=10, fill="accent" if on else "line", W="fixed", H="fixed",
              layout="horizontal", mainAlign="max" if on else "min", crossAlign="center", pad=[0, 2, 0, 2])
    frame(t, "knob", w=16, h=16, radius=8, fill="surface", W="fixed", H="fixed")
    return t


def kv(parent, k, v, strong=False):
    r = row(parent, f"kv/{k}", gap=8, W="fill")
    text(r, k, "small", "muted")
    spacer(r)
    text(r, v, "smallStrong" if strong else "small")
    return r


def form_field(parent, label, value=None, placeholder="", required=False, hint=None, W="fill", trailing=None):
    box = col(parent, f"field/{label}", gap=6, W=W)
    lr = row(box, "label row", gap=6)
    text(lr, label, "smallStrong")
    text(lr, "required" if required else "optional", "caption", "accent" if required else "muted")
    P.field(box, placeholder, value, icon_name=None, trailing=trailing, height=40)
    if hint:
        para(box, hint, "caption", "muted")
    return box


def modal(f, w, h=None, title=None, sub=None, x=None, y=72):
    rect(f, "scrim", W, H, "scrim", x=0, y=0, opacity=0.55)
    m = col(f, "dialog", gap=16, pad=[20, 24, 20, 24], fill="surface", radius=16, stroke="line", sw=1,
            x=(W - w) // 2 if x is None else x, y=y, W="fixed", H="fixed" if h else "hug")
    put(m, (W - w) // 2 if x is None else x, y, w, h)
    shadow(m, 16, 48, "#00000040")
    if title:
        head = row(m, "head", gap=8, W="fill")
        tc = col(head, "titles", gap=2, W="fill")
        text(tc, title, "title")
        if sub:
            para(tc, sub, "small", "muted")
        P.icon_button(head, "close", "muted", size=34, icon_size=18, fill="sunken")
    return m


def buttons(parent, *specs):
    r = row(parent, "buttons", gap=8, W="fill")
    spacer(r)
    for label, kind in specs:
        P.button(r, label, kind)
    return r


def popover(f, x, y, w, name="popover"):
    p = col(f, name, gap=10, pad=[12, 14, 14, 14], fill="surface", radius=12, stroke="line", sw=1, x=x, y=y, W="fixed")
    put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def menu_item(parent, label, sub=None, on=False, icon_name=None, kbd=None):
    it = row(parent, f"menu/{label}", gap=10, pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None, W="fill")
    if icon_name:
        icon(it, icon_name, 18, "accent" if on else "muted")
    tc = col(it, "text", gap=0, W="fill")
    text(tc, label, "bodyStrong" if on else "body")
    if sub:
        para(tc, sub, "caption", "muted")
    if kbd:
        P.kbd(it, kbd)
    if on:
        icon(it, "check", 18, "accent")
    return it


def files_note(parent, s):
    """What the design means for the files in the study folder (the rule: same files, same formats)."""
    r = row(parent, "files", gap=10, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill", align="min")
    icon(r, "docs", 18, "muted")
    para(r, s, "small", "muted")
    return r


# Demo writing (the Phinehas demo's notes and questions, as on the phase 2 sheets; never scripture).
PAGE = [
    ("h", "Numbers 25, read again"),
    ("p", "Read the chapter through twice, once in the KJV and once in the YLT. Things to follow up:"),
    ("li", "Where else is “rose up from among the congregation” used?"),
    ("li", "Compare Numbers 25:9 with 1 Cor 10:8: 24,000 here, 23,000 “in one day” there."),
    ("li", "H7065 in Num 25:11 and 25:13; then every use in the Psalms."),
    ("p", "Psalm 106:30 names Phinehas too. Put it on the Phinehas thread, then read Malachi 2:5–6 beside it."),
    ("h", "Word study"),
    ("p", "H7065 (qânâʼ) is translated more than one way in the KJV. List the renderings first, then read each verse "
          "before writing anything about it."),
]


def page_text(parent, blocks, width=None, places=None):
    """A long piece of writing as the Journal would show it: headings, paragraphs, a list; references as links."""
    body = col(parent, "page", gap=12, W="fill" if width is None else "fixed")
    if width:
        put(body, 0, 0, width)
    places = places or {}
    for k, (kind, s) in enumerate(blocks):
        if kind == "h":
            text(body, s, "title")
        elif kind == "li":
            r = row(body, "list item", gap=10, W="fill", align="min")
            text(r, "•", "body", "muted")
            P.rich(r, s)
        else:
            if k in places:
                r = row(body, "paragraph with a place", gap=10, W="fill", align="min")
                P.chip(r, places[k], "place", icon_name="place")
                P.rich(r, s)
            else:
                P.rich(body, s)
    return body


def format_bar(parent):
    r = row(parent, "format bar", gap=2, pad=[4, 6, 4, 6], fill="sunken", radius=8)
    for lbl in ("H", "B", "I", "•", "1.", "“"):
        b = row(r, f"fmt/{lbl}", pad=[4, 9, 4, 9], radius=6)
        text(b, lbl, "smallStrong", "muted")
    rect(r, "sep", 1, 18, "line")
    for lbl, ic in (("Place", "place"), ("Thread", "threads"), ("Question", "question")):
        b = row(r, f"fmt/{lbl}", gap=4, pad=[4, 8, 4, 8], radius=6)
        icon(b, ic, 15, "muted")
        text(b, lbl, "smallStrong", "muted")
    return r


# ==== page 1: the Notebook ================================================================================================
def notebook_page(board):
    pg = "Notebook"
    cv = section(board, pg, 4700)
    sheet_title(cv, "The Notebook, from the start", "Note 09ef: the writing box reads like a chat, so it only suits short "
                  "notes; the Journal is meant for long writing and must still take a quick thought. Three designs to "
                  "choose from (or mix). Each keeps quick capture (the pen, or Ctrl+J anywhere: note e998) and keeps "
                  "the study folder's files readable by hand.")

    # ---- Design A: a page for each day
    design_label(cv, "A", "A page for each day", "The Journal is a writing page, one per day, like a diary: open it "
                 "and write, as long as you like. A thought tied to a verse is a paragraph with a place chip; it also "
                 "shows at its verse. The Inbox is the paragraphs with no place yet.")
    r = row(cv, "design A", gap=64, align="min")
    f = win(r, pg, "A1 · Today's page beside the reader", "The Notebook column holds today's page, not a list of "
            "bubbles. The format bar sits on the page; a paragraph gets a place with the Place button (or by typing "
            "@Num 25:11). Yesterday and earlier days are a scroll up, or the day picker.")
    toolbar(f, active="Notebook")
    reader(f, 0, W - 480)
    b = column(f, W - 480, 480, ["Notebook", "H7065"], "Notebook")
    hd = row(b, "day", gap=8, W="fill")
    P.icon_button(hd, "left", "muted", size=30, icon_size=16)
    text(hd, "Today · Wednesday 4 November", "heading")
    spacer(hd)
    P.segmented(hd, ["Page", "Inbox", "All"], "Page", W="hug", badges={"Inbox": 2})
    format_bar(b)
    page_text(b, PAGE[:6], places={1: "Numbers 25", 5: "Psalms 106:30"})
    caret = row(b, "caret", gap=0, W="fill")
    rect(caret, "caret", 2, 22, "accent")
    files_note(b, "Files: one Markdown file per day, notes/_journal/2026-11-04.md (new; the Python app passes over it). "
               "A paragraph with a place is also saved as a placed note, so it shows at its verse.")

    f = win(r, pg, "A2 · Writing mode: the page in the middle", "For long writing the page takes the middle of the "
            "window and the reader moves to a column (a view, see the Dock page). The reader stays at its verse; a "
            "reference clicked in the page opens beside it, never instead of it.")
    toolbar(f, active="Notebook", view="Writing")
    reader(f, 0, 520, first=6, last=11)
    mid = frame(f, "writing page", x=520, y=TB, w=W - 520, h=H - TB, fill="surface", layout="vertical",
                crossAlign="center", pad=[32, 40, 32, 40], W="fixed", H="fixed", clip=True, stroke="line",
                strokeLeftWeight=1, strokeTopWeight=0, strokeRightWeight=0, strokeBottomWeight=0)
    inner = col(mid, "column", gap=14, W="fixed")
    put(inner, 0, 0, 720)
    hr = row(inner, "head", gap=8, W="fill")
    text(hr, "Wednesday 4 November", "display", fontSize=30, lineHeight="38px")
    spacer(hr)
    P.chip(hr, "2 in the Inbox", "quiet", icon_name="inbox")
    format_bar(inner)
    page_text(inner, PAGE, places={1: "Numbers 25"})

    # ---- Design B: notes like documents
    design_label(cv, "B", "Notes like documents", "As in Apple Notes or Obsidian: a list of notes and the open note as "
                 "a full editor. Each note is still its own file, now with a title (its first line). Short notes stay "
                 "short; a long one is a document with headings, lists and places at its top.")
    r = row(cv, "design B", gap=64, align="min")
    f = win(r, pg, "B1 · The list and the editor", "The Notebook column splits in two when it is wide (or in writing "
            "mode): the list on the left, filtered by Today, Inbox, Questions or a search; the note on the right. "
            "A note's places and threads are chips under its title, with + Place and + Thread.")
    toolbar(f, active="Notebook", view="Writing")
    reader(f, 0, 500, first=6, last=10)
    lst = frame(f, "note list", x=500, y=TB, w=300, h=H - TB, fill="sunken", layout="vertical", gap=6, pad=12,
                W="fixed", H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=1,
                strokeTopWeight=0, strokeBottomWeight=0)
    P.field(lst, "Search your notes", icon_name="search", height=36)
    P.segmented(lst, ["Today", "Inbox", "Questions", "All"], "Today", badges={"Inbox": 2})
    for t, first, plc, on in (("Numbers 25, read again", "Read the chapter through twice…", "Numbers 25", True),
                              ("24,000 or 23,000?", "24,000 died here; 1 Cor 10:8 says…", None, False),
                              ("Word study: H7065", "List the renderings first, then…", "H7065 everywhere", False),
                              ("Rose up from among", "Check where else this is used.", None, False)):
        it = col(lst, f"item/{t}", gap=3, pad=[10, 12, 10, 12], radius=10, fill="surface" if on else None,
                 stroke="accent" if on else None, sw=1 if on else None)
        text(it, t, "bodyStrong")
        para(it, first, "small", "muted", maxLines=1)
        cr = row(it, "chips", gap=6)
        P.chip(cr, plc, "place", icon_name="place") if plc else P.chip(cr, "No place yet", "quiet")
    ed = frame(f, "editor", x=800, y=TB, w=W - 800, h=H - TB, fill="surface", layout="vertical", gap=14,
               pad=[28, 36, 28, 36], W="fixed", H="fixed", clip=True)
    text(ed, "Numbers 25, read again", "display", fontSize=28, lineHeight="36px")
    cr = row(ed, "places", gap=8)
    P.chip(cr, "Numbers 25", "place", icon_name="place")
    P.chip(cr, "Phinehas", "outline", dot_color="threadA")
    P.chip(cr, "+ Place", "quiet")
    P.chip(cr, "+ Thread", "quiet")
    spacer(cr)
    text(cr, "Wed 4 Nov · 09:12", "caption", "muted")
    format_bar(ed)
    page_text(ed, PAGE[1:6])
    files_note(ed, "Files: unchanged. One note per Markdown file, as now; the first line is its title. The list is "
               "a view over notes/, notes/_inbox/ and trails/.")

    f = win(r, pg, "B2 · Quick capture, anywhere (Ctrl+J)", "The pen, or Ctrl+J from anywhere, opens a small box "
            "anchored to the verse last clicked. Enter saves it as a new short note; Ctrl+Enter opens it in the "
            "editor to keep writing. Nothing else on screen moves.")
    toolbar(f)
    reader(f, 0, W - 420)
    b = column(f, W - 420, 420, ["Notebook", "H7065"], "Notebook")
    P.segmented(b, ["Today", "Inbox", "Questions", "All"], "Today", badges={"Inbox": 2})
    for t in ("Numbers 25, read again", "24,000 or 23,000?", "Word study: H7065"):
        it = col(b, f"item/{t}", gap=3, pad=[10, 12, 10, 12], radius=10, fill="surface", stroke="line", sw=1)
        text(it, t, "bodyStrong")
    q = popover(f, 320, 560, 540, "quick capture")
    qr = row(q, "head", gap=8, W="fill")
    text(qr, "A thought", "heading")
    spacer(qr)
    P.kbd(qr, "Ctrl+J")
    P.field(q, "Write it down…", "Compare the two numbers with 1 Cor 10:8", icon_name="pen", height=44)
    o = row(q, "options", gap=8, W="fill")
    P.chip(o, "Numbers 25:9", "place", icon_name="place")
    P.chip(o, "Question", "outline", icon_name="question")
    spacer(o)
    text(o, "Enter saves · Ctrl+Enter: keep writing", "caption", "muted")

    # ---- Design C: a page for each chapter
    design_label(cv, "C", "A page for each chapter", "Writing lives next to the text it is about: beside Numbers 25, "
                 "your page for Numbers 25, in the chapter's order. Notes at verses are blocks under their verse; free "
                 "writing goes between them. Undated thoughts wait in a tray.")
    r = row(cv, "design C", gap=64, align="min")
    f = win(r, pg, "C1 · Numbers 25, your page", "Turning the chapter turns the page. A block's verse number is a "
            "link back to the verse; writing under the chapter heading is a note on the whole chapter. The Journal "
            "(by day) is still a tab, as a list of what was written when.")
    toolbar(f, active="Notebook")
    reader(f, 0, 760)
    b = column(f, 760, W - 760, ["Numbers 25 · page", "Journal", "Inbox 2"], "Numbers 25 · page")
    text(b, "Numbers 25", "title")
    format_bar(b)
    P.rich(b, "Read the chapter through twice, once in the KJV and once in the YLT. Psalm 106:30 names Phinehas too.")
    for v, s in ((8, "Look up 'tent' and 'belly' (H6898, H6897) with every use."),
                 (9, "24,000 died here; 1 Cor 10:8 says 23,000 fell in one day. How do the two numbers relate?"),
                 (11, "H7065 is rendered more than one way in the KJV: list them, then read each verse.")):
        blk = row(b, f"verse block {v}", gap=12, W="fill", align="min")
        vb = row(blk, "verse", pad=[2, 8, 2, 8], fill="accentSoft", radius=6)
        text(vb, f"25:{v}", "smallStrong", "accent")
        P.rich(blk, s)
    add = row(b, "add", gap=8, pad=[8, 10, 8, 10], radius=8, stroke="line", sw=1, W="fill")
    icon(add, "plus", 16, "muted")
    text(add, "Write about verse 13…", "body", "muted")
    files_note(b, "Files: unchanged. Each block is a placed note (its own file); free writing between blocks is a "
               "note on the chapter (anchor NUM.25:1-25:18). The page is drawn from them.")

    f = win(r, pg, "C2 · The tray: thoughts not placed yet", "Quick capture with no verse lands in the tray at the "
            "page's foot. Drag one onto a verse in the reader, or onto a place in the page, to place it.")
    toolbar(f, active="Notebook")
    reader(f, 0, 760)
    b = column(f, 760, W - 760, ["Numbers 25 · page", "Journal", "Inbox 2"], "Numbers 25 · page")
    text(b, "Numbers 25", "title")
    P.rich(b, "Read the chapter through twice, once in the KJV and once in the YLT.")
    frame(b, "push down", w=1, h=1, W="fill", H="fill")
    tray = col(b, "tray", gap=8, pad=12, fill="sunken", radius=12, W="fill")
    tr = row(tray, "tray head", gap=8, W="fill")
    icon(tr, "inbox", 18, "muted")
    text(tr, "Not placed yet · 2", "smallStrong")
    spacer(tr)
    text(tr, "drag onto a verse", "caption", "muted")
    for kind, s, t in B.INBOX:
        P.note_card(tray, s, None, t, kind, compact=True)


# ==== page 2: reading plans ===============================================================================================
BOOKS_NT = ["Matthew", "Mark", "Luke", "John", "Acts", "Romans"]


def plans_page(board):
    pg = "Reading plans"
    cv = section(board, pg, 4700)
    sheet_title(cv, "Reading plans, from the start", "Notes fbf6, 6d32, c440, 9ded: build a plan like a form, with "
                  "only a name and what to read required; pick several books without typing; no separate “plan of "
                  "your own”; drag a day ahead; and say plainly what rescheduling does. Three builders, then the plan "
                  "itself. No terminal words (--books) anywhere.")

    # ---- Design A: one form
    design_label(cv, "A", "One form, two things required", "Everything on one sheet. Name and what to read are "
                 "required; order, pace and the start are optional, with sensible defaults shown. The summary says "
                 "what you will get before you start.")
    r = row(cv, "design A", gap=64, align="min")
    f = win(r, pg, "A1 · New reading plan", "Books are chips: quick picks for the usual groups, Choose books… for "
            "a grid where several are ticked at once, and Add a passage for part of a book. With no pace, the plan "
            "has no dates: you read in order at your own pace and it remembers where you are.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 720, title="New reading plan", sub="Only a name and what to read are needed.")
    form_field(m, "Name", "Gospels and Romans", required=True)
    wt = col(m, "what", gap=8, W="fill")
    lr = row(wt, "label", gap=6)
    text(lr, "What to read", "smallStrong")
    text(lr, "required", "caption", "accent")
    quick = row(wt, "quick picks", gap=6, wrap=True, W="fill")
    for q, on in (("Whole Bible", False), ("Old Testament", False), ("New Testament", False), ("Gospels", True),
                  ("Psalms and Proverbs", False), ("Choose books…", False), ("Add a passage…", False)):
        P.chip(quick, q, "selected" if on else "outline")
    picked = row(wt, "picked", gap=6, wrap=True, pad=10, fill="sunken", radius=10, W="fill")
    for bk in ("Matthew", "Mark", "Luke", "John", "Romans"):
        ch = row(picked, f"book/{bk}", gap=6, pad=[5, 8, 5, 12], fill="surface", radius=999, stroke="line", sw=1)
        text(ch, bk, "smallStrong")
        icon(ch, "close", 14, "muted")
    oc = col(m, "order", gap=6, W="fill")
    lr = row(oc, "label", gap=6)
    text(lr, "Order", "smallStrong")
    text(lr, "optional", "caption", "muted")
    P.segmented(oc, ["Bible order", "As I listed them", "Old and New side by side"], "Bible order")
    pc = col(m, "pace", gap=6, W="fill")
    lr = row(pc, "label", gap=6)
    text(lr, "Pace", "smallStrong")
    text(lr, "optional", "caption", "muted")
    pr = row(pc, "pace row", gap=10, W="fill")
    P.segmented(pr, ["My own pace", "Finish in…", "Chapters a day…"], "Chapters a day…", W="hug")
    num = P.field(pr, "3", "3", icon_name=None, W="fixed", height=36, trailing="a day")
    put(num, 0, 0, 110)
    sr = row(m, "start", gap=10, W="fill", align="min")
    form_field(sr, "Start", "Today, Wed 4 Nov", W="fill")
    form_field(sr, "Days off", "None", W="fill", hint="Sundays, say: those days are skipped")
    sm = col(m, "summary", gap=4, pad=12, fill="accentSoft", radius=10, W="fill")
    text(sm, "5 books · 105 chapters · 3 chapters a day", "bodyStrong")
    text(sm, "35 days, Wed 4 Nov to Tue 8 Dec · first day: Matthew 1–3", "small", "muted")
    buttons(m, ("Cancel", "secondary"), ("Start the plan", "primary"))

    f = win(r, pg, "A2 · Choose books…", "A grid of every book by testament; tick as many as wanted (or drag across "
            "them). Groups at the top tick their books. The count updates as they are ticked.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 760, title="Choose books", sub="5 ticked · 105 chapters")
    gr = row(m, "groups", gap=6, wrap=True, W="fill")
    for g in ("Law", "History", "Poetry", "Prophets", "Gospels", "Letters of Paul", "Other letters"):
        P.chip(gr, g, "selected" if g == "Gospels" else "outline")
    P.label(m, "Old Testament")
    grid = row(m, "ot", gap=6, wrap=True, W="fill")
    for bk in ("Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel",
               "2 Samuel", "1 Kings", "2 Kings", "Psalms", "Proverbs", "Isaiah", "Jeremiah", "…"):
        cell = row(grid, f"book/{bk}", pad=[6, 10, 6, 10], radius=8, stroke="line", sw=1, fill="surface")
        text(cell, bk, "small")
    P.label(m, "New Testament")
    grid = row(m, "nt", gap=6, wrap=True, W="fill")
    for bk in ("Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
               "Ephesians", "Philippians", "Colossians", "…"):
        on = bk in ("Matthew", "Mark", "Luke", "John", "Romans")
        cell = row(grid, f"book/{bk}", gap=6, pad=[6, 10, 6, 10], radius=8, stroke="accent" if on else "line", sw=1,
                   fill="accentSoft" if on else "surface")
        if on:
            icon(cell, "check", 14, "accent")
        text(cell, bk, "smallStrong" if on else "small")
    buttons(m, ("Clear", "ghost"), ("Done", "primary"))

    # ---- Design B: start from a preset
    design_label(cv, "B", "Start from a preset, then adjust", "The first step is a choice of cards, so the usual "
                 "plans are one click; each opens the same few fields filled in. A published plan (a chronological "
                 "one, note 032f) is imported from its file; the app ships none whose order is a judgment.")
    r = row(cv, "design B", gap=64, align="min")
    f = win(r, pg, "B1 · Pick a kind of plan", "Cards with what each reads and the usual length. Books I choose and "
            "At my own pace are cards too, so there is no separate form for “your own”.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 900, title="Start a reading plan")
    grid = row(m, "cards", gap=12, wrap=True, W="fill")
    for t, sub, on in (("Bible in a year", "Genesis to Revelation · 365 days", False),
                       ("Old and New together", "some of each every day · 365 days", False),
                       ("New Testament", "Matthew to Revelation · 90 days", False),
                       ("Psalms and Proverbs", "31 days", False),
                       ("Books I choose", "any books, any pace", True),
                       ("At my own pace", "in order, no dates", False),
                       ("A published plan…", "import its file (chronological, say)", False)):
        card = col(grid, f"card/{t}", gap=4, pad=14, radius=12, stroke="accent" if on else "line", sw=1.5 if on else 1,
                   fill="accentSoft" if on else "surface", W="fixed")
        put(card, 0, 0, 268)
        text(card, t, "bodyStrong")
        para(card, sub, "small", "muted")
    buttons(m, ("Cancel", "secondary"), ("Next", "primary"))

    f = win(r, pg, "B2 · Books I choose: adjust", "The card's fields, filled in; a strip shows the first days so the "
            "pace can be judged before starting. Change anything; the strip follows.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 900, title="Books I choose", sub="Step 2 of 2")
    two = row(m, "two", gap=20, W="fill", align="min")
    left = col(two, "fields", gap=12, W="fill")
    form_field(left, "Name", "Gospels and Romans", required=True)
    form_field(left, "Books", "Matthew, Mark, Luke, John, Romans", required=True, trailing="Choose…")
    form_field(left, "Pace", "3 chapters a day", trailing="or: finish by a date")
    form_field(left, "Start", "Today")
    right = col(two, "first days", gap=8, W="fill")
    P.label(right, "The first days")
    for d, lbl in ((1, "Matthew 1–3"), (2, "Matthew 4–6"), (3, "Matthew 7–9"), (4, "Matthew 10–12"),
                   (5, "Matthew 13–15"), (35, "Romans 14–16")):
        if d == 35:
            text(right, "…", "body", "muted")
        dr = row(right, f"day {d}", gap=10, pad=[8, 10, 8, 10], radius=8, fill="sunken", W="fill")
        text(dr, f"Day {d}", "smallStrong", "muted")
        text(dr, lbl, "body")
    buttons(m, ("Back", "secondary"), ("Start the plan", "primary"))

    # ---- Design C: build by days
    design_label(cv, "C", "Build it by days", "For a plan of your own order: books dragged in, days as rows of "
                 "chapter chips that can be dragged from one day to another. Pace is a single control that lays the "
                 "chapters out again; days you moved by hand stay where you put them.")
    r = row(cv, "design C", gap=64, align="min")
    f = win(r, pg, "C1 · The plan as a board", "Left: the books, dragged in (or double-clicked). Right: the days. "
            "A chapter chip drags to another day; a day drags up or down. Nothing is typed.")
    toolbar(f)
    bk = frame(f, "books", x=0, y=TB, w=320, h=H - TB, fill="sunken", layout="vertical", gap=8, pad=16, W="fixed",
               H="fixed", clip=True, stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    P.field(bk, "Find a book", icon_name="search", height=36)
    P.label(bk, "New Testament")
    for name, n in (("Matthew", 28), ("Mark", 16), ("Luke", 24), ("John", 21), ("Acts", 28), ("Romans", 16)):
        br = row(bk, f"book/{name}", gap=8, pad=[8, 10, 8, 8], radius=8, fill="surface", stroke="line", sw=1, W="fill")
        icon(br, "drag", 18, "muted", weight=2.4)
        text(br, name, "body")
        spacer(br)
        text(br, f"{n} ch", "caption", "muted")
    main = frame(f, "days", x=320, y=TB, w=W - 320, h=H - TB, fill="bg", layout="vertical", gap=10, pad=[20, 28, 20, 28],
                 W="fixed", H="fixed", clip=True)
    hr = row(main, "head", gap=12, W="fill")
    text(hr, "Gospels and Romans", "title")
    spacer(hr)
    P.segmented(hr, ["My own pace", "Chapters a day", "Finish by"], "Chapters a day", W="hug")
    P.chip(hr, "3 a day", "outline")
    for d, chs, moved in ((1, ["Matthew 1", "Matthew 2", "Matthew 3"], False), (2, ["Matthew 4", "Matthew 5"], True),
                          (3, ["Matthew 6", "Matthew 7", "Matthew 8"], False), (4, ["Matthew 9", "Matthew 10", "Matthew 11"], False),
                          (5, ["Matthew 12", "Matthew 13", "Matthew 14"], False)):
        dr = row(main, f"day {d}", gap=10, pad=[10, 12, 10, 8], radius=10, fill="surface", stroke="line", sw=1, W="fill")
        icon(dr, "drag", 18, "muted", weight=2.4)
        text(dr, f"Day {d}", "smallStrong", "muted")
        for ch in chs:
            P.chip(dr, ch, "outline")
        spacer(dr)
        if moved:
            text(dr, "kept as you set it", "caption", "accent")
    files_note(main, "Files: unchanged. A plan is one file in reading/plans/, written out day by day; what was read "
               "stays in reading/log.jsonl, so moving days never loses it.")

    # ---- the plan itself
    design_label(cv, "·", "The plan itself (for every design)", "Where you are, today's reading as one clear card, "
                 "and the days. When days are missed, the choices say exactly what each does (note 9ded): no "
                 "“Spread the rest…” to guess at.")
    r = row(cv, "plan view", gap=64, align="min")
    f = win(r, pg, "P1 · A plan in its pane", "Today's card opens the chapter and marks it read. Days is a list "
            "with a ✓ for each read; drag a day to move it (note 9ded). ? opens the guide's entry for this pane.")
    toolbar(f)
    reader(f, 0, W - 440)
    b = column(f, W - 440, 440, ["Reading plans", "Notebook"], "Reading plans")
    hr = row(b, "head", gap=8, W="fill")
    text(hr, "Gospels and Romans", "title")
    spacer(hr)
    P.icon_button(hr, "question", "muted", size=30, icon_size=18)
    bar = frame(b, "progress", w=10, h=8, radius=4, fill="sunken", W="fill", H="fixed", layout="horizontal")
    frame(bar, "done", w=70, h=8, radius=4, fill="accent", W="fixed", H="fixed")
    text(b, "Day 9 of 35 · 6 read · 2 to catch up", "small", "muted")
    tc = col(b, "today", gap=8, pad=14, fill="accentSoft", radius=12, W="fill")
    text(tc, "TODAY", "label", "accent")
    text(tc, "Matthew 25–27", "title")
    tr = row(tc, "acts", gap=8)
    P.button(tr, "Read", "primary", "book", size="sm")
    P.button(tr, "Mark read", "secondary", "check", size="sm")
    P.label(b, "Days")
    for d, lbl, st in ((6, "Matthew 16–18", "✓"), (7, "Matthew 19–21", "missed"), (8, "Matthew 22–24", "missed"), (9, "Matthew 25–27", "today"),
                       (10, "Matthew 28; Mark 1–2", ""), (11, "Mark 3–5", "")):
        dr = row(b, f"day {d}", gap=10, pad=[8, 10, 8, 6], radius=8, fill="surface", stroke="line", sw=1, W="fill")
        icon(dr, "drag", 18, "muted", weight=2.4)
        text(dr, f"{d}", "smallStrong", "muted")
        text(dr, lbl, "body")
        spacer(dr)
        if st:
            text(dr, st, "caption", "accent" if st == "✓" else "warn" if st == "missed" else "muted")

    f = win(r, pg, "P2 · Days were missed: what to do", "Each choice says what it does to the dates, with the new "
            "end date, and changes nothing until it is picked. What was read stays read whichever is chosen.")
    toolbar(f)
    reader(f, 0, W - 440)
    b = column(f, W - 440, 440, ["Reading plans", "Notebook"], "Reading plans")
    text(b, "Gospels and Romans", "title")
    text(b, "Day 9 of 35 · 2 days not read", "small", "muted")
    ch = col(b, "choices", gap=8, pad=14, fill="surface", radius=12, stroke="line", sw=1, W="fill")
    text(ch, "2 days were not read. What should happen?", "bodyStrong")
    for t, s, on in (("Pick up where I left off", "Every day moves 2 days later. Ends Thu 10 Dec instead of Tue 8 Dec.", True),
                     ("Fit them into the days left", "The 2 days' chapters are shared out over the remaining days. "
                      "Still ends Tue 8 Dec; a few days get one more chapter.", False),
                     ("Leave them for later", "They wait at the end of the plan. Ends Thu 10 Dec.", False),
                     ("Skip them", "Marked as skipped, not read. Ends Tue 8 Dec.", False)):
        it = row(ch, f"choice/{t}", gap=10, pad=[10, 12, 10, 12], radius=10, stroke="accent" if on else "line", sw=1,
                 fill="accentSoft" if on else None, W="fill", align="min")
        dotf = frame(it, "radio", w=18, h=18, radius=9, stroke="accent" if on else "line", sw=2 if on else 1.5,
                     W="fixed", H="fixed", layout="horizontal", mainAlign="center", crossAlign="center")
        if on:
            frame(dotf, "on", w=8, h=8, radius=4, fill="accent", W="fixed", H="fixed")
        tc = col(it, "text", gap=2, W="fill")
        text(tc, t, "bodyStrong")
        para(tc, s, "small", "muted")
    buttons(ch, ("Not now", "ghost"), ("Do it", "primary"))


# ==== page 3: the dock and views ==========================================================================================
def dock_page(board):
    pg = "Dock and views"
    cv = section(board, pg, 3200)
    sheet_title(cv, "The dock and views", "Notes 564e, 2395 and 8c69: dockview-style tabs; fixed zones at the top "
                  "and bottom as well as the sides; saved views such as “word study”; and a new tab opens where its "
                  "kind of pane already is, not always on the right.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "D1 · Dragging a tab: where it can go", "While a tab is dragged, the zones it can drop into are "
            "shown: either column, a band across the top or the bottom of the reader, beside another pane (split), "
            "or anywhere else to float. Each zone says what it is.")
    toolbar(f, view="Reading")
    lw, rw = 380, 420
    b = column(f, 0, lw, ["H7065", "Every use"], "H7065", side="left")
    P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])
    reader(f, lw, W - lw - rw)
    b = column(f, W - rw, rw, ["Notebook", "Phinehas"], "Notebook")
    B.journal_pane(b, composer=False)
    for name, x, y, w, h in (("Left column", 0, TB, lw, H - TB), ("Right column", W - rw, TB, rw, H - TB),
                             ("Top band", lw, TB, W - lw - rw, 150), ("Bottom band", lw, H - 200, W - lw - rw, 200)):
        z = frame(f, f"zone/{name}", x=x + 6, y=y + 6, w=w - 12, h=h - 12, fill="accentSoft", radius=12, stroke="accent",
                  sw=2, dashes=[8, 6], W="fixed", H="fixed", layout="horizontal", mainAlign="center", crossAlign="center",
                  opacity=0.72)
        text(z, name, "bodyStrong", "accent")
    ghost = row(f, "dragged tab", gap=8, pad=[8, 12, 8, 12], fill="surface", radius=8, stroke="accent", sw=1.5, x=640, y=520)
    shadow(ghost, 10, 24, "#00000040")
    text(ghost, "Every use · zealous", "smallStrong")
    hint = row(f, "hint", gap=8, pad=[8, 12, 8, 12], fill="fg", radius=999, x=560, y=440)
    text(hint, "Drop on the reader to float · Shift: split beside", "smallStrong", "bg")

    f = win(r, pg, "D2 · The word study view", "A saved view: the Strong's entry on the left, every use on the "
            "right, the interlinear in a band under the reader. Choosing the view puts each pane in its place; the "
            "reader stays at its verse.")
    toolbar(f, view="Word study")
    b = column(f, 0, lw, ["H7065", "BDB"], "H7065", side="left")
    P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])
    reader(f, lw, W - lw - rw, first=10, last=13, h=H - TB - 230)
    band = frame(f, "bottom band", x=lw, y=H - 230, w=W - lw - rw, h=230, fill="surface", layout="vertical", W="fixed",
                 H="fixed", clip=True, stroke="line", strokeTopWeight=1, strokeLeftWeight=0, strokeRightWeight=0,
                 strokeBottomWeight=0)
    P.pane_header(band, ["Interlinear · Numbers 25:11"], "Interlinear · Numbers 25:11")
    cells = row(band, "words", gap=8, pad=12, W="fill", align="min", wrap=True)
    for w_ in C["interlinear"][:7]:
        cell = P.interlinear_cell(cells, w_)
        put(cell, 0, 0, 120)
    b = column(f, W - rw, rw, ["Every use", "Notebook"], "Every use")
    text(b, "H7065 · every use", "heading")
    for key, v in (("num25", 11), ("num25", 13), ("ps106", 30)):
        vv = next(x for x in C[key]["verses"] if x["v"] == v)
        ref = {"num25": "Numbers 25", "ps106": "Psalms 106"}[key]
        P.verse_line(b, f"{ref}:{v}", vv["text"], max_lines=3)

    r = row(cv, "row 2", gap=64, align="min")
    f = win(r, pg, "D3 · Views", "The toolbar's View menu: the views you saved, each with what it holds, and Save "
            "this view… for the window as it is now. `view word study` does the same from the command field and "
            "from a terminal (`wb do`).")
    toolbar(f, active="Views", view="Reading")
    reader(f, 0, W - 420)
    b = column(f, W - 420, 420, ["Notebook"], "Notebook")
    B.journal_pane(b, composer=False)
    m = popover(f, 760, TB + 6, 360, "views menu")
    for t, s, on in (("Reading", "the reader and the Notebook", True),
                     ("Word study", "Strong's left, every use right, interlinear below", False),
                     ("Writing", "the Notebook in the middle, the reader in a column", False),
                     ("Thread building", "a thread left, search right", False)):
        menu_item(m, t, s, on, "dock")
    P.divider(m)
    menu_item(m, "Save this view…", "where each pane is now, under a name", icon_name="plus")

    f = win(r, pg, "D4 · Where new tabs open", "Note 8c69: the threads list was moved to the left; a thread opened "
            "from it opens beside it, on the left, not back on the right. A pane opens where a pane of its kind (or "
            "the pane it came from) is; a card pinned as a tab does the same.")
    toolbar(f)
    b = column(f, 0, 420, ["Threads", "Phinehas"], "Phinehas", side="left")
    text(b, "Phinehas", "title")
    for key, v, ref in (("ps106", 30, "Psalms 106:30"), ("num25", 11, "Numbers 25:11"), ("mal2", 5, "Malachi 2:5")):
        vv = next(x for x in C[key]["verses"] if x["v"] == v)
        P.member_row(b, ref, vv["text"])
    reader(f, 420, W - 420)
    hint = row(f, "hint", gap=8, pad=[8, 12, 8, 12], fill="fg", radius=999, x=470, y=H - 70)
    icon(hint, "left", 16, "bg")
    text(hint, "Opened beside Threads, where you put it", "smallStrong", "bg")


# ==== page 4: threads, Help, words ========================================================================================
def study_page(board):
    pg = "Threads, Help, words"
    cv = section(board, pg, 3200)
    sheet_title(cv, "Threads, Help and words", "Note 73c4: sort and filter what is in a thread. Note 9ded: every "
                  "button with a clear entry in a guide that is easy to reach. Note 0e98: a click on a word in a "
                  "definition (or your own notes) gives its English definition.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "T1 · A thread: sort and filter", "Above the places: a filter (words in the verses and notes), "
            "All / Scripture / Notes, and Sort: your order (drag), Bible order, newest or oldest added. Dragging "
            "works in your order only, and says so.")
    toolbar(f, active="Threads")
    reader(f, 0, W - 480)
    b = column(f, W - 480, 480, ["Threads", "Phinehas"], "Phinehas")
    text(b, "Phinehas", "title")
    para(b, "Phinehas and the covenant of peace.", "small", "muted")
    tools = row(b, "tools", gap=8, W="fill")
    P.field(tools, "Filter this thread", icon_name="filter", height=36)
    P.segmented(b, ["All", "Scripture", "Notes"], "All")
    sr = row(b, "sort", gap=8, W="fill")
    text(sr, "6 places · 2 notes", "caption", "muted")
    spacer(sr)
    P.chip(sr, "Sort: Bible order", "outline", icon_name="down")
    for key, v, ref in (("num25", 7, "Numbers 25:7"), ("num25", 11, "Numbers 25:11"), ("ps106", 30, "Psalms 106:30"),
                        ("mal2", 5, "Malachi 2:5")):
        vv = next(x for x in C[key]["verses"] if x["v"] == v)
        P.member_row(b, ref, vv["text"], drag=False)
    P.note_card(b, "Read Psalm 106:30 beside Numbers 25:11.", "on the thread", "Tue 3 Nov")
    m = popover(f, W - 300, 290, 260, "sort menu")
    for t, on in (("Your order (drag)", False), ("Bible order", True), ("Newest added", False), ("Oldest added", False)):
        menu_item(m, t, on=on)

    f = win(r, pg, "T2 · Help: a guide to the window", "Help has three tabs: Guide (each part of the window, every "
            "button in it, what it does), Commands (the manual, as now) and Keys. Each pane's ? opens its own entry; "
            "a search finds any button by its words.")
    toolbar(f)
    reader(f, 0, W - 520)
    b = column(f, W - 520, 520, ["Help"], "Help")
    P.field(b, "Search the guide", "spread", icon_name="search", height=36)
    P.segmented(b, ["Guide", "Commands", "Keys"], "Guide")
    two = row(b, "two", gap=14, W="fill", align="min")
    nav = col(two, "contents", gap=2, W="fixed")
    put(nav, 0, 0, 150)
    for t, on in (("The reader", False), ("Notebook", False), ("Reading plans", True), ("Threads", False),
                  ("Panes and views", False), ("Highlights", False), ("Settings", False)):
        it = row(nav, f"toc/{t}", pad=[6, 8, 6, 8], radius=6, fill="accentSoft" if on else None, W="fill")
        text(it, t, "smallStrong" if on else "small", "accent" if on else "fg")
    ent = col(two, "entry", gap=10, W="fill")
    text(ent, "Reading plans", "title")
    for t, s in (("Mark read", "Records today's chapters as read in your reading log. A chapter read from the "
                  "reader counts too."),
                 ("Days", "Every day of the plan with its date; ✓ when read. Drag a day to move it."),
                 ("When days are missed", "Four choices, each saying what it does to the dates before anything "
                  "changes: pick up where you left off, fit them into the days left, leave them for later, or skip "
                  "them."),
                 ("Stop", "Ends the plan. Its file goes to the trash; what you read stays in the log.")):
        e = col(ent, f"guide/{t}", gap=2, pad=[8, 10, 8, 10], radius=8, fill="sunken" if t.startswith("When") else None,
                W="fill")
        text(e, t, "bodyStrong")
        para(e, s, "small", "muted")

    r = row(cv, "row 2", gap=64, align="min")
    f = win(r, pg, "T3 · A word's English definition", "In a Strong's or BDB entry (and, if wanted, in your own "
            "notes) a click on an English word shows its entry from an English dictionary. Which dictionary is the "
            "person's choice; its name and license are shown on the card, as the Bible texts' are.")
    toolbar(f)
    b = column(f, 0, 460, ["H7065"], "H7065", side="left")
    P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])
    reader(f, 460, W - 460)
    card = popover(f, 120, 330, 380, "definition card")
    hr = row(card, "head", gap=8, W="fill")
    text(hr, "envious", "title")
    spacer(hr)
    P.chip(hr, "English", "quiet")
    for k in range(3):
        rect(card, f"definition line {k}", 330 - k * 60, 10, "sunken", cornerRadius=5)
    para(card, "The definition, verbatim from the dictionary chosen (not decided yet: a public-domain one, or a "
         "licensed one with its terms).", "small", "muted")
    sr = row(card, "source", gap=6, W="fill")
    icon(sr, "book", 16, "muted")
    text(sr, "Source: to be chosen · its license", "caption", "muted")


# ==== page 5: the Shelf and settings ======================================================================================
def shelf_page(board):
    pg = "Shelf and settings"
    cv = section(board, pg, 3200)
    sheet_title(cv, "The Shelf and settings", "Notes 3fa7, a484, c551, 8810: the Shelf as folders, like Obsidian's "
                  "files, where opening a set opens all its tabs; and one Settings place with Customize: which "
                  "toolbar buttons show, the reading font and size, hover cards, the theme and the keys.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "S1 · The Shelf as folders", "Folders hold sets; a set holds places, threads, notes, lessons and "
            "panes. Open all puts its panes where they were saved (a set is a small view). Drag a set between "
            "folders; drag a pane's tab onto a set to add it.")
    toolbar(f, active="Shelf")
    b = column(f, 0, 400, ["Shelf"], "Shelf", side="left")
    P.field(b, "Find in the Shelf", icon_name="search", height=36)
    for depth, t, kind, on in ((0, "Phinehas study", "folder", False), (1, "Word study: zeal", "set", True),
                               (1, "Covenant of peace", "set", False), (0, "Romans", "folder", False),
                               (1, "Chapter 10", "set", False), (0, "Lessons", "folder", False)):
        it = row(b, f"shelf/{t}", gap=8, pad=[7, 10, 7, 10 + depth * 18], radius=8, fill="accentSoft" if on else None,
                 W="fill")
        icon(it, "down" if kind == "folder" else "shelf", 16, "muted")
        text(it, t, "bodyStrong" if kind == "folder" else "body")
    oc = col(b, "open set", gap=8, pad=12, fill="surface", radius=12, stroke="line", sw=1, W="fill")
    text(oc, "Word study: zeal", "heading")
    for t in ("H7065 · Strong's", "Every use · zealous", "Interlinear · Numbers 25:11", "Phinehas · thread"):
        rr = row(oc, f"item/{t}", gap=8, W="fill")
        icon(rr, "dock", 16, "muted")
        text(rr, t, "small")
    P.button(oc, "Open all 4", "primary", "dock", size="sm")
    reader(f, 400, W - 400)

    f = win(r, pg, "S2 · Settings: Customize the toolbar", "One Settings window (More ⋯ → Settings). Customize: "
            "each toolbar button can be shown or hidden and dragged into order; the preview at the top is the "
            "toolbar as it will be. Reading: font, size, italics, the version. Hover cards, theme and keys each "
            "have their section.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 860, h=640, title="Settings")
    two = row(m, "two", gap=20, W="fill", H="fill", align="min")
    nav = col(two, "sections", gap=2, W="fixed")
    put(nav, 0, 0, 180)
    for t, on in (("Customize", True), ("Reading", False), ("Notebook", False), ("Hover and cards", False),
                  ("Theme", False), ("Keys", False)):
        it = row(nav, f"section/{t}", pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None, W="fill")
        text(it, t, "smallStrong" if on else "body", "accent" if on else "fg")
    body = col(two, "customize", gap=10, W="fill")
    P.label(body, "The toolbar")
    prev = row(body, "preview", gap=4, pad=8, fill="sunken", radius=10, W="fill")
    for t, ic in (("View: Reading", "dock"), ("KJV", "book"), ("Notebook", "notebook"), ("Threads", "threads"),
                  ("Highlights", "highlight")):
        P.tool(prev, t, ic)
    for t, on in (("View menu", True), ("KJV / YLT", True), ("Notebook", True), ("Threads", True), ("Shelf", False),
                  ("Highlights", True), ("Reading plans", False)):
        it = row(body, f"button/{t}", gap=10, pad=[8, 10, 8, 6], radius=8, stroke="line", sw=1, W="fill")
        icon(it, "drag", 18, "muted", weight=2.4)
        text(it, t, "body")
        spacer(it)
        toggle(it, on)
    P.label(body, "The command field")
    it = row(body, "command field", gap=10, pad=[8, 10, 8, 10], radius=8, stroke="line", sw=1, W="fill")
    text(it, "Show suggestions as I type", "body")
    spacer(it)
    toggle(it, True)


# ==== second pass (the person's choices of 2026-11-04, docs/phase2b-design.md section 6) =================================
def note_list(f, x, w, group, items, search=None):
    """B's list, with a Group control: by day (A's idea), by chapter (C's idea), by thread, or none."""
    lst = frame(f, "note list", x=x, y=TB, w=w, h=H - TB, fill="sunken", layout="vertical", gap=6, pad=12,
                W="fixed", H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=1,
                strokeTopWeight=0, strokeBottomWeight=0)
    P.field(lst, "Search your notes", search, icon_name="search", height=36)
    gr = row(lst, "group", gap=6, W="fill")
    text(gr, "Group", "caption", "muted")
    P.segmented(gr, ["Day", "Chapter", "Thread", "None"], group, W="fill")
    for it in items:
        if it[0] == "head":
            hr = row(lst, f"head/{it[1]}", gap=8, pad=[8, 2, 2, 2], W="fill")
            text(hr, it[1], "label", "muted")
            if len(it) > 2:
                spacer(hr)
                text(hr, it[2], "caption", "muted")
            continue
        _, t, first, chip_, on = it
        c = col(lst, f"item/{t}", gap=3, pad=[9, 12, 9, 12], radius=10, fill="surface" if on else None,
                stroke="accent" if on else None, sw=1 if on else None, W="fill")
        text(c, t, "bodyStrong")
        if first:
            para(c, first, "small", "muted", maxLines=1)
        if chip_:
            cr = row(c, "chips", gap=6)
            kind = "quiet" if chip_ in ("No place yet", "Today's page") else "place"
            P.chip(cr, chip_, kind, icon_name=None if kind == "quiet" else "place")
    return lst


def editor(f, x, title, chips, blocks, linked=None, files=None, sub=None):
    ed = frame(f, "editor", x=x, y=TB, w=W - x, h=H - TB, fill="surface", layout="vertical", gap=14,
               pad=[28, 36, 28, 36], W="fixed", H="fixed", clip=True)
    text(ed, title, "display", fontSize=28, lineHeight="36px")
    cr = row(ed, "places", gap=8, wrap=True, W="fill")
    for c_ in chips:
        if c_.startswith("+"):
            P.chip(cr, c_, "quiet")
        elif c_.startswith("thread:"):
            P.chip(cr, c_[7:], "outline", dot_color="threadA")
        else:
            P.chip(cr, c_, "place", icon_name="place")
    spacer(cr)
    if sub:
        text(cr, sub, "caption", "muted")
    format_bar(ed)
    body = col(ed, "body", gap=12, W="fill")
    for kind, s in blocks:
        if kind == "h":
            text(body, s, "title")
        elif kind == "li":
            r = row(body, "list item", gap=10, W="fill", align="min")
            text(r, "•", "body", "muted")
            link_text(r, s)
        else:
            link_text(body, s)
    if linked:
        lk = col(ed, "linked from", gap=6, pad=12, fill="sunken", radius=10, W="fill")
        text(lk, f"Linked from · {len(linked)}", "smallStrong", "muted")
        for t, where in linked:
            lr = row(lk, f"link/{t}", gap=8, W="fill")
            icon(lr, "notebook", 16, "accent")
            text(lr, t, "body", "accent")
            spacer(lr)
            text(lr, where, "caption", "muted")
    if files:
        files_note(ed, files)
    return ed


LINK = re.compile(r"\[\[[^\]]+\]\]")


def link_text(parent, s):
    """Text with verse references as links (parts.rich) and [[note links]] in the accent color, as Obsidian draws them."""
    t = P.rich(parent, s)
    for m in LINK.finditer(s):
        S.do("text.style", {"id": t, "start": m.start(), "end": m.end(), "textFills": [{"type": "solid", "color": F.COLORS["accent"][0]}], "fontStyle": "Semi Bold"},
             ref=False)
    return t


def notebook2(board):
    pg = "Notebook, second pass"
    cv = section(board, pg, 0)
    sheet_title(cv, "The Notebook: B, with days and chapters", "The person's choice: B (the list and the editor) is "
                "the Notebook. From A, a page for each day (today's dump); from C, notes on chapters and books; and "
                "notes that link to other notes, as Obsidian does. Each is a way to sort the one list, or a feature "
                "that can be turned off in Settings.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "N1 · A note with places and links", "A note can sit on a verse, a chapter or a whole book "
            "(chips under its title). [[Links]] to other notes are typed as in Obsidian; a link can point at a "
            "heading in a note ([[Word study: H7065#Renderings]]). Linked from lists the notes that point here.")
    toolbar(f, active="Notebook", view="Writing")
    reader(f, 0, 500, first=6, last=10)
    note_list(f, 500, 300, "None", [
        ("item", "Numbers 25, read again", "Read the chapter through twice…", "Numbers 25", True),
        ("item", "Word study: H7065", "List the renderings first, then…", "H7065 everywhere", False),
        ("item", "24,000 or 23,000?", "24,000 died here; 1 Cor 10:8 says…", "No place yet", False),
        ("item", "Numbers: an outline", "Questions for the whole book", "Numbers", False)])
    editor(f, 800, "Numbers 25, read again", ["Numbers 25", "Numbers", "thread:Phinehas", "+ Place", "+ Thread"], [
        ("p", "Read the chapter through twice, once in the KJV and once in the YLT."),
        ("li", "The renderings of H7065: see [[Word study: H7065#Renderings]]."),
        ("li", "Numbers 25:9 and 1 Cor 10:8: see [[24,000 or 23,000?]]."),
        ("p", "For the book as a whole: [[Numbers: an outline]].")],
        linked=[("Wednesday 4 November", "today's page"), ("Numbers: an outline", "on Numbers")],
        files="Files: still one note per Markdown file. A place can be a chapter or a book; a link is plain text, "
              "[[title]] or [[title#heading]], so Obsidian reads it too.")

    f = win(r, pg, "N2 · Grouped by day: today's page (A)", "Group: Day puts today's page first: one note per day, "
            "made the first time something is written in it, for the day's dump. The day's other notes follow, "
            "then earlier days. Anything in the page can be given a place or pulled out into its own note.")
    toolbar(f, active="Notebook", view="Writing")
    reader(f, 0, 500, first=6, last=10)
    note_list(f, 500, 300, "Day", [
        ("head", "Today · Wed 4 Nov", "3"),
        ("item", "Wednesday 4 November", "Read Numbers 25 twice; then…", "Today's page", True),
        ("item", "Numbers 25, read again", "Read the chapter through twice…", "Numbers 25", False),
        ("item", "24,000 or 23,000?", "24,000 died here…", "No place yet", False),
        ("head", "Tuesday 3 Nov", "1"),
        ("item", "Tuesday 3 November", "Phinehas thread: added Psalm 106:30", "Today's page", False)])
    editor(f, 800, "Wednesday 4 November", ["+ Place", "+ Thread"], [
        ("p", "Read Numbers 25 twice, then the YLT. Wrote up [[Numbers 25, read again]]."),
        ("li", "Look up H6898 and H6897 with every use."),
        ("li", "Compare Numbers 25:9 with 1 Cor 10:8, see [[24,000 or 23,000?]]."),
        ("p", "Tomorrow: Psalm 106:28–31 beside Numbers 25:11.")],
        files="Files: today's page is a note too, notes/_days/2026-11-04.md, with no place (the Python app passes "
              "over it). Turn it off in Settings → Notebook.", sub="today's page")

    r = row(cv, "row 2", gap=64, align="min")
    f = win(r, pg, "N3 · Grouped by chapter: following the reader (C)", "Group: Chapter, with Follow the reader on: "
            "the list shows the chapter being read, its notes in verse order, with notes on the chapter and on the "
            "book at the top. Turn the chapter and the list turns with it; the editor stays on the note.")
    toolbar(f, active="Notebook", view="Writing")
    reader(f, 0, 500, first=6, last=10)
    note_list(f, 500, 300, "Chapter", [
        ("head", "Numbers 25 · following the reader"),
        ("item", "Numbers: an outline", "Questions for the whole book", "Numbers", False),
        ("item", "Numbers 25, read again", "Read the chapter through twice…", "Numbers 25", True),
        ("item", "'tent' and 'belly'", "Look up H6898 and H6897…", "Numbers 25:8", False),
        ("item", "24,000 or 23,000?", "How do the two numbers relate?", "Numbers 25:9", False),
        ("item", "Word study: H7065", "List the renderings first…", "Numbers 25:11", False)])
    editor(f, 800, "Numbers 25, read again", ["Numbers 25", "+ Place", "+ Thread"], [
        ("p", "Read the chapter through twice, once in the KJV and once in the YLT."),
        ("li", "The renderings of H7065: see [[Word study: H7065#Renderings]]."),
        ("li", "Numbers 25:9 and 1 Cor 10:8: see [[24,000 or 23,000?]].")],
        linked=[("Wednesday 4 November", "today's page")])

    f = win(r, pg, "N4 · Settings → Notebook", "What the Notebook does is the person's to set: today's page, how "
            "the list is grouped when it opens, following the reader, links, and the quick-capture key.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 860, h=620, title="Settings")
    two = row(m, "two", gap=20, W="fill", H="fill", align="min")
    settings_nav(two, "Notebook")
    body = col(two, "notebook", gap=10, W="fill")
    for t, s_, on in (("Today's page", "A note for each day, made when you first write in it", True),
                      ("Follow the reader", "Grouped by chapter, the list shows the chapter you are reading", True),
                      ("Links between notes", "[[title]] and [[title#heading]], as in Obsidian", True),
                      ("Notes on chapters and books", "+ Place offers the chapter and the book, not only verses", True),
                      ("Show the Inbox as its own group", "Notes with no place yet, apart from the rest", False)):
        it = row(body, f"setting/{t}", gap=10, pad=[10, 12, 10, 12], radius=8, stroke="line", sw=1, W="fill")
        tc = col(it, "text", gap=2, W="fill")
        text(tc, t, "body")
        para(tc, s_, "caption", "muted")
        toggle(it, on)
    gr = row(body, "group", gap=10, pad=[10, 12, 10, 12], radius=8, stroke="line", sw=1, W="fill")
    text(gr, "Group when it opens", "body", W="fill")
    P.segmented(gr, ["Day", "Chapter", "Thread", "None"], "Day", W="hug")
    kr = row(body, "key", gap=10, pad=[10, 12, 10, 12], radius=8, stroke="line", sw=1, W="fill")
    text(kr, "Quick capture", "body", W="fill")
    P.kbd(kr, "Ctrl+J")


def settings_nav(parent, active):
    nav = col(parent, "sections", gap=2, W="fixed")
    put(nav, 0, 0, 180)
    for t in ("Customize", "Views", "Reading", "Notebook", "Hover and cards", "Theme", "Keys"):
        on = t == active
        it = row(nav, f"section/{t}", pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None, W="fill")
        text(it, t, "smallStrong" if on else "body", "accent" if on else "fg")
    return nav


def plans2(board):
    pg = "Reading plans, second pass"
    cv = section(board, pg, 0)
    sheet_title(cv, "Reading plans: the form, presets in it, the builder behind it", "The person's choice: A (one "
                "form) is how a plan is made. B's presets become a row at its top that fills the boxes, all "
                "changeable after. C (by days) is the deeper builder, opened from the form for a custom plan. P "
                "stays as drawn.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "R1 · The form, with presets", "Start from fills the form: New Testament in 90 days ticked the "
            "New Testament, Bible order and a pace that ends in 90 days. Anything can be changed; the summary "
            "follows. Arrange the days myself… opens the builder with what is in the form.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 760, title="New reading plan", sub="Only a name and what to read are needed.", y=56)
    pr = row(m, "presets", gap=6, wrap=True, W="fill")
    text(pr, "Start from", "smallStrong", "muted")
    for t, on in (("Blank", False), ("Bible in a year", False), ("Old and New together", False),
                  ("New Testament in 90 days", True), ("Psalms and Proverbs", False), ("A published plan…", False)):
        P.chip(pr, t, "selected" if on else "outline")
    form_field(m, "Name", "New Testament in 90 days", required=True)
    wt = col(m, "what", gap=8, W="fill")
    lr = row(wt, "label", gap=6)
    text(lr, "What to read", "smallStrong")
    text(lr, "required", "caption", "accent")
    picked = row(wt, "picked", gap=6, wrap=True, pad=10, fill="sunken", radius=10, W="fill")
    ch = row(picked, "book/New Testament", gap=6, pad=[5, 8, 5, 12], fill="surface", radius=999, stroke="line", sw=1)
    text(ch, "New Testament · 27 books", "smallStrong")
    icon(ch, "close", 14, "muted")
    P.chip(picked, "+ Books…", "quiet")
    P.chip(picked, "+ A passage…", "quiet")
    two = row(m, "order and pace", gap=10, W="fill", align="min")
    form_field(two, "Order", "Bible order", W="fill")
    form_field(two, "Pace", "Finish in 90 days", W="fill")
    form_field(two, "Start", "Today", W="fill")
    sm = col(m, "summary", gap=4, pad=12, fill="accentSoft", radius=10, W="fill")
    text(sm, "27 books · 260 chapters · 90 days", "bodyStrong")
    text(sm, "About 3 chapters a day, Wed 4 Nov to Mon 1 Feb", "small", "muted")
    br = row(m, "buttons", gap=8, W="fill")
    P.button(br, "Arrange the days myself…", "ghost", "list")
    spacer(br)
    P.button(br, "Cancel", "secondary")
    P.button(br, "Start the plan", "primary")

    f = win(r, pg, "R2 · The builder, from the form", "The builder opens with the form's books and pace laid out "
            "as days. Chapters drag between days (one is being dragged here); a day drags up or down; days moved "
            "by hand are kept when the pace changes. Back to the form keeps everything.")
    toolbar(f)
    bk = frame(f, "books", x=0, y=TB, w=300, h=H - TB, fill="sunken", layout="vertical", gap=8, pad=16, W="fixed",
               H="fixed", clip=True, stroke="line", strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    P.button(bk, "Back to the form", "secondary", "back", size="sm")
    P.field(bk, "Find a book or chapter", icon_name="search", height=36)
    P.label(bk, "In this plan")
    for name, n in (("Matthew", 28), ("Mark", 16), ("Luke", 24), ("John", 21), ("Acts", 28), ("Romans", 16)):
        brr = row(bk, f"book/{name}", gap=8, pad=[8, 10, 8, 8], radius=8, fill="surface", stroke="line", sw=1, W="fill")
        icon(brr, "drag", 18, "muted", weight=2.4)
        text(brr, name, "body")
        spacer(brr)
        text(brr, f"{n} ch", "caption", "muted")
    main = frame(f, "days", x=300, y=TB, w=W - 300, h=H - TB, fill="bg", layout="vertical", gap=10, pad=[20, 28, 20, 28],
                 W="fixed", H="fixed", clip=True)
    hr = row(main, "head", gap=12, W="fill")
    text(hr, "New Testament in 90 days", "title")
    spacer(hr)
    text(hr, "90 days · ends Mon 1 Feb", "small", "muted")
    for d, chs, moved in ((1, ["Matthew 1", "Matthew 2", "Matthew 3"], False), (2, ["Matthew 4", "Matthew 5"], True),
                          (3, ["Matthew 6", "Matthew 7", "Matthew 8"], False), (4, ["Matthew 9", "Matthew 10", "Matthew 11"], False)):
        dr = row(main, f"day {d}", gap=10, pad=[10, 12, 10, 8], radius=10, fill="surface", stroke="line", sw=1, W="fill")
        icon(dr, "drag", 18, "muted", weight=2.4)
        text(dr, f"Day {d}", "smallStrong", "muted")
        for c_ in chs:
            P.chip(dr, c_, "outline")
        spacer(dr)
        if moved:
            text(dr, "kept as you set it", "caption", "accent")
    ghost = row(f, "dragged chapter", gap=6, pad=[6, 12, 6, 12], fill="accentSoft", radius=999, stroke="accent", sw=1.5,
                x=820, y=232)
    shadow(ghost, 8, 20, "#00000033")
    text(ghost, "Matthew 6", "smallStrong")


def views2(board):
    pg = "Views, second pass"
    cv = section(board, pg, 0)
    sheet_title(cv, "Views you design, floating panes on their own", "The person's notes: views as customizable as "
                "the toolbar and the plans, perhaps in Settings; and each floating pane on its own, not lumped "
                "together.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "V1 · Settings → Views", "Each view is a small map of the window: drag pane chips into a column, "
            "the top or bottom band, or Float. Each has its name, its key, whether it shows in the View menu, and "
            "which toolbar it uses. Save this view… in the menu makes one from the window as it is.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 1000, h=680, title="Settings", y=60)
    two = row(m, "two", gap=20, W="fill", H="fill", align="min")
    settings_nav(two, "Views")
    mid = col(two, "views", gap=6, W="fixed")
    put(mid, 0, 0, 200)
    for t, on in (("Reading", False), ("Word study", True), ("Writing", False), ("Thread building", False)):
        it = row(mid, f"view/{t}", gap=8, pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None, W="fill")
        icon(it, "drag", 16, "muted", weight=2.4)
        text(it, t, "smallStrong" if on else "body", "accent" if on else "fg")
    P.chip(mid, "+ New view", "quiet")
    ed = col(two, "edit view", gap=10, W="fill")
    hr = row(ed, "head", gap=10, W="fill")
    P.field(hr, "Name", "Word study", icon_name=None, height=36)
    P.kbd(hr, "Ctrl+2")
    mp = frame(ed, "map", w=100, h=300, radius=10, stroke="line", sw=1, fill="bg", W="fill", H="fixed",
               layout="horizontal", gap=6, pad=6)
    for name, panes, w_ in (("Left", ["H7065", "BDB"], 120), ("Reader", [], None), ("Right", ["Every use"], 120)):
        z = col(mp, f"zone/{name}", gap=6, pad=8, radius=8, fill="sunken" if panes else None, stroke="line", sw=1,
                W="fixed" if w_ else "fill", H="fill")
        if w_:
            put(z, 0, 0, w_)
        text(z, name, "caption", "muted")
        if name == "Reader":
            text(z, "the reader, at its verse", "small", "muted")
            spacer(z)
            band = col(z, "bottom band", gap=6, pad=8, radius=8, fill="sunken", stroke="line", sw=1, W="fill")
            text(band, "Bottom band", "caption", "muted")
            P.chip(band, "Interlinear", "outline")
        for p_ in panes:
            P.chip(z, p_, "outline")
    fl = row(ed, "float", gap=8, pad=[8, 10, 8, 10], radius=8, stroke="line", sw=1, W="fill")
    text(fl, "Float", "caption", "muted")
    P.chip(fl, "drop a pane here to float it", "quiet")
    for t, v in (("Show in the View menu", True), ("Use the toolbar of this view", False), ("Keep the reader's place", True)):
        it = row(ed, f"opt/{t}", gap=10, pad=[8, 10, 8, 10], radius=8, stroke="line", sw=1, W="fill")
        text(it, t, "body", W="fill")
        toggle(it, v)

    f = win(r, pg, "V2 · Floating panes, each on its own", "Each floating pane is its own small window with its "
            "own tab strip: moved, sized and minimized on its own. Two join only when one's tab is dropped on the "
            "other's tab strip. A minimized float waits as a chip at the bottom.")
    toolbar(f)
    reader(f, 0, W)
    for name, x, y, w_, h_, body_fn in (
            ("H7065", 120, 120, 380, 330, lambda b: P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])),
            ("Interlinear · Numbers 25:11", 900, 160, 470, 300, None),
            ("Every use · zealous", 860, 520, 420, 300, None)):
        fw = frame(f, f"float/{name}", x=x, y=y, w=w_, h=h_, fill="surface", radius=12, stroke="line", sw=1,
                   layout="vertical", W="fixed", H="fixed", clip=True)
        shadow(fw, 12, 32, "#00000033")
        P.pane_header(fw, [name], name)
        b = col(fw, "body", gap=8, pad=12, W="fill", H="fill", clip=True)
        if body_fn:
            body_fn(b)
        elif name.startswith("Interlinear"):
            cells = row(b, "words", gap=8, W="fill", align="min")
            for w2 in C["interlinear"][:3]:
                cell = P.interlinear_cell(cells, w2)
                put(cell, 0, 0, 130)
        else:
            for key, v in (("num25", 11), ("num25", 13)):
                vv = next(x_ for x_ in C[key]["verses"] if x_["v"] == v)
                P.verse_line(b, f"Numbers 25:{v}", vv["text"], max_lines=2)
    chip_ = row(f, "minimized", gap=8, pad=[8, 12, 8, 12], fill="surface", radius=999, stroke="line", sw=1, x=560, y=H - 60)
    shadow(chip_, 4, 12, "#00000022")
    icon(chip_, "float", 16, "muted")
    text(chip_, "BDB · minimized", "smallStrong")


def shelf2(board):
    pg = "Shelf and toolbar, second pass"
    cv = section(board, pg, 0)
    sheet_title(cv, "The Shelf, and a toolbar that holds anything", "The person's notes: close a tab or a whole set, "
                "and add tabs, documents and notes from the Shelf; and let any pane, any command that opens one, a "
                "sheet of most used commands, or commands the person sets, be a toolbar button.")
    r = row(cv, "row 1", gap=64, align="min")
    f = win(r, pg, "SH1 · A set: close, add, open", "A set's items each have × (take it out of the set) and a dot "
            "when open. Close all closes the set's open tabs together. + Add offers the tab in front, all open "
            "tabs, a new note written into the set, or a note, place, thread, lesson or document found by name.")
    toolbar(f, active="Shelf")
    b = column(f, 0, 420, ["Shelf"], "Shelf", side="left")
    P.field(b, "Find in the Shelf", icon_name="search", height=36)
    it = row(b, "folder", gap=8, pad=[6, 10, 6, 10], W="fill")
    icon(it, "down", 16, "muted")
    text(it, "Phinehas study", "bodyStrong")
    st = col(b, "set", gap=8, pad=12, fill="surface", radius=12, stroke="accent", sw=1, W="fill")
    hr = row(st, "head", gap=8, W="fill")
    icon(hr, "shelf", 18, "accent")
    text(hr, "Word study: zeal", "heading")
    spacer(hr)
    P.icon_button(hr, "more", "muted", size=28, icon_size=16)
    for t, open_ in (("H7065 · Strong's", True), ("Every use · zealous", True), ("Interlinear · Numbers 25:11", False),
                     ("Phinehas · thread", False), ("Word study: H7065 · note", True)):
        rr = row(st, f"item/{t}", gap=8, pad=[4, 4, 4, 4], W="fill")
        F.dot(rr, "accent" if open_ else "line", 8)
        text(rr, t, "small", W="fill")
        icon(rr, "close", 14, "muted")
    ar = row(st, "actions", gap=8, W="fill")
    P.button(ar, "Open all", "primary", "dock", size="sm")
    P.button(ar, "Close all", "secondary", "close", size="sm")
    P.button(ar, "Add", "soft", "plus", size="sm")
    reader(f, 420, W - 420)
    m = popover(f, 440, 230, 340, "add menu")
    for t, s_ in (("This tab", "Every use · zealous"), ("All open tabs", "5 tabs"), ("A new note in this set", "written here"),
                  ("A note…", "by its title"), ("A place…", "a verse, chapter or book"), ("A thread…", None),
                  ("A lesson or document…", None)):
        menu_item(m, t, s_, icon_name="plus")

    f = win(r, pg, "SH2 · A set's tabs, kept together", "Opened from the Shelf, a set's tabs carry its mark, so "
            "they can be seen together wherever they were put; the mark's menu closes them all, or saves where "
            "they are now back into the set.")
    toolbar(f)
    b = column(f, 0, 400, ["H7065", "Every use", "Help"], "H7065", side="left")
    P.lexicon_block(b, C["lexicon"]["H7065"], C["count"]["H7065"])
    reader(f, 400, W - 820)
    b = column(f, W - 420, 420, ["Word study: H7065", "Notebook"], "Word study: H7065")
    text(b, "Word study: H7065", "title")
    link_text(b, "List the renderings first, then read each verse before writing anything about it.")
    for x, w_ in ((0, 228), (W - 420, 180)):
        frame(f, "set mark", x=x, y=TB, w=w_, h=3, fill="threadB", W="fixed", H="fixed")
    m = popover(f, 40, TB + 46, 300, "set menu")
    text(m, "Word study: zeal · 3 tabs open", "smallStrong", "muted")
    menu_item(m, "Close the set's tabs", icon_name="close")
    menu_item(m, "Save where they are now", icon_name="check")
    menu_item(m, "Show it in the Shelf", icon_name="shelf")

    r = row(cv, "row 2", gap=64, align="min")
    f = win(r, pg, "TB1 · Settings → Customize: add anything", "+ Add a button lists every pane (Help, the Guide, "
            "Keys, Today's log, Reading plans, search, the interlinear…), your views, My commands, and any command "
            "line, which becomes a button that runs it. {word} and {place} take what is selected in the reader.")
    toolbar(f)
    reader(f, 0, W)
    m = modal(f, 1000, h=680, title="Settings", y=60)
    two = row(m, "two", gap=20, W="fill", H="fill", align="min")
    settings_nav(two, "Customize")
    body = col(two, "customize", gap=10, W="fill")
    P.label(body, "The toolbar")
    prev = row(body, "preview", gap=4, pad=8, fill="sunken", radius=10, W="fill")
    for t, ic in (("View: Reading", "dock"), ("KJV", "book"), ("Notebook", "notebook"), ("Guide", "question"),
                  ("My commands", "list"), ("uses {word}", "search")):
        P.tool(prev, t, ic)
    pk = col(body, "add a button", gap=8, pad=12, fill="surface", radius=12, stroke="accent", sw=1, W="fill")
    text(pk, "Add a button", "heading")
    P.field(pk, "Find a pane, a view or a command", "gu", icon_name="search", height=36)
    for group, items in (("Panes", (("Guide", "Help's guide to the window"), ("Help", "the whole manual"))),
                         ("Views", (("Word study", "Strong's left, every use right"),)),
                         ("Commands", (("A command of your own…", "any line, like uses {word} or compare {place} ylt"),
                                       ("My commands", "the sheet of the commands you keep")))):
        text(pk, group, "label", "muted")
        for t, s_ in items:
            menu_item(pk, t, s_, icon_name="plus")

    f = win(r, pg, "TB2 · My commands", "A sheet of the commands you keep, each runnable with a click or its own "
            "key, and the ones you use most, counted from your log (sessions/). It can be a toolbar button, a pane "
            "or a popover. + Remember a command adds one by hand or from the log.")
    toolbar(f)
    reader(f, 0, W - 440)
    b = column(f, W - 440, 440, ["My commands"], "My commands")
    hr = row(b, "head", gap=8, W="fill")
    text(hr, "My commands", "title")
    spacer(hr)
    P.button(hr, "Remember a command", "soft", "plus", size="sm")
    P.label(b, "Kept")
    for cmd_, what, k in (("uses {word}", "every use of the selected word", "Ctrl+U"),
                          ("compare {place} ylt", "the place with the YLT under it", None),
                          ("interlinear {place}", "word by word", "Ctrl+I"),
                          ("view word study", "the Word study view", "Ctrl+2")):
        rr = row(b, f"cmd/{cmd_}", gap=10, pad=[8, 10, 8, 10], radius=8, fill="surface", stroke="line", sw=1, W="fill")
        icon(rr, "capture", 16, "accent")
        tc = col(rr, "text", gap=0, W="fill")
        text(tc, cmd_, "bodyStrong")
        text(tc, what, "caption", "muted")
        if k:
            P.kbd(rr, k)
    P.label(b, "Used most (from your log)")
    for cmd_, n in (("open Num 25", 14), ("def H7065", 9), ("thread Phinehas", 6)):
        rr = row(b, f"most/{cmd_}", gap=10, pad=[6, 10, 6, 10], W="fill")
        text(rr, cmd_, "body", W="fill")
        text(rr, f"{n} times", "caption", "muted")
        icon(rr, "plus", 16, "muted")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    head = col(board, "board title", gap=8, W="fixed")
    put(head, 0, 0, 3000)
    text(head, "Phase 2b design round: every design on one board", "display", fontSize=56, lineHeight="64px")
    para(head, "The second pass first: the Notebook (B, with days and chapters), reading plans (the form with presets, "
         "the builder behind it), views and floating panes, the Shelf and the toolbar, drawn from the person's choices "
         "of 4 November. The first pass below it, as it was reviewed. docs/phase2b-design.md has the choices.",
         "body", "muted", fontSize=20, lineHeight="30px")
    for label, about in (("Second pass", "drawn from the person's choices"),):
        lb = row(board, label, gap=16)
        text(lb, label, "display", fontSize=44, lineHeight="52px")
        text(lb, about, "title", "muted")
    a2, b2 = row(board, "second pass top", gap=96, align="min"), row(board, "second pass bottom", gap=96, align="min")
    notebook2(a2)
    plans2(a2)
    views2(b2)
    shelf2(b2)
    lb = row(board, "First pass", gap=16)
    text(lb, "First pass", "display", fontSize=44, lineHeight="52px")
    text(lb, "as reviewed on 4 November", "title", "muted")
    top, bottom = row(board, "top", gap=96, align="min"), row(board, "bottom", gap=96, align="min")
    notebook_page(top)
    plans_page(top)
    for fn in (dock_page, study_page, shelf_page):
        fn(bottom)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "phase2b.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "phase2b.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    OUT.mkdir(parents=True, exist_ok=True)
    # the whole board (at half size: it is about 10,000 px wide), each section, and each window
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.5", "--out",
                    str(OUT / "all-designs.png")], check=True, capture_output=True)
    for name, titles in TITLES.items():
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name, "--scale", "0.5",
                        "--out", str(OUT / f"{slug}.png")], check=True, capture_output=True)
        for title in titles:
            file = OUT / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
            subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node",
                            "Window · " + title, "--scale", "1", "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
