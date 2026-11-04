//! The Notebook (docs/PLAN-design.md section 3): one kind of note, seen three ways.
//!
//! - **Journal**: every note by the day it was written, newest day first: placed notes, notes with no place yet (the
//!   Inbox, `notes/_inbox/`), and questions.
//! - **Inbox**: the notes with no place yet, each with the place its text names, if it names one, to offer first.
//! - **All notes**: placed notes in Bible order, by book.
//!
//! Questions are trails (`trails/<id>.md`, the Python app's files, read as they are) and Inbox notes marked as questions.
//! Placing a note moves its file to `notes/<BOOK>/`; placing a question makes it a trail. Both keep the id and the day
//! they were written. Days are the computer's local days.

use crate::anchors::{py_parse, resolve};
use crate::bible::Bible;
use crate::commands::find_refs;
use crate::places::{parse_span, span_anchor, span_label};
use crate::store::{bad, missing, s, Rec, Store};
use crate::Result;
use chrono::{DateTime, Local, NaiveDate};
use serde_json::{json, Value};

/// When a note was written, on this computer's clock: (day, "14:02").
fn local(created: &str) -> Option<(NaiveDate, String)> {
    let t = DateTime::parse_from_rfc3339(created).ok()?.with_timezone(&Local);
    Some((t.date_naive(), t.format("%H:%M").to_string()))
}

fn label(bible: &Bible, anchor: &str) -> String {
    resolve(bible, anchor).map(|r| s(&r, "label")).unwrap_or_else(|_| anchor.to_string())
}

/// One line of the Notebook, whatever file it came from.
fn entry(bible: &Bible, r: &Rec, kind: &str, placed: bool) -> Value {
    let anchor = s(r, "anchor");
    let time = local(&s(r, "created")).map(|x| x.1).unwrap_or_default();
    let mut e = json!({
        "id": r["id"], "kind": kind, "placed": placed, "anchor": anchor,
        "label": if placed { label(bible, &anchor) } else { String::new() },
        "quote": s(r, "quote"), "text": s(r, "text"), "created": r["created"], "updated": r["updated"], "time": time,
        "refs": find_refs(&s(r, "text"), bible.books()),
    });
    if kind == "question" {
        e["status"] = json!(if s(r, "status") == "done" { "done" } else { "open" });
    }
    e
}

fn inbox_entries(bible: &Bible, store: &Store) -> Vec<Value> {
    store.inbox().into_iter().map(|n| entry(bible, n, if s(n, "kind") == "question" { "question" } else { "note" }, false)).collect()
}

/// Every entry: placed notes, the Inbox, and questions (trails).
fn every(bible: &Bible, store: &Store) -> Vec<Value> {
    let mut all: Vec<Value> = store.notes().into_iter().map(|n| entry(bible, n, "note", true)).collect();
    all.extend(inbox_entries(bible, store));
    all.extend(store.trails().into_iter().map(|t| entry(bible, t, "question", true)));
    all
}

/// The first place a note's text names (a verse or a run of verses), to offer when placing it.
pub fn named_place(bible: &Bible, text: &str) -> Option<Value> {
    find_refs(text, bible.books()).into_iter().find_map(|f| {
        let sp = parse_span(&f.place, bible.books()).ok()?;
        Some(json!({"anchor": span_anchor(&sp)?, "label": span_label(&sp)}))
    })
}

fn day_label(d: NaiveDate) -> String {
    d.format("%A %-d %B").to_string()
}

/// The Journal: days newest first, each with its entries newest first. `day` limits it to one day.
pub fn journal(bible: &Bible, store: &Store, day: Option<NaiveDate>) -> Result<Value> {
    let today = Local::now().date_naive();
    let mut all: Vec<(NaiveDate, Value)> = every(bible, store).into_iter().filter_map(|e| Some((local(e["created"].as_str()?)?.0, e))).collect();
    if let Some(d) = day {
        all.retain(|(x, _)| *x == d);
    }
    all.sort_by(|a, b| b.1["created"].as_str().cmp(&a.1["created"].as_str()));
    let mut days: Vec<Value> = vec![];
    for (d, e) in all {
        let key = d.to_string();
        if days.last().is_none_or(|x| x["day"] != key.as_str()) {
            days.push(json!({"day": key, "label": day_label(d), "today": d == today, "entries": []}));
        }
        days.last_mut().unwrap()["entries"].as_array_mut().unwrap().push(e);
    }
    Ok(json!({"days": days, "inbox": store.inbox().len()}))
}

