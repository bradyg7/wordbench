//! `wb`: Bible Workbench from a terminal. Phase 0 has the commands the reader spike uses; phase 1 brings the Python
//! app's full set (`wb help` there).

use serde_json::json;
use wb_core::{bible::Bible, marks, study::Study, views};

const HELP: &str = "wb: Bible Workbench (Rust, phase 0)

  wb text <place>              verbatim scripture with its reference (\"Num 25:11\", \"Numbers 25\", \"Num 25:10-13\")
  wb chapter <BOOK> <n>        a chapter's words as JSON (what the reader draws)
  wb marks <BOOK> <n>          highlights, notes and thread places on a chapter, from the study folder (JSON)
  wb reader <BOOK> <n>         chapter and marks together (JSON; the UI's test fixture is made with it)
  wb word <BOOK> <ch> <v> <i>  what the word sheet shows (word i, 0-based, of a verse) (JSON)
  wb verse <BOOK> <ch> <v>     what the verse sheet shows (JSON)
  wb fixture <BOOK> <ch>       reader, every word sheet and verse sheet of a chapter in one JSON (the UI's test data)
  wb strong <H7065|G26>        a lexicon entry (JSON)
  wb count <H7065|G26>         how often a Strong's number is used in the KJV (JSON)
  wb books                     the books (JSON)

  WB_BIBLE_DB   the Bible database (read-only)      WB_STUDY_DIR   the study folder (a scratch copy)";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(e) = run(&args) {
        eprintln!("wb: {e}");
        std::process::exit(1);
    }
}

fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let cmd = args.first().map(String::as_str).unwrap_or("help");
    let rest = &args[args.len().min(1)..];
    let bible = || Bible::open(&wb_core::default_db_path());
    let study = || Study::open(&wb_core::default_study_dir());
    let chapter_args = || -> Result<(String, u32), Box<dyn std::error::Error>> {
        match rest {
            [b, c, ..] => Ok((b.to_uppercase(), c.parse()?)),
            _ => Err(format!("usage: wb {cmd} <BOOK> <chapter>").into()),
        }
    };
    let print = |v: serde_json::Value| println!("{}", serde_json::to_string_pretty(&v).unwrap());
    match cmd {
        "text" => {
            let p = bible()?.passage(&rest.join(" "))?;
            let one = p.verses.len() == 1;
            for (_, v, text) in &p.verses {
                if one {
                    println!("{text}");
                } else {
                    println!("{v} {text}");
                }
            }
            println!("({} KJV)", p.reference);
        }
        "chapter" => {
            let (b, c) = chapter_args()?;
            print(json!(bible()?.chapter(&b, c)?));
        }
        "marks" => {
            let (b, c) = chapter_args()?;
            print(json!(marks::chapter_marks(&study()?, &b, c)?));
        }
        "reader" => {
            let (b, c) = chapter_args()?;
            print(json!({"chapter": bible()?.chapter(&b, c)?, "marks": marks::chapter_marks(&study()?, &b, c)?}));
        }
        "word" => {
            let (b, c) = chapter_args()?;
            let n = |k: usize| -> Result<u32, Box<dyn std::error::Error>> { Ok(rest.get(k).ok_or("usage: wb word <BOOK> <ch> <v> <i>")?.parse()?) };
            print(json!(views::word(&bible()?, &study()?, &b, c, n(2)?, n(3)?)?));
        }
        "verse" => {
            let (b, c) = chapter_args()?;
            let v: u32 = rest.get(2).ok_or("usage: wb verse <BOOK> <ch> <v>")?.parse()?;
            print(json!(views::verse(&bible()?, &study()?, &b, c, v)?));
        }
        "fixture" => {
            let (b, c) = chapter_args()?;
            let (bible, study) = (bible()?, study()?);
            let reader = views::reader(&bible, &study, &b, c)?;
            let mut words = serde_json::Map::new();
            let mut verses = serde_json::Map::new();
            for v in &reader.chapter.verses {
                verses.insert(v.v.to_string(), json!(views::verse(&bible, &study, &b, c, v.v)?));
                for w in &v.words {
                    words.insert(format!("{}.{}", v.v, w.i), json!(views::word(&bible, &study, &b, c, v.v, w.i)?));
                }
            }
            println!("{}", json!({"reader": reader, "words": words, "verses": verses}));
        }
        "strong" => {
            let s = rest.first().ok_or("usage: wb strong <H7065>")?.to_uppercase();
            print(json!(bible()?.lexicon(&s)?.ok_or(format!("No lexicon entry {s}"))?));
        }
        "count" => {
            let s = rest.first().ok_or("usage: wb count <H7065>")?.to_uppercase();
            print(json!(bible()?.count(&s)?));
        }
        "books" => print(json!(bible()?.books())),
        "help" | "-h" | "--help" => println!("{HELP}"),
        other => return Err(format!("unknown command {other:?} (wb help)").into()),
    }
    Ok(())
}
