//! Derived data kept between runs: the search index and the word offsets `near` uses, worked out from the Bible database
//! once and kept in the user's cache folder, named by the database file's size and time, so a rebuilt database gets new
//! ones. Everything here can be deleted at any time; it is rebuilt when missing (SPEC: every derived index can be
//! rebuilt). Never written next to the database itself, which is read-only.

use std::fs;
use std::path::PathBuf;

/// `WB_CACHE_DIR`, else the platform's per-user cache folder.
pub fn dir() -> PathBuf {
    if let Ok(d) = std::env::var("WB_CACHE_DIR") {
        return PathBuf::from(d);
    }
    let base = crate::platform::local_data_dir()
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".cache")))
        .unwrap_or_else(std::env::temp_dir);
    base.join("bible-workbench-rs").join("cache")
}

fn path(name: &str, sig: &str) -> PathBuf {
    dir().join(format!("{name}-{sig}.bin"))
}

pub fn read(name: &str, sig: &str) -> Option<Vec<u8>> {
    fs::read(path(name, sig)).ok()
}

/// Keeps the bytes (best effort: a cache that cannot be written is only slower), and removes older versions.
pub fn write(name: &str, sig: &str, bytes: &[u8]) {
    let d = dir();
    if fs::create_dir_all(&d).is_err() {
        return;
    }
    if let Ok(rd) = fs::read_dir(&d) {
        for e in rd.flatten() {
            let f = e.file_name().to_string_lossy().into_owned();
            if f.starts_with(&format!("{name}-")) && f.ends_with(".bin") {
                let _ = fs::remove_file(e.path());
            }
        }
    }
    let p = path(name, sig);
    let tmp = p.with_extension("tmp");
    if fs::write(&tmp, bytes).is_ok() {
        let _ = fs::rename(&tmp, &p);
    }
}

/// A plain binary layout: little-endian u32s and length-prefixed strings.
#[derive(Default)]
pub struct Out(pub Vec<u8>);

impl Out {
    pub fn u32(&mut self, n: u32) {
        self.0.extend(n.to_le_bytes());
    }
    pub fn str(&mut self, s: &str) {
        self.u32(s.len() as u32);
        self.0.extend(s.as_bytes());
    }
}

pub struct In<'a> {
    b: &'a [u8],
    at: usize,
}

impl<'a> In<'a> {
    pub fn new(b: &'a [u8]) -> In<'a> {
        In { b, at: 0 }
    }
    pub fn u32(&mut self) -> Option<u32> {
        let v = u32::from_le_bytes(self.b.get(self.at..self.at + 4)?.try_into().ok()?);
        self.at += 4;
        Some(v)
    }
    pub fn str(&mut self) -> Option<String> {
        let n = self.u32()? as usize;
        let s = std::str::from_utf8(self.b.get(self.at..self.at + n)?)
            .ok()?
            .to_string();
        self.at += n;
        Some(s)
    }
    pub fn done(&self) -> bool {
        self.at == self.b.len()
    }
}
