//! The data parts of the Python app's tests/test_cli.py, carried over: the `wb` binary, run on a scratch study folder of
//! its own. (Its window-relay, raw-API, Craft and PDF tests belong to later phases.) No verse is typed here: where the
//! Python tests quote scripture, these compare with what `wb text` gives from the database.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::io::Write;
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
        let dir = std::env::temp_dir()
            .join("bible-workbench-rs")
            .join("cli-tests")
            .join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Some(Wb { dir })
    }

    /// Runs wb; → (exit code, stdout, stderr).
    fn run(&self, args: &[&str], stdin: Option<&str>) -> (i32, String, String) {
        let mut c = Command::new(env!("CARGO_BIN_EXE_wb"));
        c.args(args).env("WB_STUDY_DIR", &self.dir).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = c.spawn().unwrap();
        if let Some(text) = stdin {
            use std::io::Write;
            child.stdin.take().unwrap().write_all(text.as_bytes()).unwrap();
        }
        drop(child.stdin.take());
        let out = child.wait_with_output().unwrap();
        (out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).into(), String::from_utf8_lossy(&out.stderr).into())
    }

    fn ok(&self, args: &[&str]) -> String {
        let (code, out, err) = self.run(args, None);
        assert_eq!(code, 0, "wb {args:?}: {err}");
        out
    }

    fn js(&self, args: &[&str]) -> Value {
        serde_json::from_str(&self.ok(args)).unwrap_or_else(|e| panic!("wb {args:?}: {e}"))
    }

    /// The error output of a command that must fail.
    fn fails(&self, args: &[&str]) -> String {
        let (code, out, err) = self.run(args, None);
        assert_eq!(code, 1, "wb {args:?} should fail: {out}");
        err + &out
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
        let _ = std::fs::remove_dir_all(self.docs()); // the documents made from this scratch folder, beside it
    }
}

impl Wb {
    /// Where documents from this scratch folder go: beside it, never the person's Documents folder.
    fn docs(&self) -> PathBuf {
        self.dir.with_file_name(format!("{}-documents", self.dir.file_name().unwrap().to_string_lossy()))
    }
}

fn verse_texts(wb: &Wb, place: &str) -> Vec<String> {
    wb.js(&["text", place, "--json"])["verses"].as_array().unwrap().iter().map(|v| v["text"].as_str().unwrap().to_string()).collect()
}

// ---- reading ----

#[test]
fn scripture_is_verbatim_with_its_reference() {
    let Some(wb) = Wb::new() else { return };
    let text = wb.ok(&["text", "John 3:16"]);
    assert!(text.starts_with("John 3:16 (KJV)\n"));
    assert!(text.contains(&verse_texts(&wb, "John 3:16")[0]));
    assert_eq!(wb.js(&["text", "Jude", "--json"])["verses"].as_array().unwrap().len(), 25);
}

#[test]
fn the_ylt_and_lists_of_places() {
    let Some(wb) = Wb::new() else { return };
    let d = wb.js(&["text", "John 3:16; Rom 5:8", "--version", "ylt", "--json"]);
    assert_eq!((d["version"].clone(), d["verses"].as_array().unwrap().len()), (json!("YLT"), 2));
    let spans: Vec<Value> = d["verses"].as_array().unwrap().iter().map(|v| v["span"].clone()).collect();
    assert_eq!(spans, vec![json!(0), json!(1)]);
}

#[test]
fn copy_lays_out_the_same_words_with_their_references() {
    let Some(wb) = Wb::new() else { return };
    let john = verse_texts(&wb, "John 3:16")[0].clone();
    assert_eq!(wb.ok(&["copy", "John 3:16", "--no-clip"]).trim(), format!("John 3:16 {john}"));
    assert_eq!(wb.ok(&["copy", "John 3:16", "--format", "quote", "--no-clip"]).trim(), format!("“{john}” (John 3:16 KJV)"));
    assert!(wb.ok(&["copy", "Rom 5:8", "--short", "--no-clip"]).starts_with("Rom 5:8 "));
    let vs = verse_texts(&wb, "John 3:16-17");
    assert_eq!(wb.ok(&["copy", "John 3:16-17", "--no-clip"]).trim(), format!("John 3:16 {}\nJohn 3:17 {}", vs[0], vs[1]));
    assert_eq!(wb.ok(&["copy", "John 3:16-17", "--format", "block", "--no-clip"]).trim(), format!("John 3:16–17 (KJV)\n16 {}\n17 {}", vs[0], vs[1]));
    assert_eq!(wb.ok(&["copy", "John 3:16-17", "--format", "para", "--no-clip"]).trim(), format!("John 3:16–17 (KJV)\n16 {} 17 {}", vs[0], vs[1]));
    assert_eq!(wb.ok(&["copy", "John 3:16; Rom 5:8", "--format", "quote", "--no-clip"]).trim().matches('\n').count(), 1); // places stay apart
    assert!(wb.ok(&["copy", "John 3:36-4:1", "--format", "block", "--no-clip"]).lines().nth(1).unwrap().starts_with("3:36 "));
    assert!(wb.ok(&["copy", "John 3:16", "--version", "ylt", "--no-clip"]).contains("John 3:16 (YLT) "));
    assert!(wb.fails(&["copy", "Zzz 1:1", "--no-clip"]).contains("No book called"));
}

#[test]
fn a_preview_is_the_same_words_as_the_text() {
    let Some(wb) = Wb::new() else { return };
    let d = wb.js(&["preview", "John 3:16", "--json"]);
    assert_eq!((d["kind"].clone(), d["label"].clone(), d["version"].clone(), d["more"].clone()), (json!("verses"), json!("John 3:16"), json!("KJV"), json!(0)));
    assert_eq!(d["verses"][0]["text"], json!(verse_texts(&wb, "John 3:16")[0]));
    let n = |p: &str| {
        let d = wb.js(&["preview", p, "--json"]);
        (d["verses"].as_array().unwrap().len(), d["more"].as_u64().unwrap())
    };
    assert_eq!(n("Psalm 23"), (6, 0));
    assert_eq!(n("Psalm 117"), (2, 0));
    assert_eq!(n("John 3"), (6, 30));
    assert!(wb.ok(&["preview", "John 3"]).contains("... and 30 more"));
    let g = wb.js(&["preview", "g26", "--json"]);
    assert_eq!((g["kind"].clone(), g["strong"].clone()), (json!("strong"), json!("G26")));
    assert_eq!(g["definition"], wb.js(&["strong", "G26"])["definition"]);
    assert!(wb.ok(&["preview", "G26"]).contains("G26 "));
    assert!(wb.fails(&["preview", "H9999"]).contains("no entry numbered"));
    assert!(wb.fails(&["preview", "Zzz 1:1"]).contains("No book called"));
}

#[test]
fn a_bad_reference_is_an_error_not_a_trace() {
    let Some(wb) = Wb::new() else { return };
    assert!(wb.fails(&["text", "John 99"]).contains("21 chapters"));
    assert!(wb.fails(&["text", "Zzz 1:1"]).contains("No book called"));
}

#[test]
fn lookups() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["count", "zeal"])["occurrences"], 16);
    assert!(wb.js(&["count", "H7065"])["by_book"].get("Numbers").is_some());
    assert_eq!(wb.js(&["uses", "zeal", "--scope", "gospels"])["scope"], "40,41,42,43");
    assert_eq!(wb.js(&["strong", "H7065"])["strong"], "H7065");
    assert!(!wb.js(&["search", "so", "loved", "--scope", "john"])["rows"].as_array().unwrap().is_empty());
}

// ---- your study work ----

#[test]
fn places_from_a_list_go_into_a_thread_in_one_write() {
    let Some(wb) = Wb::new() else { return };
    let t = wb.js(&["thread", "add-many", "Many", "Num 25:11", "Rom 10:2", "H7065", "Rom 10:2"]);
    assert_eq!((t["added"].clone(), t["already"].clone(), t["count"].clone()), (json!(["NUM.25:11", "ROM.10:2", "H7065"]), json!(0), json!(3)));
    let t = wb.js(&["thread", "add-many", "Many", "Rom 10:2", "John 2:17"]);
    assert_eq!((t["added"].clone(), t["already"].clone(), t["count"].clone()), (json!(["JHN.2:17"]), json!(1), json!(4)));
    assert!(wb.fails(&["thread", "add-many", "Many", "NUM.25:99", "John 3:16"]).contains("not in the text")); // none go in
    assert_eq!(wb.js(&["thread", "show", "Many"])["members"][3]["anchor"], "JHN.2:17");
}

#[test]
fn a_search_goes_into_a_thread() {
    let Some(wb) = Wb::new() else { return };
    let d = wb.js(&["search", "zeal", "--scope", "gospels"]);
    let t = wb.js(&["thread", "from-search", "Found", "zeal", "--scope", "gospels"]);
    assert_eq!((t["added"].as_array().unwrap().len() as u64, t["id"].clone()), (d["verses"].as_u64().unwrap(), json!("found")));
    let r = &d["rows"][0]["ref"];
    assert_eq!(t["added"][0], json!(format!("{}.{}:{}", r["code"].as_str().unwrap(), r["c"], r["v"])));
    assert_eq!(wb.js(&["thread", "from-search", "Found", "zeal", "--scope", "gospels"])["already"], d["verses"]);
    let got = wb.js(&["thread", "from-search", "Some", "zeal*", "--only", "Rom 10:2; Num 25", "--dry-run"]);
    assert_eq!(got["would_add"], json!(["ROM.10:2", "NUM.25:11", "NUM.25:13"])); // in the order named
    assert!(wb.fails(&["thread", "from-search", "Some", "zeal", "--only", "John 3:16", "--dry-run"]).contains("is not in these results"));
    assert!(wb.fails(&["thread", "from-search", "Too many", "the"]).contains("is the most at once"));
    assert!(wb.js(&["thread", "list", "too"]).as_array().unwrap().is_empty()); // refused before anything was started
}

#[test]
fn occurrences_go_into_a_thread_as_the_marked_words_or_whole_verses() {
    let Some(wb) = Wb::new() else { return };
    let t = wb.js(&["thread", "from-uses", "Occ", "H7065", "--word", "zealous", "--cat", "both", "--scope", "Num"]);
    let added: Vec<String> = t["added"].as_array().unwrap().iter().map(|a| a.as_str().unwrap().to_string()).collect();
    assert_eq!(added.len(), 2);
    assert!(added.iter().all(|a| a.starts_with("NUM.25:1") && a.matches('.').count() >= 2), "{added:?}"); // the words, not the verses
    let w = wb.js(&["anchor", &added[0]]);
    assert!(w["quote"].as_str().unwrap().contains("zealous"));
    assert!(w["strongs"].as_array().unwrap().contains(&json!("H7065")));
    let v = wb.js(&["thread", "from-uses", "Occ verses", "H7065", "--word", "zealous", "--cat", "both", "--scope", "Num", "--verses"]);
    assert_eq!(v["added"], json!(["NUM.25:11", "NUM.25:13"]));
    let e = wb.js(&["thread", "from-uses", "Eng", "zeal", "--scope", "Rom", "--dry-run"]);
    assert_eq!(e["would_add"].as_array().unwrap().len(), 1);
    assert!(wb.js(&["anchor", e["would_add"][0].as_str().unwrap()])["quote"].as_str().unwrap().contains("zeal"));
}

