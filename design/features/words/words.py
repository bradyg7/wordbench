"""The word sheet, the verse sheet and the hover card, round 1, redrawn 2026-11-16 for direction B (the person's choice).
What a click on a word shows, what a verse reference in a page shows, and what hovering shows. Findings: the card is
bloated by notes and shows their syntax (2bc9), it cannot be moved or sized (dfce, 149b), a reference in a page should
open that verse with its lookups (94a1). Lookups and scripture are fetched with wb into data/; nothing is typed.
W1 is today (as built). W2 and W3 (direction A) are superseded by B and are not drawn.

    python design/features/words/words.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, shadow, spacer, text  # noqa: E402

PG = "Words"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
V11 = next(v["text"] for v in NUM25 if v["v"] == 11)
S7065 = K.fetch(HERE, "strong-H7065", ["strong", "H7065"])
REF = K.verses_of(K.fetch(HERE, "ps106-30-31", ["text", "Ps 106:30-31"], as_json=False))
TABS = ["Numbers 25", "Psalms 106", "Phinehas", "Concordance"]


def head(c, s, sub):
    hd = row(c, "head", gap=12, W="fill")
    text(hd, s["lemma"], "hebrew")
    tc = col(hd, "names", gap=0, W="fill")
    text(tc, s["translit"], "heading")
    text(tc, sub, "caption", "muted")
    return hd


def lex(c, s, full=True):
    para(c, s["definition"], "readSmall")
    if full:
        para(c, "KJV: " + s["usage"], "small", "muted")
    ch = row(c, "renderings", gap=6, wrap=True, W="fill")
    for r_ in s["renderings"][:5]:
        P.chip(ch, f"{r_['w']} {r_['n']}", "outline")


def base(f):
    w = K.app(f)
    K.reader(f, w, W - w, NUM25, "Numbers 25")
    return w


def handle(c, title, floated=False):
    """The card's frame (W4, W-7): a drag handle, the title, float and close."""
    bar = row(c, "handle", gap=6, W="fill")
    icon(bar, "drag", 16, "muted")
    text(bar, title, "smallStrong", W="fill")
    if not floated:
        P.icon_button(bar, "float", "muted", size=26, icon_size=14)
    P.icon_button(bar, "close", "muted", size=26, icon_size=14)


def count_line(c, s):
    """One count line for the pages that name the word or verse (W-5): never a page's text."""
    ln = row(c, "pages", gap=8, W="fill")
    icon(ln, "page", 16, "muted")
    text(ln, s, "small", "accent", W="fill")
    icon(ln, "right", 14, "muted")


VERSE_TABS = ["Interlinear", "In the Concordance", "Definitions"]


def verse_tabs(c, active="Interlinear"):
    """The verse card's three tabs (W-9): each as wide as its word, never cut; where the three do not fit one line
    (floated at 300, phone width) the row takes a second line."""
    seg = row(c, "tabs", gap=2, pad=3, fill="sunken", radius=10, W="fill", wrap=True)
    for o in VERSE_TABS:
        on = o == active
        it = row(seg, f"tab/{o}", gap=6, pad=[7, 12, 7, 12], fill="surface" if on else None, radius=8,
                 mainAlign="center", W="hug")
        if on:
            shadow(it, 1, 3, "#00000014")
        text(it, o, "smallStrong", "fg" if on else "muted")
    return seg


def verse_body(c, verses, text_style="readSmall", note=True, button_fill=False):
    """What a verse card holds below its handle: the verse, the three tabs, Read the chapter."""
    K.F.verses(c, verses, text_style)
    verse_tabs(c)
    if note:
        text(c, "the verse's words, original above English (wb interlinear)", "caption", "muted")
    P.button(c, "Read the chapter", "secondary", "book", size="sm", **({"W": "fill"} if button_fill else {}))


def verse_card(f, x, y, w, verses, title, note=True, floated=False, text_style="readSmall", compact=False):
    """The verse card, exactly as W4 draws it (reused by W7, W8 and by other folders: concordance C11).

    f          the window frame (from Q.win) to draw into
    x, y, w    where the card floats, and its width (W4 520; W8 300)
    verses     [{"v": int, "text": str}, ...] from the database (K.verses_of(K.fetch(...))), never typed
    title      the handle's title, e.g. "Psalms 106:30-31"
    note       the caption under the tabs (wb interlinear); False when drawn small
    floated    True once Float was used: the float button is not drawn (W8)
    text_style the verse's text style ("readSmall"; "small" when compact)
    compact    W8's smaller padding and gap
    Returns the card. The tabs read Interlinear, In the Concordance, Definitions in full at any width (W-9)."""
    kw = dict(pad=(10, 12, 10, 12), gap=6) if compact else {}
    c = K.floating(f, "verse card", x, y, w, **kw)
    handle(c, title, floated=floated)
    verse_body(c, verses, text_style, note)
    return c


