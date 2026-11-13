//! Ordered packets from saved PDFs and Office records with an existing PDF companion.

use super::{checked_name, find, pdfs, ExportFolders};
use crate::store::{bad, missing, s, Store};
use crate::Result;
use lopdf::{dictionary, Document, LoadOptions, Object, ObjectId, DEFAULT_MAX_DECOMPRESSED_SIZE};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

fn pdf_name(name: &str) -> Result<&str> {
    checked_name(name)?;
    if name
        .chars()
        .any(|c| c.is_control() || "<>\"|?*".contains(c))
        || !Path::new(name)
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
    {
        return Err(bad("Give a PDF filename without a path."));
    }
    Ok(name)
}

fn resolve_inputs(
    store: &Store,
    folders: &ExportFolders,
    names: &[String],
) -> Result<Vec<PathBuf>> {
    let files = pdfs::list(folders)?;
    names
        .iter()
        .map(|name| {
            let name = name.trim();
            let Some(office) = name.strip_prefix("document:") else {
                let exact = Path::new(name)
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"));
                return Ok(pdfs::find(&files, name, exact)?.path.clone());
            };
            let record = find(store, office)?;
            let title = s(&record, "name");
            if !matches!(s(&record, "to").as_str(), "word" | "deck") {
                return Err(bad(format!(
                    "“{title}” is not a saved Office document. Select its PDF by name."
                )));
            }
            let companion = record
                .get("pdf")
                .and_then(Value::as_str)
                .filter(|name| !name.is_empty())
                .ok_or_else(|| missing(format!("“{title}” has no saved PDF companion.")))?;
            let companion = pdf_name(companion)?;
            let folder = folders.resolve(&record)?.ok_or_else(|| {
                missing(format!("Could not locate the export folder for “{title}”."))
            })?;
            let path = folder.join(companion);
            match fs::symlink_metadata(&path) {
                Ok(metadata) if metadata.is_file() => Ok(path),
                Ok(_) => Err(bad(format!("“{companion}” is not a regular PDF file."))),
                Err(e) if e.kind() == ErrorKind::NotFound => Err(missing(format!(
                    "The PDF companion “{companion}” for “{title}” is missing."
                ))),
                Err(e) => Err(e.into()),
            }
        })
        .collect()
}

fn invalid_pdf(detail: impl std::fmt::Display) -> crate::Error {
    bad(format!("Invalid PDF: {detail}"))
}

fn read_pdf(path: &Path) -> Result<Document> {
    Document::load_with_options(
        path,
        LoadOptions {
            strict: true,
            ..LoadOptions::default()
        },
    )
    .map_err(invalid_pdf)
}

/// Check reachable object references before renumbering so missing references cannot bind to
/// an unrelated object from a different input.
fn check_references(doc: &Document, root: ObjectId) -> Result<()> {
    let mut seen = HashSet::from([root]);
    let mut pending = vec![doc.get_object(root).map_err(invalid_pdf)?];
    while let Some(object) = pending.pop() {
        match object {
            Object::Reference(id) if seen.insert(*id) => {
                pending.push(
                    doc.objects
                        .get(id)
                        .ok_or_else(|| invalid_pdf("missing referenced object"))?,
                );
            }
            Object::Array(objects) => pending.extend(objects),
            Object::Dictionary(dictionary) => {
                pending.extend(dictionary.iter().map(|(_, value)| value))
            }
            Object::Stream(stream) => pending.extend(stream.dict.iter().map(|(_, value)| value)),
            _ => {}
        }
    }
    Ok(())
}

fn check_contents(doc: &Document, page: ObjectId) -> Result<()> {
    let dictionary = doc.get_dictionary(page).map_err(invalid_pdf)?;
    if !dictionary.has(b"Contents") {
        return Ok(());
    }
    let contents = dictionary
        .get_deref(b"Contents", doc)
        .map_err(invalid_pdf)?;
    if matches!(contents, Object::Null) {
        return Ok(());
    }
    let streams = match contents {
        Object::Array(objects) => objects.as_slice(),
        stream => std::slice::from_ref(stream),
    };
    let mut remaining = DEFAULT_MAX_DECOMPRESSED_SIZE;
    for object in streams {
        let (_, object) = doc.dereference(object).map_err(invalid_pdf)?;
        let stream = object.as_stream().map_err(invalid_pdf)?;
        let length = if stream.dict.has(b"Filter") {
            stream
                .decompressed_content_with_limit(remaining)
                .map_err(invalid_pdf)?
                .len()
        } else {
            stream.content.len()
        };
        remaining = remaining
            .checked_sub(length)
            .ok_or_else(|| invalid_pdf("page content exceeds the parser limit"))?;
    }
    Ok(())
}

fn page_root(doc: &Document) -> Result<ObjectId> {
    doc.catalog()
        .and_then(|catalog| catalog.get(b"Pages"))
        .and_then(Object::as_reference)
        .map_err(invalid_pdf)
}

