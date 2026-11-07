//! The study folder, read and written in the Python app's formats (`workbench/study.py`), so both apps can open it:
//!
//! ```text
//! notes/<CODE>/<id>.md      one note per file (notes about an original word live in notes/_words/)
//! notes/_inbox/<id>.md      the Notebook's notes with no place yet (new in the Rust app; the Python app skips them,
//!                           as it skips any note without an anchor)
//! notes/_days/<day>.md      today's page: one note per day, no anchor (new in the Rust app; skipped the same way)
//! highlights/<CODE>.json    colored anchors, one file per book
//! threads/<slug>.md         a named set of anchors with the person's note
//! trails/<id>.md            questions waiting to be followed up
//! sets/<slug>.md            a named group of threads, places, notes, lessons, PDFs and panes
//! settings/palette.json     saved custom colors; settings/<part>.json the window's settings, per key (new)
//! sessions/<day>.jsonl      what was typed into the capture box, by day; sessions/layouts/*.json pane layouts
//! .trash/                   anything deleted is moved here; only notes and questions are erased, after TRASH_DAYS
//!                           or at once with Erase now
//! ```
//!
//! Records are JSON objects with their keys in the order the files have them, as the Python app holds them in dicts.
//! A `Store` reads the folder when it is opened (a `wb` command opens one each run).

use crate::anchors;
use crate::{Error, Result};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub type Rec = Map<String, Value>;

pub const COLORS: &[&str] = &["yellow", "green", "blue", "pink", "orange"];
pub const PALETTE_MAX: usize = 8;
pub const ANCHORS_MARK: &str = "<!-- anchors -->";
pub const SET_KINDS: &[&str] = &["pane", "thread", "place", "note", "lesson", "pdf"];

/// A request the person can fix (the Python app's BadStudy, sent with status 400).
pub fn bad(msg: impl Into<String>) -> Error {
    Error(msg.into())
}

/// Something asked for that does not exist (Missing, status 404). The message is the same kind of plain sentence.
pub fn missing(msg: impl Into<String>) -> Error {
    Error(msg.into())
}

pub fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn random_hex(bytes: usize) -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos());
    h.write_u32(std::process::id());
    format!("{:016x}", h.finish())[..bytes * 2].to_string()
}

pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}_{}", chrono::Utc::now().format("%Y%m%d%H%M%S"), random_hex(2))
}

// ---- the files' text forms ------------------------------------------------------------------------------------------

/// `json.dumps(v, ensure_ascii=False)`: Python's separators, ", " and ": ".
pub fn py_dumps(v: &Value) -> String {
    struct Py;
    impl serde_json::ser::Formatter for Py {
        fn begin_array_value<W: ?Sized + std::io::Write>(&mut self, w: &mut W, first: bool) -> std::io::Result<()> {
            if first { Ok(()) } else { w.write_all(b", ") }
        }
        fn begin_object_key<W: ?Sized + std::io::Write>(&mut self, w: &mut W, first: bool) -> std::io::Result<()> {
            if first { Ok(()) } else { w.write_all(b", ") }
        }
        fn begin_object_value<W: ?Sized + std::io::Write>(&mut self, w: &mut W) -> std::io::Result<()> {
            w.write_all(b": ")
        }
    }
    let mut buf = Vec::new();
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, Py);
    serde::Serialize::serialize(v, &mut ser).unwrap();
    String::from_utf8(buf).unwrap()
}

/// `json.dumps(v, ensure_ascii=False, indent=1)`.
pub fn py_dumps_indent1(v: &Value) -> String {
    let mut buf = Vec::new();
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, serde_json::ser::PrettyFormatter::with_indent(b" "));
    serde::Serialize::serialize(v, &mut ser).unwrap();
    String::from_utf8(buf).unwrap()
}

/// A Markdown file's header of `key: json-value` lines between `---` fences, and the text after it.
pub fn parse_md(text: &str) -> (Rec, String) {
    let text = text.replace("\r\n", "\n");
    let Some(rest) = text.strip_prefix("---\n") else { return (Rec::new(), text) };
    let Some(at) = rest.find("\n---\n") else { return (Rec::new(), text.clone()) };
    let (head, body) = (&rest[..at], &rest[at + 5..]);
    let mut meta = Rec::new();
    for line in head.lines() {
        if let Some((k, v)) = line.split_once(": ") {
            if !k.is_empty() && !v.is_empty() {
                meta.insert(k.into(), serde_json::from_str(v).unwrap_or_else(|_| Value::String(v.into())));
            }
        }
    }
    (meta, body.trim_start_matches('\n').to_string())
}

pub fn dump_md(meta: &Rec, body: &str) -> String {
    let head: String = meta.iter().map(|(k, v)| format!("{k}: {}\n", py_dumps(v))).collect();
    format!("---\n{head}---\n\n{}\n", body.trim_matches('\n'))
}

pub fn write_atomic(path: &Path, text: &str) -> Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_file_name(format!("{}.tmp", path.file_name().unwrap().to_string_lossy()));
    fs::write(&tmp, text)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

pub fn s(r: &Rec, k: &str) -> String {
    match r.get(k) {
        Some(Value::String(v)) => v.clone(),
        Some(Value::Null) | None => String::new(),
        Some(v) => v.to_string(),
    }
}

/// A name → the file name the Python app makes for it.
fn slug_base(name: &str, fallback: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for c in name.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            out.push(c);
            dash = false;
        } else if !dash {
            out.push('-');
            dash = true;
        }
    }
    let t: String = out.trim_matches('-').chars().take(40).collect();
    if t.is_empty() { fallback.to_string() } else { t }
}

/// Up to `n` characters (Python's s[:n]).
pub fn cut(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

pub fn check_color(color: Option<&str>) -> Result<Option<String>> {
    match color {
        None => Ok(None),
        Some(c) if COLORS.contains(&c) => Ok(Some(c.into())),
        Some(c) if c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|x| x.is_ascii_hexdigit()) => Ok(Some(c.to_lowercase())),
        Some(_) => Err(bad(format!("Colors are: {}, or a custom color like #e07b39.", COLORS.join(", ")))),
    }
}

// ---- the store ----------------------------------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    Note,
    Thread,
    Trail,
    Hl,
    Set,
    /// A note in notes/_inbox/: written before it has a place.
    Inbox,
    /// A note in notes/_threads/: on one or more threads, with no place in the text.
    OnThread,
    /// A day's page in notes/_days/<day>.md: one note per day, with no place.
    Day,
}

/// Inbox notes live in notes/_inbox/, inside the notes folder the Python app reads (it skips them: no anchor).
fn in_inbox(p: &Path) -> bool {
    p.parent().and_then(|d| d.file_name()).is_some_and(|n| n == INBOX)
}

pub const INBOX: &str = "_inbox";

/// Notes on a thread and on no place live in notes/_threads/ (the Python app skips them too: no anchor).
pub const ON_THREADS: &str = "_threads";

fn on_threads(p: &Path) -> bool {
    p.parent().and_then(|d| d.file_name()).is_some_and(|n| n == ON_THREADS)
}

/// Today's page and the days before it live in notes/_days/<YYYY-MM-DD>.md (the Python app skips them: no anchor).
pub const DAYS: &str = "_days";

fn in_days(p: &Path) -> bool {
    p.parent().and_then(|d| d.file_name()).is_some_and(|n| n == DAYS)
}

/// A day as its file names it: 2026-11-04.
pub fn is_day(text: &str) -> bool {
    text.len() == 10 && chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d").is_ok()
}

/// The kind a file in notes/ is, by its folder.
fn note_kind(p: &Path) -> Kind {
    if in_inbox(p) {
        Kind::Inbox
    } else if on_threads(p) {
        Kind::OnThread
    } else if in_days(p) {
        Kind::Day
    } else {
        Kind::Note
    }
}

/// Every place a note has: its anchor (where its file lives) and any more it was given (`also`, new in the Rust app;
/// the Python app keeps the field and shows the note at its anchor only).
pub fn places_of(n: &Rec) -> Vec<String> {
    let mut v = vec![];
    if !s(n, "anchor").is_empty() {
        v.push(s(n, "anchor"));
    }
    v.extend(n.get("also").and_then(|a| a.as_array()).into_iter().flatten().filter_map(|x| x.as_str()).map(String::from));
    v
}

/// The threads a note is on (`threads`: thread ids, new in the Rust app).
pub fn threads_of(n: &Rec) -> Vec<String> {
    n.get("threads").and_then(|a| a.as_array()).into_iter().flatten().filter_map(|x| x.as_str()).map(String::from).collect()
}

/// How long a deleted note or question waits in .trash before it is erased (the person's decision, 2026-11-03).
pub const TRASH_DAYS: i64 = 7;

