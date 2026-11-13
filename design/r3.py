"""R3 of the debug round (docs/archive/2026-11-10/docs/debug-spec.md, finding 868e): the documents' new design, drawn with FigCraft as the filter
sheet was (it reuses phase2b.py's helpers). Nothing is built from these sheets until the person accepts them; the review
is docs/archive/2026-11-10/docs/redesign-R3.md.

    python design/r3.py     # writes design/r3.figcraft and design/exports/r3/*.png

The idea: the person prefers the in-app preview's look (ui/src/desk.css, .pd-pv-* and .dp-*), so the Word styles and the
slide boxes are designed FROM it: Inter for everything that is not scripture, Literata for scripture, one accent, white
paper. Every verse drawn comes from content.json (fetched from the database with wb text), never typed. Note lines on the
sheets are placeholders that say what goes there, never commentary. FigCraft's built-in serif (Merriweather) stands in
for Literata on the sheets, as on every other sheet (figlib.READ).
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
from figlib import S, col, frame, para, rect, row, spacer, text  # noqa: E402

BOARD = "Documents"
PG = "Documents, redesigned"
C = json.loads((HERE / "content.json").read_text(encoding="utf-8"))
ACCENT = "#8E1B14"      # the preview's accent (.pd-pv-num, .dp-SlideCue)
INK, MUTED, QUIET, RULE = "#222222", "#666666", "#777777", "#E4E0D8"

# Word, at 96 px to the inch: a Letter page is 816 x 1056, 1 pt = 4/3 px. Sizes below are the proposed Word styles in pt.
PX = 4 / 3
PAGE_W, PAGE_H, MARGIN = 816, 1056, 72 * PX     # 1-inch margins

STYLES = [  # name, family, weight, pt, line (x size), color, what for
    ("Title", F.UI, "Semi Bold", 20, 1.25, INK, "the source's name"),
    ("Subtitle", F.UI, "Regular", 10, 1.4, QUIET, "what it is, the date"),
    ("Heading 1", F.UI, "Semi Bold", 15, 1.3, INK, "a section, a page inside"),
    ("Heading 2", F.UI, "Semi Bold", 12, 1.3, INK, "a heading inside a section"),
    ("Slide Cue", F.UI, "Bold", 8.5, 1.4, ACCENT, "SLIDE 3 (Speaker Script only)"),
    ("Scripture Reference", F.UI, "Semi Bold", 10, 1.4, ACCENT, "Numbers 25:10-13"),
    ("Scripture", F.READ, "Regular", 12, 1.5, INK, "the verses, numbers in the accent"),
    ("Study Note", F.UI, "Regular", 10, 1.45, MUTED, "your note on a verse, indented"),
    ("Delivery Note", F.UI, "Italic", 10, 1.45, ACCENT, "a note to yourself while speaking"),
    ("Body", F.UI, "Regular", 11, 1.5, INK, "your paragraphs, lists, quotes"),
]


def st(parent, name, s, scale=1.0, color=None, **p):
    """Text in one of the proposed Word styles, at page scale (`scale` for the Speaker Script's large print)."""
    _, fam, weight, pt, lh, colr, _ = next(x for x in STYLES if x[0] == name)
    size = round(pt * scale * PX, 1)
    props = dict(fontFamily=fam, fontStyle=weight, fontSize=size, lineHeight=f"{round(size * lh)}px", fill=F.c(color or colr))
    if name == "Slide Cue":
        props.update(letterSpacing=0.8, textCase="upper")
    props.update(F._props(dict(W="fill", **p)))
    props.setdefault("textAutoResize", "height")
    return S.do("text.create", {"text": s, "x": 0, "y": 0, "props": props, "name": f"{name}: {s[:30]}", "parent": parent})


def verses_text(key, first, last):
    vs = [v for v in C[key]["verses"] if first <= v["v"] <= last]
    return vs


def scripture(parent, key, first, last, scale=1.0, size_pt=12, fam=None, color=INK, num=ACCENT, lh=1.5):
    """Verses as one wrapping paragraph each, the number in the accent (the preview's .pd-pv-num)."""
    size = round(size_pt * scale * PX, 1)
    box = col(parent, "Scripture", gap=round(size * 0.35))
    for v in verses_text(key, first, last):
        flow = frame(box, f"v{v['v']}", layout="horizontal", wrap=True, gap=0, crossGap=0, crossAlign="baseline",
                     W="fill", H="hug")
        S.do("text.create", {"text": f"{v['v']} ", "x": 0, "y": 0, "parent": flow, "name": "num",
                             "props": dict(fontFamily=F.UI, fontStyle="Bold", fontSize=round(size * 0.62, 1),
                                           lineHeight=f"{round(size * lh)}px", fill=F.c(num))})
        S.do("text.create", {"text": v["text"], "x": 0, "y": 0, "parent": flow, "name": "verse",
                             "props": dict(fontFamily=fam or F.READ, fontStyle="Regular", fontSize=size,
                                           lineHeight=f"{round(size * lh)}px", fill=F.c(color), sizingH="fill",
                                           textAutoResize="height")})
    return box


def ref(key, first, last):
    book = C[key]["ref"].split(":")[0]
    return f"{book}:{first}–{last}" if first != last else f"{book}:{first}"


def page(parent, title, about):
    f = Q.win(parent, PG, title, about, w=PAGE_W, h=PAGE_H)
    S.do("node.set", {"ids": [f], "props": {"fill": "#FFFFFF", "cornerRadius": 2}}, ref=False)
    body = frame(f, "page body", x=MARGIN, y=MARGIN, w=PAGE_W - 2 * MARGIN, h=PAGE_H - 2 * MARGIN, layout="vertical",
                 gap=10, W="fixed", H="fixed", clip=True)
    foot = frame(f, "footer", x=MARGIN, y=PAGE_H - MARGIN + 18, w=PAGE_W - 2 * MARGIN, h=20, layout="horizontal",
                 W="fixed", H="hug")
    S.do("text.create", {"text": "Page 1 of 3", "x": 0, "y": 0, "parent": foot, "name": "Footer",
                         "props": dict(fontFamily=F.UI, fontStyle="Regular", fontSize=12, lineHeight="16px",
                                       fill=F.c("#999999"))})
    return body


def rule(parent):
    rect(parent, "rule", 10, 1, RULE, W="fill")


def placeholder(parent, s, style="Study Note", scale=1.0):
    st(parent, style, s, scale)


# ---- slides -------------------------------------------------------------------------------------------------------------
SW, SH = 960, 540
THEMES = {  # paper, ink, accent, muted (from plan.rs's Vellum and Vigil; the white one is the preview's own)
    "Paper": ("#FFFFFF", INK, ACCENT, "#9A948A"),
    "Vigil": ("#0E1524", "#F4EFE3", "#D9B46A", "#7C8496"),
}


def slide(parent, title, about, theme="Paper"):
    paper, ink, acc, mut = THEMES[theme]
    f = Q.win(parent, PG, title, about, w=SW, h=SH)
    S.do("node.set", {"ids": [f], "props": {"fill": paper, "cornerRadius": 2}}, ref=False)
    return f, ink, acc, mut


def at(f, name, x, y, w, h, **p):
    return frame(f, name, x=x, y=y, w=w, h=h, layout="vertical", gap=6, W="fixed", H="fixed", clip=False, **p)


def stext(parent, s, size, color, fam=F.UI, weight="Regular", lh=1.25, **p):
    props = dict(fontFamily=fam, fontStyle=weight, fontSize=size, lineHeight=f"{round(size * lh)}px", fill=F.c(color),
                 sizingH="fill", textAutoResize="height")
    props.update(F._props(p))
    return S.do("text.create", {"text": s, "x": 0, "y": 0, "parent": parent, "name": s[:30], "props": props})


# ---- the sheets ---------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "Documents, redesigned", "R3 of the debug round (finding 868e): the person prefers the in-app "
                  "preview's look, so the Word file and the PDF slides are drawn from it: Inter for every word that is "
                  "not scripture, Literata for scripture, one accent, white paper, quiet notes. Word pages are Letter at "
                  "1-inch margins; slides 960 x 540. Scripture from content.json (wb text); note lines are placeholders.")

    # D1 the styles sheet -----------------------------------------------------------------------------------------------
    r = row(cv, "row 1", gap=64, align="min")
    body = page(r, "D1 · The Word styles", "Ten named styles, the same names as today (so Restyle in Word still works "
                "in one place), each in the preview's font, size and color. Character formatting is only the verse "
                "number (Inter Bold, the accent, superscript). The fonts are embedded in the file (see the review).")
    for name, fam, weight, pt, lh, colr, what in STYLES:
        line = row(body, f"style/{name}", gap=16, align="baseline", W="fill")
        meta = col(line, "meta", gap=2, W="fixed")
        S.do("node.set", {"ids": [meta], "props": {"width": 190}}, ref=False)
        stext(meta, name, 12, INK, weight="Semi Bold", lh=1.3)
        stext(meta, f"{'Literata' if fam == F.READ else 'Inter'} {weight} {pt} pt, {lh}", 10.5, QUIET, lh=1.3)
        sample = col(line, "sample", gap=0)
        if name == "Scripture":
            scripture(sample, "num25", 11, 11)
        else:
            st(sample, name, what)
        rule(body)

    # D2 a Speaker Script page --------------------------------------------------------------------------------------------
    body = page(r, "D2 · Speaker Script, page 1", "Large print (the styles at 14/12 = 1.17 x), the cue for each Pulpit "
                "slide in the margin's color, scripture in Literata with its reference above it, your notes under the verse "
                "they are on. This is the preview, as a Word page.")
    k = 14 / 12
    st(body, "Title", "Phinehas", k)
    st(body, "Subtitle", "A thread · Speaker Script · 9 November 2026", k)
    st(body, "Slide Cue", "Slide 2", k)
    st(body, "Scripture Reference", ref("num25", 10, 13), k)
    scripture(body, "num25", 10, 13, scale=k)
    placeholder(body, "Your note on verse 11 appears here, in your words, under the verse it is on.", scale=k)
    st(body, "Delivery Note", "A delivery note of yours, if the source has one.", k)
    st(body, "Slide Cue", "Slide 3", k)
    st(body, "Scripture Reference", ref("ps106", 30, 31), k)
    scripture(body, "ps106", 30, 31, scale=k)

    # D3 a Share Copy page (a page as the source) -------------------------------------------------------------------------
    r = row(cv, "row 2", gap=64, align="min")
    body = page(r, "D3 · Share Copy, from a page", "The same styles at 12 pt: what a page's blocks become. A heading is "
                "Heading 1, your paragraph is Body, a scripture block is a reference and its verses, a page inside is "
                "Heading 1 again. No cues, no notes: it is for someone else.")
    st(body, "Title", "Tuesday study")
    st(body, "Subtitle", "A page · Share Copy · 9 November 2026")
    st(body, "Heading 1", "A heading block")
    st(body, "Body", "A paragraph block: your own words, as you wrote them on the page. Lists, quotes and tables keep "
       "their shape; a to-do is left out unless switched on.")
    st(body, "Scripture Reference", ref("num25", 10, 13))
    scripture(body, "num25", 10, 13)
    st(body, "Heading 1", "A page inside this one")
    st(body, "Scripture Reference", ref("ps106", 30, 31))
    scripture(body, "ps106", 30, 31)

    # D4 the template builder --------------------------------------------------------------------------------------------
    f = Q.win(r, PG, "D4 · The template builder", "A template is a structure's choices, in a pane: the parts on the "
              "left (the order and what is in), the look on the right (one style at a time: font from the two, size, "
              "color from the theme), and the page drawn live from the source chosen at the top. Saved as one JSON file "
              "in settings/doc-templates/. The structure's own template is the starting point and cannot be lost.",
              w=PAGE_W + 480, h=PAGE_H)
    Q.toolbar(f, active="Notebook", inbox=None)
    left = frame(f, "builder", x=0, y=Q.TB, w=440, h=PAGE_H - Q.TB, fill="sunken", layout="vertical", gap=12,
                 pad=[16, 16, 16, 16], W="fixed", H="fixed", clip=True)
    P.pane_header(left, ["Documents", "Templates"], "Speaker Script, mine")
    text(left, "Made from", "label", "muted")
    P.field(left, "Thread: Phinehas", None, icon_name="threads", height=36)
    text(left, "Parts, in order", "label", "muted")
    for label, on in (("Title and subtitle", True), ("Slide cues", True), ("Scripture, with references", True),
                      ("Your notes on a verse", True), ("Delivery notes", True), ("Highlights as shading", False),
                      ("Room to write after each passage", False)):
        it = row(left, f"part/{label}", gap=10, pad=[8, 10, 8, 10], fill="bg", radius=8, W="fill")
        F.icon(it, "drag", 16, "muted")
        text(it, label, "body", "fg" if on else "muted")
        spacer(it)
        P.toggle(it, on) if hasattr(P, "toggle") else text(it, "On" if on else "Off", "smallStrong",
                                                           "accent" if on else "muted")
    text(left, "Look", "label", "muted")
    for label, val in (("Style", "Study Note"), ("Font", "Inter (interface)"), ("Size", "10 pt"),
                       ("Color", "Muted, from the theme"), ("Print size", "Large (1.17 x)"), ("Page", "Letter, 1 inch")):
        it = row(left, f"look/{label}", gap=10, W="fill")
        text(it, label, "small", "muted")
        spacer(it)
        text(it, val, "smallStrong", "fg")
    bar = row(left, "acts", gap=8, W="fill")
    P.button(bar, "Save template", "primary", None, size="sm")
    P.button(bar, "Back to the structure's own", "soft", None, size="sm")
    pv = frame(f, "live page", x=440 + 40, y=Q.TB + 24, w=PAGE_W - 80, h=PAGE_H - Q.TB - 48, fill="#FFFFFF",
               layout="vertical", gap=8, pad=[48, 56, 48, 56], W="fixed", H="fixed", clip=True, stroke="line", sw=1)
    st(pv, "Title", "Phinehas", k)
    st(pv, "Slide Cue", "Slide 2", k)
    st(pv, "Scripture Reference", ref("num25", 10, 13), k)
    scripture(pv, "num25", 10, 12, scale=k)
    sel = col(pv, "selected style", gap=0, stroke=ACCENT, sw=1.5, radius=4, pad=[4, 6, 4, 6])
    placeholder(sel, "Your note on verse 11 (the style being changed is outlined).", scale=k)

    # D5-D7 slides ---------------------------------------------------------------------------------------------------------
    r = row(cv, "row 3", gap=64, align="min")
    f, ink, acc, mut = slide(r, "D5 · Title slide", "The deck in the preview's look: white, Inter, the accent for the "
                             "subtitle. The boxes are DeckCraft's (so fit sizes carry over); only fonts, colors and "
                             "weights change.")
    b = at(f, "title", 64, 176, 832, 130, mainAlign="max")
    stext(b, "Phinehas", 60, ink, weight="Semi Bold", lh=1.1)
    b = at(f, "sub", 64, 318, 832, 60)
    stext(b, "A thread · 9 November 2026", 24, acc)
    f, ink, acc, mut = slide(r, "D6 · Verse by Verse", "One verse, large, in Literata; the verses either side faint "
                             "above and below; the reference in the accent at the top; a highlight as a soft fill.")
    b = at(f, "ref", 64, 38, 832, 34)
    stext(b, ref("num25", 11, 11), 24, acc, weight="Semi Bold")
    b = at(f, "before", 64, 84, 832, 78)
    scripture(b, "num25", 10, 10, size_pt=20 / PX, color=mut, num=mut, lh=1.3)
    b = at(f, "verse", 64, 170, 832, 240)
    scripture(b, "num25", 11, 11, size_pt=30 / PX, color=ink, lh=1.35)
    b = at(f, "after", 64, 420, 832, 84)
    scripture(b, "num25", 12, 12, size_pt=20 / PX, color=mut, num=mut, lh=1.3)

    r = row(cv, "row 4", gap=64, align="min")
    f, ink, acc, mut = slide(r, "D7 · Section slide", "A heading block, or a page inside: the title alone, left, with "
                             "a short accent rule. The section slide no longer fills with the theme's color.")
    rect(f, "accent rule", 56, 4, acc, x=64, y=196)
    b = at(f, "title", 64, 214, 832, 110)
    stext(b, "A heading block", 48, ink, weight="Semi Bold", lh=1.1)
    f, ink, acc, mut = slide(r, "D8 · Verse by Verse, a dark theme", "Themes stay as color sets over the same boxes "
                             "(Vigil here, for a dim room). A theme changes paper, ink and accent only.", theme="Vigil")
    b = at(f, "ref", 64, 38, 832, 34)
    stext(b, ref("ps106", 30, 30), 24, acc, weight="Semi Bold")
    b = at(f, "before", 64, 84, 832, 78)
    scripture(b, "ps106", 29, 29, size_pt=20 / PX, color=mut, num=mut, lh=1.3)
    b = at(f, "verse", 64, 170, 832, 240)
    scripture(b, "ps106", 30, 30, size_pt=34 / PX, color=ink, num=acc, lh=1.35)
    b = at(f, "after", 64, 420, 832, 84)
    scripture(b, "ps106", 31, 31, size_pt=20 / PX, color=mut, num=mut, lh=1.3)

    Q.files_note(cv, "Nothing here writes to the study folder. A saved template would be one new file, "
                 "settings/doc-templates/<name>.json, which the Python app passes over; documents/ records keep their "
                 "format and gain a \"design\": 2 field.")


