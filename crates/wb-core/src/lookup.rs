//! Read-only lookups: the Python app's `workbench/api.py`, giving the same answers in the same shapes (JSON objects with
//! their keys in the same order), so `wb` prints what the Python `wb` prints. Every function reads the Bible database.

use crate::bible::{Bible, Book};
use crate::places::in_scope;
use crate::{Error, Result};
use rusqlite::{params, params_from_iter, OptionalExtension};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::sync::OnceLock;

pub const PAGE: usize = 100;
pub const INTERLINEAR_VERSES: usize = 40;

fn bad(msg: impl Into<String>) -> Error {
    Error(msg.into())
}

pub fn is_strong(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() >= 2 && b.len() <= 5 && (b[0] == b'H' || b[0] == b'G') && b[1..].iter().all(u8::is_ascii_digit)
}

/// `^[\w’'\-]{1,40}$`
pub fn is_word(s: &str) -> bool {
    let n = s.chars().count();
    (1..=40).contains(&n) && s.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '’' || c == '\'' || c == '-' || is_word_mark(c))
}

/// Python's \w also takes combining marks and connector punctuation; for the KJV's words that means letters, digits and _.
fn is_word_mark(c: char) -> bool {
    unicode_normalization::char::is_combining_mark(c)
}

fn row_value(r: &rusqlite::Row, i: usize) -> rusqlite::Result<Value> {
    use rusqlite::types::ValueRef;
    Ok(match r.get_ref(i)? {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(n) => json!(n),
        ValueRef::Real(f) => json!(f),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(_) => Value::Null,
    })
}

