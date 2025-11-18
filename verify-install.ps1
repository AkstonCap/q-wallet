# Nexus Wallet - Installation Verification

$separator = "=" * 60

Write-Host $separator
Write-Host "Nexus Wallet Browser Extension - Installation Check" -ForegroundColor Cyan
Write-Host $separator
Write-Host ""

$allGood = $true

# Check required files
$requiredFiles = @(
    "manifest.json",
    "popup.html",
    "popup.js",
    "background.js",
    "content.js",
    "inpage.js",
    "services\nexus-api.js",
    "services\storage.js",
    "services\wallet.js",
    "styles\popup.css",
    "README.md",
    "QUICKSTART.md"
)

Write-Host "Checking required files..." -ForegroundColor Yellow
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""
Write-Host "Checking icon files..." -ForegroundColor Yellow
$iconFiles = @("icons\icon16.png", "icons\icon32.png", "icons\icon48.png", "icons\icon128.png")
foreach ($icon in $iconFiles) {
    if (Test-Path $icon) {
        Write-Host "  [OK] $icon" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $icon - Use generate-icons.html to create" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Checking directory structure..." -ForegroundColor Yellow
$directories = @("services", "styles", "icons")
foreach ($dir in $directories) {
    if (Test-Path $dir -PathType Container) {
        Write-Host "  [OK] $dir\" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $dir\" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""
Write-Host $separator

if ($allGood) {
    Write-Host "SUCCESS! All required files are present." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Generate icons: Open generate-icons.html in browser"
    Write-Host "  2. Install extension in Chrome/Edge: chrome://extensions/"
    Write-Host "     Enable Developer mode, then click Load unpacked"
    Write-Host "  3. Start Nexus node: ./nexus -noapiauth"
    Write-Host "  4. Open wallet and create account!"
    Write-Host ""
    Write-Host "Documentation:" -ForegroundColor Cyan
    Write-Host "  - Quick Start: QUICKSTART.md"
    Write-Host "  - Full Guide: README.md"
    Write-Host "  - Developers: DEVELOPER.md"
} else {
    Write-Host "ERROR: Some required files are missing!" -ForegroundColor Red
    Write-Host "Please ensure all files were created properly." -ForegroundColor Red
}

Write-Host $separator
Write-Host ""
