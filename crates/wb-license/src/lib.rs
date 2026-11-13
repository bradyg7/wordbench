//! Manual pilot certificates. No clock, network, expiry, or issuer private key in the client.
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}};
use zeroize::Zeroizing;

pub const PRODUCT: &str = "app.bibleworkbench.desktop";
const LIMIT: u64 = 32768;
type Result<T> = std::result::Result<T, String>;

#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Envelope { pub payload: String, pub signature: String }

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Certificate {
    pub schema_version: u32,
    pub product_id: String,
    pub issuer_key_id: String,
    pub license_id: String,
    pub activation_id: String,
    pub device_public_key: String,
    pub issued_at: String,
    pub offline_use: String,
    pub features: Vec<String>,
}

#[derive(Serialize)]
struct Request<'a> { schema_version: u32, product_id: &'a str, device_public_key: String, purpose: &'a str }

#[derive(Serialize)]
pub struct Status { pub active: bool, pub license_id: Option<String>, pub problem: Option<String> }

pub fn hex(bytes: &[u8]) -> String { bytes.iter().map(|b| format!("{b:02x}")).collect() }
fn public_key(value: &str) -> Result<VerifyingKey> {
    if value.len() != 64 || !value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) { return Err("Invalid public key.".into()); }
    let mut bytes = [0; 32];
    for (i, byte) in bytes.iter_mut().enumerate() { *byte = u8::from_str_radix(&value[i*2..i*2+2], 16).map_err(|_| "Invalid public key.")?; }
    let key = VerifyingKey::from_bytes(&bytes).map_err(|_| "Invalid public key.")?;
    if key.is_weak() { return Err("Weak public key rejected.".into()); }
    Ok(key)
}

pub fn verify(text: &str, trusted_key: &str, key_id: &str, device: &str) -> Result<Certificate> {
    if text.len() > LIMIT as usize { return Err("License file is too large.".into()); }
    let envelope: Envelope = serde_json::from_str(text).map_err(|_| "Invalid license envelope.")?;
    let payload = STANDARD.decode(&envelope.payload).map_err(|_| "Invalid license payload.")?;
    let sig_bytes = STANDARD.decode(&envelope.signature).map_err(|_| "Invalid license signature.")?;
    let signature = Signature::from_slice(&sig_bytes).map_err(|_| "Invalid license signature.")?;
    public_key(trusted_key)?.verify_strict(&payload, &signature).map_err(|_| "License signature did not verify.")?;
    let cert: Certificate = serde_json::from_slice(&payload).map_err(|_| "Unsupported license fields.")?;
    if cert.schema_version != 1 || cert.product_id != PRODUCT || cert.issuer_key_id != key_id || cert.offline_use != "permanent" || cert.features != ["pilot"] {
        return Err("This license does not authorize the pilot product.".into());
    }
    if cert.device_public_key != device { return Err("This license belongs to a different device or Windows account.".into()); }
    for value in [&cert.license_id, &cert.activation_id, &cert.issued_at] {
        if value.is_empty() || value.len() > 128 || value.chars().any(char::is_control) { return Err("Invalid license identifier or issuance date.".into()); }
    }
    Ok(cert)
}

fn read_bounded(path: &Path) -> Result<Vec<u8>> {
    let mut bytes = vec![];
    fs::File::open(path).map_err(|_| "License or device key is missing. Request activation or contact the pilot issuer.")?
        .take(LIMIT + 1).read_to_end(&mut bytes).map_err(|_| "Could not read licensing file.")?;
    if bytes.len() > LIMIT as usize { return Err("Licensing file is too large.".into()); }
    Ok(bytes)
}

pub fn trusted_issuer() -> Result<(&'static str, &'static str)> {
    let key = option_env!("WB_LICENSE_PUBLIC_KEY").filter(|s| !s.is_empty()).ok_or("This build has no configured pilot issuer.")?;
    let id = option_env!("WB_LICENSE_KEY_ID").filter(|s| !s.is_empty()).ok_or("This build has no issuer key identifier.")?;
    public_key(key)?;
    Ok((key, id))
}

