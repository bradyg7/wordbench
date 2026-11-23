//! The Shelf as a tree (R2, docs/archive/2026-11-10/docs/redesign-R2.md; the person chose the tree on 2026-11-09).
//!
//! A folder IS a set: each folder is an ordinary `sets/<slug>.md`, holding its own items. Where a folder sits is its own
//! file's `parent:` (the library design, L-22: a parent set's id, absent at the top); a file without one is read from the
//! older form below. Its order among its siblings is kept apart, in `settings/shelf.json` as
//! `{"folders": {"<set id>": {"parent": "<set id or empty>", "order": n}}}`, because both apps drop any extra front matter
//! when they rewrite a set. A set that is not in that file sits at the top, in name order; an entry whose set (or parent)
//! is gone, or that would loop, is read as the top. So a set made or deleted by the Python app never breaks the tree, and
//! the Python app sees every folder as a flat set with its own items.
//!
//! Open all (finding a484) is `open_plan`: what each item opens as in the window, as the window's own pane key (the keys
//! `layout` reopens), translated here from the Python app's kept panes so both apps can open the same set.

use crate::bible::Bible;
use crate::store::{bad, missing, s, Rec, Store};
use crate::studyapi::set_view;
use crate::Result;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

const PART: &str = "shelf";

fn placing(store: &Store) -> Map<String, Value> {
    store
        .settings(PART)
        .get("folders")
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

/// Each set's parent as read: only a parent that is a set, never a loop. → id → parent id ("" for the top).
fn parents(store: &Store) -> HashMap<String, String> {
    let pl = placing(store);
    let sets = store.sets();
    let ids: HashSet<String> = sets.iter().map(|t| s(t, "id")).collect();
    // L-22: the folder's own file says where it sits (`parent:`); a file without it is read from settings/shelf.json
    let own: HashMap<String, String> = sets
        .iter()
        .filter_map(|t| {
            t.get("parent")
                .and_then(|p| p.as_str())
                .map(|p| (s(t, "id"), p.to_string()))
        })
        .collect();
    let raw: HashMap<String, String> = ids
        .iter()
        .map(|id| {
            let p = own.get(id).cloned().unwrap_or_else(|| {
                pl.get(id)
                    .and_then(|v| v.get("parent"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string()
            });
            (
                id.clone(),
                if ids.contains(&p) && &p != id {
                    p
                } else {
                    String::new()
                },
            )
        })
        .collect();
    // a parent chain that comes back to itself is cut where it loops: that folder goes to the top
    let mut out = raw.clone();
    for id in &ids {
        let mut seen = HashSet::from([id.clone()]);
        let mut at = raw[id].clone();
        while !at.is_empty() {
            if !seen.insert(at.clone()) {
                out.insert(id.clone(), String::new());
                break;
            }
            at = raw.get(&at).cloned().unwrap_or_default();
        }
    }
    out
}

fn order_of(pl: &Map<String, Value>, id: &str) -> f64 {
    pl.get(id)
        .and_then(|v| v.get("order"))
        .and_then(|v| v.as_f64())
        .unwrap_or(f64::MAX)
}

/// The children of a folder ("" for the top), in their order (by name where none is kept).
fn children(store: &Store, par: &HashMap<String, String>, of: &str) -> Vec<Rec> {
    let pl = placing(store);
    let mut kids: Vec<Rec> = store
        .sets()
        .into_iter()
        .filter(|t| par.get(&s(t, "id")).map(String::as_str) == Some(of))
        .collect();
    kids.sort_by(|a, b| {
        order_of(&pl, &s(a, "id"))
            .partial_cmp(&order_of(&pl, &s(b, "id")))
            .unwrap()
            .then_with(|| {
                s(a, "name")
                    .to_lowercase()
                    .cmp(&s(b, "name").to_lowercase())
            })
    });
    kids
}

/// The whole Shelf: `{"folders": [...]}`, each folder as `wb set show` gives a set (each item with what Open all opens
/// for it, as `wb set open`), with its own `folders` inside.
pub fn tree(bible: &Bible, store: &Store) -> Result<Value> {
    let par = parents(store);
    fn node(
        bible: &Bible,
        store: &Store,
        par: &HashMap<String, String>,
        t: &Rec,
        depth: usize,
    ) -> Result<Value> {
        let mut v = set_view(bible, store, t)?;
        v["items"] = open_plan(bible, store, t)?["items"].clone();
        let kids = children(store, par, &s(t, "id"));
        v["parent"] = json!(par.get(&s(t, "id")).cloned().unwrap_or_default());
        v["depth"] = json!(depth);
        v["folders"] = json!(kids
            .iter()
            .map(|k| node(bible, store, par, k, depth + 1))
            .collect::<Result<Vec<_>>>()?);
        Ok(v)
    }
    let top = children(store, &par, "");
    // thread files are folders with a color (TH-1), listed apart so a set's own operations never meet one
    Ok(
        json!({"folders": top.iter().map(|t| node(bible, store, &par, t, 0)).collect::<Result<Vec<_>>>()?, "thread_folders": crate::folders::thread_folders(store)}),
    )
}

/// Write where every folder sits, from the parents and the order of each folder's children (sets that are gone are left out).
fn write_placing(
    store: &mut Store,
    par: &HashMap<String, String>,
    lists: &HashMap<String, Vec<String>>,
) -> Result<()> {
    let old = placing(store);
    let mut out = Map::new();
    for (id, p) in par {
        let mut e = old
            .get(id)
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();
        e.insert("parent".into(), json!(p));
        out.insert(id.clone(), Value::Object(e));
    }
    for (parent, ids) in lists {
        for (i, id) in ids.iter().enumerate() {
            out.insert(id.clone(), json!({"parent": parent, "order": i + 1}));
        }
    }
    // only a folder whose place this edit changes has its own file written (L-22); a legacy set file whose place is only
    // in settings/shelf.json stays byte for byte as it is, with its `updated` untouched
    let before = parents(store);
    let own: HashMap<String, String> = store
        .sets()
        .iter()
        .filter_map(|t| {
            t.get("parent")
                .and_then(|p| p.as_str())
                .map(|p| (s(t, "id"), p.to_string()))
        })
        .collect();
    for (id, p) in par {
        // a file with its own `parent:` is changed when that differs (a parent that is gone is cleared); a legacy file only
        // when this edit changes where the folder sits
        let differs = match own.get(id) {
            Some(o) => o != p,
            None => before.get(id) != Some(p),
        };
        if differs {
            store.set_parent(id, p)?;
        }
    }
    let mut sorted: Vec<(String, Value)> = out.into_iter().collect();
    sorted.sort_by(|a, b| a.0.cmp(&b.0));
    store.set_setting(
        PART,
        "folders",
        Some(Value::Object(sorted.into_iter().collect())),
    )?;
    Ok(())
}

fn kids_ids(store: &Store, par: &HashMap<String, String>, of: &str) -> Vec<String> {
    children(store, par, of)
        .iter()
        .map(|t| s(t, "id"))
        .collect()
}

fn is_inside(par: &HashMap<String, String>, id: &str, of: &str) -> bool {
    let mut at = par.get(id).cloned().unwrap_or_default();
    while !at.is_empty() {
        if at == of {
            return true;
        }
        at = par.get(&at).cloned().unwrap_or_default();
    }
    false
}

/// Put a folder inside another ("" for the top), before a sibling or at the end. A folder cannot go inside itself or a
/// folder inside it.
pub fn move_folder(store: &mut Store, id: &str, parent: &str, before: Option<&str>) -> Result<()> {
    let mut par = parents(store);
    if !par.contains_key(id) {
        return Err(missing("No such set."));
    }
    if !parent.is_empty() && !par.contains_key(parent) {
        return Err(missing("No such folder to put it in."));
    }
    if parent == id || is_inside(&par, parent, id) {
        return Err(bad(
            "A folder cannot go inside itself or a folder inside it.",
        ));
    }
    let old = par[id].clone();
    let mut lists = HashMap::new();
    let mut from = kids_ids(store, &par, &old);
    from.retain(|x| x != id);
    lists.insert(old.clone(), from);
    par.insert(id.to_string(), parent.to_string());
    let mut to = if parent == old {
        lists[&old].clone()
    } else {
        kids_ids(store, &par, parent)
            .into_iter()
            .filter(|x| x != id)
            .collect()
    };
    let at = match before {
        Some(b) if b != id => to
            .iter()
            .position(|x| x == b)
            .ok_or_else(|| missing("No such folder to put it before."))?,
        _ => to.len(),
    };
    to.insert(at, id.to_string());
    lists.insert(parent.to_string(), to);
    write_placing(store, &par, &lists)
}

/// A new folder (an empty set), inside `parent` ("" for the top), at its end.
pub fn new_folder(store: &mut Store, name: &str, parent: &str) -> Result<Rec> {
    if !parent.is_empty() && !store.sets().iter().any(|t| s(t, "id") == parent) {
        return Err(missing("No such folder to put it in."));
    }
    let t = store.create_set(name, &[])?;
    move_folder(store, &s(&t, "id"), parent, None)?;
    Ok(t)
}

/// Remove a folder: its set goes to .trash (the things it pointed at are not touched), and the folders inside it move up
/// a level, into its place (the rule W3 made for pages).
pub fn remove_folder(store: &mut Store, id: &str) -> Result<()> {
    let mut par = parents(store);
    if !par.contains_key(id) {
        return Err(missing("No such set."));
    }
    let up = par[id].clone();
    let inside = kids_ids(store, &par, id);
    let mut list = kids_ids(store, &par, &up);
    let at = list.iter().position(|x| x == id).unwrap_or(list.len());
    list.remove(at);
    for (i, k) in inside.iter().enumerate() {
        list.insert(at + i, k.clone());
        par.insert(k.clone(), up.clone());
    }
    store.delete_set(id)?;
    par.remove(id);
    write_placing(store, &par, &HashMap::from([(up, list)]))
}

/// Move (or, with `copy`, also keep) an item: inside its folder before another, or into another folder.
pub fn move_item(
    store: &mut Store,
    from: &str,
    key: &str,
    to: &str,
    before: Option<&str>,
    copy: bool,
) -> Result<Value> {
    if from == to {
        if copy {
            return Err(bad("It is already in that folder."));
        }
        store.move_in_set(from, key, before)?;
        return Ok(json!({"set": from, "key": key}));
    }
    let mut item = store.set_item_of(from, key)?;
    item.shift_remove("key");
    let t = store.add_to_set(to, &[Value::Object(item)])?;
    let new_key = t["keys"][0].as_str().unwrap_or("").to_string();
    if let Some(b) = before {
        store.move_in_set(to, &new_key, Some(b))?;
    }
    if !copy {
        store.remove_from_set(from, &[key.to_string()])?;
    }
    Ok(json!({"set": to, "key": new_key}))
}

// ---- Open all ----------------------------------------------------------------------------------------------------------

fn book_name(bible: &Bible, id: &Value) -> Option<String> {
    let n = id.as_u64()? as u32;
    bible
        .books()
        .iter()
        .find(|b| b.id == n)
        .map(|b| b.name.clone())
}

fn num(p: &Value, k: &str) -> u64 {
    p.get(k).and_then(|v| v.as_u64()).unwrap_or(0)
}

fn st(p: &Value, k: &str) -> String {
    p.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string()
}

/// A kept pane (the Python app's `{type, params}`) as the window's pane key, or why it cannot be opened.
pub fn pane_key(bible: &Bible, item: &Value) -> std::result::Result<String, String> {
    let p = item.get("params").cloned().unwrap_or(json!({}));
    let ty = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let cannot = || format!("This window cannot open a kept “{ty}” pane yet.");
    match ty {
        "passage" => {
            let b = book_name(bible, &p["book"]).ok_or_else(cannot)?;
            let ver = if st(&p, "version").eq_ignore_ascii_case("ylt") {
                "YLT"
            } else {
                "KJV"
            };
            Ok(format!("reader2|{b} {}|{ver}", num(&p, "ch").max(1)))
        }
        "interlinear" => {
            let b = book_name(bible, &p["book"]).ok_or_else(cannot)?;
            let (c1, v1, c2, v2) = (
                num(&p, "c1").max(1),
                num(&p, "v1"),
                num(&p, "c2"),
                num(&p, "v2"),
            );
            let c2 = c2.max(c1);
            let place = if v1 == 0 {
                format!("{b} {c1}")
            } else if v2 == 0 || (c2 == c1 && v2 == v1) {
                format!("{b} {c1}:{v1}")
            } else if c2 == c1 {
                format!("{b} {c1}:{v1}-{v2}")
            } else {
                format!("{b} {c1}:{v1}-{c2}:{v2}")
            };
            Ok(format!("interlinear|{place}"))
        }
        "entry" => {
            let sid = st(&p, "sid");
            if sid.is_empty() {
                Err(cannot())
            } else {
                Ok(format!("strong|{sid}"))
            }
        }
        "uses" => {
            let sid = st(&p, "strong");
            if sid.is_empty() {
                return Err(cannot());
            }
            let scope = Some(st(&p, "scope"))
                .filter(|x| !x.is_empty())
                .unwrap_or_else(|| "all".into());
            Ok(format!(
                "uses|{sid}|{}|{scope}|{}",
                st(&p, "word"),
                st(&p, "rendering")
            ))
        }
        "search" => {
            let q = st(&p, "q");
            if q.is_empty() {
                return Err(cannot());
            }
            let scope = Some(st(&p, "scope"))
                .filter(|x| !x.is_empty())
                .unwrap_or_else(|| "all".into());
            Ok(format!("search|{q}|{scope}"))
        }
        "help" => Ok("help".into()),
        _ => Err(cannot()),
    }
}

/// What Open all would open for a set: each item has an `open` target or a reason it cannot open.
/// Places and tracked documents use tabs. Standalone PDFs use the system viewer.
pub fn open_plan(bible: &Bible, store: &Store, t: &Rec) -> Result<Value> {
    let view = set_view(bible, store, t)?;
    let docs = crate::docs::records(store);
    let mut pdfs = None;
    let mut items = vec![];
    for it in view["items"].as_array().cloned().unwrap_or_default() {
        let kind = it["kind"].as_str().unwrap_or("").to_string();
        let r = it
            .get("ref")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let gone = it["gone"] == true;
        let open: std::result::Result<String, String> = if gone {
            Err("It is gone.".into())
        } else {
            match kind.as_str() {
                "pane" => pane_key(bible, &it),
                "thread" => Ok(format!("thread|{}", it["label"].as_str().unwrap_or(&r))),
                "place" => Ok(format!("reader2|{r}|KJV")),
                "note" => Ok(format!("note|{r}")),
                "lesson" => Ok(format!("lesson|{r}")),
                "document" => match docs.iter().find(|d| s(d, "id") == r) {
                    Some(d) => Ok(format!("doc|{r}|{}", s(d, "name"))),
                    None => Err("That document is gone.".into()),
                },
                "pdf" => match pdfs.get_or_insert_with(|| {
                    crate::docs::ExportFolders::for_study(&store.root)
                        .and_then(|out| crate::docs::pdfs::list(&out))
                }) {
                    Ok(files) => crate::docs::pdfs::find(files, &r, true)
                        .map(|pdf| format!("pdf|{}", pdf.name))
                        .map_err(|e| e.0),
                    Err(e) => Err(e.0.clone()),
                },
                _ => Err("This item cannot be opened here.".into()),
            }
        };
        let mut o = it.as_object().cloned().unwrap_or_default();
        match open {
            Ok(k) => o.insert("open".into(), json!(k)),
            Err(w) => o.insert("why".into(), json!(w)),
        };
        items.push(Value::Object(o));
    }
    Ok(json!({"id": view["id"], "name": view["name"], "items": items}))
}

/// A document record by id (for adding one to a folder by name).
pub fn document_id(store: &Store, name: &str) -> Result<String> {
    Ok(s(&crate::docs::find(store, name)?, "id"))
}

/// A tab of the window (its pane key and title) as an item a set keeps, in the Python app's shape, so either app can open
/// it again (the reverse of `pane_key`). A second reader is kept as a place; a thread, lesson, page or document as itself.
pub fn item_from_key(bible: &Bible, key: &str, title: &str) -> Result<Value> {
    let parts: Vec<&str> = key.split('|').collect();
    let x = |i: usize| parts.get(i).copied().unwrap_or("").to_string();
    let title = if title.trim().is_empty() {
        "Pane".to_string()
    } else {
        title.trim().to_string()
    };
    let pane = |ty: &str, id: &str, params: Value| json!({"kind": "pane", "type": ty, "id": id, "title": title, "params": params});
    let span = |text: &str| crate::places::parse_span(text, bible.books());
    Ok(match parts[0] {
        "strong" => pane(
            "entry",
            "word",
            json!({"sid": x(1), "english": "", "paneId": "word", "word": "", "anchor": ""}),
        ),
        "uses" => pane(
            "uses",
            "uses",
            json!({"strong": x(1), "word": x(2), "rendering": x(4), "cat": "all", "scope": if x(3).is_empty() { "all".into() } else { x(3) }}),
        ),
        "search" => pane(
            "search",
            "search",
            json!({"q": x(1), "case": false, "regex": false, "scope": if x(2).is_empty() { "all".into() } else { x(2) }}),
        ),
        "help" => pane("help", "help", json!({"topic": "", "open": []})),
        "interlinear" => {
            let sp = span(&x(1))?;
            pane(
                "interlinear",
                "interlinear",
                json!({"book": sp.book.id, "c1": sp.c1, "v1": sp.v1, "c2": sp.c2, "v2": sp.v2}),
            )
        }
        "reader2" => {
            let sp = span(&x(1))?;
            match crate::places::span_anchor(&sp) {
                Some(a) => json!({"kind": "place", "ref": a}),
                None => pane(
                    "passage",
                    "passage",
                    json!({"book": sp.book.id, "ch": sp.c1, "v": 0, "version": if x(2) == "YLT" { "YLT" } else { "KJV" }}),
                ),
            }
        }
        "thread" => json!({"kind": "thread", "ref": x(1)}),
        "lesson" => json!({"kind": "lesson", "ref": x(1)}),
        "note" => json!({"kind": "note", "ref": x(1)}),
        "doc" => json!({"kind": "document", "ref": x(1)}),
        _ => return Err(bad("That tab cannot be kept in a set.")),
    })
}

/// Each folder's parent as read ("" for the top): `parents`, for the library's folder list.
pub fn parent_map(store: &Store) -> HashMap<String, String> {
    parents(store)
}

/// The folders inside one ("" for the top), in their order.
pub fn children_of(store: &Store, par: &HashMap<String, String>, of: &str) -> Vec<Rec> {
    children(store, par, of)
}
