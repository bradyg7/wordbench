//! A Word document (.docx) from a plan's paragraphs, written as Office Open XML: the parts the Python app had WordCraft
//! make (craft_render.Doc). All paragraph formatting lives in named styles (Title, Heading 1, Scripture Reference, Slide
//! Cue …), so a person can restyle a finished document in one place, as before; character formatting (a verse number, a
//! Hebrew word) is set on the runs.
//!
//! `file_text` reads a finished file's text back from the file itself, a line per paragraph, for the check that every
//! verse the source holds is in it word for word.

use super::plan::Theme;
use crate::{Error, Result};
use serde_json::Value;
use std::io::{Read, Write};
use std::path::Path;

fn esc(s: &str) -> String {
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

/// The styles, as craft_render.Doc._styles defines them for this theme, body size and line spacing.
fn styles(t: &Theme, size: f64, spacing: f64) -> String {
    let (ink, accent, rule, tint) = (t.doc_ink, t.doc_accent, t.doc_rule, t.doc_tint);
    let (body, h) = (t.body, t.heading);
    let quiet = if t.dark { "666666" } else { t.muted };
    let mut out = vec![
        style("Normal", None, &Chr { font: Some(body), size: Some(size), color: Some(ink), ..NO_CHR }, &Para { after: Some(8.0), line: Some(spacing), ..Default::default() }),
        style("Heading 1", Some("Normal"), &Chr { font: Some(h), size: Some(15.0), color: Some(accent), bold: Some(true), ..NO_CHR },
            &Para { before: Some(20.0), after: Some(6.0), keep_next: true, ..Default::default() }),
        style("Heading 2", Some("Normal"), &Chr { font: Some(h), size: Some(12.0), color: Some(accent), bold: Some(true), ..NO_CHR },
            &Para { before: Some(14.0), after: Some(4.0), keep_next: true, ..Default::default() }),
    ];
    if let Some(band) = t.band_bg {
        let boxed = vec![("top", band, 10.0, 1.0), ("bottom", band, 10.0, 1.0), ("left", band, 10.0, 1.0), ("right", band, 10.0, 1.0)];
        out.push(style("Title", Some("Normal"), &Chr { font: Some(h), size: Some(30.0), color: Some(t.band_ink), bold: Some(false), ..NO_CHR },
            &Para { shading: Some(band), after: Some(0.0), before: Some(0.0), borders: boxed.clone(), indent_left: Some(12.0), indent_right: Some(12.0), ..Default::default() }));
        out.push(style("Subtitle", Some("Normal"), &Chr { font: Some(h), size: Some(11.0), color: Some(t.accent), italic: Some(false), ..NO_CHR },
            &Para { shading: Some(band), before: Some(0.0), after: Some(18.0), borders: boxed, indent_left: Some(12.0), indent_right: Some(12.0), ..Default::default() }));
    } else {
        out.push(style("Title", Some("Normal"), &Chr { font: Some(h), size: Some(30.0), color: Some(t.band_ink), bold: Some(false), ..NO_CHR },
            &Para { after: Some(2.0), before: Some(0.0), borders: vec![("top", accent, 12.0, 3.0)], ..Default::default() }));
        out.push(style("Subtitle", Some("Normal"), &Chr { font: Some(h), size: Some(11.0), color: Some(t.muted), italic: Some(false), ..NO_CHR },
            &Para { after: Some(18.0), ..Default::default() }));
    }
    let bar = ("left", accent, 8.0, 2.25);
    let edge = ("top", tint, 1.0, 0.5); // keeps two blocks apart: Word shades the gap between paragraphs with the same borders
    out.push(style("Scripture Reference", Some("Normal"), &Chr { font: Some(h), size: Some(size - 2.0), color: Some(accent), bold: Some(true), ..NO_CHR },
        &Para { before: Some(10.0), after: Some(0.0), keep_next: true, shading: Some(tint), borders: vec![bar, edge], indent_left: Some(12.0), ..Default::default() }));
    out.push(style("Scripture", Some("Normal"), &Chr { font: Some(body), size: Some(size), color: Some(ink), ..NO_CHR },
        &Para { after: Some(0.0), shading: Some(tint), borders: vec![bar], indent_left: Some(12.0), line: Some(spacing), keep_lines: true, ..Default::default() }));
    out.push(style("Scripture End", Some("Scripture"), &NO_CHR, &Para { after: Some(12.0), ..Default::default() }));
    out.push(style("Plain Reference", Some("Normal"), &Chr { font: Some(h), size: Some(size - 1.0), color: Some(accent), bold: Some(true), ..NO_CHR },
        &Para { before: Some(10.0), after: Some(1.0), keep_next: true, ..Default::default() }));
    out.push(style("Plain Scripture", Some("Normal"), &Chr { font: Some(body), size: Some(size), color: Some(ink), ..NO_CHR },
        &Para { after: Some(6.0), line: Some(spacing), ..Default::default() }));
    let note = |side| (side, rule, 6.0, 0.75);
    out.push(style("Delivery Note", Some("Normal"), &Chr { font: Some(h), size: Some(size - 1.5), color: Some(accent), italic: Some(true), ..NO_CHR },
        &Para { before: Some(2.0), after: Some(10.0), borders: vec![note("top"), note("bottom")], ..Default::default() }));
    out.push(style("Study Note", Some("Normal"), &Chr { font: Some(body), size: Some(size - 1.5), color: Some(ink), ..NO_CHR },
        &Para { before: Some(4.0), after: Some(6.0), indent_left: Some(12.0), ..Default::default() }));
    out.push(style("Slide Cue", Some("Normal"), &Chr { font: Some(h), size: Some(size - 3.0), color: Some(accent), bold: Some(true), ..NO_CHR },
        &Para { before: Some(10.0), after: Some(2.0), keep_next: true, right: true, ..Default::default() }));
    out.push(style("Word Line", Some("Normal"), &NO_CHR, &Para { keep_next: true, ..Default::default() }));
    out.push(style("Footer", Some("Normal"), &Chr { font: Some(h), size: Some(9.0), color: Some(quiet), ..NO_CHR }, &Para::default()));
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="en-US" w:bidi="he-IL"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>{}</w:styles>"#,
        out.join("")
    )
}

