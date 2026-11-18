//! Study requests that need both the Bible text and the person's files: the Python app's `workbench/study_api.py` and
//! the file side of `workbench/lessons.py`, giving the same answers in the same shapes.

use crate::anchors::{py_parse, resolve};
use crate::bible::Bible;
use crate::store::{bad, check_color, cut, missing, new_id, now, places_of, s, Rec, Store, COLORS};
use crate::Result;
use rusqlite::OptionalExtension;
use serde_json::{json, Map, Value};
use std::fs;

type Pos = (i64, i64, i64); // chapter, verse, word
const END: i64 = 1_000_000;

fn n(p: &Rec, k: &str) -> Option<i64> {
    p.get(k).and_then(|v| v.as_i64())
}

pub fn public(note: &Rec, current_quote: Option<&str>) -> Rec {
    let mut out = Map::new();
    for k in ["id", "anchor", "kind", "quote", "strong", "created", "updated", "text", "also", "threads"] {
        if let Some(v) = note.get(k) {
            out.insert(k.into(), v.clone());
        }
    }
    let q = s(note, "quote");
    out.insert("drifted".into(), json!(current_quote.is_some_and(|c| !q.is_empty() && q != c)));
    out
}

fn coords(p: &Rec) -> Rec {
    ["kind", "code", "c1", "v1", "i1", "c2", "v2", "i2"].iter().map(|k| (k.to_string(), p.get(*k).cloned().unwrap_or(Value::Null))).collect()
}

fn inside(p: &Rec, code: &str, chapter: i64) -> bool {
    let last = n(p, "c2").or(n(p, "c1")).unwrap_or(0);
    s(p, "code") == code && n(p, "c1").unwrap_or(0) <= chapter && chapter <= last
}

/// What the reader draws on one chapter: highlight ranges, note ranges, the places of threads that have a color.
pub fn chapter_marks(store: &Store, code: &str, chapter: i64) -> Result<Value> {
    let (mut hls, mut notes, mut threads) = (vec![], vec![], vec![]);
    for h in store.highlights(code) {
        let p = py_parse(&s(&h, "anchor"))?;
        if inside(&p, code, chapter) {
            let mut m = coords(&p);
            m.insert("id".into(), h["id"].clone());
            m.insert("color".into(), h["color"].clone());
            hls.push(m);
        }
    }
    for nt in store.notes() {
        if s(nt, "kind") != "lemma" {
            for place in places_of(nt) {
                let p = py_parse(&place)?;
                if inside(&p, code, chapter) {
                    let mut m = coords(&p);
                    m.insert("id".into(), nt["id"].clone());
                    notes.push(m);
                }
            }
        }
    }
    for t in store.threads() {
        if s(t, "color").is_empty() {
            continue;
        }
        for mem in t["members"].as_array().unwrap() {
            let p = py_parse(mem["anchor"].as_str().unwrap())?;
            if p["kind"] != "lemma" && inside(&p, code, chapter) {
                let mut m = coords(&p);
                m.insert("thread".into(), t["id"].clone());
                m.insert("color".into(), t["color"].clone());
                threads.push(m);
            }
        }
    }
    // a set folder with a color draws the places it saves, as a thread does (TH-1); an eye off hides a folder's marks
    for t in store.sets() {
        if s(&t, "color").is_empty() {
            continue;
        }
        for i in t["items"].as_array().cloned().unwrap_or_default() {
            if i["kind"] != "place" {
                continue;
            }
            let p = py_parse(i["ref"].as_str().unwrap_or(""))?;
            if p["kind"] != "lemma" && inside(&p, code, chapter) {
                let mut m = coords(&p);
                m.insert("thread".into(), json!(format!("folder:{}", s(&t, "id"))));
                m.insert("color".into(), t["color"].clone());
                threads.push(m);
            }
        }
    }
    let hidden: Vec<String> = crate::folders::colored(store).iter().filter(|f| !crate::folders::eye_on(store, f)).map(crate::folders::mark_id).collect();
    let mut out = json!({"highlights": hls, "notes": notes, "threads": threads, "hidden": hidden});
    let pencil: Vec<Value> = crate::pencil::list(store, code)
        .into_iter()
        .filter_map(|p| {
            let a = py_parse(&s(&p, "anchor")).ok()?;
            inside(&a, code, chapter).then(|| {
                let mut m = coords(&a);
                m.insert("id".into(), p["id"].clone());
                Value::Object(m)
            })
        })
        .collect();
    if !pencil.is_empty() {
        out["pencil"] = json!(pencil);
    }
    Ok(out)
}

/// Do two places share a verse? (Word and phrase anchors count by their verses.)
pub(crate) fn overlaps(a: &Rec, b: &Rec) -> bool {
    let span = |p: &Rec| ((n(p, "c1"), n(p, "v1")), if p["c2"].is_null() { (n(p, "c1"), n(p, "v1")) } else { (n(p, "c2"), n(p, "v2")) });
    let ((s1, e1), (s2, e2)) = (span(a), span(b));
    a["code"] == b["code"] && s1 <= e2 && s2 <= e1
}

fn label(bible: &Bible, anchor: &str) -> Result<String> {
    Ok(s(&resolve(bible, anchor)?, "label"))
}

// ---- word positions -------------------------------------------------------------------------------------------------

fn word_at(bible: &Bible, book: i64, pos: Pos, asc: bool, op: &str) -> Result<Option<Pos>> {
    let order = if asc { "ASC" } else { "DESC" };
    let sql = format!("SELECT chapter, verse, idx FROM words WHERE book = ? AND (chapter, verse, idx) {op} (?, ?, ?) ORDER BY chapter {order}, verse {order}, idx {order} LIMIT 1");
    Ok(bible.conn().query_row(&sql, rusqlite::params![book, pos.0, pos.1, pos.2], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).optional()?)
}

