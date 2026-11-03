//! Reading progress and reading plans (new in the Rust app; see wb-core's reading module for the files and the rules).

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Out, Res};
use serde_json::{json, Value};
use wb_core::reading as rd;

fn e(x: wb_core::Error) -> String {
    x.0
}

fn root() -> Result<std::path::PathBuf, String> {
    let r = wb_core::default_study_dir();
    wb_core::store::guard(&r).map_err(e)?;
    Ok(r)
}

fn day(a: &crate::args::Args) -> Result<chrono::NaiveDate, String> {
    match a.opt("on") {
        Some(d) => chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").map_err(|_| "A day looks like 2026-11-03.".to_string()),
        None => Ok(rd::today()),
    }
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

/// A plan's progress without the whole schedule (plan show prints that).
fn summary(p: &Value) -> Value {
    let mut p = p.clone();
    p.as_object_mut().unwrap().shift_remove("schedule");
    p
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("plan kinds", "The built-in reading plans: the Bible's own order, spread over a number of days. (A chronological or other plan is imported: wb plan import.)",
            vec![], |_, _| j(json!(rd::KINDS.iter().map(|(k, what, days)| json!({"kind": k, "reads": what, "days": days})).collect::<Vec<_>>()))),
        cmd("plan start", "Start a reading plan: wb plan start \"Bible in a year\" --kind canonical [--days 365] [--start 2026-11-03]  |  --kind books --books gospels --days 30.\n\
                           Each day is whole chapters, about the same number of words. --dry-run shows the days without starting it.",
            vec![Pos("name", N::One), Opt("kind", Some("canonical")), Opt("days", None), Opt("books", None), Opt("start", None), Flag("dry_run")], |c, a| {
                let kind = a.opt_or("kind", "canonical");
                let usual = rd::KINDS.iter().find(|k| k.0 == kind).map(|k| k.2).unwrap_or(365);
                let days: u32 = match a.opt("days") {
                    Some(d) => d.parse().map_err(|_| format!("argument --days: invalid int value: '{d}'"))?,
                    None => usual,
                };
                let b = c.bible()?;
                let sched = rd::schedule(b, &kind, days, a.opt("books").as_deref()).map_err(e)?;
                if a.flag("dry_run") {
                    return j(json!({"name": a.s("name"), "kind": kind, "days": sched.len(), "first": sched.iter().take(7).map(|d| rd::label(b, d)).collect::<Vec<_>>(),
                        "last": rd::label(b, sched.last().unwrap())}));
                }
                let p = rd::start_plan(&root()?, &a.s("name"), &kind, a.opt("start").as_deref(), sched).map_err(e)?;
                j(summary(&rd::progress(b, &root()?, &p, rd::today()).map_err(e)?))
            }),
        cmd("plan import", "Start a plan you chose (a chronological one, say) from a text file: one day to a line, places joined by ';' (Job 1-5; Ps 1). # starts a comment.",
            vec![Pos("name", N::One), Opt("file", None), Opt("start", None)], |c, a| {
                let text = match a.opt("file") {
                    Some(f) => std::fs::read_to_string(&f).map_err(|x| format!("{f}: {x}"))?,
                    None => {
                        use std::io::Read;
                        let mut s = String::new();
                        std::io::stdin().read_to_string(&mut s).map_err(|x| x.to_string())?;
                        s
                    }
                };
                let b = c.bible()?;
                let days = rd::parse_plan_text(b, &text).map_err(e)?;
                let p = rd::start_plan(&root()?, &a.s("name"), "imported", a.opt("start").as_deref(), days).map_err(e)?;
                j(summary(&rd::progress(b, &root()?, &p, rd::today()).map_err(e)?))
            }),
        cmd("plan list", "Your reading plans and how far along each is.", vec![Opt("on", None)], |c, a| {
            let (b, r, on) = (c.bible()?, root()?, day(a)?);
            j(json!(rd::plans(&r).iter().map(|p| rd::progress(b, &r, p, on).map(|x| summary(&x))).collect::<Result<Vec<_>, _>>().map_err(e)?))
        }),
        cmd("plan show", "One plan, every day with what it reads and whether it is done.", vec![Pos("name", N::Many), Opt("on", None)], |c, a| {
            let r = root()?;
            j(rd::progress(c.bible()?, &r, &rd::find_plan(&r, &a.s("name")).map_err(e)?, day(a)?).map_err(e)?)
        }),
        cmd("plan today", "What to read today in each plan (or one), with any earlier day not yet done.", vec![Pos("name", N::Any), Opt("on", None)], |c, a| {
            let (r, b) = (root()?, c.bible()?);
            let mut v = rd::today_view(b, &r, day(a)?).map_err(e)?;
            if a.has("name") {
                let id = rd::find_plan(&r, &a.s("name")).map_err(e)?["id"].clone();
                v["plans"].as_array_mut().unwrap().retain(|p| p["id"] == id);
            }
            j(v)
        }),
        cmd("plan done", "Mark a day of a plan read: the first day not yet done, or --day N.", vec![Pos("name", N::Many), Opt("day", None)], |c, a| {
            let r = root()?;
            let b = c.bible()?;
            let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            let pr = rd::progress(b, &r, &p, rd::today()).map_err(e)?;
            let row = match a.opt("day") {
                Some(n) => {
                    let n: usize = n.parse().map_err(|_| format!("argument --day: invalid int value: '{n}'"))?;
                    pr["schedule"].as_array().unwrap().get(n.wrapping_sub(1)).cloned().ok_or(format!("The plan has {} days; there is no day {n}.", pr["days"]))?
                }
                None => pr["next"].clone(),
            };
            if row.is_null() {
                return Err("Every day of this plan is done.".into());
            }
            let es: Vec<String> = row["entries"].as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect();
            rd::mark(&r, &es, p["id"].as_str().unwrap()).map_err(e)?;
            let after = rd::progress(b, &r, &p, rd::today()).map_err(e)?;
            j(json!({"plan": p["name"], "day": row["day"], "read": row["label"], "done": after["done"], "of": after["days"], "next": after["next"]["label"]}))
        }),
        cmd("plan rm", "Stop a plan (its file goes to .trash; what you read stays in the log).", vec![Pos("name", N::Many)], |_, a| {
            let r = root()?;
            let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            rd::remove_plan(&r, p["id"].as_str().unwrap()).map_err(e)?;
            j(json!({"ok": true, "id": p["id"]}))
        }),
        cmd("read mark", "Record that you read chapters: wb read mark \"Num 25\"  |  \"Num 24-26\" [--plan \"Bible in a year\"].", vec![Pos("place", N::Many), Opt("plan", None)], |c, a| {
            let r = root()?;
            let chs = rd::chapters_of(c.bible()?, &a.s("place")).map_err(e)?;
            let plan = match a.opt("plan") {
                Some(n) => rd::find_plan(&r, &n).map_err(e)?["id"].as_str().unwrap().to_string(),
                None => String::new(),
            };
            j(json!(rd::mark(&r, &chs, &plan).map_err(e)?))
        }),
        cmd("read progress", "How much of the Bible you have read: chapters read at least once, by book.", vec![], |c, _| {
            j(rd::overall(c.bible()?, &root()?).map_err(e)?)
        }),
        cmd("read log", "The reading log, newest last (--last N lines).", vec![Opt("last", Some("50"))], |_, a| {
            let n: usize = a.opt_or("last", "50").parse().map_err(|_| "argument --last: invalid int value")?;
            let lines = rd::log(&root()?);
            j(json!(lines[lines.len().saturating_sub(n)..]))
        }),
    ]
}

