Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

$ProjectPath = Join-Path $RootDir "src-tauri\sidecar\fps-sidecar\fps-sidecar.csproj"
$PublishDir = Join-Path $RootDir "src-tauri\sidecar\fps-sidecar\bin\Release\net10.0\win-x64\publish"
$SourceExe = Join-Path $PublishDir "fps-sidecar.exe"
$TargetDir = Join-Path $RootDir "src-tauri\binaries"
$TargetExe = Join-Path $TargetDir "fps-sidecar-x86_64-pc-windows-msvc.exe"
$VendorPresentMonExe = Join-Path $RootDir "src-tauri\vendor\presentmon\PresentMon-2.4.1-x64.exe"
$VendorPresentMonLicense = Join-Path $RootDir "src-tauri\vendor\presentmon\LICENSE-PresentMon.txt"
$TargetPresentMonExe = Join-Path $TargetDir "presentmon-x86_64-pc-windows-msvc.exe"
$TargetPresentMonLicense = Join-Path $TargetDir "LICENSE-PresentMon.txt"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET SDK is required to build fps-sidecar. Install .NET 10 SDK and rerun this script."
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

if (Test-Path -LiteralPath $VendorPresentMonExe) {
    Copy-Item -LiteralPath $VendorPresentMonExe -Destination $TargetPresentMonExe -Force
    "[OK] Copied bundled PresentMon to $TargetPresentMonExe"

    if (Test-Path -LiteralPath $VendorPresentMonLicense) {
        Copy-Item -LiteralPath $VendorPresentMonLicense -Destination $TargetPresentMonLicense -Force
        "[OK] Copied PresentMon license to $TargetPresentMonLicense"
    } else {
        throw "Bundled PresentMon binary exists but license is missing: $VendorPresentMonLicense"
    }
} else {
    "[INFO] No bundled PresentMon binary found. FPS sidecar will fall back to installed Intel PresentMon."
}
