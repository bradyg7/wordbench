//! References as people say them: "second Timothy two fifteen", "Romans 8 verse 28", "John chapter three verse sixteen".
//! A pass turns number words, ordinals, "chapter", "verse" and "through" into the written form, keeps a map from every
//! character back to the person's own text, runs `commands::find_refs` on the written form and maps each range back, so
//! the range is on the words the person said. `find_refs` itself is not changed.

use crate::bible::Book;
use crate::commands::find_refs;

/// A reference found in the person's text: characters of that text, how it reads, and whether it was spoken.
#[derive(Debug, Clone, PartialEq)]
pub struct Said {
    pub start: usize,
    pub end: usize,
    pub place: String,
    pub spoken: bool,
    pub hash: String,
}

struct Tok {
    s: usize,
    e: usize,
    w: String,
}

fn tokens(chars: &[char]) -> Vec<Tok> {
    let mut out = vec![];
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_alphanumeric() {
            let s = i;
            while i < chars.len() && chars[i].is_alphanumeric() {
                i += 1;
            }
            out.push(Tok { s, e: i, w: chars[s..i].iter().collect::<String>().to_lowercase() });
        } else {
            i += 1;
        }
    }
    out
}

fn unit(w: &str) -> Option<u32> {
    Some(match w {
        "one" => 1,
        "two" => 2,
        "three" => 3,
        "four" => 4,
        "five" => 5,
        "six" => 6,
        "seven" => 7,
        "eight" => 8,
        "nine" => 9,
        _ => return None,
    })
}

fn teen(w: &str) -> Option<u32> {
    Some(match w {
        "ten" => 10,
        "eleven" => 11,
        "twelve" => 12,
        "thirteen" => 13,
        "fourteen" => 14,
        "fifteen" => 15,
        "sixteen" => 16,
        "seventeen" => 17,
        "eighteen" => 18,
        "nineteen" => 19,
        _ => return None,
    })
}

fn tens(w: &str) -> Option<u32> {
    Some(match w {
        "twenty" => 20,
        "thirty" => 30,
        "forty" => 40,
        "fifty" => 50,
        "sixty" => 60,
        "seventy" => 70,
        "eighty" => 80,
        "ninety" => 90,
        _ => return None,
    })
}

fn is_number_word(w: &str) -> bool {
    unit(w).is_some() || teen(w).is_some() || tens(w).is_some() || w == "hundred"
}

fn ordinal(w: &str) -> Option<char> {
    match w {
        "first" | "1st" => Some('1'),
        "second" | "2nd" => Some('2'),
        "third" | "3rd" => Some('3'),
        _ => None,
    }
}

/// Number words as standard numbers side by side: "one twenty three" is [1, 23]; "one hundred twenty three" is [123].
fn atoms(words: &[&str]) -> Option<Vec<u32>> {
    let mut out = vec![];
    let mut i = 0;
    while i < words.len() {
        let w = words[i];
        let mut val;
        if let (Some(u), Some(&"hundred")) = (unit(w), words.get(i + 1)) {
            val = u * 100;
            i += 2;
            if words.get(i) == Some(&"and") {
                i += 1;
            }
            if let Some(t) = words.get(i).and_then(|x| tens(x)) {
                val += t;
                i += 1;
                if let Some(u) = words.get(i).and_then(|x| unit(x)) {
                    val += u;
                    i += 1;
                }
            } else if let Some(t) = words.get(i).and_then(|x| teen(x)) {
                val += t;
                i += 1;
            } else if let Some(u) = words.get(i).and_then(|x| unit(x)) {
                val += u;
                i += 1;
            }
        } else if let Some(t) = tens(w) {
            val = t;
            i += 1;
            if let Some(u) = words.get(i).and_then(|x| unit(x)) {
                val += u;
                i += 1;
            }
        } else if let Some(t) = teen(w).or_else(|| unit(w)) {
            val = t;
            i += 1;
        } else {
            return None;
        }
        out.push(val);
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

struct Num {
    atoms: Vec<u32>,
    next: usize,
    words: bool,
}

struct Pass<'a> {
    chars: &'a [char],
    toks: Vec<Tok>,
    words: bool,
}

impl Pass<'_> {
    fn sep_plain(&self, a: usize, b: usize) -> bool {
        self.chars[self.toks[a].e..self.toks[b].s].iter().all(|c| c.is_whitespace() || *c == '-')
    }

    /// A number at token `i`: up to 3 digits, or (when asked) number words.
    fn num(&self, i: usize) -> Option<Num> {
        let t = self.toks.get(i)?;
        if t.w.len() <= 3 && t.w.chars().all(|c| c.is_ascii_digit()) {
            let n: u32 = t.w.parse().ok()?;
            return (n > 0).then_some(Num { atoms: vec![n], next: i + 1, words: false });
        }
        if !self.words || !is_number_word(&t.w) {
            return None;
        }
        let mut j = i;
        let mut ws: Vec<&str> = vec![];
        while j < self.toks.len() {
            let w = self.toks[j].w.as_str();
            let hundred_before = ws.last() == Some(&"hundred");
            if !(is_number_word(w) || (w == "and" && hundred_before)) || (j > i && !self.sep_plain(j - 1, j)) {
                break;
            }
            ws.push(w);
            j += 1;
        }
        while ws.last() == Some(&"and") {
            ws.pop();
        }
        // the longest run that reads as numbers
        while !ws.is_empty() {
            if let Some(a) = atoms(&ws) {
                return Some(Num { atoms: a, next: i + ws.len(), words: true });
            }
            ws.pop();
        }
        None
    }

    fn is(&self, i: usize, ws: &[&str]) -> bool {
        self.toks.get(i).is_some_and(|t| ws.contains(&t.w.as_str()))
    }
}

