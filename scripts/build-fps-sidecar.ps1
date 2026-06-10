Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

$ProjectPath = Join-Path $RootDir "src-tauri\sidecar\fps-sidecar\fps-sidecar.csproj"
$PublishDir = Join-Path $RootDir "src-tauri\sidecar\fps-sidecar\bin\Release\net9.0\win-x64\publish"
$SourceExe = Join-Path $PublishDir "fps-sidecar.exe"
$TargetDir = Join-Path $RootDir "src-tauri\binaries"
$TargetExe = Join-Path $TargetDir "fps-sidecar-x86_64-pc-windows-msvc.exe"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET SDK is required to build fps-sidecar. Install .NET 9 SDK and rerun this script."
}

if (-not (Test-Path -LiteralPath $ProjectPath)) {
    throw "FPS sidecar project not found: $ProjectPath"
}

dotnet publish $ProjectPath -c Release -r win-x64
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path -LiteralPath $SourceExe)) {
    throw "Published fps-sidecar.exe not found: $SourceExe"
}

if (-not (Test-Path -LiteralPath $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir | Out-Null
}

Copy-Item -LiteralPath $SourceExe -Destination $TargetExe -Force
"[OK] Copied FPS sidecar to $TargetExe"
