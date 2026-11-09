//! `wb commands`: the command lines the person keeps (settings/commands.json) and the ones used most (from the day's logs).
//! Running one needs the window (the fill-ins come from what is selected): `wb do "<its line>"` runs the line itself.

use crate::args::{Flag, Opt, Pos, N};
use crate::{cmd, Command, Out};
use serde_json::json;
use wb_core::mycommands as mc;

fn e(x: wb_core::Error) -> String {
    x.0
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("commands", "The commands you keep (a name, the line as typed in the command field, an optional icon and key). {word}, {place} and {chapter} in a line take what is selected.",
            vec![Flag("top")], |c, a| {
                let st = c.study()?;
                if a.flag("top") {
                    return Ok(Out::Json(json!(mc::top(&st, 10, true))));
                }
                Ok(Out::Json(json!(mc::list(&st))))
            }),
        cmd("commands add", "Keep a command: wb commands add \"uses of a word\" \"uses {word}\" --key Ctrl+U --icon search. The same name changes it.",
            vec![Pos("name", N::One), Pos("line", N::Many), Opt("key", Some("")), Opt("icon", Some(""))], |c, a| {
                let mut st = c.study()?;
                Ok(Out::Json(mc::add(&mut st, &a.s("name"), &a.s("line"), &a.opt_or("key", ""), &a.opt_or("icon", "")).map_err(e)?))
            }),
        cmd("commands rm", "Stop keeping a command: wb commands rm \"uses of a word\".", vec![Pos("name", N::Many)], |c, a| {
            let mut st = c.study()?;
            Ok(Out::Json(mc::remove(&mut st, &a.s("name")).map_err(e)?))
        }),
        cmd("commands fill", "A kept command's line with its fill-ins given: wb commands fill \"uses of a word\" --word zealous --place \"Num 25:11\".",
            vec![Pos("name", N::Many), Opt("word", Some("")), Opt("place", Some("")), Opt("chapter", Some(""))], |c, a| {
                let st = c.study()?;
                let id = a.s("name");
                let it = mc::list(&st).into_iter().find(|i| i["name"].as_str().map(|n| n.eq_ignore_ascii_case(&id)).unwrap_or(false)).ok_or("No kept command by that name.")?;
                let line = mc::fill(it["line"].as_str().unwrap_or(""), &a.opt_or("word", ""), &a.opt_or("place", ""), &a.opt_or("chapter", "")).map_err(e)?;
                Ok(Out::Json(json!({"line": line})))
            }),
    ]
}
