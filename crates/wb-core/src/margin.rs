//! Margin notes (design/features/marks, round 7, T4: MK7-6, MK7-18, MK7-27, MK7-28; kept: MK-8, MK-10, MK-11, MK-14, MK-19, MK-21).
//!
//! A margin note is a thought caught while reading, kept at one verse, a span of verses in one chapter, or the chapter. It
//! lives in `margin/<BOOK>/<chapter>.md`, one Markdown file per chapter, each note under a line naming its place, then a
//! marker line holding its id, its place and its dates, then its words (text only: no headings or blocks):
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
//! <!-- margin id=m_20261118090000123ab12 at=NUM.25:11 created=2026-11-18 changed=2026-11-19 grew=n_20261119101500_cd34 -->
//! Your own words.
//! ```
//!
//! The marker is the one the removed rounds 1 to 6 wrote (`written=` is read as `created=`; `words="..."` is kept as it is),
//! so those files are read as they are. A file is rewritten only when a note in that chapter is changed, added or deleted:
//! what the person typed above the first note is kept, and so is every note's words. A note grown into a page (MK-8) stays
//! here and says so (`grew=<page id>`). A deleted note is copied to `.trash/<stamp>-<id>.md` first and can be put back.
//! The margin never prompts or suggests (MK-10), and a chapter's notes are read from one file and no page (MK-14) unless a
//! note grew, when the page's title is looked up in the store's memory.

use crate::bible::Bible;
use crate::commands::find_refs;
use crate::notebook as nb;
use crate::pages::{chars, split, sub};
use crate::places::{parse_span, span_label, Span};
use crate::questions::question_of;
use crate::store::{bad, guard, missing, new_id, write_atomic, Store};
use crate::Result;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const MARKER: &str = "<!-- margin ";

/// Where a margin note is: a chapter (`v1` = 0), a verse (`v1` = `v2`) or a span of verses of one chapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct At {
    pub code: String,
    pub c: u32,
    pub v1: u32,
    pub v2: u32,
}

impl At {
    /// `NUM.25`, `NUM.25:11` or `NUM.25:10-13`.
    pub fn id(&self) -> String {
        match (self.v1, self.v2) {
            (0, _) => format!("{}.{}", self.code, self.c),
            (a, b) if a == b => format!("{}.{}:{a}", self.code, self.c),
            (a, b) => format!("{}.{}:{a}-{b}", self.code, self.c),
        }
    }

    fn parse(t: &str) -> Option<At> {
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
        if c == 0 || (v1 != 0 && v1 > v2) || (vs.is_some() && v1 == 0) {
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
            "span"
        }
    }

    pub fn label(&self, bible: &Bible) -> String {
        match bible.books().iter().find(|b| b.code == self.code) {
            Some(b) => span_label(&Span { book: b.clone(), c1: self.c, v1: self.v1, c2: self.c, v2: self.v2 }),
            None => self.id(),
        }
    }

    /// The place as an anchor (`NUM.25:11`, `NUM.25:10-25:13`); a chapter has none.
    fn anchor(&self) -> String {
        match (self.v1, self.v2) {
            (0, _) => String::new(),
            (a, b) if a == b => format!("{}.{}:{a}", self.code, self.c),
            (a, b) => format!("{}.{}:{a}-{}:{b}", self.code, self.c, self.c),
        }
    }

