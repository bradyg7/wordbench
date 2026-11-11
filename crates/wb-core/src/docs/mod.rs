//! Documents that stay one file (the Python app's `workbench/documents.py`): each Word document or deck remembers what it
//! was made from, and is brought up to date in place when that source changes, rather than a new file being made.
//!
//! A record is `documents/<id>.json` in the study folder, in the Python app's format: the source, the structure and
//! theme, the file's name in the documents folder, and two fingerprints. `plan` is of the plan the file was built from
//! (`plan.rs`, value for value the Python app's), so both apps agree whether a file is up to date; `file` is of the
//! finished file, so a file changed by hand is noticed before a rebuild would overwrite it (that version is first kept
//! beside it as a copy). The file is built and checked on the side and swapped in only when every verse the source holds
//! is in it word for word, so a failed build leaves the old one as it was.
//!
//! Tier 4 (docs/PLAN-phase2b-build.md) makes two structures from a thread: the Speaker Script as Word (`to: word`, the
//! same record as the Python app's) and Verse by Verse as PDF pages (`to: pdf`, a record of its own, which the Python app
//! passes over; its PowerPoint decks, `to: deck`, are listed here and made there until phase 5).
//!
//! W6 (a document from a page, `page.rs`): the same two from a page and the pages inside it, as
//! `documents/page-<id>-script.json` and `page-<id>-verse.json`, with the source `{"kind": "page", "id": …}` and the
//! person's switches (`switched`) and version (`version`) kept beside it. The Python app lists only records of its own
//! kinds of source and file (`documents.records`: `to` word or deck, source passage, lesson or thread), so it passes over
//! these as it passes over the thread's PDF pages, and its ids never start with "page-".

pub mod chapter;
pub mod deck;
pub mod docx;
pub mod look;
pub mod packet;
pub mod page;
pub mod pdfs;
pub mod plan;
mod pptx;

use crate::bible::Bible;
use crate::store::{bad, missing, now, py_dumps_indent1, s, write_atomic, Rec, Store};
use crate::{studyapi, Error, Result};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub fn squash(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The kinds of file a record can be: Word, a PowerPoint deck (made by the Python app) and slides as PDF pages (made here).
fn ext(to: &str) -> Option<&'static str> {
    match to {
        "word" => Some(".docx"),
        "deck" => Some(".pptx"),
        "pdf" => Some(".pdf"),
        _ => None,
    }
}

// ---- where the files go -----------------------------------------------------------------------------------------------

/// Where new exports go and where records created before study-local exports may still point.
pub struct ExportFolders {
    local: PathBuf,
    override_dir: Option<PathBuf>,
    legacy: PathBuf,
}

impl ExportFolders {
    pub fn for_study(study: &Path) -> Result<Self> {
        let override_dir = std::env::var_os("WB_DOCS_DIR").filter(|p| !p.is_empty()).map(std::path::absolute).transpose()?;
        let real = matches!((fs::canonicalize(study), fs::canonicalize(crate::real_study_dir())), (Ok(a), Ok(b)) if a == b);
        let legacy = if real {
            std::env::var_os("BIBLE_WORKBENCH_PDF_DIR").filter(|p| !p.is_empty()).map(PathBuf::from).unwrap_or_else(|| {
                let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from).unwrap_or_default();
                home.join("Documents").join("Bible Workbench")
            })
        } else {
            let name = study.file_name().map(|n| n.to_string_lossy()).unwrap_or_else(|| "study".into());
            study.with_file_name(format!("{name}-documents"))
        };
        Ok(Self { local: study.join("exports"), override_dir, legacy })
    }

    fn preferred(&self) -> &Path {
        self.override_dir.as_deref().unwrap_or(&self.local)
    }

    fn search_dirs(&self) -> impl Iterator<Item = &Path> {
        [Some(self.local.as_path()), self.override_dir.as_deref(), Some(self.legacy.as_path())].into_iter().flatten()
    }

    // Bind a record to an override without storing the machine's absolute path in shared study data.
    fn override_key(path: &Path) -> String {
        let identity = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        format!("override:{}", plan::sha256_hex(identity.to_string_lossy().as_bytes()))
    }

    fn remember(&self, rec: &mut Rec, out: &Path) {
        let key = if out == self.local {
            "study".to_string()
        } else if self.override_dir.as_deref() == Some(out) {
            Self::override_key(out)
        } else {
            return;
        };
        rec.insert("export_location".into(), json!(key));
    }

    /// A known destination, or no safe destination for a missing unmarked legacy record.
    fn resolve(&self, rec: &Rec) -> Result<Option<&Path>> {
        let name = s(rec, "name");
        if name.is_empty() && !rec.contains_key("name") {
            return Ok(Some(self.preferred()));
        }
        checked_name(&name)?;
        match rec.get("export_location") {
            Some(v) if v == "study" => return Ok(Some(&self.local)),
            Some(v) => {
                return self.override_dir.as_deref().filter(|p| v == &Self::override_key(p)).map(Some)
                    .ok_or_else(|| missing("This export needs its original WB_DOCS_DIR. Restore that folder setting and try again."));
            }
            None => {}
        }
        let mut seen = Vec::new();
        let mut candidates = Vec::new();
        for dir in self.search_dirs() {
            let path = dir.join(&name);
            if path.is_file() {
                let identity = fs::canonicalize(&path)?;
                if !seen.contains(&identity) {
                    seen.push(identity);
                    candidates.push(dir);
                }
            }
        }
        match candidates.as_slice() {
            [] => Ok(None),
            [one] => Ok(Some(one)),
            _ => {
                let file = s(rec, "file");
                let matches: Vec<_> = candidates.iter().filter(|dir| sha_file(&dir.join(&name)).ok().as_deref() == Some(file.as_str())).collect();
                if let [one] = matches.as_slice() {
                    return Ok(Some(**one));
                }
                Err(bad(format!("More than one export named “{name}” was found. Resolve the duplicate before continuing.")))
            }
        }
    }

    fn build_in(&self, rec: &Rec) -> Result<&Path> {
        self.resolve(rec)?.or(self.override_dir.as_deref()).ok_or_else(|| {
            missing("The existing export could not be found. Restore the file or set WB_DOCS_DIR explicitly to choose where to rebuild it.")
        })
    }
}

fn checked_name(name: &str) -> Result<&str> {
    use std::path::Component;
    if !name.contains(['/', '\\', ':']) && matches!(Path::new(name).components().collect::<Vec<_>>().as_slice(), [Component::Normal(_)]) {
        return Ok(name);
    }
    Err(bad("The export record needs a file name without a path."))
}

// ---- the records -------------------------------------------------------------------------------------------------------

fn records_dir(store: &Store) -> PathBuf {
    store.root.join("documents")
}

