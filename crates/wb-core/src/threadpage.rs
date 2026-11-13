//! A thread as a page (R1, `docs/archive/2026-11-10/docs/redesign-R1.md` question 2; sheets R1.1, R1.2). The thread file (`threads/<slug>.md`)
//! stays the file of record, in the Python app's format: its name, color, note and places. The window reads it as a page
//! whose id is `thread:<slug>`: the thread's note is the page's text (written block by block through the same edit
//! functions as any page), its places are the thread's own list, and the notes written on it are the pages under it.
//!
//! Nothing new goes in the thread file: both apps write it from a fixed model and would drop an extra field. What a thread
//! page needs besides, where it sits in Pinned, is in `settings/pages.json` (`{"pinned": {"<slug>": 1}}`), a file the
//! Python app passes over.

use crate::bible::Bible;
use crate::notebook as nb;
use crate::store::{bad, missing, s, Rec, Store};
use crate::{pages, studyapi, Result};
use serde_json::{json, Value};

pub const PREFIX: &str = "thread:";

/// The thread's slug in a page id (`thread:phinehas`), if it is one.
pub fn slug_of(id: &str) -> Option<&str> {
    id.trim().strip_prefix(PREFIX).filter(|s| !s.is_empty())
}

/// A thread's page id.
pub fn page_id(slug: &str) -> String {
    format!("{PREFIX}{slug}")
}

/// Where a thread is in Pinned (`settings/pages.json`), if it is.
pub fn pinned_of(store: &Store, slug: &str) -> Option<f64> {
    store.settings("pages").get("pinned")?.get(slug)?.as_f64()
}

/// Put a thread at a place in Pinned, or (None) take it out. Other threads' places are kept as they are.
pub fn set_pinned(store: &mut Store, slug: &str, at: Option<i64>) -> Result<()> {
    store.thread(slug)?;
    let mut all = store.settings("pages").get("pinned").and_then(|p| p.as_object().cloned()).unwrap_or_default();
    match at {
        Some(n) => {
            all.insert(slug.into(), json!(n));
        }
        None => {
            all.shift_remove(slug);
        }
    }
    store.set_setting("pages", "pinned", if all.is_empty() { None } else { Some(Value::Object(all)) })?;
    Ok(())
}

/// A thread as a note-shaped record, for the Notebook's entries: its note is the text.
fn as_note(t: &Rec) -> Rec {
    let id = page_id(&s(t, "id"));
    json!({"id": id, "anchor": "", "kind": "thread", "quote": "", "strong": "", "text": s(t, "note"),
        "created": s(t, "created"), "updated": s(t, "updated")})
    .as_object()
    .unwrap()
    .clone()
}

/// One thread as the Notebook's entry (`nb::show`'s start, and a row of the tree).
pub fn entry(bible: &Bible, store: &Store, t: &Rec) -> Value {
    let slug = s(t, "id");
    let mut e = nb::entry_of(bible, &as_note(t), "thread", false);
    e["title"] = t["name"].clone();
    e["preview"] = json!(crate::store::cut(&s(t, "note").split_whitespace().collect::<Vec<_>>().join(" "), 140));
    e["slug"] = json!(slug);
    e["color"] = json!(s(t, "color"));
    e["pinned"] = pinned_of(store, &slug).map(|n| json!(n)).unwrap_or(Value::Null);
    e["places"] = json!(t["members"].as_array().map(|a| a.len()).unwrap_or(0));
    e["threads"] = json!([]);
    e["also"] = json!([]);
    e
}

/// Every thread as an entry (the tree's rows, and the titles a `[[link]]` can name).
pub fn lines(bible: &Bible, store: &Store) -> Vec<Value> {
    store.threads().into_iter().map(|t| entry(bible, store, t)).collect()
}

/// The page of a thread by its slug (or its page id): the entry as `nb::show` gives any page, with the thread's places as
/// the thread shows them (`places`: each with its reference, text and original words), the pages written on it (`pages`:
/// notes and questions, oldest first) and the blocks of its note (`blocks`). → `wb thread page`.
pub fn page(bible: &Bible, store: &Store, slug_or_id: &str) -> Result<Value> {
    let slug = slug_of(slug_or_id).unwrap_or(slug_or_id.trim());
    store.thread(slug)?;
    let mut e = nb::show(bible, store, &page_id(slug))?;
    let view = studyapi::thread_view(bible, store, slug)?;
    e["places"] = view["members"].clone();
    e["strongs"] = view["strongs"].clone();
    e["pages"] = nb::thread_notes(bible, store, slug)?["notes"].clone();
    e["blocks"] = pages::blocks(store, &page_id(slug))?["blocks"].clone();
    Ok(e)
}

/// The note of a thread, for the block editor: its page id's text.
pub(crate) fn note_text(store: &Store, id: &str) -> Result<String> {
    let slug = slug_of(id).ok_or_else(|| missing("Not a thread page."))?;
    Ok(s(&store.thread(slug)?, "note"))
}

/// A thread's note changed (what `edit_text` does for a thread page). → the entry.
pub(crate) fn write_note(bible: &Bible, store: &mut Store, id: &str, text: &str) -> Result<Value> {
    let slug = slug_of(id).ok_or_else(|| bad("Not a thread page."))?;
    let t = store.update_thread(slug, None, Some(text), None)?;
    Ok(entry(bible, store, &t))
}
