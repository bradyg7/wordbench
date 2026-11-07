"""Golden tests: the Python `wb` and the Rust `wb` run on the same inputs, and their answers compared (docs/PLAN.md phase 1).

    python scripts/golden.py [name-filter ...] [--list]

Cases are in tests/golden/cases.json: each a name and a list of steps (the arguments of one `wb` command each). Both
sides get a fresh copy of the scratch study folder (scripts/scratch-study.ps1); the person's real folder is never used.
The Python side is a private workbench server on its own port, so the running app is never reached. Ids, times and the
folders' paths are replaced by placeholders before comparing; a step can name an id an earlier step printed as $id1,
$id2 ... (in the order that side printed them). After the steps of a case that writes, the two study folders are compared
file by file.
"""
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
OLD = Path.home() / "github" / "bible-workbench"
REAL = Path.home() / "github" / "bible-study-data"
SOURCE = Path(os.environ.get("WB_GOLDEN_SOURCE") or Path(tempfile.gettempdir()) / "bible-workbench-rs" / "study-scratch")
WORK = Path(tempfile.gettempdir()) / "bible-workbench-rs" / "golden"
PORT = int(os.environ.get("WB_GOLDEN_PORT") or 9471)
RUST = REPO / "target" / "release" / ("wb.exe" if os.name == "nt" else "wb")

ID = re.compile(r"\b[a-z]_\d{14}_[0-9a-f]{4}\b")
TIME = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z|\d{8}-\d{6}")
DAY = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
KEY = re.compile(r"\bi[0-9a-f]{8}\b")                     # a set item's key
MODIFIED = re.compile(r'"modified": [0-9.e+]+')           # a lesson file's time
CLOCK = re.compile(r'"t": "\d{2}:\d{2}:\d{2}"')              # the local time of a log line


class Side:
    def __init__(self, name, folder):
        self.name, self.folder, self.ids, self.keys = name, folder, [], []
        self.docs = folder.with_name(folder.name + "-documents")    # where its documents go: empty, never the person's

    def norm(self, text):
        for path in {str(self.docs), str(self.docs).replace("\\", "\\\\"), self.docs.as_posix()}:
            text = text.replace(path, "<documents>")
        for path in {str(self.folder), str(self.folder).replace("\\", "\\\\"), self.folder.as_posix()}:
            text = text.replace(path, "<study>")

        def sub(m):
            if m.group(0) not in self.ids:
                self.ids.append(m.group(0))
            return "<id%d>" % (self.ids.index(m.group(0)) + 1)
        text = ID.sub(sub, text)
        text = KEY.sub(lambda m: "<key%d>" % self.key(m.group(0)), text)
        text = MODIFIED.sub('"modified": <mtime>', text)
        text = CLOCK.sub('"t": "<clock>"', text)
        return DAY.sub("<day>", TIME.sub("<time>", text))

    def key(self, k):
        if k not in self.keys:
            self.keys.append(k)
        return self.keys.index(k) + 1

    def args(self, step):
        out = []
        for a in step:
            a = re.sub(r"\$id(\d+)", lambda m: self.ids[int(m.group(1)) - 1] if int(m.group(1)) <= len(self.ids) else m.group(0), a)
            a = re.sub(r"\$key(\d+)", lambda m: self.keys[int(m.group(1)) - 1] if int(m.group(1)) <= len(self.keys) else m.group(0), a)
            a = a.replace("$golden", str(REPO / "tests" / "golden"))
            if a == "$last" and self.ids:
                a = self.ids[-1]
            out.append(a)
        return out


def run(cmd, env, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, timeout=300)
    dec = lambda b: b.decode("utf-8", "replace").replace("\r\n", "\n")
    return p.returncode, dec(p.stdout), dec(p.stderr)


