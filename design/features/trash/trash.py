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


if __name__ == "__main__":
    K.run_board(HERE, "Trash", sheets)
