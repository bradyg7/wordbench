//! Reading progress and reading plans, as plain files in the study folder (new in the Rust app; the Python app has no
//! counterpart, so these files are only read here):
//!
//! ```text
//! reading/log.jsonl          one line per chapter read: {"t": time, "ch": "NUM.25", "plan": "" or a plan's id}
//!                            (append-only, so two devices merge it by keeping both sides' lines). A part of a chapter read adds
//!                            "v": "1-9" (verses); a line without it is the whole chapter. Old lines are never rewritten.
//! reading/plans/<id>.json    a plan the person started: its name, kind, first day and every day's readings, written
//!                            out in full when it starts, so the plan never changes under the person
//! ```
//!
//! Built-in plans are those whose order needs no judgment: the books in the Bible's own order, spread over a number
//! of days with each day's words balanced. An order such as a chronological one is an editorial choice that published
//! plans make differently, so the app does not ship its own; the person imports the plan they choose (`plan_import`).
//! One editorial order ships, because the person asked for it (reading-plans RP-9, 2026-11-11): Horner's ten lists, ten
//! ranges of books each read in its own order, a chapter of each a day, with no end (`published::horner_kind`).
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
    ("books", "The books you choose, in the Bible's order", 30),
    ("horner", "Horner's ten lists: a chapter of each of ten lists a day, each list starting again when it is done, no end date", 0),
];

pub(crate) fn folder(root: &Path) -> PathBuf {
    root.join("reading")
}

pub(crate) fn plan_path(root: &Path, id: &str) -> PathBuf {
    folder(root).join("plans").join(format!("{id}.json"))
}

pub(crate) fn slug(name: &str) -> String {
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

pub(crate) fn parse_day(s: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| bad("A day looks like 2026-11-03."))
}

// ---- making a schedule ----------------------------------------------------------------------------------------------

/// Every chapter of these books with its number of words, book by book in the order the books are given (the Bible's
/// order when the ids ascend).
pub(crate) fn chapters(bible: &Bible, books: &[u32]) -> Result<Vec<(String, u32)>> {
    let mut stmt = bible.conn().prepare_cached("SELECT book, chapter, COUNT(*) FROM words GROUP BY book, chapter ORDER BY book, chapter")?;
    let rows: Vec<(u32, u32, u32)> = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    let mut out = vec![];
    for id in books {
        let code = &bible.books().iter().find(|x| x.id == *id).unwrap().code;
        out.extend(rows.iter().filter(|r| r.0 == *id).map(|(_, c, n)| (format!("{code}.{c}"), *n)));
    }
    Ok(out)
}

