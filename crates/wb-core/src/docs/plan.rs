//! What goes where in a document: the Python app's `workbench/craft_plan.py`, the parts tier 4 makes (the Speaker Script
//! and Verse by Verse, from a thread). The plan is built value for value as the Python app builds it, so the fingerprint
//! of a plan (`documents/<id>.json`'s `plan`) is the same in both apps and either can tell whether a file is up to date.
//!
//! Nothing here holds scripture of its own: every verse comes from the database (`scripture::verses`), and a plan only
//! says where each one goes.

use crate::anchors;
use crate::bible::Bible;
use crate::places::Span;
use crate::store::{s, Rec, Store};
use crate::{lookup, scripture, Error, Result};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

// ---- themes ---------------------------------------------------------------------------------------------------------

pub struct Theme {
    pub key: &'static str,
    pub name: &'static str,
    pub best_for: &'static str,
    pub paper: &'static str,
    pub ink: &'static str,
    pub muted: &'static str,
    pub panel: &'static str,
    pub accent: &'static str,
    pub accent2: &'static str,
    pub mark: &'static str,
    pub mark_ink: &'static str,
    pub divider_bg: &'static str,
    pub divider_fg: &'static str,
    pub heading: &'static str,
    pub body: &'static str,
    pub width: f64,
    pub dark: bool,
    pub doc_ink: &'static str,
    pub doc_accent: &'static str,
    pub doc_tint: &'static str,
    pub doc_rule: &'static str,
    pub band_bg: Option<&'static str>,
    pub band_ink: &'static str,
    /// Shapes on every slide: (color, x, y, w, h) on a 960 × 540 slide; a color is accent1, accent2 or #RRGGBB.
    pub chrome: &'static [(&'static str, f64, f64, f64, f64)],
    pub left: f64,
}

pub const THEMES: &[Theme] = &[
    Theme { key: "vellum", name: "Vellum", best_for: "Bright rooms, daylight, printing", paper: "F7F3E8", ink: "231A12",
        muted: "675A4B", panel: "ECE5D2", accent: "8E1B14", accent2: "A67C1E", mark: "F3DE9A", mark_ink: "231A12",
        divider_bg: "8E1B14", divider_fg: "F7F3E8", heading: "Palatino Linotype", body: "Palatino Linotype", width: 0.47,
        dark: false, doc_ink: "231A12", doc_accent: "8E1B14", doc_tint: "F4EEDF", doc_rule: "C9B98F", band_bg: None,
        band_ink: "8E1B14", chrome: &[("accent1", 64.0, 26.0, 832.0, 2.0), ("accent1", 64.0, 31.0, 832.0, 0.75)], left: 64.0 },
    Theme { key: "vigil", name: "Vigil", best_for: "Dim sanctuaries, evening services", paper: "0E1524", ink: "F4EFE3",
        muted: "A7ADBB", panel: "1B2438", accent: "E0B85C", accent2: "8FA8D8", mark: "3D3417", mark_ink: "F7E2A6",
        divider_bg: "1B2438", divider_fg: "E0B85C", heading: "Cambria", body: "Cambria", width: 0.47, dark: true,
        doc_ink: "1A2030", doc_accent: "1F3160", doc_tint: "F1F3F8", doc_rule: "B48C2E", band_bg: Some("0E1524"),
        band_ink: "F4EFE3", chrome: &[("accent1", 64.0, 74.0, 56.0, 2.0)], left: 64.0 },
    Theme { key: "olivet", name: "Olivet", best_for: "Small rooms, classrooms, LED screens", paper: "1A2419", ink: "F2F0DE",
        muted: "B2B79B", panel: "27331F", accent: "BFCB6B", accent2: "D9A441", mark: "3C4A1F", mark_ink: "ECF3B5",
        divider_bg: "27331F", divider_fg: "BFCB6B", heading: "Trebuchet MS", body: "Georgia", width: 0.49, dark: true,
        doc_ink: "1F2A1C", doc_accent: "4A5D23", doc_tint: "F2F4E6", doc_rule: "9AA65A", band_bg: Some("1A2419"),
        band_ink: "F2F0DE", chrome: &[("accent1", 0.0, 0.0, 16.0, 540.0)], left: 72.0 },
    Theme { key: "veil", name: "Veil", best_for: "Evening teaching, special services", paper: "24123A", ink: "F7F0F5",
        muted: "C2B3CC", panel: "341E4E", accent: "F0705F", accent2: "86AEEF", mark: "56233F", mark_ink: "FFD3CB",
        divider_bg: "341E4E", divider_fg: "F0705F", heading: "Bookman Old Style", body: "Bookman Old Style", width: 0.58,
        dark: true, doc_ink: "24123A", doc_accent: "A32A22", doc_tint: "F6F1F8", doc_rule: "6B4A8A", band_bg: Some("24123A"),
        band_ink: "F7F0F5",
        chrome: &[("accent2", 0.0, 530.0, 320.0, 10.0), ("#7A5BA6", 320.0, 530.0, 320.0, 10.0), ("accent1", 640.0, 530.0, 320.0, 10.0)],
        left: 64.0 },
    Theme { key: "daylight", name: "Daylight", best_for: "Washed-out projectors, photocopies, low vision", paper: "FFFFFF",
        ink: "0F1115", muted: "4E5563", panel: "EEF1F6", accent: "123FA8", accent2: "B3261E", mark: "FFE680", mark_ink: "0F1115",
        divider_bg: "123FA8", divider_fg: "FFFFFF", heading: "Tahoma", body: "Tahoma", width: 0.53, dark: false,
        doc_ink: "0F1115", doc_accent: "123FA8", doc_tint: "EEF1F6", doc_rule: "123FA8", band_bg: None, band_ink: "123FA8",
        chrome: &[("accent1", 0.0, 0.0, 960.0, 12.0)], left: 64.0 },
    Theme { key: "print", name: "Print", best_for: "Printing at home or the office: black on white, no fills, little ink",
        paper: "FFFFFF", ink: "000000", muted: "4D4D4D", panel: "FFFFFF", accent: "000000", accent2: "4D4D4D", mark: "E6E6E6",
        mark_ink: "000000", divider_bg: "FFFFFF", divider_fg: "000000", heading: "Georgia", body: "Georgia", width: 0.5,
        dark: false, doc_ink: "000000", doc_accent: "000000", doc_tint: "FFFFFF", doc_rule: "808080", band_bg: None,
        band_ink: "000000", chrome: &[("accent1", 64.0, 26.0, 832.0, 0.75)], left: 64.0 },
];
pub const DEFAULT_THEME: &str = "vellum";

