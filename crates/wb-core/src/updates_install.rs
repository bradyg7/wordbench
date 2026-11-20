//! Installing (design/features/updates, tickets UP4 and UP5, rows 11 to 19): the download that runs in the background,
//! its signature checked against the key compiled into the program, the refusals, Stop, and the installer. What this
//! keeps lives beside the app (`download.json`, the `download` folder, a `stop` file), never in the study folder (U-15).
//!
//! Nothing is downloaded until the person says Install (U-5). A download whose signature does not match is thrown away,
//! and there is no way to install it anyway (U-12). The installer is the same file the release page offers (U-17).

use crate::updates::{self, fetch_feed, newer_than, parse_feed, size_text, Updates, INSTALLED};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

/// What a refused update says (U-12); `why` is the reason in a few words, ending in a full stop.
pub fn refused_line(why: &str) -> String {
    format!("This update was not installed: {why} Nothing was changed.")
}

/// The signature did not match.
pub const NOT_SIGNED: &str = "it was not signed by Bible Workbench.";

/// The line for a download that stopped partway (U-11): "stopped at 31 of 84 MB".
pub fn stopped_line(version: &str, got: u64, total: u64) -> String {
    let unit = |n: u64| if total >= 1_000_000 { format!("{}", (n as f64 / 1_000_000.0).floor() as u64) } else { format!("{}", n / 1_000) };
    let name = if total >= 1_000_000 { "MB" } else { "KB" };
    let of = if total > 0 { format!("{} of {} {name}", unit(got), unit(total)) } else { format!("{} {name}", unit(got)) };
    format!("The download of {version} stopped at {of}. Bible Workbench {INSTALLED} works as it is.")
}

/// A download state that has not moved for this long is taken to be a download that died with its program.
const STALE_SECONDS: i64 = 60;

fn platform_key() -> &'static str {
    if cfg!(all(windows, target_arch = "x86_64")) {
        "windows-x86_64"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "darwin-aarch64"
    } else if cfg!(target_os = "macos") {
        "darwin-x86_64"
    } else {
        "linux-x86_64"
    }
}

/// The installer this release offers for this computer: its address and its signature, from the release file.
pub fn parse_platform(text: &str) -> Option<(String, String)> {
    let v: Value = serde_json::from_str(text).ok()?;
    let p = v.get("platforms")?.get(platform_key())?;
    Some((p.get("url")?.as_str()?.to_string(), p.get("signature")?.as_str()?.trim().to_string()))
}

/// The key updates are signed with: the public half compiled into the program from the release configuration (U-17). A
/// test names its own with `WB_UPDATE_PUBKEY`, and only while `WB_UPDATE_FEED` names a test release: a copy that asks the
/// real address always uses the compiled key.
fn public_key() -> String {
    let test_release = std::env::var("WB_UPDATE_FEED").is_ok_and(|s| !s.trim().is_empty());
    match std::env::var("WB_UPDATE_PUBKEY") {
        Ok(k) if test_release && !k.trim().is_empty() => k.trim().to_string(),
        _ => include_str!(concat!(env!("OUT_DIR"), "/update-pubkey.txt")).trim().to_string(),
    }
}

/// Whether `data` carries `signature` made with the key `pubkey` (both as tauri writes them: the base64 of a minisign file).
#[cfg(not(feature = "updater"))]
pub fn verify(_: &[u8], _: &str, _: &str) -> bool {
    false
}

/// Whether `data` carries `signature` made with the key `pubkey` (both as tauri writes them: the base64 of a minisign file).
#[cfg(feature = "updater")]
pub fn verify(data: &[u8], signature: &str, pubkey: &str) -> bool {
    use base64::Engine;
    let text = |s: &str| base64::engine::general_purpose::STANDARD.decode(s.trim()).ok().and_then(|b| String::from_utf8(b).ok());
    let (Some(k), Some(s)) = (text(pubkey), text(signature)) else { return false };
    let (Ok(key), Ok(sig)) = (minisign_verify::PublicKey::decode(&k), minisign_verify::Signature::decode(&s)) else { return false };
    key.verify(data, &sig, true).is_ok()
}

