"""Load Brown-Driver-Briggs (public-domain text, CC BY 4.0 markup from Open Scriptures) into the bdb table.

LexicalIndex.xml says which BDB entries belong to which Strong's number; BrownDriverBriggs.xml holds the entries.
An entry is flattened to plain text: nothing is reworded, sense numbers start new lines, and the Hebrew, the
abbreviations and the reference text (e.g. "Jb 8:12") are kept exactly as printed.
"""
import re
import unicodedata
import xml.etree.ElementTree as ET

NS = "{http://openscriptures.github.com/morphhb/namespace}"
SKIP = {"status", "page"}


def _local(tag):
    return tag.split("}")[-1]


def _flat(el):
    out = [el.text or ""]
    for ch in el:
        out.append(_flat(ch) if _local(ch.tag) not in SKIP else "")
        out.append(ch.tail or "")
    return "".join(out)


def _render(el, depth):
    """Entry or sense content as text; each sense starts a new, indented line carrying its number."""
    parts = [el.text or ""]
    for ch in el:
        tag = _local(ch.tag)
        if tag == "sense":
            n = ch.get("n")
            parts.append("\n" + "  " * depth + (n + ". " if n else "") + _render(ch, depth + 1).strip())
        elif tag not in SKIP:
            parts.append(_flat(ch))
        parts.append(ch.tail or "")
    return "".join(parts)


def parse_entries(path):
    """{bdb id: (headword, text, status)}"""
    root = ET.parse(path).getroot()
    out = {}
    for entry in root.iter(NS + "entry"):
        eid = entry.get("id")
        w = entry.find(NS + "w")
        head = unicodedata.normalize("NFC", _flat(w).strip()) if w is not None else ""
        raw = _render(entry, 1)
        lines = []
        for ln in raw.split("\n"):
            body = re.sub(r"[ \t\r\n]+", " ", ln).strip()
            if body:
                lead = len(ln) - len(ln.lstrip(" "))
                lines.append(" " * lead + body)
        st = entry.find(NS + "status")
        out[eid] = (head, unicodedata.normalize("NFC", "\n".join(lines)), (st.text or "").strip() if st is not None else "")
    return out


def parse_index(path):
    """[(strong 'H123', bdb id)] in file order, numeric Strong's numbers only."""
    root = ET.parse(path).getroot()
    pairs = []
    for xref in root.iter(NS + "xref"):
        s, b = xref.get("strong"), xref.get("bdb")
        if s and b and s.isdigit():
            pairs.append(("H" + str(int(s)), b))
    return pairs


def import_bdb(conn, bdb_path, index_path):
    entries = parse_entries(bdb_path)
    known = {r[0] for r in conn.execute("SELECT strong FROM lexicon WHERE strong LIKE 'H%'")}
    seen, seq, n = set(), {}, 0
    for strong, eid in parse_index(index_path):
        if strong not in known or eid not in entries or (strong, eid) in seen:
            continue
        seen.add((strong, eid))
        seq[strong] = seq.get(strong, 0) + 1
        head, text, status = entries[eid]
        conn.execute("INSERT INTO bdb VALUES (?,?,?,?,?,?)", (strong, seq[strong], eid, head, text, status))
        n += 1
    return n
