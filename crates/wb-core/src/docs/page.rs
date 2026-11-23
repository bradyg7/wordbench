//! A page as a document's source (W6 of "The Notebook as a workspace", 2026-11-08; sheets W7.1–W7.4 of
//! docs/archive/2026-11-10/docs/workspace-design.md). A page, and the pages inside it, is read as a lesson is: its title, then each block in
//! order, then the pages inside it, each after the page it is in. Nothing is copied into the page and nothing is kept
//! of it but the record's choices: the document is planned from the page each time it is made or checked, the way a
//! thread's is, and scripture comes from the database only.
//!
//! What each block becomes (sheet W7.2, the drawn choices): a heading → a section (a SLIDE cue in the Speaker Script, a
//! section slide in Verse by Verse); a paragraph, a list, a quote, a table → your words; a to-do → left out, unless
//! switched on ("to-dos are for you"); a scripture block → its verses from the Bible, with your notes on them as Study
//! lines; a view → its list as it is when made; a page inside → its title as a section, then its blocks. Every row of
//! What goes in has a switch; a switch moved from its default is kept in the record (`switched`), keyed by what the
//! block says (a to-do's tick does not count), so Make again makes the same choice.

use super::plan::{one_line, sha256_hex, Block};
use crate::bible::Bible;
use crate::pages::{self, chars, split, sub};
use crate::store::{bad, Store};
use crate::{pageviews, scripture, Result};
use serde_json::{json, Map, Value};

