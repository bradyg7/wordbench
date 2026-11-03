//! Phase 0 spike (b): git sync of a study folder with the git2 crate (libgit2).
//!
//! Everything happens under %TEMP%\bible-workbench-rs\sync-spike, made fresh each run from the scratch study copy
//! (scripts/scratch-study.ps1); the person's real study folder is never touched. Two "devices" clone one bare remote on
//! disk, edit, commit, push and pull; one round edits different notes (no conflict), the next edits the same note and
//! adds overlapping highlights on both sides, merged by the rules in docs/PLAN.md section 4.
//!
//!     cargo run -p spike-sync --release

mod merge;

use git2::{build::CheckoutBuilder, build::RepoBuilder, IndexAddOption, Oid, PushOptions, RemoteCallbacks, Repository, Signature};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use wb_core::bible::Bible;

type Res<T> = Result<T, Box<dyn std::error::Error>>;

const NOTE: &str = "notes/NUM/n_20261018005737_c1d3.md"; // a verse note on Numbers 25:11 in the scratch copy
const OTHER_NOTE: &str = "notes/NUM/n_20261018005703_8843.md";
const HL: &str = "highlights/NUM.json";

fn main() -> Res<()> {
    let root = std::env::temp_dir().join("bible-workbench-rs").join("sync-spike");
    let scratch = wb_core::default_study_dir();
    wb_core::store::guard(&scratch)?; // refuses the real folder
    if root.exists() {
        fs::remove_dir_all(&root)?;
    }
    fs::create_dir_all(&root)?;
    let bible = Bible::open(&wb_core::default_db_path())?;
    let mut log = Log::default();

    // A bare remote and the first commit, from the scratch copy.
    let remote_path = root.join("remote.git");
    let t = Instant::now();
    Repository::init_bare(&remote_path)?;
    let seed = Repository::init(root.join("seed"))?;
    copy_tree(&scratch, &root.join("seed"))?;
    let c = commit_all(&seed, "Seed from the scratch study folder")?;
    seed.remote("origin", url(&remote_path).as_str())?;
    push(&seed)?;
    log.step("seed: init bare remote, commit the scratch study folder, push", t, format!("commit {}", short(c)));

    // Two devices.
    let t = Instant::now();
    let a = clone(&remote_path, &root.join("device-a"))?;
    let b = clone(&remote_path, &root.join("device-b"))?;
    log.step("clone to device A and device B", t, String::new());

    // Round 1: different notes on each device. Different notes never conflict.
    edit_note(&a, OTHER_NOTE, "Round 1, written on device A.", "2026-11-02T15:00:00Z")?;
    edit_note(&b, NOTE, "Round 1, written on device B.", "2026-11-02T15:00:05Z")?;
    let t = Instant::now();
    commit_all(&a, "A: note")?;
    push(&a)?;
    log.step("A: commit and push", t, String::new());
    commit_all(&b, "B: note")?;
    let t = Instant::now();
    let rejected = push(&b).is_err();
    log.step("B: push before pulling", t, if rejected { "rejected (not a fast-forward), as it should be".into() } else { "accepted?!".into() });
    let t = Instant::now();
    let r = pull(&b, &bible)?;
    log.step("B: pull (fetch + merge)", t, r.summary());
    push(&b)?;
    let t = Instant::now();
    let r = pull(&a, &bible)?;
    log.step("A: pull", t, r.summary());
    assert_same(&a, &b)?;
    log.note("round 1: A and B have the same tree");

    // Round 2: the same note on both devices, and overlapping highlights.
    edit_note(&a, NOTE, "Round 2, device A: the plague was stayed (verse 8).", "2026-11-02T16:00:00Z")?;
    edit_note(&b, NOTE, "Round 2, device B: compare Psalm 106:30.", "2026-11-02T16:00:09Z")?;
    let words = merge::Words::load(&bible, "NUM", &BTreeSet::from([25]))?;
    add_highlight(&a, &words, "h_spike_a", "NUM.25:7.3-25:7.9", "green", "2026-11-02T16:00:01Z")?; // "the son of Eleazar, the son of"
    add_highlight(&b, &words, "h_spike_b", "NUM.25:7.6-25:7.14", "pink", "2026-11-02T16:00:02Z")?; // overlaps A's, made later
    add_highlight(&b, &words, "h_spike_c", "NUM.25:8", "blue", "2026-11-02T16:00:03Z")?;
    commit_all(&a, "A: note and highlight")?;
    push(&a)?;
    commit_all(&b, "B: note and highlights")?;
    let t = Instant::now();
    let r = pull(&b, &bible)?;
    log.step("B: pull with the same note and overlapping highlights", t, r.summary());
    for c in &r.cut {
        log.note(&format!("  no-overlap rule: {c}"));
    }
    let t = Instant::now();
    push(&b)?;
    log.step("B: push the merge", t, String::new());
    let t = Instant::now();
    let r2 = pull(&a, &bible)?;
    log.step("A: pull (fast-forward)", t, r2.summary());
    assert_same(&a, &b)?;
    log.note("round 2: A and B have the same tree");

    let note = fs::read_to_string(root.join("device-a").join(NOTE))?;
    assert!(note.contains(merge::NEEDS_A_LOOK) && note.contains("device A") && note.contains("device B"), "both texts kept");
    let hl: serde_json::Value = serde_json::from_str(&fs::read_to_string(root.join("device-a").join(HL))?)?;
    let spike: Vec<_> = hl["highlights"].as_array().unwrap().iter().filter(|h| h["id"].as_str().unwrap().starts_with("h_spike")).collect();
    let trash = fs::read_dir(root.join("device-b").join(".trash")).map(|d| d.count()).unwrap_or(0);

    println!("{}", log.text());
    println!("--- the merged note ({NOTE}) ---\n{note}");
    println!("--- the spike's highlights after the merge ---");
    for h in &spike {
        println!("{} {:6} {:22} {}", h["id"], h["color"].as_str().unwrap(), h["anchor"].as_str().unwrap(), h["quote"]);
    }
    println!("--- .trash on device B: {trash} file(s) (both sides of every resolved file) ---");
    println!("folders: {}", root.display());
    Ok(())
}

