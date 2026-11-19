"""Filters round 3. The entries and result counts on these screens are fictional."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import kit as K
from kit import P, Q, col, frame, icon, para, row, spacer, text

BOARD = "Filters round 3"
ENTRIES = (
    ("Covenant", "hlYellow"),
    ("Covenant promises", "hlGreen"),
    ("Covenant promises and reminders throughout the wilderness", "hlBlue"),
)
SELECTED = ENTRIES[1][0]


def control(parent, label, value):
    text(parent, label, "smallStrong")
    field = row(parent, label, W="fill", pad=[7, 10], fill="bg", stroke="line", sw=1, radius=8)
    para(field, value, "small")
    icon(field, "down", 14, "muted")


def entry_list(parent, query, window_rows):
    search = row(parent, "Search Legend entries", W="fill", pad=[7, 10], fill="bg", stroke="line", sw=1, radius=8)
    icon(search, "search", 14, "muted")
    text(search, query or "Search Legend entries", "small", "fg" if query else "muted")
    text(parent, "3 of 68 entries" if query else "68 of 240 entries", "caption", "muted")
    listing = row(parent, "Legend entry list", W="fill", align="min", gap=0, stroke="line", sw=1, radius=8, clip=True)
    choices = col(listing, "Choices", gap=0)
    any_entry = row(choices, "Any entry", W="fill", pad=[8, 10])
    text(any_entry, "Any entry", "small")
    for name, color in window_rows:
        selected = name == SELECTED
        item = row(choices, name, W="fill", pad=[6, 10], fill="accentSoft" if selected else "surface")
        frame(item, "Highlight sample", w=18, h=9, fill=color, radius=2, W="fixed", H="fixed")
        words = col(item, "Name and kind", gap=0)
        para(words, name, "smallStrong" if selected else "small")
        text(words, "Highlight", "caption", "muted")
        if selected:
            icon(item, "check", 14, "accent")
    if not query:
        track = col(listing, "Legend list scroll track", gap=0, W="fixed", H="fill", w=6, fill="sunken")
        frame(track, "Scroll thumb", w=6, h=20, fill="line", radius=3, W="fixed", H="fixed")


def filter_panel(parent, x, y, width, height):
    panel = frame(parent, "Filters panel", x=x, y=y, w=width, h=height, fill="surface", stroke="line", sw=1, radius=10, clip=True)
    head = row(panel, "Filters heading", W="fixed", w=width - 2, pad=[8, 14], fill="surface")
    Q.put(head, 1, 1)
    text(head, "Filters", "heading")
    spacer(head)
    P.icon_button(head, "close", size=32, icon_size=15)

    body = col(panel, "Filter controls", W="fixed", H="fixed", w=width - 2, h=height - 107, gap=6, pad=[4, 14], clip=True)
    Q.put(body, 1, 50)
    footer = row(panel, "Filter actions", W="fixed", w=width - 2, pad=[8, 12], fill="sunken")
    Q.put(footer, 1, height - 48)
    P.button(footer, "Clear filters", size="sm")
    spacer(footer)
    P.button(footer, "Apply", "primary", size="sm")
    return body


def filters(parent, x, y, width, height, *, query="", colors=False):
    body = filter_panel(parent, x, y, width, height)
    if colors:
        control(body, "Folder", "Any folder")
        text(body, "Legend entry", "smallStrong")
        control(body, "Browse by kind", "Highlight")
    else:
        control(body, "Kind of mark", "Highlight")
        text(body, "Legend entry", "smallStrong")
    para(body, f"Selected · {SELECTED}", "small", "accent")
    window_rows = ENTRIES if query else (("Abiding", "hlPink"), ("Courage", "hlYellow"), *ENTRIES[:2])
    entry_list(body, query, window_rows)
    if not colors:
        control(body, "Book and place", "Any place")
        control(body, "Made", "Any date")

def applied_rows(parent, values):
    for label, value in values:
        applied = row(parent, label, W="fill", pad=[4, 8], fill="sunken", radius=6)
        para(applied, f"{label} · {value}", "small")
        P.icon_button(applied, "close", size=24, icon_size=12)


def results(parent, x, y, width, height, *, empty=False, phone=False):
    pane = col(parent, "Find in study", W="fixed", H="fixed", w=width, h=height, pad=14, gap=12, fill="surface", clip=True)
    Q.put(pane, x, y)
    if not phone:
        text(pane, "Notebook     ·     Questions", "caption", "muted")
    head = row(pane, "Results heading", W="fill")
    text(head, "Find in study", "heading")
    spacer(head)
    P.button(head, "Filters · 4" if empty else "Filters", icon_name="filter", size="sm")
    text(pane, "Search your study", "small", "muted")
    K.rule(pane)
    if empty:
        applied_rows(pane, (("Result kind", "Marks"), ("Kind of mark", "Highlight"), ("Legend entry", SELECTED), ("Book", "John")))
        text(pane, "No marks match these filters", "bodyStrong")
    else:
        text(pane, "Marks", "smallStrong")
        K.line(pane, "John 3:16", "Highlight · Covenant promises")
        K.line(pane, "John 3:17", "Highlight · Hope")


def color_grid(parent):
    grid = col(parent, "Colors across the Bible", W="fixed", w=595, pad=20, gap=16, fill="surface")
    Q.put(grid, 24, 26)
    head = row(grid, "Colors heading", W="fill")
    text(head, "Colors across the Bible", "title")
    spacer(head)
    P.button(head, "Filters", icon_name="filter", size="sm")
    for book in ("Genesis", "Exodus", "Leviticus", "Numbers"):
        book_row = row(grid, book, W="fill", gap=4)
        frame_label = row(book_row, "Book name", W="fixed", w=82)
        text(frame_label, book, "smallStrong")
        for chapter in range(1, 15):
            cell = col(book_row, f"{book} {chapter}", W="fixed", w=29, fill="bg", gap=3, pad=4, stroke="line", sw=1)
            text(cell, str(chapter), "caption", "muted")
            bar = col(cell, "Chapter colors", W="fill", H="fixed", h=10, gap=2)
            if chapter % 3:
                frame(bar, "Highlight sample", h=4, fill="hlGreen", W="fill", H="fixed")
            if chapter % 4 == 1:
                frame(bar, "Second highlight sample", h=4, fill="hlBlue", W="fill", H="fixed")


NB_CHOICES = (
    ("Page kind", "Any page kind"),
    ("Pages with questions", "Open"),
    ("Book and place", "Any place"),
    ("Folder", "Acts study"),
    ("Written", "Any date"),
)
NB_APPLIED = (("Pages with questions", "Open"), ("Folder", "Acts study"))
NB_ROWS = (
    ("Prayer in the upper room", "Acts study · 1 open question"),
    ("Prayer at the temple", "Acts study · 2 open questions"),
    ("Prayer after the council", "Acts study · 1 open question"),
)


def result_pane(parent, title, width, height, *, context=None, words=None, applied=(), count=None,
                items=(), notebook=False, selected="All", forms=False):
    pane = col(parent, title, W="fixed", H="fixed", w=width, h=height, pad=16, gap=12, fill="surface", clip=True)
    head = row(pane, "Results heading", W="fill")
    para(head, title, "heading")
    P.button(head, f"Filters · {len(applied)}" if applied else "Filters", icon_name="filter", size="sm")
    if notebook:
        tabs = row(pane, "Notebook sections", W="fill", gap=4)
        for name in ("Days", "Pages", "Places", "Questions", "All"):
            tab = row(tabs, name, pad=[4, 6], radius=5, fill="accentSoft" if name == selected else "surface")
            text(tab, name, "caption", "accent" if name == selected else "muted")
    if context:
        para(pane, context, "small", "muted")
    if forms:
        P.button(pane, "Other forms included", size="sm")
    if words is not None:
        search = row(pane, "Search and scope", W="fill")
        field = row(search, "Search field", W="fill", pad=[7, 10], stroke="line", sw=1, radius=7)
        icon(field, "search", 14, "muted")
        para(field, words, "small")
        if notebook:
            P.button(search, "Find in study", size="sm")
    applied_rows(pane, applied)
    K.rule(pane)
    if count:
        text(pane, count, "smallStrong")
    for name, details in items:
        K.line(pane, name, details)
    return pane


def standard_window(parent, tag, caption, title, choices, *, width=735, height=530, phone=False, **result):
    f = Q.win(parent, BOARD, tag, caption, w=width, h=height)
    result_pane(f, title, width if phone or not choices else width - 324, height, **result)
    if choices:
        panel_height = min(420, height - 105) if phone else height - 20
        body = filter_panel(f, 0 if phone else width - 324, height - panel_height if phone else 10,
                            width if phone else 314, panel_height)
        for label, value in choices:
            control(body, label, value)


def app_wide(board):
    sheet = Q.section(board, "Notebook and other lists", 1580)
    title = Q.sheet_title(sheet, "Filters everywhere · Round 3", "Follow B6–B8 to see words, pending choices, and applied filters in the same Notebook list.")
    Q.put(title, 0, 0, 1440)

    pair = row(sheet, "Notebook before Apply", gap=32, align="min")
    standard_window(pair, "B6 · Notebook All / words", "The search field narrows the current section. There are 23 pages with ‘prayer’.",
                    "Notebook", (), notebook=True, words="prayer", count="23 pages",
                    items=(NB_ROWS[0], ("Prayers and requests", "Day page · November 14"), NB_ROWS[1]))
    standard_window(pair, "B7 · Notebook All / pending choices", "Folder and open questions are selected in the panel. The list still has 23 pages until Apply.",
                    "Notebook", NB_CHOICES, notebook=True, words="prayer", count="23 pages",
                    items=(NB_ROWS[0], ("Prayers and requests", "Day page · November 14"), NB_ROWS[1]))

    pair = row(sheet, "Notebook after Apply and Questions", gap=32, align="min")
    standard_window(pair, "B8 · Notebook All / applied choices", "Five pages match all three conditions. Removing a filter keeps the words and the other condition.",
                    "Notebook", (), notebook=True, words="prayer", applied=NB_APPLIED, count="5 pages", items=NB_ROWS)
    standard_window(pair, "B9 · Questions on the phone", "Status applies to question rows. The panel offers the same place choice as the Notebook.",
                    "Notebook", (("Status", "Open"), ("Book and place", "Acts")), width=390, height=635, phone=True,
                    notebook=True, selected="Questions", count="18 questions", items=(("Question about the gathering", "Acts 2"),))

    pair = row(sheet, "Notebook Places and Bible Search", gap=32, align="min")
    standard_window(pair, "B10 · Notebook Places", "A fixed reference overrides Follow the reader. Clear restores the configured default.",
                    "Notebook", (("Page kind", "Any page kind"), ("Pages with questions", "Any status"),
                                 ("Book and place", "Specific place · Acts 2"), ("Folder", "Any folder"), ("Written", "Any date")),
                    notebook=True, selected="Places", context="Following the reader · John 3", count="3 pages",
                    items=(("The conversation in John 3", "John 3"),))
    standard_window(pair, "B11 · Bible Search", "Apply a place or match option and start from the first results page with the same words.",
                    "Bible Search", (("Book and place", "Acts"), ("Match case", "Off"), ("Regular expression", "Off")),
                    context="Search words · prayer", count="Whole Bible · page 1", items=(("Acts 1:14", None), ("Acts 6:4", None)))

    pair = row(sheet, "Study search and folders", gap=32, align="min")
    standard_window(pair, "B12 · Find in study", "Selecting Pages reveals page choices. The same words stay in the search field.",
                    "Find in study", (("Result kind", "Pages"), ("Pages with questions", "Open"),
                                      ("Book and place", "Any place"), ("Folder", "Any folder"), ("Changed", "Any date")),
                    words="prayer", count="31 results", items=(("Prayer in the upper room", "Page · Acts study"), ("Prayer", "Folder")))
    standard_window(pair, "B13 · Opened folder", "Words and place combine within the opened folder. Its saves retain their folder order.",
                    "Acts study", (("Result kind", "Saves"), ("Book and place", "Acts 2")),
                    words="prayer", count="7 matches", items=(("Acts 2:42", "Save · prayer"), ("Acts 1:14", "Save · prayer")))

    pair = row(sheet, "Concordance and Findings", gap=32, align="min")
    standard_window(pair, "B14 · Concordance", "Book narrows occurrences. The forms control stays with the chosen word.",
                    "Concordance", (("Book", "Acts"),), context="English word · prayer", forms=True,
                    items=(("Acts 6:4", None), ("Acts 12:5", None)))
    standard_window(pair, "B15 · Findings", "Choose a tag from the list and decide whether to include handled findings.",
                    "Findings", (("Status", "Include handled"), ("Tag", "notebook")), context="Open findings",
                    count="12 findings", items=(("Notebook remembers the wrong section", "notebook · Open"),))

    pair = row(sheet, "Legend and Highlights", gap=32, align="min")
    standard_window(pair, "B16 · Legend Where used", "Clear returns to every use of the entry that opened the list.",
                    "Where used", (("Book and place", "John"),), context=SELECTED,
                    count="46 uses", items=(("John 3:16", None), ("Acts 2:39", None)))
    standard_window(pair, "B17 · Highlights", "Color, place and folder narrow the existing highlights list.",
                    "Your highlights", (("Color", "Yellow"), ("Book and place", "Acts"), ("Folder", "Any folder")),
                    count="82 highlights", items=(("John 3:16", "Yellow"), ("Acts 2:42", "Green")))


def sheets(board):
    app_wide(board)
    sheet = Q.section(board, "Marks and colors", 1580)
    title = Q.sheet_title(sheet, "Marks and colors", "Search hundreds of Legend entries and browse by kind at every pane width.")
    Q.put(title, 0, 0, 1440)

    f = Q.win(sheet, BOARD, "B1 · Notebook Marks among other tabs", "Kind scopes the Legend and can be applied on its own. The list scrolls while the footer stays visible.", w=1440, h=750)
    rail = K.app(f)
    reader = col(f, "Reader", W="fixed", w=400, pad=24)
    Q.put(reader, rail, 55)
    text(reader, "John 3", "chapter")
    results(f, 450, 49, 990, 701)
    filters(f, 1038, 60, 382, 674)

    narrow = row(sheet, "Narrow windows", gap=48, align="min")
    f = Q.win(narrow, BOARD, "B2 · Narrow floating tab", "The bottom sheet stays inside the floating tab. A long entry wraps inside its own row.", w=550, h=830)
    float_tab = K.floating(f, "Floating Notebook tab", 100, 24, 350, pad=(0, 0))
    floated = frame(float_tab, "Floating tab content", w=350, h=783, W="fixed", H="fixed", clip=True)
    results(floated, 0, 0, 350, 783)
    filters(floated, 0, 110, 350, 673, query="covenant")

    f = Q.win(narrow, BOARD, "B3 · Phone", "The same section order and name search. The search field narrows the chooser to three entries.", w=390, h=830)
    results(f, 0, 0, 390, 830, phone=True)
    filters(f, 0, 158, 390, 672, query="covenant")

    f = Q.win(narrow, BOARD, "B4 · No matches", "Applied values remain individually removable after a valid search with no results.", w=390, h=830)
    results(f, 0, 0, 390, 830, empty=True, phone=True)

    f = Q.win(sheet, BOARD, "B5 · Colors across the Bible", "Top-left excerpt of the grid. Folder and Legend entry have labeled controls. Browsing a kind in the chooser leaves the chapter grid in place.", w=1040, h=660)
    color_grid(f)
    filters(f, 636, 16, 386, 627, colors=True)


if __name__ == "__main__":
    K.run_board(HERE, BOARD, sheets)