pub fn theme(key: &str) -> Result<&'static Theme> {
    THEMES.iter().find(|t| t.key == key).ok_or_else(|| Error(format!("Themes: {}.", theme_keys())))
}

pub fn theme_keys() -> String {
    THEMES.iter().map(|t| t.key).collect::<Vec<_>>().join(", ")
}

// ---- structures -------------------------------------------------------------------------------------------------------

/// A structure: its label (also the start of the file's name), what it can be made from, the Python app's own words
/// about it, and whether this app makes it yet (tier 4: the Speaker Script and Verse by Verse; the rest in phase 5).
pub struct Structure {
    pub key: &'static str,
    pub label: &'static str,
    pub sources: &'static [&'static str],
    pub about: &'static str,
    pub made_here: bool,
}

const ALL: &[&str] = &["passage", "lesson", "thread"];
pub const DECKS: &[Structure] = &[
    Structure { key: "reader", label: "Reader", sources: ALL, about: "Scripture only. Nothing else, on screen or off.", made_here: true },
    Structure { key: "pulpit", label: "Pulpit", sources: ALL, about: "The same screen as the Reader, with your speech and notes in the speaker notes.", made_here: false },
    Structure { key: "verse", label: "Verse by Verse", sources: ALL, about: "One verse to a slide, the verses either side faint, your highlights showing.", made_here: true },
    Structure { key: "table", label: "Study Table", sources: ALL, about: "The verse on the left and your notes beside it, on the slide.", made_here: false },
    Structure { key: "map", label: "Thread Map", sources: &["thread"], about: "A contents slide of the thread's places that jumps to each one, each whole verse with the words you marked picked out, then the marked words side by side.", made_here: false },
];
pub const DOCS: &[Structure] = &[
    Structure { key: "reading", label: "Reading Sheet", sources: ALL, about: "Only the scriptures, in two columns.", made_here: true },
    Structure { key: "share", label: "Share Copy", sources: ALL, about: "Speech and scriptures, to send to a friend. No notes.", made_here: true },
    Structure { key: "script", label: "Speaker Script", sources: ALL, about: "Everything in large print, with a cue where each Pulpit slide comes up.", made_here: true },
    Structure { key: "study", label: "Study Sheet", sources: ALL, about: "Each verse beside your notes, with room to write.", made_here: true },
    Structure { key: "dossier", label: "Thread Dossier", sources: &["thread"], about: "A reference file on the thread: a table of every place and the words you marked, each whole verse with its notes, then the original words you added.", made_here: false },
];

/// The structures of a kind of file: `word` (Word), `deck` (slides, as PowerPoint by the Python app) or `pdf` (slides as
/// PDF pages, made here).
pub fn table(to: &str) -> &'static [Structure] {
    if to == "word" { DOCS } else { DECKS }
}

pub fn structure(to: &str, key: &str) -> Option<&'static Structure> {
    table(to).iter().find(|s| s.key == key)
}

/// A source's default structure, as the Python app's DEFAULTS.
pub fn default_structure(to: &str, source: &str) -> &'static str {
    match (to == "word", source) {
        (true, "passage") => "reading",
        (true, "lesson") => "script",
        (true, _) => "dossier",
        (false, "passage") => "reader",
        (false, "lesson") => "pulpit",
        (false, _) => "map",
    }
}

