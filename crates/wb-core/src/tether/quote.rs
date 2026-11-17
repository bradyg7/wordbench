//! Words in a note that are, in order, the words of a verse (TG-7). Words are lower-cased and stripped of punctuation. A
//! quotation is at least `min_words` words of one verse in the note in the verse's order, with at most 2 other words in
//! any gap of the note and at most 2 verse words skipped in any gap. Nothing here says what a verse means or which is
//! better: where several verses fit the same words, all are returned.

use crate::bible::Bible;
use crate::Result;
use std::collections::{HashMap, HashSet};

/// A word of a note, and where it is (characters of the block's Markdown).
#[derive(Debug, Clone)]
pub struct NoteWord {
    pub w: String,
    pub s: usize,
    pub e: usize,
}

/// A text as words: runs of letters, digits and apostrophes, the apostrophes dropped, lower-cased.
pub fn words_of(text: &str) -> Vec<NoteWord> {
    let mut out = vec![];
    let (mut cur, mut start) = (String::new(), 0usize);
    let mut in_word = false;
    let mut n = 0usize;
    for (i, c) in text.chars().enumerate() {
        n = i + 1;
        if c.is_alphanumeric() || c == '\'' || c == '’' {
            if !in_word {
                in_word = true;
                start = i;
            }
            if c.is_alphanumeric() {
                cur.extend(c.to_lowercase());
            }
        } else if in_word {
            in_word = false;
            if !cur.is_empty() {
                out.push(NoteWord { w: std::mem::take(&mut cur), s: start, e: i });
            }
            cur.clear();
        }
    }
    if in_word && !cur.is_empty() {
        out.push(NoteWord { w: cur, s: start, e: n });
    }
    out
}

/// One verse as words.
pub struct VerseRec {
    pub book: u32,
    pub chapter: u32,
    pub verse: u32,
    pub words: Vec<String>,
}

/// Every verse of a version, in order (`KJV` from the verses, any other from `verse_texts`).
pub fn load_verses(bible: &Bible, version: &str) -> Result<Vec<VerseRec>> {
    let version = version.to_uppercase();
    let sql = if version == "KJV" {
        "SELECT book, chapter, verse, text FROM verses ORDER BY book, chapter, verse".to_string()
    } else {
        "SELECT book, chapter, verse, text FROM verse_texts WHERE version = ?1 ORDER BY book, chapter, verse".to_string()
    };
    let mut stmt = bible.conn().prepare(&sql)?;
    let map = |r: &rusqlite::Row| -> rusqlite::Result<VerseRec> {
        let t: String = r.get(3)?;
        Ok(VerseRec { book: r.get(0)?, chapter: r.get(1)?, verse: r.get(2)?, words: words_of(&t).into_iter().map(|w| w.w).collect() })
    };
    let rows = if version == "KJV" { stmt.query_map([], map)? .collect::<rusqlite::Result<Vec<_>>>()? } else { stmt.query_map([&version], map)?.collect::<rusqlite::Result<Vec<_>>>()? };
    Ok(rows)
}

fn hash(ws: &[&str]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for w in ws {
        for b in w.bytes().chain(std::iter::once(0u8)) {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
    }
    h
}

/// Verse words that are in the note, found once for every block.
pub struct Matcher<'a> {
    verses: &'a [VerseRec],
    seed: usize,
    min_words: usize,
    postings: HashMap<u64, Vec<(u32, u16)>>,
}

/// A run of one verse's words found in order in a block.
#[derive(Debug, Clone)]
pub struct Chain {
    pub verse: usize,
    /// First and last matched note word (indexes into the block's words).
    pub first: usize,
    pub last: usize,
    pub matched: usize,
    /// The matched note words, in order.
    pub note_words: Vec<usize>,
}

const COMMON: usize = 600;