#[test]
fn a_thread_can_be_reordered_and_the_order_stays() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "add-many", "Order", "Rom 10:2", "H7065", "Num 25:13", "Num 25:11", "Gen 1:1", "NUM.25:11.24"]);
    let labels = || -> Vec<String> { wb.js(&["thread", "show", "Order"])["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect() };
    assert_eq!(labels(), vec!["ROM.10:2", "H7065", "NUM.25:13", "NUM.25:11", "GEN.1:1", "NUM.25:11.24"]);
    let m = wb.js(&["thread", "move", "Order", "Num 25:13", "up"]);
    assert_eq!((m["moved"].clone(), m["position"].clone(), m["anchor"].clone()), (json!(true), json!(2), json!("NUM.25:13")));
    assert_eq!(labels(), vec!["ROM.10:2", "NUM.25:13", "H7065", "NUM.25:11", "GEN.1:1", "NUM.25:11.24"]);
    wb.js(&["thread", "move", "Order", "1", "last"]);
    assert_eq!(labels().last().unwrap(), "ROM.10:2");
    wb.js(&["thread", "move", "Order", "H7065", "first"]);
    assert_eq!(labels()[0], "H7065");
    wb.js(&["thread", "move", "Order", "Gen 1:1", "2"]);
    assert_eq!(labels()[1], "GEN.1:1");
    assert_eq!(wb.js(&["thread", "move", "Order", "H7065", "up"])["moved"], false);
    wb.js(&["thread", "move", "Order", "H7065", "99"]);
    assert_eq!(labels().last().unwrap(), "H7065");
    assert!(wb.fails(&["thread", "move", "Order", "Num 25:11-13", "up"]).contains("Which one?"));
    assert!(wb.fails(&["thread", "move", "Order", "John 3:16", "up"]).contains("nothing at"));
    assert!(wb.fails(&["thread", "move", "Order", "9", "up"]).contains("no number 9"));
    assert!(wb.fails(&["thread", "move", "Order", "1", "sideways"]).contains("Move it up"));
    let before = labels();
    let s = wb.js(&["thread", "sort", "Order"]);
    assert_eq!((s["changed"].clone(), s["before"].clone()), (json!(true), json!(before)));
    assert_eq!(labels(), vec!["GEN.1:1", "NUM.25:11", "NUM.25:11.24", "NUM.25:13", "ROM.10:2", "H7065"]);
    assert_eq!(wb.js(&["thread", "sort", "Order"])["changed"], false);
    let mut args = vec!["thread", "order", "Order"];
    args.extend(before.iter().map(String::as_str));
    assert_eq!(wb.js(&args)["order"].as_array().unwrap().len(), 6);
    assert_eq!(labels(), before);
    wb.js(&["thread", "order", "Order", "6", "5", "4", "3", "2", "1"]);
    let reversed: Vec<String> = before.iter().rev().cloned().collect();
    assert_eq!(labels(), reversed);
    assert!(wb.fails(&["thread", "order", "Order", "1", "2"]).contains("once each"));
    assert!(wb.fails(&["thread", "order", "Order", "1", "1", "2", "3", "4", "5"]).contains("once each"));
    assert_eq!(labels(), reversed); // a refused order changes nothing
    let text = std::fs::read_to_string(wb.dir.join("threads").join("order.md")).unwrap();
    let order: Vec<String> = text.lines().filter(|l| l.starts_with("- ")).map(|l| l[2..].split(" | ").next().unwrap().to_string()).collect();
    assert_eq!(order, reversed);
    assert!(text.contains("NUM.25:11.24 | \"zealous\""));
}

#[test]
fn notes_highlights_and_threads_round_trip() {
    let Some(wb) = Wb::new() else { return };
    let n = wb.js(&["note", "add", "Num 25:11", "He turned away wrath"]);
    assert_eq!(n["anchor"], "NUM.25:11");
    assert_eq!(wb.js(&["note", "list", "Num 25"])[0]["text"], "He turned away wrath");
    let h = wb.ok(&["hl", "set", "Num 25:11", "yellow"]);
    assert_eq!(wb.js(&["hl", "list", "--color", "yellow"])[0]["anchor"], "NUM.25:11");
    wb.js(&["hl", "undo", &h]);
    assert_eq!(wb.js(&["hl", "list"]), json!([]));
    let t = wb.js(&["thread", "new", "Phinehas zeal", "--note", "Zeal for God", "--at", "Num 25:11"]);
    wb.js(&["thread", "add", "phin", "Num 25:13"]); // a part of the name finds it
    let anchors = |name: &str| wb.js(&["thread", "show", name])["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect::<Vec<_>>();
    assert_eq!(anchors("phin"), vec!["NUM.25:11", "NUM.25:13"]);
    wb.js(&["thread", "rm", "phin", "Num 25:11"]);
    assert_eq!(anchors("Phinehas zeal").len(), 1);
    wb.js(&["thread", "edit", "phin", "--color", "blue", "--note", "Changed"]);
    assert_eq!(wb.js(&["thread", "show", t["name"].as_str().unwrap()])["color"], "blue");
    wb.js(&["thread", "add", "A brand new thread", "John 3:16"]); // an unknown name starts a thread
    assert_eq!(wb.js(&["thread", "list"]).as_array().unwrap().len(), 2);
    wb.js(&["thread", "delete", "A brand new"]);
    assert_eq!(wb.js(&["thread", "list"]).as_array().unwrap().len(), 1);
    assert_eq!(wb.js(&["note", "rm", n["id"].as_str().unwrap()]), json!({"ok": true}));
    assert!(wb.fails(&["thread", "show", "zzz-none"]).contains("No thread called"));
}

#[test]
fn two_threads_that_both_match_ask_which() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "new", "Faith one"]);
    wb.js(&["thread", "new", "Faith two"]);
    assert!(wb.fails(&["thread", "show", "faith"]).contains("Which thread?"));
}

#[test]
fn trails_find_and_the_log() {
    let Some(wb) = Wb::new() else { return };
    let t = wb.js(&["trail", "add", "Rom 10:2", "Same zeal as Phinehas?"]);
    let id = t["id"].as_str().unwrap();
    assert_eq!(wb.js(&["trail", "list"])["counts"]["open"], 1);
    wb.js(&["trail", "done", id]);
    assert_eq!(wb.js(&["trail", "list"])["counts"]["open"], 0);
    wb.js(&["trail", "reopen", id]);
    assert!(!wb.js(&["find", "phinehas"])["trails"].as_array().unwrap().is_empty());
    wb.js(&["log", "add", "a line from the terminal", "--result", "ok"]);
    assert!(wb.js(&["log"])["entries"].as_array().unwrap().iter().any(|e| e["text"].as_str().unwrap().contains("terminal")));
    wb.js(&["trail", "rm", id]);
}

#[test]
fn a_place_must_be_a_verse_to_attach_to() {
    let Some(wb) = Wb::new() else { return };
    assert!(wb.fails(&["note", "add", "John 3", "x"]).contains("Name a verse"));
}

// ---- lessons ----

const LESSON: &str = "# Prayer\nWhy we pray.\n\n## In secret\nSpeech here.\n// pause\n@Matthew 6:5-8\n@Isaiah 58:6-7; Joel 2:12\n@Luke 18:9-14 ylt\n";

#[test]
fn a_lesson_is_a_plain_file_that_is_checked_and_found_by_part_of_its_name() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.run(&["lesson", "save", "Prayer and Fasting"], Some(LESSON)).0, 0);
    assert!(wb.dir.join("lessons").join("prayer-and-fasting.md").is_file());
    assert_eq!(wb.js(&["lesson", "list"])[0]["places"], 3);
    let c = wb.js(&["lesson", "check", "prayer"]);
    assert_eq!((c["title"].clone(), c["sections"].clone()), (json!("Prayer"), json!(1)));
    assert_eq!(c["places"].as_array().unwrap().iter().map(|p| p["verses"].clone()).collect::<Vec<_>>(), vec![json!(4), json!(3), json!(6)]);
    assert_eq!(c["places"][2]["version"], "YLT");
    assert_eq!(c["slides"], 12); // title, section, Matthew (three), Isaiah (two), Joel (one: a separate place), Luke (four)
    assert_eq!(wb.run(&["lesson", "save", "Prayer and Fasting", "--append"], Some("## More\n@John 17:1\n")).0, 0);
    assert!(wb.ok(&["lesson", "show", "prayer"]).contains("@John 17:1"));
    wb.js(&["lesson", "rm", "prayer"]);
    assert_eq!(wb.js(&["lesson", "list"]), json!([]));
}

#[test]
fn a_lesson_with_a_bad_reference_names_the_line() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.run(&["lesson", "save", "Broken"], Some("# T\nfine\n@John 99:1\n")).0, 0);
    let msg = wb.fails(&["lesson", "check", "broken"]);
    assert!(msg.contains("Line 3") && msg.contains("21 chapters"), "{msg}");
}

#[test]
fn help_lists_every_command_and_explains_one() {
    let Some(wb) = Wb::new() else { return };
    let all = wb.ok(&["help"]);
    for c in ["text", "uses", "note add", "thread move", "lesson check", "plan today"] {
        assert!(all.contains(&format!("  {c} ")), "{c} missing from wb help");
    }
    assert!(wb.ok(&["help", "thread", "move"]).contains("wb thread move"));
    assert!(wb.ok(&["thread"]).contains("thread add-many")); // a group name alone shows the group
}

// ---- reading plans and progress (new in the Rust app) ----

#[test]
fn a_plan_covers_every_chapter_once_in_order_as_whole_chapters() {
    let Some(wb) = Wb::new() else { return };
    for (kind, days, chapters) in [("canonical", "365", 1189), ("nt", "90", 260), ("psalms-proverbs", "31", 181), ("ot-nt", "365", 1189)] {
        wb.js(&["plan", "start", kind, "--kind", kind, "--days", days, "--start", "2026-01-01"]);
        let p = wb.js(&["plan", "show", kind, "--on", "2026-01-01"]);
        let sched = p["schedule"].as_array().unwrap();
        assert_eq!(sched.len(), days.parse::<usize>().unwrap(), "{kind}");
        let all: Vec<String> = sched.iter().flat_map(|d| d["entries"].as_array().unwrap().iter().map(|e| e.as_str().unwrap().to_string())).collect();
        let mut once = all.clone();
        once.sort();
        once.dedup();
        assert_eq!((all.len(), once.len()), (chapters, chapters), "{kind}: every chapter once");
        assert!(all.iter().all(|e| !e.contains(':')), "{kind}: whole chapters");
        assert!(sched.iter().all(|d| !d["entries"].as_array().unwrap().is_empty()), "{kind}: something every day");
    }
    let books = wb.js(&["plan", "start", "Gospels", "--kind", "books", "--books", "gospels", "--days", "30"]);
    assert_eq!(books["days"], 30);
    assert!(wb.fails(&["plan", "start", "Too short", "--kind", "books", "--books", "jude", "--days", "5"]).contains("at least one a day"));
    assert!(wb.fails(&["plan", "start", "Gospels"]).contains("already a plan"));
    assert!(wb.fails(&["plan", "start", "Odd", "--kind", "chronological"]).contains("No plan kind"));
}

#[test]
fn a_plan_of_several_books_reads_them_in_the_bibles_order() {
    let Some(wb) = Wb::new() else { return };
    // the window's words: no terminal flags in what the kinds say
    assert!(wb.js(&["plan", "kinds"]).as_array().unwrap().iter().all(|k| !k["reads"].as_str().unwrap().contains("--")));
    for named in ["gospels, rom", "rom; gospels", "Matt-John, Rom"] {
        wb.js(&["plan", "start", named, "--kind", "books", "--books", named, "--days", "30", "--start", "2026-01-01"]);
        let sched = wb.js(&["plan", "show", named, "--on", "2026-01-01"])["schedule"].clone();
        let all: Vec<String> = sched.as_array().unwrap().iter().flat_map(|d| d["entries"].as_array().unwrap().iter().map(|e| e.as_str().unwrap().to_string())).collect();
        let books: Vec<&str> = all.iter().map(|e| &e[..3]).fold(vec![], |mut v, b| { if v.last() != Some(&b) { v.push(b); } v });
        assert_eq!(books, ["MAT", "MRK", "LUK", "JHN", "ROM"], "{named}");
        assert_eq!((all.first().unwrap().as_str(), all.last().unwrap().as_str()), ("MAT.1", "ROM.16"), "{named}");
    }
    assert!(wb.fails(&["plan", "start", "Odd", "--kind", "books", "--books", "gospels, nobook"]).contains("No book called “nobook”"));
}

#[test]
fn a_plan_knows_today_what_is_behind_and_what_is_done() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Year", "--start", "2026-01-01"]);
    let t = wb.js(&["plan", "today", "--on", "2026-01-03"]);
    let p = &t["plans"][0];
    assert_eq!((p["day"].clone(), p["behind"].clone()), (json!(3), json!(3)));
    assert_eq!(p["to_read"].as_array().unwrap().len(), 3);
    let d = wb.js(&["plan", "done", "year"]); // the first day not yet done
    assert_eq!((d["day"].clone(), d["done"].clone()), (json!(1), json!(1)));
    let second: Vec<String> = wb.js(&["plan", "show", "year"])["schedule"][1]["entries"].as_array().unwrap().iter().map(|e| e.as_str().unwrap().to_string()).collect();
    let (code, ch) = second[0].split_once('.').unwrap();
    let first_book = wb.js(&["books"])["books"].as_array().unwrap().iter().find(|b| b["code"] == code).unwrap()["name"].as_str().unwrap().to_string();
    for e in &second {
        let c = e.split_once('.').unwrap().1;
        wb.js(&["read", "mark", &format!("{first_book} {c}")]); // read from the reader, with no plan named: still counts
    }
    let _ = ch;
    assert_eq!(wb.js(&["plan", "today", "year", "--on", "2026-01-03"])["plans"][0]["behind"], 1);
    assert_eq!(wb.js(&["plan", "done", "year", "--day", "3"])["done"], 3);
    assert_eq!(wb.js(&["plan", "today", "--on", "2026-01-03"])["plans"][0]["behind"], 0);
    assert!(wb.fails(&["plan", "done", "year", "--day", "400"]).contains("no day 400"));
    let pr = wb.js(&["read", "progress"]);
    assert!(pr["chapters"].as_u64().unwrap() >= 3);
    wb.js(&["plan", "rm", "year"]);
    assert_eq!(wb.js(&["plan", "list"]), json!([]));
    assert!(pr["chapters"] == wb.js(&["read", "progress"])["chapters"]); // what was read stays in the log
}

