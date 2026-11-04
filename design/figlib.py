"""A small layer over FigCraft's command scripts: tokens, frames, text, icons and verses, written as one JSON script.

build.py uses this to write design/build/workbench.json, which `figcraft-cli run` turns into design/workbench.figcraft.
Every step is named so later steps can point at it ({"$ref": name}), the way FigCraft's `run` and `batch` allow.
"""
import re

# ---- tokens ---------------------------------------------------------------------------------------------------------
# One color collection with three modes. Light and Dark are the app's own colors (web/style.css); E-ink starts from the
# `print` export theme in workbench/craft_plan.py (black on white, one light gray for a mark) and adds the few grays an
# e-ink panel shows well. Every layer binds to these, so a frame switched to another mode redraws in it.
MODES = ["Light", "Dark", "E-ink"]
COLORS = {  # name: (light, dark, e-ink, what it is for)
    "bg":          ("#FBF9F4", "#17140F", "#FFFFFF", "page behind the text"),
    "surface":     ("#FFFFFF", "#211D16", "#FFFFFF", "cards, sheets, panes"),
    "sunken":      ("#F3EEE4", "#1C1813", "#FFFFFF", "toolbars, tab strips, wells"),
    "fg":          ("#231F1A", "#E9E2D4", "#000000", "text"),
    "muted":       ("#6F675C", "#9A917F", "#333333", "secondary text (e-ink stays dark: gray text fades on a panel)"),
    "line":        ("#E4DDD0", "#342E24", "#000000", "borders and rules"),
    "accent":      ("#8A4B20", "#E0A46C", "#000000", "verse numbers, the active control"),
    "accentSoft":  ("#F1E3D3", "#3A2D1F", "#E6E6E6", "selection, a pressed control"),
    "onAccent":    ("#FFFFFF", "#17140F", "#FFFFFF", "text on accent"),
    "jesus":       ("#A3281E", "#EF7D6E", "#000000", "words of Jesus"),
    "hlYellow":    ("#F4E3A1", "#4A3F1C", "#E6E6E6", "highlight: yellow (e-ink: the print mark)"),
    "hlGreen":     ("#D6E9CC", "#2B3D25", "#D9D9D9", "highlight: green"),
    "hlBlue":      ("#D3E2F3", "#22344A", "#CCCCCC", "highlight: blue"),
    "hlPink":      ("#F3D6E5", "#47253A", "#E6E6E6", "highlight: pink"),
    "hlOrange":    ("#F7DCC2", "#4A3220", "#D9D9D9", "highlight: orange"),
    "threadA":     ("#D9822B", "#E8A060", "#000000", "thread underline: Phinehas (orange)"),
    "threadB":     ("#2E6FB8", "#7FB0E8", "#000000", "thread underline: Phinehas echoes (blue)"),
    "question":    ("#6B4FA0", "#B9A2E6", "#000000", "an open question"),
    "scrim":       ("#00000059", "#0000008C", "#FFFFFF00", "behind a sheet (none on e-ink: no dimming)"),
    "ok":          ("#3B7A3B", "#8CCB8C", "#000000", "up to date"),
    "warn":        ("#A15C12", "#E8A060", "#000000", "out of date"),
}

UI = "Inter"
READ = "Merriweather"   # built into FigCraft; the app uses Iowan Old Style / Palatino (see PLAN-design.md, decisions)
HEB = "Noto Sans Hebrew"

TYPE = {  # name: (family, style, size, line height, letter spacing, what for)
    "display":   (UI, "Semi Bold", 28, 34, -0.3, "screen titles on a phone"),
    "title":     (UI, "Semi Bold", 20, 26, -0.2, "sheet and pane titles"),
    "heading":   (UI, "Semi Bold", 16, 22, 0, "section heads, a note's place"),
    "body":      (UI, "Regular", 15, 22, 0, "notes, lists, controls"),
    "bodyStrong": (UI, "Semi Bold", 15, 22, 0, "emphasis in lists"),
    "small":     (UI, "Regular", 13, 18, 0, "secondary lines"),
    "smallStrong": (UI, "Semi Bold", 13, 18, 0, "buttons, chips"),
    "caption":   (UI, "Medium", 12, 16, 0, "times, counts"),
    "label":     (UI, "Semi Bold", 11, 14, 0.8, "uppercase labels"),
    "readPhone": (READ, "Regular", 18, 32, 0, "scripture on a phone"),
    "readDesk":  (READ, "Regular", 19, 34, 0, "scripture on a desktop"),
    "readEink":  (READ, "Regular", 21, 38, 0, "scripture on e-ink"),
    "readSmall": (READ, "Regular", 15, 25, 0, "scripture quoted in a card or list"),
    "chapter":   (READ, "Bold", 26, 34, 0, "chapter title in the reader"),
    "hebrew":    (HEB, "Regular", 28, 36, 0, "Hebrew and Greek words"),
    "verseNum":  (UI, "Semi Bold", 11, 32, 0, "verse numbers (line height follows the reading size)"),
}

