"""R2 of the redesign list (docs/debug-spec.md, 2026-11-09): the Shelf (findings 1d0e, 3fa7, a484). The design round: the
existing sheets (S1, SH1, SH2 of the phase 2b round) checked against the Notebook's rework, and the alternative the person
asked about drawn beside them: an Obsidian-style file tree whose folders hold sets, pages, places and documents. Nothing is
built from these sheets until the person chooses (docs/redesign-R2.md).

    python design/r2.py     # writes design/r2.figcraft and design/exports/r2/*.png

It reuses phase2b.py's, workspace.py's and filter.py's helpers, so the sheets look like the rounds before. Scripture on the
sheets (the reader behind each window, the Strong's entry) comes from content.json, fetched from the database; the item
names are the person's own set names, or demo names about the Phinehas demo. No scripture is typed here.
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
import workspace as WS  # noqa: E402
from figlib import S, col, frame, icon, para, rect, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "The Shelf"
PG = "R2: the Shelf"
PANE_W = 440

# A folder icon the icon set does not have yet (the file tree needs one).
F.ICONS["folder"] = "M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 9.7v7.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"
KIND_ICON = {"folder": "folder", "place": "place", "thread": "threads", "page": "notebook", "word": "word", "document": "docs",
             "pdf": "pdf", "lesson": "book", "pane": "dock", "set": "shelf"}


# ---- the pieces of a tree ----------------------------------------------------------------------------------------------
def tree_row(parent, title, depth=0, kind="folder", open_=True, on=False, count=None, mark=None, live=False, tag=None,
             drop=False, name=None, strong=False):
    """One row of the Shelf's tree, in the Notebook sidebar's own look (an arrow when it holds things, an icon, the name).
    mark: the colour of a folder's open tabs; live: a leaf that is open now (a dot); tag: a quiet word (Word, PDF)."""
    r = row(parent, name or f"shelf/{title}", gap=7, pad=[5, 8, 5, 8 + 18 * depth], radius=8, W="fill",
            fill="accentSoft" if (on or drop) else None, stroke="accent" if drop else None, sw=1 if drop else None)
    if kind == "folder":
        icon(r, "down" if open_ else "right", 14, "muted")
    else:
        frame(r, "no arrow", w=14, h=14, W="fixed", H="fixed")
    icon(r, KIND_ICON[kind], 16, "accent" if (on or drop) else "muted")
    text(r, title, "smallStrong" if (on or strong or kind == "folder") else "small", "accent" if on else "fg", W="fill", maxLines=1)
    if tag:
        text(r, tag, "caption", "muted")
    if live:
        F.dot(r, "accent", 8)
    if mark:
        F.dot(r, mark, 8)
    if count is not None:
        b = row(r, "count", pad=[0, 6, 0, 6], fill="sunken", radius=999)
        text(b, str(count), "caption", "muted", fontSize=11, lineHeight="16px")
    return r


def drop_line(parent, depth=0):
    ln = rect(parent, "drop line", 10, 2, "accent", sizingH="fill")
    return ln


def shelf_pane(f, tabs=("Shelf",), active="Shelf"):
    """The Shelf docked at the left (as S1 drew it). → the pane's body."""
    b = Q.column(f, 0, PANE_W, list(tabs), active, side="left")
    return b


def footer(b, items, open_n=None):
    """The selection's bar at the foot of the pane: what is selected, then Open all / Close all / + Add."""
    spacer(b)
    ft = col(b, "selection bar", gap=8, pad=[10, 12, 10, 12], fill="sunken", radius=10, W="fill")
    hr = row(ft, "head", gap=8, W="fill")
    icon(hr, "folder", 16, "accent")
    text(hr, items[0], "smallStrong", W="fill", maxLines=1)
    text(hr, items[1], "caption", "muted")
    ar = row(ft, "actions", gap=8, W="fill")
    P.button(ar, "Open all", "primary", "dock", size="sm")
    P.button(ar, "Close all", "secondary", "close", size="sm")
    P.button(ar, "Add", "soft", "plus", size="sm")
    return ft


