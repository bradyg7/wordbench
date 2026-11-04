"""The pieces every layout is made of: bars, buttons, chips, sheets, notes, thread rows, pane chrome, the capture palette.

Each function draws one piece into a parent with figlib and returns its frame. The design-system sheet shows them on their
own; the phone and desktop sheets put them together. Words on them are the app's own labels or the person's study (the
Phinehas demo); scripture is only ever passed in from content.json.
"""
import re

from figlib import (S, TYPE, c, col, dot, frame, icon, para, rect, row, shadow, spacer, text)

REF = re.compile(r"\b(?:[1-3] )?(?:Gen|Exo|Lev|Num|Deut|Josh|Judg|Sam|Kgs|Chr|Ezra|Neh|Psalm|Ps|Mal|Rom|Cor|John|Acts|Titus)"
                 r"[a-z]*\.? \d+(?::\d+(?:[-–]\d+)?)?")


# ---- small controls ---------------------------------------------------------------------------------------------------
def button(parent, label, kind="secondary", icon_name=None, size="md", name=None, W="hug"):
    h = {"sm": 32, "md": 40, "lg": 48}[size]
    fill, fg, stroke = {"primary": ("accent", "onAccent", None), "secondary": ("surface", "fg", "line"),
                        "ghost": (None, "accent", None), "soft": ("accentSoft", "fg", None)}[kind]
    b = row(parent, name or f"button/{label}", gap=6, pad=[0, 14 if label else 8, 0, 12 if icon_name else 14],
            fill=fill, radius=8, stroke=stroke, sw=1 if stroke else None, mainAlign="center", W=W, H="fixed")
    S.do("node.set", {"ids": [b], "props": {"height": h}}, ref=False)
    if icon_name:
        icon(b, icon_name, 18, fg)
    if label:
        text(b, label, "smallStrong", fg)
    return b


def icon_button(parent, name, color="fg", size=44, icon_size=24, fill=None, stroke=None, badge=None):
    b = frame(parent, f"icon-button/{name}", w=size, h=size, fill=fill, radius=size / 2 if fill else 8,
              stroke=stroke, sw=1 if stroke else None, layout="horizontal", mainAlign="center", crossAlign="center",
              W="fixed", H="fixed")
    icon(b, name, icon_size, color)
    if badge:
        bd = frame(b, "badge", w=18, h=18, fill="accent", radius=9, layout="horizontal", mainAlign="center",
                   crossAlign="center", absolute=True, x=size - 18, y=2, W="hug", pad=[0, 5, 0, 5])
        text(bd, str(badge), "caption", "onAccent", fontSize=11, lineHeight="14px")
    return b


def chip(parent, label, kind="outline", icon_name=None, dot_color=None, name=None):
    fill, fg, stroke = {"outline": ("surface", "fg", "line"), "selected": ("accentSoft", "fg", "accent"),
                        "solid": ("accent", "onAccent", None), "quiet": ("sunken", "muted", None),
                        "place": ("accentSoft", "accent", None), "question": (None, "question", "question")}[kind]
    ch = row(parent, name or f"chip/{label}", gap=6, pad=[5, 12, 5, 10 if (icon_name or dot_color) else 12],
             fill=fill, radius=999, stroke=stroke, sw=1 if stroke else None)
    if dot_color:
        dot(ch, dot_color, 9)
    if icon_name:
        icon(ch, icon_name, 15, fg)
    text(ch, label, "smallStrong", fg)
    return ch


def segmented(parent, options, active, name="segmented", W="fill", badges=None):
    seg = row(parent, name, gap=2, pad=3, fill="sunken", radius=10, W=W)
    for o in options:
        on = o == active
        it = row(seg, f"segment/{o}", gap=6, pad=[7, 12, 7, 12], fill="surface" if on else None, radius=8,
                 mainAlign="center", W="fill" if W == "fill" else "hug")
        if on:
            shadow(it, 1, 3, "#00000014")
        text(it, o, "smallStrong", "fg" if on else "muted")
        if badges and o in badges:
            bd = row(it, "count", pad=[0, 6, 0, 6], fill="accent", radius=999)
            text(bd, str(badges[o]), "caption", "onAccent", fontSize=11, lineHeight="16px")
    return seg


