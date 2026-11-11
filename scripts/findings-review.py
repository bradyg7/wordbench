"""Prepare or publish a local findings review. Windows, Python standard library only."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import msvcrt
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FINDINGS = Path.home() / "github" / "bible-study-data" / "findings"
DEFAULT_OUTPUT = ROOT / ".findings-review"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True).encode("utf-8")


def atomic_write(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp_path = Path(tmp.name)
        try:
            tmp.write(data)
            tmp.flush()
            os.fsync(tmp.fileno())
            tmp.close()
            tmp_path.replace(path)
        finally:
            tmp_path.unlink(missing_ok=True)


@contextmanager
def locked(output):
    output.mkdir(parents=True, exist_ok=True)
    with (output / "review.lock").open("a+b") as lock:
        lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        yield


def scan(folder):
    found = {}
    for file in sorted(folder.iterdir()):
        if not file.is_file() or file.suffix != ".md":
            continue
        raw = file.read_bytes()
        _, header, _ = raw.decode("utf-8-sig").split("---", 2)
        match = re.search(r'^id:\s*"?(f_[0-9]+_[a-f0-9]+)"?\s*$', header, re.MULTILINE)
        if not match:
            raise ValueError(f"Invalid finding ID in {file.name}")
        finding_id = match[1]
        record = {"file": file.name, "sha256": digest(raw)}
        if finding_id in found:
            if found[finding_id]["sha256"] != record["sha256"]:
                raise ValueError(f"Conflicting files for {finding_id}")
            continue
        found[finding_id] = record
    return found


def prepare(folder, output):
    state = output / "seen.json"
    seen = json.loads(state.read_text(encoding="utf-8")) if state.exists() else {}
    changed = {
        key: record for key, record in scan(folder).items()
        if seen.get(key) != record["sha256"]
    }
    hashes = {key: record["sha256"] for key, record in changed.items()}
    return {
        "revision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "batch": digest(encode(hashes)) if hashes else None,
        "changed": changed,
    }, {**seen, **hashes}


def review(args):
    with locked(args.output):
        pending = args.output / "pending.json"
        state = args.output / "seen.json"
        if pending.exists():
            saved = json.loads(pending.read_text(encoding="utf-8"))
            if (args.output / saved["draft"]).is_file():
                atomic_write(state, encode(saved["seen"]))
            pending.unlink()

        batch, next_seen = prepare(args.findings, args.output)
        if args.publish:
            if args.batch != batch["batch"]:
                raise ValueError("Batch changed. Prepare a fresh review before publishing.")
            published = args.output / f'{batch["batch"]}.md'
            if not published.exists():
                data = args.publish.read_bytes()
                if not data.strip():
                    raise ValueError("Draft is empty")
                atomic_write(pending, encode({"draft": published.name, "seen": next_seen}))
                atomic_write(published, data)
            atomic_write(state, encode(next_seen))
            pending.unlink(missing_ok=True)
            print(published)
        else:
            print(json.dumps(batch, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--findings", type=Path, default=DEFAULT_FINDINGS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch")
    parser.add_argument("--publish", type=Path)
    args = parser.parse_args()
    if bool(args.batch) != bool(args.publish):
        parser.error("--batch and --publish must be supplied together")
    try:
        review(args)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(f"Findings review failed: {error}")


if __name__ == "__main__":
    main()
