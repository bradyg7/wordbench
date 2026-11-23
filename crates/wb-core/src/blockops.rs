//! Two things a block can be given that live in its Markdown (notebook design rows 25 and 44, tickets NB6 and NB7).
//!
//! **A block's background** (row 25b, decided 2026-11-21): `<span data-bg="yellow">` around the block's whole text (after
//! its marker: `## `, `- `, `> [!key] `), the same form selected words use. It is for text blocks only: a paragraph, a
//! heading, a list item, a to-do, a quote or a callout. A scripture block, a table, a divider, a toggle's line and any other
//! fenced block have none. A quote or callout holds one span per line, inside its `> ` marks.
//!
//! **Columns** (rows 15 and 44, library L-23): comment markers in the page, each a block of its own like a toggle's
//! `</details>`: `<!-- columns -->` opens, `<!-- column -->` starts the next column, `<!-- /columns -->` closes. The file
//! reads top to bottom in any editor. A group holds two to four columns; markers that do not balance (one deleted by
//! hand) are read as plain blocks, and nothing is lost. Taking the last block out of a column takes its marker too, and a
//! group left with one column is unwrapped.

use crate::pages::{chars, check_n, insert, list_mark, set, split, sub};
use crate::store::{bad, missing};
use crate::Result;

pub const OPEN: &str = "<!-- columns -->";
pub const SEP: &str = "<!-- column -->";
pub const CLOSE: &str = "<!-- /columns -->";
/// The most columns a group holds.
pub const MAX_COLUMNS: usize = 4;

pub const COLORS: [&str; 8] = [
    "gray", "brown", "orange", "yellow", "green", "blue", "purple", "red",
];

#[derive(Debug, Clone, Copy, PartialEq)]
enum Mark {
    Open,
    Sep,
    Close,
}

fn mark(text: &str) -> Option<Mark> {
    match text.trim() {
        OPEN => Some(Mark::Open),
        SEP => Some(Mark::Sep),
        CLOSE => Some(Mark::Close),
        _ => None,
    }
}

/// A balanced group, by the numbers (from 0) of its blocks.
#[derive(Debug, Clone, PartialEq)]
pub struct Group {
    pub open: usize,
    pub seps: Vec<usize>,
    pub close: usize,
}

impl Group {
    fn edges(&self) -> Vec<usize> {
        let mut e = vec![self.open];
        e.extend(&self.seps);
        e.push(self.close);
        e
    }

    /// Where each column's blocks are: from the block after a marker to the one before the next (`(a, b)`, `a == b` is empty).
    pub fn columns(&self) -> Vec<(usize, usize)> {
        self.edges().windows(2).map(|w| (w[0] + 1, w[1])).collect()
    }
}

fn block_texts(text: &str, titled: bool) -> Vec<String> {
    let c = chars(text);
    split(text, titled)
        .1
        .iter()
        .map(|b| sub(&c, b.start, b.end))
        .collect()
}

/// The balanced groups among these blocks, in order.
pub fn groups_of(texts: &[String]) -> Vec<Group> {
    let mut out = vec![];
    let mut i = 0;
    while i < texts.len() {
        if mark(&texts[i]) == Some(Mark::Open) {
            let mut seps = vec![];
            let mut close = None;
            for (j, t) in texts.iter().enumerate().skip(i + 1) {
                match mark(t) {
                    Some(Mark::Open) => break,
                    Some(Mark::Sep) => seps.push(j),
                    Some(Mark::Close) => {
                        close = Some(j);
                        break;
                    }
                    None => {}
                }
            }
            if let Some(close) = close {
                out.push(Group {
                    open: i,
                    seps,
                    close,
                });
                i = close + 1;
                continue;
            }
        }
        i += 1;
    }
    out
}

/// The markers (block numbers from 0) to take away from the first group an edit left with an empty column or with one
/// column; none when every group is sound.
fn repair(texts: &[String]) -> Option<Vec<usize>> {
    for g in groups_of(texts) {
        let cols = g.columns();
        let edges = g.edges();
        let full = cols.iter().filter(|(a, b)| a < b).count();
        if full <= 1 {
            return Some(edges);
        }
        if let Some(k) = cols.iter().position(|(a, b)| a == b) {
            // an empty column: the marker that begins it (the first column's: the one that ends it)
            return Some(vec![if k == 0 { edges[1] } else { edges[k] }]);
        }
    }
    None
}

