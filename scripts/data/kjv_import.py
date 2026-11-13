"""Parse the eBible KJV USFM (with Strong's tags) into the verses/words/footnotes tables."""
import re
import zipfile

FILE_RE = re.compile(r"^\d+-([A-Z0-9]{3})eng-kjv2006\.usfm$")
SEGMENT_RE = re.compile(r"(?=\\v \d)")
LINE_RE = re.compile(r"^\\\+?([a-z0-9]+)\*?\s*(.*)$", re.S)
TOKEN_RE = re.compile(
    r'\\\+?w\s+(?P<wtext>[^|\\]*)\|strong="(?P<strong>[HG]\d+)"\\\+?w\*'
    r"|\\\+?(?P<open>add|nd|wj|tl)\s"
    r"|\\\+?(?P<close>add|nd|wj|tl)\*"
    r"|\\f\s(?P<fn>.*?)\\f\*"
    r"|(?P<text>[^\\]+)",
    re.S,
)
WORD_RE = re.compile(r"(?P<w>[\w\u2019'\-]+)|(?P<p>[^\w\u2019'\-]+)")
PARA = {"p": "p", "m": "p", "pi": "p", "q": "q1", "q1": "q1", "q2": "q2", "q3": "q2", "b": "b"}
INLINE = {"w", "add", "nd", "wj", "tl", "f"}
SKIP = {"id", "h", "toc1", "toc3", "mt1", "mt2", "mt3", "s1", "s2", "ide", "sts", "rem"}


def norm_strong(s):
    """H0430 -> H430, G0846 -> G846."""
    return s[0] + str(int(s[1:]))


class BookParser:
    def __init__(self):
        self.name = None
        self.code = None
        self.chapter = 0
        self.verses = []      # {chapter, verse, words, footnotes}
        self.titles = {}
        self.unknown = {}
        self._cur = None
        self._flags = set()
        self._para = ""
        self._lead = ""
        self._grp = 0

    def parse(self, text):
        for line in text.splitlines():
            for seg in SEGMENT_RE.split(line):
                if seg.strip():
                    self._segment(seg)
        return self

    def _segment(self, seg):
        m = LINE_RE.match(seg)
        marker, rest = (m.group(1), m.group(2)) if m else (None, seg)
        if marker in INLINE:
            marker, rest = None, seg
        if marker == "id":
            self.code = rest.split()[0]
            return
        if marker == "toc2":
            self.name = rest.strip()
            return
        if marker in SKIP:
            return
        if marker == "c":
            self.chapter = int(rest.split()[0])
            self._cur = None
            return
        if marker == "d":
            self.titles[self.chapter] = self._plain(rest)
            return
        if marker == "v":
            vm = re.match(r"(\d+)\S*\s*(.*)", rest, re.S)
            self._cur = {"chapter": self.chapter, "verse": int(vm.group(1)), "words": [], "footnotes": []}
            self.verses.append(self._cur)
            self._flags, self._grp, self._lead = set(), 0, ""
            rest = vm.group(2)
        elif marker in PARA:
            self._para = PARA[marker]
        elif marker is not None:
            self.unknown[marker] = self.unknown.get(marker, 0) + 1
            return
        if self._cur is not None and rest.strip():
            self._feed(rest + " ")

    def _plain(self, s):
        out = []
        for m in TOKEN_RE.finditer(s):
            if m.group("wtext") is not None:
                out.append(m.group("wtext"))
            elif m.group("text"):
                out.append(m.group("text"))
        return re.sub(r"\s+", " ", "".join(out)).strip()

    def _feed(self, s):
        cur = self._cur
        for m in TOKEN_RE.finditer(s):
            if m.group("strong"):
                self._grp += 1
                self._emit(m.group("wtext"), norm_strong(m.group("strong")), self._grp)
            elif m.group("open"):
                self._flags.add(m.group("open"))
            elif m.group("close"):
                self._flags.discard(m.group("close"))
            elif m.group("fn") is not None:
                ft = re.search(r"\\ft\s(.*)", m.group("fn"), re.S)
                note = re.sub(r"\s+", " ", ft.group(1) if ft else m.group("fn")).strip()
                cur["footnotes"].append((len(cur["words"]) - 1, note))
            elif m.group("text"):
                self._emit(m.group("text"), None, 0)

    def _emit(self, text, strong, grp):
        words = self._cur["words"]
        for t in WORD_RE.finditer(text):
            if t.group("w"):
                words.append({
                    "lead": self._lead, "text": t.group("w"), "trail": "",
                    "strong": strong, "grp": grp,
                    "italic": int("add" in self._flags), "nd": int("nd" in self._flags),
                    "wj": int("wj" in self._flags), "para": self._para,
                })
                self._lead, self._para = "", ""
            else:
                p = re.sub(r"\s+", " ", t.group("p"))
                if words:
                    words[-1]["trail"] += p
                else:
                    self._lead += p


def import_kjv(conn, zip_path):
    """Fill the tables from the USFM zip. Returns a stats dict."""
    stats = {"books": 0, "verses": 0, "words": 0, "tagged": 0, "unknown_markers": {}}
    with zipfile.ZipFile(zip_path) as z:
        names = sorted(n for n in z.namelist() if FILE_RE.match(n.split("/")[-1]))
        for order, name in enumerate(names, start=1):
            bp = BookParser().parse(z.read(name).decode("utf-8"))
            for k, v in bp.unknown.items():
                stats["unknown_markers"][k] = stats["unknown_markers"].get(k, 0) + v
            chapters = max(v["chapter"] for v in bp.verses)
            conn.execute("INSERT INTO books VALUES (?,?,?,?,?)",
                         (order, bp.code, bp.name, "OT" if order <= 39 else "NT", chapters))
            for ch, title in bp.titles.items():
                conn.execute("INSERT INTO chapter_titles VALUES (?,?,?)", (order, ch, title))
            for v in bp.verses:
                key = (order, v["chapter"], v["verse"])
                full = "".join(w["lead"] + w["text"] + w["trail"] for w in v["words"])
                conn.execute("INSERT INTO verses VALUES (?,?,?,?)", key + (full.replace("¶", "").strip(),))
                conn.executemany(
                    "INSERT INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [key + (i, w["lead"], w["text"], w["trail"], w["strong"], w["grp"],
                            w["italic"], w["nd"], w["wj"], w["para"]) for i, w in enumerate(v["words"])])
                conn.executemany("INSERT INTO footnotes VALUES (?,?,?,?,?)",
                                 [key + (a, t) for a, t in v["footnotes"]])
                stats["verses"] += 1
                stats["words"] += len(v["words"])
                stats["tagged"] += sum(1 for w in v["words"] if w["strong"])
            stats["books"] += 1
    conn.commit()
    return stats
