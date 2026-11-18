//! design/features/marks, MK-17: the margin's chapter files are the person's to edit by hand. A rewrite keeps what it does
//! not own (text above the first note), a deleted heading cuts no body line, and a write by another process is seen at once.

mod common;

use common::{bible, Scratch};
use wb_core::margin;
use wb_core::store::Store;

/// These tests are about the files and the locks, and are not skipped without the Bible database: they stop with a message. The
/// locks are kept in a folder of this test run's own, never the app's.
fn need_bible() -> wb_core::bible::Bible {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| std::env::set_var("WB_APP_DIR", std::env::temp_dir().join("bible-workbench-rs").join(format!("margin-locks-{}", std::process::id()))));
    bible().expect("these tests need the Bible database: set WB_BIBLE_DB")
}

fn chapter_file(t: &Scratch, code: &str, chapter: u32) -> std::path::PathBuf {
    t.path().join("margin").join(code).join(format!("{chapter}.md"))
}

#[test]
fn a_hand_edited_margin_file_loses_no_text_when_a_note_is_edited() {
    let b = need_bible();
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
    let b = need_bible();
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
    let b = need_bible();
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
    let b = need_bible();
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
    let b = need_bible();
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
    assert_eq!(std::fs::metadata(&p).unwrap().len() as usize, text.len(), "the same size");
    assert_eq!(std::fs::metadata(&p).unwrap().modified().unwrap(), before, "the same time");
    // the next edit, of the other note, starts from the file as it is: the hand edit stays
    margin::edit(&b, &mut st, &c, "yyyy").unwrap();
    let after = std::fs::read_to_string(&p).unwrap();
    assert!(after.contains("zzzz") && after.contains("yyyy") && !after.contains("aaaa"), "{after}");
}

#[test]
fn a_deleted_note_goes_to_the_trash_as_the_file_holds_it_now() {
    let b = need_bible();
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "aaaa", false, "").unwrap()["id"].as_str().unwrap().to_string();
    margin::all(&b, &st);
    let p = chapter_file(&t, "NUM", 25);
    let before = std::fs::metadata(&p).unwrap().modified().unwrap();
    let text = std::fs::read_to_string(&p).unwrap();
    std::fs::write(&p, text.replace("aaaa", "zzzz")).unwrap();
    std::fs::OpenOptions::new().write(true).open(&p).unwrap().set_modified(before).unwrap();
    margin::rm(&b, &mut st, &a).unwrap();
    let trash: Vec<String> = std::fs::read_dir(t.path().join(".trash")).unwrap().flatten().map(|e| std::fs::read_to_string(e.path()).unwrap()).collect();
    assert_eq!(trash.len(), 1);
    assert!(trash[0].contains("zzzz") && !trash[0].contains("aaaa"), "{}", trash[0]);
}

