//! What to draw on one chapter (the Python app's `study_api.chapter_marks`): highlight ranges, note ranges, and the places
//! of threads that have a color, as raw anchor coordinates. The reader turns them into word ranges.

use crate::anchors::{self, Anchor, Kind};
use crate::store::{places_of, s, Store};
use crate::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct Mark {
    #[serde(flatten)]
    pub at: Anchor,
    pub id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub color: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ChapterMarks {
    pub highlights: Vec<Mark>,
    pub notes: Vec<Mark>,
    /// `id` is the thread's id; one mark per place.
    pub threads: Vec<Mark>,
    /// Thread id → name, for the threads that have places here.
    pub thread_names: std::collections::BTreeMap<String, String>,
    /// Ids (as in `threads`) of colored folders whose eye is off: the reader draws none of their marks (TH-5).
    pub hidden: Vec<String>,
    /// Every drawn mark on the chapter, old highlights included, by date made, each with its legend name and style
    /// (`chapter_drawn`). The reader draws these, not `highlights`.
    pub marks: Vec<Value>,
}

fn inside(a: &Anchor, code: &str, chapter: u32) -> bool {
    a.kind != Kind::Lemma && a.code == code && a.c1 <= chapter && chapter <= a.last_chapter()
}

pub fn chapter_marks(store: &Store, code: &str, chapter: u32) -> Result<ChapterMarks> {
    let mut m = ChapterMarks::default();
    for h in store.highlights(code) {
        if let Ok(a) = anchors::parse(&s(&h, "anchor")) {
            if inside(&a, code, chapter) {
                m.highlights.push(Mark { at: a, id: s(&h, "id"), color: s(&h, "color") });
            }
        }
    }
    for n in store.notes() {
        for place in places_of(n) {
            if let Ok(a) = anchors::parse(&place) {
                if inside(&a, code, chapter) {
                    m.notes.push(Mark { at: a, id: s(n, "id"), color: String::new() });
                }
            }
        }
    }
    for f in crate::folders::colored(store) {
        if !crate::folders::eye_on(store, &f) {
            m.hidden.push(crate::folders::mark_id(&f));
        }
    }
    // a set folder with a color: the places it saves (TH-1)
    for t in store.sets() {
        let color = s(&t, "color");
        if color.is_empty() {
            continue;
        }
        let id = format!("folder:{}", s(&t, "id"));
        for i in t["items"].as_array().cloned().unwrap_or_default() {
            if i["kind"] != "place" {
                continue;
            }
            if let Ok(a) = anchors::parse(i["ref"].as_str().unwrap_or("")) {
                if inside(&a, code, chapter) {
                    m.thread_names.insert(id.clone(), s(&t, "name"));
                    m.threads.push(Mark { at: a, id: id.clone(), color: color.clone() });
                }
            }
        }
    }
    for t in store.threads() {
        let (id, color) = (s(t, "id"), s(t, "color"));
        if color.is_empty() {
            continue;
        }
        for member in t["members"].as_array().unwrap() {
            if let Ok(a) = anchors::parse(member["anchor"].as_str().unwrap_or("")) {
                if inside(&a, code, chapter) {
                    m.thread_names.insert(id.clone(), s(t, "name"));
                    m.threads.push(Mark { at: a, id: id.clone(), color: color.clone() });
                }
            }
        }
    }
    m.marks = chapter_drawn(store, code, chapter);
    Ok(m)
}

/// The marks a chapter in another version can show (it has no KJV word positions): highlights and thread places on whole
/// verses as they are, a note on words as a mark on its verses, and nothing on words.
pub fn verse_level(m: ChapterMarks) -> ChapterMarks {
    let whole = |x: &Mark| matches!(x.at.kind, Kind::Verse | Kind::Verses);
    let notes = m
        .notes
        .into_iter()
        .map(|mut n| {
            if matches!(n.at.kind, Kind::Word | Kind::Phrase) {
                let (c2, v2) = (n.at.c2.unwrap_or(n.at.c1), n.at.v2.unwrap_or(n.at.v1));
                let one = (c2, v2) == (n.at.c1, n.at.v1);
                n.at = Anchor {
                    kind: if one { Kind::Verse } else { Kind::Verses },
                    c2: (!one).then_some(c2),
                    v2: (!one).then_some(v2),
                    i1: None,
                    i2: None,
                    ..n.at
                };
            }
            n
        })
        .collect();
    let threads: Vec<Mark> = m.threads.into_iter().filter(whole).collect();
    let thread_names = m.thread_names.into_iter().filter(|(id, _)| threads.iter().any(|t| &t.id == id)).collect();
    let marks = m.marks.into_iter().filter(|x| x["at"].as_str().and_then(|a| anchors::parse(a).ok()).is_some_and(|a| matches!(a.kind, Kind::Verse | Kind::Verses))).collect();
    ChapterMarks { highlights: m.highlights.into_iter().filter(whole).collect(), notes, threads, thread_names, hidden: m.hidden, marks }
}

// ---- the drawn marks (design/features/marks, round 7, T1) ----------------------------------------------------------
//
// `marks/<BOOK>.json`: `{"marks": [{id, kind, color, lines?, at, to?, created, changed?}, ...]}`, one file per book,
// written whole and atomically. `at` and `to` are anchors as the highlights use them (NUM.25:11.3-25:11.9). The old
// `highlights/<BOOK>.json` files are read as highlight marks and never rewritten here (row 54); the move is T15.

use crate::bible::Bible;
use crate::store::{bad, check_color, guard, missing, new_id, now, write_atomic};
use serde_json::{json, Value};
use std::path::PathBuf;

pub const MARK_KINDS: &[&str] = &["highlight", "underline", "circle", "box", "arrow"];

/// One mark as it is kept on disk (and shown by `wb marks`). A highlight read from `highlights/` also carries `words`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DrawnMark {
    pub id: String,
    pub kind: String,
    pub color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<u8>,
    pub at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    pub created: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub changed: Option<String>,
    /// The words of an old highlight (its `quote`); not kept in `marks/`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub words: Option<String>,
}

