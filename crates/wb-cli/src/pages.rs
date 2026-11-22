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
        cmd("page rm", "Delete a page, or several (wb page rm <id> <id> ...: one operation, one Undo), with timed Undo. --all previews the ordinary Pages tree; --yes commits. Pinned, templates, days and threads are excluded by default. --now explicitly bypasses Undo.",
            vec![Pos("id", N::Any), Flag("all"), Flag("yes"), Flag("now"), Flag("include_pinned"), Flag("include_templates"), Flag("include_days"), Opt("expect", None)], |c,a| {
                use wb_core::deletion as del;
                let ids=a.list("id");
                if a.flag("all") == !ids.is_empty() { return Err("Give a page ID or --all.".into()); }
                if !a.flag("all") && (a.flag("include_pinned") || a.flag("include_templates") || a.flag("include_days")) { return Err("Inclusion options require --all.".into()); }
                let mut st=c.study()?;
                let selection=del::Selection { ids,all:a.flag("all"),pinned:a.flag("include_pinned"),templates:a.flag("include_templates"),days:a.flag("include_days") };
                let plan=del::plan(c.bible()?,&mut st,&selection).map_err(e)?;
                if a.flag("all") && !a.flag("yes") { return j(plan.preview()); }
                j(del::commit(&mut st,plan,a.opt("expect").as_deref(),del::now_ms,a.flag("now")).map_err(e)?)
            }),
        cmd("page undo", "Restore a whole page deletion before its recorded deadline; interrupted operations remain recoverable. Later edits are never overwritten.",
            vec![Pos("operation",N::One)],|c,a| j(wb_core::deletion::undo(&mut *c.study()?,&a.s("operation"),wb_core::deletion::now_ms()).map_err(e)?)),
        cmd("page deletions", "Inspect pending page deletions, their deadlines and exact Undo commands.",vec![],|c,_| j(wb_core::deletion::inspect(&*c.study()?).map_err(e)?)),
        cmd("page sweep", "Recover interrupted page deletions, then expire only committed operations past their original deadlines. Legacy Trash is unchanged.",vec![],|c,_| j(wb_core::deletion::sweep(&mut *c.study()?,wb_core::deletion::now_ms()).map_err(e)?)),
        cmd("page tree", "The Notebook's Pinned and Pages: the pinned pages in order, and every page with the pages inside it (children). A page is a note with no place, or any note put inside a page or holding one.",
            vec![], |c, _| j(pg::tree(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("page recents", "Recents, the side list's first group (notebook row 35): the last pages opened (default 8), newest first, each once, read from the trail (steps of kind page, line \"page <id>\": wb history add page \"Title\" --line \"page <id>\"); a page that is gone is left out.",
            vec![Opt("limit", Some("8"))], |c, a| {
                let n = a.opt("limit").unwrap_or_default().parse::<usize>().map_err(|_| "--limit takes a number".to_string())?;
                j(pg::recents(c.bible()?, &*c.study()?, &c.root()?, n).map_err(e)?)
            }),
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
        cmd("page move", "Move one or several pages: inside another (--parent ID), to the top (--top), or among the pages beside it; --after ID puts it after that page, --first first, else last. Several ids keep their order. Only parent and order change in the files.",
            vec![Pos("id", N::Many), Opt("parent", None), Flag("top"), Opt("after", None), Flag("first")], |c, a| {
                let parent = a.opt("parent");
                let under = || match (&parent, a.flag("top")) {
                    (Some(_), true) => Err("Give --parent or --top, not both.".to_string()),
                    (Some(p), false) => Ok(Under::In(p.as_str())),
                    (None, true) => Ok(Under::Top),
                    (None, false) => Ok(Under::Keep),
                };
                let ids = a.list("id");
                let (mut prev, mut out) = (a.opt("after"), vec![]);
                for (i, id) in ids.iter().enumerate() {
                    let first = a.flag("first") && i == 0;
                    out.push(pg::move_page(c.bible()?, &mut *c.study()?, id, under()?, Place { after: prev.as_deref(), first }).map_err(e)?);
                    prev = Some(id.clone());
                }
                if out.len() == 1 { j(out.remove(0)) } else { j(Value::Array(out)) }
            }),
        cmd("page pin", "Pin one or several pages (last in Pinned), or move them there: --after ID, --first. A place is kept in the page itself (pinned: 1, 2, 3 …).",
            vec![Pos("id", N::Many), Opt("after", None), Flag("first")], |c, a| {
                let ids = a.list("id");
                let (mut prev, mut out) = (a.opt("after"), vec![]);
                for (i, id) in ids.iter().enumerate() {
                    let first = a.flag("first") && i == 0;
                    out.push(pg::pin(c.bible()?, &mut *c.study()?, id, Place { after: prev.as_deref(), first }).map_err(e)?);
                    prev = Some(id.clone());
                }
                if out.len() == 1 { j(out.remove(0)) } else { j(Value::Array(out)) }
            }),
        cmd("page duplicate", "Duplicate a page: a new page beside it with the same text, titled \"<title> (copy)\"; the pages inside it are not copied. wb page duplicate ID.",
            vec![Pos("id", N::One)], |c, a| j(pg::duplicate(c.bible()?, &mut *c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page link", "The [[link]] that Copy link copies, for a page: wb page link ID prints [[Its title]].",
            vec![Pos("id", N::One)], |c, a| Ok(Out::Text(pg::link_of(&*c.study()?, &a.s("id")).map_err(e)?))),
        cmd("page look", "A page's view choices, kept in settings/pages.json and not in the page: wb page look ID [--full-width on|off] [--small-text on|off] [--font default|serif] [--toc on|off]. With none, what is set (these and whether the page is locked).",
            vec![Pos("id", N::One), Opt("full_width", None), Opt("small_text", None), Opt("font", None), Opt("toc", None)], |c, a| {
                let onoff = |name: &str| -> Result<Option<bool>, String> {
                    match a.opt(name).map(|v| v.trim().to_lowercase()).as_deref() {
                        None => Ok(None),
                        Some("on") => Ok(Some(true)),
                        Some("off") => Ok(Some(false)),
                        Some(v) => Err(format!("--{} is on or off, not “{v}”.", name.replace('_', "-"))),
                    }
                };
                let font = a.opt("font");
                let ch = pg::LookChange { full_width: onoff("full_width")?, small_text: onoff("small_text")?, toc: onoff("toc")?, font: font.as_deref().map(str::trim), locked: None };
                if ch.full_width.is_none() && ch.small_text.is_none() && ch.toc.is_none() && ch.font.is_none() {
                    return j(pg::look(&*c.study()?, &a.s("id")));
                }
                j(pg::set_look(&mut *c.study()?, &a.s("id"), ch).map_err(e)?)
            }),
        cmd("page lock", "Lock a page or unlock it: wb page lock ID on|off. A locked page takes no typing in the window; kept in settings/pages.json. With no on or off, whether it is locked.",
            vec![Pos("id", N::One), Pos("state", N::Opt)], |c, a| {
                match Some(a.s("state").trim().to_lowercase()).filter(|v| !v.is_empty()).as_deref() {
                    None => j(pg::look(&*c.study()?, &a.s("id"))),
                    Some("on") => j(pg::set_lock(&mut *c.study()?, &a.s("id"), true).map_err(e)?),
                    Some("off") => j(pg::set_lock(&mut *c.study()?, &a.s("id"), false).map_err(e)?),
                    Some(v) => Err(format!("Lock is on or off, not “{v}”.")),
                }
            }),
        cmd("page text", "The page's Markdown as one text, as Copy contents copies it: the title a heading, every scripture block written out from the Bible verbatim with its reference, no link ids. wb page text ID prints it (--json: {id, text}); with new text after the id it is wb note text, which writes the page.",
            vec![Pos("id", N::One)], |c, a| {
                let v = pg::contents(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?;
                if a.flag("json") { j(v) } else { Ok(Out::Text(v["text"].as_str().unwrap_or("").to_string())) }
            }),
        cmd("page unpin", "Take a page out of Pinned.", vec![Pos("id", N::One)], |c, a| j(pg::unpin(c.bible()?, &mut *c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page blocks", "A page's blocks, numbered from 1: each one's kind (paragraph, heading, item, numbered, todo, quote, divider, table, fence), its Markdown and where it is in the text; and its title. A day's page by its day (2026-11-07).",
            vec![Pos("id", N::One)], |c, a| j(pg::blocks(&*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page scripture", "A page's scripture blocks with their verses from the Bible: each block's number, reference, Paragraph or Lines (lines), version, and its verses verbatim with the highlights on them (as wb scripture). The file holds only the reference.",
            vec![Pos("id", N::One)], |c, a| j(pg::scripture(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("block scripture", "A scripture block's choices, kept in its fence after the reference: --lines (a verse to a line) or --paragraph; --ylt or --kjv; --marks (With my marks: the reader's colors and pencil and a dot per verse that has a note, page or save) or --no-marks (Just the text). wb block scripture ID 3 --lines --ylt.",
            vec![Pos("id", N::One), Pos("n", N::One), Flag("lines"), Flag("paragraph"), Flag("ylt"), Flag("kjv"), Flag("marks"), Flag("no_marks")], |c, a| {
                let n = nth(a, "n")?;
                let pick = |on: &str, off: &str| match (a.flag(on), a.flag(off)) {
                    (true, true) => Err(format!("--{} or --{}, not both.", on.replace('_', "-"), off.replace('_', "-"))),
                    (true, false) => Ok(Some(true)),
                    (false, true) => Ok(Some(false)),
                    _ => Ok(None),
                };
                let (lines, ylt, marks) = (pick("lines", "paragraph")?, pick("ylt", "kjv")?, pick("marks", "no_marks")?);
                if lines.is_none() && ylt.is_none() && marks.is_none() {
                    return Err("Say what to change: --lines or --paragraph, --ylt or --kjv, --marks or --no-marks.".into());
                }
                j(pg::set_scripture(c.bible()?, &mut *c.study()?, &a.s("id"), n, lines, ylt, marks).map_err(e)?)
            }),
        cmd("page overview", "Scripture in this page: every scripture the page names (in its text, its scripture blocks), in the Bible's order, each with where it is named (a block number, or ¶n); with books and counts, and folded (true) past 30. The same as wb refs on the page's text plus its blocks.",
            vec![Pos("id", N::One)], |c, a| j(wb_core::overview::page(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page threads", "A page's thread blocks (/~) with what each shows: the block's number, the thread, its color, how many places and its first places' references; a thread that is gone says so.",
            vec![Pos("id", N::One)], |c, a| j(pg::threads(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("page words", "A page's word blocks (/word) with the lexicon's entry for each: the number, the word, its sound, Strong's own words, the KJV's renderings and how often. The file holds only the number.",
            vec![Pos("id", N::One)], |c, a| j(pg::words(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("block thread", "Change a thread block's thread: wb block thread ID 3 Phinehas. A thread that exists is checked first; the file holds its id.",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("thread", N::Many)], |c, a| {
                let n = nth(a, "n")?;
                j(pg::set_value_block(c.bible()?, &mut *c.study()?, &a.s("id"), n, "thread", &a.s("thread")).map_err(e)?)
            }),
        cmd("block word", "Change a word block's Strong's number: wb block word ID 3 H7065. The lexicon is asked first.",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("strong", N::One)], |c, a| {
                let n = nth(a, "n")?;
                j(pg::set_value_block(c.bible()?, &mut *c.study()?, &a.s("id"), n, "word", &a.s("strong")).map_err(e)?)
            }),
        cmd("page study", "A page's Study blocks (interlinear, xrefs, concordance, margin, marks) with what each shows now: the block's number, its fence (lang), what it holds (a reference, or an English word) and its data; a block that cannot be read says why. The file holds only the reference or word.",
            vec![Pos("id", N::One)], |c, a| j(wb_core::studyblocks::page(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("block study", "Change a Study block's value: wb block study ID 3 \"Num 25:11\" (interlinear, xrefs, margin and marks hold a reference, concordance an English word, word a Strong's number). The block's fence stays; the value is checked first.",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("value", N::Many)], |c, a| {
                let n = nth(a, "n")?;
                j(wb_core::studyblocks::set(c.bible()?, &mut *c.study()?, &a.s("id"), n, &a.s("value")).map_err(e)?)
            }),
        cmd("page views", "A page's views (W5) with what each finds now: each block's number, its line, and its rows (as wb view run); a line that cannot be read, or holds a template's blank, says so.",
            vec![Pos("id", N::One)], |c, a| j(pv::page_views(c.bible()?, &*c.study()?, &a.s("id")).map_err(e)?)),
        cmd("block view", "Change a List in a page: wb block view ID 3 \"notebook thread phinehas\" [--view table|list|gallery|board] [--group none|folder|callout|PROPERTY] [--columns \"Status, Book\"] [--sort edited|created|title]. The line is read first; one that cannot be read is not written. With no line only the options change; an empty option (--group \"\") is taken away. The fence keeps the line first and one option a line under it.",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("line", N::Any), Opt("view", None), Opt("group", None), Opt("columns", None), Opt("sort", None)], |c, a| {
                let n = nth(a, "n")?;
                let line = a.s("line");
                let opts: Vec<(&str, Option<String>)> = ["view", "group", "columns", "sort"].into_iter().map(|k| (k, a.opt(k))).collect();
                let opts: Vec<(&str, Option<&str>)> = opts.iter().map(|(k, v)| (*k, v.as_deref())).collect();
                if line.trim().is_empty() && opts.iter().all(|o| o.1.is_none()) {
                    return Err("Give the view's line, or an option: --view, --group, --columns, --sort.".into());
                }
                j(pv::set_view(c.bible()?, &mut *c.study()?, &a.s("id"), n, if line.trim().is_empty() { None } else { Some(line.as_str()) }, &opts).map_err(e)?)
            }),
        cmd("page prop", "A page's properties, the columns of a List in a page (notebook rows 36, 47): wb page prop ID shows them; wb page prop ID Status Open sets one; wb page prop ID Status --remove (or an empty value) takes it away. They are kept in the page's front matter (props), text only, one line each; title, edited, created, folder, callout, kind and id cannot be names.",
            vec![Pos("id", N::One), Pos("name", N::Opt), Pos("value", N::Any), Flag("remove")], |c, a| {
                let name = a.s("name");
                if name.trim().is_empty() {
                    return j(pv::page_props(&*c.study()?, &a.s("id")).map_err(e)?);
                }
                let value = a.s("value");
                j(pv::set_prop(&mut *c.study()?, &a.s("id"), &name, if a.flag("remove") { None } else { Some(value.as_str()) }).map_err(e)?)
            }),
        cmd("view run", "What a view's line finds, as a view lists it (and the command field): wb view run \"notebook @Num 25 questions\". The line: notebook, then any of @place (a verse, chapter, book or H7065), questions | open | answered, thread <name>, days N, pages, kind all|note|question|day|thread, and words. Views read; they never write.",
            vec![Pos("line", N::Many)], |c, a| j(pv::run(c.bible()?, &*c.study()?, &a.s("line")).map_err(e)?)),
        cmd("template list", "Your templates (notes with template: true): what each holds, whether it asks for a place, the name new pages get, where they go, and how often used.",
            vec![], |c, _| j(tp::list(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("template show", "A template whole: its text, blocks and settings; with --place (and --reader), what a page made from it now would be named and hold; --title previews an explicit page name.",
            vec![Pos("name", N::Many), Opt("place", None), Opt("reader", None), Opt("title", None)], |c, a| {
                let (place, reader, title) = (a.opt("place"), a.opt("reader"), a.opt("title"));
                j(tp::show_with_title(c.bible()?, &*c.study()?, &a.s("name"), place.as_deref(), reader.as_deref(), title.as_deref()).map_err(e)?)
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
        cmd("template rm", "Delete a template with timed Undo; the pages made from it stay as they are.",
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
        cmd("block set", "Write a block anew: wb block set ID 3 \"- [ ] Print the verse deck\" (--count K: K blocks from it become this text; - reads standard input; a blank line in it makes two blocks; --undo returns a token for wb block undo, how a join of two blocks is made undoable; --expect TEXT requires the current page text to match).",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("text", N::Many), Opt("count", None), Opt("expect", None), Flag("undo")], |c, a| {
                let n = nth(a, "n")?;
                let count = opt_n(a, "count")?.unwrap_or(1);
                let text = text_of(c, &a.s("text"))?;
                if text.trim().is_empty() {
                    return Err("Give the block's new text (wb block rm removes it).".into());
                }
                let what = Edit::Set { n, count, text: &text };
                if a.flag("undo") {
                    return j(pg::edit_undoable(c.bible()?, &mut *c.study()?, &a.s("id"), what, a.opt("expect").as_deref()).map_err(e)?);
                }
                j(pg::edit_guarded(c.bible()?, &mut *c.study()?, &a.s("id"), what, a.opt("expect").as_deref()).map_err(e)?)
            }),
        cmd("block add", "Add a block: wb block add ID \"# Before Tuesday\" --after 2 (--first: right under the title; neither: last). - reads standard input. --as word|interlinear|xrefs|concordance|margin|marks: the text is the one value the Study block holds (a Strong's number, a reference, an English word), checked, and the block written is that fence. --scripture: the text is a reference (\"Num 25:18-26:1\"), checked against the Bible, and the block written is the fenced scripture block holding only that reference; without it a bare reference stays a paragraph.",
            vec![Pos("id", N::One), Pos("text", N::Many), Opt("after", None), Flag("first"), Flag("scripture"), Opt("as", None)], |c, a| {
                let mut text = text_of(c, &a.s("text"))?;
                if let Some(kind) = a.opt("as") {
                    if a.flag("scripture") {
                        return Err("--scripture or --as, not both.".into());
                    }
                    let kind = kind.to_lowercase();
                    let held = wb_core::studyblocks::checked(c.bible()?, &kind, &text).map_err(e)?;
                    text = wb_core::studyblocks::fence_text(&kind, &held);
                }
                if a.flag("scripture") {
                    let reference = text.trim().to_string();
                    c.span(&reference)?;
                    text = format!("```scripture\n{reference}\n```");
                }
                let after = match (opt_n(a, "after")?, a.flag("first")) {
                    (Some(n), _) => Some(n - 1),
                    (None, true) => None,
                    (None, false) => count(c, &a.s("id"))?.checked_sub(1),
                };
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Add { after, text: &text }).map_err(e)?)
            }),
        cmd("block dup", "Copy a block right below itself (Duplicate in the block menu): wb block dup ID 3. The answer's n is the copy's number. --undo returns a token for wb block undo; --expect TEXT requires the current page text to match.",
            vec![Pos("id", N::One), Pos("n", N::One), Flag("undo"), Opt("expect", None)], |c, a| {
                let n = nth(a, "n")?;
                j(pg::duplicate_block(c.bible()?, &mut *c.study()?, &a.s("id"), n, a.flag("undo"), a.opt("expect").as_deref()).map_err(e)?)
            }),
        cmd("page fold", "Fold or unfold a toggle (a block that begins <details><summary>), kept in settings/pages.json and not in the page: wb page fold ID N --on|--off (N: the toggle's head block, from 1). With neither, the folded toggles' head texts.",
            vec![Pos("id", N::One), Pos("n", N::Opt), Flag("on"), Flag("off")], |c, a| {
                if a.flag("on") == a.flag("off") {
                    return j(serde_json::json!({"id": a.s("id"), "folds": pg::folded(&*c.study()?, &a.s("id"))}));
                }
                j(pg::set_fold(&mut *c.study()?, &a.s("id"), nth(a, "n")?, a.flag("on")).map_err(e)?)
            }),
        cmd("block rm", "Remove a block from a page (--count K: K blocks from it). --undo returns a token for wb block undo; --expect TEXT requires the current page text to match.",
            vec![Pos("id", N::One), Pos("n", N::One), Opt("count", None), Flag("undo"), Opt("expect", None)], |c, a| {
                let n = nth(a, "n")?;
                let count = opt_n(a, "count")?.unwrap_or(1);
                if a.flag("undo") {
                    j(pg::remove_block(c.bible()?, &mut *c.study()?, &a.s("id"), n, count, a.opt("expect").as_deref()).map_err(e)?)
                } else {
                    j(pg::edit_guarded(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Set { n, count, text: "" }, a.opt("expect").as_deref()).map_err(e)?)
                }
            }),
        cmd("block undo", "Put back what a block change took (a removal, a join of two blocks, a copy) if the page text is as the change left it. wb block undo ID TOKEN; - reads the undo token from standard input.",
            vec![Pos("id", N::One), Pos("token", N::One)], |c, a| {
                let text = text_of(c, &a.s("token"))?;
                let undo = serde_json::from_str(&text).map_err(|_| "Give the undo token returned by wb block rm --undo.")?;
                j(pg::undo_block(c.bible()?, &mut *c.study()?, &a.s("id"), undo).map_err(e)?)
            }),
        cmd("block move", "Move a block: wb block move ID 5 --page OTHER [--count K] moves K blocks from it to the end of another page; wb block move ID 5 --to 2 (it then comes before what is now block 2), or --last. --beside M puts it in a column beside block M, at M's right (--left: at M's left): the two blocks, or the column, sit between the page's <!-- columns --> markers; at most four columns, and a column or group left empty by the move loses its markers.",
            vec![Pos("id", N::One), Pos("n", N::One), Opt("to", None), Opt("beside", None), Flag("left"), Flag("last"), Opt("page", None), Opt("count", None)], |c, a| {
                let n = nth(a, "n")?;
                if let Some(other) = a.opt("page") {
                    if a.opt("to").is_some() || a.opt("beside").is_some() || a.flag("last") || a.flag("left") {
                        return Err("--page, or --to, --beside, --last: one of them.".into());
                    }
                    let count = opt_n(a, "count")?.unwrap_or(1);
                    return j(pg::move_to_page(c.bible()?, &mut *c.study()?, &a.s("id"), n, count, &other).map_err(e)?);
                }
                if a.opt("count").is_some() {
                    return Err("--count goes with --page.".into());
                }
                if let Some(m) = opt_n(a, "beside")? {
                    if a.opt("to").is_some() || a.flag("last") {
                        return Err("--beside, or --to, or --last: one of them.".into());
                    }
                    if m == 0 {
                        return Err("Blocks are counted from 1.".into());
                    }
                    return j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Beside { n, m: m - 1, left: a.flag("left") }).map_err(e)?);
                }
                if a.flag("left") {
                    return Err("--left goes with --beside.".into());
                }
                let to = match (opt_n(a, "to")?, a.flag("last")) {
                    (Some(t), false) => t - 1,
                    (None, true) => count(c, &a.s("id"))?,
                    _ => return Err("Give --to N (it comes before block N), --beside N or --last.".into()),
                };
                j(pg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), Edit::Move { n, to }).map_err(e)?)
            }),
        cmd("block link", "The link to a block (the block menu's Copy link to block): wb block link ID 3 gives {link: \"[[Page title#^abc123]]\", block}. The block gets a short id (^ and six lowercase letters or digits) at the end of its text the first time, which the window never shows; one it already has is reused. Paste the link into another page.",
            vec![Pos("id", N::One), Pos("n", N::One)], |c, a| {
                let n = nth(a, "n")?;
                j(pg::block_link(c.bible()?, &mut *c.study()?, &a.s("id"), n).map_err(e)?)
            }),
        cmd("block color", "Give blocks a background color (the block menu's Color): wb block color ID 3 yellow (gray brown orange yellow green blue purple red, or default to take it off; --count K: K blocks from it). The color is a <span data-bg=\"…\"> around the block's whole text; blocks that are not text (scripture, a table, a divider) are left as they are. --undo returns a token for wb block undo; --expect TEXT requires the current page text to match.",
            vec![Pos("id", N::One), Pos("n", N::One), Pos("color", N::One), Opt("count", None), Flag("undo"), Opt("expect", None)], |c, a| {
                let n = nth(a, "n")?;
                let count = opt_n(a, "count")?.unwrap_or(1);
                let color = a.s("color");
                let name = if color.eq_ignore_ascii_case("default") { None } else { Some(color.to_lowercase()) };
                let what = Edit::Color { n, count, name: name.as_deref() };
                if a.flag("undo") {
                    return j(pg::edit_undoable(c.bible()?, &mut *c.study()?, &a.s("id"), what, a.opt("expect").as_deref()).map_err(e)?);
                }
                j(pg::edit_guarded(c.bible()?, &mut *c.study()?, &a.s("id"), what, a.opt("expect").as_deref()).map_err(e)?)
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
