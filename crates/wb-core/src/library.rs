//! The library (design/features/library, accepted 2026-11-17): the Notebook and the Shelf as one tree of pages, folders and
//! saves. This module is the data model other folders (threads, marks, questions) build on.
//!
//! - **A save** is a pointer: a set item (the same item a folder has always held) to a place, a phrase or word, a page, a
//!   document, a search or a sitting. It is never a copy, and saving a thing twice in one folder keeps one.
//! - **A folder** is a set (`sets/<slug>.md`). Its items are its saves and its pages (L-22: membership is kept in the
//!   folder's set file, the page file does not move, so a thing can sit in several folders, L-3). A folder inside another
//!   has `parent:` in its own file (see `shelf`). A folder has no text of its own that matters here.
//! - **The Shelf** is the saves in no folder (L-5): `settings/shelf.json`, key `saves`, the same items. Putting a save in a
//!   folder takes it off the Shelf; taking it out of its last folder puts it back on the Shelf, and never closes a tab
//!   (that is the window's, 9413).
//! - **A saved sitting** (L-24) is the set item kind `sitting` whose `ref` is the id of the sitting's first step in
//!   `history/`.
//!
//! A *thing* is named in one text: a place or phrase (`Num 25:11`, `NUM.25:11.4`, a chapter, `H7065`), `page:<id>`,
//! `search:"words"`, `document:<name>`, `sitting:<step id | last>`. Nothing here writes scripture; places are references.

use crate::bible::Bible;
use crate::store::{bad, missing, s, Rec, Store};
use crate::Result;
use serde_json::{json, Value};

/// A thing as the set item that keeps it (no key yet).
pub fn item_of(bible: &Bible, store: &Store, thing: &str) -> Result<Value> {
    let t = thing.trim();
    if t.is_empty() {
        return Err(bad("Name what to save: a place (Num 25:11), H7065, page:<id>, search:\"words\", document:<name> or sitting:<id>."));
    }
    let (head, rest) = match t.split_once(':') {
        Some((h, r)) if ["page", "search", "document", "sitting", "thread"].contains(&h.to_lowercase().as_str()) => (h.to_lowercase(), r.trim()),
        _ => (String::new(), t),
    };
    match head.as_str() {
        "page" => {
            if let Some(slug) = crate::threadpage::slug_of(rest) {
                store.thread(slug)?;
                return Ok(json!({"kind": "thread", "ref": slug}));
            }
            let id = store.find_note(rest)?;
            Ok(json!({"kind": "note", "ref": s(&id, "id")}))
        }
        "thread" => {
            store.thread(rest)?;
            Ok(json!({"kind": "thread", "ref": rest}))
        }
        "search" => {
            let q = rest.trim_matches('"').trim();
            if q.is_empty() {
                return Err(bad("A saved search needs its words: search:\"Phinehas\"."));
            }
            crate::shelf::item_from_key(bible, &format!("search|{q}|all"), q)
        }
        "document" => Ok(json!({"kind": "document", "ref": crate::shelf::document_id(store, rest.trim_matches('"'))?})),
        "sitting" => {
            let sit = crate::history::sitting(&store.root, rest)?;
            Ok(json!({"kind": "sitting", "ref": sit["start"]}))
        }
        _ => Ok(json!({"kind": "place", "ref": crate::notebook::place_anchor(bible, t)?})),
    }
}

/// Where a thing is kept: the folders (id and name) and whether it is on the Shelf.
fn find_in(store: &Store, item: &Value) -> (Vec<(String, String, String)>, Option<String>) {
    let mut folders = vec![];
    for t in store.sets() {
        if let Some(i) = t["items"].as_array().and_then(|a| a.iter().find(|i| i.as_object().is_some_and(|o| Store::same_item(item, o)))) {
            folders.push((s(&t, "id"), s(&t, "name"), s_of(i, "key")));
        }
    }
    let shelf = store.shelf_saves().iter().find(|i| i.as_object().is_some_and(|o| Store::same_item(item, o))).map(|i| s_of(i, "key"));
    (folders, shelf)
}

