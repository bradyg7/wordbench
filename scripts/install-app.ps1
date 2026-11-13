# Puts the latest release build where the person's own app runs from (%LOCALAPPDATA%\bible-workbench-rs\app), so a
# rebuild reaches the app used for daily study:
#   npx tauri build --no-bundle
#   powershell -ExecutionPolicy Bypass -File scripts\install-app.ps1
# It refuses while that app is open (close the window first). It copies files only (the two programs and, when it has
# changed, the Bible database); no study folder is touched, and it does not start the app or say which study folder it opens.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA "bible-workbench-rs\app"
$exe = Join-Path $dest "bible-workbench.exe"
$open = Get-Process bible-workbench -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }
if ($open) { Write-Output "The app is open (process $($open.Id)). Close its window, then run this again."; exit 1 }
New-Item -ItemType Directory -Force $dest | Out-Null
foreach ($f in "bible-workbench.exe", "wb.exe") {
    $src = Join-Path $repo "target\release\$f"
    if (-not (Test-Path $src)) { Write-Output "No ${src}: build first (npx tauri build --no-bundle; cargo build --release -p wb-cli)."; exit 1 }
    Copy-Item $src $dest -Force
}
# The Bible database goes beside the program (datasets\workbench.db), as in the buyer's package, so the app finds it
# without a setup question. It is copied only when it differs from the one already there (size or time), and only read
# from: WB_BIBLE_DB, or datasets\workbench.db in the sibling bible-workbench checkout.
$db = if ($env:WB_BIBLE_DB) { $env:WB_BIBLE_DB } else { Join-Path (Split-Path -Parent $repo) "bible-workbench\datasets\workbench.db" }
$dbDest = Join-Path $dest "datasets\workbench.db"
if (-not (Test-Path $db)) {
    Write-Output "No Bible database at ${db}: the app will ask for one (set WB_BIBLE_DB, or see data\README.md)."
} else {
    $from = Get-Item $db
    $to = Get-Item $dbDest -ErrorAction SilentlyContinue
    if (-not $to -or $to.Length -ne $from.Length -or $to.LastWriteTimeUtc -ne $from.LastWriteTimeUtc) {
        New-Item -ItemType Directory -Force (Split-Path -Parent $dbDest) | Out-Null
        Copy-Item $db $dbDest -Force
        Write-Output "Bible database copied from $db"
    } else {
        Write-Output "Bible database already current"
    }
}
$commit = git -C $repo log -1 --format="%h %s"
Write-Output "Installed in ${dest}: built from $commit"
