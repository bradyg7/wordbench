//! Views (W5 of "The Notebook as a workspace", 2026-11-07; sheet W4 of docs/workspace-design.md): a list kept up to
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
fn places(e: &Value) -> Vec<String> {
    let mut v: Vec<String> = vec![];
    if let Some(a) = e["anchor"].as_str().filter(|a| !a.is_empty()) {
        v.push(a.to_string());
    }
    v.extend(e["also"].as_array().into_iter().flatten().filter_map(|a| a["anchor"].as_str()).map(String::from));
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
    if !q.words.is_empty() {
        all.retain(|e| nb::words_in(e, &q.words));
    }
    if let Some(st) = &q.questions {
        all.retain(|e| e["kind"] == "question" && (st == "all" || (st == "open") == (e["status"] != "done")));
    }
    if q.pages {
        all.retain(|e| e["placed"] == false && e["kind"] != "day");
    }
    if let Some(name) = &q.thread {
        let t = store
            .threads()
            .into_iter()
            .find(|t| crate::store::s(t, "name").eq_ignore_ascii_case(name) || crate::store::s(t, "id") == *name)
            .ok_or_else(|| bad(format!("No thread called “{name}” (wb thread list names them).")))?;
        let id = crate::store::s(t, "id");
        all.retain(|e| e["threads"].as_array().into_iter().flatten().any(|x| x["id"] == id.as_str()));
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
                if places(&e).iter().any(|p| p.eq_ignore_ascii_case(&want)) {
                    hits.push(((0, 0, 0, 0), e));
                }
            }
        }
        Some((book, lo, hi)) => {
            for e in all {
                let at = places(&e).iter().filter_map(|p| Some((p.clone(), reach(bible, p)?))).find(|(_, (b, s, t))| *b == book && *s <= hi && *t >= lo);
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

/// A block's Markdown → its view's line, when it is one (```` ```view ````, the line inside; empty when none yet).
pub fn view_fence(block: &str) -> Option<String> {
    let mut ls = block.lines();
    let first = ls.next()?.trim_start();
    let mark = ["```", "~~~"].into_iter().find(|m| first.starts_with(m))?;
    if !first[3..].trim().split_whitespace().next().is_some_and(|w| w.eq_ignore_ascii_case("view")) {
        return None;
    }
    Some(ls.take_while(|l| !l.trim_start().starts_with(mark)).map(str::trim).find(|l| !l.is_empty()).unwrap_or("").to_string())
}

/// A page's views with what each finds now (`wb page views`), as the window draws them: each block's number (from 1, as
/// `wb page blocks` counts), its line, and its rows; a line that cannot be read, or holds a blank of a template
/// (`{place}`), says so instead.
pub fn page_views(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = pages::text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(line) = view_fence(&sub(&c, b.start, b.end)) else { continue };
        let mut v = json!({"n": i + 1, "line": line});
        if line.is_empty() {
            v["error"] = json!("No line yet: write one, like notebook @Num 25 questions.");
        } else if ["{place}", "{date}", "{title}", "{reader}"].iter().any(|k| line.contains(k)) {
            v["blank"] = json!(true);
            v["error"] = json!("A template's blank: filled when a page is made from it.");
        } else {
            match run(bible, store, &line) {
                Ok(r) => {
                    v["query"] = r["query"].clone();
                    v["count"] = r["count"].clone();
                    v["rows"] = r["rows"].clone();
                }
                Err(e) => v["error"] = json!(e.0),
            }
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}

/// Change a view's line (block `n`, from 0): the line is read first, so a line that cannot be read is not written. The
/// fence is written anew with it. → the page's blocks, as `pages::edit`.
pub fn set_line(bible: &Bible, store: &mut Store, id: &str, n: usize, line: &str) -> Result<Value> {
    let line = line.trim();
    if line.contains('\n') {
        return Err(bad("A view's line is one line."));
    }
    if !line.contains('{') {
        view_line(line, bible.books()).map_err(bad)?;
    }
    let (_, text, titled) = pages::text_of(store, id)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs.get(n).ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    view_fence(&sub(&c, b.start, b.end)).ok_or_else(|| bad(format!("Block {} is not a view.", n + 1)))?;
    pages::edit(bible, store, id, Edit::Set { n, count: 1, text: &format!("```view\n{line}\n```") })
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
