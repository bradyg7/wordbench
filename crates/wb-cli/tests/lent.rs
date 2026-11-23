//! The window runs the command table in-process, on a Bible and a store it lends (`Ctx::lent`). A command that holds the
//! store and asks for the study folder's path must work there as it does in a terminal (0.3.0: `notebook sidebar` and
//! `page recents` answered "the study folder is busy" in the window only, so the Notebook's side list never drew).

use wb_cli::{names, run_value, Ctx};
use wb_core::{bible::Bible, store::Store};

/// A scratch study folder of its own, removed when the test is done.
struct Scratch(std::path::PathBuf);
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn scratch() -> Option<(Bible, Store, Scratch)> {
    if !wb_core::default_db_path().exists() {
        wb_core::bible_database_missing_in_test();
        return None;
    }
    static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let dir = std::env::temp_dir()
        .join("bible-workbench-rs")
        .join("lent-tests")
        .join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let bible = Bible::open(&wb_core::default_db_path()).unwrap();
    let store = Store::open(&dir).unwrap();
    Some((bible, store, Scratch(dir)))
}

fn run(ctx: &Ctx<'_>, argv: &[&str]) -> Result<serde_json::Value, String> {
    run_value(ctx, &argv.iter().map(|s| s.to_string()).collect::<Vec<_>>())
}

/// The contract itself: while a command holds the store, the folder's path is still there.
#[test]
fn the_folder_path_is_there_while_the_store_is_held() {
    let Some((bible, mut store, _dir)) = scratch() else { return };
    let ctx = Ctx::lent(&bible, &mut store);
    let held = ctx.study().unwrap();
    assert_eq!(ctx.root().unwrap(), held.root);
}

/// The side list and Recents answer in the window, with what the Notebook draws: a page opened is in Recents.
#[test]
fn the_side_list_and_recents_answer_in_the_window() {
    let Some((bible, mut store, _dir)) = scratch() else { return };
    let ctx = Ctx::lent(&bible, &mut store);
    let page = run(&ctx, &["page", "new", "A page for the side list"]).expect("page new in the window");
    let id = page["json"]["id"].as_str().expect("a page id").to_string();
    run(&ctx, &["history", "add", "page", "A page for the side list", "--line", &format!("page {id}")]).expect("history add in the window");
    let side = run(&ctx, &["notebook", "sidebar", "--at", "NUM 25"]).expect("notebook sidebar in the window");
    for key in ["recents", "pinned", "pages"] {
        assert!(side["json"][key].is_array(), "the side list has {key}: {side}");
    }
    assert!(side["json"]["recents"].as_array().unwrap().iter().any(|r| r["id"] == id.as_str()), "the page opened is in Recents: {side}");
    let recents = run(&ctx, &["page", "recents"]).expect("page recents in the window");
    assert!(recents["json"]["recents"].as_array().unwrap().iter().any(|r| r["id"] == id.as_str()), "page recents: {recents}");
}

/// The whole class: no command, run in the window as the window runs it, is refused because the store is already held.
/// Each command is run with no arguments (most stop at their missing argument; those that need none run whole). Commands
/// that reach outside the scratch folder (documents, updates, setup, the relay, opening files) are left out.
#[test]
fn no_command_finds_the_study_folder_busy_in_the_window() {
    let Some((bible, mut store, _dir)) = scratch() else { return };
    let outside = ["do", "docs", "update", "setup", "pdf", "pdfs", "craft", "packet", "lesson", "fixture", "manual", "guide"];
    let mut busy = vec![];
    let mut ran = 0;
    for (name, _) in names() {
        let first = name.split(' ').next().unwrap_or(name);
        if outside.contains(&first) || name.contains("open") || name.contains("reveal") {
            continue;
        }
        let ctx = Ctx::lent(&bible, &mut store);
        ran += 1;
        if let Err(e) = run(&ctx, &name.split(' ').collect::<Vec<_>>()) {
            if e.contains("busy") {
                busy.push(format!("wb {name}: {e}"));
            }
        }
    }
    assert!(ran > 200, "the sweep ran {ran} commands");
    assert!(busy.is_empty(), "refused in the window only:\n{}", busy.join("\n"));
}
