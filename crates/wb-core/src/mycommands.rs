//! My commands (R4 step 4, docs/archive/2026-11-10/docs/redesign-R4.md): command lines the person keeps, each with a name, an optional icon and an
//! optional key, in settings/commands.json (key `items`; the Python app passes over it). A line is written as it would be
//! typed in the command field, and may hold fill-ins the window takes from what is selected: `{word}`, `{place}`,
//! `{chapter}`. "Most used" is counted from the day's logs (sessions/<day>.jsonl, which hold every line run).

use crate::store::{bad, missing, Store};
use crate::Result;
use serde_json::{json, Value};
use std::collections::HashMap;

fn g(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

const PART: &str = "commands";
const FILLS: [&str; 3] = ["{word}", "{place}", "{chapter}"];

/// The kept commands, in the order kept.
pub fn list(store: &Store) -> Vec<Value> {
    store.settings(PART).get("items").and_then(|v| v.as_array().cloned()).unwrap_or_default()
}

fn id_of(name: &str) -> String {
    let mut out = String::new();
    for c in name.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    out.trim_end_matches('-').to_string()
}

/// Keep a command (or change the one with that name): `key` like `Ctrl+U`, `icon` one of the window's icon names.
pub fn add(store: &mut Store, name: &str, line: &str, key: &str, icon: &str) -> Result<Value> {
    let name = name.trim();
    let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(bad("A command needs a name."));
    }
    if line.is_empty() {
        return Err(bad("A command needs a line, written as you would type it in the command field."));
    }
    let low = key.trim().to_lowercase();
    let key = if let Some(r) = low.strip_prefix("ctrl+") {
        format!("Ctrl+{}", r.to_uppercase())
    } else if let Some(r) = low.strip_prefix("alt+") {
        format!("Alt+{}", r.to_uppercase())
    } else if low.is_empty() {
        String::new()
    } else {
        return Err(bad("A key starts with Ctrl+ or Alt+ (Ctrl+U)."));
    };
    let key = key.as_str();
    let id = id_of(name);
    if id.is_empty() {
        return Err(bad("Give the command a name with a letter or a number in it."));
    }
    let mut items = list(store);
    if !key.is_empty() {
        if let Some(o) = items.iter().find(|i| g(i, "key").eq_ignore_ascii_case(key) && g(i, "id") != id) {
            return Err(bad(format!("{key} is already {}'s key.", g(o, "name"))));
        }
    }
    let rec = json!({"id": id, "name": name, "line": line, "icon": icon.trim(), "key": key});
    match items.iter().position(|i| g(i, "id") == id) {
        Some(p) => items[p] = rec.clone(),
        None => items.push(rec.clone()),
    }
    store.set_setting(PART, "items", Some(Value::Array(items)))?;
    Ok(rec)
}

pub fn remove(store: &mut Store, name: &str) -> Result<Value> {
    let id = id_of(name);
    let mut items = list(store);
    let p = items.iter().position(|i| g(i, "id") == id || g(i, "name").eq_ignore_ascii_case(name.trim())).ok_or_else(|| missing("No kept command by that name."))?;
    let gone = items.remove(p);
    store.set_setting(PART, "items", if items.is_empty() { None } else { Some(Value::Array(items)) })?;
    Ok(gone)
}

/// The fill-ins a line holds.
pub fn fills(line: &str) -> Vec<&'static str> {
    FILLS.iter().copied().filter(|f| line.contains(f)).collect()
}

/// A line with its fill-ins given: `{word}` → "zealous". An error names the fill-in nothing was given for.
pub fn fill(line: &str, word: &str, place: &str, chapter: &str) -> Result<String> {
    let mut out = line.to_string();
    for (f, v, what) in [("{word}", word, "a selected word"), ("{place}", place, "a place"), ("{chapter}", chapter, "a chapter")] {
        if out.contains(f) {
            if v.trim().is_empty() {
                return Err(bad(format!("This command needs {what} for {f}.")));
            }
            out = out.replace(f, v.trim());
        }
    }
    Ok(out)
}

/// The lines run most often, from the logs of every day: `{line, times}`, most first. A line a kept command already holds
/// is left out when `skip_kept` (the window shows those above).
pub fn top(store: &Store, n: usize, skip_kept: bool) -> Vec<Value> {
    let kept: Vec<String> = list(store).iter().map(|i| g(i, "line").to_lowercase()).collect();
    let mut count: HashMap<String, (usize, String)> = HashMap::new();
    let days = store.log_day(None).ok().and_then(|d| d["days"].as_array().cloned()).unwrap_or_default();
    for d in days {
        let Some(day) = d.as_str() else { continue };
        let Ok(log) = store.log_day(Some(day)) else { continue };
        for e in log["entries"].as_array().cloned().unwrap_or_default() {
            let t = g(&e, "text");
            if t.trim().is_empty() {
                continue;
            }
            let c = count.entry(t.to_lowercase()).or_insert((0, t.clone()));
            c.0 += 1;
        }
    }
    let mut v: Vec<(usize, String)> = count.into_iter().filter(|(k, _)| !(skip_kept && kept.contains(k))).map(|(_, c)| c).collect();
    v.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    v.into_iter().take(n).map(|(times, line)| json!({"line": line, "times": times})).collect()
}
