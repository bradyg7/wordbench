"""Trash. A deleted page waits in the Trash for 7 days (the person's decisions, 2026-11-03 and 04), after a timed Undo.
Accepted 2026-11-13: T1 kept, Empty trash and a trash button on each row (T5), the quiet Trash line at the foot of the
Notebook list (T6), the toast that points to the Trash (T8), deleting a block (T9). The person declined direction A
(Undo only, T2 and T3), direction B (the Trash in Settings, T4) and T7 (the Trash in a menu); those windows are cut.
Overseer, 2026-11-16: choosing several pages is drawn by the library folder (its S32); T3 is superseded by it. T10 draws
what happens next. T11 to T14 are the real conditions: among other tabs, floating, narrow, and years of study.
Names are a drawn sample; the only scripture is the reader's Numbers 25, fetched from the database.

    python design/features/trash/trash.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Trash"
ITEMS = [("A page: Covenant of peace", "deleted today", "7 days left"), ("A question at Numbers 25:9",
         "deleted 3 days ago", "4 days left"), ("A page: Tuesday notes", "deleted 6 days ago", "1 day left")]
LONG = ("A page: Reading notes for the Tuesday study group, week 3", "deleted today", "7 days left")
LONG2 = ("A question at Numbers 25:9, written beside the reading for Tuesday", "deleted 3 days ago", "4 days left")
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
K.F.ICONS.setdefault("arrow-up", "M12 19V5M6 11l6-6 6 6")
K.F.ICONS.setdefault("arrow-down", "M12 5v14M6 13l6 6 6-6")
NAMES = ["Phinehas", "Zeal", "Tuesday study", "Reading notes"]


# ---- shared drawing: the toast, the Notebook list, the Trash list and its rows -------------------------------------

def toast(f, x, y, s, btn):
    t = row(f, "toast", gap=12, pad=[10, 14, 10, 14], radius=10, fill="fg", W="hug")
    Q.put(t, x, y)
    text(t, s, "small", "bg")
    P.button(t, btn, "secondary", size="sm")
    return t


def notebook(f, w, foot=None, x=None, width=380):
    """The Notebook list; foot is the count on the quiet Trash line at its foot (T6), None when nothing waits."""
    p = K.panel(f, w if x is None else x, TB, width, H - TB, "Notebook", None, fill="sunken")
    for n in NAMES:
        K.line(p, n, None, "page")
    if foot:
        spacer(p)
        K.rule(p)
        K.line(p, "Trash", None, "trash", right=str(foot), muted=True)
    return p


def erase_button(parent, hover=False, touch=False):
    """A row's own erase: a trash button, red on hover or focus (drawn hovered where hover is True)."""
    pad = 13 if touch else 6
    x = row(parent, "erase", pad=[pad, pad, pad, pad], radius=6, W="hug", fill="#FDE8E8" if hover else None)
    icon(x, "trash", 18, "#C62828" if hover else "muted")
    return x


def trash_row(parent, name, when, left, hover=False, compact=False, touch=False, one_line=False, show_when=True):
    """One row of the Trash. Wide: icon, name, when, days left at the right. Compact (a small pane, a phone): the name
    wraps (or ends with an ellipsis) over a line holding the days left, which never breaks; the buttons stay whole."""
    it = row(parent, f"row/{name}", gap=10, pad=[8, 10, 8, 10], radius=8, W="fill")
    if not compact:
        icon(it, "trash", 18, "muted")
    tc = col(it, "text", gap=1, W="fill")
    if one_line:
        text(tc, name, "body", W="fill", maxLines=1)
    else:
        para(tc, name, "body")
    if compact:
        sub = row(tc, "when", gap=6, W="hug")
        if when and show_when:
            text(sub, when + " ·", "caption", "muted")
        text(sub, left, "caption", "muted")
    else:
        if when:
            para(tc, when, "caption", "muted")
        text(it, left, "caption", "muted")
    P.button(it, "Put back", "secondary", size="lg" if touch else "sm")
    erase_button(it, hover, touch)
    return it


