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
        c.args(args).env("WB_STUDY_DIR", &self.dir).env_remove("WB_DOCS_DIR").env("WB_NO_OPEN", "1").stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
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

impl Wb {
    fn docs(&self) -> PathBuf {
        self.dir.join("exports")
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
    let deleted = wb.js(&["note", "rm", n["id"].as_str().unwrap()]);
    assert_eq!(deleted["state"], "pending");
    assert_eq!(deleted["deleted"], json!([n["id"]]));
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
    // its own file in notes/_inbox, in the notes' format, with no anchor at all (a page has no place)
    let file = wb.dir.join("notes").join("_inbox").join(format!("{id}.md"));
    let text = std::fs::read_to_string(&file).unwrap();
    assert!(text.starts_with("---\nid: \"") && !text.contains("anchor") && text.contains("kind: \"jot\""), "{text}");
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
fn an_inbox_note_is_changed_made_a_question_or_deleted_with_undo() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["note", "jot", "first thought"]);
    assert_eq!(wb.js(&["inbox", "edit", "first", "a better thought"])["text"], json!("a better thought"));
    assert_eq!(wb.js(&["inbox", "edit", "better", "--question"])["kind"], json!("question"));
    assert!(wb.fails(&["inbox", "edit", "nothing like it", "x"]).contains("No note in the Inbox"));
    let deletion = wb.js(&["inbox", "rm", "better"]);
    assert_eq!(wb.js(&["inbox"])["notes"], json!([]));
    assert_eq!(deletion["deleted"][0], deletion["id"]);
    assert_eq!(wb.js(&["page", "deletions"])["operations"][0]["operation"], deletion["operation"]);
    wb.js(&["page", "undo", deletion["operation"].as_str().unwrap()]);
    assert_eq!(wb.js(&["inbox"])["notes"][0]["text"], "a better thought");
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
    wb_core::store::Store::open(&wb.dir).unwrap().delete_note(&id).unwrap();
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
    wb_core::store::Store::open(&wb.dir).unwrap().delete_note(&id).unwrap();
    assert_eq!(wb.js(&["trash", "empty"])["erased"], json!(["20200101-000000-n_20200101000000_aaaa.md"]));
    assert!(trash.join("20200101-000000-love.md").exists());
    assert_eq!(wb.js(&["trash"])["notes"].as_array().unwrap().len(), 1); // deleted today: it waits
}

#[test]
fn erase_now_erases_one_deleted_note_and_nothing_else() {
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["note", "add", "Num 25:11", "to erase now"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["note", "jot", "to keep in the trash"])["id"].as_str().unwrap().to_string();
    let mut legacy = wb_core::store::Store::open(&wb.dir).unwrap();
    legacy.delete_note(&a).unwrap();
    legacy.delete_jot(&b).unwrap();
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
    // Explicit deletion has timed Undo. Emptying a day through day text retains legacy behavior.
    wb.js(&["day", "text", "", "--day", "2026-11-02"]);
    let deletion = wb.js(&["day", "rm", "today"]);
    assert!(!file.exists());
    let t = wb.js(&["trash"]);
    assert_eq!(t["notes"].as_array().unwrap().len(), 1);
    assert_eq!(deletion["deleted"], json!([format!("d_{day}")]));
    assert_eq!(deletion["day"], day);
    assert!(wb.fails(&["day", "rm", "tomorrow"]).contains("A day looks like"));
    wb.js(&["page", "undo", deletion["operation"].as_str().unwrap()]);
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
    assert_eq!(wb.js(&["settings", "notebook", "--about"]).as_array().unwrap().len(), 5); // the settings build: five Notebook settings now
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

/// Every file under a folder, with its bytes, by its path from the folder (to see what a command wrote).
fn tree_of(dir: &std::path::Path) -> std::collections::BTreeMap<String, Vec<u8>> {
    let mut out = std::collections::BTreeMap::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(&d).into_iter().flatten().flatten() {
            let p = e.path();
            if p.is_dir() {
                stack.push(p);
            } else {
                out.insert(p.strip_prefix(dir).unwrap().to_string_lossy().replace('\\', "/"), std::fs::read(&p).unwrap());
            }
        }
    }
    out
}

#[test]
fn files_attach_to_a_finding_in_its_own_folder() {
    // debug round C1 (finding b737): findings/<id>/, copied in, capped, listed, opened, taken off to .trash
    let Some(wb) = Wb::new() else { return };
    let f = wb.js(&["finding", "add", "The box could take a screenshot"]);
    let id = f["id"].as_str().unwrap().to_string();
    let short = &id[id.len() - 4..];
    assert_eq!(f["files"], json!([]));
    let md = wb.dir.join("findings").join(format!("{id}.md"));
    let md_before = std::fs::read(&md).unwrap();
    // the files to attach, outside the study folder: a PNG's and a PDF's first bytes, and one over the cap
    let src = wb.dir.with_extension("src");
    std::fs::create_dir_all(&src).unwrap();
    let png: Vec<u8> = [&b"\x89PNG\r\n\x1a\n"[..], &[0u8; 64]].concat();
    let pdf = b"%PDF-1.4\n%%EOF\n".to_vec();
    std::fs::write(src.join("shot.png"), &png).unwrap();
    std::fs::write(src.join("example.pdf"), &pdf).unwrap();
    std::fs::write(src.join("big.bin"), vec![0u8; 10 * 1024 * 1024 + 1]).unwrap();
    std::fs::write(src.join("tool.exe"), b"MZ").unwrap();
    let before = tree_of(&wb.dir);
    let a = wb.js(&["finding", "attach", short, src.join("shot.png").to_str().unwrap(), src.join("example.pdf").to_str().unwrap()]);
    assert_eq!(a["attached"], json!(["shot.png", "example.pdf"]));
    // only findings/<id>/ was written: everything else in the study folder is as it was, the finding's .md too
    let after = tree_of(&wb.dir);
    let changed: Vec<&String> = after.keys().filter(|k| before.get(*k) != after.get(*k)).collect();
    assert_eq!(changed, vec![&format!("findings/{id}/example.pdf"), &format!("findings/{id}/shot.png")]);
    assert!(before.keys().all(|k| after.contains_key(k)));
    assert_eq!(std::fs::read(&md).unwrap(), md_before, "the .md is the same with files attached");
    // copied, never moved, byte for byte
    assert_eq!(std::fs::read(src.join("shot.png")).unwrap(), png);
    assert_eq!(after[&format!("findings/{id}/shot.png")], png);
    assert_eq!(after[&format!("findings/{id}/example.pdf")], pdf);
    // listed in wb finding show (with paths) and in wb findings
    let shown = wb.js(&["finding", "show", short]);
    let names: Vec<&str> = shown["files"].as_array().unwrap().iter().map(|f| f["name"].as_str().unwrap()).collect();
    assert_eq!(names, ["example.pdf", "shot.png"]);
    assert_eq!(shown["files"][1]["size"], json!(png.len()));
    assert!(std::path::Path::new(shown["files"][1]["path"].as_str().unwrap()).is_file());
    assert_eq!(wb.js(&["findings"])["findings"][0]["files"].as_array().unwrap().len(), 2);
    // the same name again is kept beside it, not over it
    assert_eq!(wb.js(&["finding", "attach", short, src.join("shot.png").to_str().unwrap()])["attached"], json!(["shot (2).png"]));
    // the cap, said; a folder; a file that is not there
    assert!(wb.fails(&["finding", "attach", short, src.join("big.bin").to_str().unwrap()]).contains("10 MB at most"));
    assert!(wb.fails(&["finding", "attach", short, src.to_str().unwrap()]).contains("is a folder"));
    assert!(wb.fails(&["finding", "attach", short, src.join("nothing.png").to_str().unwrap()]).contains("No file at"));
    assert!(!wb.dir.join("findings").join(&id).join("big.bin").exists());
    // the short id still finds the finding with its folder beside it
    assert_eq!(wb.js(&["finding", "handled", short])["status"], json!("handled"));
    // opened (WB_NO_OPEN: the test opens nothing on the screen); a program is shown in its folder, never run
    let (code, out, err) = {
        let mut c = std::process::Command::new(env!("CARGO_BIN_EXE_wb"));
        c.args(["finding", "open", short, "example"]).env("WB_STUDY_DIR", &wb.dir).env("WB_NO_OPEN", "1");
        let o = c.output().unwrap();
        (o.status.code().unwrap_or(-1), String::from_utf8_lossy(&o.stdout).to_string(), String::from_utf8_lossy(&o.stderr).to_string())
    };
    assert_eq!(code, 0, "{err}");
    let opened: Value = serde_json::from_str(&out).unwrap();
    assert_eq!((opened["name"].clone(), opened["shown_in_folder"].clone()), (json!("example.pdf"), json!(false)));
    assert!(wb.fails(&["finding", "open", short, "nothing"]).contains("No file called"));
    assert!(wb.fails(&["finding", "open", short, "shot"]).contains("More than one"));
    // taken off: to .trash, nothing erased
    let d = wb.js(&["finding", "detach", short, "shot (2).png"]);
    assert_eq!(d["removed"], json!("shot (2).png"));
    assert_eq!(d["finding"]["files"].as_array().unwrap().len(), 2);
    let trashed = |end: &str| std::fs::read_dir(wb.dir.join(".trash")).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().ends_with(end));
    assert!(trashed(&format!("finding-{id}-shot (2).png")));
    // a finding deleted takes its files to .trash with it, and its folder goes
    wb.js(&["finding", "rm", short]);
    assert!(!wb.dir.join("findings").join(&id).exists());
    assert!(trashed(&format!("finding-{id}-example.pdf")) && trashed(&format!("finding-{id}-shot.png")));
    // a finding with no files writes no folder at all
    let g = wb.js(&["finding", "add", "No files with this one"]);
    assert!(!wb.dir.join("findings").join(g["id"].as_str().unwrap()).exists());
    let _ = std::fs::remove_dir_all(&src);
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
fn a_page_becomes_a_speaker_script_and_a_verse_deck_its_to_dos_left_out() {
    // W6: a page and the pages inside it, planned from the page each time; to-dos left out unless switched on
    let Some(wb) = Wb::new() else { return };
    let add = |id: &str, b: &str| {
        let (code, _, err) = wb.run(&["block", "add", id, "-"], Some(b));
        assert_eq!(code, 0, "{err}");
    };
    let top = wb.js(&["page", "new", "Lesson: a page"])["id"].as_str().unwrap().to_string();
    for b in ["# Aim", "Read it with the group.", "- [ ] print it\n- [x] read it twice", "```scripture\nNum 25:10-11\n```"] {
        add(&top, b);
    }
    let inside = wb.js(&["page", "new", "The psalm", "--parent", &top])["id"].as_str().unwrap().to_string();
    add(&inside, "```scripture\nPsalms 106:30\nylt\n```");
    add(&inside, "- [ ] a to-do inside");
    let parts = wb.js(&["craft", "parts", "--page", &top]);
    let kinds: Vec<&str> = parts["rows"].as_array().unwrap().iter().map(|r| r["kind"].as_str().unwrap()).collect();
    assert_eq!(kinds, ["heading", "paragraph", "todo", "scripture", "page"]);
    let todo = parts["rows"][2].clone();
    assert_eq!((todo["on"].as_bool(), todo["becomes"].as_str()), (Some(false), Some("Left out: to-dos are for you")));
    assert_eq!(parts["inside"], 1);

    // both made; each verse word for word, in the version its block shows (the psalm in the YLT)
    let verses: Vec<String> = verse_texts(&wb, "Num 25:10-11");
    let ylt: Vec<String> = wb.js(&["text", "Psalms 106:30", "--version", "YLT", "--json"])["verses"].as_array().unwrap().iter().map(|v| v["text"].as_str().unwrap().to_string()).collect();
    let word = wb.js(&["craft", "word", "--page", &top, "--theme", "print"]);
    assert_eq!((word["id"].as_str().unwrap(), word["checked"]["verses"].as_i64()), (format!("page-{top}-script").as_str(), Some(3)));
    assert_eq!(word["checked"]["refs"], json!(["Numbers 25:10 (KJV)", "Numbers 25:11 (KJV)", "Psalms 106:30 (YLT)"]));
    let deck = wb.js(&["craft", "deck", "--page", &top]);
    assert_eq!(deck["id"].as_str().unwrap(), format!("page-{top}-verse"));
    assert!(deck["pages"].as_i64().unwrap() >= 5);
    let planned = wb.js(&["docs", "plan", "--page", &top, "--to", "pdf", "--pages"]);
    assert_eq!(planned["pages"], deck["pages"]);
    let file = wb.docs().join(word["name"].as_str().unwrap());
    let text = docx_text(&file);
    for v in verses.iter().chain(&ylt) {
        assert!(text.contains(v.as_str()), "the script lacks {v}");
    }
    assert!(text.contains("\nThe psalm\n") && !text.contains("print it") && !text.contains("a to-do inside"));
    let rec: Value = serde_json::from_str(&std::fs::read_to_string(wb.dir.join("documents").join(format!("page-{top}-script.json"))).unwrap()).unwrap();
    assert_eq!(rec["source"], json!({"kind": "page", "id": top}));
    assert_eq!(rec["plan"], wb.js(&["docs", "plan", "--page", &top, "--to", "word"])["fingerprint"]);

    // switched on, the to-dos are your words (the page inside keeps its own left out), and the switch is kept
    let key = todo["key"].as_str().unwrap();
    wb.js(&["craft", "word", "--page", &top, "--on", key]);
    let text = docx_text(&file);
    assert!(text.contains("To do: print it") && text.contains("Done: read it twice") && !text.contains("a to-do inside"));
    assert_eq!(wb.js(&["craft", "parts", "--page", &top])["rows"][2]["on"], true);
    assert!(wb.fails(&["craft", "word", "--page", &top, "--on", "b:nothing"]).contains("no row"));

    // Pending switches and version are used by the preview without saving choices.
    let scripture = parts["rows"][3]["key"].as_str().unwrap();
    let pending = wb.js(&["docs", "plan", "--page", &top, "--to", "pdf", "--off", scripture, "--version", "kjv", "--pages", "--theme", "print"]);
    assert_eq!(pending["verses"], json!(["Psalms 106:30 (KJV)"]));
    assert_eq!(wb.js(&["docs", "plan", "--page", &top, "--to", "pdf"])["fingerprint"], planned["fingerprint"]);
    let applied = wb.js(&["craft", "deck", "--page", &top, "--off", scripture, "--version", "kjv", "--theme", "print"]);
    assert_eq!(applied["pages"], pending["pages"]);
    assert_eq!(applied["checked"]["refs"], pending["verses"]);

    // one version for every block, in the documents only: the page keeps its own
    let all_kjv = wb.js(&["craft", "word", "--page", &top, "--version", "kjv"]);
    assert_eq!(all_kjv["checked"]["refs"][2], "Psalms 106:30 (KJV)");
    assert_eq!(wb.js(&["page", "scripture", &inside])["blocks"][0]["version"], "YLT");

    // the page changed: behind; docs update makes it again in the same file; the page deleted: gone
    add(&top, "More of my words.");
    let state = |id: String| wb.js(&["docs", "show", &id])["state"].as_str().unwrap().to_string();
    assert_eq!(state(format!("page-{top}-script")), "behind");
    assert_eq!(wb.js(&["docs", "update", &format!("page-{top}-script")])["name"], word["name"]);
    assert_eq!(state(format!("page-{top}-script")), "current");
    assert_eq!(wb.js(&["docs", "list", "--page", &top]).as_array().unwrap().len(), 2);
    let pv = wb.js(&["docs", "preview", &format!("page-{top}-script")]);
    assert!(pv["paras"].as_array().unwrap().iter().any(|p| p["style"] == "SlideCue"));
    // the slides are drawn only while the deck is up to date (then they are the file's pages); words of yours do not
    // change a deck of verses, a scripture block does
    assert!(wb.js(&["docs", "preview", &format!("page-{top}-verse")])["slides"].is_array());
    add(&top, "```scripture\nNum 25:9\n```");
    let stale = wb.js(&["docs", "preview", &format!("page-{top}-verse")]);
    assert!(stale["stale"].is_string());
    assert_eq!(stale["last_built_pages"], applied["pages"]);
    let deck_now = wb.js(&["docs", "update", &format!("page-{top}-verse")]);
    let slides = wb.js(&["docs", "preview", &format!("page-{top}-verse")])["slides"].clone();
    assert_eq!(slides.as_array().unwrap().len() as i64, deck_now["pages"].as_i64().unwrap());
    assert!(slides[0].as_str().unwrap().starts_with("<svg"));
    // R3: the shipped templates are made from a page too; what the Python app still makes says so
    assert!(wb.js(&["craft", "word", "--page", &top, "--structure", "share"])["name"].as_str().unwrap().starts_with("Share Copy"));
    assert!(wb.fails(&["craft", "deck", "--page", &top, "--structure", "pulpit"]).contains("phase 5"));
    wb.ok(&["inbox", "rm", &top]);
    assert_eq!(state(format!("page-{top}-verse")), "gone");
}