SPACE = [4, 8, 12, 16, 24, 32, 48]
RADIUS = {"control": 8, "card": 12, "sheet": 20, "pill": 999}
TOUCH = {"phone": 44, "e-ink": 56}

# Stroke icons on a 24 grid, in the line style of the toolbar icons in web/index.html (several are those same paths).
ICONS = {
    "search": "M10.5 4.5a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM15 15l5.5 5.5",
    "capture": "M4 7l5 5-5 5M12 18h8",
    "question": "M9 9.2a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.8V15M12 18.2v.3",
    "threads": "M6 3.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM18 5.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM11 15.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM8 6.5l8 1M7 8l3 8M17 10l-5 6.5",
    "shelf": "M4 6h16M4 12h16M4 18h16M8 6v6M13 12v6",
    "docs": "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
    "highlight": "M14 4l6 6-8.5 8.5H6.5l-2-2v-3zM4 21h16",
    "more": "M5 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM19 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z",
    "left": "M15 5l-7 7 7 7",
    "right": "M9 5l7 7-7 7",
    "down": "M6 9l6 6 6-6",
    "back": "M19 12H5M11 6l-6 6 6 6",
    "close": "M6 6l12 12M18 6L6 18",
    "plus": "M12 5v14M5 12h14",
    "book": "M4 5.5C6.5 4.2 9.5 4.2 12 6c2.5-1.8 5.5-1.8 8-.5V19c-2.5-1.3-5.5-1.3-8 .5c-2.5-1.8-5.5-1.8-8-.5zM12 6v13.5",
    "notebook": "M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6zM9 3v18M12 8h3M12 12h3",
    "pen": "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3",
    "place": "M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21zM12 8.2a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z",
    "inbox": "M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2h4l1-2h5",
    "list": "M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5",
    "layers": "M12 4l8 4.5-8 4.5-8-4.5zM4 13l8 4.5 8-4.5",
    "eye": "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 1 0 0-5.6z",
    "check": "M5 12.5l4.5 4.5L19 7.5",
    "listen": "M5 9.5h3.5L13 5.5v13l-4.5-4H5zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11",
    "copy": "M9 9h10v11H9zM5 15V4h10",
    "word": "M5 19L10 5h1.5L17 19M7 14h8.5",
    "drag": "M9 6h.5M14.5 6h.5M9 12h.5M14.5 12h.5M9 18h.5M14.5 18h.5",
    "minimize": "M6 12h12",
    "dock": "M4 5h16v14H4zM14 5v14",
    "float": "M4 8h11v11H4zM9 8V4h11v11h-5",
    "type": "M5 7V5h14v2M12 5v14M9 19h6",
    "sync": "M4.5 10a7.5 7.5 0 0 1 13.4-3.5L20 9M20 4v5h-5M19.5 14a7.5 7.5 0 0 1-13.4 3.5L4 15M4 20v-5h5",
    "home": "M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5",
    "interlinear": "M4 7h7M13 7h7M4 12h4M10 12h4M16 12h4M4 17h9M15 17h5",
    "pdf": "M7 3h7l4 4v14H7zM14 3v4h4M9.5 16v-4h1.5a1.2 1.2 0 0 1 0 2.4H9.5",
    "desktop": "M3.5 5h17v11h-17zM9 20h6M12 16v4",
    "phone": "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
    "sun": "M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4",
    "filter": "M4 6h16M7 12h10M10 18h4",
}


