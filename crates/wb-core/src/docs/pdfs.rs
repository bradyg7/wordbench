//! Discovery of standalone saved PDFs, including exports with no document record.

use super::{checked_name, open_file, ExportFolders};
use crate::{store::{bad, missing}, Result};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

#[derive(Serialize)]
pub struct Pdf {
    pub name: String,
    pub path: PathBuf,
    pub size: u64,
    pub modified: String,
    #[serde(skip)]
    modified_time: Option<SystemTime>,
}

fn safe_name(name: &str) -> bool {
    checked_name(name).is_ok() && !name.chars().any(|c| c.is_control() || "<>\"|?*".contains(c))
}

fn stem(name: &str) -> &str {
    if name.get(name.len().saturating_sub(4)..).is_some_and(|suffix| suffix.eq_ignore_ascii_case(".pdf")) {
        &name[..name.len() - 4]
    } else {
        name
    }
}

pub fn list(folders: &ExportFolders) -> Result<Vec<Pdf>> {
    let mut directories = HashSet::new();
    let mut found = Vec::new();
    for dir in folders.search_dirs() {
        let canonical = match fs::canonicalize(dir) {
            Ok(path) => path,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(e.into()),
        };
        if !directories.insert(canonical) {
            continue;
        }
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let Ok(name) = entry.file_name().into_string() else { continue };
            let base = stem(&name);
            if base.is_empty() || base.len() == name.len() || !safe_name(&name) || !entry.file_type()?.is_file() {
                continue;
            }
            let meta = entry.metadata()?;
            let modified_time = meta.modified().ok();
            let modified = modified_time.map(chrono::DateTime::<chrono::Local>::from)
                .map(|t| t.format("%Y-%m-%d %H:%M").to_string()).unwrap_or_default();
            found.push(Pdf { name, path: entry.path(), size: meta.len(), modified, modified_time });
        }
    }
    found.sort_by(|a, b| b.modified_time.cmp(&a.modified_time).then_with(|| a.path.cmp(&b.path)));
    Ok(found)
}

/// A Shelf entry carries the full basename. Partial matching is for the typed command only.
pub fn find<'a>(files: &'a [Pdf], name: &str, exact: bool) -> Result<&'a Pdf> {
    let name = if exact { name } else { name.trim() };
    if !safe_name(name) {
        return Err(bad("Give a saved PDF name without a path."));
    }
    let query = stem(name).to_lowercase();
    let mut direct = Vec::new();
    let mut starts = Vec::new();
    let mut contains = Vec::new();
    for file in files {
        let key = stem(&file.name).to_lowercase();
        if key == query {
            direct.push(file);
        } else if !exact && key.starts_with(&query) {
            starts.push(file);
        } else if !exact && key.contains(&query) {
            contains.push(file);
        }
    }
    match [direct, starts, contains].into_iter().find(|hits| !hits.is_empty()).as_deref() {
        Some([one]) => Ok(one),
        Some(_) => Err(bad(format!("More than one saved PDF matches “{name}”. wb pdfs lists their paths."))),
        None => Err(missing(format!("No saved PDF called “{name}”. wb pdfs lists them."))),
    }
}

pub fn open(folders: &ExportFolders, name: &str, exact: bool) -> Result<Value> {
    let files = list(folders)?;
    let file = find(&files, name, exact)?;
    open_file(&file.path)?;
    Ok(json!({"ok": true, "name": file.name, "path": file.path}))
}
