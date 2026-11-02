# Opens the phase 0 reader (spike a) for trying by mouse and by finger.
#   powershell -ExecutionPolicy Bypass -File scripts\try-reader.ps1 [-Size phone|phone-landscape|ipad|ipad-landscape|laptop|laptop-large|desktop]
# It reads the Bible database read-only and a scratch copy of the study folder (made here if missing); nothing it does
# is written to the real study folder. Highlights made in the spike last only until the window closes.
param([string]$Size = "phone")
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$scratch = "$env:TEMP\bible-workbench-rs\study-scratch"
if (-not (Test-Path $scratch)) { & "$PSScriptRoot\scratch-study.ps1" | Out-Null }
$exe = Join-Path $repo "target\release\bible-workbench.exe"
if (-not (Test-Path $exe)) {
    Write-Output "Building the app (a few minutes the first time)..."
    Push-Location $repo
    npx tauri build --no-bundle
    Pop-Location
}
$env:WB_STUDY_DIR = $scratch
$env:WB_WINDOW = $Size
Start-Process $exe
