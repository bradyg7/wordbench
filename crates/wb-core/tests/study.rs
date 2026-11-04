//! The Python app's tests/test_study.py, carried over: anchors, the plain-file store, the study requests. (Its server
//! write-guard tests have no counterpart: the Rust app has no HTTP server; the window calls wb-core in-process.)

mod common;

use common::{bible, index_of, words, Scratch};
use serde_json::{json, Value};
use std::fs;
use wb_core::anchors::{canonical, py_parse, resolve};
use wb_core::store::{check_color, dump_md, parse_md, s, Store};
use wb_core::studyapi as sa;

fn store(t: &Scratch) -> Store {
    Store::open(t.path()).unwrap()
}

fn color_of(h: &serde_json::Map<String, Value>) -> String {
    s(h, "color")
}

// ---- AnchorParsing ------------------------------------------------------------------------------------------------

#[test]
fn anchor_forms() {
    for (a, k) in [("NUM.25:11", "verse"), ("NUM.25:11.12", "word"), ("NUM.25:11.3-25:12.5", "phrase"), ("NUM.25:7-25:13", "verses"), ("H7065", "lemma")] {
        assert_eq!(py_parse(a).unwrap()["kind"], k, "{a}");
    }
}

#[test]
fn one_word_phrase_and_one_verse_run_collapse() {
    assert_eq!(canonical("NUM.25:11.3-25:11.3").unwrap(), "NUM.25:11.3");
    assert_eq!(canonical("NUM.25:11-25:11").unwrap(), "NUM.25:11");
}

#[test]
fn bad_anchors() {
    for bad in ["", "num.25:11", "NUM.25", "NUM.25:11.3-25:11.1", "NUM.25:11.3-25:12", "NUM.25:12-25:11", "H", "G99999"] {
        assert!(py_parse(bad).is_err(), "{bad:?}");
    }
}

#[test]
fn anchor_round_trip() {
    for a in ["NUM.25:11", "NUM.25:11.12", "NUM.25:11.3-25:12.5", "NUM.25:7-26:2", "G25"] {
        assert_eq!(canonical(a).unwrap(), a);
    }
}

// ---- MarkdownFormat -----------------------------------------------------------------------------------------------

#[test]
fn header_round_trip_with_colons_quotes_and_unicode() {
    let meta = json!({"id": "n_1", "quote": "he said: \"zeal\" — קנא", "n": 3}).as_object().unwrap().clone();
    let text = dump_md(&meta, "Body line 1\n\nBody line 2: keep");
    let (m2, body) = parse_md(&text);
    assert_eq!(m2, meta);
    assert_eq!(body.trim(), "Body line 1\n\nBody line 2: keep");
}

// ---- StoreTests ---------------------------------------------------------------------------------------------------

#[test]
fn missing_folder_is_reported() {
    let t = Scratch::new();
    assert!(Store::open(&t.path().join("nope")).is_err());
}

#[test]
fn note_crud_writes_plain_files_and_trashes_on_delete() {
    let t = Scratch::new();
    let mut st = store(&t);
    let n = st.add_note("NUM.25:11.12", "He turned wrath away.", "zealous", "H7065").unwrap();
    let path = t.path().join("notes").join("NUM").join(format!("{}.md", s(&n, "id")));
    let raw = fs::read_to_string(&path).unwrap();
    assert!(raw.contains("anchor: \"NUM.25:11.12\""));
    assert!(raw.contains("He turned wrath away."));
    let u = st.update_note(&s(&n, "id"), "Edited.").unwrap();
    assert_eq!(s(&u, "text"), "Edited.");
    assert_eq!(s(st.notes()[0], "text"), "Edited.");
    st.delete_note(&s(&n, "id")).unwrap();
    assert!(!path.exists());
    assert!(st.notes().is_empty());
    assert_eq!(fs::read_dir(t.path().join(".trash")).unwrap().count(), 1); // kept, not erased
    assert_eq!(st.delete_note(&s(&n, "id")).unwrap_err().0, "No such note.");
}

#[test]
fn empty_note_refused_and_lemma_notes_live_apart() {
    let t = Scratch::new();
    let mut st = store(&t);
    assert!(st.add_note("NUM.25:11", "   ", "", "").is_err());
    let n = st.add_note("H7065", "qanah: to be jealous for.", "", "").unwrap();
    assert!(t.path().join("notes").join("_words").join(format!("{}.md", s(&n, "id"))).exists());
}

#[test]
fn hand_edits_are_picked_up() {
    let t = Scratch::new();
    let mut st = store(&t);
    let n = st.add_note("NUM.25:11", "Original.", "", "").unwrap();
    let path = t.path().join("notes").join("NUM").join(format!("{}.md", s(&n, "id")));
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(&path, fs::read_to_string(&path).unwrap().replace("Original.", "Changed by hand.")).unwrap();
    st.refresh().unwrap();
    assert_eq!(s(st.notes()[0], "text"), "Changed by hand.");
}

#[test]
fn highlights_replace_per_anchor_and_clear() {
    let t = Scratch::new();
    let mut st = store(&t);
    st.set_highlight("NUM.25:11.12", Some("yellow"), "zealous").unwrap();
    st.set_highlight("NUM.25:11.12", Some("pink"), "zealous").unwrap();
    st.set_highlight("NUM.25:7", Some("green"), "").unwrap();
    let mut hl: Vec<(String, String)> = st.highlights("NUM").iter().map(|h| (s(h, "anchor"), color_of(h))).collect();
    hl.sort();
    assert_eq!(hl, vec![("NUM.25:11.12".into(), "pink".into()), ("NUM.25:7".into(), "green".into())]);
    st.set_highlight("NUM.25:11.12", None, "").unwrap();
    st.set_highlight("NUM.25:7", None, "").unwrap();
    assert!(st.all_highlights().is_empty());
    assert!(!t.path().join("highlights").join("NUM.json").exists());
    assert!(st.set_highlight("NUM.25:7", Some("purple"), "").is_err());
    assert!(st.set_highlight("H7065", Some("yellow"), "").is_err());
}

#[test]
fn colors_are_a_name_or_a_hex_and_hex_is_stored_in_lower_case() {
    assert_eq!(check_color(Some("yellow")).unwrap().as_deref(), Some("yellow"));
    assert_eq!(check_color(Some("#E07B39")).unwrap().as_deref(), Some("#e07b39"));
    assert_eq!(check_color(None).unwrap(), None);
    for bad in ["purple", "#fff", "#12345", "#12345g", "e07b39", "", "rgb(1,2,3)"] {
        assert!(check_color(Some(bad)).is_err(), "{bad}");
    }
    let t = Scratch::new();
    let mut st = store(&t);
    st.set_highlight("NUM.25:7", Some("#ABCDEF"), "").unwrap();
    assert_eq!(color_of(&st.highlights("NUM")[0]), "#abcdef");
}

#[test]
fn palette_keeps_the_newest_first_without_repeats_and_at_most_eight() {
    let t = Scratch::new();
    let st = store(&t);
    assert!(st.palette().is_empty());
    for c in ["#000001", "#000002", "#000003"] {
        st.use_palette_color(c).unwrap();
    }
    assert_eq!(st.use_palette_color("#000001").unwrap(), vec!["#000001", "#000003", "#000002"]);
    for i in 10..20 {
        st.use_palette_color(&format!("#0000{i:02}")).unwrap();
    }
    assert_eq!(st.palette().len(), 8);
    assert_eq!(st.palette()[0], "#000019");
    assert!(!st.palette().contains(&"#000002".to_string()));
    assert_eq!(st.drop_palette_color(Some("#000019")).unwrap()[0], "#000018");
    assert_eq!(store(&t).palette()[0], "#000018"); // in a file, not in memory
    assert!(t.path().join("settings").join("palette.json").exists());
    assert!(st.use_palette_color("red").is_err());
}

