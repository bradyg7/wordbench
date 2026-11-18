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

// ---- marks round 7, T1 (rows 4, 6, 7, 14, 54, 56): marks/<BOOK>.json, old highlights read, the trash ----

fn on_chapter(w: &Wb, chapter: &str) -> Vec<Value> {
    w.js(&["marks", chapter])["marks"].as_array().unwrap().clone()
}

#[test]
fn mark_add_keeps_a_mark_in_the_books_file_with_every_kind() {
    let Some(w) = Wb::new() else { return };
    let h = w.js(&["mark", "add", "Num 25:11", "--kind", "highlight", "--color", "yellow"]);
    assert_eq!(h["kind"], "highlight");
    assert_eq!(h["at"], "NUM.25:11");
    assert!(h["id"].as_str().unwrap().starts_with("m_") && h["created"].as_str().unwrap().ends_with('Z'));
    let u = w.js(&["mark", "add", "Num 25:11", "--kind", "underline", "--color", "#e07b39", "--lines", "2"]);
    assert_eq!((u["lines"].clone(), u["color"].clone()), (json!(2), json!("#e07b39")));
    let plain = w.js(&["mark", "add", "Num 25:12", "--kind", "underline", "--color", "pink"]);
    assert_eq!(plain["lines"], 1, "an underline with no --lines has one");
    for kind in ["circle", "box"] {
        let m = w.js(&["mark", "add", "NUM.25:11.2-25:11.4", "--kind", kind, "--color", "blue"]);
        assert_eq!(m["at"], "NUM.25:11.2-25:11.4");
        assert!(m.get("lines").is_none() && m.get("to").is_none());
    }
    // the disk form: {"marks": [{id, kind, color, lines?, at, to?, created, changed?}]} in marks/NUM.json
    let file: Value = serde_json::from_str(&std::fs::read_to_string(w.dir.join("marks").join("NUM.json")).unwrap()).unwrap();
    assert_eq!(file["marks"].as_array().unwrap().len(), 5);
    assert_eq!(file["marks"][0], h);
    assert_eq!(on_chapter(&w, "Num 25").len(), 5);
    assert!(on_chapter(&w, "Num 26").is_empty());
    assert!(!w.dir.join("tmp").exists() && !w.snapshot().keys().any(|k| k.ends_with(".tmp")), "writes are atomic: no temp file is left");
}

#[test]
fn an_arrow_needs_a_target_in_the_same_chapter() {
    let Some(w) = Wb::new() else { return };
    let a = w.js(&["mark", "add", "Num 25:11", "--kind", "arrow", "--color", "blue", "--to", "Num 25:13"]);
    assert_eq!((a["at"].clone(), a["to"].clone()), (json!("NUM.25:11"), json!("NUM.25:13")));
    let refused = |args: &[&str], needle: &str| {
        let (code, _, err) = w.run(args);
        assert_ne!(code, 0, "{args:?}");
        assert!(err.contains(needle), "{args:?}: {err}");
    };
    refused(&["mark", "add", "Num 25:11", "--kind", "arrow", "--color", "blue", "--to", "Num 26:1"], "same chapter");
    refused(&["mark", "add", "Num 25:11", "--kind", "arrow", "--color", "blue", "--to", "Gen 1:1"], "same chapter");
    refused(&["mark", "add", "Num 25:11", "--kind", "arrow", "--color", "blue"], "--to");
    refused(&["mark", "add", "Num 25:11", "--kind", "box", "--color", "blue", "--to", "Num 25:12"], "arrow");
    refused(&["mark", "add", "Num 25:11", "--kind", "box", "--color", "blue", "--lines", "2"], "underline");
    refused(&["mark", "add", "Num 25:11", "--kind", "underline", "--color", "blue", "--lines", "4"], "1, 2 or 3");
    refused(&["mark", "add", "Num 25:11", "--kind", "scribble", "--color", "blue"], "A mark is one of");
    assert_eq!(on_chapter(&w, "Num 25").len(), 1, "a refused mark leaves nothing behind");
}

