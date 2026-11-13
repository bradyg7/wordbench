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


if __name__ == "__main__":
    K.run_board(HERE, "Settings", sheets)