/// Every row of a query as a JSON object with the query's column names, in order.
fn rows(bible: &Bible, sql: &str, p: impl rusqlite::Params) -> Result<Vec<Map<String, Value>>> {
    let mut stmt = bible.conn().prepare_cached(sql)?;
    let names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
    let out = stmt
        .query_map(p, |r| {
            let mut m = Map::new();
            for (i, n) in names.iter().enumerate() {
                m.insert(n.clone(), row_value(r, i)?);
            }
            Ok(m)
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(out)
}

fn book_by_id(bible: &Bible, id: u32) -> Option<&Book> {
    bible.books().iter().find(|b| b.id == id)
}

fn reference(b: &Book, c: u32, v: u32) -> Value {
    json!({"b": b.id, "code": b.code, "name": b.name, "c": c, "v": v})
}

// ---- books, chapter, strong ---------------------------------------------------------------------------------------

pub fn books(bible: &Bible) -> Value {
    json!(bible.books())
}

pub fn versions(bible: &Bible) -> Result<Value> {
    Ok(json!(rows(bible, "SELECT id, name, license, words FROM versions ORDER BY words DESC, id", [])?))
}

/// A chapter's KJV words with their Strong's numbers (`api.chapter`), or None when there is no such chapter.
pub fn chapter(bible: &Bible, book: u32, ch: u32) -> Result<Option<Value>> {
    let Some(b) = book_by_id(bible, book) else { return Ok(None) };
    if ch < 1 || ch > b.chapters {
        return Ok(None);
    }
    let mut verses: BTreeMap<i64, Map<String, Value>> = BTreeMap::new();
    for r in rows(bible, "SELECT verse, idx, lead, text, trail, strong, grp, italic, nd, wj, para FROM words \
                          WHERE book = ? AND chapter = ? ORDER BY verse, idx", params![book, ch])?
    {
        let v = r["verse"].as_i64().unwrap();
        let e = verses.entry(v).or_insert_with(|| {
            let mut m = Map::new();
            m.insert("v".into(), json!(v));
            m.insert("words".into(), json!([]));
            m.insert("notes".into(), json!([]));
            m
        });
        e["words"].as_array_mut().unwrap().push(json!({
            "i": r["idx"], "lead": r["lead"], "t": r["text"], "trail": r["trail"], "s": r["strong"], "g": r["grp"],
            "it": r["italic"], "nd": r["nd"], "wj": r["wj"], "p": r["para"]}));
    }
    for r in rows(bible, "SELECT verse, after_idx, text FROM footnotes WHERE book = ? AND chapter = ? ORDER BY verse, after_idx", params![book, ch])? {
        if let Some(v) = verses.get_mut(&r["verse"].as_i64().unwrap()) {
            v["notes"].as_array_mut().unwrap().push(json!({"after": r["after_idx"], "text": r["text"]}));
        }
    }
    let title: Option<String> = bible
        .conn()
        .query_row("SELECT title FROM chapter_titles WHERE book = ? AND chapter = ?", params![book, ch], |r| r.get(0))
        .optional()?;
    Ok(Some(json!({
        "book": {"id": b.id, "code": b.code, "name": b.name, "chapters": b.chapters},
        "chapter": ch, "title": title, "verses": verses.into_values().collect::<Vec<_>>()})))
}

/// A lexicon entry plus how the KJV renders it (one count per tagged unit, not per English word).
pub fn strong(bible: &Bible, sid: &str) -> Result<Option<Value>> {
    let Some(mut out) = rows(bible, "SELECT * FROM lexicon WHERE strong = ?", [sid])?.into_iter().next() else { return Ok(None) };
    let renderings = rows(
        bible,
        "SELECT lower(r) AS w, COUNT(*) AS n FROM (\
           SELECT group_concat(text, ' ') AS r FROM (\
             SELECT book, chapter, verse, grp, text FROM words WHERE strong = ? ORDER BY book, chapter, verse, idx)\
           GROUP BY book, chapter, verse, grp) GROUP BY lower(r) ORDER BY n DESC, w",
        [sid],
    )?;
    let total: i64 = renderings.iter().map(|r| r["n"].as_i64().unwrap_or(0)).sum();
    out.insert("renderings".into(), json!(renderings));
    out.insert("occurrences".into(), json!(total));
    Ok(Some(Value::Object(out)))
}

/// {strong: {strong, lang, lemma, translit, pron, definition, usage}} for up to 200 numbers.
pub fn strongs_brief(bible: &Bible, ids: &[String]) -> Result<Map<String, Value>> {
    let ids: Vec<&String> = ids.iter().filter(|i| !i.is_empty()).take(200).collect();
    if ids.is_empty() {
        return Ok(Map::new());
    }
    let marks = vec!["?"; ids.len()].join(",");
    let sql = format!("SELECT strong, lang, lemma, translit, pron, definition, usage FROM lexicon WHERE strong IN ({marks})");
    Ok(rows(bible, &sql, params_from_iter(ids))?
        .into_iter()
        .map(|m| (m["strong"].as_str().unwrap_or_default().to_string(), Value::Object(m)))
        .collect())
}

// ---- occurrences --------------------------------------------------------------------------------------------------

type Key = (u32, u32, u32); // book, chapter, verse

struct WordRow {
    idx: i64,
    lead: String,
    text: String,
    trail: String,
}

fn verse_words(bible: &Bible, keys: &[Key]) -> Result<HashMap<Key, Vec<WordRow>>> {
    let mut out: HashMap<Key, Vec<WordRow>> = HashMap::new();
    for chunk in keys.chunks(300) {
        let marks = vec!["(?,?,?)"; chunk.len()].join(",");
        let sql = format!(
            "SELECT book, chapter, verse, idx, lead, text, trail FROM words \
             WHERE (book, chapter, verse) IN (VALUES {marks}) ORDER BY book, chapter, verse, idx"
        );
        let flat: Vec<u32> = chunk.iter().flat_map(|k| [k.0, k.1, k.2]).collect();
        let mut stmt = bible.conn().prepare(&sql)?;
        let it = stmt.query_map(params_from_iter(flat), |r| {
            Ok(((r.get(0)?, r.get(1)?, r.get(2)?), WordRow { idx: r.get(3)?, lead: r.get(4)?, text: r.get(5)?, trail: r.get(6)? }))
        })?;
        for x in it {
            let (k, w) = x?;
            out.entry(k).or_default().push(w);
        }
    }
    Ok(out)
}

/// A verse with its marked words, and where they are: runs, each {end, anchor, unit}. A unit is a run of the original
/// word's words; the other kind is a word marked only by its English.
fn marked_row(b: &Book, key: Key, words: &[WordRow], marks: &HashMap<i64, &'static str>) -> Value {
    let (_, c, v) = key;
    let row: Vec<(i64, &str)> = words.iter().map(|w| (w.idx, marks.get(&w.idx).copied().unwrap_or(""))).collect();
    let kind = |m: Option<&(i64, &str)>| match m {
        Some((_, "s" | "b")) => "unit",
        Some((_, m)) if !m.is_empty() => "english",
        _ => "",
    };
    let mut runs = vec![];
    let mut first: Option<usize> = None;
    for k in 0..row.len() {
        let me = kind(row.get(k));
        if !me.is_empty() && first.is_none() {
            first = Some(k);
        }
        if !me.is_empty() && kind(row.get(k + 1)) != me {
            let (i1, i2) = (row[first.unwrap()].0, row[k].0);
            let anchor = format!("{}.{c}:{v}.{i1}", b.code) + &if i2 != i1 { format!("-{c}:{v}.{i2}") } else { String::new() };
            runs.push(json!({"end": k, "anchor": anchor, "unit": me == "unit"}));
            first = None;
        }
    }
    let words: Vec<Value> = words
        .iter()
        .zip(&row)
        .map(|(w, (_, m))| json!({"i": w.idx, "lead": w.lead, "t": w.text, "trail": w.trail, "m": m}))
        .collect();
    json!({"ref": reference(b, c, v), "words": words, "runs": runs})
}

fn lower_ws(s: &str) -> String {
    s.to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ")
}

pub struct UsesQuery<'a> {
    pub strong: Option<&'a str>,
    pub word: Option<&'a str>,
    pub cat: &'a str,
    pub scope: &'a str,
    pub offset: usize,
    pub limit: usize,
    pub rendering: Option<&'a str>,
}

/// Every place an original-language word (Strong's number) and/or an English word occurs. An occurrence is a
/// Strong's-tagged unit, or an English hit outside any unit of that number: both = the unit contains the English word,
/// s = the unit is rendered some other way, e = the English word translates a different original.
pub fn uses(bible: &Bible, q: &UsesQuery) -> Result<Value> {
    let strong = q.strong.map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty());
    let mut word = q.word.map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
    let rendering = q.rendering.map(lower_ws).filter(|s| !s.is_empty());
    if rendering.is_some() {
        if strong.is_none() {
            return Err(bad("A rendering belongs to a Strong's number."));
        }
        if rendering.as_ref().unwrap().chars().count() > 80 {
            return Err(bad("That rendering is too long."));
        }
        word = None;
    }
    if strong.is_none() && word.is_none() {
        return Err(bad("Give a Strong's number, an English word, or both."));
    }
    if strong.as_deref().is_some_and(|s| !is_strong(s)) {
        return Err(bad("A Strong's number looks like H7065 or G25."));
    }
    if word.as_deref().is_some_and(|w| !is_word(w)) {
        return Err(bad("The English word may contain letters, apostrophes and hyphens only (use Search for patterns)."));
    }
    if !["all", "both", "s", "e"].contains(&q.cat) {
        return Err(bad("Unknown category."));
    }
    // units: (b,c,v,grp) → idx list, in the order the database gives them
    let mut units: Vec<((u32, u32, u32, i64), Vec<i64>, Vec<String>)> = vec![];
    let mut unit_at: HashMap<(u32, u32, u32, i64), usize> = HashMap::new();
    if let Some(s) = &strong {
        let mut stmt = bible.conn().prepare_cached(
            "SELECT book, chapter, verse, idx, grp, text FROM words WHERE strong = ? ORDER BY book, chapter, verse, idx",
        )?;
        let it = stmt.query_map([s], |r| Ok(((r.get(0)?, r.get(1)?, r.get(2)?, r.get(4)?), r.get::<_, i64>(3)?, r.get::<_, String>(5)?)))?;
        for x in it {
            let (k, idx, text) = x?;
            let n = *unit_at.entry(k).or_insert_with(|| {
                units.push((k, vec![], vec![]));
                units.len() - 1
            });
            units[n].1.push(idx);
            units[n].2.push(text);
        }
        if let Some(r) = &rendering {
            units.retain(|u| &u.2.join(" ").to_lowercase() == r);
        }
    }
    let s_words: HashSet<(u32, u32, u32, i64)> = units.iter().flat_map(|(k, idxs, _)| idxs.iter().map(move |i| (k.0, k.1, k.2, *i))).collect();
    let mut e_words: BTreeSet<(u32, u32, u32, i64)> = BTreeSet::new();
    if let Some(w) = &word {
        let mut stmt = bible.conn().prepare_cached("SELECT book, chapter, verse, idx FROM words WHERE text = ? COLLATE NOCASE")?;
        for x in stmt.query_map([w], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))? {
            e_words.insert(x?);
        }
    }
    // (b,c,v, cat, s idx, e idx)
    let mut occ: Vec<(u32, u32, u32, &'static str, Vec<i64>, Vec<i64>)> = vec![];
    for ((b, c, v, _), idxs, _) in &units {
        let hits: Vec<i64> = idxs.iter().copied().filter(|i| e_words.contains(&(*b, *c, *v, *i))).collect();
        occ.push((*b, *c, *v, if hits.is_empty() { "s" } else { "both" }, idxs.clone(), hits));
    }
    for &(b, c, v, i) in e_words.iter().filter(|w| !s_words.contains(w)) {
        occ.push((b, c, v, "e", vec![], vec![i]));
    }
    occ.sort_by_key(|o| (o.0, o.1, o.2, *o.4.first().or(o.5.first()).unwrap()));
    let mut totals = Map::new();
    for k in ["both", "s", "e"] {
        totals.insert(k.into(), json!(occ.iter().filter(|o| o.3 == k).count()));
    }
    let wanted: Vec<_> = occ.iter().filter(|o| q.cat == "all" || o.3 == q.cat).collect();
    let mut by_book = Map::new();
    for o in &wanted {
        let e = by_book.entry(o.0.to_string()).or_insert(json!(0));
        *e = json!(e.as_i64().unwrap() + 1);
    }
    let book = |id: u32| book_by_id(bible, id).unwrap();
    let scoped: Vec<_> = wanted.into_iter().filter(|o| in_scope(book(o.0), q.scope)).collect();
    let mut verses: BTreeMap<Key, HashMap<i64, &'static str>> = BTreeMap::new();
    for (b, c, v, ct, s_idx, e_idx) in &scoped {
        let m = verses.entry((*b, *c, *v)).or_default();
        for i in s_idx {
            m.insert(*i, "s");
        }
        for i in e_idx {
            m.insert(*i, if *ct == "both" { "b" } else { "e" });
        }
    }
    let keys: Vec<Key> = verses.keys().copied().collect();
    let page: Vec<Key> = keys.iter().skip(q.offset).take(q.limit).copied().collect();
    let words = verse_words(bible, &page)?;
    let rows: Vec<Value> = page.iter().map(|k| marked_row(book(k.0), *k, words.get(k).map(|w| &w[..]).unwrap_or(&[]), &verses[k])).collect();
    let mut out = json!({
        "strong": strong, "word": word, "rendering": rendering, "cat": q.cat, "scope": q.scope, "totals": totals,
        "occurrences": scoped.len(), "verses": keys.len(), "by_book": by_book,
        "offset": q.offset, "rows": rows, "more": q.offset + q.limit < keys.len()});
    if let Some(w) = &word {
        if !e_words.iter().any(|e| in_scope(book(e.0), q.scope)) {
            // The exact word is not here ("zeal" in Numbers, which only says "zealous"): name the forms that are.
            out["other_forms"] = forms_in_scope(bible, w, q.scope)?;
        }
    }
    Ok(out)
}

