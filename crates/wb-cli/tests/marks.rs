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

/// A mark as `show` gives it, without the legend name `add` and `style` do not give.
fn bare(mut v: Value) -> Value {
    v.as_object_mut().unwrap().remove("legend");
    v
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

// ---- marks round 7, T2 (rows 25 to 28): wb mark show, at, style ----

#[test]
fn mark_show_gives_one_mark_whole() {
    let Some(w) = Wb::new() else { return };
    let u = w.js(&["mark", "add", "Num 25:11", "--kind", "underline", "--color", "blue", "--lines", "3"]);
    let shown = w.js(&["mark", "show", u["id"].as_str().unwrap()]);
    let mut plain = shown.clone();
    assert_eq!(plain.as_object_mut().unwrap().remove("legend"), Some(json!("Unnamed blue triple underline")));
    assert_eq!(plain, u, "kind, color, lines, at, created; no `to` or `changed` yet");
    w.ok(&["hl", "set", "Num 25:12", "green"]);
    let old = on_chapter(&w, "Num 25").into_iter().find(|m| m["at"] == "NUM.25:12").unwrap();
    let s = w.js(&["mark", "show", old["id"].as_str().unwrap()]);
    assert_eq!((s["kind"].clone(), s["color"].clone(), s["created"].clone()), (json!("highlight"), json!("green"), old["created"].clone()));
    let (code, _, err) = w.run(&["mark", "show", "m_nope"]);
    assert_ne!(code, 0);
    assert!(err.contains("No mark"), "{err}");
}

#[test]
fn marks_at_a_place_come_topmost_first_old_highlights_included() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    let old_hl = on_chapter(&w, "Num 25")[0]["id"].as_str().unwrap().to_string();
    let hl2 = w.js(&["mark", "add", "Num 25:11", "--kind", "highlight", "--color", "yellow"])["id"].as_str().unwrap().to_string();
    let bx = w.js(&["mark", "add", "NUM.25:11.2-25:11.4", "--kind", "box", "--color", "blue"])["id"].as_str().unwrap().to_string();
    let ci = w.js(&["mark", "add", "Num 25:11", "--kind", "circle", "--color", "pink"])["id"].as_str().unwrap().to_string();
    let ul = w.js(&["mark", "add", "Num 25:11", "--kind", "underline", "--color", "blue"])["id"].as_str().unwrap().to_string();
    let ar = w.js(&["mark", "add", "Num 25:11", "--kind", "arrow", "--color", "blue", "--to", "Num 25:13"])["id"].as_str().unwrap().to_string();
    w.ok(&["mark", "add", "Num 25:12", "--kind", "box", "--color", "blue"]); // another verse: not listed
    let got = |place: &str| -> Vec<String> { w.js(&["mark", "at", place])["marks"].as_array().unwrap().iter().map(|m| m["id"].as_str().unwrap().to_string()).collect() };
    // arrow, underline, then circle and box (newest first: circle was made after the box), then highlights (newest first: the new one, then the old)
    assert_eq!(got("Num 25:11"), vec![ar.clone(), ul.clone(), ci.clone(), bx.clone(), hl2.clone(), old_hl.clone()]);
    // words 2 to 4 share words with all of them; word 9 is covered only by the whole-verse marks, not the box on words 2-4
    assert_eq!(got("NUM.25:11.9"), vec![ar, ul, ci, hl2, old_hl]);
    assert_eq!(w.js(&["mark", "at", "Num 25:11"])["place"], "NUM.25:11");
    assert!(got("Num 25:20").is_empty());
}

