//! The study folder, read and written in the Python app's formats (`workbench/study.py`), so both apps can open it:
//!
//! ```text
//! notes/<CODE>/<id>.md      one note per file (notes about an original word live in notes/_words/)
//! highlights/<CODE>.json    colored anchors, one file per book
//! threads/<slug>.md         a named set of anchors with the person's note
//! trails/<id>.md            questions waiting to be followed up
//! sets/<slug>.md            a named group of threads, places, notes, lessons, PDFs and panes
//! settings/palette.json     saved custom colors
//! sessions/<day>.jsonl      what was typed into the capture box, by day; sessions/layouts/*.json pane layouts
//! .trash/                   anything deleted is moved here, never erased
//! ```
//!
//! Records are JSON objects with their keys in the order the files have them, as the Python app holds them in dicts.
//! A `Store` reads the folder when it is opened (a `wb` command opens one each run).

use crate::anchors;
use crate::{Error, Result};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

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

pub struct Store {
    pub root: PathBuf,
    notes: Vec<Rec>,
    hl: Vec<(String, Vec<Rec>)>,
    threads: Vec<Rec>,
    trails: Vec<Rec>,
    sets: Vec<Rec>,
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

fn stem(p: &Path) -> String {
    p.file_stem().unwrap_or_default().to_string_lossy().into_owned()
}

fn read(p: &Path) -> Option<String> {
    fs::read_to_string(p).ok()
}

impl Store {
    pub fn open(root: &Path) -> Result<Store> {
        crate::study::Study::open(root)?; // the same guard: never the real folder unless allowed
        let mut st = Store { root: root.to_path_buf(), notes: vec![], hl: vec![], threads: vec![], trails: vec![], sets: vec![] };
        st.load()?;
        Ok(st)
    }

    fn load(&mut self) -> Result<()> {
        let r = self.root.clone();
        self.notes = files(&r.join("notes"), ".md", true).iter().filter_map(|p| Self::note_like(&read(p)?)).collect();
        self.trails = files(&r.join("trails"), ".md", false).iter().filter_map(|p| Self::note_like(&read(p)?)).collect();
        self.hl = files(&r.join("highlights"), ".json", false)
            .iter()
            .filter_map(|p| {
                let v: Value = serde_json::from_str(&read(p)?).ok()?;
                let items = v.get("highlights")?.as_array()?.iter().filter_map(|h| h.as_object().cloned()).collect();
                Some((stem(p), items))
            })
            .collect();
        self.threads = files(&r.join("threads"), ".md", false).iter().filter_map(|p| parse_thread(&stem(p), &read(p)?)).collect();
        self.sets = files(&r.join("sets"), ".md", false).iter().filter_map(|p| parse_set(&stem(p), &read(p)?)).collect();
        Ok(())
    }

    fn note_like(text: &str) -> Option<Rec> {
        let (mut meta, body) = parse_md(text);
        if s(&meta, "id").is_empty() || s(&meta, "anchor").is_empty() {
            return None;
        }
        meta.insert("text".into(), json!(body.trim()));
        Some(meta)
    }

    fn trash(&self, path: &Path) -> Result<()> {
        let dest = self.root.join(".trash").join(format!("{}-{}", chrono::Utc::now().format("%Y%m%d-%H%M%S"), path.file_name().unwrap().to_string_lossy()));
        fs::create_dir_all(dest.parent().unwrap())?;
        fs::rename(path, dest)?;
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
        write_atomic(&self.note_path(&meta), &dump_md(&meta, text))?;
        let mut n = meta;
        n.insert("text".into(), json!(text));
        self.notes.push(n.clone());
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
        write_atomic(&self.note_path(&meta), &dump_md(&meta, text))?;
        meta.insert("text".into(), json!(text));
        // A file written moves to the end of what is held, as in the Python app (it decides ties between equal times).
        self.notes.remove(at);
        self.notes.push(meta.clone());
        Ok(meta)
    }

    pub fn delete_note(&mut self, id: &str) -> Result<()> {
        let at = self.notes.iter().position(|n| s(n, "id") == id).ok_or_else(|| missing("No such note."))?;
        let n = self.notes.remove(at);
        self.trash(&self.note_path(&n))
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
            write_atomic(&path, &(py_dumps_indent1(&json!({"highlights": items})) + "\n"))?;
        } else if path.exists() {
            self.trash(&path)?;
        }
        self.hl.retain(|(c, _)| c != code);
        if !path.exists() {
            return Ok(());
        }
        self.hl.push((code.into(), items));
        Ok(())
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
        write_atomic(&self.root.join("threads").join(format!("{id}.md")), &dump_md(&meta, &body))?;
        self.threads.retain(|x| s(x, "id") != id);
        self.threads.push(t.clone());
        Ok(())
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
        self.threads.retain(|t| s(t, "id") != id);
        self.trash(&self.root.join("threads").join(format!("{id}.md")))
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
        write_atomic(&self.root.join("trails").join(format!("{}.md", s(&meta, "id"))), &dump_md(&meta, text))?;
        let mut t = meta;
        t.insert("text".into(), json!(text));
        self.trails.push(t.clone());
        Ok(t)
    }

    fn trail_write(&mut self, mut t: Rec) -> Result<Rec> {
        let text = s(&t, "text");
        t.shift_remove("text");
        t.insert("updated".into(), json!(now()));
        write_atomic(&self.root.join("trails").join(format!("{}.md", s(&t, "id"))), &dump_md(&t, &text))?;
        t.insert("text".into(), json!(text));
        let id = s(&t, "id");
        self.trails.retain(|x| s(x, "id") != id);
        self.trails.push(t.clone());
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
        self.trails.retain(|t| s(t, "id") != id);
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
        write_atomic(&self.root.join("sets").join(format!("{id}.md")), &dump_md(&meta, &body))?;
        let mut stored = t.clone();
        stored.shift_remove("keys");
        self.sets.retain(|x| s(x, "id") != id);
        self.sets.push(stored);
        Ok(())
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
        let mut t = self.set(id)?;
        let name = name.trim();
        if name.is_empty() {
            return Err(bad("A set needs a name."));
        }
        if self.sets.iter().any(|o| s(o, "id") != id && s(o, "name").to_lowercase() == name.to_lowercase()) {
            return Err(bad(format!("There is already a set called “{name}”.")));
        }
        t.insert("name".into(), json!(cut(name, 120)));
        self.write_set(&mut t)?;
        Ok(t)
    }

    pub fn delete_set(&mut self, id: &str) -> Result<()> {
        self.set(id)?;
        self.sets.retain(|t| s(t, "id") != id);
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
