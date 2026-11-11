"""Load the original-language text for the interlinear view from STEP Bible's TAGNT and TAHOT (CC BY 4.0).

Greek: TAGNT lists every word of every major edition. The KJV follows the Textus Receptus, so a word is kept when the
TR is among its editions; where the TR reads differently from the Nestle-Aland word at that place, the TR's own word is
taken from the "meaning variants" column. Verse numbers are the KJV's (the source marks them in [square brackets]).

Hebrew: TAHOT is the Leningrad Codex with a word per line. Words read (L, or Q, the Qere) and restored text (R) are
kept; extra words from other manuscripts (X, V) are not in the KJV and are left out.

Known limits, kept honest in the stats: a Greek word the TR places in a different order than Nestle-Aland keeps the
Nestle-Aland position; a TR variant the parser cannot read is left out and counted in stats["greek_variants_unread"].
"""
import re
import unicodedata
from pathlib import Path

CANTILLATION = re.compile("[֑-֯׀׃-׆]")   # accents and paseq: the letters and vowel points stay
EDITION_MARK = re.compile(r"[«»]\d*$")
GREEK_EDGE = ".,;:·¶·[]<>()⸀⸁⸂⸃⸄⸅ "

LINE = re.compile(r"^(\w{3})\.(\d+)\.(\d+)((?:[\[({][\d.]+[\])}])*)#(\d+)=(\S+)$")
KJV_REF = re.compile(r"\[(\d+)\.(\d+)\]")
STRONG_PLAIN = re.compile(r"^([GH])0*(\d+)[A-Za-z]*$")
VARIANT = re.compile(r"^(?P<gr>.+?)\s*\((?P<tag>[A-Za-z]*)=(?P<tr>[^)]*)\)\s*(?P<gloss>.*?)\s+-\s+(?=[GH]\d)"
                     r"(?P<tags>.+?)\s+in:\s*(?P<eds>.+)$")


def plain_strong(s):
    """G2424G -> G2424, H0157 -> H157; None if it is not a Strong's number."""
    m = STRONG_PLAIN.match((s or "").strip())
    return m.group(1) + m.group(2) if m else None


def editions(field):
    return {EDITION_MARK.sub("", t.strip()) for t in (field or "").split("+") if t.strip()}


def nfc(s):
    """The source mixes composed and decomposed accents; the rest of the app uses composed (see lexicon_import)."""
    return unicodedata.normalize("NFC", s or "")


def clean_greek(s):
    return nfc(s.strip(GREEK_EDGE).strip())


def book_ids(conn):
    return {r["code"]: r["id"] for r in conn.execute("SELECT id, code FROM books")}


def greek_alternatives(field):
    """The words the Textus Receptus has in place of this word, from the 'meaning variants' column, or None.

    The column reads  ὥσπερ (t=hōsper) as - G5618=CONJ in: TR+Byz  and several readings are joined by  ¦ .
    A reading of several words (ἐν τοῖς οὐρανοῖς) comes back as one item whose parts are joined by spaces and +.
    """
    for part in (field or "").split("¦"):
        m = VARIANT.match(part.strip())
        if not m or "TR" not in editions(m.group("eds")):
            continue
        tags = [t.strip() for t in m.group("tags").split(" + ")]
        pairs = [t.split("=", 1) for t in tags if "=" in t]
        strongs = [plain_strong(p[0]) for p in pairs]
        if not pairs or None in strongs:
            continue
        return {"original": clean_greek(m.group("gr")), "translit": m.group("tr").strip(), "gloss": m.group("gloss").strip(),
                "strongs": strongs, "morph": "+".join(p[1] for p in pairs), "lemma": ""}
    return None


def spelling_in_tr(field):
    """TR's own spelling of a word, when the 'spelling variants' column gives one (Tyn+WH: Δαυεὶδ ; +TR: Δαβὶδ ;)."""
    for seg in (field or "").split(";"):
        if ":" not in seg:
            continue
        eds, text = seg.split(":", 1)
        if "TR" in editions(eds.strip(" +")) and text.strip():
            return clean_greek(text)
    return None


