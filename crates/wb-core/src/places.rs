//! Bible references as typed: "John 3:16", "Num 25:10-26:4", "Rom 5-8", "Jude", "1 cor 13:4-7". The same rules as the
//! Python app's `workbench/refs.py` (and `parseSpan` / `matchBook` in its web/commands.js), so a reference means the same
//! thing everywhere. One parser now, where the Python app had two kept equal by a test.

use crate::bible::Book;
use crate::{Error, Result};

/// A run of a book: chapter c1 verse v1 to chapter c2 verse v2. A verse of 0 means from the start / to the end of that
/// chapter.
#[derive(Debug, Clone)]
pub struct Span {
    pub book: Book,
    pub c1: u32,
    pub v1: u32,
    pub c2: u32,
    pub v2: u32,
}

/// Lowercase letters and digits only.
pub fn norm(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        .collect()
}

/// Usual short forms that are neither a book's code nor a unique start of its name.
const BOOK_ALIASES: &[(&str, &str)] = &[
    ("gn", "GEN"),
    ("dt", "DEU"),
    ("jg", "JDG"),
    ("jdgs", "JDG"),
    ("1sm", "1SA"),
    ("2sm", "2SA"),
    ("1kgs", "1KI"),
    ("2kgs", "2KI"),
    ("pss", "PSA"),
    ("prv", "PRO"),
    ("qoh", "ECC"),
    ("sos", "SNG"),
    ("songofsongs", "SNG"),
    ("cant", "SNG"),
    ("canticles", "SNG"),
    ("mt", "MAT"),
    ("mk", "MRK"),
    ("lk", "LUK"),
    ("jn", "JHN"),
    ("phil", "PHP"),
    ("phlm", "PHM"),
    ("1pt", "1PE"),
    ("2pt", "2PE"),
];

fn bad(msg: impl Into<String>) -> Error {
    Error(msg.into())
}

/// "I Kings", "III John": a leading roman numeral followed by a letter becomes a digit.
fn roman(token: &str) -> String {
    let t = token.trim_start();
    let n = t.chars().take_while(|c| *c == 'i' || *c == 'I').count();
    if (1..=3).contains(&n) {
        let rest = &t[n..];
        let spaces = rest.chars().take_while(|c| c.is_whitespace()).count();
        if spaces > 0
            && rest[spaces..]
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_alphabetic())
        {
            return format!("{n}{}", &rest[spaces..]);
        }
    }
    token.to_string()
}

/// 'num', 'Numbers', '1 cor', 'jhn', 'Jn', '1 Kgs', 'II Cor' → the book. An error when none or several fit.
pub fn match_book<'a>(token: &str, books: &'a [Book]) -> Result<&'a Book> {
    let t = norm(&roman(token));
    if t.is_empty() {
        return Err(bad(format!("No book called “{}”.", token.trim())));
    }
    let exact: Vec<&Book> = books
        .iter()
        .filter(|b| norm(&b.name) == t || b.code.to_lowercase() == t)
        .collect();
    if exact.len() == 1 {
        return Ok(exact[0]);
    }
    if let Some((_, code)) = BOOK_ALIASES.iter().find(|(a, _)| *a == t) {
        if let Some(b) = books.iter().find(|b| b.code == *code) {
            return Ok(b);
        }
    }
    let pre: Vec<&Book> = books
        .iter()
        .filter(|b| norm(&b.name).starts_with(&t))
        .collect();
    match pre.len() {
        1 => Ok(pre[0]),
        0 => Err(bad(format!("No book called “{}”.", token.trim()))),
        _ => Err(bad(format!(
            "Which book? {}",
            pre.iter()
                .map(|b| b.name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ))),
    }
}

const HINT: &str = "Give a reference like John 3:16, John 3-5, Num 25:10-26:4 or Jude.";

type Parts = (String, u32, Option<u32>, Option<u32>, Option<u32>);

/// `^(.+?)\s*(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$`
fn split_span(t: &str) -> Option<Parts> {
    static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| {
        regex::Regex::new(r"^(.+?)\s*(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$").unwrap()
    });
    let m = re.captures(t)?;
    let n = |i: usize| {
        m.get(i)
            .map(|x| x.as_str().parse::<u32>().unwrap_or(u32::MAX))
    };
    Some((m[1].to_string(), n(2)?, n(3), n(4), n(5)))
}

