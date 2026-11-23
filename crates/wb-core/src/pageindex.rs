//! The verse index (design/features/marks, MK-13, MK-14): which pages name which verses, kept in memory beside the study's
//! files and updated one page at a time. The Store forgets a page's entry whenever that page's file is read again or gone;
//! the next question recomputes only the forgotten ones (`computed` counts them, for the tests). Opening a chapter's
//! margin asks this index and reads no page file. It is derived and never written to the study folder.

use crate::bible::Bible;
use crate::commands::find_refs;
use crate::pages::{chars, scripture_fence, split, sub, word_fence};
use crate::places::parse_spans;
use crate::store::{s, Rec, Store};
use std::collections::HashMap;

/// One reference a page makes: the verses it covers (a chapter alone is verse 0 to the end), how many times the page
/// names it, and whether a scripture block holds it.
#[derive(Debug, Clone)]
pub struct SpanRef {
    pub code: String,
    pub lo: (u32, u32),
    pub hi: (u32, u32),
    pub times: u32,
    pub block: bool,
}

#[derive(Debug, Clone, Default)]
pub struct Entry {
    pub title: String,
    pub created: String,
    pub kind: String,
    pub spans: Vec<SpanRef>,
    /// Strong's numbers the page names (upper case), in its text or a word block.
    pub numbers: Vec<String>,
}

#[derive(Debug, Default)]
pub struct PageIndex {
    map: HashMap<String, Entry>,
    /// How many entries were worked out (the tests count it).
    pub computed: usize,
}

impl PageIndex {
    pub fn forget(&mut self, id: &str) {
        self.map.remove(id);
    }
}

/// Strong's numbers as whole tokens of a text.
pub(crate) fn numbers_in(text: &str) -> Vec<String> {
    let mut out: Vec<String> = vec![];
    for tok in text.split(|c: char| !c.is_alphanumeric()) {
        let b = tok.as_bytes();
        if (2..=5).contains(&b.len())
            && matches!(b[0], b'H' | b'G' | b'h' | b'g')
            && b[1..].iter().all(u8::is_ascii_digit)
        {
            let up = tok.to_uppercase();
            if !out.contains(&up) {
                out.push(up);
            }
        }
    }
    out
}

fn compute(bible: &Bible, r: &Rec, kind: &str) -> Entry {
    let text = s(r, "text");
    let mut spans: Vec<SpanRef> = vec![];
    let mut add = |code: &str, lo: (u32, u32), hi: (u32, u32), block: bool| {
        if let Some(x) = spans
            .iter_mut()
            .find(|x| x.code == code && x.lo == lo && x.hi == hi && x.block == block)
        {
            x.times += 1;
        } else {
            spans.push(SpanRef {
                code: code.into(),
                lo,
                hi,
                times: 1,
                block,
            });
        }
    };
    let bounds =
        |c1: u32, v1: u32, c2: u32, v2: u32| ((c1, v1), (c2, if v2 == 0 { u32::MAX } else { v2 }));
    // a list's `filter: Book is Numbers 25` line names a book to choose by, not a verse the page is about
    let prose: String = if text.contains("filter:") {
        text.lines()
            .filter(|l| !l.trim_start().to_lowercase().starts_with("filter:"))
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        text.clone()
    };
    for f in find_refs(&prose, bible.books()) {
        if let Ok(sp) = crate::places::parse_span(&f.place, bible.books()) {
            let (lo, hi) = bounds(sp.c1, sp.v1, sp.c2, sp.v2);
            add(&sp.book.code, lo, hi, false);
        }
    }
    let mut numbers = numbers_in(&text);
    if text.contains("```") || text.contains("~~~") {
        let c = chars(&text);
        for b in split(&text, !s(r, "id").starts_with("d_")).1 {
            if b.kind != "fence" {
                continue;
            }
            let md = sub(&c, b.start, b.end);
            if let Some(f) = scripture_fence(&md) {
                for sp in parse_spans(&f.reference, bible.books()).unwrap_or_default() {
                    let (lo, hi) = bounds(sp.c1, sp.v1, sp.c2, sp.v2);
                    add(&sp.book.code, lo, hi, true);
                }
            } else if let Some(v) = word_fence(&md) {
                let up = v.trim().to_uppercase();
                if !up.is_empty() && !numbers.contains(&up) {
                    numbers.push(up);
                }
            }
        }
    }
    Entry {
        title: crate::notebook::title_of(&text),
        created: s(r, "created"),
        kind: kind.into(),
        spans,
        numbers,
    }
}

/// Every page's entry, working out only those the store forgot. → (id, entry) for each page, in no set order.
pub fn all(bible: &Bible, store: &Store) -> Vec<(String, Entry)> {
    let mut idx = store.index.borrow_mut();
    let pages: Vec<(&Rec, &str)> = store
        .notes()
        .into_iter()
        .map(|r| (r, "note"))
        .chain(store.on_thread().into_iter().map(|r| (r, "note")))
        .chain(store.inbox().into_iter().map(|r| {
            (
                r,
                if s(r, "kind") == "question" {
                    "question"
                } else {
                    "note"
                },
            )
        }))
        .chain(store.trails().into_iter().map(|r| (r, "question")))
        .collect();
    let mut out = Vec::with_capacity(pages.len());
    for (r, kind) in pages {
        let id = s(r, "id");
        if !idx.map.contains_key(&id) {
            let e = compute(bible, r, kind);
            idx.computed += 1;
            idx.map.insert(id.clone(), e);
        }
        out.push((id.clone(), idx.map[&id].clone()));
    }
    out
}

/// The pages whose references overlap a span of one book, ordered by MK-13: a scripture block holding it first, then by
/// how many times the page names it, then newest. → (id, entry, times, in a block).
pub fn naming(
    bible: &Bible,
    store: &Store,
    code: &str,
    lo: (u32, u32),
    hi: (u32, u32),
) -> Vec<(String, Entry, u32, bool)> {
    let mut hits: Vec<(String, Entry, u32, bool)> = all(bible, store)
        .into_iter()
        .filter_map(|(id, e)| {
            let mine: Vec<&SpanRef> = e
                .spans
                .iter()
                .filter(|x| x.code == code && x.lo <= hi && lo <= x.hi)
                .collect();
            if mine.is_empty() {
                return None;
            }
            let times = mine.iter().map(|x| x.times).sum();
            let block = mine.iter().any(|x| x.block);
            Some((id, e.clone(), times, block))
        })
        .collect();
    hits.sort_by(|a, b| {
        b.3.cmp(&a.3)
            .then(b.2.cmp(&a.2))
            .then(b.1.created.cmp(&a.1.created))
    });
    hits
}
