//! Reading plans, phase 2b tier 3: the form (what to read, in what order, at what pace, with which days off), the
//! plan (days missed, a day moved, a plan stopped and used again). The files are the ones `reading` writes; every field
//! added here is optional and none is renamed, so an older plan file reads as it always did:
//!
//! ```text
//! days_off   ["sun", "sat"]    weekdays with no reading; the days after them move on
//! dated      false             "my own pace": days with no dates (absent = dated)
//! skipped    [3, 4]            day numbers marked skipped (not read, not behind)
//! stopped    "2026-11-06"      the day the plan was stopped: it leaves Today and the list, and waits in Past plans
//! pace, order, books, passages, reused_from    what the form held (information; the days are written out in full)
//! ```
//!
//! Nothing here reminds, nags or counts streaks. A change that moves dates says so before it is made (`missed_options`).

use crate::bible::Bible;
use crate::reading::{books_named, chapters, entry_words, parse_day, parse_plan_text, plan_path, plans, progress, read_plan, save_plan, slug, sparse, spread, today};
use crate::store::{bad, cut};
use crate::Result;
use chrono::{Datelike, NaiveDate};
use serde_json::{json, Value};

// ---- days off ----------------------------------------------------------------------------------------------------------

const WEEKDAYS: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/// "sun", "Sunday, sat" → ["sat", "sun"] (in the week's order). "none" or nothing is no day off; not all seven.
pub fn parse_days_off(s: &str) -> Result<Vec<String>> {
    let mut found = [false; 7];
    for t in s.split([',', ';', ' ']).map(|t| t.trim().to_lowercase()).filter(|t| !t.is_empty() && t != "none") {
        let k = WEEKDAYS.iter().position(|w| t.len() >= 3 && t.starts_with(w)).ok_or_else(|| bad(format!("A day off looks like sun or saturday, not “{}”.", cut(&t, 20))))?;
        found[k] = true;
    }
    if found.iter().all(|f| *f) {
        return Err(bad("Not every day can be a day off."));
    }
    Ok(WEEKDAYS.iter().zip(found).filter(|(_, f)| *f).map(|(w, _)| w.to_string()).collect())
}

/// The days off a plan file holds.
pub fn days_off_of(plan: &Value) -> Vec<String> {
    plan["days_off"].as_array().map(|a| a.iter().filter_map(|x| x.as_str()).filter(|x| WEEKDAYS.contains(x)).map(String::from).collect()).unwrap_or_default()
}

fn is_off(off: &[String], d: NaiveDate) -> bool {
    off.iter().any(|o| o == WEEKDAYS[d.weekday().num_days_from_monday() as usize])
}

/// The day itself, or the next day that is not a day off.
pub fn next_reading_day(mut d: NaiveDate, off: &[String]) -> NaiveDate {
    while is_off(off, d) {
        d = d.succ_opt().unwrap();
    }
    d
}

/// The dates of the first `n` days of a plan that starts on `start`.
pub fn plan_dates(start: NaiveDate, off: &[String], n: usize) -> Vec<NaiveDate> {
    let mut out = Vec::with_capacity(n);
    let mut d = next_reading_day(start, off);
    for _ in 0..n {
        out.push(d);
        d = next_reading_day(d.succ_opt().unwrap(), off);
    }
    out
}

/// How many reading days there are from `a` to `b`, both counted.
pub fn reading_days_between(a: NaiveDate, b: NaiveDate, off: &[String]) -> usize {
    let mut n = 0;
    let mut d = a;
    while d <= b {
        n += !is_off(off, d) as usize;
        d = d.succ_opt().unwrap();
    }
    n
}

/// The start that puts day number `index + 1` (index counted from 0) on `anchor`, or the first reading day after it.
pub fn start_for(index: usize, anchor: NaiveDate, off: &[String]) -> NaiveDate {
    let mut d = next_reading_day(anchor, off);
    for _ in 0..index {
        d = d.pred_opt().unwrap();
        while is_off(off, d) {
            d = d.pred_opt().unwrap();
        }
    }
    d
}

