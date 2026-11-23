//! Tether (design/features/tether, "What the build must satisfy") on the generated scratch study: 420 pages, a long "Word
//! dump" as one block, one of 90 paragraphs, and what was planted in them. The corpus knows what it planted, so each line
//! has an exact expected result. Scripture comes from the database; nothing here types a verse.

mod common;

use common::*;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use wb_core::bible::Bible;
use wb_core::pages;
use wb_core::store::Store;
use wb_core::tether::{accept, anchor, corpus, Candidate, Report};

struct Fixture {
    root: PathBuf,
    expected: Value,
}

fn fixture() -> Option<&'static Fixture> {
    static F: OnceLock<Option<Fixture>> = OnceLock::new();
    F.get_or_init(|| {
        let b = bible()?;
        let root = std::env::temp_dir()
            .join("bible-workbench-rs")
            .join("tether-corpus")
            .join(format!("{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let made = corpus::make(&b, &root.join("study"), 2026).unwrap();
        Some(Fixture {
            root,
            expected: made.expected,
        })
    })
    .as_ref()
}

fn copy_dir(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for e in std::fs::read_dir(from).unwrap().flatten() {
        let p = e.path();
        if p.is_dir() {
            copy_dir(&p, &to.join(e.file_name()));
        } else {
            std::fs::copy(&p, to.join(e.file_name())).unwrap();
        }
    }
}

/// A study of its own for one test (a copy of the corpus), and the Bible.
struct Work {
    _scratch: Scratch,
    store: Store,
    bible: Bible,
    expected: Value,
}

fn work() -> Option<Work> {
    let f = fixture()?;
    let scratch = Scratch::new();
    copy_dir(&f.root.join("study"), &scratch.path().join("study"));
    let store = Store::open(&scratch.path().join("study")).unwrap();
    Some(Work {
        _scratch: scratch,
        store,
        bible: bible()?,
        expected: f.expected.clone(),
    })
}

impl Work {
    fn page(&self, name: &str) -> String {
        self.expected["pages"][name].as_str().unwrap().to_string()
    }
    fn items(&self, page: &str, kinds: &[&str]) -> Vec<Value> {
        self.expected["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|i| i["page"] == page && kinds.contains(&i["kind"].as_str().unwrap()))
            .cloned()
            .collect()
    }
    fn run(&self, name: &str, tier: &str) -> Report {
        let opt = anchor::Options {
            tier: tier.into(),
            ..Default::default()
        };
        anchor::run(&self.bible, &self.store, &self.page(name), &opt).unwrap()
    }
    fn text(&self, id: &str) -> String {
        self.store.find_note(id).unwrap()["text"]
            .as_str()
            .unwrap()
            .to_string()
    }
    fn blocks(&self, id: &str) -> Vec<(String, String)> {
        pages::blocks(&self.store, id).unwrap()["blocks"]
            .as_array()
            .unwrap()
            .iter()
            .map(|b| {
                (
                    b["kind"].as_str().unwrap().into(),
                    b["text"].as_str().unwrap().into(),
                )
            })
            .collect()
    }
    fn page_from(&mut self, text: &str) -> String {
        self.store.jot(text, false).unwrap()["id"]
            .as_str()
            .unwrap()
            .to_string()
    }
}

fn at(it: &Value) -> (usize, usize) {
    (
        it["start"].as_u64().unwrap() as usize,
        it["end"].as_u64().unwrap() as usize,
    )
}

fn overlapping<'a>(r: &'a Report, it: &Value) -> Vec<&'a Candidate> {
    let (s, e) = at(it);
    r.candidates
        .iter()
        .filter(|c| {
            c.block == it["block"].as_u64().unwrap() as usize
                && c.range.start < e
                && s < c.range.end
        })
        .collect()
}

fn chars(text: &str, a: usize, b: usize) -> String {
    text.chars().skip(a).take(b - a).collect()
}

