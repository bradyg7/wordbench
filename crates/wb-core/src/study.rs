//! The study folder, read in the Python app's formats (`workbench/study.py`):
//!
//! ```text
//! highlights/<BOOK>.json    {"highlights": [{id, anchor, color, quote, created}]}
//! notes/<BOOK>/<id>.md      front matter (id, anchor, kind, quote, strong, created, updated), then the note
//! threads/<slug>.md         front matter (name, created, updated, color), the note, then "<!-- anchors -->" and
//!                           one "- ANCHOR | \"quote\"" line per member
//! ```
//!
//! Phase 0 only reads. Writing (with the no-overlap rule for highlights, and deletes to `.trash/`) comes in phase 1.

use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct Study {
    root: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub id: String,
    pub anchor: String,
    pub color: String,
    #[serde(default)]
    pub quote: String,
    #[serde(default)]
    pub created: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Note {
    pub id: String,
    pub anchor: String,
    pub kind: String,
    pub quote: String,
    pub strong: String,
    pub created: String,
    pub updated: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Thread {
    pub id: String,
    pub name: String,
    pub color: String,
    pub note: String,
    pub members: Vec<String>,
}

#[derive(Deserialize)]
struct HighlightFile {
    #[serde(default)]
    highlights: Vec<Highlight>,
}

/// The front matter the Python app writes: `key: "json string"` lines between `---` fences.
fn front_matter(text: &str) -> (BTreeMap<String, String>, String) {
    let mut meta = BTreeMap::new();
    let text = text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n");
    let Some(rest) = text.strip_prefix("---\n") else {
        return (meta, text);
    };
    let Some(end) = rest.find("\n---") else {
        return (meta, text.clone());
    };
    for line in rest[..end].lines() {
        if let Some((k, v)) = line.split_once(':') {
            let v = v.trim();
            let v = serde_json::from_str::<String>(v).unwrap_or_else(|_| v.trim_matches('"').to_string());
            meta.insert(k.trim().to_string(), v);
        }
    }
    let body = rest[end + 4..].trim_start_matches('\n').to_string();
    (meta, body)
}

impl Study {
    /// Opens a study folder. The person's real folder is refused unless `WB_ALLOW_REAL_STUDY=1` (CLAUDE.md).
    pub fn open(root: &Path) -> Result<Study> {
        if !root.is_dir() {
            return Err(Error(format!(
                "No study folder at {} (make a scratch copy with scripts/scratch-study.ps1, or set WB_STUDY_DIR)",
                root.display()
            )));
        }
        let real = crate::real_study_dir();
        let same = match (fs::canonicalize(root), fs::canonicalize(&real)) {
            (Ok(a), Ok(b)) => a == b,
            _ => false,
        };
        if same && std::env::var("WB_ALLOW_REAL_STUDY").as_deref() != Ok("1") {
            return Err(Error(format!("{} is the person's real study folder; use a scratch copy", root.display())));
        }
        Ok(Study { root: root.to_path_buf() })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn highlights(&self, code: &str) -> Result<Vec<Highlight>> {
        let path = self.root.join("highlights").join(format!("{code}.json"));
        match fs::read_to_string(&path) {
            Ok(text) => {
                let f: HighlightFile =
                    serde_json::from_str(&text).map_err(|e| Error(format!("{}: {e}", path.display())))?;
                Ok(f.highlights)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
            Err(e) => Err(e.into()),
        }
    }

    /// Placed notes of one book (`notes/<BOOK>/*.md`).
    pub fn notes(&self, code: &str) -> Result<Vec<Note>> {
        let dir = self.root.join("notes").join(code);
        let mut out = vec![];
        let Ok(entries) = fs::read_dir(&dir) else {
            return Ok(out);
        };
        for e in entries.flatten() {
            let path = e.path();
            if path.extension().and_then(|x| x.to_str()) != Some("md") {
                continue;
            }
            let (meta, body) = front_matter(&fs::read_to_string(&path)?);
            let get = |k: &str| meta.get(k).cloned().unwrap_or_default();
            if get("id").is_empty() || get("anchor").is_empty() {
                continue;
            }
            out.push(Note {
                id: get("id"),
                anchor: get("anchor"),
                kind: get("kind"),
                quote: get("quote"),
                strong: get("strong"),
                created: get("created"),
                updated: get("updated"),
                text: body.trim().to_string(),
            });
        }
        out.sort_by(|a, b| a.created.cmp(&b.created));
        Ok(out)
    }

    pub fn threads(&self) -> Result<Vec<Thread>> {
        let mut out = vec![];
        let Ok(entries) = fs::read_dir(self.root.join("threads")) else {
            return Ok(out);
        };
        for e in entries.flatten() {
            let path = e.path();
            if path.extension().and_then(|x| x.to_str()) != Some("md") {
                continue;
            }
            let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or_default().to_string();
            let (meta, body) = front_matter(&fs::read_to_string(&path)?);
            let (note, list) = body.split_once("<!-- anchors -->").unwrap_or((&body, ""));
            let members = list
                .lines()
                .filter_map(|l| l.trim().strip_prefix("- "))
                .map(|l| l.split(" | ").next().unwrap_or(l).trim().to_string())
                .filter(|a| !a.is_empty())
                .collect();
            out.push(Thread {
                id,
                name: meta.get("name").cloned().unwrap_or_default(),
                color: meta.get("color").cloned().unwrap_or_default(),
                note: note.trim().to_string(),
                members,
            });
        }
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_front_matter() {
        let (m, body) = front_matter("---\r\nid: \"n_1\"\r\nanchor: \"NUM.25:11\"\r\nquote: \"a \\\"b\\\"\"\r\n---\r\n\r\nThe note.\r\n");
        assert_eq!(m["id"], "n_1");
        assert_eq!(m["quote"], "a \"b\"");
        assert_eq!(body.trim(), "The note.");
    }

    #[test]
    fn refuses_the_real_folder() {
        let real = crate::real_study_dir();
        if real.is_dir() && std::env::var("WB_ALLOW_REAL_STUDY").is_err() {
            assert!(Study::open(&real).is_err());
        }
    }
}