def field(parent, placeholder, value=None, icon_name="search", name="field", W="fill", trailing=None, height=44):
    f = row(parent, name, gap=10, pad=[0, 12, 0, 12], fill="surface", radius=10, stroke="line", sw=1, W=W, H="fixed")
    S.do("node.set", {"ids": [f], "props": {"height": height}}, ref=False)
    if icon_name:
        icon(f, icon_name, 20, "muted")
    text(f, value or placeholder, "body", "fg" if value else "muted", W="fill")
    if trailing:
        text(f, trailing, "caption", "muted")
    return f


def kbd(parent, key):
    k = row(parent, f"kbd/{key}", pad=[1, 6, 1, 6], radius=4, stroke="line", sw=1, fill="sunken")
    text(k, key, "caption", "muted")
    return k


def divider(parent, name="divider"):
    return rect(parent, name, 10, 1, "line", sizingH="fill")


def label(parent, s, color="muted"):
    return text(parent, s, "label", color)


def rich(parent, s, style="body", color="fg"):
    """A note's text: verse references in it are links (semi-bold and underlined, as the app draws them)."""
    t = para(parent, s, style, color)
    for m in REF.finditer(s):
        S.do("text.style", {"id": t, "start": m.start(), "end": m.end(), "fontStyle": "Semi Bold",
                            "textDecoration": "underline"}, ref=False)
    return t


# ---- phone chrome -----------------------------------------------------------------------------------------------------
def status_bar(parent, w=390):
    sb = row(parent, "status bar", pad=[14, 26, 0, 32], W="fixed", H="fixed", mainAlign="spaceBetween")
    S.do("node.set", {"ids": [sb], "props": {"width": w, "height": 47}}, ref=False)
    text(sb, "9:41", "bodyStrong")
    r = row(sb, "status icons", gap=6)
    for wdt in (18, 16, 24):
        rect(r, "status", wdt, 10, "fg", cornerRadius=3, opacity=0.85)
    return sb


def top_bar(parent, title, left=None, right=(), subtitle=None, w=390, big=False, title_icon=None):
    tb = row(parent, "top bar", gap=4, pad=[0, 8, 0, 8], W="fixed", H="fixed", fill="bg")
    S.do("node.set", {"ids": [tb], "props": {"width": w, "height": 52}}, ref=False)
    if left:
        icon_button(tb, left, "fg")
    else:
        frame(tb, "pad", w=8, h=8, W="fixed", H="fixed")
    mid = col(tb, "title", gap=0, W="fill")
    t = row(mid, "title row", gap=4)
    text(t, title, "title" if not big else "display")
    if title_icon:
        icon(t, title_icon, 18, "muted")
    if subtitle:
        text(mid, subtitle, "caption", "muted")
    for r in right:
        if isinstance(r, tuple):
            icon_button(tb, r[0], "fg", badge=r[1])
        else:
            icon_button(tb, r, "fg")
    return tb


TABS = [("Read", "book"), ("Notebook", "notebook"), ("Threads", "threads"), ("Study", "search"), ("More", "more")]