/// The kinds of tracked file: folder, file ending, looked into subfolders?
const TRACKED: &[(Kind, &str, &str, bool)] = &[
    (Kind::Note, "notes", ".md", true),
    (Kind::Thread, "threads", ".md", false),
    (Kind::Trail, "trails", ".md", false),
    (Kind::Hl, "highlights", ".json", false),
    (Kind::Set, "sets", ".md", false),
];

type Sig = (u128, u64); // modified time in ns, size

/// The person's files, held in memory and kept in step with them (the Python app's `Study`). Each tracked file is read
/// once; afterwards only a file whose time or size changed is read again. What the store writes it takes in at once
/// (reading back the one file it wrote). Files changed from outside (hand edits, git pull) are noticed by `refresh`,
/// which looks at the folder at most every `recheck`.
pub struct Store {
    pub root: PathBuf,
    notes: Vec<Rec>,
    hl: Vec<(String, Vec<Rec>)>,
    threads: Vec<Rec>,
    trails: Vec<Rec>,
    sets: Vec<Rec>,
    inbox: Vec<Rec>,
    on_thread: Vec<Rec>,
    days: Vec<Rec>,
    sigs: HashMap<PathBuf, Sig>,
    paths: HashMap<PathBuf, (Kind, String)>,
    pub recheck: Duration,
    checked: Option<Instant>,
    /// How many files have been read and how often the folder was looked at (for the tests).
    pub loads: usize,
    pub scans: usize,
}

fn stem(p: &Path) -> String {
    p.file_stem().unwrap_or_default().to_string_lossy().into_owned()
}

fn read(p: &Path) -> Option<String> {
    fs::read_to_string(p).ok()
}

fn sig_of(p: &Path) -> Option<Sig> {
    let m = fs::metadata(p).ok()?;
    let t = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    Some((t, m.len()))
}

/// The study folder must exist, and the person's real one is refused unless `WB_ALLOW_REAL_STUDY=1` (CLAUDE.md).
pub fn guard(root: &Path) -> Result<()> {
    if !root.is_dir() {
        return Err(bad(format!("No study folder at {} (make a scratch copy with scripts/scratch-study.ps1, or set WB_STUDY_DIR)", root.display())));
    }
    let same = match (fs::canonicalize(root), fs::canonicalize(crate::real_study_dir())) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    if same && std::env::var("WB_ALLOW_REAL_STUDY").as_deref() != Ok("1") {
        return Err(bad(format!("{} is the person's real study folder; use a scratch copy", root.display())));
    }
    Ok(())
}

/// Files of a folder in name order (as the Python app's scandir returns them on Windows), optionally in subfolders.
fn files(dir: &Path, ending: &str, deep: bool) -> Vec<PathBuf> {
    let Ok(rd) = fs::read_dir(dir) else { return vec![] };
    let mut es: Vec<_> = rd.flatten().collect();
    es.sort_by_key(|e| e.file_name());
    let mut out = vec![];
    for e in es {
        let p = e.path();
        if p.is_dir() {
            if deep {
                out.extend(files(&p, ending, deep));
            }
        } else if p.to_string_lossy().ends_with(ending) {
            out.push(p);
        }
    }
    out
}

impl Store {
    pub fn open(root: &Path) -> Result<Store> {
        guard(root)?;
        let mut st = Store {
            root: root.to_path_buf(),
            notes: vec![],
            hl: vec![],
            threads: vec![],
            trails: vec![],
            sets: vec![],
            inbox: vec![],
            on_thread: vec![],
            days: vec![],
            sigs: HashMap::new(),
            paths: HashMap::new(),
            recheck: Duration::ZERO,
            checked: None,
            loads: 0,
            scans: 0,
        };
        st.refresh()?;
        Ok(st)
    }

    /// Look at the folder (at most every `recheck`) and read again what changed. → true if anything did.
    pub fn refresh(&mut self) -> Result<bool> {
        if !self.root.is_dir() {
            return Err(bad(format!("The study-data folder was not found: {}", self.root.display())));
        }
        if let Some(t) = self.checked {
            if t.elapsed() < self.recheck {
                return Ok(false);
            }
        }
        self.scans += 1;
        let mut found: Vec<(PathBuf, Sig, Kind)> = vec![];
        for (kind, sub, ending, deep) in TRACKED {
            for p in files(&self.root.join(sub), ending, *deep) {
                if let Some(sig) = sig_of(&p) {
                    let kind = if *kind == Kind::Note { note_kind(&p) } else { *kind };
                    found.push((p, sig, kind));
                }
            }
        }
        let mut changed = false;
        for (p, sig, kind) in &found {
            if self.sigs.get(p) != Some(sig) {
                self.load_file(p, *sig, *kind);
                changed = true;
            }
        }
        let gone: Vec<PathBuf> = self.sigs.keys().filter(|p| !found.iter().any(|f| &f.0 == *p)).cloned().collect();
        for p in gone {
            self.drop_file(&p);
            changed = true;
        }
        self.checked = Some(Instant::now());
        Ok(changed)
    }

    /// Look at the folder next time `refresh` is called, however recently it last looked.
    pub fn look_again(&mut self) {
        self.checked = None;
    }

    /// Forget what a file held (it was removed, or is about to be read again).
    fn drop_file(&mut self, path: &Path) {
        self.sigs.remove(path);
        if let Some((kind, key)) = self.paths.remove(path) {
            match kind {
                Kind::Note => self.notes.retain(|n| s(n, "id") != key),
                Kind::Trail => self.trails.retain(|n| s(n, "id") != key),
                Kind::Thread => self.threads.retain(|n| s(n, "id") != key),
                Kind::Set => self.sets.retain(|n| s(n, "id") != key),
                Kind::Inbox => self.inbox.retain(|n| s(n, "id") != key),
                Kind::OnThread => self.on_thread.retain(|n| s(n, "id") != key),
                Kind::Day => self.days.retain(|n| s(n, "id") != key),
                Kind::Hl => self.hl.retain(|(c, _)| *c != key),
            }
        }
    }

    /// Read one file into memory. What it holds goes to the end of its kind, as a Python dict re-insert does (that order
    /// decides ties between equal times).
    fn load_file(&mut self, path: &Path, sig: Sig, kind: Kind) {
        self.drop_file(path);
        let Some(text) = read(path) else { return };
        self.loads += 1;
        self.sigs.insert(path.to_path_buf(), sig); // recorded even when the file holds nothing usable
        let key = match kind {
            Kind::Hl => {
                let items = serde_json::from_str::<Value>(&text).ok().and_then(|v| v.get("highlights").and_then(|h| h.as_array().cloned()));
                let Some(items) = items else { return };
                let key = stem(path);
                self.hl.push((key.clone(), items.into_iter().filter_map(|h| h.as_object().cloned()).collect()));
                key
            }
            Kind::Thread | Kind::Set => {
                let t = if kind == Kind::Thread { parse_thread(&stem(path), &text) } else { parse_set(&stem(path), &text) };
                let Some(t) = t else { return };
                let key = s(&t, "id");
                if kind == Kind::Thread {
                    self.threads.push(t);
                } else {
                    self.sets.push(t);
                }
                key
            }
            Kind::Inbox | Kind::OnThread | Kind::Day => {
                let (mut meta, body) = parse_md(&text);
                if kind == Kind::Day {
                    // the file's name is its day, whatever its header says (a page made by hand has none)
                    if !is_day(&stem(path)) {
                        return;
                    }
                    meta.insert("id".into(), json!(format!("d_{}", stem(path))));
                    meta.insert("day".into(), json!(stem(path)));
                    meta.insert("kind".into(), json!("day"));
                }
                if s(&meta, "id").is_empty() {
                    return;
                }
                meta.insert("text".into(), json!(body.trim()));
                let key = s(&meta, "id");
                let list = match kind {
                    Kind::Inbox => &mut self.inbox,
                    Kind::OnThread => &mut self.on_thread,
                    _ => &mut self.days,
                };
                list.retain(|n| s(n, "id") != key);
                list.push(meta);
                key
            }
            Kind::Note | Kind::Trail => {
                let (mut meta, body) = parse_md(&text);
                if s(&meta, "id").is_empty() || s(&meta, "anchor").is_empty() {
                    return;
                }
                meta.insert("text".into(), json!(body.trim()));
                let key = s(&meta, "id");
                let list = if kind == Kind::Note { &mut self.notes } else { &mut self.trails };
                list.retain(|n| s(n, "id") != key);
                list.push(meta);
                key
            }
        };
        self.paths.insert(path.to_path_buf(), (kind, key));
    }

    fn kind_of(&self, path: &Path) -> Option<Kind> {
        let rel: Vec<String> = path.strip_prefix(&self.root).ok()?.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
        TRACKED
            .iter()
            .find(|(_, sub, ending, deep)| rel.first().map(String::as_str) == Some(*sub) && rel.last().is_some_and(|l| l.ends_with(ending)) && (*deep || rel.len() == 2))
            .map(|t| if t.0 == Kind::Note { note_kind(path) } else { t.0 })
    }

