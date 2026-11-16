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


# ---- round 2 (2026-11-13): one menu with Settings, Keys only in Help, the Guide as task cards -------------------

SET_SECTIONS = ["Reading", "Theme", "Notebook", "Layouts", "Commands", "Study folder", "Documents"]
HELP_SECTIONS = ["Guide", "Keys", "Manual"]

# One card per thing done. Steps describe the app's own controls (no scripture); keys are the app's (ui/src/panes.ts
# KEYS, with the findings key as decided 2026-11-13); commands are wb's.
GROUPS = [
    ("Reading", [
        ("Read a chapter", "book", ["Press ` and type a place, or use ← →", "The reader keeps your place"], "` · ← →", "wb chapter"),
        ("Copy verses", "copy", ["Select verses in the reader", "Right-click ▸ Copy"], "", "wb copy"),
        ("Find on the page", "search", ["Ctrl+F finds in the pane you last used", "Enter: next · Shift+Enter: before"], "Ctrl+F", ""),
        ("Text size and full screen", "eye", ["Ctrl+= and Ctrl+- for size", "F11 for the whole window"], "Ctrl+= · F11", ""),
    ]),
    ("Looking up", [
        ("Look up a word", "word", ["Click a word in the reader", "Its card shows the original and the sources"], "", "wb word"),
        ("The interlinear", "list", ["Alt+click a word", "The verse word by word"], "Alt+click", "wb interlinear"),
        ("Every use of a word", "search", ["Type uses and the word in the command field"], "`", "wb uses"),
    ]),
    ("Keeping", [
        ("Write on a verse", "pen", ["Ctrl+J at the verse you clicked", "Enter saves; Ctrl+Enter keeps writing"], "Ctrl+J", "wb page"),
        ("Ask a question", "question", ["In a page, start a line as a question callout"], "", "wb question"),
        ("Keep related places together", "threads", ["Start a thread", "Add places to it from the reader"], "", "wb thread"),
        ("The Shelf", "shelf", ["Keep anything on the Shelf", "Open it from the rail"], "", "wb shelf"),
        ("A live list of pages", "list", ["Put a view block in a page"], "", "wb view"),
    ]),
    ("Making", [
        ("Start a page from a template", "notebook", ["New page ▸ From a template", "It asks for a place, then fills its blanks"], "", "wb template"),
        ("Make a template", "notebook", ["+ beside Templates, or … ▸ Save as a template", "Type { to add a blank"], "", "wb template new"),
        ("Make a lesson or document", "docs", ["From a thread or a page", "Word, PDF slides, or Present"], "", "wb docs"),
    ]),
]


def gap(parent, h):
    frame(parent, "gap", w=10, h=h, W="fill", H="fixed")


def menu(f, active, title, sub, at=None, sections=HELP_SECTIONS, size=(1180, H - 120)):
    """The window behind, dimmed, and the one menu centred over it: Settings above, Help below."""
    K.app(f, on=at)
    frame(f, "scrim", x=0, y=0, w=W, h=H, fill="scrim", W="fixed", H="fixed")
    mw, mh = size
    d = frame(f, "settings and help", x=(W - mw) // 2, y=(H - mh) // 2, w=mw, h=mh, fill="bg", layout="horizontal",
              radius=14, stroke="line", sw=1, W="fixed", H="fixed", clip=True)
    K.shadow(d, 12, 40, "#00000040")
    nav = col(d, "sections", gap=2, pad=[16, 10, 16, 10], fill="sunken", W="fixed", H="fill")
    K.S.do("node.set", {"ids": [nav], "props": {"width": 210}}, ref=False)
    P.field(nav, "Find", height=32)
    gap(nav, 6)
    text(nav, "SETTINGS", "label", "muted")
    for x in SET_SECTIONS:
        K.line(nav, x, on=(x == active))
    gap(nav, 10)
    text(nav, "HELP", "label", "muted")
    for x in sections:
        K.line(nav, x, on=(x == active))
    content = col(d, "content", gap=12, pad=[20, 24, 20, 24], W="fill", H="fill", clip=True)
    hd = row(content, "head", gap=8, W="fill")
    tc = col(hd, "title", gap=2, W="fill")
    text(tc, title, "title")
    if sub:
        para(tc, sub, "small", "muted")
    P.icon_button(hd, "close", "muted", size=28, icon_size=14)
    return content


