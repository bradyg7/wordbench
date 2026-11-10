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
            ("What a view is", "A live list of Notebook pages and questions that match a query. On a page, use / → View to show the list as a block. Run the same query from the command field to open the list in the Notebook. Select a row to open its page. Running a View only reads study data."),
            ("The line", "notebook, then any of: @place (a verse, a chapter, a book, or H7065: the notes on any verse in it, in Bible order), questions (or open, or answered), thread <name> (a name of more words in quotes), days N (written in the last N days), pages (the notes with no place), and any other words, each of which must be in the note."),
            ("Command field examples", "notebook @Num 25 questions · notebook thread phinehas · notebook days 7 · notebook pages zeal · notebook @Numbers answered"),
            ("Changing the line", "Click the line above the list and write it anew; Enter keeps it. The file holds only the line, in a ```view block."),
            ("From a terminal", "wb view run \"notebook @Num 25 questions\" returns the same rows."),
            ("Views and Layouts", "A View lists the pages and questions that match a query. A Layout saves an arrangement of panes. For pane arrangements, see Layout in the toolbar or type help layout in the command field."),
        ],
    ),
    (
        "threads",
        "Threads",
        &[
            ("A thread is a page", "A thread opens as a page in the Notebook, in Pages with its color's dot. Its note is the page's text, written in blocks like any page. Under it are its places, in the thread's own order, and the pages written on it, and at its foot the documents made from it."),
            ("Its places", "Drag a place by its grip to put it in order, × takes it out, + Place adds the place you are at, and the filter narrows a long list. Put it in Bible order sorts them. The color is the underline the reader draws for it; the eye hides it."),
            ("Pages on a thread", "A page can be on several threads and shows under each. Write one under the thread's page, or drop a page onto a thread in Pages, or use + Thread on the page."),
            ("A thread inside a page", "/ → Thread puts a thread's places inside another page, kept up to date, so a lesson can hold a thread without copying it. The file holds only the thread's id."),
            ("Where it lives", "The thread file, threads/<name>.md, exactly as the Python app keeps it: name, color, note, places. Pinned is in settings/pages.json, which the Python app passes over."),
            ("From a terminal", "wb thread page Phinehas · wb thread pin Phinehas · wb page threads <page id> · wb block thread <page id> 3 Phinehas · wb thread add|rm|order|sort as before."),
        ],
    ),
    (
        "questions",
        "Questions",
        &[
            ("Two ways, one list", "A question at a verse (Ctrl+J, the pen's ?) is kept where it always was and the Python app's Trails shows it. A question written in a page (/ → Question, or /?) is a line of that page. Questions lists both, open first, and the reader's ? on a verse number and the verse's card read both."),
            ("Answering", "Mark answered on a question block ticks it; Open it again takes the tick off."),
            ("In the file", "A question in a page is a callout: > [!question] your words, and > [!done] your words when answered. Obsidian draws both as callouts."),
            ("A question's place", "A question written in a page takes the page's places. A question in a page with no place has no verse, like a question in the Inbox."),
            ("Moving one", "wb question fold <trail> <page> --also writes a question at a verse into a page; wb question unfold <page>#<block> gives it its own place again."),
            ("From a terminal", "wb question list [--at \"Num 25:9\"] · wb question add <page id> \"text\" · wb question answer <page id>#<block>."),
        ],
    ),
    (
        "words",
        "Word blocks",
        &[
            ("What a word block is", "/ → Word draws the lexicon's entry for a Strong's number inside a page: the word, its sound, Strong's own words, the KJV's renderings and how often. The file holds only the number, in a ```word block; the entry is never copied into it."),
            ("A word study", "A word study is a page placed at the number (+ Place → H7065) with a word block at its top. Your own writing goes under it."),
            ("The English definition", "Held for the source you choose; its slot is drawn empty."),
            ("From a terminal", "wb page words <page id> · wb block word <page id> 2 H7065."),
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
