// A PreToolUse hook for Bash and PowerShell: refuses waiting by sleeping (the 2026-11-23 retro found 347 wait loops in
// one builder and 15 sleeps across a step, and runs stalled at the 600 s watchdog). Exit code 2 refuses the call and
// shows the message to the agent.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WAITS = [
  /(^|[\s;&|(`])sleep\s+\d/i, // sh: sleep 30
  /(^|[\s;&|(`])Start-Sleep\b/i, // PowerShell
  /(^|[\s;&|(`])timeout(\.exe)?\s+\/t\b/i, // cmd: timeout /t 30
];

export function refusal(command) {
  if (typeof command !== "string") return null;
  return WAITS.some((pattern) => pattern.test(command))
    ? "Waiting by sleeping is refused here. Start the long command with run_in_background: true and do other work; " +
        "when nothing is left, end your turn with one line naming the log. You are resumed when it finishes."
    : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  const message = refusal(input?.tool_input?.command);
  if (message) {
    process.stderr.write(message + "\n");
    process.exit(2);
  }
}
