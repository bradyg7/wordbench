//! Scripture in this page (design/features/marks, MK-5, M22, M23, M39): every scripture a page names, in the Bible's order,
//! each saying where it is named. Found from the page's own text (`wb refs`), its scripture blocks, its word blocks and the
//! place of a margin note it shows; nothing is stored. A page naming more than `FOLD` scriptures folds to books with counts.

use crate::bible::Bible;
use crate::commands::find_refs;
use crate::pages::{chars, jot_fence, scripture_fence, split, sub, text_of, word_fence};
use crate::places::{parse_span, parse_spans, span_label, Span};
use crate::store::Store;
use crate::Result;
use serde_json::{json, Value};

/// More scriptures than this and the overview shows books with counts (M39: 86 scriptures in 14 books).
pub const FOLD: usize = 30;

struct Item {
    span: Span,
    label: String,
    at: Vec<Value>,
}

/// `wb page overview <id>`: `{id, count, folded, items: [{label, ref, where: [{n, in}]}], books: [{code, name, count, items}], words}`.
pub fn page(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let (title, blocks) = split(&text, titled);
    let mut items: Vec<Item> = vec![];
    let mut words: Vec<Value> = vec![];
    let mut put = |sp: Span, n: usize, how: &str| {
        let label = span_label(&sp);
        let w = json!({"n": n, "in": how});
        match items.iter_mut().find(|i| i.label == label) {
            Some(i) => {
                if !i.at.contains(&w) {
                    i.at.push(w)
                }
            }
            None => items.push(Item { span: sp, label, at: vec![w] }),
        }
    };
    // where in the page each reference of its text falls: the title is block 0, a block's number counts from 1
    let place = |at: usize| -> (usize, String) {
        if title.is_some_and(|t| at >= t.0 && at <= t.1) {
            return (0, "title".into());
        }
        match blocks.iter().position(|b| at >= b.start && at <= b.end) {
            Some(k) => (k + 1, if blocks[k].kind == "fence" { "block".into() } else { format!("¶{}", k + 1) }),
            None => (0, "title".into()),
        }
    };
    for f in find_refs(&text, bible.books()) {
        if let Ok(sp) = parse_span(&f.place, bible.books()) {
            let (n, how) = place(f.start);
            put(sp, n, &how);
        }
    }
    for (k, b) in blocks.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let md = sub(&c, b.start, b.end);
        if let Some(f) = scripture_fence(&md) {
            for sp in parse_spans(&f.reference, bible.books()).unwrap_or_default() {
                put(sp, k + 1, "scripture block");
            }
        } else if let Some(v) = word_fence(&md) {
            if !v.trim().is_empty() {
                words.push(json!({"number": v.trim().to_uppercase(), "n": k + 1, "in": "word block"}));
            }
        } else if let Some(note) = jot_fence(&md) {
            if let Some(at) = crate::margin::at_of(&store.root, note.trim()) {
                if let Some(b) = bible.books().iter().find(|b| b.code == at.code) {
                    put(Span { book: b.clone(), c1: at.c, v1: at.v1, c2: at.c, v2: at.v2 }, k + 1, "margin note");
                }
            }
        }
    }
    items.sort_by_key(|i| (i.span.book.id, i.span.c1, i.span.v1, i.span.c2, i.span.v2));
    let books: Vec<Value> = {
        let mut out: Vec<(String, String, Vec<String>)> = vec![];
        for i in &items {
            match out.iter_mut().find(|b| b.0 == i.span.book.code) {
                Some(b) => b.2.push(i.label.clone()),
                None => out.push((i.span.book.code.clone(), i.span.book.name.clone(), vec![i.label.clone()])),
            }
        }
        out.into_iter().map(|(code, name, l)| json!({"code": code, "name": name, "count": l.len(), "items": l})).collect()
    };
    Ok(json!({"id": id, "count": items.len(), "folded": items.len() > FOLD,
        "items": items.iter().map(|i| json!({"label": i.label, "ref": span_ref(i), "book": i.span.book.code, "where": i.at, "first": i.at[0]["n"]})).collect::<Vec<_>>(),
        "books": books, "words": words}))
}

fn span_ref(i: &Item) -> String {
    let s = &i.span;
    format!("{} {}{}", s.book.name, s.c1, if s.v1 != 0 { format!(":{}", s.v1) } else { String::new() }) + &match (s.c2 != s.c1, s.v2 != 0 && s.v2 != s.v1) {
        (true, _) => format!("-{}{}", s.c2, if s.v2 != 0 { format!(":{}", s.v2) } else { String::new() }),
        (false, true) => format!("-{}", s.v2),
        _ => String::new(),
    }
}
