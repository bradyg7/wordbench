"""Tether: finding the scripture in a long note, round 1 (TG1-TG13), drawn 2026-11-17.
The Notebook page's Find scripture… and the Tether pane: a reference the person named (said or wrote), words in the note
that are a verse's words in order, what Accept writes, what is not offered, the handoff to documents, the one thing that
needs the person (TG8), and the real conditions. Scripture and searches are fetched with wb into data/; the quoted words
in the note are cut from the fetched verse by word position (a filler word added, one word dropped); every number that
counts words is computed here. Page and document names, and the person's own sentences, are a drawn sample.

    python design/features/tether/tether.py
"""
import json
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import F, M, P, Q, W, H, TB, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

# the wb binary: this worktree's target if it was built, else the main checkout's (only read; nothing is written there)
if not (K.REPO / "target" / "release" / "wb.exe").exists() and not (K.REPO / "target" / "debug" / "wb.exe").exists():
    K.REPO = Path(r"C:\Users\brady\github\bible-workbench-rs")

PG = "Tether"
S = F.S


# --- data fetched from the database ---------------------------------------------------------------------------------

def wbt(name, ref):
    """wb text <ref> -> (the reference as the database names it, the verses [{v, text}])."""
    out = K.fetch(HERE, name, ["text", ref], as_json=False)
    return out.splitlines()[0].rsplit(" (", 1)[0], K.verses_of(out)


REF_2TI, V_2TI = wbt("2ti2-15", "2 Tim 2:15")
REF_ROM, V_ROM = wbt("rom8-28", "Rom 8:28")
REF_PRO, V_PRO = wbt("pro27-17", "Prov 27:17")
REF_NUM, V_NUM = wbt("num25-11-13", "Num 25:11-13")
REF_PHI, V_PHI = wbt("phi4-13", "Phil 4:13")
REFS = {"2ti": REF_2TI, "rom": REF_ROM, "pro": REF_PRO, "num": REF_NUM, "phi": REF_PHI}


def norm(w):
    return re.sub(r"[^\w]", "", w.lower())


def words_of(s):
    return s.split()


def search_info(name, query):
    """wb search --json <query>, saved to data/<name>.json with the command; returns (verses count, rows)."""
    d = K.fetch(HERE, name, ["search", "--json", query])
    return d["verses"], d["rows"]


def scan_windows(verses_by_ref, n=6):
    """Every n-word window inside one verse, as plain lower-case words (punctuation stripped)."""
    for ref, text_ in verses_by_ref:
        ws = [norm(w) for w in words_of(text_)]
        for i in range(0, len(ws) - n + 1):
            if all(ws[i:i + n]):
                yield ref, i, " ".join(ws[i:i + n])


def cached(name):
    p = HERE / "data" / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def find_parallel():
    """The first 6-word window of one Matthew chapter whose wb search finds exactly 2 verses (TG-6, TG3)."""
    c = cached("parallel-search")
    if c:
        q = c["command"].split("--json ", 1)[1]
        v, rows = search_info("parallel-search", q)
        return q, v, rows
    for ch in range(3, 29):
        out = K.verses_of(K.wb("text", f"Matt {ch}"))
        for ref, i, q in scan_windows([(ch, x["text"]) for x in out]):
            vs, _ = (lambda d: (d["verses"], d["rows"]))(K.wb("search", "--json", q, as_json=True))
            if vs == 2:
                v, rows = search_info("parallel-search", q)
                return q, v, rows
    sys.exit("no 2-verse window found")


def find_many(want=4):
    """Windows of Jeremiah 7 whose wb search finds more than 3 verses, from different verses (TG-6, TG6)."""
    found = []
    c = cached("many-1")
    if c:
        for k in range(1, want + 1):
            q = cached(f"many-{k}")["command"].split("--json ", 1)[1]
            v, rows = search_info(f"many-{k}", q)
            found.append((q, v))
        return found
    out = K.verses_of(K.wb("text", "Jer 7"))
    seen = set()
    for ref, i, q in scan_windows([(x["v"], x["text"]) for x in out]):
        if ref in seen:
            continue
        d = K.wb("search", "--json", q, as_json=True)
        if d["verses"] > 3:
            seen.add(ref)
            v, _ = search_info(f"many-{len(found) + 1}", q)
            found.append((q, v))
            if len(found) == want:
                break
    return found


PAR_Q, PAR_N, PAR_ROWS = find_parallel()
MANY = find_many(4)
assert PAR_N == 2 and all(n > 3 for _, n in MANY)
PAR_WORDS = PAR_Q.split()


def assert_cut(chapter_ref, window):
    """The searched window is a run of consecutive words of one verse of the fetched chapter (never typed)."""
    ok = False
    for x in K.verses_of(K.wb("text", chapter_ref)):
        ws = [norm(w) for w in words_of(x["text"])]
        n = len(window.split())
        ok |= any(ws[i:i + n] == window.split() for i in range(len(ws) - n + 1))
    assert ok, f"{window!r} is not a cut from {chapter_ref}"


_m = next(r_ for r_ in PAR_ROWS if r_["ref"]["name"] == "Matthew")
assert_cut(f"Matt {_m['ref']['c']}", PAR_Q)
for _q, _n in MANY:
    assert_cut("Jer 7", _q)

# --- the sample note: the person's own sentences; scripture words inside them are cut from the fetched verses ----------

NAMED_PHRASE = "second Timothy two fifteen"
S_NAMED = "So the next thing I want to talk about is second Timothy two fifteen and why I keep coming back to it."
S_ROM = "Then after the break we go to Romans 8 verse 28 and I will read it slowly."
BLOCK14 = S_NAMED + " " + S_ROM
Q_PRE = "and you know what I mean about Tuesday nights"
Q_POST = "and that is why we keep meeting."
M_PRE = "and then he just kept saying"
M_POST = "over and over and I stopped writing."


def phrase_span(sentence, phrase):
    """Word positions (i, j) of a spoken phrase inside a sentence; asserts it is there, in order and whole."""
    sw = [norm(w) for w in words_of(sentence)]
    pw = [norm(w) for w in words_of(phrase)]
    for i in range(len(sw) - len(pw) + 1):
        if sw[i:i + len(pw)] == pw:
            return i, i + len(pw)
    raise AssertionError(f"{phrase!r} is not in the sentence")


