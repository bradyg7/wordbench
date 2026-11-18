//! design/features/marks: the verse index and the pages that name a verse (MK-13), and what the study check lists.
//! Each test runs `wb` on a generated scratch study. No scripture is typed here.

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
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
        let dir = std::env::temp_dir().join("bible-workbench-rs").join("marks-tests").join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
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
    fn page(&self, text: &str) -> String {
        self.js(&["page", "new", text])["id"].as_str().unwrap().to_string()
    }
    /// Every file of the study folder with what it holds.
    fn snapshot(&self) -> BTreeMap<String, String> {
        fn walk(root: &Path, d: &Path, out: &mut BTreeMap<String, String>) {
            for e in std::fs::read_dir(d).into_iter().flatten().flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(root, &p, out);
                } else {
                    out.insert(p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/"), std::fs::read_to_string(&p).unwrap_or_default());
                }
            }
        }
        let mut out = BTreeMap::new();
        walk(&self.dir, &self.dir, &mut out);
        out
    }
    fn page_file(&self, id: &str) -> String {
        self.snapshot().into_iter().find(|(k, _)| k.ends_with(&format!("{id}.md"))).unwrap().1
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn ids(v: &Value) -> Vec<String> {
    v["pages"].as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap().to_string()).collect()
}

#[test]
fn no_place_a_page_is_tethered_by_its_own_text() {
    let Some(w) = Wb::new() else { return };
    let id = w.page("Phinehas\n\nHe is named at Numbers 25:11 here.");
    assert!(!w.page_file(&id).contains("anchor"), "a new page has no anchor");
    assert_eq!(ids(&w.js(&["anchor", "Num 25:11", "--pages"])), vec![id.clone()]);
    let other = w.page("Another\n\nNothing named.");
    let before = w.snapshot();
    w.ok(&["note", "text", &id, "Phinehas\n\nNo reference now."]);
    assert!(ids(&w.js(&["anchor", "Num 25:11", "--pages"])).is_empty());
    let after = w.snapshot();
    let changed: Vec<&String> = after.keys().filter(|k| before.get(*k) != after.get(*k)).collect();
    assert_eq!(changed.len(), 1, "only the page changed: {changed:?}");
    assert!(changed[0].ends_with(&format!("{id}.md")) && !changed[0].contains(&other));
}

#[test]
fn a_scripture_block_and_a_word_block_tether_a_page_by_their_own_text() {
    let Some(w) = Wb::new() else { return };
    let block = w.page("Block page

```scripture
Num 25:11
```");
    assert!(!w.page_file(&block).contains("anchor"));
    assert_eq!(ids(&w.js(&["anchor", "Num 25:11", "--pages"])), vec![block.clone()], "a scripture block names its verse");
    // a word block holds a Strong's number, not a verse: the page is listed for that number, and for no verse
    let word = w.page("Word page

```word
H7065
```");
    assert!(!w.page_file(&word).contains("anchor"));
    assert_eq!(ids(&w.js(&["anchor", "H7065", "--pages"])), vec![word.clone()]);
    assert_eq!(ids(&w.js(&["anchor", "Num 25:11", "--pages"])), vec![block.clone()]);
    // taking the text out takes the page out of both lists, and no other file changes
    let before = w.snapshot();
    w.ok(&["note", "text", &block, "Block page

No block now."]);
    w.ok(&["note", "text", &word, "Word page

No block now."]);
    assert!(ids(&w.js(&["anchor", "Num 25:11", "--pages"])).is_empty());
    assert!(ids(&w.js(&["anchor", "H7065", "--pages"])).is_empty());
    let after = w.snapshot();
    let changed: Vec<&String> = after.keys().filter(|k| before.get(*k) != after.get(*k)).collect();
    assert_eq!(changed.len(), 2, "only the two pages changed: {changed:?}");
}

#[test]
fn editing_a_page_keeps_no_earlier_version_anywhere() {
    let Some(w) = Wb::new() else { return };
    let id = w.page("A page

First words.");
    let keys_before: Vec<String> = w.snapshot().keys().cloned().collect();
    w.ok(&["note", "text", &id, "A page

Second words."]);
    w.ok(&["note", "text", &id, "A page

Third words."]);
    let snap = w.snapshot();
    let keys_after: Vec<String> = snap.keys().cloned().collect();
    assert_eq!(keys_before, keys_after, "no file or folder appeared: {keys_after:?}");
    assert!(keys_after.iter().all(|k| !k.contains("version") && !k.contains("history") && !k.contains("backup")));
    assert!(snap.values().all(|t| !t.contains("First words.")), "the first words are not kept anywhere");
}

#[test]
fn scripture_in_this_page_is_the_refs_of_its_text_and_blocks() {
    let Some(w) = Wb::new() else { return };
    let text = "Five readings\n\nSee Numbers 25:11 and Psalm 106:30.\n\n```scripture\nJohn 3:16\n```\n\nAlso Romans 10:2 and Exodus 20:3.";
    let id = w.page(text);
    let o = w.js(&["page", "overview", &id]);
    assert_eq!(o["count"], 5);
    assert_eq!(o["folded"], false);
    let labels: Vec<String> = o["items"].as_array().unwrap().iter().map(|i| i["label"].as_str().unwrap().to_string()).collect();
    assert_eq!(labels, ["Exodus 20:3", "Numbers 25:11", "Psalms 106:30", "John 3:16", "Romans 10:2"], "Bible order");
    let john = o["items"].as_array().unwrap().iter().find(|i| i["label"] == "John 3:16").unwrap();
    assert_eq!(john["where"][0]["in"], "scripture block");
    // it equals wb refs on the text, plus the block's reference
    let refs = w.js(&["refs", text]);
    assert_eq!(refs.as_array().unwrap().len(), 5, "wb refs on the text finds all five, the block's reference included");
    for r in refs.as_array().unwrap() {
        let place = r["ref"].as_str().unwrap();
        let (_, nums) = place.rsplit_once(' ').unwrap();
        assert!(labels.iter().any(|l| l.ends_with(nums)), "{place} is in the overview: {labels:?}");
    }
    // 80 scriptures fold to books
    let many: String = (1..=40).map(|c| format!("Psalm {c}:1 and Isaiah {c}:2\n\n")).collect();
    let big = w.page(&format!("Long lesson\n\n{many}"));
    let o = w.js(&["page", "overview", &big]);
    assert_eq!(o["count"], 80);
    assert_eq!(o["folded"], true);
    assert_eq!(o["books"].as_array().unwrap().len(), 2);
    assert_eq!(o["books"][0]["count"], 40);
}


#[test]
fn the_study_check_still_lists_the_files_marks_rounds_1_to_6_wrote_and_writes_nothing() {
    let Some(w) = Wb::new() else { return };
    // files written by the removed margin and pencil, put in by hand: the check lists them and nothing reads or changes them
    for (path, text) in [("margin/NUM/25.md", "a"), ("margin/NUM/26.md", "b"), ("margin/PSA/1.md", "c"), ("pencil/NUM.json", "{\"pencil\": []}")] {
        let p = w.dir.join(path);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, text).unwrap();
    }
    let before = w.snapshot();
    let c = w.js(&["study", "check"]);
    assert_eq!(c["margin"], json!({"files": 3}));
    assert_eq!(c["pencil"], json!({"files": 1}));
    assert_eq!(before, w.snapshot(), "the check writes nothing");
}
