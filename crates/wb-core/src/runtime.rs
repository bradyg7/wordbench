//! Customer installation bootstrap. Developer builds keep their existing scratch paths.
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::OnceLock,
};

static ROOTS: OnceLock<Roots> = OnceLock::new();

#[derive(Clone, Debug)]
pub struct Roots {
    pub resources: PathBuf,
    pub config: PathBuf,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    schema_version: u32,
    study_dir: PathBuf,
}

#[derive(Serialize)]
pub struct Status {
    pub ready: bool,
    pub resources_ok: bool,
    pub study_dir: Option<PathBuf>,
    pub suggested_dir: PathBuf,
    pub problem: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    schema_version: u32,
    app_version: String,
    files: Vec<Resource>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Resource {
    name: String,
    bytes: u64,
    sha256: String,
}

fn bad(message: impl Into<String>) -> Error {
    Error(message.into())
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn initialize(resources: PathBuf) -> Result<&'static Roots> {
    // Shared location for GUI and CLI, independent of working directory.
    let local = crate::platform::local_data_dir()
        .ok_or_else(|| bad("This computer's local application data folder is unavailable."))?;
    ROOTS
        .set(Roots {
            resources,
            config: local.join("bible-workbench-rs").join("installation"),
        })
        .map_err(|_| bad("Installation paths were already initialized."))?;
    Ok(ROOTS.get().unwrap())
}

pub fn roots() -> &'static Roots {
    ROOTS
        .get()
        .expect("initialize installation paths before opening the app")
}
#[cfg(feature = "distribution")]
pub fn licensing() -> wb_license::LocalLicense {
    wb_license::LocalLicense::new(roots().config.join("licensing"))
}
pub fn require_license() -> Result<()> {
    #[cfg(feature = "distribution")]
    {
        // A permanent certificate is verified once per process; no heartbeat or expiry is introduced.
        static VERIFIED: OnceLock<()> = OnceLock::new();
        if VERIFIED.get().is_none() {
            if ROOTS.get().is_none() {
                return Err(bad(
                    "Installation paths must be initialized before checking activation.",
                ));
            }
            licensing().active().map_err(bad)?;
            let _ = VERIFIED.set(());
        }
    }
    Ok(())
}
pub fn resource_path(name: &str) -> PathBuf {
    roots().resources.join(name)
}
pub fn study_path() -> PathBuf {
    roots()
        .load_study()
        .ok()
        .flatten()
        .unwrap_or_else(|| roots().config.join("setup-required"))
}

impl Roots {
    pub fn validate_resources(&self) -> Result<()> {
        let manifest: Manifest =
            serde_json::from_slice(&fs::read(self.resources.join("resources-manifest.json"))?)
                .map_err(|e| bad(e.to_string()))?;
        if manifest.schema_version != 1 || manifest.app_version != env!("CARGO_PKG_VERSION") {
            return Err(bad(
                "Installed resource version is incompatible. Reinstall the matching app package.",
            ));
        }
        let required = ["workbench.db", "dictionary.db"];
        if manifest.files.len() != required.len() {
            return Err(bad("Incomplete installed resource inventory."));
        }
        for name in required {
            let entries: Vec<_> = manifest.files.iter().filter(|f| f.name == name).collect();
            if entries.len() != 1 {
                return Err(bad(format!("Missing or duplicate resource: {name}")));
            }
            let entry = entries[0];
            let base = fs::canonicalize(&self.resources)?;
            let path = fs::canonicalize(base.join(name))?;
            if !path.starts_with(&base) {
                return Err(bad("Installed resource points outside the package."));
            }
            let mut file = fs::File::open(path)?;
            if entry.bytes == 0 || file.metadata()?.len() != entry.bytes {
                return Err(bad(format!("Installed resource size mismatch: {name}")));
            }
            let mut hash = Sha256::new();
            let mut buffer = [0u8; 65536];
            loop {
                let n = file.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                hash.update(&buffer[..n]);
            }
            if hex(&hash.finalize()) != entry.sha256 {
                return Err(bad(format!(
                    "Installed resource checksum mismatch: {name}. Repair the installation."
                )));
            }
        }
        // Check the core read schemas as well as the bytes, without writing either DB.
        crate::bible::Bible::open(&self.resources.join("workbench.db"))?;
        crate::dictionary::Dictionary::open(&self.resources.join("dictionary.db"))?.source()?;
        Ok(())
    }

    pub fn load_study(&self) -> Result<Option<PathBuf>> {
        let path = self.config.join("installation.json");
        let bytes = match fs::read(path) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let config: Config = serde_json::from_slice(&bytes).map_err(|e| bad(e.to_string()))?;
        if config.schema_version != 1 || !config.study_dir.is_absolute() {
            return Err(bad(
                "Invalid installation settings. Choose your study folder again.",
            ));
        }
        self.validate_study(&config.study_dir)?;
        Ok(Some(config.study_dir))
    }

    fn validate_study(&self, path: &Path) -> Result<()> {
        crate::store::guard(path)?;
        let path = fs::canonicalize(path)?;
        self.validate_location(&path)
    }

    fn validate_location(&self, path: &Path) -> Result<()> {
        let resources = fs::canonicalize(&self.resources)?;
        if path.starts_with(&resources) || resources.starts_with(&path) {
            return Err(bad(
                "Keep your study folder separate from the installed app resources.",
            ));
        }
        // The Windows resource directory is <install>/resources. Prevent storing work beside app binaries too.
        if let Some(install) = resources.parent() {
            if path.starts_with(install) {
                return Err(bad("Choose a study folder outside the app installation."));
            }
        }
        if let Ok(config) = fs::canonicalize(&self.config) {
            if path.starts_with(&config) || config.starts_with(path) {
                return Err(bad(
                    "Choose a study folder separate from installation settings.",
                ));
            }
        }
        Ok(())
    }