#[test]
fn mark_style_replaces_one_marks_style_and_keeps_its_id_and_date() {
    let Some(w) = Wb::new() else { return };
    let a = w.js(&["mark", "add", "Num 25:11", "--kind", "highlight", "--color", "yellow"]);
    let other = w.js(&["mark", "add", "Num 25:11", "--kind", "box", "--color", "blue"]);
    let id = a["id"].as_str().unwrap();
    let b = w.js(&["mark", "style", id, "--color", "pink"]);
    assert_eq!((b["id"].clone(), b["created"].clone(), b["at"].clone(), b["kind"].clone(), b["color"].clone()), (a["id"].clone(), a["created"].clone(), a["at"].clone(), json!("highlight"), json!("pink")));
    assert!(b["changed"].as_str().unwrap().ends_with('Z'));
    let u = w.js(&["mark", "style", id, "--kind", "underline", "--lines", "2"]);
    assert_eq!((u["kind"].clone(), u["lines"].clone(), u["color"].clone()), (json!("underline"), json!(2), json!("pink")));
    let back = w.js(&["mark", "style", id, "--kind", "circle"]);
    assert!(back.get("lines").is_none(), "lines go when the kind is not an underline");
    assert_eq!(bare(w.js(&["mark", "show", id])), back);
    assert_eq!(bare(w.js(&["mark", "show", other["id"].as_str().unwrap()])), other, "no other mark changes");
    assert_eq!(on_chapter(&w, "Num 25").len(), 2);
    let refused = |args: &[&str], needle: &str| {
        let before = w.snapshot();
        let (code, _, err) = w.run(args);
        assert_ne!(code, 0, "{args:?}");
        assert!(err.contains(needle), "{args:?}: {err}");
        assert_eq!(before, w.snapshot(), "a refused change writes nothing");
    };
    refused(&["mark", "style", id, "--lines", "2"], "underline");
    refused(&["mark", "style", id, "--kind", "underline", "--lines", "4"], "1, 2 or 3");
    refused(&["mark", "style", id, "--kind", "scribble"], "A mark is one of");
    refused(&["mark", "style", id, "--kind", "arrow"], "arrow");
    refused(&["mark", "style", id], "Say what to change");
    refused(&["mark", "style", "m_nope", "--color", "orange"], "No mark");
    // an arrow keeps its target
    let ar = w.js(&["mark", "add", "Num 25:11", "--kind", "arrow", "--color", "blue", "--to", "Num 25:13"]);
    let ar2 = w.js(&["mark", "style", ar["id"].as_str().unwrap(), "--color", "orange"]);
    assert_eq!(ar2["to"], "NUM.25:13");
}

#[test]
fn an_old_highlight_changes_color_in_its_own_file_and_nothing_else() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    let id = on_chapter(&w, "Num 25")[0]["id"].as_str().unwrap().to_string();
    let created = on_chapter(&w, "Num 25")[0]["created"].clone();
    let m = w.js(&["mark", "style", &id, "--color", "pink"]);
    assert_eq!((m["id"].clone(), m["color"].clone(), m["created"].clone(), m["kind"].clone()), (json!(id), json!("pink"), created, json!("highlight")));
    assert!(m["changed"].is_string());
    assert!(!w.dir.join("marks").exists(), "no marks file made for it");
    let h: Value = serde_json::from_str(&std::fs::read_to_string(w.dir.join("highlights").join("NUM.json")).unwrap()).unwrap();
    assert_eq!((h["highlights"].as_array().unwrap().len(), h["highlights"][0]["color"].clone()), (1, json!("pink")));
    assert_eq!(on_chapter(&w, "Num 25")[0]["color"], "pink");
    let (code, _, err) = w.run(&["mark", "style", &id, "--kind", "box"]);
    assert_ne!(code, 0);
    assert!(err.contains("old highlight"), "{err}");
    let (code, _, _) = w.run(&["mark", "style", &id, "--lines", "2"]);
    assert_ne!(code, 0);
}

#[test]
fn deleting_and_undoing_meets_row_28() {
    let Some(w) = Wb::new() else { return };
    let m = w.js(&["mark", "add", "Num 25:11", "--kind", "circle", "--color", "blue"]);
    let id = m["id"].as_str().unwrap();
    let changed = w.js(&["mark", "style", id, "--color", "orange"]);
    w.ok(&["mark", "rm", id]);
    assert!(w.js(&["mark", "at", "Num 25:11"])["marks"].as_array().unwrap().is_empty());
    assert_eq!(w.js(&["mark", "restore", id]), changed, "Undo puts it back as it was, changed date included");
    assert_eq!(w.js(&["mark", "at", "Num 25:11"])["marks"].as_array().unwrap().len(), 1);
}

// ---- the legend (T3: rows 4 --style, 8, 9, 33 to 39) ---------------------------------------------------------------

fn labels(w: &Wb) -> Vec<(String, u64)> {
    w.js(&["legend"])["entries"].as_array().unwrap().iter().map(|e| (e["label"].as_str().unwrap().to_string(), e["count"].as_u64().unwrap())).collect()
}

