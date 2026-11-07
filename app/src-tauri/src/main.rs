// The Tauri 2 shell: the window, and commands that call wb-core. Nothing here knows about drawing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use tauri::{Emitter, LogicalSize, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, FilePath};
use wb_core::{bible::Bible, store::Store, studyapi, views};

/// Said when the setup screen has not finished: the window still draws, and says what is missing rather than closing.
const NOT_SET_UP: &str = "Bible Workbench is not set up yet. Choose the Bible database and the folder for your notes.";

struct App {
    /// The Bible, opened once the setup screen has found a database.
    bible: Mutex<Option<Bible>>,
    /// The person's files, kept in step with the folder: refreshed (at most once a second) before each request.
    /// `None` until a study folder is chosen, so a first run opens the setup screen instead of a message box and exit.
    store: Mutex<Option<Store>>,
    started: Instant,
    started_wall_ms: u128,
    /// Lines from `wb do` waiting for the window's answer, by request number.
    waiting: Mutex<HashMap<u64, mpsc::Sender<Value>>>,
}

static NEXT_DO: AtomicU64 = AtomicU64::new(1);

/// `wb do`: lines from a terminal, handed to the window as a "wb-do" event; the window answers with `do_done`.
fn serve_do(handle: tauri::AppHandle, study: std::path::PathBuf) {
    let Ok((listener, token)) = wb_core::relay::listen(&study) else { return };
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let handle = handle.clone();
            let token = token.clone();
            std::thread::spawn(move || {
                let Some((line, wait_ms)) = wb_core::relay::read_request(&stream, &token) else {
                    wb_core::relay::answer(&stream, &json!({"ok": false, "error": "refused: not from wb on this computer"}));
                    return;
                };
                let id = NEXT_DO.fetch_add(1, Ordering::SeqCst);
                let (tx, rx) = mpsc::channel();
                let app = handle.state::<App>();
                app.waiting.lock().unwrap().insert(id, tx);
                let _ = handle.emit("wb-do", json!({"id": id, "line": line}));
                let reply = rx.recv_timeout(std::time::Duration::from_millis(wait_ms)).unwrap_or_else(|_| json!({"ok": true, "said": "sent (the window did not say what it did)"}));
                app.waiting.lock().unwrap().remove(&id);
                wb_core::relay::answer(&stream, &reply);
            });
        }
    });
}

/// The window's answer to a `wb do` line: `{ok, said}` or `{ok: false, error}`.
#[tauri::command]
fn do_done(app: State<App>, id: u64, reply: Value) {
    if let Some(tx) = app.waiting.lock().unwrap().remove(&id) {
        let _ = tx.send(reply);
    }
}

/// The test sizes of docs/PLAN.md section 7 (logical pixels, the web view's own size).
const PRESETS: &[(&str, f64, f64)] = &[
    ("phone", 390.0, 844.0),
    ("phone-landscape", 844.0, 390.0),
    ("ipad", 820.0, 1180.0),
    ("ipad-landscape", 1180.0, 820.0),
    ("laptop", 1280.0, 800.0),
    ("laptop-large", 1440.0, 900.0),
    ("desktop", 1920.0, 1080.0),
];

fn wall_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

/// Runs a wb-core call and adds how long it took inside Rust (`rust_ms`), for the budgets.
fn timed<T: Serialize>(f: impl FnOnce() -> wb_core::Result<T>) -> Result<Value, String> {
    let t = Instant::now();
    let v = f().map_err(|e| e.to_string())?;
    Ok(json!({ "data": v, "rust_ms": t.elapsed().as_secs_f64() * 1000.0 }))
}

/// The store, brought up to date with the folder (hand edits, `wb` in a terminal, a git pull).
fn fresh<'a>(app: &'a App) -> Result<std::sync::MutexGuard<'a, Option<Store>>, String> {
    let mut st = app.store.lock().unwrap();
    st.as_mut().ok_or(NOT_SET_UP)?.refresh().map_err(|e| e.to_string())?;
    Ok(st)
}

