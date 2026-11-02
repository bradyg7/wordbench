//! Scripture text for the command line and documents: verbatim verses for a reference, never paraphrased (the Python
//! app's `workbench/scripture.py`). The text always comes with its reference.

use crate::bible::Bible;
use crate::places::{parse_spans, span_label, Span};
use crate::{lookup, Error, Result};
use serde_json::{json, Value};

pub const PREVIEW_VERSES: usize = 6;
pub const COPY_FORMATS: &[&str] = &["lines", "block", "para", "quote"];

/// The verses of a span as [{ref, book, c, v, text}], in Bible order.
pub fn verses(bible: &Bible, s: &Span, version: &str) -> Result<Vec<Value>> {
    let mut out = vec![];
    for ch in s.c1..=s.c2 {
        let Some(got) = lookup::text(bible, version, s.book.id, ch)? else { continue };
        for row in got["verses"].as_array().unwrap() {
            let v = row["v"].as_u64().unwrap() as u32;
            if ch == s.c1 && s.v1 != 0 && v < s.v1 {
                continue;
            }
            if ch == s.c2 && s.v2 != 0 && v > s.v2 {
                continue;
            }
            out.push(json!({"ref": format!("{} {ch}:{v}", s.book.name), "book": s.book.name, "c": ch, "v": v, "text": row["text"]}));
        }
    }
    Ok(out)
}

/// A reference as typed (one place, or several joined by ';') → {label, version, verses}.
pub fn passage(bible: &Bible, text: &str, version: &str) -> Result<Value> {
    let spans = parse_spans(text, bible.books())?;
    let mut out = vec![];
    for (i, s) in spans.iter().enumerate() {
        for mut v in verses(bible, s, version)? {
            v["span"] = json!(i);
            out.push(v);
        }
    }
    if out.is_empty() {
        return Err(Error(format!("Nothing found at “{}”.", text.trim())));
    }
    let version = if version.is_empty() { "KJV".to_string() } else { version.to_uppercase() };
    Ok(json!({"label": spans.iter().map(span_label).collect::<Vec<_>>().join("; "), "version": version, "verses": out}))
}

/// A passage as plain reading text: '16 For God so loved...' one verse per line, the reference above.
pub fn block(psg: &Value) -> String {
    let vs = psg["verses"].as_array().unwrap();
    let distinct = |k: &str| vs.iter().map(|v| v[k].to_string()).collect::<std::collections::HashSet<_>>().len();
    let several = distinct("span") > 1 || distinct("c") > 1;
    let lines: Vec<String> = vs
        .iter()
        .map(|v| format!("{} {}", if several { v["ref"].as_str().unwrap().to_string() } else { v["v"].to_string() }, v["text"].as_str().unwrap()))
        .collect();
    format!("{} ({})\n{}", psg["label"].as_str().unwrap(), psg["version"].as_str().unwrap(), lines.join("\n"))
}

/// 'John 3:16–18' for a run of consecutive verses of one chapter, else the first and last.
fn run_label(rows: &[&Value]) -> String {
    let (Some(a), Some(b)) = (rows.first(), rows.last()) else { return String::new() };
    if (a["c"].clone(), a["v"].clone()) == (b["c"].clone(), b["v"].clone()) {
        return a["ref"].as_str().unwrap().into();
    }
    if a["c"] == b["c"] && a["book"] == b["book"] {
        return format!("{}–{}", a["ref"].as_str().unwrap(), b["v"]);
    }
    format!("{}–{}:{}", a["ref"].as_str().unwrap(), b["c"], b["v"])
}

/// Each reads back as its book, so a copied reference can be typed into the box again.
pub const SHORT_NAMES: &[(&str, &str)] = &[
    ("Genesis", "Gen"), ("Exodus", "Exod"), ("Leviticus", "Lev"), ("Numbers", "Num"), ("Deuteronomy", "Deut"), ("Joshua", "Josh"),
    ("Judges", "Judg"), ("Ruth", "Ruth"), ("1 Samuel", "1 Sam"), ("2 Samuel", "2 Sam"), ("1 Kings", "1 Kgs"), ("2 Kings", "2 Kgs"),
    ("1 Chronicles", "1 Chr"), ("2 Chronicles", "2 Chr"), ("Ezra", "Ezra"), ("Nehemiah", "Neh"), ("Esther", "Esth"), ("Job", "Job"),
    ("Psalms", "Ps"), ("Proverbs", "Prov"), ("Ecclesiastes", "Eccl"), ("Song of Solomon", "Song"), ("Isaiah", "Isa"), ("Jeremiah", "Jer"),
    ("Lamentations", "Lam"), ("Ezekiel", "Ezek"), ("Daniel", "Dan"), ("Hosea", "Hos"), ("Joel", "Joel"), ("Amos", "Amos"),
    ("Obadiah", "Obad"), ("Jonah", "Jonah"), ("Micah", "Mic"), ("Nahum", "Nah"), ("Habakkuk", "Hab"), ("Zephaniah", "Zeph"),
    ("Haggai", "Hag"), ("Zechariah", "Zech"), ("Malachi", "Mal"), ("Matthew", "Matt"), ("Mark", "Mark"), ("Luke", "Luke"),
    ("John", "John"), ("Acts", "Acts"), ("Romans", "Rom"), ("1 Corinthians", "1 Cor"), ("2 Corinthians", "2 Cor"), ("Galatians", "Gal"),
    ("Ephesians", "Eph"), ("Philippians", "Phil"), ("Colossians", "Col"), ("1 Thessalonians", "1 Thess"), ("2 Thessalonians", "2 Thess"),
    ("1 Timothy", "1 Tim"), ("2 Timothy", "2 Tim"), ("Titus", "Titus"), ("Philemon", "Phlm"), ("Hebrews", "Heb"), ("James", "Jas"),
    ("1 Peter", "1 Pet"), ("2 Peter", "2 Pet"), ("1 John", "1 John"), ("2 John", "2 John"), ("3 John", "3 John"), ("Jude", "Jude"),
    ("Revelation", "Rev"),
];

