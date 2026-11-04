//! What the reader's sheets and cards show, put together once so the app and `wb` give the same answer.

use crate::anchors::{self, Kind};
use crate::bible::{Bible, Chapter, Count, Lexicon};
use crate::marks::{self, ChapterMarks};
use crate::store::{places_of, s, Rec, Store};
use crate::{Error, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ReaderView {
    pub chapter: Chapter,
    pub marks: ChapterMarks,
    /// Open questions (trails) in the chapter, by verse: a ? on the verse number.
    pub questions: Vec<serde_json::Value>,
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
    pub notes: Vec<Rec>,
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
    pub notes: Vec<Rec>,
    pub threads: Vec<ThreadRef>,
}

pub fn reader(bible: &Bible, store: &Store, code: &str, chapter: u32) -> Result<ReaderView> {
    Ok(ReaderView { chapter: bible.chapter(code, chapter)?, marks: marks::chapter_marks(store, code, chapter)?, questions: crate::notebook::chapter_questions(store, code, chapter) })
}

fn touches_verse(anchor: &str, code: &str, c: u32, v: u32) -> bool {
    match anchors::parse(anchor) {
        Ok(a) if a.kind != Kind::Lemma && a.code == code => {
            (a.c1, a.v1) <= (c, v) && (c, v) <= (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1))
        }
        _ => false,
    }
}

pub fn word(bible: &Bible, store: &Store, code: &str, c: u32, v: u32, i: u32) -> Result<WordView> {
    let (name, w) = bible.word(code, c, v, i)?;
    let strong = w.strong.clone();
    let anchor = format!("{code}.{c}:{v}.{i}");
    let here = store.notes().into_iter().filter(|n| places_of(n).contains(&anchor));
    let everywhere = store.notes().into_iter().filter(|n| strong.as_deref().is_some_and(|x| s(n, "anchor") == x));
    let notes = here.chain(everywhere).cloned().collect();
    Ok(WordView {
        reference: format!("{name} {c}:{v}"),
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

pub fn verse(bible: &Bible, store: &Store, code: &str, c: u32, v: u32) -> Result<VerseView> {
    let book = bible.book(code)?;
    let text = bible
        .verses(code, c, v, c, v)?
        .into_iter()
        .next()
        .map(|x| x.2)
        .ok_or_else(|| Error(format!("No verse {} {c}:{v}", book.name)))?;
    let anchor = format!("{code}.{c}:{v}");
    let color = store.highlights(code).into_iter().rev().find(|h| s(h, "anchor") == anchor).map(|h| s(&h, "color"));
    let notes = store.notes().into_iter().filter(|n| places_of(n).iter().any(|p| touches_verse(p, code, c, v))).cloned().collect();
    let threads = store
        .threads()
        .into_iter()
        .filter(|t| t["members"].as_array().unwrap().iter().any(|m| touches_verse(m["anchor"].as_str().unwrap_or(""), code, c, v)))
        .map(|t| ThreadRef { id: s(t, "id"), name: s(t, "name"), color: s(t, "color") })
        .collect();
    Ok(VerseView { reference: format!("{} {c}:{v}", book.name), anchor, text, color, notes, threads })
}
