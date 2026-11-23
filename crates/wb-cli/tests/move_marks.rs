//! design/features/marks row 55 (T15): `wb study move-marks --dry-run` and `--go`, the one-time move of `highlights/` and
//! `pencil/` into `marks/`. Each test runs `wb` on a generated scratch study; the folder is never the real one. No
//! scripture is typed here: the highlights are made by `wb hl set`, which takes their words from the database.

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

struct Wb {
    dir: PathBuf,
}

impl Wb {
    fn new() -> Option<Wb> {
        if !wb_core::default_db_path().exists() {
            wb_core::bible_database_missing_in_test();
            return None;
        }
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let dir = std::env::temp_dir()
            .join("bible-workbench-rs")
            .join("move-marks-tests")
            .join(format!(
                "{}-{}",
                std::process::id(),
                N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Some(Wb { dir })
    }
    fn run(&self, args: &[&str]) -> (i32, String, String) {
        let out = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(args)
            .env("WB_STUDY_DIR", &self.dir)
            .env_remove("WB_DOCS_DIR")
            .env("WB_NO_OPEN", "1")
            .stdin(Stdio::null())
            .output()
            .unwrap();
        (
            out.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&out.stdout).into(),
            String::from_utf8_lossy(&out.stderr).into(),
        )
    }
    fn js(&self, args: &[&str]) -> Value {
        let (code, out, err) = self.run(args);
        assert_eq!(code, 0, "wb {args:?}: {err}");
        serde_json::from_str(&out).unwrap_or_else(|e| panic!("wb {args:?}: {e}"))
    }
    fn ok(&self, args: &[&str]) {
        let (code, _, err) = self.run(args);
        assert_eq!(code, 0, "wb {args:?}: {err}");
    }
    fn snapshot(&self) -> BTreeMap<String, Vec<u8>> {
        fn walk(root: &Path, d: &Path, out: &mut BTreeMap<String, Vec<u8>>) {
            for e in std::fs::read_dir(d).into_iter().flatten().flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(root, &p, out);
                } else {
                    out.insert(
                        p.strip_prefix(root)
                            .unwrap()
                            .to_string_lossy()
                            .replace('\\', "/"),
                        std::fs::read(&p).unwrap_or_default(),
                    );
                }
            }
        }
        let mut out = BTreeMap::new();
        walk(&self.dir, &self.dir, &mut out);
        out
    }
    fn put(&self, rel: &str, text: &str) {
        let p = self.dir.join(rel);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, text).unwrap();
    }
    fn read(&self, rel: &str) -> String {
        std::fs::read_to_string(self.dir.join(rel)).unwrap()
    }
    fn exists(&self, rel: &str) -> bool {
        self.dir.join(rel).exists()
    }
}

/// The folder as an old build left it: highlights in two books (one with a later `changed`), a few new marks, a legend
/// entry, and pencil lines in one book.
fn old_folder(w: &Wb) {
    w.ok(&["hl", "set", "Num 25:11", "green"]);
    w.ok(&["hl", "set", "Num 25:12", "#e07b39"]);
    w.ok(&["hl", "set", "Gen 1:3", "blue"]);
    w.ok(&[
        "mark",
        "add",
        "Num 25:12",
        "--kind",
        "circle",
        "--color",
        "pink",
    ]);
    w.ok(&[
        "mark", "add", "Exod 3:2", "--kind", "box", "--color", "blue",
    ]);
    w.ok(&[
        "legend",
        "add",
        "--kind",
        "highlight",
        "--color",
        "green",
        "--name",
        "Promise",
    ]);
    // one highlight changed after it was made (the old record's own `changed`)
    let mut v: Value = serde_json::from_str(&w.read("highlights/NUM.json")).unwrap();
    v["highlights"][0]["changed"] = json!("2026-02-03T04:05:06Z");
    w.put(
        "highlights/NUM.json",
        &(serde_json::to_string_pretty(&v).unwrap() + "\n"),
    );
    w.put(
        "pencil/NUM.json",
        "{\n \"pencil\": [\n  {\n   \"id\": \"p_aaaa1\",\n   \"anchor\": \"NUM.25:11.2-25:11.4\",\n   \"created\": \"2026-01-05T10:00:00Z\"\n  },\n  {\n   \"id\": \"p_aaaa2\",\n   \"anchor\": \"NUM.25:13\",\n   \"created\": \"2026-01-06T10:00:00Z\"\n  }\n ]\n}\n",
    );
}

