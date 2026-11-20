//! The command language of the capture box (the Python app's `web/commands.js`), parsed once here and returned as a
//! typed action. The desktop command field, the phone palette and `wb do` all use it; what an action does is up to the
//! window (a pane on the desktop, a sheet on a phone).
//!
//! An action serializes as the Python parser's object did (`{"cmd": "uses", "strong": "", "word": "zeal", ...}`), with a
//! book as its code. `tests/commands-cases.json` is the Rust-maintained compatibility baseline, including cases from
//! the command manual. The tests compare this parser with those reviewed expected values.
//!
//! New in the Rust app: the Notebook's `jot`, `place`, `journal`, `inbox` and `notebook`, and `window` (the test sizes).

use crate::bible::Book;
use crate::places::{match_book, parse_span, Span, GROUPS};
use serde::Serialize;
use serde_json::Value;
use std::sync::OnceLock;

pub const COLORS: &[&str] = &["yellow", "green", "blue", "pink", "orange"];
/// How `copy` can lay verses out (the same names as the scripture module's copy formats).
pub const COPY_FORMATS: &[&str] = &["lines", "block", "para", "quote"];
pub const DECK_STRUCTURES: &[&str] = &["reader", "pulpit", "verse", "table", "map"];
pub const DOC_STRUCTURES: &[&str] = &["reading", "share", "script", "study", "dossier"];
pub const EXPORT_THEMES: &[&str] = &["vellum", "vigil", "olivet", "veil", "daylight", "print"];
/// The window sizes of docs/archive/2026-11-10/docs/PLAN.md section 7.
pub const WINDOW_SIZES: &[&str] = &["phone", "phone-landscape", "ipad", "ipad-landscape", "laptop", "laptop-large", "desktop"];

/// A verse or a run of verses named with `@`: its anchor and how it reads.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct At {
    pub anchor: String,
    pub label: String,
}

/// A stretch of a book as `open` and `interlinear` read it (a verse of 0: from the start / to the end of the chapter).
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Stretch {
    pub book: String,
    pub c1: u32,
    pub v1: u32,
    pub c2: u32,
    pub v2: u32,
}

impl From<&Span> for Stretch {
    fn from(s: &Span) -> Self {
        Stretch { book: s.book.code.clone(), c1: s.c1, v1: s.v1, c2: s.c2, v2: s.v2 }
    }
}

/// What goes into a set: a pane by its name, a thread, lesson, PDF or note by name, or a place.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SetItem {
    Pane { name: String },
    Thread { name: String },
    Lesson { name: String },
    Pdf { name: String },
    Note { name: String },
    Place { anchor: String, label: String },
}

/// A place in a thread to move: its number in the list, or an anchor (a verse, a run, H7065).
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum Member {
    Number(u32),
    Anchor(String),
}

