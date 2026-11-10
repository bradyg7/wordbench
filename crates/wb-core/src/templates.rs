//! Templates (W5 of "The Notebook as a workspace", 2026-11-07; sheets W6.1 to W6.3 of docs/workspace-design.md).
//!
//! A template is an ordinary note with `template: true` in its front matter: a page with no place (in `notes/_inbox/`,
//! so the Python app passes over it as it does every page, and Obsidian opens it as a note). The Notebook leaves
//! templates out of Pages, Places, its lists and search, and lists them under Templates. Its settings are front-matter
//! fields too: `new_name` (the name new pages get), `asks: place` (it asks for a place) and `goes_in` (the page new pages
//! go inside; absent: Pages). The Notebook starts with no templates (the person's choice, 2026-11-07): + makes one, and
//! Save as a template copies any page.
//!
//! **Blanks**, filled when a page is made: `{place}` the place picked, `{date}` the day it is made, `{title}` the new
//! page's name, `{reader}` the chapter in the reader then. A scripture block in a template holds `{place}` and becomes
//! the place's verses in the new page (the file still holds only the reference). A page made from a template carries
//! `from_template`, the template's id; a template's "used N times" counts them.

use crate::bible::Bible;
use crate::commands::{span_ref, view_line, ViewQuery};
use crate::notebook as nb;
use crate::pages::{self, chars, split, sub};
use crate::store::{bad, missing, s, Store};
use crate::Result;
use chrono::Local;
use serde_json::{json, Value};

/// The blanks a template can hold, with what each is filled with.
pub const BLANKS: &[(&str, &str)] = &[
    ("{place}", "The place picked when the page is made"),
    ("{date}", "The day it is made"),
    ("{title}", "The new page's name"),
    ("{reader}", "The chapter in the reader then"),
];

fn id_of(e: &Value) -> String {
    e["id"].as_str().unwrap_or("").to_string()
}

/// Every template's entry, oldest first.
fn all(bible: &Bible, store: &Store) -> Vec<Value> {
    let mut v: Vec<Value> = nb::every(bible, store).into_iter().filter(nb::is_template).collect();
    v.sort_by(|a, b| a["created"].as_str().cmp(&b["created"].as_str()));
    v
}

/// What a template holds, in a few words: "3 headings, a scripture block" (W6.1), and its headings (W6.3).
fn holds(text: &str) -> (String, Vec<String>) {
    let c = chars(text);
    let bs = split(text, true).1;
    let mut headings = vec![];
    let (mut h, mut sc, mut vw, mut td, mut other) = (0, 0, 0, 0, 0);
    for b in &bs {
        let t = sub(&c, b.start, b.end);
        match b.kind {
            "heading" => {
                h += 1;
                headings.push(t.trim_start_matches('#').trim().to_string());
            }
            "fence" if pages::scripture_fence(&t).is_some() => sc += 1,
            "fence" if crate::pageviews::view_fence(&t).is_some() => vw += 1,
            "todo" => td += 1,
            _ => other += 1,
        }
    }
    let n = |k: usize, one: &str, many: &str| match k {
        0 => None,
        1 => Some(one.to_string()),
        k => Some(format!("{k} {many}")),
    };
    let parts: Vec<String> = [n(h, "a heading", "headings"), n(sc, "a scripture block", "scripture blocks"), n(vw, "a view", "views"), n(td, "a to-do", "to-dos"), n(other, "a block of writing", "blocks of writing")]
        .into_iter()
        .flatten()
        .collect();
    (if parts.is_empty() { "Empty".into() } else { parts.join(", ") }, headings)
}

/// A template as Templates lists it: its name, what it holds, its settings, and how many pages were made from it.
fn row(e: &Value, every: &[Value]) -> Value {
    let id = id_of(e);
    let text = e["text"].as_str().unwrap_or("");
    let (summary, headings) = holds(text);
    let used = every.iter().filter(|x| x["from_template"] == id.as_str()).count();
    let goes = e["goes_in"].as_str().filter(|g| !g.is_empty());
    let goes_title = goes.and_then(|g| every.iter().find(|x| x["id"] == g)).map(|x| x["title"].clone());
    json!({
        "id": id, "title": e["title"], "summary": summary, "headings": headings,
        "asks": if e["asks"] == "place" { "place" } else { "" },
        "new_name": e["new_name"].as_str().filter(|n| !n.trim().is_empty()).map(String::from).unwrap_or_else(|| default_name(e["title"].as_str().unwrap_or(""), false)),
        // a page it goes inside that is gone: Pages
        "goes_in": if goes_title.is_some() { json!(goes) } else { Value::Null },
        "goes_in_title": goes_title.unwrap_or(Value::Null),
        "used": used, "created": e["created"], "updated": e["updated"],
    })
}

