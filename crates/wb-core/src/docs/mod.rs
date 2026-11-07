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

pub mod deck;
pub mod docx;
pub mod plan;

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

/// The documents folder: `WB_DOCS_DIR`; else, for the person's real study folder, the Python app's (`BIBLE_WORKBENCH_PDF_DIR`,
/// or Documents\Bible Workbench), where its documents already are; else a folder beside the study folder, so a scratch copy
/// never writes into the person's real documents.
pub fn folder_for(study: &Path) -> PathBuf {
    if let Ok(p) = std::env::var("WB_DOCS_DIR") {
        return PathBuf::from(p);
    }
    let real = matches!((fs::canonicalize(study), fs::canonicalize(crate::real_study_dir())), (Ok(a), Ok(b)) if a == b);
    if real {
        if let Ok(p) = std::env::var("BIBLE_WORKBENCH_PDF_DIR") {
            return PathBuf::from(p);
        }
        let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from).unwrap_or_default();
        return home.join("Documents").join("Bible Workbench");
    }
    let name = study.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "study".into());
    study.with_file_name(format!("{name}-documents"))
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
                && matches!(rec.get("source").and_then(|x| x["kind"].as_str()), Some("thread" | "passage" | "lesson"));
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
        Some("thread") => source["id"].as_str().unwrap_or("").into(),
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

/// The source as a plan reads it, and its title.
fn read_source(bible: &Bible, store: &Store, source: &Value, margin: &mut plan::Margin) -> std::result::Result<(Value, String), NoPlan> {
    if s_(source, "kind") != "thread" {
        return Err(NoPlan::NotHere(format!("Documents from a {} are made and kept up to date by the Python app until phase 5.", s_(source, "kind"))));
    }
    let id = s_(source, "id");
    if !store.threads().iter().any(|t| s(t, "id") == id) {
        return Err(NoPlan::Gone);
    }
    let view = studyapi::thread_view(bible, store, id).map_err(|e| NoPlan::Unreadable(e.0))?;
    let thread = plan::thread_source(bible, &view, margin).map_err(|e| NoPlan::Unreadable(e.0))?;
    let title = s_(&thread, "name").to_string();
    Ok((thread, title))
}

fn plan_now(bible: &Bible, store: &Store, rec: &Rec) -> std::result::Result<(Vec<Value>, Value, String), NoPlan> {
    let (to, structure) = (s(rec, "to"), s(rec, "structure"));
    if !matches!((to.as_str(), structure.as_str()), ("word", "script") | ("deck" | "pdf", "verse")) {
        return Err(NoPlan::NotHere(format!("{} is made and kept up to date by the Python app until phase 5.", plan::structure_label(&to, &structure))));
    }
    let mut margin = plan::Margin::new(bible, store).map_err(|e| NoPlan::Unreadable(e.0))?;
    let (thread, title) = read_source(bible, store, &rec["source"], &mut margin)?;
    let p = plan::plan_of(&to, &structure, &thread, &mut margin).map_err(|e| NoPlan::Unreadable(e.0))?;
    Ok((p, thread, title))
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

fn public(rec: &Rec, out: &Path) -> Value {
    let path = out.join(s(rec, "name"));
    let there = path.is_file();
    let kept: Vec<Value> = rec.get("kept").and_then(|k| k.as_array()).map(|a| a.iter().filter(|k| out.join(k.as_str().unwrap_or("")).is_file()).cloned().collect()).unwrap_or_default();
    json!({"id": rec["id"], "name": rec["name"], "path": path.to_string_lossy(), "exists": there,
        "size": if there { fs::metadata(&path).map(|m| m.len()).unwrap_or(0) } else { 0 }, "title": s(rec, "title"),
        "source": rec["source"], "to": rec["to"], "structure": rec["structure"], "theme": rec["theme"], "built": rec["built"],
        "pdf": rec.get("pdf").cloned().unwrap_or(Value::Null), "kept": kept})
}

/// A record and how it stands: current, behind (its source has changed), edited (its file was changed by hand), missing
/// (the file is gone), gone (the source), unreadable (the source has an error), forgotten, or elsewhere (a document the
/// Python app keeps up to date until phase 5: a lesson's, or a structure not made here; `problem` says which).
pub fn status(bible: &Bible, store: &Store, out: &Path, rec: &Rec) -> Value {
    let path = out.join(s(rec, "name"));
    let there = path.is_file();
    let edited = there && changed_by_hand(rec, &path);
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
            v["state"] = json!(if !there { "missing" } else if behind { "behind" } else if edited { "edited" } else { "current" });
            v["behind"] = json!(behind);
        }
    }
    v
}

