//! `wb update status`, `wb update check` and `wb settings updates` (design/features/updates rows 5 to 8, tickets UP1-UP2).
//! The binary is run with its own updates folder (`WB_UPDATES_DIR`) and a release served from this computer
//! (`WB_UPDATE_FEED`): never the real release address, the study folder or the installed app.
//! The tests that need the update code run with `--features updater`; a plain build tests the built-from-source words.

use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

/// The test key (made for these tests only; its private half signed the fixtures and is not kept) and what it signed.
const TEST_KEY: &str = include_str!("update-fixtures/test-key.pub");

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
    /// Where the test installer writes that it ran.
    fn installed_marker(&self) -> PathBuf {
        self.dir.join("installed.txt")
    }
    fn updates(&self) -> PathBuf {
        self.dir.join("updates")
    }
    fn run(&self, args: &[&str], feed: Option<&str>) -> (i32, String, String) {
        let mut c = Command::new(env!("CARGO_BIN_EXE_wb"));
        c.args(args).env("WB_UPDATES_DIR", self.updates()).env("WB_STUDY_DIR", self.dir.join("study")).env_remove("WB_NO_UPDATE_CHECK").env_remove("WB_UPDATE_FEED")
            .env("WB_CACHE_DIR", self.dir.join("cache"))
            .env("WB_UPDATE_PUBKEY", TEST_KEY.trim())
            .env("WB_TEST_INSTALLED", self.installed_marker());
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

    // ---- UP4: Install in the background, Stop, refusals (rows 11 to 15), and the installer's run (rows 16 to 18) ----
    //
    // The test installer is a small script (installer.cmd on Windows, installer.sh elsewhere) that writes where it ran, signed
    // with a key made for these tests (`npx tauri signer generate`, then `npx tauri signer sign`); `.other.sig` is the same
    // file signed with a second key. The release is served from this computer; the real release address is never used.

    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::{Duration, Instant};

    #[cfg(windows)]
    const INSTALLER: &[u8] = include_bytes!("update-fixtures/installer.cmd");
    #[cfg(windows)]
    const SIG: &str = include_str!("update-fixtures/installer.cmd.sig");
    #[cfg(windows)]
    const OTHER_SIG: &str = include_str!("update-fixtures/installer.cmd.other.sig");
    #[cfg(windows)]
    const NAME: &str = "installer.cmd";
    #[cfg(not(windows))]
    const INSTALLER: &[u8] = include_bytes!("update-fixtures/installer.sh");
    #[cfg(not(windows))]
    const SIG: &str = include_str!("update-fixtures/installer.sh.sig");
    #[cfg(not(windows))]
    const OTHER_SIG: &str = include_str!("update-fixtures/installer.sh.other.sig");
    #[cfg(not(windows))]
    const NAME: &str = "installer.sh";

    /// What the in-process tests share: the environment of this test program (one at a time).
    static ENV: Mutex<()> = Mutex::new(());

    /// One thing the test server serves.
    #[derive(Clone)]
    struct Route {
        path: String,
        body: Vec<u8>,
        /// The length the answer claims (more than it sends: a download that stops partway).
        claims: Option<usize>,
        /// Sent in pieces of this many bytes, with a pause (milliseconds) between: a download that takes a while.
        slow: Option<(usize, u64)>,
    }

    struct Server {
        port: u16,
        hits: Arc<Mutex<Vec<String>>>,
        stop: Arc<AtomicBool>,
    }

    impl Drop for Server {
        fn drop(&mut self) {
            self.stop.store(true, Ordering::SeqCst);
        }
    }

    impl Server {
        fn start(routes: Vec<Route>) -> Server {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            listener.set_nonblocking(true).unwrap();
            let port = listener.local_addr().unwrap().port();
            let hits: Arc<Mutex<Vec<String>>> = Arc::default();
            let stop = Arc::new(AtomicBool::new(false));
            let (h, s) = (hits.clone(), stop.clone());
            std::thread::spawn(move || {
                while !s.load(Ordering::SeqCst) {
                    match listener.accept() {
                        Ok((mut conn, _)) => {
                            let (routes, h) = (routes.clone(), h.clone());
                            std::thread::spawn(move || {
                                conn.set_nonblocking(false).unwrap();
                                let mut buf = [0u8; 4096];
                                let n = conn.read(&mut buf).unwrap_or(0);
                                let head = String::from_utf8_lossy(&buf[..n]).to_string();
                                let path = head.split_whitespace().nth(1).unwrap_or("").to_string();
                                h.lock().unwrap().push(path.clone());
                                let Some(r) = routes.iter().find(|r| r.path == path) else {
                                    let _ = write!(conn, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                                    return;
                                };
                                // the release file names its installer by this server's own port
                                let body = if r.path == "/latest.json" { String::from_utf8_lossy(&r.body).replace("@PORT@", &port.to_string()).into_bytes() } else { r.body.clone() };
                                let claims = r.claims.unwrap_or(body.len());
                                let _ = write!(conn, "HTTP/1.1 200 OK\r\nContent-Length: {claims}\r\nConnection: close\r\n\r\n");
                                match r.slow {
                                    None => {
                                        let _ = conn.write_all(&body);
                                    }
                                    Some((piece, pause)) => {
                                        for c in body.chunks(piece) {
                                            if conn.write_all(c).is_err() {
                                                break;
                                            }
                                            std::thread::sleep(Duration::from_millis(pause));
                                        }
                                    }
                                }
                            });
                        }
                        Err(_) => std::thread::sleep(Duration::from_millis(5)),
                    }
                }
            });
            Server { port, hits, stop }
        }
        fn url(&self, path: &str) -> String {
            format!("http://127.0.0.1:{}/{path}", self.port)
        }
        fn count(&self, path: &str) -> usize {
            self.hits.lock().unwrap().iter().filter(|p| p.trim_start_matches('/') == path).count()
        }
    }

    fn route(path: &str, body: &[u8]) -> Route {
        Route { path: format!("/{path}"), body: body.to_vec(), claims: None, slow: None }
    }

    /// A release file whose installer is `installer` on the same server (`@PORT@` is filled in as it is served), signed
    /// (it says) as `sig`.
    fn release(version: &str, installer: &str, sig: &str, size: usize) -> Route {
        let entry = serde_json::json!({ "url": format!("http://127.0.0.1:@PORT@/{installer}"), "signature": sig.trim() });
        let body = serde_json::json!({
            "version": version, "pub_date": "2026-11-19T07:00:00Z", "size": size, "notes": "## New\n- x",
            "platforms": { "windows-x86_64": entry, "darwin-aarch64": entry, "darwin-x86_64": entry, "linux-x86_64": entry },
        });
        route("latest.json", body.to_string().as_bytes())
    }

    /// Waits (a few seconds at most) for something a background program does to have happened.
    fn wait_until(what: &str, mut done: impl FnMut() -> bool) {
        let t = Instant::now();
        while t.elapsed() < Duration::from_secs(15) {
            if done() {
                return;
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        panic!("waited for {what}");
    }

    fn files_in(dir: &std::path::Path) -> Vec<String> {
        std::fs::read_dir(dir).map(|d| d.flatten().map(|e| e.file_name().to_string_lossy().to_string()).collect()).unwrap_or_default()
    }

    const NOT_SIGNED: &str = "This update was not installed: it was not signed by Bible Workbench. Nothing was changed.";

    /// Rows 11, 14 and 15: a release is downloaded, its signature checked, the whole file kept, and the installer the
    /// release names is run.
    #[test]
    fn install_downloads_checks_the_signature_and_runs_the_installer() {
        let h = Home::new("install");
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, INSTALLER.len()), route(NAME, INSTALLER)]);
        let feed = srv.url("latest.json");
        assert_eq!(h.run(&["update", "check"], Some(&feed)).0, 0);
        assert_eq!(srv.count(NAME), 0, "a look downloads nothing (U-5)");
        let (code, out, err) = h.run(&["update", "install"], Some(&feed));
        assert_eq!(code, 0, "{out} {err}");
        assert!(out.contains("Bible Workbench 99.0.0 is being installed."), "{out}");
        wait_until("the installer to run", || h.installed_marker().exists());
        assert_eq!(srv.count(NAME), 1);
        // whole and signed: kept beside the app, never in the study folder
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["download"]["state"], "ready");
        assert_eq!(s["download"]["version"], "99.0.0");
        assert!(h.updates().join("download").join(NAME).is_file());
        assert!(!h.dir.join("study").exists());
    }

    /// Row 14: not signed by Bible Workbench (another key, or one byte changed after signing): thrown away, nothing runs,
    /// the words are U-12's, and there is no way to install it anyway.
    #[test]
    fn a_signature_that_does_not_match_is_thrown_away() {
        let mut changed = INSTALLER.to_vec();
        let last = changed.len() - 3;
        changed[last] ^= 1;
        for (name, sig, body) in [("other-key", OTHER_SIG, INSTALLER.to_vec()), ("changed-byte", SIG, changed)] {
            let h = Home::new(&format!("refused-{name}"));
            let srv = Server::start(vec![release("99.0.0", NAME, sig, body.len()), route(NAME, &body)]);
            let (code, out, err) = h.run(&["update", "install"], Some(&srv.url("latest.json")));
            assert_eq!(code, 1, "{name}: {out} {err}");
            assert_eq!(err.trim(), format!("error: {NOT_SIGNED}"), "{name}");
            assert_eq!(srv.count(NAME), 1, "{name}: it was downloaded, then checked");
            assert!(!h.installed_marker().exists(), "{name}: the installer ran");
            assert!(files_in(&h.updates().join("download")).is_empty(), "{name}: the file was not removed");
            let s = json(&h.run(&["update", "status"], None).1);
            assert_eq!(s["download"]["state"], "refused", "{name}");
            assert_eq!(s["failure"], NOT_SIGNED, "{name}");
            // nothing is waiting to be installed, and the refusal is not undone by asking again with nothing served
            let (code, _, _) = h.run(&["update", "install"], None);
            assert_eq!(code, 1, "{name}");
            assert!(!h.installed_marker().exists(), "{name}");
        }
    }

    /// Row 14: a release file naming the version running or an older one, and an installer address that is not HTTPS,
    /// are refused before anything is downloaded.
    #[test]
    fn a_version_that_is_not_newer_or_an_address_that_is_not_https_is_refused() {
        let older = ["0.0.1", wb_core::updates::INSTALLED];
        for version in older {
            let h = Home::new(&format!("notnewer-{version}"));
            let srv = Server::start(vec![release(version, NAME, SIG, INSTALLER.len()), route(NAME, INSTALLER)]);
            let (code, _, err) = h.run(&["update", "install"], Some(&srv.url("latest.json")));
            assert_eq!(code, 1, "{version}");
            assert_eq!(err.trim(), "error: This update was not installed: it is not newer than the version running. Nothing was changed.", "{version}");
            assert_eq!(srv.count(NAME), 0, "{version}: nothing was downloaded");
            assert!(!h.installed_marker().exists());
            assert_eq!(json(&h.run(&["update", "status"], None).1)["download"]["state"], "refused");
        }
        // an installer address that is not HTTPS (and not this computer's own)
        let h = Home::new("not-https");
        let body = serde_json::json!({ "version": "99.0.0", "pub_date": "2026-11-19T07:00:00Z", "size": 5, "notes": "x",
            "platforms": { "windows-x86_64": { "url": "http://example.org/installer.cmd", "signature": SIG.trim() }, "darwin-aarch64": { "url": "http://example.org/installer.cmd", "signature": SIG.trim() },
                           "darwin-x86_64": { "url": "http://example.org/installer.cmd", "signature": SIG.trim() }, "linux-x86_64": { "url": "http://example.org/installer.cmd", "signature": SIG.trim() } } });
        let srv = Server::start(vec![route("latest.json", body.to_string().as_bytes())]);
        let (code, _, err) = h.run(&["update", "install"], Some(&srv.url("latest.json")));
        assert_eq!(code, 1);
        assert_eq!(err.trim(), "error: This update was not installed: its address is not HTTPS. Nothing was changed.");
        assert!(!h.installed_marker().exists());
        assert!(files_in(&h.updates().join("download")).is_empty());
    }

    /// Row 13: a download that stops partway says where, and what still works; the partial file is removed; the gear's
    /// dot shows until Updates is opened; Try again is the same command.
    #[test]
    fn a_download_that_stops_partway_says_where_and_try_again_works() {
        let h = Home::new("cutoff");
        let cut = Route { claims: Some(84_000_000), ..route(NAME, &vec![0u8; 31_000_000]) };
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, 84_000_000), cut]);
        let feed = srv.url("latest.json");
        h.run(&["update", "check"], Some(&feed));
        let (code, _, err) = h.run(&["update", "install"], Some(&feed));
        assert_eq!(code, 1);
        let words = format!("The download of 99.0.0 stopped at 31 of 84 MB. Bible Workbench {} works as it is.", wb_core::updates::INSTALLED);
        assert_eq!(err.trim(), format!("error: {words}"));
        assert!(files_in(&h.updates().join("download")).is_empty(), "the partial file is removed");
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["download"]["state"], "stopped");
        assert_eq!(s["failure"], words.as_str());
        assert!(!h.installed_marker().exists());
        // the dot shows for a failure the person asked for, until Updates is opened (here the version is set aside, so the
        // failure alone is what the dot says)
        h.run(&["update", "skip"], None);
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["dot"], words.as_str());
        let s = json(&h.run(&["update", "status", "--seen"], None).1);
        assert!(s["dot"].is_null(), "{s}");
        // Try again: the same command, now with the whole file
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, INSTALLER.len()), route(NAME, INSTALLER)]);
        let (code, out, err) = h.run(&["update", "install"], Some(&srv.url("latest.json")));
        assert_eq!(code, 0, "{out} {err}");
        wait_until("the installer to run", || h.installed_marker().exists());
    }

    /// Row 12: Stop gives a running download up from another terminal, and the partial file goes.
    #[test]
    fn stop_gives_a_running_download_up_and_removes_the_partial_file() {
        let h = Home::new("stop");
        let slow = Route { slow: Some((4096, 25)), ..route(NAME, &vec![7u8; 400_000]) };
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, 400_000), slow]);
        let feed = srv.url("latest.json");
        let mut child = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(["update", "install"])
            .env("WB_UPDATES_DIR", h.updates())
            .env("WB_STUDY_DIR", h.dir.join("study"))
            .env("WB_CACHE_DIR", h.dir.join("cache"))
            .env("WB_UPDATE_PUBKEY", TEST_KEY.trim())
            .env("WB_UPDATE_FEED", &feed)
            .stderr(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        wait_until("the download to start", || {
            let s = json(&h.run(&["update", "status"], None).1);
            s["download"]["state"] == "downloading" && s["download"]["got"].as_u64().unwrap_or(0) > 0 && s["ring"].is_number()
        });
        assert!(!h.updates().join("download").read_dir().map(|d| d.count() == 0).unwrap_or(true), "a partial file exists while it runs");
        let (code, out, _) = h.run(&["update", "stop"], None);
        assert_eq!(code, 0);
        assert_eq!(out.trim(), "The download was stopped.");
        let done = child.wait().unwrap();
        assert_eq!(done.code(), Some(1));
        assert!(files_in(&h.updates().join("download")).is_empty(), "the partial file is removed");
        let s = json(&h.run(&["update", "status"], None).1);
        assert!(s["download"].is_null() && s["ring"].is_null(), "the dot returns: {s}");
        assert!(!h.installed_marker().exists());
        assert_eq!(h.run(&["update", "stop"], None).1.trim(), "There is no download to stop.");
    }

    /// Row 11: Install returns at once while the download runs; the progress is there to read. Row 18: closing the window
    /// installs what was downloaded, and nothing is installed before that.
    #[test]
    fn install_returns_at_once_and_closing_the_window_installs() {
        let _env = ENV.lock().unwrap_or_else(|e| e.into_inner());
        let h = Home::new("at-once");
        let slow = Route { slow: Some((8192, 20)), ..route(NAME, &vec![0u8; 200_000]) };
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, 200_000), slow]);
        std::env::set_var("WB_UPDATE_FEED", srv.url("latest.json"));
        std::env::set_var("WB_UPDATE_PUBKEY", TEST_KEY.trim());
        std::env::set_var("WB_TEST_INSTALLED", h.installed_marker());
        let u = wb_core::updates::Updates::new(h.updates());
        // a download of 200 KB at 8 KB / 20 ms takes half a second or more: starting it must not wait for it
        let t = Instant::now();
        u.start_download().unwrap();
        assert!(t.elapsed() < Duration::from_millis(250), "Install waited for the download: {:?}", t.elapsed());
        assert_eq!(u.download().unwrap().state, "downloading");
        assert!(u.start_download().unwrap_err().contains("already running"));
        // this signature is for the small script, not 200 KB of zeros: it is refused when it is whole, which is also a
        // download that ran to the end
        wait_until("the download to end", || u.download().is_some_and(|d| d.state != "downloading"));
        assert_eq!(u.download().unwrap().state, "refused");
        // now a whole, signed one
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, INSTALLER.len()), route(NAME, INSTALLER)]);
        std::env::set_var("WB_UPDATE_FEED", srv.url("latest.json"));
        u.start_download().unwrap();
        wait_until("the download to be ready", || u.download().is_some_and(|d| d.state == "ready"));
        // Install does not install: nothing ran
        assert!(!h.installed_marker().exists());
        assert!(u.ready_installer().is_some());
        // closing the window installs it
        let said = u.install_on_close().unwrap().unwrap();
        assert!(said.contains("99.0.0"), "{said}");
        wait_until("the installer to run", || h.installed_marker().exists());
        // with nothing downloaded, closing the window installs nothing
        let none = wb_core::updates::Updates::new(h.dir.join("elsewhere"));
        assert!(none.install_on_close().is_none());
        for k in ["WB_UPDATE_FEED", "WB_UPDATE_PUBKEY", "WB_TEST_INSTALLED"] {
            std::env::remove_var(k);
        }
    }

    /// Rows 16 and 18, the terminal's side: with the window open, `wb update install` asks the window (as `wb do` does)
    /// and prints what it said; with no window it installs at once.
    #[test]
    fn with_the_window_open_install_asks_the_window() {
        let _env = ENV.lock().unwrap_or_else(|e| e.into_inner());
        let h = Home::new("relay");
        std::env::set_var("WB_CACHE_DIR", h.dir.join("cache"));
        let (listener, token) = wb_core::relay::listen(&h.dir.join("study")).unwrap();
        let lines: Arc<Mutex<Vec<String>>> = Arc::default();
        let seen = lines.clone();
        std::thread::spawn(move || {
            for (n, stream) in listener.incoming().take(3).enumerate() {
                let stream = stream.unwrap();
                let (line, _) = wb_core::relay::read_request(&stream, &token).unwrap();
                seen.lock().unwrap().push(line);
                let reply = if n < 2 { serde_json::json!({"ok": true, "said": "Restarting into 99.0.0"}) } else { serde_json::json!({"ok": false, "error": "Phinehas could not be saved, so Bible Workbench was not restarted"}) };
                wb_core::relay::answer(&stream, &reply);
            }
        });
        let (code, out, err) = h.run(&["update", "install"], None);
        assert_eq!((code, out.trim(), err.trim()), (0, "Restarting into 99.0.0", ""));
        let (code, out, _) = h.run(&["update", "install", "--when-closed"], None);
        assert_eq!((code, out.trim()), (0, "Restarting into 99.0.0"));
        let (code, _, err) = h.run(&["update", "install"], None);
        assert_eq!(code, 1);
        assert!(err.contains("Phinehas could not be saved, so Bible Workbench was not restarted"), "{err}");
        assert_eq!(*lines.lock().unwrap(), ["update install", "update install --when-closed", "update install"]);
        std::env::remove_var("WB_CACHE_DIR");
    }

    /// Row 18: closing the window installs and the next opening is the new version; row 19: it says "updated from".
    /// An installer that ran but left the version as it was is said so on the next opening, with Try again.
    #[test]
    fn an_install_that_does_not_finish_is_said_and_one_that_does_is_remembered() {
        let h = Home::new("settle");
        let srv = Server::start(vec![release("99.0.0", NAME, SIG, INSTALLER.len()), route(NAME, INSTALLER)]);
        let (code, out, err) = h.run(&["update", "install", "--when-closed"], Some(&srv.url("latest.json")));
        assert_eq!(code, 0, "{out} {err}");
        wait_until("the installer to run", || h.installed_marker().exists());
        // the test installer changes nothing: this opening is still the old version
        let u = wb_core::updates::Updates::new(h.updates());
        u.settle();
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["failure"], "This update was not installed: the installer did not finish. Nothing was changed.");
        assert_eq!(s["download"]["state"], "stopped");
        assert_eq!(s["dot"], s["failure"]);
        assert!(s["updated"].is_null());
        assert!(files_in(&h.updates().join("download")).is_empty());
        // an installer that did change the version: the record names the version now running
        let state = h.updates().join("state.json");
        let me = wb_core::updates::INSTALLED;
        std::fs::write(&state, serde_json::json!({ "installing": { "from": "0.0.9", "to": me, "restart": true, "at": "2026-11-19T09:00:00Z" } }).to_string()).unwrap();
        u.settle();
        let s = json(&h.run(&["update", "status"], None).1);
        assert_eq!(s["updated"]["from"], "0.0.9");
        assert_eq!(s["updated"]["on"], "2026-11-19");
        assert!(s["failure"].is_null() && s["dot"].is_null());
        // its notes read offline
        let (code, out, _) = h.run(&["update", "notes", me], Some("http://127.0.0.1:9/latest.json"));
        assert_eq!(code, 0);
        assert!(out.contains("Your study folder"), "{out}");
    }
}