#[test]
fn a_new_library_has_an_empty_legend_and_marks_in_no_entry_are_listed_as_unnamed() {
    let Some(w) = Wb::new() else { return };
    let l = w.js(&["legend"]);
    assert_eq!((l["entries"].clone(), l["unlisted"].clone()), (json!([]), json!([])));
    assert!(!w.dir.join("settings").join("legend.json").exists(), "reading writes nothing");
    w.ok(&["mark", "add", "Num 25:11", "--kind", "highlight", "--color", "yellow"]); // row 9: a mark with no entry
    w.ok(&["hl", "set", "Num 25:12", "yellow"]); // an old highlight counts too
    w.ok(&["mark", "add", "Num 25:13", "--kind", "underline", "--color", "orange", "--lines", "2"]);
    let l = w.js(&["legend"]);
    assert_eq!(l["entries"], json!([]));
    assert_eq!((l["unlisted"][0]["label"].clone(), l["unlisted"][0]["count"].clone()), (json!("Unnamed yellow highlight"), json!(2)));
    assert_eq!(l["unlisted"][1]["label"], "Unnamed orange double underline");
}

#[test]
fn legend_add_makes_named_and_unnamed_entries_and_refuses_the_same_style_twice() {
    let Some(w) = Wb::new() else { return };
    let e = w.js(&["legend", "add", "--kind", "highlight", "--color", "yellow", "--name", "Promise", "--meaning", "a promise made"]);
    assert_eq!((e["label"].clone(), e["style"].clone(), e["position"].clone(), e["count"].clone()), (json!("Promise"), json!("highlight:yellow"), json!(1), json!(0)));
    let u = w.js(&["legend", "add", "--kind", "underline", "--color", "orange", "--lines", "2"]); // row 9: no name
    assert_eq!((u["label"].clone(), u["style"].clone()), (json!("Unnamed orange double underline"), json!("underline:orange:2")));
    assert!(u.get("name").is_none(), "no stored name");
    let file: Value = serde_json::from_str(&w.snapshot()["settings/legend.json"]).unwrap();
    assert_eq!(
        file,
        json!({"entries": [
            {"kind": "highlight", "color": "yellow", "name": "Promise", "meaning": "a promise made"},
            {"kind": "underline", "color": "orange", "lines": 2}]})
    );
    for args in [
        vec!["legend", "add", "--kind", "highlight", "--color", "YELLOW", "--name", "Other"],
        vec!["legend", "add", "--kind", "underline", "--color", "orange", "--lines", "2"],
        vec!["legend", "add", "--kind", "box", "--color", "blue", "--name", "promise"],
        vec!["legend", "add", "--kind", "box", "--color", "blue", "--lines", "2"],
        vec!["legend", "add", "--kind", "wiggle", "--color", "blue"],
    ] {
        let (code, _, err) = w.run(&args);
        assert_ne!(code, 0, "{args:?}");
        assert!(!err.is_empty());
    }
    assert!(w.run(&["legend", "add", "--kind", "highlight", "--color", "yellow"]).2.contains("already has"));
    assert_eq!(labels(&w).len(), 2);
}

#[test]
fn a_mark_takes_an_entrys_style_and_shows_its_legend_name() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["legend", "add", "--kind", "underline", "--color", "orange", "--lines", "2", "--name", "Warning"]);
    let m = w.js(&["mark", "add", "Num 25:11", "--style", "Warning"]);
    assert_eq!((m["kind"].clone(), m["color"].clone(), m["lines"].clone()), (json!("underline"), json!("orange"), json!(2)));
    let by_style = w.js(&["mark", "add", "Num 25:12", "--style", "underline:orange:2"]);
    assert_eq!(by_style["lines"], 2);
    assert_eq!(w.js(&["mark", "show", m["id"].as_str().unwrap()])["legend"], "Warning");
    assert_eq!(w.js(&["mark", "at", "Num 25:11"])["marks"][0]["legend"], "Warning");
    assert_eq!(labels(&w), vec![("Warning".to_string(), 2)]);
    let o = w.js(&["mark", "add", "Num 25:11", "--kind", "box", "--color", "blue"]);
    assert_eq!(w.js(&["mark", "show", o["id"].as_str().unwrap()])["legend"], "Unnamed blue box");
    assert_ne!(w.run(&["mark", "add", "Num 25:11", "--style", "Nothing"]).0, 0);
    assert_ne!(w.run(&["mark", "add", "Num 25:11", "--style", "Warning", "--color", "blue"]).0, 0);
}

