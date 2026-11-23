# Sets up CodeGraph (the code graph builders look code up in) in one checkout.
# Usage: powershell -File scripts\setup-codegraph.ps1 [checkout]   (default: this checkout)
# Never run it on the study folder. It installs the CLI if missing, writes .mcp.json,
# keeps .codegraph/ out of git (locally), turns telemetry off and builds the index.
param([string]$Checkout = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$Checkout = (Resolve-Path $Checkout).Path
if ($Checkout -match 'bible-study-data') { throw "Refusing: $Checkout is the study folder." }
if (-not (Test-Path (Join-Path $Checkout '.git'))) { throw "Not a git checkout: $Checkout" }
$env:CODEGRAPH_TELEMETRY = '0'
if (-not (Get-Command codegraph -ErrorAction SilentlyContinue)) { npm i -g @colbymchenry/codegraph }
codegraph telemetry off | Out-Null
$mcp = Join-Path $Checkout '.mcp.json'
if (-not (Test-Path $mcp)) {
  $json = '{ "mcpServers": { "codegraph": { "type": "stdio", "command": "codegraph", "args": ["serve", "--mcp"], "env": { "CODEGRAPH_TELEMETRY": "0" } } } }'
  [IO.File]::WriteAllText($mcp, $json + "`n")
}
$gitDir = (git -C $Checkout rev-parse --git-common-dir)
if (-not [IO.Path]::IsPathRooted($gitDir)) { $gitDir = Join-Path $Checkout $gitDir }
$exclude = Join-Path $gitDir 'info\exclude'
if (-not (Select-String -Path $exclude -Pattern '^\.codegraph/' -Quiet -ErrorAction SilentlyContinue)) {
  Add-Content -Path $exclude -Value '.codegraph/' -Encoding ascii
}
Push-Location $Checkout
try {
  if (Test-Path '.codegraph') { codegraph sync } else { codegraph init --yes }
  codegraph status
} finally { Pop-Location }
Write-Host "CodeGraph ready in $Checkout. Open a new Claude session there and approve the 'codegraph' project server once."
