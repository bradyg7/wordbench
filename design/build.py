"""Build the Bible Workbench design file with FigCraft, from scripts, and export its sheets.

    python design/content.py     # once, or when the content changes: verbatim scripture from wb into content.json
    python design/build.py       # writes design/workbench.figcraft and design/exports/*.png

The FigCraft CLI is found the way workbench/craft_export.py finds WordCraft, DeckCraft and PdfCraft. Renders use FigCraft's
built-in fonts only (--no-system-fonts), so they come out the same on any machine. Open workbench.figcraft in FigCraft to
look around, change things by hand, or start the e-reader page from the same components.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import figlib as F  # noqa: E402
import parts as P  # noqa: E402
from figlib import S, col, frame, icon, mode, para, rect, row, shadow, spacer, text  # noqa: E402

C = json.loads((HERE / "content.json").read_text(encoding="utf-8"))
OUT = HERE / "exports"


def find_cli():
    # installed for this user (%LOCALAPPDATA%\Programs\ArtCraft) or for every user (%ProgramFiles%\ArtCraft)
    local, every = os.environ.get("LOCALAPPDATA"), os.environ.get("ProgramFiles")
    folders = [Path(x) / sub / "FigCraft" for x, sub in ((local, "Programs/ArtCraft"), (every, "ArtCraft")) if x]
    for folder in folders:
        for candidate in (folder / "figcraft-cli.exe", folder / "figcraft-cli"):
            if candidate.exists():
                return str(candidate)
    sys.exit("FigCraft is not installed (looked in %s)" % ", ".join(map(str, folders)))


def vv(key, first=None, last=None):
    return [v for v in C[key]["verses"] if (first is None or v["v"] >= first) and (last is None or v["v"] <= last)]


def verse(key, n):
    return next(v["text"] for v in C[key]["verses"] if v["v"] == n)


# The person's marks on Numbers 25 as the sheets show them (the scratch study: highlights on 25:11-13, the Phinehas thread,
# notes on 25:8, 25:11 and 25:13, an open question on 25:9).
NUM25_MARKS = {
    7: {"threads": {2: ["threadA"]}},
    8: {"note": True},
    9: {"question": True},
    11: {"hl": "green", "threads": {0: ["threadA"]}, "note": [21, 22, 23, 24]},
    12: {"hl": "yellow"},
    13: {"hl": "yellow", "note": True},
}

INBOX = [
    ("question", "24,000 died here; 1 Cor 10:8 says 23,000 fell in one day. How do the two numbers relate?", "13:47"),
    ("jot", "Check where else “rose up from among the congregation” is used.", "13:30"),
]


def sheet_title(parent, title, about):
    h = col(parent, "sheet title", gap=6, W="fill")
    text(h, title, "display", fontSize=40, lineHeight="48px")
    para(h, about, "body", "muted")
    return h


def section(parent, title, about=None, w=None, name=None):
    s = col(parent, name or title, gap=16, pad=28, fill="surface", radius=16, stroke="line", sw=1,
            W="fixed" if w else "hug")
    if w:
        S.do("node.set", {"ids": [s], "props": {"width": w}}, ref=False)
    text(s, title, "title", fontSize=22, lineHeight="28px")
    if about:
        para(s, about, "small", "muted")
    return s


def canvas(name, w):
    """A page's one top-level frame: everything on the page flows inside it, so nothing overlaps."""
    return frame(None, name, x=0, y=0, w=w, h=100, fill="bg", layout="vertical", gap=40, pad=64, W="fixed", H="hug")


