# Build a CWS-ready zip of the Chrome extension.
# Run from the repo root: .\package-extension.ps1
# Output: voxrate-extension.zip (in repo root)

$SRC  = Join-Path $PSScriptRoot "chrome-extension"
$OUT  = Join-Path $PSScriptRoot "voxrate-extension.zip"

if (!(Test-Path $SRC)) {
  Write-Error "chrome-extension folder not found at $SRC"
  exit 1
}

# Remove any previous build
if (Test-Path $OUT) { Remove-Item $OUT -Force }

# Files to include (exclude dev-only files)
$EXCLUDE = @("*.ps1", "*.sh", ".DS_Store", "Thumbs.db", "*.map")

$files = Get-ChildItem -Path $SRC -Recurse -File | Where-Object {
  $name = $_.Name
  -not ($EXCLUDE | Where-Object { $name -like $_ })
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($OUT, 'Create')
foreach ($file in $files) {
  $rel = $file.FullName.Substring($SRC.Length + 1)
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $rel)
}
$zip.Dispose()

$sizeMB = [math]::Round((Get-Item $OUT).Length / 1MB, 2)
Write-Host "✓ Packaged $($files.Count) files → voxrate-extension.zip ($sizeMB MB)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Go to https://chrome.google.com/webstore/devconsole"
Write-Host "  2. Select the Voxrate extension"
Write-Host "  3. Upload voxrate-extension.zip as a new package"
Write-Host "  4. Submit for review (1-3 business days)"
