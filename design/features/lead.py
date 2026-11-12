"""Leaving superseded windows off a board (the person, 2026-11-12: a folder's board holds only its leading windows).

For the older, larger scripts whose rounds share helpers, a window that no longer leads is left off the board here
rather than cut out of the code: `drop(Q, {"B1", "D1"})` before the board is built. Each dropped tag is listed in the
folder README's Leading design table with what replaced it; the drawing as it was is in git history (commit 0d59600).
Marks and highlights cut superseded code out instead; questions uses drop().
"""
import re


def drop(Q, tags):
    """Make Q.win put the windows tagged in `tags` into a hidden holder, so they are neither laid out nor exported."""
    tags = set(tags)
    orig = Q.win

    def win(parent, page, title, about, *a, **kw):
        m = re.match(r"([A-Z]+\d+) ·", title)
        if m and m.group(1) in tags:
            hidden = Q.col(parent, f"dropped/{m.group(1)}", gap=0, W="hug")
            Q.S.do("node.set", {"ids": [hidden], "props": {"visible": False}}, ref=False)
            return orig(hidden, page, title, about, *a, **kw)
        return orig(parent, page, title, about, *a, **kw)

    Q.win = win
