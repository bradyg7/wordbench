//! Merging two devices' study folders by kind of file (docs/PLAN.md section 4), so a conflict almost never reaches the
//! person. This is the spike's version of what becomes `wb-core::sync`:
//!
//!   notes/**/*.md          the same note edited on both sides: keep both texts in the note, marked "needs a look"
//!   highlights/<BOOK>.json by highlight id, then the no-overlap rule re-run for the highlights the merge brought in
//!   anything else          (not in the spike) this side's version, the other side's kept in .trash/
//!
//! Nothing is dropped: whenever a file needed resolving, both sides' versions are copied to `.trash/` (gitignored, so
//! they stay on the device that merged).

use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use wb_core::anchors::{self, Anchor, Kind};
use wb_core::bible::Bible;

pub const NEEDS_A_LOOK: &str = "<!-- wb: needs a look (edited on two devices) -->";

// ---- notes --------------------------------------------------------------------------------------------------------

struct NoteFile {
    meta: Vec<(String, String)>, // key, raw value as written (a JSON string)
    body: String,
}

fn parse_note(text: &str) -> Option<NoteFile> {
    let text = text.replace("\r\n", "\n");
    let rest = text.strip_prefix("---\n")?;
    let end = rest.find("\n---")?;
    let meta = rest[..end]
        .lines()
        .filter_map(|l| l.split_once(':').map(|(k, v)| (k.trim().to_string(), v.trim().to_string())))
        .collect();
    Some(NoteFile { meta, body: rest[end + 4..].trim_matches('\n').to_string() })
}

fn dump_note(n: &NoteFile) -> String {
    let mut s = String::from("---\n");
    for (k, v) in &n.meta {
        s += &format!("{k}: {v}\n");
    }
    s + "---\n\n" + &n.body + "\n"
}

fn meta<'a>(n: &'a NoteFile, key: &str) -> &'a str {
    n.meta.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str()).unwrap_or("")
}

/// Returns the merged note, and whether it needs a look.
pub fn merge_note(base: Option<&str>, ours: &str, theirs: &str) -> (String, bool) {
    let (Some(o), Some(t)) = (parse_note(ours), parse_note(theirs)) else {
        // Not in the note format: keep both, whole.
        return (format!("{ours}\n\n{NEEDS_A_LOOK}\n\n{theirs}"), true);
    };
    let b = base.and_then(parse_note);
    let base_body = b.as_ref().map(|b| b.body.as_str());
    let newer = if meta(&t, "updated") > meta(&o, "updated") { &t } else { &o };
    let mut out = NoteFile { meta: newer.meta.clone(), body: String::new() };
    let both_changed = o.body != t.body && base_body != Some(o.body.as_str()) && base_body != Some(t.body.as_str());
    out.body = if o.body == t.body || base_body == Some(t.body.as_str()) {
        o.body.clone()
    } else if base_body == Some(o.body.as_str()) {
        t.body.clone()
    } else {
        format!("{}\n\n{NEEDS_A_LOOK}\n*The other device's version:*\n\n{}", o.body, t.body)
    };
    (dump_note(&out), both_changed)
}

// ---- highlights ---------------------------------------------------------------------------------------------------

type Key = (u32, u32, u32); // chapter, verse, word

/// The words of a book in reading order, for the chapters asked for.
pub struct Words {
    code: String,
    keys: Vec<Key>,
    text: BTreeMap<Key, (String, String)>, // text, trail
}

impl Words {
    pub fn load(bible: &Bible, code: &str, chapters: &BTreeSet<u32>) -> wb_core::Result<Words> {
        let mut keys = vec![];
        let mut text = BTreeMap::new();
        for &c in chapters {
            for v in bible.chapter(code, c)?.verses {
                for w in v.words {
                    let k = (c, v.v, w.i);
                    keys.push(k);
                    text.insert(k, (w.text, w.trail));
                }
            }
        }
        Ok(Words { code: code.into(), keys, text })
    }

    fn pos(&self, k: Key) -> Option<usize> {
        self.keys.binary_search(&k).ok()
    }

    /// First and last word positions an anchor covers.
    fn span(&self, a: &Anchor) -> Option<(usize, usize)> {
        let (c2, v2) = (a.c2.unwrap_or(a.c1), a.v2.unwrap_or(a.v1));
        match a.kind {
            Kind::Word | Kind::Phrase => Some((self.pos((a.c1, a.v1, a.i1?))?, self.pos((c2, v2, a.i2.or(a.i1)?))?)),
            Kind::Verse | Kind::Verses => {
                let s = self.keys.iter().position(|k| (k.0, k.1) == (a.c1, a.v1))?;
                let e = self.keys.iter().rposition(|k| (k.0, k.1) == (c2, v2))?;
                Some((s, e))
            }
            Kind::Lemma => None,
        }
    }

    fn whole_verses(&self, s: usize, e: usize) -> bool {
        let (a, b) = (self.keys[s], self.keys[e]);
        a.2 == 0 && self.keys.get(e + 1).map_or(true, |n| (n.0, n.1) != (b.0, b.1))
    }

    /// The anchor for the words s..=e (whole verses as a verse anchor when the highlight was on verses).
    fn anchor(&self, s: usize, e: usize, verses: bool) -> String {
        let (a, b) = (self.keys[s], self.keys[e]);
        if verses && self.whole_verses(s, e) {
            return if (a.0, a.1) == (b.0, b.1) { format!("{}.{}:{}", self.code, a.0, a.1) } else { format!("{}.{}:{}-{}:{}", self.code, a.0, a.1, b.0, b.1) };
        }
        if s == e {
            format!("{}.{}:{}.{}", self.code, a.0, a.1, a.2)
        } else {
            format!("{}.{}:{}.{}-{}:{}.{}", self.code, a.0, a.1, a.2, b.0, b.1, b.2)
        }
    }