pub struct LocalLicense { dir: PathBuf }
impl LocalLicense {
    pub fn new(dir: PathBuf) -> Self { Self { dir } }
    fn device(&self, create: bool) -> Result<SigningKey> {
        let path = self.dir.join("device.dpapi");
        if create && !path.exists() {
            fs::create_dir_all(&self.dir).map_err(|_| "Could not create activation storage.")?;
            let mut seed = Zeroizing::new([0u8; 32]);
            getrandom::fill(seed.as_mut()).map_err(|_| "Secure random generation failed.")?;
            let protected = protect(seed.as_ref(), false)?;
            // Publish only complete protected bytes, without replacing an existing identity.
            let temp = self.dir.join(format!("device-{}.tmp", hex(&SigningKey::from_bytes(&seed).verifying_key().to_bytes())));
            let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|_| "Could not stage device identity.")?;
            file.write_all(&protected).and_then(|_| file.sync_all()).map_err(|_| "Could not store device identity.")?;
            drop(file);
            let result = fs::hard_link(&temp, &path);
            let _ = fs::remove_file(&temp);
            if let Err(e) = result { if e.kind() != std::io::ErrorKind::AlreadyExists { return Err("Could not save device identity.".into()); } }
        }
        let plaintext = Zeroizing::new(protect(&read_bounded(&path)?, true)?);
        let seed: &[u8; 32] = plaintext.as_slice().try_into().map_err(|_| "Invalid device identity; contact the pilot issuer.")?;
        Ok(SigningKey::from_bytes(seed))
    }

    pub fn request(&self) -> Result<String> {
        let key = self.device(true)?;
        let request = Request { schema_version: 1, product_id: PRODUCT, device_public_key: hex(&key.verifying_key().to_bytes()), purpose: "pilot-activation" };
        let payload = serde_json::to_vec(&request).map_err(|_| "Could not prepare request.")?;
        serde_json::to_string(&Envelope { signature: STANDARD.encode(key.sign(&payload).to_bytes()), payload: STANDARD.encode(payload) }).map_err(|_| "Could not encode request.".into())
    }

    pub fn active(&self) -> Result<Certificate> {
        let (trusted, id) = trusted_issuer()?;
        self.active_with(trusted, id)
    }

    fn active_with(&self, trusted: &str, id: &str) -> Result<Certificate> {
        let device = hex(&self.device(false)?.verifying_key().to_bytes());
        let bytes = read_bounded(&self.dir.join("license.json"))?;
        verify(std::str::from_utf8(&bytes).map_err(|_| "Invalid license encoding.")?, trusted, id, &device)
    }

    pub fn status(&self) -> Status {
        match self.active() {
            Ok(c) => Status { active: true, license_id: Some(c.license_id), problem: None },
            Err(e) => Status { active: false, license_id: None, problem: Some(e) },
        }
    }

    pub fn import(&self, text: &str) -> Result<()> {
        let (trusted, id) = trusted_issuer()?;
        self.import_with(text, trusted, id)
    }

    fn import_with(&self, text: &str, trusted: &str, id: &str) -> Result<()> {
        verify(text, trusted, id, &hex(&self.device(false)?.verifying_key().to_bytes()))?;
        // License is public signed data. Never write any study file or an issuer secret here.
        let temp = self.dir.join(format!("license-{}.tmp", std::process::id()));
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|_| "Another license import is pending.")?;
        let result = file.write_all(text.as_bytes()).and_then(|_| file.sync_all());
        drop(file);
        if result.is_err() { let _ = fs::remove_file(&temp); return Err("Could not save the license.".into()); }
        let result = fs::rename(&temp, self.dir.join("license.json"));
        if result.is_err() { let _ = fs::remove_file(&temp); return Err("Could not replace the license.".into()); }
        Ok(())
    }
}

