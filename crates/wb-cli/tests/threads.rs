//! Threads (design/features/threads, "What the build must satisfy"): a thread is a folder with a color. Each test runs
//! `wb` on a generated scratch study (never the real folder). References only; no scripture is typed here.

use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

struct Wb {
    dir: PathBuf,
}

impl Wb {
    fn new() -> Option<Wb> {
        if !wb_core::default_db_path().exists() {
            wb_core::bible_database_missing_in_test();
            return None;
        }
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let dir = std::env::temp_dir().join("bible-workbench-rs").join("threads-tests").join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Some(Wb { dir })
    }
    fn run(&self, args: &[&str]) -> (i32, String, String) {
        let out = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(args)
            .env("WB_STUDY_DIR", &self.dir)
            .env_remove("WB_DOCS_DIR")
            .env("WB_NO_OPEN", "1")
            .stdin(Stdio::null())
            .output()
            .unwrap();
        (out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).into(), String::from_utf8_lossy(&out.stderr).into())
    }
    fn ok(&self, args: &[&str]) -> String {
        let (code, out, err) = self.run(args);
        assert_eq!(code, 0, "wb {args:?}: {err}");
        out
    }
    fn js(&self, args: &[&str]) -> Value {
        serde_json::from_str(&self.ok(args)).unwrap_or_else(|e| panic!("wb {args:?}: {e}"))
    }
    fn fails(&self, args: &[&str]) -> String {
        let (code, out, err) = self.run(args);
        assert_ne!(code, 0, "wb {args:?} should fail: {out}");
        err + &out
    }
    /// Every file of the study folder with its bytes, to compare before and after.
    fn snapshot(&self) -> BTreeMap<String, Vec<u8>> {
        fn walk(root: &Path, d: &Path, out: &mut BTreeMap<String, Vec<u8>>) {
            for e in std::fs::read_dir(d).into_iter().flatten().flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(root, &p, out);
                } else {
                    out.insert(p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/"), std::fs::read(&p).unwrap());
                }
            }
        }
        let mut m = BTreeMap::new();
        walk(&self.dir, &self.dir, &mut m);
        m
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn places(n: usize) -> Vec<String> {
    (1..=n).map(|v| format!("Ps 119:{v}")).collect()
}

/// A thread "Phinehas" with a color, a note and 56 places.
fn phinehas(w: &Wb) {
    w.ok(&["thread", "new", "Phinehas", "--note", "My own note on it.", "--color", "yellow"]);
    let ps = places(56);
    let mut args: Vec<&str> = vec!["thread", "add-many", "Phinehas"];
    args.extend(ps.iter().map(String::as_str));
    w.ok(&args);
}

fn folder_named<'a>(list: &'a Value, name: &str) -> &'a Value {
    list.as_array().unwrap().iter().find(|f| f["name"] == name).unwrap_or_else(|| panic!("no folder {name} in {list}"))
}

#[test]
fn a_thread_file_is_read_as_a_folder_and_nothing_is_written() {
    let Some(w) = Wb::new() else { return };
    phinehas(&w);
    let before = w.snapshot();
    let list = w.js(&["folder", "list"]);
    let f = folder_named(&list, "Phinehas");
    assert_eq!(f["color"], "yellow");
    assert_eq!(f["items"], 56);
    assert_eq!(f["kind"], "thread");
    assert_eq!(f["shown"], true);
    let v = w.js(&["folder", "show", "Phinehas"]);
    let items = v["items"].as_array().unwrap();
    assert_eq!(items.len(), 56);
    assert_eq!(v["count"], 56);
    for (n, i) in items.iter().enumerate() {
        assert_eq!(i["kind"], "place");
        assert!(i["label"].as_str().unwrap().ends_with(&format!("119:{}", n + 1)), "order: {}", i["label"]);
    }
    assert_eq!(v["pages"].as_array().unwrap().len(), 1);
    assert_eq!(v["pages"][0]["id"], "thread:phinehas");
    w.js(&["shelf"]);
    w.ok(&["folder", "shown"]);
    assert_eq!(before, w.snapshot(), "opening a thread as a folder wrote a file");
}

