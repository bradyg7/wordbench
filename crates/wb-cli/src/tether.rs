//! `wb tether`: find the scripture in a long page, only what the person's own words already hold (design/features/tether).
//! Reads only, but `accept`, which adds scripture blocks to the page (one Undo token).

use crate::args::{Flag, Opt, Pos, Spec, N};
use crate::{cmd, Command, Ctx, Out};
use serde_json::{json, Value};
use wb_core::tether::{accept as ac, anchor, skips, Report};

fn e(x: wb_core::Error) -> String {
    x.0
}

fn options(a: &crate::args::Args, page: &str) -> Result<anchor::Options, String> {
    let tier = a.opt_or("tier", "all");
    if !["named", "quoted", "all"].contains(&tier.as_str()) {
        return Err("--tier is named, quoted or all.".into());
    }
    let min_words = match a.opt("min_words") {
        None => 6,
        Some(v) => v
            .parse::<usize>()
            .ok()
            .filter(|n| *n >= 2)
            .ok_or("--min-words takes a number, 2 or more.")?,
    };
    Ok(anchor::Options {
        tier,
        min_words,
        version: a.opt_or("version", "kjv").to_uppercase(),
        skipped: skips::list(page),
    })
}

fn run_page(c: &Ctx<'_>, a: &crate::args::Args) -> Result<Report, String> {
    let id = anchor::resolve(&*c.study()?, &a.s("page")).map_err(e)?;
    let opt = options(a, &id)?;
    anchor::run(c.bible()?, &*c.study()?, &id, &opt).map_err(e)
}

fn line(c: &wb_core::tether::Candidate) -> String {
    let also = if c.also.is_empty() {
        String::new()
    } else {
        format!("  also in {}", c.also.len())
    };
    let ev = match (c.evidence.matched, c.evidence.of) {
        (Some(m), Some(o)) => format!("{m} of {o} words, in order"),
        _ => format!(
            "you {} it",
            if c.evidence.kind == "spoken" {
                "said"
            } else {
                "wrote"
            }
        ),
    };
    format!(
        "{}  {:<6} {:<22} block {} [{}-{}]  “{}”  ({ev}){also}  {}",
        c.id, c.tier, c.reference, c.block, c.range.start, c.range.end, c.words, c.status
    )
}

fn text(r: &Report) -> String {
    let s = &r.summary;
    let mut out = vec![format!(
        "{} words in {} blocks: {} named, {} quoted ({} new, {} in the page, {} skipped); {} phrases in many verses",
        s.words, s.blocks, s.named, s.quoted, s.new, s.in_page, s.skipped, s.many.len()
    )];
    out.extend(r.candidates.iter().map(line));
    out.join("\n")
}

fn undo_file(page: &str) -> std::path::PathBuf {
    wb_core::setup::app_dir()
        .join("tether-undo")
        .join(format!("{page}.json"))
}

/// The ids of the page's candidates that exist (so skip never keeps an id that can mean nothing).
fn known(c: &Ctx<'_>, a: &crate::args::Args, id: &str) -> Result<Vec<String>, String> {
    let want = ids(a);
    let opt = anchor::Options {
        skipped: vec![],
        ..options(a, id)?
    };
    let r = anchor::run(c.bible()?, &*c.study()?, id, &opt).map_err(e)?;
    if let Some(bad) = want
        .iter()
        .find(|w| !r.candidates.iter().any(|x| &x.id == *w))
    {
        return Err(format!(
            "No candidate {bad} on this page (wb tether lists them)."
        ));
    }
    Ok(want)
}

