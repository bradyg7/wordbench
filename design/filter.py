"""S8 of the debug round (docs/debug-spec.md, 2026-11-08): the sheet for "a clean filter for the Notebook" (finding 4463),
drawn with FigCraft as the workspace round was (it reuses workspace.py's and phase2b.py's helpers, so the sheets look
alike). Nothing is built from this sheet until the person accepts it.

    python design/filter.py     # writes design/filter.figcraft and design/exports/filter/*.png

The idea the sheet shows: the Notebook already has an engine for filtering, the view language (`notebook @Num 25
questions open thread Phinehas days 30 words`, run by `wb view run` and drawn by a view block). What it lacks is a
filter the person can SEE. So: one row above the list whose chips write and show one view line. A filter is therefore also
a saved view: the line can be copied into a view block. The row's result is `wb view run "<its line>"`, so the window and
the terminal cannot disagree. The writing on the sheet is demo writing about the Phinehas demo, never scripture and never
commentary; the verses in the reader beside it come from content.json (fetched from the database with wb text).
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
import workspace as WS  # noqa: E402  (its helpers: notebook, sidebar, page_head, view_block)
from figlib import S, col, frame, icon, para, rect, row, shadow, spacer, text  # noqa: E402

W, H, TB = Q.W, Q.H, Q.TB
BOARD = "Filter"
PG = "A clean filter for the Notebook"
NB_W = 460                          # the Notebook docked beside the reader: a narrow column, as it is by default
READ_W = W - NB_W


# ---- the pieces of the filter row --------------------------------------------------------------------------------------
def head(col_):
    """The list's head as built: the search, the pen, the Trash, the settings."""
    r = row(col_, "head", gap=6, W="fill")
    P.field(r, "Search your notes", None, icon_name="search", height=36)
    for ic in ("pen", "close", "more"):
        P.icon_button(r, ic, "muted", size=32, icon_size=17)
    return r


def sections(col_, on):
    r = row(col_, "sections", gap=4, W="fill")
    for s in ("Days", "Pages", "Places", "Threads", "Questions", "All"):
        b = row(r, f"section/{s}", pad=[5, 10, 5, 10], radius=15, fill="accentSoft" if s == on else None)
        text(b, s, "smallStrong", "accent" if s == on else "muted")
    return r


def chip_off(parent, label):
    """A filter not set: its name and a down arrow."""
    ch = row(parent, f"filter/{label}", gap=5, pad=[5, 8, 5, 11], fill="sunken", radius=999)
    text(ch, label, "smallStrong", "muted")
    icon(ch, "down", 13, "muted")
    return ch


def chip_on(parent, label, value):
    """A filter set: its name and value, and × to take it off."""
    ch = row(parent, f"filter/{label}: {value}", gap=5, pad=[5, 6, 5, 11], fill="accentSoft", radius=999)
    text(ch, f"{label}: ", "smallStrong", "accent")
    text(ch, value, "smallStrong", "accent")
    icon(ch, "close", 13, "accent")
    return ch


def filter_toggle(parent, count=0, open_=False):
    """The Filter button at the head of the row: a funnel; a number when filters are on."""
    b = row(parent, "Filter", gap=6, pad=[5, 10, 5, 10], radius=8, fill="accentSoft" if count else "sunken")
    icon(b, "filter", 15, "accent" if count else "muted")
    text(b, "Filter", "smallStrong", "accent" if count else "muted")
    if count:
        n = row(b, "count", pad=[0, 6, 0, 6], fill="accent", radius=999)
        text(n, str(count), "caption", "onAccent", fontSize=11, lineHeight="16px")
    icon(b, "up" if open_ and "up" in F.ICONS else "down", 13, "accent" if count else "muted")
    return b


def line_box(parent, line, copy=True):
    """The view line the chips write: shown as typed, and copied as one."""
    box = row(parent, "view line", gap=8, pad=[7, 10, 7, 10], fill="bg", radius=8, stroke="line", sw=1, W="fill")
    icon(box, "list", 15, "muted")
    text(box, line, "small", W="fill", fontFamily="Inter", maxLines=2)
    if copy:
        icon(box, "copy", 15, "muted")
    return box