# ---- the second pass: Looks and a few dials (the person, 2026-11-09: "a streamlined customizability") ------------------
LOOKS = {  # name: what it is for, and its values. Every value is one of the dials on D10, so a Look is only a preset.
    "Preview": dict(about="The default: the in-app look.", head=F.UI, head_w="Semi Bold", accent=ACCENT, head_c=INK,
                    scale=1.0, lh=1.5, align="left", num="accent", rule=False, ink="Full"),
    "Classic": dict(about="Serif throughout, a centered title, a rule under it.", head=F.READ, head_w="Bold",
                    accent="#5A3E1B", head_c="#2A2118", scale=1.0, lh=1.55, align="center", num="accent", rule=True,
                    ink="Full"),
    "Ink saver": dict(about="Black and grey only, no rules or fills, tighter lines: fewer pages, less toner.",
                      head=F.UI, head_w="Medium", accent="#444444", head_c="#222222", scale=0.92, lh=1.35,
                      align="left", num="plain", rule=False, ink="Saver"),
    "Large print": dict(about="One third larger, more room between lines, strong contrast.", head=F.UI,
                        head_w="Bold", accent="#7A140E", head_c="#000000", scale=1.33, lh=1.6, align="left",
                        num="accent", rule=False, ink="Full"),
    "Modern": dict(about="Inter for everything, a cool accent.", head=F.UI, head_w="Semi Bold", accent="#1F4E79",
                   head_c=INK, scale=1.0, lh=1.5, align="left", num="accent", rule=False, ink="Full", body=F.UI),
}
MINI = 0.5   # mini pages are half size