#[test]
fn a_damaged_palette_file_reads_as_empty_and_bad_entries_are_ignored() {
    let t = Scratch::new();
    let st = store(&t);
    let path = t.path().join("settings").join("palette.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, "not json").unwrap();
    assert!(st.palette().is_empty());
    fs::write(&path, r##"{"colors": ["#ABCDEF", "nope", 5, "#12345"]}"##).unwrap();
    assert_eq!(st.palette(), vec!["#abcdef"]);
    fs::write(&path, "[1, 2]").unwrap();
    assert!(st.palette().is_empty());
}

#[test]
fn a_thread_can_have_a_color_that_survives_a_restart_and_renaming() {
    let t = Scratch::new();
    let mut st = store(&t);
    let file = || fs::read_to_string(t.path().join("threads").join("zeal.md")).unwrap();
    assert_eq!(s(&st.create_thread("Zeal", "", None).unwrap(), "color"), "");
    assert!(!file().contains("color:"));
    st.update_thread("zeal", None, None, Some(Some("blue"))).unwrap();
    st.update_thread("zeal", Some("Zeal for God"), Some("Why."), None).unwrap(); // color left alone
    assert_eq!(s(&store(&t).thread("zeal").unwrap(), "color"), "blue");
    assert!(file().contains("color: \"blue\""));
    st.update_thread("zeal", None, None, Some(Some("#ABCDEF"))).unwrap();
    assert_eq!(s(&store(&t).thread("zeal").unwrap(), "color"), "#abcdef");
    assert_eq!(st.palette(), vec!["#abcdef"]);
    st.update_thread("zeal", None, None, Some(None)).unwrap();
    assert_eq!(s(&store(&t).thread("zeal").unwrap(), "color"), "");
    assert!(!file().contains("color:"));
    for bad in ["purple", "#fff"] {
        assert!(st.update_thread("zeal", None, None, Some(Some(bad))).is_err(), "{bad}");
    }
    assert_eq!(s(&st.create_thread("Covenant", "", Some("#336699")).unwrap(), "color"), "#336699");
    assert!(st.create_thread("Bad color", "", Some("nope")).is_err());
}

#[test]
fn threads_written_before_colors_existed_load_and_a_ruined_color_reads_as_none() {
    let t = Scratch::new();
    let dir = t.path().join("threads");
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("old.md"), "---\nname: \"Old\"\ncreated: \"x\"\nupdated: \"x\"\n---\n\nA note.\n\n<!-- anchors -->\n- NUM.25:11 | \"\"\n").unwrap();
    fs::write(dir.join("ruined.md"), "---\nname: \"Ruined\"\ncolor: \"chartreuse\"\ncreated: \"x\"\nupdated: \"x\"\n---\n\n<!-- anchors -->\n").unwrap();
    let mut st = store(&t);
    assert_eq!(s(&st.thread("old").unwrap(), "color"), "");
    assert_eq!(st.thread("old").unwrap()["members"].as_array().unwrap().len(), 1);
    assert_eq!(s(&st.thread("ruined").unwrap(), "color"), "");
    st.update_thread("ruined", None, Some("Fixed up."), None).unwrap(); // saving drops the unusable color line
    assert!(!fs::read_to_string(dir.join("ruined.md")).unwrap().contains("chartreuse"));
}

#[test]
fn threads() {
    let t = Scratch::new();
    let mut st = store(&t);
    assert_eq!(s(&st.create_thread("Phinehas: zeal!", "", None).unwrap(), "id"), "phinehas-zeal");
    assert_eq!(s(&st.create_thread("Phinehas zeal", "", None).unwrap(), "id"), "phinehas-zeal-2");
    st.add_to_thread("phinehas-zeal", "NUM.25:7-25:13", "Phinehas ... peace").unwrap();
    st.add_to_thread("phinehas-zeal", "NUM.25:11.12", "zealous").unwrap();
    st.add_to_thread("phinehas-zeal", "NUM.25:11.12", "zealous").unwrap(); // no duplicate
    st.update_thread("phinehas-zeal", None, Some("Why he mattered.\n\n<!-- anchors -->\n- bogus | \"x\""), None).unwrap();
    let got = st.thread("phinehas-zeal").unwrap();
    let members: Vec<&str> = got["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap()).collect();
    assert_eq!(members, vec!["NUM.25:7-25:13", "NUM.25:11.12"]);
    assert_eq!(got["members"][1]["quote"], "zealous");
    assert!(!got["members"].to_string().contains("bogus"));
    assert!(s(&got, "note").starts_with("Why he mattered."));
    st.remove_from_thread("phinehas-zeal", "NUM.25:7-25:13").unwrap();
    assert_eq!(st.thread("phinehas-zeal").unwrap()["members"].as_array().unwrap().len(), 1);
    let text = fs::read_to_string(t.path().join("threads").join("phinehas-zeal.md")).unwrap();
    assert!(text.contains("- NUM.25:11.12 | \"zealous\""));
    st.delete_thread("phinehas-zeal").unwrap();
    assert_eq!(st.thread("phinehas-zeal").unwrap_err().0, "No such thread.");
    assert!(fs::read_dir(t.path().join(".trash")).unwrap().flatten().any(|e| e.file_name().to_string_lossy().ends_with("phinehas-zeal.md")));
}

// ---- ResolveAndApi ------------------------------------------------------------------------------------------------

#[test]
fn resolve_word_phrase_verse_lemma() {
    let Some(b) = bible() else { return };
    let zi = index_of(&b, "NUM", 25, 11, "zealous");
    let w = resolve(&b, &format!("NUM.25:11.{zi}")).unwrap();
    assert_eq!((w["ok"].clone(), s(&w, "quote"), w["strongs"].clone(), s(&w, "label")), (json!(true), "zealous".into(), json!(["H7065"]), "Numbers 25:11".into()));
    let p = resolve(&b, "NUM.25:11.0-25:11.4").unwrap();
    assert_eq!(p["ok"], true);
    assert_eq!(s(&p, "quote"), words(&b, "NUM", 25, 11, 0, 4));
    let v = resolve(&b, "NUM.25:7-25:8").unwrap();
    assert_eq!(s(&v, "label"), "Numbers 25:7–8");
    let both: Vec<String> = b.verses("NUM", 25, 7, 25, 8).unwrap().into_iter().map(|x| x.2).collect();
    assert_eq!(s(&v, "quote"), both.join(" "));
    let lem = resolve(&b, "H7065").unwrap();
    assert!(lem["ok"] == true && s(&lem, "quote").starts_with('ק'));
    assert_eq!(resolve(&b, "NUM.25:11.999").unwrap()["ok"], false);
    assert_eq!(resolve(&b, "ZZZ.1:1").unwrap()["ok"], false);
}

#[test]
fn phrase_across_verses() {
    let Some(b) = bible() else { return };
    let r = resolve(&b, "NUM.25:11.30-25:12.2").unwrap();
    assert_eq!(r["ok"], true);
    assert_eq!(s(&r, "label"), "Numbers 25:11–12");
}

#[test]
fn anchor_view_has_both_notes_views_and_nearby() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let zeal = format!("NUM.25:11.{}", index_of(&b, "NUM", 25, 11, "zealous"));
    sa::save_note(&b, &mut st, &zeal, "He was zealous for God.", None).unwrap();
    sa::save_note(&b, &mut st, "NUM.25:11", "The whole verse note.", None).unwrap();
    sa::save_note(&b, &mut st, "H7065", "qanah itself: jealous for, zealous.", None).unwrap();
    let other = b.chapter("NUM", 25).unwrap().verses.iter().find(|v| v.v == 13).unwrap().words.iter().find(|w| w.strong.as_deref() == Some("H7065")).unwrap().i;
    sa::save_note(&b, &mut st, &format!("NUM.25:13.{other}"), "Again, for his God.", None).unwrap();
    let v = sa::anchor_view(&b, &st, &zeal).unwrap();
    let texts = |k: &str, x: &Value| x[k].as_array().unwrap().iter().map(|n| n["text"].as_str().unwrap().to_string()).collect::<Vec<_>>();
    assert_eq!(texts("notes", &v), vec!["He was zealous for God."]);
    assert_eq!(texts("nearby", &v), vec!["The whole verse note."]);
    let ev = &v["everywhere"];
    assert_eq!(ev["strong"], "H7065");
    assert_eq!(texts("word_notes", ev), vec!["qanah itself: jealous for, zealous."]);
    let occ: Vec<(String, String)> = ev["occurrence_notes"].as_array().unwrap().iter().map(|n| (n["text"].as_str().unwrap().into(), n["label"].as_str().unwrap().into())).collect();
    assert_eq!(occ, vec![("Again, for his God.".to_string(), "Numbers 25:13".to_string())]);
    let vv = sa::anchor_view(&b, &st, "NUM.25:11").unwrap();
    assert_eq!(vv["notes"].as_array().unwrap().len(), 1);
    assert_eq!(vv["nearby"].as_array().unwrap().len(), 1); // the word note inside this verse
    assert!(vv["everywhere"].is_null());
}

#[test]
fn chapter_marks() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let zeal = format!("NUM.25:11.{}", index_of(&b, "NUM", 25, 11, "zealous"));
    sa::save_highlight(&b, &mut st, &zeal, Some("yellow")).unwrap();
    sa::save_note(&b, &mut st, "NUM.25:7-26:2", "A run of verses.", None).unwrap();
    sa::save_note(&b, &mut st, "H7065", "lemma note, not drawn on text", None).unwrap();
    let m25 = sa::chapter_marks(&st, "NUM", 25).unwrap();
    assert_eq!(m25["highlights"].as_array().unwrap().iter().map(|h| h["color"].clone()).collect::<Vec<_>>(), vec![json!("yellow")]);
    assert_eq!(m25["notes"].as_array().unwrap().len(), 1);
    assert_eq!(sa::chapter_marks(&st, "NUM", 26).unwrap()["notes"].as_array().unwrap().len(), 1); // spans into 26
    assert!(sa::chapter_marks(&st, "NUM", 24).unwrap()["notes"].as_array().unwrap().is_empty());
}

