# Coding standards

Builders read this before writing code, and reviewers check against it. A rule a machine checks names its check, with
the ticket of the turnaround's step 2 that switches the check on if it is not on yet. A rule nothing checks is a
judgment call, given one short example from this code. Words: [GLOSSARY.md](GLOSSARY.md#development-words).

**Sources:** clippy's default lints plus the stricter ones listed below; TypeScript's `strict` mode and
typescript-eslint's `strict-type-checked` set; Matt Pocock's guidance (deep modules, small interfaces, tests through the
public surface, no `any`). A rule is added or changed with the person's go-ahead, usually after a retro.

## Every change

- **No warnings.** A change leaves clippy and `tsc` with nothing to say. *Check: `cargo clippy -- -D warnings` (ticket 3).*
- **Formatted by the formatter.** *Check: `cargo fmt --check` (ticket 3, after one commit that only reformats).*
- **A comment says why, never what.** The code says what it does; a comment gives the reason a reader could not guess.
  Example: `// a saved choice under the temp folder is a test's scratch copy, so it is not guarded` (good), not
  `// loop over the folders` (says what).
- **No TODO, FIXME or XXX in merged code.** An open thought goes to [the parking lot](docs/turnaround-parked.md).
  *Check: grep in the quick checks (ticket 4).*
- **A checker is switched off only with a reason, written where it is switched off.** In Rust, `#[expect(lint, reason =
  "...")]`, which also fails once the switch is no longer needed; in TypeScript, `// @ts-expect-error <reason>` or
  `// eslint-disable-next-line <rule> -- <reason>`. Never `@ts-ignore`, `@ts-nocheck` or a whole-file switch. Each one is
  also listed in [Checker switches](#checker-switches) below. *Check: clippy's `allow_attributes` and
  `allow_attributes_without_reason` (ticket 3); the ratchet on switches (ticket 7).*
- **Tests never change committed files.** Pictures go to ignored scratch folders; committed screenshots change only
  through `npm run shots`. *Check: CI fails if a test run leaves a committed file changed (ticket 8).*
- **Builders never run a full suite on this PC.** Run the test being written or fixed and the quick checks for the area
  touched; CI runs the rest.
- **Never `git commit -a` in these clones.** Tests leave tracked files changed; add files by name.

## The AGENTS.md rules in code

- **Scripture is never typed.** A verse in code, a test or a fixture comes from the database or is generated from it.
  *Check: CI rebuilds every scripture fixture and fails on a difference (ticket 9).*
- **The real study folder is never opened by tests or tools.** wb-core refuses it unless `WB_ALLOW_REAL_STUDY=1` or the
  `installed` feature; nothing in the repo sets either. *Check: the guard's tests in `crates/wb-core/src/store.rs`.*
- **Every core action has a `wb` command**, and every `wb` command is run the window's way in
  `crates/wb-cli/tests/lent.rs` or excluded there with a reason. *Check: ticket 6 (lent.rs) and ticket 9 (the window's
  list against the `wb` table).*

## Shape (judgment, after Pocock)

- **Deep modules, small interfaces.** A module does a lot behind a few functions with few arguments. More than about five
  arguments means they belong together in one struct. Example: `accept_read` in
  `crates/wb-core/src/tether/accept.rs` takes one `Pick` (ids, all_named, expect, dry), not four loose arguments.
- **Tests go through the public surface**: the `wb` command, a wb-core function the app calls, or what the person sees
  in the window; not private helpers. A test that breaks when the inside is rearranged, with the behavior unchanged, is
  testing the wrong thing.
- **One word, one thing.** Names in code use the words of [the Library map](design/LIBRARY.md) and this glossary; a new
  word is added there first.
- **Messages are for the person.** An error the window shows says what happened and what to do, in plain words, never a
  Rust or JavaScript trace.

## Rust

- **clippy's default lints, plus these stricter ones** (switched on in `[workspace.lints]` in `Cargo.toml`, ticket 3):
  `allow_attributes`, `allow_attributes_without_reason`, `dbg_macro`, `todo`, `unimplemented`,
  `undocumented_unsafe_blocks`. Adding another is a normal edit to this list and to `Cargo.toml` together.
- **No `unwrap()` or `expect()` on anything that comes from the person, the disk or the network** outside tests; return
  an error with a message instead. `unwrap()` is fine where failure is impossible by construction, with a comment saying
  why. *Check: the `unwrap()` ratchet on non-test code (ticket 7).*
- **The Bible database is opened read-only**, through `bible` in wb-core, never another way.

## TypeScript

- **`strict` is on** in `ui/tsconfig.json` and stays on. *Check: `tsc -p ui` in the quick checks (ticket 4).*
- **No `any`.** A value whose shape is not known yet is `unknown` and is checked before use; a value from the app's
  commands gets a type that matches what wb-core returns. There are about 240 today, mostly in `panes.ts`, `actions.ts`,
  `notebook.ts` and `listview.ts`; the count only goes down. Example: `perform(a: any, line: string)` in
  `ui/src/actions.ts`. *Check: the `any` ratchet (ticket 7).*
- **typescript-eslint `strict-type-checked`** is the TypeScript checker, with no warnings allowed. Its `any` rules
  (`no-explicit-any`, `no-unsafe-*`) are counted by the `any` ratchet until the count reaches zero. *Check: `eslint` in
  the quick checks (installed and cleared in ticket 3).*

## Checker switches

Every checker switch in the code, with its reason. A new one adds a row; a removed one deletes its row. Last updated 2026-11-23 (step 2, ticket 3): nine, all of one kind. The other eight found on 2026-11-23 were removed in ticket 3.

| Where | Switch | Reason |
|---|---|---|
| `crates/wb-core/tests/*.rs`, the line before `mod common;` (9 files: `deletion`, `docs_sources`, `doc_plan_baseline`, `layout_shortcuts`, `marks_index`, `search_index`, `store_cache`, `study_projection`, `tether`) | `#[expect(dead_code, reason = "...")]` | Shared test helpers in `tests/common/mod.rs`: each test binary uses only some of them. `tests/study.rs` uses all of them, so it has no switch (an `expect` there would fail as unfulfilled). |
