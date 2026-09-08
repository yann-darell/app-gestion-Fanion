Add-Type -AssemblyName System.Drawing

$sourcePath = "packages/web/public/logo_fanion.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file not found: $sourcePath"
    exit 1
}

$srcImage = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

function Resize-Image($src, $size, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($src, 0, 0, $size, $size)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $destPath ($size x $size)"
}

Resize-Image $srcImage 192 "packages/web/public/icon-192.png"
Resize-Image $srcImage 512 "packages/web/public/icon-512.png"
$srcImage.Dispose()