/// Which color each word shows, and the stored anchors (sorted), checking nothing overlaps.
fn painted(b: &wb_core::bible::Bible, st: &Store) -> Vec<(String, String)> {
    let mut shown = std::collections::HashSet::new();
    let mut seen = vec![];
    for h in st.highlights("NUM") {
        let r = resolve(b, &s(&h, "anchor")).unwrap();
        let p = py_parse(&s(&h, "anchor")).unwrap();
        let (c1, v1) = (p["c1"].as_u64().unwrap() as u32, p["v1"].as_u64().unwrap() as u32);
        let (c2, v2) = if p["c2"].is_null() { (c1, v1) } else { (p["c2"].as_u64().unwrap() as u32, p["v2"].as_u64().unwrap() as u32) };
        for c in c1..=c2 {
            for v in b.chapter("NUM", c).unwrap().verses {
                for w in v.words {
                    let pos = (c, v.v, w.i);
                    let lo = (c1, v1, p["i1"].as_u64().map(|x| x as u32).unwrap_or(0));
                    let hi = (c2, v2, p["i2"].as_u64().or(p["i1"].as_u64()).map(|x| x as u32).unwrap_or(u32::MAX));
                    if lo <= pos && pos <= hi {
                        assert!(shown.insert(pos), "stored highlights overlap at {pos:?}");
                    }
                }
            }
        }
        assert_eq!(r["ok"], true);
        seen.push((s(&h, "anchor"), color_of(&h)));
    }
    seen.sort();
    seen
}

fn pairs(v: &[(&str, &str)]) -> Vec<(String, String)> {
    v.iter().map(|(a, c)| (a.to_string(), c.to_string())).collect()
}

#[test]
fn highlighting_inside_a_highlight_splits_it() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.8", Some("yellow")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.3", Some("blue")).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.2", "yellow"), ("NUM.25:11.3", "blue"), ("NUM.25:11.4-25:11.8", "yellow")]));
}

#[test]
fn erasing_part_of_a_highlight_keeps_the_rest() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.8", Some("yellow")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.2-25:11.4", None).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.1", "yellow"), ("NUM.25:11.5-25:11.8", "yellow")]));
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.8", None).unwrap();
    assert!(st.all_highlights().is_empty());
    assert!(!t.path().join("highlights").join("NUM.json").exists());
}

#[test]
fn the_same_place_in_a_new_color_replaces_it_and_the_edge_words_are_kept() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.4", Some("yellow")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.4", Some("pink")).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.4", "pink")]));
    sa::save_highlight(&b, &mut st, "NUM.25:11.4-25:11.6", Some("green")).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.3", "pink"), ("NUM.25:11.4-25:11.6", "green")]));
}

#[test]
fn a_phrase_across_a_verse_break_is_cut_at_the_break() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let last = b.chapter("NUM", 25).unwrap().verses.iter().find(|v| v.v == 11).unwrap().words.last().unwrap().i;
    sa::save_highlight(&b, &mut st, &format!("NUM.25:11.{}-25:12.3", last - 1), Some("yellow")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:12.0-25:12.1", Some("blue")).unwrap();
    let a = format!("NUM.25:11.{}-25:11.{last}", last - 1);
    assert_eq!(painted(&b, &st), pairs(&[(&a, "yellow"), ("NUM.25:12.0-25:12.1", "blue"), ("NUM.25:12.2-25:12.3", "yellow")]));
}

#[test]
fn erasing_a_word_from_a_verse_highlight_leaves_word_ranges_and_whole_verses_stay_verses() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:7-25:13", Some("green")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:10", None).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11-25:13", "green"), ("NUM.25:7-25:9", "green")]));
    sa::save_highlight(&b, &mut st, "NUM.25:12.2", None).unwrap();
    let stored = painted(&b, &st);
    assert_eq!(stored.len(), 3);
    assert!(!stored.iter().any(|(a, _)| a == "NUM.25:12.2"));
    let view = |a: &str| sa::anchor_view(&b, &st, a).unwrap();
    assert_eq!(view("NUM.25:12.2")["highlighted"], false);
    assert_eq!(view("NUM.25:12.1")["highlight"], "green");
    assert_eq!(view("NUM.25:12.3")["highlight"], "green");
}

#[test]
fn a_highlight_leaves_other_books_and_far_places_alone() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "JHN.3:16", Some("blue")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:1", Some("pink")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.3", Some("yellow")).unwrap();
    let mut got: Vec<(String, String)> = st.all_highlights().iter().map(|h| (s(h, "anchor"), color_of(h))).collect();
    got.sort();
    assert_eq!(got, pairs(&[("JHN.3:16", "blue"), ("NUM.25:1", "pink"), ("NUM.25:11.3", "yellow")]));
}