def _scale_path(d, k):
    """Scale SVG path data by k (arc flags and rotations are left alone)."""
    out, cmd, args = [], None, []
    tokens = re.findall(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?", d)

    def flush():
        if cmd is None:
            return
        if cmd in "Aa":
            vals = []
            for i, a in enumerate(args):
                j = i % 7
                vals.append(a if j in (2, 3, 4) else a * k)
        else:
            vals = [a * k for a in args]
        out.append(cmd + " ".join(f"{v:g}" if isinstance(v, int) else f"{round(v, 3):g}" for v in vals))

    for t in tokens:
        if t.isalpha():
            flush()
            cmd, args = t, []
        else:
            args.append(float(t))
    flush()
    return "".join(out)


class Script:
    """Collects FigCraft commands. Every creating call returns a reference for later steps."""

    def __init__(self):
        self.steps = []
        self.n = 0

    def do(self, command, params, ref=True):
        step = {"command": command, "params": params}
        if ref:
            self.n += 1
            step["as"] = f"n{self.n}"
        self.steps.append(step)
        return {"$ref": step["as"]} if ref else None


S = Script()


def c(color):
    """A token name becomes a variable binding; "#hex", "none" and None stay as they are."""
    if color is None or color == "none":
        return "none"
    if isinstance(color, str) and color in COLORS:
        return {"$var": color}
    return color


def _props(p):
    props = {}
    for k, v in p.items():
        if v is None:
            continue
        if k in ("fill", "stroke"):
            props[k] = c(v)
        elif k == "pad":
            props["padding"] = v
        elif k == "radius":
            props["cornerRadius"] = v
        elif k == "sw":
            props["strokeWeight"] = v
        elif k == "W":
            props["sizingH"] = v
        elif k == "H":
            props["sizingV"] = v
        else:
            props[k] = v
    return props


def frame(parent=None, name="Frame", x=0, y=0, w=100, h=100, fill=None, **p):
    """A frame. Shortcuts: layout, gap, pad, radius, stroke, sw, W/H (sizing: fixed|hug|fill), any node.set key."""
    params = {"name": name, "x": x, "y": y, "width": w, "height": h, "props": _props(dict(fill=fill or "none", **p))}
    if parent is not None:
        params["parent"] = parent
    return S.do("frame.create", params)


def row(parent, name="Row", gap=8, align="center", **p):
    p.setdefault("W", "hug")
    p.setdefault("H", "hug")
    return frame(parent, name, layout="horizontal", gap=gap, crossAlign=align, **p)


def col(parent, name="Column", gap=8, **p):
    p.setdefault("W", "fill")
    p.setdefault("H", "hug")
    return frame(parent, name, layout="vertical", gap=gap, **p)


def spacer(parent, name="Spacer"):
    return frame(parent, name, w=1, h=1, W="fill")


def text(parent, s, style="body", color="fg", name=None, x=0, y=0, width=None, **p):
    fam, fstyle, size, lh, ls, _ = TYPE[style]
    props = dict(fontFamily=fam, fontStyle=fstyle, fontSize=size, lineHeight=f"{lh}px", fill=c(color))
    if ls:
        props["letterSpacing"] = ls
    if style == "label":
        props["textCase"] = "upper"
    props.update(_props(p))
    if props.get("sizingH") == "fill":
        props.setdefault("textAutoResize", "height")
    params = {"text": s, "x": x, "y": y, "props": props, "name": name or s[:40]}
    if parent is not None:
        params["parent"] = parent
    if width:
        params["width"] = width
    return S.do("text.create", params)


def para(parent, s, style="body", color="fg", **p):
    """Text that fills its auto-layout parent's width and wraps."""
    return text(parent, s, style, color, W="fill", **p)


def icon(parent, name, size=24, color="fg", weight=1.75, fill=None):
    box = frame(parent, f"icon/{name}", w=size, h=size, W="fixed", H="fixed")
    d = ICONS[name] if size == 24 else _scale_path(ICONS[name], size / 24)
    props = {"stroke": c(color), "strokeWeight": weight * (1 if size >= 20 else size / 20), "strokeCap": "round",
             "strokeJoin": "round", "fill": c(fill) if fill else "none"}
    S.do("vector.create", {"path": d, "x": 0, "y": 0, "parent": box, "name": name, "props": props})
    return box


def dot(parent, color, size=10, name="dot"):
    return S.do("node.create", {"type": "ellipse", "parent": parent, "width": size, "height": size, "name": name,
                                "props": {"fill": c(color)}})


def rect(parent, name, w, h, fill, **p):
    return S.do("node.create", {"type": "rectangle", "parent": parent, "width": w, "height": h, "name": name,
                                "props": _props(dict(fill=fill, **p))})


def shadow(node, y=6, blur=20, color="#0000001F"):
    S.do("effect.add", {"ids": [node], "type": "dropShadow",
                        "effect": {"type": "dropShadow", "color": color, "offset": [0, y], "radius": blur}}, ref=False)


def mode(node, m):
    S.do("variable.setMode", {"ids": [node], "collection": "Color", "mode": m}, ref=False)


def component(node):
    S.do("component.create", {"ids": [node]}, ref=False)


def page(name):
    S.do("page.add", {"name": name}, ref=False)


def define_tokens():
    S.do("variable.createCollection", {"name": "Color", "modes": MODES}, ref=False)
    for name, (light, dark, eink, about) in COLORS.items():
        S.do("variable.create", {"collection": "Color", "name": name, "type": "color", "description": about,
                                 "values": {"Light": light, "Dark": dark, "E-ink": eink}}, ref=False)


# ---- scripture --------------------------------------------------------------------------------------------------------
HL = {"yellow": "hlYellow", "green": "hlGreen", "blue": "hlBlue", "pink": "hlPink", "orange": "hlOrange"}


def verses(parent, verses, style="readPhone", marks=None, paragraphs=(), width=None, number_color="accent",
           selected=None, eink=False):
    """Scripture as the reader draws it: words that wrap, each able to carry a highlight fill, thread underlines, a
    note's dotted underline or a selection. `verses` is [{v, text}] straight from content.json (wb text), never typed.

    marks: {verse: {"hl": color or {word index: color}, "threads": [token, ...] or {word index: [token]},
                    "note": [word indexes] or True, "question": True}}
    paragraphs: verse numbers that start a new paragraph. selected: (verse, first word, last word) drawn as a selection.
    """
    marks = marks or {}
    fam, fstyle, size, lh, _, _ = TYPE[style]
    block = col(parent, "Scripture", gap=round(lh * 0.35), W="fill" if width is None else "fixed")
    if width:
        S.do("node.set", {"ids": [block], "props": {"width": width}}, ref=False)
    flow = None
    for vi, verse in enumerate(verses):
        n = verse["v"]
        if flow is None or n in paragraphs:
            flow = frame(block, "Paragraph", layout="horizontal", wrap=True, gap=0, crossGap=0, crossAlign="baseline",
                         W="fill", H="hug")
        m = marks.get(n, {})
        num_box = row(flow, f"v{n}", gap=0, align="baseline", pad=[0, 0, 0, 0 if vi == 0 else 4])
        text(num_box, str(n) + " ", "verseNum", number_color, lineHeight=f"{lh}px", fontSize=max(11, round(size * 0.6)))
        if m.get("note") is True:  # a note on the whole verse: a dot after its number, as the reader draws it
            nd = frame(num_box, "verse note", w=10, h=round(lh * 0.55), W="fixed", H="fixed", layout="vertical",
                       mainAlign="min", crossAlign="min")
            frame(nd, "dot", w=6, h=6, radius=3, fill="accent", W="fixed", H="fixed")
        if m.get("question"):
            q = frame(num_box, "question mark", w=14, h=14, W="fixed", H="fixed", radius=7, fill="question",
                      layout="horizontal", mainAlign="center", crossAlign="center")
            text(q, "?", "caption", "onAccent", fontSize=10, lineHeight="12px")
        words = verse["text"].split(" ")
        hl, threads, note = m.get("hl"), m.get("threads"), m.get("note")
        for wi, word in enumerate(words):
            # the first word shares the number's box, so a number never ends a line on its own
            parent_box = num_box if wi == 0 else flow
            last = wi == len(words) - 1
            color = hl.get(wi) if isinstance(hl, dict) else hl
            tl = threads.get(wi, []) if isinstance(threads, dict) else (threads or [])
            noted = isinstance(note, list) and wi in note
            sel = selected and selected[0] == n and selected[1] <= wi <= selected[2]
            nxt_color = (hl.get(wi + 1) if isinstance(hl, dict) else hl) if not last else None
            joined = color and nxt_color == color  # a highlight runs across the space to the next word
            s = word + (" " if not last or vi < len(verses) - 1 else "")  # a space that is kept at the end of a word box
            tprops = dict(fontFamily=fam, fontStyle=fstyle, fontSize=size, lineHeight=f"{lh}px", fill=c("fg"))
            if noted:
                tprops.update(textDecoration="underline", textDecorationStyle="dotted",
                              textDecorationThickness=1.5, textDecorationOffset=4)
            if color or tl or sel:
                fill = "accentSoft" if sel else HL.get(color)
                box_props = {"layout": "horizontal", "sizingH": "hug", "sizingV": "hug", "fill": c(fill) if fill else "none",
                             "cornerRadius": 0 if joined else [0, 3, 3, 0] if not color else 3}
                if tl:
                    box_props.update({"stroke": c(tl[0]), "strokeTopWeight": 0, "strokeLeftWeight": 0,
                                      "strokeRightWeight": 0, "strokeBottomWeight": 3 if not eink else 2.5,
                                      "strokeAlign": "inside"})
                    if eink and tl[0] == "threadB":
                        box_props["dashes"] = [5, 3]
                if sel:
                    nxt_sel = not last and wi + 1 <= selected[2]
                    box_props["cornerRadius"] = 0 if nxt_sel else [0, 3, 3, 0] if wi > selected[1] else 3
                box = S.do("frame.create", {"name": f"w{n}.{wi}", "parent": parent_box, "props": box_props})
                S.do("text.create", {"text": s, "parent": box, "x": 0, "y": 0, "props": tprops, "name": word}, ref=False)
            else:
                S.do("text.create", {"text": s, "parent": parent_box, "x": 0, "y": 0, "props": tprops, "name": word}, ref=False)
    return block
