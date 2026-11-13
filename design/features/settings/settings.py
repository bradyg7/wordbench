"""Settings, layouts and views, round 1. Settings today has eight sections (Reading, Notebook, Hover and cards, Theme,
Layouts, Commands, Keys, Advanced). Findings: italic words grey in dark mode and a choice of how italics are drawn
(6bb0, e31a), the Notebook's ⋯ settings re-examined (e09e), thin scroll bars that hide (cd59), and "what does view
mean" (25c6). Scripture is fetched with wb text (Gen 1:2 has italic words in the KJV).

    python design/features/settings/settings.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Settings"
GEN1 = K.verses_of(K.fetch(HERE, "gen1-1-3", ["text", "Gen 1:1-3"], as_json=False))
SECTIONS = ["Reading", "Notebook", "Hover and cards", "Theme", "Layouts", "Commands", "Keys", "Advanced"]


def shell(f, active, title, sub):
    w = K.app(f, on="Settings")
    nav = col(f, "sections", gap=2, pad=[16, 10, 16, 10], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(nav, w, TB, 220, H - TB)
    P.field(nav, "Find a setting", height=34)
    for s in SECTIONS:
        K.line(nav, s, on=(s == active))
    return K.panel(f, w + 220, TB, W - w - 220, H - TB, title, sub, fill="bg")


def setting(p, name, about, ctl):
    it = row(p, name, gap=16, pad=[10, 0, 10, 0], W="fill")
    tc = col(it, "text", gap=2, W="fill")
    text(tc, name, "bodyStrong")
    para(tc, about, "caption", "muted")
    ctl(it)
    return it


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "S1 · Today: eight sections",
              "As built (settings.ts): a pane with eight sections, saved as each changes. Theme picks colors but not "
              "how italic words look (e31a); Layouts and Views are words the person did not recognise (25c6).")
    p = shell(f, "Theme", "Theme", "Saved as you make each change")
    setting(p, "Base", "System, Light, Dark or E-ink", lambda it: P.segmented(it, ["System", "Light", "Dark", "E-ink"],
                                                                                "Light", W="hug"))
    setting(p, "Colors", "Text, accent, surfaces, the five marks", lambda it: P.button(it, "Edit", "secondary",
                                                                                         size="sm"))


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "S2 · A: how italic words are drawn",
              "Theme gains Italic words (e31a): italic, grey, grey italic, underlined, or plain; dark mode defaults to "
              "grey (6bb0). The preview is Genesis 1 from the database, so the change is seen on real italics.")
    p = shell(f, "Theme", "Theme", "Saved as you make each change")
    setting(p, "Italic words", "The words the translators added (italic in the KJV)",
            lambda it: P.segmented(it, ["Italic", "Grey", "Grey italic", "Underlined", "Plain"], "Grey italic", W="hug"))
    pv = col(p, "preview", gap=6, pad=[16, 18, 16, 18], radius=10, stroke="line", sw=1, fill="surface", W="fill")
    text(pv, "PREVIEW · GENESIS 1", "label", "muted")
    K.F.verses(pv, GEN1, "readSmall")
    K.note(f, "The preview draws the italics from the database's markup when built; the sheet shows the verses "
              "plain.", W - 470, H - 90, 420)

    f = Q.win(r, PG, "S3 · A: scroll bars and the window",
              "Reading gains Scroll bars: thin and shown only while scrolling, no arrows (cd59); and the app's own Full "
              "screen (0e94, also in the top bar's ⋯).")
    p = shell(f, "Reading", "Reading", "How the text and the window look")
    setting(p, "Scroll bars", "Thin, and hidden until you scroll", lambda it: Q.toggle(it, True))
    setting(p, "Full screen", "The whole app; F11", lambda it: Q.toggle(it, False))
    setting(p, "Text size", "How large scripture is drawn; Ctrl+= and Ctrl+-",
            lambda it: P.segmented(it, ["S", "M", "L", "XL"], "M", W="hug"))


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "S4 · B: Layouts as pictures",
              "A saved layout is shown as a small picture of its panes, with its name; a click arranges the window. "
              "Save this layout names the window as it is now (wb layout save).")
    p = shell(f, "Layouts", "Layouts", "Arrangements of panes you can return to")
    g = row(p, "layouts", gap=16, wrap=True, W="fill")
    for name, panes in (("Reading", 1), ("Study", 2), ("Lesson prep", 3)):
        it = col(g, name, gap=6)
        pic = row(it, "picture", gap=3, pad=[4, 4, 4, 4], radius=6, stroke="line", sw=1, fill="sunken", W="fixed",
                  H="fixed")
        Q.put(pic, 0, 0, 200, 120)
        for i in range(panes):
            frame(pic, "pane", w=10, h=10, radius=3, fill="surface" if i else "accentSoft", W="fill", H="fill")
        text(it, name, "small")
    P.button(p, "Save this layout", "secondary", "plus", size="sm")

    f = Q.win(r, PG, "S5 · B: a view is a saved list",
              "25c6: “view” becomes “a saved list”: a line such as notebook @Num 25 questions, kept in a page as a "
              "block, that lists what it finds. In settings it is explained once, with its examples; the word view "
              "stays in wb for now.")
    p = shell(f, "Notebook", "Notebook", "What the Notebook lists and how (e09e: each kept only if it earns its place)")
    setting(p, "Saved lists in pages", "A line in a page that lists what it finds, e.g. the questions at Numbers 25",
            lambda it: P.button(it, "Show an example", "ghost", size="sm"))
    setting(p, "Group pages by", "Day, chapter, thread or none", lambda it: P.segmented(it, ["Day", "Chapter", "None"],
                                                                                          "Chapter", W="hug"))


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Settings, layouts and views, round 1",
                  "Today (S1); A, italic words and the window's scroll bars and full screen (S2, S3); B, layouts as "
                  "pictures and a view renamed a saved list (S4, S5). A and B can go together.")
    today(cv)
    direction_a(cv)
    direction_b(cv)


# ---- round 2 (2026-11-13) ------------------------------------------------------------------------------------------
# The person: a design choice is not a setting (scroll bars are decided for the whole app); layouts are a real setting,
# and the pictures direction is right. Draw every tab as it is today and as remodelled, and Settings in the real
# conditions: among other tabs, floating, narrow, with years of study.

TODAY = ["Reading", "Notebook", "Hover and cards", "Theme", "Layouts", "Commands", "Keys", "Advanced"]
PLANNED = ["Reading", "Theme", "Notebook", "Layouts", "Commands", "Keys", "Study folder"]


def view(f, x, y, w, h, sections, active, title, sub, tabs=None, nav_w=200, float_=False, narrow=False):
    """Settings drawn in a region: optional folder tabs, the section list, the content column. Returns the content."""
    d = frame(f, "settings view", x=x, y=y, w=w, h=h, fill="bg", layout="vertical", W="fixed", H="fixed", clip=True,
              radius=12 if float_ else 0, stroke="line", sw=1)
    if float_:
        K.shadow(d, 10, 32, "#00000040")
    if tabs:
        K.M.folder_strip(d, tabs, "Settings", actions=("minimize", "float", "close"))
    if narrow:
        top = row(d, "sections", gap=6, pad=[10, 12, 10, 12], fill="sunken", W="fill")
        P.button(top, f"{active}  ▾", "secondary", size="sm")
        spacer(top)
        icon(top, "search", 18, "muted")
        content = col(d, "content", gap=10, pad=[14, 14, 14, 14], W="fill", H="fill")
    else:
        body = row(d, "body", gap=0, align="min", W="fill", H="fill")
        nav = col(body, "sections", gap=2, pad=[14, 8, 14, 8], fill="sunken", W="fixed", H="fill")
        K.S.do("node.set", {"ids": [nav], "props": {"width": nav_w}}, ref=False)
        P.field(nav, "Find a setting", height=32)
        for s in sections:
            K.line(nav, s, on=(s == active))
        content = col(body, "content", gap=10, pad=[18, 22, 18, 22], W="fill", H="fill", clip=True)
    text(content, title, "title")
    if sub:
        para(content, sub, "small", "muted")
    return content


def full(f, sections, active, title, sub):
    w = K.app(f, on="Settings")
    return view(f, w, TB, W - w, H - TB, sections, active, title, sub)


def seg(opts, on):
    return lambda it: P.segmented(it, opts, on, W="hug")


def btn(label, kind="secondary"):
    return lambda it: P.button(it, label, kind, size="sm")


def tog(on):
    return lambda it: Q.toggle(it, on)


def tab_pair(cv, key, today_fn, planned_fn, t_about, p_about):
    r = row(cv, key, gap=64, align="min")
    f = Q.win(r, PG, f"{key} · today", t_about)
    today_fn(f)
    f = Q.win(r, PG, f"{key} · planned", p_about)
    planned_fn(f)


def reading_today(f):
    p = full(f, TODAY, "Reading", "Reading", None)
    setting(p, "Text size", "How large scripture is drawn; Ctrl+= and Ctrl+- do the same", btn("−  100%  +"))
    setting(p, "Version", "The reader's version", seg(["KJV", "YLT"], "KJV"))


def reading_planned(f):
    p = full(f, PLANNED, "Reading", "Reading", "How scripture reads")
    setting(p, "Text size", "How large scripture is drawn; Ctrl+= and Ctrl+-", btn("−  100%  +"))
    setting(p, "Version", "The reader's version", seg(["KJV", "YLT"], "KJV"))
    setting(p, "Cards on hover", "Off: a click opens a card. References only, or every word and reference",
            seg(["Off", "References", "Everything"], "References"))
    K.note(f, "Hover and cards was a tab with one setting: it joins Reading. Scroll bars and full screen are not "
              "settings: thin hidden scroll bars are the app's design; Full screen is in the ⋯ menu and F11.",
           W - 470, H - 120, 420)


def theme_today(f):
    p = full(f, TODAY, "Theme", "Theme", "Saved as you make each change")
    setting(p, "Theme", "System, Light, Dark, E-ink, or one of yours", seg(["Light", "Dark", "E-ink", "+ New"], "Light"))
    setting(p, "Colors", "Text, accent, surfaces and the marks, each with its contrast measured", btn("Edit"))
    setting(p, "Fonts", "Scripture and the interface", btn("Literata · Inter"))


def theme_planned(f):
    p = full(f, PLANNED, "Theme", "Theme", "How the app looks")
    setting(p, "Theme", "System, Light, Dark, E-ink, or one of yours", seg(["Light", "Dark", "E-ink", "+ New"], "Dark"))
    setting(p, "Italic words", "The words the translators added; each theme keeps its own (e31a; dark: grey, 6bb0)",
            seg(["Italic", "Grey", "Grey italic", "Underlined", "Plain"], "Grey italic"))
    pv = col(p, "preview", gap=6, pad=[14, 16, 14, 16], radius=10, stroke="line", sw=1, fill="surface", W="fill")
    text(pv, "PREVIEW · GENESIS 1", "label", "muted")
    K.F.verses(pv, GEN1[:2], "readSmall")
    setting(p, "Colors", "Text, accent, surfaces and the marks, contrast measured", btn("Edit"))
    setting(p, "Fonts", "Scripture and the interface", btn("Literata · Inter"))


def notebook_today(f):
    p = full(f, TODAY, "Notebook", "Notebook", None)
    for n, a, c in (("Today's page", "A page for each day, made when you first write in it", tog(True)),
                    ("Follow the reader", "Grouped by chapter, the list shows the chapter you are reading", tog(True)),
                    ("Links between notes", "[[title]] and [[title#heading]], as in Obsidian", tog(True)),
                    ("Notes on chapters and books", "+ Place offers the chapter and the book", tog(True)),
                    ("What it opens with", "day, chapter, thread, none, pages or questions", seg(["day", "chapter", "pages"], "day")),
                    ("Quick capture", "The key that opens a small box at the verse", btn("Ctrl+J")),
                    ("Places open in", "the reader, or a new reader in a pane", seg(["reader", "new"], "reader"))):
        setting(p, n, a, c)


def notebook_planned(f):
    p = full(f, PLANNED, "Notebook", "Notebook", "e09e: each kept only if a person would want it different")
    setting(p, "Today's page", "A page for each day, made when you first write in it", tog(True))
    setting(p, "What it opens with", "Pages, today's page, the chapter you are reading, or questions",
            seg(["Pages", "Today", "Chapter", "Questions"], "Pages"))
    setting(p, "Places open in", "The reader goes there, or a new reader opens beside it", seg(["Reader", "New"], "Reader"))
    setting(p, "Quick capture key", "Opens a small box at the verse", btn("Ctrl+J"))
    K.note(f, "Proposed to drop as settings, always on: Links between pages, Notes on chapters and books, Follow the "
              "reader (it is where it acts: the Places list's own switch). The rest of e09e (the ⋯ menu) is "
              "Library's next round.", W - 470, H - 120, 420)


def layouts_today(f):
    p = full(f, TODAY, "Layouts", "Layouts", "Which panes are open, kept under a name")
    for n in ("Reading", "Study", "Lesson prep"):
        setting(p, n, "saved 2026-11-0x", lambda it: (P.button(it, "Open", "secondary", size="sm"),
                                                     P.field(it, "Shortcut (optional)", height=30)))


def layouts_planned(f):
    p = full(f, PLANNED, "Layouts", "Layouts", "Arrangements of panes you can return to (a real setting)")
    g = row(p, "layouts", gap=14, wrap=True, W="fill")
    for name, panes, key in (("Reading", 1, "Ctrl+1"), ("Study", 2, "Ctrl+2"), ("Lesson prep", 3, "")):
        it = col(g, name, gap=6)
        pic = row(it, "picture", gap=3, pad=[4, 4, 4, 4], radius=6, stroke="line", sw=1, fill="sunken", W="fixed",
                  H="fixed")
        Q.put(pic, 0, 0, 180, 108)
        for i in range(panes):
            frame(pic, "pane", w=10, h=10, radius=3, fill="surface" if i else "accentSoft", W="fill", H="fill")
        text(it, name, "smallStrong")
        text(it, key or "no key", "caption", "muted")
    b = row(p, "actions", gap=8)
    P.button(b, "Save this layout", "secondary", "plus", size="sm")
    text(b, "Right-click a layout: rename, set its key, delete", "caption", "muted")


def commands_today(f):
    p = full(f, TODAY, "Commands", "Commands", "Kept commands")
    for c in ("notebook @Num 25 questions", "layout load Study"):
        setting(p, c, "kept", lambda it: (P.button(it, "Run", "secondary", size="sm"), P.button(it, "Edit", "ghost", size="sm")))
    text(p, "USED MOST (FROM YOUR LOG)", "label", "muted")
    setting(p, "read Num 25", "used 41 times", btn("Keep"))


def commands_planned(f):
    p = full(f, PLANNED, "Commands", "Commands", "Lines you run often, kept with a name and a key")
    for n, c, k in (("Numbers questions", "notebook @Num 25 questions", "Ctrl+Alt+Q"), ("Study", "layout load Study", "")):
        setting(p, n, f"{c} · {k or 'no key'}", btn("Run"))
    text(p, "SUGGESTED FROM WHAT YOU RUN", "label", "muted")
    setting(p, "read Num 25", "run 41 times this month", btn("Keep", "ghost"))


def keys_today(f):
    p = full(f, TODAY, "Keys", "Keys", None)
    setting(p, "Keys", "Every key the window understands. The quick-capture key is set under Notebook.",
            btn("Open the list of keys (Help ▸ Keys)"))


def keys_planned(f):
    p = full(f, PLANNED, "Keys", "Keys", "Every key, here, and each can be changed")
    P.field(p, "Find a key", height=32)
    for a, k in (("Command field", "Ctrl+K"), ("Quick capture", "Ctrl+J"), ("Next chapter", "→"),
                 ("Back to the verse", "Alt+←"), ("Undo", "Ctrl+Z"), ("Full screen", "F11")):
        setting(p, a, "", btn(k))


def advanced_today(f):
    p = full(f, TODAY, "Advanced", "Advanced", None)
    setting(p, "Input", "Auto follows the device; touch or pointer forces the other", seg(["Auto", "Touch", "Pointer"], "Auto"))
    setting(p, "Window size", "For checking how the window looks at other sizes", btn("Laptop"))
    setting(p, "Measured this run", "Timings since the window opened", btn("Show"))
    setting(p, "Later phases", "Additional document structures are phase 5…", lambda it: None)


def study_planned(f):
    p = full(f, PLANNED, "Study folder", "Study folder", "Where your study and the Bible are")
    setting(p, "Study folder", "C:\\…\\Documents\\Bible Workbench", btn("Change…"))
    setting(p, "Bible database", "datasets\\workbench.db, beside the program (read-only)", btn("Change…"))
    setting(p, "Backups", "A hashed copy of the study folder", btn("Back up now"))
    setting(p, "Input", "Auto follows the device; touch or pointer forces the other", seg(["Auto", "Touch", "Pointer"], "Auto"))
    K.note(f, "Advanced becomes Study folder. Window size and Measured are for building the app: they move behind "
              "a developer switch (wb), not shown to a reader. Later phases goes.", W - 470, H - 120, 420)


def every_tab(cv):
    tab_pair(cv, "Reading", reading_today, reading_planned,
             "Text size and version.", "Cards on hover joins it; no scroll bar or full-screen settings.")
    tab_pair(cv, "Theme", theme_today, theme_planned,
             "Themes, colors, fonts.", "Italic words, with a preview from Genesis 1, kept per theme.")
    tab_pair(cv, "Notebook", notebook_today, notebook_planned,
             "Seven settings (wb settings notebook).", "Four kept; three made always on (e09e).")
    tab_pair(cv, "Layouts", layouts_today, layouts_planned,
             "A list with Open and a shortcut field.", "Pictures of the panes, a key each, Save this layout.")
    tab_pair(cv, "Commands", commands_today, commands_planned,
             "Kept commands and used most.", "Named, with keys; suggestions from what you run.")
    tab_pair(cv, "Keys", keys_today, keys_planned,
             "A button to Help ▸ Keys.", "The keys themselves, findable and changeable.")
    tab_pair(cv, "Advanced → Study folder", advanced_today, study_planned,
             "Input, window size, timings, a note.", "Where the study and the Bible are; backups; Input.")


def conditions(cv):
    r = row(cv, "conditions", gap=64, align="min")
    f = Q.win(r, PG, "C1 · Among other tabs",
              "Settings opened while reading: it comes in as a tab in the right pane beside the Notebook, the reader "
              "keeps its place on the left. The section list narrows to fit the pane.")
    w = K.app(f, on="Settings")
    rw = 720
    K.reader(f, w, rw, GEN1, "Genesis 1")
    c = view(f, w + rw, TB, W - w - rw, H - TB, PLANNED, "Layouts", "Layouts", None,
             tabs=["Notebook", "Settings"], nav_w=150)
    setting(c, "Study", "2 panes · Ctrl+2", btn("Open"))
    setting(c, "Reading", "1 pane · Ctrl+1", btn("Open"))

    f = Q.win(r, PG, "C2 · Floating",
              "Popped out over the reader at a small size: the sections become a menu at its head, so the content "
              "keeps its width. It moves by its tabs and remembers where it was.")
    w = K.app(f, on="Settings")
    K.reader(f, w, W - w, GEN1, "Genesis 1")
    c = view(f, W - 620, TB + 80, 520, 560, PLANNED, "Theme", "Theme", None, tabs=["Settings"], float_=True, narrow=True)
    setting(c, "Theme", "Light, Dark, E-ink", seg(["Light", "Dark", "E-ink"], "Dark"))
    setting(c, "Italic words", "Kept per theme", seg(["Italic", "Grey", "Grey italic"], "Grey italic"))

    f = Q.win(r, PG, "C3 · Years of study",
              "A study of years: 28 layouts, 60 kept commands. Layouts scroll in a grid with a find field; the most "
              "used first. The pane must stay fast with this much (measured with a generated study of that size).")
    c = full(f, PLANNED, "Layouts", "Layouts", "28 saved · most used first")
    P.field(c, "Find a layout", height=32)
    g = row(c, "layouts", gap=12, wrap=True, W="fill")
    for i in range(12):
        it = col(g, f"l{i}", gap=4)
        pic = row(it, "picture", gap=3, pad=[3, 3, 3, 3], radius=6, stroke="line", sw=1, fill="sunken", W="fixed",
                  H="fixed")
        Q.put(pic, 0, 0, 150, 90)
        for j in range(1 + i % 3):
            frame(pic, "pane", w=10, h=10, radius=3, fill="surface" if j else "accentSoft", W="fill", H="fill")
        text(it, ["Reading", "Study", "Lesson prep", "Word study", "Two readers", "Threads",
                  "Tuesday", "Sunday", "Psalms", "Gospels", "Prophets", "Documents"][i], "small")


def sheets2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Settings, round 2: every tab, today and planned",
                  "A design choice is not a setting (scroll bars are the app's design); layouts are. Each tab as built "
                  "and as planned (8 tabs become 7), then Settings among other tabs (C1), floating (C2) and with "
                  "years of study (C3).")
    every_tab(cv)
    conditions(cv)


# ---- round 3 (2026-11-13) ------------------------------------------------------------------------------------------
# The person: layouts in a grid; weigh saving a layout against creating one; creating a theme and its colors; which
# other parts need settings (concordance, trails, …: searched in the code); Settings split beside the Notebook read
# poorly (the section list and Find squeezed the text instead of the layout changing).

HL = [("Yellow", "#F6D860"), ("Green", "#9AD79A"), ("Blue", "#9CC3F0"), ("Pink", "#F2A7C3"), ("Orange", "#F5B37A")]


def pic(parent, panes, w=170, h=100, on=False):
    p = row(parent, "picture", gap=3, pad=[4, 4, 4, 4], radius=6, stroke="accent" if on else "line", sw=2 if on else 1,
            fill="sunken", W="fixed", H="fixed")
    Q.put(p, 0, 0, w, h)
    for i in range(panes):
        frame(p, "pane", w=10, h=10, radius=3, fill="surface" if i else "accentSoft", W="fill", H="fill")
    return p


def grid(parent, items, cols=3, w=170, h=100, first_new=False):
    g = col(parent, "grid", gap=14, W="fill")
    cells = ([None] if first_new else []) + list(items)
    for i in range(0, len(cells), cols):
        r = row(g, f"row{i}", gap=14, align="min")
        for it in cells[i:i + cols]:
            c = col(r, "cell", gap=4)
            if it is None:
                b = col(c, "new", gap=6, pad=[0, 0, 0, 0], radius=6, stroke="line", sw=1, fill="surface", W="fixed",
                        H="fixed", crossAlign="center", mainAlign="center")
                Q.put(b, 0, 0, w, h)
                icon(b, "plus", 22, "accent")
                text(b, "New layout", "smallStrong", "accent")
                text(c, " ", "caption")
                continue
            name, panes, key = it
            pic(c, panes, w, h)
            text(c, name, "smallStrong")
            text(c, key or "no key", "caption", "muted")
    return g


LAYOUTS = [("Reading", 1, "Ctrl+1"), ("Study", 2, "Ctrl+2"), ("Lesson prep", 3, "Ctrl+3"), ("Word study", 2, ""),
           ("Two readers", 2, ""), ("Threads", 3, "")]


def layouts_round3(cv):
    r = row(cv, "layouts r3", gap=64, align="min")
    f = Q.win(r, PG, "L1 · Save: the window as it is",
              "Arrange the panes by hand, then Save this layout and name it. Fast, and what you see is what you keep; "
              "but a layout can only be made by first arranging the window.")
    p = full(f, PLANNED, "Layouts", "Layouts", "In a grid, three across; a click arranges the window")
    grid(p, LAYOUTS)
    m = Q.modal(f, 420, title="Save this layout", sub="Reader on the left, Notebook and Concordance on the right.")
    P.field(m, "Name", "Word study", icon_name=None, height=38)
    Q.buttons(m, ("Cancel", "secondary"), ("Save", "primary"))

    f = Q.win(r, PG, "L2 · Create: build one from parts",
              "New layout opens a builder: pick a shape (one, two, three panes, a pane below), then what each pane "
              "holds. A layout can be made without touching the window; but it is a second way to arrange panes.")
    w = K.app(f, on="Settings")
    p = view(f, w, TB, W - w, H - TB, PLANNED, "Layouts", "New layout", "Pick a shape, then what each pane holds")
    shapes = row(p, "shapes", gap=12)
    for n in (1, 2, 3, 2):
        pic(shapes, n, 110, 66, on=(n == 3))
    big = row(p, "builder", gap=6, pad=[6, 6, 6, 6], radius=8, stroke="line", sw=1, fill="sunken", W="fixed", H="fixed")
    Q.put(big, 0, 0, 620, 300)
    for kind in ("Reader · Genesis 1", "Notebook", "Concordance"):
        c = col(big, kind, gap=8, pad=[12, 12, 12, 12], radius=6, fill="surface", W="fill", H="fill")
        text(c, kind, "smallStrong")
        P.button(c, "Change ▾", "ghost", size="sm")
    b = row(p, "buttons", gap=8)
    P.field(b, "Name", "Word study", icon_name=None, height=34, W="hug")
    P.button(b, "Save layout", "primary", size="sm")

    f = Q.win(r, PG, "L3 · Together (proposed)",
              "One grid. The first tile, New layout, starts the builder from the window as it is now, so saving is "
              "creating with nothing changed (Save at once), and creating is saving after changing it. Right-click "
              "a layout: Edit (the same builder), Rename, Key, Delete.")
    p = full(f, PLANNED, "Layouts", "Layouts", "New layout starts from the window as it is")
    grid(p, LAYOUTS[:5], first_new=True)
    K.note(f, "Why together: one place, one builder. Save this layout in the ⋯ menu stays as the one-step save.",
           W - 470, H - 100, 420)


def theme_round3(cv):
    r = row(cv, "theme r3", gap=64, align="min")
    f = Q.win(r, PG, "TH1 · Creating a theme",
              "+ New in Theme: name it and start from Light, Dark or E-ink. Every color sits in a group, with a live "
              "preview of the reader beside it, so a change is seen on real verses and marks.")
    w = K.app(f, on="Settings")
    p = view(f, w, TB, 640, H - TB, PLANNED, "Theme", "New theme", None)
    P.field(p, "Name", "Evening", icon_name=None, height=36)
    setting(p, "Start from", "Its colors are copied, then yours", seg(["Light", "Dark", "E-ink"], "Dark"))
    for g, items in (("TEXT AND PAPER", [("Text", "#E8E4DA"), ("Paper", "#1E1D1B"), ("Muted", "#9A958A")]),
                     ("ACCENT", [("Accent", "#D9A55B"), ("Words of Jesus", "#E07A6A")]),
                     ("ITALIC WORDS", [("Italic words", "#9A958A")])):
        text(p, g, "label", "muted")
        rr = row(p, g, gap=16, wrap=True, W="fill")
        for n, hexc in items:
            c = row(rr, n, gap=8)
            frame(c, "swatch", w=22, h=22, radius=11, fill=hexc, stroke="line", sw=1, W="fixed", H="fixed")
            text(c, n, "small")
            text(c, hexc, "caption", "muted")
    pv = col(f, "preview", gap=8, pad=[24, 28, 24, 28], fill="#1E1D1B", W="fixed", H="fixed", clip=True)
    Q.put(pv, w + 640, TB, W - w - 640, H - TB)
    text(pv, "PREVIEW", "label", "#9A958A")
    text(pv, "Genesis 1", "chapter", "#E8E4DA", fontSize=26)
    K.F.verses(pv, GEN1, "readSmall")

    f = Q.win(r, PG, "TH2 · The marks' colors, and contrast",
              "The five highlight colors, each with its name (b99f: a color can stand for a topic) and its light and "
              "dark forms (31da: a highlight follows the theme). Contrast is measured as you pick; a pair that reads "
              "poorly says so.")
    w = K.app(f, on="Settings")
    p = view(f, w, TB, W - w, H - TB, PLANNED, "Theme", "Evening · marks", None)
    for n, hexc in HL:
        rr = row(p, n, gap=14, W="fill")
        frame(rr, "light", w=26, h=26, radius=6, fill=hexc, stroke="line", sw=1, W="fixed", H="fixed")
        frame(rr, "dark", w=26, h=26, radius=6, fill=hexc + "66", stroke="line", sw=1, W="fixed", H="fixed")
        P.field(rr, "Name", n if n != "Blue" else "Promises", icon_name=None, height=32, W="hug")
        spacer(rr)
        text(rr, "AA 7.1:1" if n != "Yellow" else "AA 4.6:1", "caption", "muted")
    K.note(f, "Overlaps highlights (names, layers by year) and threads; the names live with the highlights folder, "
              "the colors here.", W - 470, H - 100, 420)


def found_round3(cv):
    r = row(cv, "found", gap=64, align="min")
    f = Q.win(r, PG, "F1 · Settings found in the code, now kept elsewhere",
              "Searched 2026-11-13: preferences that exist but are not in Settings (kept in the browser or in "
              "settings/export.json). Each is shown where it would live.")
    p = full(f, PLANNED + ["Documents"], "Reading", "Reading", "With what the code already keeps")
    for n, a, c in (("Read aloud: voice", "The device voice Listen uses (wb.listen.voice, today only in Listen's bar)", btn("Default ▾")),
                    ("Read aloud: speed", "wb.listen.rate", seg(["0.8×", "1×", "1.2×", "1.5×"], "1×")),
                    ("Mark read after Listen", "Listen finished a chapter of today's plan: offer Mark read (2dcf)", tog(True)),
                    ("Copying verses", "How a copied verse is laid out (wb.copy; today only a command)", seg(["Verse, ref", "Ref, verse", "Short"], "Verse, ref")),
                    ("Toolbar", "Which buttons sit on the top bar (today: its own menu; command bc42)", btn("Choose…"))):
        setting(p, n, a, c)

    f = Q.win(r, PG, "F2 · Documents (a new tab)",
              "The look and theme new documents get are saved (settings/export.json) but only set from a command.")
    p = full(f, PLANNED + ["Documents"], "Documents", "Documents", "What new Word files and slides start with")
    setting(p, "Look", "The layout new documents use", seg(["Preview", "Plain", "Lesson"], "Preview"))
    setting(p, "Theme", "Fonts and colors in the file", btn("Vellum ▾"))
    setting(p, "Saved to", "Documents\\Bible Workbench", btn("Change…"))

    f = Q.win(r, PG, "F3 · Asked, not found: concordance, trails",
              "No preference exists in the code for these. Candidates, to keep only if they earn a place: what a "
              "click on a word opens (its card, or the Concordance); how long the trail keeps tabs. Shown as open "
              "questions, not settled.")
    p = full(f, PLANNED + ["Documents"], "Reading", "Reading · candidates", None)
    setting(p, "A click on a word opens", "Its card, or the Concordance at that word", seg(["Card", "Concordance"], "Card"))
    setting(p, "The trail keeps", "Tabs you closed, to open again", seg(["Today", "7 days", "Always"], "7 days"))


def split_round3(cv):
    r = row(cv, "split", gap=64, align="min")
    f = Q.win(r, PG, "C1′ · Split beside the Notebook, reflowed",
              "Narrow, Settings changes shape instead of squeezing: the section list becomes a menu at its head, Find "
              "becomes a search icon (it still finds a setting by any word), and each setting stacks its name, its "
              "line and its control, so text keeps its size and wraps cleanly.")
    w = K.app(f, on="Settings")
    rw = 640
    K.reader(f, w, rw, GEN1, "Genesis 1")
    nb = (W - w - rw) // 2
    d = frame(f, "notebook pane", x=w + rw, y=TB, w=nb, h=H - TB, fill="surface", layout="vertical", W="fixed",
              H="fixed", stroke="line", sw=1, clip=True)
    K.M.folder_strip(d, ["Notebook"], "Notebook", actions=("float", "close"))
    nbp = col(d, "nb", gap=4, pad=[12, 12, 12, 12], W="fill")
    for n in ("Phinehas", "Zeal", "Tuesday study"):
        K.line(nbp, n, None, "notebook")
    c = view(f, w + rw + nb, TB, W - w - rw - nb, H - TB, PLANNED, "Theme", "Theme", None, tabs=["Settings"],
             narrow=True)
    for n, a, opts, on in (("Theme", "Light, Dark, E-ink, or one of yours", ["Light", "Dark", "E-ink"], "Dark"),
                           ("Italic words", "Kept per theme", ["Italic", "Grey", "Grey italic"], "Grey italic")):
        st = col(c, n, gap=4, pad=[8, 0, 8, 0], W="fill")
        text(st, n, "bodyStrong")
        para(st, a, "caption", "muted")
        P.segmented(st, opts, on, W="fill")
    K.note(f, "Rule for every pane: below ~520 px wide a pane reflows (menus for lists, stacked rows), it never "
              "shrinks text.", W - 470, H - 100, 420)


def sheets3(board):
    cv = Q.section(board, "Round 3", 3200)
    Q.sheet_title(cv, "Settings, round 3",
                  "Layouts in a grid: save (L1), create (L2), or both in one (L3). Creating a theme (TH1) and the marks' "
                  "colors (TH2). Settings found in the code (F1, F2) and candidates (F3). Split beside the Notebook, "
                  "reflowed (C1′).")
    layouts_round3(cv)
    theme_round3(cv)
    found_round3(cv)
    split_round3(cv)


def both(board):
    sheets3(board)
    sheets2(board)
    sheets(board)


if __name__ == "__main__":
    K.run_board(HERE, "Settings", both)
