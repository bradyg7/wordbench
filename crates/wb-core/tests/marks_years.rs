//! design/features/marks, "Years of study": a generated study of 2,400 pages, 3,100 margin notes and 18,000 highlights.
//! The window's budgets are measured in the real app (`npm run measure`, a desk line); here the shapes are checked:
//! John 3:16 shows its 41 notes newest first and its 312 pages grouped by folder in MK-13's order, never more than 20 rows
//! before "Show all", and the map counts every chapter.

mod common;

use common::{bible, Scratch};
use serde_json::json;
use std::time::Instant;
use wb_core::store::{s, Store};
use wb_core::{library, margin, pageindex};

#[test]
fn years_of_study_keep_their_shape() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();

    // 140 folders and 2,400 pages; 312 of them name John 3:16 (a few in a scripture block, some twice)
    let folders: Vec<String> = (0..140).map(|k| s(&st.create_set(&format!("Folder {k}"), &[]).unwrap(), "id")).collect();
    let mut held: Vec<Vec<serde_json::Value>> = vec![vec![]; 140];
    for i in 0..2400 {
        let text = if i < 312 {
            let twice = if i % 7 == 0 { " and John 3:16 again" } else { "" };
            let block = if i % 50 == 0 { "\n\n```scripture\nJohn 3:16\n```" } else { "" };
            format!("Lesson {i}\n\nOn John 3:16{twice}.{block}")
        } else {
            format!("Lesson {i}\n\nOn Psalm {}:{}.", 1 + i % 150, 1 + i % 2)
        };
        let id = s(&st.jot(&text, false).unwrap(), "id");
        held[i % 140].push(json!({"kind": "note", "ref": id}));
    }
    for (k, items) in held.iter().enumerate() {
        st.add_to_set(&folders[k], items).unwrap();
    }

    // 3,100 margin notes: 41 at John 3:16, the rest over the Psalms' verses
    for i in 0..41 {
        margin::add(&b, &mut st, "John 3:16", &format!("Thought {i}"), false, "").unwrap();
    }
    for i in 0..3059 {
        margin::add(&b, &mut st, &format!("Psalm {}:{}", 1 + i % 150, 1 + i % 2), &format!("Note {i}"), false, "").unwrap();
    }

    // 18,000 highlights, in one write per book
    let mut per: std::collections::BTreeMap<String, Vec<wb_core::store::Rec>> = Default::default();
    for i in 0..18000 {
        // every verse of John 3 is marked once; the rest are spread over the Psalms
        let (code, c, v) = if i % 500 == 0 { ("JHN", 3, 1 + (i / 500) % 36) } else { ("PSA", 1 + i % 150, 1 + i % 2) };
        let h = json!({"id": format!("h_{i}"), "anchor": format!("{code}.{c}:{v}"), "color": "yellow", "quote": "", "created": "2026-01-01T00:00:00Z"});
        per.entry(code.into()).or_default().push(h.as_object().unwrap().clone());
    }
    for (code, items) in per {
        st.edit_highlights(&code, &[], items).unwrap();
    }

    // (page ids are a second plus 16 random bits, so two of 2,400 made at speed can share one; the test counts what was kept)
    let kept = st.inbox().len();
    let john = st.inbox().iter().filter(|r| s(r, "text").contains("John 3:16")).count();

    // John 3 opens with one line of counts per verse that has something
    let t0 = Instant::now();
    let ch = margin::chapter(&b, &st, "JHN", 3).unwrap();
    let opened = t0.elapsed();
    eprintln!("John 3 margin: {opened:?} (cold index included)");
    let v16 = ch["verses"].as_array().unwrap().iter().find(|v| v["v"] == 16).unwrap();
    assert_eq!(v16["notes"], 41);
    assert_eq!(v16["pages"].as_u64(), Some(john as u64));
    let t1 = Instant::now();
    margin::chapter(&b, &st, "JHN", 3).unwrap();
    eprintln!("John 3 margin again: {:?}", t1.elapsed());

    // John 3:16: 41 notes newest first, 312 pages, never more than 20 rows before Show all, grouped by folder
    let v = margin::verse(&b, &st, "John 3:16", false).unwrap();
    assert_eq!(v["notes"].as_array().unwrap().len(), 41);
    let written: Vec<&str> = v["notes"].as_array().unwrap().iter().map(|n| n["written"].as_str().unwrap()).collect();
    assert!(written.windows(2).all(|w| w[0] >= w[1]), "newest first");
    assert_eq!(v["pages_total"].as_u64(), Some(john as u64));
    assert_eq!(v["pages"].as_array().unwrap().len(), 20);
    assert!(v["groups"].as_array().unwrap().len() > 1, "grouped by folder");
    assert!(v["groups"].as_array().unwrap().iter().all(|g| g["pages"].as_array().unwrap().len() <= 20));
    // MK-13: a scripture block first, then the most named, then newest
    let first = &v["pages"][0];
    assert_eq!(first["in_scripture_block"], true);
    let all = margin::verse(&b, &st, "John 3:16", true).unwrap();
    assert_eq!(all["pages"].as_array().unwrap().len(), john);
    let blocks: Vec<bool> = all["pages"].as_array().unwrap().iter().map(|p| p["in_scripture_block"].as_bool().unwrap()).collect();
    assert!(blocks.windows(2).all(|w| w[0] >= w[1]), "pages with the verse in a block come first");

    // the map shades every chapter by its count
    let map = margin::list(&b, &st, None, true).unwrap();
    assert_eq!(map["total"], 3100);
    assert_eq!(map["books"].as_array().unwrap().len(), 66);
    let psa = map["books"].as_array().unwrap().iter().find(|b| b["code"] == "PSA").unwrap();
    assert_eq!(psa["chapters"].as_array().unwrap().len(), 150);

    // a search answers, grouped by kind
    let t2 = Instant::now();
    let f = library::find(&b, &st, &library::Find { words: "Lesson", ..Default::default() }).unwrap();
    eprintln!("search: {:?}", t2.elapsed());
    let pages = f["groups"].as_array().unwrap().iter().find(|g| g["kind"] == "page").unwrap()["count"].as_u64().unwrap();
    assert_eq!(pages as usize, kept, "every page answers the search");

    // the index worked each page out once
    assert_eq!(st.index.borrow().computed, kept);
    let _ = pageindex::all(&b, &st);
    assert_eq!(st.index.borrow().computed, kept);

    // `WB_YEARS_KEEP=<folder>` keeps the generated study there, for the desk check (measure/marks.mjs)
    if let Ok(out) = std::env::var("WB_YEARS_KEEP") {
        fn copy(from: &std::path::Path, to: &std::path::Path) {
            std::fs::create_dir_all(to).unwrap();
            for e in std::fs::read_dir(from).unwrap().flatten() {
                let (p, q) = (e.path(), to.join(e.file_name()));
                if p.is_dir() { copy(&p, &q) } else { std::fs::copy(&p, &q).unwrap(); }
            }
        }
        copy(t.path(), std::path::Path::new(&out));
    }
}