#[test]
fn old_highlights_are_read_as_highlight_marks_and_never_rewritten() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    let old = std::fs::read_to_string(w.dir.join("highlights").join("NUM.json")).unwrap();
    let before = w.snapshot();
    let marks = on_chapter(&w, "Num 25");
    assert_eq!(marks.len(), 1);
    let (m, h): (&Value, Value) = (&marks[0], serde_json::from_str::<Value>(&old).unwrap()["highlights"][0].clone());
    assert_eq!((m["kind"].clone(), m["color"].clone(), m["at"].clone()), (json!("highlight"), json!("green"), json!("NUM.25:11")));
    assert_eq!((m["id"].clone(), m["created"].clone(), m["words"].clone()), (h["id"].clone(), h["created"].clone(), h["quote"].clone()));
    assert_eq!(before, w.snapshot(), "reading a chapter writes nothing");
    // beside a new mark, both are listed, by date made
    w.ok(&["mark", "add", "Num 25:12", "--kind", "circle", "--color", "pink"]);
    assert_eq!(on_chapter(&w, "Num 25").len(), 2);
    assert_eq!(std::fs::read_to_string(w.dir.join("highlights").join("NUM.json")).unwrap(), old);
}

#[test]
fn a_deleted_mark_waits_in_the_trash_for_seven_days_and_can_be_put_back() {
    let Some(w) = Wb::new() else { return };
    let m = w.js(&["mark", "add", "Num 25:11", "--kind", "box", "--color", "blue"]);
    let id = m["id"].as_str().unwrap();
    let kept = w.js(&["mark", "add", "Num 25:12", "--kind", "highlight", "--color", "yellow"]);
    let gone = w.js(&["mark", "rm", id]);
    assert_eq!(gone["deleted"], id);
    assert_eq!(on_chapter(&w, "Num 25").len(), 1);
    let t = w.js(&["trash"]);
    assert_eq!(t["marks"].as_array().unwrap().len(), 1);
    assert_eq!((t["marks"][0]["id"].clone(), t["marks"][0]["days_left"].clone()), (json!(id), json!(7)));
    // the 7 days: a mark deleted 3 days ago waits; one deleted 8 days ago is erased by the window's sweep
    assert_eq!(w.js(&["trash", "empty"])["erased"], json!([]));
    let name = gone["trash"].as_str().unwrap().to_string();
    let old = w.dir.join(".trash").join(format!("20000101-000000-{id}.json"));
    std::fs::rename(w.dir.join(".trash").join(&name), &old).unwrap();
    assert_eq!(w.js(&["trash", "empty"])["erased"], json!([format!("20000101-000000-{id}.json")]));
    assert!(w.js(&["trash"])["marks"].as_array().unwrap().is_empty());
    let (code, _, _) = w.run(&["mark", "restore", id]);
    assert_ne!(code, 0, "erased for good");
    // another delete, then restore
    let kid = kept["id"].as_str().unwrap();
    w.ok(&["mark", "rm", kid]);
    assert!(on_chapter(&w, "Num 25").is_empty());
    let back = w.js(&["mark", "restore", kid]);
    assert_eq!(back, kept, "put back as it was, id and date kept");
    assert_eq!(on_chapter(&w, "Num 25").len(), 1);
    assert!(w.js(&["trash"])["marks"].as_array().unwrap().is_empty());
}

#[test]
fn an_old_highlight_deleted_and_restored_is_the_same_highlight() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    let file = w.dir.join("highlights").join("NUM.json");
    let old = std::fs::read_to_string(&file).unwrap();
    let id = on_chapter(&w, "Num 25")[0]["id"].as_str().unwrap().to_string();
    w.ok(&["mark", "rm", &id]);
    assert!(on_chapter(&w, "Num 25").is_empty());
    w.ok(&["mark", "restore", &id]);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), old);
}