/// One line of the box, understood. `scope` is what the lookups take: all, OT, NT, a book id, or book ids joined by
/// commas.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "cmd", rename_all = "lowercase")]
pub enum Action {
    #[serde(rename = "none")]
    Nothing,
    /// `?question`: a question at the place (a trail).
    Ask { text: String, #[serde(skip_serializing_if = "Option::is_none")] at: Option<At> },
    /// `+name`: the place into a thread (a new name starts one).
    Thread { name: String, #[serde(skip_serializing_if = "Option::is_none")] at: Option<At> },
    Def { q: String },
    Uses { strong: String, word: String, scope: String },
    First { strong: String, word: String, scope: String },
    Last { strong: String, word: String, scope: String },
    Count { strong: String, word: String, scope: String },
    Forms { word: String },
    Search { q: String, #[serde(skip_serializing_if = "Option::is_none")] scope: Option<String>, #[serde(skip_serializing_if = "Option::is_none")] suspect: Option<String> },
    Find { q: String },
    Open { book: String, ch: u32, v: u32, v2: u32, version: String },
    Go { book: String, ch: u32, v: u32, v2: u32, version: String },
    Excerpt { spans: Vec<Stretch>, version: String },
    Help { topic: String },
    Interlinear { span: Stretch },
    Copy {
        action: String,
        #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
        place: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        version: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        format: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        short: Option<bool>,
    },
    Preview { q: String, version: String },
    Hover { mode: String },
    Near { a: String, b: String, within: u32, scope: String },
    Lexiconc { q: String },
    Lex { source: String, strong: String },
    Today { day: String },
    Layout { action: String, name: String },
    Sets,
    Set {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        items: Option<Vec<SetItem>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parts: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        to: Option<String>,
    },
    Next,
    Prev,
    Back,
    Listen {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        rate: Option<serde_json::Number>,
        #[serde(skip_serializing_if = "Option::is_none")]
        all: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        span: Option<Stretch>,
    },
    /// `hl yellow`, `hl #e07b39`, `hl c3` (a saved color, looked up when it runs), `hl clear` (color null).
    Hl {
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<Option<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        saved: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        at: Option<At>,
    },
    Marked {
        color: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        saved: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        thread: Option<String>,
        scope: String,
    },
    Note { text: String, #[serde(skip_serializing_if = "Option::is_none")] at: Option<At> },
    ThreadRm { name: String, at: At },
    OpenThread { name: String },
    ThreadSet {
        action: String,
        plain: String,
        name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        saved: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        to: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        note: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        place: Option<Member>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    Notes {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        part: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        at: Option<At>,
    },
    Trail { action: String, part: String, #[serde(skip_serializing_if = "Option::is_none")] text: Option<String> },
    Palette {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        saved: Option<u32>,
    },
    Results {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(rename = "as", skip_serializing_if = "Option::is_none")]
        shape: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        spans: Option<Vec<Stretch>>,
    },
    Undo,
    Keys,
    Trails,
    Threads,
    Pdf,
    Pdfs { #[serde(skip_serializing_if = "Option::is_none")] name: Option<String> },
    Make {
        kind: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        thread: Option<String>,
        #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
        place: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        version: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        structure: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        theme: Option<String>,
        #[serde(rename = "new", skip_serializing_if = "Option::is_none")]
        again: Option<bool>,
    },
    Docs {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        force: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        theme: Option<String>,
    },
    Theme { #[serde(skip_serializing_if = "Option::is_none")] theme: Option<String> },
    Lesson {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        make: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pdf: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        theme: Option<String>,
    },
    Packet { names: Vec<String> },
    Layers {
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        on: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
    },
    Highlights { on: bool },
    Size { #[serde(skip_serializing_if = "Option::is_none")] step: Option<i32>, #[serde(skip_serializing_if = "Option::is_none")] percent: Option<u32> },
    Toolbar { show: bool },
    Findpage { q: String },
    Panes,
    Pane { action: String, target: String },
    /// `card Num 25:11 float|tab`: the verse card (or, from a word's anchor, the word card) as a floating pane or a tab; with
    /// neither, the card itself (design/features/words, W-4). `how` is open, float or tab.
    Card { place: String, how: String },
    // ---- new in the Rust app ----
    /// `jot <text>`: a note with no place yet, into the Notebook's Inbox; `jot ?<text>` makes it a question.
    Jot { text: String, question: bool },
    /// `place <part of an Inbox note> @John 3:16`: give an unplaced note its place.
    Place { part: String, at: At },
    Journal { day: String },
    Inbox,
    /// `notebook`: the Notebook; with filters (`notebook @Num 25 questions`), the notes they find, as a view lists them
    /// (W5): `line` holds the filters, read by `view_line`.
    Notebook {
        #[serde(skip_serializing_if = "String::is_empty")]
        line: String,
    },
    /// `window phone`: the window at one of the test sizes.
    Window { size: String },
    /// `version ylt`: the reader in that version (`version` alone: which one it is in).
    Version { version: String },
    /// `plans`: the reading plans pane.
    Plans,
    /// `findings`: the person's findings about the app (note 50c1); `finding <words>` writes one.
    Findings,
    Finding { text: String },
}

// ---- the manual and the command list (from the Python app's web/help-docs.js and commands.js) -----------------------

/// The manual: `commands` (name, usage, help), `sections`, `docs` (one entry per command or topic) and `shortcuts`.
pub fn manual() -> &'static Value {
    static M: OnceLock<Value> = OnceLock::new();
    M.get_or_init(|| serde_json::from_str(include_str!("manual.json")).expect("manual.json"))
}

/// A topic typed after `help` → its manual entry: the exact name or another word for it, else a unique start.
pub fn find_doc(topic: &str) -> Option<&'static Value> {
    let t = topic.to_lowercase().trim().to_string();
    if t.is_empty() {
        return None;
    }
    let docs = manual()["docs"].as_array()?;
    let exact = docs.iter().find(|d| d["name"] == t.as_str() || d["aka"].as_array().is_some_and(|a| a.iter().any(|x| x == t.as_str())));
    if exact.is_some() {
        return exact;
    }
    let pre: Vec<&Value> = docs.iter().filter(|d| d["name"].as_str().is_some_and(|n| n.chars().count() > 1 && n.starts_with(&t))).collect();
    if pre.len() == 1 { Some(pre[0]) } else { None }
}

/// The commands' names, in the manual's order, then the ones new in the Rust app.
pub fn command_names() -> Vec<String> {
    let mut v: Vec<String> = manual()["commands"].as_array().map(|a| a.iter().filter_map(|c| c["name"].as_str().map(String::from)).collect()).unwrap_or_default();
    v.extend(["jot", "place", "journal", "inbox", "notebook", "window", "version", "plans", "findings", "finding", "focus", "unfocus", "card"].map(String::from));
    v
}

// ---- small pieces --------------------------------------------------------------------------------------------------

fn re(pat: &str) -> regex::Regex {
    regex::Regex::new(pat).unwrap()
}

macro_rules! regex {
    ($pat:expr) => {{
        static R: OnceLock<regex::Regex> = OnceLock::new();
        R.get_or_init(|| re($pat))
    }};
}

fn is_strong(t: &str) -> bool {
    regex!(r"^(?i)[hg][0-9]{1,4}$").is_match(t)
}

fn is_word(t: &str) -> bool {
    let n = t.chars().count();
    (1..=40).contains(&n) && t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '’' || c == '\'' || c == '-')
}

fn words(s: &str) -> Vec<String> {
    s.split_whitespace().map(String::from).collect()
}

fn ucfirst(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

/// What a reference with a verse reads as: one verse, or a run of verses in a chapter.
struct Ref {
    book: Book,
    ch: u32,
    v: u32,
    v2: u32,
}

/// "Num 25:11", "John 3", "1 Cor 13:4-7" (one chapter at most).
fn parse_ref(text: &str, books: &[Book]) -> Result<Ref, String> {
    let r = regex!(r"^\s*(.+?)\s*([0-9]+)(?::([0-9]+)(?:\s*[-–]\s*([0-9]+))?)?\s*$");
    let Some(m) = r.captures(text) else { return Err("Give a reference like John 3:16 or Num 25.".into()) };
    let book = match_book(&m[1], books).map_err(|e| e.0)?.clone();
    let n = |i: usize| m.get(i).map(|x| x.as_str().parse::<u32>().unwrap_or(u32::MAX)).unwrap_or(0);
    let ch = n(2);
    if ch < 1 || ch > book.chapters {
        return Err(format!("{} has {} chapter{}.", book.name, book.chapters, if book.chapters == 1 { "" } else { "s" }));
    }
    Ok(Ref { ch, v: n(3), v2: n(4), book })
}

fn verse_at(r: &Ref) -> At {
    let (c, run) = (&r.book.code, r.v2 > r.v);
    At {
        anchor: if run { format!("{c}.{}:{}-{}:{}", r.ch, r.v, r.ch, r.v2) } else { format!("{c}.{}:{}", r.ch, r.v) },
        label: format!("{} {}:{}{}", r.book.name, r.ch, r.v, if run { format!("–{}", r.v2) } else { String::new() }),
    }
}

/// A trailing "@John 3:16" names the place a note, highlight, trail or thread-add belongs to. → the text before it and
/// the place, if one was named.
pub fn split_at(s: &str, books: &[Book]) -> Result<(String, Option<At>), String> {
    let Some(m) = regex!(r"(?:^|\s)@(\S.*[0-9].*)$").captures(s) else { return Ok((s.trim().to_string(), None)) };
    let text = s[..m.get(0).unwrap().start()].trim().to_string();
    let r = match parse_ref(&m[1], books) {
        Ok(r) => r,
        Err(e) if e.starts_with("Which book") || e.starts_with("No book") || e.contains("chapter") => return Err(e),
        Err(_) => return Err("Put the place at the end, like: note your words @John 3:16".into()),
    };
    if r.v == 0 {
        return Err(format!("Add a verse after the chapter, like @{} {}:1", r.book.name, r.ch));
    }
    if r.v2 != 0 && r.v2 < r.v {
        return Err("A verse range runs upward, like @John 3:16-18".into());
    }
    Ok((text, Some(verse_at(&r))))
}

// ---- a view's line (W5 of "The Notebook as a workspace") -----------------------------------------------------------

/// What a view's line asks for: `notebook` and its filters, any of them, in any order (`notebook @Num 25 questions`,
/// `notebook thread phinehas`, `notebook days 7`). A view block, the command field and `wb view run` read a line with
/// this one parser, so all three list the same notes. Views read; they never write.
#[derive(Serialize, Debug, Clone, PartialEq, Default)]
pub struct ViewQuery {
    /// A Notebook page section, using that section's grouping and page scope.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_questions: Option<String>,
    /// `@place`: the notes on it or on any verse in it (a verse, a run, a chapter, a book), or on a Strong's number
    /// (`@H7065`). Kept as a reference that reads again ("Numbers 25", "Numbers 25:10-13").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub place: Option<String>,
    /// `questions` (all), `open` (open questions) or `answered`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub questions: Option<String>,
    /// `thread <name>`: one word, or a name in quotes (`thread "the zeal of God"`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread: Option<String>,
    /// `days N`: written in the last N days (today is one of them).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days: Option<u32>,
    /// `pages`: only the notes with no place (pages of their own).
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub pages: bool,
    /// Explicit post-R1 Notebook kind filter, or all page kinds including thread pages.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    /// Any other word: every one must be in the note (its text, title, places or threads).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub words: Vec<String>,
}

/// A line's words, a phrase in quotes ("…" or “…”) kept as one.
fn quoted_words(s: &str, scoped: bool) -> Result<Vec<(String, bool)>, String> {
    let mut out = vec![];
    let mut cur = String::new();
    let mut quote: Option<char> = None;
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        match quote {
            Some('"') if scoped && c == '\\' && matches!(chars.peek(), Some('"' | '\\')) => {
                cur.push(chars.next().unwrap());
            }
            Some(q) if c == q || (q == '“' && c == '”') => {
                out.push((std::mem::take(&mut cur), true));
                quote = None;
            }
            Some(_) => cur.push(c),
            None if c == '"' || c == '“' => {
                if !cur.is_empty() {
                    out.push((std::mem::take(&mut cur), false));
                }
                quote = Some(c);
            }
            None if c.is_whitespace() => {
                if !cur.is_empty() {
                    out.push((std::mem::take(&mut cur), false));
                }
            }
            None => cur.push(c),
        }
    }
    if quote.is_some() {
        return Err("A name in quotes needs its closing quote, like: notebook thread \"the zeal of God\"".into());
    }
    if !cur.is_empty() {
        out.push((cur, false));
    }
    Ok(out.into_iter().filter(|(w, _)| !w.trim().is_empty()).collect())
}

/// A place as a reference that reads again: the label with a plain hyphen ("Numbers 25:10-13").
pub fn span_ref(sp: &Span) -> String {
    crate::places::span_label(sp).replace('–', "-")
}

/// Read a view's line (with or without its leading `notebook`): see `ViewQuery`.
pub fn view_line(line: &str, books: &[Book]) -> Result<ViewQuery, String> {
    let mut start = line.split_whitespace();
    let first = start.next().unwrap_or_default();
    let scoped = first.eq_ignore_ascii_case("section")
        || (first.eq_ignore_ascii_case("notebook") && start.next().is_some_and(|w| w.eq_ignore_ascii_case("section")));
    let mut t = quoted_words(line, scoped)?;
    if t.first().is_some_and(|(w, _)| w.eq_ignore_ascii_case("notebook")) {
        t.remove(0);
    }
    let mut q = ViewQuery::default();
    let mut i = 0;
    while i < t.len() {
        let (w, quoted) = &t[i];
        let low = w.to_lowercase();
        if scoped && *quoted {
            q.words.push(low);
            i += 1;
            continue;
        }
        if let Some(first) = w.strip_prefix('@') {
            if scoped && first.is_empty() {
                if let Some((place, true)) = t.get(i + 1) {
                    if q.place.replace(place.clone()).is_some() {
                        return Err("A view has one @place.".into());
                    }
                    i += 2;
                    continue;
                }
            }
            // the longest run of words after @ that is a place: "@Num 25 questions" is Num 25, then questions
            let mut rest: Vec<String> = if first.is_empty() { vec![] } else { vec![first.to_string()] };
            rest.extend(t[i + 1..].iter().take_while(|(_, quoted)| !scoped || !quoted).map(|(w, _)| w.clone()));
            let mut took = None;
            for k in (1..=rest.len().min(5)).rev() {
                let cand = rest[..k].join(" ");
                if is_strong(&cand) {
                    took = Some((k, cand.to_uppercase()));
                    break;
                }
                if let Ok(sp) = parse_span(&cand, books) {
                    // "@Num 99": a book, then a chapter it does not have, is that error (not Numbers and the word 99)
                    if let Some(next) = rest.get(k).filter(|n| n.starts_with(|c: char| c.is_ascii_digit())) {
                        return Err(parse_span(&format!("{cand} {next}"), books).err().map(|e| e.0).unwrap_or_else(|| "Give a place like @Num 25 or @Num 25:11".into()));
                    }
                    took = Some((k, span_ref(&sp)));
                    break;
                }
            }
            let Some((k, place)) = took else {
                return Err(format!("“{}” is not a place: try @Num 25, @Num 25:11, @Numbers or @H7065", rest.first().map(String::as_str).unwrap_or("")));
            };
            if q.place.is_some() {
                return Err("A view has one @place.".into());
            }
            q.place = Some(place);
            i += k + usize::from(first.is_empty());
            continue;
        }
        match low.as_str() {
            "section" if scoped => {
                q.section = Some(t.get(i + 1).map(|(w, _)| w.to_lowercase())
                    .filter(|w| matches!(w.as_str(), "all" | "days" | "pages" | "places"))
                    .ok_or("section takes all, days, pages or places.")?);
                i += 1;
            }
            "folder" if scoped => {
                q.folder = Some(t.get(i + 1).map(|(w, _)| w.clone()).ok_or("folder takes a folder name.")?);
                i += 1;
            }
            "page-questions" if scoped => {
                q.page_questions = Some(t.get(i + 1).map(|(w, _)| w.to_lowercase())
                    .filter(|w| matches!(w.as_str(), "open" | "answered"))
                    .ok_or("page-questions takes open or answered.")?);
                i += 1;
            }
            "questions" | "question" => q.questions = Some(q.questions.take().unwrap_or_else(|| "all".into())),
            "open" => q.questions = Some("open".into()),
            "answered" => q.questions = Some("answered".into()),
            "pages" => q.pages = true,
            "kind" => {
                let kind = t.get(i + 1).map(|(x, _)| x.to_lowercase()).filter(|x| matches!(x.as_str(), "all" | "note" | "question" | "day" | "thread"));
                q.kind = Some(kind.ok_or_else(|| "kind takes all, note, question, day or thread.".to_string())?);
                i += 1;
            }
            "days" => {
                let n = t.get(i + 1).and_then(|(x, _)| x.parse::<u32>().ok()).filter(|n| (1..=3650).contains(n));
                let Some(n) = n else { return Err("days takes a number: notebook days 7 (written in the last 7 days)".into()) };
                q.days = Some(n);
                i += 1;
            }
            "thread" => {
                let Some((name, _)) = t.get(i + 1).filter(|(x, _)| !x.starts_with('@')) else {
                    return Err("thread takes a thread's name: notebook thread phinehas (a name of more words in quotes)".into());
                };
                q.thread = Some(name.clone());
                i += 1;
            }
            _ => q.words.push(low),
        }
        i += 1;
    }
    if scoped && q.questions.is_some() {
        return Err("Use page-questions open or answered to select pages, or quote the words to search for them.".into());
    }
    Ok(q)
}

fn group_scope(token: &str) -> Option<String> {
    let t: String = token.to_lowercase().chars().filter(|c| c.is_ascii_lowercase()).collect();
    if t.is_empty() {
        return None;
    }
    GROUPS.iter().find(|(k, _, _, aka)| *k == t || aka.contains(&t.as_str())).map(|(_, a, b, _)| (*a..=*b).map(|i| i.to_string()).collect::<Vec<_>>().join(","))
}

/// "ot", "nt", a group ("gospels", "minor prophets") or a book ("num", "song of solomon") at the END of the words. → the
/// scope and the words left. `lead` is how many words must remain in front.
fn take_scope(tokens: &[String], books: &[Book], lead: usize) -> (String, Vec<String>) {
    let none = ("all".to_string(), tokens.to_vec());
    let len = tokens.len();
    if len == 0 || len - 1 < lead {
        return none;
    }
    let last = tokens[len - 1].to_lowercase();
    if last == "ot" || last == "nt" {
        return (last.to_uppercase(), tokens[..len - 1].to_vec());
    }
    for n in [2, 1] {
        if len < n || len - n < lead {
            continue;
        }
        if let Some(g) = group_scope(&tokens[len - n..].join("")) {
            return (g, tokens[..len - n].to_vec());
        }
    }
    for n in [3, 2, 1] {
        if len < n || len - n < lead {
            continue;
        }
        if let Ok(b) = match_book(&tokens[len - n..].join(""), books) {
            return (b.id.to_string(), tokens[..len - n].to_vec());
        }
    }
    none
}

fn parse_uses(arg: &str, books: &[Book], cmd: &str) -> Result<Action, String> {
    let (scope, tokens) = take_scope(&words(arg), books, 1);
    if tokens.is_empty() {
        return Err(format!("{} what? Try: {cmd} zeal  or  {cmd} H7065 Num", ucfirst(cmd)));
    }
    let strongs: Vec<&String> = tokens.iter().filter(|t| is_strong(t)).collect();
    let ws: Vec<&String> = tokens.iter().filter(|t| !is_strong(t)).collect();
    if strongs.len() > 1 {
        return Err("One Strong’s number at a time.".into());
    }
    if ws.len() > 1 {
        return Err(format!("One English word at a time (use search for several). If “{}” was meant to limit it, it is not a book, group, OT or NT.", ws[ws.len() - 1]));
    }
    if ws.first().is_some_and(|w| !is_word(w)) {
        return Err("Letters only for the English word.".into());
    }
    let strong = strongs.first().map(|s| s.to_uppercase()).unwrap_or_default();
    let word = ws.first().map(|s| s.to_lowercase()).unwrap_or_default();
    Ok(match cmd {
        "first" => Action::First { strong, word, scope },
        "last" => Action::Last { strong, word, scope },
        "count" => Action::Count { strong, word, scope },
        _ => Action::Uses { strong, word, scope },
    })
}

/// A color as typed: a name or the start of one, a #rrggbb, or c1-c8 for the nth saved color (looked up when it runs).
enum Color {
    Named(String),
    Saved(u32),
}

fn color_token(t: &str) -> Option<Color> {
    if t.is_empty() {
        return None;
    }
    if regex!(r"^(?i)#[0-9a-f]{6}$").is_match(t) {
        return Some(Color::Named(t.to_lowercase()));
    }
    if let Some(m) = regex!(r"^(?i)c([1-8])$").captures(t) {
        return Some(Color::Saved(m[1].parse().unwrap()));
    }
    let low = t.to_lowercase();
    COLORS.iter().find(|c| c.starts_with(&low)).map(|c| Color::Named(c.to_string()))
}

fn color_hint() -> String {
    COLORS.join(", ")
}

fn parse_hl(arg: &str, books: &[Book]) -> Result<Action, String> {
    let (text, at) = split_at(arg, books)?;
    let word = text.trim().to_lowercase();
    if word.is_empty() {
        return Err(format!("Which color? {}, a #rrggbb, c1-c8 (a saved color), or: hl clear", color_hint()));
    }
    if ["clear", "off", "none", "remove", "x"].contains(&word.as_str()) {
        return Ok(Action::Hl { color: Some(None), saved: None, at });
    }
    match color_token(&word) {
        Some(c) if !word.contains(' ') => Ok(match c {
            Color::Named(n) => Action::Hl { color: Some(Some(n)), saved: None, at },
            Color::Saved(k) => Action::Hl { color: None, saved: Some(k), at },
        }),
        _ => Err(format!("Colors are {}, a #rrggbb like #e07b39, or c1-c8 for a saved color (or: hl clear).", color_hint())),
    }
}

fn parse_marked(arg: &str, books: &[Book]) -> Result<Action, String> {
    let mut tokens = words(arg);
    let mut thread = None;
    if let Some(at) = tokens.iter().position(|t| t.to_lowercase() == "in") {
        let name = tokens[at + 1..].join(" ");
        tokens.truncate(at);
        if name.is_empty() {
            return Err("In which thread? Like: marked in Phinehas".into());
        }
        thread = Some(name);
    }
    let first = tokens.first().and_then(|t| color_token(t));
    if first.is_some() {
        tokens.remove(0);
    }
    let (scope, rest) = take_scope(&tokens, books, 0);
    if !rest.is_empty() {
        return Err(format!("“{}” is not a color ({}, #rrggbb, c1-c8), book, group, OT or NT.", rest.join(" "), color_hint()));
    }
    let (color, saved) = match first {
        Some(Color::Named(n)) => (n, None),
        Some(Color::Saved(k)) => (String::new(), Some(k)),
        None => (String::new(), None),
    };
    Ok(Action::Marked { color, saved, thread, scope })
}

fn parse_near(arg: &str, books: &[Book]) -> Result<Action, String> {
    let mut tokens = words(arg);
    let mut within = 10;
    if let Some(w) = tokens.iter().position(|t| t.to_lowercase() == "within") {
        let n = tokens.get(w + 1).cloned().unwrap_or_default();
        let ok = !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) && n.parse::<u32>().is_ok_and(|x| (1..=50).contains(&x));
        if !ok {
            return Err("Within how many words? A number from 1 to 50, like: near zeal jealous within 20".into());
        }
        within = n.parse().unwrap();
        tokens.drain(w..w + 2);
    }
    let (scope, rest) = take_scope(&tokens, books, 2);
    if rest.len() != 2 {
        return Err("Near takes two words or Strong’s numbers, like: near zeal jealous  or  near H7065 love within 20 OT".into());
    }
    for t in &rest {
        let star = t.ends_with('*') && t.chars().count() >= 3 && is_word(&t[..t.len() - 1]);
        if !(is_strong(t) || is_word(t) || star) {
            return Err(format!("“{t}” is not a word, a word* or a Strong’s number."));
        }
    }
    let term = |t: &String| if is_strong(t) { t.to_uppercase() } else { t.to_lowercase() };
    Ok(Action::Near { a: term(&rest[0]), b: term(&rest[1]), within, scope })
}

fn check_spans(text: &str, books: &[Book]) -> Result<(), String> {
    for part in text.split(';').map(str::trim).filter(|p| !p.is_empty()) {
        parse_span(part, books).map_err(|e| e.0)?;
    }
    Ok(())
}

fn parse_copy(arg: &str, books: &[Book]) -> Result<Action, String> {
    let mut ws = words(arg);
    if ws.first().is_some_and(|w| w.to_lowercase() == "format") {
        let rest: Vec<String> = ws[1..].iter().map(|w| w.to_lowercase()).collect();
        let fmt = rest.iter().find(|w| COPY_FORMATS.contains(&w.as_str())).cloned();
        match fmt {
            Some(f) if rest.iter().all(|w| *w == f || w == "short") => {
                return Ok(Action::Copy { action: "format".into(), place: None, version: None, short: Some(rest.iter().any(|w| w == "short")), format: Some(f) })
            }
            _ => return Err(format!("Copy formats: {}. Try: copy format quote  or  copy format lines short", COPY_FORMATS.join(", "))),
        }
    }
    let (mut format, mut version, mut short) = (None, "KJV".to_string(), None);
    while let Some(last) = ws.last() {
        let w = last.to_lowercase();
        if COPY_FORMATS.contains(&w.as_str()) && format.is_none() {
            format = Some(w);
        } else if (w == "kjv" || w == "ylt") && version == "KJV" {
            version = w.to_uppercase();
        } else if w == "short" && short.is_none() {
            short = Some(true);
        } else {
            break;
        }
        ws.pop();
    }
    let place = ws.join(" ");
    check_spans(&place, books)?;
    Ok(Action::Copy { action: "copy".into(), place: Some(place), version: Some(version), format, short })
}

/// An anchor as a reference that `parse_span` reads: the verses it sits in. JHN.3:16.4 → "JHN 3:16", NUM.25:11.3-25:12.5
/// → "NUM 25:11-25:12". Empty for "H7065 everywhere", which is not a place.
pub fn anchor_ref(anchor: &str) -> String {
    let Some(m) = regex!(r"^([A-Z0-9]{3})\.([0-9]+):([0-9]+)(?:\.[0-9]+)?(?:-([0-9]+):([0-9]+)(?:\.[0-9]+)?)?$").captures(anchor) else { return String::new() };
    let start = format!("{} {}:{}", &m[1], &m[2], &m[3]);
    match (m.get(4), m.get(5)) {
        (Some(c), Some(v)) if c.as_str() != &m[2] || v.as_str() != &m[3] => format!("{start}-{}:{}", c.as_str(), v.as_str()),
        _ => start,
    }
}

fn parse_preview(arg: &str, books: &[Book]) -> Result<Action, String> {
    let m = regex!(r"^(?i)(.*?)\s+(kjv|ylt)\s*$").captures(arg);
    let q = m.as_ref().map(|m| m[1].to_string()).unwrap_or_else(|| arg.to_string()).trim().to_string();
    if q.is_empty() {
        return Err("Preview what? Try: preview John 3:16  or  preview G26".into());
    }
    if is_strong(&q) {
        return Ok(Action::Preview { q: q.to_uppercase(), version: "KJV".into() });
    }
    check_spans(&q, books)?;
    Ok(Action::Preview { q, version: m.map(|m| m[2].to_uppercase()).unwrap_or_else(|| "KJV".into()) })
}

fn parse_lex(arg: &str) -> Result<Action, String> {
    let ws = words(arg);
    let (src, num) = (ws.first().cloned().unwrap_or_default().to_lowercase(), ws.get(1).cloned().unwrap_or_default());
    if !["bdb", "strongs", "strong", "thayer", "thayers"].contains(&src.as_str()) || num.is_empty() || ws.len() > 2 {
        return Err("Try: lex bdb H7065  or  lex strongs G26".into());
    }
    if src.starts_with("thayer") {
        return Err("Thayer’s lexicon is not installed: no copy with a verified license has been found yet. BDB (Hebrew) and Strong’s are: lex bdb H7065, lex strongs G26".into());
    }
    if !is_strong(&num) {
        return Err("Give a Strong’s number like H7065 or G26.".into());
    }
    let strong = num.to_uppercase();
    if src == "bdb" && strong.starts_with('G') {
        return Err(format!("BDB is a Hebrew and Aramaic lexicon. For {strong} try: lex strongs {strong}"));
    }
    Ok(Action::Lex { source: if src == "bdb" { "bdb".into() } else { "strongs".into() }, strong })
}

/// One edit apart (a letter added, dropped, changed, or two neighbours swapped).
fn one_edit_apart(a: &str, b: &str) -> bool {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    if a == b || a.len().abs_diff(b.len()) > 1 {
        return false;
    }
    let mut i = 0;
    while i < a.len() && i < b.len() && a[i] == b[i] {
        i += 1;
    }
    let tail = |v: &[char], k: usize| v.get(k..).unwrap_or(&[]).to_vec();
    if a.len() == b.len() {
        if tail(&a, i + 1) == tail(&b, i + 1) {
            return true;
        }
        return a.get(i) == b.get(i + 1) && a.get(i + 1) == b.get(i) && tail(&a, i + 2) == tail(&b, i + 2);
    }
    let (long, short) = if a.len() > b.len() { (&a, &b) } else { (&b, &a) };
    tail(long, i + 1) == tail(short, i)
}

fn parse_open(head: &str, arg: &str, books: &[Book], force: Option<&str>) -> Result<Action, String> {
    let m = regex!(r"^(?i)(.*?)\s+(kjv|ylt|both|parallel)\s*$").captures(arg);
    let body = m.as_ref().map(|m| m[1].to_string()).unwrap_or_else(|| arg.to_string());
    let word = m.as_ref().map(|m| m[2].to_lowercase()).unwrap_or_else(|| force.unwrap_or("kjv").to_string());
    let version = match word.as_str() {
        "ylt" => "YLT",
        "both" | "parallel" => "PAR",
        _ => "KJV",
    }
    .to_string();
    let parts: Vec<&str> = body.split(';').map(str::trim).filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        return Err("Give a reference like John 3:16.".into());
    }
    if head == "go" && parts.len() > 1 {
        return Err("go takes one place. Use open for several, like open John 3:16; Rom 5:8".into());
    }
    let spans: Vec<Span> = parts.iter().map(|p| parse_span(p, books).map_err(|e| e.0)).collect::<Result<_, _>>()?;
    let one = &spans[0];
    if head == "go" {
        return Ok(Action::Go { book: one.book.code.clone(), ch: one.c1, v: one.v1, v2: 0, version });
    }
    if spans.len() == 1 && (one.c1 == one.c2 || one.book.chapters == 1) {
        return Ok(Action::Open { book: one.book.code.clone(), ch: one.c1, v: one.v1, v2: if one.v2 == one.v1 { 0 } else { one.v2 }, version });
    }
    Ok(Action::Excerpt { spans: spans.iter().map(Stretch::from).collect(), version })
}

/// "part of it = new text" → (part, new text) (either may be empty), or None when there is no `=` standing alone.
fn split_equals(s: &str) -> Option<(String, String)> {
    let s = format!(" {s}");
    let m = regex!(r"\s=(\s|$)").find(&s)?;
    Some((s[..m.start()].trim().to_string(), s[m.start() + 2..].trim().to_string()))
}

/// "Zeal study: Occurrences; @Num 25:11" → (name, what follows the colon). A colon counts only with a space after it.
fn split_colon(s: &str) -> (String, String) {
    match regex!(r":(\s|$)").find(s) {
        Some(m) => (s[..m.start()].trim().to_string(), s[m.start() + 1..].trim().to_string()),
        None => (s.trim().to_string(), String::new()),
    }
}

fn parse_thread_change(arg: &str, books: &[Book]) -> Option<Result<Action, String>> {
    let m = regex!(r"^(?i)(color|rename|note|delete|move|sort)\s+(\S.*)$").captures(arg)?;
    let (action, rest) = (m[1].to_lowercase(), m[2].to_string());
    let base = |name: String| Action::ThreadSet { action: action.clone(), plain: arg.to_string(), name, color: None, saved: None, to: None, note: None, place: None, label: None };
    match action.as_str() {
        "delete" | "sort" => {
            if regex!(r"\s-\s").is_match(&rest) {
                None
            } else {
                Some(Ok(base(rest)))
            }
        }
        "move" => {
            let mv = regex!(r"^(?i)(.*\S)\s+-\s+(\S.*?)\s+(up|down|first|last|(?:to\s+)?[0-9]+)$").captures(&rest)?;
            let to = regex!(r"^to\s+").replace(&mv[3].to_lowercase(), "").to_string();
            let (name, place) = (mv[1].to_string(), mv[2].to_string());
            let with = |place: Member, label: String| {
                let Action::ThreadSet { action, plain, name, .. } = base(name.clone()) else { unreachable!() };
                Action::ThreadSet { action, plain, name, color: None, saved: None, to: Some(to.clone()), note: None, place: Some(place), label: Some(label) }
            };
            if !place.is_empty() && place.bytes().all(|b| b.is_ascii_digit()) {
                return Some(Ok(with(Member::Number(place.parse().unwrap_or(0)), format!("number {place}"))));
            }
            if is_strong(&place) {
                return Some(Ok(with(Member::Anchor(place.to_uppercase()), place.to_uppercase())));
            }
            let r = match parse_ref(&place, books) {
                Ok(r) => r,
                Err(e) => return Some(Err(e)),
            };
            if r.v == 0 {
                return Some(Err(format!("Add a verse after the chapter, like: thread move {name} - {} {}:1 up", r.book.name, r.ch)));
            }
            let at = verse_at(&r);
            Some(Ok(with(Member::Anchor(at.anchor), at.label)))
        }
        "color" => {
            let mut ws: Vec<&str> = rest.split_whitespace().collect();
            if ws.len() < 2 {
                return None;
            }
            let last = ws.pop().unwrap().to_lowercase();
            let name = ws.join(" ");
            let (color, saved) = if ["none", "clear", "off"].contains(&last.as_str()) {
                (Some(String::new()), None)
            } else {
                match color_token(&last)? {
                    Color::Named(n) => (Some(n), None),
                    Color::Saved(k) => (None, Some(k)),
                }
            };
            let Action::ThreadSet { action, plain, name, .. } = base(name) else { unreachable!() };
            Some(Ok(Action::ThreadSet { action, plain, name, color, saved, to: None, note: None, place: None, label: None }))
        }
        _ => {
            let (part, text) = split_equals(&rest)?;
            if part.is_empty() {
                return None;
            }
            let Action::ThreadSet { action, plain, name, .. } = base(part.clone()) else { unreachable!() };
            if action == "note" {
                return Some(Ok(Action::ThreadSet { action, plain, name, color: None, saved: None, to: None, note: Some(text), place: None, label: None }));
            }
            if text.is_empty() {
                return Some(Err(format!("What should it be called? Try: thread rename {part} = the new name")));
            }
            Some(Ok(Action::ThreadSet { action, plain, name, color: None, saved: None, to: Some(text), note: None, place: None, label: None }))
        }
    }
}

fn parse_set_items(text: &str, books: &[Book]) -> Result<Vec<SetItem>, String> {
    let mut items = vec![];
    for part in text.split(';').map(str::trim).filter(|p| !p.is_empty()) {
        if part.starts_with('@') {
            let (_, at) = split_at(part, books)?;
            let at = at.ok_or_else(|| format!("“{part}” is not a place. Try: @Num 25:11"))?;
            items.push(SetItem::Place { anchor: at.anchor, label: at.label });
        } else if let Some(m) = regex!(r"^(?i)(thread|lesson|pdf|note)\s+(\S.*)$").captures(part) {
            let name = m[2].to_string();
            items.push(match m[1].to_lowercase().as_str() {
                "thread" => SetItem::Thread { name },
                "lesson" => SetItem::Lesson { name },
                "pdf" => SetItem::Pdf { name },
                _ => SetItem::Note { name },
            });
        } else {
            items.push(SetItem::Pane { name: part.to_string() });
        }
    }
    Ok(items)
}

fn set(action: &str) -> Action {
    Action::Set { action: action.into(), name: None, items: None, parts: None, to: None }
}

fn parse_set(arg: &str, books: &[Book]) -> Result<Action, String> {
    if arg.is_empty() || arg.eq_ignore_ascii_case("list") {
        return Ok(set("list"));
    }
    let Some(m) = regex!(r"^(?i)(new|add|rm|open|close|minimize|restore|rename|delete)(?:\s+(.*))?$").captures(arg) else {
        return Ok(Action::Set { action: "open".into(), name: Some(arg.into()), items: None, parts: None, to: None });
    };
    let action = m[1].to_lowercase();
    let rest = m.get(2).map(|x| x.as_str().trim().to_string()).unwrap_or_default();
    if rest.is_empty() {
        return Err(format!("Which set? Try: set {action} Zeal study  (sets shows them all)"));
    }
    match action.as_str() {
        "new" | "add" => {
            let (name, list) = split_colon(&rest);
            if name.is_empty() {
                return Err(format!("Name the set, like: set {action} Zeal study: Occurrences; @Num 25:11"));
            }
            let items = parse_set_items(&list, books)?;
            if action == "add" && items.is_empty() {
                return Err("Say what to add after a colon, like: set add Zeal study: thread Phinehas; @Num 25:11; Occurrences".into());
            }
            Ok(Action::Set { action: action.clone(), name: Some(name), items: Some(items), parts: None, to: None })
        }
        "rm" => {
            let (name, list) = split_colon(&rest);
            let parts: Vec<String> = list.split(';').map(str::trim).filter(|p| !p.is_empty()).map(String::from).collect();
            if parts.is_empty() {
                return Err("Say what to take out after a colon, like: set rm Zeal study: Numbers 25:11".into());
            }
            Ok(Action::Set { action: "rm".into(), name: Some(name), items: None, parts: Some(parts), to: None })
        }
        "rename" => match split_equals(&rest) {
            Some((a, b)) if !a.is_empty() && !b.is_empty() => Ok(Action::Set { action: "rename".into(), name: Some(a), items: None, parts: None, to: Some(b) }),
            _ => Err("Try: set rename Zeal study = Phinehas study".into()),
        },
        _ => Ok(Action::Set { action: action.clone(), name: Some(rest), items: None, parts: None, to: None }),
    }
}

fn parse_notes(arg: &str, books: &[Book]) -> Result<Action, String> {
    let (text, at) = split_at(arg, books)?;
    let notes = |action: &str, part: Option<String>, text: Option<String>, at: Option<At>| Action::Notes { action: action.into(), part, text, at };
    if text.is_empty() {
        return Ok(notes("open", None, None, at));
    }
    let Some(m) = regex!(r"^(?i)(edit|delete|rm)(?:\s+(.*))?$").captures(&text) else {
        return Err("Try: notes, notes @John 3:16, notes edit <part of the note> = <new text>, or notes delete <part of the note>".into());
    };
    let which = "Which note? Give part of its text, or the place at the end, like: ";
    let rest = m.get(2).map(|x| x.as_str().to_string()).unwrap_or_default();
    if m[1].to_lowercase() != "edit" {
        let part = rest.trim().to_string();
        return if !part.is_empty() || at.is_some() { Ok(notes("delete", Some(part), None, at)) } else { Err(format!("{which}notes delete turned wrath")) };
    }
    match split_equals(&rest) {
        Some((_, b)) if b.is_empty() => Err("Put the new text after an =, like: notes edit turned wrath = he stayed the plague".into()),
        None => Err("Put the new text after an =, like: notes edit turned wrath = he stayed the plague".into()),
        Some((a, b)) => {
            if !a.is_empty() || at.is_some() {
                Ok(notes("edit", Some(a), Some(b), at))
            } else {
                Err(format!("{which}notes edit turned wrath = new words"))
            }
        }
    }
}

fn parse_trail(arg: &str) -> Result<Action, String> {
    let Some(m) = regex!(r"^(?i)(done|reopen|edit|delete|rm)\s+(\S.*)$").captures(arg) else {
        return Err("Try: trail done <part of the question>, trail reopen …, trail delete …, or trail edit <part of it> = <new words>  (trails lists them; ? queues a new one)".into());
    };
    let act = m[1].to_lowercase();
    if act != "edit" {
        return Ok(Action::Trail { action: if act == "rm" { "delete".into() } else { act }, part: m[2].to_string(), text: None });
    }
    match split_equals(&m[2]) {
        Some((a, b)) if !a.is_empty() && !b.is_empty() => Ok(Action::Trail { action: "edit".into(), part: a, text: Some(b) }),
        _ => Err("Put the new words after an =, like: trail edit same zeal = is it the same zeal?".into()),
    }
}

fn parse_results(arg: &str, books: &[Book]) -> Result<Action, String> {
    let results = |action: &str| Action::Results { action: action.into(), name: None, shape: None, spans: None };
    let hint = "Try: results tick all, results tick John 3:16; Rom 5:8, results untick John 3:16, results as verses, or results add Phinehas";
    let Some(m) = regex!(r"^(\S+)(?:\s+(.*\S))?\s*$").captures(arg) else { return Ok(results("status")) };
    let act = m[1].to_lowercase();
    let rest = m.get(2).map(|x| x.as_str().to_string()).unwrap_or_default();
    match act.as_str() {
        "add" => {
            if rest.is_empty() {
                Err("Add them to which thread? Try: results add Phinehas".into())
            } else {
                Ok(Action::Results { action: "add".into(), name: Some(rest), shape: None, spans: None })
            }
        }
        "as" => {
            let w = rest.to_lowercase();
            if w == "words" || w == "verses" {
                Ok(Action::Results { action: "as".into(), name: None, shape: Some(w), spans: None })
            } else {
                Err("Try: results as words  or  results as verses".into())
            }
        }
        "tick" | "untick" => {
            if act == "tick" && regex!(r"^(?i)(all|none)$").is_match(&rest) {
                return Ok(results(&rest.to_lowercase()));
            }
            let mut spans = vec![];
            for part in rest.split(';').map(str::trim).filter(|p| !p.is_empty()) {
                spans.push(Stretch::from(&parse_span(part, books).map_err(|e| e.0)?));
            }
            if spans.is_empty() {
                return Err(hint.into());
            }
            Ok(Action::Results { action: act.clone(), name: None, shape: None, spans: Some(spans) })
        }
        _ => Err(hint.into()),
    }
}

fn parse_palette(arg: &str) -> Result<Action, String> {
    if arg.is_empty() {
        return Ok(Action::Palette { action: "list".into(), color: None, saved: None });
    }
    let err = || "Try: palette  to see your saved colors, then: palette rm c2  or  palette rm #e07b39".to_string();
    let m = regex!(r"^(?i)(rm|delete)\s+(\S+)$").captures(arg).ok_or_else(err)?;
    match color_token(&m[2]).ok_or_else(err)? {
        Color::Named(c) if COLORS.contains(&c.as_str()) => Err(err()),
        Color::Named(c) => Ok(Action::Palette { action: "rm".into(), color: Some(c), saved: None }),
        Color::Saved(k) => Ok(Action::Palette { action: "rm".into(), color: None, saved: Some(k) }),
    }
}

/// "mine", "my voice", "me all": the person's own recorded voice.
fn mine_request(name: &str) -> Option<bool> {
    let t = name.trim();
    regex!(r"^(?i)(?:mine|my|my voice|me)(?:\s+(?:--all|all))?$").is_match(t).then(|| t.to_lowercase().ends_with("all"))
}

fn parse_listen(arg: &str, books: &[Book]) -> Result<Action, String> {
    let ws = words(arg);
    let a = ws.first().map(|x| x.to_lowercase()).unwrap_or_default();
    let tail = ws.get(1..).map(|x| x.join(" ")).unwrap_or_default();
    let listen = |action: &str| Action::Listen { action: action.into(), rate: None, all: None, name: None, span: None };
    if a.is_empty() {
        return Ok(listen("start"));
    }
    if ["pause", "resume", "stop", "voices"].contains(&a.as_str()) && tail.is_empty() {
        return Ok(listen(&a));
    }
    if a == "speed" {
        let n: f64 = if regex!(r"^[0-9](\.[0-9]+)?$").is_match(&tail) { tail.parse().unwrap() } else { 0.0 };
        if !(0.5..=2.0).contains(&n) {
            return Err("Try: listen speed 1.2  (0.5 to 2, and 1 is the usual speed)".into());
        }
        let rate = if n.fract() == 0.0 { serde_json::Number::from(n as u64) } else { serde_json::Number::from_f64(n).unwrap() };
        return Ok(Action::Listen { action: "speed".into(), rate: Some(rate), all: None, name: None, span: None });
    }
    if a == "voice" {
        if let Some(all) = mine_request(&tail) {
            return Ok(Action::Listen { action: "mine".into(), rate: None, all: Some(all), name: None, span: None });
        }
        if tail.is_empty() {
            return Err("Which voice? Try: listen voices  to see them, then: listen voice aria".into());
        }
        return Ok(Action::Listen { action: "voice".into(), rate: None, all: None, name: Some(tail), span: None });
    }
    if arg.contains(';') {
        return Err("listen takes one place, like: listen John 3:16-21".into());
    }
    let span = parse_span(arg, books).map_err(|e| e.0)?;
    Ok(Action::Listen { action: "start".into(), rate: None, all: None, name: None, span: Some(Stretch::from(&span)) })
}

fn parse_layers(arg: &str) -> Result<Action, String> {
    let ws = words(arg);
    let a = ws.first().map(|x| x.to_lowercase()).unwrap_or_default();
    let tail = ws.get(1..).map(|x| x.join(" ")).unwrap_or_default();
    let layers = |action: &str| Action::Layers { action: action.into(), on: None, name: None };
    if a.is_empty() {
        return Ok(layers("list"));
    }
    if ["all", "none", "panel", "list"].contains(&a.as_str()) && tail.is_empty() {
        return Ok(layers(&a));
    }
    let t = tail.to_lowercase();
    if a == "mine" && (t == "on" || t == "off") {
        return Ok(Action::Layers { action: "mine".into(), on: Some(t == "on"), name: None });
    }
    if (a == "show" || a == "hide") && !tail.is_empty() {
        return Ok(Action::Layers { action: a.clone(), on: None, name: Some(tail) });
    }
    Err("Try: layers show Phinehas, layers hide Phinehas, layers mine off, layers all, layers none, or layers (the list)".into())
}

fn parse_make(head: &str, arg: &str, books: &[Book]) -> Result<Action, String> {
    let kind = if head == "doc" { "word" } else { "deck" };
    let (own, other) = if kind == "word" { (DOC_STRUCTURES, DECK_STRUCTURES) } else { (DECK_STRUCTURES, DOC_STRUCTURES) };
    let mut ws = words(arg);
    let mut again = None;
    if ws.len() > 1 && ws[0].to_lowercase() == "new" {
        ws.remove(0);
        again = Some(true);
    }
    let is_thread = ws.len() > 1 && ws[0].to_lowercase() == "thread";
    let (mut structure, mut theme, mut version) = (None, None, None);
    while ws.len() > if is_thread { 2 } else { 1 } {
        let w = ws.last().unwrap().to_lowercase();
        if own.contains(&w.as_str()) && structure.is_none() {
            structure = Some(w);
        } else if EXPORT_THEMES.contains(&w.as_str()) && theme.is_none() {
            theme = Some(w);
        } else if !is_thread && (w == "kjv" || w == "ylt") && version.is_none() {
            version = Some(w.to_uppercase());
        } else if !is_thread && other.contains(&w.as_str()) {
            return Err(format!("{w} is a {} structure. {head} can be: {}", if kind == "word" { "slide" } else { "Word" }, own.join(", ")));
        } else {
            break;
        }
        ws.pop();
    }
    if is_thread {
        return Ok(Action::Make { kind: kind.into(), thread: Some(ws[1..].join(" ")), place: None, version: None, structure, theme, again });
    }
    if ws.is_empty() {
        return Err(format!("Make it from what? Try: {head} thread Phinehas  or  {head} John 3:16-21"));
    }
    let place = ws.join(" ");
    check_spans(&place, books)?;
    Ok(Action::Make { kind: kind.into(), thread: None, place: Some(place), version: Some(version.unwrap_or_else(|| "KJV".into())), structure, theme, again })
}

fn parse_docs(arg: &str) -> Result<Action, String> {
    let mut ws = words(arg);
    let docs = |action: &str, name: Option<String>| Action::Docs { action: action.into(), name, force: None, theme: None };
    if ws.is_empty() {
        return Ok(docs("list", None));
    }
    let act = ws[0].to_lowercase();
    if ["forget", "remember", "delete"].contains(&act.as_str()) {
        return if ws.len() > 1 { Ok(docs(&act, Some(ws[1..].join(" ")))) } else { Err(format!("Which document? Try: docs {act} love  (docs lists them)")) };
    }
    if act != "update" {
        return Ok(docs("open", Some(ws.join(" "))));
    }
    ws.remove(0);
    let (mut force, mut theme) = (None, None);
    while let Some(last) = ws.last() {
        let w = last.to_lowercase();
        if w == "force" && force.is_none() {
            force = Some(true);
        } else if EXPORT_THEMES.contains(&w.as_str()) && theme.is_none() {
            theme = Some(w);
        } else {
            break;
        }
        ws.pop();
    }
    if ws.is_empty() && (force.is_some() || theme.is_some()) {
        return Err("Which document? Try: docs update love vigil  (docs update alone updates everything out of date)".into());
    }
    Ok(Action::Docs { action: "update".into(), name: Some(ws.join(" ")), force, theme })
}

fn parse_lesson(arg: &str) -> Result<Action, String> {
    let mut tokens = words(arg);
    let act = if tokens.is_empty() { "list".to_string() } else { tokens.remove(0).to_lowercase() };
    let lesson = |action: &str| Action::Lesson { action: action.into(), name: None, make: None, pdf: None, theme: None };
    if act == "list" && tokens.is_empty() {
        return Ok(lesson("list"));
    }
    if !["show", "check", "build"].contains(&act.as_str()) {
        return Err("Try: lesson list, lesson show <name>, lesson check <name>, or lesson build <name> [script|share|pulpit|...] [theme] [pdf]".into());
    }
    let (mut make, mut theme, mut pdf) = (vec![], None, false);
    while act == "build" && !tokens.is_empty() {
        let w = tokens.last().unwrap().to_lowercase();
        if DECK_STRUCTURES.contains(&w.as_str()) || DOC_STRUCTURES.contains(&w.as_str()) || w == "deck" {
            make.insert(0, w);
        } else if w == "all" {
            make.extend(["script", "share", "pulpit"].map(String::from));
        } else if EXPORT_THEMES.contains(&w.as_str()) && theme.is_none() {
            theme = Some(w);
        } else if w == "pdf" {
            pdf = true;
        } else {
            break;
        }
        tokens.pop();
    }
    if tokens.is_empty() {
        return Err(format!("Which lesson? Try: lesson {act} phinehas  (lesson list shows them)"));
    }
    let name = Some(tokens.join(" "));
    if act != "build" {
        return Ok(Action::Lesson { action: act.clone(), name, make: None, pdf: None, theme: None });
    }
    let mut picked: Vec<String> = vec![];
    for m in make {
        if !picked.contains(&m) {
            picked.push(m);
        }
    }
    if picked.is_empty() {
        picked = ["script", "share", "pulpit"].map(String::from).to_vec();
    }
    Ok(Action::Lesson { action: act, name, make: Some(picked), pdf: Some(pdf), theme })
}

/// "grace and truth" | "grace in gospels" | "love OT" → a search, limited when the words end in "in <ot|nt|group|book>",
/// or in a bare OT / NT.
fn parse_search(text: &str, books: &[Book]) -> Action {
    if let Some(m) = regex!(r"^(?i)(.*\S)\s+in\s+(.+)$").captures(text) {
        let (scope, rest) = take_scope(&words(&m[2]), books, 0);
        if scope != "all" && rest.is_empty() {
            return Action::Search { q: m[1].to_string(), scope: Some(scope), suspect: None };
        }
    }
    if let Some(m) = regex!(r"^(?i)(.*\S)\s+(ot|nt)$").captures(text) {
        return Action::Search { q: m[1].to_string(), scope: Some(m[2].to_uppercase()), suspect: None };
    }
    Action::Search { q: text.to_string(), scope: None, suspect: None }
}

/// One line of the box → what it asks for, or a sentence saying what is wrong with it.
pub fn parse(input: &str, books: &[Book]) -> Result<Action, String> {
    let t = input.trim();
    if t.is_empty() {
        return Ok(Action::Nothing);
    }
    if let Some(rest) = t.strip_prefix('?') {
        let (text, at) = split_at(rest, books)?;
        return if text.is_empty() { Err("Write the question after the ?".into()) } else { Ok(Action::Ask { text, at }) };
    }
    if let Some(rest) = t.strip_prefix('+') {
        let (name, at) = split_at(rest, books)?;
        return if name.is_empty() { Err("Name the thread after the +".into()) } else { Ok(Action::Thread { name, at }) };
    }
    let ws = words(t);
    let head = ws[0].to_lowercase();
    let arg = ws[1..].join(" ");
    let a = arg.as_str();
    Ok(match head.as_str() {
        "def" => {
            if a.is_empty() {
                return Err("Define what? Try: def zeal  or  def H7065".into());
            }
            if a.contains(' ') {
                return Err(format!("Define one word at a time: def {}. (To look for several words together, use search.)", ws[1]));
            }
            Action::Def { q: a.into() }
        }
        "uses" | "first" | "last" => parse_uses(a, books, &head)?,
        "forms" => {
            if a.is_empty() {
                return Err("Forms of what? Try: forms zeal".into());
            }
            if a.contains(' ') || !is_word(a) {
                return Err("One English word at a time, like: forms zeal".into());
            }
            Action::Forms { word: a.to_lowercase() }
        }
        "search" => {
            if a.is_empty() {
                return Err("Search for what?".into());
            }
            parse_search(a, books)
        }
        "find" => {
            if a.is_empty() {
                return Err("Find what in your notes, threads and trails?".into());
            }
            Action::Find { q: a.into() }
        }
        "open" | "go" => parse_open(&head, a, books, None)?,
        "help" => {
            if a.is_empty() {
                return Ok(Action::Help { topic: String::new() });
            }
            match find_doc(a) {
                Some(d) => Action::Help { topic: d["name"].as_str().unwrap_or_default().into() },
                // W5: Help's Guide (templates, views) is new in the Rust app
                None if crate::guide::guide_entry(a).is_some() => Action::Help { topic: crate::guide::guide_entry(a).unwrap()["name"].as_str().unwrap_or_default().into() },
                None => return Err(format!("No command or topic called “{a}”. Type help for the list. (To search for the words, type: search help {a})")),
            }
        }
        "interlinear" => {
            if a.is_empty() {
                return Err("Which place? Try: interlinear John 3:16".into());
            }
            Action::Interlinear { span: Stretch::from(&parse_span(a, books).map_err(|e| e.0)?) }
        }
        "compare" => {
            if a.is_empty() {
                return Err("Compare what? Try: compare John 3:16".into());
            }
            parse_open("open", a, books, Some("both"))?
        }
        "copy" => parse_copy(a, books)?,
        "preview" => parse_preview(a, books)?,
        "hover" => {
            let w = a.to_lowercase();
            if !["on", "off", "refs"].contains(&w.as_str()) {
                return Err("Try: hover on, hover off, or hover refs  (references and numbers, not the words of the text)".into());
            }
            Action::Hover { mode: w }
        }
        "count" => {
            let stripped = regex!(r"(?i)\s+by\s+books?\s*$").replace(a, "").to_string();
            match parse_uses(&stripped, books, "count")? {
                Action::Count { scope, .. } if scope != "all" => return Err(format!("count shows every book at once. For one part of the Bible use: uses {stripped}")),
                r => r,
            }
        }
        "near" => parse_near(a, books)?,
        "lexiconc" => {
            if a.is_empty() {
                return Err("Which English word? Try: lexiconc zeal  (or zeal* for endings)".into());
            }
            let w = a.strip_suffix('*').unwrap_or(a);
            if !is_word(w) || w.is_empty() {
                return Err("One English word at a time, like: lexiconc zeal".into());
            }
            Action::Lexiconc { q: a.to_lowercase() }
        }
        "lex" => parse_lex(a)?,
        "today" => {
            if !a.is_empty() && !regex!(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$").is_match(a) {
                return Err("A day looks like 2026-10-18 (or just: today).".into());
            }
            Action::Today { day: a.into() }
        }
        "layout" => {
            let lw = words(a);
            let act = lw.first().map(|x| x.to_lowercase()).unwrap_or_else(|| "list".into());
            let name = lw.get(1..).map(|x| x.join(" ")).unwrap_or_default();
            if !["save", "load", "list"].contains(&act.as_str()) {
                return Err("Try: layout save <name>, layout load <name>, or layout list".into());
            }
            if act != "list" && name.is_empty() {
                return Err(format!("Name the layout: layout {act} phinehas"));
            }
            Action::Layout { action: act, name }
        }
        "sets" => Action::Sets,
        "set" => parse_set(a, books)?,
        "next" => Action::Next,
        "prev" | "previous" => Action::Prev,
        "back" => Action::Back,
        "listen" => parse_listen(a, books)?,
        "hl" => parse_hl(a, books)?,
        "marked" => parse_marked(a, books)?,
        "note" => {
            let (text, at) = split_at(a, books)?;
            if text.is_empty() {
                return Err("Write the note before the @place.".into());
            }
            Action::Note { text, at }
        }
        "thread" => {
            if a.is_empty() {
                return Err("Which thread? Try: thread Phinehas  (threads lists them all)".into());
            }
            if let Some(change) = parse_thread_change(a, books) {
                return change;
            }
            // "thread phin - Num 25:11" (or "- H7065") takes what sits at that place out of the thread
            if let Some(m) = regex!(r"^(.*\S)\s+-\s+(\S.*)$").captures(a) {
                let place = m[2].trim().to_string();
                let name = m[1].to_string();
                if is_strong(&place) {
                    let p = place.to_uppercase();
                    return Ok(Action::ThreadRm { name, at: At { anchor: p.clone(), label: p } });
                }
                match parse_ref(&place, books) {
                    Ok(r) => {
                        if r.v == 0 {
                            return Err(format!("Add a verse after the chapter, like: thread {name} - {} {}:1", r.book.name, r.ch));
                        }
                        if r.v2 != 0 && r.v2 < r.v {
                            return Err("A verse range runs upward, like Num 25:11-13".into());
                        }
                        return Ok(Action::ThreadRm { name, at: verse_at(&r) });
                    }
                    Err(e) if e.starts_with("Which book") || e.contains("chapter") => return Err(e),
                    Err(_) => {}
                }
            }
            Action::OpenThread { name: a.into() }
        }
        "notes" => parse_notes(a, books)?,
        "trail" => parse_trail(a)?,
        "palette" => parse_palette(a)?,
        "results" => parse_results(a, books)?,
        "undo" | "rm" => Action::Undo,
        "keys" | "shortcuts" => Action::Keys,
        "trails" => Action::Trails,
        "threads" => Action::Threads,
        "pdf" => Action::Pdf,
        "pdfs" => Action::Pdfs { name: if a.is_empty() { None } else { Some(a.into()) } },
        "doc" | "deck" => parse_make(&head, a, books)?,
        "docs" => parse_docs(a)?,
        "theme" => {
            let w = a.trim().to_lowercase();
            if w.is_empty() {
                Action::Theme { theme: None }
            } else if EXPORT_THEMES.contains(&w.as_str()) {
                Action::Theme { theme: Some(w) }
            } else {
                return Err(format!("Themes: {}", EXPORT_THEMES.join(", ")));
            }
        }
        "lesson" => parse_lesson(a)?,
        "packet" => {
            let names: Vec<String> = a.split(';').map(str::trim).filter(|x| !x.is_empty()).map(String::from).collect();
            if names.len() < 2 {
                return Err("Name two or more saved PDFs, joined by ;  like: packet John 3 ; Romans 8   (pdfs lists them)".into());
            }
            Action::Packet { names }
        }
        "layers" => parse_layers(a)?,
        "highlights" => match a.to_lowercase().as_str() {
            "on" => Action::Highlights { on: true },
            "off" => Action::Highlights { on: false },
            _ => return Err("Try: highlights on  or  highlights off".into()),
        },
        "size" => {
            let w = a.trim();
            if w == "+" || w == "-" {
                Action::Size { step: Some(if w == "+" { 1 } else { -1 }), percent: None }
            } else {
                match regex!(r"^([0-9]{2,3})\s*%?$").captures(w).map(|m| m[1].parse::<u32>().unwrap()) {
                    Some(p) if (75..=183).contains(&p) => Action::Size { step: None, percent: Some(p) },
                    _ => return Err("Try: size 120  (75 to 183 percent), size +, or size -".into()),
                }
            }
        }
        "toolbar" => match a.to_lowercase().as_str() {
            "show" => Action::Toolbar { show: true },
            "hide" => Action::Toolbar { show: false },
            _ => return Err("Try: toolbar hide  or  toolbar show".into()),
        },
        "findpage" => Action::Findpage { q: a.into() },
        "panes" => Action::Panes,
        "unfocus" if a.is_empty() => Action::Pane { action: "unfocus".into(), target: "all".into() },
        "close" | "minimize" | "restore" | "dock" | "float" | "focus" => {
            if a.is_empty() {
                let more = if head == "close" || head == "restore" { format!("all  or  {head} ") } else { String::new() };
                return Err(format!("Which pane? Try: {head} {more}occurrences  (panes lists what is open)"));
            }
            Action::Pane { action: head.clone(), target: a.into() }
        }
        // ---- the cards (new in the Rust app; design/features/words) ----
        "card" => {
            let words: Vec<&str> = a.split_whitespace().collect();
            let (how, place) = match words.last().map(|w| w.to_lowercase()) {
                Some(w) if w == "float" || w == "tab" => (w, words[..words.len() - 1].join(" ")),
                _ => ("open".to_string(), words.join(" ")),
            };
            let word_anchor = regex!(r"^[A-Z0-9]{3}.[0-9]{1,3}:[0-9]{1,3}.[0-9]{1,3}$").is_match(&place);
            if place.is_empty() || (!word_anchor && parse_span(&place, books).is_err()) {
                return Err("Name a verse, like: card Num 25:11  (then float or tab: card Num 25:11 float)".into());
            }
            Action::Card { place, how }
        }
        // ---- the Notebook (new in the Rust app) ----
        "jot" => {
            let body = a.trim();
            let (question, text) = match body.strip_prefix('?') {
                Some(q) => (true, q.trim()),
                None => (false, body),
            };
            if text.is_empty() {
                return Err("Write the thought after jot, like: jot check where else this phrase is used  (jot ?… for a question)".into());
            }
            Action::Jot { text: text.into(), question }
        }
        "place" => {
            let (part, at) = split_at(a, books)?;
            let Some(at) = at else { return Err("Name the place at the end, like: place rose up @Num 25:7  (part of the note, then @ and the place)".into()) };
            Action::Place { part, at }
        }
        "journal" => {
            if !a.is_empty() && !regex!(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$").is_match(a) {
                return Err("A day looks like 2026-11-02 (or just: journal).".into());
            }
            Action::Journal { day: a.into() }
        }
        "inbox" => Action::Inbox,
        "notebook" => {
            view_line(a, books)?;
            Action::Notebook { line: a.trim().to_string() }
        }
        "window" => {
            let w = a.to_lowercase();
            if !WINDOW_SIZES.contains(&w.as_str()) {
                return Err(format!("Window sizes: {}", WINDOW_SIZES.join(", ")));
            }
            Action::Window { size: w }
        }
        "plans" => Action::Plans,
        "findings" => Action::Findings,
        "finding" => {
            if a.trim().is_empty() {
                return Err("finding <what you noticed about the app>: it is kept apart from your study (findings).".into());
            }
            Action::Finding { text: a.trim().to_string() }
        }
        "version" => {
            let v = a.trim().to_uppercase();
            if !v.is_empty() && !regex!(r"^[A-Z0-9]{2,10}$").is_match(&v) {
                return Err("Try: version ylt, or version kjv".into());
            }
            Action::Version { version: v }
        }
        _ => {
            let mut q = parse_search(t, books);
            // A word one slip away from a command may be a typo; the box asks whether it is a real KJV word.
            let slip = command_names().into_iter().find(|c| c.chars().count() >= 3 && one_edit_apart(&head, c));
            if let Action::Search { suspect, .. } = &mut q {
                *suspect = slip;
            }
            q
        }
    })
}

// ---- verse references in the person's own writing --------------------------------------------------------------------

/// A reference found in text: where it is (in characters), how it reads for `parse_span`, and its link (#JHN.3.16).
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Found {
    pub start: usize,
    pub end: usize,
    #[serde(rename = "ref")]
    pub place: String,
    pub hash: String,
}

/// Two-letter names are too often ordinary words ("is 5:2", "am 5:30"), so only these count, and only with a capital.
const TWO_LETTERS: &[&str] = &["ps", "gn", "dt", "jg", "mt", "mk", "lk", "jn"];
const REF_NUMS: &str = r"[0-9]{1,3}(?::[0-9]{1,3})?(?:\s*[-–]\s*[0-9]{1,3}(?::[0-9]{1,3})?)?";

fn fancy(pat: &str) -> fancy_regex::Regex {
    fancy_regex::Regex::new(pat).unwrap()
}

/// Every verse reference in a piece of text, in order. With a verse any usual name counts, in any case; a chapter alone
/// counts only with the book's whole name ("John 3", "Psalm 23"). A reference that is not in the Bible stays text.
pub fn find_refs(text: &str, books: &[Book]) -> Vec<Found> {
    static IN_TEXT: OnceLock<fancy_regex::Regex> = OnceLock::new();
    static MORE: OnceLock<fancy_regex::Regex> = OnceLock::new();
    let in_text = IN_TEXT.get_or_init(|| {
        fancy(&format!(r"(?i)(?<![A-Za-z0-9_’'-])(?:([1-3])\s*|(i{{1,3}})\s+)?(song\s+of\s+solomon|song\s+of\s+songs|[a-z]{{2,}})\.?\s*({REF_NUMS})(?![A-Za-z0-9_:])"))
    });
    // What may follow and share the book: "; 6:23", ", 8:1", ", 18", ", 18-20" (a bare number must end there).
    let more = MORE.get_or_init(|| {
        fancy(r"\s*[;,]\s*([0-9]{1,3}:[0-9]{1,3}(?:\s*[-–]\s*[0-9]{1,3}(?::[0-9]{1,3})?)?(?![A-Za-z0-9_:])|[0-9]{1,3}(?:\s*[-–]\s*[0-9]{1,3})?(?=\s*(?:[,;.)\]!?]|$)))")
    });
    let chars = |b: usize| text[..b].chars().count();
    let mut out = vec![];
    let add = |out: &mut Vec<Found>, start: usize, end: usize, code: &str, place: &str| -> Option<Span> {
        let s = parse_span(&format!("{code} {place}"), books).ok()?;
        let compact: String = place.split_whitespace().collect();
        out.push(Found {
            start: chars(start),
            end: chars(end),
            place: format!("{code} {}", compact.replacen('–', "-", 1)),
            hash: format!("#{code}.{}{}", s.c1, if s.v1 != 0 { format!(".{}", s.v1) } else { String::new() }),
        });
        Some(s)
    };
    let mut pos = 0;
    while let Ok(Some(m)) = in_text.captures_from_pos(text, pos) {
        let whole = m.get(0).unwrap();
        let word = m.get(3).unwrap();
        let nums = m.get(4).unwrap().as_str();
        let miss = word.end();
        let name = regex!(r"\s+").replace_all(word.as_str(), " ").to_string();
        let numbered = m.get(1).map(|d| d.as_str().to_string()).or_else(|| m.get(2).map(|r| r.as_str().len().to_string())).unwrap_or_default();
        let mut start = whole.start();
        let mut dropped = false;
        let mut book = match_book(&if numbered.is_empty() { name.clone() } else { format!("{numbered} {name}") }, books).ok();
        if book.is_none() && !numbered.is_empty() {
            book = match_book(&name, books).ok();
            start = word.start();
            dropped = book.is_some();
        }
        let Some(book) = book else {
            pos = miss;
            continue;
        };
        let plain = numbered.is_empty() || dropped;
        let two_ok = TWO_LETTERS.contains(&name.to_lowercase().as_str()) && name.starts_with(|c: char| c.is_ascii_uppercase());
        if plain && name.chars().count() == 2 && !two_ok {
            pos = miss;
            continue;
        }
        let written = if plain { name.clone() } else { format!("{numbered} {name}") };
        if !nums.contains(':') && written != book.name && !(plain && name == "Psalm") {
            pos = miss;
            continue;
        }
        let Some(mut s) = add(&mut out, start, whole.end(), &book.code, nums) else {
            pos = miss;
            continue;
        };
        pos = whole.end();
        let mut at = whole.end();
        while let Ok(Some(mm)) = more.captures_from_pos(text, at) {
            let w = mm.get(0).unwrap();
            if w.start() != at {
                break;
            }
            let place = mm.get(1).unwrap();
            if !place.as_str().contains(':') && s.v1 == 0 {
                break;
            }
            let p = if place.as_str().contains(':') { place.as_str().to_string() } else { format!("{}:{}", s.c2, place.as_str()) };
            let Some(next) = add(&mut out, place.start(), place.end(), &book.code, &p) else { break };
            s = next;
            pos = place.end();
            at = w.end();
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn books() -> Vec<Book> {
        let raw: Value = serde_json::from_str(include_str!("../tests/books.json")).unwrap();
        raw.as_array()
            .unwrap()
            .iter()
            .map(|b| Book {
                id: b["id"].as_u64().unwrap() as u32,
                code: b["code"].as_str().unwrap().into(),
                name: b["name"].as_str().unwrap().into(),
                testament: b["testament"].as_str().unwrap().into(),
                chapters: b["chapters"].as_u64().unwrap() as u32,
            })
            .collect()
    }

    /// Every line the Python parser was given in its tests and manual, with its own answer.
    #[test]
    fn same_as_the_python_parser() {
        let bs = books();
        let cases: Value = serde_json::from_str(include_str!("../tests/commands-cases.json")).unwrap();
        let mut wrong = vec![];
        for c in cases["parse"].as_array().unwrap() {
            let input = c["input"].as_str().unwrap();
            let got = match parse(input, &bs) {
                Ok(a) => serde_json::json!({ "input": input, "action": a }),
                Err(e) => serde_json::json!({ "input": input, "error": e }),
            };
            if &got != c {
                wrong.push(format!("{input:?}\n  python: {c}\n  rust:   {got}"));
            }
        }
        assert!(wrong.is_empty(), "{} of {} differ:\n{}", wrong.len(), cases["parse"].as_array().unwrap().len(), wrong.join("\n"));
    }

    #[test]
    fn the_card_line_floats_or_tabs_a_verse_and_a_word() {
        let bs = books();
        let a = |t: &str| serde_json::to_value(parse(t, &bs).unwrap()).unwrap();
        assert_eq!(a("card Num 25:11 float"), serde_json::json!({"cmd": "card", "place": "Num 25:11", "how": "float"}));
        assert_eq!(a("card Numbers 25:11-13 tab")["how"], "tab");
        assert_eq!(a("card Num 25:11")["how"], "open");
        assert_eq!(a("card NUM.25:11.24 float")["place"], "NUM.25:11.24");
        assert!(parse("card", &bs).is_err());
        assert!(parse("card nothing here float", &bs).is_err());
    }

    #[test]
    fn references_in_text_same_as_the_python_app() {
        let bs = books();
        let cases: Value = serde_json::from_str(include_str!("../tests/commands-cases.json")).unwrap();
        let mut wrong = vec![];
        for c in cases["refs"].as_array().unwrap() {
            let text = c["text"].as_str().unwrap();
            let got = serde_json::to_value(find_refs(text, &bs)).unwrap();
            if got != c["refs"] {
                wrong.push(format!("{text:?}\n  python: {}\n  rust:   {got}", c["refs"]));
            }
        }
        assert!(wrong.is_empty(), "{}", wrong.join("\n"));
    }

    #[test]
    fn the_notebook_commands() {
        let bs = books();
        let p = |t: &str| serde_json::to_value(parse(t, &bs).unwrap()).unwrap();
        assert_eq!(p("jot check where else this is used"), serde_json::json!({"cmd": "jot", "text": "check where else this is used", "question": false}));
        assert_eq!(p("jot ? how do the numbers relate"), serde_json::json!({"cmd": "jot", "text": "how do the numbers relate", "question": true}));
        assert_eq!(p("place rose up @Num 25:7"), serde_json::json!({"cmd": "place", "part": "rose up", "at": {"anchor": "NUM.25:7", "label": "Numbers 25:7"}}));
        assert_eq!(p("journal"), serde_json::json!({"cmd": "journal", "day": ""}));
        assert_eq!(p("journal 2026-11-02"), serde_json::json!({"cmd": "journal", "day": "2026-11-02"}));
        assert_eq!(p("inbox"), serde_json::json!({"cmd": "inbox"}));
        assert_eq!(p("window phone"), serde_json::json!({"cmd": "window", "size": "phone"}));
        assert_eq!(p("version ylt"), serde_json::json!({"cmd": "version", "version": "YLT"}));
        assert_eq!(p("version"), serde_json::json!({"cmd": "version", "version": ""}));
        assert_eq!(p("plans"), serde_json::json!({"cmd": "plans"}));
        assert_eq!(p("focus notebook"), serde_json::json!({"cmd": "pane", "action": "focus", "target": "notebook"}));
        assert_eq!(p("unfocus"), serde_json::json!({"cmd": "pane", "action": "unfocus", "target": "all"}));
        assert!(parse("focus", &bs).is_err());
        assert_eq!(p("findings"), serde_json::json!({"cmd": "findings"}));
        assert_eq!(p("finding Ctrl+F finds only in the reader"), serde_json::json!({"cmd": "finding", "text": "Ctrl+F finds only in the reader"}));
        assert!(parse("jot", &bs).is_err());
        assert!(parse("place rose up", &bs).unwrap_err().contains("@"));
        assert!(parse("journal yesterday", &bs).is_err());
        assert!(parse("window huge", &bs).is_err());
        // W5: a view's line, the same parser for a view block, the command field and wb view run
        assert_eq!(p("notebook"), serde_json::json!({"cmd": "notebook"}));
        assert_eq!(p("notebook @Num 25 questions"), serde_json::json!({"cmd": "notebook", "line": "@Num 25 questions"}));
        let v = |t: &str| serde_json::to_value(view_line(t, &bs).unwrap()).unwrap();
        assert_eq!(v("notebook @Num 25 questions"), serde_json::json!({"place": "Numbers 25", "questions": "all"}));
        assert_eq!(v("@ Num 25:10-13 open zeal"), serde_json::json!({"place": "Numbers 25:10-13", "questions": "open", "words": ["zeal"]}));
        assert_eq!(v("notebook @Song of Solomon 2 pages"), serde_json::json!({"place": "Song of Solomon 2", "pages": true}));
        assert_eq!(v("notebook thread phinehas"), serde_json::json!({"thread": "phinehas"}));
        assert_eq!(v("notebook thread \"the zeal of God\" days 7"), serde_json::json!({"thread": "the zeal of God", "days": 7}));
        assert_eq!(v("notebook @h7065"), serde_json::json!({"place": "H7065"}));
        assert_eq!(v("notebook @Numbers answered"), serde_json::json!({"place": "Numbers", "questions": "answered"}));
        assert_eq!(v("notebook"), serde_json::json!({}));
        assert!(view_line("notebook days", &bs).is_err());
        assert!(view_line("notebook days soon", &bs).is_err());
        assert!(view_line("notebook thread", &bs).is_err());
        assert!(view_line("notebook @Nowhere 3", &bs).is_err());
        assert!(view_line("notebook thread \"open", &bs).is_err());
        assert!(parse("notebook @Num 99", &bs).is_err());
        assert_eq!(p("help templates"), serde_json::json!({"cmd": "help", "topic": "templates"}));
        assert_eq!(p("help views"), serde_json::json!({"cmd": "help", "topic": "views"}));
    }

    #[test]
    fn manual_lookups() {
        assert_eq!(find_doc("uses").unwrap()["name"], "uses");
        assert_eq!(find_doc("us").unwrap()["name"], "uses");
        assert!(find_doc("u").is_none());
        assert_eq!(find_doc("rm").unwrap()["name"], "undo");
        assert_eq!(find_doc("scopes").unwrap()["section"], "topics");
        assert_eq!(anchor_ref("NUM.25:11.3-25:12.5"), "NUM 25:11-25:12");
        assert_eq!(anchor_ref("NUM.25:11.3-25:11.9"), "NUM 25:11");
        assert_eq!(anchor_ref("H7065"), "");
    }
}