def tree_phinehas(b, selected=None, drag=False, drop_on=None, line_after=None, hover_open=False):
    """The Phinehas demo's Shelf: the person's own set names, with pages, a place, a thread and documents beside them."""
    P.field(b, "Find in the Shelf", icon_name="search", height=36)
    t = col(b, "tree", gap=1, W="fill")
    tree_row(t, "Phinehas study", 0, "folder", True, count=9, mark="threadA" if False else None, on=selected == "Phinehas study")
    wz = tree_row(t, "Word study: zeal", 1, "folder", True, count=4, mark="threadB", on=selected == "Word study: zeal")
    if hover_open:
        P.button(wz, "Open all", "primary", "dock", size="sm")
    tree_row(t, "H7065 · Strong's", 2, "pane", live=True, name="shelf/H7065")
    tree_row(t, "Every use · zealous", 2, "pane", live=True, name="shelf/Every use")
    tree_row(t, "Interlinear · Numbers 25:7–13", 2, "pane", name="shelf/Interlinear")
    tree_row(t, "Word study: H7065", 2, "page", live=True, name="shelf/Word study page")
    tree_row(t, "Covenant of peace", 1, "folder", False, count=3, drop=drop_on == "Covenant of peace",
             on=selected == "Covenant of peace")
    tree_row(t, "Lesson: Phinehas", 1, "page", on=selected == "Lesson: Phinehas", name="shelf/Lesson page")
    tree_row(t, "Numbers 25:1–18", 1, "place")
    tree_row(t, "Phinehas", 1, "thread")
    if line_after:
        drop_line(t)
    tree_row(t, "Phinehas: Verse by Verse", 1, "pdf", tag="PDF", name="shelf/Verse by Verse")
    tree_row(t, "Phinehas: Speaker Script", 1, "document", tag="Word", name="shelf/Speaker Script")
    tree_row(t, "Romans", 0, "folder", False, count=2)
    tree_row(t, "ruth read 11/2/26", 0, "folder", False, count=11)
    tree_row(t, "Help", 0, "folder", False, count=1)
    return t


def ghost(f, x, y, label, kind):
    """A row being dragged: it follows the pointer."""
    g = row(f, "being dragged", gap=8, pad=[6, 12, 6, 10], fill="surface", radius=8, stroke="accent", sw=1, W="hug")
    Q.put(g, x, y)
    shadow(g, 6, 18, "#00000033")
    icon(g, KIND_ICON[kind], 16, "accent")
    text(g, label, "smallStrong")
    return g


def window(parent, title, about, active="Shelf"):
    f = Q.win(parent, PG, title, about)
    Q.toolbar(f, active=active)
    return f


