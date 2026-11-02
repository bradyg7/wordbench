//! Phase 0 spike (c): a chapter PDF made with Typst as a library (no Typst program, no Craft app), the scripture filled
//! from the database.
//!
//! The chapter goes to Typst as data (`data.json` in an in-memory file system), never as typed text, and the template
//! only lays it out. After layout, every verse in the pages is checked against the database, as the Python app checks
//! every verse in a finished document.
//!
//!     cargo run -p spike-pdf --release -- [BOOK] [chapter]      (default NUM 25) → spikes/pdf/out/<BOOK>-<ch>.pdf

use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::layout::FrameItem;
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;
use wb_core::{bible::Bible, marks, study::Study};

const TEMPLATE: &str = r##"
#let data = json("data.json")
#set document(title: data.reference + " (KJV)")
#set page(paper: "us-letter", margin: (x: 1in, top: 0.9in, bottom: 1in),
  footer: context [#set text(8pt, fill: luma(110)); #data.reference, King James Version #h(1fr) #counter(page).display()])
#set text(font: "Literata", size: 11.5pt, lang: "en", hyphenate: false)
#set par(justify: true, leading: 0.78em, spacing: 1.1em)
#show heading: set text(font: "Literata", weight: "bold", size: 22pt)

= #data.reference

#for p in data.paragraphs [
  #for v in p [
    #text(size: 7pt, fill: rgb("#8A4B20"), baseline: -3.5pt, weight: "bold")[#v.n]~#for w in v.words {
      if w.hl != none { highlight(fill: rgb(w.hl), extent: 1pt)[#w.t] } else [#w.t]
    }
  ]

]
"##;

/// The design's light highlight colors (ui/tokens.css).
fn hl_color(name: &str) -> Option<&'static str> {
    Some(match name {
        "yellow" => "#F4E3A1",
        "green" => "#D6E9CC",
        "blue" => "#D3E2F3",
        "pink" => "#F3D6E5",
        "orange" => "#F7DCC2",
        _ => return None,
    })
}

struct Spike {
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    files: HashMap<FileId, Bytes>,
    main: FileId,
}

fn id(path: &str) -> FileId {
    RootedPath::new(VirtualRoot::Project, VirtualPath::new(path).unwrap()).intern()
}

impl World for Spike {
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
        Ok(Source::new(id, String::from_utf8(bytes.to_vec()).map_err(|_| FileError::InvalidUtf8)?))
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.get(&id).cloned().ok_or_else(|| FileError::NotFound(PathBuf::from(format!("{id:?}"))))
    }
    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }
    fn today(&self, _: Option<Duration>) -> Option<Datetime> {
        Datetime::from_ymd(2026, 11, 2)
    }
}

