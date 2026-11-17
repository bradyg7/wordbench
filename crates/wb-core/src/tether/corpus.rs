//! The scratch study the Tether tests read (design/features/tether, "What the build must satisfy"): 420 pages, one long
//! "Word dump" as a single block (a raw transcript), one of 90 paragraphs, and what was planted in them. Every verse word
//! comes from the database and is cut by code; nothing scripture is typed here. It never writes anywhere but the folder
//! it is given, which must be empty and must not be the person's real study folder.

use super::quote::{self, words_of, VerseRec};
use crate::bible::Bible;
use crate::places::{parse_span, span_label};
use crate::store::Store;
use crate::{Error, Result};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;

struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n.max(1) as u64) as usize
    }
}

/// Speech with no number words, book names, ordinals or scripture in it.
const FILLER: &[&str] = &[
    "so what i want to say here is that we need to slow down and look at this together",
    "and you know it is easy to rush past this kind of thing without really noticing",
    "let me back up a little because there is a piece i left out earlier",
    "i think the point is that people tend to hold on to what feels comfortable",
    "okay so before we go on let us make sure everybody is with me",
    "this is where it gets interesting at least for me and i hope for you also",
    "and then of course the question comes up about how to handle every bit of that",
    "i was talking with a friend last week and the conversation kept coming back to this",
    "now i am not going to pretend i have it all figured out because i certainly do not",
    "the whole thing reminds me of a story from when i was young and living far away",
    "what matters is not the loud part but the quiet part underneath it all",
    "we keep circling back to the same idea and maybe that is a good sign",
    "um and so that leads right into the next thing i wanted to cover today",
    "honestly i had to sit with this for a long time before it started to make sense",
    "there is a lot more to say but i will try to keep this moving along",
    "if you take nothing else from this evening take the part about patience",
    "you can see how this connects to everything we covered before the break",
    "and i keep thinking about how ordinary days shape us far more than special ones",
    "so let me put it another way and see if that helps a bit",
    "somebody asked me about this at the door and i did not have a good answer",
    "the people around that table were tired but they kept going anyway",
    "and that is really the heart of it as far as i can tell right now",
    "we could spend the whole evening on this single point and still not finish",
    "i wrote this down on a scrap of paper and then lost the paper which is typical",
    "let us pause there for a moment and just let it settle in",
    "the next part is a little harder to say plainly but i will give it a try",
    "uh where was i oh yes the part about listening before speaking",
    "it took years for me to see this and i am still learning it",
    "and when you put all of that together a pattern begins to show up",
    "i do not want to rush this so bear with me while i find the thread again",
    "everything we have said so far leans on a simple habit done faithfully every day",
    "there was a long silence after that and nobody in the room moved at all",
    "and then the lights went out and we finished the rest by the window",
    "so that is the background and now we can get to the actual question",
    "some of you have heard me say this already but it bears repeating once more",
    "the older folks in my family always said slow is steady and steady wins",
    "i keep a little notebook for exactly these moments when an idea shows up",
    "and that brings me to the last stretch which i promise will be short",
    "it is funny how the simplest things end up being the most difficult to do",
    "all right let me get a drink of water and then we will carry on",
];

const UNITS: [&str; 20] = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
];
const TENS: [&str; 10] = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

fn number_words(n: u32) -> String {
    if n < 20 {
        UNITS[n as usize].to_string()
    } else {
        let t = TENS[(n / 10) as usize];
        if n % 10 == 0 { t.to_string() } else { format!("{t} {}", UNITS[(n % 10) as usize]) }
    }
}