/// A block of a page as Markdown: its kind (pages::Block's) and text.
type Md = (&'static str, String);

/// One row of What goes in.
struct Row {
    key: String,
    kind: &'static str,
    label: &'static str,
    text: String,
    default_on: bool,
    /// The blocks of the row (a run of to-dos or list items is one row), or the page inside it is.
    md: Vec<Md>,
    page: Option<Value>,
}

fn key_of(prefix: &str, parts: &[String]) -> String {
    format!(
        "{prefix}:{}",
        &sha256_hex(parts.join("\n").as_bytes())[..10]
    )
}

/// A page's words without Markdown's marks: `[[a link|shown]]` → shown, `[text](url)` → text, bold, italics, code and
/// strike-through marks taken off.
pub fn plain_words(md: &str) -> String {
    let rules: [(&str, &str); 7] = [
        (r"\[\[([^\]|#]*)(?:#[^\]|]*)?\|([^\]]*)\]\]", "$2"),
        (r"\[\[([^\]|#]*)(?:#[^\]]*)?\]\]", "$1"),
        (r"\[([^\]]*)\]\([^)]*\)", "$1"),
        (r"\*\*(.+?)\*\*|__(.+?)__", "$1$2"),
        (r"\*(\S(?:[^*]*\S)?)\*", "$1"),
        (r"`([^`]*)`", "$1"),
        (r"~~(.+?)~~", "$1"),
    ];
    let mut out = md.to_string();
    for (re, to) in rules {
        out = regex::Regex::new(re)
            .unwrap()
            .replace_all(&out, to)
            .into_owned();
    }
    one_line(&out)
}

fn shorten(text: &str, n: usize) -> String {
    if text.chars().count() <= n {
        return text.to_string();
    }
    let cut: String = text.chars().take(n).collect();
    format!("{}…", cut.trim_end())
}

/// A heading's words: its #s taken off.
fn heading_words(md: &str) -> String {
    plain_words(md.trim().trim_start_matches('#').trim_end_matches('#'))
}

/// A list item's or to-do's words: its mark (and a to-do's box) taken off.
fn item_words(md: &str) -> String {
    let re = regex::Regex::new(r"^\s*(?:[-*+]|\d{1,9}[.)])\s*(?:\[[ xX]\]\s*)?").unwrap();
    plain_words(&re.replace(md, ""))
}

fn numbered_mark(md: &str) -> Option<String> {
    regex::Regex::new(r"^\s*(\d{1,9})[.)]")
        .unwrap()
        .captures(md)
        .map(|c| format!("{}.", &c[1]))
}

fn todo_done(md: &str) -> bool {
    regex::Regex::new(r"^\s*[-*+]\s*\[[xX]\]")
        .unwrap()
        .is_match(md)
}

/// A scripture block's verses from the Bible, in its own version or the document's. → the plan's block, or why not.
fn scripture_block(
    bible: &Bible,
    md: &str,
    version: Option<&str>,
) -> Option<std::result::Result<(Block, String), String>> {
    let f = pages::scripture_fence(md)?;
    if f.reference.is_empty() {
        return Some(Err("No reference yet".into()));
    }
    let v = version.unwrap_or(if f.ylt { "YLT" } else { "KJV" });
    Some(match scripture::passage(bible, &f.reference, v) {
        Ok(p) => Ok((
            (
                "scripture".into(),
                json!({"label": p["label"], "version": p["version"], "verses": p["verses"]}),
            ),
            f.reference.clone(),
        )),
        Err(e) => Err(e.0),
    })
}

/// A view's rows as your words, a line to a row, as the view finds them now.
fn view_lines(
    bible: &Bible,
    store: &Store,
    line: &str,
) -> std::result::Result<Vec<String>, String> {
    if line.is_empty() {
        return Err("No line yet".into());
    }
    if line.contains('{') {
        return Err("A template's blank".into());
    }
    let r = pageviews::run(bible, store, line).map_err(|e| e.0)?;
    Ok(r["rows"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| {
            let title = one_line(e["title"].as_str().unwrap_or(""));
            match e["label"].as_str().filter(|l| !l.is_empty()) {
                Some(l) => format!("• {title} · {l}"),
                None => format!("• {title}"),
            }
        })
        .collect())
}

fn s_name(t: &crate::store::Rec) -> String {
    crate::store::s(t, "name")
}

/// A thread block's places as the plan's blocks: the scripture of each place and the words, as a thread's own document
/// reads them (the thread's note and name are the page's own words, not repeated here).
fn thread_blocks_of(bible: &Bible, store: &Store, held: &str) -> Vec<Block> {
    let Some(t) = pages::thread_held(store, held) else {
        return vec![];
    };
    let Ok(view) = crate::studyapi::thread_view(bible, store, &crate::store::s(&t, "id")) else {
        return vec![];
    };
    let Ok(mut margin) = super::plan::Margin::new(bible, store) else {
        return vec![];
    };
    let Ok(thread) = super::plan::thread_source(bible, &view, &mut margin) else {
        return vec![];
    };
    super::plan::thread_blocks(&thread)
        .into_iter()
        .filter(|(k, _)| k == "scripture" || k == "word")
        .collect()
}

/// A word block as the plan's word block (the lexicon's entry, and your notes on the word).
fn word_block_of(bible: &Bible, store: &Store, held: &str) -> Vec<Block> {
    let strong = held.trim().to_uppercase();
    let Ok(Some(mut e)) = super::plan::word_entry(bible, &strong) else {
        return vec![];
    };
    if let Ok(margin) = super::plan::Margin::new(bible, store) {
        e["notes"] = json!(margin.lemma_notes(&strong));
    }
    vec![("word".into(), e)]
}

/// One block as the plan's blocks. Scripture or a view that cannot be read gives nothing.
fn convert(bible: &Bible, store: &Store, (kind, md): &Md, version: Option<&str>) -> Vec<Block> {
    let speech = |t: String| -> Vec<Block> {
        if t.is_empty() {
            vec![]
        } else {
            vec![("speech".into(), json!(t))]
        }
    };
    match *kind {
        "heading" => {
            let t = heading_words(md);
            if t.is_empty() {
                vec![]
            } else {
                vec![("section".into(), json!(t))]
            }
        }
        "paragraph" => speech(plain_words(md)),
        "item" => speech(format!("• {}", item_words(md))),
        "numbered" => speech(format!(
            "{} {}",
            numbered_mark(md).unwrap_or_default(),
            item_words(md)
        )),
        "todo" => speech(format!(
            "{} {}",
            if todo_done(md) { "Done:" } else { "To do:" },
            item_words(md)
        )),
        "quote" if crate::questions::question_of(md).is_some() => {
            let q = crate::questions::question_of(md).unwrap();
            speech(format!(
                "{} {}",
                if q.done { "Answered:" } else { "Question:" },
                plain_words(&q.text)
            ))
        }
        "quote" => speech(plain_words(
            &md.lines()
                .map(|l| l.trim_start().trim_start_matches('>'))
                .collect::<Vec<_>>()
                .join(" "),
        )),
        "table" => md
            .lines()
            .filter(|l| !l.chars().all(|c| matches!(c, '|' | '-' | ':' | ' ' | '\t')))
            .flat_map(|l| {
                speech(
                    l.trim()
                        .trim_matches('|')
                        .split('|')
                        .map(plain_words)
                        .filter(|c| !c.is_empty())
                        .collect::<Vec<_>>()
                        .join(" · "),
                )
            })
            .collect(),
        "fence" => {
            if let Some(r) = scripture_block(bible, md, version) {
                return r.map(|(b, _)| vec![b]).unwrap_or_default();
            }
            if let Some(held) = pages::thread_fence(md) {
                return thread_blocks_of(bible, store, &held);
            }
            if let Some(held) = pages::word_fence(md) {
                return word_block_of(bible, store, &held);
            }
            if let Some(line) = pageviews::view_fence(md) {
                return view_lines(bible, store, &line)
                    .unwrap_or_default()
                    .into_iter()
                    .flat_map(speech)
                    .collect();
            }
            let inner: Vec<&str> = md
                .lines()
                .skip(1)
                .filter(|l| {
                    !l.trim_start().starts_with("```") && !l.trim_start().starts_with("~~~")
                })
                .collect();
            speech(plain_words(&inner.join(" ")))
        }
        _ => vec![],
    }
}

/// A page's blocks as Markdown, its title apart.
fn page_md(store: &Store, id: &str) -> Result<(String, Vec<Md>)> {
    let (_, text, titled) = pages::text_of(store, id)?;
    let c = chars(&text);
    let (title, bs) = split(&text, titled);
    let title = title
        .map(|(a, b)| heading_words(&sub(&c, a, b)))
        .unwrap_or_default();
    Ok((
        title,
        bs.iter()
            .map(|b| (b.kind, sub(&c, b.start, b.end)))
            .collect(),
    ))
}

/// The rows of What goes in for a page: its blocks (a run of to-dos, or of list items, is one row; a divider is none),
/// then each page inside it.
fn rows(bible: &Bible, store: &Store, id: &str) -> Result<(String, Vec<Row>)> {
    let (title, mds) = page_md(store, id)?;
    let mut out: Vec<Row> = vec![];
    let mut i = 0;
    while i < mds.len() {
        let (kind, md) = &mds[i];
        let row =
            |key: String, kind: &'static str, label: &'static str, text: String, md: Vec<Md>| Row {
                key,
                kind,
                label,
                text,
                default_on: kind != "todo" && kind != "word",
                md,
                page: None,
            };
        match *kind {
            "divider" => {}
            "todo" | "item" | "numbered" => {
                let todo = *kind == "todo";
                let mut j = i;
                while j < mds.len()
                    && (if todo {
                        mds[j].0 == "todo"
                    } else {
                        matches!(mds[j].0, "item" | "numbered")
                    })
                {
                    j += 1;
                }
                let run: Vec<Md> = mds[i..j].to_vec();
                let words: Vec<String> = run.iter().map(|(_, m)| item_words(m)).collect();
                let first = shorten(words.first().map(String::as_str).unwrap_or(""), 48);
                let text = if run.len() == 1 {
                    first
                } else {
                    format!(
                        "{} {}: {first}",
                        run.len(),
                        if todo { "to-dos" } else { "items" }
                    )
                };
                out.push(if todo {
                    row(key_of("t", &words), "todo", "To-do", text, run)
                } else {
                    row(key_of("l", &words), "list", "List", text, run)
                });
                i = j;
                continue;
            }
            "heading" => {
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    "heading",
                    "Heading",
                    heading_words(md),
                    vec![(kind, md.clone())],
                ));
            }
            "fence" if pages::scripture_fence(md).is_some() => {
                let f = pages::scripture_fence(md).unwrap();
                let text = if f.reference.is_empty() {
                    "(no reference yet)".to_string()
                } else {
                    format!("{}{}", f.reference, if f.ylt { " · YLT" } else { "" })
                };
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    "scripture",
                    "Scripture",
                    text,
                    vec![(kind, md.clone())],
                ));
            }
            "fence" if pages::thread_fence(md).is_some() => {
                let held = pages::thread_fence(md).unwrap();
                let text = match pages::thread_held(store, &held) {
                    Some(t) => format!(
                        "{} · {} place{}",
                        s_name(&t),
                        t["members"].as_array().map(|a| a.len()).unwrap_or(0),
                        if t["members"].as_array().map(|a| a.len()) == Some(1) {
                            ""
                        } else {
                            "s"
                        }
                    ),
                    None => format!(
                        "{} (no such thread)",
                        if held.is_empty() {
                            "No thread yet"
                        } else {
                            &held
                        }
                    ),
                };
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    "thread",
                    "Thread",
                    text,
                    vec![(kind, md.clone())],
                ));
            }
            "fence" if pages::word_fence(md).is_some() => {
                let held = pages::word_fence(md).unwrap();
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    "word",
                    "Word",
                    if held.is_empty() {
                        "No number yet".into()
                    } else {
                        held.to_uppercase()
                    },
                    vec![(kind, md.clone())],
                ));
            }
            "quote" if crate::questions::question_of(md).is_some() => {
                let q = crate::questions::question_of(md).unwrap();
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    "question",
                    "Question",
                    shorten(&q.text, 60),
                    vec![(kind, md.clone())],
                ));
            }
            "fence" if pageviews::view_fence(md).is_some() => {
                let line = pageviews::view_fence(md).unwrap();
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    "view",
                    "View",
                    line,
                    vec![(kind, md.clone())],
                ));
            }
            k => {
                let (kind, label): (&'static str, &'static str) = match k {
                    "paragraph" => ("paragraph", "Paragraph"),
                    "quote" => ("quote", "Quote"),
                    "table" => ("table", "Table"),
                    _ => ("fence", "Block"),
                };
                let text = match kind {
                    "table" => format!(
                        "A table · {} rows",
                        md.lines()
                            .filter(|l| !l.chars().all(|c| matches!(c, '|' | '-' | ':' | ' ')))
                            .count()
                    ),
                    "quote" => shorten(&plain_words(&md.replace('>', " ")), 60),
                    _ => shorten(&plain_words(md.trim_start_matches(['`', '~'])), 60),
                };
                out.push(row(
                    key_of("b", &[md.trim().to_string()]),
                    kind,
                    label,
                    text,
                    vec![(k, md.clone())],
                ));
            }
        }
        i += 1;
    }
    for node in pages::inside_tree(bible, store, id) {
        let pid = node["id"].as_str().unwrap_or("").to_string();
        let ptitle = one_line(node["title"].as_str().unwrap_or(""));
        let (_, its) = page_md(store, &pid).unwrap_or_default();
        let n_scripture = its
            .iter()
            .filter(|(k, m)| *k == "fence" && pages::scripture_fence(m).is_some())
            .count();
        let n_views = its
            .iter()
            .filter(|(k, m)| *k == "fence" && pageviews::view_fence(m).is_some())
            .count();
        let n_inside = node["children"].as_array().map(|a| a.len()).unwrap_or(0);
        let mut text = ptitle.clone();
        if n_scripture > 0 {
            text += &format!(
                " · {n_scripture} scripture block{}",
                if n_scripture == 1 { "" } else { "s" }
            );
        }
        if n_views > 0 {
            text += &if n_views == 1 {
                " · a view".to_string()
            } else {
                format!(" · {n_views} views")
            };
        }
        if n_inside > 0 {
            text += &format!(
                " · {n_inside} page{} inside",
                if n_inside == 1 { "" } else { "s" }
            );
        }
        out.push(Row {
            key: format!("p:{pid}"),
            kind: "page",
            label: "Page inside",
            text,
            default_on: true,
            md: vec![],
            page: Some(node),
        });
    }
    Ok((title, out))
}

