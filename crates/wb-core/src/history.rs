//! The trail: every tab opened, in the order it was opened, and the tab it was opened from (design/features/minimize,
//! build go-ahead 2026-11-13; drawn in the top bar by design/features/command round 2, C13-C16).
//!
//! history/<yyyy-mm-dd>.jsonl   one step per line, by the day it was taken (UTC):
//!                              {"id", "at", "from", "kind", "title", "line"}
//!                              `from` is the id of the step it was opened from ("" for a start), `kind` the kind of tab
//!                              (verse, word, uses, search, page, …), `line` the command line that opens it again.
//!
//! The window says "trail"; the folder and the command say `history`, because `trails/` (and `wb trail`) still hold the
//! old questions. Steps are only added: nothing here changes a file the person wrote. A 30-minute gap between two steps
//! starts a new sitting.
use crate::store::{bad, guard, new_id, now};
use crate::Result;
use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// A gap this long between two steps starts a new sitting (minimize round 5, N).
pub const SITTING_GAP_MINUTES: i64 = 30;

fn dir(root: &Path) -> PathBuf {
    root.join("history")
}

fn day_file(root: &Path, at: &str) -> PathBuf {
    dir(root).join(format!("{}.jsonl", &at[..10.min(at.len())]))
}

fn when(at: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(at)
        .ok()
        .map(|d| d.with_timezone(&Utc))
}

fn one_line(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Adds a step and returns it. `from` is the step it was opened from ("" or None: it starts a way of its own).
pub fn add(root: &Path, kind: &str, title: &str, line: &str, from: Option<&str>) -> Result<Value> {
    guard(root)?;
    let (kind, title, line) = (one_line(kind), one_line(title), one_line(line));
    if kind.is_empty() || title.is_empty() {
        return Err(bad(
            "A step needs a kind and a title (wb history add <kind> <title> --line \"…\").",
        ));
    }
    let at = now();
    let step = json!({"id": new_id("s"), "at": at, "from": from.map(str::trim).unwrap_or(""), "kind": kind,
        "title": title, "line": line});
    let path = day_file(root, &at);
    fs::create_dir_all(dir(root))?;
    let mut f = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)?;
    writeln!(
        f,
        "{}",
        serde_json::to_string(&step).map_err(|e| bad(e.to_string()))?
    )?;
    Ok(step)
}

/// Every step kept, oldest first (`days`: only the last so many days' files; 0: all of them). A line that cannot be read
/// is passed over, so one bad line never hides the rest.
pub fn steps(root: &Path, days: usize) -> Result<Vec<Value>> {
    let mut files: Vec<PathBuf> = match fs::read_dir(dir(root)) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|x| x == "jsonl"))
            .collect(),
        Err(_) => return Ok(vec![]),
    };
    files.sort();
    if days > 0 && files.len() > days {
        files.drain(..files.len() - days);
    }
    let mut out = vec![];
    for f in files {
        for ln in fs::read_to_string(&f)?.lines() {
            if let Ok(v) = serde_json::from_str::<Value>(ln) {
                if v.get("id").and_then(Value::as_str).is_some()
                    && v.get("at").and_then(Value::as_str).is_some()
                {
                    out.push(v);
                }
            }
        }
    }
    out.sort_by(|a, b| a["at"].as_str().cmp(&b["at"].as_str()));
    Ok(out)
}

/// The pages opened (steps of kind `page`, whose line is `page <id>`), newest first, each page once: `(id, when it was last opened)`.
pub fn page_opens(root: &Path) -> Result<Vec<(String, String)>> {
    let mut seen = std::collections::HashSet::new();
    let mut out = vec![];
    for s in steps(root, 0)?.into_iter().rev() {
        if s["kind"] != "page" {
            continue;
        }
        let Some(id) = s["line"]
            .as_str()
            .and_then(|l| l.strip_prefix("page "))
            .map(str::trim)
            .filter(|i| !i.is_empty())
        else {
            continue;
        };
        if seen.insert(id.to_string()) {
            out.push((id.to_string(), s["at"].as_str().unwrap_or("").to_string()));
        }
    }
    Ok(out)
}