#[test]
fn a_custom_color_highlights_and_joins_the_palette_but_a_named_one_does_not() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.4", Some("#E07B39")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.5", Some("yellow")).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.4", "#e07b39"), ("NUM.25:11.5", "yellow")]));
    assert_eq!(st.palette(), vec!["#e07b39"]);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.4", None).unwrap(); // erasing never touches the palette
    assert_eq!(st.palette(), vec!["#e07b39"]);
}

#[test]
fn highlight_refuses_bad_colors_lemmas_and_missing_places() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    for (a, c) in [("NUM.25:7", "purple"), ("H7065", "yellow"), ("NUM.25:11.999", "yellow"), ("ZZZ.1:1", "yellow")] {
        assert!(sa::save_highlight(&b, &mut st, a, Some(c)).is_err(), "{a} {c}");
    }
    assert!(st.all_highlights().is_empty());
}

#[test]
fn anchor_view_reports_the_one_color_a_place_shows_and_whether_any_of_it_is_colored() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.8", Some("yellow")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.3", Some("blue")).unwrap();
    let view = |a: &str| {
        let v = sa::anchor_view(&b, &st, a).unwrap();
        (v["highlight"].clone(), v["highlighted"].clone())
    };
    assert_eq!(view("NUM.25:11.0-25:11.2"), (json!("yellow"), json!(true)));
    assert_eq!(view("NUM.25:11.3"), (json!("blue"), json!(true)));
    assert_eq!(view("NUM.25:11.0-25:11.8"), (json!(null), json!(true)));
    assert_eq!(view("NUM.25:11.20"), (json!(null), json!(false)));
    assert_eq!(view("NUM.25:11").1, json!(true));
    assert_eq!(view("NUM.25:7").1, json!(false));
}

#[test]
fn undo_puts_back_what_a_highlight_cut_and_removes_what_it_added() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.8", Some("yellow")).unwrap();
    let start: Vec<(String, String)> = st.highlights("NUM").iter().map(|h| (s(h, "anchor"), color_of(h))).collect();
    let r = sa::save_highlight(&b, &mut st, "NUM.25:11.3-25:11.5", Some("pink")).unwrap();
    assert_eq!(st.highlights("NUM").len(), 3);
    sa::undo_highlight(&mut st, &r["undo"]).unwrap();
    assert_eq!(st.highlights("NUM").iter().map(|h| (s(h, "anchor"), color_of(h))).collect::<Vec<_>>(), start);
    let r = sa::save_highlight(&b, &mut st, "NUM.25:11.2-25:11.4", None).unwrap();
    assert_eq!(st.highlights("NUM").len(), 2);
    sa::undo_highlight(&mut st, &r["undo"]).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.8", "yellow")]));
    let r = sa::save_highlight(&b, &mut st, "NUM.25:7", Some("green")).unwrap();
    sa::undo_highlight(&mut st, &r["undo"]).unwrap();
    assert_eq!(painted(&b, &st), pairs(&[("NUM.25:11.0-25:11.8", "yellow")]));
}

#[test]
fn undo_refuses_nonsense() {
    let t = Scratch::new();
    let mut st = store(&t);
    for bad in [
        json!(null), json!({}), json!({"code": "NUM"}), json!({"code": "NUM", "drop": [], "add": [{"id": "h1"}]}),
        json!({"code": "NUM", "drop": [5], "add": []}), json!({"code": "NUMB", "drop": [], "add": []}),
        json!({"code": "NUM", "drop": [], "add": [{"id": "h1", "anchor": "JHN.3:16", "color": "blue", "created": "x"}]}),
        json!({"code": "NUM", "drop": [], "add": [{"id": "h1", "anchor": "H7065", "color": "blue", "created": "x"}]}),
        json!({"code": "NUM", "drop": [], "add": [{"id": "h1", "anchor": "NUM.25:7", "color": "purple", "created": "x"}]}),
    ] {
        assert!(sa::undo_highlight(&mut st, &bad).is_err(), "{bad}");
    }
    assert!(st.all_highlights().is_empty());
}

#[test]
fn the_highlight_list_can_be_filtered_by_an_exact_custom_color_and_by_a_thread() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_highlight(&b, &mut st, "NUM.25:11.0-25:11.2", Some("#E07B39")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:11.5", Some("#336699")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:7", Some("blue")).unwrap();
    sa::save_highlight(&b, &mut st, "JHN.3:16", Some("blue")).unwrap();
    let labels = |st: &Store, c: Option<&str>, th: Option<&str>| -> Vec<String> {
        sa::highlight_list(&b, st, c, th).unwrap().as_array().unwrap().iter().map(|h| h["label"].as_str().unwrap().into()).collect()
    };
    assert_eq!(labels(&st, None, None).len(), 4);
    assert_eq!(labels(&st, Some("#e07b39"), None), vec!["Numbers 25:11"]);
    assert_eq!(labels(&st, Some("#E07B39"), None), vec!["Numbers 25:11"]);
    let id = s(&st.create_thread("Phinehas", "", None).unwrap(), "id");
    sa::add_to_thread(&b, &mut st, &id, "NUM.25:11.1-25:11.3").unwrap();
    sa::add_to_thread(&b, &mut st, &id, "H7065").unwrap();
    let colors: Vec<Value> = sa::highlight_list(&b, &st, None, Some(&id)).unwrap().as_array().unwrap().iter().map(|h| h["color"].clone()).collect();
    assert_eq!(colors, vec![json!("#e07b39")]);
    sa::add_to_thread(&b, &mut st, &id, "NUM.25:7").unwrap();
    assert_eq!(labels(&st, None, Some(&id)), vec!["Numbers 25:7", "Numbers 25:11"]);
    assert_eq!(labels(&st, Some("blue"), Some(&id)), vec!["Numbers 25:7"]);
    assert_eq!(sa::highlight_list(&b, &st, None, Some("no-such-thread")).unwrap_err().0, "No such thread.");
}

#[test]
fn chapter_marks_carry_the_places_of_colored_threads_only() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let zeal_word = format!("NUM.25:11.{}", index_of(&b, "NUM", 25, 11, "zealous"));
    st.create_thread("Zeal", "", Some("blue")).unwrap();
    st.create_thread("No color yet", "", None).unwrap();
    for id in ["zeal", "no-color-yet"] {
        sa::add_to_thread(&b, &mut st, id, &zeal_word).unwrap();
    }
    for a in ["NUM.25:7-26:2", "H7065", "JHN.3:16"] {
        sa::add_to_thread(&b, &mut st, "zeal", a).unwrap();
    }
    let th = |c: &str, ch: i64| sa::chapter_marks(&st, c, ch).unwrap()["threads"].as_array().unwrap().clone();
    let mut m25: Vec<(String, String, String)> = th("NUM", 25).iter().map(|m| (m["kind"].as_str().unwrap().into(), m["thread"].as_str().unwrap().into(), m["color"].as_str().unwrap().into())).collect();
    m25.sort();
    assert_eq!(m25, vec![("verses".into(), "zeal".into(), "blue".into()), ("word".into(), "zeal".into(), "blue".into())]);
    assert_eq!(th("NUM", 26).len(), 1);
    assert!(th("NUM", 24).is_empty());
    assert_eq!(th("JHN", 3).len(), 1);
    st.update_thread("zeal", None, None, Some(None)).unwrap();
    assert!(sa::chapter_marks(&st, "NUM", 25).unwrap()["threads"].as_array().unwrap().is_empty());
}