fn default_name(name: &str, place: bool) -> String {
    format!("{}: {}", name.trim(), if place { "{place}" } else { "{date}" })
}

/// The Notebook's Templates (W6.2, W6.3), each as a row.
pub fn rows(bible: &Bible, store: &Store) -> Vec<Value> {
    let every = nb::every(bible, store);
    all(bible, store).iter().map(|e| row(e, &every)).collect()
}

/// `wb template list`: every template with what it holds, what it asks for, where its pages go, and how often used.
pub fn list(bible: &Bible, store: &Store) -> Result<Value> {
    Ok(json!({"templates": rows(bible, store)}))
}

/// A template by its id or its name (any case), else the one whose name starts with it.
fn find(bible: &Bible, store: &Store, key: &str) -> Result<Value> {
    let k = key.trim().to_lowercase();
    if k.is_empty() {
        return Err(bad("Name the template: wb template list names them."));
    }
    let ts = all(bible, store);
    if let Some(t) = ts.iter().find(|t| id_of(t) == key.trim() || t["title"].as_str().is_some_and(|x| x.to_lowercase() == k)) {
        return Ok(t.clone());
    }
    let hits: Vec<&Value> = ts.iter().filter(|t| t["title"].as_str().is_some_and(|x| x.to_lowercase().starts_with(&k))).collect();
    match hits.len() {
        1 => Ok(hits[0].clone()),
        0 => Err(missing(format!("No template called “{}” (wb template list names them).", key.trim()))),
        n => Err(bad(format!("{n} templates start with “{}”: give more of the name.", key.trim()))),
    }
}

/// What fills each blank when a page is made.
pub struct Fill {
    pub place: String,
    pub date: String,
    pub title: String,
    pub reader: String,
}

/// A text with its blanks filled; a blank a template does not know stays as it is written.
pub fn fill(text: &str, f: &Fill) -> String {
    text.replace("{place}", &f.place).replace("{date}", &f.date).replace("{title}", &f.title).replace("{reader}", &f.reader)
}

/// A place as typed, as a reference that reads again ("Num 25" → "Numbers 25"; "h7065" → "H7065").
fn reference(bible: &Bible, text: &str) -> Result<String> {
    let t = text.trim();
    let up = t.to_uppercase();
    if (up.starts_with('H') || up.starts_with('G')) && up.len() > 1 && up.len() <= 6 && up[1..].bytes().all(|b| b.is_ascii_digit()) {
        return Ok(up);
    }
    Ok(span_ref(&crate::places::parse_span(t, bible.books())?))
}

/// What a page made from a template now would be: its name, and its text (blanks filled).
fn made(bible: &Bible, t: &Value, place: Option<&str>, title: Option<&str>, reader: Option<&str>) -> Result<(String, String)> {
    let name = t["title"].as_str().unwrap_or("").to_string();
    let place = place.map(str::trim).filter(|p| !p.is_empty());
    if t["asks"] == "place" && place.is_none() {
        return Err(bad(format!("“{name}” asks for a place: give one, like --place \"Num 25\".")));
    }
    let place = match place {
        Some(p) => reference(bible, p)?,
        None => String::new(),
    };
    let reader = match reader.map(str::trim).filter(|r| !r.is_empty()) {
        Some(r) => reference(bible, r)?,
        None => place.clone(),
    };
    let date = nb::day_label(Local::now().date_naive());
    let new_name = t["new_name"].as_str().filter(|n| !n.trim().is_empty()).map(String::from).unwrap_or_else(|| default_name(&name, false));
    let mut f = Fill { place, date, title: name.clone(), reader };
    let title = match title.map(str::trim).filter(|t| !t.is_empty()) {
        Some(t) => t.to_string(),
        None => fill(&new_name, &f).trim().trim_end_matches(':').trim().to_string(),
    };
    if title.contains('\n') {
        return Err(bad("A page's name is one line."));
    }
    f.title = title.clone();
    let text = t["text"].as_str().unwrap_or("");
    let c = chars(text);
    let body = match split(text, true).0 {
        Some((_, end)) => sub(&c, end, c.len()),
        None => String::new(),
    };
    Ok((title.clone(), format!("{title}{}", fill(&body, &f))))
}

/// `wb template show`: a template whole (its text, blocks, settings, how often used); with a place (and the reader's
/// chapter), what a page made from it now would be named and hold (`made`), as the window previews it.
pub fn show(bible: &Bible, store: &Store, key: &str, place: Option<&str>, reader: Option<&str>) -> Result<Value> {
    show_with_title(bible, store, key, place, reader, None)
}

