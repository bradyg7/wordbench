//! Updates (design/features/updates, tickets UP1 and UP2): what the app knows about a newer version, and the one look
//! that finds it. The window and `wb update ...` both come here, so there is one set of words and one state.
//!
//! What the app remembers about updates is kept beside the app, never in the study folder (U-15):
//! `%LOCALAPPDATA%\bible-workbench-rs\updates\state.json` (`WB_UPDATES_DIR`, or `updates` under `WB_APP_DIR`, name another
//! place for a test). A look asks one address for one small file and sends nothing about the person (U-4).

use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// The release file. It is the address in `app/src-tauri/tauri.release.conf.json` (a test holds the two together).
pub const FEED: &str = "https://github.com/bradyg7/wordbench-releases/releases/latest/download/latest.json";
/// The version running now.
pub const INSTALLED: &str = env!("CARGO_PKG_VERSION");
/// The commit this copy was built from.
pub const COMMIT: &str = env!("WB_BUILD_COMMIT");

/// Said when a look could not be made (U-11); it changes nothing and says what still works.
pub const COULD_NOT_REACH: &str = "Could not reach the update site. Bible Workbench works as it is.";

/// Whether this build has the update code switched on (the Cargo feature `updater`).
pub fn updates_itself() -> bool {
    cfg!(feature = "updater")
}

/// U-14: what a copy built from source says.
pub fn source_line() -> String {
    format!("This copy was built from source ({COMMIT}). It does not update itself.")
}

/// The dot's tooltip, and the line at the top of Settings (U-1).
pub fn ready_line(version: &str) -> String {
    format!("Bible Workbench {version} is ready")
}

/// "Look for updates" (U-3).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Look {
    /// When the app opens (the default).
    Open,
    /// Only when I ask.
    Ask,
}

impl Look {
    pub fn word(self) -> &'static str {
        match self {
            Look::Open => "open",
            Look::Ask => "ask",
        }
    }
    pub fn parse(s: &str) -> Option<Look> {
        match s.trim().to_lowercase().as_str() {
            "open" => Some(Look::Open),
            "ask" => Some(Look::Ask),
            _ => None,
        }
    }
}

/// A newer release the feed named.
#[derive(Clone, PartialEq, Debug)]
pub struct Found {
    pub version: String,
    /// `YYYY-MM-DD`, or empty when the feed gave none.
    pub date: String,
    /// Bytes, or 0 when the feed gave none.
    pub size: u64,
    /// The first line under *Moved or removed* in the release's notes ("Nothing was moved or removed." when there is none);
    /// None when the release has no notes.
    pub moved: Option<String>,
    /// The release's *Your study folder* line.
    pub study: Option<String>,
}

impl Found {
    fn to_json(&self) -> Value {
        json!({ "version": self.version, "date": self.date, "size": self.size, "moved": self.moved, "study": self.study })
    }
}

/// The two lines the card shows from a release's notes (U-6): the first *Moved or removed* line and the *Your study
/// folder* line. The notes are plain text; they are only read, never followed.
pub fn notes_lines(notes: &str) -> (Option<String>, Option<String>) {
    if notes.trim().is_empty() {
        return (None, None);
    }
    let mut under = String::new();
    let (mut moved, mut study) = (None::<String>, None::<String>);
    for line in notes.lines() {
        let t = line.trim();
        if t.starts_with('#') {
            under = t.trim_start_matches('#').trim().to_lowercase();
            continue;
        }
        let text = t.trim_start_matches(['-', '*']).trim();
        if text.is_empty() {
            continue;
        }
        if under == "moved or removed" && moved.is_none() {
            moved = Some(text.to_string());
        } else if under == "your study folder" && study.is_none() {
            study = Some(text.to_string());
        }
    }
    (Some(moved.unwrap_or_else(|| "Nothing was moved or removed.".to_string())), study)
}

/// What a look answered.
#[derive(Clone, PartialEq, Debug)]
pub enum Answer {
    Newer(Found),
    Newest,
}

/// `1.2.3` as numbers (a leading `v` and anything after `-` or `+` are ignored); None when it is not one.
pub fn version_parts(v: &str) -> Option<Vec<u64>> {
    let core = v.trim().trim_start_matches('v').split(['-', '+']).next()?;
    let parts: Option<Vec<u64>> = core.split('.').map(|p| p.parse().ok()).collect();
    parts.filter(|p| !p.is_empty())
}

/// Whether `a` names a later version than `b` (U-12: a release that is not newer is never offered).
pub fn newer_than(a: &str, b: &str) -> bool {
    match (version_parts(a), version_parts(b)) {
        (Some(mut x), Some(mut y)) => {
            let n = x.len().max(y.len());
            x.resize(n, 0);
            y.resize(n, 0);
            x > y
        }
        _ => false,
    }
}

