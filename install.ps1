# Codeply CLI installer -Windows PowerShell
#   irm https://codeply.online/install.ps1 | iex
$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Codeply needs Node.js 18 or newer first: https://nodejs.org" -ForegroundColor Red
    exit 1
}

$nodeVersion = (node -v) -replace '^v', ''
$nodeMajor = [int]($nodeVersion -split '\.')[0]
if ($nodeMajor -lt 18) {
    Write-Host "Codeply needs Node.js 18 or newer (you have v$nodeVersion): https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm wasn't found alongside node -reinstall Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "Installing Codeply..."
npm install -g codeply-cli
# $ErrorActionPreference only catches PowerShell's own errors, not a failed
# EXTERNAL command's exit code -- npm can print "404 Not Found" and exit
# non-zero while the script sails on and prints a false success message
# unless $LASTEXITCODE is checked explicitly.
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Install failed (npm exited with code $LASTEXITCODE). See the errors above." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Codeply installed. Run 'codeply login' to get started." -ForegroundColor Green
