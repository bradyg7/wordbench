//! Durable, fail-closed page deletion. Legacy Trash is deliberately outside this service.
use crate::{
    bible::Bible,
    store::{bad, Store},
    Result,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    cell::RefCell,
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
};

thread_local! { static HELD: RefCell<Vec<PathBuf>> = const { RefCell::new(Vec::new()) }; }
pub struct WriterLock {
    root: PathBuf,
    file: Option<File>,
}
impl Drop for WriterLock {
    fn drop(&mut self) {
        if self.file.is_some() {
            HELD.with(|h| h.borrow_mut().retain(|r| r != &self.root));
        }
    }
}
/// OS lock releases on process termination. Reentrant only on this thread.
pub fn writer_lock(root: &Path) -> Result<WriterLock> {
    crate::store::guard(root)?;
    let root = fs::canonicalize(root)?;
    if HELD.with(|h| h.borrow().contains(&root)) {
        return Ok(WriterLock { root, file: None });
    }
    let trash = checked(&root, ".trash", false)?;
    fs::create_dir_all(trash)?;
    let p = checked(&root, ".trash/.wb-writer.lock", false)?;
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(p)?;
    file.try_lock().map_err(|_| {
        bad("The study folder is being changed by another client. Retry when it finishes.")
    })?;
    HELD.with(|h| h.borrow_mut().push(root.clone()));
    Ok(WriterLock {
        root,
        file: Some(file),
    })
}

fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
fn checked(root: &Path, relative: &str, page: bool) -> Result<PathBuf> {
    let rel = Path::new(relative);
    if rel.components().any(|c| !matches!(c, Component::Normal(_)))
        || relative.contains(':')
        || relative.contains('\\')
    {
        return Err(bad("Unsafe deletion path; recovery data retained."));
    }
    if page
        && (!(relative.starts_with("notes/") || relative.starts_with("trails/"))
            || !relative.ends_with(".md"))
    {
        return Err(bad("Deletion paths must be ordinary page files."));
    }
    let mut p = root.to_path_buf();
    for part in rel.components() {
        p.push(part);
        match fs::symlink_metadata(&p) {
            Ok(m) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if m.file_attributes() & 0x400 != 0 {
                        return Err(bad(
                            "A deletion path is a link or junction; recovery data retained.",
                        ));
                    }
                }
                if m.file_type().is_symlink() {
                    return Err(bad("A deletion path is a link; recovery data retained."));
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
    }
    Ok(p)
}
fn read_optional(path: &Path) -> Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}
fn durable(path: &Path, text: &str) -> Result<()> {
    let tmp = path.with_extension(format!("{}.tmp", crate::store::new_id("write")));
    let mut f = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
    f.write_all(text.as_bytes())?;
    f.sync_all()?;
    drop(f);
    fs::rename(&tmp, path)?;
    #[cfg(unix)]
    File::open(path.parent().unwrap())?.sync_all()?;
    Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Change {
    id: String,
    path: String,
    before: String,
    after: Option<String>,
    before_hash: String,
    after_hash: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Journal {
    version: u32,
    id: String,
    state: String,
    deadline_ms: Option<i64>,
    source: String,
    changes: Vec<Change>,
    deleted: Vec<String>,
    retained: Vec<String>,
}
#[derive(Default)]
pub struct Selection {
    pub ids: Vec<String>,
    pub all: bool,
    pub pinned: bool,
    pub templates: bool,
    pub days: bool,
}
pub struct Plan {
    journal: Journal,
    token: String,
    dependencies: String,
    batch: bool,
}
impl Plan {
    pub fn preview(&self) -> Value {
        json!({"state":"preview", "scope":"ordinary Pages tree", "deleted":self.journal.deleted, "retained_moved":self.journal.retained, "count":self.journal.deleted.len(), "moved":self.journal.retained.len(), "threads_excluded":true, "token":self.token})
    }
}
fn edit_fields(text: &str, parent: Option<&str>, order: usize) -> Result<String> {
    let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let fence = format!("---{newline}");
    let rest = text
        .strip_prefix(&fence)
        .ok_or_else(|| bad("Cannot safely change malformed page front matter."))?;
    let end = rest
        .find(&format!("{newline}---{newline}"))
        .ok_or_else(|| bad("Cannot safely change malformed page front matter."))?;
    let mut lines: Vec<String> = rest[..end]
        .split(newline)
        .filter(|l| !l.starts_with("parent: ") && !l.starts_with("order: "))
        .map(String::from)
        .collect();
    if let Some(p) = parent {
        lines.push(format!(
            "parent: {}",
            serde_json::to_string(p).map_err(|e| bad(e.to_string()))?
        ));
    }
    lines.push(format!("order: {order}"));
    Ok(format!("{fence}{}{}", lines.join(newline), &rest[end..]))
}
fn fingerprint(root: &Path) -> Result<String> {
    fn visit(root: &Path, rel: &str, rows: &mut Vec<(String, String)>) -> Result<()> {
        let path = checked(root, rel, false)?;
        if !path.exists() {
            return Ok(());
        }
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let child = format!("{rel}/{}", entry.file_name().to_string_lossy());
            let safe = checked(root, &child, false)?;
            if entry.file_type()?.is_dir() {
                visit(root, &child, rows)?;
            } else if child.ends_with(".md") {
                rows.push((child, hash(&fs::read(safe)?)));
            }
        }
        Ok(())
    }
    let mut rows = vec![];
    visit(root, "notes", &mut rows)?;
    visit(root, "trails", &mut rows)?;
    rows.sort();
    Ok(hash(
        &serde_json::to_vec(&rows).map_err(|e| bad(e.to_string()))?,
    ))
}
pub fn plan(bible: &Bible, store: &mut Store, selection: &Selection) -> Result<Plan> {
    let _lock = writer_lock(&store.root)?;
    let dependencies = fingerprint(&store.root)?;
    store.look_again();
    store.refresh()?;
    let (ids, fields) = crate::pages::deletion_layout(
        bible,
        store,
        &selection.ids.iter().cloned().collect(),
        selection.all,
        selection.pinned,
        selection.templates,
        selection.days,
    )?;
    if ids.is_empty() {
        return Err(bad("No eligible pages selected. Nothing was deleted."));
    }
    let mut changes = vec![];
    let mut retained = vec![];
    for (id, next) in ids
        .iter()
        .map(|id| (id.clone(), None))
        .chain(fields.into_iter().map(|(id, p, n)| (id, Some((p, n)))))
    {
        if changes.iter().any(|c: &Change| c.id == id) {
            continue;
        }
        let (meta, path) = store.any_note(&id)?;
        let rel = path
            .strip_prefix(&store.root)
            .map_err(|_| bad("Page is outside the study folder."))?
            .to_string_lossy()
            .replace('\\', "/");
        let path = checked(&store.root, &rel, true)?;
        let before = fs::read_to_string(path)?;
        let after = match next {
            None => None,
            Some((parent, order)) => {
                if meta.get("parent").and_then(Value::as_str) != parent.as_deref() {
                    retained.push(id.clone());
                }
                Some(edit_fields(&before, parent.as_deref(), order)?)
            }
        };
        if after.as_ref() == Some(&before) {
            continue;
        }
        changes.push(Change {
            id,
            path: rel,
            before_hash: hash(before.as_bytes()),
            after_hash: after.as_ref().map(|s| hash(s.as_bytes())),
            before,
            after,
        });
    }
    changes.sort_by(|a, b| a.path.cmp(&b.path));
    retained.sort();
    let token =
        hash(&serde_json::to_vec(&(&changes, &dependencies)).map_err(|e| bad(e.to_string()))?);
    Ok(Plan {
        journal: Journal {
            version: 1,
            id: String::new(),
            state: "preparing".into(),
            deadline_ms: None,
            source: "page deletion".into(),
            changes,
            deleted: ids,
            retained,
        },
        token,
        dependencies,
        batch: selection.all,
    })
}
fn directory(root: &Path, id: &str) -> Result<PathBuf> {
    if !id.starts_with("delete_") || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_') {
        return Err(bad("Invalid deletion operation ID."));
    }
    checked(root, &format!(".trash/page-operations/{id}"), false)
}
fn save(root: &Path, j: &Journal) -> Result<()> {
    let dir = directory(root, &j.id)?;
    durable(
        &dir.join("journal.json"),
        &serde_json::to_string(j).map_err(|e| bad(e.to_string()))?,
    )
}
fn validate(root: &Path, j: &Journal, id: &str) -> Result<()> {
    if j.version != 1 || j.id != id || j.changes.is_empty() || j.deleted.is_empty() {
        return Err(bad(
            "Unknown or incomplete deletion journal; retained for recovery.",
        ));
    }
    if j.deleted.iter().collect::<HashSet<_>>().len() != j.deleted.len()
        || j.changes
            .iter()
            .filter(|c| c.after.is_none())
            .map(|c| &c.id)
            .collect::<HashSet<_>>()
            != j.deleted.iter().collect::<HashSet<_>>()
    {
        return Err(bad(
            "Inconsistent deletion manifest; recovery data retained.",
        ));
    }
    let mut paths = HashSet::new();
    for c in &j.changes {
        checked(root, &c.path, true)?;
        if !paths.insert(&c.path)
            || hash(c.before.as_bytes()) != c.before_hash
            || c.after.as_ref().map(|s| hash(s.as_bytes())) != c.after_hash
        {
            return Err(bad("Corrupt deletion snapshot; retained for recovery."));
        }
    }
    if !matches!(
        j.state.as_str(),
        "preparing" | "pending" | "restoring" | "restored" | "erasing"
    ) {
        return Err(bad("Unknown deletion state; retained for recovery."));
    }
    if matches!(j.state.as_str(), "pending" | "erasing") && j.deadline_ms.is_none() {
        return Err(bad("Missing deletion deadline; retained for recovery."));
    }
    Ok(())
}
fn load(root: &Path, id: &str) -> Result<Journal> {
    let dir = directory(root, id)?;
    checked(
        root,
        &format!(".trash/page-operations/{id}/journal.json"),
        false,
    )?;
    let j: Journal = serde_json::from_str(&fs::read_to_string(dir.join("journal.json"))?)
        .map_err(|e| bad(format!("Unreadable deletion journal; retained: {e}")))?;
    validate(root, &j, id)?;
    Ok(j)
}
fn response(j: &Journal) -> Value {
    json!({"ok":true,"operation":j.id,"state":j.state,"deadline_ms":j.deadline_ms,"deleted":j.deleted,"retained_moved":j.retained,"count":j.deleted.len(),"moved":j.retained.len(),"undo":format!("wb page undo {}",j.id)})
}
fn apply(root: &Path, c: &Change, restore: bool) -> Result<()> {
    let path = checked(root, &c.path, true)?;
    let current = read_optional(&path)?;
    let (expected, wanted) = if restore {
        (c.after.clone(), Some(c.before.clone()))
    } else {
        (Some(c.before.clone()), c.after.clone())
    };
    if current == wanted {
        return Ok(());
    }
    if current != expected {
        return Err(bad(format!(
            "Deletion conflict at {}. Recovery snapshot retained; no later edits were overwritten.",
            c.path
        )));
    }
    match wanted {
        Some(text) => {
            if let Some(p) = path.parent() {
                fs::create_dir_all(p)?;
            }
            durable(&path, &text)?;
        }
        None => fs::remove_file(path)?,
    }
    Ok(())
}
fn restore(root: &Path, j: &mut Journal) -> Result<()> {
    // Check the complete operation before changing any file.
    for c in &j.changes {
        let cur = read_optional(&checked(root, &c.path, true)?)?;
        if cur.as_ref() != Some(&c.before) && cur != c.after {
            return Err(bad(format!(
                "Undo conflict at {}. Snapshot retained.",
                c.path
            )));
        }
    }
    j.state = "restoring".into();
    save(root, j)?;
    for c in j.changes.iter().rev() {
        apply(root, c, true)?;
    }
    j.state = "restored".into();
    save(root, j)?;
    Ok(())
}
pub fn commit(
    store: &mut Store,
    plan: Plan,
    expected: Option<&str>,
    clock: impl FnOnce() -> i64,
    immediately: bool,
) -> Result<Value> {
    let _lock = writer_lock(&store.root)?;
    if expected.is_some_and(|e| e != plan.token) {
        return Err(bad(
            "The deletion preview changed. Preview again before deleting.",
        ));
    }
    if fingerprint(&store.root)? != plan.dependencies {
        return Err(bad(
            "The page tree changed since the preview. Preview again before deleting.",
        ));
    }
    let mut j = plan.journal;
    for c in &j.changes {
        if read_optional(&checked(&store.root, &c.path, true)?)?.as_ref() != Some(&c.before) {
            return Err(bad(
                "A page changed since the preview. Preview again before deleting.",
            ));
        }
    }
    // Never overlap the recoverable files of an earlier operation.
    for old in journals(&store.root)? {
        let old = load(&store.root, &old)?;
        if old
            .changes
            .iter()
            .any(|a| j.changes.iter().any(|b| a.path == b.path))
        {
            return Err(bad("An earlier deletion still owns an affected page. Undo or finish that operation first."));
        }
    }
    let base = checked(&store.root, ".trash/page-operations", false)?;
    fs::create_dir_all(base)?;
    loop {
        j.id = crate::store::new_id("delete");
        match fs::create_dir(directory(&store.root, &j.id)?) {
            Ok(()) => break,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.into()),
        }
    }
    save(&store.root, &j)?;
    for c in &j.changes {
        if let Err(err) = apply(&store.root, c, false) {
            let rollback = restore(&store.root, &mut j);
            store.look_again();
            store.refresh()?;
            return Err(bad(format!(
                "Deletion did not complete: {err}. Recovery: {}",
                if rollback.is_ok() {
                    "restored original files".into()
                } else {
                    format!("{}; use wb page undo {}", rollback.unwrap_err(), j.id)
                }
            )));
        }
    }
    let now_ms = clock();
    j.deadline_ms = Some(now_ms.saturating_add(if immediately {
        0
    } else if plan.batch || j.deleted.len() > 1 || !j.retained.is_empty() {
        30_000
    } else {
        10_000
    }));
    j.state = "pending".into();
    save(&store.root, &j)?;
    store.look_again();
    store.refresh()?;
    if immediately {
        erase(&store.root, &mut j, now_ms)?;
    }
    Ok(response(&j))
}
fn erase(root: &Path, j: &mut Journal, now_ms: i64) -> Result<()> {
    if j.state != "erasing" {
        if j.state != "pending" || j.deadline_ms.is_none_or(|d| now_ms < d) {
            return Err(bad("This deletion is not ready to erase."));
        }
        // Ambiguous live state is never permission to erase a recovery copy.
        for c in &j.changes {
            if read_optional(&checked(root, &c.path, true)?)? != c.after {
                return Err(bad(format!(
                    "Deletion cleanup conflict at {}; snapshot retained.",
                    c.path
                )));
            }
        }
        j.state = "erasing".into();
        save(root, j)?;
    }
    for c in &j.changes {
        if read_optional(&checked(root, &c.path, true)?)? != c.after {
            return Err(bad(format!(
                "Deletion cleanup conflict at {}; snapshot retained.",
                c.path
            )));
        }
    }
    discard_snapshot(root, &j.id)?;
    j.state = "erased".into();
    Ok(())
}
fn discard_snapshot(root: &Path, id: &str) -> Result<()> {
    let dir = directory(root, id)?;
    // Refuse unexplained files, including interrupted temporary writes.
    if fs::read_dir(&dir)?
        .collect::<std::io::Result<Vec<_>>>()?
        .iter()
        .any(|e| e.file_name() != "journal.json")
    {
        return Err(bad(
            "Deletion cleanup incomplete: unexpected operation files retained.",
        ));
    }
    fs::remove_file(dir.join("journal.json"))?;
    // Once the snapshot is gone, an empty directory does not represent a recoverable operation.
    let _ = fs::remove_dir(dir);
    Ok(())
}
fn journals(root: &Path) -> Result<Vec<String>> {
    let base = checked(root, ".trash/page-operations", false)?;
    let entries = match fs::read_dir(base) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.into()),
    };
    let mut ids = vec![];
    for e in entries {
        let e = e?;
        let id = e.file_name().to_string_lossy().to_string();
        directory(root, &id)?;
        if !e.file_type()?.is_dir() {
            return Err(bad("Unknown deletion storage entry; retained."));
        }
        if fs::read_dir(e.path())?.next().is_some() {
            ids.push(id);
        }
    }
    ids.sort();
    Ok(ids)
}
pub fn undo(store: &mut Store, id: &str, now_ms: i64) -> Result<Value> {
    let _lock = writer_lock(&store.root)?;
    let mut j = load(&store.root, id)?;
    if j.state == "erasing" {
        return Err(bad(
            "Erasure has started; Undo cannot restore this operation.",
        ));
    }
    if j.state == "pending" && j.deadline_ms.is_some_and(|d| now_ms >= d) {
        return Err(bad("The Undo deadline has passed."));
    }
    restore(&store.root, &mut j)?;
    store.look_again();
    store.refresh()?;
    let mut result = response(&j);
    if let Err(error) = discard_snapshot(&store.root, &j.id) {
        result["cleanup_error"] = json!(error.to_string());
    }
    Ok(result)
}
/// Recovery always precedes expiry. Each error is reported and its snapshots are retained.
pub fn sweep(store: &mut Store, now_ms: i64) -> Result<Value> {
    let _lock = writer_lock(&store.root)?;
    let mut operations = vec![];
    let mut errors = vec![];
    for id in journals(&store.root)? {
        let result = (|| -> Result<Value> {
            let mut j = load(&store.root, &id)?;
            if matches!(j.state.as_str(), "preparing" | "restoring") {
                restore(&store.root, &mut j)?;
            }
            if j.state == "restored" {
                discard_snapshot(&store.root, &j.id)?;
            }
            if j.state == "erasing"
                || (j.state == "pending" && j.deadline_ms.is_some_and(|d| now_ms >= d))
            {
                erase(&store.root, &mut j, now_ms)?;
            }
            Ok(response(&j))
        })();
        match result {
            Ok(v) => operations.push(v),
            Err(e) => errors.push(json!({"operation":id,"error":e.to_string()})),
        }
    }
    if operations.iter().any(|op| op["state"] == "restored") || !errors.is_empty() {
        store.look_again();
        store.refresh()?;
    }
    Ok(json!({"operations":operations,"errors":errors}))
}
pub fn inspect(store: &Store) -> Result<Value> {
    let _lock = writer_lock(&store.root)?;
    let mut rows = vec![];
    for id in journals(&store.root)? {
        rows.push(match load(&store.root, &id) {
            Ok(j) => response(&j),
            Err(e) => json!({"operation":id,"state":"conflicted","error":e.to_string()}),
        });
    }
    Ok(json!({"operations":rows}))
}
pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
pub fn remove(bible: &Bible, store: &mut Store, id: &str) -> Result<Value> {
    let _lock = writer_lock(&store.root)?;
    let plan = plan(
        bible,
        store,
        &Selection {
            ids: vec![id.into()],
            ..Default::default()
        },
    )?;
    commit(store, plan, None, now_ms, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Scratch(PathBuf);
    impl Scratch {
        fn new() -> Self {
            let p = std::env::temp_dir().join(format!("wb-h04-{}", crate::store::new_id("test")));
            fs::create_dir_all(p.join("notes/_inbox")).unwrap();
            Self(p)
        }
        fn store(&self) -> Store {
            Store::open(&self.0).unwrap()
        }
        fn page(&self, id: &str, text: &str) {
            fs::write(self.0.join(format!("notes/_inbox/{id}.md")), text).unwrap();
        }
        fn get(&self, id: &str) -> String {
            fs::read_to_string(self.0.join(format!("notes/_inbox/{id}.md"))).unwrap()
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn prepared(s: &Scratch, ids: &[&str], survivors: &[(&str, &str)]) -> Plan {
        let changes = ids
            .iter()
            .map(|id| (*id, None))
            .chain(
                survivors
                    .iter()
                    .map(|(id, after)| (*id, Some(after.to_string()))),
            )
            .map(|(id, after)| {
                let before = s.get(id);
                Change {
                    id: id.into(),
                    path: format!("notes/_inbox/{id}.md"),
                    before_hash: hash(before.as_bytes()),
                    after_hash: after.as_ref().map(|s| hash(s.as_bytes())),
                    before,
                    after,
                }
            })
            .collect();
        Plan {
            journal: Journal {
                version: 1,
                id: String::new(),
                state: "preparing".into(),
                deadline_ms: None,
                source: "test".into(),
                changes,
                deleted: ids.iter().map(|s| s.to_string()).collect(),
                retained: survivors.iter().map(|(id, _)| id.to_string()).collect(),
            },
            token: "preview".into(),
            dependencies: fingerprint(&s.0).unwrap(),
            batch: false,
        }
    }
    fn op(v: &Value) -> &str {
        v["operation"].as_str().unwrap()
    }
    #[test]
    fn exact_bytes_deadlines_and_restart() {
        let s = Scratch::new();
        let bytes="---\r\nid: \"n_original\"\r\nunknown: {\"a\": 1}\r\npinned: 2\r\n---\r\n\r\nOriginal text\r\n";
        s.page("n_original", bytes);
        let v = commit(
            &mut s.store(),
            prepared(&s, &["n_original"], &[]),
            None,
            || 1000,
            false,
        )
        .unwrap();
        assert_eq!(v["deadline_ms"], 11000);
        assert!(!s.0.join("notes/_inbox/n_original.md").exists());
        let before = sweep(&mut s.store(), 10999).unwrap();
        assert_eq!(before["operations"][0]["deadline_ms"], 11000);
        undo(&mut s.store(), op(&v), 10999).unwrap();
        assert_eq!(s.get("n_original"), bytes);
    }
    #[test]
    fn hierarchy_and_batch_restore_as_one() {
        let s = Scratch::new();
        s.page("n_parent", "parent bytes");
        s.page("n_child", "original child bytes");
        s.page("n_other", "other bytes");
        let v = commit(
            &mut s.store(),
            prepared(
                &s,
                &["n_parent", "n_other"],
                &[("n_child", "promoted child")],
            ),
            None,
            || 500,
            false,
        )
        .unwrap();
        assert_eq!(v["deadline_ms"], 30500);
        assert_eq!(s.get("n_child"), "promoted child");
        undo(&mut s.store(), op(&v), 30499).unwrap();
        assert_eq!(s.get("n_parent"), "parent bytes");
        assert_eq!(s.get("n_child"), "original child bytes");
        assert_eq!(s.get("n_other"), "other bytes");
    }
    #[test]
    fn batch_with_one_leaf_uses_the_batch_deadline() {
        let s = Scratch::new();
        s.page("n_a", "original");
        let mut plan = prepared(&s, &["n_a"], &[]);
        plan.batch = true;
        let result = commit(&mut s.store(), plan, None, || 0, false).unwrap();
        assert_eq!(result["deadline_ms"], 30000);
    }
    #[test]
    fn failed_snapshot_cleanup_blocks_another_deletion_of_that_page() {
        let s = Scratch::new();
        s.page("n_a", "original");
        let first = commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[]),
            None,
            || 0,
            false,
        )
        .unwrap();
        let extra = directory(&s.0, op(&first)).unwrap().join("unexplained.tmp");
        fs::write(&extra, "unexpected").unwrap();
        let restored = undo(&mut s.store(), op(&first), 1).unwrap();
        assert!(restored["cleanup_error"].is_string());
        assert_eq!(s.get("n_a"), "original");
        assert!(commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[]),
            None,
            || 2,
            false
        )
        .is_err());
        fs::remove_file(extra).unwrap();
        assert_eq!(
            sweep(&mut s.store(), 3).unwrap()["operations"][0]["state"],
            "restored"
        );
        assert!(commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[]),
            None,
            || 4,
            false
        )
        .is_ok());
    }
    #[test]
    fn expiry_at_boundary_preserves_legacy_and_removes_snapshots() {
        let s = Scratch::new();
        s.page("n_a", "private bytes");
        fs::create_dir_all(s.0.join(".trash")).unwrap();
        fs::write(s.0.join(".trash/20000101-000000-n_old.md"), "legacy").unwrap();
        let v = commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[]),
            None,
            || 0,
            false,
        )
        .unwrap();
        assert!(undo(&mut s.store(), op(&v), 10000).is_err());
        let out = sweep(&mut s.store(), 10000).unwrap();
        assert_eq!(out["operations"][0]["state"], "erased");
        assert!(!directory(&s.0, op(&v)).unwrap().exists());
        assert!(s.0.join(".trash/20000101-000000-n_old.md").exists());
    }
    #[test]
    fn restore_collision_and_changed_survivor_never_overwrite_or_erase() {
        let s = Scratch::new();
        s.page("n_a", "deleted");
        s.page("n_b", "before");
        let v = commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[("n_b", "after")]),
            None,
            || 0,
            false,
        )
        .unwrap();
        s.page("n_a", "new occupant");
        assert!(undo(&mut s.store(), op(&v), 1).is_err());
        assert_eq!(s.get("n_a"), "new occupant");
        assert_eq!(s.get("n_b"), "after");
        let out = sweep(&mut s.store(), 30000).unwrap();
        assert_eq!(out["errors"].as_array().unwrap().len(), 1);
        assert!(load(&s.0, op(&v)).is_ok());
    }
    #[test]
    fn crash_at_each_forward_and_reverse_file_transition_recovers() {
        for changed in 0..=3 {
            for state in ["preparing", "restoring"] {
                let s = Scratch::new();
                for id in ["n_a", "n_b", "n_c"] {
                    s.page(id, &format!("original {id}"));
                }
                let mut j = prepared(&s, &["n_a", "n_b"], &[("n_c", "after")]).journal;
                j.id = crate::store::new_id("delete");
                j.state = state.into();
                fs::create_dir_all(directory(&s.0, &j.id).unwrap()).unwrap();
                save(&s.0, &j).unwrap();
                for c in j.changes.iter().take(changed) {
                    apply(&s.0, c, false).unwrap();
                }
                let result = sweep(&mut s.store(), i64::MAX).unwrap();
                assert_eq!(result["operations"][0]["state"], "restored");
                for id in ["n_a", "n_b", "n_c"] {
                    assert_eq!(s.get(id), format!("original {id}"));
                }
                assert!(sweep(&mut s.store(), i64::MAX).unwrap()["errors"]
                    .as_array()
                    .unwrap()
                    .is_empty());
            }
        }
    }
    #[test]
    fn corrupt_unknown_and_missing_journals_are_retained() {
        for mode in ["hash", "version", "path", "missing"] {
            let s = Scratch::new();
            s.page("n_a", "content");
            let v = commit(
                &mut s.store(),
                prepared(&s, &["n_a"], &[]),
                None,
                || 0,
                false,
            )
            .unwrap();
            let mut j = load(&s.0, op(&v)).unwrap();
            match mode {
                "hash" => j.changes[0].before.push('!'),
                "version" => j.version = 999,
                "path" => j.changes[0].path = "../escape.md".into(),
                _ => {}
            }
            save(&s.0, &j).unwrap();
            if mode == "missing" {
                fs::rename(
                    directory(&s.0, &j.id).unwrap().join("journal.json"),
                    directory(&s.0, &j.id).unwrap().join("saved.json"),
                )
                .unwrap();
            }
            let out = sweep(&mut s.store(), 10000).unwrap();
            assert_eq!(out["errors"].as_array().unwrap().len(), 1);
            assert!(directory(&s.0, &j.id).unwrap().exists());
        }
    }
    #[test]
    fn stale_tree_preview_and_empty_manifest_refused() {
        let s = Scratch::new();
        s.page("n_a", "content");
        let p = prepared(&s, &["n_a"], &[]);
        s.page("n_new", "later child");
        assert!(commit(&mut s.store(), p, None, || 0, false).is_err());
        assert_eq!(s.get("n_a"), "content");
        assert!(commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[]),
            Some("wrong"),
            || 0,
            false
        )
        .is_err());
    }
    #[test]
    fn same_second_operations_are_unique_and_now_is_explicit() {
        let s = Scratch::new();
        s.page("n_a", "a");
        s.page("n_b", "b");
        let a = commit(
            &mut s.store(),
            prepared(&s, &["n_a"], &[]),
            None,
            || 0,
            false,
        )
        .unwrap();
        let b = commit(
            &mut s.store(),
            prepared(&s, &["n_b"], &[]),
            None,
            || 0,
            true,
        )
        .unwrap();
        assert_ne!(a["operation"], b["operation"]);
        assert_eq!(b["state"], "erased");
        assert!(load(&s.0, op(&a)).is_ok());
    }
    #[test]
    fn os_lock_serializes_other_threads_and_reenters_current_thread() {
        let s = Scratch::new();
        let lock = writer_lock(&s.0).unwrap();
        let _nested = writer_lock(&s.0).unwrap();
        let root = s.0.clone();
        assert!(std::thread::spawn(move || writer_lock(&root).is_err())
            .join()
            .unwrap());
        drop(lock);
        assert!(writer_lock(&s.0).is_ok());
    }
}