# ==== page 1: design system ============================================================================================
def design_system():
    cv = canvas("Design system", 2600)
    sheet_title(cv, "Bible Workbench · design system",
                "One system for phone, desktop and the reading device. Every color is a variable with three modes "
                "(Light, Dark, E-ink): a frame set to E-ink redraws in grays, so the e-ink layout is the same "
                "components in a constrained mode, not a separate design. Scripture on every sheet came from wb text.")
    top = row(cv, "row 1", gap=40, align="min")

    # colors
    s = section(top, "Color", "Variables in the collection “Color”. Light and Dark are the app's own colors today; "
                "E-ink starts from the Print export theme (black on white, one gray mark) and keeps text dark.", w=1240)
    grid = row(s, "modes", gap=16, align="min", W="fill")
    for m in F.MODES:
        mc = col(grid, f"mode/{m}", gap=8, pad=16, fill="bg", radius=12, stroke="line", sw=1, W="fill")
        text(mc, m, "heading")
        for name, (light, dark, eink, about) in F.COLORS.items():
            r = row(mc, f"token/{name}", gap=10, W="fill")
            sw = frame(r, "swatch", w=28, h=28, radius=6, fill=name, stroke="line", sw=1, W="fixed", H="fixed")
            text(r, name, "smallStrong", W="fill")
            text(r, {"Light": light, "Dark": dark, "E-ink": eink}[m], "caption", "muted")
        mode(mc, m)

    # type
    s = section(top, "Type", "Inter for the interface, Merriweather for scripture (sturdy strokes that hold up on "
                "e-ink), Noto Sans Hebrew for the original words. All three are built into FigCraft; in the app the "
                "reading face is a decision for the person (see PLAN-design.md).", w=1220)
    for name, (fam, style, size, lh, ls, about) in F.TYPE.items():
        r = row(s, f"type/{name}", gap=20, W="fill", align="baseline")
        meta = col(r, "meta", gap=0, W="fixed")
        S.do("node.set", {"ids": [meta], "props": {"width": 220}}, ref=False)
        text(meta, name, "smallStrong")
        text(meta, f"{fam} {style} {size}/{lh}", "caption", "muted")
        sample = {"hebrew": C["interlinear"][9]["original"] + "  " + C["interlinear"][14]["original"],
                  "verseNum": "11 12 13", "chapter": "Numbers 25"}.get(name)
        if sample is None:
            sample = verse("num25", 11) if name.startswith("read") else about[0].upper() + about[1:]
        t = text(r, sample, name, W="fill", maxLines=2)
        if name == "verseNum":
            S.do("node.set", {"ids": [t], "props": {"fill": F.c("accent")}}, ref=False)

    row2 = row(cv, "row 2", gap=40, align="min")
    s = section(row2, "Space, shape, touch", w=700)
    r = row(s, "spacing", gap=16, align="max")
    for n in F.SPACE:
        b = col(r, f"space/{n}", gap=6, crossAlign="center", W="hug")
        rect(b, "size", n, n, "accentSoft", stroke=F.c("accent"), strokeWeight=1)
        text(b, str(n), "caption", "muted")
    para(s, "A 4-point grid: 4, 8, 12, 16, 24, 32, 48. Radius 8 for controls, 12 for cards, 20 for sheets, full for "
         "pills.", "small", "muted")
    r = row(s, "radii", gap=16)
    for lbl, rad in (("control 8", 8), ("card 12", 12), ("sheet 20", 20), ("pill", 999)):
        b = col(r, f"radius/{lbl}", gap=6, crossAlign="center", W="hug")
        frame(b, "shape", w=96 if lbl != "pill" else 120, h=56, radius=rad, fill="sunken", stroke="line", sw=1,
              W="fixed", H="fixed")
        text(b, lbl, "caption", "muted")
    r = row(s, "touch", gap=24, align="max")
    for lbl, n in (("phone 44", 44), ("e-ink 56", 56), ("desktop 32", 32)):
        b = col(r, f"touch/{lbl}", gap=6, crossAlign="center", W="hug")
        frame(b, "target", w=n, h=n, radius=8, stroke="accent", sw=1.5, dashes=[4, 3], W="fixed", H="fixed")
        text(b, lbl, "caption", "muted")
    para(s, "Smallest tap targets. E-ink adds room because a press there gives no instant feedback.", "small", "muted")

    s = section(row2, "Icons", "Stroke icons on a 24 grid, the line style of today's toolbar.", w=820)
    grid = frame(s, "icon grid", layout="horizontal", wrap=True, gap=12, crossGap=12, W="fill", H="hug")
    for name in F.ICONS:
        b = col(grid, f"icon/{name}", gap=4, crossAlign="center", W="fixed", pad=[10, 0, 8, 0], fill="bg", radius=10)
        S.do("node.set", {"ids": [b], "props": {"width": 92}}, ref=False)
        icon(b, name, 24, "fg")
        text(b, name, "caption", "muted")

    s = section(row2, "Marks on the text", "What the reader draws over scripture. Layers only draw; they never "
                "change the words.", w=860)
    F.verses(s, vv("num25", 11, 13), "readPhone", NUM25_MARKS)
    leg = col(s, "legend", gap=8)
    for lbl, kind in (("a highlight fill (five colors and saved custom ones)", "hlGreen"),
                      ("a solid underline per shown thread, in its color (e-ink: solid or dashed black)", "threadA"),
                      ("a dotted underline: words with a note", "muted"),
                      ("a dot after the verse number: a note on the whole verse", "accent"),
                      ("a numbered verse with an open question", "question")):
        r = row(leg, lbl, gap=10)
        rect(r, "key", 22, 10, kind, cornerRadius=2)
        text(r, lbl, "small")

    # components
    text(cv, "Components", "display", fontSize=32, lineHeight="40px")
    comps = row(cv, "components 1", gap=40, align="min")

    s = section(comps, "Controls", w=560)
    r = row(s, "buttons", gap=10)
    P.button(r, "Place it…", "primary", "place")
    P.button(r, "Every use", "secondary", "list")
    P.button(r, "Interlinear", "ghost")
    P.button(r, "Note", "soft", "pen")
    r = row(s, "chips", gap=8)
    P.chip(r, "Numbers 25:11", "place", icon_name="place")
    P.chip(r, "Question", "question", icon_name="question")
    P.chip(r, "Phinehas", "outline", dot_color="threadA")
    P.chip(r, "No place yet", "quiet")
    P.segmented(s, ["Journal", "Inbox", "All notes"], "Journal", badges={"Inbox": 2})
    P.field(s, "Search the KJV, or H7065", None)
    P.color_row(s, "hlGreen")

    s = section(comps, "Phone chrome", "Top bar, tab bar, the capture button.", w=430)
    holder = frame(s, "phone chrome", w=390, h=300, fill="bg", radius=12, stroke="line", sw=1, W="fixed", H="fixed",
                   clip=True)
    tb = P.top_bar(holder, "Numbers 25", "left", ["search", "type"], title_icon="down")
    S.do("node.set", {"ids": [tb], "props": {"x": 0, "y": 0}}, ref=False)
    tabs = P.tab_bar(holder)
    S.do("node.set", {"ids": [tabs], "props": {"x": 0, "y": 216}}, ref=False)
    P.fab(holder, 318, 140)

    s = section(comps, "Tap cards: the answer to hover", "A hover card cannot exist on touch or e-ink. A tap on a "
                "verse number or a word raises a sheet; the reader underneath does not move.", w=880)
    r = row(s, "sheets", gap=24, align="min")
    for title, sub, fn in (
            ("Numbers 25:11", "KJV · tap a verse number", lambda sh: para(sh, verse("num25", 11), "readSmall")),
            ("zealous", "the word in Numbers 25:11 · tap a word",
             lambda sh: P.lexicon_block(sh, C["lexicon"]["H7065"], C["count"]["H7065"]))):
        h = frame(r, "sheet holder", w=390, h=10, fill="sunken", radius=12, W="fixed", H="hug", layout="vertical",
                  pad=[24, 0, 0, 0], clip=True)
        sh = P.sheet(h, 0, title, subtitle=sub)
        S.do("node.set", {"ids": [sh], "props": {"sizingH": "fill"}}, ref=False)
        fn(sh)

    comps2 = row(cv, "components 2", gap=40, align="min")
    s = section(comps2, "Notes in the Notebook", "One kind of note. A placed note shows its place; an unplaced one "
                "offers Place it; a question is a note marked ?, so Trails fold into the Notebook.", w=560)
    P.note_card(s, "Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.", "Numbers 25:13", "14:02")
    for kind, body, t in INBOX:
        P.note_card(s, body, None, t, kind)
    P.composer(s)

    s = section(comps2, "Threads", "A thread row shows its color, size and note, and whether it is drawn on the text.",
                w=520)
    P.thread_row(s, "Phinehas", "threadA", 25, "Every verse that names Phinehas in the KJV: 25 mentions in 24 verses, "
                 "eight books, none in the New Testament.")
    P.thread_row(s, "Phinehas echoes", "threadB", 14, "Places that share wording with the Phinehas record, each "
                 "found with uses, near or a phrase search.", shown=False)
    P.member_row(s, "Numbers 25:7", verse("num25", 7))
    P.member_row(s, "Psalms 106:30", verse("ps106", 30))

    s = section(comps2, "Pane chrome and the hover card (desktop)", "Docked panes share a column as tabs; the group "
                "has minimize, float and close. Hover stays on the desktop, beside the tap.", w=640)
    ph = col(s, "pane", gap=0, fill="surface", radius=10, stroke="line", sw=1, clip=True)
    P.pane_header(ph, ["Notebook", "Phinehas", "H7065"], "Notebook")
    body = col(ph, "pane body", gap=10, pad=14)
    P.segmented(body, ["Journal", "Inbox", "All notes"], "Inbox", badges={"Inbox": 2})
    hc = col(s, "hover holder", gap=0, W="hug")
    P.hover_card(hc, 0, 0, "Psalms 106:30–31 · KJV", lambda card: [
        para(card, f"{v['v']} {v['text']}", "readSmall") for v in vv("ps106", 30, 31)], w=440)

    s = section(comps2, "Capture, by touch", "The capture box keeps its language for a keyboard; a phone gets a "
                "palette: quick actions first, then suggestions as words are typed.", w=520)
    pal = col(s, "palette", gap=12, pad=14, fill="bg", radius=14, stroke="line", sw=1)
    r = row(pal, "anchor", gap=8)
    text(r, "At", "small", "muted")
    P.chip(r, "Numbers 25:11", "place", icon_name="place")
    P.field(pal, "", "uses zea", icon_name="capture")
    for cmd, about in (("uses zealous", "every verse with the English word"),
                       ("uses H7065", "every use of qânâʼ, by Strong's number"),
                       ("uses zeal* in Numbers", "the word and its forms, in one book")):
        r = row(pal, f"suggestion/{cmd}", gap=10, pad=[8, 4, 8, 4], W="fill")
        icon(r, "search", 18, "muted")
        cc = col(r, "text", gap=0, W="fill")
        text(cc, cmd, "bodyStrong")
        text(cc, about, "small", "muted")

    # e-ink check
    text(cv, "One system, three modes", "display", fontSize=32, lineHeight="40px")
    para(cv, "The same reader and verse sheet in each mode. This is a check of the tokens, not the e-reader layout: "
         "that waits until a device is chosen (docs/archive/2026-11-10/design/e-reader.md).", "body", "muted")
    modes = row(cv, "mode check", gap=40, align="min")
    for m in F.MODES:
        f = col(modes, f"reader/{m}", gap=12, pad=24, fill="bg", radius=16, stroke="line", sw=1, W="fixed")
        S.do("node.set", {"ids": [f], "props": {"width": 560}}, ref=False)
        text(f, m, "label")
        text(f, "Numbers 25", "chapter")
        F.verses(f, vv("num25", 9, 13), "readEink" if m == "E-ink" else "readPhone", NUM25_MARKS, paragraphs=(10,),
                 eink=m == "E-ink")
        sh = col(f, "verse sheet", gap=10, pad=16, fill="surface", radius=14, stroke="line", sw=1 if m != "E-ink" else 2)
        text(sh, "Numbers 25:11", "title")
        P.color_row(sh, "hlGreen", size=30)
        r = row(sh, "actions", gap=6, W="fill")
        for lbl, ic in (("Note", "pen"), ("Thread", "threads"), ("Interlinear", "interlinear"), ("Listen", "listen")):
            P.action_tile(r, lbl, ic)
        mode(f, m)


