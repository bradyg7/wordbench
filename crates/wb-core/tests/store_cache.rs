//! The Python app's tests/test_study_cache.py, carried over: the store reads again only what changed, a write takes
//! itself in, and files changed from outside are noticed.

#[expect(
    dead_code,
    reason = "shared test helpers: each test binary uses only some of them"
)]
mod common;

use common::Scratch;
use std::fs;
use std::time::Duration;
use wb_core::store::{s, Store};

fn many_notes(st: &mut Store, n: usize) {
    for i in 0..n {
        st.add_note(
            &format!("PSA.{}:{}", 1 + i % 150, 1 + i % 20),
            &format!("note {i}"),
            "",
            "",
        )
        .unwrap();
    }
}

fn note_file(t: &Scratch, id: &str) -> std::path::PathBuf {
    for e in fs::read_dir(t.path().join("notes")).unwrap().flatten() {
        let p = e.path().join(format!("{id}.md"));
        if p.exists() {
            return p;
        }
    }
    panic!("no file for {id}");
}

/// Files written within one clock tick can keep the same time; a short pause makes a hand edit visible by its time.
fn tick() {
    std::thread::sleep(Duration::from_millis(20));
}

#[test]
fn a_write_reads_one_file_not_all_of_them() {
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    many_notes(&mut st, 40);
    st.loads = 0;
    st.add_note("JHN.3:16", "one more", "", "").unwrap();
    assert_eq!(st.loads, 1);
    assert_eq!(st.notes().len(), 41);
    assert_eq!(st.loads, 1); // reading them back reads nothing either
}

#[test]
fn every_kind_of_write_goes_straight_into_memory() {
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let th = s(
        &st.create_thread("Zeal", "why", Some("blue")).unwrap(),
        "id",
    );
    st.add_to_thread(&th, "NUM.25:11", "q").unwrap();
    let n = s(
        &st.add_note("NUM.25:11", "he was jealous", "", "").unwrap(),
        "id",
    );
    st.set_highlight("NUM.25:11", Some("yellow"), "").unwrap();
    let q = s(
        &st.add_trail("NUM.25:11", "what about Rom 10:2?", "")
            .unwrap(),
        "id",
    );
    st.loads = 0;
    assert_eq!(
        st.threads()
            .iter()
            .map(|x| s(x, "name"))
            .collect::<Vec<_>>(),
        vec!["Zeal"]
    );
    assert_eq!(st.thread(&th).unwrap()["members"][0]["anchor"], "NUM.25:11");
    assert_eq!(
        st.notes().iter().map(|x| s(x, "text")).collect::<Vec<_>>(),
        vec!["he was jealous"]
    );
    assert_eq!(
        st.highlights("NUM")
            .iter()
            .map(|h| s(h, "color"))
            .collect::<Vec<_>>(),
        vec!["yellow"]
    );
    assert_eq!(
        st.trails()
            .iter()
            .map(|x| s(x, "status"))
            .collect::<Vec<_>>(),
        vec!["open"]
    );
    st.update_note(&n, "changed").unwrap();
    st.set_trail_status(&q, "done").unwrap();
    st.update_thread(&th, None, Some("new note"), Some(Some("pink")))
        .unwrap();
    assert_eq!(s(st.notes()[0], "text"), "changed");
    assert_eq!(s(st.trails()[0], "status"), "done");
    assert_eq!(
        (s(st.threads()[0], "note"), s(st.threads()[0], "color")),
        ("new note".into(), "pink".into())
    );
    assert_eq!(st.loads, 3); // the three files just written, and nothing else
    st.delete_note(&n).unwrap();
    st.delete_trail(&q).unwrap();
    st.delete_thread(&th).unwrap();
    st.set_highlight("NUM.25:11", None, "").unwrap();
    assert!(
        st.notes().is_empty()
            && st.trails().is_empty()
            && st.threads().is_empty()
            && st.all_highlights().is_empty()
    );
    assert!(fs::read_dir(t.path().join(".trash")).unwrap().count() > 0); // nothing is erased
}

#[test]
fn the_folder_is_looked_at_no_more_often_than_asked() {
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    many_notes(&mut st, 5);
    st.recheck = Duration::from_secs(60);
    st.refresh().unwrap();
    st.scans = 0;
    for _ in 0..50 {
        st.refresh().unwrap();
    }
    assert_eq!(st.scans, 0);
    st.recheck = Duration::ZERO;
    st.refresh().unwrap();
    st.refresh().unwrap();
    assert_eq!(st.scans, 2); // recheck 0: every call, as a test that edits files by hand wants
}

