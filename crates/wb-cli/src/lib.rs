//! `wb`: every Bible Workbench feature from a command line, so an AI (or the person, in a terminal) can do anything the
//! window does. The same commands, arguments and output as the Python app's `wb` (docs/archive/2026-11-10/docs/PLAN.md section 2.2): JSON unless a
//! command prints text; `--json` forces JSON. Errors go to standard error as `error: ...`, with exit code 1.
//!
//! The command table is a library so that the window runs the same table in-process (`run` with `Ctx::lent`): the UI
//! and `wb` are one set of actions.

mod args;
mod docs;
mod library;
mod mycommands;
mod notebook;
mod pages;
mod read;
mod reading;
mod setup;
mod study;
mod tether;
mod update;

use args::{Args, Spec};
use std::cell::{OnceCell, RefCell, RefMut};
use std::path::PathBuf;
use wb_core::bible::Bible;
use wb_core::store::Store;

pub enum Out {
    Text(String),
    Json(serde_json::Value),
    Nothing,
}

pub type Res = Result<Out, String>;

/// Why a command did not run: its arguments (the usage line and the error, exit code 2) or the request itself (exit 1).
#[derive(Debug)]
pub enum Fail {
    Usage(String),
    Error(String),
}

/// What a command answers when the study folder is already held by the command itself (a borrow inside a borrow).
pub const BUSY: &str = "the study folder is busy";

/// Where a command gets the Bible and the study folder: opened when first needed (a `wb` run), or lent by the window,
/// which keeps one of each open.
pub struct Ctx<'a> {
    bible: OnceCell<Bible>,
    lent_bible: Option<&'a Bible>,
    study: RefCell<Option<Store>>,
    lent_study: Option<RefCell<&'a mut Store>>,
    /// The lent study folder's path, kept apart so `root()` never borrows the store: a command that holds `study()` and
    /// asks for `root()` (the Notebook's side list, Recents) works in the window as it does in a terminal.
    lent_root: Option<PathBuf>,
    /// What `-` reads (standard input for `wb`; text sent along with the call in the window).
    pub input: Option<String>,
}

impl Ctx<'static> {
    pub fn new() -> Ctx<'static> {
        Ctx { bible: OnceCell::new(), lent_bible: None, study: RefCell::new(None), lent_study: None, lent_root: None, input: None }
    }
}

impl Default for Ctx<'static> {
    fn default() -> Self {
        Ctx::new()
    }
}

impl<'a> Ctx<'a> {
    pub fn lent(bible: &'a Bible, study: &'a mut Store) -> Ctx<'a> {
        let root = study.root.clone();
        Ctx { bible: OnceCell::new(), lent_bible: Some(bible), study: RefCell::new(None), lent_study: Some(RefCell::new(study)), lent_root: Some(root), input: None }
    }

    pub fn bible(&self) -> Result<&Bible, String> {
        if let Some(b) = self.lent_bible {
            return Ok(b);
        }
        if self.bible.get().is_none() {
            let b = Bible::open(&wb_core::default_db_path()).map_err(|e| e.to_string())?;
            let _ = self.bible.set(b);
        }
        Ok(self.bible.get().unwrap())
    }

    pub fn study(&self) -> Result<RefMut<'_, Store>, String> {
        if let Some(s) = &self.lent_study {
            return Ok(RefMut::map(s.try_borrow_mut().map_err(|_| BUSY)?, |s| &mut **s));
        }
        let mut slot = self.study.try_borrow_mut().map_err(|_| BUSY)?;
        if slot.is_none() {
            *slot = Some(Store::open(&wb_core::default_study_dir()).map_err(|e| e.to_string())?);
        }
        Ok(RefMut::map(slot, |s| s.as_mut().unwrap()))
    }

    /// The study folder itself (for the files the store does not hold: reading plans and the log).
    pub fn root(&self) -> Result<PathBuf, String> {
        if let Some(r) = &self.lent_root {
            return Ok(r.clone());
        }
        let r = wb_core::default_study_dir();
        wb_core::store::guard(&r).map_err(|e| e.to_string())?;
        Ok(r)
    }

    /// Text for `-`: what was sent along, else standard input.
    pub fn stdin(&self) -> Result<String, String> {
        if let Some(t) = &self.input {
            return Ok(t.clone());
        }
        if self.lent_study.is_some() {
            return Err("Nothing was sent to read for -.".into());
        }
        use std::io::Read;
        let mut s = String::new();
        std::io::stdin().read_to_string(&mut s).map_err(|x| x.to_string())?;
        Ok(s)
    }

    pub fn span(&self, text: &str) -> Result<wb_core::places::Span, String> {
        wb_core::places::parse_span(text, self.bible()?.books()).map_err(|e| e.0)
    }

    pub fn scope(&self, text: &str) -> Result<String, String> {
        wb_core::places::scope_of(text, self.bible()?.books()).map_err(|e| e.0)
    }
}