# ==== page 2: phone ======================================================================================================
PW, PH = 390, 844


def phone(parent, name, m="Light", w=PW, h=PH):
    f = frame(parent, f"Phone · {name}", w=w, h=h, fill="bg", radius=36, stroke="line", sw=1, W="fixed", H="fixed", clip=True)
    if m != "Light":
        mode(f, m)
    if w < h:  # landscape hides the status bar
        P.status_bar(f, w)
    return f


def body(f, y=99, h=PH - 99 - 84, w=PW, pad=16, gap=12, name="content"):
    return frame(f, name, x=0, y=y, w=w, h=h, layout="vertical", gap=gap, pad=[12, pad, 16, pad], W="fixed",
                 H="fixed", clip=True)


def place(node, x, y):
    S.do("node.set", {"ids": [node], "props": {"x": x, "y": y}}, ref=False)


def caption_under(parent, title, about, w=PW):
    cap = col(parent, f"about/{title}", gap=4, W="fixed")
    S.do("node.set", {"ids": [cap], "props": {"width": w}}, ref=False)
    text(cap, title, "heading")
    para(cap, about, "small", "muted")
    return cap


TITLES = {"Phone": [], "Desktop and laptop": []}


def screen(rowf, title, about, m="Light", w=PW, h=PH):
    TITLES["Phone"].append(title)
    holder = col(rowf, f"screen/{title}", gap=14, W="hug")
    f = phone(holder, title, m, w, h)
    caption_under(holder, title, about, w)
    return f


def reader_screen(f, selection=False, marks=NUM25_MARKS, first=6, last=13):
    tb = P.top_bar(f, "Numbers 25", None, ["listen", "search", "type"], title_icon="down")
    place(tb, 0, 47)
    b = body(f, pad=20, gap=6)
    text(b, "Numbers 25", "chapter")
    F.verses(b, vv("num25", first, last), "readPhone", marks, paragraphs=(6, 10),
             selected=(11, 18, 21) if selection else None)
    tabs = P.tab_bar(f, "Read")
    place(tabs, 0, PH - 84)
    return b


