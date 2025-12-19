param(
    [string]$Version = "dev"
)

$ErrorActionPreference = "Stop"

$ReleaseName = "breeze-cid-proxy-$Version"
$ReleaseDir = "dist/$ReleaseName"
$ZipPath = "dist/$ReleaseName.zip"

Write-Host "Building Release $ReleaseName"

#Clean dist
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

#Copy Required Items
Copy-Item app.js $ReleaseDir
Copy-Item .\package.json $ReleaseDir
Copy-Item .\package-lock.json $ReleaseDir
Copy-Item .\ecosystem.config.js $ReleaseDir
Copy-Item .\.env.example $ReleaseDir
Copy-Item -Recurse .\lib $ReleaseDir

# Create Zip
Compress-Archive -Path $ReleaseDir\* -DestinationPath $ZipPath -Force

Write-Host "Release created:"
Write-Host "$ZipPath"