def segs_of(sentence, spans, tone):
    """The sentence as [(words, highlight or None)] with the word spans (i, j) marked."""
    ws = words_of(sentence)
    mark = [None] * len(ws)
    for i, j in spans:
        for k in range(i, j):
            mark[k] = tone
    out, cur, curm = [], [], mark[0] if ws else None
    for w, m in zip(ws, mark):
        if m != curm:
            out.append((" ".join(cur), curm))
            cur, curm = [], m
        cur.append(w)
    out.append((" ".join(cur), curm))
    return out


def ending(sentence, n=5):
    return "…" + " ".join(words_of(sentence)[-n:])


# the spoken reference: marked words in the note
NI, NJ = phrase_span(S_NAMED, NAMED_PHRASE)
NAMED_SEGS = segs_of(S_NAMED, [(NI, NJ)], "blue")
assert " ".join(words_of(S_NAMED)[NI:NJ]) == NAMED_PHRASE

# the quotation: Proverbs 27:17's words, one dropped and a filler added, as speech makes it (TG-7)
PRO_TEXT = V_PRO[0]["text"]
PRO_W = words_of(PRO_TEXT)
assert " ".join(PRO_W) == PRO_TEXT
DROP, FILL_AT, FILLER = {7}, 2, "uh"
QTOK = []  # (spoken word, index of the verse word it is, or None for a filler)
for k, w in enumerate(PRO_W):
    if k == FILL_AT:
        QTOK.append((FILLER, None))
    if k in DROP:
        continue
    QTOK.append((norm(w), k))
vidx = [k for _, k in QTOK if k is not None]
assert vidx == sorted(vidx), "the quoted words are not in the verse's order"
assert all(w == norm(PRO_W[k]) for w, k in QTOK if k is not None), "a quoted word is not the verse's word"
assert set(range(len(PRO_W))) - set(vidx) == DROP, "dropped words differ"
assert all(b - a <= 3 for a, b in zip(vidx, vidx[1:])), "a gap is wider than TG-7 allows"
Q_MATCHED, Q_OF = len(vidx), len(PRO_W)
Q_SPOKEN = " ".join(w for w, _ in QTOK)
Q_SENT = f"{Q_PRE} {Q_SPOKEN} {Q_POST}"
QI = len(words_of(Q_PRE))
QJ = QI + len(QTOK)
assert words_of(Q_SENT)[QI:QJ] == [w for w, _ in QTOK]
Q_SEGS = [(Q_PRE, None)]
# the filler is not marked: only the words that are the verse's words
cur = []
for w, k in QTOK:
    if k is None:
        if cur:
            Q_SEGS.append((" ".join(cur), "yellow"))
            cur = []
        Q_SEGS.append((w, None))
    else:
        cur.append(w)
if cur:
    Q_SEGS.append((" ".join(cur), "yellow"))
Q_SEGS.append((Q_POST, None))
PRO_HL = {k: "yellow" for k in vidx}

# a phrase found in many verses, as the person's note has it (cut from Jeremiah 7 by the search)
MANY_Q = MANY[0][0]
M_SENT = f"{M_PRE} {MANY_Q} {M_POST}"
MI = len(words_of(M_PRE))
MJ = MI + len(words_of(MANY_Q))
assert words_of(M_SENT)[MI:MJ] == MANY_Q.split()
M_SEGS = [(M_PRE, None), (MANY_Q, "orange"), (M_POST, None)]

# counts (TG1): computed, not typed
NAMED, QUOTED, MANY_N = 61, 118, 35
FOUND = NAMED + QUOTED
assert FOUND == 179
IN_PAGE0, SKIPPED0 = 1, 1                      # the rows TG1 shows: one In the page, one Skipped
NEW0 = FOUND - IN_PAGE0 - SKIPPED0
WORDS_TOTAL = 6412
VERSES_IN_PAGE = 37
SKIPPED13, ADDED13 = 52, NAMED                 # TG13: the named ones were added, 52 quotations skipped
NEW13 = FOUND - ADDED13 - SKIPPED13
assert NEW13 == QUOTED - SKIPPED13

# the reference reader of today on the named sentence (data/refs-spoken.json)
SENT_TWO = S_NAMED + " " + S_ROM
REFS_TODAY = K.fetch(HERE, "refs-spoken", ["refs", "--json", SENT_TWO])


def refs_today_lines():
    lines = []
    for h in REFS_TODAY:
        lines.append(f"“{SENT_TWO[h['start']:h['end']]}” → {h['ref']}")
    a = SENT_TWO.find(NAMED_PHRASE)
    b = a + len(NAMED_PHRASE)
    if not any(h["start"] < b and h["end"] > a for h in REFS_TODAY):
        lines.append(f"nothing in “{NAMED_PHRASE}”")
    return lines


# --- drawing helpers ------------------------------------------------------------------------------------------------

def flow(parent, segs, style="body", name="Paragraph"):
    """A paragraph whose words wrap; a marked stretch carries a highlight fill (as the reader's words do)."""
    fam, fstyle, size, lh, _, _ = F.TYPE[style]
    fl = frame(parent, name, layout="horizontal", wrap=True, gap=0, crossGap=0, crossAlign="baseline", W="fill", H="hug")
    ws = [(w, hl) for s, hl in segs for w in s.split()]
    sp = max(3, round(size * 0.28))  # a space's width; Inter's trailing spaces are not measured, so it is padding
    for i, (w, hl) in enumerate(ws):
        last = i == len(ws) - 1
        nxt = ws[i + 1][1] if not last else None
        props = dict(fontFamily=fam, fontStyle=fstyle, fontSize=size, lineHeight=f"{lh}px", fill=F.c("fg"))
        joined = bool(hl) and nxt == hl
        box = S.do("frame.create", {"name": f"w{i}", "parent": fl, "props": {
            "layout": "horizontal", "sizingH": "hug", "sizingV": "hug", "fill": F.c(F.HL[hl]) if hl else "none",
            "cornerRadius": 0 if joined else 3, "padding": [0, 0 if (hl and not joined) else sp, 0, 0]}})
        S.do("text.create", {"text": w, "parent": box, "x": 0, "y": 0, "props": props, "name": w}, ref=False)
        if hl and not joined and not last:
            frame(fl, "space", w=sp, h=4, W="fixed", H="fixed")
    return fl


