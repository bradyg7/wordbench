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
//!
//! Phase 2b (design B, docs/phase2b-design.md section 7): the Notebook is a list and an editor. The list is grouped by
//! day (today's page first: one note per day, `notes/_days/<day>.md`), by chapter (following the reader), by thread, or
//! not at all (`list`). A note's title is its first line. A place can be a verse, words, a run of verses, a whole
//! chapter or a whole book (a chapter is the run of its verses, `NUM.25:1-25:18`, so the Python app reads it).
//! `[[title]]` and `[[title#heading]]` in a note link to another note (`links`, `backlinks`, `relink`).

use crate::anchors::{py_parse, resolve};
use crate::bible::Bible;
use crate::commands::find_refs;
use crate::places::{parse_span, span_anchor, span_label};
use crate::store::{bad, missing, places_of, s, threads_of, Rec, Store};
use crate::Result;
use chrono::{DateTime, Local, NaiveDate};
use serde_json::{json, Value};

/// When a note was written, on this computer's clock: (day, "14:02").
fn local(created: &str) -> Option<(NaiveDate, String)> {
    let t = DateTime::parse_from_rfc3339(created).ok()?.with_timezone(&Local);
    Some((t.date_naive(), t.format("%H:%M").to_string()))
}

fn label(bible: &Bible, anchor: &str) -> String {
    if let Some((name, _)) = whole_place(bible, anchor) {
        return name;
    }
    resolve(bible, anchor).map(|r| s(&r, "label")).unwrap_or_else(|_| anchor.to_string())
}

/// A run of verses that is a whole chapter (or chapters) or a whole book, as the Notebook names it: ("Numbers 25",
/// "chapter"), ("Numbers 25–26", "chapter"), ("Numbers", "book"); None for any other place.
pub fn whole_place(bible: &Bible, anchor: &str) -> Option<(String, &'static str)> {
    let a = crate::anchors::parse(anchor).ok()?;
    if !matches!(a.kind, crate::anchors::Kind::Verses | crate::anchors::Kind::Verse) || a.v1 != 1 {
        return None;
    }
    let (c2, v2) = (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1));
    if bible.last_verse(&a.code, c2).ok()? != v2 {
        return None;
    }
    let b = bible.book(&a.code).ok()?;
    if a.c1 == 1 && c2 == b.chapters {
        return Some((b.name.clone(), "book"));
    }
    Some((if a.c1 == c2 { format!("{} {}", b.name, a.c1) } else { format!("{} {}–{c2}", b.name, a.c1) }, "chapter"))
}

/// A place as typed for a note, chapters and books included: "Num 25:11", "Num 25:7-13", "NUM.25:11.24", "H7065",
/// "Numbers 25" (→ NUM.25:1-25:18), "Numbers" (→ NUM.1:1-36:13). (`wb note add` keeps the Python app's verses-only rule.)
pub fn place_anchor(bible: &Bible, text: &str) -> Result<String> {
    let t = text.trim();
    let up = t.to_uppercase();
    if (up.starts_with('H') || up.starts_with('G')) && up.len() <= 6 && up.len() > 1 && up[1..].bytes().all(|b| b.is_ascii_digit()) {
        return Ok(up);
    }
    if let Ok(a) = crate::anchors::parse(t) {
        return Ok(a.id());
    }
    let sp = parse_span(t, bible.books())?;
    if let Some(a) = span_anchor(&sp) {
        return Ok(a);
    }
    let v1 = if sp.v1 == 0 { 1 } else { sp.v1 };
    let v2 = if sp.v2 == 0 { bible.last_verse(&sp.book.code, sp.c2)? } else { sp.v2 };
    Ok(format!("{}.{}:{v1}-{}:{v2}", sp.book.code, sp.c1, sp.c2))
}

/// A note's title: its first line, without a heading's #s.
pub fn title_of(text: &str) -> String {
    let first = text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    let t = first.trim_start_matches('#').trim();
    if t.chars().count() > 90 {
        let cut: String = t.chars().take(88).collect();
        return format!("{}…", cut.rsplit_once(' ').map(|x| x.0).unwrap_or(&cut));
    }
    t.to_string()
}

/// What follows a note's title, as one short line with the Markdown marks left out.
fn preview_of(text: &str, skip_title: bool) -> String {
    let mut lines = text.lines().map(str::trim).filter(|l| !l.is_empty());
    if skip_title {
        lines.next();
    }
    let joined = lines
        .map(|l| l.trim_start_matches(['#', '>']).trim_start())
        .map(|l| l.strip_prefix("- ").or_else(|| l.strip_prefix("* ")).unwrap_or(l))
        .collect::<Vec<_>>()
        .join(" ")
        .replace("**", "")
        .replace("[[", "")
        .replace("]]", "");
    if joined.chars().count() > 140 {
        return format!("{}…", joined.chars().take(138).collect::<String>().trim_end());
    }
    joined
}

