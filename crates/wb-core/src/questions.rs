//! Questions written in a page (R1, `docs/archive/2026-11-10/docs/redesign-R1.md` question 4; sheets R1.3, R1.4). `/?` writes a callout in the
//! page's Markdown: `> [!question] How do the two numbers relate?`, and `> [!done] …` when it is answered (Obsidian draws
//! both as callouts; the Python app shows a quote). It is a block of its page and nothing else: no file of its own.
//!
//! The Notebook has two forms of a question and one list of them: a question at a verse is a trail (`trails/q_….md`, the
//! Python app's files), and a question written in a page is a block of that page. A block takes its page's places (its
//! `anchor` and `also`): the reader's ? on a verse number, the verse card's questions and the Questions view read both.
//! A block is named `<page id>#<its number>` (blocks are counted from 1, as `wb page blocks` lists them).

use crate::bible::Bible;
use crate::notebook as nb;
use crate::pages::{self, chars, split, sub, Edit};
use crate::store::{bad, missing, places_of, s, Rec, Store};
use crate::Result;
use serde_json::{json, Value};

/// A question block as it reads: its words, and whether it is answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Question {
    pub text: String,
    pub done: bool,
}

/// A block's Markdown → the question it holds, when it is a callout `[!question]` (open) or `[!done]` (answered).
pub fn question_of(md: &str) -> Option<Question> {
    let mut lines = md.lines().map(|l| l.trim_start().strip_prefix('>').map(|r| r.strip_prefix(' ').unwrap_or(r)));
    let first = lines.next()??.trim();
    let rest = first.strip_prefix("[!")?;
    let (kind, after) = rest.split_once(']')?;
    let done = match kind.trim().to_lowercase().as_str() {
        "question" => false,
        "done" => true,
        _ => return None,
    };
    let after = after.trim_start_matches(['+', '-']).trim();
    let mut words: Vec<String> = vec![];
    if !after.is_empty() {
        words.push(after.to_string());
    }
    for l in lines {
        let Some(l) = l else { return None };
        if !l.trim().is_empty() {
            words.push(l.trim().to_string());
        }
    }
    Some(Question { text: words.join(" "), done })
}

/// A question as its block is written: `> [!question] text`, or `[!done]` when answered. Words on several lines keep them.
pub fn question_md(done: bool, text: &str) -> String {
    let mark = if done { "[!done]" } else { "[!question]" };
    let mut ls = text.trim().lines();
    let mut out = format!("> {mark} {}", ls.next().unwrap_or("").trim()).trim_end().to_string();
    for l in ls {
        out += &format!("\n> {}", l.trim());
    }
    out
}

/// A question block with its mark turned over: only the mark is written anew, so the person's words, their line breaks and
/// whatever Obsidian put after the mark (+ or -) stay as they were.
pub fn with_marker(md: &str, done: bool) -> String {
    let (from, to) = if done { ("[!question]", "[!done]") } else { ("[!done]", "[!question]") };
    let lower = md.to_lowercase();
    match lower.find(from) {
        Some(i) => format!("{}{}{}", &md[..i], to, &md[i + from.len()..]),
        None => md.to_string(),
    }
}

/// One question block found in a page.
#[derive(Debug, Clone)]
pub struct Found {
    pub page: String,
    pub n: usize,
    pub q: Question,
    pub places: Vec<String>,
    pub title: String,
    pub created: String,
    pub updated: String,
    pub kind: &'static str,
}

impl Found {
    pub fn id(&self) -> String {
        format!("{}#{}", self.page, self.n)
    }
}

fn scan(out: &mut Vec<Found>, r: &Rec, id: String, text: &str, titled: bool, title: String, kind: &'static str) {
    if r.get("template") == Some(&json!(true)) || !text.contains("[!") {
        return;
    }
    let c = chars(text);
    for (i, b) in split(text, titled).1.iter().enumerate() {
        if b.kind != "quote" {
            continue;
        }
        if let Some(q) = question_of(&sub(&c, b.start, b.end)) {
            out.push(Found { page: id.clone(), n: i + 1, q, places: places_of(r), title: title.clone(), created: s(r, "created"), updated: s(r, "updated"), kind });
        }
    }
}