#[test]
fn a_new_name_shows_on_every_mark_in_the_style() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["legend", "add", "--kind", "highlight", "--color", "yellow"]);
    let id = w.js(&["mark", "add", "Num 25:11", "--style", "Unnamed yellow highlight"])["id"].as_str().unwrap().to_string();
    assert_eq!(w.js(&["mark", "show", &id])["legend"], "Unnamed yellow highlight");
    let r = w.js(&["legend", "set", "highlight:yellow", "--name", "Promise", "--meaning", "kept"]); // row 34
    assert_eq!((r["entry"]["label"].clone(), r["entry"]["meaning"].clone(), r["restyled"].clone()), (json!("Promise"), json!("kept"), json!(0)));
    assert_eq!(w.js(&["mark", "show", &id])["legend"], "Promise");
    w.ok(&["legend", "set", "Promise", "--name", ""]);
    assert_eq!(w.js(&["mark", "show", &id])["legend"], "Unnamed yellow highlight");
    assert_ne!(w.run(&["legend", "set", "highlight:yellow"]).0, 0, "nothing to change");
}

#[test]
fn changing_an_entrys_color_restyles_its_marks_or_only_the_entry() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["legend", "add", "--kind", "highlight", "--color", "yellow", "--name", "Promise"]);
    let a = w.js(&["mark", "add", "Num 25:11", "--style", "Promise"])["id"].as_str().unwrap().to_string();
    w.ok(&["hl", "set", "Num 25:12", "yellow"]);
    let old = on_chapter(&w, "Num 25").into_iter().find(|m| m["at"] == "NUM.25:12").unwrap()["id"].as_str().unwrap().to_string();
    w.ok(&["mark", "add", "Num 25:13", "--kind", "box", "--color", "yellow"]); // another kind: stays
    let hl_count = w.snapshot().keys().filter(|k| k.starts_with("highlights/")).count();
    // marks use the style: one of the two flags is needed
    let (code, _, err) = w.run(&["legend", "set", "Promise", "--color", "green"]);
    assert_ne!(code, 0);
    assert!(err.contains("--restyle"), "{err}");
    assert_eq!(labels(&w), vec![("Promise".to_string(), 2)], "nothing changed");
    // --no-restyle: the entry only; the marks then show as Unnamed
    let r = w.js(&["legend", "set", "Promise", "--color", "green", "--no-restyle"]);
    assert_eq!((r["entry"]["color"].clone(), r["restyled"].clone(), r["entry"]["count"].clone()), (json!("green"), json!(0), json!(0)));
    assert_eq!(w.js(&["mark", "show", &a])["color"], "yellow");
    assert_eq!(w.js(&["mark", "show", &a])["legend"], "Unnamed yellow highlight");
    // back, then --restyle
    w.ok(&["legend", "set", "Promise", "--color", "yellow", "--no-restyle"]);
    let r = w.js(&["legend", "set", "Promise", "--color", "green", "--restyle"]);
    assert_eq!((r["restyled"].clone(), r["entry"]["count"].clone()), (json!(2), json!(2)));
    let m = w.js(&["mark", "show", &a]);
    assert_eq!((m["color"].clone(), m["legend"].clone()), (json!("green"), json!("Promise")));
    assert!(m["changed"].is_string());
    assert_eq!(w.js(&["mark", "show", &old])["color"], "green");
    // the old highlight took it in its own file, which gained nothing else
    let hl: Vec<String> = w.snapshot().into_iter().filter(|(k, _)| k.starts_with("highlights/")).map(|(_, v)| v).collect();
    assert_eq!(hl.len(), hl_count);
    assert!(hl[0].contains("green") && !hl[0].contains("yellow"));
    assert!(on_chapter(&w, "Num 25").iter().any(|m| m["kind"] == "box" && m["color"] == "yellow"), "the box stayed");
    // a color another entry has is refused
    w.ok(&["legend", "add", "--kind", "highlight", "--color", "pink", "--name", "Pink"]);
    assert_ne!(w.run(&["legend", "set", "Pink", "--color", "green", "--restyle"]).0, 0);
}

