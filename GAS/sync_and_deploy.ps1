# ==============================================================================
# Smart Warehouse GAS -- Sync & Deploy Script
# Pushes local JS files to GAS, creates a new immutable version,
# then updates the active Web App deployment to serve the new code.
# ==============================================================================

$DEPLOYMENT_ID = "AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK"
$WEB_APP_URL   = "https://script.google.com/macros/s/$DEPLOYMENT_ID/exec"

Write-Host ""
Write-Host "==========================================" -ForegroundColor DarkCyan
Write-Host "  Smart Warehouse GAS -- Push and Deploy  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor DarkCyan

# --- Pre-flight: confirm clasp is logged in ---
Write-Host "`n[0/3] Checking clasp login status..." -ForegroundColor Yellow
$claspStatus = clasp login --status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      FAILED - Not logged in. Run: clasp login" -ForegroundColor Red
    exit 1
}
Write-Host "      OK - clasp is authenticated." -ForegroundColor Green

# --- Step 1: Push local files to GAS ---
Write-Host "`n[1/3] Pushing local files to Google Apps Script..." -ForegroundColor Cyan
clasp push --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "      FAILED - Push failed. Check clasp output above." -ForegroundColor Red
    exit 1
}
Write-Host "      OK - Push complete." -ForegroundColor Green

# --- Step 2: Create a new immutable version ---
Write-Host "`n[2/3] Creating new version snapshot..." -ForegroundColor Cyan
$timestamp     = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$versionOutput = clasp version "Deploy $timestamp" | Out-String
Write-Host $versionOutput.Trim()

if ($versionOutput -match "Created version (\d+)") {
    $versionNum = $matches[1]
    Write-Host "      OK - Version $versionNum created." -ForegroundColor Green

    # --- Step 3: Update the live Web App deployment ---
    Write-Host "`n[3/3] Updating Web App to Version $versionNum..." -ForegroundColor Cyan
    clasp deploy -i $DEPLOYMENT_ID -V $versionNum -d "v$versionNum ($timestamp)"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      FAILED - Deploy failed. Check clasp output above." -ForegroundColor Red
        exit 1
    }
    Write-Host "      OK - Deployment updated to Version $versionNum." -ForegroundColor Green
} else {
    Write-Host "`n[3/3] Version number not parsed -- forcing redeploy of HEAD..." -ForegroundColor Yellow
    clasp deploy -i $DEPLOYMENT_ID
    Write-Host "      OK - Redeployed (no version pin)." -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor DarkCyan
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host ""
Write-Host "  Web App URL:" -ForegroundColor White
Write-Host "  $WEB_APP_URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "  REMINDER: Access must be 'Anyone (anonymous)'" -ForegroundColor Magenta
Write-Host "  GAS Editor -> Deploy -> Manage Deployments" -ForegroundColor Magenta
Write-Host "  -> Edit (pencil icon) -> Who has access = Anyone" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor DarkCyan
Write-Host ""