fn is_on(r: &Row, switched: &Map<String, Value>) -> bool {
    switched
        .get(&r.key)
        .and_then(Value::as_bool)
        .unwrap_or(r.default_on)
}

/// What a row becomes in the documents.
fn becomes(
    bible: &Bible,
    store: &Store,
    r: &Row,
    on: bool,
    first_heading: bool,
    version: Option<&str>,
) -> (String, Option<String>) {
    if !on {
        return (
            if r.kind == "todo" {
                "Left out: to-dos are for you".into()
            } else {
                "Left out".into()
            },
            None,
        );
    }
    let study = "The verses from the Bible, with your notes there as Study lines";
    match r.kind {
        "heading" => (
            (if first_heading {
                "A section, with a SLIDE cue"
            } else {
                "A section"
            })
            .into(),
            None,
        ),
        "paragraph" => ("Your words, in large print".into(), None),
        "todo" => ("Your words: each to-do as a line".into(), None),
        "table" => ("Your words, a line to a row".into(), None),
        "scripture" => match scripture_block(bible, &r.md[0].1, version) {
            Some(Err(why)) => ("Left out: the reference does not read".into(), Some(why)),
            _ => (study.into(), None),
        },
        "question" => ("Your words, as a line".into(), None),
        "thread" => {
            match pages::thread_held(store, &pages::thread_fence(&r.md[0].1).unwrap_or_default()) {
                Some(_) => (study.into(), None),
                None => (
                    "Left out: there is no such thread".into(),
                    Some("No such thread".into()),
                ),
            }
        }
        "word" => ("The word's entry, as a thread's words are".into(), None),
        "view" => match pageviews::view_fence(&r.md[0].1).map(|l| view_lines(bible, store, &l)) {
            Some(Ok(rows)) => (
                format!("The view's list as it is when made ({} now)", rows.len()),
                None,
            ),
            Some(Err(why)) => ("Left out: the view does not read".into(), Some(why)),
            None => ("Left out".into(), None),
        },
        "page" => {
            let t = &r.text;
            if t.contains("scripture block") {
                ("Its title as a section, then its blocks: the verses from the Bible, with your notes there as Study lines".into(), None)
            } else if t.contains("view") {
                (
                    "Its title as a section, then the view's list as it is when made".into(),
                    None,
                )
            } else {
                (
                    "Its title as a section, then its blocks, after this page's".into(),
                    None,
                )
            }
        }
        _ => ("Your words".into(), None),
    }
}

