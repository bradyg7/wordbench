"""Collect the real content the design sheets show into design/content.json.

Scripture comes from the workbench itself (`wb text`, `wb interlinear`, `wb preview`, `wb count`), never typed by hand, so every
verse on a sheet is verbatim with its reference. The study content (notes, questions, thread names) is the Phinehas demo in
demo/. Run against any server (a scratch one is fine: only reads are made):

    python design/content.py
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / "content.json"


def wb(*args):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    exe = ROOT / "target" / "release" / "wb.exe"
    if not exe.exists():
        exe = ROOT / "target" / "debug" / "wb.exe"
    out = subprocess.run([str(exe), *args], cwd=ROOT, env=env, capture_output=True,
                         text=True, encoding="utf-8", check=True)
    return out.stdout


def passage(ref, version="kjv"):
    """{ref, version, verses: [{v, text}]} from `wb text`."""
    lines = wb("text", ref, "--version", version).strip().splitlines()
    head = lines[0]
    verses = []
    for line in lines[1:]:
        m = re.match(r"(\d+) (.*)", line)
        if m:
            verses.append({"v": int(m.group(1)), "text": m.group(2)})
    return {"ref": head.rsplit(" (", 1)[0], "version": version.upper(), "verses": verses}


def main():
    content = {
        "num25": passage("Num 25:1-18"),
        "num25_ylt": passage("Num 25:10-13", "ylt"),
        "ps106": passage("Psalm 106:28-31"),
        "exo40": passage("Exo 40:15"),
        "cor10": passage("1 Cor 10:8"),
        "rom10": passage("Rom 10:2"),
        "john2": passage("John 2:17"),
        "mal2": passage("Mal 2:5-6"),
        "judg20": passage("Judg 20:28"),
        "chr9": passage("1 Chr 9:20"),
        "josh22": passage("Josh 22:31"),
        "exo6": passage("Exo 6:25"),
        "num5": passage("Num 5:14"),
        "num11": passage("Num 11:29"),
        "sam4": passage("1 Sam 4:17"),
        "acts21": passage("Acts 21:20"),
        "titus2": passage("Titus 2:14"),
    }
    il = json.loads(wb("interlinear", "Num 25:11"))
    content["interlinear"] = [{k: w[k] for k in ("original", "translit", "strong", "gloss", "morph")}
                              for w in il["verses"][0]["words"]]
    content["lexicon"] = {"H7065": wb("preview", "H7065").strip(), "H7068": wb("preview", "H7068").strip(),
                          "H6372": wb("preview", "H6372").strip()}
    content["count"] = {"H7065": json.loads(wb("count", "H7065"))}
    OUT.write_text(json.dumps(content, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