pub struct Command {
    pub name: &'static str,
    pub summary: &'static str,
    pub args: Vec<Spec>,
    pub run: fn(&Ctx<'_>, &Args) -> Res,
}

pub fn cmd(name: &'static str, summary: &'static str, args: Vec<Spec>, run: fn(&Ctx<'_>, &Args) -> Res) -> Command {
    Command { name, summary, args, run }
}

fn commands() -> Vec<Command> {
    let mut all = vec![cmd("help", "List the commands, or explain one (wb help thread add).", vec![Spec::Pos("topic", args::N::Any)], help)];
    all.extend(read::commands());
    all.extend(study::commands());
    all.extend(reading::commands());
    all.extend(mycommands::commands());
    all.extend(notebook::commands());
    all.extend(pages::commands());
    all.extend(library::commands());
    all.extend(docs::commands());
    all.extend(setup::commands());
    all.extend(tether::commands());
    all.extend(update::commands());
    all
}

fn help(_: &Ctx<'_>, a: &Args) -> Res {
    let all = commands();
    let want = a.s("topic");
    if !want.is_empty() {
        let hits: Vec<&Command> = match all.iter().find(|c| c.name == want) {
            Some(c) => vec![c],
            None => all.iter().filter(|c| c.name.starts_with(&want)).collect(),
        };
        if hits.is_empty() {
            return Err(format!("No command called “{want}”. Try: wb help"));
        }
        return Ok(Out::Text(hits.iter().map(|c| format!("wb {}\n\n{}", c.name, c.summary)).collect::<Vec<_>>().join("\n\n")));
    }
    let mut lines = vec!["wb: Bible Workbench from a command line (the Rust rebuild; phase 1 has the data commands).".to_string(), String::new()];
    lines.extend(all.iter().map(|c| format!("  {:<22} {}", c.name, c.summary.lines().next().unwrap_or(""))));
    lines.push(String::new());
    lines.push("Places are typed as in the capture box: John 3:16, Num 25:10-26:4, Romans. WB_BIBLE_DB: the Bible database (read-only); WB_STUDY_DIR: the study folder.".into());
    Ok(Out::Text(lines.join("\n")))
}

/// The commands' names and one-line summaries (for the window's help and suggestions).
pub fn names() -> Vec<(&'static str, &'static str)> {
    commands().iter().map(|c| (c.name, c.summary)).collect()
}

/// Runs one command line (without the leading `wb`). → its output, and whether `--json` was given.
pub fn run(ctx: &Ctx<'_>, argv: &[String]) -> Result<(Out, bool), Fail> {
    wb_core::runtime::require_license().map_err(|e| Fail::Error(e.to_string()))?;
    let argv: Vec<String> = if argv.is_empty() || argv[0] == "-h" || argv[0] == "--help" { vec!["help".into()] } else { argv.to_vec() };
    let all = commands();
    // R1: a note is a page. `wb page show`, `wb page text` … are `wb note …` under the new name (`wb note` stays, as the Python
    // `wb` has it); a `wb page` command of its own (tree, new, blocks …) is never taken for a note's.
    // `wb page text ID` is the page's contents (notebook row 33); with new text after the id (`wb page text ID "new text"`, `-` for standard input) it is the note's, as before
    let writes_text = argv.len() >= 4 && argv[0] == "page" && argv[1] == "text" && argv[3..].iter().any(|x| x == "-" || !x.starts_with("--"));
    let argv: Vec<String> = if argv.len() >= 2 && argv[0] == "page" && (writes_text || !all.iter().any(|c| c.name == format!("page {}", argv[1]))) && all.iter().any(|c| c.name == format!("note {}", argv[1])) {
        let mut v = argv.clone();
        v[0] = "note".into();
        v
    } else {
        argv
    };
    // a group name alone ("wb thread") shows that group
    if argv.len() == 1 && !all.iter().any(|c| c.name == argv[0]) && all.iter().any(|c| c.name.split(' ').next() == Some(&argv[0]) && c.name.contains(' ')) {
        return run(ctx, &["help".to_string(), argv[0].clone()]);
    }
    let mut found = None;
    for n in [2, 1] {
        if argv.len() >= n {
            let key = argv[..n].join(" ");
            if let Some(c) = all.iter().find(|c| c.name == key) {
                found = Some((c, &argv[n..]));
                break;
            }
        }
    }
    let Some((c, rest)) = found else {
        let mut hits: Vec<&str> = all.iter().filter(|c| c.name.starts_with(&argv[0])).map(|c| c.name.split(' ').next().unwrap()).collect();
        hits.dedup();
        return Err(Fail::Error(format!("Unknown command “{}”.{} Try: wb help", argv[0], if hits.is_empty() { String::new() } else { format!(" Did you mean {}?", hits.join(", ")) })));
    };
    let a = args::parse(&c.args, rest).map_err(|msg| Fail::Usage(format!("{}
wb {}: error: {msg}", args::usage(c.name, &c.args), c.name)))?;
    // Serialize page writes, including read-before-write decisions. Unrelated commands
    // keep working on read-only studies and without a configured study folder.
    let _writer = if changes_page_files(c.name) {
        let root = ctx.root().map_err(Fail::Error)?;
        let lock = wb_core::deletion::writer_lock(&root).map_err(|e| Fail::Error(e.to_string()))?;
        let mut store = ctx.study().map_err(Fail::Error)?;
        store.look_again();
        store.refresh().map_err(|e| Fail::Error(e.to_string()))?;
        Some(lock)
    } else {
        None
    };
    Ok(((c.run)(ctx, &a).map_err(Fail::Error)?, a.flag("json")))
}

#[cfg(all(test, feature = "distribution"))]
#[test]
fn license_gate_blocks_dispatch_without_initialized_activation() {
    // Direct library callers must not bypass the standalone CLI's bootstrap gate.
    let result = run(&Ctx::new(), &["help".into()]);
    assert!(matches!(result, Err(Fail::Error(message)) if message.contains("initialized")));
}

fn changes_page_files(command: &str) -> bool {
    matches!(command,
        "note add" | "note new" | "note edit" | "note text" | "note rm" | "note jot" |
        "note place" | "note move" | "note question" | "note answered" | "note also" |
        "note unplace" | "note thread" | "note relink" | "thread write" | "thread delete" |
        "inbox edit" | "inbox rm" | "trail add" | "trail edit" | "trail done" | "trail reopen" |
        "trail rm" | "question add" | "question answer" | "question fold" | "question unfold" |
        "day add" | "day text" | "day rm" | "page new" | "page move" | "page pin" |
        "page unpin" | "page title" | "mark grow" |
        "block scripture" | "block thread" | "block word" | "block view" | "page prop" | "block set" |
        "callout kind" | "block add" | "block color" | "block dup" | "block rm" | "block undo" | "block move" | "block link" | "tether accept" | "template new" |
        "template save" | "template set" | "template rm" | "trash restore" | "history keep"
    )
}

/// One command line run for the window: `{"json": ...}` or `{"text": "..."}`, or the error's message.
pub fn run_value(ctx: &Ctx<'_>, argv: &[String]) -> Result<serde_json::Value, String> {
    match run(ctx, argv) {
        Ok((Out::Json(v), _)) => Ok(serde_json::json!({ "json": v })),
        Ok((Out::Text(t), _)) => Ok(serde_json::json!({ "text": t })),
        Ok((Out::Nothing, _)) => Ok(serde_json::json!({})),
        Err(Fail::Usage(m)) | Err(Fail::Error(m)) => Err(m),
    }
}