/// Every record that reads, in file name order. A file ruined by hand is not a document; the rest still work.
pub fn records(store: &Store) -> Vec<Rec> {
    let dir = records_dir(store);
    let mut paths: Vec<PathBuf> = fs::read_dir(&dir).map(|d| d.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json")).collect()).unwrap_or_default();
    paths.sort();
    paths
        .into_iter()
        .filter_map(|p| {
            let rec: Rec = serde_json::from_str::<Value>(&fs::read_to_string(&p).ok()?).ok()?.as_object()?.clone();
            let stem = p.file_stem()?.to_string_lossy().to_string();
            let ok = s(&rec, "id") == stem
                && ext(&s(&rec, "to")).is_some()
                && matches!(rec.get("source").and_then(|x| x["kind"].as_str()), Some("thread" | "passage" | "lesson" | "page"));
            ok.then_some(rec)
        })
        .collect()
}

fn save(store: &Store, rec: &Rec) -> Result<()> {
    crate::store::guard(&store.root)?;
    write_atomic(&records_dir(store).join(format!("{}.json", s(rec, "id"))), &(py_dumps_indent1(&Value::Object(rec.clone())) + "\n"))
}

pub fn source_name(source: &Value) -> String {
    match source["kind"].as_str() {
        Some("thread" | "page") => source["id"].as_str().unwrap_or("").into(),
        Some("lesson") => source["name"].as_str().unwrap_or("").into(),
        _ => format!("{} {}", source["label"].as_str().unwrap_or(""), source["version"].as_str().unwrap_or("")),
    }
}

fn slug(text: &str) -> String {
    let low = text.to_lowercase();
    let re = regex::Regex::new(r"[^a-z0-9]+").unwrap();
    let out = re.replace_all(&low, "-").trim_matches('-').to_string();
    out.chars().take(80).collect()
}

/// A new record's id: "thread-phinehas-script" as the Python app makes them, with "-pdf" for slides as PDF pages so the
/// two never share one.
fn new_id(store: &Store, source: &Value, structure: &str, to: &str) -> String {
    let base = slug(&format!("{} {} {}{}", s_(source, "kind"), source_name(source), structure, if to == "pdf" { " pdf" } else { "" }));
    let have: Vec<String> = records(store).iter().map(|r| s(r, "id")).collect();
    let (mut rid, mut n) = (base.clone(), 2);
    while have.contains(&rid) {
        rid = format!("{base}-{n}");
        n += 1;
    }
    rid
}

fn s_<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}

fn stem_of(name: &str) -> String {
    Path::new(name).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default()
}

/// A record by id, else by its file name or title: exact, then a unique start, then a unique part.
pub fn find(store: &Store, name: &str) -> Result<Rec> {
    let want = name.trim().to_lowercase();
    let every = records(store);
    let keys = |r: &Rec| [s(r, "id"), stem_of(&s(r, "name")).to_lowercase(), s(r, "name").to_lowercase(), s(r, "title").to_lowercase()];
    let pools: [Vec<&Rec>; 3] = [
        every.iter().filter(|r| keys(r).contains(&want)).collect(),
        every.iter().filter(|r| keys(r).iter().any(|k| k.starts_with(&want))).collect(),
        every.iter().filter(|r| keys(r).iter().any(|k| k.contains(&want))).collect(),
    ];
    let hit: Vec<&Rec> = if want.is_empty() { vec![] } else { pools.into_iter().find(|p| !p.is_empty()).unwrap_or_default() };
    if hit.is_empty() {
        return Err(missing(format!("No document called “{}”. docs lists them.", name.trim().chars().take(60).collect::<String>())));
    }
    if hit.len() > 1 {
        return Err(bad(format!("Which document? {}", hit.iter().take(6).map(|r| stem_of(&s(r, "name"))).collect::<Vec<_>>().join(" · "))));
    }
    Ok(hit[0].clone())
}

// ---- what the source says now --------------------------------------------------------------------------------------------

/// Why no plan can be made now: the source is gone; it will not read; or it is a document this app does not plan yet
/// (a lesson's or a passage's, or a structure the Python app makes until phase 5).
enum NoPlan {
    Gone,
    Unreadable(String),
    NotHere(String),
}

/// Sources whose entire contents are planned without page-specific switches.
pub enum Source {
    Thread(String),
    Passage { reference: String, version: String },
    Lesson(String),
}

impl Source {
    fn record(self, bible: &Bible, store: &Store) -> Result<Value> {
        match self {
            Self::Thread(id) => Ok(json!({"kind": "thread", "id": id})),
            Self::Passage { reference, version } => {
                let passage = crate::scripture::passage(bible, &reference, &version)?;
                Ok(json!({"kind": "passage", "ref": reference, "label": passage["label"], "version": passage["version"]}))
            }
            Self::Lesson(name) => {
                let id = studyapi::lesson_find(store, &name)?;
                Ok(json!({"kind": "lesson", "name": id}))
            }
        }
    }
}

/// A page record's switches (W6): the rows of What goes in moved from their defaults.
fn switched_of(rec: &Rec) -> serde_json::Map<String, Value> {
    rec.get("switched").and_then(|x| x.as_object()).cloned().unwrap_or_default()
}

/// A page record's version for every scripture block, when one was chosen (else each block's own).
fn version_of(rec: &Rec) -> Option<String> {
    rec.get("version").and_then(|x| x.as_str()).filter(|v| !v.is_empty()).map(String::from)
}

/// Read a recorded source into blocks and its output filename title.
fn read_source(bible: &Bible, store: &Store, rec: &Rec, margin: &mut plan::Margin) -> std::result::Result<(Vec<plan::Block>, String), NoPlan> {
    let source = &rec["source"];
    let id = s_(source, "id");
    match s_(source, "kind") {
        "thread" => {
            if !store.threads().iter().any(|t| s(t, "id") == id) {
                return Err(NoPlan::Gone);
            }
            let view = studyapi::thread_view(bible, store, id).map_err(|e| NoPlan::Unreadable(e.0))?;
            let thread = plan::thread_source(bible, &view, margin).map_err(|e| NoPlan::Unreadable(e.0))?;
            let title = s_(&thread, "name").to_string();
            Ok((plan::thread_blocks(&thread), title))
        }
        "page" => {
            if store.find_note(id).is_err() {
                return Err(NoPlan::Gone);
            }
            page::source(bible, store, id, &switched_of(rec), version_of(rec).as_deref()).map_err(|e| NoPlan::Unreadable(e.0))
        }
        "passage" => {
            let passage = crate::scripture::passage(bible, s_(source, "ref"), s_(source, "version"))
                .map_err(|e| NoPlan::Unreadable(e.0))?;
            let label = s_(&passage, "label");
            let title = format!("{label} ({})", s_(&passage, "version"));
            let stem = label.replace(':', ".").replace('–', "-");
            Ok((vec![("title".into(), json!(title)), ("scripture".into(), passage)], stem))
        }
        "lesson" => {
            let name = s_(source, "name");
            checked_name(name).map_err(|e| NoPlan::Unreadable(e.0))?;
            // Records are bound to the exact file, even if the user's original search was a partial name.
            let text = fs::read_to_string(store.root.join("lessons").join(format!("{name}.md"))).map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound { NoPlan::Gone } else { NoPlan::Unreadable(e.to_string()) }
            })?;
            let mut blocks = Vec::new();
            for (kind, value) in studyapi::lesson_parse(bible, &text).map_err(|e| NoPlan::Unreadable(e.0))? {
                let value = if kind == "word" {
                    let strong = value.as_str().unwrap_or_default();
                    plan::word_entry(bible, strong).map_err(|e| NoPlan::Unreadable(e.0))?
                        .ok_or_else(|| NoPlan::Unreadable(format!("No such Strong's number: {strong}.")))?
                } else {
                    value
                };
                blocks.push((kind.to_string(), value));
            }
            let title = blocks.iter().find(|(kind, _)| kind == "title").and_then(|(_, title)| title.as_str()).unwrap_or(name).to_string();
            Ok((blocks, title))
        }
        k => Err(NoPlan::NotHere(format!("Documents from a {k} are made and kept up to date by the Python app until phase 5."))),
    }
}

