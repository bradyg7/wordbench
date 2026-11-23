//! A folder with a color, and its eye (threads, TH-1 to TH-12). A thread is a folder with a color. A set folder carries its
//! color in its own file (`color:`); a thread file (`threads/<slug>.md`) is read where it is, as a folder with a color, and
//! is never moved or rewritten by reading (TH-2, TH-12). Its saves are its places, in the file's order; its note is the one
//! page in it. The eyes (which colored folders the text shows) are in `settings/folders.json`, key `hidden`, never in a
//! thread's file.

use crate::bible::Bible;
use crate::store::{bad, cut, missing, s, Rec, Store};
use crate::Result;
use serde_json::{json, Value};

const EYES: &str = "folders";

/// A folder as `wb folder` names it: a set folder, or a thread file read as one.
#[derive(Debug, Clone)]
pub struct Folder {
    /// The eye's key: a set's id, or `thread:<slug>` for a thread file.
    pub key: String,
    /// The set's id, or the thread's slug.
    pub id: String,
    pub thread: bool,
    pub name: String,
    pub color: String,
}

fn all_folders(store: &Store) -> Vec<Folder> {
    let mut v: Vec<Folder> = store
        .sets()
        .iter()
        .map(|t| Folder {
            key: s(t, "id"),
            id: s(t, "id"),
            thread: false,
            name: s(t, "name"),
            color: s(t, "color"),
        })
        .collect();
    let mut th: Vec<Folder> = store
        .threads()
        .iter()
        .map(|t| Folder {
            key: crate::threadpage::page_id(&s(t, "id")),
            id: s(t, "id"),
            thread: true,
            name: s(t, "name"),
            color: s(t, "color"),
        })
        .collect();
    th.sort_by_key(|f| f.name.to_lowercase());
    v.extend(th);
    v
}

/// A folder by key, id, exact name, a unique start of a name, else a unique part of one (sets and thread files alike).
pub fn find_folder(store: &Store, name: &str) -> Result<Folder> {
    let n = name.trim().to_lowercase();
    let every = all_folders(store);
    let pools: [Vec<&Folder>; 3] = [
        every
            .iter()
            .filter(|f| {
                f.key.to_lowercase() == n || f.id.to_lowercase() == n || f.name.to_lowercase() == n
            })
            .collect(),
        every
            .iter()
            .filter(|f| f.name.to_lowercase().starts_with(&n))
            .collect(),
        every
            .iter()
            .filter(|f| f.name.to_lowercase().contains(&n))
            .collect(),
    ];
    let hit: Vec<&Folder> = if n.is_empty() {
        vec![]
    } else {
        pools
            .into_iter()
            .find(|p| !p.is_empty())
            .unwrap_or_default()
    };
    match hit.len() {
        0 => Err(missing(format!(
            "No folder called “{}”.",
            cut(name.trim(), 60)
        ))),
        1 => Ok(hit[0].clone()),
        _ => Err(bad(format!(
            "Which folder? {}",
            hit.iter()
                .map(|f| f.name.clone())
                .collect::<Vec<_>>()
                .join(", ")
        ))),
    }
}

pub fn hidden_keys(store: &Store) -> Vec<String> {
    store
        .settings(EYES)
        .get("hidden")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|x| x.as_str().map(String::from))
        .collect()
}

/// Is a folder's eye on? (A folder with no color has none: false.)
pub fn eye_on(store: &Store, f: &Folder) -> bool {
    !f.color.is_empty() && !hidden_keys(store).contains(&f.key)
}

/// The mark id the reader's chapter marks give a folder: a thread file's slug (as ever), a set folder's `folder:<id>`.
pub fn mark_id(f: &Folder) -> String {
    if f.thread {
        f.id.clone()
    } else {
        format!("folder:{}", f.id)
    }
}

/// Every folder with a color, as the reader's marks need it.
pub fn colored(store: &Store) -> Vec<Folder> {
    all_folders(store)
        .into_iter()
        .filter(|f| !f.color.is_empty())
        .collect()
}

fn folder_json(store: &Store, f: &Folder) -> Value {
    json!({"key": f.key, "id": f.id, "name": f.name, "color": f.color, "kind": if f.thread { "thread" } else { "folder" }, "shown": eye_on(store, f), "mark": mark_id(f)})
}