fn s_of(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// Where a thing is saved now: `{"thing", "item", "saved", "folders": [{id, name, key}], "shelf"}`.
pub fn where_saved(bible: &Bible, store: &Store, thing: &str) -> Result<Value> {
    let item = item_of(bible, store, thing)?;
    let (folders, shelf) = find_in(store, &item);
    Ok(json!({"thing": thing.trim(), "item": item, "saved": !folders.is_empty() || shelf.is_some(),
        "folders": folders.iter().map(|(id, name, key)| json!({"id": id, "name": name, "key": key})).collect::<Vec<_>>(),
        "shelf": shelf.is_some()}))
}

/// Save a thing (K): in each folder named (an id or a name, as `wb set show` finds one), or on the Shelf when none is
/// named. A thing already in a folder and saved with no folder stays where it is. → `where_saved`'s answer.
pub fn save(bible: &Bible, store: &mut Store, thing: &str, folders: &[String]) -> Result<Value> {
    let item = item_of(bible, store, thing)?;
    let ids: Vec<String> = folders.iter().map(|f| store.find_set(f).map(|t| s(&t, "id"))).collect::<Result<_>>()?;
    let (in_folders, on_shelf) = find_in(store, &item);
    if ids.is_empty() {
        if in_folders.is_empty() && on_shelf.is_none() {
            store.shelf_add(&[item])?;
        }
    } else {
        for id in &ids {
            store.add_to_set(id, std::slice::from_ref(&item))?;
        }
        if let Some(key) = on_shelf {
            store.shelf_remove(&[key])?;
        }
    }
    where_saved(bible, store, thing)
}

/// Take a save out of one folder (`folder`), leaving it saved: on the Shelf if that was its last folder. Without a folder,
/// unsave it everywhere. The thing and its tab are not touched.
pub fn unsave(bible: &Bible, store: &mut Store, thing: &str, folder: Option<&str>) -> Result<Value> {
    let item = item_of(bible, store, thing)?;
    let (in_folders, on_shelf) = find_in(store, &item);
    match folder {
        Some(f) => {
            let id = s(&store.find_set(f)?, "id");
            let Some((_, _, key)) = in_folders.iter().find(|(i, _, _)| *i == id) else {
                return Err(missing("That thing is not saved in that folder."));
            };
            store.remove_from_set(&id, std::slice::from_ref(key))?;
            if in_folders.len() == 1 && on_shelf.is_none() {
                store.shelf_add(&[item])?;
            }
        }
        None => {
            if in_folders.is_empty() && on_shelf.is_none() {
                return Err(missing("That thing is not saved."));
            }
            for (id, _, key) in &in_folders {
                store.remove_from_set(id, std::slice::from_ref(key))?;
            }
            if let Some(key) = on_shelf {
                store.shelf_remove(&[key])?;
            }
        }
    }
    where_saved(bible, store, thing)
}

/// The Shelf: the saves in no folder, as a folder shows its items (`wb set show`).
pub fn shelf_view(bible: &Bible, store: &Store) -> Result<Value> {
    let t: Rec = json!({"id": "", "name": "Shelf", "created": "", "updated": "", "note": "", "items": store.shelf_saves()}).as_object().unwrap().clone();
    let mut v = crate::studyapi::set_view(bible, store, &t)?;
    v["id"] = Value::Null;
    Ok(v)
}

/// Every folder, flat, in tree order: `{id, name, parent, depth, items, folders}` (`wb folder list`).
pub fn folder_list(store: &Store) -> Value {
    let tree = crate::shelf::parent_map(store);
    let mut out = vec![];
    fn walk(store: &Store, par: &std::collections::HashMap<String, String>, of: &str, depth: usize, out: &mut Vec<Value>) {
        for t in crate::shelf::children_of(store, par, of) {
            let id = s(&t, "id");
            let kids = crate::shelf::children_of(store, par, &id).len();
            out.push(json!({"id": id, "name": t["name"], "parent": of, "depth": depth, "items": t["items"].as_array().map(|a| a.len()).unwrap_or(0), "folders": kids}));
            walk(store, par, &id, depth + 1, out);
        }
    }
    walk(store, &tree, "", 0, &mut out);
    json!(out)
}

/// Items a folder or the Shelf holds whose thing is gone (a page file deleted by hand, a removed document): each
/// `{folder, key, kind, ref}`. Nothing is shown broken and nothing is removed; `wb study check` reports them (L-22).
pub fn dangling(bible: &Bible, store: &Store) -> Result<Vec<Value>> {
    let docs: Vec<String> = crate::docs::records(store).iter().map(|d| s(d, "id")).collect();
    let mut out = vec![];
    let mut check = |folder: &str, view: &Value| {
        for i in view["items"].as_array().cloned().unwrap_or_default() {
            let gone = i["gone"] == true || (i["kind"] == "document" && !docs.contains(&s_of(&i, "ref")));
            if gone {
                out.push(json!({"folder": folder, "key": i["key"], "kind": i["kind"], "ref": i["ref"]}));
            }
        }
    };
    for t in store.sets() {
        check(&s(&t, "name"), &crate::studyapi::set_view(bible, store, &t)?);
    }
    check("Shelf", &shelf_view(bible, store)?);
    Ok(out)
}

// ---- the one search (S21) and the filter line (S27) ----------------------------------------------------------------------

/// What `wb find` asks when it is given more than words. `kind`: "" (all), page, folder, save, question or margin.
#[derive(Default)]
pub struct Find<'a> {
    pub words: &'a str,
    pub kind: &'a str,
    pub folder: Option<&'a str>,
    pub has_question: bool,
    /// Edited since: `7d` (days ago) or a date (`2026-11-01`).
    pub edited: Option<&'a str>,
    /// `edited` (newest first, the default) or `title` (A-Z).
    pub sort: &'a str,
}

