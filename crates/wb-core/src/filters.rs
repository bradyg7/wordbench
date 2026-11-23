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
    v.iter()
        .map(|x| x.replace(',', "\\,"))
        .collect::<Vec<_>>()
        .join(", ")
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
                return Ok(Filter {
                    property: canon(p),
                    way: Way::Is,
                    values: vec![],
                });
            }
            if !DATE_CHOICES.contains(&choice) {
                return Err(bad(format!("{} is today, last 7 days, last 30 days, last year or any time (no dates typed).", canon(p))));
            }
            return Ok(Filter {
                property: canon(p),
                way: Way::Is,
                values: vec![choice.to_string()],
            });
        }
    }
    let wrong = || {
        bad(format!("A filter reads like Status is Open, Status is not Open, Status is not set, Status is set or Edited last 7 days, not “{t}”."))
    };
    if let Some(p) = low.strip_suffix(" is not set") {
        return Ok(Filter {
            property: canon(&t[..p.len()]),
            way: Way::NotSet,
            values: vec![],
        });
    }
    if let Some(p) = low.strip_suffix(" is set") {
        return Ok(Filter {
            property: canon(&t[..p.len()]),
            way: Way::Set,
            values: vec![],
        });
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
    Ok(Filter {
        property,
        way,
        values,
    })
}

impl Filter {
    /// The filter's words, as the file writes them.
    pub fn text(&self) -> String {
        if is_date_property(&self.property) {
            return format!(
                "{} {}",
                self.property,
                self.values.first().cloned().unwrap_or_default()
            );
        }
        match self.way {
            Way::NotSet | Way::Set => format!("{} {}", self.property, self.way.words()),
            _ => format!(
                "{} {} {}",
                self.property,
                self.way.words(),
                join_values(&self.values)
            ),
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
        return f
            .values
            .first()
            .is_none_or(|c| facts.first().is_some_and(|d| date_in(c, d)));
    }
    let hit = f
        .values
        .iter()
        .any(|v| facts.iter().any(|x| x.eq_ignore_ascii_case(v)));
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
            None => {
                return Err(bad(format!(
                    "No property called “{}” here; this list has {}.",
                    f.property,
                    has.join(", ")
                )))
            }
        }
    }
    Ok(true)
}

// ---- the other lists (filters-v2 rows 26-33, NB17) ----------------------------------------------------------------------

/// Several `--filter` words as filters: one per property (a later one for the same property replaces the earlier).
pub fn parse_all(texts: &[String]) -> Result<Vec<Filter>> {
    let mut out = vec![];
    for t in texts {
        put(&mut out, parse(t)?);
    }
    Ok(out)
}

/// Refuse a filter whose property the list does not have, naming the ones it has.
pub fn check(filters: &[Filter], has: &[&str]) -> Result<()> {
    for f in filters {
        if !has.iter().any(|h| h.eq_ignore_ascii_case(&f.property)) {
            return Err(bad(format!(
                "No property called “{}” here; this list has {}.",
                f.property,
                has.join(", ")
            )));
        }
    }
    Ok(())
}

/// A book's facts: its name, and “Name chapter” (the chapter is picked inside the book).
pub fn book_facts(name: &str, chapter: u32) -> Vec<String> {
    let mut v = vec![name.to_string()];
    if chapter > 0 {
        v.push(format!("{name} {chapter}"));
    }
    v
}

/// One property a list offers: its name and a line saying what it is.
pub struct Prop<'a> {
    pub name: &'a str,
    pub hint: &'a str,
}

