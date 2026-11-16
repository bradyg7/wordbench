//! `wb setup`: where the Bible database and the study folder are, and choosing them.
//!
//! The same choices the window's setup screen makes, so a terminal (or an AI) can set up a copy of Bible Workbench
//! without the window (CLAUDE.md: every core action is reachable from `wb`).

use crate::args::{Args, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::json;
use std::fs;
use std::path::PathBuf;

pub fn commands() -> Vec<Command> {
    vec![cmd(
        "setup",
        "Where the Bible database and the study folder are; choose them with `wb setup study <folder>` and `wb setup database <file>`.",
        vec![Pos("what", N::Any)],
        run,
    )]
}

fn run(_: &Ctx<'_>, a: &Args) -> Res {
    let args = a.list("what");
    match args.first().map(String::as_str).unwrap_or("") {
        "" => {}
        "study" => {
            let folder = args[1..].join(" ");
            if folder.trim().is_empty() {
                return Err("Name the folder: wb setup study \"%USERPROFILE%\\Documents\\Bible Workbench\"".into());
            }
            let path = PathBuf::from(folder.trim());
            fs::create_dir_all(&path).map_err(|e| format!("The folder could not be made ({}): {e}", path.display()))?;
            wb_core::store::Store::open(&path).map_err(|e| e.0)?;
            wb_core::setup::set_setting("study_dir", &path.to_string_lossy()).map_err(|e| e.0)?;
        }
        "database" => {
            let file = args[1..].join(" ");
            if file.trim().is_empty() {
                return Err("Name the file: wb setup database \"C:\\path\\to\\workbench.db\"".into());
            }
            let path = PathBuf::from(file.trim());
            wb_core::bible::Bible::open(&path).map_err(|e| e.0)?;
            wb_core::setup::set_setting("bible_db", &path.to_string_lossy()).map_err(|e| e.0)?;
        }
        other => return Err(format!("wb setup takes nothing, or `study <folder>`, or `database <file>` (not “{other}”).")),
    }
    Ok(Out::Json(status()))
}

fn status() -> serde_json::Value {
    let db = wb_core::default_db_path();
    let configured = wb_core::setup::study_configured();
    // Before a folder is chosen, report the one the setup screen offers, not the development scratch copy.
    let study = if configured { wb_core::default_study_dir() } else { wb_core::setup::suggested_study_dir() };
    let store = wb_core::store::Store::open(&study);
    json!({
        "bible": {
            "path": db.display().to_string(),
            "found": db.is_file(),
            "opened": wb_core::bible::Bible::open(&db).is_ok(),
            "candidates": wb_core::setup::db_candidates().iter().map(|p| p.display().to_string()).collect::<Vec<_>>(),
        },
        "study": {
            "path": study.display().to_string(),
            "configured": configured,
            "available": store.is_ok(),
            "error": store.as_ref().err().map(|e| e.0.clone()),
        },
        "suggested_study": wb_core::setup::suggested_study_dir().display().to_string(),
        "settings": wb_core::setup::settings_path().display().to_string(),
    })
}
