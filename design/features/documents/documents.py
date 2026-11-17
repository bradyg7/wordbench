"""Lessons and documents (Word, PDF slides, Present). Finding 868e asks for an in-depth design of what the Word
documents and slides look like, and a document builder like the page templates; a148 asks for arrows through slides in
the viewer; 2089 that Show in folder go where the app says the file went. Decided 2026-11-16: A and B go together (the
builder from a page's parts, the viewer, Looks from pictures, a line after Make saying where the file is); a document
keeps its own choices (parts, what each becomes, its Look), so there is no separate template and a document's menu has
Make another like this; a source is a page, a folder, a passage or a lesson. Document and page names are a drawn
sample; scripture is fetched with wb text and a phrase is cut from it by word position.

    python design/features/documents/documents.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import M, P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Documents"
V = K.verses_of(K.fetch(HERE, "num25-11-13", ["text", "Num 25:11-13"], as_json=False))
DOCS = [("Phinehas", "Word", "up to date", "docs"), ("Phinehas", "Slides", "behind: the thread changed", "pdf"),
        ("Tuesday study", "Slides", "up to date", "pdf")]
DOCS2 = [("Phinehas", "Word", "up to date", "docs"), ("Phinehas", "Slides", "behind: the folder changed", "pdf"),
         ("Tuesday study", "Slides", "up to date", "pdf")]

# the Looks: the same slide in each one's colors (a drawn sample; the app's own Looks are wb docs looks)
LOOKS = {
    "Preview": dict(bg="#1E2A2F", fg="#F4EBDD", ref="#B9A98E", stroke=None, sw=0, size=1.0, words=14),
    "Classic": dict(bg="#FFFFFF", fg="#1A1A1A", ref="#6B6B6B", stroke="#D8D4CC", sw=1, size=1.0, words=14),
    "Ink saver": dict(bg="#FFFFFF", fg="#111111", ref="#333333", stroke="#222222", sw=1.5, size=1.0, words=14),
    "Large print": dict(bg="#FFFFFF", fg="#000000", ref="#222222", stroke="#D8D4CC", sw=1, size=1.4, words=9),
    "Modern": dict(bg="#EEF2F7", fg="#1B2A41", ref="#2F6FBF", stroke=None, sw=0, size=1.0, words=14, bar="#2F6FBF"),
    "My Look": dict(bg="#F6EFE0", fg="#3B2F1E", ref="#8A6A2F", stroke="#E0D3B5", sw=1, size=1.0, words=14),
}
IN_USE = "Classic"
SELECTED = "Ink saver"


def _data_text():
    """The verses as the data file holds them (written by K.fetch), read back from disk."""
    import json
    d = json.loads((HERE / "data" / "num25-11-13.json").read_text(encoding="utf-8"))
    return {x["v"]: x["text"] for x in K.verses_of(d["output"])}


DATA_TEXT = _data_text()


def cut(v, n):
    """The start of a verse, n words, cut from the fetched text by word position."""
    text_ = v["text"]
    toks = text_.split()
    if n >= len(toks):
        return text_
    phrase = " ".join(toks[i] for i in range(n))
    assert phrase in text_ and text_.startswith(phrase), "the phrase is not the start of the verse"
    assert DATA_TEXT[v["v"]] == text_, "the fetched text is not the data file's text"
    return phrase + "…"


def slide(parent, v, w=640, look="Preview", words=None):
    """One slide, whole, at width w (16:9): the verse (or its start) and its reference, in a Look's colors."""
    lk = LOOKS[look]
    sc = w / 640
    h = int(w * 9 / 16)
    pad = max(8, int(32 * sc))
    s = frame(parent, f"slide {look} {v['v']}", w=w, h=h, fill=lk["bg"], radius=6 if w > 200 else 3,
              stroke=lk["stroke"], sw=lk["sw"] or None, layout="vertical", gap=max(4, int(12 * sc)),
              pad=[pad, pad, pad, pad], W="fixed", H="fixed", clip=True, mainAlign="center")
    if lk.get("bar"):
        frame(s, "bar", w=max(3, int(36 * sc)), h=max(2, int(4 * sc)), fill=lk["bar"], W="fixed", H="fixed")
    fs = max(7, round(22 * sc * lk["size"]))
    n = words if words else (lk["words"] if w < 420 else None)
    body = cut(v, n) if n else v["text"]
    para(s, body, "readDesk", lk["fg"], fontSize=fs, lineHeight=f"{round(fs * 1.4)}px")
    rs = max(9, round(13 * sc * lk["size"]))
    text(s, f"Numbers 25:{v['v']} KJV", "caption", lk["ref"], fontSize=rs, lineHeight=f"{round(rs * 1.4)}px")
    return s