#[test]
fn quick_styles_are_five_at_most_and_a_key_is_unique_unless_moved() {
    let Some(w) = Wb::new() else { return };
    let colors = ["yellow", "green", "blue", "pink", "orange", "#8040c0"];
    for (i, c) in colors.iter().enumerate() {
        w.ok(&["legend", "add", "--kind", "highlight", "--color", c, "--name", &format!("E{}", i + 1)]);
    }
    for i in 1..=5 {
        let r = w.js(&["legend", "set", &format!("E{i}"), "--quick", "on"]); // row 36
        assert_eq!(r["entry"]["quick"], true);
    }
    let (code, _, err) = w.run(&["legend", "set", "E6", "--quick", "on"]);
    assert_ne!(code, 0);
    assert!(err.contains("5 quick styles"), "{err}");
    w.ok(&["legend", "set", "E1", "--quick", "off"]);
    w.ok(&["legend", "set", "E6", "--quick", "on"]);
    w.ok(&["legend", "set", "E6", "--quick", "on"]); // already on: fine
    assert_ne!(w.run(&["legend", "set", "E6", "--quick", "maybe"]).0, 0);
    // keys (row 37)
    assert_eq!(w.js(&["legend", "set", "E1", "--key", "ctrl+7"])["entry"]["key"], "Ctrl+7");
    let (code, _, err) = w.run(&["legend", "set", "E2", "--key", "Ctrl+7"]);
    assert_ne!(code, 0);
    assert!(err.contains("--move-key") && err.contains("E1"), "{err}");
    for bad in ["Ctrl+0", "Ctrl+10", "Alt+1", "7"] {
        assert_ne!(w.run(&["legend", "set", "E2", "--key", bad]).0, 0, "{bad}");
    }
    w.ok(&["legend", "set", "E1", "--key", "Ctrl+7"]); // its own key again: fine
    w.ok(&["legend", "set", "E2", "--key", "Ctrl+7", "--move-key"]);
    let l = w.js(&["legend"]);
    let key_of = |n: &str| l["entries"].as_array().unwrap().iter().find(|e| e["label"] == n).unwrap().get("key").cloned();
    assert_eq!((key_of("E1"), key_of("E2")), (None, Some(json!("Ctrl+7"))));
    w.ok(&["legend", "set", "E2", "--key", "none"]);
    assert!(w.js(&["legend"])["entries"][1].get("key").is_none());
}

#[test]
fn entries_move_and_removing_one_keeps_its_marks_as_unnamed() {
    let Some(w) = Wb::new() else { return };
    for (n, c) in [("A", "yellow"), ("B", "green"), ("C", "blue")] {
        w.ok(&["legend", "add", "--kind", "highlight", "--color", c, "--name", n]);
    }
    let order = |l: &Value| -> Vec<String> { l["entries"].as_array().unwrap().iter().map(|e| e["label"].as_str().unwrap().to_string()).collect() };
    assert_eq!(order(&w.js(&["legend", "move", "C", "--to", "1"])), ["C", "A", "B"]); // row 38
    assert_eq!(order(&w.js(&["legend", "move", "C", "--to", "3"])), ["A", "B", "C"]);
    assert_eq!(order(&w.js(&["legend", "move", "highlight:green", "--to", "1"])), ["B", "A", "C"]);
    for to in ["0", "4"] {
        assert_ne!(w.run(&["legend", "move", "A", "--to", to]).0, 0);
    }
    assert_ne!(w.run(&["legend", "move", "Nope", "--to", "1"]).0, 0);
    // row 39
    w.ok(&["mark", "add", "Num 25:11", "--style", "A"]);
    let r = w.js(&["legend", "rm", "A"]);
    assert_eq!((r["removed"]["label"].clone(), r["marks_kept"].clone()), (json!("A"), json!(1)));
    assert_eq!(order(&w.js(&["legend"])), ["B", "C"]);
    assert_eq!(w.js(&["legend"])["unlisted"][0]["label"], "Unnamed yellow highlight");
    assert_eq!(w.js(&["mark", "at", "Num 25:11"])["marks"][0]["legend"], "Unnamed yellow highlight");
    assert_eq!(on_chapter(&w, "Num 25").len(), 1, "the mark stays");
}

#[test]
fn the_legend_file_is_kept_whole_and_a_bad_one_is_an_empty_legend() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["legend", "add", "--kind", "circle", "--color", "#E07B39", "--name", "Orange ring"]);
    let s = w.snapshot();
    assert!(s["settings/legend.json"].contains("#e07b39"));
    assert!(!s.keys().any(|k| k.contains("legend") && k.ends_with(".tmp")), "no temp file left");
    std::fs::write(w.dir.join("settings").join("legend.json"), "not json").unwrap();
    assert_eq!(w.js(&["legend"])["entries"], json!([]));
}