fn plan_now(bible: &Bible, store: &Store, rec: &Rec) -> std::result::Result<(Vec<Value>, Vec<plan::Block>, String), NoPlan> {
    let (to, structure) = (s(rec, "to"), s(rec, "structure"));
    // R3's new templates are planned here only for documents made here (they carry "design"); the Python app's own
    // Share Copies and Study Sheets stay the Python app's to keep up to date
    let ours = (rec.contains_key("design") || !rec.contains_key("name")) && matches!((to.as_str(), structure.as_str()), ("word", "share" | "study" | "reading") | ("pdf", "reader"));
    if !ours && !matches!((to.as_str(), structure.as_str()), ("word", "script") | ("deck", "reader" | "verse") | ("pdf", "verse")) {
        return Err(NoPlan::NotHere(format!("{} is made and kept up to date by the Python app until phase 5.", plan::structure_label(&to, &structure))));
    }
    let mut margin = plan::Margin::new(bible, store).map_err(|e| NoPlan::Unreadable(e.0))?;
    let (blocks, title) = read_source(bible, store, rec, &mut margin)?;
    let p = plan::plan_of_blocks(&to, &structure, &blocks, &mut margin).map_err(|e| NoPlan::Unreadable(e.0))?;
    Ok((p, blocks, title))
}

fn gone(source: &Value) -> Error {
    match s_(source, "kind") {
        "page" => missing("Its page is gone (deleted, or in the Trash)."),
        "lesson" => missing(format!("The lesson “{}” is gone.", source_name(source))),
        _ => missing(format!("The thread “{}” is gone.", source_name(source))),
    }
}

fn sha_file(path: &Path) -> Result<String> {
    Ok(plan::sha256_hex(&fs::read(path)?))
}

fn sig(path: &Path) -> Result<Value> {
    let m = fs::metadata(path)?;
    let t = m.modified()?.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    Ok(json!([t as u64, m.len()]))
}

fn changed_by_hand(rec: &Rec, path: &Path) -> bool {
    if sig(path).ok().as_ref() == rec.get("sig") {
        return false;
    }
    sha_file(path).ok().as_deref() != Some(s(rec, "file").as_str())
}

fn public(rec: &Rec, out: Option<&Path>) -> Value {
    let path = out.map(|dir| dir.join(s(rec, "name")));
    let there = path.as_ref().is_some_and(|p| p.is_file());
    let kept: Vec<Value> = rec.get("kept").and_then(|k| k.as_array()).map(|a| a.iter().filter(|k| {
        out.zip(k.as_str().and_then(|name| checked_name(name).ok())).is_some_and(|(dir, name)| dir.join(name).is_file())
    }).cloned().collect()).unwrap_or_default();
    let mut v = json!({"id": rec["id"], "name": rec["name"], "path": path.as_ref().map(|p| p.to_string_lossy()), "exists": there,
        "size": path.as_ref().and_then(|p| fs::metadata(p).ok()).filter(|m| m.is_file()).map(|m| m.len()).unwrap_or(0), "title": s(rec, "title"),
        "source": rec["source"], "to": rec["to"], "structure": rec["structure"], "theme": rec["theme"], "built": rec["built"],
        "pdf": rec.get("pdf").cloned().unwrap_or(Value::Null), "kept": kept});
    // made here (W6): a PDF's slide count, and a page's version and switches; the Python app's records have none
    for k in ["pages", "version", "switched", "design", "look"] {
        if let Some(x) = rec.get(k) {
            v[k] = x.clone();
        }
    }
    v
}

/// A record and how it stands: current, behind (its source has changed), edited (its file was changed by hand), missing
/// (the file is gone), gone (the source), unreadable (the source has an error), forgotten, or elsewhere (a document the
/// Python app keeps up to date until phase 5: a lesson's, or a structure not made here; `problem` says which).
pub fn status(bible: &Bible, store: &Store, folders: &ExportFolders, rec: &Rec) -> Value {
    match folders.resolve(rec) {
        Ok(out) => status_at(bible, store, out.or(folders.override_dir.as_deref()), rec),
        Err(err) => {
            let mut v = public(rec, None);
            v["state"] = json!("unreadable");
            v["problem"] = json!(err.0);
            v["edited"] = json!(false);
            v["behind"] = json!(false);
            v
        }
    }
}

fn status_at(bible: &Bible, store: &Store, out: Option<&Path>, rec: &Rec) -> Value {
    let path = out.map(|dir| dir.join(s(rec, "name"))).filter(|p| p.is_file());
    let there = path.is_some();
    let edited = path.as_ref().is_some_and(|p| changed_by_hand(rec, p));
    let mut v = public(rec, out);
    v["edited"] = json!(edited);
    if rec.get("forgotten") == Some(&json!(true)) {
        v["state"] = json!("forgotten");
        v["behind"] = json!(false);
        return v;
    }
    match plan_now(bible, store, rec) {
        Err(NoPlan::Gone) => {
            v["state"] = json!("gone");
            v["behind"] = json!(false);
        }
        Err(NoPlan::Unreadable(why)) => {
            v["state"] = json!("unreadable");
            v["behind"] = json!(false);
            v["problem"] = json!(why);
        }
        Err(NoPlan::NotHere(why)) => {
            // a missing file reads as the Python app says it; one that is there is the Python app's to keep up to date
            v["state"] = json!(if there { "elsewhere" } else { "missing" });
            v["behind"] = json!(false);
            if there {
                v["problem"] = json!(why);
            }
        }
        Ok((p, _, _)) => {
            let behind = plan::fingerprint(&p) != s(rec, "plan");
            // a file made before R3's design (by the Python app, or here before it) reads Old design, and is only
            // rebuilt when asked (docs/redesign-R3.md, decision 5)
            let old_design = rec.get("design").and_then(|d| d.as_i64()).unwrap_or(1) < docx::DESIGN;
            v["state"] = json!(if !there { "missing" } else if behind { "behind" } else if edited { "edited" } else if old_design { "old_design" } else { "current" });
            v["behind"] = json!(behind);
        }
    }
    v
}

/// Every document (or one source's documents), newest first.
pub fn listing(bible: &Bible, store: &Store, folders: &ExportFolders, of: Option<(&str, &str)>) -> Value {
    let mut every: Vec<Value> = records(store)
        .iter()
        .filter(|r| of.is_none_or(|(k, id)| r["source"]["kind"].as_str() == Some(k) && source_name(&r["source"]) == id))
        .map(|r| status(bible, store, folders, r))
        .collect();
    every.sort_by(|a, b| s_(b, "built").cmp(s_(a, "built")));
    json!(every)
}

// ---- building -----------------------------------------------------------------------------------------------------------

/// Word and PowerPoint hold what they have open against writing.
fn open_elsewhere(path: &Path) -> bool {
    match fs::OpenOptions::new().read(true).write(true).open(path) {
        Ok(_) => false,
        Err(e) => e.kind() == std::io::ErrorKind::PermissionDenied || matches!(e.raw_os_error(), Some(32 | 33)),
    }
}

fn busy(path: &Path, then: &str) -> Error {
    bad(format!(
        "“{}” is open in another program, probably Word or a PDF viewer. Close it and {then}; nothing was changed.",
        path.file_name().unwrap_or_default().to_string_lossy()
    ))
}

/// A file name the Python app accepts (pdf_export.safe_stem): letters, digits, spaces and . _ ( ) -.
fn safe_stem(text: &str) -> String {
    let keep: String = text.chars().filter(|c| c.is_ascii_alphanumeric() || " ._()-".contains(*c)).collect();
    let out = keep.split_whitespace().collect::<Vec<_>>().join(" ");
    let out = out.trim_matches(|c| c == ' ' || c == '.').to_string();
    if out.is_empty() { "Bible".into() } else { out }
}

