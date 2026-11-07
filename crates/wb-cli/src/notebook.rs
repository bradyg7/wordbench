//! The Notebook (wb-core's notebook module): notes written before they have a place (notes/_inbox/), the journal by day,
//! questions, and placing a note. And the capture box's language: what a line means (`wb parse`), the manual, and the
//! references in a piece of text.

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::{json, Value};
use wb_core::{commands as lang, findings as fd, notebook as nb};

fn e(x: wb_core::Error) -> String {
    x.0
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

/// A place as typed → an anchor: the forms `wb note add` takes, and a whole chapter or book ("Numbers 25", "Numbers").
fn anchor(c: &Ctx<'_>, text: &str) -> Result<String, String> {
    nb::place_anchor(c.bible()?, text).map_err(e)
}

fn day_of(a: &crate::args::Args) -> Option<String> {
    let d = a.s("day");
    (!d.is_empty()).then_some(d)
}

fn text_of(c: &Ctx<'_>, words: &str) -> Result<String, String> {
    if words.trim() == "-" { c.stdin() } else { Ok(words.to_string()) }
}

pub fn commands() -> Vec<Command> {
    let mut all = findings();
    all.extend(notebook_commands());
    all
}

/// The person's findings about the app while it is built (findings/<id>.md, kept apart from the study; note 50c1).
fn findings() -> Vec<Command> {
    vec![
        cmd("findings", "Your findings about the app, newest first: the open ones (--all: the handled ones too), with what was on screen when each was written.",
            vec![Flag("all")], |c, a| j(fd::list(&c.root()?, a.flag("all")).map_err(e)?)),
        cmd("finding add", "Write a finding: wb finding add \"Ctrl+F finds only in the reader\" [--context '{\"size\": \"large\"}']  |  - for standard input.",
            vec![Pos("text", N::Many), Opt("context", None)], |c, a| {
            let text = text_of(c, &a.s("text"))?;
            let context = match a.opt("context") {
                Some(t) => Some(serde_json::from_str::<Value>(&t).map_err(|_| "The context must be a JSON object.".to_string())?),
                None => None,
            };
            j(fd::add(&c.root()?, &text, context).map_err(e)?)
        }),
        cmd("finding handled", "Mark a finding handled (by its id, or the id's last four characters); --open: open again.",
            vec![Pos("id", N::One), Flag("open")], |c, a| j(fd::set_status(&c.root()?, &a.s("id"), !a.flag("open")).map_err(e)?)),
        cmd("finding edit", "Change a finding's words: wb finding edit 1b2d \"…\"  |  - for standard input.",
            vec![Pos("id", N::One), Pos("text", N::Many)], |c, a| {
            let text = text_of(c, &a.s("text"))?;
            j(fd::edit(&c.root()?, &a.s("id"), &text).map_err(e)?)
        }),
        cmd("finding rm", "Delete a finding (it goes to .trash).", vec![Pos("id", N::One)], |c, a| j(fd::remove(&c.root()?, &a.s("id")).map_err(e)?)),
    ]
}

fn notebook_commands() -> Vec<Command> {
    vec![
        cmd("notebook", "The Notebook's list, grouped: --group day (today's page first), chapter (--at \"Num 25\": that chapter, as following the reader), thread or none; or a section: --group pages (notes with no place yet) or questions; --search words; --questions; --pages; --inbox-apart.
                   With no --group, the group it opens with (wb settings notebook).",
            vec![Opt("group", None), Opt("search", None), Opt("at", None), Flag("questions"), Flag("pages"), Flag("inbox_apart"), Flag("no_days")], |c, a| {
                let st = c.study()?;
                let set = nb::settings(&st);
                let at = match a.opt("at") {
                    Some(t) => {
                        let sp = c.span(&t)?;
                        Some((sp.book.code.clone(), sp.c1))
                    }
                    None => None,
                };
                let o = nb::Listing {
                    group: a.opt("group").unwrap_or_else(|| set["group"].as_str().unwrap_or("day").to_string()),
                    search: a.opt("search").unwrap_or_default(),
                    at,
                    inbox_apart: a.flag("inbox_apart"),
                    questions: a.flag("questions"),
                    pages: a.flag("pages"),
                    days: !a.flag("no_days") && set["today"] != false,
                };
                j(nb::list(c.bible()?, &st, &o).map_err(e)?)
            }),
        cmd("note show", "Any note, question or day's page whole, by its id (or a day, 2026-11-04): its text, places, threads, [[links]], headings and Linked from.",
            vec![Pos("id", N::One)], |c, a| j(nb::show(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("note new", "Write a note: wb note new \"text\" --at \"Num 25:11\" (a verse, words, a run, a chapter: \"Numbers 25\", a book: \"Numbers\", or H7065); with no --at it waits in the Inbox. --question asks it. (- reads standard input)",
            vec![Pos("text", N::Many), Opt("at", None), Flag("question")], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                j(nb::new_note(c.bible()?, &mut *c.study()?, a.opt("at").as_deref(), &text, a.flag("question")).map_err(e)?)
            }),
        cmd("note links", "The [[links]] in a note: what each names and the note it opens (to: null when no note has that title).",
            vec![Pos("id", N::One)], |c, a| j(nb::links(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("note backlinks", "The notes that link to a note with [[its title]] (Linked from), newest first.",
            vec![Pos("id", N::One)], |c, a| j(nb::backlinks(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("note relink", "After a note's title changed: the [[links]] to its old title, in every other note, take the new one: wb note relink <id> \"old title\".",
            vec![Pos("id", N::One), Pos("old", N::Many)], |c, a| j(nb::relink(c.bible()?, &mut *c.study()?, &a.s("id"), &a.s("old")).map_err(e)?)),
        cmd("day", "A day's page (today's, or wb day 2026-11-03): one note per day, made the first time something is written in it (notes/_days/).",
            vec![Pos("day", N::Opt)], |c, a| j(nb::day_page(c.bible()?, &*c.study()?, day_of(a).as_deref()).map_err(e)?)),
        cmd("day add", "Add a paragraph to today's page (or --day 2026-11-03): wb day add \"Read Numbers 25 twice\" (- reads standard input).",
            vec![Pos("text", N::Many), Opt("day", None)], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                j(nb::write_day(c.bible()?, &mut *c.study()?, a.opt("day").as_deref(), &text, true).map_err(e)?)
            }),
        cmd("day text", "Replace the whole of today's page (or --day 2026-11-03) with the text given (- reads standard input); empty, the page goes to .trash.",
            vec![Pos("text", N::Any), Opt("day", None)], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                j(nb::write_day(c.bible()?, &mut *c.study()?, a.opt("day").as_deref(), &text, false).map_err(e)?)
            }),
        cmd("day rm", "Delete a day's page (today's, or wb day rm 2026-11-03); it waits in .trash 7 days.",
            vec![Pos("day", N::Opt)], |c, a| j(nb::delete_day(&mut *c.study()?, day_of(a).as_deref()).map_err(e)?)),
        cmd("settings", "The window's settings for a part (notebook): wb settings notebook; change one: wb settings notebook group chapter (default puts it back). --about says what each does.",
            vec![Pos("part", N::One), Pos("key", N::Opt), Pos("value", N::Any), Flag("about")], |c, a| {
                if a.s("part") != "notebook" {
                    return Err("The parts with settings so far: notebook.".into());
                }
                let mut st = c.study()?;
                if a.s("key").is_empty() {
                    return j(if a.flag("about") { nb::settings_about(&st) } else { nb::settings(&st) });
                }
                if a.s("value").is_empty() {
                    return Err(format!("Give a value: wb settings notebook {} on", a.s("key")));
                }
                j(nb::set_setting(&mut st, &a.s("key"), &a.s("value")).map_err(e)?)
            }),
        cmd("note jot", "Write a thought with no place yet, into the Notebook's Inbox: wb note jot \"check where else this is used\" [--question]. (text - reads standard input)",
            vec![Pos("text", N::Many), Flag("question")], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                j(nb::jot(c.bible()?, &mut *c.study()?, &text, a.flag("question")).map_err(e)?)
            }),
        cmd("note place", "Give an Inbox note its place: wb note place <id or part of it> \"Num 25:11\". With no place, the place its text names.",
            vec![Pos("note", N::One), Pos("place", N::Any)], |c, a| {
                let mut st = c.study()?;
                let id = nb::find_jot(&st, &a.s("note")).map_err(e)?;
                let place = if a.has("place") {
                    anchor(c, &a.s("place"))?
                } else {
                    let text = st.inbox().into_iter().find(|n| n["id"] == id.as_str()).map(|n| n["text"].as_str().unwrap_or("").to_string()).unwrap_or_default();
                    let named = nb::named_place(c.bible()?, &text).ok_or("The note names no place; give one: wb note place <id> \"Num 25:11\"")?;
                    named["anchor"].as_str().unwrap().to_string()
                };
                j(nb::place(c.bible()?, &mut st, &id, &place).map_err(e)?)
            }),
        cmd("note move", "Give a placed note or question another place: wb note move <id> \"Num 25:7-13\". (An Inbox note: wb note place.)",
            vec![Pos("id", N::One), Pos("place", N::Many)], |c, a| {
                let place = anchor(c, &a.s("place"))?;
                j(nb::move_to(c.bible()?, &mut *c.study()?, &a.s("id"), &place).map_err(e)?)
            }),
        cmd("note question", "Make a note a question, wherever it is (in the Inbox or at its place); --plain makes a question a plain note again.",
            vec![Pos("id", N::One), Flag("plain")], |c, a| {
                let mut st = c.study()?;
                let id = nb::find_jot(&st, &a.s("id")).unwrap_or_else(|_| a.s("id"));
                j(nb::set_question(c.bible()?, &mut st, &id, !a.flag("plain")).map_err(e)?)
            }),
        cmd("note answered", "Mark a question answered, in the Inbox or at its place; --open makes it open again.",
            vec![Pos("id", N::One), Flag("open")], |c, a| {
                let mut st = c.study()?;
                let id = nb::find_jot(&st, &a.s("id")).unwrap_or_else(|_| a.s("id"));
                j(nb::answer(c.bible()?, &mut st, &id, !a.flag("open")).map_err(e)?)
            }),
        cmd("note text", "Change the text of any note or question, wherever it is (at a place, on a thread, in the Inbox): wb note text <id> \"new text\" (- reads standard input).",
            vec![Pos("id", N::One), Pos("text", N::Many)], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                j(nb::edit_text(c.bible()?, &mut *c.study()?, &a.s("id"), &text).map_err(e)?)
            }),
        cmd("note also", "Put a placed note on one more place, as many as you like, near or far: wb note also <id> \"Ps 106:30\"; --remove takes that place off it.",
            vec![Pos("id", N::One), Pos("place", N::Many), Flag("remove")], |c, a| {
                let place = anchor(c, &a.s("place"))?;
                j(nb::also_at(c.bible()?, &mut *c.study()?, &a.s("id"), &place, !a.flag("remove")).map_err(e)?)
            }),
        cmd("note unplace", "Take a place off a placed note or question, its first place too: wb note unplace <id> \"Num 25:11\". The next of its places becomes its place; its last place taken off sends it to the Inbox.",
            vec![Pos("id", N::One), Pos("place", N::Many)], |c, a| {
                let place = anchor(c, &a.s("place"))?;
                j(nb::unplace(c.bible()?, &mut *c.study()?, &a.s("id"), &place).map_err(e)?)
            }),
        cmd("note thread","Put a note or question on a thread: wb note thread <id> Phinehas; --remove takes it off. (A note on no place that leaves its last thread goes to the Inbox.)",
            vec![Pos("id", N::One), Pos("thread", N::Many), Flag("remove")], |c, a| {
                let mut st = c.study()?;
                let t = crate::study::tid(&st, &a.s("thread"))?;
                j(nb::on_thread(c.bible()?, &mut st, &a.s("id"), &t, !a.flag("remove")).map_err(e)?)
            }),
        cmd("thread notes", "The notes on a thread, oldest first: those written on it and the notes and questions put on it.", vec![Pos("name", N::Many)], |c, a| {
            let st = c.study()?;
            let t = crate::study::tid(&st, &a.s("name"))?;
            j(nb::thread_notes(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("thread write", "Write a note on a thread, with no place in the text: wb thread write Phinehas \"text\" (- reads standard input).",
            vec![Pos("name", N::One), Pos("text", N::Many)], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                let mut st = c.study()?;
                let t = crate::study::tid(&st, &a.s("name"))?;
                j(nb::write_on_thread(c.bible()?, &mut st, &t, &text).map_err(e)?)
            }),
        cmd("trash", "The deleted notes and questions in .trash, newest first, with the days each has left before it is erased.", vec![], |c, _| {
            j(nb::trash(&*c.study()?))
        }),
        cmd("trash restore", "Put a deleted note or question back where it was: wb trash restore <its name from wb trash>.", vec![Pos("name", N::One)], |c, a| {
            j(json!(c.study()?.restore(&a.s("name")).map_err(e)?))
        }),
        cmd("trash erase", "Erase one deleted note or question now, without waiting the 7 days: wb trash erase <its name from wb trash>. It cannot be put back.",
            vec![Pos("name", N::One)], |c, a| {
                c.study()?.erase(&a.s("name")).map_err(e)?;
                j(json!({"erased": [a.s("name")]}))
            }),
        cmd("trash empty","Erase the notes and questions deleted at least --days ago (default 7; the window does this when it opens). Other files in .trash stay.",
            vec![Opt("days", Some("7"))], |c, a| {
                let days: i64 = a.opt_or("days", "7").parse().map_err(|_| "argument --days: invalid int value")?;
                j(json!({"erased": c.study()?.empty_trash(days.max(0)).map_err(e)?}))
            }),
        cmd("note all","Every placed note in Bible order, by book; with words, only the notes that have them all.", vec![Pos("words", N::Any)], |c, a| {
            j(nb::all_notes(c.bible()?, &*c.study()?, &a.s("words")).map_err(e)?)
        }),
        cmd("journal", "The Notebook's journal: every note and question by the day it was written, newest first (or one day: wb journal 2026-11-02).",
            vec![Pos("day", N::Opt)], |c, a| {
                let d = a.s("day");
                let day = if d.is_empty() { None } else { Some(chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").map_err(|_| "A day looks like 2026-11-02.")?) };
                j(nb::journal(c.bible()?, &*c.study()?, day).map_err(e)?)
            }),
        cmd("inbox", "The notes with no place yet, newest first, each with the place its text names (offer), if any.", vec![], |c, _| {
            j(nb::inbox(c.bible()?, &*c.study()?).map_err(e)?)
        }),
        cmd("inbox edit", "Change an Inbox note's text (id or part of it), or make it a question (--question) or a plain note (--plain).",
            vec![Pos("note", N::One), Pos("text", N::Any), Flag("question"), Flag("plain")], |c, a| {
                let mut st = c.study()?;
                let id = nb::find_jot(&st, &a.s("note")).map_err(e)?;
                let text = if a.has("text") { Some(text_of(c, &a.s("text"))?) } else { None };
                let q = if a.flag("question") { Some(true) } else if a.flag("plain") { Some(false) } else { None };
                if text.is_none() && q.is_none() {
                    return Err("Give the new text, or --question or --plain.".into());
                }
                j(json!(st.update_jot(&id, text.as_deref(), q).map_err(e)?))
            }),
        cmd("inbox rm", "Delete an Inbox note (moved to .trash in the study folder).", vec![Pos("note", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = nb::find_jot(&st, &a.s("note")).map_err(e)?;
            st.delete_jot(&id).map_err(e)?;
            j(json!({"ok": true, "id": id}))
        }),
        cmd("questions", "Your questions: those in the Inbox and those at a place (trails), newest first.", vec![Opt("status", Some("open"))], |c, a| {
            j(nb::questions(c.bible()?, &*c.study()?, &a.opt_or("status", "open")).map_err(e)?)
        }),
        cmd("parse", "What a line of the capture box means, as the window reads it: wb parse \"uses zeal gospels\" (an action, or the error).",
            vec![Pos("line", N::Any)], |c, a| {
                Ok(Out::Json(match lang::parse(&a.s("line"), c.bible()?.books()) {
                    Ok(act) => json!({"action": act}),
                    Err(m) => json!({"error": m}),
                }))
            }),
        cmd("manual", "The capture box's manual: every command, or one (wb manual uses), or a topic (scopes, places, refs, keys).",
            vec![Pos("topic", N::Any)], |_, a| {
                let t = a.s("topic");
                if t.is_empty() {
                    return j(lang::manual().clone());
                }
                let d = lang::find_doc(&t).ok_or_else(|| format!("No command or topic called “{t}”. Try: wb manual"))?;
                if a.flag("json") {
                    return j(d.clone());
                }
                let lines = |k: &str| d[k].as_array().map(|x| x.iter().filter_map(|l| l.as_str()).collect::<Vec<_>>().join("\n")).unwrap_or_default();
                let examples = d["examples"].as_array().map(|x| x.iter().map(|p| format!("  {}    {}", p[0].as_str().unwrap_or(""), p[1].as_str().unwrap_or(""))).collect::<Vec<_>>().join("\n")).unwrap_or_default();
                Ok(Out::Text(format!("{}\n\n{}\n\n{}\n\n{}", lines("usage"), d["what"].as_str().unwrap_or(""), lines("details"), examples).trim_end().to_string()))
            }),
        cmd("do", "Send a line to the capture box of the running app, as if typed there: wb do \"open John 3\"  |  wb do \"uses zeal gospels\". Prints what the window did.
                   Several lines: one per argument, or - for standard input. --wait N: seconds to wait for the window (default 10).",
            vec![Pos("line", N::Many), Opt("wait", Some("10")), Flag("each")], |c, a| {
                let lines: Vec<String> = if a.s("line").trim() == "-" {
                    c.stdin()?.lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect()
                } else if a.flag("each") {
                    a.list("line")
                } else {
                    vec![a.s("line")]
                };
                let wait: f64 = a.opt_or("wait", "10").parse().map_err(|_| "argument --wait: a number of seconds")?;
                let mut out = vec![];
                for l in lines {
                    let r = wb_core::relay::send(&l, std::time::Duration::from_secs_f64(wait.max(0.1))).map_err(e)?;
                    if r["ok"] == false {
                        return Err(format!("{l}: {}", r["error"].as_str().unwrap_or("the window refused it")));
                    }
                    out.push(r);
                }
                if out.len() == 1 && !a.flag("json") {
                    return Ok(Out::Text(out[0]["said"].as_str().unwrap_or("done").to_string()));
                }
                j(json!(out))
            }),
        cmd("refs", "The verse references in a piece of text, as the Notebook links them: wb refs \"see 1 Cor 10:8 and Num 25:9\".",
            vec![Pos("text", N::Many)], |c, a| j(json!(lang::find_refs(&a.s("text"), c.bible()?.books())))),
    ]
}
