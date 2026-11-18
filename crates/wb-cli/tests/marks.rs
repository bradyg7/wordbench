//! design/features/marks, "What the build must satisfy": the margin, margin notes, the pencil, a passage with its marks, the
//! verse index and the files. Each test runs `wb` on a generated scratch study. No scripture is typed here: verses are
//! compared with `wb text`.

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
    fn note(&self, place: &str, text: &str) -> String {
        self.js(&["margin", "add", place, text])["id"].as_str().unwrap().to_string()
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
fn the_readers_margin_counts_notes_and_pages_and_the_verse_opens_verbatim() {
    let Some(w) = Wb::new() else { return };
    w.note("Num 25:11", "First thought");
    w.note("Num 25:11", "Second thought");
    for i in 0..3 {
        w.page(&format!("Page {i}\n\nZeal at Numbers 25:11 {i}."));
    }
    let before = w.snapshot();
    let ch = w.js(&["margin", "Num 25"]);
    let v11 = ch["verses"].as_array().unwrap().iter().find(|v| v["v"] == 11).unwrap();
    assert_eq!((v11["notes"].as_u64(), v11["pages"].as_u64()), (Some(2), Some(3)));
    assert!(v11["lines"].as_array().unwrap().len() >= 5, "hover lines");
    // the verse opened in the margin
    let v = w.js(&["margin", "Num 25:11"]);
    let verse = w.ok(&["text", "Num 25:11"]);
    assert!(verse.contains(v["text"].as_str().unwrap()), "the verse is the database's: {verse}");
    assert_eq!(v["counts"]["notes"], 2);
    assert_eq!(v["counts"]["pages"], 3);
    for k in ["saves", "marks", "around"] {
        assert!(v["counts"][k].is_number(), "{k}");
    }
    assert_eq!(v["notes"][0]["text"], "Second thought", "newest first");
    assert_eq!(before, w.snapshot(), "reading writes nothing");
}

#[test]
fn passages_and_chapters_are_listed_smaller_and_a_chapters_note_is_at_its_top() {
    let Some(w) = Wb::new() else { return };
    let p = w.note("Num 25:10-13", "On the four verses");
    let c = w.note("Num 25", "On the chapter");
    for verse in 10..=13 {
        let v = w.js(&["margin", &format!("Num 25:{verse}")]);
        assert_eq!(v["notes"].as_array().unwrap().len(), 0);
        let ar: Vec<&str> = v["around"].as_array().unwrap().iter().map(|n| n["id"].as_str().unwrap()).collect();
        assert_eq!(ar, [p.as_str()], "verse {verse}");
    }
    assert!(w.js(&["margin", "Num 25:9"])["around"].as_array().unwrap().is_empty());
    let ch = w.js(&["margin", "Num 25"]);
    assert_eq!(ch["top"][0]["id"], c.as_str());
    let pass = ch["notes"].as_array().unwrap().iter().find(|n| n["id"] == p.as_str()).unwrap();
    assert_eq!((pass["v1"].as_u64(), pass["v2"].as_u64(), pass["kind"].as_str()), (Some(10), Some(13), Some("passage")));
    assert!(pass["verse_start"].as_str().unwrap().len() > 3);
}

#[test]
fn the_margins_file_dates_and_questions() {
    let Some(w) = Wb::new() else { return };
    let a = w.note("Num 25:11", "Verse thought");
    let b = w.note("Num 25:10-13", "Passage thought");
    w.note("Num 25", "Chapter thought");
    let q = w.js(&["margin", "add", "Num 25:12", "Why?", "--question"])["id"].as_str().unwrap().to_string();
    let snap = w.snapshot();
    let f = snap.get("margin/NUM/25.md").expect("margin/NUM/25.md");
    assert!(f.contains("## Numbers 25:11\n<!-- margin id=") && f.contains(&a) && f.contains("at=NUM.25:11"));
    assert!(f.contains("## Numbers 25:10–13") && f.contains(&format!("id={b} at=NUM.25:10-13")));
    assert!(f.contains("## Numbers 25\n<!-- margin"));
    assert!(f.contains("> [!question] Why?"));
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    assert_eq!(f.matches(&format!("written={today}")).count(), 4, "a date on every note");
    // editing one note changes only that chapter's file
    w.note("Num 26:1", "Next chapter");
    let before = w.snapshot();
    w.ok(&["margin", "edit", &a, "Verse thought, again"]);
    let after = w.snapshot();
    let changed: Vec<&String> = after.keys().filter(|k| before.get(*k) != after.get(*k)).collect();
    assert_eq!(changed, ["margin/NUM/25.md"]);
    // a question stays a question when edited; done and off turn it over
    w.ok(&["margin", "edit", &q, "Why not?"]);
    assert!(w.snapshot()["margin/NUM/25.md"].contains("> [!question] Why not?"));
    w.ok(&["margin", "question", &q, "--done"]);
    assert!(w.snapshot()["margin/NUM/25.md"].contains("> [!done] Why not?"));
    w.ok(&["margin", "question", &q, "--off"]);
    let f = w.snapshot()["margin/NUM/25.md"].clone();
    assert!(f.contains("Why not?") && !f.contains("[!"));
    // delete copies to the trash first, and restore puts it back
    let r = w.js(&["margin", "rm", &q]);
    assert_eq!(r["removed"], q.as_str());
    assert!(!w.snapshot()["margin/NUM/25.md"].contains(&q));
    assert!(w.snapshot().keys().any(|k| k.starts_with(".trash/") && k.ends_with(&format!("{q}.md"))));
    w.ok(&["margin", "restore", &q]);
    assert!(w.snapshot()["margin/NUM/25.md"].contains(&q));
    // no version of any page is kept anywhere
    w.page("A page");
    let keys: Vec<String> = w.snapshot().keys().cloned().collect();
    assert!(keys.iter().all(|k| !k.contains("version")), "{keys:?}");
}

#[test]
fn writing_asks_where_a_page_first_line_is_the_reference() {
    let Some(w) = Wb::new() else { return };
    let page = w.js(&["margin", "add", "Num 25:11", "A thought that is a page", "--page"]);
    let id = page["id"].as_str().unwrap();
    assert_eq!(page["title"], "Numbers 25:11");
    assert!(w.page_file(id).contains("Numbers 25:11\n\nA thought that is a page"));
    assert!(!w.snapshot().contains_key("margin/NUM/25.md"), "nothing in the margin");
    // Remember my choice is a setting
    w.ok(&["settings", "margin", "write_choice", "page"]);
    assert_eq!(w.js(&["settings", "margin"])["write_choice"], "page");
}

#[test]
fn grow_not_move() {
    let Some(w) = Wb::new() else { return };
    let n = w.note("Num 25:11", "A thought to grow");
    let g = w.js(&["margin", "grow", &n, "--title", "Phinehas"]);
    let page = g["page"].as_str().unwrap().to_string();
    let blocks = w.js(&["page", "blocks", &page]);
    assert_eq!(blocks["blocks"][0]["kind"], "fence");
    assert_eq!(blocks["blocks"][0]["text"], format!("```jot\n{n}\n```"), "the fence holds only the id");
    assert!(!w.page_file(&page).contains("A thought to grow"));
    // the note is still in the margin with "grew into"
    let v = w.js(&["margin", "Num 25:11"]);
    assert_eq!(v["notes"][0]["grew"][0]["title"], "Phinehas");
    // editing the note changes the one note, seen in both places
    w.ok(&["margin", "edit", &n, "Changed once"]);
    assert_eq!(w.js(&["page", "jots", &page])["blocks"][0]["note"]["text"], "Changed once");
    assert_eq!(w.js(&["margin", "Num 25:11"])["notes"][0]["text"], "Changed once");
    // the page is counted once among the pages naming the verse, and the overview lists the seed's verse
    assert_eq!(w.js(&["anchor", "Num 25:11", "--pages"])["count"], 1);
    assert_eq!(w.js(&["page", "overview", &page])["items"][0]["label"], "Numbers 25:11");
    // add to a page that exists: pages naming the verse come first
    let other = w.page("Study\n\nOn Numbers 25:11 again.");
    let t = w.js(&["margin", "targets", &n]);
    assert!(t["naming"].as_array().unwrap().iter().any(|p| p["id"] == other.as_str()));
    w.ok(&["margin", "grow", &n, "--into", &other]);
    assert!(w.page_file(&other).trim_end().ends_with(&format!("```jot\n{n}\n```")));
    // deleting the page leaves the note and removes the line
    w.ok(&["page", "rm", &page]);
    w.ok(&["page", "rm", &other]);
    let v = w.js(&["margin", "Num 25:11"]);
    assert_eq!(v["notes"][0]["text"], "Changed once");
    assert!(v["notes"][0]["grew"].as_array().unwrap().is_empty());
}

#[test]
fn the_librarys_margin_notes_open_books_then_chapters() {
    let Some(w) = Wb::new() else { return };
    w.note("Num 25:11", "a");
    w.note("Num 25:12", "b");
    w.note("Num 26:1", "c");
    w.note("Ps 106:30", "d");
    let l = w.js(&["margin", "list"]);
    assert_eq!(l["total"], 4);
    let books = l["books"].as_array().unwrap();
    assert_eq!((books[0]["code"].as_str(), books[0]["count"].as_u64()), (Some("NUM"), Some(3)));
    assert_eq!(books[1]["code"], "PSA", "the Bible's order");
    assert_eq!(books[0]["chapters"], json!([{"chapter": 25, "count": 2}, {"chapter": 26, "count": 1}]));
    let one = w.js(&["margin", "list", "--book", "NUM"]);
    assert_eq!(one["books"][0]["chapters"].as_array().unwrap().len(), 36);
    let map = w.js(&["margin", "list", "--map"]);
    assert_eq!(map["books"].as_array().unwrap().len(), 66);
    // the one search finds them as a group
    let f = w.js(&["find", "--kind", "margin", "c"]);
    assert_eq!(f["groups"][0]["kind"], "margin");
    assert_eq!(f["groups"][0]["results"][0]["title"], "Numbers 26:1");
    // a margin note cannot be saved into a folder: the save of a thing names pages, places, searches, documents, sittings
    w.ok(&["folder", "new", "F"]);
    let (code, _, _) = w.run(&["save", "margin:m_x", "--folder", "F"]);
    assert_ne!(code, 0, "a margin note is not a thing a folder holds");
}

#[test]
fn the_pencil_is_one_line_with_a_date_and_never_a_highlight() {
    let Some(w) = Wb::new() else { return };
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    let p = w.js(&["hl", "pencil", "Num 25:11"]);
    assert_eq!(p["pencil"], true);
    assert!(p["created"].as_str().unwrap().starts_with("20"));
    let m = w.js(&["marks", "Num 25"]);
    assert_eq!(m["pencil"].as_array().unwrap().len(), 1);
    assert_eq!(m["highlights"].as_array().unwrap().len(), 1, "the colour stays");
    assert!(w.snapshot()["highlights/NUM.json"].contains("\"created\""), "a date on every highlight");
    // the scripture block with marks shows the same colour and pencil, and a dot per verse that has something
    w.note("Num 25:11", "a thought");
    let id = w.page("Passage\n\n```scripture\nNum 25:10-12\n```");
    w.ok(&["block", "scripture", &id, "1", "--marks"]);
    assert!(w.page_file(&id).contains("```scripture\nNum 25:10-12\nmarks\n```"), "the fence holds the reference and the switch only");
    let s = w.js(&["page", "scripture", &id]);
    let verses = s["blocks"][0]["verses"].as_array().unwrap();
    assert_eq!(s["blocks"][0]["marks"], true);
    assert!(verses[0].get("dot").is_none() && verses[2].get("dot").is_none());
    assert_eq!(verses[1]["dot"]["notes"], 1);
    let runs = verses[1]["runs"].as_array().unwrap();
    assert!(runs.iter().any(|r| r["pencil"] == true && r["hl"] == "green"));
    w.ok(&["block", "scripture", &id, "1", "--no-marks"]);
    assert!(w.page_file(&id).contains("```scripture\nNum 25:10-12\n```"));
    // U again takes it off
    assert_eq!(w.js(&["hl", "pencil", "--clear", "Num 25:11"])["removed"], 1);
    assert!(w.js(&["marks", "Num 25"]).get("pencil").is_none());
}

#[test]
fn filters_list_the_kinds_with_counts() {
    let Some(w) = Wb::new() else { return };
    w.page("Zeal\n\nA page about zeal.");
    w.note("Num 25:11", "zeal in the margin");
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    let f = w.js(&["find", "zeal", "--sort", "edited"]);
    let kinds: Vec<&str> = f["groups"].as_array().unwrap().iter().map(|g| g["kind"].as_str().unwrap()).collect();
    for k in ["page", "save", "question", "margin", "highlight"] {
        assert!(kinds.contains(&k), "{k} in {kinds:?}");
    }
    let one = w.js(&["find", "zeal", "--kind", "margin"]);
    assert_eq!(one["count"], 1);
    assert_eq!(w.js(&["find", "--kind", "highlight"])["count"], 1);
}

#[test]
fn old_placed_notes_are_read_and_nothing_is_rewritten() {
    let Some(w) = Wb::new() else { return };
    let mut old = vec![];
    for k in 0..5 {
        old.push(w.js(&["note", "add", "Num 25:11", &format!("An old placed note {k}")])["id"].as_str().unwrap().to_string());
    }
    let before = w.snapshot();
    let v = w.js(&["margin", "Num 25:11"]);
    let legacy: Vec<&str> = v["legacy"].as_array().unwrap().iter().map(|n| n["id"].as_str().unwrap()).collect();
    for id in &old {
        assert!(legacy.contains(&id.as_str()), "{id} shows in its verse's margin");
    }
    assert_eq!(v["counts"]["notes"], 5);
    let ch = w.js(&["margin", "Num 25"]);
    assert_eq!(ch["verses"].as_array().unwrap().iter().find(|x| x["v"] == 11).unwrap()["notes"], 5);
    // it opens as today
    assert!(w.js(&["note", "show", &old[0]])["text"].as_str().unwrap().contains("An old placed note 0"));
    // the read-only list of MK-18
    let list = w.js(&["study", "check", "--margin-move"]);
    assert_eq!(list["rows"].as_array().unwrap().len(), 5);
    assert_eq!(list["margin_notes"], 5);
    assert_eq!(before, w.snapshot(), "reading and listing rewrite no file");
}

#[test]
fn every_new_command_is_in_the_help() {
    let Some(w) = Wb::new() else { return };
    let help = w.ok(&["help"]);
    // each command by its whole name (a line is "  <name>  <what it does>"), so "margin" does not stand for "margin restore"
    let names: Vec<&str> = help.lines().filter_map(|l| l.trim_start().split("  ").next()).collect();
    for c in [
        "margin", "margin add", "margin edit", "margin rm", "margin restore", "margin question", "margin grow", "margin targets", "margin list",
        "page overview", "page jots", "hl pencil", "anchor", "refs", "block scripture", "page scripture", "page blocks", "find", "study check",
    ] {
        assert!(names.contains(&c), "wb help lists {c}");
    }
}

#[test]
fn the_study_check_counts_the_margin_and_the_pencil_and_writes_nothing() {
    let Some(w) = Wb::new() else { return };
    w.note("Num 25:11", "one");
    w.note("Num 25:12", "two");
    w.note("Num 26:1", "three");
    w.ok(&["hl", "pencil", "Num 25:11"]);
    let before = w.snapshot();
    let c = w.js(&["study", "check"]);
    assert_eq!(c["margin"], json!({"files": 2, "notes": 3}));
    assert_eq!(c["pencil"], json!({"files": 1, "lines": 1}));
    assert_eq!(before, w.snapshot(), "the check writes nothing");
}

#[test]
fn a_deleted_margin_note_is_not_listed_in_the_trash_and_restore_puts_it_back() {
    let Some(w) = Wb::new() else { return };
    let id = w.note("Num 25:11", "to be deleted");
    w.ok(&["margin", "rm", &id]);
    let trash = w.js(&["trash"]);
    assert!(trash["notes"].as_array().unwrap().is_empty(), "the Trash view lists notes and questions, not margin notes: {trash}");
    assert!(w.snapshot().keys().any(|k| k.starts_with(".trash/") && k.ends_with(&format!("{id}.md"))));
    w.ok(&["trash", "empty", "--days", "0"]);
    w.ok(&["margin", "restore", &id]);
    assert!(w.snapshot()["margin/NUM/25.md"].contains(&id), "Empty trash leaves the copy, so Undo still works");
}
