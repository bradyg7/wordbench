//! What to draw on one chapter (the Python app's `study_api.chapter_marks`): highlight ranges, note ranges, and the places
//! of threads that have a color, as raw anchor coordinates. The reader turns them into word ranges.

use crate::anchors::{self, Anchor, Kind};
use crate::store::{s, Store};
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
    /// `id` is the thread's id; one mark per place.
    pub threads: Vec<Mark>,
    /// Thread id → name, for the threads that have places here.
    pub thread_names: std::collections::BTreeMap<String, String>,
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
        if let Ok(a) = anchors::parse(&s(n, "anchor")) {
            if inside(&a, code, chapter) {
                m.notes.push(Mark { at: a, id: s(n, "id"), color: String::new() });
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
