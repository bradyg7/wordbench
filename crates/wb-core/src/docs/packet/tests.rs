use super::*;

fn scratch() -> (tempfile::TempDir, Store, ExportFolders) {
    let root = tempfile::tempdir().unwrap();
    let study = root.path().join("study");
    fs::create_dir(&study).unwrap();
    let store = Store::open(&study).unwrap();
    let folders = ExportFolders {
        local: study.join("exports"),
        legacy: root.path().join("legacy"),
        override_dir: None,
    };
    fs::create_dir(&folders.local).unwrap();
    fs::create_dir(&folders.legacy).unwrap();
    (root, store, folders)
}

fn saved_pdf(path: &Path, width: i64, rotation: i64, labels: &[&str]) {
    let mut doc = Document::with_version("1.7");
    let parent = doc.new_object_id();
    let font = doc.add_object(
        dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Courier" },
    );
    let mut kids = Vec::new();
    // Assign page object IDs in the opposite order to the Kids array.
    for label in labels.iter().rev() {
        let content = format!("BT /F1 12 Tf 20 30 Td ({label}) Tj ET");
        let stream = doc.add_object(lopdf::Stream::new(dictionary! {}, content.into_bytes()));
        let page = doc
            .add_object(dictionary! { "Type" => "Page", "Parent" => parent, "Contents" => stream });
        kids.push(Object::Reference(page));
    }
    kids.reverse();
    doc.objects.insert(
        parent,
        dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => labels.len() as i64,
            "MediaBox" => vec![0.into(), 0.into(), width.into(), 500.into()],
            "Rotate" => rotation,
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => font } },
        }
        .into(),
    );
    let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => parent });
    doc.trailer.set("Root", catalog);
    doc.save(path).unwrap();
}

fn office(store: &Store, folders: &ExportFolders, companion: Option<&str>) {
    fs::create_dir_all(store.root.join("documents")).unwrap();
    fs::write(folders.local.join("Report.pptx"), b"saved original").unwrap();
    let record = json!({
        "id": "report",
        "name": "Report.pptx",
        "title": "Report",
        "source": {"kind": "page", "id": "existing-page"},
        "to": "deck",
        "pdf": companion,
        "export_location": "study",
    });
    fs::write(store.root.join("documents/report.json"), record.to_string()).unwrap();
}

fn names(names: &[&str]) -> Vec<String> {
    names.iter().map(|name| (*name).to_string()).collect()
}

#[test]
fn packet_preserves_input_page_order_and_inherited_properties() {
    let (_root, store, folders) = scratch();
    let chapter = folders.local.join("Chapter.pdf");
    let preview = folders.local.join("Report Preview.pdf");
    saved_pdf(&chapter, 200, 90, &["First page", "Second page"]);
    saved_pdf(&preview, 300, 0, &["Office page"]);
    office(&store, &folders, Some("Report Preview.pdf"));
    let before = [&chapter, &preview, &folders.local.join("Report.pptx")]
        .map(|file| (file.clone(), fs::read(file).unwrap()));

    let sources = names(&["document:report", "Chapt"]);
    let result = make(&store, &folders, &sources, Some("Reading packet.pdf")).unwrap();
    assert_eq!(result["pages"], 3);
    assert_eq!(result["name"], "Reading packet.pdf");
    let output = read_pdf(&folders.local.join("Reading packet.pdf")).unwrap();
    for ((page_number, id), (label, width, rotation)) in output.get_pages().into_iter().zip([
        ("Office page", 300, 0),
        ("First page", 200, 90),
        ("Second page", 200, 90),
    ]) {
        assert!(output.extract_text(&[page_number]).unwrap().contains(label));
        let page = output.get_dictionary(id).unwrap();
        let parent = page
            .get_deref(b"Parent", &output)
            .unwrap()
            .as_dict()
            .unwrap();
        assert_eq!(
            parent.get(b"MediaBox").unwrap().as_array().unwrap()[2]
                .as_i64()
                .unwrap(),
            width
        );
        assert_eq!(parent.get(b"Rotate").unwrap().as_i64().unwrap(), rotation);
        assert!(parent
            .get_deref(b"Resources", &output)
            .unwrap()
            .as_dict()
            .unwrap()
            .has(b"Font"));
    }
    for (file, bytes) in before {
        assert_eq!(fs::read(file).unwrap(), bytes);
    }

    let first = make(&store, &folders, &sources, None).unwrap();
    let second = make(&store, &folders, &sources, None).unwrap();
    assert_ne!(first["path"], second["path"]);
}

#[test]
fn packet_leaves_no_output_for_missing_corrupt_or_ambiguous_inputs() {
    let (_root, store, folders) = scratch();
    saved_pdf(&folders.local.join("Chapter.pdf"), 200, 0, &["Test page"]);
    saved_pdf(&folders.legacy.join("Chapter.pdf"), 200, 0, &["Duplicate"]);
    saved_pdf(&folders.local.join("Unique.pdf"), 200, 0, &["Valid"]);
    fs::write(folders.local.join("Broken.pdf"), b"%PDF-1.7\npartial").unwrap();
    office(&store, &folders, Some("Missing Preview.pdf"));

    for (input, error) in [
        ("Chapter", "More than one saved PDF"),
        ("Absent", "No saved PDF"),
        ("Uniqu.pdf", "No saved PDF"),
        ("Broken", "Invalid PDF"),
        ("document:report", "PDF companion"),
    ] {
        let result = make(
            &store,
            &folders,
            &names(&["Unique", input]),
            Some("Rejected.pdf"),
        );
        assert!(result.unwrap_err().0.contains(error), "{input}");
        assert!(!folders.local.join("Rejected.pdf").exists());
        assert!(!fs::read_dir(&folders.local).unwrap().any(|f| f
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".packet-")));
    }
}

#[test]
fn packet_rejects_bad_output_and_preserves_existing_files() {
    let (_root, store, folders) = scratch();
    let first = folders.local.join("First.pdf");
    saved_pdf(&first, 200, 0, &["Keep me"]);
    saved_pdf(&folders.local.join("Second.pdf"), 200, 0, &["Another"]);
    let before = fs::read(&first).unwrap();
    let inputs = names(&["First", "Second"]);

    for output in ["../Escaped.pdf", "Wrong.docx", "First.pdf"] {
        assert!(
            make(&store, &folders, &inputs, Some(output)).is_err(),
            "{output}"
        );
    }
    assert!(!folders.local.parent().unwrap().join("Escaped.pdf").exists());
    assert_eq!(fs::read(first).unwrap(), before);
}