def title_slide(parent, title, w=640, look=IN_USE):
    """The title slide: the document's title, no verse."""
    lk = LOOKS[look]
    sc = w / 640
    h = int(w * 9 / 16)
    pad = max(8, int(32 * sc))
    s = frame(parent, f"slide {look} title", w=w, h=h, fill=lk["bg"], radius=6, stroke=lk["stroke"],
              sw=lk["sw"] or None, layout="vertical", gap=max(4, int(12 * sc)), pad=[pad, pad, pad, pad],
              W="fixed", H="fixed", clip=True, mainAlign="center", crossAlign="center")
    fs = max(12, round(40 * sc))
    text(s, title, "readDesk", lk["fg"], fontSize=fs, lineHeight=f"{round(fs * 1.3)}px")
    return s


def swatch(parent, look, w=60):
    """A Look as a tiny picture (lines for the words), for a head where a whole slide will not fit."""
    lk = LOOKS[look]
    h = int(w * 9 / 16)
    s = frame(parent, f"swatch {look}", w=w, h=h, fill=lk["bg"], radius=3, stroke=lk["stroke"] or "line", sw=1,
              layout="vertical", gap=3, pad=[6, 6, 6, 6], W="fixed", H="fixed", clip=True, mainAlign="center")
    frame(s, "line", w=w - 12, h=2, fill=lk["fg"], W="fixed", H="fixed")
    frame(s, "line", w=int((w - 12) * .7), h=2, fill=lk["fg"], W="fixed", H="fixed")
    frame(s, "ref", w=int((w - 12) * .3), h=2, fill=lk["ref"], W="fixed", H="fixed")
    return s


def link(parent, s):
    return text(parent, s, "small", "accent")


# --- the Documents list ---------------------------------------------------------------------------------------

def doc_row(parent, name, kind, state, ic, more=True, on=False):
    it = K.line(parent, f"{name} · {kind}", state, ic, on=on)
    if more:
        P.icon_button(it, "more", "muted", size=28, icon_size=16)
    return it


def row_menu(f, x, y, w=300):
    m = K.floating(f, "document menu", x, y, w, pad=(8, 8, 8, 8), gap=1)
    for lab, hot in (("Update", False), ("Open", False), ("Show in folder", False), ("Make another like this…", True),
                     ("Stop updating it", False), ("Delete", False)):
        it = row(m, lab, gap=8, pad=[8, 10, 8, 10], radius=8, W="fill", fill="accentSoft" if hot else None)
        text(it, lab, "smallStrong" if hot else "small", "fg")
        if lab == "Show in folder":
            pass
    return m


# --- the builder (D2, D9) ---------------------------------------------------------------------------------------

def seg(parent, opts, on):
    s = row(parent, "switch", gap=0, pad=[2, 2, 2, 2], radius=8, fill="sunken", stroke="line", sw=1)
    for o in opts:
        c = row(s, o, gap=0, pad=[5, 14, 5, 14], radius=6, fill="surface" if o == on else None,
                stroke="line" if o == on else None, sw=1 if o == on else None)
        text(c, o, "smallStrong" if o == on else "small", "fg" if o == on else "muted")
    return s


