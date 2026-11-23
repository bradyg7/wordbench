//! Reading progress and reading plans (new in the Rust app; see wb-core's reading module for the files and the rules).

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Out, Res};
use serde_json::{json, Value};
use wb_core::plans as pl;
use wb_core::reading as rd;

fn e(x: wb_core::Error) -> String {
    x.0
}

fn day(a: &crate::args::Args) -> Result<chrono::NaiveDate, String> {
    match a.opt("on") {
        Some(d) => chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d")
            .map_err(|_| "A day looks like 2026-11-03.".to_string()),
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

/// What the form holds, from the options `plan start` and `plan layout` share.
fn spec_of(a: &crate::args::Args) -> Result<(pl::PlanSpec, String), String> {
    let named = a.opt("books").is_some() || a.opt("passages").is_some();
    let kind = a
        .opt("kind")
        .unwrap_or_else(|| (if named { "custom" } else { "canonical" }).to_string());
    let usual = rd::KINDS
        .iter()
        .find(|k| k.0 == kind)
        .map(|k| k.2)
        .unwrap_or(30);
    if a.opt("pace").is_some() && a.opt("days").is_some() {
        return Err("Give --pace or --days, not both.".into());
    }
    let pace = match (a.opt("pace"), a.opt("days")) {
        (Some(p), _) => pl::Pace::parse(&p).map_err(e)?,
        (None, Some(d)) => pl::Pace::Days(
            d.parse()
                .map_err(|_| format!("argument --days: invalid int value: '{d}'"))?,
        ),
        (None, None) => pl::Pace::Days(usual),
    };
    if !rd::KINDS.iter().any(|k| k.0 == kind) && kind != "custom" {
        return Err(format!(
            "No plan kind “{kind}”. Kinds: {}.",
            rd::KINDS.iter().map(|k| k.0).collect::<Vec<_>>().join(", ")
        ));
    }
    let spec = pl::PlanSpec {
        kind: kind.clone(),
        books: a.opt("books"),
        passages: a.opt("passages"),
        order: a
            .opt("order")
            .map(|o| pl::Order::parse(&o))
            .transpose()
            .map_err(e)?,
        pace,
        days_off: pl::parse_days_off(&a.opt("days_off").unwrap_or_default()).map_err(e)?,
    };
    Ok((spec, kind))
}

fn start_day(a: &crate::args::Args) -> Result<chrono::NaiveDate, String> {
    match a.opt("start") {
        Some(s) => chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d")
            .map_err(|_| "A day looks like 2026-11-03.".to_string()),
        None => Ok(rd::today()),
    }
}

/// `plan start --kind horner`: Horner's ten lists, a chapter of each a day, no end (RP-9). --days-off and --start apply; the
/// lists are the plan's own and are not typed.
fn horner(c: &crate::Ctx<'_>, a: &crate::args::Args) -> Res {
    let b = c.bible()?;
    let mut imp = wb_core::published::horner_kind(b).map_err(e)?;
    if let Some(off) = a.opt("days_off") {
        let off = pl::parse_days_off(&off).map_err(e)?;
        if !off.is_empty() {
            imp.extra["days_off"] = json!(off);
        }
    }
    let start = start_day(a)?;
    if a.flag("dry_run") {
        return j(wb_core::published::summarize(b, &a.s("name"), start, &imp));
    }
    let p = rd::start_plan_with(
        &c.root()?,
        &a.s("name"),
        imp.kind,
        a.opt("start").as_deref(),
        imp.days,
        imp.extra,
    )
    .map_err(e)?;
    j(summary(
        &rd::progress(b, &c.root()?, &p, rd::today()).map_err(e)?,
    ))
}

/// The builder's view of Horner's lists: each list's books and its first chapters, side by side as columns.
fn horner_layout(c: &crate::Ctx<'_>, a: &crate::args::Args) -> Res {
    let b = c.bible()?;
    let imp = wb_core::published::horner_kind(b).map_err(e)?;
    let mut v =
        wb_core::published::summarize(b, &a.opt("name").unwrap_or_default(), start_day(a)?, &imp);
    let lists: Vec<Value> = imp.extra["lists"].as_array().unwrap().iter().zip(wb_core::published::HORNER_LISTS).map(|(l, name)| {
        let chs: Vec<&str> = l.as_array().unwrap().iter().filter_map(|x| x.as_str()).collect();
        json!({"books": name, "chapters": chs.len(), "first": chs.iter().take(7).map(|e| rd::label(b, std::slice::from_ref(&e.to_string()))).collect::<Vec<_>>()})
    }).collect();
    v["lists"] = json!(lists);
    v["rows"] = json!(imp.days.iter().take(7).enumerate().map(|(k, d)| json!({"day": k + 1, "label": rd::label(b, d), "chips": d.iter().map(|e| json!({"entry": e, "label": rd::label(b, std::slice::from_ref(e))})).collect::<Vec<_>>(), "kept": false})).collect::<Vec<_>>());
    v["kept"] = json!([]);
    j(v)
}

/// An arrangement from a file, or from the input with `-`: {"days": [["MAT.1", "MAT.2"], …], "kept": [2]}.
fn arranged(c: &crate::Ctx<'_>, from: &str) -> Result<pl::Arranged, String> {
    let text = if from == "-" {
        c.stdin()?
    } else {
        std::fs::read_to_string(from).map_err(|x| format!("{from}: {x}"))?
    };
    let v: Value =
        serde_json::from_str(&text).map_err(|x| format!("The arrangement is not JSON: {x}"))?;
    pl::Arranged::from_json(c.bible()?, &v).map_err(e)
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("plan kinds", "The built-in reading plans: the Bible's own order, spread over a number of days. (A chronological or other plan is imported: wb plan import.)",
            vec![], |_, _| j(json!(rd::KINDS.iter().map(|(k, what, days)| json!({"kind": k, "reads": what, "days": days})).collect::<Vec<_>>()))),
        cmd("plan start", "Start a reading plan: wb plan start \"Bible in a year\" --kind canonical [--days 365] [--start 2026-11-03]  |  --books gospels,rom --days 30.\n\
                           What to read: --kind (a preset: canonical, ot-nt, nt, psalms-proverbs, horner: Horner's ten lists, a chapter of each a day, no end) or --books (gospels, rom, MAT,MRK, Gen-Deut) and --passages \"Ps 23; Isa 53\".\n\
                           --order bible (default) | listed (the books as you list them) | side-by-side (Old and New together).\n\
                           --pace own (no dates) | days:90 | by:2027-01-01 | chapters:3  (--days 90 is days:90).  --days-off sun,sat.\n\
                           Each day is whole chapters, about the same number of words. --dry-run shows the plan without starting it.\n\
                           --arranged FILE or - : the days exactly as a file gives them ({\"days\": [[\"MAT.1\",\"MAT.2\"], …], \"kept\": [2]}), as the builder makes them.",
            vec![Pos("name", N::One), Opt("kind", None), Opt("days", None), Opt("books", None), Opt("passages", None), Opt("order", None), Opt("pace", None),
                 Opt("days_off", None), Opt("start", None), Opt("arranged", None), Flag("dry_run")], |c, a| {
                let b = c.bible()?;
                if a.opt("kind").as_deref() == Some("horner") {
                    return horner(c, a);
                }
                let (spec, kind) = spec_of(a)?;
                let by_hand = a.opt("arranged").map(|f| arranged(c, &f)).transpose()?;
                if a.flag("dry_run") {
                    let start = start_day(a)?;
                    let built = match &by_hand {
                        Some(x) => pl::exact(b, &spec, x),
                        None => pl::build(b, &spec, start),
                    }.map_err(e)?;
                    return j(pl::summary(b, &a.s("name"), &kind, start, &built));
                }
                let p = pl::start_from_spec(b, &c.root()?, &a.s("name"), &spec, a.opt("start").as_deref(), by_hand.as_ref()).map_err(e)?;
                j(summary(&rd::progress(b, &c.root()?, &p, rd::today()).map_err(e)?))
            }),
        cmd("plan layout", "The days a plan would have, each chapter on its own, for arranging them: the options of plan start, and --arranged FILE or - for days you set by hand (their \"kept\" day numbers stay as they are; every other chapter is laid out again by the pace). Nothing is started.",
            vec![Opt("kind", None), Opt("days", None), Opt("books", None), Opt("passages", None), Opt("order", None), Opt("pace", None),
                 Opt("days_off", None), Opt("start", None), Opt("arranged", None), Opt("name", None)], |c, a| {
                if a.opt("kind").as_deref() == Some("horner") {
                    return horner_layout(c, a);
                }
                let (spec, kind) = spec_of(a)?;
                let b = c.bible()?;
                let held = a.opt("arranged").map(|f| arranged(c, &f)).transpose()?;
                let start = start_day(a)?;
                let built = pl::lay_out(b, &spec, start, held.as_ref()).map_err(e)?;
                j(pl::layout(b, &a.opt("name").unwrap_or_default(), &kind, start, &built))
            }),
        cmd("plan arrange", "Give a plan these days (what the builder saves): wb plan arrange \"Name\" --arranged FILE or - ({\"days\": [[\"MAT.1\"], …], \"kept\": [2]}). The plan as it was goes to .trash; what you read stays in the log.",
            vec![Pos("name", N::Many), Opt("arranged", None)], |c, a| {
                let (r, b) = (c.root()?, c.bible()?);
                let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
                let from = a.opt("arranged").ok_or("Say the days: --arranged FILE or - ({\"days\": [[\"MAT.1\"], …], \"kept\": [2]}).")?;
                let p = pl::arrange_plan(&r, p["id"].as_str().unwrap(), &arranged(c, &from)?).map_err(e)?;
                j(summary(&rd::progress(b, &r, &p, rd::today()).map_err(e)?))
            }),
        cmd("plan entries", "Places as the entries a day holds, each with its label: wb plan entries \"Psalm 23; Isa 53:1-12\".", vec![Pos("places", N::Many)], |c, a| {
            j(json!(pl::entries_of_text(c.bible()?, &a.s("places")).map_err(e)?))
        }),
        cmd("plan import", "Start a plan from a text file, or from input: one day to a line, places joined by ';' (Job 1-5; Ps 1). # starts a comment.\n\
                            --format auto (the default: found from the text) | plain | guthrie (Week N / Day N, six days a week) | blue-letter (places joined by /, its short names) | horner (ten lists of books: List 1: Matthew, Mark, Luke, John).\n\
                            --source \"Tyndale One Year Chronological\" names where the list came from. --days-off sun,sat (Guthrie's plan has Sunday off unless you say). --dry-run says what it found. No published plan comes with the app: you give the copy you have.",
            vec![Pos("name", N::One), Opt("file", None), Opt("start", None), Opt("format", None), Opt("source", None), Opt("days_off", None), Flag("dry_run")], |c, a| {
                let text = match a.opt("file") {
                    Some(f) => std::fs::read_to_string(&f).map_err(|x| format!("{f}: {x}"))?,
                    None => c.stdin()?,
                };
                let b = c.bible()?;
                let format = wb_core::published::Format::parse(&a.opt("format").unwrap_or_default()).map_err(e)?;
                let mut imp = wb_core::published::import(b, &text, format, a.opt("source").as_deref()).map_err(e)?;
                if let Some(off) = a.opt("days_off") {
                    let off = pl::parse_days_off(&off).map_err(e)?;
                    if off.is_empty() {
                        imp.extra.as_object_mut().unwrap().shift_remove("days_off");
                    } else {
                        imp.extra["days_off"] = json!(off);
                    }
                }
                let start = start_day(a)?;
                if a.flag("dry_run") {
                    return j(wb_core::published::summarize(b, &a.s("name"), start, &imp));
                }
                let p = rd::start_plan_with(&c.root()?, &a.s("name"), imp.kind, a.opt("start").as_deref(), imp.days, imp.extra).map_err(e)?;
                j(summary(&rd::progress(b, &c.root()?, &p, rd::today()).map_err(e)?))
            }),
        cmd("plan list", "Your reading plans and how far along each is.", vec![Opt("on", None)], |c, a| {
            let (b, r, on) = (c.bible()?, c.root()?, day(a)?);
            j(json!(pl::active_plans(&r).iter().map(|p| rd::progress(b, &r, p, on).map(|x| summary(&x))).collect::<Result<Vec<_>, _>>().map_err(e)?))
        }),
        cmd("plan show", "One plan, every day with what it reads and whether it is done.", vec![Pos("name", N::Many), Opt("on", None)], |c, a| {
            let r = c.root()?;
            j(rd::progress(c.bible()?, &r, &rd::find_plan(&r, &a.s("name")).map_err(e)?, day(a)?).map_err(e)?)
        }),
        cmd("plan today", "What to read today in each plan (or one), with any earlier day not yet done.", vec![Pos("name", N::Any), Opt("on", None)], |c, a| {
            let (r, b) = (c.root()?, c.bible()?);
            let mut v = rd::today_view(b, &r, day(a)?).map_err(e)?;
            if a.has("name") {
                let id = rd::find_plan(&r, &a.s("name")).map_err(e)?["id"].clone();
                v["plans"].as_array_mut().unwrap().retain(|p| p["id"] == id);
            }
            j(v)
        }),
        cmd("plan done", "Mark a day of a plan read: the first day not yet done, or --day N.", vec![Pos("name", N::Many), Opt("day", None)], |c, a| {
            let r = c.root()?;
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
        cmd("plan text", "A plan's days as text, one day to a line (the form plan import and plan edit --text read).", vec![Pos("name", N::Many)], |c, a| {
            let r = c.root()?;
            Ok(Out::Text(rd::plan_text(c.bible()?, &rd::find_plan(&r, &a.s("name")).map_err(e)?).map_err(e)?.trim_end().to_string()))
        }),
        cmd("plan edit", "Change a plan: --rename \"New name\", --start 2026-11-10, --catch-up (today is the first day not done), --days 60 (what is not done, spread
                          again over 60 days from today), --text FILE or - (every day replaced, one day to a line). The plan as it was goes to .trash.",
            vec![Pos("name", N::Many), Opt("rename", None), Opt("start", None), Flag("catch_up"), Opt("days", None), Opt("text", None)], |c, a| {
                let r = c.root()?;
                let b = c.bible()?;
                let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
                let days = match a.opt("text") {
                    Some(f) => {
                        let text = if f == "-" { c.stdin()? } else { std::fs::read_to_string(&f).map_err(|x| format!("{f}: {x}"))? };
                        Some(rd::parse_plan_text(b, &text).map_err(e)?)
                    }
                    None => None,
                };
                let spread = match a.opt("days") {
                    Some(d) => Some(d.parse::<u32>().map_err(|_| format!("argument --days: invalid int value: '{d}'"))?),
                    None => None,
                };
                let ch = rd::PlanChange { name: a.opt("rename"), days, start: a.opt("start"), spread, catch_up: a.flag("catch_up") };
                if ch.name.is_none() && ch.days.is_none() && ch.start.is_none() && ch.spread.is_none() && !ch.catch_up {
                    return Err("Say what to change: --rename, --start, --catch-up, --days or --text.".into());
                }
                let p = rd::edit_plan(b, &r, p["id"].as_str().unwrap(), ch).map_err(e)?;
                j(summary(&rd::progress(b, &r, &p, rd::today()).map_err(e)?))
            }),
        cmd("plan rm", "Delete a plan (its file goes to .trash; what you read stays in the log). To keep it to use again, plan stop it instead.", vec![Pos("name", N::Many)], |c, a| {
            let r = c.root()?;
            let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            rd::remove_plan(&r, p["id"].as_str().unwrap()).map_err(e)?;
            j(json!({"ok": true, "id": p["id"]}))
        }),
        cmd("plan stop", "Stop a plan: it leaves Today and the list and waits in Past plans (wb plan past); what you read stays in the log.", vec![Pos("name", N::Many)], |c, a| {
            let r = c.root()?;
            let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            let p = pl::stop_plan(&r, p["id"].as_str().unwrap()).map_err(e)?;
            j(json!({"ok": true, "id": p["id"], "stopped": p["stopped"]}))
        }),
        cmd("plan past", "Past plans: plans stopped or finished, with how far each got.", vec![Opt("on", None)], |c, a| {
            j(json!(pl::past_plans(c.bible()?, &c.root()?, day(a)?).map_err(e)?))
        }),
        cmd("plan reuse", "A new plan from a past one: the same days and settings, nothing read. wb plan reuse \"Name\" [--start 2026-12-01] [--as \"New name\"].",
            vec![Pos("name", N::Many), Opt("start", None), Opt("as", None)], |c, a| {
            let (r, b) = (c.root()?, c.bible()?);
            let old = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            let p = pl::reuse_plan(&r, old["id"].as_str().unwrap(), a.opt("start").as_deref(), a.opt("as").as_deref()).map_err(e)?;
            j(summary(&rd::progress(b, &r, &p, rd::today()).map_err(e)?))
        }),
        cmd("plan missed", "Days that came and were not read. With no choice, says what each choice would do to the dates. --shift (pick up where you left off), --fit (fit what is left into the days left), --later (read them after the last day), --skip (mark them skipped). The plan as it was goes to .trash.",
            vec![Pos("name", N::Many), Flag("shift"), Flag("fit"), Flag("later"), Flag("skip"), Opt("on", None)], |c, a| {
            let (r, b) = (c.root()?, c.bible()?);
            let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            let id = p["id"].as_str().unwrap();
            let chosen: Vec<pl::Missed> = [("shift", pl::Missed::Shift), ("fit", pl::Missed::Fit), ("later", pl::Missed::Later), ("skip", pl::Missed::Skip)]
                .into_iter().filter(|(f, _)| a.flag(f)).map(|x| x.1).collect();
            match chosen.as_slice() {
                [] => j(pl::missed_options(b, &r, id, day(a)?).map_err(e)?),
                [one] => {
                    let p = pl::change_missed(b, &r, id, *one, day(a)?).map_err(e)?;
                    j(summary(&rd::progress(b, &r, &p, day(a)?).map_err(e)?))
                }
                _ => Err("Choose one: --shift, --fit, --later or --skip.".into()),
            }
        }),
        cmd("plan move-day", "Move a day's readings to another day of the plan: wb plan move-day \"Name\" --day 3 --to 5. The dates stay; the days between move over.",
            vec![Pos("name", N::Many), Opt("day", None), Opt("to", None)], |c, a| {
            let (r, b) = (c.root()?, c.bible()?);
            let p = rd::find_plan(&r, &a.s("name")).map_err(e)?;
            let n = |k: &str| -> Result<usize, String> {
                let v = a.opt(k).ok_or(format!("Say --day and --to: wb plan move-day \"{}\" --day 3 --to 5.", p["name"].as_str().unwrap_or("")))?;
                v.parse().map_err(|_| format!("argument --{k}: invalid int value: '{v}'"))
            };
            let p = pl::move_day(&r, p["id"].as_str().unwrap(), n("day")?, n("to")?).map_err(e)?;
            j(summary(&rd::progress(b, &r, &p, rd::today()).map_err(e)?))
        }),
        cmd("read mark", "Record that you read chapters, or verses: wb read mark \"Num 25\"  |  \"Num 24-26\"  |  \"Gen 2:1-9\" (one log line with the verses) [--plan \"Bible in a year\"] [--to-here] (--to-here: Gen 2:9 marks what is not yet read from the start of the chapter to verse 9).",
            vec![Pos("place", N::Many), Opt("plan", None), Flag("to_here")], |c, a| {
            let (r, b) = (c.root()?, c.bible()?);
            let plan = match a.opt("plan") {
                Some(n) => rd::find_plan(&r, &n).map_err(e)?["id"].as_str().unwrap().to_string(),
                None => String::new(),
            };
            if a.flag("to_here") {
                return j(json!(rd::read_to_here(b, &r, &a.s("place"), &plan).map_err(e)?));
            }
            j(json!(rd::mark_place(b, &r, &a.s("place"), &plan).map_err(e)?))
        }),
        cmd("read when", "When you last read chapters: wb read when \"Num 25\"  |  \"Num 24-26\" → {\"NUM.25\": time, ...}; a chapter never read is left out.",
            vec![Pos("place", N::Many)], |c, a| {
            let chs = rd::chapters_of(c.bible()?, &a.s("place")).map_err(e)?;
            j(rd::last_read(c.bible()?, &c.root()?, &chs))
        }),
        cmd("read times", "How many times chapters were read, when last, and which verses: wb read times \"Num 25\" → {\"NUM.25\": {\"times\": 2, \"last\": time, \"verses\": \"1-9\", \"read_to\": 9, \"whole\": false}}. A time counts when the chapter is read through; a chapter never read is left out.",
            vec![Pos("place", N::Many)], |c, a| {
            let chs = rd::chapters_of(c.bible()?, &a.s("place")).map_err(e)?;
            j(rd::read_times(c.bible()?, &c.root()?, &chs))
        }),
        cmd("read unmark", "Mark unread: the latest mark of the place comes off the log (kept in .trash/reading-unmarked.jsonl): wb read unmark \"Num 25\"  |  \"Gen 2:1-9\" (the part line of exactly those verses).",
            vec![Pos("place", N::Many)], |c, a| {
            j(rd::unmark(c.bible()?, &c.root()?, &a.s("place")).map_err(e)?)
        }),
        cmd("read map", "The whole Bible as a map: each book's chapters read (chapter, times, how much of it, 0 to 1) and the chapters written about (chapter, how many references: pages, places in pages, questions, highlights, folders).",
            vec![], |c, _| {
            let (b, r) = (c.bible()?, c.root()?);
            let st = c.study()?;
            j(wb_core::readmap::map(b, &r, &st).map_err(e)?)
        }),
        cmd("read about", "What refers to a chapter in your own work: wb read about \"Num 25\" (pages, places in pages, questions, highlights, folders).",
            vec![Pos("place", N::Many)], |c, a| {
            let b = c.bible()?;
            let chs = rd::chapters_of(b, &a.s("place")).map_err(e)?;
            let st = c.study()?;
            let mut out = vec![];
            for ch in chs {
                for mut x in wb_core::readmap::about(b, &st, &ch) {
                    x["chapter"] = json!(ch);
                    out.push(x);
                }
            }
            j(json!(out))
        }),
        cmd("read progress", "How much of the Bible you have read: chapters read at least once, by book, and the chapters read in part (with how far).", vec![], |c, _| {
            j(rd::overall(c.bible()?, &c.root()?).map_err(e)?)
        }),
        cmd("read log", "The reading log, newest last (--last N lines).", vec![Opt("last", Some("50"))], |c, a| {
            let n: usize = a.opt_or("last", "50").parse().map_err(|_| "argument --last: invalid int value")?;
            let lines = rd::log(&c.root()?);
            j(json!(lines[lines.len().saturating_sub(n)..]))
        }),
    ]
}