#[test]
fn thread_list_can_be_searched_by_name_and_note() {
    let t = Scratch::new();
    let mut st = store(&t);
    st.create_thread("Phinehas", "The priest who turned wrath away", None).unwrap();
    st.create_thread("Covenant of salt", "Numbers 18", None).unwrap();
    let names = |q: Option<&str>| {
        let mut v: Vec<String> = sa::thread_list(&st, q).unwrap().as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap().into()).collect();
        v.sort();
        v
    };
    assert_eq!(names(None), vec!["Covenant of salt", "Phinehas"]);
    assert_eq!(names(Some("")), vec!["Covenant of salt", "Phinehas"]);
    assert_eq!(names(Some("phin")), vec!["Phinehas"]);
    assert_eq!(names(Some("PRIEST wrath")), vec!["Phinehas"]);
    assert_eq!(names(Some("salt numbers")), vec!["Covenant of salt"]);
    assert!(names(Some("priest salt")).is_empty());
    assert!(sa::thread_list(&st, Some("a b c d e f g h i j k l m")).is_err());
}

#[test]
fn save_note_refuses_places_not_in_the_text() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    assert!(sa::save_note(&b, &mut store(&t), "NUM.25:11.999", "nope", None).is_err());
}

#[test]
fn thread_view_flags_a_quote_that_no_longer_matches() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let zeal = format!("NUM.25:11.{}", index_of(&b, "NUM", 25, 11, "zealous"));
    st.create_thread("Zeal", "", None).unwrap();
    sa::add_to_thread(&b, &mut st, "zeal", &zeal).unwrap();
    sa::add_to_thread(&b, &mut st, "zeal", "NUM.25:7-25:13").unwrap();
    let view = sa::thread_view(&b, &st, "zeal").unwrap();
    assert_eq!(view["members"].as_array().unwrap().iter().map(|m| m["drifted"].clone()).collect::<Vec<_>>(), vec![json!(false), json!(false)]);
    assert_eq!(view["strongs"][0]["strong"], "H7065");
    let path = t.path().join("threads").join("zeal.md");
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(&path, fs::read_to_string(&path).unwrap().replace("\"zealous\"", "\"a different word\"")).unwrap();
    st.refresh().unwrap();
    let drifted = sa::thread_view(&b, &st, "zeal").unwrap()["members"][0].clone();
    assert_eq!(drifted["drifted"], true);
    assert_eq!(drifted["quote"], "zealous"); // the text in the Bible wins
}

// ---- VersionsAndPrintNotes ----------------------------------------------------------------------------------------

#[test]
fn versions_list_and_text() {
    let Some(b) = bible() else { return };
    let vs = wb_core::lookup::versions(&b).unwrap();
    let ids: Vec<&str> = vs.as_array().unwrap().iter().map(|v| v["id"].as_str().unwrap()).collect();
    assert_eq!(ids, vec!["KJV", "YLT"]);
    let ylt = wb_core::lookup::text(&b, "ylt", 43, 3).unwrap().unwrap();
    let kjv = wb_core::lookup::text(&b, "KJV", 43, 3).unwrap().unwrap();
    let nums = |x: &Value| x["verses"].as_array().unwrap().iter().map(|v| v["v"].clone()).collect::<Vec<_>>();
    assert_eq!(nums(&ylt), nums(&kjv)); // same verse numbering
    assert_eq!(ylt["verses"][15]["v"], 16);
    assert!(wb_core::lookup::text(&b, "YLT", 43, 99).unwrap().is_none());
    assert!(wb_core::lookup::text(&b, "NIV", 43, 3).is_err());
}

#[test]
fn a_chapter_in_the_ylt_is_its_text_verbatim_split_at_spaces() {
    let Some(b) = bible() else { return };
    for (code, id, ch) in [("JHN", 43, 3), ("NUM", 4, 25), ("PSA", 19, 119)] {
        let ylt = b.chapter_in(code, ch, "ylt").unwrap();
        let stored = wb_core::lookup::text(&b, "YLT", id, ch).unwrap().unwrap();
        assert_eq!(ylt.version.as_deref(), Some("YLT"));
        assert_eq!(ylt.verses.len(), stored["verses"].as_array().unwrap().len());
        for (v, s) in ylt.verses.iter().zip(stored["verses"].as_array().unwrap()) {
            assert_eq!(v.v, s["v"].as_u64().unwrap() as u32);
            let joined = v.words.iter().map(|w| w.text.as_str()).collect::<Vec<_>>().join(" ");
            assert_eq!(joined, s["text"].as_str().unwrap(), "{code} {ch}:{}", v.v);
            assert!(v.words.iter().all(|w| w.strong.is_none()));
        }
    }
    let kjv = b.chapter_in("JHN", 3, "KJV").unwrap();
    assert!(kjv.version.is_none() && kjv.verses[0].words.iter().any(|w| w.strong.is_some()));
    assert!(b.chapter_in("JHN", 3, "NIV").is_err());
}

#[test]
fn in_another_version_only_marks_on_whole_verses_are_drawn() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let zeal = format!("NUM.25:11.{}", index_of(&b, "NUM", 25, 11, "zealous"));
    sa::save_highlight(&b, &mut st, &zeal, Some("yellow")).unwrap();
    sa::save_highlight(&b, &mut st, "NUM.25:7", Some("green")).unwrap();
    sa::save_note(&b, &mut st, &zeal, "A note on a word.", None).unwrap();
    st.create_thread("Zeal", "", Some("blue")).unwrap();
    sa::add_to_thread(&b, &mut st, "zeal", &zeal).unwrap();
    sa::add_to_thread(&b, &mut st, "zeal", "NUM.25:7-25:13").unwrap();
    let kjv = wb_core::views::reader_in(&b, &st, "NUM", 25, "KJV").unwrap();
    assert_eq!((kjv.marks.highlights.len(), kjv.marks.threads.len()), (2, 2));
    let ylt = wb_core::views::reader_in(&b, &st, "NUM", 25, "YLT").unwrap();
    let m = serde_json::to_value(&ylt.marks).unwrap();
    assert_eq!(m["highlights"].as_array().unwrap().iter().map(|h| h["color"].clone()).collect::<Vec<_>>(), vec![json!("green")]);
    assert_eq!(m["threads"].as_array().unwrap().iter().map(|h| h["kind"].clone()).collect::<Vec<_>>(), vec![json!("verses")]);
    assert_eq!(m["notes"][0]["kind"], "verse"); // the note on a word marks its verse
    assert_eq!((m["notes"][0]["v1"].as_u64(), m["notes"][0]["i1"].is_null()), (Some(11), true));
}

#[test]
fn chapter_notes_are_in_reading_order_and_skip_other_chapters_and_lemmas() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    for (a, x) in [("NUM.25:13", "second verse note"), ("NUM.25:11.0-25:11.4", "a phrase early in verse 11"), ("NUM.25:11", "whole verse 11"),
        ("NUM.26:1", "next chapter"), ("H7065", "lemma notes are not chapter notes")]
    {
        sa::save_note(&b, &mut st, a, x, None).unwrap();
    }
    let got = sa::chapter_notes(&b, &st, "NUM", 25).unwrap();
    assert_eq!(got.iter().map(|n| n["text"].as_str().unwrap()).collect::<Vec<_>>(), vec!["whole verse 11", "a phrase early in verse 11", "second verse note"]);
    assert_eq!(got[0]["label"], "Numbers 25:11");
    assert_eq!(got[1]["quote"].as_str().unwrap(), words(&b, "NUM", 25, 11, 0, 4));
    assert!(sa::chapter_notes(&b, &st, "NUM", 24).unwrap().is_empty());
}

// ---- TrailStore, DefineAndTrailApi --------------------------------------------------------------------------------