fn validate_pages(doc: &Document) -> Result<(ObjectId, usize)> {
    if doc.is_encrypted() {
        return Err(invalid_pdf(
            "encrypted PDFs cannot be read as saved packet pages",
        ));
    }
    let root = page_root(doc)?;
    check_references(doc, root)?;
    let tree = doc.get_dictionary(root).map_err(invalid_pdf)?;
    let declared = tree
        .get(b"Count")
        .and_then(Object::as_i64)
        .map_err(invalid_pdf)?;
    let pages = doc.get_pages();
    if pages.is_empty()
        || usize::try_from(declared).ok() != Some(pages.len())
        || pages.values().copied().collect::<HashSet<_>>().len() != pages.len()
    {
        return Err(invalid_pdf("missing or inconsistent page tree"));
    }
    for &page in pages.values() {
        check_contents(doc, page)?;
    }
    Ok((root, pages.len()))
}

fn merge(inputs: &[PathBuf]) -> Result<(Document, usize)> {
    // Keep each source page tree intact. Attaching its root to the new tree keeps
    // inherited page sizes, rotation, and resources with the pages that use them.
    let mut packet = Document::with_version("1.7");
    let root = packet.new_object_id();
    let mut kids = Vec::with_capacity(inputs.len());
    let mut pages = 0;
    for path in inputs {
        let (mut source, count) = read_pdf(path)
            .and_then(|doc| {
                let (_, count) = validate_pages(&doc)?;
                Ok((doc, count))
            })
            .map_err(|e| {
                bad(format!(
                    "Could not include “{}”. {}",
                    path.file_name().unwrap_or_default().to_string_lossy(),
                    e.0
                ))
            })?;
        if source.version.starts_with("2.") {
            packet.version = "2.0".into();
        }
        source.renumber_objects_with(packet.max_id + 1);
        let child = page_root(&source)?;
        source
            .get_dictionary_mut(child)
            .map_err(invalid_pdf)?
            .set("Parent", root);
        packet.max_id = source.max_id;
        packet.objects.append(&mut source.objects);
        kids.push(Object::Reference(child));
        pages += count;
    }
    packet.objects.insert(
        root,
        dictionary! { "Type" => "Pages", "Kids" => kids, "Count" => pages as i64 }.into(),
    );
    let catalog = packet.add_object(dictionary! { "Type" => "Catalog", "Pages" => root });
    packet.trailer.set("Root", catalog);
    packet.prune_objects();
    Ok((packet, pages))
}

fn publish(
    mut packet: Document,
    pages: usize,
    folder: &Path,
    output: Option<&str>,
) -> Result<(PathBuf, u64)> {
    fs::create_dir_all(folder)?;
    let mut temp = tempfile::Builder::new()
        .prefix(".packet-")
        .suffix(".part")
        .tempfile_in(folder)?;
    packet.save_to(temp.as_file_mut()).map_err(invalid_pdf)?;
    drop(packet);
    temp.as_file().sync_all()?;
    let size = temp.as_file().metadata()?.len();
    if validate_pages(&read_pdf(temp.path())?)?.1 != pages {
        return Err(invalid_pdf(
            "the finished packet has an unexpected page count",
        ));
    }

    let stem = format!(
        "Study packet - {}",
        chrono::Local::now().format("%Y-%m-%d %H%M")
    );
    let mut number = 1;
    loop {
        let name = match output {
            Some(name) => name.to_string(),
            None if number == 1 => format!("{stem}.pdf"),
            None => format!("{stem} ({number}).pdf"),
        };
        let destination = folder.join(name);
        match temp.persist_noclobber(&destination) {
            Ok(_) => return Ok((destination, size)),
            Err(e) if e.error.kind() == ErrorKind::AlreadyExists && output.is_none() => {
                temp = e.file;
                number += 1;
            }
            Err(e) if e.error.kind() == ErrorKind::AlreadyExists => {
                return Err(bad("A PDF already has that name. Choose a new filename."));
            }
            Err(e) => return Err(e.error.into()),
        }
    }
}

/// Create one PDF in the preferred export folder. A name prefixed with
/// `document:` selects the existing PDF companion of a saved Office record.
pub fn make(
    store: &Store,
    folders: &ExportFolders,
    names: &[String],
    output: Option<&str>,
) -> Result<Value> {
    crate::store::guard(&store.root)?;
    if !(2..=60).contains(&names.len()) {
        return Err(bad(
            "Choose between two and sixty saved PDFs for the packet.",
        ));
    }
    let output = output.map(pdf_name).transpose()?;
    let inputs = resolve_inputs(store, folders, names)?;
    let (packet, pages) = merge(&inputs)?;
    let (path, size) = publish(packet, pages, folders.preferred(), output)?;
    Ok(
        json!({"name": path.file_name().unwrap_or_default().to_string_lossy(), "size": size,
        "path": path, "pages": pages}),
    )
}

#[cfg(test)]
mod tests;
