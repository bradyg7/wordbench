//! Setup: where Bible Workbench keeps its settings, and how it finds the two things it needs.
//!
//! The order is deliberate. The environment wins, so a terminal (and the tests) can point anywhere without touching the
//! person's settings. Then the person's choice, saved in `settings.json` by the window's setup screen or by
//! `wb setup`. Then the package: `datasets/workbench.db` beside the program, which is where a downloaded Bible
//! Workbench finds its Bible. The application-data directory also has a `datasets/` fallback.

use serde_json::{Map, Value};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

/// The folder's name under the user's application-data directory (Windows: %APPDATA%\Bible Workbench).
pub const APP_DIR_NAME: &str = "Bible Workbench";

/// The name of the file the Bible database ships as, inside `datasets/` beside the program.
pub const DB_FILE: &str = "workbench.db";

/// Where settings are kept: `WB_APP_DIR`, or the platform's application-data folder.
pub fn app_dir() -> PathBuf {
    if let Ok(p) = env::var("WB_APP_DIR") {
        if !p.trim().is_empty() {
            return PathBuf::from(p);
        }
    }
    os_app_dir().unwrap_or_else(|| env::temp_dir().join("bible-workbench"))
}

fn os_app_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        env::var_os("APPDATA").map(|base| PathBuf::from(base).join(APP_DIR_NAME))
    }
    #[cfg(target_os = "macos")]
    {
        env::var_os("HOME").map(|home| PathBuf::from(home).join("Library").join("Application Support").join(APP_DIR_NAME))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        env::var_os("XDG_CONFIG_HOME")
            .map(|base| PathBuf::from(base).join("bible-workbench"))
            .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config").join("bible-workbench")))
    }
    #[cfg(not(any(windows, unix)))]
    {
        None
    }
}

pub fn settings_path() -> PathBuf {
    app_dir().join("settings.json")
}

/// The settings file as an object; an unreadable or missing file is an empty one.
pub fn settings() -> Map<String, Value> {
    fs::read_to_string(settings_path())
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

/// One setting, if it is a non-empty string.
pub fn setting(key: &str) -> Option<String> {
    settings()
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Saves one setting. An empty value removes it. The file is written beside the old one and moved into place, so a
/// half-written settings file is never read.
pub fn set_setting(key: &str, value: &str) -> crate::Result<()> {
    let mut map = settings();
    let value = value.trim();
    if value.is_empty() {
        map.remove(key);
    } else {
        map.insert(key.to_string(), Value::String(value.to_string()));
    }
    fs::create_dir_all(app_dir()).map_err(io)?;
    let text = serde_json::to_string_pretty(&Value::Object(map)).map_err(|e| crate::Error(e.to_string()))?;
    let path = settings_path();
    let tmp = path.with_file_name("settings.json.tmp");
    fs::write(&tmp, text).map_err(io)?;
    if path.exists() {
        fs::remove_file(&path).map_err(io)?;
    }
    fs::rename(&tmp, &path).map_err(io)
}

fn io(e: std::io::Error) -> crate::Error {
    crate::Error(e.to_string())
}

/// The study folder was chosen by the person (a setting or WB_STUDY_DIR), rather than being the development scratch copy.
pub fn study_configured() -> bool {
    env::var("WB_STUDY_DIR").map(|v| !v.trim().is_empty()).unwrap_or(false) || setting("study_dir").is_some()
}

/// The folder offered on the setup screen when none has been chosen yet.
pub fn suggested_study_dir() -> PathBuf {
    crate::home().join("Documents").join("Bible Workbench")
}

/// Where the Bible database may be, best first: `WB_BIBLE_DB`, the saved choice, beside the program, the application
/// data folder.
pub fn db_candidates() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    let mut add = |p: PathBuf| {
        if !out.contains(&p) {
            out.push(p);
        }
    };
    if let Ok(p) = env::var("WB_BIBLE_DB") {
        if !p.trim().is_empty() {
            add(PathBuf::from(p));
        }
    }
    if let Some(p) = setting("bible_db") {
        add(PathBuf::from(p));
    }
    if let Some(dir) = env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) {
        add(dir.join("datasets").join(DB_FILE));
        add(dir.join(DB_FILE));
    }
    add(app_dir().join("datasets").join(DB_FILE));
    out
}

/// The first candidate that is a file.
pub fn existing_db() -> Option<PathBuf> {
    db_candidates().into_iter().find(|p| p.is_file())
}
