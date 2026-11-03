//! `wb`: the command line over wb-cli's command table (src/lib.rs). The window runs the same table in-process.

use serde_json::Value;
use wb_cli::{run, Ctx, Fail, Out};

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
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