def mini_page(parent, name, look, selected=False, w=PAGE_W * MINI, h=PAGE_H * MINI * 0.62):
    """The same source (Numbers 25:10-12) in one Look, drawn at half size."""
    holder = col(parent, f"look/{name}", gap=8, W="hug")
    pg = frame(holder, f"page/{name}", w=w, h=h, fill="#FFFFFF", layout="vertical", gap=6, pad=[28, 30, 28, 30],
               W="fixed", H="fixed", clip=True, stroke=look["accent"] if selected else "line", sw=2 if selected else 1,
               radius=4)
    s = look["scale"] * MINI * PX
    t = stext(pg, "Phinehas", round(20 * s, 1), look["head_c"], fam=look["head"], weight=look["head_w"],
              textAlignHorizontal="CENTER" if look["align"] == "center" else "LEFT")
    stext(pg, "A thread · Share Copy", round(10 * s, 1), QUIET,
          textAlignHorizontal="CENTER" if look["align"] == "center" else "LEFT")
    if look["rule"]:
        rect(pg, "rule", 10, 1, look["accent"], W="fill")
    stext(pg, ref("num25", 10, 12), round(10 * s, 1), look["accent"], weight="Semi Bold")
    scripture(pg, "num25", 10, 12, size_pt=12 * look["scale"] * MINI, fam=look.get("body"),
              num=look["accent"] if look["num"] == "accent" else "#555555", lh=look["lh"])
    stext(pg, "Your note on verse 11.", round(10 * s, 1), "#666666" if look["ink"] == "Full" else "#555555")
    lab = row(holder, "label", gap=8, W="fill")
    text(lab, name, "bodyStrong", "fg")
    if selected:
        F.icon(lab, "check", 16, "accent")
    para(holder, look["about"], "small", "muted", width=w)
    return pg


