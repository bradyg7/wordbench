//! Slides as PDF pages, laid out by Typst as a library (phase 0's spike (c), moved into wb-core): the Verse by Verse deck
//! the Python app had DeckCraft make as PowerPoint. Each slide is a 960 × 540 page, with the same boxes as DeckCraft's
//! layouts (craft_render.Deck) and the theme's colors and shapes. The fonts are the window's own (Literata for scripture,
//! Inter for the rest; `fonts/`), since the themes' Word fonts are not there on every computer.
//!
//! The plan goes to Typst as data (`data.json` in an in-memory file system), never as typed text, and the template only
//! lays it out. After layout, the text on the pages is read back, so the check that every verse is there word for word
//! is made on what the PDF holds.

use super::look::Look;
use super::plan::Theme;
use crate::{Error, Result};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::OnceLock;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::layout::FrameItem;
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

const TEMPLATE: &str = r##"
#let d = json("data.json")
#let t = d.theme
#let c(h) = rgb("#" + h)
#let tone(name) = if name == "accent1" { c(t.accent) } else if name == "accent2" { c(t.accent2) } else { rgb(name) }
#set document(title: d.title)
#let lk = d.look
#set text(font: lk.serif, fill: c(t.ink), hyphenate: false, ligatures: false, lang: "en")
#set par(justify: false)
#let ui = lk.ui
#let at(x, y, w, h, body, anchor: horizon) = place(top + left, dx: x * 1pt, dy: y * 1pt,
  block(width: w * 1pt, height: h * 1pt, align(anchor + left, body)))
