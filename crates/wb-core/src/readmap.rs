//! The map of the whole Bible for Reading (reading-plans RP-19, R13): every chapter shaded by times read (a part-read chapter
//! part filled), and the second layer, Written about: every reference to a chapter in the person's own work (pages, places in
//! pages, questions, highlights, folders). Nothing here writes; a reference is a pointer to what the person wrote.

use crate::bible::Bible;
use crate::commands::find_refs;
use crate::notebook as nb;
use crate::places::parse_span;
use crate::reading;
use crate::store::{places_of, s, Store};
use crate::Result;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;

/// The chapters a place (as anchor text or a reference) touches.
fn chapters_touched(bible: &Bible, place: &str) -> Vec<String> {
    let span = crate::anchors::parse(place)
        .ok()
        .filter(|a| a.kind != crate::anchors::Kind::Lemma)
        .map(|a| (a.code.clone(), a.c1, a.last_chapter()))
        .or_else(|| {
            parse_span(place, bible.books())
                .ok()
                .map(|sp| (sp.book.code.clone(), sp.c1, sp.c2))
        });
    match span {
        Some((code, a, b)) if a <= b && b - a < 200 => {
            (a..=b).map(|c| format!("{code}.{c}")).collect()
        }
        _ => vec![],
    }
}

/// Every reference to a chapter: `{"NUM.25": [{"kind": "page", "id": …, "title": …}, …]}`.
pub fn written_about(bible: &Bible, store: &Store) -> BTreeMap<String, Vec<Value>> {
    let mut out: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    let mut add = |ch: String, item: Value| {
        let list = out.entry(ch).or_default();
        if !list
            .iter()
            .any(|x| x["id"] == item["id"] && x["kind"] == item["kind"])
        {
            list.push(item);
        }
    };
    let pages = store
        .notes()
        .into_iter()
        .chain(store.inbox())
        .chain(store.on_thread());
    for r in pages {
        let text = s(r, "text");
        let kind = if s(r, "kind") == "question" {
            "question"
        } else {
            "page"
        };
        let (id, title) = (s(r, "id"), nb::title_of(&text));
        for p in places_of(r) {
            for ch in chapters_touched(bible, &p) {
                add(
                    ch,
                    json!({"kind": kind, "id": id, "title": title, "anchor": p}),
                );
            }
        }
        for f in find_refs(&text, bible.books()) {
            for ch in chapters_touched(bible, &f.place) {
                add(
                    ch,
                    json!({"kind": if kind == "question" { "question" } else { "place in a page" }, "id": id, "title": title, "anchor": f.place}),
                );
            }
        }
    }
    for r in store.days() {
        let (id, title) = (s(r, "id"), s(r, "day"));
        for f in find_refs(&s(r, "text"), bible.books()) {
            for ch in chapters_touched(bible, &f.place) {
                add(
                    ch,
                    json!({"kind": "place in a page", "id": id, "title": title, "anchor": f.place}),
                );
            }
        }
    }
    for h in store.all_highlights() {
        let a = s(&h, "anchor");
        for ch in chapters_touched(bible, &a) {
            add(
                ch,
                json!({"kind": "highlight", "id": s(&h, "id"), "title": a, "anchor": a}),
            );
        }
    }
    for t in store.threads() {
        for m in t["members"].as_array().cloned().unwrap_or_default() {
            let at = m["anchor"].as_str().unwrap_or("").to_string();
            for ch in chapters_touched(bible, &at) {
                add(
                    ch,
                    json!({"kind": "folder", "id": s(t, "id"), "title": s(t, "name"), "anchor": at}),
                );
            }
        }
    }
    for t in store.sets() {
        for i in t["items"].as_array().cloned().unwrap_or_default() {
            if i["kind"] != "place" {
                continue;
            }
            let at = i["ref"].as_str().unwrap_or("").to_string();
            for ch in chapters_touched(bible, &at) {
                add(
                    ch,
                    json!({"kind": "folder", "id": s(&t, "id"), "title": s(&t, "name"), "anchor": at}),
                );
            }
        }
    }
    out
}

/// The map: for each book its chapters read (`[chapter, times, fraction]`, only those with anything read) and how many chapters
/// have something written about them (`written` per chapter number).
pub fn map(bible: &Bible, root: &Path, store: &Store) -> Result<Value> {
    let cov = reading::coverage(bible, root);
    let about = written_about(bible, store);
    let mut books = vec![];
    for b in bible.books() {
        let read: Vec<Value> = (1..=b.chapters)
            .filter_map(|c| {
                cov.get(&format!("{}.{c}", b.code))
                    .map(|x| json!([c, x.times, (x.fraction() * 100.0).round() / 100.0]))
            })
            .collect();
        let written: Vec<Value> = (1..=b.chapters)
            .filter_map(|c| {
                about
                    .get(&format!("{}.{c}", b.code))
                    .map(|l| json!([c, l.len()]))
            })
            .collect();
        books.push(json!({"code": b.code, "name": b.name, "chapters": b.chapters, "read": read, "written": written}));
    }
    Ok(json!({"books": books}))
}

/// What refers to one chapter: the list a click on the map shows (and the plan pane's "what refers to it").
pub fn about(bible: &Bible, store: &Store, chapter: &str) -> Vec<Value> {
    written_about(bible, store)
        .remove(chapter)
        .unwrap_or_default()
}