#[test]
fn a_hand_edit_a_new_file_and_a_removed_file_are_noticed() {
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = s(&st.add_note("JHN.3:16", "Original.", "", "").unwrap(), "id");
    let b = s(&st.add_note("JHN.3:17", "Second.", "", "").unwrap(), "id");
    let path = note_file(&t, &a);
    tick();
    fs::write(
        &path,
        fs::read_to_string(&path)
            .unwrap()
            .replace("Original.", "Edited by hand."),
    )
    .unwrap();
    st.refresh().unwrap();
    let mut texts: Vec<String> = st.notes().iter().map(|n| s(n, "text")).collect();
    texts.sort();
    assert_eq!(texts, vec!["Edited by hand.", "Second."]);
    fs::remove_file(note_file(&t, &b)).unwrap();
    st.refresh().unwrap();
    assert_eq!(
        st.notes().iter().map(|n| s(n, "text")).collect::<Vec<_>>(),
        vec!["Edited by hand."]
    );
    fs::create_dir_all(t.path().join("threads")).unwrap();
    fs::write(
        t.path().join("threads").join("by-hand.md"),
        "---\nname: \"By hand\"\n---\n\nnote\n\n<!-- anchors -->\n- JHN.3:16 | \"q\"\n",
    )
    .unwrap();
    st.refresh().unwrap();
    assert_eq!(
        st.threads()
            .iter()
            .map(|x| s(x, "name"))
            .collect::<Vec<_>>(),
        vec!["By hand"]
    );
    fs::create_dir_all(t.path().join("highlights")).unwrap();
    fs::write(t.path().join("highlights").join("JHN.json"), r#"{"highlights": [{"id": "h1", "anchor": "JHN.3:16", "color": "green", "quote": "", "created": "2026-01-01T00:00:00Z"}]}"#).unwrap();
    st.refresh().unwrap();
    assert_eq!(
        st.highlights("JHN")
            .iter()
            .map(|h| s(h, "color"))
            .collect::<Vec<_>>(),
        vec!["green"]
    );
    tick();
    fs::write(t.path().join("highlights").join("JHN.json"), "not json").unwrap();
    st.refresh().unwrap();
    assert!(st.highlights("JHN").is_empty()); // a ruined file reads as nothing, and does not break the rest
    assert_eq!(st.notes().len(), 1);
}

#[test]
fn a_store_that_looks_every_minute_sees_a_hand_edit_when_the_time_comes() {
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    st.recheck = Duration::from_secs(60);
    let a = s(&st.add_note("JHN.3:16", "Original.", "", "").unwrap(), "id");
    let path = note_file(&t, &a);
    st.refresh().unwrap();
    tick();
    fs::write(
        &path,
        fs::read_to_string(&path)
            .unwrap()
            .replace("Original.", "Edited."),
    )
    .unwrap();
    st.refresh().unwrap();
    assert_eq!(s(st.notes()[0], "text"), "Original."); // not looked at yet
    st.look_again(); // the time to look comes round
    st.refresh().unwrap();
    assert_eq!(s(st.notes()[0], "text"), "Edited.");
}

#[test]
fn a_file_the_store_wrote_is_not_read_again_by_the_next_look() {
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    many_notes(&mut st, 10);
    st.loads = 0;
    for _ in 0..5 {
        st.refresh().unwrap();
    }
    assert_eq!(st.loads, 0);
}

#[test]
fn a_note_that_moves_to_another_book_stays_in_memory() {
    // the window keeps one store open: a note whose file moves (Move…, Take off its first place) is still there after
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let n = s(&st.add_note("NUM.25:11", "his zeal", "", "").unwrap(), "id");
    st.set_note_also(&n, "PSA.106:30", true).unwrap();
    st.unplace(&n, "NUM.25:11", Some(("PSA.106:30", "verse", "", "")))
        .unwrap();
    assert_eq!(
        st.notes()
            .iter()
            .map(|x| (s(x, "id"), s(x, "anchor")))
            .collect::<Vec<_>>(),
        vec![(n.clone(), "PSA.106:30".to_string())]
    );
    st.replace_placed(&n, "JHN.3:16", "verse", "", "", None)
        .unwrap();
    assert_eq!(
        st.notes()
            .iter()
            .map(|x| (s(x, "id"), s(x, "anchor")))
            .collect::<Vec<_>>(),
        vec![(n.clone(), "JHN.3:16".to_string())]
    );
    st.unplace(&n, "JHN.3:16", None).unwrap();
    assert!(st.notes().is_empty());
    assert_eq!(
        st.inbox().iter().map(|x| s(x, "id")).collect::<Vec<_>>(),
        vec![n]
    );
}

#[test]
fn opening_a_chapters_marks_reads_no_page_file() {
    // marks round 7, row 42: the reader's marks come from memory and the book's one small marks file, never a page
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    many_notes(&mut st, 60);
    st.set_highlight("PSA.1:2", Some("yellow"), "").unwrap();
    st.loads = 0;
    let m = wb_core::marks::chapter_marks(&st, "PSA", 1).unwrap();
    assert_eq!(m.marks.len(), 1, "the old highlight, once");
    assert_eq!(st.loads, 0, "no page file read");
}
