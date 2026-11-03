//! Arguments the way the Python `wb` (argparse) reads them: options anywhere (`--x value`, `--x=value`, flags), and
//! positionals filled in order, each taking one value, an optional one (`?`), any number (`*`) or at least one (`+`).

use std::collections::HashMap;

#[derive(Clone, Copy, PartialEq)]
pub enum N {
    One,
    Opt,
    Any,
    Many,
}

pub enum Spec {
    Pos(&'static str, N),
    /// An option taking a value, with its default.
    Opt(&'static str, Option<&'static str>),
    /// An option that may be given several times (argparse's action="append").
    Append(&'static str),
    Flag(&'static str),
}

pub use Spec::{Append, Flag, Opt, Pos};

#[derive(Default, Debug)]
pub struct Args {
    pos: HashMap<&'static str, Vec<String>>,
    opts: HashMap<&'static str, Option<String>>,
    lists: HashMap<&'static str, Vec<String>>,
    flags: HashMap<&'static str, bool>,
}

impl Args {
    /// A positional: its values joined by spaces (argparse's nargs lists are joined by every command that takes them).
    pub fn s(&self, name: &str) -> String {
        self.pos.get(name).map(|v| v.join(" ")).unwrap_or_default()
    }
    pub fn list(&self, name: &str) -> Vec<String> {
        self.pos.get(name).cloned().or_else(|| self.lists.get(name).cloned()).unwrap_or_default()
    }
    pub fn has(&self, name: &str) -> bool {
        self.pos.get(name).is_some_and(|v| !v.is_empty())
    }
    pub fn opt(&self, name: &str) -> Option<String> {
        self.opts.get(name).cloned().flatten()
    }
    pub fn opt_or(&self, name: &str, default: &str) -> String {
        self.opt(name).unwrap_or_else(|| default.to_string())
    }
    pub fn int(&self, name: &str) -> Result<i64, String> {
        match self.opt(name) {
            None => Ok(0),
            Some(v) => v.parse().map_err(|_| format!("argument --{}: invalid int value: '{v}'", name.replace('_', "-"))),
        }
    }
    pub fn flag(&self, name: &str) -> bool {
        self.flags.get(name).copied().unwrap_or(false)
    }
}

fn key(flag: &str) -> String {
    flag.trim_start_matches('-').replace('-', "_")
}

const INT_OPTIONS: &[&str] = &["offset", "within"];

pub fn parse(specs: &[Spec], argv: &[String]) -> Result<Args, String> {
    let mut a = Args::default();
    for s in specs {
        match s {
            Opt(n, d) => {
                a.opts.insert(n, d.map(String::from));
            }
            Append(n) => {
                a.lists.insert(n, vec![]);
            }
            Flag(n) => {
                a.flags.insert(n, false);
            }
            Pos(..) => {}
        }
    }
    a.flags.insert("json", false);
    let mut positionals = vec![];
    let mut i = 0;
    while i < argv.len() {
        let t = &argv[i];
        if t.starts_with("--") && t.len() > 2 {
            let (name, inline) = match t.split_once('=') {
                Some((n, v)) => (key(n), Some(v.to_string())),
                None => (key(t), None),
            };
            let spec = specs.iter().find(|s| matches!(s, Opt(n, _) | Append(n) | Flag(n) if **n == name));
            match spec {
                Some(Flag(n)) => {
                    a.flags.insert(n, true);
                }
                Some(Opt(n, _)) | Some(Append(n)) => {
                    let v = match inline {
                        Some(v) => v,
                        None => {
                            i += 1;
                            argv.get(i).cloned().ok_or(format!("argument --{}: expected one argument", n.replace('_', "-")))?
                        }
                    };
                    if let Some(Append(_)) = spec {
                        a.lists.get_mut(n).unwrap().push(v);
                    } else {
                        a.opts.insert(n, Some(v));
                    }
                }
                _ if name == "json" => {
                    a.flags.insert("json", true);
                }
                _ => return Err(format!("unrecognized arguments: {t}")),
            }
        } else {
            positionals.push(t.clone());
        }
        i += 1;
    }
    // Fill positionals in order, leaving enough for those still required after each.
    let pos: Vec<(&'static str, N)> = specs.iter().filter_map(|s| if let Pos(n, k) = s { Some((*n, *k)) } else { None }).collect();
    let mut rest = &positionals[..];
    for (k, (name, n)) in pos.iter().enumerate() {
        let need_after: usize = pos[k + 1..].iter().map(|(_, m)| matches!(m, N::One | N::Many) as usize).sum();
        let avail = rest.len().saturating_sub(need_after);
        let take = match n {
            N::One | N::Many if avail == 0 => return Err(format!("the following arguments are required: {name}")),
            N::One => 1,
            N::Opt => avail.min(1),
            N::Any | N::Many => avail,
        };
        a.pos.insert(name, rest[..take].to_vec());
        rest = &rest[take..];
    }
    if !rest.is_empty() {
        return Err(format!("unrecognized arguments: {}", rest.join(" ")));
    }
    // whole-number options are checked here, as argparse's type=int does
    for n in INT_OPTIONS {
        if let Some(Some(v)) = a.opts.get(n) {
            if v.parse::<i64>().is_err() {
                return Err(format!("argument --{n}: invalid int value: '{v}'"));
            }
        }
    }
    Ok(a)
}

/// argparse's usage line: `usage: wb <name> [-h] [--opt OPT] [--flag] [--json] pos [many ...]` (unwrapped; argparse
/// wraps lines past 78 characters).
pub fn usage(name: &str, specs: &[Spec]) -> String {
    let mut parts = vec!["[-h]".to_string()];
    let dash = |n: &str| n.replace('_', "-");
    for sp in specs {
        match sp {
            Opt(n, _) | Append(n) => parts.push(format!("[--{} {}]", dash(n), n.to_uppercase())),
            Flag(n) => parts.push(format!("[--{}]", dash(n))),
            Pos(..) => {}
        }
    }
    parts.push("[--json]".into());
    for sp in specs {
        if let Pos(n, k) = sp {
            parts.push(match k {
                N::One => n.to_string(),
                N::Opt => format!("[{n}]"),
                N::Any => format!("[{n} ...]"),
                N::Many => format!("{n} [{n} ...]"),
            });
        }
    }
    format!("usage: wb {name} {}", parts.join(" "))
}