def tab_bar(parent, active="Read", w=390, inbox=2):
    tb = row(parent, "tab bar", gap=0, pad=[6, 4, 30, 4], fill="surface", W="fixed", H="fixed", align="min",
             stroke="line", strokeTopWeight=1, strokeBottomWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    S.do("node.set", {"ids": [tb], "props": {"width": w, "height": 84}}, ref=False)
    for name, ic in TABS:
        on = name == active
        t = col(tb, f"tab/{name}", gap=2, crossAlign="center", W="fill")
        holder = frame(t, "icon holder", w=28, h=26, W="fixed", H="fixed")
        icon_box = icon(holder, ic, 24, "accent" if on else "muted", weight=2 if on else 1.75)
        S.do("node.set", {"ids": [icon_box], "props": {"x": 2, "y": 1}}, ref=False)
        if name == "Notebook" and inbox:
            bd = frame(holder, "inbox count", w=16, h=16, fill="accent", radius=8, layout="horizontal",
                       mainAlign="center", crossAlign="center", x=17, y=-3, W="fixed", H="fixed")
            text(bd, str(inbox), "caption", "onAccent", fontSize=10, lineHeight="12px")
        text(t, name, "caption", "accent" if on else "muted", fontSize=11)
    return tb


def home_indicator(parent, w=390, y=830):
    rect(parent, "home indicator", 134, 5, "fg", cornerRadius=3, x=(w - 134) / 2, y=y, opacity=0.9)


def fab(parent, x, y, icon_name="pen", label=None):
    f = row(parent, "capture button", gap=8, pad=[0, 18 if label else 0, 0, 16 if label else 0], fill="accent",
            radius=28, mainAlign="center", x=x, y=y, H="fixed", W="hug" if label else "fixed")
    S.do("node.set", {"ids": [f], "props": {"height": 56, **({} if label else {"width": 56})}}, ref=False)
    icon(f, icon_name, 24, "onAccent", weight=2)
    if label:
        text(f, label, "bodyStrong", "onAccent")
    shadow(f, 6, 18, "#00000033")
    return f


def scrim(parent, w=390, h=844):
    return rect(parent, "scrim", w, h, "scrim", x=0, y=0)


def sheet(parent, y, title=None, w=390, h=None, subtitle=None, close=True, name="sheet", pad=20):
    """A bottom sheet: the tap answer to a hover card on a phone. It rises over the reader, which keeps its place."""
    sh = frame(parent, name, x=0, y=y, w=w, h=h or 100, fill="surface", radius=[20, 20, 0, 0], layout="vertical",
               gap=14, pad=[8, pad, 24, pad], W="fixed", H="fixed" if h else "hug", clip=True)
    shadow(sh, -4, 24, "#00000026")
    grab = row(sh, "grabber row", mainAlign="center", W="fill")
    rect(grab, "grabber", 40, 5, "line", cornerRadius=3)
    if title:
        head = row(sh, "sheet head", gap=8, W="fill")
        tcol = col(head, "titles", gap=2, W="fill")
        text(tcol, title, "title")
        if subtitle:
            text(tcol, subtitle, "small", "muted")
        if close:
            icon_button(head, "close", "muted", size=36, icon_size=20, fill="sunken")
    return sh


def return_pill(parent, place, x=None, y=None):
    p = row(parent, "back to place", gap=8, pad=[10, 16, 10, 12], fill="fg", radius=999,
            **({"x": x, "y": y} if x is not None else {}))
    icon(p, "back", 18, "bg", weight=2)
    text(p, f"Back to {place}", "smallStrong", "bg")
    shadow(p, 4, 14, "#00000033")
    return p


# ---- study pieces -----------------------------------------------------------------------------------------------------
def note_card(parent, body, place=None, time=None, kind="note", quote=None, w_fill=True, compact=False, name=None):
    """kind: note (placed), jot (no place yet), question (an open question, the trail folded into the Notebook)."""
    card = col(parent, name or f"{kind}/{body[:24]}", gap=8, pad=[12, 14, 12, 14], fill="surface", radius=12,
               stroke="line", sw=1)
    head = row(card, "head", gap=8, W="fill")
    if kind == "question":
        chip(head, "Question", "question", icon_name="question")
    if place:
        chip(head, place, "place", icon_name="place")
    elif kind in ("jot", "question"):
        chip(head, "No place yet", "quiet")
    spacer(head)
    if time:
        text(head, time, "caption", "muted")
    rich(card, body)
    if quote:
        q = row(card, "quote", gap=10, align="min", W="fill")
        rect(q, "rule", 3, 20, "line", sizingV="fill", cornerRadius=2)
        para(q, quote, "readSmall", "muted", maxLines=2)
    if not place and not compact:
        acts = row(card, "actions", gap=8, W="fill")
        button(acts, "Place it…", "soft", "place", size="sm")
        if kind == "jot":
            button(acts, "Ask it as a question", "ghost", size="sm")
    return card


def day_head(parent, s):
    h = row(parent, f"day/{s}", gap=8, pad=[8, 0, 0, 0], W="fill")
    text(h, s, "heading")
    divider(h)
    return h


def thread_row(parent, name, color, count, preview, shown=True):
    r = row(parent, f"thread/{name}", gap=12, pad=[12, 14, 12, 14], fill="surface", radius=12, stroke="line", sw=1,
            W="fill", align="min")
    dot(r, color, 14)
    mid = col(r, "text", gap=4, W="fill")
    t = row(mid, "name row", gap=8, W="fill")
    text(t, name, "bodyStrong")
    text(t, f"{count} places", "caption", "muted")
    para(mid, preview, "small", "muted", maxLines=2)
    eye = icon_button(r, "eye" if shown else "eye", "accent" if shown else "muted", size=36, icon_size=20,
                      fill="accentSoft" if shown else None)
    return r


def member_row(parent, place, verse_text, drag=True, kind="verse"):
    r = row(parent, f"member/{place}", gap=10, pad=[10, 12, 10, 6 if drag else 12], fill="surface", radius=10,
            W="fill", align="min", stroke="line", sw=1)
    if drag:
        icon(r, "drag", 20, "muted", weight=2.4)
    mid = col(r, "text", gap=2, W="fill")
    text(mid, place, "smallStrong", "accent")
    para(mid, verse_text, "readSmall", "fg", maxLines=3)
    return r


def verse_line(parent, place, verse_text, tag=None, tag_kind="quiet", emph=None, max_lines=3):
    """A result row: the place, a tag, and the verse with the matched word emphasised."""
    r = col(parent, f"result/{place}", gap=4, pad=[10, 0, 10, 0], W="fill")
    head = row(r, "head", gap=8, W="fill")
    text(head, place, "smallStrong", "accent")
    spacer(head)
    if tag:
        chip(head, tag, tag_kind)
    t = para(r, verse_text, "readSmall", "fg", maxLines=max_lines)
    for word in emph or ():
        i = verse_text.find(word)
        if i >= 0:
            S.do("text.style", {"id": t, "start": i, "end": i + len(word), "fontStyle": "Bold"}, ref=False)
    divider(r)
    return r


def lexicon_block(parent, entry, count=None, compact=False):
    """A lexicon entry exactly as `wb preview H####` gives it: the number, the word and its sound, Strong's own words."""
    lines = entry.splitlines()
    num, word, sound = lines[0].split(" ", 2)
    b = col(parent, f"lexicon/{num}", gap=8, W="fill")
    head = row(b, "head", gap=12, W="fill", align="baseline")
    text(head, word, "hebrew")
    hc = col(head, "sound", gap=0, W="fill")
    text(hc, sound, "heading")
    text(hc, f"{num} · Strong's", "caption", "muted")
    para(b, lines[1], "body")
    if len(lines) > 2:
        para(b, lines[2], "small", "muted")
    if count:
        ch = row(b, "count", gap=8)
        chip(ch, f"{count['occurrences']} times in {count['verses']} verses", "quiet")
        chip(ch, f"{len(count['by_book'])} books", "quiet")
    return b


def interlinear_cell(parent, w):
    cell = col(parent, f"word/{w['strong']}", gap=2, pad=[10, 8, 10, 8], fill="surface", radius=10, stroke="line",
               sw=1, crossAlign="center", W="fill")
    text(cell, w["original"], "hebrew", fontSize=24, lineHeight="32px")
    text(cell, w["translit"], "caption", "muted")
    text(cell, w["strong"], "caption", "accent")
    text(cell, w["gloss"], "small", textAlign="center", W="fill")
    return cell


def color_row(parent, active=None, size=32, with_more=True):
    r = row(parent, "highlight colors", gap=10)
    for name in ("hlYellow", "hlGreen", "hlBlue", "hlPink", "hlOrange"):
        on = name == active
        s = frame(r, f"swatch/{name}", w=size, h=size, radius=size / 2, fill=name, stroke="accent" if on else "line",
                  sw=2.5 if on else 1, W="fixed", H="fixed", layout="horizontal", mainAlign="center",
                  crossAlign="center")
        if on:
            icon(s, "check", 18, "fg", weight=2.2)
    if with_more:
        m = frame(r, "more colors", w=size, h=size, radius=size / 2, stroke="line", sw=1, W="fixed", H="fixed",
                  layout="horizontal", mainAlign="center", crossAlign="center")
        icon(m, "plus", 18, "muted")
    return r


def action_tile(parent, label, icon_name, W="fill"):
    t = col(parent, f"action/{label}", gap=6, pad=[12, 4, 10, 4], fill="sunken", radius=12, crossAlign="center", W=W)
    icon(t, icon_name, 22, "fg")
    text(t, label, "caption", "fg")
    return t


def selection_bar(parent, x, y):
    """Phone: what a selection offers, floating above the words (the desktop's color bar, with the pane's buttons)."""
    bar = col(parent, "selection bar", gap=10, pad=[12, 14, 12, 14], fill="surface", radius=16, stroke="line", sw=1,
              x=x, y=y, W="fixed")
    S.do("node.set", {"ids": [bar], "props": {"width": 358}}, ref=False)
    shadow(bar, 8, 24, "#00000030")
    color_row(bar, size=30)
    acts = row(bar, "actions", gap=6, W="fill")
    for lbl, ic in (("Note", "pen"), ("Thread", "threads"), ("Look up", "word"), ("Copy", "copy")):
        action_tile(acts, lbl, ic)
    return bar


# ---- desktop chrome ---------------------------------------------------------------------------------------------------
def tool(parent, label, icon_name, active=False, count=None, caret=False):
    t = row(parent, f"tool/{label}", gap=6, pad=[6, 10, 6, 8], radius=8, fill="accentSoft" if active else None,
            stroke="accent" if active else None, sw=1 if active else None)
    icon(t, icon_name, 18, "accent" if active else "fg")
    text(t, label, "smallStrong", "accent" if active else "fg")
    if count:
        bd = row(t, "count", pad=[0, 6, 0, 6], fill="accent", radius=999)
        text(bd, str(count), "caption", "onAccent", fontSize=11, lineHeight="16px")
    if caret:
        icon(t, "down", 14, "muted")
    return t


def desktop_toolbar(parent, w, active="Notebook", inbox=2, command_value=None, place="Numbers 25"):
    bar = row(parent, "toolbar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed",
              stroke="line", strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    S.do("node.set", {"ids": [bar], "props": {"width": w, "height": 48}}, ref=False)
    nav = row(bar, "place", gap=2)
    icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "accent")
    text(pl, place, "bodyStrong")
    icon(pl, "down", 14, "muted")
    icon_button(nav, "right", "fg", size=32, icon_size=18)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1,
              W="fixed", H="fixed")
    S.do("node.set", {"ids": [cmd], "props": {"width": min(460, w * 0.32), "height": 34}}, ref=False)
    icon(cmd, "search", 18, "muted")
    text(cmd, command_value or "Search, go to a place, or type a command", "small",
         "fg" if command_value else "muted", W="fill", maxLines=1)
    kbd(cmd, "`")
    spacer(bar)
    tools = row(bar, "tools", gap=4)
    tool(tools, "Notebook", "notebook", active == "Notebook", count=inbox)
    tool(tools, "Threads", "threads", active == "Threads")
    if w >= 1366:
        tool(tools, "Shelf", "shelf", active == "Shelf")
        tool(tools, "Documents", "docs", active == "Documents")
    tool(tools, "Highlights", "highlight", caret=True)
    icon_button(tools, "more", "fg", size=34, icon_size=20)
    return bar