def bars(parent, widths, h=8):
    """Lines of a page not drawn as words: plain bars (the page's other text)."""
    c = col(parent, "other text", gap=10, W="fill", pad=[4, 0, 4, 0])
    for w_ in widths:
        frame(c, "line", w=w_ or 10, h=h, radius=4, fill="line", W="fill" if w_ is None else "fixed", H="fixed")
    return c


def gutter_line(parent, num, build, dim=False):
    """A block of the page: its number in the gutter, then its content."""
    ln = row(parent, f"block {num}", gap=8, W="fill", align="min")
    nb = row(ln, "num", W="fixed", mainAlign="max", pad=[4, 0, 0, 0])
    S.do("node.set", {"ids": [nb], "props": {"width": 26}}, ref=False)
    text(nb, str(num), "caption", "muted")
    inner = col(ln, "content", gap=0, W="fill")
    build(inner)
    return ln


def crumbs(ed, title, more_on=False):
    cr = row(ed, "crumbs", gap=6, pad=[10, 16, 10, 16], W="fill")
    text(cr, f"Phinehas  /  {title}", "caption", "muted", W="fill", maxLines=1)
    icon(cr, "check", 15, "muted")
    mb = frame(cr, "more", w=28, h=28, radius=6, fill="accentSoft" if more_on else None, layout="horizontal",
               mainAlign="center", crossAlign="center", W="fixed", H="fixed")
    icon(mb, "more", 15, "accent" if more_on else "muted")
    return cr


def page_area(f, x, w, title="Word dump", more_on=False, y=TB, h=None, colw=None, sub=None):
    """A page in the window: the crumb line with its ⋯, the title, and a centred column (as library S28 lays it out)."""
    ed = frame(f, "page", x=x, y=y, w=w, h=(H - y) if h is None else h, fill="bg", layout="vertical", W="fixed",
               H="fixed", clip=True)
    crumbs(ed, title, more_on)
    wrap = row(ed, "centre", W="fill", mainAlign="center")
    colw = colw or min(720, w - 80)
    pg = col(wrap, "column", gap=10, W="fixed", pad=[16, 0, 24, 0])
    Q.put(pg, 0, 0, colw)
    text(pg, title, "display")
    if sub:
        text(pg, sub, "caption", "muted")
    return pg


def scrim(f, x, y, w, h):
    frame(f, "scrim", x=x, y=y, w=w, h=h, fill="#00000033", W="fixed", H="fixed")


def chip_for(parent, status, detail=None):
    label = status if not detail else f"{status} · {detail}"
    if status == "New":
        return P.chip(parent, label, "selected")
    if status == "In the page":
        return P.chip(parent, label, "place", icon_name="check")
    return P.chip(parent, label, "quiet")


def link(parent, s, **kw):
    return text(parent, s, "small", "accent", **kw)


def status_line(new, inp, skip):
    return f"New {new} · In the page {inp} · Skipped {skip}"


def pane_head(body, found=FOUND, many=MANY_N, words=None, status=None, extra=None, compact=False):
    hd = col(body, "head", gap=3, W="fill")
    tl = row(hd, "title", gap=8, W="fill")
    icon(tl, "book", 18, "accent")
    text(tl, "Tether", "title", W="fill")
    text(tl, "Word dump", "caption", "muted")
    s = f"{found} found in your words · {many} phrases in many verses" + (f" · {words:,} words" if words else "")
    para(hd, s, "smallStrong")
    if status:
        para(hd, status, "caption", "muted")
    if extra:
        para(hd, extra, "caption", "muted")
    return hd


def group_head(body, label, n, open_=False, note=None):
    hd = row(body, f"group/{label}", gap=6, pad=[6, 6, 6, 6], W="fill")
    icon(hd, "down" if open_ else "right", 12, "muted")
    text(hd, f"{label} · {n}", "smallStrong", W="fill")
    if note:
        text(hd, note, "caption", "muted")
    return hd


def cand_row(parent, ref, after, status, on=False, detail=None):
    it = row(parent, f"cand/{ref}", gap=8, pad=[8, 10, 8, 10], radius=8, W="fill", fill="accentSoft" if on else None)
    text(it, ref, "smallStrong" if on else "small", W="fill", maxLines=1)
    if after:
        text(it, after, "caption", "muted")
    chip_for(it, status, detail)
    return it


def cand_card(parent, ref, verse_list, marks, evidence, put_after, accept=True, vstyle="readSmall", compact=False):
    """The open candidate: the reference, the verse as fetched (words marked), the evidence in words, where it goes,
    and the two buttons (TG-2: no score, TG-5: nothing is attached until Accept)."""
    c = col(parent, f"open/{ref}", gap=6 if compact else 8, pad=[10, 12, 12, 12] if compact else [12, 14, 14, 14],
            radius=10, fill="surface", stroke="line", sw=1, W="fill")
    text(c, ref, "heading")
    F.verses(c, verse_list, vstyle, marks)
    para(c, evidence, "small")
    para(c, f"Put it: after the sentence ending ‘{put_after}’", "caption", "muted")
    b = row(c, "buttons", gap=8, W="fill")
    P.button(b, "Accept", "primary", "check", size="sm")
    P.button(b, "Skip", "secondary", size="sm")
    return c


def named_group(body, sel=None, accepted=None, card=None, status_after=None):
    """The first group opened: 3 rows in the order of place in the page (Named · 61)."""
    group_head(body, "Named", NAMED, True)
    rows = [(REF_PHI, "after block 6", "In the page", None), (REF_2TI, "after block 14", "New", None),
            (REF_ROM, "after block 14", "Skipped", None)]
    for ref, after, st, det in rows:
        if accepted and ref == accepted[0]:
            after, st, det = "", "In the page", accepted[1]
        if ref == REF_ROM and accepted:
            after = "after block 16"
        cand_row(body, ref, after, st, on=(ref == sel), detail=det)
        if card and ref == sel:
            card(body)


def rest_groups(body, quoted_note=None, many=True, quoted_open=False):
    group_head(body, "Quoted", QUOTED, quoted_open, quoted_note)
    if many:
        group_head(body, "In many verses", MANY_N)


def tether_pane(f, x, w, tabs=("Tether",), active="Tether", **kw):
    return M.pane(f, x, TB, w, H - TB, list(tabs), active, **kw)


# --- the Notebook page's menu (library S31) --------------------------------------------------------------------------