#[test]
fn a_plan_of_your_own_is_imported_from_a_text_file() {
    let Some(wb) = Wb::new() else { return };
    let text = "# my own order\nGen 1-3\nJob 1-5; Ps 1\nPs 119:1-88  # half of it\n";
    assert_eq!(wb.run(&["plan", "import", "Mine", "--start", "2026-01-01"], Some(text)).0, 0);
    let p = wb.js(&["plan", "show", "mine", "--on", "2026-01-01"]);
    let labels: Vec<&str> = p["schedule"].as_array().unwrap().iter().map(|d| d["label"].as_str().unwrap()).collect();
    assert_eq!(labels, vec!["Genesis 1–3", "Job 1–5; Psalms 1", "Psalms 119:1–88"]);
    assert_eq!(p["kind"], "imported");
    let (code, _, err) = wb.run(&["plan", "import", "Bad"], Some("Gen 1\nNum 99\n"));
    assert_eq!(code, 1);
    assert!(err.contains("Line 2"), "{err}");
}

#[test]
fn a_plan_as_text_reads_back_as_the_same_days() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Gospels", "--kind", "books", "--books", "gospels", "--days", "30", "--start", "2026-01-01"]);
    assert_eq!(wb.run(&["plan", "import", "Mine", "--start", "2026-01-01"], Some("Gen 1-3
Job 1-5; Ps 1
Ps 119:1-88
Ps 119:89-120:3
")).0, 0);
    for name in ["gospels", "mine"] {
        let text = wb.run(&["plan", "text", name], None).1;
        let days = |p: &Value| p["schedule"].as_array().unwrap().iter().map(|d| d["entries"].clone()).collect::<Vec<_>>();
        let before = days(&wb.js(&["plan", "show", name]));
        assert_eq!(wb.run(&["plan", "edit", name, "--text", "-"], Some(&text)).0, 0);
        assert_eq!(days(&wb.js(&["plan", "show", name])), before, "{text}");
    }
    assert!(wb.run(&["plan", "text", "mine"], None).1.lines().nth(3).unwrap().starts_with("Psalms 119:89-120:3"));
}

#[test]
fn a_plan_is_changed_without_losing_what_was_read() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Gospels", "--kind", "books", "--books", "gospels", "--days", "30", "--start", "2026-01-01"]);
    wb.js(&["plan", "done", "gospels"]);
    wb.js(&["plan", "done", "gospels"]);
    let chapters = |p: &Value| p["schedule"].as_array().unwrap().iter().flat_map(|d| d["entries"].as_array().unwrap().clone()).collect::<Vec<_>>();
    let all = chapters(&wb.js(&["plan", "show", "gospels"]));
    // the rest spread over 10 days from today: two days done, ten to go, the same chapters in the same order; only
    // today's day is due (behind counts today's day until it is read)
    let p = wb.js(&["plan", "edit", "gospels", "--days", "10"]);
    assert_eq!((p["days"].clone(), p["done"].clone(), p["behind"].clone(), p["today"].clone()), (json!(12), json!(2), json!(1), json!(3)));
    assert_eq!(chapters(&wb.js(&["plan", "show", "gospels"])), all);
    // renamed, moved, caught up; each change keeps the file as it was in .trash
    assert_eq!(wb.js(&["plan", "edit", "gospels", "--rename", "The four gospels"])["name"], "The four gospels");
    assert_eq!(wb.js(&["plan", "edit", "four gospels", "--start", "2026-01-01"])["behind"], 10);
    assert_eq!(wb.js(&["plan", "edit", "four gospels", "--catch-up"])["behind"], 1);
    let trashed = std::fs::read_dir(wb.dir.join(".trash")).unwrap().flatten().filter(|e| e.file_name().to_string_lossy().contains("-plan-gospels")).count();
    assert_eq!(trashed, 4);
    assert!(wb.fails(&["plan", "edit", "four gospels"]).contains("Say what to change"));
    assert!(wb.fails(&["plan", "edit", "four gospels", "--days", "400"]).contains("at least one a day"));
    wb.js(&["plan", "start", "Other", "--kind", "nt", "--days", "90"]);
    assert!(wb.fails(&["plan", "edit", "other", "--rename", "The four gospels"]).contains("already a plan"));
}

// ---- reading plans, tier 3: the form, the plan, past plans ----

fn day_entries(p: &Value) -> Vec<Vec<String>> {
    p["schedule"].as_array().unwrap().iter().map(|d| d["entries"].as_array().unwrap().iter().map(|e| e.as_str().unwrap().to_string()).collect()).collect()
}

fn dates(p: &Value) -> Vec<String> {
    p["schedule"].as_array().unwrap().iter().map(|d| d["date"].as_str().unwrap_or("").to_string()).collect()
}

#[test]
fn a_plan_has_an_order_a_pace_and_days_off() {
    let Some(wb) = Wb::new() else { return };
    // days off: 10 days from a Friday, Sundays off: no date is a Sunday and the last is the Tuesday after next
    let p = wb.js(&["plan", "start", "Gospels", "--books", "gospels", "--days", "10", "--days-off", "sun", "--start", "2026-11-06"]);
    assert_eq!((p["kind"].clone(), p["days"].clone(), p["finish"].clone()), (json!("custom"), json!(10), json!("2026-11-17")));
    let shown = wb.js(&["plan", "show", "gospels", "--on", "2026-11-06"]);
    assert!(!dates(&shown).contains(&"2026-11-08".to_string()) && !dates(&shown).contains(&"2026-11-15".to_string()));
    assert_eq!(dates(&shown)[..3], ["2026-11-06", "2026-11-07", "2026-11-09"]);
    // a day off has no reading; what came before it is still to read
    let t = wb.js(&["plan", "today", "gospels", "--on", "2026-11-08"]);
    assert_eq!((t["plans"][0]["day"].clone(), t["plans"][0]["to_read"].as_array().unwrap().len()), (json!(null), 2));
    // the books as listed, the Bible's own order, and codes (what the window's chips send)
    let dry = |extra: &[&str]| -> Value { wb.js(&[&["plan", "start", "X", "--dry-run"][..], extra].concat()) };
    assert_eq!(dry(&["--books", "rom, gospels", "--order", "listed", "--pace", "chapters:4"])["first"][0], "Romans 1–4");
    assert!(dry(&["--books", "rom, gospels", "--days", "5"])["first"][0].as_str().unwrap().starts_with("Matthew"));
    assert_eq!(dry(&["--books", "MAT,MRK", "--days", "5"])["readings"], 44);
    // the Old and the New side by side: a chapter of each kind every day
    wb.js(&["plan", "start", "Both", "--books", "gen, mat", "--order", "side-by-side", "--days", "20", "--start", "2026-01-01"]);
    for day in day_entries(&wb.js(&["plan", "show", "both"])).iter().take(5) {
        assert!(day.iter().any(|e| e.starts_with("GEN")) && day.iter().any(|e| e.starts_with("MAT")), "{day:?}");
    }
    // a pace: N chapters a day; until a day (days off not counted); my own pace has no dates
    let c = wb.js(&["plan", "start", "Three", "--books", "gospels", "--pace", "chapters:3", "--start", "2026-01-01"]);
    assert_eq!(c["days"], 30); // 89 chapters, 3 a day
    assert!(day_entries(&wb.js(&["plan", "show", "three"])).iter().all(|d| d.len() <= 3));
    let b = wb.js(&["plan", "start", "Until", "--books", "gospels", "--pace", "by:2026-11-20", "--days-off", "sat,sun", "--start", "2026-11-06"]);
    assert_eq!(b["days"], 11); // Friday the 6th, then two weeks of weekdays up to Friday the 20th
    let o = wb.js(&["plan", "start", "Mine", "--books", "MAT,MRK", "--pace", "own", "--start", "2026-11-06"]);
    assert_eq!((o["days"].clone(), o["dated"].clone(), o["today"].clone(), o["behind"].clone(), o["finish"].clone()), (json!(44), json!(false), json!(null), json!(0), json!(null)));
    let t = wb.js(&["plan", "today", "mine", "--on", "2026-12-25"]);
    assert_eq!(t["plans"][0]["to_read"].as_array().unwrap().len(), 1); // its next day, whatever the date
    assert_eq!(wb.js(&["plan", "done", "mine"])["day"], 1);
    // passages after the books
    wb.js(&["plan", "start", "Some", "--passages", "Ps 23; Isa 53:1-12", "--days", "2", "--start", "2026-01-01"]);
    let labels: Vec<String> = wb.js(&["plan", "show", "some"])["schedule"].as_array().unwrap().iter().map(|d| d["label"].as_str().unwrap().to_string()).collect();
    assert_eq!(labels, ["Psalms 23", "Isaiah 53:1–12"]);
    // what is wrong says so
    assert!(wb.fails(&["plan", "start", "A", "--books", "gospels", "--pace", "fast"]).contains("A pace looks like"));
    assert!(wb.fails(&["plan", "start", "A", "--books", "gospels", "--pace", "own", "--days", "9"]).contains("not both"));
    assert!(wb.fails(&["plan", "start", "A", "--books", "gospels", "--order", "backwards"]).contains("No order"));
    assert!(wb.fails(&["plan", "start", "A", "--books", "gospels", "--days-off", "mon,tue,wed,thu,fri,sat,sun"]).contains("Not every day"));
    assert!(wb.fails(&["plan", "start", "A", "--kind", "books"]).contains("Name what to read"));
    assert!(wb.fails(&["plan", "start", "A", "--books", "gospels", "--pace", "by:2020-01-01", "--start", "2026-01-01"]).contains("before the plan"));
}

#[test]
fn days_missed_have_four_choices_that_each_say_what_they_do_to_the_dates() {
    let Some(wb) = Wb::new() else { return };
    for n in ["Skip", "Shift", "Fit", "Later", "Choices"] {
        wb.js(&["plan", "start", n, "--books", "gospels", "--days", "10", "--start", "2026-11-01"]);
    }
    let on = "2026-11-04"; // day 4 is today; days 1 to 3 came and were not read
    let o = wb.js(&["plan", "missed", "choices", "--on", on]);
    assert_eq!((o["missed"].clone(), o["days"].clone(), o["finish"].clone()), (json!(3), json!([1, 2, 3]), json!("2026-11-10")));
    let opts = o["options"].as_array().unwrap();
    assert_eq!(opts.iter().map(|x| x["choice"].as_str().unwrap()).collect::<Vec<_>>(), ["shift", "fit", "later", "skip"]);
    // each says its dates before anything is done
    let text = |k: usize| opts[k]["text"].as_str().unwrap().to_string();
    assert!(text(0).contains("Fri Nov 13, 2026") && text(0).contains("not Tue Nov 10, 2026"), "{}", text(0));
    assert!(text(1).contains("ends Tue Nov 10, 2026"), "{}", text(1));
    assert!(text(2).contains("keep their dates") && text(2).contains("Fri Nov 13, 2026"), "{}", text(2));
    assert!(text(3).contains("No date moves"), "{}", text(3));
    assert_eq!(wb.js(&["plan", "show", "choices", "--on", on])["days"], 10); // asking changed nothing
    let all = |p: &Value| day_entries(p).concat();
    let before = all(&wb.js(&["plan", "show", "skip"]));
    // skip: marked skipped, not read; no date moves; only today is behind
    let s = wb.js(&["plan", "missed", "skip", "--skip", "--on", on]);
    assert_eq!((s["skipped"].clone(), s["behind"].clone(), s["done"].clone(), s["finish"].clone()), (json!(3), json!(1), json!(0), json!("2026-11-10")));
    let sh = wb.js(&["plan", "show", "skip", "--on", on]);
    assert_eq!((sh["schedule"][0]["skipped"].clone(), sh["schedule"][0]["done"].clone(), sh["next"]["day"].clone()), (json!(true), json!(false), json!(4)));
    assert!(wb.fails(&["plan", "missed", "skip", "--skip", "--on", on]).contains("No day is missed"));
    // shift: today reads the first day not read; the rest move with it
    let s = wb.js(&["plan", "missed", "shift", "--shift", "--on", on]);
    assert_eq!((s["start"].clone(), s["finish"].clone(), s["behind"].clone()), (json!("2026-11-04"), json!("2026-11-13"), json!(1)));
    assert_eq!(all(&wb.js(&["plan", "show", "shift"])), before);
    // fit: the same chapters in the days left, ending on the same day
    let s = wb.js(&["plan", "missed", "fit", "--fit", "--on", on]);
    assert_eq!((s["start"].clone(), s["days"].clone(), s["finish"].clone()), (json!("2026-11-04"), json!(7), json!("2026-11-10")));
    assert_eq!(all(&wb.js(&["plan", "show", "fit"])), before);
    // later: the days from today keep their dates; the missed ones are read after the last
    let old = day_entries(&wb.js(&["plan", "show", "later"]));
    let s = wb.js(&["plan", "missed", "later", "--later", "--on", on]);
    assert_eq!((s["days"].clone(), s["finish"].clone(), s["behind"].clone()), (json!(10), json!("2026-11-13"), json!(1)));
    let new = wb.js(&["plan", "show", "later", "--on", on]);
    assert_eq!(day_entries(&new)[0], old[3]); // what was read on the 4th is still read on the 4th
    assert_eq!(dates(&new)[0], "2026-11-04");
    assert_eq!(day_entries(&new)[7..], old[..3]);
    // a day already read is not missed
    wb.js(&["plan", "start", "Two", "--books", "gospels", "--days", "10", "--start", "2026-11-01"]);
    wb.js(&["plan", "done", "two", "--day", "2"]);
    assert_eq!(wb.js(&["plan", "missed", "two", "--on", on])["days"], json!([1, 3]));
    // each change keeps the file as it was
    let trashed = std::fs::read_dir(wb.dir.join(".trash")).unwrap().flatten().filter(|e| e.file_name().to_string_lossy().contains("-plan-")).count();
    assert_eq!(trashed, 4);
    assert!(wb.fails(&["plan", "missed", "two", "--shift", "--fit"]).contains("Choose one"));
    assert!(wb.fails(&["plan", "missed", "mine"]).contains("No reading plan"));
}

#[test]
fn a_day_is_moved_and_its_readings_go_with_it() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Gospels", "--books", "gospels", "--days", "10", "--start", "2026-11-01"]);
    let before = wb.js(&["plan", "show", "gospels"]);
    let (e, d) = (day_entries(&before), dates(&before));
    let after = wb.js(&["plan", "move-day", "gospels", "--day", "1", "--to", "3"]);
    assert_eq!(after["days"], 10);
    let moved = wb.js(&["plan", "show", "gospels"]);
    assert_eq!(dates(&moved), d); // the dates stay where they were
    let m = day_entries(&moved);
    assert_eq!((m[0].clone(), m[1].clone(), m[2].clone()), (e[1].clone(), e[2].clone(), e[0].clone()));
    assert!(wb.fails(&["plan", "move-day", "gospels", "--day", "11", "--to", "3"]).contains("no day 11"));
    assert!(wb.fails(&["plan", "move-day", "gospels", "--day", "1"]).contains("Say --day and --to"));
    // a skipped mark goes with its day
    wb.js(&["plan", "missed", "gospels", "--skip", "--on", "2026-11-03"]); // days 1 and 2 skipped
    wb.js(&["plan", "move-day", "gospels", "--day", "1", "--to", "5"]);
    let s = wb.js(&["plan", "show", "gospels", "--on", "2026-11-03"]);
    let skipped: Vec<u64> = s["schedule"].as_array().unwrap().iter().filter(|d| d["skipped"] == true).map(|d| d["day"].as_u64().unwrap()).collect();
    assert_eq!(skipped, [1, 5]);
}

