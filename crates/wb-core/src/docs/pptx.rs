//! Editable PowerPoint slides from the same slide data as the Typst PDF.

use super::{
    deck,
    docx::{esc, unescape},
    look,
    plan::Theme,
};
use crate::{Error, Result};
use serde_json::Value;
use std::io::{Read, Write};
use std::path::Path;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const A: &str = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P: &str = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const RELS: &str = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT: &str = "http://schemas.openxmlformats.org/package/2006/content-types";
const TYPES: &str = "application/vnd.openxmlformats-officedocument.presentationml.";
const GROUP: &str =
    r#"<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>"#;
const MAP: &str = r#"bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink""#;
const MAP_OVERRIDE: &str = "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>";

fn error(err: impl std::fmt::Display) -> Error {
    Error(format!("PowerPoint file: {err}"))
}

fn put(zip: &mut ZipWriter<std::fs::File>, path: &str, content: &str) -> Result<()> {
    if content.chars().any(|ch| matches!(ch, '\u{0000}'..='\u{0008}' | '\u{000B}' | '\u{000C}' | '\u{000E}'..='\u{001F}' | '\u{FFFE}' | '\u{FFFF}')) {
        return Err(error("a slide contains a character that cannot be stored in PowerPoint"));
    }
    zip.start_file(
        path,
        SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated),
    )
    .map_err(error)?;
    zip.write_all(br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#)?;
    zip.write_all(content.as_bytes())?;
    Ok(())
}

