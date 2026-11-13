"""Lessons and documents (Word, PDF slides, Present), round 1. Finding 868e asks for an in-depth design of what the Word
documents and slides look like, and whether there can be a document builder like the page templates; a148 asks for ←
→ through slides in the viewer; 2089 that Show in folder go where the study's documents are. This round draws the
Documents pane, a builder that makes a document from a page's parts, the viewer, and the Looks. Document names are a
drawn sample; scripture is fetched with wb text.

    python design/features/documents/documents.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Documents"
V = K.verses_of(K.fetch(HERE, "num25-11-13", ["text", "Num 25:11-13"], as_json=False))
DOCS = [("Phinehas", "Word", "up to date", "docs"), ("Phinehas", "Slides", "behind: the thread changed", "pdf"),
        ("Tuesday study", "Slides", "up to date", "pdf")]


def slide(parent, v, w=640, dark=True):
    s = col(parent, f"slide {v['v']}", gap=14, pad=[36, 44, 36, 44], fill="#1E2A2F" if dark else "surface",
            radius=6, W="fixed", mainAlign="center")
    Q.put(s, 0, 0, w, int(w * 9 / 16))
    para(s, v["text"], "readDesk", "#F4EBDD" if dark else "fg")
    text(s, f"Numbers 25:{v['v']} KJV", "caption", "#B9A98E" if dark else "muted")
    return s


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
        it = K.line(p, f"{name} · {kind}", state, ic, right="Update · Open · Show in folder · Delete")


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "D2 · A: making a document from a page's parts",
              "A builder like a page template (868e): the page's parts (wb craft parts) in a list, each with a box, "
              "and per part what it becomes: a heading, a slide per verse, a paragraph, left out. The preview on the "
              "right is the document as it will be made. Saved builds become document templates.")
    w = K.app(f)
    p = K.panel(f, w, TB, 520, H - TB, "Make slides from Phinehas", "Choose the parts and what each becomes")
    for part, becomes, on in (("Title: Phinehas", "Title slide", True), ("Scripture: Numbers 25:11–13",
                              "A slide per verse", True), ("Paragraph: a drawn sample", "Speaker's notes", True),
                              ("Question: the covenant of peace", "Left out", False)):
        it = row(p, part, gap=10, pad=[8, 8, 8, 8], radius=8, stroke="line", sw=1, W="fill")
        frame(it, "box", w=18, h=18, radius=4, fill="accent" if on else None, stroke="accent" if on else "line",
              sw=1.5, W="fixed", H="fixed")
        text(it, part, "small", "fg" if on else "muted", W="fill")
        dd = row(it, "becomes", gap=4, pad=[3, 8, 3, 8], radius=6, stroke="line", sw=1)
        text(dd, becomes, "caption")
        icon(dd, "down", 12, "muted")
    b = row(p, "buttons", gap=8, W="fill")
    P.button(b, "Make", "primary", size="sm")
    P.button(b, "Keep as a document template", "ghost", size="sm")
    pv = col(f, "preview", gap=16, pad=[24, 24, 24, 24], fill="sunken", W="fixed", H="fixed", crossAlign="center")
    Q.put(pv, w + 520, TB, W - w - 520, H - TB)
    for v in V[:2]:
        slide(pv, v, 560)

    f = Q.win(r, PG, "D3 · A: the viewer pages with ← →",
              "Slides open one at a time, ← → or the arrows to page (a148), a strip of the slides under it, and "
              "Present for the whole screen. Word documents open as the app's preview, page by page.")
    w = K.app(f)
    vw = col(f, "viewer", gap=16, pad=[24, 24, 24, 24], fill="sunken", W="fixed", H="fixed", crossAlign="center")
    Q.put(vw, w, TB, W - w, H - TB)
    hd = row(vw, "head", gap=10, W="fill")
    text(hd, "Phinehas · Slides", "heading", W="fill")
    text(hd, "2 of 4", "caption", "muted")
    P.button(hd, "Present", "primary", "present", size="sm")
    mid = row(vw, "slide and arrows", gap=16)
    P.icon_button(mid, "left", "fg", size=40, icon_size=20, fill="surface")
    slide(mid, V[0], 760)
    P.icon_button(mid, "right", "fg", size=40, icon_size=20, fill="surface")
    strip = row(vw, "strip", gap=8)
    for i in range(4):
        frame(strip, f"thumb {i + 1}", w=96, h=54, radius=4, fill="#1E2A2F", stroke="accent" if i == 1 else "line",
              sw=2 if i == 1 else 1, W="fixed", H="fixed")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "D4 · B: Looks you can see",
              "The Look of a document (wb docs looks: Preview, Classic, Ink saver, Large print, Modern, and your own) "
              "chosen from small pictures of the same slide, not names. Your own Look is a copy with its dials: "
              "typeface, size, colors.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Looks", "How new documents are drawn · wb docs look")
    g = row(p, "looks", gap=16, wrap=True, W="fill")
    for name, dark in (("Preview", True), ("Classic", False), ("Ink saver", False), ("Large print", False),
                       ("Modern", True)):
        it = col(g, name, gap=6, W="hug")
        slide(it, V[2], 300, dark)
        text(it, name, "smallStrong" if name == "Classic" else "small")

    f = Q.win(r, PG, "D5 · Where a made document goes",
              "After Make, a line says where the file is, with Show in folder (2089). With the person's real study "
              "the documents stay where the Python app keeps them; the line names that folder so it is never a "
              "surprise. A scratch study's documents go beside it.")
    w = K.app(f)
    p = K.panel(f, w, TB, W - w, H - TB, "Documents", "Word files and slide decks made from your study")
    for name, kind, state, ic in DOCS:
        K.line(p, f"{name} · {kind}", state, ic)
    t = row(f, "made", gap=10, pad=[10, 14, 10, 14], radius=10, fill="fg", W="hug")
    Q.put(t, w + 300, H - 90)
    text(t, "Made Phinehas · Slides, in Documents\\Bible Workbench", "small", "bg")
    P.button(t, "Show in folder", "secondary", size="sm")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Lessons and documents, round 1",
                  "Today (D1); A, a builder from a page's parts and a viewer that pages (D2, D3); B, Looks as pictures "
                  "and where files go (D4, D5).")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Documents", sheets)
