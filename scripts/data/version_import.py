"""Load another translation as verse text only. Word-level anchors, Strong's tags and notes stay on the KJV;
another version is for reading and comparing a verse beside it."""
import json
import re


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def import_json_version(conn, path, version_id, name, license_):
    """Import a Scrollmapper-style JSON file (books > chapters > verses). The 66 books are matched to ours by their
    canonical order; names are compared and any difference is reported. Returns a stats dict."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    ours = conn.execute("SELECT id, name FROM books ORDER BY id").fetchall()
    theirs = data["books"]
    if len(theirs) != len(ours):
        raise ValueError("%s has %d books, expected %d" % (version_id, len(theirs), len(ours)))
    stats = {"verses": 0, "name_differences": [], "not_in_kjv": [], "missing_from_version": 0}
    conn.execute("INSERT INTO versions VALUES (?,?,?,0)", (version_id, name, license_))
    for mine, tb in zip(ours, theirs):
        if _norm(tb["name"]) != _norm(mine["name"]):
            stats["name_differences"].append((mine["name"], tb["name"]))
        for ch in tb["chapters"]:
            for v in ch["verses"]:
                text = re.sub(r"\s+", " ", v["text"]).strip()
                if not text:
                    continue
                if conn.execute("SELECT 1 FROM verses WHERE book=? AND chapter=? AND verse=?",
                                (mine["id"], ch["chapter"], v["verse"])).fetchone() is None:
                    stats["not_in_kjv"].append((mine["name"], ch["chapter"], v["verse"]))
                conn.execute("INSERT OR REPLACE INTO verse_texts VALUES (?,?,?,?,?)",
                             (version_id, mine["id"], ch["chapter"], v["verse"], text))
                stats["verses"] += 1
    stats["missing_from_version"] = conn.execute(
        "SELECT COUNT(*) FROM verses k LEFT JOIN verse_texts t ON t.version = ? AND t.book = k.book "
        "AND t.chapter = k.chapter AND t.verse = k.verse WHERE t.verse IS NULL", (version_id,)).fetchone()[0]
    conn.commit()
    return stats
