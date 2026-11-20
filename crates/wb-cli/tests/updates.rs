//! `wb update status`, `wb update check` and `wb settings updates` (design/features/updates rows 5 to 8, tickets UP1-UP2).
//! The binary is run with its own updates folder (`WB_UPDATES_DIR`) and a release served from this computer
//! (`WB_UPDATE_FEED`): never the real release address, the study folder or the installed app.
//! The tests that need the update code run with `--features updater`; a plain build tests the built-from-source words.

use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

struct Home {
    dir: PathBuf,
}

impl Home {
    fn new(name: &str) -> Home {
        let dir = std::env::temp_dir().join("bible-workbench-rs").join("update-tests").join(format!("{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Home { dir }
    }
    fn updates(&self) -> PathBuf {
        self.dir.join("updates")
    }
    fn run(&self, args: &[&str], feed: Option<&str>) -> (i32, String, String) {
        let mut c = Command::new(env!("CARGO_BIN_EXE_wb"));
        c.args(args).env("WB_UPDATES_DIR", self.updates()).env("WB_STUDY_DIR", self.dir.join("study")).env_remove("WB_NO_UPDATE_CHECK").env_remove("WB_UPDATE_FEED");
        if let Some(f) = feed {
            c.env("WB_UPDATE_FEED", f);
        }
        let out = c.output().unwrap();
        (out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).into(), String::from_utf8_lossy(&out.stderr).into())
    }
    fn feed(&self, version: &str) -> String {
        let p = self.dir.join("latest.json");
        std::fs::write(&p, format!(r#"{{"version":"{version}","pub_date":"2026-11-19T07:00:00Z","size":84000000,"notes":"x","platforms":{{}}}}"#)).unwrap();
        p.display().to_string()
    }
}

fn json(s: &str) -> Value {
    serde_json::from_str(s).unwrap_or_else(|e| panic!("{e}: {s}"))
}

#[test]
fn status_reads_only_and_settings_updates_prints_and_sets() {
    let h = Home::new("status");
    let (code, out, _) = h.run(&["update", "status"], None);
    assert_eq!(code, 0);
    let s = json(&out);
    assert_eq!(s["installed"], wb_core::updates::INSTALLED);
    assert_eq!(s["look"], "open");
    assert!(s["last_look"].is_null() && s["newer"].is_null());
    // status makes no state of its own
    assert!(!h.updates().join("state.json").exists());

    assert_eq!(json(&h.run(&["settings", "updates"], None).1)["look"], "open");
    assert_eq!(json(&h.run(&["settings", "updates", "ask"], None).1)["look"], "ask");
    assert_eq!(json(&h.run(&["update", "status"], None).1)["look"], "ask");
    assert_eq!(json(&h.run(&["settings", "updates", "open"], None).1)["look"], "open");
    let (code, _, err) = h.run(&["settings", "updates", "sometimes"], None);
    assert_eq!(code, 1);
    assert!(err.contains("open") && err.contains("ask"), "{err}");
    // beside the app, never in the study folder
    assert!(!h.dir.join("study").exists());
}

#[cfg(not(feature = "updater"))]
#[test]
fn a_copy_built_from_source_says_so_and_makes_no_request() {
    let h = Home::new("source");
    let feed = h.feed("99.0.0");
    let (code, out, err) = h.run(&["update", "check"], Some(&feed));
    assert_eq!(code, 1, "{out}");
    assert!(err.contains("This copy was built from source (") && err.contains("). It does not update itself."), "{err}");
    let s = json(&h.run(&["update", "status"], None).1);
    assert_eq!(s["self_updating"], false);
    assert_eq!(s["message"], wb_core::updates::source_line());
    assert!(!h.updates().join("state.json").exists());
}

#[cfg(feature = "updater")]
mod with_the_update_code {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};

    #[test]
    fn check_finds_a_newer_version_and_status_knows_it() {
        let h = Home::new("newer");
        let feed = h.feed("99.0.0");
        let (code, out, _) = h.run(&["update", "check"], Some(&feed));
        assert_eq!(code, 0);
        assert!(out.trim().starts_with("Bible Workbench 99.0.0 is ready"), "{out}");
        assert!(out.contains("84 MB") && out.contains("2026-11-19"), "{out}");
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["ready"], "Bible Workbench 99.0.0 is ready");
        assert_eq!(s["newer"]["version"], "99.0.0");
        assert!(s["last_look"].is_string());
    }

    #[test]
    fn check_says_when_this_is_the_newest() {
        let h = Home::new("newest");
        let feed = h.feed(wb_core::updates::INSTALLED);
        let (code, out, _) = h.run(&["update", "check"], Some(&feed));
        assert_eq!(code, 0);
        assert_eq!(out.trim(), format!("Bible Workbench {} is the newest", wb_core::updates::INSTALLED));
        assert!(json(&h.run(&["update", "status"], None).1)["newer"].is_null());
    }

    #[test]
    fn no_connection_says_so_in_the_words_and_exits_1() {
        let h = Home::new("dead");
        // a file that is not there, and an address nothing listens on
        let missing = h.dir.join("nothing.json").display().to_string();
        for feed in [missing.as_str(), "http://127.0.0.1:9/latest.json"] {
            let (code, out, err) = h.run(&["update", "check"], Some(feed));
            assert_eq!(code, 1, "{out}");
            assert_eq!(err.trim(), "error: Could not reach the update site. Bible Workbench works as it is.");
        }
        // it changed nothing
        assert!(!h.updates().join("state.json").exists());
    }

    #[test]
    fn an_address_that_is_not_https_is_refused() {
        let h = Home::new("http");
        let (code, _, err) = h.run(&["update", "check"], Some("http://example.org/latest.json"));
        assert_eq!(code, 1);
        assert!(err.contains("not HTTPS"), "{err}");
    }

    /// U-4: a look asks one address for one small file: one GET, no query, no cookie, nothing about the person.
    #[test]
    fn a_look_sends_one_plain_get() {
        let h = Home::new("served");
        let seen: Arc<Mutex<Vec<String>>> = Arc::default();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let log = seen.clone();
        std::thread::spawn(move || {
            for conn in listener.incoming().take(1) {
                let mut s = conn.unwrap();
                let mut buf = [0u8; 4096];
                let n = s.read(&mut buf).unwrap();
                log.lock().unwrap().push(String::from_utf8_lossy(&buf[..n]).into());
                let body = r#"{"version":"99.0.0","pub_date":"2026-11-19T07:00:00Z","size":84000000}"#;
                let _ = write!(s, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
            }
        });
        let (code, out, err) = h.run(&["update", "check"], Some(&format!("http://127.0.0.1:{port}/latest.json")));
        assert_eq!(code, 0, "{out} {err}");
        let requests = seen.lock().unwrap().clone();
        assert_eq!(requests.len(), 1);
        let head = requests[0].to_lowercase();
        assert!(head.starts_with("get /latest.json http/1.1"), "{head}");
        for never in ["cookie", "authorization", "x-", "?"] {
            assert!(!head.contains(never), "{never} in {head}");
        }
        let study = h.dir.join("study").display().to_string().to_lowercase();
        assert!(!head.contains(&study));
    }
}