#[test]
fn a_stopped_plan_waits_in_past_plans_to_be_used_again_or_deleted() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Gospels", "--books", "gospels", "--days", "10", "--days-off", "sun", "--start", "2026-11-01"]);
    wb.js(&["plan", "start", "Other", "--kind", "nt", "--days", "90", "--start", "2026-11-01"]);
    wb.js(&["plan", "done", "gospels"]);
    let s = wb.js(&["plan", "stop", "gospels"]);
    assert_eq!(s["ok"], true);
    assert_eq!(s["stopped"].as_str().unwrap().len(), 10);
    // it leaves the list and Today; the file stays where it was, with the day it was stopped
    let list = wb.js(&["plan", "list"]);
    assert_eq!(list.as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap()).collect::<Vec<_>>(), ["other"]);
    assert_eq!(wb.js(&["plan", "today"])["plans"].as_array().unwrap().len(), 1);
    assert!(wb.dir.join("reading/plans/gospels.json").exists());
    let past = wb.js(&["plan", "past"]);
    assert_eq!((past.as_array().unwrap().len(), past[0]["id"].clone(), past[0]["done"].clone()), (1, json!("gospels"), json!(1)));
    assert!(wb.fails(&["plan", "stop", "gospels"]).contains("already stopped"));
    // use again: the same days and settings, nothing read, on a day chosen
    let n = wb.js(&["plan", "reuse", "gospels", "--start", "2026-12-01"]);
    assert_eq!((n["name"].clone(), n["start"].clone(), n["days"].clone(), n["done"].clone(), n["days_off"].clone()), (json!("Gospels again"), json!("2026-12-01"), json!(10), json!(0), json!(["sun"])));
    assert_eq!(wb.js(&["plan", "reuse", "gospels", "--start", "2026-12-01"])["name"], "Gospels again (2)");
    assert_eq!(wb.js(&["plan", "reuse", "gospels", "--as", "Winter gospels"])["id"], "winter-gospels");
    assert!(wb.fails(&["plan", "reuse", "gospels", "--as", "Winter gospels"]).contains("already a plan"));
    assert_eq!(wb.js(&["plan", "list"]).as_array().unwrap().len(), 4);
    // delete: to .trash; what was read stays in the log
    let chapters = wb.js(&["read", "progress"])["chapters"].clone();
    wb.js(&["plan", "rm", "gospels"]);
    assert_eq!(wb.js(&["plan", "past"]), json!([]));
    assert_eq!(wb.js(&["read", "progress"])["chapters"], chapters);
    assert!(std::fs::read_dir(wb.dir.join(".trash")).unwrap().flatten().any(|e| e.file_name().to_string_lossy().ends_with("-plan-gospels.json")));
    // a plan that is finished is a past plan too
    wb.js(&["plan", "start", "Short", "--passages", "Ps 23", "--days", "1", "--start", "2026-11-01"]);
    wb.js(&["plan", "done", "short"]);
    assert_eq!(wb.js(&["plan", "past"])[0]["id"], "short");
}

/// A plan's file as JSON.
fn plan_file(wb: &Wb, id: &str) -> Value {
    serde_json::from_str(&std::fs::read_to_string(wb.dir.join("reading/plans").join(format!("{id}.json"))).unwrap()).unwrap()
}

#[test]
fn the_builder_keeps_the_days_set_by_hand_when_the_pace_changes() {
    let Some(wb) = Wb::new() else { return };
    let laid = |extra: &[&str], held: Option<&str>| -> Value {
        let books: &[&str] = if extra.contains(&"--books") { &[] } else { &["--books", "gospels"] };
        let args = [&["plan", "layout", "--start", "2026-11-06"][..], books, extra, if held.is_some() { &["--arranged", "-"][..] } else { &[][..] }].concat();
        let (code, out, err) = wb.run(&args, held);
        assert_eq!(code, 0, "{err}");
        serde_json::from_str(&out).unwrap()
    };
    let chips = |l: &Value, day: usize| -> Vec<String> { l["rows"][day - 1]["chips"].as_array().unwrap().iter().map(|c| c["entry"].as_str().unwrap().to_string()).collect() };
    // laid out by the pace: 89 chapters, 3 a day, each chapter a chip with its label
    let l = laid(&["--pace", "chapters:3"], None);
    assert_eq!((l["days"].clone(), l["readings"].clone(), l["kept"].clone()), (json!(30), json!(89), json!([])));
    assert_eq!(chips(&l, 1), ["MAT.1", "MAT.2", "MAT.3"]);
    assert_eq!(l["rows"][0]["chips"][0]["label"], "Matthew 1");
    // the person sets day 2 by hand: a chapter of Mark moved in, Matthew 5 moved out to the first day
    let by_hand = json!({"days": [["MAT.1", "MAT.2", "MAT.3", "MAT.5"], ["MRK.1", "MAT.4"], ["MAT.6", "MAT.7", "MAT.8"]], "kept": [2]}).to_string();
    // a new pace: day 2 stays exactly as set; every other chapter is laid out again around it, none twice and none lost
    let again = laid(&["--pace", "chapters:5"], Some(&by_hand));
    assert_eq!(again["kept"], json!([2]));
    assert_eq!(chips(&again, 2), ["MRK.1", "MAT.4"]);
    assert_eq!(again["rows"][1]["kept"], true);
    assert_eq!(chips(&again, 1), ["MAT.1", "MAT.2", "MAT.3", "MAT.5", "MAT.6"]);
    assert_eq!(again["days"], json!(19)); // 87 chapters left, 5 a day, and the day set by hand
    let all: Vec<String> = (1..=19).flat_map(|d| chips(&again, d)).collect();
    assert_eq!(all.len(), 89);
    assert_eq!(all.iter().collect::<std::collections::HashSet<_>>().len(), 89);
    // a number of days: the held day counts as one of them
    let by_days = laid(&["--days", "10"], Some(&by_hand));
    assert_eq!((by_days["days"].clone(), chips(&by_days, 2)), (json!(10), vec!["MRK.1".to_string(), "MAT.4".to_string()]));
    // my own pace: a chapter a day, the held day still where it was
    let own = laid(&["--pace", "own"], Some(&by_hand));
    assert_eq!((own["days"].clone(), own["dated"].clone(), own["finish"].clone()), (json!(88), json!(false), json!(null)));
    // a kept day is as the person set it, even with a chapter the plan no longer reads (a book taken out)
    let m = laid(&["--books", "mark", "--pace", "chapters:8"], Some(&by_hand));
    assert_eq!((m["kept"].clone(), chips(&m, 2)), (json!([2]), vec!["MRK.1".to_string(), "MAT.4".to_string()]));

    // starting with exactly those days: the plan file keeps them, and which were set by hand
    let all_days = json!({"days": [["MAT.1", "MAT.2"], ["MRK.1", "MAT.3"], [], ["LUK.1"]], "kept": [2, 4]}).to_string();
    let (code, out, err) = wb.run(&["plan", "start", "Mine", "--books", "gospels", "--pace", "chapters:2", "--start", "2026-11-06", "--arranged", "-"], Some(&all_days));
    assert_eq!(code, 0, "{err}");
    let p: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(p["days"], 3); // the empty day is dropped, and the kept day after it moves up
    let file = plan_file(&wb, "mine");
    assert_eq!((file["days"].clone(), file["kept"].clone()), (json!([["MAT.1", "MAT.2"], ["MRK.1", "MAT.3"], ["LUK.1"]]), json!([2, 3])));
    assert_eq!(file["pace"], "chapters:2");
    let shown = wb.js(&["plan", "show", "mine"]);
    assert_eq!(shown["schedule"].as_array().unwrap().iter().map(|d| d["kept"].clone()).collect::<Vec<_>>(), [json!(false), json!(true), json!(true)]);
    // a day moved takes its mark with it
    wb.js(&["plan", "move-day", "mine", "--day", "2", "--to", "1"]);
    assert_eq!(plan_file(&wb, "mine")["kept"], json!([1, 3]));
    // the plan as it was is in .trash when the days are arranged again; what was read stays by reading
    wb.js(&["read", "mark", "Matt 1", "--plan", "mine"]);
    let (code, out, err) = wb.run(&["plan", "arrange", "mine", "--arranged", "-"], Some(&json!({"days": [["MAT.2"], ["MAT.1", "MRK.1"]], "kept": [1]}).to_string()));
    assert_eq!(code, 0, "{err}");
    let p: Value = serde_json::from_str(&out).unwrap();
    assert_eq!((p["days"].clone(), p["done"].clone()), (json!(2), json!(0))); // Matthew 1 is read, but day 2 has Mark 1 as well
    assert_eq!(wb.js(&["read", "progress"])["chapters"], 1); // what was read stays in the log
    assert_eq!(plan_file(&wb, "mine")["kept"], json!([1]));
    assert!(std::fs::read_dir(wb.dir.join(".trash")).unwrap().flatten().any(|e| e.file_name().to_string_lossy().contains("-plan-mine")));
    // a place typed becomes the entries a day holds
    let e = wb.js(&["plan", "entries", "Ps 23; Isa 53:1-12"]);
    assert_eq!(e, json!([{"entry": "PSA.23", "label": "Psalms 23"}, {"entry": "ISA.53:1-53:12", "label": "Isaiah 53:1–12"}]));
    // what is wrong says so
    let (code, _, err) = wb.run(&["plan", "arrange", "mine", "--arranged", "-"], Some(&json!({"days": [["XYZ.1"]]}).to_string()));
    assert_eq!(code, 1);
    assert!(err.contains("is not a place"), "{err}");
    let (code, _, err) = wb.run(&["plan", "arrange", "mine", "--arranged", "-"], Some(&json!({"days": [[], []]}).to_string()));
    assert_eq!(code, 1);
    assert!(err.contains("no days"), "{err}");
    assert!(wb.fails(&["plan", "arrange", "mine"]).contains("Say the days"));
}