/// WOFF 1.0 → an OpenType file (each table is zlib-compressed or stored), so Typst can use the Literata that ships with
/// the UI (`@fontsource/literata`, SIL Open Font License).
fn woff_to_otf(woff: &[u8]) -> Vec<u8> {
    use std::io::Read;
    let u32_at = |o: usize| u32::from_be_bytes(woff[o..o + 4].try_into().unwrap());
    let u16_at = |o: usize| u16::from_be_bytes(woff[o..o + 2].try_into().unwrap());
    assert_eq!(&woff[0..4], b"wOFF", "not a WOFF 1.0 file");
    let flavor = u32_at(4);
    let n = u16_at(12) as usize;
    let mut tables = vec![];
    for t in 0..n {
        let e = 44 + t * 20;
        let (tag, off, clen, olen, sum) = (u32_at(e), u32_at(e + 4) as usize, u32_at(e + 8) as usize, u32_at(e + 12) as usize, u32_at(e + 16));
        let raw = &woff[off..off + clen];
        let data = if clen < olen {
            let mut out = Vec::with_capacity(olen);
            flate2::read::ZlibDecoder::new(raw).read_to_end(&mut out).unwrap();
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

/// Every piece of text in the laid-out pages, in reading order. Runs on one line join as they are (their spaces are in
/// them); a new line adds a space, except after a word broken at its own hyphen ("Baal-" / "peor").
fn page_text(doc: &PagedDocument) -> String {
    fn walk(frame: &typst::layout::Frame, y0: f64, foot: f64, out: &mut String, last_y: &mut f64) {
        for (pos, item) in frame.items() {
            let y = y0 + pos.y.to_pt();
            match item {
                FrameItem::Group(g) => walk(&g.frame, y, foot, out, last_y),
                FrameItem::Text(_) if y > foot => {} // the page footer, not the text
                FrameItem::Text(t) => {
                    if (y - *last_y).abs() > 0.5 && !out.ends_with('-') {
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
        let foot = p.frame.height().to_pt() - 72.0 * 0.9; // the bottom margin is 1in
        walk(&p.frame, 0.0, foot, &mut s, &mut last);
        s.push(' ');
    }
    s
}

fn squash(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = args.first().map(|s| s.to_uppercase()).unwrap_or("NUM".into());
    let chapter: u32 = args.get(1).map(|s| s.parse()).transpose()?.unwrap_or(25);
    let t_all = Instant::now();

    // The chapter, with the person's highlights from the scratch study folder.
    let bible = Bible::open(&wb_core::default_db_path())?;
    let ch = bible.chapter(&code, chapter)?;
    let m = Study::open(&wb_core::default_study_dir()).and_then(|s| marks::chapter_marks(&s, &code, chapter)).unwrap_or_default();
    let color_of = |v: u32, i: u32| -> Option<&'static str> {
        let mut c = None;
        for h in &m.highlights {
            let a = &h.at;
            let (c2, v2) = (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1));
            let start = (a.c1, a.v1, a.i1.unwrap_or(0));
            let end = (c2, v2, a.i2.or(a.i1).unwrap_or(u32::MAX));
            if start <= (chapter, v, i) && (chapter, v, i) <= end {
                c = hl_color(&h.color); // the last one wins, as in the reader
            }
        }
        c
    };
    let mut paragraphs: Vec<Vec<serde_json::Value>> = vec![vec![]];
    for v in &ch.verses {
        if v.words.first().is_some_and(|w| w.para == "p") && !paragraphs.last().unwrap().is_empty() {
            paragraphs.push(vec![]);
        }
        let words: Vec<_> = v
            .words
            .iter()
            .enumerate()
            .map(|(n, w)| {
                let trail = if n + 1 == v.words.len() { w.trail.trim_end().to_string() } else { w.trail.clone() };
                json!({ "t": format!("{}{}{}", w.lead, w.text, trail), "hl": color_of(v.v, w.i) })
            })
            .collect();
        paragraphs.last_mut().unwrap().push(json!({ "n": v.v.to_string(), "words": words }));
    }
    let reference = format!("{} {}", ch.name, chapter);
    let data = json!({ "reference": reference, "paragraphs": paragraphs });

    // Fonts: Literata from the UI's own package, plus Typst's bundled fonts as a fallback.
    let t_fonts = Instant::now();
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut fonts = vec![];
    for f in ["400-normal", "400-italic", "700-normal", "700-italic"] {
        let woff = std::fs::read(root.join(format!("node_modules/@fontsource/literata/files/literata-latin-{f}.woff")))?;
        fonts.extend(Font::iter(Bytes::new(woff_to_otf(&woff))));
    }
    fonts.extend(typst_assets::fonts().flat_map(|d| Font::iter(Bytes::new(d))));
    let fonts_ms = t_fonts.elapsed().as_secs_f64() * 1000.0;

    let main = id("/main.typ");
    let mut files = HashMap::new();
    files.insert(main, Bytes::from_string(TEMPLATE.to_string()));
    files.insert(id("/data.json"), Bytes::new(serde_json::to_vec(&data)?));
    let world = Spike { library: LazyHash::new(Library::default()), book: LazyHash::new(FontBook::from_fonts(&fonts)), fonts, files, main };

    let mut times = vec![];
    let mut doc = None;
    for _ in 0..3 {
        // The first compile is cold; later ones show what Typst's caching gives a document made again.
        let t = Instant::now();
        let out = typst::compile::<PagedDocument>(&world);
        for w in &out.warnings {
            eprintln!("warning: {}", w.message);
        }
        doc = Some(out.output.map_err(|e| format!("{:?}", e.iter().map(|d| d.message.clone()).collect::<Vec<_>>()))?);
        times.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    let doc = doc.unwrap();
    let t_pdf = Instant::now();
    let pdf = typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default()).map_err(|e| format!("{:?}", e.iter().map(|d| d.message.clone()).collect::<Vec<_>>()))?;
    let pdf_ms = t_pdf.elapsed().as_secs_f64() * 1000.0;

    // Every verse, verbatim, in the pages.
    let text = squash(&page_text(&doc).replace('\u{ad}', ""));
    let verses = bible.verses(&code, chapter, 1, chapter, u32::MAX)?;
    let missing: Vec<u32> = verses.iter().filter(|(_, _, t)| !text.contains(&squash(&t.replace('¶', "¶ ")))).map(|v| v.1).collect();

    let out_dir = root.join("spikes/pdf/out");
    std::fs::create_dir_all(&out_dir)?;
    let path = out_dir.join(format!("{code}-{chapter}.pdf"));
    std::fs::write(&path, &pdf)?;
    // Page 1 as an image too, to look at without a PDF viewer.
    let png = typst_render::render(&doc.pages()[0], &typst_render::RenderOptions { pixel_per_pt: 1.5.into(), render_bleed: false }).encode_png()?;
    std::fs::write(out_dir.join(format!("{code}-{chapter}-page1.png")), png)?;
    let used = doc.pages().len();
    println!("{reference}: {used} page(s), {} KB → {}", pdf.len() / 1024, path.canonicalize()?.display());
    println!("fonts loaded in {fonts_ms:.0} ms; compile {} ms; PDF written in {pdf_ms:.0} ms; total {:.0} ms",
        times.iter().map(|t| format!("{t:.0}")).collect::<Vec<_>>().join(" / "), t_all.elapsed().as_secs_f64() * 1000.0);
    println!("verses checked against the database: {} of {} found verbatim{}", verses.len() - missing.len(), verses.len(),
        if missing.is_empty() { String::new() } else { format!(" (missing: {missing:?})") });
    if !missing.is_empty() {
        std::process::exit(2);
    }
    Ok(())
}