fn marks_file(store: &Store, code: &str) -> PathBuf {
    store.root.join("marks").join(format!("{code}.json"))
}

fn read_book(store: &Store, code: &str) -> Vec<DrawnMark> {
    let Ok(text) = std::fs::read_to_string(marks_file(store, code)) else { return vec![] };
    serde_json::from_str::<Value>(&text)
        .ok()
        .and_then(|v| v.get("marks").cloned())
        .and_then(|m| serde_json::from_value(m).ok())
        .unwrap_or_default()
}

fn write_book(store: &Store, code: &str, marks: &[DrawnMark]) -> Result<()> {
    let path = marks_file(store, code);
    if marks.is_empty() {
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    write_atomic(&path, &(serde_json::to_string_pretty(&json!({"marks": marks})).unwrap() + "\n"))
}

/// An old highlight as a mark: its id, color, words and date; nothing is written.
fn legacy(h: &crate::store::Rec) -> Option<DrawnMark> {
    let at = anchors::parse(&s(h, "anchor")).ok()?.id();
    let words = s(h, "quote");
    Some(DrawnMark {
        id: s(h, "id"),
        kind: "highlight".into(),
        color: s(h, "color"),
        lines: None,
        at,
        to: None,
        created: s(h, "created"),
        changed: Some(s(h, "changed")).filter(|c| !c.is_empty()),
        words: (!words.is_empty()).then_some(words),
    })
}

fn one_chapter(a: &Anchor) -> Option<u32> {
    (a.last_chapter() == a.c1).then_some(a.c1)
}

/// Make a mark. `at` and `to` are anchor texts (a verse, words, a phrase, a run of verses).
pub fn mark_add(bible: &Bible, store: &Store, at: &str, kind: &str, color: &str, lines: Option<u8>, to: Option<&str>) -> Result<Value> {
    guard(&store.root)?;
    if !MARK_KINDS.contains(&kind) {
        return Err(bad(format!("A mark is one of: {}.", MARK_KINDS.join(", "))));
    }
    if color.trim().is_empty() {
        return Err(bad("A mark needs a color."));
    }
    let color = check_color(Some(&color.to_lowercase()))?.unwrap();
    match (kind, lines) {
        ("underline", Some(n)) if !(1..=3).contains(&n) => return Err(bad("An underline has 1, 2 or 3 lines.")),
        ("underline", _) => {}
        (_, Some(_)) => return Err(bad("Only an underline has lines.")),
        _ => {}
    }
    if kind != "arrow" && to.is_some() {
        return Err(bad("Only an arrow has a place it points to (--to)."));
    }
    let place = |text: &str| -> Result<Anchor> {
        let a = anchors::parse(text)?;
        if a.kind == Kind::Lemma {
            return Err(bad("A mark goes on words, phrases or verses."));
        }
        if anchors::resolve(bible, &a.id())?["ok"] != true {
            return Err(bad("That place is not in the text."));
        }
        Ok(a)
    };
    let from = place(at)?;
    let target = match (kind, to) {
        ("arrow", None) => return Err(bad("An arrow needs where it points: --to.")),
        ("arrow", Some(t)) => {
            let t = place(t)?;
            if t.code != from.code || one_chapter(&from).is_none() || one_chapter(&from) != one_chapter(&t) {
                return Err(bad("An arrow stays in one chapter: both ends must be in the same chapter."));
            }
            Some(t.id())
        }
        _ => None,
    };
    let mark = DrawnMark {
        id: new_id("m"),
        kind: kind.into(),
        color,
        lines: (kind == "underline").then(|| lines.unwrap_or(1)),
        at: from.id(),
        to: target,
        created: now(),
        changed: None,
        words: None,
    };
    let mut all = read_book(store, &from.code);
    all.push(mark.clone());
    write_book(store, &from.code, &all)?;
    Ok(serde_json::to_value(&mark).unwrap())
}

fn touches(m: &DrawnMark, code: &str, chapter: u32) -> bool {
    anchors::parse(&m.at).is_ok_and(|a| a.kind != Kind::Lemma && a.code == code && a.c1 <= chapter && chapter <= a.last_chapter())
}

/// Every mark on a chapter: the ones in `marks/` and the old highlights, by date made. It reads the book's two small
/// files, never a page.
pub fn drawn_in_chapter(store: &Store, code: &str, chapter: u32) -> Vec<DrawnMark> {
    // old highlights first: made in the same second, they are the older (the sort below is stable)
    let mut out: Vec<DrawnMark> = store.highlights(code).iter().filter_map(legacy).filter(|m| touches(m, code, chapter)).collect();
    out.extend(read_book(store, code).into_iter().filter(|m| touches(m, code, chapter)));
    out.sort_by(|a, b| a.created.cmp(&b.created));
    out
}

/// Where a mark is kept: its book, the mark, and whether it is an old highlight.
fn find_mark(store: &Store, id: &str) -> Option<(String, DrawnMark, bool)> {
    let files = std::fs::read_dir(store.root.join("marks")).into_iter().flatten().flatten();
    for e in files {
        let name = e.file_name().to_string_lossy().into_owned();
        if let Some(code) = name.strip_suffix(".json") {
            if let Some(m) = read_book(store, code).into_iter().find(|m| m.id == id) {
                return Some((code.to_string(), m, false));
            }
        }
    }
    for h in store.all_highlights() {
        if s(&h, "id") == id {
            let m = legacy(&h)?;
            return Some((anchors::parse(&m.at).ok()?.code, m, true));
        }
    }
    None
}

/// One mark: {id, kind, color, lines?, at, to?, created, changed?, words?, legend}. `legend` is its entry's name, or "Unnamed …".
pub fn mark_show(store: &Store, id: &str) -> Result<Value> {
    let (_, mark, _) = find_mark(store, id).ok_or_else(|| missing("No mark with that id."))?;
    Ok(with_legend(&read_legend(store), &mark))
}

/// A place as a span of (chapter, verse, word) points; a verse has no word, so it runs from word 0 to the last.
fn span_of(a: &Anchor) -> ((u32, u32, u32), (u32, u32, u32)) {
    let start = (a.c1, a.v1, a.i1.unwrap_or(0));
    let end = match (a.c2, a.v2) {
        (Some(c), Some(v)) => (c, v, a.i2.unwrap_or(u32::MAX)),
        _ => (a.c1, a.v1, a.i1.unwrap_or(u32::MAX)),
    };
    (start, end)
}

fn layer(kind: &str) -> u8 {
    match kind {
        "arrow" => 0,
        "underline" => 1,
        "circle" | "box" => 2,
        _ => 3,
    }
}

/// Every mark covering a place (a verse, words, a phrase, verses), old highlights too, topmost first: arrows, then
/// underlines, then circle and box, then highlight; within a layer, the newest first. A mark covers a place when its
/// own words (`at`) share a word with it.
pub fn mark_at(store: &Store, place: &str) -> Result<Value> {
    let a = anchors::parse(place)?;
    if a.kind == Kind::Lemma {
        return Err(bad("Marks are on words, phrases or verses."));
    }
    let (s0, e0) = span_of(&a);
    let mut out: Vec<DrawnMark> = Vec::new();
    for ch in a.c1..=a.last_chapter() {
        for m in drawn_in_chapter(store, &a.code, ch) {
            let Ok(ma) = anchors::parse(&m.at) else { continue };
            let (s1, e1) = span_of(&ma);
            if s1 <= e0 && s0 <= e1 && !out.iter().any(|o| o.id == m.id) {
                out.push(m);
            }
        }
    }
    // made in the same second: the one kept later (drawn_in_chapter lists in the order made) is the newer
    out.reverse();
    out.sort_by(|x, y| layer(&x.kind).cmp(&layer(&y.kind)).then_with(|| y.created.cmp(&x.created)));
    let entries = read_legend(store);
    let out: Vec<Value> = out.iter().map(|m| with_legend(&entries, m)).collect();
    Ok(json!({"place": a.id(), "marks": out}))
}

/// Replace one mark's style (kind, color, lines); its id, place and `created` stay and `changed` is set. It refuses what
/// `mark_add` refuses. An old highlight keeps its highlights file: only its color may change, there.
pub fn mark_style(store: &mut Store, id: &str, kind: Option<&str>, color: Option<&str>, lines: Option<u8>) -> Result<Value> {
    guard(&store.root)?;
    if kind.is_none() && color.is_none() && lines.is_none() {
        return Err(bad("Say what to change: --kind, --color or --lines."));
    }
    let (code, old, is_old) = find_mark(store, id).ok_or_else(|| missing("No mark with that id."))?;
    let kind = kind.unwrap_or(&old.kind).to_string();
    if !MARK_KINDS.contains(&kind.as_str()) {
        return Err(bad(format!("A mark is one of: {}.", MARK_KINDS.join(", "))));
    }
    let color = match color {
        Some(c) if c.trim().is_empty() => return Err(bad("A mark needs a color.")),
        Some(c) => check_color(Some(&c.to_lowercase()))?.unwrap(),
        None => old.color.clone(),
    };
    let new_lines = match (kind.as_str(), lines) {
        ("underline", Some(n)) if !(1..=3).contains(&n) => return Err(bad("An underline has 1, 2 or 3 lines.")),
        ("underline", Some(n)) => Some(n),
        ("underline", None) => Some(old.lines.unwrap_or(1)),
        (_, Some(_)) => return Err(bad("Only an underline has lines.")),
        _ => None,
    };
    if kind == "arrow" && old.to.is_none() {
        return Err(bad("An arrow needs where it points: draw a new arrow with wb mark add --to."));
    }
    if is_old && (kind != "highlight") {
        return Err(bad("An old highlight keeps its kind: only its color can change. Delete it and draw a new mark instead."));
    }
    let stamp = now();
    let mut mark = DrawnMark { kind: kind.clone(), color: color.clone(), lines: new_lines, changed: Some(stamp.clone()), ..old };
    if kind != "arrow" {
        mark.to = None;
    }
    if is_old {
        let mut h = store.highlights(&code).into_iter().find(|h| s(h, "id") == id).ok_or_else(|| missing("No mark with that id."))?;
        h.insert("color".into(), json!(color));
        h.insert("changed".into(), json!(stamp));
        store.edit_highlights(&code, &[id.to_string()], vec![h])?;
    } else {
        let all: Vec<DrawnMark> = read_book(store, &code).into_iter().map(|m| if m.id == id { mark.clone() } else { m }).collect();
        write_book(store, &code, &all)?;
    }
    Ok(serde_json::to_value(&mark).unwrap())
}

/// Delete a mark: it goes to `.trash/<stamp>-<id>.json` (kept the same 7 days as a note) and can be put back.
pub fn mark_rm(store: &mut Store, id: &str) -> Result<Value> {
    guard(&store.root)?;
    let (code, mark, is_old) = find_mark(store, id).ok_or_else(|| missing("No mark with that id."))?;
    let name = format!("{}-{}.json", chrono::Utc::now().format("%Y%m%d-%H%M%S"), id);
    let mut record = json!({"book": code, "old_highlight": is_old, "mark": mark});
    if is_old {
        let h = store.highlights(&code).into_iter().find(|h| s(h, "id") == id).unwrap();
        record["highlight"] = Value::Object(h);
    }
    write_atomic(&store.root.join(".trash").join(&name), &(serde_json::to_string_pretty(&record).unwrap() + "\n"))?;
    if is_old {
        store.edit_highlights(&code, &[id.to_string()], vec![])?;
    } else {
        let rest: Vec<DrawnMark> = read_book(store, &code).into_iter().filter(|m| m.id != id).collect();
        write_book(store, &code, &rest)?;
    }
    Ok(json!({"deleted": id, "trash": name, "days": crate::store::TRASH_DAYS}))
}

/// Put a deleted mark back (the newest one in the trash with this id).
pub fn mark_restore(store: &mut Store, id: &str) -> Result<Value> {
    guard(&store.root)?;
    if find_mark(store, id).is_some() {
        return Err(bad("That mark is already there."));
    }
    let tail = format!("{id}.json");
    let mut names: Vec<String> = trashed_names(store).into_iter().filter(|n| n.get(16..) == Some(tail.as_str())).collect();
    names.sort();
    let name = names.pop().ok_or_else(|| missing("No such mark in the trash."))?;
    let path = store.root.join(".trash").join(&name);
    let rec: Value = serde_json::from_str(&std::fs::read_to_string(&path)?).map_err(|_| bad("That file in the trash is not a mark."))?;
    let code = rec["book"].as_str().unwrap_or("").to_string();
    let mark: DrawnMark = serde_json::from_value(rec["mark"].clone()).map_err(|_| bad("That file in the trash is not a mark."))?;
    if rec["old_highlight"] == true {
        let h = rec["highlight"].as_object().cloned().ok_or_else(|| bad("That file in the trash is not a mark."))?;
        store.edit_highlights(&code, &[], vec![h])?;
    } else {
        let mut all = read_book(store, &code);
        all.push(mark.clone());
        all.sort_by(|a, b| a.created.cmp(&b.created));
        write_book(store, &code, &all)?;
    }
    std::fs::remove_file(path)?;
    Ok(serde_json::to_value(&mark).unwrap())
}

/// A deleted mark's file in `.trash`: `<stamp>-m_<id>.json` (`-h_<id>.json` for an old highlight).
pub fn is_trash_file(name: &str) -> bool {
    let rest = name.get(16..).unwrap_or("");
    chrono::NaiveDateTime::parse_from_str(name.get(..15).unwrap_or(""), "%Y%m%d-%H%M%S").is_ok()
        && name.get(15..16) == Some("-")
        && (rest.starts_with("m_") || rest.starts_with("h_"))
        && rest.ends_with(".json")
}

fn trashed_names(store: &Store) -> Vec<String> {
    std::fs::read_dir(store.root.join(".trash")).into_iter().flatten().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| is_trash_file(n)).collect()
}