#[test]
fn the_corpus_is_what_the_design_says() {
    let Some(mut w) = work() else { return };
    assert_eq!(w.store.inbox().len(), 420, "420 pages");
    let words = w.expected["words"]["Word dump"].as_u64().unwrap();
    assert!(words > 6000, "a long word dump: {words} words");
    for (kind, n) in [
        ("written", 40),
        ("spoken", 25),
        ("exact", 60),
        ("dropout", 30),
        ("many", 15),
        ("parallel", 10),
        ("paraphrase", 20),
        ("decoy", 5),
    ] {
        assert_eq!(w.items("Word dump", &[kind]).len(), n, "{kind}");
    }
    assert_eq!(w.blocks(&w.page("Word dump")).len(), 1, "one raw block");
    assert_eq!(w.blocks(&w.page("Word dump paragraphs")).len(), 90);
    let _ = w.page_from("x\n\ny");
}

#[test]
fn named_written_and_spoken_are_found_with_their_words() {
    let Some(w) = work() else { return };
    let r = w.run("Word dump", "all");
    let text = &w.blocks(&w.page("Word dump"))[0].1;
    for it in w.items("Word dump", &["written", "spoken"]) {
        let hit: Vec<&Candidate> = overlapping(&r, &it)
            .into_iter()
            .filter(|c| c.tier == "named")
            .collect();
        assert_eq!(hit.len(), 1, "{it}");
        let c = hit[0];
        assert_eq!(c.reference, it["ref"].as_str().unwrap());
        assert_eq!((c.range.start, c.range.end), at(&it), "{it}");
        assert_eq!(
            chars(text, c.range.start, c.range.end),
            it["words"].as_str().unwrap()
        );
        assert_eq!(c.evidence.kind, it["kind"].as_str().unwrap(), "{it}");
        assert_eq!(c.words, it["words"].as_str().unwrap());
    }
    assert_eq!(r.summary.named, 65);
    // the same on a page of paragraphs
    let r = w.run("Word dump paragraphs", "named");
    assert_eq!(r.summary.named, 65);
}

#[test]
fn spoken_forms_that_are_two_things_or_nothing() {
    let Some(mut w) = work() else { return };
    let p = w.page_from(
        "Reading\n\nlater we read Psalm one twenty three today, then verse twenty eight says",
    );
    let r = anchor::run(&w.bible, &w.store, &p, &anchor::Options::default()).unwrap();
    let refs: Vec<&str> = r.candidates.iter().map(|c| c.reference.as_str()).collect();
    // Psalm 1 has 6 verses, so 1:23 is not a reading; 123 is
    assert_eq!(refs, vec!["Psalms 123"], "{refs:?}");
    let q = w.page_from("Reading\n\nyou will find it in the second Timothy two fifteen part and the Romans eight verse twenty eight part");
    let r = anchor::run(&w.bible, &w.store, &q, &anchor::Options::default()).unwrap();
    let refs: Vec<&str> = r.candidates.iter().map(|c| c.reference.as_str()).collect();
    assert_eq!(refs, vec!["2 Timothy 2:15", "Romans 8:28"]);
    assert!(r.candidates.iter().all(|c| c.evidence.kind == "spoken"));
}

#[test]
fn decoys_and_bare_verses_are_not_guessed() {
    let Some(mut w) = work() else { return };
    let r = w.run("Word dump", "all");
    for it in w.items("Word dump", &["decoy"]) {
        assert!(overlapping(&r, &it).is_empty(), "{it}");
    }
    let p = w.page_from("Reading\n\nverse 28 says it, and it is 5:2 today, and so am 5:30");
    let r = anchor::run(&w.bible, &w.store, &p, &anchor::Options::default()).unwrap();
    assert!(
        r.candidates.is_empty(),
        "{:?}",
        r.candidates
            .iter()
            .map(|c| &c.reference)
            .collect::<Vec<_>>()
    );
}