    /// Write a tracked file and take it into memory (nothing else is read again).
    fn put(&mut self, path: &Path, text: &str) -> Result<()> {
        write_atomic(path, text)?;
        if let (Some(kind), Some(sig)) = (self.kind_of(path), sig_of(path)) {
            self.load_file(path, sig, kind);
        }
        Ok(())
    }

    /// A file of the study folder to .trash, as every delete is (documents' records use it).
    pub fn trash_file(&mut self, path: &Path) -> Result<()> {
        guard(&self.root)?;
        self.trash(path)
    }

    fn trash(&mut self, path: &Path) -> Result<()> {
        let dest = self.root.join(".trash").join(format!("{}-{}", chrono::Utc::now().format("%Y%m%d-%H%M%S"), path.file_name().unwrap().to_string_lossy()));
        fs::create_dir_all(dest.parent().unwrap())?;
        fs::rename(path, dest)?;
        self.drop_file(path);
        Ok(())
    }

    // ---- notes ----

    fn note_path(&self, n: &Rec) -> PathBuf {
        let folder = if s(n, "kind") == "lemma" { "_words".to_string() } else { cut(&s(n, "anchor"), 3) };
        self.root.join("notes").join(folder).join(format!("{}.md", s(n, "id")))
    }

    /// Every note, oldest first.
    pub fn notes(&self) -> Vec<&Rec> {
        let mut v: Vec<&Rec> = self.notes.iter().collect();
        v.sort_by_key(|n| s(n, "created"));
        v
    }

