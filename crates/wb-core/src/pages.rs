//! Pages and blocks (W3 of "The Notebook as a workspace", 2026-11-07; the sheets W1.1 and W2 of
//! docs/archive/2026-11-10/docs/workspace-design.md).
//!
//! **Pages inside pages.** Every note is one Markdown file where it always was; a page inside another names it in its
//! front matter (`parent: "<id>"`), with its place among the pages beside it (`order`: 1, 2, 3 …). Pages with no
//! `order` come first, newest first (a new page goes to the top); `order` is written when the person moves one. A page
//! is pinned with `pinned: <its place in Pinned>` (the person's choice, 2026-11-07). The tree holds the notes with no
//! place (pages since W1) and any note put inside a page or holding one; a day's page stays under Today. Deleting a
//! page moves the pages inside it up a level, into its place (the person's choice); nothing else is deleted with it.
//!
//! **Blocks.** A note's text read as blocks, each a run of its Markdown: a paragraph, a heading, a list item (each item
//! its own block, the person's choice), a to-do (`- [ ]`, `- [x]`), a quote, a divider (`---`), a table (`| … |`) and a
//! fenced block (```` ``` ````, with what follows the fence: `scripture`, `view` …). Its first line is its title, apart
//! from the blocks (a day's page has none). Blocks are apart by a blank line in the file; list items one after another
//! sit together. Changing, adding, removing or moving a block rewrites only the lines around it.

use crate::bible::Bible;
use crate::notebook as nb;
use crate::store::{bad, missing, s, Store};
use crate::Result;
use serde_json::{json, Value};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

// ---- the tree ---------------------------------------------------------------------------------------------------------

fn id_of(e: &Value) -> &str {
    e["id"].as_str().unwrap_or("")
}

/// The pages beside each other in the order the Notebook shows them: those never moved (no `order`) first, newest
/// first; then by `order`.
fn by_order(a: &Value, b: &Value) -> Ordering {
    match (a["order"].as_f64(), b["order"].as_f64()) {
        (None, None) => b["created"].as_str().cmp(&a["created"].as_str()),
        (None, Some(_)) => Ordering::Less,
        (Some(_), None) => Ordering::Greater,
        (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(Ordering::Equal).then_with(|| a["created"].as_str().cmp(&b["created"].as_str())),
    }
}

/// Every note and question as the Notebook's entries, and each one's parent as the tree reads it: a parent that is gone,
/// is a day, or would put a page inside itself is read as none (the page is at the top).
struct Tree {
    all: Vec<Value>,
    parent: HashMap<String, String>,
}

impl Tree {
    fn read(bible: &Bible, store: &Store) -> Tree {
        // templates (W5) are listed under Templates, not in the tree
        let mut all: Vec<Value> = nb::every(bible, store).into_iter().filter(|e| !nb::is_template(e)).collect();
        // a thread is a page in the tree (R1); the pages written on it are its children, kept in each note's `threads`
        all.extend(crate::threadpage::lines(bible, store));
        let ids: HashSet<String> = all.iter().map(|e| id_of(e).to_string()).collect();
        let mut parent: HashMap<String, String> = all
            .iter()
            .filter_map(|e| Some((id_of(e).to_string(), e["parent"].as_str()?.to_string())))
            .filter(|(id, p)| id != p && ids.contains(p))
            .collect();
        // a loop (A inside B inside A, written by hand) is broken where it is found
        let keys: Vec<String> = parent.keys().cloned().collect();
        for k in keys {
            let mut seen = HashSet::from([k.clone()]);
            let mut at = k.clone();
            while let Some(p) = parent.get(&at).cloned() {
                if !seen.insert(p.clone()) {
                    parent.remove(&at);
                    break;
                }
                at = p;
            }
        }
        Tree { all, parent }
    }

    fn get(&self, id: &str) -> Option<&Value> {
        self.all.iter().find(|e| id_of(e) == id)
    }

    fn parent_of(&self, id: &str) -> Option<&str> {
        self.parent.get(id).map(String::as_str)
    }

    fn has_children(&self, id: &str) -> bool {
        self.parent.values().any(|p| p == id)
    }

    /// Is this note a page in the tree: no place, or inside a page, or holding one.
    fn in_tree(&self, e: &Value) -> bool {
        let id = id_of(e);
        e["placed"] == false || self.parent.contains_key(id) || self.has_children(id)
    }

    /// The pages inside `parent` (None: the top of the tree), in order.
    fn children(&self, parent: Option<&str>) -> Vec<&Value> {
        if let Some(slug) = parent.and_then(crate::threadpage::slug_of) {
            let mut v: Vec<&Value> = self.all.iter().filter(|e| e["kind"] != "thread" && e["threads"].as_array().into_iter().flatten().any(|x| x["id"] == slug)).collect();
            v.sort_by(|a, b| a["created"].as_str().cmp(&b["created"].as_str()));
            return v;
        }
        let mut v: Vec<&Value> = self.all.iter().filter(|e| self.in_tree(e) && self.parent_of(id_of(e)) == parent).collect();
        v.sort_by(|a, b| by_order(a, b));
        v
    }

    /// Is `id` inside `of`, at any depth?
    fn is_inside(&self, id: &str, of: &str) -> bool {
        let mut at = id;
        while let Some(p) = self.parent_of(at) {
            if p == of {
                return true;
            }
            at = p;
        }
        false
    }

    /// The pages above a page, from the top: [{id, title}].
    fn path(&self, id: &str) -> Vec<Value> {
        let mut out = vec![];
        let mut at = id;
        while let Some(p) = self.parent_of(at) {
            if let Some(e) = self.get(p) {
                out.push(json!({"id": p, "title": e["title"]}));
            }
            at = p;
        }
        out.reverse();
        out
    }

    fn row(&self, e: &Value) -> Value {
        json!({"id": e["id"], "title": e["title"], "kind": e["kind"], "placed": e["placed"], "anchor": e["anchor"], "label": e["label"], "color": e.get("color").cloned().unwrap_or(Value::Null),
            "status": e.get("status").cloned().unwrap_or(Value::Null), "pinned": e["pinned"], "order": e["order"],
            "parent": self.parent_of(id_of(e)), "created": e["created"], "updated": e["updated"]})
    }

    fn node(&self, e: &Value) -> Value {
        let mut r = self.row(e);
        r["children"] = json!(self.children(Some(id_of(e))).into_iter().map(|c| self.node(c)).collect::<Vec<_>>());
        r
    }

    fn pinned(&self) -> Vec<&Value> {
        let mut v: Vec<&Value> = self.all.iter().filter(|e| e["pinned"].as_f64().is_some()).collect();
        v.sort_by(|a, b| a["pinned"].as_f64().partial_cmp(&b["pinned"].as_f64()).unwrap_or(Ordering::Equal).then_with(|| a["created"].as_str().cmp(&b["created"].as_str())));
        v
    }
}

/// The Notebook's Pinned and Pages (W1.1): the pinned pages in their order, and the tree of pages, each with the pages
/// inside it (`children`).
pub fn tree(bible: &Bible, store: &Store) -> Result<Value> {
    let t = Tree::read(bible, store);
    let pages: Vec<Value> = t.children(None).into_iter().map(|e| t.node(e)).collect();
    let pinned: Vec<Value> = t.pinned().into_iter().map(|e| t.row(e)).collect();
    Ok(json!({"pinned": pinned, "pages": pages}))
}

/// The Notebook's sidebar (W1.1), in one answer: Today (today's page and the last few days written in), Pinned, Pages
/// (the tree), At the reader (the chapter `at`, with how many notes are on it), Threads (each with its notes' count) and
/// Questions (open first, then answered).
///
/// W4 (sheet W1.2), a row per open reader: `at` holds the reader's chapter first, then each second reader's.
/// `at_reader` is the first (the reader), `at_readers` all of them, each with how many notes are on its chapter.
pub fn sidebar_at(bible: &Bible, store: &Store, at: Vec<(String, u32)>, today: bool) -> Result<Value> {
    let mut v = sidebar_one(bible, store, at.first().cloned(), today)?;
    let mut rows = vec![];
    for (k, (code, ch)) in at.into_iter().enumerate() {
        let o = nb::Listing { group: "chapter".into(), at: Some((code.clone(), ch)), ..Default::default() };
        let l = nb::list(bible, store, &o)?;
        let g = &l["groups"][0];
        rows.push(json!({"code": code, "chapter": ch, "label": g["label"], "count": g["count"], "reader": if k == 0 { "the reader" } else { "new reader" }}));
    }
    v["at_readers"] = json!(rows);
    Ok(v)
}

fn sidebar_one(bible: &Bible, store: &Store, at: Option<(String, u32)>, today: bool) -> Result<Value> {
    let t = Tree::read(bible, store);
    let days = if today {
        let o = nb::Listing { group: "day".into(), days: true, ..Default::default() };
        let l = nb::list(bible, store, &o)?;
        let mut v: Vec<Value> = l["groups"].as_array().into_iter().flatten().flat_map(|g| g["entries"].as_array().cloned().unwrap_or_default()).filter(|e| e["kind"] == "day").collect();
        v.truncate(5);
        v.into_iter().map(|e| json!({"id": e["id"], "day": e["day"], "title": e["title"], "today": e["today"], "exists": e["exists"]})).collect()
    } else {
        vec![]
    };
    let at_reader = match at {
        Some((code, ch)) => {
            let o = nb::Listing { group: "chapter".into(), at: Some((code.clone(), ch)), ..Default::default() };
            let l = nb::list(bible, store, &o)?;
            let g = &l["groups"][0];
            json!({"code": code, "chapter": ch, "label": g["label"], "count": g["count"]})
        }
        None => Value::Null,
    };
    let threads: Vec<Value> = store
        .threads()
        .into_iter()
        .map(|th| {
            let id = s(th, "id");
            let n = t.all.iter().filter(|e| e["threads"].as_array().into_iter().flatten().any(|x| x["id"] == id.as_str())).count();
            json!({"id": id, "name": th["name"], "color": th.get("color").cloned().unwrap_or(Value::Null), "count": n})
        })
        .collect();
    let blocks = crate::questions::entries(bible, store);
    let mut qs: Vec<&Value> = t.all.iter().filter(|e| e["kind"] == "question").chain(blocks.iter()).collect();
    qs.sort_by(|a, b| (a["status"] == "done").cmp(&(b["status"] == "done")).then_with(|| b["created"].as_str().cmp(&a["created"].as_str())));
    let questions: Vec<Value> = qs.into_iter().map(|e| if e["block"].is_null() { t.row(e) } else { e.clone() }).collect();
    let pages: Vec<Value> = t.children(None).into_iter().map(|e| t.node(e)).collect();
    let pinned: Vec<Value> = t.pinned().into_iter().map(|e| t.row(e)).collect();
    let templates = crate::templates::rows(bible, store);
    Ok(json!({"today": days, "pinned": pinned, "pages": pages, "at_reader": at_reader, "threads": threads, "questions": questions, "templates": templates}))
}

/// Add to a note's entry where it is in the tree: the pages above it (`path`) and the pages inside it (`inside`).
pub(crate) fn add_place_in_tree(bible: &Bible, store: &Store, e: &mut Value) {
    let t = Tree::read(bible, store);
    let id = id_of(e).to_string();
    e["path"] = json!(t.path(&id));
    e["inside"] = json!(t.children(Some(&id)).into_iter().map(|c| t.row(c)).collect::<Vec<_>>());
}

/// The pages inside a page, in the Notebook's order, each with the pages inside it (`children`), at any depth (W6: a
/// document from a page reads them after it).
pub(crate) fn inside_tree(bible: &Bible, store: &Store, id: &str) -> Vec<Value> {
    let t = Tree::read(bible, store);
    t.children(Some(id)).into_iter().map(|c| t.node(c)).collect()
}

/// A note that can be a page (not a day's page), by its id.
fn page_entry<'a>(t: &'a Tree, id: &str) -> Result<&'a Value> {
    if crate::store::is_day(id) || id.starts_with("d_") {
        return Err(bad("A day's page stays under Today; it is not put inside another page."));
    }
    t.get(id).ok_or_else(|| missing("No note, question or page with that id."))
}