#[test]
fn a_published_plan_is_read_from_the_copy_the_person_has() {
    let Some(wb) = Wb::new() else { return };
    let run = |name: &str, text: &str, extra: &[&str]| -> Value {
        let (code, out, err) = wb.run(&[&["plan", "import", name, "--start", "2026-11-06"][..], extra].concat(), Some(text));
        assert_eq!(code, 0, "{err}");
        serde_json::from_str(&out).unwrap()
    };
    let labels = |p: &Value| -> Vec<String> { wb.js(&["plan", "show", p["id"].as_str().unwrap()])["schedule"].as_array().unwrap().iter().map(|d| d["label"].as_str().unwrap().to_string()).collect() };

    // one day to a line, with the name of where it came from kept in the file
    let plain = run("Chronological", "Gen 1-3\nJob 1-5; Ps 1 # a comment\n", &["--source", "Tyndale One Year Chronological"]);
    assert_eq!((plain["kind"].clone(), plain["days"].clone(), plain["source"].clone()), (json!("imported"), json!(2), json!("Tyndale One Year Chronological")));
    assert_eq!(plan_file(&wb, "chronological")["source"], "Tyndale One Year Chronological");
    assert_eq!(labels(&plain), ["Genesis 1–3", "Job 1–5; Psalms 1"]);

    // Guthrie's: Week N / Day N; six days a week, the seventh a day off, whatever it says
    let guthrie = "Week 1\nDay 1: Genesis 1-2; Matthew 1\nDay 2: Genesis 3\nDay 3\nExodus 1\nDay 4: Ps 1\nDay 5: Ps 2\nDay 6: Ps 3\nDay 7: Rest\n\nWeek 2\nDay 1: Gen 4\nDay 2: Gen 5\n";
    let dry = run("G", guthrie, &["--dry-run"]);
    assert_eq!((dry["format"].clone(), dry["weeks"].clone(), dry["days"].clone(), dry["days_off"].clone(), dry["source"].clone()), (json!("guthrie"), json!(2), json!(8), json!(["sun"]), json!("Guthrie")));
    assert_eq!(wb.js(&["plan", "list"]).as_array().unwrap().len(), 1, "a dry run starts nothing"); // only the plain one above
    let g = run("Guthrie", guthrie, &[]);
    assert_eq!(labels(&g)[..4], ["Genesis 1–2; Matthew 1", "Genesis 3", "Exodus 1", "Psalms 1"]);
    // Friday the 6th, Saturday the 7th, then no Sunday: the 9th is the third day
    assert_eq!(dates(&wb.js(&["plan", "show", "guthrie"]))[..3], ["2026-11-06", "2026-11-07", "2026-11-09"]);
    assert_eq!(plan_file(&wb, "guthrie")["source"], "Guthrie");
    // the day off is the person's to move
    assert_eq!(run("G2", guthrie, &["--days-off", "sat"])["days_off"], json!(["sat"]));
    // a day that cannot be read says which line
    let (code, _, err) = wb.run(&["plan", "import", "Bad", "--format", "guthrie"], Some("Week 1\nDay 1: Genesis 1\nDay 2: Nowhere 4\n"));
    assert_eq!(code, 1);
    assert!(err.contains("Line 3") && err.contains("Day 2"), "{err}");

    // Blue Letter Bible's: places joined by "/", its short names, a label in front or not
    let blb = run("Blb", "Day 1: Gen 1 / Mat 1 / Phl 2\n2. Jhn 3 / 1Co 13 / Jde 1\nPsa 119:1-32 / Rev 22\n", &["--dry-run"]);
    assert_eq!((blb["format"].clone(), blb["days"].clone(), blb["source"].clone()), (json!("blue-letter"), json!(3), json!("Blue Letter Bible")));
    assert_eq!(blb["first"], json!(["Genesis 1; Matthew 1; Philippians 2", "John 3; 1 Corinthians 13; Jude 1", "Psalms 119:1–32; Revelation 22"]));
    // every short name is the book it says, in the Bible's order
    let short = ["gen", "exo", "lev", "num", "deu", "jos", "jdg", "rth", "1sa", "2sa", "1ki", "2ki", "1ch", "2ch", "ezr", "neh", "est", "job", "psa", "pro", "ecc", "sol", "isa", "jer", "lam", "eze", "dan",
        "hos", "joe", "amo", "oba", "jon", "mic", "nah", "hab", "zep", "hag", "zec", "mal", "mat", "mar", "luk", "jhn", "act", "rom", "1co", "2co", "gal", "eph", "phl", "col", "1th", "2th", "1ti", "2ti", "tit",
        "phm", "heb", "jas", "1pe", "2pe", "1jo", "2jo", "3jo", "jde", "rev"];
    let books = wb.js(&["books"])["books"].as_array().unwrap().clone();
    assert_eq!((short.len(), books.len()), (66, 66));
    let text: String = short.iter().map(|s| format!("{s} 1")).collect::<Vec<_>>().join("\n");
    let all = run("Names", &text, &["--format", "blue-letter"]);
    let file = plan_file(&wb, all["id"].as_str().unwrap());
    for (k, b) in books.iter().enumerate() {
        assert_eq!(file["days"][k][0], format!("{}.1", b["code"].as_str().unwrap()), "{}", short[k]);
    }

    // Horner's lists: one chapter from each list a day, each starting again when it is done, no end date
    let horner = "Horner's lists\nList 1: Matthew, Mark\nList 2 (Law): Genesis to Exodus\nList 3: Jude, 3 John\n";
    let h = run("Horner", horner, &["--dry-run"]);
    assert_eq!((h["format"].clone(), h["lists"].clone(), h["days"].clone(), h["finish"].clone(), h["cycle"].clone()), (json!("horner"), json!(3), json!(90), json!(null), json!(true)));
    let h = run("Horner", horner, &[]);
    assert_eq!((h["kind"].clone(), h["finish"].clone(), h["finished"].clone()), (json!("horner"), json!(null), json!(false)));
    let file = plan_file(&wb, "horner");
    assert_eq!((file["cycle"].clone(), file["source"].clone(), file["days"].as_array().unwrap().len()), (json!(true), json!("Horner"), 90)); // one pass of the longest list
    assert_eq!(file["days"][0], json!(["MAT.1", "GEN.1", "JUD.1"]));
    assert_eq!(file["days"][1], json!(["MAT.2", "GEN.2", "3JN.1"]));
    assert_eq!(file["days"][2], json!(["MAT.3", "GEN.3", "JUD.1"])); // the short list starts again
    // a day a long way on is there to read: the lists keep going
    let far = wb.js(&["plan", "show", "horner", "--on", "2027-05-01"]);
    assert!(far["days"].as_u64().unwrap() > 90 && far["today"].as_u64().unwrap() > 90 && far["finish"].is_null() && far["finished"] == false);
    // reading all of the first pass does not finish it
    let every: Vec<String> = file["days"].as_array().unwrap().iter().flat_map(|d| d.as_array().unwrap().iter().map(|e| e.as_str().unwrap().replace('.', " "))).collect();
    wb.run(&["read", "mark", &every.join("; "), "--plan", "horner"], None);
    assert_eq!(wb.js(&["plan", "show", "horner", "--on", "2026-11-06"])["finished"], false);
    // with no end there is no last day to fit the missed days into
    run("Horner two", horner, &[]);
    let o = wb.js(&["plan", "missed", "horner-two", "--on", "2026-12-01"]);
    let avail: Vec<bool> = o["options"].as_array().unwrap().iter().map(|x| x["available"].as_bool().unwrap()).collect();
    assert_eq!(avail, [true, false, false, true]);
    // used again, it is still a plan with no end
    let again = wb.js(&["plan", "reuse", "horner", "--start", "2027-01-01"]);
    assert_eq!((again["cycle"].clone(), again["source"].clone()), (json!(true), json!("Horner")));
    assert!(plan_file(&wb, "horner-again")["lists"].is_array());
    // what is wrong says so
    let (code, _, err) = wb.run(&["plan", "import", "Bad", "--format", "horner"], Some("List 1: Matthew\n"));
    assert_eq!(code, 1);
    assert!(err.contains("No lists found"), "{err}");
    let (code, _, err) = wb.run(&["plan", "import", "Bad", "--format", "sunday"], Some("Gen 1"));
    assert_eq!(code, 1);
    assert!(err.contains("No format"), "{err}");
}

// ---- the Notebook (new in the Rust app) ----

#[test]
fn a_jot_waits_in_the_inbox_apart_from_placed_notes_then_is_placed() {
    let Some(wb) = Wb::new() else { return };
    let n = wb.js(&["note", "jot", "check where else this phrase is used; see Rom 10:2"]);
    let id = n["id"].as_str().unwrap().to_string();
    assert_eq!((n["placed"].clone(), n["kind"].clone(), n["offer"]["anchor"].clone()), (json!(false), json!("note"), json!("ROM.10:2")));
    // its own file in notes/_inbox, in the notes' format, with an empty anchor (the Python app passes over it)
    let file = wb.dir.join("notes").join("_inbox").join(format!("{id}.md"));
    let text = std::fs::read_to_string(&file).unwrap();
    assert!(text.starts_with("---\nid: \"") && text.contains("\nanchor: \"\"\n") && text.contains("kind: \"jot\""), "{text}");
    // not a placed note: the margins, note list, anchor views and find do not see it
    assert_eq!(wb.js(&["note", "list", "Romans 10"]), json!([]));
    assert_eq!(wb.js(&["find", "phrase"])["notes"], json!([]));
    assert_eq!(wb.js(&["inbox"])["notes"].as_array().unwrap().len(), 1);
    assert_eq!(wb.js(&["journal"])["days"][0]["entries"][0]["id"], json!(id));
    // placed by part of its text, on the place its text names
    let placed = wb.js(&["note", "place", "where else"]);
    assert_eq!((placed["placed"].clone(), placed["anchor"].clone(), placed["label"].clone()), (json!(true), json!("ROM.10:2"), json!("Romans 10:2")));
    assert!(!file.exists());
    assert!(wb.dir.join("notes").join("ROM").join(format!("{id}.md")).exists());
    let listed = wb.js(&["note", "list", "Romans 10"]);
    assert_eq!((listed[0]["id"].clone(), listed[0]["quote"].clone()), (json!(id), json!(verse_texts(&wb, "Rom 10:2")[0])));
    assert_eq!(wb.js(&["inbox"])["notes"], json!([]));
    // the day it was written is kept
    assert_eq!(wb.js(&["journal"])["days"][0]["entries"][0]["created"], n["created"]);
    assert_eq!(wb.js(&["note", "all"])["books"][0]["code"], json!("ROM"));
}

#[test]
fn a_question_with_no_place_becomes_a_trail_when_placed() {
    let Some(wb) = Wb::new() else { return };
    let q = wb.js(&["note", "jot", "how do the two numbers relate", "--question"]);
    let id = q["id"].as_str().unwrap().to_string();
    assert_eq!(wb.js(&["questions"])["questions"][0]["id"], json!(id));
    assert!(wb.fails(&["note", "place", "two numbers"]).contains("names no place"));
    assert!(wb.fails(&["note", "place", "two numbers", "H7065"]).contains("question is placed on words or verses"));
    wb.js(&["note", "place", &id, "Num 25:9"]);
    let trails = wb.js(&["trail", "list"])["trails"].clone();
    assert_eq!((trails[0]["id"].clone(), trails[0]["anchor"].clone(), trails[0]["status"].clone()), (json!(id), json!("NUM.25:9"), json!("open")));
    assert_eq!(wb.js(&["reader", "NUM", "25"])["questions"][0]["v"], json!(9));
    wb.js(&["trail", "done", &id]);
    assert_eq!(wb.js(&["questions"])["questions"], json!([]));
    assert_eq!(wb.js(&["questions", "--status", "done"])["questions"][0]["id"], json!(id));
}

#[test]
fn an_inbox_note_is_changed_made_a_question_or_deleted_to_the_trash() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["note", "jot", "first thought"]);
    assert_eq!(wb.js(&["inbox", "edit", "first", "a better thought"])["text"], json!("a better thought"));
    assert_eq!(wb.js(&["inbox", "edit", "better", "--question"])["kind"], json!("question"));
    assert!(wb.fails(&["inbox", "edit", "nothing like it", "x"]).contains("No note in the Inbox"));
    wb.js(&["inbox", "rm", "better"]);
    assert_eq!(wb.js(&["inbox"])["notes"], json!([]));
    assert_eq!(std::fs::read_dir(wb.dir.join(".trash")).unwrap().count(), 1);
}

