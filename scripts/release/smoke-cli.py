"""Native customer CLI smoke checks with synthetic resources and isolated Windows state.

Usage: python scripts/release/smoke-cli.py --binary <distribution wb.exe>
No production issuer, personal study, downloaded dataset or installed application is used.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary', required=True, type=Path)
    args = parser.parse_args()
    binary = args.binary.resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix='wb-customer-cli-smoke-') as scratch:
        base = Path(scratch)
        install = base / 'app'
        resources = install / 'resources'
        resources.mkdir(parents=True)
        exe = install / 'wb.exe'
        shutil.copy2(binary, exe)
        elsewhere = base / 'unrelated-working-directory'
        elsewhere.mkdir()
        env = dict(os.environ)
        env['LOCALAPPDATA'] = str(base / 'local-app-data')
        env['WB_BIBLE_DB'] = str(base / 'developer-database-must-not-be-used')
        env['WB_DICT_DB'] = str(base / 'developer-dictionary-must-not-be-used')
        env['WB_STUDY_DIR'] = str(base / 'developer-study-must-not-be-created')
        env.pop('WB_ALLOW_REAL_STUDY', None)

        def run(*argv, success=True, alternate_env=None):
            result = subprocess.run([str(exe), *argv], cwd=elsewhere,
                                    env=alternate_env or env, text=True, encoding='utf-8',
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            if (result.returncode == 0) != success:
                raise AssertionError(f'{argv}: unexpected exit {result.returncode}: {result.stderr}')
            return result.stdout

        no_local = dict(env)
        no_local.pop('LOCALAPPDATA', None)
        info = json.loads(run('build-info', '--json', alternate_env=no_local))
        assert info['distribution'] is True, 'Requires a distribution-feature binary'
        assert isinstance(info['version'], str) and info['version']
        assert 'issuer_public_key' in info and 'issuer_key_id' in info
        assert not (base / 'local-app-data').exists(), 'build-info must be side-effect-free'

        inventory = []
        for name, schema in [
            ('workbench.db', 'CREATE TABLE books (id INTEGER, code TEXT, name TEXT, testament TEXT, chapters INTEGER);'),
            ('dictionary.db', 'CREATE TABLE meta (key TEXT, value TEXT); CREATE TABLE entries (headword TEXT, text TEXT);')
        ]:
            path = resources / name
            with closing(sqlite3.connect(path)) as db:
                db.executescript(schema)
            content = path.read_bytes()
            inventory.append({'name': name, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
        (resources / 'resources-manifest.json').write_text(json.dumps({
            'schema_version': 1, 'app_version': info['version'], 'files': inventory
        }), encoding='utf-8')
        initial = json.loads(run('setup'))
        assert initial['resources_ok'] and not initial['ready']
        study = base / 'study'
        run('setup', 'new', str(study))
        sentinel = study / 'personal-test-note.md'
        sentinel.write_text('Synthetic owner file; preserve exact bytes.\n', encoding='utf-8')
        before = sentinel.read_bytes()
        configured = json.loads(run('setup'))
        assert configured['ready'] and Path(configured['study_dir']).samefile(study)
        run('setup', 'new', str(study), success=False)
        run('setup', 'open', str(study))
        assert sentinel.read_bytes() == before
        assert not Path(env['WB_STUDY_DIR']).exists()
        assert not Path(env['WB_BIBLE_DB']).exists()
        request = run('license', 'request')
        assert request == run('license', 'request'), 'Device request must survive process restart'
        assert set(json.loads(request)) == {'payload', 'signature'}
        invalid = base / 'invalid-license.json'
        invalid.write_text('{}', encoding='utf-8')
        run('license', 'import', str(invalid), success=False)
        assert json.loads(run('license', 'status'))['active'] is False
        run('help', success=False)
        (resources / 'dictionary.db').write_bytes(b'damaged synthetic resource')
        damaged = json.loads(run('setup'))
        assert not damaged['resources_ok'] and not damaged['ready']
        assert Path(damaged['study_dir']).samefile(study)
        run('setup', 'new', str(base / 'must-not-be-created'), success=False)
        assert not (base / 'must-not-be-created').exists()
        shutil.rmtree(resources)
        recovery = json.loads(run('license', 'recovery'))
        assert Path(recovery['study_dir']).samefile(study)
        assert sentinel.read_bytes() == before
        assert not (base / 'local-app-data' / 'bible-workbench-rs' / 'installation' / 'licensing' / 'license.json').exists()
        print(json.dumps({'status': 'passed', 'version': info['version'], 'checks': [
            'side-effect-free build identity', 'unrelated working directory', 'packaged resources',
            'developer overrides ignored', 'new/existing study setup', 'existing bytes preserved',
            'DPAPI request stable across processes', 'invalid activation rejected',
            'unactivated command gate', 'corrupt resource rejection', 'recovery with missing resources'
        ]}))


if __name__ == '__main__':
    main()
