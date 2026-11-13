"""Trash, round 1. Today a deleted page waits in .trash for 7 days (the person's decision, 2026-11-03), Erase now asks
first (2026-11-04), and pages also have a timed Undo (wb page undo). Finding cf09 (2026-11-08) asks that deletes just
be destroyed, and 0ade for a delete-all for pages. This round lays the choices side by side so the person can settle
them; it does not reopen the decisions unless the person picks a direction that does. Names are a drawn sample.

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


def toast(f, x, y, s, btn):
    t = row(f, "toast", gap=12, pad=[10, 14, 10, 14], radius=10, fill="fg", W="hug")
    Q.put(t, x, y)
    text(t, s, "small", "bg")
    P.button(t, btn, "secondary", size="sm")
    return t


def notebook(f, w):
    p = K.panel(f, w, TB, 380, H - TB, "Notebook", None, fill="sunken")
    for n in ("Phinehas", "Zeal", "Tuesday study", "Reading notes"):
        K.line(p, n, None, "page")
    return p


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


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "T2 · A: Undo is the only way back",
              "cf09 taken at its word: Delete erases, after a 10-second Undo. No Trash list. A slip is caught by "
              "Undo, and a hashed backup (scripts/backup-study.ps1) is the safety net. This reverses the 7-day "
              "decision, so it needs the person's own yes.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    toast(f, w + 420, H - 90, "Deleted Covenant of peace · erased in 10 s", "Undo")

    f = Q.win(r, PG, "T3 · A: delete several pages at once",
              "0ade: select pages in the Notebook (Shift or Ctrl click, or Select all), then Delete. The question "
              "names how many and that they can be put back for 10 seconds only. Pinned pages, templates and days "
              "are left out unless chosen (wb page rm --all).")
    w = K.app(f, on="Notebook")
    p = notebook(f, w)
    m = Q.modal(f, 440, title="Delete 4 pages?", sub="They can be brought back with Undo for 10 seconds. Pinned "
                "pages, templates and days are not included.")
    Q.buttons(m, ("Cancel", "secondary"), ("Delete 4 pages", "primary"))


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "T4 · B: keep the 7 days, out of the way",
              "The decisions stand; the Trash is just quieter. It leaves the Notebook's list and lives in Settings › "
              "Study folder, with Empty now. Deleting still shows Undo first.")
    w = K.app(f, on="Settings")
    p = K.panel(f, w, TB, W - w, H - TB, "Settings · Study folder", "Where your study is, its backups, its Trash")
    text(p, "TRASH", "label", "muted")
    for n, when, left in ITEMS:
        K.line(p, n, when, "trash", right=left)
    b = row(p, "buttons", gap=8)
    P.button(b, "Empty now", "secondary", size="sm")
    text(b, "Asks first; cannot be undone", "caption", "muted")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Trash, round 1",
                  "Today (T1); A, Undo only, and deleting several pages (T2, T3); B, the 7 days kept, the Trash moved "
                  "to Settings (T4). T3 goes with either.")
    today(cv)
    direction_a(cv)
    direction_b(cv)


# ---- round 2 (2026-11-13): T1 kept; Empty trash; the way to the Trash; deleting a block (9ed7) ----------------------

def empty_trash(cv):
    r = row(cv, "empty", gap=64, align="min")
    f = Q.win(r, PG, "T5 · Empty trash",
              "The Trash as today (T1), with Empty trash at its head. It erases everything listed at once, after a "
              "question that names how many and says it cannot be undone. A wb command does the same.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    p = K.panel(f, w + 380, TB, W - w - 380, H - TB, "Trash", "Erased after 7 days · 3 waiting")
    b = row(p, "head buttons", gap=8, W="fill")
    spacer(b)
    P.button(b, "Empty trash", "ghost", size="sm")
    for i, (n, when, left) in enumerate(ITEMS):
        it = K.line(p, n, when, "trash", right=left)
        P.button(it, "Put back", "secondary", size="sm")
        # each page's own erase: a trash button, red on hover (drawn hovered on the first row)
        x = row(it, "erase", pad=[6, 6, 6, 6], radius=6, W="hug", fill="#FDE8E8" if i == 0 else None)
        icon(x, "trash", 18, "#C62828" if i == 0 else "muted")
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
    p = notebook(f, w)
    spacer(p)
    K.rule(p)
    K.line(p, "Trash", None, "trash", right="3", muted=True)

    f = Q.win(r, PG, "T7 · The Trash in the Notebook menu and the command field",
              "Nothing in the list: Trash sits in the Notebook's … menu, and typing trash in the command field "
              "opens it. The cleanest list; one more step to find it.")
    w = K.app(f, on="Notebook")
    notebook(f, w)
    m = K.floating(f, "menu", w + 200, TB + 50, 220, gap=2, pad=(6, 6, 6, 6))
    for n, ic in (("New page", "plus"), ("Templates", "docs"), ("Trash · 3", "trash")):
        K.line(m, n, None, ic)

    f = Q.win(r, PG, "T8 · The toast points to the Trash",
              "The Undo toast says where the page went: Undo for 10 seconds, and Trash opens it there. A missed "
              "toast is not the end: the page waits 7 days. Goes with T6 or T7.")
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
    for n, ic in (("Move up", "back"), ("Move down", "down"), ("Delete", "trash")):
        K.line(m, n, None, ic)
    toast(f, w + 420, H - 90, "Block deleted", "Undo")


def sheets2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Trash, round 2",
                  "T1 kept (2026-11-13). Empty trash (T5); the way to the Trash: the foot of the list (T6), the menu "
                  "and command field (T7), the toast (T8); deleting a block (T9).")
    empty_trash(cv)
    way_in(cv)
    delete_block(cv)


def both(board):
    sheets2(board)
    sheets(board)


if __name__ == "__main__":
    K.run_board(HERE, "Trash", both)
