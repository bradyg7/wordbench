//! The person's study work: notes, highlights, threads, sets, trails, lessons, the day's log. The Python `wb`'s commands
//! of the same names, with the same output. Everything is written to the study folder (a scratch copy in tests).

use crate::args::{Append, Args, Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::{json, Value};
use wb_core::store::{s, Store};
use wb_core::{lookup, marks, places, shelf, studyapi as sa};

fn e(x: wb_core::Error) -> String {
    x.0
}

/// A place as typed → an anchor: John 3:16, John 3:16-18, Num 25:10-26:4, H7065, or a raw anchor (JHN.3:16.4).
pub(crate) fn anchor(c: &Ctx<'_>, text: &str) -> Result<String, String> {
    let t = text.trim();
    if lookup::is_strong(&t.to_uppercase()) {
        return Ok(t.to_uppercase());
    }
    let raw = t.len() > 4 && t.as_bytes()[3] == b'.' && t[..3].bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) && {
        let rest = &t[4..];
        let (cs, vs) = rest.split_once(':').unwrap_or(("", ""));
        !cs.is_empty() && cs.bytes().all(|b| b.is_ascii_digit()) && vs.bytes().next().is_some_and(|b| b.is_ascii_digit())
    };
    if raw {
        return Ok(t.to_string());
    }
    let sp = c.span(t)?;
    places::span_anchor(&sp).ok_or_else(|| format!("Name a verse or a run of verses, like John 3:16 or Num 25:11-13 (got “{t}”)."))
}

/// A thread by exact name, else a unique start of it, else a unique part of it.
pub(crate) fn thread(st: &Store, name: &str) -> Result<Value, String> {
    let every = sa::thread_list(st, None).map_err(e)?;
    let every = every.as_array().unwrap();
    let n = name.trim().to_lowercase();
    let low = |t: &Value| t["name"].as_str().unwrap_or("").to_lowercase();
    let pools: [Vec<&Value>; 3] = [
        every.iter().filter(|t| t["id"] == n.as_str() || low(t) == n).collect(),
        every.iter().filter(|t| low(t).starts_with(&n)).collect(),
        every.iter().filter(|t| low(t).contains(&n)).collect(),
    ];
    let hit = pools.into_iter().find(|p| !p.is_empty()).unwrap_or_default();
    if hit.is_empty() {
        return Err(format!("No thread called “{name}”."));
    }
    if hit.len() > 1 {
        return Err(format!("Which thread? {}", hit.iter().map(|t| t["name"].as_str().unwrap_or("")).collect::<Vec<_>>().join(", ")));
    }
    Ok(hit[0].clone())
}

pub fn tid(st: &Store, name: &str) -> Result<String, String> {
    Ok(thread(st, name)?["id"].as_str().unwrap().to_string())
}