/// Take away the markers of a group an edit left with an empty column or with one column. A page whose groups are sound
/// comes back as it was.
pub fn tidy(text: &str, titled: bool) -> Result<String> {
    let mut text = text.to_string();
    for _ in 0..32 {
        let Some(mut gone) = repair(&block_texts(&text, titled)) else {
            return Ok(text);
        };
        gone.sort_unstable_by(|a, b| b.cmp(a));
        for at in gone {
            text = set(&text, titled, at, 1, "")?.0;
        }
    }
    Ok(text)
}

/// Put block `n` beside block `m` (`wb block move ID N --beside M`): at M's right (`left`: its left). When M is not in a
/// group the two become a group of two columns; when it is, N becomes a column next to M's column (at most four). N leaves
/// its old place, and a column or a group that leaves empty goes. → the text, and where N is now (from 0).
pub fn move_beside(
    text: &str,
    titled: bool,
    n: usize,
    m: usize,
    left: bool,
) -> Result<(String, usize)> {
    let texts = block_texts(text, titled);
    check_n_len(&texts, n)?;
    check_n_len(&texts, m)?;
    if n == m {
        return Err(bad("A block cannot go beside itself."));
    }
    if mark(&texts[n]).is_some() || mark(&texts[m]).is_some() {
        return Err(bad(
            "A column marker is not a block; move the blocks, not the markers.",
        ));
    }
    let groups = groups_of(&texts);
    let moving = texts[n].clone();
    let around = |i: usize| groups.iter().find(|g| g.open < i && i < g.close);
    // what goes in, after which block of the page as it is (None: first), as blocks; `at` is where N's copy is in them
    let mut ops: Vec<(Option<usize>, Vec<String>)> = vec![];
    match around(m) {
        None if left => {
            ops.push((Some(m), vec![CLOSE.into()]));
            ops.push((
                m.checked_sub(1),
                vec![OPEN.into(), moving.clone(), SEP.into()],
            ));
        }
        None => {
            ops.push((Some(m), vec![SEP.into(), moving.clone(), CLOSE.into()]));
            ops.push((m.checked_sub(1), vec![OPEN.into()]));
        }
        Some(g) => {
            let cols = g.columns();
            let alone = around(n).is_some_and(|h| h == g)
                && cols.iter().any(|(a, b)| *a <= n && n < *b && b - a == 1);
            if cols.len() + 1 - usize::from(alone) > MAX_COLUMNS {
                return Err(bad(format!("A group holds at most {MAX_COLUMNS} columns.")));
            }
            let (a, b) = *cols.iter().find(|(a, b)| *a <= m && m < *b).unwrap();
            if left {
                ops.push((Some(a - 1), vec![moving.clone(), SEP.into()]));
            } else {
                ops.push((Some(b - 1), vec![SEP.into(), moving.clone()]));
            }
        }
    }
    // highest place first, so a place is never moved by an earlier insertion
    ops.sort_by_key(|o| std::cmp::Reverse(o.0.map(|x| x as i64).unwrap_or(-1)));
    let mut cur = text.to_string();
    let mut model: Vec<(String, bool)> = texts.iter().map(|t| (t.clone(), false)).collect();
    let mut n_now = n;
    for (after, what) in &ops {
        cur = insert(&cur, titled, *after, &what.join("\n\n"))?.0;
        let at = after.map(|x| x + 1).unwrap_or(0);
        for (k, t) in what.iter().enumerate() {
            model.insert(at + k, (t.clone(), *t == moving && !mark(t).is_some()));
        }
        if at <= n_now {
            n_now += what.len();
        }
    }
    // the original goes (it is the one not flagged at n_now), then the groups an edit left unsound
    cur = set(&cur, titled, n_now, 1, "")?.0;
    model.remove(n_now);
    cur = tidy(&cur, titled)?;
    loop {
        let t: Vec<String> = model.iter().map(|x| x.0.clone()).collect();
        let Some(mut gone) = repair(&t) else { break };
        gone.sort_unstable_by(|a, b| b.cmp(a));
        for at in gone {
            model.remove(at);
        }
    }
    let at = model.iter().position(|x| x.1).unwrap_or(0);
    Ok((cur, at))
}