/// What the download is doing, as `download.json` keeps it.
#[derive(Clone, PartialEq, Debug)]
pub struct Download {
    pub version: String,
    /// `downloading`, `ready` (whole and signed), `stopped` or `refused`.
    pub state: String,
    pub got: u64,
    pub total: u64,
    pub message: String,
    /// The installer's file name in the `download` folder, once it is whole.
    pub file: String,
    /// The signature the release file gave for this installer, kept so the file is checked again before it is run.
    pub sig: String,
    /// Whether the person has opened the Updates section since a failure (the gear's dot goes then).
    pub seen: bool,
}

impl Download {
    pub fn to_json(&self) -> Value {
        json!({
            "version": self.version, "state": self.state, "got": self.got, "total": self.total,
            "got_text": size_text(self.got), "total_text": size_text(self.total),
            "fraction": if self.total > 0 { (self.got as f64 / self.total as f64).min(1.0) } else { 0.0 },
            "message": self.message, "file": self.file, "seen": self.seen,
        })
    }
}

enum Fail {
    Stopped,
    Words(String),
}

fn words(s: impl Into<String>) -> Fail {
    Fail::Words(s.into())
}

impl Updates {
    fn download_file(&self) -> PathBuf {
        self.dir().join("download.json")
    }
    fn download_dir(&self) -> PathBuf {
        self.dir().join("download")
    }
    fn stop_file(&self) -> PathBuf {
        self.dir().join("stop")
    }

