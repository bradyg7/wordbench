//! Anchors: stable coordinates into the KJV text, the same text forms as the Python app (`workbench/anchors.py`).
//!
//! ```text
//! NUM.25:11              a verse
//! NUM.25:11.12           one word (0-based position in the verse's word list)
//! NUM.25:11.3-25:12.5    a phrase: first word .. last word, may cross verses
//! NUM.25:7-25:13         a run of whole verses
//! H7065 / G25            an original-language word everywhere (a "lemma")
//! ```

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Word,
    Verse,
    Phrase,
    Verses,
    Lemma,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Anchor {
    pub kind: Kind,
    pub code: String,
    pub c1: u32,
    pub v1: u32,
    pub i1: Option<u32>,
    pub c2: Option<u32>,
    pub v2: Option<u32>,
    pub i2: Option<u32>,
    /// The Strong's number, for a lemma anchor.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strong: Option<String>,
}

impl Anchor {
    /// The last chapter the anchor touches.
    pub fn last_chapter(&self) -> u32 {
        self.c2.unwrap_or(self.c1)
    }

    pub fn id(&self) -> String {
        if let Some(s) = &self.strong {
            return s.clone();
        }
        let mut out = format!("{}.{}:{}", self.code, self.c1, self.v1);
        if let Some(i) = self.i1 {
            out += &format!(".{i}");
        }
        if let (Some(c2), Some(v2)) = (self.c2, self.v2) {
            out += &format!("-{c2}:{v2}");
            if let Some(i) = self.i2 {
                out += &format!(".{i}");
            }
        }
        out
    }
}

fn is_lemma(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() >= 2 && b.len() <= 5 && (b[0] == b'H' || b[0] == b'G') && b[1..].iter().all(u8::is_ascii_digit)
}

/// `25:11` or `25:11.24` → (chapter, verse, word).
fn point(s: &str) -> Option<(u32, u32, Option<u32>)> {
    let (c, rest) = s.split_once(':')?;
    let (v, i) = match rest.split_once('.') {
        Some((v, i)) => (v, Some(i.parse().ok()?)),
        None => (rest, None),
    };
    Some((c.parse().ok()?, v.parse().ok()?, i))
}

pub fn parse(text: &str) -> crate::Result<Anchor> {
    let a = text.trim();
    let bad = || crate::Error(format!("That is not an anchor: {:?}", a.chars().take(60).collect::<String>()));
    if is_lemma(a) {
        return Ok(Anchor { kind: Kind::Lemma, code: String::new(), c1: 0, v1: 0, i1: None, c2: None, v2: None, i2: None, strong: Some(a.into()) });
    }
    let (code, rest) = a.split_once('.').ok_or_else(bad)?;
    if code.len() != 3 || !code.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) {
        return Err(bad());
    }
    let (start, end) = match rest.split_once('-') {
        Some((s, e)) => (s, Some(e)),
        None => (rest, None),
    };
    let (c1, v1, i1) = point(start).ok_or_else(bad)?;
    let (mut c2, mut v2, mut i2) = (None, None, None);
    if let Some(e) = end {
        let (c, v, i) = point(e).ok_or_else(bad)?;
        if i1.is_some() != i.is_some() {
            return Err(crate::Error("A phrase needs a word position at both ends.".into()));
        }
        if (c, v, i.unwrap_or(0)) < (c1, v1, i1.unwrap_or(0)) {
            return Err(crate::Error("The end of the anchor comes before its start.".into()));
        }
        // A one-word phrase is a word; a one-verse run is a verse.
        let same = (c, v, i) == (c1, v1, i1) || (i1.is_none() && (c, v) == (c1, v1));
        if !same {
            (c2, v2, i2) = (Some(c), Some(v), i);
        }
    }
    let kind = match (c2.is_some(), i1.is_some()) {
        (false, true) => Kind::Word,
        (false, false) => Kind::Verse,
        (true, true) => Kind::Phrase,
        (true, false) => Kind::Verses,
    };
    Ok(Anchor { kind, code: code.into(), c1, v1, i1, c2, v2, i2, strong: None })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn forms_round_trip() {
        for s in ["NUM.25:11", "NUM.25:11.24", "NUM.25:11.3-25:12.5", "NUM.25:7-25:13", "H7065", "1SA.4:11"] {
            assert_eq!(parse(s).unwrap().id(), s);
        }
    }

    #[test]
    fn kinds_and_normalizing() {
        assert_eq!(parse("NUM.25:12-25:13").unwrap().kind, Kind::Verses);
        assert_eq!(parse("NUM.25:14.18-25:14.24").unwrap().kind, Kind::Phrase);
        assert_eq!(parse("NUM.25:11.2-25:11.2").unwrap().id(), "NUM.25:11.2");
        assert_eq!(parse("NUM.25:11-25:11").unwrap().id(), "NUM.25:11");
        assert!(parse("NUM.25:11.3-25:12").is_err());
        assert!(parse("NUM.25:12-25:11").is_err());
        assert!(parse("Numbers 25").is_err());
    }
}

