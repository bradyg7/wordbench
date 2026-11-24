# CI on this PC while GitHub Actions minutes are out (the person, 2026-11-24): the steps of .github/workflows/ci.yml's
# quick-light, quick-clippy and full jobs, in that order, stopping at the first failure, with a summary at the end.
# Keep it in step with ci.yml. CODING_STANDARDS.md allows the full suite on this PC through this script only.
#
#   powershell -ExecutionPolicy Bypass -File scripts\ci-local.ps1            # every step
#   powershell -ExecutionPolicy Bypass -File scripts\ci-local.ps1 -From 12   # start at step 12 (after a fix)
#
# Study folder: WB_STUDY_DIR points at a new empty folder under %TEMP%, never the real one, and WB_ALLOW_REAL_STUDY
# is cleared. The Bible database is WB_BIBLE_DB as set on this PC.
param([int]$From = 1)

# 'Continue': cargo and npm write progress to stderr, which is not a failure; each step's exit code decides
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# a program that cannot be found raises an error but leaves $LASTEXITCODE at 0, which would read as a pass
$missing = @('git', 'cargo', 'node', 'npm', 'npx', 'python') | Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) }
if ($missing) { Write-Error "Not found on PATH: $($missing -join ', ')"; exit 1 }

$db = $env:WB_BIBLE_DB
if (-not $db) { $db = [Environment]::GetEnvironmentVariable('WB_BIBLE_DB', 'User') }
if (-not $db) { $db = [Environment]::GetEnvironmentVariable('WB_BIBLE_DB', 'Machine') }
if (-not $db -or -not (Test-Path $db)) { Write-Error "WB_BIBLE_DB is not set on this PC, or names no file: '$db'"; exit 1 }
$env:WB_BIBLE_DB = $db
$env:WB_REQUIRE_DB = '1'
Remove-Item Env:WB_ALLOW_REAL_STUDY -ErrorAction SilentlyContinue
$study = Join-Path $env:TEMP 'bible-workbench-rs\ci-local-study'
if (Test-Path $study) { Remove-Item -Recurse -Force $study }
New-Item -ItemType Directory -Force $study | Out-Null
$env:WB_STUDY_DIR = $study
# the wb program `cargo test` builds; test:scripture and fixtures use it instead of compiling wb-cli again, as in CI
$env:WB_BIN = Join-Path $root 'target\debug\wb.exe'
# CI also sets CARGO_PROFILE_DEV_DEBUG=0; it is left out here so this PC's own build cache is reused (debug info
# changes no test's outcome)

# The tree may already hold changes (work not yet committed), so the clean-tree check compares the end with the start:
# each changed or untracked file and its content hash.
function Get-TreeState {
  $lines = git status --porcelain --untracked-files=all
  foreach ($l in $lines) {
    $f = $l.Substring(3).Trim('"')
    $h = if (Test-Path -LiteralPath $f -PathType Leaf) { git hash-object -- $f } else { 'gone' }
    "$l $h"
  }
}
$startState = @(Get-TreeState)
function Test-CleanTree {
  if ($startState.Count -eq 0) { node scripts/clean-tree.mjs; return }
  $now = @(Get-TreeState)
  # only entries new or different at the end count: one that is gone was committed or put back while the run went on
  $diff = if ($now.Count -eq 0) { @() } else { Compare-Object $startState $now | Where-Object SideIndicator -eq '=>' }
  if (-not $diff) { Write-Output "The run changed no file (the $($startState.Count) changed before it started are as they were)."; $global:LASTEXITCODE = 0; return }
  Write-Output 'A test or build changed files:'
  $diff | ForEach-Object { Write-Output "  $($_.SideIndicator) $($_.InputObject)" }
  $global:LASTEXITCODE = 1
}

