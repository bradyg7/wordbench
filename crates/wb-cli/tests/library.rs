//! The library (design/features/library, "What the build must satisfy"): Save and the folders in set files, a saved
//! sitting, the page's own view choices, the one search. Each test runs `wb` on a generated scratch study.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::{Command, Stdio};

struct Wb {
    dir: PathBuf,
}

impl Wb {
    fn new() -> Option<Wb> {
        if !wb_core::default_db_path().exists() {
            eprintln!("no Bible database: skipped");
            return None;
        }
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let dir = std::env::temp_dir().join("bible-workbench-rs").join("library-tests").join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
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
        assert_eq!(code, 1, "wb {args:?} should fail: {out}");
        err + &out
    }
    fn page(&self, text: &str) -> String {
        self.js(&["page", "new", text])["id"].as_str().unwrap().to_string()
    }
    /// The one page file holding some text.
    fn file_with(&self, text: &str) -> PathBuf {
        fn walk(d: &std::path::Path, text: &str) -> Option<PathBuf> {
            for e in std::fs::read_dir(d).ok()?.flatten() {
                let p = e.path();
                if p.is_dir() {
                    if let Some(f) = walk(&p, text) {
                        return Some(f);
                    }
                } else if std::fs::read_to_string(&p).unwrap_or_default().contains(text) {
                    return Some(p);
                }
            }
            None
        }
        walk(&self.dir.join("notes"), text).unwrap_or_else(|| panic!("no page file holds {text}"))
    }
    fn names(v: &Value) -> Vec<String> {
        v["folders"].as_array().unwrap().iter().map(|f| f["name"].as_str().unwrap().to_string()).collect()
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

#[test]
fn save_goes_to_the_shelf_then_into_folders_and_back() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["folder", "new", "Phinehas"]);
    wb.js(&["folder", "new", "Word study"]);
    let w = wb.js(&["save", "Num 25:11"]);
    assert_eq!((w["saved"].clone(), w["shelf"].clone()), (json!(true), json!(true)));
    // two folders by ticking: in both, off the Shelf
    let w = wb.js(&["save", "Num 25:11", "--folder", "Phinehas", "--folder", "Word study"]);
    assert_eq!((w["shelf"].clone(), w["folders"].as_array().unwrap().len()), (json!(false), 2));
    assert_eq!(wb.js(&["shelf", "saves"])["items"].as_array().unwrap().len(), 0);
    // saving it again changes nothing
    assert_eq!(wb.js(&["save", "Num 25:11", "--folder", "Phinehas"])["folders"].as_array().unwrap().len(), 2);
    // out of one folder: still saved in the other; out of the last: back on the Shelf, not lost
    let w = wb.js(&["save", "rm", "Num 25:11", "--folder", "Phinehas"]);
    assert_eq!((w["folders"].as_array().unwrap().len(), w["shelf"].clone()), (1, json!(false)));
    let w = wb.js(&["save", "rm", "Num 25:11", "--folder", "Word study"]);
    assert_eq!((w["saved"].clone(), w["shelf"].clone()), (json!(true), json!(true)));
    // unsave everywhere
    let w = wb.js(&["save", "rm", "Num 25:11"]);
    assert_eq!(w["saved"], json!(false));
    assert!(wb.fails(&["save", "rm", "Num 25:11"]).contains("not saved"));
    // a thing named wrongly is refused before anything is written
    assert!(wb.fails(&["save", "page:nope"]).contains("No note"));
    assert!(wb.fails(&["save", "Num 25:11", "--folder", "Nowhere"]).contains("No set"));
}

#[test]
fn every_kind_of_thing_can_be_saved() {
    let Some(wb) = Wb::new() else { return };
    let id = wb.page("A page to keep");
    for thing in [format!("page:{id}"), "H7065".to_string(), "NUM.25:11.4".to_string(), "search:\"zeal\"".to_string(), "Num 25".to_string()] {
        let w = wb.js(&["save", &thing]);
        assert_eq!(w["shelf"], json!(true), "{thing}");
    }
    let shelf = wb.js(&["shelf", "saves"]);
    let kinds: Vec<&str> = shelf["items"].as_array().unwrap().iter().map(|i| i["kind"].as_str().unwrap()).collect();
    assert_eq!(kinds, ["note", "place", "place", "pane", "place"]);
    // a saved page shows its title, not its id
    assert_eq!(shelf["items"][0]["label"], json!("A page to keep"));
    assert_eq!(shelf["items"][0]["gone"], json!(false));
}

