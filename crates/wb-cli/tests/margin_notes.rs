//! design/features/marks round 7, T4 (rows 17 to 19, 29, 30, 52): margin notes, kept in `margin/<BOOK>/<chapter>.md`.
//! Each test runs `wb` on a generated scratch study. No scripture is typed here.

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::Write;
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
        let dir = std::env::temp_dir()
            .join("bible-workbench-rs")
            .join("margin-tests")
            .join(format!(
                "{}-{}",
                std::process::id(),
                N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Some(Wb { dir })
    }
    fn go(&self, args: &[&str], stdin: Option<&str>) -> (i32, String, String) {
        let mut child = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(args)
            .env("WB_STUDY_DIR", &self.dir)
            .env_remove("WB_DOCS_DIR")
            .env("WB_NO_OPEN", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        if let Some(t) = stdin {
            child.stdin.take().unwrap().write_all(t.as_bytes()).unwrap();
        }
        drop(child.stdin.take());
        let out = child.wait_with_output().unwrap();
        (
            out.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&out.stdout).into(),
            String::from_utf8_lossy(&out.stderr).into(),
        )
    }
    fn ok(&self, args: &[&str]) -> String {
        let (code, out, err) = self.go(args, None);
        assert_eq!(code, 0, "wb {args:?}: {err}");
        out
    }
    fn js(&self, args: &[&str]) -> Value {
        serde_json::from_str(&self.ok(args)).unwrap_or_else(|e| panic!("wb {args:?}: {e}"))
    }
    fn js_in(&self, args: &[&str], stdin: &str) -> Value {
        let (code, out, err) = self.go(args, Some(stdin));
        assert_eq!(code, 0, "wb {args:?}: {err}");
        serde_json::from_str(&out).unwrap()
    }
    fn fails(&self, args: &[&str]) -> String {
        let (code, out, err) = self.go(args, None);
        assert_eq!(code, 1, "wb {args:?} should fail: {out}");
        err + &out
    }
    fn page(&self, text: &str) -> String {
        self.js(&["page", "new", text])["id"]
            .as_str()
            .unwrap()
            .to_string()
    }
    fn page_file(&self, id: &str) -> String {
        self.snapshot()
            .into_iter()
            .find(|(k, _)| k.ends_with(&format!("{id}.md")))
            .unwrap()
            .1
    }
    fn margin_file(&self, book: &str, chapter: u32) -> String {
        std::fs::read_to_string(
            self.dir
                .join("margin")
                .join(book)
                .join(format!("{chapter}.md")),
        )
        .unwrap()
    }
    fn snapshot(&self) -> BTreeMap<String, String> {
        fn walk(root: &Path, d: &Path, out: &mut BTreeMap<String, String>) {
            for e in std::fs::read_dir(d).into_iter().flatten().flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(root, &p, out);
                } else {
                    out.insert(
                        p.strip_prefix(root)
                            .unwrap()
                            .to_string_lossy()
                            .replace('\\', "/"),
                        std::fs::read_to_string(&p).unwrap_or_default(),
                    );
                }
            }
        }
        let mut out = BTreeMap::new();
        walk(&self.dir, &self.dir, &mut out);
        out
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

