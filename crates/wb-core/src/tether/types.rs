//! The shapes `wb tether` prints (design/features/tether, "Commands"). Evidence is words and counts, never a score.

use serde::{Deserialize, Serialize};

/// Characters in one block's Markdown.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Range {
    pub start: usize,
    pub end: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Evidence {
    /// `written`, `spoken` or `quote`.
    pub kind: String,
    /// Quotations: how many words of the verse are in the note, in order, and how many the verse has.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub of: Option<usize>,
    /// The matched words in the note, in order.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub words: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Place {
    /// The block (from 1) the scripture block goes after, as `wb page blocks` counts, before any split.
    pub after_block: usize,
    /// Where in that block's Markdown it is split (characters), when it is.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_at: Option<usize>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Candidate {
    pub id: String,
    /// `named` or `quoted`.
    pub tier: String,
    #[serde(rename = "ref")]
    pub reference: String,
    /// How many verses the reference holds.
    pub verses: usize,
    pub version: String,
    /// The block's number, from 1.
    pub block: usize,
    pub range: Range,
    /// The person's words found, as written.
    pub words: String,
    pub evidence: Evidence,
    /// The verse, verbatim from the database (empty for a long chapter).
    pub text: String,
    pub place: Place,
    /// Ids of the other verses the same words fit.
    pub also: Vec<String>,
    /// `new`, `in_page` or `skipped`.
    pub status: String,
}

/// Words found in more than 3 verses: counted, not offered.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Many {
    pub words: String,
    pub verses: usize,
    pub block: usize,
    pub range: Range,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct Summary {
    pub words: usize,
    pub blocks: usize,
    pub named: usize,
    pub quoted: usize,
    pub new: usize,
    pub in_page: usize,
    pub skipped: usize,
    pub many: Vec<Many>,
    /// A digest of the page text the run read, for `accept --expect`.
    pub page_hash: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct Report {
    pub page: String,
    pub summary: Summary,
    pub candidates: Vec<Candidate>,
}