/// The deleted marks in the trash, newest first: {name, id, book, kind, color, at, deleted, days_left}.
pub fn trashed_marks(store: &Store) -> Vec<Value> {
    let now = chrono::Utc::now().naive_utc();
    let mut out: Vec<Value> = trashed_names(store)
        .into_iter()
        .filter_map(|name| {
            let at = chrono::NaiveDateTime::parse_from_str(name.get(..15)?, "%Y%m%d-%H%M%S").ok()?;
            let rec: Value = serde_json::from_str(&std::fs::read_to_string(store.root.join(".trash").join(&name)).ok()?).ok()?;
            let m = &rec["mark"];
            Some(json!({"name": name, "id": m["id"], "book": rec["book"], "kind": m["kind"], "color": m["color"], "at": m["at"],
                "deleted": format!("{}Z", at.format("%Y-%m-%dT%H:%M:%S")), "days_left": (crate::store::TRASH_DAYS - (now - at).num_days()).max(0)}))
        })
        .collect();
    out.sort_by(|a, b| b["name"].as_str().cmp(&a["name"].as_str()));
    out
}

// ---- the legend (design/features/marks, round 7, T3) ---------------------------------------------------------------
//
// `settings/legend.json`: `{"entries": [{kind, color, lines?, name?, meaning?, quick?, key?}, ...]}` in the person's order,
// written whole and atomically. A missing file is an empty legend (MK7-26). A style is kind + color (+ lines, an underline's
// 1, 2 or 3) and has at most one entry. An entry with no name is Unnamed. A style that marks use but no entry names is
// listed as Unnamed too (`wb legend`), so a removed entry loses no mark.