/// A run's character formatting (craft_render.Doc.runfmt).
fn run_fmt(fmt: &str, t: &Theme) -> String {
    let a = t.doc_accent;
    match fmt {
        "num" => format!(r#"<w:rPr><w:b/><w:bCs/><w:color w:val="{a}"/><w:vertAlign w:val="superscript"/></w:rPr>"#),
        "mark" => format!(r#"<w:rPr><w:b/><w:bCs/><w:color w:val="{a}"/></w:rPr>"#),
        "lemma" => format!(r#"<w:rPr><w:b/><w:bCs/><w:color w:val="{a}"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>"#),
        _ => String::new(),
    }
}

fn paragraph(op: &Value, t: &Theme) -> String {
    let style = op[1].as_str().unwrap_or("Normal");
    let page_break = op[3] == true;
    let mut x = format!(r#"<w:p><w:pPr><w:pStyle w:val="{}"/>{}</w:pPr>"#, style_id(style), if page_break { "<w:pageBreakBefore/>" } else { "" });
    for r in op[2].as_array().unwrap() {
        let text = r[0].as_str().unwrap_or("");
        let fmt = r[1].as_str().map(|f| run_fmt(f, t)).unwrap_or_default();
        x += &format!(r#"<w:r>{fmt}<w:t xml:space="preserve">{}</w:t></w:r>"#, esc(text));
    }
    x + "</w:p>"
}

const W: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/// The plan's paragraphs as a .docx at `out`, in this theme, with this body size and line spacing.
pub fn write(plan: &[Value], t: &Theme, title: &str, size: f64, spacing: f64, out: &Path) -> Result<()> {
    let body: String = plan.iter().filter(|op| op[0] == "para").map(|op| paragraph(op, t)).collect();
    // margins as WordCraft's layout.margins: 64 pt top and bottom, 72 pt at the sides; US Letter
    let sect = format!(
        r#"<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1280" w:right="1440" w:bottom="1280" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>"#
    );
    let document = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{body}{sect}</w:body></w:document>"#);
    let field = |instr: &str| {
        format!(
            r#"<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>"#
        )
    };
    let footer = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="{W}" xmlns:r="{R}"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">Page </w:t></w:r>{}<w:r><w:t xml:space="preserve"> of </w:t></w:r>{}</w:p></w:ftr>"#,
        field("PAGE"),
        field("NUMPAGES")
    );
    let content_types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>"#;
    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>"#;
    let doc_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>"#;
    // the page count in the footer is a field: Word fills it in when the document opens
    let settings = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="{W}"><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>"#);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    let core = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>{}</dc:title><dc:creator>Bible Workbench</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified></cp:coreProperties>"#,
        esc(title)
    );
    let app = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Bible Workbench</Application></Properties>"#;
    let file = std::fs::File::create(out)?;
    let mut z = zip::ZipWriter::new(file);
    let opt = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for (name, text) in [
        ("[Content_Types].xml", content_types.to_string()),
        ("_rels/.rels", rels.to_string()),
        ("word/document.xml", document),
        ("word/styles.xml", styles(t, size, spacing)),
        ("word/settings.xml", settings),
        ("word/footer1.xml", footer),
        ("word/_rels/document.xml.rels", doc_rels.to_string()),
        ("docProps/core.xml", core),
        ("docProps/app.xml", app.to_string()),
    ] {
        z.start_file(name, opt).map_err(|e| Error(format!("Could not write the Word file ({e}).")))?;
        z.write_all(text.as_bytes())?;
    }
    z.finish().map_err(|e| Error(format!("Could not write the Word file ({e}).")))?;
    Ok(())
}

fn unescape(s: &str) -> String {
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
