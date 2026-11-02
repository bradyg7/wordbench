//! What the reader's sheets and cards show, put together once so the app and `wb` give the same answer.

use crate::anchors::{self, Kind};
use crate::bible::{Bible, Chapter, Count, Lexicon};
use crate::marks::{self, ChapterMarks};
use crate::study::{Note, Study};
use crate::{Error, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ReaderView {
    pub chapter: Chapter,
    pub marks: ChapterMarks,
}

#[derive(Debug, Clone, Serialize)]
pub struct WordView {
    pub reference: String,
    pub anchor: String,
    pub text: String,
    pub strong: Option<String>,
    pub lexicon: Option<Lexicon>,
    pub count: Option<Count>,
    /// Notes on this word, and on its Strong's number everywhere.
    pub notes: Vec<Note>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThreadRef {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerseView {
    pub reference: String,
    pub anchor: String,
    /// The verse, verbatim.
    pub text: String,
    /// The color of a highlight on exactly this verse, if any.
    pub color: Option<String>,
    pub notes: Vec<Note>,
    pub threads: Vec<ThreadRef>,
}

pub fn reader(bible: &Bible, study: &Study, code: &str, chapter: u32) -> Result<ReaderView> {
    Ok(ReaderView { chapter: bible.chapter(code, chapter)?, marks: marks::chapter_marks(study, code, chapter)? })
}

fn touches_verse(anchor: &str, code: &str, c: u32, v: u32) -> bool {
    match anchors::parse(anchor) {
        Ok(a) if a.kind != Kind::Lemma && a.code == code => {
            (a.c1, a.v1) <= (c, v) && (c, v) <= (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1))
        }
        _ => false,
    }
}

pub fn word(bible: &Bible, study: &Study, code: &str, c: u32, v: u32, i: u32) -> Result<WordView> {
    let ch = bible.chapter(code, c)?;
    let w = ch
        .verses
        .iter()
        .find(|x| x.v == v)
        .and_then(|x| x.words.iter().find(|w| w.i == i))
        .ok_or_else(|| Error(format!("No word {i} in {} {c}:{v}", ch.name)))?;
    let strong = w.strong.clone();
    let anchor = format!("{code}.{c}:{v}.{i}");
    let notes = study
        .notes(code)?
        .into_iter()
        .filter(|n| n.anchor == anchor)
        .chain(match &strong {
            Some(s) => study.notes("_words")?.into_iter().filter(|n| &n.anchor == s).collect(),
            None => vec![],
        })
        .collect();
    Ok(WordView {
        reference: format!("{} {c}:{v}", ch.name),
        anchor,
        text: w.text.clone(),
        lexicon: match &strong {
            Some(s) => bible.lexicon(s)?,
            None => None,
        },
        count: match &strong {
            Some(s) => Some(bible.count(s)?),
            None => None,
        },
        strong,
        notes,
    })
}

pub fn verse(bible: &Bible, study: &Study, code: &str, c: u32, v: u32) -> Result<VerseView> {
    let book = bible.book(code)?;
    let text = bible
        .verses(code, c, v, c, v)?
        .into_iter()
        .next()
        .map(|x| x.2)
        .ok_or_else(|| Error(format!("No verse {} {c}:{v}", book.name)))?;
    let anchor = format!("{code}.{c}:{v}");
    let color = study.highlights(code)?.into_iter().rev().find(|h| h.anchor == anchor).map(|h| h.color);
    let notes = study.notes(code)?.into_iter().filter(|n| touches_verse(&n.anchor, code, c, v)).collect();
    let threads = study
        .threads()?
        .into_iter()
        .filter(|t| t.members.iter().any(|m| touches_verse(m, code, c, v)))
        .map(|t| ThreadRef { id: t.id, name: t.name, color: t.color })
        .collect();
    Ok(VerseView { reference: format!("{} {c}:{v}", book.name), anchor, text, color, notes, threads })
}
