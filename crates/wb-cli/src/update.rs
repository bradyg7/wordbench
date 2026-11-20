//! `wb update`: what the app knows about a newer version, and a look for one (design/features/updates, UP1-UP2).
//! The window's Updates section and its dot read the same state, through these commands.

use crate::args::{Args, Spec::*, N};
use crate::{cmd, Command, Ctx, Out, Res};
use wb_core::updates::{self, Look, Updates};

pub fn commands() -> Vec<Command> {
    vec![
        cmd(
            "update status",
            "The installed version, whether this copy updates itself, the setting, when it last looked, a newer version it knows of. Reads only; makes no request.",
            vec![],
            |_, _| Ok(Out::Json(Updates::here().status())),
        ),
        cmd(
            "update check",
            "Look for a newer version now: prints it (version, size, date), or that this is the newest. Exit 1 when it could not look.",
            vec![],
            |_, _| {
                let answer = Updates::here().check_now()?;
                Ok(Out::Text(updates::answer_line(&answer)))
            },
        ),
        cmd(
            "update notes",
            "What changed, under Moved or removed, New, Changed, Fixed and Your study folder: for every release newer than this one (the newest in full, the older folded), or for one version (the one running reads offline). --json: the same as data.",
            vec![Pos("version", N::Opt), Flag("json")],
            |_, a| {
                let u = Updates::here();
                let v = a.s("version");
                let v = Some(v.as_str());
                if a.flag("json") {
                    Ok(Out::Json(u.notes_json(v)?))
                } else {
                    Ok(Out::Text(u.notes_text(v)?))
                }
            },
        ),
        cmd(
            "update skip",
            "Not this version: set the newer version (or the one named) aside, so the dot goes; it stays listed with Install, and a newer one brings the dot back. --clear undoes it.",
            vec![Pos("version", N::Opt), Flag("clear")],
            |_, a| {
                let u = Updates::here();
                Ok(Out::Text(if a.flag("clear") { u.unskip()? } else { u.skip(Some(a.s("version").as_str()))? }))
            },
        ),
    ]
}

/// `wb settings updates [open|ask]`: prints or sets "Look for updates" (U-3).
pub fn settings(_: &Ctx<'_>, a: &Args) -> Res {
    let u = Updates::here();
    let word = a.s("key");
    if !word.is_empty() {
        let look = Look::parse(&word).ok_or("Say open (when the app opens) or ask (only when I ask): wb settings updates open|ask")?;
        u.set_look(look)?;
    }
    Ok(Out::Json(serde_json::json!({ "look": u.look().word() })))
}

