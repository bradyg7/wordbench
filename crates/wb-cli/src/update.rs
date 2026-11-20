//! `wb update`: what the app knows about a newer version, and a look for one (design/features/updates, UP1-UP2).
//! The window's Updates section and its dot read the same state, through these commands.

use crate::args::Args;
use crate::{cmd, Command, Ctx, Out, Res};
use wb_core::updates::{self, Look, Updates};

pub fn commands() -> Vec<Command> {
    vec![
        cmd(
            "update status",
            "The installed version, whether this copy updates itself, the setting, when it last looked, and a newer version it knows of. Reads only; makes no request.",
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