#[test]
fn quotations_are_found_and_paraphrases_are_not() {
    let Some(w) = work() else { return };
    let r = w.run("Word dump", "all");
    let found = |kind: &str| {
        w.items("Word dump", &[kind])
            .iter()
            .filter(|it| {
                overlapping(&r, it).iter().any(|c| {
                    c.tier == "quoted" && c.reference.contains(it["ref"].as_str().unwrap())
                })
            })
            .count()
    };
    let (exact, dropout) = (found("exact"), found("dropout"));
    assert!(exact >= 57, "{exact} of 60 exact");
    assert!(dropout >= 27, "{dropout} of 30 with words dropped");
    for it in w.items("Word dump", &["exact", "dropout"]) {
        for c in overlapping(&r, &it)
            .into_iter()
            .filter(|c| c.reference == it["ref"].as_str().unwrap())
        {
            let (m, of) = (c.evidence.matched.unwrap(), c.evidence.of.unwrap());
            assert!(m >= 6 && m <= of, "{} {m} of {of}", c.reference);
            assert_eq!(c.evidence.words.len(), m);
            // the matched words are the note's own words, in order, and the verse's too
            let ws = wb_core::tether::quote::words_of(&c.words);
            let mut i = 0;
            for mw in &c.evidence.words {
                while i < ws.len() && ws[i].w != *mw {
                    i += 1;
                }
                assert!(i < ws.len(), "{mw} is not in {}", c.words);
                i += 1;
            }
            let verse: Vec<String> = wb_core::tether::quote::words_of(&c.text)
                .into_iter()
                .map(|x| x.w)
                .collect();
            let mut j = 0;
            for mw in &c.evidence.words {
                while j < verse.len() && verse[j] != *mw {
                    j += 1;
                }
                assert!(j < verse.len(), "{mw} is not in the verse {}", c.text);
                j += 1;
            }
        }
    }
    for it in w.items("Word dump", &["paraphrase"]) {
        assert!(overlapping(&r, &it).is_empty(), "paraphrase found: {it}");
    }
}

#[test]
fn filler_alone_finds_nothing_and_phrases_in_many_verses_are_counted() {
    let Some(w) = work() else { return };
    let f = w.run("Filler only", "all");
    assert!(
        f.candidates.is_empty(),
        "{:?}",
        f.candidates.iter().map(|c| &c.words).collect::<Vec<_>>()
    );
    assert!(f.summary.many.is_empty());
    let r = w.run("Word dump", "all");
    assert!(r.summary.many.len() >= 15, "{}", r.summary.many.len());
    for it in w.items("Word dump", &["many"]) {
        assert!(overlapping(&r, &it).is_empty(), "offered: {it}");
        assert!(
            r.summary
                .many
                .iter()
                .any(|m| m.range.start < at(&it).1 && at(&it).0 < m.range.end && m.verses > 3),
            "{it}"
        );
    }
    for it in w.items("Word dump", &["parallel"]) {
        let cs = overlapping(&r, &it);
        let want = it["refs"].as_array().unwrap().len();
        assert_eq!(cs.len(), want, "{it}");
        let mut refs: Vec<&str> = cs.iter().map(|c| c.reference.as_str()).collect();
        refs.sort();
        let mut exp: Vec<&str> = it["refs"]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| x.as_str().unwrap())
            .collect();
        exp.sort();
        assert_eq!(refs, exp);
        for c in &cs {
            assert_eq!(c.also.len(), want - 1, "no one preferred, all linked");
        }
    }
}