/// Write `order` 1, 2, 3 … on the pages of a list, each only where it differs.
fn renumber(store: &mut Store, list: &[String], field: &str) -> Result<Vec<String>> {
    let mut written = vec![];
    for (i, id) in list.iter().enumerate() {
        let want = json!(i + 1);
        if let Some(slug) = crate::threadpage::slug_of(id) {
            // a thread page has a place in Pinned only (settings/pages.json); among the pages it is not ordered
            if field == "pinned" && crate::threadpage::pinned_of(store, slug) != Some((i + 1) as f64) {
                crate::threadpage::set_pinned(store, slug, Some((i + 1) as i64))?;
                written.push(id.clone());
            }
            continue;
        }
        if store.find_note(id)?.get(field) != Some(&want) {
            store.set_fields(id, &[(field, Some(want))])?;
            written.push(id.clone());
        }
    }
    Ok(written)
}

/// Where a page goes among the pages beside it: after one of them, first, or (neither) last.
pub struct Place<'a> {
    pub after: Option<&'a str>,
    pub first: bool,
}

fn put_in(list: &mut Vec<String>, id: &str, at: &Place<'_>) -> Result<()> {
    list.retain(|x| x != id);
    let i = match (at.after, at.first) {
        (Some(a), _) => list.iter().position(|x| x == a).map(|i| i + 1).ok_or_else(|| bad("The page to put it after is not beside it."))?,
        (None, true) => 0,
        (None, false) => list.len(),
    };
    list.insert(i, id.to_string());
    Ok(())
}

/// Where a page is moved to: inside another page, to the top of the tree, or kept where it is (only its order changes).
pub enum Under<'a> {
    Keep,
    Top,
    In(&'a str),
}

/// Move a page: inside another (`Under::In`), to the top, or among the pages beside it; `at` says where among them.
/// The page's `parent` and the `order` of the pages beside it are written (only those that change). → where it is now.
pub fn move_page(bible: &Bible, store: &mut Store, id: &str, under: Under<'_>, at: Place<'_>) -> Result<Value> {
    let t = Tree::read(bible, store);
    page_entry(&t, id)?;
    if crate::threadpage::slug_of(id).is_some() {
        return Err(bad("A thread's page stays where it is among the pages (pin it, or put a page on it with wb note thread)."));
    }
    if let Under::In(p) = &under {
        if crate::threadpage::slug_of(p).is_some() {
            return Err(bad("A page is put on a thread with wb note thread, not inside it."));
        }
    }
    let parent: Option<String> = match under {
        Under::Keep => t.parent_of(id).map(String::from),
        Under::Top => None,
        Under::In(p) => {
            let p = page_entry(&t, p).map_err(|_| missing("No page with that id to put it inside."))?;
            let p = id_of(p);
            if p == id || t.is_inside(p, id) {
                return Err(bad("A page cannot go inside itself or a page inside it."));
            }
            Some(p.to_string())
        }
    };
    let mut list: Vec<String> = t.children(parent.as_deref()).into_iter().map(|e| id_of(e).to_string()).collect();
    put_in(&mut list, id, &at)?;
    let was = store.find_note(id)?.get("parent").cloned();
    let want = parent.as_ref().map(|p| json!(p));
    let mut written = vec![];
    if was != want {
        store.set_fields(id, &[("parent", want)])?;
        written.push(id.to_string());
    }
    for w in renumber(store, &list, "order")? {
        if !written.contains(&w) {
            written.push(w);
        }
    }
    Ok(json!({"id": id, "parent": parent, "order": list.iter().position(|x| x == id).map(|i| i + 1), "written": written}))
}

