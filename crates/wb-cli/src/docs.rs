//! Word and PDF exports, previews and saved document records.

use crate::args::{Append, Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::{json, Value};
use std::path::Path;
use wb_core::docs;

fn e(x: wb_core::Error) -> String {
    x.0
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

fn out_dir(c: &Ctx<'_>) -> Result<docs::ExportFolders, String> {
    docs::ExportFolders::for_study(&c.root()?).map_err(e)
}

fn thread_id(c: &Ctx<'_>, name: &str) -> Result<String, String> {
    let st = c.study()?;
    Ok(crate::study::thread(&st, name)?["id"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

fn source_args() -> Vec<crate::args::Spec> {
    vec![
        Opt("thread", None),
        Opt("folder", None),
        Opt("page", None),
        Opt("passage", None),
        Opt("lesson", None),
        Opt("version", None),
    ]
}

fn require_one_source(a: &crate::args::Args) -> Result<(), String> {
    if ["thread", "folder", "page", "passage", "lesson"]
        .iter()
        .filter(|key| a.opt(key).is_some())
        .count()
        != 1
    {
        return Err("Give exactly one source: --folder NAME (or --thread NAME), --page ID, --passage REF or --lesson NAME.".into());
    }
    Ok(())
}

fn source(c: &Ctx<'_>, a: &crate::args::Args) -> Result<docs::Source, String> {
    if let Some(reference) = a.opt("passage") {
        return Ok(docs::Source::Passage {
            reference,
            version: a.opt_or("version", "KJV"),
        });
    }
    if let Some(name) = a.opt("lesson") {
        return Ok(docs::Source::Lesson(name));
    }
    let name = a
        .opt("folder")
        .or_else(|| a.opt("thread"))
        .ok_or("Give a folder, passage or lesson.")?;
    Ok(docs::Source::Thread(thread_id(c, &name)?))
}

/// The dials given as --set DIAL=VALUE (R3's Looks: wb docs looks lists them).
fn dials(a: &crate::args::Args) -> Result<Vec<(String, String)>, String> {
    a.list("set")
        .iter()
        .map(|d| {
            d.split_once('=')
                .map(|(k, v)| (k.trim().to_string(), v.trim().to_string()))
                .ok_or_else(|| format!("--set DIAL=VALUE, such as --set ink=saver (not “{d}”)."))
        })
        .collect()
}

fn make(c: &Ctx<'_>, a: &crate::args::Args, to: &str) -> Res {
    require_one_source(a)?;
    let set = dials(a)?;
    let out = out_dir(c)?;
    let r = if let Some(page) = a.opt("page") {
        let st = c.study()?;
        let (structure, theme, look) = (a.opt("structure"), a.opt("theme"), a.opt("look"));
        let (version, on, off) = (a.opt("version"), a.list("on"), a.list("off"));
        docs::make_page(
            c.bible()?,
            &st,
            &out,
            &page,
            to,
            &docs::Choices {
                structure: structure.as_deref(),
                styling: docs::Styling {
                    theme: theme.as_deref(),
                    look_name: look.as_deref(),
                    dials: &set,
                    force: a.flag("force"),
                },
            },
            &docs::PageParts {
                version: version.as_deref(),
                on: &on,
                off: &off,
            },
        )
    } else {
        let input = source(c, a)?;
        let st = c.study()?;
        let (structure, theme, look) = (a.opt("structure"), a.opt("theme"), a.opt("look"));
        docs::make(
            c.bible()?,
            &st,
            &out,
            input,
            to,
            &docs::Choices {
                structure: structure.as_deref(),
                styling: docs::Styling {
                    theme: theme.as_deref(),
                    look_name: look.as_deref(),
                    dials: &set,
                    force: a.flag("force"),
                },
            },
            a.flag("new"),
        )
    }
    .map_err(e)?;
    if a.flag("open") {
        docs::open_file(Path::new(r["path"].as_str().unwrap_or(""))).map_err(e)?;
    }
    j(r)
}

fn make_args() -> Vec<crate::args::Spec> {
    [
        source_args(),
        vec![
            Opt("structure", None),
            Opt("theme", None),
            Append("on"),
            Append("off"),
            Opt("look", None),
            Append("set"),
            Flag("open"),
            Flag("new"),
            Flag("force"),
        ],
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn build_lesson(c: &Ctx<'_>, a: &crate::args::Args) -> Res {
    if a.flag("pdf") {
        return Err("PDF companions for Office files are not available in Rust yet. Use --make reader or --make verse for slides as PDF pages.".into());
    }
    let requested = a.opt_or("make", "script,share");
    let mut formats = Vec::new();
    for structure in requested
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let to = match structure {
            "script" | "share" | "study" | "reading" => "word",
            "reader" | "verse" => "pdf",
            _ => return Err(format!("“{structure}” is unavailable for Rust lesson exports. Choose script, share, study, reading, reader or verse.")),
        };
        if !formats.contains(&(to, structure)) {
            formats.push((to, structure));
        }
    }
    if formats.is_empty() {
        return Err("--make needs at least one structure.".into());
    }
    let theme = a.opt("theme");
    let out = out_dir(c)?;
    let st = c.study()?;
    let id = wb_core::studyapi::lesson_find(&st, &a.s("name")).map_err(e)?;
    let mut files = Vec::new();
    let mut title = id.clone();
    for (to, structure) in formats {
        let mut result = docs::make(
            c.bible()?,
            &st,
            &out,
            docs::Source::Lesson(id.clone()),
            to,
            &docs::Choices {
                structure: Some(structure),
                styling: docs::Styling {
                    theme: theme.as_deref(),
                    ..Default::default()
                },
            },
            a.flag("new"),
        )
        .map_err(e)?;
        if let Some(s) = result["title"].as_str() {
            title = s.to_string();
        }
        if a.flag("open") {
            docs::open_file(Path::new(result["path"].as_str().unwrap_or(""))).map_err(e)?;
        }
        result["kind"] = json!(structure);
        result["kept"] = result["kept_now"].clone();
        files.push(result);
    }
    j(json!({"lesson": id, "title": title, "files": files}))
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("packet", "Join saved PDFs in the given order. Use document:NAME for a saved Office document's existing PDF companion. --out chooses a new PDF filename.",
            vec![Pos("names", N::Many), Opt("out", None), Flag("open")], |c, a| {
                let folders = out_dir(c)?;
                let store = c.study()?;
                let result = docs::packet::make(&store, &folders, &a.list("names"), a.opt("out").as_deref()).map_err(e)?;
                if a.flag("open") {
                    docs::open_file(Path::new(result["path"].as_str().unwrap_or(""))).map_err(e)?;
                }
                j(result)
            }),
        cmd("pdf", "Save the first KJV chapter named by REF as a print PDF with its existing notes. --no-highlights hides all marks.\n\
                    --no-mine hides personal highlights, --thread ID includes a thread's underlines, and --open opens the result.",
            vec![Pos("ref", N::Many), Flag("no_highlights"), Flag("no_mine"), Append("thread"), Flag("open")], |c, a| {
            let out = out_dir(c)?;
            let st = c.study()?;
            let show_marks = !a.flag("no_highlights");
            let threads = if show_marks { a.list("thread") } else { vec![] };
            let file = docs::chapter::save(c.bible()?, &st, &out, &a.s("ref"), show_marks && !a.flag("no_mine"), &threads).map_err(e)?;
            if a.flag("open") {
                docs::open_file(Path::new(file["path"].as_str().unwrap_or(""))).map_err(e)?;
            }
            j(file)
        }),
        cmd("pdfs", "List saved PDFs or open one in the system PDF viewer by name. --exact selects a saved basename.",
            vec![Pos("name", N::Any), Flag("exact")], |c, a| {
            let out = out_dir(c)?;
            let name = a.s("name");
            if name.is_empty() {
                return j(json!(docs::pdfs::list(&out).map_err(e)?));
            }
            j(docs::pdfs::open(&out, &name, a.flag("exact")).map_err(e)?)
        }),
        cmd("docs list", "Your Word documents and slide decks, and how each stands. --thread NAME, --page ID or --lesson ID filters by source.",
            vec![Opt("thread", None), Opt("folder", None), Opt("page", None), Opt("lesson", None)], |c, a| {
            let of = if let Some(t) = a.opt("folder").or_else(|| a.opt("thread")) { Some(("thread", thread_id(c, &t)?)) }
                else if let Some(p) = a.opt("page") { Some(("page", p.trim().to_string())) }
                else { a.opt("lesson").map(|l| ("lesson", wb_core::studyapi::lesson_slug(&l))) };
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
                            --theme changes its theme, --look its Look and --set DIAL=VALUE one dial (wb docs looks); --force rebuilds even if nothing changed.\n\
                            A document in the old design (made before R3) is brought into the new one only when named here.",
            vec![Pos("name", N::Any), Opt("theme", None), Opt("look", None), Append("set"), Flag("force"), Flag("open")], |c, a| {
            let name = a.s("name");
            let set = dials(a)?;
            if name.is_empty() && (a.opt("theme").is_some() || a.opt("look").is_some() || !set.is_empty() || a.flag("force") || a.flag("open")) {
                return Err("--theme, --look, --set, --force and --open need the name of one document.".into());
            }
            let out = out_dir(c)?;
            let st = c.study()?;
            if name.is_empty() {
                return j(docs::update_behind(c.bible()?, &st, &out));
            }
            let r = docs::update(c.bible()?, &st, &out, &name, &docs::Styling { theme: a.opt("theme").as_deref(), look_name: a.opt("look").as_deref(), dials: &set, force: a.flag("force") }).map_err(e)?;
            if a.flag("open") {
                docs::open_file(Path::new(r["path"].as_str().unwrap_or(""))).map_err(e)?;
            }
            j(r)
        }),
        cmd("docs like", "Make another like this: wb docs like NAME --page ID makes the same kind of document (Word or slides) from another page, with the same Look and theme and the same choice for each kind of part. The first document is not changed.",
            vec![Pos("name", N::Many), Opt("page", None), Flag("force"), Flag("open")], |c, a| {
            let Some(p) = a.opt("page") else { return Err("Give the page: --page ID (wb page tree lists them).".into()) };
            let out = out_dir(c)?;
            let st = c.study()?;
            let r = docs::make_like(c.bible()?, &st, &out, &a.s("name"), &p, a.flag("force")).map_err(e)?;
            if a.flag("open") {
                docs::open_file(Path::new(r["path"].as_str().unwrap_or(""))).map_err(e)?;
            }
            j(r)
        }),
        cmd("docs open", "Open the saved document in the system app for its format.", vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            j(docs::open(&*c.study()?, &out, &a.s("name")).map_err(e)?)
        }),
        cmd("docs open-preview", "Open a PowerPoint document's saved PDF preview in the system PDF viewer.", vec![Pos("name", N::Many)], |c, a| {
            let out = out_dir(c)?;
            j(docs::open_preview(&*c.study()?, &out, &a.s("name")).map_err(e)?)
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
        cmd("docs plan", "What a document would hold if made now, and its plan's fingerprint.\n\
                          Choose --folder NAME (or --thread NAME), --passage REF [--version V], --lesson NAME or --page ID.\n\
                          From a page: wb docs plan --page ID --to word|pdf [--version V] [--on KEY] [--off KEY]. For PDF, --pages lays out the selected plan with --theme, --look and --set.",
            [source_args(), vec![Opt("to", Some("word")), Opt("structure", None),
                Append("on"), Append("off"), Flag("pages"), Opt("theme", None), Opt("look", None), Append("set")]].into_iter().flatten().collect(), |c, a| {
            require_one_source(a)?;
            let theme = a.opt("theme");
            let look = a.opt("look");
            let set = dials(a)?;
            let layout = a.flag("pages").then_some(docs::PdfLayout { theme: theme.as_deref(), look: look.as_deref(), dials: &set });
            if let Some(p) = a.opt("page") {
                let st = c.study()?;
                let (version, on, off) = (a.opt("version"), a.list("on"), a.list("off"));
                let parts = docs::PageParts { version: version.as_deref(), on: &on, off: &off };
                return j(docs::plan_for_page(c.bible()?, &st, &p, &a.opt_or("to", "word"), a.opt("structure").as_deref(),
                    &parts, layout).map_err(e)?);
            }
            let input = source(c, a)?;
            let to = a.opt_or("to", "word");
            if !matches!(to.as_str(), "word" | "deck" | "pdf") {
                return Err("--to: word, deck or pdf.".into());
            }
            let st = c.study()?;
            j(docs::plan_for(c.bible()?, &st, input, &to, a.opt("structure").as_deref(), layout).map_err(e)?)
        }),
        cmd("craft word", "A Word document from --folder NAME (or --thread NAME), --passage REF [--version V], --lesson NAME or --page ID.\n\
                           Structures: script, share, study and reading. --theme: otherwise your saved theme.\n\
                           Asking again for the same source and structure updates the same file (see wb docs). Every verse in the file is checked against the Bible.\n\
                           From a page and the pages inside it: wb craft word --page ID [--on KEY] [--off KEY] [--version kjv|ylt|page]; the rows' keys are in\n\
                           wb craft parts --page ID. To-dos are left out unless switched on; with no --on or --off, the switches it was last made with stay.\n\
                           --look NAME (wb docs looks) and --set DIAL=VALUE style it; otherwise the Look it was last made with, or the one new documents use.",
            make_args(), |c, a| make(c, a, "word")),
        cmd("craft deck", "Slides from --folder NAME (or --thread NAME), --passage REF [--version V], --lesson NAME or --page ID.\n\
                           Structures: verse (Verse by Verse) and reader (Reader).\n\
                           --format pptx makes editable PowerPoint with a saved PDF preview. The default format is pdf.\n\
                           Asking again for the same source and structure updates the same file (see wb docs). Every verse on the pages is checked against the Bible.\n\
                           From a page: wb craft deck --page ID, with --on, --off and --version as wb craft word.",
            make_args().into_iter().chain([Opt("format", Some("pdf"))]).collect(), |c, a| {
            match a.opt_or("format", "pdf").as_str() {
                "pdf" => make(c, a, "pdf"),
                "pptx" => make(c, a, "deck"),
                _ => Err("--format: pdf or pptx.".into()),
            }
        }),
        cmd("lesson build", "Export an existing lesson file. --make selects structures, separated by commas. The default is script,share.\n\
                             Word: script, share, study, reading. PDF slides: reader, verse. --new makes separate exports.",
            vec![Pos("name", N::Many), Opt("make", None), Opt("theme", None), Flag("pdf"), Flag("new"), Flag("open")], build_lesson),
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
        cmd("docs looks", "The Looks a document can be made in (Preview, Classic, Ink saver, Large print, Modern, and your own), each with its dials' values,\n\
                           the Look new documents use, and the accent swatches. A Look is styling only: what goes in a document does not change.",
            vec![], |c, _| j(docs::look::list(&*c.study()?))),
        cmd("docs look", "Show a Look's dials: wb docs look classic. --use makes it the Look new documents use.\n\
                          Save your own from another with dials changed: wb docs look \"My print\" --from ink-saver --set accent=blue --set title=center --save.\n\
                          Dials: typeface (inter-literata|literata|inter), accent (hex or red|brown|blue|green|plum|graphite), size (small|regular|large|largest),\n\
                          spacing (compact|comfortable|airy), title (left|center), numbers (accent|plain), under-title (none|rule), paper (letter|a4),\n\
                          ink (full|saver|black), neighbours (faint|hidden), reference (top|bottom), cover (on|off), running-head (on|off),\n\
                          page-numbers (of|plain|none), columns (1|2). --delete deletes one of your own (to .trash).",
            vec![Pos("name", N::Many), Opt("from", None), Append("set"), Flag("save"), Flag("use"), Flag("delete")], |c, a| {
            let name = a.s("name");
            let set = dials(a)?;
            if a.flag("delete") {
                return j(docs::look::delete(&*c.study()?, &name).map_err(e)?);
            }
            if a.flag("save") {
                let st = c.study()?;
                let from = a.opt("from").unwrap_or_else(|| docs::look::saved(&st));
                let l = docs::look::adjust(&st, &from, &set).map_err(e)?;
                let r = docs::look::save(&st, &name, &l).map_err(e)?;
                drop(st);
                if a.flag("use") {
                    docs::look::set_saved(&mut *c.study()?, &name).map_err(e)?;
                }
                return j(r);
            }
            if a.flag("use") {
                return j(docs::look::set_saved(&mut *c.study()?, &name).map_err(e)?);
            }
            let st = c.study()?;
            let l = docs::look::adjust(&st, &name, &set).map_err(e)?;
            j(json!({"key": docs::look::key_of(&name), "values": l}))
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