#[test]
fn a_legacy_export_is_resolved_safely_for_open_preview_update_and_delete() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "new", "Export location", "--at", "Num 25:10"]);
    let made = wb.js(&["craft", "word", "--thread", "Export location", "--structure", "script"]);
    let id = made["id"].as_str().unwrap();
    let name = made["name"].as_str().unwrap();
    let record_file = wb.dir.join("documents").join(format!("{id}.json"));
    let mut record: Value = serde_json::from_slice(&std::fs::read(&record_file).unwrap()).unwrap();
    assert_eq!(record["export_location"], "study");
    record.as_object_mut().unwrap().shift_remove("export_location");
    record["pdf"] = json!("associated.pdf");
    record["kept"] = json!(["kept.docx"]);
    std::fs::write(&record_file, serde_json::to_vec(&record).unwrap()).unwrap();

    let local_file = wb.docs().join(name);
    let legacy = wb.dir.with_file_name(format!("{}-documents", wb.dir.file_name().unwrap().to_string_lossy()));
    std::fs::create_dir_all(&legacy).unwrap();
    let legacy_file = legacy.join(name);
    std::fs::rename(&local_file, &legacy_file).unwrap();
    std::fs::copy(&legacy_file, &local_file).unwrap();
    for op in ["open", "preview", "reveal", "update", "delete"] {
        assert!(wb.fails(&["docs", op, id]).contains("More than one export"));
    }
    assert!(record_file.is_file() && local_file.is_file() && legacy_file.is_file());
    assert_eq!(wb.js(&["docs", "show", id])["state"], "unreadable");

    std::fs::write(&local_file, "a different file with the same name").unwrap();
    for op in ["show", "open", "preview", "reveal", "update"] {
        assert_eq!(wb.js(&["docs", op, id])["path"], legacy_file.to_string_lossy().as_ref());
    }
    for dir in [&legacy, &wb.docs()] {
        std::fs::write(dir.join("associated.pdf"), "test companion").unwrap();
        std::fs::write(dir.join("kept.docx"), "test kept version").unwrap();
    }
    let deleted = wb.js(&["docs", "delete", id]);
    assert_eq!(deleted["deleted"].as_array().unwrap().len(), 3);
    assert!(local_file.is_file() && wb.docs().join("kept.docx").is_file() && wb.docs().join("associated.pdf").is_file());
    assert!(!record_file.is_file());
    std::fs::remove_dir(&legacy).unwrap();

    std::fs::remove_file(local_file).unwrap();
    std::fs::write(&record_file, serde_json::to_vec(&record).unwrap()).unwrap();
    assert_eq!(wb.js(&["docs", "show", id])["state"], "missing");
    assert!(wb.fails(&["docs", "update", id]).contains("set WB_DOCS_DIR"));
    assert!(wb.fails(&["docs", "delete", id]).contains("Restore the main export"));
    assert!(record_file.is_file() && wb.docs().join("associated.pdf").is_file());
}

#[test]
fn standalone_legacy_pdfs_open_from_shelf_and_refuse_ambiguous_names() {
    let Some(wb) = Wb::new() else { return };
    let legacy = wb.dir.with_file_name(format!("{}-documents", wb.dir.file_name().unwrap().to_string_lossy()));
    std::fs::create_dir(&legacy).unwrap();
    let name = "Older study (1).PDF";
    let original = wb.js(&["craft", "deck", "--passage", "John 3:16"]);
    let path = legacy.join(name);
    std::fs::rename(original["path"].as_str().unwrap(), &path).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    std::fs::write(legacy.join("another format.docx"), b"fixture").unwrap();
    std::fs::create_dir(legacy.join("not a file.pdf")).unwrap();
    let files = wb.js(&["pdfs"]);
    assert_eq!(files.as_array().unwrap().len(), 1);
    assert_eq!(files[0]["name"], name);
    assert_eq!(files[0]["size"], bytes.len());
    let opened = wb.js(&["pdfs", "older study"]);
    assert_eq!(opened["path"], path.to_str().unwrap());

    wb.js(&["set", "new", "Saved", "--pdf", name, "--pdf", "Older study.PDF"]);
    let plan = wb.js(&["set", "open", "saved"]);
    assert_eq!(plan["items"][0]["open"], format!("pdf|{name}"));
    assert!(plan["items"][1]["why"].as_str().unwrap().contains("No saved PDF"));
    assert_eq!(wb.js(&["pdfs", name, "--exact"])["ok"], true);
    assert!(wb.fails(&["pdfs", "Older study.PDF", "--exact"]).contains("No saved PDF"));
    assert!(wb.fails(&["pdfs", "../Older study (1).PDF"]).contains("without a path"));

    std::fs::write(wb.docs().join(name), b"another file").unwrap();
    assert!(wb.fails(&["pdfs", name, "--exact"]).contains("More than one saved PDF"));
    let plan = wb.js(&["set", "open", "saved"]);
    assert!(plan["items"][0]["why"].as_str().unwrap().contains("More than one saved PDF"));
    assert_eq!(std::fs::read(path).unwrap(), bytes);
    std::fs::remove_file(legacy.join(name)).unwrap();
    std::fs::remove_file(legacy.join("another format.docx")).unwrap();
    std::fs::remove_dir(legacy.join("not a file.pdf")).unwrap();
    std::fs::remove_dir(legacy).unwrap();
}

#[test]
fn chapter_pdf_preserves_kjv_references_and_creates_a_new_file() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["note", "add", "John 3:16", "Existing note in this chapter."]);
    wb.js(&["note", "add", "John 4:1", "Note in the next chapter."]);
    wb.ok(&["hl", "set", "John 3:16", "green"]);
    let thread = wb.js(&["thread", "new", "Review", "--at", "John 3:17", "--color", "#654321"]);
    let marked = wb.js(&["pdf", "John 3:16", "--thread", thread["id"].as_str().unwrap(), "--open"]);
    let plain = wb.js(&["pdf", "John 3-4", "--no-highlights"]);
    let refs = marked["checked"]["refs"].as_array().unwrap();
    assert_eq!(refs.first().unwrap(), "John 3:1 (KJV)");
    assert_eq!(refs.last().unwrap(), "John 3:36 (KJV)");
    assert_eq!(marked["checked"]["verses"], verse_texts(&wb, "John 3").len());
    assert_eq!(plain["checked"]["refs"], marked["checked"]["refs"]);
    assert_eq!(marked["notes"], 1);
    assert_eq!(plain["notes"], 1);
    assert_ne!(plain["path"], marked["path"]);
    for file in [plain, marked] {
        let bytes = std::fs::read(file["path"].as_str().unwrap()).unwrap();
        assert!(bytes.starts_with(b"%PDF-"));
        assert_eq!(file["size"], bytes.len());
    }
    assert_eq!(wb.js(&["pdfs"]).as_array().unwrap().len(), 2);
    assert_eq!(wb.js(&["docs", "list"]), json!([]));
}

