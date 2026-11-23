//! Rust-owned document-plan regression baseline from a synthetic, DB-quoted thread fixture.
//! Uses the same standalone database resolution as the other Rust tests.

#[expect(
    dead_code,
    reason = "shared test helpers: each test binary uses only some of them"
)]
mod common;

use common::{bible, Scratch};
use serde_json::Value;
use std::fs;
use wb_core::{docs::plan, store::Store, studyapi};

#[test]
fn document_plans_match_the_repository_owned_baseline() {
    let Some(bible) = bible() else { return };
    let scratch = Scratch::new();
    let thread_dir = scratch.path().join("threads");
    fs::create_dir_all(&thread_dir).unwrap();
    fs::write(
        thread_dir.join("baseline.md"),
        include_str!("../../../tests/doc-plans/threads/baseline.md"),
    )
    .unwrap();

    let store = Store::open(scratch.path()).unwrap();
    let view = studyapi::thread_view(&bible, &store, "baseline").unwrap();
    let mut margin = plan::Margin::new(&bible, &store).unwrap();
    let source = plan::thread_source(&bible, &view, &mut margin).unwrap();
    let expected: Value =
        serde_json::from_str(include_str!("../../../tests/doc-plans/fingerprints.json")).unwrap();

    for case in expected["plans"].as_array().unwrap() {
        margin.reset();
        let to = case["to"].as_str().unwrap();
        let structure = case["structure"].as_str().unwrap();
        let actual = plan::plan_of(to, structure, &source, &mut margin).unwrap();
        assert_eq!(
            plan::fingerprint(&actual),
            case["fingerprint"].as_str().unwrap(),
            "{to}/{structure} plan changed"
        );
    }
}
