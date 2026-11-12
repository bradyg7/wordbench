"""Reading plans, round 1: the plan pane as built, drawn for the first time in design/features/, inside the evolving app
(the left rail and trail from minimize). It asks whether a plan's day should lead the reader from one reading to the
next (findings bad6, 540e, 2dcf), whether the day is a live checklist in the pane, how a plan is started without typing
long lists (7cef), and how what was read is seen as a whole, a part of a chapter included (bad6). Nothing is built from
this until the person accepts it. Scripture shown is fetched from the database with `wb text`; the book list with
`wb books`; nothing is typed. Places in plans are references only. Read counts on the map are a drawn sample.

    python design/features/reading-plans/reading-plans.py
"""
import json
import os
import re
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
BOARD = "Reading plans"
PG = "Reading plans"
PW = 440  # the plan pane

# Horner's ten lists, day 2: references only (the lists' first books, chapter 2)
DAY2 = ["Matthew 2", "Genesis 2", "Romans 2", "1 Thessalonians 2", "Job 2", "Psalms 2", "Proverbs 2", "Joshua 2",
        "Isaiah 2", "Acts 2"]
DONE = 1  # in the sheets, Matthew 2 is read and Genesis 2 is open


def wb(*args):
    exe = REPO / "target" / "release" / "wb.exe"
    if not exe.exists():
        exe = REPO / "target" / "debug" / "wb.exe"
    env = dict(os.environ)
    env.setdefault("WB_BIBLE_DB", str(REPO.parent / "bible-workbench" / "datasets" / "workbench.db"))
    out = subprocess.run([str(exe), *args], capture_output=True, text=True, encoding="utf-8", env=env, check=True)
    return out.stdout


def chapter(ref):
    """Verses as figlib.verses wants them, from `wb text` (the first line is the reference)."""
    vs = []
    for ln in wb("text", ref).splitlines()[1:]:
        m = re.match(r"(\d+) (.*)", ln)
        if m:
            vs.append({"v": int(m.group(1)), "text": m.group(2)})
    return vs


GEN2 = chapter("Gen 2:1-9")
BOOKS = json.loads(wb("books"))["books"]


def floating(f, name, x, y, w, pad=(12, 14, 12, 14), gap=8, r=12):
    p = col(f, name, gap=gap, pad=list(pad), fill="surface", radius=r, stroke="line", sw=1, W="fixed")
    Q.put(p, x, y, w)
    shadow(p, 8, 28, "#00000033")
    return p


def reader(f, x, w, title="Genesis 2", vs=GEN2, top=TB, marks=None, sel=None):
    rd = frame(f, "reader", x=x, y=top, w=w, h=H - top, layout="vertical", crossAlign="center", pad=[32, 32, 32, 32],
               W="fixed", H="fixed", clip=True)
    inner = col(rd, "reading column", gap=8, W="fixed")
    S.do("node.set", {"ids": [inner], "props": {"width": min(680, w - 64)}}, ref=False)
    text(inner, title, "chapter", fontSize=30, lineHeight="40px")
    F.verses(inner, vs, "readDesk", marks or {}, selected=sel)
    return rd, inner


def bar(parent, done, of, w=None, segmented=False, name="progress"):
    if not segmented:
        b = frame(parent, name, w=w or 100, h=6, fill="sunken", radius=3, layout="horizontal", W="fill" if not w else "fixed",
                  H="fixed", clip=True)
        frame(b, "fill", w=max(4, round((w or 380) * done / of)), h=6, fill="ok", W="fixed", H="fixed")
        return b
    b = row(parent, name, gap=3, W="fill")
    for i in range(of):
        frame(b, f"part {i + 1}", w=10, h=6, radius=3, fill="ok" if i < done else "sunken", W="fill", H="fixed")
    return b


def plan_pane(f, active="Reading plans"):
    return M.pane(f, W - PW, TB, PW, H - TB, ["Notebook", "Reading plans"], active)


# ---- R1 today ---------------------------------------------------------------------------------------------------------

