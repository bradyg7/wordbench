//! A page's candidates, in the order of the page: the references the person named (written or spoken) and the words that
//! are a verse's words, each with the place Accept would put its scripture block (TG-4) and an id that does not depend on
//! where in the page it is (TG-10). Reads only.

use super::quote::{self, Matcher, NoteWord, Outcome};
use super::spoken::find_said;
use super::types::*;
use crate::bible::Bible;
use crate::pages::{self, scripture_fence};
use crate::places::{parse_span, span_label, Span};
use crate::store::Store;
use crate::{Error, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};

pub struct Options {
    /// `named`, `quoted` or `all`.
    pub tier: String,
    pub min_words: usize,
    /// `KJV` or `YLT`.
    pub version: String,
    /// Candidate ids the person skipped on this page.
    pub skipped: Vec<String>,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            tier: "all".into(),
            min_words: 6,
            version: "KJV".into(),
            skipped: vec![],
        }
    }
}

pub fn digest(text: &str) -> String {
    Sha256::digest(text.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn chars_in(text: &str, a: usize, b: usize) -> String {
    text.chars().skip(a).take(b.saturating_sub(a)).collect()
}

/// Kinds of block the words are read from.
pub fn searched(kind: &str) -> bool {
    matches!(
        kind,
        "paragraph" | "heading" | "item" | "numbered" | "todo" | "quote"
    )
}

/// The verses a span covers, as a range of (chapter, verse) with 0 and the end of the chapter made explicit.
fn bounds(bible: &Bible, s: &Span) -> Result<((u32, u32), (u32, u32))> {
    let v1 = if s.v1 == 0 { 1 } else { s.v1 };
    let v2 = if s.v2 == 0 {
        bible.last_verse(&s.book.code, s.c2)?
    } else {
        s.v2
    };
    Ok(((s.c1, v1), (s.c2, v2)))
}

/// A reference read from the person's words, only if it is a verse (or chapter) the Bible has.
fn real(bible: &Bible, place: &str) -> Option<(Span, usize)> {
    let s = parse_span(place, bible.books()).ok()?;
    let (a, b) = bounds(bible, &s).ok()?;
    if s.v1 != 0 && bible.last_verse(&s.book.code, s.c1).ok()? < s.v1 {
        return None;
    }
    let n = bible.verses(&s.book.code, a.0, a.1, b.0, b.1).ok()?.len();
    (n > 0).then_some((s, n))
}

/// A span's text, verbatim, in a version (empty for more than 30 verses).
pub fn span_text(bible: &Bible, s: &Span, version: &str) -> String {
    let Ok(((c1, v1), (c2, v2))) = bounds(bible, s) else {
        return String::new();
    };
    let id = s.book.id;
    let version = version.to_uppercase();
    let (sql, kjv) = if version == "KJV" {
        ("SELECT text FROM verses WHERE book = ?1 AND (chapter, verse) >= (?2, ?3) AND (chapter, verse) <= (?4, ?5) ORDER BY chapter, verse", true)
    } else {
        ("SELECT text FROM verse_texts WHERE book = ?1 AND (chapter, verse) >= (?2, ?3) AND (chapter, verse) <= (?4, ?5) AND version = ?6 ORDER BY chapter, verse", false)
    };
    let Ok(mut stmt) = bible.conn().prepare(sql) else {
        return String::new();
    };
    let rows: Vec<String> = if kjv {
        stmt.query_map(rusqlite::params![id, c1, v1, c2, v2], |r| r.get(0))
            .map(|r| r.flatten().collect())
            .unwrap_or_default()
    } else {
        stmt.query_map(rusqlite::params![id, c1, v1, c2, v2, version], |r| r.get(0))
            .map(|r| r.flatten().collect())
            .unwrap_or_default()
    };
    if rows.len() > 30 {
        return String::new();
    }
    rows.join(" ")
}

/// Where the scripture block goes in a block: the sentence end after the words (within 40 words), else the words' end.
/// None: nothing is split (a list item, a quote, a heading, or the sentence ends the block).
pub fn split_for(kind: &str, block: &str, end: usize) -> Option<usize> {
    if kind != "paragraph" {
        return None;
    }
    let cs: Vec<char> = block.chars().collect();
    let rest_blank = |p: usize| cs[p.min(cs.len())..].iter().all(|c| c.is_whitespace());
    let mut words = 0;
    let mut in_word = false;
    let mut k = end;
    while k < cs.len() {
        let c = cs[k];
        if c.is_whitespace() {
            in_word = false;
        } else if !in_word {
            in_word = true;
            words += 1;
            if words > 40 {
                break;
            }
        }
        if matches!(c, '.' | '?' | '!')
            && cs.get(k + 1).is_none_or(|n| {
                n.is_whitespace() || matches!(n, '"' | '\'' | ')' | ']' | '”' | '’')
            })
        {
            let mut p = k + 1;
            while cs
                .get(p)
                .is_some_and(|n| matches!(n, '"' | '\'' | ')' | ']' | '”' | '’'))
            {
                p += 1;
            }
            return if rest_blank(p) { None } else { Some(p) };
        }
        k += 1;
    }
    if rest_blank(end) {
        None
    } else {
        Some(end)
    }
}

fn norm_words(text: &str) -> String {
    quote::words_of(text)
        .into_iter()
        .map(|w| w.w)
        .collect::<Vec<_>>()
        .join(" ")
}

struct Raw {
    tier: &'static str,
    span: Span,
    verses: usize,
    block: usize,
    range: Range,
    evidence: Evidence,
    group: usize,
}

/// The page's text, as `wb page blocks` reads it.
pub struct Read {
    pub id: String,
    pub text: String,
    pub blocks: Vec<(usize, String, String)>,
}

pub fn read(store: &Store, page: &str) -> Result<Read> {
    let (id, text, _) = pages::text_of(store, page)?;
    let v = pages::blocks(store, &id)?;
    let blocks = v["blocks"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|b| {
                    (
                        b["n"].as_u64().unwrap_or(0) as usize,
                        b["kind"].as_str().unwrap_or("").to_string(),
                        b["text"].as_str().unwrap_or("").to_string(),
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(Read { id, text, blocks })
}

/// The scripture blocks already in the page, as verse bounds per book code.
fn fenced(bible: &Bible, r: &Read) -> Vec<(String, (u32, u32), (u32, u32))> {
    let mut out = vec![];
    for (_, kind, text) in &r.blocks {
        if kind != "fence" {
            continue;
        }
        let Some(f) = scripture_fence(text) else {
            continue;
        };
        if let Ok(s) = parse_span(&f.reference, bible.books()) {
            if let Ok((a, b)) = bounds(bible, &s) {
                out.push((s.book.code.clone(), a, b));
            }
        }
    }
    out
}

pub fn run(bible: &Bible, store: &Store, page: &str, opt: &Options) -> Result<Report> {
    let r = read(store, page)?;
    let version = opt.version.to_uppercase();
    if version != "KJV" && version != "YLT" {
        return Err(Error("--version is kjv or ylt.".into()));
    }
    let mut raws: Vec<Raw> = vec![];
    let mut group = 0usize;
    let mut many: Vec<Many> = vec![];
    let mut word_count = 0;
    let note_blocks: Vec<(usize, &String)> = r
        .blocks
        .iter()
        .filter(|(_, k, _)| searched(k))
        .map(|(n, _, t)| (*n, t))
        .collect();
    let words: Vec<Vec<NoteWord>> = note_blocks
        .iter()
        .map(|(_, t)| quote::words_of(t))
        .collect();
    word_count += words.iter().map(Vec::len).sum::<usize>();

    if opt.tier != "quoted" {
        for (n, t) in &note_blocks {
            let mut by_range: Vec<((usize, usize), usize)> = vec![];
            for s in find_said(t, bible.books(), true) {
                let Some((span, count)) = real(bible, &s.place) else {
                    continue;
                };
                let grp = match by_range.iter().find(|(r, _)| *r == (s.start, s.end)) {
                    Some((_, g)) => *g,
                    None => {
                        group += 1;
                        by_range.push(((s.start, s.end), group));
                        group
                    }
                };
                raws.push(Raw {
                    tier: "named",
                    span,
                    verses: count,
                    block: *n,
                    range: Range {
                        start: s.start,
                        end: s.end,
                    },
                    evidence: Evidence {
                        kind: if s.spoken { "spoken" } else { "written" }.into(),
                        matched: None,
                        of: None,
                        words: vec![],
                    },
                    group: grp,
                });
            }
        }
    }
    if opt.tier != "named" && !words.iter().all(Vec::is_empty) {
        let verses = quote::load_verses(bible, &version)?;
        let m = Matcher::new(&verses, &words, opt.min_words);
        for ((n, t), ws) in note_blocks.iter().zip(&words) {
            let chains = m.chains(ws);
            for o in quote::group(&verses, chains) {
                let (chs, kind) = match &o {
                    Outcome::Passage(c) => (c, 0),
                    Outcome::Alike(c) => (c, 1),
                    Outcome::Many(c) => (c, 2),
                };
                let first = chs.iter().map(|c| c.first).min().unwrap();
                let last = chs.iter().map(|c| c.last).max().unwrap();
                let range = Range {
                    start: ws[first].s,
                    end: ws[last].e,
                };
                if kind == 2 {
                    many.push(Many {
                        words: chars_in(t, range.start, range.end),
                        verses: chs.len(),
                        block: *n,
                        range,
                    });
                    continue;
                }
                if kind == 1 {
                    group += 1;
                }
                let sets: Vec<&[quote::Chain]> = if kind == 1 {
                    chs.iter().map(std::slice::from_ref).collect()
                } else {
                    vec![&chs[..]]
                };
                for set in sets {
                    let (a, b) = (&verses[set[0].verse], &verses[set.last().unwrap().verse]);
                    let book = bible
                        .books()
                        .iter()
                        .find(|x| x.id == a.book)
                        .cloned()
                        .ok_or_else(|| Error("a verse of no book".into()))?;
                    let span = Span {
                        book,
                        c1: a.chapter,
                        v1: a.verse,
                        c2: b.chapter,
                        v2: b.verse,
                    };
                    let matched: usize = set.iter().map(|c| c.matched).sum();
                    let of: usize = set.iter().map(|c| verses[c.verse].words.len()).sum();
                    let note_words: Vec<String> = set
                        .iter()
                        .flat_map(|c| c.note_words.iter().map(|i| ws[*i].w.clone()))
                        .collect();
                    let (f, l) = (
                        set.iter().map(|c| c.first).min().unwrap(),
                        set.iter().map(|c| c.last).max().unwrap(),
                    );
                    raws.push(Raw {
                        tier: "quoted",
                        span,
                        verses: set.len(),
                        block: *n,
                        range: Range {
                            start: ws[f].s,
                            end: ws[l].e,
                        },
                        evidence: Evidence {
                            kind: "quote".into(),
                            matched: Some(matched),
                            of: Some(of),
                            words: note_words,
                        },
                        group: if kind == 1 { group } else { 0 },
                    });
                }
            }
        }
    }
    raws.sort_by_key(|x| (x.block, x.range.start, x.tier == "quoted", x.range.end));
    // ids: tier, reference, the normalized words, and which occurrence of those words it is
    let fences = fenced(bible, &r);
    let text_of_block = |n: usize| {
        r.blocks
            .iter()
            .find(|b| b.0 == n)
            .map(|b| (b.1.clone(), b.2.clone()))
            .unwrap_or_default()
    };
    let mut seen: std::collections::HashMap<String, usize> = Default::default();
    let mut cands: Vec<Candidate> = vec![];
    let mut group_ids: std::collections::HashMap<usize, Vec<String>> = Default::default();
    for x in &raws {
        let (kind, btext) = text_of_block(x.block);
        let words = chars_in(&btext, x.range.start, x.range.end);
        let label = span_label(&x.span);
        let key = format!("{}|{}|{}", x.tier, label, norm_words(&words));
        let occ = seen.entry(key.clone()).and_modify(|n| *n += 1).or_insert(0);
        let id = format!("t{}", &digest(&format!("{key}|{occ}"))[..10]);
        if x.group != 0 {
            group_ids.entry(x.group).or_default().push(id.clone());
        }
        let (c1, v1, c2, v2) = {
            let ((c1, v1), (c2, v2)) = bounds(bible, &x.span)?;
            (c1, v1, c2, v2)
        };
        let inside = fences
            .iter()
            .any(|(code, a, b)| *code == x.span.book.code && *a <= (c1, v1) && (c2, v2) <= *b);
        let status = if inside {
            "in_page"
        } else if opt.skipped.contains(&id) {
            "skipped"
        } else {
            "new"
        };
        cands.push(Candidate {
            id,
            tier: x.tier.into(),
            reference: label,
            verses: x.verses,
            version: version.clone(),
            block: x.block,
            range: x.range,
            words,
            evidence: x.evidence.clone(),
            text: span_text(bible, &x.span, &version),
            place: Place {
                after_block: x.block,
                split_at: split_for(&kind, &btext, x.range.end),
            },
            also: vec![],
            status: status.into(),
        });
    }
    for (c, x) in cands.iter_mut().zip(&raws) {
        if x.group != 0 {
            c.also = group_ids[&x.group]
                .iter()
                .filter(|i| **i != c.id)
                .cloned()
                .collect();
        }
    }
    let count = |s: &str| cands.iter().filter(|c| c.status == s).count();
    let summary = Summary {
        words: word_count,
        blocks: r.blocks.len(),
        named: cands.iter().filter(|c| c.tier == "named").count(),
        quoted: cands.iter().filter(|c| c.tier == "quoted").count(),
        new: count("new"),
        in_page: count("in_page"),
        skipped: count("skipped"),
        many,
        page_hash: digest(&r.text),
    };
    Ok(Report {
        page: r.id,
        summary,
        candidates: cands,
    })
}

/// A report as JSON.
pub fn to_json(r: &Report) -> Value {
    serde_json::to_value(r).unwrap_or(Value::Null)
}

/// A page by its id, a day (2026-11-07), a thread (`thread:slug`) or its title as the Notebook shows it.
pub fn resolve(store: &Store, name: &str) -> Result<String> {
    let name = name.trim();
    if let Ok((id, _, _)) = pages::text_of(store, name) {
        return Ok(id);
    }
    let want = name.to_lowercase();
    let all: Vec<(String, String)> = store
        .inbox()
        .into_iter()
        .chain(store.notes())
        .map(|n| {
            (
                n["id"].as_str().unwrap_or("").to_string(),
                crate::notebook::title_of(n["text"].as_str().unwrap_or("")).to_lowercase(),
            )
        })
        .collect();
    for fits in
        [&|t: &str| t == want, &|t: &str| t.starts_with(&want)] as [&dyn Fn(&str) -> bool; 2]
    {
        let hit: Vec<&(String, String)> = all.iter().filter(|(_, t)| fits(t)).collect();
        match hit.len() {
            0 => continue,
            1 => return Ok(hit[0].0.clone()),
            n => {
                return Err(Error(format!(
                    "Which page? {n} pages fit “{name}”; give more of its title, or its id."
                )))
            }
        }
    }
    Err(Error(format!("No page fits “{name}”.")))
}