#[test]
fn editable_powerpoint_keeps_its_pdf_preview_and_pdf_export_separate() {
    let Some(wb) = Wb::new() else { return };
    let source = ["--passage", "John 3:16-18"];
    let create = |format: &str| wb.js(&["craft", "deck", source[0], source[1], "--format", format]);
    let deck = create("pptx");
    assert_eq!(deck["to"], "deck");
    assert_eq!(deck["pages"], 4);
    let id = deck["id"].as_str().unwrap();
    let open = wb.js(&["docs", "open", id]);
    let preview = wb.js(&["docs", "open-preview", id]);
    assert_eq!(open["path"], deck["path"]);
    assert_eq!(preview["name"], deck["pdf"]);
    let preview_path = wb.docs().join(deck["pdf"].as_str().unwrap());
    let pptx_path = wb.docs().join(deck["name"].as_str().unwrap());
    let companion = std::fs::read(&preview_path).unwrap();
    assert!(companion.starts_with(b"%PDF-"));
    assert_eq!(wb.js(&["docs", "preview", id])["pdf"], preview["path"]);
    let pptx = std::fs::read(&pptx_path).unwrap();
    assert!(pptx.starts_with(b"PK"));
    let separate = wb.js(&["craft", "deck", source[0], source[1]]);
    assert_eq!(separate["to"], "pdf");
    assert_ne!(separate["id"], deck["id"]);
    assert_ne!(separate["path"], preview["path"]);
    assert_eq!(create("pptx")["changed"], false);
    let office = format!("document:{id}");
    let inputs = ["packet", separate["name"].as_str().unwrap(), &office, "--out", "Mixed packet.pdf", "--open"];
    let packet = wb.js(&inputs);
    assert_eq!(packet["name"], "Mixed packet.pdf");
    assert_eq!(packet["pages"], separate["pages"].as_u64().unwrap() + deck["pages"].as_u64().unwrap());
    assert!(std::fs::read(packet["path"].as_str().unwrap()).unwrap().starts_with(b"%PDF-"));
    assert!(wb.fails(&inputs).contains("already has that name"));
    assert_eq!(std::fs::read(&preview_path).unwrap(), companion);
    assert_eq!(std::fs::read(&pptx_path).unwrap(), pptx);

    // An update that fails after publishing keeps both old files and the old record.
    let record = wb.dir.join("documents").join(format!("{id}.json"));
    let saved = std::fs::read(&record).unwrap();
    let blocker = record.with_file_name(format!("{id}.json.tmp"));
    std::fs::create_dir(&blocker).unwrap();
    assert!(!wb.fails(&["docs", "update", id, "--theme", "vigil", "--force"]).is_empty());
    std::fs::remove_dir(blocker).unwrap();
    assert_eq!(std::fs::read(&record).unwrap(), saved);
    assert_eq!(std::fs::read(&pptx_path).unwrap(), pptx);
    assert_eq!(std::fs::read(&preview_path).unwrap(), companion);

    let mut edited = pptx;
    edited.extend(b"existing hand edits");
    std::fs::write(&pptx_path, &edited).unwrap();
    let updated = wb.js(&["docs", "update", id, "--theme", "vigil", "--force"]);
    assert_eq!(updated["id"], id);
    assert_eq!(updated["pdf"], deck["pdf"]);
    let kept = wb.docs().join(updated["kept_now"].as_str().unwrap());
    assert_eq!(std::fs::read(kept).unwrap(), edited);
    assert!(std::fs::read(&preview_path).unwrap().starts_with(b"%PDF-"));

    // A page's existing PDF record and the editable deck can also coexist.
    let page = wb.js(&["page", "new", "Export source"]);
    let page = page["id"].as_str().unwrap();
    let (code, _, error) = wb.run(&["block", "add", page, "-"], Some("```scripture\nJohn 3:16\n```"));
    assert_eq!(code, 0, "{error}");
    let pdf = wb.js(&["craft", "deck", "--page", page]);
    let pptx = wb.js(&["craft", "deck", "--page", page, "--format", "pptx"]);
    assert_ne!(pdf["id"], pptx["id"]);
    assert_eq!(pdf["to"], "pdf");
    assert_eq!(pptx["to"], "deck");
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

    // Legacy structures still report which formats Rust supports.
    assert!(wb.fails(&["craft", "word", "--thread", "phinehas"]).contains("Thread Dossier is still made by the Python app"));
    assert!(wb.fails(&["craft", "deck", "--thread", "phinehas", "--structure", "pulpit"]).contains("--structure reader or verse"));

    // A passage can also be exported directly as a Reading Sheet.
    let passage = wb.js(&["craft", "word", "--passage", "John 3:16"]);
    assert_eq!(passage["source"]["kind"], "passage");
    assert_eq!(passage["structure"], "reading");
    assert_eq!(passage["checked"]["refs"], json!(["John 3:16 (KJV)"]));
    let reading = docx_text(&wb.docs().join(passage["name"].as_str().unwrap()));
    assert!(reading.contains(verse_texts(&wb, "John 3:16")[0].as_str()));

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

#[test]
fn a_page_inside_a_page_and_a_moved_block_read_correctly_in_the_files() {
    // W3: parent, order and pinned in the front matter; blocks are lines of the file
    let Some(wb) = Wb::new() else { return };
    let lesson = wb.js(&["page", "new", "Lesson: Phinehas"])["id"].as_str().unwrap().to_string();
    let file = |id: &str| -> String {
        ["notes/_inbox", "notes/NUM", "trails"].iter().map(|d| wb.dir.join(d).join(format!("{id}.md"))).find(|p| p.exists()).map(|p| std::fs::read_to_string(p).unwrap()).unwrap_or_default()
    };
    let outline = wb.js(&["page", "new", "Outline", "--parent", &lesson, "--link"]);
    let outline = outline["id"].as_str().unwrap().to_string();
    let group = wb.js(&["page", "new", "Questions for the group", "--parent", &lesson])["id"].as_str().unwrap().to_string();
    assert!(file(&outline).contains(&format!("parent: \"{lesson}\"\norder: 1\n")), "{}", file(&outline));
    assert!(file(&group).contains("order: 2\n"));
    assert!(file(&lesson).ends_with("Lesson: Phinehas\n\n[[Outline]]\n"), "{}", file(&lesson));
    let tree = wb.js(&["page", "tree"]);
    let top = tree["pages"].as_array().unwrap().iter().find(|p| p["id"] == lesson.as_str()).unwrap().clone();
    let kids: Vec<&str> = top["children"].as_array().unwrap().iter().map(|c| c["title"].as_str().unwrap()).collect();
    assert_eq!(kids, ["Outline", "Questions for the group"]);
    // moved first, then put at the top and back inside
    wb.js(&["page", "move", &group, "--first"]);
    let show = wb.js(&["note", "show", &group]);
    assert_eq!(show["path"][0]["title"], "Lesson: Phinehas");
    assert_eq!(wb.js(&["note", "show", &lesson])["inside"][0]["title"], "Questions for the group");
    assert!(wb.fails(&["page", "move", &lesson, "--parent", &group]).contains("inside itself"));
    wb.js(&["page", "move", &outline, "--top"]);
    assert!(!file(&outline).contains("parent:"));
    wb.js(&["page", "move", &outline, "--parent", &lesson, "--after", &group]);
    assert!(file(&outline).contains(&format!("parent: \"{lesson}\"")) && file(&outline).contains("order: 2\n"));
    // pinned: its place in Pinned, in the page itself
    wb.js(&["page", "pin", &group]);
    wb.js(&["page", "pin", &lesson, "--first"]);
    assert!(file(&lesson).contains("pinned: 1\n") && file(&group).contains("pinned: 2\n"));
    let pinned: Vec<Value> = wb.js(&["page", "tree"])["pinned"].as_array().unwrap().iter().map(|p| p["id"].clone()).collect();
    assert_eq!(pinned, [json!(lesson), json!(group)]);
    wb.js(&["page", "unpin", &lesson]);
    assert!(!file(&lesson).contains("pinned"));
    // blocks: written, added, moved, ticked; each a run of lines in the file
    let o = &outline;
    wb.js(&["block", "add", o, "# Aim"]);
    wb.js(&["block", "add", o, "- [ ] Read it twice"]);
    wb.js(&["block", "add", o, "- [ ] List every use of the word"]);
    let r = wb.js(&["block", "add", o, "- [ ] Print the deck"]);
    assert_eq!((r["n"].as_i64(), r["blocks"].as_array().unwrap().len()), (Some(4), 4));
    wb.js(&["block", "move", o, "4", "--to", "2"]);
    wb.js(&["block", "check", o, "3"]);
    let body = file(o);
    assert!(body.ends_with("Outline\n\n# Aim\n\n- [ ] Print the deck\n- [x] Read it twice\n- [ ] List every use of the word\n"), "{body}");
    let r = wb.js(&["block", "set", o, "1", "# Aim\n\nRead the chapter with the group."]);
    assert_eq!((r["n"].as_i64(), r["count"].as_i64()), (Some(1), Some(2)));
    wb.js(&["block", "rm", o, "3"]);
    let kinds: Vec<Value> = wb.js(&["page", "blocks", o])["blocks"].as_array().unwrap().iter().map(|b| b["kind"].clone()).collect();
    assert_eq!(kinds, [json!("heading"), json!("paragraph"), json!("todo"), json!("todo")]);
    wb.js(&["page", "title", o, "An outline"]);
    assert!(file(o).contains("---\n\nAn outline\n\n# Aim"));
    // a page placed on a verse keeps its place in the tree
    wb.js(&["note", "place", &group, "Num 25:11"]);
    assert!(file(&group).contains(&format!("parent: \"{lesson}\"")) && file(&group).contains("anchor: \"NUM.25:11\""), "{}", file(&group));
    assert_eq!(wb.js(&["note", "show", &lesson])["inside"].as_array().unwrap().len(), 2);
    // deleting a page: the pages inside it move up a level, into its place
    let before = wb.js(&["page", "new", "Before"])["id"].as_str().unwrap().to_string();
    wb.js(&["page", "move", &lesson, "--top", "--after", &before]);
    wb.ok(&["inbox", "rm", &lesson]);
    let tops: Vec<String> = wb.js(&["page", "tree"])["pages"].as_array().unwrap().iter().map(|p| p["title"].as_str().unwrap().to_string()).collect();
    // (the page placed on a verse, at the top with nothing inside it, is a note at its place: Places lists it)
    assert_eq!(tops, ["Before", "An outline"]);
    assert!(!file(o).contains("parent:") && !file(&group).contains("parent:"));
}

#[test]
fn a_scripture_block_holds_only_its_reference_and_its_verses_come_from_the_bible() {
    // W4: the file keeps ```scripture, the reference, and lines / ylt when chosen; wb page scripture gives the verses
    // as wb text does, with the highlights on them as runs
    let Some(wb) = Wb::new() else { return };
    let id = wb.js(&["page", "new", "The passage"])["id"].as_str().unwrap().to_string();
    let (code, _, err) = wb.run(&["block", "add", &id, "-"], Some("```scripture\nNum 25:10-13\n```"));
    assert_eq!(code, 0, "{err}");
    wb.js(&["block", "add", &id, "Then the psalm."]);
    let (code, _, err) = wb.run(&["block", "add", &id, "-"], Some("```scripture\nPs 106:28-31\nlines\n```"));
    assert_eq!(code, 0, "{err}");
    wb.ok(&["hl", "set", "Num 25:11", "green"]);
    let file = || std::fs::read_to_string(wb.dir.join("notes/_inbox").join(format!("{id}.md"))).unwrap().replace("\r\n", "\n");
    let s = wb.js(&["page", "scripture", &id]);
    let blocks = s["blocks"].as_array().unwrap();
    assert_eq!(blocks.len(), 2);
    assert_eq!((blocks[0]["n"].as_u64(), blocks[0]["lines"].as_bool(), blocks[0]["version"].as_str()), (Some(1), Some(false), Some("KJV")));
    assert_eq!((blocks[1]["n"].as_u64(), blocks[1]["lines"].as_bool()), (Some(3), Some(true)));
    for (b, r) in [(&blocks[0], "Num 25:10-13"), (&blocks[1], "Ps 106:28-31")] {
        let want: Vec<String> = wb.js(&["text", r, "--json"])["verses"].as_array().unwrap().iter().map(|v| v["text"].as_str().unwrap().to_string()).collect();
        let got: Vec<String> = b["verses"].as_array().unwrap().iter().map(|v| v["text"].as_str().unwrap().to_string()).collect();
        assert_eq!(got, want);
        // the runs joined are each verse's text, as it is
        for v in b["verses"].as_array().unwrap() {
            let joined: String = v["runs"].as_array().unwrap().iter().map(|r| r["t"].as_str().unwrap()).collect();
            assert_eq!(joined, v["text"].as_str().unwrap());
        }
        // and no verse is in the file
        assert!(want.iter().all(|t| !file().contains(t.as_str())));
    }
    // the highlight on Num 25:11 is on every word of the verse, and on no other
    let runs = |v: usize| blocks[0]["verses"][v]["runs"].as_array().unwrap().clone();
    assert!(runs(1).len() == 1 && runs(1)[0]["hl"] == "green", "{:?}", runs(1));
    assert!(runs(0).iter().all(|r| r.get("hl").is_none()));
    // the choices, kept in the fence
    wb.js(&["block", "scripture", &id, "1", "--lines", "--ylt"]);
    assert!(file().contains("```scripture\nNum 25:10-13\nlines\nylt\n```"), "{}", file());
    let y = wb.js(&["page", "scripture", &id]);
    assert_eq!(y["blocks"][0]["version"], "YLT");
    let ylt: Vec<Value> = wb.js(&["text", "Num 25:10-13", "--version", "ylt", "--json"])["verses"].as_array().unwrap().iter().map(|v| v["text"].clone()).collect();
    assert_eq!(y["blocks"][0]["verses"].as_array().unwrap().iter().map(|v| v["text"].clone()).collect::<Vec<_>>(), ylt);
    wb.js(&["block", "scripture", &id, "1", "--paragraph", "--kjv"]);
    assert!(file().contains("```scripture\nNum 25:10-13\n```\n\nThen the psalm."), "{}", file());
    assert!(wb.fails(&["block", "scripture", &id, "2", "--lines"]).contains("not a scripture block"));
    assert!(wb.fails(&["block", "scripture", &id, "1"]).contains("Say what to change"));
    assert!(wb.fails(&["block", "scripture", &id, "1", "--ylt", "--kjv"]).contains("not both"));
    // wb scripture: one reference, the same verses and runs
    let one = wb.js(&["scripture", "Num 25:11"]);
    assert_eq!(one["verses"][0]["runs"][0]["hl"], "green");
    assert_eq!(one["label"], "Numbers 25:11");
}

#[test]
fn places_open_in_the_reader_or_a_new_reader_and_the_sidebar_has_a_row_per_reader() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["settings", "notebook"])["places"], "reader");
    assert_eq!(wb.js(&["settings", "notebook", "places", "new"])["places"], "new");
    let file = std::fs::read_to_string(wb.dir.join("settings").join("notebook.json")).unwrap();
    assert!(file.contains("\"places\": \"new\""), "{file}");
    assert!(wb.fails(&["settings", "notebook", "places", "elsewhere"]).contains("new reader"));
    assert_eq!(wb.js(&["settings", "notebook", "places", "default"])["places"], "reader");
    wb.js(&["note", "new", "On the psalm", "--at", "Ps 106:30"]);
    let s = wb.js(&["notebook", "sidebar", "--at", "Num 25; Ps 106"]);
    let rows = s["at_readers"].as_array().unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!((rows[0]["label"].as_str(), rows[0]["reader"].as_str()), (Some("Numbers 25"), Some("the reader")));
    assert_eq!((rows[1]["label"].as_str(), rows[1]["reader"].as_str(), rows[1]["count"].as_u64()), (Some("Psalms 106"), Some("new reader"), Some(1)));
    assert_eq!(s["at_reader"]["label"], "Numbers 25");
}

#[test]
fn a_view_lists_what_its_line_finds_and_writes_nothing() {
    // W5: one parser for a view's line; wb view run, a page's views (wb page views) and the command field (wb parse) agree
    let Some(wb) = Wb::new() else { return };
    let id_of = |v: Value| v["id"].as_str().unwrap().to_string();
    let tent = id_of(wb.js(&["note", "new", "zeal at the tent", "--at", "Num 25:8"]));
    let q = id_of(wb.js(&["note", "new", "How do the numbers relate?", "--at", "Num 25:9", "--question"]));
    let ps = id_of(wb.js(&["note", "new", "the psalm remembers it", "--at", "Ps 106:30"]));
    let whole = id_of(wb.js(&["note", "new", "on the whole chapter", "--at", "Numbers 25"]));
    let ids = |v: &Value| v["rows"].as_array().unwrap().iter().map(|r| r["id"].as_str().unwrap().to_string()).collect::<Vec<_>>();
    // @place: every note on a verse of it, in Bible order (the whole chapter's from its first verse)
    assert_eq!(ids(&wb.js(&["view", "run", "notebook @Num 25"])), [whole.clone(), tent.clone(), q.clone()]);
    assert_eq!(ids(&wb.js(&["view", "run", "notebook @Num 25 questions"])), [q.clone()]);
    assert_eq!(ids(&wb.js(&["view", "run", "notebook @Num 25:8-9 open"])), [q.clone()]);
    assert_eq!(ids(&wb.js(&["view", "run", "notebook zeal"])), [tent.clone()]);
    assert_eq!(ids(&wb.js(&["view", "run", "notebook @Psalms days 1"])), [ps.clone()]);
    assert!(wb.fails(&["view", "run", "notebook thread nowhere"]).contains("No thread"));
    assert!(wb.fails(&["view", "run", "notebook @Num 99"]).contains("chapters"));
    // the command field reads the same line
    assert_eq!(wb.js(&["parse", "notebook @Num 25 questions"]), serde_json::json!({"action": {"cmd": "notebook", "line": "@Num 25 questions"}}));
    // in a page: its views with their rows; the line changed in place; a line that cannot be read is not written
    let page = id_of(wb.js(&["page", "new", "Questions for the group"]));
    let (code, _, err) = wb.run(&["block", "add", &page, "-"], Some("```view\nnotebook @Num 25 questions\n```"));
    assert_eq!(code, 0, "{err}");
    let file = || std::fs::read_to_string(wb.dir.join("notes/_inbox").join(format!("{page}.md"))).unwrap().replace("\r\n", "\n");
    let before = file();
    let v = wb.js(&["page", "views", &page]);
    assert_eq!((v["blocks"][0]["n"].as_u64(), v["blocks"][0]["line"].as_str()), (Some(1), Some("notebook @Num 25 questions")));
    assert_eq!(ids(&v["blocks"][0]), [q.clone()]);
    assert_eq!(file(), before, "a view writes nothing");
    wb.js(&["block", "view", &page, "1", "notebook @Ps 106"]);
    assert!(file().contains("```view\nnotebook @Ps 106\n```"), "{}", file());
    assert_eq!(ids(&wb.js(&["page", "views", &page])["blocks"][0]), [ps]);
    wb.fails(&["block", "view", &page, "1", "notebook @Nowhere 9"]);
    assert!(file().contains("```view\nnotebook @Ps 106\n```"));
}

