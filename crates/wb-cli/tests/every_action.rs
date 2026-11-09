//! The rule in CLAUDE.md: every core action is reachable from a `wb` command. Each public function of wb-core's
//! lookups, study requests and store must be called somewhere in the `wb` sources, or be listed here as internal.

use std::fs;

/// Public functions that are helpers of other actions, not actions of their own.
const INTERNAL: &[&str] = &[
    "is_strong", "is_word", "known_word", "strongs_brief", "plain", "text", "public", "set_view", "lesson_slug", "lesson_find",
    "lesson_parse", "lesson_listing", "open", "root", "notes", "highlights", "all_highlights", "edit_highlights", "use_palette_color",
    "threads", "thread", "trails", "sets", "find_set", "add_note", "update_note", "add_trail", "create_thread", "add_to_thread",
    "add_many_to_thread", "remove_from_thread", "update_thread", "versions",
    // the file formats and small helpers of the store and of scripture
    "bad", "missing", "now", "new_id", "parse_md", "dump_md", "write_atomic", "cut", "check_color", "parse_thread", "verses", "copy_text", "guard", "search_every_verse", "warm",
    // the store keeping in step with its folder, and plain forms the commands reach through others (hl set keeps the
    // no-overlap rule over set_highlight; set rename is update_set without pane views, which come from the window)
    "refresh", "look_again", "set_highlight", "update_set",
    // reading: the pieces wb plan and wb read are made of
    "today", "schedule", "parse_plan_text", "label", "read_plan", "plans", "find_plan", "start_plan", "remove_plan", "log", "mark",
    "chapters_of", "progress", "today_view", "overall", "start_plan_with", "days_off_of", "next_reading_day", "plan_dates", "reading_days_between", "start_for", "build", "apply_missed",
    // the builder and the published plans: pieces of wb plan layout, start, arrange and import
    "lay_out", "exact", "layout", "extended", "detect",
    // the Notebook and the command language: pieces of the commands that reach them (note place finds and places;
    // the reader draws the questions)
    "place_jot", "replace_placed", "set_jot_status", "named_place",
    // more places, threads and the trash: the store's pieces of wb note also, note thread, thread write, note text and wb trash
    // the Notebook of phase 2b: pieces of wb notebook, note show and wb day (a chapter or a book as a place, titles, days)
    "whole_place", "title_of", "is_day", "days", "day",
    "places_of", "threads_of", "add_thread_note", "update_thread_note", "set_note_thread", "set_note_also", "trashed", "chapter_questions", "command_names", "split_at", "anchor_ref",
    // wb do: the app's side of the socket (wb do is the other side)
    "address_file", "listen", "read_request", "answer",
    // documents (tier 4): the store's trash for a record (wb docs delete), and the pieces of wb docs and wb craft
    "trash_file", "squash", "records", "source_name",
    // pages and blocks (W3): the text of a page as blocks, the pieces of wb page and wb block; the store's fields
    "split", "set", "insert", "move_block", "check", "retitle", "find_note", "set_fields",
    // scripture blocks (W4): a fence read and written, pieces of wb page scripture and wb block scripture
    "scripture_fence", "scripture_fence_text",
    // views and templates (W5): a view's fence and line read (pieces of wb page views, wb view run, wb template save), a
    // place as a reference again, the blanks filled, and the Templates rows of wb notebook sidebar
    "view_fence", "view_line", "span_ref", "fill", "rows",
    // a document from a page (W6): its words without Markdown, its rows and its blocks, pieces of wb craft parts and wb craft word|deck --page
    "plain_words", "parts", "source",
    // files attached to a finding (C1): the window's form of wb finding attach, for a dropped or pasted file, which has
    // bytes but no path in the page (app/src-tauri's finding_attach; a terminal attaches by path)
    "attach_bytes",
    // a thread as a page and questions in pages (R1): fences and ids read and written, the tree and the reader's pieces of
    // wb thread page|pin, wb page threads|words, wb block thread|word and wb question *
    "thread_fence", "word_fence", "value_fence_text", "thread_held", "slug_of", "pinned_of", "set_pinned", "question_of", "question_md",
    "with_marker", "found", "in_chapter", "entries", "split_id",
    // the Shelf (R2): a kept pane as the window's key (a piece of wb set open), an item read out to move it (wb shelf item)
    "pane_key", "set_item_of",
];

fn public_fns(src: &str) -> Vec<String> {
    src.lines()
        .filter_map(|l| l.trim_start().strip_prefix("pub fn "))
        .map(|l| l.split(['(', '<']).next().unwrap().to_string())
        .collect()
}

#[test]
fn every_action_has_a_command() {
    let core = env!("CARGO_MANIFEST_DIR").to_string() + "/../wb-core/src/";
    let cli = env!("CARGO_MANIFEST_DIR").to_string() + "/src/";
    let cli_src: String = ["lib.rs", "read.rs", "study.rs", "reading.rs", "notebook.rs", "docs.rs", "pages.rs"].iter().map(|f| fs::read_to_string(cli.clone() + f).unwrap()).collect();
    let mut missing = vec![];
    for file in ["check.rs", "findings.rs", "plans.rs", "published.rs", "lookup.rs", "studyapi.rs", "store.rs", "scripture.rs", "reading.rs", "notebook.rs", "pages.rs", "pageviews.rs", "templates.rs", "guide.rs", "commands.rs", "relay.rs", "docs/mod.rs", "docs/page.rs", "threadpage.rs", "questions.rs", "shelf.rs"] {
        for f in public_fns(&fs::read_to_string(core.clone() + file).unwrap()) {
            if INTERNAL.contains(&f.as_str()) || f.starts_with("py_") {
                continue;
            }
            if !cli_src.contains(&format!("{f}(")) {
                missing.push(format!("{file}: {f}"));
            }
        }
    }
    assert!(missing.is_empty(), "wb-core actions with no wb command: {missing:?}");
}
