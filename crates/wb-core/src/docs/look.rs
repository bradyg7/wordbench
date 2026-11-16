//! A document's Look (R3's second and third passes, docs/archive/2026-11-10/docs/redesign-R3.md, sheets D9–D15): a named set of a few dials'
//! values that style a Word document or a PDF deck. Five ship with the app; a person's own are files in
//! `settings/doc-looks/<key>.json` (the dials' values only). A Look is styling only: it is never in the plan, so it never
//! touches the fingerprint the Python app shares. A document's record keeps the values it was made with (`look_values`),
//! so Make again makes the same document even if the Look is changed later.

use crate::store::{bad, Store};
use crate::Result;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Look {
    /// The shown name.
    pub name: String,
    /// inter-literata (headings Inter, scripture Literata), literata (both Literata), inter (both Inter)
    pub typeface: String,
    /// The accent as hex (no #), or "" for the theme's own.
    pub accent: String,
    /// small, regular, large, largest
    pub size: String,
    /// compact, comfortable, airy
    pub spacing: String,
    /// left, center
    pub title: String,
    /// accent, plain (verse numbers)
    pub numbers: String,
    /// none, rule (under the title)
    pub under_title: String,
    /// letter, a4
    pub paper: String,
    /// full, saver, black
    pub ink: String,
    /// Slides: faint, hidden (the verses either side)
    pub neighbours: String,
    /// Slides: top, bottom (the reference)
    pub reference: String,
    /// The page around the text (D14)
    pub cover: bool,
    pub running_head: bool,
    /// of (Page x of y), plain (x), none
    pub page_numbers: String,
    /// 1 or 2 (2 only for scripture-only documents)
    pub columns: u8,
}

impl Default for Look {
    fn default() -> Self {
        Look {
            name: "Preview".into(),
            typeface: "inter-literata".into(),
            accent: String::new(),
            size: "regular".into(),
            spacing: "comfortable".into(),
            title: "left".into(),
            numbers: "accent".into(),
            under_title: "none".into(),
            paper: "letter".into(),
            ink: "full".into(),
            neighbours: "faint".into(),
            reference: "top".into(),
            cover: false,
            running_head: true,
            page_numbers: "of".into(),
            columns: 1,
        }
    }
}

const CHOICES: &[(&str, &[&str])] = &[
    ("typeface", &["inter-literata", "literata", "inter"]),
    ("size", &["small", "regular", "large", "largest"]),
    ("spacing", &["compact", "comfortable", "airy"]),
    ("title", &["left", "center"]),
    ("numbers", &["accent", "plain"]),
    ("under_title", &["none", "rule"]),
    ("paper", &["letter", "a4"]),
    ("ink", &["full", "saver", "black"]),
    ("neighbours", &["faint", "hidden"]),
    ("reference", &["top", "bottom"]),
    ("page_numbers", &["of", "plain", "none"]),
];

/// The six curated accents (D10).
pub const SWATCHES: &[(&str, &str)] =
    &[("red", "8E1B14"), ("brown", "5A3E1B"), ("blue", "1F4E79"), ("green", "2F5D3A"), ("plum", "5B3A6B"), ("graphite", "444444")];

/// The five shipped Looks (D9), in order.
pub fn shipped() -> Vec<(&'static str, Look)> {
    let d = Look::default();
    vec![
        ("preview", d.clone()),
        ("classic", Look { name: "Classic".into(), typeface: "literata".into(), accent: "5A3E1B".into(), title: "center".into(), under_title: "rule".into(), ..d.clone() }),
        ("ink-saver", Look { name: "Ink saver".into(), accent: "444444".into(), size: "small".into(), spacing: "compact".into(), numbers: "plain".into(), ink: "saver".into(), ..d.clone() }),
        ("large-print", Look { name: "Large print".into(), size: "largest".into(), spacing: "airy".into(), ..d.clone() }),
        ("modern", Look { name: "Modern".into(), typeface: "inter".into(), accent: "1F4E79".into(), ..d }),
    ]
}

fn folder(store: &Store) -> PathBuf {
    store.root.join("settings").join("doc-looks")
}

/// A Look's key from a name: lower case, words joined by hyphens.
pub fn key_of(name: &str) -> String {
    let k: String = name.trim().to_lowercase().chars().map(|c| if c.is_alphanumeric() { c } else { '-' }).collect();
    k.split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-")
}