/// "84 MB", "512 KB".
pub fn size_text(bytes: u64) -> String {
    if bytes == 0 {
        String::new()
    } else if bytes >= 1_000_000 {
        format!("{} MB", (bytes as f64 / 1_000_000.0).round() as u64)
    } else {
        format!("{} KB", (bytes as f64 / 1_000.0).round().max(1.0) as u64)
    }
}

/// Reads the release file's text: the version it names, its date and its size. What it says about this computer's own
/// platform (the signature and address of the installer) is the installer's business, not the look's.
pub fn parse_feed(text: &str) -> Result<Found, String> {
    let bad = || "The update site answered, but not with a release file. Bible Workbench works as it is.".to_string();
    let v: Value = serde_json::from_str(text).map_err(|_| bad())?;
    let version = v.get("version").and_then(Value::as_str).ok_or_else(bad)?.trim().trim_start_matches('v').to_string();
    if version_parts(&version).is_none() {
        return Err(bad());
    }
    let date = v.get("pub_date").and_then(Value::as_str).map(|d| d.chars().take(10).collect()).unwrap_or_default();
    let size = v.get("size").and_then(Value::as_u64).unwrap_or(0);
    let (moved, study) = notes_lines(v.get("notes").and_then(Value::as_str).unwrap_or(""));
    Ok(Found { version, date, size, moved, study })
}

/// Where the feed is read from: `WB_UPDATE_FEED` (a test release: a file, or an address) or the release address.
/// Anything that is not HTTPS is refused (U-12), except a file and this computer's own loopback address for a test feed.
pub fn feed_address() -> Result<String, String> {
    let want = std::env::var("WB_UPDATE_FEED").ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let Some(url) = want else { return Ok(FEED.to_string()) };
    check_address(&url)?;
    Ok(url)
}

fn check_address(url: &str) -> Result<(), String> {
    let lower = url.to_lowercase();
    if lower.starts_with("https://") || !lower.contains("://") || lower.starts_with("file://") {
        return Ok(());
    }
    if let Some(rest) = lower.strip_prefix("http://") {
        let host = if rest.starts_with('[') { "[::1]" } else { rest.split(['/', ':']).next().unwrap_or("") };
        if matches!(host, "127.0.0.1" | "localhost" | "[::1]") {
            return Ok(());
        }
    }
    Err("The update address is not HTTPS, so it was not used. Bible Workbench works as it is.".into())
}

/// The release file's text, from the one address. This is the only network call the app makes by itself.
pub fn fetch_feed() -> Result<String, String> {
    if !updates_itself() {
        return Err(source_line());
    }
    let url = feed_address()?;
    if !url.contains("://") || url.to_lowercase().starts_with("file://") {
        let path = url.strip_prefix("file:///").or_else(|| url.strip_prefix("file://")).unwrap_or(&url);
        return fs::read_to_string(path).map_err(|_| COULD_NOT_REACH.to_string());
    }
    get(&url)
}

#[cfg(feature = "updater")]
fn get(url: &str) -> Result<String, String> {
    // One GET of the release file: no query, no cookie, nothing about the person, the licence or the study folder.
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(std::time::Duration::from_secs(15))).build().into();
    let mut r = agent.get(url).call().map_err(|_| COULD_NOT_REACH.to_string())?;
    r.body_mut().with_config().limit(1_000_000).read_to_string().map_err(|_| COULD_NOT_REACH.to_string())
}

#[cfg(not(feature = "updater"))]
fn get(_: &str) -> Result<String, String> {
    Err(source_line())
}

/// The state kept beside the app.
pub struct Updates {
    dir: PathBuf,
}

impl Updates {
    pub fn new(dir: impl Into<PathBuf>) -> Updates {
        Updates { dir: dir.into() }
    }

    /// `WB_UPDATES_DIR`, else `updates` under `WB_APP_DIR`, else `%LOCALAPPDATA%\bible-workbench-rs\updates`.
    pub fn here() -> Updates {
        if let Ok(p) = std::env::var("WB_UPDATES_DIR") {
            if !p.trim().is_empty() {
                return Updates::new(p);
            }
        }
        if let Ok(p) = std::env::var("WB_APP_DIR") {
            if !p.trim().is_empty() {
                return Updates::new(Path::new(&p).join("updates"));
            }
        }
        let base = crate::platform::local_data_dir().unwrap_or_else(std::env::temp_dir);
        Updates::new(base.join("bible-workbench-rs").join("updates"))
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    fn file(&self) -> PathBuf {
        self.dir.join("state.json")
    }

    fn read(&self) -> Map<String, Value> {
        fs::read_to_string(self.file()).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()).and_then(|v| v.as_object().cloned()).unwrap_or_default()
    }