    pub fn status(&self) -> Status {
        let suggested_dir = crate::home()
            .join("Documents")
            .join("Bible Workbench Study");
        if let Err(e) = self.validate_resources() {
            return Status {
                ready: false,
                resources_ok: false,
                study_dir: None,
                suggested_dir,
                problem: Some(format!("{e}")),
            };
        }
        match self.load_study() {
            Ok(study_dir) => Status {
                ready: study_dir.is_some(),
                resources_ok: true,
                study_dir,
                suggested_dir,
                problem: None,
            },
            Err(e) => Status {
                ready: false,
                resources_ok: true,
                study_dir: None,
                suggested_dir,
                problem: Some(format!("{e}")),
            },
        }
    }

    pub fn configure(&self, path: &Path, create: bool) -> Result<()> {
        self.validate_resources()?;
        if !path.is_absolute() {
            return Err(bad("Choose an absolute study folder path."));
        }
        if create {
            let parent = fs::canonicalize(
                path.parent()
                    .ok_or_else(|| bad("Choose a folder inside an existing parent."))?,
            )?;
            let candidate = parent.join(
                path.file_name()
                    .ok_or_else(|| bad("Choose a named study folder."))?,
            );
            self.validate_location(&candidate)?;
            // A new workspace must really be new. Never reinterpret an existing folder as an empty study.
            fs::create_dir(path).map_err(|e| bad(format!("Could not create a new study folder: {e}. Its parent must exist and the folder must be new.")))?;
        }
        self.validate_study(path)?;
        let study_dir = fs::canonicalize(path)?;
        fs::create_dir_all(&self.config)?;
        let config = Config {
            schema_version: 1,
            study_dir,
        };
        crate::store::write_atomic(
            &self.config.join("installation.json"),
            &serde_json::to_string_pretty(&config).map_err(|e| bad(e.to_string()))?,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    struct Fixture(PathBuf, Roots);
    impl Fixture {
        fn new() -> Self {
            static N: AtomicUsize = AtomicUsize::new(0);
            let base = std::env::temp_dir().join(format!(
                "wb-install-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            let roots = Roots {
                resources: base.join("app/resources"),
                config: base.join("config"),
            };
            fs::create_dir_all(&roots.resources).unwrap();
            let mut files = vec![];
            for name in ["workbench.db", "dictionary.db"] {
                let path = roots.resources.join(name);
                let conn = rusqlite::Connection::open(&path).unwrap();
                conn.execute_batch(if name == "workbench.db" {
                    "CREATE TABLE books (id INTEGER, code TEXT, name TEXT, testament TEXT, chapters INTEGER);"
                } else {
                    "CREATE TABLE meta (key TEXT, value TEXT); CREATE TABLE entries (headword TEXT, text TEXT);"
                }).unwrap();
                drop(conn);
                let bytes = fs::read(path).unwrap();
                files.push(serde_json::json!({"name":name,"bytes":bytes.len(),"sha256":hex(&Sha256::digest(&bytes))}));
            }
            // The synthetic resource is intentionally not scripture or a production DB.
            fs::write(roots.resources.join("resources-manifest.json"), serde_json::to_vec(&serde_json::json!({"schema_version":1,"app_version":env!("CARGO_PKG_VERSION"),"files":files})).unwrap()).unwrap();
            Self(base, roots)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn first_run_persists_new_folder_and_preserves_existing_files() {
        let f = Fixture::new();
        assert!(!f.1.status().ready);
        let study = f.0.join("study");
        f.1.configure(&study, true).unwrap();
        fs::write(study.join("personal.md"), "private test note").unwrap();
        assert!(f.1.status().ready);
        assert_eq!(
            f.1.load_study().unwrap(),
            Some(fs::canonicalize(&study).unwrap())
        );
        assert!(f.1.configure(&study, true).is_err());
        f.1.configure(&study, false).unwrap();
        assert_eq!(
            fs::read_to_string(study.join("personal.md")).unwrap(),
            "private test note"
        );
    }
    #[test]
    fn corruption_and_missing_folder_are_recoverable() {
        let f = Fixture::new();
        let study = f.0.join("missing");
        assert!(f.1.configure(&study, false).is_err());
        f.1.configure(&study, true).unwrap();
        fs::remove_dir(&study).unwrap();
        assert!(!f.1.status().ready);
        fs::write(f.1.resources.join("dictionary.db"), "tampered").unwrap();
        assert!(!f.1.status().resources_ok);
        assert!(f.1.configure(&f.0.join("other"), true).is_err());
        assert!(!f.0.join("other").exists());
    }
    #[test]
    fn study_cannot_live_in_installation_or_use_relative_paths() {
        let f = Fixture::new();
        assert!(f.1.configure(Path::new("relative"), true).is_err());
        assert!(f.1.configure(&f.1.resources, false).is_err());
        assert!(f
            .1
            .configure(f.1.resources.parent().unwrap(), false)
            .is_err());
        let forbidden = f.1.resources.parent().unwrap().join("new-study");
        assert!(f.1.configure(&forbidden, true).is_err());
        assert!(!forbidden.exists());
    }
}
