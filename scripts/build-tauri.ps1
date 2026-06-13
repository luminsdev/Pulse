$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$SidecarBuildScript = Join-Path $ScriptDir "build-fps-sidecar.ps1"

if (-not (Test-Path -LiteralPath $SidecarBuildScript)) {
    throw "FPS sidecar build script not found: $SidecarBuildScript"
}

& $SidecarBuildScript

Push-Location $RootDir
try {
    pnpm run build
    if (-not $?) {
        exit 1
    }
}
finally {
    Pop-Location
}