/// One line of the Notebook, whatever file it came from. A note on a thread with no place in the text counts as placed
/// (the thread is its place); `also` and `threads` list the note's other places and its threads.
fn entry_in(bible: &Bible, store: &Store, r: &Rec, kind: &str, placed: bool) -> Value {
    let mut e = entry(bible, r, kind, placed);
    let also: Vec<Value> = places_of(r).into_iter().skip(1).map(|a| json!({"anchor": a, "label": label(bible, &a)})).collect();
    let threads: Vec<Value> = threads_of(r)
        .into_iter()
        .map(|t| json!({"id": t, "name": store.thread(&t).map(|x| s(&x, "name")).unwrap_or_else(|_| t.clone())}))
        .collect();
    if s(r, "anchor").is_empty() && !threads.is_empty() {
        e["label"] = json!(format!("On {}", threads.iter().map(|t| t["name"].as_str().unwrap_or("")).collect::<Vec<_>>().join(", ")));
    }
    e["also"] = json!(also);
    e["threads"] = json!(threads);
    e
}

fn entry(bible: &Bible, r: &Rec, kind: &str, placed: bool) -> Value {
    let anchor = s(r, "anchor");
    let time = local(&s(r, "created")).map(|x| x.1).unwrap_or_default();
    let mut e = json!({
        "id": r["id"], "kind": kind, "placed": placed, "anchor": anchor,
        "label": if placed && !anchor.is_empty() { label(bible, &anchor) } else { String::new() },
        "quote": s(r, "quote"), "text": s(r, "text"), "created": r["created"], "updated": r["updated"], "time": time,
        "refs": find_refs(&s(r, "text"), bible.books()),
        "title": title_of(&s(r, "text")), "preview": preview_of(&s(r, "text"), true),
        "whole": whole_place(bible, &anchor).map(|w| w.1).unwrap_or(""),
        "day": local(&s(r, "created")).map(|x| x.0.to_string()).unwrap_or_default(),
    });
    if kind == "question" {
        e["status"] = json!(if s(r, "status") == "done" { "done" } else { "open" });
    }
    e
}

fn inbox_entries(bible: &Bible, store: &Store) -> Vec<Value> {
    store.inbox().into_iter().map(|n| entry_in(bible, store, n, if s(n, "kind") == "question" { "question" } else { "note" }, false)).collect()
}

/// Every entry: placed notes, notes on threads, the Inbox, and questions (trails).
fn every(bible: &Bible, store: &Store) -> Vec<Value> {
    let mut all: Vec<Value> = store.notes().into_iter().map(|n| entry_in(bible, store, n, "note", true)).collect();
    all.extend(store.on_thread().into_iter().map(|n| entry_in(bible, store, n, "note", true)));
    all.extend(inbox_entries(bible, store));
    all.extend(store.trails().into_iter().map(|t| entry_in(bible, store, t, "question", true)));
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
        let e = entry_in(bible, store, n, "note", true);
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
    // notes on a thread with no place in the text come last, together
    let loose: Vec<Value> = store
        .on_thread()
        .into_iter()
        .filter(|n| words.iter().all(|w| s(n, "text").to_lowercase().contains(w.as_str())))
        .map(|n| entry_in(bible, store, n, "note", true))
        .collect();
    if !loose.is_empty() {
        books.push(json!({"code": "_threads", "name": "Notes on threads", "notes": loose}));
    }
    Ok(json!({"books": books}))
}