// ---- the Python app's own shapes ---------------------------------------------------------------------------------
// `anchors.parse` and `anchors.resolve` return dicts with these keys in this order; the study requests pass them on.

use crate::bible::Bible;
use serde_json::{json, Map, Value};

/// Python's repr() of a string, as its error messages show one.
pub fn py_repr(s: &str) -> String {
    let q = if s.contains('\'') && !s.contains('"') { '"' } else { '\'' };
    let mut out = String::from(q);
    for c in s.chars() {
        match c {
            '\\' => out.push_str(r"\\"),
            '\n' => out.push_str(r"\n"),
            '\r' => out.push_str(r"\r"),
            '\t' => out.push_str(r"\t"),
            c if c == q => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out.push(q);
    out
}

/// `anchors.parse`: {code, c1, v1, i1, c2, v2, i2, kind, id}, or {kind, strong, id} for a lemma.
pub fn py_parse(text: &str) -> crate::Result<Map<String, Value>> {
    let a = text.trim();
    let p = parse(a).map_err(|e| {
        if e.0.starts_with("That is not") {
            crate::Error(format!("That is not an anchor: {}", py_repr(&a.chars().take(60).collect::<String>())))
        } else {
            e
        }
    })?;
    if p.kind == Kind::Lemma {
        let s = p.strong.clone().unwrap();
        return Ok(json!({"kind": "lemma", "strong": s, "id": s}).as_object().unwrap().clone());
    }
    let kind = match p.kind {
        Kind::Word => "word",
        Kind::Verse => "verse",
        Kind::Phrase => "phrase",
        Kind::Verses => "verses",
        Kind::Lemma => unreachable!(),
    };
    Ok(json!({"code": p.code, "c1": p.c1, "v1": p.v1, "i1": p.i1, "c2": p.c2, "v2": p.v2, "i2": p.i2, "kind": kind, "id": p.id()})
        .as_object()
        .unwrap()
        .clone())
}

pub fn canonical(text: &str) -> crate::Result<String> {
    Ok(py_parse(text)?["id"].as_str().unwrap().to_string())
}

pub fn py_label(name: &str, c1: i64, v1: i64, c2: i64, v2: i64, ranged: bool) -> String {
    if !ranged {
        return format!("{name} {c1}:{v1}");
    }
    if c1 == c2 {
        return if v1 != v2 { format!("{name} {c1}:{v1}–{v2}") } else { format!("{name} {c1}:{v1}") };
    }
    format!("{name} {c1}:{v1}–{c2}:{v2}")
}

/// `anchors.resolve`: the parsed fields plus ok, label, quote, strongs and ref, looked up in the text.
pub fn resolve(bible: &Bible, text: &str) -> crate::Result<Map<String, Value>> {
    let p = py_parse(text)?;
    let mut out = p.clone();
    out.insert("ok".into(), json!(false));
    out.insert("label".into(), p["id"].clone());
    out.insert("quote".into(), json!(""));
    out.insert("strongs".into(), json!([]));
    out.insert("ref".into(), Value::Null);
    let conn = bible.conn();
    use rusqlite::OptionalExtension;
    if p["kind"] == "lemma" {
        let row: Option<(String, Option<String>, Option<String>)> = conn
            .query_row("SELECT lemma, translit, definition FROM lexicon WHERE strong = ?", [p["strong"].as_str().unwrap()], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .optional()?;
        if let Some((lemma, translit, def)) = row {
            out.insert("ok".into(), json!(true));
            out.insert("label".into(), p["strong"].clone());
            out.insert("quote".into(), json!(format!("{lemma} ({})", translit.unwrap_or_else(|| "None".into()))));
            out.insert("strongs".into(), json!([p["strong"]]));
            out.insert("gloss".into(), json!(def));
        }
        return Ok(out);
    }
    let code = p["code"].as_str().unwrap();
    let Some(book) = bible.books().iter().find(|b| b.code == code).cloned() else { return Ok(out) };
    let n = |k: &str| p[k].as_i64();
    let (c1, v1, i1) = (n("c1").unwrap(), n("v1").unwrap(), n("i1"));
    let ranged = !p["c2"].is_null();
    let (c2, v2, i2) = if ranged { (n("c2").unwrap(), n("v2").unwrap(), n("i2")) } else { (c1, v1, i1) };
    out.insert("ref".into(), json!({"b": book.id, "code": code, "name": book.name, "c": c1, "v": v1}));
    let kind = p["kind"].as_str().unwrap();
    if kind == "word" || kind == "phrase" {
        let mut stmt = conn.prepare_cached(
            "SELECT chapter, verse, idx, lead, text, trail, strong FROM words WHERE book = ? \
             AND (chapter, verse, idx) >= (?, ?, ?) AND (chapter, verse, idx) <= (?, ?, ?) ORDER BY chapter, verse, idx",
        )?;
        let rows: Vec<(u32, u32, u32, String, String, Option<String>)> = stmt
            .query_map(rusqlite::params![book.id, c1, v1, i1, c2, v2, i2], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(4)?, r.get(5)?, r.get(6)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        if let (Some(f), Some(l)) = (rows.first(), rows.last()) {
            if (f.0 as i64, f.1 as i64, Some(f.2 as i64)) == (c1, v1, i1) && (l.0 as i64, l.1 as i64, Some(l.2 as i64)) == (c2, v2, i2) {
                let mut t = String::new();
                for (k, r) in rows.iter().enumerate() {
                    t += &r.3;
                    if k + 1 < rows.len() {
                        t += &r.4;
                    }
                }
                let mut seen: Vec<String> = vec![];
                for r in &rows {
                    if let Some(s) = &r.5 {
                        if !s.is_empty() && !seen.contains(s) {
                            seen.push(s.clone());
                        }
                    }
                }
                out.insert("quote".into(), json!(t.split_whitespace().collect::<Vec<_>>().join(" ")));
                out.insert("strongs".into(), json!(seen));
                out.insert("ok".into(), json!(true));
            }
        }
    } else {
        let mut stmt = conn.prepare_cached(
            "SELECT text FROM verses WHERE book = ? AND (chapter, verse) >= (?, ?) AND (chapter, verse) <= (?, ?) ORDER BY chapter, verse",
        )?;
        let rows: Vec<String> = stmt.query_map(rusqlite::params![book.id, c1, v1, c2, v2], |r| r.get(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        if !rows.is_empty() {
            out.insert("quote".into(), json!(rows.join(" ")));
            out.insert("ok".into(), json!(true));
        }
    }
    out.insert("label".into(), json!(py_label(&book.name, c1, v1, c2, v2, ranged)));
    Ok(out)
}
