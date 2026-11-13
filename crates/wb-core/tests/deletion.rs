mod common;
use common::{bible, Scratch};
use serde_json::json;
use std::fs;
use wb_core::{
    deletion::{self as del, Selection},
    pages,
    store::{s, Store},
};

#[test]
fn ordinary_scope_promotes_pinned_descendant_preserves_associations_and_exact_bytes() {
    let Some(b) = bible() else { return };
    let scratch = Scratch::new();
    let mut st = Store::open(scratch.path()).unwrap();
    let parent = pages::new_page(&b, &mut st, None, "Parent", false, None).unwrap();
    let p = parent["id"].as_str().unwrap();
    let child = pages::new_page(&b, &mut st, Some(p), "Pinned child", false, None).unwrap();
    let c = child["id"].as_str().unwrap();
    st.set_fields(
        c,
        &[
            ("pinned", Some(json!(2))),
            ("unknown", Some(json!({"kept":true}))),
        ],
    )
    .unwrap();
    let thread = st
        .create_thread("Association", "Thread text", None)
        .unwrap();
    let tid = s(&thread, "id");
    let associated = st.add_thread_note(&tid, "Associated only").unwrap();
    let aid = s(&associated, "id");
    let template = st.jot("Template", false).unwrap();
    let template_id = s(&template, "id");
    st.set_fields(&template_id, &[("template", Some(json!(true)))])
        .unwrap();
    st.write_day("2026-11-09", "Day page", false).unwrap();
    let child_path = scratch.path().join(format!("notes/_inbox/{c}.md"));
    let original = fs::read(&child_path).unwrap();
    let plan = del::plan(
        &b,
        &mut st,
        &Selection {
            all: true,
            ..Default::default()
        },
    )
    .unwrap();
    let preview = plan.preview();
    assert_eq!(preview["count"], 1);
    assert_eq!(preview["retained_moved"], json!([c]));
    assert_eq!(preview["deleted"], json!([p]));
    let result = del::commit(&mut st, plan, preview["token"].as_str(), || 0, false).unwrap();
    assert_eq!(result["deadline_ms"], 30000);
    assert!(!st.find_note(c).unwrap().contains_key("parent"));
    assert!(st.find_note(&aid).is_ok());
    assert!(st.find_note(&template_id).is_ok());
    assert_eq!(st.threads().len(), 1);
    assert_eq!(st.days().len(), 1);
    del::undo(&mut st, result["operation"].as_str().unwrap(), 29999).unwrap();
    assert_eq!(fs::read(&child_path).unwrap(), original);
    assert!(st.find_note(p).is_ok());
    assert!(del::plan(
        &b,
        &mut st,
        &Selection {
            ids: vec![format!("thread:{tid}")],
            ..Default::default()
        }
    )
    .is_err());
}

#[test]
fn opt_in_scope_and_single_parent_deadline() {
    let Some(b) = bible() else { return };
    let scratch = Scratch::new();
    let mut st = Store::open(scratch.path()).unwrap();
    let p = pages::new_page(&b, &mut st, None, "Parent", false, None).unwrap();
    let id = p["id"].as_str().unwrap();
    let c = pages::new_page(&b, &mut st, Some(id), "Child", false, None).unwrap();
    let plan = del::plan(
        &b,
        &mut st,
        &Selection {
            ids: vec![id.into()],
            ..Default::default()
        },
    )
    .unwrap();
    let r = del::commit(&mut st, plan, None, || 0, false).unwrap();
    assert_eq!(r["count"], 1);
    assert_eq!(r["moved"], 1);
    assert_eq!(r["deadline_ms"], 30000);
    assert!(st.find_note(c["id"].as_str().unwrap()).is_ok());
    del::undo(&mut st, r["operation"].as_str().unwrap(), 1).unwrap();
    st.set_fields(id, &[("pinned", Some(json!(1)))]).unwrap();
    let t = st.jot("Template", false).unwrap();
    st.set_fields(&s(&t, "id"), &[("template", Some(json!(true)))])
        .unwrap();
    st.write_day("2026-11-09", "Day", false).unwrap();
    let p = del::plan(
        &b,
        &mut st,
        &Selection {
            all: true,
            pinned: true,
            templates: true,
            days: true,
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(p.preview()["count"], 4);
}
