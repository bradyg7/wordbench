"""Build dictionary.db directly from the pinned original Webster text.

    python scripts/build-dictionary.py [--text pg29765.txt] [--out dictionary.db]

The independent parser retains complete source entry blocks and all duplicate
senses. It does not consume the GPL-licensed third-party JSON used previously.
The source's US public-domain status does not establish rights in other places.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import urllib.request

URL = "https://www.gutenberg.org/ebooks/29765.txt.utf-8"
SOURCE_SHA256 = "86fb9c28c32008ea288ca4bcf34f4f0d3d11ccf9e0898294d98b73671497f1d3"
EXPECTED_ENTRIES = 102_572
ENTRIES_SHA256 = "684a791db6c38408129d9e9decf4c22d06cd0bbb8eca7d4a87d3d392dee5be40"
START = "*** START OF THE PROJECT GUTENBERG EBOOK WEBSTER'S UNABRIDGED DICTIONARY ***"
END = "*** END OF THE PROJECT GUTENBERG EBOOK WEBSTER'S UNABRIDGED DICTIONARY ***"
HEADINGS = re.compile(r"(?:\A|(?<=\n\n))(-?[A-Z][A-Z0-9 ;,'.()&/-]*(?:\n-?[A-Z][A-Z0-9 ;,'.()&/-]*)*)\n(?=\S)", re.MULTILINE)
META = {
    "name": "Webster's Revised Unabridged Dictionary",
    "edition": "1913",
    "licence": "Original dictionary text: public domain in the United States. Other territories require review. See the source acknowledgment and distribution notices.",
    "url": "https://www.gutenberg.org/ebooks/29765",
    "via": "Source acknowledgment: Project Gutenberg #29765, credited to Graham Lawrence; text revision July 6, 2025. Independently indexed by Bible Workbench.",
    "source_url": URL,
    "source_sha256": SOURCE_SHA256,
    "entries_sha256": ENTRIES_SHA256,
    "parser_version": "webster-original-v1",
}


def default_out():
    if os.environ.get("WB_DICT_DB"):
        return os.environ["WB_DICT_DB"]
    base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "bible-workbench-rs", "dictionary.db")


def parse_entries(raw):
    # Preserve entry wording, punctuation and line wrapping. Normalize only the
    # transport line endings. The pinned file uses CR-CR-LF, not ordinary CR-LF.
    text = raw.decode("utf-8-sig").replace("\r\r\n", "\n").replace("\r\n", "\n")
    if text.count(START) != 1 or text.count(END) != 1:
        raise ValueError("Expected exactly one original-text start and end marker.")
    body = text.split(START, 1)[1].split(END, 1)[0].strip()
    if "project gutenberg" in body.casefold():
        raise ValueError("Unexpected trademark/license text inside dictionary entries; review source.")
    headings = []
    for match in HEADINGS.finditer(body):
        heading = match.group(1)
        # Original entry headings are separated by a blank line. Internal
        # chemistry/Morse tables also use uppercase, but their aligned columns,
        # repeated dashes, or numeric formulas are not dictionary headwords.
        if re.search(r" {2,}|--", heading):
            continue
        if re.search(r"[0-9]", heading) and heading != "A 1":
            continue
        headings.append(match)
    if not headings or headings[0].start() != 0:
        raise ValueError("Dictionary body does not begin with a recognized entry.")
    entries = {}
    for i, heading in enumerate(headings):
        stop = headings[i + 1].start() if i + 1 < len(headings) else len(body)
        entry = body[heading.end():stop].strip()
        if not entry:
            raise ValueError("Empty dictionary entry.")
        # Semicolon-separated aliases share the exact same complete block.
        # Repeated headwords retain every sense in source order.
        for alias in heading.group(1).replace("\n", " ").split(";"):
            key = alias.strip().lower()
            if not key:
                raise ValueError("Empty dictionary headword.")
            entries.setdefault(key, []).append(entry)
    return {key: "\n\n".join(blocks) for key, blocks in entries.items()}


def entries_digest(entries):
    digest = hashlib.sha256()
    for key, value in sorted(entries.items()):
        digest.update((json.dumps([key, value], ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))
    return digest.hexdigest()


def build(source, out):
    out = out.absolute()
    if out.exists() or out.is_symlink():
        raise FileExistsError(f"Output already exists: {out}. Choose a new path; existing dictionaries are never overwritten.")
    if source is not None and source.resolve() == out.resolve():
        raise ValueError("The dictionary output must differ from its input.")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".wb-dict-", dir=out.parent) as temp:
        temp = Path(temp)
        if source is None:
            source = temp / "pg29765.txt"
            print("Downloading", URL)
            urllib.request.urlretrieve(URL, source)
        raw = source.read_bytes()
        if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
            raise ValueError("Source SHA-256 mismatch. Use the reviewed text snapshot; do not silently accept an upstream update.")
        entries = parse_entries(raw)
        if len(entries) != EXPECTED_ENTRIES or entries_digest(entries) != ENTRIES_SHA256:
            raise ValueError("Parsed dictionary differs from the reviewed entry count or fingerprint.")
        candidate = temp / "dictionary.db"
        with closing(sqlite3.connect(candidate)) as db:
            db.executescript("PRAGMA user_version = 1; CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE entries (headword TEXT PRIMARY KEY, text TEXT NOT NULL) WITHOUT ROWID;")
            db.executemany("INSERT INTO meta VALUES (?, ?)", META.items())
            db.executemany("INSERT INTO entries VALUES (?, ?)", sorted(entries.items()))
            db.commit()
            if db.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                raise ValueError("Built dictionary failed SQLite integrity verification.")
        # Atomic publication without overwriting another process's output.
        if os.name == "nt":
            candidate.rename(out)
        else:
            os.link(candidate, out)
    print(f"{len(entries)} entries -> {out}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", type=Path)
    parser.add_argument("--json", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--out", type=Path, default=default_out())
    args = parser.parse_args()
    if args.json is not None:
        parser.error("The old third-party JSON is GPL-licensed and is no longer a build input. Use --text with the pinned original Webster source; existing databases remain readable.")
    try:
        build(args.text, args.out)
    except (OSError, ValueError, sqlite3.Error) as exc:
        parser.exit(1, f"Dictionary build failed: {exc}\n")


if __name__ == "__main__":
    main()