fn check_n_len(texts: &[String], n: usize) -> Result<()> {
    if n >= texts.len() {
        return Err(missing(format!(
            "The page has {} block{}; there is no block {}.",
            texts.len(),
            if texts.len() == 1 { "" } else { "s" },
            n + 1
        )));
    }
    Ok(())
}

// ---- a block's background ---------------------------------------------------------------------------------------------

/// Is this block text a block that can have a background?
pub fn takes_background(kind: &str, text: &str) -> bool {
    let t = text.trim();
    matches!(
        kind,
        "paragraph" | "heading" | "item" | "numbered" | "todo" | "quote"
    ) && !t.starts_with("<details")
        && !t.starts_with("</details>")
        && !t.starts_with("<!--")
}

/// The characters a line's marker takes before its text (`## `, `- [ ] `, `> `, `> [!key] `).
fn lead_len(line: &str, kind: &str, first: bool) -> usize {
    let cs: Vec<char> = line.chars().collect();
    let spaces = |from: usize| {
        cs[from.min(cs.len())..]
            .iter()
            .take_while(|c| **c == ' ' || **c == '\t')
            .count()
    };
    match kind {
        "heading" if first => {
            let lead = spaces(0);
            let hashes = cs[lead..].iter().take_while(|c| **c == '#').count();
            lead + hashes + spaces(lead + hashes)
        }
        "item" | "numbered" | "todo" if first => {
            let mut n = list_mark(line).map(|m| m.1).unwrap_or(0).min(cs.len());
            if kind == "todo" {
                let rest: String = cs[n..].iter().collect();
                if let Some(c) = ["[ ] ", "[x] ", "[X] ", "[ ]", "[x]", "[X]"]
                    .iter()
                    .find(|c| rest.starts_with(**c))
                {
                    n += c.chars().count();
                }
            }
            n
        }
        "quote" => {
            let mut at = spaces(0);
            while at < cs.len() && cs[at] == '>' {
                at += 1;
                at += spaces(at);
            }
            if first && cs.get(at) == Some(&'[') && cs.get(at + 1) == Some(&'!') {
                if let Some(end) = cs[at..].iter().position(|c| *c == ']') {
                    at += end + 1;
                    at += spaces(at);
                }
            }
            at
        }
        _ => spaces(0),
    }
}

/// `<span data-bg="x">inner</span>` as one span around everything: its colour and what is inside, else None.
fn bg_wrap(body: &str) -> Option<(String, String)> {
    let rest = body.strip_prefix("<span data-bg=\"")?;
    let q = rest.find("\">")?;
    let name = &rest[..q];
    if !COLORS.contains(&name) {
        return None;
    }
    let inner = rest[q + 2..].strip_suffix("</span>")?;
    // the first span ends at the last `</span>` only if what is inside opens as many spans as it closes
    if inner.matches("<span").count() != inner.matches("</span>").count() {
        return None;
    }
    Some((name.to_string(), inner.to_string()))
}

fn split_at_chars(s: &str, at: usize) -> (String, String) {
    (s.chars().take(at).collect(), s.chars().skip(at).collect())
}

/// The block's background colour, if its whole text is in one `data-bg` span.
pub fn bg_of(kind: &str, text: &str) -> Option<String> {
    if !takes_background(kind, text) {
        return None;
    }
    if kind == "quote" {
        let mut found: Option<String> = None;
        for (i, l) in text.split('\n').enumerate() {
            let (_, body) = split_at_chars(l, lead_len(l, kind, i == 0));
            if body.trim().is_empty() {
                continue;
            }
            let (c, _) = bg_wrap(body.trim_end())?;
            if found.as_ref().is_some_and(|f| *f != c) {
                return None;
            }
            found = Some(c);
        }
        return found;
    }
    let first = text.split('\n').next().unwrap_or("");
    let (_, body) = split_at_chars(text, lead_len(first, kind, true));
    bg_wrap(body.trim_end()).map(|x| x.0)
}

