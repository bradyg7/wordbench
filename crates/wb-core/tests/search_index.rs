//! The Python app's tests/test_search_index.py, carried over: the search index gives exactly what testing every verse
//! gives, in the same order, for every kind of query (these are search queries, not scripture).

#[expect(
    dead_code,
    reason = "shared test helpers: each test binary uses only some of them"
)]
mod common;

use wb_core::lookup::{search, search_every_verse, SearchQuery};

const QUERIES: &[&str] = &[
    "so loved",
    "zeal*",
    "zeal",
    "ZEAL",
    "\"the LORD\"",
    "\"zealous for my sake\"",
    "grace truth",
    "truth grace",
    "the",
    "a",
    "love*",
    "o'er",
    "mother-in-law",
    "mother-in-law*",
    "*ing",
    "zeal*ous",
    "lo*e",
    "son of",
    "Phinehas",
    "phinehas*",
    "H7065",
    "1 Corinthians",
    "in the beginning",
    "\"in the beginning\"",
    "Jesus wept",
    "wept*",
    "zzzznotaword",
    "grace* truth*",
    "God* love*",
    "he said",
    "i am",
    "’",
    "love, joy",
    "\"love, joy\"",
    "thou shalt not",
    "shalt*",
    "-",
    "kings*",
];

#[test]
fn every_kind_of_query_gives_the_same_verses_spans_and_counts() {
    let Some(b) = common::bible() else { return };
    for q in QUERIES {
        for case in [false, true] {
            // every verse once per query; each scope is a choice of books from it (the NT is books 40 to 66)
            let every = search_every_verse(&b, q, case, "all");
            for scope in ["all", "NT", "43", "40,41,42,43"] {
                let keep = |book: u32| match scope {
                    "all" => true,
                    "NT" => book >= 40,
                    "43" => book == 43,
                    _ => (40..=43).contains(&book),
                };
                let want = every
                    .as_ref()
                    .map(|(rows, by)| {
                        (
                            rows.iter()
                                .filter(|r| keep(r.0))
                                .cloned()
                                .collect::<Vec<_>>(),
                            by.clone(),
                        )
                    })
                    .map_err(|e| e.0.clone());
                let got = search(
                    &b,
                    &SearchQuery {
                        q,
                        case,
                        scope,
                        offset: 0,
                        limit: 1_000_000,
                        regex: false,
                    },
                );
                let (Ok((want, by_book)), Ok(got)) = (want, got.as_ref()) else {
                    assert!(
                        got.is_err(),
                        "{q:?}: the index answered where the reference refused"
                    );
                    continue;
                };
                type Row = (u32, u32, u32, Vec<(usize, usize)>);
                let rows: Vec<Row> = got["rows"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|r| {
                        let sp = r["spans"]
                            .as_array()
                            .unwrap()
                            .iter()
                            .map(|s| {
                                (
                                    s[0].as_u64().unwrap() as usize,
                                    s[1].as_u64().unwrap() as usize,
                                )
                            })
                            .collect();
                        (
                            r["ref"]["b"].as_u64().unwrap() as u32,
                            r["ref"]["c"].as_u64().unwrap() as u32,
                            r["ref"]["v"].as_u64().unwrap() as u32,
                            sp,
                        )
                    })
                    .collect();
                assert_eq!(rows, want, "{q:?} case={case} scope={scope}");
                assert_eq!(
                    got["verses"].as_u64().unwrap() as usize,
                    want.len(),
                    "{q:?}"
                );
                if scope == "all" {
                    assert_eq!(got["by_book"].as_object().unwrap(), &by_book, "{q:?}");
                }
            }
        }
    }
}

#[test]
fn a_word_not_everywhere_is_much_faster_than_testing_every_verse() {
    let Some(b) = common::bible() else { return };
    fn q(q: &str) -> SearchQuery<'_> {
        SearchQuery {
            q,
            case: false,
            scope: "all",
            offset: 0,
            limit: 100,
            regex: false,
        }
    }
    search(&b, &q("zeal")).unwrap(); // builds the index
    let t = std::time::Instant::now();
    for _ in 0..20 {
        search(&b, &q("Phinehas zealous")).unwrap();
    }
    let indexed = t.elapsed() / 20;
    let t = std::time::Instant::now();
    search_every_verse(&b, "Phinehas zealous", false, "all").unwrap();
    let every = t.elapsed();
    assert!(
        indexed * 5 < every,
        "indexed {indexed:?}, every verse {every:?}"
    );
}

#[test]
fn the_index_is_rebuilt_when_the_database_file_changes() {
    let dir = std::env::temp_dir()
        .join("bible-workbench-rs")
        .join("tests")
        .join(format!("db-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    std::env::set_var("WB_CACHE_DIR", dir.join("cache"));
    let path = dir.join("t.db");
    {
        let c = rusqlite::Connection::open(&path).unwrap();
        c.execute_batch("CREATE TABLE books (id INTEGER PRIMARY KEY, code TEXT, name TEXT, testament TEXT, chapters INTEGER);
                         INSERT INTO books VALUES (1, 'GEN', 'Genesis', 'OT', 50);
                         CREATE TABLE verses (book INT, chapter INT, verse INT, text TEXT);
                         INSERT INTO verses VALUES (1, 1, 1, 'alpha beta');").unwrap();
    }
    let n = |q: &str| {
        let b = wb_core::bible::Bible::open(&path).unwrap();
        search(
            &b,
            &SearchQuery {
                q,
                case: false,
                scope: "all",
                offset: 0,
                limit: 100,
                regex: false,
            },
        )
        .unwrap()["verses"]
            .as_u64()
            .unwrap()
    };
    assert_eq!(n("alpha"), 1);
    assert_eq!(n("gamma"), 0);
    std::thread::sleep(std::time::Duration::from_millis(20));
    rusqlite::Connection::open(&path)
        .unwrap()
        .execute("INSERT INTO verses VALUES (1, 1, 2, 'gamma delta')", [])
        .unwrap();
    assert_eq!(n("gamma"), 1); // a changed file is read again
    let _ = std::fs::remove_dir_all(&dir);
}
