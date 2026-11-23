//! Where search and near spend their time (cargo run --release -p wb-core --example timing).
use std::time::Instant;
use wb_core::bible::Bible;
use wb_core::lookup::{near, search, SearchQuery};

fn main() {
    let b = Bible::open(&wb_core::default_db_path()).unwrap();
    let t = Instant::now();
    let mut stmt = b
        .conn()
        .prepare("SELECT book, chapter, verse, text FROM verses ORDER BY book, chapter, verse")
        .unwrap();
    let rows: Vec<(u32, u32, u32, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();
    println!("read {} verses: {:?}", rows.len(), t.elapsed());
    let q = |q| SearchQuery {
        q,
        case: false,
        scope: "all",
        offset: 0,
        limit: 100,
        regex: false,
    };
    let t = Instant::now();
    search(&b, &q("phinehas")).unwrap();
    println!("first search (builds the index): {:?}", t.elapsed());
    let t = Instant::now();
    search(&b, &q("phinehas")).unwrap();
    println!("second search: {:?}", t.elapsed());
    let t = Instant::now();
    near(&b, "H1285", "H7965", 12, "all", 0, 100).unwrap();
    println!("first near (word offsets): {:?}", t.elapsed());
    let t = Instant::now();
    near(&b, "H1285", "H7965", 12, "all", 0, 100).unwrap();
    println!("second near: {:?}", t.elapsed());
}
