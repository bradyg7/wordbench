//! A word's English definition (docs/archive/2026-11-10/docs/redesign-R5.md): Webster's 1913, in a read-only database of its own, built by
//! `scripts/build-dictionary.py`. An entry is the source's text, verbatim, shown with its source and licence. Nothing
//! here picks a sense or says what a word means in a verse.

use crate::bible::Bible;
use crate::places::Span;
use crate::{Error, Result};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use std::path::Path;

pub struct Dictionary {
    conn: Connection,
}

#[derive(Debug, Clone, Serialize)]
pub struct Source {
    pub name: String,
    pub edition: String,
    pub licence: String,
    pub url: String,
    pub via: String,
    pub entries: u64,
}

/// An entry: the word as asked, the headword it was found under (a plural or an ending may be taken off), the text.
#[derive(Debug, Clone, Serialize)]
pub struct Entry {
    pub word: String,
    pub headword: String,
    pub text: String,
}

/// Where the dictionary database is: `WB_DICT_DB`, or `bible-workbench-rs\dictionary.db` in the local app data.
pub fn default_path() -> std::path::PathBuf {
    #[cfg(feature = "distribution")]
    {
        crate::runtime::resource_path("dictionary.db")
    }
    #[cfg(not(feature = "distribution"))]
    {
        if let Ok(p) = std::env::var("WB_DICT_DB") {
            return p.into();
        }
        let base = crate::platform::local_data_dir().unwrap_or_else(|| {
            crate::default_study_dir()
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_default()
        });
        base.join("bible-workbench-rs").join("dictionary.db")
    }
}

/// The letters of a word, lower-cased, without a possessive: "God’s" → "god".
fn clean(word: &str) -> String {
    let w = word.trim().to_lowercase().replace('’', "'");
    let w = w.strip_suffix("'s").unwrap_or(&w);
    w.chars()
        .filter(|c| c.is_alphabetic() || *c == '-')
        .collect()
}

/// The headwords to try for a word, the word itself first, then without its ending.
fn candidates(w: &str) -> Vec<String> {
    let mut v = vec![w.to_string()];
    if w.chars().count() > 3 {
        let mut add = |s: String| {
            if !v.contains(&s) {
                v.push(s)
            }
        };
        if let Some(s) = w.strip_suffix("ies") {
            add(format!("{s}y"));
        }
        if let Some(s) = w.strip_suffix("ied") {
            add(format!("{s}y"));
        }
        if let Some(s) = w.strip_suffix("ing") {
            add(s.to_string());
            add(format!("{s}e"));
        }
        if let Some(s) = w.strip_suffix("eth") {
            add(s.to_string());
            add(format!("{s}e"));
        }
        if let Some(s) = w.strip_suffix("est") {
            add(s.to_string());
            add(format!("{s}e"));
        }
        if let Some(s) = w.strip_suffix("es") {
            add(s.to_string());
        }
        if let Some(s) = w.strip_suffix("ed") {
            add(s.to_string());
            add(format!("{s}e"));
        }
        if let Some(s) = w.strip_suffix('d') {
            add(s.to_string());
        }
        if let Some(s) = w.strip_suffix('s') {
            add(s.to_string());
        }
        if let Some(s) = w.strip_suffix("ly") {
            add(s.to_string());
        }
    }
    v
}

impl Dictionary {
    pub fn open(path: &Path) -> Result<Dictionary> {
        if !path.exists() {
            return Err(Error(format!(
                "No dictionary at {} (run scripts/build-dictionary.py, or set WB_DICT_DB)",
                path.display()
            )));
        }
        let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(path, flags)?;
        conn.pragma_update(None, "query_only", true)?;
        Ok(Dictionary { conn })
    }

    pub fn source(&self) -> Result<Source> {
        let m = |k: &str| -> Result<String> {
            Ok(self
                .conn
                .query_row("SELECT value FROM meta WHERE key = ?1", [k], |r| r.get(0))
                .optional()?
                .unwrap_or_default())
        };
        let entries: i64 = self
            .conn
            .query_row("SELECT count(*) FROM entries", [], |r| r.get(0))?;
        Ok(Source {
            name: m("name")?,
            edition: m("edition")?,
            licence: m("licence")?,
            url: m("url")?,
            via: m("via")?,
            entries: entries as u64,
        })
    }

    /// The entry for a word, if the source has one.
    pub fn entry(&self, word: &str) -> Result<Option<Entry>> {
        let w = clean(word);
        if w.is_empty() {
            return Ok(None);
        }
        for head in candidates(&w) {
            let text: Option<String> = self
                .conn
                .query_row(
                    "SELECT text FROM entries WHERE headword = ?1",
                    [&head],
                    |r| r.get(0),
                )
                .optional()?;
            if let Some(text) = text {
                return Ok(Some(Entry {
                    word: word.trim().to_string(),
                    headword: head,
                    text,
                }));
            }
        }
        Ok(None)
    }

    /// The words of a place, each once, in the order they first appear, with the entry the source has for it (if any).
    pub fn words_of(&self, bible: &Bible, span: &Span) -> Result<Vec<(String, Option<Entry>)>> {
        let mut stmt = bible.conn().prepare_cached(
            "SELECT text FROM words WHERE book = ?1 \
               AND (chapter > ?2 OR (chapter = ?2 AND verse >= ?3)) \
               AND (chapter < ?4 OR (chapter = ?4 AND (?5 = 0 OR verse <= ?5))) \
             ORDER BY chapter, verse, idx",
        )?;
        let rows = stmt.query_map(
            rusqlite::params![span.book.id, span.c1, span.v1.max(1), span.c2, span.v2],
            |r| r.get::<_, String>(0),
        )?;
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for row in rows {
            let text = row?;
            let key = clean(&text);
            if key.is_empty() || !seen.insert(key) {
                continue;
            }
            let entry = self.entry(&text)?;
            out.push((text, entry));
        }
        Ok(out)
    }
}
