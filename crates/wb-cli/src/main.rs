//! `wb`: every Bible Workbench feature from a command line, so an AI (or the person, in a terminal) can do anything the
//! window does. The same commands, arguments and output as the Python app's `wb` (docs/PLAN.md section 2.2): JSON unless a
//! command prints text; `--json` forces JSON. Errors go to standard error as `error: ...`, with exit code 1.

mod args;
mod read;
mod study;

use args::{Args, Spec};
use serde_json::Value;
use std::cell::OnceCell;
use wb_core::bible::Bible;

pub enum Out {
    Text(String),
    Json(Value),
    Nothing,
}

pub type Res = Result<Out, String>;

pub struct Ctx {
    bible: OnceCell<Bible>,
    study: OnceCell<wb_core::study::Study>,
}

impl Ctx {
    pub fn bible(&self) -> Result<&Bible, String> {
        if self.bible.get().is_none() {
            let b = Bible::open(&wb_core::default_db_path()).map_err(|e| e.to_string())?;
            let _ = self.bible.set(b);
        }
        Ok(self.bible.get().unwrap())
    }

    pub fn study(&self) -> Result<&wb_core::study::Study, String> {
        if self.study.get().is_none() {
            let s = wb_core::study::Study::open(&wb_core::default_study_dir()).map_err(|e| e.to_string())?;
            let _ = self.study.set(s);
        }
        Ok(self.study.get().unwrap())
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
    pub run: fn(&Ctx, &Args) -> Res,
}

pub fn cmd(name: &'static str, summary: &'static str, args: Vec<Spec>, run: fn(&Ctx, &Args) -> Res) -> Command {
    Command { name, summary, args, run }
}

fn commands() -> Vec<Command> {
    let mut all = vec![cmd("help", "List the commands, or explain one (wb help thread add).", vec![Spec::Pos("topic", args::N::Any)], help)];
    all.extend(read::commands());
    all.extend(study::commands());
    all
}

fn help(_: &Ctx, a: &Args) -> Res {
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

fn dispatch(argv: &[String]) -> Result<(Out, bool), String> {
    let argv: Vec<String> = if argv.is_empty() || argv[0] == "-h" || argv[0] == "--help" { vec!["help".into()] } else { argv.to_vec() };
    let all = commands();
    // a group name alone ("wb thread") shows that group
    if argv.len() == 1 && !all.iter().any(|c| c.name == argv[0]) && all.iter().any(|c| c.name.split(' ').next() == Some(&argv[0]) && c.name.contains(' ')) {
        return dispatch(&["help".to_string(), argv[0].clone()]);
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
        return Err(format!("Unknown command “{}”.{} Try: wb help", argv[0], if hits.is_empty() { String::new() } else { format!(" Did you mean {}?", hits.join(", ")) }));
    };
    let a = args::parse(&c.args, rest).map_err(|e| format!("wb {}: {e}", c.name))?;
    let ctx = Ctx { bible: OnceCell::new(), study: OnceCell::new() };
    Ok(((c.run)(&ctx, &a)?, a.flag("json")))
}

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    match dispatch(&argv) {
        Ok((Out::Nothing, _)) => {}
        Ok((Out::Text(t), false)) => println!("{t}"),
        Ok((Out::Text(t), true)) => println!("{}", serde_json::to_string_pretty(&Value::String(t)).unwrap()),
        Ok((Out::Json(v), _)) => println!("{}", serde_json::to_string_pretty(&v).unwrap()),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