#[test]
fn a_placed_note_moves_and_a_question_is_untagged_or_answered_anywhere() {
    let Some(wb) = Wb::new() else { return };
    // a note moves to another verse, in another book: its file follows, with the id, text and day kept
    let n = wb.js(&["note", "add", "Num 25:11", "the same zeal"]);
    let id = n["id"].as_str().unwrap().to_string();
    let moved = wb.js(&["note", "move", &id, "Ps 106:30-31"]);
    assert_eq!((moved["anchor"].clone(), moved["label"].clone(), moved["created"].clone()), (json!("PSA.106:30-106:31"), json!("Psalms 106:30–31"), n["created"].clone()));
    assert!(!wb.dir.join("notes").join("NUM").join(format!("{id}.md")).exists());
    let text = std::fs::read_to_string(wb.dir.join("notes").join("PSA").join(format!("{id}.md"))).unwrap();
    assert!(text.contains(&format!("quote: \"{}", verse_texts(&wb, "Ps 106:30")[0])) && text.ends_with("the same zeal\n"), "{text}");
    assert_eq!(wb.js(&["note", "list", "Numbers 25"]), json!([]));
    // the note becomes a question (a trail) at its place, then a plain note again
    let q = wb.js(&["note", "question", &id]);
    assert_eq!((q["kind"].clone(), q["status"].clone()), (json!("question"), json!("open")));
    assert!(wb.dir.join("trails").join(format!("{id}.md")).exists() && !wb.dir.join("notes").join("PSA").join(format!("{id}.md")).exists());
    assert_eq!(wb.js(&["note", "answered", &id])["status"], json!("done"));
    assert_eq!(wb.js(&["note", "answered", &id, "--open"])["status"], json!("open"));
    assert_eq!(wb.js(&["note", "question", &id, "--plain"])["kind"], json!("note"));
    assert!(!wb.dir.join("trails").join(format!("{id}.md")).exists());
    assert_eq!(wb.js(&["note", "list", "Psalms 106"])[0]["id"], json!(id));
    // an Inbox question is answered before it has a place, and stays answered when placed
    wb.js(&["note", "jot", "who else stood up", "--question"]);
    assert_eq!(wb.js(&["note", "answered", "who else"])["status"], json!("done"));
    assert_eq!(wb.js(&["note", "place", "who else", "Ps 106:30"])["status"], json!("done"));
    assert!(wb.fails(&["note", "move", "n_nothing", "Ps 1:1"]).contains("No note or question"));
}

#[test]
fn a_note_sits_on_places_apart_from_each_other() {
    let Some(wb) = Wb::new() else { return };
    let n = wb.js(&["note", "add", "Num 25:11", "the same zeal"]);
    let id = n["id"].as_str().unwrap().to_string();
    let e = wb.js(&["note", "also", &id, "Ps 106:30"]);
    assert_eq!(e["also"], json!([{"anchor": "PSA.106:30", "label": "Psalms 106:30"}]));
    wb.js(&["note", "also", &id, "1 Cor 10:8"]);
    // its file stays at its first place, with the others in its front matter (the Python app keeps the field)
    let text = std::fs::read_to_string(wb.dir.join("notes").join("NUM").join(format!("{id}.md"))).unwrap();
    assert!(text.contains("also: [\"PSA.106:30\", \"1CO.10:8\"]"), "{text}");
    // it shows at each place: the note list, the place pane, the reader's marks
    assert_eq!(wb.js(&["note", "list", "Psalms 106"])[0]["id"], json!(id));
    assert_eq!(wb.js(&["anchor", "1 Cor 10:8"])["notes"][0]["id"], json!(id));
    assert_eq!(wb.js(&["note", "list", "Numbers 25"])[0]["id"], json!(id));
    // moving it keeps its other places; a place comes off, but not its first
    let moved = wb.js(&["note", "move", &id, "Num 25:13"]);
    assert_eq!(moved["also"].as_array().unwrap().len(), 2);
    assert!(wb.fails(&["note", "also", &id, "Num 25:13", "--remove"]).contains("first place"));
    assert_eq!(wb.js(&["note", "also", &id, "Ps 106:30", "--remove"])["also"], json!([{"anchor": "1CO.10:8", "label": "1 Corinthians 10:8"}]));
    assert_eq!(wb.js(&["note", "list", "Psalms 106"]), json!([]));
}

#[test]
fn a_place_is_taken_off_a_note_its_first_too_and_the_last_sends_it_to_the_inbox() {
    let Some(wb) = Wb::new() else { return };
    let id = wb.js(&["note", "add", "Num 25:11", "on three places"])["id"].as_str().unwrap().to_string();
    wb.js(&["note", "also", &id, "Ps 106:30"]);
    wb.js(&["note", "also", &id, "1 Cor 10:8"]);
    // another place comes off as note also --remove takes it
    let e = wb.js(&["note", "unplace", &id, "1 Cor 10:8"]);
    assert_eq!((e["anchor"].clone(), e["also"].clone()), (json!("NUM.25:11"), json!([{"anchor": "PSA.106:30", "label": "Psalms 106:30"}])));
    wb.js(&["note", "also", &id, "1 Cor 10:8"]);
    // its first place: the next becomes its place, and its file moves to that book's folder in the Python app's format
    let e = wb.js(&["note", "unplace", &id, "Num 25:11"]);
    assert_eq!((e["anchor"].clone(), e["label"].clone(), e["placed"].clone()), (json!("PSA.106:30"), json!("Psalms 106:30"), json!(true)));
    assert_eq!(e["also"], json!([{"anchor": "1CO.10:8", "label": "1 Corinthians 10:8"}]));
    assert!(!wb.dir.join("notes").join("NUM").join(format!("{id}.md")).exists());
    let text = std::fs::read_to_string(wb.dir.join("notes").join("PSA").join(format!("{id}.md"))).unwrap();
    assert!(text.contains("anchor: \"PSA.106:30\"") && text.contains("kind: \"verse\"") && text.contains("also: [\"1CO.10:8\"]"), "{text}");
    assert_eq!(wb.js(&["note", "list", "Psalms 106"])[0]["id"], json!(id));
    assert_eq!(wb.js(&["note", "list", "Numbers 25"]), json!([]));
    assert!(wb.fails(&["note", "unplace", &id, "Num 25:11"]).contains("not on that place"));
    // its last place: into the Inbox, no longer in the note lists
    wb.js(&["note", "unplace", &id, "Ps 106:30"]);
    let e = wb.js(&["note", "unplace", &id, "1 Cor 10:8"]);
    assert_eq!((e["placed"].clone(), e["anchor"].clone()), (json!(false), json!("")));
    assert_eq!(wb.js(&["inbox"])["notes"][0]["id"], json!(id));
    assert!(wb.dir.join("notes").join("_inbox").join(format!("{id}.md")).exists());
    assert_eq!(wb.js(&["note", "all"])["books"], json!([]));
    // a question at its place waits in the Inbox as a question, still answered
    let q = wb.js(&["trail", "add", "Num 25:11", "who else was zealous"])["id"].as_str().unwrap().to_string();
    wb.js(&["note", "answered", &q]);
    wb.js(&["note", "unplace", &q, "Num 25:11"]);
    let back = wb.js(&["inbox"])["notes"].as_array().unwrap().iter().find(|n| n["id"] == q.as_str()).cloned().unwrap();
    assert_eq!((back["kind"].clone(), back["status"].clone()), (json!("question"), json!("done")));
    assert!(!wb.dir.join("trails").join(format!("{q}.md")).exists());
    // a note still on a thread keeps the thread as its place
    wb.js(&["thread", "new", "Zeal"]);
    let t = wb.js(&["note", "add", "Num 25:11", "on a thread too"])["id"].as_str().unwrap().to_string();
    wb.js(&["note", "thread", &t, "Zeal"]);
    let e = wb.js(&["note", "unplace", &t, "Num 25:11"]);
    assert_eq!((e["label"].clone(), e["placed"].clone()), (json!("On Zeal"), json!(true)));
    assert!(wb.dir.join("notes").join("_threads").join(format!("{t}.md")).exists());
}

#[test]
fn a_thread_holds_notes_of_its_own_and_notes_put_on_it() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "new", "Zeal"]);
    let w = wb.js(&["thread", "write", "Zeal", "what the thread is following"]);
    let id = w["id"].as_str().unwrap().to_string();
    assert_eq!((w["label"].clone(), w["placed"].clone()), (json!("On Zeal"), json!(true)));
    assert!(wb.dir.join("notes").join("_threads").join(format!("{id}.md")).exists());
    // a placed note is put on the thread too
    let n = wb.js(&["note", "add", "Num 25:11", "his zeal"]);
    let nid = n["id"].as_str().unwrap().to_string();
    assert_eq!(wb.js(&["note", "thread", &nid, "zeal"])["threads"][0]["name"], json!("Zeal"));
    let on = wb.js(&["thread", "notes", "Zeal"])["notes"].clone();
    let mut got: Vec<&str> = on.as_array().unwrap().iter().map(|x| x["id"].as_str().unwrap()).collect();
    got.sort();
    let mut want = vec![id.as_str(), nid.as_str()];
    want.sort();
    assert_eq!(got, want);
    // not in the margins or the note lists (it has no place), but in the Journal, All notes and find by its id
    assert_eq!(wb.js(&["journal"])["days"][0]["entries"].as_array().unwrap().iter().filter(|e| e["id"] == id.as_str()).count(), 1);
    assert_eq!(wb.js(&["note", "all"])["books"].as_array().unwrap().last().unwrap()["code"], json!("_threads"));
    assert_eq!(wb.js(&["note", "text", &id, "what this thread follows"])["text"], json!("what this thread follows"));
    // taken off its last thread, a note with no place waits in the Inbox
    wb.js(&["note", "thread", &id, "Zeal", "--remove"]);
    assert_eq!(wb.js(&["inbox"])["notes"][0]["id"], json!(id));
    assert_eq!(wb.js(&["thread", "notes", "Zeal"])["notes"].as_array().unwrap().len(), 1);
    // and put on a thread from the Inbox, it leaves the Inbox
    wb.js(&["note", "thread", &id, "Zeal"]);
    assert_eq!(wb.js(&["inbox"])["notes"], json!([]));
    wb.js(&["note", "rm", &id]);
    assert_eq!(wb.js(&["thread", "notes", "Zeal"])["notes"].as_array().unwrap().len(), 1);
}

#[test]
fn deleted_notes_wait_a_week_in_the_trash_and_can_be_put_back() {
    let Some(wb) = Wb::new() else { return };
    let n = wb.js(&["note", "add", "Num 25:11", "to delete"]);
    let id = n["id"].as_str().unwrap().to_string();
    wb.js(&["note", "rm", &id]);
    let t = wb.js(&["trash"]);
    assert_eq!((t["days"].clone(), t["notes"][0]["id"].clone(), t["notes"][0]["days_left"].clone()), (json!(7), json!(id), json!(7)));
    let name = t["notes"][0]["name"].as_str().unwrap().to_string();
    wb.js(&["trash", "restore", &name]);
    assert_eq!(wb.js(&["note", "list", "Numbers 25"])[0]["id"], json!(id));
    assert_eq!(wb.js(&["trash"])["notes"], json!([]));
    // a week on, a deleted note is erased; other files in .trash (a thread, highlights) stay
    let trash = wb.dir.join(".trash");
    std::fs::write(trash.join("20200101-000000-n_20200101000000_aaaa.md"), "---\nid: \"n_20200101000000_aaaa\"\nanchor: \"\"\nkind: \"jot\"\n---\n\nold\n").unwrap();
    std::fs::write(trash.join("20200101-000000-love.md"), "a thread").unwrap();
    wb.js(&["note", "rm", &id]);
    assert_eq!(wb.js(&["trash", "empty"])["erased"], json!(["20200101-000000-n_20200101000000_aaaa.md"]));
    assert!(trash.join("20200101-000000-love.md").exists());
    assert_eq!(wb.js(&["trash"])["notes"].as_array().unwrap().len(), 1); // deleted today: it waits
}

#[test]
fn erase_now_erases_one_deleted_note_and_nothing_else() {
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["note", "add", "Num 25:11", "to erase now"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["note", "jot", "to keep in the trash"])["id"].as_str().unwrap().to_string();
    wb.js(&["note", "rm", &a]);
    wb.js(&["inbox", "rm", &b]);
    let t = wb.js(&["trash"]);
    let name = |id: &str| t["notes"].as_array().unwrap().iter().find(|n| n["id"] == id).unwrap()["name"].as_str().unwrap().to_string();
    let (na, nb) = (name(&a), name(&b));
    assert_eq!(wb.js(&["trash", "erase", &na]), json!({"erased": [na]}));
    assert!(!wb.dir.join(".trash").join(&na).exists());
    let left: Vec<Value> = wb.js(&["trash"])["notes"].as_array().unwrap().iter().map(|n| n["id"].clone()).collect();
    assert_eq!(left, vec![json!(b)]);
    assert!(wb.fails(&["trash", "restore", &na]).contains("No such file"));
    assert!(wb.fails(&["trash", "erase", &na]).contains("No such file"));
    // only notes and questions: a thread, a highlight file or a plan in .trash is never erased
    std::fs::write(wb.dir.join(".trash").join("20200101-000000-love.md"), "a thread").unwrap();
    assert!(wb.fails(&["trash", "erase", "20200101-000000-love.md"]).contains("Name a note or question"));
    assert!(wb.fails(&["trash", "erase", &format!("../notes/{nb}")]).contains("Name a note or question"));
    assert!(wb.dir.join(".trash").join("20200101-000000-love.md").exists());
    assert!(wb.dir.join(".trash").join(&nb).exists());
}