/// Every question block in every page (notes, pages with no place, notes on a thread, days' pages, and the notes of
/// threads), in the order of the pages' files. Templates are left out; a trail is a question already.
pub fn found(store: &Store) -> Vec<Found> {
    let mut out = vec![];
    for r in store.notes().into_iter().chain(store.inbox()).chain(store.on_thread()) {
        let kind = if s(r, "kind") == "question" { "question" } else { "note" };
        scan(&mut out, r, s(r, "id"), &s(r, "text"), true, nb::title_of(&s(r, "text")), kind);
    }
    for r in store.days() {
        scan(&mut out, r, s(r, "id"), &s(r, "text"), false, s(r, "day"), "day");
    }
    for t in store.threads() {
        let mut r = Rec::new();
        r.insert("created".into(), t["created"].clone());
        r.insert("updated".into(), t["updated"].clone());
        scan(&mut out, &r, crate::threadpage::page_id(&s(t, "id")), &s(t, "note"), false, s(t, "name"), "thread");
    }
    out
}

/// The open questions of a chapter written in pages, by verse (the reader's ?).
pub fn in_chapter(store: &Store, code: &str, chapter: u32) -> Vec<Value> {
    let mut out = vec![];
    for f in found(store).into_iter().filter(|f| !f.q.done) {
        for p in &f.places {
            let Ok(a) = crate::anchors::py_parse(p) else { continue };
            if a["kind"] == "lemma" || s(&a, "code") != code {
                continue;
            }
            let (c1, c2) = (a["c1"].as_u64().unwrap_or(0) as u32, a.get("c2").and_then(|x| x.as_u64()).map(|x| x as u32).unwrap_or(a["c1"].as_u64().unwrap_or(0) as u32));
            if c1 <= chapter && chapter <= c2 {
                let v = if c1 == chapter { a["v1"].as_u64().unwrap_or(1) } else { 1 };
                out.push(json!({"id": f.id(), "v": v, "text": f.q.text}));
                break;
            }
        }
    }
    out
}

/// A found question as the Notebook's entry (the shape of a question line, with `block`: its number in its page and
/// `page`: where it is written).
pub fn entry(bible: &Bible, f: &Found) -> Value {
    let anchor = f.places.first().cloned().unwrap_or_default();
    let label = if anchor.is_empty() { String::new() } else { nb::label(bible, &anchor) };
    json!({
        "id": f.id(), "kind": "question", "block": f.n, "page": f.page, "page_title": f.title, "page_kind": f.kind,
        "status": if f.q.done { "done" } else { "open" }, "placed": !anchor.is_empty(), "anchor": anchor, "label": label,
        "quote": "", "text": f.q.text, "title": f.q.text, "preview": "", "created": f.created, "updated": f.updated,
        "time": "", "day": "", "also": [], "threads": [], "refs": [], "whole": "",
    })
}

/// Every question written in a page, as entries.
pub fn entries(bible: &Bible, store: &Store) -> Vec<Value> {
    found(store).iter().map(|f| entry(bible, f)).collect()
}

/// A question's id → (its page, its block number from 1).
pub fn split_id(id: &str) -> Option<(&str, usize)> {
    let (p, n) = id.rsplit_once('#')?;
    Some((p, n.parse::<usize>().ok().filter(|n| *n >= 1)?))
}

fn block_md(store: &Store, page: &str, n: usize) -> Result<(String, Question)> {
    let (_, text, titled) = pages::text_of(store, page)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs.get(n - 1).ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let md = sub(&c, b.start, b.end);
    let q = question_of(&md).ok_or_else(|| bad(format!("Block {n} is not a question (a callout: > [!question] …).")))?;
    Ok((md, q))
}

