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
        .join(format!(
            "{}-{}",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));
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
    let Some((bible, mut store, _dir)) = scratch() else {
        return;
    };
    let ctx = Ctx::lent(&bible, &mut store);
    let held = ctx.study().unwrap();
    assert_eq!(ctx.root().unwrap(), held.root);
}

/// The side list and Recents answer in the window, with what the Notebook draws: a page opened is in Recents.
#[test]
fn the_side_list_and_recents_answer_in_the_window() {
    let Some((bible, mut store, _dir)) = scratch() else {
        return;
    };
    let ctx = Ctx::lent(&bible, &mut store);
    let page =
        run(&ctx, &["page", "new", "A page for the side list"]).expect("page new in the window");
    let id = page["json"]["id"].as_str().expect("a page id").to_string();
    run(
        &ctx,
        &[
            "history",
            "add",
            "page",
            "A page for the side list",
            "--line",
            &format!("page {id}"),
        ],
    )
    .expect("history add in the window");
    let side = run(&ctx, &["notebook", "sidebar", "--at", "NUM 25"])
        .expect("notebook sidebar in the window");
    for key in ["recents", "pinned", "pages"] {
        assert!(
            side["json"][key].is_array(),
            "the side list has {key}: {side}"
        );
    }
    assert!(
        side["json"]["recents"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["id"] == id.as_str()),
        "the page opened is in Recents: {side}"
    );
    let recents = run(&ctx, &["page", "recents"]).expect("page recents in the window");
    assert!(
        recents["json"]["recents"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["id"] == id.as_str()),
        "page recents: {recents}"
    );
}

/// Commands the sweep does not run, each with its reason. A key is one whole command name, never a first word: a new
/// `docs <something>` is not excluded until someone adds it here on purpose. A command that is neither swept nor listed
/// here fails `every_command_is_run_the_windows_way_or_excluded`, naming it; so does a key that matches no command.
/// The document commands are swept (with `WB_DOCS_DIR` and the study folder in a temp folder, `WB_NO_OPEN=1`).
const EXCLUDED: &[(&str, &str)] = &[
    ("do", "sends its line to a running window and waits for it to answer"),
    ("copy", "puts text on the system clipboard (no --no_clip in the sweep's arguments)"),
    ("update status", "reads the installed app's update state in the app-data folder, not the scratch study"),
    ("update check", "asks the network for a newer version"),
    ("update install", "downloads and installs a new version"),
    ("update back", "swaps the installed app for the version before"),
    ("update stop", "stops the installed app's download"),
    ("update notes", "reads the update state in the app-data folder and the network's release notes"),
    ("update skip", "writes the installed app's update setting in the app-data folder"),
];

fn excluded(name: &str) -> bool {
    EXCLUDED.iter().any(|(k, _)| *k == name)
}

struct Sweep {
    tried: usize,
    reached: Vec<&'static str>,
    stuck: Vec<&'static str>,
    busy: Vec<String>,
}

/// Runs every command not excluded, in the window's way (a lent Bible and store), with the argument sets below in turn
/// until one gets past its arguments, so its body runs: none, a page's id, a reference, an English word, a Strong's
/// number, and pairs and triples of them (a book, chapter and verse; a page's block number and its new value). Done once; both tests below read it.
fn sweep() -> &'static Option<Sweep> {
    static SWEEP: std::sync::OnceLock<Option<Sweep>> = std::sync::OnceLock::new();
    SWEEP.get_or_init(|| {
        let (bible, mut store, dir) = scratch()?;
        // documents go to a temp folder beside the scratch study, and nothing is opened on the screen
        let docs = dir.0.join("documents-out");
        std::fs::create_dir_all(&docs).unwrap();
        std::env::set_var("WB_DOCS_DIR", &docs);
        std::env::set_var("WB_NO_OPEN", "1");
        let id = {
            let ctx = Ctx::lent(&bible, &mut store);
            let p = run(&ctx, &["page", "new", "Swept page"]).expect("page new");
            run(
                &ctx,
                &["note", "new", "A note on a verse", "--at", "Num 25:11"],
            )
            .expect("note new");
            run(
                &ctx,
                &["thread", "new", "Swept folder", "--at", "Num 25:12"],
            )
            .expect("thread new");
            p["json"]["id"].as_str().unwrap().to_string()
        };
        let sets: Vec<Vec<&str>> = vec![
            vec![],
            vec![&id],
            vec!["Num 25:11"],
            vec!["zeal"],
            vec!["H7065"],
            vec!["swept-folder"],
            vec![&id, "1"],
            vec![&id, "Num 25:11"],
            vec![&id, "words"],
            vec!["Num 25:11", "words"],
            vec!["swept-folder", "Num 25:11"],
            vec!["NUM", "25", "11"],
            vec!["NUM", "25", "11", "0"],
            vec!["swept-folder", "Num 25:12", "up"],
            vec![&id, "1", "swept-folder"],
            vec![&id, "1", "H7065"],
            vec![&id, "1", "Num 25:11"],
            vec![&id, "1", "yellow"],
        ];
        let mut out = Sweep {
            tried: 0,
            reached: vec![],
            stuck: vec![],
            busy: vec![],
        };
        for (name, _) in names() {
            if excluded(name) {
                continue;
            }
            out.tried += 1;
            let mut reached = false;
            for set in &sets {
                let mut argv: Vec<String> = name.split(' ').map(String::from).collect();
                argv.extend(set.iter().map(|s| s.to_string()));
                let ctx = Ctx::lent(&bible, &mut store);
                match wb_cli::run(&ctx, &argv) {
                    Err(wb_cli::Fail::Usage(_)) => continue,
                    Err(wb_cli::Fail::Error(e)) if e == wb_cli::BUSY => {
                        out.busy.push(format!("wb {}", argv.join(" ")))
                    }
                    _ => {}
                }
                reached = true;
                break;
            }
            if reached {
                out.reached.push(name)
            } else {
                out.stuck.push(name)
            }
        }
        Some(out)
    })
}

/// The whole class: no command, run in the window as the window runs it, is refused because the store is already held.
/// A body that is reached and answers BUSY fails the test.
#[test]
fn no_command_finds_the_study_folder_busy_in_the_window() {
    let Some(s) = sweep() else { return };
    eprintln!(
        "SWEEP reached {} of {}; stuck {:?}",
        s.reached.len(),
        s.tried,
        s.stuck
    );
    assert!(
        s.busy.is_empty(),
        "refused in the window only:\n{}",
        s.busy.join("\n")
    );
}

/// Every command in the `wb` table is run the window's way by the sweep above, or is in EXCLUDED with a reason. A new
/// command that is neither fails here, named. The table is read from `names()`; "run" is what the sweep reached.
#[test]
fn every_command_is_run_the_windows_way_or_excluded() {
    let Some(s) = sweep() else { return };
    let table = names();
    let unaccounted: Vec<&str> = table
        .iter()
        .map(|(n, _)| *n)
        .filter(|n| !excluded(n) && !s.reached.contains(n))
        .collect();
    assert!(
        unaccounted.is_empty(),
        "these commands are neither run by the sweep (no argument set got past their arguments) nor in EXCLUDED with a reason: {unaccounted:?}"
    );
    for (key, reason) in EXCLUDED {
        assert!(!reason.is_empty(), "{key} is excluded without a reason");
        assert!(
            table.iter().any(|(n, _)| n == key),
            "EXCLUDED names {key}, which is no command in the table"
        );
    }
    assert!(s.tried > 200, "the sweep ran only {} commands", s.tried);
}