def import_greek(conn, files):
    ids = book_ids(conn)
    stats = {"greek_words": 0, "greek_from_variants": 0, "greek_variants_unread": 0, "greek_skipped_not_tr": 0, "greek_unknown_book": 0}
    seq = {}
    rows = []
    for path in files:
        for line in Path(path).read_text(encoding="utf-8-sig").split("\n"):
            c = line.rstrip("\r").split("\t")
            m = LINE.match(c[0]) if len(c) > 5 else None
            if not m:
                continue
            code, ch, v, marks, _pos, _types = m.groups()
            book = ids.get(code.upper())
            if book is None:
                stats["greek_unknown_book"] += 1
                continue
            kjv = KJV_REF.search(marks)           # the KJV's own number where it differs from the source's
            ch, v = (int(kjv.group(1)), int(kjv.group(2))) if kjv else (int(ch), int(v))
            g = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", c[1].strip())
            original, translit = (g.group(1), g.group(2)) if g else (c[1], "")
            dm = re.match(r"^([GH]\d+[A-Za-z]*)=(.*)$", c[3].strip())
            strong = plain_strong(dm.group(1)) if dm else None
            if "TR" in editions(c[5]):
                if not strong:
                    continue
                word = {"original": clean_greek(spelling_in_tr(c[7] if len(c) > 7 else "") or original), "translit": translit.strip(),
                        "gloss": c[2].strip(), "strongs": [strong], "morph": dm.group(2).strip(),
                        "lemma": nfc(re.split(r"[,=]", c[4].strip())[0].strip())}
            else:
                alt = greek_alternatives(c[6] if len(c) > 6 else "")
                if alt:
                    word = alt
                    stats["greek_from_variants"] += 1
                else:
                    if re.search(r"[Kk]", _types) and (len(c) > 6 and "TR" in c[6]):
                        stats["greek_variants_unread"] += 1   # the TR has something here that the parser could not read
                    else:
                        stats["greek_skipped_not_tr"] += 1
                    continue
            if not word["original"]:
                continue
            key = (book, ch, v)
            seq[key] = seq.get(key, 0) + 1
            rows.append((book, ch, v, seq[key], "grk", word["original"], word["translit"], word["strongs"][0],
                         " ".join(word["strongs"]), word["morph"], word["lemma"], word["gloss"]))
            stats["greek_words"] += 1
    conn.executemany("INSERT INTO interlinear VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return stats


def clean_hebrew(s):
    s = s.replace("/", "").replace("\\", "").replace("׃", "")          # prefix joins, the verse-end mark
    s = CANTILLATION.sub("", s)
    return nfc(s.strip().rstrip("־"))                                  # no trailing maqaf


def import_hebrew(conn, files):
    ids = book_ids(conn)
    stats = {"hebrew_words": 0, "hebrew_skipped_other_manuscripts": 0, "hebrew_unknown_book": 0, "hebrew_no_strong": 0}
    seq = {}
    rows = []
    for path in files:
        for line in Path(path).read_text(encoding="utf-8-sig").split("\n"):
            c = line.rstrip("\r").split("\t")
            m = LINE.match(c[0]) if len(c) > 5 else None
            if not m:
                continue
            code, ch, v, _marks, _pos, types = m.groups()
            if types[0] not in "LQR":
                stats["hebrew_skipped_other_manuscripts"] += 1
                continue
            book = ids.get(code.upper())
            if book is None:
                stats["hebrew_unknown_book"] += 1
                continue
            if not clean_hebrew(c[1]):
                continue                                   # a blank placeholder line in the source
            main = re.search(r"\{([HA]?\d+[A-Za-z]*)\}", c[4]) or re.findall(r"([HA]?\d+[A-Za-z]*)", c[4])
            main = main.group(1) if hasattr(main, "group") else (main[-1] if main else "")
            strong = plain_strong("H" + main.lstrip("HA"))
            if not strong:
                stats["hebrew_no_strong"] += 1
            allstrongs = [plain_strong("H" + s.lstrip("HA")) for s in re.findall(r"[HA]?\d+[A-Za-z]*", c[4])]
            lemma = re.search(r"\{[HA]?\d+[A-Za-z]*=([^=}]+)=", c[11]) if len(c) > 11 else None
            key = (book, int(ch), int(v))
            seq[key] = seq.get(key, 0) + 1
            rows.append((book, int(ch), int(v), seq[key], "heb", clean_hebrew(c[1]), c[2].replace("/", "").replace("\\", "").strip(),
                         strong, " ".join(s for s in allstrongs if s), c[5].strip(), nfc(lemma.group(1)) if lemma else "",
                         re.sub(r"\s+", " ", c[3].replace("/", " ")).strip()))
            stats["hebrew_words"] += 1
    conn.executemany("INSERT INTO interlinear VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return stats


def import_morph_codes(conn, files):
    """Every full code with its plain-language expansion (the lines whose meaning starts 'Function=')."""
    n = 0
    for path in files:
        for line in Path(path).read_text(encoding="utf-8-sig").split("\n"):
            c = line.rstrip("\r").split("\t")
            if len(c) >= 2 and c[1].startswith("Function="):
                conn.execute("INSERT OR REPLACE INTO morph_codes VALUES (?, ?)", (c[0].strip(), c[1].strip()))
                n += 1
    return n
