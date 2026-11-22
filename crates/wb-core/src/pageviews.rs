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
use crate::filters::{self, Facts, Filter, Way};
use crate::notebook as nb;
use crate::pages::{self, chars, split, sub, Edit};
use crate::store::{bad, Store};
use crate::Result;
use chrono::{Duration, Local};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};

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
    /// `type: Speaker choice`, one line per typed property (name, kind).
    types: Vec<(String, String)>,
    /// `filter: Status is Open`, one line per filter (its words), in the order written.
    filters: Vec<String>,
    other: Vec<String>,
}

/// The kinds a property can be: Text, Choice, Date (YYYY-MM-DD), Yes/no (true or false).
pub const TYPES: [&str; 4] = ["text", "choice", "date", "yesno"];

const OPTION_KEYS: [&str; 4] = ["view", "group", "columns", "sort"];

fn read_fence(block: &str) -> Option<Fence> {
    let mut ls = block.lines();
    let first = ls.next()?.trim_start();
    let mark = ["```", "~~~"].into_iter().find(|m| first.starts_with(m))?;
    if !first[3..].trim().split_whitespace().next().is_some_and(|w| w.eq_ignore_ascii_case("view")) {
        return None;
    }
    let mut f = Fence { line: String::new(), options: vec![], types: vec![], filters: vec![], other: vec![] };
    let mut got = false;
    for l in ls.take_while(|l| !l.trim_start().starts_with(mark)).map(str::trim).filter(|l| !l.is_empty()) {
        if !got {
            f.line = l.to_string();
            got = true;
            continue;
        }
        match l.split_once(':') {
            Some((k, v)) if OPTION_KEYS.contains(&k.trim().to_lowercase().as_str()) => f.options.push((k.trim().to_lowercase(), v.trim().to_string())),
            Some((k, v)) if k.trim().eq_ignore_ascii_case("filter") && filters::parse(v).is_ok() => f.filters.push(v.trim().to_string()),
            Some((k, v)) if k.trim().eq_ignore_ascii_case("type") && v.trim().rsplit_once(' ').is_some_and(|(n, t)| !n.trim().is_empty() && TYPES.contains(&t.trim().to_lowercase().as_str())) => {
                let (n, t) = v.trim().rsplit_once(' ').unwrap();
                f.types.push((n.trim().to_string(), t.trim().to_lowercase()));
            }
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
        for (n, t) in &self.types {
            opts.push_str(&format!("type: {n} {t}\n"));
        }
        for l in &self.filters {
            opts.push_str(&format!("filter: {l}\n"));
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
    set_prop_typed(store, id, name, value, None)
}

/// A value as its type keeps it: a Date is `YYYY-MM-DD` (a real day), Yes/no is `true` or `false` (yes, no, on and off are read); Text and
/// Choice are the text as given.
pub fn typed_value(kind: &str, value: &str) -> Result<String> {
    let v = value.trim();
    match type_word(kind)? {
        "date" if !v.is_empty() => chrono::NaiveDate::parse_from_str(v, "%Y-%m-%d").map(|_| v.to_string()).map_err(|_| bad(format!("A date is written YYYY-MM-DD (2026-11-22), not “{v}”."))),
        "yesno" if !v.is_empty() => match v.to_lowercase().as_str() {
            "true" | "yes" | "on" => Ok("true".into()),
            "false" | "no" | "off" => Ok("false".into()),
            _ => Err(bad(format!("Yes/no is true or false, not “{v}”."))),
        },
        _ => Ok(v.to_string()),
    }
}

/// `set_prop` with the property's type (`--type date`): the value is checked and kept as the type writes it.
pub fn set_prop_typed(store: &mut Store, id: &str, name: &str, value: Option<&str>, kind: Option<&str>) -> Result<Value> {
    let name = check_name(name)?;
    let owned = match (value, kind) {
        (Some(v), Some(k)) => Some(typed_value(k, v)?),
        _ => None,
    };
    let value = owned.as_deref().or(value);
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

/// What each page holds that a filter can ask about: the books and chapters its references name, and the kinds of callout written in it.
struct Lens {
    /// page id → (book's id, book's name, first chapter, last chapter)
    spans: HashMap<String, Vec<(u32, String, u32, u32)>>,
    callouts: HashMap<String, Vec<String>>,
    folders: Vec<String>,
}

impl Lens {
    fn new(bible: &Bible, store: &Store) -> Lens {
        let mut spans: HashMap<String, Vec<(u32, String, u32, u32)>> = HashMap::new();
        for (id, e) in crate::pageindex::all(bible, store) {
            for sp in &e.spans {
                if let Ok(b) = bible.book(&sp.code) {
                    let (lo, hi) = (sp.lo.0.max(1), sp.hi.0.max(sp.lo.0).min(b.chapters.max(1)));
                    spans.entry(id.clone()).or_default().push((b.id, b.name.clone(), lo, hi));
                }
            }
        }
        let mut callouts: HashMap<String, Vec<String>> = HashMap::new();
        if let Ok(v) = crate::questions::callouts(store, None, None) {
            for c in v["callouts"].as_array().into_iter().flatten() {
                let (Some(p), Some(l)) = (c["page"].as_str(), c["label"].as_str()) else { continue };
                let list = callouts.entry(p.to_string()).or_default();
                if !list.iter().any(|x| x == l) {
                    list.push(l.to_string());
                }
            }
        }
        let folders = store.threads().iter().map(|t| crate::store::s(t, "name")).collect();
        Lens { spans, callouts, folders }
    }
    /// The books a page names, each as the book alone and as the book and a chapter (`Numbers`, `Numbers 25`).
    fn books(&self, id: &str) -> Vec<String> {
        let mut out: Vec<String> = vec![];
        for (_, name, lo, hi) in self.spans.get(id).into_iter().flatten() {
            if !out.contains(name) {
                out.push(name.clone());
            }
            for c in *lo..=*hi {
                let w = format!("{name} {c}");
                if !out.contains(&w) {
                    out.push(w);
                }
            }
        }
        out
    }
}

fn own_text(v: &Value) -> Vec<String> {
    let t = prop_text(v);
    if t.trim().is_empty() { vec![] } else { vec![t.trim().to_string()] }
}

/// A page's facts for the filters: the about-the-page properties and each own property (a property the page lacks is a name with no values).
fn page_facts(r: &Value, lens: &Lens, own: &[String]) -> Facts {
    let mut f = Facts::new();
    let id = r["id"].as_str().unwrap_or("");
    f.insert("folder".into(), r["threads"].as_array().into_iter().flatten().filter_map(|t| t["name"].as_str()).map(String::from).collect());
    f.insert("edited".into(), vec![r["updated"].as_str().unwrap_or("").to_string()].into_iter().filter(|x| !x.is_empty()).collect());
    f.insert("written".into(), vec![r["created"].as_str().unwrap_or("").to_string()].into_iter().filter(|x| !x.is_empty()).collect());
    f.insert("book".into(), lens.books(id));
    f.insert("callout kind".into(), lens.callouts.get(id).cloned().unwrap_or_default());
    for name in own {
        let v = r["props"].as_object().and_then(|m| m.iter().find(|(k, _)| k.eq_ignore_ascii_case(name))).map(|(_, x)| own_text(x)).unwrap_or_default();
        f.insert(name.to_lowercase(), v);
    }
    f
}

const ABOUT: [(&str, &str); 5] = [
    ("Folder", "The folder a page is in"),
    ("Edited", "When the page was last changed"),
    ("Written", "When the page was first made"),
    ("Callout kind", "The callouts written in a page: Question, Answered, Key point, Note"),
    ("Book", "The books a page names in its references and Scripture blocks (and the chapter, inside the book)"),
];

const DATE_LABELS: [(&str, &str); 4] = [("today", "Today"), ("last 7 days", "Last 7 days"), ("last 30 days", "Last 30 days"), ("last year", "Last year")];

fn counted(map: &BTreeMap<String, usize>) -> Vec<Value> {
    map.iter().map(|(v, n)| json!({"value": v, "label": v, "count": n})).collect()
}

/// The Filter menu of a list: each property it can be narrowed by, with the values its pages hold and how many pages hold each.
fn filter_menu(rows: &[Value], facts: &[Facts], lens: &Lens, own: &[String], types: &[(String, String)]) -> Vec<Value> {
    let tally = |key: &str| -> BTreeMap<String, usize> {
        let mut m = BTreeMap::new();
        for f in facts {
            let mut seen: Vec<&String> = vec![];
            for v in f.get(key).into_iter().flatten() {
                if !seen.contains(&v) {
                    seen.push(v);
                    *m.entry(v.clone()).or_insert(0) += 1;
                }
            }
        }
        m
    };
    let mut out = vec![];
    let folder_ids: std::collections::BTreeSet<String> = rows.iter().flat_map(|r| r["threads"].as_array().into_iter().flatten().filter_map(|t| t["id"].as_str().map(String::from))).collect();
    let many_folders = folder_ids.len() > 1;
    for (name, hint) in ABOUT {
        let key = name.to_lowercase();
        let values: Vec<Value> = match name {
            "Folder" if !many_folders => continue,
            "Folder" | "Callout kind" => counted(&tally(&key)),
            "Edited" | "Written" => DATE_LABELS
                .iter()
                .map(|(v, l)| json!({"value": v, "label": l, "count": facts.iter().filter(|f| f.get(&key).and_then(|d| d.first()).is_some_and(|d| filters::date_in(v, d))).count()}))
                .collect(),
            _ => {
                // Book: in Bible order, each with its chapters
                let books = tally("book");
                let mut order: Vec<(u32, String)> = lens.spans.values().flatten().map(|(i, n, _, _)| (*i, n.clone())).collect();
                order.sort();
                order.dedup();
                order
                    .into_iter()
                    .filter(|(_, n)| books.contains_key(n))
                    .map(|(_, n)| {
                        let prefix = format!("{n} ");
                        let mut chapters: Vec<(u32, usize)> = books.iter().filter_map(|(k, c)| k.strip_prefix(&prefix).and_then(|x| x.parse::<u32>().ok()).map(|x| (x, *c))).collect();
                        chapters.sort();
                        json!({"value": n, "label": n, "count": books[&n], "chapters": chapters.iter().map(|(c, k)| json!({"value": format!("{n} {c}"), "label": c.to_string(), "count": k})).collect::<Vec<_>>()})
                    })
                    .collect()
            }
        };
        if matches!(name, "Callout kind" | "Book" | "Folder") && values.is_empty() {
            continue;
        }
        out.push(json!({"name": name, "group": "page", "hint": hint, "type": if name == "Edited" || name == "Written" { "date" } else { "choice" }, "values": values}));
    }
    for name in own {
        let t = types.iter().find(|(n, _)| n.eq_ignore_ascii_case(name)).map(|(_, t)| t.as_str()).unwrap_or("text");
        let key = name.to_lowercase();
        let mut values = counted(&tally(&key));
        if t == "yesno" {
            let held = tally(&key);
            values = ["true", "false"].iter().map(|v| json!({"value": v, "label": if *v == "true" { "Yes" } else { "No" }, "count": held.get(*v).copied().unwrap_or(0)})).collect();
        }
        out.push(json!({"name": name, "group": "own", "hint": "A column you added with + Property", "type": t, "values": values}));
    }
    out
}

/// A filter as the window draws it as a chip: its words and what of it is gone (the folder deleted, the property removed).
fn chip(f: &Filter, lens: &Lens, own: &[String]) -> (Value, bool) {
    let mut v = filters::json_of(f);
    let mut gone_values: Vec<String> = vec![];
    let mut gone = false;
    match f.property.to_lowercase().as_str() {
        "folder" => {
            gone_values = f.values.iter().filter(|x| !lens.folders.iter().any(|n| n.eq_ignore_ascii_case(x))).cloned().collect();
            gone = f.way != Way::NotSet && f.way != Way::Set && !f.values.is_empty() && gone_values.len() == f.values.len();
        }
        "edited" | "written" | "book" | "callout kind" => {}
        p => gone = !own.iter().any(|n| n.to_lowercase() == p),
    }
    v["gone"] = json!(gone);
    v["gone_values"] = json!(gone_values);
    (v, gone)
}

/// A page's views with what each finds now (`wb page views`), as the window draws them: each block's number (from 1, as
/// `wb page blocks` counts), its line, its options (`view`, `group`, `columns`, `sort`) and its rows; a line that cannot be read, or
/// holds a blank of a template (`{place}`), says so instead. The rows are pages, each with its `props`, `folder` and `edited`;
/// `properties` names every property the pages hold (and the columns asked for); with `group` there are `groups` of rows, each with its
/// key, label, color and count. Grouped by `callout` the rows are the callouts of those pages, in their kinds' order.
///
/// Filters (filters-v2, NB16): the fence's `filter:` lines narrow the rows (`filters`: each as a chip, `gone` when its folder or
/// property no longer exists, and then ignored; `total` the pages before them, `count` after; `filter_menu` what the list can be
/// narrowed by, with counts, from all its pages); `types` are the fence's `type:` lines. Group counts follow the filters, and a Board
/// column left empty stays with 0.
pub fn page_views(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    page_views_with(bible, store, id, &[])
}

/// `page_views` with more filters laid over each list for this one answer (`wb page views --filter "…"`); nothing is written.
pub fn page_views_with(bible: &Bible, store: &Store, id: &str, extra: &[Filter]) -> Result<Value> {
    let (id, text, titled) = pages::text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(f) = read_fence(&sub(&c, b.start, b.end)) else { continue };
        out.push(block_view(bible, store, &f, i + 1, extra));
    }
    Ok(json!({"id": id, "blocks": out}))
}

fn block_view(bible: &Bible, store: &Store, f: &Fence, n: usize, extra: &[Filter]) -> Value {
    let line = f.line.clone();
    let (view, group, sort) = (f.opt("view").to_lowercase(), f.opt("group").to_string(), f.opt("sort").to_lowercase());
    let view = if view.is_empty() { "table".to_string() } else { view };
    // a board is a column for each group: with none chosen, each folder
    let group = if group.is_empty() && view == "board" { "folder".to_string() } else { group };
    let mut v = json!({"n": n, "line": line, "view": view, "group": group, "columns": f.columns(), "sort": sort,
        "types": f.types.iter().map(|(n, t)| json!({"name": n, "type": t})).collect::<Vec<_>>()});
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
                let all = list_rows(store, &all, &sort);
                let mut names: Vec<String> = vec![];
                for r in &all {
                    for k in r["props"].as_object().into_iter().flat_map(|m| m.keys()) {
                        if !names.contains(k) {
                            names.push(k.clone());
                        }
                    }
                }
                for k in f.columns().into_iter().chain(f.types.iter().map(|(n, _)| n.clone())) {
                    if !names.iter().any(|x| x.eq_ignore_ascii_case(&k)) {
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
                // the filters: the fence's lines, then any laid over for this answer
                let lens = Lens::new(bible, store);
                let mut filters: Vec<Filter> = f.filters.iter().filter_map(|l| filters::parse(l).ok()).collect();
                for x in extra {
                    filters::put(&mut filters, x.clone());
                }
                let facts: Vec<Facts> = all.iter().map(|r| page_facts(r, &lens, &names)).collect();
                v["filter_menu"] = json!(filter_menu(&all, &facts, &lens, &names, &f.types));
                let mut chips = vec![];
                let mut live: Vec<&Filter> = vec![];
                for fl in &filters {
                    let (j, gone) = chip(fl, &lens, &names);
                    chips.push(j);
                    if !gone {
                        live.push(fl);
                    }
                }
                v["filters"] = json!(chips);
                let none: Vec<String> = vec![];
                let keep: Vec<bool> = facts
                    .iter()
                    .map(|fx| {
                        live.iter().all(|fl| {
                            // a folder gone from some of the values: the rest still count
                            let mut fl = (*fl).clone();
                            if fl.key() == "folder" {
                                fl.values.retain(|x| lens.folders.iter().any(|n| n.eq_ignore_ascii_case(x)));
                            }
                            filters::passes(&fl, fx.get(&fl.key()).unwrap_or(&none))
                        })
                    })
                    .collect();
                v["total"] = json!(all.len());
                let rows: Vec<Value> = all.iter().zip(&keep).filter(|(_, k)| **k).map(|(r, _)| r.clone()).collect();
                let by_group = |rows: Vec<Value>| -> Vec<Value> {
                    match group.to_lowercase().as_str() {
                        "folder" => group_by(rows, |r| match r["folder"]["id"].as_str() {
                            Some(k) => (k.to_string(), r["folder"]["name"].as_str().unwrap_or("").to_string(), r["folder"]["color"].clone()),
                            None => (String::new(), "Pages".to_string(), Value::Null),
                        }),
                        name => {
                            let name = name.to_string();
                            group_by(rows, |r| {
                                let val = r["props"].as_object().and_then(|m| m.iter().find(|(k, _)| k.to_lowercase() == name)).map(|(_, x)| prop_text(x)).unwrap_or_default();
                                let label = if val.is_empty() { format!("No {group}") } else { val.clone() };
                                (val, label, Value::Null)
                            })
                        }
                    }
                };
                let (shown, groups) = match group.to_lowercase().as_str() {
                    "" | "none" => (rows, None),
                    "callout" => {
                        let ids: Vec<&str> = rows.iter().filter_map(|r| r["id"].as_str()).collect();
                        let cs: Vec<Value> = crate::questions::callouts(store, None, None)
                            .map(|c| c["callouts"].as_array().cloned().unwrap_or_default())
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
                    _ => {
                        let mut g = by_group(rows.clone());
                        if view == "board" {
                            // a column left empty by the filters stays, with 0
                            for full in by_group(all.clone()) {
                                if !g.iter().any(|x| x["key"] == full["key"]) {
                                    let mut e = full.clone();
                                    e["count"] = json!(0);
                                    e["rows"] = json!([]);
                                    g.push(e);
                                }
                            }
                            g.sort_by(|a, b| {
                                let (ka, kb) = (a["key"].as_str().unwrap_or(""), b["key"].as_str().unwrap_or(""));
                                ka.is_empty().cmp(&kb.is_empty()).then_with(|| a["label"].as_str().unwrap_or("").to_lowercase().cmp(&b["label"].as_str().unwrap_or("").to_lowercase()))
                            });
                        }
                        (rows, Some(g))
                    }
                };
                v["count"] = json!(shown.len());
                v["pages"] = json!(keep.iter().filter(|k| **k).count());
                v["rows"] = json!(shown);
                if let Some(g) = groups {
                    v["groups"] = json!(g);
                }
            }
            Err(e) => v["error"] = json!(e.0),
        }
    }
    v
}

/// The properties a list can be filtered by now: about the page (Folder, Edited, Written, Callout kind, Book) and its own.
fn known_properties(bible: &Bible, store: &Store, f: &Fence) -> Vec<String> {
    let v = block_view(bible, store, f, 1, &[]);
    let mut out: Vec<String> = ABOUT.iter().map(|(n, _)| n.to_string()).collect();
    out.extend(v["properties"].as_array().into_iter().flatten().filter_map(|x| x.as_str()).map(String::from));
    out
}

fn check_filter_values(f: &Filter) -> Result<()> {
    if f.property.contains([':', '"', '`']) {
        return Err(bad("A property's name is a few plain words."));
    }
    if f.values.iter().any(|v| v.contains('\n')) {
        return Err(bad("A value is one line."));
    }
    Ok(())
}

/// Change a view (block `n`, from 0): its line (`line`, read first, so one that cannot be read is not written) and its options. An option
/// given as `Some("")` is taken away. The fence is written anew; a line the fence holds that this does not know stays. → the page's
/// blocks, as `pages::edit`.
pub fn set_view(bible: &Bible, store: &mut Store, id: &str, n: usize, line: Option<&str>, options: &[(&str, Option<&str>)]) -> Result<Value> {
    set_view_with(bible, store, id, n, line, options, &ViewEdits::default())
}

/// What a change of a view adds to its options: filters to put (`Status is Open`, one per property, the same property replaced),
/// properties to unfilter (`Status`, or `all`) and types to set (`Speaker choice`).
#[derive(Default)]
pub struct ViewEdits<'a> {
    pub filters: &'a [String],
    pub unfilter: &'a [String],
    pub types: &'a [String],
}

/// A property's kind as written: text, choice, date, or yes/no (`yesno`, `yes/no`).
pub fn type_word(said: &str) -> Result<&'static str> {
    match said.trim().to_lowercase().replace(['/', ' ', '-'], "").as_str() {
        "text" => Ok("text"),
        "choice" => Ok("choice"),
        "date" => Ok("date"),
        "yesno" => Ok("yesno"),
        _ => Err(bad("A property is Text, Choice, Date or Yes/no (text, choice, date, yesno).")),
    }
}

pub fn set_view_with(bible: &Bible, store: &mut Store, id: &str, n: usize, line: Option<&str>, options: &[(&str, Option<&str>)], edits: &ViewEdits) -> Result<Value> {
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
    for t in edits.types {
        let t = t.trim();
        let (name, kind) = t.rsplit_once(' ').ok_or_else(|| bad("--type reads like “Speaker choice”: a property's name, then text, choice, date or yesno."))?;
        let name = check_name(name)?;
        let kind = type_word(kind)?;
        f.types.retain(|(x, _)| !x.eq_ignore_ascii_case(&name));
        if kind != "text" {
            f.types.push((name, kind.to_string()));
        }
    }
    for u in edits.unfilter {
        let u = u.trim();
        if u.eq_ignore_ascii_case("all") {
            f.filters.clear();
        } else {
            f.filters.retain(|l| filters::parse(l).map(|x| !x.property.eq_ignore_ascii_case(u)).unwrap_or(true));
        }
    }
    if !edits.filters.is_empty() {
        let mut have: Vec<Filter> = f.filters.iter().filter_map(|l| filters::parse(l).ok()).collect();
        let known = if f.line.is_empty() || f.line.contains('{') { None } else { Some(known_properties(bible, store, &f)) };
        for l in edits.filters {
            let fl = filters::parse(l)?;
            if let Some(k) = &known {
                if !k.iter().any(|p| p.eq_ignore_ascii_case(&fl.property)) {
                    return Err(bad(format!("This list has no property called “{}”; it has {}.", fl.property, k.join(", "))));
                }
            }
            check_filter_values(&fl)?;
            filters::put(&mut have, fl);
        }
        f.filters = have.iter().map(Filter::text).collect();
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

/// What `wb question list --filter` and the Questions list can be narrowed by.
pub const QUESTION_PROPERTIES: [&str; 5] = ["Kind", "Folder", "Book", "Edited", "Written"];

fn folders_of_page(store: &Store, page: &str) -> Vec<String> {
    if let Some(slug) = page.strip_prefix("thread:") {
        return store.thread(slug).map(|t| vec![crate::store::s(&t, "name")]).unwrap_or_default();
    }
    store.find_note(page).map(|n| crate::store::threads_of(&n).iter().map(|t| store.thread(t).map(|x| crate::store::s(&x, "name")).unwrap_or_else(|_| t.clone())).collect()).unwrap_or_default()
}

fn books_of_anchor(bible: &Bible, anchor: &str) -> Vec<String> {
    let Ok(a) = anchors::parse(anchor) else { return vec![] };
    if a.kind == Kind::Lemma {
        return vec![];
    }
    let Ok(b) = bible.book(&a.code) else { return vec![] };
    let (lo, hi) = (a.c1.max(1), a.c2.unwrap_or(a.c1).max(a.c1).min(b.chapters.max(1)));
    let mut out = vec![b.name.clone()];
    out.extend((lo..=hi).map(|c| format!("{} {c}", b.name)));
    out
}

/// The questions a list of them keeps once the filters are applied (Kind: Question or Answered; Folder: the folder of the page it is
/// written in, or its own; Book: the books it and its page name; Edited and Written). A filter naming another property is refused
/// with the properties a question has.
pub fn narrow_questions(bible: &Bible, store: &Store, list: Vec<Value>, filters: &[Filter]) -> Result<Vec<Value>> {
    for f in filters {
        if !QUESTION_PROPERTIES.iter().any(|p| p.eq_ignore_ascii_case(&f.property)) {
            return Err(bad(format!("Questions have no property called “{}”; they have {}.", f.property, QUESTION_PROPERTIES.join(", "))));
        }
    }
    if filters.is_empty() {
        return Ok(list);
    }
    let lens = Lens::new(bible, store);
    let none: Vec<String> = vec![];
    Ok(list.into_iter().filter(|e| {
        let facts = question_facts(bible, store, &lens, e);
        filters.iter().all(|f| filters::passes(f, facts.get(&f.key()).unwrap_or(&none)))
    }).collect())
}

fn question_facts(bible: &Bible, store: &Store, lens: &Lens, e: &Value) -> Facts {
    let page = e["page"].as_str().unwrap_or("");
    let mut folders: Vec<String> = e["threads"].as_array().into_iter().flatten().filter_map(|t| t["name"].as_str()).map(String::from).collect();
    if !page.is_empty() {
        folders.extend(folders_of_page(store, page));
    }
    let mut books = lens.books(page);
    books.extend(books_of_anchor(bible, e["anchor"].as_str().unwrap_or("")));
    let mut facts = Facts::new();
    facts.insert("kind".into(), vec![if e["status"] == "done" { "Answered" } else { "Question" }.to_string()]);
    facts.insert("folder".into(), folders);
    facts.insert("book".into(), books);
    facts.insert("edited".into(), vec![e["updated"].as_str().unwrap_or("").to_string()]);
    facts.insert("written".into(), vec![e["created"].as_str().unwrap_or("").to_string()]);
    facts
}

/// The Questions list's Add filter menu (Folder, Book) with the values the questions hold and how many hold each.
pub fn question_menu(bible: &Bible, store: &Store, list: &[Value]) -> Vec<Value> {
    let lens = Lens::new(bible, store);
    let facts: Vec<Facts> = list.iter().map(|e| question_facts(bible, store, &lens, e)).collect();
    let tally = |key: &str, books_only: bool| -> Vec<Value> {
        let mut m: BTreeMap<String, usize> = BTreeMap::new();
        for f in &facts {
            let mut seen: Vec<&String> = vec![];
            for v in f.get(key).into_iter().flatten().filter(|v| !books_only || !v.chars().last().is_some_and(|c| c.is_ascii_digit())) {
                if !seen.contains(&v) {
                    seen.push(v);
                    *m.entry(v.clone()).or_insert(0) += 1;
                }
            }
        }
        m.into_iter().map(|(v, n)| json!({"value": v, "label": v, "count": n})).collect()
    };
    vec![
        json!({"name": "Folder", "group": "page", "hint": "The folder a question's page is in", "type": "choice", "values": tally("folder", false)}),
        json!({"name": "Book", "group": "page", "hint": "The books a question names", "type": "choice", "values": tally("book", true)}),
    ]
}

/// `--folder NAME --book BOOK --filter "…"` of a command, as filters.
pub fn filters_of(words: &[String], folder: Option<&str>, book: Option<&str>) -> Result<Vec<Filter>> {
    let mut out: Vec<Filter> = vec![];
    for w in words {
        filters::put(&mut out, filters::parse(w)?);
    }
    if let Some(f) = folder.filter(|f| !f.trim().is_empty()) {
        filters::put(&mut out, Filter { property: "Folder".into(), way: Way::Is, values: vec![f.trim().to_string()] });
    }
    if let Some(b) = book.filter(|f| !f.trim().is_empty()) {
        filters::put(&mut out, Filter { property: "Book".into(), way: Way::Is, values: vec![b.trim().to_string()] });
    }
    Ok(out)
}