/// The Inbox: notes with no place yet, newest first, each with the place its text names (`offer`), if any.
pub fn inbox(bible: &Bible, store: &Store) -> Result<Value> {
    let mut notes = inbox_entries(bible, store);
    notes.reverse();
    for n in &mut notes {
        n["offer"] = named_place(bible, n["text"].as_str().unwrap_or("")).unwrap_or(Value::Null);
    }
    Ok(json!({"notes": notes}))
}

/// Placed notes in Bible order, by book; notes on an original word everywhere come last. `filter`: every word must be
/// in the note or its place.
pub fn all_notes(bible: &Bible, store: &Store, filter: &str) -> Result<Value> {
    let words: Vec<String> = filter.to_lowercase().split_whitespace().map(String::from).collect();
    let mut rows: Vec<((u32, i64, i64, i64), String, String, Value)> = vec![];
    for n in store.notes() {
        let e = entry(bible, n, "note", true);
        let blob = format!("{} {} {}", s(n, "text"), e["label"].as_str().unwrap_or(""), s(n, "quote")).to_lowercase();
        if !words.iter().all(|w| blob.contains(w.as_str())) {
            continue;
        }
        let p = py_parse(&s(n, "anchor"))?;
        let num = |k: &str| p.get(k).and_then(|v| v.as_i64()).unwrap_or(-1);
        let (id, code, name) = if s(&p, "kind") == "lemma" {
            (1000, "_words".to_string(), "Original words".to_string())
        } else {
            let b = bible.book(&s(&p, "code"))?;
            (b.id, b.code.clone(), b.name.clone())
        };
        rows.push(((id, num("c1"), num("v1"), num("i1")), code, name, e));
    }
    rows.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.3["created"].as_str().cmp(&b.3["created"].as_str())));
    let mut books: Vec<Value> = vec![];
    for (_, code, name, e) in rows {
        if books.last().is_none_or(|b| b["code"] != code.as_str()) {
            books.push(json!({"code": code, "name": name, "notes": []}));
        }
        books.last_mut().unwrap()["notes"].as_array_mut().unwrap().push(e);
    }
    Ok(json!({"books": books}))
}

/// Questions: those waiting in the Inbox and the trails, newest first. `status`: open, done or all.
pub fn questions(bible: &Bible, store: &Store, status: &str) -> Result<Value> {
    if !["open", "done", "all"].contains(&status) {
        return Err(bad("Status must be open, done or all."));
    }
    let mut out: Vec<Value> = inbox_entries(bible, store).into_iter().filter(|e| e["kind"] == "question").collect();
    out.extend(store.trails().into_iter().map(|t| entry(bible, t, "question", true)));
    out.retain(|e| status == "all" || e["status"] == status);
    out.sort_by(|a, b| b["created"].as_str().cmp(&a["created"].as_str()));
    Ok(json!({"questions": out}))
}

/// An Inbox note by its id, else the one whose text is `part`, starts with it, or holds it (the capture box's way).
pub fn find_jot(store: &Store, part: &str) -> Result<String> {
    let all = store.inbox();
    if let Some(n) = all.iter().find(|n| s(n, "id") == part.trim()) {
        return Ok(s(n, "id"));
    }
    let q = part.trim().to_lowercase();
    let tiers: [&dyn Fn(&str) -> bool; 3] = [&|t| t == q, &|t| t.starts_with(&q), &|t| t.contains(&q)];
    for fits in tiers {
        let hit: Vec<&&Rec> = all.iter().filter(|n| fits(s(n, "text").trim().to_lowercase().as_str())).collect();
        match hit.len() {
            0 => continue,
            1 => return Ok(s(hit[0], "id")),
            _ => return Err(bad(format!("Which note? {} in the Inbox fit “{}”; give more of its words.", hit.len(), part.trim()))),
        }
    }
    Err(missing(format!("No note in the Inbox fits “{}”.", part.trim())))
}

