# Copies the person's real study folder to a dated backup before the app works on it:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-study.ps1
# The study folder is only read. The copy goes to %LOCALAPPDATA%\bible-workbench-rs\backups\bible-study-data-<time>, and
# every file is compared with its original by hash before the script says it is done.
$ErrorActionPreference = "Stop"
$src = Join-Path $env:USERPROFILE "github\bible-study-data"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $env:LOCALAPPDATA "bible-workbench-rs\backups\bible-study-data-$stamp"
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
Copy-Item -Recurse $src $dest
$a = Get-ChildItem -Recurse -File -Force $src
$bad = 0
foreach ($f in $a) {
    $copy = Join-Path $dest $f.FullName.Substring($src.Length)
    if (-not (Test-Path $copy) -or (Get-FileHash $f.FullName).Hash -ne (Get-FileHash $copy).Hash) { $bad++; Write-Output "differs: $($f.FullName)" }
}
if ($bad) { Write-Output "Backup INCOMPLETE: $bad of $($a.Count) files differ. $dest"; exit 1 }
Write-Output "Backup done: $($a.Count) files, every one the same as the original. $dest"