/// Questions: those waiting in the Inbox and the trails, newest first. `status`: open, done or all.
pub fn questions(bible: &Bible, store: &Store, status: &str) -> Result<Value> {
    if !["open", "done", "all"].contains(&status) {
        return Err(bad("Status must be open, done or all."));
    }
    let mut out: Vec<Value> = inbox_entries(bible, store).into_iter().filter(|e| e["kind"] == "question").collect();
    out.extend(store.trails().into_iter().map(|t| entry_in(bible, store, t, "question", true)));
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

/// The notes on a thread, oldest first: those written on it with no place, and placed notes and questions put on it.
pub fn thread_notes(bible: &Bible, store: &Store, thread_id: &str) -> Result<Value> {
    let t = store.thread(thread_id)?;
    let on = |n: &&Rec| threads_of(n).iter().any(|x| x == thread_id);
    let mut out: Vec<Value> = store.notes().into_iter().filter(on).map(|n| entry_in(bible, store, n, "note", true)).collect();
    out.extend(store.on_thread().into_iter().filter(on).map(|n| entry_in(bible, store, n, "note", true)));
    out.extend(store.trails().into_iter().filter(on).map(|n| entry_in(bible, store, n, "question", true)));
    out.extend(store.inbox().into_iter().filter(on).map(|n| entry_in(bible, store, n, "question", false)));
    out.sort_by(|a, b| a["created"].as_str().cmp(&b["created"].as_str()));
    Ok(json!({"id": t["id"], "name": t["name"], "notes": out}))
}

/// Write a note on a thread, with no place in the text. → the entry.
pub fn write_on_thread(bible: &Bible, store: &mut Store, thread_id: &str, text: &str) -> Result<Value> {
    let r = store.add_thread_note(thread_id, text)?;
    Ok(entry_in(bible, store, &r, "note", true))
}

/// Put any note or question on a thread, or take it off. → the entry.
pub fn on_thread(bible: &Bible, store: &mut Store, id: &str, thread_id: &str, on: bool) -> Result<Value> {
    let r = store.set_note_thread(id, thread_id, on)?;
    let question = s(&r, "kind") == "question" || r.contains_key("status");
    let placed = !s(&r, "anchor").is_empty() || !threads_of(&r).is_empty();
    Ok(entry_in(bible, store, &r, if question { "question" } else { "note" }, placed))
}

/// Give a placed note one more place, or take one away (`on`). → the entry.
pub fn also_at(bible: &Bible, store: &mut Store, id: &str, anchor: &str, on: bool) -> Result<Value> {
    let (a, _, _, _) = if on { resolved(bible, anchor)? } else { (crate::anchors::canonical(anchor)?, String::new(), String::new(), String::new()) };
    let r = store.set_note_also(id, &a, on)?;
    Ok(entry_in(bible, store, &r, "note", true))
}

/// Take a place off a placed note or question, its first place too: the next of its places becomes its place, and its
/// last place taken off sends it to the Inbox. → the entry.
pub fn unplace(bible: &Bible, store: &mut Store, id: &str, anchor: &str) -> Result<Value> {
    let (q, _) = placed(store, id)?;
    let want = crate::anchors::canonical(anchor)?;
    let places: Vec<String> = store.notes().into_iter().chain(store.trails()).find(|n| s(n, "id") == id).map(places_of).unwrap_or_default();
    let at = places.iter().find(|p| crate::anchors::canonical(p).is_ok_and(|c| c == want)).cloned().ok_or_else(|| missing("The note is not on that place."))?;
    let next = if places.first() == Some(&at) && places.len() > 1 { Some(resolved(bible, &places[1])?) } else { None };
    let r = store.unplace(id, &at, next.as_ref().map(|(a, k, qu, st)| (a.as_str(), k.as_str(), qu.as_str(), st.as_str())))?;
    let placed = !s(&r, "anchor").is_empty() || !threads_of(&r).is_empty();
    Ok(entry_in(bible, store, &r, if q { "question" } else { "note" }, placed))
}

/// Change the text of any note or question, wherever it is. → the entry.
pub fn edit_text(bible: &Bible, store: &mut Store, id: &str, text: &str) -> Result<Value> {
    if store.inbox().iter().any(|n| s(n, "id") == id) {
        let r = store.update_jot(id, Some(text), None)?;
        let q = s(&r, "kind") == "question";
        return Ok(entry_in(bible, store, &r, if q { "question" } else { "note" }, false));
    }
    if store.on_thread().iter().any(|n| s(n, "id") == id) {
        let r = store.update_thread_note(id, text)?;
        return Ok(entry_in(bible, store, &r, "note", true));
    }
    if store.trails().iter().any(|n| s(n, "id") == id) {
        let r = store.update_trail(id, text)?;
        return Ok(entry_in(bible, store, &r, "question", true));
    }
    if let Some(day) = store.days().into_iter().find(|n| s(n, "id") == id).map(|n| s(n, "day")) {
        if text.trim().is_empty() {
            return Err(bad("A page needs some text. To remove it, delete the page."));
        }
        let r = store.write_day(&day, text, false)?.ok_or_else(|| bad("The page is empty."))?;
        return Ok(day_entry(bible, &r));
    }
    let r = store.update_note(id, text)?;
    Ok(entry_in(bible, store, &r, "note", true))
}

/// The deleted notes and questions waiting in .trash, with how many days each has left.
pub fn trash(store: &Store) -> Value {
    json!({"days": crate::store::TRASH_DAYS, "notes": store.trashed()})
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
    // a whole chapter or book keeps no copy of its text in the note's header
    let quote = if whole_place(bible, &s(&res, "id")).is_some() { String::new() } else { s(&res, "quote") };
    Ok((s(&res, "id"), kind, quote, strong))
}

/// Give a placed note or question another place (an Inbox note is placed with `place`). → the moved entry.
pub fn move_to(bible: &Bible, store: &mut Store, id: &str, anchor: &str) -> Result<Value> {
    let (q, _) = placed(store, id)?;
    let (a, kind, quote, strong) = resolved(bible, anchor)?;
    let r = store.replace_placed(id, &a, &kind, &quote, &strong, None)?;
    Ok(entry_in(bible, store, &r, if q { "question" } else { "note" }, true))
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

// ---- today's page: one note per day (notes/_days/<day>.md) --------------------------------------------------------

/// A day's page as a line of the Notebook: titled by its day ("Wednesday 4 November"), with no place.
fn day_entry(bible: &Bible, r: &Rec) -> Value {
    let day = s(r, "day");
    let d = NaiveDate::parse_from_str(&day, "%Y-%m-%d").ok();
    let text = s(r, "text");
    json!({
        "id": r["id"], "kind": "day", "placed": false, "anchor": "", "label": "", "day": day, "exists": true,
        "today": d == Some(Local::now().date_naive()),
        "title": d.map(day_label).unwrap_or_else(|| day.clone()), "preview": preview_of(&text, false),
        "text": text, "created": r["created"], "updated": r["updated"], "time": local(&s(r, "updated")).map(|x| x.1).unwrap_or_default(),
        "refs": find_refs(&s(r, "text"), bible.books()), "also": [], "threads": [], "whole": "",
    })
}

/// A day's page not written in yet: shown so it can be, and made the first time it is.
fn day_blank(d: NaiveDate) -> Value {
    json!({"id": "", "kind": "day", "placed": false, "anchor": "", "label": "", "day": d.to_string(), "exists": false,
        "today": d == Local::now().date_naive(), "title": day_label(d), "preview": "", "text": "", "created": "", "updated": "",
        "time": "", "refs": [], "also": [], "threads": [], "whole": ""})
}

fn parse_day(day: Option<&str>) -> Result<NaiveDate> {
    match day.map(str::trim).filter(|d| !d.is_empty() && *d != "today") {
        None => Ok(Local::now().date_naive()),
        Some(d) => NaiveDate::parse_from_str(d, "%Y-%m-%d").map_err(|_| bad("A day looks like 2026-11-04.")),
    }
}

/// A day's page (today when no day is given), or the blank page it would be.
pub fn day_page(bible: &Bible, store: &Store, day: Option<&str>) -> Result<Value> {
    let d = parse_day(day)?;
    let mut e = store.day(&d.to_string()).map(|r| day_entry(bible, r)).unwrap_or_else(|| day_blank(d));
    add_links(bible, store, &mut e);
    Ok(e)
}

/// Write on a day's page (today when no day is given): `append` adds a paragraph after what is there, else the text
/// replaces the page. The page is made the first time; emptied, it goes to .trash.
pub fn write_day(bible: &Bible, store: &mut Store, day: Option<&str>, text: &str, append: bool) -> Result<Value> {
    let d = parse_day(day)?;
    Ok(match store.write_day(&d.to_string(), text, append)? {
        Some(r) => day_entry(bible, &r),
        None => day_blank(d),
    })
}

/// Delete a day's page (to .trash).
pub fn delete_day(store: &mut Store, day: Option<&str>) -> Result<Value> {
    let d = parse_day(day)?;
    store.delete_day(&d.to_string())?;
    Ok(json!({"ok": true, "day": d.to_string()}))
}

// ---- the list: grouped by day, chapter, thread or not at all -------------------------------------------------------

/// How the Notebook's list is asked for.
#[derive(Default)]
pub struct Listing {
    /// day, chapter, thread or none.
    pub group: String,
    /// Every word must be in the note's text, title, places or threads.
    pub search: String,
    /// Grouped by chapter: the chapter the reader shows (following the reader); None lists every chapter.
    pub at: Option<(String, u32)>,
    /// The notes with no place yet as a group of their own, first.
    pub inbox_apart: bool,
    /// Only questions.
    pub questions: bool,
    /// Today's page (and the days' pages).
    pub days: bool,
}

/// Every line of the Notebook: notes, questions, the Inbox, and (`days`) the days' pages.
fn all_lines(bible: &Bible, store: &Store, days: bool) -> Vec<Value> {
    let mut all = every(bible, store);
    if days {
        all.extend(store.days().into_iter().map(|r| day_entry(bible, r)));
    }
    all
}

fn words_in(e: &Value, words: &[String]) -> bool {
    if words.is_empty() {
        return true;
    }
    let mut blob = format!("{} {} {}", e["title"].as_str().unwrap_or(""), e["text"].as_str().unwrap_or(""), e["label"].as_str().unwrap_or(""));
    for a in e["also"].as_array().into_iter().flatten() {
        blob += &format!(" {}", a["label"].as_str().unwrap_or(""));
    }
    for t in e["threads"].as_array().into_iter().flatten() {
        blob += &format!(" {}", t["name"].as_str().unwrap_or(""));
    }
    let blob = blob.to_lowercase();
    words.iter().all(|w| blob.contains(w.as_str()))
}

fn group(key: &str, label: &str, entries: Vec<Value>) -> Value {
    json!({"key": key, "label": label, "count": entries.len(), "entries": entries})
}

fn push_into(groups: &mut Vec<Value>, key: &str, head: Value, e: Value) {
    if groups.last().is_none_or(|g| g["key"] != key) {
        groups.push(head);
    }
    let g = groups.last_mut().unwrap();
    g["entries"].as_array_mut().unwrap().push(e);
    g["count"] = json!(g["entries"].as_array().unwrap().len());
}

fn newest_first(v: &mut [Value], field: &str) {
    v.sort_by(|a, b| b[field].as_str().cmp(&a[field].as_str()));
}

/// Every place of an entry (its first, then `also`).
fn places_in(e: &Value) -> Vec<String> {
    let mut v = vec![];
    if !e["anchor"].as_str().unwrap_or("").is_empty() {
        v.push(e["anchor"].as_str().unwrap().to_string());
    }
    v.extend(e["also"].as_array().into_iter().flatten().filter_map(|a| a["anchor"].as_str()).map(String::from));
    v
}

/// The Notebook's list (design B): groups of entries, each entry with its title, a line of what follows, its places
/// and threads. By day: newest day first, each day's page at the top of its day (today's shown blank until written).
/// By chapter, following the reader (`at`): the chapter's notes in verse order, the book's and the chapter's own at the
/// top; with no chapter given, every chapter in Bible order, then the notes on original words. By thread: each
/// thread's notes, oldest first, then those on no thread. None: everything, the most recently changed first.
pub fn list(bible: &Bible, store: &Store, o: &Listing) -> Result<Value> {
    let words: Vec<String> = o.search.to_lowercase().split_whitespace().map(String::from).collect();
    let mut all: Vec<Value> = all_lines(bible, store, o.days).into_iter().filter(|e| words_in(e, &words)).collect();
    if o.questions {
        all.retain(|e| e["kind"] == "question");
    }
    let mut groups: Vec<Value> = vec![];
    if o.inbox_apart {
        let (mut inbox, rest): (Vec<Value>, Vec<Value>) = all.into_iter().partition(|e| e["placed"] == false && e["kind"] != "day");
        all = rest;
        newest_first(&mut inbox, "created");
        if !inbox.is_empty() {
            groups.push(group("_inbox", "Inbox", inbox));
        }
    }
    let today = Local::now().date_naive();
    match o.group.as_str() {
        "day" | "" => {
            let mut by: Vec<(NaiveDate, Value)> = all
                .into_iter()
                .filter_map(|e| {
                    let d = if e["kind"] == "day" { NaiveDate::parse_from_str(e["day"].as_str()?, "%Y-%m-%d").ok()? } else { local(e["created"].as_str()?)?.0 };
                    Some((d, e))
                })
                .collect();
            let blank = o.days && words.is_empty() && !o.questions && !by.iter().any(|(d, e)| *d == today && e["kind"] == "day");
            if blank {
                by.push((today, day_blank(today)));
            }
            // newest day first; in a day its page first, then newest first
            by.sort_by(|a, b| {
                b.0.cmp(&a.0).then_with(|| (b.1["kind"] == "day").cmp(&(a.1["kind"] == "day"))).then_with(|| b.1["created"].as_str().cmp(&a.1["created"].as_str()))
            });
            for (d, e) in by {
                let key = d.to_string();
                let head = json!({"key": key, "label": day_label(d), "today": d == today, "count": 0, "entries": []});
                push_into(&mut groups, &key, head, e);
            }
        }
        "chapter" => {
            // each place's chapter (0: the whole book) → the entry, with its order in the chapter: the book's notes, the
            // chapter's, then by verse and word. A note on several chapters shows in each.
            let mut rows: Vec<((u32, u32), (u8, u32, u32), String, Value)> = vec![];
            let mut on_words: Vec<Value> = vec![];
            for e in all.into_iter().filter(|e| e["kind"] != "day") {
                let mut seen: Vec<(u32, u32)> = vec![];
                let mut lemma = false;
                for p in places_in(&e) {
                    let Ok(a) = crate::anchors::parse(&p) else { continue };
                    if a.kind == crate::anchors::Kind::Lemma {
                        lemma = true;
                        continue;
                    }
                    let Ok(b) = bible.book(&a.code) else { continue };
                    let whole = whole_place(bible, &p).map(|w| w.1);
                    let chapters: Vec<u32> = if whole == Some("book") { vec![0] } else { (a.c1..=a.last_chapter()).collect() };
                    for c in chapters {
                        if let Some((code, ch)) = &o.at {
                            if *code != b.code || (c != 0 && c != *ch) {
                                continue;
                            }
                        }
                        if seen.contains(&(b.id, c)) {
                            continue;
                        }
                        seen.push((b.id, c));
                        let label = if c == 0 { b.name.clone() } else { format!("{} {c}", b.name) };
                        let order = match whole {
                            Some("book") => (0, 0, 0),
                            Some(_) => (1, 0, 0),
                            None if c == a.c1 => (2, a.v1, a.i1.unwrap_or(0)),
                            None => (2, 0, 0),
                        };
                        rows.push(((b.id, c), order, label, e.clone()));
                    }
                }
                if lemma && o.at.is_none() && seen.is_empty() {
                    on_words.push(e);
                }
            }
            if let Some((code, ch)) = &o.at {
                let b = bible.book(code)?;
                rows.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.3["created"].as_str().cmp(&b.3["created"].as_str())));
                let entries: Vec<Value> = rows.into_iter().map(|r| r.3).collect();
                groups.push(json!({"key": format!("{code}.{ch}"), "label": format!("{} {ch}", b.name), "following": true, "count": entries.len(), "entries": entries}));
            } else {
                rows.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)).then_with(|| a.3["created"].as_str().cmp(&b.3["created"].as_str())));
                for (k, _, label, e) in rows {
                    let key = format!("{}.{}", k.0, k.1);
                    let head = json!({"key": key, "label": label, "count": 0, "entries": []});
                    push_into(&mut groups, &key, head, e);
                }
                if !on_words.is_empty() {
                    groups.push(group("_words", "Original words", on_words));
                }
            }
        }
        "thread" => {
            let mut rest: Vec<Value> = all.into_iter().filter(|e| e["kind"] != "day").collect();
            for t in store.threads() {
                let id = s(t, "id");
                let mut on: Vec<Value> = rest.iter().filter(|e| e["threads"].as_array().into_iter().flatten().any(|x| x["id"] == id.as_str())).cloned().collect();
                if on.is_empty() {
                    continue;
                }
                on.sort_by(|a, b| a["created"].as_str().cmp(&b["created"].as_str()));
                groups.push(json!({"key": id, "label": s(t, "name"), "color": t.get("color").cloned().unwrap_or(Value::Null), "count": on.len(), "entries": on}));
            }
            rest.retain(|e| e["threads"].as_array().is_none_or(|a| a.is_empty()));
            newest_first(&mut rest, "created");
            if !rest.is_empty() {
                groups.push(group("_none", "On no thread", rest));
            }
        }
        "none" => {
            newest_first(&mut all, "updated");
            groups.push(group("_all", "All notes", all));
        }
        other => return Err(bad(format!("Group by day, chapter, thread or none (not “{other}”)."))),
    }
    Ok(json!({"group": if o.group.is_empty() { "day" } else { o.group.as_str() }, "groups": groups, "inbox": store.inbox().len()}))
}

