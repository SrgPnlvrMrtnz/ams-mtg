# Setup script: run after cloning the repo
# Usage: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "==> Checking .env file..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "    .env created from .env.example. Edit it before continuing."
        exit 0
    } else {
        Write-Host "    ERROR: .env file not found and no .env.example to copy from." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "    .env already exists, skipping."
}

Write-Host "==> Running Prisma migrations..."
npx prisma migrate dev
if (-not $?) { exit 1 }

Write-Host ""
$importCards = Read-Host "==> Import card catalog from Scryfall? (~165 MB download, ~27k cards) [y/N]"
if ($importCards -eq "y" -or $importCards -eq "Y") {
    Write-Host "==> Importing cards (this may take a few minutes)..."
    node scripts/import-cards.js
    if (-not $?) { exit 1 }
} else {
    Write-Host "    Skipping card import. Run 'npm run import-cards' later to import."
}

Write-Host ""
Write-Host "Setup complete. Run 'npm run dev' to start the development server." -ForegroundColor Green
