"""Builds the dictionary database the Definitions tab and `wb word-define` read (docs/redesign-R5.md).

The source is the 2009 Project Gutenberg #29765 text as parsed by matthewreagan/WebstersEnglishDictionary.
Download the pinned JSON or provide an exact local copy. Entries are kept verbatim.

    python scripts/build-dictionary.py [--json FILE] [--out FILE]

--out defaults to WB_DICT_DB, else %LOCALAPPDATA%\\bible-workbench-rs\\dictionary.db (what wb-core opens).
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import urllib.request

REVISION = "6fb9c92420c3a323e74ffb9d577409f4431cc42a"
URL = f"https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/{REVISION}/dictionary_compact.json"
SOURCE_SHA256 = "16b12847a47cc1202e5e40a3a44b9ed2f749d23c0a5f0ad11fcbd4e8c6c3e33d"
EXPECTED_ENTRIES = 102_217
META = {
    "name": "Webster's Revised Unabridged Dictionary",
    "edition": "1913",
    "licence": "See Project Gutenberg terms for the source text and the parser repository's license notice for its output.",
    "url": "https://www.gutenberg.org/ebooks/29765",
    "via": "Project Gutenberg #29765 (2009 text), as parsed to JSON by matthewreagan/WebstersEnglishDictionary",
    "source_url": URL,
    "source_sha256": SOURCE_SHA256,
}


def default_out():
    if os.environ.get("WB_DICT_DB"):
        return os.environ["WB_DICT_DB"]
    base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "bible-workbench-rs", "dictionary.db")


def build(source, out):
    out = out.absolute()
    if source is not None and source.resolve() == out.resolve():
        raise ValueError("The dictionary output must be different from its JSON input.")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".wb-dict-", dir=out.parent) as temp:
        temp = Path(temp)
        if source is None:
            source = temp / "dictionary_compact.json"
            print("Downloading", URL)
            urllib.request.urlretrieve(URL, source)

        raw = source.read_bytes()
        if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
            raise ValueError(f"SHA-256 mismatch for {source}. Use the JSON from the pinned revision.")
        data = json.loads(raw)
        candidate = temp / "dictionary.db"
        with closing(sqlite3.connect(candidate)) as db:
            db.executescript(
                "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
                "CREATE TABLE entries (headword TEXT PRIMARY KEY, text TEXT NOT NULL) WITHOUT ROWID;"
            )
            db.executemany("INSERT INTO meta VALUES (?, ?)", META.items())
            db.executemany("INSERT INTO entries VALUES (?, ?)", ((k.lower(), v) for k, v in data.items() if v and v.strip()))
            db.commit()
            count = db.execute("SELECT count(*) FROM entries").fetchone()[0]
            if count != EXPECTED_ENTRIES or db.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                raise ValueError("Built dictionary failed entry count or SQLite integrity verification.")
        os.replace(candidate, out)
    print(f"{count} entries -> {out}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--out", type=Path, default=default_out())
    args = parser.parse_args()
    try:
        build(args.json, args.out)
    except (OSError, ValueError, sqlite3.Error) as exc:
        parser.exit(1, f"Dictionary build failed: {exc}\n")


if __name__ == "__main__":
    main()