def trash_list(parent, items, compact=False, sub=None, hover_first=True, touch=False, one_line=False, show_when=True):
    """The head (Empty trash) and the rows. sub is the count line, drawn beside Empty trash when the pane is narrow."""
    b = row(parent, "head buttons", gap=8, W="fill")
    if compact and sub:
        para(b, sub, "caption", "muted")
    else:
        spacer(b)
    P.button(b, "Empty trash", "ghost", size="sm")
    for i, (n, when, left) in enumerate(items):
        trash_row(parent, n, when, left, hover=hover_first and i == 0, compact=compact, touch=touch,
                  one_line=(i in one_line) if isinstance(one_line, (set, tuple)) else one_line,
                  show_when=show_when)


def trash_panel(f, x, y, w, h, items, count=3):
    p = K.panel(f, x, y, w, h, "Trash", f"Erased after 7 days · {count} waiting")
    trash_list(p, items)
    return p


def erase_question(m, n):
    para(m, "They are removed from the disk and cannot be put back.", "small", "muted")
    Q.buttons(m, ("Cancel", "secondary"), (f"Erase {n}", "primary"))


# ---- today, Empty trash, the way to the Trash, deleting a block ----------------------------------------------------

def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "T1 · Today: Undo, then the Trash for 7 days",
              "As built: deleting a page shows a timed Undo; the page then waits in .trash, listed in the Notebook's "
              "Trash with days left, Put back and Erase now (asks first). The window empties what is older than 7 "
              "days when it opens. Finding cf09: deletes should just be destroyed.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    p = K.panel(f, w + 380, TB, W - w - 380, H - TB, "Trash", "Erased after 7 days · wb trash")
    for n, when, left in ITEMS:
        it = K.line(p, n, when, "trash", right=left)
        P.button(it, "Put back", "secondary", size="sm")
        P.button(it, "Erase now", "ghost", size="sm")


