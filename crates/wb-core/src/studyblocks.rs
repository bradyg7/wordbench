//! The Study blocks of the / menu beyond Scripture and Word (notebook rows 51 to 55, NB12): each holds one thing in its fence,
//! a reference or an English word, never text, and reads what it shows from the database or the study folder each time the
//! page is drawn.
//!
//! | Fence | Holds | Shows |
//! |---|---|---|
//! | ```` ```interlinear ```` | a reference | the verses' original words, each with sound, gloss and number (`wb interlinear`) |
//! | ```` ```xrefs ```` | a reference | cross references: the app has no source for them, so it says so (`wb xrefs`) |
//! | ```` ```concordance ```` | an English word | every place of the word in Bible order (`wb concordance`) |
//! | ```` ```margin ```` | a passage | the margin notes on it, by verse (`wb mark notes`) |
//! | ```` ```marks ```` | a passage | every mark on it with its Legend style and the marked words (`wb mark in`) |

use crate::bible::Bible;
use crate::pages::{chars, edit, split, sub, text_of, value_fence, value_fence_text, Edit};
use crate::places::{parse_span, span_label, Span};
use crate::store::{bad, Store};
use crate::Result;
use serde_json::{json, Value};

/// The fence names, in the order the / menu lists them.
pub const LANGS: [&str; 5] = ["interlinear", "xrefs", "concordance", "margin", "marks"];

/// Said where the Cross references block would list them (row 52): the app has no cross-reference source.
pub const NO_XREFS: &str = "No cross references: the app has no cross-reference source yet.";
const XREFS_NOTE: &str = "Proposed: wb xrefs REF, after a source is chosen.";

/// The cross references of a reference (`wb xrefs`). The app has no source for them, so none is listed and the answer says so.
pub fn xrefs(bible: &Bible, place: &str) -> Result<Value> {
    let sp = parse_span(place, bible.books())?;
    Ok(
        json!({"place": span_label(&sp), "count": 0, "references": [], "source": null, "message": NO_XREFS, "note": XREFS_NOTE}),
    )
}

