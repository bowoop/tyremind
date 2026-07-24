if (!(Test-Path .gitignore)) { New-Item -Path .gitignore -ItemType File -Force | Out-Null }
if (-not (Select-String -Path .gitignore -Pattern 'tyre-jsx-backup*.zip' -SimpleMatch -Quiet)) { Add-Content -Path .gitignore -Value 'tyre-jsx-backup*.zip' }
# Try to commit .gitignore if changed
try { git add .gitignore; git commit -m 'chore: ignore tyre-jsx backup zips' -q } catch {}

$now = Get-Date -Format yyyyMMdd
$zip = "tyre-jsx-backup-$now.zip"
$files = Get-ChildItem -Path src -Include '*.js','*.jsx' -Recurse -File
if ($files.Count -gt 0) {
    Compress-Archive -Path ($files | Select-Object -ExpandProperty FullName) -DestinationPath $zip -Force
    $z = Get-Item $zip
    Write-Output "Created: $($z.FullName) ($([Math]::Round($z.Length/1KB,2)) KB)"
    $files | ForEach-Object { Write-Output $_.FullName }
} else {
    Write-Output "No .js/.jsx files found"
}