// ---- links: [[title]] and [[title#heading]] in a note's text ------------------------------------------------------

/// A `[[link]]` in a text: where it is (in characters), the title and heading it names, and what it shows.
struct Link {
    start: usize,
    end: usize,
    title: String,
    heading: String,
    shown: String,
}

/// The `[[links]]` in a text, in order: `[[title]]`, `[[title#heading]]`, `[[title|shown]]` (as Obsidian writes them).
fn links_in(text: &str) -> Vec<Link> {
    let c: Vec<char> = text.chars().collect();
    let mut out = vec![];
    let mut i = 0;
    while i + 1 < c.len() {
        if c[i] == '[' && c[i + 1] == '[' {
            if let Some(len) = c[i + 2..].windows(2).position(|w| w == [']', ']']) {
                let inner: String = c[i + 2..i + 2 + len].iter().collect();
                if !inner.trim().is_empty() && !inner.contains('\n') && !inner.contains('[') {
                    let (target, shown) = match inner.split_once('|') {
                        Some((a, b)) => (a.to_string(), b.trim().to_string()),
                        None => (inner.clone(), String::new()),
                    };
                    let (title, heading) = match target.split_once('#') {
                        Some((a, b)) => (a.trim().to_string(), b.trim().to_string()),
                        None => (target.trim().to_string(), String::new()),
                    };
                    out.push(Link { start: i, end: i + 4 + len, title, heading, shown });
                    i += 4 + len;
                    continue;
                }
            }
        }
        i += 1;
    }
    out
}

