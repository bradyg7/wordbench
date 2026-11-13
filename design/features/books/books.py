"""BDB and Webster's 1913 as books, round 1. The rail (minimize round 5) already gives Brown-Driver-Briggs and
Webster's 1913 a place each, beside the Concordance; this round asks what opening one of them looks like. It draws
the lexicons as books you page through (2cd1: arrows through the entries, as Blue Letter Bible does), an index of every
entry (b537), one card holding Strong's, BDB and Webster's together, marking part of an entry (ea54), and references
to other entries as links (f73d). Entries are fetched with wb (bdb, strong, word-define) into data/; nothing is typed.

    python design/features/books/books.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import kit as K  # noqa: E402
from kit import P, Q, W, H, TB, col, frame, icon, para, row, spacer, text  # noqa: E402

PG = "Books"
BDB = K.fetch(HERE, "bdb-H7065", ["bdb", "H7065"])
BDB_NEXT = K.fetch(HERE, "bdb-H7066", ["bdb", "H7066"])
STRONG = K.fetch(HERE, "strong-H7065", ["strong", "H7065"])
WEB = K.fetch(HERE, "webster-zealous", ["word-define", "zealous"])
WEB_ZEAL = K.fetch(HERE, "webster-zeal", ["word-define", "zeal"])


def bdb_text(e):
    return e["entries"][0]["text"] if e.get("entries") else ""


def entry_page(p, e, big=True):
    hd = row(p, "headword", gap=14, W="fill")
    text(hd, e["lemma"], "hebrew", fontSize=34 if big else 26, lineHeight="44px")
    tc = col(hd, "names", gap=0, W="fill")
    text(tc, e.get("translit", ""), "heading")
    text(tc, f"{e['strong']} · Brown-Driver-Briggs", "caption", "muted")
    for i, ln in enumerate(bdb_text(e).splitlines()):
        if i == 0 and ln.startswith("["):  # "[headword] vb. denom.": the headword is drawn above, apart from the Latin
            ln = ln.split("]", 1)[-1]
        indent = len(ln) - len(ln.lstrip())
        r = row(p, "line", gap=0, pad=[0, 0, 0, indent * 6], W="fill")
        para(r, ln.strip(), "readSmall")


def nav(p, prev, nxt):
    r = row(p, "pages", gap=8, W="fill")
    P.button(r, prev, "ghost", "left", size="sm")
    spacer(r)
    P.button(r, nxt, "ghost", "right", size="sm")


def today(cv):
    r = row(cv, "today", gap=64, align="min")
    f = Q.win(r, PG, "K1 · Today: a lookup in a tab",
              "As built: BDB opens from a word sheet as a tab holding one entry's text; Webster's 1913 is on the word "
              "sheet's Definitions once dictionary.db is built (66b8: the card still said it waits for a source). "
              "There is no way to step to the next entry or see every entry (2cd1, b537), and a [[H…]] in an "
              "entry is shown as text (f73d).")
    w = K.app(f, on="Brown-Driver-Briggs")
    p = M_pane(f, w, ["Numbers 25", "BDB H7065"], "BDB H7065")
    entry_page(p, BDB, big=False)


def M_pane(f, w, tabs, active, pw=560):
    K.reader(f, w, W - w - pw, K.verses_of(K.wb("text", "Num 25:10-13")), "Numbers 25")
    return K.M.pane(f, W - pw, TB, pw, H - TB, tabs, active)


def direction_a(cv):
    r = row(cv, "A", gap=64, align="min")
    f = Q.win(r, PG, "K2 · A: the lexicon as a book",
              "Brown-Driver-Briggs opens as a book: one entry to a page, the entries before and after it one arrow "
              "(or ← →) away, as in Blue Letter Bible (2cd1). The page you were on is kept, as the reader keeps its "
              "verse; Every use and Interlinear stay on the word's own card.")
    w = K.app(f, on="Brown-Driver-Briggs")
    p = M_pane(f, w, ["Numbers 25", "Brown-Driver-Briggs"], "Brown-Driver-Briggs")
    nav(p, "H7064", "H7066")
    entry_page(p, BDB)
    K.note(f, "← and → page through entries in Strong's order; the place button says where you are (H7065 of "
              "H8674).", W - 520, H - 110, 460)

    f = Q.win(r, PG, "K3 · A: every entry, as an index",
              "The book's contents (b537): every Hebrew entry, or every Greek one, by number or by the alphabet, with "
              "a box to narrow it. A click opens that page. Webster's has the same index by word.")
    w = K.app(f, on="Brown-Driver-Briggs")
    p = K.panel(f, w, TB, W - w, H - TB, "Brown-Driver-Briggs · contents", "8674 Hebrew and Aramaic entries")
    tb = row(p, "choose", gap=10, W="fill")
    P.segmented(tb, ["Hebrew", "Greek"], "Hebrew", W="hug")
    P.segmented(tb, ["By number", "By letter"], "By number", W="hug")
    P.field(tb, "Narrow the list", icon_name="search")
    grid = row(p, "entries", gap=8, W="fill", wrap=True)
    for n in ("H7062", "H7063", "H7064", "H7065", "H7066", "H7067", "H7068", "H7069", "H7070"):
        it = col(grid, n, gap=2, pad=[10, 12, 10, 12], radius=10, stroke="accent" if n == "H7065" else "line", sw=1,
                 fill="accentSoft" if n == "H7065" else "surface", W="fixed")
        Q.put(it, 0, 0, 200)
        text(it, n, "smallStrong")
        text(it, "an entry's headword", "caption", "muted")
    K.note(f, "The headwords on these tiles come from the database when this is built; the sheet shows the layout "
              "only.", w + 24, H - 90, 420)


def direction_b(cv):
    r = row(cv, "B", gap=64, align="min")
    f = Q.win(r, PG, "K4 · B: one card, three books",
              "The word's card holds its three sources as tabs: Strong's, BDB, Webster's. The rail's book buttons "
              "open the same card for whatever word was last asked, so a lexicon is never far from the verse.")
    w = K.app(f)
    K.reader(f, w, W - w, K.verses_of(K.wb("text", "Num 25:10-13")), "Numbers 25")
    c = K.floating(f, "word card", w + 520, TB + 130, 440)
    hd = row(c, "head", gap=10, W="fill")
    text(hd, STRONG["lemma"], "hebrew")
    tc = col(hd, "names", gap=0, W="fill")
    text(tc, STRONG["translit"], "heading")
    text(tc, "zealous · Numbers 25:11", "caption", "muted")
    P.segmented(c, ["Strong's", "BDB", "Webster's"], "Webster's")
    para(c, WEB["text"], "readSmall")
    text(c, "Webster's Revised Unabridged Dictionary, 1913", "caption", "muted")

    f = Q.win(r, PG, "K5 · B: marking part of an entry",
              "Select words in an entry to color them, as in the reader (ea54). The mark is kept with the entry's "
              "number, in highlights, so it is there the next time the entry opens; nothing in the lexicon changes.")
    w = K.app(f, on="Brown-Driver-Briggs")
    p = M_pane(f, w, ["Numbers 25", "Brown-Driver-Briggs"], "Brown-Driver-Briggs")
    entry_page(p, BDB)
    dots = row(f, "colors", gap=8, pad=[6, 10, 6, 10], fill="surface", radius=999, stroke="line", sw=1)
    Q.put(dots, W - 420, TB + 240)
    K.shadow(dots, 6, 18, "#00000026")
    P.color_row(dots, size=20)


def links(cv):
    r = row(cv, "links", gap=64, align="min")
    f = Q.win(r, PG, "K6 · Entries that name other entries",
              "Strong's derivations and BDB's cross references name other numbers; each is a link that turns the "
              "page (f73d), and the way back is one arrow, as everywhere.")
    w = K.app(f, on="Concordance")
    p = M_pane(f, w, ["Numbers 25", "Strong's"], "Strong's")
    hd = row(p, "head", gap=14, W="fill")
    text(hd, STRONG["lemma"], "hebrew")
    tc = col(hd, "names", gap=0, W="fill")
    text(tc, STRONG["translit"], "heading")
    text(tc, f"{STRONG['strong']} · {STRONG['pos']}", "caption", "muted")
    para(p, STRONG["derivation"].replace("[[", "").replace("]]", ""), "small", "accent")
    para(p, STRONG["definition"], "readSmall")
    para(p, "KJV: " + STRONG["usage"], "small", "muted")
    K.note(f, "Here the derivation names no other number; where one does (H7062: from H7061), it is drawn in the "
              "accent color and opens that entry.", W - 520, H - 110, 460)

    f = Q.win(r, PG, "K7 · Webster's as a book",
              "The same book for Webster's 1913: one word to a page, ← → to the words beside it, and the index by "
              "letter. The reader's word opens it at that word.")
    w = K.app(f, on="Webster's 1913")
    p = M_pane(f, w, ["Numbers 25", "Webster's 1913"], "Webster's 1913")
    nav(p, "zeal", "zealously")
    text(p, WEB["headword"], "title")
    para(p, WEB["text"], "readSmall")
    text(p, "Webster's Revised Unabridged Dictionary, 1913", "caption", "muted")


def sheets(board):
    cv = Q.section(board, "Round 1", 3200)
    Q.sheet_title(cv, "BDB and Webster's 1913 as books, round 1",
                  "Today (K1); A, each lexicon as a book with arrows and an index (K2, K3); B, one card with the three "
                  "sources and marks on an entry (K4, K5); links between entries (K6) and Webster's as a book (K7).")
    today(cv)
    direction_a(cv)
    direction_b(cv)
    links(cv)


if __name__ == "__main__":
    K.run_board(HERE, "Books", sheets)