/// What goes in (`wb craft parts --page`): the page's title, how many pages are inside it, and each row with its key,
/// what it is, its switch (`on`, and `default`), and what it becomes.
pub fn parts(
    bible: &Bible,
    store: &Store,
    id: &str,
    switched: &Map<String, Value>,
    version: Option<&str>,
) -> Result<Value> {
    let (pid, _, titled) = pages::text_of(store, id)?;
    if !titled {
        return Err(bad(
            "A day's page is not made into a document; a page with a title is.",
        ));
    }
    let (title, rs) = rows(bible, store, &pid)?;
    let mut first = true;
    let rows: Vec<Value> = rs
        .iter()
        .map(|r| {
            let on = is_on(r, switched);
            let (b, why) = becomes(bible, store, r, on, first && r.kind == "heading", version);
            if r.kind == "heading" {
                first = false;
            }
            let mut v = json!({"key": r.key, "kind": r.kind, "label": r.label, "text": r.text, "on": on, "default": r.default_on, "becomes": b});
            if let Some(w) = why {
                v["problem"] = json!(w);
            }
            v
        })
        .collect();
    let inside = rs.iter().filter(|r| r.kind == "page").count();
    Ok(json!({"id": pid, "title": title, "inside": inside, "rows": rows}))
}

/// The keys of a page's rows and their defaults: a switch is kept only where it differs from its row's default.
pub(crate) fn keep_switched(
    bible: &Bible,
    store: &Store,
    id: &str,
    on: &[String],
    off: &[String],
) -> Result<Map<String, Value>> {
    let (_, rs) = rows(bible, store, id)?;
    let mut out = Map::new();
    for k in on.iter().chain(off) {
        if !rs.iter().any(|r| &r.key == k) {
            return Err(bad(format!(
                "The page has no row “{k}” (wb craft parts --page lists them)."
            )));
        }
    }
    for r in &rs {
        let want = if on.contains(&r.key) {
            Some(true)
        } else if off.contains(&r.key) {
            Some(false)
        } else {
            None
        };
        if let Some(w) = want.filter(|w| *w != r.default_on) {
            out.insert(r.key.clone(), json!(w));
        }
    }
    Ok(out)
}

