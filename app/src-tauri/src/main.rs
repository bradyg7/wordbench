// The Tauri 2 shell: the window, and commands that call wb-core. Nothing here knows about drawing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{LogicalSize, State, WebviewUrl, WebviewWindowBuilder};
use wb_core::{bible::Bible, store::Store, studyapi, views};

struct App {
    bible: Mutex<Bible>,
    /// The person's files, kept in step with the folder: refreshed (at most once a second) before each request.
    store: Mutex<Store>,
    started: Instant,
    started_wall_ms: u128,
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
fn fresh<'a>(app: &'a App) -> Result<std::sync::MutexGuard<'a, Store>, String> {
    let mut st = app.store.lock().unwrap();
    st.refresh().map_err(|e| e.to_string())?;
    Ok(st)
}

#[tauri::command]
fn reader(app: State<App>, code: String, chapter: u32) -> Result<Value, String> {
    let st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| views::reader(&bible, &st, &code, chapter))
}

#[tauri::command]
fn word(app: State<App>, code: String, chapter: u32, verse: u32, word: u32) -> Result<Value, String> {
    let st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| views::word(&bible, &st, &code, chapter, verse, word))
}

#[tauri::command]
fn verse(app: State<App>, code: String, chapter: u32, verse: u32) -> Result<Value, String> {
    let st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| views::verse(&bible, &st, &code, chapter, verse))
}

/// Today's readings in every plan (the same as `wb plan today`).
#[tauri::command]
fn plan_today(app: State<App>) -> Result<Value, String> {
    let st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| wb_core::reading::today_view(&bible, &st.root, wb_core::reading::today()))
}

/// Record chapters as read (the same as `wb read mark`).
#[tauri::command]
fn read_mark(app: State<App>, place: String) -> Result<Value, String> {
    let st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| wb_core::reading::mark(&st.root, &wb_core::reading::chapters_of(&bible, &place)?, ""))
}

/// Color a place (or clear it with no color), by the no-overlap rule; the same as `wb hl set` / `wb hl clear`.
#[tauri::command]
fn highlight(app: State<App>, anchor: String, color: Option<String>) -> Result<Value, String> {
    let mut st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| studyapi::save_highlight(&bible, &mut st, &anchor, color.as_deref()))
}

#[tauri::command]
fn books(app: State<App>) -> Result<Value, String> {
    let bible = app.bible.lock().unwrap();
    timed(|| Ok(bible.books().to_vec()))
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

fn main() {
    let started = Instant::now();
    let started_wall_ms = wall_ms();
    let bible = Bible::open(&wb_core::default_db_path()).unwrap_or_else(|e| panic!("{e}"));
    let mut store = Store::open(&wb_core::default_study_dir()).unwrap_or_else(|e| panic!("{e}"));
    store.recheck = std::time::Duration::from_secs(1);
    tauri::Builder::default()
        .manage(App { bible: Mutex::new(bible), store: Mutex::new(store), started, started_wall_ms })
        .invoke_handler(tauri::generate_handler![reader, word, verse, books, highlight, plan_today, read_mark, set_window, ui_ready])
        .setup(|app| {
            // The search index and the word offsets, built (or read from the cache) while the reader opens, so the first
            // search does not wait for them.
            std::thread::spawn(|| {
                if let Ok(b) = Bible::open(&wb_core::default_db_path()) {
                    let _ = wb_core::lookup::warm(&b);
                }
            });
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
