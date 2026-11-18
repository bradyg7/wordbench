//! Margin notes (design/features/marks, accepted 2026-11-17: MK-3, MK-7 to MK-10, MK-12 to MK-14, MK-17 to MK-19).
//!
//! A margin note is a thought caught while reading, kept at one verse, one passage of a chapter or one chapter. It lives in
//! `margin/<BOOK>/<chapter>.md`, one Markdown file per chapter (at most 1,189 files), each note under a heading that names
//! its place, then a marker line holding the note's id, its place and the date it was written, then its words:
//!
//! ```text
//! ---
//! book: "NUM"
//! chapter: 25
//! ---
//!
//! # Numbers 25
//!
//! ## Numbers 25:11
//! <!-- margin id=m_20261117090000_ab12 at=NUM.25:11 written=2026-11-17 -->
//! Your own words.
//! ```
//!
//! A question is the same callout line as in a page (`> [!question] …`, `> [!done] …`). A margin note grows into a page
//! without moving: the page's first block is a ```` ```jot ```` fence holding only the note's id, and the "grew into" line
//! is found from the pages, never stored (deleting the page leaves the note). A note deleted is copied to `.trash/` first.
//! Nothing here touches a file the person already has: a note placed with an `anchor` (the old form) is only read.

use crate::anchors::{self, Anchor};
use crate::bible::Bible;
use crate::notebook as nb;
use crate::pageindex;
use crate::pages::{chars, jot_fence, split, sub};
use crate::places::{parse_span, span_label, Span};
use crate::questions::{question_md, question_of};
use crate::store::{write_atomic_unique, bad, guard, missing, new_id, places_of, s, write_atomic, Store};
use crate::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const MARKER: &str = "<!-- margin ";

/// Where a margin note is: a chapter (`v1` = 0), a verse (`v1` = `v2`) or a passage of one chapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct At {
    pub code: String,
    pub c: u32,
    pub v1: u32,
    pub v2: u32,
}

impl At {
    pub fn id(&self) -> String {
        match (self.v1, self.v2) {
            (0, _) => format!("{}.{}", self.code, self.c),
            (a, b) if a == b => format!("{}.{}:{a}", self.code, self.c),
            (a, b) => format!("{}.{}:{a}-{b}", self.code, self.c),
        }
    }

    /// `NUM.25`, `NUM.25:11` or `NUM.25:10-13`.
    pub fn parse(t: &str) -> Option<At> {
        let (code, rest) = t.trim().split_once('.')?;
        if code.len() != 3 || !code.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) {
            return None;
        }
        let (c, vs) = match rest.split_once(':') {
            Some((c, v)) => (c, Some(v)),
            None => (rest, None),
        };
        let c: u32 = c.parse().ok()?;
        let (v1, v2) = match vs {
            None => (0, 0),
            Some(v) => match v.split_once('-') {
                Some((a, b)) => (a.parse().ok()?, b.parse().ok()?),
                None => {
                    let a: u32 = v.parse().ok()?;
                    (a, a)
                }
            },
        };
        if c == 0 || (v1 != 0 && (v1 > v2)) || (vs.is_some() && v1 == 0) {
            return None;
        }
        Some(At { code: code.into(), c, v1, v2 })
    }

    pub fn kind(&self) -> &'static str {
        if self.v1 == 0 {
            "chapter"
        } else if self.v1 == self.v2 {
            "verse"
        } else {
            "passage"
        }
    }

    pub fn covers(&self, v: u32) -> bool {
        self.v1 == 0 || (self.v1 <= v && v <= self.v2)
    }

    pub fn label(&self, bible: &Bible) -> String {
        match bible.books().iter().find(|b| b.code == self.code) {
            Some(b) => span_label(&Span { book: b.clone(), c1: self.c, v1: self.v1, c2: self.c, v2: self.v2 }),
            None => self.id(),
        }
    }

    /// A place as typed (or an id like `NUM.25:11`) → where a margin note goes. One chapter at most.
    pub fn from_place(bible: &Bible, text: &str) -> Result<At> {
        if let Some(a) = At::parse(text) {
            return At::checked(bible, a);
        }
        let sp = parse_span(text, bible.books())?;
        if sp.c1 != sp.c2 {
            return Err(bad("A margin note is on a verse, a passage in one chapter, or a chapter (Num 25:11, Num 25:10-13, Num 25)."));
        }
        let (v1, v2) = if sp.v1 == 0 { (0, 0) } else { (sp.v1, if sp.v2 == 0 { sp.v1 } else { sp.v2 }) };
        At::checked(bible, At { code: sp.book.code.clone(), c: sp.c1, v1, v2 })
    }

    fn checked(bible: &Bible, a: At) -> Result<At> {
        let book = bible.books().iter().find(|b| b.code == a.code).ok_or_else(|| bad(format!("No book {}.", a.code)))?;
        if a.c > book.chapters {
            return Err(bad(format!("{} has {} chapter{}.", book.name, book.chapters, if book.chapters == 1 { "" } else { "s" })));
        }
        if a.v1 != 0 {
            let last = bible.last_verse(&a.code, a.c)?;
            if a.v2 > last {
                return Err(bad(format!("{} {} has {last} verses.", book.name, a.c)));
            }
        }
        Ok(a)
    }
}

/// One margin note as its file holds it.
#[derive(Debug, Clone)]
pub struct Note {
    pub id: String,
    pub at: At,
    pub text: String,
    pub written: String,
    /// The words it names, when it was written with words selected (MK-9).
    pub words: String,
}

impl Note {
    fn render(&self, bible: &Bible) -> String {
        let mut marker = format!("{MARKER}id={} at={} written={}", self.id, self.at.id(), self.written);
        if !self.words.is_empty() {
            marker += &format!(" words={}", json!(self.words));
        }
        format!("## {}\n{marker} -->\n{}\n", self.at.label(bible), self.text.trim_matches('\n'))
    }
}