/// The structure to use: `name`, or this source's default; refused when it cannot be made from the source, or is not made
/// in this app yet.
pub fn structure_of(to: &str, name: Option<&str>, source: &str) -> Result<&'static Structure> {
    let t = table(to);
    let key = name.filter(|n| !n.is_empty()).unwrap_or_else(|| default_structure(to, source));
    let what = if to == "word" { "Word" } else { "Slides" };
    let st = t.iter().find(|s| s.key == key).ok_or_else(|| Error(format!("{what}: {}.", t.iter().map(|s| s.key).collect::<Vec<_>>().join(", "))))?;
    if !st.sources.contains(&source) {
        let fits: Vec<&str> = t.iter().filter(|s| s.sources.contains(&source)).map(|s| s.key).collect();
        return Err(Error(format!("{} is made from a {}. From a {source}: {}.", st.label, st.sources.join(" or "), fits.join(", "))));
    }
    if !st.made_here {
        let here: Vec<&str> = t.iter().filter(|s| s.made_here && s.sources.contains(&source)).map(|s| s.key).collect();
        return Err(Error(format!(
            "{} is still made by the Python app (the rest of the structures come in phase 5). Here: --structure {}.",
            st.label,
            here.join(" or ")
        )));
    }
    Ok(st)
}

// ---- your notes and highlights, by verse --------------------------------------------------------------------------------

type VerseKey = (String, i64, i64);

/// A person's notes and highlights as a document needs them: per verse, with highlights as character ranges in its text
/// (craft_plan.Margin).
pub struct Margin<'a> {
    bible: &'a Bible,
    store: &'a Store,
    codes: HashMap<String, (String, i64)>, // book name -> (code, id)
    by_verse: Vec<(VerseKey, Vec<Rec>)>,
    at: HashMap<VerseKey, usize>,
    by_lemma: HashMap<String, Vec<String>>,
    offsets: HashMap<(i64, i64, i64), Option<Vec<(usize, usize)>>>,
    marks: HashMap<VerseKey, Vec<(usize, usize)>>,
    seen: HashSet<String>,
}

fn int(v: &Value) -> Option<i64> {
    v.as_i64()
}

