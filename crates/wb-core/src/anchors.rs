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
