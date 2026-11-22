//! The library (design/features/library): Save and the folders. `wb save` is K and the picker; `wb folder …` is the
//! `wb shelf` folder commands under the library's name (as `wb page` is `wb note`). The model is in `wb_core::library`.

use crate::args::{Append, Flag, Opt, Pos, N};
use crate::{cmd, Command, Out, Res};
use serde_json::{json, Value};
use wb_core::folders as fo;
use wb_core::library as lib;
use wb_core::store::s;
use wb_core::{shelf, studyapi as sa};

fn e(x: wb_core::Error) -> String {
    x.0
}

fn j(v: Value) -> Res {
    Ok(Out::Json(v))
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("save", "Save a thing (K): wb save Num 25:11 --folder Phinehas --folder \"Word study\". A thing is a place or phrase (Num 25:11, NUM.25:11.4, H7065), page:<id>, search:\"words\", document:<name> or sitting:<id|last>. With no --folder it goes on the Shelf; with folders it is in each and off the Shelf. Saving again changes nothing. Prints where it is saved.",
            vec![Pos("thing", N::Many), Append("folder")], |c, a| j(lib::save(c.bible()?, &mut *c.study()?, &a.s("thing"), &a.list("folder")).map_err(e)?)),
        cmd("save rm", "Take a save out of one folder (--folder NAME; it goes to the Shelf if that was its last), or with no --folder unsave it everywhere. The thing and its tab are not touched. wb save rm Num 25:11 --folder Phinehas.",
            vec![Pos("thing", N::Many), Opt("folder", None)], |c, a| j(lib::unsave(c.bible()?, &mut *c.study()?, &a.s("thing"), a.opt("folder").as_deref()).map_err(e)?)),
        cmd("save where", "Where a thing is saved: its folders and whether it is on the Shelf (what hovering the mark shows).",
            vec![Pos("thing", N::Many)], |c, a| j(lib::where_saved(c.bible()?, &*c.study()?, &a.s("thing")).map_err(e)?)),
        cmd("shelf saves", "The Shelf: the saves in no folder, as a folder shows its items.", vec![], |c, _| j(lib::shelf_view(c.bible()?, &*c.study()?).map_err(e)?)),
        cmd("folder list", "Every folder, flat, in tree order: id, name, parent (\"\" at the top), depth, how many items and folders it holds.",
            vec![], |c, _| j(lib::folder_list(&*c.study()?))),
        cmd("folder new", "A new folder, at the top or --in a folder (wb shelf new under the library's name). It holds pages and saves; one thing may sit in several.",
            vec![Pos("name", N::Many), Opt("in", None)], |c, a| {
                let mut st = c.study()?;
                let parent = match a.opt("in") { Some(p) => s(&st.find_set(&p).map_err(e)?, "id"), None => String::new() };
                let t = shelf::new_folder(&mut st, &a.s("name"), &parent).map_err(e)?;
                j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
            }),
        cmd("folder show", "A folder opened: its saves (a thread file's places, in the file's order) and its pages (a thread file's note is one page, thread:<slug>), with its color and eye. --kind Verse|Word|Page and --book Numbers (or --filter \"Save is Verse\" / \"Book is Numbers\", repeatable) narrow the saves and say how many there were (`total`), with `kinds` and `books` counted. Writes nothing.",
            vec![Pos("name", N::Many), Opt("kind", None), Opt("book", None), Append("filter")], |c, a| {
                let name = fo::find_folder(&*c.study()?, &a.s("name")).map_err(e)?.key;
                let mut filters = wb_core::pageviews::filters_of(&a.list("filter"), None, a.opt("book").as_deref()).map_err(e)?;
                if let Some(k) = a.opt("kind").filter(|k| !k.trim().is_empty()) {
                    wb_core::filters::put(&mut filters, wb_core::filters::Filter { property: "Save".into(), way: wb_core::filters::Way::Is, values: vec![k.trim().to_string()] });
                }
                if filters.is_empty() { return j(fo::folder_view(c.bible()?, &*c.study()?, &name).map_err(e)?); }
                j(fo::folder_view_filtered(c.bible()?, &*c.study()?, &name, &filters).map_err(e)?)
            }),
        cmd("folder color", "Give a folder a color, or take it off: wb folder color Phinehas yellow  |  wb folder color Phinehas none. A color is a name (yellow, green, blue, pink, orange) or #rrggbb. A folder with a color is what a thread was: its saved places are underlined in the text while its eye is on.",
            vec![Pos("folder", N::One), Pos("color", N::One)], |c, a| j(fo::folder_color(&mut *c.study()?, &a.s("folder"), &a.s("color")).map_err(e)?)),
        cmd("folder shown", "The eyes: which folders with a color the text shows. wb folder shown (list, shown first)  |  wb folder shown Phinehas on|off  |  --none (Hide all; prints was_shown)  |  --all  |  --restore KEY ... (exactly those shown; what Undo of Hide all does).",
            vec![Pos("folder", N::Any), Flag("none"), Flag("all"), Append("restore")], |c, a| {
                let mut words = a.list("folder");
                let state = words.last().map(|w| w.to_lowercase()).filter(|w| w == "on" || w == "off");
                if state.is_some() {
                    words.pop();
                }
                let mut st = c.study()?;
                if a.flag("none") {
                    return j(fo::folder_shown_all(&mut st, "none", &[]).map_err(e)?);
                }
                if a.flag("all") {
                    return j(fo::folder_shown_all(&mut st, "all", &[]).map_err(e)?);
                }
                if !a.list("restore").is_empty() {
                    return j(fo::folder_shown_all(&mut st, "restore", &a.list("restore")).map_err(e)?);
                }
                match (words.is_empty(), state) {
                    (true, _) => j(fo::eyes(&st)),
                    (false, Some(on)) => j(fo::folder_shown(&mut st, &words.join(" "), on == "on").map_err(e)?),
                    (false, None) => Err("Say on or off: wb folder shown Phinehas on.".to_string()),
                }
            }),
        cmd("folder rename", "Rename a folder: wb folder rename \"Word study\" \"Hebrew words\".",
            vec![Pos("name", N::One), Pos("to", N::Many)], |c, a| {
                let mut st = c.study()?;
                let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
                let t = st.rename_set(&id, &a.s("to")).map_err(e)?;
                j(sa::set_view(c.bible()?, &st, &t).map_err(e)?)
            }),
        cmd("folder move", "Put a folder inside another (--in NAME) or at the top (no --in), before a folder there (--before NAME) or at the end. Where it sits is its file's parent field.",
            vec![Pos("name", N::Many), Opt("in", None), Opt("before", None)], |c, a| {
                let mut st = c.study()?;
                let id = s(&st.find_set(&a.s("name")).map_err(e)?, "id");
                let parent = match a.opt("in") { Some(p) => s(&st.find_set(&p).map_err(e)?, "id"), None => String::new() };
                let before = match a.opt("before") { Some(b) => Some(s(&st.find_set(&b).map_err(e)?, "id")), None => None };
                shelf::move_folder(&mut st, &id, &parent, before.as_deref()).map_err(e)?;
                j(lib::folder_list(&st))
            }),
        cmd("folder rm", "Remove a folder: its file goes to .trash and the folders inside it move up a level. What it held is not touched; a save that was only in it goes on the Shelf (pages stay in Pages).",
            vec![Pos("name", N::Many)], |c, a| {
                let mut st = c.study()?;
                let t = st.find_set(&a.s("name")).map_err(e)?;
                let id = s(&t, "id");
                let others: std::collections::HashSet<String> = st.sets().iter().filter(|o| s(o, "id") != id).flat_map(|o| o["items"].as_array().cloned().unwrap_or_default()).map(|i| format!("{}|{}", i["kind"], i["ref"])).collect();
                let lone: Vec<Value> = t["items"].as_array().cloned().unwrap_or_default().into_iter()
                    .filter(|i| i["kind"] != "note" && (i["kind"] == "pane" || !others.contains(&format!("{}|{}", i["kind"], i["ref"]))))
                    .map(|mut i| {
                        if let Some(o) = i.as_object_mut() { o.shift_remove("key"); }
                        i
                    })
                    .collect();
                st.shelf_add(&lone).map_err(e)?;
                shelf::remove_folder(&mut st, &id).map_err(e)?;
                j(json!({"ok": true, "to_the_shelf": lone.len()}))
            }),
    ]
}
