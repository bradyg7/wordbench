"""Read-only data audit. JSON evidence is not redistribution approval.

python scripts/release/audit-data.py --raw PATH --bible PATH --dictionary PATH --out NEW.json
Inputs are optional individually; omitted inputs are explicitly reported unverified.
No source text, definition text, personal study files, or absolute paths enter the report.
"""
import argparse
from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/data'))


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bible = load_module('bible_builder', ROOT / 'scripts/data/build-bible.py')
dictionary = load_module('dictionary_builder', ROOT / 'scripts/build-dictionary.py')


def digest(path):
    return bible.file_digest(path)


def audit(raw=None, bible_path=None, dictionary_path=None):
    lock = json.loads((ROOT / 'data/bible-sources.lock.json').read_text(encoding='utf-8-sig'))
    review = json.loads((ROOT / 'distribution/evidence/source-review.json').read_text(encoding='utf-8-sig'))
    locked = {r['file']: (r['bytes'], r['sha256']) for r in lock['inputs']}
    reviewed = {r['file']: (r['bytes'], r['sha256']) for r in review['inputs']}
    if len(reviewed) != len(review['inputs']) or reviewed != locked:
        raise ValueError('Source review no longer matches the Bible input lock.')
    if (review['dictionary']['sha256'], review['dictionary']['entriesSha256'], review['dictionary']['entries']) != (dictionary.SOURCE_SHA256, dictionary.ENTRIES_SHA256, dictionary.EXPECTED_ENTRIES):
        raise ValueError('Source review no longer matches the dictionary builder.')
    report = {'schemaVersion': 1, 'redistribution': 'unreviewed', 'sourceReviewSha256': digest(ROOT / 'distribution/evidence/source-review.json'), 'bibleLockSha256': digest(ROOT / 'data/bible-sources.lock.json'), 'inputs': {'status': 'not-supplied'}, 'bible': {'status': 'not-supplied'}, 'dictionary': {'status': 'not-supplied'}}
    if raw is not None:
        bible.verify_inputs(raw, lock['inputs'])
        report['inputs'] = {'status': 'verified', 'files': lock['inputs']}
    if bible_path is not None:
        bible_path = bible_path.resolve(strict=True)
        bible.verify_database(bible_path, lock['tables'])
        # Reject unexpected tables: the artifact must not contain added personal
        # data or a source omitted from the reviewed schema.
        with closing(sqlite3.connect(bible_path.as_uri() + '?mode=ro', uri=True)) as conn:
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        if tables != set(lock['tables']):
            raise ValueError('Bible database has unexpected tables.')
        report['bible'] = {'status': 'verified', 'bytes': bible_path.stat().st_size, 'sha256': digest(bible_path), 'schemaVersion': bible.SCHEMA_VERSION, 'tables': lock['tables']}
    if dictionary_path is not None:
        dictionary_path = dictionary_path.resolve(strict=True)
        with closing(sqlite3.connect(dictionary_path.as_uri() + '?mode=ro', uri=True)) as conn:
            if conn.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
                raise ValueError('Dictionary failed SQLite integrity check.')
            if conn.execute('PRAGMA user_version').fetchone() != (1,):
                raise ValueError('Dictionary schema is not the direct-source build schema.')
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
            if tables != {'meta', 'entries'}:
                raise ValueError('Dictionary database has unexpected tables.')
            meta = dict(conn.execute('SELECT key,value FROM meta'))
            if meta != dictionary.META:
                raise ValueError('Dictionary metadata does not match the reviewed direct source.')
            entries = dict(conn.execute('SELECT headword,text FROM entries ORDER BY headword'))
            if len(entries) != dictionary.EXPECTED_ENTRIES or dictionary.entries_digest(entries) != dictionary.ENTRIES_SHA256:
                raise ValueError('Dictionary entries differ from the reviewed fingerprint.')
        report['dictionary'] = {'status': 'verified', 'bytes': dictionary_path.stat().st_size, 'sha256': digest(dictionary_path), 'schemaVersion': 1, 'entries': len(entries), 'entriesSha256': dictionary.ENTRIES_SHA256, 'sourceSha256': dictionary.SOURCE_SHA256}
    report['bundledExportFonts'] = [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in sorted((ROOT / 'crates/wb-core/fonts').iterdir()) if p.suffix == '.woff' or p.name.startswith('LICENSE-')]
    report['openReleaseConditions'] = review['openReleaseConditions']
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw', type=Path)
    parser.add_argument('--bible', type=Path)
    parser.add_argument('--dictionary', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    try:
        value = audit(args.raw, args.bible, args.dictionary)
        text = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
        if args.out:
            with args.out.open('x', encoding='utf-8') as stream:
                stream.write(text)
            print(f'Wrote read-only audit evidence to {args.out}; redistribution remains unreviewed.')
        else:
            print(text, end='')
    except (OSError, ValueError, KeyError, sqlite3.Error) as exc:
        parser.exit(1, f'Data audit failed: {exc}\n')


if __name__ == '__main__':
    main()