fn show_day(d: &str) -> String {
    parse_day(d).map(|d| d.format("%a %b %-d, %Y").to_string()).unwrap_or_else(|_| d.to_string())
}

// ---- the form ----------------------------------------------------------------------------------------------------------

/// How the chosen books are put in order.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Order {
    /// The Bible's own order.
    Bible,
    /// The books as listed.
    Listed,
    /// The Old Testament and the New side by side: some of each every day.
    SideBySide,
}

impl Order {
    pub fn parse(s: &str) -> Result<Order> {
        match s.trim().to_lowercase().replace([' ', '_'], "-").as_str() {
            "bible" | "" => Ok(Order::Bible),
            "listed" | "as-listed" => Ok(Order::Listed),
            "side-by-side" | "sidebyside" | "both" => Ok(Order::SideBySide),
            other => Err(bad(format!("No order “{other}”. Orders: bible, listed, side-by-side."))),
        }
    }
    pub(crate) fn name(&self) -> &'static str {
        match self {
            Order::Bible => "bible",
            Order::Listed => "listed",
            Order::SideBySide => "side-by-side",
        }
    }
}

/// How fast: no dates at all, a number of days, until a day, or so many chapters a day.
#[derive(Clone, Debug, PartialEq)]
pub enum Pace {
    Own,
    Days(u32),
    By(NaiveDate),
    Chapters(u32),
}

impl Pace {
    /// "own", "days:90", "by:2027-01-01", "chapters:3".
    pub fn parse(s: &str) -> Result<Pace> {
        const HINT: &str = "A pace looks like own, days:90, by:2027-01-01 or chapters:3.";
        let t = s.trim().to_lowercase();
        if t == "own" {
            return Ok(Pace::Own);
        }
        let (k, v) = t.split_once(':').ok_or_else(|| bad(HINT))?;
        let n = || v.trim().parse::<u32>().ok().filter(|n| *n > 0).ok_or_else(|| bad(HINT));
        match k.trim() {
            "days" => Ok(Pace::Days(n()?)),
            "chapters" | "per-day" => Ok(Pace::Chapters(n()?)),
            "by" => Ok(Pace::By(parse_day(v.trim())?)),
            _ => Err(bad(HINT)),
        }
    }
    pub fn text(&self) -> String {
        match self {
            Pace::Own => "own".into(),
            Pace::Days(n) => format!("days:{n}"),
            Pace::By(d) => format!("by:{}", d.format("%Y-%m-%d")),
            Pace::Chapters(n) => format!("chapters:{n}"),
        }
    }
}

/// What the form holds.
pub struct PlanSpec {
    /// A preset's id (`reading::KINDS`), or "custom".
    pub kind: String,
    /// The books, as typed or chosen: "gospels, rom", "MAT,MRK". A preset fills this when it is empty.
    pub books: Option<String>,
    /// Passages added after the books: "Ps 23; Isa 53".
    pub passages: Option<String>,
    /// None: the preset's own (Old and New side by side for that preset), else the Bible's order.
    pub order: Option<Order>,
    pub pace: Pace,
    pub days_off: Vec<String>,
}

/// A preset's books and order.
fn preset(kind: &str) -> Option<(&'static str, Order)> {
    match kind {
        "canonical" => Some(("all", Order::Bible)),
        "ot-nt" => Some(("all", Order::SideBySide)),
        "nt" => Some(("nt", Order::Bible)),
        "psalms-proverbs" => Some(("Psalms; Proverbs", Order::Bible)),
        _ => None,
    }
}

