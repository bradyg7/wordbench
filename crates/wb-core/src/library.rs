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
        Some((h, r))
            if ["page", "search", "document", "sitting", "thread"]
                .contains(&h.to_lowercase().as_str()) =>
        {
            (h.to_lowercase(), r.trim())
        }
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
        "document" => Ok(
            json!({"kind": "document", "ref": crate::shelf::document_id(store, rest.trim_matches('"'))?}),
        ),
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
        if let Some(i) = t["items"].as_array().and_then(|a| {
            a.iter()
                .find(|i| i.as_object().is_some_and(|o| Store::same_item(item, o)))
        }) {
            folders.push((s(&t, "id"), s(&t, "name"), s_of(i, "key")));
        }
    }
    let shelf = store
        .shelf_saves()
        .iter()
        .find(|i| i.as_object().is_some_and(|o| Store::same_item(item, o)))
        .map(|i| s_of(i, "key"));
    (folders, shelf)
}

fn s_of(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// Where a thing is saved now: `{"thing", "item", "saved", "folders": [{id, name, key}], "shelf"}`.
pub fn where_saved(bible: &Bible, store: &Store, thing: &str) -> Result<Value> {
    let item = item_of(bible, store, thing)?;
    let (folders, shelf) = find_in(store, &item);
    Ok(
        json!({"thing": thing.trim(), "item": item, "saved": !folders.is_empty() || shelf.is_some(),
        "folders": folders.iter().map(|(id, name, key)| json!({"id": id, "name": name, "key": key})).collect::<Vec<_>>(),
        "shelf": shelf.is_some()}),
    )
}

/// Save a thing (K): in each folder named (an id or a name, as `wb set show` finds one), or on the Shelf when none is
/// named. A thing already in a folder and saved with no folder stays where it is. → `where_saved`'s answer.
pub fn save(bible: &Bible, store: &mut Store, thing: &str, folders: &[String]) -> Result<Value> {
    let item = item_of(bible, store, thing)?;
    let ids: Vec<String> = folders
        .iter()
        .map(|f| store.find_set(f).map(|t| s(&t, "id")))
        .collect::<Result<_>>()?;
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
pub fn unsave(
    bible: &Bible,
    store: &mut Store,
    thing: &str,
    folder: Option<&str>,
) -> Result<Value> {
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
    fn walk(
        store: &Store,
        par: &std::collections::HashMap<String, String>,
        of: &str,
        depth: usize,
        out: &mut Vec<Value>,
    ) {
        for t in crate::shelf::children_of(store, par, of) {
            let id = s(&t, "id");
            let kids = crate::shelf::children_of(store, par, &id).len();
            out.push(json!({"id": id, "name": t["name"], "parent": of, "depth": depth, "items": t["items"].as_array().map(|a| a.len()).unwrap_or(0), "folders": kids,
                "kind": "folder", "color": s(&t, "color"), "shown": !s(&t, "color").is_empty() && !crate::folders::hidden_keys(store).contains(&id)}));
            walk(store, par, &id, depth + 1, out);
        }
    }
    walk(store, &tree, "", 0, &mut out);
    // a thread file is a folder with a color (TH-1): at the top, after the folders, read where it is
    out.extend(crate::folders::thread_folders(store));
    json!(out)
}

/// Items a folder or the Shelf holds whose thing is gone (a page file deleted by hand, a removed document): each
/// `{folder, key, kind, ref}`. Nothing is shown broken and nothing is removed; `wb study check` reports them (L-22).
pub fn dangling(bible: &Bible, store: &Store) -> Result<Vec<Value>> {
    let docs: Vec<String> = crate::docs::records(store)
        .iter()
        .map(|d| s(d, "id"))
        .collect();
    let mut out = vec![];
    let mut check = |folder: &str, view: &Value| {
        for i in view["items"].as_array().cloned().unwrap_or_default() {
            let gone =
                i["gone"] == true || (i["kind"] == "document" && !docs.contains(&s_of(&i, "ref")));
            if gone {
                out.push(
                    json!({"folder": folder, "key": i["key"], "kind": i["kind"], "ref": i["ref"]}),
                );
            }
        }
    };
    for t in store.sets() {
        check(
            &s(&t, "name"),
            &crate::studyapi::set_view(bible, store, &t)?,
        );
    }
    check("Shelf", &shelf_view(bible, store)?);
    Ok(out)
}

/// A place's words without asking the database: "Numbers 25:11", "Numbers 25:10–13" (the anchor's own book and numbers).
fn anchor_label(bible: &Bible, anchor: &str) -> String {
    let Ok(a) = crate::anchors::parse(anchor) else {
        return anchor.to_string();
    };
    if a.strong.is_some() {
        return anchor.to_string();
    }
    let name = bible
        .books()
        .iter()
        .find(|b| b.code == a.code)
        .map(|b| b.name.clone())
        .unwrap_or_else(|| a.code.clone());
    crate::anchors::py_label(
        &name,
        a.c1 as i64,
        a.v1 as i64,
        a.c2.unwrap_or(a.c1) as i64,
        a.v2.unwrap_or(a.v1) as i64,
        a.c2.is_some(),
    )
}

/// What a saved item is called in the search: a page by its title, a place by its words, anything else by what it names.
fn cheap_label(
    bible: &Bible,
    titles: &std::collections::HashMap<String, String>,
    i: &Value,
) -> String {
    let r = s_of(i, "ref");
    match s_of(i, "kind").as_str() {
        "note" => titles.get(&r).cloned().unwrap_or(r),
        "place" => anchor_label(bible, &r),
        _ => r,
    }
}

// ---- the one search (S21) and the filter line (S27) ----------------------------------------------------------------------

/// What `wb find` asks when it is given more than words. `kind`: "" (all), page, folder, save, question or highlight.
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
    /// Marks only (`kind` = "mark", row 51): a legend entry or `kind:color[:lines]`, a mark kind, a color, a book, and the
    /// days a mark was made between (`7d` or a date).
    pub style: Option<&'a str>,
    pub mark_kind: Option<&'a str>,
    pub color: Option<&'a str>,
    pub book: Option<&'a str>,
    pub since: Option<&'a str>,
    pub until: Option<&'a str>,
    /// Filters on the lists of margin notes, highlights and marks (filters-v2 rows 26-27, `--filter`): Book, Written, Edited, Folder,
    /// Kind (a mark's kind) and Legend entry, each only where the list has it.
    pub filters: Vec<crate::filters::Filter>,
}

/// The folders (sets and folders with a color) a page is in.
fn folders_of_page(store: &Store, id: &str) -> Vec<String> {
    let mut v: Vec<String> = vec![];
    for t in store.sets() {
        if t["items"].as_array().is_some_and(|a| {
            a.iter()
                .any(|i| s_of(i, "kind") == "note" && s_of(i, "ref") == id)
        }) {
            v.push(s(&t, "name"));
        }
    }
    if let Some(r) = store
        .notes()
        .into_iter()
        .chain(store.on_thread())
        .find(|r| s(r, "id") == id)
    {
        for tid in crate::store::threads_of(r) {
            if let Some(t) = store.threads().into_iter().find(|t| s(t, "id") == tid) {
                v.push(s(t, "name"));
            }
        }
    }
    v.dedup();
    v
}

fn cap(w: &str) -> String {
    let mut c = w.chars();
    c.next()
        .map(|f| f.to_uppercase().collect::<String>() + c.as_str())
        .unwrap_or_default()
}

fn since(text: &str, flag: &str) -> Result<String> {
    let t = text.trim();
    if let Some(n) = t.strip_suffix('d').and_then(|n| n.parse::<i64>().ok()) {
        return Ok((chrono::Utc::now() - chrono::Duration::days(n))
            .format("%Y-%m-%d")
            .to_string());
    }
    if crate::store::is_day(t) {
        return Ok(t.to_string());
    }
    Err(bad(format!(
        "{flag} takes a number of days (7d) or a date (2026-11-01)."
    )))
}

/// Pages, folders, saves and questions in one list, grouped by kind: `{q, count, total, groups: [{kind, count, results}]}`.
/// `total` is how many there were before the words and filters, for "23 of 412". Highlights are a group too.
/// What a page holds besides paragraphs, for the one search's second line (notebook row 34): "a table", "callouts" or "a list"; "" for plain text.
fn shape_of(text: &str) -> &'static str {
    let lines: Vec<&str> = text.lines().map(str::trim_start).collect();
    if lines
        .windows(2)
        .any(|w| w[0].starts_with('|') && w[1].starts_with('|') && w[1].contains("---"))
    {
        "a table"
    } else if lines.iter().any(|l| l.starts_with("> [!")) {
        "callouts"
    } else if lines.iter().any(|l| {
        l.starts_with("- ")
            || l.starts_with("* ")
            || l.chars().next().is_some_and(|c| c.is_ascii_digit())
                && l.split_once(". ")
                    .is_some_and(|(n, _)| n.chars().all(|c| c.is_ascii_digit()))
    }) {
        "a list"
    } else {
        ""
    }
}

