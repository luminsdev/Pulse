$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$scanRoots = @(
  (Join-Path -Path $repoRoot -ChildPath "src-tauri\binaries")
  (Join-Path -Path $repoRoot -ChildPath "src-tauri\target\release\bundle")
  (Join-Path -Path $repoRoot -ChildPath "src-tauri\target\release")
) | Where-Object { Test-Path -LiteralPath $_ }

$blockedNamePattern = '(?i)(winring0|r0lhm|lhm-sidecar)'
$blockedFiles = New-Object System.Collections.Generic.List[string]

foreach ($root in $scanRoots) {
  Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($repoRoot.Length).TrimStart('\')
    $isUnexpectedDriver = $_.Extension -ieq ".sys"
    $isBlockedName = $_.Name -match $blockedNamePattern

    if ($isUnexpectedDriver -or $isBlockedName) {
      $blockedFiles.Add($relative)
    }
  }
}

if ($blockedFiles.Count -gt 0) {
  "Unsafe sensor artifacts found:"
  $blockedFiles | Sort-Object | ForEach-Object { "- $_" }
  exit 1
}

"Safe sensor artifact scan passed."
