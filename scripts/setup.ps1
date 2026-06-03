# Setup script: run after cloning the repo
# Usage: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "==> Checking .env file..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "    .env created from .env.example. Edit it and run setup again." -ForegroundColor Yellow
        Write-Host "    Tip: run 'npm run generate-secret' to generate a JWT_SECRET value."
        exit 0
    } else {
        Write-Host "    ERROR: .env not found and no .env.example to copy from." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "    .env already exists, skipping."
}

Write-Host ""
Write-Host "==> Running Prisma migrations..."
npx prisma migrate dev --name setup
if (-not $?) { exit 1 }
Write-Host "    Database ready." -ForegroundColor Green

Write-Host ""
Write-Host "==> Importing card catalog from Scryfall (~165 MB, ~34k cards)..."
node scripts/import-cards.js
if (-not $?) { exit 1 }
Write-Host "    Cards imported." -ForegroundColor Green

Write-Host ""
Write-Host "==> Tagging cards with AI rules (python/tag_cards.py)..."
python python/tag_cards.py
if (-not $?) { exit 1 }
Write-Host "    Tags applied." -ForegroundColor Green

Write-Host ""
Write-Host "Setup complete. Run 'npm run dev' to start the development server." -ForegroundColor Green