/// A page inside, at any depth: its title as a section, its blocks (to-dos left out), then the pages inside it.
fn inside_blocks(
    bible: &Bible,
    store: &Store,
    node: &Value,
    version: Option<&str>,
    out: &mut Vec<Block>,
) {
    let id = node["id"].as_str().unwrap_or("");
    let Ok((title, mds)) = page_md(store, id) else {
        return;
    };
    if !title.is_empty() {
        out.push(("section".into(), json!(title)));
    }
    for md in mds.iter().filter(|(k, _)| *k != "todo") {
        out.extend(convert(bible, store, md, version));
    }
    for c in node["children"].as_array().into_iter().flatten() {
        inside_blocks(bible, store, c, version, out);
    }
}

/// A page as the plan's source: its title, then the blocks switched on, in order. → the blocks and the title.
pub fn source(
    bible: &Bible,
    store: &Store,
    id: &str,
    switched: &Map<String, Value>,
    version: Option<&str>,
) -> Result<(Vec<Block>, String)> {
    let (title, rs) = rows(bible, store, id)?;
    let mut out: Vec<Block> = vec![("title".into(), json!(title))];
    for r in rs.iter().filter(|r| is_on(r, switched)) {
        match &r.page {
            Some(node) => inside_blocks(bible, store, node, version, &mut out),
            None => {
                for md in &r.md {
                    out.extend(convert(bible, store, md, version));
                }
            }
        }
    }
    Ok((out, title))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_marks_come_off() {
        assert_eq!(plain_words("Read **this** with [[Word study: H7065|the word study]] and [a link](http://x) `now`"), "Read this with the word study and a link now");
        assert_eq!(
            plain_words("See [[Outline]] and [[Outline#Aim]] *first*"),
            "See Outline and Outline first"
        );
        assert_eq!(heading_words("## Before Tuesday"), "Before Tuesday");
        assert_eq!(item_words("- [x] Print the deck"), "Print the deck");
        assert_eq!(item_words("2. Second"), "Second");
        assert!(todo_done("- [X] done") && !todo_done("- [ ] not yet"));
    }
}