    pub fn add_note(&mut self, anchor: &str, text: &str, quote: &str, strong: &str) -> Result<Rec> {
        let p = anchors::py_parse(anchor)?;
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("A note needs some text."));
        }
        let meta = json!({"id": new_id("n"), "anchor": p["id"], "kind": p["kind"], "quote": quote, "strong": strong, "created": now(), "updated": now()});
        let meta = meta.as_object().unwrap().clone();
        self.put(&self.note_path(&meta), &dump_md(&meta, text))?;
        let mut n = meta;
        n.insert("text".into(), json!(text));
        Ok(n)
    }

    pub fn update_note(&mut self, id: &str, text: &str) -> Result<Rec> {
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("A note needs some text. To remove it, delete the note."));
        }
        let at = self.notes.iter().position(|n| s(n, "id") == id).ok_or_else(|| missing("No such note."))?;
        let mut meta = self.notes[at].clone();
        meta.shift_remove("text");
        meta.insert("updated".into(), json!(now()));
        self.put(&self.note_path(&meta), &dump_md(&meta, text))?;
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    pub fn delete_note(&mut self, id: &str) -> Result<()> {
        let at = self.notes.iter().position(|n| s(n, "id") == id).ok_or_else(|| missing("No such note."))?;
        let path = self.note_path(&self.notes[at]);
        self.trash(&path)
    }

    // ---- highlights ----

    /// A book's highlights, in their file's order.
    pub fn highlights(&self, code: &str) -> Vec<Rec> {
        self.hl.iter().find(|(c, _)| c == code).map(|(_, v)| v.clone()).unwrap_or_default()
    }

    /// Every highlight, book file by book file.
    pub fn all_highlights(&self) -> Vec<Rec> {
        self.hl.iter().flat_map(|(_, v)| v.clone()).collect()
    }

    /// Take highlights out of a book's file by id and put new ones in, in one write.
    pub fn edit_highlights(&mut self, code: &str, drop: &[String], add: Vec<Rec>) -> Result<()> {
        let mut items: Vec<Rec> = self.highlights(code).into_iter().filter(|h| !drop.contains(&s(h, "id"))).collect();
        items.extend(add);
        items.sort_by_key(|h| s(h, "created"));
        let path = self.root.join("highlights").join(format!("{code}.json"));
        if !items.is_empty() {
            self.put(&path, &(py_dumps_indent1(&json!({"highlights": items})) + "\n"))?;
        } else if path.exists() {
            self.trash(&path)?;
        }
        Ok(())
    }

    /// Color exactly this anchor (replacing a highlight on the same anchor), or clear it with None. The study requests
    /// use studyapi::save_highlight, which keeps highlights from overlapping; this is the store's own plain form.
    pub fn set_highlight(&mut self, anchor: &str, color: Option<&str>, quote: &str) -> Result<()> {
        let p = anchors::py_parse(anchor)?;
        if p["kind"] == "lemma" {
            return Err(bad("Highlights go on words, phrases or verses."));
        }
        let color = check_color(color)?;
        let code = s(&p, "code");
        let id = s(&p, "id");
        let drop: Vec<String> = self.highlights(&code).iter().filter(|h| s(h, "anchor") == id).map(|h| s(h, "id")).collect();
        let add = match color {
            Some(c) => vec![json!({"id": new_id("h"), "anchor": id, "color": c, "quote": quote, "created": now()}).as_object().unwrap().clone()],
            None => vec![],
        };
        self.edit_highlights(&code, &drop, add)
    }

    // ---- palette ----

    fn palette_path(&self) -> PathBuf {
        self.root.join("settings").join("palette.json")
    }

    pub fn palette(&self) -> Vec<String> {
        let Some(v) = read(&self.palette_path()).and_then(|t| serde_json::from_str::<Value>(&t).ok()) else { return vec![] };
        let Some(cs) = v.get("colors").and_then(|c| c.as_array()) else { return vec![] };
        cs.iter()
            .filter_map(|c| c.as_str())
            .filter(|c| c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|x| x.is_ascii_hexdigit()))
            .map(|c| c.to_lowercase())
            .take(PALETTE_MAX)
            .collect()
    }

    fn write_palette(&self, colors: Vec<String>) -> Result<Vec<String>> {
        let colors: Vec<String> = colors.into_iter().take(PALETTE_MAX).collect();
        // json.dumps(..., indent=1) without ensure_ascii=False; the colors are ASCII
        write_atomic(&self.palette_path(), &(py_dumps_indent1(&json!({"colors": colors})) + "\n"))?;
        Ok(colors)
    }

    pub fn use_palette_color(&self, color: &str) -> Result<Vec<String>> {
        let color = check_color(Some(color))?.unwrap();
        let mut v = vec![color.clone()];
        v.extend(self.palette().into_iter().filter(|c| *c != color));
        self.write_palette(v)
    }

    pub fn drop_palette_color(&self, color: Option<&str>) -> Result<Vec<String>> {
        let color = check_color(color)?;
        self.write_palette(self.palette().into_iter().filter(|c| Some(c) != color.as_ref()).collect())
    }

    // ---- threads ----

    /// Every thread, the most recently changed first.
    pub fn threads(&self) -> Vec<&Rec> {
        let mut v: Vec<&Rec> = self.threads.iter().collect();
        v.sort_by(|a, b| s(b, "updated").cmp(&s(a, "updated")));
        v
    }

    pub fn thread(&self, id: &str) -> Result<Rec> {
        self.threads.iter().find(|t| s(t, "id") == id).cloned().ok_or_else(|| missing("No such thread."))
    }

    fn write_thread(&mut self, t: &mut Rec) -> Result<()> {
        t.insert("updated".into(), json!(now()));
        let mut meta = Rec::new();
        for k in ["name", "created", "updated"] {
            meta.insert(k.into(), t[k].clone());
        }
        if !s(t, "color").is_empty() {
            meta.insert("color".into(), t["color"].clone());
        }
        let bullets: Vec<String> = t["members"].as_array().unwrap().iter().map(|m| format!("- {} | {}", m["anchor"].as_str().unwrap(), py_dumps(&m["quote"]))).collect();
        let note = s(t, "note").replace(ANCHORS_MARK, "");
        let body = format!("{}\n\n{ANCHORS_MARK}\n{}", note.trim(), bullets.join("\n"));
        let id = s(t, "id");
        self.put(&self.root.join("threads").join(format!("{id}.md")), &dump_md(&meta, &body))
    }

    fn slug(&self, name: &str, folder: &str) -> String {
        let base = slug_base(name, &folder[..folder.len() - 1]);
        let (mut slug, mut n) = (base.clone(), 2);
        while self.root.join(folder).join(format!("{slug}.md")).exists() {
            slug = format!("{base}-{n}");
            n += 1;
        }
        slug
    }

    pub fn create_thread(&mut self, name: &str, note: &str, color: Option<&str>) -> Result<Rec> {
        let name = name.trim();
        if name.is_empty() {
            return Err(bad("A thread needs a name."));
        }
        let color = check_color(color)?.unwrap_or_default();
        let mut t = json!({"id": self.slug(name, "threads"), "name": cut(name, 120), "created": now(), "updated": now(), "color": color,
            "note": note.trim(), "members": []}).as_object().unwrap().clone();
        self.write_thread(&mut t)?;
        if !color.is_empty() && !COLORS.contains(&color.as_str()) {
            self.use_palette_color(&color)?;
        }
        Ok(t)
    }

    /// name/note: None leaves them; color: None leaves it, Some(None or "") clears it, Some(color) sets it.
    pub fn update_thread(&mut self, id: &str, name: Option<&str>, note: Option<&str>, color: Option<Option<&str>>) -> Result<Rec> {
        let color = match color {
            Some(c) => Some(check_color(c.filter(|x| !x.is_empty()))?.unwrap_or_default()),
            None => None,
        };
        let mut t = self.thread(id)?;
        if let Some(n) = name {
            if n.trim().is_empty() {
                return Err(bad("A thread needs a name."));
            }
            t.insert("name".into(), json!(cut(n.trim(), 120)));
        }
        if let Some(n) = note {
            t.insert("note".into(), json!(n.trim()));
        }
        if let Some(c) = &color {
            t.insert("color".into(), json!(c));
            if !c.is_empty() && !COLORS.contains(&c.as_str()) {
                self.use_palette_color(c)?;
            }
        }
        self.write_thread(&mut t)?;
        Ok(t)
    }

    pub fn add_to_thread(&mut self, id: &str, anchor: &str, quote: &str) -> Result<Rec> {
        let a = anchors::canonical(anchor)?;
        let mut t = self.thread(id)?;
        let members = t["members"].as_array_mut().unwrap();
        if !members.iter().any(|m| m["anchor"] == a) {
            members.push(json!({"anchor": a, "quote": quote}));
            self.write_thread(&mut t)?;
        }
        Ok(t)
    }

    /// Those not yet in the thread go in, in one write. → the anchors added.
    pub fn add_many_to_thread(&mut self, id: &str, items: &[(String, String)]) -> Result<Vec<String>> {
        let mut t = self.thread(id)?;
        let members = t["members"].as_array_mut().unwrap();
        let mut have: Vec<String> = members.iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect();
        let mut added = vec![];
        for (a, q) in items {
            if !have.contains(a) {
                have.push(a.clone());
                members.push(json!({"anchor": a, "quote": q}));
                added.push(a.clone());
            }
        }
        if !added.is_empty() {
            self.write_thread(&mut t)?;
        }
        Ok(added)
    }

    pub fn remove_from_thread(&mut self, id: &str, anchor: &str) -> Result<Rec> {
        let a = anchors::canonical(anchor)?;
        let mut t = self.thread(id)?;
        t["members"].as_array_mut().unwrap().retain(|m| m["anchor"] != a);
        self.write_thread(&mut t)?;
        Ok(t)
    }

    /// Every anchor the thread holds, once, in this order. → true if that changed anything.
    pub fn order_thread(&mut self, id: &str, order: &[String]) -> Result<bool> {
        let order: Vec<String> = order.iter().map(|a| anchors::canonical(a)).collect::<Result<_>>()?;
        let mut t = self.thread(id)?;
        let held: Vec<Value> = t["members"].as_array().unwrap().clone();
        let names: Vec<String> = held.iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect();
        let (mut a, mut b) = (order.clone(), names.clone());
        a.sort();
        a.dedup();
        b.sort();
        if order.len() != names.len() || a != b {
            return Err(bad("That is not every place in the thread, once each. It may have changed; look at it again."));
        }
        if order == names {
            return Ok(false);
        }
        let new: Vec<Value> = order.iter().map(|a| held.iter().find(|m| m["anchor"] == *a).unwrap().clone()).collect();
        t.insert("members".into(), json!(new));
        self.write_thread(&mut t)?;
        Ok(true)
    }

    pub fn delete_thread(&mut self, id: &str) -> Result<()> {
        self.thread(id)?;
        self.trash(&self.root.join("threads").join(format!("{id}.md")))
    }

    // ---- the Notebook's Inbox: notes with no place yet ----

    fn inbox_path(&self, id: &str) -> PathBuf {
        self.root.join("notes").join(INBOX).join(format!("{id}.md"))
    }

    /// Every note with no place yet, oldest first.
    pub fn inbox(&self) -> Vec<&Rec> {
        let mut v: Vec<&Rec> = self.inbox.iter().collect();
        v.sort_by_key(|n| s(n, "created"));
        v
    }

    fn jotted(&self, id: &str) -> Result<Rec> {
        self.inbox.iter().find(|n| s(n, "id") == id).cloned().ok_or_else(|| missing("No such note in the Inbox."))
    }

    /// A thought with no place yet, into the Inbox; a question (`question`) waits there to be placed and answered.
    /// Same front matter as a note, with an empty anchor (so the Python app passes over it) and kind "jot" or "question".
    pub fn jot(&mut self, text: &str, question: bool) -> Result<Rec> {
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("Write the thought first."));
        }
        let kind = if question { "question" } else { "jot" };
        let meta = json!({"id": new_id(if question { "q" } else { "n" }), "anchor": "", "kind": kind, "quote": "", "strong": "", "created": now(), "updated": now()});
        let meta = meta.as_object().unwrap().clone();
        self.put(&self.inbox_path(&s(&meta, "id")), &dump_md(&meta, text))?;
        let mut n = meta;
        n.insert("text".into(), json!(text));
        Ok(n)
    }

    /// Change an Inbox note's text, or make it a question (or a plain note again).
    pub fn update_jot(&mut self, id: &str, text: Option<&str>, question: Option<bool>) -> Result<Rec> {
        let mut meta = self.jotted(id)?;
        let text = match text {
            Some(t) if t.trim().is_empty() => return Err(bad("A note needs some text. To remove it, delete the note.")),
            Some(t) => t.trim().to_string(),
            None => s(&meta, "text"),
        };
        if let Some(q) = question {
            meta.insert("kind".into(), json!(if q { "question" } else { "jot" }));
        }
        meta.shift_remove("text");
        meta.insert("updated".into(), json!(now()));
        self.put(&self.inbox_path(id), &dump_md(&meta, &text))?;
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    pub fn delete_jot(&mut self, id: &str) -> Result<()> {
        self.jotted(id)?;
        self.trash(&self.inbox_path(id))
    }

    /// Give an Inbox note its place: a note moves to notes/<BOOK>/ (or notes/_words/ for H7065), a question becomes a
    /// trail (trails/), both in the Python app's formats, keeping the id and the day it was written. `anchor` is
    /// canonical; `kind`, `quote` and `strong` come from resolving it against the text.
    pub fn place_jot(&mut self, id: &str, anchor: &str, kind: &str, quote: &str, strong: &str) -> Result<Rec> {
        let old = self.jotted(id)?;
        let question = s(&old, "kind") == "question";
        if question && kind == "lemma" {
            return Err(bad("A question is placed on words or verses in the text, not on a Strong's number everywhere."));
        }
        let text = s(&old, "text");
        let status = if s(&old, "status") == "done" { "done" } else { "open" };
        let mut meta = if question {
            json!({"id": id, "anchor": anchor, "kind": kind, "quote": quote, "status": status, "created": old["created"], "updated": now()})
        } else {
            json!({"id": id, "anchor": anchor, "kind": kind, "quote": quote, "strong": strong, "created": old["created"], "updated": now()})
        }
        .as_object()
        .unwrap()
        .clone();
        let path = if question { self.root.join("trails").join(format!("{id}.md")) } else { self.note_path(&meta) };
        self.put(&path, &dump_md(&meta, &text))?;
        // the note now lives at its place; the Inbox file is removed only after that is written
        let from = self.inbox_path(id);
        fs::remove_file(&from)?;
        self.drop_file(&from);
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    /// An Inbox question answered (`done`) or open again; the status is kept when it is placed.
    pub fn set_jot_status(&mut self, id: &str, status: &str) -> Result<Rec> {
        if status != "open" && status != "done" {
            return Err(bad("A question is either open or done."));
        }
        let mut meta = self.jotted(id)?;
        if s(&meta, "kind") != "question" {
            return Err(bad("Only a question is answered."));
        }
        let text = s(&meta, "text");
        meta.shift_remove("text");
        meta.insert("status".into(), json!(status));
        meta.insert("updated".into(), json!(now()));
        self.put(&self.inbox_path(id), &dump_md(&meta, &text))?;
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    /// A placed note or question somewhere else, or turned from one into the other (`question`): the file is written at
    /// its new place first and the old one removed after, keeping the id, the text and the day it was written. `anchor`
    /// is canonical; `kind`, `quote` and `strong` come from resolving it against the text.
    pub fn replace_placed(&mut self, id: &str, anchor: &str, kind: &str, quote: &str, strong: &str, question: Option<bool>) -> Result<Rec> {
        let (old, was_q) = match self.notes.iter().find(|n| s(n, "id") == id) {
            Some(n) => (n.clone(), false),
            None => (self.trails.iter().find(|t| s(t, "id") == id).cloned().ok_or_else(|| missing("No such note."))?, true),
        };
        let to_q = question.unwrap_or(was_q);
        if to_q && kind == "lemma" {
            return Err(bad("A question is placed on words or verses in the text, not on a Strong's number everywhere."));
        }
        let from = if was_q { self.root.join("trails").join(format!("{id}.md")) } else { self.note_path(&old) };
        let text = s(&old, "text");
        let mut meta = if to_q {
            let status = if was_q { s(&old, "status") } else { "open".into() };
            json!({"id": id, "anchor": anchor, "kind": kind, "quote": quote, "status": status, "created": old["created"], "updated": now()})
        } else {
            json!({"id": id, "anchor": anchor, "kind": kind, "quote": quote, "strong": strong, "created": old["created"], "updated": now()})
        }
        .as_object()
        .unwrap()
        .clone();
        for k in ["also", "threads"] {
            if let Some(v) = old.get(k) {
                meta.insert(k.into(), v.clone());
            }
        }
        let path = if to_q { self.root.join("trails").join(format!("{id}.md")) } else { self.note_path(&meta) };
        self.put(&path, &dump_md(&meta, &text))?;
        self.moved(&from, &path)?;
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    // ---- today's page: one note per day (notes/_days/<day>.md) ----

    fn day_path(&self, day: &str) -> PathBuf {
        self.root.join("notes").join(DAYS).join(format!("{day}.md"))
    }

    /// Every day's page, oldest first.
    pub fn days(&self) -> Vec<&Rec> {
        let mut v: Vec<&Rec> = self.days.iter().collect();
        v.sort_by_key(|n| s(n, "day"));
        v
    }

    /// One day's page, if it has been written in.
    pub fn day(&self, day: &str) -> Option<&Rec> {
        self.days.iter().find(|n| s(n, "day") == day)
    }

    /// Write a day's page: the whole text (`append` false), or a paragraph added after what is there. The page is made
    /// the first time something is written in it; its header is an id, the day, its kind and the times (no anchor, so
    /// the Python app passes over it). Emptying a page sends it to .trash. → the page, or None once emptied.
    pub fn write_day(&mut self, day: &str, text: &str, append: bool) -> Result<Option<Rec>> {
        if !is_day(day) {
            return Err(bad("A day looks like 2026-11-04."));
        }
        let old = self.day(day).cloned();
        let text = text.trim();
        if append && text.is_empty() {
            return Err(bad("Write something to add to the page."));
        }
        let body = match (&old, append) {
            (Some(o), true) if !s(o, "text").is_empty() => format!("{}\n\n{text}", s(o, "text")),
            _ => text.to_string(),
        };
        if body.trim().is_empty() {
            if old.is_some() {
                self.trash(&self.day_path(day))?;
            }
            return Ok(None);
        }
        let mut meta = match old {
            Some(mut o) => {
                o.shift_remove("text");
                o.insert("updated".into(), json!(now()));
                o
            }
            None => json!({"id": format!("d_{day}"), "day": day, "kind": "day", "created": now(), "updated": now()}).as_object().unwrap().clone(),
        };
        self.put(&self.day_path(day), &dump_md(&meta, &body))?;
        meta.insert("text".into(), json!(body));
        Ok(Some(meta))
    }

    /// Delete a day's page (moved to .trash, as any note is).
    pub fn delete_day(&mut self, day: &str) -> Result<()> {
        self.day(day).ok_or_else(|| missing("That day has no page."))?;
        self.trash(&self.day_path(day))
    }

    // ---- settings: settings/<part>.json, one value per key (the window's settings; new in the Rust app) ----

    fn settings_path(&self, part: &str) -> PathBuf {
        self.root.join("settings").join(format!("{part}.json"))
    }

    /// What is saved for a part of the window (an empty object when nothing is).
    pub fn settings(&self, part: &str) -> Rec {
        read(&self.settings_path(part)).and_then(|t| serde_json::from_str::<Value>(&t).ok()).and_then(|v| v.as_object().cloned()).unwrap_or_default()
    }

    /// Save one setting; the others in the file are kept as they are. `None` forgets it (the default stands again).
    pub fn set_setting(&mut self, part: &str, key: &str, value: Option<Value>) -> Result<Rec> {
        if part.is_empty() || !part.bytes().all(|b| b.is_ascii_lowercase() || b == b'-') {
            return Err(bad("A settings part is a plain name, like notebook."));
        }
        let mut all = self.settings(part);
        match value {
            Some(v) => {
                all.insert(key.into(), v);
            }
            None => {
                all.shift_remove(key);
            }
        }
        write_atomic(&self.settings_path(part), &(py_dumps_indent1(&Value::Object(all.clone())) + "\n"))?;
        Ok(all)
    }

    // ---- more places, threads, and notes on a thread with no place ----

    /// Every note on a thread with no place in the text, oldest first.
    pub fn on_thread(&self) -> Vec<&Rec> {
        let mut v: Vec<&Rec> = self.on_thread.iter().collect();
        v.sort_by_key(|n| s(n, "created"));
        v
    }

    fn on_thread_path(&self, id: &str) -> PathBuf {
        self.root.join("notes").join(ON_THREADS).join(format!("{id}.md"))
    }

    /// A note written on a thread, with no place in the text (notes/_threads/).
    pub fn add_thread_note(&mut self, thread_id: &str, text: &str) -> Result<Rec> {
        self.thread(thread_id)?;
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("A note needs some text."));
        }
        let meta = json!({"id": new_id("n"), "anchor": "", "kind": "thread", "quote": "", "strong": "", "threads": [thread_id], "created": now(), "updated": now()});
        let meta = meta.as_object().unwrap().clone();
        self.put(&self.on_thread_path(&s(&meta, "id")), &dump_md(&meta, text))?;
        let mut n = meta;
        n.insert("text".into(), json!(text));
        Ok(n)
    }

    /// Any note by its id, wherever it is: (its record, its file).
    fn any_note(&self, id: &str) -> Result<(Rec, PathBuf)> {
        if let Some(n) = self.notes.iter().find(|n| s(n, "id") == id) {
            return Ok((n.clone(), self.note_path(n)));
        }
        if let Some(n) = self.on_thread.iter().find(|n| s(n, "id") == id) {
            return Ok((n.clone(), self.on_thread_path(id)));
        }
        if let Some(n) = self.trails.iter().find(|n| s(n, "id") == id) {
            return Ok((n.clone(), self.root.join("trails").join(format!("{id}.md"))));
        }
        if let Some(n) = self.inbox.iter().find(|n| s(n, "id") == id) {
            return Ok((n.clone(), self.inbox_path(id)));
        }
        if let Some(n) = self.days.iter().find(|n| s(n, "id") == id) {
            return Ok((n.clone(), self.day_path(&s(n, "day"))));
        }
        Err(missing("No note or question with that id."))
    }

    fn rewrite(&mut self, mut meta: Rec, path: &Path) -> Result<Rec> {
        let text = s(&meta, "text");
        meta.shift_remove("text");
        meta.insert("updated".into(), json!(now()));
        self.put(path, &dump_md(&meta, &text))?;
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    /// The text of a note on a thread (placed notes: `update_note`).
    pub fn update_thread_note(&mut self, id: &str, text: &str) -> Result<Rec> {
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("A note needs some text. To remove it, delete the note."));
        }
        let mut meta = self.on_thread.iter().find(|n| s(n, "id") == id).cloned().ok_or_else(|| missing("No such note."))?;
        meta.insert("text".into(), json!(text));
        let path = self.on_thread_path(id);
        self.rewrite(meta, &path)
    }

    pub fn delete_thread_note(&mut self, id: &str) -> Result<()> {
        if !self.on_thread.iter().any(|n| s(n, "id") == id) {
            return Err(missing("No such note."));
        }
        self.trash(&self.on_thread_path(id))
    }

    /// Put a note on a thread or take it off (`on`). A note with no place that leaves its last thread goes to the
    /// Inbox; an Inbox note put on a thread moves to notes/_threads/ (the thread is its place now).
    pub fn set_note_thread(&mut self, id: &str, thread_id: &str, on: bool) -> Result<Rec> {
        if on {
            self.thread(thread_id)?;
        }
        let (mut meta, path) = self.any_note(id)?;
        let mut ts = threads_of(&meta);
        ts.retain(|t| t != thread_id);
        if on {
            ts.push(thread_id.to_string());
        }
        if ts.is_empty() {
            meta.shift_remove("threads");
        } else {
            meta.insert("threads".into(), json!(ts));
        }
        let loose = self.on_thread.iter().any(|n| s(n, "id") == id);
        let jotted = self.inbox.iter().any(|n| s(n, "id") == id);
        let to = if loose && ts.is_empty() {
            meta.insert("kind".into(), json!("jot"));
            self.inbox_path(id)
        } else if jotted && !ts.is_empty() && s(&meta, "kind") != "question" {
            meta.insert("kind".into(), json!("thread"));
            self.on_thread_path(id)
        } else {
            path.clone()
        };
        let r = self.rewrite(meta, &to)?;
        if to != path {
            fs::remove_file(&path)?;
            self.drop_file(&path);
        }
        Ok(r)
    }

    /// Give a placed note one more place (`on`), or take one away. Its first place (the anchor, where its file lives)
    /// changes by moving the note (`replace_placed`). `anchor` is canonical.
    pub fn set_note_also(&mut self, id: &str, anchor: &str, on: bool) -> Result<Rec> {
        let mut meta = self.notes.iter().find(|n| s(n, "id") == id).cloned().ok_or_else(|| missing("No placed note with that id."))?;
        let mut also: Vec<String> = places_of(&meta).into_iter().skip(1).collect();
        if on {
            if s(&meta, "anchor") == anchor || also.iter().any(|a| a == anchor) {
                return Ok(meta);
            }
            if s(&meta, "kind") == "lemma" || anchors::py_parse(anchor)?["kind"] == "lemma" {
                return Err(bad("A note on a Strong's number everywhere has no other places; more places are verses or words."));
            }
            also.push(anchor.to_string());
        } else {
            if s(&meta, "anchor") == anchor {
                return Err(bad("That is the note's first place; move the note (wb note move) to change it."));
            }
            if !also.iter().any(|a| a == anchor) {
                return Err(missing("The note is not on that place."));
            }
            also.retain(|a| a != anchor);
        }
        if also.is_empty() {
            meta.shift_remove("also");
        } else {
            meta.insert("also".into(), json!(also));
        }
        let path = self.note_path(&meta);
        self.rewrite(meta, &path)
    }

    /// Take a place off a placed note or question (`anchor`, as the note has it). One of its other places comes off as
    /// `set_note_also` takes it; its first place taken off, the next (`next`: anchor, kind, quote and strong, resolved
    /// by the caller) becomes its place and its file moves there; its last place taken off, it goes to the Inbox (a
    /// note still on a thread goes to notes/_threads/, the thread being its place). It keeps its id, its text, its
    /// threads and the day it was written; the new file is written before the old one is removed.
    pub fn unplace(&mut self, id: &str, anchor: &str, next: Option<(&str, &str, &str, &str)>) -> Result<Rec> {
        let (old, was_q) = match self.notes.iter().find(|n| s(n, "id") == id) {
            Some(n) => (n.clone(), false),
            None => (self.trails.iter().find(|t| s(t, "id") == id).cloned().ok_or_else(|| missing("No placed note or question with that id."))?, true),
        };
        let places = places_of(&old);
        if !places.iter().any(|p| p == anchor) {
            return Err(missing("The note is not on that place."));
        }
        if s(&old, "anchor") != anchor {
            return self.set_note_also(id, anchor, false);
        }
        let rest: Vec<String> = places.into_iter().skip(1).collect();
        if rest.is_empty() != next.is_none() {
            return Err(bad("The note's next place is needed to take off its first."));
        }
        let from = if was_q { self.root.join("trails").join(format!("{id}.md")) } else { self.note_path(&old) };
        let text = s(&old, "text");
        let threads = threads_of(&old);
        let mut meta = match next {
            Some((a, kind, quote, strong)) => {
                json!({"id": id, "anchor": a, "kind": kind, "quote": quote, "strong": strong, "created": old["created"], "updated": now()})
            }
            None if was_q => {
                let status = if s(&old, "status") == "done" { "done" } else { "open" };
                json!({"id": id, "anchor": "", "kind": "question", "quote": "", "strong": "", "status": status, "created": old["created"], "updated": now()})
            }
            None => {
                let kind = if threads.is_empty() { "jot" } else { "thread" };
                json!({"id": id, "anchor": "", "kind": kind, "quote": "", "strong": "", "created": old["created"], "updated": now()})
            }
        }
        .as_object()
        .unwrap()
        .clone();
        if rest.len() > 1 {
            meta.insert("also".into(), json!(rest[1..]));
        }
        if !threads.is_empty() {
            meta.insert("threads".into(), json!(threads));
        }
        let path = if next.is_some() {
            self.note_path(&meta)
        } else if !was_q && !threads.is_empty() {
            self.on_thread_path(id)
        } else {
            self.inbox_path(id)
        };
        self.put(&path, &dump_md(&meta, &text))?;
        self.moved(&from, &path)?;
        meta.insert("text".into(), json!(text));
        Ok(meta)
    }

    /// A record written at its new file (`to`, already put) leaves its old one (`from`): the old file is removed and
    /// forgotten, and the new one read again, since forgetting the old forgets its id, which the new one shares.
    fn moved(&mut self, from: &Path, to: &Path) -> Result<()> {
        if from == to {
            return Ok(());
        }
        fs::remove_file(from)?;
        self.drop_file(from);
        if let (Some(kind), Some(sig)) = (self.kind_of(to), sig_of(to)) {
            self.load_file(to, sig, kind);
        }
        Ok(())
    }

    // ---- the trash: deleted files wait in .trash; notes and questions are erased after TRASH_DAYS ----

    /// When a file in .trash was deleted, from its name (20261103-213450-n_….md, UTC; both apps name them so).
    fn trashed_at(name: &str) -> Option<chrono::NaiveDateTime> {
        chrono::NaiveDateTime::parse_from_str(name.get(..15)?, "%Y%m%d-%H%M%S").ok()
    }

    /// A deleted note, question or day's page (not a thread, a highlight file or a plan, which stay in .trash).
    fn is_note_file(name: &str) -> bool {
        let rest = name.get(16..).unwrap_or("");
        let day = rest.strip_suffix(".md").is_some_and(is_day);
        Self::trashed_at(name).is_some() && (rest.starts_with("n_") || rest.starts_with("q_") || day) && rest.ends_with(".md")
    }

    /// The notes and questions in .trash, newest first: {name, id, anchor, kind, question, text, deleted, days_left}.
    pub fn trashed(&self) -> Vec<Value> {
        let Ok(rd) = fs::read_dir(self.root.join(".trash")) else { return vec![] };
        let now = chrono::Utc::now().naive_utc();
        let mut out: Vec<Value> = rd
            .flatten()
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().into_owned();
                if !Self::is_note_file(&name) {
                    return None;
                }
                let at = Self::trashed_at(&name)?;
                let (meta, body) = parse_md(&read(&e.path())?);
                Some(json!({"name": name, "id": s(&meta, "id"), "anchor": s(&meta, "anchor"), "kind": s(&meta, "kind"),
                    "question": meta.contains_key("status"), "text": body.trim(), "deleted": format!("{}Z", at.format("%Y-%m-%dT%H:%M:%S")),
                    "days_left": (TRASH_DAYS - (now - at).num_days()).max(0)}))
            })
            .collect();
        out.sort_by(|a, b| b["name"].as_str().cmp(&a["name"].as_str()));
        out
    }

    /// Put a deleted note or question back where it was: its folder follows from what it is (a place, a thread, the
    /// Inbox, a question). Refused if a file of that name is already there.
    pub fn restore(&mut self, name: &str) -> Result<Rec> {
        guard(&self.root)?;
        if name.contains(['/', '\\']) || !Self::is_note_file(name) {
            return Err(bad("Name a note or question in the trash (wb trash)."));
        }
        let from = self.root.join(".trash").join(name);
        let text = read(&from).ok_or_else(|| missing("No such file in the trash."))?;
        let (mut meta, body) = parse_md(&text);
        let id = s(&meta, "id");
        let anchor = s(&meta, "anchor");
        let day = name.get(16..).unwrap_or("").trim_end_matches(".md").to_string();
        let to = if is_day(&day) {
            self.day_path(&day)
        } else if meta.contains_key("status") && !anchor.is_empty() {
            self.root.join("trails").join(format!("{id}.md"))
        } else if anchor.is_empty() && s(&meta, "kind") == "thread" {
            self.on_thread_path(&id)
        } else if anchor.is_empty() {
            self.inbox_path(&id)
        } else {
            self.note_path(&meta)
        };
        if to.exists() {
            return Err(bad(format!("{} is already there; it was not put back.", to.display())));
        }
        fs::create_dir_all(to.parent().unwrap())?;
        fs::rename(&from, &to)?;
        if let (Some(kind), Some(sig)) = (self.kind_of(&to), sig_of(&to)) {
            self.load_file(&to, sig, kind);
        }
        meta.insert("text".into(), json!(body.trim()));
        Ok(meta)
    }

    /// Erase the notes and questions deleted at least `days` ago; other files in .trash stay. → their names.
    pub fn empty_trash(&mut self, days: i64) -> Result<Vec<String>> {
        guard(&self.root)?;
        let Ok(rd) = fs::read_dir(self.root.join(".trash")) else { return Ok(vec![]) };
        let now = chrono::Utc::now().naive_utc();
        let mut gone = vec![];
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if let (true, Some(at)) = (Self::is_note_file(&name), Self::trashed_at(&name)) {
                if (now - at).num_days() >= days {
                    fs::remove_file(e.path())?;
                    gone.push(name);
                }
            }
        }
        gone.sort();
        Ok(gone)
    }

    /// Erase one deleted note or question at once (Erase now in the Trash; the person's decision, 2026-11-04). It is the
    /// only erase besides the 7 days, and only for notes and questions: other files in .trash are never erased.
    pub fn erase(&mut self, name: &str) -> Result<()> {
        guard(&self.root)?;
        if name.contains(['/', '\\']) || !Self::is_note_file(name) {
            return Err(bad("Name a note or question in the trash (wb trash)."));
        }
        let p = self.root.join(".trash").join(name);
        if !p.is_file() {
            return Err(missing("No such file in the trash."));
        }
        fs::remove_file(p)?;
        Ok(())
    }

    // ---- trails ----

    /// Every trail, newest first.
    pub fn trails(&self) -> Vec<&Rec> {
        let mut v: Vec<&Rec> = self.trails.iter().collect();
        v.sort_by(|a, b| s(b, "created").cmp(&s(a, "created")));
        v
    }

    pub fn add_trail(&mut self, anchor: &str, text: &str, quote: &str) -> Result<Rec> {
        let p = anchors::py_parse(anchor)?;
        if p["kind"] == "lemma" {
            return Err(bad("A trail is anchored to a place in the text."));
        }
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("Write the question after the ?."));
        }
        let meta = json!({"id": new_id("q"), "anchor": p["id"], "kind": p["kind"], "quote": quote, "status": "open", "created": now(), "updated": now()});
        let meta = meta.as_object().unwrap().clone();
        self.put(&self.root.join("trails").join(format!("{}.md", s(&meta, "id"))), &dump_md(&meta, text))?;
        let mut t = meta;
        t.insert("text".into(), json!(text));
        Ok(t)
    }

    fn trail_write(&mut self, mut t: Rec) -> Result<Rec> {
        let text = s(&t, "text");
        t.shift_remove("text");
        t.insert("updated".into(), json!(now()));
        self.put(&self.root.join("trails").join(format!("{}.md", s(&t, "id"))), &dump_md(&t, &text))?;
        t.insert("text".into(), json!(text));
        Ok(t)
    }

    pub fn set_trail_status(&mut self, id: &str, status: &str) -> Result<Rec> {
        if status != "open" && status != "done" {
            return Err(bad("A trail is either open or done."));
        }
        let mut t = self.trails.iter().find(|t| s(t, "id") == id).cloned().ok_or_else(|| missing("No such trail."))?;
        t.insert("status".into(), json!(status));
        self.trail_write(t)
    }

    pub fn update_trail(&mut self, id: &str, text: &str) -> Result<Rec> {
        let text = text.trim();
        if text.is_empty() {
            return Err(bad("A trail needs some text. To remove it, delete the trail."));
        }
        let mut t = self.trails.iter().find(|t| s(t, "id") == id).cloned().ok_or_else(|| missing("No such trail."))?;
        t.insert("text".into(), json!(text));
        self.trail_write(t)
    }

    pub fn delete_trail(&mut self, id: &str) -> Result<()> {
        if !self.trails.iter().any(|t| s(t, "id") == id) {
            return Err(missing("No such trail."));
        }
        self.trash(&self.root.join("trails").join(format!("{id}.md")))
    }

    // ---- sets ----

    pub fn sets(&self) -> Vec<Rec> {
        let mut v: Vec<Rec> = self.sets.clone();
        v.sort_by_key(|t| s(t, "name").to_lowercase());
        v
    }

    fn set(&self, id: &str) -> Result<Rec> {
        self.sets.iter().find(|t| s(t, "id") == id).cloned().ok_or_else(|| missing("No such set."))
    }

    /// A set by exact name or id, else a unique start of a name, else a unique part of one.
    pub fn find_set(&self, name: &str) -> Result<Rec> {
        let n = name.trim().to_lowercase();
        let every = self.sets();
        let pools: [Vec<&Rec>; 3] = [
            every.iter().filter(|t| s(t, "id") == n || s(t, "name").to_lowercase() == n).collect(),
            every.iter().filter(|t| s(t, "name").to_lowercase().starts_with(&n)).collect(),
            every.iter().filter(|t| s(t, "name").to_lowercase().contains(&n)).collect(),
        ];
        let hit: Vec<&Rec> = if n.is_empty() { vec![] } else { pools.into_iter().find(|p| !p.is_empty()).unwrap_or_default() };
        if hit.is_empty() {
            return Err(missing(format!("No set called “{}”.", cut(name.trim(), 60))));
        }
        if hit.len() > 1 {
            return Err(bad(format!("Which set? {}", hit.iter().map(|t| s(t, "name")).collect::<Vec<_>>().join(", "))));
        }
        Ok(hit[0].clone())
    }

    fn write_set(&mut self, t: &mut Rec) -> Result<()> {
        t.insert("updated".into(), json!(now()));
        let mut meta = Rec::new();
        for k in ["name", "created", "updated"] {
            meta.insert(k.into(), t[k].clone());
        }
        let bullets: Vec<String> = t["items"].as_array().unwrap().iter().map(|i| format!("- {}", py_dumps(i))).collect();
        let body = format!("{}\n\n{}", s(t, "note"), bullets.join("\n"));
        let id = s(t, "id");
        self.put(&self.root.join("sets").join(format!("{id}.md")), &dump_md(&meta, &body))
    }

    fn set_item(raw: &Value) -> Result<Rec> {
        let kind = raw.get("kind").and_then(|k| k.as_str()).unwrap_or("");
        if !SET_KINDS.contains(&kind) {
            return Err(bad("A set holds panes, threads, places, notes, lessons and PDFs."));
        }
        if kind == "pane" {
            let params = raw.get("params").cloned().unwrap_or(json!({}));
            if raw.get("type").is_none_or(|v| v.as_str() == Some("")) || raw.get("id").is_none_or(|v| v.as_str() == Some("")) || !params.is_object() {
                return Err(bad("That pane cannot be kept in a set."));
            }
            let title = raw.get("title").and_then(|t| t.as_str()).filter(|t| !t.is_empty()).unwrap_or("Pane");
            return Ok(json!({"kind": kind, "type": raw["type"].as_str().unwrap_or_default(), "id": raw["id"].as_str().unwrap_or_default(),
                "title": cut(title, 200), "params": params}).as_object().unwrap().clone());
        }
        let r = raw.get("ref").and_then(|r| r.as_str()).unwrap_or("").trim().to_string();
        if r.is_empty() {
            return Err(bad(format!("Say which {} to add.", if kind == "pdf" { "PDF" } else { kind })));
        }
        let r = if kind == "place" { anchors::canonical(&r)? } else { r };
        Ok(json!({"kind": kind, "ref": r}).as_object().unwrap().clone())
    }

    fn same_item(a: &Value, b: &Rec) -> bool {
        if a["kind"] != b["kind"] {
            return false;
        }
        if b["kind"] == "pane" {
            (a.get("type"), a.get("params")) == (b.get("type"), b.get("params"))
        } else {
            a.get("ref") == b.get("ref")
        }
    }

    fn add_items(t: &mut Rec, raw: &[Value]) -> Result<Vec<String>> {
        let mut keys = vec![];
        for r in raw {
            let item = Self::set_item(r)?;
            let items = t["items"].as_array_mut().unwrap();
            let key = match items.iter().find(|i| Self::same_item(i, &item)) {
                Some(h) => h["key"].as_str().unwrap().to_string(),
                None => {
                    let key = format!("i{}", random_hex(4));
                    let mut h = json!({"key": key}).as_object().unwrap().clone();
                    h.extend(item);
                    items.push(Value::Object(h));
                    key
                }
            };
            keys.push(key);
        }
        Ok(keys)
    }

    pub fn create_set(&mut self, name: &str, items: &[Value]) -> Result<Rec> {
        let name = name.trim();
        if name.is_empty() {
            return Err(bad("A set needs a name."));
        }
        if self.sets.iter().any(|t| s(t, "name").to_lowercase() == name.to_lowercase()) {
            return Err(bad(format!("There is already a set called “{name}”.")));
        }
        let mut t = json!({"id": self.slug(name, "sets"), "name": cut(name, 120), "created": now(), "updated": now(), "note": "", "items": []}).as_object().unwrap().clone();
        let keys = Self::add_items(&mut t, items)?;
        self.write_set(&mut t)?;
        t.insert("keys".into(), json!(keys));
        Ok(t)
    }

    pub fn add_to_set(&mut self, id: &str, items: &[Value]) -> Result<Rec> {
        let mut t = self.set(id)?;
        let keys = Self::add_items(&mut t, items)?;
        self.write_set(&mut t)?;
        t.insert("keys".into(), json!(keys));
        Ok(t)
    }

    pub fn remove_from_set(&mut self, id: &str, keys: &[String]) -> Result<Rec> {
        let mut t = self.set(id)?;
        t["items"].as_array_mut().unwrap().retain(|i| !keys.iter().any(|k| i["key"] == *k));
        self.write_set(&mut t)?;
        Ok(t)
    }

    pub fn rename_set(&mut self, id: &str, name: &str) -> Result<Rec> {
        self.update_set(id, Some(name), &[])
    }

    /// name: call it this. panes: [{key, title, params}], what its open panes show now, so reopening brings back the
    /// same view.
    pub fn update_set(&mut self, id: &str, name: Option<&str>, panes: &[Value]) -> Result<Rec> {
        let mut t = self.set(id)?;
        if let Some(name) = name {
            let name = name.trim();
            if name.is_empty() {
                return Err(bad("A set needs a name."));
            }
            if self.sets.iter().any(|o| s(o, "id") != id && s(o, "name").to_lowercase() == name.to_lowercase()) {
                return Err(bad(format!("There is already a set called “{name}”.")));
            }
            t.insert("name".into(), json!(cut(name, 120)));
        }
        for i in t["items"].as_array_mut().unwrap() {
            let Some(p) = panes.iter().find(|p| p.get("key") == i.get("key")) else { continue };
            if i["kind"] == "pane" {
                let title = p.get("title").and_then(|x| x.as_str()).filter(|x| !x.is_empty()).map(String::from).unwrap_or_else(|| i["title"].as_str().unwrap_or("").to_string());
                i["title"] = json!(cut(&title, 200));
                i["params"] = p.get("params").cloned().unwrap_or_else(|| i["params"].clone());
            }
        }
        self.write_set(&mut t)?;
        Ok(t)
    }

    pub fn delete_set(&mut self, id: &str) -> Result<()> {
        self.set(id)?;
        self.trash(&self.root.join("sets").join(format!("{id}.md")))
    }

    // ---- the day's log, layouts ----

    pub fn log_event(&self, text: &str, result: &str) -> Result<Value> {
        let text = cut(&text.split_whitespace().collect::<Vec<_>>().join(" "), 300);
        if text.is_empty() {
            return Err(bad("Nothing to log."));
        }
        let local = chrono::Local::now();
        let entry = json!({"t": local.format("%H:%M:%S").to_string(), "text": text, "result": cut(&result.split_whitespace().collect::<Vec<_>>().join(" "), 300)});
        let path = self.root.join("sessions").join(format!("{}.jsonl", local.format("%Y-%m-%d")));
        fs::create_dir_all(path.parent().unwrap())?;
        use std::io::Write;
        let mut f = fs::OpenOptions::new().create(true).append(true).open(&path)?;
        f.write_all((py_dumps(&entry) + "\n").as_bytes())?;
        Ok(entry)
    }

    pub fn log_day(&self, day: Option<&str>) -> Result<Value> {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let day = day.filter(|d| !d.is_empty()).unwrap_or(&today).to_string();
        let ok = day.len() == 10 && day.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
        if !ok {
            return Err(bad("A day looks like 2026-10-18."));
        }
        let entries: Vec<Value> = read(&self.root.join("sessions").join(format!("{day}.jsonl")))
            .map(|t| t.lines().filter_map(|l| serde_json::from_str(l).ok()).collect())
            .unwrap_or_default();
        let mut days: Vec<String> = files(&self.root.join("sessions"), ".jsonl", false).iter().map(|p| stem(p)).collect();
        days.sort_by(|a, b| b.cmp(a));
        Ok(json!({"day": day, "entries": entries, "days": days}))
    }

    pub fn save_layout(&self, name: &str, layout: &Value) -> Result<Value> {
        let name = cut(name.trim(), 60);
        if name.is_empty() {
            return Err(bad("A layout needs a name."));
        }
        if !layout.is_object() {
            return Err(bad("There is no layout to save."));
        }
        let slug = slug_base(&name, "layout");
        let text = py_dumps_indent1(&json!({"name": name, "saved": now(), "layout": layout})) + "\n";
        write_atomic(&self.root.join("sessions").join("layouts").join(format!("{slug}.json")), &text)?;
        Ok(json!({"name": name, "id": slug}))
    }

    pub fn layouts(&self) -> Vec<Value> {
        let mut out: Vec<Value> = files(&self.root.join("sessions").join("layouts"), ".json", false)
            .iter()
            .filter_map(|p| {
                let d: Value = serde_json::from_str(&read(p)?).ok()?;
                Some(json!({"id": stem(p), "name": d.get("name")?.as_str()?, "saved": d.get("saved").and_then(|s| s.as_str()).unwrap_or("")}))
            })
            .collect();
        out.sort_by_key(|x| x["name"].as_str().unwrap().to_lowercase());
        out
    }

    pub fn layout(&self, name: &str) -> Result<Value> {
        let n = name.trim().to_lowercase();
        let every = self.layouts();
        let exact: Vec<&Value> = every.iter().filter(|x| x["name"].as_str().unwrap().to_lowercase() == n || x["id"] == n.as_str()).collect();
        let hit = if exact.is_empty() { every.iter().filter(|x| x["name"].as_str().unwrap().to_lowercase().starts_with(&n)).collect() } else { exact };
        if hit.is_empty() {
            return Err(missing(format!("No saved layout called “{}”.", cut(name.trim(), 60))));
        }
        if hit.len() > 1 {
            return Err(bad(format!("Which layout? {}", hit.iter().map(|x| x["name"].as_str().unwrap()).collect::<Vec<_>>().join(", "))));
        }
        let p = self.root.join("sessions").join("layouts").join(format!("{}.json", hit[0]["id"].as_str().unwrap()));
        serde_json::from_str(&read(&p).unwrap_or_default()).map_err(|_| bad("bad request"))
    }
}