fn hash6(ws: &[String]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for w in ws {
        for b in w.bytes().chain(std::iter::once(0u8)) {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
    }
    h
}

/// One thing planted, and where.
#[derive(Clone)]
struct Item {
    kind: &'static str,
    text: String,
    reference: String,
    refs: Vec<String>,
}

fn label(bible: &Bible, v: &VerseRec) -> String {
    let code = &bible.books().iter().find(|b| b.id == v.book).unwrap().code;
    parse_span(&format!("{code} {}:{}", v.chapter, v.verse), bible.books()).map(|s| span_label(&s)).unwrap_or_default()
}

pub struct Made {
    pub expected: Value,
}

/// Make the scratch study in `dir` (empty, not the real folder). `seed` picks the verses; the same seed gives the same study.
pub fn make(bible: &Bible, dir: &Path, seed: u64) -> Result<Made> {
    if dir.exists() && std::fs::read_dir(dir).map(|mut d| d.next().is_some()).unwrap_or(false) {
        return Err(Error(format!("{} is not empty; the corpus is made in a new folder.", dir.display())));
    }
    std::fs::create_dir_all(dir).map_err(|e| Error(e.to_string()))?;
    let mut store = Store::open(dir)?;
    let verses = quote::load_verses(bible, "KJV")?;
    let mut rng = Rng(seed | 1);
    // how many verses hold each run of 6 words
    let mut six: HashMap<u64, Vec<usize>> = HashMap::new();
    for (i, v) in verses.iter().enumerate() {
        for g in v.words.windows(6) {
            let e = six.entry(hash6(g)).or_default();
            if e.last() != Some(&i) {
                e.push(i);
            }
        }
    }
    let unique = |ws: &[String]| ws.windows(6).all(|g| six.get(&hash6(g)).is_some_and(|v| v.len() == 1));
    let long: Vec<usize> = (0..verses.len()).filter(|i| verses[*i].words.len() >= 14).collect();
    let mut items: Vec<Item> = vec![];

    // 40 written
    let mut tries = 0;
    while items.iter().filter(|i| i.kind == "written").count() < 40 && tries < 5000 {
        tries += 1;
        let v = &verses[rng.below(verses.len())];
        let book = bible.books().iter().find(|b| b.id == v.book).unwrap();
        let word = book.name.rsplit(' ').next().unwrap_or("").to_string();
        let lead = book.name.strip_suffix(&word).unwrap_or("").to_string();
        let short = format!("{lead}{}", word.chars().take(3).collect::<String>());
        let name = if rng.below(2) == 0 { book.name.clone() } else { short };
        let mut place = format!("{name} {}:{}", v.chapter, v.verse);
        if rng.below(4) == 0 {
            place.push_str(&format!("-{}", v.verse + 1));
        }
        let Ok(s) = parse_span(&place, bible.books()) else { continue };
        let ok = s.book.id == book.id && bible.last_verse(&book.code, s.c1).unwrap_or(0) >= s.v2.max(s.v1);
        if ok && name.chars().filter(|c| c.is_alphabetic()).count() >= 3 {
            let r = span_label(&s);
            if !items.iter().any(|i| i.reference == r) {
                items.push(Item { kind: "written", text: place, reference: r, refs: vec![] });
            }
        }
    }
    // 25 spoken
    tries = 0;
    while items.iter().filter(|i| i.kind == "spoken").count() < 25 && tries < 5000 {
        tries += 1;
        let v = &verses[rng.below(verses.len())];
        if v.chapter > 99 || v.verse > 99 {
            continue;
        }
        let book = bible.books().iter().find(|b| b.id == v.book).unwrap();
        let numbered = book.name.chars().next().is_some_and(|c| c.is_ascii_digit());
        let plain = if numbered { book.name[2..].to_string() } else { book.name.clone() };
        let (c, vv) = (number_words(v.chapter), number_words(v.verse));
        let form = items.iter().filter(|i| i.kind == "spoken").count() % 3;
        let nm = if numbered {
            let ord = ["", "first", "second", "third"][book.name[..1].parse::<usize>().unwrap_or(1)];
            format!("{ord} {plain}")
        } else {
            plain.clone()
        };
        let text = match form {
            0 if format!("{}{}", v.chapter, v.verse).parse::<u32>().unwrap_or(0) > book.chapters => format!("{nm} {c} {vv}"),
            0 => continue,
            1 => format!("{nm} {c} verse {vv}"),
            _ => format!("{nm} chapter {c} verse {vv}"),
        };
        let r = label(bible, v);
        if !items.iter().any(|i| i.reference == r) {
            items.push(Item { kind: "spoken", text, reference: r, refs: vec![] });
        }
    }
    // 60 exact and 30 with words dropped
    let mut used: Vec<usize> = vec![];
    let mut take = |rng: &mut Rng, items: &mut Vec<Item>, kind: &'static str, want: usize, len: (usize, usize), drop: bool| {
        let mut tries = 0;
        while items.iter().filter(|i| i.kind == kind).count() < want && tries < 20000 {
            tries += 1;
            let vi = long[rng.below(long.len())];
            if used.contains(&vi) {
                continue;
            }
            let v = &verses[vi];
            let l = len.0 + rng.below(len.1 - len.0 + 1);
            if v.words.len() < l {
                continue;
            }
            let at = rng.below(v.words.len() - l + 1);
            let run = &v.words[at..at + l];
            if !unique(run) {
                continue;
            }
            let mut out: Vec<String> = vec![];
            if drop {
                let (mut gap, mut dropped) = (0, 0);
                for (k, w) in run.iter().enumerate() {
                    if k > 0 && k + 1 < l && gap < 2 && rng.below(5) == 0 {
                        gap += 1;
                        dropped += 1;
                        continue;
                    }
                    gap = 0;
                    out.push(w.clone());
                }
                if dropped == 0 || out.len() < 7 {
                    continue;
                }
                let at1 = 1 + rng.below(out.len() - 1);
                out.insert(at1, "uh".into());
                let at2 = 1 + rng.below(out.len() - 1);
                if at2 != at1 && at2 != at1 + 1 {
                    out.insert(at2, "um".into());
                }
            } else {
                out = run.to_vec();
            }
            used.push(vi);
            items.push(Item { kind, text: out.join(" "), reference: label(bible, v), refs: vec![] });
        }
    };
    take(&mut rng, &mut items, "exact", 60, (6, 25), false);
    take(&mut rng, &mut items, "dropout", 30, (14, 25), true);
    // phrases in more than 3 verses; 2 or 3 verses (parallels)
    let mut many_keys: Vec<&u64> = six.iter().filter(|(_, v)| v.len() >= 6).map(|(k, _)| k).collect();
    many_keys.sort();
    let mut alike_keys: Vec<&u64> = six.iter().filter(|(_, v)| (2..=3).contains(&v.len())).map(|(k, _)| k).collect();
    alike_keys.sort();
    let text_of_hash = |h: &u64| -> (Vec<String>, Vec<usize>) {
        let vs = &six[h];
        let v = &verses[vs[0]];
        let g = v.words.windows(6).find(|g| hash6(g) == *h).unwrap().to_vec();
        (g, vs.clone())
    };
    // phrases: pick more than needed, keep those the matcher itself puts where the design says (2 or 3 verses; more than 3)
    let mut picked_phrases: Vec<Vec<String>> = vec![];
    for (keys, kind, want) in [(&many_keys, "many", 15usize), (&alike_keys, "parallel", 10usize)] {
        let mut pool: Vec<(Vec<String>, Vec<usize>)> = vec![];
        let mut t = 0;
        while pool.len() < want * 6 && t < 5000 && !keys.is_empty() {
            t += 1;
            let (g, vs) = text_of_hash(keys[rng.below(keys.len())]);
            if picked_phrases.iter().chain(pool.iter().map(|p| &p.0)).any(|p| p.windows(3).any(|a| g.windows(3).any(|b| a == b))) {
                continue;
            }
            pool.push((g, vs));
        }
        let blocks: Vec<Vec<quote::NoteWord>> = pool.iter().map(|p| words_of(&p.0.join(" "))).collect();
        let m = quote::Matcher::new(&verses, &blocks, 6);
        let mut n = 0;
        for ((g, vs), b) in pool.iter().zip(&blocks) {
            if n >= want {
                break;
            }
            let outcomes = quote::group(&verses, m.chains(b));
            let fits = match outcomes.as_slice() {
                [quote::Outcome::Many(_)] => kind == "many",
                [quote::Outcome::Alike(c)] => kind == "parallel" && c.len() == vs.len(),
                _ => false,
            };
            if fits {
                n += 1;
                picked_phrases.push(g.clone());
                let refs: Vec<String> = vs.iter().map(|i| label(bible, &verses[*i])).collect();
                items.push(Item { kind, text: g.join(" "), reference: String::new(), refs });
            }
        }
    }
    // paraphrases: keep 3 words, drop 3, so no run of 6 survives (checked with the matcher itself: none that any verse fits)
    let mut tries = 0;
    let mut cand: Vec<(usize, Vec<String>)> = vec![];
    while cand.len() < 120 && tries < 20000 {
        tries += 1;
        let vi = long[rng.below(long.len())];
        let v = &verses[vi];
        if used.contains(&vi) || v.words.len() < 18 || cand.iter().any(|c| c.0 == vi) {
            continue;
        }
        cand.push((vi, v.words.iter().enumerate().filter(|(k, _)| (k / 3) % 2 == 0).map(|(_, w)| w.clone()).collect()));
    }
    let blocks: Vec<Vec<quote::NoteWord>> = cand.iter().map(|c| words_of(&c.1.join(" "))).collect();
    let m = quote::Matcher::new(&verses, &blocks, 6);
    for (c, b) in cand.iter().zip(&blocks) {
        if items.iter().filter(|i| i.kind == "paraphrase").count() >= 20 {
            break;
        }
        if m.chains(b).is_empty() {
            items.push(Item { kind: "paraphrase", text: c.1.join(" "), reference: label(bible, &verses[c.0]), refs: vec![] });
        }
    }
    // 5 that are not verses
    for t in ["Romans 40:2", "Psalm 151:1", "Genesis 51:3", "John 22:4", "Acts 30:1"] {
        items.push(Item { kind: "decoy", text: t.into(), reference: String::new(), refs: vec![] });
    }
    // an order that is not the order they were made in
    for i in (1..items.len()).rev() {
        let j = rng.below(i + 1);
        items.swap(i, j);
    }

    // Segments: filler, then an item, over and over; filler to about 7,500 words in all
    let mut segments: Vec<(Option<usize>, String)> = vec![];
    for (k, _) in items.iter().enumerate() {
        for _ in 0..(1 + rng.below(3)) {
            segments.push((None, FILLER[rng.below(FILLER.len())].to_string()));
        }
        segments.push((Some(k), items[k].text.clone()));
    }
    segments.push((None, FILLER[rng.below(FILLER.len())].to_string()));

    // Page A: one block, no full stops
    let mut a = String::new();
    let mut a_at: Vec<(usize, usize, usize)> = vec![];
    for (k, (item, t)) in segments.iter().enumerate() {
        if k > 0 {
            a.push(' ');
        }
        let start = a.chars().count();
        a.push_str(t);
        if let Some(i) = item {
            a_at.push((*i, start, a.chars().count()));
        }
        a.push_str(" uh um uh");
    }
    // Page B: 90 paragraphs, sentences with full stops
    let total = segments.len();
    let mut b_blocks: Vec<String> = vec![];
    let mut b_at: Vec<(usize, usize, usize, usize)> = vec![];
    for bi in 0..90 {
        let chunk = &segments[bi * total / 90..(bi + 1) * total / 90];
        let mut p = String::new();
        for (item, t) in chunk {
            if !p.is_empty() {
                p.push(' ');
            }
            let start = p.chars().count();
            let mut s = t.clone();
            if item.is_none() {
                let mut cs = s.chars();
                s = cs.next().map(|c| c.to_uppercase().collect::<String>()).unwrap_or_default() + cs.as_str();
            }
            p.push_str(&s);
            if let Some(i) = item {
                b_at.push((*i, bi + 1, start, p.chars().count()));
            }
            p.push_str(" uh um uh.");
        }
        b_blocks.push(p);
    }
    let mut filler_page = String::new();
    for _ in 0..300 {
        filler_page.push_str(FILLER[rng.below(FILLER.len())]);
        filler_page.push_str(". ");
    }
    let id_of = |v: Value| v["id"].as_str().unwrap_or_default().to_string();
    let page_a = id_of(store.jot(&format!("Word dump\n\n{a}"), false)?.into());
    let page_b = id_of(store.jot(&format!("Word dump paragraphs\n\n{}", b_blocks.join("\n\n")), false)?.into());
    let page_f = id_of(store.jot(&format!("Filler only\n\n{}", filler_page.trim_end()), false)?.into());
    for n in 0..417 {
        store.jot(&format!("Study note {n:03}\n\nA line about nothing in particular, number {n}."), false)?;
    }
    // ids are made from the clock and a few random letters: two pages can share one, so make up the number
    while store.inbox().len() < 420 {
        store.jot(&format!("Study note extra {}", store.inbox().len()), false)?;
    }
    let entry = |i: usize, page: &str, block: usize, s: usize, e: usize| {
        let it = &items[i];
        json!({"kind": it.kind, "page": page, "block": block, "start": s, "end": e, "words": it.text, "ref": it.reference, "refs": it.refs})
    };
    let mut planted: Vec<Value> = vec![];
    for (i, s, e) in &a_at {
        planted.push(entry(*i, "Word dump", 1, *s, *e));
    }
    for (i, bl, s, e) in &b_at {
        planted.push(entry(*i, "Word dump paragraphs", *bl, *s, *e));
    }
    Ok(Made {
        expected: json!({
            "pages": {"Word dump": page_a, "Word dump paragraphs": page_b, "Filler only": page_f},
            "words": {"Word dump": words_of(&a).len()},
            "items": planted,
        }),
    })
}
