//! Views (W5 of "The Notebook as a workspace", 2026-11-07; sheet W4 of docs/archive/2026-11-10/docs/workspace-design.md): a list kept up to
//! date. In a page's file a view is a fenced block, ```` ```view ````, holding one line of the command language
//! (`notebook @Num 25 questions`, `notebook thread phinehas`, `notebook days 7`); the window lists what the line finds
//! each time the page is drawn. The line is read by `commands::view_line`, the one parser the command field and
//! `wb view run` use too, so all three give the same rows. **Views read; they never write**: nothing here changes a file
//! but `set_line`, which rewrites the fence itself when the person changes its line.
//!
//! What a line finds: the notes, questions and pages (and days' pages, when nothing rules them out) that pass every
//! filter it names. `@place` keeps the notes on any verse of that place (a note on a whole chapter or book counts for
//! each verse in it), or on that Strong's number; they come in Bible order. Otherwise the newest first. Templates are
//! never listed.

use crate::anchors::{self, Kind};
use crate::bible::Bible;
use crate::commands::{view_line, ViewQuery};
use crate::notebook as nb;
use crate::pages::{self, chars, split, sub, Edit};
use crate::store::{bad, Store};
use crate::Result;
use chrono::{Duration, Local};
use serde_json::{json, Value};

/// The verses a place reaches: (book's id, first (chapter, verse), last (chapter, verse)); None for a Strong's number.
fn reach(bible: &Bible, anchor: &str) -> Option<(u32, (u32, u32), (u32, u32))> {
    let a = anchors::parse(anchor).ok()?;
    if a.kind == Kind::Lemma {
        return None;
    }
    let b = bible.book(&a.code).ok()?;
    let c2 = a.c2.unwrap_or(a.c1);
    Some((b.id, (a.c1, a.v1), (c2, a.v2.unwrap_or(a.v1))))
}

/// Every place of an entry: its first, then `also`.
fn places(store: &Store, e: &Value) -> Vec<String> {
    let mut v: Vec<String> = vec![];
    if let Some(a) = e["anchor"].as_str().filter(|a| !a.is_empty()) {
        v.push(a.to_string());
    }
    v.extend(e["also"].as_array().into_iter().flatten().filter_map(|a| a["anchor"].as_str()).map(String::from));
    if e["kind"] == "thread" {
        if let Some(thread) = e["slug"].as_str().and_then(|slug| store.thread(slug).ok()) {
            v.extend(thread["members"].as_array().into_iter().flatten().filter_map(|m| m["anchor"].as_str()).map(String::from));
        }
    }
    v
}

/// A row of a view: what the Notebook's list shows of an entry (its text left out).
fn row(e: &Value) -> Value {
    let mut r = e.clone();
    if let Some(o) = r.as_object_mut() {
        for k in ["text", "refs", "quote"] {
            o.remove(k);
        }
    }
    r
}

/// The notes a line finds (`wb view run`): the line, what it was read as (`query`), how many, and the rows.
pub fn run(bible: &Bible, store: &Store, line: &str) -> Result<Value> {
    let q = view_line(line, bible.books()).map_err(bad)?;
    let rows = find(bible, store, &q)?;
    Ok(json!({"line": line.trim(), "query": q, "count": rows.len(), "rows": rows}))
}

