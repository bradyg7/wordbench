//! A Word document (.docx) from a plan's paragraphs, written as Office Open XML: the parts the Python app had WordCraft
//! make (craft_render.Doc). All paragraph formatting lives in named styles (Title, Heading 1, Scripture Reference, Slide
//! Cue …), so a person can restyle a finished document in one place, as before; character formatting (a verse number, a
//! Hebrew word) is set on the runs.
//!
//! `file_text` reads a finished file's text back from the file itself, a line per paragraph, for the check that every
//! verse the source holds is in it word for word.

use super::look::Look;
use super::plan::Theme;
use crate::{Error, Result};
use serde_json::Value;
use std::io::{Read, Write};
use std::path::Path;

pub(super) fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// A style's character properties: font, size (pt), color, bold, italic.
struct Chr<'a> {
    font: Option<&'a str>,
    size: Option<f64>,
    color: Option<&'a str>,
    bold: Option<bool>,
    italic: Option<bool>,
}

const NO_CHR: Chr = Chr { font: None, size: None, color: None, bold: None, italic: None };

#[derive(Default)]
struct Para<'a> {
    before: Option<f64>,
    after: Option<f64>,
    line: Option<f64>,
    keep_next: bool,
    keep_lines: bool,
    shading: Option<&'a str>,
    /// (side, color, space pt, width pt)
    borders: Vec<(&'static str, &'a str, f64, f64)>,
    indent_left: Option<f64>,
    indent_right: Option<f64>,
    right: bool,
    center: bool,
}

