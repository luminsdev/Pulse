# ═══════════════════════════════════════════════════════════════════════════════
# Pulse - Cleanup Script
# Removes build caches to free disk space
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Pulse Cleanup Script" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if Pulse is running
$pulseProcess = Get-Process -Name "pulse" -ErrorAction SilentlyContinue
if ($pulseProcess) {
    Write-Host "[!] Pulse is running. Please close it first!" -ForegroundColor Red
    exit 1
}

# Paths
$projectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $projectDir) { $projectDir = "D:\Project\hardware-monitoring" }
$rustTarget = "D:\rust-target"
$nodeModules = Join-Path $projectDir "node_modules"
$dist = Join-Path $projectDir "dist"

# Calculate current sizes
function Get-FolderSize($path) {
    if (Test-Path $path) {
        $size = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | 
                 Measure-Object -Property Length -Sum).Sum
        return [math]::Round($size / 1GB, 2)
    }
    return 0
}

Write-Host "[*] Current disk usage:" -ForegroundColor Yellow
$rustSize = Get-FolderSize $rustTarget
$nodeSize = Get-FolderSize $nodeModules
$distSize = Get-FolderSize $dist

Write-Host "    Rust target:   $rustSize GB" -ForegroundColor Gray
Write-Host "    node_modules:  $nodeSize GB" -ForegroundColor Gray
Write-Host "    dist:          $distSize GB" -ForegroundColor Gray
$totalSize = $rustSize + $nodeSize + $distSize
Write-Host "    ─────────────────────────" -ForegroundColor Gray
Write-Host "    Total:         $totalSize GB" -ForegroundColor White
Write-Host ""

# Ask user
Write-Host "What would you like to clean?" -ForegroundColor Yellow
Write-Host "  1. Rust target only (~$rustSize GB)"
Write-Host "  2. node_modules only (~$nodeSize GB)"
Write-Host "  3. Everything (Rust + node_modules + dist)"
Write-Host "  4. Cancel"
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "`n[*] Cleaning Rust target..." -ForegroundColor Yellow
        if (Test-Path $rustTarget) {
            Remove-Item $rustTarget -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[+] Rust target cleaned!" -ForegroundColor Green
        }
    }
    "2" {
        Write-Host "`n[*] Cleaning node_modules..." -ForegroundColor Yellow
        if (Test-Path $nodeModules) {
            Remove-Item $nodeModules -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[+] node_modules cleaned!" -ForegroundColor Green
            Write-Host "    Run 'npm install' to reinstall dependencies" -ForegroundColor Gray
        }
    }
    "3" {
        Write-Host "`n[*] Cleaning everything..." -ForegroundColor Yellow
        
        if (Test-Path $rustTarget) {
            Remove-Item $rustTarget -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[+] Rust target cleaned!" -ForegroundColor Green
        }
        
        if (Test-Path $nodeModules) {
            Remove-Item $nodeModules -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[+] node_modules cleaned!" -ForegroundColor Green
        }
        
        if (Test-Path $dist) {
            Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[+] dist cleaned!" -ForegroundColor Green
        }
        
        Write-Host "`n[i] To rebuild:" -ForegroundColor Cyan
        Write-Host "    npm install" -ForegroundColor White
        Write-Host "    npm run tauri build" -ForegroundColor White
    }
    "4" {
        Write-Host "`n[*] Cancelled." -ForegroundColor Gray
    }
    default {
        Write-Host "`n[!] Invalid choice." -ForegroundColor Red
    }
}

Write-Host ""