fn concat(a: &[u32]) -> String {
    a.iter().map(|n| n.to_string()).collect()
}

struct Normal {
    text: String,
    map: Vec<(usize, usize)>,
    /// Pieces the pass wrote, in the written text's characters.
    replaced: Vec<(usize, usize)>,
    ambiguous: Vec<(usize, usize)>,
}

/// The text with its spoken forms written out. `concat_reading`: read "one twenty three" as 123 where it could also be 1:23.
fn normalize(text: &str, words: bool, concat_reading: bool) -> Normal {
    let chars: Vec<char> = text.chars().collect();
    let p = Pass { chars: &chars, toks: tokens(&chars), words };
    let (mut out, mut map): (Vec<char>, Vec<(usize, usize)>) = (vec![], vec![]);
    let (mut replaced, mut ambiguous) = (vec![], vec![]);
    let mut pos = 0usize; // next original char to copy
    let mut i = 0;
    while i < p.toks.len() {
        let t = &p.toks[i];
        while pos < t.s {
            out.push(chars[pos]);
            map.push((pos, pos + 1));
            pos += 1;
        }
        let mut rewrite: Option<(String, usize, bool)> = None; // piece, next token, ambiguous
        let through = |j: usize, base: String| -> (String, usize) {
            if p.is(j, &["through", "thru"]) {
                if let Some(n3) = p.num(j + 1) {
                    return (format!("{base}-{}", concat(&n3.atoms)), n3.next);
                }
            }
            (base, j)
        };
        if words
            && ordinal(&t.w).is_some()
            && p.toks.get(i + 1).is_some_and(|n| !is_number_word(&n.w) && !p.is(i + 1, &["chapter", "verse", "verses"]) && p.sep_plain(i, i + 1))
        {
            rewrite = Some((ordinal(&t.w).unwrap().to_string(), i + 1, false));
        } else if p.is(i, &["chapter"]) {
            if let Some(n1) = p.num(i + 1) {
                if p.is(n1.next, &["verse", "verses"]) {
                    if let Some(n2) = p.num(n1.next + 1) {
                        let (piece, next) = through(n2.next, format!("{}:{}", concat(&n1.atoms), concat(&n2.atoms)));
                        rewrite = Some((piece, next, false));
                    }
                }
                if rewrite.is_none() {
                    rewrite = Some((concat(&n1.atoms), n1.next, false));
                }
            }
        } else if i > 0 && p.sep_plain(i - 1, i) && !is_number_word(&p.toks[i - 1].w) && !p.toks[i - 1].w.chars().all(|c| c.is_ascii_digit()) {
            if let Some(n1) = p.num(i) {
                if p.is(n1.next, &["verse", "verses"]) {
                    if let Some(n2) = p.num(n1.next + 1) {
                        let (piece, next) = through(n2.next, format!("{}:{}", concat(&n1.atoms), concat(&n2.atoms)));
                        rewrite = Some((piece, next, false));
                    }
                } else if n1.words && n1.atoms.len() == 2 {
                    let base = if concat_reading { concat(&n1.atoms) } else { format!("{}:{}", n1.atoms[0], n1.atoms[1]) };
                    let (piece, next) = through(n1.next, base);
                    rewrite = Some((piece, next, true));
                }
            }
        }
        match rewrite {
            Some((piece, next, amb)) => {
                let (from, to) = (t.s, p.toks[next - 1].e);
                let a = out.len();
                for c in piece.chars() {
                    out.push(c);
                    map.push((from, to));
                }
                replaced.push((a, out.len()));
                if amb {
                    ambiguous.push((a, out.len()));
                }
                pos = to;
                i = next;
            }
            None => {
                while pos < t.e {
                    out.push(chars[pos]);
                    map.push((pos, pos + 1));
                    pos += 1;
                }
                i += 1;
            }
        }
    }
    while pos < chars.len() {
        out.push(chars[pos]);
        map.push((pos, pos + 1));
        pos += 1;
    }
    Normal { text: out.into_iter().collect(), map, replaced, ambiguous }
}