fn dir(root: &Path) -> PathBuf {
    root.join("margin")
}

fn file(root: &Path, code: &str, chapter: u32) -> PathBuf {
    dir(root).join(code).join(format!("{chapter}.md"))
}

fn parse_marker(line: &str) -> Option<(String, At, String, String)> {
    let inner = line.trim().strip_prefix(MARKER)?.strip_suffix("-->")?.trim();
    let (head, words) = match inner.split_once(" words=") {
        Some((h, w)) => (h, serde_json::from_str::<String>(w.trim()).unwrap_or_default()),
        None => (inner, String::new()),
    };
    let (mut id, mut at, mut written) = (String::new(), None, String::new());
    for t in head.split_whitespace() {
        match t.split_once('=') {
            Some(("id", v)) => id = v.into(),
            Some(("at", v)) => at = At::parse(v),
            Some(("written", v)) => written = v.into(),
            _ => {}
        }
    }
    if id.is_empty() {
        return None;
    }
    Some((id, at?, written, words))
}

fn parse_file(text: &str) -> Vec<Note> {
    parse_full(text).1
}

/// A chapter file as a person may have left it by hand: the text above the first note (after the front matter and the title)
/// is kept as the `preface`, and the notes with it. A note's body runs to the next note's heading, or, where that heading
/// was deleted by hand, to the next note's marker: no body line is cut.
fn parse_full(text: &str) -> (String, Vec<Note>) {
    let text = text.replace("\r\n", "\n");
    let lines: Vec<&str> = text.lines().collect();
    let marks: Vec<usize> = (0..lines.len()).filter(|&i| lines[i].trim_start().starts_with(MARKER) && parse_marker(lines[i]).is_some()).collect();
    let heading_of = |i: usize| i > 0 && lines[i - 1].starts_with("## ");
    let mut out = vec![];
    for (k, &i) in marks.iter().enumerate() {
        let (id, at, written, words) = parse_marker(lines[i]).unwrap();
        let end = marks.get(k + 1).map(|&n| if heading_of(n) { n - 1 } else { n }).unwrap_or(lines.len());
        let body = lines[i + 1..end.max(i + 1)].join("\n");
        out.push(Note { id, at, text: body.trim_matches('\n').trim_end().to_string(), written, words });
    }
    // above the first note: front matter and the "# Book N" title are ours; anything else is the person's
    let top = marks.first().map(|&i| if heading_of(i) { i - 1 } else { i }).unwrap_or(lines.len());
    let mut head: Vec<&str> = lines[..top].to_vec();
    if head.first().is_some_and(|l| l.trim() == "---") {
        if let Some(close) = head.iter().skip(1).position(|l| l.trim() == "---") {
            head.drain(..=close + 1);
        }
    }
    if let Some(t) = head.iter().position(|l| !l.trim().is_empty()) {
        if head[t].starts_with("# ") {
            head.remove(t);
        }
    }
    (head.join("\n").trim_matches('\n').trim_end().to_string(), out)
}

type Sig = (std::time::SystemTime, u64);
/// Chapter files already parsed, by path and by a hash of what the file holds: a file's text is always read (an edit that keeps
/// the same time and size, by hand or by another process, is still seen), and only the parse is skipped when the text is as
/// it was.
static READ: std::sync::Mutex<Option<HashMap<PathBuf, (u64, Vec<Note>)>>> = std::sync::Mutex::new(None);

fn hash_of(text: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    text.hash(&mut h);
    h.finish()
}

fn read_path(p: &Path) -> Vec<Note> {
    let Ok(text) = std::fs::read_to_string(p) else {
        READ.lock().unwrap_or_else(|e| e.into_inner()).as_mut().map(|m| m.remove(p));
        return vec![];
    };
    let hash = hash_of(&text);
    let mut guard = READ.lock().unwrap_or_else(|e| e.into_inner());
    let map = guard.get_or_insert_with(HashMap::new);
    if let Some((h0, notes)) = map.get(p) {
        if *h0 == hash {
            return notes.clone();
        }
    }
    let notes = parse_file(&text);
    map.insert(p.to_path_buf(), (hash, notes.clone()));
    notes
}

fn read_chapter(root: &Path, code: &str, chapter: u32) -> Vec<Note> {
    read_path(&file(root, code, chapter))
}

/// A chapter file's lock while one writer changes it: a file made only if it is not there, taken away when the writer is done
/// (or found older than ten seconds, a writer that died). Two writers of one chapter wait for each other, so neither's note is
/// dropped.
struct ChapterLock(PathBuf);

impl ChapterLock {
    fn take(chapter_file: &Path) -> Result<ChapterLock> {
        let lock = chapter_file.with_extension("md.lock");
        if let Some(d) = lock.parent() {
            std::fs::create_dir_all(d)?;
        }
        for _ in 0..600 {
            match std::fs::OpenOptions::new().write(true).create_new(true).open(&lock) {
                Ok(_) => return Ok(ChapterLock(lock)),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    let old = std::fs::metadata(&lock).and_then(|m| m.modified()).ok().and_then(|t| t.elapsed().ok()).is_some_and(|d| d > std::time::Duration::from_secs(10));
                    if old {
                        let _ = std::fs::remove_file(&lock);
                    } else {
                        std::thread::sleep(std::time::Duration::from_millis(5));
                    }
                }
                Err(e) => return Err(e.into()),
            }
        }
        Err(bad("Another writer is changing this margin file. Nothing was lost; try again."))
    }
}