/// The headings in a note's text (`# …`, `## …`), in order.
fn headings_of(text: &str) -> Vec<String> {
    text.lines().filter(|l| l.starts_with('#')).map(|l| l.trim_start_matches('#').trim().to_string()).filter(|h| !h.is_empty()).collect()
}

/// Every title a link can name → the line it names: a note by its title; a day's page by its day (2026-11-04) and its
/// title. Where two notes share a title, the older is the one named.
fn titles(all: &[Value]) -> Vec<(String, Value)> {
    let mut all: Vec<&Value> = all.iter().collect();
    all.sort_by(|a, b| a["created"].as_str().cmp(&b["created"].as_str()));
    let mut out: Vec<(String, Value)> = vec![];
    for e in all {
        let mut keys = vec![e["title"].as_str().unwrap_or("").to_lowercase()];
        if e["kind"] == "day" {
            keys.push(e["day"].as_str().unwrap_or("").to_string());
        }
        for k in keys.into_iter().filter(|k| !k.is_empty()) {
            if !out.iter().any(|(t, _)| *t == k) {
                out.push((k, e.clone()));
            }
        }
    }
    out
}

fn named<'a>(index: &'a [(String, Value)], title: &str) -> Option<&'a Value> {
    let t = title.trim().to_lowercase();
    index.iter().find(|(k, _)| *k == t).map(|x| &x.1)
}