#[test]
fn folders_nest_in_their_own_file_and_pages_do_not_move() {
    let Some(wb) = Wb::new() else { return };
    let id = wb.page("Sermon notes");
    let page_file = wb.file_with("Sermon notes");
    let before = std::fs::read(&page_file).unwrap();
    wb.js(&["folder", "new", "Sermons"]);
    wb.js(&["folder", "new", "2026", "--in", "Sermons"]);
    wb.js(&["folder", "new", "Series"]);
    // the page sits in two folders; its file is where it was, and unchanged
    wb.js(&["save", &format!("page:{id}"), "--folder", "2026", "--folder", "Series"]);
    assert_eq!(wb.file_with("Sermon notes"), page_file);
    assert_eq!(std::fs::read(&page_file).unwrap(), before);
    let set = |slug: &str| std::fs::read_to_string(wb.dir.join("sets").join(format!("{slug}.md"))).unwrap();
    assert!(set("2026").contains("parent: \"sermons\""), "{}", set("2026"));
    assert!(!set("sermons").contains("parent:"));
    assert!(set("2026").contains(&id) && set("series").contains(&id));
    // the tree reads the field, and a folder moved to the top loses it
    let list = wb.js(&["folder", "list"]);
    let row = |l: &Value, n: &str| l.as_array().unwrap().iter().find(|f| f["name"] == n).unwrap().clone();
    assert_eq!((row(&list, "2026")["parent"].clone(), row(&list, "2026")["depth"].clone()), (json!("sermons"), json!(1)));
    wb.js(&["folder", "move", "2026"]);
    assert!(!set("2026").contains("parent:"));
    wb.js(&["folder", "move", "2026", "--in", "Series"]);
    assert!(set("2026").contains("parent: \"series\""));
    assert!(wb.fails(&["folder", "move", "Series", "--in", "2026"]).contains("inside itself"));
    // the older form: a set with no parent field is placed from settings/shelf.json, so no file has to move first
    let mut shelf: Value = serde_json::from_str(&std::fs::read_to_string(wb.dir.join("settings").join("shelf.json")).unwrap()).unwrap();
    shelf["folders"]["2026"]["parent"] = json!("sermons");
    std::fs::write(wb.dir.join("settings").join("shelf.json"), shelf.to_string()).unwrap();
    let old = set("2026").replace("parent: \"series\"\n", "");
    std::fs::write(wb.dir.join("sets").join("2026.md"), old).unwrap();
    let list = wb.js(&["folder", "list"]);
    assert_eq!(row(&list, "2026")["parent"], json!("sermons"));
    assert_eq!(Wb::names(&wb.js(&["shelf"])), ["Sermons", "Series"]);
}

#[test]
fn a_page_file_deleted_by_hand_is_reported_not_shown_broken() {
    let Some(wb) = Wb::new() else { return };
    let id = wb.page("Soon gone");
    wb.js(&["folder", "new", "Holds"]);
    wb.js(&["save", &format!("page:{id}"), "--folder", "Holds"]);
    assert_eq!(wb.js(&["study", "check"])["library"]["dangling"], json!([]));
    std::fs::remove_file(wb.file_with("Soon gone")).unwrap();
    let check = wb.js(&["study", "check"]);
    assert_eq!(check["library"]["dangling"][0]["ref"], json!(id));
    let shown = wb.js(&["set", "show", "Holds"]);
    assert_eq!(shown["items"][0]["gone"], json!(true));
}

#[test]
fn a_saved_sitting_is_a_set_item_pointing_into_history() {
    let Some(wb) = Wb::new() else { return };
    let step = wb.js(&["history", "add", "verse", "Numbers 25:11", "--line", "open Num 25:11"]);
    wb.js(&["folder", "new", "Sittings"]);
    let w = wb.js(&["save", "sitting:last", "--folder", "Sittings"]);
    assert_eq!(w["item"], json!({"kind": "sitting", "ref": step["id"]}));
    let set = std::fs::read_to_string(wb.dir.join("sets").join("sittings.md")).unwrap();
    assert!(set.contains("\"kind\": \"sitting\""));
    let shown = wb.js(&["set", "show", "Sittings"]);
    assert_eq!(shown["items"][0]["gone"], json!(false));
    assert!(wb.fails(&["save", "sitting:nope"]).contains("No sitting"));
}