pub fn parse_span(text: &str, books: &[Book]) -> Result<Span> {
    let t = text.trim();
    let Some((name, c1, v1, x, y)) = split_span(t) else {
        return match match_book(t, books) {
            Ok(b) => Ok(Span {
                book: b.clone(),
                c1: 1,
                v1: 0,
                c2: b.chapters,
                v2: 0,
            }),
            Err(_) if t.chars().any(|c| c.is_ascii_digit()) => Err(bad(HINT)),
            Err(e) => Err(e),
        };
    };
    let bk = match_book(&name, books)?.clone();
    let v1v = v1.unwrap_or(0);
    let (mut c2, mut v2) = (c1, v1v);
    if let Some(x) = x {
        match (v1.is_some(), y) {
            (false, None) => (c2, v2) = (x, 0),
            (true, None) => v2 = x,
            (true, Some(y)) => (c2, v2) = (x, y),
            (false, Some(_)) => return Err(bad(HINT)),
        }
    }
    for c in [c1, c2] {
        if c < 1 || c > bk.chapters {
            return Err(bad(format!(
                "{} has {} chapter{}.",
                bk.name,
                bk.chapters,
                if bk.chapters == 1 { "" } else { "s" }
            )));
        }
    }
    if c2 < c1 || (c2 == c1 && v2 != 0 && v2 < v1v) {
        return Err(bad(
            "A range runs upward, like John 3:16-18 or Num 25:10-26:4.",
        ));
    }
    Ok(Span {
        book: bk,
        c1,
        v1: v1v,
        c2,
        v2,
    })
}

/// Several places joined by ';'.
pub fn parse_spans(text: &str, books: &[Book]) -> Result<Vec<Span>> {
    let parts: Vec<&str> = text
        .split(';')
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return Err(bad("Give a reference like John 3:16."));
    }
    parts.into_iter().map(|p| parse_span(p, books)).collect()
}

pub fn span_label(s: &Span) -> String {
    let b = &s.book;
    if s.c1 == 1 && s.v1 == 0 && s.c2 == b.chapters && s.v2 == 0 && b.chapters > 1 {
        return b.name.clone();
    }
    let head = format!(
        "{} {}{}",
        b.name,
        s.c1,
        if s.v1 != 0 {
            format!(":{}", s.v1)
        } else {
            String::new()
        }
    );
    if s.c2 == s.c1 {
        return if s.v2 != 0 && s.v2 != s.v1 {
            format!("{head}–{}", s.v2)
        } else {
            head
        };
    }
    format!(
        "{head}–{}{}",
        s.c2,
        if s.v2 != 0 {
            format!(":{}", s.v2)
        } else {
            String::new()
        }
    )
}

/// A single verse or a run of verses as an anchor ('JHN.3:16', 'NUM.25:11-25:13'); None for whole chapters and books.
pub fn span_anchor(s: &Span) -> Option<String> {
    if s.v1 == 0 {
        return None;
    }
    let code = &s.book.code;
    if s.c1 == s.c2 && (s.v2 == 0 || s.v2 == s.v1) {
        return Some(format!("{code}.{}:{}", s.c1, s.v1));
    }
    if s.v2 != 0 {
        return Some(format!("{code}.{}:{}-{}:{}", s.c1, s.v1, s.c2, s.v2));
    }
    None
}

/// Groups of books (the Python app's web/groups.js): key, first and last book id, other names.
pub const GROUPS: &[(&str, u32, u32, &[&str])] = &[
    ("pentateuch", 1, 5, &["torah", "law", "moses"]),
    ("history", 6, 17, &["historical"]),
    ("wisdom", 18, 22, &["poetry", "poetical"]),
    ("prophets", 23, 39, &["prophet"]),
    ("major", 23, 27, &["majorprophets"]),
    ("minor", 28, 39, &["minorprophets", "twelve"]),
    ("gospels", 40, 43, &["gospel"]),
    ("paul", 45, 57, &["pauline", "pauls"]),
    ("general", 58, 65, &["catholic"]),
    ("epistles", 45, 65, &["letters", "epistle"]),
];

/// 'ot', 'nt', a group ('gospels'), a book ('num') → the scope string the lookups take: all, OT, NT, a book id, or
/// book ids joined by commas.
pub fn scope_of(token: &str, books: &[Book]) -> Result<String> {
    let t = norm(token);
    if t == "ot" || t == "nt" {
        return Ok(t.to_uppercase());
    }
    if t == "all" || t.is_empty() {
        return Ok("all".into());
    }
    // already a scope: book ids joined by commas, as the window passes it on (the Python app's wb refused these)
    let ids: Vec<&str> = token.split(',').map(str::trim).collect();
    if ids.iter().all(|x| {
        x.parse::<u32>()
            .is_ok_and(|n| books.iter().any(|b| b.id == n))
    }) {
        return Ok(ids.join(","));
    }
    for (key, a, b, aka) in GROUPS {
        if t == *key || aka.contains(&t.as_str()) {
            return Ok((*a..=*b)
                .map(|i| i.to_string())
                .collect::<Vec<_>>()
                .join(","));
        }
    }
    Ok(match_book(token, books)?.id.to_string())
}