def tree(folder):
    out = {}
    for p in sorted(folder.rglob("*")):
        if p.is_file() and ".trash" not in p.parts:
            out[p.relative_to(folder).as_posix()] = p.read_bytes().decode("utf-8", "replace").replace("\r\n", "\n")
    return out


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("--")]
    cases = json.loads((REPO / "tests" / "golden" / "cases.json").read_text(encoding="utf-8"))
    if "--list" in sys.argv:
        for c in cases:
            print(c["name"])
        return 0
    if want:
        cases = [c for c in cases if any(w in c["name"] for w in want)]
    if SOURCE.resolve() == REAL.resolve():
        sys.exit("The golden tests never use the real study folder.")
    if not SOURCE.is_dir():
        sys.exit("No scratch study folder at %s (run scripts/scratch-study.ps1)" % SOURCE)
    if not RUST.exists():
        sys.exit("Build the Rust wb first: cargo build --release -p wb-cli")
    if WORK.exists():
        shutil.rmtree(WORK)
    py, rs = Side("python", WORK / "py"), Side("rust", WORK / "rs")
    for s in (py, rs):
        shutil.copytree(SOURCE, s.folder)

    # each side's documents folder is its own empty scratch folder: the Python app's default is the person's Documents
    env_py = dict(os.environ, BIBLE_STUDY_DATA=str(py.folder), BIBLE_WORKBENCH_PORT=str(PORT), PYTHONIOENCODING="utf-8",
                  BIBLE_WORKBENCH_PDF_DIR=str(py.docs))
    env_rs = dict(os.environ, WB_STUDY_DIR=str(rs.folder), WB_DOCS_DIR=str(rs.docs))
    server = subprocess.Popen([sys.executable, "-m", "workbench.server"], cwd=str(OLD), env=env_py,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                st = json.loads(urllib.request.urlopen("http://127.0.0.1:%d/api/study/status" % PORT, timeout=2).read())
                break
            except OSError:
                time.sleep(0.2)
        else:
            sys.exit("The Python server did not start on port %d" % PORT)
        if Path(st["root"]).resolve() != py.folder.resolve():
            sys.exit("Port %d answers for %s, not the golden folder; pick another WB_GOLDEN_PORT." % (PORT, st["root"]))
        failed = []
        for case in cases:
            ok, report = True, []
            for step in case["steps"]:
                # In a case that writes, each step starts at a fresh second on both sides, so times written in the same
                # second (which decide the order of ties) fall the same way for the slower Python side and the Rust one.
                fresh = (lambda: time.sleep(1.02 - time.time() % 1)) if case.get("files") else (lambda: None)
                fresh()
                a = run([sys.executable, str(OLD / "wb.py")] + py.args(step), env_py, cwd=str(OLD))
                fresh()
                b = run([str(RUST)] + rs.args(step), env_rs)
                got_a = "exit %d\n%s%s" % (a[0], py.norm(a[1]), py.norm(a[2]))
                got_b = "exit %d\n%s%s" % (b[0], rs.norm(b[1]), rs.norm(b[2]))
                if got_a != got_b:
                    ok = False
                    diff = difflib.unified_diff(got_a.splitlines(), got_b.splitlines(), "python", "rust", lineterm="", n=2)
                    report.append("  wb %s\n%s" % (" ".join(step), "\n".join(list(diff)[:40])))
                    break
            if ok and case.get("files"):
                ta = {py.norm(k): py.norm(v) for k, v in tree(py.folder).items()}
                tb = {rs.norm(k): rs.norm(v) for k, v in tree(rs.folder).items()}
                for k in sorted(set(ta) | set(tb)):
                    if ta.get(k) != tb.get(k):
                        ok = False
                        diff = difflib.unified_diff((ta.get(k) or "<missing>").splitlines(), (tb.get(k) or "<missing>").splitlines(), "python", "rust", lineterm="", n=1)
                        report.append("  file %s\n%s" % (k, "\n".join(list(diff)[:30])))
            print(("ok    " if ok else "FAIL  ") + case["name"])
            if not ok:
                failed.append(case["name"])
                print("\n".join(report))
        print("\n%d of %d cases the same" % (len(cases) - len(failed), len(cases)))
        return 1 if failed else 0
    finally:
        server.terminate()


if __name__ == "__main__":
    sys.exit(main())