def card(parent, task, ic, steps, key, cmd, w=212, show_key=True, open_=False):
    c = col(parent, task, gap=6, pad=[10, 10, 10, 10], radius=12, stroke="accent" if open_ else "line",
            sw=2 if open_ else 1, fill="surface", W="fixed")
    Q.put(c, 0, 0, w)
    frame(c, "picture (from the feature's design sheet)", w=10, h=70, radius=8, fill="sunken", W="fill", H="fixed")
    hd = row(c, "head", gap=6, W="fill")
    icon(hd, ic, 16, "accent")
    text(hd, task, "smallStrong", W="fill")
    for i, st in enumerate(steps, 1):
        para(c, f"{i}. {st}", "caption")
    foot = row(c, "foot", gap=8, W="fill")
    if key and show_key:
        text(foot, f"Key {key}", "caption", "accent")
    spacer(foot)
    if cmd:
        text(foot, cmd, "caption", "muted")
    return c


def guide_cards(p, groups, show_key=True, mark=None):
    for name, cards in groups:
        text(p, name.upper(), "label", "muted")
        g = row(p, name, gap=12, wrap=True, W="fill", align="min")
        for t in cards:
            card(g, *t, show_key=show_key, open_=(t[0] == mark))


def round2_menu(cv):
    r = row(cv, "menu", gap=64, align="min")
    f = Q.win(r, PG, "H6 · The Guide in the one menu",
              "Settings and Help share the centred menu over the dimmed window: Settings above, Help below, one "
              "Find for both. Guide is cards in four groups, one card per thing done: a picture from the part's "
              "design sheet, two or three steps, its key in accent, its wb command in grey. No Try (postponed).")
    p = menu(f, "Guide", "Guide", "What you can do, one card each")
    guide_cards(p, GROUPS[:2])

    f = Q.win(r, PG, "H7 · The Guide, scrolled: Keeping and Making",
              "The templates card says what a template asks for (a place) and what it fills in (its blanks), "
              "answering 76bf; the next card says how to make one.")
    p = menu(f, "Guide", "Guide", "What you can do, one card each")
    guide_cards(p, GROUPS[2:], mark="Start a page from a template")


def round2_keys(cv):
    r = row(cv, "keys", gap=64, align="min")
    f = Q.win(r, PG, "H8 · Keys: the only keys section",
              "Help's keyboard above, the list below, one Find. A key with a meaning is lit; a click on a key or a "
              "row selects both. Change… sets a new key and says at once if it is taken. Settings has no Keys of "
              "its own.")
    p = menu(f, "Keys", "Keys", "Every key the window understands, and yours to change")
    P.field(p, "Find a key or what it does", height=32)
    kb = col(p, "keyboard", gap=5, pad=[10, 10, 10, 10], radius=10, fill="sunken", W="hug")
    lit = {"`", "F", "J", "=", "-", "←", "→", "F1", "F11", "Esc"}
    for line_ in ("Esc F1 F11", "` 1 2 3 4 5 6 7 8 9 0 - =", "Q W E R T Y U I O P [ ]", "A S D F G H J K L ; '",
                  "Z X C V B N M , . /", "Ctrl Alt ← →"):
        rr = row(kb, line_, gap=5)
        for k in line_.split():
            on = k in lit
            b = row(rr, k, pad=[4, 0, 4, 0], radius=6, fill="accentSoft" if on else "surface", stroke="line", sw=1,
                    W="fixed", mainAlign="center")
            Q.put(b, 0, 0, 34 if len(k) == 1 else 54)
            text(b, k, "smallStrong" if on else "small", "accent" if on else "fg")
    for k, what in (("`", "Open the command field"), ("← →", "The previous and next chapter"),
                    ("Ctrl+F", "Find in the pane you last used"), ("Ctrl+J", "Quick capture at the verse"),
                    ("Ctrl+Shift+F", "A finding about the app (findings, 2026-11-13)"),
                    ("F1", "This Guide"), ("F11", "Full screen")):
        it = row(p, k, gap=12, pad=[4, 8, 4, 8], radius=8, W="fill")
        text(it, k, "smallStrong")
        text(it, what, "small", "muted", W="fill")
        P.button(it, "Change…", "ghost", size="sm")

    f = Q.win(r, PG, "H9 · No keyboard: Keys is hidden",
              "On a phone or tablet with no keyboard Help is Guide and Manual only, and cards carry no keys. Any key "
              "pressed (a keyboard attached) brings Keys and the cards' keys back.")
    p = menu(f, "Guide", "Guide", "What you can do, one card each", sections=["Guide", "Manual"])
    guide_cards(p, GROUPS[:1] + GROUPS[2:3], show_key=False)


