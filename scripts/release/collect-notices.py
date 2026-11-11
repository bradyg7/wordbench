"""Collect local package license/notice texts and locked identities for review.

python -B scripts/release/collect-notices.py --out NEW_DIRECTORY
Requires cargo metadata and npm ci. Never downloads or approves redistribution.
Includes build dependencies conservatively; excludes development-only graph edges.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def collect(output):
    if output.exists():
        raise FileExistsError('Choose a new notices directory.')
    raw = subprocess.check_output(['cargo', 'metadata', '--format-version', '1', '--locked',
                                   '--filter-platform', 'x86_64-pc-windows-msvc',
                                   '--features', 'bible-workbench/distribution,wb-cli/distribution'], cwd=ROOT)
    metadata = json.loads(raw)
    packages = {p['id']: p for p in metadata['packages']}
    nodes = {p['id']: p for p in metadata['resolve']['nodes']}
    queue = [p['id'] for p in packages.values() if p['source'] is None and p['name'] in ['bible-workbench', 'wb-cli']]
    seen = set()
    while queue:
        identifier = queue.pop()
        if identifier in seen:
            continue
        seen.add(identifier)
        for dep in nodes[identifier]['deps']:
            if any(kind['kind'] != 'dev' for kind in dep['dep_kinds']):
                queue.append(dep['pkg'])
    output.mkdir(parents=True)
    records = []

    def capture(kind, name, version, license_name, source, directory, explicit=None, features=None):
        directory = directory.resolve()
        candidates = [p for p in directory.iterdir() if p.is_file() and re.match(r'(?i)^(licen[sc]e|copying|notice|copyright)([._-]|$)', p.name)]
        for sub in ['licenses', 'LICENSES']:
            folder = directory / sub
            if folder.is_dir():
                candidates.extend(p for p in folder.rglob('*') if p.is_file())
        if explicit:
            candidates.append(directory / explicit)
        texts = []
        for path in sorted(set(candidates)):
            resolved = path.resolve(strict=True)
            rel = resolved.relative_to(directory)
            content = resolved.read_bytes()
            destination = Path(kind) / (name.replace('/', '__') + '-' + version) / rel
            target = output / destination
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            texts.append({'path': destination.as_posix(), 'sha256': hashlib.sha256(content).hexdigest()})
        records.append({'kind': kind, 'name': name, 'version': version, 'license': license_name or 'UNKNOWN', 'source': source, 'features': features or [], 'texts': texts, 'review': 'unreviewed' if texts and license_name else 'missing-license-evidence'})

    for identifier in sorted(seen):
        package = packages[identifier]
        if package['source']:
            capture('rust', package['name'], package['version'], package['license'], package['source'], Path(package['manifest_path']).parent, package.get('license_file'), nodes[identifier]['features'])
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
    for location, package in sorted(lock['packages'].items()):
        if not location or package.get('dev'):
            continue
        folder = ROOT / location
        manifest = json.loads((folder / 'package.json').read_text(encoding='utf-8'))
        if manifest['version'] != package['version']:
            raise ValueError('Installed npm package differs from lock.')
        capture('javascript', manifest['name'], manifest['version'], manifest.get('license'), package.get('resolved'), folder)
    fonts = ROOT / 'crates/wb-core/fonts'
    for path in fonts.glob('LICENSE-*'):
        target = output / 'export-fonts' / path.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(path.read_bytes())
    report = {'schemaVersion': 1, 'target': 'x86_64-pc-windows-msvc', 'features': ['distribution'], 'status': 'collected-not-approved', 'cargoLockSha256': hashlib.sha256((ROOT / 'Cargo.lock').read_bytes()).hexdigest(), 'npmLockSha256': hashlib.sha256((ROOT / 'package-lock.json').read_bytes()).hexdigest(), 'packages': records, 'openConditions': ['Review missing evidence and package-specific obligations.', 'Review Microsoft WebView2 offline runtime redistribution terms separately.', 'Review static and export font attribution and reserved names.', 'Build dependencies are conservatively included; this inventory is not a binary composition proof.']}
    (output / 'inventory.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    sections = ['THIRD-PARTY NOTICES DRAFT - NOT RELEASE APPROVED',
                'Generated from local package evidence. Resolve missing texts and review runtime/territory obligations before shipping.',
                (ROOT / 'distribution/notices/data-notices.txt').read_text(encoding='utf-8')]
    for record in records:
        sections.append(f"{record['kind']}: {record['name']} {record['version']} - {record['license']}\nSource: {record['source']}")
        if not record['texts']:
            sections.append('MISSING ORIGINAL LICENSE/NOTICE TEXT - RELEASE REVIEW REQUIRED')
        for item in record['texts']:
            sections.append(item['path'] + '\n' + (output / item['path']).read_text(encoding='utf-8-sig'))
    for path in sorted((output / 'export-fonts').glob('*')):
        sections.append(path.name + '\n' + path.read_text(encoding='utf-8-sig'))
    (output / 'third-party-notices.draft.txt').write_text('\n\n'.join(sections) + '\n', encoding='utf-8')
    print(json.dumps({'packages': len(records), 'missingLicenseEvidence': sum(p['review'] == 'missing-license-evidence' for p in records), 'status': report['status']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    collect(args.out)