def swatch(parent, color, on=False):
    sw_ = frame(parent, f"swatch {color}", w=24, h=24, fill=color, radius=12, W="fixed", H="fixed",
                stroke="fg" if on else None, sw=2 if on else None)
    return sw_


def segmented(parent, options, on):
    r = row(parent, "seg", gap=2, pad=[2, 2, 2, 2], fill="sunken", radius=8)
    for o in options:
        b = row(r, f"opt/{o}", pad=[4, 10, 4, 10], radius=6, fill="bg" if o == on else None)
        text(b, o, "smallStrong", "fg" if o == on else "muted")
    return r


def dial(parent, label, about):
    d = col(parent, f"dial/{label}", gap=6)
    text(d, label, "smallStrong", "fg")
    if about:
        para(d, about, "caption", "muted")
    return d


def customize(board):
    cv = Q.section(board, PG + ", made yours", 0)
    Q.sheet_title(cv, "Made yours, without designing", "The second pass (the person, 2026-11-09): more customizable, "
                  "but streamlined. Three depths, each optional: pick a Look (one click, for someone who does not care to "
                  "design); adjust six dials (for someone who does); the parts (D4) for what goes in. A Look is only a "
                  "named set of the dials' values, so nothing a Look does is out of reach of the dials, and nothing the "
                  "dials do needs Word.")

    # D9 the Looks, side by side ---------------------------------------------------------------------------------------
    holder = col(cv, "D9", gap=14, W="hug")
    text(holder, "D9 · Five Looks, the same source", "title", "fg")
    para(holder, "The Make dialog's first choice, drawn as small pages of the person's own source (here Numbers "
         "25:10-12), not as names. Preview is the default; a Look picked once is remembered for that kind of document.",
         "small", "muted", width=5 * (PAGE_W * MINI) + 4 * 24)
    Q.TITLES.setdefault(PG, [])
    r = row(holder, "Window · D9 · Five Looks", gap=24, align="min")
    Q.TITLES[PG].append("D9 · Five Looks")
    for i, (name, look) in enumerate(LOOKS.items()):
        mini_page(r, name, look, selected=(i == 0))

    # D10 the dials ---------------------------------------------------------------------------------------------------
    f = Q.win(cv, PG, "D10 · Adjust: six dials", "Adjust, under the Looks. Each dial changes the live page at once. "
              "Typeface pairs only (so headings and scripture always agree); the accent from a short curated row, or "
              "your own; size and spacing as words, not points; Ink as the last dial, because it overrides the others "
              "for printing. Save as a Look names the result; Reset returns to the Look it started from.",
              w=PAGE_W + 480, h=PAGE_H)
    Q.toolbar(f, active="Notebook", inbox=None)
    left = frame(f, "adjust", x=0, y=Q.TB, w=440, h=PAGE_H - Q.TB, fill="sunken", layout="vertical", gap=18,
                 pad=[16, 18, 16, 18], W="fixed", H="fixed", clip=True)
    P.pane_header(left, ["Make a document"], "Make a document")
    d = dial(left, "Look", None)
    segmented(d, ["Preview", "Classic", "Ink saver", "Large", "Modern"], "Classic")
    d = dial(left, "Typeface", "Headings / scripture")
    segmented(d, ["Inter / Literata", "Literata / Literata", "Inter / Inter"], "Literata / Literata")
    d = dial(left, "Accent", "Used for references, verse numbers, cues")
    sw_row = row(d, "swatches", gap=10)
    for c_, on in (("#8E1B14", False), ("#5A3E1B", True), ("#1F4E79", False), ("#2F5D3A", False),
                   ("#5B3A6B", False), ("#444444", False)):
        swatch(sw_row, c_, on)
    text(sw_row, "Your own…", "smallStrong", "accent")
    d = dial(left, "Size", None)
    segmented(d, ["Small", "Regular", "Large", "Largest"], "Regular")
    d = dial(left, "Spacing", "Room between lines and around passages")
    segmented(d, ["Compact", "Comfortable", "Airy"], "Comfortable")
    d = dial(left, "Details", None)
    for label, val in (("Title", "Centered"), ("Verse numbers", "In the accent"), ("Under the title", "A thin rule"),
                       ("Paper", "Letter")):
        it = row(d, f"detail/{label}", gap=10, W="fill")
        text(it, label, "small", "muted")
        spacer(it)
        text(it, val + "  ▾", "smallStrong", "fg")
    d = dial(left, "Ink", "Saver: black and grey, no fills or rules, tighter. Black only: also verse numbers and "
             "references in black.")
    segmented(d, ["Full color", "Saver", "Black only"], "Full color")
    bar = row(left, "acts", gap=8, W="fill")
    P.button(bar, "Make", "primary", None, size="sm")
    P.button(bar, "Save as a Look", "soft", None, size="sm")
    text(bar, "Reset", "smallStrong", "accent")
    pv = frame(f, "live page", x=480, y=Q.TB + 24, w=PAGE_W - 80, h=PAGE_H - Q.TB - 48, fill="#FFFFFF",
               layout="vertical", gap=10, pad=[56, 64, 56, 64], W="fixed", H="fixed", clip=True, stroke="line", sw=1)
    lk = LOOKS["Classic"]
    stext(pv, "Phinehas", 26, lk["head_c"], fam=lk["head"], weight="Bold", textAlignHorizontal="CENTER")
    stext(pv, "A thread · Share Copy · 9 November 2026", 13, QUIET, textAlignHorizontal="CENTER")
    rect(pv, "rule", 10, 1, lk["accent"], W="fill")
    stext(pv, ref("num25", 10, 13), 13, lk["accent"], weight="Semi Bold")
    scripture(pv, "num25", 10, 13, num=lk["accent"], lh=lk["lh"])
    stext(pv, ref("ps106", 30, 31), 13, lk["accent"], weight="Semi Bold")
    scripture(pv, "ps106", 30, 31, num=lk["accent"], lh=lk["lh"])
    foot = row(pv, "status", gap=8, W="fill")
    spacer(foot)
    text(foot, "2 pages", "caption", "muted")

    # D11 ink, before and after -----------------------------------------------------------------------------------------
    holder = col(cv, "D11", gap=14, W="hug")
    text(holder, "D11 · Ink: what the dial costs and saves", "title", "fg")
    para(holder, "Under the live page, a line says what this document will take to print: pages and a rough share of "
         "the page covered in ink, measured from the laid-out file (not guessed). Ink saver is shown beside the "
         "current Look so the saving is seen, not promised.", "small", "muted", width=2 * (PAGE_W * MINI) + 24 + 200)
    Q.TITLES[PG].append("D11 · Ink")
    r = row(holder, "Window · D11 · Ink", gap=24, align="min")
    for name in ("Preview", "Ink saver"):
        c_ = col(r, f"ink/{name}", gap=8, W="hug")
        mini_page(c_, name, LOOKS[name], h=PAGE_H * MINI * 0.62)
        text(c_, "3 pages · ink: moderate" if name == "Preview" else "2 pages · ink: light", "smallStrong",
             "fg")

    Q.files_note(cv, "A Look of your own is one file, settings/doc-looks/<name>.json (the dials' values only). The "
                 "document's record names its Look and keeps the values it was made with, so Make again is the same "
                 "document even if the Look is changed later.")