fn find(bible: &Bible, store: &Store, q: &ViewQuery) -> Result<Vec<Value>> {
    let mut all: Vec<Value> = nb::all_lines(bible, store, true).into_iter().filter(|e| !nb::is_template(e)).collect();
    // a question written in a page (R1) is a question a view can list
    if q.questions.is_some() || matches!(q.kind.as_deref(), Some("all" | "question")) {
        all.extend(crate::questions::entries(bible, store));
    }
    if matches!(q.kind.as_deref(), Some("all" | "thread")) {
        all.extend(crate::threadpage::lines(bible, store));
    }
    if let Some(kind) = q.kind.as_deref().filter(|kind| *kind != "all") {
        all.retain(|e| e["kind"] == kind);
    }
    if !q.words.is_empty() {
        all.retain(|e| nb::words_in(e, &q.words));
    }
    if let Some(st) = &q.questions {
        all.retain(|e| e["kind"] == "question" && (st == "all" || (st == "open") == (e["status"] != "done")));
    }
    if q.pages {
        all.retain(|e| e["placed"] == false && e["kind"] != "day" && e["kind"] != "thread");
    }
    if let Some(name) = &q.thread {
        let t = store
            .threads()
            .into_iter()
            .find(|t| crate::store::s(t, "name").eq_ignore_ascii_case(name) || crate::store::s(t, "id") == *name)
            .ok_or_else(|| bad(format!("No thread called “{name}” (wb thread list names them).")))?;
        let id = crate::store::s(t, "id");
        all.retain(|e| e["slug"] == id.as_str() || e["threads"].as_array().into_iter().flatten().any(|x| x["id"] == id.as_str()));
    }
    if let Some(n) = q.days {
        let from = (Local::now().date_naive() - Duration::days(i64::from(n) - 1)).to_string();
        all.retain(|e| e["day"].as_str().is_some_and(|d| !d.is_empty() && d >= from.as_str()));
    }
    let Some(place) = &q.place else {
        all.sort_by(|a, b| b["created"].as_str().cmp(&a["created"].as_str()));
        return Ok(all.iter().map(row).collect());
    };
    // @place: Bible order, by where each note's first place in it begins
    let want = nb::place_anchor(bible, place)?;
    let mut hits: Vec<((u32, u32, u32, u32), Value)> = vec![];
    match reach(bible, &want) {
        None => {
            for e in all {
                if places(store, &e).iter().any(|p| p.eq_ignore_ascii_case(&want)) {
                    hits.push(((0, 0, 0, 0), e));
                }
            }
        }
        Some((book, lo, hi)) => {
            for e in all {
                let at = places(store, &e).iter().filter_map(|p| Some((p.clone(), reach(bible, p)?))).find(|(_, (b, s, t))| *b == book && *s <= hi && *t >= lo);
                if let Some((p, (_, s, _))) = at {
                    let i = anchors::parse(&p).ok().and_then(|a| a.i1).unwrap_or(0);
                    hits.push(((book, s.0, s.1, i), e));
                }
            }
        }
    }
    hits.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1["created"].as_str().cmp(&b.1["created"].as_str())));
    Ok(hits.iter().map(|(_, e)| row(e)).collect())
}

/// A view's fence read whole: the command line, then the options (`view: board`, `group: folder`, `columns: Status, Book`,
/// `sort: edited`), one `key: value` a line, as the fence is written (notebook rows 36 and 47, NB14). Any other line stays as it is.
struct Fence {
    line: String,
    options: Vec<(String, String)>,
    other: Vec<String>,
}

const OPTION_KEYS: [&str; 4] = ["view", "group", "columns", "sort"];

fn read_fence(block: &str) -> Option<Fence> {
    let mut ls = block.lines();
    let first = ls.next()?.trim_start();
    let mark = ["```", "~~~"].into_iter().find(|m| first.starts_with(m))?;
    if !first[3..].trim().split_whitespace().next().is_some_and(|w| w.eq_ignore_ascii_case("view")) {
        return None;
    }
    let mut f = Fence { line: String::new(), options: vec![], other: vec![] };
    let mut got = false;
    for l in ls.take_while(|l| !l.trim_start().starts_with(mark)).map(str::trim).filter(|l| !l.is_empty()) {
        if !got {
            f.line = l.to_string();
            got = true;
            continue;
        }
        match l.split_once(':') {
            Some((k, v)) if OPTION_KEYS.contains(&k.trim().to_lowercase().as_str()) => f.options.push((k.trim().to_lowercase(), v.trim().to_string())),
            _ => f.other.push(l.to_string()),
        }
    }
    Some(f)
}

impl Fence {
    fn opt(&self, k: &str) -> &str {
        self.options.iter().find(|(x, _)| x == k).map(|(_, v)| v.as_str()).unwrap_or("")
    }
    fn set(&mut self, k: &str, v: &str) {
        self.options.retain(|(x, _)| x != k);
        if !v.is_empty() {
            self.options.push((k.to_string(), v.to_string()));
        }
    }
    fn text(&self) -> String {
        let mut opts = String::new();
        for k in OPTION_KEYS {
            for (x, v) in &self.options {
                if x == k {
                    opts.push_str(&format!("{x}: {v}\n"));
                }
            }
        }
        let other: String = self.other.iter().map(|l| format!("{l}\n")).collect();
        format!("```view\n{}\n{opts}{other}```", self.line)
    }
    fn columns(&self) -> Vec<String> {
        self.opt("columns").split(',').map(str::trim).filter(|c| !c.is_empty()).map(String::from).collect()
    }
}