def result_row(parent, title, where, question=False, state=None):
    it = col(parent, f"item/{title}", gap=3, pad=[9, 12, 9, 12], radius=10, W="fill")
    text(it, title, "bodyStrong")
    cr = row(it, "chips", gap=6)
    if question:
        P.chip(cr, "Answered" if state == "answered" else "Question", "question", icon_name="question")
    if where:
        P.chip(cr, where, "place", icon_name="place")
    return it


def narrow(f, active_section="Pages"):
    """The Notebook docked at the right in its narrow form → its list column (the filter row goes in it)."""
    nb = frame(f, "notebook", x=READ_W, y=TB, w=NB_W, h=H - TB, fill="sunken", layout="vertical", W="fixed", H="fixed",
               clip=True, stroke="line", strokeLeftWeight=1, strokeRightWeight=0, strokeTopWeight=0, strokeBottomWeight=0)
    P.pane_header(nb, ["Notebook"], "Notebook")
    lst = col(nb, "list", gap=8, pad=[12, 12, 12, 12], W="fill", H="fill", clip=True)
    head(lst)
    sections(lst, active_section)
    return lst


def window(parent, title, about):
    f = Q.win(parent, PG, title, about)
    Q.toolbar(f, active="Notebook", inbox=None)
    Q.reader(f, 0, READ_W, first=9, last=13)
    return f