def verse_phone_sheet(f, pw, ph, top, title, verses):
    """The verse card at phone width, exactly as W10 draws it (reused by other folders: concordance C13).

    f          the window frame (from Q.win with w=pw, h=ph)
    pw, ph     the window's width and height (W10 390 x 800)
    top        the sheet's height above the window's bottom, i.e. its top edge is at ph - top (W10 273, C13 247, W11
               fits its own); the frame is that high plus 16 px the window clips, so it fills the width and sits at the
               bottom with no pane showing beneath. Pick top to hug the content.
    title      the handle's title, e.g. "Numbers 25:11"
    verses     as verse_card
    Returns the sheet."""
    c = sheet_card(f, pw, ph, top, title, "verse sheet")
    verse_body(c, verses, "readSmall", note=False, button_fill=True)
    return c


def door(c):
    """The one door and the two books, as concordance C10 draws them (concordance.py, round2, the C10 window's word card)."""
    P.button(c, "In the Concordance", "primary", icon_name="word", size="sm", W="fill")
    two = row(c, "books", gap=8, W="fill")
    P.button(two, "BDB", "secondary", icon_name="lexicon", size="sm", W="fill")
    P.button(two, "Webster's", "secondary", icon_name="dictionary", size="sm", W="fill")


def word_card(f, x, y, w, pages):
    """The word card under B (W-7): W4's frame, the lemma and Strong's words, one count line, the one door."""
    c = K.floating(f, "word card", x, y, w)
    handle(c, "H7065")
    head(c, S7065, "zealous · Numbers 25:11")
    lex(c, S7065, full=False)
    count_line(c, pages)
    door(c)
    return c


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "W1 · Today: the word sheet",
              "As built (main.ts lexiconBody): a click on a word opens a popover with the lemma, Strong's definition "
              "and usage, counts, Every use and Interlinear, Open as a tab, and below them the person's notes on the "
              "word, with their Markdown showing (2bc9). It cannot be moved or sized (dfce, 149b). Drawn as it is "
              "today, so it still shows Every use; B replaces it with the one door (W6).")
    w = base(f)
    c = K.floating(f, "word sheet", w + 500, TB + 150, 420)
    head(c, S7065, "zealous · Numbers 25:11 · H7065")
    lex(c, S7065)
    b = row(c, "actions", gap=8, W="fill")
    P.button(b, "Every use", "primary", size="sm")
    P.button(b, "Interlinear", "secondary", size="sm")
    P.button(b, "Open as a tab", "ghost", size="sm")
    K.rule(c)
    text(c, "YOUR NOTES", "label", "muted")
    para(c, "```scripture Num 25:11``` and a page's text with its Markdown", "small", "muted")


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "W4 · B: a reference in a page opens the verse",
              "A reference in a page opens that verse alone in a card (94a1): its text, then Interlinear, In the "
              "Concordance and Definitions as tabs, and Read the chapter. In the Concordance is the one door; there "
              "is no Strong's button. The card moves and sizes (dfce); Float makes it a floating pane, Open as a tab "
              "makes it a tab.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, 560, H - TB, "Phinehas", "a page (a drawn sample)", fill="bg")
    para(pg, "See Psalms 106:30–31 beside Numbers 25.", "body")
    verse_card(f, w + 600, TB + 90, 520, REF, "Psalms 106:30–31")

    f = Q.win(r, PG, "W5 · B: the hover card, quiet",
              "With hover on, resting on a word shows only its lemma, sound and Strong's words, small, and nothing to "
              "click; a click opens the card (W6). On a reference it shows the verse. Hover off: nothing shows.")
    w = base(f)
    c = K.floating(f, "hover", w + 560, TB + 110, 300, gap=4)
    hd = row(c, "head", gap=8)
    text(hd, S7065["lemma"], "hebrew", fontSize=22, lineHeight="28px")
    text(hd, S7065["translit"], "smallStrong")
    para(c, S7065["definition"], "caption", "muted")


