//! Tether (design/features/tether): find the scripture in a long note, only what the person's own words already hold.
//! Tier 1 reads a reference the person wrote or spoke; tier 2 reports words that are, in order, the words of a verse.
//! Nothing here is by meaning, nothing leaves the computer, and nothing is attached until Accept.

pub mod accept;
pub mod anchor;
#[doc(hidden)]
pub mod corpus;
pub mod quote;
pub mod skips;
pub mod spoken;
pub mod types;

pub use types::*;
