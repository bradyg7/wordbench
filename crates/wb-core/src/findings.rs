//! The person's findings about the app while it is being built (note 50c1, decided 2026-11-06): what they notice while
//! studying, written down at once and kept apart from the study so a development session can read them (`wb findings`).
//!
//! findings/<id>.md   one finding: a header like a note's (`id`, `kind: "finding"`, `status` open or handled, `created`,
//!                    `updated`, and `context`: what was on screen when it was written: size, panes, place, version, build)
//!                    and the person's text after it.
//!
//! The folder sits beside notes/, not inside it: the Notebook does not list findings, and the Python app passes over the
//! folder (it reads notes/, threads/, trails/, highlights/ and sets/). A finding deleted goes to `.trash/`, as notes do.
//!
//! findings/<id>/    the files attached to a finding (debug round C1, finding b737): examples, screenshots, a PDF. They are
//!                   copied in (the person's file stays where it was), at most `MAX_ATTACH_BYTES` each, and listed from the
//!                   folder itself, so a finding's `.md` is the same with or without them. A file taken off goes to `.trash/`.
use crate::store::{bad, dump_md, guard, missing, new_id, now, parse_md, s, write_atomic, Rec};
use crate::Result;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

fn dir(root: &Path) -> PathBuf {
    root.join("findings")
}

fn title_of(text: &str) -> String {
    let first = text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    let first = first.trim_start_matches('#').trim();
    if first.chars().count() > 90 { format!("{}…", first.chars().take(88).collect::<String>()) } else { first.to_string() }
}

/// The most one attached file may hold: 10 MB (the window says so when a file is over).
pub const MAX_ATTACH_BYTES: u64 = 10 * 1024 * 1024;

fn files_dir(root: &Path, id: &str) -> PathBuf {
    dir(root).join(id)
}

/// The files attached to a finding, by name: `{name, size, path}`.
fn files_of(root: &Path, id: &str) -> Vec<Value> {
    if id.is_empty() {
        return vec![];
    }
    let mut v: Vec<(String, u64, PathBuf)> = fs::read_dir(files_dir(root, id))
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    let md = e.metadata().ok()?;
                    (md.is_file() && !name.ends_with(".tmp")).then(|| (name, md.len(), e.path()))
                })
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
    v.into_iter().map(|(name, size, path)| json!({"name": name, "size": size, "path": path.to_string_lossy()})).collect()
}

fn public(root: &Path, meta: &Rec, body: &str) -> Value {
    json!({"id": meta.get("id").cloned().unwrap_or(Value::Null), "status": s(meta, "status"), "created": s(meta, "created"),
        "updated": s(meta, "updated"), "title": title_of(body), "text": body.trim_end_matches('\n'),
        "context": meta.get("context").cloned().unwrap_or(Value::Null), "files": files_of(root, &s(meta, "id"))})
}

fn read_one(p: &Path) -> Option<(Rec, String)> {
    let (meta, body) = parse_md(&fs::read_to_string(p).ok()?);
    (s(&meta, "kind") == "finding" && !s(&meta, "id").is_empty()).then_some((meta, body))
}

/// Every finding, newest first (only the open ones unless `all`), with how many are open and handled.
pub fn list(root: &Path, all: bool) -> Result<Value> {
    let mut items: Vec<(Rec, String)> = fs::read_dir(dir(root))
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "md")).filter_map(|p| read_one(&p)).collect())
        .unwrap_or_default();
    items.sort_by(|a, b| s(&b.0, "created").cmp(&s(&a.0, "created")).then(s(&b.0, "id").cmp(&s(&a.0, "id"))));
    let open = items.iter().filter(|(m, _)| s(m, "status") != "handled").count();
    let handled = items.len() - open;
    let out: Vec<Value> = items.iter().filter(|(m, _)| all || s(m, "status") != "handled").map(|(m, b)| public(root, m, b)).collect();
    Ok(json!({"findings": out, "counts": {"open": open, "handled": handled}}))
}

