"""Build and verify the Rust app's Bible database from a locked local input set."""

import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

# A provisioned database should be the only persistent build output.
sys.dont_write_bytecode = True

import bdb_import
import interlinear_import
import kjv_import
import lexicon_import
import version_import

HERE = Path(__file__).resolve().parent
LOCK = HERE.parents[1] / "data" / "bible-sources.lock.json"
SCHEMA_VERSION = 1
TABLE_ORDER = {
    "books": "id",
    "chapter_titles": "book, chapter",
    "verses": "book, chapter, verse",
    "words": "book, chapter, verse, idx",
    "footnotes": "book, chapter, verse, after_idx, rowid",
    "versions": "id",
    "verse_texts": "version, book, chapter, verse",
    "lexicon": "strong",
    "interlinear": "book, chapter, verse, seq",
    "morph_codes": "code",
    "bdb": "strong, seq",
}


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_inputs(raw, inputs):
    paths = {}
    for item in inputs:
        name = item["file"]
        path = raw / name
        if not path.is_file():
            raise ValueError(f"Missing locked Bible input: {path}")
        if path.stat().st_size != item["bytes"] or file_digest(path) != item["sha256"]:
            raise ValueError(f"Size or SHA-256 mismatch for locked Bible input: {path}")
        paths[name] = path
    return paths


def select_inputs(paths, *prefixes):
    return [paths[name] for name in sorted(paths) if name.startswith(prefixes)]


def populate(conn, paths):
    conn.row_factory = sqlite3.Row
    conn.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    kjv_import.import_kjv(conn, paths["eng-kjv2006_usfm.zip"])
    conn.execute(
        "INSERT INTO versions VALUES (?, ?, ?, ?)",
        ("KJV", "King James Version (1769 text, eBible 2006 edition, Strong's-tagged)", "Public Domain", 1),
    )
    version_import.import_json_version(
        conn, paths["ylt.json"], "YLT", "Young's Literal Translation (1898)", "Public Domain"
    )
    lexicon_import.import_greek(conn, paths["strongsgreek.xml"])
    lexicon_import.import_hebrew(conn, paths["HebrewStrong.xml"])
    bdb_import.import_bdb(conn, paths["BrownDriverBriggs.xml"], paths["LexicalIndex.xml"])
    interlinear_import.import_greek(conn, select_inputs(paths, "TAGNT "))
    interlinear_import.import_hebrew(conn, select_inputs(paths, "TAHOT "))
    interlinear_import.import_morph_codes(conn, select_inputs(paths, "TEGMC ", "TEHMC "))
    conn.commit()


def verify_database(path, expected_tables):
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as conn:
        if conn.execute("PRAGMA user_version").fetchone() != (SCHEMA_VERSION,):
            raise ValueError("Unexpected Bible database schema version")
        if conn.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
            raise ValueError("Bible database failed SQLite quick_check")
        if expected_tables.keys() != TABLE_ORDER.keys():
            raise ValueError("Locked Bible table inventory does not match the schema")
        for table, columns in TABLE_ORDER.items():
            rows = 0
            digest = hashlib.sha256()
            for row in conn.execute(f"SELECT * FROM {table} ORDER BY {columns}"):
                encoded = json.dumps(row, ensure_ascii=False, separators=(",", ":"))
                digest.update((encoded + "\n").encode("utf-8"))
                rows += 1
            if {"rows": rows, "sha256": digest.hexdigest()} != expected_tables[table]:
                raise ValueError(f"Bible table {table} differs from the reference database ({rows} rows)")


def build(raw, out):
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    if lock["lock_version"] != 1:
        raise ValueError("Unsupported Bible source lock version")
    out = out.absolute()
    if out.exists() or out.is_symlink():
        raise FileExistsError(f"Output already exists: {out}. Choose a new output path.")
    paths = verify_inputs(raw, lock["inputs"])
    out.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".workbench-build-", suffix=".db", dir=out.parent)
    candidate = Path(name)
    try:
        os.close(fd)
        with closing(sqlite3.connect(candidate)) as conn:
            populate(conn, paths)
        verify_database(candidate, lock["tables"])
        # Publish a complete file without overwriting an existing database, even if two builds race.
        if os.name == "nt":
            candidate.rename(out)
        else:
            os.link(candidate, out)
    finally:
        candidate.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, required=True, help="Folder containing the exact locked input files")
    parser.add_argument("--out", type=Path, required=True, help="Path to a new SQLite database")
    args = parser.parse_args()
    try:
        build(args.raw, args.out)
    except (OSError, ValueError, sqlite3.Error) as exc:
        parser.exit(1, f"Bible database build failed: {exc}\n")
    print(f"Built and verified Bible schema {SCHEMA_VERSION}: {args.out}")


if __name__ == "__main__":
    main()
