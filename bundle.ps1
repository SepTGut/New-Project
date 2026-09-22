#!/usr/bin/env pwsh
# ================================================================
#  Smart Warehouse Bundle Creator
#  Creates a deployable zip that INCLUDES WhatsApp auth session
#  so the bot doesn't need to re-scan QR on the target machine.
#
#  Usage:
#    .\bundle.ps1                   # Creates smart-warehouse-bundle.zip
#    .\bundle.ps1 -NoAuth           # Excludes auth (fresh scan required)
#    .\bundle.ps1 -Output "my.zip"  # Custom output filename
# ================================================================

param(
    [switch]$NoAuth,
    [string]$Output = "smart-warehouse-bundle.zip"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$Root     = $PSScriptRoot
$ZipPath  = Join-Path $Root $Output
$TempDir  = Join-Path $env:TEMP "smart-warehouse-bundle-temp"

# --- Clean up any previous temp ---
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Path $TempDir | Out-Null

Write-Host ""
Write-Host "=============================================="
Write-Host "  Smart Warehouse Bundle Creator"
Write-Host "=============================================="
Write-Host ""

# --- Folders/files to always EXCLUDE ---
$ExcludePatterns = @(
    'node_modules',
    '.git',
    '.gitignore',
    '*.zip',
    'dist',
    'build',
    '.vscode',
    '.idea',
    '*.log',
    '.playwright-mcp',
    'playwright-report',
    'test-results',
    'scratch',
    'ServerWAbotPPO',
    'smart-warehouse-bundle-withauth',
    '*bundle-withauth*',
    '.env.example',      # We include actual .env files (they have real config)
    'GAS'                # GAS is deployed to Google, not needed at runtime
)

if ($NoAuth) {
    $ExcludePatterns += 'auth_info_baileys'
    Write-Host "⚠  -NoAuth flag set: auth_info_baileys will NOT be included."
    Write-Host "   The bot will show a QR code for fresh pairing on first start."
} else {
    Write-Host "✅ Auth session (auth_info_baileys) WILL be included."
    Write-Host "   The bot should connect automatically without QR scan."
}

Write-Host ""

function Should-Exclude($RelPath) {
    foreach ($pat in $ExcludePatterns) {
        # Match directory name or file pattern anywhere in path
        $parts = $RelPath -split '[/\\]'
        foreach ($part in $parts) {
            if ($part -like $pat) { return $true }
        }
        if ($RelPath -like $pat) { return $true }
    }
    return $false
}

function Copy-ItemFiltered($Source, $Dest) {
    Get-ChildItem -Path $Source -Force | ForEach-Object {
        $rel = $_.FullName.Substring($Source.Length).TrimStart('\','/')
        if (Should-Exclude $rel) {
            Write-Host "  SKIP  $rel"
            return
        }
        $target = Join-Path $Dest $rel
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
            Copy-ItemFiltered $_.FullName $Dest
        } else {
            $targetDir = Split-Path $target
            if (-not (Test-Path $targetDir)) {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            }
            Copy-Item $_.FullName $target -Force
        }
    }
}

# --- Copy whole project tree into temp, filtered ---
Write-Host "Copying project files..."
Get-ChildItem -Path $Root -Force | ForEach-Object {
    $name = $_.Name
    if (Should-Exclude $name) {
        Write-Host "  SKIP  $name"
        return
    }
    $target = Join-Path $TempDir $name
    if ($_.PSIsContainer) {
        # For directories, do a deep copy with inner filtering
        $src = $_.FullName
        Get-ChildItem -Path $src -Recurse -Force | ForEach-Object {
            $rel = $_.FullName.Substring($src.Length).TrimStart('\','/')
            if (Should-Exclude $rel) {
                return
            }
            $dest = Join-Path $target $rel
            if ($_.PSIsContainer) {
                New-Item -ItemType Directory -Path $dest -Force | Out-Null
            } else {
                $destDir = Split-Path $dest
                if (-not (Test-Path $destDir)) {
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
                Copy-Item $_.FullName $dest -Force
            }
        }
        # Make sure the folder itself exists even if empty
        if (-not (Test-Path $target)) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
        }
    } else {
        Copy-Item $_.FullName $target -Force
        Write-Host "  COPY  $name"
    }
}

# --- Ensure placeholder dirs exist ---
$placeholders = @(
    "data\ppo\foto-laporan",
    "wabot\auth_info_baileys"
)
foreach ($p in $placeholders) {
    $pd = Join-Path $TempDir $p
    if (-not (Test-Path $pd)) {
        New-Item -ItemType Directory -Path $pd -Force | Out-Null
        # Create .gitkeep placeholder
        "" | Out-File (Join-Path $pd ".gitkeep")
    }
}

# --- Remove old zip if exists ---
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

# --- Zip the temp folder ---
Write-Host ""
Write-Host "Creating zip archive: $Output ..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($TempDir, $ZipPath)

# --- Cleanup temp ---
Remove-Item $TempDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "=============================================="
Write-Host "  Bundle created: $Output ($sizeMB MB)"
if (-not $NoAuth) {
    Write-Host ""
    Write-Host "  ⚠  SECURITY NOTE:"
    Write-Host "  This bundle contains WhatsApp session credentials."
    Write-Host "  Transfer securely (not via public channels)."
    Write-Host "  Do NOT commit to git."
}
Write-Host ""
Write-Host "  On the target machine:"
Write-Host "  1. Extract the zip"
Write-Host "  2. Run: docker compose up -d --build"
Write-Host "     (or: .\start.bat  /  bash start.sh)"
Write-Host "=============================================="
Write-Host ""