#[test]
fn page_actions_for_several_pages_and_the_pages_own_look() {
    let Some(wb) = Wb::new() else { return };
    let (a, b, c) = (wb.page("Alpha page"), wb.page("Beta page"), wb.page("Gamma page"));
    assert_eq!(wb.ok(&["page", "link", &a]).trim(), "[[Alpha page]]");
    let copy = wb.js(&["page", "duplicate", &a]);
    assert_eq!(wb.ok(&["page", "link", copy["id"].as_str().unwrap()]).trim(), "[[Alpha page (copy)]]");
    // Pin and Move for several at once keep their order
    let pinned = wb.js(&["page", "pin", &b, &c]);
    assert_eq!(pinned.as_array().unwrap().len(), 2);
    let moved = wb.js(&["page", "move", &b, &c, "--parent", &a]);
    assert_eq!(moved.as_array().unwrap().len(), 2);
    // the look is kept beside Pinned, not in the page
    let file = wb.file_with("Alpha page\n");
    let before = std::fs::read(&file).unwrap();
    let l = wb.js(&["page", "look", &a, "--full-width", "on"]);
    assert_eq!((l["full_width"].clone(), l["small_text"].clone()), (json!(true), json!(false)));
    let l = wb.js(&["page", "look", &a, "--small-text", "on"]);
    assert_eq!((l["full_width"].clone(), l["small_text"].clone()), (json!(true), json!(true)));
    assert_eq!(wb.js(&["page", "look", &a])["full_width"], json!(true));
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(wb.dir.join("settings").join("pages.json")).unwrap()).unwrap();
    assert_eq!(saved["look"][&a], json!({"full_width": true, "small_text": true}));
    assert_eq!(std::fs::read(&file).unwrap(), before);
    assert!(wb.fails(&["page", "look", &a, "--full-width", "maybe"]).contains("on or off"));
    // one Undo for several deleted pages
    let del = wb.js(&["page", "rm", &b, &c]);
    assert!(del.to_string().to_lowercase().contains("undo"), "{del}");
}

#[test]
fn the_one_search_filters_and_counts() {
    let Some(wb) = Wb::new() else { return };
    let a = wb.page("Zeal in a page");
    wb.page("Another page");
    wb.page("A page with a question\n\n> [!question] why?");
    wb.js(&["folder", "new", "Zeal folder"]);
    wb.js(&["save", &format!("page:{a}"), "--folder", "Zeal folder"]);
    wb.js(&["save", "Num 25:11"]);
    let all = wb.js(&["find", "zeal", "--sort", "title"]);
    let kinds: Vec<&str> = all["groups"].as_array().unwrap().iter().map(|g| g["kind"].as_str().unwrap()).collect();
    assert_eq!(kinds, ["page", "folder", "save", "question", "margin"][..kinds.len()]);
    assert_eq!(all["groups"][0]["count"], json!(1));
    let pages = wb.js(&["find", "--kind", "page"]);
    assert_eq!((pages["count"].clone(), pages["groups"].as_array().unwrap().len()), (json!(3), 1));
    assert_eq!(wb.js(&["find", "--kind", "page", "--folder", "Zeal folder"])["count"], json!(1));
    assert_eq!(wb.js(&["find", "--kind", "page", "--has-question"])["count"], json!(1));
    assert_eq!(wb.js(&["find", "--kind", "page", "--edited", "1d"])["count"], json!(3));
    assert_eq!(wb.js(&["find", "--kind", "page", "--edited", "2000-01-01"])["count"], json!(3));
    let some = wb.js(&["find", "--kind", "page", "zeal"]);
    assert_eq!((some["count"].clone(), some["total"].clone()), (json!(1), json!(3)));
    assert_eq!(wb.js(&["find", "--kind", "margin"])["count"], json!(0));
    assert!(wb.fails(&["find", "--kind", "thread"]).contains("--kind"));
    // plain find keeps its old answer
    assert!(wb.js(&["find", "zeal"]).get("notes").is_some());
}

#[test]
fn a_pages_title_field_wins_and_check_reports_a_difference() {
    let Some(wb) = Wb::new() else { return };
    let id = wb.page("First line title");
    let file = wb.file_with("First line title");
    // a page with no title: field reads its first line, and reading does not rewrite the file
    let before = std::fs::read(&file).unwrap();
    assert_eq!(wb.ok(&["page", "link", &id]).trim(), "[[First line title]]");
    assert_eq!(wb.js(&["study", "check"])["library"]["title_differs"], json!([]));
    assert_eq!(std::fs::read(&file).unwrap(), before);
    // an edit outside the app adds a field that differs: the field wins, check reports it
    let text = String::from_utf8(before).unwrap().replacen("---\n", "---\ntitle: \"The field title\"\n", 1);
    std::fs::write(&file, text).unwrap();
    assert_eq!(wb.ok(&["page", "link", &id]).trim(), "[[The field title]]");
    let diff = wb.js(&["study", "check"])["library"]["title_differs"].clone();
    assert_eq!((diff[0]["title_field"].clone(), diff[0]["first_line"].clone()), (json!("The field title"), json!("First line title")));
}
