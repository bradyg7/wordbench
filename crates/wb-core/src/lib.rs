//! wb-core: everything in Bible Workbench that is not drawing (docs/archive/2026-11-10/docs/PLAN.md, section 2.1).
//!
//! Phase 0 holds only what the reader spike needs: the read-only Bible database, anchors, reading the study files and
//! the marks of a chapter. Phase 1 brings the rest to parity with the Python app.

pub mod anchors;
pub mod bible;
pub mod cache;
pub mod check;
pub mod findings;
pub mod guide;
pub mod history;
pub mod commands;
pub mod concordance;
pub mod dictionary;
pub mod deletion;
pub mod docs;
pub mod filters;
pub mod folders;
pub mod library;
pub mod lookup;
pub mod margin;
pub mod marks;
pub mod mycommands;
pub mod notebook;
pub mod pageindex;
pub mod blockops;
pub mod pages;
pub mod overview;
pub mod pageviews;
pub mod places;
pub mod platform;
pub mod plans;
pub mod published;
pub mod questions;
pub mod readmap;
pub mod reading;
pub mod relay;
pub mod runtime;
pub mod scripture;
pub mod shelf;
pub mod setup;
pub mod store;
pub mod studyapi;
pub mod studyblocks;
pub mod tether;
pub mod updates;
pub mod updates_install;
pub mod updates_notes;
pub mod templates;
pub mod threadpage;
pub mod views;
pub mod wordpages;

use std::path::PathBuf;

/// The Bible database: `WB_BIBLE_DB`, the choice saved by the app or `wb setup`, `datasets/workbench.db` beside the
/// program (the package), or the application-data folder. `setup::db_candidates` gives every place looked in.
pub fn default_db_path() -> PathBuf {
    #[cfg(feature = "distribution")]
    { return runtime::resource_path("workbench.db"); }
    #[cfg(not(feature = "distribution"))]
    {
    setup::existing_db().unwrap_or_else(|| setup::db_candidates().into_iter().next().unwrap_or_default())
    }
}

/// A test that needs the Bible database calls this when it is not there. It says so loudly (`SKIPPED`, with where it
/// looked and how to set it) and, when `WB_REQUIRE_DB=1` is set, fails the test instead, so a run that skipped cannot
/// look clean. Without the variable the test still skips (a computer with no database, such as the Mac check).
pub fn bible_database_missing_in_test() {
    let looked = default_db_path();
    let msg = format!(
        "SKIPPED: no Bible database at {} (set WB_BIBLE_DB to a workbench.db; WB_REQUIRE_DB=1 makes this a failure)",
        looked.display()
    );
    if std::env::var("WB_REQUIRE_DB").map(|v| v == "1").unwrap_or(false) {
        panic!("{msg}");
    }
    eprintln!("{msg}");
}

/// The study folder: `WB_STUDY_DIR`, the choice saved by the app or `wb setup`, or the scratch copy made by
/// `scripts/scratch-study.ps1` (a development checkout; the window asks the person to choose on first run).
pub fn default_study_dir() -> PathBuf {
    #[cfg(feature = "distribution")]
    { return runtime::study_path(); }
    #[cfg(not(feature = "distribution"))]
    {
    if let Ok(p) = std::env::var("WB_STUDY_DIR") {
        if !p.trim().is_empty() {
            return PathBuf::from(p);
        }
    }
    if let Some(p) = setup::setting("study_dir") {
        return PathBuf::from(p);
    }
    std::env::temp_dir().join("bible-workbench-rs").join("study-scratch")
    }
}

/// The person's real study folder, which wb-core refuses to open unless `WB_ALLOW_REAL_STUDY=1`.
pub fn real_study_dir() -> PathBuf {
    home().join("github").join("bible-study-data")
}

pub(crate) fn home() -> PathBuf {
    std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from).unwrap_or_default()
}

#[derive(Debug)]
pub struct Error(pub String);

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

impl From<rusqlite::Error> for Error {
    fn from(e: rusqlite::Error) -> Self {
        Error(format!("database: {e}"))
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error(format!("file: {e}"))
    }
}

pub type Result<T> = std::result::Result<T, Error>;