#[test]
fn trail_lifecycle_is_plain_files() {
    let t = Scratch::new();
    let mut st = store(&t);
    let q = st.add_trail("NUM.25:11.24", "Is zeal ever wrong? Compare Romans 10:2.", "zealous").unwrap();
    let id = s(&q, "id");
    let path = t.path().join("trails").join(format!("{id}.md"));
    assert!(fs::read_to_string(&path).unwrap().contains("status: \"open\""));
    assert_eq!(st.trails().iter().map(|x| s(x, "id")).collect::<Vec<_>>(), vec![id.clone()]);
    st.set_trail_status(&id, "done").unwrap();
    assert_eq!(s(st.trails()[0], "status"), "done");
    st.update_trail(&id, "Edited question").unwrap();
    assert_eq!(s(st.trails()[0], "text"), "Edited question");
    assert_eq!(s(st.trails()[0], "anchor"), "NUM.25:11.24");
    st.delete_trail(&id).unwrap();
    assert!(!path.exists());
    assert_eq!(fs::read_dir(t.path().join(".trash")).unwrap().count(), 1);
}

#[test]
fn bad_trails_are_refused() {
    let t = Scratch::new();
    let mut st = store(&t);
    assert!(st.add_trail("NUM.25:11", "   ", "").is_err());
    assert!(st.add_trail("H7065", "a lemma is not a place in the text", "").is_err());
    let q = st.add_trail("NUM.25:11", "q", "").unwrap();
    assert!(st.set_trail_status(&s(&q, "id"), "maybe").is_err());
    assert_eq!(st.delete_trail("q_nope").unwrap_err().0, "No such trail.");
}

#[test]
fn define_english_word_lists_the_originals_behind_it() {
    let Some(b) = bible() else { return };
    let d = wb_core::lookup::define(&b, "zeal").unwrap();
    let eng = d["english"].as_array().unwrap();
    let strongs: Vec<&str> = eng.iter().map(|e| e["strong"].as_str().unwrap()).collect();
    assert!(strongs.contains(&"G2205"));
    assert!(strongs.iter().any(|s| s.starts_with('H')));
    let ns: Vec<i64> = eng.iter().map(|e| e["n"].as_i64().unwrap()).collect();
    let mut sorted = ns.clone();
    sorted.sort_by(|a, b| b.cmp(a));
    assert_eq!(ns, sorted);
    assert!(eng.iter().all(|e| e["lemma"].as_str().is_some_and(|x| !x.is_empty()) && e["definition"].as_str().is_some_and(|x| !x.is_empty())));
}

#[test]
fn define_by_number_transliteration_and_script() {
    let Some(b) = bible() else { return };
    let d = |q: &str| wb_core::lookup::define(&b, q);
    assert_eq!(d("h7065").unwrap()["strong"], "H7065");
    let orig = |q: &str| d(q).unwrap()["original"].as_array().unwrap().iter().map(|e| e["strong"].as_str().unwrap().to_string()).collect::<Vec<_>>();
    assert!(orig("agape").contains(&"G26".to_string()));
    assert!(orig("agap").contains(&"G26".to_string())); // a prefix
    assert!(orig("ἀγάπη").contains(&"G26".to_string()));
    let none = d("qwertyxyz").unwrap();
    assert_eq!((none["english"].clone(), none["original"].clone(), none["strong"].clone()), (json!([]), json!([]), json!(null)));
    for bad in ["".to_string(), "x".repeat(61), "H9999".to_string()] {
        assert!(d(&bad).is_err(), "{bad}");
    }
}

#[test]
fn trail_api_resolves_places_and_counts() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    let a = sa::save_trail(&b, &mut st, "NUM.25:11", "What did the zeal cost him?").unwrap();
    assert_eq!((a["label"].clone(), a["status"].clone()), (json!("Numbers 25:11"), json!("open")));
    assert_eq!(a["quote"].as_str().unwrap(), b.verses("NUM", 25, 11, 25, 11).unwrap()[0].2);
    sa::save_trail(&b, &mut st, "NUM.25:13.20", "Why atonement?").unwrap();
    st.set_trail_status(a["id"].as_str().unwrap(), "done").unwrap();
    let got = sa::trail_list(&b, &st, "open").unwrap();
    assert_eq!(got["trails"].as_array().unwrap().iter().map(|x| x["text"].as_str().unwrap()).collect::<Vec<_>>(), vec!["Why atonement?"]);
    assert_eq!(got["counts"], json!({"open": 1, "done": 1}));
    assert_eq!(sa::trail_list(&b, &st, "all").unwrap()["trails"].as_array().unwrap().len(), 2);
    assert!(sa::save_trail(&b, &mut st, "NUM.25:11.999", "not in the text").is_err());
    assert!(sa::trail_list(&b, &st, "weird").is_err());
}

// ---- CommandSupportApi --------------------------------------------------------------------------------------------

#[test]
fn forms_lists_every_form_with_counts() {
    let Some(b) = bible() else { return };
    let d = wb_core::lookup::forms(&b, "zeal").unwrap();
    let got: Vec<(String, i64)> = d["forms"].as_array().unwrap().iter().map(|f| (f["form"].as_str().unwrap().into(), f["n"].as_i64().unwrap())).collect();
    assert_eq!(got, vec![("zeal".into(), 16), ("zealous".into(), 8), ("zealously".into(), 2)]);
    assert_eq!(d["total"], 26);
    assert_eq!(wb_core::lookup::forms(&b, "ZEAL").unwrap()["total"], 26);
    assert!(wb_core::lookup::forms(&b, "qwertyxyz").unwrap()["forms"].as_array().unwrap().is_empty());
}

#[test]
fn forms_of_a_word_ending_in_e_include_its_ing_forms_but_not_other_words() {
    let Some(b) = bible() else { return };
    let forms: Vec<String> = wb_core::lookup::forms(&b, "love").unwrap()["forms"].as_array().unwrap().iter().map(|f| f["form"].as_str().unwrap().into()).collect();
    for f in ["love", "loved", "loveth", "loving"] {
        assert!(forms.contains(&f.to_string()), "{f}");
    }
    assert!(!forms.contains(&"lovingkindness".to_string()));
    assert!(!forms.contains(&"lov".to_string()));
    for bad in ["".to_string(), "two words".to_string(), "x".repeat(50)] {
        assert!(wb_core::lookup::forms(&b, &bad).is_err());
    }
}

#[test]
fn known_word_tells_a_real_word_from_a_mistyped_command() {
    let Some(b) = bible() else { return };
    let k = |w: &str| wb_core::lookup::known_word(&b, w).unwrap()["known"].as_bool().unwrap();
    assert!(k("deaf") && k("Zeal"));
    assert!(!k("usess") && !k(""));
}

#[test]
fn scope_can_be_a_group_of_books() {
    let Some(b) = bible() else { return };
    let search = |q: &str, scope: &str| wb_core::lookup::search(&b, &wb_core::lookup::SearchQuery { q, case: false, scope, offset: 0, limit: 100, regex: false }).unwrap();
    let every = search("grace truth", "all");
    let got = search("grace truth", "40,41,42,43");
    let books: std::collections::HashSet<i64> = got["rows"].as_array().unwrap().iter().map(|r| r["ref"]["b"].as_i64().unwrap()).collect();
    assert_eq!(books, [43].into_iter().collect());
    assert_eq!(got["verses"], every["by_book"]["43"]);
    let uses = |scope: &str| wb_core::lookup::uses(&b, &wb_core::lookup::UsesQuery { strong: Some("H7065"), word: None, cat: "all", scope, offset: 0, limit: 100, rendering: None }).unwrap();
    let u = uses("4,5");
    assert!(u["rows"].as_array().unwrap().iter().all(|r| [4, 5].contains(&r["ref"]["b"].as_i64().unwrap())));
    assert!(u["verses"].as_u64().unwrap() > 0 && u["verses"].as_u64() < uses("all")["verses"].as_u64());
}

