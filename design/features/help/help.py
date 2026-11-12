"""Help, the Guide and the manual, round 1. Today Help is a pane with Guide (wb guide), Commands (wb manual) and Keys,
as plain text (0050: should look nicer and be friendlier). This round draws the Guide as illustrated cards, Commands
as examples you can run, and help that opens beside the part it explains. The Guide's topics and the manual's
examples are fetched with wb.

    python design/features/help/help.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Help"
GUIDE = K.fetch(HERE, "guide", ["guide"], as_json=False)
TOPICS = [ln.split(None, 1) for ln in GUIDE.splitlines()[1:] if ln.strip()]
MANUAL = K.fetch(HERE, "manual-uses", ["manual", "uses"], as_json=False)
EXAMPLES = [ln.strip().split("    ") for ln in MANUAL.splitlines() if ln.startswith("  uses ")]
ICON = {"templates": "page", "shelf": "shelf", "views": "list", "threads": "threads", "questions": "question",
        "words": "word"}


def shell(f, tab):
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Help", "How the parts work, everything the command field understands, keys")
    P.segmented(p, ["Guide", "Commands", "Keys"], tab, W="hug")
    return w, p


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "H1 · Today: plain text",
              "As built (panes.ts openHelp): three tabs; the Guide is each topic's text in turn, Commands the manual "
              "as written for a terminal. 0050: just plain text.")
    w, p = shell(f, "Guide")
    for key, name in TOPICS:
        text(p, name, "heading")
        para(p, f"wb guide {key}: the topic's paragraphs, as text", "small", "muted")


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "H2 · A: the Guide as cards",
              "Each topic a card with its icon, one sentence, and a small picture of the part (the sheets' own "
              "windows, reused); a click opens the topic with its steps numbered and its pictures between them.")
    w, p = shell(f, "Guide")
    g = row(p, "cards", gap=16, wrap=True, W="fill")
    for key, name in TOPICS:
        c = col(g, key, gap=8, pad=[14, 14, 14, 14], radius=12, stroke="line", sw=1, fill="surface", W="fixed")
        Q.put(c, 0, 0, 340)
        hd = row(c, "head", gap=8)
        icon(hd, ICON.get(key, "book"), 20, "accent")
        text(hd, name, "heading")
        frame(c, "picture", w=10, h=120, radius=8, fill="sunken", W="fill", H="fixed")
        text(c, f"wb guide {key}", "caption", "muted")

    f = Q.win(r, PG, "H3 · A: Commands as examples you can run",
              "Commands lists what the field understands in plain words; each example is a line with Try, which "
              "puts it in the command field (it runs only on Enter). Examples are wb manual's own.")
    w, p = shell(f, "Commands")
    P.field(p, "What do you want to do? (every use, search, a plan…)")
    text(p, "EVERY USE OF A WORD", "label", "muted")
    for ex in EXAMPLES:
        cmd, about = (ex + [""])[:2]
        it = row(p, cmd, gap=12, pad=[8, 10, 8, 10], radius=8, stroke="line", sw=1, W="fill")
        text(it, cmd, "smallStrong")
        text(it, about.strip(), "small", "muted", W="fill")
        P.button(it, "Try", "secondary", size="sm")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "H4 · B: help beside the part",
              "A small ? in each pane's head opens that part's Guide topic in a card beside it, not a pane of its "
              "own; More in Help opens the whole Guide. Help never covers the reader.")
    w = K.app(f, on="Notebook")
    p = K.M.pane(f, w, TB, 520, H - TB, ["Notebook"], "Notebook", side="left")
    for n in ("Phinehas", "Zeal", "Tuesday study"):
        K.line(p, n, None, "page")
    c = K.floating(f, "guide card", w + 540, TB + 20, 380)
    hd = row(c, "head", gap=8, W="fill")
    icon(hd, "page", 18, "accent")
    text(hd, dict((k, n) for k, n in TOPICS).get("templates", "Templates"), "heading", W="fill")
    P.icon_button(hd, "close", "muted", size=26, icon_size=14)
    para(c, "The topic's first steps, from wb guide templates.", "small", "muted")
    P.button(c, "More in Help", "ghost", "right", size="sm")

    f = Q.win(r, PG, "H5 · Keys as a keyboard",
              "Keys drawn on a keyboard; a key with a meaning is colored by its part (reader, Notebook, window), and "
              "the list beside it can be searched.")
    w, p = shell(f, "Keys")
    kb = col(p, "keyboard", gap=6, pad=[14, 14, 14, 14], radius=10, fill="sunken", W="hug")
    for line_ in ("` 1 2 3 4 5 6 7 8 9 0 - =", "Q W E R T Y U I O P [ ]", "A S D F G H J K L ; '", "Z X C V B N M , . /"):
        rr = row(kb, line_, gap=6)
        for k in line_.split():
            on = k in ("I", "N", "K", "C", "`", "=", "-")
            b = row(rr, k, pad=[6, 0, 6, 0], radius=6, fill="accentSoft" if on else "surface", stroke="line", sw=1,
                    W="fixed", mainAlign="center")
            Q.put(b, 0, 0, 40)
            text(b, k, "smallStrong" if on else "small", "accent" if on else "fg")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Help, the Guide and the manual, round 1",
                  "Today (H1); A, the Guide as cards and commands you can try (H2, H3); B, help beside the part, and "
                  "keys on a keyboard (H4, H5).")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Help", sheets)