/// Give an Inbox note its place (a verse, a run of verses, words, or H7065). → the placed note or question.
pub fn place(bible: &Bible, store: &mut Store, id: &str, anchor: &str) -> Result<Value> {
    let (a, kind, quote, strong) = resolved(bible, anchor)?;
    let question = store.inbox().iter().any(|n| s(n, "id") == id && s(n, "kind") == "question");
    let r = store.place_jot(id, &a, &kind, &quote, &strong)?;
    Ok(entry(bible, &r, if question { "question" } else { "note" }, true))
}

/// A placed note or question by its id: (is it a question, its anchor).
fn placed(store: &Store, id: &str) -> Result<(bool, String)> {
    if let Some(n) = store.notes().into_iter().find(|n| s(n, "id") == id) {
        return Ok((false, s(n, "anchor")));
    }
    store.trails().into_iter().find(|t| s(t, "id") == id).map(|t| (true, s(t, "anchor"))).ok_or_else(|| missing("No note or question with that id."))
}

fn resolved(bible: &Bible, anchor: &str) -> Result<(String, String, String, String)> {
    let res = resolve(bible, anchor)?;
    if res["ok"] != true {
        return Err(bad("That place is not in the text."));
    }
    let kind = s(&res, "kind");
    let strong = if kind == "word" || kind == "lemma" { res["strongs"].as_array().and_then(|a| a.first()).and_then(|x| x.as_str()).unwrap_or("").to_string() } else { String::new() };
    Ok((s(&res, "id"), kind, s(&res, "quote"), strong))
}

/// Give a placed note or question another place (an Inbox note is placed with `place`). → the moved entry.
pub fn move_to(bible: &Bible, store: &mut Store, id: &str, anchor: &str) -> Result<Value> {
    let (q, _) = placed(store, id)?;
    let (a, kind, quote, strong) = resolved(bible, anchor)?;
    let r = store.replace_placed(id, &a, &kind, &quote, &strong, None)?;
    Ok(entry(bible, &r, if q { "question" } else { "note" }, true))
}

/// Make a note a question or a question a plain note, wherever it is: in the Inbox, or at its place (a placed question
/// is a trail, so it moves between `notes/` and `trails/`). → the entry.
pub fn set_question(bible: &Bible, store: &mut Store, id: &str, question: bool) -> Result<Value> {
    if store.inbox().iter().any(|n| s(n, "id") == id) {
        let r = store.update_jot(id, None, Some(question))?;
        return Ok(entry(bible, &r, if question { "question" } else { "note" }, false));
    }
    let (_, anchor) = placed(store, id)?;
    let (a, kind, quote, strong) = resolved(bible, &anchor)?;
    let r = store.replace_placed(id, &a, &kind, &quote, &strong, Some(question))?;
    Ok(entry(bible, &r, if question { "question" } else { "note" }, true))
}

/// A question answered (`done`) or open again, in the Inbox or at its place. → the entry.
pub fn answer(bible: &Bible, store: &mut Store, id: &str, done: bool) -> Result<Value> {
    let status = if done { "done" } else { "open" };
    if store.inbox().iter().any(|n| s(n, "id") == id) {
        let r = store.set_jot_status(id, status)?;
        return Ok(entry(bible, &r, "question", false));
    }
    let r = store.set_trail_status(id, status)?;
    Ok(entry(bible, &r, "question", true))
}

/// A jot, with the place its text names (for the window to offer).
pub fn jot(bible: &Bible, store: &mut Store, text: &str, question: bool) -> Result<Value> {
    let r = store.jot(text, question)?;
    let mut e = entry(bible, &r, if question { "question" } else { "note" }, false);
    e["offer"] = named_place(bible, text).unwrap_or(Value::Null);
    Ok(e)
}

/// The open questions in a chapter, by verse (the reader shows a ? on their verse numbers).
pub fn chapter_questions(store: &Store, code: &str, chapter: u32) -> Vec<Value> {
    store
        .trails()
        .into_iter()
        .filter(|t| s(t, "status") == "open")
        .filter_map(|t| {
            let p = py_parse(&s(t, "anchor")).ok()?;
            let c = p.get("c1")?.as_u64()? as u32;
            (s(&p, "code") == code && c == chapter).then(|| json!({"id": t["id"], "v": p["v1"], "text": s(t, "text")}))
        })
        .collect()
}
