//! Scripture text for the command line and documents: verbatim verses for a reference, never paraphrased (the Python
//! app's `workbench/scripture.py`). The text always comes with its reference.

use crate::anchors::{Anchor, Kind};
use crate::bible::{Bible, Chapter, Word};
use crate::marks::{self, Mark};
use crate::places::{parse_spans, span_label, Span};
use crate::store::Store;
use crate::{lookup, Error, Result};
use serde_json::{json, Value};
use std::collections::HashMap;

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

/// Does a highlight's anchor cover word `i` of verse `c:v`? (Whole-verse kinds cover every word of their verses.)
fn covers(a: &Anchor, c: u32, v: u32, i: u32) -> bool {
    let (c2, v2) = (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1));
    match a.kind {
        Kind::Word => (a.c1, a.v1, a.i1) == (c, v, Some(i)),
        Kind::Verse => (a.c1, a.v1) == (c, v),
        Kind::Verses => (a.c1, a.v1) <= (c, v) && (c, v) <= (c2, v2),
        Kind::Phrase => (a.c1, a.v1, a.i1.unwrap_or(0)) <= (c, v, i) && (c, v, i) <= (c2, v2, a.i2.unwrap_or(u32::MAX)),
        Kind::Lemma => false,
    }
}

/// A verse's text as runs, each with the color of the highlight over it (the last one made wins, as in the reader).
/// The runs joined are the text exactly as given: the words are only found in it, never rebuilt from the word list, so
/// a word that cannot be found leaves its part of the text as it is, with no color.
fn runs(text: &str, words: &[Word], c: u32, v: u32, marks: &[Mark], pencil: &[Mark]) -> Vec<Value> {
    let pen = |i: u32| pencil.iter().any(|m| covers(&m.at, c, v, i));
    let color = |i: u32| marks.iter().rev().find(|m| covers(&m.at, c, v, i)).map(|m| m.color.clone());
    // (start, end, color) of each word found, in order
    let mut found: Vec<(usize, usize, Option<String>, bool)> = vec![];
    let mut at = 0;
    for w in words {
        let full = format!("{}{}{}", w.lead, w.text, w.trail.trim_end());
        let bare = format!("{}{}", w.lead, w.text);
        let hit = [full.as_str(), bare.as_str()].into_iter().filter(|t| !t.is_empty()).find_map(|t| text[at..].find(t).map(|p| (at + p, at + p + t.len())));
        if let Some((a, b)) = hit {
            found.push((a, b, color(w.i), pen(w.i)));
            at = b;
        }
    }
    let mut out: Vec<(String, Option<String>, bool)> = vec![];
    let mut push = |t: &str, hl: Option<String>, p: bool| {
        if t.is_empty() {
            return;
        }
        match out.last_mut() {
            Some(last) if last.1 == hl && last.2 == p => last.0.push_str(t),
            _ => out.push((t.to_string(), hl, p)),
        }
    };
    let mut at = 0;
    for (k, (a, b, hl, p)) in found.iter().enumerate() {
        // the space between two words keeps a color both have, so a highlight runs unbroken through a phrase
        let between = if k > 0 && found[k - 1].2.is_some() && found[k - 1].2 == *hl { hl.clone() } else { None };
        push(&text[at..*a], between, k > 0 && found[k - 1].3 && *p);
        push(&text[*a..*b], hl.clone(), *p);
        at = *b;
    }
    if found.is_empty() {
        // no word found: a highlight on the whole verse still shows
        let whole = marks.iter().rev().find(|m| matches!(m.at.kind, Kind::Verse | Kind::Verses) && covers(&m.at, c, v, 0)).map(|m| m.color.clone());
        push(text, whole, false);
    } else {
        push(&text[at..], None, false);
    }
    out.into_iter()
        .map(|(t, hl, p)| {
            let mut r = json!({"t": t});
            if let Some(c) = hl {
                r["hl"] = json!(c);
            }
            if p {
                r["pencil"] = json!(true);
            }
            r
        })
        .collect()
}

/// Verses as a scripture block and the verse card draw them (`wb scripture`): the passage, each verse verbatim with its
/// reference, and its text again as runs (`runs`: [{t, hl?}]) carrying the person's highlights. In a version other
/// than the KJV, only highlights on whole verses show (`marks::verse_level`), as in the reader.
pub fn marked(bible: &Bible, store: &Store, text: &str, version: &str) -> Result<Value> {
    let mut psg = passage(bible, text, version)?;
    let ver = psg["version"].as_str().unwrap_or("KJV").to_string();
    let spans = parse_spans(text, bible.books())?;
    let mut chapters: HashMap<(String, u32), (Chapter, Vec<Mark>, Vec<Mark>)> = HashMap::new();
    for v in psg["verses"].as_array_mut().unwrap() {
        let span = &spans[v["span"].as_u64().unwrap_or(0) as usize];
        let code = span.book.code.clone();
        let (c, n) = (v["c"].as_u64().unwrap() as u32, v["v"].as_u64().unwrap() as u32);
        if !chapters.contains_key(&(code.clone(), c)) {
            let ch = bible.chapter_in(&code, c, &ver)?;
            let m = marks::chapter_marks(store, &code, c)?;
            let m = if ch.version.is_some() { marks::verse_level(m) } else { m };
            chapters.insert((code.clone(), c), (ch, m.highlights, m.pencil));
        }
        let (ch, hls, pen) = &chapters[&(code.clone(), c)];
        let words = ch.verses.iter().find(|x| x.v == n).map(|x| x.words.as_slice()).unwrap_or(&[]);
        let t = v["text"].as_str().unwrap_or("").to_string();
        v["code"] = json!(code);
        v["runs"] = json!(runs(&t, words, c, n, hls, pen));
    }
    Ok(psg)
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
