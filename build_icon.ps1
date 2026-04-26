Add-Type -AssemblyName System.Drawing

$logoPath = "C:\Users\gabog\OneDrive\Documentos\Claude\LibreMarkdown\Logo.png"
$icoPath = "C:\Users\gabog\OneDrive\Documentos\Claude\LibreMarkdown\src-tauri\icons\icon.ico"

# Load logo and resize to 32x32
$logo = [System.Drawing.Image]::FromFile($logoPath)
$bmp = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($logo, 0, 0, 32, 32)
$g.Dispose()
$logo.Dispose()

# Create icon from bitmap
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

# Save to file
$fs = [System.IO.FileStream]::new($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp.Dispose()

Write-Host "icon.ico created successfully!"