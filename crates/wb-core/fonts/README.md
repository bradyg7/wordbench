# Fonts for documents made in wb-core

The PDF verse deck (`src/docs/deck.rs`) is laid out by Typst with the fonts the window uses: **Literata** for scripture
and **Inter** for everything else. These are the WOFF 1.0 files of `@fontsource/literata` and `@fontsource/inter` (the
UI's own packages), the Latin and Latin Extended subsets only, copied here so that building `wb` does not need
`node_modules`. Both fonts are under the SIL Open Font License 1.1 (LICENSE-Literata.txt, LICENSE-Inter.txt).
