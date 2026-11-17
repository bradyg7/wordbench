//! The Concordance (design/features/concordance, "What the build must satisfy"): the `wb` commands behind the book, run on
//! a scratch study folder. No scripture is typed here: every line is compared with `wb text` or with another `wb` answer.

use serde_json::Value;
use std::path::PathBuf;
use std::process::{Command, Stdio};

struct Wb {
    dir: PathBuf,
}

impl Wb {
    fn new() -> Option<Wb> {
        if !wb_core::default_db_path().exists() {
            eprintln!("no Bible database: skipped");
            return None;
        }
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let dir = std::env::temp_dir().join("bible-workbench-rs").join("concordance-tests").join(format!("{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Some(Wb { dir })
    }

    fn run(&self, args: &[&str]) -> (i32, String, String) {
        let out = Command::new(env!("CARGO_BIN_EXE_wb"))
            .args(args)
            .env("WB_STUDY_DIR", &self.dir)
            .env("WB_NO_OPEN", "1")
            .stdin(Stdio::null())
            .output()
            .unwrap();
        (out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).into(), String::from_utf8_lossy(&out.stderr).into())
    }

    fn js(&self, args: &[&str]) -> Value {
        let (code, out, err) = self.run(args);
        assert_eq!(code, 0, "wb {args:?}: {err}");
        serde_json::from_str(&out).unwrap_or_else(|e| panic!("wb {args:?}: {e}: {out}"))
    }

    fn err(&self, args: &[&str]) -> String {
        let (code, _, err) = self.run(args);
        assert_ne!(code, 0, "wb {args:?} should fail");
        err
    }
}

impl Drop for Wb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn n(v: &Value) -> usize {
    v.as_u64().unwrap() as usize
}

/// `before + word + after` of a line, as the page draws it.
fn read(l: &Value) -> String {
    format!("{}{}{}", l["before"].as_str().unwrap(), l["word"].as_str().unwrap(), l["after"].as_str().unwrap())
}

fn squash(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[test]
fn the_english_page_for_a_word_is_the_places_of_wb_uses() {
    let Some(wb) = Wb::new() else { return };
    // typing zeal lists what wb forms lists, with the same counts
    let forms = wb.js(&["forms", "zea"]);
    let boxed = wb.js(&["concordance", "box", "zea"]);
    assert_eq!(boxed["english"], forms["forms"]);
    assert_eq!(forms["forms"][0]["form"], "zeal");
    assert_eq!(forms["forms"][0]["n"], 16);
    // the page of zeal alone: one run, no book headings, 16 places in Bible order, each with its words around it
    let p = wb.js(&["concordance", "zeal", "--forms", "one"]);
    assert_eq!((p["kind"].as_str().unwrap(), n(&p["places"])), ("run", 16));
    assert!(p.get("groups").is_none());
    let uses = wb.js(&["uses", "zeal"]);
    let refs: Vec<String> = p["lines"].as_array().unwrap().iter().map(|l| l["ref"].as_str().unwrap().to_string()).collect();
    let used: Vec<String> = uses["rows"].as_array().unwrap().iter().map(|r| format!("{} {}:{}", r["ref"]["name"].as_str().unwrap(), r["ref"]["c"], r["ref"]["v"])).collect();
    assert_eq!(refs, used);
    for l in p["lines"].as_array().unwrap() {
        assert_eq!(l["word"].as_str().unwrap().to_lowercase(), "zeal");
        assert!(l["strong"].as_str().unwrap().starts_with(['H', 'G']), "its number: {l}");
        // the words around the marked word are the verse's own, in the verse's own order
        let text = wb.run(&["text", l["ref"].as_str().unwrap(), "--lines"]).1;
        assert!(squash(&text).contains(squash(&read(l)).trim()), "{} is not in {}", read(l), text);
    }
    // All forms: zeal, zealous and zealously together
    let all = wb.js(&["concordance", "zeal", "--forms", "all"]);
    assert_eq!(n(&all["places"]), 16 + 8 + 2);
    assert_eq!(all["words"].as_array().unwrap().len(), 3);
    // the other forms, as buttons at the foot of a word's own page (the picked word)
    let alone = wb.js(&["concordance", "zealous", "--forms", "one"]);
    assert_eq!(n(&alone["places"]), 8);
    let forms = alone["forms"].as_array().unwrap();
    assert_eq!(forms.iter().map(|f| (f["form"].as_str().unwrap(), n(&f["n"]))).collect::<Vec<_>>(), [("zealous", 8), ("zeal", 16), ("zealously", 2)]);
}

#[test]
fn a_long_word_is_under_its_books_and_a_small_word_has_references_only() {
    let Some(wb) = Wb::new() else { return };
    let heart = wb.js(&["concordance", "heart", "--forms", "one"]);
    assert_eq!((heart["kind"].as_str().unwrap(), n(&heart["places"])), ("books", 830));
    let groups = heart["groups"].as_array().unwrap();
    assert_eq!(groups.len(), 54);
    let counted = wb.js(&["count", "heart"]);
    let by = counted["by_book"].as_object().unwrap();
    let mut last = String::new();
    for g in groups {
        assert_eq!(g["count"], by[g["name"].as_str().unwrap()], "{}", g["name"]);
        assert_eq!(g["lines"].as_array().unwrap().len(), n(&g["count"]).min(4));
        assert_eq!(n(&g["more"]), n(&g["count"]).saturating_sub(4));
        // Bible order
        assert_ne!(g["code"].as_str().unwrap(), last);
        last = g["code"].as_str().unwrap().to_string();
    }
    assert_eq!(groups.iter().map(|g| n(&g["count"])).sum::<usize>(), 830);
    // "N more" shows the rest of that book
    let psa = wb.js(&["concordance", "heart", "--forms", "one", "--book", "PSA"]);
    let g = &psa["groups"][0];
    assert_eq!((n(&g["count"]), g["lines"].as_array().unwrap().len(), n(&g["more"])), (123, 123, 0));
    // a small word: references only, no words around them
    let and = wb.js(&["concordance", "and"]);
    assert_eq!(and["kind"], "refs");
    let first = &and["groups"][0]["lines"][0];
    assert!(first.get("before").is_none() && first.get("word").is_none() && first["ref"].is_string());
}

#[test]
fn the_forms_choice_is_kept_and_the_click_choice_takes_only_its_words() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["concordance", "zeal"])["mode"], "all");
    wb.js(&["settings", "concordance", "forms", "one"]);
    // closing and reopening the window: the next page is This word
    assert_eq!(wb.js(&["concordance", "zeal"])["mode"], "one");
    assert!(wb.err(&["settings", "concordance", "forms", "both"]).contains("all or one"));
    wb.js(&["settings", "concordance", "forms", "default"]);
    assert_eq!(wb.js(&["concordance", "zeal"])["mode"], "all");
    assert_eq!(wb.js(&["settings", "reading", "word-click", "concordance"])["word-click"], "concordance");
    assert!(wb.err(&["settings", "reading", "word-click", "pane"]).contains("card or concordance"));
    wb.js(&["settings", "reading", "word-click", "card"]);
}

