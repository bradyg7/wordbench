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

/// One `wb(...)` call in the UI: where it is and the string literals it starts with. `words` is empty when the check
/// cannot read the call (its array begins with a variable, or the argument is built somewhere else).
#[derive(Debug, PartialEq)]
struct Call {
    at: String,
    words: Vec<String>,
}

/// For each byte of a TypeScript source, whether it is code: false inside `//` and `/* */` comments, inside string and
/// template literals (quotes included) and inside regular-expression literals. A string or regular expression that
/// is not closed on its line ends there, so one odd quote cannot hide the rest of the file.
fn code_mask(src: &str) -> Vec<bool> {
    let b = src.as_bytes();
    let mut mask = vec![true; b.len()];
    let mut i = 0;
    let mut last_code = b'\n';
    while i < b.len() {
        let c = b[i];
        let next = b.get(i + 1).copied();
        let mut end = i + 1;
        let mut skipped = false;
        if c == b'/' && next == Some(b'/') {
            end = b[i..]
                .iter()
                .position(|&x| x == b'\n')
                .map_or(b.len(), |p| i + p);
            skipped = true;
        } else if c == b'/' && next == Some(b'*') {
            end = src[i + 2..].find("*/").map_or(b.len(), |p| i + 2 + p + 2);
            skipped = true;
        } else if c == b'\'' || c == b'"' || c == b'`' {
            let mut j = i + 1;
            while j < b.len() && b[j] != c && !(b[j] == b'\n' && c != b'`') {
                j += if b[j] == b'\\' { 2 } else { 1 };
            }
            end = (j + 1).min(b.len());
            skipped = true;
        } else if c == b'/' && b"(,=:[!&|?{};\n".contains(&last_code) {
            // a regular expression literal, where a division cannot stand
            let mut j = i + 1;
            let mut in_class = false;
            while j < b.len() && b[j] != b'\n' && (in_class || b[j] != b'/') {
                match b[j] {
                    b'\\' => j += 1,
                    b'[' => in_class = true,
                    b']' => in_class = false,
                    _ => {}
                }
                j += 1;
            }
            end = (j + 1).min(b.len());
            skipped = true;
        }
        if skipped {
            mask[i..end].fill(false);
        } else if !c.is_ascii_whitespace() {
            last_code = c;
        }
        i = end;
    }
    mask
}