$steps = @(
  # quick-light
  @{ Job = 'quick-light'; Name = 'cargo fmt --check'; Run = { cargo fmt --all --check } }
  @{ Job = 'quick-light'; Name = 'npm ci'; Run = { npm ci } }
  @{ Job = 'quick-light'; Name = 'tsc -p ui'; Run = { npx tsc -p ui } }
  @{ Job = 'quick-light'; Name = 'ratchet'; Run = { node scripts/ratchet.mjs } }
  @{ Job = 'quick-light'; Name = 'test:ratchet'; Run = { npm run test:ratchet } }
  @{ Job = 'quick-light'; Name = 'test:hooks'; Run = { npm run test:hooks } }
  @{ Job = 'quick-light'; Name = 'No TODO, FIXME or XXX'; Run = {
      git grep -nIE '\b(TODO|FIXME|XXX)\b' -- . ':!docs' ':!design' ':!datasets' ':!*.md' ':!.github/workflows/ci.yml' ':!scripts/ci-local.ps1'
      # git grep exits 1 when nothing is found, which is the pass
      if ($LASTEXITCODE -eq 0) { Write-Output 'A TODO, FIXME or XXX is in merged code: move the thought to docs/turnaround-parked.md'; $global:LASTEXITCODE = 1 }
      elseif ($LASTEXITCODE -eq 1) { $global:LASTEXITCODE = 0 } } }
  @{ Job = 'quick-light'; Name = 'test:tokens'; Run = { npm run test:tokens } }
  @{ Job = 'quick-light'; Name = 'test:distribution'; Run = { npm run test:distribution } }
  # quick-clippy (npm ci is above)
  @{ Job = 'quick-clippy'; Name = 'npm run build'; Run = { npm run build } }
  @{ Job = 'quick-clippy'; Name = 'clippy'; Run = { cargo clippy --workspace --all-targets -- -D warnings } }
  @{ Job = 'quick-clippy'; Name = 'clippy --all-features'; Run = { cargo clippy --workspace --all-targets --all-features -- -D warnings } }
  # full (npm ci and npm run build are above)
  @{ Job = 'full'; Name = 'cargo test'; Run = { cargo test -j 8 --workspace --no-fail-fast } }
  @{ Job = 'full'; Name = 'test:unit'; Run = { npm run test:unit } }
  @{ Job = 'full'; Name = 'scripture'; Run = { npm run scripture } }
  @{ Job = 'full'; Name = 'test:scripture'; Run = { npm run test:scripture } }
  @{ Job = 'full'; Name = 'build-dictionary'; Run = { python scripts/build-dictionary.py } }
  @{ Job = 'full'; Name = 'fixtures'; Run = { npm run fixtures } }
  @{ Job = 'full'; Name = 'playwright install webkit'; Run = { npx playwright install webkit } }
  @{ Job = 'full'; Name = 'UI in WebKit'; Run = { npx playwright test --project webkit-phone --project webkit-desktop --grep-invert the_reader_has_no_wcag } }
  @{ Job = 'full'; Name = 'chromium-editor'; Run = { npx playwright test --project chromium-editor } }
  @{ Job = 'full'; Name = 'setup screen'; Run = { npm run test:setup } }
  @{ Job = 'full'; Name = 'axe (WCAG 2.2 AA)'; Run = { npx playwright test --project webkit-phone --project webkit-desktop --grep the_reader_has_no_wcag } }
  @{ Job = 'full'; Name = 'The run changed no file'; Run = { Test-CleanTree } }
)

$results = @()
$failed = $null
for ($i = 0; $i -lt $steps.Count; $i++) {
  $n = $i + 1
  $s = $steps[$i]
  if ($n -lt $From) { $results += [pscustomobject]@{ '#' = $n; Job = $s.Job; Step = $s.Name; Result = 'skipped'; Minutes = '' }; continue }
  Write-Output ''
  Write-Output "=== [$n/$($steps.Count)] $($s.Job): $($s.Name)"
  $global:LASTEXITCODE = 0
  $t = [Diagnostics.Stopwatch]::StartNew()
  & $s.Run
  $code = $LASTEXITCODE
  $t.Stop()
  $ok = ($code -eq 0)
  $results += [pscustomobject]@{ '#' = $n; Job = $s.Job; Step = $s.Name; Result = $(if ($ok) { 'passed' } else { "FAILED ($code)" }); Minutes = [math]::Round($t.Elapsed.TotalMinutes, 1) }
  if (-not $ok) { $failed = $n; break }
}
for ($j = $results.Count; $j -lt $steps.Count; $j++) {
  $results += [pscustomobject]@{ '#' = $j + 1; Job = $steps[$j].Job; Step = $steps[$j].Name; Result = 'not run'; Minutes = '' }
}

Write-Output ''
Write-Output '=== Summary'
$results | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
if ($failed) { Write-Output "FAILED at step $failed. Fix it, then re-run with -From $failed."; exit 1 }
Write-Output 'All steps passed.'
exit 0