/// A block's Markdown → its view's line, when it is one (```` ```view ````, the line inside; empty when none yet).
pub fn view_fence(block: &str) -> Option<String> {
    read_fence(block).map(|f| f.line)
}

pub const VIEWS: [&str; 4] = ["table", "list", "gallery", "board"];
const SORTS: [&str; 3] = ["edited", "created", "title"];
/// Names a property cannot have: the list's own columns and the special groupings.
const RESERVED: [&str; 7] = ["title", "edited", "created", "folder", "callout", "kind", "id"];

fn check_name(name: &str) -> Result<String> {
    let n = name.trim();
    if n.is_empty() || n.chars().count() > 40 || n.contains([':', ',', '\n', '"', '`']) {
        return Err(bad("A property's name is a few plain words (no colon, comma or quotes)."));
    }
    if RESERVED.contains(&n.to_lowercase().as_str()) {
        return Err(bad(format!("“{n}” is already a column of a list (title, edited, created) or a way to group (folder, callout); name the property something else.")));
    }
    Ok(n.to_string())
}

/// A page's properties (`props` in its front matter): name → text.
fn props_of(store: &Store, id: &str) -> serde_json::Map<String, Value> {
    store.find_note(id).ok().and_then(|n| n.get("props").and_then(|p| p.as_object().cloned())).unwrap_or_default()
}

fn prop_text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        Value::Array(a) => a.iter().map(prop_text).collect::<Vec<_>>().join(", "),
        v => v.to_string(),
    }
}

/// A page's properties as `wb page prop ID` says them.
pub fn page_props(store: &Store, id: &str) -> Result<Value> {
    let (id, _, _) = pages::text_of(store, id)?;
    Ok(json!({"id": id, "props": props_of(store, &id)}))
}

/// Set a page's property (`wb page prop ID NAME VALUE`), or take it away (`value` None): a column of a List in a page is a property kept in
/// each page's front matter, one `props:` line, a map of name → text. Moving or placing the page keeps it. → `{id, props}`.
pub fn set_prop(store: &mut Store, id: &str, name: &str, value: Option<&str>) -> Result<Value> {
    let name = check_name(name)?;
    let (id, _, _) = pages::text_of(store, id)?;
    let mut props = props_of(store, &id);
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        Some(v) => {
            if v.contains('\n') {
                return Err(bad("A property's value is one line."));
            }
            props.insert(name, json!(v));
        }
        None => {
            props.remove(&name);
        }
    }
    let put = if props.is_empty() { None } else { Some(Value::Object(props.clone())) };
    store.set_fields(&id, &[("props", put)])?;
    Ok(json!({"id": id, "props": props}))
}

fn folder_of(e: &Value) -> Value {
    e["threads"].as_array().into_iter().flatten().next().map(|t| json!({"id": t["id"], "name": t["name"], "color": t["color"]})).unwrap_or(Value::Null)
}

/// The rows of a view as a List in a page shows them: each page with its properties, its folder (the first it is in) and when it was
/// edited, sorted as the view says.
fn list_rows(store: &Store, rows: &[Value], sort: &str) -> Vec<Value> {
    let mut out: Vec<Value> = rows
        .iter()
        .filter(|r| r["kind"] != "thread")
        .map(|r| {
            let mut r = r.clone();
            r["props"] = Value::Object(props_of(store, r["id"].as_str().unwrap_or("")));
            r["folder"] = folder_of(&r);
            r["edited"] = r["updated"].clone();
            r
        })
        .collect();
    match sort {
        "edited" => out.sort_by(|a, b| b["updated"].as_str().cmp(&a["updated"].as_str())),
        "created" => out.sort_by(|a, b| b["created"].as_str().cmp(&a["created"].as_str())),
        "title" => out.sort_by_key(|r| r["title"].as_str().unwrap_or("").to_lowercase()),
        _ => {}
    }
    out
}