# ---- the third pass: slides, marks in print, page furniture, guardrails -------------------------------------------------
def v11_marks(kind):
    """Your highlight on Numbers 25:11 (four words from 'zealous'), drawn as each ink mode draws it."""
    words = next(v for v in C["num25"]["verses"] if v["v"] == 11)["text"].split(" ")
    i = words.index("zealous")
    span = range(i, i + 4)
    if kind == "Full color":
        return {11: {"hl": {w: "yellow" for w in span}}}
    if kind == "Saver":
        return {11: {"threads": {w: ["#777777"] for w in span}}}
    return {11: {"threads": {w: ["#000000"] for w in span}}}


def card(parent, name, w, h, fill="#FFFFFF", **p):
    return frame(parent, name, w=w, h=h, fill=fill, layout="vertical", gap=8, pad=[22, 24, 22, 24], W="fixed",
                 H="fixed", clip=True, stroke="line", sw=1, radius=4, **p)


def captioned(parent, title, about, w):
    c_ = col(parent, f"c/{title}", gap=8, W="hug")

    def label():
        text(c_, title, "bodyStrong", "fg")
        if about:
            para(c_, about, "small", "muted", width=w)
    return c_, label


def mini_slide(parent, title, about, paper, ink, acc, mut, neighbours=True, ref_at="top", k=0.42):
    c_, label = captioned(parent, title, about, SW * k)
    f = frame(c_, f"slide/{title}", w=SW * k, h=SH * k, fill=paper, W="fixed", H="fixed", clip=True,
              stroke="line", sw=1, radius=3)

    def box(y, h):
        return frame(f, "box", x=64 * k, y=y * k, w=832 * k, h=h * k, layout="vertical", W="fixed", H="fixed")
    if ref_at == "top":
        stext(box(38, 34), ref("num25", 11, 11), 24 * k, acc, weight="Semi Bold")
    else:
        stext(box(470, 34), ref("num25", 11, 11), 20 * k, acc, weight="Semi Bold")
    if neighbours:
        scripture(box(84, 78), "num25", 10, 10, size_pt=20 * k / PX, color=mut, num=mut, lh=1.3)
        scripture(box(170, 240), "num25", 11, 11, size_pt=30 * k / PX, color=ink, num=acc, lh=1.35)
        scripture(box(420, 84), "num25", 12, 12, size_pt=20 * k / PX, color=mut, num=mut, lh=1.3)
    else:
        scripture(box(110, 340), "num25", 11, 11, size_pt=36 * k / PX, color=ink, num=acc, lh=1.4)
    label()
    return f