/// A question block answered (`done`), opened again, or (None) turned over: the callout's mark is written anew.
pub fn set_done(bible: &Bible, store: &mut Store, id: &str, done: Option<bool>) -> Result<Value> {
    let (page, n) = split_id(id).ok_or_else(|| bad("A question written in a page is named <page id>#<block number>."))?;
    let (md, q) = block_md(store, page, n)?;
    let done = done.unwrap_or(!q.done);
    pages::edit(bible, store, page, Edit::Set { n: n - 1, count: 1, text: &with_marker(&md, done) })?;
    let f = found(store).into_iter().find(|f| f.page == page && f.n == n).ok_or_else(|| missing("That question is gone."))?;
    Ok(entry(bible, &f))
}

/// A new question block at the end of a page, or after block `after` (from 1). → the question.
pub fn add(bible: &Bible, store: &mut Store, page: &str, text: &str, after: Option<usize>) -> Result<Value> {
    if text.trim().is_empty() {
        return Err(bad("Write the question."));
    }
    let (_, cur, titled) = pages::text_of(store, page)?;
    let count = split(&cur, titled).1.len();
    let at = match after {
        Some(n) if n >= 1 && n <= count => Some(n - 1),
        Some(0) => None,
        Some(_) => return Err(bad(format!("The page has {count} blocks."))),
        None => count.checked_sub(1),
    };
    let v = pages::edit(bible, store, page, Edit::Add { after: at, text: &question_md(false, text) })?;
    let n = v["n"].as_u64().unwrap_or(1) as usize;
    let f = found(store).into_iter().find(|f| f.page == v["id"].as_str().unwrap_or(page) && f.n == n).ok_or_else(|| missing("That question is gone."))?;
    Ok(entry(bible, &f))
}

/// The questions at a place and on any part of it (the verse card's): trails and question blocks, as one list, newest
/// first. `here` is true when the question is on this very place; `form` says `trail` or `block`.
pub fn at(bible: &Bible, store: &Store, anchor: &str, status: &str) -> Result<Value> {
    let t = crate::studyapi::trail_at(bible, store, anchor, status)?;
    let a = s(&t.as_object().cloned().unwrap_or_default(), "anchor");
    let res = crate::anchors::resolve(bible, anchor)?;
    let lemma = s(&res, "kind") == "lemma";
    let mut out: Vec<Value> = t["trails"].as_array().cloned().unwrap_or_default();
    for v in out.iter_mut() {
        v["form"] = json!("trail");
    }
    for f in found(store) {
        if status != "all" && (if f.q.done { "done" } else { "open" }) != status {
            continue;
        }
        let here = f.places.iter().any(|p| *p == a);
        let near = !lemma && f.places.iter().any(|p| !p.is_empty() && !p.starts_with('H') && !p.starts_with('G') && crate::anchors::py_parse(p).map(|q| crate::studyapi::overlaps(&res, &q)).unwrap_or(false));
        if here || near {
            let mut e = entry(bible, &f);
            e["here"] = json!(here);
            e["form"] = json!("block");
            out.push(e);
        }
    }
    out.sort_by(|x, y| y["created"].as_str().cmp(&x["created"].as_str()));
    Ok(json!({"anchor": a, "label": res["label"], "questions": out}))
}

/// Every question, trails and question blocks, newest first (`status`: open, done or all).
pub fn list(bible: &Bible, store: &Store, status: &str) -> Result<Value> {
    let mut v = nb::questions(bible, store, status)?;
    v["questions"].as_array_mut().map(|a| a.sort_by(|x, y| y["created"].as_str().cmp(&x["created"].as_str())));
    Ok(v)
}