fn since(text: &str) -> Result<String> {
    let t = text.trim();
    if let Some(n) = t.strip_suffix('d').and_then(|n| n.parse::<i64>().ok()) {
        return Ok((chrono::Utc::now() - chrono::Duration::days(n)).format("%Y-%m-%d").to_string());
    }
    if crate::store::is_day(t) {
        return Ok(t.to_string());
    }
    Err(bad("--edited takes a number of days (7d) or a date (2026-11-01)."))
}

/// Pages, folders, saves and questions in one list, grouped by kind: `{q, count, total, groups: [{kind, count, results}]}`.
/// `total` is how many there were before the words and filters, for "23 of 412". Margin notes and highlights are groups too.
pub fn find(bible: &Bible, store: &Store, f: &Find<'_>) -> Result<Value> {
    if !["", "page", "folder", "save", "question", "margin", "highlight"].contains(&f.kind) {
        return Err(bad("--kind is page, folder, save, question, margin or highlight."));
    }
    if !["", "edited", "title"].contains(&f.sort) {
        return Err(bad("--sort is edited or title."));
    }
    let words: Vec<String> = f.words.to_lowercase().split_whitespace().map(String::from).collect();
    let has = |blob: &str| words.iter().all(|w| blob.to_lowercase().contains(w.as_str()));
    let cutoff = f.edited.map(since).transpose()?;
    let want = |k: &str| f.kind.is_empty() || f.kind == k;
    let in_folder: Option<Vec<(String, String)>> = match f.folder {
        Some(name) => {
            let t = store.find_set(name)?;
            Some(t["items"].as_array().cloned().unwrap_or_default().iter().map(|i| (s_of(i, "kind"), s_of(i, "ref"))).collect())
        }
        None => None,
    };
    let folder_id = f.folder.map(|n| store.find_set(n).map(|t| s(&t, "id"))).transpose()?;
    let mut groups = vec![];
    let mut out_groups: Vec<(String, Vec<Value>)> = vec![];
    let mut all_total = 0usize;
    if want("page") {
        let pages: Vec<Value> = crate::notebook::find_lines(bible, store);
        all_total += pages.len();
        let rows = pages
            .into_iter()
            .filter(|e| crate::notebook::words_in(e, &words))
            .filter(|e| !f.has_question || e["text"].as_str().unwrap_or("").contains("[!question]"))
            .filter(|e| cutoff.as_ref().is_none_or(|c| e["updated"].as_str().unwrap_or("") >= c.as_str()))
            .filter(|e| in_folder.as_ref().is_none_or(|l| l.iter().any(|(k, r)| k == "note" && r == e["id"].as_str().unwrap_or(""))))
            .map(|e| json!({"kind": "page", "id": e["id"], "title": e["title"], "snippet": e["preview"], "updated": e["updated"]}))
            .collect();
        out_groups.push(("page".into(), rows));
    }
    if want("folder") && in_folder.is_none() && !f.has_question && cutoff.is_none() {
        let sets = store.sets();
        all_total += sets.len();
        let rows = sets.iter().filter(|t| has(&s(t, "name"))).map(|t| json!({"kind": "folder", "id": t["id"], "title": t["name"], "updated": t["updated"]})).collect();
        out_groups.push(("folder".into(), rows));
    }
    if want("save") && !f.has_question {
        let mut rows = vec![];
        let mut every: Vec<(String, Value)> = vec![];
        for t in store.sets() {
            if folder_id.as_ref().is_some_and(|id| *id != s(&t, "id")) {
                continue;
            }
            let v = crate::studyapi::set_view(bible, store, &t)?;
            for i in v["items"].as_array().cloned().unwrap_or_default() {
                every.push((s(&t, "name"), i));
            }
        }
        if in_folder.is_none() {
            let v = shelf_view(bible, store)?;
            for i in v["items"].as_array().cloned().unwrap_or_default() {
                every.push((String::new(), i));
            }
        }
        all_total += every.len();
        for (folder, i) in every {
            let label = s_of(&i, "label");
            if has(&format!("{label} {}", s_of(&i, "ref"))) && cutoff.is_none() {
                rows.push(json!({"kind": "save", "id": i["key"], "title": label, "type": i["kind"], "ref": i["ref"], "folder": folder, "updated": ""}));
            }
        }
        out_groups.push(("save".into(), rows));
    }
    if want("question") {
        let qs = crate::questions::entries(bible, store);
        all_total += qs.len();
        let rows = qs
            .into_iter()
            .filter(|e| has(&format!("{} {}", e["title"].as_str().unwrap_or(""), e["text"].as_str().unwrap_or(""))))
            .filter(|e| cutoff.is_none() && in_folder.is_none())
            .map(|e| json!({"kind": "question", "id": e["id"], "title": e["title"], "snippet": e["text"], "updated": e["updated"]}))
            .collect();
        out_groups.push(("question".into(), rows));
    }
    if want("margin") {
        let notes = crate::margin::rows(bible, store);
        all_total += notes.len();
        let rows = notes
            .into_iter()
            .filter(|e| has(&format!("{} {}", e["title"].as_str().unwrap_or(""), e["snippet"].as_str().unwrap_or(""))))
            .filter(|e| !f.has_question || e["question"] == true)
            .filter(|e| cutoff.as_ref().is_none_or(|c| e["updated"].as_str().unwrap_or("") >= c.as_str()))
            .filter(|_| in_folder.is_none())
            .collect();
        out_groups.push(("margin".into(), rows));
    }
    if want("highlight") {
        let hl = store.all_highlights();
        all_total += hl.len();
        let rows = hl
            .iter()
            .map(|h| (crate::notebook::label(bible, &s(h, "anchor")), h))
            .filter(|(label, h)| has(&format!("{label} {} {}", s(h, "quote"), s(h, "color"))))
            .filter(|(_, h)| cutoff.as_ref().is_none_or(|c| s(h, "created").as_str() >= c.as_str()))
            .filter(|_| in_folder.is_none() && !f.has_question)
            .map(|(label, h)| json!({"kind": "highlight", "id": h["id"], "title": label, "snippet": s(h, "quote"), "color": h["color"], "updated": s(h, "created")}))
            .collect();
        out_groups.push(("highlight".into(), rows));
    }
    let mut count = 0;
    for (kind, mut rows) in out_groups {
        if f.sort == "title" {
            rows.sort_by_key(|r| r["title"].as_str().unwrap_or("").to_lowercase());
        } else {
            rows.sort_by(|a, b| b["updated"].as_str().unwrap_or("").cmp(a["updated"].as_str().unwrap_or("")));
        }
        count += rows.len();
        groups.push(json!({"kind": kind, "count": rows.len(), "results": rows}));
    }
    Ok(json!({"q": f.words.trim(), "count": count, "total": all_total, "groups": groups}))
}