/// Every document (or one thread's), newest first.
pub fn listing(bible: &Bible, store: &Store, out: &Path, thread: Option<&str>) -> Value {
    let mut every: Vec<Value> = records(store)
        .iter()
        .filter(|r| thread.is_none_or(|t| r["source"]["id"].as_str() == Some(t)))
        .map(|r| status(bible, store, out, r))
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
    let mut out = dir.join(format!("{stem}{ext}"));
    let mut n = 2;
    while out.exists() {
        out = dir.join(format!("{stem} ({n}){ext}"));
        n += 1;
    }
    out
}

/// The verses the source holds that are not in the finished file's text, word for word.
fn missing_verses(have: &str, verses: &[String]) -> Vec<String> {
    let have = squash(have);
    verses.iter().filter(|v| !have.contains(&squash(v))).cloned().collect()
}

/// A plan as a checked file at `at`. → what the check found
fn write_file(to: &str, structure: &str, p: &[Value], thread: &Value, title: &str, theme: &plan::Theme, at: &Path) -> Result<Value> {
    let verses = plan::source_verses(&plan::thread_blocks(thread));
    let (text, pages) = match to {
        "word" => {
            let (size, spacing) = plan::doc_type(structure);
            docx::write(p, theme, title, size, spacing, at)?;
            (docx::file_text(at)?, None)
        }
        "pdf" => {
            let (pdf, text, pages) = deck::render(p, theme, title)?;
            fs::write(at, pdf)?;
            (text, Some(pages))
        }
        _ => return Err(bad("PowerPoint decks are made by the Python app until phase 5; here a deck is made as PDF pages (--to pdf).")),
    };
    let gone = missing_verses(&text, &verses);
    if let Some(first) = gone.first() {
        let _ = fs::remove_file(at);
        return Err(bad(format!("The finished file was missing scripture, so it was not kept (“{}…”).", first.chars().take(50).collect::<String>())));
    }
    Ok(json!({"verses": verses.len(), "pages": pages}))
}

