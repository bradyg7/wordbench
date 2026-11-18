"""The Concordance, drawn in detail: the printed Strong's as a book on the rail (English words A to Z, the Hebrew and
Greek dictionaries as tabs, the interlinear for a verse, passage or chapter). Nothing is built from this until the
person accepts it. Every lookup shown is in data/ (fetched with wb; see README).

    python design/features/concordance/concordance.py
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(HERE.parent / "minimize"))
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent / "words"))

import build as B  # noqa: E402
import figlib as F  # noqa: E402
import parts as P  # noqa: E402
import phase2b as Q  # noqa: E402
import minimize as M  # noqa: E402  (the rail, the top bar, folder tabs, the trail line)
import kit as K  # noqa: E402
import words as WD  # noqa: E402  (words' verse card and phone sheet, C-10)
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


# ---- data: fetched with wb (python concordance.py --fetch), never edited by hand --------------------------------------
def wb(*args):
    import os
    repo = LIB.parent
    exe = repo / "target" / "release" / "wb.exe"
    if not exe.exists():
        exe = repo / "target" / "debug" / "wb.exe"
    env = dict(os.environ)
    env.setdefault("WB_BIBLE_DB", str(repo.parent / "bible-workbench" / "datasets" / "workbench.db"))
    env.setdefault("WB_STUDY_DIR", str(Path(os.environ.get("TEMP", ".")) / "wb-concordance-empty"))
    Path(env["WB_STUDY_DIR"]).mkdir(exist_ok=True)
    out = subprocess.run([str(exe), *args], capture_output=True, text=True, encoding="utf-8", env=env, check=True)
    return out.stdout


def occurrences(row_):
    """One entry per marked word of a verse (so counted per occurrence): six words either side, as the older sheets."""
    ws = row_["words"]
    res = []
    for k, w in enumerate(ws):
        if not w["m"]:
            continue
        lo = max(0, k - 6)
        before = "".join(x["lead"] + x["t"] + x["trail"] for x in ws[lo:k]) + w["lead"]
        after = "".join(x["lead"] + x["t"] + x["trail"] for x in ws[k + 1:k + 7]).rstrip()
        res.append({"ref": f"{row_['ref']['name']} {row_['ref']['c']}:{row_['ref']['v']}", "code": row_["ref"]["code"],
                    "b": row_["ref"]["b"], "c": row_["ref"]["c"], "v": row_["ref"]["v"], "i": w["i"],
                    "word": w["t"] + w["trail"].strip(), "before": before, "after": after, "pre": lo > 0,
                    "post": k + 7 < len(ws)})
    return res


def uses_all(term):
    """Every page of `wb uses <term> --offset N`: the totals and the places, per occurrence."""
    rows, off, head = [], 0, None
    while True:
        d = json.loads(wb("uses", term, "--offset", str(off)))
        head = head or d
        rows += d["rows"]
        if not d["more"]:
            break
        off += len(d["rows"])
    occ = [o for r in rows for o in occurrences(r)]
    return {"command": f"wb uses {term} (every page, --offset)", "occurrences": head["occurrences"],
            "verses": head["verses"], "by_book": head["by_book"], "rows": occ}


def fetch():
    D.mkdir(exist_ok=True)
    out = {n: uses_all(n) for n in ("H7068", "G2205")}
    for n, v in out.items():
        assert len(v["rows"]) == v["occurrences"], (n, len(v["rows"]), v["occurrences"])
    (D / "uses-H7068-G2205.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    h = uses_all("heart")
    assert len(h["rows"]) == h["occurrences"], (len(h["rows"]), h["occurrences"])
    per = {}
    for o in h["rows"]:
        per.setdefault(str(o["b"]), []).append(o)
    assert {k: len(v) for k, v in per.items()} == {k: v for k, v in h["by_book"].items()}
    # the number of the original word, from wb word, for the first four places of the first six books (the ones drawn)
    for k in list(per)[:6]:
        for o in per[k][:4]:
            w = json.loads(wb("word", o["code"], str(o["c"]), str(o["v"]), str(o["i"])))
            o["strong"] = w["strong"]
    h["groups"] = {k: {"count": len(v), "first": v[:4]} for k, v in per.items()}
    del h["rows"]
    (D / "uses-heart.json").write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
    small = {}
    for t in ("and", "the", "of"):
        d = json.loads(wb("uses", t))
        small[t] = {"command": f"wb uses {t} (first page)", "occurrences": d["occurrences"], "verses": d["verses"],
                    "refs": [f"{r['ref']['name']} {r['ref']['c']}:{r['ref']['v']}" for r in d["rows"]]}
    (D / "uses-small-words.json").write_text(json.dumps(small, ensure_ascii=False, indent=1), encoding="utf-8")
    # the verse opened from the first place line of H7068 (C11), the reader's verses beside it, and its interlinear
    first = out["H7068"]["rows"][0]
    key = f"{first['code']} {first['c']}:{first['v']}"
    slug = f"{first['code'].lower()}{first['c']}-{first['v']}"
    (D / f"text-{slug}.json").write_text(json.dumps({"command": f'wb text "{key}"', "output": wb("text", key)},
                                                    ensure_ascii=False, indent=1), encoding="utf-8")
    il = json.loads(wb("interlinear", key))
    (D / f"interlinear-{slug}.json").write_text(json.dumps({
        "command": f'wb interlinear "{key}" (verses[].words[]: original, strong, gloss)',
        "verses": [{"c": v["c"], "v": v["v"], "text": v["text"],
                    "words": [{k: w[k] for k in ("original", "strong", "gloss")} for w in v["words"]]}
                   for v in il["verses"]]}, ensure_ascii=False, indent=1), encoding="utf-8")
    rng = f"{first['code']} {first['c']}:{first['v'] - 2}-{first['v'] + 2}"
    (D / f"text-{first['code'].lower()}{first['c']}-reader.json").write_text(
        json.dumps({"command": f'wb text "{rng}"', "output": wb("text", rng)}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print("fetched")



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
            # English: the letter of the word shown; Hebrew and Greek: the letter of the open entry's word
            on = (ch == query[:1].upper()) if tab == "English" else ch in ("ק", "Ζ")
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


def save_mark(parent, on, label=True):
    """Library S5's mark (the bookmark; library.py keep_button), labelled Save: filled and 'Saved' once it is."""
    b = row(parent, "save", gap=6, pad=[5, 10, 5, 8] if label else [4, 4, 4, 4], radius=8,
            fill="accentSoft" if on else "surface", stroke="accent" if on else "line", sw=1)
    icon(b, "bookmark", 16 if label else 15, "accent" if on else "muted")
    if label:
        text(b, "Saved" if on else "Save", "smallStrong", "accent" if on else "fg")
    return b


