//! Published reading plans, phase 2b tier 3 item 4. None is shipped with the app: each belongs to its publisher. The person
//! imports a copy they have, so this reads the forms those copies come in:
//!
//! - **one day to a line** (`plain`): places joined by `;`. Any list at all, Tyndale's One Year Chronological included
//!   (its day list is not on the web page; it needs the person's own text);
//! - **Guthrie's** `Week N` / `Day N` layout: six readings a week, the seventh day a day off;
//! - **Blue Letter Bible's** list: places joined by `/`, with its short names (Jhn, Phl, 1Co, Jde);
//! - **Horner's ten lists**: ten lists of books, one chapter from each list a day, each list starting again when it is done,
//!   no end date (a plan with `cycle`: see `plans::extended`).
//!
//! The plan file keeps the source's name (`source`). Only the person's own text is read; no list is written here.

use crate::bible::Bible;
use crate::plans::{books_listed, summary, Built};
use crate::reading::{chapters, parse_plan_text};
use crate::store::{bad, cut};
use crate::Result;
use chrono::NaiveDate;
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Format {
    Plain,
    Guthrie,
    BlueLetter,
    Horner,
}

impl Format {
    /// "auto" (or nothing) is None: the text says which it is (`detect`).
    pub fn parse(s: &str) -> Result<Option<Format>> {
        match s.trim().to_lowercase().replace([' ', '_'], "-").as_str() {
            "" | "auto" => Ok(None),
            "plain" | "lines" | "one-day-to-a-line" | "tyndale" => Ok(Some(Format::Plain)),
            "guthrie" => Ok(Some(Format::Guthrie)),
            "blue-letter" | "blb" | "blue-letter-bible" => Ok(Some(Format::BlueLetter)),
            "horner" => Ok(Some(Format::Horner)),
            other => Err(bad(format!(
                "No format “{other}”. Formats: auto, plain, guthrie, blue-letter, horner."
            ))),
        }
    }
    pub(crate) fn name(&self) -> &'static str {
        match self {
            Format::Plain => "plain",
            Format::Guthrie => "guthrie",
            Format::BlueLetter => "blue-letter",
            Format::Horner => "horner",
        }
    }
    /// What the plan file calls the source when the person gives no name of their own.
    fn source(&self) -> Option<&'static str> {
        match self {
            Format::Plain => None,
            Format::Guthrie => Some("Guthrie"),
            Format::BlueLetter => Some("Blue Letter Bible"),
            Format::Horner => Some("Horner"),
        }
    }
}

fn re(pattern: &str) -> regex::Regex {
    regex::RegexBuilder::new(pattern)
        .case_insensitive(true)
        .build()
        .unwrap()
}

/// The lines that count: a `#` starts a comment, blank lines are left out. Each keeps its line number (from 1).
fn lines_of(text: &str) -> Vec<(usize, String)> {
    text.lines()
        .enumerate()
        .map(|(n, l)| (n + 1, l.split('#').next().unwrap_or("").trim().to_string()))
        .filter(|(_, l)| !l.is_empty())
        .collect()
}

/// Which form a text is in: `Week N` and `Day N` lines are Guthrie's; two `List N` lines are Horner's; a `/` between places
/// is Blue Letter Bible's; anything else is one day to a line.
pub fn detect(text: &str) -> Format {
    let lines = lines_of(text);
    let (week, day, list) = (
        re(r"^week\s*\d+\b"),
        re(r"^day\s*\d+\b"),
        re(r"^list\s*\d+\b"),
    );
    if lines.iter().any(|(_, l)| week.is_match(l)) && lines.iter().any(|(_, l)| day.is_match(l)) {
        return Format::Guthrie;
    }
    if lines.iter().filter(|(_, l)| list.is_match(l)).count() >= 2 {
        return Format::Horner;
    }
    if lines.iter().any(|(_, l)| l.contains('/')) {
        return Format::BlueLetter;
    }
    Format::Plain
}

/// What an import makes, ready to start.
pub struct Imported {
    pub format: Format,
    /// The plan file's kind: "imported", or "horner" for a plan with no end.
    pub kind: &'static str,
    pub days: Vec<Vec<String>>,
    pub extra: Value,
    /// Guthrie's: the weeks counted. Horner's: the lists.
    pub weeks: usize,
    pub lists: usize,
}

