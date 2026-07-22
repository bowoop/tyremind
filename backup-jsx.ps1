$files = Get-ChildItem -Path src -Include '*.js','*.jsx' -Recurse | Select-Object -ExpandProperty FullName
if ($files -and $files.Count -gt 0) {
    Compress-Archive -Path $files -DestinationPath tyre-jsx-backup.zip -Force
    $zip = Get-Item tyre-jsx-backup.zip
    Write-Output "Created: $($zip.FullName) ($([Math]::Round($zip.Length/1KB,2)) KB)"
    [System.IO.Compression.ZipFile]::OpenRead($zip.FullName).Entries | ForEach-Object { Write-Output $_.FullName }
} else {
    Write-Output "No .js/.jsx files found"
}