def deeper(board):
    cv = Q.section(board, PG + ", deeper", 0)
    Q.sheet_title(cv, "Deeper: slides, your marks in print, the page around the text, guardrails", "The third pass "
                  "(the person, 2026-11-09: go deeper). The same Looks reach the slides; your highlights keep their "
                  "meaning in every ink mode; a few page options (a cover, a running head, two columns) as switches, "
                  "not layout; and the dials quietly stop a person from making something unreadable.")

    # D12 slides
    holder = col(cv, "D12", gap=14, W="hug")
    Q.TITLES[PG].append("D12 · Slides")
    text(holder, "D12 · Slides: the same Looks, three slide dials", "title", "fg")
    para(holder, "A deck has Paper (the theme's colors) in place of Ink, and three dials of its own: Neighbours (the "
         "verses either side faint, or hidden so the verse is larger), Reference (top or bottom), and Typeface (as for "
         "Word). Size is never a dial: the boxes fit the text, which keeps every verse whole and checked.",
         "small", "muted", width=3 * SW * 0.42 + 2 * 24)
    r = row(holder, "Window · D12 · Slides", gap=24, align="min")
    mini_slide(r, "Paper, neighbours faint", "The default.", "#FFFFFF", INK, ACCENT, "#9A948A")
    mini_slide(r, "Vellum, no neighbours", "The verse alone, larger; the reference at the bottom.", "#F7F3E8",
               "#231A12", "#5A3E1B", "#9A948A", neighbours=False, ref_at="bottom")
    mini_slide(r, "Vigil, neighbours faint", "A dim room.", "#0E1524", "#F4EFE3", "#D9B46A", "#7C8496")

    # D13 your marks in print
    holder = col(cv, "D13", gap=14, W="hug")
    Q.TITLES[PG].append("D13 · Your marks in print")
    text(holder, "D13 · Your highlights in each ink mode", "title", "fg")
    para(holder, "A highlight is your mark, so ink never removes it; ink changes how it is drawn. Full color: the "
         "highlight's own soft fill. Saver: a grey underline (no fill, almost no toner). Black only: a black underline. "
         "Highlights can still be switched off as a part (D4).", "small", "muted", width=3 * 360 + 2 * 24)
    r = row(holder, "Window · D13 · Your marks in print", gap=24, align="min")
    for kind in ("Full color", "Saver", "Black only"):
        c_, label = captioned(r, kind, "", 360)
        cd = card(c_, f"marks/{kind}", 360, 250)
        refc = ACCENT if kind == "Full color" else ("#444444" if kind == "Saver" else "#000000")
        stext(cd, ref("num25", 11, 11), 12, refc, weight="Semi Bold")
        F.verses(cd, [v for v in C["num25"]["verses"] if v["v"] == 11], style="readSmall", marks=v11_marks(kind),
                 number_color=refc)
        stext(cd, "Your note on verse 11.", 12, "#666666" if kind != "Black only" else "#000000")
        label()

    # D14 the page around the text
    holder = col(cv, "D14", gap=14, W="hug")
    Q.TITLES[PG].append("D14 · The page around the text")
    text(holder, "D14 · The page around the text: four switches", "title", "fg")
    para(holder, "Cover page (title, subtitle, date, alone on page 1); Running head (the title, small, on every page "
         "after the first); Page numbers (Page x of y, x, or none); Columns (one, or two for scripture-only documents: "
         "the Reading Sheet). Switches, never a layout editor.", "small", "muted", width=3 * 300 + 2 * 24)
    r = row(holder, "Window · D14 · The page around the text", gap=24, align="min")
    pw, ph = 300, 388
    c_, label = captioned(r, "Cover page", "", pw)
    cd = card(c_, "cover", pw, ph, mainAlign="center")
    stext(cd, "Phinehas", 26, INK, weight="Semi Bold", textAlignHorizontal="CENTER")
    stext(cd, "A thread · Speaker Script", 11, QUIET, textAlignHorizontal="CENTER")
    stext(cd, "9 November 2026", 11, QUIET, textAlignHorizontal="CENTER")
    label()
    c_, label = captioned(r, "Running head, page 2", "", pw)
    cd = card(c_, "running head", pw, ph)
    hd = row(cd, "head", gap=6, W="fill")
    text(hd, "Phinehas", "caption", "muted")
    spacer(hd)
    text(hd, "2", "caption", "muted")
    rect(cd, "rule", 10, 1, RULE, W="fill")
    stext(cd, ref("num25", 12, 13), 9, ACCENT, weight="Semi Bold")
    scripture(cd, "num25", 12, 13, size_pt=9 / PX)
    label()
    c_, label = captioned(r, "Two columns (Reading Sheet)", "", pw)
    cd = card(c_, "two columns", pw, ph)
    stext(cd, ref("num25", 10, 13), 9, ACCENT, weight="Semi Bold")
    cols = row(cd, "cols", gap=14, align="min", W="fill")
    scripture(col(cols, "a", gap=4), "num25", 10, 11, size_pt=7.5 / PX, lh=1.4)
    scripture(col(cols, "b", gap=4), "num25", 12, 13, size_pt=7.5 / PX, lh=1.4)
    label()

    # D15 guardrails
    f = Q.win(cv, PG, "D15 · Guardrails", "Your own accent is checked against the paper. Too light for text (under "
              "4.5 : 1 on white): rules and fills keep your color, and text in the accent is darkened just enough, with "
              "one quiet line saying so and an Undo. See it in grey shows the page as a black-and-white printer will.",
              w=720, h=420)
    pn = frame(f, "panel", x=0, y=0, w=720, h=420, layout="vertical", gap=14, pad=[24, 24, 24, 24], W="fixed", H="fixed")
    d = dial(pn, "Accent", "Used for references, verse numbers, cues")
    sw_row = row(d, "swatches", gap=10)
    for c_, on in (("#8E1B14", False), ("#5A3E1B", False), ("#1F4E79", False), ("#2F5D3A", False), ("#5B3A6B", False),
                   ("#444444", False), ("#F2C14E", True)):
        swatch(sw_row, c_, on)
    note = row(pn, "warn", gap=10, pad=[10, 12, 10, 12], fill="sunken", radius=8, W="fill")
    F.icon(note, "eye", 18, "muted")
    para(note, "This gold is hard to read as text on white, so references and verse numbers use a darker gold. "
         "Rules keep your gold.", "small", "fg")
    text(note, "Undo", "smallStrong", "accent")
    sample = row(pn, "sample", gap=16, W="fill")
    stext(sample, ref("num25", 11, 11), 14, "#9A6F00", weight="Semi Bold", W="hug")
    rect(sample, "your gold rule", 80, 4, "#F2C14E")
    gr = row(pn, "grey", gap=10, W="fill")
    text(gr, "See it in grey", "smallStrong", "fg")
    segmented(gr, ["Off", "On"], "Off")

    Q.files_note(cv, "Nothing new in the study folder beyond the second pass: these are more values in a Look "
                 "(settings/doc-looks/<name>.json) and in a document's record.")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    customize(board)
    deeper(board)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "r3.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "r3.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports" / "r3"
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