/// Text given as arguments, or '-' for standard input, or --file.
fn body_text(c: &Ctx<'_>, words: &str, file: Option<String>) -> Result<String, String> {
    if let Some(f) = file {
        return std::fs::read_to_string(&f).map_err(|x| format!("{f}: {x}"));
    }
    if words.trim() == "-" {
        return c.stdin();
    }
    Ok(words.to_string())
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

pub fn commands() -> Vec<Command> {
    let set_items = || vec![Append("thread"), Append("place"), Append("note"), Append("lesson"), Append("pdf"), Append("document"), Append("tab")];
    let result_args = |mut v: Vec<crate::args::Spec>| {
        v.extend([Opt("scope", Some("all")), Opt("only", None), Flag("dry_run")]);
        v
    };
    vec![
        cmd("anchor", "Everything on one place: your notes, highlight, threads, original words. wb anchor John 3:16  |  wb anchor H7065. --pages: the pages whose text names the place or number, with their count.", vec![Pos("place", N::Many), Flag("pages")], |c, a| {
            if a.flag("pages") {
                return j(wb_core::wordpages::pages_naming(c.bible()?, &*c.study()?, &anchor(c, &a.s("place"))?).map_err(e)?);
            }
            j(sa::anchor_view(c.bible()?, &*c.study()?, &anchor(c, &a.s("place"))?).map_err(e)?)
        }),
        cmd("note add", "Write a note on a place: wb note add John 3:16 \"text\"  (text - reads standard input). A raw anchor (JHN.3:16.4) or H7065 also works.",
            vec![Pos("place", N::One), Pos("text", N::Any), Opt("file", None)], |c, a| {
                let text = body_text(c, &a.s("text"), a.opt("file"))?;
                if text.trim().is_empty() {
                    return Err("Write the note text.".into());
                }
                let an = anchor(c, &a.s("place"))?;
                j(json!(sa::save_note(c.bible()?, &mut *c.study()?, &an, &text, None).map_err(e)?))
            }),
        cmd("note list", "Your notes on a chapter or passage, in reading order: wb note list John 3.", vec![Pos("ref", N::Many)], |c, a| {
            let sp = c.span(&a.s("ref"))?;
            let st = c.study()?;
            let mut out = vec![];
            for ch in sp.c1..=sp.c2 {
                out.extend(sa::chapter_notes(c.bible()?, &st, &sp.book.code, ch as i64).map_err(e)?);
            }
            j(json!(out))
        }),
        cmd("note edit", "Replace a note's text (id from note list / anchor).", vec![Pos("id", N::One), Pos("anchor", N::One), Pos("text", N::Any), Opt("file", None)], |c, a| {
            let an = anchor(c, &a.s("anchor"))?;
            let text = body_text(c, &a.s("text"), a.opt("file"))?;
            j(json!(sa::save_note(c.bible()?, &mut *c.study()?, &an, &text, Some(&a.s("id"))).map_err(e)?))
        }),
        cmd("note rm", "Delete a page with timed Undo (wb page undo OPERATION).", vec![Pos("id", N::One)], |c, a| {
            let mut st = c.study()?;
            let id = a.s("id");
            if !st.notes().into_iter().chain(st.on_thread()).any(|n| s(n, "id") == id) {
                return Err("No such note.".into());
            }
            j(wb_core::deletion::remove(c.bible()?, &mut st, &id).map_err(e)?)
        }),
        cmd("hl set", "Highlight a place: wb hl set John 3:16 yellow  (yellow green blue pink orange, or #rrggbb). Returns an undo record.",
            vec![Pos("place", N::One), Pos("color", N::One)], |c, a| {
                let mut st = c.study()?;
                let mut color = a.s("color").to_lowercase();
                if color.len() > 1 && color.starts_with('c') && color[1..].chars().all(|x| x.is_ascii_digit()) {
                    let saved = st.palette();
                    let k: usize = color[1..].parse().unwrap_or(0);
                    if k < 1 || k > saved.len() {
                        return Err(format!("You have no saved color {color}."));
                    }
                    color = saved[k - 1].clone();
                }
                let an = anchor(c, &a.s("place"))?;
                j(sa::save_highlight(c.bible()?, &mut st, &an, Some(&color)).map_err(e)?)
            }),
        cmd("hl clear", "Remove the highlight from a place.", vec![Pos("place", N::One)], |c, a| {
            let an = anchor(c, &a.s("place"))?;
            j(sa::save_highlight(c.bible()?, &mut *c.study()?, &an, None).map_err(e)?)
        }),
        cmd("hl undo", "Put back exactly what a highlight changed (pass the 'undo' record that hl set printed, as JSON or - for stdin).", vec![Pos("record", N::Many)], |c, a| {
            let rec: Value = serde_json::from_str(&body_text(c, &a.s("record"), None)?).map_err(|_| "The undo record must be the JSON hl set printed.")?;
            let undo = rec.get("undo").cloned().unwrap_or(rec);
            j(sa::undo_highlight(&mut *c.study()?, &undo).map_err(e)?)
        }),
        cmd("hl list", "Your highlights in Bible order, optionally one color and/or the places a thread holds.", vec![Opt("color", None), Opt("thread", None)], |c, a| {
            let st = c.study()?;
            let t = match a.opt("thread") {
                Some(n) => Some(tid(&st, &n)?),
                None => None,
            };
            j(sa::highlight_list(c.bible()?, &st, a.opt("color").as_deref(), t.as_deref()).map_err(e)?)
        }),
        cmd("marks", "What is drawn on a chapter: highlights, notes, colored-thread places, and every mark (\"marks\": the drawn marks and the old highlights, by date made).", vec![Pos("ref", N::Many)], |c, a| {
            let sp = c.span(&a.s("ref"))?;
            j(sa::chapter_marks(&*c.study()?, &sp.book.code, sp.c1 as i64).map_err(e)?)
        }),
        cmd("mark add", "Draw a mark on a place: wb mark add John 3:16 --kind highlight|underline|circle|box|arrow --color yellow (or #rrggbb) [--lines 1|2|3, underline only] [--to PLACE, arrow only, in the same chapter]; or --style <legend entry> (its name, or its style kind:color[:lines]) instead of --kind, --color and --lines. Kept in marks/<BOOK>.json.",
            vec![Pos("place", N::One), Opt("kind", None), Opt("color", None), Opt("lines", None), Opt("to", None), Opt("style", None)], |c, a| {
                let mut lines = match a.opt("lines") {
                    Some(n) => Some(n.parse::<u8>().map_err(|_| "argument --lines: invalid int value")?),
                    None => None,
                };
                let (kind, color) = match a.opt("style") {
                    Some(st) => {
                        if a.opt("kind").is_some() || a.opt("color").is_some() || lines.is_some() {
                            return Err("--style gives the kind, color and lines: do not also say --kind, --color or --lines.".into());
                        }
                        let (k, col, l) = marks::legend_style(&*c.study()?, &st).map_err(e)?;
                        lines = l;
                        (k, col)
                    }
                    None => (
                        a.opt("kind").ok_or("Say the kind of mark: --kind highlight, underline, circle, box or arrow (or --style a legend entry).")?,
                        a.opt("color").ok_or("Say its color: --color yellow (or #rrggbb).")?,
                    ),
                };
                let at = anchor(c, &a.s("place"))?;
                let to = match a.opt("to") {
                    Some(t) => Some(anchor(c, &t)?),
                    None => None,
                };
                j(serde_json::to_value(marks::mark_add(c.bible()?, &*c.study()?, &at, &kind, &color, lines, to.as_deref()).map_err(e)?).unwrap())
            }),
        cmd("mark show", "One mark: its kind, color, lines, at, to, created and changed (and the words of an old highlight), and its legend name (or \"Unnamed <color> <kind>\").", vec![Pos("id", N::One)], |c, a| {
            j(marks::mark_show(&*c.study()?, &a.s("id")).map_err(e)?)
        }),
        cmd("mark at", "Every mark on a place (a verse, words, a phrase), old highlights too, topmost first: arrows, underlines, circle and box, highlight; newest first within each, each with its legend name. {\"place\", \"marks\"}.", vec![Pos("place", N::Many)], |c, a| {
            let at = anchor(c, &a.s("place"))?;
            j(marks::mark_at(&*c.study()?, &at).map_err(e)?)
        }),
        cmd("mark style", "Replace one mark's style: wb mark style <id> [--kind K] [--color C] [--lines 1|2|3]. Its id, place and date are kept; `changed` is set. An old highlight: color only.",
            vec![Pos("id", N::One), Opt("kind", None), Opt("color", None), Opt("lines", None)], |c, a| {
                let lines = match a.opt("lines") {
                    Some(n) => Some(n.parse::<u8>().map_err(|_| "argument --lines: invalid int value")?),
                    None => None,
                };
                let mut st = c.study()?;
                j(marks::mark_style(&mut st, &a.s("id"), a.opt("kind").as_deref(), a.opt("color").as_deref(), lines).map_err(e)?)
            }),
        cmd("mark rm", "Delete a mark (any id from wb marks, an old highlight too) or a margin note (its id from wb mark notes): it goes to .trash for 7 days; wb mark restore puts it back.", vec![Pos("id", N::Many)], |c, a| {
            let mut st = c.study()?;
            let mut done = vec![];
            for id in a.list("id") {
                // a margin note's id is a delete too (MK-21); any other id is a mark's
                let note = wb_core::margin::has(c.bible()?, &st, &id);
                done.push(if note { wb_core::margin::rm(c.bible()?, &mut st, &id) } else { marks::mark_rm(&mut st, &id) }.map_err(e)?);
            }
            j(if done.len() == 1 { done.remove(0) } else { json!({"deleted": done}) })
        }),
        cmd("mark restore", "Put a deleted mark or margin note back: wb mark restore <id>.", vec![Pos("id", N::Many)], |c, a| {
            let mut st = c.study()?;
            let mut done = vec![];
            for id in a.list("id") {
                let note = wb_core::margin::trashed_has(&st, &id);
                done.push(if note { wb_core::margin::restore(c.bible()?, &mut st, &id) } else { marks::mark_restore(&mut st, &id) }.map_err(e)?);
            }
            j(if done.len() == 1 { done.remove(0) } else { json!({"restored": done}) })
        }),
        cmd("mark note", "Write a margin note (text only, kept in margin/<BOOK>/<chapter>.md): wb mark note Num 25:11 \"words\"  |  wb mark note Num 25:10-13 \"words\" (a span of verses in one chapter)  |  wb mark note Num 25 \"words\" (the chapter). The words may be - to read standard input. With --text it rewrites a note's words and sets changed: wb mark note <id> --text \"new words\" (or --text -).",
            vec![Pos("args", N::Many), Opt("text", None)], |c, a| {
                let mut args = a.list("args");
                if let Some(t) = a.opt("text") {
                    let text = if t.trim() == "-" { c.stdin()? } else { t };
                    return j(wb_core::margin::edit(c.bible()?, &*c.study()?, &args.join(" "), &text).map_err(e)?);
                }
                if args.len() < 2 {
                    return Err("Give the place and the words: wb mark note Num 25:11 \"words\" (or wb mark note <id> --text \"words\").".into());
                }
                let words = args.pop().unwrap();
                let text = if words.trim() == "-" { c.stdin()? } else { words };
                j(wb_core::margin::add(c.bible()?, &*c.study()?, &args.join(" "), &text).map_err(e)?)
            }),
        cmd("mark notes", "A chapter's margin notes, the chapter's own first, then by verse: wb mark notes Num 25. {\"place\", \"count\", \"notes\"}; each has id, at, label, kind (chapter|verse|span), text, question, created, changed, grew (the pages it grew into). Reads one file and no page.",
            vec![Pos("chapter", N::Many)], |c, a| j(wb_core::margin::chapter(c.bible()?, &*c.study()?, &a.s("chapter")).map_err(e)?)),
        cmd("mark grow", "Grow a margin note into a page: wb mark grow <id> [--title T]. A new page holds the note's words, titled by its place; the note stays in the margin and gains a grew link to the page. {\"note\", \"page\", \"title\"}.",
            vec![Pos("id", N::One), Opt("title", None)], |c, a| {
                j(wb_core::margin::grow(c.bible()?, &mut *c.study()?, &a.s("id"), a.opt("title").as_deref()).map_err(e)?)
            }),
        cmd("legend", "The legend (settings/legend.json): its entries in order, each with its label (its name, or \"Unnamed <color> <kind>\"), style, quick pin, key and the count of marks in the style (old highlights too); \"unlisted\" are styles marks use that no entry names, shown as Unnamed. Name an entry by its name or by its style written kind:color[:lines] (highlight:yellow, underline:red:2).", vec![], |c, _| {
            j(marks::legend(&*c.study()?))
        }),
        cmd("legend add", "Add an entry: wb legend add --kind highlight|underline|circle|box|arrow --color yellow [--lines 1|2|3, underline only] [--name \"Promise\"] [--meaning \"...\"]. With no name it is Unnamed. The same style twice is refused.",
            vec![Opt("kind", None), Opt("color", None), Opt("lines", None), Opt("name", None), Opt("meaning", None)], |c, a| {
                let kind = a.opt("kind").ok_or("Say the kind: --kind highlight, underline, circle, box or arrow.")?;
                let color = a.opt("color").ok_or("Say its color: --color yellow (or #rrggbb).")?;
                let lines = match a.opt("lines") {
                    Some(n) => Some(n.parse::<u8>().map_err(|_| "argument --lines: invalid int value")?),
                    None => None,
                };
                j(marks::legend_add(&*c.study()?, &kind, &color, lines, a.opt("name").as_deref(), a.opt("meaning").as_deref()).map_err(e)?)
            }),
        cmd("legend set", "Change an entry (by its name, or its style kind:color[:lines]): wb legend set NAME [--name N] [--meaning M] [--color C --restyle | --no-restyle] [--quick on|off] [--key Ctrl+1..Ctrl+9 | none] [--move-key]. --restyle gives every mark in the old style the new color; --no-restyle changes the entry only (one is needed when marks use the style). At most 5 quick styles. A key already used is refused unless --move-key moves it here.",
            vec![Pos("entry", N::Many), Opt("name", None), Opt("meaning", None), Opt("color", None), Flag("restyle"), Flag("no_restyle"), Opt("quick", None), Opt("key", None), Flag("move_key")], |c, a| {
                let restyle = match (a.flag("restyle"), a.flag("no_restyle")) {
                    (true, true) => return Err("Say --restyle or --no-restyle, not both.".into()),
                    (true, false) => Some(true),
                    (false, true) => Some(false),
                    _ => None,
                };
                let quick = match a.opt("quick").map(|q| q.to_lowercase()).as_deref() {
                    None => None,
                    Some("on" | "true" | "yes") => Some(true),
                    Some("off" | "false" | "no") => Some(false),
                    Some(_) => return Err("--quick is on or off.".into()),
                };
                let (name, meaning, color, key) = (a.opt("name"), a.opt("meaning"), a.opt("color"), a.opt("key"));
                let ch = marks::LegendChange { name: name.as_deref(), meaning: meaning.as_deref(), color: color.as_deref(), restyle, quick, key: key.as_deref(), move_key: a.flag("move_key") };
                let mut st = c.study()?;
                j(marks::legend_set(&mut st, &a.s("entry"), &ch).map_err(e)?)
            }),
        cmd("legend move", "Move an entry in the order: wb legend move NAME --to 1 (1 is first). The quick styles follow the order. Prints the legend.", vec![Pos("entry", N::Many), Opt("to", None)], |c, a| {
            let to = a.opt("to").ok_or("Say the place: --to 1 (1 is first).")?.parse::<usize>().map_err(|_| "argument --to: invalid int value")?;
            j(marks::legend_move(&*c.study()?, &a.s("entry"), to).map_err(e)?)
        }),
        cmd("legend rm", "Remove an entry: wb legend rm NAME. Its marks stay, and then show as Unnamed.", vec![Pos("entry", N::Many)], |c, a| {
            j(marks::legend_rm(&*c.study()?, &a.s("entry")).map_err(e)?)
        }),
        cmd("palette", "Your saved custom colors (c1 .. c8).", vec![], |c, _| j(json!({"colors": c.study()?.palette()}))),
        cmd("palette rm", "Forget a saved color (highlights already made in it stay).", vec![Pos("color", N::One)], |c, a| {
            j(json!({"colors": c.study()?.drop_palette_color(Some(&a.s("color"))).map_err(e)?}))
        }),
        cmd("study check", "What the study folder holds, as this app reads it, and which files the next change would write (none). Reads only.",
            vec![], |c, _| {
                let st = c.study()?;
                let mut v = wb_core::check::study_check(&st).map_err(e)?;
                v["library"] = wb_core::check::library_check(c.bible()?, &st).map_err(e)?;
                j(v)
            }),
        cmd("thread list", "Your threads, newest first; with words, only those whose name or note has them all.", vec![Pos("words", N::Any)], |c, a| {
            j(sa::thread_list(&*c.study()?, Some(&a.s("words"))).map_err(e)?)
        }),
        cmd("thread show", "A thread: its note, every place with its text, and its original words.", vec![Pos("name", N::Many)], |c, a| {
            let st = c.study()?;
            j(sa::thread_view(c.bible()?, &st, &tid(&st, &a.s("name"))?).map_err(e)?)
        }),
        cmd("thread page", "A thread as a page (R1): its note as blocks, its places (each with its text), the pages written on it, and where it is in Pinned. Its page id is thread:<slug>, which wb page, wb block and wb note show take like any page's.",
            vec![Pos("name", N::Many)], |c, a| {
                let st = c.study()?;
                j(wb_core::threadpage::page(c.bible()?, &st, &tid(&st, &a.s("name"))?).map_err(e)?)
            }),
        cmd("thread pin", "Pin a thread's page (last in Pinned), or move it there: --after ID, --first. Its place is kept in settings/pages.json, not in the thread's file.",
            vec![Pos("name", N::Many), Opt("after", None), Flag("first")], |c, a| {
                let mut st = c.study()?;
                let id = wb_core::threadpage::page_id(&tid(&st, &a.s("name"))?);
                let after = a.opt("after");
                j(wb_core::pages::pin(c.bible()?, &mut st, &id, wb_core::pages::Place { after: after.as_deref(), first: a.flag("first") }).map_err(e)?)
            }),
        cmd("thread unpin", "Take a thread's page out of Pinned.", vec![Pos("name", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = wb_core::threadpage::page_id(&tid(&st, &a.s("name"))?);
            j(wb_core::pages::unpin(c.bible()?, &mut st, &id).map_err(e)?)
        }),
        cmd("thread new", "Start a thread, optionally with a note, a color and a first place.", vec![Pos("name", N::One), Opt("note", Some("")), Opt("color", None), Opt("at", None)], |c, a| {
            let at = match a.opt("at") {
                Some(p) => Some(anchor(c, &p)?),
                None => None,
            };
            j(sa::create_thread(c.bible()?, &mut *c.study()?, &a.s("name"), &a.opt_or("note", ""), a.opt("color").as_deref(), at.as_deref()).map_err(e)?)
        }),
        cmd("thread add", "Add a place to a thread (a new name starts the thread, like +name in the box).", vec![Pos("name", N::One), Pos("place", N::Many)], |c, a| {
            let an = anchor(c, &a.s("place"))?;
            let mut st = c.study()?;
            match thread(&st, &a.s("name")) {
                Ok(t) => j(sa::add_to_thread(c.bible()?, &mut st, t["id"].as_str().unwrap(), &an).map_err(e)?),
                Err(m) if m.starts_with("No thread") => j(sa::create_thread(c.bible()?, &mut st, &a.s("name"), "", None, Some(&an)).map_err(e)?),
                Err(m) => Err(m),
            }
        }),
        cmd("thread add-many", "Add several places to a thread in one write: wb thread add-many Phinehas \"Num 25:11\" \"Rom 10:2\" H7065. A new name starts the thread.",
            vec![Pos("name", N::One), Pos("places", N::Many)], |c, a| {
                let list: Vec<String> = a.list("places").iter().map(|p| anchor(c, p)).collect::<Result<_, _>>()?;
                add_places(c, &a.s("name"), list)
            }),
        cmd("thread from-search", "Put what a search finds into a thread, each verse whole: wb thread from-search Zeal zeal* --scope gospels [--only \"John 2:17\"]. A new name starts the thread.",
            result_args(vec![Pos("name", N::One), Pos("query", N::Many), Flag("case"), Flag("regex")]), from_search),
        cmd("thread from-uses", "Put the occurrences of a word into a thread, as the marked words, or --verses for whole verses: wb thread from-uses Zeal H7065 --word zealous --cat both.",
            result_args(vec![Pos("name", N::One), Pos("term", N::One), Opt("word", None), Opt("cat", Some("all")), Opt("rendering", None), Flag("verses")]), from_uses),
        cmd("thread move", "Move one place in a thread: wb thread move Phinehas \"Num 25:13\" up  |  wb thread move Phinehas 3 first.",
            vec![Pos("name", N::One), Pos("place", N::One), Pos("to", N::One)], |c, a| {
                let mut st = c.study()?;
                let id = tid(&st, &a.s("name"))?;
                let p = a.s("place");
                let place = if !p.is_empty() && p.chars().all(|x| x.is_ascii_digit()) { json!(p.parse::<i64>().unwrap()) } else { json!(anchor(c, &p)?) };
                let t = sa::move_in_thread(c.bible()?, &mut st, &id, &place, &a.s("to").to_lowercase()).map_err(e)?;
                j(json!({"thread": t["name"], "moved": t["moved"], "anchor": t["anchor"], "position": t["position"], "order": labels(&t)}))
            }),
        cmd("thread sort", "Put a thread in Bible order (original words like H7065 go last). Prints the old order, so wb thread order can put it back.", vec![Pos("name", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = tid(&st, &a.s("name"))?;
            let t = sa::sort_thread(c.bible()?, &mut st, &id).map_err(e)?;
            j(json!({"thread": t["name"], "changed": t["changed"], "before": t["before"], "order": labels(&t)}))
        }),
        cmd("thread order", "Set a thread's whole order: wb thread order Phinehas 3 1 2  (numbers from the list, or places; every place once).", vec![Pos("name", N::One), Pos("places", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = tid(&st, &a.s("name"))?;
            let members: Vec<String> = st.thread(&id).map_err(e)?["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect();
            let mut order = vec![];
            for p in a.list("places") {
                if !p.is_empty() && p.chars().all(|x| x.is_ascii_digit()) {
                    let k: usize = p.parse().unwrap_or(0);
                    if k < 1 || k > members.len() {
                        return Err(format!("The thread has {} places; there is no number {p}.", members.len()));
                    }
                    order.push(members[k - 1].clone());
                } else {
                    order.push(anchor(c, &p)?);
                }
            }
            st.order_thread(&id, &order).map_err(e)?;
            let v = sa::thread_view(c.bible()?, &st, &id).map_err(e)?;
            j(json!({"thread": v["name"], "order": labels(&v)}))
        }),
        cmd("thread rm", "Take what sits at a place (a verse, a run, or H7065) out of a thread.", vec![Pos("name", N::One), Pos("place", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = tid(&st, &a.s("name"))?;
            let an = anchor(c, &a.s("place"))?;
            j(sa::remove_place(c.bible()?, &mut st, &id, &an).map_err(e)?)
        }),
        cmd("thread edit", "Rename a thread, change its note or color (--color none clears it).", vec![Pos("name", N::One), Opt("rename", None), Opt("note", None), Opt("color", None)], |c, a| {
            let mut st = c.study()?;
            let id = tid(&st, &a.s("name"))?;
            let color = a.opt("color").map(|x| if x.eq_ignore_ascii_case("none") || x.is_empty() { None } else { Some(x) });
            st.update_thread(&id, a.opt("rename").as_deref(), a.opt("note").as_deref(), color.as_ref().map(|x| x.as_deref())).map_err(e)?;
            j(sa::thread_view(c.bible()?, &st, &id).map_err(e)?)
        }),
        cmd("thread delete", "Delete a thread (moved to .trash).", vec![Pos("name", N::One)], |c, a| {
            let mut st = c.study()?;
            let id = tid(&st, &a.s("name"))?;
            st.delete_thread(&id).map_err(e)?;
            j(json!({"ok": true}))
        }),
        cmd("set list", "Your sets, each with what it holds.", vec![], |c, _| j(sa::set_list(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("set show", "One set by name (a unique start or part of it works): its items and their keys.", vec![Pos("name", N::Many)], |c, a| {
            let st = c.study()?;
            j(sa::set_view(c.bible()?, &st, &st.find_set(&a.s("name")).map_err(e)?).map_err(e)?)
        }),
        cmd("set new", "Start a set, optionally with threads, places, notes, lessons and PDFs in it.", {
            let mut v = vec![Pos("name", N::One)];
            v.extend(set_items());
            v
        }, |c, a| {
            let mut st = c.study()?;
            let items = items_of(c, &st, a)?;
            let t = st.create_set(&a.s("name"), &items).map_err(e)?;
            j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("set add", "Put threads, places, notes, lessons or PDFs into a set.", {
            let mut v = vec![Pos("name", N::One)];
            v.extend(set_items());
            v
        }, |c, a| {
            let mut st = c.study()?;
            let items = items_of(c, &st, a)?;
            if items.is_empty() {
                return Err("Name something to add: --thread, --place, --note, --lesson, --pdf or --document.".into());
            }
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            let t = st.add_to_set(&id, &items).map_err(e)?;
            j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("set rm", "Take items out of a set by key (set show lists them). The things themselves are not touched.", vec![Pos("name", N::One), Pos("key", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            let t = st.remove_from_set(&id, &a.list("key")).map_err(e)?;
            j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("set rename", "Rename a set.", vec![Pos("name", N::One), Pos("to", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            let t = st.rename_set(&id, &a.s("to")).map_err(e)?;
            j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("set delete", "Delete a set (moved to .trash). What it pointed at is not touched.", vec![Pos("name", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            st.delete_set(&id).map_err(e)?;
            j(json!({"ok": true}))
        }),
        cmd("set open", "What Open all opens for a set, item by item: its target (open), or why not (why). Run in the window with wb do \"set open NAME\".", vec![Pos("name", N::Many)], |c, a| {
            let st = c.study()?;
            j(shelf::open_plan(c.bible()?, &st, &st.find_set(&a.s("name")).map_err(e)?).map_err(e)?)
        }),
        cmd("set move", "Move an item (by key, set show lists them) before another item of its set (--before KEY), or to the end.", vec![Pos("name", N::One), Pos("key", N::One), Opt("before", None)], |c, a| {
            let mut st = c.study()?;
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            let t = st.move_in_set(&id, &a.s("key"), a.opt("before").as_deref()).map_err(e)?;
            j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("shelf", "The Shelf as a tree: folders (each a set) with their items and the folders inside them.", vec![], |c, _| j(shelf::tree(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("shelf new", "A new folder (an empty set), at the top or --in a folder.", vec![Pos("name", N::Many), Opt("in", None)], |c, a| {
            let mut st = c.study()?;
            let parent = match a.opt("in") { Some(p) => s(&st.find_set(&p).map_err(e)?, "id"), None => String::new() };
            let t = shelf::new_folder(&mut st, &a.s("name"), &parent).map_err(e)?;
            j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
        }),
        cmd("shelf move", "Put a folder inside another (--in NAME) or at the top (no --in), before a folder there (--before NAME) or at the end.",
            vec![Pos("name", N::Many), Opt("in", None), Opt("before", None)], |c, a| {
            let mut st = c.study()?;
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            let parent = match a.opt("in") { Some(p) => s(&st.find_set(&p).map_err(e)?, "id"), None => String::new() };
            let before = match a.opt("before") { Some(b) => Some(s(&st.find_set(&b).map_err(e)?, "id")), None => None };
            shelf::move_folder(&mut st, &id, &parent, before.as_deref()).map_err(e)?;
            j(shelf::tree(c.bible()?, &st).map_err(e)?)
        }),
        cmd("shelf rm", "Remove a folder (its set goes to .trash; what it pointed at is not touched); the folders inside it move up a level.", vec![Pos("name", N::Many)], |c, a| {
            let mut st = c.study()?;
            let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            shelf::remove_folder(&mut st, &id).map_err(e)?;
            j(json!({"ok": true}))
        }),
        cmd("shelf item", "Move an item (by key) into another folder (--to NAME), before an item there (--before KEY); --copy keeps it in both.",
            vec![Pos("name", N::One), Pos("key", N::One), Opt("to", None), Opt("before", None), Flag("copy")], |c, a| {
            let mut st = c.study()?;
            let from = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
            let to = match a.opt("to") { Some(t) => s(&st.find_set(&t).map_err(e)?, "id"), None => from.clone() };
            j(shelf::move_item(&mut st, &from, &a.s("key"), &to, a.opt("before").as_deref(), a.flag("copy")).map_err(e)?)
        }),
        cmd("trail add", "Queue a question under a place.", vec![Pos("place", N::One), Pos("text", N::Many)], |c, a| {
            let an = anchor(c, &a.s("place"))?;
            j(sa::save_trail(c.bible()?, &mut *c.study()?, &an, &a.s("text")).map_err(e)?)
        }),
        cmd("trail list", "The questions you have queued; --at a place: the questions on it and on any part of it (\"here\": on this very place).",
            vec![Opt("status", Some("open")), Opt("at", None)], |c, a| {
            let st = a.opt_or("status", "open");
            if !["open", "done", "all"].contains(&st.as_str()) {
                return Err(format!("wb trail list: argument --status: invalid choice: '{st}' (choose from 'open', 'done', 'all')"));
            }
            if let Some(at) = a.opt("at") {
                let at = anchor(c, &at)?;
                return j(sa::trail_at(c.bible()?, &*c.study()?, &at, &st).map_err(e)?);
            }
            j(sa::trail_list(c.bible()?, &*c.study()?, &st).map_err(e)?)
        }),
        cmd("trail done", "Mark a question done (trail reopen undoes it).", vec![Pos("id", N::One)], |c, a| {
            c.study()?.set_trail_status(&a.s("id"), "done").map_err(e)?;
            j(json!({"ok": true}))
        }),
        cmd("trail reopen", "Mark a question open again.", vec![Pos("id", N::One)], |c, a| {
            c.study()?.set_trail_status(&a.s("id"), "open").map_err(e)?;
            j(json!({"ok": true}))
        }),
        cmd("trail edit", "Change a question's text.", vec![Pos("id", N::One), Pos("text", N::Many)], |c, a| {
            c.study()?.update_trail(&a.s("id"), &a.s("text")).map_err(e)?;
            j(json!({"ok": true}))
        }),
        cmd("trail rm", "Delete a question page with timed Undo.", vec![Pos("id", N::One)], |c, a| {
            let mut st = c.study()?;
            let id = a.s("id");
            if !st.trails().into_iter().any(|t| s(t, "id") == id) {
                return Err("No such trail.".into());
            }
            j(wb_core::deletion::remove(c.bible()?, &mut st, &id).map_err(e)?)
        }),
        cmd("find", "Search your own notes, thread names and notes, and trails. With --kind, --folder, --has-question, --edited or --sort it is the library's one search: pages, folders, saves and questions grouped by kind, \"count\" of \"total\". --kind page|folder|save|question|margin, --folder NAME, --has-question, --edited 7d|2026-11-01, --sort edited|title.",
            vec![Pos("words", N::Any), Opt("kind", None), Opt("folder", None), Flag("has_question"), Opt("edited", None), Opt("sort", None)], |c, a| {
            let (kind, folder, edited, sort) = (a.opt("kind"), a.opt("folder"), a.opt("edited"), a.opt("sort"));
            if kind.is_some() || folder.is_some() || edited.is_some() || sort.is_some() || a.flag("has_question") {
                let f = wb_core::library::Find { words: &a.s("words"), kind: kind.as_deref().unwrap_or(""), folder: folder.as_deref(), has_question: a.flag("has_question"),
                    edited: edited.as_deref(), sort: sort.as_deref().unwrap_or("") };
                return j(wb_core::library::find(c.bible()?, &*c.study()?, &f).map_err(e)?);
            }
            if a.s("words").trim().is_empty() {
                return Err("Type a word or two to look for in your notes.".into());
            }
            j(sa::find_mine(c.bible()?, &*c.study()?, &a.s("words")).map_err(e)?)
        }),
        cmd("log", "What was typed into the capture box on a day (default today); log add records a line.", vec![Pos("day", N::Opt)], |c, a| {
            let d = a.s("day");
            j(c.study()?.log_day(if d.is_empty() { None } else { Some(&d) }).map_err(e)?)
        }),
        cmd("log add", "Record a line in today's log.", vec![Pos("text", N::Many), Opt("result", Some(""))], |c, a| {
            j(c.study()?.log_event(&a.s("text"), &a.opt_or("result", "")).map_err(e)?)
        }),
        cmd("layout list", "Saved pane arrangements.", vec![], |c, _| j(json!(c.study()?.layouts()))),
        cmd("layout show", "One saved arrangement (the JSON).", vec![Pos("name", N::One)], |c, a| j(c.study()?.layout(&a.s("name")).map_err(e)?)),
        cmd("layout save", "Keep an arrangement of panes under a name, from a JSON file (the window saves its own in phase 2): wb layout save Study --file layout.json.",
            vec![Pos("name", N::One), Opt("file", None)], |c, a| {
                let text = body_text(c, "-", a.opt("file"))?;
                let layout: Value = serde_json::from_str(&text).map_err(|_| "The layout must be a JSON object.")?;
                j(c.study()?.save_layout(&a.s("name"), &layout).map_err(e)?)
            }),
        cmd("layout rm", "Delete a saved layout (its file waits in .trash): wb layout rm Study.", vec![Pos("name", N::Many)], |c, a| j(c.study()?.delete_layout(&a.s("name")).map_err(e)?)),
        cmd("lesson list", "Your lessons (study-folder/lessons/*.md).", vec![], |c, _| j(json!(sa::lesson_listing(&*c.study()?).map_err(e)?))),
        cmd("lesson show", "A lesson's file text.", vec![Pos("name", N::Many)], |c, a| {
            let r = sa::lesson_read(&*c.study()?, &a.s("name")).map_err(e)?;
            if a.flag("json") {
                return j(r);
            }
            Ok(Out::Text(r["text"].as_str().unwrap().to_string()))
        }),
        cmd("lesson save", "Write a lesson from standard input or --file (replaces it; --append adds to the end).",
            vec![Pos("name", N::One), Opt("file", None), Flag("append"), Pos("text", N::Any)], |c, a| {
                let words = if a.has("text") { a.s("text") } else { "-".into() };
                let text = body_text(c, &words, a.opt("file"))?;
                j(sa::lesson_save(&*c.study()?, &a.s("name"), &text, a.flag("append")).map_err(e)?)
            }),
        cmd("lesson rm", "Delete a lesson (moved to .trash).", vec![Pos("name", N::One)], |c, a| j(sa::lesson_delete(&*c.study()?, &a.s("name")).map_err(e)?)),
        cmd("lesson check", "Read a lesson the way a build would: its scriptures and slide count, or the first line that cannot be read.", vec![Pos("name", N::Many)], |c, a| {
            j(sa::lesson_check(c.bible()?, &*c.study()?, &a.s("name")).map_err(e)?)
        }),
    ]
}

fn labels(t: &Value) -> Vec<Value> {
    t["members"].as_array().unwrap().iter().map(|m| m["label"].clone()).collect()
}

/// Places into the thread with this name, in one write (a new name starts the thread).
fn add_places(c: &Ctx<'_>, name: &str, list: Vec<String>) -> Res {
    let mut st = c.study()?;
    let id = match thread(&st, name) {
        Ok(t) => t["id"].as_str().unwrap().to_string(),
        Err(m) if m.starts_with("No thread") => sa::create_thread(c.bible()?, &mut st, name, "", None, None).map_err(e)?["id"].as_str().unwrap().to_string(),
        Err(m) => return Err(m),
    };
    j(sa::add_many_to_thread(c.bible()?, &mut st, &id, &list).map_err(e)?)
}

fn items_of(c: &Ctx<'_>, st: &Store, a: &Args) -> Result<Vec<Value>, String> {
    let mut items = vec![];
    for n in a.list("thread") {
        items.push(json!({"kind": "thread", "ref": tid(st, &n)?}));
    }
    for p in a.list("place") {
        items.push(json!({"kind": "place", "ref": anchor(c, &p)?}));
    }
    for n in a.list("note") {
        items.push(json!({"kind": "note", "ref": n}));
    }
    for n in a.list("lesson") {
        items.push(json!({"kind": "lesson", "ref": sa::lesson_find(st, &n).map_err(e)?}));
    }
    for n in a.list("pdf") {
        items.push(json!({"kind": "pdf", "ref": n}));
    }
    for k in a.list("tab") {
        // a tab of the window, as its pane key and title (its key, a tab, its title): wb set add NAME --tab "strong|H7065<TAB>H7065"
        let (key, title) = k.split_once('\t').unwrap_or((k.as_str(), ""));
        let mut item = shelf::item_from_key(c.bible()?, key, title).map_err(e)?;
        if item["kind"] == "thread" {
            item["ref"] = json!(tid(st, item["ref"].as_str().unwrap_or(""))?);
        } else if item["kind"] == "lesson" {
            item["ref"] = json!(sa::lesson_find(st, item["ref"].as_str().unwrap_or("")).map_err(e)?);
        }
        items.push(item);
    }
    for n in a.list("document") {
        items.push(json!({"kind": "document", "ref": shelf::document_id(st, &n).map_err(e)?}));
    }
    Ok(items)
}

/// Every page of a search or occurrences list, refused early when it could not all go into a thread.
fn every_row(page: &dyn Fn(usize) -> Result<Value, String>) -> Result<Vec<Value>, String> {
    let (mut rows, mut offset) = (vec![], 0);
    loop {
        let d = page(offset)?;
        if d["verses"].as_u64().unwrap_or(0) as usize > sa::MAX_ADD {
            return Err(format!("That is {} verses, and {} places is the most at once. Limit it with --scope, or pick some with --only.", d["verses"], sa::MAX_ADD));
        }
        let got = d["rows"].as_array().unwrap();
        offset += got.len();
        rows.extend(got.iter().cloned());
        if d["more"] != true {
            return Ok(rows);
        }
    }
}

/// The rows inside the places named (--only), and an error for a place that holds none of them.
fn picked(c: &Ctx<'_>, rows: Vec<Value>, only: Option<String>) -> Result<Vec<Value>, String> {
    let Some(only) = only.filter(|o| !o.is_empty()) else { return Ok(rows) };
    let mut keep: Vec<Value> = vec![];
    for part in only.split(';') {
        let sp = c.span(part)?;
        let hits: Vec<&Value> = rows
            .iter()
            .filter(|r| {
                let (rc, rv) = (r["ref"]["c"].as_u64().unwrap() as u32, r["ref"]["v"].as_u64().unwrap() as u32);
                r["ref"]["code"] == sp.book.code.as_str() && (sp.c1, sp.v1) <= (rc, rv) && (rc, rv) <= (sp.c2, if sp.v2 == 0 { 1_000_000 } else { sp.v2 })
            })
            .collect();
        if hits.is_empty() {
            return Err(format!("{} is not in these results.", part.trim()));
        }
        for h in hits {
            if !keep.contains(h) {
                keep.push(h.clone());
            }
        }
    }
    Ok(keep)
}

fn verse_anchor(r: &Value) -> String {
    format!("{}.{}:{}", r["ref"]["code"].as_str().unwrap(), r["ref"]["c"], r["ref"]["v"])
}

fn results_out(c: &Ctx<'_>, a: &Args, places: Vec<String>) -> Res {
    if a.flag("dry_run") {
        return j(json!({"thread": a.s("name"), "would_add": places}));
    }
    add_places(c, &a.s("name"), places)
}

fn from_search(c: &Ctx<'_>, a: &Args) -> Res {
    let scope = c.scope(&a.opt_or("scope", "all"))?;
    let q = a.s("query");
    let b = c.bible()?;
    let rows = every_row(&|offset| {
        lookup::search(b, &lookup::SearchQuery { q: &q, case: a.flag("case"), scope: &scope, offset, limit: lookup::PAGE, regex: a.flag("regex") }).map_err(e)
    })?;
    let places = picked(c, rows, a.opt("only"))?.iter().map(verse_anchor).collect();
    results_out(c, a, places)
}

fn from_uses(c: &Ctx<'_>, a: &Args) -> Res {
    let term = a.s("term");
    let strong = if lookup::is_strong(&term.to_uppercase()) { term.to_uppercase() } else { String::new() };
    let word = a.opt("word").unwrap_or_else(|| if strong.is_empty() { term.to_lowercase() } else { String::new() });
    let scope = c.scope(&a.opt_or("scope", "all"))?;
    let cat = a.opt_or("cat", "all");
    if !["all", "both", "s", "e"].contains(&cat.as_str()) {
        return Err(format!("wb thread from-uses: argument --cat: invalid choice: '{cat}' (choose from 'all', 'both', 's', 'e')"));
    }
    let rendering = a.opt("rendering").unwrap_or_default();
    let some = |x: &str| if x.is_empty() { None } else { Some(x.to_string()) };
    let (st, wd, rd) = (some(&strong), some(&word), some(&rendering));
    let b = c.bible()?;
    let rows = every_row(&|offset| {
        lookup::uses(b, &lookup::UsesQuery { strong: st.as_deref(), word: wd.as_deref(), cat: &cat, scope: &scope, offset, limit: lookup::PAGE, rendering: rd.as_deref() }).map_err(e)
    })?;
    let rows = picked(c, rows, a.opt("only"))?;
    let places = if a.flag("verses") {
        rows.iter().map(verse_anchor).collect()
    } else {
        rows.iter().flat_map(|r| r["runs"].as_array().unwrap().iter().map(|x| x["anchor"].as_str().unwrap().to_string()).collect::<Vec<_>>()).collect()
    };
    results_out(c, a, places)
}