def empty_trash(cv):
    r = row(cv, "empty", gap=64, align="min")
    f = Q.win(r, PG, "T5 · Empty trash",
              "The Trash as today (T1), with Empty trash at its head. It erases everything listed at once, after a "
              "question that names how many and says it cannot be undone. A wb command does the same.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    trash_panel(f, w + 380, TB, W - w - 380, H - TB, ITEMS)
    K.note(f, "Each row's trash button erases that one page (asks first). It is a real button: the pointer, and red "
           "on hover or focus. Empty trash erases them all.", w + 420, H - 150)

    f = Q.win(r, PG, "T5 · Empty trash, asked first",
              "Empty trash and a row's trash button both ask first; the question names how many.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    m = Q.modal(f, 440, title="Erase 3 items now?", sub="They are removed from the disk and cannot be put back.")
    Q.buttons(m, ("Cancel", "secondary"), ("Erase 3", "primary"))


def way_in(cv):
    r = row(cv, "way in", gap=64, align="min")
    f = Q.win(r, PG, "T6 · The Trash at the foot of the Notebook list",
              "A quiet line under the Notebook groups: Trash and a count, muted, shown only when something is "
              "waiting. Easy to find, never above the person's own pages.")
    w = K.app(f, on="Notebook")
    notebook(f, w, foot=3)

    f = Q.win(r, PG, "T8 · The toast points to the Trash",
              "The Undo toast says where the page went: Undo for 10 seconds, and Trash opens it there. A missed "
              "toast is not the end: the page waits 7 days. Goes with T6.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    t = toast(f, w + 400, H - 90, "Covenant of peace moved to the Trash", "Undo")
    P.button(t, "Trash", "ghost", size="sm")


def delete_block(cv):
    r = row(cv, "block", gap=64, align="min")
    f = Q.win(r, PG, "T9 · Deleting a block",
              "9ed7: the block's grab handle (shown on hover) opens a small menu with Delete; Backspace in an empty "
              "block removes it too. The same Undo toast as a page. A block is part of its page, so it does not go "
              "to the Trash: Undo brings it back.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    p = K.panel(f, w + 380, TB, W - w - 380, H - TB, "Covenant of peace", None)
    para(p, "A paragraph block of the page.", "body")
    K.line(p, "A scripture block · Numbers 25:12", None, "drag", on=True)
    para(p, "Another paragraph block.", "body")
    m = K.floating(f, "block menu", w + 420, TB + 170, 200, gap=2, pad=(6, 6, 6, 6))
    for n, ic in (("Move up", "arrow-up"), ("Move down", "arrow-down"), ("Delete", "trash")):
        K.line(m, n, None, ic)
    toast(f, w + 420, H - 90, "Block deleted", "Undo")

    f = Q.win(r, PG, "T10 · Several pages deleted at once",
              "After 12 pages were chosen and deleted together (the choosing is the library folder's S32): one toast "
              "for all of them, one Undo that puts them all back, and 30 seconds to use it (10 for a single page). "
              "Each page then waits its 7 days in the Trash, and the quiet Trash line at the list's foot counts them: "
              "12 and the 3 already waiting. The choosing is the library's S32; its toast uses these same words.")
    w = K.app(f, on="Notebook")
    notebook(f, w, foot=15)
    K.reader(f, w + 380, W - w - 380, NUM25, "Numbers 25")
    t = toast(f, w + 400, H - 90, "12 pages moved to the Trash", "Undo")
    P.button(t, "Trash", "ghost", size="sm")


# ---- the real conditions: among other tabs, floating, narrow, years of study ---------------------------------------

def among_tabs(r):
    f = Q.win(r, PG, "T11 · Among other tabs",
              "The Trash is one of four tabs in a side pane (Trash, Phinehas, Concordance, Tuesday study) with the "
              "reader open on Numbers 25 beside it. The list, Empty trash and each row's buttons are the ones in T5. "
              "The reader keeps its place; closing the tab returns to it.")
    w = K.app(f)
    half = (W - w) // 2
    rdp = K.M.pane(f, w, TB, half, H - TB, ["Numbers 25"], "Numbers 25", side="left",
                   actions=("minimize", "expand", "close"))
    text(rdp, "Numbers 25", "chapter", fontSize=26, lineHeight="34px")
    K.F.verses(rdp, NUM25, "readSmall")
    p = K.M.pane(f, w + half, TB, W - w - half, H - TB, ["Trash", "Phinehas", "Concordance", "Tuesday study"], "Trash")
    para(p, "Erased after 7 days · 3 waiting", "small", "muted")
    trash_list(p, ITEMS)


def floating_pane(r):
    f = Q.win(r, PG, "T12 · Floating",
              "The Trash as a small floating pane (320 wide) over the reader. A long name ends with an ellipsis (the "
              "first row) or wraps (the second); \"7 days left\", Put back and the trash button stay whole, and "
              "Empty trash stays at the head. The pane can be dragged and sized from its corner.")
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    c = K.floating(f, "float", W - 350, TB + 50, 320, pad=(12, 12, 14, 12), gap=8)
    bar = row(c, "handle", gap=6, W="fill")
    icon(bar, "drag", 16, "muted")
    text(bar, "Trash", "smallStrong", W="fill")
    P.icon_button(bar, "close", "muted", size=26, icon_size=14)
    trash_list(c, [LONG, LONG2, ITEMS[2]], compact=True, sub="3 waiting · erased after 7 days", one_line={0}, show_when=False)


def narrow(r):
    pw, ph = 390, 800
    f = Q.win(r, PG, "T13 · Narrow: a phone",
              "At 390 px the Trash is one column: names wrap, the days left stay whole, and Put back and the trash "
              "button are touch-sized. Erase 3 items now? is a sheet over the bottom that reaches the bottom edge, "
              "with Cancel and Erase 3.", w=pw, h=ph)
    top = row(f, "top", gap=8, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(top, 0, 0, pw, 56)
    P.icon_button(top, "left", "fg", size=40, icon_size=20)
    text(top, "Trash", "title")
    p = col(f, "list", gap=10, pad=[16, 14, 16, 14], W="fixed", H="fixed", clip=True)
    Q.put(p, 0, 56, pw, ph - 56)
    trash_list(p, ITEMS, compact=True, sub="Erased after 7 days · 3 waiting", hover_first=False, touch=True)
    frame(f, "scrim", x=0, y=0, w=pw, h=ph, fill="scrim", opacity=0.55, W="fixed", H="fixed")
    sh = col(f, "erase sheet", gap=12, pad=[14, 20, 28, 20], fill="surface", radius=14, stroke="line", sw=1,
             W="fixed", H="fixed")
    Q.put(sh, 0, ph - 250, pw, 266)
    K.shadow(sh, 8, 28, "#00000033")
    bar = row(sh, "grab", W="fill", mainAlign="center")
    frame(bar, "grip", w=40, h=4, radius=2, fill="line", W="fixed", H="fixed")
    text(sh, "Erase 3 items now?", "title")
    para(sh, "They are removed from the disk and cannot be put back.", "small", "muted")
    b = row(sh, "buttons", gap=8, W="fill")
    P.button(b, "Cancel", "secondary", size="lg", W="fill")
    P.button(b, "Erase 3", "primary", size="lg", W="fill")


WW = 960


def years(r):
    f = Q.win(r, PG, "T14 · Years of study: 214 items waiting",
              "A Trash after a clean-out: 214 waiting, grouped by the day they were deleted with a count for each; "
              "each group is folded to its first rows with Show all, a plain search field sits over the list, and "
              "Empty trash stays at the head. The question beside it names the number. Page names are a drawn "
              "sample.", w=WW)
    w = K.M.rail5(f, on="Notebook")
    K.M.slim_bar(f, x=w, w=WW - w)
    pw = 600
    p = K.panel(f, w, TB, pw, H - TB, "Trash", "Erased after 7 days · 214 waiting")
    b = row(p, "head buttons", gap=8, W="fill")
    P.field(b, "Search the Trash", None, icon_name="search", height=34)
    P.button(b, "Empty trash", "ghost", size="sm")
    groups = [("Deleted today", 180, "7 days left", 3, ["A page: Covenant of peace", "A page: Reading notes",
                                                        "A question at Numbers 25:9"]),
              ("3 days ago", 22, "4 days left", 2, ["A page: Tuesday notes", "A page: Zeal"]),
              ("6 days ago", 12, "1 day left", 2, ["A page: Phinehas", "A question at Numbers 25:11"])]
    for label, n, left, shown, names in groups:
        gh = row(p, f"group/{label}", gap=8, pad=[12, 10, 2, 10], W="fill")
        extra = " · erased tomorrow" if left == "1 day left" else ""
        text(gh, f"{label} · {n}{extra}", "smallStrong", "muted", W="fill")
        for nm in names[:shown]:
            trash_row(p, nm, None, left, compact=True, one_line=True)
        sa = row(p, f"show all/{label}", gap=0, pad=[0, 6, 0, 6], W="fill")
        P.button(sa, f"Show all {n}", "ghost", size="sm")
    m = K.floating(f, "erase question", w + pw + 30, TB + 120, WW - w - pw - 60, gap=14, pad=(20, 24, 20, 24))
    text(m, "Erase 214 items now?", "title")
    erase_question(m, 214)


def sheets(board):
    cv = Q.section(board, "Trash", 3200)
    Q.sheet_title(cv, "Trash",
                  "Deleting a page: a timed Undo, then 7 days in the Trash with Put back, a trash button on each row, "
                  "and Empty trash at the head (both ask first). Today (T1); Empty trash (T5); the way to the Trash "
                  "(T6, T8); deleting a block (T9); several pages at once (T10); the real conditions: among other "
                  "tabs, floating, narrow and years of study (T11 to T14).")
    today(cv)
    empty_trash(cv)
    way_in(cv)
    delete_block(cv)
    r = row(cv, "real a", gap=64, align="min")
    among_tabs(r)
    floating_pane(r)
    r = row(cv, "real b", gap=64, align="min")
    narrow(r)
    years(r)


if __name__ == "__main__":
    K.run_board(HERE, "Trash", sheets)