#[test]
fn a_page_made_from_a_template_has_its_blanks_filled() {
    // W5: a template is a note with template: true, left out of Pages and search; a page made from it gets its blocks,
    // the blanks filled, and from_template; Save as a template takes the places out
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["template", "list"])["templates"], serde_json::json!([]));
    let tpl = wb.js(&["template", "new", "Chapter study"])["id"].as_str().unwrap().to_string();
    wb.js(&["template", "set", "chapter study", "--asks", "place", "--names", "Chapter study: {place}"]);
    for b in ["# Read", "```scripture\n{place}\n```", "On {date} at {reader}: {title}"] {
        let (code, _, err) = wb.run(&["block", "add", &tpl, "-"], Some(b));
        assert_eq!(code, 0, "{err}");
    }
    let tfile = std::fs::read_to_string(wb.dir.join("notes/_inbox").join(format!("{tpl}.md"))).unwrap().replace("\r\n", "\n");
    assert!(tfile.contains("\ntemplate: true\n") && tfile.contains("\nasks: \"place\"\n"), "{tfile}");
    assert!(wb.fails(&["page", "new", "--template", "Chapter study"]).contains("asks for a place"));
    let made = wb.js(&["page", "new", "--template", "chapter", "--place", "Num 25", "--reader", "Ps 106"]);
    let text = made["text"].as_str().unwrap();
    assert_eq!(made["title"], "Chapter study: Numbers 25");
    assert_eq!(made["from_template"].as_str(), Some(tpl.as_str()));
    assert!(text.starts_with("Chapter study: Numbers 25\n\n# Read\n\n```scripture\nNumbers 25\n```\n\nOn "), "{text}");
    assert!(text.ends_with(" at Psalms 106: Chapter study: Numbers 25") && !text.contains('{'), "{text}");
    let id = made["id"].as_str().unwrap().to_string();
    // its scripture block reads Numbers 25 from the Bible
    let s = wb.js(&["page", "scripture", &id]);
    let got: Vec<String> = s["blocks"][0]["verses"].as_array().unwrap().iter().map(|v| v["text"].as_str().unwrap().to_string()).collect();
    assert_eq!(got, verse_texts(&wb, "Num 25"));
    // the template is left out of the tree and search; listed with how often used
    let tree = wb.ok(&["page", "tree"]);
    assert!(tree.contains(&id) && !tree.contains(&tpl));
    let found = wb.js(&["notebook", "--group", "none", "--search", "chapter study"]);
    let found: Vec<&str> = found["groups"].as_array().unwrap().iter().flat_map(|g| g["entries"].as_array().unwrap().iter().map(|e| e["id"].as_str().unwrap())).collect();
    assert!(found.contains(&id.as_str()) && !found.contains(&tpl.as_str()), "{found:?}");
    let l = wb.js(&["template", "list"]);
    assert_eq!((l["templates"][0]["used"].as_u64(), l["templates"][0]["summary"].as_str()), (Some(1), Some("a heading, a scripture block, a block of writing")));
    // Save as a template: a copy with its places taken out
    let again = wb.js(&["template", "save", &id, "--name", "Study again"]);
    assert_eq!(again["asks"], "place");
    let shown = wb.js(&["template", "show", "Study again"]);
    assert!(shown["text"].as_str().unwrap().contains("```scripture\n{place}\n```"), "{}", shown["text"]);
    assert!(wb.fails(&["template", "new", "chapter study"]).contains("already"));
    let deletion = wb.js(&["template", "rm", "Study again"]);
    assert_eq!(deletion["state"], "pending");
    assert_eq!(deletion["id"], shown["id"]);
    assert_eq!(deletion["title"], shown["title"]);
    assert_eq!(wb.js(&["template", "list"])["templates"].as_array().unwrap().len(), 1);
    assert!(wb.ok(&["guide", "templates"]).contains("{place} the place picked"));
}

// ---- R1: a thread as a page ---------------------------------------------------------------------------------------

#[test]
fn a_thread_is_a_page_written_in_blocks_while_its_file_stays_the_python_apps() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "add-many", "Zeal", "Num 25:11", "Rom 10:2"]);
    let file = wb.dir.join("threads").join("zeal.md");
    let p = wb.js(&["thread", "page", "Zeal"]);
    assert_eq!(p["id"], "thread:zeal");
    assert_eq!(p["title"], "Zeal");
    assert_eq!(p["places"].as_array().unwrap().len(), 2);
    assert!(p["blocks"].as_array().unwrap().is_empty());
    // its note is written block by block, as any page is
    wb.js(&["block", "add", "thread:zeal", "# Where I start"]);
    wb.js(&["block", "add", "thread:zeal", "The places I read first."]);
    let text = std::fs::read_to_string(&file).unwrap().replace("\r\n", "\n");
    assert!(text.contains("# Where I start\n\nThe places I read first.\n\n<!-- anchors -->\n- NUM.25:11 |"), "{text}");
    assert!(text.contains("- ROM.10:2 |"));
    assert_eq!(wb.js(&["thread", "show", "Zeal"])["note"], "# Where I start\n\nThe places I read first.");
    // the thread's header holds only what both apps keep
    let head: Vec<&str> = text.split("---").nth(1).unwrap().lines().filter(|l| !l.is_empty()).map(|l| l.split(':').next().unwrap()).collect();
    assert_eq!(head, ["name", "created", "updated"]);
    // pinned, which is kept in settings/pages.json and not in the thread's file
    let before = std::fs::read_to_string(&file).unwrap();
    wb.js(&["thread", "pin", "Zeal"]);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), before);
    let pages: Value = serde_json::from_str(&std::fs::read_to_string(wb.dir.join("settings").join("pages.json")).unwrap()).unwrap();
    assert_eq!(pages["pinned"]["zeal"], 1);
    let tree = wb.js(&["page", "tree"]);
    assert_eq!(tree["pinned"][0]["id"], "thread:zeal");
    assert!(tree["pages"].as_array().unwrap().iter().any(|r| r["id"] == "thread:zeal" && r["kind"] == "thread"));
    // a thread's page is not moved among the pages
    assert!(wb.fails(&["page", "move", "thread:zeal", "--top"]).contains("stays where it is"));
    // a page written on it is under it in the tree
    let n = wb.js(&["thread", "write", "Zeal", "A thought on it"]);
    let tree = wb.js(&["page", "tree"]);
    let me = tree["pages"].as_array().unwrap().iter().find(|r| r["id"] == "thread:zeal").unwrap();
    assert_eq!(me["children"][0]["id"], n["id"]);
    // a page made "inside" a thread is a page written on it, with its link in the thread's note
    let inside = wb.js(&["page", "new", "Inside the thread", "--parent", "thread:zeal", "--link"]);
    assert_eq!(wb.js(&["thread", "notes", "Zeal"])["notes"].as_array().unwrap().iter().filter(|x| x["id"] == inside["id"]).count(), 1);
    assert!(wb.js(&["thread", "show", "Zeal"])["note"].as_str().unwrap().contains("[[Inside the thread]]"));
    wb.js(&["thread", "unpin", "Zeal"]);
    assert!(wb.js(&["page", "tree"])["pinned"].as_array().unwrap().is_empty());
    // an empty note is a thread with no note, and the page can be written in again
    wb.js(&["block", "rm", "thread:zeal", "1", "--count", "3"]);
    assert_eq!(wb.js(&["thread", "show", "Zeal"])["note"], "");
}

#[test]
fn a_link_can_name_a_thread() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "new", "Phinehas"]);
    let n = wb.js(&["note", "new", "See [[Phinehas]] for the places."]);
    let shown = wb.js(&["note", "show", n["id"].as_str().unwrap()]);
    assert_eq!(shown["links"][0]["to"], "thread:phinehas");
    assert_eq!(wb.js(&["note", "show", "thread:phinehas"])["linked_from"][0]["id"], n["id"]);
}

// ---- R1: thread and word blocks, and questions written in a page ------------------------------------------------------

#[test]
fn a_page_holds_a_thread_and_a_word_as_blocks_that_hold_only_an_id_and_a_number() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "add-many", "Zeal", "Num 25:11", "Rom 10:2"]);
    let page = wb.js(&["page", "new", "Lesson"]);
    let id = page["id"].as_str().unwrap();
    wb.js(&["block", "add", id, "```thread\nZeal\n```"]);
    wb.js(&["block", "add", id, "```word\nh7065\n```"]);
    let t = wb.js(&["page", "threads", id]);
    let b = &t["blocks"][0];
    assert_eq!((b["thread"].as_str(), b["name"].as_str(), b["count"].as_u64()), (Some("zeal"), Some("Zeal"), Some(2)));
    assert_eq!(b["refs"].as_array().unwrap().len(), 2);
    // the word's entry is the lexicon's, and none of it is in the file
    let w = wb.js(&["page", "words", id]);
    assert_eq!(w["blocks"][0]["strong"], "H7065");
    assert!(w["blocks"][0]["occurrences"].as_i64().unwrap() > 0);
    assert!(!w["blocks"][0]["definition"].as_str().unwrap_or("").is_empty());
    let file: String = std::fs::read_dir(wb.dir.join("notes").join("_inbox")).unwrap().flatten().map(|e| std::fs::read_to_string(e.path()).unwrap()).collect();
    assert!(file.contains("```word\nh7065\n```") || file.contains("```word\r\nh7065\r\n```"));
    assert!(!file.contains(w["blocks"][0]["definition"].as_str().unwrap()));
    // the blocks are changed only to what exists
    wb.js(&["block", "word", id, "2", "H7068"]);
    assert_eq!(wb.js(&["page", "words", id])["blocks"][0]["strong"], "H7068");
    assert!(wb.fails(&["block", "word", id, "2", "H9999999"]).contains("not a Strong's number the lexicon has"));
    assert!(wb.fails(&["block", "thread", id, "1", "No such thread"]).contains("No thread called"));
    wb.js(&["block", "thread", id, "1", "zeal"]);
    // in a document: the thread's places go in as the thread's do; the word is left out unless switched on
    let parts = wb.js(&["craft", "parts", "--page", id]);
    let rows = parts["rows"].as_array().unwrap();
    let th = rows.iter().find(|r| r["kind"] == "thread").unwrap();
    assert_eq!((th["on"].as_bool(), th["text"].as_str()), (Some(true), Some("Zeal · 2 places")));
    assert_eq!(rows.iter().find(|r| r["kind"] == "word").unwrap()["on"], false);
    let plan = wb.js(&["docs", "plan", "--page", id, "--to", "word", "--structure", "script"]).to_string();
    for place in ["Num 25:11", "Rom 10:2"] {
        for v in verse_texts(&wb, place) {
            assert!(plan.contains(&v), "{place} is in the page's plan");
        }
    }
}

#[test]
fn search_every_page_finds_thread_names_and_notes() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["thread", "add", "Orchard Trial", "Num 25:11"]);
    wb.js(&["thread", "edit", "Orchard Trial", "--note", "A note about mulberries."]);
    let search = |term: &str| wb.js(&["notebook", "--group", "none", "--search", term]);
    for term in ["ORCHARD", "mulberries", "orchard mulberries"] {
        let result = search(term);
        let hit = &result["groups"][0]["entries"][0];
        assert_eq!(hit["id"], "thread:orchard-trial");
        assert_eq!(hit["kind"], "thread");
        assert_eq!(hit["preview"], "A note about mulberries.");
    }
    assert!(search("orchard walnuts")["groups"][0]["entries"].as_array().unwrap().is_empty());
    assert!(wb.js(&["notebook", "--group", "none"])["groups"][0]["entries"].as_array().unwrap().is_empty());
}

#[test]
fn a_question_written_in_a_page_is_one_with_the_questions_at_a_verse() {
    let Some(wb) = Wb::new() else { return };
    let n = wb.js(&["note", "new", "Notes on the chapter", "--at", "Num 25:9"]);
    let id = n["id"].as_str().unwrap().to_string();
    // written as a callout, in the page's own text, and answered by turning its mark
    let q = wb.js(&["question", "add", &id, "How do the two numbers relate?"]);
    assert_eq!(q["id"], format!("{id}#1"));
    assert_eq!((q["status"].as_str(), q["page"].as_str()), (Some("open"), Some(id.as_str())));
    let text = |wb: &Wb| wb.js(&["note", "show", &id])["text"].as_str().unwrap().to_string();
    assert!(text(&wb).ends_with("> [!question] How do the two numbers relate?"), "{}", text(&wb));
    // one list: it is with the trails; the reader's ? and the verse card find it by its page's place
    wb.js(&["note", "new", "A question at a verse", "--at", "Num 25:15", "--question"]);
    let all = wb.js(&["questions"]);
    assert_eq!(all["questions"].as_array().unwrap().len(), 2);
    // a view that lists questions lists it too
    assert!(wb.js(&["view", "run", "notebook questions open"])["rows"].as_array().unwrap().iter().any(|r| r["id"] == format!("{id}#1")));
    let here = wb.js(&["question", "list", "--at", "Num 25:9"]);
    let qs = here["questions"].as_array().unwrap();
    assert_eq!(qs.len(), 1);
    assert_eq!((qs[0]["form"].as_str(), qs[0]["here"].as_bool()), (Some("block"), Some(true)));
    let near = wb.js(&["question", "list", "--at", "NUM.25:9.3"]);
    assert_eq!(near["questions"].as_array().unwrap().len(), 1); // a word of the verse: the verse's question shows
    assert!(wb.js(&["question", "list", "--at", "Num 25:15"])["questions"].as_array().unwrap().iter().all(|q| q["form"] == "trail"));
    let marks = wb.js(&["reader", "NUM", "25"]);
    assert!(marks["questions"].as_array().unwrap().iter().any(|q| q["v"] == 9), "{marks}");
    // answered: its mark turns over, nothing else of the page changes
    let before = text(&wb);
    let a = wb.js(&["question", "answer", &format!("{id}#1")]);
    assert_eq!(a["status"], "done");
    assert_eq!(text(&wb), before.replace("[!question]", "[!done]"));
    assert!(wb.js(&["questions"])["questions"].as_array().unwrap().iter().all(|q| q["id"] != format!("{id}#1")));
    assert_eq!(wb.js(&["questions", "--status", "done"])["questions"].as_array().unwrap().len(), 1);
    wb.js(&["question", "answer", &format!("{id}#1"), "--open"]);
    // folded in and out: the trail becomes a block of a page at its place, and back
    let t = wb.js(&["trail", "list"])["trails"][0]["id"].as_str().unwrap().to_string();
    let multiline = "A question at a verse\n  with a second line\n\nand a new paragraph";
    wb.js(&["trail", "edit", &t, multiline]);
    wb.js(&["note", "answered", &t]);
    assert!(wb.fails(&["question", "fold", &t, &id]).contains("not at that question's place"));
    let f = wb.js(&["question", "fold", &t, &id, "--also"]);
    assert_eq!(f["page"], id);
    assert!(wb.js(&["trail", "list"])["trails"].as_array().unwrap().is_empty());
    let q3 = f["question"].as_str().unwrap().to_string();
    assert!(wb.fails(&["question", "unfold", &q3, "--at", "Num 25:11"]).contains("one of the page's places"));
    let u = wb.js(&["question", "unfold", &q3, "--at", "Num 25:15"]);
    assert_eq!(u["page"], id);
    let all = wb.js(&["trail", "list", "--status", "all"]);
    let trails = all["trails"].as_array().unwrap();
    assert_eq!(trails.len(), 1);
    assert_eq!(trails[0]["anchor"], "NUM.25:15");
    assert_eq!(trails[0]["status"], "done");
    assert_eq!(trails[0]["text"], multiline);
    assert_eq!(text(&wb), before);
}