impl<'a> Margin<'a> {
    pub fn new(bible: &'a Bible, store: &'a Store) -> Result<Margin<'a>> {
        let codes = bible.books().iter().map(|b| (b.name.clone(), (b.code.clone(), b.id as i64))).collect();
        let mut m = Margin { bible, store, codes, by_verse: vec![], at: HashMap::new(), by_lemma: HashMap::new(), offsets: HashMap::new(),
            marks: HashMap::new(), seen: HashSet::new() };
        for n in store.notes() {
            let p = anchors::py_parse(&s(n, "anchor"))?;
            if p["kind"] == "lemma" {
                m.by_lemma.entry(s(&p, "strong")).or_default().push(s(n, "text").trim().to_string());
            } else {
                let key = (s(&p, "code"), int(&p["c1"]).unwrap_or(0), int(&p["v1"]).unwrap_or(0));
                let i = *m.at.entry(key.clone()).or_insert_with(|| {
                    m.by_verse.push((key, vec![]));
                    m.by_verse.len() - 1
                });
                m.by_verse[i].1.push(n.clone());
            }
        }
        Ok(m)
    }

    pub fn reset(&mut self) {
        self.seen.clear();
    }

    fn code(&self, verse: &Value) -> String {
        self.codes.get(verse["book"].as_str().unwrap_or("")).map(|c| c.0.clone()).unwrap_or_default()
    }

    /// Your notes that start on these verses, each given once in a plan however often the place comes round. A note on a
    /// word or phrase says which.
    pub fn notes(&mut self, verses: &[Value]) -> Vec<String> {
        let mut out = vec![];
        for v in verses {
            let key = (self.code(v), int(&v["c"]).unwrap_or(0), int(&v["v"]).unwrap_or(-1));
            let Some(&i) = self.at.get(&key) else { continue };
            for n in &self.by_verse[i].1 {
                let id = s(n, "id");
                if self.seen.insert(id) {
                    let quote = s(n, "quote");
                    let part = (s(n, "kind") == "word" || s(n, "kind") == "phrase") && !quote.is_empty();
                    out.push(format!("{}{}", if part { format!("“{}”: ", one_line(&quote)) } else { String::new() }, s(n, "text").trim()));
                }
            }
        }
        out
    }

    pub fn lemma_notes(&self, strong: &str) -> Vec<String> {
        self.by_lemma.get(strong).cloned().unwrap_or_default()
    }

    /// Notes on exactly this anchor, in the order the margin holds them.
    fn anchor_notes(&self, anchor: &str) -> Vec<String> {
        self.by_verse.iter().flat_map(|(_, ns)| ns).filter(|n| s(n, "anchor") == anchor).map(|n| s(n, "text").trim().to_string()).collect()
    }

    /// [(start, end)] of each KJV word in its verse's text (in characters), or None if the two do not line up.
    fn word_offsets(&mut self, book_id: i64, c: i64, v: i64, text: &str) -> Option<Vec<(usize, usize)>> {
        let key = (book_id, c, v);
        if !self.offsets.contains_key(&key) {
            let low: Vec<char> = text.to_lowercase().chars().collect();
            let mut spans = Some(vec![]);
            let mut at = 0usize;
            let words: Vec<String> = self
                .bible
                .conn()
                .prepare_cached("SELECT text FROM words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY idx")
                .and_then(|mut st| st.query_map([book_id, c, v], |r| r.get::<_, String>(0))?.collect())
                .unwrap_or_default();
            for w in words {
                let wl: Vec<char> = w.to_lowercase().chars().collect();
                match find_chars(&low, &wl, at) {
                    Some(hit) => {
                        spans.as_mut().unwrap().push((hit, hit + w.chars().count()));
                        at = hit + w.chars().count();
                    }
                    None => {
                        spans = None;
                        break;
                    }
                }
            }
            self.offsets.insert(key, spans);
        }
        self.offsets[&key].clone()
    }

    /// The character ranges an anchor (parsed) covers in this verse: none, or the whole verse for a verse anchor.
    pub fn anchor_spans(&mut self, verse: &Value, p: &Map<String, Value>) -> Vec<(usize, usize)> {
        let here = (int(&verse["c"]).unwrap_or(0), int(&verse["v"]).unwrap_or(0));
        let first = (int(&p["c1"]).unwrap_or(0), int(&p["v1"]).unwrap_or(0));
        let last = match int(&p["c2"]) {
            Some(c2) => (c2, int(&p["v2"]).unwrap_or(0)),
            None => first,
        };
        if s(p, "code") != self.code(verse) || !(first <= here && here <= last) {
            return vec![];
        }
        let text = verse["text"].as_str().unwrap_or("");
        let Some(i1) = int(&p["i1"]) else { return vec![(0, text.chars().count())] };
        let book_id = self.codes.get(verse["book"].as_str().unwrap_or("")).map(|c| c.1).unwrap_or(0);
        let Some(words) = self.word_offsets(book_id, here.0, here.1, text) else { return vec![] };
        if words.is_empty() {
            return vec![];
        }
        let a = if here == first { i1 } else { 0 };
        let b = if here == last { int(&p["i2"]).unwrap_or(i1) } else { words.len() as i64 - 1 };
        if !(0 <= a && a <= b && b < words.len() as i64) {
            return vec![];
        }
        vec![(words[a as usize].0, words[b as usize].1)]
    }

    /// Where your highlights fall in a verse. They are anchored to KJV words, so another version shows none.
    pub fn marks(&mut self, verse: &Value, version: &str) -> Vec<(usize, usize)> {
        if version != "KJV" {
            return vec![];
        }
        let key = (self.code(verse), int(&verse["c"]).unwrap_or(0), int(&verse["v"]).unwrap_or(0));
        if !self.marks.contains_key(&key) {
            let mut spans = vec![];
            for h in self.store.highlights(&key.0) {
                if let Ok(p) = anchors::py_parse(&s(&h, "anchor")) {
                    spans.extend(self.anchor_spans(verse, &p));
                }
            }
            self.marks.insert(key.clone(), merge_spans(spans));
        }
        self.marks[&key].clone()
    }
}

fn find_chars(hay: &[char], needle: &[char], from: usize) -> Option<usize> {
    if needle.is_empty() {
        return (from <= hay.len()).then_some(from);
    }
    (from..=hay.len().saturating_sub(needle.len())).find(|&i| i + needle.len() <= hay.len() && hay[i..i + needle.len()] == *needle)
}

pub fn merge_spans(mut spans: Vec<(usize, usize)>) -> Vec<(usize, usize)> {
    spans.sort();
    let mut out: Vec<(usize, usize)> = vec![];
    for (a, b) in spans {
        match out.last_mut() {
            Some(l) if a <= l.1 => l.1 = l.1.max(b),
            _ => out.push((a, b)),
        }
    }
    out
}

fn spans_json(spans: &[(usize, usize)]) -> Value {
    json!(spans.iter().map(|(a, b)| json!([a, b])).collect::<Vec<_>>())
}

pub fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn clean_definition(text: &str) -> String {
    regex::Regex::new(r"\[\[([HG]\d+)\]\]").unwrap().replace_all(text, "$1").into_owned()
}

/// A word card's facts, all from the lexicon. None if there is no such number.
pub(crate) fn word_entry(bible: &Bible, strong: &str) -> Result<Option<Value>> {
    let Some(e) = lookup::strong(bible, strong)? else { return Ok(None) };
    let rows = e["renderings"].as_array().cloned().unwrap_or_default();
    let occ: i64 = rows.iter().map(|r| r["n"].as_i64().unwrap_or(0)).sum();
    let str_or = |k: &str| e[k].as_str().unwrap_or("").to_string();
    Ok(Some(json!({"strong": strong, "lemma": str_or("lemma"), "translit": str_or("translit"),
        "definition": clean_definition(&str_or("definition")),
        "renderings": rows.iter().take(4).map(|r| json!([r["w"], r["n"]])).collect::<Vec<_>>(), "occurrences": occ, "notes": []})))
}