/// The index of the bracket that closes the one at `open`, counting only code.
fn closing(src: &str, mask: &[bool], open: usize) -> Option<usize> {
    let b = src.as_bytes();
    let mut depth = 0i32;
    for i in open..b.len() {
        if !mask[i] {
            continue;
        }
        match b[i] {
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

/// The first code byte `ch` in `src[from..to]` that is not inside brackets.
fn top_level(src: &str, mask: &[bool], from: usize, to: usize, ch: u8) -> Option<usize> {
    let b = src.as_bytes();
    let mut depth = 0i32;
    for i in from..to {
        if !mask[i] {
            continue;
        }
        match b[i] {
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' => depth -= 1,
            c if c == ch && depth == 0 => return Some(i),
            _ => {}
        }
    }
    None
}

/// The string literals an array literal starts with: `['a', 'b', x]` gives a, b. Empty for anything else.
fn array_words(text: &str) -> Vec<String> {
    let mut words = vec![];
    let Some(mut rest) = text.trim_start().strip_prefix('[') else {
        return words;
    };
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
    words
}

/// Every `wb(...)` call in a source text, in code only. Read: `wb([...])`, `wb(cond ? [...] : [...])` (two calls) and
/// `wb(name)` where `const name = [...]` or `let name = [...]` stands earlier in the file. Any other argument is a call
/// with no words: the check cannot read it.
fn wb_calls(file: &str, source: &str) -> Vec<Call> {
    let bytes = source.as_bytes();
    let mask = code_mask(source);
    let mut calls = vec![];
    let mut from = 0;
    while let Some(i) = source[from..].find("wb(") {
        let start = from + i;
        from = start + 3;
        // `wb(` must be a whole word (not `wbRaw(`, `awb(` or `.wb(`) and be code
        if !mask[start]
            || (start > 0
                && (bytes[start - 1].is_ascii_alphanumeric()
                    || matches!(bytes[start - 1], b'_' | b'.')))
        {
            continue;
        }
        // the definition `function wb(argv: string[]...)` is not a call
        if source[..start].trim_end().ends_with("function") {
            continue;
        }
        let Some(close) = closing(source, &mask, start + 2) else {
            continue;
        };
        let arg = source[start + 3..close].trim();
        let line = source[..start].matches('\n').count() + 1;
        let at = format!("{file}:{line}");
        let arg_from = start + 3;
        let word_lists: Vec<Vec<String>> = if arg.starts_with('[') {
            vec![array_words(arg)]
        } else if let Some(q) = top_level(source, &mask, arg_from, close, b'?') {
            match top_level(source, &mask, q + 1, close, b':') {
                Some(colon) => vec![
                    array_words(&source[q + 1..colon]),
                    array_words(&source[colon + 1..close]),
                ],
                None => vec![vec![]],
            }
        } else if !arg.is_empty() && arg.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_') {
            let earlier = &source[..start];
            let def = ["const", "let"]
                .iter()
                .filter_map(|kw| {
                    earlier
                        .rfind(&format!("{kw} {arg} = ["))
                        .map(|p| p + kw.len() + arg.len() + 4)
                })
                .max();
            vec![def.map_or(vec![], |p| array_words(&source[p..]))]
        } else {
            vec![vec![]]
        };
        for words in word_lists {
            calls.push(Call {
                at: at.clone(),
                words,
            });
        }
    }
    calls
}

/// A call is in the table when its first two words name a command, or its first word names one and has no subcommands
/// (then the second is an argument or an option). When the first word has subcommands (`thread` has `thread list`
/// …), a second word that is not an option must be one of them. `wb page …` is also `wb note …` (R1), as `run`
/// resolves it. A call with one literal word is a group's name with the rest in a variable.
fn call_is_in_table(call: &Call, table: &[&str]) -> bool {
    let has = |k: &str| table.contains(&k);
    let one = &call.words[0];
    let has_subcommands = table.iter().any(|t| {
        t.strip_prefix(one.as_str())
            .is_some_and(|r| r.starts_with(' '))
    });
    match call.words.get(1) {
        None => has(one) || has_subcommands,
        Some(second) => {
            has(&format!("{one} {second}"))
                || (one == "page" && has(&format!("note {second}")))
                || (has(one) && (!has_subcommands || second.starts_with('-')))
        }
    }
}

/// The calls the check can read that name no table command, as "file:line: wb words".
fn calls_not_in_table(calls: &[Call], table: &[&str]) -> Vec<String> {
    calls
        .iter()
        .filter(|c| !c.words.is_empty() && !call_is_in_table(c, table))
        .map(|c| format!("{}: wb {}", c.at, c.words.join(" ")))
        .collect()
}

/// The `wb(...)` calls the check cannot read, per file, as they stand now. Each is a command the window sends that
/// nothing compares with the table. A new one fails the test; pass a literal array (or a ternary of two, or a `const`
/// array in the same file), or raise the number here with a reason in the review. The number only goes down.
const UNREADABLE: &[(&str, usize)] = &[
    ("ui/src/notebook.ts", 5),
    ("ui/src/plans.ts", 8),
    ("ui/src/shelf.ts", 2),
];

fn unreadable_by_file(calls: &[Call]) -> std::collections::BTreeMap<String, Vec<String>> {
    let mut by_file: std::collections::BTreeMap<String, Vec<String>> = Default::default();
    for c in calls.iter().filter(|c| c.words.is_empty()) {
        let (file, _) = c.at.rsplit_once(':').unwrap();
        by_file
            .entry(file.to_string())
            .or_default()
            .push(c.at.clone());
    }
    by_file
}

/// Problems with the unreadable calls against the pinned counts: a file with more than it is pinned for (naming its
/// calls), and a pin above what is there (it must come down).
fn unreadable_problems(calls: &[Call], pinned: &[(&str, usize)]) -> Vec<String> {
    let by_file = unreadable_by_file(calls);
    let mut bad = vec![];
    for (file, at) in &by_file {
        let allowed = pinned
            .iter()
            .find(|(f, _)| f == file)
            .map_or(0, |(_, n)| *n);
        if at.len() > allowed {
            bad.push(format!(
                "{file}: {} calls the check cannot read, pinned at {allowed}: the check cannot read this `wb(...)` call; pass a literal array or add a reason. At {}",
                at.len(),
                at.join(", ")
            ));
        }
    }
    for (file, n) in pinned {
        let now = by_file.get(*file).map_or(0, Vec::len);
        if now < *n {
            bad.push(format!(
                "{file} is pinned at {n} unreadable calls but has {now}: lower it in UNREADABLE"
            ));
        }
    }
    bad
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
    /// does its work through a command the `wb` binary answers itself, before the table (`crates/wb-cli/src/main.rs`,
    /// distribution builds: `license`, `setup new`, `setup open`), so the table does not list it. The test reads that
    /// file for the word and its subcommand.
    Binary(&'static str),
    /// window-only plumbing, with the reason it has no `wb` command
    WindowOnly(&'static str),
}
use Is::{Binary, Wb, WindowOnly};

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
    // `wb setup study` (the table) saves the folder in the settings; the installation's own folder (`roots.configure`) is
    // what `wb setup new|open` does, so these are not the table's `setup`
    ("installation_status", Binary("setup")),
    ("installation_configure", Binary("setup new")),
    ("installation_restart", WindowOnly("restarts the setup window of a distribution build; a terminal has no window to restart")),
    ("pilot_license", Binary("license")),
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
            Binary(c) => {
                let main =
                    std::fs::read_to_string(root().join("crates/wb-cli/src/main.rs")).unwrap();
                let (first, second) = c.split_once(' ').unwrap_or((c, ""));
                if !main.contains(&format!("Some(\"{first}\")"))
                    || (!second.is_empty() && !main.contains(&format!("\"{second}\"")))
                {
                    bad.push(format!(
                        "{n} is mapped to the binary's `wb {c}`, which main.rs does not answer"
                    ));
                }
            }
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
    let unread = unreadable_problems(&calls, UNREADABLE);
    assert!(unread.is_empty(), "{}", unread.join("\n"));
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

#[test]
fn an_unknown_subcommand_of_a_command_with_subcommands_is_caught() {
    let table = ["strong", "strong list", "thread list", "docs open"];
    let calls = wb_calls(
        "ui/src/fake.ts",
        "wb(['strong', 'nosuch']);\nwb(['strong', 'list']);\nwb(['strong', '--list']);\nwb(['thread']);",
    );
    assert_eq!(
        calls_not_in_table(&calls, &table),
        vec!["ui/src/fake.ts:1: wb strong nosuch"]
    );
}

#[test]
fn a_call_in_a_comment_or_a_string_is_not_a_call() {
    let source = "// wb(['nosuch', 'a'])\n/* wb(['nosuch', 'b']) */\nconst s = \"wb(['nosuch', 'c'])\";\nconst t = `x wb(['nosuch', 'd'])`;\nconst r = /['\"]/;\nwb(['page', 'tree']);\nconst u = 'it\'s wb(';\nwb(['nosuch', 'e']);\n";
    let calls = wb_calls("ui/src/fake.ts", source);
    let words: Vec<_> = calls.iter().map(|c| c.words.join(" ")).collect();
    assert_eq!(words, vec!["page tree", "nosuch e"], "{calls:?}");
    assert_eq!(calls[1].at, "ui/src/fake.ts:8");
}

#[test]
fn a_ternary_of_two_arrays_and_a_const_array_are_read() {
    let table = ["page tree", "thread list"];
    let source = "const ok = ['thread', 'list', id];\nwb(open ? ['page', 'tree'] : ['page', 'nosuch']);\nwb(ok);\nlet bad = ['nosuch', 'x'];\nwb(bad);\n";
    let calls = wb_calls("ui/src/fake.ts", source);
    let words: Vec<_> = calls.iter().map(|c| c.words.join(" ")).collect();
    assert_eq!(
        words,
        vec!["page tree", "page nosuch", "thread list", "nosuch x"]
    );
    assert_eq!(
        calls_not_in_table(&calls, &table),
        vec![
            "ui/src/fake.ts:2: wb page nosuch",
            "ui/src/fake.ts:5: wb nosuch x"
        ]
    );
}

#[test]
fn a_new_call_the_check_cannot_read_fails_naming_its_place() {
    let source = "wb(argv);\nwb([...args, '--yes']);\nwb(['page', 'tree']);\n";
    let calls = wb_calls("ui/src/fake.ts", source);
    assert_eq!(calls.iter().filter(|c| c.words.is_empty()).count(), 2);
    // pinned at 1: the second one is new, and it is named
    let bad = unreadable_problems(&calls, &[("ui/src/fake.ts", 1)]);
    assert_eq!(bad.len(), 1, "{bad:?}");
    assert!(bad[0].contains(
        "the check cannot read this `wb(...)` call; pass a literal array or add a reason"
    ));
    assert!(
        bad[0].contains("ui/src/fake.ts:1, ui/src/fake.ts:2"),
        "{bad:?}"
    );
    // pinned exactly: fine; pinned too high: it must come down
    assert!(unreadable_problems(&calls, &[("ui/src/fake.ts", 2)]).is_empty());
    assert!(unreadable_problems(&calls, &[("ui/src/fake.ts", 3)])[0].contains("lower it"));
}