#[test]
fn highlight_list_is_in_bible_order_with_book_ids() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    for (a, c) in [("JHN.3:16", "blue"), ("NUM.25:11", "yellow"), ("GEN.1:1", "green")] {
        sa::save_highlight(&b, &mut st, a, Some(c)).unwrap();
    }
    let got = sa::highlight_list(&b, &st, None, None).unwrap();
    let got = got.as_array().unwrap();
    assert_eq!(got.iter().map(|h| h["label"].as_str().unwrap()).collect::<Vec<_>>(), vec!["Genesis 1:1", "Numbers 25:11", "John 3:16"]);
    assert_eq!(got.iter().map(|h| h["book"].as_i64().unwrap()).collect::<Vec<_>>(), vec![1, 4, 43]);
}

#[test]
fn find_mine_needs_every_word_and_covers_notes_threads_and_trails() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    sa::save_note(&b, &mut st, "NUM.25:11", "Phinehas turned wrath away by his zeal.", None).unwrap();
    sa::save_note(&b, &mut st, "JHN.3:16", "A note about love.", None).unwrap();
    let id = s(&st.create_thread("Zeal of the Lord", "Where zeal is aimed at God.", None).unwrap(), "id");
    sa::save_trail(&b, &mut st, "NUM.25:13", "Is this zeal the same as Rom 10:2?").unwrap();
    let got = sa::find_mine(&b, &st, "zeal").unwrap();
    assert_eq!(got["notes"].as_array().unwrap().iter().map(|n| n["label"].as_str().unwrap()).collect::<Vec<_>>(), vec!["Numbers 25:11"]);
    assert_eq!(got["threads"][0]["id"], id.as_str());
    assert_eq!(got["trails"][0]["label"], "Numbers 25:13");
    assert!(got["notes"][0]["snippet"].as_str().unwrap().contains("zeal"));
    let both = sa::find_mine(&b, &st, "wrath ZEAL").unwrap();
    assert_eq!((both["notes"].as_array().unwrap().len(), both["threads"].as_array().unwrap().len(), both["trails"].as_array().unwrap().len()), (1, 0, 0));
    assert!(sa::find_mine(&b, &st, "love wrath").unwrap()["notes"].as_array().unwrap().is_empty());
    for bad in ["", "   ", &"a ".repeat(13)] {
        assert!(sa::find_mine(&b, &st, bad).is_err());
    }
}

#[test]
fn bdb_entries_follow_the_index_and_carry_the_sources_status() {
    let Some(b) = bible() else { return };
    let d = wb_core::lookup::bdb(&b, "h7065").unwrap();
    assert_eq!(d["strong"], "H7065");
    assert!(!d["entries"][0]["headword"].as_str().unwrap().is_empty());
    assert!(["base", "ref", "done", "added"].contains(&d["entries"][0]["status"].as_str().unwrap()));
    assert!(wb_core::lookup::bdb(&b, "G26").unwrap_err().0.contains("lex strongs G26"));
    for bad in ["", "zeal", "H99999", "H9999"] {
        assert!(wb_core::lookup::bdb(&b, bad).is_err(), "{bad}");
    }
    let text: String = wb_core::lookup::bdb(&b, "H1").unwrap()["entries"].as_array().unwrap().iter().map(|e| e["text"].as_str().unwrap()).collect();
    assert!(!text.contains('<'));
}

#[test]
fn lexiconc_finds_original_words_by_their_english_definition() {
    let Some(b) = bible() else { return };
    let d = wb_core::lookup::lexiconc(&b, "zeal", 150).unwrap();
    let e = d["entries"].as_array().unwrap();
    let strongs: Vec<&str> = e.iter().map(|x| x["strong"].as_str().unwrap()).collect();
    assert!(strongs.contains(&"H7068") && strongs.contains(&"G2205"));
    let ns: Vec<i64> = e.iter().map(|x| x["n"].as_i64().unwrap()).collect();
    let mut sorted = ns.clone();
    sorted.sort_by(|a, b| b.cmp(a));
    assert_eq!(ns, sorted);
    assert!(e.iter().all(|x| x["in_def"] == true || x["in_usage"] == true));
    assert!(wb_core::lookup::lexiconc(&b, "zeal*", 150).unwrap()["total"].as_u64() > d["total"].as_u64());
    assert!(wb_core::lookup::lexiconc(&b, "qwertyxyz", 150).unwrap()["entries"].as_array().unwrap().is_empty());
    for bad in ["".to_string(), "two words".to_string(), "x".repeat(50)] {
        assert!(wb_core::lookup::lexiconc(&b, &bad, 150).is_err());
    }
}

#[test]
fn near_marks_both_words_across_verse_boundaries() {
    let Some(b) = bible() else { return };
    let near = |a: &str, x: &str, n: i64, scope: &str| wb_core::lookup::near(&b, a, x, n, scope, 0, 100);
    let wide = near("Phinehas", "zealous", 30, "all").unwrap();
    let refs: Vec<(String, i64, i64)> = wide["rows"].as_array().unwrap().iter().map(|r| (r["ref"]["name"].as_str().unwrap().into(), r["ref"]["c"].as_i64().unwrap(), r["ref"]["v"].as_i64().unwrap())).collect();
    assert_eq!(refs, vec![("Numbers".into(), 25, 11)]);
    let marks: Vec<(String, String)> = wide["rows"][0]["words"].as_array().unwrap().iter().filter(|w| w["m"] != "").map(|w| (w["t"].as_str().unwrap().into(), w["m"].as_str().unwrap().into())).collect();
    assert_eq!(marks, vec![("Phinehas".into(), "s".into()), ("zealous".into(), "e".into())]);
    assert_eq!(near("Phinehas", "zealous", 12, "all").unwrap()["verses"], 0);
    assert_eq!(near("H7065", "Phinehas", 30, "all").unwrap()["verses"], 1);
    let love = near("love", "love", 2, "all").unwrap();
    assert!(love["rows"].as_array().unwrap().iter().all(|r| r["ref"]["name"] == "1 John"));
    assert_eq!(love["rows"].as_array().unwrap().iter().map(|r| r["ref"]["v"].as_i64().unwrap()).collect::<Vec<_>>(), vec![18, 19]);
    assert_eq!(near("Phinehas", "zealous", 30, "43").unwrap()["verses"], 0);
    assert_eq!(near("Phinehas", "zealous", 30, "4,5").unwrap()["verses"], 1);
    for (a, x, n) in [("", "x", 5), ("a b", "x", 5), ("love", "hate", 0), ("love", "hate", 51)] {
        assert!(near(a, x, n, "all").is_err(), "{a} {x} {n}");
    }
}

#[test]
fn session_log_is_plain_lines_per_day() {
    let t = Scratch::new();
    let st = store(&t);
    let e = st.log_event("note he turned wrath away @Num 25:13", "Noted on Numbers 25:13").unwrap();
    st.log_event("uses zeal", "").unwrap();
    let day = st.log_day(None).unwrap();
    assert_eq!(day["entries"].as_array().unwrap().iter().map(|x| x["text"].as_str().unwrap()).collect::<Vec<_>>(), vec!["note he turned wrath away @Num 25:13", "uses zeal"]);
    assert_eq!(day["entries"][0]["result"], "Noted on Numbers 25:13");
    assert_eq!(day["days"], json!([day["day"]]));
    assert!(st.log_day(Some("2001-01-01")).unwrap()["entries"].as_array().unwrap().is_empty());
    for bad in ["yesterday", "2026-1-1", "../x"] {
        assert!(st.log_day(Some(bad)).is_err(), "{bad}");
    }
    assert!(st.log_event("   ", "").is_err());
    let tt = e["t"].as_str().unwrap();
    assert!(tt.len() == 8 && tt.as_bytes()[2] == b':' && tt.as_bytes()[5] == b':');
}