// ---- git ------------------------------------------------------------------------------------------------------------

fn url(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

fn sig() -> Res<Signature<'static>> {
    Ok(Signature::now("Bible Workbench (spike)", "spike@localhost")?)
}

fn clone(remote: &Path, to: &Path) -> Res<Repository> {
    Ok(RepoBuilder::new().branch("main").clone(&url(remote), to)?)
}

fn commit_all(repo: &Repository, msg: &str) -> Res<Oid> {
    let mut index = repo.index()?;
    index.add_all(["*"], IndexAddOption::DEFAULT, None)?;
    index.update_all(["*"], None)?;
    index.write()?;
    let tree = repo.find_tree(index.write_tree()?)?;
    let parents: Vec<_> = repo.head().ok().and_then(|h| h.peel_to_commit().ok()).into_iter().collect();
    let refs: Vec<&git2::Commit> = parents.iter().collect();
    let s = sig()?;
    let oid = repo.commit(Some("HEAD"), &s, &s, msg, &tree, &refs)?;
    if parents.is_empty() {
        // The first commit: name the branch main.
        repo.reference("refs/heads/main", oid, true, "main")?;
        repo.set_head("refs/heads/main")?;
    }
    Ok(oid)
}

fn push(repo: &Repository) -> Res<()> {
    let mut rejected: Option<String> = None;
    {
        let mut cb = RemoteCallbacks::new();
        cb.push_update_reference(|_, status| {
            if let Some(s) = status {
                rejected = Some(s.to_string());
            }
            Ok(())
        });
        let mut opts = PushOptions::new();
        opts.remote_callbacks(cb);
        repo.find_remote("origin")?.push(&["refs/heads/main:refs/heads/main"], Some(&mut opts))?;
    }
    match rejected {
        Some(s) => Err(format!("push rejected: {s}").into()),
        None => Ok(()),
    }
}

