"""Findings, round 1: the person's notes about the app (findings/, apart from the study). Today a box opens over the
window and the Findings pane lists them. Finding 707d asks that the box be movable so it does not block what is behind
it. This round draws a box that docks to a corner, the pane with filters and attachments, and writing one from the
command field. The findings drawn are a sample, not the person's.

    python design/features/findings/findings.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Findings"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
SAMPLE = [("The card covers the verse I am reading", "today · Numbers 25 · 1 picture", True),
          ("Scroll bars could be thinner", "yesterday · Settings", True),
          ("Search should remember its last scope", "2 days ago · Search", False)]


def base(f):
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    return w


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "F1 · Today: the box over the window",
              "As built (findings.ts): the box opens in the middle with what was on screen recorded, a text area, "
              "drop files to attach, Save. It covers the very thing being described (707d).")
    w = base(f)
    m = Q.modal(f, 520, title="A finding about the app", sub="Kept apart from your study, with what is on screen")
    P.field(m, "What did you notice?", icon_name="pen", height=120)
    text(m, "Drop pictures or files here", "caption", "muted")
    Q.buttons(m, ("Cancel", "secondary"), ("Save", "primary"))


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "F2 · A: a small box in a corner",
              "The box opens small in the lower right, over nothing that matters, and can be dragged anywhere (707d); "
              "it remembers where. Ctrl+Shift+F opens it; Enter saves, Shift+Enter a new line. What is on screen is "
              "recorded when it opens, as now.")
    w = base(f)
    b = K.floating(f, "finding box", W - 400, H - 250, 370)
    hd = row(b, "head", gap=6, W="fill")
    icon(hd, "drag", 16, "muted")
    text(hd, "Finding", "smallStrong", W="fill")
    P.icon_button(hd, "close", "muted", size=26, icon_size=14)
    P.field(b, "What did you notice?", icon_name="pen", height=70)
    ft = row(b, "foot", gap=8, W="fill")
    text(ft, "Numbers 25 · 1440×900", "caption", "muted", W="fill")
    P.button(ft, "Attach", "ghost", size="sm")
    P.button(ft, "Save", "primary", size="sm")

    f = Q.win(r, PG, "F3 · A: the Findings pane",
              "Open and Handled, newest first, each with where it was written and its files; a click shows it whole "
              "with its pictures. Handled is a tick. wb findings, finding handled, finding attach do the same.")
    w = base(f)
    p = K.M.pane(f, W - 460, TB, 460, H - TB, ["Findings"], "Findings")
    P.segmented(p, ["Open", "Handled"], "Open")
    for s, sub, open_ in SAMPLE[:2]:
        it = K.line(p, s, sub, "capture")
        P.icon_button(it, "check", "muted", size=28, icon_size=14)


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "F4 · B: write one in the command field",
              "Typing ! and the words in the command field keeps a finding without any box (as wb finding add); the "
              "suggestion line says so before Enter. Pictures are added later in the pane.")
    w = base(f)
    cmd = row(f, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="accent", sw=1,
              W="fixed", H="fixed")
    Q.put(cmd, w + (W - w - 520) // 2 + 43, (TB - 34) // 2, 522, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "! the card covers the verse I am reading", "small", W="fill")
    p = K.floating(f, "suggestion", w + (W - w - 520) // 2 + 43, TB - 6, 522, gap=2)
    K.line(p, "Keep as a finding about the app", "finding add", "capture", on=True, right="Enter")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Findings, round 1",
                  "Today (F1); A, a small movable box and the pane (F2, F3); B, a finding typed in the command field "
                  "(F4). B goes with A.")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Findings", sheets)
