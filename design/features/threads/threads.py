"""Threads, round 1: are threads a legacy idea that folders take over, or do they keep a role of their own beside Page,
Folder, Save and Library (library S20)? Nothing is built from this until the person accepts it. Scripture shown comes
from design/content.json (generated from the database) through build.C and figlib.verses; nothing is typed.

    python design/features/threads/threads.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE.parent / "minimize"))
sys.path.insert(0, str(HERE.parent / "library"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
import library as L  # noqa: E402
from figlib import S, col, frame, icon, para, row, shadow, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Threads"
PG = "Threads"

# Thread underlines on Numbers 25 (whole verses), as a colored folder or a layer would draw them.
LENS = {7: {"threads": ["threadA"]}, 11: {"threads": ["threadA", "threadB"]}, 13: {"threads": ["threadA"]},
        12: {"threads": ["threadB"]}}
# The references the Phinehas thread holds (from threads/phinehas.md's anchors; references only, no verse text).
PLACES = ["Exodus 6:25", "Numbers 25:7", "Numbers 25:11", "Numbers 31:6", "Joshua 22:13", "Joshua 22:30"]


def swatch(parent, token, size=12):
    return frame(parent, f"swatch/{token}", w=size, h=size, radius=size // 2, fill=token, W="fixed", H="fixed")


def legend(f, x, y, rows, title="SHOWN ON THE TEXT"):
    lg = col(f, "shown", gap=6, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(lg, x, y, 260)
    shadow(lg, 6, 20, "#00000022")
    text(lg, title, "label", "muted")
    for token, name, on in rows:
        it = row(lg, f"lens/{name}", gap=8, W="fill")
        swatch(it, token)
        text(it, name, "small", "fg" if on else "muted", W="fill")
        icon(it, "eye" if on else "eyeOff", 14, "fg" if on else "muted")
    return lg


def place_card(parent, ref, note=False):
    cd = row(parent, f"place/{ref}", gap=10, pad=[8, 10, 8, 10], fill="bg", radius=8, stroke="line", sw=1, W="fill")
    icon(cd, "bookmark", 14, "accent", fill="accent")
    text(cd, ref, "smallStrong", W="fill")
    if note:
        P.chip(cd, "your note", "quiet", icon_name="pen")
    return cd


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "T1 · A: a thread becomes a folder with a color",
              "Folders take threads over. A folder may carry a color; a folder with a color can be shown on the text, "
              "underlining every verse saved in it, as a thread does today. Saving a verse into Phinehas is the same "
              "Save (K) as any other. The thread's note becomes a page inside the folder.")
    w = M.rail5(f)
    x = L.library_shell(f, w, tree_on="Phinehas")
    B.desk_reader(f, x, TB, W - x, H - TB, first=10, last=13, marks=LENS)
    legend(f, W - 290, TB + 20, [("threadA", "Phinehas (folder)", True), ("threadB", "Phinehas echoes (folder)", True)])

    f = Q.win(r, PG, "T2 · A: the folder opened",
              "What was the thread's page: its places are the saves in the folder (in the thread's order, draggable), "
              "its note is a page in it, and the color sits in the folder's header with Show on the text. The file "
              "threads/phinehas.md stays and is read as this folder, so the Python app still opens it.")
    w = M.rail5(f, on="Notebook")
    x = L.library_shell(f, w, tree_on="Phinehas")
    pg = col(f, "folder", gap=10, pad=[24, 32, 24, 32], W="fixed", H="fixed")
    Q.put(pg, x, TB, W - x, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "folder", 22, "accent")
    text(hd, "Phinehas", "title", W="fill")
    swatch(hd, "threadA", 14)
    P.chip(hd, "Shown on the text", "selected", icon_name="eye")
    text(pg, "56 saves · 1 page · from the thread Phinehas", "caption", "muted")
    it = row(pg, "note page", gap=10, pad=[10, 12, 10, 12], fill="surface", radius=10, stroke="line", sw=1, W="fill")
    icon(it, "page", 16, "accent")
    text(it, "Phinehas", "bodyStrong", W="fill")
    text(it, "the thread's note, as a page", "caption", "muted")
    for ref in PLACES:
        place_card(pg, ref)
    text(pg, "50 more saves, in the thread's order", "caption", "muted")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "T3 · B: a thread is a page with a Places block",
              "Threads stay pages (as R1 decided), and their verses show in the page, which finding d84d asks for. "
              "The page's places are a block of its own: a list of references you add with Save (K) choosing the "
              "page, and the page's color underlines them in the reader. The separate Threads tab goes.")
    w = M.rail5(f, on="Notebook")
    x = L.library_shell(f, w)
    pg = col(f, "page", gap=10, pad=[24, 48, 24, 48], W="fixed", H="fixed")
    Q.put(pg, x, TB, W - x, H - TB)
    hd = row(pg, "head", gap=10, W="fill")
    icon(hd, "page", 22, "accent")
    text(hd, "Phinehas", "title", W="fill")
    swatch(hd, "threadA", 14)
    P.chip(hd, "Underline on the text", "selected", icon_name="eye")
    text(pg, "Your writing goes here, block by block, as in any page.", "body", "muted")
    blk = col(pg, "places block", gap=6, pad=[12, 12, 12, 12], radius=10, stroke="line", sw=1, fill="surface", W="fill")
    bh = row(blk, "h", gap=8, W="fill")
    icon(bh, "threads", 16, "accent")
    text(bh, "PLACES · 56", "label", "muted", W="fill")
    text(bh, "Open as list", "smallStrong", "accent")
    for ref in PLACES[:4]:
        place_card(blk, ref, note=(ref == "Numbers 25:11"))
    text(blk, "52 more", "caption", "muted")
    para(pg, "A page holds writing; this block is the one thing in it that points at places. Question: does that "
             "break S20 (a page is something you write, a folder is where you sort)?", "caption", "muted")

    f = Q.win(r, PG, "T4 · B: saving a verse into a thread page",
              "The Save picker lists pages that have a Places block beside folders. Ticking Phinehas adds the verse "
              "to that page's places; the verse is underlined at once in the page's color.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, 720, H - TB, first=10, last=13, sel=(12, 0, 999), marks=LENS)
    pk = col(f, "picker", gap=3, pad=[10, 10, 10, 10], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(pk, w + 740, TB + 20, 380)
    shadow(pk, 8, 28, "#00000033")
    hd = row(pk, "h", gap=8, pad=[2, 4, 4, 4], W="fill")
    icon(hd, "bookmark", 16, "accent", fill="accent")
    text(hd, "Save Numbers 25:12 to", "smallStrong", W="fill")
    P.field(pk, "Find a folder or a thread page", None, icon_name="search", height=32)
    text(pk, "  THREAD PAGES (UNDERLINE)", "label", "muted")
    L.tree_row(pk, "Phinehas", 0, "page", check=False, name="t/1")
    L.tree_row(pk, "Phinehas echoes", 0, "page", check=True, name="t/2")
    text(pk, "  FOLDERS", "label", "muted")
    L.tree_row(pk, "Covenant of peace", 0, check=False, name="f/1")
    L.tree_row(pk, "Sunday lessons", 0, open_=False, check=False, name="f/2")
    ft = row(pk, "foot", gap=8, pad=[6, 4, 0, 4], W="fill")
    text(ft, "Saved in 1", "caption", "muted", W="fill")
    P.button(ft, "Done", "primary", size="sm")


def direction_c(cv):
    r = row(cv, "C", gap=64, align="min")
    f = Q.win(r, PG, "T5 · C: a thread is a layer on the text",
              "Threads keep a role, but not as a container: a thread is a colored layer you turn on and off over the "
              "text, the same kind of thing as a highlight color or a year of reading (findings b99f, ad4c, 64f0). "
              "Folders sort; layers mark. The Highlights button on the rail becomes Layers.")
    w = M.rail5(f, on="Highlights")
    M.slim_bar(f, x=w, w=W - w)
    pn = col(f, "layers", gap=4, pad=[14, 12, 14, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
             strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(pn, w, TB, 290, H - TB)
    text(pn, "LAYERS ON THE TEXT", "label", "muted")
    for token, name, kind, on in (("threadA", "Phinehas", "thread · 56", True),
                                  ("threadB", "Phinehas echoes", "thread · 19", True),
                                  ("hlYellow", "Yellow", "highlight", True), ("hlGreen", "Green", "highlight", True),
                                  ("hlBlue", "2025 reading", "highlights by year", False)):
        it = row(pn, f"layer/{name}", gap=8, pad=[6, 6, 6, 6], radius=8, W="fill")
        swatch(it, token)
        tc = col(it, "t", gap=0, W="fill")
        text(tc, name, "small", "fg" if on else "muted")
        text(tc, kind, "caption", "muted")
        icon(it, "eye" if on else "eyeOff", 14, "fg" if on else "muted")
    it = row(pn, "new", gap=8, pad=[8, 6, 6, 6], W="fill")
    icon(it, "plus", 14, "accent")
    text(it, "New layer", "smallStrong", "accent")
    marks = dict(LENS)
    marks[12] = {"hl": "yellow", "threads": ["threadB"]}
    B.desk_reader(f, w + 290, TB, W - w - 290, H - TB, first=10, last=13, marks=marks)

    f = Q.win(r, PG, "T6 · C: where each piece sits",
              "A layer's verses can still be saved into a folder, and a folder can be turned into a layer, but the two "
              "are kept apart: a layer has no pages and no nesting; a folder draws nothing on the text.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    g = row(f, "pieces", gap=16, pad=[40, 40, 40, 40], W="fixed", align="min")
    Q.put(g, w, TB, W - w)
    for title, ic, lines in (
            ("Page", "page", ["something you write", "pages inside are parts of it"]),
            ("Folder", "folder", ["a place you sort into", "holds pages and saves", "draws nothing on the text"]),
            ("Save", "bookmark", ["a pointer", "in any number of folders"]),
            ("Layer (was thread)", "threads", ["a color over the text", "verses, words or phrases", "turned on and off",
                                               "no pages, no nesting"])):
        cd = col(g, f"piece/{title}", gap=6, pad=[16, 16, 16, 16], fill="surface", radius=12, stroke="line", sw=1,
                 W="fill")
        hd = row(cd, "h", gap=8)
        icon(hd, ic, 18, "accent")
        text(hd, title, "bodyStrong")
        for ln in lines:
            text(cd, ln, "small", "muted")


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "Threads, round 1: legacy, or a role of their own?",
                  "Today a thread is a file (threads/<slug>.md: a name, a color, a note and an ordered list of places) "
                  "shown as a page, and its color underlines its verses in the reader. The library rounds fixed Page, "
                  "Folder, Save and Library (S20). Three directions: A, folders take threads over (a folder can have a "
                  "color); B, a thread stays a page with a Places block; C, a thread becomes a layer over the text, "
                  "beside highlights. The thread files stay where they are in every direction.")
    direction_a(cv)
    direction_b(cv)
    direction_c(cv)


def main():
    F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
    F.ICONS.setdefault("eye", "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z")
    F.ICONS.setdefault("eyeOff", "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16")
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "threads.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "threads.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", BOARD, "--scale", "0.4", "--out",
                    str(dest / "all.png")], check=True, capture_output=True)
    tmp = build / "threads-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window\W+(T\d+)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
