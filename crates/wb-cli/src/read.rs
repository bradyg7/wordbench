//! Reading and looking things up: the Python `wb`'s commands of the same names, with the same output.

use crate::args::{Args, Flag, Opt, Pos, N};
use crate::{cmd, Command, Ctx, Out, Res};
use serde_json::{json, Map, Value};
use wb_core::{concordance, lookup, scripture, views};

fn e(x: wb_core::Error) -> String {
    x.0
}

fn strong_term(term: &str) -> String {
    if lookup::is_strong(&term.to_uppercase()) { term.to_uppercase() } else { String::new() }
}

fn some(s: &str) -> Option<&str> {
    if s.is_empty() { None } else { Some(s) }
}

pub fn commands() -> Vec<Command> {
    vec![
        cmd("status", "Where everything is: the Bible database (read-only), the study folder, the cache of derived indexes.", vec![], |c, _| {
            let db = wb_core::default_db_path();
            let study = wb_core::default_study_dir();
            let st = wb_core::store::Store::open(&study);
            Ok(Out::Json(json!({
                "bible": {"path": db.display().to_string(), "found": db.exists(), "signature": c.bible().map(|b| b.signature().to_string()).ok()},
                "study": {"root": study.display().to_string(), "available": st.is_ok(), "error": st.as_ref().err().map(|e| e.0.clone()),
                    "notes": st.as_ref().map(|s| s.notes().len()).ok(), "threads": st.as_ref().map(|s| s.threads().len()).ok(),
                    "trails": st.as_ref().map(|s| s.trails().len()).ok()},
                "cache": wb_core::cache::dir().display().to_string(),
            })))
        }),
        cmd("books", "The 66 books: id, code, name, chapters, testament.", vec![], |c, _| {
            let b = c.bible()?;
            Ok(Out::Json(json!({"books": lookup::books(b), "versions": lookup::versions(b).map_err(e)?})))
        }),
        cmd("text", "Scripture, verbatim, with its reference: wb text \"John 3:16-18\" [--version ylt]. Several places: \"John 3:16; Rom 5:8\".",
            vec![Pos("ref", N::Many), Opt("version", Some("KJV")), Flag("lines")], text),
        // The app's own (not in the Python wb): what a scripture block and the verse card draw.
        cmd("scripture", "Verses as a scripture block and the verse card show them (JSON): wb text's verses, each also as runs of its words with the highlights on them. wb scripture \"Num 25:10-13\" [--version ylt].",
            vec![Pos("ref", N::Many), Opt("version", Some("KJV"))], |c, a| {
                Ok(Out::Json(scripture::marked(c.bible()?, &*c.study()?, &a.s("ref"), &a.opt_or("version", "KJV")).map_err(e)?))
            }),
        cmd("copy", "Put verses on the clipboard with their reference, and print them: wb copy \"John 3:16-18\" --format quote.\n\
                     Formats: lines (the default), block, para, quote.",
            vec![Pos("ref", N::Many), Opt("format", Some("lines")), Opt("version", Some("KJV")), Flag("short"), Flag("no_clip")], copy),
        cmd("preview", "What a hover card shows, as text: a verse reference (at most 6 verses) or a Strong's number.",
            vec![Pos("place", N::Many), Opt("version", Some("KJV"))], preview),
        cmd("chapter", "A chapter's KJV words with their Strong's numbers (word by word): wb chapter John 3.", vec![Pos("ref", N::Many)], |c, a| {
            let s = c.span(&a.s("ref"))?;
            if s.c1 != s.c2 && s.v1 == 0 {
                return Err("One chapter at a time, like: wb chapter John 3".into());
            }
            Ok(Out::Json(lookup::chapter(c.bible()?, s.book.id, s.c1).map_err(e)?.ok_or("no such chapter")?))
        }),
        cmd("strong", "A lexicon entry for a Strong's number (H7065, G26). --next / --prev: the entry after or before it in number order; --list hebrew|greek [--from H7068]: the entries in number order, a page from a number.",
            vec![Pos("number", N::Opt), Flag("next"), Flag("prev"), Opt("list", None), Opt("from", None)], |c, a| {
                if let Some(lang) = a.opt("list") {
                    return Ok(Out::Json(concordance::list(c.bible()?, &lang, a.opt("from").as_deref()).map_err(e)?));
                }
                if a.s("number").is_empty() {
                    return Err("Give a Strong's number like H7065, or --list hebrew|greek.".into());
                }
                if a.flag("next") || a.flag("prev") {
                    if a.flag("next") && a.flag("prev") {
                        return Err("Give --next or --prev, not both.".into());
                    }
                    return Ok(Out::Json(concordance::neighbour(c.bible()?, &a.s("number"), a.flag("next")).map_err(e)?));
                }
                Ok(Out::Json(lookup::strong(c.bible()?, &a.s("number").to_uppercase()).map_err(e)?.ok_or("no such Strong's number")?))
            }),
        // The Concordance (design/features/concordance): the printed Strong's as a book.
        cmd("concordance", "The English page of the Concordance: every place of a word in Bible order, with words either side and the original word's number: wb concordance zeal [--forms all|one] [--book NUM].
                     --forms: all (zeal, zealous, zealously) or one (the word alone); without it, the kept choice (wb settings concordance forms). More than 100 places are shown under their books, 4 lines each and \"more\"; the commonest small words (and, the, of) with references only. --book: that book's every line.",
            vec![Pos("word", N::One), Opt("forms", None), Opt("book", None)], |c, a| {
                let mode = match a.opt("forms") {
                    Some(m) => m,
                    None => wb_core::concordance::forms_mode(&*c.study()?),
                };
                Ok(Out::Json(concordance::page(c.bible()?, &a.s("word"), &mode.to_lowercase(), a.opt("book").as_deref()).map_err(e)?))
            }),
        // Cross references (notebook row 52, proposed): the app has no source for them, so none is listed and the answer says so.
        cmd("xrefs", "The cross references of a place: wb xrefs Num 25:11. The app has no cross-reference source yet, so none is listed: {\"place\", \"count\": 0, \"references\": [], \"source\": null, \"message\"}. Proposed; a source is chosen first.",
            vec![Pos("ref", N::Many)], |c, a| Ok(Out::Json(wb_core::studyblocks::xrefs(c.bible()?, &a.s("ref")).map_err(e)?))),
        cmd("concordance box", "What the Concordance's one box suggests for what is typed: a Strong's number (NUMBER), English forms with counts, original words whose definition holds it, and sounds-alike (at most 3 rows each): wb concordance box zea.",
            vec![Pos("text", N::Many)], |c, a| Ok(Out::Json(concordance::suggest(c.bible()?, &a.s("text")).map_err(e)?))),
        cmd("concordance letters", "The letter strip: for each letter a to z, how many English words start with it and their places (x has none): wb concordance letters.",
            vec![], |c, _| Ok(Out::Json(concordance::letters(c.bible()?).map_err(e)?))),
        cmd("bdb", "Brown-Driver-Briggs for a Hebrew or Aramaic number (H7065), with the source file's own status.", vec![Pos("number", N::One)], |c, a| {
            Ok(Out::Json(lookup::bdb(c.bible()?, &a.s("number").to_uppercase()).map_err(e)?))
        }),
        cmd("define", "The original words behind an English word, or a Strong's number, transliteration or spelling.", vec![Pos("word", N::One)], |c, a| {
            Ok(Out::Json(lookup::define(c.bible()?, &a.s("word")).map_err(e)?))
        }),
        cmd("uses", "Every occurrence of an English word and/or Strong's number: wb uses zeal --scope gospels  |  wb uses H7065 --word zealous.",
            vec![Pos("term", N::One), Opt("word", None), Opt("scope", Some("all")), Opt("rendering", None), Opt("cat", Some("all")), Opt("offset", Some("0")), Opt("by", None), Opt("group", None), Opt("around", None)], uses),
        cmd("count", "How many occurrences in each book: wb count zeal  |  wb count H7065.", vec![Pos("term", N::One)], count),
        cmd("search", "Search the KJV (every word must be in the verse; \"quotes\" for a phrase; zeal* for endings).",
            vec![Pos("query", N::Many), Opt("scope", Some("all")), Flag("case"), Flag("regex"), Opt("offset", Some("0"))], |c, a| {
                let scope = c.scope(&a.opt_or("scope", "all"))?;
                let q = a.s("query");
                Ok(Out::Json(lookup::search(c.bible()?, &lookup::SearchQuery { q: &q, case: a.flag("case"), scope: &scope,
                    offset: a.int("offset")?.max(0) as usize, limit: lookup::PAGE, regex: a.flag("regex") }).map_err(e)?))
            }),
        cmd("forms", "Every English form that starts with a word (zeal, zealous, zealously) with its count.", vec![Pos("word", N::One)], |c, a| {
            Ok(Out::Json(lookup::forms(c.bible()?, &a.s("word")).map_err(e)?))
        }),
        cmd("lexiconc", "Original words whose Strong's definition or KJV-usage line contains an English word (zeal* for endings).", vec![Pos("word", N::One)], |c, a| {
            Ok(Out::Json(lookup::lexiconc(c.bible()?, &a.s("word"), 150).map_err(e)?))
        }),
        cmd("near", "Verses where two words (or Strong's numbers) come within N words of each other.",
            vec![Pos("a", N::One), Pos("b", N::One), Opt("within", Some("10")), Opt("scope", Some("all")), Opt("offset", Some("0"))], |c, a| {
                let scope = c.scope(&a.opt_or("scope", "all"))?;
                Ok(Out::Json(lookup::near(c.bible()?, &a.s("a"), &a.s("b"), a.int("within")?, &scope, a.int("offset")?.max(0) as usize, lookup::PAGE).map_err(e)?))
            }),
        cmd("interlinear", "The Greek or Hebrew word by word with the KJV above it: wb interlinear John 3:16.",
            vec![Pos("ref", N::Many), Opt("offset", Some("0"))], |c, a| {
                let s = c.span(&a.s("ref"))?;
                let c2 = if s.c2 != s.c1 { Some(s.c2) } else { None };
                Ok(Out::Json(lookup::interlinear(c.bible()?, s.book.id, s.c1, s.v1 as i64, c2, s.v2 as i64, a.int("offset")?, lookup::INTERLINEAR_VERSES).map_err(e)?))
            }),
        // The app's own (not in the Python wb): an English word's definition, Webster's 1913, verbatim (docs/archive/2026-11-10/docs/redesign-R5.md).
        cmd("word-define", "A word's English definition from Webster's 1913 (public domain), verbatim with its source: wb word-define envious.
                     --verse \"Prov 14:30\": the words of a place that have an entry. --source: which dictionary, its licence and where it came from.",
            vec![Pos("word", N::Any), Opt("verse", None), Flag("source")], word_define),
        // The app's own views (not in the Python wb): what the reader, the word sheet and the verse sheet show.
        cmd("reader", "What the reader draws for a chapter: its words and the marks on them (JSON): wb reader NUM 25 [--version ylt]. Another version than the KJV shows the marks on whole verses only.",
            vec![Pos("book", N::One), Pos("ch", N::One), Opt("version", Some("KJV"))], |c, a| {
            let (b, ch) = book_ch(a)?;
            Ok(Out::Json(json!(views::reader_in(c.bible()?, &*c.study()?, &b, ch, &a.opt_or("version", "KJV")).map_err(e)?)))
        }),
        cmd("word", "What the word sheet shows: wb word NUM 25 11 24 (word 24, from 0, of Numbers 25:11).",
            vec![Pos("book", N::One), Pos("ch", N::One), Pos("v", N::One), Pos("i", N::One)], |c, a| {
                let (b, ch) = book_ch(a)?;
                let n = |k: &str| a.s(k).parse::<u32>().map_err(|_| format!("{k} must be a number"));
                Ok(Out::Json(json!(views::word(c.bible()?, &*c.study()?, &b, ch, n("v")?, n("i")?).map_err(e)?)))
            }),
        cmd("verse", "What the verse sheet shows: wb verse NUM 25 11.", vec![Pos("book", N::One), Pos("ch", N::One), Pos("v", N::One)], |c, a| {
            let (b, ch) = book_ch(a)?;
            let v = a.s("v").parse::<u32>().map_err(|_| "v must be a number")?;
            Ok(Out::Json(json!(views::verse(c.bible()?, &*c.study()?, &b, ch, v).map_err(e)?)))
        }),
        cmd("fixture", "The reader, every word sheet and every verse sheet of a chapter in one JSON (the UI's test data): wb fixture NUM 25.",
            vec![Pos("book", N::One), Pos("ch", N::One)], fixture),
    ]
}