fn unique(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    unique_reserved(dir, stem, ext, &[])
}

fn unique_reserved(dir: &Path, stem: &str, ext: &str, reserved: &[String]) -> PathBuf {
    let mut name = format!("{stem}{ext}");
    let mut n = 2;
    while dir.join(&name).exists() || reserved.iter().any(|other| other.eq_ignore_ascii_case(&name)) {
        name = format!("{stem} ({n}){ext}");
        n += 1;
    }
    dir.join(name)
}

/// The verses the source holds that are not in the finished file's text, word for word.
fn missing_verses(have: &str, verses: &[String]) -> Vec<String> {
    // a line broken after a hyphen (I-chabod at a large size) reads back as "I- chabod": the break is not a space
    let have = squash(have).replace("- ", "-");
    verses.iter().filter(|v| !have.contains(&squash(v).replace("- ", "-"))).cloned().collect()
}

/// A plan as a checked file at `at`. → what the check found
fn write_file(to: &str, structure: &str, p: &[Value], blocks: &[plan::Block], title: &str, theme: &plan::Theme, lk: &look::Look, at: &Path) -> Result<Value> {
    let verses = plan::source_verses(blocks);
    let (text, pages) = match to {
        "word" => {
            let (size, spacing) = plan::doc_type(structure);
            docx::write(p, theme, lk, title, size, spacing, at)?;
            (docx::file_text(at)?, None)
        }
        "pdf" => {
            let (pdf, text, pages) = deck::render(p, theme, lk, title)?;
            fs::write(at, pdf)?;
            (text, Some(pages))
        }
        "deck" => {
            let pages = pptx::write(p, theme, lk, at)?;
            let text = pptx::file_text(at, pages)?;
            (text, Some(pages))
        }
        _ => return Err(bad("Choose Word, PDF slides, or PowerPoint.")),
    };
    let gone = missing_verses(&text, &verses);
    if let Some(first) = gone.first() {
        let _ = fs::remove_file(at);
        return Err(bad(format!("The finished file was missing scripture, so it was not kept (“{}…”).", first.chars().take(50).collect::<String>())));
    }
    Ok(json!({"verses": verses.len(), "pages": pages, "refs": plan::source_refs(blocks)}))
}

/// The Look a record was made with (its kept values), or Preview for a record made before Looks.
pub fn look_of_record(rec: &Rec) -> look::Look {
    rec.get("look_values").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default()
}

/// The Look to make a document with: `name` (a Look's name) if given, else the record's own values, else the Look new
/// documents use; then each dial given (`dial=value`) applied. → (the Look's key, its values)
fn look_for(store: &Store, rec: &Rec, name: Option<&str>, dials: &[(String, String)]) -> Result<(String, look::Look)> {
    let (key, base) = match name.filter(|n| !n.is_empty()) {
        Some(n) => (look::key_of(n), look::get(store, n)?),
        None if rec.contains_key("look_values") => (s(rec, "look"), look_of_record(rec)),
        None => {
            let k = look::saved(store);
            let l = look::get(store, &k).unwrap_or_default();
            (k, l)
        }
    };
    let mut l = look::apply(base, dials)?;
    // the Reading Sheet is scripture in two columns, unless its own Look (kept, or given) says otherwise
    if s(rec, "structure") == "reading" && !rec.contains_key("look_values") && name.is_none() && !dials.iter().any(|(k, _)| k == "columns") {
        l.columns = 2;
    }
    Ok((key, l))
}

/// Keep the previous bytes until both PowerPoint outputs and their record are installed.
struct Replacement {
    target: PathBuf,
    backup: Option<PathBuf>,
    committed: bool,
}

impl Replacement {
    fn publish(staged: &Path, target: &Path, backup: PathBuf) -> Result<Self> {
        let backup = if target.is_file() {
            fs::copy(target, &backup)?;
            Some(backup)
        } else {
            None
        };
        fs::rename(staged, target).map_err(|e| if open_elsewhere(target) { busy(target, "update again") } else { e.into() })?;
        Ok(Self { target: target.to_path_buf(), backup, committed: false })
    }
}

impl Drop for Replacement {
    fn drop(&mut self) {
        if self.committed {
            return;
        }
        if let Some(backup) = &self.backup {
            let _ = fs::rename(backup, &self.target);
        } else {
            let _ = fs::remove_file(&self.target);
        }
    }
}

fn preview_name(rec: &Rec) -> Result<Option<&str>> {
    let name = rec.get("pdf").and_then(Value::as_str).filter(|s| !s.is_empty());
    name.map(|name| {
        checked_name(name)?;
        if !Path::new(name).extension().is_some_and(|ext| ext.eq_ignore_ascii_case("pdf")) {
            return Err(bad("The saved preview must be a PDF."));
        }
        Ok(name)
    }).transpose()
}

fn matching_preview(out: &Path, rec: &Rec) -> Option<PathBuf> {
    let path = out.join(preview_name(rec).ok()??);
    let hash = rec.get("preview_file").and_then(Value::as_str)?;
    (sha_file(&path).ok().as_deref() == Some(hash)).then_some(path)
}