/// One finding by its id, or by the end of its id (the last four characters are enough: `1b2d`).
fn find(root: &Path, id: &str) -> Result<(PathBuf, Rec, String)> {
    let id = id.trim();
    if id.is_empty() {
        return Err(bad("Name a finding by its id."));
    }
    let exact = dir(root).join(format!("{id}.md"));
    if let Some((m, b)) = read_one(&exact) {
        return Ok((exact, m, b));
    }
    let hits: Vec<PathBuf> = fs::read_dir(dir(root))
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "md") && p.file_stem().is_some_and(|x| x.to_string_lossy().ends_with(id))).collect())
        .unwrap_or_default();
    match hits.as_slice() {
        [one] => {
            let (m, b) = read_one(one).ok_or_else(|| missing("No such finding."))?;
            Ok((one.clone(), m, b))
        }
        [] => Err(missing("No such finding.")),
        _ => Err(bad("More than one finding ends so: give more of its id.")),
    }
}

/// Writes a new finding; `context` is what the window says was on screen (any JSON object), kept as it is.
pub fn add(root: &Path, text: &str, context: Option<Value>) -> Result<Value> {
    guard(root)?;
    let text = text.trim();
    if text.is_empty() {
        return Err(bad("A finding needs some words."));
    }
    if context.as_ref().is_some_and(|c| !c.is_object()) {
        return Err(bad("The context must be a JSON object."));
    }
    let id = new_id("f");
    let t = now();
    let mut meta = Rec::new();
    meta.insert("id".into(), json!(id));
    meta.insert("kind".into(), json!("finding"));
    meta.insert("status".into(), json!("open"));
    meta.insert("created".into(), json!(t));
    meta.insert("updated".into(), json!(t));
    if let Some(c) = context {
        meta.insert("context".into(), c);
    }
    write_atomic(&dir(root).join(format!("{id}.md")), &dump_md(&meta, text))?;
    Ok(public(root, &meta, text))
}

/// Handled (done with in the app), or open again.
pub fn set_status(root: &Path, id: &str, handled: bool) -> Result<Value> {
    guard(root)?;
    let (p, mut meta, body) = find(root, id)?;
    meta.insert("status".into(), json!(if handled { "handled" } else { "open" }));
    meta.insert("updated".into(), json!(now()));
    write_atomic(&p, &dump_md(&meta, &body))?;
    Ok(public(root, &meta, &body))
}

/// A finding's words changed; what was on screen stays.
pub fn edit(root: &Path, id: &str, text: &str) -> Result<Value> {
    guard(root)?;
    let text = text.trim();
    if text.is_empty() {
        return Err(bad("A finding needs some words (to remove it: wb finding rm)."));
    }
    let (p, mut meta, _) = find(root, id)?;
    meta.insert("updated".into(), json!(now()));
    write_atomic(&p, &dump_md(&meta, text))?;
    Ok(public(root, &meta, text))
}

/// Deleted: the file goes to `.trash/` (nothing is erased).
pub fn remove(root: &Path, id: &str) -> Result<Value> {
    guard(root)?;
    let (p, meta, _) = find(root, id)?;
    let dest = root.join(".trash").join(format!("{}-finding-{}.md", chrono::Utc::now().format("%Y%m%d-%H%M%S"), s(&meta, "id")));
    fs::create_dir_all(dest.parent().unwrap())?;
    fs::rename(&p, &dest)?;
    // its attached files go to .trash as well, one by one (nothing is erased)
    let id = s(&meta, "id");
    for f in files_of(root, &id) {
        trash_attachment(root, &id, f["name"].as_str().unwrap_or_default())?;
    }
    let _ = fs::remove_dir(files_dir(root, &id));
    Ok(json!({"ok": true, "id": meta.get("id")}))
}

/// One finding with everything kept for it: its words, what was on screen, and its attached files with their paths.
pub fn show(root: &Path, id: &str) -> Result<Value> {
    let (_, meta, body) = find(root, id)?;
    Ok(public(root, &meta, &body))
}