fn rpr(c: &Chr) -> String {
    let mut x = String::new();
    if let Some(f) = c.font {
        x += &format!(r#"<w:rFonts w:ascii="{0}" w:hAnsi="{0}" w:cs="{0}" w:eastAsia="{0}"/>"#, esc(f));
    }
    if let Some(b) = c.bold {
        x += if b { "<w:b/><w:bCs/>" } else { r#"<w:b w:val="0"/><w:bCs w:val="0"/>"# };
    }
    if let Some(i) = c.italic {
        x += if i { "<w:i/><w:iCs/>" } else { r#"<w:i w:val="0"/><w:iCs w:val="0"/>"# };
    }
    if let Some(col) = c.color {
        x += &format!(r#"<w:color w:val="{col}"/>"#);
    }
    if let Some(s) = c.size {
        let hp = (s * 2.0).round() as i64;
        x += &format!(r#"<w:sz w:val="{hp}"/><w:szCs w:val="{hp}"/>"#);
    }
    if x.is_empty() { x } else { format!("<w:rPr>{x}</w:rPr>") }
}

fn twips(pt: f64) -> i64 {
    (pt * 20.0).round() as i64
}

fn ppr(p: &Para) -> String {
    let mut x = String::new();
    if p.keep_next {
        x += "<w:keepNext/>";
    }
    if p.keep_lines {
        x += "<w:keepLines/>";
    }
    if !p.borders.is_empty() {
        x += "<w:pBdr>";
        for side in ["top", "left", "bottom", "right"] {
            if let Some((_, color, space, width)) = p.borders.iter().find(|b| b.0 == side) {
                x += &format!(r#"<w:{side} w:val="single" w:sz="{}" w:space="{}" w:color="{color}"/>"#, (width * 8.0).round() as i64, space.round() as i64);
            }
        }
        x += "</w:pBdr>";
    }
    if let Some(fill) = p.shading {
        x += &format!(r#"<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>"#);
    }
    if p.before.is_some() || p.after.is_some() || p.line.is_some() {
        x += "<w:spacing";
        if let Some(b) = p.before {
            x += &format!(r#" w:before="{}""#, twips(b));
        }
        if let Some(a) = p.after {
            x += &format!(r#" w:after="{}""#, twips(a));
        }
        if let Some(l) = p.line {
            x += &format!(r#" w:line="{}" w:lineRule="auto""#, (l * 240.0).round() as i64);
        }
        x += "/>";
    }
    if p.indent_left.is_some() || p.indent_right.is_some() {
        x += "<w:ind";
        if let Some(l) = p.indent_left {
            x += &format!(r#" w:left="{}""#, twips(l));
        }
        if let Some(r) = p.indent_right {
            x += &format!(r#" w:right="{}""#, twips(r));
        }
        x += "/>";
    }
    if p.right {
        x += r#"<w:jc w:val="right"/>"#;
    } else if p.center {
        x += r#"<w:jc w:val="center"/>"#;
    }
    if x.is_empty() { x } else { format!("<w:pPr>{x}</w:pPr>") }
}

fn style_id(name: &str) -> String {
    name.replace(' ', "")
}

fn style(name: &str, base: Option<&str>, c: &Chr, p: &Para) -> String {
    let id = style_id(name);
    let shown = match name {
        "Heading 1" => "heading 1",
        "Heading 2" => "heading 2",
        "Footer" => "footer",
        _ => name,
    };
    let base = base.map(|b| format!(r#"<w:basedOn w:val="{}"/>"#, style_id(b))).unwrap_or_default();
    let q = if name == "Normal" { r#" w:default="1""# } else { "" };
    format!(r#"<w:style w:type="paragraph"{q} w:styleId="{id}"><w:name w:val="{shown}"/>{base}<w:qFormat/>{}{}</w:style>"#, ppr(p), rpr(c))
}

/// The design of the files this app writes (docs/redesign-R3.md): 1 was WordCraft's, 2 is the in-app preview's look.
pub const DESIGN: i64 = 2;
/// The two fonts that travel (embedded in the file: `fonts_part`): scripture, and everything else.
pub const SCRIPTURE_FONT: &str = "Literata";
pub const UI_FONT: &str = "Inter";
const INK: &str = "222222";
const QUIET: &str = "777777";
const NOTE: &str = "666666";
const FOOT: &str = "999999";

/// Colors of the text that is not scripture or a heading, by ink mode: (quiet, note, footer).
fn greys(look: &Look) -> (&'static str, &'static str, &'static str) {
    match look.ink.as_str() {
        "black" => ("000000", "000000", "000000"),
        "saver" => ("666666", "555555", "777777"),
        _ => (QUIET, NOTE, FOOT),
    }
}

/// The styles of R3's sheet D1 with a Look's dials applied (D10): its typeface pair, accent (readable on white, D15),
/// size, spacing, title, the rule under it, and ink. `size` is the structure's body size (12 is the base; the Speaker
/// Script's 14 makes everything 1.17 x larger).
fn styles(t: &Theme, look: &Look, size: f64, spacing: f64) -> String {
    let accent = look.text_accent(t.doc_accent);
    let accent = accent.as_str();
    let rule = look.rule_accent(t.doc_accent);
    let (quiet, note, foot) = greys(look);
    let ink = if look.ink == "black" { "000000" } else { INK };
    let k = size / 12.0 * look.scale();
    let pt = |p: f64| (p * k * 2.0).round() / 2.0;
    let (sans, serif) = look.fonts();
    // Word's "multiple" spacing is of the font's own line height (Literata's is tall), so 1.15 reads as the preview's 1.5
    let line = (if spacing > 1.3 { 1.15 } else { 1.08 }) * look.spacing_factor();
    let gap = look.spacing_factor();
    let center = look.title == "center";
    let under: Vec<(&'static str, &str, f64, f64)> = match (&rule, look.under_title.as_str()) {
        (Some(c), "rule") => vec![("bottom", c.as_str(), 6.0, 0.75)],
        _ => vec![],
    };
    let out = vec![
        style("Normal", None, &Chr { font: Some(sans), size: Some(pt(11.0)), color: Some(ink), ..NO_CHR }, &Para { after: Some(8.0 * gap), line: Some(line), ..Default::default() }),
        style("Title", Some("Normal"), &Chr { font: Some(sans), size: Some(pt(20.0)), color: Some(ink), bold: Some(true), ..NO_CHR },
            &Para { before: Some(0.0), after: Some(2.0), line: Some(1.15), center, ..Default::default() }),
        style("Subtitle", Some("Normal"), &Chr { font: Some(sans), size: Some(pt(10.0)), color: Some(quiet), ..NO_CHR },
            &Para { after: Some(14.0 * gap), center, borders: under, ..Default::default() }),
        style("Heading 1", Some("Normal"), &Chr { font: Some(sans), size: Some(pt(15.0)), color: Some(ink), bold: Some(true), ..NO_CHR },
            &Para { before: Some(16.0 * gap), after: Some(4.0), line: Some(1.2), keep_next: true, ..Default::default() }),
        style("Heading 2", Some("Normal"), &Chr { font: Some(sans), size: Some(pt(12.0)), color: Some(ink), bold: Some(true), ..NO_CHR },
            &Para { before: Some(12.0 * gap), after: Some(3.0), line: Some(1.2), keep_next: true, ..Default::default() }),
        style("Slide Cue", Some("Normal"), &Chr { font: Some(UI_FONT), size: Some(pt(8.5)), color: Some(accent), bold: Some(true), ..NO_CHR },
            &Para { before: Some(10.0 * gap), after: Some(2.0), keep_next: true, ..Default::default() }),
        style("Scripture Reference", Some("Normal"), &Chr { font: Some(UI_FONT), size: Some(pt(10.0)), color: Some(accent), bold: Some(true), ..NO_CHR },
            &Para { before: Some(10.0 * gap), after: Some(2.0), keep_next: true, ..Default::default() }),
        style("Scripture", Some("Normal"), &Chr { font: Some(serif), size: Some(pt(12.0)), color: Some(ink), ..NO_CHR },
            &Para { after: Some(4.0 * gap), line: Some(line), keep_lines: true, ..Default::default() }),
        style("Scripture End", Some("Scripture"), &NO_CHR, &Para { after: Some(12.0 * gap), ..Default::default() }),
        style("Plain Reference", Some("Scripture Reference"), &NO_CHR, &Para::default()),
        style("Plain Scripture", Some("Scripture"), &NO_CHR, &Para { after: Some(6.0 * gap), ..Default::default() }),
        style("Delivery Note", Some("Normal"), &Chr { font: Some(UI_FONT), size: Some(pt(10.0)), color: Some(accent), italic: Some(true), ..NO_CHR },
            &Para { before: Some(2.0), after: Some(10.0 * gap), ..Default::default() }),
        style("Study Note", Some("Normal"), &Chr { font: Some(UI_FONT), size: Some(pt(10.0)), color: Some(note), ..NO_CHR },
            &Para { before: Some(2.0), after: Some(6.0 * gap), indent_left: Some(9.0), line: Some(1.1), ..Default::default() }),
        style("Word Line", Some("Normal"), &NO_CHR, &Para { keep_next: true, ..Default::default() }),
        // room to write (the Study Sheet): a ruled line, grey, or none in Black only's place of a light grey
        style("Write Line", Some("Normal"), &NO_CHR, &Para { before: Some(14.0), after: Some(0.0), borders: vec![("bottom", if look.ink == "black" { "000000" } else { "BBBBBB" }, 1.0, 0.5)], ..Default::default() }),
        style("Header", Some("Normal"), &Chr { font: Some(UI_FONT), size: Some(8.5), color: Some(foot), ..NO_CHR }, &Para { after: Some(0.0), ..Default::default() }),
        style("Footer", Some("Normal"), &Chr { font: Some(UI_FONT), size: Some(9.0), color: Some(foot), ..NO_CHR }, &Para::default()),
    ];
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="en-US" w:bidi="he-IL"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>{}</w:styles>"#,
        out.join("")
    )
}

/// The fonts embedded in the file (ECMA-376 §17.8.1): (family, kind, the bundled WOFF, the key that obfuscates it, the
/// fallback a reader without embedded fonts uses). Only the Latin subsets: the text is English, and Word falls back
/// character by character for anything outside them.
const EMBED: [(&str, &str, &[u8], &str); 5] = [
    (SCRIPTURE_FONT, "Regular", include_bytes!("../../fonts/literata-latin-400-normal.woff"), "{5E1A7C21-3B0D-4F6A-9C11-2D7B8E4A0001}"),
    (SCRIPTURE_FONT, "Bold", include_bytes!("../../fonts/literata-latin-700-normal.woff"), "{5E1A7C21-3B0D-4F6A-9C11-2D7B8E4A0002}"),
    (SCRIPTURE_FONT, "Italic", include_bytes!("../../fonts/literata-latin-400-italic.woff"), "{5E1A7C21-3B0D-4F6A-9C11-2D7B8E4A0003}"),
    (UI_FONT, "Regular", include_bytes!("../../fonts/inter-latin-400-normal.woff"), "{5E1A7C21-3B0D-4F6A-9C11-2D7B8E4A0004}"),
    (UI_FONT, "Bold", include_bytes!("../../fonts/inter-latin-600-normal.woff"), "{5E1A7C21-3B0D-4F6A-9C11-2D7B8E4A0005}"),
];

/// A font obfuscated as ECMA-376 §17.8.1 says: the first 32 bytes XORed with the key's 16 bytes, read from the GUID's
/// hex digits in reverse order.
fn obfuscate(font: &[u8], guid: &str) -> Vec<u8> {
    let hex: String = guid.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    let bytes: Vec<u8> = (0..16).map(|i| u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).unwrap()).collect();
    let key: Vec<u8> = bytes.iter().rev().copied().collect();
    let mut out = font.to_vec();
    for i in 0..32.min(out.len()) {
        out[i] ^= key[i % 16];
    }
    out
}

/// fontTable.xml with each family's embedded files and its fallback, its relationships, and the font parts.
fn fonts_part() -> (String, String, Vec<(String, Vec<u8>)>) {
    let mut table = String::new();
    let mut rels = String::new();
    let mut files = vec![];
    for (family, alt, generic) in [(SCRIPTURE_FONT, "Georgia", "roman"), (UI_FONT, "Segoe UI", "swiss")] {
        let mut embeds = String::new();
        for (i, (f, kind, woff, guid)) in EMBED.iter().enumerate() {
            if *f != family {
                continue;
            }
            let id = format!("rIdFont{}", i + 1);
            embeds += &format!(r#"<w:embed{kind} r:id="{id}" w:fontKey="{guid}"/>"#);
            rels += &format!(r#"<Relationship Id="{id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font{}.odttf"/>"#, i + 1);
            files.push((format!("word/fonts/font{}.odttf", i + 1), obfuscate(&super::deck::woff_to_otf(woff), guid)));
        }
        table += &format!(r#"<w:font w:name="{family}"><w:altName w:val="{alt}"/><w:charset w:val="00"/><w:family w:val="{generic}"/><w:pitch w:val="variable"/>{embeds}</w:font>"#);
    }
    let table = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="{W}" xmlns:r="{R}">{table}</w:fonts>"#);
    let rels = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>"#);
    (table, rels, files)
}

/// A run's character formatting (craft_render.Doc.runfmt), with the Look's verse numbers and ink: a highlight ("mark")
/// is the accent in full color, and an underline in the ink-saving modes (D13).
fn run_fmt(fmt: &str, t: &Theme, look: &Look) -> String {
    let a = look.text_accent(t.doc_accent);
    let num = if look.numbers == "plain" { if look.ink == "black" { "000000".to_string() } else { "555555".to_string() } } else { a.clone() };
    match fmt {
        "num" => format!(r#"<w:rPr><w:rFonts w:ascii="{UI_FONT}" w:hAnsi="{UI_FONT}"/><w:b/><w:bCs/><w:color w:val="{num}"/><w:vertAlign w:val="superscript"/></w:rPr>"#),
        "mark" if look.ink != "full" => format!(r#"<w:rPr><w:u w:val="single" w:color="{a}"/></w:rPr>"#),
        "mark" => format!(r#"<w:rPr><w:b/><w:bCs/><w:color w:val="{a}"/></w:rPr>"#),
        "lemma" => format!(r#"<w:rPr><w:b/><w:bCs/><w:color w:val="{a}"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>"#),
        _ => String::new(),
    }
}

fn paragraph(op: &Value, t: &Theme, look: &Look, page_break: bool) -> String {
    let style = op[1].as_str().unwrap_or("Normal");
    let page_break = page_break || op[3] == true;
    let mut x = format!(r#"<w:p><w:pPr><w:pStyle w:val="{}"/>{}</w:pPr>"#, style_id(style), if page_break { "<w:pageBreakBefore/>" } else { "" });
    for r in op[2].as_array().unwrap() {
        let text = r[0].as_str().unwrap_or("");
        let fmt = r[1].as_str().map(|f| run_fmt(f, t, look)).unwrap_or_default();
        x += &format!(r#"<w:r>{fmt}<w:t xml:space="preserve">{}</w:t></w:r>"#, esc(text));
    }
    x + "</w:p>"
}

const W: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/// Whether a plan is scripture only (two columns are used only then, D14).
pub fn scripture_only(plan: &[Value]) -> bool {
    plan.iter().filter(|op| op[0] == "para").all(|op| {
        matches!(op[1].as_str().unwrap_or(""), "Title" | "Subtitle" | "Heading 1" | "Heading 2" | "Scripture Reference" | "Scripture" | "Scripture End" | "Plain Reference" | "Plain Scripture")
    })
}

/// The plan's paragraphs as a .docx at `out`, in this theme and Look, with this body size and line spacing.
pub fn write(plan: &[Value], t: &Theme, look: &Look, title: &str, size: f64, spacing: f64, out: &Path) -> Result<()> {
    let paras: Vec<&Value> = plan.iter().filter(|op| op[0] == "para").collect();
    // a cover page: the title and subtitle alone on page 1 (D14); the first paragraph after them starts page 2
    let after_cover = if look.cover { paras.iter().position(|op| !matches!(op[1].as_str(), Some("Title" | "Subtitle"))) } else { None };
    let body: String = paras.iter().enumerate().map(|(i, op)| paragraph(op, t, look, Some(i) == after_cover && i > 0)).collect();
    let (w, h) = if look.paper == "a4" { (11906, 16838) } else { (12240, 15840) };
    let cols = if look.columns == 2 && scripture_only(plan) { r#"<w:cols w:num="2" w:space="567"/>"# } else { "" };
    let footer_ref = if look.page_numbers == "none" { "" } else { r#"<w:footerReference w:type="default" r:id="rIdFooter"/>"# };
    // the running head: the title, small, on every page after the first (titlePg gives page 1 its own, empty header)
    let header_ref = if look.running_head {
        r#"<w:headerReference w:type="default" r:id="rIdHeader"/><w:headerReference w:type="first" r:id="rIdHeaderFirst"/>"#
    } else {
        ""
    };
    let first_footer = if look.running_head && !footer_ref.is_empty() { r#"<w:footerReference w:type="first" r:id="rIdFooter"/>"# } else { "" };
    let title_pg = if look.running_head { "<w:titlePg/>" } else { "" };
    let sect = format!(
        r#"<w:sectPr>{header_ref}{footer_ref}{first_footer}<w:pgSz w:w="{w}" w:h="{h}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>{cols}{title_pg}</w:sectPr>"#
    );
    let document = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{body}{sect}</w:body></w:document>"#);
    let field = |instr: &str| {
        format!(
            r#"<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>"#
        )
    };
    let numbers = if look.page_numbers == "plain" {
        field("PAGE")
    } else {
        format!(r#"<w:r><w:t xml:space="preserve">Page </w:t></w:r>{}<w:r><w:t xml:space="preserve"> of </w:t></w:r>{}"#, field("PAGE"), field("NUMPAGES"))
    };
    let footer = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="{W}" xmlns:r="{R}"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>{numbers}</w:p></w:ftr>"#
    );
    let header = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="{W}" xmlns:r="{R}"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:t xml:space="preserve">{}</w:t></w:r></w:p></w:hdr>"#,
        esc(title)
    );
    let header_first = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="{W}" xmlns:r="{R}"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>"#);
    let content_types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>"#;
    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>"#;
    let doc_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdHeaderFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rIdFontTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>"#;
    // the page count in the footer is a field: Word fills it in when the document opens
    let settings = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="{W}"><w:embedTrueTypeFonts/><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>"#);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    let core = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>{}</dc:title><dc:creator>Bible Workbench</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified></cp:coreProperties>"#,
        esc(title)
    );
    let app = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Bible Workbench</Application></Properties>"#;
    let (font_table, font_rels, font_files) = fonts_part();
    let file = std::fs::File::create(out)?;
    let mut z = zip::ZipWriter::new(file);
    let opt = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for (name, text) in [
        ("[Content_Types].xml", content_types.to_string()),
        ("_rels/.rels", rels.to_string()),
        ("word/document.xml", document),
        ("word/styles.xml", styles(t, look, size, spacing)),
        ("word/header1.xml", header),
        ("word/header2.xml", header_first),
        ("word/settings.xml", settings),
        ("word/footer1.xml", footer),
        ("word/_rels/document.xml.rels", doc_rels.to_string()),
        ("docProps/core.xml", core),
        ("docProps/app.xml", app.to_string()),
        ("word/fontTable.xml", font_table),
        ("word/_rels/fontTable.xml.rels", font_rels),
    ] {
        z.start_file(name, opt).map_err(|e| Error(format!("Could not write the Word file ({e}).")))?;
        z.write_all(text.as_bytes())?;
    }
    for (name, bytes) in font_files {
        z.start_file(name, opt).map_err(|e| Error(format!("Could not write the Word file ({e}).")))?;
        z.write_all(&bytes)?;
    }
    z.finish().map_err(|e| Error(format!("Could not write the Word file ({e}).")))?;
    Ok(())
}

pub(super) fn unescape(s: &str) -> String {
    let re = regex::Regex::new(r"&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);").unwrap();
    re.replace_all(s, |c: &regex::Captures| match &c[1] {
        "amp" => "&".to_string(),
        "lt" => "<".into(),
        "gt" => ">".into(),
        "quot" => "\"".into(),
        "apos" => "'".into(),
        n if n.starts_with("#x") => u32::from_str_radix(&n[2..], 16).ok().and_then(char::from_u32).map(String::from).unwrap_or_default(),
        n => n[1..].parse().ok().and_then(char::from_u32).map(String::from).unwrap_or_default(),
    })
    .into_owned()
}

/// A saved .docx's paragraphs, read from the file itself, for a preview (W6): each one's style (as its id: "Heading1",
/// "SlideCue" …) and runs ({t, num: a verse number}).
pub fn paragraphs(path: &Path) -> Result<Value> {
    let f = std::fs::File::open(path)?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| Error(format!("Not a Word file ({e}).")))?;
    let mut xml = String::new();
    z.by_name("word/document.xml").map_err(|e| Error(format!("Not a Word file ({e}).")))?.read_to_string(&mut xml)?;
    let style = regex::Regex::new(r#"<w:pStyle w:val="([^"]*)"/>"#).unwrap();
    let run = regex::Regex::new(r"(?s)<w:r>(.*?)</w:r>").unwrap();
    let t = regex::Regex::new(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>").unwrap();
    let body = xml.split("<w:body>").nth(1).unwrap_or("");
    let mut out = vec![];
    for p in body.split("</w:p>").filter(|p| p.contains("<w:p>") || p.contains("<w:p ")) {
        let st = style.captures(p).map(|c| c[1].to_string()).unwrap_or_else(|| "Normal".into());
        let runs: Vec<Value> = run
            .captures_iter(p)
            .filter_map(|r| {
                let text: String = t.captures_iter(&r[1]).map(|c| unescape(&c[1])).collect();
                (!text.is_empty()).then(|| serde_json::json!({"t": text, "num": r[1].contains("superscript")}))
            })
            .collect();
        out.push(serde_json::json!({"style": st, "runs": runs}));
    }
    Ok(Value::Array(out))
}

/// The text of a saved .docx, read from the file itself, a line per paragraph, however its runs are cut up
/// (craft_render.file_text).
pub fn file_text(path: &Path) -> Result<String> {
    let f = std::fs::File::open(path)?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| Error(format!("Not a Word file ({e}).")))?;
    let mut xml = String::new();
    z.by_name("word/document.xml").map_err(|e| Error(format!("Not a Word file ({e}).")))?.read_to_string(&mut xml)?;
    let t = regex::Regex::new(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>").unwrap();
    let lines: Vec<String> = xml
        .split("</w:p>")
        .map(|p| super::squash(&unescape(&t.captures_iter(p).map(|c| c[1].to_string()).collect::<String>())))
        .collect();
    Ok(lines.join("\n"))
}
