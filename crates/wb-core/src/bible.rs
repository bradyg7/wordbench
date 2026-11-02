//! The Bible database, read-only: KJV words with Strong's numbers, the lexicons, the YLT (`datasets/workbench.db`, built
//! by the Python repository). Opened with SQLite's read-only flag; nothing here writes.

use crate::{Error, Result};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use std::path::Path;

pub struct Bible {
    conn: Connection,
    books: Vec<Book>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Book {
    pub id: u32,
    pub code: String,
    pub name: String,
    pub testament: String,
    pub chapters: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Word {
    pub i: u32,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub lead: String,
    pub text: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub trail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strong: Option<String>,
    #[serde(skip_serializing_if = "is_false")]
    pub italic: bool,
    #[serde(skip_serializing_if = "is_false")]
    pub nd: bool,
    #[serde(skip_serializing_if = "is_false")]
    pub wj: bool,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub para: String,
}

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, Clone, Serialize)]
pub struct Verse {
    pub v: u32,
    pub words: Vec<Word>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Chapter {
    pub code: String,
    pub name: String,
    pub chapter: u32,
    pub chapters: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub verses: Vec<Verse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Lexicon {
    pub strong: String,
    pub lang: String,
    pub lemma: String,
    pub translit: Option<String>,
    pub pron: Option<String>,
    pub pos: Option<String>,
    pub derivation: Option<String>,
    pub definition: Option<String>,
    pub usage: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Count {
    pub strong: String,
    pub times: u32,
    pub verses: u32,
    pub books: u32,
}

/// One verse of text with its reference, verbatim.
#[derive(Debug, Clone, Serialize)]
pub struct Passage {
    pub reference: String,
    pub verses: Vec<(u32, u32, String)>,
}

impl Bible {
    pub fn open(path: &Path) -> Result<Bible> {
        if !path.exists() {
            return Err(Error(format!("No Bible database at {} (set WB_BIBLE_DB)", path.display())));
        }
        let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(path, flags)?;
        conn.pragma_update(None, "query_only", true)?;
        let books = conn
            .prepare("SELECT id, code, name, testament, chapters FROM books ORDER BY id")?
            .query_map([], |r| {
                Ok(Book { id: r.get(0)?, code: r.get(1)?, name: r.get(2)?, testament: r.get(3)?, chapters: r.get(4)? })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(Bible { conn, books })
    }

    /// The connection, read-only (for the lookups in `lookup`).
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn books(&self) -> &[Book] {
        &self.books
    }

    pub fn book(&self, code: &str) -> Result<&Book> {
        self.books.iter().find(|b| b.code == code).ok_or_else(|| Error(format!("No book {code}")))
    }

    /// A book by its code ("NUM"), its name ("Numbers") or the start of its name ("Num", "1 Sam").
    pub fn find_book(&self, name: &str) -> Option<&Book> {
        let key: String = name.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_lowercase();
        if key.is_empty() {
            return None;
        }
        let squash = |s: &str| s.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_lowercase();
        self.books
            .iter()
            .find(|b| b.code.to_lowercase() == key || squash(&b.name) == key)
            .or_else(|| self.books.iter().find(|b| squash(&b.name).starts_with(&key)))
    }

    pub fn chapter(&self, code: &str, chapter: u32) -> Result<Chapter> {
        let book = self.book(code)?.clone();
        if chapter == 0 || chapter > book.chapters {
            return Err(Error(format!("{} has {} chapters", book.name, book.chapters)));
        }
        let mut stmt = self.conn.prepare_cached(
            "SELECT verse, idx, lead, text, trail, strong, italic, nd, wj, para FROM words \
             WHERE book = ?1 AND chapter = ?2 ORDER BY verse, idx",
        )?;
        let mut verses: Vec<Verse> = Vec::new();
        let rows = stmt.query_map(params![book.id, chapter], |r| {
            Ok((
                r.get::<_, u32>(0)?,
                Word {
                    i: r.get(1)?,
                    lead: r.get(2)?,
                    text: r.get(3)?,
                    trail: r.get(4)?,
                    strong: r.get(5)?,
                    italic: r.get::<_, i64>(6)? != 0,
                    nd: r.get::<_, i64>(7)? != 0,
                    wj: r.get::<_, i64>(8)? != 0,
                    para: r.get(9)?,
                },
            ))
        })?;
        for row in rows {
            let (v, w) = row?;
            match verses.last_mut() {
                Some(last) if last.v == v => last.words.push(w),
                _ => verses.push(Verse { v, words: vec![w] }),
            }
        }
        let title = self
            .conn
            .query_row("SELECT title FROM chapter_titles WHERE book = ?1 AND chapter = ?2", params![book.id, chapter], |r| r.get(0))
            .optional()?;
        Ok(Chapter { code: book.code, name: book.name, chapter, chapters: book.chapters, title, verses })
    }

    /// One word of a verse (`i` is its 0-based position), with the book's name.
    pub fn word(&self, code: &str, c: u32, v: u32, i: u32) -> Result<(String, Word)> {
        let book = self.book(code)?;
        let w = self
            .conn
            .prepare_cached(
                "SELECT idx, lead, text, trail, strong, italic, nd, wj, para FROM words                  WHERE book = ?1 AND chapter = ?2 AND verse = ?3 AND idx = ?4",
            )?
            .query_row(params![book.id, c, v, i], |r| {
                Ok(Word {
                    i: r.get(0)?,
                    lead: r.get(1)?,
                    text: r.get(2)?,
                    trail: r.get(3)?,
                    strong: r.get(4)?,
                    italic: r.get::<_, i64>(5)? != 0,
                    nd: r.get::<_, i64>(6)? != 0,
                    wj: r.get::<_, i64>(7)? != 0,
                    para: r.get(8)?,
                })
            })
            .optional()?
            .ok_or_else(|| Error(format!("No word {i} in {} {c}:{v}", book.name)))?;
        Ok((book.name.clone(), w))
    }

    pub fn lexicon(&self, strong: &str) -> Result<Option<Lexicon>> {
        Ok(self
            .conn
            .query_row(
                "SELECT strong, lang, lemma, translit, pron, pos, derivation, definition, usage FROM lexicon WHERE strong = ?1",
                [strong],
                |r| {
                    Ok(Lexicon {
                        strong: r.get(0)?,
                        lang: r.get(1)?,
                        lemma: r.get(2)?,
                        translit: r.get(3)?,
                        pron: r.get(4)?,
                        pos: r.get(5)?,
                        derivation: r.get(6)?,
                        definition: r.get(7)?,
                        usage: r.get(8)?,
                    })
                },
            )
            .optional()?)
    }

    /// How often a Strong's number is used in the KJV: words tagged with it, the verses and the books they are in.
    pub fn count(&self, strong: &str) -> Result<Count> {
        let (times, verses, books) = self.conn.query_row(
            "SELECT count(*), count(DISTINCT book * 1000000 + chapter * 1000 + verse), count(DISTINCT book) \
             FROM words WHERE strong = ?1",
            [strong],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        Ok(Count { strong: strong.into(), times, verses, books })
    }

    /// Verse text, verbatim, for a range of verses in one book (`v2` may be in a later chapter).
    pub fn verses(&self, code: &str, c1: u32, v1: u32, c2: u32, v2: u32) -> Result<Vec<(u32, u32, String)>> {
        let book = self.book(code)?;
        let mut stmt = self.conn.prepare_cached(
            "SELECT chapter, verse, text FROM verses WHERE book = ?1 \
             AND (chapter, verse) >= (?2, ?3) AND (chapter, verse) <= (?4, ?5) ORDER BY chapter, verse",
        )?;
        let rows = stmt
            .query_map(params![book.id, c1, v1, c2, v2], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// A typed place ("Num 25:11", "Numbers 25", "Num 25:10-13", "Num 25:10-26:4") as verbatim verses with its label.
    pub fn passage(&self, place: &str) -> Result<Passage> {
        let place = place.trim();
        let bad = || Error(format!("Not a place: {place:?}"));
        // The book name is everything before the last run of digits that starts the chapter.
        let split = place
            .char_indices()
            .filter(|&(i, c)| c.is_ascii_digit() && i > 0 && place[..i].ends_with(' '))
            .map(|(i, _)| i)
            .last()
            .ok_or_else(bad)?;
        let book = self.find_book(&place[..split]).ok_or_else(bad)?.clone();
        let spec = place[split..].replace(' ', "");
        let num = |s: &str| s.parse::<u32>().map_err(|_| bad());
        let (start, end) = spec.split_once(['-', '–']).map(|(a, b)| (a.to_string(), Some(b.to_string()))).unwrap_or((spec.clone(), None));
        let (c1, v1) = match start.split_once(':') {
            Some((c, v)) => (num(c)?, Some(num(v)?)),
            None => (num(&start)?, None),
        };
        let (c2, v2) = match (&end, v1) {
            (None, Some(v)) => (c1, v),
            (None, None) => (c1, u32::MAX),
            (Some(e), _) => match e.split_once(':') {
                Some((c, v)) => (num(c)?, num(v)?),
                None if v1.is_some() => (c1, num(e)?),
                None => (num(e)?, u32::MAX),
            },
        };
        let verses = self.verses(&book.code, c1, v1.unwrap_or(1), c2, v2)?;
        let (Some(first), Some(last)) = (verses.first(), verses.last()) else {
            return Err(Error(format!("{place:?} is not in the text")));
        };
        let reference = if first == last {
            format!("{} {}:{}", book.name, first.0, first.1)
        } else if first.0 == last.0 {
            format!("{} {}:{}–{}", book.name, first.0, first.1, last.1)
        } else {
            format!("{} {}:{}–{}:{}", book.name, first.0, first.1, last.0, last.1)
        };
        Ok(Passage { reference, verses })
    }
}