# ---- the sheet ---------------------------------------------------------------------------------------------------------
def sheets(board):
    cv = Q.section(board, PG, 0)
    Q.sheet_title(cv, "A clean filter for the Notebook", "S8 of the debug round (finding 4463): \"a clear and "
                  "user-friendly and clean filtering feature for the notebook.\" Not a new engine: the view language "
                  "already is one (the command field, a view block, wb view run). This draws a row above the list whose "
                  "chips write and show one view line, so a filter is also a saved view. Four windows: the row closed, "
                  "open, with three filters on, and in the wide Notebook.")

    r = row(cv, "row 1", gap=64, align="min")

    # F1 closed ---------------------------------------------------------------------------------------------------------
    f = window(r, "F1 · The row, closed", "Under the sections, one quiet line: a Filter button, and how many notes the "
               "list holds. Nothing is hidden or changed until a filter is set. A search still works beside it; the "
               "search words are part of the same line.")
    lst = narrow(f)
    bar = row(lst, "filter row", gap=8, W="fill")
    filter_toggle(bar)
    spacer(bar)
    text(bar, "31 notes", "caption", "muted")
    result_row(lst, "Zeal and the covenant of peace", "Numbers 25:11")
    result_row(lst, "Who was the daughter of Zur?", "Numbers 25:15", question=True)
    result_row(lst, "Outline of the week", None)
    result_row(lst, "H7065 in the KJV", "Numbers 25:11")
    result_row(lst, "What Psalm 106 adds", "Psalms 106:30")

    # F2 open -----------------------------------------------------------------------------------------------------------
    f = window(r, "F2 · The row, open", "Filter opens the chips: Kind, Place, Thread, Questions, When. Each opens a short "
               "menu (When is shown). Nothing is applied until a choice is made; Esc closes the menu, the row stays. Clear "
               "takes every filter off at once.")
    lst = narrow(f)
    bar = row(lst, "filter row", gap=8, W="fill")
    filter_toggle(bar, open_=True)
    spacer(bar)
    text(bar, "31 notes", "caption", "muted")
    chips = row(lst, "chips", gap=6, W="fill")
    for c in ("Kind", "Place", "Thread", "Questions", "When"):
        chip_off(chips, c)
    result_row(lst, "Zeal and the covenant of peace", "Numbers 25:11")
    result_row(lst, "Who was the daughter of Zur?", "Numbers 25:15", question=True)
    result_row(lst, "Outline of the week", None)
    m = Q.popover(f, W - 212, TB + 40 + 36 + 38 + 40 + 40, 200, name="When menu")
    text(m, "When", "caption", "muted")
    for label, on in (("Any time", False), ("Today", False), ("The last 7 days", True), ("The last 30 days", False)):
        Q.menu_item(m, label, None, on=on)

    # F3 three filters on -------------------------------------------------------------------------------------------------
    r = row(cv, "row 2", gap=64, align="min")
    f = window(r, "F3 · Three filters on", "Place: Numbers 25 (the chapter in the reader, or typed), Thread: Phinehas, "
               "Questions: open. The Filter button carries a 3. The line under the chips is what they write; it is "
               "the same line a view block holds (Copy), and the list is exactly what wb view run gives for it. A "
               "filter looks across every note, so the section chips stay as they are and the list is the filter's.")
    lst = narrow(f, "All")
    bar = row(lst, "filter row", gap=8, W="fill")
    filter_toggle(bar, count=3, open_=True)
    spacer(bar)
    text(bar, "Clear", "smallStrong", "accent")
    chips = row(lst, "chips", gap=6, W="fill")
    chip_on(chips, "Place", "Numbers 25")
    chip_on(chips, "Thread", "Phinehas")
    chips2 = row(lst, "chips 2", gap=6, W="fill")
    chip_on(chips2, "Questions", "open")
    chip_off(chips2, "When")
    line_box(lst, "notebook @Num 25 thread Phinehas questions open")
    text(lst, "2 found", "caption", "muted")
    result_row(lst, "Who was the daughter of Zur?", "Numbers 25:15", question=True)
    result_row(lst, "Why is the plague stopped there?", "Numbers 25:8", question=True)
    nowhere = row(lst, "save", gap=8, pad=[4, 0, 0, 0], W="fill")
    P.button(nowhere, "Copy as a view block", "soft", "copy", size="sm")
    text(nowhere, "Paste it into a page: it stays up to date.", "caption", "muted")

    # F4 the wide Notebook -------------------------------------------------------------------------------------------------
    f = Q.win(r, PG, "F4 · The wide Notebook", "Wide, the sidebar has the search; the Filter button sits under it. A set filter "
              "takes over the main column as a list (a view, with its line on top), the way At the reader does; Esc or "
              "Clear returns to the page. The sidebar's sections are not changed.")
    Q.toolbar(f, active="Notebook", inbox=None)
    Q.reader(f, 0, WS.READER_W, first=9, last=13)
    side, pg = WS.notebook(f)
    def under_search(sd):
        fr = row(sd, "filter row", gap=8, pad=[4, 0, 0, 0], W="fill")
        filter_toggle(fr, count=3)
        spacer(fr)
        text(fr, "Clear", "smallStrong", "accent")
    WS.sidebar(side, on="", after_search=under_search)
    WS.page_head(pg, ["Filter"], "3 filters", [], sub="Place: Numbers 25 · Thread: Phinehas · Questions: open")
    WS.view_block(pg, "notebook @Num 25 thread Phinehas questions open",
                  [("Who was the daughter of Zur?", "Numbers 25:15", True), ("Why is the plague stopped there?", "Numbers 25:8", True)],
                  name="the list")
    Q.files_note(pg, "Nothing is written to the study folder by filtering. Copy as a view block writes one fence line into a "
                 "page, only when asked.")


def main():
    F.define_tokens()
    S.do("page.rename", {"name": BOARD}, ref=False)
    board = frame(None, BOARD, x=0, y=0, w=100, h=100, fill="sunken", layout="vertical", gap=96, pad=96, W="hug", H="hug")
    sheets(board)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    script = build / "filter.json"
    script.write_text(json.dumps(S.steps, ensure_ascii=False), encoding="utf-8")
    cli = B.find_cli()
    target = HERE / "filter.figcraft"
    out = subprocess.run([cli, "run", "--no-system-fonts", str(script), "--out", str(target)], capture_output=True,
                         text=True, encoding="utf-8", errors="replace")
    failed = [ln for ln in out.stdout.splitlines() if '"ok":false' in ln]
    if out.returncode or failed:
        sys.exit("FigCraft run failed:\n" + "\n".join(failed[-3:]) + out.stderr[-2000:])
    print(f"{len(S.steps)} steps -> {target}")
    dest = HERE / "exports" / "filter"
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
