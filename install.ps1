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

Write-Host ""
Write-Host "Codeply installed. Run 'codeply login' to get started." -ForegroundColor Green