pub fn show_with_title(bible: &Bible, store: &Store, key: &str, place: Option<&str>, reader: Option<&str>, title: Option<&str>) -> Result<Value> {
    let t = find(bible, store, key)?;
    let every = nb::every(bible, store);
    let mut v = row(&t, &every);
    v["text"] = t["text"].clone();
    v["blocks"] = pages::blocks(store, &id_of(&t))?["blocks"].clone();
    if place.is_some() || t["asks"] != "place" {
        let (title, text) = made(bible, &t, place, title, reader)?;
        v["made"] = json!({"title": title, "text": text});
    }
    Ok(v)
}

/// How a page is made from a template: the place for `{place}`, its name (else the template's `new_name`, filled), the
/// reader's chapter for `{reader}` (else the place), and the page it goes inside (else the template's `goes_in`).
#[derive(Default)]
pub struct Make<'a> {
    pub place: Option<&'a str>,
    pub title: Option<&'a str>,
    pub reader: Option<&'a str>,
    pub parent: Option<&'a str>,
}

/// A new page from a template (W6.1's Make the page; `wb page new --template`): its blocks copied, the blanks filled,
/// `from_template` written in it. → its entry.
pub fn make_page(bible: &Bible, store: &mut Store, key: &str, m: Make<'_>) -> Result<Value> {
    let t = find(bible, store, key)?;
    let (_, text) = made(bible, &t, m.place, m.title, m.reader)?;
    let goes = t["goes_in"].as_str().filter(|g| !g.is_empty()).filter(|g| nb::every(bible, store).iter().any(|e| e["id"] == *g && !nb::is_template(e)));
    let parent = m.parent.map(str::trim).filter(|p| !p.is_empty()).or(goes);
    let e = pages::new_page(bible, store, parent, &text, false, None)?;
    let id = id_of(&e);
    store.set_fields(&id, &[("from_template", Some(json!(id_of(&t))))])?;
    nb::show(bible, store, &id)
}

/// A new template, empty but for its name (W6.2's +). It asks for nothing and names its pages "<name>: {date}" until
/// its settings are changed. → its row.
pub fn new_template(bible: &Bible, store: &mut Store, name: &str) -> Result<Value> {
    let name = name.trim();
    if name.is_empty() || name.contains('\n') {
        return Err(bad("A template's name is one line with something on it."));
    }
    make(bible, store, name, name, false)
}

fn make(bible: &Bible, store: &mut Store, name: &str, text: &str, asks: bool) -> Result<Value> {
    if all(bible, store).iter().any(|t| t["title"].as_str().is_some_and(|x| x.eq_ignore_ascii_case(name))) {
        return Err(bad(format!("There is a template called “{name}” already.")));
    }
    let r = store.jot(text, false)?;
    let id = s(&r, "id");
    let mut fields = vec![("template", Some(json!(true))), ("new_name", Some(json!(default_name(name, asks))))];
    if asks {
        fields.push(("asks", Some(json!("place"))));
    }
    store.set_fields(&id, &fields)?;
    let every = nb::every(bible, store);
    let e = every.iter().find(|e| e["id"] == id.as_str()).ok_or_else(|| missing("The template was not written."))?;
    Ok(row(e, &every))
}

/// A view's line with its place made the blank `{place}` (the rest as it was read).
fn view_without_place(q: &ViewQuery) -> String {
    let mut out = vec!["notebook".to_string(), "@{place}".to_string()];
    match q.questions.as_deref() {
        Some("all") => out.push("questions".into()),
        Some(x) => out.push(x.into()),
        None => {}
    }
    if q.pages {
        out.push("pages".into());
    }
    if let Some(t) = &q.thread {
        out.push(if t.contains(' ') { format!("thread \"{t}\"") } else { format!("thread {t}") });
    }
    if let Some(d) = q.days {
        out.push(format!("days {d}"));
    }
    out.extend(q.words.iter().cloned());
    out.join(" ")
}