fn group_by(rows: Vec<Value>, key: impl Fn(&Value) -> (String, String, Value)) -> Vec<Value> {
    let mut groups: Vec<(String, String, Value, Vec<Value>)> = vec![];
    for r in rows {
        let (k, label, color) = key(&r);
        match groups.iter_mut().find(|g| g.0 == k) {
            Some(g) => g.3.push(r),
            None => groups.push((k, label, color, vec![r])),
        }
    }
    // by name; the rows that have none last
    groups.sort_by(|a, b| a.0.is_empty().cmp(&b.0.is_empty()).then_with(|| a.1.to_lowercase().cmp(&b.1.to_lowercase())));
    groups.into_iter().map(|(k, label, color, rows)| json!({"key": k, "label": label, "color": color, "count": rows.len(), "rows": rows})).collect()
}

/// A page's views with what each finds now (`wb page views`), as the window draws them: each block's number (from 1, as
/// `wb page blocks` counts), its line, its options (`view`, `group`, `columns`, `sort`) and its rows; a line that cannot be read, or
/// holds a blank of a template (`{place}`), says so instead. The rows are pages, each with its `props`, `folder` and `edited`;
/// `properties` names every property the pages hold (and the columns asked for); with `group` there are `groups` of rows, each with its
/// key, label, color and count. Grouped by `callout` the rows are the callouts of those pages, in their kinds' order.
pub fn page_views(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = pages::text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(f) = read_fence(&sub(&c, b.start, b.end)) else { continue };
        let line = f.line.clone();
        let (view, group, sort) = (f.opt("view").to_lowercase(), f.opt("group").to_string(), f.opt("sort").to_lowercase());
        let view = if view.is_empty() { "table".to_string() } else { view };
        // a board is a column for each group: with none chosen, each folder
        let group = if group.is_empty() && view == "board" { "folder".to_string() } else { group };
        let mut v = json!({"n": i + 1, "line": line, "view": view, "group": group, "columns": f.columns(), "sort": sort});
        if line.is_empty() {
            v["error"] = json!("No line yet: write one, like notebook @Num 25 questions.");
        } else if ["{place}", "{date}", "{title}", "{reader}"].iter().any(|k| line.contains(k)) {
            v["blank"] = json!(true);
            v["error"] = json!("A template's blank: filled when a page is made from it.");
        } else {
            match run(bible, store, &line) {
                Ok(r) => {
                    v["query"] = r["query"].clone();
                    let all: Vec<Value> = r["rows"].as_array().cloned().unwrap_or_default();
                    let rows = list_rows(store, &all, &sort);
                    let mut names: Vec<String> = vec![];
                    for r in &rows {
                        for k in r["props"].as_object().into_iter().flat_map(|m| m.keys()) {
                            if !names.contains(k) {
                                names.push(k.clone());
                            }
                        }
                    }
                    for k in f.columns() {
                        if !names.contains(&k) {
                            names.push(k);
                        }
                    }
                    names.sort_by_key(|n| n.to_lowercase());
                    v["properties"] = json!(names);
                    if let Some(name) = r["query"]["thread"].as_str() {
                        let hit = store.threads().into_iter().find(|t| crate::store::s(t, "name").eq_ignore_ascii_case(name) || crate::store::s(t, "id") == name);
                        if let Some(t) = hit {
                            v["folder"] = json!({"id": crate::store::s(t, "id"), "name": crate::store::s(t, "name"), "color": crate::store::s(t, "color")});
                        }
                    }
                    let (shown, groups) = match group.to_lowercase().as_str() {
                        "" | "none" => (rows, None),
                        "folder" => {
                            let g = group_by(rows.clone(), |r| match r["folder"]["id"].as_str() {
                                Some(k) => (k.to_string(), r["folder"]["name"].as_str().unwrap_or("").to_string(), r["folder"]["color"].clone()),
                                None => (String::new(), "Pages".to_string(), Value::Null),
                            });
                            (rows, Some(g))
                        }
                        "callout" => {
                            let ids: Vec<&str> = rows.iter().filter_map(|r| r["id"].as_str()).collect();
                            let cs: Vec<Value> = crate::questions::callouts(store, None, None)?["callouts"]
                                .as_array()
                                .cloned()
                                .unwrap_or_default()
                                .into_iter()
                                .filter(|c| c["page"].as_str().is_some_and(|p| ids.contains(&p)))
                                .collect();
                            let rank = |k: &str| crate::questions::CALLOUT_KINDS.iter().position(|(w, _)| *w == k).unwrap_or(9);
                            let mut g = group_by(cs, |c| (c["kind"].as_str().unwrap_or("").to_string(), c["label"].as_str().unwrap_or("").to_string(), Value::Null));
                            g.sort_by_key(|x| rank(x["key"].as_str().unwrap_or("")));
                            let flat: Vec<Value> = g.iter().flat_map(|x| x["rows"].as_array().cloned().unwrap_or_default()).collect();
                            v["rows_are"] = json!("callouts");
                            (flat, Some(g))
                        }
                        name => {
                            let name = name.to_string();
                            let g = group_by(rows.clone(), |r| {
                                let val = r["props"].as_object().and_then(|m| m.iter().find(|(k, _)| k.to_lowercase() == name)).map(|(_, x)| prop_text(x)).unwrap_or_default();
                                let label = if val.is_empty() { format!("No {group}") } else { val.clone() };
                                (val, label, Value::Null)
                            });
                            (rows, Some(g))
                        }
                    };
                    v["count"] = json!(shown.len());
                    v["rows"] = json!(shown);
                    if let Some(g) = groups {
                        v["groups"] = json!(g);
                    }
                }
                Err(e) => v["error"] = json!(e.0),
            }
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}

/// Change a view (block `n`, from 0): its line (`line`, read first, so one that cannot be read is not written) and its options. An option
/// given as `Some("")` is taken away. The fence is written anew; a line the fence holds that this does not know stays. → the page's
/// blocks, as `pages::edit`.
pub fn set_view(bible: &Bible, store: &mut Store, id: &str, n: usize, line: Option<&str>, options: &[(&str, Option<&str>)]) -> Result<Value> {
    let (_, text, titled) = pages::text_of(store, id)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs.get(n).ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let mut f = read_fence(&sub(&c, b.start, b.end)).ok_or_else(|| bad(format!("Block {} is not a view.", n + 1)))?;
    if let Some(line) = line {
        let line = line.trim();
        if line.contains('\n') {
            return Err(bad("A view's line is one line."));
        }
        if !line.contains('{') {
            view_line(line, bible.books()).map_err(bad)?;
        }
        f.line = line.to_string();
    }
    for (k, v) in options {
        let Some(v) = v else { continue };
        let v = v.trim();
        let value = match *k {
            "view" if v.is_empty() => String::new(),
            "view" => match v.to_lowercase().as_str() {
                x if VIEWS.contains(&x) => x.to_string(),
                "calendar" | "timeline" => return Err(bad("Calendar and Timeline come later: a view is table, list, gallery or board.")),
                _ => return Err(bad("A view is table, list, gallery or board.")),
            },
            "group" => match v.to_lowercase().as_str() {
                "" | "none" => String::new(),
                "folder" | "callout" => v.to_lowercase(),
                _ => check_name(v)?,
            },
            "sort" if v.is_empty() => String::new(),
            "sort" => match v.to_lowercase().as_str() {
                x if SORTS.contains(&x) => x.to_string(),
                _ => return Err(bad("Sort by edited, created or title.")),
            },
            "columns" if v.is_empty() => String::new(),
            "columns" => v.split(',').map(check_name).collect::<Result<Vec<_>>>()?.join(", "),
            _ => return Err(bad("An option is view, group, columns or sort.")),
        };
        f.set(k, &value);
    }
    pages::edit(bible, store, id, Edit::Set { n, count: 1, text: &f.text() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_view_fence_holds_a_line() {
        assert_eq!(view_fence("```view\nnotebook @Num 25 questions\n```").as_deref(), Some("notebook @Num 25 questions"));
        assert_eq!(view_fence("```view\n\n```").as_deref(), Some(""));
        assert_eq!(view_fence("~~~ view\n  notebook days 7  \n~~~").as_deref(), Some("notebook days 7"));
        assert!(view_fence("```scripture\nNum 25\n```").is_none());
        assert!(view_fence("notebook days 7").is_none());
    }
}
