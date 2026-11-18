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
    ChapterMarks { highlights: m.highlights.into_iter().filter(whole).collect(), notes, threads, thread_names, hidden: m.hidden }
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

/// One mark: {id, kind, color, lines?, at, to?, created, changed?, words?}. Its legend name is T3's.
pub fn mark_show(store: &Store, id: &str) -> Result<Value> {
    let (_, mark, _) = find_mark(store, id).ok_or_else(|| missing("No mark with that id."))?;
    Ok(serde_json::to_value(&mark).unwrap())
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
