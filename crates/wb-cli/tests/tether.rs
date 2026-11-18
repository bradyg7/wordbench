//! `wb tether` through the binary, on a scratch study and a scratch app folder (where skips are kept). No verse is typed:
//! the quoted words come from `wb text`.

use serde_json::Value;
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
        let dir = std::env::temp_dir().join("bible-workbench-rs").join("tether-cli").join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("study")).unwrap();
        Some(Wb { dir })
    }

    fn app(&self) -> PathBuf {
        self.dir.join("app")
    }

    fn run(&self, args: &[&str]) -> (i32, String, String) {
        let out = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(args)
            .env("WB_STUDY_DIR", self.dir.join("study"))
            .env("WB_APP_DIR", self.app())
            .env("WB_NO_OPEN", "1")
            .stdin(Stdio::null())
            .output()
            .unwrap();
        (out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).into(), String::from_utf8_lossy(&out.stderr).into())
    }

    fn ok(&self, args: &[&str]) -> String {
        let (c, o, e) = self.run(args);
        assert_eq!(c, 0, "wb {args:?}: {e}");
        o
    }

    fn js_in(&self, args: &[&str], stdin: &str) -> Value {
        serde_json::from_str(&self.run_in(args, stdin)).unwrap()
    }

    fn js(&self, args: &[&str]) -> Value {
        serde_json::from_str(&self.ok(args)).unwrap_or_else(|e| panic!("wb {args:?}: {e}"))
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// A page with a sentence quoting John 3:16 (words cut from the database), a written reference and a spoken one.
fn page(wb: &Wb) -> (String, String) {
    let verse = wb.js(&["text", "John 3:16", "--json"])["verses"][0]["text"].as_str().unwrap().to_string();
    let quote: Vec<String> = verse.to_lowercase().split_whitespace().map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_string()).collect();
    let text = format!("Dump\n\nso we said {} and that was the end of it. Then Romans 8:28 came up and also second Timothy two fifteen later on.", quote.join(" "));
    let id = wb.js(&["page", "new", &text, "--json"])["id"].as_str().unwrap().to_string();
    (id, verse)
}

#[test]
fn tether_finds_accepts_and_undoes() {
    let Some(wb) = Wb::new() else { return };
    let (id, verse) = page(&wb);
    let r = wb.js(&["tether", "Dump", "--json"]);
    assert_eq!(r["summary"]["named"], 2);
    assert_eq!(r["summary"]["quoted"], 1);
    let again = wb.js(&["tether", &id, "--json"]);
    assert_eq!(r, again, "the same candidates and ids twice");
    let ids: Vec<String> = r["candidates"].as_array().unwrap().iter().map(|c| c["id"].as_str().unwrap().to_string()).collect();
    assert_eq!(r["candidates"][0]["ref"], "John 3:16");
    assert_eq!(r["candidates"][0]["text"].as_str().unwrap(), verse);
    let before = wb.js(&["page", "blocks", &id, "--json"])["blocks"].as_array().unwrap().len();
    let done = wb.js(&["tether", "accept", "Dump", &ids[0], "--expect", r["summary"]["page_hash"].as_str().unwrap()]);
    assert_eq!(wb.js(&["page", "blocks", &id, "--json"])["blocks"].as_array().unwrap().len(), before + 2);
    let token = done["undo"].to_string();
    let v = wb.js(&["tether", "verses", "Dump", "--json"]);
    assert_eq!(v[0]["reference"], "John 3:16");
    assert!(wb.ok(&["tether", "verses", "Dump", "--text"]).contains("John 3:16"));
    let r2 = wb.js(&["tether", "Dump", "--json"]);
    assert_eq!(r2["summary"]["in_page"], 1);
    wb.ok(&["tether", "accept", "Dump", "--undo", &token]);
    assert_eq!(wb.js(&["page", "blocks", &id, "--json"])["blocks"].as_array().unwrap().len(), before);
    // the all-named one
    let all = wb.js(&["tether", "accept", "Dump", "--all-named"]);
    assert_eq!(all["added"].as_array().unwrap().len(), 2);
}

