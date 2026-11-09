//! Help's Guide (W5, sheet W6.3): how the parts of the Notebook work, in plain words, one entry per part. The text lives
//! here so the window's Help and `wb guide` say the same.

use serde_json::{json, Value};

/// Each entry: its name (what is typed: `wb guide templates`), its title, and its parts (a heading and a paragraph).
const ENTRIES: &[(&str, &str, &[(&str, &str)])] = &[
    (
        "templates",
        "Templates",
        &[
            ("What a template is", "A page under Templates. New page → From a template copies its blocks into a new page and fills its blanks."),
            ("Making one", "+ beside Templates starts an empty one. On any page, … → Save as a template copies it, with its places taken out: each scripture block's reference and each view's @place become {place}."),
            ("The blanks", "{place} the place picked · {date} the day it is made · {title} the new page's name · {reader} the chapter in the reader. Type { in a template to add one."),
            ("Changing one", "Open it under Templates and edit it like a page. Its settings, above its blocks, set the name new pages get, whether it asks for a place, and where they go. Pages made before keep their own blocks."),
            ("Where it lives", "An ordinary note in the study folder, with template: true in its front matter, so the Python app and Obsidian open it as a note. The Notebook leaves templates out of Pages, Places and search, and lists them under Templates. A page made from one carries from_template: that is how \"used N times\" is counted."),
            ("From a terminal", "wb template list · wb template show \"Chapter study\" · wb page new --template \"Chapter study\" --place \"Num 25\" · wb template new \"Word study\" · wb template set \"Word study\" --asks place · wb template save <page id>"),
        ],
    ),
    (
        "shelf",
        "The Shelf",
        &[
            ("What it is", "A tree of folders, like a file list. A folder holds anything you want to open together: tabs you kept (Strong's, every use, a search, the interlinear), places, pages, threads, lessons, documents, and other folders. An item is a pointer: taking it out of a folder (×, or Del) never deletes the thing, and one page can sit in several folders."),
            ("Open all", "Select a folder, then Open all (or double-click it, or Enter): each item opens where its kind goes, as tabs beside the Shelf. A place opens as a second reader, so the reader stays where it is; a document opens in its preview; a page in the Notebook (with several pages, the first). The tabs carry the folder's coloured mark. Close all closes the tabs it opened; right-click a marked tab for the same."),
            ("Arranging", "+ at the top makes a folder; … on a folder has New folder inside, Rename (F2), Move to… and Remove the folder. Drag a folder onto another to put it inside, or onto a folder's top edge to put it before. Drag an item onto a folder to move it there (hold Ctrl to keep it in both), or onto another item to put it before or after."),
            ("Adding", "Add on a folder: a tab that is open, all open tabs, a new page, or a page, place, thread, lesson or document by name."),
            ("Where it lives", "Each folder is a set in the study folder's sets/, in the Python app's format, so the Python app lists every folder as a set with the same items. Which folder is inside which is kept apart, in settings/shelf.json. A document kept in a folder is new to the Python app: it does not list it, and drops it if it changes that set."),
            ("From a terminal", "wb shelf · wb shelf new \"Word study\" --in \"Phinehas study\" · wb shelf move \"Word study\" --in Romans · wb shelf item \"Phinehas study\" <key> --to \"Word study\" [--copy] · wb shelf rm \"Word study\" · wb set open \"Phinehas study\" (what Open all opens) · wb do \"set open Phinehas study\" (opens it in the window) · wb set add \"Word study\" --document \"Speaker Script\""),
        ],
    ),
    (
        "views",
        "Views",
        &[
            ("What a view is", "A list kept up to date, inside a page: / → View. It holds one line of the command language, and lists the notes the line finds each time the page is drawn. A click on a row opens its note. Views read; they never write."),
            ("The line", "notebook, then any of: @place (a verse, a chapter, a book, or H7065: the notes on any verse in it, in Bible order), questions (or open, or answered), thread <name> (a name of more words in quotes), days N (written in the last N days), pages (the notes with no place), and any other words, each of which must be in the note."),
            ("Examples", "notebook @Num 25 questions · notebook thread phinehas · notebook days 7 · notebook pages zeal · notebook @Numbers answered"),
            ("Changing the line", "Click the line above the list and write it anew; Enter keeps it. The file holds only the line, in a ```view block."),
            ("The same everywhere", "The command field lists the same notes for the same line (notebook @Num 25 questions), and so does wb view run \"notebook @Num 25 questions\" in a terminal."),
        ],
    ),
];

fn entry((name, title, parts): &(&str, &str, &[(&str, &str)])) -> Value {
    json!({"name": name, "title": title, "parts": parts.iter().map(|(h, t)| json!({"head": h, "text": t})).collect::<Vec<_>>()})
}

/// Every entry of the Guide.
pub fn guide() -> Value {
    json!({"entries": ENTRIES.iter().map(entry).collect::<Vec<_>>()})
}

/// One entry, by its name or title (any case), or the one whose name starts with what is typed.
pub fn guide_entry(topic: &str) -> Option<Value> {
    let t = topic.trim().to_lowercase();
    if t.is_empty() {
        return None;
    }
    let exact = ENTRIES.iter().find(|e| e.0 == t || e.1.to_lowercase() == t || format!("{}s", e.0.trim_end_matches('s')) == format!("{}s", t.trim_end_matches('s')));
    exact.or_else(|| {
        let hits: Vec<_> = ENTRIES.iter().filter(|e| e.0.starts_with(&t)).collect();
        (hits.len() == 1).then(|| hits[0])
    })
    .map(entry)
}

/// An entry as plain text, for a terminal.
pub fn guide_text(e: &Value) -> String {
    let mut out = vec![e["title"].as_str().unwrap_or("").to_string()];
    for p in e["parts"].as_array().into_iter().flatten() {
        out.push(String::new());
        out.push(p["head"].as_str().unwrap_or("").to_string());
        out.push(format!("  {}", p["text"].as_str().unwrap_or("")));
    }
    out.join("\n")
}
