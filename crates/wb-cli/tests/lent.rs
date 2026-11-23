//! The window runs the command table in-process, on a Bible and a store it lends (`Ctx::lent`). A command that holds the
//! store and asks for the study folder's path must work there as it does in a terminal (0.3.0: `notebook sidebar` and
//! `page recents` answered "the study folder is busy" in the window only, so the Notebook's side list never drew).

use wb_cli::{run_value, Ctx};

fn lent_run(argv: &[&str]) -> Option<Result<serde_json::Value, String>> {
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
    let bible = wb_core::bible::Bible::open(&wb_core::default_db_path()).unwrap();
    let mut store = wb_core::store::Store::open(&dir).unwrap();
    let ctx = Ctx::lent(&bible, &mut store);
    let argv: Vec<String> = argv.iter().map(|s| s.to_string()).collect();
    Some(run_value(&ctx, &argv))
}

#[test]
fn the_side_list_and_recents_answer_in_the_window() {
    for argv in [
        &["notebook", "sidebar"][..],
        &["notebook", "sidebar", "--at", "NUM 25"][..],
        &["page", "recents"][..],
        &["history", "list"][..],
        &["history", "add", "page", "A page", "--line", "page n_x"][..],
        &["page", "tree"][..],
        &["question", "list", "--kind", "all"][..],
        &["notebook", "--group", "none"][..],
        &["find", "season"][..],
    ] {
        let Some(r) = lent_run(argv) else { return };
        assert!(r.is_ok(), "wb {} in the window: {:?}", argv.join(" "), r.err());
    }
}