/// First and last word a parsed anchor covers, or None if the text has no such place.
fn word_span(bible: &Bible, book: i64, p: &Rec) -> Result<Option<(Pos, Pos)>> {
    let kind = s(p, "kind");
    let (c1, v1) = (n(p, "c1").unwrap_or(0), n(p, "v1").unwrap_or(0));
    if kind == "word" || kind == "phrase" {
        let start = (c1, v1, n(p, "i1").unwrap_or(0));
        let end = if p["c2"].is_null() { start } else { (n(p, "c2").unwrap(), n(p, "v2").unwrap(), n(p, "i2").unwrap_or(0)) };
        return Ok(Some((start, end)));
    }
    let (c2, v2) = if p["c2"].is_null() { (c1, v1) } else { (n(p, "c2").unwrap(), n(p, "v2").unwrap()) };
    let start = word_at(bible, book, (c1, v1, 0), true, ">=")?;
    let end = word_at(bible, book, (c2, v2, END), false, "<=")?;
    Ok(match (start, end) {
        (Some(a), Some(b)) if (a.0, a.1) == (c1, v1) && (b.0, b.1) == (c2, v2) => Some((a, b)),
        _ => None,
    })
}

fn piece_anchor(bible: &Bible, code: &str, book: i64, start: Pos, end: Pos, whole_verses: bool) -> Result<String> {
    if whole_verses
        && Some(start) == word_at(bible, book, (start.0, start.1, 0), true, ">=")?
        && Some(end) == word_at(bible, book, (end.0, end.1, END), false, "<=")?
    {
        return Ok(if (start.0, start.1) != (end.0, end.1) {
            format!("{code}.{}:{}-{}:{}", start.0, start.1, end.0, end.1)
        } else {
            format!("{code}.{}:{}", start.0, start.1)
        });
    }
    Ok(if start != end {
        format!("{code}.{}:{}.{}-{}:{}.{}", start.0, start.1, start.2, end.0, end.1, end.2)
    } else {
        format!("{code}.{}:{}.{}", start.0, start.1, start.2)
    })
}

fn book_of(res: &Rec) -> i64 {
    res["ref"]["b"].as_i64().unwrap_or(0)
}

/// The highlight color of each word of a resolved place (None where there is none), in text order.
fn place_colors(bible: &Bible, store: &Store, res: &Rec) -> Result<Vec<Option<String>>> {
    let book = book_of(res);
    let Some(span) = word_span(bible, book, res)? else { return Ok(vec![]) };
    let mut spans = vec![];
    for h in store.highlights(&s(res, "code")) {
        if let Some(hs) = word_span(bible, book, &py_parse(&s(&h, "anchor"))?)? {
            spans.push((s(&h, "created"), hs, s(&h, "color")));
        }
    }
    spans.sort_by(|a, b| a.0.cmp(&b.0)); // where two overlap (older files), the newest shows
    let mut stmt = bible.conn().prepare_cached(
        "SELECT chapter, verse, idx FROM words WHERE book = ? AND (chapter, verse, idx) >= (?, ?, ?) AND (chapter, verse, idx) <= (?, ?, ?) ORDER BY chapter, verse, idx",
    )?;
    let rows: Vec<Pos> = stmt
        .query_map(rusqlite::params![book, span.0 .0, span.0 .1, span.0 .2, span.1 .0, span.1 .1, span.1 .2], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows.into_iter().map(|pos| spans.iter().filter(|(_, hs, _)| hs.0 <= pos && pos <= hs.1).map(|x| x.2.clone()).last()).collect())
}

// ---- notes ----------------------------------------------------------------------------------------------------------