#[test]
fn a_note_is_placed_on_a_chapter_or_a_book_as_the_run_of_its_verses() {
    let Some(wb) = Wb::new() else { return };
    let c = wb.js(&["note", "new", "Numbers 25, read again\nonce in each version", "--at", "Numbers 25"]);
    assert_eq!((c["anchor"].clone(), c["label"].clone(), c["whole"].clone(), c["title"].clone()), (json!("NUM.25:1-25:18"), json!("Numbers 25"), json!("chapter"), json!("Numbers 25, read again")));
    let b = wb.js(&["note", "new", "Numbers: an outline", "--at", "Numbers"]);
    assert_eq!((b["anchor"].clone(), b["label"].clone(), b["whole"].clone()), (json!("NUM.1:1-36:13"), json!("Numbers"), json!("book")));
    // the file keeps no copy of the chapter's text, in the Python app's format, so its note lists show it
    let text = std::fs::read_to_string(wb.dir.join("notes").join("NUM").join(format!("{}.md", c["id"].as_str().unwrap()))).unwrap();
    assert!(text.contains("anchor: \"NUM.25:1-25:18\"") && text.contains("kind: \"verses\"") && text.contains("quote: \"\""), "{text}");
    assert_eq!(wb.js(&["note", "list", "Numbers 25"]).as_array().unwrap().len(), 2);
    // a note on a verse is put on its chapter too, and taken off it again
    let v = wb.js(&["note", "new", "the plague stayed", "--at", "Num 25:8"])["id"].as_str().unwrap().to_string();
    assert_eq!(wb.js(&["note", "also", &v, "Numbers 25"])["also"], json!([{"anchor": "NUM.25:1-25:18", "label": "Numbers 25"}]));
    assert_eq!(wb.js(&["note", "unplace", &v, "Numbers 25"])["also"], json!([]));
    // an Inbox note placed on a book; a question on a chapter
    let j = wb.js(&["note", "jot", "about the whole book"])["id"].as_str().unwrap().to_string();
    assert_eq!(wb.js(&["note", "place", &j, "Jude"])["label"], json!("Jude"));
    assert_eq!(wb.js(&["note", "new", "why here?", "--at", "Num 25", "--question"])["kind"], json!("question"));
    // with no place, a new note waits in the Inbox; note add keeps the Python app's verses-only rule
    assert_eq!(wb.js(&["note", "new", "a thought"])["placed"], json!(false));
    assert!(wb.fails(&["note", "add", "John 3", "x"]).contains("Name a verse"));
}

#[test]
fn the_notebook_lists_by_day_chapter_thread_or_none() {
    let Some(wb) = Wb::new() else { return };
    let book = wb.js(&["note", "new", "Numbers: an outline", "--at", "Numbers"])["id"].as_str().unwrap().to_string();
    let v9 = wb.js(&["note", "new", "24,000 or 23,000?", "--at", "Num 25:9", "--question"])["id"].as_str().unwrap().to_string();
    let v8 = wb.js(&["note", "new", "tent and belly", "--at", "Num 25:8"])["id"].as_str().unwrap().to_string();
    let ch = wb.js(&["note", "new", "Numbers 25, read again", "--at", "Numbers 25"])["id"].as_str().unwrap().to_string();
    let other = wb.js(&["note", "new", "not this chapter", "--at", "Num 26:1"])["id"].as_str().unwrap().to_string();
    let jot = wb.js(&["note", "jot", "no place yet"])["id"].as_str().unwrap().to_string();
    let ids = |g: &Value| g["entries"].as_array().unwrap().iter().map(|e| e["id"].as_str().unwrap().to_string()).collect::<Vec<_>>();
    // following the reader: the book's note, the chapter's, then by verse
    let l = wb.js(&["notebook", "--group", "chapter", "--at", "Num 25"]);
    assert_eq!(l["groups"].as_array().unwrap().len(), 1);
    assert_eq!((l["groups"][0]["label"].clone(), l["groups"][0]["following"].clone()), (json!("Numbers 25"), json!(true)));
    assert_eq!(ids(&l["groups"][0]), vec![book.clone(), ch.clone(), v8.clone(), v9.clone()]);
    // every chapter: the book first, then chapter by chapter
    let all = wb.js(&["notebook", "--group", "chapter"]);
    let labels: Vec<&str> = all["groups"].as_array().unwrap().iter().map(|g| g["label"].as_str().unwrap()).collect();
    assert_eq!(labels, vec!["Numbers", "Numbers 25", "Numbers 26"]);
    assert_eq!(ids(&all["groups"][2]), vec![other.clone()]);
    // by day: today, with today's page first (blank until written in), the Inbox note among the rest
    let d = wb.js(&["notebook", "--group", "day"]);
    let first = &d["groups"][0];
    assert_eq!((first["today"].clone(), first["entries"][0]["kind"].clone(), first["entries"][0]["exists"].clone()), (json!(true), json!("day"), json!(false)));
    assert!(ids(first).contains(&jot));
    // the pages (once the Inbox) apart, then by thread
    let a = wb.js(&["notebook", "--group", "day", "--inbox-apart"]);
    assert_eq!((a["groups"][0]["label"].clone(), ids(&a["groups"][0])), (json!("Pages"), vec![jot.clone()]));
    wb.js(&["thread", "new", "Phinehas"]);
    wb.js(&["note", "thread", &v8, "Phinehas"]);
    let t = wb.js(&["notebook", "--group", "thread"]);
    assert_eq!((t["groups"][0]["label"].clone(), ids(&t["groups"][0])), (json!("Phinehas"), vec![v8.clone()]));
    assert_eq!(t["groups"][1]["label"], json!("On no thread"));
    // a search and the questions, across every group; none: newest changed first
    assert_eq!(ids(&wb.js(&["notebook", "--group", "none", "--search", "belly"])["groups"][0]), vec![v8.clone()]);
    assert_eq!(ids(&wb.js(&["notebook", "--group", "none", "--questions"])["groups"][0]), vec![v9.clone()]);
    assert!(wb.fails(&["notebook", "--group", "verse"]).contains("Group by day, chapter, thread or none"));
    // the group it opens with is a setting
    wb.js(&["settings", "notebook", "group", "thread"]);
    assert_eq!(wb.js(&["notebook"])["group"], json!("thread"));
}

#[test]
fn today_s_page_is_one_note_a_day_made_when_first_written_in() {
    let Some(wb) = Wb::new() else { return };
    let blank = wb.js(&["day"]);
    assert_eq!((blank["exists"].clone(), blank["kind"].clone(), blank["today"].clone()), (json!(false), json!("day"), json!(true)));
    let day = blank["day"].as_str().unwrap().to_string();
    let file = wb.dir.join("notes").join("_days").join(format!("{day}.md"));
    assert!(!file.exists());
    wb.js(&["day", "add", "Read Numbers 25 twice."]);
    let p = wb.js(&["day", "add", "Then the YLT."]);
    assert_eq!((p["text"].clone(), p["id"].clone()), (json!("Read Numbers 25 twice.\n\nThen the YLT."), json!(format!("d_{day}"))));
    let text = std::fs::read_to_string(&file).unwrap();
    assert!(text.starts_with("---\nid: ") && !text.contains("anchor"), "{text}");
    // the Python app skips a file with no anchor: no note lists, no Inbox
    assert_eq!(wb.js(&["note", "list", "Numbers 25"]), json!([]));
    assert_eq!(wb.js(&["inbox"])["notes"], json!([]));
    // written over by its id, as any note is; a page for another day
    assert_eq!(wb.js(&["note", "text", &format!("d_{day}"), "only this"])["text"], json!("only this"));
    assert_eq!(wb.js(&["day", "add", "earlier", "--day", "2026-11-02"])["title"], json!("Monday, November 2"));
    assert!(wb.fails(&["day", "add", "x", "--day", "tomorrow"]).contains("A day looks like"));
    // emptied or deleted, a page goes to the Trash and comes back
    wb.js(&["day", "text", "", "--day", "2026-11-02"]);
    wb.js(&["day", "rm"]);
    assert!(!file.exists());
    let t = wb.js(&["trash"]);
    assert_eq!(t["notes"].as_array().unwrap().len(), 2);
    let name = t["notes"].as_array().unwrap().iter().find(|n| n["id"] == format!("d_{day}").as_str()).unwrap()["name"].as_str().unwrap().to_string();
    wb.js(&["trash", "restore", &name]);
    assert_eq!(wb.js(&["day"])["text"], json!("only this"));
    // the name days had before (finding 7bc8) still links to the page, as do the new name and the day
    let d = chrono::NaiveDate::parse_from_str(&day, "%Y-%m-%d").unwrap();
    let names = [d.format("%A %-d %B").to_string(), d.format("%A, %B %-d").to_string(), day.clone()];
    let linker = wb.js(&["note", "new", &format!("See [[{}]], [[{}]] and [[{}]].", names[0], names[1], names[2])]);
    let to: Vec<Value> = wb.js(&["note", "links", linker["id"].as_str().unwrap()])["links"].as_array().unwrap().iter().map(|l| l["to"].clone()).collect();
    assert_eq!(to, vec![json!(format!("d_{day}")); 3]);
}

#[test]
fn links_between_notes_with_linked_from_and_a_new_title() {
    let Some(wb) = Wb::new() else { return };
    let q = wb.js(&["note", "new", "24,000 or 23,000?\n# Sources\nNum 25:9", "--at", "Num 25:9", "--question"])["id"].as_str().unwrap().to_string();
    let n = wb.js(&["note", "new", "Numbers 25, read again\nsee [[24,000 or 23,000?#Sources]] and [[24,000 or 23,000?|the numbers]] and [[Nothing yet]]", "--at", "Numbers 25"])["id"].as_str().unwrap().to_string();
    wb.js(&["day", "add", "Wrote up [[Numbers 25, read again]]."]);
    let l = wb.js(&["note", "links", &n])["links"].clone();
    let got: Vec<(Value, Value, Value)> = l.as_array().unwrap().iter().map(|x| (x["title"].clone(), x["to"].clone(), x["heading_ok"].clone())).collect();
    assert_eq!(got, vec![(json!("24,000 or 23,000?"), json!(q), json!(true)), (json!("24,000 or 23,000?"), json!(q), json!(true)), (json!("Nothing yet"), Value::Null, json!(true))]);
    let from = wb.js(&["note", "backlinks", &q])["linked_from"].clone();
    assert_eq!((from.as_array().unwrap().len(), from[0]["id"].clone()), (1, json!(n)));
    let day_from = wb.js(&["note", "backlinks", &n])["linked_from"].clone();
    assert_eq!(day_from[0]["kind"], json!("day"));
    // a new title: the links to the old one follow it, keeping their heading and what they show
    wb.js(&["note", "text", &q, "Twenty-four thousand?\n# Sources\nNum 25:9"]);
    assert_eq!(wb.js(&["note", "relink", &q, "24,000 or 23,000?"])["changed"], json!([n]));
    let t = wb.js(&["note", "show", &n])["text"].clone();
    assert_eq!(t, json!("Numbers 25, read again\nsee [[Twenty-four thousand?#Sources]] and [[Twenty-four thousand?|the numbers]] and [[Nothing yet]]"));
    assert_eq!(wb.js(&["note", "show", &q])["headings"], json!(["Sources"]));
}

#[test]
fn the_notebook_s_settings_are_kept_per_key() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["settings", "notebook"])["group"], json!("day"));
    wb.js(&["settings", "notebook", "follow", "off"]);
    let s = wb.js(&["settings", "notebook", "capture", "alt+n"]);
    assert_eq!((s["follow"].clone(), s["capture"].clone(), s["today"].clone()), (json!(false), json!("Alt+N"), json!(true)));
    let file = std::fs::read_to_string(wb.dir.join("settings").join("notebook.json")).unwrap();
    let saved: Value = serde_json::from_str(&file).unwrap();
    assert_eq!(saved, json!({"follow": false, "capture": "Alt+N"}));
    assert_eq!(wb.js(&["settings", "notebook", "follow", "default"])["follow"], json!(true));
    assert!(wb.fails(&["settings", "notebook", "group", "verse"]).contains("Group by"));
    assert!(wb.fails(&["settings", "notebook", "capture", "J"]).contains("Ctrl or Alt"));
    assert!(wb.fails(&["settings", "reader"]).contains("notebook"));
    assert_eq!(wb.js(&["settings", "notebook", "--about"]).as_array().unwrap().len(), 6);
    // W1: the Inbox is gone from the settings; the Notebook can open with Pages or Questions
    assert!(wb.fails(&["settings", "notebook", "inbox", "on"]).contains("settings are"));
    assert_eq!(wb.js(&["settings", "notebook", "group", "pages"])["group"], json!("pages"));
}

#[test]
fn notes_with_no_place_are_pages_and_questions_a_section() {
    let Some(wb) = Wb::new() else { return };
    let page = wb.js(&["note", "new", "A page of my own"]);
    let placed = wb.js(&["note", "new", "on a verse", "--at", "Num 25:11"]);
    let asked = wb.js(&["note", "new", "asked here", "--at", "Num 25:12", "--question"]);
    let ids = |v: Value| -> Vec<Value> { v["groups"].as_array().unwrap().iter().flat_map(|g| g["entries"].as_array().unwrap().clone()).map(|e| e["id"].clone()).collect() };
    let pages = ids(wb.js(&["notebook", "--group", "pages"]));
    assert!(pages.contains(&page["id"]) && !pages.contains(&placed["id"]) && !pages.iter().any(|i| i.as_str().unwrap().starts_with("d_")), "{pages:?}");
    assert_eq!(ids(wb.js(&["notebook", "--group", "none", "--pages"])), pages);
    let qs = ids(wb.js(&["notebook", "--group", "questions"]));
    assert!(qs.contains(&asked["id"]) && !qs.contains(&page["id"]), "{qs:?}");
}