/// The steps cut into sittings (a gap of `SITTING_GAP_MINUTES` or more starts one), newest sitting first. Each:
/// `{start, at, end, count, title, steps}` (`steps` only with `with_steps`).
pub fn sittings(root: &Path, days: usize, with_steps: bool) -> Result<Value> {
    let all = steps(root, days)?;
    let mut groups: Vec<Vec<Value>> = vec![];
    let mut last: Option<DateTime<Utc>> = None;
    for s in all {
        let t = when(s["at"].as_str().unwrap_or(""));
        let new = match (last, t) {
            (Some(l), Some(t)) => t - l >= Duration::minutes(SITTING_GAP_MINUTES),
            _ => true,
        };
        if new || groups.is_empty() {
            groups.push(vec![]);
        }
        if t.is_some() {
            last = t;
        }
        groups.last_mut().unwrap().push(s);
    }
    let list: Vec<Value> = groups
        .into_iter()
        .rev()
        .map(|g| {
            let first = &g[0];
            let mut v = json!({"start": first["id"], "at": first["at"], "end": g[g.len() - 1]["at"], "count": g.len(),
                "title": first["title"], "kind": first["kind"]});
            if with_steps {
                v["steps"] = Value::Array(g.clone());
            }
            v
        })
        .collect();
    Ok(json!({"sittings": list, "gap_minutes": SITTING_GAP_MINUTES}))
}

/// One sitting, by the id of its first step (or "last": the newest), with its steps.
pub fn sitting(root: &Path, start: &str) -> Result<Value> {
    let all = sittings(root, 0, true)?;
    let list = all["sittings"].as_array().cloned().unwrap_or_default();
    // a sitting's first step, or any step in it: the window that opened again within 30 minutes goes on with the
    // sitting kept on disk, whose start came before the window's own first step
    let has = |s: &Value| {
        s["steps"]
            .as_array()
            .is_some_and(|v| v.iter().any(|x| x["id"] == start))
    };
    let found = if start == "last" {
        list.first().cloned()
    } else {
        list.iter()
            .find(|s| s["start"] == start)
            .or_else(|| list.iter().find(|s| has(s)))
            .cloned()
    };
    found.ok_or_else(|| {
        bad(format!(
            "No sitting holds the step {start} (wb history sittings lists them)."
        ))
    })
}

/// A sitting written out as a page's text: a title line, then one line per step, indented under the step it came from.
pub fn as_page_text(sitting: &Value) -> String {
    let steps = sitting["steps"].as_array().cloned().unwrap_or_default();
    let ids: Vec<&str> = steps
        .iter()
        .map(|s| s["id"].as_str().unwrap_or(""))
        .collect();
    let depth_of = |i: usize| {
        let mut d = 0;
        let mut at = steps[i]["from"].as_str().unwrap_or("").to_string();
        while let Some(j) = ids.iter().position(|x| *x == at && !at.is_empty()) {
            d += 1;
            if d > 12 {
                break;
            }
            at = steps[j]["from"].as_str().unwrap_or("").to_string();
        }
        d
    };
    let head = format!(
        "Trail: {} · {}",
        short_time(sitting["at"].as_str().unwrap_or("")),
        sitting["title"].as_str().unwrap_or("")
    );
    let mut out = format!("# {head}\n\n");
    for (i, s) in steps.iter().enumerate() {
        let line = s["line"].as_str().unwrap_or("");
        out.push_str(&format!(
            "{}- {} {}{}\n",
            "  ".repeat(depth_of(i)),
            short_time(s["at"].as_str().unwrap_or("")),
            s["title"].as_str().unwrap_or(""),
            if line.is_empty() {
                String::new()
            } else {
                format!(" (`{line}`)")
            }
        ));
    }
    out
}

