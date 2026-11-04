"""Write design/fonts/compare.html: Numbers 25:10-13, verbatim from content.json (wb text), in each candidate reading font,
at the phone and desktop reading sizes, in light and dark. Open the page in a browser; the fonts come from Google Fonts,
except Palatino Linotype (today's face on Windows), which is drawn from this computer.

    python design/fonts/make_compare.py
"""
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
C = json.loads((HERE.parent / "content.json").read_text(encoding="utf-8"))
VERSES = [v for v in C["num25"]["verses"] if 10 <= v["v"] <= 13]
FONTS = [
    ("Merriweather", "'Merriweather', serif", "What the design sheets use. Sturdy, open, made for screens; a little wide."),
    ("Literata", "'Literata', serif", "Made for long reading on screens (Google Play Books). Closest to a book page."),
    ("Source Serif 4", "'Source Serif 4', serif", "Closest in feel to today's Palatino and Iowan; lighter strokes."),
    ("Palatino Linotype (today)", "'Palatino Linotype', Palatino, serif",
     "Today's face on Windows. Not on Android, and Palatino is licensed, so it cannot ship with the app."),
]


def passage(size, lh):
    out = []
    for v in VERSES:
        words = html.escape(v["text"])
        if v["v"] == 11:  # the highlight and thread underline the sheets show on this verse
            words = f'<mark class="hl">{words}</mark>'
        out.append(f'<sup>{v["v"]}</sup>{words} ')
    return f'<p style="font-size:{size}px;line-height:{lh}px">{"".join(out)}</p>'


def main():
    cards = []
    for name, stack, about in FONTS:
        cards.append(f"""
<section class="font">
  <h2>{html.escape(name)}</h2><p class="about">{html.escape(about)}</p>
  <div class="pair">
    <div class="phone light" style="font-family:{stack}"><div class="ref">Phone · 18/32 · light</div>{passage(18, 32)}</div>
    <div class="phone dark" style="font-family:{stack}"><div class="ref">Phone · 18/32 · dark</div>{passage(18, 32)}</div>
    <div class="desk light" style="font-family:{stack}"><div class="ref">Desktop · 19/34 · light</div>{passage(19, 34)}</div>
  </div>
</section>""")
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reading Font Comparison</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Literata:opsz,wght@7..72,400;7..72,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&family=Inter:wght@400;600&display=swap">
<style>
:root {{ --bg:#FBF9F4; --fg:#231F1A; --muted:#6F675C; --line:#E4DDD0; --accent:#8A4B20; --hl:#D6E9CC; --thread:#D9822B; }}
body {{ margin:0; padding:32px 16px 64px; background:#F3EEE4; color:var(--fg); font:15px/1.5 Inter, system-ui, sans-serif; }}
h1 {{ font-size:28px; margin:0 0 4px; }} .intro {{ color:var(--muted); max-width:880px; margin:0 0 28px; }}
.font {{ margin:0 0 40px; }} h2 {{ font-size:20px; margin:0; }} .about {{ color:var(--muted); margin:2px 0 12px; }}
.pair {{ display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }}
.phone, .desk {{ background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:16px 20px; box-sizing:border-box; }}
.phone {{ width:390px; max-width:100%; }} .desk {{ width:720px; max-width:100%; }}
.dark {{ --bg:#17140F; --fg:#E9E2D4; --muted:#9A917F; --line:#342E24; --accent:#E0A46C; --hl:#2B3D25; --thread:#E8A060; color:var(--fg); }}
.light {{ color:var(--fg); }}
.ref {{ font:600 11px/14px Inter, sans-serif; letter-spacing:.8px; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }}
p {{ margin:0; }} sup {{ font:600 11px Inter, sans-serif; color:var(--accent); margin-right:3px; }}
mark.hl {{ background:var(--hl); color:inherit; text-decoration:underline 3px var(--thread); text-underline-offset:5px; }}
</style></head><body>
<h1>Reading font</h1>
<p class="intro">Numbers 25:10–13 (KJV), verbatim from <code>wb text</code>, in each candidate at the phone and desktop reading
sizes. Verse 11 carries the green highlight and the Phinehas thread underline, as on the sheets. The chosen font ships
inside the app so the iPhone, Android and the desktop look the same. All but Palatino are under the SIL Open Font License.</p>
{''.join(cards)}
</body></html>
"""
    (HERE / "compare.html").write_text(page, encoding="utf-8")
    print(HERE / "compare.html")


if __name__ == "__main__":
    main()