#[test]
fn two_writers_editing_different_notes_of_one_chapter_lose_neither() {
    let b = need_bible();
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let ids: Vec<String> = (0..4).map(|k| margin::add(&b, &mut st, &format!("Num 25:{}", 11 + k), &format!("start {k}"), false, "").unwrap()["id"].as_str().unwrap().to_string()).collect();
    let root = t.path().to_path_buf();
    let go = std::sync::Arc::new(std::sync::Barrier::new(ids.len()));
    let handles: Vec<_> = ids
        .iter()
        .enumerate()
        .map(|(k, id)| {
            let (root, id, go) = (root.clone(), id.clone(), go.clone());
            std::thread::spawn(move || {
                let b = need_bible();
                let mut st = Store::open(&root).unwrap();
                go.wait();
                for i in 0..40 {
                    // every edit must be taken: the writers wait for one another, and none is refused or lost
                    margin::edit(&b, &mut st, &id, &format!("writer {k} edit {i}")).unwrap_or_else(|e| panic!("writer {k} edit {i} refused: {e}"));
                }
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
    let file = std::fs::read_to_string(chapter_file(&t, "NUM", 25)).unwrap();
    for k in 0..4 {
        assert!(file.contains(&format!("writer {k} edit 39")), "writer {k}'s last edit is in the file:
{file}");
    }
}
#[test]
fn a_file_that_cannot_be_read_is_never_written_over() {
    let b = need_bible();
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "kept", false, "").unwrap()["id"].as_str().unwrap().to_string();
    let p = chapter_file(&t, "NUM", 25);
    // saved by hand in Windows-1252: a byte that is not UTF-8
    let mut bytes = std::fs::read(&p).unwrap();
    bytes.extend_from_slice(b"\nA note by hand with an \xE9 in it.\n");
    std::fs::write(&p, &bytes).unwrap();
    assert!(margin::edit(&b, &mut st, &a, "changed").is_err(), "refused");
    assert!(margin::add(&b, &mut st, "Num 25:12", "another", false, "").is_err());
    assert!(margin::rm(&b, &mut st, &a).is_err());
    assert_eq!(std::fs::read(&p).unwrap(), bytes, "the file is byte for byte as it was");
    assert!(!t.path().join(".trash").exists() || std::fs::read_dir(t.path().join(".trash")).unwrap().count() == 0, "no trash copy of a delete that did not happen");
}

#[cfg(windows)]
#[test]
fn a_file_held_open_by_another_program_is_never_written_over() {
    use std::os::windows::fs::OpenOptionsExt;
    let b = need_bible();
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "kept", false, "").unwrap()["id"].as_str().unwrap().to_string();
    let p = chapter_file(&t, "NUM", 25);
    let before = std::fs::read(&p).unwrap();
    let held = std::fs::OpenOptions::new().read(true).share_mode(0).open(&p).unwrap();
    let e = margin::edit(&b, &mut st, &a, "changed");
    drop(held);
    assert!(e.is_err(), "refused while another program holds the file");
    assert_eq!(std::fs::read(&p).unwrap(), before);
    margin::edit(&b, &mut st, &a, "changed").unwrap();
}

#[test]
fn an_edit_waits_for_the_lock_then_refuses_with_a_clear_message() {
    let b = need_bible();
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "kept", false, "").unwrap()["id"].as_str().unwrap().to_string();
    let lock = margin::lock_path(t.path(), "NUM", 25);
    assert!(lock.starts_with(wb_core::setup::app_dir()) && !lock.starts_with(t.path()), "the lock is in the app's folder, not the study");
    let held = std::fs::OpenOptions::new().create(true).truncate(false).write(true).open(&lock).unwrap();
    held.lock().unwrap();
    let started = std::time::Instant::now();
    let e = margin::edit(&b, &mut st, &a, "changed").unwrap_err().to_string();
    assert!(e.contains("Another writer is changing this margin file"), "{e}");
    assert!(started.elapsed() >= std::time::Duration::from_secs(2), "it waited first");
    assert!(std::fs::read_to_string(chapter_file(&t, "NUM", 25)).unwrap().contains("kept"));
    held.unlock().unwrap();
    drop(held);
    margin::edit(&b, &mut st, &a, "changed").unwrap();
}

#[test]
fn a_lock_file_left_by_a_dead_writer_locks_nothing() {
    let b = need_bible();
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    let a = margin::add(&b, &mut st, "Num 25:11", "kept", false, "").unwrap()["id"].as_str().unwrap().to_string();
    // the leftover: a file with an owner's name and an old time, and nobody holding it
    let lock = margin::lock_path(t.path(), "NUM", 25);
    std::fs::create_dir_all(lock.parent().unwrap()).unwrap();
    std::fs::write(&lock, "pid 999999 1970-01-01").unwrap();
    margin::edit(&b, &mut st, &a, "first").unwrap();
    margin::edit(&b, &mut st, &a, "second").unwrap();
    assert!(std::fs::read_to_string(chapter_file(&t, "NUM", 25)).unwrap().contains("second"));
}
