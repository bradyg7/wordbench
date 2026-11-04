//! The data parts of the Python app's tests/test_cli.py, carried over: the `wb` binary, run on a scratch study folder of
//! its own. (Its window-relay, raw-API, Craft and PDF tests belong to later phases.) No verse is typed here: where the
//! Python tests quote scripture, these compare with what `wb text` gives from the database.

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