def phone_page():
    cv = canvas("Phone", 4700)
    sheet_title(cv, "Phone", "Portrait first. The reader is the base of a single stack: everything else is a tab, a "
                "sheet over the reader, or a full screen with a way back to the place. Five tabs: Read, Notebook, "
                "Threads, Study, More. Desktop work (documents, many panes) is listed and opened here, built there.")

    # -- reading
    text(cv, "Read", "display", fontSize=32, lineHeight="40px")
    r = row(cv, "read", gap=48, align="min")
    f = screen(r, "Reader", "Highlights, the Phinehas thread underline, dotted note cues and a ? on 25:9. Swipe "
               "sideways for the next chapter; the title opens the book and chapter picker; the pen is capture.")
    reader_screen(f)
    P.fab(f, PW - 72, PH - 84 - 72)

    f = screen(r, "Select words", "Long-press a word and drag the handles. The bar above the words colors them in "
               "one tap, or writes a note, adds to a thread, looks up, copies.")
    reader_screen(f, selection=True)
    P.selection_bar(f, 16, 440)

    f = screen(r, "Tap a verse number", "The verse sheet replaces the hover card and the notes pane on a phone: the "
               "verse, its color, its notes, its threads and what to do next. Drag up for the whole sheet.")
    reader_screen(f)
    P.scrim(f)
    sh = P.sheet(f, 300, "Numbers 25:11", h=PH - 300, subtitle="KJV")
    para(sh, verse("num25", 11), "readSmall")
    P.color_row(sh, "hlGreen", size=34)
    P.note_card(sh, "Same verb (H7065) for Phinehas and for the LORD: 'zealous for my sake' / 'in my jealousy' "
                "(H7068).", "Numbers 25:11", "Sun", compact=True)
    tr = row(sh, "threads", gap=8)
    text(tr, "In", "small", "muted")
    P.chip(tr, "Phinehas", "outline", dot_color="threadA")
    acts = frame(sh, "actions", layout="grid", gridColumns=4, gap=8, crossGap=8, W="fill", H="hug")
    for lbl, ic in (("Note", "pen"), ("Question", "question"), ("Thread", "threads"), ("Copy", "copy"),
                    ("Compare YLT", "interlinear"), ("Interlinear", "word"), ("Listen", "listen"), ("Open", "plus")):
        P.action_tile(acts, lbl, ic)

    f = screen(r, "Tap a word", "The word sheet is the lexicon hover card: Strong's own words, the count, and the "
               "ways on (every use, the interlinear, a note on the word itself).")
    reader_screen(f, marks={**NUM25_MARKS, 11: {**NUM25_MARKS[11], "note": [], "hl": "green"}})
    P.scrim(f)
    sh = P.sheet(f, 360, "zealous", h=PH - 360, subtitle="Numbers 25:11, word 21")
    P.lexicon_block(sh, C["lexicon"]["H7065"], C["count"]["H7065"])
    r2 = row(sh, "actions", gap=8, W="fill")
    P.button(r2, "Every use", "primary", "list", W="fill")
    P.button(r2, "Interlinear", "secondary", "interlinear", W="fill")
    P.button(sh, "Note on H7065 everywhere", "soft", "pen", W="fill")

    f = screen(r, "Reader, dark", "The same screen in the Dark mode of every token.", m="Dark")
    reader_screen(f)
    P.fab(f, PW - 72, PH - 84 - 72)

    f = screen(r, "Landscape", "Wider than tall: the reader and one side panel, here the Notebook, the way the "
               "desktop docks a pane.", w=PH, h=PW)
    tb = P.top_bar(f, "Numbers 25", None, ["notebook", "search", "type"], w=PH, title_icon="down")
    place(tb, 0, 18)
    S.do("node.set", {"ids": [tb], "props": {"height": 44}}, ref=False)
    b = frame(f, "reader", x=0, y=62, w=480, h=PW - 62, layout="vertical", gap=6, pad=[8, 28, 8, 40], W="fixed",
              H="fixed", clip=True)
    F.verses(b, vv("num25", 10, 13), "readPhone", NUM25_MARKS)
    side = frame(f, "notebook panel", x=480, y=62, w=PH - 480, h=PW - 62, fill="surface", layout="vertical", gap=10,
                 pad=[10, 14, 10, 14], W="fixed", H="fixed", clip=True, stroke="line", strokeLeftWeight=1,
                 strokeTopWeight=0, strokeRightWeight=0, strokeBottomWeight=0)
    P.segmented(side, ["Journal", "Inbox", "All notes"], "Journal", badges={"Inbox": 2})
    P.note_card(side, "Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.", "Numbers 25:13",
                "14:02", compact=True)

    # -- notebook
    text(cv, "Notebook", "display", fontSize=32, lineHeight="40px")
    para(cv, "The home tab for writing. One kind of note, three views. A note with no place is kept in "
         "notes/_inbox/ and stays out of the reader until it is placed.", "body", "muted")
    r = row(cv, "notebook", gap=48, align="min")

    def notebook(f, active):
        tb = P.top_bar(f, "Notebook", None, ["search", "filter"], big=True)
        place(tb, 0, 47)
        S.do("node.set", {"ids": [tb], "props": {"height": 56}}, ref=False)
        seg = frame(f, "views", x=16, y=106, w=PW - 32, h=44, layout="horizontal", W="fixed", H="hug")
        P.segmented(seg, ["Journal", "Inbox", "All notes"], active, badges={"Inbox": 2})
        b = body(f, y=156, h=PH - 156 - 84, gap=12)
        tabs = P.tab_bar(f, "Notebook")
        place(tabs, 0, PH - 84)
        return b

    f = screen(r, "Journal", "Every note by the day it was written, newest first. Placed notes show their place; "
               "jots and questions wait with Place it. The box at the foot of today writes a new entry.")
    b = notebook(f, "Journal")
    P.day_head(b, "Today · Monday 2 November")
    P.note_card(b, "Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.", "Numbers 25:13", "14:02")
    P.note_card(b, INBOX[0][1], None, INBOX[0][2], "question", compact=True)
    P.note_card(b, INBOX[1][1], None, INBOX[1][2], "jot", compact=True)
    comp = P.composer(f, hint=False, W="fixed")
    S.do("node.set", {"ids": [comp], "props": {"x": 12, "y": PH - 84 - 108, "width": PW - 24}}, ref=False)

    f = screen(r, "Inbox", "Only the notes with no place. A note that names a reference offers that place first "
               "(1 Cor 10:8 here). Placed, it becomes an ordinary note in the reader, My notes and documents.")
    b = notebook(f, "Inbox")
    for kind, body_, t in INBOX:
        P.note_card(b, body_, None, f"Today {t}", kind)
    para(b, "A question stays a question once placed: it shows as ? on its verse until marked answered.", "small",
         "muted")

    f = screen(r, "Place it", "Three ways to a place: the one the note names, the one being read, or one typed. "
               "Phase two adds the reader's selection and dragging onto a verse on the desktop.")
    notebook(f, "Inbox")
    P.scrim(f)
    sh = P.sheet(f, 250, "Place this note", h=PH - 250)
    para(sh, INBOX[0][1], "body", "muted", maxLines=2)
    P.label(sh, "Named in the note")
    opt = col(sh, "named", gap=6, pad=12, fill="accentSoft", radius=12, stroke="accent", sw=1.5)
    rr = row(opt, "head", gap=8, W="fill")
    text(rr, "1 Corinthians 10:8", "bodyStrong")
    spacer(rr)
    icon(rr, "check", 20, "accent", weight=2.2)
    para(opt, verse("cor10", 8), "readSmall", maxLines=3)
    P.label(sh, "Where you are reading")
    opt = col(sh, "reading", gap=6, pad=12, radius=12, stroke="line", sw=1)
    text(opt, "Numbers 25:9", "bodyStrong")
    para(opt, verse("num25", 9), "readSmall")
    P.field(sh, "Type a place: Num 25:9, Psalm 106:30", None, icon_name="place")
    P.button(sh, "Place on 1 Corinthians 10:8", "primary", "place", size="lg", W="fill")

    f = screen(r, "All notes", "Placed notes in Bible order, with a filter. Each opens its place in the reader.")
    b = notebook(f, "All notes")
    P.field(b, "Filter your notes", None, icon_name="filter")
    for book, items in (("Numbers", (("25:8", "Word study: 'tent' (H6898 qubbah) and 'belly' (H6897 qobah) each "
                                      "occur only here.", verse("num25", 8)),
                                     ("25:11", "Same verb (H7065) for Phinehas and for the LORD.",
                                      verse("num25", 11)),
                                     ("25:13", "Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.",
                                      verse("num25", 13)))),
                        ("1 Samuel", (("4:17", "Word study: 'slaughter' is H4046 (maggephah), the same noun as the "
                                       "plague of Num 25:8-9.", verse("sam4", 17)),))):
        P.label(b, book)
        for ref, note, q in items:
            P.note_card(b, note, f"{book} {ref}", None, quote=q, compact=True)

    f = screen(r, "A reference in a note", "A reference written in a note is a link: a tap shows the verse in a "
               "sheet (the hover card again), with Open and Place it here.")
    b = notebook(f, "Inbox")
    for kind, body_, t in INBOX[:1]:
        P.note_card(b, body_, None, f"Today {t}", kind)
    P.scrim(f)
    sh = P.sheet(f, 470, "1 Corinthians 10:8", h=PH - 470, subtitle="KJV · from a link in a note")
    para(sh, verse("cor10", 8), "readSmall")
    rr = row(sh, "actions", gap=8, W="fill")
    P.button(rr, "Open in the reader", "secondary", "book", W="fill")
    P.button(rr, "Place it here", "primary", "place", W="fill")

    # -- study
    text(cv, "Study", "display", fontSize=32, lineHeight="40px")
    r = row(cv, "study", gap=48, align="min")

    f = screen(r, "Capture palette", "The capture box by touch, anchored to the verse. Quick actions first; typed "
               "words become suggestions from the same command language the desktop uses.")
    reader_screen(f)
    P.scrim(f)
    stack = frame(f, "palette and keyboard", x=0, y=120, w=PW, h=PH - 120, layout="vertical", mainAlign="max",
                  W="fixed", H="fixed")
    pal = col(stack, "palette", gap=12, pad=[14, 16, 16, 16], fill="surface", radius=[20, 20, 0, 0])
    rr = row(pal, "anchor", gap=8, W="fill")
    text(rr, "At", "small", "muted")
    P.chip(rr, "Numbers 25:11", "place", icon_name="place")
    spacer(rr)
    text(rr, "change", "smallStrong", "accent")
    P.field(pal, "", "uses zea", icon_name="capture")
    for cmd, about in (("uses zealous", "every verse with the English word"),
                       ("uses H7065", "every use of qânâʼ, by Strong's number"),
                       ("uses zeal* in Numbers", "the word and its forms, in one book")):
        sr = row(pal, f"suggestion/{cmd}", gap=10, pad=[6, 2, 6, 2], W="fill")
        icon(sr, "search", 18, "muted")
        cc = col(sr, "text", gap=0, W="fill")
        text(cc, cmd, "bodyStrong")
        text(cc, about, "small", "muted")
    qa = row(pal, "quick actions", gap=6, W="fill")
    for lbl, ic in (("Jot", "pen"), ("Question", "question"), ("Highlight", "highlight"), ("Thread", "threads"),
                    ("Open", "book")):
        P.action_tile(qa, lbl, ic)
    kb = frame(stack, "keyboard", w=PW, h=290, fill="sunken", layout="vertical", mainAlign="center",
               crossAlign="center", W="fixed", H="fixed")
    text(kb, "keyboard", "small", "muted")

    f = screen(r, "Search", "Search, word study and your own notes behind one field. Counts first, then every "
               "verse, the match in bold. A result opens in the reader.")
    tb = P.top_bar(f, "Study", None, [], big=True)
    place(tb, 0, 47)
    b = body(f, y=103, h=PH - 103 - 84)
    P.field(b, "", "phinehas", trailing="25 in 24 verses")
    P.segmented(b, ["Text", "Words", "My notes"], "Text")
    cr = row(b, "books", gap=6)
    P.chip(cr, "All 8 books", "selected")
    P.chip(cr, "Numbers 9", "outline")
    P.chip(cr, "1 Samuel 7", "outline")
    for ref, key, n in (("Exodus 6:25", "exo6", 25), ("Numbers 25:7", "num25", 7), ("Numbers 25:11", "num25", 11),
                        ("Judges 20:28", "judg20", 28), ("1 Chronicles 9:20", "chr9", 20)):
        P.verse_line(b, ref, verse(key, n), emph=["Phinehas"])
    tabs = P.tab_bar(f, "Study")
    place(tabs, 0, PH - 84)

    f = screen(r, "Every use", "uses H7065 against the English “zealous”: where they agree and where they part, "
               "with the counts the desktop shows. Chips filter.")
    tb = P.top_bar(f, "Every use", "back", ["filter"], subtitle="H7065 qânâʼ · zealous")
    place(tb, 0, 47)
    b = body(f, y=103, h=PH - 103 - 84)
    cr = row(b, "kinds", gap=6)
    P.chip(cr, "Both 2", "selected")
    P.chip(cr, "Only H7065 31", "outline")
    P.chip(cr, "Only zealous 6", "outline")
    P.verse_line(b, "Numbers 25:11", verse("num25", 11), "both", "place", emph=["zealous"])
    P.verse_line(b, "Numbers 25:13", verse("num25", 13), "both", "place", emph=["zealous"])
    P.verse_line(b, "Numbers 5:14", verse("num5", 14), "only H7065", emph=["jealous"])
    P.verse_line(b, "Acts 21:20", verse("acts21", 20), "only zealous", emph=["zealous"])
    rp = P.return_pill(f, "Numbers 25:11")
    place(rp, 90, PH - 84 - 64)
    tabs = P.tab_bar(f, "Study")
    place(tabs, 0, PH - 84)

    f = screen(r, "Interlinear", "A pane on a phone is a full screen in the stack, with the place it came from kept "
               "in a pill at the foot: one tap goes back to the verse, scrolled where it was.")
    tb = P.top_bar(f, "Interlinear", "back", ["type"], subtitle="Numbers 25:11 · Hebrew, right to left")
    place(tb, 0, 47)
    b = body(f, y=103, h=PH - 103 - 84)
    words = C["interlinear"][:12]
    for i in range(0, 12, 3):
        rr = row(b, "line", gap=8, W="fill", align="min")
        for w in reversed(words[i:i + 3]):
            P.interlinear_cell(rr, w)
    rp = P.return_pill(f, "Numbers 25:11")
    place(rp, 90, PH - 84 - 64)
    tabs = P.tab_bar(f, "Read")
    place(tabs, 0, PH - 84)

    # -- threads and the rest
    text(cv, "Threads, documents, more", "display", fontSize=32, lineHeight="40px")
    r = row(cv, "threads", gap=48, align="min")

    f = screen(r, "Threads", "The thread list, searchable. The eye draws a thread on the text (a layer), so the "
               "Layers menu is this list on a phone.")
    tb = P.top_bar(f, "Threads", None, ["search", "plus"], big=True)
    place(tb, 0, 47)
    S.do("node.set", {"ids": [tb], "props": {"height": 56}}, ref=False)
    b = body(f, y=106, h=PH - 106 - 84)
    P.thread_row(b, "Phinehas", "threadA", 25, "Every verse that names Phinehas in the KJV: 25 mentions in 24 verses, "
                 "eight books, none in the New Testament.")
    P.thread_row(b, "Phinehas echoes", "threadB", 14, "Places that share wording with the Phinehas record, each "
                 "found with uses, near or a phrase search.", shown=False)
    P.label(b, "Sets")
    P.thread_row(b, "Phinehas study", "muted", 6, "2 threads, a lesson, 2 places", shown=False)
    tabs = P.tab_bar(f, "Threads")
    place(tabs, 0, PH - 84)

    f = screen(r, "A thread", "Its color, its note and its places, each with the verse. Drag to reorder. A place "
               "opens in the reader with the thread drawn.")
    tb = P.top_bar(f, "Phinehas", "back", ["eye", "more"], subtitle="25 places · drawn on the text")
    place(tb, 0, 47)
    b = body(f, y=103, h=PH - 103 - 84, gap=8)
    para(b, "Every verse that names Phinehas in the KJV: 25 mentions in 24 verses, eight books, none in the New "
         "Testament.", "small", "muted", maxLines=3)
    for ref, key, n in (("Exodus 6:25", "exo6", 25), ("Numbers 25:7", "num25", 7), ("Numbers 25:11", "num25", 11),
                        ("Joshua 22:31", "josh22", 31), ("Judges 20:28", "judg20", 28)):
        P.member_row(b, ref, verse(key, n))
    tabs = P.tab_bar(f, "Threads")
    place(tabs, 0, PH - 84)

    f = screen(r, "Documents", "Slides and Word files are made on the desktop with the Craft apps. The phone lists "
               "them, opens their PDFs, and can ask the desktop to bring one up to date.")
    tb = P.top_bar(f, "Documents", "back", [])
    place(tb, 0, 47)
    b = body(f, y=103, h=PH - 103 - 84)
    banner = row(b, "connection", gap=10, pad=12, fill="sunken", radius=12, W="fill")
    icon(banner, "desktop", 22, "ok")
    para(banner, "Desktop connected on the home network", "small")
    for title, about, ok in (("Pulpit — Phinehas: The Whole Record", "Slides · Pulpit · Vigil · 117 slides", True),
                             ("Speaker Script — Phinehas: The Whole Record", "Word · Script · 35 pages", False)):
        card = col(b, f"doc/{title}", gap=8, pad=14, fill="surface", radius=12, stroke="line", sw=1)
        hr = row(card, "head", gap=10, W="fill", align="min")
        icon(hr, "docs", 24, "accent")
        cc = col(hr, "text", gap=2, W="fill")
        para(cc, title, "bodyStrong")
        text(cc, about, "small", "muted")
        st = row(card, "status", gap=6)
        F.dot(st, "ok" if ok else "warn", 8)
        text(st, "Up to date" if ok else "The lesson changed since this was made", "caption", "ok" if ok else "warn")
        ar = row(card, "actions", gap=8)
        P.button(ar, "Open PDF", "secondary", "pdf", size="sm")
        if not ok:
            P.button(ar, "Rebuild on the desktop", "soft", "sync", size="sm")
    tabs = P.tab_bar(f, "More")
    place(tabs, 0, PH - 84)

    f = screen(r, "Book and chapter", "The title of the reader opens this: books by testament, then chapters. "
               "Typing a place (Num 25:11) works too.")
    tb = P.top_bar(f, "Go to", "close", [])
    place(tb, 0, 47)
    b = body(f, y=103, h=PH - 103)
    P.field(b, "Num 25:11, Psalm 106, Jude 1:5", None, icon_name="book")
    P.label(b, "Law")
    g = frame(b, "books", layout="grid", gridColumns=3, gap=8, crossGap=8, W="fill", H="hug")
    for bk in ("Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"):
        on = bk == "Numbers"
        t = row(g, bk, pad=[10, 8, 10, 8], radius=10, fill="accentSoft" if on else "surface",
                stroke="accent" if on else "line", sw=1, mainAlign="center", W="fill")
        text(t, bk, "smallStrong" if on else "small", "fg")
    P.label(b, "Numbers · 36 chapters")
    g = frame(b, "chapters", layout="grid", gridColumns=6, gap=6, crossGap=6, W="fill", H="hug")
    for n in range(1, 37):
        on = n == 25
        t = row(g, str(n), pad=[9, 0, 9, 0], radius=8, fill="accent" if on else "sunken", mainAlign="center", W="fill")
        text(t, str(n), "smallStrong", "onAccent" if on else "fg")

    f = screen(r, "More", "Settings and the rest of the toolbar's More menu, in one list.")
    tb = P.top_bar(f, "More", None, [], big=True)
    place(tb, 0, 47)
    S.do("node.set", {"ids": [tb], "props": {"height": 56}}, ref=False)
    b = body(f, y=106, h=PH - 106 - 84, gap=4)
    P.label(b, "Reading")
    for lbl, val, ic in (("Text size", "110%", "type"), ("Appearance", "Light · Dark · E-ink", "sun"),
                         ("Highlights and layers", "Mine, Phinehas", "layers"), ("Read aloud", "", "listen")):
        rr = row(b, lbl, gap=12, pad=[12, 4, 12, 4], W="fill")
        icon(rr, ic, 22, "fg")
        text(rr, lbl, "body", W="fill")
        text(rr, val, "small", "muted")
        icon(rr, "right", 16, "muted")
    P.label(b, "Study")
    for lbl, val, ic in (("Shelf (sets)", "1", "shelf"), ("Documents", "2", "docs"), ("Today's log", "", "list"),
                         ("PDFs", "", "pdf")):
        rr = row(b, lbl, gap=12, pad=[12, 4, 12, 4], W="fill")
        icon(rr, ic, 22, "fg")
        text(rr, lbl, "body", W="fill")
        text(rr, val, "small", "muted")
        icon(rr, "right", 16, "muted")
    P.label(b, "This phone")
    for lbl, val, ic in (("Study data", "Synced 2 min ago", "sync"), ("Help", "", "question")):
        rr = row(b, lbl, gap=12, pad=[12, 4, 12, 4], W="fill")
        icon(rr, ic, 22, "fg")
        text(rr, lbl, "body", W="fill")
        text(rr, val, "small", "muted")
        icon(rr, "right", 16, "muted")
    tabs = P.tab_bar(f, "More")
    place(tabs, 0, PH - 84)


