//! `wb update`: what the app knows about a newer version, and a look for one (design/features/updates, UP1-UP2).
//! The window's Updates section and its dot read the same state, through these commands.

use crate::args::{Args, Spec::*, N};
use crate::{cmd, Command, Ctx, Out, Res};
use wb_core::updates::{self, Look, Updates};

pub fn commands() -> Vec<Command> {
    vec![
        cmd(
            "update status",
            "The installed version, whether this copy updates itself, the setting, when it last looked, a newer version it knows of, a download and how far it has come, and the last failure. Reads only; makes no request. --seen: the Updates section has been opened, so a failure's dot goes.",
            vec![Flag("seen")],
            |_, a| {
                let u = Updates::here();
                if a.flag("seen") {
                    u.mark_seen();
                }
                Ok(Out::Json(u.status()))
            },
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
            "update install",
            "Install the newer version: download it, check its signature, and install it. With the window open it asks the window to save every page and restart (--when-closed: to install when the window is closed); with no window open it installs at once. A file whose signature does not match, that is not newer, or whose address is not HTTPS is thrown away.",
            vec![Flag("when_closed"), Opt("wait", Some("900"))],
            |_, a| {
                let u = Updates::here();
                let when_closed = a.flag("when_closed");
                let wait: f64 = a.opt_or("wait", "900").parse().map_err(|_| "argument --wait: a number of seconds")?;
                let line = if when_closed { "update install --when-closed" } else { "update install" };
                match wb_core::relay::send(line, std::time::Duration::from_secs_f64(wait.max(0.1))) {
                    Ok(r) if r["ok"] == false => Err(r["error"].as_str().unwrap_or("the window refused it").to_string()),
                    Ok(r) => Ok(Out::Text(r["said"].as_str().unwrap_or("done").to_string())),
                    // no window: install at once
                    Err(e) if e.to_string().starts_with("The app is not running") => Ok(Out::Text(u.install_now(false)?)),
                    Err(e) => Err(e.to_string()),
                }
            },
        ),
        cmd(
            "update back",
            "Put back the version before the last update (kept beside the app, not downloaded again; program files only). With the window open it asks the window to save every page and restart. Refuses, saying why, when none is kept or the notes say the study folder's form was moved.",
            vec![Opt("wait", Some("120"))],
            |_, a| {
                let u = Updates::here();
                u.back_offer()?;
                let wait: f64 = a.opt_or("wait", "120").parse().map_err(|_| "argument --wait: a number of seconds")?;
                match wb_core::relay::send("update back", std::time::Duration::from_secs_f64(wait.max(0.1))) {
                    Ok(r) if r["ok"] == false => Err(r["error"].as_str().unwrap_or("the window refused it").to_string()),
                    Ok(r) => Ok(Out::Text(r["said"].as_str().unwrap_or("done").to_string())),
                    Err(e) if e.to_string().starts_with("The app is not running") => Ok(Out::Text(u.go_back()?)),
                    Err(e) => Err(e.to_string()),
                }
            },
        ),
        cmd(
            "update stop",
            "Give up a download, or a restart that is waiting: the downloaded file is removed and the dot returns.",
            vec![],
            |_, _| Ok(Out::Text(Updates::here().stop()?)),
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
        let look = Look::parse(&word).ok_or(
            "Say open (when the app opens) or ask (only when I ask): wb settings updates open|ask",
        )?;
        u.set_look(look)?;
    }
    Ok(Out::Json(serde_json::json!({ "look": u.look().word() })))
}