/// Everything on one place: the person's notes, highlight, threads, original word.
pub fn anchor_view(bible: &Bible, store: &Store, anchor: &str) -> Result<Value> {
    let res = resolve(bible, anchor)?;
    let a = s(&res, "id");
    let ok = res["ok"] == true;
    let quote = s(&res, "quote");
    let notes = store.notes();
    let here: Vec<Rec> = notes.iter().filter(|n| places_of(n).contains(&a)).map(|n| public(n, if ok && s(n, "anchor") == a { Some(&quote) } else { None })).collect();
    let threads: Vec<Value> = store
        .threads()
        .into_iter()
        .filter(|t| t["members"].as_array().unwrap().iter().any(|m| m["anchor"] == a.as_str()))
        .map(|t| json!({"id": t["id"], "name": t["name"], "color": s(t, "color")}))
        .collect();
    let mut out = json!({"anchor": a, "kind": res["kind"], "label": res["label"], "quote": res["quote"], "ok": res["ok"],
        "strongs": res["strongs"], "ref": res["ref"], "notes": here, "nearby": [], "everywhere": null,
        "highlight": null, "highlighted": false, "threads": threads});
    let kind = s(&res, "kind");
    if kind != "lemma" {
        let shown = if ok { place_colors(bible, store, &res)? } else { vec![] };
        let one = shown.first().cloned().flatten().filter(|c| shown.iter().all(|x| x.as_ref() == Some(c)));
        out["highlight"] = json!(one);
        out["highlighted"] = json!(shown.iter().any(|c| c.is_some()));
        let mut nearby = vec![];
        for nt in &notes {
            if s(nt, "anchor") != a && s(nt, "kind") != "lemma" && overlaps(&res, &py_parse(&s(nt, "anchor"))?) {
                nearby.push(public(nt, None));
            }
        }
        out["nearby"] = json!(nearby);
    }
    let strongs = res["strongs"].as_array().cloned().unwrap_or_default();
    let strong = if kind == "lemma" || (kind == "word" && !strongs.is_empty()) { strongs.first().and_then(|x| x.as_str()).unwrap_or("").to_string() } else { String::new() };
    if !strong.is_empty() {
        let lex: Option<(String, Option<String>)> =
            bible.conn().query_row("SELECT lemma, translit FROM lexicon WHERE strong = ?", [&strong], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
        let word_notes: Vec<Rec> = notes.iter().filter(|n| s(n, "kind") == "lemma" && s(n, "anchor") == strong).map(|n| public(n, None)).collect();
        let mut occ = vec![];
        for nt in notes.iter().filter(|n| s(n, "kind") == "word" && s(n, "strong") == strong && s(n, "anchor") != a) {
            let mut p = public(nt, None);
            p.insert("label".into(), json!(label(bible, &s(nt, "anchor"))?));
            occ.push(p);
        }
        out["everywhere"] = json!({"strong": strong, "lemma": lex.as_ref().map(|l| json!(l.0)).unwrap_or(json!("")),
            "translit": lex.as_ref().map(|l| json!(l.1)).unwrap_or(json!("")), "word_notes": word_notes, "occurrence_notes": occ});
    }
    Ok(out)
}

pub fn save_note(bible: &Bible, store: &mut Store, anchor: &str, text: &str, note_id: Option<&str>) -> Result<Rec> {
    if let Some(id) = note_id.filter(|i| !i.is_empty()) {
        return Ok(public(&store.update_note(id, text)?, None));
    }
    let res = resolve(bible, anchor)?;
    if res["ok"] != true {
        return Err(bad("That place is not in the text."));
    }
    let kind = s(&res, "kind");
    let strong = if kind == "word" || kind == "lemma" { res["strongs"].as_array().and_then(|a| a.first()).and_then(|x| x.as_str()).unwrap_or("").to_string() } else { String::new() };
    Ok(public(&store.add_note(&s(&res, "id"), text, &s(&res, "quote"), &strong)?, None))
}

/// The person's notes on one chapter, in reading order, with their text.
pub fn chapter_notes(bible: &Bible, store: &Store, code: &str, chapter: i64) -> Result<Vec<Value>> {
    let mut out = vec![];
    for nt in store.notes() {
        if s(nt, "kind") == "lemma" {
            continue;
        }
        // a note with more places is listed once, at the first of them in this chapter
        let mut at = None;
        for place in places_of(nt) {
            let p = py_parse(&place)?;
            if inside(&p, code, chapter) {
                at = Some((place, p));
                break;
            }
        }
        let Some((place, p)) = at else { continue };
        let res = resolve(bible, &place)?;
        let quote = if res["ok"] == true { res["quote"].clone() } else { json!(s(nt, "quote")) };
        out.push(((n(&p, "c1"), n(&p, "v1"), n(&p, "i1").unwrap_or(-1)), json!({"id": nt["id"], "anchor": nt["anchor"], "kind": nt["kind"],
            "label": res["label"], "quote": quote, "text": nt["text"]})));
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(out.into_iter().map(|x| x.1).collect())
}

// ---- highlights -----------------------------------------------------------------------------------------------------

/// Color a place, or clear it (None). A highlight reaching past the place is cut back to the part outside it, so stored
/// highlights never overlap. → {anchor, color, undo}.
pub fn save_highlight(bible: &Bible, store: &mut Store, anchor: &str, color: Option<&str>) -> Result<Value> {
    let res = resolve(bible, anchor)?;
    if res["kind"] == "lemma" {
        return Err(bad("Highlights go on words, phrases or verses."));
    }
    if res["ok"] != true {
        return Err(bad("That place is not in the text."));
    }
    let color = check_color(color)?;
    let (code, book) = (s(&res, "code"), book_of(&res));
    let span = word_span(bible, book, &res)?.ok_or_else(|| bad("That place is not in the text."))?;
    let (mut drop, mut add, mut before) = (vec![], vec![], vec![]);
    for h in store.highlights(&code) {
        let hp = py_parse(&s(&h, "anchor"))?;
        let Some(hs) = word_span(bible, book, &hp)? else { continue };
        if hs.1 < span.0 || hs.0 > span.1 {
            continue;
        }
        drop.push(s(&h, "id"));
        let left = if hs.0 < span.0 { word_at(bible, book, span.0, false, "<")?.map(|e| (hs.0, e)) } else { None };
        let right = if hs.1 > span.1 { word_at(bible, book, span.1, true, ">")?.map(|b| (b, hs.1)) } else { None };
        let verses = matches!(s(&hp, "kind").as_str(), "verse" | "verses");
        for (k, piece) in [left, right].into_iter().flatten().enumerate() {
            let a = piece_anchor(bible, &code, book, piece.0, piece.1, verses)?;
            let q = s(&resolve(bible, &a)?, "quote");
            add.push(json!({"id": if k == 0 { s(&h, "id") } else { new_id("h") }, "anchor": a, "color": h["color"], "quote": q, "created": h["created"]}).as_object().unwrap().clone());
        }
        before.push(h);
    }
    if let Some(c) = &color {
        add.push(json!({"id": new_id("h"), "anchor": res["id"], "color": c, "quote": res["quote"], "created": now()}).as_object().unwrap().clone());
    }
    let drop_ids: Vec<Value> = add.iter().map(|a| a["id"].clone()).collect();
    store.edit_highlights(&code, &drop, add)?;
    if let Some(c) = &color {
        if !COLORS.contains(&c.as_str()) {
            store.use_palette_color(c)?;
        }
    }
    Ok(json!({"anchor": res["id"], "color": color, "undo": {"code": code, "drop": drop_ids, "add": before}}))
}

/// Put back what a save_highlight cut.
pub fn undo_highlight(store: &mut Store, undo: &Value) -> Result<Value> {
    let nothing = || bad("Nothing to undo.");
    let code = undo.get("code").and_then(|c| c.as_str()).filter(|c| c.chars().count() == 3).ok_or_else(nothing)?;
    let (Some(drop), Some(add)) = (undo.get("drop").and_then(|d| d.as_array()), undo.get("add").and_then(|a| a.as_array())) else { return Err(nothing()) };
    if drop.len() > 500 || add.len() > 500 || !drop.iter().all(|i| i.as_str().is_some_and(|s| !s.is_empty() && s.chars().count() <= 80)) {
        return Err(nothing());
    }
    let mut restored = vec![];
    for h in add {
        let ok = ["id", "anchor", "created"].iter().all(|k| h.get(*k).is_some_and(|v| v.is_string()));
        if !ok {
            return Err(nothing());
        }
        let p = py_parse(h["anchor"].as_str().unwrap())?;
        let id = h["id"].as_str().unwrap();
        if p["kind"] == "lemma" || s(&p, "code") != code || id.is_empty() || id.chars().count() > 80 {
            return Err(nothing());
        }
        let color = check_color(h.get("color").and_then(|c| c.as_str()))?.unwrap_or("yellow".into());
        restored.push(json!({"id": id, "anchor": p["id"], "color": color, "quote": h.get("quote").and_then(|q| q.as_str()).unwrap_or(""), "created": h["created"]}).as_object().unwrap().clone());
    }
    let mut ids: Vec<String> = drop.iter().map(|d| d.as_str().unwrap().to_string()).collect();
    ids.extend(restored.iter().map(|h| s(h, "id")));
    store.edit_highlights(code, &ids, restored)?;
    Ok(json!({"ok": true}))
}

/// The person's highlights in Bible order; color: one exact color; thread: only those sharing a word with its places.
pub fn highlight_list(bible: &Bible, store: &Store, color: Option<&str>, thread: Option<&str>) -> Result<Value> {
    let mut spans = vec![];
    if let Some(t) = thread {
        for m in store.thread(t)?["members"].as_array().unwrap() {
            let a = m["anchor"].as_str().unwrap();
            if py_parse(a)?["kind"] == "lemma" {
                continue;
            }
            let res = resolve(bible, a)?;
            if res["ok"] == true {
                if let Some(sp) = word_span(bible, book_of(&res), &res)? {
                    spans.push((s(&res, "code"), sp));
                }
            }
        }
    }
    let mut out = vec![];
    for h in store.all_highlights() {
        if color.is_some_and(|c| s(&h, "color") != c.to_lowercase()) {
            continue;
        }
        let res = resolve(bible, &s(&h, "anchor"))?;
        let r = &res["ref"];
        if thread.is_some() {
            let hs = if r.is_null() { None } else { word_span(bible, book_of(&res), &res)? };
            let Some(hs) = hs else { continue };
            if !spans.iter().any(|(c, sp)| *c == s(&res, "code") && hs.0 <= sp.1 && sp.0 <= hs.1) {
                continue;
            }
        }
        let key = if r.is_null() { (999, 0, 0) } else { (r["b"].as_i64().unwrap(), r["c"].as_i64().unwrap(), r["v"].as_i64().unwrap()) };
        let quote = if s(&res, "quote").is_empty() { h["quote"].clone() } else { res["quote"].clone() };
        out.push((key, json!({"anchor": h["anchor"], "color": h["color"], "label": res["label"], "quote": quote, "book": if r.is_null() { Value::Null } else { r["b"].clone() }})));
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(json!(out.into_iter().map(|x| x.1).collect::<Vec<_>>()))
}

// ---- threads --------------------------------------------------------------------------------------------------------

fn thread_row(t: &Rec) -> Value {
    json!({"id": t["id"], "name": t["name"], "color": s(t, "color"), "updated": t["updated"], "count": t["members"].as_array().unwrap().len(),
        "preview": cut(&s(t, "note"), 140)})
}

/// The threads, newest-touched first; with q, only those whose name or note has every word typed.
pub fn thread_list(store: &Store, q: Option<&str>) -> Result<Value> {
    let words: Vec<String> = q.unwrap_or("").to_lowercase().split_whitespace().map(String::from).collect();
    if words.len() > 12 {
        return Err(bad("That is a lot of words (12 at most)."));
    }
    Ok(json!(store
        .threads()
        .into_iter()
        .filter(|t| {
            let blob = format!("{} {}", s(t, "name"), s(t, "note")).to_lowercase();
            words.iter().all(|w| blob.contains(w))
        })
        .map(thread_row)
        .collect::<Vec<_>>()))
}

pub fn thread_view(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let t = store.thread(id)?;
    let (mut members, mut strongs) = (vec![], Vec::<String>::new());
    for m in t["members"].as_array().unwrap() {
        let res = resolve(bible, m["anchor"].as_str().unwrap())?;
        let ok = res["ok"] == true;
        let mq = m["quote"].as_str().unwrap_or("");
        members.push(json!({"anchor": res["id"], "kind": res["kind"], "label": res["label"], "ok": res["ok"],
            "quote": if ok { res["quote"].clone() } else { m["quote"].clone() }, "strongs": res["strongs"], "ref": res["ref"],
            "drifted": ok && !mq.is_empty() && mq != s(&res, "quote")}));
        for x in res["strongs"].as_array().unwrap() {
            let x = x.as_str().unwrap().to_string();
            if !strongs.contains(&x) {
                strongs.push(x);
            }
        }
    }
    let mut brief: Map<String, Value> = Map::new();
    if !strongs.is_empty() {
        let sql = format!("SELECT strong, lemma, translit, definition FROM lexicon WHERE strong IN ({})", vec!["?"; strongs.len()].join(","));
        let mut stmt = bible.conn().prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(&strongs), |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, Option<String>>(2)?, r.get::<_, Option<String>>(3)?))
        })?;
        for r in rows {
            let (sid, lemma, tr, def) = r?;
            brief.insert(sid.clone(), json!({"strong": sid, "lemma": lemma, "translit": tr, "definition": def}));
        }
    }
    Ok(json!({"id": t["id"], "name": t["name"], "color": s(&t, "color"), "note": t["note"], "created": t["created"], "updated": t["updated"],
        "members": members, "strongs": strongs.iter().filter_map(|x| brief.get(x).cloned()).collect::<Vec<_>>()}))
}