fn forms_in_scope(bible: &Bible, word: &str, scope: &str) -> Result<Value> {
    let f = forms(bible, word)?;
    let others: Vec<String> = f["forms"].as_array().unwrap().iter().filter_map(|x| x["form"].as_str()).filter(|x| *x != word).map(String::from).collect();
    if others.is_empty() {
        return Ok(json!([]));
    }
    let sql = format!("SELECT lower(text) AS w, book, COUNT(*) AS n FROM words WHERE lower(text) IN ({}) GROUP BY lower(text), book", vec!["?"; others.len()].join(","));
    let mut counts: BTreeMap<String, i64> = BTreeMap::new();
    for r in rows(bible, &sql, params_from_iter(&others))? {
        let b = book_by_id(bible, r["book"].as_u64().unwrap() as u32).unwrap();
        if in_scope(b, scope) {
            *counts.entry(r["w"].as_str().unwrap().into()).or_default() += r["n"].as_i64().unwrap();
        }
    }
    let mut v: Vec<(String, i64)> = counts.into_iter().collect();
    v.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    Ok(json!(v.into_iter().map(|(w, n)| json!({"form": w, "n": n})).collect::<Vec<_>>()))
}

// ---- search -------------------------------------------------------------------------------------------------------

/// The terms of a plain search, as typed: each word, or each "quoted phrase".
fn plain_terms(q: &str) -> Result<Vec<String>> {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = RE.get_or_init(|| regex::Regex::new(r#""([^"]+)"|(\S+)"#).unwrap());
    let mut out = vec![];
    for m in re.captures_iter(q) {
        let text = m.get(1).or(m.get(2)).unwrap().as_str().trim_matches('"').trim().to_string();
        if text.split_whitespace().next().is_none() {
            continue;
        }
        if !text.chars().any(|c| c.is_alphanumeric() || c == '_') {
            return Err(bad("Add at least one letter to search for."));
        }
        out.push(text);
    }
    if out.is_empty() {
        return Err(bad("Type a word or two."));
    }
    if out.len() > 12 {
        return Err(bad("That is a lot of words (12 at most)."));
    }
    Ok(out)
}

/// Each word must appear as a whole word; "quoted words" must appear together; a * ends a word with any letters.
fn plain_regexes(terms: &[String], case: bool) -> Vec<fancy_regex::Regex> {
    let word = |c: char| c.is_alphanumeric() || c == '_';
    terms
        .iter()
        .map(|text| {
            let body = text.split_whitespace().map(|p| regex::escape(p).replace(r"\*", r"\w*")).collect::<Vec<_>>().join(r"\s+");
            let lead = if text.chars().next().is_some_and(word) { r"\b" } else { "" };
            let trail = if text.chars().last().is_some_and(word) { r"\b" } else { "" };
            fancy_regex::Regex::new(&format!("{}{lead}{body}{trail}", if case { "" } else { "(?i)" })).unwrap()
        })
        .collect()
}

/// Every verse in memory with an index of the words in it, built the first time a search is made.
pub struct Corpus {
    rows: Vec<(u32, u32, u32, String)>,
    index: HashMap<String, Vec<usize>>,
    tokens: Vec<String>,
}

impl Corpus {
    fn build(bible: &Bible) -> Result<Corpus> {
        let mut stmt = bible.conn().prepare("SELECT book, chapter, verse, text FROM verses ORDER BY book, chapter, verse")?;
        let rows: Vec<(u32, u32, u32, String)> =
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
        let mut index: HashMap<String, Vec<usize>> = HashMap::new();
        for (n, row) in rows.iter().enumerate() {
            let lower = row.3.to_lowercase();
            let toks: HashSet<&str> = word_tokens(&lower).collect();
            for t in toks {
                index.entry(t.to_string()).or_default().push(n);
            }
        }
        let mut tokens: Vec<String> = index.keys().cloned().collect();
        tokens.sort();
        Ok(Corpus { rows, index, tokens })
    }

    fn verses_with(&self, piece: &str) -> Option<HashSet<usize>> {
        if !piece.contains('*') {
            return Some(self.index.get(piece).map(|v| v.iter().copied().collect()).unwrap_or_default());
        }
        if piece.matches('*').count() != 1 || !piece.ends_with('*') || piece.chars().count() < 2 {
            return None;
        }
        let prefix = &piece[..piece.len() - 1];
        let start = self.tokens.partition_point(|t| t.as_str() < prefix);
        let mut found = HashSet::new();
        for t in &self.tokens[start..] {
            if !t.starts_with(prefix) {
                break;
            }
            found.extend(self.index[t].iter().copied());
        }
        Some(found)
    }

    /// The positions of the verses that could match every term (a superset), in order; every verse when no term can be
    /// looked up.
    fn candidates(&self, terms: &[String]) -> Vec<usize> {
        static RE: OnceLock<regex::Regex> = OnceLock::new();
        let re = RE.get_or_init(|| regex::Regex::new(r"[\w*]+").unwrap());
        let mut sets: Vec<HashSet<usize>> = vec![];
        for text in terms {
            let lower = text.to_lowercase();
            for piece in re.find_iter(&lower) {
                if let Some(got) = self.verses_with(piece.as_str()) {
                    sets.push(got);
                }
            }
        }
        if sets.is_empty() {
            return (0..self.rows.len()).collect();
        }
        sets.sort_by_key(|s| s.len());
        let mut keep = sets[0].clone();
        for other in &sets[1..] {
            keep.retain(|x| other.contains(x));
            if keep.is_empty() {
                break;
            }
        }
        let mut v: Vec<usize> = keep.into_iter().collect();
        v.sort();
        v
    }
}

/// `\w+` runs, as Python's re finds them.
fn word_tokens(s: &str) -> impl Iterator<Item = &str> {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    RE.get_or_init(|| regex::Regex::new(r"\w+").unwrap()).find_iter(s).map(|m| m.as_str())
}

static CORPUS: OnceLock<Corpus> = OnceLock::new();

fn corpus(bible: &Bible) -> Result<&'static Corpus> {
    if let Some(c) = CORPUS.get() {
        return Ok(c);
    }
    let c = Corpus::build(bible)?;
    Ok(CORPUS.get_or_init(|| c))
}

/// Spans of every term, merged, as character offsets; empty unless every term occurs in the text.
fn spans(rxs: &[fancy_regex::Regex], text: &str) -> Vec<(usize, usize)> {
    let mut found = vec![];
    for rx in rxs {
        let ms: Vec<(usize, usize)> = rx.find_iter(text).filter_map(|m| m.ok()).filter(|m| m.end() > m.start()).map(|m| (m.start(), m.end())).collect();
        if ms.is_empty() {
            return vec![];
        }
        found.extend(ms);
    }
    found.sort();
    let mut merged: Vec<(usize, usize)> = vec![found[0]];
    for (s, e) in found.into_iter().skip(1) {
        let last = merged.last_mut().unwrap();
        if s <= last.1 {
            last.1 = last.1.max(e);
        } else {
            merged.push((s, e));
        }
    }
    // byte offsets → character offsets, as Python counts them
    let ch = |b: usize| text[..b].chars().count();
    merged.into_iter().map(|(s, e)| (ch(s), ch(e))).collect()
}

pub struct SearchQuery<'a> {
    pub q: &'a str,
    pub case: bool,
    pub scope: &'a str,
    pub offset: usize,
    pub limit: usize,
    pub regex: bool,
}