#[test]
fn evidence_is_words_and_counts_in_the_order_of_the_page() {
    let Some(w) = work() else { return };
    let r = w.run("Word dump paragraphs", "all");
    fn keys(v: &Value, out: &mut Vec<String>) {
        match v {
            Value::Object(m) => m.iter().for_each(|(k, x)| {
                out.push(k.to_lowercase());
                keys(x, out);
            }),
            Value::Array(a) => a.iter().for_each(|x| keys(x, out)),
            _ => {}
        }
    }
    let mut seen = vec![];
    keys(&serde_json::to_value(&r.summary).unwrap(), &mut seen);
    for c in &r.candidates {
        // the fields and the kinds, not the words of the person or the verse
        keys(&serde_json::to_value(c).unwrap().as_object().map(|m| Value::Object(m.iter().filter(|(k, _)| !["words", "text"].contains(&k.as_str())).map(|(k, v)| (k.clone(), if k == "evidence" { serde_json::json!({"kind": v["kind"], "matched": v["matched"], "of": v["of"]}) } else { v.clone() })).collect())).unwrap(), &mut seen);
    }
    for bad in [
        "score",
        "percent",
        "strong",
        "likely",
        "best",
        "confidence",
        "rank",
    ] {
        assert!(
            !seen
                .iter()
                .any(|k| k.contains(bad) && k.len() < 40 && !k.contains(' ')),
            "{bad} in the output"
        );
    }
    let order: Vec<(usize, usize)> = r
        .candidates
        .iter()
        .map(|c| (c.block, c.range.start))
        .collect();
    let mut sorted = order.clone();
    sorted.sort();
    assert_eq!(order, sorted);
    // run twice: the same candidates and ids
    let again = w.run("Word dump paragraphs", "all");
    assert_eq!(r, again);
}

#[test]
fn accept_adds_a_scripture_block_after_the_sentence_and_undo_restores_it() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump paragraphs");
    let r = w.run("Word dump paragraphs", "all");
    let c = r
        .candidates
        .iter()
        .find(|c| {
            c.tier == "quoted"
                && c.also.is_empty()
                && c.place.split_at.is_some_and(|s| s > c.range.end)
        })
        .unwrap()
        .clone();
    let before_text = w.text(&id);
    let before = w.blocks(&id);
    let opt = anchor::Options::default();
    // a dry run writes nothing
    let dry = accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[c.id.clone()],
        false,
        None,
        true,
        &opt,
    )
    .unwrap();
    assert_eq!(dry.json["dry_run"], true);
    assert_eq!(w.text(&id), before_text);
    let done = accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[c.id.clone()],
        false,
        Some(&r.summary.page_hash),
        false,
        &opt,
    )
    .unwrap();
    let after = w.blocks(&id);
    assert_eq!(after.len(), before.len() + 2, "numbers up by 2");
    let n = done.json["added"][0].as_u64().unwrap() as usize;
    assert_eq!(after[n - 1].0, "fence");
    let f = pages::scripture_fence(&after[n - 1].1).unwrap();
    assert_eq!(f.reference, c.reference);
    assert_eq!(
        after[n - 1].1,
        format!("```scripture\n{}\n```", c.reference),
        "only the reference"
    );
    // the halves, joined with one space, are the block as it was, apart from whitespace at the cut
    let joined = format!("{} {}", after[n - 2].1, after[n].1);
    assert_eq!(
        joined.split_whitespace().collect::<Vec<_>>(),
        before[c.block - 1].1.split_whitespace().collect::<Vec<_>>()
    );
    assert!(
        after[n - 2].1.ends_with('.'),
        "cut at the sentence end: {}",
        after[n - 2].1
    );
    assert!(!w.text(&id).contains(&c.text), "no verse text in the file");
    // run again: it is in the page, and `new` is one less
    let again = w.run("Word dump paragraphs", "all");
    assert_eq!(
        again
            .candidates
            .iter()
            .find(|x| x.id == c.id)
            .unwrap()
            .status,
        "in_page"
    );
    assert_eq!(again.summary.new, r.summary.new - 1);
    // one Undo, byte for byte
    accept::undo(&w.bible, &mut w.store, &done.token).unwrap();
    assert_eq!(w.text(&id), before_text);
}

#[test]
fn without_punctuation_the_split_is_at_the_words_end() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump");
    let r = w.run("Word dump", "all");
    let c = r
        .candidates
        .iter()
        .find(|c| {
            c.tier == "quoted"
                && c.also.is_empty()
                && c.range.end + 60 < w.blocks(&id)[0].1.chars().count()
        })
        .unwrap()
        .clone();
    assert_eq!(c.place.split_at, Some(c.range.end));
    accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[c.id.clone()],
        false,
        None,
        false,
        &anchor::Options::default(),
    )
    .unwrap();
    let b = w.blocks(&id);
    assert_eq!(b.len(), 3);
    assert!(
        b[0].1.ends_with(&c.words),
        "the first half ends with the words"
    );
    assert_eq!(b[1].0, "fence");
}