def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "R1 · Today: the plan in its pane",
              "As built (ui/src/plans.ts): a card per plan with a bar, where you are, today's reading as one long "
              "label, Read and Mark read for the whole day, then Days, Rename, Start day, Edit as text and Stop. A day "
              "is read all at once; the reader does not know a plan is open. Findings 540e, bad6, 7cef.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader(f, w, W - w - PW)
    b = plan_pane(f)
    card = col(b, "plan card", gap=10, pad=14, radius=12, stroke="line", sw=1, W="fill")
    text(card, "Horner's Reading System", "title")
    bar(card, 1, 250)
    text(card, "Day 2 · 1 read · no end date · from Grant Horner's Reading Bible Reading System", "small", "muted",
         W="fill")
    t = col(card, "today", gap=6, pad=12, radius=10, fill="sunken", W="fill")
    text(t, "TODAY", "caption", "muted")
    text(t, "; ".join(DAY2), "bodyStrong", W="fill")
    a = row(t, "acts", gap=8)
    P.button(a, "Read", "primary", "book", size="sm")
    P.button(a, "Mark read", "secondary", "check", size="sm")
    a2 = row(card, "plan acts", gap=6, W="fill", wrap=True)
    for lbl in ("Days", "Rename…", "Start day…", "Edit as text…"):
        P.button(a2, lbl, "secondary", size="sm")
    text(a2, "Stop", "smallStrong", "warn")
    pa = col(b, "past", gap=6, W="fill")
    text(pa, "Past plans", "smallStrong", "muted")
    text(pa, "What you have read", "smallStrong", "muted")


# ---- A: the plan leads the reader -------------------------------------------------------------------------------------

def strip(f, x, w, current=DONE):
    s = row(f, "today's reading", gap=6, pad=[8, 16, 8, 16], fill="surface", W="fixed", stroke="line",
            strokeBottomWeight=1, strokeTopWeight=0, strokeLeftWeight=0, strokeRightWeight=0)
    Q.put(s, x, TB, w)
    text(s, "Horner · Day 2", "smallStrong", "muted")
    for i, ref in enumerate(DAY2):
        if i < DONE:
            P.chip(s, ref.replace("1 Thessalonians", "1 Thess"), "quiet", icon_name="check")
        elif i == current:
            P.chip(s, ref, "selected")
        else:
            P.chip(s, ref.replace("1 Thessalonians", "1 Thess"), "outline")
        if i == 5:
            text(s, "+4", "caption", "muted")
            break
    frame(s, "space", w=8, h=8, W="fill", H="fixed")
    text(s, f"{DONE} of 10", "caption", "muted")
    return s


