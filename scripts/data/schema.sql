CREATE TABLE books (
    id INTEGER PRIMARY KEY,          -- canonical order, 1..66
    code TEXT NOT NULL UNIQUE,       -- USFM id, e.g. GEN
    name TEXT NOT NULL,
    testament TEXT NOT NULL,         -- OT | NT
    chapters INTEGER NOT NULL
);
CREATE TABLE chapter_titles (
    book INTEGER NOT NULL, chapter INTEGER NOT NULL, title TEXT NOT NULL,
    PRIMARY KEY (book, chapter)
);
CREATE TABLE verses (
    book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (book, chapter, verse)
);
-- One row per displayed KJV word. idx is 0-based within the verse and is the anchor coordinate.
-- grp > 0 groups the words of one Strong's-tagged unit (e.g. "Holy Ghost"); 0 means untagged.
CREATE TABLE words (
    book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, idx INTEGER NOT NULL,
    lead TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, trail TEXT NOT NULL DEFAULT '',
    strong TEXT, grp INTEGER NOT NULL DEFAULT 0,
    italic INTEGER NOT NULL DEFAULT 0,   -- translators' supplied word
    nd INTEGER NOT NULL DEFAULT 0,       -- divine name (LORD)
    wj INTEGER NOT NULL DEFAULT 0,       -- words of Jesus
    para TEXT NOT NULL DEFAULT '',       -- line/paragraph break before this word: p | q1 | q2 | b
    PRIMARY KEY (book, chapter, verse, idx)
);
CREATE INDEX words_strong ON words (strong);
CREATE INDEX words_text ON words (text COLLATE NOCASE);
CREATE TABLE footnotes (
    book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    after_idx INTEGER NOT NULL, text TEXT NOT NULL
);
CREATE INDEX footnotes_verse ON footnotes (book, chapter, verse);
-- Other translations are verse text only (word-level anchors and Strong's tags belong to the KJV).
CREATE TABLE versions (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, license TEXT NOT NULL,
    words INTEGER NOT NULL DEFAULT 0     -- 1 when the version has word-level data (the KJV)
);
CREATE TABLE verse_texts (
    version TEXT NOT NULL, book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL,
    PRIMARY KEY (version, book, chapter, verse)
);
-- Text fields hold [[H123]] / [[G123]] tokens where the source cross-references another entry.
CREATE TABLE lexicon (
    strong TEXT PRIMARY KEY,         -- H1..H8674, G1..G5624
    lang TEXT NOT NULL,              -- heb | arc | grk | other
    lemma TEXT NOT NULL, translit TEXT, pron TEXT, pos TEXT,
    derivation TEXT, definition TEXT, usage TEXT, extra TEXT
);
-- The original-language text word by word, for the interlinear view. Greek is the Textus Receptus (the text behind the KJV),
-- Hebrew the Leningrad Codex with the Qere read. verse numbers follow the KJV; seq is the word's order in the verse.
CREATE TABLE interlinear (
    book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, seq INTEGER NOT NULL,
    lang TEXT NOT NULL,              -- grk | heb
    original TEXT NOT NULL,          -- the word as written (Greek accented; Hebrew pointed, prefixes joined)
    translit TEXT NOT NULL DEFAULT '',
    strong TEXT,                     -- the word's main Strong's number (G26, H7225); a multi-word Greek variant gives its first
    strongs TEXT NOT NULL DEFAULT '',-- every Strong's number in the word, space separated
    morph TEXT NOT NULL DEFAULT '',  -- Robinson-style Greek code (N-NSF), or the Hebrew code (HR/Ncfsa); parts joined by + or /
    lemma TEXT NOT NULL DEFAULT '',
    gloss TEXT NOT NULL DEFAULT '',  -- the English under the word, in context
    PRIMARY KEY (book, chapter, verse, seq)
);
-- Plain-language expansions of the morphology codes (STEP Bible TEGMC / TEHMC).
CREATE TABLE morph_codes (code TEXT PRIMARY KEY, meaning TEXT NOT NULL);
-- Brown-Driver-Briggs entries for a Hebrew/Aramaic Strong's number (one number can have several entries).
CREATE TABLE bdb (
    strong TEXT NOT NULL, seq INTEGER NOT NULL, entry_id TEXT NOT NULL, headword TEXT NOT NULL, text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '',   -- the source file's own status: done | ref | base (base = only an outline)
    PRIMARY KEY (strong, seq)
);