#[allow(clippy::too_many_arguments)]
fn build(bible: &Bible, store: &Store, folders: &ExportFolders, mut rec: Rec, theme_key: &str, lk: (String, look::Look), force: bool) -> Result<Value> {
    let out = folders.build_in(&rec)?;
    let (look_key, lk) = lk;
    let look_values = serde_json::to_value(&lk).unwrap();
    crate::store::guard(&store.root)?;
    let theme = plan::theme(theme_key)?;
    let (p, blocks, title) = plan_now(bible, store, &rec).map_err(|e| match e {
        NoPlan::Gone => gone(&rec["source"]),
        NoPlan::Unreadable(why) | NoPlan::NotHere(why) => bad(why),
    })?;
    let finger = plan::fingerprint(&p);
    let old = rec.get("name").and_then(|n| n.as_str()).map(|n| out.join(n));
    let there = old.as_ref().is_some_and(|o| o.is_file());
    let powerpoint = rec["to"] == "deck";
    let previous_preview = powerpoint.then(|| matching_preview(out, &rec)).flatten();
    fs::create_dir_all(out)?;
    if there && !force && s(&rec, "plan") == finger && s(&rec, "theme") == theme_key && rec.get("design").and_then(|d| d.as_i64()) == Some(docx::DESIGN)
        && rec.get("look_values") == Some(&look_values) && (!powerpoint || previous_preview.is_some()) {
        let mut v = public(&rec, Some(out));
        v["changed"] = json!(false);
        v["kept_now"] = Value::Null;
        return Ok(v);
    }
    let to = s(&rec, "to");
    let structure = s(&rec, "structure");
    let label = plan::structure_label(&to, &structure);
    let stem = format!("{label} - {}", safe_stem(&title));
    let ext = ext(&to).unwrap();
    if let (true, Some(o)) = (there, old.as_ref()) {
        if open_elsewhere(o) {
            return Err(busy(o, "update again"));
        }
    }
    // built on the side, in the documents folder, and swapped in only when it passes the check
    static BUILD: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let run = BUILD.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let tmp_dir = out.join(format!(".building-{}-{run}", std::process::id()));
    fs::create_dir_all(&tmp_dir)?;
    let built = tmp_dir.join(format!("doc{ext}"));
    let checked = write_file(&to, &structure, &p, &blocks, &title, theme, &lk, &built);
    let result = (|| -> Result<Value> {
        let checked = checked?;
        // a first build, or a thread renamed, takes a new name, and never that of a file that is not this document's
        let target = match &old {
            Some(o) if s(&rec, "stem") == stem => o.clone(),
            _ => {
                // A fresh file must not be mistaken for another record's missing legacy export.
                let reserved = records(store).iter().filter(|r| r["id"] != rec["id"]).map(|r| s(r, "name")).collect::<Vec<_>>();
                unique_reserved(out, &stem, ext, &reserved)
            }
        };
        let preview = if powerpoint {
            let staged = tmp_dir.join("preview.pdf");
            let pdf = write_file("pdf", &structure, &p, &blocks, &title, theme, &lk, &staged)?;
            if pdf["pages"] != checked["pages"] {
                return Err(bad("The PowerPoint deck and its preview have different slide counts."));
            }
            let destination = previous_preview.clone().unwrap_or_else(|| unique(out, &format!("{stem} - Preview"), ".pdf"));
            if destination.is_file() && open_elsewhere(&destination) {
                return Err(busy(&destination, "update again"));
            }
            if previous_preview.is_none() {
                if let Some(name) = preview_name(&rec)?.filter(|name| out.join(name).is_file()) {
                    let mut kept = rec.get("kept").and_then(Value::as_array).cloned().unwrap_or_default();
                    kept.push(json!(name));
                    rec.insert("kept".into(), json!(kept));
                }
            }
            rec.insert("pdf".into(), json!(destination.file_name().unwrap().to_string_lossy()));
            rec.insert("preview_file".into(), json!(sha_file(&staged)?));
            Some((staged, destination))
        } else {
            None
        };
        let mut kept = None;
        if let (true, Some(o)) = (there, old.as_ref()) {
            if changed_by_hand(&rec, o) {
                let k = unique(out, &format!("{} (your edits {})", stem_of(&s(&rec, "name")), chrono::Local::now().format("%Y-%m-%d %H%M")), ext);
                fs::copy(o, &k)?;
                kept = Some(k);
            }
        }
        let mut installed = Vec::new();
        let publish = if let Some((staged, destination)) = preview {
            Replacement::publish(&staged, &destination, tmp_dir.join("original.pdf"))
                .and_then(|pdf| {
                    installed.push(pdf);
                    Replacement::publish(&built, &target, tmp_dir.join("original.pptx")).map(|pptx| installed.push(pptx))
                })
        } else {
            fs::rename(&built, &target).or_else(|_| fs::copy(&built, &target).map(|_| ())).map_err(Error::from)
        };
        if let Err(e) = publish {
            if let Some(k) = &kept {
                let _ = fs::remove_file(k);
            }
            return Err(if open_elsewhere(&target) { busy(&target, "update again") } else { e });
        }
        for (k, v) in [
            ("name", json!(target.file_name().unwrap().to_string_lossy())),
            ("stem", json!(stem)),
            ("title", json!(title)),
            ("theme", json!(theme_key)),
            ("plan", json!(finger)),
            ("design", json!(docx::DESIGN)),
            ("look", json!(look_key)),
            ("look_values", look_values.clone()),
            ("file", json!(sha_file(&target)?)),
            ("sig", sig(&target)?),
            ("built", json!(now())),
        ] {
            rec.insert(k.into(), v);
        }
        if to == "pdf" || powerpoint {
            rec.insert("pages".into(), checked["pages"].clone()); // slides as PDF pages: how many (the Python app passes these over)
        }
        if let Some(k) = &kept {
            let mut list = rec.get("kept").and_then(|x| x.as_array()).cloned().unwrap_or_default();
            list.push(json!(k.file_name().unwrap().to_string_lossy()));
            rec.insert("kept".into(), json!(list));
        }
        folders.remember(&mut rec, out);
        if let Err(e) = save(store, &rec) {
            if powerpoint {
                if let Some(k) = &kept { let _ = fs::remove_file(k); }
            }
            return Err(e);
        }
        for install in &mut installed {
            install.committed = true;
        }
        if let (true, Some(o)) = (there, old.as_ref()) {
            if *o != target {
                let _ = fs::remove_file(o); // the source was renamed; the file goes with it
            }
        }
        let mut v = public(&rec, Some(out));
        v["changed"] = json!(true);
        v["kept_now"] = kept.map(|k| json!(k.file_name().unwrap().to_string_lossy())).unwrap_or(Value::Null);
        v["checked"] = checked;
        if rec.get("pdf").is_some_and(|x| !x.is_null()) && to == "word" {
            v["pdf_not_updated"] = json!("Its PDF was made by the Python app (WordCraft); it is not remade here.");
        }
        Ok(v)
    })();
    let _ = fs::remove_dir_all(&tmp_dir);
    result
}

/// The theme new documents get: the one saved in settings/export.json (the Python app's), else Vellum.
pub fn saved_theme(store: &Store) -> String {
    let t = s(&store.settings("export"), "theme");
    if plan::theme(&t).is_ok() { t } else { plan::DEFAULT_THEME.into() }
}

pub fn set_theme(store: &mut Store, key: &str) -> Result<Value> {
    plan::theme(key)?;
    store.set_setting("export", "theme", Some(json!(key)))?;
    Ok(json!({"theme": key}))
}

fn source_structure(to: &str, structure: Option<&str>, source: &Value) -> Result<&'static plan::Structure> {
    let kind = s_(source, "kind");
    let structure = structure.filter(|s| !s.is_empty()).or(match (to, kind) {
        ("deck", "thread") => Some("verse"),
        ("deck", "lesson") | ("pdf", "lesson") => Some("reader"),
        _ => None,
    });
    plan::structure_of(if to == "deck" { "pdf" } else { to }, structure, kind)
}

/// The document for a source and structure: made the first time, brought up to date after. `to`: word, or pdf (slides as
/// PDF pages). new makes another alongside; force rebuilds even if nothing changed.
#[allow(clippy::too_many_arguments)]
pub fn make(bible: &Bible, store: &Store, folders: &ExportFolders, source: Source, to: &str, structure: Option<&str>, theme: Option<&str>, look_name: Option<&str>,
    dials: &[(String, String)], new: bool, force: bool) -> Result<Value> {
    if !matches!(to, "word" | "pdf" | "deck") {
        return Err(bad("to: word, pdf (slides as PDF pages), or deck (PowerPoint)."));
    }
    let source = source.record(bible, store)?;
    let st = source_structure(to, structure, &source)?;
    let theme = match theme.filter(|t| !t.is_empty()) {
        Some(t) => plan::theme(t)?.key.to_string(),
        None => saved_theme(store),
    };
    let same: Vec<Rec> = records(store)
        .into_iter()
        .filter(|r| s(r, "to") == to && s(r, "structure") == st.key && source_name(&r["source"]) == source_name(&source)
            && r["source"]["kind"] == source["kind"] && r.get("forgotten") != Some(&json!(true)))
        .collect();
    let alternate_design = matches!(s_(&source, "kind"), "passage" | "lesson")
        && to == "word" && matches!(st.key, "reading" | "share" | "study");
    let legacy = alternate_design && same.iter().any(|r| !r.contains_key("design"));
    let first = same.into_iter().filter(|r| !alternate_design || r.contains_key("design"))
        .min_by(|a, b| (s(a, "id").len(), s(a, "id")).cmp(&(s(b, "id").len(), s(b, "id"))));
    let rec = match first {
        Some(r) if !new => r,
        None if legacy && !new => return Err(bad("The existing document uses a legacy design. Use --new to make a separate Rust export.")),
        _ => json!({"id": new_id(store, &source, st.key, to), "source": source, "to": to, "structure": st.key}).as_object().unwrap().clone(),
    };
    let lk = look_for(store, &rec, look_name, dials)?;
    build(bible, store, folders, rec, &theme, lk, force)
}

