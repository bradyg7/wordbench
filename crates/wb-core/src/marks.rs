//! What to draw on one chapter (the Python app's `study_api.chapter_marks`): highlight ranges, note ranges, and the places
//! of threads that have a color, as raw anchor coordinates. The reader turns them into word ranges.

use crate::anchors::{self, Anchor, Kind};
use crate::store::{places_of, s, Store};
use crate::Result;
use serde::Serialize;

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
    /// The pencil's lines (marks M14); `color` is empty.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pencil: Vec<Mark>,
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
    for p in crate::pencil::list(store, code) {
        if let Ok(a) = anchors::parse(&s(&p, "anchor")) {
            if inside(&a, code, chapter) {
                m.pencil.push(Mark { at: a, id: s(&p, "id"), color: String::new() });
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
    ChapterMarks { highlights: m.highlights.into_iter().filter(whole).collect(), notes, pencil: m.pencil.into_iter().filter(whole).collect(), threads, thread_names, hidden: m.hidden }
}
