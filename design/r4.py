"""R4 of the debug round (docs/archive/2026-11-10/docs/debug-spec.md, 2026-11-09): the toolbar, the More menu, Settings and a person's own theme,
drawn with FigCraft as the earlier rounds were (it reuses phase2b.py's helpers, so the sheets look alike). Nothing is built
from these sheets until the person accepts them. Review and the questions: docs/archive/2026-11-10/docs/redesign-R4.md.

    python design/r4.py     # writes design/r4.figcraft and design/exports/r4/*.png

Nothing here is scripture except the reader behind the windows, which comes from content.json (fetched from the database
with wb text). Hex values on the Theme sheet are the app's Dark tokens (ui/tokens.css); the contrast figures are computed.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
from figlib import S, col, frame, icon, para, rect, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "R4"
PG = "Toolbar, More, Settings, Theme"
F.ICONS.setdefault("sliders", "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4")
F.ICONS.setdefault("undo", "M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 8")
F.ICONS.setdefault("gear", "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1")


# ---- small pieces ------------------------------------------------------------------------------------------------------
def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def tag(parent, s, kind="quiet"):
    fill, fg = {"quiet": ("sunken", "muted"), "go": ("accentSoft", "accent")}[kind]
    t = row(parent, f"tag/{s}", pad=[2, 8, 2, 8], radius=999, fill=fill)
    text(t, s, "caption", fg)
    return t


def tool_edit(parent, label, icon_name, count=None):
    """A toolbar button in edit mode: a grip to drag, the label, x to put it away (it goes to More)."""
    t = row(parent, f"edit/{label}", gap=5, pad=[6, 6, 6, 4], radius=8, fill="surface", stroke="accent", sw=1)
    icon(t, "drag", 14, "muted")
    icon(t, icon_name, 17, "fg")
    text(t, label, "smallStrong")
    if count:
        bd = row(t, "count", pad=[0, 6, 0, 6], fill="accent", radius=999)
        text(bd, str(count), "caption", "onAccent", fontSize=11, lineHeight="16px")
    icon(t, "close", 13, "muted")
    return t


def bar_start(f, w, field_w, name="toolbar"):
    bar = row(f, name, gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, 0, 0, w, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "accent")
    text(pl, "Numbers 25", "bodyStrong")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1, W="fixed", H="fixed")
    Q.put(cmd, 0, 0, field_w, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "Search, go to a place, or type a command", "small", "muted", W="fill", maxLines=1)
    spacer(bar)
    return bar


def toolbar_edit(f, items, w=W):
    """The real toolbar, in edit mode: same place, field and more; the tools are the editing."""
    bar = bar_start(f, w, 150, "toolbar (editing)")
    tools = row(bar, "tools", gap=6)
    for lab, ic, n in items:
        tool_edit(tools, lab, ic, n)
    add = row(tools, "add slot", gap=5, pad=[6, 10, 6, 8], radius=8, fill="accentSoft")
    icon(add, "plus", 16, "accent")
    text(add, "Add", "smallStrong", "accent")
    P.button(bar, "Done", "primary", size="sm")
    return bar


def drawer(f, title, sub, w=400):
    """A drawer at the right edge under the toolbar (not a modal: the toolbar stays live above it, the reader beside)."""
    d = frame(f, "drawer", x=W - w, y=TB, w=w, h=H - TB, fill="surface", layout="vertical", W="fixed", H="fixed", clip=True,
              stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    shadow(d, 0, 24, "#00000026")
    b = col(d, "body", gap=12, pad=[18, 18, 18, 18], W="fill", H="fill", clip=True)
    tc = col(b, "titles", gap=2, W="fill")
    text(tc, title, "title")
    para(tc, sub, "small", "muted")
    return b


def group(parent, name):
    text(parent, name.upper(), "label", "muted")


def entry(parent, label, sub, state="add"):
    it = row(parent, f"entry/{label}", gap=10, pad=[6, 8, 6, 8], radius=8, W="fill")
    icon(it, "check" if state == "on" else "plus", 17, "ok" if state == "on" else "accent")
    tc = col(it, "text", gap=0, W="fill")
    text(tc, label, "bodyStrong" if state == "add" else "body", "fg" if state == "add" else "muted")
    para(tc, sub, "caption", "muted")
    return it


def window(parent, title, about, **kw):
    return Q.win(parent, PG, title, about, **kw)


def popmenu(f, x, y, w, name="More menu"):
    p = col(f, name, gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, x=x, y=y, W="fixed")
    Q.put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def overflow_row(p, lab, ic, plus=True):
    it = row(p, f"overflow/{lab}", gap=10, pad=[8, 10, 8, 10], radius=8, W="fill")
    icon(it, ic, 18, "muted")
    text(it, lab, "body", W="fill")
    if plus:
        icon(it, "plus", 16, "muted")


def settings_window(f, active, w=1060, h=700, y=64, x=None):
    """Settings as a floating pane with no scrim, so the reader stays visible and live behind it."""
    m = col(f, "Settings", gap=14, pad=[18, 22, 18, 22], fill="surface", radius=16, stroke="line", sw=1, W="fixed", H="fixed")
    Q.put(m, (W - w) // 2 if x is None else x, y, w, h)
    shadow(m, 16, 48, "#00000040")
    head = row(m, "head", gap=10, W="fill")
    text(head, "Settings", "title")
    spacer(head)
    fld = P.field(head, "Find a setting", None, icon_name="search", height=34, W="fixed")
    S.do("node.set", {"ids": [fld], "props": {"width": 260}}, ref=False)
    P.icon_button(head, "close", "muted", size=34, icon_size=18, fill="sunken")
    two = row(m, "two", gap=22, W="fill", H="fill", align="min")
    nav = col(two, "sections", gap=2, W="fixed")
    Q.put(nav, 0, 0, 190)
    for t in ("Toolbar", "Layouts", "Reading", "Notebook", "Hover and cards", "Theme", "Commands", "Keys", "Advanced"):
        on = t == active
        it = row(nav, f"section/{t}", pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None, W="fill")
        text(it, t, "smallStrong" if on else "body", "accent" if on else "fg")
    return col(two, "section body", gap=14, W="fill", H="fill", clip=True)


def setting(parent, name, what, ctl):
    r = row(parent, f"setting/{name}", gap=16, pad=[10, 0, 10, 0], W="fill", stroke="line", sw=1,
            strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    tc = col(r, "text", gap=1, W="fill")
    text(tc, name, "bodyStrong")
    para(tc, what, "small", "muted")
    ctl(r)
    return r


# ---- the sheet ---------------------------------------------------------------------------------------------------------
TODAY = [  # what More holds today (ui/src/main.ts settings()), and where each goes
    ("Today’s reading (each plan’s days)", "Reading plans pane"),
    ("Find in chapter", "Ctrl+F · find"),
    ("Help", "stays in More"),
    ("Keys", "Help ▸ Keys"),
    ("Reading plans", "not on toolbar"),
    ("Today’s log", "not on toolbar"),
    ("Shelf", "the toolbar"),
    ("Findings", "not on toolbar"),
    ("Documents", "not on toolbar"),
    ("Text size  A−  100%  A+", "Settings ▸ Reading"),
    ("Version  KJV · YLT", "toolbar · Reading"),
    ("Hover cards  off · refs · on", "Settings ▸ Hover"),
    ("Theme  system · light · dark · e-ink", "Settings ▸ Theme"),
    ("Window size (7 presets)", "Settings ▸ Advanced"),
    ("Input  auto · touch · pointer", "Settings ▸ Advanced"),
    ("Later phases (a note)", "Help ▸ Guide"),
    ("Go to  [Psalm 119]", "gone: the field does it"),
    ("Measured this run", "Settings ▸ Advanced"),
]
DEMO_TOOLS = [("Layout: Reading", "dock", None), ("KJV", "book", None), ("Notebook", "notebook", 2),
              ("Threads", "threads", None), ("Highlights", "highlight", None), ("uses {word}", "search", None)]


def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "The toolbar, More, Settings and a person's own theme", "R4 of the debug round (findings bc42, 8810, "
                  "c551, 93b2). The sheets of 2026-11-04 (S2, TB1, TB2, V1) gave a toggle list and a search box; this round "
                  "redraws what bc42 says is unsettled: the customize tool itself, and a More menu cut down to what belongs "
                  "there. Seven windows: More today and cut down; customizing in place; a command of your own; what "
                  "happens when the buttons do not fit; Settings; a theme of your own.")

    # A1 / A2
    r = row(cv, "row 1", gap=64, align="min")
    f = window(r, "A1 · More today", "What grew into it, in order, each with where it goes (the tags). Eighteen things in a "
               "420-pixel popover: panes, settings, a form, a measurement, and a note about later phases.")
    Q.toolbar(f)
    Q.reader(f, 0, W)
    p = popmenu(f, W - 452, TB + 4, 440, "More today")
    text(p, "MORE", "label", "muted")
    for item, dest in TODAY:
        it = row(p, f"today/{item}", gap=8, pad=[5, 8, 5, 8], radius=6, W="fill")
        text(it, item, "small", W="fill", maxLines=1)
        tag(it, dest, "go" if dest.startswith(("Settings", "Help", "toolbar", "Ctrl", "Reading")) else "quiet")

    f = window(r, "A2 · More cut down", "Settings, Customize toolbar, Help, and whatever is not on the toolbar: More is the "
               "toolbar's overflow, so hiding a button never loses it. Each overflow row has a + that puts it back.")
    Q.toolbar(f)
    Q.reader(f, 0, W)
    p = popmenu(f, W - 332, TB + 4, 320, "More cut down")
    Q.menu_item(p, "Settings…", None, icon_name="gear", kbd="Ctrl+,")
    Q.menu_item(p, "Customize toolbar…", None, icon_name="sliders")
    Q.menu_item(p, "Help", "Guide · Commands · Keys", icon_name="question", kbd="F1")
    P.divider(p)
    text(p, "NOT ON YOUR TOOLBAR", "label", "muted")
    for lab, ic in (("Reading plans", "list"), ("Today’s log", "inbox"), ("Findings", "capture"), ("Documents", "docs")):
        overflow_row(p, lab, ic)

    # B1 / B2
    r = row(cv, "row 2", gap=64, align="min")
    f = window(r, "B1 · Customize, in place", "More ▸ Customize toolbar. The toolbar itself becomes the tool: each button has a "
               "grip (drag to reorder) and a × (put away: it moves to More). Add opens the catalog at the right, beside the "
               "live window, not over it. Done keeps it; Esc undoes this visit.")
    toolbar_edit(f, DEMO_TOOLS)
    Q.reader(f, 0, W - 420)
    b = drawer(f, "Add to the toolbar", "Click +, or drag onto the bar.", w=420)
    P.field(b, "Find a button", "gu", icon_name="search", height=36)
    group(b, "Panes")
    entry(b, "Guide", "Help’s guide to the window")
    entry(b, "Help", "the whole manual")
    entry(b, "Notebook", "on your toolbar", "on")
    group(b, "Layouts")
    entry(b, "Word study", "Strong’s left, every use right")
    group(b, "Reading controls")
    entry(b, "Text size", "A− 100% A+, one small menu")
    entry(b, "Theme", "light ↔ dark in one click")
    group(b, "Commands")
    entry(b, "A command of your own…", "any line, like uses {word} or compare {place} ylt")
    entry(b, "My commands", "the sheet of the ones you keep")
    P.button(b, "Reset to the standard toolbar", "ghost", "undo", size="sm")

    f = window(r, "B2 · A command of your own", "From the catalog: a name, the line, an icon, optionally a key. {word} takes the "
               "word selected in the reader, {place} the verse picked (or at the top). Test shows what the line would run right "
               "now, before it is kept; the button greys itself when it needs a selection and there is none.")
    toolbar_edit(f, DEMO_TOOLS)
    Q.reader(f, 0, W - 420)
    b = drawer(f, "A command of your own", "Written as you would type it in the field.", w=420)
    Q.form_field(b, "Name on the button", "uses {word}", required=True)
    Q.form_field(b, "The line", "uses {word}", required=True, hint="Any line the command field understands")
    para(b, "Fill-ins: {word} the selected word · {place} the verse picked, or at the top · {chapter} the chapter in the reader", "caption", "muted")
    ir = row(b, "icon+key", gap=10, W="fill")
    for lab, v in (("Icon", "magnifier"), ("Key", "Ctrl+U")):
        Q.form_field(ir, lab, v, required=False)
    t = col(b, "test", gap=6, pad=[12, 12, 12, 12], fill="sunken", radius=10, W="fill")
    text(t, "TEST, WITH WHAT IS SELECTED NOW", "label", "muted")
    text(t, "uses {word}  →  uses zealous", "bodyStrong")
    para(t, "Opens the uses of the selected word in a tab. Nothing is written.", "caption", "muted")
    Q.buttons(b, ("Keep, no button", "secondary"), ("Add to toolbar", "primary"))
    Q.files_note(b, "Kept in settings/commands.json. The Python app passes over it.")

    # B3 / C1
    r = row(cv, "row 3", gap=64, align="min")
    f = window(r, "B3 · When the buttons do not fit", "A narrower window, as at 1000 pixels: buttons leave from the right end in the "
               "order the person set, and wait in More under Hidden to fit, so the toolbar never wraps or clips. This replaces "
               "the one hard-coded rule (the Shelf hides under 1366 pixels).", w=1000, h=620)
    bar = bar_start(f, 1000, 260)
    tools = row(bar, "tools", gap=4)
    P.tool(tools, "KJV", "book")
    P.tool(tools, "Notebook", "notebook", True, count=2)
    P.tool(tools, "Threads", "threads")
    P.icon_button(tools, "more", "fg", size=34, icon_size=20, fill="accentSoft")
    B.desk_reader(f, 0, TB, 1000, 620 - TB, first=9, last=13)
    p = popmenu(f, 1000 - 332, TB + 4, 320, "More, narrow")
    Q.menu_item(p, "Settings…", None, icon_name="gear", kbd="Ctrl+,")
    Q.menu_item(p, "Customize toolbar…", None, icon_name="sliders")
    Q.menu_item(p, "Help", "Guide · Commands · Keys", icon_name="question", kbd="F1")
    P.divider(p)
    text(p, "HIDDEN TO FIT", "label", "muted")
    overflow_row(p, "Shelf", "shelf", plus=False)
    overflow_row(p, "Highlights", "highlight", plus=False)
    text(p, "NOT ON YOUR TOOLBAR", "label", "muted")
    for lab, ic in (("Reading plans", "list"), ("Today’s log", "inbox"), ("Findings", "capture"), ("Documents", "docs")):
        overflow_row(p, lab, ic)

    f = window(r, "C1 · Settings", "A pane of its own that floats with no dimming, so the reader stays live behind it (a theme can "
               "be seen while it is made). Nine sections and a search over every setting. Each change is saved as it is made, "
               "per key, with Undo; there is no Save. Reading is shown.")
    Q.toolbar(f)
    Q.reader(f, 0, W)
    body = settings_window(f, "Reading")
    text(body, "Reading", "heading")

    def size_ctl(r_):
        P.button(r_, "A−", "secondary", size="sm")
        text(r_, "100%", "bodyStrong")
        P.button(r_, "A+", "secondary", size="sm")
        P.button(r_, "100%", "ghost", size="sm")
    setting(body, "Text size", "How large scripture is drawn; Ctrl+= and Ctrl+- do the same", size_ctl)
    setting(body, "Version", "The reader's version when the window opens", lambda r_: P.segmented(r_, ["KJV", "YLT"], "KJV", W="hug"))
    setting(body, "Open places in", "What a click on a place does; Ctrl+click does the other",
            lambda r_: P.segmented(r_, ["The reader", "A new reader"], "The reader", W="hug"))
    setting(body, "Reading face and size", "Scripture's font, its line height and its width",
            lambda r_: P.button(r_, "Theme ▸ Fonts", "ghost", size="sm"))
    setting(body, "Today’s reading", "Show the day's places at the top of the Reading plans pane", lambda r_: Q.toggle(r_, True))
    foot = row(body, "foot", gap=8, W="fill")
    text(foot, "Saved as you go in settings/reading.json", "caption", "muted")
    spacer(foot)
    P.button(foot, "Reset this page", "ghost", "undo", size="sm")

    # C2
    r = row(cv, "row 4", gap=64, align="min")
    f = window(r, "C2 · A theme of your own", "Theme: the four we ship, and yours. A theme is a base (here Dark) plus only the colors "
               "you changed, so it stays right when a new color is added. Every color has a picker, its hex and a dot when "
               "changed; the window behind is the preview, live. Contrast is measured, never decided.", m="Dark")
    Q.toolbar(f)
    Q.reader(f, 0, W)
    body = settings_window(f, "Theme", w=900, h=780, y=56, x=W - 916)
    themes = row(body, "themes", gap=8, W="fill")
    for name, on in (("System", False), ("Light", False), ("Dark", False), ("E-ink", False), ("Evening (yours)", True)):
        c_ = row(themes, f"theme/{name}", gap=6, pad=[8, 12, 8, 12], radius=10, fill="accentSoft" if on else "sunken",
                 stroke="accent" if on else None, sw=1 if on else None)
        text(c_, name, "smallStrong", "accent" if on else "fg")
    P.button(themes, "New theme", "ghost", "plus", size="sm")
    hd = row(body, "editing", gap=10, W="fill")
    text(hd, "Evening", "heading")
    text(hd, "based on Dark · 3 colors changed", "small", "muted")
    spacer(hd)
    P.button(hd, "Reset to Dark", "ghost", "undo", size="sm")
    cols_ = row(body, "colors", gap=16, W="fill", align="min")
    DARK = {"bg": "#17140F", "surface": "#211D16", "sunken": "#1C1813", "fg": "#E9E2D4", "muted": "#9A917F", "line": "#342E24",
            "accent": "#E0A46C", "soft": "#3A2D1F", "jesus": "#EF7D6E", "y": "#4A3F1C", "g": "#2B3D25", "b": "#22344A",
            "p": "#47253A", "o": "#4A3220", "ta": "#E8A060", "tb": "#7FB0E8", "q": "#B9A2E6"}
    changed = {"bg": "#14110D", "accent": "#E8B27A", "jesus": "#F08A7A"}
    show = {**DARK, **changed}

    def swatches(parent, title, rows_):
        g = col(parent, f"group/{title}", gap=4, W="fill")
        text(g, title.upper(), "label", "muted")
        for lab, key in rows_:
            rr = row(g, f"color/{lab}", gap=10, pad=[3, 0, 3, 0], W="fill")
            frame(rr, "swatch", w=26, h=26, radius=6, fill=show[key], stroke="line", sw=1, W="fixed", H="fixed")
            text(rr, lab, "small", W="fill", maxLines=1)
            text(rr, show[key], "caption", "muted")
            frame(rr, "changed" if key in changed else "unchanged", w=8, h=8, radius=4,
                  fill="accent" if key in changed else "none", W="fixed", H="fixed")

    c1 = col(cols_, "col 1", gap=12, W="fill")
    swatches(c1, "Surfaces", [("Page behind the text", "bg"), ("Cards and panes", "surface"), ("Toolbars and wells", "sunken"), ("Lines", "line")])
    swatches(c1, "Text", [("Text", "fg"), ("Secondary text", "muted"), ("Accent", "accent"), ("Selection", "soft")])
    c2 = col(cols_, "col 2", gap=12, W="fill")
    swatches(c2, "Scripture", [("Words of Jesus", "jesus"), ("Highlight: yellow", "y"), ("Highlight: green", "g"), ("Highlight: blue", "b"),
                               ("Highlight: pink", "p"), ("Highlight: orange", "o")])
    swatches(c2, "Threads", [("Thread underline A", "ta"), ("Thread underline B", "tb"), ("An open question", "q")])
    c3 = col(cols_, "col 3", gap=12, W="fill")
    g = col(c3, "contrast", gap=4, W="fill")
    text(g, "CONTRAST, MEASURED", "label", "muted")
    for lab, a, b_ in (("Text on page", show["fg"], show["bg"]), ("Secondary on page", show["muted"], show["bg"]),
                       ("Accent on page", show["accent"], show["bg"]), ("Words of Jesus on page", show["jesus"], show["bg"]),
                       ("Text on yellow", show["fg"], show["y"])):
        v = ratio(a, b_)
        rr = row(g, f"contrast/{lab}", gap=8, W="fill")
        text(rr, lab, "small", W="fill", maxLines=1)
        text(rr, f"{v:.1f}:1", "caption", "muted")
        icon(rr, "check" if v >= 4.5 else "question", 14, "ok" if v >= 4.5 else "warn")
    para(g, "4.5:1 is the usual floor for reading text. A warning is shown, never enforced.", "caption", "muted")
    f2 = col(c3, "fonts", gap=6, W="fill")
    text(f2, "FONTS", "label", "muted")
    for lab, v in (("Scripture", "Literata"), ("Interface", "Inter"), ("Scripture size", "19 px · 34 line")):
        rr = row(f2, f"font/{lab}", gap=8, pad=[6, 10, 6, 10], radius=8, fill="sunken", W="fill")
        text(rr, lab, "small", "muted", W="fill")
        text(rr, v, "smallStrong")
        icon(rr, "down", 13, "muted")
    foot = row(body, "foot", gap=8, W="fill")
    text(foot, "Kept in settings/theme.json: a name, a base and the colors changed", "caption", "muted")
    spacer(foot)
    P.button(foot, "Delete Evening", "ghost", size="sm")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "r4.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "r4.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports" / "r4"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.4", "--out",
                    str(dest / "all.png")], check=True, capture_output=True)
    for title in Q.TITLES.get(PG, []):
        file = dest / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", "Window · " + title,
                        "--scale", "1", "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