def word_b(cv):
    r = row(cv, "word", gap=64, align="min")
    f = Q.win(r, PG, "W6 · B: the word card a click opens",
              "W-7: the word card takes W4's frame (handle, float, close) with the one door. It holds the lemma, "
              "Strong's words and renderings, one count line for the pages that name the word (W-5), In the "
              "Concordance, and under it BDB and Webster's (W-8). No Every use, no Strong's button, no page text. Float "
              "makes it a floating pane; Open as a tab makes it a tab.")
    w = base(f)
    word_card(f, w + 520, TB + 140, 420, "2 pages name this word")

    f = Q.win(r, PG, "W7 · The card among other tabs",
              "Real conditions: Numbers 25, Psalms 106, a page and the Concordance are open as tabs, and a verse card "
              "rests over the reader. Closing the card leaves the tabs and the reader's place as they were (5f45, "
              "94a1); the card alone is not a step on the trail.")
    w = K.app(f)
    half = (W - w) // 2
    rdp = K.M.pane(f, w, TB, half, H - TB, TABS, "Numbers 25", side="left", actions=("minimize", "expand", "close"))
    text(rdp, "Numbers 25", "chapter", fontSize=26, lineHeight="34px")
    K.F.verses(rdp, NUM25, "readSmall")
    p2 = K.M.pane(f, w + half, TB, W - w - half, H - TB, ["Phinehas", "Concordance"], "Phinehas")
    para(p2, "a page (a drawn sample)", "small", "muted")
    verse_card(f, w + 150, TB + 330, 520, REF, "Psalms 106:30–31")


def real_b(cv):
    r = row(cv, "real", gap=64, align="min")
    f = Q.win(r, PG, "W8 · The card floated, small",
              "Float makes the card a floating pane (minimize B2), here pulled small: its text wraps, the three tabs "
              "and Read the chapter stay. It can be dragged anywhere and sized from its corner (dfce).")
    base(f)
    verse_card(f, W - 380, TB + 60, 300, [{"v": 11, "text": V11}], "Numbers 25:11", note=False, floated=True,
               text_style="small", compact=True)

    f = Q.win(r, PG, "W9 · A word with hundreds of pages naming it",
              "Years of study: the word has hundreds of pages that name it (the count is a drawn sample). The card "
              "still shows one count line and nothing of any page's text or Markdown (W-5, 2bc9); the line opens "
              "their list.")
    w = base(f)
    word_card(f, w + 520, TB + 140, 420, "412 pages name this word")


def sheet_card(f, pw, ph, top, title, name):
    # fixed height: the sheet's top edge is `top` above the window's bottom; it runs 16 px past it (the window clips)
    c = col(f, name, gap=8, pad=[10, 14, 14, 14], fill="surface", radius=14, stroke="line", sw=1, W="fixed", H="fixed")
    Q.put(c, 0, ph - top, pw, top + 16)
    shadow(c, 8, 28, "#00000033")
    handle(c, title)
    return c


def narrow_b(cv):
    r = row(cv, "narrow", gap=64, align="min")
    pw, ph = 390, 800
    f = Q.win(r, PG, "W10 · Narrow: the verse card at phone width",
              "At phone width the card is a sheet over the bottom of the screen: the same verse, the same three tabs "
              "and Read the chapter. Closing returns to the verse it came from.", w=pw, h=ph)
    K.reader(f, 0, pw, NUM25, "Numbers 25", top=0, width=pw - 40)
    verse_phone_sheet(f, pw, ph, 273, "Numbers 25:11", [{"v": 11, "text": V11}])

    f = Q.win(r, PG, "W11 · Narrow: the word card at phone width",
              "The word card is the same sheet: lemma, Strong's words, one count line, the one door and under it BDB and "
              "Webster's, full width.",
              w=pw, h=ph)
    K.reader(f, 0, pw, NUM25, "Numbers 25", top=0, width=pw - 40)
    c = sheet_card(f, pw, ph, 250, "H7065", "word sheet")
    head(c, S7065, "zealous · Numbers 25:11")
    para(c, S7065["definition"], "small", "muted")
    count_line(c, "2 pages name this word")
    door(c)


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Word sheet, verse sheet and hover card, round 1",
                  "Today (W1); direction B, chosen 2026-11-16: a reference opens the verse alone with the one "
                  "In the Concordance door (W4), a quiet hover card (W5), the word card in W4's frame (W6, W-7) and "
                  "the real conditions (W7 to W11). W2 and W3 (direction A) are superseded and not drawn.")
    today(cv)
    direction_b(cv)
    word_b(cv)
    real_b(cv)
    narrow_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Words", sheets)