/// The block's Markdown with its background set to `name` (None: Default, none). None when the block is not text.
pub fn colored(kind: &str, text: &str, name: Option<&str>) -> Option<String> {
    if !takes_background(kind, text) {
        return None;
    }
    let wrap = |body: &str| -> String {
        let body = body.trim_end();
        let inner = bg_wrap(body)
            .map(|x| x.1)
            .unwrap_or_else(|| body.to_string());
        match name {
            Some(c) if !inner.is_empty() => format!("<span data-bg=\"{c}\">{inner}</span>"),
            _ => inner,
        }
    };
    if kind == "quote" {
        let out: Vec<String> = text
            .split('\n')
            .enumerate()
            .map(|(i, l)| {
                let (head, body) = split_at_chars(l, lead_len(l, kind, i == 0));
                if body.trim().is_empty() {
                    l.to_string()
                } else {
                    format!("{head}{}", wrap(&body))
                }
            })
            .collect();
        return Some(out.join("\n"));
    }
    let first = text.split('\n').next().unwrap_or("");
    let (head, body) = split_at_chars(text, lead_len(first, kind, true));
    if body.trim().is_empty() {
        return Some(text.to_string());
    }
    Some(format!("{head}{}", wrap(&body)))
}

/// Give `count` blocks from block `n` a background (`wb block color ID N NAME --count K`; `None`: Default). A block that is
/// not text is left as it is; if none of them is text it is an error. → the text.
pub fn color_blocks(
    text: &str,
    titled: bool,
    n: usize,
    count: usize,
    name: Option<&str>,
) -> Result<String> {
    if let Some(c) = name {
        if !COLORS.contains(&c) {
            return Err(bad(format!(
                "The colors are {} and default.",
                COLORS.join(", ")
            )));
        }
    }
    let bs = split(text, titled).1;
    check_n(&bs, n, count)?;
    let c = chars(text);
    let mut out = text.to_string();
    let mut any = false;
    for i in (n..n + count).rev() {
        let old = sub(&c, bs[i].start, bs[i].end);
        let Some(new) = colored(bs[i].kind, &old, name) else {
            continue;
        };
        any = true;
        if new != old {
            out = set(&out, titled, i, 1, &new)?.0;
        }
    }
    if !any {
        return Err(bad("A background is for text blocks: a paragraph, a heading, a list item, a quote or a callout."));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds_texts(text: &str) -> Vec<String> {
        block_texts(text, true)
    }

    #[test]
    fn a_background_wraps_the_whole_text_after_the_marker() {
        let t = "Title\n\nPlain words here\n\n## A heading\n\n- an item\n\n- [ ] do it\n\n> [!key] a point\n> second line";
        let out = color_blocks(t, true, 0, 5, Some("yellow")).unwrap();
        assert_eq!(
            kinds_texts(&out),
            [
                "<span data-bg=\"yellow\">Plain words here</span>",
                "## <span data-bg=\"yellow\">A heading</span>",
                "- <span data-bg=\"yellow\">an item</span>",
                "- [ ] <span data-bg=\"yellow\">do it</span>",
                "> [!key] <span data-bg=\"yellow\">a point</span>\n> <span data-bg=\"yellow\">second line</span>",
            ]
        );
        // read back, and replaced, and taken off
        let blocks = split(&out, true).1;
        let c = chars(&out);
        assert_eq!(
            bg_of(blocks[1].kind, &sub(&c, blocks[1].start, blocks[1].end)).as_deref(),
            Some("yellow")
        );
        assert_eq!(
            bg_of("quote", &kinds_texts(&out)[4]).as_deref(),
            Some("yellow")
        );
        let blue = color_blocks(&out, true, 0, 5, Some("blue")).unwrap();
        assert!(
            blue.contains("<span data-bg=\"blue\">Plain words here</span>")
                && !blue.contains("yellow")
        );
        assert_eq!(color_blocks(&blue, true, 0, 5, None).unwrap(), t);
    }

    #[test]
    fn a_background_only_goes_on_text_blocks() {
        let t = "Title\n\n```scripture\nNum 25:11\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nWords";
        // one text block among others: the others stay as they are
        let out = color_blocks(t, true, 0, 3, Some("red")).unwrap();
        assert!(out.starts_with("Title\n\n```scripture\nNum 25:11\n```\n\n| a | b |"));
        assert!(out.ends_with("<span data-bg=\"red\">Words</span>"));
        assert!(color_blocks(t, true, 0, 1, Some("red")).is_err());
        assert!(color_blocks(t, true, 3, 1, Some("mauve")).is_err());
    }

    fn page(blocks: &[&str]) -> String {
        format!("Title\n\n{}", blocks.join("\n\n"))
    }

    /// Block `what` beside block `by` (named by their words), at its right or left.
    fn beside(text: &str, what: &str, by: &str, left: bool) -> Result<String> {
        let t = kinds_texts(text);
        let at = |w: &str| t.iter().position(|x| x == w).unwrap();
        Ok(move_beside(text, true, at(what), at(by), left)?.0)
    }

    #[test]
    fn beside_makes_columns_and_takes_them_back() {
        let t = page(&["one", "two", "three"]);
        let out = beside(&t, "three", "one", false).unwrap();
        assert_eq!(kinds_texts(&out), [OPEN, "one", SEP, "three", CLOSE, "two"]);
        assert_eq!(
            move_beside(&t, true, 2, 0, false).unwrap().1,
            3,
            "the moved block's number"
        );
        // a third column, and a fourth is the most a group holds
        let out = beside(&out, "two", "three", false).unwrap();
        assert_eq!(
            kinds_texts(&out),
            [OPEN, "one", SEP, "three", SEP, "two", CLOSE]
        );
        let t4 = page(&["a", "b", "c", "d", "e"]);
        let mut o = beside(&t4, "b", "a", false).unwrap();
        o = beside(&o, "c", "b", false).unwrap();
        o = beside(&o, "d", "c", false).unwrap();
        assert_eq!(
            kinds_texts(&o),
            [OPEN, "a", SEP, "b", SEP, "c", SEP, "d", CLOSE, "e"]
        );
        assert!(
            beside(&o, "e", "a", false).is_err(),
            "a fifth column is refused"
        );
        // a block taken out of a column of several keeps the others; the last of a column takes its marker
        let o = beside(&o, "a", "d", false).unwrap();
        assert_eq!(
            kinds_texts(&o),
            [OPEN, "b", SEP, "c", SEP, "d", SEP, "a", CLOSE, "e"]
        );
        // moving into the same group when it is full is allowed when the block leaves a column of its own
        let left = beside(&o, "a", "b", true).unwrap();
        assert_eq!(
            kinds_texts(&left),
            [OPEN, "a", SEP, "b", SEP, "c", SEP, "d", CLOSE, "e"]
        );
        // two columns left: one leaves and the group is unwrapped
        let two = beside(&t, "three", "one", true).unwrap();
        assert_eq!(kinds_texts(&two), [OPEN, "three", SEP, "one", CLOSE, "two"]);
        let gone = crate::pages::move_block(&two, true, 3, 6).unwrap().0;
        assert_eq!(
            kinds_texts(&tidy(&gone, true).unwrap()),
            ["three", "two", "one"]
        );
        // the same through an edit that removes a block
        let rm = set(&two, true, 3, 1, "").unwrap().0;
        assert_eq!(kinds_texts(&tidy(&rm, true).unwrap()), ["three", "two"]);
    }

    #[test]
    fn unbalanced_markers_read_as_plain_blocks() {
        let t = page(&[OPEN, "one", SEP, "two"]);
        assert!(groups_of(&kinds_texts(&t)).is_empty());
        assert_eq!(tidy(&t, true).unwrap(), t);
        assert!(move_beside(&t, true, 1, 3, false).is_ok());
    }
}