fn link_values(text: &str, index: &[(String, Value)]) -> Vec<Value> {
    links_in(text)
        .into_iter()
        .map(|l| {
            let to = named(index, &l.title);
            let heading_ok = l.heading.is_empty() || to.is_some_and(|t| headings_of(t["text"].as_str().unwrap_or("")).iter().any(|h| h.eq_ignore_ascii_case(&l.heading)));
            json!({"start": l.start, "end": l.end, "title": l.title, "heading": l.heading, "shown": l.shown,
                "to": to.map(|t| t["id"].clone()).unwrap_or(Value::Null), "kind": to.map(|t| t["kind"].clone()).unwrap_or(Value::Null),
                "heading_ok": heading_ok})
        })
        .collect()
}

/// The lines that link to `id`, each once, newest first.
fn linked_from(index: &[(String, Value)], all: &[Value], id: &str) -> Vec<Value> {
    let mut out: Vec<Value> = all
        .iter()
        .filter(|e| e["id"] != id)
        .filter(|e| links_in(e["text"].as_str().unwrap_or("")).iter().any(|l| named(index, &l.title).is_some_and(|t| t["id"] == id)))
        .map(|e| json!({"id": e["id"], "title": e["title"], "kind": e["kind"], "label": e["label"], "day": e["day"], "today": e["today"], "updated": e["updated"]}))
        .collect();
    newest_first(&mut out, "updated");
    out
}