/// Pin a page (`at`: where in Pinned; last by default) or move it there; `pinned` holds each page's place, 1, 2, 3 ….
pub fn pin(bible: &Bible, store: &mut Store, id: &str, at: Place<'_>) -> Result<Value> {
    let t = Tree::read(bible, store);
    page_entry(&t, id)?;
    let mut list: Vec<String> = t.pinned().into_iter().map(|e| id_of(e).to_string()).collect();
    put_in(&mut list, id, &at)?;
    let written = renumber(store, &list, "pinned")?;
    Ok(json!({"id": id, "pinned": list, "written": written}))
}

/// Take a page out of Pinned.
pub fn unpin(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let t = Tree::read(bible, store);
    page_entry(&t, id)?;
    if let Some(slug) = crate::threadpage::slug_of(id) {
        crate::threadpage::set_pinned(store, slug, None)?;
    } else {
        store.set_fields(id, &[("pinned", None)])?;
    }
    let list: Vec<String> = t.pinned().into_iter().map(|e| id_of(e).to_string()).filter(|x| x != id).collect();
    Ok(json!({"id": id, "pinned": list}))
}

/// Before a page is deleted: the pages inside it move up a level, into its place among the pages beside it (the
/// person's choice, 2026-11-07). → the pages moved.
pub fn release(bible: &Bible, store: &mut Store, id: &str) -> Result<Vec<String>> {
    let t = Tree::read(bible, store);
    let inside: Vec<String> = t.children(Some(id)).into_iter().map(|e| id_of(e).to_string()).collect();
    if inside.is_empty() {
        return Ok(vec![]);
    }
    let up = t.parent_of(id).map(String::from);
    let mut list: Vec<String> = vec![];
    for e in t.children(up.as_deref()) {
        if id_of(e) == id {
            list.extend(inside.iter().cloned());
        } else {
            list.push(id_of(e).to_string());
        }
    }
    if !list.iter().any(|x| inside.contains(x)) {
        list.extend(inside.iter().cloned()); // the page itself was not in the tree's list (a placed note): at the end
    }
    for c in &inside {
        store.set_fields(c, &[("parent", up.as_ref().map(|p| json!(p)))])?;
    }
    renumber(store, &list, "order")?;
    Ok(inside)
}

/// A new page (a note with no place yet), at the top of the tree or inside a page (last among the pages there); with
/// `link`, a `[[link]]` to it is written in the page it is inside: `Some(None)` first (right under its title),
/// `Some(Some(n))` after block n (from 0), else at its end. → its entry.
pub fn new_page(bible: &Bible, store: &mut Store, parent: Option<&str>, text: &str, link: bool, after: Option<Option<usize>>) -> Result<Value> {
    let t = Tree::read(bible, store);
    let parent = match parent.map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => Some(id_of(page_entry(&t, p).map_err(|_| missing("No page with that id to put it inside."))?).to_string()),
        None => None,
    };
    if link && parent.is_none() {
        return Err(bad("A link is written in the page it goes inside: give --parent."));
    }
    // a page "inside" a thread is a page written on it (R1): a note on the thread, listed under its page
    if let Some(slug) = parent.as_deref().and_then(crate::threadpage::slug_of).map(String::from) {
        let r = store.add_thread_note(&slug, text)?;
        let id = s(&r, "id");
        if link {
            let p = parent.as_deref().unwrap_or_default();
            let title = nb::title_of(text);
            let pt = crate::threadpage::note_text(store, p)?;
            let at = match after {
                Some(n) => n,
                None => split(&pt, false).1.len().checked_sub(1),
            };
            let (out, _, _) = insert(&pt, false, at, &format!("[[{title}]]"))?;
            nb::edit_text(bible, store, p, &out)?;
        }
        return nb::show(bible, store, &id);
    }
    let r = store.jot(text, false)?;
    let id = s(&r, "id");
    if let Some(p) = &parent {
        let last = t.children(Some(p)).iter().filter_map(|e| e["order"].as_f64()).fold(0.0, f64::max) as i64;
        store.set_fields(&id, &[("parent", Some(json!(p))), ("order", Some(json!(last + 1)))])?;
        if link {
            let title = nb::title_of(text);
            let pt = s(&store.find_note(p)?, "text");
            let at = match after {
                Some(n) => n,
                None => split(&pt, true).1.len().checked_sub(1),
            };
            let (out, _, _) = insert(&pt, true, at, &format!("[[{title}]]"))?;
            nb::edit_text(bible, store, p, &out)?;
        }
    }
    nb::show(bible, store, &id)
}

// ---- blocks -------------------------------------------------------------------------------------------------------------

/// One block of a note's text: what it is, and where (in characters of the text; `end` is where its last line ends).
#[derive(Debug, Clone, PartialEq)]
pub struct Block {
    pub kind: &'static str,
    pub start: usize,
    pub end: usize,
    /// A heading's level (1–6).
    pub level: u8,
    /// A to-do: done?
    pub checked: Option<bool>,
    /// A fenced block: what follows its fence (`scripture`, `view` …).
    pub lang: String,
    /// A list item: how far in it is (spaces before its mark).
    pub indent: usize,
}

const LISTISH: [&str; 3] = ["item", "numbered", "todo"];

fn indent_of(l: &str) -> usize {
    l.chars().take_while(|c| *c == ' ' || *c == '\t').map(|c| if c == '\t' { 4 } else { 1 }).sum()
}

/// A list item's mark: (spaces before it, its length with the space after it, numbered?).
fn list_mark(l: &str) -> Option<(usize, usize, bool)> {
    let ind = indent_of(l);
    let rest = l.trim_start_matches([' ', '\t']);
    let lead = l.len() - rest.len();
    let b = rest.as_bytes();
    let (len, num) = if !b.is_empty() && matches!(b[0], b'-' | b'*' | b'+') {
        (1, false)
    } else {
        let d = b.iter().take_while(|c| c.is_ascii_digit()).count();
        if d == 0 || d > 9 || !matches!(b.get(d), Some(b'.') | Some(b')')) {
            return None;
        }
        (d + 1, true)
    };
    match b.get(len) {
        None => Some((ind, lead + len, num)),
        Some(b' ') | Some(b'\t') => Some((ind, lead + len + 1, num)),
        _ => None,
    }
}

fn is_divider(l: &str) -> bool {
    let t: String = l.chars().filter(|c| !c.is_whitespace()).collect();
    t.len() >= 3 && ["-", "*", "_"].iter().any(|m| t.chars().all(|c| c.to_string() == *m)) && indent_of(l) < 4
}