def builder_head(p, title, what="Slides", look=IN_USE):
    hd = col(p, "head", gap=2, W="fill")
    text(hd, title, "title")
    para(hd, "Choose the parts and what each becomes", "small", "muted")
    r = row(p, "format and look", gap=14, W="fill")
    seg(r, ["Word", "Slides"], what)
    spacer(r)
    lk = row(r, "look in use", gap=8, pad=[4, 8, 4, 4], radius=8, stroke="line", sw=1)
    swatch(lk, look, 48)
    text(lk, f"Look: {look}", "small")
    icon(lk, "down", 12, "muted")
    return r


PARTS = (("Title: Phinehas", "Title slide", True), ("Scripture: Numbers 25:11–13", "A slide per verse", True),
         ("Paragraph: a drawn sample", "Speaker's notes", True), ("Question: a drawn sample", "Left out", False))


WORD_BECOMES = ("Heading", "Verses as a block quote", "Paragraph", "Left out")


def builder_parts(p, word=False):
    for i, (part, becomes, on) in enumerate(PARTS):
        if word:
            becomes = WORD_BECOMES[i]
        it = row(p, part, gap=10, pad=[8, 8, 8, 8], radius=8, stroke="line", sw=1, W="fill")
        frame(it, "box", w=18, h=18, radius=4, fill="accent" if on else None, stroke="accent" if on else "line",
              sw=1.5, W="fixed", H="fixed")
        text(it, part, "small", "fg" if on else "muted", W="fill", maxLines=1)
        dd = row(it, "becomes", gap=4, pad=[3, 8, 3, 8], radius=6, stroke="line", sw=1)
        text(dd, becomes, "caption")
        icon(dd, "down", 12, "muted")
    b = row(p, "buttons", gap=8, W="fill")
    P.button(b, "Make", "primary", size="sm")


def preview_slides(pv, w):
    """The document as it will be made: the title slide, then a slide per verse, as a scrolling column."""
    text(pv, "Preview · 4 slides", "small", "muted")
    title_slide(pv, "Phinehas", w, IN_USE)
    for v in V:
        slide(pv, v, w, IN_USE, words=999)


def word_page(pv, w=520):
    """The Word document as one white page: the title as a heading, the reference, the verses, a paragraph."""
    text(pv, "Preview · 1 page", "small", "muted")
    pg = col(pv, "page", gap=12, pad=[40, 44, 40, 44], fill="#FFFFFF", radius=2, stroke="#D8D4CC", sw=1,
             W="fixed", H="fixed", clip=True)
    Q.S.do("node.set", {"ids": [pg], "props": {"width": w, "height": 640}}, ref=False)
    text(pg, "Phinehas", "readDesk", "#1A1A1A", fontSize=30, lineHeight="38px")
    text(pg, "Numbers 25:11–13", "caption", "#6B6B6B", fontSize=12, lineHeight="16px")
    qc = col(pg, "block quote", gap=8, pad=[2, 0, 2, 14], W="fill", stroke="#D8D4CC", strokeLeftWeight=3,
             strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    for v in V:
        para(qc,f"{v['v']} {v['text']}", "readDesk", "#1A1A1A", fontSize=15, lineHeight="22px")
    para(pg, "Your own words, as you wrote them", "readDesk", "#6B6B6B", fontSize=15, lineHeight="22px")


# --- the viewer (D3, D7, D8) ------------------------------------------------------------------------------------

def viewer_content(parent, slide_w, compact=False, strip=True, pos=2):
    """pos is the slide shown (1 to 4; 1 is the title slide); the arrow with nowhere to go is muted."""
    first, last = pos == 1, pos == 4
    cnt = f"{pos} of 4"

    def shown(par, w):
        if pos == 1:
            return title_slide(par, "Phinehas", w, IN_USE)
        return slide(par, V[pos - 2], w, IN_USE, words=999 if compact else None)

    if not compact:
        hd = row(parent, "head", gap=10, W="fill")
        text(hd, "Phinehas · Slides", "heading", W="fill", maxLines=1)
        text(hd, cnt, "caption", "muted")
        P.button(hd, "Present", "primary", "present", size="sm")
        mid = row(parent, "slide and arrows", gap=16)
        P.icon_button(mid, "left", "muted" if first else "fg", size=40, icon_size=20,
                      fill="sunken" if first else "surface")
        shown(mid, slide_w)
        P.icon_button(mid, "right", "muted" if last else "fg", size=40, icon_size=20,
                      fill="sunken" if last else "surface")
    else:
        hd = row(parent, "head", gap=6, W="fill")
        icon(hd, "drag", 16, "muted")
        text(hd, "Phinehas · Slides", "smallStrong", W="fill", maxLines=1)
        P.icon_button(hd, "close", "muted", size=26, icon_size=14)
        shown(parent, slide_w)
        ct = row(parent, "controls", gap=8, W="fill")
        P.icon_button(ct, "left", "muted" if first else "fg", size=32, icon_size=18, fill="sunken")
        text(ct, cnt, "caption", "muted")
        P.icon_button(ct, "right", "muted" if last else "fg", size=32, icon_size=18, fill="sunken")
        spacer(ct)
        P.button(ct, "Present", "primary", "present", size="sm")
    if strip:
        st = row(parent, "strip", gap=8)
        for i in range(4):
            frame(st, f"thumb {i + 1}", w=96, h=54, radius=4, fill="#FFFFFF",
                  stroke="accent" if i == pos - 1 else "line", sw=2 if i == pos - 1 else 1, W="fixed", H="fixed")


# --- sheets ------------------------------------------------------------------------------------------------------

def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "D1 · Today: the Documents pane",
              "As built: each document made from a thread, a passage, a lesson or a page, with how it stands, Update, "
              "Open, Show in folder and Delete; Craft makes a new one from a fixed structure. The Word preview is the "
              "app's own (868e: preferred to the file's), slides are PDF pages; Show in folder opens Documents\\Bible "
              "Workbench (2089).")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Documents", "Word files and slide decks made from your study")
    for name, kind, state, ic in DOCS:
        K.line(p, f"{name} · {kind}", state, ic, right="Update · Open · Show in folder · Delete")


