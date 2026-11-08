//! Pages and blocks (W3 of "The Notebook as a workspace"): pages inside pages, Pinned, and a page written block by block,
//! the same actions the Notebook's window takes. Blocks are counted from 1, as `wb page blocks` lists them.

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::Value;
use wb_core::pages::{self as pg, Edit, Place, Under};

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
        cmd("page new", "A new page (a note with no place yet): wb page new \"Lesson: Phinehas\" [--parent ID: inside that page, last there] [--link: and a [[link]] to it in that page, after block --after N, or --first, else at its end]. Its first line is its title; - reads standard input.",
            vec![Pos("text", N::Many), Opt("parent", None), Flag("link"), Opt("after", None), Flag("first")], |c, a| {
                let text = text_of(c, &a.s("text"))?;
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
        cmd("page title", "Change a page's title (its first line; a # it had stays): wb page title ID \"New title\". The links to its old title: wb note relink.",
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