#[test]
fn the_dictionaries_are_in_number_order_and_list_every_place() {
    let Some(wb) = Wb::new() else { return };
    assert_eq!(wb.js(&["strong", "H7068", "--next"])["strong"], "H7069");
    assert_eq!(wb.js(&["strong", "H7068", "--prev"])["strong"], "H7067");
    assert!(wb.js(&["strong", "H1", "--prev"])["strong"].is_null());
    let list = wb.js(&["strong", "--list", "hebrew", "--from", "H7068"]);
    assert_eq!(list["entries"][0]["strong"], "H7068");
    assert_eq!(list["entries"][1]["strong"], "H7069");
    assert_eq!(wb.js(&["strong", "--list", "greek"])["entries"][0]["strong"], "G1");
    // every occurrence, by the English it is rendered by: the entry's own rendering counts (H7068: jealousy 24)
    let entry = wb.js(&["strong", "H7068"]);
    let w = wb.js(&["uses", "H7068", "--by", "word"]);
    assert_eq!(w["occurrences"], entry["occurrences"]);
    let renderings = entry["renderings"].as_array().unwrap();
    let groups = w["groups"].as_array().unwrap();
    assert_eq!(groups.len(), renderings.len());
    for (g, r) in groups.iter().zip(renderings) {
        assert_eq!((g["label"].as_str().unwrap(), g["count"].as_u64()), (r["w"].as_str().unwrap(), r["n"].as_u64()));
        assert!(g["lines"].as_array().unwrap().len() <= 4);
    }
    assert_eq!((groups[0]["label"].as_str().unwrap(), n(&groups[0]["count"])), ("jealousy", 24));
    // and by book, in Bible order, the counts summing to the entry's
    let b = wb.js(&["uses", "H7068", "--by", "book"]);
    assert_eq!(b["groups"].as_array().unwrap().iter().map(|g| n(&g["count"])).sum::<usize>(), n(&entry["occurrences"]));
    assert_eq!(b["groups"][0]["key"], "NUM");
    // a group's rest
    let rest = wb.js(&["uses", "H7068", "--by", "word", "--group", "jealousy"]);
    assert_eq!(rest["groups"][0]["lines"].as_array().unwrap().len(), 24);
    assert!(wb.err(&["uses", "zeal", "--by", "word"]).contains("Strong's number"));
}

#[test]
fn the_box_shows_numbers_sounds_and_letters_only_where_they_apply() {
    let Some(wb) = Wb::new() else { return };
    let num = wb.js(&["concordance", "box", "H7068"]);
    assert_eq!(num["number"].as_array().unwrap().len(), 1);
    assert_eq!(num["number"][0]["strong"], "H7068");
    assert_eq!(num["number"][0]["occurrences"], 43);
    assert!(num["sounds"].as_array().unwrap().is_empty());
    let sound = wb.js(&["concordance", "box", "kanna"]);
    assert_eq!(sound["sounds"][0]["strong"], wb.js(&["define", "kanna"])["original"][0]["strong"]);
    assert_eq!(sound["sounds"][0]["strong"], "H3657");
    assert!(sound["number"].as_array().unwrap().is_empty());
    let zea = wb.js(&["concordance", "box", "zea"]);
    assert!(zea["number"].as_array().unwrap().is_empty() && zea["sounds"].as_array().unwrap().is_empty());
    for k in ["number", "sounds"] {
        assert!(sound[k].as_array().unwrap().len() <= 3);
    }
    // the letter strip: j has 386 words and 7,805 places; x has none and is dimmed
    let letters = wb.js(&["concordance", "letters"]);
    let of = |c: &str| letters["letters"].as_array().unwrap().iter().find(|l| l["letter"] == c).unwrap().clone();
    assert_eq!((n(&of("j")["words"]), n(&of("j")["places"])), (386, 7805));
    assert_eq!(n(&of("x")["words"]), 0);
    assert_eq!(wb.js(&["forms", "j"])["forms"].as_array().unwrap().len(), 386);
}