fn book_ch(a: &Args) -> Result<(String, u32), String> {
    Ok((a.s("book").to_uppercase(), a.s("ch").parse().map_err(|_| "the chapter must be a number")?))
}

fn text(c: &Ctx<'_>, a: &Args) -> Res {
    let psg = scripture::passage(c.bible()?, &a.s("ref"), &a.opt_or("version", "KJV")).map_err(e)?;
    if a.flag("json") {
        return Ok(Out::Json(psg));
    }
    if a.flag("lines") {
        let vs = psg["verses"].as_array().unwrap();
        return Ok(Out::Text(vs.iter().map(|v| format!("{} {}", v["ref"].as_str().unwrap(), v["text"].as_str().unwrap())).collect::<Vec<_>>().join("\n")));
    }
    Ok(Out::Text(scripture::block(&psg)))
}

fn copy(c: &Ctx<'_>, a: &Args) -> Res {
    let mut out = scripture::copy(c.bible()?, &a.s("ref"), &a.opt_or("version", "KJV"), &a.opt_or("format", "lines"), a.flag("short")).map_err(e)?;
    if !a.flag("no_clip") {
        let clipped = clip(out["text"].as_str().unwrap());
        out["clipped"] = json!(clipped);
        if !clipped {
            eprintln!("note: this computer's clipboard could not be reached, so the text is only printed.");
        }
    }
    if a.flag("json") {
        return Ok(Out::Json(out));
    }
    Ok(Out::Text(out["text"].as_str().unwrap().to_string()))
}