/// Add a line's links, headings and Linked from to its entry.
fn add_links(bible: &Bible, store: &Store, e: &mut Value) {
    let all = all_lines(bible, store, true);
    let index = titles(&all);
    let text = e["text"].as_str().unwrap_or("").to_string();
    e["links"] = json!(link_values(&text, &index));
    e["headings"] = json!(headings_of(&text));
    let id = e["id"].as_str().unwrap_or("").to_string();
    e["linked_from"] = json!(if id.is_empty() { vec![] } else { linked_from(&index, &all, &id) });
}

/// Any note, question or day's page by its id (a day's page also by its day, 2026-11-04), whole: its text, places,
/// threads, links, headings and the notes that link to it (`linked_from`).
pub fn show(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    if crate::store::is_day(id.trim()) {
        return day_page(bible, store, Some(id));
    }
    let mut e = all_lines(bible, store, true).into_iter().find(|e| e["id"] == id).ok_or_else(|| missing("No note, question or page with that id."))?;
    if e["placed"] == false && e["kind"] != "day" {
        // a note with no place yet: the place its text names, to offer first
        e["offer"] = named_place(bible, e["text"].as_str().unwrap_or("")).unwrap_or(Value::Null);
    }
    add_links(bible, store, &mut e);
    Ok(e)
}

/// The `[[links]]` in a note: where each is in its text, what it names, and the note it opens (`to`, null when no note
/// has that title).
pub fn links(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let e = show(bible, store, id)?;
    Ok(json!({"id": e["id"], "title": e["title"], "links": e["links"]}))
}

/// The notes that link to a note (Linked from), newest first.
pub fn backlinks(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let e = show(bible, store, id)?;
    Ok(json!({"id": e["id"], "title": e["title"], "linked_from": e["linked_from"]}))
}

/// A note's title changed: the links to its old title, in every other note, are written with its new one (each keeps
/// its #heading and |shown). → the new title and the notes changed.
pub fn relink(bible: &Bible, store: &mut Store, id: &str, old_title: &str) -> Result<Value> {
    let e = show(bible, store, id)?;
    let new = if e["kind"] == "day" { e["day"].as_str().unwrap_or("").to_string() } else { e["title"].as_str().unwrap_or("").to_string() };
    let old = old_title.trim().to_lowercase();
    if old.is_empty() || new.is_empty() {
        return Err(bad("Give the note's old title."));
    }
    let mut changed = vec![];
    if old == new.to_lowercase() {
        return Ok(json!({"id": id, "title": new, "changed": changed}));
    }
    for other in all_lines(bible, store, true) {
        if other["id"] == id {
            continue;
        }
        let text = other["text"].as_str().unwrap_or("").to_string();
        let ls: Vec<Link> = links_in(&text).into_iter().filter(|l| l.title.to_lowercase() == old).collect();
        if ls.is_empty() {
            continue;
        }
        let c: Vec<char> = text.chars().collect();
        let mut out = String::new();
        let mut at = 0;
        for l in ls {
            out.extend(&c[at..l.start]);
            let heading = if l.heading.is_empty() { String::new() } else { format!("#{}", l.heading) };
            let shown = if l.shown.is_empty() { String::new() } else { format!("|{}", l.shown) };
            out += &format!("[[{new}{heading}{shown}]]");
            at = l.end;
        }
        out.extend(&c[at..]);
        let oid = other["id"].as_str().unwrap_or("").to_string();
        edit_text(bible, store, &oid, &out)?;
        changed.push(oid);
    }
    Ok(json!({"id": id, "title": new, "changed": changed}))
}

// ---- a new note, anywhere ---------------------------------------------------------------------------------------------

/// Write a new note: on a place (a verse, words, a run, a chapter, a book, H7065) or, with none, into the Inbox; a
/// question (`question`) on a place is a trail. → the Notebook's entry.
pub fn new_note(bible: &Bible, store: &mut Store, place: Option<&str>, text: &str, question: bool) -> Result<Value> {
    let Some(place) = place.map(str::trim).filter(|p| !p.is_empty()) else { return jot(bible, store, text, question) };
    let (a, kind, quote, strong) = resolved(bible, &place_anchor(bible, place)?)?;
    if question {
        if kind == "lemma" {
            return Err(bad("A question is placed on words or verses in the text, not on a Strong's number everywhere."));
        }
        let r = store.add_trail(&a, text, &quote)?;
        return Ok(entry_in(bible, store, &r, "question", true));
    }
    let r = store.add_note(&a, text, &quote, &strong)?;
    Ok(entry_in(bible, store, &r, "note", true))
}

// ---- Settings → Notebook (settings/notebook.json) -----------------------------------------------------------------

