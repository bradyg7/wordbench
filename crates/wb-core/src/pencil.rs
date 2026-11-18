//! The pencil (design/features/marks, M14): one grey, thin line under a run of words, with no meaning and no words. U on a
//! selection draws it, U again takes it off. Kept in `pencil/<CODE>.json`, one small file per book, each line
//! `{id, anchor, created}` (MK-19: the date is kept). No highlight, thread or note file is touched.

use crate::anchors::{self, Anchor, Kind};
use crate::store::{bad, new_id, now, py_dumps_indent1, s, write_atomic, Rec, Store};
use crate::Result;
use serde_json::{json, Value};
use std::path::PathBuf;

fn path(store: &Store, code: &str) -> PathBuf {
    store.root.join("pencil").join(format!("{code}.json"))
}

/// A book's pencil lines, oldest first.
pub fn list(store: &Store, code: &str) -> Vec<Rec> {
    let Ok(text) = std::fs::read_to_string(path(store, code)) else { return vec![] };
    serde_json::from_str::<Value>(&text)
        .ok()
        .and_then(|v| v.get("pencil").and_then(|p| p.as_array().cloned()))
        .map(|a| a.into_iter().filter_map(|x| x.as_object().cloned()).collect())
        .unwrap_or_default()
}

fn save(store: &Store, code: &str, items: &[Rec]) -> Result<()> {
    crate::store::guard(&store.root)?;
    let p = path(store, code);
    if items.is_empty() {
        if p.exists() {
            std::fs::remove_file(&p)?;
        }
        return Ok(());
    }
    write_atomic(&p, &(py_dumps_indent1(&json!({"pencil": items})) + "\n"))
}

/// The words an anchor runs from and to, as (chapter, verse, word) triples; a whole verse is its first word to its last.
fn bounds(a: &Anchor) -> ((u32, u32, u32), (u32, u32, u32)) {
    let start = (a.c1, a.v1, a.i1.unwrap_or(0));
    let (c2, v2) = (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1));
    let end = (c2, v2, if a.i1.is_some() { a.i2.or(a.i1).unwrap_or(0) } else { u32::MAX });
    (start, end)
}

fn overlap(a: &Anchor, b: &Anchor) -> bool {
    let (x, y) = (bounds(a), bounds(b));
    a.code == b.code && x.0 <= y.1 && y.0 <= x.1
}

fn parse(place: &str) -> Result<Anchor> {
    let a = anchors::parse(place)?;
    if a.kind == Kind::Lemma {
        return Err(bad("The pencil goes on words, phrases or verses."));
    }
    Ok(a)
}

/// Draw the pencil under a place (already one anchor). A line that already covers exactly it stays one line. → the line.
pub fn set(store: &Store, anchor: &str) -> Result<Value> {
    let a = parse(anchor)?;
    let mut items = list(store, &a.code);
    if let Some(same) = items.iter().find(|i| anchors::parse(&s(i, "anchor")).is_ok_and(|x| x.id() == a.id())) {
        return Ok(json!({"anchor": a.id(), "pencil": true, "id": same["id"], "created": same["created"]}));
    }
    let rec = json!({"id": new_id("p"), "anchor": a.id(), "created": now()}).as_object().unwrap().clone();
    items.push(rec.clone());
    save(store, &a.code, &items)?;
    Ok(json!({"anchor": a.id(), "pencil": true, "id": rec["id"], "created": rec["created"]}))
}

/// Take the pencil off a place: every line that touches it goes. → how many.
pub fn clear(store: &Store, anchor: &str) -> Result<Value> {
    let a = parse(anchor)?;
    let items = list(store, &a.code);
    let keep: Vec<Rec> = items.iter().filter(|i| !anchors::parse(&s(i, "anchor")).is_ok_and(|x| overlap(&x, &a))).cloned().collect();
    let removed = items.len() - keep.len();
    if removed > 0 {
        save(store, &a.code, &keep)?;
    }
    Ok(json!({"anchor": a.id(), "pencil": false, "removed": removed}))
}