/// The books in the order they were listed, each name or group (gospels, rom, Gen-Deut) keeping the Bible's order inside it.
fn books_listed(bible: &Bible, named: &str) -> Result<Vec<u32>> {
    let mut out: Vec<u32> = vec![];
    for part in named.split([',', ';']).map(str::trim).filter(|p| !p.is_empty()) {
        for id in books_named(bible, part)? {
            if !out.contains(&id) {
                out.push(id);
            }
        }
    }
    Ok(out)
}

/// What a spec makes: the days, how many readings, and the fields to write into the plan file.
pub struct Built {
    pub days: Vec<Vec<String>>,
    pub readings: usize,
    pub extra: Value,
}

fn chunks(units: &[(String, u32)], per_day: usize) -> Vec<Vec<String>> {
    units.chunks(per_day.max(1)).map(|c| c.iter().map(|u| u.0.clone()).collect()).collect()
}

/// Cut a list into `n` days: balanced by words when there is at least a reading a day, else readings placed where their
/// words fall.
fn fit(units: &[(String, u32)], n: usize) -> Vec<Vec<String>> {
    if units.len() < n {
        sparse(units, n)
    } else {
        spread(units, n)
    }
}

/// The days a spec asks for, from the day it starts.
pub fn build(bible: &Bible, spec: &PlanSpec, start: NaiveDate) -> Result<Built> {
    let preset = preset(&spec.kind);
    let books = spec.books.as_deref().map(str::trim).filter(|b| !b.is_empty()).or(preset.map(|p| p.0));
    let passages = spec.passages.as_deref().map(str::trim).filter(|p| !p.is_empty());
    if books.is_none() && passages.is_none() {
        return Err(bad("Name what to read: books (like gospels, rom, ot or Gen-Deut) or a passage."));
    }
    let order = spec.order.or(preset.map(|p| p.1)).unwrap_or(Order::Bible);
    let ids = match books {
        None => vec![],
        Some(b) if order == Order::Listed => books_listed(bible, b)?,
        Some(b) => books_named(bible, b)?,
    };
    let mut units = chapters(bible, &ids)?;
    if let Some(p) = passages {
        for day in parse_plan_text(bible, &p.replace(';', "\n"))? {
            for e in day {
                let w = entry_words(bible, &e)?.max(1);
                units.push((e, w));
            }
        }
    }
    if units.is_empty() {
        return Err(bad("There is nothing to read in that."));
    }
    // Old Testament and New side by side, when both are there
    let (ot, nt): (Vec<_>, Vec<_>) = units.iter().cloned().partition(|u| u.0.split('.').next().and_then(|c| bible.book(c).ok()).is_some_and(|b| b.id < 40));
    let both = order == Order::SideBySide && !ot.is_empty() && !nt.is_empty();
    let longest = if both { ot.len().max(nt.len()) } else { units.len() };
    let n = match &spec.pace {
        Pace::Own => longest,
        Pace::Chapters(k) => units.len().div_ceil(*k as usize),
        Pace::Days(k) => *k as usize,
        Pace::By(d) => {
            let n = reading_days_between(start, *d, &spec.days_off);
            if n == 0 {
                return Err(bad("That day is before the plan can start (or every day up to it is a day off)."));
            }
            n
        }
    };
    if n == 0 || n > 3650 {
        return Err(bad("A plan is 1 to 3650 days."));
    }
    let days = if both {
        ot_nt(&ot, &nt, n)
    } else if matches!(spec.pace, Pace::Own | Pace::Chapters(_)) {
        let k = if let Pace::Chapters(k) = spec.pace { k as usize } else { 1 };
        chunks(&units, k)
    } else {
        if units.len() < n {
            return Err(bad(format!("That is {} chapters; a plan of {n} days needs at least one a day.", units.len())));
        }
        spread(&units, n)
    };
    let mut extra = json!({"order": order.name(), "pace": spec.pace.text()});
    if !spec.days_off.is_empty() {
        extra["days_off"] = json!(spec.days_off);
    }
    if spec.pace == Pace::Own {
        extra["dated"] = json!(false);
    }
    if let Some(b) = books {
        extra["books"] = json!(b);
    }
    if let Some(p) = passages {
        extra["passages"] = json!(p);
    }
    Ok(Built { readings: units.len(), days, extra })
}