    fn write(&self, state: &Map<String, Value>) -> Result<(), String> {
        fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        let tmp = self.dir.join("state.json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(&Value::Object(state.clone())).unwrap()).map_err(|e| e.to_string())?;
        fs::rename(&tmp, self.file()).map_err(|e| e.to_string())
    }

    /// "Look for updates".
    pub fn look(&self) -> Look {
        self.read().get("look").and_then(Value::as_str).and_then(Look::parse).unwrap_or(Look::Open)
    }

    pub fn set_look(&self, look: Look) -> Result<(), String> {
        let mut s = self.read();
        if look == Look::Open {
            s.remove("look");
        } else {
            s.insert("look".into(), json!(look.word()));
        }
        self.write(&s)
    }

    /// When the last look was made, if one was.
    pub fn last_look(&self) -> Option<DateTime<Utc>> {
        self.read().get("last_look").and_then(Value::as_str).and_then(|t| DateTime::parse_from_rfc3339(t).ok()).map(|t| t.with_timezone(&Utc))
    }

    /// A newer release known from an earlier look; None once that version (or a later one) is the one running.
    pub fn newer(&self) -> Option<Found> {
        let s = self.read();
        let n = s.get("newer")?;
        let version = n.get("version")?.as_str()?.to_string();
        if !newer_than(&version, INSTALLED) {
            return None;
        }
        let line = |k: &str| n.get(k).and_then(Value::as_str).map(str::to_string);
        Some(Found { version, date: n.get("date").and_then(Value::as_str).unwrap_or("").into(), size: n.get("size").and_then(Value::as_u64).unwrap_or(0), moved: line("moved"), study: line("study") })
    }

    /// A look, made now by hand (Check now, `wb update check`): the answer is kept, with the time. A look that fails
    /// changes nothing.
    pub fn check(&self, now: DateTime<Utc>, fetch: &dyn Fn() -> Result<String, String>) -> Result<Answer, String> {
        if !updates_itself() {
            return Err(source_line());
        }
        let found = parse_feed(&fetch()?)?;
        let mut s = self.read();
        s.insert("last_look".into(), json!(now.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)));
        let answer = if newer_than(&found.version, INSTALLED) {
            s.insert("newer".into(), found.to_json());
            Answer::Newer(found)
        } else {
            s.remove("newer");
            Answer::Newest
        };
        self.write(&s)?;
        Ok(answer)
    }

    /// Whether the app should look by itself now: the setting says *When the app opens*, `no_check` (WB_NO_UPDATE_CHECK)
    /// is not set, and it has not looked in 24 hours (U-3).
    pub fn due(&self, now: DateTime<Utc>, no_check: bool) -> bool {
        updates_itself() && !no_check && self.look() == Look::Open && self.last_look().map_or(true, |t| now - t >= Duration::hours(24))
    }

    /// The look the app makes by itself, ten seconds after the reader has drawn. None when it is not due, or when it
    /// failed (nothing is shown and nothing changes); Some(found) only when a newer release is known.
    pub fn look_by_itself(&self, now: DateTime<Utc>, no_check: bool, fetch: &dyn Fn() -> Result<String, String>) -> Option<Found> {
        if !self.due(now, no_check) {
            return None;
        }
        match self.check(now, fetch) {
            Ok(Answer::Newer(f)) => Some(f),
            _ => None,
        }
    }

    /// Check now, `wb update check`: a look by hand, at the real feed, now.
    pub fn check_now(&self) -> Result<Answer, String> {
        self.check(Utc::now(), &fetch_feed)
    }

    /// The app's own look, made ten seconds after the reader has drawn: `WB_NO_UPDATE_CHECK` is read here.
    pub fn look_by_itself_now(&self) -> Option<Found> {
        self.look_by_itself(Utc::now(), std::env::var("WB_NO_UPDATE_CHECK").is_ok(), &fetch_feed)
    }