    fn put_download(&self, d: &Download) {
        let _ = fs::create_dir_all(self.dir());
        let mut v = d.to_json();
        v["sig"] = json!(d.sig);
        v["seen"] = json!(d.seen);
        v["at"] = json!(Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
        let tmp = self.dir().join("download.json.tmp");
        if fs::write(&tmp, v.to_string()).is_ok() {
            let _ = fs::rename(&tmp, self.download_file());
        }
    }

    /// The download as it stands: None when there is none. A download that says it is running but has not moved in a
    /// minute died with its program, and is said to have stopped.
    pub fn download(&self) -> Option<Download> {
        let v: Value = serde_json::from_str(&fs::read_to_string(self.download_file()).ok()?).ok()?;
        let s = |k: &str| v.get(k).and_then(Value::as_str).unwrap_or("").to_string();
        let n = |k: &str| v.get(k).and_then(Value::as_u64).unwrap_or(0);
        // a download of a version that is now the one running (or older) is over
        if matches!(s("state").as_str(), "ready" | "downloading") && !s("version").is_empty() && !newer_than(&s("version"), INSTALLED) {
            return None;
        }
        let mut d = Download { version: s("version"), state: s("state"), got: n("got"), total: n("total"), message: s("message"), file: s("file"), sig: s("sig"), seen: v.get("seen").and_then(Value::as_bool).unwrap_or(false) };
        if d.state == "downloading" {
            let at = v.get("at").and_then(Value::as_str).and_then(|t| DateTime::parse_from_rfc3339(t).ok()).map(|t| t.with_timezone(&Utc));
            if at.is_none_or(|t| (Utc::now() - t).num_seconds() > STALE_SECONDS) {
                d.state = "stopped".into();
                d.message = stopped_line(&d.version, d.got, d.total);
            }
        }
        if d.state == "ready" && !self.download_dir().join(&d.file).is_file() {
            return None;
        }
        Some(d)
    }

    /// The installer that is whole and signed, waiting for a restart.
    pub fn ready_installer(&self) -> Option<(Download, PathBuf)> {
        let d = self.download().filter(|d| d.state == "ready")?;
        let p = self.download_dir().join(&d.file);
        Some((d, p))
    }

    /// A failure the person had asked for (an install that did not finish): said in the section, with Try again.
    pub(crate) fn put_failure(&self, version: &str, message: &str) {
        self.put_download(&Download { version: version.into(), state: "stopped".into(), got: 0, total: 0, message: message.into(), file: String::new(), sig: String::new(), seen: false });
    }

    /// The section was opened: a failure's dot goes.
    pub(crate) fn seen_download(&self) {
        if let Some(mut d) = self.download() {
            if !d.seen {
                d.seen = true;
                self.put_download(&d);
            }
        }
    }

    /// Takes away everything a download left: the file, the partial file, the state.
    pub fn clear_download(&self) {
        let _ = fs::remove_dir_all(self.download_dir());
        let _ = fs::remove_file(self.download_file());
        let _ = fs::remove_file(self.stop_file());
    }

    /// Install, step one (U-7): the download starts in the background and this returns at once. The window reads
    /// `wb update status` for how far it has come.
    pub fn start_download(&self) -> Result<(), String> {
        if !updates::updates_itself() {
            return Err(updates::source_line());
        }
        if self.download().is_some_and(|d| d.state == "downloading") {
            return Err("A download is already running.".into());
        }
        let version = self.newer().map(|f| f.version).unwrap_or_default();
        let _ = fs::remove_file(self.stop_file());
        self.put_download(&Download { version, state: "downloading".into(), got: 0, total: 0, message: String::new(), file: String::new(), sig: String::new(), seen: false });
        let me = Updates::new(self.dir());
        std::thread::spawn(move || {
            let _ = me.download_now();
        });
        Ok(())
    }

    /// Install, step one, waiting for it (a terminal): the download, its signature checked, kept in the `download` folder.
    /// An Err is the words for the person, already kept for the section to say.
    pub fn download_now(&self) -> Result<PathBuf, String> {
        match self.fetch_installer() {
            Ok(p) => Ok(p),
            Err(Fail::Stopped) => Err("The download was stopped.".into()),
            Err(Fail::Words(w)) => Err(w),
        }
    }

    fn fetch_installer(&self) -> Result<PathBuf, Fail> {
        let current = self.download().filter(|d| d.state == "downloading");
        let mut d = current.unwrap_or(Download { version: String::new(), state: "downloading".into(), got: 0, total: 0, message: String::new(), file: String::new(), sig: String::new(), seen: false });
        let _ = fs::remove_file(self.stop_file());
        d.state = "downloading".into();
        d.got = 0;
        self.put_download(&d);
        let refuse = |me: &Updates, d: &mut Download, why: &str| -> Fail {
            let _ = fs::remove_dir_all(me.download_dir());
            d.state = "refused".into();
            d.message = refused_line(why);
            me.put_download(d);
            words(d.message.clone())
        };

        // the release file, once more, for the installer's address and signature
        let text = match fetch_feed() {
            Ok(t) => t,
            Err(e) => {
                d.state = "stopped".into();
                d.message = e.clone();
                self.put_download(&d);
                return Err(words(e));
            }
        };
        let found = parse_feed(&text).map_err(Fail::Words)?;
        d.version = found.version.clone();
        if !newer_than(&found.version, INSTALLED) {
            return Err(refuse(self, &mut d, "it is not newer than the version running."));
        }
        let Some((url, signature)) = parse_platform(&text) else {
            return Err(refuse(self, &mut d, "the release has no installer for this computer."));
        };
        if updates::check_installer_address(&url).is_err() {
            return Err(refuse(self, &mut d, "its address is not HTTPS."));
        }
        d.total = found.size;
        self.put_download(&d);

        let dir = self.download_dir();
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).map_err(|e| words(e.to_string()))?;
        let name = installer_name(&url, &found.version);
        let part = dir.join(format!("{name}.part"));
        if let Err(f) = self.copy_down(&url, &part, &mut d) {
            let _ = fs::remove_file(&part);
            match &f {
                Fail::Stopped => {
                    let _ = fs::remove_dir_all(&dir);
                    let _ = fs::remove_file(self.download_file());
                    let _ = fs::remove_file(self.stop_file());
                }
                Fail::Words(w) => {
                    d.state = "stopped".into();
                    d.message = w.clone();
                    self.put_download(&d);
                }
            }
            return Err(f);
        }
        // whole: is it the file Bible Workbench signed?
        let bytes = fs::read(&part).map_err(|e| words(e.to_string()))?;
        if !verify(&bytes, &signature, &public_key()) {
            let _ = fs::remove_file(&part);
            return Err(refuse(self, &mut d, NOT_SIGNED));
        }
        let whole = dir.join(&name);
        fs::rename(&part, &whole).map_err(|e| words(e.to_string()))?;
        d.state = "ready".into();
        d.file = name;
        d.sig = signature;
        d.got = bytes.len() as u64;
        d.total = d.total.max(d.got);
        d.message = String::new();
        self.put_download(&d);
        Ok(whole)
    }