/// Search KJV verse text: plain by default; a regular expression with regex=true or between slashes.
pub fn search(bible: &Bible, sq: &SearchQuery) -> Result<Value> {
    let mut q = sq.q.trim().to_string();
    let mut regex = sq.regex;
    if q.is_empty() {
        return Err(bad("Type a word or two."));
    }
    if q.chars().count() > 200 {
        return Err(bad("That is too long (200 characters at most)."));
    }
    if q.chars().count() > 2 && q.starts_with('/') && q.ends_with('/') {
        q = q[1..q.len() - 1].to_string();
        regex = true;
    }
    let (rxs, terms) = if regex {
        let rx = fancy_regex::Regex::new(&format!("{}{q}", if sq.case { "" } else { "(?i)" })).map_err(|e| bad(format!("Not a valid pattern: {e}")))?;
        if rx.is_match("").unwrap_or(false) {
            return Err(bad("That pattern can match nothing, so it would match everywhere."));
        }
        (vec![rx], None)
    } else {
        let terms = plain_terms(&q)?;
        (plain_regexes(&terms, sq.case), Some(terms))
    };
    let corpus = corpus(bible)?;
    let wanted: Vec<usize> = match &terms {
        Some(t) => corpus.candidates(t),
        None => (0..corpus.rows.len()).collect(),
    };
    let mut hits = vec![];
    let mut by_book = Map::new();
    for n in wanted {
        let (b, c, v, text) = &corpus.rows[n];
        let s = spans(&rxs, text);
        if !s.is_empty() {
            let e = by_book.entry(b.to_string()).or_insert(json!(0));
            *e = json!(e.as_i64().unwrap() + 1);
            hits.push((*b, *c, *v, text, s));
        }
    }
    let scoped: Vec<_> = hits.into_iter().filter(|h| in_scope(book_by_id(bible, h.0).unwrap(), sq.scope)).collect();
    let matches: usize = scoped.iter().map(|h| h.4.len()).sum();
    let rows: Vec<Value> = scoped
        .iter()
        .skip(sq.offset)
        .take(sq.limit)
        .map(|h| json!({"ref": reference(book_by_id(bible, h.0).unwrap(), h.1, h.2), "text": h.3, "spans": h.4.iter().map(|s| json!([s.0, s.1])).collect::<Vec<_>>()}))
        .collect();
    Ok(json!({"q": q, "case": sq.case, "regex": regex, "scope": sq.scope, "by_book": by_book, "verses": scoped.len(),
        "matches": matches, "offset": sq.offset, "rows": rows, "more": sq.offset + sq.limit < scoped.len()}))
}

