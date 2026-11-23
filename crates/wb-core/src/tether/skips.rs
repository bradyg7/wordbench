//! Skipped candidates (TG-10): kept in the app's own state folder, not in the study folder. Losing the file only brings
//! the candidates back. Keyed by page id and candidate id.

use crate::{Error, Result};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::PathBuf;

pub fn path() -> PathBuf {
    crate::setup::app_dir().join("tether-skips.json")
}

fn load() -> Map<String, Value> {
    fs::read_to_string(path())
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

pub fn list(page: &str) -> Vec<String> {
    load()
        .get(page)
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

fn save(m: Map<String, Value>) -> Result<()> {
    let p = path();
    if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(|e| Error(e.to_string()))?;
    }
    let tmp = p.with_extension("tmp");
    fs::write(
        &tmp,
        serde_json::to_string_pretty(&Value::Object(m)).unwrap_or_default(),
    )
    .map_err(|e| Error(e.to_string()))?;
    fs::rename(&tmp, &p).map_err(|e| Error(e.to_string()))
}

pub fn add(page: &str, ids: &[String]) -> Result<()> {
    let mut m = load();
    let mut cur = list(page);
    for i in ids {
        if !cur.contains(i) {
            cur.push(i.clone());
        }
    }
    m.insert(page.to_string(), json!(cur));
    save(m)
}

pub fn remove(page: &str, ids: &[String]) -> Result<()> {
    let mut m = load();
    let cur: Vec<String> = list(page)
        .into_iter()
        .filter(|i| !ids.contains(i))
        .collect();
    if cur.is_empty() {
        m.remove(page);
    } else {
        m.insert(page.to_string(), json!(cur));
    }
    save(m)
}