    /// A place as typed (or an id like `NUM.25:11`) → where a margin note goes: one chapter at most (MK7-27).
    fn from_place(bible: &Bible, text: &str) -> Result<At> {
        let a = match At::parse(text) {
            Some(a) => a,
            None => {
                let sp = parse_span(text, bible.books())?;
                if sp.c1 != sp.c2 {
                    return Err(bad("A margin note is on a verse, a span of verses in one chapter, or a chapter (Num 25:11, Num 25:10-13, Num 25). A span across chapters is not kept."));
                }
                let (v1, v2) = if sp.v1 == 0 { (0, 0) } else { (sp.v1, if sp.v2 == 0 { sp.v1 } else { sp.v2 }) };
                At { code: sp.book.code.clone(), c: sp.c1, v1, v2 }
            }
        };
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
    pub created: String,
    pub changed: String,
    /// The pages it grew into (MK-8).
    pub grew: Vec<String>,
    /// The words an old note named when it was written with words selected (kept as written).
    pub words: String,
}

impl Note {
    fn render(&self, bible: &Bible) -> String {
        let mut marker = format!("{MARKER}id={} at={} created={}", self.id, self.at.id(), self.created);
        if !self.changed.is_empty() {
            marker += &format!(" changed={}", self.changed);
        }
        if !self.grew.is_empty() {
            marker += &format!(" grew={}", self.grew.join(","));
        }
        if !self.words.is_empty() {
            marker += &format!(" words={}", json!(self.words));
        }
        format!("## {}\n{marker} -->\n{}\n", self.at.label(bible), self.text.trim_matches('\n'))
    }
}

fn file(root: &Path, code: &str, chapter: u32) -> PathBuf {
    root.join("margin").join(code).join(format!("{chapter}.md"))
}

fn parse_marker(line: &str) -> Option<Note> {
    let inner = line.trim().strip_prefix(MARKER)?.strip_suffix("-->")?.trim();
    let (head, words) = match inner.split_once(" words=") {
        Some((h, w)) => (h, serde_json::from_str::<String>(w.trim()).unwrap_or_default()),
        None => (inner, String::new()),
    };
    let (mut id, mut at, mut created, mut changed, mut grew) = (String::new(), None, String::new(), String::new(), vec![]);
    for t in head.split_whitespace() {
        match t.split_once('=') {
            Some(("id", v)) => id = v.into(),
            Some(("at", v)) => at = At::parse(v),
            Some(("created" | "written", v)) => created = v.into(),
            Some(("changed", v)) => changed = v.into(),
            Some(("grew", v)) => grew = v.split(',').filter(|x| !x.is_empty()).map(String::from).collect(),
            _ => {}
        }
    }
    if id.is_empty() {
        return None;
    }
    Some(Note { id, at: at?, text: String::new(), created, changed, grew, words })
}

/// A chapter file as a person may have left it: the text above the first note (after the front matter and the title) is the
/// `preface`, kept as it is; a note's words run to the next note's heading, or, where that heading was deleted by hand, to the
/// next note's marker: no line is cut.
fn parse_full(text: &str) -> (String, Vec<Note>) {
    let text = text.replace("\r\n", "\n");
    let lines: Vec<&str> = text.lines().collect();
    let marks: Vec<usize> = (0..lines.len()).filter(|&i| lines[i].trim_start().starts_with(MARKER) && parse_marker(lines[i]).is_some()).collect();
    let heading_of = |i: usize| i > 0 && lines[i - 1].starts_with("## ");
    let mut out = vec![];
    for (k, &i) in marks.iter().enumerate() {
        let mut n = parse_marker(lines[i]).unwrap();
        let end = marks.get(k + 1).map(|&m| if heading_of(m) { m - 1 } else { m }).unwrap_or(lines.len());
        n.text = lines[i + 1..end.max(i + 1)].join("\n").trim_matches('\n').trim_end().to_string();
        out.push(n);
    }
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

/// A chapter file's text. Only a file that is not there is empty: one that cannot be read is an error and nothing is written over it.
fn read_text(p: &Path) -> Result<String> {
    match std::fs::read_to_string(p) {
        Ok(t) => Ok(t),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(bad(format!("The margin's file {} cannot be read ({e}). Nothing was written and the file is as it was.", p.display()))),
    }
}

/// Change one chapter's file: read its text, let `f` change the notes, write the result whole and atomically.
fn update_chapter(bible: &Bible, root: &Path, code: &str, chapter: u32, f: &mut dyn FnMut(&mut Vec<Note>) -> Result<()>) -> Result<()> {
    guard(root)?;
    let p = file(root, code, chapter);
    let (preface, mut notes) = parse_full(&read_text(&p)?);
    f(&mut notes)?;
    if notes.is_empty() && preface.is_empty() {
        if p.exists() {
            std::fs::remove_file(&p)?;
        }
        return Ok(());
    }
    notes.sort_by(|a, b| (a.at.v1, a.at.v2, &a.created, &a.id).cmp(&(b.at.v1, b.at.v2, &b.created, &b.id)));
    let name = bible.books().iter().find(|b| b.code == code).map(|b| b.name.clone()).unwrap_or_else(|| code.into());
    let mut out = format!("---\nbook: \"{code}\"\nchapter: {chapter}\n---\n\n# {name} {chapter}\n\n");
    if !preface.is_empty() {
        out += &format!("{preface}\n\n");
    }
    for n in &notes {
        out += &n.render(bible);
        out.push('\n');
    }
    write_atomic(&p, &(out.trim_end_matches('\n').to_string() + "\n"))
}

/// Every chapter file: (book code, chapter, path).
fn chapter_files(root: &Path) -> Vec<(String, u32, PathBuf)> {
    let mut out = vec![];
    let Ok(rd) = std::fs::read_dir(root.join("margin")) else { return out };
    for b in rd.flatten() {
        let code = b.file_name().to_string_lossy().into_owned();
        let Ok(files) = std::fs::read_dir(b.path()) else { continue };
        for f in files.flatten() {
            if let Some(ch) = f.file_name().to_string_lossy().strip_suffix(".md").and_then(|n| n.parse::<u32>().ok()) {
                out.push((code.clone(), ch, f.path()));
            }
        }
    }
    out
}

fn book_order(bible: &Bible, code: &str) -> u32 {
    bible.books().iter().find(|b| b.code == code).map(|b| b.id).unwrap_or(999)
}

/// Every margin note, in the Bible's order (a file that cannot be read is left out here and never written).
pub fn all(bible: &Bible, store: &Store) -> Vec<Note> {
    let mut files = chapter_files(&store.root);
    files.sort_by_key(|(c, ch, _)| (book_order(bible, c), *ch));
    files.into_iter().filter_map(|(_, _, p)| std::fs::read_to_string(p).ok()).flat_map(|t| parse_full(&t).1).collect()
}

fn find(bible: &Bible, store: &Store, id: &str) -> Result<Note> {
    let id = id.trim();
    all(bible, store).into_iter().find(|n| n.id == id).ok_or_else(|| missing(format!("No margin note {id}.")))
}

/// Whether a margin note has this id.
pub fn has(bible: &Bible, store: &Store, id: &str) -> bool {
    find(bible, store, id).is_ok()
}

/// `m_`, the second, its millisecond (so notes of one second keep the order they were written), two random bytes.
fn stamped_id() -> String {
    let base = new_id("m");
    format!("{}{:03}{}", &base[..16], chrono::Utc::now().timestamp_subsec_millis(), &base[16..])
}

fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// A note is text (MK7-28): no heading, no fenced block, and not a line that would pass for the marker.
fn check_text(text: &str) -> Result<()> {
    if text.trim().is_empty() {
        return Err(bad("Write the note."));
    }
    for l in text.lines() {
        let t = l.trim_start();
        if t.starts_with(MARKER) {
            return Err(bad("A margin note cannot hold a line that starts with <!-- margin."));
        }
        let hashes = t.bytes().take_while(|b| *b == b'#').count();
        if ((1..=6).contains(&hashes) && t[hashes..].starts_with([' ', '\t'])) || t == "#" {
            return Err(bad("A margin note is text: no headings. Anything bigger grows into a page (wb mark grow)."));
        }
        if t.starts_with("```") || t.starts_with("~~~") {
            return Err(bad("A margin note is text: no blocks. Anything bigger grows into a page (wb mark grow)."));
        }
    }
    Ok(())
}

fn note_json(bible: &Bible, store: &Store, n: &Note) -> Value {
    let q = question_of(&n.text);
    let grew: Vec<Value> = n
        .grew
        .iter()
        .map(|id| match crate::pages::text_of(store, id) {
            Ok((pid, text, _)) => json!({"id": pid, "title": nb::title_of(&text)}),
            Err(_) => json!({"id": id, "title": "", "gone": true}),
        })
        .collect();
    json!({"id": n.id, "at": n.at.id(), "label": n.at.label(bible), "kind": n.at.kind(), "v1": n.at.v1, "v2": n.at.v2,
        "text": n.text, "question": q.is_some(), "done": q.as_ref().is_some_and(|x| x.done),
        "created": n.created, "changed": n.changed, "grew": grew, "words": n.words})
}

// ---- writing -------------------------------------------------------------------------------------------------------------

/// Make a note at a verse, a span of verses in one chapter, or a chapter (`wb mark note`).
pub fn add(bible: &Bible, store: &Store, place: &str, text: &str) -> Result<Value> {
    check_text(text)?;
    let at = At::from_place(bible, place)?;
    let note = Note { id: stamped_id(), at: at.clone(), text: text.trim_matches('\n').to_string(), created: today(), changed: String::new(), grew: vec![], words: String::new() };
    update_chapter(bible, &store.root, &at.code, at.c, &mut |notes| {
        notes.push(note.clone());
        Ok(())
    })?;
    Ok(note_json(bible, store, &note))
}

fn change(bible: &Bible, store: &Store, id: &str, f: impl Fn(&mut Note) -> Result<()>) -> Result<Value> {
    let found = find(bible, store, id)?;
    let mut after: Option<Note> = None;
    update_chapter(bible, &store.root, &found.at.code, found.at.c, &mut |notes| {
        let n = notes.iter_mut().find(|n| n.id == found.id).ok_or_else(|| missing("That note is gone."))?;
        f(n)?;
        after = Some(n.clone());
        Ok(())
    })?;
    let after = after.ok_or_else(|| missing("That note is gone."))?;
    Ok(note_json(bible, store, &after))
}

/// Replace a note's words and set `changed` (`wb mark note <id> --text`). Its id, place and `created` stay.
pub fn edit(bible: &Bible, store: &Store, id: &str, text: &str) -> Result<Value> {
    check_text(text)?;
    change(bible, store, id, |n| {
        n.text = text.trim_matches('\n').to_string();
        n.changed = today();
        Ok(())
    })
}

/// Grow a note into a page (MK-8, `wb mark grow`): a new page holding the note, titled by its place (or `title`). The note
/// stays in the margin and gains `grew=<page id>`, which shows as its "grew into" link.
pub fn grow(bible: &Bible, store: &mut Store, id: &str, title: Option<&str>) -> Result<Value> {
    let n = find(bible, store, id)?;
    let t = title.map(str::trim).filter(|t| !t.is_empty()).map(String::from).unwrap_or_else(|| n.at.label(bible));
    let page = crate::pages::new_page(bible, store, None, &format!("{t}\n\n{}", n.text), false, None)?;
    let pid = page["id"].as_str().unwrap_or("").to_string();
    let note = change(bible, store, &n.id, |x| {
        if !x.grew.contains(&pid) {
            x.grew.push(pid.clone());
        }
        Ok(())
    })?;
    Ok(json!({"note": note, "page": pid, "title": page["title"]}))
}

// ---- deleting ------------------------------------------------------------------------------------------------------------

/// A deleted note's file in `.trash`: `<stamp>-<id>.md` (the stamp is `YYYYMMDD-HHMMSS`; an old note's id starts `m_` too).
pub fn is_trash_file(name: &str) -> bool {
    chrono::NaiveDateTime::parse_from_str(name.get(..15).unwrap_or(""), "%Y%m%d-%H%M%S").is_ok()
        && name.get(15..16) == Some("-")
        && name.get(16..).is_some_and(|r| r.starts_with("m_") && r.ends_with(".md"))
}

/// Delete a note (MK-21). It is copied to `.trash/` first (kept 7 days, like a mark); `restore` puts it back.
pub fn rm(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let found = find(bible, store, id)?;
    guard(&store.root)?;
    let name = format!("{}-{}.md", chrono::Utc::now().format("%Y%m%d-%H%M%S"), found.id);
    let trash = store.root.join(".trash").join(&name);
    let done = update_chapter(bible, &store.root, &found.at.code, found.at.c, &mut |notes| {
        let at = notes.iter().position(|n| n.id == found.id).ok_or_else(|| missing("That note is gone."))?;
        write_atomic(&trash, &notes[at].render(bible))?;
        notes.remove(at);
        Ok(())
    });
    if let Err(e) = done {
        let _ = std::fs::remove_file(&trash);
        return Err(e);
    }
    Ok(json!({"deleted": found.id, "trash": name, "days": crate::store::TRASH_DAYS, "at": found.at.id()}))
}

fn trash_copies(store: &Store, id: &str) -> Vec<PathBuf> {
    let tail = format!("-{}.md", id.trim());
    let Ok(rd) = std::fs::read_dir(store.root.join(".trash")) else { return vec![] };
    let mut hits: Vec<PathBuf> = rd
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.file_name().is_some_and(|n| is_trash_file(&n.to_string_lossy()) && n.to_string_lossy().ends_with(&tail)))
        .collect();
    hits.sort();
    hits
}

/// Whether a deleted note with this id waits in the trash.
pub fn trashed_has(store: &Store, id: &str) -> bool {
    !trash_copies(store, id).is_empty()
}

/// Put back a deleted note (the newest copy of that id), as it was.
pub fn restore(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let p = trash_copies(store, id).pop().ok_or_else(|| missing(format!("No deleted margin note {}.", id.trim())))?;
    let n = parse_full(&std::fs::read_to_string(&p)?).1.into_iter().next().ok_or_else(|| bad("That file holds no margin note."))?;
    if find(bible, store, &n.id).is_ok() {
        return Err(bad("That note is already in the margin."));
    }
    update_chapter(bible, &store.root, &n.at.code, n.at.c, &mut |notes| {
        notes.push(n.clone());
        Ok(())
    })?;
    std::fs::remove_file(p)?;
    Ok(note_json(bible, store, &n))
}

/// The deleted notes in the trash, newest first: {name, id, at, text, deleted, days_left}.
pub fn trashed(store: &Store) -> Vec<Value> {
    let now = chrono::Utc::now().naive_utc();
    let Ok(rd) = std::fs::read_dir(store.root.join(".trash")) else { return vec![] };
    let mut out: Vec<Value> = rd
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if !is_trash_file(&name) {
                return None;
            }
            let at = chrono::NaiveDateTime::parse_from_str(name.get(..15)?, "%Y%m%d-%H%M%S").ok()?;
            let n = parse_full(&std::fs::read_to_string(e.path()).ok()?).1.into_iter().next()?;
            Some(json!({"name": name, "id": n.id, "at": n.at.id(), "text": n.text, "deleted": format!("{}Z", at.format("%Y-%m-%dT%H:%M:%S")),
                "days_left": (crate::store::TRASH_DAYS - (now - at).num_days()).max(0)}))
        })
        .collect();
    out.sort_by(|a, b| b["name"].as_str().cmp(&a["name"].as_str()));
    out
}