fn bible_of<'a>(app: &'a App) -> Result<std::sync::MutexGuard<'a, Option<Bible>>, String> {
    let bible = app.bible.lock().unwrap();
    if bible.is_none() {
        return Err(NOT_SET_UP.into());
    }
    Ok(bible)
}

#[tauri::command]
fn reader(app: State<App>, code: String, chapter: u32, version: Option<String>) -> Result<Value, String> {
    let st = fresh(&app)?;
    let st = st.as_ref().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| views::reader_in(bible, st, &code, chapter, version.as_deref().unwrap_or("KJV")))
}

#[tauri::command]
fn word(app: State<App>, code: String, chapter: u32, verse: u32, word: u32) -> Result<Value, String> {
    let st = fresh(&app)?;
    let st = st.as_ref().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| views::word(bible, st, &code, chapter, verse, word))
}

#[tauri::command]
fn verse(app: State<App>, code: String, chapter: u32, verse: u32) -> Result<Value, String> {
    let st = fresh(&app)?;
    let st = st.as_ref().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| views::verse(bible, st, &code, chapter, verse))
}

/// Today's readings in every plan (the same as `wb plan today`).
#[tauri::command]
fn plan_today(app: State<App>) -> Result<Value, String> {
    let st = fresh(&app)?;
    let st = st.as_ref().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| wb_core::reading::today_view(bible, &st.root, wb_core::reading::today()))
}

/// Record chapters as read (the same as `wb read mark`).
#[tauri::command]
fn read_mark(app: State<App>, place: String) -> Result<Value, String> {
    let st = fresh(&app)?;
    let st = st.as_ref().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| wb_core::reading::mark(&st.root, &wb_core::reading::chapters_of(bible, &place)?, ""))
}

/// Color a place (or clear it with no color), by the no-overlap rule; the same as `wb hl set` / `wb hl clear`.
#[tauri::command]
fn highlight(app: State<App>, anchor: String, color: Option<String>) -> Result<Value, String> {
    let mut st = fresh(&app)?;
    let st = st.as_mut().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| studyapi::save_highlight(bible, st, &anchor, color.as_deref()))
}

/// Any `wb` command, run in-process on the window's own Bible and store: the UI and `wb` are one set of actions.
/// `argv` is the command line without `wb`; `input` is what `-` reads. → `{"json": ...}` or `{"text": ...}`.
#[tauri::command]
fn wb(app: State<App>, argv: Vec<String>, input: Option<String>) -> Result<Value, String> {
    let mut st = fresh(&app)?;
    let st = st.as_mut().unwrap();
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    let t = Instant::now();
    let mut ctx = wb_cli::Ctx::lent(bible, st);
    ctx.input = input;
    let v = wb_cli::run_value(&ctx, &argv)?;
    Ok(json!({ "data": v, "rust_ms": t.elapsed().as_secs_f64() * 1000.0 }))
}

#[tauri::command]
fn books(app: State<App>) -> Result<Value, String> {
    let bible = bible_of(&app)?;
    let bible = bible.as_ref().unwrap();
    timed(|| Ok(bible.books().to_vec()))
}

/// What the setup screen needs to know: whether the Bible opens, and whether a study folder has been chosen.
fn setup_value() -> Value {
    let db = wb_core::default_db_path();
    let db_ok = Bible::open(&db).is_ok();
    let configured = wb_core::setup::study_configured();
    // Before the person chooses, show the folder the screen offers, not the development scratch copy.
    let study = if configured { wb_core::default_study_dir() } else { wb_core::setup::suggested_study_dir() };
    let store = if configured {
        Store::open(&study)
    } else {
        Err(wb_core::Error("No folder for your notes has been chosen yet.".into()))
    };
    let db_detail = if db_ok { "Ready".to_string() } else { format!("No readable Bible database at {}", db.display()) };
    let study_detail = match &store {
        Ok(_) => "Ready".to_string(),
        Err(e) => e.0.clone(),
    };
    json!({
        "ok": db_ok && store.is_ok(),
        "version": env!("CARGO_PKG_VERSION"),
        "db": {"path": db.display().to_string(), "ok": db_ok, "detail": db_detail},
        "study": {"path": study.display().to_string(), "ok": store.is_ok(), "configured": configured, "detail": study_detail},
        "suggested_study": wb_core::setup::suggested_study_dir().display().to_string(),
    })
}