def pane_header(parent, tabs, active, w=None, actions=("minimize", "float", "close")):
    """Pane chrome: tabs for what is docked in this column, and the group's minimize / float / close."""
    h = row(parent, "pane header", gap=0, pad=[0, 6, 0, 0], fill="sunken", W="fill" if w is None else "fixed",
            H="fixed", stroke="line", strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    S.do("node.set", {"ids": [h], "props": {"height": 40, **({"width": w} if w else {})}}, ref=False)
    for t in tabs:
        on = t == active
        tb = row(h, f"tab/{t}", gap=8, pad=[0, 10, 0, 12], fill="surface" if on else None, H="fill",
                 stroke="accent" if on else None, strokeTopWeight=2 if on else 0, strokeBottomWeight=0,
                 strokeLeftWeight=0, strokeRightWeight=0)
        text(tb, t, "smallStrong" if on else "small", "fg" if on else "muted")
        icon(tb, "close", 14, "muted")
    spacer(h)
    for a in actions:
        icon_button(h, a, "muted", size=30, icon_size=16)
    return h


def hover_card(parent, x, y, title, body_fn, w=380):
    card = col(parent, "hover card", gap=8, pad=[12, 14, 14, 14], fill="surface", radius=12, stroke="line", sw=1,
               x=x, y=y, W="fixed")
    S.do("node.set", {"ids": [card], "props": {"width": w}}, ref=False)
    shadow(card, 8, 28, "#00000033")
    text(card, title, "caption", "muted")
    body_fn(card)
    return card


def composer(parent, place="Numbers 25:11", hint=True, name="composer", W="fill"):
    box = col(parent, name, gap=8, pad=[10, 12, 10, 12], fill="surface", radius=14, stroke="accent", sw=1.5, W=W)
    text(box, "Write a thought…", "body", "muted", W="fill")
    r = row(box, "options", gap=8, W="fill")
    chip(r, place, "place", icon_name="place") if place else chip(r, "No place", "quiet")
    chip(r, "Question", "outline", icon_name="question")
    spacer(r)
    if hint:
        text(r, "Enter adds · Shift+Enter new line", "caption", "muted")
    return box