fn heading_level(l: &str) -> Option<u8> {
    let n = l.chars().take_while(|c| *c == '#').count();
    (1..=6).contains(&n).then_some(()).and_then(|_| match l.chars().nth(n) {
        None | Some(' ') | Some('\t') => Some(n as u8),
        _ => None,
    })
}

fn fence_of(l: &str) -> Option<&str> {
    let t = l.trim_start();
    if indent_of(l) >= 4 {
        return None;
    }
    ["```", "~~~"].into_iter().find(|f| t.starts_with(f))
}

/// What kind of block a line starts, if it starts one of its own (a paragraph line does not).
fn starts(l: &str) -> Option<&'static str> {
    if l.trim().is_empty() {
        return None;
    }
    if fence_of(l).is_some() {
        Some("fence")
    } else if heading_level(l).is_some() {
        Some("heading")
    } else if is_divider(l) {
        Some("divider")
    } else if l.trim_start().starts_with('|') {
        Some("table")
    } else if l.trim_start().starts_with('>') {
        Some("quote")
    } else if list_mark(l).is_some() {
        Some("item")
    } else {
        None
    }
}

/// The lines of a text with where each starts and ends, in characters.
fn lines_of(text: &str) -> Vec<(usize, usize, &str)> {
    let mut out = vec![];
    let mut at = 0;
    for l in text.split('\n') {
        let n = l.chars().count();
        out.push((at, at + n, l));
        at += n + 1;
    }
    out
}

/// A note's text as its title (the first line that has anything on it, when `titled`) and its blocks.
pub fn split(text: &str, titled: bool) -> (Option<(usize, usize)>, Vec<Block>) {
    let ls = lines_of(text);
    let mut i = 0;
    let mut title = None;
    if titled {
        while i < ls.len() && ls[i].2.trim().is_empty() {
            i += 1;
        }
        if i < ls.len() {
            title = Some((ls[i].0, ls[i].1));
            i += 1;
        }
    }
    let mut out = vec![];
    while i < ls.len() {
        let (s0, e0, l) = ls[i];
        if l.trim().is_empty() {
            i += 1;
            continue;
        }
        let mut b = Block { kind: "paragraph", start: s0, end: e0, level: 0, checked: None, lang: String::new(), indent: 0 };
        let mut j = i;
        match starts(l) {
            Some("fence") => {
                let mark = fence_of(l).unwrap();
                b.kind = "fence";
                b.lang = l.trim_start()[3..].trim().to_string();
                j += 1;
                while j < ls.len() && !(ls[j].2.trim_start().starts_with(mark) && ls[j].2.trim().trim_start_matches(mark.chars().next().unwrap()).is_empty()) {
                    j += 1;
                }
                if j >= ls.len() {
                    j = ls.len() - 1;
                }
            }
            Some("heading") => {
                b.kind = "heading";
                b.level = heading_level(l).unwrap();
            }
            Some("divider") => b.kind = "divider",
            Some(k @ ("table" | "quote")) => {
                b.kind = k;
                let mark = if k == "table" { '|' } else { '>' };
                while j + 1 < ls.len() && ls[j + 1].2.trim_start().starts_with(mark) {
                    j += 1;
                }
            }
            Some(_) => {
                let (ind, len, num) = list_mark(l).unwrap();
                b.indent = ind;
                b.kind = if num { "numbered" } else { "item" };
                let after: String = l.chars().skip(len).collect();
                if let Some(c) = ["[ ] ", "[x] ", "[X] ", "[ ]", "[x]", "[X]"].iter().find(|c| after.starts_with(**c) && (c.len() == 4 || after.len() == 3)) {
                    if !num {
                        b.kind = "todo";
                        b.checked = Some(!c.starts_with("[ ]"));
                    }
                }
                // what follows on the next lines, up to a blank line or a block of its own, is part of the item
                while j + 1 < ls.len() && !ls[j + 1].2.trim().is_empty() && starts(ls[j + 1].2).is_none() {
                    j += 1;
                }
            }
            None => {
                while j + 1 < ls.len() && !ls[j + 1].2.trim().is_empty() && starts(ls[j + 1].2).is_none() {
                    j += 1;
                }
            }
        }
        b.end = ls[j].1;
        out.push(b);
        i = j + 1;
    }
    (title, out)
}

pub(crate) fn chars(t: &str) -> Vec<char> {
    t.chars().collect()
}

pub(crate) fn sub(c: &[char], a: usize, b: usize) -> String {
    c[a.min(c.len())..b.min(c.len())].iter().collect()
}

fn listish(k: &str) -> bool {
    LISTISH.contains(&k)
}

/// The kind of block a piece of text begins with.
fn first_kind(t: &str) -> &'static str {
    split(t, false).1.first().map(|b| if listish(b.kind) { "item" } else { b.kind }).unwrap_or("paragraph")
}

fn last_kind(t: &str) -> &'static str {
    split(t, false).1.last().map(|b| if listish(b.kind) { "item" } else { b.kind }).unwrap_or("paragraph")
}

/// The gap between two pieces of a text: list items one after another keep a single line break; anything else is apart
/// by a blank line, so the blocks stay apart when read again. After the title, a single line break is kept as it was.
fn fix_gap(prev: Option<&'static str>, next: &'static str, gap: &str) -> String {
    let breaks = gap.matches('\n').count();
    if gap.is_empty() {
        // a seam made new (a block added or moved in): list items together, anything else apart
        return match prev {
            None => String::new(),
            Some(p) if listish(p) && listish(next) => "\n".into(),
            Some(_) => "\n\n".into(),
        };
    }
    match prev {
        None => gap.to_string(),
        Some("title") if breaks >= 1 => gap.to_string(),
        Some("title") => "\n".into(),
        Some(p) if listish(p) && listish(next) && breaks >= 1 => gap.to_string(),
        // a heading, a fence or a divider is a block of its own on its line, whatever touches it (a divider only
        // after something: under a paragraph it would make the paragraph a heading)
        Some(p) if (["heading", "fence", "divider"].contains(&p) || ["heading", "fence"].contains(&next)) && breaks >= 1 => gap.to_string(),
        Some(_) if breaks >= 2 => gap.to_string(),
        Some(_) => "\n\n".into(),
    }
}

/// The text with `chars a..b` replaced by `new`, the gaps on both sides set right. → the text, where `new` now starts
/// and ends (in characters).
fn splice(text: &str, titled: bool, a: usize, b: usize, new: &str, fresh: bool) -> (String, usize, usize) {
    let c = chars(text);
    let (title, blocks) = split(text, titled);
    // what ends before a and starts after b
    let prev_end = blocks.iter().filter(|x| x.end <= a).map(|x| x.end).max().into_iter().chain(title.map(|t| t.1).filter(|e| *e <= a)).max();
    let prev_kind: Option<&'static str> = match prev_end {
        None => None,
        Some(e) if title.is_some_and(|t| t.1 == e) && !blocks.iter().any(|x| x.end == e) => Some("title"),
        Some(e) => blocks.iter().find(|x| x.end == e).map(|x| if listish(x.kind) { "item" } else { x.kind }),
    };
    let next_start = blocks.iter().filter(|x| x.start >= b).map(|x| x.start).min();
    let before = sub(&c, 0, prev_end.unwrap_or(0));
    let after = next_start.map(|n| sub(&c, n, c.len())).unwrap_or_default();
    let new = new.trim_matches(|ch: char| ch == '\n' || ch == '\r').trim_end().to_string();
    let gap_before = sub(&c, prev_end.unwrap_or(0), a);
    let gap_after = next_start.map(|n| sub(&c, b, n)).unwrap_or_default();
    let mut out = before;
    if new.is_empty() {
        // the block is gone: its neighbours meet, with the gap that was after it (or before it, at the end)
        if !after.is_empty() {
            let g = if prev_end.is_some() { fix_gap(prev_kind, first_kind(&after), &gap_before) } else { String::new() };
            out.push_str(&g);
            out.push_str(&after);
        }
        let at = chars(&out).len();
        return (out, at, at);
    }
    let gb = if prev_end.is_none() { String::new() } else { fix_gap(prev_kind, first_kind(&new), if fresh { "" } else { &gap_before }) };
    out.push_str(&gb);
    let start = chars(&out).len();
    out.push_str(&new);
    let end = chars(&out).len();
    if !after.is_empty() {
        let lk = last_kind(&new);
        let ga = fix_gap(Some(lk), first_kind(&after), if fresh { "" } else { &gap_after });
        out.push_str(&ga);
        out.push_str(&after);
    }
    (out, start, end)
}