/// At most this many quick styles (MK7-9).
pub const QUICK_MAX: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LegendEntry {
    pub kind: String,
    pub color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub quick: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

fn legend_file(store: &Store) -> PathBuf {
    store.root.join("settings").join("legend.json")
}

fn read_legend(store: &Store) -> Vec<LegendEntry> {
    let Ok(text) = std::fs::read_to_string(legend_file(store)) else { return vec![] };
    let Ok(v) = serde_json::from_str::<Value>(&text) else { return vec![] };
    let list = if v.is_array() { v } else { v.get("entries").cloned().unwrap_or(Value::Null) };
    serde_json::from_value(list).unwrap_or_default()
}

fn write_legend(store: &Store, entries: &[LegendEntry]) -> Result<()> {
    write_atomic(&legend_file(store), &(serde_json::to_string_pretty(&json!({"entries": entries})).unwrap() + "\n"))
}

/// `kind:color` or, for an underline, `kind:color:lines`.
fn style_key(kind: &str, color: &str, lines: Option<u8>) -> String {
    match (kind, lines) {
        ("underline", l) => format!("underline:{color}:{}", l.unwrap_or(1)),
        _ => format!("{kind}:{color}"),
    }
}

fn style_of(m: &DrawnMark) -> String {
    style_key(&m.kind, &m.color, m.lines)
}

fn entry_style(e: &LegendEntry) -> String {
    style_key(&e.kind, &e.color, e.lines)
}

/// "Unnamed yellow highlight", "Unnamed red double underline".
fn unnamed_words(kind: &str, color: &str, lines: Option<u8>) -> String {
    let kind = match (kind, lines) {
        ("underline", Some(2)) => "double underline",
        ("underline", Some(3)) => "triple underline",
        _ => kind,
    };
    format!("Unnamed {color} {kind}")
}

fn entry_label(e: &LegendEntry) -> String {
    match e.name.as_deref().filter(|n| !n.is_empty()) {
        Some(n) => n.to_string(),
        None => unnamed_words(&e.kind, &e.color, e.lines),
    }
}

/// A style written `kind:color[:lines]`, as `style_key` makes it.
fn parse_style(text: &str) -> Option<String> {
    let parts: Vec<&str> = text.trim().split(':').collect();
    if !(2..=3).contains(&parts.len()) || !MARK_KINDS.contains(&parts[0].to_lowercase().as_str()) {
        return None;
    }
    let kind = parts[0].to_lowercase();
    let color = check_color(Some(&parts[1].to_lowercase())).ok()??;
    let lines = match parts.get(2) {
        Some(n) => Some(n.parse::<u8>().ok().filter(|_| kind == "underline")?),
        None => None,
    };
    Some(style_key(&kind, &color, lines))
}

/// An entry by its name (any case), its "Unnamed …" label, or its style `kind:color[:lines]`.
fn find_entry(entries: &[LegendEntry], text: &str) -> Option<usize> {
    let t = text.trim().to_lowercase();
    entries
        .iter()
        .position(|e| e.name.as_deref().is_some_and(|n| n.to_lowercase() == t))
        .or_else(|| entries.iter().position(|e| e.name.as_deref().is_none_or(str::is_empty) && entry_label(e).to_lowercase() == t))
        .or_else(|| {
            let st = parse_style(text)?;
            entries.iter().position(|e| entry_style(e) == st)
        })
}

fn need_entry(entries: &[LegendEntry], text: &str) -> Result<usize> {
    find_entry(entries, text).ok_or_else(|| missing(format!("No legend entry “{}”. Name one, or write its style as kind:color[:lines] (wb legend lists them).", text.trim())))
}

fn check_style(kind: &str, color: &str, lines: Option<u8>) -> Result<(String, String, Option<u8>)> {
    if !MARK_KINDS.contains(&kind) {
        return Err(bad(format!("A style is one of: {}.", MARK_KINDS.join(", "))));
    }
    if color.trim().is_empty() {
        return Err(bad("A style needs a color."));
    }
    let color = check_color(Some(&color.trim().to_lowercase()))?.unwrap();
    let lines = match (kind, lines) {
        ("underline", Some(n)) if !(1..=3).contains(&n) => return Err(bad("An underline has 1, 2 or 3 lines.")),
        ("underline", l) => Some(l.unwrap_or(1)),
        (_, Some(_)) => return Err(bad("Only an underline has lines.")),
        _ => None,
    };
    Ok((kind.to_string(), color, lines))
}

fn check_key(key: &str) -> Result<String> {
    let k = key.trim().to_lowercase();
    match k.strip_prefix("ctrl+") {
        Some(n) if n.len() == 1 && matches!(n.as_bytes()[0], b'1'..=b'9') => Ok(format!("Ctrl+{n}")),
        _ => Err(bad("A key is Ctrl+1 to Ctrl+9.")),
    }
}

fn clean(text: &str) -> Option<String> {
    let t = text.trim();
    (!t.is_empty()).then(|| t.to_string())
}

fn name_free(entries: &[LegendEntry], name: &str, except: Option<usize>) -> Result<()> {
    let n = name.to_lowercase();
    if entries.iter().enumerate().any(|(i, e)| Some(i) != except && entry_label(e).to_lowercase() == n) {
        return Err(bad(format!("Another legend entry is already called “{name}”.")));
    }
    Ok(())
}

/// Every mark there is: the ones in `marks/` and the old highlights.
fn all_marks(store: &Store) -> Vec<DrawnMark> {
    let mut out: Vec<DrawnMark> = store.all_highlights().iter().filter_map(legacy).collect();
    let files = std::fs::read_dir(store.root.join("marks")).into_iter().flatten().flatten();
    for e in files {
        if let Some(code) = e.file_name().to_string_lossy().strip_suffix(".json") {
            out.extend(read_book(store, code));
        }
    }
    out
}

fn entry_json(e: &LegendEntry, position: usize, count: usize) -> Value {
    let mut v = serde_json::to_value(e).unwrap();
    v["position"] = json!(position);
    v["quick"] = json!(e.quick);
    v["label"] = json!(entry_label(e));
    v["style"] = json!(entry_style(e));
    v["count"] = json!(count);
    v["listed"] = json!(true);
    v
}

fn counts(store: &Store) -> std::collections::BTreeMap<String, usize> {
    let mut c = std::collections::BTreeMap::new();
    for m in all_marks(store) {
        *c.entry(style_of(&m)).or_insert(0) += 1;
    }
    c
}

/// The legend: `{"entries": [...], "unlisted": [...]}`. Each entry has its place in the order (`position`, from 1), `label`
/// (its name, or "Unnamed …"), `style` and `count` of marks in the style, old highlights included. `unlisted` are the styles
/// marks use that no entry names, as Unnamed, most used first.
pub fn legend(store: &Store) -> Value {
    let entries = read_legend(store);
    let mut c = counts(store);
    let listed: Vec<Value> = entries.iter().enumerate().map(|(i, e)| entry_json(e, i + 1, c.remove(&entry_style(e)).unwrap_or(0))).collect();
    let mut rest: Vec<(String, usize)> = c.into_iter().collect();
    rest.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    let unlisted: Vec<Value> = rest
        .into_iter()
        .map(|(style, count)| {
            let p: Vec<&str> = style.split(':').collect();
            let lines = p.get(2).and_then(|n| n.parse::<u8>().ok());
            let mut v = json!({"kind": p[0], "color": p[1], "label": unnamed_words(p[0], p[1], lines), "style": style, "count": count, "listed": false, "quick": false});
            if let Some(n) = lines {
                v["lines"] = json!(n);
            }
            v
        })
        .collect();
    json!({"entries": listed, "unlisted": unlisted})
}

/// Add an entry (a pen picked up). The same style twice is refused; the name, if any, is unused.
pub fn legend_add(store: &Store, kind: &str, color: &str, lines: Option<u8>, name: Option<&str>, meaning: Option<&str>) -> Result<Value> {
    guard(&store.root)?;
    let (kind, color, lines) = check_style(kind, color, lines)?;
    let mut entries = read_legend(store);
    let style = style_key(&kind, &color, lines);
    if let Some(i) = entries.iter().position(|e| entry_style(e) == style) {
        return Err(bad(format!("The legend already has {style}: “{}”. Change it with wb legend set.", entry_label(&entries[i]))));
    }
    let name = name.and_then(clean);
    if let Some(n) = &name {
        name_free(&entries, n, None)?;
    }
    let e = LegendEntry { kind, color, lines, name, meaning: meaning.and_then(clean), quick: false, key: None };
    entries.push(e.clone());
    write_legend(store, &entries)?;
    let n = counts(store).get(&entry_style(&e)).copied().unwrap_or(0);
    Ok(entry_json(&e, entries.len(), n))
}

/// What `legend_set` may change. `restyle` is needed when `color` changes an entry that marks use.
#[derive(Debug, Default, Clone)]
pub struct LegendChange<'a> {
    pub name: Option<&'a str>,
    pub meaning: Option<&'a str>,
    pub color: Option<&'a str>,
    pub restyle: Option<bool>,
    pub quick: Option<bool>,
    pub key: Option<&'a str>,
    pub move_key: bool,
}