    /// The bytes at `url` into `part`, with the progress kept as it comes. A stop request ends it.
    fn copy_down(&self, url: &str, part: &std::path::Path, d: &mut Download) -> Result<(), Fail> {
        use std::io::{Read, Write};
        let mut out = fs::File::create(part).map_err(|e| words(e.to_string()))?;
        let stopped_here = |d: &Download| words(stopped_line(&d.version, d.got, d.total));
        let lower = url.to_lowercase();
        let mut reader: Box<dyn Read> = if lower.contains("://") && !lower.starts_with("file://") {
            http_reader(url, d)?
        } else {
            let path = url.strip_prefix("file:///").or_else(|| url.strip_prefix("file://")).unwrap_or(url);
            let f = fs::File::open(path).map_err(|_| words(stopped_line(&d.version, 0, d.total)))?;
            d.total = f.metadata().map(|m| m.len()).unwrap_or(d.total);
            Box::new(f)
        };
        let mut buf = vec![0u8; 64 * 1024];
        let mut last = std::time::Instant::now();
        loop {
            if self.stop_file().exists() {
                return Err(Fail::Stopped);
            }
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    out.write_all(&buf[..n]).map_err(|e| words(e.to_string()))?;
                    d.got += n as u64;
                    if last.elapsed() >= std::time::Duration::from_millis(100) {
                        self.put_download(d);
                        last = std::time::Instant::now();
                    }
                }
                Err(_) => return Err(stopped_here(d)),
            }
        }
        out.flush().map_err(|e| words(e.to_string()))?;
        if d.total > 0 && d.got < d.total {
            return Err(stopped_here(d));
        }
        Ok(())
    }

    /// Stop (U-7): a download is given up and its partial file removed; a whole download that is waiting for a restart is
    /// given up too, and its file removed.
    pub fn stop(&self) -> Result<String, String> {
        let Some(d) = self.download() else { return Ok("There is no download to stop.".into()) };
        if d.state == "downloading" {
            fs::write(self.stop_file(), "stop").map_err(|e| e.to_string())?;
            // the downloader takes the request at its next piece; wait for it to say so
            for _ in 0..100 {
                if self.download().is_none() || !self.stop_file().exists() {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            if self.stop_file().exists() {
                // nothing is running (it died with its program)
                self.clear_download();
            }
            return Ok("The download was stopped.".into());
        }
        self.clear_download();
        Ok("The download was given up, and its file removed.".into())
    }

    /// Install, step two: the installer that is whole and signed is run. It replaces program files only. `restart`: the
    /// installer opens the app again when it is done (Restart now); without it the new version waits for the next opening
    /// (When I close the app). What is run is checked once more: the file must still carry its signature.
    pub fn run_installer(&self, restart: bool) -> Result<String, String> {
        let (d, path) = self.ready_installer().ok_or("There is no update downloaded yet. Install it first.")?;
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        if !verify(&bytes, &d.sig, &public_key()) {
            self.clear_download();
            return Err(refused_line(NOT_SIGNED));
        }
        if !newer_than(&d.version, INSTALLED) {
            return Err(refused_line("it is not newer than the version running."));
        }
        self.keep_before();
        self.note_installing(&d.version, restart)?;
        spawn_installer(&path, restart)?;
        Ok(format!("Bible Workbench {} is being installed.", d.version))
    }

    /// When the window closes with an update downloaded, it is installed (U-7: doing neither is the same as When I close
    /// the app). None when there is nothing downloaded.
    pub fn install_on_close(&self) -> Option<Result<String, String>> {
        let (d, _) = self.ready_installer()?;
        // Restart now has already run it: the installer is not run twice
        if self.installing_version().is_some_and(|v| v == d.version) {
            return None;
        }
        Some(self.run_installer(false))
    }

    /// Installs at once, as a terminal does with no window open: the download if there is none yet, then the installer.
    pub fn install_now(&self, restart: bool) -> Result<String, String> {
        if self.ready_installer().is_none() {
            self.download_now()?;
        }
        self.run_installer(restart)
    }

    /// Kept before the installer runs: which version was running and which is being installed, so that the next opening
    /// can say what happened (UP5).
    fn note_installing(&self, to: &str, restart: bool) -> Result<(), String> {
        self.set_installing(to, restart)
    }
}

#[cfg(feature = "updater")]
fn http_reader(url: &str, d: &mut Download) -> Result<Box<dyn std::io::Read>, Fail> {
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(None).timeout_connect(Some(std::time::Duration::from_secs(15))).build().into();
    let resp = agent.get(url).call().map_err(|_| words(stopped_line(&d.version, 0, d.total)))?;
    if let Some(n) = resp.body().content_length() {
        d.total = n;
    }
    Ok(Box::new(resp.into_body().into_with_config().limit(u64::MAX).reader()))
}

#[cfg(not(feature = "updater"))]
fn http_reader(_: &str, _: &mut Download) -> Result<Box<dyn std::io::Read>, Fail> {
    Err(words(updates::source_line()))
}

/// The folder the program runs from: `WB_APP_DIR`, else where the running program is.
pub fn app_dir() -> Option<PathBuf> {
    match std::env::var("WB_APP_DIR") {
        Ok(p) if !p.trim().is_empty() => Some(PathBuf::from(p)),
        _ => std::env::current_exe().ok().and_then(|e| e.parent().map(|p| p.to_path_buf())),
    }
}

/// Why going back is not offered when the notes of the version running say the study folder changed (U-13).
pub fn back_refusal(installed_notes: &str, before: &str) -> Option<String> {
    let p = crate::updates_notes::parts(installed_notes);
    if p.study_unchanged() {
        return None;
    }
    let line = if p.study.is_empty() { "says nothing about it".to_string() } else { format!("say “{}”", p.study.join(" ")) };
    Some(format!("Going back to {before} is not offered: the notes of Bible Workbench {INSTALLED} {line}, so your study folder may have been moved forward."))
}

impl Updates {
    fn before_dir(&self) -> PathBuf {
        self.dir().join("before")
    }

    /// The version before, kept once (U-13): the program files beside the app, copied before the installer replaces them.
    /// The Bible database and everything in a folder are not part of it. A copy that could not be made is not kept at all.
    pub(crate) fn keep_before(&self) {
        let dest = self.before_dir();
        let _ = fs::remove_dir_all(&dest);
        let Some(app) = app_dir() else { return };
        let files = dest.join(INSTALLED);
        let kept = (|| -> std::io::Result<()> {
            fs::create_dir_all(&files)?;
            for e in fs::read_dir(&app)? {
                let e = e?;
                if e.file_type()?.is_file() {
                    fs::copy(e.path(), files.join(e.file_name()))?;
                }
            }
            fs::write(dest.join("before.json"), json!({ "version": INSTALLED, "at": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true) }).to_string())
        })();
        if kept.is_err() {
            let _ = fs::remove_dir_all(&dest);
        }
    }

    /// The version kept before, if one is.
    pub fn before(&self) -> Option<String> {
        let v: Value = serde_json::from_str(&fs::read_to_string(self.before_dir().join("before.json")).ok()?).ok()?;
        let version = v.get("version")?.as_str()?.to_string();
        (self.before_dir().join(&version).is_dir() && !updates::version_parts(&version).is_none() && version != INSTALLED).then_some(version)
    }

    /// Whether Go back is offered, and if not, why (U-13). Ok(version) when it is.
    pub fn back_offer(&self) -> Result<String, String> {
        if !updates::updates_itself() {
            return Err(updates::source_line());
        }
        let Some(v) = self.before() else { return Err("There is no earlier version kept. Going back is offered after an update.".into()) };
        match back_refusal(crate::updates_notes::installed_notes(), &v) {
            Some(why) => Err(why),
            None => Ok(v),
        }
    }

    /// `wb update back`: puts the version before back (the program files only; the study folder is not touched). It takes
    /// effect when the app is opened again.
    pub fn go_back(&self) -> Result<String, String> {
        let v = self.back_offer()?;
        let app = app_dir().ok_or("The folder the program runs from is not known.")?;
        let from = self.before_dir().join(&v);
        for e in fs::read_dir(&from).map_err(|e| e.to_string())? {
            let e = e.map_err(|e| e.to_string())?;
            let to = app.join(e.file_name());
            if fs::copy(e.path(), &to).is_err() {
                // a program that is running cannot be written over, but it can be renamed out of the way
                let aside = app.join(format!("{}.old", e.file_name().to_string_lossy()));
                let _ = fs::remove_file(&aside);
                fs::rename(&to, &aside).map_err(|e| format!("Bible Workbench {v} could not be put back ({e}). Nothing was changed."))?;
                fs::copy(e.path(), &to).map_err(|e| format!("Bible Workbench {v} could not be put back ({e})."))?;
            }
        }
        self.forget_update();
        Ok(format!("Bible Workbench {v} is back. It opens when the app is started again."))
    }

    /// After going back the update is not the one running, and the version kept is used up.
    fn forget_update(&self) {
        let _ = fs::remove_dir_all(self.before_dir());
        self.clear_download();
        self.drop_installing();
    }

    /// Takes away what a restore left (programs renamed out of the way) once they can be.
    pub fn sweep_old(&self) {
        let Some(app) = app_dir() else { return };
        if let Ok(d) = fs::read_dir(app) {
            for e in d.flatten() {
                if e.file_name().to_string_lossy().ends_with(".old") {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
    }
}

/// The file name the installer is kept under: the last piece of its address.
fn installer_name(url: &str, version: &str) -> String {
    let last = url.split(['?', '#']).next().unwrap_or("").rsplit(['/', '\\']).next().unwrap_or("");
    let clean: String = last.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')).collect();
    if clean.is_empty() || clean.starts_with('.') {
        format!("update-{version}")
    } else {
        clean
    }
}

#[cfg(windows)]
fn spawn_installer(path: &std::path::Path, restart: bool) -> Result<(), String> {
    // As the update plugin runs the installer: passive (a small progress window), as an update, and the app opened again.
    let mut args = vec!["/P", "/UPDATE"];
    if restart {
        args.push("/R");
    }
    std::process::Command::new(path).args(args).spawn().map(|_| ()).map_err(|e| refused_line(&format!("the installer could not be started ({e}).")))
}

#[cfg(not(windows))]
fn spawn_installer(path: &std::path::Path, restart: bool) -> Result<(), String> {
    if cfg!(test) || std::env::var("WB_UPDATE_FEED").is_ok() {
        // a test release carries a script; a real release's Mac and Linux files are not installers this build runs
        std::process::Command::new("sh").arg(path).arg(if restart { "/R" } else { "/P" }).spawn().map(|_| ()).map_err(|e| refused_line(&format!("the installer could not be started ({e}).")))
    } else {
        Err(refused_line("installing from the window is built for Windows only."))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// U-13: going back is offered only when the release's own words say nothing in the study folder changed.
    #[test]
    fn going_back_is_not_offered_when_the_notes_say_the_study_folder_changed() {
        assert!(back_refusal("## Your study folder\nNothing changes in your study folder.", "0.2.4").is_none());
        let why = back_refusal("## Your study folder\nYour pages are moved into a new form.", "0.2.4").unwrap();
        assert!(why.starts_with("Going back to 0.2.4 is not offered") && why.contains("moved into a new form"), "{why}");
        // no line at all is not a promise that nothing changed
        assert!(back_refusal("## New\n- x", "0.2.4").is_some());
        assert!(back_refusal("## Your study folder\nNothing is moved forward, nothing changes... but moved forward later", "0.2.4").is_some());
    }

    #[test]
    fn a_stopped_download_is_said_in_megabytes() {
        let s = stopped_line("0.3.0", 31_000_000, 84_000_000);
        assert!(s.starts_with("The download of 0.3.0 stopped at 31 of 84 MB. Bible Workbench "), "{s}");
    }
}