/// A step's time as the person reads it: the computer's own time zone (the files keep UTC).
fn short_time(at: &str) -> String {
    when(at)
        .map(|d| {
            d.with_timezone(&chrono::Local)
                .format("%Y-%m-%d %H:%M")
                .to_string()
        })
        .unwrap_or_else(|| at.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> PathBuf {
        let d = std::env::temp_dir().join(format!("wb-history-{}", new_id("t")));
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn put(root: &Path, at: &str, id: &str, from: &str, title: &str) {
        let line = json!({"id": id, "at": at, "from": from, "kind": "verse", "title": title, "line": format!("go {title}")});
        fs::create_dir_all(dir(root)).unwrap();
        let mut f = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(day_file(root, at))
            .unwrap();
        writeln!(f, "{line}").unwrap();
    }

    #[test]
    fn add_appends_one_line_per_step_and_reads_back() {
        let root = scratch();
        let a = add(&root, "verse", "Numbers 25:11", "go Num 25:11", None).unwrap();
        let b = add(&root, "word", "H7068", "strong H7068", a["id"].as_str()).unwrap();
        let all = steps(&root, 0).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[1]["from"], a["id"]);
        assert_eq!(all[1]["id"], b["id"]);
        let text = fs::read_to_string(day_file(&root, a["at"].as_str().unwrap())).unwrap();
        assert_eq!(text.lines().count(), 2);
        assert!(add(&root, "", "x", "", None).is_err());
    }

    #[test]
    fn a_thirty_minute_gap_starts_a_new_sitting_newest_first() {
        let root = scratch();
        put(&root, "2026-11-13T09:14:00Z", "s1", "", "Numbers 25:11");
        put(&root, "2026-11-13T09:15:00Z", "s2", "s1", "H7068");
        put(&root, "2026-11-13T09:44:59Z", "s3", "s2", "Romans 10:2");
        put(&root, "2026-11-13T10:20:00Z", "s4", "", "Malachi 2:5");
        put(&root, "2026-11-14T07:02:00Z", "s5", "", "Psalms 1");
        let v = sittings(&root, 0, false).unwrap();
        let s = v["sittings"].as_array().unwrap();
        assert_eq!(s.len(), 3);
        assert_eq!(s[0]["start"], "s5");
        assert_eq!(s[1]["start"], "s4");
        assert_eq!(s[2]["start"], "s1");
        assert_eq!(s[2]["count"], 3);
        assert_eq!(
            sittings(&root, 1, false).unwrap()["sittings"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn a_sitting_is_found_by_any_of_its_steps() {
        let root = scratch();
        put(&root, "2026-11-13T09:14:00Z", "s1", "", "Numbers 25");
        put(&root, "2026-11-13T09:15:00Z", "s2", "", "Numbers 25");
        put(&root, "2026-11-13T09:16:00Z", "s3", "s2", "H7065");
        assert_eq!(sitting(&root, "s2").unwrap()["start"], "s1");
        assert_eq!(sitting(&root, "s1").unwrap()["count"], 3);
        assert!(sitting(&root, "nope").is_err());
    }

    #[test]
    fn a_bad_line_is_passed_over() {
        let root = scratch();
        put(&root, "2026-11-13T09:14:00Z", "s1", "", "Numbers 25:11");
        let mut f = fs::OpenOptions::new()
            .append(true)
            .open(day_file(&root, "2026-11-13"))
            .unwrap();
        writeln!(f, "not json").unwrap();
        assert_eq!(steps(&root, 0).unwrap().len(), 1);
    }

    #[test]
    fn a_sitting_as_a_page_indents_side_trips() {
        let root = scratch();
        put(&root, "2026-11-13T09:14:00Z", "s1", "", "Numbers 25:11");
        put(&root, "2026-11-13T09:15:00Z", "s2", "s1", "H7068");
        put(&root, "2026-11-13T09:16:00Z", "s3", "s2", "Every use: zeal");
        let s = sitting(&root, "last").unwrap();
        let text = as_page_text(&s);
        // the page is in the computer's own time; the files keep UTC
        assert!(text.starts_with(&format!(
            "# Trail: {} · Numbers 25:11\n",
            short_time("2026-11-13T09:14:00Z")
        )));
        assert!(text.contains(&format!(
            "\n    - {} Every use: zeal (`go Every use: zeal`)\n",
            short_time("2026-11-13T09:16:00Z")
        )));
        assert!(sitting(&root, "nope").is_err());
    }
}
