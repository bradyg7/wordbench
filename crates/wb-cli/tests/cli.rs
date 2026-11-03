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
