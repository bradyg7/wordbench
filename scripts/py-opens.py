"""Does the Python app still open the study folder as it did? (R1, docs/archive/2026-11-10/docs/redesign-R1.md question 6)

    python scripts/py-opens.py                    # the Python app's counts against this app's (`wb study check`), on the scratch copy
    python scripts/py-opens.py --save before.json # keep what the Python app reads
    python scripts/py-opens.py --compare before.json   # after a change: it must read the same

Set WB_LEGACY_APP to an explicit path to the archived Python checkout for this optional comparison.

Opens a scratch copy of the study folder (scripts/scratch-study.ps1; the person's real folder is refused) with the Python
app's own `Study`, and reads what that app reads: notes (only those with a place), threads and their places, trails and
sets, and each thread's note text. With no option it also asks the Rust `wb study check` and says if the two disagree.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
REAL = Path.home() / "github" / "bible-study-data"
SCRATCH = Path(os.environ.get("WB_STUDY_DIR") or Path(tempfile.gettempdir()) / "bible-workbench-rs" / "study-scratch")
RUST = REPO / "target" / "release" / ("wb.exe" if os.name == "nt" else "wb")
if not RUST.exists():
    RUST = REPO / "target" / "debug" / ("wb.exe" if os.name == "nt" else "wb")


def python_reads(old):
    sys.path.insert(0, str(old))
    from workbench import study  # noqa: E402

    st = study.Study(SCRATCH)
    threads = st.threads()
    return {
        "notes": len(st.notes()),
        "threads": len(threads),
        "thread_places": sum(len(t["members"]) for t in threads),
        "trails": len(st.trails()),
        "sets": len(st.sets()),
        "thread_notes": {t["id"]: t["note"] for t in threads},
        "thread_members": {t["id"]: [m["anchor"] for m in t["members"]] for t in threads},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--save")
    ap.add_argument("--compare")
    a = ap.parse_args()
    if SCRATCH.resolve() == REAL.resolve():
        sys.exit("refusing the real study folder; use a scratch copy")
    legacy = os.environ.get("WB_LEGACY_APP")
    if not legacy:
        ap.error("set WB_LEGACY_APP to the Python checkout for this optional comparison")
    old = Path(legacy).resolve()
    if not (old / "workbench" / "study.py").is_file():
        ap.error(f"WB_LEGACY_APP is not a Python Workbench checkout: {old}")
    py = python_reads(old)
    shown = {k: v for k, v in py.items() if not isinstance(v, dict)}
    print("the Python app reads:", json.dumps(shown))
    bad = 0
    if a.save:
        Path(a.save).write_text(json.dumps(py, ensure_ascii=False, indent=1), encoding="utf-8")
        print("saved to", a.save)
    if a.compare:
        before = json.loads(Path(a.compare).read_text(encoding="utf-8"))
        for k, v in py.items():
            if before.get(k) != v:
                bad += 1
                print("DIFFERENT:", k)
                if isinstance(v, dict):
                    for t in sorted(set(v) | set(before.get(k, {}))):
                        if v.get(t) != before.get(k, {}).get(t):
                            print("  ", t)
        print("same as before" if not bad else "%d things differ" % bad)
    if not a.save and not a.compare:
        out = subprocess.run([str(RUST), "study", "check"], env=dict(os.environ, WB_STUDY_DIR=str(SCRATCH)), capture_output=True)
        if out.returncode:
            sys.exit("wb study check failed: " + out.stderr.decode("utf-8", "replace"))
        rs = json.loads(out.stdout)["python_reads"]
        for k, v in rs.items():
            same = py.get(k) == v
            print("%s %-14s python %-4s rust %s" % ("ok  " if same else "DIFF", k, py.get(k), v))
            bad += 0 if same else 1
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
