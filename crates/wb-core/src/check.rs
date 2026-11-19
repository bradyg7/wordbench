//! The check of the study folder (R1, `docs/archive/2026-11-10/docs/redesign-R1.md` question 6; sheet R1.8): what the folder holds, as this app
//! reads it, and which files the next change would write. It reads and writes nothing. The Python app's side of the same
//! check is `scripts/py-opens.py`, which opens a scratch copy with the Python app's own `Study` and compares the counts
//! this gives for what that app reads (notes with a place, threads and their places, trails, sets).

use crate::store::{s, Store};
use crate::Result;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

fn files_in(dir: &Path, ending: &str) -> usize {
    fs::read_dir(dir).map(|rd| rd.flatten().filter(|e| e.path().to_string_lossy().ends_with(ending)).count()).unwrap_or(0)
}

/// Every file under a folder, at any depth (the margin's `<BOOK>/<chapter>.md` files).
fn count_files(dir: &Path) -> usize {
    fs::read_dir(dir).map(|rd| rd.flatten().map(|e| if e.path().is_dir() { count_files(&e.path()) } else { 1 }).sum()).unwrap_or(0)
}

/// What the study folder holds, and what a build of R1 would write to it (nothing it does not already write: the new
/// settings file appears only when a thread is first pinned).
pub fn study_check(store: &mut Store) -> Result<Value> {
    let to_move = crate::marks::move_marks(store, false)?;
    let placed = store.notes();
    let words = placed.iter().filter(|n| matches!(s(n, "anchor").chars().next(), Some('H' | 'G')) && s(n, "anchor").len() > 1 && s(n, "anchor")[1..].chars().all(|c| c.is_ascii_digit())).count();
    let threads = store.threads();
    let places: usize = threads.iter().map(|t| t["members"].as_array().map(|a| a.len()).unwrap_or(0)).sum();
    let colors: BTreeSet<String> = threads.iter().map(|t| s(t, "color")).filter(|c| !c.is_empty()).collect();
    let trails = store.trails();
    let open = trails.iter().filter(|t| s(t, "status") != "done").count();
    let inbox = store.inbox();
    let inbox_questions = inbox.iter().filter(|n| s(n, "kind") == "question").count();
    let root = &store.root;
    let margin_files = count_files(&root.join("margin"));
    Ok(json!({
        "folder": root.display().to_string(),
        "notes": {"files": placed.len() + inbox.len() + store.on_thread().len() + store.days().len(),
                  "at_a_place": placed.len() - words, "on_a_word": words, "no_place": inbox.len(),
                  "on_a_thread": store.on_thread().len(), "days": store.days().len()},
        "threads": {"files": threads.len(), "places": places, "colors_in_use": colors.len()},
        "questions": {"trails": trails.len(), "open_trails": open, "in_the_inbox": inbox_questions},
        "sets": store.sets().len(),
        "lessons": files_in(&root.join("lessons"), ".md"),
        "documents": files_in(&root.join("documents"), ".json"),
        "highlight_files": files_in(&root.join("highlights"), ".json"),
        // the files marks rounds 1 to 6 wrote (marks MK7-5): only listed, never read or changed
        "margin": {"files": margin_files},
        "pencil": {"files": files_in(&root.join("pencil"), ".json")},
        // what `wb study move-marks --go` would turn into marks (marks row 55): the same read-only dry run
        "would_move_to_marks": to_move,
        // what the Python app reads of it: a note only with a place, and the rest as they are
        "python_reads": {"notes": placed.len(), "threads": threads.len(), "thread_places": places, "trails": trails.len(), "sets": store.sets().len()},
        "pages_file": root.join("settings").join("pages.json").exists(),
        "would_write": Vec::<String>::new(),
    }))
}

/// What the library adds to the check (design/features/library L-21, L-22): the folders and the Shelf, the items that
/// point at something that is gone (a page file deleted by hand, a removed document), and the pages whose `title:` field
/// and first line differ (the field wins). Read only.
pub fn library_check(bible: &crate::bible::Bible, store: &Store) -> Result<Value> {
    let mut titles = vec![];
    for n in store.notes().into_iter().chain(store.inbox()).chain(store.on_thread()) {
        let field = s(n, "title");
        let field = field.trim();
        if !field.is_empty() && field != crate::notebook::title_of(&s(n, "text")) {
            titles.push(json!({"id": n["id"], "title_field": field, "first_line": crate::notebook::title_of(&s(n, "text"))}));
        }
    }
    Ok(json!({
        "folders": store.sets().len(),
        "shelf_saves": store.shelf_saves().len(),
        "dangling": crate::library::dangling(bible, store)?,
        "title_differs": titles,
    }))
}
