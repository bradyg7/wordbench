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
    "chapters_of", "progress", "today_view", "overall",
    // the Notebook and the command language: pieces of the commands that reach them (note place finds and places;
    // the reader draws the questions)
    "place_jot", "replace_placed", "set_jot_status", "named_place", "chapter_questions", "command_names", "split_at", "anchor_ref",
    // wb do: the app's side of the socket (wb do is the other side)
    "address_file", "listen", "read_request", "answer",
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
    let cli_src: String = ["lib.rs", "read.rs", "study.rs", "reading.rs", "notebook.rs"].iter().map(|f| fs::read_to_string(cli.clone() + f).unwrap()).collect();
    let mut missing = vec![];
    for file in ["lookup.rs", "studyapi.rs", "store.rs", "scripture.rs", "reading.rs", "notebook.rs", "commands.rs", "relay.rs"] {
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
