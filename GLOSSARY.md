# Glossary

**The app's words** (pages, folders, marks, the Notebook and the rest) are in [`design/LIBRARY.md`](design/LIBRARY.md)
until step 3 of the turnaround moves them here. A new app word changes that map first, with the person's go-ahead. See
[docs/agents/domain.md](docs/agents/domain.md).

## Development words

The words used about how the app is built and checked, in plain English. [CODING_STANDARDS.md](CODING_STANDARDS.md) and
[DESIGN_STANDARDS.md](DESIGN_STANDARDS.md) use them.

| Word | What it means here |
|---|---|
| **CI** | Continuous integration: GitHub's own computers run the checks and tests on every push, so nobody waits for them on this PC. A change reaches `main` only when they pass ("green"). |
| **Quick checks** | The CI checks that take about 3 minutes: formatting, clippy, the TypeScript compiler and the search for TODO notes. They run on every branch push. |
| **Full suite** | Every test: `cargo test`, the UI unit tests, the WebKit and Chromium tests and axe. It runs in CI on pull requests and on `main`, and never on this PC. |
| **clippy** | Rust's own code checker. It reads the code without running it and warns about mistakes and clumsy ways of writing things. |
| **Lint, linter** | A rule a code checker applies, and the checker itself (clippy for Rust, typescript-eslint for TypeScript). |
| **Checker switch** | A line in the code that turns a checker off for one spot: `#[allow(...)]` in Rust, `@ts-ignore` or `eslint-disable` in TypeScript. Allowed only with a recorded reason. |
| **`any`** | A TypeScript type that means "anything". The compiler stops checking a value typed `any`, and the unchecking spreads to everything it touches (it "leaks"). |
| **`unwrap()`** | Rust for "this cannot fail". If it does fail, the program stops (it "panics") instead of showing a message. |
| **Ratchet** | A count that may go down but never up. A script counts something unwanted (`any`, `unwrap()`, checker switches) and CI fails if the count rises above the committed number. |
| **Baseline** | The committed number a ratchet compares against. Lowering it after a clean-up is a normal edit. |
| **Spec** | One test file of the UI tests (`ui/tests/*.spec.ts`), usually one feature or behavior. |
| **Fixture** | Test data kept in the repo. A fixture that holds scripture is generated from the database, never typed. |
| **Flaky test, flake** | A test that passes and fails on the same code. Usually it waits a fixed time instead of waiting for the thing itself. Fixed at the cause, never hidden. |
| **Smoke run** | A short run of the real release build: open it on a scratch study folder, write a page, press Enter, reopen, check the file on disk. If it fails, nothing is published. |
| **Prototype** | A throwaway version of a feature, made quickly so the person can play it and judge how it feels before the real one is built. |
| **Feel check** | The person's short play of a release build before it is published, for how it feels, not a list of functions. |
| **Real study folder** | The person's own study files (`github\bible-study-data`, `Documents\wordbench-study-data`, or the folder the installed app names). Tests use a scratch copy. |
