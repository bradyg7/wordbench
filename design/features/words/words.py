"""The word sheet, the verse sheet and the hover card, round 1. What a click (or, after reader round 1, a right click's
Strong's line) on a word shows, what a verse reference in a page shows, and what hovering shows. Findings: the card is
bloated by notes and shows their syntax (2bc9), it cannot be moved or sized (dfce, 149b), a reference in a page should
open that verse with its lookups (94a1), and Strong's entries should step with arrows (2cd1). Lookups and scripture are
fetched with wb into data/; nothing is typed.

    python design/features/words/words.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Words"
NUM25 = K.verses_of(K.fetch(HERE, "num25-10-13", ["text", "Num 25:10-13"], as_json=False))
V11 = next(v["text"] for v in NUM25 if v["v"] == 11)
S7065 = K.fetch(HERE, "strong-H7065", ["strong", "H7065"])
REF = K.verses_of(K.fetch(HERE, "ps106-30-31", ["text", "Ps 106:30-31"], as_json=False))


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


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "W1 · Today: the word sheet",
              "As built (main.ts lexiconBody): a click on a word opens a popover with the lemma, Strong's definition "
              "and usage, counts, Every use and Interlinear, Open as a tab, and below them the person's notes on the "
              "word, with their Markdown showing (2bc9). It cannot be moved or sized (dfce, 149b).")
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


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "W2 · A: a smaller card that can be moved",
              "The card holds the word only: its lemma, Strong's words, its renderings as chips (a click is Every use "
              "of that rendering). Pages on the word are one line, a count that opens them (2bc9). Its head is a "
              "handle: drag it anywhere, pull a corner to size it; the pin keeps it open while you read (dfce, 149b).")
    w = base(f)
    c = K.floating(f, "word card", w + 520, TB + 140, 400)
    bar = row(c, "handle", gap=6, W="fill")
    icon(bar, "drag", 16, "muted")
    spacer(bar)
    P.icon_button(bar, "left", "muted", size=26, icon_size=14)
    text(bar, "H7065", "caption", "muted")
    P.icon_button(bar, "right", "muted", size=26, icon_size=14)
    P.icon_button(bar, "float", "muted", size=26, icon_size=14)
    P.icon_button(bar, "close", "muted", size=26, icon_size=14)
    head(c, S7065, "zealous · Numbers 25:11")
    lex(c, S7065, full=False)
    ln = row(c, "pages", gap=8, W="fill")
    icon(ln, "page", 16, "muted")
    text(ln, "2 pages on this word", "small", "accent", W="fill")
    b = row(c, "actions", gap=8, W="fill")
    P.button(b, "Every use", "primary", size="sm")
    P.button(b, "Interlinear", "secondary", size="sm")
    P.button(b, "BDB", "ghost", size="sm")

    f = Q.win(r, PG, "W3 · A: ‹ › through the entries",
              "The arrows in the card's head step to the entry before or after (H7064, H7066), as Blue Letter Bible "
              "does (2cd1); ← and → do the same while the card has focus. The verse word it came from stays named, "
              "so the way back is clear.")
    w = base(f)
    c = K.floating(f, "word card", w + 520, TB + 140, 400)
    bar = row(c, "handle", gap=6, W="fill")
    icon(bar, "drag", 16, "muted")
    spacer(bar)
    P.icon_button(bar, "left", "accent", size=26, icon_size=14, fill="accentSoft")
    text(bar, "H7066", "caption", "fg")
    P.icon_button(bar, "right", "muted", size=26, icon_size=14)
    P.icon_button(bar, "close", "muted", size=26, icon_size=14)
    S7066 = K.fetch(HERE, "strong-H7066", ["strong", "H7066"])
    head(c, S7066, "the next entry · from zealous, Numbers 25:11")
    lex(c, S7066, full=False)


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "W4 · B: a reference in a page opens the verse",
              "A reference in a page opens that verse alone in a card (94a1): its text, then Interlinear, Strong's and "
              "Definitions as tabs, and Read the chapter. The card moves and sizes like the word card (dfce); Open as "
              "a tab makes it a pane.")
    w = K.app(f, on="Notebook")
    pg = K.panel(f, w, TB, 560, H - TB, "Phinehas", "a page (a drawn sample)", fill="bg")
    para(pg, "See Psalms 106:30–31 beside Numbers 25.", "body")
    c = K.floating(f, "verse card", w + 600, TB + 90, 520)
    bar = row(c, "handle", gap=6, W="fill")
    icon(bar, "drag", 16, "muted")
    text(bar, "Psalms 106:30–31", "smallStrong", W="fill")
    P.icon_button(bar, "float", "muted", size=26, icon_size=14)
    P.icon_button(bar, "close", "muted", size=26, icon_size=14)
    F_ = K.F
    F_.verses(c, REF, "readSmall")
    P.segmented(c, ["Interlinear", "Strong's", "Definitions"], "Interlinear")
    text(c, "the verse's words, original above English (wb interlinear)", "caption", "muted")
    P.button(c, "Read the chapter", "secondary", "book", size="sm")

    f = Q.win(r, PG, "W5 · B: the hover card, quiet",
              "With hover on, resting on a word shows only its lemma, sound and Strong's words, small, and nothing to "
              "click; a click opens the card. On a reference it shows the verse. Hover off: nothing shows.")
    w = base(f)
    c = K.floating(f, "hover", w + 560, TB + 110, 300, gap=4)
    hd = row(c, "head", gap=8)
    text(hd, S7065["lemma"], "hebrew", fontSize=22, lineHeight="28px")
    text(hd, S7065["translit"], "smallStrong")
    para(c, S7065["definition"], "caption", "muted")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "Word sheet, verse sheet and hover card, round 1",
                  "Today (W1); A, a smaller word card that moves, sizes and steps through entries (W2, W3); B, a "
                  "reference opens the verse alone, and a quiet hover card (W4, W5).")
    today(cv)
    direction_a(cv)
    direction_b(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Words", sheets)
