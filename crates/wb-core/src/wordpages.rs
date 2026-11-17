//! Words: the pages whose own text names a verse or a Strong's number (design/features/words, W-5). Found, never stored:
//! the study folder holds no list of them. The word card and the verse card show only their count and open the list.

use crate::anchors::{self, Kind};
use crate::bible::Bible;
use crate::notebook::every;
use crate::pages::{scripture_fence, word_fence};
use crate::places::parse_span;
use crate::store::Store;
use crate::Result;
use serde_json::{json, Value};

/// Does `text` hold the number as a whole token (H7065 is not in H70651), or a ```word fence holding it?
fn names_number(text: &str, number: &str) -> bool {
    let lower = text.to_lowercase();
    let want = number.to_lowercase();
    let mut from = 0;
    while let Some(i) = lower[from..].find(&want) {
        let (a, b) = (from + i, from + i + want.len());
        let before = lower[..a].chars().next_back();
        let after = lower[b..].chars().next();
        if !before.is_some_and(|c| c.is_alphanumeric()) && !after.is_some_and(|c| c.is_alphanumeric()) {
            return true;
        }
        from = b;
    }
    false
}

/// (chapter, verse) bounds of a span; a chapter alone (verse 0) covers all of it.
fn bounds(c1: u32, v1: u32, c2: u32, v2: u32) -> ((u32, u32), (u32, u32)) {
    ((c1, v1), (c2, if v2 == 0 { u32::MAX } else { v2 }))
}

/// Every fenced block of a page's text, each as its own Markdown (the opening fence to the closing one).
fn fences(text: &str) -> Vec<String> {
    let mut out = vec![];
    let mut cur: Option<(String, Vec<&str>)> = None;
    for line in text.lines() {
        let t = line.trim_start();
        match &mut cur {
            None => {
                if let Some(m) = ["```", "~~~"].into_iter().find(|m| t.starts_with(m)) {
                    cur = Some((m.to_string(), vec![line]));
                }
            }
            Some((mark, ls)) => {
                ls.push(line);
                if t.starts_with(mark.as_str()) {
                    out.push(ls.join("
"));
                    cur = None;
                }
            }
        }
    }
    out
}

/// The pages (notes, questions, days, threads kept as pages) whose text names the place or the number, newest first,
/// with their count: `wb anchor <place|number> --pages`.
pub fn pages_naming(bible: &Bible, store: &Store, anchor: &str) -> Result<Value> {
    let a = anchors::parse(anchor)?;
    let mut hits = vec![];
    for e in every(bible, store) {
        let text = e["text"].as_str().unwrap_or("");
        let blocks = fences(text);
        let named = if a.kind == Kind::Lemma {
            let number = a.strong.as_deref().unwrap_or("");
            names_number(text, number) || blocks.iter().filter_map(|b| word_fence(b)).any(|v| v.trim().eq_ignore_ascii_case(number))
        } else {
            let (lo, hi) = bounds(a.c1, a.v1, a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1));
            let overlaps = |sp: crate::places::Span| {
                let (flo, fhi) = bounds(sp.c1, sp.v1, sp.c2, sp.v2);
                sp.book.code == a.code && flo <= hi && lo <= fhi
            };
            // the references in the text, and the references a scripture block holds (a chapter alone, an abbreviation)
            e["refs"].as_array().into_iter().flatten().any(|f| f["ref"].as_str().and_then(|p| parse_span(p, bible.books()).ok()).is_some_and(overlaps))
                || blocks.iter().filter_map(|b| scripture_fence(b)).any(|f| parse_span(&f.reference, bible.books()).ok().is_some_and(overlaps))
        };
        if named {
            hits.push(json!({"id": e["id"], "title": e["title"], "kind": e["kind"], "created": e["created"]}));
        }
    }
    hits.sort_by(|x, y| y["created"].as_str().cmp(&x["created"].as_str()));
    Ok(json!({"anchor": anchor, "count": hits.len(), "pages": hits}))
}
