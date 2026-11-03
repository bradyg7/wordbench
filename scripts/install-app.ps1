# Puts the latest release build where the person's own app runs from (%LOCALAPPDATA%\bible-workbench-rs\app), so a
# rebuild reaches the app used for daily study:
#   npx tauri build --no-bundle
#   powershell -ExecutionPolicy Bypass -File scripts\install-app.ps1
# It refuses while that app is open (close the window first). It copies files only; no study folder is touched, and it
# does not start the app or say which study folder it opens.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA "bible-workbench-rs\app"
$exe = Join-Path $dest "bible-workbench.exe"
$open = Get-Process bible-workbench -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }
if ($open) { Write-Output "The app is open (process $($open.Id)). Close its window, then run this again."; exit 1 }
New-Item -ItemType Directory -Force $dest | Out-Null
foreach ($f in "bible-workbench.exe", "wb.exe") {
    $src = Join-Path $repo "target\release\$f"
    if (-not (Test-Path $src)) { Write-Output "No $src: build first (npx tauri build --no-bundle; cargo build --release -p wb-cli)."; exit 1 }
    Copy-Item $src $dest -Force
}
$commit = git -C $repo log -1 --format="%h %s"
Write-Output "Installed in ${dest}: built from $commit"