/// The book ids a scope string covers (`testament` of each book is needed for OT and NT).
pub fn in_scope(book: &Book, scope: &str) -> bool {
    match scope {
        "" | "all" => true,
        "OT" | "NT" => book.testament == scope,
        s if s.contains(',') => s
            .split(',')
            .any(|x| x.trim().parse::<u32>().ok() == Some(book.id)),
        s => s.parse::<u32>().ok() == Some(book.id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn books() -> Vec<Book> {
        let raw: serde_json::Value =
            serde_json::from_str(include_str!("../tests/books.json")).unwrap();
        raw.as_array()
            .unwrap()
            .iter()
            .map(|b| Book {
                id: b["id"].as_u64().unwrap() as u32,
                code: b["code"].as_str().unwrap().into(),
                name: b["name"].as_str().unwrap().into(),
                testament: b["testament"].as_str().unwrap().into(),
                chapters: b["chapters"].as_u64().unwrap() as u32,
            })
            .collect()
    }

    #[test]
    fn books_as_typed() {
        let bs = books();
        for (t, code) in [
            ("num", "NUM"),
            ("Numbers", "NUM"),
            ("1 cor", "1CO"),
            ("jhn", "JHN"),
            ("Jn", "JHN"),
            ("1 Kgs", "1KI"),
            ("II Cor", "2CO"),
            ("III John", "3JN"),
            ("Song of Songs", "SNG"),
            ("Ps", "PSA"),
            ("phil", "PHP"),
        ] {
            assert_eq!(match_book(t, &bs).unwrap().code, code, "{t}");
        }
        assert!(match_book("J", &bs)
            .unwrap_err()
            .0
            .starts_with("Which book?"));
    }

    #[test]
    fn spans_and_labels() {
        let bs = books();
        let l = |t: &str| span_label(&parse_span(t, &bs).unwrap());
        assert_eq!(l("John 3:16"), "John 3:16");
        assert_eq!(l("John 3:16-18"), "John 3:16–18");
        assert_eq!(l("Num 25:10-26:4"), "Numbers 25:10–26:4");
        assert_eq!(l("Rom 5-8"), "Romans 5–8");
        assert_eq!(l("Jude"), "Jude 1");
        assert_eq!(l("Romans"), "Romans");
        assert_eq!(
            parse_span("John 22", &bs).unwrap_err().0,
            "John has 21 chapters."
        );
        assert_eq!(
            span_anchor(&parse_span("Num 25:11-13", &bs).unwrap()).unwrap(),
            "NUM.25:11-25:13"
        );
        assert_eq!(scope_of("gospels", &bs).unwrap(), "40,41,42,43");
        assert_eq!(scope_of("num", &bs).unwrap(), "4");
    }

    /// The Python app's own answers for its test cases (crates/wb-core/tests/refs-cases.json, made by its refs.py).
    #[test]
    fn same_as_the_python_app() {
        let bs = books();
        let cases: serde_json::Value =
            serde_json::from_str(include_str!("../tests/refs-cases.json")).unwrap();
        for c in cases["spans"].as_array().unwrap() {
            let input = c["in"].as_str().unwrap();
            match parse_span(input, &bs) {
                Ok(s) => {
                    assert!(
                        c.get("error").is_none(),
                        "{input:?} should fail with {}",
                        c["error"]
                    );
                    assert_eq!(
                        (s.book.name.as_str(), s.c1, s.v1, s.c2, s.v2),
                        (
                            c["book"].as_str().unwrap(),
                            c["c1"].as_u64().unwrap() as u32,
                            c["v1"].as_u64().unwrap() as u32,
                            c["c2"].as_u64().unwrap() as u32,
                            c["v2"].as_u64().unwrap() as u32
                        ),
                        "{input:?}"
                    );
                    assert_eq!(span_label(&s), c["label"].as_str().unwrap(), "{input:?}");
                    assert_eq!(
                        span_anchor(&s).as_deref(),
                        c["anchor"].as_str(),
                        "{input:?}"
                    );
                }
                Err(e) => assert_eq!(Some(e.0.as_str()), c["error"].as_str(), "{input:?}"),
            }
        }
        for (t, want) in cases["scopes"].as_object().unwrap() {
            assert_eq!(scope_of(t, &bs).unwrap(), want.as_str().unwrap(), "{t}");
        }
        for (name, short) in cases["short_names"].as_object().unwrap() {
            assert_eq!(
                &match_book(short.as_str().unwrap(), &bs).unwrap().name,
                name
            );
        }
    }
}