#[test]
fn a_list_item_is_not_split() {
    let Some(mut w) = work() else { return };
    let quote = words(&w.bible, "JHN", 3, 16, 0, 14);
    let text =
        format!("Notes\n\n- we talked about {quote} and then some more words here\n\nLast line.");
    let p = w.page_from(&text);
    let r = anchor::run(&w.bible, &w.store, &p, &anchor::Options::default()).unwrap();
    let c = r
        .candidates
        .iter()
        .find(|c| c.reference == "John 3:16")
        .expect("the verse is found")
        .clone();
    assert_eq!(c.place.split_at, None);
    let before = w.blocks(&p);
    accept::accept(
        &w.bible,
        &mut w.store,
        &p,
        &[c.id],
        false,
        None,
        false,
        &anchor::Options::default(),
    )
    .unwrap();
    let after = w.blocks(&p);
    assert_eq!(after[0], before[0], "the item's text is unchanged");
    assert_eq!(after[1].1, "```scripture\nJohn 3:16\n```");
    assert_eq!(after[2], before[1]);
}

#[test]
fn accept_refuses_a_page_that_has_changed() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump paragraphs");
    let r = w.run("Word dump paragraphs", "all");
    let c = r.candidates[0].clone();
    pages::edit(
        &w.bible,
        &mut w.store,
        &id,
        pages::Edit::Set {
            n: 0,
            count: 1,
            text: "Another start of the first paragraph.",
        },
    )
    .unwrap();
    let before = w.text(&id);
    let e = accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[c.id],
        false,
        Some(&r.summary.page_hash),
        false,
        &anchor::Options::default(),
    )
    .err()
    .unwrap();
    assert!(e.0.contains("The page has changed"), "{}", e.0);
    assert_eq!(w.text(&id), before, "nothing written");
}

#[test]
fn accept_all_named_is_one_operation_and_leaves_the_quotations() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump");
    let before_text = w.text(&id);
    let r = w.run("Word dump", "all");
    let done = accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[],
        true,
        None,
        false,
        &anchor::Options::default(),
    )
    .unwrap();
    assert_eq!(done.json["added"].as_array().unwrap().len(), 65);
    let fences = w.blocks(&id).iter().filter(|b| b.0 == "fence").count();
    assert_eq!(fences, 65, "the quotations are not touched");
    let again = w.run("Word dump", "all");
    assert_eq!(again.summary.in_page, 65);
    assert_eq!(again.summary.new, r.summary.new - 65);
    accept::undo(&w.bible, &mut w.store, &done.token).unwrap();
    assert_eq!(w.text(&id), before_text, "one Undo restores the page");
    // a token for a page that has changed since does not overwrite it
    let done = accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[],
        true,
        None,
        false,
        &anchor::Options::default(),
    )
    .unwrap();
    pages::edit(
        &w.bible,
        &mut w.store,
        &id,
        pages::Edit::Add {
            after: Some(0),
            text: "A new line.",
        },
    )
    .unwrap();
    assert!(accept::undo(&w.bible, &mut w.store, &done.token).is_err());
}

#[test]
fn accepting_one_of_several_verses_names_the_others() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump");
    let r = w.run("Word dump", "quoted");
    let c = r
        .candidates
        .iter()
        .find(|c| !c.also.is_empty())
        .unwrap()
        .clone();
    let done = accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &[c.id.clone()],
        false,
        None,
        false,
        &anchor::Options::default(),
    )
    .unwrap();
    let mut also = done.also.clone();
    also.sort();
    let mut want = c.also.clone();
    want.sort();
    assert_eq!(also, want);
}

