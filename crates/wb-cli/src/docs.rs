//! Documents from a thread (tier 4): the Speaker Script as Word and Verse by Verse as PDF pages, each kept as one file
//! that is brought up to date (wb-core's docs module). The Python `wb`'s `docs` and `craft` commands, with the same names
//! and output; the structures this app does not make yet say so.

use crate::args::{Append, Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::{json, Value};
use std::path::PathBuf;
use wb_core::docs;

fn e(x: wb_core::Error) -> String {
    x.0
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

fn out_dir(c: &Ctx<'_>) -> Result<PathBuf, String> {
    Ok(docs::folder_for(&c.root()?))
}

fn thread_id(c: &Ctx<'_>, name: &str) -> Result<String, String> {
    let st = c.study()?;
    Ok(crate::study::thread(&st, name)?["id"].as_str().unwrap_or("").to_string())
}

fn make(c: &Ctx<'_>, a: &crate::args::Args, to: &str) -> Res {
    if let Some(page) = a.opt("page") {
        let out = out_dir(c)?;
        let st = c.study()?;
        let r = docs::make_page(c.bible()?, &st, &out, &page, to, a.opt("structure").as_deref(), a.opt("theme").as_deref(), a.opt("version").as_deref(),
            &a.list("on"), &a.list("off"), a.flag("force")).map_err(e)?;
        if a.flag("open") {
            docs::open_file(&out.join(r["name"].as_str().unwrap_or(""))).map_err(e)?;
        }
        return j(r);
    }
    if a.opt("passage").is_some() {
        return Err("Documents from a passage are made by the Python app until phase 5; here, from a thread: --thread NAME.".into());
    }
    let Some(t) = a.opt("thread") else { return Err("Give the thread (--thread NAME) or the page (--page ID).".into()) };
    let id = thread_id(c, &t)?;
    let out = out_dir(c)?;
    let st = c.study()?;
    let r = docs::make(c.bible()?, &st, &out, &id, to, a.opt("structure").as_deref(), a.opt("theme").as_deref(), a.flag("new"), a.flag("force")).map_err(e)?;
    if a.flag("open") {
        docs::open_file(&out.join(r["name"].as_str().unwrap_or(""))).map_err(e)?;
    }
    j(r)
}

fn make_args() -> Vec<crate::args::Spec> {
    vec![Opt("thread", None), Opt("page", None), Opt("passage", None), Opt("version", None), Opt("structure", None), Opt("theme", None), Append("on"), Append("off"), Flag("open"), Flag("new"), Flag("force")]
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("docs list", "Your Word documents and slide decks, and how each stands: current, behind (its source changed), edited (its file was changed by hand),\n\
                          missing (the file is gone), gone (its thread or page is gone), unreadable, or forgotten. --thread for one thread's, --page ID for one page's.",
            vec![Opt("thread", None), Opt("page", None)], |c, a| {
            let of = match (a.opt("thread"), a.opt("page")) {
                (Some(t), _) => Some(("thread", thread_id(c, &t)?)),
                (None, Some(p)) => Some(("page", p.trim().to_string())),
                _ => None,
            };
            let out = out_dir(c)?;
            let st = c.study()?;
            j(docs::listing(c.bible()?, &st, &out, of.as_ref().map(|(k, id)| (*k, id.as_str()))))
        }),
        cmd("docs show", "One document and how it stands.", vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            let st = c.study()?;
            let rec = docs::find(&st, &a.s("name")).map_err(e)?;
            j(docs::status(c.bible()?, &st, &out, &rec))
        }),
        cmd("docs update", "Bring a document up to date, in the same file: wb docs update phinehas. With no name, every document that is behind.\n\
                            A file changed by hand is first kept as a copy beside it. A file open in Word has to be closed first.\n\
                            --theme changes its theme; --force rebuilds even if nothing changed.",
            vec![Pos("name", N::Any), Opt("theme", None), Flag("force"), Flag("open")], |c, a| {
            let name = a.s("name");
            if name.is_empty() && (a.opt("theme").is_some() || a.flag("force") || a.flag("open")) {
                return Err("--theme, --force and --open need the name of one document.".into());
            }
            let out = out_dir(c)?;
            let st = c.study()?;
            if name.is_empty() {
                return j(docs::update_behind(c.bible()?, &st, &out));
            }
            let r = docs::update(c.bible()?, &st, &out, &name, a.opt("theme").as_deref(), a.flag("force")).map_err(e)?;
            if a.flag("open") {
                docs::open_file(&out.join(r["name"].as_str().unwrap_or(""))).map_err(e)?;
            }
            j(r)
        }),
        cmd("docs open", "Open a document in its app (Word, or the PDF viewer).", vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            let rec = docs::find(&*c.study()?, &a.s("name")).map_err(e)?;
            let path = out.join(rec["name"].as_str().unwrap_or(""));
            docs::open_file(&path).map_err(e)?;
            j(json!({"ok": true, "name": rec["name"], "path": path.to_string_lossy()}))
        }),
        cmd("docs forget", "Stop keeping a document up to date. It stays listed and its file is left alone; docs remember takes it back.",
            vec![Pos("name", N::Many)], |c, a| j(docs::forget(&*c.study()?, &a.s("name")).map_err(e)?)),
        cmd("docs remember", "Keep a forgotten document up to date again. Says how it stands now.", vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            let st = c.study()?;
            j(docs::remember(c.bible()?, &st, &out, &a.s("name")).map_err(e)?)
        }),
        cmd("docs delete", "Delete a document, forgotten or not: its file, its PDF and any kept versions are erased from the disk; its record goes to .trash.",
            vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            j(docs::delete(&mut *c.study()?, &out, &a.s("name")).map_err(e)?)
        }),
        cmd("docs plan", "What a document from a thread would hold if made now, and its plan's fingerprint (the same as the Python app's):\n\
                          wb docs plan --thread phinehas --to word --structure script  |  --to deck --structure verse.\n\
                          From a page, with the switches it was last made with: wb docs plan --page ID --to word|pdf (and the verses it holds).",
            vec![Opt("thread", None), Opt("page", None), Opt("to", Some("word")), Opt("structure", None)], |c, a| {
            if let Some(p) = a.opt("page") {
                let st = c.study()?;
                return j(docs::plan_for_page(c.bible()?, &st, &p, &a.opt_or("to", "word")).map_err(e)?);
            }
            let Some(t) = a.opt("thread") else { return Err("Give the thread (--thread NAME) or the page (--page ID).".into()) };
            let id = thread_id(c, &t)?;
            let to = a.opt_or("to", "word");
            if !matches!(to.as_str(), "word" | "deck" | "pdf") {
                return Err("--to: word, deck or pdf.".into());
            }
            let st = c.study()?;
            j(docs::plan_for(c.bible()?, &st, &id, &to, a.opt("structure").as_deref()).map_err(e)?)
        }),
        cmd("craft word", "A Word document from a thread: wb craft word --thread phinehas --structure script [--theme olivet].\n\
                           Here: script (the Speaker Script); the other structures are made by the Python app until phase 5. --theme: otherwise your saved theme.\n\
                           Asking again for the same thread and structure updates the same file (see wb docs). Every verse in the file is checked against the Bible.\n\
                           From a page and the pages inside it: wb craft word --page ID [--on KEY] [--off KEY] [--version kjv|ylt|page]; the rows' keys are in\n\
                           wb craft parts --page ID. To-dos are left out unless switched on; with no --on or --off, the switches it was last made with stay.",
            make_args(), |c, a| make(c, a, "word")),
        cmd("craft deck", "Slides from a thread, as PDF pages: wb craft deck --thread phinehas --structure verse [--theme vigil].\n\
                           Here: verse (Verse by Verse); PowerPoint and the other structures are made by the Python app until phase 5.\n\
                           Asking again for the same thread and structure updates the same file (see wb docs). Every verse on the pages is checked against the Bible.\n\
                           From a page: wb craft deck --page ID, with --on, --off and --version as wb craft word.",
            make_args(), |c, a| make(c, a, "pdf")),
        cmd("craft parts", "What goes in a document from a page: each block of it (a run of to-dos or list items as one) and each page inside it, with its key,\n\
                            its switch and what it becomes. The switches are the ones its documents were last made with, or those given: --on KEY, --off KEY.\n\
                            --version kjv|ylt makes every scripture block that version; page (the default) keeps each block's own.",
            vec![Opt("page", None), Opt("version", None), Append("on"), Append("off")], |c, a| {
            let Some(p) = a.opt("page") else { return Err("Give the page: --page ID (wb page tree lists them).".into()) };
            let st = c.study()?;
            j(docs::page_parts(c.bible()?, &st, &p, &a.list("on"), &a.list("off"), a.opt("version").as_deref()).map_err(e)?)
        }),
        cmd("docs preview", "A document's file as the window previews it, read from the file: a Word document's paragraphs and their styles, or slides as PDF pages drawn in SVG (while the document is up to date).",
            vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            let st = c.study()?;
            j(docs::preview(c.bible()?, &st, &out, &a.s("name")).map_err(e)?)
        }),
        cmd("docs reveal", "Show a document's file in its folder (Explorer), picked out.", vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            j(docs::reveal(&*c.study()?, &out, &a.s("name")).map_err(e)?)
        }),
        cmd("craft designs", "The color themes and the slide and Word structures (which this app makes), with your saved theme.", vec![], |c, _| {
            j(docs::designs(&*c.study()?))
        }),
        cmd("craft theme", "Show or set the theme for new slides and Word documents (vellum, vigil, olivet, veil, daylight, print): wb craft theme vigil.",
            vec![Pos("name", N::Opt)], |c, a| {
            let name = a.s("name").to_lowercase();
            if name.is_empty() {
                return j(json!({"theme": docs::saved_theme(&*c.study()?)}));
            }
            j(docs::set_theme(&mut *c.study()?, &name).map_err(e)?)
        }),
    ]
}