// ---- sources ---------------------------------------------------------------------------------------------------------

/// A thread (as studyapi::thread_view gives it) as places and words (craft_plan.thread_source). A word or phrase whose
/// verses are already a place in the thread is picked out there and adds its notes to it; otherwise it is a place of its
/// own, showing its whole verses.
pub fn thread_source(bible: &Bible, view: &Value, margin: &mut Margin) -> Result<Value> {
    let members: Vec<(Value, Map<String, Value>)> = view["members"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| Ok((m.clone(), anchors::py_parse(m["anchor"].as_str().unwrap_or(""))?)))
        .collect::<Result<_>>()?;
    let ok = |m: &Value| m.get("ok").map(|o| o != false).unwrap_or(true);
    let span_of = |p: &Map<String, Value>| {
        let first = (int(&p["c1"]).unwrap_or(0), int(&p["v1"]).unwrap_or(0));
        let last = match int(&p["c2"]) {
            Some(c2) => (c2, int(&p["v2"]).unwrap_or(0)),
            None => first,
        };
        (first, last)
    };
    let whole: Vec<usize> = (0..members.len()).filter(|&i| matches!(s_(&members[i].0, "kind"), "verse" | "verses") && ok(&members[i].0)).collect();
    let host_of = |i: usize| -> Option<usize> {
        let (m, p) = &members[i];
        if !matches!(s_(m, "kind"), "word" | "phrase") {
            return None;
        }
        let (a, b) = span_of(p);
        whole.iter().copied().find(|&w| {
            let wp = &members[w].1;
            s(wp, "code") == s(p, "code") && span_of(wp).0 <= a && b <= span_of(wp).1
        })
    };
    let mut hosted: HashMap<String, Vec<usize>> = HashMap::new();
    for i in 0..members.len() {
        if let Some(h) = host_of(i) {
            hosted.entry(s_(&members[h].0, "anchor").to_string()).or_default().push(i);
        }
    }
    let (mut places, mut words): (Vec<Value>, Vec<Value>) = (vec![], vec![]);
    let mut add_word = |strong: &str, margin: &Margin| -> Result<()> {
        if words.iter().any(|w| w["strong"] == strong) {
            return Ok(());
        }
        if let Some(mut e) = word_entry(bible, strong)? {
            e["notes"] = json!(margin.lemma_notes(strong));
            words.push(e);
        }
        Ok(())
    };
    let books = bible.books();
    for i in 0..members.len() {
        let (m, p) = &members[i];
        let kind = s_(m, "kind");
        if kind == "lemma" {
            add_word(&s(p, "strong"), margin)?;
            continue;
        }
        if kind == "word" {
            if let Some(first) = m["strongs"].as_array().and_then(|a| a.first()).and_then(|x| x.as_str()) {
                add_word(first, margin)?;
            }
        }
        if host_of(i).is_some() {
            continue;
        }
        let anchor = s_(m, "anchor").to_string();
        let inside = hosted.get(&anchor).cloned().unwrap_or_default();
        let mut notes = margin.anchor_notes(&anchor);
        for &x in &inside {
            for t in margin.anchor_notes(s_(&members[x].0, "anchor")) {
                notes.push(format!("“{}”: {t}", one_line(s_(&members[x].0, "quote"))));
            }
        }
        let mut picked: Vec<&Map<String, Value>> = inside.iter().map(|&x| &members[x].1).collect();
        if matches!(kind, "word" | "phrase") {
            picked.push(p);
        }
        let verses: Vec<Value> = if !ok(m) {
            vec![json!({"v": null, "text": one_line(s_(m, "quote")), "emph": []})]
        } else {
            let (first, last) = span_of(p);
            let book = books.iter().find(|b| b.code == s(p, "code")).ok_or_else(|| Error(format!("No such book: {}", s(p, "code"))))?.clone();
            let span = Span { book, c1: first.0 as u32, v1: first.1 as u32, c2: last.0 as u32, v2: last.1 as u32 };
            let mut vs = scripture::verses(bible, &span, "KJV")?;
            for v in vs.iter_mut() {
                let mut sp = vec![];
                for q in &picked {
                    sp.extend(margin.anchor_spans(v, q));
                }
                v["emph"] = spans_json(&merge_spans(sp));
            }
            vs
        };
        let mark = if matches!(kind, "word" | "phrase") {
            one_line(s_(m, "quote"))
        } else if let Some(&x) = inside.first() {
            one_line(s_(&members[x].0, "quote"))
        } else {
            String::new()
        };
        let quote = shorten(&if mark.is_empty() { verses.iter().map(|v| v["text"].as_str().unwrap_or("")).collect::<Vec<_>>().join(" ") } else { mark.clone() }, 72);
        places.push(json!({"label": m["label"], "version": "KJV", "verses": verses, "notes": notes, "marked": mark, "quote": quote}));
    }
    Ok(json!({"name": one_line(view["name"].as_str().unwrap_or("")), "note": view["note"].as_str().unwrap_or("").trim(),
        "places": places, "words": words}))
}