def direction_a(cv):
    r = row(cv, "a", gap=64, align="min")
    f = Q.win(r, PG, "R2 · A: the plan leads the reader",
              "Read opens the day in the reader. A strip under the bar holds the day's readings; each one ticks as it "
              "is read (540e), the one open is marked, and a click goes to any of them. The pane can stay closed: "
              "the strip is the plan while you read (bad6, a plan reader).")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    strip(f, w, W - w)
    reader(f, w, W - w, title="Romans 2" if False else "Genesis 2", top=TB + 46)

    f = Q.win(r, PG, "R3 · A: the end of a reading",
              "At the end of the chapter: Mark read and go on, one step, to the next reading of the day. After Listen "
              "reads a chapter through, the same question comes by itself (2dcf). Nothing is marked without a click.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    strip(f, w, W - w, current=1)
    rd, inner = reader(f, w, W - w, top=TB + 46, vs=GEN2[-3:])
    end = col(inner, "end of reading", gap=10, pad=[16, 18, 16, 18], radius=12, stroke="line", sw=1, W="fill")
    text(end, "End of Genesis 2", "caption", "muted")
    a = row(end, "acts", gap=10, W="fill")
    P.button(a, "Mark read · next: Romans 2", "primary", "check", size="md")
    P.button(a, "Mark read", "secondary", size="md")
    frame(a, "space", w=8, h=8, W="fill", H="fixed")
    text(a, "Not now", "smallStrong", "muted")
    q = floating(f, "after Listen", W - 380, H - 150, 340)
    hd = row(q, "head", gap=8, W="fill")
    icon(hd, "listen", 16, "accent")
    text(hd, "Listen read Genesis 2 through", "smallStrong", W="fill")
    a = row(q, "acts", gap=8)
    P.button(a, "Mark it read", "primary", size="sm")
    P.button(a, "Not now", "ghost", size="sm")


# ---- B: today as a checklist in the pane ------------------------------------------------------------------------------

def direction_b(cv):
    r = row(cv, "b", gap=64, align="min")
    f = Q.win(r, PG, "R4 · B: today as a checklist",
              "The pane shows the day as rows, one for each reading, with a bar in ten parts that fills as each is "
              "read in the reader, not only by one Mark read for the day (540e). A reading read in part says where "
              "it stopped (bad6). Days, Rename and the rest go under ⋯.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader(f, w, W - w - PW, sel=None)
    b = plan_pane(f)
    hd = row(b, "head", gap=8, W="fill")
    text(hd, "Horner's Reading System", "title", W="fill")
    P.icon_button(hd, "more", "muted", size=32, icon_size=18)
    text(b, "Day 2 · 1 of 10 read", "small", "muted")
    bar(b, DONE, 10, segmented=True)
    lst = col(b, "readings", gap=2, W="fill")
    for i, ref in enumerate(DAY2):
        on = i == DONE
        it = row(lst, f"reading/{ref}", gap=10, pad=[8, 10, 8, 10], radius=8, W="fill", fill="accentSoft" if on else None)
        box = frame(it, "box", w=18, h=18, radius=5, fill="ok" if i < DONE else None, stroke=None if i < DONE else "line",
                    sw=None if i < DONE else 1.5, layout="horizontal", mainAlign="center", crossAlign="center",
                    W="fixed", H="fixed")
        if i < DONE:
            icon(box, "check", 12, "onAccent")
        text(it, ref, "body", "muted" if i < DONE else "fg", W="fill")
        if on:
            text(it, "read to v. 9", "caption", "accent")
            text(it, "open", "caption", "muted")
    a = row(b, "acts", gap=8)
    P.button(a, "Go on: Genesis 2", "primary", "book", size="sm")
    P.button(a, "Mark the day read", "secondary", size="sm")

    f = Q.win(r, PG, "R5 · B: starting a plan",
              "Start from a kind, not a long list typed in (7cef: ten Horner lists typed by hand got slow). Each card "
              "says what it reads and for how long; Horner's ten lists is a preset of book ranges. A published plan "
              "can still be pasted. The days by hand stay one step further in.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader(f, w, W - w - PW)
    b = plan_pane(f)
    text(b, "Start a plan", "title")
    for name, what, on in (
            ("The Bible in its order", "Genesis to Revelation · 365 days, balanced by words", False),
            ("Some books", "Choose books (the Gospels, Romans…) · you set the days", False),
            ("Ten lists at once (Horner)", "Gospels; Genesis–Deuteronomy; Romans–Hebrews; 1 Thess–Revelation; "
             "Job, Ecclesiastes, Song; Psalms; Proverbs; Joshua–2 Chronicles; Isaiah–Malachi; Acts · a chapter of each "
             "a day, no end date", True),
            ("A published plan", "Paste it, one day to a line", False)):
        c = col(b, f"kind/{name}", gap=4, pad=[12, 14, 12, 14], radius=10, W="fill",
                stroke="accent" if on else "line", sw=1.5 if on else 1, fill="accentSoft" if on else None)
        text(c, name, "bodyStrong")
        text(c, what, "small", "muted", W="fill")
    a = row(b, "acts", gap=8)
    P.button(a, "Start · today", "primary", size="sm")
    P.button(a, "Arrange the days…", "secondary", size="sm")


# ---- C: what you have read --------------------------------------------------------------------------------------------

def sample_times(book, ch):
    """A drawn sample, not anyone's log: some books read through, some in part."""
    if book["code"] in ("GEN", "MAT", "MRK", "JHN", "ROM", "PSA", "PRO", "NUM"):
        return 2 if (ch % 5 == 0 or book["code"] in ("JHN", "ROM")) else 1
    if book["code"] in ("EXO", "ISA", "ACT", "JOB", "JOS"):
        return 1 if ch <= max(1, book["chapters"] // 3) else 0
    return 0


def bible_map(parent, w, layer="Read"):
    shades = {0: "sunken", 1: "hlGreen", 2: "ok"}
    for testament in ("OT", "NT"):
        g = col(parent, f"map/{testament}", gap=1, W="fill")
        text(g, "Old Testament" if testament == "OT" else "New Testament", "caption", "muted")
        for bk in [b for b in BOOKS if b["testament"] == testament]:
            it = row(g, f"book/{bk['code']}", gap=6, W="fill", align="center")
            text(it, bk["name"], "caption", "fg", width=96, maxLines=1, fontSize=9, lineHeight="10px")
            cells = row(it, "chapters", gap=1, W="fill", wrap=True)
            for c in range(1, bk["chapters"] + 1):
                t = sample_times(bk, c)
                if layer == "Written about":
                    t = 2 if (bk["code"], c) in (("NUM", 25), ("PSA", 106), ("ROM", 10), ("MAL", 2)) else 0
                frame(cells, f"{bk['code']}.{c}", w=5, h=7, radius=1, fill=shades[t], W="fixed", H="fixed")


def direction_c(cv):
    r = row(cv, "c", gap=64, align="min")
    f = Q.win(r, PG, "R6 · C: what you have read, as a whole",
              "Every chapter of the Bible as a small mark, book by book, shaded by how often it was read (from the "
              "reading log); a switch shows instead where you have written pages (bad6). A click on a mark opens the "
              "chapter. The counts here are a drawn sample.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    pw = 760
    reader(f, w, W - w - pw)
    d = M.pane(f, W - pw, TB, pw, H - TB, ["Reading plans", "What you have read"], "What you have read")
    hd = row(d, "head", gap=10, W="fill")
    text(hd, "What you have read", "title", W="fill")
    P.segmented(hd, ["Read", "Written about"], "Read", W="hug")
    text(d, "412 of 1,189 chapters read at least once · sample", "small", "muted")
    m = row(d, "map", gap=20, W="fill", align="min")
    bible_map(m, pw)
    lg = row(d, "legend", gap=12)
    for fill, lbl in (("sunken", "not read"), ("hlGreen", "once"), ("ok", "twice or more")):
        it = row(lg, lbl, gap=4)
        frame(it, "cell", w=8, h=10, radius=2, fill=fill, W="fixed", H="fixed")
        text(it, lbl, "caption", "muted")

    f = Q.win(r, PG, "R7 · C: a part of a chapter read",
              "Mark read up to a verse: the right click on a verse number (the Reader's direction A) has Mark read "
              "to here. The verses read get a thin line in the margin; the chapter counts as read in part, and the "
              "plan's reading says where it stopped (R4).")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    rd, inner = reader(f, w, W - w, sel=(5, 0, 999))
    line = frame(f, "read line", w=3, h=330, radius=2, fill="ok", W="fixed", H="fixed")
    Q.put(line, w + (W - w - 680) // 2 - 14, TB + 92, 3, 330)
    m = floating(f, "right click", w + (W - w) // 2 + 120, TB + 300, 280, pad=(6, 6, 6, 6), gap=2)
    for lbl, ic, key, on in (("Mark read to here", "check", None, True), ("Mark the chapter read", "check", None, False),
                             ("Interlinear", "interlinear", "I", False), ("Copy with reference", "copy", "C", False)):
        it = row(m, f"menu/{lbl}", gap=10, pad=[6, 8, 6, 8], radius=6, W="fill", fill="accentSoft" if on else None)
        icon(it, ic, 16, "fg")
        text(it, lbl, "small", W="fill")
        if key:
            P.kbd(it, key)


def sheets(board):
    cv = Q.section(board, PG, 3200)
    Q.sheet_title(cv, "Reading plans, round 1",
                  "Reading plans were built before design/features/ existed. This round draws the pane as it is (R1), "
                  "then three directions: A, the plan leads the reader, a strip of the day's readings that tick as "
                  "you read and a step to the next (R2, R3); B, the day as a live checklist in the pane, and plans "
                  "started from a kind, Horner's ten lists among them (R4, R5); C, what you have read seen as a whole, "
                  "and a part of a chapter marked read (R6, R7). The reading files do not change shape.")
    today(cv)
    direction_a(cv)
    direction_b(cv)
    direction_c(cv)


# ---- round 2: A and B together, C in them ----------------------------------------------------------------------------

def checklist(b, done=DONE, open_=DONE, part=None):
    hd = row(b, "head", gap=8, W="fill")
    text(hd, "Horner's Reading System", "title", W="fill")
    P.icon_button(hd, "more", "muted", size=32, icon_size=18)
    text(b, f"Day 2 · {done} of 10 read", "small", "muted")
    bar(b, done, 10, segmented=True)
    lst = col(b, "readings", gap=2, W="fill")
    for i, ref in enumerate(DAY2):
        on = i == open_
        it = row(lst, f"reading/{ref}", gap=10, pad=[7, 10, 7, 10], radius=8, W="fill", fill="accentSoft" if on else None)
        box = frame(it, "box", w=18, h=18, radius=5, fill="ok" if i < done else None, stroke=None if i < done else "line",
                    sw=None if i < done else 1.5, layout="horizontal", mainAlign="center", crossAlign="center",
                    W="fixed", H="fixed")
        if i < done:
            icon(box, "check", 12, "onAccent")
        text(it, ref, "body", "muted" if i < done else "fg", W="fill")
        if on and part:
            text(it, part, "caption", "accent")
    return lst


def together(cv):
    r = row(cv, "together", gap=64, align="min")
    f = Q.win(r, PG, "R8 · A and B together, C in them",
              "Reading: the strip leads you through the day (A); the pane, when open, is the same day as a checklist "
              "(B); both tick together. Under the checklist, the chapter you are in shows what the map knows (C): how "
              "often read, and what refers to it, each a link.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    strip(f, w, W - w - PW)
    reader(f, w, W - w - PW, top=TB + 46)
    b = plan_pane(f)
    checklist(b)
    P.divider(b)
    c = col(b, "this chapter", gap=6, W="fill")
    text(c, "GENESIS 2", "caption", "muted")
    text(c, "Read twice · last 3 October (sample)", "small", W="fill")
    for ic, lbl in (("notebook", "Creation week (page)"), ("question", "A question on 2:7"), ("highlight", "2 highlights")):
        it = row(c, lbl, gap=8)
        icon(it, ic, 15, "accent")
        text(it, lbl, "small", "accent")

    f = Q.win(r, PG, "R9 · Part read, way 1: the verses go in the log",
              "Mark read to here writes a log line with the verses: {\"ch\": \"GEN.2\", \"v\": \"1-9\"}. The map shows "
              "the chapter half filled; the plan's row says read to v. 9; every device sees it. The Python app passes "
              "over the new field.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    strip(f, w, W - w - PW)
    reader(f, w, W - w - PW, top=TB + 46)
    line = frame(f, "read line", w=3, h=600, radius=2, fill="ok", W="fixed", H="fixed")
    Q.put(line, w + 18, TB + 140, 3, 600)
    b = plan_pane(f)
    checklist(b, part="read to v. 9")
    P.divider(b)
    mrow = row(b, "on the map", gap=8, W="fill")
    text(mrow, "Genesis", "caption", width=60)
    cells = row(mrow, "chapters", gap=1, W="fill", wrap=True)
    for c_ in range(1, 51):
        cl = frame(cells, f"GEN.{c_}", w=6, h=10, radius=1, fill="ok" if c_ == 1 else "sunken", W="fixed", H="fixed",
                   layout="vertical", clip=True)
        if c_ == 2:
            frame(cl, "half", w=6, h=5, fill="ok", W="fixed", H="fixed")
    text(b, "Genesis 2: verses 1-9 read", "caption", "muted")

    f = Q.win(r, PG, "R10 · Part read, way 2: only the plan knows",
              "The log stays whole chapters. Where you stopped is kept in the plan's file for that reading; the map "
              "counts the chapter only once it is read to the end. Simpler, but a part read outside a plan is lost.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    strip(f, w, W - w - PW)
    reader(f, w, W - w - PW, top=TB + 46)
    mk = row(f, "stopped here", gap=6, pad=[3, 8, 3, 8], radius=999, fill="accentSoft")
    Q.put(mk, w + 40, TB + 740, 150)
    icon(mk, "bookmark", 13, "accent")
    text(mk, "stopped at v. 9", "caption", "accent")
    b = plan_pane(f)
    checklist(b, part="stopped at v. 9")
    P.divider(b)
    text(b, "Genesis 2 is not yet counted read on the map.", "caption", "muted", W="fill")


def missed_days(cv):
    r = row(cv, "missed", gap=64, align="min")
    f = Q.win(r, PG, "R11 · Missed days, in the checklist",
              "Days not read are one line at the top of the checklist, never a red list. Opened, the choices each say "
              "what they do to the dates, as now. A plan with no end (Horner) has no 'fit into the days left'; a "
              "new choice reads the missed days alongside, one extra a day, until caught up.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    strip(f, w, W - w - PW, current=0)
    reader(f, w, W - w - PW, top=TB + 46)
    b = plan_pane(f)
    text(b, "Horner's Reading System", "title")
    m = row(b, "missed", gap=8, pad=[8, 10, 8, 10], radius=8, fill="sunken", W="fill")
    text(m, "2 days were not read. What should happen?", "smallStrong", W="fill")
    for name, what, on, off in (
            ("Pick up where I left off", "Today reads day 2; every day after moves 2 days later.", True, False),
            ("Read them alongside", "Days 2 and 3 are added to the next days, one extra a day, until caught up.",
             False, False),
            ("Fit them into the days left", "Only for a plan with an end date.", False, True),
            ("Leave them for later", "Read after the last day; for a plan with an end date.", False, True),
            ("Skip them", "Days 2 and 3 are marked skipped; the lists move on.", False, False)):
        c = row(b, f"choice/{name}", gap=10, pad=[10, 12, 10, 12], radius=10, W="fill", align="min",
                stroke="accent" if on else "line", sw=1.5 if on else 1, fill="accentSoft" if on else None)
        frame(c, "radio", w=14, h=14, radius=7, fill="accent" if on else None, stroke=None if on else "line", sw=1.5,
              W="fixed", H="fixed")
        t = col(c, "t", gap=2, W="fill")
        text(t, name, "bodyStrong", "muted" if off else "fg")
        text(t, what, "small", "muted", W="fill")
    a = row(b, "acts", gap=8)
    P.button(a, "Do it", "primary", size="sm")
    P.button(a, "Not now", "ghost", size="sm")


def builder(cv):
    r = row(cv, "builder", gap=64, align="min")
    f = Q.win(r, PG, "R12 · The builder, by kind",
              "The builder opens wide, in the reader's place. A plan in lists (Horner) shows the lists side by side, "
              "each a column of chapters, where today falls in each; a list can be dragged to reorder or given a "
              "book. A plan in days shows Days: today's builder, a day a row. The text form stays under ⋯.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    body = col(f, "builder", gap=14, pad=[20, 28, 20, 28], W="fixed", H="fixed")
    Q.put(body, w, TB, W - w, H - TB)
    hd = row(body, "head", gap=10, W="fill")
    text(hd, "Horner's Reading System · the ten lists", "title", W="fill")
    P.segmented(hd, ["Lists", "Days"], "Lists", W="hug")
    P.button(hd, "Done", "primary", size="sm")
    cols = row(body, "lists", gap=8, W="fill", align="min")
    lists = [("Gospels", "Matthew"), ("Law", "Genesis"), ("Epistles", "Romans"), ("Epistles", "1 Thess"),
             ("Wisdom", "Job"), ("Psalms", "Psalms"), ("Proverbs", "Proverbs"), ("History", "Joshua"),
             ("Prophets", "Isaiah"), ("Acts", "Acts")]
    for i, (nm, book) in enumerate(lists):
        c = col(cols, f"list/{i + 1}", gap=4, pad=8, radius=10, stroke="line", sw=1, W="fill")
        hr = row(c, "h", gap=4, W="fill")
        icon(hr, "drag", 12, "muted")
        text(hr, f"{i + 1} · {nm}", "smallStrong", W="fill")
        for ch in range(1, 12):
            it = row(c, f"{book} {ch}", gap=4, pad=[3, 6, 3, 6], radius=6, W="fill",
                     fill="ok" if ch == 1 else ("accentSoft" if ch == 2 else None))
            text(it, f"{book} {ch}", "caption", "onAccent" if ch == 1 else "fg")
        text(c, "…", "caption", "muted")
        text(c, "+ a book", "caption", "accent")


def library(cv):
    r = row(cv, "library", gap=64, align="min")
    f = Q.win(r, PG, "R13 · In the Library: Reading",
              "The Library gets a Reading place: the plan going now, Past plans as rows with how far each got and Use "
              "again, and the map. Written about counts every reference to a verse or chapter: pages, places in "
              "pages, questions, highlights, threads. A click on a chapter lists them. Counts are a sample.")
    w = M.rail5(f, on="Notebook")
    M.slim_bar(f, x=w, w=W - w)
    pw = 820
    reader(f, w, W - w - pw)
    d = M.pane(f, W - pw, TB, pw, H - TB, ["Library", "Reading"], "Reading")
    hd = row(d, "head", gap=10, W="fill")
    text(hd, "Reading", "title", W="fill")
    P.segmented(hd, ["Read", "Written about"], "Written about", W="hug")
    pl = col(d, "plans", gap=4, W="fill")
    for nm, what, going, dn, of in (("Horner's Reading System", "Day 2 · 1 of 10 today", True, 1, 250),
                                    ("The Gospels in 30 days", "Stopped at day 18 of 30", False, 18, 30),
                                    ("The Bible in its order", "Finished · 365 days", False, 365, 365)):
        it = row(pl, nm, gap=10, pad=[6, 8, 6, 8], radius=8, W="fill", fill="accentSoft" if going else None)
        text(it, nm, "bodyStrong" if going else "body", width=220)
        bar(it, dn, of, w=120)
        text(it, what, "small", "muted", W="fill")
        if not going:
            text(it, "Use again", "smallStrong", "accent")
    m = row(d, "map", gap=20, W="fill", align="min")
    bible_map(m, pw, layer="Written about")
    tip = floating(f, "Numbers 25", W - pw + 140, TB + 330, 300)
    text(tip, "Numbers 25 · 6 references", "smallStrong")
    for ic, lbl in (("notebook", "Zeal (page)"), ("notebook", "Covenant of peace (page)"),
                    ("question", "A question on 25:11"), ("threads", "Phinehas (thread)"), ("highlight", "2 highlights")):
        it = row(tip, lbl, gap=8)
        icon(it, ic, 14, "accent")
        text(it, lbl, "small", "accent")


def start2(cv):
    r = row(cv, "start2", gap=64, align="min")
    f = Q.win(r, PG, "R14 · Starting a plan, with what ships",
              "The kinds that ship: the Bible in its order, some books, Horner's ten lists, and a chronological plan "
              "(which one is still to be chosen). A published plan can still be pasted. Choosing a kind shows its "
              "first days before Start.")
    w = M.rail5(f)
    M.slim_bar(f, x=w, w=W - w)
    reader(f, w, W - w - PW)
    b = plan_pane(f)
    text(b, "Start a plan", "title")
    for name, what, on in (
            ("The Bible in its order", "365 days, balanced by words", False),
            ("Some books", "Choose books · you set the days", False),
            ("Horner's ten lists", "A chapter of each list a day, no end date", False),
            ("Chronological", "The events in the order they happened · 365 days · source still to be chosen", True),
            ("A published plan", "Paste it, one day to a line", False)):
        c = col(b, f"kind/{name}", gap=4, pad=[10, 14, 10, 14], radius=10, W="fill",
                stroke="accent" if on else "line", sw=1.5 if on else 1, fill="accentSoft" if on else None)
        text(c, name, "bodyStrong")
        text(c, what, "small", "muted", W="fill")
    text(b, "FIRST DAYS", "caption", "muted")
    text(b, "Shown here from the chosen source, once one is chosen.", "small", "muted", W="fill")
    a = row(b, "acts", gap=8)
    P.button(a, "Start · today", "primary", size="sm")
    P.button(a, "Arrange…", "secondary", size="sm")


def sheets2(board):
    cv = Q.section(board, "Round 2", 3200)
    Q.sheet_title(cv, "Reading plans, round 2",
                  "The person chose A and B together with C in them (2026-11-11). This round: the three together "
                  "(R8); a part of a chapter read, kept in the log (R9) or only in the plan (R10); missed days in the "
                  "checklist (R11); the builder by kind (R12); Reading in the Library, Past plans and the map of what "
                  "you wrote about (R13); and starting a plan with Horner's lists and a chronological plan (R14).")
    together(cv)
    missed_days(cv)
    builder(cv)
    library(cv)
    start2(cv)


def main():
    F.ICONS.setdefault("bookmark", "M7 4h10v16l-5-4-5 4z")
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    sheets2(board)
    build = LIB / "build"
    build.mkdir(exist_ok=True)
    script = build / "reading-plans.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "reading-plans.figcraft"
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
    # no all.png: the board is read window by window (the person, 2026-11-12)
    tmp = build / "reading-plans-tree.json"
    subprocess.run([cli, "convert", str(target), str(tmp)], check=True, capture_output=True)
    names = sorted(set(re.findall(r'"name":\s*"(Window [^"]*)"', tmp.read_text(encoding="utf-8"))))
    for name in names:
        tag = re.match(r"Window\W+(R\d+)", name).group(1).lower()
        subprocess.run([cli, "export", "--no-system-fonts", str(target), "--page", BOARD, "--node", name,
                        "--scale", "1", "--out", str(dest / f"{tag}.png")], check=True, capture_output=True)
    print("exported", sorted(p.name for p in dest.glob("*.png")))


if __name__ == "__main__":
    main()