fn build(bible: &Bible, store: &Store, out: &Path, mut rec: Rec, theme_key: &str, force: bool) -> Result<Value> {
    crate::store::guard(&store.root)?;
    let theme = plan::theme(theme_key)?;
    let (p, thread, title) = plan_now(bible, store, &rec).map_err(|e| match e {
        NoPlan::Gone => missing(format!("The thread “{}” is gone.", source_name(&rec["source"]))),
        NoPlan::Unreadable(why) | NoPlan::NotHere(why) => bad(why),
    })?;
    let finger = plan::fingerprint(&p);
    let old = rec.get("name").and_then(|n| n.as_str()).map(|n| out.join(n));
    let there = old.as_ref().is_some_and(|o| o.is_file());
    fs::create_dir_all(out)?;
    if there && !force && s(&rec, "plan") == finger && s(&rec, "theme") == theme_key {
        let mut v = public(&rec, out);
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
    let tmp_dir = out.join(format!(".building-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir)?;
    let built = tmp_dir.join(format!("doc{ext}"));
    let checked = write_file(&to, &structure, &p, &thread, &title, theme, &built);
    let result = (|| -> Result<Value> {
        let checked = checked?;
        // a first build, or a thread renamed, takes a new name, and never that of a file that is not this document's
        let target = match &old {
            Some(o) if s(&rec, "stem") == stem => o.clone(),
            _ => unique(out, &stem, ext),
        };
        let mut kept = None;
        if let (true, Some(o)) = (there, old.as_ref()) {
            if changed_by_hand(&rec, o) {
                let k = unique(out, &format!("{} (your edits {})", stem_of(&s(&rec, "name")), chrono::Local::now().format("%Y-%m-%d %H%M")), ext);
                fs::copy(o, &k)?;
                kept = Some(k);
            }
        }
        if let Err(e) = fs::rename(&built, &target).or_else(|_| fs::copy(&built, &target).map(|_| ())) {
            if let Some(k) = &kept {
                let _ = fs::remove_file(k);
            }
            return Err(if open_elsewhere(&target) { busy(&target, "update again") } else { e.into() });
        }
        if let (true, Some(o)) = (there, old.as_ref()) {
            if *o != target {
                let _ = fs::remove_file(o); // the thread was renamed; the file goes with it
            }
        }
        for (k, v) in [
            ("name", json!(target.file_name().unwrap().to_string_lossy())),
            ("stem", json!(stem)),
            ("title", json!(title)),
            ("theme", json!(theme_key)),
            ("plan", json!(finger)),
            ("file", json!(sha_file(&target)?)),
            ("sig", sig(&target)?),
            ("built", json!(now())),
        ] {
            rec.insert(k.into(), v);
        }
        if let Some(k) = &kept {
            let mut list = rec.get("kept").and_then(|x| x.as_array()).cloned().unwrap_or_default();
            list.push(json!(k.file_name().unwrap().to_string_lossy()));
            rec.insert("kept".into(), json!(list));
        }
        save(store, &rec)?;
        let mut v = public(&rec, out);
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

/// The document for a thread and structure: made the first time, brought up to date after. `to`: word, or pdf (slides as
/// PDF pages). new makes another alongside; force rebuilds even if nothing changed.
pub fn make(bible: &Bible, store: &Store, out: &Path, thread: &str, to: &str, structure: Option<&str>, theme: Option<&str>, new: bool, force: bool) -> Result<Value> {
    if !matches!(to, "word" | "pdf") {
        return Err(bad("to: word, or pdf (slides as PDF pages; PowerPoint is made by the Python app until phase 5)."));
    }
    let st = plan::structure_of(to, structure, "thread")?;
    let theme = match theme.filter(|t| !t.is_empty()) {
        Some(t) => plan::theme(t)?.key.to_string(),
        None => saved_theme(store),
    };
    let source = json!({"kind": "thread", "id": thread});
    let same: Vec<Rec> = records(store)
        .into_iter()
        .filter(|r| s(r, "to") == to && s(r, "structure") == st.key && source_name(&r["source"]) == source_name(&source)
            && r["source"]["kind"] == "thread" && r.get("forgotten") != Some(&json!(true)))
        .collect();
    let first = same.into_iter().min_by(|a, b| (s(a, "id").len(), s(a, "id")).cmp(&(s(b, "id").len(), s(b, "id"))));
    let rec = match first {
        Some(r) if !new => r,
        _ => json!({"id": new_id(store, &source, st.key, to), "source": source, "to": to, "structure": st.key}).as_object().unwrap().clone(),
    };
    build(bible, store, out, rec, &theme, force)
}

/// One document by name, on its own theme unless given another.
pub fn update(bible: &Bible, store: &Store, out: &Path, name: &str, theme: Option<&str>, force: bool) -> Result<Value> {
    let rec = find(store, name)?;
    if rec.get("forgotten") == Some(&json!(true)) {
        return Err(bad(format!("“{}” was forgotten, so it is left as it is. Remember it first (docs remember).", s(&rec, "name"))));
    }
    if s(&rec, "to") == "deck" {
        return Err(bad(format!(
            "“{}” is PowerPoint, made by the Python app; it is updated there until phase 5. Here: wb craft deck --thread {} --structure {} makes it as PDF pages.",
            s(&rec, "name"),
            source_name(&rec["source"]),
            s(&rec, "structure")
        )));
    }
    let theme = match theme.filter(|t| !t.is_empty()) {
        Some(t) => plan::theme(t)?.key.to_string(),
        None => s(&rec, "theme"),
    };
    build(bible, store, out, rec, &theme, force)
}

/// Every document whose source has changed and whose file is still there, that this app makes. One that cannot be updated
/// does not stop the rest.
pub fn update_behind(bible: &Bible, store: &Store, out: &Path) -> Value {
    let (mut done, mut failed) = (vec![], vec![]);
    for d in listing(bible, store, out, None).as_array().unwrap() {
        if d["state"] != "behind" || d["to"] == "deck" {
            continue;
        }
        match update(bible, store, out, s_(d, "id"), None, false) {
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
pub fn remember(bible: &Bible, store: &Store, out: &Path, name: &str) -> Result<Value> {
    let mut rec = find(store, name)?;
    rec.shift_remove("forgotten");
    save(store, &rec)?;
    Ok(status(bible, store, out, &rec))
}

/// Take a document away: its file, its PDF and any kept versions are deleted from the disk (as the Python app does; they
/// are made files, not study work), and its record goes to the study folder's .trash (the rule for the study folder). A
/// file open in another program stops it before anything is deleted.
pub fn delete(store: &mut Store, out: &Path, name: &str) -> Result<Value> {
    crate::store::guard(&store.root)?;
    let rec = find(store, name)?;
    let mut names = vec![s(&rec, "name")];
    if let Some(p) = rec.get("pdf").and_then(|x| x.as_str()) {
        names.push(p.into());
    }
    names.extend(rec.get("kept").and_then(|k| k.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default());
    let files: Vec<PathBuf> = names.iter().filter(|n| !n.is_empty()).map(|n| out.join(n)).filter(|p| p.is_file()).collect();
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

/// The plan a document would be made from now, for a thread: what goes where, and its fingerprint (for a person or an AI
/// checking a document, and for comparing with the Python app's).
pub fn plan_for(bible: &Bible, store: &Store, thread: &str, to: &str, structure: Option<&str>) -> Result<Value> {
    let st = plan::structure_of(if to == "deck" { "pdf" } else { to }, structure, "thread")?;
    let mut margin = plan::Margin::new(bible, store)?;
    let (t, _) = read_source(bible, store, &json!({"kind": "thread", "id": thread}), &mut margin).map_err(|e| match e {
        NoPlan::Gone => missing(format!("No thread “{thread}”.")),
        NoPlan::Unreadable(why) | NoPlan::NotHere(why) => Error(why),
    })?;
    let p = plan::plan_of(to, st.key, &t, &mut margin)?;
    Ok(json!({"to": to, "structure": st.key, "fingerprint": plan::fingerprint(&p), "plan": p}))
}

/// Open a finished file in the program the computer opens it with (Word, a PDF viewer).
pub fn open_file(path: &Path) -> Result<()> {
    if !path.is_file() {
        return Err(missing(format!("{} is not there; docs update makes it again.", path.file_name().unwrap_or_default().to_string_lossy())));
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
        let e = write_file("word", "script", &word, &thread, "T", theme, &at).unwrap_err();
        assert!(e.0.contains("missing scripture") && e.0.contains("words that must be in"), "{}", e.0);
        assert!(!at.exists());
        let slides = vec![json!({"kind": "title", "title": "T", "sub": ""})];
        let at = dir.join("deck.pdf");
        assert!(write_file("pdf", "verse", &slides, &thread, "T", theme, &at).unwrap_err().0.contains("missing scripture"));
        assert!(!at.exists());
        // and with the verse on its slide, it is kept
        let v = &thread["places"][0]["verses"][0];
        let slides = vec![slides[0].clone(), json!({"kind": "verse", "ref": "A place (KJV)", "verse": v, "before": null, "after": null, "marks": [[6, 10]], "notes": ""})];
        assert_eq!(write_file("pdf", "verse", &slides, &thread, "T", theme, &at).unwrap()["pages"], 2);
        assert!(fs::read(&at).unwrap().starts_with(b"%PDF-"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn names_and_folders() {
        assert_eq!(safe_stem("Lesson: Phinehas / 25:11"), "Lesson Phinehas 2511");
        assert_eq!(slug("thread Phinehas echoes script pdf"), "thread-phinehas-echoes-script-pdf");
        let scratch = std::env::temp_dir().join("x").join("study-scratch");
        if std::env::var("WB_DOCS_DIR").is_err() {
            assert_eq!(folder_for(&scratch), std::env::temp_dir().join("x").join("study-scratch-documents"));
        }
    }
}
