//! The check of the study folder (R1, `docs/redesign-R1.md` question 6; sheet R1.8): what the folder holds, as this app
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

/// What the study folder holds, and what a build of R1 would write to it (nothing it does not already write: the new
/// settings file appears only when a thread is first pinned).
pub fn study_check(store: &Store) -> Result<Value> {
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
        // what the Python app reads of it: a note only with a place, and the rest as they are
        "python_reads": {"notes": placed.len(), "threads": threads.len(), "thread_places": places, "trails": trails.len(), "sets": store.sets().len()},
        "pages_file": root.join("settings").join("pages.json").exists(),
        "would_write": Vec::<String>::new(),
    }))
}
