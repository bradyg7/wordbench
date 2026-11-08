//! Pages and blocks (W3 of "The Notebook as a workspace"): pages inside pages, Pinned, and a page written block by block,
//! the same actions the Notebook's window takes. Blocks are counted from 1, as `wb page blocks` lists them.

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::Value;
use wb_core::pages::{self as pg, Edit, Place, Under};
use wb_core::{guide as gd, pageviews as pv, templates as tp};

fn e(x: wb_core::Error) -> String {
    x.0
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

fn text_of(c: &Ctx<'_>, words: &str) -> Result<String, String> {
    if words.trim() == "-" { c.stdin() } else { Ok(words.to_string()) }
}

/// A block's number as typed (from 1) → the core's (from 0).
fn nth(a: &crate::args::Args, name: &str) -> Result<usize, String> {
    let v = a.s(name);
    match v.trim().parse::<usize>() {
        Ok(n) if n >= 1 => Ok(n - 1),
        _ => Err(format!("A block is named by its number, from 1 (wb page blocks lists them), not “{v}”.")),
    }
}

/// An option holding a block's number (from 1), as typed.
fn opt_n(a: &crate::args::Args, name: &str) -> Result<Option<usize>, String> {
    match a.opt(name) {
        None => Ok(None),
        Some(v) => match v.trim().parse::<usize>() {
            Ok(n) if n >= 1 => Ok(Some(n)),
            _ => Err(format!("--{name} takes a block's number, from 1, not “{v}”.")),
        },
    }
}

/// How many blocks a page has.
fn count(c: &Ctx<'_>, id: &str) -> Result<usize, String> {
    Ok(pg::blocks(&*c.study()?, id).map_err(e)?["blocks"].as_array().map(|b| b.len()).unwrap_or(0))
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("page tree", "The Notebook's Pinned and Pages: the pinned pages in order, and every page with the pages inside it (children). A page is a note with no place, or any note put inside a page or holding one.",
            vec![], |c, _| j(pg::tree(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("page new", "A new page (a note with no place yet): wb page new \"Lesson: Phinehas\" [--parent ID: inside that page, last there] [--link: and a [[link]] to it in that page, after block --after N, or --first, else at its end]. Its first line is its title; - reads standard input.
                   From a template (W5): wb page new --template \"Chapter study\" --place \"Num 25\" [--title \"…\"] [--reader \"Ps 106\"] [--parent ID]: its blocks copied, {place} {date} {title} {reader} filled.",
            vec![Pos("text", N::Any), Opt("parent", None), Flag("link"), Opt("after", None), Flag("first"), Opt("template", None), Opt("place", None), Opt("title", None), Opt("reader", None)], |c, a| {
                if let Some(t) = a.opt("template") {
                    if a.flag("link") || !a.s("text").trim().is_empty() {
                        return Err("A page from a template takes its text from the template: give --title for its name (no text, no --link).".into());
                    }
                    let (place, title, reader, parent) = (a.opt("place"), a.opt("title"), a.opt("reader"), a.opt("parent"));
                    let m = tp::Make { place: place.as_deref(), title: title.as_deref(), reader: reader.as_deref(), parent: parent.as_deref() };
                    return j(tp::make_page(c.bible()?, &mut *c.study()?, &t, m).map_err(e)?);
                }
                if a.opt("place").is_some() || a.opt("title").is_some() || a.opt("reader").is_some() {
                    return Err("--place, --title and --reader go with --template.".into());
                }
                let text = text_of(c, &a.s("text"))?;
                if text.trim().is_empty() {
                    return Err("Give the page's text (its first line is its title), or --template.".into());
                }
                let after = match (opt_n(a, "after")?, a.flag("first")) {
                    (Some(n), _) => Some(Some(n - 1)),
                    (None, true) => Some(None),
                    (None, false) => None,
                };
                j(pg::new_page(c.bible()?, &mut *c.study()?, a.opt("parent").as_deref(), &text, a.flag("link"), after).map_err(e)?)
            }),
        cmd("page move", "Move a page: inside another (--parent ID), to the top (--top), or among the pages beside it; --after ID puts it after that page, --first first, else last. Only parent and order change in the files.",
            vec![Pos("id", N::One), Opt("parent", None), Flag("top"), Opt("after", None), Flag("first")], |c, a| {
                let parent = a.opt("parent");
                let under = match (&parent, a.flag("top")) {
                    (Some(_), true) => return Err("Give --parent or --top, not both.".into()),
                    (Some(p), false) => Under::In(p.as_str()),
                    (None, true) => Under::Top,
                    (None, false) => Under::Keep,
                };
                let after = a.opt("after");
                j(pg::move_page(c.bible()?, &mut *c.study()?, &a.s("id"), under, Place { after: after.as_deref(), first: a.flag("first") }).map_err(e)?)
            }),
        cmd("page pin", "Pin a page (last in Pinned), or move it there: --after ID, --first. Its place is kept in the page itself (pinned: 1, 2, 3 …).",
            vec![Pos("id", N::One), Opt("after", None), Flag("first")], |c, a| {
                let after = a.opt("after");
                j(pg::pin(c.bible()?, &mut *c.study()?, &a.s("id"), Place { after: after.as_deref(), first: a.flag("first") }).map_err(e)?)
            }),
        cmd("page unpin", "Take a page out of Pinned.", vec![Pos("id", N::One)], |c, a| j(pg::unpin(c.bible()?, &mut *c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page blocks", "A page's blocks, numbered from 1: each one's kind (paragraph, heading, item, numbered, todo, quote, divider, table, fence), its Markdown and where it is in the text; and its title. A day's page by its day (2026-11-07).",
            vec![Pos("id", N::One)], |c, a| j(pg::blocks(&*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page scripture", "A page's scripture blocks with their verses from the Bible: each block's number, reference, Paragraph or Lines (lines), version, and its verses verbatim with the highlights on them (as wb scripture). The file holds only the reference.",
            vec![Pos("id", N::One)], |c, a| j(pg::scripture(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("block scripture", "A scripture block's choices, kept in its fence after the reference: --lines (a verse to a line) or --paragraph; --ylt or --kjv. wb block scripture ID 3 --lines --ylt.",
            vec![Pos("id", N::One), Pos("n", N::One), Flag("lines"), Flag("paragraph"), Flag("ylt"), Flag("kjv")], |c, a| {
                let n = nth(a, "n")?;
                let pick = |on: &str, off: &str| match (a.flag(on), a.flag(off)) {
                    (true, true) => Err(format!("--{on} or --{off}, not both.")),
                    (true, false) => Ok(Some(true)),
                    (false, true) => Ok(Some(false)),
                    _ => Ok(None),
                };
                let (lines, ylt) = (pick("lines", "paragraph")?, pick("ylt", "kjv")?);
                if lines.is_none() && ylt.is_none() {
                    return Err("Say what to change: --lines or --paragraph, --ylt or --kjv.".into());
                }
                j(pg::set_scripture(c.bible()?, &mut *c.study()?, &a.s("id"), n, lines, ylt).map_err(e)?)
            }),
        cmd("page views", "A page's views (W5) with what each finds now: each block's number, its line, and its rows (as wb view run); a line that cannot be read, or holds a template's blank, says so.",
            vec![Pos("id", N::One)], |c, a| j(pv::page_views(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("block view", "Change a view's line: wb block view ID 3 \"notebook @Num 25 questions\". The line is read first; one that cannot be read is not written.",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("line", N::Many)], |c, a| {
                let n = nth(a, "n")?;
                j(pv::set_line(c.bible()?, &mut *c.study()?, &a.s("id"), n, &a.s("line")).map_err(e)?)
            }),
        cmd("view run", "What a view's line finds, as a view lists it (and the command field): wb view run \"notebook @Num 25 questions\". The line: notebook, then any of @place (a verse, chapter, book or H7065), questions | open | answered, thread <name>, days N, pages, and words. Views read; they never write.",
            vec![Pos("line", N::Many)], |c, a| j(pv::run(c.bible()?, &*c.study()?, &a.s("line")).map_err(e)?)),
        cmd("template list", "Your templates (notes with template: true): what each holds, whether it asks for a place, the name new pages get, where they go, and how often used.",
            vec![], |c, _| j(tp::list(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("template show", "A template whole: its text, blocks and settings; with --place (and --reader), what a page made from it now would be named and hold.",
            vec![Pos("name", N::Many), Opt("place", None), Opt("reader", None)], |c, a| {
                let (place, reader) = (a.opt("place"), a.opt("reader"));
                j(tp::show(c.bible()?, &*c.study()?, &a.s("name"), place.as_deref(), reader.as_deref()).map_err(e)?)
            }),
        cmd("template new", "A new template, empty but for its name: wb template new \"Word study\". Write its blocks as in any page (wb block add).",
            vec![Pos("name", N::Many)], |c, a| j(tp::new_template(c.bible()?, &mut *c.study()?, &a.s("name")).map_err(e)?)),
        cmd("template save", "Save a page as a template: a copy, with its places taken out (scripture blocks' references and views' @place become {place}): wb template save <page id> [--name \"Chapter study\"].",
            vec![Pos("id", N::One), Opt("name", None)], |c, a| {
                let name = a.opt("name");
                j(tp::save_as(c.bible()?, &mut *c.study()?, &a.s("id"), name.as_deref()).map_err(e)?)
            }),
        cmd("template set", "A template's settings: --names \"Chapter study: {place}\" (the name new pages get), --asks place|nothing, --goes-in ID|pages.",
            vec![Pos("name", N::Many), Opt("names", None), Opt("asks", None), Opt("goes_in", None)], |c, a| {
                let asks = match a.opt("asks").map(|x| x.trim().to_lowercase()) {
                    None => None,
                    Some(x) if x == "place" => Some(true),
                    Some(x) if x == "nothing" || x == "none" => Some(false),
                    Some(x) => return Err(format!("--asks place or --asks nothing, not “{x}”.")),
                };
                let (names, goes) = (a.opt("names"), a.opt("goes_in"));
                let goes = goes.as_deref().map(|g| if g.trim().eq_ignore_ascii_case("pages") { None } else { Some(g) });
                j(tp::set_template(c.bible()?, &mut *c.study()?, &a.s("name"), names.as_deref(), asks, goes).map_err(e)?)
            }),
        cmd("template rm", "Delete a template (it waits in .trash 7 days, as any page); the pages made from it stay as they are.",
            vec![Pos("name", N::Many)], |c, a| j(tp::remove_template(c.bible()?, &mut *c.study()?, &a.s("name")).map_err(e)?)),
        cmd("guide", "Help's Guide: how a part of the Notebook works (wb guide templates, wb guide views); with no topic, the entries. --json for an entry as data.",
            vec![Pos("topic", N::Any)], |_, a| {
                let t = a.s("topic");
                if t.trim().is_empty() {
                    if a.flag("json") {
                        return j(gd::guide());
                    }
                    let g = gd::guide();
                    let names: Vec<String> = g["entries"].as_array().into_iter().flatten().map(|x| format!("  {:<12} {}", x["name"].as_str().unwrap_or(""), x["title"].as_str().unwrap_or(""))).collect();
                    return Ok(Out::Text(format!("The Guide: wb guide <topic>\n{}", names.join("\n"))));
                }
                let en = gd::guide_entry(&t).ok_or_else(|| format!("No guide entry called “{}”. Try: wb guide", t.trim()))?;
                if a.flag("json") { j(en) } else { Ok(Out::Text(gd::guide_text(&en))) }
            }),
        cmd("page title","Change a page's title (its first line; a # it had stays): wb page title ID \"New title\". The links to its old title: wb note relink.",
            vec![Pos("id", N::One), Pos("title", N::Many)], |c, a| j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Title(&a.s("title"))).map_err(e)?)),
        cmd("block set", "Write a block anew: wb block set ID 3 \"- [ ] Print the verse deck\" (--count K: K blocks from it become this text; - reads standard input; a blank line in it makes two blocks).",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("text", N::Many), Opt("count", None)], |c, a| {
                let n = nth(a, "n")?;
                let count = opt_n(a, "count")?.unwrap_or(1);
                let text = text_of(c, &a.s("text"))?;
                if text.trim().is_empty() {
                    return Err("Give the block's new text (wb block rm removes it).".into());
                }
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Set { n, count, text: &text }).map_err(e)?)
            }),
        cmd("block add", "Add a block: wb block add ID \"# Before Tuesday\" --after 2 (--first: right under the title; neither: last). - reads standard input.",
            vec![Pos("id", N::One), Pos("text", N::Many), Opt("after", None), Flag("first")], |c, a| {
                let text = text_of(c, &a.s("text"))?;
                let after = match (opt_n(a, "after")?, a.flag("first")) {
                    (Some(n), _) => Some(n - 1),
                    (None, true) => None,
                    (None, false) => count(c, &a.s("id"))?.checked_sub(1),
                };
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Add { after, text: &text }).map_err(e)?)
            }),
        cmd("block rm", "Remove a block from a page (--count K: K blocks from it); the blocks around it meet.",
            vec![Pos("id", N::One), Pos("n", N::One), Opt("count", None)], |c, a| {
                let n = nth(a, "n")?;
                let count = opt_n(a, "count")?.unwrap_or(1);
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Set { n, count, text: "" }).map_err(e)?)
            }),
        cmd("block move", "Move a block: wb block move ID 5 --to 2 (it then comes before what is now block 2), or --last.",
            vec![Pos("id", N::One), Pos("n", N::One), Opt("to", None), Flag("last")], |c, a| {
                let n = nth(a, "n")?;
                let to = match (opt_n(a, "to")?, a.flag("last")) {
                    (Some(t), false) => t - 1,
                    (None, true) => count(c, &a.s("id"))?,
                    _ => return Err("Give --to N (it comes before block N) or --last.".into()),
                };
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Move { n, to }).map_err(e)?)
            }),
        cmd("block check", "Tick a to-do, or take its tick off (it turns over; --on or --off to say which).",
            vec![Pos("id", N::One), Pos("n", N::One), Flag("on"), Flag("off")], |c, a| {
                let n = nth(a, "n")?;
                let done = match (a.flag("on"), a.flag("off")) {
                    (true, true) => return Err("--on or --off, not both.".into()),
                    (true, false) => Some(true),
                    (false, true) => Some(false),
                    _ => None,
                };
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Check { n, done }).map_err(e)?)
            }),
    ]
}