    /// `wb update status`, and what the window reads for the dot and the Updates section. Reads only; no network.
    pub fn status(&self) -> Value {
        let newer = self.newer();
        let env_off = std::env::var("WB_NO_UPDATE_CHECK").is_ok();
        json!({
            "installed": INSTALLED,
            "self_updating": updates_itself(),
            "message": if updates_itself() { Value::Null } else { json!(source_line()) },
            "commit": COMMIT,
            "look": self.look().word(),
            "looks_by_itself": updates_itself() && !env_off && self.look() == Look::Open,
            "last_look": self.last_look().map(|t| t.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)),
            "newer": newer.as_ref().map(|f| json!({ "version": f.version, "date": f.date, "size": f.size, "size_text": size_text(f.size), "moved": f.moved, "study": f.study })),
            "ready": newer.as_ref().map(|f| ready_line(&f.version)),
        })
    }
}

/// What `wb update check` prints, and what Check now says.
pub fn answer_line(a: &Answer) -> String {
    match a {
        Answer::Newest => format!("Bible Workbench {INSTALLED} is the newest"),
        Answer::Newer(f) => {
            let mut line = ready_line(&f.version);
            let more: Vec<String> = [size_text(f.size), f.date.clone()].into_iter().filter(|s| !s.is_empty()).collect();
            if !more.is_empty() {
                line.push_str(&format!(" ({})", more.join(", ")));
            }
            line
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    #[allow(unused_imports)]
    use std::cell::Cell;

    fn at(h: i64) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 19, 8, 0, 0).unwrap() + Duration::hours(h)
    }
    #[allow(dead_code)]
    fn feed(version: &str) -> String {
        let notes = "## Moved or removed\n- The Trail moved.\n\n## New\n- A thing.\n\n## Your study folder\nNothing in it changes.";
        json!({ "version": version, "pub_date": "2026-11-19T07:00:00Z", "size": 84000000, "notes": notes, "platforms": {} }).to_string()
    }
    fn scratch(name: &str) -> Updates {
        let d = std::env::temp_dir().join("bible-workbench-rs").join(format!("updates-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        Updates::new(d)
    }

    #[test]
    fn versions_compare_as_numbers() {
        assert!(newer_than("0.10.0", "0.9.9"));
        assert!(newer_than("0.3.0", "0.2.4"));
        assert!(!newer_than("0.2.4", "0.2.4"));
        assert!(!newer_than("0.2.3", "0.2.4"));
        assert!(newer_than("v1.0", "0.9.9"));
        assert!(!newer_than("nonsense", "0.2.4"));
    }

    #[test]
    fn the_feed_address_is_the_one_in_the_release_configuration() {
        let conf = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../app/src-tauri/tauri.release.conf.json")).unwrap();
        assert!(conf.contains(FEED));
    }

    #[test]
    fn only_https_or_this_computers_own_test_feed_is_used() {
        assert!(check_address("https://example.org/latest.json").is_ok());
        assert!(check_address("C:\\temp\\latest.json").is_ok());
        assert!(check_address("http://127.0.0.1:8000/latest.json").is_ok());
        assert!(check_address("http://localhost/latest.json").is_ok());
        assert!(check_address("http://example.org/latest.json").unwrap_err().contains("not HTTPS"));
    }

    #[test]
    fn the_system_dialog_is_gone() {
        // row 1: the shell no longer builds a system message; the window is told instead
        let main = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../app/src-tauri/src/main.rs")).unwrap();
        assert!(!main.contains("MessageDialogButtons"), "the system dialog's buttons are still in the shell");
        assert!(!main.contains(".message("), "a system message is still built in the shell");
    }

    #[cfg(feature = "updater")]
    #[test]
    fn a_look_by_hand_keeps_the_answer_and_the_time() {
        let u = scratch("hand");
        let r = u.check(at(0), &|| Ok(feed("99.0.0"))).unwrap();
        assert!(matches!(r, Answer::Newer(ref f) if f.version == "99.0.0" && f.date == "2026-11-19" && f.size == 84_000_000 && f.moved.as_deref() == Some("The Trail moved.")));
        assert_eq!(u.newer().unwrap().version, "99.0.0");
        assert_eq!(u.last_look(), Some(at(0)));
        let s = u.status();
        assert_eq!(s["ready"], "Bible Workbench 99.0.0 is ready");
        assert_eq!(s["newer"]["size_text"], "84 MB");
        assert_eq!(s["newer"]["study"], "Nothing in it changes.");
        // the newest: the dot goes
        assert_eq!(u.check(at(1), &|| Ok(feed(INSTALLED))).unwrap(), Answer::Newest);
        assert!(u.newer().is_none());
        assert_eq!(answer_line(&Answer::Newest), format!("Bible Workbench {INSTALLED} is the newest"));
        let _ = fs::remove_dir_all(u.dir());
    }

    #[cfg(feature = "updater")]
    #[test]
    fn a_dead_feed_changes_nothing_and_says_so_in_the_words() {
        let u = scratch("dead");
        u.check(at(0), &|| Ok(feed("99.0.0"))).unwrap();
        let before = fs::read_to_string(u.dir().join("state.json")).unwrap();
        let e = u.check(at(30), &|| Err(COULD_NOT_REACH.into())).unwrap_err();
        assert_eq!(e, "Could not reach the update site. Bible Workbench works as it is.");
        assert_eq!(fs::read_to_string(u.dir().join("state.json")).unwrap(), before);
        // by itself, a failed look returns nothing at all (row 2)
        assert!(u.look_by_itself(at(48), false, &|| Err(COULD_NOT_REACH.into())).is_none());
        assert_eq!(fs::read_to_string(u.dir().join("state.json")).unwrap(), before);
        let _ = fs::remove_dir_all(u.dir());
    }

    #[cfg(feature = "updater")]
    #[test]
    fn by_itself_it_looks_once_a_day_and_never_when_told_not_to() {
        let u = scratch("daily");
        let calls = Cell::new(0);
        let fetch = || {
            calls.set(calls.get() + 1);
            Ok(feed("99.0.0"))
        };
        assert!(u.look_by_itself(at(0), false, &fetch).is_some());
        assert_eq!(calls.get(), 1);
        // a second start within 24 hours makes no request
        assert!(u.look_by_itself(at(23), false, &fetch).is_none());
        assert_eq!(calls.get(), 1);
        assert!(u.look_by_itself(at(25), false, &fetch).is_some());
        assert_eq!(calls.get(), 2);
        // WB_NO_UPDATE_CHECK, under either setting
        assert!(u.look_by_itself(at(100), true, &fetch).is_none());
        u.set_look(Look::Ask).unwrap();
        assert!(u.look_by_itself(at(100), true, &fetch).is_none());
        // ten starts with "Only when I ask" make no request
        for i in 0..10 {
            assert!(u.look_by_itself(at(200 + i * 30), false, &fetch).is_none());
        }
        assert_eq!(calls.get(), 2);
        // Check now still looks
        assert!(u.check(at(900), &fetch).is_ok());
        assert_eq!(calls.get(), 3);
        let _ = fs::remove_dir_all(u.dir());
    }

    #[test]
    fn the_setting_is_kept_beside_the_app_and_defaults_to_open() {
        let u = scratch("setting");
        assert_eq!(u.look(), Look::Open);
        u.set_look(Look::Ask).unwrap();
        assert_eq!(Updates::new(u.dir()).look(), Look::Ask);
        assert_eq!(u.status()["look"], "ask");
        u.set_look(Look::Open).unwrap();
        assert_eq!(u.status()["look"], "open");
        assert!(Look::parse("sometimes").is_none());
        let _ = fs::remove_dir_all(u.dir());
    }

    #[test]
    fn a_copy_built_from_source_says_so_and_makes_no_request() {
        if updates_itself() {
            return;
        }
        let u = scratch("source");
        let called = std::cell::Cell::new(false);
        let e = u
            .check(at(0), &|| {
                called.set(true);
                Ok(feed("99.0.0"))
            })
            .unwrap_err();
        assert!(!called.get());
        assert!(e.starts_with("This copy was built from source (") && e.ends_with("). It does not update itself."), "{e}");
        assert_eq!(u.status()["self_updating"], false);
        assert!(u
            .look_by_itself(at(0), false, &|| {
                called.set(true);
                Ok(feed("99.0.0"))
            })
            .is_none());
        assert!(!called.get());
    }

    #[test]
    fn the_card_takes_two_lines_from_the_notes_as_plain_text() {
        let (m, s) = notes_lines("## Moved or removed
- <b>Old</b> [link](http://x) gone
- another
## New
- n
## Your study folder
Nothing changes.");
        assert_eq!(m.as_deref(), Some("<b>Old</b> [link](http://x) gone"));
        assert_eq!(s.as_deref(), Some("Nothing changes."));
        let (m, s) = notes_lines("## Moved or removed

## New
- n
");
        assert_eq!(m.as_deref(), Some("Nothing was moved or removed."));
        assert!(s.is_none());
        assert_eq!(notes_lines("  "), (None, None));
    }

    #[test]
    fn a_release_that_is_not_newer_is_not_offered() {
        let u = scratch("notnewer");
        let mut s = Map::new();
        s.insert("newer".into(), json!({"version": INSTALLED, "date": "", "size": 0}));
        u.write(&s).unwrap();
        assert!(u.newer().is_none());
        assert!(parse_feed("{}").is_err());
        assert!(parse_feed("not json").is_err());
        let _ = fs::remove_dir_all(u.dir());
    }
}