fn overlaps(a: (usize, usize), rs: &[(usize, usize)]) -> bool {
    rs.iter().any(|r| a.0 < r.1 && r.0 < a.1)
}

fn found(n: &Normal, books: &[Book], only_in: Option<&[(usize, usize)]>) -> Vec<Said> {
    find_refs(&n.text, books)
        .into_iter()
        .filter(|f| only_in.is_none_or(|r| overlaps((f.start, f.end), r)))
        .map(|f| Said { start: n.map[f.start].0, end: n.map[f.end - 1].1, place: f.place.clone(), spoken: overlaps((f.start, f.end), &n.replaced), hash: f.hash.clone() })
        .collect()
}

/// Every reference in the text, in order, as written or spoken. `words`: number words and "first/second/third" count too
/// (`wb refs --spoken`); without them only "chapter" and "verse" are heard. Where "one twenty three" could be 1:23 or
/// 123, both readings that are references are returned over the same words.
pub fn find_said(text: &str, books: &[Book], words: bool) -> Vec<Said> {
    let a = normalize(text, words, false);
    let mut out = found(&a, books, None);
    if words && !a.ambiguous.is_empty() {
        let b = normalize(text, true, true);
        for s in found(&b, books, Some(&b.ambiguous)) {
            if !out.iter().any(|o| o.start == s.start && o.end == s.end && o.place == s.place) {
                out.push(s);
            }
        }
        out.sort_by_key(|s| (s.start, s.end));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn books() -> Vec<Book> {
        let raw: serde_json::Value = serde_json::from_str(include_str!("../../tests/books.json")).unwrap();
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

    fn one(text: &str, words: bool) -> Vec<(String, String, bool)> {
        let cs: Vec<char> = text.chars().collect();
        find_said(text, &books(), words).into_iter().map(|s| (cs[s.start..s.end].iter().collect(), s.place, s.spoken)).collect()
    }

    #[test]
    fn spoken_forms() {
        let say = |t: &str| one(t, true);
        assert_eq!(say("so second Timothy two fifteen is it"), vec![("second Timothy two fifteen".into(), "2TI 2:15".into(), true)]);
        assert_eq!(say("turn to Romans eight verse twenty eight now"), vec![("Romans eight verse twenty eight".into(), "ROM 8:28".into(), true)]);
        assert_eq!(say("John chapter three verse sixteen."), vec![("John chapter three verse sixteen".into(), "JHN 3:16".into(), true)]);
        assert_eq!(say("see Romans 8 verse 28 here"), vec![("Romans 8 verse 28".into(), "ROM 8:28".into(), true)]);
        assert_eq!(say("John three sixteen through eighteen"), vec![("John three sixteen through eighteen".into(), "JHN 3:16-18".into(), true)]);
        assert_eq!(
            say("Romans 8:28 and Rom. 8:28"),
            vec![("Romans 8:28".into(), "ROM 8:28".into(), false), ("Rom. 8:28".into(), "ROM 8:28".into(), false)]
        );
    }

    #[test]
    fn two_readings_and_what_is_not_read() {
        let r = one("Psalm one twenty three", true);
        let places: Vec<&str> = r.iter().map(|x| x.1.as_str()).collect();
        assert!(places.contains(&"PSA 123") && places.contains(&"PSA 1:23"), "{places:?}");
        assert!(one("then verse twenty eight says", true).is_empty());
        assert!(one("there is one of two ways", true).is_empty());
        assert!(one("second Timothy two fifteen", false).is_empty());
        assert_eq!(one("Romans 8 verse 28", false)[0].1, "ROM 8:28");
    }
}