/// A name that is safe as a file name on any system: no folders, no characters Windows refuses, no reserved device names.
fn clean_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("");
    let mut out: String = base.chars().map(|c| if c.is_control() || "<>:\"|?*".contains(c) { '_' } else { c }).collect();
    out = out.trim().trim_end_matches(['.', ' ']).trim_start_matches('.').trim().to_string();
    if out.is_empty() {
        out = "file".into();
    }
    if out.chars().count() > 120 {
        let ext = match out.rfind('.') {
            Some(i) if out.len() - i <= 12 => out[i..].to_string(),
            _ => String::new(),
        };
        let stem: String = out[..out.len() - ext.len()].chars().take(120 - ext.chars().count()).collect();
        out = format!("{}{ext}", stem.trim_end());
    }
    let stem = out.split('.').next().unwrap_or("").trim().to_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && stem.ends_with(|c: char| c.is_ascii_digit()));
    if reserved { format!("_{out}") } else { out }
}

/// `name`, or `name (2).ext`, `name (3).ext` … when the finding already holds a file of that name.
fn free_name(folder: &Path, name: &str) -> String {
    let taken = |n: &str| folder.join(n).exists() || folder.join(format!("{n}.tmp")).exists();
    if !taken(name) {
        return name.to_string();
    }
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    (2..).map(|n| format!("{stem} ({n}){ext}")).find(|c| !taken(c)).unwrap()
}

fn too_big(name: &str, size: u64) -> crate::Error {
    bad(format!("{name} is over the limit ({size} bytes): a finding's file can be {} MB at most.", MAX_ATTACH_BYTES / 1_048_576))
}

/// Writes into `findings/<id>/` under a free name, through a `.tmp` file so a half-written file is never listed.
fn put(root: &Path, id: &str, name: &str, write: impl FnOnce(&Path) -> std::io::Result<()>) -> Result<String> {
    let folder = files_dir(root, id);
    fs::create_dir_all(&folder)?;
    let name = free_name(&folder, &clean_name(name));
    let tmp = folder.join(format!("{name}.tmp"));
    if let Err(e) = write(&tmp) {
        let _ = fs::remove_file(&tmp);
        return Err(e.into());
    }
    fs::rename(&tmp, folder.join(&name))?;
    Ok(name)
}

/// Attaches a file by its path: copied into `findings/<id>/`, never moved (the person's file stays where it is).
pub fn attach(root: &Path, id: &str, from: &Path) -> Result<Value> {
    guard(root)?;
    let (_, meta, _) = find(root, id)?;
    let id = s(&meta, "id");
    let md = fs::metadata(from).map_err(|_| missing(format!("No file at {}.", from.display())))?;
    if !md.is_file() {
        return Err(bad(format!("{} is a folder; attach the files in it one by one.", from.display())));
    }
    let shown = from.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    if md.len() > MAX_ATTACH_BYTES {
        return Err(too_big(&shown, md.len()));
    }
    let name = put(root, &id, &shown, |tmp| fs::copy(from, tmp).map(|_| ()))?;
    Ok(json!({"ok": true, "name": name, "size": md.len(), "finding": show(root, &id)?}))
}

/// Attaches bytes the window holds (a dropped or pasted file, which has no path there): the same folder, the same cap.
pub fn attach_bytes(root: &Path, id: &str, name: &str, bytes: &[u8]) -> Result<Value> {
    guard(root)?;
    let (_, meta, _) = find(root, id)?;
    let id = s(&meta, "id");
    if bytes.len() as u64 > MAX_ATTACH_BYTES {
        return Err(too_big(&clean_name(name), bytes.len() as u64));
    }
    let name = put(root, &id, name, |tmp| fs::write(tmp, bytes))?;
    Ok(json!({"ok": true, "name": name, "size": bytes.len(), "finding": show(root, &id)?}))
}

fn trash_attachment(root: &Path, id: &str, name: &str) -> Result<()> {
    let from = files_dir(root, id).join(name);
    let dest = root.join(".trash").join(format!("{}-finding-{id}-{name}", chrono::Utc::now().format("%Y%m%d-%H%M%S")));
    fs::create_dir_all(dest.parent().unwrap())?;
    fs::rename(&from, &dest)?;
    Ok(())
}

/// The attached file called `name` (or the only one whose name starts so), or why not.
fn attached_name(root: &Path, id: &str, name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(bad("Name an attached file (wb finding show lists them)."));
    }
    let names: Vec<String> = files_of(root, id).iter().filter_map(|f| f["name"].as_str().map(String::from)).collect();
    if let Some(n) = names.iter().find(|n| n.as_str() == name) {
        return Ok(n.clone());
    }
    let lower = name.to_lowercase();
    let hits: Vec<&String> = names.iter().filter(|n| n.to_lowercase().starts_with(&lower)).collect();
    match hits.as_slice() {
        [one] => Ok((*one).clone()),
        [] => Err(missing(format!("No file called {name} is attached to this finding."))),
        _ => Err(bad("More than one attached file starts so: give more of its name.")),
    }
}