/// The blocks that begin within `a..b` (after a splice): (the first one's number, how many).
fn blocks_within(text: &str, titled: bool, a: usize, b: usize) -> (usize, usize) {
    let bs = split(text, titled).1;
    let first = bs.iter().position(|x| x.start >= a).unwrap_or(bs.len());
    let n = bs.iter().filter(|x| x.start >= a && x.start < b.max(a + 1)).count();
    (first, n)
}

fn check_n(blocks: &[Block], n: usize, count: usize) -> Result<()> {
    if count == 0 || n.saturating_add(count) > blocks.len() {
        return Err(missing(format!("The page has {} block{}; there is no block {}.", blocks.len(), if blocks.len() == 1 { "" } else { "s" }, n.saturating_add(count.max(1)))));
    }
    Ok(())
}

/// Replace `count` blocks from block `n` with `new` (empty: remove them). → the text, and the blocks `new` became
/// (the first one's number, how many: a blank line typed in a block makes two).
pub fn set(text: &str, titled: bool, n: usize, count: usize, new: &str) -> Result<(String, usize, usize)> {
    let bs = split(text, titled).1;
    check_n(&bs, n, count)?;
    let (out, a, b) = splice(text, titled, bs[n].start, bs[n + count - 1].end, new, false);
    let (first, k) = if a == b { (n, 0) } else { blocks_within(&out, titled, a, b) };
    Ok((out, first, k))
}

/// Add a block after block `after` (None: first, right after the title). → the text, the new blocks (first, how many).
pub fn insert(text: &str, titled: bool, after: Option<usize>, new: &str) -> Result<(String, usize, usize)> {
    if new.trim().is_empty() {
        return Err(bad("Write the block's text first."));
    }
    let (title, bs) = split(text, titled);
    let at = match after {
        Some(n) => {
            check_n(&bs, n, 1)?;
            bs[n].end
        }
        None => title.map(|t| t.1).unwrap_or(0),
    };
    let (out, a, b) = splice(text, titled, at, at, new, true);
    let (first, k) = blocks_within(&out, titled, a, b);
    Ok((out, first, k))
}

/// Move block `n` so that it comes before the block now numbered `to` (`to` = the number of blocks: last). → the text,
/// and where the block is now.
pub fn move_block(text: &str, titled: bool, n: usize, to: usize) -> Result<(String, usize)> {
    let bs = split(text, titled).1;
    check_n(&bs, n, 1)?;
    if to > bs.len() {
        return Err(missing(format!("The page has {} blocks; it can go before block 1 to {}, or last ({}).", bs.len(), bs.len(), bs.len() + 1)));
    }
    if to == n || to == n + 1 {
        return Ok((text.to_string(), n));
    }
    let c = chars(text);
    let moving = sub(&c, bs[n].start, bs[n].end);
    let (without, _, _) = set(text, titled, n, 1, "")?;
    let to = if to > n { to - 1 } else { to };
    let (out, first, _) = insert(&without, titled, to.checked_sub(1), &moving)?;
    Ok((out, first))
}

/// Tick a to-do, or take its tick off. → the text.
pub fn check(text: &str, titled: bool, n: usize, done: Option<bool>) -> Result<String> {
    let bs = split(text, titled).1;
    check_n(&bs, n, 1)?;
    let b = &bs[n];
    if b.kind != "todo" {
        return Err(bad(format!("Block {} is not a to-do.", n + 1)));
    }
    let c = chars(text);
    let line = sub(&c, b.start, b.end);
    let (_, len, _) = list_mark(&line).unwrap();
    let at = b.start + line[..].chars().take(len).count() + 1; // the character inside [ ]
    let now = done.unwrap_or(!b.checked.unwrap_or(false));
    let mut c = c;
    c[at] = if now { 'x' } else { ' ' };
    Ok(c.into_iter().collect())
}

/// A note's title changed: its first line takes the new one (a `#` heading mark it had stays). → the text.
pub fn retitle(text: &str, title: &str) -> Result<String> {
    let title = title.trim();
    if title.is_empty() || title.contains('\n') {
        return Err(bad("A title is one line with something on it."));
    }
    let c = chars(text);
    let Some((a, b)) = split(text, true).0 else { return Ok(title.to_string()) };
    let old = sub(&c, a, b);
    let marks: String = old.chars().take_while(|ch| *ch == '#' || *ch == ' ').collect();
    let marks = if marks.trim().is_empty() { String::new() } else { marks };
    Ok(format!("{}{}{}{}", sub(&c, 0, a), marks, title, sub(&c, b, c.len())))
}

// ---- blocks of a note in the study folder ------------------------------------------------------------------------------

/// A note's text, and whether its first line is its title (a day's page has none). A day's page is named by its id or
/// its day (2026-11-07).
pub(crate) fn text_of(store: &Store, id: &str) -> Result<(String, String, bool)> {
    if crate::threadpage::slug_of(id).is_some() {
        // a thread's page: its note is the text, and its title is its name, not a first line
        return Ok((id.trim().to_string(), crate::threadpage::note_text(store, id)?, false));
    }
    let id = if crate::store::is_day(id.trim()) { format!("d_{}", id.trim()) } else { id.trim().to_string() };
    let r = store.find_note(&id).map_err(|_| missing("No note, question or page with that id (a day's page not written in yet has no blocks)."))?;
    Ok((id.clone(), s(&r, "text"), !id.starts_with("d_")))
}

fn block_values(text: &str, titled: bool) -> Value {
    let c = chars(text);
    let (title, bs) = split(text, titled);
    let blocks: Vec<Value> = bs
        .iter()
        .enumerate()
        .map(|(i, b)| {
            let mut v = json!({"n": i + 1, "kind": b.kind, "text": sub(&c, b.start, b.end), "start": b.start, "end": b.end});
            if b.kind == "heading" {
                v["level"] = json!(b.level);
            }
            if let Some(x) = b.checked {
                v["checked"] = json!(x);
            }
            if b.kind == "fence" {
                v["lang"] = json!(b.lang);
            }
            if b.kind == "quote" {
                if let Some(q) = crate::questions::question_of(&sub(&c, b.start, b.end)) {
                    v["question"] = json!({"done": q.done, "text": q.text});
                }
            }
            if listish(b.kind) {
                v["indent"] = json!(b.indent);
            }
            v
        })
        .collect();
    json!({"title": title.map(|(a, b)| json!({"text": sub(&c, a, b), "start": a, "end": b})), "blocks": blocks})
}