def round2_beside(cv):
    r = row(cv, "beside", gap=64, align="min")
    f = Q.win(r, PG, "H10 · ? in a pane's head",
              "The Notebook's ? opens the same menu at Keeping, its first card outlined. Closing it returns to the "
              "Notebook exactly as it was; the reader's place is never touched.")
    p = menu(f, "Guide", "Guide", "Keeping, from the Notebook's ?", at="Notebook")
    guide_cards(p, GROUPS[2:3], mark="Write on a verse")


def sheets2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Help, round 2",
                  "One menu with Settings (H6, H7); Keys as Help's only keys section, hidden with no keyboard (H8, "
                  "H9); the ? in a pane's head (H10). Try is postponed.")
    round2_menu(cv)
    round2_keys(cv)
    round2_beside(cv)


def soon_card(parent, task, ic, w=200, focus=False):
    c = col(parent, task, gap=6, pad=[12, 14, 12, 14], radius=12, stroke="accent" if focus else "line",
            sw=2 if focus else 1, fill="surface", W="fixed")
    Q.put(c, 0, 0, w)
    hd = row(c, "head", gap=8, W="fill")
    icon(hd, ic, 16, "accent")
    text(hd, task, "smallStrong", W="fill")
    text(c, "Coming soon", "caption", "muted")


def soon_cards(p, groups, focus=None):
    para(p, "Guides coming soon: each card will show its steps once the part it guides is finished.", "small", "muted")
    for name, cards in groups:
        text(p, name.upper(), "label", "muted")
        g = row(p, name, gap=12, wrap=True, W="fill", align="min")
        for t in cards:
            soon_card(g, t[0], t[1], focus=(name == focus))


SMALL = (1040, 760)


def sheets3(board):
    cv = Q.section(board, "Round 3", 3200)
    Q.sheet_title(cv, "Help, round 3",
                  "The menu smaller, in proportion over the window. Help comes last: the cards name what they will "
                  "guide and say Coming soon; no pictures, no wb commands (H11, H12). Keys in the smaller menu (H13).")
    r = row(cv, "round 3", gap=64, align="min")
    f = Q.win(r, PG, "H11 · The Guide, cards to come",
              "1040 × 760 at most, the window around it dimmed. Each card is an icon and the task; its steps are "
              "written last, once the part it guides is finished, so they describe the window as it then is.")
    soon_cards(menu(f, "Guide", "Guide", None, size=SMALL), GROUPS)
    f = Q.win(r, PG, "H12 · The ? from the Notebook",
              "The Notebook's ? opens the same menu with Keeping outlined.")
    soon_cards(menu(f, "Guide", "Guide", None, at="Notebook", size=SMALL), GROUPS, focus="Keeping")
    r = row(cv, "round 3 keys", gap=64, align="min")
    f = Q.win(r, PG, "H13 · Keys in the smaller menu",
              "As H8: the keyboard and the list; a row lights its keys (Ctrl+F here). Changing a key stays where "
              "it is set today (Notebook, Layouts, Commands) until keys can be changed here.")
    p = menu(f, "Keys", "Keys", "Every key the window understands", size=SMALL)
    kb = col(p, "keyboard", gap=5, pad=[10, 10, 10, 10], radius=10, fill="sunken", W="hug")
    for line_ in ("Esc F1 F11", "` 1 2 3 4 5 6 7 8 9 0 - =", "Q W E R T Y U I O P [ ]", "A S D F G H J K L ; '",
                  "Z X C V B N M , . /", "Ctrl Shift Alt ← →"):
        rr = row(kb, line_, gap=5)
        for k in line_.split():
            on = k in ("F", "Ctrl")
            b = row(rr, k, pad=[4, 0, 4, 0], radius=6, fill="accent" if on else "surface", stroke="line", sw=1,
                    W="fixed", mainAlign="center")
            Q.put(b, 0, 0, 32 if len(k) == 1 else 52)
            text(b, k, "caption", "bg" if on else "fg")
    for k, what in (("`", "Open the command field"), ("Ctrl+F", "Find in the pane you last used"),
                    ("F1", "Help: the Guide")):
        it = row(p, k, gap=12, pad=[4, 8, 4, 8], radius=8, W="fill", fill="accentSoft" if k == "Ctrl+F" else None)
        text(it, k, "smallStrong")
        text(it, what, "small", "muted", W="fill")


def both(board):
    sheets3(board)
    sheets2(board)
    sheets(board)


if __name__ == "__main__":
    K.run_board(HERE, "Help", both)
