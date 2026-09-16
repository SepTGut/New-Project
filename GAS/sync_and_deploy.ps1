# ==============================================================================
# 🚀 Sync and Update Deployment Script for Google Apps Script
# ==============================================================================
$DEPLOYMENT_ID = "AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7"

Write-Host "1/3 Pushing local modular files to Google Apps Script..." -ForegroundColor Cyan
clasp push

Write-Host "2/3 Creating new immutable version..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$versionOutput = clasp version "Update $timestamp" | Out-String
Write-Host $versionOutput.Trim()

if ($versionOutput -match "Created version (\d+)") {
    $versionNum = $matches[1]
    Write-Host "3/3 Updating active deployment ($DEPLOYMENT_ID) to Version $versionNum..." -ForegroundColor Cyan
    clasp deploy -i $DEPLOYMENT_ID -V $versionNum -d "Deployed version $versionNum ($timestamp)"
    Write-Host "`n✅ SUCCESS: Web app deployment is now live on Version $versionNum!" -ForegroundColor Green
} else {
    Write-Host "3/3 Redeploying active deployment..." -ForegroundColor Yellow
    clasp deploy -i $DEPLOYMENT_ID
    Write-Host "`n✅ Redeployed successfully!" -ForegroundColor Green
}
