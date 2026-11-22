//! Filters (design/features/filters-v2, NB16): the one filter form every list takes. A filter is a property, a way and values:
//! `Status is Open, Closed` (any of the values), `Status is not Open`, `Status is not set`, `Status is set`, and for the two dates
//! `Edited last 7 days` (Edited or Written, then today, last 7 days, last 30 days or last year). The same words are a `filter:` line
//! in a list's `view` fence, a chip in the window and `--filter "…"` on a `wb` command. Several filters must all match; the values
//! of one filter match any. A comma inside a value is written `\,`.
//!
//! `Facts` is what a list knows about one row, property by property; a list that has no such property says so (`None`) and a
//! command refuses the filter with the properties it does have.

use crate::store::bad;
use crate::Result;
use chrono::{Duration, Local};
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Way {
    Is,
    IsNot,
    NotSet,
    Set,
}

impl Way {
    pub fn words(self) -> &'static str {
        match self {
            Way::Is => "is",
            Way::IsNot => "is not",
            Way::NotSet => "is not set",
            Way::Set => "is set",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Filter {
    pub property: String,
    pub way: Way,
    pub values: Vec<String>,
}

/// The fixed choices of the two date properties (no typed dates).
pub const DATE_CHOICES: [&str; 4] = ["today", "last 7 days", "last 30 days", "last year"];
const DATE_PROPERTIES: [&str; 2] = ["edited", "written"];

pub fn is_date_property(p: &str) -> bool {
    DATE_PROPERTIES.contains(&p.trim().to_lowercase().as_str())
}

/// The property's name as it is written (Edited, Written), whatever the case it came in.
fn canon(p: &str) -> String {
    match p.trim().to_lowercase().as_str() {
        "edited" => "Edited".into(),
        "written" => "Written".into(),
        "folder" => "Folder".into(),
        "book" => "Book".into(),
        "callout kind" => "Callout kind".into(),
        other => {
            let _ = other;
            p.trim().to_string()
        }
    }
}

fn split_values(s: &str) -> Vec<String> {
    let mut out = vec![];
    let mut cur = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' && chars.peek() == Some(&',') {
            cur.push(',');
            chars.next();
        } else if c == ',' {
            out.push(cur.trim().to_string());
            cur.clear();
        } else {
            cur.push(c);
        }
    }
    out.push(cur.trim().to_string());
    out.into_iter().filter(|v| !v.is_empty()).collect()
}

fn join_values(v: &[String]) -> String {
    v.iter().map(|x| x.replace(',', "\\,")).collect::<Vec<_>>().join(", ")
}

fn find_ci(hay: &str, needle: &str) -> Option<usize> {
    hay.to_lowercase().find(needle)
}

/// A filter from its words: `Status is Open`, `Status is not Open, Done`, `Status is not set`, `Status is set`, `Edited last 7 days`.
pub fn parse(text: &str) -> Result<Filter> {
    let t = text.trim();
    let low = t.to_lowercase();
    if t.is_empty() || t.contains('\n') {
        return Err(bad("A filter is one line: Status is Open."));
    }
    // the dates: Edited|Written then a fixed choice
    for p in DATE_PROPERTIES {
        if let Some(rest) = low.strip_prefix(p).filter(|r| r.starts_with(' ')) {
            let choice = rest.trim();
            if choice == "any time" {
                return Ok(Filter { property: canon(p), way: Way::Is, values: vec![] });
            }
            if !DATE_CHOICES.contains(&choice) {
                return Err(bad(format!("{} is today, last 7 days, last 30 days, last year or any time (no dates typed).", canon(p))));
            }
            return Ok(Filter { property: canon(p), way: Way::Is, values: vec![choice.to_string()] });
        }
    }
    let wrong = || bad(format!("A filter reads like Status is Open, Status is not Open, Status is not set, Status is set or Edited last 7 days, not “{t}”."));
    if let Some(p) = low.strip_suffix(" is not set") {
        return Ok(Filter { property: canon(&t[..p.len()]), way: Way::NotSet, values: vec![] });
    }
    if let Some(p) = low.strip_suffix(" is set") {
        return Ok(Filter { property: canon(&t[..p.len()]), way: Way::Set, values: vec![] });
    }
    let (way, at, len) = match (find_ci(t, " is not "), find_ci(t, " is ")) {
        (Some(a), Some(b)) if a <= b => (Way::IsNot, a, " is not ".len()),
        (_, Some(b)) => (Way::Is, b, " is ".len()),
        _ => return Err(wrong()),
    };
    let property = canon(&t[..at]);
    if property.is_empty() {
        return Err(wrong());
    }
    let values = split_values(&t[at + len..]);
    if values.is_empty() {
        return Err(wrong());
    }
    if is_date_property(&property) {
        return Err(bad(format!("{property} reads like “{property} last 7 days”: today, last 7 days, last 30 days or last year.")));
    }
    Ok(Filter { property, way, values })
}