fn ot_nt(ot: &[(String, u32)], nt: &[(String, u32)], n: usize) -> Vec<Vec<String>> {
    fit(ot, n).into_iter().zip(fit(nt, n)).map(|(mut a, b)| {
        a.extend(b);
        a
    }).collect()
}

/// What the person sees before a plan starts: the days, the readings, the first days and the last, and when it ends.
pub fn summary(bible: &Bible, name: &str, kind: &str, start: NaiveDate, built: &Built) -> Value {
    let dated = built.extra["dated"] != false;
    let off = days_off_of(&built.extra);
    let finish = dated.then(|| plan_dates(start, &off, built.days.len()).last().map(|d| d.format("%Y-%m-%d").to_string())).flatten();
    json!({"name": name, "kind": kind, "days": built.days.len(), "readings": built.readings, "start": start.format("%Y-%m-%d").to_string(), "finish": finish,
        "first": built.days.iter().take(7).map(|d| crate::reading::label(bible, d)).collect::<Vec<_>>(),
        "last": built.days.last().map(|d| crate::reading::label(bible, d)), "dated": dated, "days_off": off})
}

/// Start a plan from a spec (the window's form; `wb plan start`).
pub fn start_from_spec(bible: &Bible, root: &std::path::Path, name: &str, spec: &PlanSpec, start: Option<&str>) -> Result<Value> {
    let start_day = match start {
        Some(s) => parse_day(s)?,
        None => today(),
    };
    let built = build(bible, spec, start_day)?;
    crate::reading::start_plan_with(root, name, &spec.kind, start, built.days, built.extra)
}

// ---- days missed (P2) ----------------------------------------------------------------------------------------------------

/// What can be done about days that came and were not read.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Missed {
    /// Pick up where I left off: today reads the first day not read, and every day after moves with it.
    Shift,
    /// Fit what is left into the days left, to the plan's last day.
    Fit,
    /// Leave the missed days for later: they are read after the last day; the days from today on keep their dates.
    Later,
    /// Skip them: marked skipped, not read.
    Skip,
}

impl Missed {
    pub(crate) fn name(&self) -> &'static str {
        match self {
            Missed::Shift => "shift",
            Missed::Fit => "fit",
            Missed::Later => "later",
            Missed::Skip => "skip",
        }
    }
}

const ALL_MISSED: [Missed; 4] = [Missed::Shift, Missed::Fit, Missed::Later, Missed::Skip];

fn entries_of(d: &Value) -> Vec<String> {
    d.as_array().map(|a| a.iter().filter_map(|e| e.as_str().map(String::from)).collect()).unwrap_or_default()
}