fn relationships(items: &[(&str, &str, &str)]) -> String {
    let mut xml = format!(r#"<Relationships xmlns="{RELS}">"#);
    for (id, kind, target) in items {
        xml += &format!(r#"<Relationship Id="{id}" Type="{R}/{kind}" Target="{target}"/>"#);
    }
    xml + "</Relationships>"
}

fn theme_xml(theme: &Theme, fonts: (&str, &str)) -> String {
    let mut colors = String::new();
    for (key, color) in [
        ("dk1", theme.ink),
        ("lt1", theme.paper),
        ("dk2", "343434"),
        ("lt2", "eeeeee"),
        ("accent1", theme.accent),
        ("accent2", theme.accent2),
        ("accent3", "368555"),
        ("accent4", "854592"),
        ("accent5", "cc6333"),
        ("accent6", "4679bd"),
        ("hlink", "0563c1"),
        ("folHlink", "954f72"),
    ] {
        colors += &format!(r#"<a:{key}><a:srgbClr val="{color}"/></a:{key}>"#);
    }
    let font = |key: &str, family: &str| {
        format!(
            r#"<a:{key}><a:latin typeface="{}"/><a:ea typeface=""/><a:cs typeface=""/></a:{key}>"#,
            esc(family)
        )
    };
    let fill = r#"<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>"#;
    let lines = [6350, 12700, 19050]
        .iter()
        .map(|w| format!(r#"<a:ln w="{w}">{fill}</a:ln>"#))
        .collect::<String>();
    format!(
        r#"<a:theme xmlns:a="{A}" name="Bible Workbench"><a:themeElements>
        <a:clrScheme name="Bible Workbench">{colors}</a:clrScheme>
        <a:fontScheme name="Bible Workbench">{}{}</a:fontScheme>
        <a:fmtScheme name="Bible Workbench"><a:fillStyleLst>{}</a:fillStyleLst>
        <a:lnStyleLst>{lines}</a:lnStyleLst><a:effectStyleLst>{}</a:effectStyleLst>
        <a:bgFillStyleLst>{}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>"#,
        font("majorFont", fonts.0),
        font("minorFont", fonts.1),
        fill.repeat(3),
        "<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3),
        fill.repeat(3)
    )
}

#[derive(Clone, Copy)]
struct Text<'a> {
    font: &'a str,
    size: i64,
    color: &'a str,
    bold: bool,
}

impl Text<'_> {
    fn run(&self, value: &str, highlight: Option<&str>) -> String {
        let color = |v| format!(r#"<a:srgbClr val="{v}"/>"#);
        let highlight = highlight
            .map(|v| format!("<a:highlight>{}</a:highlight>", color(v)))
            .unwrap_or_default();
        format!(
            r#"<a:r><a:rPr sz="{}" b="{}"><a:solidFill>{}</a:solidFill>{highlight}<a:latin typeface="{}"/></a:rPr><a:t>{}</a:t></a:r>"#,
            self.size * 100,
            u8::from(self.bold),
            color(self.color),
            esc(self.font),
            esc(value)
        )
    }
}

fn text_box(id: usize, name: &str, y: i64, height: i64, anchor: &str, runs: &str) -> String {
    let emu = |pt| pt * 12700;
    format!(
        r#"<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="{name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="{}" y="{}"/><a:ext cx="{}" cy="{}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr lIns="0" rIns="0" tIns="0" bIns="0" anchor="{anchor}" wrap="square"><a:normAutofit/></a:bodyPr>
        <a:lstStyle/><a:p>{runs}</a:p></p:txBody></p:sp>"#,
        emu(64),
        emu(y),
        emu(832),
        emu(height)
    )
}

fn line(v: &Value, txt: &Text<'_>, theme: &Theme) -> String {
    let mut runs = String::new();
    if let Some(n) = v["num"].as_str() {
        runs += &txt.run(&format!("{n} "), None);
    }
    for part in v["runs"].as_array().into_iter().flatten() {
        let text = part["t"].as_str().unwrap_or_default();
        if part["mark"] == true {
            runs += &Text {
                color: theme.mark_ink,
                ..*txt
            }
            .run(text, Some(theme.mark));
        } else {
            runs += &txt.run(text, None);
        }
    }
    runs
}

fn slide_xml(slide: &Value, theme: &Theme, look: &look::Look) -> String {
    let (ui, serif) = look.fonts();
    let accent = look::readable(
        if look.accent.is_empty() {
            theme.accent
        } else {
            &look.accent
        },
        theme.paper,
    );
    let label = Text {
        font: ui,
        size: 24,
        color: &accent,
        bold: true,
    };
    let size = slide["size"].as_i64().unwrap_or(24);
    let mut shapes = String::new();
    if slide["kind"] == "verse" {
        let y = if look.reference == "bottom" { 470 } else { 38 };
        shapes += &text_box(
            2,
            "Reference",
            y,
            34,
            "ctr",
            &label.run(slide["ref"].as_str().unwrap_or_default(), None),
        );
        let body = Text {
            font: serif,
            size,
            color: theme.ink,
            bold: false,
        };
        let neighbours = look.neighbours != "hidden";
        let (y, height) = if neighbours { (170, 240) } else { (90, 360) };
        shapes += &text_box(
            3,
            "Verse",
            y,
            height,
            "ctr",
            &line(&slide["verse"], &body, theme),
        );
        if neighbours {
            let muted = Text {
                font: serif,
                size: 20,
                color: theme.muted,
                bold: false,
            };
            for (id, key, y, h) in [(4, "before", 84, 78), (5, "after", 420, 84)] {
                if !slide[key].is_null() {
                    shapes += &text_box(id, key, y, h, "ctr", &line(&slide[key], &muted, theme));
                }
            }
        }
    } else {
        let section = slide["kind"] == "section";
        let (y, height, anchor) = if section {
            (214, 110, "t")
        } else {
            (176, 130, "b")
        };
        let heading = Text {
            font: ui,
            size,
            color: theme.ink,
            bold: true,
        };
        shapes += &text_box(
            2,
            "Title",
            y,
            height,
            anchor,
            &heading.run(slide["title"].as_str().unwrap_or_default(), None),
        );
        if let Some(subtitle) = slide["sub"].as_str().filter(|t| !t.is_empty()) {
            shapes += &text_box(3, "Subtitle", 318, 60, "t", &label.run(subtitle, None));
        }
    }
    let paper = theme.paper;
    format!(
        r#"<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld>
        <p:bg><p:bgPr><a:solidFill><a:srgbClr val="{paper}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
        <p:spTree>{GROUP}{shapes}</p:spTree></p:cSld>{MAP_OVERRIDE}</p:sld>"#
    )
}

pub fn write(plan: &[Value], theme: &Theme, look: &look::Look, path: &Path) -> Result<usize> {
    let slides = deck::slides_data(plan, theme, look);
    if slides.len() != plan.len() {
        return Err(error("the slide plan contains an unsupported slide"));
    }
    let mut zip = ZipWriter::new(std::fs::File::create(path)?);
    let mut types = format!(
        r#"<Types xmlns="{CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>"#
    );
    for (part, kind) in [
        ("presentation.xml", "presentation.main"),
        ("presProps.xml", "presProps"),
        ("slideMasters/slideMaster1.xml", "slideMaster"),
        ("slideLayouts/slideLayout1.xml", "slideLayout"),
    ] {
        types += &format!(r#"<Override PartName="/ppt/{part}" ContentType="{TYPES}{kind}+xml"/>"#);
    }
    types += r#"<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>"#;
    let mut ids = String::new();
    let mut slide_rels = Vec::new();
    for (i, slide) in slides.iter().enumerate() {
        let n = i + 1;
        types += &format!(
            r#"<Override PartName="/ppt/slides/slide{n}.xml" ContentType="{TYPES}slide+xml"/>"#
        );
        ids += &format!(r#"<p:sldId id="{}" r:id="s{n}"/>"#, 256 + i);
        slide_rels.push((format!("s{n}"), format!("slides/slide{n}.xml")));
        put(
            &mut zip,
            &format!("ppt/slides/slide{n}.xml"),
            &slide_xml(slide, theme, look),
        )?;
        put(
            &mut zip,
            &format!("ppt/slides/_rels/slide{n}.xml.rels"),
            &relationships(&[("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")]),
        )?;
    }
    types += "</Types>";
    put(&mut zip, "[Content_Types].xml", &types)?;
    put(
        &mut zip,
        "_rels/.rels",
        &relationships(&[("rId1", "officeDocument", "ppt/presentation.xml")]),
    )?;
    put(
        &mut zip,
        "ppt/presentation.xml",
        &format!(
            r#"<p:presentation xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}">
        <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{ids}</p:sldIdLst>
        <p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>"#
        ),
    )?;
    let mut rels = vec![
        ("rId1", "slideMaster", "slideMasters/slideMaster1.xml"),
        ("rId2", "presProps", "presProps.xml"),
    ];
    rels.extend(
        slide_rels
            .iter()
            .map(|(id, target)| (id.as_str(), "slide", target.as_str())),
    );
    put(
        &mut zip,
        "ppt/_rels/presentation.xml.rels",
        &relationships(&rels),
    )?;
    put(
        &mut zip,
        "ppt/presProps.xml",
        &format!(r#"<p:presentationPr xmlns:p="{P}"/>"#),
    )?;
    put(
        &mut zip,
        "ppt/slideMasters/slideMaster1.xml",
        &format!(
            r#"<p:sldMaster xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}">
        <p:cSld><p:spTree>{GROUP}</p:spTree></p:cSld><p:clrMap {MAP}/>
        <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/></p:sldMaster>"#
        ),
    )?;
    put(
        &mut zip,
        "ppt/slideMasters/_rels/slideMaster1.xml.rels",
        &relationships(&[
            ("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"),
            ("rId2", "theme", "../theme/theme1.xml"),
        ]),
    )?;
    put(
        &mut zip,
        "ppt/slideLayouts/slideLayout1.xml",
        &format!(
            r#"<p:sldLayout xmlns:p="{P}" xmlns:a="{A}" type="blank" preserve="1">
        <p:cSld name="Blank"><p:spTree>{GROUP}</p:spTree></p:cSld>{MAP_OVERRIDE}</p:sldLayout>"#
        ),
    )?;
    put(
        &mut zip,
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
        &relationships(&[("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")]),
    )?;
    put(
        &mut zip,
        "ppt/theme/theme1.xml",
        &theme_xml(theme, look.fonts()),
    )?;
    zip.finish().map_err(error)?;
    Ok(slides.len())
}

/// Read the editable text of this writer's saved slide parts in slide order.
pub fn file_text(path: &Path, pages: usize) -> Result<String> {
    let mut zip = ZipArchive::new(std::fs::File::open(path)?).map_err(error)?;
    let runs = regex::Regex::new(r"<a:t>([^<]*)</a:t>").unwrap();
    let mut text = String::new();
    for n in 1..=pages {
        let mut xml = String::new();
        zip.by_name(&format!("ppt/slides/slide{n}.xml"))
            .map_err(error)?
            .read_to_string(&mut xml)?;
        for shape in xml.split("</p:sp>") {
            text.extend(runs.captures_iter(shape).map(|r| unescape(&r[1])));
            text.push('\n');
        }
    }
    Ok(text)
}