/// The text on the clipboard. Windows: PowerShell's Set-Clipboard, which takes Unicode from standard input.
fn clip(text: &str) -> bool {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let child = if cfg!(windows) {
        Command::new("powershell")
            .args(["-NoProfile", "-Command", "[Console]::InputEncoding=[Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("pbcopy").stdin(Stdio::piped()).spawn()
    } else {
        Command::new("wl-copy").stdin(Stdio::piped()).spawn()
    };
    let Ok(mut child) = child else { return false };
    if child.stdin.take().map(|mut s| s.write_all(text.as_bytes())).is_none() {
        return false;
    }
    child.wait().map(|s| s.success()).unwrap_or(false)
}

fn preview(c: &Ctx<'_>, a: &Args) -> Res {
    let d = scripture::preview(c.bible()?, &a.s("place"), &a.opt_or("version", "KJV"), scripture::PREVIEW_VERSES).map_err(e)?;
    if a.flag("json") {
        return Ok(Out::Json(d));
    }
    let s = |v: &Value| match v {
        Value::Null => "None".to_string(),
        Value::String(s) => s.clone(),
        other => other.to_string(),
    };
    if d["kind"] == "strong" {
        let usage = if d["usage"].as_str().is_some_and(|u| !u.is_empty()) { format!("KJV: {}", s(&d["usage"])) } else { String::new() };
        let parts = [format!("{} {} {}", s(&d["strong"]), s(&d["lemma"]), s(&d["translit"])), if d["definition"].is_null() { String::new() } else { s(&d["definition"]) }, usage];
        return Ok(Out::Text(parts.into_iter().filter(|x| !x.is_empty()).collect::<Vec<_>>().join("\n")));
    }
    let more = d["more"].as_u64().unwrap_or(0);
    let lines: Vec<String> = d["verses"].as_array().unwrap().iter().map(|v| format!("{} {}", s(&v["ref"]), s(&v["text"]))).collect();
    Ok(Out::Text(format!("{} ({})\n{}{}", s(&d["label"]), s(&d["version"]), lines.join("\n"), if more > 0 { format!("\n... and {more} more") } else { String::new() })))
}

fn uses(c: &Ctx<'_>, a: &Args) -> Res {
    let term = a.s("term");
    let strong = strong_term(&term);
    if let Some(by) = a.opt("by") {
        if strong.is_empty() {
            return Err("--by groups an original word's places: give a Strong's number like H7068 (an English word's page is wb concordance).".into());
        }
        let around = match a.opt("around") {
            Some(n) => n.parse::<usize>().map_err(|_| "--around is a number of words")?,
            None => concordance::AROUND,
        };
        return Ok(Out::Json(concordance::entry_places(c.bible()?, &strong, &by.to_lowercase(), a.opt("group").as_deref(), around).map_err(e)?));
    }
    let word = a.opt("word").unwrap_or_else(|| if strong.is_empty() { term.to_lowercase() } else { String::new() });
    let scope = c.scope(&a.opt_or("scope", "all"))?;
    let rendering = a.opt("rendering").unwrap_or_default();
    let q = lookup::UsesQuery { strong: some(&strong), word: some(&word), cat: &a.opt_or("cat", "all"), scope: &scope,
        offset: a.int("offset")?.max(0) as usize, limit: lookup::PAGE, rendering: some(&rendering) };
    Ok(Out::Json(lookup::uses(c.bible()?, &q).map_err(e)?))
}

fn count(c: &Ctx<'_>, a: &Args) -> Res {
    let term = a.s("term");
    let strong = strong_term(&term);
    let word = if strong.is_empty() { term.to_lowercase() } else { String::new() };
    let d = lookup::uses(c.bible()?, &lookup::UsesQuery { strong: some(&strong), word: some(&word), cat: "all", scope: "all", offset: 1_000_000, limit: lookup::PAGE, rendering: None }).map_err(e)?;
    let books = c.bible()?.books();
    let mut by: Vec<(u32, i64)> = d["by_book"].as_object().unwrap().iter().map(|(k, n)| (k.parse().unwrap(), n.as_i64().unwrap())).collect();
    by.sort_by_key(|x| x.0);
    let by_book: Map<String, Value> = by.into_iter().map(|(id, n)| (books.iter().find(|b| b.id == id).unwrap().name.clone(), json!(n))).collect();
    Ok(Out::Json(json!({"term": term, "occurrences": d["occurrences"], "verses": d["verses"], "by_book": by_book})))
}

fn fixture(c: &Ctx<'_>, a: &Args) -> Res {
    let (b, ch) = book_ch(a)?;
    let st = c.study()?;
    let (bible, study) = (c.bible()?, &*st);
    let reader = views::reader(bible, study, &b, ch).map_err(e)?;
    let mut words = Map::new();
    let mut verses = Map::new();
    for v in &reader.chapter.verses {
        verses.insert(v.v.to_string(), json!(views::verse(bible, study, &b, ch, v.v).map_err(e)?));
        for w in &v.words {
            words.insert(format!("{}.{}", v.v, w.i), json!(views::word(bible, study, &b, ch, v.v, w.i).map_err(e)?));
        }
    }
    Ok(Out::Text(json!({"reader": reader, "words": words, "verses": verses}).to_string()))
}

/// `wb word-define`: the dictionary's entries (never a pick of one sense for a verse).
fn word_define(c: &Ctx<'_>, a: &Args) -> Res {
    let d = wb_core::dictionary::Dictionary::open(&wb_core::dictionary::default_path()).map_err(e)?;
    let source = d.source().map_err(e)?;
    if a.flag("source") {
        return Ok(Out::Json(json!({ "source": source })));
    }
    if let Some(place) = a.opt("verse") {
        let span = c.span(&place)?;
        let words: Vec<Value> = d
            .words_of(c.bible()?, &span)
            .map_err(e)?
            .into_iter()
            .map(|(w, en)| match en {
                Some(en) => json!({"word": w, "headword": en.headword, "text": en.text}),
                None => json!({"word": w}),
            })
            .collect();
        return Ok(Out::Json(json!({ "place": place, "source": source, "words": words })));
    }
    let word = a.s("word");
    if word.is_empty() {
        return Err("Give a word, like: wb word-define envious".into());
    }
    Ok(Out::Json(match d.entry(&word).map_err(e)? {
        Some(en) => json!({"word": en.word, "found": true, "headword": en.headword, "text": en.text, "source": source}),
        None => json!({"word": word, "found": false, "source": source}),
    }))
}