    pub fn quote_of(&self, anchor: &str) -> Option<String> {
        let (s, e) = self.span(&anchors::parse(anchor).ok()?)?;
        Some(self.quote(s, e))
    }

    /// The words s..=e as the Python app quotes them (text and the spaces between, verbatim from the database).
    fn quote(&self, s: usize, e: usize) -> String {
        let mut q = String::new();
        for p in s..=e {
            let (t, trail) = &self.text[&self.keys[p]];
            q += t;
            if p < e {
                q += trail;
            }
        }
        q.split_whitespace().collect::<Vec<_>>().join(" ")
    }
}

fn items(text: Option<&str>) -> Vec<Value> {
    text.and_then(|t| serde_json::from_str::<Value>(t).ok())
        .and_then(|v| v.get("highlights").and_then(|h| h.as_array()).cloned())
        .unwrap_or_default()
}

fn id_of(h: &Value) -> String {
    h["id"].as_str().unwrap_or_default().to_string()
}

pub struct HighlightMerge {
    pub json: String,
    pub cut: Vec<String>,
}

/// Chapters any of the three versions' highlights touch (to load their words).
pub fn chapters_of(texts: &[Option<&str>]) -> BTreeSet<u32> {
    let mut out = BTreeSet::new();
    for t in texts {
        for h in items(*t) {
            if let Ok(a) = anchors::parse(h["anchor"].as_str().unwrap_or_default()) {
                out.extend(a.c1..=a.last_chapter());
            }
        }
    }
    out
}

pub fn merge_highlights(words: &Words, base: Option<&str>, ours: &str, theirs: &str, new_id: &mut dyn FnMut() -> String) -> HighlightMerge {
    let b: BTreeMap<String, Value> = items(base).into_iter().map(|h| (id_of(&h), h)).collect();
    let o: BTreeMap<String, Value> = items(Some(ours)).into_iter().map(|h| (id_of(&h), h)).collect();
    let t: BTreeMap<String, Value> = items(Some(theirs)).into_iter().map(|h| (id_of(&h), h)).collect();
    // By id: kept where neither side deleted it; a change on one side wins over no change; this side wins a tie.
    let mut merged: Vec<Value> = vec![];
    let ids: BTreeSet<&String> = o.keys().chain(t.keys()).collect();
    for id in ids {
        let item = match (o.get(id), t.get(id), b.get(id)) {
            (Some(x), Some(y), base) => Some(if Some(x) == base { y } else { x }),
            (Some(x), None, None) | (None, Some(x), None) => Some(x), // added on one side
            (Some(x), None, Some(base)) | (None, Some(x), Some(base)) => (x != base).then_some(x), // deleted on the other side unless changed here
            (None, None, _) => None,
        };
        if let Some(h) = item {
            merged.push(h.clone());
        }
    }
    // The no-overlap rule, re-run for what the merge brought in (in the order they were made): each cuts back the
    // highlights it touches, as saving it in the Python app does. Older overlaps already in the file are left alone.
    let created = |h: &Value| h["created"].as_str().unwrap_or_default().to_string();
    let mut fresh: Vec<String> = merged.iter().filter(|h| !b.contains_key(&id_of(h))).map(id_of).collect();
    fresh.sort_by_key(|id| merged.iter().find(|h| &id_of(h) == id).map(created));
    let mut cut = vec![];
    for id in &fresh {
        let Some(h) = merged.iter().find(|h| &id_of(h) == id).cloned() else { continue };
        let Some(hs) = anchors::parse(h["anchor"].as_str().unwrap_or_default()).ok().and_then(|a| words.span(&a)) else { continue };
        let mut next = vec![];
        for g in merged.drain(..) {
            let gid = id_of(&g);
            let older_or_kept = !fresh.contains(&gid) || created(&g) < created(&h) || (created(&g) == created(&h) && gid < *id);
            let ga = anchors::parse(g["anchor"].as_str().unwrap_or_default()).ok();
            let gs = ga.as_ref().and_then(|a| words.span(a));
            match (gid != *id && older_or_kept, gs) {
                (true, Some(gs)) if !(gs.1 < hs.0 || gs.0 > hs.1) => {
                    cut.push(format!("{} {} cut by {} {}", g["color"], g["anchor"], h["color"], h["anchor"]));
                    let verses = matches!(ga.unwrap().kind, Kind::Verse | Kind::Verses);
                    let pieces = [(gs.0 < hs.0).then(|| (gs.0, hs.0 - 1)), (gs.1 > hs.1).then(|| (hs.1 + 1, gs.1))];
                    for (k, (s, e)) in pieces.into_iter().flatten().enumerate() {
                        let mut piece = g.clone();
                        if k > 0 {
                            piece["id"] = Value::String(new_id());
                        }
                        piece["anchor"] = Value::String(words.anchor(s, e, verses));
                        piece["quote"] = Value::String(words.quote(s, e));
                        next.push(piece);
                    }
                }
                _ => next.push(g),
            }
        }
        merged = next;
    }
    merged.sort_by_key(created);
    // The Python app's layout: one-space indent, not ASCII-escaped, a newline at the end.
    let json = to_python_json(&serde_json::json!({ "highlights": merged }));
    HighlightMerge { json, cut }
}

/// `json.dumps(x, ensure_ascii=False, indent=1) + "\n"`, as the Python app writes highlight files.
pub fn to_python_json(v: &Value) -> String {
    let mut buf = Vec::new();
    let fmt = serde_json::ser::PrettyFormatter::with_indent(b" ");
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, fmt);
    serde::Serialize::serialize(v, &mut ser).unwrap();
    String::from_utf8(buf).unwrap() + "\n"
}