/// A note's blocks: each one's number (from 1, as `wb block` counts them), kind, Markdown and where it is in the text (`wb page blocks`).
pub fn blocks(store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    let mut v = block_values(&text, titled);
    v["id"] = json!(id);
    Ok(v)
}

/// Write a page's whole text back (Tether's Accept and its Undo), as every block change is written.
pub(crate) fn write_text(bible: &Bible, store: &mut Store, id: &str, text: &str, titled: bool, expected: Option<&str>) -> Result<Value> {
    // guarded as edit_guarded is: a page that is not what was read is not written
    if let Some(e) = expected {
        if text_of(store, id)?.1 != e {
            return Err(bad("The page changed. Reopen it and try again."));
        }
    }
    written(bible, store, id, text, titled, 0, 0)
}

/// Write the changed text of a note and answer with its blocks, and which of them were just written (`n`, `count`).
fn written(bible: &Bible, store: &mut Store, id: &str, text: &str, titled: bool, n: usize, count: usize) -> Result<Value> {
    let thread = crate::threadpage::slug_of(id).is_some();
    if let Some(day) = id.strip_prefix("d_").filter(|day| crate::store::is_day(day)) {
        store.edit_day_blocks(day, text)?;
    } else {
        if text.trim().is_empty() && !thread {
            return Err(bad("A page needs some text. To remove it, delete the page."));
        }
        nb::edit_text(bible, store, id, text)?;
    }
    let now = if thread { crate::threadpage::note_text(store, id)? } else { s(&store.find_note(id)?, "text") };
    let mut v = block_values(&now, titled);
    v["id"] = json!(id);
    v["n"] = json!(n + 1);
    v["count"] = json!(count);
    Ok(v)
}