pub fn parse_thread(stem: &str, text: &str) -> Option<Rec> {
    let (meta, body) = parse_md(text);
    if s(&meta, "name").is_empty() {
        return None;
    }
    let (note, tail) = match body.rfind(ANCHORS_MARK) {
        Some(at) => (body[..at].to_string(), body[at + ANCHORS_MARK.len()..].to_string()),
        None => (body.clone(), String::new()),
    };
    let mut members = vec![];
    for line in tail.lines() {
        // ^- (\S+) \| (.*)$
        let Some(rest) = line.strip_prefix("- ") else { continue };
        let Some((a, q)) = rest.split_once(" | ") else { continue };
        if a.is_empty() || a.contains(char::is_whitespace) {
            continue;
        }
        let (Ok(quote), Ok(anchor)) = (serde_json::from_str::<Value>(q), anchors::canonical(a)) else { continue };
        members.push(json!({"anchor": anchor, "quote": quote}));
    }
    let color = check_color(meta.get("color").and_then(|c| c.as_str())).ok().flatten().unwrap_or_default();
    Some(json!({"id": stem, "name": meta["name"], "created": s(&meta, "created"), "updated": s(&meta, "updated"), "color": color,
        "note": note.trim(), "members": members}).as_object().unwrap().clone())
}

