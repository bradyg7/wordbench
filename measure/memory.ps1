# Memory of a process and everything it started (the app and its WebView2 processes), as JSON.
param([Parameter(Mandatory = $true)][int]$ProcessId)
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, WorkingSetSize, PrivatePageCount
$tree = @($all | Where-Object { $_.ProcessId -eq $ProcessId })
$frontier = @($ProcessId)
while ($frontier.Count -gt 0) {
    $kids = @($all | Where-Object { $frontier -contains $_.ParentProcessId })
    $tree += $kids
    $frontier = @($kids | ForEach-Object { $_.ProcessId })
}
$rows = $tree | ForEach-Object { [pscustomobject]@{ name = $_.Name; pid = $_.ProcessId; ws_mb = [math]::Round($_.WorkingSetSize / 1MB, 1); private_mb = [math]::Round($_.PrivatePageCount / 1MB, 1) } }
[pscustomobject]@{
    processes = @($rows)
    total_ws_mb = [math]::Round(($tree | Measure-Object WorkingSetSize -Sum).Sum / 1MB, 1)
    total_private_mb = [math]::Round(($tree | Measure-Object PrivatePageCount -Sum).Sum / 1MB, 1)
} | ConvertTo-Json -Depth 4
