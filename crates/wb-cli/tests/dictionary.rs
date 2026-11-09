//! `wb word-define` (R5): a small dictionary built here (no real dictionary text is typed), the real Bible database for
//! the words of a place. Skipped when there is no Bible database.

use serde_json::Value;
use std::process::Command;

fn dict(dir: &std::path::Path) -> std::path::PathBuf {
    let p = dir.join("dictionary.db");
    let _ = std::fs::remove_file(&p);
    let c = rusqlite::Connection::open(&p).unwrap();
    c.execute_batch(
        "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE entries (headword TEXT PRIMARY KEY, text TEXT NOT NULL) WITHOUT ROWID;
         INSERT INTO meta VALUES ('name','Test dictionary'),('edition','0'),('licence','Public domain'),('url','x'),('via','y');
         INSERT INTO entries VALUES ('envy','ENVY ENTRY'),('envious','ENVIOUS ENTRY'),('prevent','PREVENT ENTRY');",
    )
    .unwrap();
    p
}

fn wb(db: &std::path::Path, args: &[&str]) -> (i32, Value, String) {
    let study = db.parent().unwrap().join("study");
    let o = Command::new(env!("CARGO_BIN_EXE_wb")).args(args).env("WB_DICT_DB", db).env("WB_STUDY_DIR", study).output().unwrap();
    let out = String::from_utf8_lossy(&o.stdout).to_string();
    (o.status.code().unwrap_or(-1), serde_json::from_str(&out).unwrap_or(Value::Null), String::from_utf8_lossy(&o.stderr).into())
}

fn scratch(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join("bible-workbench-rs").join("dict-tests").join(format!("{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn an_entry_is_the_sources_text_with_its_source() {
    let d = scratch("entry");
    let db = dict(&d);
    let (code, v, _) = wb(&db, &["word-define", "envious"]);
    assert_eq!(code, 0);
    assert_eq!(v["text"], "ENVIOUS ENTRY");
    assert_eq!(v["source"]["name"], "Test dictionary");
    assert_eq!(v["source"]["licence"], "Public domain");
    // an ending is taken off when the word itself has no entry
    let (_, v, _) = wb(&db, &["word-define", "Prevented"]);
    assert_eq!(v["headword"], "prevent");
    let (_, v, _) = wb(&db, &["word-define", "envies"]);
    assert_eq!(v["headword"], "envy");
    let (_, v, _) = wb(&db, &["word-define", "zzz"]);
    assert_eq!(v["found"], false);
    let (_, v, _) = wb(&db, &["word-define", "--source"]);
    assert_eq!(v["source"]["entries"], 3);
    let _ = std::fs::remove_dir_all(&d);
}

#[test]
fn no_dictionary_is_said_plainly() {
    let d = scratch("none");
    let (code, _, err) = wb(&d.join("missing.db"), &["word-define", "envy"]);
    assert_eq!(code, 1);
    assert!(err.contains("build-dictionary"), "{err}");
    let _ = std::fs::remove_dir_all(&d);
}

#[test]
fn the_words_of_a_place_each_once_with_their_entry() {
    if !wb_core::default_db_path().exists() {
        eprintln!("no Bible database: skipped");
        return;
    }
    let d = scratch("verse");
    let db = dict(&d);
    let (code, v, err) = wb(&db, &["word-define", "--verse", "Ps 37:1"]);
    assert_eq!(code, 0, "{err}");
    let words = v["words"].as_array().unwrap();
    let names: Vec<String> = words.iter().map(|w| w["word"].as_str().unwrap().to_lowercase()).collect();
    let mut once = names.clone();
    once.sort();
    once.dedup();
    assert_eq!(once.len(), names.len(), "a word once: {names:?}");
    let envious = words.iter().find(|w| w["word"].as_str().unwrap().eq_ignore_ascii_case("envious")).expect("envious is in the verse");
    assert_eq!(envious["text"], "ENVIOUS ENTRY");
    assert!(words.iter().any(|w| w.get("text").is_none()), "words without an entry are listed without text");
    let _ = std::fs::remove_dir_all(&d);
}
