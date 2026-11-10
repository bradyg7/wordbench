// The Tauri 2 shell: the window, and commands that call wb-core. Nothing here knows about drawing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use tauri::{Emitter, Manager, LogicalSize, State, WebviewUrl, WebviewWindowBuilder};
use wb_core::{bible::Bible, store::Store, studyapi, views};
#[cfg(feature = "updater")]
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
#[cfg(feature = "updater")]
use tauri_plugin_updater::UpdaterExt;

struct App {
    bible: Mutex<Bible>,
    /// The person's files, kept in step with the folder: refreshed (at most once a second) before each request.
    store: Mutex<Store>,
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
fn fresh<'a>(app: &'a App) -> Result<std::sync::MutexGuard<'a, Store>, String> {
    wb_core::runtime::require_license().map_err(|e| e.to_string())?;
    let mut st = app.store.lock().unwrap();
    st.refresh().map_err(|e| e.to_string())?;
    Ok(st)
}

#[tauri::command]
fn reader(app: State<App>, code: String, chapter: u32, version: Option<String>) -> Result<Value, String> {
    let st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    timed(|| views::reader_in(&bible, &st, &code, chapter, version.as_deref().unwrap_or("KJV")))
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

/// Any `wb` command, run in-process on the window's own Bible and store: the UI and `wb` are one set of actions.
/// `argv` is the command line without `wb`; `input` is what `-` reads. → `{"json": ...}` or `{"text": ...}`.
#[tauri::command]
fn wb(app: State<App>, argv: Vec<String>, input: Option<String>) -> Result<Value, String> {
    let mut st = fresh(&app)?;
    let bible = app.bible.lock().unwrap();
    let t = Instant::now();
    let mut ctx = wb_cli::Ctx::lent(&bible, &mut st);
    ctx.input = input;
    let v = wb_cli::run_value(&ctx, &argv)?;
    Ok(json!({ "data": v, "rust_ms": t.elapsed().as_secs_f64() * 1000.0 }))
}

/// `%XX` in a header back to its characters (the page sends a file's name with encodeURIComponent).
fn unpercent(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Some(v) = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A file dropped, pasted or picked in the window, attached to a finding (the same as `wb finding attach`, which takes a
/// path; the page has the file's bytes and no path). The body is the bytes; the headers say which finding and the name.
#[tauri::command]
fn finding_attach(app: State<App>, request: tauri::ipc::Request<'_>) -> Result<Value, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("The file's bytes did not arrive.".into()) };
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).map(unpercent).unwrap_or_default();
    let root = fresh(&app)?.root.clone();
    timed(|| wb_core::findings::attach_bytes(&root, &header("wb-finding"), &header("wb-name"), bytes))
}

#[tauri::command]
fn books(app: State<App>) -> Result<Value, String> {
    wb_core::runtime::require_license().map_err(|e| e.to_string())?;
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

/// Options for a shortcut (a Start menu or taskbar icon cannot carry the settings a terminal can):
/// `--study <folder>` is WB_STUDY_DIR, `--allow-real-study` is WB_ALLOW_REAL_STUDY=1, `--window <size>` is WB_WINDOW.
/// Nothing in this repository passes `--allow-real-study`; the person's own shortcut does.
#[cfg(not(feature = "distribution"))]
fn take_options() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--study" => std::env::set_var("WB_STUDY_DIR", args.next().ok_or("--study needs a folder after it")?),
            "--allow-real-study" => std::env::set_var("WB_ALLOW_REAL_STUDY", "1"),
            "--window" => std::env::set_var("WB_WINDOW", args.next().ok_or("--window needs a size after it (laptop, desktop, ...)")?),
            other => return Err(format!("Unknown option “{other}”. The options are --study <folder>, --allow-real-study and --window <size>.")),
        }
    }
    Ok(())
}

/// Says why the app cannot start, in a window (the release app has no console), then stops.
#[cfg(not(feature = "distribution"))]
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

#[tauri::command]
fn installation_status() -> Result<wb_core::runtime::Status, String> {
    #[cfg(feature = "distribution")]
    { Ok(wb_core::runtime::roots().status()) }
    #[cfg(not(feature = "distribution"))]
    { Err("Installation setup is available in distribution builds only.".into()) }
}

#[tauri::command]
fn installation_configure(app: tauri::AppHandle, path: String, create: bool) -> Result<(), String> {
    if app.try_state::<App>().is_some() { return Err("Close the study workspace before changing installation settings.".into()); }
    #[cfg(feature = "distribution")]
    { wb_core::runtime::roots().configure(std::path::Path::new(&path), create).map_err(|e| e.to_string()) }
    #[cfg(not(feature = "distribution"))]
    { let _ = (path, create); Err("Installation setup is available in distribution builds only.".into()) }
}

#[tauri::command]
fn installation_restart(app: tauri::AppHandle) -> Result<(), String> {
    if app.try_state::<App>().is_some() { return Err("Restart from setup only; preserve your open workspace.".into()); }
    #[cfg(feature = "distribution")]
    { app.restart(); }
    #[cfg(not(feature = "distribution"))]
    { let _ = app; Err("Installation setup is available in distribution builds only.".into()) }
}

