"""Load the Strong's Greek (CC0) and Hebrew (CC BY 4.0) dictionaries into the lexicon table.

Cross-references inside entries become [[H123]] / [[G123]] tokens that the UI turns into links.
"""
import re
import unicodedata
import xml.etree.ElementTree as ET

XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"


def local(tag):
    return tag.split("}")[-1]


def norm_ref(prefix, num):
    digits = re.sub(r"\D", "", num)
    return prefix + str(int(digits)) if digits else prefix + num


def nfc(s):
    return unicodedata.normalize("NFC", s or "")


def clean(s):
    s = nfc(re.sub(r"\s+", " ", s).strip())
    return re.sub(r"\s+([,;:.)])", r"\1", s)


def render_child(ch):
    tag = local(ch.tag)
    if tag == "strongsref":
        return "[[%s]]" % norm_ref("H" if ch.get("language") == "HEBREW" else "G", ch.get("strongs"))
    if tag == "w" and ch.get("src"):
        src = ch.get("src")
        return "[[%s]]" % norm_ref(src[0] if src[0] in "HG" else "H", src)
    if tag == "greek":
        return ch.get("unicode") or ""
    return flat(ch)


def flat(el):
    """Render mixed content as text with [[ref]] tokens."""
    parts = [el.text or ""]
    for ch in el:
        parts.append(render_child(ch))
        parts.append(ch.tail or "")
    return "".join(parts)


def import_greek(conn, path):
    root = ET.parse(path).getroot()
    n = 0
    for entry in root.iter("entry"):
        sid = norm_ref("G", entry.get("strongs"))
        lemma = translit = pron = deriv = defn = usage = ""
        extra = [entry.text or ""]
        seen_greek = False
        for ch in entry:
            tag = local(ch.tag)
            if tag == "greek" and not seen_greek:
                seen_greek = True
                lemma, translit = nfc(ch.get("unicode")), nfc(ch.get("translit"))
            elif tag == "pronunciation":
                pron = ch.get("strongs") or ""
            elif tag == "strongs_derivation":
                deriv = clean(flat(ch))
            elif tag == "strongs_def":
                defn = clean(flat(ch))
            elif tag == "kjv_def":
                usage = clean(flat(ch)).lstrip(":-– ").strip()
            elif tag != "strongs":
                extra.append(render_child(ch))   # inline reference inside the trailing prose
            extra.append(ch.tail or "")
        conn.execute("INSERT INTO lexicon VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (sid, "grk", lemma, translit, pron, None, deriv, defn, usage, clean("".join(extra)) or None))
        n += 1
    return n


def import_hebrew(conn, path):
    root = ET.parse(path).getroot()
    n = 0
    for entry in root.iter():
        if local(entry.tag) != "entry":
            continue
        sid = norm_ref("H", entry.get("id"))
        lemma = translit = pron = pos = deriv = defn = usage = ""
        lang = "heb"
        for ch in entry:
            tag = local(ch.tag)
            if tag == "w" and not lemma:
                lemma = clean(flat(ch))
                translit, pron, pos = nfc(ch.get("xlit")), ch.get("pron") or "", ch.get("pos") or ""
                lang = {"heb": "heb", "arc": "arc"}.get(ch.get(XML_LANG), "other")
            elif tag == "source":
                deriv = clean(flat(ch))
            elif tag == "meaning":
                defn = clean(flat(ch))
            elif tag == "usage":
                usage = clean(flat(ch))
        conn.execute("INSERT INTO lexicon VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (sid, lang, lemma, translit, pron, pos, deriv, defn, usage, None))
        n += 1
    return n