/// A passage laid out to paste (lines, block, para, quote). The verses are never changed, only arranged around their
/// references.
pub fn copy_text(psg: &Value, fmt: &str, short: bool) -> Result<String> {
    if !COPY_FORMATS.contains(&fmt) {
        return Err(Error(format!("Copy formats: {}.", COPY_FORMATS.join(", "))));
    }
    let version = psg["version"].as_str().unwrap();
    let rows: Vec<Value> = psg["verses"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| {
            let book = v["book"].as_str().unwrap();
            let name = if short { SHORT_NAMES.iter().find(|s| s.0 == book).map(|s| s.1).unwrap_or(book) } else { book };
            let mut v = v.clone();
            v["ref"] = json!(format!("{name} {}:{}", v["c"], v["v"]));
            v
        })
        .collect();
    if fmt == "lines" {
        let tag = if version == "KJV" { String::new() } else { format!(" ({version})") };
        return Ok(rows.iter().map(|v| format!("{}{tag} {}", v["ref"].as_str().unwrap(), v["text"].as_str().unwrap())).collect::<Vec<_>>().join("\n"));
    }
    let mut spans: Vec<u64> = rows.iter().map(|v| v["span"].as_u64().unwrap()).collect();
    spans.sort();
    spans.dedup();
    let mut parts = vec![];
    for span in spans {
        let run: Vec<&Value> = rows.iter().filter(|v| v["span"].as_u64() == Some(span)).collect();
        let chapters = run.iter().map(|v| v["c"].clone()).collect::<Vec<_>>().windows(2).any(|w| w[0] != w[1]);
        let number = |v: &Value| if chapters { format!("{}:{}", v["c"], v["v"]) } else { v["v"].to_string() };
        if fmt == "quote" {
            let words = run.iter().map(|v| v["text"].as_str().unwrap()).collect::<Vec<_>>().join(" ");
            parts.push(format!("“{words}” ({} {version})", run_label(&run)));
        } else {
            let verses: Vec<String> = run.iter().map(|v| format!("{} {}", number(v), v["text"].as_str().unwrap())).collect();
            parts.push(format!("{} ({version})\n{}", run_label(&run), verses.join(if fmt == "block" { "\n" } else { " " })));
        }
    }
    Ok(parts.join(if fmt == "quote" { "\n" } else { "\n\n" }))
}

/// What `copy` puts on the clipboard, and what it is.
pub fn copy(bible: &Bible, text: &str, version: &str, fmt: &str, short: bool) -> Result<Value> {
    let psg = passage(bible, text, version)?;
    Ok(json!({"label": psg["label"], "version": psg["version"], "format": fmt, "short": short,
        "verses": psg["verses"].as_array().unwrap().len(), "text": copy_text(&psg, fmt, short)?}))
}

/// What a hover card shows: a verse reference (at most `most` verses, with the count of those left out) or a Strong's
/// number (the lexicon's own words).
pub fn preview(bible: &Bible, q: &str, version: &str, most: usize) -> Result<Value> {
    let q = q.trim();
    if lookup::is_strong(&q.to_uppercase()) {
        let sid = q.to_uppercase();
        let Some(Value::Object(mut row)) = lookup::strongs_brief(bible, &[sid.clone()])?.remove(&sid) else {
            return Err(Error(format!("There is no entry numbered {sid}.")));
        };
        row.insert("kind".into(), json!("strong"));
        return Ok(Value::Object(row));
    }
    let psg = passage(bible, q, version)?;
    let vs = psg["verses"].as_array().unwrap();
    Ok(json!({"kind": "verses", "label": psg["label"], "version": psg["version"], "verses": vs.iter().take(most).collect::<Vec<_>>(),
        "more": vs.len().saturating_sub(most)}))
}