#[test]
fn the_verses_in_order_are_the_pages_scripture_blocks() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump paragraphs");
    let r = w.run("Word dump paragraphs", "named");
    let ids: Vec<String> = r
        .candidates
        .iter()
        .filter(|c| c.also.is_empty())
        .take(37)
        .map(|c| c.id.clone())
        .collect();
    assert_eq!(ids.len(), 37);
    accept::accept(
        &w.bible,
        &mut w.store,
        &id,
        &ids,
        false,
        None,
        false,
        &anchor::Options::default(),
    )
    .unwrap();
    let v = accept::verses(&w.bible, &w.store, &id).unwrap();
    assert_eq!(v.len(), 37);
    let order: Vec<u64> = v.iter().map(|x| x["n"].as_u64().unwrap()).collect();
    let mut sorted = order.clone();
    sorted.sort();
    assert_eq!(order, sorted, "in page order");
    for x in &v {
        let want: Vec<String> = w
            .bible
            .passage(x["reference"].as_str().unwrap())
            .unwrap()
            .verses
            .into_iter()
            .map(|p| p.2)
            .collect();
        assert_eq!(
            x["text"].as_str().unwrap(),
            want.join(" "),
            "verbatim from the database"
        );
        assert!(!x["follows"].as_str().unwrap().is_empty());
    }
    // the deck takes the same blocks, in the same order
    let scripture = pages::scripture(&w.bible, &w.store, &id).unwrap();
    let refs: Vec<&str> = scripture["blocks"]
        .as_array()
        .map(|a| a.iter().map(|b| b["reference"].as_str().unwrap()).collect())
        .unwrap_or_default();
    let ours: Vec<&str> = v.iter().map(|x| x["reference"].as_str().unwrap()).collect();
    assert_eq!(refs, ours);
}

#[test]
fn a_run_writes_nothing_and_reads_one_page() {
    let Some(w) = work() else { return };
    let dir = w._scratch.path().join("study");
    let digest = || {
        let mut all: Vec<(PathBuf, Vec<u8>)> = vec![];
        fn walk(p: &Path, out: &mut Vec<(PathBuf, Vec<u8>)>) {
            for e in std::fs::read_dir(p).unwrap().flatten() {
                if e.path().is_dir() {
                    walk(&e.path(), out);
                } else {
                    out.push((e.path(), std::fs::read(e.path()).unwrap()));
                }
            }
        }
        walk(&dir, &mut all);
        all.sort();
        all
    };
    let before = digest();
    let start = std::time::Instant::now();
    let r = w.run("Word dump", "all");
    let took = start.elapsed();
    assert!(!r.candidates.is_empty());
    assert_eq!(before, digest(), "the study folder is untouched");
    assert!(took.as_secs() < 15, "a run took {took:?}");
}

#[test]
fn nothing_in_tether_opens_a_connection() {
    for src in [
        include_str!("../src/tether/anchor.rs"),
        include_str!("../src/tether/quote.rs"),
        include_str!("../src/tether/spoken.rs"),
        include_str!("../src/tether/accept.rs"),
    ] {
        for net in [
            "TcpStream",
            "reqwest",
            "http://",
            "https://",
            "std::net",
            "ureq",
        ] {
            assert!(!src.contains(net), "{net}");
        }
    }
}

#[test]
fn a_page_changed_between_the_read_and_the_write_is_refused() {
    let Some(mut w) = work() else { return };
    let id = w.page("Word dump paragraphs");
    let r = w.run("Word dump paragraphs", "named");
    let stale = anchor::read(&w.store, &id).unwrap();
    pages::edit(
        &w.bible,
        &mut w.store,
        &id,
        pages::Edit::Add {
            after: Some(0),
            text: "A line added after the page was read.",
        },
    )
    .unwrap();
    let changed = w.text(&id);
    let e = accept::accept_read(
        &w.bible,
        &mut w.store,
        stale,
        &[r.candidates[0].id.clone()],
        false,
        None,
        false,
        &anchor::Options::default(),
    )
    .err()
    .unwrap();
    assert!(e.0.contains("changed since it was read"), "{}", e.0);
    assert_eq!(w.text(&id), changed, "nothing written");
}
