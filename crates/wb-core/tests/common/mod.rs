//! Shared by the tests carried over from the Python app: a scratch folder of its own for each test, and the database.

#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use wb_core::bible::Bible;

/// A fresh empty folder under the system's temp folder, removed when dropped. Never the person's study folder.
pub struct Scratch(pub PathBuf);

impl Scratch {
    pub fn new() -> Scratch {
        static N: AtomicUsize = AtomicUsize::new(0);
        let p = std::env::temp_dir()
            .join("bible-workbench-rs")
            .join("tests")
            .join(format!(
                "{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
        let _ = std::fs::remove_dir_all(&p);
        std::fs::create_dir_all(&p).unwrap();
        Scratch(p)
    }

    pub fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// The Bible database, or None (the test is then skipped, as the Python tests skip without one).
pub fn bible() -> Option<Bible> {
    let p = wb_core::default_db_path();
    if !p.exists() {
        wb_core::bible_database_missing_in_test();
        return None;
    }
    Some(Bible::open(&p).unwrap())
}

/// The words of a verse range from the database itself, joined as a quote is (so no test types scripture).
pub fn words(b: &Bible, code: &str, c: u32, v: u32, from: u32, to: u32) -> String {
    let ch = b.chapter(code, c).unwrap();
    let verse = ch.verses.iter().find(|x| x.v == v).unwrap();
    let ws: Vec<&wb_core::bible::Word> = verse
        .words
        .iter()
        .filter(|w| w.i >= from && w.i <= to)
        .collect();
    let mut s = String::new();
    for (k, w) in ws.iter().enumerate() {
        s += &w.text;
        if k + 1 < ws.len() {
            s += &w.trail;
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The index of the first word of a verse with this text (as the Python tests look 'zealous' up).
pub fn index_of(b: &Bible, code: &str, c: u32, v: u32, text: &str) -> u32 {
    b.chapter(code, c)
        .unwrap()
        .verses
        .iter()
        .find(|x| x.v == v)
        .unwrap()
        .words
        .iter()
        .find(|w| w.text == text)
        .unwrap()
        .i
}
