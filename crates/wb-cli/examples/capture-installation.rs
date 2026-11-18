//! Local recording adapter for the actual distribution bootstrap and license code.
//! Never bundled. The caller supplies isolated resources and LOCALAPPDATA.
#[cfg(not(feature = "distribution"))]
fn main() { eprintln!("Use --features distribution for the isolated installation recording adapter."); std::process::exit(1); }

#[cfg(feature = "distribution")]
fn main() {
    use std::io::Read;
    let result = (|| -> Result<serde_json::Value, String> {
        let mut input = String::new();
        std::io::stdin().take(65536).read_to_string(&mut input).map_err(|e| e.to_string())?;
        let a: serde_json::Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
        let resource = std::env::var("WB_DEMO_RESOURCES").map_err(|_| "Isolated demo resources are required")?;
        if !resource.contains("release-staging") { return Err("Recording resources must stay in release-staging".into()); }
        let roots = wb_core::runtime::initialize(resource.into()).map_err(|e| e.to_string())?;
        match a["command"].as_str().unwrap_or("") {
            "installation_status" => serde_json::to_value(roots.status()).map_err(|e| e.to_string()),
            "installation_configure" => {
                let path = a["args"]["path"].as_str().ok_or("Missing demo path")?;
                if !path.contains("release-staging") { return Err("Recording study must stay in release-staging".into()); }
                roots.configure(std::path::Path::new(path), a["args"]["create"].as_bool().unwrap_or(false)).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({"saved":true}))
            },
            "pilot_license" => {
                let license = wb_core::runtime::licensing();
                match a["args"]["action"].as_str().unwrap_or("") {
                    "status" => serde_json::to_value(license.status()).map_err(|e| e.to_string()),
                    "request" => Ok(serde_json::json!({"request":license.request()?})),
                    "import" => { license.import(a["args"]["certificate"].as_str().ok_or("Missing certificate")?)?; Ok(serde_json::json!({"active":true})) },
                    _ => Err("Unknown license action".into()),
                }
            },
            _ => Err("Unsupported recording operation".into()),
        }
    })();
    match result { Ok(value) => println!("{value}"), Err(error) => {eprintln!("{error}");std::process::exit(1);} }
}