fn parse_set(stem: &str, text: &str) -> Option<Rec> {
    let (meta, body) = parse_md(text);
    if s(&meta, "name").is_empty() {
        return None;
    }
    let (mut items, mut note) = (vec![], vec![]);
    for line in body.lines() {
        if !line.starts_with("- {") {
            note.push(line);
            continue;
        }
        let Ok(item) = serde_json::from_str::<Value>(&line[2..]) else { continue };
        if item.get("key").and_then(|k| k.as_str()).is_some_and(|k| !k.is_empty()) && item.get("kind").and_then(|k| k.as_str()).is_some_and(|k| SET_KINDS.contains(&k)) {
            items.push(item);
        }
    }
    Some(json!({"id": stem, "name": meta["name"], "created": s(&meta, "created"), "updated": s(&meta, "updated"),
        "note": note.join("\n").trim(), "items": items}).as_object().unwrap().clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_round_trip() {
        let meta = json!({"id": "n_1", "quote": "a “b”", "n": 3}).as_object().unwrap().clone();
        let text = dump_md(&meta, "\nThe note.\n\n");
        assert_eq!(text, "---\nid: \"n_1\"\nquote: \"a “b”\"\nn: 3\n---\n\nThe note.\n");
        let (m, body) = parse_md(&text);
        assert_eq!(m, meta);
        assert_eq!(body, "The note.\n");
    }

    #[test]
    fn python_separators() {
        assert_eq!(py_dumps(&json!({"key": "i1", "kind": "place", "params": {"a": [1, 2]}})), r#"{"key": "i1", "kind": "place", "params": {"a": [1, 2]}}"#);
        assert_eq!(slug_base("Phinehas echoes!", "thread"), "phinehas-echoes");
        assert_eq!(slug_base("—", "thread"), "thread");
    }
}