impl Drop for ChapterLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Change one chapter's file: take its lock, read its text, let `f` change the notes, write the result. The window and a `wb`
/// call, or two calls, wait for one another. The text is also hashed again just before the write: if an editor (not this app)
/// changed the file meanwhile, the edit is made again on the new text (five tries).
fn update_chapter(bible: &Bible, root: &Path, code: &str, chapter: u32, f: &mut dyn FnMut(&mut Vec<Note>) -> Result<()>) -> Result<()> {
    guard(root)?;
    let p = file(root, code, chapter);
    let _lock = ChapterLock::take(&p)?;
    for _ in 0..5 {
        let text = std::fs::read_to_string(&p).unwrap_or_default();
        let seen = hash_of(&text);
        let (preface, mut notes) = parse_full(&text);
        f(&mut notes)?;
        forget_snapshot();
        if notes.is_empty() && preface.is_empty() {
            if std::fs::read_to_string(&p).map(|t| hash_of(&t)).unwrap_or(hash_of("")) != seen {
                continue;
            }
            if p.exists() {
                std::fs::remove_file(&p)?;
            }
            READ.lock().unwrap_or_else(|e| e.into_inner()).as_mut().map(|m| m.remove(&p));
            return Ok(());
        }
        notes.sort_by(|a, b| (a.at.v1, a.at.v2, &a.written, &a.id).cmp(&(b.at.v1, b.at.v2, &b.written, &b.id)));
        let name = bible.books().iter().find(|b| b.code == code).map(|b| b.name.clone()).unwrap_or_else(|| code.into());
        let mut out = format!("---\nbook: \"{code}\"\nchapter: {chapter}\n---\n\n# {name} {chapter}\n\n");
        if !preface.is_empty() {
            out += &format!("{preface}\n\n");
        }
        for n in &notes {
            out += &n.render(bible);
            out.push('\n');
        }
        if std::fs::read_to_string(&p).map(|t| hash_of(&t)).unwrap_or(hash_of("")) != seen {
            continue;
        }
        write_atomic_unique(&p, &(out.trim_end_matches('\n').to_string() + "\n"))?;
        READ.lock().unwrap_or_else(|e| e.into_inner()).as_mut().map(|m| m.remove(&p));
        return Ok(());
    }
    Err(bad(format!("The margin's file for {code} {chapter} kept changing while it was being written. Nothing was lost; try again.")))
}

/// Every chapter file of the margin: (book code, chapter, path), in the Bible's order of codes' files.
fn chapter_files(root: &Path) -> Vec<(String, u32, PathBuf)> {
    let mut out = vec![];
    let Ok(rd) = std::fs::read_dir(dir(root)) else { return out };
    for b in rd.flatten() {
        let code = b.file_name().to_string_lossy().into_owned();
        let Ok(files) = std::fs::read_dir(b.path()) else { continue };
        for f in files.flatten() {
            let name = f.file_name().to_string_lossy().into_owned();
            if let Some(ch) = name.strip_suffix(".md").and_then(|n| n.parse::<u32>().ok()) {
                out.push((code.clone(), ch, f.path()));
            }
        }
    }
    out
}

/// What the margin's folder holds, for `wb study check`: (chapter files, notes). Reads only.
pub fn held(root: &Path) -> (usize, usize) {
    let files = chapter_files(root);
    (files.len(), files.iter().map(|(_, _, p)| read_path(p).len()).sum())
}

fn book_order(bible: &Bible, code: &str) -> u32 {
    bible.books().iter().find(|b| b.code == code).map(|b| b.id).unwrap_or(999)
}

/// Every margin note, in the Bible's order, kept while the margin's folders and files are as they were (each one's time and size
/// are looked at on every call, so another process's `wb margin` write is seen at once; the limit: an edit in place that keeps
/// both the size and the file's time to the tick is not seen until something else changes, though every edit made through
/// `wb margin` reads the file's text itself, never this snapshot): the one search and the Library's counts
/// go over all of them. A note this process writes drops it too.
struct Snap {
    root: PathBuf,
    seen: Vec<(PathBuf, Sig)>,
    notes: std::sync::Arc<Vec<Note>>,
}
static SNAP: std::sync::Mutex<Option<Snap>> = std::sync::Mutex::new(None);

