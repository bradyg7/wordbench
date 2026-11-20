//! What changed (design/features/updates, ticket UP3, U-6): a release's notes read under four fixed headings, in this
//! order: Moved or removed, New, Changed, Fixed, then one line, Your study folder. The notes are plain text written for
//! the release and speak of the app only; they are only read, never followed (no link is fetched, no markup is drawn).

use serde_json::{json, Value};

/// A release's notes as the feed or the program carries them.
#[derive(Clone, PartialEq, Debug)]
pub struct Release {
    pub version: String,
    /// `YYYY-MM-DD`, or empty when it is not known.
    pub date: String,
    pub notes: String,
}

/// The notes under their headings; each part is its lines, in the release's own words.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct Parts {
    pub moved: Vec<String>,
    pub new: Vec<String>,
    pub changed: Vec<String>,
    pub fixed: Vec<String>,
    pub study: Vec<String>,
}

pub const NOTHING_MOVED: &str = "Nothing was moved or removed.";

/// The four headings, then the study-folder line's.
pub const HEADINGS: [&str; 5] = ["Moved or removed", "New", "Changed", "Fixed", "Your study folder"];

/// The notes of this very version, which come with the program (so they read offline after an update, U-9).
pub fn installed_notes() -> &'static str {
    include_str!(concat!(env!("OUT_DIR"), "/installed-notes.md"))
}

/// Reads notes into their parts. A line under a heading is a line of that part (a leading `-` or `*` is dropped);
/// text before the first heading, or under another heading, is not part of the four.
pub fn parts(notes: &str) -> Parts {
    let mut p = Parts::default();
    let mut under: Option<usize> = None;
    for line in notes.lines() {
        let t = line.trim();
        if t.starts_with('#') {
            let name = t.trim_start_matches('#').trim().trim_end_matches(':').to_lowercase();
            under = HEADINGS.iter().position(|h| h.to_lowercase() == name);
            continue;
        }
        let text = t.strip_prefix("- ").or_else(|| t.strip_prefix("* ")).unwrap_or(t).trim();
        if text.is_empty() {
            continue;
        }
        let Some(i) = under else { continue };
        let list = match i {
            0 => &mut p.moved,
            1 => &mut p.new,
            2 => &mut p.changed,
            3 => &mut p.fixed,
            _ => &mut p.study,
        };
        list.push(text.to_string());
    }
    p
}

impl Parts {
    /// What moved or was removed: its lines, or the one line that says nothing did.
    pub fn moved_lines(&self) -> Vec<String> {
        if self.moved.is_empty() {
            vec![NOTHING_MOVED.to_string()]
        } else {
            self.moved.clone()
        }
    }
    /// Whether the release moved or removed something.
    pub fn moved_something(&self) -> bool {
        !self.moved.is_empty()
    }
    /// The notes say the study folder's form was moved forward (U-13): a release whose *Your study folder* line says
    /// anything other than that nothing changes in it is one the person cannot go back from. Only a line that names a move
    /// counts, so the word the release writes ("moved", "converted", "new form") is what is looked for.
    pub fn study_form_moved(&self) -> bool {
        let t = self.study.join(" ").to_lowercase();
        ["moved", "converted", "new form", "migrat", "rewritten", "changes the form"].iter().any(|w| t.contains(w)) && !t.contains("nothing")
    }
}

fn head(r: &Release) -> String {
    if r.date.is_empty() {
        format!("Bible Workbench {}", r.version)
    } else {
        format!("Bible Workbench {} ({})", r.version, r.date)
    }
}

/// One release in full, as `wb update notes` prints it: the four headings in order, then the study-folder line.
pub fn render_full(r: &Release) -> String {
    let p = parts(&r.notes);
    let mut out = vec![head(r), String::new()];
    let sections: [(&str, Vec<String>); 4] = [("Moved or removed", p.moved_lines()), ("New", p.new.clone()), ("Changed", p.changed.clone()), ("Fixed", p.fixed.clone())];
    for (name, lines) in sections {
        out.push(name.to_string());
        out.extend(lines.into_iter().map(|l| format!("- {l}")));
        out.push(String::new());
    }
    out.push("Your study folder".to_string());
    out.extend(p.study.iter().cloned());
    out.join("\n").trim_end().to_string()
}

/// An older release folded: its version and date, and, when it moved or removed something, that line.
pub fn render_folded(r: &Release) -> String {
    let p = parts(&r.notes);
    let mut out = head(r);
    if let Some(first) = p.moved.first() {
        out.push_str(&format!("\n  Moved or removed: {first}"));
    }
    out
}

/// Every release newer than the one running, newest first: the newest in full, the older ones folded. `releases` is
/// already newest first.
pub fn render_all(releases: &[Release]) -> String {
    let mut parts = vec![];
    for (i, r) in releases.iter().enumerate() {
        parts.push(if i == 0 { render_full(r) } else { render_folded(r) });
    }
    parts.join("\n\n")
}

/// A release for the window: its headings as lists, and whether it is shown open or folded.
pub fn to_json(r: &Release, open: bool) -> Value {
    let p = parts(&r.notes);
    json!({
        "version": r.version, "date": r.date, "open": open,
        "moved": p.moved_lines(), "moved_something": p.moved_something(),
        "new": p.new, "changed": p.changed, "fixed": p.fixed, "study": p.study,
    })
}