#[tauri::command]
fn pilot_license(action: String, certificate: Option<String>) -> Result<Value, String> {
    #[cfg(feature = "distribution")]
    {
        let license = wb_core::runtime::licensing();
        match action.as_str() {
            "status" => serde_json::to_value(license.status()).map_err(|e| e.to_string()),
            "request" => Ok(json!({"request": license.request()?})),
            "import" => { license.import(certificate.as_deref().ok_or("Choose a license file first.")?)?; Ok(json!({"active":true})) },
            _ => Err("Unknown license action.".into()),
        }
    }
    #[cfg(not(feature = "distribution"))]
    { let _ = (action, certificate); Err("Pilot licensing is available in distribution builds only.".into()) }
}

/// Looks at the update feed once, a little after the reader opens, and asks before installing: an update is never
/// something that happens to someone mid-chapter. The installer closes the app and opens it again where it was; the
/// study folder and the settings are not part of it. `WB_NO_UPDATE_CHECK=1` turns the check off.
#[cfg(feature = "updater")]
fn check_for_update(app: tauri::AppHandle) {
    // Without the updater's configuration its plugin is not registered (see main), and there is nothing to check.
    if std::env::var("WB_NO_UPDATE_CHECK").is_ok() || !app.config().plugins.0.contains_key("updater") {
        return;
    }
    std::thread::spawn(move || {
        // The reader comes first: the first chapter is on screen before this asks anything of the network.
        std::thread::sleep(std::time::Duration::from_secs(10));
        let found = tauri::async_runtime::block_on(async {
            let updater = app.updater().ok()?;
            updater.check().await.ok().flatten()
        });
        let Some(update) = found else { return };
        let install = app
            .dialog()
            .message(format!(
                "Bible Workbench {} is ready to install.\n\nYour notes stay where they are, and the window opens again where you left off.",
                update.version
            ))
            .title("A new version of Bible Workbench")
            .buttons(MessageDialogButtons::OkCancelCustom("Install it".into(), "Not now".into()))
            .blocking_show();
        if !install {
            return;
        }
        // Windows runs the installer and exits this process; elsewhere the app restarts into the new version.
        let installed = tauri::async_runtime::block_on(update.download_and_install(|_, _| {}, || {})).is_ok();
        if installed {
            app.restart();
        }
    });
}

fn main() {
    let started = Instant::now();
    let started_wall_ms = wall_ms();
    #[cfg(not(feature = "distribution"))]
    if let Err(e) = take_options() {
        fail(&e);
    }
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default();
    // The updater starts only when the build supplies its configuration (plugins.updater: public key and endpoint). Without
    // it the plugin refuses to start and the app does not open, so an updater build without that configuration just has no update check.
    #[cfg(feature = "updater")]
    let builder = {
        let builder = builder.plugin(tauri_plugin_dialog::init());
        if context.config().plugins.0.contains_key("updater") {
            builder.plugin(tauri_plugin_updater::Builder::new().build())
        } else {
            builder
        }
    };
    builder
        .invoke_handler(tauri::generate_handler![pilot_license, installation_status, installation_configure, installation_restart, wb, finding_attach, do_done, reader, word, verse, books, highlight, plan_today, read_mark, set_window, ui_ready])
        .setup(move |app| {
            #[cfg(feature = "distribution")]
            {
                let roots = wb_core::runtime::initialize(app.path().resource_dir()?.join("resources"))?;
                if !roots.status().ready || wb_core::runtime::require_license().is_err() {
                    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("setup.html".into()))
                        .title("Set up Bible Workbench").inner_size(760.0, 660.0).min_inner_size(360.0, 500.0).build()?;
                    return Ok(());
                }
            }
            let bible = Bible::open(&wb_core::default_db_path())?;
            let mut store = Store::open(&wb_core::default_study_dir())?;
            store.recheck = std::time::Duration::from_secs(1);
            // Notes/questions deleted a week ago are erased (existing policy; wb trash empty does the same).
            if let Err(e) = store.empty_trash(wb_core::store::TRASH_DAYS) {
                eprintln!("The trash could not be emptied: {e}");
            }
            app.manage(App { bible: Mutex::new(bible), store: Mutex::new(store), started, started_wall_ms, waiting: Mutex::new(HashMap::new()) });
            serve_do(app.handle().clone(), wb_core::default_study_dir());
            // The search index and the word offsets, built (or read from the cache) while the reader opens, so the first
            // search does not wait for them.
            std::thread::spawn(|| {
                if let Ok(b) = Bible::open(&wb_core::default_db_path()) {
                    let _ = wb_core::lookup::warm(&b);
                }
            });
            let preset = std::env::var("WB_WINDOW").unwrap_or_else(|_| "laptop".into());
            let &(_, w, h) = PRESETS.iter().find(|p| p.0 == preset).unwrap_or(&PRESETS[4]);
            let b = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Bible Workbench")
                .inner_size(w, h)
                .min_inner_size(320.0, 320.0)
                // Tauri's own handler for files dropped on the window takes the OS drag on Windows (WebView2), so the page's
                // HTML5 dragstart/dragover/drop never run for a real mouse: blocks, sidebar pages, notes on verses and a
                // plan's days could not be dragged (finding 64c7). Nothing here listens for file drops.
                .disable_drag_drop_handler();
            // For measuring: lets Playwright attach to the web view over the DevTools protocol (WebView2 only).
            #[cfg(not(feature = "distribution"))]
            let b = if let Ok(port) = std::env::var("WB_CDP_PORT") {
                b.additional_browser_args(&format!(
                    "--remote-debugging-port={port} --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"
                ))
            } else { b };
            b.build()?;
            #[cfg(feature = "updater")]
            check_for_update(app.handle().clone());
            Ok(())
        })
        .run(context)
        .expect("error while running Bible Workbench");
}