/// Save as a template (W6.2, any page's ⋯): a copy of the page as a new template, its places taken out: the copy has
/// no place, thread or page above it, and each scripture block's reference and each view's @place become `{place}`
/// (so the template asks for a place). Its name is the page's title unless another is given. → its row.
pub fn save_as(bible: &Bible, store: &mut Store, page: &str, name: Option<&str>) -> Result<Value> {
    let (id, text, titled) = pages::text_of(store, page)?;
    if !titled {
        return Err(bad("A day's page is not made a template: copy what you want into a new page first."));
    }
    let e = nb::show(bible, store, &id)?;
    if nb::is_template(&e) {
        return Err(bad("That is a template already."));
    }
    let name = name.map(str::trim).filter(|n| !n.is_empty()).map(String::from).unwrap_or_else(|| e["title"].as_str().unwrap_or("").to_string());
    if name.is_empty() || name.contains('\n') {
        return Err(bad("A template's name is one line with something on it."));
    }
    let c = chars(&text);
    let (_, bs) = split(&text, true);
    let mut body = String::new();
    let mut at = split(&text, true).0.map(|t| t.1).unwrap_or(0);
    let mut asks = false;
    for b in &bs {
        body += &sub(&c, at, b.start);
        let t = sub(&c, b.start, b.end);
        if let Some(mut f) = pages::scripture_fence(&t) {
            f.reference = "{place}".into();
            asks = true;
            body += &pages::scripture_fence_text(&f);
        } else if let Some(line) = crate::pageviews::view_fence(&t) {
            match view_line(&line, bible.books()) {
                Ok(q) if q.place.is_some() => {
                    asks = true;
                    body += &format!("```view\n{}\n```", view_without_place(&q));
                }
                _ => body += &t,
            }
        } else {
            body += &t;
        }
        at = b.end;
    }
    body += &sub(&c, at, c.len());
    let asks = asks || body.contains("{place}");
    make(bible, store, &name, &format!("{name}{body}"), asks)
}

/// Change a template's settings (W6.2): the name new pages get (`new_name`, blanks allowed), whether it asks for a place,
/// and the page new pages go inside (`Some(None)`: Pages). None leaves a setting as it is. → its row.
pub fn set_template(bible: &Bible, store: &mut Store, key: &str, new_name: Option<&str>, asks: Option<bool>, goes_in: Option<Option<&str>>) -> Result<Value> {
    let t = find(bible, store, key)?;
    let id = id_of(&t);
    let mut fields: Vec<(&str, Option<Value>)> = vec![];
    if let Some(n) = new_name {
        let n = n.trim();
        if n.is_empty() || n.contains('\n') {
            return Err(bad("The name new pages get is one line with something on it (blanks like {place} allowed)."));
        }
        fields.push(("new_name", Some(json!(n))));
    }
    if let Some(a) = asks {
        fields.push(("asks", a.then(|| json!("place"))));
    }
    if let Some(g) = goes_in {
        let g = g.map(str::trim).filter(|g| !g.is_empty() && !g.eq_ignore_ascii_case("pages"));
        if let Some(p) = g {
            let e = nb::show(bible, store, p).map_err(|_| missing("No page with that id for its pages to go inside."))?;
            if nb::is_template(&e) || e["kind"] == "day" {
                return Err(bad("New pages go inside a page: not a template or a day's page."));
            }
        }
        fields.push(("goes_in", g.map(|p| json!(p))));
    }
    if fields.is_empty() {
        return Err(bad("Say what to change: --names, --asks place|nothing, --goes-in ID|pages."));
    }
    store.set_fields(&id, &fields)?;
    let every = nb::every(bible, store);
    let e = every.iter().find(|e| e["id"] == id.as_str()).ok_or_else(|| missing("The template is gone."))?;
    Ok(row(e, &every))
}

/// Delete a template (to .trash, as any page; the pages made from it stay as they are).
pub fn remove_template(bible: &Bible, store: &mut Store, key: &str) -> Result<Value> {
    let t = find(bible, store, key)?;
    let id = id_of(&t);
    let mut result = crate::deletion::remove(bible, store, &id)?;
    result["id"] = json!(id);
    result["title"] = t["title"].clone();
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blanks_are_filled_and_others_kept() {
        let f = Fill { place: "Numbers 25".into(), date: "Saturday, November 7".into(), title: "Chapter study: Numbers 25".into(), reader: "Psalms 106".into() };
        assert_eq!(fill("# {title}\n```scripture\n{place}\n```\n{date} · {reader} · {other}", &f), "# Chapter study: Numbers 25\n```scripture\nNumbers 25\n```\nSaturday, November 7 · Psalms 106 · {other}");
        assert_eq!(holds("Chapter study\n\n# Read\n\n```scripture\n{place}\n```\n\n# What I noticed\n\n- …\n\n# Questions\n\n- [ ] …").0, "3 headings, a scripture block, a to-do, a block of writing");
        assert_eq!(holds("Empty one").0, "Empty");
        let q = ViewQuery { place: Some("Numbers 25".into()), questions: Some("open".into()), thread: Some("the zeal".into()), ..Default::default() };
        assert_eq!(view_without_place(&q), "notebook @{place} open thread \"the zeal\"");
    }
}