#[test]
fn a_margin_note_is_kept_in_its_chapters_file_at_a_verse_a_span_or_the_chapter() {
    let Some(w) = Wb::new() else { return };
    let v = w.js(&["mark", "note", "Num", "25:11", "Zeal, in my own words."]);
    assert_eq!(
        (v["at"].clone(), v["kind"].clone(), v["label"].clone()),
        (json!("NUM.25:11"), json!("verse"), json!("Numbers 25:11"))
    );
    assert!(
        v["id"].as_str().unwrap().starts_with("m_") && v["changed"] == "" && v["grew"] == json!([])
    );
    let sp = w.js(&["mark", "note", "Num 25:10-13", "A span."]);
    assert_eq!(
        (sp["at"].clone(), sp["kind"].clone()),
        (json!("NUM.25:10-13"), json!("span"))
    );
    // the words may come from standard input (-), and a chapter note has no verse (row 18)
    let ch = w.js_in(
        &["mark", "note", "Num 25", "-"],
        "From the keyboard.\nTwo lines.",
    );
    assert_eq!(
        (ch["at"].clone(), ch["kind"].clone(), ch["text"].clone()),
        (
            json!("NUM.25"),
            json!("chapter"),
            json!("From the keyboard.\nTwo lines.")
        )
    );
    // one file, readable Markdown: front matter, the chapter, each note under a line naming its place with its marker
    let f = w.margin_file("NUM", 25);
    assert!(
        f.starts_with("---\nbook: \"NUM\"\nchapter: 25\n---\n\n# Numbers 25\n\n"),
        "{f}"
    );
    let marker = format!(
        "<!-- margin id={} at=NUM.25:11 created={} -->",
        v["id"].as_str().unwrap(),
        v["created"].as_str().unwrap()
    );
    assert!(
        f.contains(&format!(
            "## Numbers 25:11\n{marker}\nZeal, in my own words.\n"
        )),
        "{f}"
    );
    assert!(
        f.contains("## Numbers 25\n<!-- margin id=")
            && f.contains("## Numbers 25:10\u{2013}13\n<!-- margin id="),
        "{f}"
    );
    // the chapter's own note comes first, then by verse
    let list = w.js(&["mark", "notes", "Num 25"]);
    assert_eq!(list["count"], 3);
    let ats: Vec<&str> = list["notes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["at"].as_str().unwrap())
        .collect();
    assert_eq!(ats, ["NUM.25", "NUM.25:10-13", "NUM.25:11"]);
    assert_eq!(w.js(&["mark", "notes", "Num 26"])["count"], 0);
    // across chapters is refused (MK7-27), and a note is text only (MK7-28)
    assert!(w
        .fails(&["mark", "note", "Num 25:30-26:2", "x"])
        .contains("one chapter"));
    assert!(w
        .fails(&["mark", "note", "Num 25:11", "# A heading"])
        .contains("no headings"));
    assert!(w
        .fails(&["mark", "note", "Num 25:11", "```word\nH7065\n```"])
        .contains("no blocks"));
    assert!(w
        .fails(&["mark", "note", "Num 25:11", "  "])
        .contains("Write the note"));
    assert!(!w.dir.join("margin/NUM/26.md").exists());
}

#[test]
fn rewriting_a_note_sets_changed_and_keeps_its_id_place_and_created() {
    let Some(w) = Wb::new() else { return };
    let a = w.js(&["mark", "note", "Num 25:11", "First."]);
    let b = w.js(&["mark", "note", "Num 25:12", "Other."]);
    let id = a["id"].as_str().unwrap();
    let e = w.js(&["mark", "note", id, "--text", "Second."]);
    assert_eq!(
        (
            e["id"].clone(),
            e["at"].clone(),
            e["created"].clone(),
            e["text"].clone()
        ),
        (
            a["id"].clone(),
            json!("NUM.25:11"),
            a["created"].clone(),
            json!("Second.")
        )
    );
    // written the same day, so changed is the day it was made
    assert_eq!(e["changed"], a["created"]);
    let f = w.margin_file("NUM", 25);
    let day = a["created"].as_str().unwrap();
    assert!(
        f.contains(&format!("at=NUM.25:11 created={day} changed={day}"))
            && f.contains("Second.")
            && !f.contains("First."),
        "{f}"
    );
    assert!(f.contains("Other."), "the other note is as it was");
    let shown = w.js(&["mark", "notes", "Num 25"]);
    assert_eq!(shown["notes"][1]["id"], b["id"]);
    assert_eq!(shown["notes"][1]["changed"], "");
    assert!(w
        .fails(&["mark", "note", "m_nope", "--text", "x"])
        .contains("No margin note"));
    // words from standard input
    w.js_in(&["mark", "note", id, "--text", "-"], "Third, typed.");
    assert_eq!(
        w.js(&["mark", "notes", "Num 25"])["notes"][0]["text"],
        "Third, typed."
    );
}

#[test]
fn growing_a_note_makes_a_page_and_the_note_stays_with_a_link() {
    let Some(w) = Wb::new() else { return };
    let n = w.js(&["mark", "note", "Num 25:11", "A thought that wants room."]);
    let id = n["id"].as_str().unwrap();
    let g = w.js(&["mark", "grow", id]);
    let page = g["page"].as_str().unwrap().to_string();
    assert_eq!(g["title"], "Numbers 25:11");
    let file = w.page_file(&page);
    assert!(file.contains("A thought that wants room."), "{file}");
    // the note stays, and says what it grew into
    let shown = w.js(&["mark", "notes", "Num 25"])["notes"][0].clone();
    assert_eq!(
        (shown["id"].clone(), shown["text"].clone()),
        (n["id"].clone(), n["text"].clone())
    );
    assert_eq!(
        shown["grew"],
        json!([{"id": page, "title": "Numbers 25:11"}])
    );
    assert_eq!(g["note"]["grew"], shown["grew"]);
    assert!(w.margin_file("NUM", 25).contains(&format!("grew={page}")));
    // deleting the page leaves the note, and the link says the page is gone
    w.ok(&["page", "rm", &page, "--yes", "--now"]);
    let after = w.js(&["mark", "notes", "Num 25"])["notes"][0].clone();
    assert_eq!(after["text"], n["text"]);
    assert_eq!(after["grew"][0]["gone"], true);
    // a title may be given, and a note may grow again
    let g2 = w.js(&["mark", "grow", id, "--title", "Zeal and what follows"]);
    assert_eq!(g2["title"], "Zeal and what follows");
    assert_eq!(
        w.js(&["mark", "notes", "Num 25"])["notes"][0]["grew"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(w
        .fails(&["mark", "grow", "m_nope"])
        .contains("No margin note"));
}

#[test]
fn a_deleted_note_waits_in_the_trash_and_can_be_put_back() {
    let Some(w) = Wb::new() else { return };
    let a = w.js(&["mark", "note", "Num 25:11", "Keep me."]);
    let b = w.js(&["mark", "note", "Num 25:12", "And me."]);
    let id = a["id"].as_str().unwrap();
    let d = w.js(&["mark", "rm", id]);
    assert_eq!(
        (d["deleted"].clone(), d["days"].clone()),
        (a["id"].clone(), json!(7))
    );
    let trash_name = d["trash"].as_str().unwrap();
    assert!(
        w.dir.join(".trash").join(trash_name).exists()
            && trash_name.ends_with(&format!("-{id}.md"))
    );
    let left = w.js(&["mark", "notes", "Num 25"]);
    assert_eq!(
        (left["count"].clone(), left["notes"][0]["id"].clone()),
        (json!(1), b["id"].clone())
    );
    assert_eq!(w.js(&["trash"])["margin"][0]["id"], a["id"]);
    assert!(w.fails(&["mark", "rm", id]).contains("No mark"));
    let back = w.js(&["mark", "restore", id]);
    assert_eq!(
        (
            back["id"].clone(),
            back["text"].clone(),
            back["created"].clone()
        ),
        (a["id"].clone(), a["text"].clone(), a["created"].clone())
    );
    assert!(!w.dir.join(".trash").join(trash_name).exists());
    assert_eq!(w.js(&["mark", "notes", "Num 25"])["count"], 2);
    // the last notes out remove the file, and putting one back makes it again
    w.ok(&["mark", "rm", id, b["id"].as_str().unwrap()]);
    assert!(!w.dir.join("margin/NUM/25.md").exists());
    w.ok(&["mark", "restore", id]);
    assert_eq!(w.js(&["mark", "notes", "Num 25"])["count"], 1);
    // a note put away for 7 days is erased by wb trash empty, like a mark
    w.ok(&["mark", "rm", id]);
    let name = w.js(&["trash"])["margin"][0]["name"]
        .as_str()
        .unwrap()
        .to_string();
    let old = format!("20200101-000000{}", &name[15..]);
    std::fs::rename(
        w.dir.join(".trash").join(&name),
        w.dir.join(".trash").join(&old),
    )
    .unwrap();
    assert!(w.js(&["trash", "empty"])["erased"]
        .as_array()
        .unwrap()
        .iter()
        .any(|n| *n == old));
}

#[test]
fn references_and_questions_in_a_note_are_found_by_themselves() {
    let Some(w) = Wb::new() else { return };
    let q = w.js(&[
        "mark",
        "note",
        "Num 25:11",
        "> [!question] How does this meet Num 25:13?",
    ]);
    w.js(&[
        "mark",
        "note",
        "Num 25",
        "A plain note that names Num 25:13 once.",
    ]);
    // the question is listed with where it was written (MK-11)
    let qs = w.js(&["questions"]);
    let mine: Vec<&Value> = qs["questions"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|x| x["page_kind"] == "margin")
        .collect();
    assert_eq!(mine.len(), 1, "{qs}");
    assert_eq!(
        (
            mine[0]["text"].clone(),
            mine[0]["status"].clone(),
            mine[0]["page"].clone()
        ),
        (
            json!("How does this meet Num 25:13?"),
            json!("open"),
            q["id"].clone()
        )
    );
    assert_eq!(
        (mine[0]["label"].clone(), mine[0]["anchor"].clone()),
        (json!("Numbers 25:11"), json!("NUM.25:11"))
    );
    let listed = w.js(&["mark", "notes", "Num 25"]);
    assert_eq!(listed["notes"][1]["question"], true);
    // the verses a note names come with the pages that name them
    let named = w.js(&["anchor", "Num 25:13", "--pages"]);
    assert_eq!(named["count"], 2, "{named}");
    assert!(named["pages"]
        .as_array()
        .unwrap()
        .iter()
        .all(|p| p["kind"] == "margin" && p["title"].as_str().unwrap().starts_with("Numbers 25")));
    assert_eq!(w.js(&["anchor", "Num 25:20", "--pages"])["count"], 0);
    // the plain `wb find` and the one search both reach a note's words (row 52), as a group of their own
    let f = w.js(&["find", "plain"]);
    assert_eq!(
        (
            f["margin"].as_array().unwrap().len(),
            f["notes"].as_array().unwrap().len()
        ),
        (1, 0)
    );
    assert_eq!(f["margin"][0]["at"], "NUM.25");
    let one = w.js(&["find", "plain", "--kind", "margin"]);
    assert_eq!(
        (one["count"].clone(), one["groups"][0]["kind"].clone()),
        (json!(1), json!("margin"))
    );
    let all = w.js(&["find", "meet", "--sort", "title"]);
    let kinds: Vec<&str> = all["groups"]
        .as_array()
        .unwrap()
        .iter()
        .map(|g| g["kind"].as_str().unwrap())
        .collect();
    assert!(
        kinds.contains(&"margin") && kinds.contains(&"question"),
        "{kinds:?}"
    );
    assert_eq!(
        w.js(&["find", "--kind", "margin", "--has-question"])["count"],
        1
    );
    // a page and a margin note are searched together
    w.page("A page\n\nplain words too");
    let both = w.js(&["find", "plain", "--sort", "title"]);
    let counts: Vec<(&str, u64)> = both["groups"]
        .as_array()
        .unwrap()
        .iter()
        .map(|g| (g["kind"].as_str().unwrap(), g["count"].as_u64().unwrap()))
        .filter(|(_, n)| *n > 0)
        .collect();
    assert_eq!(counts, [("page", 1), ("margin", 1)], "{both}");
}

#[test]
fn old_margin_files_are_read_as_they_are_and_never_rewritten_by_reading() {
    let Some(w) = Wb::new() else { return };
    // a file as rounds 1 to 6 wrote it: `written=`, a `words=` of selected words, a line the person added above the notes
    let old = "---\nbook: \"NUM\"\nchapter: 25\n---\n\n# Numbers 25\n\nMy own line above the notes.\n\n## Numbers 25:11\n<!-- margin id=m_20261110090000123ab12 at=NUM.25:11 written=2026-11-10 words=\"zeal\" -->\nAn old thought.\nOn two lines.\n\n## Numbers 25:10\u{2013}13\n<!-- margin id=m_20261111090000123cd34 at=NUM.25:10-13 written=2026-11-11 -->\n> [!question] An old question?\n";
    let p = w.dir.join("margin/NUM/25.md");
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(&p, old).unwrap();
    let before = w.snapshot();
    let list = w.js(&["mark", "notes", "Num 25"]);
    assert_eq!(list["count"], 2);
    let first = &list["notes"][0];
    assert_eq!(
        (
            first["id"].clone(),
            first["created"].clone(),
            first["words"].clone(),
            first["text"].clone()
        ),
        (
            json!("m_20261110090000123ab12"),
            json!("2026-11-10"),
            json!("zeal"),
            json!("An old thought.\nOn two lines.")
        )
    );
    assert_eq!(
        (
            list["notes"][1]["kind"].clone(),
            list["notes"][1]["question"].clone()
        ),
        (json!("span"), json!(true))
    );
    assert_eq!(
        w.js(&["questions"])["questions"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|q| q["page_kind"] == "margin")
            .count(),
        1
    );
    w.js(&["find", "thought"]);
    w.js(&["anchor", "Num 25:11", "--pages"]);
    assert_eq!(before, w.snapshot(), "reading writes nothing");
    // a change to one note keeps the other note, the person's own line, and the old marker's facts
    w.ok(&[
        "mark",
        "note",
        "m_20261110090000123ab12",
        "--text",
        "A revised thought.",
    ]);
    let f = w.margin_file("NUM", 25);
    assert!(
        f.contains("My own line above the notes.") && f.contains("> [!question] An old question?"),
        "{f}"
    );
    assert!(
        f.contains("created=2026-11-10 changed=")
            && f.contains("words=\"zeal\"")
            && f.contains("A revised thought."),
        "{f}"
    );
    assert_eq!(w.js(&["mark", "notes", "Num 25"])["count"], 2);
    // an old note is deleted and restored like a new one
    w.ok(&["mark", "rm", "m_20261111090000123cd34"]);
    assert_eq!(w.js(&["mark", "notes", "Num 25"])["count"], 1);
    w.ok(&["mark", "restore", "m_20261111090000123cd34"]);
    assert_eq!(
        w.js(&["mark", "notes", "Num 25"])["notes"][0]["text"],
        "> [!question] An old question?"
    );
}

#[test]
fn the_study_check_counts_margin_note_files() {
    let Some(w) = Wb::new() else { return };
    w.js(&["mark", "note", "Num 25:11", "One."]);
    w.js(&["mark", "note", "Num 26", "Two."]);
    w.js(&["mark", "note", "Psa 1:1", "Three."]);
    assert_eq!(w.js(&["study", "check"])["margin"], json!({"files": 3}));
}

#[test]
fn the_readers_question_marker_includes_questions_written_in_a_margin_note() {
    let Some(w) = Wb::new() else { return };
    w.js(&["mark", "note", "Num 25:11", "> [!question] Why here?"]);
    w.js(&["mark", "note", "Num 25:12", "A plain thought."]);
    w.js(&[
        "mark",
        "note",
        "Num 25",
        "> [!question] A chapter question.",
    ]);
    let store = wb_core::store::Store::open(&w.dir).unwrap();
    let qs = wb_core::notebook::chapter_questions(&store, "NUM", 25);
    let verses: Vec<u64> = qs.iter().map(|q| q["v"].as_u64().unwrap()).collect();
    assert_eq!(verses, vec![11], "{qs:?}");
    assert_eq!(qs[0]["text"], "Why here?");
}

#[test]
fn mark_at_lists_the_margin_notes_covering_the_place_beside_its_marks() {
    let Some(w) = Wb::new() else { return };
    w.ok(&[
        "mark",
        "add",
        "Num 25:11",
        "--kind",
        "box",
        "--color",
        "blue",
    ]);
    let one = w.js(&["mark", "note", "Num 25:11", "on the verse"]);
    let span = w.js(&["mark", "note", "Num 25:10-13", "on a span"]);
    w.ok(&["mark", "note", "Num 25:14", "elsewhere"]);
    w.ok(&["mark", "note", "Num 25", "the chapter's own"]);
    w.ok(&["mark", "note", "Num 26:11", "another chapter"]);
    let at = w.js(&["mark", "at", "Num 25:11"]);
    assert_eq!(
        at["marks"].as_array().unwrap().len(),
        1,
        "the marks are as they were"
    );
    let ids: Vec<&str> = at["notes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["id"].as_str().unwrap())
        .collect();
    assert_eq!(ids, [span["id"].as_str().unwrap(), one["id"].as_str().unwrap()], "the span's note (from verse 10) and the verse's, in the order of their first verses; no chapter note");
    assert_eq!(
        (
            at["notes"][1]["text"].clone(),
            at["notes"][1]["label"].clone()
        ),
        (json!("on the verse"), json!("Numbers 25:11"))
    );
    // words of a verse name that verse; a run of verses finds every note in it
    assert_eq!(
        w.js(&["mark", "at", "NUM.25:11.1-25:11.2"])["notes"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        w.js(&["mark", "at", "Num 25:14"])["notes"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        w.js(&["mark", "at", "Num 25:12-14"])["notes"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(w.js(&["mark", "at", "Num 25:15"])["notes"], json!([]));
    // a verse with only a note has no marks and still lists its note
    let only = w.js(&["mark", "at", "Num 25:13"]);
    assert_eq!(
        (
            only["marks"].clone(),
            only["notes"].as_array().unwrap().len()
        ),
        (json!([]), 1)
    );
    // nothing written
    let before = w.snapshot();
    w.js(&["mark", "at", "Num 25:11"]);
    assert_eq!(before, w.snapshot());
}