#[derive(Default)]
struct Pulled {
    kind: String,
    resolved: Vec<String>,
    cut: Vec<String>,
}

impl Pulled {
    fn summary(&self) -> String {
        if self.resolved.is_empty() {
            self.kind.clone()
        } else {
            format!("{}; resolved by the rules: {}", self.kind, self.resolved.join(", "))
        }
    }
}

/// Fetch, then fast-forward or merge by the study rules, then commit the merge.
fn pull(repo: &Repository, bible: &Bible) -> Res<Pulled> {
    repo.find_remote("origin")?.fetch(&["main"], None, None)?;
    let theirs_ref = repo.find_reference("refs/remotes/origin/main")?;
    let theirs = theirs_ref.peel_to_commit()?;
    let ours = repo.head()?.peel_to_commit()?;
    let annotated = repo.find_annotated_commit(theirs.id())?;
    let (analysis, _) = repo.merge_analysis(&[&annotated])?;
    let mut out = Pulled::default();
    if analysis.is_up_to_date() {
        out.kind = "up to date".into();
        return Ok(out);
    }
    if analysis.is_fast_forward() {
        repo.find_reference("refs/heads/main")?.set_target(theirs.id(), "fast-forward")?;
        repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
        out.kind = "fast-forward".into();
        return Ok(out);
    }
    // A real merge. git's own three-way merge first, then every file changed on BOTH sides goes through our rules,
    // whether git found a conflict in it or not (two edits to one note are both kept, never interleaved by lines).
    let base = repo.find_commit(repo.merge_base(ours.id(), theirs.id())?)?;
    let changed = |from: &git2::Commit, to: &git2::Commit| -> Res<BTreeSet<String>> {
        let diff = repo.diff_tree_to_tree(Some(&from.tree()?), Some(&to.tree()?), None)?;
        Ok(diff.deltas().filter_map(|d| d.new_file().path().or(d.old_file().path()).map(|p| p.to_string_lossy().replace('\\', "/"))).collect())
    };
    let both: Vec<String> = changed(&base, &ours)?.intersection(&changed(&base, &theirs)?).cloned().collect();
    let mut index = repo.merge_commits(&ours, &theirs, None)?;
    let blob = |c: &git2::Commit, p: &str| -> Option<String> {
        let e = c.tree().ok()?.get_path(Path::new(p)).ok()?;
        String::from_utf8(repo.find_blob(e.id()).ok()?.content().to_vec()).ok()
    };
    let workdir = repo.workdir().unwrap().to_path_buf();
    let mut n = 0;
    let mut new_id = || {
        n += 1;
        format!("h_merge_{n}")
    };
    for path in &both {
        let (b, o, t) = (blob(&base, path), blob(&ours, path), blob(&theirs, path));
        let (Some(o), Some(t)) = (o, t) else { continue }; // deleted on a side: git's result stands (spike)
        let merged = if path.starts_with("notes/") && path.ends_with(".md") {
            let (text, look) = merge::merge_note(b.as_deref(), &o, &t);
            out.resolved.push(format!("{path}{}", if look { " (both texts kept, needs a look)" } else { "" }));
            text
        } else if path.starts_with("highlights/") && path.ends_with(".json") {
            let code = Path::new(path).file_stem().unwrap().to_string_lossy().to_string();
            let chapters = merge::chapters_of(&[b.as_deref(), Some(&o), Some(&t)]);
            let words = merge::Words::load(bible, &code, &chapters)?;
            let m = merge::merge_highlights(&words, b.as_deref(), &o, &t, &mut new_id);
            out.resolved.push(format!("{path} (by id, {} cut by the no-overlap rule)", m.cut.len()));
            out.cut.extend(m.cut);
            m.json
        } else {
            out.resolved.push(format!("{path} (this side kept)"));
            o.clone()
        };
        // Nothing is dropped: both sides' versions go to .trash/ on this device.
        let trash = workdir.join(".trash");
        fs::create_dir_all(&trash)?;
        let name = path.replace('/', "_");
        fs::write(trash.join(format!("merge-ours-{name}")), &o)?;
        fs::write(trash.join(format!("merge-theirs-{name}")), &t)?;
        let oid = repo.blob(merged.as_bytes())?;
        let mode = ours.tree()?.get_path(Path::new(path))?.filemode() as u32;
        let _ = index.conflict_remove(Path::new(path));
        index.add(&git2::IndexEntry {
            ctime: git2::IndexTime::new(0, 0),
            mtime: git2::IndexTime::new(0, 0),
            dev: 0,
            ino: 0,
            mode,
            uid: 0,
            gid: 0,
            file_size: merged.len() as u32,
            id: oid,
            flags: path.len().min(0xfff) as u16,
            flags_extended: 0,
            path: path.as_bytes().to_vec(),
        })?;
    }
    if index.has_conflicts() {
        let left: Vec<String> = index.conflicts()?.flatten().filter_map(|c| c.our.map(|e| String::from_utf8_lossy(&e.path).to_string())).collect();
        return Err(format!("conflicts no rule covers: {left:?}").into());
    }
    let tree = repo.find_tree(index.write_tree_to(repo)?)?;
    let s = sig()?;
    let oid = repo.commit(Some("HEAD"), &s, &s, "Merge from the other device (by the study rules)", &tree, &[&ours, &theirs])?;
    repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    out.kind = format!("merged, commit {}", short(oid));
    Ok(out)
}