def entry(parent, n, on=False, full=True, mark=None, brief=False):
    e = STRONG[n]
    b = col(parent, f"entry/{n}", gap=4, pad=[10, 12, 10, 12], radius=10, W="fill",
            fill="accentSoft" if on else None, stroke="accent" if on else None, sw=1 if on else None)
    hd = row(b, "head", gap=10, W="fill", align="baseline")
    text(hd, n, "smallStrong", "accent")
    text(hd, e["lemma"], "heading", fontSize=20, lineHeight="26px")
    text(hd, f"{e['translit']}  ·  {e['pron']}" + (f"  ·  {e['pos']}" if e.get("pos") and full else ""), "caption", "muted",
         W="fill")
    if e.get("occurrences"):
        text(hd, f"{e['occurrences']}×", "caption", "muted")
    if mark is not None:
        save_mark(hd, mark)
    if full or on:
        para(b, e["definition"], "small")
        if brief:
            return
        if e.get("derivation"):
            text(b, re.sub(r"\[\[(\w+)\]\]", r"\1", e["derivation"]), "caption", "muted")
        if e.get("usage"):
            para(b, "KJV: " + re.sub(r"\[\[(\w+)\]\]", r"\1", e["usage"]), "caption", "muted")
        if on and e.get("renderings"):
            rr = row(b, "renderings", gap=6, wrap=True, W="fill")
            for x in e["renderings"]:
                P.chip(rr, f"{x['w']} {x['n']}", "quiet")