def page_menu(f, x, y, w=250):
    m = col(f, "menu/page", gap=1, pad=[6, 6, 6, 6], fill="surface", radius=10, stroke="line", sw=1, W="fixed")
    Q.put(m, x, y, w)
    shadow(m, 8, 28, "#00000033")
    items = [("Full width", "dock"), ("Small text", "type"), ("Pin", "bookmark"), ("Move to…", "folder"),
             ("Copy link", "copy"), ("Find scripture…", "book", True), ("Make a document…", "docs"), ("Delete", "trash")]
    for k, it_ in enumerate(items):
        lab, ic = it_[0], it_[1]
        hot = len(it_) > 2
        if lab in ("Make a document…", "Delete"):
            pass
        if lab == "Delete":
            P.divider(m)
        rr = row(m, f"m/{lab}", gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if hot else None)
        icon(rr, ic, 15, "warn" if lab == "Delete" else ("accent" if hot else "muted"))
        text(rr, lab, "smallStrong" if hot else "small", "warn" if lab == "Delete" else "fg", W="fill")
        if hot:
            ch = row(rr, "new", pad=[1, 7, 1, 7], radius=999, fill="accent")
            text(ch, "new", "caption", "onAccent")
    return m


# --- the windows ----------------------------------------------------------------------------------------------------

TOP_BLOCKS = [
    "Okay so this is the Tuesday recording. We are in the living room. Everyone is here.",
    "so what I want to do tonight is go through everything I wrote down this week and I am just going to keep talking "
    "and not stop to tidy it because the point is to get it all out and then sort it later",
]


def entry(cv):
    r = row(cv, "TG1", gap=64, align="min")
    f = Q.win(r, PG, "TG1 · The entry: Find scripture… in the page's menu, and the Tether pane",
              "TG-12, TG-1: the page's three-dot menu holds Find scripture… (new) beside Make a document…. It opens the Tether "
              "pane as a tab beside the page, after the run: 179 found in the person's own words and 35 phrases found in "
              "many verses, in three folded groups; the first is open with three rows, each a reference, where it "
              "falls (after a block) and its status (New, In the page, Skipped).")
    w = K.app(f, on="Notebook")
    pw = 500
    pg = page_area(f, w, W - w - pw, more_on=True, sub=f"{WORDS_TOTAL:,} words · 31 blocks")
    gutter_line(pg, 1, lambda c: flow(c, [(TOP_BLOCKS[0], None)]))
    gutter_line(pg, 2, lambda c: flow(c, [(TOP_BLOCKS[1], None)]))
    gutter_line(pg, 3, lambda c: bars(c, [None, None, 520]))
    page_menu(f, w + (W - w - pw) - 270, TB + 40)
    body = tether_pane(f, W - pw, pw)
    pane_head(body, status=status_line(NEW0, IN_PAGE0, SKIPPED0))
    named_group(body)
    rest_groups(body)


def one_named(cv):
    r = row(cv, "TG2-3", gap=64, align="min")
    # TG2
    f = Q.win(r, PG, "TG2 · A named reference, said in speech",
              "TG-8, TG-2, TG-3: the person said “second Timothy two fifteen”; the words are marked in the page and the "
              "pane shows the verse from the database, what was said, where it would go, Accept and Skip. The small "
              "line is what today's reference reader (wb refs) finds in the same sentences.")
    w = K.app(f, on="Notebook")
    pw = 520
    pg = page_area(f, w, W - w - pw)
    gutter_line(pg, 13, lambda c: bars(c, [None, 440]))
    gutter_line(pg, 14, lambda c: flow(c, NAMED_SEGS + [(S_ROM, None)]))
    gutter_line(pg, 15, lambda c: bars(c, [None, None, 380]))
    body = tether_pane(f, W - pw, pw)
    pane_head(body, status=status_line(NEW0, IN_PAGE0, SKIPPED0))

    def card(b):
        cand_card(b, REF_2TI, V_2TI, {V_2TI[0]["v"]: {}}, f"You said: “{NAMED_PHRASE}”", ending(S_NAMED))
        today = col(b, "today", gap=2, pad=[8, 10, 8, 10], radius=8, fill="sunken", W="fill")
        text(today, "Today's reference reader finds:", "caption", "muted")
        for ln in refs_today_lines():
            para(today, ln, "caption")
        text(today, "(wb refs on the same sentences)", "caption", "muted")
    named_group(body, sel=REF_2TI, card=card)
    rest_groups(body)

    # TG3
    f = Q.win(r, PG, "TG3 · A quotation",
              "TG-7, TG-2, TG-6: words in the note that are a verse's words in order are marked in the page and in the "
              "verse alike. The evidence is only counts of words (computed from the two texts); no score. The second "
              "card is one where the same six words are found in two verses: both are listed, none is preferred, and "
              "Accept on one marks the other skipped.")
    w = K.app(f, on="Notebook")
    pg = page_area(f, w, W - w - pw)
    gutter_line(pg, 20, lambda c: bars(c, [None, 500]))
    gutter_line(pg, 21, lambda c: flow(c, Q_SEGS))
    gutter_line(pg, 22, lambda c: bars(c, [None, None, 420]))
    body = tether_pane(f, W - pw, pw)
    pane_head(body, status=status_line(NEW0, IN_PAGE0, SKIPPED0))
    group_head(body, "Named", NAMED)
    group_head(body, "Quoted", QUOTED, True)
    cand_row(body, REF_PRO, "after block 21", "New", on=True)
    cand_card(body, REF_PRO, V_PRO, {17: {"hl": PRO_HL}},
              f"{Q_MATCHED} of this verse's {Q_OF} words, in order", ending(Q_SENT))
    par = col(body, "also in", gap=6, pad=[10, 12, 10, 12], radius=10, fill="surface", stroke="line", sw=1, W="fill")
    text(par, "Also in: the same words are in 2 verses", "smallStrong")
    para(par, f"“{PAR_Q}” is found in {PAR_N} verses; both are listed, the app does not choose.", "caption", "muted")
    pwords = set(PAR_WORDS)
    for rw in PAR_ROWS[:PAR_N]:
        rf = f"{rw['ref']['name']} {rw['ref']['c']}:{rw['ref']['v']}"
        hl, firsts = {}, set()
        for k, w_ in enumerate(rw["text"].split(" ")):  # the first place each word is found in the verse
            if norm(w_) in pwords and norm(w_) not in firsts:
                firsts.add(norm(w_))
                hl[k] = "yellow"
        sub = col(par, f"parallel/{rf}", gap=4, pad=[8, 10, 8, 10], radius=8, fill="sunken", W="fill")
        rr = row(sub, "head", gap=8, W="fill")
        text(rr, rf, "smallStrong", W="fill")
        P.button(rr, "Accept", "secondary", size="sm")
        F.verses(sub, [{"v": rw["ref"]["v"], "text": rw["text"]}], "small", {rw["ref"]["v"]: {"hl": hl}})
        found = len(firsts)
        assert found == len(pwords), "the verse does not hold every word searched"
        text(sub, f"{found} of the {len(pwords)} words are in this verse", "caption", "muted")