fn assert_same(a: &Repository, b: &Repository) -> Res<()> {
    let ta = a.head()?.peel_to_tree()?.id();
    let tb = b.head()?.peel_to_tree()?.id();
    if ta != tb {
        return Err(format!("trees differ: {ta} vs {tb}").into());
    }
    Ok(())
}

fn short(o: Oid) -> String {
    o.to_string()[..8].to_string()
}

// ---- edits a device makes (in the study folder's own formats) ---------------------------------------------------------

fn edit_note(repo: &Repository, rel: &str, add: &str, updated: &str) -> Res<()> {
    let path = repo.workdir().unwrap().join(rel);
    let text = fs::read_to_string(&path)?.replace("\r\n", "\n");
    let mut out = String::new();
    for line in text.lines() {
        if line.starts_with("updated:") {
            out += &format!("updated: \"{updated}\"\n");
        } else {
            out += line;
            out += "\n";
        }
    }
    fs::write(&path, format!("{}\n\n{add}\n", out.trim_end()))?;
    Ok(())
}

fn add_highlight(repo: &Repository, words: &merge::Words, id: &str, anchor: &str, color: &str, created: &str) -> Res<()> {
    let path = repo.workdir().unwrap().join(HL);
    let mut v: serde_json::Value = serde_json::from_str(&fs::read_to_string(&path)?)?;
    let quote = words.quote_of(anchor).unwrap_or_default();
    v["highlights"].as_array_mut().unwrap().push(serde_json::json!({"id": id, "anchor": anchor, "color": color, "quote": quote, "created": created}));
    fs::write(&path, merge::to_python_json(&v))?;
    Ok(())
}

fn copy_tree(from: &Path, to: &Path) -> Res<()> {
    for e in fs::read_dir(from)? {
        let e = e?;
        let name = e.file_name();
        if name == ".git" || name == ".trash" {
            continue;
        }
        let dest: PathBuf = to.join(&name);
        if e.file_type()?.is_dir() {
            fs::create_dir_all(&dest)?;
            copy_tree(&e.path(), &dest)?;
        } else {
            fs::copy(e.path(), dest)?;
        }
    }
    Ok(())
}

#[derive(Default)]
struct Log(Vec<String>);

impl Log {
    fn step(&mut self, what: &str, t: Instant, detail: String) {
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        self.0.push(format!("{ms:8.1} ms  {what}{}", if detail.is_empty() { String::new() } else { format!(": {detail}") }));
    }
    fn note(&mut self, s: &str) {
        self.0.push(format!("             {s}"));
    }
    fn text(&self) -> String {
        self.0.join("\n")
    }
}