fn s_<'v>(v: &'v Value, k: &str) -> &'v str {
    v[k].as_str().unwrap_or("")
}

fn shorten(text: &str, width: usize) -> String {
    let text = one_line(text);
    if text.chars().count() <= width {
        return text;
    }
    let cut: String = text.chars().take(width).collect();
    format!("{}…", cut.rsplit_once(' ').map(|(a, _)| a.to_string()).unwrap_or(cut.clone()))
}

/// A block of a plan's source, as the Python app's (kind, value) tuples.
pub type Block = (String, Value);

/// A thread read like a lesson: the thread's note is the speech, each place a scripture in the thread's order, then the
/// original words you added. A place whose reference no longer reads is left out (craft_plan.thread_blocks).
pub fn thread_blocks(thread: &Value) -> Vec<Block> {
    let mut blocks = vec![("title".to_string(), thread["name"].clone())];
    let note = s_(thread, "note");
    if !note.is_empty() {
        blocks.push(("speech".into(), json!(one_line(note))));
    }
    for p in thread["places"].as_array().unwrap() {
        let verses: Vec<Value> = p["verses"].as_array().unwrap().iter().filter(|v| !v["v"].is_null()).cloned().collect();
        if !verses.is_empty() {
            blocks.push(("scripture".into(), json!({"label": p["label"], "version": p["version"], "verses": verses})));
        }
    }
    for w in thread["words"].as_array().unwrap() {
        blocks.push(("word".into(), w.clone()));
    }
    blocks
}

/// Every verse's text a finished file must hold, taken from the source and never from a plan.
pub fn source_verses(blocks: &[Block]) -> Vec<String> {
    let mut out = vec![];
    for (what, val) in blocks {
        if what == "scripture" {
            out.extend(val["verses"].as_array().unwrap().iter().map(|v| s_(v, "text").to_string()));
        }
    }
    out
}

/// Each verse the source holds, by its reference and version ("Numbers 25:11 (KJV)"), in order: the list the window shows
/// as checked once the file is kept.
pub fn source_refs(blocks: &[Block]) -> Vec<String> {
    let mut out = vec![];
    for (what, val) in blocks {
        if what == "scripture" {
            out.extend(val["verses"].as_array().unwrap().iter().map(|v| format!("{} ({})", s_(v, "ref"), s_(val, "version"))));
        }
    }
    out
}

// ---- slides ----------------------------------------------------------------------------------------------------------

const SLIDE_VERSES: usize = 3;
const SLIDE_CHARS: usize = 340;

/// A passage cut at verse boundaries, and between places when it names several.
fn split_verses(verses: &[Value]) -> Vec<Vec<Value>> {
    let (mut out, mut rows, mut size): (Vec<Vec<Value>>, Vec<Value>, usize) = (vec![], vec![], 0);
    for v in verses {
        let len = s_(v, "text").chars().count();
        if let Some(last) = rows.last() {
            if rows.len() >= SLIDE_VERSES || size + len > SLIDE_CHARS || v.get("span") != last.get("span") {
                out.push(std::mem::take(&mut rows));
                size = 0;
            }
        }
        rows.push(v.clone());
        size += len;
    }
    if !rows.is_empty() {
        out.push(rows);
    }
    out
}

fn title_of(blocks: &[Block]) -> String {
    blocks.iter().find(|(k, _)| k == "title").map(|(_, v)| v.as_str().unwrap_or("").to_string()).unwrap_or_else(|| "Lesson".into())
}

fn run_label(rows: &[Value]) -> String {
    let (a, b) = (&rows[0], &rows[rows.len() - 1]);
    if (&a["c"], &a["v"]) == (&b["c"], &b["v"]) {
        return s_(a, "ref").to_string();
    }
    if a["c"] == b["c"] && a["book"] == b["book"] {
        return format!("{}–{}", s_(a, "ref"), b["v"]);
    }
    format!("{}–{}:{}", s_(a, "ref"), b["c"], b["v"])
}

fn ref_of(rows: &[Value], version: &str) -> String {
    format!("{} ({version})", run_label(rows))
}

/// The Pulpit deck's slides as (kind, key): what the Speaker Script numbers its cues by, so the script and the clicker agree.
fn pulpit_keys(blocks: &[Block], margin: &mut Margin) -> Vec<(String, String)> {
    margin.reset();
    let mut out = vec![("title".to_string(), String::new())];
    for (what, val) in blocks {
        match what.as_str() {
            "section" => out.push(("section".into(), val.as_str().unwrap_or("").into())),
            "word" => out.push(("word".into(), s_(val, "strong").into())),
            "scripture" => {
                for rows in split_verses(val["verses"].as_array().unwrap()) {
                    margin.notes(&rows);
                    out.push(("scripture".into(), ref_of(&rows, s_(val, "version"))));
                }
            }
            "parallel" => out.push(("parallel".into(), s_(&val[0], "label").into())),
            _ => {}
        }
    }
    out
}