/// The plan as it would be after a choice (nothing is written). `on` is today.
pub fn apply_missed(bible: &Bible, root: &std::path::Path, plan: &Value, choice: Missed, on: NaiveDate) -> Result<Value> {
    if plan["dated"] == false {
        return Err(bad("A plan with no dates has no days missed."));
    }
    let pr = progress(bible, root, plan, on)?;
    let rows = pr["schedule"].as_array().cloned().unwrap_or_default();
    let day = |r: &Value| r["date"].as_str().and_then(|d| parse_day(d).ok());
    let past = rows.iter().take_while(|r| day(r).is_some_and(|d| d < on)).count(); // the days before today
    let missed: Vec<usize> = (0..past).filter(|k| rows[*k]["done"] == false && rows[*k]["skipped"] == false).collect();
    if missed.is_empty() {
        return Err(bad("No day is missed: every day before today is read."));
    }
    let off = days_off_of(plan);
    let mut out = plan.clone();
    let days: Vec<Value> = plan["days"].as_array().cloned().unwrap_or_default();
    match choice {
        Missed::Skip => {
            let mut sk: Vec<u64> = plan["skipped"].as_array().map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
            sk.extend(missed.iter().map(|k| *k as u64 + 1));
            sk.sort();
            sk.dedup();
            out["skipped"] = json!(sk);
        }
        Missed::Shift => {
            out["start"] = json!(start_for(missed[0], on, &off).format("%Y-%m-%d").to_string());
        }
        Missed::Fit => {
            let first = missed[0];
            let last = rows.last().and_then(day).unwrap();
            let left = reading_days_between(on, last, &off);
            if left == 0 {
                return Err(bad("The plan's last day has passed; pick up where you left off instead."));
            }
            let rest: Vec<String> = days[first..].iter().flat_map(entries_of).collect();
            let weighed = rest.iter().map(|e| Ok((e.clone(), entry_words(bible, e)?.max(1)))).collect::<Result<Vec<_>>>()?;
            let n = left.min(weighed.len());
            let mut new: Vec<Value> = days[..first].to_vec();
            new.extend(spread(&weighed, n).into_iter().map(|d| json!(d)));
            out["days"] = json!(new);
            out["start"] = json!(start_for(first, on, &off).format("%Y-%m-%d").to_string());
            out["skipped"] = remap_skipped(plan, |old| (old <= first as u64).then_some(old));
        }
        Missed::Later => {
            let keep: Vec<Value> = (0..days.len()).filter(|k| !missed.contains(k)).map(|k| days[k].clone()).collect();
            let after: Vec<Value> = missed.iter().map(|k| days[*k].clone()).collect();
            let anchor_index = past - missed.len(); // the first day not before today, in the new order
            let anchor = match rows.get(past).and_then(day) {
                Some(d) => d,
                None => on, // every day is before today: the first day added lands today
            };
            out["days"] = json!(keep.into_iter().chain(after).collect::<Vec<_>>());
            out["start"] = json!(start_for(anchor_index, anchor, &off).format("%Y-%m-%d").to_string());
            // a skipped day keeps its number minus the missed days before it
            out["skipped"] = remap_skipped(plan, |old| Some(old - missed.iter().filter(|k| (**k as u64) + 1 < old).count() as u64));
        }
    }
    if out["skipped"].as_array().is_some_and(|a| a.is_empty()) {
        out.as_object_mut().unwrap().shift_remove("skipped");
    }
    Ok(out)
}

/// The skipped day numbers of a plan, each mapped to its new number (or dropped).
fn remap_skipped(plan: &Value, f: impl Fn(u64) -> Option<u64>) -> Value {
    let old: Vec<u64> = plan["skipped"].as_array().map(|a| a.iter().filter_map(|x| x.as_u64()).collect()).unwrap_or_default();
    json!(old.into_iter().filter_map(f).collect::<Vec<_>>())
}

