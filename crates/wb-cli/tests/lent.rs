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
/// Each command is tried with the argument sets below in turn until one gets past its arguments, so its body runs: none, a
/// page's id, a reference, an English word, a Strong's number, and pairs of them. A body that is reached and answers BUSY
/// fails the test; so does a sweep that reaches too few bodies.
///
/// Not swept, because they reach outside the scratch folder: `do` (the relay to a running window), `docs`, `pdf`, `pdfs`,
/// `craft`, `packet`, `lesson` (they write documents), `update` (downloads), `setup` (the app's own settings), `fixture`,
/// `manual`, `guide`, `copy` (the clipboard) and any command that opens or reveals a file in another program.
#[test]
fn no_command_finds_the_study_folder_busy_in_the_window() {
    let Some((bible, mut store, _dir)) = scratch() else { return };
    let id = {
        let ctx = Ctx::lent(&bible, &mut store);
        let p = run(&ctx, &["page", "new", "Swept page"]).expect("page new");
        run(&ctx, &["note", "new", "A note on a verse", "--at", "Num 25:11"]).expect("note new");
        run(&ctx, &["thread", "new", "Swept folder", "--at", "Num 25:12"]).expect("thread new");
        p["json"]["id"].as_str().unwrap().to_string()
    };
    let outside = ["do", "docs", "update", "setup", "pdf", "pdfs", "craft", "packet", "lesson", "fixture", "manual", "guide", "copy"];
    let sets: Vec<Vec<&str>> = vec![
        vec![], vec![&id], vec!["Num 25:11"], vec!["zeal"], vec!["H7065"], vec!["swept-folder"],
        vec![&id, "1"], vec![&id, "Num 25:11"], vec![&id, "words"], vec!["Num 25:11", "words"], vec!["swept-folder", "Num 25:11"],
    ];
    let (mut busy, mut tried, mut bodies, mut stuck) = (vec![], 0, 0, vec![]);
    for (name, _) in names() {
        let first = name.split(' ').next().unwrap_or(name);
        if outside.contains(&first) || name.contains("open") || name.contains("reveal") {
            continue;
        }
        tried += 1;
        let mut reached = false;
        for set in &sets {
            let mut argv: Vec<String> = name.split(' ').map(String::from).collect();
            argv.extend(set.iter().map(|s| s.to_string()));
            let ctx = Ctx::lent(&bible, &mut store);
            match wb_cli::run(&ctx, &argv) {
                Err(wb_cli::Fail::Usage(_)) => continue,
                Err(wb_cli::Fail::Error(e)) if e == wb_cli::BUSY => busy.push(format!("wb {}", argv.join(" "))),
                _ => {}
            }
            reached = true;
            break;
        }
        if reached { bodies += 1 } else { stuck.push(name) }
    }
    eprintln!("SWEEP reached {bodies} of {tried}; stuck {stuck:?}"); assert!(busy.is_empty(), "refused in the window only:\n{}", busy.join("\n"));
    // most commands' bodies ran; those whose arguments none of the sets fit are listed when too many are left
    assert!(tried > 200 && bodies * 10 >= tried * 8, "the sweep reached {bodies} of {tried} commands' bodies; not reached: {stuck:?}");
}