/// Every mark in a style takes a new color (`changed` set); an old highlight takes it in its own file. Returns how many.
fn restyle(store: &mut Store, old: &str, color: &str) -> Result<usize> {
    let stamp = now();
    let mut n = 0;
    let files: Vec<String> = std::fs::read_dir(store.root.join("marks"))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| e.file_name().to_string_lossy().strip_suffix(".json").map(String::from))
        .collect();
    for code in files {
        let mut all = read_book(store, &code);
        let mut hit = 0;
        for m in all.iter_mut().filter(|m| style_of(m) == old) {
            m.color = color.to_string();
            m.changed = Some(stamp.clone());
            hit += 1;
        }
        if hit > 0 {
            write_book(store, &code, &all)?;
            n += hit;
        }
    }
    let mut by_book: std::collections::BTreeMap<String, Vec<crate::store::Rec>> = Default::default();
    for h in store.all_highlights() {
        if legacy(&h).is_some_and(|m| style_of(&m) == old) {
            if let Ok(a) = anchors::parse(&s(&h, "anchor")) {
                by_book.entry(a.code).or_default().push(h);
            }
        }
    }
    for (code, hs) in by_book {
        let ids: Vec<String> = hs.iter().map(|h| s(h, "id")).collect();
        let new: Vec<crate::store::Rec> = hs
            .into_iter()
            .map(|mut h| {
                h.insert("color".into(), json!(color));
                h.insert("changed".into(), json!(stamp));
                h
            })
            .collect();
        n += new.len();
        store.edit_highlights(&code, &ids, new)?;
    }
    Ok(n)
}