/// The four choices, each with what it does to the dates, said before anything is done.
pub fn missed_options(bible: &Bible, root: &std::path::Path, id: &str, on: NaiveDate) -> Result<Value> {
    let plan = read_plan(root, id)?;
    let pr = progress(bible, root, &plan, on)?;
    let was = pr["finish"].as_str().unwrap_or("").to_string();
    let rows = pr["schedule"].as_array().cloned().unwrap_or_default();
    let past = rows.iter().take_while(|r| r["date"].as_str().is_some_and(|d| d < on.format("%Y-%m-%d").to_string().as_str())).count();
    let missed: Vec<&Value> = rows.iter().take(past).filter(|r| r["done"] == false && r["skipped"] == false).collect();
    let m = missed.len();
    let left = parse_day(&was).map(|w| reading_days_between(on, w, &days_off_of(&plan))).unwrap_or(0);
    let plural = |n: usize| if n == 1 { "day" } else { "days" };
    let mut options = vec![];
    for c in ALL_MISSED {
        let (text, finish, available) = match apply_missed(bible, root, &plan, c, on) {
            Ok(np) => {
                let np = progress(bible, root, &np, on)?;
                let finish = np["finish"].as_str().unwrap_or("").to_string();
                let first = np["next"]["label"].as_str().unwrap_or("").to_string();
                let t = match c {
                    Missed::Shift => format!("Today reads {first}, and every day after it moves later to follow. The plan ends {}, not {}.", show_day(&finish), show_day(&was)),
                    Missed::Fit => format!("What is left is read in the {left} {} left, a little more each day. Today reads {first}. The plan ends {}.", plural(left), show_day(&finish)),
                    Missed::Later => format!("The days from today keep their dates. The {m} missed {} are read after the last day. The plan ends {}, not {}.", plural(m), show_day(&finish), show_day(&was)),
                    Missed::Skip => format!("No date moves. The {m} missed {} are marked skipped, not read. The plan still ends {}.", plural(m), show_day(&finish)),
                };
                (t, finish, true)
            }
            Err(e) => (e.0, was.clone(), false),
        };
        options.push(json!({"choice": c.name(), "text": text, "finish": finish, "available": available}));
    }
    Ok(json!({"plan": plan["name"], "id": id, "missed": m, "days": missed.iter().map(|r| r["day"].clone()).collect::<Vec<_>>(),
        "labels": missed.iter().map(|r| r["label"].clone()).collect::<Vec<_>>(), "finish": was, "options": options}))
}

/// Do one of the choices. The plan as it was goes to .trash first.
pub fn change_missed(bible: &Bible, root: &std::path::Path, id: &str, choice: Missed, on: NaiveDate) -> Result<Value> {
    crate::store::guard(root)?;
    let plan = read_plan(root, id)?;
    let new = apply_missed(bible, root, &plan, choice, on)?;
    save_plan(root, id, &new, true)
}

// ---- moving a day --------------------------------------------------------------------------------------------------------

/// Move a day (its readings) to another place in the plan, both numbered from 1: the days between move over by one, and the
/// dates stay where they were, so the readings move with the day. What was read is by reading, so nothing is lost.
pub fn move_day(root: &std::path::Path, id: &str, from: usize, to: usize) -> Result<Value> {
    crate::store::guard(root)?;
    let mut plan = read_plan(root, id)?;
    let mut days: Vec<Value> = plan["days"].as_array().cloned().unwrap_or_default();
    let n = days.len();
    if from == 0 || from > n || to == 0 || to > n {
        return Err(bad(format!("The plan has {n} days; there is no day {}.", if from == 0 || from > n { from } else { to })));
    }
    let one = days.remove(from - 1);
    days.insert(to - 1, one);
    // a skipped mark goes with its day
    let renumber = |old: u64| -> u64 {
        let old = old as usize;
        (if old == from {
            to
        } else if from < to && old > from && old <= to {
            old - 1
        } else if to < from && old >= to && old < from {
            old + 1
        } else {
            old
        }) as u64
    };
    if let Some(sk) = plan["skipped"].as_array() {
        let mut new: Vec<u64> = sk.iter().filter_map(|x| x.as_u64()).map(renumber).collect();
        new.sort();
        plan["skipped"] = json!(new);
    }
    plan["days"] = json!(days);
    save_plan(root, id, &plan, true)
}

// ---- stopped, past, used again (note 2885) --------------------------------------------------------------------------------

/// The plans that are going: every plan not stopped.
pub fn active_plans(root: &std::path::Path) -> Vec<Value> {
    plans(root).into_iter().filter(|p| p.get("stopped").is_none_or(|s| s.is_null())).collect()
}

/// Stop a plan: it goes to Past plans. The file stays where it is with `stopped: <day>`, and what was read stays in the log.
pub fn stop_plan(root: &std::path::Path, id: &str) -> Result<Value> {
    crate::store::guard(root)?;
    let mut plan = read_plan(root, id)?;
    if plan.get("stopped").is_some_and(|s| !s.is_null()) {
        return Err(bad("That plan is already stopped."));
    }
    plan["stopped"] = json!(today().format("%Y-%m-%d").to_string());
    save_plan(root, id, &plan, false)
}

