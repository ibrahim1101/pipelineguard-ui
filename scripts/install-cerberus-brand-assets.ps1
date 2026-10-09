# Install the approved Cerberus artwork without redrawing or re-encoding it.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install-cerberus-brand-assets.ps1 -ZipPath "$env:USERPROFILE\Downloads\cerberus_brand_assets.zip"
param(
    [Parameter(Mandatory=$true)][string]$ZipPath
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path $ZipPath)) { throw "Asset ZIP not found: $ZipPath" }
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("cerberus-assets-" + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $temp | Out-Null
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $temp -Force
    $mapping = @{
        'cerberus-logo-original.png' = 'frontend/public/cerberus-logo-original.png'
        'cerberus-256.png' = 'frontend/public/cerberus-256.png'
        'cerberus-32.png' = 'frontend/public/cerberus-32.png'
        'icon.ico' = 'desktop/src-tauri/icons/icon.ico'
    }
    foreach ($source in $mapping.Keys) {
        $src = Join-Path $temp $source
        if (-not (Test-Path $src)) { throw "Missing expected file: $source" }
        $dst = Join-Path $repo $mapping[$source]
        New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
        Copy-Item -LiteralPath $src -Destination $dst -Force
        Write-Host "Installed $($mapping[$source])"
    }
    Write-Host "Assets installed locally. Review and commit them with git add/commit/push."
} finally {
    if (Test-Path $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
