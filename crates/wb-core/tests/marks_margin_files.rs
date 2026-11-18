//! design/features/marks, MK-17: the margin's chapter files are the person's to edit by hand. A rewrite keeps what it does
//! not own (text above the first note), a deleted heading cuts no body line, and a write by another process is seen at once.

mod common;

use common::{bible, Scratch};
use wb_core::margin;
use wb_core::store::Store;

fn chapter_file(t: &Scratch, code: &str, chapter: u32) -> std::path::PathBuf {
    t.path().join("margin").join(code).join(format!("{chapter}.md"))
}

#[test]
fn a_hand_edited_margin_file_loses_no_text_when_a_note_is_edited() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let first = margin::add(&b, &mut st, "Num 25:11", "First line\nLast body line", false, "").unwrap();
    let second = margin::add(&b, &mut st, "Num 25:12", "Second", false, "").unwrap();
    let (a, c) = (first["id"].as_str().unwrap().to_string(), second["id"].as_str().unwrap().to_string());
    let p = chapter_file(&t, "NUM", 25);
    let text = std::fs::read_to_string(&p).unwrap();
    // by hand: prose under the title, and the second note's heading line deleted
    let hand = text.replacen("# Numbers 25\n\n", "# Numbers 25\n\nMy own paragraph about this chapter.\n\nA second paragraph.\n\n", 1).replacen("## Numbers 25:12\n", "", 1);
    assert_ne!(hand, text);
    std::fs::write(&p, &hand).unwrap();
    // both notes still read whole
    let all = margin::all(&b, &st);
    assert_eq!(all.iter().find(|n| n.id == a).unwrap().text, "First line\nLast body line", "a deleted heading cuts no body line");
    // editing either one keeps the prose and the other note's every line
    margin::edit(&b, &mut st, &c, "Second, changed").unwrap();
    margin::edit(&b, &mut st, &a, "First line\nLast body line, changed").unwrap();
    let after = std::fs::read_to_string(&p).unwrap();
    assert!(after.contains("My own paragraph about this chapter.\n\nA second paragraph."), "{after}");
    assert!(after.contains("First line\nLast body line, changed") && after.contains("Second, changed"), "{after}");
    // deleting the last note keeps the file with the prose
    margin::rm(&b, &mut st, &a).unwrap();
    margin::rm(&b, &mut st, &c).unwrap();
    assert!(std::fs::read_to_string(&p).unwrap().contains("My own paragraph about this chapter."));
}

#[test]
fn a_write_by_another_process_is_seen_at_once() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    margin::add(&b, &mut st, "Num 25:11", "Mine", false, "").unwrap();
    assert_eq!(margin::all(&b, &st).len(), 1);
    // another process writes a new chapter file, then changes the first by hand
    let dir = t.path().join("margin").join("NUM");
    std::fs::write(dir.join("26.md"), "---\nbook: \"NUM\"\nchapter: 26\n---\n\n# Numbers 26\n\n## Numbers 26:1\n<!-- margin id=zz1 at=NUM.26:1 written=2026-11-17 -->\nFrom elsewhere\n").unwrap();
    assert_eq!(margin::all(&b, &st).len(), 2, "a new file is seen without waiting");
    let p = chapter_file(&t, "NUM", 25);
    let text = std::fs::read_to_string(&p).unwrap();
    std::fs::write(&p, text.replace("Mine", "Mine, longer")).unwrap();
    assert!(margin::all(&b, &st).iter().any(|n| n.text == "Mine, longer"), "a changed file is seen without waiting");
    std::fs::remove_file(dir.join("26.md")).unwrap();
    assert_eq!(margin::all(&b, &st).len(), 1, "a removed file is seen without waiting");
}

#[test]
fn deleting_or_restoring_a_margin_note_refreshes_the_page_that_shows_it() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let n = margin::add(&b, &mut st, "Num 25:11", "A thought", false, "").unwrap();
    let id = n["id"].as_str().unwrap().to_string();
    let g = margin::grow(&b, &mut st, &id, None, Some("Thoughts")).unwrap();
    let page = g["page"].as_str().unwrap().to_string();
    let names = |st: &Store| wb_core::pageindex::naming(&b, st, "NUM", (25, 11), (25, 11)).into_iter().map(|x| x.0).collect::<Vec<_>>();
    assert_eq!(names(&st), vec![page.clone()], "the page shows the note, so it is named at verse 11");
    margin::rm(&b, &mut st, &id).unwrap();
    assert!(names(&st).is_empty(), "the note is gone: the page no longer names its verse");
    margin::restore(&b, &mut st, &id).unwrap();
    assert_eq!(names(&st), vec![page], "restored: named again");
}

#[test]
fn same_length_edits_back_to_back_lose_nothing() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "aaaa", false, "").unwrap()["id"].as_str().unwrap().to_string();
    let c = margin::add(&b, &mut st, "Num 25:12", "cccc", false, "").unwrap()["id"].as_str().unwrap().to_string();
    // two edits of one chapter in a row, each the same length as before: both stay
    margin::edit(&b, &mut st, &a, "bbbb").unwrap();
    margin::edit(&b, &mut st, &c, "dddd").unwrap();
    margin::edit(&b, &mut st, &a, "eeee").unwrap();
    let all = margin::all(&b, &st);
    assert_eq!(all.iter().find(|n| n.id == a).unwrap().text, "eeee");
    assert_eq!(all.iter().find(|n| n.id == c).unwrap().text, "dddd");
    let text = std::fs::read_to_string(chapter_file(&t, "NUM", 25)).unwrap();
    assert!(text.contains("eeee") && text.contains("dddd") && text.ends_with("\n") && !text.ends_with("\n\n"), "{text}");
}

#[test]
fn an_edit_in_place_with_the_same_size_and_time_is_not_overwritten() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "aaaa", false, "").unwrap()["id"].as_str().unwrap().to_string();
    let c = margin::add(&b, &mut st, "Num 25:12", "cccc", false, "").unwrap()["id"].as_str().unwrap().to_string();
    margin::all(&b, &st);
    // another process changes "aaaa" to "zzzz" in place and puts the file's time back as it was
    let p = chapter_file(&t, "NUM", 25);
    let before = std::fs::metadata(&p).unwrap().modified().unwrap();
    let text = std::fs::read_to_string(&p).unwrap();
    std::fs::write(&p, text.replace("aaaa", "zzzz")).unwrap();
    std::fs::OpenOptions::new().write(true).open(&p).unwrap().set_modified(before).unwrap();
    assert_eq!(std::fs::metadata(&p).unwrap().len() as usize, text.len());
    // the next edit, of the other note, starts from the file as it is: the hand edit stays
    margin::edit(&b, &mut st, &c, "yyyy").unwrap();
    let after = std::fs::read_to_string(&p).unwrap();
    assert!(after.contains("zzzz") && after.contains("yyyy") && !after.contains("aaaa"), "{after}");
    // and a plain same-size change a moment later is seen by the listing too
    std::thread::sleep(std::time::Duration::from_millis(30));
    std::fs::write(&p, after.replace("zzzz", "xxxx")).unwrap();
    assert_eq!(margin::all(&b, &st).iter().find(|n| n.id == a).unwrap().text, "xxxx");
}
