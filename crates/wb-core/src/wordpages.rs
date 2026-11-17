//! Words: the pages whose own text names a verse or a Strong's number (design/features/words, W-5). Found, never stored:
//! the study folder holds no list of them. The word card and the verse card show only their count and open the list.

use crate::anchors::{self, Kind};
use crate::bible::Bible;
use crate::store::Store;
use crate::Result;
use serde_json::{json, Value};

/// The pages (notes, questions, threads kept as pages) whose text names the place or the number, with their count:
/// `wb anchor <place|number> --pages`. A place's pages are in the fixed order of marks MK-13 (a scripture block holding it
/// first, then how many times the page names it, then newest); a number's are newest first. Each says its folders.
pub fn pages_naming(bible: &Bible, store: &Store, anchor: &str) -> Result<Value> {
    let a = anchors::parse(anchor)?;
    let folders = crate::margin::folders_of(store);
    let row = |id: &str, e: &crate::pageindex::Entry, times: u32, block: bool| {
        json!({"id": id, "title": e.title, "kind": e.kind, "created": e.created, "times": times, "in_scripture_block": block,
            "folders": folders.get(id).cloned().unwrap_or_default()})
    };
    let hits: Vec<Value> = if a.kind == Kind::Lemma {
        let number = a.strong.as_deref().unwrap_or("").to_uppercase();
        let mut v: Vec<(String, crate::pageindex::Entry)> = crate::pageindex::all(bible, store).into_iter().filter(|(_, e)| e.numbers.contains(&number)).collect();
        v.sort_by(|x, y| y.1.created.cmp(&x.1.created));
        v.iter().map(|(id, e)| row(id, e, 1, false)).collect()
    } else {
        let (lo, hi) = ((a.c1, a.v1), (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1)));
        crate::pageindex::naming(bible, store, &a.code, lo, hi).iter().map(|(id, e, t, b)| row(id, e, *t, *b)).collect()
    };
    let mut out = json!({"anchor": anchor, "count": hits.len(), "pages": hits});
    if out["count"].as_u64().unwrap_or(0) > 20 {
        // past 20 the list is grouped by folder (marks M37)
        let mut groups: Vec<(String, Vec<Value>)> = vec![];
        for p in out["pages"].as_array().unwrap() {
            let f = p["folders"][0].as_str().unwrap_or("").to_string();
            match groups.iter_mut().find(|g| g.0 == f) {
                Some(g) => g.1.push(p.clone()),
                None => groups.push((f, vec![p.clone()])),
            }
        }
        out["groups"] = json!(groups.into_iter().map(|(f, p)| json!({"folder": f, "count": p.len(), "pages": p})).collect::<Vec<_>>());
    }
    Ok(out)
}
