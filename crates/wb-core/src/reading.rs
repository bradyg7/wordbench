//! Reading progress and reading plans, as plain files in the study folder (new in the Rust app; the Python app has no
//! counterpart, so these files are only read here):
//!
//! ```text
//! reading/log.jsonl          one line per chapter read: {"t": time, "ch": "NUM.25", "plan": "" or a plan's id}
//!                            (append-only, so two devices merge it by keeping both sides' lines)
//! reading/plans/<id>.json    a plan the person started: its name, kind, first day and every day's readings, written
//!                            out in full when it starts, so the plan never changes under the person
//! ```
//!
//! Built-in plans are only those whose order needs no judgment: the books in the Bible's own order, spread over a number
//! of days with each day's words balanced. An order such as a chronological one is an editorial choice that published
//! plans make differently, so the app does not ship its own; the person imports the plan they choose (`plan_import`).
//! Nothing here reminds, nags or counts streaks: it says where the person is, and how far behind or ahead.

use crate::bible::Bible;
use crate::places::{parse_spans, Span};
use crate::store::{bad, cut, missing, now, py_dumps, py_dumps_indent1, write_atomic};
use crate::Result;
use chrono::{Datelike, NaiveDate};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// The built-in kinds: id, what it reads, the usual number of days.
pub const KINDS: &[(&str, &str, u32)] = &[
    ("canonical", "The whole Bible, Genesis to Revelation, in its own order", 365),
    ("ot-nt", "The Old Testament and the New side by side: some of each every day", 365),
    ("nt", "The New Testament, Matthew to Revelation", 90),
    ("psalms-proverbs", "Psalms and Proverbs", 31),
    ("books", "The books you name (--books), in the Bible's order", 30),
];

fn folder(root: &Path) -> PathBuf {
    root.join("reading")
}

fn plan_path(root: &Path, id: &str) -> PathBuf {
    folder(root).join("plans").join(format!("{id}.json"))
}

fn slug(name: &str) -> String {
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

pub fn today() -> NaiveDate {
    chrono::Local::now().date_naive()
}

fn parse_day(s: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| bad("A day looks like 2026-11-03."))
}

// ---- making a schedule ----------------------------------------------------------------------------------------------

/// Every chapter of these books with its number of words, in the Bible's order.
fn chapters(bible: &Bible, books: &[u32]) -> Result<Vec<(String, u32)>> {
    let mut stmt = bible.conn().prepare_cached("SELECT book, chapter, COUNT(*) FROM words GROUP BY book, chapter ORDER BY book, chapter")?;
    let rows: Vec<(u32, u32, u32)> = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    Ok(rows
        .into_iter()
        .filter(|r| books.contains(&r.0))
        .map(|(b, c, n)| (format!("{}.{c}", bible.books().iter().find(|x| x.id == b).unwrap().code), n))
        .collect())
}