/// Every read path, as JSON, without the `old` flag (which says only where a mark was kept).
fn reads(w: &Wb) -> Value {
    fn strip(v: &mut Value) {
        match v {
            Value::Object(m) => {
                m.remove("old");
                m.values_mut().for_each(strip);
            }
            Value::Array(a) => a.iter_mut().for_each(strip),
            _ => {}
        }
    }
    let mut out = json!({
        "num": w.js(&["marks", "Num 25"])["marks"],
        "gen": w.js(&["marks", "Gen 1"])["marks"],
        "exod": w.js(&["marks", "Exod 3"])["marks"],
        "at": w.js(&["mark", "at", "Num 25:11"]),
        "at12": w.js(&["mark", "at", "Num 25:12"]),
        "legend": w.js(&["legend"]),
        "find": w.js(&["find", "--kind", "mark"]),
        "map": w.js(&["marks", "map"]),
        "uses": w.js(&["legend", "uses", "Promise"]),
    });
    strip(&mut out);
    out
}

fn dry(w: &Wb) -> Value {
    w.js(&["study", "move-marks", "--dry-run"])
}

#[test]
fn the_dry_run_writes_nothing_and_counts_per_book() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    let before = w.snapshot();
    let d = dry(&w);
    assert_eq!(before, w.snapshot(), "a dry run writes nothing");
    assert_eq!(d["dry_run"], true);
    assert_eq!(d["can_go"], true);
    let books: BTreeMap<String, Value> = d["books"]
        .as_array()
        .unwrap()
        .iter()
        .map(|b| (b["book"].as_str().unwrap().to_string(), b.clone()))
        .collect();
    assert_eq!(
        (
            books["NUM"]["highlights"].clone(),
            books["NUM"]["pencil"].clone(),
            books["NUM"]["marks"].clone()
        ),
        (json!(2), json!(2), json!(4))
    );
    assert_eq!(
        (
            books["GEN"]["highlights"].clone(),
            books["GEN"]["pencil"].clone()
        ),
        (json!(1), json!(0))
    );
    assert_eq!(
        books.len(),
        2,
        "EXO has only a new mark: nothing of it moves"
    );
    assert_eq!(d["totals"]["highlights"], 3);
    assert_eq!(d["totals"]["pencil"], 2);
    assert_eq!(d["totals"]["marks"], 5);
    assert_eq!(d["totals"]["unreadable"], 0);
    assert_eq!(d["totals"]["collisions"], 0);
    // `wb study check` lists the same
    let c = w.js(&["study", "check"]);
    assert_eq!(c["would_move_to_marks"]["totals"], d["totals"]);
    assert_eq!(before, w.snapshot(), "the check writes nothing");
    // neither flag, or both, is refused
    assert_ne!(w.run(&["study", "move-marks"]).0, 0);
    assert_ne!(w.run(&["study", "move-marks", "--go", "--dry-run"]).0, 0);
}

