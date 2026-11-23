//! A standalone print PDF of a chapter, with the reader's marks and existing notes.

use super::{deck, missing_verses, plan::Margin, safe_stem, unique, ExportFolders};
use crate::bible::{Bible, Verse};
use crate::marks::{chapter_marks, Mark};
use crate::places::parse_span;
use crate::store::{bad, guard, Store};
use crate::{scripture, studyapi, Result};
use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};

const TEMPLATE: &str = r##"
#let d = json("data.json")
#set document(title: d.title)
#set page(paper: "us-letter", margin: (x: 16mm, y: 18mm))
#set text(font: "Literata", size: 12pt, hyphenate: false, ligatures: false, lang: "en")
#set par(leading: 0.55em)
#text(font: "Inter", size: 10pt, weight: 600, fill: rgb("#444444"))[#d.title · King James Version · #d.date]
#line(length: 100%, stroke: 0.5pt + rgb("#999999"))
#text(size: 20pt, weight: 700)[#d.title]
#parbreak()
#if d.subtitle != none { emph(d.subtitle); parbreak() }
#for v in d.verses {
  let line = [
    #super(text(font: "Inter", fill: rgb("#555555"), v.number))#h(0.3em)
    #for r in v.runs {
      let body = text(fill: if r.red { rgb("#8a1c14") } else { black }, style: if r.italic { "italic" } else { "normal" }, r.text)
      if r.smallcaps { body = smallcaps(body) }
      if r.highlight != "" { body = highlight(fill: rgb(r.highlight).lighten(50%), extent: 1pt, body) }
      for (i, color) in r.underlines.enumerate() {
        body = underline(stroke: 0.65pt + rgb(color), offset: 2pt + i * 1pt, evade: false, body)
      }
      body
    }
  ]
  if v.indent > 0 {
    parbreak()
    pad(left: v.indent * 1em, line)
    parbreak()
  } else {
    if v.paragraph { parbreak() }
    line
    [ ]
  }
}
#if d.notes.len() > 0 [
  #parbreak()
  #line(length: 100%, stroke: 0.5pt + rgb("#999999"))
  #text(font: "Inter", size: 11pt, weight: 600)[My notes on this chapter]
  #for n in d.notes [
    #parbreak()
    #text(font: "Inter", size: 10pt, weight: 600, n.label)
    #if n.excerpt != "" [ #emph(n.excerpt)]
    #linebreak()
    #text(size: 10.5pt, n.text)
  ]
]
#parbreak()
#text(font: "Inter", size: 8pt, fill: rgb("#666666"))[Text: KJV (eBible.org / CrossWire).]
"##;

#[derive(Clone, Default, PartialEq)]
struct Style {
    red: bool,
    italic: bool,
    smallcaps: bool,
    highlight: String,
    underlines: Vec<String>,
}

fn color(value: &str) -> &str {
    match value {
        "yellow" => "#ecc93c",
        "green" => "#60b260",
        "blue" => "#5694d6",
        "pink" => "#dc64a0",
        "orange" => "#e88c3c",
        c if c.len() == 7
            && c.starts_with('#')
            && c[1..].bytes().all(|x| x.is_ascii_hexdigit()) =>
        {
            c
        }
        _ => "",
    }
}

fn paint(
    margin: &mut Margin<'_>,
    verse: &Value,
    styles: &mut [Style],
    marks: &[Mark],
    underline: bool,
) {
    for mark in marks {
        let color = color(&mark.color);
        if color.is_empty() {
            continue;
        }
        let at = json!(&mark.at);
        for (start, end) in margin.anchor_spans(verse, at.as_object().unwrap()) {
            let Some(span) = styles.get_mut(start..end) else {
                continue;
            };
            for style in span {
                if underline {
                    if !style.underlines.iter().any(|c| c == color) {
                        style.underlines.push(color.into());
                    }
                } else {
                    style.highlight = color.into();
                }
            }
        }
    }
}