fn forget_snapshot() {
    *SNAP.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Every book folder and chapter file of the margin with its time and size, from the directory listings themselves (no file is
/// opened: one listing per book folder).
fn scan(root: &Path) -> Vec<(PathBuf, Sig)> {
    let sig = |m: std::io::Result<std::fs::Metadata>| m.ok().map(|m| (m.modified().unwrap_or(std::time::UNIX_EPOCH), if m.is_dir() { 0 } else { m.len() }));
    let mut out = vec![];
    let Ok(rd) = std::fs::read_dir(dir(root)) else { return out };
    for b in rd.flatten() {
        if let Some(s) = sig(b.metadata()) {
            out.push((b.path(), s));
        }
        let Ok(files) = std::fs::read_dir(b.path()) else { continue };
        for f in files.flatten() {
            if let Some(s) = sig(f.metadata()) {
                out.push((f.path(), s));
            }
        }
    }
    out.sort();
    out
}

fn snapshot(bible: &Bible, store: &Store) -> std::sync::Arc<Vec<Note>> {
    let now = scan(&store.root);
    {
        let g = SNAP.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(sn) = g.as_ref() {
            if sn.root == store.root && sn.seen == now {
                return sn.notes.clone();
            }
        }
    }
    let mut files = chapter_files(&store.root);
    files.sort_by_key(|(c, ch, _)| (book_order(bible, c), *ch));
    let mut out = vec![];
    for (_, _, p) in files {
        out.extend(read_path(&p));
    }
    let out = std::sync::Arc::new(out);
    *SNAP.lock().unwrap_or_else(|e| e.into_inner()) = Some(Snap { root: store.root.clone(), seen: now, notes: out.clone() });
    out
}

/// Every margin note, in the Bible's order.
pub fn all(bible: &Bible, store: &Store) -> Vec<Note> {
    snapshot(bible, store).as_ref().clone()
}

fn find(bible: &Bible, store: &Store, id: &str) -> Result<Note> {
    let id = id.trim();
    all(bible, store).into_iter().find(|n| n.id == id).ok_or_else(|| missing(format!("No margin note {id}.")))
}

/// Where a margin note is, by id (for the page index: a page with the note's jot block names that place).
pub fn at_of(root: &Path, id: &str) -> Option<At> {
    for (code, ch, p) in chapter_files(root) {
        let _ = (&code, ch);
        if let Ok(t) = std::fs::read_to_string(&p) {
            if t.contains(id) {
                if let Some(n) = parse_file(&t).into_iter().find(|n| n.id == id) {
                    return Some(n.at);
                }
            }
        }
    }
    None
}

/// The pages that show a note in a jot block name its place through the page index: when the note goes or comes back, their
/// entries are worked out again.
fn refresh_pages(store: &Store, id: &str) {
    if let Some(pages) = jot_map(store).get(id) {
        let mut idx = store.index.borrow_mut();
        for (page, _) in pages {
            idx.forget(page);
        }
    }
}

/// `m_` and the second it was written, then its millisecond (so notes of one second still sort in the order they were written), then two random bytes.
fn stamped_id() -> String {
    let base = new_id("m");
    format!("{}{:03}{}", &base[..16], chrono::Utc::now().timestamp_subsec_millis(), &base[16..])
}

fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn check_text(text: &str) -> Result<()> {
    if text.trim().is_empty() {
        return Err(bad("Write the note."));
    }
    if text.lines().any(|l| l.trim_start().starts_with(MARKER)) {
        return Err(bad("A margin note cannot hold a line that starts with <!-- margin."));
    }
    Ok(())
}

// ---- the notes as JSON ---------------------------------------------------------------------------------------------------

/// The pages whose jot block holds each note's id: note id → [(page id, page title)].
fn jot_map(store: &Store) -> HashMap<String, Vec<(String, String)>> {
    let mut out: HashMap<String, Vec<(String, String)>> = HashMap::new();
    let pages = store.notes().into_iter().chain(store.inbox()).chain(store.on_thread());
    for r in pages {
        let text = s(r, "text");
        if !text.contains("jot") {
            continue;
        }
        let c = chars(&text);
        for b in split(&text, true).1 {
            if b.kind != "fence" {
                continue;
            }
            if let Some(id) = jot_fence(&sub(&c, b.start, b.end)) {
                out.entry(id).or_default().push((s(r, "id"), nb::title_of(&text)));
            }
        }
    }
    out
}

fn note_json(bible: &Bible, n: &Note, jots: &HashMap<String, Vec<(String, String)>>) -> Value {
    let q = question_of(&n.text);
    let first = n.text.lines().map(|l| l.trim_start_matches(['>', ' ']).trim()).find(|l| !l.is_empty()).unwrap_or("");
    let first = first.strip_prefix("[!question]").or_else(|| first.strip_prefix("[!done]")).unwrap_or(first).trim();
    json!({"id": n.id, "at": n.at.id(), "label": n.at.label(bible), "kind": n.at.kind(), "v1": n.at.v1, "v2": n.at.v2,
        "text": n.text, "first_line": nb::title_of(first), "question": q.is_some(), "done": q.as_ref().is_some_and(|x| x.done),
        "written": n.written, "year": n.written.get(..4).unwrap_or(""), "words": n.words,
        "grew": jots.get(&n.id).map(|v| v.iter().map(|(id, t)| json!({"id": id, "title": t})).collect::<Vec<_>>()).unwrap_or_default()})
}

// ---- writing ------------------------------------------------------------------------------------------------------------

/// Write a margin note at a verse, a passage or a chapter (`wb margin add`). With `question` it is the callout line.
pub fn add(bible: &Bible, store: &mut Store, place: &str, text: &str, question: bool, words: &str) -> Result<Value> {
    check_text(text)?;
    let at = At::from_place(bible, place)?;
    let body = if question && question_of(text).is_none() { question_md(false, text) } else { text.trim_matches('\n').to_string() };
    let note = Note { id: stamped_id(), at: at.clone(), text: body, written: today(), words: words.trim().to_string() };
    update_chapter(bible, &store.root, &at.code, at.c, &mut |notes| {
        notes.push(note.clone());
        Ok(())
    })?;
    Ok(note_json(bible, &note, &HashMap::new()))
}

fn change(bible: &Bible, store: &mut Store, id: &str, f: impl Fn(&mut Note) -> Result<()>) -> Result<Value> {
    let found = find(bible, store, id)?;
    let mut after: Option<Note> = None;
    update_chapter(bible, &store.root, &found.at.code, found.at.c, &mut |notes| {
        let n = notes.iter_mut().find(|n| n.id == found.id).ok_or_else(|| missing("That note is gone."))?;
        f(n)?;
        after = Some(n.clone());
        Ok(())
    })?;
    let after = after.ok_or_else(|| missing("That note is gone."))?;
    Ok(note_json(bible, &after, &jot_map(store)))
}

/// Replace a note's words (a question stays a question). Only its chapter's file is written.
pub fn edit(bible: &Bible, store: &mut Store, id: &str, text: &str) -> Result<Value> {
    check_text(text)?;
    change(bible, store, id, |n| {
        n.text = match question_of(&n.text) {
            Some(q) if question_of(text).is_none() => question_md(q.done, text),
            _ => text.trim_matches('\n').to_string(),
        };
        Ok(())
    })
}

/// Make a note a question (`question`), a question answered (`done`), or a plain note again (`note`).
pub fn set_kind(bible: &Bible, store: &mut Store, id: &str, kind: &str) -> Result<Value> {
    if !["note", "question", "done"].contains(&kind) {
        return Err(bad("A margin note is a note, a question or done."));
    }
    change(bible, store, id, |n| {
        let words = question_of(&n.text).map(|q| q.text).unwrap_or_else(|| n.text.clone());
        n.text = match kind {
            "question" => question_md(false, &words),
            "done" => question_md(true, &words),
            _ => words,
        };
        Ok(())
    })
}

/// Delete a margin note. It is copied to `.trash/` first (`restore` puts it back) and the pages keep their jot blocks.
pub fn rm(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let found = find(bible, store, id)?;
    guard(&store.root)?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let trash = store.root.join(".trash").join(format!("{stamp}-{}.md", found.id));
    update_chapter(bible, &store.root, &found.at.code, found.at.c, &mut |notes| {
        // the copy in the trash is the note as the file holds it now, not as the listing last saw it
        let at = notes.iter().position(|n| n.id == found.id).ok_or_else(|| missing("That note is gone."))?;
        write_atomic(&trash, &notes[at].render(bible))?;
        notes.remove(at);
        Ok(())
    })?;
    refresh_pages(store, &found.id);
    Ok(json!({"removed": found.id, "at": found.at.id(), "undo": format!("wb margin restore {}", found.id)}))
}

/// Put back a deleted margin note from `.trash/` (the newest copy of that id).
pub fn restore(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let id = id.trim();
    let Ok(rd) = std::fs::read_dir(store.root.join(".trash")) else { return Err(missing("Nothing in the trash.")) };
    let mut hits: Vec<PathBuf> = rd.flatten().map(|e| e.path()).filter(|p| p.file_name().is_some_and(|n| n.to_string_lossy().ends_with(&format!("-{id}.md")))).collect();
    hits.sort();
    let p = hits.pop().ok_or_else(|| missing(format!("No deleted margin note {id}.")))?;
    let n = parse_file(&std::fs::read_to_string(&p)?).into_iter().next().ok_or_else(|| bad("That file holds no margin note."))?;
    if find(bible, store, id).is_ok() {
        return Err(bad("That note is already in the margin."));
    }
    update_chapter(bible, &store.root, &n.at.code, n.at.c, &mut |notes| {
        notes.push(n.clone());
        Ok(())
    })?;
    std::fs::remove_file(p)?;
    refresh_pages(store, &n.id);
    Ok(note_json(bible, &n, &jot_map(store)))
}

/// Write at a verse and add it to a new page whose first line is the reference (M27's second choice). → the page.
pub fn add_to_new_page(bible: &Bible, store: &mut Store, place: &str, text: &str) -> Result<Value> {
    check_text(text)?;
    let at = At::from_place(bible, place)?;
    let page = crate::pages::new_page(bible, store, None, &format!("{}\n\n{}", at.label(bible), text.trim()), false, None)?;
    Ok(page)
}

/// Grow a note into a page (MK-8): a new page whose first block is a jot fence holding the note's id (titled by its place, or
/// `title`), or the same block added to the end of the page `into`. The note stays where it is.
pub fn grow(bible: &Bible, store: &mut Store, id: &str, into: Option<&str>, title: Option<&str>) -> Result<Value> {
    let n = find(bible, store, id)?;
    let fence = format!("```jot\n{}\n```", n.id);
    let page = match into {
        Some(p) => {
            let r = store.find_note(p)?;
            let pid = s(&r, "id");
            let text = s(&r, "text");
            if jot_map(store).get(&n.id).is_some_and(|v| v.iter().any(|(i, _)| *i == pid)) {
                return Err(bad("That page already shows this note."));
            }
            nb::edit_text(bible, store, &pid, &format!("{}\n\n{fence}", text.trim_end()))?;
            nb::show(bible, store, &pid)?
        }
        None => {
            let t = title.map(str::trim).filter(|t| !t.is_empty()).map(String::from).unwrap_or_else(|| n.at.label(bible));
            crate::pages::new_page(bible, store, None, &format!("{t}\n\n{fence}"), false, None)?
        }
    };
    Ok(json!({"note": note_json(bible, &n, &jot_map(store)), "page": page["id"], "title": page["title"]}))
}

/// Where a note can be added (M35): the pages that already name its verse first (MK-13's order), then the pages written in
/// last, then a search of titles and words.
pub fn targets(bible: &Bible, store: &Store, id: &str, words: &str) -> Result<Value> {
    let n = find(bible, store, id)?;
    let hi = if n.at.v1 == 0 { u32::MAX } else { n.at.v2 };
    let naming = pageindex::naming(bible, store, &n.at.code, (n.at.c, n.at.v1), (n.at.c, hi));
    let named: Vec<String> = naming.iter().map(|x| x.0.clone()).collect();
    let row = |id: &str, title: &str, updated: &str| json!({"id": id, "title": title, "updated": updated});
    let mut recent: Vec<(String, String, String)> = store
        .notes()
        .into_iter()
        .chain(store.inbox())
        .filter(|r| s(r, "kind") != "question" && r.get("template") != Some(&json!(true)))
        .map(|r| (s(r, "id"), nb::title_of(&s(r, "text")), s(r, "updated")))
        .filter(|r| !named.contains(&r.0))
        .collect();
    recent.sort_by(|a, b| b.2.cmp(&a.2));
    let w: Vec<String> = words.to_lowercase().split_whitespace().map(String::from).collect();
    let search: Vec<Value> = if w.is_empty() {
        vec![]
    } else {
        store
            .notes()
            .into_iter()
            .chain(store.inbox())
            .filter(|r| {
                let blob = format!("{} {}", nb::title_of(&s(r, "text")), s(r, "text")).to_lowercase();
                w.iter().all(|x| blob.contains(x.as_str()))
            })
            .take(20)
            .map(|r| row(&s(r, "id"), &nb::title_of(&s(r, "text")), &s(r, "updated")))
            .collect()
    };
    Ok(json!({"note": n.id, "label": n.at.label(bible),
        "naming": naming.iter().map(|(i, e, _, _)| row(i, &e.title, "")).collect::<Vec<_>>(),
        "recent": recent.iter().take(8).map(|r| row(&r.0, &r.1, &r.2)).collect::<Vec<_>>(),
        "search": search}))
}

// ---- reading ------------------------------------------------------------------------------------------------------------

fn anchor_covers(a: &Anchor, code: &str, c: u32, v: u32) -> bool {
    a.kind != anchors::Kind::Lemma && a.code == code && (a.c1, a.v1) <= (c, v) && (c, v) <= (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1))
}

/// The notes still placed with an `anchor` (the old form) that touch a verse: read as they are, never rewritten.
fn legacy_at(store: &Store, code: &str, c: u32, v: u32) -> Vec<Value> {
    store
        .notes()
        .into_iter()
        .filter(|n| s(n, "kind") != "lemma")
        .filter(|n| places_of(n).iter().any(|p| anchors::parse(p).is_ok_and(|a| anchor_covers(&a, code, c, v))))
        .map(|n| json!({"id": n["id"], "legacy": true, "page": n["id"], "text": n["text"], "first_line": nb::title_of(&s(n, "text")), "anchor": n["anchor"], "written": s(n, "created").get(..10).unwrap_or(""), "question": false}))
        .collect()
}

#[derive(Default, Clone)]
struct Counts {
    notes: usize,
    around: usize,
    pages: usize,
    saves: usize,
    marks: usize,
    lines: Vec<Value>,
}

fn saves_in(store: &Store) -> Vec<Anchor> {
    let mut out = vec![];
    let items = store.sets().into_iter().flat_map(|t| t["items"].as_array().cloned().unwrap_or_default()).chain(store.shelf_saves());
    for i in items {
        if i["kind"] == "place" {
            if let Some(a) = i["ref"].as_str().and_then(|r| anchors::parse(r).ok()) {
                out.push(a);
            }
        }
    }
    out
}

/// Per verse of a chapter, from the files and the index: margin notes, notes on the passage around, pages, saves, marks.
fn counts(bible: &Bible, store: &Store, code: &str, ch: u32, exclude: Option<&str>) -> Result<HashMap<u32, Counts>> {
    let last = bible.last_verse(code, ch)?;
    let mut by: HashMap<u32, Counts> = HashMap::new();
    let line = |text: &str| -> String { nb::title_of(text).chars().take(80).collect() };
    let notes = read_chapter(&store.root, code, ch);
    for v in 1..=last {
        let mut c = Counts::default();
        for n in &notes {
            if !n.at.covers(v) || n.at.v1 == 0 {
                continue;
            }
            if n.at.kind() == "verse" {
                c.notes += 1;
                if c.lines.len() < 6 {
                    c.lines.push(json!({"kind": "note", "id": n.id, "text": line(&n.text)}));
                }
            } else {
                c.around += 1;
            }
        }
        for l in legacy_at(store, code, ch, v) {
            c.notes += 1;
            if c.lines.len() < 6 {
                c.lines.push(json!({"kind": "note", "id": l["id"], "text": l["first_line"]}));
            }
        }
        by.insert(v, c);
    }
    // chapter notes are on the chapter's top, not on every verse
    for (id, e, _, _) in pageindex::naming(bible, store, code, (ch, 0), (ch, u32::MAX)) {
        if exclude == Some(id.as_str()) {
            continue;
        }
        // a page counts once at a verse however many times or ways it names it
        let mut covered: std::collections::BTreeSet<u32> = Default::default();
        for x in e.spans.iter().filter(|x| x.code == code && x.lo <= (ch, u32::MAX) && (ch, 0) <= x.hi) {
            let (a, b) = (if x.lo.0 < ch { 1 } else { x.lo.1.max(1) }, if x.hi.0 > ch { last } else { x.hi.1.min(last) });
            covered.extend(a..=b);
        }
        for v in covered {
            if let Some(c) = by.get_mut(&v) {
                c.pages += 1;
                if c.lines.len() < 6 && !c.lines.iter().any(|l| l["id"] == id.as_str()) {
                    c.lines.push(json!({"kind": "page", "id": id, "text": e.title}));
                }
            }
        }
    }
    let saves = saves_in(store);
    let hl: Vec<Anchor> = store.highlights(code).iter().filter_map(|h| anchors::parse(&s(h, "anchor")).ok()).collect();
    let pencil: Vec<Anchor> = crate::pencil::list(store, code).iter().filter_map(|h| anchors::parse(&s(h, "anchor")).ok()).collect();
    let threads: Vec<Anchor> = store.threads().iter().flat_map(|t| t["members"].as_array().cloned().unwrap_or_default()).filter_map(|m| anchors::parse(m["anchor"].as_str().unwrap_or("")).ok()).collect();
    for (v, c) in by.iter_mut() {
        c.saves = saves.iter().filter(|a| anchor_covers(a, code, ch, *v)).count();
        c.marks = hl.iter().chain(&pencil).chain(&threads).filter(|a| anchor_covers(a, code, ch, *v)).count();
    }
    Ok(by)
}

/// A chapter's margin (`wb margin "Num 25"`): its notes with each verse's first words, and one line of counts per verse that
/// has something (M26, M36). Opening a chapter reads its one margin file and no page file.
pub fn chapter(bible: &Bible, store: &Store, code: &str, ch: u32) -> Result<Value> {
    let notes = read_chapter(&store.root, code, ch);
    let jots = jot_map(store);
    let book = bible.books().iter().find(|b| b.code == code).ok_or_else(|| bad("No such book."))?.clone();
    let rows: Vec<Value> = notes
        .iter()
        .map(|n| {
            let mut j = note_json(bible, n, &jots);
            if n.at.v1 != 0 {
                j["verse_start"] = json!(first_words(bible, &book.name, ch, n.at.v1));
            }
            j
        })
        .collect();
    let verses: serde_json::Map<String, Value> = counts(bible, store, code, ch, None)?
        .into_iter()
        .filter(|(_, c)| c.notes + c.around + c.pages + c.saves + c.marks > 0)
        .map(|(v, c)| (v.to_string(), json!({"notes": c.notes, "around": c.around, "pages": c.pages, "saves": c.saves, "marks": c.marks, "lines": c.lines})))
        .collect();
    let mut sorted: Vec<(u32, Value)> = verses.into_iter().map(|(k, v)| (k.parse().unwrap_or(0), v)).collect();
    sorted.sort_by_key(|x| x.0);
    Ok(json!({"code": code, "chapter": ch, "label": format!("{} {ch}", book.name), "count": rows.len(),
        "top": rows.iter().filter(|r| r["kind"] == "chapter").cloned().collect::<Vec<_>>(),
        "notes": rows, "verses": sorted.into_iter().map(|(k, mut v)| { v["v"] = json!(k); v }).collect::<Vec<_>>()}))
}

/// A verse's first words, verbatim from the Bible (a chapter's list names each note by them, M31).
fn first_words(bible: &Bible, book: &str, ch: u32, v: u32) -> String {
    match crate::scripture::passage(bible, &format!("{book} {ch}:{v}"), "KJV") {
        Ok(p) => {
            let t = p["verses"][0]["text"].as_str().unwrap_or("");
            let w: Vec<&str> = t.split_whitespace().take(6).collect();
            let mut out = w.join(" ");
            if t.split_whitespace().count() > 6 {
                out.push('…');
            }
            out
        }
        Err(_) => String::new(),
    }
}

/// One verse opened in the margin (M25, M37): the verse verbatim, its notes newest first, the notes on the passage around
/// it, the old placed notes, and one line of counts. `all` lifts the cap of 20 rows on the page list.
pub fn verse(bible: &Bible, store: &Store, place: &str, all_rows: bool) -> Result<Value> {
    let at = At::from_place(bible, place)?;
    if at.v1 == 0 || at.v1 != at.v2 {
        return Err(bad("Open one verse in the margin (Num 25:11)."));
    }
    let (code, c, v) = (at.code.clone(), at.c, at.v1);
    let book = bible.books().iter().find(|b| b.code == code).unwrap().clone();
    let psg = crate::scripture::passage(bible, &format!("{} {c}:{v}", book.name), "KJV")?;
    let jots = jot_map(store);
    let mut mine: Vec<Note> = read_chapter(&store.root, &code, c).into_iter().filter(|n| n.at.v1 != 0 && n.at.covers(v)).collect();
    mine.sort_by(|a, b| b.written.cmp(&a.written).then(b.id.cmp(&a.id)));
    let (own, around): (Vec<&Note>, Vec<&Note>) = mine.iter().partition(|n| n.at.kind() == "verse");
    let legacy = legacy_at(store, &code, c, v);
    let naming = pageindex::naming(bible, store, &code, (c, v), (c, v));
    let folders = folders_of(store);
    let total = naming.len();
    let page_row = |(id, e, times, block): &(String, pageindex::Entry, u32, bool)| {
        json!({"id": id, "title": e.title, "times": times, "in_scripture_block": block, "folders": folders.get(id).cloned().unwrap_or_default()})
    };
    let shown: Vec<&(String, pageindex::Entry, u32, bool)> = naming.iter().take(if all_rows { usize::MAX } else { 20 }).collect();
    let mut groups: Vec<Value> = vec![];
    if total > 20 {
        let mut by: Vec<(String, Vec<Value>)> = vec![];
        for x in &naming {
            let f = folders.get(&x.0).and_then(|f| f.first().cloned()).unwrap_or_default();
            match by.iter_mut().find(|g| g.0 == f) {
                Some(g) => g.1.push(page_row(x)),
                None => by.push((f, vec![page_row(x)])),
            }
        }
        groups = by.into_iter().map(|(f, p)| json!({"folder": f, "count": p.len(), "pages": p.into_iter().take(if all_rows { usize::MAX } else { 20 }).collect::<Vec<_>>()})).collect();
    }
    let k = counts(bible, store, &code, c, None)?.remove(&v).unwrap_or_default();
    let mut years: Vec<(String, usize)> = vec![];
    for n in &own {
        let y = n.written.get(..4).unwrap_or("").to_string();
        match years.iter_mut().find(|x| x.0 == y) {
            Some(x) => x.1 += 1,
            None => years.push((y, 1)),
        }
    }
    Ok(json!({"place": at.label(bible), "anchor": at.id(), "text": psg["verses"][0]["text"], "ref": psg["verses"][0]["ref"],
        "notes": own.iter().map(|n| note_json(bible, n, &jots)).collect::<Vec<_>>(),
        "around": around.iter().map(|n| note_json(bible, n, &jots)).collect::<Vec<_>>(),
        "legacy": legacy,
        "years": years.iter().map(|(y, n)| json!({"year": y, "count": n})).collect::<Vec<_>>(),
        "counts": {"notes": own.len() + legacy.len(), "pages": total, "saves": k.saves, "marks": k.marks, "around": around.len()},
        "pages": shown.iter().map(|x| page_row(x)).collect::<Vec<_>>(), "pages_total": total, "cap": 20,
        "groups": groups}))
}

/// Folder names each page sits in (a folder's set holds the page's id).
pub(crate) fn folders_of(store: &Store) -> HashMap<String, Vec<String>> {
    let mut out: HashMap<String, Vec<String>> = HashMap::new();
    for t in store.sets() {
        for i in t["items"].as_array().cloned().unwrap_or_default() {
            if i["kind"] == "note" {
                out.entry(s_of(&i, "ref")).or_default().push(s(&t, "name"));
            }
        }
    }
    out
}

fn s_of(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// The Library's Margin notes (M30, M38): the books that hold any, each with its chapters' counts, in the Bible's order.
/// `map` lists every chapter of every book, empty ones too (the map shades by count). `book` lists one book.
pub fn list(bible: &Bible, store: &Store, book: Option<&str>, map: bool) -> Result<Value> {
    let mut counts: HashMap<(String, u32), usize> = HashMap::new();
    for n in snapshot(bible, store).iter() {
        *counts.entry((n.at.code.clone(), n.at.c)).or_default() += 1;
    }
    let want = match book {
        Some(b) => Some(crate::places::match_book(b, bible.books())?.code.clone()),
        None => None,
    };
    let mut books = vec![];
    let mut total = 0;
    for b in bible.books() {
        if want.as_ref().is_some_and(|w| *w != b.code) {
            continue;
        }
        let count: usize = (1..=b.chapters).map(|c| counts.get(&(b.code.clone(), c)).copied().unwrap_or(0)).sum();
        total += count;
        if count == 0 && !map && want.is_none() {
            continue;
        }
        let chapters: Vec<Value> = (1..=b.chapters)
            .filter_map(|c| {
                let n = counts.get(&(b.code.clone(), c)).copied().unwrap_or(0);
                (n > 0 || map || want.is_some()).then(|| json!({"chapter": c, "count": n}))
            })
            .collect();
        books.push(json!({"code": b.code, "name": b.name, "count": count, "chapters": chapters}));
    }
    Ok(json!({"total": total, "books": books}))
}

/// The margin notes as the one search lists them (`wb find --kind margin`): `{kind, id, title, snippet, updated}`.
pub fn rows(bible: &Bible, store: &Store, mut keep: impl FnMut(&str, &str, &str) -> bool) -> (Vec<Value>, usize) {
    let all = snapshot(bible, store);
    let mut out = vec![];
    for n in all.iter() {
        let label = n.at.label(bible);
        if keep(&label, &n.text, &n.written) {
            out.push(json!({"kind": "margin", "id": n.id, "title": label, "snippet": n.text, "updated": n.written, "at": n.at.id(), "question": question_of(&n.text).is_some()}));
        }
    }
    (out, all.len())
}

/// Add a dot to each verse of a scripture block that has a margin note, a page or a save (M6, M7).
pub fn add_dots(bible: &Bible, store: &Store, verses: &mut Value, host: &str) -> Result<()> {
    let mut cache: HashMap<(String, u32), HashMap<u32, Counts>> = HashMap::new();
    for v in verses.as_array_mut().into_iter().flatten() {
        let (Some(code), Some(c), Some(n)) = (v["code"].as_str().map(String::from), v["c"].as_u64(), v["v"].as_u64()) else { continue };
        let key = (code.clone(), c as u32);
        if !cache.contains_key(&key) {
            cache.insert(key.clone(), counts(bible, store, &code, c as u32, Some(host))?);
        }
        if let Some(k) = cache[&key].get(&(n as u32)) {
            if k.notes + k.around + k.pages + k.saves > 0 {
                v["dot"] = json!({"notes": k.notes + k.around, "pages": k.pages, "saves": k.saves});
            }
        }
    }
    Ok(())
}

// ---- the read-only list of MK-18 -----------------------------------------------------------------------------------------

/// What each old note that has a place would become if the person ran MK-18's move (`wb study check --margin-move`). It only
/// reads: a note of plain sentences becomes a margin note at its place; any other becomes a page whose first line is its
/// reference. Old questions at a verse (trails) are listed as margin questions. Nothing is written, now or by this list.
pub fn move_list(bible: &Bible, store: &Store) -> Value {
    let mut rows = vec![];
    for n in store.notes() {
        if s(n, "kind") == "lemma" {
            continue;
        }
        let text = s(n, "text");
        let c = chars(&text);
        let (_, blocks) = split(&text, false);
        let plain = blocks.iter().all(|b| b.kind == "paragraph") && !text.contains("[[") && !text.contains("```");
        // a first line alone above more text is a title
        let titled = blocks.len() > 1 && blocks.first().is_some_and(|b| !sub(&c, b.start, b.end).contains('\n'));
        let (becomes, why) = if plain && !titled {
            ("margin note", "plain sentences only")
        } else if titled {
            ("page", "it has a title line above more text")
        } else {
            ("page", "it holds a heading, list, table, quote, block or page link")
        };
        rows.push(json!({"id": n["id"], "anchor": n["anchor"], "label": nb::label(bible, &s(n, "anchor")), "becomes": becomes, "why": why, "preview": nb::title_of(&text)}));
    }
    for t in store.trails() {
        rows.push(json!({"id": t["id"], "anchor": t["anchor"], "label": nb::label(bible, &s(t, "anchor")), "becomes": "margin note (a question)", "why": "an old question at a verse", "preview": nb::title_of(&s(t, "text"))}));
    }
    let count = |k: &str| rows.iter().filter(|r| r["becomes"].as_str().is_some_and(|b| b.starts_with(k))).count();
    json!({"margin_notes": count("margin"), "pages": count("page"), "rows": rows, "writes": "nothing: this list only reads"})
}

/// A page's jot blocks with the note each holds (`wb page jots`): `{id, blocks: [{n, note, ...}]}`; a note that is gone says so.
pub fn page_jots(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = crate::pages::text_of(store, id)?;
    let c = chars(&text);
    let notes = all(bible, store);
    let jots = jot_map(store);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let Some(held) = jot_fence(&sub(&c, b.start, b.end)) else { continue };
        let mut v = json!({"n": i + 1, "held": held});
        match notes.iter().find(|n| n.id == held.trim()) {
            Some(n) => v["note"] = note_json(bible, n, &jots),
            None => v["error"] = json!(if held.trim().is_empty() { "No note yet.".to_string() } else { format!("No margin note {}.", held.trim()) }),
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}