pub fn create_thread(bible: &Bible, store: &mut Store, name: &str, note: &str, color: Option<&str>, anchor: Option<&str>) -> Result<Value> {
    if let Some(a) = anchor.filter(|a| !a.is_empty()) {
        if resolve(bible, a)?["ok"] != true {
            return Err(bad("That place is not in the text."));
        }
    }
    let t = store.create_thread(name, note, color)?;
    if let Some(a) = anchor.filter(|a| !a.is_empty()) {
        return add_to_thread(bible, store, &s(&t, "id"), a);
    }
    thread_view(bible, store, &s(&t, "id"))
}

pub fn add_to_thread(bible: &Bible, store: &mut Store, id: &str, anchor: &str) -> Result<Value> {
    let res = resolve(bible, anchor)?;
    if res["ok"] != true {
        return Err(bad("That place is not in the text."));
    }
    store.add_to_thread(id, &s(&res, "id"), &s(&res, "quote"))?;
    thread_view(bible, store, id)
}

pub const MAX_ADD: usize = 1000;

/// Several places into a thread in one write. Nothing is added unless every place is in the text.
pub fn add_many_to_thread(bible: &Bible, store: &mut Store, id: &str, list: &[String]) -> Result<Value> {
    if list.is_empty() {
        return Err(bad("Name at least one place to add."));
    }
    if list.len() > MAX_ADD {
        return Err(bad(format!("That is {} places, and {MAX_ADD} is the most at once. Limit it to a book or a group of books first.", list.len())));
    }
    let mut items = vec![];
    for a in list {
        let res = resolve(bible, a)?;
        if res["ok"] != true {
            return Err(bad(format!("{} is not in the text.", s(&res, "label"))));
        }
        items.push((s(&res, "id"), s(&res, "quote")));
    }
    let added = store.add_many_to_thread(id, &items)?;
    let t = store.thread(id)?;
    let mut distinct: Vec<&String> = items.iter().map(|i| &i.0).collect();
    distinct.sort();
    distinct.dedup();
    Ok(json!({"id": t["id"], "name": t["name"], "added": added, "already": distinct.len() - added.len(), "count": t["members"].as_array().unwrap().len()}))
}