/// Verse by Verse: one verse to a slide, the verses either side, your highlights and your notes there (craft_plan.deck_verse).
pub fn deck_verse(blocks: &[Block], margin: &mut Margin) -> Vec<Value> {
    margin.reset();
    let mut out = vec![json!({"kind": "title", "title": title_of(blocks), "sub": ""})];
    for (what, val) in blocks {
        match what.as_str() {
            "section" => out.push(json!({"kind": "section", "title": val})),
            "scripture" => {
                let version = s_(val, "version").to_string();
                let vs = val["verses"].as_array().unwrap();
                for (i, v) in vs.iter().enumerate() {
                    let near = |o: &Value| if o.get("span") == v.get("span") { o.clone() } else { Value::Null };
                    let marks = margin.marks(v, &version);
                    let notes = margin.notes(std::slice::from_ref(v)).join("\n\n");
                    out.push(json!({"kind": "verse", "ref": format!("{} ({version})", s_(v, "ref")), "verse": v,
                        "before": if i > 0 { near(&vs[i - 1]) } else { Value::Null },
                        "after": if i + 1 < vs.len() { near(&vs[i + 1]) } else { Value::Null },
                        "marks": spans_json(&marks), "notes": notes}));
                }
            }
            _ => {}
        }
    }
    out
}

// ---- Word documents --------------------------------------------------------------------------------------------------

/// A run of text and its format (num, mark, lemma), or none.
fn run(text: &str, fmt: Option<&str>) -> Value {
    json!([text, fmt])
}

/// ("para", style, runs, page_break), as craft_plan.para.
fn para(style: &str, runs: Vec<Value>, page_break: bool) -> Value {
    json!(["para", style, runs, page_break])
}

fn plain(style: &str, text: &str) -> Value {
    para(style, vec![run(text, None)], false)
}

/// Verses flowing in one paragraph, each with its number.
fn verse_runs(verses: &[Value]) -> Vec<Value> {
    let mut out = vec![];
    for (i, v) in verses.iter().enumerate() {
        if !v["v"].is_null() {
            out.push(run(&v["v"].to_string(), Some("num")));
            out.push(run(" ", None));
        }
        let t = s_(v, "text");
        if !t.is_empty() {
            out.push(run(t, None));
        }
        if i + 1 < verses.len() {
            out.push(run(" ", None));
        }
    }
    out
}

fn word_ops(e: &Value, notes: &[String]) -> Vec<Value> {
    // "%s (%d)" % (word, count): a word the lexicon has as null reads None there too
    let rendered: Vec<String> =
        e["renderings"].as_array().unwrap().iter().map(|r| format!("{} ({})", r[0].as_str().unwrap_or("None"), r[1])).collect();
    let mut ops = vec![
        plain("Heading 2", &format!("{}  ·  {} uses in the KJV", s_(e, "strong"), e["occurrences"])),
        para("Word Line", vec![run(&format!("{} ", s_(e, "lemma")), Some("lemma")), run(&format!("{}: {}", s_(e, "translit"), s_(e, "definition")), None)], false),
        plain("Study Note", &format!("Rendered: {}", rendered.join(", "))),
    ];
    ops.extend(notes.iter().map(|n| plain("Study Note", n)));
    ops
}

fn scripture_block(rf: &str, verses: &[Value]) -> Vec<Value> {
    vec![plain("Scripture Reference", rf), para("Scripture End", verse_runs(verses), false)]
}

/// The Speaker Script: everything in large print, with a cue where each Pulpit slide comes up (craft_plan.doc_script).
pub fn doc_script(blocks: &[Block], margin: &mut Margin) -> Vec<Value> {
    let mut numbers: HashMap<(String, String), std::collections::VecDeque<usize>> = HashMap::new();
    for (i, k) in pulpit_keys(blocks, margin).into_iter().enumerate() {
        numbers.entry(k).or_default().push_back(i + 1);
    }
    margin.reset();
    let mut cue = |kind: &str, key: &str, label: &str| -> Vec<Value> {
        match numbers.get_mut(&(kind.to_string(), key.to_string())).and_then(|q| q.pop_front()) {
            Some(n) => vec![plain("Slide Cue", &format!("SLIDE {n}{}", if label.is_empty() { String::new() } else { format!("  ·  {label}") }))],
            None => vec![],
        }
    };
    let mut ops = vec![plain("Title", &title_of(blocks)), plain("Subtitle", "Speaker's script")];
    let mut first = true;
    for (what, val) in blocks {
        match what.as_str() {
            "section" => {
                let t = val.as_str().unwrap_or("");
                ops.push(para("Heading 1", vec![run(t, None)], !first));
                first = false;
                ops.extend(cue("section", t, ""));
            }
            "speech" => ops.push(plain("Normal", val.as_str().unwrap_or(""))),
            "note" => ops.push(plain("Delivery Note", &format!("Note: {}", val.as_str().unwrap_or("")))),
            "word" => {
                let strong = s_(val, "strong").to_string();
                ops.extend(cue("word", &strong, &strong));
                ops.extend(word_ops(val, &margin.lemma_notes(&strong)));
            }
            "scripture" => {
                for rows in split_verses(val["verses"].as_array().unwrap()) {
                    let rf = ref_of(&rows, s_(val, "version"));
                    ops.extend(cue("scripture", &rf, ""));
                    ops.extend(scripture_block(&rf, &rows));
                    ops.extend(margin.notes(&rows).into_iter().map(|n| plain("Study Note", &format!("Study: {n}"))));
                }
            }
            _ => {}
        }
    }
    ops
}

