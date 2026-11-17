//! Accept (TG-3, TG-4, TG-5): a scripture block after the sentence the words are in. The paragraph is split at the
//! sentence end; the person's characters are never changed, only the whitespace at the cut becomes a break. One token
//! restores the page.

use super::anchor::{self, digest, Options};
use super::types::*;
use crate::bible::Bible;
use crate::pages::{self, scripture_fence, scripture_fence_text, ScriptureFence};
use crate::store::Store;
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn bad(m: &str) -> Error {
    Error(m.to_string())
}

/// What undoes an Accept: the page as it was, and a digest of the page as Accept left it.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Token {
    pub page: String,
    pub before: String,
    pub after: String,
    /// Candidates marked skipped by the same Accept (the others a verse fit), put back by the undo.
    #[serde(default)]
    pub skipped: Vec<String>,
}

pub struct Accepted {
    pub json: Value,
    pub token: Token,
    pub also: Vec<String>,
}

fn pieces(kind: &str, text: &str, group: &[&Candidate], version: &str) -> Vec<String> {
    // group: candidates of one block in page order
    let cs: Vec<char> = text.chars().collect();
    let fence = |c: &Candidate| scripture_fence_text(&ScriptureFence { reference: c.reference.clone(), lines: false, ylt: version == "YLT" });
    let mut cuts: Vec<(Option<usize>, &Candidate)> = group.iter().map(|c| (anchor::split_for(kind, text, c.range.end), *c)).collect();
    cuts.sort_by_key(|(p, c)| (p.unwrap_or(usize::MAX), c.range.start));
    let mut out: Vec<String> = vec![];
    let mut at = 0usize;
    let mut i = 0;
    while i < cuts.len() {
        let p = cuts[i].0;
        let upto = p.unwrap_or(cs.len());
        let seg: String = cs[at.min(upto)..upto].iter().collect();
        let seg = if at == 0 { seg.trim_end().to_string() } else { seg.trim().to_string() };
        if !seg.is_empty() {
            out.push(seg);
        }
        while i < cuts.len() && cuts[i].0 == p {
            out.push(fence(cuts[i].1));
            i += 1;
        }
        at = upto;
    }
    if at < cs.len() {
        let seg: String = cs[at..].iter().collect();
        let seg = seg.trim_start().to_string();
        if !seg.is_empty() {
            out.push(seg);
        }
    }
    out
}

/// A text that would be the page's after adding these candidates' scripture blocks: (text, the numbers of the scripture
/// blocks in it, per block before and after).
fn apply(r: &anchor::Read, titled: bool, picked: &[&Candidate], version: &str) -> Result<(String, Vec<usize>, Vec<Value>)> {
    let mut blocks: Vec<usize> = picked.iter().map(|c| c.block).collect();
    blocks.sort();
    blocks.dedup();
    let mut text = r.text.clone();
    let mut changes = vec![];
    let mut made: Vec<(usize, Vec<String>)> = vec![];
    // from the last block up, so the numbers above are still true
    for &n in blocks.iter().rev() {
        let (kind, btext) = r.blocks.iter().find(|b| b.0 == n).map(|b| (b.1.clone(), b.2.clone())).ok_or_else(|| bad("The page has no such block."))?;
        let mut group: Vec<&Candidate> = picked.iter().copied().filter(|c| c.block == n).collect();
        group.sort_by_key(|c| c.range.start);
        let parts = pieces(&kind, &btext, &group, version);
        let replacement = parts.join("\n\n");
        made.push((n, parts));
        changes.push(json!({"block": n, "before": btext, "after": replacement}));
        let (out, _, _) = pages::set(&text, titled, n - 1, 1, &replacement)?;
        text = out;
    }
    changes.reverse();
    // the numbers the new scripture blocks have in the page now (blocks above shift the ones below)
    let mut nums = vec![];
    let mut shift = 0;
    for (n, parts) in made.iter().rev() {
        for (i, p) in parts.iter().enumerate() {
            if p.starts_with("```scripture") {
                nums.push(n + shift + i);
            }
        }
        shift += parts.len() - 1;
    }
    Ok((text, nums, changes))
}

/// Add the scripture blocks of these candidates. `ids`: candidates of the run; `expect`: the run's `page_hash`.
pub fn accept(bible: &Bible, store: &mut Store, page: &str, ids: &[String], all_named: bool, expect: Option<&str>, dry: bool, opt: &Options) -> Result<Accepted> {
    let r = anchor::read(store, page)?;
    accept_read(bible, store, r, ids, all_named, expect, dry, opt)
}

