"""Shared helpers for the feature folders' round-1 sheets made on 2026-11-12 (books, command, words, questions,
documents, trash, findings, settings, help). They draw inside the evolving app (the round-5 rail and the slim top bar
from minimize) with the same figlib/parts/phase2b helpers the older folders use, and run FigCraft the same way.

Scripture and lookups come from `wb` (the database, read-only) and are saved to the folder's data/ as fetched; nothing
is typed. Names of pages, questions, findings and documents on the sheets are a drawn sample, not anyone's study.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parent
REPO = LIB.parent
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE / "minimize"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
from figlib import S, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB

# a trash can, in the line style of the other icons (24 grid)
F.ICONS.setdefault("trash", "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6")


def wb(*args, as_json=False):
    exe = REPO / "target" / "release" / "wb.exe"
    if not exe.exists():
        exe = REPO / "target" / "debug" / "wb.exe"
    env = dict(os.environ)
    env.setdefault("WB_BIBLE_DB", str(REPO.parent / "bible-workbench" / "datasets" / "workbench.db"))
    out = subprocess.run([str(exe), *args], capture_output=True, text=True, encoding="utf-8", env=env, check=True)
    return json.loads(out.stdout) if as_json else out.stdout


def fetch(folder, name, cmd, as_json=True):
    """Run a wb command, keep what it printed in <folder>/data/<name>.json with the command, and return it."""
    data = wb(*cmd, as_json=as_json)
    d = folder / "data"
    d.mkdir(exist_ok=True)
    (d / f"{name}.json").write_text(json.dumps({"command": "wb " + " ".join(cmd), "output": data}, ensure_ascii=False,
                                               indent=2), encoding="utf-8")
    return data


def verses_of(text_out):
    vs = []
    for ln in text_out.splitlines()[1:]:
        m = re.match(r"(\d+) (.*)", ln)
        if m:
            vs.append({"v": int(m.group(1)), "text": m.group(2)})
    return vs


def floating(f, name, x, y, w, pad=(12, 14, 12, 14), gap=8, r=12):
    p = col(f, name, gap=gap, pad=list(pad), fill="surface", radius=r, stroke="line", sw=1, W="fixed")
    Q.put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def app(f, on=None, bar=True):
    """The window as it is now evolving: the round-5 rail and the slim top bar. Returns the rail's width."""
    w = M.rail5(f, on=on)
    if bar:
        M.slim_bar(f, x=w, w=W - w)
    return w


def reader(f, x, w, verses, title, top=TB, marks=None, sel=None, width=640):
    rd = frame(f, "reader", x=x, y=top, w=w, h=H - top, layout="vertical", crossAlign="center", pad=[32, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": min(width, w - 64)}}, ref=False)
    text(inner, title, "chapter", fontSize=30, lineHeight="40px")
    F.verses(inner, verses, "readDesk", marks or {}, selected=sel)
    return rd


def panel(f, x, y, w, h, title, sub=None, fill="surface"):
    """A pane-sized area with a title, for parts that are not a reader."""
    p = col(f, f"panel/{title}", gap=12, pad=[20, 22, 20, 22], fill=fill, W="fixed", H="fixed", clip=True,
            stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(p, x, y, w, h)
    hd = col(p, "head", gap=2, W="fill")
    text(hd, title, "title")
    if sub:
        para(hd, sub, "small", "muted")
    return p


def line(parent, label, sub=None, ic=None, right=None, on=False, muted=False, name=None):
    it = row(parent, name or f"row/{label}", gap=10, pad=[8, 10, 8, 10], radius=8, W="fill",
             fill="accentSoft" if on else None)
    if ic:
        icon(it, ic, 18, "accent" if on else "muted")
    tc = col(it, "text", gap=1, W="fill")
    text(tc, label, "bodyStrong" if on else "body", "muted" if muted else "fg")
    if sub:
        para(tc, sub, "caption", "muted")
    if right:
        text(it, right, "caption", "muted")
    return it


def rule(parent):
    frame(parent, "rule", w=10, h=1, fill="line", W="fill", H="fixed")


def note(f, s, x, y, w=420):
    """A design note on the window (a yellow sticky), saying what a part answers."""
    n = col(f, "design note", gap=4, pad=[10, 12, 10, 12], fill="#FFF4C2", radius=8, stroke="#E5D27A", sw=1, W="fixed")
    Q.put(n, x, y, w)
    para(n, s, "caption", "#5A4A00")
    return n


def run_board(here, board_name, sheets):
    """Build the board, run FigCraft, and export all.png and one PNG per window (by its tag: the letters and number
    before the first ' · ')."""
    F.define_tokens()
    S.do("page.rename", {"name": board_name}, ref=False)
    board = frame(None, board_name, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96,
                  W="hug", H="hug")
    sheets(board)
    stem = here.name
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / f"{stem}.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = here / f"{stem}.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = here / "exports"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    subprocess.run([cli, "render", "--no-system-fonts", str(target), "--page", board_name, "--scale", "0.4", "--out",
                    str(dest / "all.png")], check=True, capture_output=True)
    tmp = build / f"{stem}-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window · [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window · ([A-Z]+\d+)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", board_name, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))