def making(cv):
    r = row(cv, "making", gap=64, align="min")
    f = Q.win(r, PG, "D2 · Making a document from a page's parts",
              "The builder: the page's parts in a list, each with a box and what it becomes (a heading, a slide per "
              "verse, a paragraph, left out). The head has a plain two-way switch, Word or Slides, and the Look in "
              "use as a small picture with its name (it opens the Looks, D4). The preview on the right is the "
              "document as it will be made: four slides in a scrolling column, the title slide first, then one "
              "per verse (the pane's edge cuts the last, as a list would be). The choices are kept with the "
              "document, so there is nothing else to save.")
    w = K.app(f)
    p = col(f, "builder", gap=12, pad=[20, 22, 20, 22], fill="surface", W="fixed", H="fixed", clip=True,
            stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(p, w, TB, 520, H - TB)
    builder_head(p, "Make slides from Phinehas")
    builder_parts(p)
    pv = col(f, "preview", gap=16, pad=[24, 24, 24, 24], fill="sunken", W="fixed", H="fixed", clip=True,
             crossAlign="center")
    Q.put(pv, w + 520, TB, W - w - 520, H - TB)
    preview_slides(pv, 480)

    menu_and_picker(r)

    r2 = row(cv, "making word", gap=64, align="min")
    f = Q.win(r2, PG, "D11 · The same parts as a Word document",
              "The same builder with the switch on Word. Each part's menu now offers what a Word file has: Heading, "
              "Verses as a block quote, Paragraph, Left out. The preview is the page as it will be made: the title "
              "as a heading, the reference and the verses whole, and a paragraph holding your own words as you "
              "wrote them.")
    w = K.app(f)
    p = col(f, "builder", gap=12, pad=[20, 22, 20, 22], fill="surface", W="fixed", H="fixed", clip=True,
            stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(p, w, TB, 520, H - TB)
    builder_head(p, "Make a Word document from Phinehas", what="Word")
    builder_parts(p, word=True)
    pv = col(f, "preview", gap=16, pad=[24, 24, 24, 24], fill="sunken", W="fixed", H="fixed", clip=True,
             crossAlign="center")
    Q.put(pv, w + 520, TB, W - w - 520, H - TB)
    word_page(pv, 560)


def menu_and_picker(r):
    f = Q.win(r, PG, "D6 · A document's menu, and Make another like this",
              "Each document keeps its parts, what each becomes and its Look, so its menu is Update, Open, Show in "
              "folder, Make another like this…, Stop updating it and Delete. Make another like this opens "
              "a picker of pages and folders; choosing one opens the builder on it with the same choices and Look. "
              "The menu opens beside the row's menu button and the picker is the next step.")
    w = K.app(f)
    p = K.panel(f, w, TB, 520, H - TB, "Documents", "Word files and slide decks made from your study")
    for i, (name, kind, state, ic) in enumerate(DOCS2):
        doc_row(p, name, kind, state, ic, on=(i == 1))
    Q.put(text(f, "1 · the row's menu", "small", "muted"), w + 540, TB + 90)
    row_menu(f, w + 540, TB + 120, 260)
    Q.put(text(f, "2 · after choosing Make another like this…", "small", "muted"), w + 830, TB + 90)
    pk = K.floating(f, "picker", w + 830, TB + 120, 400, pad=(14, 14, 14, 14), gap=10)
    para(pk, "Make another like Phinehas · Slides from:", "smallStrong")
    P.field(pk, "Search pages and folders", None, icon_name="search", height=34)
    for lab, ic in (("Tuesday study", "page"), ("Salt", "folder"), ("Zeal in Numbers 25", "page"), ("Anna", "folder"),
                    ("Romans study", "page")):
        it = row(pk, lab, gap=10, pad=[8, 10, 8, 10], radius=8, W="fill")
        icon(it, ic, 16, "muted")
        text(it, lab, "small", W="fill")
    para(pk, "It keeps the parts, what each becomes, and the Look: Classic.", "caption", "muted")


def looking(cv):
    r = row(cv, "looking", gap=64, align="min")
    f = Q.win(r, PG, "D3 · The viewer pages with the arrow keys",
              "Slides open one at a time; the arrow keys or the two arrows page through them (a148), a strip of "
              "the slides is under it, and Present fills the screen. The arrows stop at the first and the last "
              "slide, and the one with nowhere to go is muted (second state below). Word documents open as the "
              "app's preview, page by page.")
    w = K.app(f)
    vw = col(f, "viewer", gap=16, pad=[24, 24, 24, 24], fill="sunken", W="fixed", H="fixed", crossAlign="center",
             clip=True)
    Q.put(vw, w, TB, W - w, H - TB)
    viewer_content(vw, 640)
    text(vw, "The first slide: 1 of 4, the left arrow muted", "small", "muted")
    mid = row(vw, "slide and arrows", gap=16)
    P.icon_button(mid, "left", "muted", size=40, icon_size=20, fill="sunken")
    title_slide(mid, "Phinehas", 220, IN_USE)
    P.icon_button(mid, "right", "fg", size=40, icon_size=20, fill="surface")
    text(vw, "1 of 4", "caption", "muted")


def looks(cv):
    r = row(cv, "looks", gap=64, align="min")
    f = Q.win(r, PG, "D4 · Choosing a Look from pictures",
              "Every picture shows the same reference and the same start of the verse, so only the styling "
              "differs. A Look is styling only. Ink saver is under the pointer (ringed); the button under the "
              "grid makes it the Look new documents use. Classic is marked In use now. Your own Looks are made in "
              "Settings.", w=1440)
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Looks", "How new documents are drawn")
    g = row(p, "looks", gap=14, wrap=True, W="fill")
    for name in LOOKS:
        it = col(g, name, gap=6, pad=[5, 5, 5, 5], radius=10, W="hug", stroke="accent" if name == SELECTED else None,
                 sw=3 if name == SELECTED else None)
        slide(it, V[0], 360, name, words=10)
        nm = row(it, "name", gap=8, W="fill")
        text(nm, name, "smallStrong" if name == IN_USE else "small")
        if name == "My Look":
            text(nm, "your own", "caption", "muted")
        if name == IN_USE:
            text(nm, "In use", "caption", "accent")
    P.button(p, "Use this Look for new documents", "primary", size="sm")


def where(cv):
    r = row(cv, "where", gap=64, align="min")
    f = Q.win(r, PG, "D5 · Where a made document went",
              "After Make, a line names the folder the file is in, wherever that is (the sample here is Documents\\"
              "Bible Workbench). Show in folder opens that folder with the file picked out; if the file is gone, "
              "the line says so. Under it, every verse in the made file has been checked against the Bible (this "
              "page holds three); a file that fails is not kept.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Documents", "Word files and slide decks made from your study")
    for name, kind, state, ic in DOCS2:
        doc_row(p, name, kind, state, ic)
    t = col(f, "made", gap=4, pad=[12, 16, 12, 16], radius=10, fill="fg", W="hug")
    Q.put(t, w + 260, H - 110)
    tr = row(t, "made line", gap=14, W="hug")
    text(tr, "Made Phinehas · Slides, in Documents\\Bible Workbench", "small", "bg")
    P.button(tr, "Show in folder", "secondary", size="sm")
    text(t, "3 verses checked", "caption", "#C9C4BA")


def narrow(f, x, wd):
    """A column of wd px: the builder with the parts on top, Make under them, the preview under that."""
    lb = frame(f, "builder column", x=x, y=TB, w=wd, h=H - TB, fill="surface", layout="vertical", W="fixed",
               H="fixed", clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0,
               strokeBottomWeight=0)
    M.folder_strip(lb, ["Make slides"], "Make slides", actions=("minimize", "expand", "close"))
    pg = col(lb, "page", gap=12, pad=[14, 16, 14, 16], W="fill", H="fill", clip=True)
    builder_head(pg, "Make slides from Phinehas")
    builder_parts(pg)
    pv = col(pg, "preview", gap=8, pad=[10, 10, 10, 10], fill="sunken", radius=8, W="fill", crossAlign="center")
    text(pv, "Preview · 4 slides", "small", "muted")
    title_slide(pv, "Phinehas", wd - 32 - 20, IN_USE)
    slide(pv, V[0], wd - 32 - 20, IN_USE, words=999)
    return lb


def conditions(cv):
    r = row(cv, "cond a", gap=64, align="min")
    # D7: among other tabs
    f = Q.win(r, "Real conditions", "D7 · Among other tabs",
              "The viewer is one tab of four in the side pane (Phinehas · Slides, Phinehas, Concordance, Documents) "
              "beside the reader on Numbers 25:11–13. The tab holds the same viewer as D3, the slide whole with its "
              "arrows, Present and strip; the reader keeps its place.")
    w = K.app(f)
    K.reader(f, w, W - w - 640, V, "Numbers 25")
    body = M.pane(f, W - 640, TB, 640, H - TB, ["Phinehas · Slides", "Phinehas", "Concordance", "Documents"],
                  "Phinehas · Slides")
    inner = col(body, "viewer", gap=14, pad=[12, 12, 12, 12], fill="sunken", radius=8, W="fill", H="fill",
                crossAlign="center")
    viewer_content(inner, 440)

    # D8: floating
    f = Q.win(r, "Real conditions", "D8 · Floating",
              "The viewer as a small floating pane, about 340 wide, over the reader: the slide whole, 2 of 4, the "
              "two arrows and Present, with a drag handle and a close button in its head. The verse the reader was on stays in view beside it.")
    w = K.app(f)
    K.reader(f, w, W - w, V, "Numbers 25")
    fl = K.floating(f, "float", W - 340 - 60, TB + 400, 340, pad=(12, 12, 12, 12), gap=10)
    viewer_content(fl, 314, compact=True, strip=False)

    r = row(cv, "cond b", gap=64, align="min")
    # D9: narrow
    f = Q.win(r, "Real conditions", "D9 · Narrow",
              "A 420px column beside the reader: the parts list on top, Make under it so it is reachable without "
              "scrolling past the preview, and the preview under that. Nothing is drawn differently from D2; the "
              "same parts stack.", w=1100)
    w = K.app(f)
    K.reader(f, w, 1100 - w - 420, V, "Numbers 25")
    narrow(f, 1100 - 420, 420)

    # D10: years of study
    f = Q.win(r, "Real conditions", "D10 · Years of study: 318 documents",
              "The Documents pane at 318 documents, 12 behind: one head line with Update the 12 as plain text, a "
              "plain search, and the list grouped by what each was made from (a page with the page icon, a folder with the "
              "folder icon and its color dot) with counts, each "
              "group folded; the first is open to a few rows and Show all 318 opens the rest. Each row keeps its "
              "actions in its menu (D6), not a line of links.")
    w = K.app(f)
    K.reader(f, w, W - w - 640, V, "Numbers 25")
    p = K.panel(f, W - 640, TB, 640, H - TB, "Documents", None)
    hl = row(p, "count", gap=10, W="fill")
    text(hl, "318 documents · 12 behind", "small", "muted", W="fill")
    link(hl, "Update the 12")
    P.field(p, "Search documents", None, icon_name="search", height=34)
    groups = (("Phinehas", "page", 64, None), ("Tuesday study", "page", 47, None), ("Zeal", "folder", 33, "#C0562F"),
              ("Zeal in Numbers 25", "page", 29, None), ("Romans study", "folder", 27, "#2F6FBF"),
              ("Salt", "folder", 24, "#3D8B5F"), ("Anna", "folder", 21, "#8A6A2F"), ("Psalm 106", "page", 19, None))
    for i, (g, ic, n, dot) in enumerate(groups):
        hd = row(p, f"group {g}", gap=8, pad=[6, 8, 6, 8], radius=8, W="fill", fill="sunken" if i == 0 else None)
        icon(hd, "down" if i == 0 else "right", 14, "muted")
        icon(hd, ic, 16, "muted")
        if dot:
            frame(hd, "color dot", w=10, h=10, radius=5, fill=dot, W="fixed", H="fixed")
        text(hd, g, "smallStrong", W="fill")
        text(hd, str(n), "caption", "muted")
        if i == 0:
            for name, kind, state, dic in DOCS2[:2]:
                dr = doc_row(p, name, kind, state, dic)
    rest = row(p, "more groups", gap=8, pad=[6, 8, 6, 8], W="fill")
    text(rest, "10 more groups · 54 documents", "small", "muted")
    link(p, "Show all 318")


def sheets(board):
    cv = Q.section(board, "Today", 3200)
    Q.sheet_title(cv, "Lessons and documents",
                  "Documents made from a page, a folder, a passage or a lesson, as Word documents or PDF slides. "
                  "Today's pane (D1); making a document, as slides and as Word, and a document's menu (D2, D11, D6); looking at it (D3); Looks "
                  "(D4); where it went (D5); and the real conditions (D7 to D10).")
    today(cv)
    cv = Q.section(board, "Making a document", 3200)
    Q.sheet_title(cv, "Making a document", "The builder from a page's parts, and a document's own menu.")
    making(cv)
    cv = Q.section(board, "Looking at it", 3200)
    Q.sheet_title(cv, "Looking at it", "The viewer: one slide at a time, the arrow keys, and Present.")
    looking(cv)
    cv = Q.section(board, "Looks", 3200)
    Q.sheet_title(cv, "Looks", "How a document is drawn, chosen from pictures of the same slide.")
    looks(cv)
    cv = Q.section(board, "Where it went", 3200)
    Q.sheet_title(cv, "Where it went", "The line after Make, and the check of every verse.")
    where(cv)
    cv = Q.section(board, "Real conditions", 3200)
    Q.sheet_title(cv, "The real conditions",
                  "Among other tabs, floating, narrow, and at years of study; each uses the same drawing as the "
                  "windows above.")
    conditions(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Documents", sheets)