/// The Filter menu of a list: each property with the values its rows hold and how many rows hold each (dates: the four fixed choices).
/// `books` are the book names in Bible order (a Book's values follow it, each with its chapters).
pub fn menu(props: &[Prop], facts: &[Facts], books: &[String]) -> Vec<Value> {
    let mut out = vec![];
    for p in props {
        let key = p.name.to_lowercase();
        let mut tally: BTreeMap<String, usize> = BTreeMap::new();
        for f in facts {
            let mut seen: Vec<&String> = vec![];
            for v in f.get(&key).into_iter().flatten() {
                if !seen.contains(&v) {
                    seen.push(v);
                    *tally.entry(v.clone()).or_insert(0) += 1;
                }
            }
        }
        let date = is_date_property(p.name);
        let values: Vec<Value> = if date {
            let labels = [
                ("today", "Today"),
                ("last 7 days", "Last 7 days"),
                ("last 30 days", "Last 30 days"),
                ("last year", "Last year"),
            ];
            labels
                .iter()
                .map(|(v, l)| json!({"value": v, "label": l, "count": facts.iter().filter(|f| f.get(&key).and_then(|d| d.first()).is_some_and(|d| date_in(v, d))).count()}))
                .collect()
        } else if key == "book" {
            books
                .iter()
                .filter(|n| tally.contains_key(*n))
                .map(|n| {
                    let prefix = format!("{n} ");
                    let mut ch: Vec<(u32, usize)> = tally.iter().filter_map(|(k, c)| k.strip_prefix(&prefix).and_then(|x| x.parse::<u32>().ok()).map(|x| (x, *c))).collect();
                    ch.sort();
                    json!({"value": n, "label": n, "count": tally[n], "chapters": ch.iter().map(|(c, k)| json!({"value": format!("{n} {c}"), "label": c.to_string(), "count": k})).collect::<Vec<_>>()})
                })
                .collect()
        } else {
            tally
                .iter()
                .map(|(v, n)| json!({"value": v, "label": v, "count": n}))
                .collect()
        };
        out.push(json!({"name": p.name, "group": "page", "hint": p.hint, "type": if date { "date" } else { "choice" }, "values": values}));
    }
    out
}

/// The rows that pass every filter, and the Filter menu worked out from all the rows. A filter on a property the list lacks is refused.
pub fn narrow(
    rows: Vec<Value>,
    facts_of: &dyn Fn(&Value) -> Facts,
    props: &[Prop],
    filters: &[Filter],
    books: &[String],
) -> Result<(Vec<Value>, Vec<Value>)> {
    let names: Vec<&str> = props.iter().map(|p| p.name).collect();
    check(filters, &names)?;
    let facts: Vec<Facts> = rows.iter().map(facts_of).collect();
    let menu = menu(props, &facts, books);
    let none: Vec<String> = vec![];
    let kept = rows
        .into_iter()
        .zip(facts)
        .filter(|(_, f)| {
            filters
                .iter()
                .all(|fl| passes(fl, f.get(&fl.key()).unwrap_or(&none)))
        })
        .map(|(r, _)| r)
        .collect();
    Ok((kept, menu))
}

/// Put `properties` (the Filter menu), `filters` (the ones applied) and `unfiltered` (how many rows there were) on a list's answer.
pub fn attach(answer: &mut Value, menu: Vec<Value>, filters: &[Filter], unfiltered: usize) {
    answer["properties"] = json!(menu);
    answer["filters"] = json!(filters.iter().map(json_of).collect::<Vec<_>>());
    answer["unfiltered"] = json!(unfiltered);
}

