"""The Concordance, drawn in detail: the printed Strong's as a book on the rail (English words A to Z, the Hebrew and
Greek dictionaries as tabs, the interlinear for a verse, passage or chapter). Nothing is built from this until the
person accepts it. Every lookup shown is in data/ (fetched with wb; see README).

    python design/features/concordance/concordance.py
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

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402  (the rail, the top bar, folder tabs, the trail line)
from figlib import S, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Concordance"
PG = "Concordance"
D = HERE / "data"
CONC = json.loads((D / "concordance-zeal.json").read_text(encoding="utf-8"))
FORMS = json.loads((D / "forms-zea.json").read_text(encoding="utf-8"))
LEXC = json.loads((D / "lexiconc-zeal.json").read_text(encoding="utf-8"))
STRONG = json.loads((D / "strong-entries.json").read_text(encoding="utf-8"))
ILIN = json.loads((D / "interlinear-num25-11-12.json").read_text(encoding="utf-8"))


def book(f, x, w, tab, h=H - TB, y=TB, query="zeal"):
    """The Concordance pane: its strip, the navigator (search, the four tabs, A to Z), and its page."""
    cp = frame(f, "concordance", x=x, y=y, w=w, h=h, fill="surface", layout="vertical", W="fixed", H="fixed", clip=True)
    M.folder_strip(cp, ["Concordance"], "Concordance")
    nav = row(cp, "navigator", gap=10, pad=[10, 16, 10, 16], W="fill", stroke="line", strokeBottomWeight=1,
              strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    fld = P.field(nav, "Word, number or sound", query, icon_name="search", height=34, W="fixed")
    S.do("node.set", {"ids": [fld], "props": {"width": 240}}, ref=False)
    P.segmented(nav, ["English", "Hebrew", "Greek", "Interlinear"], tab, W="hug")
    spacer(nav)
    if w > 1000:
        az = row(nav, "letters", gap=5)
        for ch in ("ABCDEFGHIJKLMNOPQRSTUVWXYZ" if tab == "English" else
                   "א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת".split() if tab == "Hebrew" else
                   "Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω".split() if tab == "Greek" else []):
            on = ch in ("Z", "ק", "Ζ")
            text(az, ch, "caption", "accent" if on else "muted")
    return cp


def page(cp, name="page", pad=(18, 28, 18, 28)):
    return col(cp, name, gap=0, pad=list(pad), W="fill", H="fill", clip=True)


def lines(parent, word, rows, hit=None):
    blk = col(parent, f"heading/{word}", gap=2, pad=[0, 0, 16, 0], W="fill")
    hd = row(blk, "head", gap=10, W="fill", pad=[0, 0, 4, 0])
    text(hd, word.upper(), "heading", "fg", fontFamily=F.READ)
    text(hd, str(len(rows)), "caption", "muted")
    for ln in rows:
        on = ln["ref"] == hit
        r = row(blk, f"line/{ln['ref']}", gap=12, W="fill", pad=[2, 6, 2, 6], radius=6, fill="accentSoft" if on else None)
        t = text(r, ln["ref"], "caption", "accent" if on else "muted", W="fixed")
        Q.put(t, 0, 0, 110)
        text(r, ln["frag"], "small", "fg", W="fill", maxLines=1, fontFamily=F.READ)
        text(r, ln["strong"] or "·", "caption", "accent")


def entry(parent, n, on=False, full=True):
    e = STRONG[n]
    b = col(parent, f"entry/{n}", gap=4, pad=[10, 12, 10, 12], radius=10, W="fill",
            fill="accentSoft" if on else None, stroke="accent" if on else None, sw=1 if on else None)
    hd = row(b, "head", gap=10, W="fill", align="baseline")
    text(hd, n, "smallStrong", "accent")
    text(hd, e["lemma"], "heading", fontSize=20, lineHeight="26px")
    text(hd, f"{e['translit']}  ·  {e['pron']}" + (f"  ·  {e['pos']}" if e.get("pos") else ""), "caption", "muted",
         W="fill")
    if e.get("occurrences"):
        text(hd, f"{e['occurrences']}×", "caption", "muted")
    if full or on:
        para(b, e["definition"], "small")
        if e.get("derivation"):
            text(b, re.sub(r"\[\[(\w+)\]\]", r"\1", e["derivation"]), "caption", "muted")
        if e.get("usage"):
            para(b, "KJV: " + re.sub(r"\[\[(\w+)\]\]", r"\1", e["usage"]), "caption", "muted")
        if on and e.get("renderings"):
            rr = row(b, "renderings", gap=6, wrap=True, W="fill")
            for x in e["renderings"]:
                P.chip(rr, f"{x['w']} {x['n']}", "quiet")


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "The Concordance: the printed Strong's, as a book on the desk",
                  "One book with four tabs, like the volume itself: English (every word A to Z, each place it stands, "
                  "the number of the original word), the Hebrew and Greek dictionaries (entries in number order, so the "
                  "neighbours of a word are on the same page), and the Interlinear for a verse, passage or chapter. "
                  "Every lookup shown is fetched from the database.")

    # row 1: English, and a number opened beside it
    r = row(cv, "row 1", gap=64, align="min")
    f = Q.win(r, PG, "C1 · English: the word list and its places",
              "The left margin is the word list around where you are (forms of ‘zea’ with their counts); the page "
              "shows each word's places in Bible order. Clicking a number opens its dictionary entry in the margin "
              "on the right, without leaving the page.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, "English")
    body = row(cp, "body", gap=0, W="fill", H="fill", align="min")
    idx = col(body, "word list", gap=2, pad=[16, 12, 16, 12], fill="sunken", W="fixed", H="fill", stroke="line",
              strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(idx, 0, 0, 180)
    text(idx, "Z", "title", "accent", fontFamily=F.READ)
    for x in FORMS["forms"]:
        it = row(idx, f"form/{x['form']}", gap=8, pad=[5, 8, 5, 8], radius=8, W="fill",
                 fill="accentSoft" if x["form"] == "zeal" else None)
        text(it, x["form"], "smallStrong" if x["form"] == "zeal" else "small", W="fill")
        text(it, str(x["n"]), "caption", "muted")
    pg = col(body, "page", gap=0, pad=[18, 24, 18, 24], W="fill", H="fill", clip=True)
    lines(pg, "zeal", CONC["zeal"])
    lines(pg, "zealous", CONC["zealous"])
    side = col(body, "entry margin", gap=8, pad=[16, 14, 16, 14], W="fixed", H="fill", fill="bg", stroke="line",
               strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(side, 0, 0, 340)
    text(side, "H7068 · from the Hebrew dictionary", "caption", "muted")
    entry(side, "H7068", on=True)
    M.link(side, "Open in the Hebrew tab")

    f = Q.win(r, PG, "C2 · The search box",
              "One box for every way in: English words that start with what you typed (with counts), original words "
              "whose definition or KJV usage holds it, and numbers or sounds. Enter takes the first line.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, "English", query="zea")
    pg = page(cp)
    lines(pg, "zeal", CONC["zeal"][:6])
    m = col(f, "suggestions", gap=2, pad=[8, 8, 8, 8], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(m, w + 16, TB + 92, 520)
    shadow(m, 8, 28, "#00000033")
    text(m, "  ENGLISH WORDS", "label", "muted")
    for i, x in enumerate(FORMS["forms"]):
        it = row(m, f"s/{x['form']}", gap=10, pad=[7, 8, 7, 8], radius=8, W="fill", fill="accentSoft" if i == 0 else None)
        text(it, x["form"], "smallStrong" if i == 0 else "body", W="fill")
        text(it, f"{x['n']} places", "caption", "muted")
    P.divider(m)
    text(m, "  ORIGINAL WORDS WHOSE DEFINITION HOLDS “ZEAL”", "label", "muted")
    for x in LEXC["entries"]:
        it = row(m, f"s/{x['strong']}", gap=10, pad=[7, 8, 7, 8], radius=8, W="fill")
        text(it, x["strong"], "smallStrong", "accent")
        text(it, x["lemma"], "body")
        text(it, x["translit"], "caption", "muted")
        text(it, x["definition"], "caption", "muted", W="fill", maxLines=1)

    # row 2: the dictionaries
    r = row(cv, "row 2", gap=64, align="min")
    for tag, tab, nums, on, about in (
            ("C3 · Hebrew: the dictionary page", "Hebrew", [f"H{i}" for i in range(7062, 7071)], "H7068",
             "Entries in number order, as in the printed dictionary: H7068 sits among its neighbours, and the one "
             "it comes from (H7065) is on the same page. The open entry shows how the KJV renders it."),
            ("C4 · Greek: the same page for G2205", "Greek", [f"G{i}" for i in range(2203, 2209)], "G2205",
             "The Greek dictionary works the same way; its letters run along the navigator.")):
        f = Q.win(r, PG, tag, about)
        w = M.rail5(f, on="Concordance")
        M.slim_bar(f, x=w, w=W - w)
        cp = book(f, w, W - w, tab, query=on)
        pg = page(cp, pad=(14, 24, 14, 24))
        two = row(pg, "columns", gap=24, W="fill", align="min")
        half = (len(nums) + 1) // 2
        for part in (nums[:half], nums[half:]):
            c_ = col(two, "column", gap=4, W="fill")
            for n in part:
                entry(c_, n, on=(n == on), full=True)

    # row 3: interlinear, and arriving from the reader
    r = row(cv, "row 3", gap=64, align="min")
    f = Q.win(r, PG, "C5 · Interlinear: a passage",
              "Verse, Passage or Chapter. Each verse's KJV text, then its words; a number opens its entry in the "
              "Hebrew or Greek tab.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, "Interlinear", query="Numbers 25:11-12")
    pg = page(cp, pad=(16, 24, 16, 24))
    sc = row(pg, "scope", gap=10, pad=[0, 0, 14, 0])
    text(sc, "Numbers 25:11–12", "heading")
    P.segmented(sc, ["Verse", "Passage", "Chapter"], "Passage", W="hug")
    for v in ILIN["verses"]:
        vb = col(pg, f"verse/{v['v']}", gap=8, pad=[0, 0, 16, 0], W="fill")
        para(vb, f"{v['c']}:{v['v']}  {v['text']}", "readSmall")
        cells = row(vb, "words", gap=6, W="fill", wrap=True, align="min")
        for wd in v["words"]:
            cell = col(cells, f"w/{wd['strong']}", gap=0, pad=[6, 8, 6, 8], radius=8, stroke="line", sw=1,
                       crossAlign="center", W="fixed", fill="accentSoft" if wd["strong"] in ("H7065", "H7068") else None)
            Q.put(cell, 0, 0, 104)
            text(cell, wd["original"], "heading", fontFamily=F.HEB, fontSize=18, lineHeight="24px")
            text(cell, wd["strong"], "caption", "accent")
            text(cell, wd["gloss"], "caption", "fg", maxLines=1)

    f = Q.win(r, PG, "C6 · From the reader to the Concordance and back",
              "In the reader, the word's card has In the Concordance: the book opens in the right column at "
              "ZEALOUS with Numbers 25:11 marked. The trail line records the step; the reader keeps its verse.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    M.crumbs(f, w, W - w)
    B.desk_reader(f, w, TB + 34, 560, H - TB - 34, first=10, last=13)
    cp = book(f, w + 560, W - w - 560, "English", y=TB + 34, h=H - TB - 34, query="zealous")
    pg = page(cp)
    lines(pg, "zealous", CONC["zealous"], hit="Numbers 25:11")
    entry(pg, "H7065", on=True)

USES = json.loads((D / "uses-H7068-G2205.json").read_text(encoding="utf-8"))
BOOKS = {str(b["id"]): b["name"] for b in json.loads((D / "books.json").read_text(encoding="utf-8"))["books"]}


def place_line(parent, rw):
    r = row(parent, f"place/{rw['ref']}", gap=12, W="fill", pad=[3, 6, 3, 6])
    t = text(r, rw["ref"], "caption", "muted", W="fixed")
    Q.put(t, 0, 0, 120)
    line = row(r, "words", gap=0, W="fill")
    text(line, ("… " if rw["pre"] else "") + rw["before"].rstrip(), "small", "fg", fontFamily=F.READ, maxLines=1)
    text(line, (" " if rw["before"].endswith(" ") else "") + rw["word"], "smallStrong", "accent", fontFamily=F.READ)
    text(line, " " + rw["after"] + (" …" if rw["post"] else ""), "small", "fg", fontFamily=F.READ, maxLines=1)


def tools(parent, n):
    t = row(parent, "place tools", gap=8, pad=[8, 0, 8, 0], W="fill")
    P.segmented(t, ["By English word", "By book"], "By English word" if n.startswith("H") else "By book", W="hug")
    P.chip(t, "Whole Bible", "outline", icon_name="down")
    nf = P.field(t, "Near a word…", None, icon_name="search", height=32, W="fixed")
    S.do("node.set", {"ids": [nf], "props": {"width": 200}}, ref=False)
    spacer(t)
    text(t, f"{USES[n]['occurrences']} times in {USES[n]['verses']} verses", "caption", "muted")


def by_book(parent, n):
    bb = USES[n]["by_book"]
    top = max(bb.values())
    for k, v in bb.items():
        br = row(parent, f"book/{k}", gap=8, W="fill")
        t = text(br, BOOKS[k], "caption", "fg", W="fixed")
        Q.put(t, 0, 0, 110)
        frame(br, "bar", w=max(6, int(160 * v / top)), h=8, radius=4, fill="accent", W="fixed", H="fixed")
        text(br, str(v), "caption", "muted")


def entry_with_places(f, w, n, neighbours, tab, group):
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, tab, query=n)
    body = row(cp, "body", gap=0, W="fill", H="fill", align="min")
    nb = col(body, "dictionary page", gap=2, pad=[14, 10, 14, 10], fill="sunken", W="fixed", H="fill", stroke="line",
             strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(nb, 0, 0, 230)
    text(nb, "THIS PAGE OF THE DICTIONARY", "label", "muted")
    for k in neighbours:
        e = STRONG[k]
        it = row(nb, f"n/{k}", gap=8, pad=[5, 8, 5, 8], radius=8, W="fill", fill="accentSoft" if k == n else None)
        text(it, k, "caption", "accent")
        text(it, e["lemma"], "small")
        text(it, e["definition"], "caption", "muted", W="fill", maxLines=1)
    main = col(body, "entry and places", gap=6, pad=[16, 22, 16, 22], W="fill", H="fill", clip=True)
    entry(main, n, on=True)
    tools(main, n)
    if group == "word":
        groups = {}
        for rw in USES[n]["rows"]:
            groups.setdefault(rw["word"].lower(), []).append(rw)
        for word, rws in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            hd = row(main, f"group/{word}", gap=8, pad=[8, 0, 2, 0])
            text(hd, word, "heading", fontFamily=F.READ)
            text(hd, str(len(rws)), "caption", "muted")
            for rw in rws[:4]:
                place_line(main, rw)
            if len(rws) > 4:
                text(main, f"   {len(rws) - 4} more", "caption", "accent")
    else:
        two = row(main, "by book", gap=28, W="fill", align="min")
        bars = col(two, "bars", gap=4, W="fixed")
        Q.put(bars, 0, 0, 300)
        by_book(bars, n)
        pl = col(two, "places", gap=0, W="fill")
        for rw in USES[n]["rows"][:14]:
            place_line(pl, rw)


def round2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Round 2: forms by choice, every place under an entry, the word card's new door",
                  "From the review: all forms or one word is the reader's choice; a dictionary entry lists every place "
                  "its word stands, the English rendering marked (as BibleHub does); the word card's Strong's and Every "
                  "use become one In the Concordance, and what they did moves inside the book.")
    r = row(cv, "row 2a", gap=64, align="min")
    f = Q.win(r, "Round 2", "C7 · All forms, or this word",
              "A switch at the head of the page: All forms (zeal, zealous, zealously on one page) or This word. "
              "Whichever you last chose is kept.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, "English", query="zealous")
    pg = page(cp)
    hd = row(pg, "page head", gap=10, pad=[0, 0, 14, 0], W="fill")
    P.segmented(hd, ["All forms", "This word"], "This word", W="hug")
    text(hd, "zealous · 8 places", "caption", "muted")
    lines(pg, "zealous", CONC["zealous"])

    f = Q.win(r, "Round 2", "C8 · H7068 with every place, by English word",
              "Under the entry, every place it stands, grouped by how the KJV renders it (jealousy, zeal, envy ...), "
              "the rendering marked in each line. Tools over the list: group by word or by book, narrow to part of "
              "the Bible, near another word.")
    w = M.rail5(f, on="Concordance")
    entry_with_places(f, w, "H7068", [f"H{i}" for i in range(7062, 7071)], "Hebrew", "word")

    r = row(cv, "row 2b", gap=64, align="min")
    f = Q.win(r, "Round 2", "C9 · G2205 by book",
              "The same entry page grouped by book: how the uses fall, then the places in Bible order.")
    w = M.rail5(f, on="Concordance")
    entry_with_places(f, w, "G2205", [f"G{i}" for i in range(2203, 2209)], "Greek", "book")

    f = Q.win(r, "Round 2", "C10 · The word card's one door",
              "The card keeps the word, its number and sound; its actions become In the Concordance (the entry and "
              "every place), BDB and Webster's (their books). The old actions live on inside the Concordance, mapped "
              "on the right.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, 760, H - TB, first=10, last=13)
    card = col(f, "word card", gap=10, pad=[14, 16, 14, 16], fill="surface", radius=12, stroke="line", sw=1, W="fixed")
    Q.put(card, w + 200, TB + 300, 360)
    shadow(card, 10, 30, "#00000033")
    e = STRONG["H7065"]
    hd = row(card, "head", gap=10, align="baseline")
    text(hd, "zealous", "heading", fontFamily=F.READ)
    text(hd, f"H7065 · {e['lemma']} · {e['translit']}", "caption", "muted")
    para(card, e["definition"], "small", "muted")
    P.button(card, "In the Concordance", "primary", icon_name="word", size="sm", W="fill")
    two = row(card, "books", gap=8, W="fill")
    P.button(two, "BDB", "secondary", icon_name="lexicon", size="sm", W="fill")
    P.button(two, "Webster's", "secondary", icon_name="dictionary", size="sm", W="fill")
    mp = col(f, "where the old actions went", gap=8, pad=[18, 20, 18, 20], fill="surface", radius=12, stroke="line",
             sw=1, W="fixed")
    Q.put(mp, w + 800, TB + 40, W - w - 840)
    text(mp, "Where today's card actions go", "heading")
    for old, new in (("Strong's entry", "Hebrew / Greek tab, the entry at the top"),
                     ("Every use", "the places under the entry (C8)"),
                     ("Count by book", "Group by book (C9)"),
                     ("Forms", "All forms on the English page (C7)"),
                     ("Defined by", "the search box: original words whose definition holds it (C2)"),
                     ("Near", "Near another word, over the places (C8)"),
                     ("BDB", "the BDB book on the rail"),
                     ("Definitions", "the Webster's book on the rail")):
        lr = row(mp, f"map/{old}", gap=10, W="fill", align="min")
        t = text(lr, old, "smallStrong", W="fixed")
        Q.put(t, 0, 0, 130)
        icon(lr, "right", 14, "muted")
        text(lr, new, "small", "fg", W="fill")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    round2(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "concordance.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "concordance.figcraft"
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
    tmp = build / "concordance-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window\W+(C\d+)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
