//! Rust-owned contract for the legacy Python-readable study projection.
//! Uses synthetic metadata in a disposable directory, never a personal study folder.

mod common;

use common::Scratch;
use serde_json::{json, Value};
use std::fs;
use wb_core::check::study_check;
use wb_core::store::Store;

fn put(root: &std::path::Path, relative: &str, body: &str) {
    let path = root.join(relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
}

#[test]
fn study_check_projects_python_readable_records() {
    let scratch = Scratch::new();
    put(
        scratch.path(),
        "notes/NUM/n_fixture.md",
        "---\nid: \"n_fixture\"\nanchor: \"NUM.25:11\"\n---\n\nSynthetic note body.\n",
    );
    put(
        scratch.path(),
        "notes/_inbox/n_inbox.md",
        "---\nid: \"n_inbox\"\n---\n\nSynthetic inbox body.\n",
    );
    put(
        scratch.path(),
        "threads/fixture.md",
        "---\nname: \"Synthetic thread\"\ncreated: \"2026-01-01\"\nupdated: \"2026-01-01\"\n---\n\nSynthetic thread note.\n\n<!-- anchors -->\n- NUM.25:11 | \"\"\n- NUM.25:12 | \"\"\n",
    );
    put(
        scratch.path(),
        "trails/q_fixture.md",
        "---\nid: \"q_fixture\"\nanchor: \"NUM.25:11\"\nstatus: \"open\"\ncreated: \"2026-01-01\"\n---\n\nSynthetic question body.\n",
    );
    put(
        scratch.path(),
        "sets/fixture.md",
        "---\nname: \"Synthetic set\"\n---\n\nSynthetic set note.\n",
    );

    let mut store = Store::open(scratch.path()).unwrap();
    let check = study_check(&mut store).unwrap();
    assert_eq!(
        check.get("python_reads").unwrap(),
        &json!({"notes": 1, "threads": 1, "thread_places": 2, "trails": 1, "sets": 1})
    );
    assert_eq!(check.get("would_write"), Some(&Value::Array(vec![])));
}