#[test]
fn the_shelf_lists_thread_files_as_folders_with_their_color() {
    let Some(w) = Wb::new() else { return };
    phinehas(&w);
    w.ok(&["folder", "new", "Word study"]);
    let tree = w.js(&["shelf"]);
    let t = &tree["thread_folders"][0];
    assert_eq!((t["name"].as_str(), t["color"].as_str(), t["items"].as_i64()), (Some("Phinehas"), Some("yellow"), Some(56)));
    assert_eq!(tree["folders"].as_array().unwrap().len(), 1, "a thread file is not a set");
}

#[test]
fn folder_color_works_on_sets_and_thread_files() {
    let Some(w) = Wb::new() else { return };
    phinehas(&w);
    w.ok(&["folder", "new", "Zeal"]);
    let z = w.js(&["folder", "color", "Zeal", "blue"]);
    assert_eq!((z["color"].as_str(), z["kind"].as_str()), (Some("blue"), Some("folder")));
    assert!(std::fs::read_to_string(w.dir.join("sets/zeal.md")).unwrap().contains("color: \"blue\""));
    assert_eq!(folder_named(&w.js(&["folder", "list"]), "Zeal")["color"], "blue");
    let p = w.js(&["folder", "color", "Phinehas", "green"]);
    assert_eq!(p["color"], "green");
    assert_eq!(w.js(&["thread", "show", "Phinehas"])["color"], "green");
    w.js(&["folder", "color", "Zeal", "none"]);
    assert!(!std::fs::read_to_string(w.dir.join("sets/zeal.md")).unwrap().contains("color"));
    w.fails(&["folder", "color", "Zeal", "purple"]);
    w.fails(&["folder", "shown", "Zeal", "off"]); // no color, no eye
}

#[test]
fn the_eyes_are_kept_in_settings_and_hide_all_is_one_action_with_an_undo() {
    let Some(w) = Wb::new() else { return };
    phinehas(&w);
    w.ok(&["folder", "new", "Zeal"]);
    w.ok(&["folder", "color", "Zeal", "blue"]);
    let thread_file = std::fs::read(w.dir.join("threads/phinehas.md")).unwrap();
    w.ok(&["folder", "shown", "Zeal", "off"]);
    let eyes = w.js(&["folder", "shown"]);
    assert_eq!(eyes[0]["name"], "Phinehas", "shown ones first");
    assert_eq!(eyes[1]["shown"], false);
    assert!(std::fs::read_to_string(w.dir.join("settings/folders.json")).unwrap().contains("zeal"));
    // "after the app restarts": every wb run is a fresh process
    assert_eq!(folder_named(&w.js(&["folder", "list"]), "Zeal")["shown"], false);
    w.ok(&["folder", "shown", "Zeal", "on"]);
    let hide = w.js(&["folder", "shown", "--none"]);
    let was: Vec<String> = hide["was_shown"].as_array().unwrap().iter().map(|k| k.as_str().unwrap().to_string()).collect();
    assert_eq!(was.len(), 2);
    assert!(w.js(&["folder", "shown"]).as_array().unwrap().iter().all(|f| f["shown"] == false));
    let mut undo = vec!["folder", "shown"];
    for k in &was {
        undo.extend(["--restore", k.as_str()]);
    }
    w.ok(&undo);
    assert!(w.js(&["folder", "shown"]).as_array().unwrap().iter().all(|f| f["shown"] == true));
    w.ok(&["folder", "shown", "--none"]);
    w.ok(&["folder", "shown", "--all"]);
    assert!(w.js(&["folder", "shown"]).as_array().unwrap().iter().all(|f| f["shown"] == true));
    assert_eq!(thread_file, std::fs::read(w.dir.join("threads/phinehas.md")).unwrap(), "an eye never touches the thread's file");
}