/// The one anchor of a thread a place means: its number in the list, the exact anchor, or the one in those verses.
fn member_at(bible: &Bible, store: &Store, id: &str, place: &Value) -> Result<String> {
    let members: Vec<String> = store.thread(id)?["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect();
    let as_num = match place {
        Value::Number(x) => x.as_i64(),
        Value::String(t) if !t.is_empty() && t.chars().all(|c| c.is_ascii_digit()) => t.parse().ok(),
        _ => None,
    };
    if let Some(k) = as_num {
        if k < 1 || k as usize > members.len() {
            return Err(bad(format!("The thread has {} place{}; there is no number {k}.", members.len(), if members.len() == 1 { "" } else { "s" })));
        }
        return Ok(members[k as usize - 1].clone());
    }
    let target = py_parse(place.as_str().unwrap_or(""))?;
    let tid = s(&target, "id");
    if members.contains(&tid) {
        return Ok(tid);
    }
    let mut hits = vec![];
    if target["kind"] != "lemma" {
        for a in &members {
            let p = py_parse(a)?;
            if p["kind"] != "lemma" && overlaps(&p, &target) {
                hits.push(a.clone());
            }
        }
    }
    if hits.is_empty() {
        return Err(bad(format!("The thread has nothing at {}.", label(bible, &tid)?)));
    }
    if hits.len() > 1 {
        let mut parts = vec![];
        for a in &hits {
            let r = resolve(bible, a)?;
            let k = s(&r, "kind");
            let l = if k == "word" || k == "phrase" { format!("{} “{}”", s(&r, "label"), cut(&s(&r, "quote"), 30)) } else { s(&r, "label") };
            parts.push(format!("{} {l}", members.iter().position(|m| m == a).unwrap() + 1));
        }
        return Err(bad(format!("Which one? Give its number: {}", parts.join(" · "))));
    }
    Ok(hits.remove(0))
}

pub fn move_in_thread(bible: &Bible, store: &mut Store, id: &str, place: &Value, to: &str) -> Result<Value> {
    let anchor = member_at(bible, store, id, place)?;
    let before: Vec<String> = store.thread(id)?["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect();
    let at = before.iter().position(|a| *a == anchor).unwrap() as i64;
    let new = match to {
        "up" => at - 1,
        "down" => at + 1,
        "first" => 0,
        "last" => before.len() as i64 - 1,
        t if !t.is_empty() && t.chars().all(|c| c.is_ascii_digit()) => t.parse::<i64>().unwrap_or(0) - 1,
        _ => return Err(bad("Move it up, down, first, last or to a number.")),
    };
    let new = new.min(before.len() as i64 - 1).max(0) as usize;
    let mut order: Vec<String> = before.iter().filter(|a| **a != anchor).cloned().collect();
    order.insert(new, anchor.clone());
    let moved = store.order_thread(id, &order)?;
    let mut v = thread_view(bible, store, id)?;
    let m = v.as_object_mut().unwrap();
    m.insert("moved".into(), json!(moved));
    m.insert("before".into(), json!(before));
    m.insert("position".into(), json!(new + 1));
    m.insert("anchor".into(), json!(anchor));
    Ok(v)
}

/// Bible order: by book, chapter, verse and word, a whole verse before a word in it; original words go last.
pub fn sort_thread(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let before: Vec<String> = store.thread(id)?["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect();
    let key = |a: &String| -> (i64, i64, i64, i64, i64, i64, i64, i64) {
        let p = py_parse(a).unwrap();
        if p["kind"] == "lemma" {
            return (1, 0, 0, 0, 0, 0, 0, 0);
        }
        let i1 = n(&p, "i1").unwrap_or(-1);
        let (c2, v2) = if p["c2"].is_null() { (n(&p, "c1").unwrap(), n(&p, "v1").unwrap()) } else { (n(&p, "c2").unwrap(), n(&p, "v2").unwrap()) };
        let i2 = n(&p, "i2").unwrap_or(i1);
        let b = bible.books().iter().find(|b| b.code == s(&p, "code")).map(|b| b.id as i64).unwrap_or(1_000_000);
        (0, b, n(&p, "c1").unwrap(), n(&p, "v1").unwrap(), i1, c2, v2, i2)
    };
    let mut sorted = before.clone();
    sorted.sort_by_key(key);
    let changed = store.order_thread(id, &sorted)?;
    let mut v = thread_view(bible, store, id)?;
    let m = v.as_object_mut().unwrap();
    m.insert("changed".into(), json!(changed));
    m.insert("before".into(), json!(before));
    Ok(v)
}

/// Take every member of a thread that sits at a place (a verse, a run, or a Strong's number) out of it.
pub fn remove_place(bible: &Bible, store: &mut Store, id: &str, anchor: &str) -> Result<Value> {
    let target = py_parse(anchor)?;
    let thread = store.thread(id)?;
    let mut gone = vec![];
    for m in thread["members"].as_array().unwrap() {
        let p = py_parse(m["anchor"].as_str().unwrap())?;
        let hit = if target["kind"] == "lemma" { p["kind"] == "lemma" && p["id"] == target["id"] } else { p["kind"] != "lemma" && overlaps(&p, &target) };
        if hit {
            gone.push(s(m.as_object().unwrap(), "anchor"));
        }
    }
    if gone.is_empty() {
        return Err(bad(format!("“{}” has no anchor at {}.", s(&thread, "name"), label(bible, &s(&target, "id"))?)));
    }
    let mut removed = vec![];
    for a in &gone {
        store.remove_from_thread(id, a)?;
        removed.push(json!({"anchor": a, "label": label(bible, a)?}));
    }
    Ok(json!({"name": thread["name"], "removed": removed}))
}

// ---- sets -----------------------------------------------------------------------------------------------------------

/// A set with each item named as it stands now; something deleted since it was added stays listed, marked gone.
fn s_val(v: &Value) -> String {
    v.as_str().unwrap_or("").to_string()
}

pub fn set_view(bible: &Bible, store: &Store, t: &Rec) -> Result<Value> {
    let threads: Vec<&Rec> = store.threads();
    let lessons = lesson_listing(store)?;
    let mut items = vec![];
    for i in t["items"].as_array().unwrap() {
        let kind = i["kind"].as_str().unwrap_or("");
        let r = i.get("ref").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let mut view = i.as_object().unwrap().clone();
        match kind {
            "pane" => {
                view.insert("label".into(), i["title"].clone());
            }
            "thread" => {
                let th = threads.iter().find(|x| s(x, "id") == r);
                view.insert("label".into(), th.map(|x| x["name"].clone()).unwrap_or(json!(r)));
                view.insert("color".into(), th.map(|x| x["color"].clone()).unwrap_or(json!("")));
                view.insert("gone".into(), json!(th.is_none()));
            }
            "place" => {
                let res = resolve(bible, &r)?;
                view.insert("label".into(), res["label"].clone());
                view.insert("gone".into(), json!(res["ok"] != true));
            }
            "note" => {
                // any page, placed or not (a saved page is a "note" item whose ref is the page's id)
                let nt = store.find_note(&r).ok();
                let anchor = nt.as_ref().map(|x| s(x, "anchor")).unwrap_or_default();
                let label_text = match &nt {
                    Some(x) if anchor.is_empty() => crate::notebook::title_of(&s(x, "text")),
                    Some(_) => label(bible, &anchor)?,
                    None => r.clone(),
                };
                view.insert("label".into(), json!(label_text));
                view.insert("snippet".into(), json!(nt.as_ref().map(|x| cut(&s(x, "text"), 90)).unwrap_or_default()));
                view.insert("anchor".into(), json!(anchor));
                view.insert("gone".into(), json!(nt.is_none()));
            }
            "sitting" => {
                let found = crate::history::sitting(&store.root, &r).ok();
                view.insert("label".into(), json!(found.as_ref().map(|x| format!("Sitting: {}", s_val(&x["title"]))).unwrap_or_else(|| r.clone())));
                view.insert("gone".into(), json!(found.is_none()));
            }
            "lesson" => {
                let l = lessons.iter().find(|x| x["id"] == r.as_str());
                view.insert("label".into(), l.map(|x| x["title"].clone()).unwrap_or(json!(r)));
                view.insert("gone".into(), json!(l.is_none()));
            }
            _ => {
                let lower = r.to_lowercase();
                view.insert("label".into(), json!(if lower.ends_with(".pdf") { r[..r.len() - 4].to_string() } else { r.clone() }));
            }
        }
        items.push(Value::Object(view));
    }
    let mut out = json!({"id": t["id"], "name": t["name"], "updated": t["updated"], "items": items});
    if let Some(k) = t.get("keys") {
        out["keys"] = k.clone();
    }
    Ok(out)
}

pub fn set_list(bible: &Bible, store: &Store) -> Result<Value> {
    Ok(json!(store.sets().iter().map(|t| set_view(bible, store, t)).collect::<Result<Vec<_>>>()?))
}

// ---- trails, find ---------------------------------------------------------------------------------------------------

fn trail_public(t: &Rec, label: &str) -> Value {
    json!({"id": t["id"], "anchor": t["anchor"], "kind": t["kind"], "quote": s(t, "quote"), "status": t["status"],
        "created": t["created"], "updated": t["updated"], "text": t["text"], "label": label})
}

pub fn trail_list(bible: &Bible, store: &Store, status: &str) -> Result<Value> {
    if !["open", "done", "all"].contains(&status) {
        return Err(bad("Status must be open, done or all."));
    }
    let mut out = vec![];
    let mut counts = json!({"open": 0, "done": 0});
    for t in store.trails() {
        let st = s(t, "status");
        if status == "all" || st == status {
            out.push(trail_public(t, &label(bible, &s(t, "anchor"))?));
        }
        let c = counts.get(&st).and_then(|x| x.as_i64()).unwrap_or(0);
        counts[st] = json!(c + 1);
    }
    Ok(json!({"trails": out, "counts": counts}))
}

/// The questions on a place and on any part of it or around it (a question on words of a verse shows at the verse, and a
/// question on the verse shows at a word of it): `here` is true when the question is on this very place. Questions with
/// no place yet (the Inbox) are not listed. Rust only (`wb trail list --at`).
pub fn trail_at(bible: &Bible, store: &Store, anchor: &str, status: &str) -> Result<Value> {
    if !["open", "done", "all"].contains(&status) {
        return Err(bad("Status must be open, done or all."));
    }
    let res = resolve(bible, anchor)?;
    let a = s(&res, "id");
    let lemma = s(&res, "kind") == "lemma";
    let mut out = vec![];
    for t in store.trails() {
        if status != "all" && s(t, "status") != status {
            continue;
        }
        let places = places_of(t);
        let here = places.iter().any(|p| *p == a);
        let near = !lemma
            && places.iter().any(|p| !p.is_empty() && !p.starts_with('H') && !p.starts_with('G') && py_parse(p).map(|q| overlaps(&res, &q)).unwrap_or(false));
        if here || near {
            let mut v = trail_public(t, &label(bible, &s(t, "anchor"))?);
            v["here"] = json!(here);
            out.push(v);
        }
    }
    Ok(json!({"anchor": a, "label": res["label"], "trails": out}))
}

pub fn save_trail(bible: &Bible, store: &mut Store, anchor: &str, text: &str) -> Result<Value> {
    let res = resolve(bible, anchor)?;
    if res["ok"] != true {
        return Err(bad("That place is not in the text."));
    }
    let t = store.add_trail(&s(&res, "id"), text, &s(&res, "quote"))?;
    Ok(trail_public(&t, &s(&res, "label")))
}

/// A short stretch of text around the first matching word.
fn snippet(text: &str, words: &[String]) -> String {
    let low: Vec<char> = text.to_lowercase().chars().collect();
    let low_s: String = low.iter().collect();
    let at = words
        .iter()
        .filter_map(|w| low_s.find(w.as_str()).map(|b| low_s[..b].chars().count()))
        .min()
        .unwrap_or(0);
    let start = at.saturating_sub(140 / 3);
    let chars: Vec<char> = text.chars().collect();
    let body: String = chars.iter().skip(start).take(140).collect::<String>().replace('\n', " ");
    format!("{}{body}{}", if start > 0 { "…" } else { "" }, if start + 140 < chars.len() { "…" } else { "" })
}

/// Search the person's own words: notes, thread names and notes, and trails. Every word typed must appear.
pub fn find_mine(bible: &Bible, store: &Store, q: &str) -> Result<Value> {
    let words: Vec<String> = q.to_lowercase().split_whitespace().map(String::from).collect();
    if words.is_empty() {
        return Err(bad("Type a word or two to look for in your notes."));
    }
    if words.len() > 12 {
        return Err(bad("That is a lot of words (12 at most)."));
    }
    let hit = |parts: &[String]| {
        let blob = parts.iter().filter(|p| !p.is_empty()).cloned().collect::<Vec<_>>().join(" ").to_lowercase();
        words.iter().all(|w| blob.contains(w.as_str()))
    };
    let (mut notes, mut threads, mut trails) = (vec![], vec![], vec![]);
    for nt in store.notes() {
        if hit(&[s(nt, "text"), s(nt, "quote")]) {
            notes.push(json!({"id": nt["id"], "anchor": nt["anchor"], "kind": nt["kind"], "label": label(bible, &s(nt, "anchor"))?,
                "quote": s(nt, "quote"), "snippet": snippet(&s(nt, "text"), &words), "updated": nt["updated"]}));
        }
    }
    for t in store.threads() {
        if hit(&[s(t, "name"), s(t, "note")]) {
            threads.push(json!({"id": t["id"], "name": t["name"], "count": t["members"].as_array().unwrap().len(),
                "snippet": if s(t, "note").is_empty() { String::new() } else { snippet(&s(t, "note"), &words) }}));
        }
    }
    for t in store.trails() {
        if hit(&[s(t, "text"), s(t, "quote")]) {
            trails.push(json!({"id": t["id"], "anchor": t["anchor"], "label": label(bible, &s(t, "anchor"))?, "status": t["status"],
                "snippet": snippet(&s(t, "text"), &words)}));
        }
    }
    Ok(json!({"q": q.trim(), "notes": notes, "threads": threads, "trails": trails}))
}

// ---- lessons (the files; building documents from them is phase 5) -------------------------------------------------

pub fn lesson_slug(name: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for c in name.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            out.push(c);
            dash = false;
        } else if !dash {
            out.push('-');
            dash = true;
        }
    }
    out.trim_matches('-').chars().take(60).collect()
}

fn title_of(text: &str) -> String {
    text.lines().find_map(|l| l.strip_prefix("# ")).map(|t| t.trim().to_string()).unwrap_or_default()
}

pub fn lesson_listing(store: &Store) -> Result<Vec<Value>> {
    let dir = store.root.join("lessons");
    let Ok(rd) = fs::read_dir(&dir) else { return Ok(vec![]) };
    let mut ps: Vec<_> = rd.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "md")).collect();
    ps.sort();
    let mut out = vec![];
    for p in ps {
        let text = fs::read_to_string(&p)?;
        let id = p.file_stem().unwrap().to_string_lossy().to_string();
        let modified = fs::metadata(&p)?.modified()?.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(0.0);
        let t = title_of(&text);
        out.push(json!({"id": id, "title": if t.is_empty() { id.clone() } else { t }, "words": text.split_whitespace().count(),
            "places": text.lines().filter(|l| l.starts_with('@')).count(), "modified": modified}));
    }
    Ok(out)
}

