mod common;
use common::Scratch;
use wb_core::{mycommands as commands, notebook, store::Store};

#[test]
fn shortcut_modifiers_are_normalized_and_invalid_chords_rejected() {
    assert_eq!(commands::normalize_key("shift+control+k").unwrap(), "Ctrl+Shift+K");
    assert_eq!(commands::normalize_key("alt+ctrl+u").unwrap(), "Ctrl+Alt+U");
    for key in ["U", "Shift+K", "Ctrl+Ctrl+U", "Ctrl+Unknown", "Ctrl+", "Meta+U"] { assert!(commands::normalize_key(key).is_err(), "{key}"); }
}

#[test]
fn layout_keys_share_collision_checks_with_commands_and_capture() {
    let scratch = Scratch::new();
    let mut store = Store::open(scratch.path()).unwrap();
    for key in ["Ctrl+F", "Ctrl+J", "Ctrl+,", "Ctrl+\\", "Ctrl+Shift+J", "Ctrl+0"] {
        assert!(commands::add(&mut store, "Layout: desk", "layout load Desk", key, "").unwrap_err().0.contains("already"));
    }
    commands::add(&mut store, "Layout: desk", "layout load Desk", "Ctrl+Shift+K", "").unwrap();
    assert!(commands::add(&mut store, "Other", "help", "shift+ctrl+k", "").is_err());
    assert!(notebook::set_setting(&mut store, "capture", "Ctrl+Shift+K").is_err());
    assert_eq!(commands::list(&store).len(), 1);
    commands::add(&mut store, "Layout: desk", "layout load Desk", "Alt+U", "").unwrap();
    notebook::set_setting(&mut store, "capture", "Ctrl+Shift+K").unwrap();
    assert!(commands::add(&mut store, "Other", "help", "Ctrl+Shift+K", "").is_err());
}

#[test]
fn resetting_capture_cannot_steal_a_saved_command_key() {
    let scratch = Scratch::new();
    let mut store = Store::open(scratch.path()).unwrap();
    notebook::set_setting(&mut store, "capture", "Alt+U").unwrap();
    commands::add(&mut store, "Layout: desk", "layout load Desk", "Ctrl+J", "").unwrap();
    assert!(notebook::set_setting(&mut store, "capture", "default").is_err());
    assert_eq!(notebook::settings(&store)["capture"], "Alt+U");
}