/// A trail folded into a page: it becomes a question block at the page's end, and the trail goes to .trash. The page must
/// be at the trail's place (or hold it as another place); `also` gives the page that place instead. Nothing is lost: the
/// block takes the page's places. → the question and what was done (so it can be undone with `unfold`).
pub fn fold(bible: &Bible, store: &mut Store, trail: &str, page: &str, also: bool) -> Result<Value> {
    let t = store.trails().into_iter().find(|t| s(t, "id") == trail).cloned().ok_or_else(|| missing("No such question at a place (a trail)."))?;
    let anchor = s(&t, "anchor");
    let (pid, ptext, _) = pages::text_of(store, page)?;
    if pid.starts_with("thread:") || crate::store::is_day(&pid) || pid.starts_with("d_") {
        return Err(bad("Fold a question into a note or a page."));
    }
    let rec = store.find_note(&pid)?;
    let has = places_of(&rec).iter().any(|p| *p == anchor);
    let _ = ptext;
    if !has {
        if !also {
            return Err(bad("The page is not at that question's place; fold it in with --also to give the page the place."));
        }
        if s(&rec, "anchor").is_empty() {
            return Err(bad("Give the page a place first (a page with no place cannot hold a question's place)."));
        }
        nb::also_at(bible, store, &pid, &anchor, true)?;
    }
    let status = s(&t, "status");
    let added = add(bible, store, &pid, &s(&t, "text"), None)?;
    if status == "done" {
        set_done(bible, store, added["id"].as_str().unwrap_or(""), Some(true))?;
    }
    store.delete_trail(trail)?;
    Ok(json!({"question": added["id"], "page": pid, "folded": trail}))
}

/// A question block given its own place again: a trail at the page's place, and the block taken out of the page.
pub fn unfold(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let (page, n) = split_id(id).ok_or_else(|| bad("A question written in a page is named <page id>#<block number>."))?;
    let (_, q) = block_md(store, page, n)?;
    let (pid, _, _) = pages::text_of(store, page)?;
    if pid.starts_with("thread:") || pid.starts_with("d_") {
        return Err(bad("Only a question in a note or a page at a place can become a trail."));
    }
    let rec = store.find_note(&pid)?;
    let anchor = places_of(&rec).first().cloned().ok_or_else(|| bad("The page has no place; a question at a verse needs one."))?;
    let quote = s(&rec, "quote");
    let trail = store.add_trail(&anchor, &q.text, &quote)?;
    if q.done {
        store.set_trail_status(&s(&trail, "id"), "done")?;
    }
    pages::edit(bible, store, &pid, Edit::Set { n: n - 1, count: 1, text: "" })?;
    Ok(json!({"trail": trail["id"], "page": pid, "text": q.text}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_callout_is_a_question_open_or_answered() {
        assert_eq!(question_of("> [!question] How do the two numbers relate?"), Some(Question { text: "How do the two numbers relate?".into(), done: false }));
        assert_eq!(question_of("> [!done] Answered one\n> over two lines"), Some(Question { text: "Answered one over two lines".into(), done: true }));
        assert_eq!(question_of("> [!QUESTION]- Folded in Obsidian").unwrap().text, "Folded in Obsidian");
        assert_eq!(question_of("> [!note] Not one"), None);
        assert_eq!(question_of("> a plain quote"), None);
        assert_eq!(question_of("[!question] not quoted"), None);
    }

    #[test]
    fn a_question_is_written_as_the_callout_it_was_read_from() {
        for (md, done) in [("> [!question] A question", false), ("> [!done] A question\n> on two lines", true)] {
            let q = question_of(md).unwrap();
            assert_eq!(question_md(q.done, &q.text.replace(" on two lines", "\non two lines")), md);
            assert_eq!(q.done, done);
        }
    }

    #[test]
    fn a_block_is_named_by_its_page_and_number() {
        assert_eq!(split_id("n_20261108_ab12#3"), Some(("n_20261108_ab12", 3)));
        assert_eq!(split_id("thread:phinehas#1"), Some(("thread:phinehas", 1)));
        assert_eq!(split_id("n_1"), None);
        assert_eq!(split_id("n_1#0"), None);
    }
}