/// Give a folder a color, or (`none`) take it off. A thread file's color is its own field (`wb thread edit --color`).
pub fn folder_color(store: &mut Store, name: &str, color: &str) -> Result<Value> {
    let f = find_folder(store, name)?;
    let c = if ["none", "off", "-"].contains(&color.trim().to_lowercase().as_str()) {
        ""
    } else {
        color.trim()
    };
    if f.thread {
        store.update_thread(&f.id, None, None, Some(Some(c)))?;
    } else {
        store.set_color(&f.id, c)?;
    }
    let f = find_folder(store, &f.key)?;
    Ok(folder_json(store, &f))
}

fn write_hidden(store: &mut Store, hidden: Vec<String>) -> Result<()> {
    store.set_setting(
        EYES,
        "hidden",
        if hidden.is_empty() {
            None
        } else {
            Some(json!(hidden))
        },
    )?;
    Ok(())
}

/// The eyes: every folder with a color and whether the text shows it, the shown ones first.
pub fn eyes(store: &Store) -> Value {
    let mut v: Vec<Value> = colored(store)
        .iter()
        .map(|f| folder_json(store, f))
        .collect();
    v.sort_by_key(|x| x["shown"] != true);
    json!(v)
}

/// Turn one eye on or off. A folder with no color has no eye.
pub fn folder_shown(store: &mut Store, name: &str, on: bool) -> Result<Value> {
    let f = find_folder(store, name)?;
    if f.color.is_empty() {
        return Err(bad(format!("“{}” has no color, so nothing of it shows on the text. Give it one: wb folder color \"{}\" yellow.", f.name, f.name)));
    }
    let mut hidden = hidden_keys(store);
    hidden.retain(|k| *k != f.key);
    if !on {
        hidden.push(f.key.clone());
    }
    write_hidden(store, hidden)?;
    Ok(folder_json(store, &f))
}

/// Every eye on or off in one action (`all`, `none`), or exactly `only` on (`restore`, what Undo of Hide all uses).
/// → `{"was_shown": [keys], "folders": eyes}`.
pub fn folder_shown_all(store: &mut Store, mode: &str, only: &[String]) -> Result<Value> {
    let every = colored(store);
    let was: Vec<String> = every
        .iter()
        .filter(|f| eye_on(store, f))
        .map(|f| f.key.clone())
        .collect();
    let hidden: Vec<String> = match mode {
        "all" => vec![],
        "none" => every.iter().map(|f| f.key.clone()).collect(),
        _ => every
            .iter()
            .filter(|f| !only.contains(&f.key))
            .map(|f| f.key.clone())
            .collect(),
    };
    write_hidden(store, hidden)?;
    Ok(json!({"was_shown": was, "folders": eyes(store)}))
}

/// A thread file as the set it is read as: its places are its items, in the file's order, each keyed by its anchor.
fn thread_as_set(t: &Rec) -> Rec {
    let items: Vec<Value> = t["members"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|m| json!({"key": m["anchor"], "kind": "place", "ref": m["anchor"]}))
        .collect();
    json!({"id": crate::threadpage::page_id(&s(t, "id")), "name": t["name"], "created": t["created"], "updated": t["updated"], "note": "", "items": items})
        .as_object()
        .unwrap()
        .clone()
}

/// A folder opened (`wb folder show`): its saves (a thread file's places, in its file's order) and its pages (a thread
/// file's note is one page, `thread:<slug>`). Nothing is written.
fn folder_base(bible: &Bible, store: &Store, name: &str) -> Result<Value> {
    let f = find_folder(store, name)?;
    let mut v = if f.thread {
        let t = store.thread(&f.id)?;
        let mut v = crate::studyapi::set_view(bible, store, &thread_as_set(&t))?;
        v["pages"] =
            json!([{"id": crate::threadpage::page_id(&f.id), "title": f.name, "kind": "thread"}]);
        v
    } else {
        let t = store.find_set(&f.id)?;
        let mut v = crate::studyapi::set_view(bible, store, &t)?;
        let pages: Vec<Value> = v["items"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter(|i| i["kind"] == "note")
            .map(|i| json!({"id": i["ref"], "title": i["label"], "kind": "note"}))
            .collect();
        v["pages"] = json!(pages);
        v
    };
    for (k, x) in folder_json(store, &f).as_object().unwrap() {
        v[k] = x.clone();
    }
    v["count"] = json!(v["items"].as_array().map(|a| a.len()).unwrap_or(0));
    Ok(v)
}

/// What a folder's saves can be narrowed by (filters-v2 row 15): the kind of save (Verse, Word, Page) and the book a verse is in.
pub const SAVE_PROPERTIES: [&str; 2] = ["Save", "Book"];

fn save_kind(i: &Value) -> &'static str {
    let r = i["ref"].as_str().unwrap_or("");
    if i["kind"] == "note" {
        "Page"
    } else if r.len() > 1
        && r.as_bytes()[0].is_ascii_alphabetic()
        && matches!(r.as_bytes()[0], b'H' | b'G' | b'h' | b'g')
        && r[1..].chars().all(|c| c.is_ascii_digit())
    {
        "Word"
    } else {
        "Verse"
    }
}