#[test]
fn wb_page_is_wb_note_under_its_new_name() {
    let Some(wb) = Wb::new() else { return };
    let n = wb.js(&["page", "new", "A page"]);
    let id = n["id"].as_str().unwrap();
    assert_eq!(wb.js(&["page", "show", id]), wb.js(&["note", "show", id]));
    wb.js(&["page", "text", id, "A page, written again"]);
    assert_eq!(wb.js(&["note", "show", id])["title"], "A page, written again");
    // a command of wb page's own is not a note's
    assert!(wb.js(&["page", "tree"])["pages"].is_array());
}

#[test]
fn the_shelf_is_a_tree_of_sets_kept_beside_them_and_open_all_says_what_each_item_opens() {
    let Some(wb) = Wb::new() else { return };
    // a set as the Python app keeps it: kept panes in its own shape
    std::fs::create_dir_all(wb.dir.join("sets")).unwrap();
    std::fs::write(wb.dir.join("sets").join("ruth.md"), "---
name: \"Ruth\"
created: \"2026-11-02T20:29:10Z\"
updated: \"2026-11-02T20:29:10Z\"
---

- {\"key\": \"i1\", \"kind\": \"pane\", \"type\": \"entry\", \"id\": \"word\", \"title\": \"H6653\", \"params\": {\"sid\": \"H6653\"}}
- {\"key\": \"i2\", \"kind\": \"pane\", \"type\": \"interlinear\", \"id\": \"interlinear\", \"title\": \"I\", \"params\": {\"book\": 4, \"c1\": 25, \"v1\": 7, \"c2\": 25, \"v2\": 13}}
- {\"key\": \"i3\", \"kind\": \"pane\", \"type\": \"uses\", \"id\": \"uses\", \"title\": \"U\", \"params\": {\"strong\": \"H5234\", \"word\": \"\", \"rendering\": \"know\", \"scope\": \"all\"}}
- {\"key\": \"i4\", \"kind\": \"pane\", \"type\": \"passage\", \"id\": \"passage\", \"title\": \"P\", \"params\": {\"book\": 45, \"ch\": 14, \"v\": 22, \"version\": \"KJV\"}}
- {\"key\": \"i5\", \"kind\": \"pane\", \"type\": \"search\", \"id\": \"search\", \"title\": \"S\", \"params\": {\"q\": \"laying on of hands\", \"scope\": \"all\"}}
- {\"key\": \"i6\", \"kind\": \"pane\", \"type\": \"mystery\", \"id\": \"m\", \"title\": \"M\", \"params\": {}}
- {\"key\": \"i7\", \"kind\": \"place\", \"ref\": \"NUM.25:1-25:18\"}
").unwrap();
    let plan = wb.js(&["set", "open", "ruth"]);
    let opens: Vec<Value> = plan["items"].as_array().unwrap().iter().map(|i| i.get("open").cloned().unwrap_or(Value::Null)).collect();
    assert_eq!(opens, vec![json!("strong|H6653"), json!("interlinear|Numbers 25:7-13"), json!("uses|H5234||all|know"), json!("reader2|Romans 14|KJV"),
        json!("search|laying on of hands|all"), Value::Null, json!("reader2|NUM.25:1-25:18|KJV")]);
    assert!(plan["items"][5]["why"].as_str().unwrap().contains("mystery"));

    // folders: each a set; where it sits is in settings/shelf.json, and the set files keep the Python app's format
    wb.ok(&["shelf", "new", "Phinehas study"]);
    wb.ok(&["shelf", "new", "Word study", "--in", "Phinehas study"]);
    wb.ok(&["shelf", "new", "Covenant", "--in", "Phinehas study"]);
    wb.ok(&["shelf", "move", "Covenant", "--in", "Phinehas study", "--before", "Word study"]);
    wb.ok(&["shelf", "move", "Ruth", "--in", "Word study"]);
    assert!(wb.fails(&["shelf", "move", "Phinehas study", "--in", "Ruth"]).contains("cannot go inside itself"));
    let t = wb.js(&["shelf"]);
    let top: Vec<&str> = t["folders"].as_array().unwrap().iter().map(|f| f["name"].as_str().unwrap()).collect();
    assert_eq!(top, vec!["Phinehas study"]);
    let inside: Vec<&str> = t["folders"][0]["folders"].as_array().unwrap().iter().map(|f| f["name"].as_str().unwrap()).collect();
    assert_eq!(inside, vec!["Covenant", "Word study"]);
    assert_eq!(t["folders"][0]["folders"][1]["folders"][0]["name"], "Ruth");
    let file = std::fs::read_to_string(wb.dir.join("sets").join("word-study.md")).unwrap();
    assert!(file.starts_with("---
name: \"Word study\"
created:") && file.contains("parent: \"phinehas-study\""), "{file}"); // library L-22: the folder's own file says where it sits
    let placing: Value = serde_json::from_str(&std::fs::read_to_string(wb.dir.join("settings").join("shelf.json")).unwrap()).unwrap();
    assert_eq!(placing["folders"]["ruth"]["parent"], "word-study");

    // an item moved into another folder, then copied; a reorder inside a folder
    let moved = wb.js(&["shelf", "item", "Ruth", "i7", "--to", "Covenant"]);
    assert_eq!(moved["set"], "covenant");
    assert!(!wb.ok(&["set", "show", "Ruth"]).contains("NUM.25:1-25:18"));
    wb.ok(&["shelf", "item", "Ruth", "i1", "--to", "Covenant", "--copy"]);
    assert!(wb.ok(&["set", "show", "Ruth"]).contains("H6653"));
    wb.ok(&["set", "move", "Ruth", "i5", "--before", "i1"]);
    assert_eq!(wb.js(&["set", "show", "Ruth"])["items"][0]["key"], "i5");

    // a folder removed: to .trash, the folders inside it move up into its place
    wb.ok(&["shelf", "rm", "Word study"]);
    let t = wb.js(&["shelf"]);
    let inside: Vec<&str> = t["folders"][0]["folders"].as_array().unwrap().iter().map(|f| f["name"].as_str().unwrap()).collect();
    assert_eq!(inside, vec!["Covenant", "Ruth"]);
    assert!(std::fs::read_dir(wb.dir.join(".trash")).unwrap().flatten().any(|e| e.file_name().to_string_lossy().contains("word-study")));

    // a set whose placing is written by hand into a loop is read as the top, not lost
    // (the older form: the sets carry no parent field of their own, L-22)
    for e in std::fs::read_dir(wb.dir.join("sets")).unwrap().flatten() {
        let text = std::fs::read_to_string(e.path()).unwrap();
        std::fs::write(e.path(), text.lines().filter(|l| !l.starts_with("parent:")).collect::<Vec<_>>().join("
") + "
").unwrap();
    }
    std::fs::write(wb.dir.join("settings").join("shelf.json"), r#"{"folders": {"covenant": {"parent": "ruth"}, "ruth": {"parent": "covenant"}}}"#).unwrap();
    let t = wb.js(&["shelf"]);
    assert_eq!(t["folders"].as_array().unwrap().len(), 3);
}

#[test]
fn the_windows_other_settings_are_kept_per_key() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["settings", "reading"]), json!({}));
    assert_eq!(wb.js(&["settings", "reading", "size", "120"])["size"], json!(120));
    let s = wb.js(&["settings", "theme", "active", "Evening"]);
    assert_eq!(s["active"], json!("Evening"));
    let s = wb.js(&["settings", "theme", "themes", r##"[{"name":"Evening","base":"dark","colors":{"bg":"#14110D"}}]"##]);
    assert_eq!(s["themes"][0]["colors"]["bg"], json!("#14110D"));
    let file = std::fs::read_to_string(wb.dir.join("settings").join("reading.json")).unwrap();
    assert_eq!(serde_json::from_str::<Value>(&file).unwrap(), json!({"size": 120}));
    assert_eq!(wb.js(&["settings", "reading", "size", "default"]), json!({}));
    assert!(wb.fails(&["settings", "reader"]).contains("theme"));
}

#[test]
fn kept_commands_have_fill_ins_keys_and_a_most_used_list() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["commands"]), json!([]));
    let r = wb.js(&["commands", "add", "Uses of a word", "uses {word}", "--key", "Ctrl+U", "--icon", "search"]);
    assert_eq!((r["id"].clone(), r["key"].clone()), (json!("uses-of-a-word"), json!("Ctrl+U")));
    wb.js(&["commands", "add", "Compare", "compare {place} ylt"]);
    assert!(wb.fails(&["commands", "add", "Other", "go {place}", "--key", "ctrl+u"]).contains("already"));
    assert!(wb.fails(&["commands", "add", "Bad", "go", "--key", "U"]).contains("Ctrl+"));
    assert_eq!(wb.js(&["commands"]).as_array().unwrap().len(), 2);
    assert_eq!(wb.js(&["commands", "fill", "Uses of a word", "--word", "zealous"])["line"], json!("uses zealous"));
    assert!(wb.fails(&["commands", "fill", "Compare"]).contains("{place}"));
    // the saved file is the kept list, in settings/commands.json
    let file = std::fs::read_to_string(wb.dir.join("settings").join("commands.json")).unwrap();
    assert_eq!(serde_json::from_str::<Value>(&file).unwrap()["items"].as_array().unwrap().len(), 2);
    // most used: from the day's log
    for _ in 0..3 { wb.js(&["log", "add", "def H7065"]); }
    wb.js(&["log", "add", "thread Phinehas"]);
    wb.js(&["log", "add", "uses zealous"]);
    let top = wb.js(&["commands", "--top"]);
    assert_eq!((top[0]["line"].clone(), top[0]["times"].clone()), (json!("def H7065"), json!(3)));
    wb.js(&["commands", "rm", "Compare"]);
    assert_eq!(wb.js(&["commands"]).as_array().unwrap().len(), 1);
    assert!(wb.fails(&["commands", "rm", "Compare"]).contains("No kept command"));
}

#[test]
fn a_layout_can_be_deleted_into_the_trash() {
    let Some(wb) = Wb::new() else { return };
    let (code, _, err) = wb.run(&["layout", "save", "Word study"], Some(r#"{"app":"bible-workbench-rs","panes":[]}"#));
    assert_eq!(code, 0, "{err}");
    assert_eq!(wb.js(&["layout", "list"]).as_array().unwrap().len(), 1);
    assert_eq!(wb.js(&["layout", "rm", "word"])["deleted"], json!(true));
    assert_eq!(wb.js(&["layout", "list"]), json!([]));
    assert!(wb.fails(&["layout", "rm", "word study"]).contains("No saved layout"));
}

#[test]
fn page_deletion_cli_preview_undo_and_aliases() {
    let Some(wb)=Wb::new() else {return};
    let page=wb.js(&["page","new","Scratch parent","--json"]);let id=page["id"].as_str().unwrap();
    let child=wb.js(&["page","new","Scratch child","--parent",id,"--json"]);let cid=child["id"].as_str().unwrap();
    wb.ok(&["page","pin",cid]);
    let preview=wb.js(&["page","rm","--all","--json"]);assert_eq!(preview["state"],"preview");assert_eq!(preview["count"],1);assert_eq!(preview["moved"],1);
    assert!(wb.fails(&["page","rm","--all","--yes","--expect","wrong"]).contains("preview changed"));
    let removed=wb.js(&["page","rm","--all","--yes","--expect",preview["token"].as_str().unwrap(),"--json"]);let op=removed["operation"].as_str().unwrap();assert_eq!(removed["state"],"pending");
    assert_eq!(wb.js(&["page","undo",op,"--json"])["state"],"restored");
    let alias=wb.js(&["inbox","rm",cid,"--json"]);assert_eq!(alias["state"],"pending");wb.ok(&["page","undo",alias["operation"].as_str().unwrap()]);
    let immediate=wb.js(&["page","rm",cid,"--now","--json"]);assert_eq!(immediate["state"],"erased");
}

/// words (W-5): `wb anchor <place|number> --pages` finds the pages whose text names the place or number, with their count;
/// the study folder keeps no list of them. A verse nearby or a longer number does not count.
#[test]
fn anchor_pages_finds_pages_that_name_a_verse_or_a_number() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["anchor", "Num 25:11", "--pages"])["count"], json!(0));
    let a = wb.js(&["page", "new", "Phinehas\nRead Numbers 25:10-13 again, and H7065.", "--json"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["page", "new", "Elsewhere\nNum 25:14 and H70651 and Ps 106:30.", "--json"])["id"].as_str().unwrap().to_string();
    let verse = wb.js(&["anchor", "Num 25:11", "--pages"]);
    assert_eq!(verse["count"], json!(1));
    assert_eq!(verse["pages"][0]["id"], json!(a));
    let number = wb.js(&["anchor", "H7065", "--pages"]);
    assert_eq!(number["count"], json!(1));
    assert_eq!(number["pages"][0]["id"], json!(a));
    assert_eq!(wb.js(&["anchor", "Num 25:14", "--pages"])["pages"][0]["id"], json!(b));
    assert_eq!(wb.js(&["anchor", "Ps 106:30-31", "--pages"])["count"], json!(1));
    // the count line never carries a page's text
    assert!(verse["pages"][0].get("text").is_none());
}

/// words (W-5): a scripture block or a word block holds only a reference or a number, and the page counts as naming it.
/// The reference is read from the database's own answer for the verse (nothing is typed from scripture).
#[test]
fn anchor_pages_counts_scripture_and_word_blocks() {
    let Some(wb) = Wb::new() else { return };
    let v = wb.js(&["scripture", "Num 25:11"]);
    let first = &v["verses"][0];
    let chapter = format!("{} {}", first["code"].as_str().unwrap(), first["c"]);   // like NUM 25: a chapter alone, no verse
    let page = wb.js(&["page", "new", &format!("Blocks only\n\n```scripture\n{chapter}\n```\n\n```word\nH7065\n```"), "--json"]);
    let id = page["id"].as_str().unwrap();
    let verse = wb.js(&["anchor", "Num 25:11", "--pages"]);
    assert_eq!(verse["count"], json!(1), "{verse}");
    assert_eq!(verse["pages"][0]["id"], json!(id));
    assert_eq!(wb.js(&["anchor", "Num 26:1", "--pages"])["count"], json!(0));
    let word = wb.js(&["anchor", "H7065", "--pages"]);
    assert_eq!(word["count"], json!(1), "{word}");
    assert_eq!(wb.js(&["anchor", "H7066", "--pages"])["count"], json!(0));
}

/// settings: the Reading setting "a click on a word opens" (card or Concordance) is kept in the study folder and reset by default.
#[test]
fn reading_word_setting_is_kept() {
    let Some(wb) = Wb::new() else { return };
    assert!(wb.js(&["settings", "reading"]).get("word").is_none());
    assert_eq!(wb.js(&["settings", "reading", "word", "concordance"])["word"], json!("concordance"));
    assert_eq!(wb.js(&["settings", "reading"])["word"], json!("concordance"));
    let file = std::fs::read_to_string(wb.dir.join("settings").join("reading.json")).unwrap();
    assert_eq!(serde_json::from_str::<Value>(&file).unwrap()["word"], json!("concordance"));
    assert!(wb.js(&["settings", "reading", "word", "default"]).get("word").is_none());
}

// ---- trash round 3 (T10, TR-1): several pages at once ----

#[test]
fn several_pages_go_to_the_trash_in_one_operation_with_one_undo() {
    let Some(wb) = Wb::new() else { return };
    let ids: Vec<String> = (0..4).map(|i| wb.js(&["page", "new", &format!("Page {i}")])["id"].as_str().unwrap().to_string()).collect();
    let mut argv = vec!["page", "rm"];
    argv.extend(ids.iter().map(|s| s.as_str()));
    let r = wb.js(&argv);
    assert_eq!((r["count"].clone(), r["state"].clone()), (json!(4), json!("pending")));
    let op = r["operation"].as_str().unwrap().to_string();
    // the batch window is 30 seconds, not the single page's 10
    let ms = r["deadline_ms"].as_i64().unwrap() - wb_core::deletion::now_ms();
    assert!(ms > 10_000 && ms <= 30_000, "{ms}");
    assert_eq!(wb.js(&["page", "deletions"])["operations"].as_array().unwrap().len(), 1);
    assert_eq!(wb.js(&["page", "undo", &op])["state"], json!("restored"));
    let tree = wb.js(&["page", "tree"]).to_string();
    for id in &ids {
        assert!(tree.contains(id.as_str()), "{id} not back");
    }
    // a page that is not there stops the whole delete: nothing is moved
    let (code, ..) = wb.run(&["page", "rm", &ids[0], "no-such-page"], None);
    assert_eq!(code, 1);
    assert!(wb.js(&["page", "tree"]).to_string().contains(ids[0].as_str()));
    // an id with --all is refused
    assert!(wb.fails(&["page", "rm", &ids[0], "--all"]).contains("Give a page ID or --all"));
}

#[test]
fn several_trashed_notes_are_put_back_by_one_command_and_empty_trash_leaves_the_rest() {
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["note", "jot", "first"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["note", "jot", "second"])["id"].as_str().unwrap().to_string();
    let mut legacy = wb_core::store::Store::open(&wb.dir).unwrap();
    legacy.delete_jot(&a).unwrap();
    legacy.delete_jot(&b).unwrap();
    // TR-1: a finding's and a layout's files wait in .trash too; Empty trash does not touch them
    let trash = wb.dir.join(".trash");
    std::fs::write(trash.join("20200101-000000-finding-abcd.md"), "a finding").unwrap();
    std::fs::write(trash.join("20200101-000000-layout-main.json"), "{}").unwrap();
    let t = wb.js(&["trash"]);
    let names: Vec<String> = t["notes"].as_array().unwrap().iter().map(|n| n["name"].as_str().unwrap().to_string()).collect();
    assert_eq!(names.len(), 2);
    let r = wb.js(&["trash", "restore", &names[0], &names[1]]);
    assert_eq!(r["restored"].as_array().unwrap().len(), 2);
    assert_eq!(wb.js(&["trash"])["notes"], json!([]));
    legacy = wb_core::store::Store::open(&wb.dir).unwrap();
    legacy.delete_jot(&a).unwrap();
    legacy.delete_jot(&b).unwrap();
    let erased = wb.js(&["trash", "empty", "--days", "0"]);
    assert_eq!(erased["erased"].as_array().unwrap().len(), 2);
    assert!(trash.join("20200101-000000-finding-abcd.md").exists());
    assert!(trash.join("20200101-000000-layout-main.json").exists());
}

#[test]
fn make_another_like_this_keeps_look_and_choice_per_kind_and_leaves_the_first_alone() {
    // DC-2, D6: no document template; the choices travel by kind of part. --folder is --thread's new name (DC-3).
    let Some(wb) = Wb::new() else { return };
    let add = |id: &str, b: &str| {
        let (code, _, err) = wb.run(&["block", "add", id, "-"], Some(b));
        assert_eq!(code, 0, "{err}");
    };
    let first = wb.js(&["page", "new", "Like: first"])["id"].as_str().unwrap().to_string();
    let second = wb.js(&["page", "new", "Like: second"])["id"].as_str().unwrap().to_string();
    for p in [&first, &second] {
        for b in ["# Aim", "Read it with the group.", "```scripture\nNum 25:10-11\n```"] {
            add(p, b);
        }
    }
    let parts = wb.js(&["craft", "parts", "--page", &first]);
    let para = parts["rows"][1]["key"].as_str().unwrap().to_string();
    let made = wb.js(&["craft", "deck", "--page", &first, "--off", &para, "--look", "large-print"]);
    let before = std::fs::read(wb.docs().join(made["name"].as_str().unwrap())).unwrap();
    let like = wb.js(&["docs", "like", made["id"].as_str().unwrap(), "--page", &second]);
    assert_eq!(like["id"].as_str().unwrap(), format!("page-{second}-verse"));
    assert_eq!(like["look"], made["look"]);
    assert_eq!(like["checked"]["verses"], 2);
    let rows = wb.js(&["craft", "parts", "--page", &second])["rows"].clone();
    let on: Vec<(&str, bool)> = rows.as_array().unwrap().iter().map(|r| (r["kind"].as_str().unwrap(), r["on"].as_bool().unwrap())).collect();
    assert_eq!(on, [("heading", true), ("paragraph", false), ("scripture", true)]);
    assert_eq!(std::fs::read(wb.docs().join(made["name"].as_str().unwrap())).unwrap(), before);
    assert!(wb.fails(&["docs", "like", made["id"].as_str().unwrap()]).contains("--page"));

    // a folder is what a thread was
    wb.js(&["thread", "new", "Phinehas folder", "--at", "Num 25:10"]);
    let by_thread = wb.js(&["docs", "plan", "--thread", "Phinehas folder", "--to", "word", "--structure", "script"]);
    let by_folder = wb.js(&["docs", "plan", "--folder", "Phinehas folder", "--to", "word", "--structure", "script"]);
    assert_eq!(by_thread["fingerprint"], by_folder["fingerprint"]);
}

// ---- reading plans: parts of chapters, Horner's lists, the counter (reading-plans RP-5 to RP-11) ----

fn verses_in(wb: &Wb, place: &str) -> u32 {
    wb.js(&["text", place, "--json"])["verses"].as_array().unwrap().len() as u32
}

fn log_lines(wb: &Wb) -> Vec<Value> {
    std::fs::read_to_string(wb.dir.join("reading").join("log.jsonl")).unwrap_or_default().lines().map(|l| serde_json::from_str(l).unwrap()).collect()
}

#[test]
fn a_part_of_a_chapter_is_a_log_line_with_verses_and_a_whole_chapter_stays_whole() {
    // RP-5
    let Some(wb) = Wb::new() else { return };
    let m = wb.js(&["read", "mark", "Num 25:1-5"]);
    assert_eq!((m[0]["ch"].clone(), m[0]["v"].clone()), (json!("NUM.25"), json!("1-5")));
    wb.js(&["read", "mark", "Num 24"]);
    wb.js(&["read", "mark", "Num 25:7"]);
    let lines = log_lines(&wb);
    assert_eq!(lines.len(), 3);
    assert_eq!(lines[1].get("v"), None, "a place without verses writes a whole chapter, no v");
    assert_eq!(lines[2]["v"], json!("7"));
    // a place across chapters: each chapter's own verses
    let last = verses_in(&wb, "Num 24");
    let m = wb.js(&["read", "mark", &format!("Num 24:{last}-25:2")]);
    assert_eq!((m[0]["ch"].clone(), m[0]["v"].clone(), m[1]["ch"].clone(), m[1]["v"].clone()), (json!("NUM.24"), json!(last.to_string()), json!("NUM.25"), json!("1-2")));
    // old lines are never rewritten
    assert_eq!(log_lines(&wb)[..3], lines[..]);
}

#[test]
fn what_is_read_of_a_chapter_is_the_union_of_its_parts() {
    // RP-6 and RP-7: in order, out of order, repeated, a whole chapter after parts
    let Some(wb) = Wb::new() else { return };
    let l = verses_in(&wb, "Num 25");
    assert!(l > 12);
    let times = |wb: &Wb| wb.js(&["read", "times", "Num 25"])["NUM.25"].clone();
    wb.js(&["read", "mark", "Num 25:1-5"]);
    let t = times(&wb);
    assert_eq!((t["times"].clone(), t["verses"].clone(), t["read_to"].clone(), t["whole"].clone()), (json!(0), json!("1-5"), json!(5), json!(false)));
    wb.js(&["read", "mark", "Num 25:1-5"]); // repeated: the same verses, still not a chapter read
    assert_eq!(times(&wb)["times"], json!(0));
    wb.js(&["read", "mark", &format!("Num 25:{}-{l}", l - 4)]); // out of order: the end before the middle
    let t = times(&wb);
    assert_eq!((t["verses"].clone(), t["read_to"].clone(), t["times"].clone()), (json!(format!("1-5, {}-{l}", l - 4)), json!(5), json!(0)));
    wb.js(&["read", "mark", &format!("Num 25:6-{}", l - 5)]); // the gap closes: one time read
    let t = times(&wb);
    assert_eq!((t["times"].clone(), t["verses"].clone(), t["whole"].clone(), t["read_to"].clone()), (json!(1), json!(format!("1-{l}")), json!(true), json!(l)));
    wb.js(&["read", "mark", "Num 25"]); // a whole-chapter line after parts: a second time
    assert_eq!(times(&wb)["times"], json!(2));
    // the whole Bible's count: a chapter read through counts once, however it was read
    let p = wb.js(&["read", "progress"]);
    assert_eq!(p["chapters"], json!(1));
    assert_eq!(p["partial"], json!([]));
    // a part alone is listed as partial, and never counts as a chapter
    wb.js(&["read", "mark", "Num 26:1-3"]);
    let p = wb.js(&["read", "progress"]);
    assert_eq!(p["chapters"], json!(1));
    assert_eq!((p["partial"][0]["ch"].clone(), p["partial"][0]["read_to"].clone()), (json!("NUM.26"), json!(3)));
    assert!(wb.js(&["read", "when", "Num 26"])["NUM.26"].as_str().is_some());
}

#[test]
fn a_plan_day_with_a_chapter_read_in_part_is_not_done_and_says_where_it_stopped() {
    let Some(wb) = Wb::new() else { return };
    let l = verses_in(&wb, "Num 25");
    let (code, _, err) = wb.run(&["plan", "import", "Mine", "--start", "2026-01-01", "--format", "plain"], Some("Num 25; Num 26\nNum 27\n"));
    assert_eq!(code, 0, "{err}");
    wb.js(&["read", "mark", "Num 25:1-9", "--plan", "mine"]);
    wb.js(&["read", "mark", "Num 26", "--plan", "mine"]);
    let day = &wb.js(&["plan", "show", "mine", "--on", "2026-01-01"])["schedule"][0];
    assert_eq!(day["done"], json!(false), "a chapter read in part is not read");
    assert_eq!(day["read"], json!([false, true]));
    assert_eq!((day["parts"][0]["read_to"].clone(), day["parts"][0]["parts"].clone()), (json!(9), json!("")));
    // out of order: the end is read, the start is not
    wb.js(&["read", "mark", &format!("Num 25:{}-{l}", l - 3), "--plan", "mine"]);
    let day = &wb.js(&["plan", "show", "mine", "--on", "2026-01-01"])["schedule"][0];
    assert_eq!((day["parts"][0]["read_to"].clone(), day["parts"][0]["parts"].clone()), (json!(9), json!(format!("{}-{l}", l - 3))));
    assert_eq!(day["done"], json!(false));
    wb.js(&["read", "mark", &format!("Num 25:10-{}", l - 4), "--plan", "mine"]);
    assert_eq!(wb.js(&["plan", "show", "mine", "--on", "2026-01-01"])["schedule"][0]["done"], json!(true));
}

#[test]
fn mark_read_to_here_marks_the_gap_and_a_verse_already_read_changes_nothing() {
    // RP-8
    let Some(wb) = Wb::new() else { return };
    let m = wb.js(&["read", "mark", "Num 25:9", "--to-here"]);
    assert_eq!((m[0]["v"].clone(), m.as_array().unwrap().len()), (json!("1-9"), 1));
    assert_eq!(wb.js(&["read", "mark", "Num 25:9", "--to-here"]), json!([]));
    assert_eq!(wb.js(&["read", "mark", "Num 25:4", "--to-here"]), json!([]));
    let m = wb.js(&["read", "mark", "Num 25:12", "--to-here"]);
    assert_eq!(m[0]["v"], json!("10-12"));
    assert_eq!(wb.js(&["read", "times", "Num 25"])["NUM.25"]["read_to"], json!(12));
    assert_eq!(log_lines(&wb).len(), 2);
    // taking a part off: exactly that line, kept in the trash
    let off = wb.js(&["read", "unmark", "Num 25:10-12"]);
    assert_eq!(off["unmarked"].as_array().unwrap().len(), 1);
    assert_eq!(wb.js(&["read", "times", "Num 25"])["NUM.25"]["read_to"], json!(9));
    assert!(std::fs::read_to_string(wb.dir.join(".trash").join("reading-unmarked.jsonl")).unwrap().contains("\"v\": \"10-12\""));
    assert_eq!(wb.js(&["read", "unmark", "Num 25:10-12"])["unmarked"], json!([]), "a part not in the log is passed over");
}

#[test]
fn horners_ten_lists_ship_as_a_kind_a_chapter_of_each_list_a_day() {
    // RP-9, RP-10
    let Some(wb) = Wb::new() else { return };
    let kinds = wb.js(&["plan", "kinds"]);
    assert!(kinds.as_array().unwrap().iter().any(|k| k["kind"] == "horner"));
    assert!(!kinds.as_array().unwrap().iter().any(|k| k["kind"].as_str().unwrap().contains("chronolog")), "no chronological kind (RP-4, RP-10)");
    let dry = wb.js(&["plan", "start", "Horner", "--kind", "horner", "--start", "2026-11-02", "--dry-run"]);
    assert_eq!((dry["cycle"].clone(), dry["lists"].clone(), dry["finish"].clone()), (json!(true), json!(10), json!(null)));
    let p = wb.js(&["plan", "start", "Horner", "--kind", "horner", "--start", "2026-11-02"]);
    assert_eq!((p["kind"].clone(), p["cycle"].clone(), p["finish"].clone()), (json!("horner"), json!(true), json!(null)));
    let show = wb.js(&["plan", "show", "horner", "--on", "2026-11-03"]);
    let day2: Vec<&str> = show["schedule"][1]["entries"].as_array().unwrap().iter().map(|e| e.as_str().unwrap()).collect();
    assert_eq!(day2, vec!["MAT.2", "GEN.2", "ROM.2", "1TH.2", "JOB.2", "PSA.2", "PRO.2", "JOS.2", "ISA.2", "ACT.2"]);
    // the lists are the plan's own, and between them they hold every chapter once
    let file = plan_file(&wb, "horner");
    let all: Vec<String> = file["lists"].as_array().unwrap().iter().flat_map(|l| l.as_array().unwrap().iter().map(|e| e.as_str().unwrap().to_string())).collect();
    let chapters: u32 = wb.js(&["books"])["books"].as_array().unwrap().iter().map(|b| b["chapters"].as_u64().unwrap() as u32).sum();
    assert_eq!(all.len() as u32, chapters);
    let mut sorted = all.clone();
    sorted.sort();
    sorted.dedup();
    assert_eq!(sorted.len(), all.len());
    // the builder's view of the lists, side by side
    let lay = wb.js(&["plan", "layout", "--kind", "horner"]);
    assert_eq!(lay["lists"].as_array().unwrap().len(), 10);
}

#[test]
fn the_counter_is_the_days_come_and_not_read_and_a_day_off_is_not_a_day() {
    // RP-11 (and RP-1)
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Year", "--start", "2026-11-02", "--days-off", "wed"]);
    let behind = |on: &str| wb.js(&["plan", "today", "--on", on])["plans"][0].clone();
    assert_eq!(behind("2026-11-01")["behind"], json!(0));
    assert_eq!(behind("2026-11-03")["behind"], json!(2)); // Monday and Tuesday
    assert_eq!(behind("2026-11-04")["behind"], json!(2), "Wednesday is a day off, not a day of the plan");
    wb.js(&["plan", "done", "year", "--day", "1"]);
    assert_eq!(behind("2026-11-03")["behind"], json!(1));
    wb.js(&["plan", "done", "year", "--day", "4"]); // Thursday, read ahead: it is not behind, and it does not settle Tuesday
    let t = behind("2026-11-03");
    assert_eq!((t["behind"].clone(), t["ahead"].clone()), (json!(1), json!(0)));
    wb.js(&["plan", "done", "year", "--day", "2"]);
    let t = behind("2026-11-03");
    assert_eq!((t["behind"].clone(), t["ahead"].clone()), (json!(0), json!(1)), "two days come, three are read: one ahead");
}

#[test]
fn the_map_has_what_was_read_and_what_was_written_about() {
    let Some(wb) = Wb::new() else { return };
    wb.js(&["read", "mark", "Num 25:1-3"]);
    wb.js(&["read", "mark", "Num 26"]);
    wb.js(&["note", "add", "Num 26:5", "A note of mine"]);
    wb.js(&["hl", "set", "Num 26:1", "yellow"]);
    let map = wb.js(&["read", "map"]);
    let num = map["books"].as_array().unwrap().iter().find(|b| b["code"] == "NUM").unwrap();
    let read = num["read"].as_array().unwrap();
    assert_eq!(read[0][0], json!(25));
    assert!(read[0][2].as_f64().unwrap() > 0.0 && read[0][2].as_f64().unwrap() < 1.0, "a chapter read in part is part filled");
    assert_eq!((read[1][0].clone(), read[1][1].clone(), read[1][2].clone()), (json!(26), json!(1), json!(1.0)));
    let about = wb.js(&["read", "about", "Num 26"]);
    let kinds: Vec<&str> = about.as_array().unwrap().iter().map(|x| x["kind"].as_str().unwrap()).collect();
    assert!(kinds.contains(&"page") && kinds.contains(&"highlight"), "{kinds:?}");
    assert_eq!(num["written"][0][0], json!(26));
}

#[test]
fn what_refers_to_a_chapter_counts_pages_places_in_pages_questions_folders_days_and_highlights() {
    // RP-19: Written about counts every reference to a chapter
    let Some(wb) = Wb::new() else { return };
    let kinds = |wb: &Wb| -> Vec<String> { wb.js(&["read", "about", "Num 26"]).as_array().unwrap().iter().map(|x| x["kind"].as_str().unwrap().to_string()).collect() };
    assert!(kinds(&wb).is_empty());
    wb.js(&["note", "jot", "check where else this is used; see Num 26:3"]); // a place written in a page
    wb.js(&["note", "jot", "how do the two numbers relate; Num 26:5", "--question"]);
    wb.js(&["note", "add", "Num 26:9", "A note at a verse"]);
    wb.js(&["hl", "set", "Num 26:1", "yellow"]);
    wb.js(&["thread", "new", "Census", "--at", "Num 26:2"]);
    wb.js(&["day", "add", "Read Numbers 26:4 today"]);
    let k = kinds(&wb);
    for want in ["place in a page", "question", "page", "highlight", "folder"] {
        assert!(k.iter().any(|x| x == want), "{want} missing: {k:?}");
    }
    let places = wb.js(&["read", "about", "Num 26"]).as_array().unwrap().iter().filter(|x| x["kind"] == "place in a page").count();
    assert_eq!(places, 2, "a place in the inbox page and one in today's page");
    assert_eq!(wb.js(&["read", "about", "Num 25"]), json!([]), "another chapter has none");
}

#[test]
fn the_builders_old_abilities_and_pasting_a_published_plan_still_work() {
    // RP-18: move days, set the start, days off, a pasted published plan, and Horner with days off
    let Some(wb) = Wb::new() else { return };
    wb.js(&["plan", "start", "Gospels", "--books", "gospels", "--days", "10", "--start", "2026-11-02", "--days-off", "sun,sat"]);
    let shown = wb.js(&["plan", "show", "gospels"]);
    assert_eq!(shown["days_off"], json!(["sat", "sun"]));
    let first: Vec<String> = day_entries(&shown)[0].clone();
    wb.js(&["plan", "move-day", "gospels", "--day", "1", "--to", "3"]);
    assert_eq!(day_entries(&wb.js(&["plan", "show", "gospels"]))[2], first);
    assert_eq!(wb.js(&["plan", "edit", "gospels", "--start", "2026-12-01"])["start"], json!("2026-12-01"));
    let (code, _, err) = wb.run(&["plan", "import", "Guth", "--format", "guthrie", "--start", "2026-11-02"], Some("Week 1\nDay 1: Genesis 1; Matthew 1\nDay 2: Genesis 2; Matthew 2\n"));
    assert_eq!(code, 0, "{err}");
    assert_eq!(wb.js(&["plan", "show", "guth"])["source"], json!("Guthrie"));
    let h = wb.js(&["plan", "start", "Horner", "--kind", "horner", "--start", "2026-11-02", "--days-off", "sun"]);
    assert_eq!(h["days_off"], json!(["sun"]));
    assert_eq!(h["cycle"], json!(true));
    // 2026-11-08 is a Sunday: day 7 falls on the Monday after
    let s = wb.js(&["plan", "show", "horner", "--on", "2026-11-09"]);
    assert_eq!(s["schedule"][6]["date"], json!("2026-11-09"));
}

#[test]
fn block_add_scripture_writes_the_fenced_reference_block() {
    // notebook row 7 (NB3): --scripture checks the reference and writes the block holding only it; a bare reference stays a paragraph
    let Some(wb) = Wb::new() else { return };
    let id = wb.js(&["page", "new", "A passage page"])["id"].as_str().unwrap().to_string();
    wb.js(&["block", "add", &id, "First line"]);
    let r = wb.js(&["block", "add", &id, "Num 25:18-26:1", "--scripture", "--after", "1"]);
    assert_eq!(r["n"], 2);
    wb.js(&["block", "add", &id, "Num 25:11"]);
    let blocks = wb.js(&["page", "blocks", &id]);
    let texts: Vec<(String, String)> = blocks["blocks"].as_array().unwrap().iter().map(|b| (b["kind"].as_str().unwrap().to_string(), b["text"].as_str().unwrap().to_string())).collect();
    assert_eq!(texts[1], ("fence".to_string(), "```scripture\nNum 25:18-26:1\n```".to_string()));
    assert_eq!(texts[2], ("paragraph".to_string(), "Num 25:11".to_string()));
    let (code, _, err) = wb.run(&["block", "add", &id, "Not a book 3:4", "--scripture"], None);
    assert_ne!(code, 0, "{err}");
    assert_eq!(wb.js(&["page", "blocks", &id])["blocks"].as_array().unwrap().len(), 3);
}

#[test]
fn a_toggle_folds_in_the_settings_and_the_page_keeps_its_details() {
    // notebook row 9 (NB4): the toggle is <details><summary> in the page; folded or not is in settings/pages.json
    let Some(wb) = Wb::new() else { return };
    let id = wb.js(&["page", "new", "A toggle page"])["id"].as_str().unwrap().to_string();
    wb.js(&["block", "add", &id, "<details><summary>Numbers 25</summary>"]);
    wb.js(&["block", "add", &id, "Read it twice."]);
    wb.js(&["block", "add", &id, "</details>"]);
    let before = wb.js(&["page", "blocks", &id]);
    assert_eq!(before["folds"].as_array().unwrap().len(), 0);
    let r = wb.js(&["page", "fold", &id, "1", "--on"]);
    assert_eq!(r["folded"], true);
    let after = wb.js(&["page", "blocks", &id]);
    assert_eq!(after["folds"][0], "<details><summary>Numbers 25</summary>");
    // the page itself is unchanged by folding
    assert_eq!(before["blocks"], after["blocks"]);
    assert!(wb.dir.join("settings/pages.json").exists());
    wb.js(&["page", "fold", &id, "1", "--off"]);
    assert_eq!(wb.js(&["page", "blocks", &id])["folds"].as_array().unwrap().len(), 0);
    let (code, _, _) = wb.run(&["page", "fold", &id, "2", "--on"], None);
    assert_ne!(code, 0, "a paragraph is not a toggle");
}

#[test]
fn a_block_is_copied_below_itself_and_a_join_or_a_copy_can_be_undone() {
    // notebook rows 42 and 20 (NB6): `wb block dup` copies a block right below it; `--undo` on block set and block dup gives
    // a token that `wb block undo` takes back, only while the page is as the change left it
    let Some(wb) = Wb::new() else { return };
    let id = wb.js(&["page", "new", "A copy page"])["id"].as_str().unwrap().to_string();
    wb.js(&["block", "add", &id, "First line"]);
    wb.js(&["block", "add", &id, "- an item"]);
    wb.js(&["block", "add", &id, "Last line"]);
    let texts = |wb: &Wb| -> Vec<String> { wb.js(&["page", "blocks", &id])["blocks"].as_array().unwrap().iter().map(|b| b["text"].as_str().unwrap().to_string()).collect() };
    let r = wb.js(&["block", "dup", &id, "2"]);
    assert_eq!(r["n"], 3, "the copy is block 3");
    assert_eq!(texts(&wb), ["First line", "- an item", "- an item", "Last line"]);
    // a duplicate that is taken back
    let r = wb.js(&["block", "dup", &id, "1", "--undo"]);
    assert_eq!(texts(&wb).len(), 5);
    let token = r["undo"].to_string();
    wb.js(&["block", "undo", &id, &token]);
    assert_eq!(texts(&wb), ["First line", "- an item", "- an item", "Last line"]);
    // a join of two blocks, written as one: taken back, the two blocks are as they were
    let r = wb.js(&["block", "set", &id, "3", "--count", "2", "--undo", "- an itemLast line"]);
    assert_eq!(texts(&wb), ["First line", "- an item", "- an itemLast line"]);
    let token = r["undo"].to_string();
    // the page changed after the join: the token is refused and nothing is written
    wb.js(&["block", "add", &id, "Another"]);
    let (code, _, _) = wb.run(&["block", "undo", &id, &token], None);
    assert_ne!(code, 0);
    assert_eq!(texts(&wb).len(), 4);
    wb.js(&["block", "rm", &id, "4"]);
    wb.js(&["block", "undo", &id, &token]);
    assert_eq!(texts(&wb), ["First line", "- an item", "- an item", "Last line"]);
    // a block that is not there cannot be copied
    let (code, _, _) = wb.run(&["block", "dup", &id, "9"], None);
    assert_ne!(code, 0);
}

#[test]
fn a_block_gets_a_background_and_goes_beside_another_as_a_column() {
    // notebook rows 25b, 44, 15 and 21 (NB6, NB7): `wb block color` wraps a text block's whole text in a data-bg span (several
    // blocks with --count; scripture is left alone); `wb block move --beside` puts blocks in columns held by comment markers
    let Some(wb) = Wb::new() else { return };
    let id = wb.js(&["page", "new", "A column page"])["id"].as_str().unwrap().to_string();
    for t in ["First line", "## A heading", "```scripture\nNum 25:11\n```", "Last line"] {
        wb.js(&["block", "add", &id, t]);
    }
    let texts = |wb: &Wb| -> Vec<String> { wb.js(&["page", "blocks", &id])["blocks"].as_array().unwrap().iter().map(|b| b["text"].as_str().unwrap().to_string()).collect() };
    wb.js(&["block", "color", &id, "1", "yellow", "--count", "4"]);
    assert_eq!(texts(&wb), ["<span data-bg=\"yellow\">First line</span>", "## <span data-bg=\"yellow\">A heading</span>", "```scripture\nNum 25:11\n```", "<span data-bg=\"yellow\">Last line</span>"]);
    let r = wb.js(&["block", "color", &id, "4", "default", "--undo"]);
    assert_eq!(texts(&wb)[3], "Last line");
    wb.js(&["block", "undo", &id, &r["undo"].to_string()]);
    assert_eq!(texts(&wb)[3], "<span data-bg=\"yellow\">Last line</span>");
    let (code, _, _) = wb.run(&["block", "color", &id, "3", "red"], None);
    assert_ne!(code, 0, "a scripture block has no background");
    let (code, _, _) = wb.run(&["block", "color", &id, "1", "mauve"], None);
    assert_ne!(code, 0);
    wb.js(&["block", "color", &id, "1", "default", "--count", "4"]);
    // columns
    wb.js(&["block", "move", &id, "3", "--beside", "1"]);
    assert_eq!(texts(&wb), ["<!-- columns -->", "First line", "<!-- column -->", "```scripture\nNum 25:11\n```", "<!-- /columns -->", "## A heading", "Last line"]);
    wb.js(&["block", "move", &id, "7", "--beside", "2", "--left"]);
    let t = texts(&wb);
    assert_eq!(t.iter().filter(|x| x.as_str() == "<!-- column -->").count(), 2);
    assert_eq!(t[1], "Last line");
    // blocks taken out of their columns: a column left empty loses its marker, a group left with one column is unwrapped
    let (code, _, _) = wb.run(&["block", "move", &id, "2", "--beside", "2"], None);
    assert_ne!(code, 0, "a block is not beside itself");
    let at = |wb: &Wb, w: &str| (texts(wb).iter().position(|x| x == w).unwrap() + 1).to_string();
    wb.js(&["block", "move", &id, &at(&wb, "First line"), "--last"]);
    assert_eq!(texts(&wb).iter().filter(|x| x.as_str() == "<!-- column -->").count(), 1);
    wb.js(&["block", "move", &id, &at(&wb, "Last line"), "--last"]);
    assert!(texts(&wb).iter().all(|x| !x.starts_with("<!--")), "no markers left over: {:?}", texts(&wb));
    assert_eq!(texts(&wb).len(), 4);
    // a block of the group removed on its own (wb block rm) tidies the same way
    wb.js(&["block", "move", &id, &at(&wb, "First line"), "--beside", &at(&wb, "Last line")]);
    assert!(texts(&wb).contains(&"<!-- columns -->".to_string()));
    wb.js(&["block", "rm", &id, &at(&wb, "First line")]);
    assert!(texts(&wb).iter().all(|x| !x.starts_with("<!--")));
}

#[test]
fn a_block_moves_to_the_end_of_another_page() {
    // notebook row 19 (NB9): `wb block move ID N --page OTHER [--count K]` writes the blocks last in the other page, then takes them out
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["page", "new", "Page A"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["page", "new", "Page B"])["id"].as_str().unwrap().to_string();
    for t in ["One", "Two", "Three", "Four"] {
        wb.js(&["block", "add", &a, t]);
    }
    wb.js(&["block", "add", &b, "Already here"]);
    let texts = |id: &str| -> Vec<String> { wb.js(&["page", "blocks", id])["blocks"].as_array().unwrap().iter().map(|x| x["text"].as_str().unwrap().to_string()).collect() };
    wb.js(&["block", "move", &a, "2", "--page", &b]);
    assert_eq!(texts(&a), ["One", "Three", "Four"]);
    assert_eq!(texts(&b), ["Already here", "Two"]);
    wb.js(&["block", "move", &a, "2", "--page", &b, "--count", "2"]);
    assert_eq!(texts(&a), ["One"]);
    assert_eq!(texts(&b), ["Already here", "Two", "Three", "Four"]);
    let (code, _, _) = wb.run(&["block", "move", &a, "1", "--page", &a], None);
    assert_ne!(code, 0, "not to the same page");
    let (code, _, _) = wb.run(&["block", "move", &a, "5", "--page", &b], None);
    assert_ne!(code, 0, "no such block");
    assert_eq!(texts(&a), ["One"]);
}

#[test]
fn a_block_link_writes_a_short_id_the_window_never_shows_and_the_link_finds_the_block() {
    // notebook row 18 (NB9): `wb block link ID N` writes ` ^abc123` at the end of the block (reused when it has one) and gives
    // `[[Title#^abc123]]`; the block's text in `wb page blocks` has no id, a change of its words keeps it, a copy has none
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["page", "new", "Haste study"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["page", "new", "Tuesday study"])["id"].as_str().unwrap().to_string();
    for t in ["Read the chapter twice before the verses", "Second thought"] {
        wb.js(&["block", "add", &a, t]);
    }
    let r = wb.js(&["block", "link", &a, "1"]);
    let link = r["link"].as_str().unwrap().to_string();
    let bid = r["block"].as_str().unwrap().to_string();
    assert_eq!(bid.len(), 6);
    assert!(bid.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
    assert_eq!(link, format!("[[Haste study#^{bid}]]"));
    assert!(wb.js(&["note", "show", &a])["text"].as_str().unwrap().contains(&format!("Read the chapter twice before the verses ^{bid}")));
    let blocks = wb.js(&["page", "blocks", &a]);
    assert_eq!(blocks["blocks"][0]["text"], "Read the chapter twice before the verses");
    assert_eq!(blocks["blocks"][0]["bid"], bid.as_str());
    // asked again, the same id; a change of the words keeps it; a copy does not carry it
    assert_eq!(wb.js(&["block", "link", &a, "1"])["block"], bid.as_str());
    let (_, _, _) = wb.run(&["block", "set", &a, "1", "-"], Some("Read the chapter again"));
    assert_eq!(wb.js(&["block", "link", &a, "1"])["block"], bid.as_str());
    wb.js(&["block", "dup", &a, "1"]);
    assert_eq!(wb.js(&["page", "blocks", &a])["blocks"][1].get("bid"), None);
    // a fenced block carries it on its opening line, after its kind; the window's text has none and a rewrite of the card keeps it
    wb.js(&["block", "add", &a, "```scripture\nNum 25:11\n```"]);
    let f = wb.js(&["block", "link", &a, "4"]);
    let fid = f["block"].as_str().unwrap().to_string();
    assert!(wb.js(&["note", "show", &a])["text"].as_str().unwrap().contains(&format!("```scripture ^{fid}\nNum 25:11\n```")));
    let fb = wb.js(&["page", "blocks", &a])["blocks"][3].clone();
    assert_eq!(fb["text"], "```scripture\nNum 25:11\n```");
    assert_eq!(fb["bid"], fid.as_str());
    assert_eq!(fb["lang"], "scripture");
    let (_, _, _) = wb.run(&["block", "set", &a, "4", "-"], Some("```scripture\nNum 25:12\n```"));
    assert!(wb.js(&["note", "show", &a])["text"].as_str().unwrap().contains(&format!("```scripture ^{fid}\nNum 25:12\n```")));
    assert_eq!(wb.js(&["block", "link", &a, "4"])["block"], fid.as_str());
    wb.js(&["block", "rm", &a, "4"]);
    // page B holds the link; the page's links name the block and its first words
    wb.js(&["block", "add", &b, &format!("See {link} now")]);
    let shown = wb.js(&["note", "show", &b]);
    let l = &shown["links"][0];
    assert_eq!(l["block"], bid.as_str());
    assert_eq!(l["block_words"], "Read the chapter again");
    assert_eq!(l["heading_ok"], true);
    assert_eq!(l["to"], a.as_str());
    // a link whose id is gone: no block words
    wb.js(&["block", "add", &b, "[[Haste study#^zzzzzz]]"]);
    let shown = wb.js(&["note", "show", &b]);
    assert_eq!(shown["links"][1]["block_words"], Value::Null);
    assert_eq!(shown["links"][1]["heading_ok"], false);
}

#[test]
fn callout_kinds_write_their_marker() {
    // notebook row 22 (NB10): a callout has a kind, written as its marker; `wb block add` writes it, `wb page blocks` reads it
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["page", "new", "Zeal in Numbers 25"])["id"].as_str().unwrap().to_string();
    for (marker, kind) in [("question", "question"), ("done", "done"), ("key", "key"), ("note", "note")] {
        wb.js(&["block", "add", &a, &format!("> [!{marker}] A {kind} callout")]);
    }
    let shown = wb.js(&["note", "show", &a]);
    let text = shown["text"].as_str().unwrap();
    for marker in ["> [!question] A question callout", "> [!done] A done callout", "> [!key] A key callout", "> [!note] A note callout"] {
        assert!(text.contains(marker), "{marker} in {text}");
    }
    let blocks = wb.js(&["page", "blocks", &a]);
    let kinds: Vec<(&str, &str)> = blocks["blocks"].as_array().unwrap().iter().map(|b| (b["callout"]["kind"].as_str().unwrap(), b["callout"]["label"].as_str().unwrap())).collect();
    assert_eq!(kinds, [("question", "Question"), ("done", "Answered"), ("key", "Key point"), ("note", "Note")]);
    // several lines and a nested list stay in the one block, with the first line and what follows named
    wb.js(&["block", "add", &a, "> [!key] First line\n> second line\n> - an item\n>   - nested"]);
    let b = wb.js(&["page", "blocks", &a])["blocks"][4].clone();
    assert_eq!(b["kind"], "quote");
    assert_eq!((b["callout"]["first"].as_str().unwrap(), b["callout"]["more"].as_u64().unwrap(), b["callout"]["list"].as_bool().unwrap()), ("First line", 3, true));
}

#[test]
fn callout_kind_changes() {
    // notebook row 23 (NB10): `wb callout kind PAGE#N KIND` writes only the marker's word; the lines, the nested list and a link id stay
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["page", "new", "Zeal in Numbers 25"])["id"].as_str().unwrap().to_string();
    wb.js(&["block", "add", &a, "> [!question] Why an everlasting priesthood?\n> read it beside the next\n> - who receives it?\n>   - the seed"]);
    let id = format!("{a}#1");
    let r = wb.js(&["callout", "kind", &id, "answered"]);
    assert_eq!((r["kind"].as_str().unwrap(), r["label"].as_str().unwrap()), ("done", "Answered"));
    let text = wb.js(&["note", "show", &a])["text"].as_str().unwrap().to_string();
    assert!(text.contains("> [!done] Why an everlasting priesthood?\n> read it beside the next\n> - who receives it?\n>   - the seed"), "{text}");
    // and back, through a block that has a link id
    let link = wb.js(&["block", "link", &a, "1"]);
    let bid = link["block"].as_str().unwrap().to_string();
    wb.js(&["callout", "kind", &id, "Question"]);
    let text = wb.js(&["note", "show", &a])["text"].as_str().unwrap().to_string();
    assert!(text.contains(&format!("> [!question] Why an everlasting priesthood?\n> read it beside the next\n> - who receives it?\n>   - the seed ^{bid}")), "{text}");
    wb.js(&["callout", "kind", &id, "key point"]);
    assert_eq!(wb.js(&["page", "blocks", &a])["blocks"][0]["callout"]["kind"], "key");
    // not a callout, not a kind
    wb.js(&["block", "add", &a, "A plain paragraph"]);
    let (code, _, _) = wb.run(&["callout", "kind", &format!("{a}#2"), "note"], None);
    assert_ne!(code, 0);
    let (code, _, _) = wb.run(&["callout", "kind", &id, "bogus"], None);
    assert_ne!(code, 0);
}

#[test]
fn old_question_callouts_still_read() {
    // notebook row 24 (NB10): a page that holds `> [!question]` and `> [!done]` shows them as the Question and Answered callouts, and the
    // Questions list still finds them, as before
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["page", "new", "Haste study"])["id"].as_str().unwrap().to_string();
    wb.js(&["block", "add", &a, "> [!question] Who acts first, and who waits?"]);
    wb.js(&["block", "add", &a, "> [!done] What is promised afterwards?"]);
    let blocks = wb.js(&["page", "blocks", &a]);
    assert_eq!(blocks["blocks"][0]["callout"]["label"], "Question");
    assert_eq!(blocks["blocks"][1]["callout"]["label"], "Answered");
    assert_eq!(blocks["blocks"][0]["question"]["done"], false);
    assert_eq!(blocks["blocks"][1]["question"]["done"], true);
    let open = wb.js(&["question", "list"]);
    assert!(open["questions"].as_array().unwrap().iter().any(|q| q["text"] == "Who acts first, and who waits?"));
    let all = wb.js(&["question", "list", "--status", "all"]);
    assert!(all["questions"].as_array().unwrap().iter().any(|q| q["text"] == "What is promised afterwards?" && q["status"] == "done"));
    // the file is untouched by reading it
    assert!(wb.js(&["note", "show", &a])["text"].as_str().unwrap().contains("> [!done] What is promised afterwards?"));
}

#[test]
fn callout_kinds_found() {
    // notebook row 46 (NB10): the Questions list filters by kind (question, answered); Key points and Notes are found by the search and by
    // `wb callout list`, each with its page and first line, a callout of several lines named as such
    let Some(wb) = Wb::new() else { return };
    let a = wb.js(&["page", "new", "Zeal in Numbers 25"])["id"].as_str().unwrap().to_string();
    let b = wb.js(&["page", "new", "Haste study"])["id"].as_str().unwrap().to_string();
    wb.js(&["block", "add", &a, "> [!question] Why an everlasting priesthood?\n> read it twice\n> - who receives it?"]);
    wb.js(&["block", "add", &a, "> [!key] The covenant is given to him and to his seed after him."]);
    wb.js(&["block", "add", &a, "> [!note] Read the YLT of verse 13 next."]);
    wb.js(&["block", "add", &b, "> [!done] What is promised afterwards?"]);
    wb.js(&["block", "add", &b, "> [!key] Wait for the word before acting."]);
    let qs = wb.js(&["question", "list", "--kind", "question"]);
    let q = qs["questions"].as_array().unwrap().iter().find(|q| q["first"] == "Why an everlasting priesthood?").unwrap().clone();
    assert_eq!((q["more_lines"].as_u64().unwrap(), q["has_list"].as_bool().unwrap(), q["page_title"].as_str().unwrap()), (2, true, "Zeal in Numbers 25"));
    assert!(qs["questions"].as_array().unwrap().iter().all(|q| q["status"] == "open"));
    let done = wb.js(&["question", "list", "--kind", "answered"]);
    assert!(done["questions"].as_array().unwrap().iter().any(|q| q["text"] == "What is promised afterwards?"));
    assert!(done["questions"].as_array().unwrap().iter().all(|q| q["status"] == "done"));
    let keys = wb.js(&["callout", "list", "--kind", "key"]);
    let rows = keys["callouts"].as_array().unwrap();
    assert_eq!(rows.len(), 2);
    assert!(rows.iter().all(|r| r["kind"] == "key" && r["label"] == "Key point"));
    assert!(rows.iter().any(|r| r["first"] == "Wait for the word before acting." && r["page_title"] == "Haste study"));
    assert_eq!(keys["counts"]["note"], 1);
    assert_eq!(wb.js(&["callout", "list", "--page", &a])["callouts"].as_array().unwrap().len(), 3);
    // the one search groups them as Key points and Notes
    let found = wb.js(&["find", "key point", "--sort", "edited"]);
    let g = found["groups"].as_array().unwrap().iter().find(|g| g["kind"] == "key").unwrap().clone();
    assert_eq!(g["count"], 2);
    assert!(g["results"].as_array().unwrap().iter().all(|r| r["snippet"].is_string()));
    let notes = wb.js(&["find", "ylt", "--kind", "note"]);
    assert_eq!(notes["groups"][0]["results"][0]["title"], "Read the YLT of verse 13 next.");
}