#[cfg(windows)]
fn protect(bytes: &[u8], decrypt: bool) -> Result<Vec<u8>> {
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN}};
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len().try_into().map_err(|_| "Device identity too large.")?, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    // Current-user scope; never CRYPTPROTECT_LOCAL_MACHINE. UI is forbidden in unattended CLI calls.
    unsafe {
        let ok = if decrypt { CryptUnprotectData(&input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
        else { CryptProtectData(&input, std::ptr::null(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) };
        if ok == 0 { return Err("Windows could not unlock/store this device identity. Contact the pilot issuer for recovery.".into()); }
        if output.pbData.is_null() || output.cbData == 0 {
            if !output.pbData.is_null() { LocalFree(output.pbData as _); }
            return Err("Windows returned an empty device identity.".into());
        }
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        if decrypt { std::ptr::write_bytes(output.pbData, 0, output.cbData as usize); }
        LocalFree(output.pbData as _);
        Ok(result)
    }
}

#[cfg(not(windows))]
fn protect(_: &[u8], _: bool) -> Result<Vec<u8>> { Err("The pilot device store currently supports Windows only.".into()) }

#[cfg(test)]
mod tests {
    use super::*;
    fn certificate() -> Certificate {
        Certificate { schema_version: 1, product_id: PRODUCT.into(), issuer_key_id: "test".into(), license_id: "test-license".into(), activation_id: "test-activation".into(), device_public_key: hex(&SigningKey::from_bytes(&[9;32]).verifying_key().to_bytes()), issued_at: "2000-01-01T00:00:00Z".into(), offline_use: "permanent".into(), features: vec!["pilot".into()] }
    }
    fn signed(c: &Certificate, key: &SigningKey) -> String {
        let payload = serde_json::to_vec(c).unwrap();
        serde_json::to_string(&Envelope { signature: STANDARD.encode(key.sign(&payload).to_bytes()), payload: STANDARD.encode(payload) }).unwrap()
    }
    #[test]
    fn accepts_old_non_expiring_certificate_without_clock_or_network() {
        let key = SigningKey::from_bytes(&[7;32]); let c = certificate();
        assert_eq!(verify(&signed(&c, &key), &hex(&key.verifying_key().to_bytes()), "test", &c.device_public_key).unwrap(), c);
    }
    #[test]
    fn rejects_tampering_wrong_issuer_device_product_and_policy() {
        let key = SigningKey::from_bytes(&[7;32]); let trusted = hex(&key.verifying_key().to_bytes()); let c = certificate();
        assert!(verify(&signed(&c,&key), &trusted, "other", &c.device_public_key).is_err());
        assert!(verify(&signed(&c,&key), &trusted, "test", "another-device").is_err());
        assert!(verify(&signed(&c,&SigningKey::from_bytes(&[8;32])), &trusted, "test", &c.device_public_key).is_err());
        let mut envelope: Envelope = serde_json::from_str(&signed(&c,&key)).unwrap();
        envelope.payload = STANDARD.encode(b"tampered");
        assert!(verify(&serde_json::to_string(&envelope).unwrap(), &trusted,"test",&c.device_public_key).is_err());
        for change in [0,1,2] {
            let mut bad = certificate();
            match change { 0 => bad.product_id = "other".into(), 1 => bad.offline_use = "expires".into(), _ => bad.features = vec![] }
            assert!(verify(&signed(&bad,&key), &trusted,"test",&c.device_public_key).is_err());
        }
    }
    #[test]
    fn rejects_oversized_and_malformed_input() {
        let c = certificate(); let key = SigningKey::from_bytes(&[7;32]); let trusted = hex(&key.verifying_key().to_bytes());
        for text in ["{}".to_string(), "x".repeat(32769), "{\"payload\":\"!\",\"signature\":\"!\"}".into()] { assert!(verify(&text,&trusted,"test",&c.device_public_key).is_err()); }
    }
    #[test]
    #[cfg(windows)]
    fn windows_identity_is_protected_stable_and_corruption_fails_closed() {
        let dir = std::env::temp_dir().join(format!("wb-license-test-{}", std::process::id()));
        fs::create_dir(&dir).unwrap();
        let local = LocalLicense::new(dir.clone());
        let first = local.request().unwrap(); assert_eq!(first, local.request().unwrap());
        let issuer = SigningKey::from_bytes(&[7;32]);
        let trusted = hex(&issuer.verifying_key().to_bytes());
        let mut c = certificate();
        c.device_public_key = hex(&local.device(false).unwrap().verifying_key().to_bytes());
        let valid = signed(&c,&issuer);
        local.import_with(&valid,&trusted,"test").unwrap();
        assert_eq!(local.active_with(&trusted,"test").unwrap(), c);
        assert!(local.import_with("invalid",&trusted,"test").is_err());
        assert_eq!(fs::read_to_string(dir.join("license.json")).unwrap(), valid);
        local.import_with(&valid,&trusted,"test").unwrap();
        let protected = fs::read(dir.join("device.dpapi")).unwrap(); assert_ne!(protected.len(),32);
        fs::write(dir.join("device.dpapi"),b"damaged").unwrap();
        assert!(local.request().is_err());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn verifies_certificate_produced_by_node_issuer() {
        let vector: serde_json::Value = serde_json::from_str(include_str!("../tests/fixtures/node-certificate.json")).unwrap();
        let text = serde_json::to_string(&vector["envelope"]).unwrap();
        let cert = verify(&text, vector["trusted_key"].as_str().unwrap(), "interop-test", vector["device_key"].as_str().unwrap()).unwrap();
        assert_eq!(cert.license_id,"interop-pilot");
    }
}