/// Refuses a value that is not one of a dial's choices, and an accent that is not six hex digits.
pub fn check(l: &Look) -> Result<()> {
    let v = serde_json::to_value(l).unwrap();
    for (k, ok) in CHOICES {
        let got = v[k].as_str().unwrap_or("");
        if !ok.contains(&got) {
            return Err(bad(format!("{k}: one of {} (not “{got}”).", ok.join(", "))));
        }
    }
    if !l.accent.is_empty() && !(l.accent.len() == 6 && l.accent.chars().all(|c| c.is_ascii_hexdigit())) {
        return Err(bad("accent: six hex digits, such as 8E1B14, or a swatch: red, brown, blue, green, plum, graphite."));
    }
    if !matches!(l.columns, 1 | 2) {
        return Err(bad("columns: 1 or 2."));
    }
    Ok(())
}

/// A Look by key or name: a shipped one, or a person's own.
pub fn get(store: &Store, name: &str) -> Result<Look> {
    let key = key_of(name);
    if let Some((_, l)) = shipped().into_iter().find(|(k, _)| *k == key) {
        return Ok(l);
    }
    let path = folder(store).join(format!("{key}.json"));
    let text = fs::read_to_string(&path).map_err(|_| bad(format!("No Look called “{name}”. The Looks: {}.", keys(store).join(", "))))?;
    let l: Look = serde_json::from_str(&text).map_err(|e| bad(format!("{} cannot be read ({e}).", path.display())))?;
    check(&l)?;
    Ok(l)
}

fn keys(store: &Store) -> Vec<String> {
    let mut out: Vec<String> = shipped().iter().map(|(k, _)| k.to_string()).collect();
    if let Ok(rd) = fs::read_dir(folder(store)) {
        let mut own: Vec<String> = rd.flatten().filter_map(|e| e.file_name().to_string_lossy().strip_suffix(".json").map(String::from)).collect();
        own.sort();
        out.extend(own);
    }
    out
}

/// Every Look: key, name, whether it ships with the app, its values.
pub fn list(store: &Store) -> Value {
    let looks: Vec<Value> = keys(store)
        .iter()
        .filter_map(|k| get(store, k).ok().map(|l| json!({"key": k, "name": l.name, "shipped": shipped().iter().any(|(s, _)| s == k), "values": l})))
        .collect();
    json!({"looks": looks, "saved": saved(store), "swatches": SWATCHES.iter().map(|(n, h)| json!({"name": n, "hex": h})).collect::<Vec<_>>()})
}

/// The Look new documents use (settings/export.json's "look"), preview when none is set.
pub fn saved(store: &Store) -> String {
    let k = crate::store::s(&store.settings("export"), "look");
    if k.is_empty() { "preview".into() } else { k }
}

pub fn set_saved(store: &mut Store, name: &str) -> Result<Value> {
    get(store, name)?;
    let key = key_of(name);
    store.set_setting("export", "look", Some(json!(key)))?;
    Ok(json!({"look": key}))
}

/// A Look changed by dials: `from` (a Look's name) with each `dial=value` applied. A swatch name stands for its hex.
pub fn adjust(store: &Store, from: &str, dials: &[(String, String)]) -> Result<Look> {
    apply(get(store, from)?, dials)
}

/// A Look with each `dial=value` applied.
pub fn apply(l: Look, dials: &[(String, String)]) -> Result<Look> {
    let mut v = serde_json::to_value(l).unwrap();
    for (k, val) in dials {
        let k = k.replace('-', "_");
        let val = if k == "accent" { SWATCHES.iter().find(|(n, _)| *n == val.as_str()).map(|(_, h)| h.to_string()).unwrap_or_else(|| val.trim_start_matches('#').to_uppercase()) } else { val.clone() };
        match k.as_str() {
            "cover" | "running_head" => v[&k] = json!(matches!(val.as_str(), "on" | "true" | "yes")),
            "columns" => v[&k] = json!(val.parse::<u8>().map_err(|_| bad("columns: 1 or 2."))?),
            _ if v.get(&k).is_some() && k != "name" => v[&k] = json!(val),
            _ => return Err(bad(format!("No dial called “{k}”. The dials: typeface, accent, size, spacing, title, numbers, under-title, paper, ink, neighbours, reference, cover, running-head, page-numbers, columns."))),
        }
    }
    let l: Look = serde_json::from_value(v).map_err(|e| bad(e.to_string()))?;
    check(&l)?;
    Ok(l)
}

/// Saves a person's own Look. A shipped Look's name is refused (save under a new name).
pub fn save(store: &Store, name: &str, l: &Look) -> Result<Value> {
    crate::store::guard(&store.root)?;
    let key = key_of(name);
    if key.is_empty() {
        return Err(bad("A Look needs a name."));
    }
    if shipped().iter().any(|(k, _)| *k == key) {
        return Err(bad(format!("“{name}” ships with the app and is kept as it is; save under another name.")));
    }
    let mut l = l.clone();
    l.name = name.trim().to_string();
    check(&l)?;
    fs::create_dir_all(folder(store))?;
    fs::write(folder(store).join(format!("{key}.json")), serde_json::to_string_pretty(&l).unwrap())?;
    Ok(json!({"key": key, "name": l.name, "values": l}))
}

