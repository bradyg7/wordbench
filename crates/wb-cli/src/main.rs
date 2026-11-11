//! `wb`: the command line over wb-cli's command table (src/lib.rs). The window runs the same table in-process.

use serde_json::Value;
use wb_cli::{run, Ctx, Fail, Out};

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    if argv.iter().map(String::as_str).eq(["build-info", "--json"]) {
        println!("{}", wb_core::runtime::build_info());
        return;
    }

    #[cfg(feature = "distribution")]
    {
        let result = (|| -> Result<bool, String> {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let roots = wb_core::runtime::initialize(exe.parent().ok_or("No installation directory")?.join("resources")).map_err(|e| e.to_string())?;
            if argv.first().map(String::as_str) == Some("license") {
                let license = wb_core::runtime::licensing();
                match argv.get(1).map(String::as_str) {
                    Some("status") if argv.len() == 2 => println!("{}", serde_json::to_string_pretty(&license.status()).unwrap()),
                    Some("request") if argv.len() == 2 => println!("{}", license.request()?),
                    Some("import") if argv.len() == 3 => {
                        use std::io::Read;
                        let mut bytes = vec![];
                        std::fs::File::open(&argv[2]).map_err(|e| e.to_string())?.take(32769).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
                        license.import(std::str::from_utf8(&bytes).map_err(|_| "Invalid license encoding")?)?;
                        println!("Pilot license activated. Offline use does not expire.");
                    }
                    Some("recovery") if argv.len() == 2 => println!("{}", serde_json::json!({"study_dir": roots.recovery_path().map_err(|e| e.to_string())?, "message":"Your study files remain readable without a license. Open this folder in your file manager to copy or back them up."})),
                    _ => return Err("Usage: wb license status | request | import <file> | recovery".into()),
                }
                return Ok(true);
            }
            if argv.first().map(String::as_str) == Some("setup") {
                match argv.get(1).map(String::as_str) {
                    None if argv.len() == 1 => println!("{}", serde_json::to_string_pretty(&roots.status()).unwrap()),
                    Some("new" | "open") if argv.len() == 3 => {
                        roots.configure(std::path::Path::new(&argv[2]), argv[1] == "new").map_err(|e| e.to_string())?;
                        println!("Study folder configured. Your existing files were preserved.");
                    }
                    _ => return Err("Usage: wb setup | wb setup new <absolute-folder> | wb setup open <absolute-folder>".into()),
                }
                return Ok(true);
            }
            let status = roots.status();
            if !status.ready { return Err(status.problem.unwrap_or_else(|| "Choose a study folder in the app, or run wb setup new/open <absolute-folder>.".into())); }
            Ok(false)
        })();
        match result { Ok(true) => return, Ok(false) => (), Err(e) => { eprintln!("error: {e}"); std::process::exit(1); } }
    }
    match run(&Ctx::new(), &argv) {
        Ok((Out::Nothing, _)) => {}
        Ok((Out::Text(t), false)) => println!("{t}"),
        Ok((Out::Text(t), true)) => println!("{}", serde_json::to_string_pretty(&Value::String(t)).unwrap()),
        Ok((Out::Json(v), _)) => println!("{}", serde_json::to_string_pretty(&v).unwrap()),
        Err(Fail::Usage(msg)) => {
            // as argparse does: the usage line, the error, exit code 2
            eprintln!("{msg}");
            std::process::exit(2);
        }
        Err(Fail::Error(e)) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