/// Read a copy of a published plan. `format` None finds out from the text; `source` is the name the plan file keeps (the
/// publisher's, by default).
pub fn import(
    bible: &Bible,
    text: &str,
    format: Option<Format>,
    source: Option<&str>,
) -> Result<Imported> {
    let format = format.unwrap_or_else(|| detect(text));
    let mut out = Imported {
        format,
        kind: "imported",
        days: vec![],
        extra: json!({}),
        weeks: 0,
        lists: 0,
    };
    match format {
        Format::Plain => out.days = parse_plan_text(bible, text)?,
        Format::Guthrie => {
            let (days, weeks) = guthrie(bible, text)?;
            out.days = days;
            out.weeks = weeks;
            out.extra["days_off"] = json!(["sun"]); // the seventh day of each week has no reading; the person may move it
        }
        Format::BlueLetter => out.days = blue_letter(bible, text)?,
        Format::Horner => {
            let lists = horner(bible, text)?;
            let longest = lists.iter().map(|l| l.len()).max().unwrap_or(0);
            out.days = (0..longest)
                .map(|k| lists.iter().map(|l| l[k % l.len()].clone()).collect())
                .collect();
            out.lists = lists.len();
            out.kind = "horner";
            out.extra["lists"] = json!(lists);
            out.extra["cycle"] = json!(true);
        }
    }
    let named = source
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .or(format.source());
    if let Some(n) = named {
        out.extra["source"] = json!(cut(n, 120));
    }
    if out.days.is_empty() {
        return Err(bad("The plan has no days."));
    }
    Ok(out)
}

/// Horner's ten lists as a kind of plan that ships (RP-9): ten ranges of books, each read in its own order, a chapter of each a
/// day, no end date. The same plan `import` makes from a pasted copy, with no typing.
pub const HORNER_LISTS: [&str; 10] = [
    "Matthew-John",
    "Genesis-Deuteronomy",
    "Romans-Colossians",
    "1 Thessalonians-Revelation",
    "Job, Ecclesiastes, Song of Solomon",
    "Psalms",
    "Proverbs",
    "Joshua-Esther",
    "Isaiah-Malachi",
    "Acts",
];

pub fn horner_kind(bible: &Bible) -> Result<Imported> {
    let text: String = HORNER_LISTS
        .iter()
        .enumerate()
        .map(|(k, l)| format!("List {}: {l}\n", k + 1))
        .collect();
    let mut imp = import(bible, &text, Some(Format::Horner), Some("Horner"))?;
    imp.extra["lists_named"] = json!(HORNER_LISTS);
    Ok(imp)
}

/// What the person sees before an import starts: the same summary as the form's, and what was found.
pub fn summarize(bible: &Bible, name: &str, start: NaiveDate, imp: &Imported) -> Value {
    let built = Built {
        readings: imp.days.iter().map(|d| d.len()).sum(),
        days: imp.days.clone(),
        extra: imp.extra.clone(),
        kept: vec![],
    };
    let mut v = summary(bible, name, imp.kind, start, &built);
    let cycle = imp.extra["cycle"] == true;
    if cycle {
        v["finish"] = Value::Null; // no end date
    }
    v["format"] = json!(imp.format.name());
    v["source"] = imp.extra.get("source").cloned().unwrap_or(Value::Null);
    v["weeks"] = json!(imp.weeks);
    v["lists"] = json!(imp.lists);
    v["cycle"] = json!(cycle);
    v
}

// ---- Guthrie's: Week N / Day N ---------------------------------------------------------------------------------------------

/// The readings of a day as the plain form: places joined by `;` (a `/` or `&` or "and" joins them in some copies).
fn joined(text: &str) -> String {
    re(r"\s+(?:and|&)\s+|/")
        .replace_all(text, "; ")
        .into_owned()
}

fn guthrie(bible: &Bible, text: &str) -> Result<(Vec<Vec<String>>, usize)> {
    let (week, day) = (
        re(r"^week\s*(\d+)\b"),
        re(r"^day\s*(\d+)\b[\s:.)\-–—]*(.*)$"),
    );
    let mut days: Vec<Vec<String>> = vec![];
    let mut weeks = 0;
    // the day being read: its number, its readings so far, and the line it began on
    let mut open: Option<(u32, String, usize)> = None;
    let close =
        |open: &mut Option<(u32, String, usize)>, days: &mut Vec<Vec<String>>| -> Result<()> {
            let Some((n, readings, at)) = open.take() else {
                return Ok(());
            };
            let readings = readings.trim().trim_matches(';').trim().to_string();
            if readings.is_empty() {
                return Ok(()); // a day with nothing to read is a day off
            }
            match parse_plan_text(bible, &joined(&readings)) {
                Ok(d) => days.extend(d),
                Err(_) if n >= 7 => {} // the seventh day: "Rest", "Catch up" or the like
                Err(e) => return Err(bad(format!("Line {at}: Day {n}: {}", e.0))),
            }
            Ok(())
        };
    for (at, line) in lines_of(text) {
        if week.is_match(&line) {
            close(&mut open, &mut days)?;
            weeks += 1;
        } else if let Some(m) = day.captures(&line) {
            close(&mut open, &mut days)?;
            open = Some((m[1].parse().unwrap_or(0), m[2].to_string(), at));
        } else if let Some((_, readings, _)) = &mut open {
            readings.push_str("; "); // the readings go on in the next line
            readings.push_str(&line);
        }
    }
    close(&mut open, &mut days)?;
    if days.is_empty() {
        return Err(bad("No days found. Guthrie's plan has lines like “Week 1” and “Day 1: Genesis 1-2; Matthew 1”."));
    }
    Ok((days, weeks))
}