/// The Notebook's settings: key, default (as JSON), what it does (N4 in the design round).
pub const SETTINGS: &[(&str, &str, &str)] = &[
    ("today", "true", "Today's page: a note for each day, made when you first write in it"),
    ("follow", "true", "Follow the reader: grouped by chapter, the list shows the chapter you are reading"),
    ("links", "true", "Links between notes: [[title]] and [[title#heading]], as in Obsidian"),
    ("chapters", "true", "Notes on chapters and books: + Place offers the chapter and the book, not only verses"),
    ("inbox", "false", "Show the Inbox as its own group: notes with no place yet, apart from the rest"),
    ("group", "\"day\"", "Group when it opens: day, chapter, thread or none"),
    ("capture", "\"Ctrl+J\"", "Quick capture: the key that opens a small box at the verse"),
];

/// The Notebook's settings, each the saved one or its default.
pub fn settings(store: &Store) -> Value {
    let saved = store.settings("notebook");
    let mut out = serde_json::Map::new();
    for (k, d, _) in SETTINGS {
        out.insert(k.to_string(), saved.get(*k).cloned().unwrap_or_else(|| serde_json::from_str(d).unwrap()));
    }
    Value::Object(out)
}

/// The settings with what each does (for a terminal, and the window's Settings).
pub fn settings_about(store: &Store) -> Value {
    let now = settings(store);
    json!(SETTINGS
        .iter()
        .map(|(k, d, w)| json!({"key": k, "value": now[*k], "default": serde_json::from_str::<Value>(d).unwrap(), "what": w}))
        .collect::<Vec<_>>())
}

/// Change one of the Notebook's settings: on or off for the switches, day|chapter|thread|none for group, a key like
/// Ctrl+J for capture; "default" puts it back. → every setting.
pub fn set_setting(store: &mut Store, key: &str, value: &str) -> Result<Value> {
    let names = SETTINGS.iter().map(|s| s.0).collect::<Vec<_>>().join(", ");
    let (_, d, _) = SETTINGS.iter().find(|(k, _, _)| *k == key).ok_or_else(|| bad(format!("The Notebook's settings are {names}.")))?;
    let v = value.trim();
    let new = if v == "default" {
        None
    } else if *d == "true" || *d == "false" {
        Some(json!(match v.to_lowercase().as_str() {
            "on" | "true" | "yes" => true,
            "off" | "false" | "no" => false,
            _ => return Err(bad(format!("{key} is on or off."))),
        }))
    } else if key == "group" {
        if !["day", "chapter", "thread", "none"].contains(&v) {
            return Err(bad("Group by day, chapter, thread or none."));
        }
        Some(json!(v))
    } else {
        Some(json!(capture_key(v)?))
    };
    store.set_setting("notebook", key, new)?;
    Ok(settings(store))
}

/// A key as the window reads it: Ctrl or Alt (and Shift) with one letter or digit: "Ctrl+J", "Ctrl+Shift+K", "Alt+N".
fn capture_key(v: &str) -> Result<String> {
    let parts: Vec<&str> = v.split('+').map(str::trim).collect();
    let (last, mods) = parts.split_last().ok_or_else(|| bad("Give a key like Ctrl+J."))?;
    let mut have = vec![];
    for m in mods {
        let m = match m.to_lowercase().as_str() {
            "ctrl" | "control" => "Ctrl",
            "alt" => "Alt",
            "shift" => "Shift",
            _ => return Err(bad("A key's modifiers are Ctrl, Alt and Shift: Ctrl+J.")),
        };
        have.push(m);
    }
    let one = last.chars().count() == 1 && last.chars().all(|c| c.is_ascii_alphanumeric());
    if !one || !have.iter().any(|m| *m == "Ctrl" || *m == "Alt") {
        return Err(bad("Give a key with Ctrl or Alt and a letter or digit, like Ctrl+J."));
    }
    let mut out: Vec<String> = ["Ctrl", "Alt", "Shift"].iter().filter(|m| have.contains(m)).map(|m| m.to_string()).collect();
    out.push(last.to_uppercase());
    Ok(out.join("+"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_are_found() {
        let l = links_in("see [[Word study: H7065#Renderings]] and [[24,000 or 23,000?|the numbers]], not [[]] or [x]");
        assert_eq!(l.len(), 2);
        assert_eq!((l[0].title.as_str(), l[0].heading.as_str()), ("Word study: H7065", "Renderings"));
        assert_eq!((l[1].title.as_str(), l[1].shown.as_str()), ("24,000 or 23,000?", "the numbers"));
        let c: Vec<char> = "see [[A]]".chars().collect();
        let a = &links_in("see [[A]]")[0];
        assert_eq!(c[a.start..a.end].iter().collect::<String>(), "[[A]]");
    }

    #[test]
    fn titles_and_keys() {
        assert_eq!(title_of("\n# Numbers 25, read again\nRead the chapter"), "Numbers 25, read again");
        assert_eq!(preview_of("Title\n- one **two**\n> [[three]]", true), "one two three");
        assert_eq!(capture_key("ctrl+j").unwrap(), "Ctrl+J");
        assert_eq!(capture_key("shift+ctrl+k").unwrap(), "Ctrl+Shift+K");
        assert!(capture_key("Shift+K").is_err());
        assert!(capture_key("J").is_err());
    }
}