#[test]
fn a_record_that_cannot_be_read_is_named_and_blocks_go() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    // a highlight with no id, a place that is not a place, a file that is not JSON, and a pencil line with no anchor
    let mut v: Value = serde_json::from_str(&w.read("highlights/GEN.json")).unwrap();
    let good = v["highlights"][0].clone();
    let mut no_id = good.clone();
    no_id.as_object_mut().unwrap().remove("id");
    let mut bad_place = good.clone();
    bad_place["id"] = json!("h_badplace");
    bad_place["anchor"] = json!("Nowhere 99:99");
    v["highlights"] = json!([good, no_id, bad_place]);
    w.put(
        "highlights/GEN.json",
        &serde_json::to_string_pretty(&v).unwrap(),
    );
    w.put("highlights/JER.json", "{ this is not json");
    w.put(
        "pencil/PSA.json",
        "{\"pencil\": [{\"id\": \"p_x\", \"created\": \"2026-01-01T00:00:00Z\"}]}",
    );
    let before = w.snapshot();
    let d = dry(&w);
    assert_eq!(d["can_go"], false);
    let u = d["unreadable"].as_array().unwrap();
    assert_eq!(u.len(), 4, "{u:?}");
    let files: Vec<&str> = u.iter().map(|x| x["file"].as_str().unwrap()).collect();
    assert_eq!(
        files
            .iter()
            .filter(|f| **f == "highlights/GEN.json")
            .count(),
        2
    );
    assert!(files.contains(&"highlights/JER.json") && files.contains(&"pencil/PSA.json"));
    assert!(u.iter().all(|x| !x["why"].as_str().unwrap().is_empty()));
    assert_eq!(d["totals"]["unreadable"], 4);
    // --go moves nothing
    let (code, _, err) = w.run(&["study", "move-marks", "--go"]);
    assert_ne!(code, 0);
    assert!(err.contains("Nothing was moved"), "{err}");
    assert_eq!(before, w.snapshot());
}

#[test]
fn an_id_that_collides_with_a_mark_blocks_go_and_the_same_mark_does_not() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    let hl: Value = serde_json::from_str(&w.read("highlights/GEN.json")).unwrap();
    let id = hl["highlights"][0]["id"].as_str().unwrap().to_string();
    // a different mark in marks/ with a highlight's id
    w.put("marks/EXO.json", &serde_json::to_string_pretty(&json!({"marks": [{"id": id, "kind": "box", "color": "blue", "at": "EXO.3:2", "created": "2026-01-01T00:00:00Z"}]})).unwrap());
    let d = dry(&w);
    assert_eq!(d["can_go"], false);
    assert_eq!(d["collisions"].as_array().unwrap().len(), 1);
    assert_eq!(d["collisions"][0]["id"], json!(id));
    let before = w.snapshot();
    assert_ne!(w.run(&["study", "move-marks", "--go"]).0, 0);
    assert_eq!(before, w.snapshot());
    // the same id twice among the old files collides too
    let w2 = Wb::new().unwrap();
    old_folder(&w2);
    w2.put("highlights/EXO.json", &w2.read("highlights/GEN.json"));
    assert_eq!(dry(&w2)["collisions"].as_array().unwrap().len(), 1);
}