/// One document by name, on its own theme unless given another.
pub fn update(bible: &Bible, store: &Store, folders: &ExportFolders, name: &str, theme: Option<&str>, look_name: Option<&str>, dials: &[(String, String)], force: bool) -> Result<Value> {
    let rec = find(store, name)?;
    if rec.get("forgotten") == Some(&json!(true)) {
        return Err(bad(format!("“{}” was forgotten, so it is left as it is. Remember it first (docs remember).", s(&rec, "name"))));
    }
    let theme = match theme.filter(|t| !t.is_empty()) {
        Some(t) => plan::theme(t)?.key.to_string(),
        None => s(&rec, "theme"),
    };
    let lk = look_for(store, &rec, look_name, dials)?;
    build(bible, store, folders, rec, &theme, lk, force)
}

/// Every document whose source has changed and whose file is still there, that this app makes. One that cannot be updated
/// does not stop the rest.
pub fn update_behind(bible: &Bible, store: &Store, folders: &ExportFolders) -> Value {
    let (mut done, mut failed) = (vec![], vec![]);
    for d in listing(bible, store, folders, None).as_array().unwrap() {
        let legacy_source = matches!(s_(&d["source"], "kind"), "passage" | "lesson") && d.get("design").is_none();
        if d["state"] != "behind" || (d["to"] == "deck" && d.get("design").is_none()) || legacy_source {
            continue;
        }
        match update(bible, store, folders, s_(d, "id"), None, None, &[], false) {
            Ok(v) => done.push(v),
            Err(e) => failed.push(json!({"name": d["name"], "error": e.0})),
        }
    }
    json!({"updated": done, "failed": failed})
}

/// Stop keeping a document up to date. It stays listed and its file is left alone; remember takes it back.
pub fn forget(store: &Store, name: &str) -> Result<Value> {
    let mut rec = find(store, name)?;
    rec.insert("forgotten".into(), json!(true));
    save(store, &rec)?;
    Ok(json!({"ok": true, "name": rec["name"]}))
}

/// Keep a forgotten document up to date again. → how it stands now.
pub fn remember(bible: &Bible, store: &Store, folders: &ExportFolders, name: &str) -> Result<Value> {
    let mut rec = find(store, name)?;
    rec.shift_remove("forgotten");
    save(store, &rec)?;
    Ok(status(bible, store, folders, &rec))
}

/// Take a document away: its file, its PDF and any kept versions are deleted from the disk (as the Python app does; they
/// are made files, not study work), and its record goes to the study folder's .trash (the rule for the study folder). A
/// file open in another program stops it before anything is deleted.
pub fn delete(store: &mut Store, folders: &ExportFolders, name: &str) -> Result<Value> {
    crate::store::guard(&store.root)?;
    let rec = find(store, name)?;
    let mut names = vec![s(&rec, "name")];
    if let Some(p) = rec.get("pdf").and_then(|x| x.as_str()) {
        names.push(p.into());
    }
    names.extend(rec.get("kept").and_then(|k| k.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default());
    let names = names.iter().filter(|n| !n.is_empty()).map(|n| checked_name(n)).collect::<Result<Vec<_>>>()?;
    let files: Vec<PathBuf> = match folders.resolve(&rec)? {
        Some(out) => names.iter().map(|n| out.join(n)).filter(|p| p.is_file()).collect(),
        None if names.len() == 1 => Vec::new(), // there is only a missing primary, so remove just its record
        None => return Err(missing("Restore the main export before deleting it so its PDF and kept copies can be located.")),
    };
    if let Some(f) = files.iter().find(|f| open_elsewhere(f)) {
        return Err(busy(f, "delete it"));
    }
    let mut deleted = vec![];
    for f in &files {
        fs::remove_file(f).map_err(|_| busy(f, "delete it"))?;
        deleted.push(json!(f.file_name().unwrap().to_string_lossy()));
    }
    store.trash_file(&records_dir(store).join(format!("{}.json", s(&rec, "id"))))?;
    Ok(json!({"ok": true, "name": rec["name"], "deleted": deleted}))
}

/// The plan a document would be made from now: what goes where, and its fingerprint (for a person or an AI
/// checking a document, and for comparing with the Python app's).
pub fn plan_for(bible: &Bible, store: &Store, source: Source, to: &str, structure: Option<&str>, layout: Option<PdfLayout<'_>>) -> Result<Value> {
    let source = source.record(bible, store)?;
    let st = source_structure(to, structure, &source)?;
    let mut margin = plan::Margin::new(bible, store)?;
    let rec = json!({"source": source}).as_object().unwrap().clone();
    let (blocks, title) = read_source(bible, store, &rec, &mut margin).map_err(|e| match e {
        NoPlan::Gone => gone(&rec["source"]),
        NoPlan::Unreadable(why) | NoPlan::NotHere(why) => Error(why),
    })?;
    let p = plan::plan_of_blocks(to, st.key, &blocks, &mut margin)?;
    let pages = layout.map(|options| pdf_plan_pages(store, &rec, to, &p, &title, options)).transpose()?;
    let mut result = json!({"to": to, "structure": st.key, "fingerprint": plan::fingerprint(&p), "plan": p});
    if let Some(pages) = pages {
        result["pages"] = json!(pages);
    }
    Ok(result)
}

/// Settings for the read-only PDF layout used by Adjust.
pub struct PdfLayout<'a> {
    pub theme: Option<&'a str>,
    pub look: Option<&'a str>,
    pub dials: &'a [(String, String)],
}

fn pdf_plan_pages(store: &Store, rec: &Rec, to: &str, p: &[Value], title: &str, options: PdfLayout<'_>) -> Result<usize> {
    if !matches!(to, "pdf" | "deck") {
        return Err(bad("Page counts are available for PDF slides."));
    }
    let theme = options.theme.filter(|key| !key.is_empty()).map(String::from).unwrap_or_else(|| {
        rec.get("theme").and_then(Value::as_str).map(String::from).unwrap_or_else(|| saved_theme(store))
    });
    let (_, lk) = look_for(store, rec, options.look, options.dials)?;
    deck::page_count(p, plan::theme(&theme)?, &lk, title)
}

// ---- a document from a page (W6) ----------------------------------------------------------------------------------------

/// A page uses Speaker Script for Word or Verse by Verse for slides by default.
fn page_structure(to: &str, structure: Option<&str>) -> Result<&'static str> {
    let key = match to {
        "word" => "script",
        "pdf" | "deck" => "verse",
        _ => return Err(bad("to: word, pdf (slides as PDF pages), or deck (PowerPoint).")),
    };
    if let Some(x) = structure.filter(|x| !x.is_empty()) {
        if let Ok(st) = plan::structure_of(to, Some(x), "lesson") {
            return Ok(st.key);
        }
    }
    match structure.filter(|x| !x.is_empty()) {
        Some(x) if x != key => Err(bad(format!(
            "From a page, here: {} ({key}); {} comes with the rest of the structures in phase 5.",
            plan::structure_label(to, key),
            plan::structure_label(to, x)
        ))),
        _ => Ok(key),
    }
}

/// A page's id as its documents name it, refusing a day's page (it has no title to be a document's).
fn page_id(store: &Store, page: &str) -> Result<String> {
    let (id, _, titled) = crate::pages::text_of(store, page)?;
    if !titled {
        return Err(bad("A day's page is not made into a document; a page with a title is."));
    }
    Ok(id)
}