fn chapter_verse(
    margin: &mut Margin<'_>,
    book: i64,
    chapter: i64,
    verse: &Value,
    words: Option<&Verse>,
    highlights: &[Mark],
    threads: &[Mark],
) -> Value {
    let text = verse["text"].as_str().unwrap();
    let chars: Vec<char> = text.chars().collect();
    let mut styles = vec![Style::default(); chars.len()];
    let number = verse["v"].as_i64().unwrap();
    if let Some(words) = words {
        if let Some(offsets) = margin.word_offsets(book, chapter, number, text) {
            for (word, (start, end)) in words.words.iter().zip(offsets) {
                let Some(span) = styles.get_mut(start..end) else {
                    continue;
                };
                for style in span {
                    style.red = word.wj;
                    style.italic = word.italic;
                    style.smallcaps = word.nd;
                }
            }
        }
    }
    paint(margin, verse, &mut styles, highlights, false);
    paint(margin, verse, &mut styles, threads, true);
    let mut runs = Vec::new();
    let mut start = 0;
    while start < chars.len() {
        let style = &styles[start];
        let end = start + styles[start..].iter().take_while(|s| *s == style).count();
        runs.push(json!({"text": chars[start..end].iter().collect::<String>(), "red": style.red, "italic": style.italic,
            "smallcaps": style.smallcaps, "highlight": style.highlight, "underlines": style.underlines}));
        start = end;
    }
    let para = words
        .and_then(|v| v.words.first())
        .map(|w| w.para.as_str())
        .unwrap_or("");
    let indent = match para {
        "q1" => 1,
        "q2" => 2,
        _ => 0,
    };
    json!({"number": number.to_string(), "paragraph": !para.is_empty(), "indent": indent, "runs": runs})
}

/// Save the first KJV chapter named by `reference`, like the legacy `wb pdf` command.
pub fn save(
    bible: &Bible,
    store: &Store,
    folders: &ExportFolders,
    reference: &str,
    mine: bool,
    threads: &[String],
) -> Result<Value> {
    guard(&store.root)?;
    let span = parse_span(reference, bible.books())?;
    let chapter = bible.chapter(&span.book.code, span.c1)?;
    let title = format!("{} {}", chapter.name, chapter.chapter);
    let passage = scripture::passage(bible, &title, "KJV")?;
    let rows = passage["verses"].as_array().unwrap();
    let mut margin = Margin::new(bible, store)?;
    let marks = if mine || !threads.is_empty() {
        chapter_marks(store, &chapter.code, chapter.chapter)?
    } else {
        Default::default()
    };
    let highlights = if mine {
        marks.highlights.as_slice()
    } else {
        &[]
    };
    let underlines: Vec<_> = marks
        .threads
        .into_iter()
        .filter(|m| threads.contains(&m.id))
        .collect();
    let verses: Vec<_> = rows
        .iter()
        .map(|verse| {
            let n = verse["v"].as_u64().unwrap() as u32;
            let words = chapter.verses.iter().find(|v| v.v == n);
            chapter_verse(
                &mut margin,
                span.book.id as i64,
                span.c1 as i64,
                verse,
                words,
                highlights,
                &underlines,
            )
        })
        .collect();
    let notes: Vec<_> =
        studyapi::chapter_notes(bible, store, &chapter.code, chapter.chapter as i64)?
            .into_iter()
            .map(|n| {
                let quote = n["quote"].as_str().unwrap_or("");
                let excerpt =
                    if quote.is_empty() || matches!(n["kind"].as_str(), Some("verse" | "verses")) {
                        String::new()
                    } else {
                        let truncated = quote.chars().count() > 90;
                        let short: String = quote
                            .chars()
                            .take(if truncated { 89 } else { 90 })
                            .collect();
                        format!("“{short}{}”", if truncated { "…" } else { "" })
                    };
                json!({"label": n["label"], "excerpt": excerpt, "text": n["text"]})
            })
            .collect();
    let now = chrono::Local::now();
    let data = json!({"title": title, "subtitle": chapter.title, "date": now.format("%B %e, %Y").to_string().replace("  ", " "), "verses": verses, "notes": notes});
    let (bytes, text, pages) = deck::render_template(TEMPLATE, &data, "chapter")?;
    let expected: Vec<_> = rows
        .iter()
        .map(|v| v["text"].as_str().unwrap().to_string())
        .collect();
    if !missing_verses(&text, &expected).is_empty() {
        return Err(bad(
            "The finished PDF was missing scripture, so it was not kept.",
        ));
    }
    let out = folders.preferred();
    fs::create_dir_all(out)?;
    let stem = format!("{} - {}", safe_stem(&title), now.format("%Y-%m-%d %H%M"));
    let path = loop {
        let path = unique(out, &stem, ".pdf");
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(&bytes) {
                    drop(file);
                    let _ = fs::remove_file(path);
                    return Err(e.into());
                }
                break path;
            }
            Err(e) if e.kind() == ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.into()),
        }
    };
    let refs: Vec<_> = rows
        .iter()
        .map(|v| format!("{} (KJV)", v["ref"].as_str().unwrap()))
        .collect();
    Ok(
        json!({"name": path.file_name().unwrap().to_string_lossy(), "path": path, "size": bytes.len(),
        "checked": {"verses": rows.len(), "refs": refs, "pages": pages}, "notes": notes.len()}),
    )
}
