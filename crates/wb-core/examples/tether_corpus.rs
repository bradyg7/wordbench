//! Makes the Tether scratch study: `cargo run -p wb-core --example tether_corpus -- <new folder> [seed]`.
//! Writes `<folder>-expected.json` beside it (what was planted, and where). See scripts/tether-corpus.ps1.

use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(dir) = args.first() else {
        eprintln!("usage: tether_corpus <new folder> [seed]");
        std::process::exit(2);
    };
    let seed: u64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(2026);
    let bible = wb_core::bible::Bible::open(&wb_core::default_db_path()).unwrap_or_else(|e| {
        eprintln!("error: {e}");
        std::process::exit(1);
    });
    let dir = PathBuf::from(dir);
    match wb_core::tether::corpus::make(&bible, &dir, seed) {
        Ok(m) => {
            let mut side = dir.clone().into_os_string();
            side.push("-expected.json");
            std::fs::write(&side, serde_json::to_string_pretty(&m.expected).unwrap()).unwrap();
            println!("{}", PathBuf::from(side).display());
        }
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