// ---- reading -------------------------------------------------------------------------------------------------------------

/// A chapter's notes, the chapter's own first, then by verse (`wb mark notes`). Reads one file, and no page unless a note grew.
pub fn chapter(bible: &Bible, store: &Store, place: &str) -> Result<Value> {
    let sp = parse_span(place, bible.books())?;
    if sp.c1 != sp.c2 || sp.v1 != 0 {
        return Err(bad("Name one chapter: wb mark notes Num 25."));
    }
    let text = read_text(&file(&store.root, &sp.book.code, sp.c1))?;
    let notes: Vec<Value> = parse_full(&text).1.iter().map(|n| note_json(bible, store, n)).collect();
    Ok(json!({"place": format!("{} {}", sp.book.name, sp.c1), "book": sp.book.code, "chapter": sp.c1, "count": notes.len(), "notes": notes}))
}

/// The open questions written in a chapter's margin notes, by verse (a span's first; the chapter's own note, none): `{id, v, text}`.
/// Reads the chapter's one file, so the reader's ? marker can include them (MK-11).
pub fn chapter_questions(store: &Store, code: &str, chapter: u32) -> Vec<Value> {
    let Ok(text) = read_text(&file(&store.root, code, chapter)) else { return vec![] };
    let mut out = vec![];
    for n in parse_full(&text).1 {
        if n.at.v1 == 0 || !n.text.contains("[!") {
            continue;
        }
        let c = chars(&n.text);
        for b in split(&n.text, false).1.iter().filter(|b| b.kind == "quote") {
            if let Some(q) = question_of(&sub(&c, b.start, b.end)) {
                if !q.done {
                    out.push(json!({"id": n.id, "v": n.at.v1, "text": q.text}));
                }
            }
        }
    }
    out
}

