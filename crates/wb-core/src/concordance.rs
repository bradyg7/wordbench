//! The Concordance (design/features/concordance, accepted 2026-11-16): the printed Strong's as a book. English words
//! with every place (C1, C7, C9, C19, C20), the Hebrew and Greek entries in number order with every place (C3, C4, C8),
//! the box's suggestions (C2, C24, C25) and the two settings it keeps. Every answer is a view of the Bible database; the
//! only thing kept in the study folder is the choice of All forms / This word and the click-on-a-word choice (settings).
//!
//! Scripture here is never typed: a place's words are the database's own, either side of the marked word.

use crate::bible::{Bible, Book};
use crate::lookup::{self, PAGE};
use crate::store::Store;
use crate::{Error, Result};
use rusqlite::params;
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;

fn bad(msg: impl Into<String>) -> Error {
    Error(msg.into())
}

/// Words either side of the marked word on a place line (the design draws four on C15 and C19).
pub const AROUND: usize = 4;
/// Lines each group shows before "N more" (C-3).
pub const GROUP_LINES: usize = 4;
/// Rows a group of the box shows at most (C-12).
pub const BOX_ROWS: usize = 3;
/// Entries on one page of a dictionary's list.
pub const LIST_PAGE: usize = 100;

/// The commonest small words, given with references only, as the printed concordance's appendix does (C-2). The design
/// names and, the and of; the others are the same kind (articles, prepositions, pronouns, the verb "to be" and "shall").
pub const SMALL: &[&str] = &[
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "had", "has", "have", "he", "her", "him", "his", "i", "in", "is", "it", "me",
    "my", "not", "of", "on", "or", "our", "shall", "that", "the", "their", "them", "they", "thee", "thou", "thy", "to", "unto", "us", "was", "we",
    "were", "which", "with", "ye", "you", "your",
];

fn small(word: &str) -> bool {
    SMALL.contains(&word)
}

// ---- places ---------------------------------------------------------------------------------------------------------

/// One marked stretch of a verse: the book, chapter, verse, its first and last word (idx), its number and its words.
#[derive(Clone)]
struct Occ {
    b: u32,
    c: u32,
    v: u32,
    first: i64,
    last: i64,
    strong: String,
    rendering: String,
}

fn book_of(bible: &Bible, id: u32) -> Result<&Book> {
    bible.books().iter().find(|b| b.id == id).ok_or_else(|| bad("no such book"))
}