// ---- Blue Letter Bible's: places joined by "/" -------------------------------------------------------------------------------

/// Blue Letter Bible's short names, in the Bible's order.
const BLB: [&str; 66] = [
    "gen", "exo", "lev", "num", "deu", "jos", "jdg", "rth", "1sa", "2sa", "1ki", "2ki", "1ch",
    "2ch", "ezr", "neh", "est", "job", "psa", "pro", "ecc", "sol", "isa", "jer", "lam", "eze",
    "dan", "hos", "joe", "amo", "oba", "jon", "mic", "nah", "hab", "zep", "hag", "zec", "mal",
    "mat", "mar", "luk", "jhn", "act", "rom", "1co", "2co", "gal", "eph", "phl", "col", "1th",
    "2th", "1ti", "2ti", "tit", "phm", "heb", "jas", "1pe", "2pe", "1jo", "2jo", "3jo", "jde",
    "rev",
];

/// A place in Blue Letter Bible's short names ("1Co 13", "Jhn 3:16") as the Bible's own name for the book, else as it came.
fn blb_place(bible: &Bible, token: &str) -> String {
    let t = token.trim();
    let Some(m) = re(r"^(\d?\s?[a-z]+)\s*(.*)$").captures(t) else {
        return t.to_string();
    };
    let short: String = m[1]
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_lowercase();
    match BLB
        .iter()
        .position(|s| *s == short)
        .and_then(|i| bible.books().get(i))
    {
        Some(b) => format!("{} {}", b.code, &m[2]),
        None => t.to_string(),
    }
}

fn blue_letter(bible: &Bible, text: &str) -> Result<Vec<Vec<String>>> {
    // a line may begin with its day ("Day 12", "12.", "12:"); the places follow, joined by "/"
    let label = re(r"^(?:day\s*\d+\s*[:.)\-–—]?|\d+\s*[:.)])\s*");
    let mut converted = String::new();
    for (n, raw) in text.lines().enumerate() {
        let line = raw.split('#').next().unwrap_or("").trim();
        let rest = label.replace(line, "");
        let places: Vec<String> = rest
            .split('/')
            .map(str::trim)
            .filter(|p| !p.is_empty())
            .map(|p| blb_place(bible, p))
            .collect();
        if n > 0 {
            converted.push('\n');
        }
        converted.push_str(&places.join("; ")); // a line with only a label stays empty, so the line numbers stay the person's
    }
    parse_plan_text(bible, &converted)
}

// ---- Horner's ten lists -----------------------------------------------------------------------------------------------------

/// Each list as the chapters of its books, in the order the list gives them. A list is a line like
/// `List 1: Matthew, Mark, Luke, John` (or `1. Genesis-Deuteronomy`); its books may go on in the next line.
fn horner(bible: &Bible, text: &str) -> Result<Vec<Vec<String>>> {
    let head = re(r"^(?:list\s*\d+\s*[:.)\-–—]?|\d+\s*[:.)\-–—])\s*(.*)$");
    let mut found: Vec<(usize, String)> = vec![]; // the line a list began on, and its books
    for (at, line) in lines_of(text) {
        match head.captures(&line) {
            Some(m) => found.push((at, m[1].to_string())),
            None => match found.last_mut() {
                Some(last) => {
                    last.1.push_str(", ");
                    last.1.push_str(&line);
                }
                None => {} // a title above the lists
            },
        }
    }
    if found.len() < 2 {
        return Err(bad("No lists found. Horner's plan has lines like “List 1: Matthew, Mark, Luke, John”, ten of them."));
    }
    if found.len() > 12 {
        return Err(bad(format!(
            "That is {} lists; Horner's plan has ten.",
            found.len()
        )));
    }
    let mut lists = vec![];
    for (at, books) in found {
        // "(Gospels): Matthew, Mark" and "Genesis to Deuteronomy" are read as the books they name
        let books = books
            .rsplit(':')
            .next()
            .unwrap_or("")
            .replace('–', "-")
            .replace('—', "-");
        let books = re(r"\s+(?:to|through|thru)\s+")
            .replace_all(&books, "-")
            .into_owned();
        let ids =
            books_listed(bible, books.trim()).map_err(|e| bad(format!("Line {at}: {}", e.0)))?;
        let entries: Vec<String> = chapters(bible, &ids)?.into_iter().map(|c| c.0).collect();
        if entries.is_empty() {
            return Err(bad(format!("Line {at}: that list has no books in it.")));
        }
        lists.push(entries);
    }
    Ok(lists)
}
