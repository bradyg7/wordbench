"""Builds the dictionary database the Definitions tab and `wb word-define` read (docs/redesign-R5.md).

The source is Webster's Revised Unabridged Dictionary (1913), public domain, from Project Gutenberg (#29765, the 2009
text), parsed to JSON by matthewreagan/WebstersEnglishDictionary (headword -> entry text). Entries are kept verbatim.
The JSON is downloaded to a temporary file, not into this repository.

    python scripts/build-dictionary.py [--json FILE] [--out FILE]

--out defaults to WB_DICT_DB, else %LOCALAPPDATA%\\bible-workbench-rs\\dictionary.db (what wb-core opens).
"""
import argparse, json, os, sqlite3, sys, tempfile, urllib.request

URL = "https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json"
META = {
    "name": "Webster's Revised Unabridged Dictionary",
    "edition": "1913",
    "licence": "Public domain",
    "url": "https://www.gutenberg.org/ebooks/29765",
    "via": "Project Gutenberg #29765 (2009 text), as parsed to JSON by matthewreagan/WebstersEnglishDictionary",
}


def default_out():
    if os.environ.get("WB_DICT_DB"):
        return os.environ["WB_DICT_DB"]
    base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "bible-workbench-rs", "dictionary.db")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json")
    ap.add_argument("--out", default=default_out())
    a = ap.parse_args()
    path = a.json
    if not path:
        path = os.path.join(tempfile.mkdtemp(prefix="wb-dict-"), "dictionary_compact.json")
        print("downloading", URL)
        urllib.request.urlretrieve(URL, path)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    tmp = a.out + ".tmp"
    if os.path.exists(tmp):
        os.remove(tmp)
    db = sqlite3.connect(tmp)
    db.executescript(
        "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
        "CREATE TABLE entries (headword TEXT PRIMARY KEY, text TEXT NOT NULL) WITHOUT ROWID;"
    )
    db.executemany("INSERT INTO meta VALUES (?, ?)", META.items())
    db.executemany("INSERT INTO entries VALUES (?, ?)", ((k.lower(), v) for k, v in data.items() if v and v.strip()))
    db.commit()
    n = db.execute("SELECT count(*) FROM entries").fetchone()[0]
    db.close()
    os.replace(tmp, a.out)
    print(f"{n} entries -> {a.out}")


if __name__ == "__main__":
    sys.exit(main())