/// Each occurrence of an English word (any case), one per word in the verse.
fn token_occs(bible: &Bible, word: &str) -> Result<Vec<Occ>> {
    let mut stmt = bible.conn().prepare_cached("SELECT book, chapter, verse, idx, strong, text FROM words WHERE text = ? COLLATE NOCASE")?;
    let it = stmt.query_map([word], |r| {
        Ok(Occ { b: r.get(0)?, c: r.get(1)?, v: r.get(2)?, first: r.get(3)?, last: r.get(3)?, strong: r.get::<_, Option<String>>(4)?.unwrap_or_default(), rendering: r.get::<_, String>(5)?.to_lowercase() })
    })?;
    Ok(it.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Each occurrence of an original word, one per tagged unit, like `wb strong`'s renderings (H7068: jealousy 24).
fn unit_occs(bible: &Bible, strong: &str) -> Result<Vec<Occ>> {
    let mut stmt = bible.conn().prepare_cached("SELECT book, chapter, verse, idx, grp, text FROM words WHERE strong = ? ORDER BY book, chapter, verse, idx")?;
    let it = stmt.query_map([strong], |r| Ok(((r.get::<_, u32>(0)?, r.get::<_, u32>(1)?, r.get::<_, u32>(2)?, r.get::<_, i64>(4)?), r.get::<_, i64>(3)?, r.get::<_, String>(5)?)))?;
    let mut order: Vec<(u32, u32, u32, i64)> = vec![];
    let mut units: BTreeMap<(u32, u32, u32, i64), (i64, i64, Vec<String>)> = BTreeMap::new();
    for x in it {
        let (k, idx, text) = x?;
        let u = units.entry(k).or_insert_with(|| {
            order.push(k);
            (idx, idx, vec![])
        });
        u.1 = idx;
        u.2.push(text);
    }
    let mut out: Vec<Occ> = order
        .into_iter()
        .map(|k| {
            let (first, last, t) = &units[&k];
            Occ { b: k.0, c: k.1, v: k.2, first: *first, last: *last, strong: strong.to_string(), rendering: t.join(" ").to_lowercase() }
        })
        .collect();
    out.sort_by_key(|o| (o.b, o.c, o.v, o.first));
    Ok(out)
}

struct W {
    idx: i64,
    shown: String,
}

fn words_of(bible: &Bible, keys: &[(u32, u32, u32)]) -> Result<BTreeMap<(u32, u32, u32), Vec<W>>> {
    let mut out: BTreeMap<(u32, u32, u32), Vec<W>> = BTreeMap::new();
    let mut stmt = bible.conn().prepare_cached("SELECT idx, lead, text, trail FROM words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY idx")?;
    for k in keys {
        if out.contains_key(k) {
            continue;
        }
        let it = stmt.query_map(params![k.0, k.1, k.2], |r| {
            Ok(W { idx: r.get(0)?, shown: format!("{}{}{}", r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?) })
        })?;
        out.insert(*k, it.collect::<rusqlite::Result<Vec<_>>>()?);
    }
    Ok(out)
}

/// The places as lines: the reference, the anchor, the words either side (none for `refs_only`), the marked words and the number.
fn lines(bible: &Bible, occs: &[&Occ], around: usize, refs_only: bool) -> Result<Vec<Value>> {
    let keys: Vec<_> = if refs_only { vec![] } else { occs.iter().map(|o| (o.b, o.c, o.v)).collect() };
    let verse = words_of(bible, &keys)?;
    let mut out = vec![];
    for o in occs {
        let b = book_of(bible, o.b)?;
        let anchor = format!("{}.{}:{}.{}", b.code, o.c, o.v, o.first) + &if o.last != o.first { format!("-{}:{}.{}", o.c, o.v, o.last) } else { String::new() };
        let mut line = json!({"ref": format!("{} {}:{}", b.name, o.c, o.v), "code": b.code, "book": b.name, "c": o.c, "v": o.v, "i": o.first, "anchor": anchor, "strong": o.strong});
        if !refs_only {
            let ws = &verse[&(o.b, o.c, o.v)];
            // a word keeps its own spaces and punctuation in the database: joined, then the spaces made single
            let join = |it: Vec<&W>| it.into_iter().map(|w| w.shown.as_str()).collect::<String>().split_whitespace().collect::<Vec<_>>().join(" ");
            let before: Vec<&W> = ws.iter().filter(|w| w.idx < o.first).collect();
            let after: Vec<&W> = ws.iter().filter(|w| w.idx > o.last).take(around).collect();
            let inside: Vec<&W> = ws.iter().filter(|w| w.idx >= o.first && w.idx <= o.last).collect();
            // before + word + after read as the verse does: the marked word without its punctuation, which goes to `after`
            let marked = join(inside);
            let kept = marked.trim_end_matches(|c: char| !c.is_alphanumeric());
            let tail = marked[kept.len()..].to_string();
            let word = kept.trim_start_matches(|c: char| !c.is_alphanumeric());
            let lead = kept[..kept.len() - word.len()].to_string();
            let (b, a) = (join(before[before.len().saturating_sub(around)..].to_vec()), join(after));
            line["before"] = json!(if b.is_empty() { lead } else { format!("{b} {lead}") });
            line["word"] = json!(word);
            line["after"] = json!(if a.is_empty() { tail } else if tail.is_empty() { format!(" {a}") } else { format!("{tail} {a}") });
        }
        out.push(line);
    }
    Ok(out)
}

fn count_by_book(bible: &Bible, occs: &[Occ]) -> Vec<(u32, usize)> {
    let mut m: BTreeMap<u32, usize> = BTreeMap::new();
    for o in occs {
        *m.entry(o.b).or_default() += 1;
    }
    let _ = bible;
    m.into_iter().collect()
}

// ---- the English page (C1, C7, C9, C19, C20) -----------------------------------------------------------------------

/// The word without its endings, while what is left is still a word of the KJV: zealously, zealous, zeal.
fn stem(bible: &Bible, word: &str) -> String {
    let mut w = word.to_string();
    'again: loop {
        for end in ["ly", "ous", "ness", "ful", "ing", "ed", "es", "s", "er"] {
            if let Some(base) = w.strip_suffix(end) {
                if base.chars().count() >= 4 && lookup::known_word(bible, base).map(|k| k["known"] == true).unwrap_or(false) {
                    w = base.to_string();
                    continue 'again;
                }
            }
        }
        return w;
    }
}

/// The forms of a word as the page offers them (`wb forms` of its stem, zeal for zealous): the word first, then the others
/// by count, so a word's own page names its other forms (zealous: zeal 16, zealously 2).
fn form_rows(bible: &Bible, word: &str) -> Result<Vec<Value>> {
    let mut rows = lookup::forms(bible, &stem(bible, word))?["forms"].as_array().cloned().unwrap_or_default();
    rows.sort_by_key(|f| f["form"].as_str() != Some(word));
    Ok(rows)
}

/// `wb concordance <word> [--forms all|one] [--book NUM]`. `all` is every form that starts with the word (zeal, zealous,
/// zealously), `one` the word alone. A page of 100 places or fewer is one run (kind "run"); more is shown under its books
/// (kind "books"), 4 lines and "more" each; a small word shows references only (kind "refs", the same grouping). With
/// `book`, only that book's group, every line of it.
pub fn page(bible: &Bible, word: &str, mode: &str, book: Option<&str>) -> Result<Value> {
    let word = word.trim().to_lowercase();
    if !lookup::is_word(&word) {
        return Err(bad("Give one English word, like zeal."));
    }
    if mode != "all" && mode != "one" {
        return Err(bad("Forms are all or one."));
    }
    let is_small = small(&word);
    // a small word's other forms by beginning (the, thee, their, ...) are other words: it is shown alone
    let mode = if is_small { "one" } else { mode };
    // a small word has no other forms to offer: its prefix forms (a, i, he) are other words, thousands of them
    let forms = if is_small { vec![] } else { form_rows(bible, &word)? };
    let names: Vec<String> = if mode == "all" {
        let mut v: Vec<String> = forms.iter().filter_map(|f| f["form"].as_str().map(String::from)).collect();
        if !v.contains(&word) {
            v.insert(0, word.clone());
        }
        v
    } else {
        vec![word.clone()]
    };
    let mut occs: Vec<Occ> = vec![];
    for n in &names {
        occs.extend(token_occs(bible, n)?);
    }
    occs.sort_by_key(|o| (o.b, o.c, o.v, o.first));
    let by_book = count_by_book(bible, &occs);
    let verses = occs.iter().map(|o| (o.b, o.c, o.v)).collect::<std::collections::BTreeSet<_>>().len();
    let kind = if is_small { "refs" } else if occs.len() > PAGE { "books" } else { "run" };
    let mut out = json!({"word": word, "mode": mode, "forms": forms, "words": names, "places": occs.len(), "verses": verses, "kind": kind, "small": is_small});
    let refs_only = kind == "refs";
    if kind == "run" {
        out["lines"] = json!(lines(bible, &occs.iter().collect::<Vec<_>>(), AROUND, false)?);
        return Ok(out);
    }
    let mut groups = vec![];
    for (id, n) in by_book {
        let b = book_of(bible, id)?;
        if book.is_some_and(|w| !w.eq_ignore_ascii_case(&b.code) && !w.eq_ignore_ascii_case(&b.name)) {
            continue;
        }
        let in_book: Vec<&Occ> = occs.iter().filter(|o| o.b == id).collect();
        let shown: &[&Occ] = if book.is_some() { &in_book } else { &in_book[..in_book.len().min(GROUP_LINES)] };
        groups.push(json!({"code": b.code, "name": b.name, "count": n, "lines": lines(bible, shown, AROUND, refs_only)?, "more": n - shown.len()}));
    }
    if book.is_some() && groups.is_empty() {
        return Err(bad("That book has no place for this word."));
    }
    out["groups"] = json!(groups);
    Ok(out)
}

// ---- an entry's every place (C3, C4, C8, C9) -----------------------------------------------------------------------

/// `wb uses <number> --by word|book [--group <rendering or book>] [--around N]`: every occurrence of an original word
/// (one per tagged unit, so H7068 has jealousy 24), grouped by the English it is rendered by or by book, each group 4
/// lines and "more"; with `group`, that group's every line.
pub fn entry_places(bible: &Bible, strong: &str, by: &str, group: Option<&str>, around: usize) -> Result<Value> {
    let strong = strong.trim().to_uppercase();
    if !lookup::is_strong(&strong) {
        return Err(bad("A Strong's number looks like H7065 or G25."));
    }
    if by != "word" && by != "book" {
        return Err(bad("Group by word or by book."));
    }
    let entry = lookup::strong(bible, &strong)?.ok_or_else(|| bad(format!("There is no entry numbered {strong}.")))?;
    let occs = unit_occs(bible, &strong)?;
    // (key, label, members) in the order the groups are shown: renderings by count, books in Bible order
    let mut groups: Vec<(String, String, Vec<&Occ>)> = vec![];
    if by == "word" {
        let mut m: BTreeMap<&str, Vec<&Occ>> = BTreeMap::new();
        for o in &occs {
            m.entry(o.rendering.as_str()).or_default().push(o);
        }
        let mut v: Vec<(&str, Vec<&Occ>)> = m.into_iter().collect();
        v.sort_by(|a, b| b.1.len().cmp(&a.1.len()).then(a.0.cmp(b.0)));
        groups = v.into_iter().map(|(k, o)| (k.to_string(), k.to_string(), o)).collect();
    } else {
        let mut m: BTreeMap<u32, Vec<&Occ>> = BTreeMap::new();
        for o in &occs {
            m.entry(o.b).or_default().push(o);
        }
        for (id, o) in m {
            let b = book_of(bible, id)?;
            groups.push((b.code.clone(), b.name.clone(), o));
        }
    }
    let mut out_groups = vec![];
    for (key, label, members) in &groups {
        if group.is_some_and(|g| !g.eq_ignore_ascii_case(key) && !g.eq_ignore_ascii_case(label)) {
            continue;
        }
        let shown: &[&Occ] = if group.is_some() { members } else { &members[..members.len().min(GROUP_LINES)] };
        out_groups.push(json!({"key": key, "label": label, "count": members.len(), "lines": lines(bible, shown, around, false)?, "more": members.len() - shown.len()}));
    }
    if group.is_some() && out_groups.is_empty() {
        return Err(bad("This entry has no such group."));
    }
    Ok(json!({"strong": strong, "lemma": entry["lemma"], "translit": entry["translit"], "by": by, "occurrences": occs.len(), "groups": out_groups}))
}

// ---- the dictionaries in number order (C3, C4) ---------------------------------------------------------------------

fn number_of(strong: &str) -> u32 {
    strong[1..].parse().unwrap_or(0)
}

fn lang_letter(lang: &str) -> Result<char> {
    match lang.trim().to_lowercase().as_str() {
        "hebrew" | "h" | "heb" => Ok('H'),
        "greek" | "g" | "grc" | "gr" => Ok('G'),
        _ => Err(bad("The dictionaries are hebrew and greek.")),
    }
}

fn numbers(bible: &Bible, letter: char) -> Result<Vec<String>> {
    let mut stmt = bible.conn().prepare_cached("SELECT strong FROM lexicon WHERE strong LIKE ?")?;
    let mut v: Vec<String> = stmt.query_map([format!("{letter}%")], |r| r.get::<_, String>(0))?.collect::<rusqlite::Result<_>>()?;
    v.retain(|s| lookup::is_strong(s));
    v.sort_by_key(|s| number_of(s));
    Ok(v)
}

/// `wb strong H7068 --next|--prev`: the number after or before in the dictionary's own order (H7068 is followed by H7069).
/// The ends have no neighbour: the answer says so and names no number.
pub fn neighbour(bible: &Bible, strong: &str, next: bool) -> Result<Value> {
    let strong = strong.trim().to_uppercase();
    if !lookup::is_strong(&strong) {
        return Err(bad("A Strong's number looks like H7065 or G25."));
    }
    let all = numbers(bible, strong.chars().next().unwrap())?;
    let at = all.iter().position(|s| *s == strong).ok_or_else(|| bad(format!("There is no entry numbered {strong}.")))?;
    let to = if next { all.get(at + 1) } else { at.checked_sub(1).and_then(|i| all.get(i)) };
    match to {
        Some(n) => Ok(lookup::strong(bible, n)?.unwrap()),
        None => Ok(json!({"strong": null, "from": strong, "end": if next { "last" } else { "first" }})),
    }
}

/// `wb strong --list hebrew|greek [--from H7068]`: the entries in number order, a page (100) from a number (the first
/// number at or after it), each with its lemma, sound and the start of its definition.
pub fn list(bible: &Bible, lang: &str, from: Option<&str>) -> Result<Value> {
    let letter = lang_letter(lang)?;
    let all = numbers(bible, letter)?;
    let start = match from.map(str::trim).filter(|f| !f.is_empty()) {
        None => 0,
        Some(f) => {
            let f = f.to_uppercase();
            let n: u32 = if lookup::is_strong(&f) && f.starts_with(letter) { number_of(&f) } else if f.chars().all(|c| c.is_ascii_digit()) { f.parse().unwrap_or(0) } else { return Err(bad("Start from a number like H7068 (or 7068).")) };
            all.iter().position(|s| number_of(s) >= n).unwrap_or(all.len())
        }
    };
    let page: Vec<&String> = all.iter().skip(start).take(LIST_PAGE).collect();
    let mut entries = vec![];
    for s in &page {
        let r: (String, Option<String>, Option<String>, Option<String>) = bible.conn().query_row("SELECT lemma, translit, definition, usage FROM lexicon WHERE strong = ?", [s], |r| Ok((r.get::<_, Option<String>>(0)?.unwrap_or_default(), r.get(1)?, r.get(2)?, r.get(3)?)))?;
        entries.push(json!({"strong": s, "lemma": r.0, "translit": r.1, "definition": r.2}));
    }
    let next = all.get(start + LIST_PAGE).cloned();
    Ok(json!({"lang": if letter == 'H' { "hebrew" } else { "greek" }, "total": all.len(), "from": page.first(), "entries": entries, "next": next}))
}

// ---- the box (C2, C21, C24, C25) -------------------------------------------------------------------------------------

/// What the one box suggests for what is typed: NUMBER (only when a Strong's number is typed, and first), English forms with
/// counts, original words whose definition holds the word, and SOUNDS LIKE (only when a transliteration matches); a
/// group never has more than 3 rows beyond the English forms (C-12). Typing `zea` gives only English forms and
/// original words.
pub fn suggest(bible: &Bible, typed: &str) -> Result<Value> {
    let q = typed.trim();
    if q.is_empty() {
        return Ok(json!({"query": q, "number": [], "english": [], "original": [], "sounds": []}));
    }
    let mut out = json!({"query": q, "number": [], "english": [], "original": [], "sounds": []});
    if lookup::is_strong(&q.to_uppercase()) {
        if let Some(e) = lookup::strong(bible, &q.to_uppercase())? {
            out["number"] = json!([e]);
        }
        return Ok(out);
    }
    if lookup::is_word(q) {
        let w = q.to_lowercase();
        out["english"] = lookup::forms(bible, &w)?["forms"].clone();
        let entries = lookup::lexiconc(bible, &format!("{w}*"), 6)?["entries"].clone();
        out["original"] = entries;
    }
    let d = lookup::define(bible, q)?;
    let sounds: Vec<Value> = d["original"].as_array().cloned().unwrap_or_default().into_iter().take(BOX_ROWS).collect();
    out["sounds"] = json!(sounds);
    Ok(out)
}

/// `wb forms <letter>`'s page for the letter strip: for each letter a to z, how many words start with it and their places,
/// so a letter with none (x) can be dimmed and cannot be clicked (C-11).
pub fn letters(bible: &Bible) -> Result<Value> {
    let mut out = vec![];
    for c in 'a'..='z' {
        let f = lookup::forms(bible, &c.to_string())?;
        let words = f["forms"].as_array().map(Vec::len).unwrap_or(0);
        out.push(json!({"letter": c.to_string(), "words": words, "places": f["total"]}));
    }
    Ok(json!({"letters": out}))
}

// ---- the two settings it keeps (C-1, settings: the click on a word) --------------------------------------------------

/// The page's forms choice, `all` or `one`, kept (C-1, C7). The saved choice, else one: This word, so the page agrees with
/// the box's count, `wb count` and `wb uses` (heart: 830); All forms is a click away and is then kept.
pub fn forms_mode(store: &Store) -> String {
    store.settings("concordance").get("forms").and_then(Value::as_str).filter(|v| *v == "all" || *v == "one").unwrap_or("one").to_string()
}

/// `wb settings concordance forms all|one` and `wb settings reading word-click card|concordance`. `default` puts one back.
/// → the part's settings, or `None` when the key is another setting, which is stored as it is.
pub fn set_setting(store: &mut Store, part: &str, key: &str, value: &str) -> Result<Option<Map<String, Value>>> {
    let (choices, what): (&[&str], &str) = match (part, key) {
        ("concordance", "forms") => (&["all", "one"], "forms"),
        ("reading", "word-click" | "word") => (&["card", "concordance"], "word-click"),
        ("concordance", _) => return Err(bad("The Concordance keeps one setting: forms (all or one).")),
        _ => return Ok(None),
    };
    let v = value.trim().to_lowercase();
    let new = if v == "default" {
        None
    } else if choices.contains(&v.as_str()) {
        Some(json!(v))
    } else {
        return Err(bad(format!("{what} is {}.", choices.join(" or "))));
    };
    // the window keeps the click choice under `word` (Settings, Reading); word-click is the name the design gives it
    let key = if key == "word-click" { "word" } else { key };
    Ok(Some(store.set_setting(part, key, new)?))
}
