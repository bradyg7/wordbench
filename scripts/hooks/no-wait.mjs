// A PreToolUse hook for Bash and PowerShell: refuses waiting by sleeping (the 2026-11-23 retro found 347 wait loops in
// one builder and 15 sleeps across a step, and runs stalled at the 600 s watchdog). Exit code 2 refuses the call and
// shows the message to the agent.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Each pattern starts where a command starts (the line's start, after ; & | ( { or after do/then/else), so a word
// that is only an argument, like `grep -n Start-Sleep`, passes.
const AT_COMMAND = String.raw`(?:^|[;&|({]\s*|\b(?:do|then|else)\s+)`;
const WAITS = [
  String.raw`sleep\s+\S`, // sh: sleep 30, sleep $N
  String.raw`Start-Sleep\b`, // PowerShell
  String.raw`timeout(?:\.exe)?\s+\/t\b`, // cmd: timeout /t 30
  String.raw`ping(?:\.exe)?\s+-n\s+\d+\s+(?:127\.0\.0\.1|localhost)\b`, // cmd: ping -n 30 127.0.0.1
].map((wait) => new RegExp(AT_COMMAND + wait, "im"));

// Quoted text is a message or a pattern, never a command that runs here (`git commit -m "drop the sleep 30 loops"`).
const unquoted = (command) => command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

export function refusal(command) {
  if (typeof command !== "string") return null;
  const bare = unquoted(command);
  return WAITS.some((pattern) => pattern.test(bare))
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
