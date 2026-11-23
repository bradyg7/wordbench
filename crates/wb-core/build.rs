// Two things the program carries with it:
// - the commit this copy was built from, for the Updates section of a copy built from source ("built from source (40a91dc)");
// - the notes of this very version (docs/releases/<version>.md), so "What changed" can be read offline after an update
//   (design/features/updates U-9), and the update public key from the release configuration (U-17: compiled in).
use std::path::Path;

fn main() {
    let commit = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".into());
    println!("cargo:rustc-env=WB_BUILD_COMMIT={commit}");
    println!("cargo:rerun-if-changed=../../.git/HEAD");
    println!("cargo:rerun-if-changed=build.rs");

    let out = std::env::var("OUT_DIR").unwrap();
    let version = std::env::var("CARGO_PKG_VERSION").unwrap();
    let notes = Path::new("../../docs/releases").join(format!("{version}.md"));
    println!("cargo:rerun-if-changed={}", notes.display());
    std::fs::write(
        Path::new(&out).join("installed-notes.md"),
        std::fs::read_to_string(&notes).unwrap_or_default(),
    )
    .unwrap();

    let conf = Path::new("../../app/src-tauri/tauri.release.conf.json");
    println!("cargo:rerun-if-changed={}", conf.display());
    let text = std::fs::read_to_string(conf).unwrap_or_default();
    let key = text
        .split("\"pubkey\"")
        .nth(1)
        .and_then(|r| r.split('"').nth(1))
        .unwrap_or("");
    std::fs::write(Path::new(&out).join("update-pubkey.txt"), key).unwrap();
}