/// Change an entry: its name, meaning, color (with or without its marks), quick pin or key. `{"entry", "restyled"}`.
pub fn legend_set(store: &mut Store, target: &str, ch: &LegendChange) -> Result<Value> {
    guard(&store.root)?;
    let mut entries = read_legend(store);
    let i = need_entry(&entries, target)?;
    if ch.name.is_none() && ch.meaning.is_none() && ch.color.is_none() && ch.quick.is_none() && ch.key.is_none() {
        return Err(bad("Say what to change: --name, --meaning, --color, --quick or --key."));
    }
    if ch.restyle.is_some() && ch.color.is_none() {
        return Err(bad("--restyle and --no-restyle go with --color."));
    }
    let old_style = entry_style(&entries[i]);
    let mut e = entries[i].clone();
    if let Some(n) = ch.name {
        e.name = clean(n);
        name_free(&entries, &entry_label(&e), Some(i))?;
    }
    if let Some(m) = ch.meaning {
        e.meaning = clean(m);
    }
    let mut new_color = None;
    if let Some(c) = ch.color {
        let (_, color, _) = check_style(&e.kind, c, e.lines)?;
        if color != e.color {
            let style = style_key(&e.kind, &color, e.lines);
            if let Some(o) = entries.iter().position(|x| entry_style(x) == style) {
                return Err(bad(format!("The legend already has {style}: “{}”.", entry_label(&entries[o]))));
            }
            if ch.restyle.is_none() && counts(store).get(&old_style).copied().unwrap_or(0) > 0 {
                return Err(bad("Marks use this style. Say --restyle to change them too, or --no-restyle to change the entry only."));
            }
            e.color = color.clone();
            new_color = Some(color);
        }
    }
    if let Some(q) = ch.quick {
        if q && !e.quick && entries.iter().enumerate().filter(|(j, x)| *j != i && x.quick).count() >= QUICK_MAX {
            return Err(bad(format!("There are already {QUICK_MAX} quick styles. Turn one off first (wb legend set <entry> --quick off).")));
        }
        e.quick = q;
    }
    if let Some(k) = ch.key {
        if matches!(k.trim().to_lowercase().as_str(), "" | "none") {
            e.key = None;
        } else {
            let k = check_key(k)?;
            if let Some(o) = entries.iter().position(|x| x.key.as_deref() == Some(k.as_str())).filter(|o| *o != i) {
                if !ch.move_key {
                    return Err(bad(format!("{k} is already used by “{}”. Say --move-key to move it here.", entry_label(&entries[o]))));
                }
                entries[o].key = None;
            }
            e.key = Some(k);
        }
    }
    let mut restyled = 0;
    if let (Some(color), Some(true)) = (&new_color, ch.restyle) {
        restyled = restyle(store, &old_style, color)?;
    }
    entries[i] = e.clone();
    write_legend(store, &entries)?;
    let n = counts(store).get(&entry_style(&e)).copied().unwrap_or(0);
    Ok(json!({"entry": entry_json(&e, i + 1, n), "restyled": restyled}))
}