/// What a change to a block does to a note: change `count` blocks from `n` to new text (empty removes them), add one
/// after a block (or first), move one, tick a to-do.
pub enum Edit<'a> {
    Set { n: usize, count: usize, text: &'a str },
    Add { after: Option<usize>, text: &'a str },
    Move { n: usize, to: usize },
    Check { n: usize, done: Option<bool> },
    Title(&'a str),
}

/// Change a note block by block (the window's way of writing in a page, and `wb block …`). → its blocks after.
pub fn edit(bible: &Bible, store: &mut Store, id: &str, what: Edit<'_>) -> Result<Value> {
    edit_guarded(bible, store, id, what, None)
}

/// Change a block only if the page still contains the text the editor displayed.
pub fn edit_guarded(bible: &Bible, store: &mut Store, id: &str, what: Edit<'_>, expected: Option<&str>) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    if expected.is_some_and(|value| value != text) {
        return Err(bad("The page changed. Reopen it and try again."));
    }
    let (out, n, count) = match what {
        Edit::Set { n, count, text: new } => set(&text, titled, n, count, new)?,
        Edit::Add { after, text: new } => insert(&text, titled, after, new)?,
        Edit::Move { n, to } => {
            let (out, at) = move_block(&text, titled, n, to)?;
            (out, at, 1)
        }
        Edit::Check { n, done } => (check(&text, titled, n, done)?, n, 1),
        Edit::Title(t) => {
            if !titled {
                return Err(bad("A day's page is named by its day, and a thread's by its name (wb thread edit --rename)."));
            }
            (retitle(&text, t)?, 0, 0)
        }
    };
    written(bible, store, &id, &out, titled, n, count)
}

/// A successful deletion's inverse. The complete previous body preserves spacing, and the digest
/// limits Undo to the exact body produced by the deletion.
#[derive(serde::Deserialize, serde::Serialize)]
pub struct BlockUndo {
    page: String,
    before: String,
    after: String,
    n: usize,
    count: usize,
}

fn body_digest(text: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(text.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn remove_block(bible: &Bible, store: &mut Store, id: &str, n: usize, count: usize, expected: Option<&str>) -> Result<Value> {
    let (id, before, titled) = text_of(store, id)?;
    if expected.is_some_and(|value| value != before) {
        return Err(bad("The page changed. Reopen it and try again."));
    }
    let (out, at, remaining) = set(&before, titled, n, count, "")?;
    let mut result = written(bible, store, &id, &out, titled, at, remaining)?;
    let (_, after, _) = text_of(store, &id)?;
    result["undo"] = json!(BlockUndo { page: id, before, after: body_digest(&after), n, count });
    Ok(result)
}

pub fn undo_block(bible: &Bible, store: &mut Store, id: &str, undo: BlockUndo) -> Result<Value> {
    let (id, current, titled) = text_of(store, id)?;
    if undo.page != id || undo.after != body_digest(&current) {
        return Err(bad("The page changed after the block was deleted."));
    }
    // Check the inverse before writing so a stale or damaged token cannot replace unrelated text.
    let (after, _, _) = set(&undo.before, titled, undo.n, undo.count, "")?;
    if after.trim() != current.trim() {
        return Err(bad("The block Undo does not match this page."));
    }
    written(bible, store, &id, &undo.before, titled, undo.n, undo.count)
}

// ---- scripture blocks (W4) ----------------------------------------------------------------------------------------------

/// A scripture block as its fence holds it: the reference, and the choices kept after it (`lines`: a verse to a line;
/// `ylt`: the YLT). No scripture text is ever in the file; the verses are drawn from the Bible when shown.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScriptureFence {
    pub reference: String,
    pub lines: bool,
    pub ylt: bool,
}

/// A block's Markdown → its scripture fence, when it is one (```` ```scripture ````, the reference on its first line).
pub fn scripture_fence(block: &str) -> Option<ScriptureFence> {
    let mut ls = block.lines();
    let first = ls.next()?.trim_start();
    let mark = ["```", "~~~"].into_iter().find(|m| first.starts_with(m))?;
    if !first[3..].trim().split_whitespace().next().is_some_and(|w| w.eq_ignore_ascii_case("scripture")) {
        return None;
    }
    let inner: Vec<&str> = ls.take_while(|l| !l.trim_start().starts_with(mark)).map(str::trim).filter(|l| !l.is_empty()).collect();
    let (reference, opts) = inner.split_first().map(|(r, o)| (r.to_string(), o)).unwrap_or_default();
    let has = |w: &str| opts.iter().any(|o| o.eq_ignore_ascii_case(w));
    Some(ScriptureFence { reference, lines: has("lines"), ylt: has("ylt") })
}

/// The fence written back: the reference, then `lines` and `ylt` on their own lines when chosen.
pub fn scripture_fence_text(f: &ScriptureFence) -> String {
    let mut out = format!("```scripture\n{}\n", f.reference.trim());
    if f.lines {
        out += "lines\n";
    }
    if f.ylt {
        out += "ylt\n";
    }
    out + "```"
}

/// A page's scripture blocks with their verses from the Bible (`wb page scripture`), as the window draws them: each
/// block's number (from 1, as `wb page blocks` counts), its reference, Paragraph or Lines, its version, and the verses
/// (`scripture::marked`: verbatim, with the person's highlights); a reference that cannot be read says why.
pub fn scripture(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(f) = scripture_fence(&sub(&c, b.start, b.end)) else { continue };
        let version = if f.ylt { "YLT" } else { "KJV" };
        let mut v = json!({"n": i + 1, "reference": f.reference, "lines": f.lines, "version": version});
        if f.reference.is_empty() {
            v["error"] = json!("No reference yet: write one under ```scripture.");
        } else {
            match crate::scripture::marked(bible, store, &f.reference, version) {
                Ok(p) => {
                    v["label"] = p["label"].clone();
                    v["verses"] = p["verses"].clone();
                }
                Err(e) => v["error"] = json!(e.0),
            }
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}

/// Change a scripture block's choices (Paragraph or Lines, KJV or YLT): its fence is written anew, the reference kept.
/// None leaves a choice as it is. → the page's blocks, as `edit`.
pub fn set_scripture(bible: &Bible, store: &mut Store, id: &str, n: usize, lines: Option<bool>, ylt: Option<bool>) -> Result<Value> {
    let (_, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs.get(n).ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let mut f = scripture_fence(&sub(&c, b.start, b.end)).ok_or_else(|| bad(format!("Block {} is not a scripture block.", n + 1)))?;
    if let Some(x) = lines {
        f.lines = x;
    }
    if let Some(x) = ylt {
        f.ylt = x;
    }
    edit(bible, store, id, Edit::Set { n, count: 1, text: &scripture_fence_text(&f) })
}

// ---- thread and word blocks (R1) ----------------------------------------------------------------------------------------

/// A fence with one value in it (```` ```thread ```` then a thread's id, ```` ```word ```` then H7065): the value, or an
/// empty string when there is none yet.
fn value_fence(block: &str, lang: &str) -> Option<String> {
    let mut ls = block.lines();
    let first = ls.next()?.trim_start();
    let mark = ["```", "~~~"].into_iter().find(|m| first.starts_with(m))?;
    if !first[3..].trim().split_whitespace().next().is_some_and(|w| w.eq_ignore_ascii_case(lang)) {
        return None;
    }
    Some(ls.take_while(|l| !l.trim_start().starts_with(mark)).map(str::trim).find(|l| !l.is_empty()).unwrap_or("").to_string())
}

/// A block's Markdown → the thread it holds, when it is a thread block (```` ```thread ````, a thread's id or name).
pub fn thread_fence(block: &str) -> Option<String> {
    value_fence(block, "thread")
}

/// A block's Markdown → the Strong's number it holds, when it is a word block (```` ```word ````).
pub fn word_fence(block: &str) -> Option<String> {
    value_fence(block, "word")
}

/// A thread or word block as it is written.
pub fn value_fence_text(lang: &str, value: &str) -> String {
    format!("```{lang}\n{}\n```", value.trim())
}

/// A thread by the id or name a block holds: exact, else the one name that starts with it.
fn thread_by(store: &Store, held: &str) -> Option<crate::store::Rec> {
    let w = held.trim().to_lowercase();
    if w.is_empty() {
        return None;
    }
    let all = store.threads();
    all.iter().find(|t| s(t, "id").to_lowercase() == w || s(t, "name").to_lowercase() == w).map(|t| (*t).clone())
}

/// The thread a thread block holds (a thread's id, or its name).
pub fn thread_held(store: &Store, held: &str) -> Option<crate::store::Rec> {
    thread_by(store, held)
}

/// A page's thread blocks with what each shows (`wb page threads`): the block's number, the thread (its id, name, color,
/// how many places) and its first places' references. A thread that is gone says so.
pub fn threads(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(held) = thread_fence(&sub(&c, b.start, b.end)) else { continue };
        let mut v = json!({"n": i + 1, "held": held});
        match thread_by(store, &held) {
            None if held.is_empty() => v["error"] = json!("No thread yet: write its name under ```thread."),
            None => v["error"] = json!(format!("No thread called “{held}”.")),
            Some(t) => {
                let members: Vec<Value> = t["members"].as_array().cloned().unwrap_or_default();
                v["thread"] = t["id"].clone();
                v["name"] = t["name"].clone();
                v["color"] = json!(s(&t, "color"));
                v["count"] = json!(members.len());
                v["refs"] = json!(members.iter().take(4).map(|m| nb::label(bible, m["anchor"].as_str().unwrap_or(""))).collect::<Vec<_>>());
            }
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}

/// A page's word blocks with the lexicon's entry for each (`wb page words`): the block's number, the number, the word, its
/// sound, Strong's own words, the KJV's renderings and how often. Nothing of it is in the file.
pub fn words(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(held) = word_fence(&sub(&c, b.start, b.end)) else { continue };
        let strong = held.trim().to_uppercase();
        let mut v = json!({"n": i + 1, "held": held});
        if strong.is_empty() {
            v["error"] = json!("No number yet: write one under ```word, like H7065.");
        } else if !crate::lookup::is_strong(&strong) {
            v["error"] = json!(format!("“{held}” is not a Strong's number (H7065, G25)."));
        } else {
            match crate::lookup::strong(bible, &strong)? {
                None => v["error"] = json!(format!("The lexicon has no {strong}.")),
                Some(e) => {
                    v["strong"] = json!(strong);
                    for k in ["lemma", "translit", "pron", "definition", "usage", "occurrences"] {
                        v[k] = e.get(k).cloned().unwrap_or(Value::Null);
                    }
                    v["renderings"] = json!(e["renderings"].as_array().map(|a| a.iter().take(6).cloned().collect::<Vec<_>>()).unwrap_or_default());
                }
            }
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}

/// Write a thread or word block's value anew (checked first: a thread that exists, a Strong's number the lexicon has).
/// → the page's blocks, as `edit`.
pub fn set_value_block(bible: &Bible, store: &mut Store, id: &str, n: usize, lang: &str, value: &str) -> Result<Value> {
    let (_, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs.get(n).ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let md = sub(&c, b.start, b.end);
    if value_fence(&md, lang).is_none() {
        return Err(bad(format!("Block {} is not a {lang} block.", n + 1)));
    }
    let value = value.trim();
    let held = if lang == "thread" {
        let t = thread_by(store, value).ok_or_else(|| missing(format!("No thread called “{value}”.")))?;
        s(&t, "id")
    } else {
        let st = value.to_uppercase();
        if !crate::lookup::is_strong(&st) || crate::lookup::strong(bible, &st)?.is_none() {
            return Err(bad(format!("“{value}” is not a Strong's number the lexicon has (H7065, G25).")));
        }
        st
    };
    edit(bible, store, id, Edit::Set { n, count: 1, text: &value_fence_text(lang, &held) })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thread_and_word_blocks_hold_one_value() {
        assert_eq!(thread_fence("```thread\nphinehas\n```").as_deref(), Some("phinehas"));
        assert_eq!(word_fence("```word\n  H7065 \n```").as_deref(), Some("H7065"));
        assert_eq!(word_fence("```word\n```").as_deref(), Some(""));
        assert_eq!(thread_fence("```scripture\nNum 25:11\n```"), None);
        assert_eq!(word_fence("H7065"), None);
        assert_eq!(value_fence_text("word", " H7065 "), "```word\nH7065\n```");
    }

    #[test]
    fn a_scripture_fence_holds_a_reference_and_its_choices() {
        let f = scripture_fence("```scripture\nNum 25:10-13\n```").unwrap();
        assert_eq!(f, ScriptureFence { reference: "Num 25:10-13".into(), lines: false, ylt: false });
        let g = scripture_fence("```scripture\n  Ps 106:28-31 \nylt\nLines\n```").unwrap();
        assert_eq!((g.reference.as_str(), g.lines, g.ylt), ("Ps 106:28-31", true, true));
        assert_eq!(scripture_fence_text(&g), "```scripture\nPs 106:28-31\nlines\nylt\n```");
        assert_eq!(scripture_fence(&scripture_fence_text(&g)).unwrap(), g);
        assert_eq!(scripture_fence("```scripture\n```").unwrap().reference, "");
        assert!(scripture_fence("```view\nnotebook\n```").is_none());
        assert!(scripture_fence("Num 25:11").is_none());
    }

    fn kinds(t: &str, titled: bool) -> Vec<&'static str> {
        split(t, titled).1.iter().map(|b| b.kind).collect()
    }

    fn texts(t: &str) -> Vec<String> {
        let c = chars(t);
        split(t, true).1.iter().map(|b| sub(&c, b.start, b.end)).collect()
    }

    const PAGE: &str = "Lesson: Phinehas\n\n# Aim\nRead the chapter with the group.\nThen the psalm.\n\n- [x] Read it twice\n- [ ] List every use\n  of the word\n- [ ] Print the deck\n\n> a quote\n> two lines\n\n---\n\n| a | b |\n| --- | --- |\n\n```scripture\nNum 25:10-13\n```\n\n1. one\n2. two";

    #[test]
    fn a_page_reads_as_blocks() {
        assert_eq!(kinds(PAGE, true), ["heading", "paragraph", "todo", "todo", "todo", "quote", "divider", "table", "fence", "numbered", "numbered"]);
        let (title, bs) = split(PAGE, true);
        assert_eq!(sub(&chars(PAGE), title.unwrap().0, title.unwrap().1), "Lesson: Phinehas");
        assert_eq!(bs[2].checked, Some(true));
        assert_eq!(bs[3].checked, Some(false));
        assert_eq!(texts(PAGE)[3], "- [ ] List every use\n  of the word");
        assert_eq!(bs[8].lang, "scripture");
        assert_eq!(kinds("Title\nsecond line", true), ["paragraph"]);
        assert_eq!(kinds("just a day's words\n\n- one", false), ["paragraph", "item"]);
        assert!(split("", true).1.is_empty());
    }

    #[test]
    fn a_block_changed_added_removed() {
        let (t, n, k) = set(PAGE, true, 1, 1, "Read Numbers 25 with the group.").unwrap();
        assert!(t.contains("# Aim\nRead Numbers 25 with the group.\n\n- [x] Read it twice"));
        assert_eq!((n, k), (1, 1));
        // a blank line typed in a block makes two
        let (t2, n, k) = set(&t, true, 1, 1, "First part.\n\nSecond part.").unwrap();
        assert_eq!((n, k), (1, 2));
        assert_eq!(texts(&t2)[1..3], ["First part.", "Second part."]);
        // and set over both, they are one again
        let (t3, _, k) = set(&t2, true, 1, 2, "One again.").unwrap();
        assert_eq!(k, 1);
        assert_eq!(texts(&t3)[1], "One again.");
        // a to-do added after a to-do sits with it; a paragraph after a list item is apart by a blank line
        let (t4, n, _) = insert(PAGE, true, Some(2), "- [ ] A new one").unwrap();
        assert_eq!(n, 3);
        assert!(t4.contains("- [x] Read it twice\n- [ ] A new one\n- [ ] List every use"));
        let (t5, _, _) = insert(PAGE, true, Some(2), "A paragraph").unwrap();
        assert!(t5.contains("- [x] Read it twice\n\nA paragraph\n\n- [ ] List every use"));
        // removed: its neighbours meet
        let (t6, _, k) = set(PAGE, true, 3, 1, "").unwrap();
        assert_eq!(k, 0);
        assert!(t6.contains("- [x] Read it twice\n- [ ] Print the deck"));
        let (t7, _, _) = set(PAGE, true, 0, 2, "").unwrap();
        assert!(t7.starts_with("Lesson: Phinehas\n\n- [x] Read it twice"));
        let last = split(PAGE, true).1.len() - 1;
        let (t8, _, _) = set(PAGE, true, last, 1, "").unwrap();
        assert!(t8.ends_with("1. one"));
        // first, right under the title
        let (t9, n, _) = insert("Title\n\nBody", true, None, "# A heading").unwrap();
        assert_eq!((t9.as_str(), n), ("Title\n\n# A heading\n\nBody", 0));
        let (t10, _, _) = insert("Title", true, None, "Body").unwrap();
        assert_eq!(t10, "Title\n\nBody");
        assert!(set(PAGE, true, 99, 1, "x").is_err());
    }

    #[test]
    fn a_block_moved_and_a_to_do_ticked() {
        // the third to-do first among them
        let (t, at) = move_block(PAGE, true, 4, 2).unwrap();
        assert_eq!(at, 2);
        assert!(t.contains("- [ ] Print the deck\n- [x] Read it twice\n- [ ] List every use\n  of the word\n\n> a quote"));
        // the heading to the end
        let n = split(PAGE, true).1.len();
        let (t2, at) = move_block(PAGE, true, 0, n).unwrap();
        assert_eq!(at, n - 1);
        assert!(t2.ends_with("2. two\n\n# Aim") && t2.starts_with("Lesson: Phinehas\n\nRead the chapter"));
        assert_eq!(kinds(&t2, true).len(), n);
        let t3 = check(PAGE, true, 3, None).unwrap();
        assert!(t3.contains("- [x] List every use"));
        let t4 = check(&t3, true, 3, Some(false)).unwrap();
        assert_eq!(t4, PAGE);
        assert!(check(PAGE, true, 0, None).is_err());
        assert_eq!(retitle("# Old\n\nBody", "New").unwrap(), "# New\n\nBody");
        assert_eq!(retitle("Old\nBody", "New").unwrap(), "New\nBody");
    }
}

/// Ordinary physical Pages scope only; thread associations are never descendants.
pub(crate) fn deletion_layout(bible: &Bible, store: &Store, selected: &HashSet<String>, all: bool, pinned: bool, templates: bool, days: bool) -> Result<(Vec<String>, Vec<(String, Option<String>, usize)>)> {
    let t = Tree::read(bible, store);
    let mut ids: HashSet<String> = selected.clone();
    if all {
        ids.extend(t.all.iter().filter(|e| e["kind"] != "thread" && e["kind"] != "day" && t.in_tree(e) && (pinned || e["pinned"].is_null())).map(|e| id_of(e).to_string()));
        if templates { ids.extend(nb::every(bible, store).iter().filter(|e| nb::is_template(e) && (pinned || e["pinned"].is_null())).map(|e| id_of(e).to_string())); }
        if days { ids.extend(store.days().iter().map(|e| s(e, "id"))); }
    }
    for id in &ids { if crate::threadpage::slug_of(id).is_some() { return Err(bad("Thread records are excluded from page deletion.")); } store.find_note(id)?; }
    fn walk(t: &Tree, parent: Option<&str>, surviving_parent: Option<&str>, ids: &HashSet<String>, out: &mut HashMap<Option<String>, Vec<String>>) {
        for e in t.children(parent) {
            let id = id_of(e);
            if e["kind"] == "thread" { continue; }
            if ids.contains(id) { walk(t, Some(id), surviving_parent, ids, out); }
            else { out.entry(surviving_parent.map(String::from)).or_default().push(id.to_string()); walk(t, Some(id), Some(id), ids, out); }
        }
    }
    let mut lists = HashMap::new(); walk(&t, None, None, &ids, &mut lists);
    let mut changes = vec![];
    for (parent, list) in lists {
        let affected = list.iter().any(|id| t.parent_of(id) != parent.as_deref());
        if !affected { continue; }
        for (i, id) in list.into_iter().enumerate() { changes.push((id, parent.clone(), i + 1)); }
    }
    let mut ids: Vec<_> = ids.into_iter().collect(); ids.sort(); changes.sort_by(|a,b| a.0.cmp(&b.0));
    Ok((ids, changes))
}
