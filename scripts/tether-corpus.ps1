# Makes the Tether scratch study (420 pages, a long word dump, planted scripture from the database) in a NEW folder and
# writes <folder>-expected.json beside it. Never the real study folder. Usage: powershell -File scripts\tether-corpus.ps1 [folder]
param([string]$Folder = (Join-Path $env:TEMP 'bible-workbench-rs\tether-study'))
if (Test-Path $Folder) { Remove-Item -Recurse -Force $Folder }
cargo run -j 2 -q -p wb-core --example tether_corpus -- $Folder
