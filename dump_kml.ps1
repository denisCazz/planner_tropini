Add-Type -AssemblyName System.IO.Compression.FileSystem
$kmzPath = "C:\Users\U1795\Desktop\bitora_clienti\planner_tropini\public\location\11_04_2026.kmz"
$zip = [System.IO.Compression.ZipFile]::OpenRead($kmzPath)
foreach ($entry in $zip.Entries) {
    if ($entry.Name -like "*.kml") {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close(); $stream.Close()
        Write-Host "--- KML CONTENT START ---"
        Write-Host $content
        Write-Host "--- KML CONTENT END ---"
    }
}
$zip.Dispose()