#[test]
fn go_moves_every_record_with_its_id_color_place_date_and_words_and_keeps_the_old_files_byte_for_byte(
) {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    let old: BTreeMap<String, Vec<u8>> = w
        .snapshot()
        .into_iter()
        .filter(|(k, _)| k.starts_with("highlights/") || k.starts_with("pencil/"))
        .collect();
    assert_eq!(old.len(), 3);
    let old_num: Value = serde_json::from_str(&w.read("highlights/NUM.json")).unwrap();
    let old_gen: Value = serde_json::from_str(&w.read("highlights/GEN.json")).unwrap();
    let exod_before = w.read("marks/EXO.json");
    let r = w.js(&["study", "move-marks", "--go"]);
    assert_eq!(r["dry_run"], false);
    assert_eq!(r["moved"]["marks"], 5);
    // the old files are in the archive, whole, and gone from where they were
    for (name, bytes) in &old {
        let (folder, file) = name.split_once('/').unwrap();
        assert_eq!(
            &std::fs::read(w.dir.join(".archive").join(folder).join(file)).unwrap(),
            bytes,
            "{name} is archived byte for byte"
        );
        assert!(!w.exists(name));
    }
    assert!(
        !w.exists("highlights") && !w.exists("pencil"),
        "the emptied folders go"
    );
    // each highlight is a mark with its id, kind, color, place, dates and words
    let marks: Value = serde_json::from_str(&w.read("marks/NUM.json")).unwrap();
    let marks = marks["marks"].as_array().unwrap();
    for h in old_num["highlights"].as_array().unwrap() {
        let m = marks
            .iter()
            .find(|m| m["id"] == h["id"])
            .unwrap_or_else(|| panic!("{h} moved"));
        assert_eq!(m["kind"], "highlight");
        assert_eq!(m["color"], h["color"]);
        assert_eq!(m["at"], h["anchor"]);
        assert_eq!(m["created"], h["created"]);
        assert_eq!(m["words"], h["quote"]);
        assert_eq!(m.get("changed"), h.get("changed"));
    }
    assert!(marks.iter().any(|m| m["changed"] == "2026-02-03T04:05:06Z"));
    let g: Value = serde_json::from_str(&w.read("marks/GEN.json")).unwrap();
    assert_eq!(
        (
            g["marks"][0]["id"].clone(),
            g["marks"][0]["words"].clone(),
            g["marks"][0]["color"].clone()
        ),
        (
            old_gen["highlights"][0]["id"].clone(),
            old_gen["highlights"][0]["quote"].clone(),
            json!("blue")
        )
    );
    // a mark that was already in marks/ stays as it was, and a book with nothing to move is not touched
    assert_eq!(w.read("marks/EXO.json"), exod_before);
    assert!(
        marks
            .iter()
            .any(|m| m["kind"] == "circle" && m["color"] == "pink"),
        "the mark already in NUM.json is kept"
    );
}

#[test]
fn pencil_lines_become_one_line_underlines_with_their_date_at_their_anchor() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    w.ok(&["study", "move-marks", "--go"]);
    let on = w.js(&["marks", "Num 25"])["marks"]
        .as_array()
        .unwrap()
        .clone();
    for (id, at, created) in [
        ("p_aaaa1", "NUM.25:11.2-25:11.4", "2026-01-05T10:00:00Z"),
        ("p_aaaa2", "NUM.25:13", "2026-01-06T10:00:00Z"),
    ] {
        let m = on
            .iter()
            .find(|m| m["id"] == id)
            .unwrap_or_else(|| panic!("{id} is a mark"));
        assert_eq!(
            (
                m["kind"].clone(),
                m["lines"].clone(),
                m["at"].clone(),
                m["created"].clone(),
                m["color"].clone()
            ),
            (
                json!("underline"),
                json!(1),
                json!(at),
                json!(created),
                json!("#888888")
            )
        );
    }
    assert_eq!(w.js(&["mark", "show", "p_aaaa1"])["kind"], "underline");
}

#[test]
fn every_read_path_gives_the_same_marks_before_and_after() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    // the pencil lines were not marks before (nothing read them): take them out of the before, as they are not in it
    let before = reads(&w);
    w.ok(&["study", "move-marks", "--go"]);
    let mut after = reads(&w);
    // the two pencil lines are the only marks the move adds to what was shown
    let strip_pencil = |v: &mut Value| {
        for k in ["num", "at", "at12"] {
            let list = if k == "num" {
                &mut v[k]
            } else {
                &mut v[k]["marks"]
            };
            list.as_array_mut()
                .unwrap()
                .retain(|m| !m["id"].as_str().unwrap().starts_with("p_"));
        }
    };
    let total_before = before["find"]["groups"][0]["results"]
        .as_array()
        .map(|a| a.len());
    strip_pencil(&mut after);
    for key in ["num", "gen", "exod", "at", "at12"] {
        assert_eq!(before[key], after[key], "{key}");
    }
    assert_eq!(before["uses"], after["uses"]);
    // find and legend counts differ only by the two underlines
    let find_after = after["find"]["groups"][0]["results"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|m| !m["id"].as_str().unwrap().starts_with("p_"))
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(
        before["find"]["groups"][0]["results"].as_array().unwrap(),
        &find_after
    );
    assert_eq!(total_before, Some(find_after.len()));
    // the legend: every entry as before; the pencil's grey underline is the one new style in use
    assert_eq!(before["legend"]["entries"], after["legend"]["entries"]);
    // the whole-Bible map: the same chapters and gen/exod rows
    let rows = |v: &Value, book: &str| {
        v["map"]["books"].as_array().map(|b| {
            b.iter()
                .filter(|x| x["code"] == book)
                .cloned()
                .collect::<Vec<_>>()
        })
    };
    assert_eq!(rows(&before, "GEN"), rows(&after, "GEN"));
    assert_eq!(rows(&before, "EXO"), rows(&after, "EXO"));
}

