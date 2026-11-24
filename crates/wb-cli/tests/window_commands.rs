//! Rule: every action the window can ask of the core has a `wb` command (AGENTS.md, CODING_STANDARDS.md).
//!
//! The window asks the core two ways: the in-process `wb` relay (`wb([...])` in `ui/src`, which runs a command of the
//! `wb` table), and the `#[tauri::command]` functions of the shell in `app/src-tauri/src`. This test fails, naming it,
//! when the UI sends a word the table does not have, and when a shell command is neither mapped to a `wb` command nor
//! listed in `SHELL` as window-only with a reason. `lent.rs` runs every table command the window's way; this is the
//! other half: the window asks only for table commands.

use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn files_under(dir: &Path, ext: &str, out: &mut Vec<PathBuf>) {
    for e in std::fs::read_dir(dir).unwrap().flatten() {
        let p = e.path();
        if p.is_dir() {
            files_under(&p, ext, out);
        } else if p.extension().is_some_and(|x| x == ext) {
            out.push(p);
        }
    }
}

/// One `wb([...])` call in the UI: where it is and its leading string literals (up to the first thing that is not one).
#[derive(Debug, PartialEq)]
struct Call {
    at: String,
    words: Vec<String>,
}

/// Every `wb([ 'a', 'b', ...` in a source text. Only the literal words at the front can be read; an argument that is a
/// variable ends them. A call whose first element is not a literal (`wb(argv)`, `wb([...args])`) is not read.
fn wb_calls(file: &str, source: &str) -> Vec<Call> {
    let bytes = source.as_bytes();
    let mut calls = vec![];
    let mut from = 0;
    while let Some(i) = source[from..].find("wb(") {
        let start = from + i;
        from = start + 3;
        // `wb(` must be a whole word (not `wbRaw(` or `awb(`)
        if start > 0
            && (bytes[start - 1].is_ascii_alphanumeric()
                || bytes[start - 1] == b'_'
                || bytes[start - 1] == b'.')
        {
            continue;
        }
        let mut rest = source[from..].trim_start();
        if !rest.starts_with('[') {
            continue;
        }
        rest = &rest[1..];
        let mut words = vec![];
        loop {
            rest = rest.trim_start();
            let Some(q) = rest.chars().next().filter(|c| *c == '\'' || *c == '"') else {
                break;
            };
            let Some(end) = rest[1..].find(q) else { break };
            words.push(rest[1..1 + end].to_string());
            rest = rest[end + 2..].trim_start();
            match rest.strip_prefix(',') {
                Some(r) => rest = r,
                None => break,
            }
        }
        if !words.is_empty() {
            let line = source[..start].matches('\n').count() + 1;
            calls.push(Call {
                at: format!("{file}:{line}"),
                words,
            });
        }
    }
    calls
}

/// A call is in the table when its first two words name a command, or its first word names one on its own (then the
/// second is an argument or an option). `wb page …` is also `wb note …` (R1), as `run` resolves it.
fn call_is_in_table(call: &Call, table: &[&str]) -> bool {
    let has = |k: &str| table.contains(&k);
    let one = &call.words[0];
    if call.words.len() >= 2 {
        let two = format!("{one} {}", call.words[1]);
        if has(&two) || (one == "page" && has(&format!("note {}", call.words[1]))) {
            return true;
        }
    }
    // with a second literal word that is no command, the first must be a command that takes arguments (a group such as
    // `thread` is not one); with only one literal word, the second is a variable and a group's name is enough
    has(one)
        || (call.words.len() == 1
            && table
                .iter()
                .any(|t| t.split(' ').next() == Some(one.as_str())))
}

fn calls_not_in_table(calls: &[Call], table: &[&str]) -> Vec<String> {
    calls
        .iter()
        .filter(|c| !call_is_in_table(c, table))
        .map(|c| format!("{}: wb {}", c.at, c.words.join(" ")))
        .collect()
}

/// The names of the `#[tauri::command]` functions in a source text.
fn tauri_commands(source: &str) -> Vec<String> {
    let mut found = vec![];
    let mut pending = false;
    for line in source.lines() {
        let t = line.trim();
        if t.starts_with("#[tauri::command") {
            pending = true;
        } else if pending {
            let t = t.strip_prefix("async ").unwrap_or(t);
            if let Some(r) = t.strip_prefix("fn ") {
                found.push(r.split(['(', '<']).next().unwrap().trim().to_string());
                pending = false;
            } else if !(t.starts_with("#[") || t.starts_with("//")) {
                pending = false;
            }
        }
    }
    found
}