def switch_head(pg, caption):
    """C7's head of every English page (C-1, C-9): the All forms / This word switch and what the page holds."""
    hd = row(pg, "page head", gap=10, pad=[0, 0, 14, 0], W="fill")
    P.segmented(hd, ["All forms", "This word"], "This word", W="hug")
    text(hd, caption, "caption", "muted")
    return hd


def slim_bar(f, x, w, place):
    """minimize's slim top bar with the place it shows (M.slim_bar always says Numbers 25)."""
    bar = row(f, "top bar", gap=10, pad=[0, 12, 0, 12], fill="sunken", W="fixed", H="fixed", stroke="line",
              strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(bar, x, 0, w, TB)
    nav = row(bar, "place", gap=2)
    P.icon_button(nav, "left", "fg", size=32, icon_size=18)
    pl = row(nav, "place button", gap=6, pad=[5, 10, 5, 12], radius=8, fill="surface", stroke="line", sw=1)
    icon(pl, "book", 18, "fg")
    text(pl, place, "bodyStrong")
    text(pl, "KJV", "caption", "muted")
    icon(pl, "down", 14, "muted")
    P.icon_button(nav, "right", "fg", size=32, icon_size=18)
    spacer(bar)
    cmd = row(bar, "command field", gap=10, pad=[0, 10, 0, 12], fill="surface", radius=8, stroke="line", sw=1,
              W="fixed", H="fixed")
    Q.put(cmd, 0, 0, 520, 34)
    icon(cmd, "search", 18, "muted")
    text(cmd, "Search, go to a place, or type a command", "small", "muted", W="fill", maxLines=1)
    P.kbd(cmd, "`")
    spacer(bar)
    frame(bar, "balance", w=170, h=8, W="fixed", H="fixed")
    return bar


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

HEART = json.loads((D / "uses-heart.json").read_text(encoding="utf-8"))
SMALL = json.loads((D / "uses-small-words.json").read_text(encoding="utf-8"))
USES = json.loads((D / "uses-H7068-G2205.json").read_text(encoding="utf-8"))
BOOKS = {str(b["id"]): b["name"] for b in json.loads((D / "books.json").read_text(encoding="utf-8"))["books"]}


def trim(rw, k):
    """The same place with k words either side (the narrow windows)."""
    b, a = rw["before"].split(" "), rw["after"].split(" ")
    pre = rw["pre"] or len([x for x in b if x]) > k
    post = rw["post"] or len([x for x in a if x]) > k
    return " ".join(b[-(k + 1):]) if len([x for x in b if x]) > k else rw["before"], " ".join(a[:k]), pre, post


def place_line(parent, rw, narrow=False, mark=None, hit=False, words=None):
    """One place: its reference (which opens the verse card, C-4), the words around the marked one, its number,
    and library's mark (C-7) when mark is on/off."""
    r = (col if narrow else row)(parent, f"place/{rw['ref']}", gap=1 if narrow else 12, W="fill",
                                 pad=[3, 6, 3, 6], radius=6, fill="accentSoft" if hit else None)
    if narrow:
        top = row(r, "ref", gap=8, W="fill")
        text(top, rw["ref"], "caption", "accent" if hit else "muted", W="fill")
        if rw.get("strong"):
            text(top, rw["strong"], "caption", "accent")
        if mark is not None:
            save_mark(top, mark == "on", label=False)
        before, after, pre, post = trim(rw, 3)
    else:
        t = text(r, rw["ref"], "caption", "accent" if hit else "muted", W="fixed")
        Q.put(t, 0, 0, 120)
        if words:
            before, after, pre, post = trim(rw, words)
        else:
            before, after, pre, post = rw["before"], rw["after"], rw["pre"], rw["post"]
    line = row(r, "words", gap=0, W="fill")
    text(line, ("… " if pre else "") + before.rstrip(), "small", "fg", fontFamily=F.READ, maxLines=1)
    text(line, (" " if before.endswith(" ") else "") + rw["word"], "smallStrong", "accent", fontFamily=F.READ)
    text(line, " " + after + (" …" if post else ""), "small", "fg", fontFamily=F.READ, maxLines=1)
    if not narrow:
        if rw.get("strong"):
            text(r, rw["strong"], "caption", "accent")
        if mark is not None:
            save_mark(r, mark == "on", label=False)


def tools(parent, n, compact=False, seg=None, total=None):
    t = row(parent, "place tools", gap=8, pad=[8, 0, 8, 0], W="fill", wrap=compact)
    P.segmented(t, ["By English word", "By book"],
                seg or ("By English word" if n.startswith("H") else "By book"), W="hug")
    P.chip(t, "Whole Bible", "outline", icon_name="down")
    if not compact:
        nf = P.field(t, "Near a word…", None, icon_name="search", height=32, W="fixed")
        S.do("node.set", {"ids": [nf], "props": {"width": 200}}, ref=False)
        spacer(t)
    if total is not False:
        text(t, total or f"{USES[n]['occurrences']} times in {USES[n]['verses']} verses", "caption", "muted")


def by_book(parent, n):
    bb = USES[n]["by_book"]
    top = max(bb.values())
    for k, v in bb.items():
        br = row(parent, f"book/{k}", gap=8, W="fill")
        t = text(br, BOOKS[k], "caption", "fg", W="fixed")
        Q.put(t, 0, 0, 110)
        frame(br, "bar", w=max(6, int(160 * v / top)), h=8, radius=4, fill="accent", W="fixed", H="fixed")
        text(br, str(v), "caption", "muted")


def word_key(rw):
    return re.sub(r"[^\w]", "", rw["word"].lower())


def word_groups(parent, n, per=4, narrow=False, marks=None, hit=None, limit=None, words=None):
    """Grouped by English word, counted per occurrence (C-3): per lines each, then 'N more'."""
    groups = {}
    for rw in USES[n]["rows"]:
        groups.setdefault(word_key(rw), []).append(rw)
    for word, rws in list(sorted(groups.items(), key=lambda kv: -len(kv[1])))[:limit]:
        hd = row(parent, f"group/{word}", gap=8, pad=[8, 0, 2, 0])
        text(hd, word, "heading", fontFamily=F.READ)
        text(hd, str(len(rws)), "caption", "muted")
        for i, rw in enumerate(rws[:per]):
            mk = None if marks is None else ("on" if marks == (word, i) else "off")
            place_line(parent, rw, narrow=narrow, mark=mk, hit=(hit == (word, i)), words=words)
        if len(rws) > per:
            text(parent, f"   {len(rws) - per} more", "caption", "accent")
    return {k: len(v) for k, v in groups.items()}


def entry_with_places(f, w, n, neighbours, tab, group, saved=False, marks=None):
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
    entry(main, n, on=True, mark=saved)
    tools(main, n)
    if group == "word":
        word_groups(main, n, marks=marks)
    else:
        two = row(main, "by book", gap=28, W="fill", align="min")
        bars = col(two, "bars", gap=4, W="fixed")
        Q.put(bars, 0, 0, 300)
        by_book(bars, n)
        pl = col(two, "places", gap=0, W="fill")
        for rw in USES[n]["rows"][:14]:
            place_line(pl, rw, mark=None if marks is None else "off")


def group_counts(n):
    g = {}
    for r_ in USES[n]["rows"]:
        g[word_key(r_)] = g.get(word_key(r_), 0) + 1
    return g


for _n in ("H7068", "G2205"):
    assert group_counts(_n) == {x["w"]: x["n"] for x in STRONG[_n]["renderings"]}, (_n, group_counts(_n))
    assert len(USES[_n]["rows"]) == USES[_n]["occurrences"] == STRONG[_n]["occurrences"], _n
JEALOUSY = group_counts("H7068")["jealousy"]


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
    switch_head(pg, "zealous · 8 places")
    lines(pg, "zealous", CONC["zealous"])

    f = Q.win(r, "Round 2", "C8 · H7068 with every place, by English word",
              "Under the entry, every place it stands, grouped by how the KJV renders it (jealousy, zeal, envy ...), "
              f"the rendering marked in each line, counted per occurrence (jealousy {JEALOUSY}, as the entry says). Tools "
              "over the list: group by word or by book, narrow to part of the Bible, near another word. Save "
              "(library S5's mark, C-7) is on the entry and on each place; the entry and one place are saved here.")
    w = M.rail5(f, on="Concordance")
    entry_with_places(f, w, "H7068", [f"H{i}" for i in range(7062, 7071)], "Hebrew", "word", saved=True,
                      marks=("jealousy", 2))

    r = row(cv, "row 2b", gap=64, align="min")
    f = Q.win(r, "Round 2", "C9 · G2205 by book",
              "The same entry page grouped by book: how the uses fall, then the places in Bible order.")
    w = M.rail5(f, on="Concordance")
    entry_with_places(f, w, "G2205", [f"G{i}" for i in range(2203, 2209)], "Greek", "book", saved=False, marks=())

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


def verses_of(out):
    return [{"v": int(m.group(1)), "text": m.group(2)} for ln in out.splitlines()[1:]
            if (m := re.match(r"(\d+) (.*)", ln))]


OPEN = json.loads((D / "interlinear-num5-14.json").read_text(encoding="utf-8"))["verses"][0]
OPEN_VERSES = verses_of(json.loads((D / "text-num5-14.json").read_text(encoding="utf-8"))["output"])  # wb text, C-10
READER = verses_of(json.loads((D / "text-num5-reader.json").read_text(encoding="utf-8"))["output"])
OPEN_REF = f"Numbers {OPEN['c']}:{OPEN['v']}"


def conc_pane(f, x, y, w, h, query, tab="Hebrew", narrow=False, actions=("minimize", "expand", "float", "close"),
              tabs=("Concordance",)):
    """The Concordance in a pane of any width: its strip, a search box and the four tabs (stacked when narrow)."""
    cp = frame(f, "concordance", x=x, y=y, w=w, h=h, fill="surface", layout="vertical", W="fixed", H="fixed", clip=True,
               stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    M.folder_strip(cp, list(tabs), "Concordance", actions=actions)
    nav = (col if narrow else row)(cp, "navigator", gap=8 if narrow else 10, pad=[10, 14, 10, 14], W="fill",
                                   stroke="line", strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0,
                                   strokeRightWeight=0)
    fld = P.field(nav, "Word, number or sound", query, icon_name="search", height=34, W="fill" if narrow else "fixed")
    if not narrow:
        S.do("node.set", {"ids": [fld], "props": {"width": 220}}, ref=False)
    P.segmented(nav, ["English", "Hebrew", "Greek", "Interlinear"], tab, W="fill" if narrow else "hug")
    return cp


def h7068_body(cp, narrow, saved_place=("jealousy", 0), hit=None, limit=2, pad=(12, 16, 12, 16), brief=False, words=None):
    main = col(cp, "entry and places", gap=6, pad=list(pad), W="fill", H="fill", clip=True)
    entry(main, "H7068", on=True, full=not narrow, mark=True, brief=brief)
    tools(main, "H7068", compact=True, total=False if narrow else None)
    word_groups(main, "H7068", narrow=narrow, marks=saved_place, hit=hit, limit=limit, words=words)
    return main


def round3(board):
    cv = Q.section(board, "Round 3", 3200)
    Q.sheet_title(cv, "Round 3: the real conditions, drawn (2026-11-16)",
                  "The Concordance among other tabs, floated small over the reader, narrow (a side pane and phone width) "
                  "and after years of study (an entry with hundreds of places, and a small-words page). Places, counts "
                  "and scripture are fetched with wb; pages named on the sheets are a drawn sample, not anyone's study.")
    r = row(cv, "row 3a", gap=64, align="min")
    f = Q.win(r, "Round 3", "C11 · Among other tabs: a tab beside the reader and a page",
              "The Concordance is one tab among the reader (Numbers 5) and a page, each in its own pane. A place "
              "line's reference opens the verse card of words W4 over the panes (C-4): the card moves, floats, and "
              "closing it leaves the entry, group and scroll, and the reader's place, as they were (5f45).")
    w = M.rail5(f, on="Concordance")
    slim_bar(f, w, W - w, "Numbers 5")
    rw_, pw_ = 400, 300
    body = M.pane(f, w, TB, rw_, H - TB, ["Numbers 5"], "Numbers 5", side="left", actions=("minimize", "expand", "close"))
    text(body, "Numbers 5", "chapter", fontSize=26, lineHeight="34px")
    F.verses(body, READER, "readSmall")
    body = M.pane(f, w + rw_, TB, pw_, H - TB, ["Phinehas"], "Phinehas", side="left",
                  actions=("minimize", "expand", "close"))
    para(body, "a page (a drawn sample)", "small", "muted")
    cx = w + rw_ + pw_
    cp = conc_pane(f, cx, TB, W - cx, H - TB, "H7068")
    h7068_body(cp, narrow=False, hit=("jealousy", 0), limit=3, words=4)
    WD.verse_card(f, cx - 520, TB + 330, 520, OPEN_VERSES, OPEN_REF, note=True, floated=False,
                  text_style="readSmall", compact=False)

    f = Q.win(r, "Round 3", "C12 · Floated small over the reader",
              "Float makes the Concordance a small floating pane over the reader (minimize B2): the search box and "
              "tabs stack, each place shows three words either side, the entry still has its Save mark. It is "
              "dragged and sized from its corner; the reader's verse stays where it was.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    B.desk_reader(f, w, TB, W - w, H - TB, first=10, last=13)
    fw = frame(f, "floated concordance", x=W - 470, y=TB + 70, w=420, h=600, fill="surface", radius=12, stroke="line",
               sw=1, layout="vertical", W="fixed", H="fixed", clip=True)
    shadow(fw, 14, 40, "#00000026")
    M.folder_strip(fw, ["Concordance"], "Concordance", actions=("minimize", "expand", "close"))
    nav = col(fw, "navigator", gap=8, pad=[10, 14, 10, 14], W="fill", stroke="line", strokeBottomWeight=1,
              strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    P.field(nav, "Word, number or sound", "H7068", icon_name="search", height=34, W="fill")
    P.segmented(nav, ["English", "Hebrew", "Greek", "Interlinear"], "Hebrew", W="fill")
    h7068_body(fw, narrow=True, limit=2)

    r = row(cv, "row 3b", gap=64, align="min")
    f = Q.win(r, "Round 3", "C13 · Narrow: a side pane",
              "A narrow pane (360 wide) beside the reader, as the Concordance is docked in a small window. Same "
              "entry, same groups, same Save mark; the controls stack and the places wrap onto two lines.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cw = 360
    B.desk_reader(f, w, TB, W - w - cw, H - TB, first=10, last=13)
    cp = conc_pane(f, W - cw, TB, cw, H - TB, "H7068", narrow=True, actions=("minimize", "expand", "close"))
    h7068_body(cp, narrow=True, limit=3)

    pw, ph = 390, 800
    f = Q.win(r, "Round 3", "C13 · Narrow: phone width (390 wide)",
              "At phone width the Concordance fills the screen, strip on top: the search box, the four tabs full "
              "width, the entry and its places stacked. A place's reference opens words W4's sheet from the bottom, "
              "as words W10 draws it (words' own drawing, C-10: full tab labels and the float button).", w=pw, h=ph)
    cp = conc_pane(f, 0, 0, pw, ph, "H7068", narrow=True, actions=("minimize", "close"))
    h7068_body(cp, narrow=True, hit=("jealousy", 0), limit=2, pad=(10, 14, 10, 14), brief=True)
    WD.verse_phone_sheet(f, pw, ph, 247, OPEN_REF, OPEN_VERSES)

    r = row(cv, "row 3c", gap=64, align="min")
    f = Q.win(r, "Round 3", "C14 · Years of study: an entry with hundreds of places",
              f"The English page for heart is C1's page with C7's switch at its head (C-9, an inference): "
              f"{HEART['occurrences']} places in {HEART['verses']} verses, shown under their books "
              f"({len(HEART['groups'])}) in Bible order, 4 lines and \"N more\" each, counted per occurrence. "
              "No tools row: Whole Bible and Near are an entry's tools (C8). Every number is wb uses heart.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, "English", query="heart")
    pg = page(cp, pad=(16, 28, 16, 28))
    switch_head(pg, f"heart · {HEART['occurrences']:,} places in {HEART['verses']} verses")
    for k, g in HEART["groups"].items():
        bh = row(pg, f"group/{BOOKS[k]}", gap=8, pad=[8, 0, 2, 0])
        text(bh, BOOKS[k], "heading", fontFamily=F.READ)
        text(bh, str(g["count"]), "caption", "muted")
        for o in g["first"]:
            place_line(pg, o)
        if g["count"] > 4:
            text(pg, f"   {g['count'] - 4} more", "caption", "accent")

    f = Q.win(r, "Round 3", "C14 · The small words: references only",
              "The commonest small words are in the book as the printed one has them (C-2): the word, how many "
              "times, and references only, with no words around them and no number. Counts and references are "
              "wb uses; the lists are the first references in Bible order.")
    w = M.rail5(f, on="Concordance")
    M.slim_bar(f, x=w, w=W - w)
    cp = book(f, w, W - w, "English", query="the")
    pg = page(cp)
    for word in ("and", "the", "of"):
        d = SMALL[word]
        blk = col(pg, f"heading/{word}", gap=4, pad=[0, 0, 14, 0], W="fill")
        hd = row(blk, "head", gap=10, W="fill", align="baseline")
        text(hd, word.upper(), "heading", "fg", fontFamily=F.READ)
        text(hd, f"{d['occurrences']:,} times in {d['verses']:,} verses", "caption", "muted")
        text(hd, "references only", "caption", "accent")
        rr = row(blk, "references", gap=14, wrap=True, W="fill")
        for ref in d["refs"][:18]:
            text(rr, ref, "caption", "muted")
        text(blk, f"   {d['verses'] - 18:,} more", "caption", "accent")


def main():
    if "--fetch" in sys.argv:
        return fetch()
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    round2(board)
    round3(board)
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
    # one vector PDF of the board, in the board's order (the person, 2026-11-12): sharp at any zoom, no PNGs
    pdf = HERE / f"{HERE.name}.pdf"
    subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", BOARD, "--format",
                    "pdf", "--out", str(pdf)], check=True, capture_output=True)
    shutil.rmtree(HERE / "exports", ignore_errors=True)
    print("exported", pdf.name)


if __name__ == "__main__":
    main()