#[test]
fn a_saved_place_in_a_colored_folder_is_drawn_and_an_eye_off_hides_it() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["folder", "new", "Zeal"]);
    w.ok(&["folder", "color", "Zeal", "pink"]);
    w.ok(&["save", "Num 25:12", "--folder", "Zeal"]);
    w.ok(&["folder", "new", "Plain"]);
    w.ok(&["save", "Num 25:13", "--folder", "Plain"]);
    let m = w.js(&["marks", "Num 25"]);
    let t = m["threads"].as_array().unwrap();
    assert_eq!(t.len(), 1, "only the folder with a color draws: {m}");
    assert_eq!((t[0]["thread"].as_str(), t[0]["color"].as_str()), (Some("folder:zeal"), Some("pink")));
    assert_eq!(m["hidden"].as_array().unwrap().len(), 0);
    w.ok(&["folder", "shown", "Zeal", "off"]);
    let m = w.js(&["marks", "Num 25"]);
    assert_eq!(m["hidden"][0], "folder:zeal");
    w.ok(&["folder", "shown", "Zeal", "on"]);
    w.ok(&["save", "rm", "Num 25:12", "--folder", "Zeal"]);
    assert_eq!(w.js(&["marks", "Num 25"])["threads"].as_array().unwrap().len(), 0);
}

#[test]
fn a_page_saved_in_a_colored_folder_draws_nothing() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["folder", "new", "Zeal"]);
    w.ok(&["folder", "color", "Zeal", "pink"]);
    let id = w.js(&["page", "new", "A page of mine"])["id"].as_str().unwrap().to_string();
    w.ok(&["save", &format!("page:{id}"), "--folder", "Zeal"]);
    assert_eq!(w.js(&["marks", "Num 25"])["threads"].as_array().unwrap().len(), 0);
    assert_eq!(w.js(&["folder", "show", "Zeal"])["pages"].as_array().unwrap().len(), 1);
}

#[test]
fn moving_a_place_changes_the_folders_order_as_wb_thread_move_does() {
    let Some(w) = Wb::new() else { return };
    phinehas(&w);
    let marks_before = w.js(&["marks", "Ps 119"])["threads"].clone();
    w.ok(&["thread", "move", "Phinehas", "Ps 119:3", "first"]);
    let v = w.js(&["folder", "show", "Phinehas"]);
    assert!(v["items"][0]["label"].as_str().unwrap().ends_with("119:3"));
    assert!(v["items"][1]["label"].as_str().unwrap().ends_with("119:1"));
    let mut a = marks_before.as_array().unwrap().clone();
    let mut b = w.js(&["marks", "Ps 119"])["threads"].as_array().unwrap().clone();
    a.sort_by_key(|x| x.to_string());
    b.sort_by_key(|x| x.to_string());
    assert_eq!(a, b, "the line on the text does not change with the order");
}

#[test]
fn thread_commands_keep_their_contracts() {
    let Some(w) = Wb::new() else { return };
    phinehas(&w);
    let list = w.js(&["thread", "list"]);
    assert_eq!(list[0]["name"], "Phinehas");
    assert_eq!(w.js(&["thread", "page", "Phinehas"])["id"], "thread:phinehas");
    let err = w.fails(&["folder", "show", "No such thing"]);
    assert!(err.contains("No folder"));
}

#[test]
fn a_thread_fence_shows_the_folders_saves() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["folder", "new", "Zeal"]);
    w.ok(&["folder", "color", "Zeal", "blue"]);
    w.ok(&["save", "Num 25:12", "--folder", "Zeal"]);
    w.ok(&["save", "Num 25:13", "--folder", "Zeal"]);
    phinehas(&w);
    let id = w.js(&["page", "new", "Fences"])["id"].as_str().unwrap().to_string();
    w.ok(&["block", "add", &id, "```thread\nzeal\n```"]);
    w.ok(&["block", "add", &id, "```thread\nphinehas\n```"]);
    let v = w.js(&["page", "threads", &id]);
    let b = v["blocks"].as_array().unwrap();
    assert_eq!(b.len(), 2, "{v}");
    assert_eq!((b[0]["name"].as_str(), b[0]["count"].as_i64(), b[0]["color"].as_str()), (Some("Zeal"), Some(2), Some("blue")));
    assert_eq!((b[1]["name"].as_str(), b[1]["count"].as_i64()), (Some("Phinehas"), Some(56)));
}