#[test]
fn a_set_points_at_things_and_never_owns_them() {
    let t = Scratch::new();
    let mut st = store(&t);
    let th = s(&st.create_thread("Phinehas", "", None).unwrap(), "id");
    let made = st
        .create_set("Zeal study", &[json!({"kind": "thread", "ref": th}), json!({"kind": "place", "ref": "NUM.25:11"}),
            json!({"kind": "pane", "type": "uses", "id": "uses", "title": "Occurrences", "params": {"word": "zeal"}})])
        .unwrap();
    let keys = made["keys"].as_array().unwrap().clone();
    assert_eq!(keys.len(), 3);
    let id = s(&made, "id");
    let again = st.add_to_set(&id, &[json!({"kind": "place", "ref": "NUM.25:11"}), json!({"kind": "pdf", "ref": "John 3.pdf"})]).unwrap();
    assert_eq!(again["keys"][0], keys[1]); // already there: stays once
    assert_eq!(st.find_set("zeal").unwrap()["items"].as_array().unwrap().len(), 4);
    st.remove_from_set(&id, &[keys[0].as_str().unwrap().to_string()]).unwrap();
    assert_eq!(st.threads().len(), 1); // out of the set, not out of the study
    st.delete_set(&id).unwrap();
    assert!(st.sets().is_empty());
    assert_eq!(st.threads().len(), 1);
    assert!(fs::read_dir(t.path().join(".trash")).unwrap().flatten().any(|e| e.file_name().to_string_lossy().ends_with("zeal-study.md")));
}

#[test]
fn sets_are_found_like_threads_and_names_do_not_repeat() {
    let t = Scratch::new();
    let mut st = store(&t);
    st.create_set("Phinehas study", &[]).unwrap();
    st.create_set("Prayer lesson", &[]).unwrap();
    assert_eq!(s(&st.find_set("phin").unwrap(), "name"), "Phinehas study");
    assert_eq!(s(&st.find_set("lesson").unwrap(), "name"), "Prayer lesson");
    assert!(st.find_set("p").unwrap_err().0.starts_with("Which set?"));
    assert!(st.find_set("nope").unwrap_err().0.starts_with("No set called"));
    assert!(st.create_set("phinehas STUDY", &[]).is_err());
    let prayer = s(&st.find_set("prayer").unwrap(), "id");
    assert!(st.update_set(&prayer, Some("Phinehas study"), &[]).is_err());
}

#[test]
fn a_set_keeps_what_its_panes_now_show_and_reads_back_from_its_file() {
    let t = Scratch::new();
    let mut st = store(&t);
    let made = st.create_set("Search work", &[json!({"kind": "pane", "type": "search", "id": "search", "title": "Search", "params": {"q": "grace"}})]).unwrap();
    let key = made["keys"][0].clone();
    st.update_set(&s(&made, "id"), None, &[json!({"key": key, "title": "Search — truth", "params": {"q": "truth"}})]).unwrap();
    let item = store(&t).find_set("search work").unwrap()["items"][0].clone();
    assert_eq!((item["title"].clone(), item["params"].clone()), (json!("Search — truth"), json!({"q": "truth"})));
}

#[test]
fn a_set_keeps_words_written_by_hand_in_its_file_and_skips_a_bad_line() {
    let t = Scratch::new();
    let mut st = store(&t);
    let made = st.create_set("Hand", &[json!({"kind": "place", "ref": "JHN.3:16"})]).unwrap();
    let path = t.path().join("sets").join(format!("{}.md", s(&made, "id")));
    fs::write(&path, fs::read_to_string(&path).unwrap().replacen("- {", "my own words\n- {not json\n- {", 1)).unwrap();
    let fresh = store(&t).find_set("hand").unwrap();
    assert_eq!(s(&fresh, "note"), "my own words");
    assert_eq!(fresh["items"].as_array().unwrap().len(), 1);
}

#[test]
fn layouts_are_saved_as_named_files_and_found_by_a_unique_start() {
    let t = Scratch::new();
    let st = store(&t);
    assert!(st.layouts().is_empty());
    st.save_layout("Phinehas study", &json!({"dock": {"panels": {}}, "minimized": []})).unwrap();
    st.save_layout("Gospels", &json!({"dock": {"x": 1}, "minimized": [["a"]]})).unwrap();
    assert_eq!(st.layouts().iter().map(|x| x["name"].as_str().unwrap()).collect::<Vec<_>>(), vec!["Gospels", "Phinehas study"]);
    assert_eq!(st.layout("phin").unwrap()["layout"]["dock"], json!({"panels": {}}));
    assert_eq!(st.layout("Gospels").unwrap()["name"], "Gospels");
    st.save_layout("Phinehas study", &json!({"dock": {"v": 2}, "minimized": []})).unwrap(); // the same name replaces
    assert_eq!(st.layout("phinehas study").unwrap()["layout"]["dock"], json!({"v": 2}));
    assert_eq!(st.layouts().len(), 2);
    assert!(st.layout("zzz").unwrap_err().0.starts_with("No saved layout"));
    st.save_layout("Phinehas other", &json!({"dock": {}})).unwrap();
    assert!(st.layout("phin").unwrap_err().0.starts_with("Which layout?"));
    for bad in ["", "   "] {
        assert!(st.save_layout(bad, &json!({"dock": {}})).is_err());
    }
    assert!(st.save_layout("x", &json!("not a layout")).is_err());
}

#[test]
fn remove_place_takes_every_anchor_at_that_place_out_of_a_thread() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = store(&t);
    st.create_thread("Phinehas", "", None).unwrap();
    for a in ["NUM.25:11", "NUM.25:11.3-25:11.9", "NUM.25:13", "JHN.3:16", "H7065"] {
        sa::add_to_thread(&b, &mut st, "phinehas", a).unwrap();
    }
    let r = sa::remove_place(&b, &mut st, "phinehas", "NUM.25:11").unwrap();
    let mut gone: Vec<&str> = r["removed"].as_array().unwrap().iter().map(|x| x["anchor"].as_str().unwrap()).collect();
    gone.sort();
    assert_eq!(gone, vec!["NUM.25:11", "NUM.25:11.3-25:11.9"]);
    let left = |st: &Store| st.thread("phinehas").unwrap()["members"].as_array().unwrap().iter().map(|m| m["anchor"].as_str().unwrap().to_string()).collect::<Vec<_>>();
    assert_eq!(left(&st), vec!["NUM.25:13", "JHN.3:16", "H7065"]);
    let r = sa::remove_place(&b, &mut st, "phinehas", "NUM.25:11-25:13").unwrap();
    assert_eq!(r["removed"][0]["label"], "Numbers 25:13");
    sa::remove_place(&b, &mut st, "phinehas", "H7065").unwrap();
    assert_eq!(left(&st), vec!["JHN.3:16"]);
    assert!(sa::remove_place(&b, &mut st, "phinehas", "NUM.25:11").is_err());
    assert_eq!(sa::remove_place(&b, &mut st, "nope", "NUM.25:11").unwrap_err().0, "No such thread.");
}