// ---- BDB, lexiconc, near ------------------------------------------------------------------------------------------

pub fn bdb(bible: &Bible, strong: &str) -> Result<Value> {
    let strong = strong.trim().to_uppercase();
    if !is_strong(&strong) {
        return Err(bad("Give a Strong's number like H7065."));
    }
    if strong.starts_with('G') {
        return Err(bad(format!("BDB is a Hebrew and Aramaic lexicon. For {strong} try: lex strongs {strong}")));
    }
    let Some(lex) = rows(bible, "SELECT lemma, translit FROM lexicon WHERE strong = ?", [&strong])?.into_iter().next() else {
        return Err(bad(format!("There is no entry numbered {strong}.")));
    };
    let entries = rows(bible, "SELECT entry_id, headword, text, status FROM bdb WHERE strong = ? ORDER BY seq", [&strong])?;
    if entries.is_empty() {
        return Err(bad(format!("No BDB entry is linked to {strong} in the index file.")));
    }
    Ok(json!({"strong": strong, "lemma": lex["lemma"], "translit": lex["translit"], "entries": entries}))
}

/// Original-language words whose lexicon definition or KJV-usage line contains an English word (word* for endings).
pub fn lexiconc(bible: &Bible, q: &str, limit: usize) -> Result<Value> {
    let q = q.trim().to_lowercase();
    let prefix = q.ends_with('*');
    let word = q.trim_end_matches('*');
    if !is_word(word) {
        return Err(bad("Give one English word, like zeal (or zeal* for endings)."));
    }
    let rx = regex::Regex::new(&format!(r"(?i)\b{}{}", regex::escape(word), if prefix { r"\w*" } else { r"\b" })).unwrap();
    let like = format!("%{word}%");
    let mut hits = vec![];
    for mut r in rows(bible, "SELECT strong, lang, lemma, translit, definition, usage FROM lexicon WHERE definition LIKE ? OR usage LIKE ?", [&like, &like])? {
        let in_def = rx.is_match(r["definition"].as_str().unwrap_or(""));
        let in_use = rx.is_match(r["usage"].as_str().unwrap_or(""));
        if in_def || in_use {
            r.insert("in_def".into(), json!(in_def));
            r.insert("in_usage".into(), json!(in_use));
            hits.push(r);
        }
    }
    let mut counts: HashMap<String, i64> = HashMap::new();
    if !hits.is_empty() {
        let ids: Vec<String> = hits.iter().map(|h| h["strong"].as_str().unwrap().to_string()).collect();
        for chunk in ids.chunks(500) {
            let sql = format!(
                "SELECT strong, COUNT(*) AS n FROM (SELECT strong FROM words WHERE strong IN ({}) GROUP BY strong, book, chapter, verse, grp) GROUP BY strong",
                vec!["?"; chunk.len()].join(",")
            );
            for r in rows(bible, &sql, params_from_iter(chunk))? {
                counts.insert(r["strong"].as_str().unwrap().into(), r["n"].as_i64().unwrap());
            }
        }
    }
    for h in &mut hits {
        let n = counts.get(h["strong"].as_str().unwrap()).copied().unwrap_or(0);
        h.insert("n".into(), json!(n));
        h.shift_remove("usage");
    }
    hits.sort_by(|a, b| b["n"].as_i64().cmp(&a["n"].as_i64()).then(a["strong"].as_str().cmp(&b["strong"].as_str())));
    let total = hits.len();
    hits.truncate(limit);
    Ok(json!({"q": q, "total": total, "entries": hits}))
}

static OFFSETS: OnceLock<HashMap<Key, i64>> = OnceLock::new();

/// {(book, chapter, verse): how many words of that book come before the verse}.
fn word_offsets(bible: &Bible) -> Result<&'static HashMap<Key, i64>> {
    if let Some(o) = OFFSETS.get() {
        return Ok(o);
    }
    let mut offs = HashMap::new();
    let (mut book, mut total) = (0u32, 0i64);
    let mut stmt = bible.conn().prepare("SELECT book, chapter, verse, COUNT(*) AS n FROM words GROUP BY book, chapter, verse ORDER BY book, chapter, verse")?;
    for x in stmt.query_map([], |r| Ok((r.get::<_, u32>(0)?, r.get::<_, u32>(1)?, r.get::<_, u32>(2)?, r.get::<_, i64>(3)?)))? {
        let (b, c, v, n) = x?;
        if b != book {
            (book, total) = (b, 0);
        }
        offs.insert((b, c, v), total);
        total += n;
    }
    Ok(OFFSETS.get_or_init(|| offs))
}

