//! `wb do`: lines for the capture box, sent from a terminal to the running desktop app over a local socket (docs/PLAN.md
//! section 2.2; the Python app used an HTTP long-poll).
//!
//! The app listens on a loopback TCP port chosen by the system and writes `{port, token, pid, study}` to `app.json` in
//! the cache folder. A request is one line of JSON, `{"token": ..., "line": ..., "wait_ms": ...}`; the answer is one line
//! of JSON: what the window did with the line (`{"ok": true, "said": ...}` or `{"ok": false, "error": ...}`). The token
//! keeps other programs on the computer from typing into the window; only connections from this computer are accepted.

use crate::{Error, Result};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

pub fn address_file() -> PathBuf {
    crate::cache::dir().join("app.json")
}

fn token() -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut out = String::new();
    for k in 0..2u32 {
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos());
        h.write_u32(std::process::id() ^ k);
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

/// The app's side: a listener on the loopback, announced in `app.json`. → the listener and its token.
pub fn listen(study: &std::path::Path) -> Result<(TcpListener, String)> {
    let l = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    let t = token();
    let info = json!({"port": l.local_addr()?.port(), "token": t, "pid": std::process::id(), "study": study.display().to_string()});
    let f = address_file();
    std::fs::create_dir_all(f.parent().unwrap())?;
    crate::store::write_atomic(&f, &info.to_string())?;
    Ok((l, t))
}

/// The app's side: one request off a connection. → the line and how long the sender will wait, or None for a request
/// without the right token.
pub fn read_request(stream: &TcpStream, token: &str) -> Option<(String, u64)> {
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let mut line = String::new();
    BufReader::new(stream).read_line(&mut line).ok()?;
    let v: Value = serde_json::from_str(&line).ok()?;
    if v["token"].as_str() != Some(token) {
        return None;
    }
    Some((v["line"].as_str()?.to_string(), v["wait_ms"].as_u64().unwrap_or(10_000)))
}

pub fn answer(mut stream: &TcpStream, v: &Value) {
    let _ = stream.write_all(format!("{v}\n").as_bytes());
}

/// `wb do`'s side: send a line to the running app and wait (at most `wait`) for what it did.
pub fn send(line: &str, wait: Duration) -> Result<Value> {
    let none = || Error("The app is not running (start it, then try again). wb do sends lines to the open window.".into());
    let info: Value = std::fs::read_to_string(address_file()).ok().and_then(|t| serde_json::from_str(&t).ok()).ok_or_else(none)?;
    let port = info["port"].as_u64().ok_or_else(none)? as u16;
    let mut s = TcpStream::connect_timeout(&(Ipv4Addr::LOCALHOST, port).into(), Duration::from_secs(2)).map_err(|_| none())?;
    s.set_read_timeout(Some(wait + Duration::from_secs(1)))?;
    s.write_all(format!("{}\n", json!({"token": info["token"], "line": line, "wait_ms": wait.as_millis() as u64})).as_bytes())?;
    let mut reply = String::new();
    BufReader::new(&s).read_line(&mut reply).map_err(|_| Error("The app took the line but did not answer in time.".into()))?;
    serde_json::from_str(&reply).map_err(|_| Error("The app's answer could not be read.".into()))
}