#[test]
fn reading_a_chapter_is_remembered_and_asked_for_by_place() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["read", "when", "Num 25"]), json!({}));
    let m = wb.js(&["read", "mark", "Num 25"]);
    let w = wb.js(&["read", "when", "Num 24-26"]);
    assert_eq!(w, json!({"NUM.25": m[0]["t"]}));
}

#[test]
fn the_capture_box_language_and_its_manual() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["parse", "uses", "zeal", "gospels"])["action"], json!({"cmd": "uses", "strong": "", "word": "zeal", "scope": "40,41,42,43"}));
    assert!(wb.js(&["parse", "hl", "red"])["error"].as_str().unwrap().starts_with("Colors are"));
    assert!(wb.ok(&["manual", "uses"]).starts_with("uses <word> [scope]"));
    assert_eq!(wb.js(&["refs", "see 1 Cor 10:8 and Num 25:9"]).as_array().unwrap().len(), 2);
}

#[test]
fn a_question_on_words_of_a_verse_is_listed_at_the_verse_and_around_it() {
    // note c39a: Notes & lookup asks `trail list --at`; a question on part of a verse shows at the verse
    let Some(wb) = Wb::new() else { return };
    let part = wb.js(&["trail", "add", "NUM.25:13.3-25:13.6", "Why these words here?"])["id"].as_str().unwrap().to_string();
    let whole = wb.js(&["trail", "add", "Num 25:13", "And the whole verse?"])["id"].as_str().unwrap().to_string();
    let at = |place: &str| -> Vec<(String, bool)> {
        wb.js(&["trail", "list", "--status", "all", "--at", place])["trails"].as_array().unwrap().iter()
            .filter(|t| t["id"] == part.as_str() || t["id"] == whole.as_str())
            .map(|t| (t["id"].as_str().unwrap().to_string(), t["here"].as_bool().unwrap())).collect()
    };
    let mut verse = at("Num 25:13");
    verse.sort();
    let mut want = vec![(part.clone(), false), (whole.clone(), true)];
    want.sort();
    assert_eq!(verse, want);
    assert_eq!(at("NUM.25:13.4").len(), 2);
    assert_eq!(at("Num 25:12-14").len(), 2);
    assert!(at("Num 25:14").is_empty());
    wb.js(&["trail", "done", &part]);
    assert_eq!(at("Num 25:13").len(), 2, "--status all keeps answered ones");
    let open = wb.js(&["trail", "list", "--at", "Num 25:13"])["trails"].as_array().unwrap().iter().filter(|t| t["id"] == part.as_str()).count();
    assert_eq!(open, 0, "the open ones only by default");
}

#[test]
fn a_chapter_counts_its_readings_and_mark_unread_takes_the_latest_off() {
    // note c419: how many times read, and Mark unread (the line kept in .trash, nothing erased)
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["read", "times", "Num 25"]), json!({}));
    wb.js(&["read", "mark", "Num 25"]);
    wb.js(&["read", "mark", "Num 24-25"]);
    let t = wb.js(&["read", "times", "Num 24-25"]);
    assert_eq!((t["NUM.25"]["times"].clone(), t["NUM.24"]["times"].clone()), (json!(2), json!(1)));
    let off = wb.js(&["read", "unmark", "Num 25"]);
    assert_eq!(off["unmarked"].as_array().unwrap().len(), 1);
    assert_eq!(off["now"]["NUM.25"]["times"], json!(1));
    let kept = std::fs::read_to_string(wb.dir.join(".trash").join("reading-unmarked.jsonl")).unwrap();
    assert!(kept.contains("\"ch\": \"NUM.25\""));
    assert_eq!(wb.js(&["read", "times", "Num 24"])["NUM.24"]["times"], json!(1), "another chapter is untouched");
    wb.js(&["read", "unmark", "Num 25"]);
    assert_eq!(wb.js(&["read", "times", "Num 25"]), json!({}));
    assert_eq!(wb.js(&["read", "unmark", "Num 25"])["unmarked"], json!([]), "a chapter not in the log is passed over");
    assert_eq!(std::fs::read_to_string(wb.dir.join(".trash").join("reading-unmarked.jsonl")).unwrap().lines().count(), 2);
}

#[test]
fn findings_are_kept_apart_from_the_study() {
    // note 50c1: findings/<id>.md, not in the Notebook; handled, edited, deleted to .trash
    let Some(wb) = Wb::new() else { return };
    let f = wb.js(&["finding", "add", "Ctrl+F finds only in the reader", "--context", "{\"size\": \"large\", \"panes\": [\"Notebook (right)\"]}"]);
    let id = f["id"].as_str().unwrap().to_string();
    assert!(id.starts_with("f_"));
    let text = std::fs::read_to_string(wb.dir.join("findings").join(format!("{id}.md"))).unwrap();
    assert!(text.contains("kind: \"finding\"") && text.contains("status: \"open\"") && text.contains("\"size\": \"large\""));
    assert!(!wb.js(&["notebook", "--group", "none"]).to_string().contains("Ctrl+F finds only"), "not in the Notebook");
    assert!(wb.fails(&["finding", "add", "x", "--context", "[1]"]).contains("JSON object"));
    let short = &id[id.len() - 4..];
    assert_eq!(wb.js(&["finding", "handled", short])["status"], json!("handled"));
    assert_eq!(wb.js(&["findings"])["findings"], json!([]));
    assert_eq!(wb.js(&["findings", "--all"])["counts"], json!({"open": 0, "handled": 1}));
    assert_eq!(wb.js(&["finding", "handled", &id, "--open"])["status"], json!("open"));
    assert_eq!(wb.js(&["finding", "edit", &id, "Ctrl+F should find in the pane"])["title"], json!("Ctrl+F should find in the pane"));
    wb.js(&["finding", "rm", &id]);
    assert!(!wb.dir.join("findings").join(format!("{id}.md")).exists());
    assert!(std::fs::read_dir(wb.dir.join(".trash")).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().ends_with(&format!("finding-{id}.md"))));
    assert!(wb.fails(&["finding", "handled", &id]).contains("No such finding"));
}

// ---- documents from a thread (tier 4) ----

/// The text of a .docx, paragraph by paragraph (the check reads it the same way).
fn docx_text(path: &std::path::Path) -> String {
    use std::io::Read;
    let mut z = zip::ZipArchive::new(std::fs::File::open(path).unwrap()).unwrap();
    let mut xml = String::new();
    z.by_name("word/document.xml").unwrap().read_to_string(&mut xml).unwrap();
    let t = regex::Regex::new(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>").unwrap();
    xml.split("</w:p>").map(|p| t.captures_iter(p).map(|c| c[1].to_string()).collect::<String>()).collect::<Vec<_>>().join("\n")
}

#[test]
fn a_thread_becomes_a_speaker_script_and_a_verse_deck_each_kept_as_one_file() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "new", "Phinehas", "--note", "Where he is named.", "--at", "Num 25:10-13"]);
    wb.js(&["thread", "add", "Phinehas", "Psalms 106:30"]);
    wb.js(&["note", "add", "Num 25:11", "the same zeal"]);
    wb.ok(&["hl", "set", "Num 25:11", "green"]);
    let verses: Vec<String> = [verse_texts(&wb, "Num 25:10-13"), verse_texts(&wb, "Psalms 106:30")].concat();

    // the Speaker Script: made once, every verse in it word for word, its record in the Python app's format
    let made = wb.js(&["craft", "word", "--thread", "phinehas", "--structure", "script", "--theme", "olivet"]);
    assert_eq!((made["id"].as_str(), made["name"].as_str(), made["changed"].as_bool()), (Some("thread-phinehas-script"), Some("Speaker Script - Phinehas.docx"), Some(true)));
    assert_eq!(made["checked"]["verses"], 5);
    let file = wb.docs().join("Speaker Script - Phinehas.docx");
    let text = docx_text(&file);
    for v in &verses {
        assert!(text.contains(v.as_str()), "the script lacks {v}");
    }
    assert!(text.contains("Speaker's script") && text.contains("Study: the same zeal") && text.contains("Where he is named."));
    let rec: Value = serde_json::from_str(&std::fs::read_to_string(wb.dir.join("documents").join("thread-phinehas-script.json")).unwrap()).unwrap();
    let plan = wb.js(&["docs", "plan", "--thread", "phinehas", "--to", "word", "--structure", "script"]);
    assert_eq!(rec["plan"], plan["fingerprint"]);
    assert_eq!((rec["source"].clone(), rec["to"].clone(), rec["theme"].clone()), (json!({"kind": "thread", "id": "phinehas"}), json!("word"), json!("olivet")));
    assert!(rec["file"].as_str().unwrap().len() == 64 && rec["sig"].as_array().unwrap().len() == 2);

    // asked again (in the same theme: without --theme it is the saved one, as in the Python app): the same file, nothing to do
    let again = wb.js(&["craft", "word", "--thread", "phinehas", "--structure", "script", "--theme", "olivet"]);
    assert_eq!((again["changed"].as_bool(), again["name"].as_str()), (Some(false), Some("Speaker Script - Phinehas.docx")));

    // a new note puts it behind; docs update brings it up to date in the same file
    wb.js(&["note", "add", "Psalms 106:30", "stood up"]);
    let row = |id: &str| wb.js(&["docs", "list"]).as_array().unwrap().iter().find(|d| d["id"] == id).cloned().unwrap();
    assert_eq!((row("thread-phinehas-script")["state"].as_str(), row("thread-phinehas-script")["behind"].as_bool()), (Some("behind"), Some(true)));
    assert_eq!(wb.js(&["docs", "update"])["updated"].as_array().unwrap().len(), 1);
    assert_eq!(row("thread-phinehas-script")["state"], "current");
    assert!(docx_text(&file).contains("Study: stood up"));

    // a file changed by hand is noticed, and kept as a copy before a rebuild replaces it
    std::fs::OpenOptions::new().append(true).open(&file).unwrap().write_all(b" ").unwrap();
    assert_eq!(row("thread-phinehas-script")["state"], "edited");
    let forced = wb.js(&["docs", "update", "speaker script", "--force"]);
    let kept = forced["kept_now"].as_str().unwrap();
    assert!(kept.starts_with("Speaker Script - Phinehas (your edits ") && wb.docs().join(kept).is_file());
    assert_eq!(row("thread-phinehas-script")["state"], "current");

    // Verse by Verse as PDF pages: a title slide and one slide a verse, every verse on them; a record of its own
    let deck = wb.js(&["craft", "deck", "--thread", "phinehas", "--structure", "verse"]);
    assert_eq!((deck["id"].as_str(), deck["name"].as_str(), deck["to"].as_str()), (Some("thread-phinehas-verse-pdf"), Some("Verse by Verse - Phinehas.pdf"), Some("pdf")));
    assert_eq!((deck["checked"]["verses"].as_i64(), deck["checked"]["pages"].as_i64()), (Some(5), Some(6)));
    assert!(std::fs::read(wb.docs().join("Verse by Verse - Phinehas.pdf")).unwrap().starts_with(b"%PDF-"));
    assert_eq!(deck["theme"], "vellum"); // the saved theme, as none is saved: Vellum
    wb.js(&["craft", "theme", "vigil"]);
    assert_eq!(wb.js(&["craft", "theme"])["theme"], "vigil");

    // what the Python app still makes says so
    assert!(wb.fails(&["craft", "word", "--thread", "phinehas"]).contains("Thread Dossier is still made by the Python app"));
    assert!(wb.fails(&["craft", "deck", "--thread", "phinehas", "--structure", "pulpit"]).contains("--structure verse"));
    assert!(wb.fails(&["craft", "word", "--passage", "John 3:16"]).contains("from a thread"));

    // forget, remember, delete (the files erased, the record to .trash)
    assert_eq!(wb.js(&["docs", "forget", "verse by verse"])["ok"], true);
    assert_eq!(row("thread-phinehas-verse-pdf")["state"], "forgotten");
    assert_eq!(wb.js(&["docs", "remember", "verse by verse"])["state"], "current");
    let gone = wb.js(&["docs", "delete", "speaker script"]);
    assert_eq!(gone["deleted"].as_array().unwrap().len(), 2); // the file and the kept copy
    assert!(!file.exists() && !wb.dir.join("documents").join("thread-phinehas-script.json").exists());
    assert!(std::fs::read_dir(wb.dir.join(".trash")).unwrap().flatten().any(|e| e.file_name().to_string_lossy().ends_with("thread-phinehas-script.json")));
    assert!(wb.fails(&["docs", "show", "speaker script"]).contains("No document called"));
}