pub fn lesson_find(store: &Store, name: &str) -> Result<String> {
    let want = lesson_slug(name);
    let ids: Vec<String> = lesson_listing(store)?.iter().map(|x| x["id"].as_str().unwrap().to_string()).collect();
    let pools: [Vec<&String>; 3] = [ids.iter().filter(|i| **i == want).collect(), ids.iter().filter(|i| i.starts_with(&want)).collect(), ids.iter().filter(|i| i.contains(&want)).collect()];
    let hit = pools.into_iter().find(|p| !p.is_empty()).unwrap_or_default();
    if hit.is_empty() {
        return Err(missing(format!("No lesson called “{}”.", cut(name.trim(), 60))));
    }
    if hit.len() > 1 {
        return Err(bad(format!("Which lesson? {}", hit.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", "))));
    }
    Ok(hit[0].clone())
}

pub fn lesson_read(store: &Store, name: &str) -> Result<Value> {
    let id = lesson_find(store, name)?;
    Ok(json!({"id": id, "text": fs::read_to_string(store.root.join("lessons").join(format!("{id}.md")))?}))
}

pub fn lesson_save(store: &Store, name: &str, text: &str, append: bool) -> Result<Value> {
    if text.len() > 400_000 {
        return Err(bad("A lesson is plain text of up to 400 KB."));
    }
    let slug = lesson_slug(name);
    if slug.is_empty() {
        return Err(bad("A lesson needs a name."));
    }
    let path = store.root.join("lessons").join(format!("{slug}.md"));
    let mut text = text.to_string();
    if append && path.exists() {
        let old = fs::read_to_string(&path)?;
        text = format!("{}\n\n{}", old.trim_end_matches('\n'), text.trim_matches('\n'));
    }
    crate::store::write_atomic(&path, &(text.replace("\r\n", "\n").trim_end_matches('\n').to_string() + "\n"))?;
    let t = title_of(&text);
    Ok(json!({"id": slug, "title": if t.is_empty() { slug.clone() } else { t }}))
}