/// What a shell command is in terms of the `wb` table.
enum Is {
    /// does its work through this `wb` command
    Wb(&'static str),
    /// window-only plumbing, with the reason it has no `wb` command
    WindowOnly(&'static str),
}
use Is::{Wb, WindowOnly};

/// Every shell command, mapped. A new `#[tauri::command]` is not here until someone decides on purpose, so it fails.
const SHELL: &[(&str, Is)] = &[
    ("wb", WindowOnly("the relay itself: it runs any command of the table")),
    ("reader", Wb("reader")),
    ("word", Wb("word")),
    ("verse", Wb("verse")),
    ("books", Wb("books")),
    ("highlight", Wb("hl set")),
    ("plan_today", Wb("plan today")),
    ("read_mark", Wb("read mark")),
    ("finding_attach", Wb("finding attach")),
    ("setup_status", Wb("setup")),
    ("set_study_dir", Wb("setup")),
    ("set_bible_db", Wb("setup")),
    ("update_check", Wb("update check")),
    ("update_install", Wb("update install")),
    ("update_stop", Wb("update stop")),
    ("update_back", Wb("update back")),
    ("do_done", WindowOnly("the window's answer to a `wb do` line it was sent")),
    ("set_window", WindowOnly("sizes the window to a preset; a terminal has no window to size")),
    ("ui_ready", WindowOnly("the reader reports it has drawn (timing, the update look); nothing to run from a terminal")),
    ("choose_study_dir", WindowOnly("the operating system's folder picker; `wb setup study <folder>` takes the folder itself")),
    ("choose_bible_db", WindowOnly("the operating system's file picker; `wb setup database <file>` takes the file itself")),
    ("update_restart", WindowOnly("restarts this window after saving its pages; `wb update install` asks the window for it")),
    ("installation_status", WindowOnly("first-run setup of a distribution build, shown before any study is open")),
    ("installation_configure", WindowOnly("first-run setup of a distribution build; it refuses once a study is open")),
    ("installation_restart", WindowOnly("restarts the setup window of a distribution build")),
    ("pilot_license", WindowOnly("a distribution build's license request and import on the first-run setup screen, before `wb` can run (`require_license`)")),
];

/// The shell commands that are not mapped, and map entries for a command that is gone or names no table command.
fn shell_problems(found: &[String], table: &[&str]) -> Vec<String> {
    let mut bad = vec![];
    for f in found {
        if !SHELL.iter().any(|(n, _)| n == f) {
            bad.push(format!(
                "#[tauri::command] {f} has no `wb` command and is not listed as window-only with a reason (add the `wb` command, or list it in SHELL in crates/wb-cli/tests/window_commands.rs)"
            ));
        }
    }
    for (n, is) in SHELL {
        if !found.iter().any(|f| f == n) {
            bad.push(format!(
                "SHELL lists {n}, which is no #[tauri::command] any more"
            ));
        }
        match is {
            Wb(c) if !table.contains(c) => bad.push(format!(
                "{n} is mapped to `wb {c}`, which is not in the table"
            )),
            WindowOnly("") => bad.push(format!("{n} is window-only without a reason")),
            _ => {}
        }
    }
    bad
}

fn table() -> Vec<&'static str> {
    wb_cli::names().into_iter().map(|(n, _)| n).collect()
}

#[test]
fn the_ui_sends_only_commands_the_wb_table_has() {
    let table = table();
    let mut files = vec![];
    files_under(&root().join("ui/src"), "ts", &mut files);
    let mut calls = vec![];
    for f in &files {
        let rel = f
            .strip_prefix(root())
            .unwrap_or(f)
            .to_string_lossy()
            .replace('\\', "/");
        calls.extend(wb_calls(&rel, &std::fs::read_to_string(f).unwrap()));
    }
    assert!(
        calls.len() > 300,
        "read only {} wb([...]) calls in ui/src",
        calls.len()
    );
    let bad = calls_not_in_table(&calls, &table);
    assert!(
        bad.is_empty(),
        "the window sends commands the `wb` table does not have:\n{}",
        bad.join("\n")
    );
}

#[test]
fn every_shell_command_has_a_wb_command_or_a_reason() {
    let table = table();
    let mut files = vec![];
    files_under(&root().join("app/src-tauri/src"), "rs", &mut files);
    let mut found = vec![];
    for f in &files {
        found.extend(tauri_commands(&std::fs::read_to_string(f).unwrap()));
    }
    assert!(
        found.len() > 20,
        "found only {} #[tauri::command] functions",
        found.len()
    );
    let bad = shell_problems(&found, &table);
    assert!(
        bad.is_empty(),
        "the shell's commands and the `wb` table disagree:\n{}",
        bad.join("\n")
    );
}

// The comparison itself, tried on made-up input: these show the checks can fail.

#[test]
fn a_command_word_the_table_lacks_is_caught_and_named() {
    let table = ["page tree", "thread list", "strong"];
    let calls = wb_calls(
        "ui/src/fake.ts",
        "await wb(['page', 'tree']);\nawait wb(['thread', 'frobnicate']);\nwb([ 'strong', id ]);\nwb(['nosuch', 'x'])",
    );
    assert_eq!(calls.len(), 4);
    let bad = calls_not_in_table(&calls, &table);
    assert_eq!(
        bad,
        vec![
            "ui/src/fake.ts:2: wb thread frobnicate",
            "ui/src/fake.ts:4: wb nosuch x"
        ]
    );
}

#[test]
fn a_shell_command_nobody_mapped_is_caught_and_named() {
    let source = "#[tauri::command]\nfn highlight() {}\n\n/// docs\n#[tauri::command]\nasync fn brand_new_action(app: X) {}\n";
    let found = tauri_commands(source);
    assert_eq!(found, vec!["highlight", "brand_new_action"]);
    let bad = shell_problems(&found, &table());
    assert!(
        bad.iter()
            .any(|b| b.contains("brand_new_action has no `wb` command")),
        "{bad:?}"
    );
}
