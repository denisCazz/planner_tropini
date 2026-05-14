Add-Type -AssemblyName System.IO.Compression.FileSystem
$kmzPath = "C:\Users\U1795\Desktop\bitora_clienti\planner_tropini\public\location\11_04_2026.kmz"
$zip = [System.IO.Compression.ZipFile]::OpenRead($kmzPath)
foreach ($entry in $zip.Entries) {
    if ($entry.Name -like "*.kml") {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close(); $stream.Close()
        
        $placemarks = [regex]::Matches($content, '<Placemark>.*?</Placemark>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        foreach ($pm in $placemarks) {
            $val = $pm.Value
            $name = if ($val -match '<name>(.*?)</name>') { $Matches[1] } else { "" }
            $desc = if ($val -match '<description>(.*?)</description>') { $Matches[1] } else { "" }
            $coord = if ($val -match '<coordinates>(.*?)</coordinates>') { $Matches[1] } else { "" }
            
            Write-Host "=== NAME: $($name.Trim()) ==="
            Write-Host "FULL DESC:"
            Write-Host $desc.Trim()
            Write-Host "COORDS: $($coord.Trim())"
            Write-Host ""
        }
    }
}
$zip.Dispose()