#[test]
fn a_second_run_finds_nothing_and_changes_nothing() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    w.ok(&["study", "move-marks", "--go"]);
    let after = w.snapshot();
    let again = w.js(&["study", "move-marks", "--go"]);
    assert_eq!(again["totals"]["marks"], 0);
    assert_eq!(again["books"], json!([]));
    assert_eq!(after, w.snapshot());
    assert_eq!(dry(&w)["totals"]["marks"], 0);
    assert_eq!(
        w.js(&["study", "check"])["would_move_to_marks"]["totals"]["marks"],
        0
    );
}

#[test]
fn a_move_that_stopped_after_writing_marks_finishes_when_run_again() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    let hl = w
        .snapshot()
        .into_iter()
        .filter(|(k, _)| k.starts_with("highlights/") || k.starts_with("pencil/"))
        .collect::<BTreeMap<_, _>>();
    w.ok(&["study", "move-marks", "--go"]);
    // put the old files back, as if the archiving had not happened: the marks are written and identical
    for (k, v) in &hl {
        w.put(k, &String::from_utf8(v.clone()).unwrap());
    }
    let marks = w.read("marks/NUM.json");
    let d = dry(&w);
    assert_eq!(d["can_go"], true);
    assert_eq!(d["totals"]["marks"], 0);
    assert_eq!(d["totals"]["already_in_marks"], 5);
    w.ok(&["study", "move-marks", "--go"]);
    assert_eq!(w.read("marks/NUM.json"), marks);
    assert!(!w.exists("highlights/NUM.json"));
}

#[test]
fn a_different_file_already_in_the_archive_is_never_overwritten() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    w.put(".archive/highlights/NUM.json", "something else\n");
    let d = dry(&w);
    assert_eq!(d["can_go"], false);
    assert_eq!(d["conflicts"].as_array().unwrap().len(), 1);
    let before = w.snapshot();
    assert_ne!(w.run(&["study", "move-marks", "--go"]).0, 0);
    assert_eq!(before, w.snapshot());
}

#[test]
fn a_marks_file_that_cannot_be_read_is_never_written_over() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    w.put("marks/GEN.json", "{ broken");
    let d = dry(&w);
    assert_eq!(d["can_go"], false);
    assert!(d["unreadable"]
        .as_array()
        .unwrap()
        .iter()
        .any(|u| u["file"] == "marks/GEN.json"));
    assert_ne!(w.run(&["study", "move-marks", "--go"]).0, 0);
    assert_eq!(w.read("marks/GEN.json"), "{ broken");
}

#[test]
fn nothing_read_comes_from_the_archive() {
    let Some(w) = Wb::new() else { return };
    old_folder(&w);
    w.ok(&["study", "move-marks", "--go"]);
    let n = w.js(&["marks", "Num 25"])["marks"]
        .as_array()
        .unwrap()
        .len();
    // a copy put into the archive by hand adds no mark
    w.put(
        ".archive/highlights/EXO.json",
        &w.read(".archive/highlights/GEN.json"),
    );
    assert_eq!(
        w.js(&["marks", "Num 25"])["marks"]
            .as_array()
            .unwrap()
            .len(),
        n
    );
    assert_eq!(
        w.js(&["marks", "Gen 1"])["marks"].as_array().unwrap().len(),
        1
    );
    assert_eq!(w.js(&["study", "check"])["highlight_files"], 0);
}