/// Whole chapters cut into `days` runs in order, each about the same number of words (a day ends at the chapter
/// boundary nearest its share of the total).
pub(crate) fn spread(chs: &[(String, u32)], days: usize) -> Vec<Vec<String>> {
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
pub(crate) fn sparse(chs: &[(String, u32)], days: usize) -> Vec<Vec<String>> {
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

/// The books a plan of the books kind reads, in the Bible's order: one name or group (gospels, rom, ot, Gen-Deut), or
/// several joined by commas or semicolons ("gospels, rom").
pub(crate) fn books_named(bible: &Bible, named: &str) -> Result<Vec<u32>> {
    use crate::places::{in_scope, match_book, scope_of};
    let one = |p: &str| -> Result<String> {
        match p.split_once('-') {
            Some((a, b)) if scope_of(p, bible.books()).is_err() => {
                let (a, b) = (match_book(a, bible.books())?.id, match_book(b, bible.books())?.id);
                Ok((a.min(b)..=a.max(b)).map(|i| i.to_string()).collect::<Vec<_>>().join(","))
            }
            _ => scope_of(p, bible.books()),
        }
    };
    let scopes = match one(named) {
        Ok(s) => vec![s],
        Err(_) => named.split([',', ';']).map(str::trim).filter(|p| !p.is_empty()).map(one).collect::<Result<_>>()?,
    };
    Ok(bible.books().iter().filter(|b| scopes.iter().any(|s| in_scope(b, s))).map(|b| b.id).collect())
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
            let named = books.map(str::trim).filter(|b| !b.is_empty()).ok_or_else(|| bad("Name the books, like gospels, rom, ot or Gen-Deut."))?;
            make(books_named(bible, named)?)
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
    start_plan_with(root, name, kind, start, days, json!({}))
}

/// Start a plan with more fields in its file (`days_off`, `dated`, `pace`, `order`, `books`, `passages`, `source`): new
/// fields are added to the file, none is renamed.
pub fn start_plan_with(root: &Path, name: &str, kind: &str, start: Option<&str>, days: Vec<Vec<String>>, extra: Value) -> Result<Value> {
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
    let mut plan = json!({"name": cut(name, 120), "kind": kind, "start": start.format("%Y-%m-%d").to_string(), "created": now(), "days": days});
    for (k, v) in extra.as_object().into_iter().flatten() {
        plan[k] = v.clone();
    }
    write_atomic(&plan_path(root, &id), &(py_dumps_indent1(&plan) + "\n"))?;
    read_plan(root, &id)
}

// ---- changing a plan --------------------------------------------------------------------------------------------------

/// A plan's days as text, one day to a line, in the form `plan import` and `plan edit --text` read back
/// ("Genesis 1-3; Matthew 1", "Psalms 119:89-176").
pub fn plan_text(bible: &Bible, plan: &Value) -> Result<String> {
    let name = |code: &str| bible.books().iter().find(|b| b.code == code).map(|b| b.name.clone()).unwrap_or_else(|| code.to_string());
    let mut lines = vec![];
    for d in plan["days"].as_array().cloned().unwrap_or_default() {
        let es: Vec<String> = d.as_array().unwrap_or(&vec![]).iter().filter_map(|e| e.as_str().map(String::from)).collect();
        let mut parts: Vec<String> = vec![];
        let mut run: Option<(String, u32, u32)> = None;
        let flush = |run: &mut Option<(String, u32, u32)>, parts: &mut Vec<String>| {
            if let Some((code, a, b)) = run.take() {
                parts.push(if a == b { format!("{} {a}", name(&code)) } else { format!("{} {a}-{b}", name(&code)) });
            }
        };
        for e in &es {
            let (code, rest) = e.split_once('.').unwrap_or((e, ""));
            if let Ok(c) = rest.parse::<u32>() {
                match &mut run {
                    Some((rc, _, b)) if rc == code && *b + 1 == c => *b = c,
                    _ => {
                        flush(&mut run, &mut parts);
                        run = Some((code.to_string(), c, c));
                    }
                }
                continue;
            }
            flush(&mut run, &mut parts);
            let (c1, rest) = rest.split_once(':').unwrap_or((rest, ""));
            let (v1, end) = rest.split_once('-').unwrap_or((rest, ""));
            let (c2, v2) = end.split_once(':').unwrap_or((c1, end));
            let v2 = if v2 == "999" { last_verse(bible, code, c2.parse().unwrap_or(0))?.to_string() } else { v2.to_string() };
            parts.push(if c1 == c2 { format!("{} {c1}:{v1}-{v2}", name(code)) } else { format!("{} {c1}:{v1}-{c2}:{v2}", name(code)) });
        }
        flush(&mut run, &mut parts);
        lines.push(if parts.is_empty() { "# (no reading this day)".to_string() } else { parts.join("; ") });
    }
    Ok(lines.join("
") + "
")
}

pub(crate) fn last_verse(bible: &Bible, code: &str, ch: u32) -> Result<u32> {
    let id = bible.book(code)?.id;
    Ok(bible.conn().query_row("SELECT COALESCE(MAX(verse), 0) FROM verses WHERE book = ?1 AND chapter = ?2", rusqlite::params![id, ch], |r| r.get(0))?)
}

/// The number of words an entry reads (a chapter, or a part of one), to balance days.
pub(crate) fn entry_words(bible: &Bible, entry: &str) -> Result<u32> {
    let (code, rest) = entry.split_once('.').unwrap_or((entry, ""));
    let id = bible.book(code)?.id;
    let (c1, v1, c2, v2) = match rest.parse::<u32>() {
        Ok(c) => (c, 0, c, 999),
        Err(_) => {
            let (c1, rest) = rest.split_once(':').unwrap_or((rest, ""));
            let (v1, end) = rest.split_once('-').unwrap_or((rest, ""));
            let (c2, v2) = end.split_once(':').unwrap_or((c1, end));
            (c1.parse().unwrap_or(0), v1.parse().unwrap_or(0), c2.parse().unwrap_or(0), v2.parse().unwrap_or(999))
        }
    };
    Ok(bible.conn().query_row(
        "SELECT COUNT(*) FROM words WHERE book = ?1 AND (chapter * 1000 + verse) BETWEEN ?2 AND ?3",
        rusqlite::params![id, c1 * 1000 + v1, c2 * 1000 + v2],
        |r| r.get(0),
    )?)
}

/// What a change to a plan asks for (`plan edit`). Each is optional; they apply in this order.
#[derive(Default)]
pub struct PlanChange {
    pub name: Option<String>,
    /// Every day replaced (from `plan_text`'s form); the plan's first day stays.
    pub days: Option<Vec<Vec<String>>>,
    pub start: Option<String>,
    /// The days not yet done, spread again over this many days from today (the days done stay as they are).
    pub spread: Option<u32>,
    /// Today becomes the first day not yet done (nothing is behind).
    pub catch_up: bool,
}

/// Change a plan. The file as it was goes to .trash first, so nothing is lost; what was read stays in the log, and a
/// day counts as done by its readings, so changing days never loses progress.
pub fn edit_plan(bible: &Bible, root: &Path, id: &str, ch: PlanChange) -> Result<Value> {
    crate::store::guard(root)?;
    let mut plan = read_plan(root, id)?;
    if let Some(n) = &ch.name {
        let n = n.trim();
        if n.is_empty() {
            return Err(bad("A plan needs a name."));
        }
        if plans(root).iter().any(|p| p["id"] != id && p["name"].as_str().unwrap_or("").to_lowercase() == n.to_lowercase()) {
            return Err(bad(format!("There is already a plan called “{n}”.")));
        }
        plan["name"] = json!(cut(n, 120));
    }
    if let Some(days) = ch.days {
        plan["days"] = json!(days);
        plan.as_object_mut().unwrap().shift_remove("kept"); // the days were written again: none is "as you set it" now
    }
    if let Some(s) = &ch.start {
        plan["start"] = json!(parse_day(s)?.format("%Y-%m-%d").to_string());
    }
    if ch.spread.is_some() || ch.catch_up {
        let pr = progress(bible, root, &plan, today())?;
        let rows = pr["schedule"].as_array().cloned().unwrap_or_default();
        let Some(first) = rows.iter().position(|r| r["done"] == false && r["skipped"] == false) else {
            return Err(bad("Every day of this plan is done."));
        };
        if let Some(n) = ch.spread {
            if n == 0 || n > 3650 {
                return Err(bad("A plan is 1 to 3650 days."));
            }
            let rest: Vec<String> = rows[first..].iter().flat_map(|r| r["entries"].as_array().unwrap().iter().filter_map(|e| e.as_str().map(String::from))).collect();
            if rest.len() < n as usize {
                return Err(bad(format!("What is left is {} readings; spread over {n} days it needs at least one a day.", rest.len())));
            }
            let weighed = rest.iter().map(|e| Ok((e.clone(), entry_words(bible, e)?.max(1)))).collect::<Result<Vec<_>>>()?;
            let mut days: Vec<Value> = plan["days"].as_array().unwrap()[..first].to_vec();
            days.extend(spread(&weighed, n as usize).into_iter().map(|d| json!(d)));
            plan["days"] = json!(days);
            plan.as_object_mut().unwrap().shift_remove("kept");
        }
        plan["start"] = json!(crate::plans::start_for(first, today(), &crate::plans::days_off_of(&plan)).format("%Y-%m-%d").to_string());
    }
    if plan["days"].as_array().is_none_or(|d| d.is_empty()) {
        return Err(bad("The plan has no days: one day to a line, like Gen 1-3."));
    }
    save_plan(root, id, &plan, true)
}

/// Write a plan's file. With `keep_old`, the file as it was goes to .trash first, so a change never loses anything.
pub(crate) fn save_plan(root: &Path, id: &str, plan: &Value, keep_old: bool) -> Result<Value> {
    let path = plan_path(root, id);
    if keep_old && path.exists() {
        let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
        let mut dest = root.join(".trash").join(format!("{stamp}-plan-{id}.json"));
        for n in 2.. {
            if !dest.exists() {
                break;
            }
            dest = root.join(".trash").join(format!("{stamp}-plan-{id}-{n}.json")); // two changes in one second keep both
        }
        fs::create_dir_all(dest.parent().unwrap())?;
        fs::copy(&path, dest)?;
    }
    let mut out = plan.clone();
    out.as_object_mut().unwrap().shift_remove("id");
    write_atomic(&path, &(py_dumps_indent1(&out) + "
"))?;
    read_plan(root, id)
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
    append(root, entries.iter().map(|e| (e.clone(), None)).collect(), plan)
}

// ---- what the log says is read: whole chapters and parts of them (RP-5, RP-6) -----------------------------------------

/// Verse ranges, sorted and merged (1-5 and 6-9 are 1-9).
pub type Ranges = Vec<(u32, u32)>;

pub fn add_range(r: &mut Ranges, a: u32, b: u32) {
    r.push((a.min(b), a.max(b)));
    r.sort();
    let mut out: Ranges = vec![];
    for (x, y) in r.drain(..) {
        match out.last_mut() {
            Some(l) if x <= l.1.saturating_add(1) => l.1 = l.1.max(y),
            _ => out.push((x, y)),
        }
    }
    *r = out;
}

pub fn covers(r: &Ranges, a: u32, b: u32) -> bool {
    r.iter().any(|x| x.0 <= a && x.1 >= b)
}

/// "1-5, 20-25"; a single verse as "7".
pub fn ranges_text(r: &Ranges) -> String {
    r.iter().map(|(a, b)| if a == b { a.to_string() } else { format!("{a}-{b}") }).collect::<Vec<_>>().join(", ")
}

/// "1-9", "7", "1-5, 20-25" → ranges; None when it is not that.
pub fn parse_ranges(s: &str) -> Option<Ranges> {
    let mut out = vec![];
    for part in s.split(',').map(str::trim).filter(|p| !p.is_empty()) {
        let (a, b) = part.split_once('-').unwrap_or((part, part));
        let (a, b): (u32, u32) = (a.trim().parse().ok()?, b.trim().parse().ok()?);
        if a == 0 || b == 0 {
            return None;
        }
        add_range(&mut out, a, b);
    }
    (!out.is_empty()).then_some(out)
}

/// The verses of a chapter read from verse 1 without a gap (the highest verse of the run that starts at verse 1).
pub fn read_to_of(r: &Ranges) -> Option<u32> {
    r.first().filter(|x| x.0 == 1).map(|x| x.1)
}

/// What the log holds of one chapter.
#[derive(Clone, Debug, Default)]
pub struct Cover {
    /// The union of every line's verses (a line with no `v` is the whole chapter).
    pub ranges: Ranges,
    /// Times read: a whole-chapter line, or parts that together cover the chapter, count one each.
    pub times: u32,
    pub last: String,
    /// The verses of the chapter (0 when the chapter is not known).
    pub verses: u32,
}

impl Cover {
    pub fn whole(&self) -> bool {
        self.verses > 0 && covers(&self.ranges, 1, self.verses)
    }
    /// How much of the chapter is read, 0 to 1.
    pub fn fraction(&self) -> f64 {
        if self.verses == 0 {
            return 0.0;
        }
        let n: u32 = self.ranges.iter().map(|(a, b)| b.min(&self.verses).saturating_sub(*a) + 1).sum();
        (n as f64 / self.verses as f64).min(1.0)
    }
    pub fn to_json(&self) -> Value {
        json!({"times": self.times, "last": self.last, "verses": ranges_text(&self.ranges), "read_to": read_to_of(&self.ranges), "whole": self.whole()})
    }
}

/// One log line as the chapter it is about and the verses it holds (None: the whole chapter). A plan entry that is a part of
/// a chapter (`PSA.119:1-119:88`) is that chapter's verses; one that runs across chapters is not a part of any one.
fn line_part(l: &Value) -> Option<(String, Option<(u32, u32)>)> {
    let ch = l["ch"].as_str()?;
    if let Some((c, rest)) = ch.split_once(':') {
        let (v1, end) = rest.split_once('-')?;
        let (c2, v2) = end.split_once(':')?;
        let base = c.rsplit_once('.')?.1;
        if base != c2 {
            return None;
        }
        return Some((c.to_string(), Some((v1.parse().ok()?, v2.parse().ok()?))));
    }
    match l["v"].as_str().and_then(parse_ranges) {
        Some(r) if r.len() == 1 => Some((ch.to_string(), Some(r[0]))),
        Some(r) => Some((ch.to_string(), Some((r[0].0, r.last().unwrap().1)))), // one line, a gap inside: kept by `lines_ranges`
        None => Some((ch.to_string(), None)),
    }
}

fn line_ranges(l: &Value) -> Option<Ranges> {
    if l["ch"].as_str()?.contains(':') {
        return line_part(l).and_then(|(_, r)| r.map(|r| vec![r]));
    }
    l["v"].as_str().and_then(parse_ranges)
}

/// What is read of each chapter in these lines of the log, with the number of verses of each chapter.
pub fn coverage_of(bible: &Bible, lines: &[Value]) -> std::collections::BTreeMap<String, Cover> {
    let mut out: std::collections::BTreeMap<String, Cover> = Default::default();
    let mut pending: std::collections::HashMap<String, Ranges> = Default::default();
    for l in lines {
        let Some((ch, part)) = line_part(l) else { continue };
        let Some(t) = l["t"].as_str() else { continue };
        let c = out.entry(ch.clone()).or_default();
        if c.verses == 0 {
            c.verses = ch.split_once('.').and_then(|(code, n)| last_verse(bible, code, n.parse().unwrap_or(0)).ok()).unwrap_or(0);
        }
        let top = if c.verses == 0 { 999 } else { c.verses };
        c.last = t.to_string();
        match part {
            None => {
                add_range(&mut c.ranges, 1, top);
                c.times += 1;
                pending.remove(&ch);
            }
            Some(_) => {
                let p = pending.entry(ch.clone()).or_default();
                for (a, b) in line_ranges(l).unwrap_or_default() {
                    let b = b.min(top);
                    if a > b {
                        continue;
                    }
                    add_range(&mut c.ranges, a, b);
                    add_range(p, a, b);
                }
                if c.verses > 0 && covers(p, 1, c.verses) {
                    c.times += 1;
                    pending.remove(&ch);
                }
            }
        }
    }
    out
}

/// What the whole log says is read, chapter by chapter (the one place `read_times`, `last_read`, `overall` and `progress` ask).
pub fn coverage(bible: &Bible, root: &Path) -> std::collections::BTreeMap<String, Cover> {
    coverage_of(bible, &log(root))
}

/// When each chapter was last read, from the log: `{"NUM.25": "2026-11-03T21:53:49Z", ...}`; a chapter never read is left out.
pub fn last_read(bible: &Bible, root: &Path, chapters: &[String]) -> Value {
    let cov = coverage(bible, root);
    let mut out = serde_json::Map::new();
    for ch in chapters {
        if let Some(c) = cov.get(ch) {
            out.insert(ch.clone(), json!(c.last));
        }
    }
    Value::Object(out)
}

/// How many times each chapter was read, when last, and which verses:
/// `{"NUM.25": {"times": 3, "last": "2026-11-03T21:53:49Z", "verses": "1-9", "read_to": 9, "whole": false}}`. A chapter never read
/// (not even in part) is left out. A time is counted only when the chapter is read through.
pub fn read_times(bible: &Bible, root: &Path, chapters: &[String]) -> Value {
    let cov = coverage(bible, root);
    let mut out = serde_json::Map::new();
    for ch in chapters {
        if let Some(c) = cov.get(ch) {
            out.insert(ch.clone(), c.to_json());
        }
    }
    Value::Object(out)
}

/// Mark unread: the latest mark of each place comes off the log (the person's choice on the chapter's end, note c419). A place
/// with verses takes off the latest line holding exactly those verses (`Gen 2:1-9`); a chapter, its latest line.
/// Nothing is erased: each line taken off is kept in `.trash/reading-unmarked.jsonl`, as it was. A place not in the log
/// is passed over. Returns the lines taken off and what the log says now.
pub fn unmark(bible: &Bible, root: &Path, place: &str) -> Result<Value> {
    crate::store::guard(root)?;
    let items = place_parts(bible, place)?;
    let path = folder(root).join("log.jsonl");
    let text = fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<&str> = text.lines().collect();
    let mut off: Vec<String> = vec![];
    for (ch, part) in &items {
        let at = lines.iter().rposition(|l| {
            let Ok(v) = serde_json::from_str::<Value>(l) else { return false };
            if v["ch"].as_str() != Some(ch.as_str()) {
                return false;
            }
            match part {
                None => true,
                Some((a, b)) => v["v"].as_str().and_then(parse_ranges) == Some(vec![(*a, *b)]),
            }
        });
        if let Some(i) = at {
            off.push(lines.remove(i).to_string());
        }
    }
    if !off.is_empty() {
        let trash = root.join(".trash").join("reading-unmarked.jsonl");
        fs::create_dir_all(trash.parent().unwrap())?;
        use std::io::Write;
        let mut f = fs::OpenOptions::new().create(true).append(true).open(&trash)?;
        for l in &off {
            f.write_all((l.to_string() + "\n").as_bytes())?;
        }
        let body: String = lines.iter().map(|l| format!("{l}\n")).collect();
        write_atomic(&path, &body)?;
    }
    let taken: Vec<Value> = off.iter().filter_map(|l| serde_json::from_str(l).ok()).collect();
    let chs: Vec<String> = items.iter().map(|i| i.0.clone()).collect();
    Ok(json!({"unmarked": taken, "now": read_times(bible, root, &chs)}))
}

/// A place as typed → the chapters it covers (whole chapters; a verse range counts its chapters).
pub fn chapters_of(bible: &Bible, place: &str) -> Result<Vec<String>> {
    let mut out = vec![];
    for s in parse_spans(place, bible.books())? {
        out.extend((s.c1..=s.c2).map(|c| format!("{}.{c}", s.book.code)));
    }
    Ok(out)
}

/// A place as typed → each chapter it names with the verses asked for: None for a whole chapter (a place without verses),
/// else the verses of that chapter (`Gen 2:1-9` is GEN.2 verses 1 to 9; `Gen 1:5-2:3` is GEN.1 5 to its end and GEN.2 1 to 3).
pub fn place_parts(bible: &Bible, place: &str) -> Result<Vec<(String, Option<(u32, u32)>)>> {
    let mut out = vec![];
    for s in parse_spans(place, bible.books())? {
        for c in s.c1..=s.c2 {
            let ch = format!("{}.{c}", s.book.code);
            if s.v1 == 0 {
                out.push((ch, None));
                continue;
            }
            let from = if c == s.c1 { s.v1 } else { 1 };
            let to = if c == s.c2 {
                if s.v2 == 0 { if s.c1 == s.c2 { s.v1 } else { last_verse(bible, &s.book.code, c)? } } else { s.v2 }
            } else {
                last_verse(bible, &s.book.code, c)?
            };
            out.push((ch, Some((from, to.max(from)))));
        }
    }
    Ok(out)
}

/// Record places as read: a place without verses writes whole chapters (one line each); a place with verses writes one line
/// with `v` for the verses (`{"ch": "GEN.2", "v": "1-9"}`). Returns the lines written.
pub fn mark_place(bible: &Bible, root: &Path, place: &str, plan: &str) -> Result<Vec<Value>> {
    crate::store::guard(root)?;
    let items = place_parts(bible, place)?;
    append(root, items.iter().map(|(ch, part)| (ch.clone(), part.map(|(a, b)| ranges_text(&vec![(a, b)])))).collect(), plan)
}

/// Mark read to here: the verses from the end of what is read from verse 1 up to this verse (`Gen 2:9`). A verse already read
/// changes nothing (nothing is written).
pub fn read_to_here(bible: &Bible, root: &Path, place: &str, plan: &str) -> Result<Vec<Value>> {
    crate::store::guard(root)?;
    let mut out = vec![];
    let cov = coverage(bible, root);
    for s in parse_spans(place, bible.books())? {
        if s.v1 == 0 {
            return Err(bad("Mark read to here needs a verse, like Gen 2:9."));
        }
        let (c, v) = (s.c2, if s.v2 == 0 { s.v1 } else { s.v2 });
        let ch = format!("{}.{c}", s.book.code);
        let have = cov.get(&ch).map(|c| c.ranges.clone()).unwrap_or_default();
        let from = read_to_of(&have).map_or(1, |n| n + 1);
        if from > v {
            continue; // already read
        }
        out.extend(append(root, vec![(ch, Some(ranges_text(&vec![(from, v)])))], plan)?);
    }
    Ok(out)
}

fn append(root: &Path, items: Vec<(String, Option<String>)>, plan: &str) -> Result<Vec<Value>> {
    if items.is_empty() {
        return Err(bad("Name what was read."));
    }
    let path = folder(root).join("log.jsonl");
    fs::create_dir_all(path.parent().unwrap())?;
    let t = now();
    let lines: Vec<Value> = items
        .into_iter()
        .map(|(ch, v)| match v {
            Some(v) => json!({"t": t, "ch": ch, "plan": plan, "v": v}),
            None => json!({"t": t, "ch": ch, "plan": plan}),
        })
        .collect();
    use std::io::Write;
    let mut f = fs::OpenOptions::new().create(true).append(true).open(&path)?;
    for l in &lines {
        f.write_all((py_dumps(l) + "\n").as_bytes())?;
    }
    Ok(lines)
}

/// The person's own day of a log time (the log is in UTC; a plan's days are the person's local days).
fn local_day(t: &str) -> Option<NaiveDate> {
    chrono::DateTime::parse_from_rfc3339(t).ok().map(|d| d.with_timezone(&chrono::Local).date_naive())
}

/// A plan entry as its chapter and the verses it names (None: the whole chapter); None for one that runs across chapters.
fn entry_verses(e: &str) -> Option<(String, Option<(u32, u32)>)> {
    if !e.contains(':') {
        return Some((e.to_string(), None));
    }
    line_part(&json!({"ch": e}))
}

/// What is read of an entry's chapter: `{"read_to": 9 or null, "parts": "20-25", "verses": "1-9, 20-25"}` (parts are the ranges after
/// the run from verse 1). A chapter nothing of is read gives nulls.
fn entry_parts(cov: &std::collections::BTreeMap<String, Cover>, e: &str) -> Value {
    let Some(c) = entry_verses(e).and_then(|(ch, _)| cov.get(&ch)) else { return json!({"read_to": null, "parts": "", "verses": "", "fraction": 0.0, "whole": false}) };
    let to = read_to_of(&c.ranges);
    let rest: Ranges = c.ranges.iter().filter(|r| !(r.0 == 1)).cloned().collect();
    json!({"read_to": to, "parts": ranges_text(&rest), "verses": ranges_text(&c.ranges), "fraction": (c.fraction() * 100.0).round() / 100.0, "whole": c.whole()})
}

/// What is done of a plan: each day's entries are done when the log has each of them, marked for this plan, or marked
/// with no plan on or after the plan's first day.
pub fn progress(bible: &Bible, root: &Path, plan: &Value, on: NaiveDate) -> Result<Value> {
    // a plan with no end has its days written out as far as they are needed
    let ext;
    let plan = if plan["cycle"] == true {
        ext = crate::plans::extended(plan, on);
        &ext
    } else {
        plan
    };
    let start = parse_day(plan["start"].as_str().unwrap_or(""))?;
    let id = plan["id"].as_str().unwrap_or("");
    let lines: Vec<Value> = log(root)
        .into_iter()
        .filter(|l| {
            let p = l["plan"].as_str().unwrap_or("");
            p == id || (p.is_empty() && l["t"].as_str().and_then(local_day).is_some_and(|d| d >= start))
        })
        .collect();
    // an entry is read when a whole-chapter line names it as it is written, or the verses logged cover it (RP-6)
    let exact: std::collections::HashSet<String> = lines.iter().filter(|l| l.get("v").is_none()).filter_map(|l| l["ch"].as_str().map(String::from)).collect();
    let cov = coverage_of(bible, &lines);
    let is_read = |e: &str| -> bool {
        if exact.contains(e) {
            return true;
        }
        match entry_verses(e) {
            Some((ch, Some((a, b)))) => cov.get(&ch).is_some_and(|c| covers(&c.ranges, a, b.min(c.verses.max(a)))),
            Some((ch, None)) => cov.get(&ch).is_some_and(|c| c.whole()),
            None => false,
        }
    };
    let days = plan["days"].as_array().cloned().unwrap_or_default();
    // new fields of tier 3, all optional: days_off (weekdays with no reading), dated (false for "my own pace"), skipped
    // (day numbers marked skipped, not read), stopped (the day it was stopped)
    let off = crate::plans::days_off_of(plan);
    let dated = plan["dated"] != false;
    let skipped: std::collections::HashSet<u64> = plan["skipped"].as_array().map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
    let kept: std::collections::HashSet<u64> = plan["kept"].as_array().map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
    let cycle = plan["cycle"] == true;
    let dates = if dated { crate::plans::plan_dates(start, &off, days.len()) } else { vec![] };
    let mut rows = vec![];
    let (mut done_days, mut settled_days) = (0, 0);
    for (k, d) in days.iter().enumerate() {
        let es: Vec<String> = d.as_array().unwrap_or(&vec![]).iter().filter_map(|e| e.as_str().map(String::from)).collect();
        let done: Vec<bool> = es.iter().map(|e| is_read(e)).collect();
        let parts: Vec<Value> = es.iter().map(|e| entry_parts(&cov, e)).collect();
        let all = done.iter().all(|x| *x);
        let skip = skipped.contains(&(k as u64 + 1)) && !all;
        done_days += all as usize;
        settled_days += (all || skip) as usize;
        let date = dates.get(k).map(|d| json!(d.format("%Y-%m-%d").to_string())).unwrap_or(json!(null));
        rows.push(json!({"day": k + 1, "date": date, "label": label(bible, &es), "entries": es, "read": done, "parts": parts, "done": all, "skipped": skip, "kept": kept.contains(&(k as u64 + 1))}));
    }
    let due = dates.iter().filter(|d| **d <= on).count(); // the days whose date has come
    let today_n = dates.iter().position(|d| *d == on).map(|i| i + 1); // which day of the plan it is (none on a day off)
    let settled = |r: &Value| r["done"] == true || r["skipped"] == true;
    let behind = rows.iter().take(due).filter(|r| !settled(r)).count();
    let next = rows.iter().find(|r| !settled(r)).cloned();
    Ok(json!({"id": id, "name": plan["name"], "kind": plan["kind"], "start": plan["start"], "days": days.len(), "done": done_days,
        "today": today_n, "due": due, "dated": dated, "days_off": off, "finish": if cycle { None } else { dates.last().map(|d| d.format("%Y-%m-%d").to_string()) },
        "cycle": cycle, "source": plan.get("source").cloned().unwrap_or(json!(null)),
        "skipped": rows.iter().filter(|r| r["skipped"] == true).count(), "stopped": plan.get("stopped").cloned().unwrap_or(json!(null)),
        "behind": behind, "ahead": settled_days.saturating_sub(due), "finished": !cycle && settled_days == days.len(),
        "next": next, "schedule": rows, "weekday": on.weekday().to_string()}))
}

/// What to read today in each plan: today's day, and any earlier day not yet done. A plan stopped is left out; a plan with
/// no dates ("my own pace") offers its next day.
pub fn today_view(bible: &Bible, root: &Path, on: NaiveDate) -> Result<Value> {
    let mut out = vec![];
    for p in plans(root).into_iter().filter(|p| p.get("stopped").is_none_or(|s| s.is_null())) {
        let pr = progress(bible, root, &p, on)?;
        let due = pr["due"].as_u64().unwrap_or(0);
        let rows = pr["schedule"].as_array().unwrap();
        let open: Vec<Value> = if pr["dated"] == false {
            pr["next"].as_object().map(|_| vec![pr["next"].clone()]).unwrap_or_default()
        } else {
            rows.iter().filter(|r| r["done"] == false && r["skipped"] == false && r["day"].as_u64().unwrap() <= due).cloned().collect()
        };
        let this_day = pr["today"].as_u64().and_then(|t| rows.get(t as usize - 1).cloned());
        out.push(json!({"plan": pr["name"], "id": pr["id"], "day": pr["today"], "of": pr["days"], "today": this_day, "dated": pr["dated"],
            "behind": pr["behind"], "ahead": pr["ahead"], "finished": pr["finished"], "to_read": open, "next": pr["next"]}));
    }
    Ok(json!({"date": on.format("%Y-%m-%d").to_string(), "plans": out}))
}

/// How much of the Bible the log shows read: chapters read at least once, by book and in all.
pub fn overall(bible: &Bible, root: &Path) -> Result<Value> {
    let lines = log(root);
    let cov = coverage_of(bible, &lines);
    let mut books = vec![];
    let (mut total, mut got) = (0u32, 0u32);
    for b in bible.books() {
        let n = (1..=b.chapters).filter(|c| cov.get(&format!("{}.{c}", b.code)).is_some_and(|x| x.times > 0)).count() as u32;
        total += b.chapters;
        got += n;
        if n > 0 {
            books.push(json!({"book": b.name, "read": n, "of": b.chapters}));
        }
    }
    // chapters read in part and not through: what is read of each
    let partial: Vec<Value> = cov.iter().filter(|(_, c)| c.times == 0).map(|(ch, c)| json!({"ch": ch, "read_to": read_to_of(&c.ranges), "parts": ranges_text(&c.ranges), "last": c.last})).collect();
    let last = lines.last().map(|l| json!({"t": l["t"], "ch": l["ch"]}));
    Ok(json!({"chapters": got, "of": total, "percent": (got as f64 * 1000.0 / total as f64).round() / 10.0, "books": books, "partial": partial, "last": last, "lines": lines.len()}))
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

    #[test]
    fn verse_ranges_merge_and_say_where_the_run_from_verse_one_stops() {
        let mut r: Ranges = vec![];
        add_range(&mut r, 20, 25);
        add_range(&mut r, 1, 5);
        assert_eq!(r, vec![(1, 5), (20, 25)]);
        assert_eq!((read_to_of(&r), ranges_text(&r)), (Some(5), "1-5, 20-25".to_string()));
        add_range(&mut r, 6, 19);
        assert_eq!(r, vec![(1, 25)]);
        assert!(covers(&r, 1, 25) && !covers(&r, 1, 26));
        let late: Ranges = vec![(20, 25)];
        assert_eq!(read_to_of(&late), None);
        assert_eq!(parse_ranges("1-5, 20-25"), Some(vec![(1, 5), (20, 25)]));
        assert_eq!(parse_ranges("7"), Some(vec![(7, 7)]));
        assert_eq!(parse_ranges("0-3"), None);
        assert_eq!(parse_ranges("x"), None);
    }

    #[test]
    fn a_log_line_with_a_plan_part_entry_is_that_chapters_verses() {
        let l = json!({"ch": "PSA.119:1-119:88"});
        assert_eq!(line_part(&l), Some(("PSA.119".to_string(), Some((1, 88)))));
        assert_eq!(line_part(&json!({"ch": "GEN.2"})), Some(("GEN.2".to_string(), None)));
        assert_eq!(line_part(&json!({"ch": "GEN.2", "v": "1-9"})), Some(("GEN.2".to_string(), Some((1, 9)))));
        assert_eq!(line_part(&json!({"ch": "GEN.1:5-2:3"})), None, "across chapters is no part of one");
    }
}
