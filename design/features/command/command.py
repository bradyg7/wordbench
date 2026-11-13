"""The top bar and the command box, round 1. With the tools on the rail (minimize round 5) the top bar holds the place
and the command field. This round asks what the command field shows while you type (so a person never has to know the
command language, 8353), where kept commands go when the bar is full (36d7, bc42), and where full screen for the whole
app lives (0e94). Examples in the field are wb manual's own; scripture is fetched with wb text.

    python design/features/command/command.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Command"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
MANUAL = K.fetch(HERE, "manual-uses", ["manual", "uses"], as_json=False)


def field(f, x, w, value, open_=False):
    cmd = row(f, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="accent" if open_ else
              "line", sw=1, W="fixed", H="fixed")
    Q.put(cmd, x, (TB - 34) // 2, w, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, value, "small", "fg", W="fill", maxLines=1)
    P.kbd(cmd, "Esc")
    return cmd


def base(f, value=None, open_=False):
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    if value is not None:
        field(f, FX(w), 522, value, open_)
    return w


def FX(w):
    return w + (W - w - 520) // 2 + 43  # over the slim bar's own field


def group(p, title):
    text(p, title.upper(), "label", "muted")


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "C1 · Today: the toolbar and kept commands",
              "As built: the toolbar holds Notebook, Threads, Shelf, Plans, Help, the place, the command field and the "
              "kept commands as buttons. With a few kept commands the bar overflows and shortcuts go off screen "
              "(36d7); the More button and the bar's settings want a design (bc42). Typing in the field needs the "
              "command language (8353).")
    Q.toolbar(f)
    Q.reader(f, 0, W)


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "C2 · A: the field suggests as you type",
              "Typing “zeal” offers what it could mean, in plain words, each with the line it stands for in small type: "
              "go to a place, every use of a word, search the text, your pages. ↑ ↓ and Enter, or a click. The "
              "command language still works, but nobody has to learn it.")
    w = base(f, "zeal", True)
    p = K.floating(f, "suggestions", FX(w), TB - 6, 520, gap=2)
    group(p, "Look up")
    K.line(p, "Every use of “zeal”", "uses zeal", "list", on=True)
    K.line(p, "Search the text for zeal, zealous, zealously", "search zeal*", "search")
    K.line(p, "“zeal” in the Concordance", "define zeal", "word")
    K.line(p, "Webster's 1913: zeal", "word-define zeal", "dictionary")
    K.rule(p)
    group(p, "Your study")
    K.line(p, "Pages with “zeal”", "find zeal", "page")
    K.line(p, "A thread named Zeal", None, "threads")

    f = Q.win(r, PG, "C3 · A: narrowing without typing",
              "Once a suggestion is chosen, its choices are chips under the field (8353): where to look, which word "
              "form. Each chip changes the line in small type, so the command is learned by looking, not required.")
    w = base(f, "Every use of “zeal”", True)
    p = K.floating(f, "choices", FX(w), TB - 6, 520, gap=10)
    group(p, "Where")
    ch = row(p, "scope", gap=6, wrap=True, W="fill")
    for c, on in (("Whole Bible", False), ("Old Testament", False), ("New Testament", False), ("Gospels", True),
                  ("Choose books…", False)):
        P.chip(ch, c, "selected" if on else "outline")
    group(p, "Forms")
    ch = row(p, "forms", gap=6, wrap=True, W="fill")
    for c, on in (("zeal", True), ("zealous", False), ("zealously", False)):
        P.chip(ch, c, "selected" if on else "outline")
    K.rule(p)
    rr = row(p, "line", gap=8, W="fill")
    text(rr, "uses zeal gospels", "caption", "muted", W="fill")
    P.button(rr, "Open", "primary", size="sm")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "C4 · B: kept commands on the rail, not the bar",
              "Kept commands leave the top bar, so it never overflows (36d7): they sit at the rail's foot as icons, "
              "with their names when Show names is on, and the field lists them first when it is empty.")
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    p = K.floating(f, "kept commands", 6, H - 300, 260, gap=2)
    group(p, "Your commands")
    for name, line, key in (("Uses of a word", "uses {word}", "Ctrl+U"), ("Interlinear here", "interlinear {place}",
                            "Ctrl+I"), ("Today's reading", "plan today", None)):
        it = K.line(p, name, line, "type", right=key)
    P.button(p, "Keep a command", "ghost", "plus", size="sm")

    f = Q.win(r, PG, "C5 · B: the ⋯ menu, with the app's own full screen",
              "One ⋯ at the end of the top bar holds what is about the window, not the study: full screen for the "
              "whole app (0e94, beside each pane's own), the layout, the theme, and Settings. Hiding the top bar "
              "after that gives the reader the whole screen.")
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    mb = P.icon_button(f, "more", "accent", size=32, icon_size=18, fill="accentSoft")
    Q.put(mb, W - 48, (TB - 32) // 2)
    p = K.floating(f, "window menu", W - 300, TB - 6, 280, gap=2)
    K.line(p, "Full screen", None, "expand", right="F11", on=True)
    K.line(p, "Hide the top bar", None, "minimize", right="Ctrl+\\")
    K.rule(p)
    K.line(p, "Layout", "Reading", "panel")
    K.line(p, "Theme", "Light", "sun")
    K.rule(p)
    K.line(p, "Settings", None, "gear", right="Ctrl+,")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Top bar and the command box, round 1",
                  "Today (C1); A, the field suggests in plain words and narrows with chips (C2, C3); B, kept commands "
                  "move to the rail and one ⋯ holds the app's full screen (C4, C5). A and B can go together.")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Command", sheets)