fn ids(a: &crate::args::Args) -> Vec<String> {
    a.list("ids")
        .iter()
        .flat_map(|s| s.split([',', ' ']))
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

fn with_common(mut v: Vec<Spec>) -> Vec<Spec> {
    v.extend(common());
    v
}

fn common() -> Vec<Spec> {
    vec![
        Opt("tier", None),
        Opt("min_words", None),
        Opt("version", None),
    ]
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("tether", "Find the scripture in a page: references the person wrote or said (named) and words that are, in order, a verse's words (quoted). Nothing by meaning, nothing chosen: where several verses fit, all are listed. wb tether \"Word dump\" [--tier named|quoted|all] [--min-words N] [--version kjv|ylt] [--json]. Reads only; the page is not changed until wb tether accept.",
            with_common(vec![Pos("page", N::One)]), |c, a| {
                let r = run_page(c, a)?;
                if a.flag("json") { Ok(Out::Json(serde_json::to_value(&r).unwrap_or(Value::Null))) } else { Ok(Out::Text(text(&r))) }
            }),
        cmd("tether accept", "Add the scripture to the page as a scripture block after the sentence the words are in (the paragraph is split there; none of your characters change). wb tether accept PAGE ID… [--all-named] [--dry-run] [--expect HASH (the run's page_hash)]. The undo token is kept in a file in the app's folder (undo_file in the result; a long page makes a long token, so it is not asked for on the command line): wb tether accept PAGE --undo last (the file just kept), --undo @FILE, or --undo - (the token on standard input). Accepting one of several verses a phrase fits marks the others skipped; the undo puts back only those.",
            with_common(vec![Pos("page", N::One), Pos("ids", N::Any), Flag("all_named"), Flag("dry_run"), Opt("expect", None), Opt("undo", None)]), |c, a| {
                let id = anchor::resolve(&*c.study()?, &a.s("page")).map_err(e)?;
                if let Some(t) = a.opt("undo") {
                    let t = if t.trim() == "-" {
                        c.stdin()?
                    } else if t.trim() == "last" {
                        std::fs::read_to_string(undo_file(&id)).map_err(|_| "No undo token was kept for this page.")?
                    } else if let Some(f) = t.trim().strip_prefix('@') {
                        std::fs::read_to_string(f).map_err(|x| format!("Cannot read {f}: {x}"))?
                    } else {
                        t
                    };
                    let token: ac::Token = serde_json::from_str(&t).map_err(|_| "Give the undo token wb tether accept kept (--undo last, @FILE or -).")?;
                    if token.page != id {
                        return Err("That undo token is for another page.".into());
                    }
                    let v = ac::undo(c.bible()?, &mut *c.study()?, &token).map_err(e)?;
                    if !token.skipped.is_empty() {
                        skips::remove(&id, &token.skipped).map_err(e)?;
                    }
                    return Ok(Out::Json(v));
                }
                let opt = options(a, &id)?;
                let already = skips::list(&id);
                let done = ac::accept(c.bible()?, &mut *c.study()?, &id, &ac::Pick { ids: &ids(a), all_named: a.flag("all_named"), expect: a.opt("expect").as_deref(), dry: a.flag("dry_run") }, &opt).map_err(e)?;
                let mut v = done.json;
                if a.flag("dry_run") {
                    return Ok(Out::Json(v));
                }
                // the token first, from what was written; only then the skips, so a failure there loses nothing
                let fresh: Vec<String> = done.also.iter().filter(|i| !already.contains(i)).cloned().collect();
                let mut token = done.token.clone();
                token.skipped = fresh.clone();
                let json = serde_json::to_string(&token).unwrap_or_default();
                let file = undo_file(&id);
                let kept = file.parent().is_some_and(|d| std::fs::create_dir_all(d).is_ok()) && std::fs::write(&file, &json).is_ok();
                v["undo"] = serde_json::to_value(&token).unwrap_or(Value::Null);
                if json.len() > 2000 {
                    v["undo"] = Value::Null;
                }
                v["undo_file"] = if kept { json!(file.display().to_string()) } else { Value::Null };
                if !kept {
                    v["undo"] = serde_json::to_value(&token).unwrap_or(Value::Null);
                    v["warning"] = json!("The undo token could not be kept in a file; it is in undo (pass it with --undo -).");
                }
                if !done.also.is_empty() {
                    v["skipped"] = json!(fresh);
                    if let Err(x) = skips::add(&id, &done.also) {
                        v["warning"] = json!(format!("The page was written, but the other verses could not be marked skipped: {}", x.0));
                    }
                }
                Ok(Out::Json(v))
            }),
        cmd("tether skip", "Set candidates aside so a later run does not show them again: wb tether skip PAGE ID… The skips are kept in the app's own folder, not in the study (deleting it brings them back).",
            vec![Pos("page", N::One), Pos("ids", N::Many)], |c, a| {
                let id = anchor::resolve(&*c.study()?, &a.s("page")).map_err(e)?;
                let want = known(c, a, &id)?;
                skips::add(&id, &want).map_err(e)?;
                Ok(Out::Json(json!({"page": id, "skipped": skips::list(&id)})))
            }),
        cmd("tether unskip", "Show skipped candidates again: wb tether unskip PAGE ID…",
            vec![Pos("page", N::One), Pos("ids", N::Many)], |c, a| {
                let id = anchor::resolve(&*c.study()?, &a.s("page")).map_err(e)?;
                skips::remove(&id, &ids(a)).map_err(e)?;
                Ok(Out::Json(json!({"page": id, "skipped": skips::list(&id)})))
            }),
        cmd("tether skipped", "The candidates the person set aside on this page: wb tether skipped PAGE",
            with_common(vec![Pos("page", N::One)]), |c, a| {
                let mut r = run_page(c, a)?;
                r.candidates.retain(|x| x.status == "skipped");
                if a.flag("json") { Ok(Out::Json(serde_json::to_value(&r.candidates).unwrap_or(Value::Null))) } else { Ok(Out::Text(r.candidates.iter().map(line).collect::<Vec<_>>().join("\n"))) }
            }),
        cmd("tether verses", "The page's scripture blocks in page order, each with its verse text from the Bible and the first words of the sentence it follows, for a lesson script: wb tether verses PAGE [--text|--json] (--text pipes to wb lesson save NAME --append).",
            vec![Pos("page", N::One), Flag("text")], |c, a| {
                let id = anchor::resolve(&*c.study()?, &a.s("page")).map_err(e)?;
                let v = ac::verses(c.bible()?, &*c.study()?, &id).map_err(e)?;
                if a.flag("text") && !a.flag("json") {
                    let lines: Vec<String> = v.iter().map(|x| format!("{} ({}): {}\n  after: {}", x["reference"].as_str().unwrap_or(""), x["version"].as_str().unwrap_or(""), x["text"].as_str().unwrap_or(""), x["follows"].as_str().unwrap_or(""))).collect();
                    return Ok(Out::Text(lines.join("\n\n")));
                }
                Ok(Out::Json(json!(v)))
            }),
    ]
}
