//! The two places the operating system differs: where per-user app data lives, and how a file is shown in its folder.

use std::path::{Path, PathBuf};

/// The per-user local data folder: `LOCALAPPDATA` on Windows, `~/Library/Application Support` on a Mac,
/// `XDG_DATA_HOME` or `~/.local/share` elsewhere. Callers join their own `bible-workbench-rs` subfolder.
pub fn local_data_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library").join("Application Support"))
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
    }
}

/// The program and arguments that show `path` picked out in its folder (`select` true, a file) or open it (false).
/// `os` is `std::env::consts::OS`; a parameter so every platform's line is testable anywhere.
pub fn show_command_for(os: &str, path: &Path, select: bool) -> (String, Vec<String>) {
    let p = path.display().to_string();
    let dir = || path.parent().map(|d| d.display().to_string()).unwrap_or_else(|| p.clone());
    match (os, select) {
        ("windows", true) => ("explorer.exe".into(), vec![format!("/select,{p}")]),
        ("windows", false) => ("explorer.exe".into(), vec![p]),
        ("macos", true) => ("open".into(), vec!["-R".into(), p]),
        ("macos", false) => ("open".into(), vec![p]),
        (_, true) => ("xdg-open".into(), vec![dir()]),
        (_, false) => ("xdg-open".into(), vec![p]),
    }
}

/// Starts the command for this computer: show the file in its folder, or open it.
pub fn show(path: &Path, select: bool) -> std::io::Result<std::process::Child> {
    let (program, args) = show_command_for(std::env::consts::OS, path, select);
    std::process::Command::new(program).args(args).spawn()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn show_commands_per_platform() {
        let f = Path::new("/a/b/c.docx");
        assert_eq!(show_command_for("windows", f, true).0, "explorer.exe");
        assert_eq!(show_command_for("windows", f, true).1, vec![format!("/select,{}", f.display())]);
        assert_eq!(show_command_for("windows", f, false).1, vec![f.display().to_string()]);
        assert_eq!(show_command_for("macos", f, true), ("open".to_string(), vec!["-R".to_string(), f.display().to_string()]));
        assert_eq!(show_command_for("macos", f, false), ("open".to_string(), vec![f.display().to_string()]));
        assert_eq!(show_command_for("linux", f, true), ("xdg-open".to_string(), vec![Path::new("/a/b").display().to_string()]));
        assert_eq!(show_command_for("linux", f, false).1, vec![f.display().to_string()]);
    }

    #[test]
    fn this_computer_has_a_command_and_a_data_folder() {
        let (program, args) = show_command_for(std::env::consts::OS, Path::new("x.pdf"), true);
        assert!(!program.is_empty() && !args.is_empty());
        #[cfg(any(windows, target_os = "macos"))]
        assert!(local_data_dir().is_some());
    }
}