/// The book scope (`all`, `OT`, `NT` or book ids joined by commas) a Book, Testament and Version filter leaves of `base`.
/// Version: these lists read the KJV only, so any other version leaves nothing (scope `0`).
pub fn scope_for(filters: &[Filter], books: &[crate::bible::Book], base: &str) -> Result<String> {
    if filters.is_empty() {
        return Ok(base.to_string());
    }
    let mut ids: Vec<u32> = books
        .iter()
        .filter(|b| crate::places::in_scope(b, base))
        .map(|b| b.id)
        .collect();
    for f in filters {
        let hit = |b: &crate::bible::Book| -> Result<bool> {
            Ok(match f.key().as_str() {
                "book" => f
                    .values
                    .iter()
                    .any(|v| crate::places::match_book(v, books).is_ok_and(|x| x.id == b.id)),
                "testament" => f.values.iter().any(|v| {
                    let w = v.to_lowercase();
                    (b.testament == "OT" && (w == "ot" || w.starts_with("old")))
                        || (b.testament == "NT" && (w == "nt" || w.starts_with("new")))
                }),
                "version" => f.values.iter().any(|v| v.eq_ignore_ascii_case("KJV")),
                _ => true,
            })
        };
        let keep = |b: &crate::bible::Book| -> Result<bool> {
            Ok(match f.way {
                Way::Is => hit(b)?,
                Way::IsNot => !hit(b)?,
                Way::Set => true,
                Way::NotSet => false,
            })
        };
        let mut next = vec![];
        for id in ids {
            if keep(books.iter().find(|b| b.id == id).unwrap())? {
                next.push(id);
            }
        }
        ids = next;
    }
    Ok(if ids.is_empty() {
        "0".to_string()
    } else {
        ids.iter()
            .map(|i| i.to_string())
            .collect::<Vec<_>>()
            .join(",")
    })
}

/// The Book and Testament (and Version) menu of a list kept by book: `by_book` is book id → count, as the lookups give it.
pub fn book_menu(
    books: &[crate::bible::Book],
    by_book: &serde_json::Map<String, Value>,
    version: bool,
) -> Vec<Value> {
    let count = |b: &crate::bible::Book| {
        by_book
            .get(&b.id.to_string())
            .and_then(Value::as_u64)
            .unwrap_or(0)
    };
    let mut out = vec![
        json!({"name": "Book", "group": "page", "hint": "The book a verse is in", "type": "choice",
        "values": books.iter().filter(|b| count(b) > 0).map(|b| json!({"value": b.name, "label": b.name, "count": count(b)})).collect::<Vec<_>>()}),
    ];
    let side = |t: &str| {
        books
            .iter()
            .filter(|b| b.testament == t)
            .map(count)
            .sum::<u64>()
    };
    out.push(json!({"name": "Testament", "group": "page", "hint": "Old Testament or New Testament", "type": "choice",
        "values": [{"value": "Old Testament", "label": "Old Testament", "count": side("OT")}, {"value": "New Testament", "label": "New Testament", "count": side("NT")}]}));
    if version {
        let n: u64 = books.iter().map(count).sum();
        out.push(json!({"name": "Version", "group": "page", "hint": "The Bible version searched (the KJV)", "type": "choice", "values": [{"value": "KJV", "label": "KJV", "count": n}]}));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_four_ways_and_the_dates_read_and_write() {
        for t in [
            "Status is Open",
            "Status is Open, Done",
            "Status is not Open",
            "Status is not set",
            "Status is set",
            "Edited last 7 days",
            "Written today",
            "Book is Numbers 25",
            "Callout kind is Question",
        ] {
            assert_eq!(parse(t).unwrap().text(), t);
        }
        assert_eq!(parse("status IS Open").unwrap().property, "status");
        assert!(parse("Edited 2026-11-01").is_err());
        assert!(parse("Status Open").is_err());
        assert_eq!(
            parse("Speaker is Moore\\, J., Smith").unwrap().values,
            vec!["Moore, J.".to_string(), "Smith".to_string()]
        );
        assert_eq!(
            parse("Speaker is Moore\\, J.").unwrap().text(),
            "Speaker is Moore\\, J."
        );
    }

    #[test]
    fn passes_by_way() {
        let f = |t: &str| parse(t).unwrap();
        let has = vec!["Open".to_string()];
        assert!(passes(&f("Status is open"), &has));
        assert!(!passes(&f("Status is not Open"), &has));
        assert!(passes(&f("Status is not set"), &[]));
        assert!(passes(&f("Status is set"), &has));
        assert!(passes(
            &f("Edited today"),
            &[Local::now().format("%Y-%m-%dT10:00:00").to_string()]
        ));
        assert!(!passes(
            &f("Edited last 7 days"),
            &["2001-01-01".to_string()]
        ));
    }
}