/// Move an entry to a place in the order (1 is first).
pub fn legend_move(store: &Store, target: &str, to: usize) -> Result<Value> {
    guard(&store.root)?;
    let mut entries = read_legend(store);
    let i = need_entry(&entries, target)?;
    if to < 1 || to > entries.len() {
        return Err(bad(format!("The legend has {} entries: --to is 1 to {}.", entries.len(), entries.len())));
    }
    let e = entries.remove(i);
    entries.insert(to - 1, e);
    write_legend(store, &entries)?;
    Ok(legend(store))
}

/// Remove an entry. Its marks stay, and then show as Unnamed.
pub fn legend_rm(store: &Store, target: &str) -> Result<Value> {
    guard(&store.root)?;
    let mut entries = read_legend(store);
    let i = need_entry(&entries, target)?;
    let e = entries.remove(i);
    let n = counts(store).get(&entry_style(&e)).copied().unwrap_or(0);
    write_legend(store, &entries)?;
    Ok(json!({"removed": entry_json(&e, i + 1, n), "marks_kept": n}))
}

/// The style a legend entry gives a new mark: (kind, color, lines).
pub fn legend_style(store: &Store, target: &str) -> Result<(String, String, Option<u8>)> {
    let entries = read_legend(store);
    let e = &entries[need_entry(&entries, target)?];
    Ok((e.kind.clone(), e.color.clone(), e.lines))
}

