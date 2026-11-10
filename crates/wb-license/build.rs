fn main() {
    println!("cargo:rerun-if-env-changed=WB_LICENSE_PUBLIC_KEY");
    println!("cargo:rerun-if-env-changed=WB_LICENSE_KEY_ID");
}
