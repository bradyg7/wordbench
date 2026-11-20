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
    /// A release file with the given notes and earlier releases `[(version, date, notes)]`.
    fn feed_notes(&self, version: &str, notes: &str, earlier: &[(&str, &str, &str)]) -> String {
        let p = self.dir.join("latest.json");
        let releases: Vec<Value> = earlier.iter().map(|(v, d, n)| serde_json::json!({"version": v, "pub_date": d, "notes": n})).collect();
        let body = serde_json::json!({"version": version, "pub_date": "2026-11-19T07:00:00Z", "size": 84000000, "notes": notes, "releases": releases, "platforms": {}});
        std::fs::write(&p, body.to_string()).unwrap();
        p.display().to_string()
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

    const FULL: &str = "## Moved or removed\n- The Trail moved into the rail.\n- The old pane is gone.\n\n## New\n- Updates in Settings.\n\n## Changed\n- A line changed.\n\n## Fixed\n- A thing was fixed.\n\n## Your study folder\nNothing changes in your study folder.";

    /// Row 9: the four headings in order, then the study-folder line, in the release's own words.
    #[test]
    fn notes_show_the_four_headings_in_order_then_the_study_folder() {
        let h = Home::new("notes-full");
        let feed = h.feed_notes("99.0.0", FULL, &[]);
        assert_eq!(h.run(&["update", "check"], Some(&feed)).0, 0);
        let (code, out, _) = h.run(&["update", "notes"], None);
        assert_eq!(code, 0);
        let at = |w: &str| out.find(&format!("\n{w}\n")).unwrap_or_else(|| panic!("{w} in {out}"));
        let order = ["Moved or removed", "New", "Changed", "Fixed", "Your study folder"].map(at);
        assert!(order.windows(2).all(|w| w[0] < w[1]), "{out}");
        for line in ["- The Trail moved into the rail.", "- The old pane is gone.", "- Updates in Settings.", "- A line changed.", "- A thing was fixed.", "Nothing changes in your study folder."] {
            assert!(out.contains(line), "{line} in {out}");
        }
        assert!(out.starts_with("Bible Workbench 99.0.0 (2026-11-19)"), "{out}");
        // one version by name
        assert_eq!(h.run(&["update", "notes", "99.0.0"], None).1, out);
    }

    #[test]
    fn a_release_that_moved_nothing_says_so() {
        let h = Home::new("notes-nothing");
        let feed = h.feed_notes("99.0.0", "## New\n- A thing.\n\n## Your study folder\nNothing changes.", &[]);
        h.run(&["update", "check"], Some(&feed));
        let out = h.run(&["update", "notes"], None).1;
        assert!(out.contains("Moved or removed\n- Nothing was moved or removed.\n"), "{out}");
        // an empty heading too
        let feed = h.feed_notes("99.0.0", "## Moved or removed\n\n## New\n- x", &[]);
        h.run(&["update", "check"], Some(&feed));
        assert!(h.run(&["update", "notes"], None).1.contains("Nothing was moved or removed."));
    }

    /// Notes holding a link or markup are shown as their plain text, and nothing is fetched.
    #[test]
    fn markup_in_the_notes_is_text_and_nothing_is_fetched() {
        let h = Home::new("notes-markup");
        let line = "<img src=\"http://127.0.0.1:9/x.png\"> and [a link](http://127.0.0.1:9/y) and **bold**";
        let feed = h.feed_notes("99.0.0", &format!("## Moved or removed\n- {line}\n\n## Your study folder\nNothing changes."), &[]);
        h.run(&["update", "check"], Some(&feed));
        let out = h.run(&["update", "notes"], None).1;
        assert!(out.contains(line), "{out}");
        let j = json(&h.run(&["update", "notes", "--json"], None).1);
        assert_eq!(j["releases"][0]["moved"][0], line);
    }

    /// Fourteen behind: the newest is open, the thirteen older are folded to version and date, and the ones that moved
    /// something keep that line.
    #[test]
    fn fourteen_behind_folds_the_older_ones() {
        let h = Home::new("notes-fold");
        let mut earlier: Vec<(String, String, String)> = vec![];
        for i in 1..=13 {
            let moved = if i % 4 == 0 { format!("## Moved or removed\n- Moved thing {i}\n- second line {i}\n\n") } else { String::new() };
            earlier.push((format!("98.{i}.0"), format!("2026-10-{i:02}T00:00:00Z"), format!("{moved}## New\n- new {i}\n")));
        }
        // an older release than the one running is never listed
        earlier.push(("0.0.1".into(), "2020-01-01T00:00:00Z".into(), "## New\n- ancient\n".into()));
        let refs: Vec<(&str, &str, &str)> = earlier.iter().map(|(a, b, c)| (a.as_str(), b.as_str(), c.as_str())).collect();
        let feed = h.feed_notes("99.0.0", FULL, &refs);
        h.run(&["update", "check"], Some(&feed));
        let out = h.run(&["update", "notes"], None).1;
        assert!(out.starts_with("Bible Workbench 99.0.0 (2026-11-19)\n"), "{out}");
        assert!(!out.contains("ancient") && !out.contains("0.0.1"), "{out}");
        // newest first: 98.13.0 before 98.1.0
        assert!(out.find("98.13.0").unwrap() < out.find("98.1.0").unwrap());
        // folded: the version and date; a release that moved something keeps its first line, one that moved nothing shows only version and date
        assert!(out.contains("Bible Workbench 98.4.0 (2026-10-04)\n  Moved or removed: Moved thing 4\n"), "{out}");
        assert!(!out.contains("second line"), "{out}");
        assert!(out.contains("Bible Workbench 98.3.0 (2026-10-03)\n\nBible"), "{out}");
        assert!(!out.contains("new 3"), "folded notes are not open: {out}");
        let j = json(&h.run(&["update", "notes", "--json"], None).1);
        let rel = j["releases"].as_array().unwrap();
        assert_eq!(rel.len(), 14);
        assert_eq!(rel[0]["open"], true);
        assert!(rel[1..].iter().all(|r| r["open"] == false));
        // a folded one can be read in full by name
        assert!(h.run(&["update", "notes", "98.3.0"], None).1.contains("- new 3"));
    }

    /// The version running reads offline: its notes come with the program.
    #[test]
    fn the_installed_versions_notes_read_offline() {
        let h = Home::new("notes-installed");
        let (code, out, _) = h.run(&["update", "notes", wb_core::updates::INSTALLED], Some("http://127.0.0.1:9/latest.json"));
        assert_eq!(code, 0, "{out}");
        assert!(out.contains(&format!("Bible Workbench {}", wb_core::updates::INSTALLED)) && out.contains("Your study folder"), "{out}");
        // with nothing newer known, the bare command prints them too
        assert_eq!(h.run(&["update", "notes"], None).1, out);
        let (code, _, err) = h.run(&["update", "notes", "98.0.0"], None);
        assert_eq!(code, 1);
        assert!(err.contains("not known on this computer"), "{err}");
    }

    /// Row 10: Not this version puts the dot away until a newer release; the version stays listed.
    #[test]
    fn not_this_version_puts_the_dot_away_until_a_newer_release() {
        let h = Home::new("skip");
        let feed = h.feed("99.0.0");
        h.run(&["update", "check"], Some(&feed));
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["ready"], "Bible Workbench 99.0.0 is ready");
        assert_eq!(s["skipped"], false);
        let (code, out, _) = h.run(&["update", "skip"], None);
        assert_eq!(code, 0, "{out}");
        let s = json(&h.run(&["update", "status"], None).1);
        assert!(s["ready"].is_null(), "the dot is gone: {s}");
        assert_eq!(s["newer"]["version"], "99.0.0", "still listed with Install");
        assert_eq!(s["skipped"], true);
        // across looks that find the same version
        let again = h.run(&["update", "check"], Some(&feed));
        assert_eq!(again.0, 0);
        assert!(json(&h.run(&["update", "status"], None).1)["ready"].is_null());
        // a newer one brings the dot back
        let feed = h.feed("99.0.1");
        h.run(&["update", "check"], Some(&feed));
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["ready"], "Bible Workbench 99.0.1 is ready");
        assert_eq!(s["skipped"], false);
        // --clear undoes it
        h.run(&["update", "skip", "99.0.1"], None);
        assert!(json(&h.run(&["update", "status"], None).1)["ready"].is_null());
        h.run(&["update", "skip", "--clear"], None);
        assert_eq!(json(&h.run(&["update", "status"], None).1)["ready"], "Bible Workbench 99.0.1 is ready");
        // nothing to set aside
        let h2 = Home::new("skip-none");
        let (code, _, err) = h2.run(&["update", "skip"], None);
        assert_eq!(code, 1);
        assert!(err.contains("no newer version"), "{err}");
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