/// A mark with its legend name added: the entry's name, or "Unnamed …" when it has none or the style has no entry.
fn with_legend(entries: &[LegendEntry], m: &DrawnMark) -> Value {
    let mut v = serde_json::to_value(m).unwrap();
    let st = style_of(m);
    v["legend"] = json!(entries.iter().find(|e| entry_style(e) == st).map(entry_label).unwrap_or_else(|| unnamed_words(&m.kind, &m.color, m.lines)));
    v
}

/// Every mark on a chapter as the reader draws it: `drawn_in_chapter` with each mark's `legend` name and `style`
/// (`kind:color[:lines]`, what the marks panel switches by). Reads the legend and the book's marks file, never a page.
pub fn chapter_drawn(store: &Store, code: &str, chapter: u32) -> Vec<Value> {
    let entries = read_legend(store);
    drawn_in_chapter(store, code, chapter)
        .iter()
        .map(|m| {
            let mut v = with_legend(&entries, m);
            v["style"] = json!(style_of(m));
            v
        })
        .collect()
}

// ---- the marks panel (design/features/marks, rows 44 to 46) --------------------------------------------------------
//
// `settings/marks.json`: `hidden_kinds` (kinds not drawn), `hidden_styles` (legend entries not drawn, each as its style
// `kind:color[:lines]`) and `reading` (Reading mode: only the text). Hiding draws nothing different on disk: no mark is
// changed. Other keys in the file (the margin's, later) are kept as they are.

fn names_in(v: Option<&Value>) -> Vec<String> {
    v.and_then(|x| x.as_array()).map(|a| a.iter().filter_map(|s| s.as_str().map(String::from)).collect()).unwrap_or_default()
}

/// What the panel has switched: `{"hidden_kinds": [...], "hidden_styles": [...], "reading": false}`.
pub fn panel_settings(store: &Store) -> Value {
    let all = store.settings("marks");
    json!({"hidden_kinds": names_in(all.get("hidden_kinds")), "hidden_styles": names_in(all.get("hidden_styles")), "reading": all.get("reading").and_then(|r| r.as_bool()).unwrap_or(false)})
}

fn hide(store: &mut Store, key: &str, item: String, hidden: bool) -> Result<()> {
    let mut now = names_in(store.settings("marks").get(key));
    now.retain(|x| x != &item);
    if hidden {
        now.push(item);
    }
    store.set_setting("marks", key, Some(json!(now))).map(|_| ())
}

/// Switch one thing: `what` is `kind` (target: highlight, underline, circle, box, arrow), `entry` (target: a legend entry's
/// name, its "Unnamed …" label or its style) or `reading` (no target). `on` shows it (Reading mode on hides every mark).
pub fn panel_set(store: &mut Store, what: &str, target: &str, on: bool) -> Result<Value> {
    guard(&store.root)?;
    match what {
        "kind" => {
            let k = target.trim().to_lowercase();
            if !MARK_KINDS.contains(&k.as_str()) {
                return Err(bad(format!("A kind is one of: {}.", MARK_KINDS.join(", "))));
            }
            hide(store, "hidden_kinds", k, !on)?;
        }
        "entry" => {
            let entries = read_legend(store);
            let style = match find_entry(&entries, target) {
                Some(i) => entry_style(&entries[i]),
                // a style marks use that no entry names (shown as Unnamed)
                None => parse_style(target).ok_or_else(|| missing(format!("No legend entry “{}”. Name one, or write its style as kind:color[:lines] (wb legend lists them).", target.trim())))?,
            };
            hide(store, "hidden_styles", style, !on)?;
        }
        "reading" => {
            store.set_setting("marks", "reading", Some(json!(on)))?;
        }
        _ => return Err(bad("Switch a kind, an entry or reading: wb settings marks kind underline off | entry Warning off | reading on.")),
    }
    Ok(panel_settings(store))
}
