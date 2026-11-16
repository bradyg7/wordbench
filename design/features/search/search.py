"""Search, round 1: search, every use, count, forms and near, drawn for the first time in design/features/, inside the
evolving app (the rail and trail from minimize). It asks how a search is narrowed by clicking rather than typing syntax
(findings a9d5, 8353), whether one box finds places, verses, words and your pages together, and whether the counts by
book should be the filter itself. Nothing is built from this until the person accepts it. Every verse and count shown
is fetched from the database with `wb search`, `wb count`, `wb forms`, `wb near` when the script runs; nothing is typed.

    python design/features/search/search.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
REPO = LIB.parent
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE.parent / "minimize"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402
from figlib import S, col, frame, icon, row, shadow, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Search"
PG = "Search"
PW = 520


def wb(*args):
    exe = REPO / "target" / "release" / "wb.exe"
    if not exe.exists():
        exe = REPO / "target" / "debug" / "wb.exe"
    env = dict(os.environ)
    env.setdefault("WB_BIBLE_DB", str(REPO.parent / "bible-workbench" / "datasets" / "workbench.db"))
    out = subprocess.run([str(exe), *args], capture_output=True, text=True, encoding="utf-8", env=env, check=True)
    return json.loads(out.stdout)


ZEAL = wb("search", "zeal")
ZEAL_NT = wb("search", "zeal", "--scope", "nt")
COUNT = wb("count", "zeal")
FORMS = wb("forms", "zeal")
NEAR = wb("near", "zeal", "God", "--within", "5")
BOOKS = {b["id"]: b for b in wb("books")["books"]}


def floating(f, name, x, y, w, pad=(8, 8, 8, 8), gap=2, r=12):
    p = col(f, name, gap=gap, pad=list(pad), fill="surface", radius=r, stroke="line", sw=1, W="fixed")
    Q.put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def left(f):
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w - PW, H - TB, first=10, last=13)
    return w


def pane(f, tabs=("Search: zeal",), active="Search: zeal"):
    return M.pane(f, W - PW, TB, PW, H - TB, list(tabs), active)


def results(b, rows, n=6):
    for r in rows[:n]:
        it = col(b, f"row/{r['ref']['code']}.{r['ref']['c']}:{r['ref']['v']}", gap=2, pad=[6, 4, 6, 4], W="fill")
        text(it, f"{r['ref']['name']} {r['ref']['c']}:{r['ref']['v']}", "smallStrong", "accent")
        text(it, r["text"], "readSmall", W="fill", maxLines=3)


def by_book_bars(b, counts, on=None, h=90):
    """The count in each book as a bar; a click on a bar narrows the results to that book."""
    mx = max(counts.values())
    g = row(b, "by book", gap=6, W="fill", align="max")
    for name, n in counts.items():
        c = col(g, f"book/{name}", gap=3, W="fill", crossAlign="center")
        text(c, str(n), "caption", "muted")
        frame(c, "bar", w=22, h=max(6, round(h * n / mx)), radius=4, fill="accent" if name == on else "accentSoft",
              W="fixed", H="fixed")
        text(c, name.replace("2 Corinthians", "2 Cor").replace("Philippians", "Phil").replace("Colossians", "Col"),
             "caption", "fg" if name == on else "muted", fontSize=10, lineHeight="12px")
    return g


# ---- R1 today ---------------------------------------------------------------------------------------------------------

def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "R1 · Today: Search in its pane",
              "As built (ui/src/panes.ts openSearch): the box finds every verse with all the words; narrowing is typed: "
              "\"quotes\" for a phrase, zeal* for endings, --scope gospels, --regex. Results come 50 at a time with More, "
              "each tickable. Count, forms and near are commands only. Findings a9d5 and 8353: filters you click.")
    left(f)
    b = pane(f)
    text(b, "zeal", "title")
    text(b, f"{ZEAL['verses']} verses in the whole Bible", "small", "muted")
    a = row(b, "results bar", gap=6)
    P.button(a, "Tick all", "secondary", size="sm")
    P.button(a, "Copy", "secondary", size="sm")
    results(b, ZEAL["rows"])


# ---- A: filters you click ---------------------------------------------------------------------------------------------

def filters(b, scope="Whole Bible", match="All the words", word="zeal"):
    fr = row(b, "filters", gap=6, W="fill", wrap=True)
    for lbl in (scope, match, f"Forms: {word}"):
        c = row(fr, f"filter/{lbl}", gap=4, pad=[5, 10, 5, 12], radius=999, stroke="line", sw=1,
                fill="accentSoft" if lbl == "New Testament" else "surface")
        text(c, lbl, "smallStrong")
        icon(c, "down", 12, "muted")
    return fr


def direction_a(cv):
    r = row(cv, "a", gap=64, align="min")
    f = Q.win(r, PG, "R2 · A: filters you click",
              "Under the box, three dropdowns replace the syntax: where (the whole Bible, a testament, a group, books, "
              "a chapter), how the words match (all the words, the phrase, words that start so), and which forms. "
              "Every choice is also a `wb search` option, so the window and the terminal stay the same.")
    left(f)
    b = pane(f)
    text(b, "zeal", "title")
    filters(b, "New Testament")
    text(b, f"{ZEAL_NT['verses']} verses in the New Testament", "small", "muted")
    results(b, ZEAL_NT["rows"])

    f = Q.win(r, PG, "R3 · A: where, opened",
              "Where to look, as a list to tick: the testaments, the usual groups, then the books. Several can be "
              "ticked; a book can be narrowed to chapters. The same dropdown serves Every use (a9d5).")
    left(f)
    b = pane(f)
    text(b, "zeal", "title")
    fr = filters(b, "New Testament")
    m = floating(f, "where", W - PW + 16, TB + 150, 300)
    for lbl, on, sub in (("Whole Bible", False, ""), ("Old Testament", False, ""), ("New Testament", True, ""),
                         ("The Gospels", False, "group"), ("The Law", False, "group"), ("Paul's letters", False, "group"),
                         ("Books…", False, "choose"), ("Chapters…", False, "in a book")):
        it = row(m, f"where/{lbl}", gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if on else None)
        box = frame(it, "box", w=16, h=16, radius=4, fill="accent" if on else None, stroke=None if on else "line", sw=1.5,
                    layout="horizontal", mainAlign="center", crossAlign="center", W="fixed", H="fixed")
        if on:
            icon(box, "check", 11, "onAccent")
        text(it, lbl, "small", W="fill")
        if sub:
            text(it, sub, "caption", "muted")


# ---- B: one box --------------------------------------------------------------------------------------------------------

def direction_b(cv):
    r = row(cv, "b", gap=64, align="min")
    f = Q.win(r, PG, "R4 · B: one box finds everything",
              "Typing in the top bar's box shows what it could mean, in groups: a place, verses with the words, the "
              "original words the KJV renders so, and your own pages (wb find). Enter opens the first; the arrows "
              "choose. The full search opens in the pane only when asked.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13)
    m = floating(f, "box results", w + (W - w) // 2 - 300, TB - 4, 600, pad=(10, 10, 10, 10), gap=4)
    bx = row(m, "box", gap=8, pad=[8, 10, 8, 10], radius=8, fill="bg", stroke="accent", sw=1.5, W="fill")
    icon(bx, "search", 16, "muted")
    text(bx, "zeal", "body", W="fill")
    for head, items in (
            ("Verses", [f"{x['ref']['name']} {x['ref']['c']}:{x['ref']['v']}" for x in ZEAL["rows"][:3]]
             + [f"All {ZEAL['verses']} verses with zeal"]),
            ("Words", [f"{x['form']} · {x['n']} times" for x in FORMS["forms"]]),
            ("Original words", ["What the KJV renders zeal (define zeal)"]),
            ("Your pages", ["Pages that mention zeal (find zeal)"])):
        text(m, head.upper(), "caption", "muted")
        for i, it_ in enumerate(items):
            on = head == "Verses" and i == 0
            it = row(m, f"{head}/{it_}", gap=8, pad=[5, 8, 5, 8], radius=6, W="fill", fill="accentSoft" if on else None)
            text(it, it_, "small", "accent" if it_.startswith("All") else "fg", W="fill")
            if on:
                P.kbd(it, "↵")


# ---- C: the counts are the filter -------------------------------------------------------------------------------------

def direction_c(cv):
    r = row(cv, "c", gap=64, align="min")
    f = Q.win(r, PG, "R5 · C: where it falls, then the verses",
              "Results open with where the word falls: its count in each book (wb count), each bar a filter. A click on "
              "Isaiah shows Isaiah's verses; a second click, all again. The forms are chips above (wb forms): "
              "zeal, zealous, zealously, each with its count.")
    left(f)
    b = pane(f)
    text(b, "zeal", "title")
    ch = row(b, "forms", gap=6, wrap=True)
    for x in FORMS["forms"]:
        P.chip(ch, f"{x['form']} {x['n']}", "selected" if x["form"] == "zeal" else "outline")
    by_book_bars(b, COUNT["by_book"], on="Isaiah")
    isa = [x for x in ZEAL["rows"] if x["ref"]["name"] == "Isaiah"]
    text(b, f"{len(isa)} verses in Isaiah · show all {ZEAL['verses']}", "small", "muted")
    results(b, isa, 4)

    f = Q.win(r, PG, "R6 · C: near, without the syntax",
              "Two words near each other, set by clicking: a second box appears with And near…, and a stepper for how "
              "many words apart. The result is wb near, with the same counts by book.")
    left(f)
    b = pane(f)
    q = row(b, "query", gap=8, W="fill", wrap=True)
    for lbl in ("zeal", "God"):
        c = row(q, f"term/{lbl}", gap=6, pad=[6, 10, 6, 10], radius=8, stroke="line", sw=1, fill="bg")
        text(c, lbl, "bodyStrong")
        if lbl == "zeal":
            text(q, "within", "small", "muted")
            st = row(q, "within", gap=8, pad=[4, 8, 4, 8], radius=8, stroke="line", sw=1)
            text(st, "−", "bodyStrong", "muted")
            text(st, str(NEAR["within"]), "bodyStrong")
            text(st, "+", "bodyStrong", "muted")
            text(q, "words of", "small", "muted")
    text(b, f"{NEAR['verses']} verse", "small", "muted")
    for x in NEAR["rows"]:
        it = col(b, "near row", gap=2, W="fill")
        text(it, f"{x['ref']['name']} {x['ref']['c']}:{x['ref']['v']}", "smallStrong", "accent")
        text(it, "".join(w["lead"] + w["t"] + w["trail"] for w in x["words"]).strip(), "readSmall", W="fill")


# ---- round 2 ----------------------------------------------------------------------------------------------------------

HEART = wb("count", "heart")
HEART_S = wb("search", "heart")
GROUPS = [("Law", 1, 5), ("History", 6, 17), ("Poetry", 18, 22), ("Prophets", 23, 39), ("Gospels", 40, 43),
          ("Acts", 44, 44), ("Letters", 45, 65), ("Revelation", 66, 66)]
BYNAME = {b["name"]: b for b in BOOKS.values()}


def whole(b, rows, n):
    for r in rows[:n]:
        it = col(b, "row", gap=2, pad=[6, 4, 6, 4], W="fill")
        text(it, f"{r['ref']['name']} {r['ref']['c']}:{r['ref']['v']}", "smallStrong", "accent")
        text(it, r["text"], "readSmall", W="fill")


def box_with_command(cv):
    r = row(cv, "r2a", gap=64, align="min")
    f = Q.win(r, PG, "R7 · B: the command first, then suggestions",
              "Decided 2026-11-11: the box takes commands and suggests. When the input reads as a command (uses zeal), "
              "the command is the first row, with what it does; under it, the same suggestions as R4.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13)
    m = floating(f, "box results", w + (W - w) // 2 - 300, TB - 4, 600, pad=(10, 10, 10, 10), gap=4)
    bx = row(m, "box", gap=8, pad=[8, 10, 8, 10], radius=8, fill="bg", stroke="accent", sw=1.5, W="fill")
    icon(bx, "search", 16, "muted")
    text(bx, "uses zeal", "body", W="fill")
    text(m, "COMMAND", "caption", "muted")
    c = row(m, "command", gap=8, pad=[7, 8, 7, 8], radius=6, W="fill", fill="accentSoft")
    text(c, "uses zeal", "smallStrong", W="fill")
    text(c, "Every use, in the Concordance", "caption", "muted")
    P.kbd(c, "↵")
    for head, items in (
            ("Verses", [f"{x['ref']['name']} {x['ref']['c']}:{x['ref']['v']}" for x in ZEAL["rows"][:2]]
             + [f"All {ZEAL['verses']} verses with zeal"]),
            ("Words", [f"{x['form']} · {x['n']} times" for x in FORMS["forms"]])):
        text(m, head.upper(), "caption", "muted")
        for it_ in items:
            it = row(m, f"{head}/{it_}", gap=8, pad=[5, 8, 5, 8], radius=6, W="fill")
            text(it, it_, "small", "accent" if it_.startswith("All") else "fg", W="fill")

    f = Q.win(r, PG, "R8 · A and C inside the results, verses whole",
              "The results pane: the filters (A) under the title, the counts by book (C) under them, then every verse "
              "whole. A filter and a bar narrow the same list.")
    left(f)
    b = pane(f)
    text(b, "zeal", "title")
    filters(b)
    by_book_bars(b, COUNT["by_book"], h=60)
    text(b, f"{ZEAL['verses']} verses", "small", "muted")
    whole(b, ZEAL["rows"], 5)


def many(cv):
    r = row(cv, "many", gap=64, align="min")
    total = HEART["occurrences"]
    f = Q.win(r, PG, f"R9 · Counts, the switch on Book by book",
              f"heart: {total} times in {len(HEART['by_book'])} books (wb count heart). Every book of the Bible is a "
              "thin bar in its order, so the strip keeps its width whatever the word; a book with none is a dot. "
              "Hover names a bar; a click narrows; a drag over several narrows to that run of books.")
    left(f)
    b = pane(f, ("Search: heart",), "Search: heart")
    text(b, "heart", "title")
    filters(b, word="heart")
    P.segmented(b, ["Sections", "Book by book"], "Book by book", W="hug")
    mx = max(HEART["by_book"].values())
    st = row(b, "strip", gap=1, W="fill", align="max")
    for bid in sorted(BOOKS):
        n = HEART["by_book"].get(BOOKS[bid]["name"], 0)
        on = BOOKS[bid]["name"] == "Psalms"
        frame(st, BOOKS[bid]["code"], w=5, h=max(2, round(70 * n / mx)), radius=1,
              fill="accent" if on else ("accentSoft" if n else "line"), W="fill", H="fixed")
    lg = row(b, "under", gap=8, W="fill")
    text(lg, "Genesis", "caption", "muted", W="fill")
    text(lg, "Matthew", "caption", "muted", W="fill")
    text(lg, "Revelation", "caption", "muted")
    tip = row(b, "tip", gap=6)
    P.chip(tip, f"Psalms {HEART['by_book'].get('Psalms', 0)}", "selected")
    text(tip, "click to narrow", "caption", "muted")
    text(b, f"{HEART_S['verses']} verses", "small", "muted")
    whole(b, HEART_S["rows"], 3)

    f = Q.win(r, PG, "R10 · Counts, the switch on Sections (opens first)",
              "The same counts in eight groups (Law, History, Poetry, Prophets, Gospels, Acts, Letters, Revelation) as "
              "rows with a bar each; a group opens to its books. Sections open first; the switch is remembered.")
    left(f)
    b = pane(f, ("Search: heart",), "Search: heart")
    text(b, "heart", "title")
    filters(b, word="heart")
    P.segmented(b, ["Sections", "Book by book"], "Sections", W="hug")
    gmax = 0
    sums = []
    for g, a, z in GROUPS:
        s = sum(HEART["by_book"].get(BOOKS[i]["name"], 0) for i in range(a, z + 1))
        sums.append(s)
        gmax = max(gmax, s)
    for (g, a, z), s in zip(GROUPS, sums):
        it = row(b, f"group/{g}", gap=8, W="fill")
        icon(it, "down" if g == "Poetry" else "right", 12, "muted")
        text(it, g, "smallStrong", width=80)
        bar = frame(it, "bar", w=260, h=10, radius=3, fill="sunken", W="fill", H="fixed", layout="horizontal")
        frame(bar, "fill", w=max(3, round(260 * s / gmax)), h=10, radius=3, fill="accent" if g == "Poetry" else "accentSoft",
              W="fixed", H="fixed")
        text(it, str(s), "caption", "muted", width=34)
        if g == "Poetry":
            for i in range(a, z + 1):
                n = HEART["by_book"].get(BOOKS[i]["name"], 0)
                sub = row(b, f"book/{BOOKS[i]['name']}", gap=8, pad=[0, 0, 0, 20], W="fill")
                text(sub, BOOKS[i]["name"], "small", width=92)
                bb = frame(sub, "bar", w=240, h=6, radius=3, fill="sunken", W="fill", H="fixed", layout="horizontal")
                frame(bb, "fill", w=max(2, round(240 * n / gmax)), h=6, radius=3, fill="accentSoft", W="fixed", H="fixed")
                text(sub, str(n), "caption", "muted", width=34)
    text(b, f"{HEART_S['verses']} verses", "small", "muted")
    whole(b, HEART_S["rows"], 2)


def sheets2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Search, round 2",
                  "The person chose one box that takes commands and suggests (B), verses whole, Every use in the "
                  "Concordance, and both A and C inside the results (2026-11-11). This round: the command first in the "
                  "box (R7); filters, counts and whole verses together (R8); and the counts for a word used hundreds "
                  "of times, as one strip of every book (R9) or by group then book (R10).")
    box_with_command(cv)
    many(cv)


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "Search, round 1",
                  "Search, every use, count, forms and near were built before design/features/ existed. This round "
                  "draws Search as it is (R1), then three directions: A, filters you click in place of syntax (R2, "
                  "R3); B, one box that finds places, verses, words and your pages together (R4); C, the counts by "
                  "book as the filter, and near set by clicking (R5, R6). Every verse and number is from the database.")
    today(cv)
    direction_a(cv)
    direction_b(cv)
    direction_c(cv)


# windows that no longer lead (see the README's Leading design table)
DROP = ['R2', 'R3', 'R4', 'R5']


def main():
    sys.path.insert(0, str(HERE.parent))
    import lead  # noqa: E402
    lead.drop(Q, DROP)
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    sheets2(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "search.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "search.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    # one vector PDF of the board, in the board's order (the person, 2026-11-12): sharp at any zoom, no PNGs
    pdf = HERE / f"{HERE.name}.pdf"
    subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", BOARD, "--format",
                    "pdf", "--out", str(pdf)], check=True, capture_output=True)
    shutil.rmtree(HERE / "exports", ignore_errors=True)
    print("exported", pdf.name)


if __name__ == "__main__":
    main()
