//! The library (design/features/library): Save and the folders. `wb save` is K and the picker; `wb folder …` is the
//! `wb shelf` folder commands under the library's name (as `wb page` is `wb note`). The model is in `wb_core::library`.

use crate::args::{Append, Opt, Pos, N};
use crate::{cmd, Command, Out, Res};
use serde_json::{json, Value};
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