impl Filter {
    /// The filter's words, as the file writes them.
    pub fn text(&self) -> String {
        if is_date_property(&self.property) {
            return format!("{} {}", self.property, self.values.first().cloned().unwrap_or_default());
        }
        match self.way {
            Way::NotSet | Way::Set => format!("{} {}", self.property, self.way.words()),
            _ => format!("{} {} {}", self.property, self.way.words(), join_values(&self.values)),
        }
    }
    pub fn is_date(&self) -> bool {
        is_date_property(&self.property)
    }
    pub fn key(&self) -> String {
        self.property.to_lowercase()
    }
}

/// Does a date (`2026-11-03` or `2026-11-03T10:00:00`) fall in the fixed choice, counted from today?
pub fn date_in(choice: &str, date: &str) -> bool {
    let day = date.get(..10).unwrap_or("");
    if day.is_empty() {
        return false;
    }
    let today = Local::now().date_naive();
    let from = match choice {
        "today" => today,
        "last 7 days" => today - Duration::days(7),
        "last 30 days" => today - Duration::days(30),
        "last year" => today - Duration::days(365),
        _ => return true,
    };
    day >= from.to_string().as_str()
}

/// Does a row's facts for the filter's property pass it? `facts` are the values it holds (empty: not set); for Edited and Written the
/// one date.
pub fn passes(f: &Filter, facts: &[String]) -> bool {
    if f.is_date() {
        return f.values.first().is_none_or(|c| facts.first().is_some_and(|d| date_in(c, d)));
    }
    let hit = f.values.iter().any(|v| facts.iter().any(|x| x.eq_ignore_ascii_case(v)));
    match f.way {
        Way::Is => hit,
        Way::IsNot => !hit,
        Way::NotSet => facts.is_empty(),
        Way::Set => !facts.is_empty(),
    }
}

/// The filters as JSON for `wb page views` (`property`, `way`, `values`, `text`).
pub fn json_of(f: &Filter) -> Value {
    json!({"property": f.property, "way": if f.is_date() { "is" } else { f.way.words() }, "values": f.values, "text": f.text(), "date": f.is_date()})
}

/// Several filters in one list: one per property (a second one for the same property replaces the first).
pub fn put(list: &mut Vec<Filter>, f: Filter) {
    list.retain(|x| x.key() != f.key());
    if !(f.is_date() && f.values.is_empty()) {
        list.push(f);
    }
}

/// What a row holds, property by property (lower-case names).
pub type Facts = BTreeMap<String, Vec<String>>;

/// Every filter must pass; a property the row's list does not have is a filter that cannot be applied: the properties it has are named.
pub fn apply_all(filters: &[Filter], facts: &Facts, has: &[&str]) -> Result<bool> {
    for f in filters {
        match facts.get(&f.key()) {
            Some(v) => {
                if !passes(f, v) {
                    return Ok(false);
                }
            }
            None => return Err(bad(format!("No property called “{}” here; this list has {}.", f.property, has.join(", ")))),
        }
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_four_ways_and_the_dates_read_and_write() {
        for t in ["Status is Open", "Status is Open, Done", "Status is not Open", "Status is not set", "Status is set", "Edited last 7 days", "Written today", "Book is Numbers 25", "Callout kind is Question"] {
            assert_eq!(parse(t).unwrap().text(), t);
        }
        assert_eq!(parse("status IS Open").unwrap().property, "status");
        assert!(parse("Edited 2026-11-01").is_err());
        assert!(parse("Status Open").is_err());
        assert_eq!(parse("Speaker is Moore\\, J., Smith").unwrap().values, vec!["Moore, J.".to_string(), "Smith".to_string()]);
        assert_eq!(parse("Speaker is Moore\\, J.").unwrap().text(), "Speaker is Moore\\, J.");
    }

    #[test]
    fn passes_by_way() {
        let f = |t: &str| parse(t).unwrap();
        let has = vec!["Open".to_string()];
        assert!(passes(&f("Status is open"), &has));
        assert!(!passes(&f("Status is not Open"), &has));
        assert!(passes(&f("Status is not set"), &[]));
        assert!(passes(&f("Status is set"), &has));
        assert!(passes(&f("Edited today"), &[Local::now().format("%Y-%m-%dT10:00:00").to_string()]));
        assert!(!passes(&f("Edited last 7 days"), &["2001-01-01".to_string()]));
    }
}
