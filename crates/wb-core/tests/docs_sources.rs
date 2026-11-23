#[expect(
    dead_code,
    reason = "shared test helpers: each test binary uses only some of them"
)]
mod common;

use common::{bible, Scratch};
use serde_json::Value;
use std::{fs, path::Path};
use wb_core::{
    bible::Bible,
    docs::{self, ExportFolders, Source},
    scripture,
    store::Store,
};

fn make(
    bible: &Bible,
    store: &Store,
    folders: &ExportFolders,
    source: Source,
    to: &str,
    new: bool,
) -> Value {
    docs::make(
        bible,
        store,
        folders,
        source,
        to,
        &docs::Choices::default(),
        new,
    )
    .unwrap()
}

fn passage(reference: &str, version: &str) -> Source {
    Source::Passage {
        reference: reference.into(),
        version: version.into(),
    }
}

#[test]
fn passage_exports_reuse_canonical_source_and_preserve_legacy_reading_sheet() {
    let Some(bible) = bible() else { return };
    let scratch = Scratch::new();
    let store = Store::open(scratch.path()).unwrap();
    let folders = ExportFolders::for_study(scratch.path()).unwrap();
    let reference = "Num 25:11; Judg 1:1";
    let word = make(
        &bible,
        &store,
        &folders,
        passage(reference, "ylt"),
        "word",
        false,
    );
    let expected = scripture::passage(&bible, reference, "YLT").unwrap();
    assert_eq!(word["checked"]["verses"], 2);
    assert_eq!(word["source"]["label"], expected["label"]);
    assert_eq!(word["source"]["ref"], reference);
    assert_eq!(word["source"]["version"], "YLT");
    assert_eq!(word["structure"], "reading");
    let id = word["id"].as_str().unwrap();
    let alias = "Numbers 25:11; Judges 1:1";
    let repeated = make(
        &bible,
        &store,
        &folders,
        passage(alias, "YLT"),
        "word",
        false,
    );
    assert_eq!(repeated["id"], id);
    assert_eq!(repeated["changed"], false);

    let file = Path::new(word["path"].as_str().unwrap());
    let record = scratch.path().join("documents").join(format!("{id}.json"));
    let mut legacy = docs::find(&store, id).unwrap();
    legacy.remove("design");
    legacy.remove("export_location");
    let legacy_record = serde_json::to_vec(&legacy).unwrap();
    fs::write(&record, &legacy_record).unwrap();
    let legacy_file = fs::read(file).unwrap();
    let error = docs::make(
        &bible,
        &store,
        &folders,
        passage(alias, "ylt"),
        "word",
        &docs::Choices::default(),
        false,
    )
    .unwrap_err();
    assert!(error.0.contains("--new"));
    let modern = make(
        &bible,
        &store,
        &folders,
        passage(alias, "YLT"),
        "word",
        true,
    );
    assert_ne!(modern["id"], id);
    assert_eq!(fs::read(&record).unwrap(), legacy_record);
    assert_eq!(fs::read(file).unwrap(), legacy_file);
    assert_eq!(
        make(
            &bible,
            &store,
            &folders,
            passage(alias, "YLT"),
            "word",
            false
        )["id"],
        modern["id"]
    );

    let pdf = make(
        &bible,
        &store,
        &folders,
        passage(reference, "YLT"),
        "pdf",
        false,
    );
    assert_eq!(pdf["structure"], "reader");
    assert_eq!(pdf["checked"]["verses"], 2);
    assert!(fs::read(pdf["path"].as_str().unwrap())
        .unwrap()
        .starts_with(b"%PDF-"));
    let kjv = make(
        &bible,
        &store,
        &folders,
        passage(reference, "KJV"),
        "pdf",
        false,
    );
    assert_ne!(pdf["id"], kjv["id"]);
}

#[test]
fn existing_lesson_export_keeps_its_legacy_identity_and_exact_source() {
    let Some(bible) = bible() else { return };
    let scratch = Scratch::new();
    let lessons = scratch.path().join("lessons");
    fs::create_dir_all(&lessons).unwrap();
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/golden/lesson.md");
    fs::copy(&fixture, lessons.join("existing-file.md")).unwrap();
    let store = Store::open(scratch.path()).unwrap();
    let folders = ExportFolders::for_study(scratch.path()).unwrap();
    let source = || Source::Lesson("existing-file".into());
    let word = make(
        &bible,
        &store,
        &folders,
        Source::Lesson("existing".into()),
        "word",
        false,
    );
    assert_eq!(
        word["source"],
        serde_json::json!({"kind": "lesson", "name": "existing-file"})
    );
    assert_eq!(word["structure"], "script");
    assert_eq!(word["checked"]["verses"], 2);
    let pdf = make(&bible, &store, &folders, source(), "pdf", false);
    assert_eq!(pdf["checked"]["verses"], 2);

    let id = word["id"].as_str().unwrap();
    let mut legacy = docs::find(&store, id).unwrap();
    legacy.remove("design");
    legacy.remove("export_location");
    fs::write(
        scratch.path().join("documents").join(format!("{id}.json")),
        serde_json::to_vec(&legacy).unwrap(),
    )
    .unwrap();
    assert_eq!(
        docs::update(&bible, &store, &folders, id, &docs::Styling::default()).unwrap()["id"],
        id
    );
    assert_eq!(
        docs::listing(&bible, &store, &folders, Some(("lesson", "existing-file")))
            .as_array()
            .unwrap()
            .len(),
        2
    );

    fs::rename(
        lessons.join("existing-file.md"),
        lessons.join("existing-file-new.md"),
    )
    .unwrap();
    let record = docs::find(&store, id).unwrap();
    assert_eq!(
        docs::status(&bible, &store, &folders, &record)["state"],
        "gone"
    );
    assert!(
        docs::update(&bible, &store, &folders, id, &docs::Styling::default())
            .unwrap_err()
            .0
            .contains("existing-file")
    );
}