/// Whole chapters cut into `days` runs in order, each about the same number of words (a day ends at the chapter
/// boundary nearest its share of the total).
fn spread(chs: &[(String, u32)], days: usize) -> Vec<Vec<String>> {
    let total: f64 = chs.iter().map(|c| c.1 as f64).sum();
    let mut out: Vec<Vec<String>> = vec![];
    let (mut acc, mut cur) = (0f64, vec![]);
    for (k, (ch, n)) in chs.iter().enumerate() {
        let target = total * (out.len() + 1) as f64 / days as f64;
        let left_days = days - out.len();
        let left_chs = chs.len() - k;
        // close the day before this chapter when that lands nearer the target, or when every later day needs one
        if !cur.is_empty() && out.len() + 1 < days && (left_chs < left_days || (acc - target).abs() < (acc + *n as f64 - target).abs()) {
            out.push(std::mem::take(&mut cur));
        }
        cur.push(ch.clone());
        acc += *n as f64;
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// Fewer chapters than days (the NT read beside the OT in a year): each chapter goes on the day where its words fall,
/// so some days have none.
fn sparse(chs: &[(String, u32)], days: usize) -> Vec<Vec<String>> {
    let total: f64 = chs.iter().map(|c| c.1 as f64).sum();
    let mut out = vec![vec![]; days];
    let mut acc = 0f64;
    for (ch, n) in chs {
        let mid = acc + *n as f64 / 2.0;
        out[((mid / total * days as f64) as usize).min(days - 1)].push(ch.clone());
        acc += *n as f64;
    }
    out
}

fn ids(from: u32, to: u32) -> Vec<u32> {
    (from..=to).collect()
}

/// The days of a built-in plan.
pub fn schedule(bible: &Bible, kind: &str, days: u32, books: Option<&str>) -> Result<Vec<Vec<String>>> {
    let days = days as usize;
    if days == 0 || days > 3650 {
        return Err(bad("A plan is 1 to 3650 days."));
    }
    let make = |b: Vec<u32>| -> Result<Vec<Vec<String>>> {
        let chs = chapters(bible, &b)?;
        if chs.len() < days {
            return Err(bad(format!("That is {} chapters; a plan of {days} days needs at least one a day.", chs.len())));
        }
        Ok(spread(&chs, days))
    };
    match kind {
        "canonical" => make(ids(1, 66)),
        "nt" => make(ids(40, 66)),
        "psalms-proverbs" => make(vec![19, 20]),
        "ot-nt" => {
            let nt_chs = chapters(bible, &ids(40, 66))?;
            let nt = if nt_chs.len() < days { sparse(&nt_chs, days) } else { spread(&nt_chs, days) };
            let ot = make(ids(1, 39))?;
            Ok(ot.into_iter().zip(nt).map(|(mut a, b)| {
                a.extend(b);
                a
            }).collect())
        }
        "books" => {
            let scope = crate::places::scope_of(books.ok_or_else(|| bad("Name the books: --books gospels, --books rom, --books ot ..."))?, bible.books())?;
            let picked: Vec<u32> = bible.books().iter().filter(|b| crate::places::in_scope(b, &scope)).map(|b| b.id).collect();
            make(picked)
        }
        other => Err(bad(format!("No plan kind “{other}”. Kinds: {}.", KINDS.iter().map(|k| k.0).collect::<Vec<_>>().join(", ")))),
    }
}

/// A plan as text, one day to a line, each line places joined by ';' ("Job 1-5; Ps 1"); # starts a comment. Whole
/// chapters are kept as chapters (GEN.1); a part of a chapter as its verses (PSA.119:1-119:88).
pub fn parse_plan_text(bible: &Bible, text: &str) -> Result<Vec<Vec<String>>> {
    let mut out = vec![];
    for (n, raw) in text.lines().enumerate() {
        let line = raw.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let spans = parse_spans(line, bible.books()).map_err(|e| bad(format!("Line {} ({}): {}", n + 1, cut(line, 40), e.0)))?;
        let mut day = vec![];
        for s in spans {
            day.extend(entries(&s));
        }
        out.push(day);
    }
    if out.is_empty() {
        return Err(bad("The plan has no days: one day to a line, like Gen 1-3."));
    }
    Ok(out)
}

/// A span as plan entries: its chapters, or the verses of a part of one.
fn entries(s: &Span) -> Vec<String> {
    let code = &s.book.code;
    if s.v1 == 0 && s.v2 == 0 {
        return (s.c1..=s.c2).map(|c| format!("{code}.{c}")).collect();
    }
    let end = if s.v2 == 0 { format!("{}:999", s.c2) } else { format!("{}:{}", s.c2, s.v2) };
    vec![format!("{code}.{}:{}-{end}", s.c1, s.v1.max(1))]
}

/// "Genesis 1–3; Matthew 1" for a day's entries.
pub fn label(bible: &Bible, day: &[String]) -> String {
    let mut parts: Vec<String> = vec![];
    let mut run: Option<(String, u32, u32)> = None; // book code, first and last chapter
    let name = |code: &str| bible.books().iter().find(|b| b.code == code).map(|b| b.name.clone()).unwrap_or_else(|| code.to_string());
    let flush = |run: &mut Option<(String, u32, u32)>, parts: &mut Vec<String>| {
        if let Some((code, a, b)) = run.take() {
            parts.push(if a == b { format!("{} {a}", name(&code)) } else { format!("{} {a}–{b}", name(&code)) });
        }
    };
    for e in day {
        let (code, rest) = e.split_once('.').unwrap_or((e, ""));
        match rest.parse::<u32>() {
            Ok(c) => match &mut run {
                Some((rc, _, b)) if rc == code && *b + 1 == c => *b = c,
                _ => {
                    flush(&mut run, &mut parts);
                    run = Some((code.to_string(), c, c));
                }
            },
            Err(_) => {
                flush(&mut run, &mut parts);
                let (c1, rest) = rest.split_once(':').unwrap_or((rest, ""));
                let (v1, end) = rest.split_once('-').unwrap_or((rest, ""));
                let (c2, v2) = end.split_once(':').unwrap_or((c1, end));
                let v2 = if v2 == "999" { "end".to_string() } else { v2.to_string() };
                parts.push(if c1 == c2 { format!("{} {c1}:{v1}–{v2}", name(code)) } else { format!("{} {c1}:{v1}–{c2}:{v2}", name(code)) });
            }
        }
    }
    flush(&mut run, &mut parts);
    parts.join("; ")
}

// ---- plans and the log ----------------------------------------------------------------------------------------------

pub fn read_plan(root: &Path, id: &str) -> Result<Value> {
    let text = fs::read_to_string(plan_path(root, id)).map_err(|_| missing("No such plan."))?;
    let mut v: Value = serde_json::from_str(&text).map_err(|_| bad(format!("reading/plans/{id}.json is not a plan file")))?;
    v["id"] = json!(id);
    Ok(v)
}

pub fn plans(root: &Path) -> Vec<Value> {
    let Ok(rd) = fs::read_dir(folder(root).join("plans")) else { return vec![] };
    let mut ps: Vec<PathBuf> = rd.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json")).collect();
    ps.sort();
    ps.iter().filter_map(|p| read_plan(root, &p.file_stem()?.to_string_lossy()).ok()).collect()
}

/// A plan by exact id or name, else a unique start of a name, else a unique part of one.
pub fn find_plan(root: &Path, name: &str) -> Result<Value> {
    let n = name.trim().to_lowercase();
    let every = plans(root);
    let low = |p: &Value| p["name"].as_str().unwrap_or("").to_lowercase();
    let pools: [Vec<&Value>; 3] = [
        every.iter().filter(|p| p["id"] == n.as_str() || low(p) == n).collect(),
        every.iter().filter(|p| low(p).starts_with(&n)).collect(),
        every.iter().filter(|p| low(p).contains(&n)).collect(),
    ];
    let hit = if n.is_empty() { vec![] } else { pools.into_iter().find(|p| !p.is_empty()).unwrap_or_default() };
    match hit.len() {
        0 => Err(missing(format!("No reading plan called “{}”.", cut(name.trim(), 60)))),
        1 => Ok(hit[0].clone()),
        _ => Err(bad(format!("Which plan? {}", hit.iter().map(|p| p["name"].as_str().unwrap_or("")).collect::<Vec<_>>().join(", ")))),
    }
}

/// Start a plan: its whole schedule is written to reading/plans/<id>.json.
pub fn start_plan(root: &Path, name: &str, kind: &str, start: Option<&str>, days: Vec<Vec<String>>) -> Result<Value> {
    crate::store::guard(root)?;
    let name = name.trim();
    let id = slug(name);
    if id.is_empty() {
        return Err(bad("A plan needs a name."));
    }
    if plan_path(root, &id).exists() {
        return Err(bad(format!("There is already a plan called “{name}”.")));
    }
    let start = match start {
        Some(s) => parse_day(s)?,
        None => today(),
    };
    let plan = json!({"name": cut(name, 120), "kind": kind, "start": start.format("%Y-%m-%d").to_string(), "created": now(), "days": days});
    write_atomic(&plan_path(root, &id), &(py_dumps_indent1(&plan) + "\n"))?;
    read_plan(root, &id)
}

pub fn remove_plan(root: &Path, id: &str) -> Result<()> {
    let p = plan_path(root, id);
    if !p.exists() {
        return Err(missing("No such plan."));
    }
    let dest = root.join(".trash").join(format!("{}-plan-{id}.json", chrono::Utc::now().format("%Y%m%d-%H%M%S")));
    fs::create_dir_all(dest.parent().unwrap())?;
    fs::rename(p, dest)?;
    Ok(())
}

/// Every line of the reading log, oldest first.
pub fn log(root: &Path) -> Vec<Value> {
    fs::read_to_string(folder(root).join("log.jsonl")).map(|t| t.lines().filter_map(|l| serde_json::from_str(l).ok()).collect()).unwrap_or_default()
}

/// Record readings: one log line each (`entries` are chapters, NUM.25, or plan entries).
pub fn mark(root: &Path, entries: &[String], plan: &str) -> Result<Vec<Value>> {
    crate::store::guard(root)?;
    if entries.is_empty() {
        return Err(bad("Name what was read."));
    }
    let path = folder(root).join("log.jsonl");
    fs::create_dir_all(path.parent().unwrap())?;
    let t = now();
    let lines: Vec<Value> = entries.iter().map(|e| json!({"t": t, "ch": e, "plan": plan})).collect();
    use std::io::Write;
    let mut f = fs::OpenOptions::new().create(true).append(true).open(&path)?;
    for l in &lines {
        f.write_all((py_dumps(l) + "\n").as_bytes())?;
    }
    Ok(lines)
}

/// When each chapter was last read, from the log: `{"NUM.25": "2026-11-03T21:53:49Z", ...}`; a chapter never read is left out.
pub fn last_read(root: &Path, chapters: &[String]) -> Value {
    let mut out = serde_json::Map::new();
    for l in log(root) {
        if let (Some(ch), Some(t)) = (l["ch"].as_str(), l["t"].as_str()) {
            if chapters.iter().any(|c| c == ch) {
                out.insert(ch.to_string(), json!(t));
            }
        }
    }
    Value::Object(out)
}

/// A place as typed → the chapters it covers (whole chapters; a verse range counts its chapters).
pub fn chapters_of(bible: &Bible, place: &str) -> Result<Vec<String>> {
    let mut out = vec![];
    for s in parse_spans(place, bible.books())? {
        out.extend((s.c1..=s.c2).map(|c| format!("{}.{c}", s.book.code)));
    }
    Ok(out)
}

/// The person's own day of a log time (the log is in UTC; a plan's days are the person's local days).
fn local_day(t: &str) -> Option<NaiveDate> {
    chrono::DateTime::parse_from_rfc3339(t).ok().map(|d| d.with_timezone(&chrono::Local).date_naive())
}

/// What is done of a plan: each day's entries are done when the log has each of them, marked for this plan, or marked
/// with no plan on or after the plan's first day.
pub fn progress(bible: &Bible, root: &Path, plan: &Value, on: NaiveDate) -> Result<Value> {
    let start = parse_day(plan["start"].as_str().unwrap_or(""))?;
    let id = plan["id"].as_str().unwrap_or("");
    let read: std::collections::HashSet<String> = log(root)
        .into_iter()
        .filter(|l| {
            let p = l["plan"].as_str().unwrap_or("");
            p == id || (p.is_empty() && l["t"].as_str().and_then(local_day).is_some_and(|d| d >= start))
        })
        .filter_map(|l| l["ch"].as_str().map(String::from))
        .collect();
    let days = plan["days"].as_array().cloned().unwrap_or_default();
    let mut rows = vec![];
    let mut done_days = 0;
    for (k, d) in days.iter().enumerate() {
        let es: Vec<String> = d.as_array().unwrap_or(&vec![]).iter().filter_map(|e| e.as_str().map(String::from)).collect();
        let done: Vec<bool> = es.iter().map(|e| read.contains(e)).collect();
        let all = done.iter().all(|x| *x);
        done_days += all as usize;
        let date = start + chrono::Days::new(k as u64);
        rows.push(json!({"day": k + 1, "date": date.format("%Y-%m-%d").to_string(), "label": label(bible, &es), "entries": es, "read": done, "done": all}));
    }
    let today_n = (on - start).num_days() + 1; // which day of the plan it is
    let due = today_n.clamp(0, days.len() as i64) as usize;
    let behind = rows.iter().take(due).filter(|r| r["done"] == false).count();
    let next = rows.iter().find(|r| r["done"] == false).cloned();
    Ok(json!({"id": id, "name": plan["name"], "kind": plan["kind"], "start": plan["start"], "days": days.len(), "done": done_days,
        "today": if today_n >= 1 && today_n as usize <= days.len() { json!(today_n) } else { json!(null) },
        "behind": behind, "ahead": done_days.saturating_sub(due), "finished": done_days == days.len(),
        "next": next, "schedule": rows, "weekday": on.weekday().to_string()}))
}

/// What to read today in each plan: today's day, and any earlier day not yet done.
pub fn today_view(bible: &Bible, root: &Path, on: NaiveDate) -> Result<Value> {
    let mut out = vec![];
    for p in plans(root) {
        let pr = progress(bible, root, &p, on)?;
        let n = pr["today"].as_u64();
        let open: Vec<Value> = pr["schedule"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|r| r["done"] == false && n.is_some_and(|t| r["day"].as_u64().unwrap() <= t))
            .cloned()
            .collect();
        let this_day = n.and_then(|t| pr["schedule"].as_array().unwrap().get(t as usize - 1).cloned());
        out.push(json!({"plan": pr["name"], "id": pr["id"], "day": pr["today"], "of": pr["days"], "today": this_day,
            "behind": pr["behind"], "ahead": pr["ahead"], "finished": pr["finished"], "to_read": open, "next": pr["next"]}));
    }
    Ok(json!({"date": on.format("%Y-%m-%d").to_string(), "plans": out}))
}

/// How much of the Bible the log shows read: chapters read at least once, by book and in all.
pub fn overall(bible: &Bible, root: &Path) -> Result<Value> {
    let lines = log(root);
    let read: std::collections::HashSet<String> = lines.iter().filter_map(|l| l["ch"].as_str()).filter(|c| !c.contains(':')).map(String::from).collect();
    let mut books = vec![];
    let (mut total, mut got) = (0u32, 0u32);
    for b in bible.books() {
        let n = (1..=b.chapters).filter(|c| read.contains(&format!("{}.{c}", b.code))).count() as u32;
        total += b.chapters;
        got += n;
        if n > 0 {
            books.push(json!({"book": b.name, "read": n, "of": b.chapters}));
        }
    }
    let last = lines.last().map(|l| json!({"t": l["t"], "ch": l["ch"]}));
    Ok(json!({"chapters": got, "of": total, "percent": (got as f64 * 1000.0 / total as f64).round() / 10.0, "books": books, "last": last, "lines": lines.len()}))
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spread_keeps_order_whole_chapters_and_balances_days() {
        let chs: Vec<(String, u32)> = (1..=10).map(|c| (format!("GEN.{c}"), if c == 5 { 50 } else { 10 })).collect();
        let days = spread(&chs, 4);
        assert_eq!(days.len(), 4);
        assert_eq!(days.concat(), chs.iter().map(|c| c.0.clone()).collect::<Vec<_>>());
        assert!(days.iter().all(|d| !d.is_empty()));
        let sp = sparse(&chs, 20);
        assert_eq!(sp.len(), 20);
        assert_eq!(sp.concat(), chs.iter().map(|c| c.0.clone()).collect::<Vec<_>>()); // in order, each chapter once
        let one: Vec<(String, u32)> = (1..=3).map(|c| (format!("JUD.{c}"), 1)).collect();
        assert_eq!(spread(&one, 3), vec![vec!["JUD.1"], vec!["JUD.2"], vec!["JUD.3"]]);
    }
}
