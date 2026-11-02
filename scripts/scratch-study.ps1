# Copies the person's study folder to a scratch folder for the app, tests and spikes to use.
# The real folder is only read here; everything else works on the copy.
param(
    [string]$Source = "$env:USERPROFILE\github\bible-study-data",
    [string]$Dest = "$env:TEMP\bible-workbench-rs\study-scratch"
)
$ErrorActionPreference = "Stop"
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force $Dest | Out-Null
# robocopy only reads the source; /XD .git leaves its history behind (the copy is not a clone).
robocopy $Source $Dest /E /XD .git /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
Write-Output "Scratch study folder: $Dest"
Write-Output "Use it with: `$env:WB_STUDY_DIR = '$Dest'"
