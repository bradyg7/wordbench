import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { refusal } from "./no-wait.mjs";

test("sleeping is refused in sh, PowerShell and cmd", () => {
  for (const command of [
    "sleep 30",
    "cargo build & sleep 5; tail log",
    "while ! test -f done; do sleep 10; done",
    "Start-Sleep -Seconds 20",
    "start-sleep 5; Get-Content log -Tail 5",
    "timeout /t 30",
    "sleep $N",
    "ping -n 30 127.0.0.1 > nul",
    "until [ -f done ]; do\n  sleep 5\ndone",
  ]) {
    assert.ok(refusal(command), command);
  }
});

test("commands that only mention the word pass", () => {
  for (const command of [
    'grep -rn "sleep" scripts',
    "git log --grep=sleep",
    "cargo test -p wb-core sleep_mode",
    "npx playwright test --timeout 60000",
    'git commit -m "drop the sleep 30 loops"',
    "grep -n Start-Sleep docs/x.md",
    "timeout 120 cargo test -p wb-core",
    undefined,
  ]) {
    assert.equal(refusal(command), null, String(command));
  }
});

test("the hook exits 2 with the reason on a sleep, and 0 otherwise", () => {
  const script = fileURLToPath(new URL("./no-wait.mjs", import.meta.url));
  const run = (command) =>
    spawnSync(process.execPath, [script], { input: JSON.stringify({ tool_input: { command } }), encoding: "utf8" });
  const refused = run("sleep 30");
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /run_in_background/);
  assert.equal(run("git status").status, 0);
});