/// A passage's original words (`wb interlinear`), trimmed to what the block draws: per verse its words, each with the
/// original, sound, gloss and Strong's number.
fn interlinear(bible: &Bible, sp: &Span) -> Result<Value> {
    let c2 = (sp.c2 != sp.c1).then_some(sp.c2);
    let d = crate::lookup::interlinear(
        bible,
        sp.book.id,
        sp.c1,
        sp.v1 as i64,
        c2,
        sp.v2 as i64,
        0,
        crate::lookup::INTERLINEAR_VERSES,
    )?;
    let verses: Vec<Value> = d["verses"]
        .as_array()
        .map(|vs| {
            vs.iter()
                .map(|v| {
                    let words: Vec<Value> = v["words"]
                        .as_array()
                        .map(|ws| ws.iter().map(|w| json!({"original": w["original"], "translit": w["translit"], "gloss": w["gloss"], "strong": w["strong"]})).collect())
                        .unwrap_or_default();
                    json!({"c": v["c"], "v": v["v"], "words": words})
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(
        json!({"label": span_label(sp), "lang": d["lang"], "verses": verses, "total": d["total"], "more": d["more"]}),
    )
}

/// The margin notes on a passage, by verse (`wb mark notes` for a chapter; the notes covering the verses of a verse passage).
fn margin(bible: &Bible, store: &Store, sp: &Span) -> Result<Value> {
    let code = sp.book.code.as_str();
    let mut notes: Vec<Value> = vec![];
    if sp.v1 == 0 {
        for c in sp.c1..=sp.c2 {
            let d = crate::margin::chapter(bible, store, &format!("{code} {c}"))?;
            notes.extend(d["notes"].as_array().cloned().unwrap_or_default());
        }
    } else {
        notes = crate::margin::covering(
            bible,
            store,
            code,
            (sp.c1, sp.v1),
            (sp.c2, if sp.v2 == 0 { sp.v1 } else { sp.v2 }),
        );
    }
    Ok(json!({"label": span_label(sp), "count": notes.len(), "notes": notes}))
}

/// A page's Study blocks (`wb page study`): for each interlinear, xrefs, concordance, margin and marks block, its number
/// (from 1, as `wb page blocks` counts), its fence (`lang`), what it holds (`held`) and what it shows now. A block that
/// cannot be read says why in `error`. Nothing of it is in the file.
pub fn page(bible: &Bible, store: &Store, id: &str) -> Result<Value> {
    let (id, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let mut out = vec![];
    for (i, b) in split(&text, titled).1.iter().enumerate() {
        if b.kind != "fence" {
            continue;
        }
        let md = sub(&c, b.start, b.end);
        let Some((lang, held)) = LANGS
            .iter()
            .find_map(|l| value_fence(&md, l).map(|h| (*l, h)))
        else {
            continue;
        };
        let mut v = json!({"n": i + 1, "lang": lang, "held": held});
        match show(bible, store, lang, &held) {
            Ok(d) => v["data"] = d,
            Err(e) => v["error"] = json!(e.0),
        }
        out.push(v);
    }
    Ok(json!({"id": id, "blocks": out}))
}

/// What a block of this kind may hold, checked: a Strong's number the lexicon has (`word`), an English word
/// (`concordance`), or a reference the Bible has (the others). → the value as the fence keeps it.
pub fn checked(bible: &Bible, lang: &str, value: &str) -> Result<String> {
    let v = value.trim();
    match lang {
        "word" => {
            let st = v.to_uppercase();
            if !crate::lookup::is_strong(&st) || crate::lookup::strong(bible, &st)?.is_none() {
                return Err(bad(format!(
                    "“{v}” is not a Strong's number the lexicon has (H7065, G25)."
                )));
            }
            Ok(st)
        }
        "concordance" => {
            let w = v.to_lowercase();
            if !crate::lookup::is_word(&w) {
                return Err(bad("Give one English word, like zeal."));
            }
            Ok(w)
        }
        l if LANGS.contains(&l) => {
            parse_span(v, bible.books())?;
            Ok(v.to_string())
        }
        _ => Err(bad(format!(
            "“{lang}” is not a Study block: word, {}.",
            LANGS.join(", ")
        ))),
    }
}

/// A Study block as it is written: its fence and the one value.
pub fn fence_text(lang: &str, value: &str) -> String {
    value_fence_text(lang, value)
}

/// Write block `n` (from 0) of a page anew with another value (`wb block study`): the block's own fence stays (`word`
/// or one of `LANGS`). → the page's blocks, as `pages::edit`.
pub fn set(bible: &Bible, store: &mut Store, id: &str, n: usize, value: &str) -> Result<Value> {
    let (_, text, titled) = text_of(store, id)?;
    let c = chars(&text);
    let bs = split(&text, titled).1;
    let b = bs
        .get(n)
        .ok_or_else(|| bad(format!("The page has {} blocks.", bs.len())))?;
    let md = sub(&c, b.start, b.end);
    let lang = ["word"]
        .into_iter()
        .chain(LANGS)
        .find(|l| value_fence(&md, l).is_some())
        .ok_or_else(|| bad(format!("Block {} is not a Study block.", n + 1)))?;
    let held = checked(bible, lang, value)?;
    edit(
        bible,
        store,
        id,
        Edit::Set {
            n,
            count: 1,
            text: &fence_text(lang, &held),
        },
    )
}

fn show(bible: &Bible, store: &Store, lang: &str, held: &str) -> Result<Value> {
    if held.trim().is_empty() {
        return Err(bad(if lang == "concordance" {
            "No word yet: write one under ```concordance, like zeal.".to_string()
        } else {
            format!("No reference yet: write one under ```{lang}.")
        }));
    }
    if lang == "concordance" {
        let mode = crate::concordance::forms_mode(store);
        return crate::concordance::page(bible, held.trim(), &mode, None);
    }
    let sp = parse_span(held, bible.books())?;
    match lang {
        "interlinear" => interlinear(bible, &sp),
        "xrefs" => xrefs(bible, held),
        "margin" => margin(bible, store, &sp),
        _ => crate::marks::in_passage(bible, store, held),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xrefs_say_there_is_no_source() {
        assert!(NO_XREFS.contains("no cross-reference source"));
    }

    #[test]
    fn each_fence_holds_one_value() {
        for l in LANGS {
            assert_eq!(
                value_fence(&format!("```{l}\nNum 25:11\n```"), l).as_deref(),
                Some("Num 25:11")
            );
            assert_eq!(value_fence(&format!("```{l}\n```"), l).as_deref(), Some(""));
        }
        assert_eq!(value_fence("```word\nH7065\n```", "marks"), None);
    }
}