/// A folder opened with its saves narrowed (`wb folder show NAME --kind Verse --book Numbers`, or `--filter "Save is Verse"`): `items`
/// keep what passes, `total` is how many there were, and `kinds` and `books` count the saves by kind and by book (from all of them), for the
/// chips' pickers and the head's "18 of 120". A filter naming another property is refused with the ones a folder's saves have.
pub fn folder_view_filtered(
    bible: &Bible,
    store: &Store,
    name: &str,
    filters: &[crate::filters::Filter],
) -> Result<Value> {
    use crate::filters::passes;
    let mut v = folder_base(bible, store, name)?;
    for f in filters {
        if !SAVE_PROPERTIES
            .iter()
            .any(|p| p.eq_ignore_ascii_case(&f.property))
        {
            return Err(crate::store::bad(format!(
                "A folder's saves have no property called “{}”; they have {}.",
                f.property,
                SAVE_PROPERTIES.join(", ")
            )));
        }
    }
    let items: Vec<Value> = v["items"].as_array().cloned().unwrap_or_default();
    let facts = |i: &Value| -> (Vec<String>, Vec<String>) {
        let book = i["ref"]
            .as_str()
            .and_then(|r| crate::anchors::parse(r).ok())
            .filter(|a| a.kind != crate::anchors::Kind::Lemma)
            .and_then(|a| bible.book(&a.code).ok().map(|b| b.name.clone()));
        (vec![save_kind(i).to_string()], book.into_iter().collect())
    };
    type Facts = (Vec<String>, Vec<String>);
    let tally = |pick: &dyn Fn(&Facts) -> Vec<String>| -> Vec<Value> {
        let mut m: std::collections::BTreeMap<String, usize> = Default::default();
        for i in &items {
            for k in pick(&facts(i)) {
                *m.entry(k).or_insert(0) += 1;
            }
        }
        m.into_iter()
            .map(|(value, count)| json!({"value": value, "count": count}))
            .collect()
    };
    v["kinds"] = json!(tally(&|f| f.0.clone()));
    v["books"] = json!(tally(&|f| f.1.clone()));
    v["total"] = json!(items.len());
    let kept: Vec<Value> = items
        .into_iter()
        .filter(|i| {
            let (k, b) = facts(i);
            filters.iter().all(|f| {
                passes(
                    f,
                    if f.property.eq_ignore_ascii_case("save") {
                        &k
                    } else {
                        &b
                    },
                )
            })
        })
        .collect();
    v["count"] = json!(kept.len());
    v["items"] = json!(kept);
    Ok(v)
}

/// A folder opened, with its saves counted by kind and by book (no filter).
pub fn folder_view(bible: &Bible, store: &Store, name: &str) -> Result<Value> {
    folder_view_filtered(bible, store, name, &[])
}

/// The thread files as folders with their color, for `wb shelf` and the Library's FOLDERS, in name order. Each holds its
/// places (`wb folder show` lists them) and one page, its note.
pub fn thread_folders(store: &Store) -> Vec<Value> {
    let mut v: Vec<Value> = store
        .threads()
        .iter()
        .map(|t| {
            let f = Folder {
                key: crate::threadpage::page_id(&s(t, "id")),
                id: s(t, "id"),
                thread: true,
                name: s(t, "name"),
                color: s(t, "color"),
            };
            let mut j = folder_json(store, &f);
            j["id"] = json!(f.key);
            j["parent"] = json!("");
            j["depth"] = json!(0);
            j["items"] = json!(t["members"].as_array().map(|a| a.len()).unwrap_or(0));
            j["pages"] = json!(1);
            j["folders"] = json!(0);
            j
        })
        .collect();
    v.sort_by_key(|j| j["name"].as_str().unwrap_or("").to_lowercase());
    v
}