#[tauri::command]
fn setup_status() -> Value {
    setup_value()
}

/// Opens a study folder the way boot does, making the folder if the person chose a new one.
fn open_study(path: &std::path::Path) -> Result<Store, String> {
    std::fs::create_dir_all(path).map_err(|e| format!("The folder could not be made ({}): {e}", path.display()))?;
    let mut store = Store::open(path).map_err(|e| e.to_string())?;
    store.recheck = std::time::Duration::from_secs(1);
    if let Err(e) = store.empty_trash(wb_core::store::TRASH_DAYS) {
        eprintln!("The trash could not be emptied: {e}");
    }
    Ok(store)
}

fn use_study(app: &tauri::AppHandle, path: std::path::PathBuf) -> Result<Value, String> {
    let store = open_study(&path)?;
    wb_core::setup::set_setting("study_dir", &path.to_string_lossy()).map_err(|e| e.to_string())?;
    *app.state::<App>().store.lock().unwrap() = Some(store);
    serve_do(app.clone(), path);
    Ok(setup_value())
}

#[tauri::command]
fn set_study_dir(app: tauri::AppHandle, path: String) -> Result<Value, String> {
    use_study(&app, std::path::PathBuf::from(path))
}

#[tauri::command]
async fn choose_study_dir(app: tauri::AppHandle) -> Result<Value, String> {
    let handle = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        handle.dialog().file().set_title("Choose the folder for your notes").blocking_pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;
    match picked {
        Some(FilePath::Path(path)) => use_study(&app, path),
        Some(FilePath::Url(_)) => Err("Choose a folder on this computer.".into()),
        None => Err("No folder was chosen.".into()),
    }
}

fn use_database(app: &tauri::AppHandle, path: std::path::PathBuf) -> Result<Value, String> {
    let bible = Bible::open(&path).map_err(|e| e.to_string())?;
    wb_core::setup::set_setting("bible_db", &path.to_string_lossy()).map_err(|e| e.to_string())?;
    *app.state::<App>().bible.lock().unwrap() = Some(bible);
    let warm = path.clone();
    std::thread::spawn(move || {
        if let Ok(b) = Bible::open(&warm) {
            let _ = wb_core::lookup::warm(&b);
        }
    });
    Ok(setup_value())
}

#[tauri::command]
fn set_bible_db(app: tauri::AppHandle, path: String) -> Result<Value, String> {
    use_database(&app, std::path::PathBuf::from(path))
}

