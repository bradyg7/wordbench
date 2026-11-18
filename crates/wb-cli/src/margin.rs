//! Margin notes (design/features/marks, MK-17): `wb margin …`. The model and the files are in `wb_core::margin`.

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::Value;
use wb_core::margin as mg;

fn e(x: wb_core::Error) -> String {
    x.0
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

fn words(c: &Ctx<'_>, t: String) -> Result<String, String> {
    if t.trim() == "-" {
        c.stdin()
    } else {
        Ok(t)
    }
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("margin", "A chapter's or one verse's margin: wb margin \"Num 25\" lists the chapter's margin notes (each with its verse's first words) and one line of counts per verse; wb margin \"Num 25:11\" opens the verse: its text, its margin notes newest first, the notes on the passage around it, old placed notes, the counts (notes, pages, saves, marks) and the pages that name it in the fixed order (--all lifts the cap of 20 rows). Reads only.",
            vec![Pos("place", N::Many), Flag("all")], |c, a| {
                let sp = c.span(&a.s("place"))?;
                let st = c.study()?;
                if sp.v1 != 0 && sp.c1 == sp.c2 && (sp.v2 == 0 || sp.v2 == sp.v1) {
                    return j(mg::verse(c.bible()?, &st, &a.s("place"), a.flag("all")).map_err(e)?);
                }
                if sp.c1 != sp.c2 {
                    return Err("Name a chapter or a verse (Num 25, Num 25:11).".into());
                }
                j(mg::chapter(c.bible()?, &st, &sp.book.code, sp.c1).map_err(e)?)
            }),
        cmd("margin add", "Write a margin note at a verse, a passage of one chapter, or a chapter: wb margin add \"Num 25:11\" \"text\" (text - reads standard input). --question writes it as a question (the callout line), --words \"zealous\" names the words it is about, --page puts it in a new page whose first line is the reference instead (Add to a new page). It is written to margin/<BOOK>/<chapter>.md with its id and today's date.",
            vec![Pos("place", N::One), Pos("text", N::Any), Flag("question"), Opt("words", Some("")), Flag("page")], |c, a| {
                let text = words(c, a.s("text"))?;
                let mut st = c.study()?;
                if a.flag("page") {
                    return j(mg::add_to_new_page(c.bible()?, &mut st, &a.s("place"), &text).map_err(e)?);
                }
                j(mg::add(c.bible()?, &mut st, &a.s("place"), &text, a.flag("question"), &a.opt_or("words", "")).map_err(e)?)
            }),
        cmd("margin edit", "Replace a margin note's words: wb margin edit <id> \"text\". A question stays a question. Only its chapter's file is written.",
            vec![Pos("id", N::One), Pos("text", N::Any)], |c, a| {
                let text = words(c, a.s("text"))?;
                j(mg::edit(c.bible()?, &mut *c.study()?, &a.s("id"), &text).map_err(e)?)
            }),
        cmd("margin question", "Make a margin note a question (the callout line), --done to mark it answered, --off to make it a plain note again.",
            vec![Pos("id", N::One), Flag("done"), Flag("off")], |c, a| {
                let kind = if a.flag("off") { "note" } else if a.flag("done") { "done" } else { "question" };
                j(mg::set_kind(c.bible()?, &mut *c.study()?, &a.s("id"), kind).map_err(e)?)
            }),
        cmd("margin rm", "Delete a margin note (a copy goes to .trash first; wb margin restore <id> puts it back). A page that shows it keeps its block.",
            vec![Pos("id", N::One)], |c, a| j(mg::rm(c.bible()?, &mut *c.study()?, &a.s("id")).map_err(e)?)),
        cmd("margin restore", "Put back a margin note deleted with wb margin rm.", vec![Pos("id", N::One)],
            |c, a| j(mg::restore(c.bible()?, &mut *c.study()?, &a.s("id")).map_err(e)?)),
        cmd("margin grow", "Grow a margin note into a page, not moving it: a new page whose first block is a jot fence holding only the note's id (titled by its place, or --title), or --into <page id> adds the block to the end of that page. The note stays in the margin with \"grew into <page>\" under it; editing it in either place changes the one note.",
            vec![Pos("id", N::One), Opt("into", None), Opt("title", None)], |c, a| {
                j(mg::grow(c.bible()?, &mut *c.study()?, &a.s("id"), a.opt("into").as_deref(), a.opt("title").as_deref()).map_err(e)?)
            }),
        cmd("margin targets", "Where a margin note can be added (Add to a page…): the pages that already name its verse first, then the pages written in last, then a search of titles and words: wb margin targets <id> [words].",
            vec![Pos("id", N::One), Pos("words", N::Any)], |c, a| j(mg::targets(c.bible()?, &*c.study()?, &a.s("id"), &a.s("words")).map_err(e)?)),
        cmd("margin list", "The Library's Margin notes: the books that hold margin notes, each with its count and its chapters' counts, in the Bible's order. --book NUM lists one book's chapters (empty ones too); --map lists every chapter of every book (the map shades by count).",
            vec![Opt("book", None), Flag("map")], |c, a| j(mg::list(c.bible()?, &*c.study()?, a.opt("book").as_deref(), a.flag("map")).map_err(e)?)),
    ]
}
