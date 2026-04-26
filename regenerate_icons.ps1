Add-Type -AssemblyName System.Drawing

$logoPath = "C:\Users\gabog\OneDrive\Documentos\Claude\LibreMarkdown\Logo.png"
$iconsDir = "C:\Users\gabog\OneDrive\Documentos\Claude\LibreMarkdown\src-tauri\icons"

# Load logo
$logo = [System.Drawing.Image]::FromFile($logoPath)

# Generate icons at larger sizes
$sizes = @(16, 32, 48, 64, 128, 256)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($logo, 0, 0, $size, $size)
    $g.Dispose()

    $pngPath = Join-Path $iconsDir "${size}x${size}.png"
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created ${size}x${size}.png"
}

# Create 256x256 icon.ico
$bmp256 = New-Object System.Drawing.Bitmap(256, 256)
$g256 = [System.Drawing.Graphics]::FromImage($bmp256)
$g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g256.DrawImage($logo, 0, 0, 256, 256)
$g256.Dispose()
$logo.Dispose()

$icon = [System.Drawing.Icon]::FromHandle($bmp256.GetHicon())
$icoPath = Join-Path $iconsDir "icon.ico"
$fs = [System.IO.FileStream]::new($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp256.Dispose()

Write-Host "Created icon.ico (256x256)"
Write-Host "All icons regenerated!"