/// Accept on a page as it was read: the run is made on that read, and the write checks the page is still that text (TG-5).
#[allow(clippy::too_many_arguments)]
pub fn accept_read(bible: &Bible, store: &mut Store, r: anchor::Read, ids: &[String], all_named: bool, expect: Option<&str>, dry: bool, opt: &Options) -> Result<Accepted> {
    let page = r.id.clone();
    let page = page.as_str();
    let report = anchor::run(bible, store, page, opt)?;
    if report.summary.page_hash != digest(&r.text) || expect.is_some_and(|h| h != report.summary.page_hash) {
        return Err(bad("The page has changed since it was read. Run wb tether again."));
    }
    let (_, _, titled) = pages::text_of(store, page)?;
    let mut picked: Vec<&Candidate> = vec![];
    if all_named {
        picked.extend(report.candidates.iter().filter(|c| c.tier == "named" && c.status == "new" && c.also.is_empty()));
    }
    for id in ids {
        let c = report.candidates.iter().find(|c| c.id == *id).ok_or_else(|| bad("The page has changed since it was read: that candidate is no longer found."))?;
        if c.status == "in_page" {
            return Err(bad("That scripture is already in the page."));
        }
        if !picked.iter().any(|p| p.id == c.id) {
            picked.push(c);
        }
    }
    if picked.is_empty() {
        return Err(bad("Nothing to add: give candidate ids (wb tether lists them) or --all-named."));
    }
    let (text, nums, changes) = apply(&r, titled, &picked, &report.candidates.first().map(|c| c.version.clone()).unwrap_or_else(|| "KJV".into()))?;
    let also: Vec<String> = picked.iter().flat_map(|c| c.also.iter().cloned()).filter(|a| !picked.iter().any(|p| p.id == *a)).collect();
    let mut json = json!({"page": r.id, "added": nums, "accepted": picked.iter().map(|c| c.id.clone()).collect::<Vec<_>>(), "changes": changes, "dry_run": dry});
    let token = Token { page: r.id.clone(), before: r.text.clone(), after: digest(&text), skipped: vec![] };
    if !dry {
        pages::write_text(bible, store, &r.id, &text, titled, Some(&r.text)).map_err(|_| bad("The page has changed since it was read. Run wb tether again."))?;
        // the file as written, which may differ from `text` in a trailing newline
        let (_, now, _) = pages::text_of(store, &r.id)?;
        let token = Token { after: digest(&now), ..token };
        json["undo"] = serde_json::to_value(&token).unwrap_or(Value::Null);
        return Ok(Accepted { json, token, also });
    }
    Ok(Accepted { json, token, also })
}

/// Put the page back as it was before an Accept, if nothing has changed it since.
pub fn undo(bible: &Bible, store: &mut Store, token: &Token) -> Result<Value> {
    let (id, current, titled) = pages::text_of(store, &token.page)?;
    if digest(&current) != token.after {
        return Err(bad("The page changed after the scripture was added; it is not put back."));
    }
    pages::write_text(bible, store, &id, &token.before, titled, Some(&current))?;
    Ok(json!({"page": id, "restored": true}))
}

/// The page's scripture blocks in order, each with the verse text and the first words of the sentence it follows (TG-9).
pub fn verses(bible: &Bible, store: &Store, page: &str) -> Result<Vec<Value>> {
    let r = anchor::read(store, page)?;
    let mut out = vec![];
    let mut prev = String::new();
    for (n, kind, text) in &r.blocks {
        if kind == "fence" {
            if let Some(f) = scripture_fence(text) {
                if f.reference.is_empty() {
                    continue;
                }
                let version = if f.ylt { "YLT" } else { "KJV" };
                let verse = crate::places::parse_span(&f.reference, bible.books()).map(|s| anchor::span_text(bible, &s, version)).unwrap_or_default();
                let sentence = last_sentence(&prev);
                let follows: Vec<&str> = sentence.split_whitespace().take(8).collect();
                out.push(json!({"n": n, "reference": f.reference, "version": version, "text": verse, "follows": follows.join(" ")}));
            }
        } else {
            prev = text.clone();
        }
    }
    Ok(out)
}

fn last_sentence(text: &str) -> String {
    let t = text.trim_end();
    let cs: Vec<char> = t.chars().collect();
    let mut start = 0;
    for i in 0..cs.len().saturating_sub(1) {
        if matches!(cs[i], '.' | '?' | '!') && cs[i + 1].is_whitespace() {
            start = i + 1;
        }
    }
    cs[start..].iter().collect::<String>().trim().to_string()
}
