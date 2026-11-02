//! wb-core: everything in Bible Workbench that is not drawing (docs/PLAN.md, section 2.1).
//!
//! Phase 0 holds only what the reader spike needs: the read-only Bible database, anchors, reading the study files and
//! the marks of a chapter. Phase 1 brings the rest to parity with the Python app.

pub mod anchors;
pub mod bible;
pub mod marks;
pub mod study;
pub mod views;

use std::path::PathBuf;

/// The Bible database: `WB_BIBLE_DB`, or the Python repository's built database.
pub fn default_db_path() -> PathBuf {
    if let Ok(p) = std::env::var("WB_BIBLE_DB") {
        return PathBuf::from(p);
    }
    home().join("github").join("bible-workbench").join("datasets").join("workbench.db")
}

/// The study folder: `WB_STUDY_DIR`, or the scratch copy made by `scripts/scratch-study.ps1`.
pub fn default_study_dir() -> PathBuf {
    if let Ok(p) = std::env::var("WB_STUDY_DIR") {
        return PathBuf::from(p);
    }
    std::env::temp_dir().join("bible-workbench-rs").join("study-scratch")
}

/// The person's real study folder, which wb-core refuses to open unless `WB_ALLOW_REAL_STUDY=1`.
pub fn real_study_dir() -> PathBuf {
    home().join("github").join("bible-study-data")
}

fn home() -> PathBuf {
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