# ==== page 3: desktop and laptop ==========================================================================================
def window(parent, title, about, w, h, m="Light"):
    TITLES["Desktop and laptop"].append(title)
    holder = col(parent, f"window/{title}", gap=14, W="hug")
    f = frame(holder, f"Window · {title}", w=w, h=h, fill="bg", radius=10, stroke="line", sw=1, W="fixed", H="fixed", clip=True)
    shadow(f, 10, 40, "#00000022")
    if m != "Light":
        mode(f, m)
    cap = col(holder, "about", gap=4, W="fixed")
    S.do("node.set", {"ids": [cap], "props": {"width": min(w, 1100)}}, ref=False)
    text(cap, title, "heading")
    para(cap, about, "small", "muted")
    return f


def desk_reader(f, x, y, w, h, first=6, last=15, sel=None, marks=NUM25_MARKS):
    rd = frame(f, "reader", x=x, y=y, w=w, h=h, layout="vertical", crossAlign="center", pad=[32, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    colw = min(680, w - 64)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": colw}}, ref=False)
    text(inner, "Numbers 25", "chapter", fontSize=30, lineHeight="40px")
    F.verses(inner, vv("num25", first, last), "readDesk", marks, paragraphs=(6, 10, 14), selected=sel)
    return rd


def dock(f, x, y, w, h, tabs, active, side="right"):
    d = frame(f, f"dock/{active}", x=x, y=y, w=w, h=h, fill="surface", layout="vertical", W="fixed", H="fixed",
              clip=True, stroke="line", strokeLeftWeight=1 if side == "right" else 0,
              strokeRightWeight=1 if side == "left" else 0, strokeTopWeight=0, strokeBottomWeight=0)
    P.pane_header(d, tabs, active)
    b = col(d, "pane body", gap=12, pad=16, W="fill", H="fill", clip=True)
    return b


def journal_pane(b, composer=True):
    P.segmented(b, ["Journal", "Inbox", "All notes"], "Journal", badges={"Inbox": 2})
    P.day_head(b, "Today · Monday 2 November")
    P.note_card(b, "Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.", "Numbers 25:13", "14:02")
    P.note_card(b, INBOX[0][1], None, INBOX[0][2], "question")
    P.note_card(b, INBOX[1][1], None, INBOX[1][2], "jot", compact=True)
    P.note_card(b, "Word study: 'tent' (H6898 qubbah) and 'belly' (H6897 qobah) each occur only here.",
                "Numbers 25:8", "13:12")
    P.day_head(b, "Sunday 1 November")
    P.note_card(b, "H6419 is mostly 'pray' in the KJV. Is Phinehas here judging, interceding, or both?",
                "Psalms 106:30", "21:40", "question", compact=True)
    if composer:
        spacer(b)


def desktop_page():
    cv = canvas("Desktop and laptop", 3600)
    sheet_title(cv, "Desktop and laptop", "Today's window, refined. One row of toolbar as now; the capture box and "
                "search become one command field; the Notebook docks beside the reader as the main side pane; "
                "hover cards stay. Checked at 1440 and 1280 (laptop) and 1920 (a large monitor).")
    r = row(cv, "row 1", gap=64, align="min")

    W1, H1 = 1440, 900
    f = window(r, "1440 · Reader with the Notebook", "The reader keeps its 680 px column; the Notebook takes a "
               "420 px column on the right with the other docked panes as tabs. The composer is pinned under today, "
               "anchored to the verse last clicked. A hover card shows the word under the pointer.", W1, H1)
    P.desktop_toolbar(f, W1)
    desk_reader(f, 0, 48, W1 - 420, H1 - 48)
    b = dock(f, W1 - 420, 48, 420, H1 - 48, ["Notebook", "H7065"], "Notebook")
    journal_pane(b)
    comp = P.composer(f, hint=True, W="fixed")
    S.do("node.set", {"ids": [comp], "props": {"x": W1 - 420 + 16, "y": H1 - 120, "width": 388}}, ref=False)
    P.hover_card(f, 330, 470, "zealous · Numbers 25:11 · hover", lambda card: P.lexicon_block(
        card, C["lexicon"]["H7065"], C["count"]["H7065"]), w=400)

    f = window(r, "1440 · Command field open", "Backtick or a click opens one field for search, places and the "
               "capture language. It is anchored to the verse; suggestions are grouped; the reader stays put.", W1, H1)
    P.desktop_toolbar(f, W1, command_value="uses zea")
    desk_reader(f, 0, 48, W1 - 420, H1 - 48)
    b = dock(f, W1 - 420, 48, 420, H1 - 48, ["Notebook", "H7065"], "Notebook")
    journal_pane(b)
    rect(f, "scrim", W1, H1 - 48, "scrim", x=0, y=48, opacity=0.5)
    pal = col(f, "command palette", gap=4, pad=[10, 10, 10, 10], fill="surface", radius=12, stroke="line", sw=1,
              x=300, y=56, W="fixed")
    S.do("node.set", {"ids": [pal], "props": {"width": 620}}, ref=False)
    F.shadow(pal, 16, 40, "#00000040")
    rr = row(pal, "anchor", gap=8, pad=[4, 6, 8, 6], W="fill")
    text(rr, "At", "small", "muted")
    P.chip(rr, "Numbers 25:11", "place", icon_name="place")
    spacer(rr)
    text(rr, "click a word or verse number to change", "caption", "muted")
    for group, items in (("Commands", (("uses zealous", "every verse with the English word", "Enter"),
                                       ("uses H7065", "every use of qânâʼ by Strong's number", ""),
                                       ("uses zeal* Num", "the word and its forms in Numbers", ""))),
                         ("Your threads", (("+Phinehas", "add Numbers 25:11 to Phinehas", ""),)),
                         ("Search the KJV", (("“zea”", "words that begin with zea", ""),))):
        P.label(pal, group)
        for i, (cmd, about, key) in enumerate(items):
            on = group == "Commands" and i == 0
            sr = row(pal, f"suggestion/{cmd}", gap=10, pad=[8, 10, 8, 10], radius=8, fill="accentSoft" if on else None,
                     W="fill")
            icon(sr, "capture" if group == "Commands" else "threads" if group == "Your threads" else "search", 18,
                 "accent" if on else "muted")
            text(sr, cmd, "bodyStrong")
            text(sr, about, "small", "muted", W="fill")
            if key:
                P.kbd(sr, key)

    r = row(cv, "row 2", gap=64, align="min")
    W2, H2 = 1280, 800
    f = window(r, "1280 · Laptop, placing a note", "On a laptop the dock is 380 px and drops Shelf and Documents into "
               "More. Inbox: a note is placed on the reader's selection (verse 9), or dragged onto a verse.", W2, H2)
    P.desktop_toolbar(f, W2)
    desk_reader(f, 0, 48, W2 - 380, H2 - 48, first=6, last=13, sel=(9, 0, 13))
    b = dock(f, W2 - 380, 48, 380, H2 - 48, ["Notebook", "Phinehas", "Every use"], "Notebook")
    P.segmented(b, ["Journal", "Inbox", "All notes"], "Inbox", badges={"Inbox": 2})
    card = P.note_card(b, INBOX[0][1], None, "Today 13:47", "question")
    P.note_card(b, INBOX[1][1], None, "Today 13:30", "jot")
    pop = col(f, "place it popover", gap=8, pad=12, fill="surface", radius=12, stroke="line", sw=1, x=W2 - 380 - 320,
              y=250, W="fixed")
    S.do("node.set", {"ids": [pop], "props": {"width": 300}}, ref=False)
    F.shadow(pop, 10, 30, "#00000033")
    text(pop, "Place this note on", "caption", "muted")
    for lbl, sub, on in (("Numbers 25:9", "selected in the reader", True), ("1 Corinthians 10:8", "named in the note",
                                                                              False)):
        o = row(pop, lbl, gap=8, pad=10, radius=8, fill="accentSoft" if on else None, W="fill")
        icon(o, "place", 18, "accent" if on else "muted")
        cc = col(o, "t", gap=0, W="fill")
        text(cc, lbl, "bodyStrong")
        text(cc, sub, "caption", "muted")
    P.field(pop, "Another place…", None, icon_name="place", height=36)

    f = window(r, "1280 · Laptop, a thread", "A thread docked as a tab: drawn on the text while open, its places "
               "listed with their verses, and “where these words occur” below.", W2, H2)
    P.desktop_toolbar(f, W2, active="Threads")
    desk_reader(f, 0, 48, W2 - 380, H2 - 48)
    b = dock(f, W2 - 380, 48, 380, H2 - 48, ["Notebook", "Phinehas", "Every use"], "Phinehas")
    hr = row(b, "head", gap=10, W="fill")
    F.dot(hr, "threadA", 14)
    text(hr, "Phinehas", "title")
    spacer(hr)
    P.chip(hr, "Drawn", "selected", icon_name="eye")
    para(b, "Every verse that names Phinehas in the KJV: 25 mentions in 24 verses, eight books, none in the New "
         "Testament.", "small", "muted")
    for ref, key, n in (("Exodus 6:25", "exo6", 25), ("Numbers 25:7", "num25", 7), ("Numbers 25:11", "num25", 11),
                        ("Joshua 22:31", "josh22", 31)):
        P.member_row(b, ref, verse(key, n))

    r = row(cv, "row 3", gap=64, align="min")
    W3, H3 = 1920, 1080
    f = window(r, "1920 · Large monitor, three columns", "Room for a pane on each side: the interlinear on the "
               "left, All notes on the right, the reader between at its own width.", W3, H3)
    P.desktop_toolbar(f, W3, active="Notebook")
    lb = dock(f, 0, 48, 460, H3 - 48, ["Interlinear", "H7065"], "Interlinear", side="left")
    text(lb, "Numbers 25:11 · Hebrew, right to left", "small", "muted")
    words = C["interlinear"][:15]
    for i in range(0, 15, 3):
        rr = row(lb, "line", gap=8, W="fill", align="min")
        for w in reversed(words[i:i + 3]):
            P.interlinear_cell(rr, w)
    desk_reader(f, 460, 48, W3 - 460 - 440, H3 - 48, first=1, last=13)
    b = dock(f, W3 - 440, 48, 440, H3 - 48, ["Notebook", "Phinehas"], "Notebook")
    P.segmented(b, ["Journal", "Inbox", "All notes"], "All notes", badges={"Inbox": 2})
    P.field(b, "Filter your notes", None, icon_name="filter", height=38)
    P.label(b, "Numbers")
    for ref, note, q in (("25:8", "Word study: 'tent' (H6898 qubbah) and 'belly' (H6897 qobah) each occur only "
                          "here.", verse("num25", 8)),
                         ("25:11", "Same verb (H7065) for Phinehas and for the LORD: 'zealous for my sake' / 'in my "
                          "jealousy' (H7068).", verse("num25", 11)),
                         ("25:13", "Word study: H7065 is rendered 'zealous' only in Num 25:11 and 25:13.",
                          verse("num25", 13))):
        P.note_card(b, note, f"Numbers {ref}", None, quote=q, compact=True)
    P.label(b, "Psalms")
    P.note_card(b, "Word study: 'executed judgment' is H6419 (palal), rendered pray/prayed/praying/prayeth 74 of 84 "
                "times.", "Psalms 106:30", None, quote=verse("ps106", 30), compact=True)

    f = window(r, "1440 · Dark", "The first window in the Dark mode.", W1, H1, m="Dark")
    P.desktop_toolbar(f, W1)
    desk_reader(f, 0, 48, W1 - 420, H1 - 48)
    b = dock(f, W1 - 420, 48, 420, H1 - 48, ["Notebook", "H7065"], "Notebook")
    journal_pane(b)


def main():
    F.define_tokens()
    S.do("page.rename", {"name": "Design system"}, ref=False)
    design_system()
    F.page("Phone")
    phone_page()
    F.page("Desktop and laptop")
    desktop_page()

    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "workbench.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = find_cli()
    target = HERE / "workbench.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    OUT.mkdir(exist_ok=True)
    for name, slug in (("Design system", "design-system"), ("Phone", "phone"), ("Desktop and laptop", "desktop")):
        subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", name, "--out",
                        str(OUT / f"{slug}.png")], check=True)
    # each phone screen and desktop window on its own (phone at 2x)
    for page_name, slug, prefix, scale in (("Phone", "phone", "Phone · ", 2), ("Desktop and laptop", "desktop", "Window · ", 1)):
        folder = OUT / slug
        folder.mkdir(exist_ok=True)
        for title in TITLES[page_name]:
            file = folder / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
            subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", page_name, "--node", prefix + title,
                            "--scale", str(scale), "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