/// The plans stopped or finished, newest stopped first, each as `progress` says it without its schedule.
pub fn past_plans(bible: &Bible, root: &std::path::Path, on: NaiveDate) -> Result<Vec<Value>> {
    let mut out = vec![];
    for p in plans(root) {
        let mut pr = progress(bible, root, &p, on)?;
        if pr["stopped"].is_null() && pr["finished"] != true {
            continue;
        }
        pr.as_object_mut().unwrap().shift_remove("schedule");
        out.push(pr);
    }
    out.sort_by(|a, b| b["stopped"].as_str().unwrap_or("").cmp(a["stopped"].as_str().unwrap_or("")));
    Ok(out)
}

/// A new plan from one stopped or finished (or going): the same days and settings, nothing read, starting on a day chosen.
pub fn reuse_plan(root: &std::path::Path, id: &str, start: Option<&str>, name: Option<&str>) -> Result<Value> {
    crate::store::guard(root)?;
    let old = read_plan(root, id)?;
    let base = name.map(str::trim).filter(|n| !n.is_empty()).map(String::from).unwrap_or_else(|| format!("{} again", old["name"].as_str().unwrap_or("Plan")));
    let taken = |n: &str| plan_path(root, &slug(n)).exists();
    let mut new_name = base.clone();
    for k in 2.. {
        if !taken(&new_name) {
            break;
        }
        if name.is_some() {
            return Err(bad(format!("There is already a plan called “{new_name}”.")));
        }
        new_name = format!("{base} ({k})");
    }
    let mut extra = serde_json::Map::new();
    for k in ["days_off", "dated", "pace", "order", "books", "passages", "source"] {
        if let Some(v) = old.get(k) {
            extra.insert(k.into(), v.clone());
        }
    }
    extra.insert("reused_from".into(), json!(id));
    let days: Vec<Vec<String>> = old["days"].as_array().map(|a| a.iter().map(entries_of).collect()).unwrap_or_default();
    crate::reading::start_plan_with(root, &new_name, old["kind"].as_str().unwrap_or("custom"), start, days, Value::Object(extra))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn days_off_skip_their_weekdays() {
        let off = parse_days_off("Sunday, sat").unwrap();
        assert_eq!(off, ["sat", "sun"]);
        // 2026-11-06 is a Friday: Fri, then Mon, Tue
        assert_eq!(plan_dates(d("2026-11-06"), &off, 3), [d("2026-11-06"), d("2026-11-09"), d("2026-11-10")]);
        // starting on a Saturday: the first reading day is the Monday
        assert_eq!(plan_dates(d("2026-11-07"), &off, 1), [d("2026-11-09")]);
        assert_eq!(reading_days_between(d("2026-11-06"), d("2026-11-10"), &off), 3);
        // the start that puts day 3 (index 2) on Tuesday the 10th is the Friday; none off is plain days
        assert_eq!(start_for(2, d("2026-11-10"), &off), d("2026-11-06"));
        assert_eq!(start_for(2, d("2026-11-10"), &[]), d("2026-11-08"));
        assert!(parse_days_off("mon tue wed thu fri sat sun").is_err());
        assert!(parse_days_off("funday").is_err());
        assert!(parse_days_off("none").unwrap().is_empty());
    }

    #[test]
    fn paces_and_orders_read_back() {
        for p in ["own", "days:90", "by:2027-01-01", "chapters:3"] {
            assert_eq!(Pace::parse(p).unwrap().text(), p);
        }
        assert!(Pace::parse("days:0").is_err());
        assert!(Pace::parse("fast").is_err());
        assert_eq!(Order::parse("side by side").unwrap(), Order::SideBySide);
        assert!(Order::parse("backwards").is_err());
    }
}
