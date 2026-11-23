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
    /// The callout's kind as its marker writes it (`question`, `done`, `key`, `note`).
    pub kind: &'static str,
    /// Its first line, how many more lines it has, and whether a list is among them (the Questions list says "2 more lines, a list").
    pub first: String,
    pub more: usize,
    pub list: bool,
}

/// The four kinds of a callout (notebook rows 22, 23): the word its marker `> [!word]` holds, and the name the window shows.
/// Question and Answered are the questions of the study; Key point and Note are plain callouts. `> [!question]` and `> [!done]` are
/// what every earlier page already holds.
pub const CALLOUT_KINDS: [(&str, &str); 4] = [
    ("question", "Question"),
    ("done", "Answered"),
    ("key", "Key point"),
    ("note", "Note"),
];

/// A kind as a person says it (`answered`, `key point`, `Key-point`) → the word of its marker.
pub fn kind_word(said: &str) -> Option<&'static str> {
    let w = said.trim().to_lowercase().replace([' ', '-', '_'], "");
    match w.as_str() {
        "question" | "open" => Some("question"),
        "done" | "answered" => Some("done"),
        "key" | "keypoint" => Some("key"),
        "note" => Some("note"),
        _ => None,
    }
}

pub(crate) fn kind_label(word: &str) -> &'static str {
    CALLOUT_KINDS
        .iter()
        .find(|(w, _)| *w == word)
        .map(|(_, l)| *l)
        .unwrap_or("Note")
}

/// A block's Markdown → the question it holds, when it is a callout `[!question]` (open) or `[!done]` (answered).
pub fn question_of(md: &str) -> Option<Question> {
    read_callout(md, false).filter(|q| q.kind == "question" || q.kind == "done")
}

/// A block's Markdown → the callout it is, of any of the four kinds (`> [!key] …`; later lines `> …`, a nested list `>   - …`).
pub fn callout_of(md: &str) -> Option<Question> {
    read_callout(md, false)
}

fn read_callout(md: &str, keep_lines: bool) -> Option<Question> {
    let mut lines = md.lines().map(|l| {
        l.trim_start()
            .strip_prefix('>')
            .map(|r| r.strip_prefix(' ').unwrap_or(r))
    });
    let first = lines.next()??.trim();
    let rest = first.strip_prefix("[!")?;
    let (kind, after) = rest.split_once(']')?;
    let kind = match kind.trim().to_lowercase().as_str() {
        "question" => "question",
        "done" => "done",
        "key" => "key",
        "note" => "note",
        _ => return None,
    };
    let done = kind == "done";
    let after = after.trim_start_matches(['+', '-']).trim();
    let mut words: Vec<String> = vec![];
    if !after.is_empty() {
        words.push(after.to_string());
    }
    let mut shown: Vec<String> = words.clone();
    for l in lines {
        let l = l?;
        if !l.trim().is_empty() {
            shown.push(l.trim_end().to_string());
        }
        if keep_lines {
            words.push(l.to_string());
        } else if !l.trim().is_empty() {
            words.push(l.trim().to_string());
        }
    }
    let list = shown.iter().any(|l| {
        let t = l.trim_start();
        t.starts_with("- ")
            || t.starts_with("* ")
            || t.starts_with("+ ")
            || t.split_once(['.', ')']).is_some_and(|(n, r)| {
                !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()) && r.starts_with(' ')
            })
    });
    Some(Question {
        text: words.join(if keep_lines { "\n" } else { " " }),
        done,
        kind,
        first: shown
            .first()
            .map(|l| l.trim().to_string())
            .unwrap_or_default(),
        more: shown.len().saturating_sub(1),
        list,
    })
}

/// A question as its block is written: `> [!question] text`, or `[!done]` when answered. Words on several lines keep them.
pub fn question_md(done: bool, text: &str) -> String {
    let mark = if done { "[!done]" } else { "[!question]" };
    let mut ls = text.trim().lines();
    let mut out = format!("> {mark} {}", ls.next().unwrap_or("").trim())
        .trim_end()
        .to_string();
    for l in ls {
        out += &format!("\n> {l}");
    }
    out
}