/// A page's record for a structure, as it is or new.
fn page_record(store: &Store, id: &str, to: &str, structure: &str) -> Rec {
    let suffix = if to == "deck" { "-pptx" } else { "" };
    let rid = format!("page-{id}-{structure}{suffix}");
    records(store).into_iter().find(|r| s(r, "id") == rid).unwrap_or_else(|| {
        // a new one starts from the choices the page's other document was made with
        let mut r = json!({"id": rid, "source": {"kind": "page", "id": id}, "to": to, "structure": structure}).as_object().unwrap().clone();
        let (sw, ver) = page_choices(store, id);
        if !sw.is_empty() {
            r.insert("switched".into(), Value::Object(sw));
        }
        if let Some(v) = ver {
            r.insert("version".into(), json!(v));
        }
        r
    })
}

/// The switches a page's documents were last made with: its Speaker Script's, else its Verse by Verse's.
fn page_choices(store: &Store, id: &str) -> (serde_json::Map<String, Value>, Option<String>) {
    for st in ["script", "verse"] {
        if let Some(r) = records(store).into_iter().find(|r| s(r, "id") == format!("page-{id}-{st}")) {
            return (switched_of(&r), version_of(&r));
        }
    }
    (serde_json::Map::new(), None)
}

fn check_version(v: &str) -> Result<Option<String>> {
    match v.to_uppercase().as_str() {
        "" | "PAGE" => Ok(None),
        x @ ("KJV" | "YLT") => Ok(Some(x.to_string())),
        _ => Err(bad("version: kjv or ylt for every scripture block, or page (each block's own, the default).")),
    }
}

/// What goes in (sheet W7.2): each row of a page with its switch and what it becomes. The switches are those given
/// (`on`, `off`: rows' keys), else those its documents were last made with.
pub fn page_parts(bible: &Bible, store: &Store, page: &str, on: &[String], off: &[String], version: Option<&str>) -> Result<Value> {
    let id = page_id(store, page)?;
    let (mut switched, mut ver) = page_choices(store, &id);
    if !on.is_empty() || !off.is_empty() {
        switched = page::keep_switched(bible, store, &id, on, off)?;
    }
    if let Some(v) = version {
        ver = check_version(v)?;
    }
    let mut v = page::parts(bible, store, &id, &switched, ver.as_deref())?;
    v["version"] = json!(ver.clone().unwrap_or_else(|| "page".into()));
    let st = |key: &str| records(store).iter().any(|r| s(r, "id") == format!("page-{id}-{key}"));
    v["made"] = json!({"script": st("script"), "verse": st("verse")});
    Ok(v)
}

fn choose_page_parts(bible: &Bible, store: &Store, id: &str, rec: &mut Rec, version: Option<&str>, on: &[String], off: &[String]) -> Result<()> {
    if !on.is_empty() || !off.is_empty() {
        let sw = page::keep_switched(bible, store, id, on, off)?;
        if sw.is_empty() { rec.shift_remove("switched") } else { rec.insert("switched".into(), Value::Object(sw)) };
    }
    if let Some(v) = version {
        match check_version(v)? {
            Some(v) => rec.insert("version".into(), json!(v)),
            None => rec.shift_remove("version"),
        };
    }
    Ok(())
}

/// A document from a page (sheets W7.1–W7.3): `to` word makes its Speaker Script, pdf its Verse by Verse; made the first
/// time, brought up to date after, in the same file. `on`/`off` (rows' keys) set the switches anew (a row not named
/// takes its default); with neither, the switches it was last made with stay. `version`: kjv or ylt for every
/// scripture block, page for each block's own; none keeps the last.
#[allow(clippy::too_many_arguments)]
pub fn make_page(bible: &Bible, store: &Store, folders: &ExportFolders, page: &str, to: &str, structure: Option<&str>, theme: Option<&str>,
    version: Option<&str>, on: &[String], off: &[String], look_name: Option<&str>, dials: &[(String, String)], force: bool) -> Result<Value> {
    let key = page_structure(to, structure)?;
    let id = page_id(store, page)?;
    let mut rec = page_record(store, &id, to, key);
    let before = rec.clone();
    let theme = match theme.filter(|t| !t.is_empty()) {
        Some(t) => plan::theme(t)?.key.to_string(),
        None if rec.contains_key("theme") => s(&rec, "theme"),
        None => saved_theme(store),
    };
    rec.shift_remove("forgotten"); // asked for by name: kept up to date again
    choose_page_parts(bible, store, &id, &mut rec, version, on, off)?;
    // Resolve before saving changed switches, so a conflicting path cannot alter the record.
    folders.build_in(&rec)?;
    // a choice that changes nothing in the file is still kept, for the next time
    if rec.contains_key("name") && rec != before {
        save(store, &rec)?;
    }
    let lk = look_for(store, &rec, look_name, dials)?;
    build(bible, store, folders, rec, &theme, lk, force)
}

/// The plan a page's document would be made from now, optionally with pending Make choices.
#[allow(clippy::too_many_arguments)]
pub fn plan_for_page(bible: &Bible, store: &Store, page: &str, to: &str, structure: Option<&str>, version: Option<&str>,
    on: &[String], off: &[String], layout: Option<PdfLayout<'_>>) -> Result<Value> {
    let to = if to == "deck" { "pdf" } else { to };
    let key = page_structure(to, structure)?;
    let id = page_id(store, page)?;
    let mut rec = page_record(store, &id, to, key);
    choose_page_parts(bible, store, &id, &mut rec, version, on, off)?;
    let (p, blocks, title) = plan_now(bible, store, &rec).map_err(|e| match e {
        NoPlan::Gone => gone(&rec["source"]),
        NoPlan::Unreadable(why) | NoPlan::NotHere(why) => Error(why),
    })?;
    let pages = layout.map(|options| pdf_plan_pages(store, &rec, to, &p, &title, options)).transpose()?;
    let mut result = json!({"to": to, "structure": key, "fingerprint": plan::fingerprint(&p), "verses": plan::source_refs(&blocks), "plan": p});
    if let Some(pages) = pages {
        result["pages"] = json!(pages);
    }
    Ok(result)
}

/// A finished file as the window previews it (sheet W7.4). A Word document: its paragraphs with their styles, read from
/// the file itself. Slides as PDF pages: each page drawn in SVG by the same layout that made the PDF, while the document
/// is up to date (its plan's fingerprint is the file's, so the pages are the file's); one that has changed since says so
/// (`stale`) rather than show pages the file does not have.
pub fn preview(bible: &Bible, store: &Store, folders: &ExportFolders, name: &str) -> Result<Value> {
    let rec = find(store, name)?;
    if rec["to"] == "deck" {
        let pdf = preview_path(folders, &rec)?;
        return Ok(json!({"id": rec["id"], "name": rec["name"], "to": rec["to"], "pdf": pdf, "pages": rec["pages"]}));
    }
    let path = existing_file(folders, &rec)?;
    let mut v = json!({"id": rec["id"], "name": rec["name"], "to": rec["to"], "path": path.to_string_lossy()});
    match s(&rec, "to").as_str() {
        "word" => v["paras"] = docx::paragraphs(&path)?,
        "pdf" => {
            let st = status_at(bible, store, path.parent(), &rec);
            if st["state"] != "current" {
                v["last_built_pages"] = st["pages"].clone();
                v["stale"] = json!("Its source has changed since this file was made, so it is not drawn here: Make again, or open the file as it is.");
                return Ok(v);
            }
            let (p, _, title) = plan_now(bible, store, &rec).map_err(|_| bad("Its source cannot be read now; open the file as it is."))?;
            let slides = deck::pages_svg(&p, plan::theme(&s(&rec, "theme"))?, &look_of_record(&rec), &title)?;
            v["pages"] = json!(slides.len());
            v["slides"] = json!(slides);
        }
        _ => return Err(bad("There is no preview for this file.")),
    }
    Ok(v)
}

