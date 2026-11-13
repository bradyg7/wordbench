"""The plans of documents from a thread, made by the Python app and by the Rust `wb`, compared by fingerprint (tier 4).

    python scripts/doc-plans.py            # every thread in the scratch study folder, Speaker Script and Verse by Verse

Set WB_LEGACY_APP to an explicit path to the archived Python checkout for this optional comparison.

A document's record keeps the fingerprint of the plan it was built from (documents/<id>.json's "plan"), and both apps
tell whether a file is up to date by comparing it with the plan made now. So the two apps must make the same plan from
the same thread, value for value. This builds each plan with the Python app's own code (craft_plan, craft_render) and
with `wb docs plan`, on the same scratch copy (scripts/scratch-study.ps1; the person's real folder is never used), and
prints any difference.
"""
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
CASES = [("word", "script"), ("deck", "verse")]


def main():
    if SCRATCH.resolve() == REAL.resolve():
        sys.exit("refusing the real study folder; use a scratch copy")
    legacy = os.environ.get("WB_LEGACY_APP")
    if not legacy:
        sys.exit("Set WB_LEGACY_APP to the Python checkout for this optional comparison.")
    old = Path(legacy).resolve()
    if not (old / "workbench" / "craft_plan.py").is_file():
        sys.exit(f"WB_LEGACY_APP is not a Python Workbench checkout: {old}")
    sys.path.insert(0, str(old))
    from workbench import craft_plan, craft_render, db, documents, study  # noqa: E402

    conn = db.connect()
    st = study.Study(SCRATCH)
    threads = sorted(p.stem for p in (SCRATCH / "threads").glob("*.md"))
    env = dict(os.environ, WB_STUDY_DIR=str(SCRATCH))
    bad = 0
    for tid in threads:
        for to, structure in CASES:
            margin = craft_plan.Margin(conn, st)
            source, _title = documents.read_source(conn, st, {"kind": "thread", "id": tid}, margin)
            plan = craft_render.plan_of(to, structure, source, margin)
            py = documents.fingerprint(plan)
            out = subprocess.run([str(RUST), "docs", "plan", "--thread", tid, "--to", to, "--structure", structure], env=env,
                                 capture_output=True, timeout=120)
            if out.returncode:
                print("FAIL %s %s %s: %s" % (tid, to, structure, out.stderr.decode("utf-8", "replace").strip()))
                bad += 1
                continue
            rs = json.loads(out.stdout)
            same = rs["fingerprint"] == py
            print("%s %-18s %-5s %-7s %d items" % ("ok  " if same else "DIFF", tid, to, structure, len(plan)))
            if not same:
                bad += 1
                want = json.loads(json.dumps(plan, ensure_ascii=False, sort_keys=True, default=str))
                for i, (a, b) in enumerate(zip(want, rs["plan"])):
                    if json.dumps(a, sort_keys=True, ensure_ascii=False) != json.dumps(b, sort_keys=True, ensure_ascii=False):
                        print("  first difference at item %d:\n  python: %s\n  rust:   %s" % (
                            i, json.dumps(a, ensure_ascii=False)[:400], json.dumps(b, ensure_ascii=False)[:400]))
                        break
                else:
                    print("  lengths: python %d, rust %d" % (len(want), len(rs["plan"])))
    print("%d of %d plans the same" % (len(threads) * len(CASES) - bad, len(threads) * len(CASES)))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