pub fn lesson_delete(store: &Store, name: &str) -> Result<Value> {
    let id = lesson_find(store, name)?;
    let path = store.root.join("lessons").join(format!("{id}.md"));
    let dest = store.root.join(".trash").join(format!("{}-{id}.md", chrono::Utc::now().format("%Y%m%d-%H%M%S")));
    fs::create_dir_all(dest.parent().unwrap())?;
    fs::rename(path, dest)?;
    Ok(json!({"ok": true, "id": id}))
}


/// A lesson read the way a build reads it: (kind, value) blocks of title, section, speech, note, scripture (a passage),
/// parallel (two passages, KJV and YLT side by side) and word (a Strong's number). An error names the first line that
/// cannot be read.
pub fn lesson_parse(bible: &Bible, text: &str) -> Result<Vec<(&'static str, Value)>> {
    let version_re = regex::Regex::new(r"(?i)^(.*\S)\s+(kjv|ylt)\s*$").unwrap();
    let mut blocks: Vec<(&'static str, Value)> = vec![];
    let mut para: Vec<String> = vec![];
    let flush = |blocks: &mut Vec<(&'static str, Value)>, para: &mut Vec<String>| {
        if !para.is_empty() {
            blocks.push(("speech", json!(para.join(" "))));
            para.clear();
        }
    };
    for (k, raw) in text.replace("\r\n", "\n").split('\n').enumerate() {
        let line = raw.trim();
        let n = k + 1;
        if line.is_empty() {
            flush(&mut blocks, &mut para);
        } else if let Some(t) = line.strip_prefix("## ") {
            flush(&mut blocks, &mut para);
            blocks.push(("section", json!(t.trim())));
        } else if let Some(t) = line.strip_prefix("# ") {
            flush(&mut blocks, &mut para);
            blocks.push(("title", json!(t.trim())));
        } else if let Some(t) = line.strip_prefix("//") {
            flush(&mut blocks, &mut para);
            blocks.push(("note", json!(t.trim())));
        } else if let Some(r) = line.strip_prefix('@') {
            flush(&mut blocks, &mut para);
            let (mut place, mut version) = (r.trim().to_string(), "KJV".to_string());
            if let Some(m) = version_re.captures(&place.clone()) {
                place = m[1].to_string();
                version = m[2].to_uppercase();
            }
            let psg = crate::scripture::passage(bible, &place, &version).map_err(|e| bad(format!("Line {n} ({}): {}", cut(line, 40), e.0)))?;
            match blocks.last() {
                Some(("scripture", prev)) if prev["label"] == psg["label"] && prev["version"] != json!(version) => {
                    let prev = prev.clone();
                    *blocks.last_mut().unwrap() = ("parallel", json!([prev, psg]));
                }
                _ => blocks.push(("scripture", psg)),
            }
        } else if line.len() >= 3 && line.starts_with('&') && crate::lookup::is_strong(&line[1..].to_uppercase()) {
            flush(&mut blocks, &mut para);
            let sid = line[1..].to_uppercase();
            if crate::lookup::strong(bible, &sid)?.is_none() {
                return Err(bad(format!("Line {n} ({}): no such Strong's number.", cut(line, 40))));
            }
            blocks.push(("word", json!(sid)));
        } else {
            para.push(line.to_string());
        }
    }
    flush(&mut blocks, &mut para);
    Ok(blocks)
}

const SLIDE_VERSES: usize = 3;
const SLIDE_CHARS: usize = 340;

/// How many slides a passage takes: cut at verse boundaries, at most 3 verses or 340 characters, and between places.
fn slides_for(verses: &[Value]) -> usize {
    let (mut out, mut rows, mut size) = (0, 0usize, 0usize);
    let mut last_span: Option<Value> = None;
    for v in verses {
        let len = v["text"].as_str().unwrap_or("").chars().count();
        if rows > 0 && (rows >= SLIDE_VERSES || size + len > SLIDE_CHARS || v.get("span") != last_span.as_ref()) {
            out += 1;
            rows = 0;
            size = 0;
        }
        rows += 1;
        size += len;
        last_span = v.get("span").cloned();
    }
    out + (rows > 0) as usize
}

/// What a build would use, without making anything: the title, every scripture with its verse count, and how many
/// slides the Pulpit deck would have.
pub fn lesson_check(bible: &Bible, store: &Store, name: &str) -> Result<Value> {
    let lesson = lesson_read(store, name)?;
    let text = lesson["text"].as_str().unwrap();
    let blocks = lesson_parse(bible, text)?;
    let mut passages = vec![];
    let mut slides = 1; // the title slide
    for (k, v) in &blocks {
        match *k {
            "section" | "word" => slides += 1,
            "scripture" => {
                passages.push(v.clone());
                slides += slides_for(v["verses"].as_array().unwrap());
            }
            "parallel" => {
                passages.extend(v.as_array().unwrap().iter().cloned());
                slides += 1;
            }
            _ => {}
        }
    }
    let title = title_of(text);
    Ok(json!({"id": lesson["id"], "title": if title.is_empty() { lesson["id"].clone() } else { json!(title) },
        "sections": blocks.iter().filter(|b| b.0 == "section").count(), "words": text.split_whitespace().count(),
        "places": passages.iter().map(|p| json!({"label": p["label"], "version": p["version"], "verses": p["verses"].as_array().unwrap().len()})).collect::<Vec<_>>(),
        "slides": slides}))
}