/// A question block with its mark turned over: only the mark is written anew, so the person's words, their line breaks and
/// whatever Obsidian put after the mark (+ or -) stay as they were.
pub fn with_marker(md: &str, done: bool) -> String {
    let (from, to) = if done {
        ("[!question]", "[!done]")
    } else {
        ("[!done]", "[!question]")
    };
    let lower = md.to_lowercase();
    match lower.find(from) {
        Some(i) => format!("{}{}{}", &md[..i], to, &md[i + from.len()..]),
        None => md.to_string(),
    }
}

/// A callout with its kind changed: only the word in its first line's marker is written anew (`> [!question] …` → `> [!key] …`),
/// so the words, the lines, the nested list and whatever Obsidian put after the marker (+ or -) stay as they were.
pub(crate) fn with_kind(md: &str, kind: &str) -> String {
    let (first, rest) = md
        .split_once('\n')
        .map(|(a, b)| (a, Some(b)))
        .unwrap_or((md, None));
    let out = match (first.find("[!"), first.find(']')) {
        (Some(a), Some(b)) if a < b => format!("{}[!{kind}{}", &first[..a], &first[b..]),
        _ => first.to_string(),
    };
    match rest {
        Some(r) => format!("{out}\n{r}"),
        None => out,
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

/// One page to scan: its id, text, whether the text's first line is a title, the title shown, and the kind.
struct Scanned<'a> {
    id: String,
    text: &'a str,
    titled: bool,
    title: String,
    kind: &'static str,
}

fn scan(out: &mut Vec<Found>, r: &Rec, page: Scanned<'_>, every_kind: bool) {
    let Scanned {
        id,
        text,
        titled,
        title,
        kind,
    } = page;
    if r.get("template") == Some(&json!(true)) || !text.contains("[!") {
        return;
    }
    let c = chars(text);
    for (i, b) in split(text, titled).1.iter().enumerate() {
        if b.kind != "quote" {
            continue;
        }
        let md = sub(&c, b.start, b.end);
        if let Some(q) = if every_kind {
            callout_of(&md)
        } else {
            question_of(&md)
        } {
            out.push(Found {
                page: id.clone(),
                n: i + 1,
                q,
                places: places_of(r),
                title: title.clone(),
                created: s(r, "created"),
                updated: s(r, "updated"),
                kind,
            });
        }
    }
}

/// Every question block in every page (notes, pages with no place, notes on a thread, days' pages, and the notes of
/// threads), in the order of the pages' files. Templates are left out; a trail is a question already.
pub fn found(store: &Store) -> Vec<Found> {
    found_of(store, false)
}

/// Every callout of every kind in every page, as `found` reads the questions.
fn found_callouts(store: &Store) -> Vec<Found> {
    found_of(store, true)
}

fn found_of(store: &Store, every_kind: bool) -> Vec<Found> {
    let mut out = vec![];
    for r in store
        .notes()
        .into_iter()
        .chain(store.inbox())
        .chain(store.on_thread())
    {
        let kind = if s(r, "kind") == "question" {
            "question"
        } else {
            "note"
        };
        scan(
            &mut out,
            r,
            Scanned {
                id: s(r, "id"),
                text: &s(r, "text"),
                titled: true,
                title: nb::title_of(&s(r, "text")),
                kind,
            },
            every_kind,
        );
    }
    for r in store.days() {
        scan(
            &mut out,
            r,
            Scanned {
                id: s(r, "id"),
                text: &s(r, "text"),
                titled: false,
                title: s(r, "day"),
                kind: "day",
            },
            every_kind,
        );
    }
    for t in store.threads() {
        let mut r = Rec::new();
        r.insert("created".into(), t["created"].clone());
        r.insert("updated".into(), t["updated"].clone());
        scan(
            &mut out,
            &r,
            Scanned {
                id: crate::threadpage::page_id(&s(t, "id")),
                text: &s(t, "note"),
                titled: false,
                title: s(t, "name"),
                kind: "thread",
            },
            every_kind,
        );
    }
    out
}

/// The open questions of a chapter written in pages, by verse (the reader's ?).
pub fn in_chapter(store: &Store, code: &str, chapter: u32) -> Vec<Value> {
    let mut out = vec![];
    for f in found(store).into_iter().filter(|f| !f.q.done) {
        for p in &f.places {
            let Ok(a) = crate::anchors::py_parse(p) else {
                continue;
            };
            if a["kind"] == "lemma" || s(&a, "code") != code {
                continue;
            }
            let (c1, c2) = (
                a["c1"].as_u64().unwrap_or(0) as u32,
                a.get("c2")
                    .and_then(|x| x.as_u64())
                    .map(|x| x as u32)
                    .unwrap_or(a["c1"].as_u64().unwrap_or(0) as u32),
            );
            if c1 <= chapter && chapter <= c2 {
                let v = if c1 == chapter {
                    a["v1"].as_u64().unwrap_or(1)
                } else {
                    1
                };
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
    let label = if anchor.is_empty() {
        String::new()
    } else {
        nb::label(bible, &anchor)
    };
    json!({
        "id": f.id(), "kind": "question", "block": f.n, "page": f.page, "page_title": f.title, "page_kind": f.kind,
        "status": if f.q.done { "done" } else { "open" }, "placed": !anchor.is_empty(), "anchor": anchor, "label": label,
        "quote": "", "text": f.q.text, "title": f.q.text, "first": f.q.first, "more_lines": f.q.more, "has_list": f.q.list, "preview": "", "created": f.created, "updated": f.updated,
        "time": "", "day": "", "also": [], "threads": [], "refs": [], "whole": "",
    })
}

/// Every question written in a page or in a margin note (MK-11), as entries.
pub fn entries(bible: &Bible, store: &Store) -> Vec<Value> {
    let mut out: Vec<Value> = found(store).iter().map(|f| entry(bible, f)).collect();
    out.extend(crate::margin::question_entries(bible, store));
    out
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
    let b = bs
        .get(n - 1)
        .ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let md = sub(&c, b.start, b.end);
    let q = question_of(&md).ok_or_else(|| {
        bad(format!(
            "Block {n} is not a question (a callout: > [!question] …)."
        ))
    })?;
    Ok((md, q))
}

/// A question block answered (`done`), opened again, or (None) turned over: the callout's mark is written anew.
pub fn set_done(bible: &Bible, store: &mut Store, id: &str, done: Option<bool>) -> Result<Value> {
    let (page, n) = split_id(id)
        .ok_or_else(|| bad("A question written in a page is named <page id>#<block number>."))?;
    let (md, q) = block_md(store, page, n)?;
    let done = done.unwrap_or(!q.done);
    pages::edit(
        bible,
        store,
        page,
        Edit::Set {
            n: n - 1,
            count: 1,
            text: &with_marker(&md, done),
        },
    )?;
    let f = found(store)
        .into_iter()
        .find(|f| f.page == page && f.n == n)
        .ok_or_else(|| missing("That question is gone."))?;
    Ok(entry(bible, &f))
}

/// A new question block at the end of a page, or after block `after` (from 1). → the question.
pub fn add(
    bible: &Bible,
    store: &mut Store,
    page: &str,
    text: &str,
    after: Option<usize>,
) -> Result<Value> {
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
    let v = pages::edit(
        bible,
        store,
        page,
        Edit::Add {
            after: at,
            text: &question_md(false, text),
        },
    )?;
    let n = v["n"].as_u64().unwrap_or(1) as usize;
    let f = found(store)
        .into_iter()
        .find(|f| f.page == v["id"].as_str().unwrap_or(page) && f.n == n)
        .ok_or_else(|| missing("That question is gone."))?;
    Ok(entry(bible, &f))
}

/// A callout's kind changed (`wb callout kind <page id>#<block number> KIND`; the window's kind menu on a callout's icon): the word in
/// its marker is written anew and nothing else. → the callout as `callouts` lists it.
pub fn set_kind(bible: &Bible, store: &mut Store, id: &str, kind: &str) -> Result<Value> {
    let word = kind_word(kind)
        .ok_or_else(|| bad("A callout's kind is question, answered, key or note."))?;
    let (page, n) =
        split_id(id).ok_or_else(|| bad("A callout is named <page id>#<block number>."))?;
    let (_, text, titled) = pages::text_of(store, page)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs
        .get(n - 1)
        .ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let md = sub(&c, b.start, b.end);
    if b.kind != "quote" || callout_of(&md).is_none() {
        return Err(bad(format!(
            "Block {n} is not a callout (> [!question] …, [!done], [!key], [!note])."
        )));
    }
    // a block's link id (^abc123) is kept by the page's own rule for a rewrite
    let out = pages::edit(
        bible,
        store,
        page,
        Edit::Set {
            n: n - 1,
            count: 1,
            text: &with_kind(&pages::without_block_id(&md), word),
        },
    )?;
    let (pid, _, _) = pages::text_of(store, page)?;
    let f = found_callouts(store)
        .into_iter()
        .find(|f| f.page == pid && f.n == n)
        .ok_or_else(|| missing("That callout is gone."))?;
    let _ = out;
    Ok(callout_entry(&f))
}

fn callout_entry(f: &Found) -> Value {
    json!({
        "id": f.id(), "kind": f.q.kind, "label": kind_label(f.q.kind), "page": f.page, "page_title": f.title, "page_kind": f.kind, "block": f.n,
        "text": f.q.text, "first": f.q.first, "more_lines": f.q.more, "has_list": f.q.list, "created": f.created, "updated": f.updated,
    })
}

/// Every callout of the study (`wb callout list [--kind KIND] [--page ID]`): of one kind, or of all four, in one page or in every
/// one, newest page first. Question and Answered are the questions the Questions list shows; Key point and Note are found by
/// Ctrl+K and by a List in a page grouped by callout kind. `{callouts: [...], counts: {question, done, key, note}}`; the counts are
/// of the pages asked about, before `kind`.
pub fn callouts(store: &Store, kind: Option<&str>, page: Option<&str>) -> Result<Value> {
    let want = match kind
        .map(str::trim)
        .filter(|k| !k.is_empty() && !k.eq_ignore_ascii_case("all"))
    {
        Some(k) => Some(
            kind_word(k).ok_or_else(|| bad("--kind is question, answered, key, note or all."))?,
        ),
        None => None,
    };
    let page = match page {
        Some(p) => Some(pages::text_of(store, p)?.0),
        None => None,
    };
    let mut all: Vec<Found> = found_callouts(store)
        .into_iter()
        .filter(|f| page.as_ref().is_none_or(|p| *p == f.page))
        .collect();
    all.sort_by(|x, y| {
        y.updated
            .cmp(&x.updated)
            .then_with(|| x.page.cmp(&y.page))
            .then(x.n.cmp(&y.n))
    });
    let mut counts = serde_json::Map::new();
    for (w, _) in CALLOUT_KINDS {
        counts.insert(
            w.into(),
            json!(all.iter().filter(|f| f.q.kind == w).count()),
        );
    }
    let rows: Vec<Value> = all
        .iter()
        .filter(|f| want.is_none_or(|w| f.q.kind == w))
        .map(callout_entry)
        .collect();
    Ok(json!({"callouts": rows, "counts": counts}))
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
        let here = f.places.contains(&a);
        let near = !lemma
            && f.places.iter().any(|p| {
                !p.is_empty()
                    && !p.starts_with('H')
                    && !p.starts_with('G')
                    && crate::anchors::py_parse(p)
                        .map(|q| crate::studyapi::overlaps(&res, &q))
                        .unwrap_or(false)
            });
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
    if let Some(a) = v["questions"].as_array_mut() {
        a.sort_by(|x, y| y["created"].as_str().cmp(&x["created"].as_str()))
    }
    Ok(v)
}

/// A trail folded into a page: it becomes a question block at the page's end, and the trail goes to .trash. The page must
/// be at the trail's place (or hold it as another place); `also` gives the page that place instead. Nothing is lost: the
/// block takes the page's places. → the question and what was done (so it can be undone with `unfold`).
pub fn fold(
    bible: &Bible,
    store: &mut Store,
    trail: &str,
    page: &str,
    also: bool,
) -> Result<Value> {
    let t = store
        .trails()
        .into_iter()
        .find(|t| s(t, "id") == trail)
        .cloned()
        .ok_or_else(|| missing("No such question at a place (a trail)."))?;
    let anchor = s(&t, "anchor");
    let (pid, _, _) = pages::text_of(store, page)?;
    if pid.starts_with("thread:") || crate::store::is_day(&pid) || pid.starts_with("d_") {
        return Err(bad("Fold a question into a note or a page."));
    }
    let rec = store.find_note(&pid)?;
    if rec.get("template") == Some(&json!(true)) {
        return Err(bad("Fold a question into a page, not a template."));
    }
    let has = places_of(&rec).contains(&anchor);
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

/// A question block given its own place again: a trail at one of the page's places (first by default), and the block taken out.
pub fn unfold(bible: &Bible, store: &mut Store, id: &str, at: Option<&str>) -> Result<Value> {
    let (page, n) = split_id(id)
        .ok_or_else(|| bad("A question written in a page is named <page id>#<block number>."))?;
    let (md, _) = block_md(store, page, n)?;
    let q = read_callout(&md, true).expect("block_md validated the callout");
    let (pid, _, _) = pages::text_of(store, page)?;
    if pid.starts_with("thread:") || pid.starts_with("d_") {
        return Err(bad(
            "Only a question in a note or a page at a place can become a trail.",
        ));
    }
    let rec = store.find_note(&pid)?;
    let places = places_of(&rec);
    let first = places
        .first()
        .ok_or_else(|| bad("The page has no place; a question at a verse needs one."))?;
    let anchor = at.unwrap_or(first);
    if !places.iter().any(|p| p == anchor) {
        return Err(bad("Choose one of the page's places."));
    }
    let quote = if anchor == first {
        s(&rec, "quote")
    } else {
        s(&crate::anchors::resolve(bible, anchor)?, "quote")
    };
    let trail = store.add_trail(anchor, &q.text, &quote)?;
    if q.done {
        store.set_trail_status(&s(&trail, "id"), "done")?;
    }
    pages::edit(
        bible,
        store,
        &pid,
        Edit::Set {
            n: n - 1,
            count: 1,
            text: "",
        },
    )?;
    Ok(json!({"trail": trail["id"], "page": pid, "text": q.text}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_callout_is_a_question_open_or_answered() {
        assert_eq!(
            question_of("> [!question] How do the two numbers relate?"),
            Some(Question {
                text: "How do the two numbers relate?".into(),
                done: false,
                kind: "question",
                first: "How do the two numbers relate?".into(),
                more: 0,
                list: false
            })
        );
        assert_eq!(
            question_of("> [!done] Answered one\n> over two lines"),
            Some(Question {
                text: "Answered one over two lines".into(),
                done: true,
                kind: "done",
                first: "Answered one".into(),
                more: 1,
                list: false
            })
        );
        assert_eq!(
            question_of("> [!QUESTION]- Folded in Obsidian")
                .unwrap()
                .text,
            "Folded in Obsidian"
        );
        assert_eq!(question_of("> [!note] Not one"), None);
        let k = callout_of("> [!key] A point\n> second line\n> - item\n>   - nested").unwrap();
        assert_eq!(
            (k.kind, k.first.as_str(), k.more, k.list),
            ("key", "A point", 3, true)
        );
        assert_eq!(
            with_kind("> [!question]- Folded\n> more", "done"),
            "> [!done]- Folded\n> more"
        );
        assert_eq!(kind_word("Key point"), Some("key"));
        assert_eq!(kind_word("Answered"), Some("done"));
        assert_eq!(question_of("> a plain quote"), None);
        assert_eq!(question_of("[!question] not quoted"), None);
    }

    #[test]
    fn a_question_is_written_as_the_callout_it_was_read_from() {
        for (md, done) in [
            ("> [!question] A question", false),
            ("> [!done] A question\n> on two lines", true),
        ] {
            let q = question_of(md).unwrap();
            assert_eq!(
                question_md(q.done, &q.text.replace(" on two lines", "\non two lines")),
                md
            );
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