/// The notes as the one search lists them (`wb find`): `{kind, id, title, snippet, updated, at, question}`; also how many there are.
pub fn rows(bible: &Bible, store: &Store, mut keep: impl FnMut(&str, &str, &str) -> bool) -> (Vec<Value>, usize) {
    let all = all(bible, store);
    let mut out = vec![];
    for n in all.iter() {
        let label = n.at.label(bible);
        let updated = if n.changed.is_empty() { &n.created } else { &n.changed };
        if keep(&label, &n.text, updated) {
            out.push(json!({"kind": "margin", "id": n.id, "title": label, "snippet": n.text, "updated": updated, "at": n.at.id(), "question": question_of(&n.text).is_some()}));
        }
    }
    (out, all.len())
}

/// A note's questions as the Notebook's entries (MK-11): the callout blocks of its words, each `<note id>#<block number>`,
/// with where it was written (`page` is the note, `page_kind` is "margin").
pub fn question_entries(bible: &Bible, store: &Store) -> Vec<Value> {
    let mut out = vec![];
    for n in all(bible, store) {
        if !n.text.contains("[!") {
            continue;
        }
        let c = chars(&n.text);
        for (i, b) in split(&n.text, false).1.iter().enumerate() {
            if b.kind != "quote" {
                continue;
            }
            let Some(q) = question_of(&sub(&c, b.start, b.end)) else { continue };
            let label = n.at.label(bible);
            let updated = if n.changed.is_empty() { n.created.clone() } else { n.changed.clone() };
            out.push(json!({
                "id": format!("{}#{}", n.id, i + 1), "kind": "question", "block": i + 1, "page": n.id, "page_title": label, "page_kind": "margin",
                "status": if q.done { "done" } else { "open" }, "placed": !n.at.anchor().is_empty(), "anchor": n.at.anchor(), "label": label,
                "quote": "", "text": q.text, "title": q.text, "preview": "", "created": n.created, "updated": updated,
                "time": "", "day": "", "also": [], "threads": [], "refs": [], "whole": "",
            }));
        }
    }
    out
}