pub fn find(bible: &Bible, store: &Store, f: &Find<'_>) -> Result<Value> {
    if ![
        "",
        "page",
        "folder",
        "save",
        "question",
        "key",
        "note",
        "margin",
        "highlight",
        "mark",
    ]
    .contains(&f.kind)
    {
        return Err(bad(
            "--kind is page, folder, save, question, key, note, margin, highlight or mark.",
        ));
    }
    let marks_only = f.style.is_some()
        || f.mark_kind.is_some()
        || f.color.is_some()
        || f.book.is_some()
        || f.since.is_some()
        || f.until.is_some();
    if marks_only && f.kind != "mark" {
        return Err(bad("--style, --mark-kind, --color, --book, --since and --until find marks: add --kind mark."));
    }
    if !["", "edited", "title"].contains(&f.sort) {
        return Err(bad("--sort is edited or title."));
    }
    let words: Vec<String> = f
        .words
        .to_lowercase()
        .split_whitespace()
        .map(String::from)
        .collect();
    let has = |blob: &str| {
        words
            .iter()
            .all(|w| blob.to_lowercase().contains(w.as_str()))
    };
    let cutoff = f.edited.map(|e| since(e, "--edited")).transpose()?;
    let want = |k: &str| f.kind.is_empty() || f.kind == k;
    // a folder is a set folder or a thread file (a folder with a color); the thread's saves are its places, its pages those written on it
    let thread_folder: Option<Rec> = f.folder.and_then(|name| {
        let n = name.trim().to_lowercase();
        store
            .threads()
            .into_iter()
            .find(|t| s(t, "name").to_lowercase() == n || s(t, "id") == n)
            .cloned()
    });
    let in_folder: Option<Vec<(String, String)>> = match (f.folder, &thread_folder) {
        (_, Some(t)) => {
            let id = s(t, "id");
            Some(
                store
                    .notes()
                    .into_iter()
                    .chain(store.on_thread())
                    .filter(|r| crate::store::threads_of(r).contains(&id))
                    .map(|r| ("note".to_string(), s(r, "id")))
                    .collect(),
            )
        }
        (Some(name), None) => {
            let t = store.find_set(name)?;
            Some(
                t["items"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default()
                    .iter()
                    .map(|i| (s_of(i, "kind"), s_of(i, "ref")))
                    .collect(),
            )
        }
        (None, None) => None,
    };
    let folder_id = match (&thread_folder, f.folder) {
        (Some(t), _) => Some(s(t, "id")),
        (None, Some(n)) => Some(store.find_set(n).map(|t| s(&t, "id"))?),
        (None, None) => None,
    };
    let clock = std::time::Instant::now();
    let lap = |what: &str| {
        if std::env::var("WB_FIND_TIMES").is_ok() {
            eprintln!("find {what}: {:?}", clock.elapsed());
        }
    };
    let mut groups = vec![];
    let mut out_groups: Vec<(String, Vec<Value>)> = vec![];
    let mut all_total = 0usize;
    lap("before page");
    if want("page") {
        let (pages, total) = crate::notebook::find_lines(bible, store, &words);
        all_total += total;
        let rows = pages
            .into_iter()
            .filter(|e| crate::notebook::words_in(e, &words))
            .filter(|e| !f.has_question || e["text"].as_str().unwrap_or("").contains("[!question]"))
            .filter(|e| cutoff.as_ref().is_none_or(|c| e["updated"].as_str().unwrap_or("") >= c.as_str()))
            .filter(|e| in_folder.as_ref().is_none_or(|l| l.iter().any(|(k, r)| k == "note" && r == e["id"].as_str().unwrap_or(""))))
            .map(|e| json!({"kind": "page", "id": e["id"], "title": e["title"], "snippet": e["preview"], "updated": e["updated"],
                "folder": e["threads"][0]["name"], "has": shape_of(e["text"].as_str().unwrap_or(""))}))
            .collect();
        out_groups.push(("page".into(), rows));
    }
    lap("before folder");
    if want("folder") && in_folder.is_none() && !f.has_question && cutoff.is_none() {
        // a folder is a set folder or a thread file (a folder with a color); each shows its color and how many pages and saves it holds
        // (notebook row 34d): the pages written in it plus its saves
        let on: Vec<Vec<String>> = store
            .notes()
            .into_iter()
            .chain(store.on_thread())
            .map(crate::store::threads_of)
            .collect();
        let sets = store.sets();
        let threads = store.threads();
        all_total += sets.len() + threads.len();
        let mut rows: Vec<Value> = vec![];
        for t in &sets {
            if !has(&s(t, "name")) {
                continue;
            }
            let items = t["items"].as_array().cloned().unwrap_or_default();
            let pages = items.iter().filter(|i| s_of(i, "kind") == "note").count();
            let saves = items.len() - pages;
            rows.push(json!({"kind": "folder", "id": t["id"], "title": t["name"], "color": s(t, "color"), "pages": pages, "saves": saves, "count": pages + saves, "updated": t["updated"]}));
        }
        for t in &threads {
            if !has(&s(t, "name")) {
                continue;
            }
            let id = s(t, "id");
            let pages = on.iter().filter(|l| l.contains(&id)).count();
            let saves = t["members"].as_array().map(|a| a.len()).unwrap_or(0);
            rows.push(json!({"kind": "folder", "id": crate::threadpage::page_id(&id), "title": t["name"], "color": s(t, "color"), "pages": pages, "saves": saves, "count": pages + saves, "updated": t["updated"]}));
        }
        out_groups.push(("folder".into(), rows));
    }
    lap("before save");
    if want("save") && !f.has_question {
        let mut rows = vec![];
        // the saves as the search lists them: labelled from what the item names, never resolved one by one (a folder of
        // thousands of pages must not make a search slow, marks M40)
        let titles: std::collections::HashMap<String, String> = store
            .notes()
            .into_iter()
            .chain(store.inbox())
            .chain(store.on_thread())
            .map(|r| (s(r, "id"), crate::notebook::page_title(r)))
            .collect();
        let mut every = 0usize;
        let mut take = |folder: &str, i: &Value| {
            every += 1;
            let label = cheap_label(bible, &titles, i);
            if cutoff.is_none() && has(&format!("{label} {}", s_of(i, "ref"))) {
                rows.push(json!({"kind": "save", "id": i["key"], "title": label, "type": i["kind"], "ref": i["ref"], "folder": folder, "updated": ""}));
            }
        };
        for t in store.sets() {
            if folder_id.as_ref().is_some_and(|id| *id != s(&t, "id")) {
                continue;
            }
            let name = s(&t, "name");
            for i in t["items"].as_array().into_iter().flatten() {
                take(&name, i);
            }
        }
        if let Some(t) = &thread_folder {
            let name = s(t, "name");
            for m in t["members"].as_array().into_iter().flatten() {
                take(
                    &name,
                    &json!({"key": m["anchor"], "kind": "place", "ref": m["anchor"]}),
                );
            }
        }
        if in_folder.is_none() {
            for i in store.shelf_saves() {
                take("", &i);
            }
        }
        all_total += every;
        out_groups.push(("save".into(), rows));
    }
    lap("before question");
    if want("question") {
        let qs = crate::questions::entries(bible, store);
        all_total += qs.len();
        let rows = qs
            .into_iter()
            .filter(|e| has(&format!("{} {}", e["title"].as_str().unwrap_or(""), e["text"].as_str().unwrap_or(""))))
            .filter(|_e| cutoff.is_none() && in_folder.is_none())
            .map(|e| json!({"kind": "question", "id": e["id"], "title": e["title"], "snippet": e["text"], "updated": e["updated"]}))
            .collect();
        out_groups.push(("question".into(), rows));
    }
    lap("before callouts");
    // Key points and Notes (notebook row 46c): the callouts that are not questions, grouped as Key points and Notes, each with its page.
    // They are in the one search only when it is given words (a search with none lists pages, folders and saves as before).
    for (kind, name) in [("key", "Key point"), ("note", "Note")] {
        if !(f.kind == kind || f.kind.is_empty() && !words.is_empty())
            || in_folder.is_some()
            || f.has_question
            || cutoff.is_some()
        {
            continue;
        }
        let all = crate::questions::callouts(store, Some(kind), None)?;
        let rows: Vec<Value> = all["callouts"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|c| has(&format!("{name} {} {}", s_of(c, "text"), s_of(c, "page_title"))))
            .map(|c| json!({"kind": kind, "id": c["id"], "title": c["first"], "snippet": c["page_title"], "page": c["page"], "updated": c["updated"]}))
            .collect();
        all_total += all["callouts"].as_array().map(|a| a.len()).unwrap_or(0);
        if !rows.is_empty() || f.kind == kind {
            out_groups.push((kind.into(), rows));
        }
    }
    lap("before margin");
    if want("margin") {
        let (rows, n) = crate::margin::rows(bible, store, |label, text, written| {
            in_folder.is_none()
                && has(&format!("{label} {text}"))
                && (!f.has_question || crate::questions::question_of(text).is_some())
                && cutoff.as_ref().is_none_or(|c| written >= c.as_str())
        });
        all_total += n;
        out_groups.push(("margin".into(), rows));
    }
    lap("before mark");
    // marks (row 51): the one scanner `legend_uses` uses, then the words, if any; a mark's `updated` is the day it was made
    if f.kind == "mark" {
        let (sn, un) = (
            f.since.map(|d| since(d, "--since")).transpose()?,
            f.until.map(|d| since(d, "--until")).transpose()?,
        );
        let found = crate::marks::find_marks(
            bible,
            store,
            &crate::marks::MarkFilter {
                style: f.style,
                kind: f.mark_kind,
                color: f.color,
                book: f.book,
                since: sn.as_deref(),
                until: un.as_deref(),
            },
        )?;
        let every = crate::marks::find_marks(bible, store, &Default::default())?["count"]
            .as_u64()
            .unwrap_or(0) as usize;
        all_total += every;
        let rows = found["marks"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|m| !f.has_question && in_folder.is_none() && has(&format!("{} {} {} {}", s_of(m, "label"), s_of(m, "words"), s_of(m, "legend"), s_of(m, "kind"))))
            .filter(|m| cutoff.as_ref().is_none_or(|c| s_of(m, "created").as_str() >= c.as_str()))
            .map(|m| {
                let mut r = json!({"kind": "mark", "id": m["id"], "title": m["label"], "snippet": m["words"], "mark_kind": m["kind"], "color": m["color"],
                    "legend": m["legend"], "style": m["style"], "at": m["at"], "book": m["book"], "code": m["code"], "chapter": m["chapter"], "verse": m["verse"],
                    "old": m["old"], "updated": m["created"]});
                for k in ["lines", "to"] {
                    if !m[k].is_null() {
                        r[k] = m[k].clone();
                    }
                }
                r
            })
            .collect();
        out_groups.push(("mark".into(), rows));
    }
    lap("before highlight");
    if want("highlight") {
        let mut rows: Vec<Value> = vec![];
        let mut every = 0usize;
        // labels are worked out once per place and kept (18,000 highlights make one search, not 18,000 lookups)
        static LABELS: std::sync::Mutex<
            Option<std::collections::HashMap<String, (String, String)>>,
        > = std::sync::Mutex::new(None);
        let mut cache = LABELS.lock().unwrap_or_else(|e| e.into_inner());
        let cache = cache.get_or_insert_with(Default::default);
        store.each_highlight(|h| {
            every += 1;
            if f.has_question || in_folder.is_some() {
                return;
            }
            let anchor = s(h, "anchor");
            if !cache.contains_key(&anchor) {
                let label = anchor_label(bible, &anchor);
                cache.insert(anchor.clone(), (label.to_lowercase(), label));
            }
            let (lower, label) = &cache[&anchor];
            let (quote, color) = (s(h, "quote").to_lowercase(), s(h, "color").to_lowercase());
            if words.iter().all(|w| lower.contains(w.as_str()) || quote.contains(w.as_str()) || color.contains(w.as_str()))
                && cutoff.as_ref().is_none_or(|c| s(h, "created").as_str() >= c.as_str())
            {
                let at = crate::anchors::parse(&anchor).ok();
                rows.push(json!({"kind": "highlight", "id": h["id"], "title": label, "snippet": s(h, "quote"), "color": h["color"], "updated": s(h, "created"),
                    "code": at.as_ref().map(|a| a.code.clone()).unwrap_or_default(), "chapter": at.as_ref().map(|a| a.c1).unwrap_or(0)}));
            }
        });
        all_total += every;
        out_groups.push(("highlight".into(), rows));
    }
    lap("after groups");
    // the lists of rows 26 and 27 narrowed by their chips: each offers only the properties it has
    let mut menu: Option<Vec<Value>> = None;
    let mut before = 0usize;
    if matches!(f.kind, "margin" | "highlight" | "mark") {
        let book_names: Vec<String> = bible.books().iter().map(|b| b.name.clone()).collect();
        let book_of = |code: &str| {
            bible
                .books()
                .iter()
                .find(|b| b.code == code)
                .map(|b| b.name.clone())
                .unwrap_or_default()
        };
        let legend_names: std::collections::HashMap<String, String> = crate::marks::legend(store)
            ["entries"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|e| (s_of(e, "style"), s_of(e, "label")))
            .collect();
        let dates = |r: &Value, key: &str| {
            vec![s_of(r, key)]
                .into_iter()
                .filter(|x| !x.is_empty())
                .collect::<Vec<_>>()
        };
        for (kind, rows) in out_groups.iter_mut() {
            if kind != f.kind {
                continue;
            }
            let taken = std::mem::take(rows);
            before = taken.len();
            let (props, facts): (
                Vec<crate::filters::Prop>,
                Box<dyn Fn(&Value) -> crate::filters::Facts>,
            ) = match kind.as_str() {
                "margin" => (
                    vec![
                        crate::filters::Prop {
                            name: "Book",
                            hint: "The book (and chapter) the note is in",
                        },
                        crate::filters::Prop {
                            name: "Written",
                            hint: "When the note was first written",
                        },
                        crate::filters::Prop {
                            name: "Edited",
                            hint: "When the note was last changed",
                        },
                        crate::filters::Prop {
                            name: "Folder",
                            hint: "The folders of the pages the note grew into",
                        },
                    ],
                    Box::new(|r: &Value| {
                        let mut m = crate::filters::Facts::new();
                        m.insert(
                            "book".into(),
                            crate::filters::book_facts(
                                &book_of(&s_of(r, "code")),
                                r["chapter"].as_u64().unwrap_or(0) as u32,
                            ),
                        );
                        m.insert("written".into(), dates(r, "created"));
                        m.insert("edited".into(), dates(r, "updated"));
                        let mut fo: Vec<String> = r["grew"]
                            .as_array()
                            .into_iter()
                            .flatten()
                            .filter_map(Value::as_str)
                            .flat_map(|id| folders_of_page(store, id))
                            .collect();
                        fo.sort();
                        fo.dedup();
                        m.insert("folder".into(), fo);
                        m
                    }),
                ),
                _ => (
                    vec![
                        crate::filters::Prop {
                            name: "Kind",
                            hint: "Highlight, underline, circle, box or arrow",
                        },
                        crate::filters::Prop {
                            name: "Legend entry",
                            hint: "The Legend entry whose style the mark has",
                        },
                        crate::filters::Prop {
                            name: "Book",
                            hint: "The book (and chapter) the mark is in",
                        },
                        crate::filters::Prop {
                            name: "Written",
                            hint: "The day the mark was made",
                        },
                    ],
                    Box::new(|r: &Value| {
                        let mut m = crate::filters::Facts::new();
                        let is_mark = s_of(r, "kind") == "mark";
                        m.insert(
                            "kind".into(),
                            vec![if is_mark {
                                cap(&s_of(r, "mark_kind"))
                            } else {
                                "Highlight".to_string()
                            }],
                        );
                        let legend = if is_mark {
                            s_of(r, "legend")
                        } else {
                            legend_names
                                .get(&format!("highlight:{}", s_of(r, "color").to_lowercase()))
                                .cloned()
                                .unwrap_or_else(|| {
                                    format!("Unnamed {} highlight", s_of(r, "color"))
                                })
                        };
                        m.insert("legend entry".into(), vec![legend]);
                        m.insert(
                            "book".into(),
                            crate::filters::book_facts(
                                &book_of(&s_of(r, "code")),
                                r["chapter"].as_u64().unwrap_or(0) as u32,
                            ),
                        );
                        m.insert("written".into(), dates(r, "updated"));
                        m
                    }),
                ),
            };
            let (kept, m) =
                crate::filters::narrow(taken, &*facts, &props, &f.filters, &book_names)?;
            *rows = kept;
            menu = Some(m);
        }
    }
    let mut count = 0;
    for (kind, mut rows) in out_groups {
        if kind == "mark" && f.sort.is_empty() {
            // marks keep Bible order
        } else if f.sort == "title" {
            rows.sort_by_key(|r| r["title"].as_str().unwrap_or("").to_lowercase());
        } else {
            rows.sort_by(|a, b| {
                b["updated"]
                    .as_str()
                    .unwrap_or("")
                    .cmp(a["updated"].as_str().unwrap_or(""))
            });
        }
        count += rows.len();
        groups.push(json!({"kind": kind, "count": rows.len(), "results": rows}));
    }
    let mut answer =
        json!({"q": f.words.trim(), "count": count, "total": all_total, "groups": groups});
    if let Some(m) = menu {
        crate::filters::attach(&mut answer, m, &f.filters, before);
    }
    Ok(answer)
}