# ---- the sheets ----------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "R2 · The Shelf: sets in folders, or a file tree",
                  "The person's notes 1d0e, 3fa7 and a484: \"shelf needs to be figured out asap\"; \"like a file "
                  "organization system, similar to how obsidian organize files\"; \"why can i click a particular tab in a "
                  "set in my shelf, but not actually open the whole set of tabs.\" A1 is the accepted design (S1, SH1, SH2 "
                  "of 2026-11-04) checked against the Notebook's rework and corrected where the rework or the files "
                  "changed it. B1 to B5 are the alternative: one tree whose folders hold sets, pages, places, threads and "
                  "documents, opened together with Open all. Both meet a484 the same way; they differ in how the Shelf "
                  "looks and how much is built. The words are on docs/redesign-R2.md.")

    # ======= row 1: A1 and B1 ===========================================================================================
    r = row(cv, "row 1", gap=64, align="min")

    f = window(r, "A1 · Sets in folders, as accepted, after the rework",
               "S1 and SH1 redrawn with the Notebook sidebar's rows. Folders hold sets; a set is a card with its items, "
               "each with × (take it out; the page, place or file is not touched), Open all, Close all and + Add. What the "
               "rework changed: a page is an item (a page is a note with no place), a document is one (new), and the file "
               "of folders is settings/shelf.json, not a field in each set.")
    b = shelf_pane(f)
    P.field(b, "Find in the Shelf", icon_name="search", height=36)
    t = col(b, "folders", gap=1, W="fill")
    tree_row(t, "Phinehas study", 0, "folder", True, count=2)
    st = col(b, "set", gap=8, pad=12, fill="surface", radius=12, stroke="accent", sw=1, W="fill")
    hr = row(st, "head", gap=8, W="fill")
    icon(hr, "shelf", 18, "accent")
    text(hr, "Word study: zeal", "heading")
    spacer(hr)
    F.dot(hr, "threadB", 8)
    P.icon_button(hr, "more", "muted", size=28, icon_size=16)
    for kind, label, tag, live in (("pane", "H7065 · Strong's", None, True), ("pane", "Every use · zealous", None, True),
                                   ("pane", "Interlinear · Numbers 25:7–13", None, False),
                                   ("thread", "Phinehas", None, False), ("page", "Word study: H7065", None, True),
                                   ("pdf", "Phinehas: Verse by Verse", "PDF", False)):
        rr = row(st, f"item/{label}", gap=8, pad=[3, 4, 3, 4], W="fill")
        F.dot(rr, "accent" if live else "line", 8)
        icon(rr, KIND_ICON[kind], 15, "muted")
        text(rr, label, "small", W="fill", maxLines=1)
        if tag:
            text(rr, tag, "caption", "muted")
        icon(rr, "close", 14, "muted")
    ar = row(st, "actions", gap=8, W="fill")
    P.button(ar, "Open all", "primary", "dock", size="sm")
    P.button(ar, "Close all", "secondary", "close", size="sm")
    P.button(ar, "Add", "soft", "plus", size="sm")
    st2 = row(b, "second set", gap=8, pad=[10, 12, 10, 12], fill="surface", radius=12, stroke="line", sw=1, W="fill")
    icon(st2, "shelf", 18, "muted")
    text(st2, "Covenant of peace", "bodyStrong", W="fill")
    text(st2, "3 items", "caption", "muted")
    tt = col(b, "folders 2", gap=1, W="fill")
    tree_row(tt, "Romans", 0, "folder", False, count=1)
    tree_row(tt, "ruth read 11/2/26", 0, "folder", False, count=1)
    tree_row(tt, "Lessons", 0, "folder", False, count=0)
    Q.reader(f, PANE_W, W - PANE_W)

    f = window(r, "B1 · The Shelf as a tree",
               "One tree, drawn with the Notebook sidebar's rows. A folder holds anything: other folders (what was "
               "a set), pages, places, threads, lessons, documents and kept panes. A dot is a tab that is open; the "
               "blue dot on a folder says some of its tabs are. Click a folder to fold it, a leaf to open it; the "
               "selected folder shows Open all.")
    b = shelf_pane(f)
    tree_phinehas(b, selected="Word study: zeal", hover_open=True)
    Q.reader(f, PANE_W, W - PANE_W)

    # ======= row 2: B2 and B3 ===========================================================================================
    r = row(cv, "row 2", gap=64, align="min")

    f = window(r, "B2 · A folder: open all, close all, and its menu",
               "A folder's bar at the foot of the pane (and its ⋯ menu) holds what Open all, Close all and + Add did in "
               "SH1. Open all opens the folder's own items; the second row also opens the folders inside it. Close all "
               "closes only the tabs this folder opened. Nothing is changed in any file by opening or closing.")
    b = shelf_pane(f)
    t = tree_phinehas(b, selected="Word study: zeal")
    footer(b, ("Word study: zeal", "4 items · 3 open"))
    Q.reader(f, PANE_W, W - PANE_W)
    m = Q.popover(f, 466, 200, 330, "folder menu")
    text(m, "Word study: zeal", "caption", "muted")
    for label, sub, ic, kbd in (("Open all", "its 4 items, as tabs", "dock", "Enter"),
                                ("Open all, folders inside too", None, "dock", None),
                                ("Close all", "the 3 tabs it opened", "close", None),
                                ("Add", "this tab, all tabs, a page, a place…", "plus", None),
                                ("New folder inside", None, "folder", None),
                                ("Rename", None, "pen", "F2"),
                                ("Move to…", "another folder, or the top", "right", None),
                                ("Remove the folder", "its items are not touched", "close", "Del")):
        Q.menu_item(m, label, sub, icon_name=ic, kbd=kbd)

    f = window(r, "B3 · Open all: the folder's tabs together",
               "Open all opens each item where its kind goes: panes and places as tabs beside the Shelf, a document in its "
               "preview, a page in the Notebook. They carry the folder's blue mark, so they can be told apart wherever they "
               "are. The mark's menu closes them together. The reader does not move; a place opens as a second reader.")
    left_w = 440
    b = Q.column(f, 0, left_w, ["Shelf", "H7065", "Every use", "Interlinear"], "H7065", side="left")
    P.lexicon_block(b, Q.C["lexicon"]["H7065"], Q.C["count"]["H7065"])
    Q.reader(f, left_w, W - left_w - 420, first=7, last=13)
    nb = Q.column(f, W - 420, 420, ["Notebook"], "Notebook")
    pt = row(nb, "page tabs", gap=6, W="fill")
    for label, on in (("Word study: H7065", True), ("Lesson: Phinehas", False)):
        ch = row(pt, f"page tab/{label}", gap=6, pad=[5, 6, 5, 10], radius=999, fill="accentSoft" if on else "sunken")
        text(ch, label, "smallStrong", "accent" if on else "muted", maxLines=1)
        icon(ch, "close", 13, "accent" if on else "muted")
    text(nb, "Word study: H7065", "title")
    WS_text = "List the renderings first, then read each verse before writing anything about it."
    para(nb, WS_text, "body")
    for x, w_ in ((96, 244), (W - 420, 330)):
        frame(f, "folder mark", x=x, y=TB, w=w_, h=3, fill="threadB", W="fixed", H="fixed")
    m = Q.popover(f, 70, TB + 46, 310, "folder menu")
    text(m, "Word study: zeal · 4 tabs open", "smallStrong", "muted")
    Q.menu_item(m, "Close the folder's tabs", icon_name="close")
    Q.menu_item(m, "Save where they are now", icon_name="check")
    Q.menu_item(m, "Show it in the Shelf", icon_name="shelf")

    # ======= row 3: B4 and B5 ===========================================================================================
    r = row(cv, "row 3", gap=64, align="min")

    f = window(r, "B4 · Moving things, and adding them",
               "As in Obsidian's file list: drag a row onto a folder (it lights; between rows, a line shows where it "
               "lands), F2 renames, Del removes from the folder. Ctrl+drag keeps it in both: unlike a file, an item is a "
               "pointer, so one page can sit in several folders. + Add lists what SH1 listed, with a page and a "
               "document now.")
    b = shelf_pane(f)
    tree_phinehas(b, selected="Phinehas study", drop_on="Covenant of peace")
    footer(b, ("Phinehas study", "9 items · 3 open"))
    Q.reader(f, PANE_W, W - PANE_W)
    ghost(f, 232, 372, "Phinehas: Verse by Verse", "pdf")
    m = Q.popover(f, 466, 330, 340, "add menu")
    for label, sub in (("This tab", "Every use · zealous"), ("All open tabs", "5 tabs"),
                       ("A new page in this folder", "written here, in the Notebook"),
                       ("A page…", "by its title"), ("A place…", "a verse, chapter or book"), ("A thread…", None),
                       ("A lesson…", None), ("A document…", "a Word file or slides made here")):
        Q.menu_item(m, label, sub, icon_name="plus")

    f = window(r, "B5 · Two trees, two jobs: the Shelf and the Notebook's pages",
               "The Notebook already has a tree: pages inside pages (W3). The Shelf's is a different thing and the "
               "sheet keeps them apart: a page in the Shelf is a pointer, kept where you want to open it together with "
               "other things; a page inside a page is part of that page, written in its file and made into its documents. "
               "Pinned stays the Notebook's quick list.")
    b = shelf_pane(f)
    tree_phinehas(b, selected="Lesson: Phinehas")
    side, pg = WS.notebook(f, x=PANE_W, w=W - PANE_W)
    WS.sidebar(side, on="Lesson: Phinehas")
    WS.page_head(pg, ["Pages", "Lesson: Phinehas"], "Lesson: Phinehas", ["Numbers 25"])
    WS.page_foot(pg, kids=("Outline", "The passage", "Questions for the group"))
    c1 = col(pg, "in the shelf", gap=6, pad=[12, 14, 12, 14], fill="accentSoft", radius=10, W="fill")
    text(c1, "In the Shelf", "smallStrong", "accent")
    para(c1, "Phinehas study → Lesson: Phinehas. A pointer. Remove it and the page stays. Put it in a second folder and "
             "it is in both.", "small")
    c2 = col(pg, "in the notebook", gap=6, pad=[12, 14, 12, 14], fill="sunken", radius=10, W="fill")
    text(c2, "In the Notebook", "smallStrong", "muted")
    para(c2, "Lesson: Phinehas → Outline, The passage, Questions for the group. Inside it: written in the page's own file "
             "(its pages inside) and made into its documents.", "small")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "r2.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "r2.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports" / "r2"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.5", "--out",
                    str(dest / "all.png")], check=True, capture_output=True)
    for title in Q.TITLES.get(PG, []):
        file = dest / (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") + ".png")
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", "Window · " + title,
                        "--scale", "1", "--out", str(file)], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