/// The notes whose own words name a span of one book (a reference found in the text, as in a page), or a Strong's number:
/// → (note, how many times it names it), most times first, then newest.
pub fn naming(bible: &Bible, store: &Store, code: &str, lo: (u32, u32), hi: (u32, u32), number: Option<&str>) -> Vec<(Note, u32)> {
    let mut hits: Vec<(Note, u32)> = vec![];
    for n in all(bible, store) {
        let times = match number {
            Some(num) => u32::from(crate::pageindex::numbers_in(&n.text).iter().any(|x| x == num)),
            None => find_refs(&n.text, bible.books())
                .iter()
                .filter_map(|f| parse_span(&f.place, bible.books()).ok())
                .filter(|sp| {
                    let (l, h) = ((sp.c1, sp.v1), (sp.c2, if sp.v2 == 0 { u32::MAX } else { sp.v2 }));
                    sp.book.code == code && l <= hi && lo <= h
                })
                .count() as u32,
        };
        if times > 0 {
            hits.push((n, times));
        }
    }
    hits.sort_by(|a, b| b.1.cmp(&a.1).then(b.0.created.cmp(&a.0.created)));
    hits
}

/// A note as a row of the pages that name a place (`wb anchor <place> --pages`).
pub fn naming_row(bible: &Bible, n: &Note, times: u32) -> Value {
    json!({"id": n.id, "title": n.at.label(bible), "kind": "margin", "created": n.created, "times": times, "in_scripture_block": false, "folders": []})
}

/// The notes whose words (or place) hold every one of `words` (lower case), for the plain `wb find`.
pub fn matching(bible: &Bible, store: &Store, words: &[String], snippet: impl Fn(&str) -> String) -> Vec<Value> {
    all(bible, store)
        .into_iter()
        .filter(|n| {
            let blob = format!("{} {}", n.at.label(bible), n.text).to_lowercase();
            words.iter().all(|w| blob.contains(w.as_str()))
        })
        .map(|n| json!({"id": n.id, "at": n.at.id(), "label": n.at.label(bible), "snippet": snippet(&n.text), "updated": if n.changed.is_empty() { &n.created } else { &n.changed }}))
        .collect()
}