fn preview_path(folders: &ExportFolders, rec: &Rec) -> Result<PathBuf> {
    let name = preview_name(rec)?.ok_or_else(|| missing("This PowerPoint file has no saved PDF preview."))?;
    if let Some(out) = folders.resolve(rec)? {
        let path = out.join(name);
        if path.is_file() {
            return Ok(path);
        }
        return Err(missing(format!("The saved PDF preview “{name}” is missing.")));
    }
    let files = pdfs::list(folders)?;
    Ok(pdfs::find(&files, name, true)?.path.clone())
}

pub fn open_preview(store: &Store, folders: &ExportFolders, name: &str) -> Result<Value> {
    let rec = find(store, name)?;
    if rec["to"] != "deck" {
        return Err(bad("Only PowerPoint files have a separate PDF preview."));
    }
    let path = preview_path(folders, &rec)?;
    open_file(&path)?;
    Ok(json!({"ok": true, "name": path.file_name().unwrap().to_string_lossy(), "path": path}))
}

fn existing_file(folders: &ExportFolders, rec: &Rec) -> Result<PathBuf> {
    let name = s(rec, "name");
    folders.resolve(rec)?.map(|dir| dir.join(&name)).filter(|path| path.is_file())
        .ok_or_else(|| missing(format!("“{name}” is not there. Check its export folder or use docs update to rebuild it.")))
}

pub fn open(store: &Store, folders: &ExportFolders, name: &str) -> Result<Value> {
    let rec = find(store, name)?;
    let path = existing_file(folders, &rec)?;
    open_file(&path)?;
    Ok(json!({"ok": true, "name": rec["name"], "path": path.to_string_lossy()}))
}

/// Show a document's file in its folder (Explorer, the Finder), picked out.
pub fn reveal(store: &Store, folders: &ExportFolders, name: &str) -> Result<Value> {
    let rec = find(store, name)?;
    let path = existing_file(folders, &rec)?;
    if std::env::var("WB_NO_OPEN").as_deref() == Ok("1") {
        return Ok(json!({"ok": true, "name": rec["name"], "path": path.to_string_lossy()}));
    }
    let spawned = if cfg!(windows) {
        std::process::Command::new("explorer.exe").arg(format!("/select,{}", path.display())).spawn()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg("-R").arg(&path).spawn()
    } else {
        std::process::Command::new("xdg-open").arg(path.parent().unwrap()).spawn()
    };
    spawned.map_err(|e| bad(format!("Could not show {} ({e}).", path.display())))?;
    Ok(json!({"ok": true, "name": rec["name"], "path": path.to_string_lossy()}))
}

/// Open a finished file in the program the computer opens it with (Word, a PDF viewer).
pub fn open_file(path: &Path) -> Result<()> {
    if !path.is_file() {
        return Err(missing(format!("{} is not there; docs update makes it again.", path.file_name().unwrap_or_default().to_string_lossy())));
    }
    if std::env::var("WB_NO_OPEN").as_deref() == Ok("1") {
        return Ok(());
    }
    let spawned = if cfg!(windows) {
        std::process::Command::new("explorer.exe").arg(path).spawn()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(path).spawn()
    } else {
        std::process::Command::new("xdg-open").arg(path).spawn()
    };
    spawned.map(|_| ()).map_err(|e| bad(format!("Could not open {} ({e}).", path.display())))
}

/// The themes and structures, for a picker: which this app makes, and the saved theme.
pub fn designs(store: &Store) -> Value {
    let show = |t: &[plan::Structure]| -> Value {
        Value::Object(t.iter().map(|s| (s.key.to_string(), json!({"label": s.label, "about": s.about, "sources": s.sources, "made_here": s.made_here}))).collect())
    };
    let themes: serde_json::Map<String, Value> = plan::THEMES
        .iter()
        .map(|t| (t.key.to_string(), json!({"name": t.name, "best_for": t.best_for, "paper": t.paper, "ink": t.ink, "accent": t.accent,
            "doc_accent": t.doc_accent, "heading": t.heading, "body": t.body})))
        .collect();
    json!({"themes": themes, "decks": show(plan::DECKS), "docs": show(plan::DOCS), "default_theme": plan::DEFAULT_THEME, "theme": saved_theme(store)})
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A source whose "verse" is plain words (no scripture is typed in a test), and a plan that leaves it out: the check
    /// refuses the file and leaves nothing behind, for Word and for PDF pages alike.
    #[test]
    fn a_file_missing_a_verse_is_not_kept() {
        let thread = json!({"name": "T", "note": "", "words": [], "places": [
            {"label": "A place", "version": "KJV", "verses": [{"v": 1, "text": "words that must be in the file"}]}]});
        let theme = plan::theme("print").unwrap();
        let dir = std::env::temp_dir().join("bible-workbench-rs").join(format!("docs-check-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let word = vec![json!(["para", "Title", [["T", null]], false])];
        let at = dir.join("doc.docx");
        let e = write_file("word", "script", &word, &plan::thread_blocks(&thread), "T", theme, &look::Look::default(), &at).unwrap_err();
        assert!(e.0.contains("missing scripture") && e.0.contains("words that must be in"), "{}", e.0);
        assert!(!at.exists());
        let slides = vec![json!({"kind": "title", "title": "T", "sub": ""})];
        let at = dir.join("deck.pdf");
        assert!(write_file("pdf", "verse", &slides, &plan::thread_blocks(&thread), "T", theme, &look::Look::default(), &at).unwrap_err().0.contains("missing scripture"));
        assert!(!at.exists());
        // and with the verse on its slide, it is kept
        let v = &thread["places"][0]["verses"][0];
        let slides = vec![slides[0].clone(), json!({"kind": "verse", "ref": "A place (KJV)", "verse": v, "before": null, "after": null, "marks": [[6, 10]], "notes": ""})];
        assert_eq!(write_file("pdf", "verse", &slides, &plan::thread_blocks(&thread), "T", theme, &look::Look::default(), &at).unwrap()["pages"], 2);
        assert!(fs::read(&at).unwrap().starts_with(b"%PDF-"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn explicit_override_is_bound_to_the_original_directory() {
        let root = std::env::temp_dir().join("h07-study");
        let folders = ExportFolders { local: root.join("exports"), override_dir: Some(root.join("shared")), legacy: root.join("legacy") };
        let mut rec = Rec::new();
        assert_eq!(folders.build_in(&rec).unwrap(), root.join("shared"));
        let shared = folders.preferred();
        folders.remember(&mut rec, shared);
        rec.insert("name".into(), json!("export.docx"));
        assert_eq!(folders.build_in(&rec).unwrap(), shared);
        let changed = ExportFolders { override_dir: Some(root.join("different")), ..folders };
        assert!(changed.build_in(&rec).unwrap_err().0.contains("original WB_DOCS_DIR"));
    }

    #[test]
    fn names_and_folders() {
        assert_eq!(safe_stem("Lesson: Phinehas / 25:11"), "Lesson Phinehas 2511");
        assert_eq!(slug("thread Phinehas echoes script pdf"), "thread-phinehas-echoes-script-pdf");
        let scratch = std::env::temp_dir().join("x").join("study-scratch");
        if std::env::var("WB_DOCS_DIR").is_err() {
            assert_eq!(ExportFolders::for_study(&scratch).unwrap().preferred(), scratch.join("exports"));
        }
    }
}