/// Deletes a person's own Look (to the study folder's .trash, as every delete).
pub fn delete(store: &Store, name: &str) -> Result<Value> {
    crate::store::guard(&store.root)?;
    let key = key_of(name);
    if shipped().iter().any(|(k, _)| *k == key) {
        return Err(bad(format!("“{name}” ships with the app and cannot be deleted.")));
    }
    let path = folder(store).join(format!("{key}.json"));
    if !path.is_file() {
        return Err(bad(format!("No Look of yours called “{name}”.")));
    }
    let trash = store.root.join(".trash");
    fs::create_dir_all(&trash)?;
    fs::rename(&path, trash.join(format!("doc-look-{key}.json")))?;
    Ok(json!({"deleted": key}))
}

// ---- what the dials mean, for the writers --------------------------------------------------------------------------------

impl Look {
    /// (headings font, scripture font)
    pub fn fonts(&self) -> (&'static str, &'static str) {
        match self.typeface.as_str() {
            "literata" => ("Literata", "Literata"),
            "inter" => ("Inter", "Inter"),
            _ => ("Inter", "Literata"),
        }
    }

    pub fn scale(&self) -> f64 {
        match self.size.as_str() {
            "small" => 0.92,
            "large" => 1.17,
            "largest" => 1.33,
            _ => 1.0,
        }
    }

    /// Spacing as a multiplier of the comfortable spacing.
    pub fn spacing_factor(&self) -> f64 {
        match self.spacing.as_str() {
            "compact" => 0.9,
            "airy" => 1.07,
            _ => 1.0,
        }
    }

    /// The accent for text on white: the Look's own (or the theme's), then made dark enough to read (D15), then the ink
    /// mode (saver: dark grey; black: black).
    pub fn text_accent(&self, theme_accent: &str) -> String {
        match self.ink.as_str() {
            "black" => "000000".into(),
            "saver" => "444444".into(),
            _ => readable(if self.accent.is_empty() { theme_accent } else { &self.accent }, "FFFFFF"),
        }
    }

    /// The accent for rules and fills: the person's own color, unless ink says otherwise.
    pub fn rule_accent(&self, theme_accent: &str) -> Option<String> {
        match self.ink.as_str() {
            "full" => Some(if self.accent.is_empty() { theme_accent.to_string() } else { self.accent.clone() }),
            _ => None,
        }
    }
}

fn channel(c: u8) -> f64 {
    let c = c as f64 / 255.0;
    if c <= 0.03928 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
}

fn rgb(hex: &str) -> (u8, u8, u8) {
    let p = |i: usize| u8::from_str_radix(hex.get(i..i + 2).unwrap_or("00"), 16).unwrap_or(0);
    (p(0), p(2), p(4))
}

fn luminance(hex: &str) -> f64 {
    let (r, g, b) = rgb(hex);
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/// WCAG contrast of two colors.
pub fn contrast(a: &str, b: &str) -> f64 {
    let (x, y) = (luminance(a), luminance(b));
    (x.max(y) + 0.05) / (x.min(y) + 0.05)
}

/// `hex`, darkened (or lightened, on dark paper) just enough for 4.5 : 1 against `paper` (D15).
pub fn readable(hex: &str, paper: &str) -> String {
    let (r, g, b) = rgb(hex);
    let dark_paper = luminance(paper) < 0.5;
    let mut f = 1.0;
    let mut out = hex.to_uppercase();
    while contrast(&out, paper) < 4.5 && f > 0.0 {
        f -= 0.05;
        let m = |c: u8| -> u8 { if dark_paper { (c as f64 + (255.0 - c as f64) * (1.0 - f)).round() as u8 } else { (c as f64 * f).round() as u8 } };
        out = format!("{:02X}{:02X}{:02X}", m(r), m(g), m(b));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shipped_looks_are_valid_and_a_light_accent_is_darkened_for_text() {
        for (_, l) in shipped() {
            check(&l).unwrap();
        }
        let gold = Look { accent: "F2C14E".into(), ..Look::default() };
        let t = gold.text_accent("8E1B14");
        assert!(contrast(&t, "FFFFFF") >= 4.5, "{t}");
        assert_eq!(gold.rule_accent("8E1B14").as_deref(), Some("F2C14E"));
        let saver = Look { ink: "saver".into(), ..gold };
        assert_eq!(saver.text_accent("8E1B14"), "444444");
        assert_eq!(saver.rule_accent("8E1B14"), None);
    }
}
