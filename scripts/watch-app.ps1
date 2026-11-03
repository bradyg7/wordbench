# Opens the app in development mode, to watch it change while it is being built:
#   powershell -ExecutionPolicy Bypass -File scripts\watch-app.ps1 [-Size laptop|laptop-large|desktop|phone|ipad]
# A change to the UI (ui/) shows in the window at once; a change to the Rust side (crates/, app/) rebuilds and reopens
# it. It uses the scratch copy of the study folder (made here if missing); the real folder is never touched.
param([string]$Size = "laptop")
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$scratch = "$env:TEMP\bible-workbench-rs\study-scratch"
if (-not (Test-Path $scratch)) { & "$PSScriptRoot\scratch-study.ps1" | Out-Null }
$env:WB_STUDY_DIR = $scratch
$env:WB_WINDOW = $Size
Set-Location $repo
Write-Output "Watching the app ($Size window, study folder: $scratch). Close the window or press Ctrl+C here to stop."
npx tauri dev