fn term_words(bible: &Bible, term: &str) -> Result<Vec<(u32, u32, u32, i64)>> {
    let conn = bible.conn();
    let collect = |sql: &str, p: Vec<String>| -> Result<Vec<(u32, u32, u32, i64)>> {
        let mut stmt = conn.prepare_cached(sql)?;
        let v = stmt.query_map(params_from_iter(p), |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(v)
    };
    if is_strong(&term.to_uppercase()) {
        return collect("SELECT book, chapter, verse, idx FROM words WHERE strong = ?", vec![term.to_uppercase()]);
    }
    if let Some(p) = term.strip_suffix('*') {
        let p = p.to_lowercase();
        let mut hi: Vec<char> = p.chars().collect();
        let last = hi.pop().unwrap();
        let hi: String = hi.into_iter().chain(std::iter::once(char::from_u32(last as u32 + 1).unwrap())).collect();
        return collect("SELECT book, chapter, verse, idx FROM words WHERE text COLLATE NOCASE >= ? AND text COLLATE NOCASE < ?", vec![p, hi]);
    }
    collect("SELECT book, chapter, verse, idx FROM words WHERE text = ? COLLATE NOCASE", vec![term.to_string()])
}

/// Verses where one term comes within `within` words of the other (same book, across verse boundaries). Words of the
/// first term are marked s, of the second e (b when both).
pub fn near(bible: &Bible, a: &str, b: &str, within: i64, scope: &str, offset: usize, limit: usize) -> Result<Value> {
    let (a, b) = (a.trim(), b.trim());
    for t in [a, b] {
        let star = t.ends_with('*') && t.chars().count() > 2 && is_word(&t[..t.len() - 1]);
        if !(is_strong(&t.to_uppercase()) || is_word(t) || star) {
            return Err(bad("Near takes two terms, each an English word (zeal* for its endings) or a Strong's number (like H7065)."));
        }
    }
    if !(1..=50).contains(&within) {
        return Err(bad("Within must be between 1 and 50 words."));
    }
    let offs = word_offsets(bible)?;
    let positions = |term: &str| -> Result<BTreeMap<(u32, i64), (u32, u32, u32, i64)>> {
        Ok(term_words(bible, term)?.into_iter().map(|w| ((w.0, offs[&(w.0, w.1, w.2)] + w.3), w)).collect())
    };
    let (pa, pb) = (positions(a)?, positions(b)?);
    let sb: Vec<(u32, i64)> = pb.keys().copied().collect();
    // Verses in the order they are first marked (by_book counts them in that order, as the Python app's dict does).
    let mut mark_of: HashMap<Key, HashMap<i64, &'static str>> = HashMap::new();
    let mut order: Vec<Key> = vec![];
    let mut pairs = 0;
    for key in pa.keys() {
        let lo = sb.partition_point(|x| *x < (key.0, key.1 - within));
        let hi = sb.partition_point(|x| *x <= (key.0, key.1 + within));
        let near_b: Vec<&(u32, i64)> = sb[lo..hi].iter().filter(|k| *k != key).collect();
        if near_b.is_empty() {
            continue;
        }
        pairs += 1;
        let w = pa[key];
        let mut note = |k: Key, i: i64, f: &dyn Fn(Option<&'static str>) -> &'static str| {
            if !mark_of.contains_key(&k) {
                order.push(k);
            }
            let m = mark_of.entry(k).or_default();
            let was = m.get(&i).copied();
            m.insert(i, f(was));
        };
        note((w.0, w.1, w.2), w.3, &|_| "s");
        for k in near_b {
            let v = pb[k];
            note((v.0, v.1, v.2), v.3, &|was| if was == Some("s") { "b" } else { "e" });
        }
    }
    let mut by_book = Map::new();
    for k in &order {
        let e = by_book.entry(k.0.to_string()).or_insert(json!(0));
        *e = json!(e.as_i64().unwrap() + 1);
    }
    let book = |id: u32| book_by_id(bible, id).unwrap();
    let mut keys: Vec<Key> = order.iter().copied().filter(|k| in_scope(book(k.0), scope)).collect();
    keys.sort();
    let page: Vec<Key> = keys.iter().skip(offset).take(limit).copied().collect();
    let words = verse_words(bible, &page)?;
    let rows: Vec<Value> = page.iter().map(|k| marked_row(book(k.0), *k, words.get(k).map(|w| &w[..]).unwrap_or(&[]), &mark_of[k])).collect();
    Ok(json!({"a": a, "b": b, "within": within, "scope": scope, "pairs": pairs, "verses": keys.len(), "by_book": by_book,
        "offset": offset, "rows": rows, "more": offset + limit < keys.len()}))
}

// ---- forms, known, define -----------------------------------------------------------------------------------------

const E_DROP_ENDINGS: &[&str] = &["ing", "ings", "ingly", "ed", "er", "ers"];

pub fn known_word(bible: &Bible, word: &str) -> Result<Value> {
    let word = word.trim();
    if !is_word(word) {
        return Ok(json!({"word": word, "known": false}));
    }
    let hit: Option<i64> = bible.conn().query_row("SELECT 1 FROM words WHERE text = ? COLLATE NOCASE LIMIT 1", [word], |r| r.get(0)).optional()?;
    Ok(json!({"word": word, "known": hit.is_some()}))
}

/// The English forms in the KJV that begin with this word, with counts; a word ending in e also finds -ing/-ed/-er.
pub fn forms(bible: &Bible, word: &str) -> Result<Value> {
    let word = word.trim().to_lowercase();
    if !is_word(&word) {
        return Err(bad("Give one English word, like zeal."));
    }
    let mut prefixes = vec![word.clone()];
    if word.ends_with('e') && word.chars().count() > 3 {
        prefixes.push(word[..word.len() - 1].to_string());
    }
    let mut counts: Vec<(String, i64)> = vec![];
    for p in &prefixes {
        let mut cs: Vec<char> = p.chars().collect();
        let last = cs.pop().unwrap();
        let hi: String = cs.into_iter().chain(std::iter::once(char::from_u32(last as u32 + 1).unwrap())).collect();
        for r in rows(bible, "SELECT lower(text) AS w, COUNT(*) AS n FROM words WHERE text COLLATE NOCASE >= ? AND text COLLATE NOCASE < ? GROUP BY lower(text)", [p, &hi])? {
            let w = r["w"].as_str().unwrap().to_string();
            let tail: String = w.chars().skip(p.chars().count()).collect();
            if *p == word || w.starts_with(&word) || E_DROP_ENDINGS.contains(&tail.as_str()) {
                let n = r["n"].as_i64().unwrap();
                match counts.iter_mut().find(|c| c.0 == w) {
                    Some(c) => c.1 = n,
                    None => counts.push((w, n)),
                }
            }
        }
    }
    let total: i64 = counts.iter().map(|c| c.1).sum();
    counts.sort_by(|a, b| (a.0 != word).cmp(&(b.0 != word)).then(b.1.cmp(&a.1)).then(a.0.cmp(&b.0)));
    Ok(json!({"word": word, "forms": counts.into_iter().map(|(w, n)| json!({"form": w, "n": n})).collect::<Vec<_>>(), "total": total}))
}

/// Lowercase letters only, accents removed: agápē → agape, qânâʼ → qana.
pub fn plain(s: &str) -> String {
    use unicode_normalization::UnicodeNormalization;
    s.nfd()
        .filter(|c| c.is_alphanumeric() && !unicode_normalization::char::is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase()
}

/// Which original-language words does this stand for? A Strong's number, an English word as the KJV uses it, or a
/// transliteration / original-script spelling.
pub fn define(bible: &Bible, q: &str) -> Result<Value> {
    let q = q.trim();
    if q.is_empty() || q.chars().count() > 60 {
        return Err(bad("Give a word to define."));
    }
    let mut out = json!({"query": q, "strong": null, "english": [], "original": []});
    if is_strong(&q.to_uppercase()) {
        let up = q.to_uppercase();
        let hit: Option<i64> = bible.conn().query_row("SELECT 1 FROM lexicon WHERE strong = ?", [&up], |r| r.get(0)).optional()?;
        if hit.is_none() {
            return Err(bad(format!("There is no entry numbered {up}.")));
        }
        out["strong"] = json!(up);
        return Ok(out);
    }
    let mut seen = HashSet::new();
    if is_word(q) {
        let found = rows(bible, "SELECT strong, COUNT(*) AS n FROM (SELECT strong FROM words WHERE text = ? COLLATE NOCASE AND strong IS NOT NULL \
                                  GROUP BY strong, book, chapter, verse, grp) GROUP BY strong ORDER BY n DESC, strong LIMIT 8", [q])?;
        let ids: Vec<String> = found.iter().map(|r| r["strong"].as_str().unwrap().to_string()).collect();
        let brief = strongs_brief(bible, &ids)?;
        let english: Vec<Value> = found
            .iter()
            .filter_map(|r| {
                let mut m = brief.get(r["strong"].as_str().unwrap())?.as_object()?.clone();
                m.insert("n".into(), r["n"].clone());
                Some(Value::Object(m))
            })
            .collect();
        seen = english.iter().map(|e| e["strong"].as_str().unwrap().to_string()).collect();
        out["english"] = json!(english);
    }
    let key = plain(q);
    if !key.is_empty() {
        bible.conn().create_scalar_function("plainx", 1, rusqlite::functions::FunctionFlags::SQLITE_UTF8 | rusqlite::functions::FunctionFlags::SQLITE_DETERMINISTIC, |ctx| {
            let s: Option<String> = ctx.get(0)?;
            Ok(plain(&s.unwrap_or_default()))
        })?;
        let found = rows(bible, "SELECT strong, lang, lemma, translit, definition FROM lexicon WHERE plainx(translit) = ?1 OR plainx(lemma) = ?1 \
                                  OR (length(?1) >= 4 AND plainx(translit) LIKE ?1 || '%') ORDER BY (plainx(translit) = ?1) DESC, strong LIMIT 12", [&key])?;
        out["original"] = json!(found.into_iter().filter(|r| !seen.contains(r["strong"].as_str().unwrap())).collect::<Vec<_>>());
    }
    Ok(out)
}

// ---- text, interlinear ----------------------------------------------------------------------------------------------

/// Verse-by-verse text of one chapter in any version (the KJV from its verses, others from verse_texts).
pub fn text(bible: &Bible, version: &str, book: u32, ch: u32) -> Result<Option<Value>> {
    let version = if version.is_empty() { "KJV".to_string() } else { version.to_uppercase() };
    let Some(v) = rows(bible, "SELECT id, name FROM versions WHERE id = ?", [&version])?.into_iter().next() else {
        return Err(bad(format!("No such version: {}.", version.chars().take(10).collect::<String>())));
    };
    let Some(b) = book_by_id(bible, book) else { return Ok(None) };
    if ch < 1 || ch > b.chapters {
        return Ok(None);
    }
    let verses = if version == "KJV" {
        rows(bible, "SELECT verse AS v, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse", params![book, ch])?
    } else {
        rows(bible, "SELECT verse AS v, text FROM verse_texts WHERE version = ? AND book = ? AND chapter = ? ORDER BY verse", params![version, book, ch])?
    };
    Ok(Some(json!({"version": version, "name": v["name"], "book": {"id": b.id, "code": b.code, "name": b.name, "chapters": b.chapters},
        "chapter": ch, "verses": verses})))
}

/// 'Function=Noun; Case=Nominative; Number=Singular' → 'Noun · Nominative · Singular' (a parenthesis is kept whole).
fn morph_text(meaning: &str) -> String {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = RE.get_or_init(|| regex::Regex::new(r"^\s*[A-Za-z ]+=").unwrap());
    let (mut parts, mut depth, mut cur) = (vec![], 0i32, String::new());
    for ch in meaning.chars() {
        depth += (ch == '(') as i32 - (ch == ')') as i32;
        if ch == ';' && depth == 0 {
            parts.push(std::mem::take(&mut cur));
        } else {
            cur.push(ch);
        }
    }
    parts.push(cur);
    parts.iter().filter(|p| !p.trim().is_empty()).map(|p| re.replace(p, "").trim().to_string()).collect::<Vec<_>>().join(" · ")
}

fn morph_codes(lang: &str, morph: &str) -> Vec<String> {
    if morph.is_empty() {
        return vec![];
    }
    if lang == "grk" {
        return morph.split('+').map(String::from).collect();
    }
    let pieces: Vec<&str> = morph.split('/').collect();
    let first = pieces[0];
    let letter: String = first.chars().take(1).collect();
    std::iter::once(first.to_string()).chain(pieces[1..].iter().map(|p| format!("{letter}{p}"))).collect()
}

/// The original-language words of a stretch of verses, each with its KJV text, in batches of `limit` verses.
pub fn interlinear(bible: &Bible, book: u32, c1: u32, v1: i64, c2: Option<u32>, v2: i64, offset: i64, limit: usize) -> Result<Value> {
    let Some(b) = book_by_id(bible, book) else { return Err(bad("No such book.")) };
    let c2 = c2.unwrap_or(c1);
    if !(1..=b.chapters).contains(&c1) || !(1..=b.chapters).contains(&c2) || c2 < c1 {
        return Err(bad(format!("{} has {} chapters.", b.name, b.chapters)));
    }
    let lo = (c1 as i64, v1.max(0));
    let hi = (c2 as i64, if v2 > 0 { v2 } else { 1_000_000 });
    let mut stmt = bible.conn().prepare_cached("SELECT DISTINCT chapter, verse FROM interlinear WHERE book = ? ORDER BY chapter, verse")?;
    let keys: Vec<(i64, i64)> = stmt
        .query_map([book], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?
        .into_iter()
        .filter(|k| lo <= *k && *k <= hi)
        .collect();
    let off = offset.max(0) as usize;
    let page: Vec<(i64, i64)> = keys.iter().skip(off).take(limit).copied().collect();
    let lang = if b.testament == "OT" { "heb" } else { "grk" };
    let mut out = json!({"book": {"id": b.id, "code": b.code, "name": b.name}, "lang": lang, "verses": [],
        "total": keys.len(), "offset": off, "more": off + limit < keys.len()});
    let (Some(first), Some(last)) = (page.first(), page.last()) else { return Ok(out) };
    let words = rows(
        bible,
        "SELECT i.chapter, i.verse, i.seq, i.original, i.translit, i.strong, i.strongs, i.morph, i.gloss, \
         COALESCE(NULLIF(i.lemma, ''), l.lemma, '') AS lemma FROM interlinear i LEFT JOIN lexicon l ON l.strong = i.strong \
         WHERE i.book = ? AND (i.chapter, i.verse) BETWEEN (?, ?) AND (?, ?) ORDER BY i.chapter, i.verse, i.seq",
        params![book, first.0, first.1, last.0, last.1],
    )?;
    let codes: BTreeSet<String> = words.iter().flat_map(|r| morph_codes(lang, r["morph"].as_str().unwrap_or(""))).collect();
    let mut meaning: HashMap<String, String> = HashMap::new();
    if !codes.is_empty() {
        let list: Vec<&String> = codes.iter().collect();
        for chunk in list.chunks(500) {
            let sql = format!("SELECT code, meaning FROM morph_codes WHERE code IN ({})", vec!["?"; chunk.len()].join(","));
            for r in rows(bible, &sql, params_from_iter(chunk))? {
                meaning.insert(r["code"].as_str().unwrap().into(), morph_text(r["meaning"].as_str().unwrap_or("")));
            }
        }
    }
    let kjv: HashMap<(i64, i64), String> = rows(bible, "SELECT chapter, verse, text FROM verses WHERE book = ? AND (chapter, verse) BETWEEN (?, ?) AND (?, ?)",
        params![book, first.0, first.1, last.0, last.1])?
        .into_iter()
        .map(|r| ((r["chapter"].as_i64().unwrap(), r["verse"].as_i64().unwrap()), r["text"].as_str().unwrap().to_string()))
        .collect();
    let titles: HashMap<i64, String> = rows(bible, "SELECT chapter, title FROM chapter_titles WHERE book = ?", [book])?
        .into_iter()
        .map(|r| (r["chapter"].as_i64().unwrap(), r["title"].as_str().unwrap().to_string()))
        .collect();
    let mut by_verse: HashMap<(i64, i64), Vec<Value>> = HashMap::new();
    for r in &words {
        let morph = r["morph"].as_str().unwrap_or("");
        let parse: Vec<Value> =
            morph_codes(lang, morph).into_iter().map(|c| json!({"text": meaning.get(&c).cloned().unwrap_or_default(), "code": c})).collect();
        let parse: Vec<Value> = parse.into_iter().map(|v| json!({"code": v["code"], "text": v["text"]})).collect();
        by_verse.entry((r["chapter"].as_i64().unwrap(), r["verse"].as_i64().unwrap())).or_default().push(json!({
            "original": r["original"], "translit": r["translit"], "strong": r["strong"], "lemma": r["lemma"],
            "gloss": r["gloss"], "morph": r["morph"], "parse": parse}));
    }
    let verses: Vec<Value> = page
        .iter()
        .map(|(ch, v)| {
            let text = if *v == 0 { titles.get(ch).cloned().unwrap_or_default() } else { kjv.get(&(*ch, *v)).cloned().unwrap_or_default() };
            json!({"c": ch, "v": v, "text": text, "words": by_verse.remove(&(*ch, *v)).unwrap_or_default()})
        })
        .collect();
    out["verses"] = json!(verses);
    Ok(out)
}

/// What search did before the index: every verse through the patterns, in Bible order, with the spans. Kept as the
/// reference the index is tested against.
#[doc(hidden)]
pub fn search_every_verse(bible: &Bible, q: &str, case: bool, scope: &str) -> Result<(Vec<(u32, u32, u32, Vec<(usize, usize)>)>, Map<String, Value>)> {
    let rxs = plain_regexes(&plain_terms(q.trim())?, case);
    let mut stmt = bible.conn().prepare("SELECT book, chapter, verse, text FROM verses ORDER BY book, chapter, verse")?;
    let all: Vec<(u32, u32, u32, String)> = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<rusqlite::Result<_>>()?;
    let (mut rows, mut by_book) = (vec![], Map::new());
    for (b, c, v, text) in all {
        let sp = spans(&rxs, &text);
        if !sp.is_empty() {
            let e = by_book.entry(b.to_string()).or_insert(json!(0));
            *e = json!(e.as_i64().unwrap() + 1);
            rows.push((b, c, v, sp));
        }
    }
    rows.retain(|r| in_scope(book_by_id(bible, r.0).unwrap(), scope));
    Ok((rows, by_book))
}
