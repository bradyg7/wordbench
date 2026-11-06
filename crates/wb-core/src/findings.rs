//! The person's findings about the app while it is being built (note 50c1, decided 2026-11-06): what they notice while
//! studying, written down at once and kept apart from the study so a development session can read them (`wb findings`).
//!
//! findings/<id>.md   one finding: a header like a note's (`id`, `kind: "finding"`, `status` open or handled, `created`,
//!                    `updated`, and `context`: what was on screen when it was written: size, panes, place, version, build)
//!                    and the person's text after it.
//!
//! The folder sits beside notes/, not inside it: the Notebook does not list findings, and the Python app passes over the
//! folder (it reads notes/, threads/, trails/, highlights/ and sets/). A finding deleted goes to `.trash/`, as notes do.
use crate::store::{bad, dump_md, guard, missing, new_id, now, parse_md, s, write_atomic, Rec};
use crate::Result;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

fn dir(root: &Path) -> PathBuf {
    root.join("findings")
}

fn title_of(text: &str) -> String {
    let first = text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    let first = first.trim_start_matches('#').trim();
    if first.chars().count() > 90 { format!("{}…", first.chars().take(88).collect::<String>()) } else { first.to_string() }
}

fn public(meta: &Rec, body: &str) -> Value {
    json!({"id": meta.get("id").cloned().unwrap_or(Value::Null), "status": s(meta, "status"), "created": s(meta, "created"),
        "updated": s(meta, "updated"), "title": title_of(body), "text": body.trim_end_matches('\n'),
        "context": meta.get("context").cloned().unwrap_or(Value::Null)})
}

fn read_one(p: &Path) -> Option<(Rec, String)> {
    let (meta, body) = parse_md(&fs::read_to_string(p).ok()?);
    (s(&meta, "kind") == "finding" && !s(&meta, "id").is_empty()).then_some((meta, body))
}

/// Every finding, newest first (only the open ones unless `all`), with how many are open and handled.
pub fn list(root: &Path, all: bool) -> Result<Value> {
    let mut items: Vec<(Rec, String)> = fs::read_dir(dir(root))
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "md")).filter_map(|p| read_one(&p)).collect())
        .unwrap_or_default();
    items.sort_by(|a, b| s(&b.0, "created").cmp(&s(&a.0, "created")).then(s(&b.0, "id").cmp(&s(&a.0, "id"))));
    let open = items.iter().filter(|(m, _)| s(m, "status") != "handled").count();
    let handled = items.len() - open;
    let out: Vec<Value> = items.iter().filter(|(m, _)| all || s(m, "status") != "handled").map(|(m, b)| public(m, b)).collect();
    Ok(json!({"findings": out, "counts": {"open": open, "handled": handled}}))
}

/// One finding by its id, or by the end of its id (the last four characters are enough: `1b2d`).
fn find(root: &Path, id: &str) -> Result<(PathBuf, Rec, String)> {
    let id = id.trim();
    if id.is_empty() {
        return Err(bad("Name a finding by its id."));
    }
    let exact = dir(root).join(format!("{id}.md"));
    if let Some((m, b)) = read_one(&exact) {
        return Ok((exact, m, b));
    }
    let hits: Vec<PathBuf> = fs::read_dir(dir(root))
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.file_stem().is_some_and(|x| x.to_string_lossy().ends_with(id))).collect())
        .unwrap_or_default();
    match hits.as_slice() {
        [one] => {
            let (m, b) = read_one(one).ok_or_else(|| missing("No such finding."))?;
            Ok((one.clone(), m, b))
        }
        [] => Err(missing("No such finding.")),
        _ => Err(bad("More than one finding ends so: give more of its id.")),
    }
}

/// Writes a new finding; `context` is what the window says was on screen (any JSON object), kept as it is.
pub fn add(root: &Path, text: &str, context: Option<Value>) -> Result<Value> {
    guard(root)?;
    let text = text.trim();
    if text.is_empty() {
        return Err(bad("A finding needs some words."));
    }
    if context.as_ref().is_some_and(|c| !c.is_object()) {
        return Err(bad("The context must be a JSON object."));
    }
    let id = new_id("f");
    let t = now();
    let mut meta = Rec::new();
    meta.insert("id".into(), json!(id));
    meta.insert("kind".into(), json!("finding"));
    meta.insert("status".into(), json!("open"));
    meta.insert("created".into(), json!(t));
    meta.insert("updated".into(), json!(t));
    if let Some(c) = context {
        meta.insert("context".into(), c);
    }
    write_atomic(&dir(root).join(format!("{id}.md")), &dump_md(&meta, text))?;
    Ok(public(&meta, text))
}

/// Handled (done with in the app), or open again.
pub fn set_status(root: &Path, id: &str, handled: bool) -> Result<Value> {
    guard(root)?;
    let (p, mut meta, body) = find(root, id)?;
    meta.insert("status".into(), json!(if handled { "handled" } else { "open" }));
    meta.insert("updated".into(), json!(now()));
    write_atomic(&p, &dump_md(&meta, &body))?;
    Ok(public(&meta, &body))
}

/// A finding's words changed; what was on screen stays.
pub fn edit(root: &Path, id: &str, text: &str) -> Result<Value> {
    guard(root)?;
    let text = text.trim();
    if text.is_empty() {
        return Err(bad("A finding needs some words (to remove it: wb finding rm)."));
    }
    let (p, mut meta, _) = find(root, id)?;
    meta.insert("updated".into(), json!(now()));
    write_atomic(&p, &dump_md(&meta, text))?;
    Ok(public(&meta, text))
}

/// Deleted: the file goes to `.trash/` (nothing is erased).
pub fn remove(root: &Path, id: &str) -> Result<Value> {
    guard(root)?;
    let (p, meta, _) = find(root, id)?;
    let dest = root.join(".trash").join(format!("{}-finding-{}.md", chrono::Utc::now().format("%Y%m%d-%H%M%S"), s(&meta, "id")));
    fs::create_dir_all(dest.parent().unwrap())?;
    fs::rename(&p, &dest)?;
    Ok(json!({"ok": true, "id": meta.get("id")}))
}
