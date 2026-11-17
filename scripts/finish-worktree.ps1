# Removes worktrees whose work has reached main, and their local branches.
# Dry run by default: it only says what it would do. Add -Apply to remove.
#
# A worktree is removed only when ALL of these hold:
#   1. its work is on origin/main: the branch is an ancestor of origin/main, or its pull request
#      is MERGED and the PR's last commit is the branch's tip (a squash merge leaves the branch
#      "unmerged" to git, so the PR is asked); a detached HEAD must be an ancestor of origin/main
#   2. nothing is uncommitted or untracked in it (files there may be someone else's: AGENTS.md)
#   3. it is not locked, and no process has its folder or files open
# A branch with no PR that only sits on origin/main (no commits of its own, perhaps just made) is kept
# unless -IncludeEmpty is given.
# Anything else is kept, with the reason. Remote branches are never touched, nor the main checkout,
# nor the worktree the script is run from. Worktrees made by other tools (Codex, Gemini) are listed
# but left alone unless -IncludeOtherTools is given.
#
# Run it from the main checkout (or any worktree) in the person's terminal, after a pull request merges:
#   powershell -ExecutionPolicy Bypass -File scripts\finish-worktree.ps1            # dry run
#   powershell -ExecutionPolicy Bypass -File scripts\finish-worktree.ps1 -Apply     # remove
#   ... -Only feature/trash        # just that branch (or a worktree folder name)
param(
    [switch]$Apply,
    [switch]$IncludeOtherTools,
    [switch]$IncludeEmpty,
    [string]$Only = ""
)
$ErrorActionPreference = "Stop"

function Invoke-Git { & git.exe @args }

$common = (Invoke-Git rev-parse --path-format=absolute --git-common-dir).Trim()
$mainRoot = (Resolve-Path (Join-Path $common "..")).Path
$here = (Resolve-Path (Invoke-Git rev-parse --show-toplevel).Trim()).Path

Write-Output "Fetching origin..."
Invoke-Git -C $mainRoot fetch --quiet origin
$null = Invoke-Git -C $mainRoot rev-parse --verify --quiet origin/main
if ($LASTEXITCODE -ne 0) { throw "origin/main not found" }

# `git worktree list --porcelain`: blocks separated by blank lines.
$trees = @()
$cur = $null
foreach ($line in (Invoke-Git -C $mainRoot worktree list --porcelain)) {
    if ($line -like "worktree *") { $cur = @{ Path = $line.Substring(9); Branch = ""; Head = ""; Locked = $false; Detached = $false }; $trees += $cur }
    elseif ($line -like "HEAD *") { $cur.Head = $line.Substring(5) }
    elseif ($line -like "branch refs/heads/*") { $cur.Branch = $line.Substring(18) }
    elseif ($line -eq "detached") { $cur.Detached = $true }
    elseif ($line -like "locked*") { $cur.Locked = $true }
}

function Norm([string]$p) { return ($p -replace "/", "\").TrimEnd("\").ToLowerInvariant() }
$mainN = Norm $mainRoot
$hereN = Norm $here
$claudeWt = Norm (Join-Path $mainRoot ".claude\worktrees")
$githubDir = Norm (Split-Path $mainRoot -Parent)

function IsOurs([string]$p) {
    $n = Norm $p
    return $n.StartsWith($claudeWt + "\") -or ((Split-Path $n -Parent) -eq $githubDir)
}

function Reason-NotMerged($t) {
    $ancestor = $false
    $null = Invoke-Git -C $mainRoot merge-base --is-ancestor $t.Head origin/main 2>$null
    if ($LASTEXITCODE -eq 0) { $ancestor = $true }
    $prs = @()
    if ($t.Branch) {
        $json = & gh pr list --head $t.Branch --state merged --json number,headRefOid --limit 5 2>$null
        if ($LASTEXITCODE -ne 0) { return "could not ask GitHub about a pull request for $($t.Branch)" }
        # An empty list parses to $null in Windows PowerShell 5.1.
        $prs = @($json | ConvertFrom-Json | Where-Object { $_ })
    }
    foreach ($pr in $prs) { if ($pr.headRefOid -eq $t.Head) { return $null } }
    if ($prs.Count -gt 0) {
        if ($ancestor) { return $null }
        return "branch has commits after its merged PR #$($prs[0].number)"
    }
    # No merged PR. Being "on main" alone is not proof of work done: a worktree just branched from
    # main has no commits of its own and would look the same.
    if ($ancestor) { if ($IncludeEmpty) { return $null }; return "no merged pull request (empty or just-made branch?); pass -IncludeEmpty to remove it" }
    return "no merged pull request, and not an ancestor of origin/main"
}

function Reason-InUse([string]$path) {
    $n = Norm $path
    $procs = Get-CimInstance Win32_Process | Where-Object {
        ($_.ExecutablePath -and (Norm $_.ExecutablePath).StartsWith($n + "\")) -or
        ($_.CommandLine -and $_.CommandLine.ToLowerInvariant().Replace("/", "\").Contains($n))
    } | Where-Object { $_.ProcessId -ne $PID }
    if ($procs) { return "in use by " + (($procs | ForEach-Object { "$($_.Name) ($($_.ProcessId))" }) -join ", ") }
    return $null
}

$removed = 0; $kept = 0
foreach ($t in $trees) {
    $n = Norm $t.Path
    if ($n -eq $mainN) { continue }
    $label = if ($t.Branch) { $t.Branch } else { "(detached $($t.Head.Substring(0,7)))" }
    if ($Only -and $Only -ne $t.Branch -and $Only -ne (Split-Path $t.Path -Leaf)) { continue }

    $why = $null
    if ($n -eq $hereN) { $why = "this is the worktree the script runs from; run it from the main checkout" }
    elseif (-not (IsOurs $t.Path) -and -not $IncludeOtherTools) { $why = "made by another tool; pass -IncludeOtherTools to consider it" }
    elseif (-not (Test-Path $t.Path)) { $why = "folder is gone (run: git worktree prune)" }
    elseif ($t.Locked) { $why = "locked" }
    else {
        $why = Reason-NotMerged $t
        if (-not $why) {
            $dirty = @(Invoke-Git -C $t.Path status --porcelain)
            if ($dirty.Count -gt 0) { $why = "$($dirty.Count) uncommitted or untracked file(s)" }
        }
        if (-not $why) { $why = Reason-InUse $t.Path }
    }

    if ($why) {
        $kept++
        Write-Output ("KEEP    {0,-40} {1}" -f $label, $why)
        continue
    }
    if (-not $Apply) {
        Write-Output ("WOULD   {0,-40} remove {1}" -f $label, $t.Path)
        $removed++
        continue
    }
    Invoke-Git -C $mainRoot worktree remove $t.Path
    if ($LASTEXITCODE -ne 0) { Write-Output ("KEEP    {0,-40} git could not remove it" -f $label); $kept++; continue }
    if ($t.Branch) { Invoke-Git -C $mainRoot branch -D $t.Branch | Out-Null }
    Write-Output ("REMOVED {0,-40} {1}" -f $label, $t.Path)
    $removed++
}

$verb = if ($Apply) { "removed" } else { "would remove" }
Write-Output "$removed $verb, $kept kept."
if (-not $Apply -and $removed -gt 0) { Write-Output "Dry run. Add -Apply to remove them." }