def accept(cv):
    r = row(cv, "TG4-5", gap=64, align="min")
    before = BLOCK14
    after = (S_NAMED, S_ROM)
    assert before == after[0] + " " + after[1]
    n_words = len(words_of(before))
    assert n_words == sum(len(words_of(a)) for a in after)
    f = Q.win(r, PG, "TG4 · What Accept would do (--dry-run)",
              "TG-4, TG-5: the preview names the change before it is made: the block is split after the sentence "
              "the words are in and one scripture block, holding only the reference, goes between. The person's "
              f"words are the same {n_words} before and after; only a break is added.")
    w = K.app(f, on="Notebook")
    pg = page_area(f, w, W - w, sub="a long page")
    gutter_line(pg, 14, lambda c: flow(c, NAMED_SEGS + [(S_ROM, None)]))
    gutter_line(pg, 15, lambda c: bars(c, [None, None, 380]))
    scrim(f, w, TB, W - w, H - TB)
    cw = 960
    c = K.floating(f, "preview", w + (W - w - cw) // 2, TB + 90, cw, pad=(18, 20, 18, 20), gap=14, r=14)
    text(c, f"Add {REF_2TI} after block 14: preview", "title")
    cols = row(c, "columns", gap=20, W="fill", align="min")
    for lab, blocks in (("Before", [(14, "p", BLOCK14)]),
                        ("After", [(14, "p", S_NAMED), (15, "s", None), (16, "p", S_ROM)])):
        cc = col(cols, lab, gap=10, pad=[12, 14, 14, 14], radius=10, fill="bg", stroke="line", sw=1, W="fill")
        text(cc, lab.upper(), "label", "muted")
        for n, kind, t_ in blocks:
            if kind == "p":
                segs = [(t_, None)]
                gutter_line(cc, n, lambda b, segs=segs: flow(b, segs, "small"))
            else:
                def scrip(b):
                    vb = col(b, "scripture block", gap=6, pad=[10, 14, 12, 14], radius=8, fill="surface", stroke="accent",
                             sw=1.5, W="fill")
                    h_ = row(vb, "h", gap=8, W="fill")
                    icon(h_, "book", 14, "accent")
                    text(h_, REF_2TI, "smallStrong", "accent", W="fill")
                    text(h_, "new", "caption", "accent")
                    para(vb, f"{V_2TI[0]['v']}  {V_2TI[0]['text']}", "readSmall")
                    text(vb, "```scripture  " + REF_2TI + "```", "caption", "muted")
                gutter_line(cc, n, scrip)
    para(c, f"Nothing you wrote changes; Undo. {n_words} words before, {n_words} after; the block is only broken after "
            f"the sentence ending ‘{ending(S_NAMED)}’", "small", "muted")
    b = row(c, "buttons", gap=8, W="fill")
    P.button(b, "Accept", "primary", "check", size="sm")
    P.button(b, "Cancel", "secondary", size="sm")

    f = Q.win(r, PG, "TG5 · After accepting",
              "TG-5, TG-3: the page shows the new scripture block (the verse is shown, the file holds only the "
              "reference); the row now reads In the page · block 15; the head's counts follow (New "
              f"{NEW0} → {NEW0 - 1}, In the page {IN_PAGE0} → {IN_PAGE0 + 1}); a line says it can be undone.")
    w = K.app(f, on="Notebook")
    pw = 520
    pg = page_area(f, w, W - w - pw)
    gutter_line(pg, 14, lambda b: flow(b, [(S_NAMED, None)]))

    def scrip(b):
        vb = col(b, "scripture block", gap=6, pad=[10, 14, 12, 14], radius=8, fill="surface", stroke="line", sw=1, W="fill")
        h_ = row(vb, "h", gap=8, W="fill")
        icon(h_, "book", 14, "accent")
        text(h_, REF_2TI, "smallStrong", "accent", W="fill")
        text(h_, "KJV", "caption", "muted")
        para(vb, f"{V_2TI[0]['v']}  {V_2TI[0]['text']}", "readSmall")
    gutter_line(pg, 15, scrip)
    gutter_line(pg, 16, lambda b: flow(b, [(S_ROM, None)]))
    gutter_line(pg, 17, lambda b: bars(b, [None, 400]))
    body = tether_pane(f, W - pw, pw)
    pane_head(body, status=status_line(NEW0 - 1, IN_PAGE0 + 1, SKIPPED0))
    un = row(body, "undo", gap=8, pad=[8, 10, 8, 10], radius=8, fill="sunken", W="fill")
    icon(un, "check", 14, "ok")
    text(un, f"Added {REF_2TI} as block 15", "small", W="fill")
    link(un, "Undo")
    named_group(body, accepted=(REF_2TI, "block 15"))
    rest_groups(body)


def not_offered(cv):
    r = row(cv, "TG6", gap=64, align="min")
    f = Q.win(r, PG, "TG6 · Phrases found in many verses are not offered",
              "TG-6: a run of words found in more than three verses is not a candidate. The group lists the phrase "
              "(cut from Jeremiah 7 by the search), how many verses it is found in (from wb search), and a link that "
              "opens the search. There is no Accept: the app does not choose between verses.")
    w = K.app(f, on="Notebook")
    pw = 520
    pg = page_area(f, w, W - w - pw)
    gutter_line(pg, 8, lambda c: bars(c, [None, 460]))
    gutter_line(pg, 9, lambda c: flow(c, M_SEGS))
    gutter_line(pg, 10, lambda c: bars(c, [None, None, 360]))
    body = tether_pane(f, W - pw, pw)
    pane_head(body, status=status_line(NEW0, IN_PAGE0, SKIPPED0))
    group_head(body, "Named", NAMED)
    group_head(body, "Quoted", QUOTED)
    group_head(body, "In many verses", MANY_N, True)
    for q, n in MANY:
        c = col(body, f"many/{q}", gap=4, pad=[8, 10, 8, 10], radius=8, W="fill", stroke="line", sw=1)
        para(c, f"“{q}”", "readSmall")
        rr = row(c, "line", gap=8, W="fill")
        text(rr, f"found in {n} verses", "small", "muted", W="fill")
        link(rr, "Search for it")
    text(body, f"… {MANY_N - len(MANY)} more phrases", "caption", "muted")
    para(body, "Not offered: the app does not choose between verses.", "small", "muted")


def handoff(cv):
    r = row(cv, "TG7", gap=64, align="min")
    f = Q.win(r, PG, "TG7 · The verses in order, and the handoff to documents",
              "TG-9, documents D2: accepted tethers are scripture blocks in the page, so the verses are the page's own "
              "blocks in order of place. The list shows reference and the start of the sentence each follows; Make "
              "slides… opens the builder on the page, whose parts list holds the same scripture blocks, ticked, in the "
              "same order. Commands: wb tether verses, wb craft deck --page.")
    w = K.app(f, on="Notebook")
    lw = 640
    p1 = M.pane(f, w, TB, lw, H - TB, ["Tether"], "Tether", side="left")
    hd = col(p1, "head", gap=3, W="fill")
    tl = row(hd, "title", gap=8, W="fill")
    icon(tl, "book", 18, "accent")
    text(tl, f"Verses in this page · {VERSES_IN_PAGE}", "title", W="fill")
    para(hd, "in the order they are in the page; the same blocks the document builder takes", "caption", "muted")
    LIST = [(REF_PHI, "and when the week got hard…", 6), (REF_2TI, "so the next thing I want to talk about…", 14),
            (REF_ROM, "then after the break we go to…", 16), (REF_PRO, "and you know what I mean about…", 21),
            (REF_NUM, "the thing about zeal I wanted to…", 27)]
    for k, (ref, s, blk) in enumerate(LIST):
        it = row(p1, f"verse/{ref}", gap=10, pad=[8, 10, 8, 10], radius=8, W="fill", stroke="line", sw=1)
        text(it, str(k + 1), "caption", "muted")
        c = col(it, "t", gap=0, W="fill")
        text(c, ref, "smallStrong")
        text(c, f"follows “{s}”", "caption", "muted")
        text(it, f"block {blk}", "caption", "muted")
    text(p1, f"… {VERSES_IN_PAGE - len(LIST)} more", "caption", "muted")
    bb = row(p1, "buttons", gap=8, W="fill")
    P.button(bb, "Make slides…", "primary", "pdf", size="sm")
    P.button(bb, "Copy for a script", "secondary", "copy", size="sm")
    text(p1, 'wb tether verses "Word dump" --text   ·   wb craft deck --page', "caption", "muted")

    bx = w + lw
    p2 = col(f, "builder", gap=12, pad=[20, 22, 20, 22], fill="surface", W="fixed", H="fixed", clip=True, stroke="line",
             strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    Q.put(p2, bx, TB, W - bx, H - TB)
    hd2 = col(p2, "head", gap=2, W="fill")
    text(hd2, "Make slides from Word dump", "title")
    para(hd2, "Choose the parts and what each becomes", "small", "muted")
    parts = [("Title: Word dump", "Title slide")] + [(f"Scripture: {ref}", "A slide per verse") for ref, _, _ in LIST]
    for part, becomes in parts:
        it = row(p2, part, gap=10, pad=[8, 8, 8, 8], radius=8, stroke="line", sw=1, W="fill")
        bx_ = frame(it, "box", w=18, h=18, radius=4, fill="accent", stroke="accent", sw=1.5, W="fixed", H="fixed",
                    layout="horizontal", mainAlign="center", crossAlign="center")
        icon(bx_, "check", 13, "onAccent", weight=2.4)
        text(it, part, "small", "fg", W="fill", maxLines=1)
        dd = row(it, "becomes", gap=4, pad=[3, 8, 3, 8], radius=6, stroke="line", sw=1)
        text(dd, becomes, "caption")
        icon(dd, "down", 12, "muted")
    text(p2, f"… {VERSES_IN_PAGE - len(LIST)} more scripture parts, ticked, in the page's order", "caption", "muted")
    P.button(p2, "Make", "primary", size="sm")


def needs_person(cv):
    r = row(cv, "TG8", gap=64, align="min")
    f = Q.win(r, PG, "TG8 · NEEDS THE PERSON, not leading: Suggest by meaning (AI), drawn so the question can be answered",
              "TG-14, Needs the person 1: nothing here is built. It draws what would leave the computer, so the person "
              "can say yes or no to the AGENTS.md rule. The tab is off by default, asks before each use and sends only "
              "the paragraph text shown. Muted on purpose: it is not the design.")
    w = K.app(f, on="Notebook")
    pg = page_area(f, w, W - w)
    gutter_line(pg, 14, lambda c: bars(c, [None, None, 400]))
    scrim(f, w, TB, W - w, H - TB)
    cw = 760
    c = K.floating(f, "AI disclosure", w + (W - w - cw) // 2, TB + 60, cw, pad=(20, 22, 22, 22), gap=12, r=14)
    c_stroke = row(c, "label", gap=8, W="fill")
    ch = row(c_stroke, "tag", pad=[3, 10, 3, 10], radius=999, fill="sunken", stroke="muted", sw=1)
    text(ch, "Drawn so the question can be answered", "caption", "muted")
    spacer(c_stroke)
    text(c_stroke, "not built", "caption", "muted")
    text(c, "Suggest by meaning (AI): off, not built", "title")
    para(c, "If this were turned on, only the paragraphs you select would leave your computer, one per request, shown "
            "in full here before it is sent. Nothing else goes.", "small")
    pay = col(c, "payload", gap=8, pad=[14, 16, 14, 16], radius=10, fill="bg", stroke="muted", sw=1, dashes=[6, 4], W="fill")
    text(pay, "WHAT WOULD BE SENT", "label", "muted")
    text(pay, "1 · A fixed instruction", "smallStrong")
    para(pay, "name the Bible references this passage quotes or paraphrases; answer with references only", "small", "muted")
    text(pay, "2 · The selected paragraph, as you wrote it (a drawn sample)", "smallStrong")
    para(pay, "so after the break I want to talk about how people keep going when things get hard and what we do on "
              "Tuesday nights", "small")
    text(pay, "3 · Your own key, for the service you chose", "smallStrong")
    note_ = col(c, "not sent", gap=4, W="fill")
    text(note_, "NOT SENT", "label", "muted")
    for s_ in ("The page title", "File names or folder paths", "Verse text from the database", "Any other page"):
        rr = row(note_, s_, gap=8)
        icon(rr, "close", 13, "muted")
        text(rr, s_, "small", "muted")
    para(c, "What comes back is references only, each checked against the database; one that is not a verse is dropped. "
            "It would be shown as a third kind of candidate, never accepted in bulk and never by default.", "small", "muted")
    wt = row(c, "waits", gap=8, pad=[10, 12, 10, 12], radius=8, fill="accentSoft", W="fill")
    icon(wt, "question", 16, "accent")
    text(wt, "Waits on the person: the AGENTS.md rule “no interpretation … nothing suggested”", "smallStrong", W="fill")
    bb = row(c, "buttons", gap=8, W="fill")
    P.button(bb, "Send", "secondary", size="sm", name="Send (off)")
    P.button(bb, "Cancel", "ghost", size="sm")


def handle(c, title, floated=False):
    bar = row(c, "handle", gap=6, W="fill")
    icon(bar, "drag", 16, "muted")
    text(bar, title, "smallStrong", W="fill")
    if not floated:
        P.icon_button(bar, "float", "muted", size=26, icon_size=14)
    P.icon_button(bar, "close", "muted", size=26, icon_size=14)


def sheet_card(f, pw, ph, top, title, name):
    c = col(f, name, gap=8, pad=[10, 14, 14, 14], fill="surface", radius=14, stroke="line", sw=1, W="fixed", H="fixed")
    Q.put(c, 0, ph - top, pw, top + 16)
    shadow(c, 8, 28, "#00000033")
    handle(c, title)
    return c


def conditions_a(cv):
    r = row(cv, "TG9-10", gap=64, align="min")
    f = Q.win(r, PG, "TG9 · Among other tabs",
              "Real conditions: the Tether pane is one of four tabs (Numbers 25, Word dump, Tether, Concordance) beside "
              "the reader. Opening and closing it leaves the other tabs, the tab in front and the page's scroll as they "
              "were; the page here is still at block 14.")
    w = K.app(f, on="Notebook")
    half = 640
    left = M.pane(f, w, TB, half, H - TB, ["Numbers 25", "Word dump"], "Word dump", side="left",
                  actions=("minimize", "expand", "close"))
    text(left, "Word dump", "title")
    gutter_line(left, 14, lambda c: flow(c, NAMED_SEGS + [(S_ROM, None)]))
    gutter_line(left, 15, lambda c: bars(c, [None, None, 340]))
    right = M.pane(f, w + half, TB, W - w - half, H - TB, ["Tether", "Concordance"], "Tether")
    pane_head(right, status=status_line(NEW0, IN_PAGE0, SKIPPED0))
    named_group(right, sel=REF_2TI,
                card=lambda b: cand_card(b, REF_2TI, V_2TI, {V_2TI[0]["v"]: {}}, f"You said: “{NAMED_PHRASE}”",
                                         ending(S_NAMED)))
    rest_groups(right)

    f = Q.win(r, PG, "TG10 · Floating, 340 px",
              "Float makes the pane a floating tab over the reader, 340 px wide: the evidence line, the verse and the "
              "two buttons are whole, wrapped to the width.")
    w = K.app(f)
    NUM25 = K.verses_of(K.fetch(HERE, "num25-11-13", ["text", "Num 25:11-13"], as_json=False))
    K.reader(f, w, W - w, NUM25, REF_NUM)
    c = K.floating(f, "floating tether", W - 400, TB + 60, 340, pad=(10, 12, 12, 12), gap=8)
    handle(c, "Tether", floated=True)
    para(c, f"{FOUND} found in your words · {MANY_N} phrases in many verses", "caption", "muted")
    cand_row(c, REF_2TI, "after block 14", "New", on=True)
    F.verses(c, V_2TI, "small", {V_2TI[0]["v"]: {}})
    para(c, f"You said: “{NAMED_PHRASE}”", "small")
    para(c, f"Put it: after the sentence ending ‘{ending(S_NAMED)}’", "caption", "muted")
    b = row(c, "buttons", gap=8, W="fill")
    P.button(b, "Accept", "primary", "check", size="sm")
    P.button(b, "Skip", "secondary", size="sm")


def conditions_b(cv):
    r = row(cv, "TG11", gap=64, align="min")
    pw, ph = 390, 800
    f = Q.win(r, PG, "TG11 · Narrow: a phone",
              "At 390 px the page shows the sentence with the words marked and the open candidate is a sheet reaching "
              "the bottom edge with the same evidence, verse, Accept and Skip, full width.", w=pw, h=ph)
    ed = frame(f, "page", x=0, y=0, w=pw, h=ph, fill="bg", layout="vertical", W="fixed", H="fixed", clip=True)
    crumbs(ed, "Word dump")
    pg = col(ed, "column", gap=10, pad=[8, 16, 16, 16], W="fill")
    text(pg, "Word dump", "display")
    gutter_line(pg, 13, lambda c: bars(c, [None, 260]))
    gutter_line(pg, 14, lambda c: flow(c, NAMED_SEGS + [(S_ROM, None)], "body"))
    top = 226
    c = sheet_card(f, pw, ph, top, REF_2TI, "candidate sheet")
    F.verses(c, V_2TI, "readSmall", {V_2TI[0]["v"]: {}})
    para(c, f"You said: “{NAMED_PHRASE}”", "small")
    para(c, f"Put it: after the sentence ending ‘{ending(S_NAMED)}’", "caption", "muted")
    b = row(c, "buttons", gap=8, W="fill")
    P.button(b, "Accept", "primary", "check", size="sm", W="fill")
    P.button(b, "Skip", "secondary", size="sm", W="fill")


def side_row(parent, label, on=False):
    it = row(parent, f"side/{label}", gap=6, pad=[4, 6, 4, 6], radius=6, W="fill", fill="accentSoft" if on else None)
    icon(it, "page", 15, "accent" if on else "muted")
    text(it, label, "smallStrong" if on else "small", W="fill", maxLines=1)


def conditions_c(cv):
    r = row(cv, "TG12-13", gap=64, align="min")
    rng = random.Random(1117)
    f = Q.win(r, PG, "TG12 · A 40 minute note",
              f"Years of study: one block of {WORDS_TOTAL:,} words, as a raw transcript. The strip beside the page shows "
              f"where along it the {NAMED} named (brown) and {QUOTED} quoted (blue) fall (ticks, a drawn sample "
              "placement); the pane lists the first, and the run reads in 1.2 s (a drawn sample). The page stays "
              "editable during a run (TG-11).")
    w = K.app(f, on="Notebook")
    pw = 520
    pgw = W - w - pw
    pg = page_area(f, w, pgw - 40, sub=f"{WORDS_TOTAL:,} words · one block", colw=pgw - 140)
    def long_block(c):
        flow(c, [(TOP_BLOCKS[1], None)])
        bars(c, [None] * 12 + [300])
    gutter_line(pg, 1, long_block)
    sh = H - TB - 60
    st = frame(f, "strip", x=w + pgw - 36, y=TB + 56, w=20, h=sh, radius=4, fill="sunken", stroke="line", sw=1,
               W="fixed", H="fixed", clip=True)
    for kind, n, tone in (("quoted", QUOTED, "threadB"), ("named", NAMED, "accent")):
        for k in range(n):
            y = int(rng.random() * (sh - 4))
            frame(st, f"{kind} tick", x=2 if kind == "quoted" else 10, y=y, w=8, h=2, fill=tone, W="fixed", H="fixed")
    frame(st, "here", x=0, y=int(sh * 0.30), w=20, h=int(sh * 0.12), fill="#00000010", stroke="muted", sw=1,
          W="fixed", H="fixed")
    body = tether_pane(f, W - pw, pw)
    pane_head(body, words=WORDS_TOTAL, status=status_line(NEW0, IN_PAGE0, SKIPPED0), extra="Read in 1.2 s")
    lg = row(body, "legend", gap=14, W="fill")
    for lab, tone in (("named", "accent"), ("quoted", "threadB")):
        rr = row(lg, lab, gap=6)
        frame(rr, "swatch", w=14, h=3, fill=tone, W="fixed", H="fixed")
        text(rr, lab, "caption", "muted")
    text(lg, "along the page, top to bottom", "caption", "muted")
    named_group(body)
    rest_groups(body)

    f = Q.win(r, PG, "TG13 · Years of study, run again",
              f"The same page after the {ADDED13} named references were added and {SKIPPED13} quotations skipped, in "
              f"a study of 420 pages. The head counts what is left ({NEW13} new = {FOUND} − {ADDED13} − {SKIPPED13}); "
              "Show skipped lists the skipped ones, which stay skipped when run again.")
    w = K.app(f, on="Notebook")
    sl = col(f, "side list", gap=2, pad=[10, 8, 10, 8], fill="sunken", W="fixed", H="fixed", stroke="line",
             strokeRightWeight=1, strokeLeftWeight=0, strokeTopWeight=0, strokeBottomWeight=0, clip=True)
    Q.put(sl, w, TB, 250, H - TB)
    text(sl, "PAGES · 420", "label", "muted")
    for lab in ("Word dump", "Tuesday study", "Haste study", "Zeal in Numbers 25", "Reading 2025"):
        side_row(sl, lab, on=lab == "Word dump")
    text(sl, "… 420 pages", "caption", "accent")
    pw = 520
    pgx = w + 250
    pg = page_area(f, pgx, W - pgx - pw)
    gutter_line(pg, 14, lambda c: flow(c, [(S_NAMED, None)]))

    def scrip(b):
        vb = col(b, "scripture block", gap=6, pad=[10, 14, 12, 14], radius=8, fill="surface", stroke="line", sw=1, W="fill")
        h_ = row(vb, "h", gap=8, W="fill")
        icon(h_, "book", 14, "accent")
        text(h_, REF_2TI, "smallStrong", "accent", W="fill")
        text(h_, "KJV", "caption", "muted")
    gutter_line(pg, 15, scrip)
    gutter_line(pg, 16, lambda b: flow(b, [(S_ROM, None)]))
    body = tether_pane(f, W - pw, pw)
    pane_head(body, words=WORDS_TOTAL, status=f"{NEW13} new · {ADDED13} in the page · {SKIPPED13} skipped")
    sk = row(body, "show skipped", gap=8, W="fill")
    link(sk, f"Show skipped ({SKIPPED13})")
    para(body, "A skipped one stays skipped when you run again; the app keeps that in its own state folder, never in "
               "the page.", "caption", "muted")
    group_head(body, "Named", NAMED, note=f"all {ADDED13} in the page")
    group_head(body, "Quoted", QUOTED, note=f"{NEW13} new · {SKIPPED13} skipped")
    group_head(body, "In many verses", MANY_N)


def part(cv, label, about):
    c = col(cv, f"part/{label}", gap=2, W="fixed")
    Q.put(c, 0, 0, Q.ROW_W)
    r_ = row(c, "t", gap=10)
    b = row(r_, "tag", pad=[3, 12, 3, 12], radius=999, fill="accent")
    text(b, label, "smallStrong", "onAccent")
    text(r_, about, "heading")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Tether: finding the scripture in a long note, round 1",
                  "The page's Find scripture… and the Tether pane (TG1 to TG13). The app finds only what the person's "
                  "own words already contain (a reference they said or wrote; words that are a verse's words, in order) "
                  "and shows the evidence in words and counts: no score, no strong or likely, no order by strength. "
                  "Every candidate waits for Accept. The AI tier is not built (TG8 only draws it). Page names and the "
                  "person's sentences are a drawn sample; scripture is from the database.")
    part(cv, "The entry", "TG1 · Find scripture… and the Tether pane")
    entry(cv)
    part(cv, "One candidate", "TG2 a reference named, TG3 a quotation")
    one_named(cv)
    part(cv, "What Accept does", "TG4 preview, TG5 after")
    accept(cv)
    part(cv, "What is not offered", "TG6 phrases found in many verses")
    not_offered(cv)
    part(cv, "The handoff to documents", "TG7 the verses in order")
    handoff(cv)
    part(cv, "The optional AI tier", "TG8 the disclosure only; not built; needs the person")
    needs_person(cv)
    part(cv, "The real conditions", "TG9 among other tabs, TG10 floating, TG11 narrow, TG12 a 40 minute note, TG13 years of study")
    conditions_a(cv)
    conditions_b(cv)
    conditions_c(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Tether", sheets)