impl<'a> Matcher<'a> {
    /// `blocks`: the words of every block that will be searched.
    pub fn new(verses: &'a [VerseRec], blocks: &[Vec<NoteWord>], min_words: usize) -> Matcher<'a> {
        let min_words = min_words.max(2);
        let seed = min_words.min(3);
        let mut wanted: HashSet<u64> = HashSet::new();
        for b in blocks {
            let ws: Vec<&str> = b.iter().map(|w| w.w.as_str()).collect();
            for g in ws.windows(seed) {
                wanted.insert(hash(g));
            }
        }
        let mut postings: HashMap<u64, Vec<(u32, u16)>> = HashMap::new();
        if !wanted.is_empty() {
            for (vi, v) in verses.iter().enumerate() {
                let ws: Vec<&str> = v.words.iter().map(String::as_str).collect();
                for (j, g) in ws.windows(seed).enumerate() {
                    let h = hash(g);
                    if wanted.contains(&h) {
                        postings.entry(h).or_default().push((vi as u32, j as u16));
                    }
                }
            }
        }
        postings.retain(|_, v| v.len() <= COMMON);
        Matcher { verses, seed, min_words, postings }
    }

    /// Every run of at least `min_words` words of a verse in this block (one per place it is found).
    pub fn chains(&self, note: &[NoteWord]) -> Vec<Chain> {
        let mut seeds: Vec<(u32, usize)> = vec![];
        let ws: Vec<&str> = note.iter().map(|w| w.w.as_str()).collect();
        if ws.len() < self.seed {
            return vec![];
        }
        for (i, g) in ws.windows(self.seed).enumerate() {
            if let Some(p) = self.postings.get(&hash(g)) {
                for (vi, _) in p {
                    seeds.push((*vi, i));
                }
            }
        }
        seeds.sort_unstable();
        seeds.dedup();
        let mut out: Vec<Chain> = vec![];
        let mut k = 0;
        while k < seeds.len() {
            let vi = seeds[k].0;
            let mut m = k;
            while m < seeds.len() && seeds[m].0 == vi {
                m += 1;
            }
            // clusters of seeds close together in the note
            let mut c = k;
            while c < m {
                let mut d = c + 1;
                while d < m && seeds[d].1 - seeds[d - 1].1 <= 25 {
                    d += 1;
                }
                let lo = seeds[c].1.saturating_sub(4);
                let hi = (seeds[d - 1].1 + self.seed + 4).min(ws.len());
                if let Some(ch) = self.best_chain(vi as usize, &ws, lo, hi) {
                    out.push(ch);
                }
                c = d;
            }
            k = m;
        }
        out
    }

    fn best_chain(&self, vi: usize, ws: &[&str], lo: usize, hi: usize) -> Option<Chain> {
        let v = &self.verses[vi].words;
        if v.len() < self.min_words {
            return None;
        }
        let mut pairs: Vec<(usize, usize)> = vec![];
        for (i, w) in ws.iter().enumerate().take(hi).skip(lo) {
            for (j, x) in v.iter().enumerate() {
                if x == w {
                    pairs.push((i, j));
                }
            }
        }
        let mut best: Vec<(usize, Option<usize>)> = Vec::with_capacity(pairs.len());
        let mut top = 0;
        for p in 0..pairs.len() {
            let (ip, jp) = pairs[p];
            let mut b = (1, None);
            for q in (0..p).rev() {
                let (iq, jq) = pairs[q];
                if ip - iq > 3 {
                    break;
                }
                if iq < ip && jq < jp && ip - iq - 1 <= 2 && jp - jq - 1 <= 2 && best[q].0 + 1 > b.0 {
                    b = (best[q].0 + 1, Some(q));
                }
            }
            best.push(b);
            if b.0 > best[top].0 {
                top = p;
            }
        }
        if pairs.is_empty() || best[top].0 < self.min_words {
            return None;
        }
        let mut chain = vec![];
        let mut vjs = vec![];
        let mut at = Some(top);
        while let Some(p) = at {
            chain.push(pairs[p].0);
            vjs.push(pairs[p].1);
            at = best[p].1;
        }
        chain.reverse();
        vjs.reverse();
        // at most a third of the stretch, in the note or in the verse, is other words
        let (note_span, verse_span) = (chain[chain.len() - 1] - chain[0] + 1, vjs[vjs.len() - 1] - vjs[0] + 1);
        if chain.len() * 3 < note_span * 2 || chain.len() * 3 < verse_span * 2 {
            return None;
        }
        // and some words side by side in both: a run of 3 (the seed), never only words spread through the verse
        let (mut run, mut longest) = (1, 1);
        for k in 1..chain.len() {
            run = if chain[k] == chain[k - 1] + 1 && vjs[k] == vjs[k - 1] + 1 { run + 1 } else { 1 };
            longest = longest.max(run);
        }
        if longest < self.seed {
            return None;
        }
        Some(Chain { verse: vi, first: chain[0], last: *chain.last().unwrap(), matched: chain.len(), note_words: chain })
    }
}

/// What the chains of one block make: a verse or a passage, several verses that fit the same words (TG-6), or words found
/// in many verses (counted, not offered).
#[derive(Debug, Clone)]
pub enum Outcome {
    /// Consecutive verses quoted in one stretch are one passage.
    Passage(Vec<Chain>),
    /// 2 or 3 verses fit the same words: one candidate each, none preferred.
    Alike(Vec<Chain>),
    Many(Vec<Chain>),
}

/// Group the chains of a block by the words they cover, drop what is a part of a longer quotation, and join consecutive
/// verses quoted together (within 30 words).
pub fn group(verses: &[VerseRec], mut chains: Vec<Chain>) -> Vec<Outcome> {
    chains.sort_by_key(|c| (c.first, c.last, c.verse));
    // groups of chains that cover some of the same words
    let mut groups: Vec<Vec<Chain>> = vec![];
    let mut reach = 0usize;
    for c in chains {
        match groups.last_mut() {
            Some(g) if c.first <= reach => {
                reach = reach.max(c.last);
                g.push(c);
            }
            _ => {
                reach = c.last;
                groups.push(vec![c]);
            }
        }
    }
    let mut ones: Vec<Chain> = vec![];
    let mut out: Vec<Outcome> = vec![];
    let mut pending: Vec<(usize, Outcome)> = vec![];
    for g in groups {
        let best = g.iter().map(|c| c.matched).max().unwrap();
        let mut kept: Vec<Chain> = vec![];
        for c in g {
            if c.matched * 10 >= best * 7 && !kept.iter().any(|k| k.verse == c.verse) {
                kept.push(c);
            }
        }
        match kept.len() {
            1 => ones.push(kept.pop().unwrap()),
            2 | 3 => pending.push((kept[0].first, Outcome::Alike(kept))),
            _ => pending.push((kept[0].first, Outcome::Many(kept))),
        }
    }
    // consecutive verses, one stretch
    let mut passages: Vec<Vec<Chain>> = vec![];
    for c in ones {
        match passages.last_mut() {
            Some(p) if {
                let l = p.last().unwrap();
                c.verse == l.verse + 1 && verses[c.verse].book == verses[l.verse].book && c.first > l.last && c.first - l.last <= 30
            } =>
            {
                p.push(c)
            }
            _ => passages.push(vec![c]),
        }
    }
    for p in passages {
        pending.push((p[0].first, Outcome::Passage(p)));
    }
    pending.sort_by_key(|(f, _)| *f);
    out.extend(pending.into_iter().map(|(_, o)| o));
    out
}