/// Takes one attached file off the finding (it goes to `.trash/`, as every delete does).
pub fn detach(root: &Path, id: &str, name: &str) -> Result<Value> {
    guard(root)?;
    let (_, meta, _) = find(root, id)?;
    let id = s(&meta, "id");
    let name = attached_name(root, &id, name)?;
    trash_attachment(root, &id, &name)?;
    let _ = fs::remove_dir(files_dir(root, &id));
    Ok(json!({"ok": true, "removed": name, "finding": show(root, &id)?}))
}

/// Programs and scripts: shown in their folder rather than run by opening them.
fn runs_code(name: &str) -> bool {
    let Some((_, ext)) = name.rsplit_once('.') else { return false };
    ["exe", "com", "bat", "cmd", "scr", "pif", "msi", "msp", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "lnk",
        "url", "reg", "dll", "jar", "cpl", "gadget", "sh", "command", "app", "appimage", "application", "settingcontent-ms"]
        .contains(&ext.to_lowercase().as_str())
}

/// An attached file's full name and path.
fn attachment(root: &Path, id: &str, name: &str) -> Result<(String, PathBuf)> {
    let (_, meta, _) = find(root, id)?;
    let id = s(&meta, "id");
    let name = attached_name(root, &id, name)?;
    let path = files_dir(root, &id).join(&name);
    Ok((name, path))
}

/// Opens an attached file in the program the computer opens it with (a picture viewer, a PDF reader). A program or a
/// script is shown in its folder instead, never run from here. With `WB_NO_OPEN=1` (the tests and desk checks) nothing is
/// opened: the answer still names the file.
pub fn open_attachment(root: &Path, id: &str, name: &str) -> Result<Value> {
    let (name, path) = attachment(root, id, name)?;
    if runs_code(&name) {
        let spawned = if cfg!(windows) {
            std::process::Command::new("explorer.exe").arg(format!("/select,{}", path.display())).spawn()
        } else if cfg!(target_os = "macos") {
            std::process::Command::new("open").arg("-R").arg(&path).spawn()
        } else {
            std::process::Command::new("xdg-open").arg(path.parent().unwrap()).spawn()
        };
        spawned.map_err(|e| bad(format!("Could not show {} ({e}).", path.display())))?;
        return Ok(json!({"ok": true, "name": name, "path": path.to_string_lossy(), "shown_in_folder": true}));
    }
    if std::env::var("WB_NO_OPEN").as_deref() != Ok("1") {
        crate::docs::open_file(&path)?;
    }
    Ok(json!({"ok": true, "name": name, "path": path.to_string_lossy(), "shown_in_folder": false}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_safe_and_free() {
        assert_eq!(clean_name("C:\\Users\\x\\shot.png"), "shot.png");
        assert_eq!(clean_name("a/b/../c:d?.pdf"), "c_d_.pdf");
        assert_eq!(clean_name("..hidden"), "hidden");
        assert_eq!(clean_name("  . "), "file");
        assert_eq!(clean_name("con.txt"), "_con.txt");
        assert_eq!(clean_name("COM1"), "_COM1");
        assert_eq!(clean_name("COMMON.txt"), "COMMON.txt");
        let long = format!("{}.png", "x".repeat(300));
        assert!(clean_name(&long).ends_with(".png") && clean_name(&long).chars().count() == 120);
        assert!(runs_code("a.EXE") && runs_code("x.ps1") && !runs_code("a.png") && !runs_code("pdf"));
        let d = std::env::temp_dir().join("bible-workbench-rs").join(format!("free-name-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("a.png"), b"1").unwrap();
        fs::write(d.join("a (2).png"), b"1").unwrap();
        assert_eq!(free_name(&d, "a.png"), "a (3).png");
        assert_eq!(free_name(&d, "b.png"), "b.png");
        fs::remove_dir_all(&d).unwrap();
    }
}