#[tauri::command]
async fn choose_bible_db(app: tauri::AppHandle) -> Result<Value, String> {
    let handle = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        handle
            .dialog()
            .file()
            .set_title("Choose the Bible database")
            .add_filter("Bible database", &["db", "sqlite", "sqlite3"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    match picked {
        Some(FilePath::Path(path)) => use_database(&app, path),
        Some(FilePath::Url(_)) => Err("Choose a file on this computer.".into()),
        None => Err("No file was chosen.".into()),
    }
}

#[tauri::command]
fn set_window(window: tauri::WebviewWindow, preset: String) -> Result<Value, String> {
    let &(name, w, h) = PRESETS.iter().find(|p| p.0 == preset).ok_or(format!("No window size {preset:?}"))?;
    window.unmaximize().ok();
    window.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
    let got = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().unwrap_or(1.0);
    Ok(json!({ "preset": name, "asked": [w, h], "got": [got.width as f64 / scale, got.height as f64 / scale] }))
}

/// The UI calls this once the first chapter is on screen. With `WB_MEASURE_OUT` set, the report is written there for
/// `measure/measure.mjs` (start-up time is measured from process start, which the measuring script records).
#[tauri::command]
fn ui_ready(app: State<App>, report: Value) -> Result<Value, String> {
    let out = json!({
        "ready_wall_ms": wall_ms() as f64,
        "main_wall_ms": app.started_wall_ms as f64,
        "main_to_ready_ms": app.started.elapsed().as_secs_f64() * 1000.0,
        "ui": report,
    });
    if let Ok(path) = std::env::var("WB_MEASURE_OUT") {
        std::fs::write(&path, serde_json::to_string_pretty(&out).unwrap()).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

/// Options for a shortcut (a Start menu or taskbar icon cannot carry the settings a terminal can):
/// `--study <folder>` is WB_STUDY_DIR, `--allow-real-study` is WB_ALLOW_REAL_STUDY=1, `--window <size>` is WB_WINDOW.
/// Nothing in this repository passes `--allow-real-study`; the person's own shortcut does.
fn take_options() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--study" => std::env::set_var("WB_STUDY_DIR", args.next().ok_or("--study needs a folder after it")?),
            "--db" => std::env::set_var("WB_BIBLE_DB", args.next().ok_or("--db needs a file after it")?),
            "--allow-real-study" => std::env::set_var("WB_ALLOW_REAL_STUDY", "1"),
            "--window" => std::env::set_var("WB_WINDOW", args.next().ok_or("--window needs a size after it (laptop, desktop, ...)")?),
            other => return Err(format!("Unknown option “{other}”. The options are --study <folder>, --db <file>, --allow-real-study and --window <size>.")),
        }
    }
    Ok(())
}

/// Says why the app cannot start, in a window (the release app has no console), then stops.
fn fail(msg: &str) -> ! {
    #[cfg(windows)]
    {
        #[link(name = "user32")]
        extern "system" {
            fn MessageBoxW(hwnd: *mut std::ffi::c_void, text: *const u16, caption: *const u16, kind: u32) -> i32;
        }
        let wide = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
        let (text, caption) = (wide(msg), wide("Bible Workbench"));
        // MB_OK | MB_ICONWARNING
        unsafe { MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x30) };
    }
    eprintln!("{msg}");
    std::process::exit(1)
}

fn main() {
    let started = Instant::now();
    let started_wall_ms = wall_ms();
    if let Err(e) = take_options() {
        fail(&e);
    }
    // A first run has no database or study folder yet: the window opens on its setup screen instead of closing. The
    // package puts the Bible at `datasets/workbench.db` beside the program (wb_core::setup).
    let bible = Bible::open(&wb_core::default_db_path()).ok();
    let store = if wb_core::setup::study_configured() {
        match open_study(&wb_core::default_study_dir()) {
            Ok(store) => Some(store),
            Err(e) => {
                eprintln!("{e}");
                None
            }
        }
    } else {
        None
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(App { bible: Mutex::new(bible), store: Mutex::new(store), started, started_wall_ms, waiting: Mutex::new(HashMap::new()) })
        .invoke_handler(tauri::generate_handler![
            wb, do_done, reader, word, verse, books, highlight, plan_today, read_mark, set_window, ui_ready,
            setup_status, set_study_dir, choose_study_dir, set_bible_db, choose_bible_db
        ])
        .setup(|app| {
            if app.state::<App>().store.lock().unwrap().is_some() {
                serve_do(app.handle().clone(), wb_core::default_study_dir());
                // The search index and the word offsets, built (or read from the cache) while the reader opens, so the
                // first search does not wait for them.
                std::thread::spawn(|| {
                    if let Ok(b) = Bible::open(&wb_core::default_db_path()) {
                        let _ = wb_core::lookup::warm(&b);
                    }
                });
            }
            let preset = std::env::var("WB_WINDOW").unwrap_or_else(|_| "laptop".into());
            let &(_, w, h) = PRESETS.iter().find(|p| p.0 == preset).unwrap_or(&PRESETS[4]);
            let mut b = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Bible Workbench")
                .inner_size(w, h)
                .min_inner_size(320.0, 320.0);
            // For measuring: lets Playwright attach to the web view over the DevTools protocol (WebView2 only).
            if let Ok(port) = std::env::var("WB_CDP_PORT") {
                b = b.additional_browser_args(&format!(
                    "--remote-debugging-port={port} --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"
                ));
            }
            b.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bible Workbench");
}