/// Body size and line spacing of a Word structure (craft_plan.DOC_TYPE).
pub fn doc_type(structure: &str) -> (f64, f64) {
    match structure {
        "reading" => (11.0, 1.2),
        "share" => (12.0, 1.32),
        "script" => (14.0, 1.32),
        "study" => (11.5, 1.2),
        _ => (11.5, 1.28),
    }
}

/// The plan of a structure from a thread's places (`to`: word, deck or pdf; a deck's plan is the same in PDF pages).
pub fn plan_of(to: &str, structure: &str, thread: &Value, margin: &mut Margin) -> Result<Vec<Value>> {
    plan_of_blocks(to, structure, &thread_blocks(thread), margin)
}

/// The plan of a structure from a source read as blocks (a thread's, or a page's: docs/page.rs).
pub fn plan_of_blocks(to: &str, structure: &str, blocks: &[Block], margin: &mut Margin) -> Result<Vec<Value>> {
    match (to == "word", structure) {
        (true, "script") => Ok(doc_script(blocks, margin)),
        (false, "verse") => Ok(deck_verse(blocks, margin)),
        // R3's shipped templates over the same two layouts (docs/redesign-R3.md, decision 3): planned here only, so their
        // fingerprints are this app's own
        (true, "share") => Ok(from_script(blocks, margin, "Share copy", &["Slide Cue", "Study Note", "Delivery Note"], false)),
        (true, "study") => Ok(from_script(blocks, margin, "Study sheet", &["Slide Cue", "Delivery Note"], true)),
        (true, "reading") => Ok(from_script(blocks, margin, "Reading sheet", &["Slide Cue", "Study Note", "Delivery Note", "Normal", "Word Line"], false)),
        (false, "reader") => Ok(deck_verse(blocks, margin).into_iter().map(|mut s| {
            if s["kind"] == "verse" {
                s["before"] = Value::Null;
                s["after"] = Value::Null;
            }
            s
        }).collect()),
        _ => Err(Error(format!(
            "{} is still made by the Python app; its plan comes with the rest of the structures in phase 5.",
            structure_label(to, structure)
        ))),
    }
}

/// A Word template made from the Speaker Script's plan: its own subtitle, some styles left out, and (`room`) three
/// lines to write on after each passage.
fn from_script(blocks: &[Block], margin: &mut Margin, subtitle: &str, leave_out: &[&str], room: bool) -> Vec<Value> {
    let mut out = vec![];
    let mut pending = false;
    for op in doc_script(blocks, margin) {
        let style = op[1].as_str().unwrap_or("").to_string();
        if leave_out.contains(&style.as_str()) {
            continue;
        }
        if style == "Subtitle" {
            out.push(plain("Subtitle", subtitle));
            continue;
        }
        // the lines to write on come after a passage and the notes on it
        if room && pending && style != "Study Note" {
            out.extend((0..3).map(|_| plain("Write Line", "")));
            pending = false;
        }
        pending |= style == "Scripture End";
        out.push(op);
    }
    if room && pending {
        out.extend((0..3).map(|_| plain("Write Line", "")));
    }
    out
}

pub fn structure_label(to: &str, structure: &str) -> &'static str {
    self::structure(to, structure).map(|s| s.label).unwrap_or("That structure")
}

// ---- the fingerprint --------------------------------------------------------------------------------------------------

/// `json.dumps(plan, ensure_ascii=False, sort_keys=True)`'s SHA-256, as documents.fingerprint: the same plan gives the same
/// fingerprint in both apps.
pub fn fingerprint(plan: &[Value]) -> String {
    fn sorted(v: &Value) -> Value {
        match v {
            Value::Object(m) => {
                let mut keys: Vec<&String> = m.keys().collect();
                keys.sort();
                Value::Object(keys.into_iter().map(|k| (k.clone(), sorted(&m[k]))).collect())
            }
            Value::Array(a) => Value::Array(a.iter().map(sorted).collect()),
            x => x.clone(),
        }
    }
    sha256_hex(crate::store::py_dumps(&sorted(&json!(plan))).as_bytes())
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}
