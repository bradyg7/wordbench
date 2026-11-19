"""Filters round 2. The entries and result counts on these screens are fictional."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import kit as K
from kit import P, Q, col, frame, icon, para, row, spacer, text

BOARD = "Filters round 2"
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


def filters(parent, x, y, width, height, *, query="", colors=False):
    panel = frame(parent, "Filters panel", x=x, y=y, w=width, h=height, fill="surface", stroke="line", sw=1, radius=10, clip=True)
    head = row(panel, "Filters heading", W="fixed", w=width - 2, pad=[8, 14], fill="surface")
    Q.put(head, 1, 1)
    text(head, "Filters", "heading")
    spacer(head)
    P.icon_button(head, "close", size=32, icon_size=15)

    body = col(panel, "Filter controls", W="fixed", H="fixed", w=width - 2, h=height - 107, gap=6, pad=[4, 14], clip=True)
    Q.put(body, 1, 50)
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

    footer = row(panel, "Filter actions", W="fixed", w=width - 2, pad=[8, 12], fill="sunken")
    Q.put(footer, 1, height - 48)
    P.button(footer, "Clear filters", size="sm")
    spacer(footer)
    P.button(footer, "Apply", "primary", size="sm")


def results(parent, x, y, width, height, *, empty=False, phone=False):
    pane = col(parent, "Notebook search", W="fixed", H="fixed", w=width, h=height, pad=14, gap=12, fill="surface", clip=True)
    Q.put(pane, x, y)
    if not phone:
        text(pane, "Notebook     ·     Questions", "caption", "muted")
    head = row(pane, "Results heading", W="fill")
    text(head, "Notebook search", "heading")
    spacer(head)
    P.button(head, "Filters · 4" if empty else "Filters", icon_name="filter", size="sm")
    text(pane, "Search the Notebook", "small", "muted")
    K.rule(pane)
    if empty:
        for label, value in (("Kind", "Marks"), ("Kind of mark", "Highlight"), ("Legend entry", SELECTED), ("Book", "John")):
            applied = row(pane, label, W="fill", pad=[4, 8], fill="sunken", radius=6)
            para(applied, f"{label} · {value}", "small")
            P.icon_button(applied, "close", size=24, icon_size=12)
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


def sheets(board):
    sheet = Q.section(board, BOARD, 1580)
    title = Q.sheet_title(sheet, "Filters everywhere · Round 2", "Direction B with a searchable Legend, kind filtering and one choice per row.")
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