#let verse(v, num) = {
  if v.num != none {
    text(size: 0.62em, baseline: -0.42em, fill: num, font: ui, weight: 600)[#v.num]
    [ ]
  }
  for r in v.runs {
    if r.mark { highlight(fill: c(t.mark), top-edge: "cap-height", bottom-edge: "descender", extent: 2pt, text(fill: c(t.mark_ink))[#r.t]) } else [#r.t]
  }
}
#for s in d.slides {
  // R3's design (sheets D5-D8): the theme's paper and ink, no chrome, no filled section slide; Inter SemiBold for
  // titles and references, Literata for scripture, the accent only on the reference, the subtitle, verse numbers and
  // the section rule.
  page(width: 960pt, height: 540pt, margin: 0pt, fill: c(t.paper))[
    #let L = 64
    #let W = 960 - L - 64
    #if s.kind == "title" {
      at(L, 176, W, 130, anchor: bottom, text(font: ui, size: s.size * 1pt, weight: 600, par(leading: 0.3em)[#s.title]))
      if s.sub != "" { at(L, 318, W, 60, anchor: top, text(font: ui, size: 24pt, fill: c(t.accent))[#s.sub]) }
    } else if s.kind == "section" {
      place(top + left, dx: L * 1pt, dy: 196pt, rect(width: 56pt, height: 4pt, fill: c(t.accent), stroke: none))
      at(L, 214, W, 110, anchor: top, text(font: ui, size: s.size * 1pt, weight: 600, par(leading: 0.3em)[#s.title]))
    } else if s.kind == "verse" {
      let refy = if lk.reference == "bottom" { 470 } else { 38 }
      at(L, refy, W, 34, text(font: ui, size: 24pt, weight: 600, fill: c(t.accent))[#s.ref])
      if lk.neighbours == "hidden" {
        at(L, 90, W, 360, text(size: s.size * 1pt, par(leading: 0.6em, verse(s.verse, c(t.accent)))))
      } else {
        if s.before != none { at(L, 84, W, 78, text(size: 20pt, fill: c(t.muted), verse(s.before, c(t.muted)))) }
        at(L, 170, W, 240, text(size: s.size * 1pt, par(leading: 0.6em, verse(s.verse, c(t.accent)))))
        if s.after != none { at(L, 420, W, 84, text(size: 20pt, fill: c(t.muted), verse(s.after, c(t.muted)))) }
      }
    }
  ]
}
"##;

/// The largest whole point size at which these paragraphs should fit a box: an estimate from character counts
/// (craft_plan.fit_size).
pub fn fit_size(
    paras: &[String],
    width: f64,
    height: f64,
    width_factor: f64,
    lo: i64,
    hi: i64,
) -> i64 {
    for size in (lo..=hi).rev() {
        let size_f = size as f64;
        let per_line = width / (size_f * width_factor);
        let lines: f64 = paras
            .iter()
            .map(|p| (p.chars().count() as f64 / per_line).ceil())
            .sum();
        if lines * size_f * 1.26 + (paras.len() as f64 - 1.0) * size_f * 0.45 <= height {
            return size;
        }
    }
    lo
}

/// A verse as the template draws it: its number, then its text cut into runs at your highlights (character ranges).
fn verse_data(v: &Value, marks: &[(usize, usize)]) -> Value {
    let text: Vec<char> = v["text"].as_str().unwrap_or("").chars().collect();
    let mut runs = vec![];
    let mut at = 0;
    for &(a, b) in marks {
        let (a, b) = (a.min(text.len()), b.min(text.len()));
        if a > at {
            runs.push(json!({"t": text[at..a].iter().collect::<String>(), "mark": false}));
        }
        if b > a {
            runs.push(json!({"t": text[a..b].iter().collect::<String>(), "mark": true}));
        }
        at = at.max(b);
    }
    if at < text.len() {
        runs.push(json!({"t": text[at..].iter().collect::<String>(), "mark": false}));
    }
    json!({"num": if v["v"].is_null() { Value::Null } else { json!(v["v"].to_string()) }, "runs": runs})
}

fn marks_of(s: &Value) -> Vec<(usize, usize)> {
    s["marks"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|m| {
                    (
                        m[0].as_u64().unwrap_or(0) as usize,
                        m[1].as_u64().unwrap_or(0) as usize,
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

/// The plan's slides as the template's data, with each box's size fitted as DeckCraft fitted it.
pub(super) fn slides_data(plan: &[Value], t: &Theme, look: &Look) -> Vec<Value> {
    // the estimate is held a little under the box (360 pt when the neighbours are hidden), so a long verse never spills off the page
    let (box_h, hi) = if look.neighbours == "hidden" {
        (330.0, 46)
    } else {
        (240.0, 40)
    };
    let w = 960.0 - 64.0 - 64.0;
    plan.iter()
        .filter_map(|s| match s["kind"].as_str()? {
            "title" => {
                let title = s["title"].as_str().unwrap_or("").to_string();
                Some(json!({"kind": "title", "title": title, "sub": s["sub"], "size": fit_size(std::slice::from_ref(&title), 832.0, 130.0, t.width, 36, 64)}))
            }
            "section" => {
                let title = s["title"].as_str().unwrap_or("").to_string();
                Some(json!({"kind": "section", "title": title, "size": fit_size(std::slice::from_ref(&title), 832.0, 110.0, t.width, 32, 50)}))
            }
            "verse" => {
                let v = &s["verse"];
                let lead = if v["v"].is_null() { String::new() } else { format!("{} ", v["v"]) };
                let size = fit_size(&[format!("{lead}{}", v["text"].as_str().unwrap_or(""))], w, box_h, t.width, 24, hi);
                let near = |o: &Value| if o.is_null() { Value::Null } else { verse_data(o, &[]) };
                Some(json!({"kind": "verse", "ref": s["ref"], "before": near(&s["before"]), "after": near(&s["after"]),
                    "verse": verse_data(v, &marks_of(s)), "size": size}))
            }
            _ => None,
        })
        .collect()
}

struct Deck {
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    files: HashMap<FileId, Bytes>,
    main: FileId,
}

fn id(path: &str) -> FileId {
    RootedPath::new(VirtualRoot::Project, VirtualPath::new(path).unwrap()).intern()
}

impl World for Deck {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }
    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }
    fn main(&self) -> FileId {
        self.main
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        let bytes = self.file(id)?;
        Ok(Source::new(
            id,
            String::from_utf8(bytes.to_vec()).map_err(|_| FileError::InvalidUtf8)?,
        ))
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files
            .get(&id)
            .cloned()
            .ok_or_else(|| FileError::NotFound(PathBuf::from(format!("{id:?}"))))
    }
    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }
    fn today(&self, _: Option<Duration>) -> Option<Datetime> {
        let d = chrono::Local::now().date_naive();
        use chrono::Datelike;
        Datetime::from_ymd(d.year(), d.month() as u8, d.day() as u8)
    }
}

/// WOFF 1.0 → an OpenType file (each table zlib-compressed or stored), so Typst can use the window's own fonts.
pub(super) fn woff_to_otf(woff: &[u8]) -> Vec<u8> {
    use std::io::Read;
    let u32_at = |o: usize| u32::from_be_bytes(woff[o..o + 4].try_into().unwrap());
    let u16_at = |o: usize| u16::from_be_bytes(woff[o..o + 2].try_into().unwrap());
    let flavor = u32_at(4);
    let n = u16_at(12) as usize;
    let mut tables = vec![];
    for t in 0..n {
        let e = 44 + t * 20;
        let (tag, off, clen, olen, sum) = (
            u32_at(e),
            u32_at(e + 4) as usize,
            u32_at(e + 8) as usize,
            u32_at(e + 12) as usize,
            u32_at(e + 16),
        );
        let raw = &woff[off..off + clen];
        let data = if clen < olen {
            let mut out = Vec::with_capacity(olen);
            flate2::read::ZlibDecoder::new(raw)
                .read_to_end(&mut out)
                .unwrap();
            out
        } else {
            raw.to_vec()
        };
        tables.push((tag, sum, data));
    }
    let mut out = vec![];
    let pow = (n as f64).log2().floor() as u32;
    let search = 16u16 * (1 << pow) as u16;
    out.extend(flavor.to_be_bytes());
    out.extend((n as u16).to_be_bytes());
    out.extend(search.to_be_bytes());
    out.extend((pow as u16).to_be_bytes());
    out.extend((n as u16 * 16 - search).to_be_bytes());
    let mut offset = 12 + 16 * n;
    let mut body = vec![];
    for (tag, sum, data) in &tables {
        out.extend(tag.to_be_bytes());
        out.extend(sum.to_be_bytes());
        out.extend((offset as u32).to_be_bytes());
        out.extend((data.len() as u32).to_be_bytes());
        body.extend(data);
        while body.len() % 4 != 0 {
            body.push(0);
        }
        offset = 12 + 16 * n + body.len();
    }
    out.extend(body);
    out
}

fn fonts() -> &'static Vec<Font> {
    static FONTS: OnceLock<Vec<Font>> = OnceLock::new();
    FONTS.get_or_init(|| {
        let files: [&[u8]; 9] = [
            include_bytes!("../../fonts/literata-latin-400-normal.woff"),
            include_bytes!("../../fonts/literata-latin-400-italic.woff"),
            include_bytes!("../../fonts/literata-latin-700-normal.woff"),
            include_bytes!("../../fonts/literata-latin-ext-400-normal.woff"),
            include_bytes!("../../fonts/literata-latin-ext-700-normal.woff"),
            include_bytes!("../../fonts/inter-latin-400-normal.woff"),
            include_bytes!("../../fonts/inter-latin-600-normal.woff"),
            include_bytes!("../../fonts/inter-latin-ext-400-normal.woff"),
            include_bytes!("../../fonts/inter-latin-ext-600-normal.woff"),
        ];
        files
            .iter()
            .flat_map(|w| Font::iter(Bytes::new(woff_to_otf(w))).collect::<Vec<_>>())
            .collect()
    })
}

/// Every piece of text on the laid-out pages, in reading order: runs on one line join as they are (their spaces are in
/// them); a new line adds a space.
fn page_text(doc: &PagedDocument) -> String {
    fn walk(frame: &typst::layout::Frame, y0: f64, out: &mut String, last_y: &mut f64) {
        for (pos, item) in frame.items() {
            let y = y0 + pos.y.to_pt();
            match item {
                FrameItem::Group(g) => walk(&g.frame, y, out, last_y),
                FrameItem::Text(t) => {
                    if (y - *last_y).abs() > 0.5 {
                        out.push(' ');
                    }
                    out.push_str(&t.text);
                    *last_y = y;
                }
                _ => {}
            }
        }
    }
    let mut s = String::new();
    for p in doc.pages() {
        let mut last = f64::NAN;
        walk(&p.frame, 0.0, &mut s, &mut last);
        s.push('\n');
    }
    s
}

/// A deck's plan as PDF pages. → (the PDF's bytes, the text on its pages, the number of pages)
pub fn render(
    plan: &[Value],
    t: &Theme,
    look: &Look,
    title: &str,
) -> Result<(Vec<u8>, String, usize)> {
    let doc = lay_out(plan, t, look, title)?;
    export_pdf(&doc)
}

pub(super) fn render_template(
    template: &str,
    data: &Value,
    subject: &str,
) -> Result<(Vec<u8>, String, usize)> {
    let doc = compile(template, data, subject)?;
    export_pdf(&doc)
}

fn export_pdf(doc: &PagedDocument) -> Result<(Vec<u8>, String, usize)> {
    let msgs = |e: &[typst::diag::SourceDiagnostic]| {
        e.iter()
            .map(|d| d.message.to_string())
            .collect::<Vec<_>>()
            .join("; ")
    };
    let pdf = typst_pdf::pdf(doc, &typst_pdf::PdfOptions::default())
        .map_err(|e| Error(format!("The PDF could not be written ({}).", msgs(&e))))?;
    Ok((pdf, page_text(doc), doc.pages().len()))
}

/// Count the pages from the same layout as render, without writing a file.
pub fn page_count(plan: &[Value], t: &Theme, look: &Look, title: &str) -> Result<usize> {
    Ok(lay_out(plan, t, look, title)?.pages().len())
}

/// A deck's plan as its pages drawn in SVG, for the window's preview (W6): the same layout as the PDF's, page for page.
pub fn pages_svg(plan: &[Value], t: &Theme, look: &Look, title: &str) -> Result<Vec<String>> {
    let doc = lay_out(plan, t, look, title)?;
    let o = typst_svg::SvgOptions::default();
    Ok(doc.pages().iter().map(|p| typst_svg::svg(p, &o)).collect())
}

fn lay_out(plan: &[Value], t: &Theme, look: &Look, title: &str) -> Result<PagedDocument> {
    let accent = super::look::readable(
        if look.accent.is_empty() {
            t.accent
        } else {
            &look.accent
        },
        t.paper,
    );
    let (ui, serif) = look.fonts();
    let theme = json!({"paper": t.paper, "ink": t.ink, "muted": t.muted, "accent": accent, "accent2": t.accent2, "mark": t.mark,
        "mark_ink": t.mark_ink, "divider_bg": t.divider_bg, "divider_fg": t.divider_fg, "left": t.left,
        "chrome": t.chrome.iter().map(|(c, x, y, w, h)| json!({"color": c, "x": x, "y": y, "w": w, "h": h})).collect::<Vec<_>>()});
    let data = json!({"title": title, "theme": theme, "slides": slides_data(plan, t, look),
        "look": {"ui": ui, "serif": serif, "neighbours": look.neighbours, "reference": look.reference}});
    compile(TEMPLATE, &data, "slides")
}

fn compile(template: &str, data: &Value, subject: &str) -> Result<PagedDocument> {
    let fonts = fonts().clone();
    let main = id("/main.typ");
    let mut files = HashMap::new();
    files.insert(main, Bytes::from_string(template.to_string()));
    files.insert(
        id("/data.json"),
        Bytes::new(serde_json::to_vec(data).map_err(|e| Error(e.to_string()))?),
    );
    let world = Deck {
        library: LazyHash::new(Library::default()),
        book: LazyHash::new(FontBook::from_fonts(&fonts)),
        fonts,
        files,
        main,
    };
    let msgs = |e: &[typst::diag::SourceDiagnostic]| {
        e.iter()
            .map(|d| d.message.to_string())
            .collect::<Vec<_>>()
            .join("; ")
    };
    typst::compile::<PagedDocument>(&world).output.map_err(|e| {
        Error(format!(
            "The {subject} could not be laid out ({}).",
            msgs(&e)
        ))
    })
}