#[test]
fn skips_are_kept_in_the_app_folder_and_come_back_without_it() {
    let Some(wb) = Wb::new() else { return };
    let (id, _) = page(&wb);
    let r = wb.js(&["tether", "Dump", "--json"]);
    let c = r["candidates"][1]["id"].as_str().unwrap().to_string();
    let study_before = std::fs::read_to_string(wb.dir.join("study").join(format!("inbox/{id}.md"))).ok();
    wb.ok(&["tether", "skip", "Dump", &c]);
    let r = wb.js(&["tether", "Dump", "--json"]);
    assert_eq!(r["summary"]["skipped"], 1);
    assert_eq!(wb.js(&["tether", "skipped", "Dump", "--json"]).as_array().unwrap().len(), 1);
    assert!(wb.app().join("tether-skips.json").exists());
    wb.ok(&["tether", "unskip", "Dump", &c]);
    assert_eq!(wb.js(&["tether", "Dump", "--json"])["summary"]["skipped"], 0);
    wb.ok(&["tether", "skip", "Dump", &c]);
    std::fs::remove_dir_all(wb.app()).unwrap();
    assert_eq!(wb.js(&["tether", "Dump", "--json"])["summary"]["skipped"], 0, "deleting the state brings skips back");
    let study_after = std::fs::read_to_string(wb.dir.join("study").join(format!("inbox/{id}.md"))).ok();
    assert_eq!(study_before, study_after, "no page changed");
}

#[test]
fn refs_hears_chapter_and_verse() {
    let Some(wb) = Wb::new() else { return };
    let r = wb.js(&["refs", "see Romans 8 verse 28 and John 3:16"]);
    assert_eq!(r.as_array().unwrap().len(), 2);
    assert_eq!(r[0]["ref"], "ROM 8:28");
    let s = wb.js(&["refs", "--spoken", "second Timothy two fifteen"]);
    assert_eq!(s[0]["ref"], "2TI 2:15");
}

impl Wb {
    fn run_in(&self, args: &[&str], stdin: &str) -> String {
        use std::io::Write;
        let mut child = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(args)
            .env("WB_STUDY_DIR", self.dir.join("study"))
            .env("WB_APP_DIR", self.app())
            .env("WB_NO_OPEN", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(stdin.as_bytes()).unwrap();
        let out = child.wait_with_output().unwrap();
        assert_eq!(out.status.code(), Some(0), "wb {args:?}: {}", String::from_utf8_lossy(&out.stderr));
        String::from_utf8_lossy(&out.stdout).into()
    }
}

#[test]
fn the_undo_of_a_long_page_is_kept_in_a_file_not_on_the_command_line() {
    let Some(wb) = Wb::new() else { return };
    let verse = wb.js(&["text", "John 3:16", "--json"])["verses"][0]["text"].as_str().unwrap().to_string();
    let quote: Vec<String> = verse.to_lowercase().split_whitespace().map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_string()).collect();
    let filler = "so what i want to say here is that we need to slow down and look at this together ".repeat(500);
    let text = format!("Long\n\n{filler} {} and then Romans 8:28 came up. {filler}", quote.join(" "));
    assert!(text.split_whitespace().count() > 7500);
    let id = wb.js_in(&["page", "new", "-", "--json"], &text)["id"].as_str().unwrap().to_string();
    let before = wb.js(&["page", "blocks", &id, "--json"]);
    let done = wb.js(&["tether", "accept", "Long", "--all-named"]);
    let file = done["undo_file"].as_str().expect("the token is kept in a file");
    assert!(std::fs::metadata(file).unwrap().len() > 30_000, "the token is long");
    assert!(done["undo"].is_null(), "and is not printed for the command line");
    wb.ok(&["tether", "accept", "Long", "--undo", "last"]);
    assert_eq!(wb.js(&["page", "blocks", &id, "--json"]), before);
    // the same from standard input
    wb.js(&["tether", "accept", "Long", "--all-named"]);
    let token = std::fs::read_to_string(file).unwrap();
    wb.run_in(&["tether", "accept", "Long", "--undo", "-"], &token);
    assert_eq!(wb.js(&["page", "blocks", &id, "--json"]), before);
}

#[test]
fn a_skip_that_cannot_be_kept_still_prints_the_result_and_skip_checks_the_id() {
    let Some(wb) = Wb::new() else { return };
    let (id, _) = page(&wb);
    let e = wb.run(&["tether", "skip", "Dump", "tnotacandidate"]);
    assert_eq!(e.0, 1);
    assert!(e.2.contains("No candidate"), "{}", e.2);
    // a folder where the skips file should be: writing it fails, the accept still reports and keeps its token
    std::fs::create_dir_all(wb.app().join("tether-skips.json")).unwrap();
    let r = wb.js(&["tether", "Dump", "--json"]);
    let ids: Vec<String> = r["candidates"].as_array().unwrap().iter().map(|c| c["id"].as_str().unwrap().to_string()).collect();
    let done = wb.js(&["tether", "accept", "Dump", &ids[1]]);
    assert!(done["undo_file"].is_string());
    let _ = id;
}
