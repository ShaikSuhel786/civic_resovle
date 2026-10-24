Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Admin\.gemini\antigravity-ide\brain\aae40ac5-28ba-42c2-a2e4-cf79bd58225c\.user_uploaded\media_1792869350437.jpg"
$outDir = "C:\Users\Admin\Desktop\civic_resolvers\civic_resovle\public\images"
if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}
$outPath = Join-Path $outDir "logo.png"

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

# Bounding box with 20px padding
$pad = 24
$minX = [Math]::Max(0, 348 - $pad)
$maxX = [Math]::Min($bmp.Width - 1, 675 + $pad)
$minY = [Math]::Max(0, 219 - $pad)
$maxY = [Math]::Min($bmp.Height - 1, 804 + $pad)

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1

$cropped = New-Object System.Drawing.Bitmap $cropW, $cropH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
        $origC = $bmp.GetPixel($minX + $x, $minY + $y)
        
        # Calculate color difference from white (255, 255, 255)
        # Background is white (#FFFFFF or very close to #FAFAFA)
        # Mark is blue (#0033CC / #0B3BCE)
        $diff = (255 - $origC.R) + (255 - $origC.G) + (255 - $origC.B)
        
        # Also check if it's watermark text (light gray text has R,G,B around 230-245 with low diff)
        # The blue mark has B significantly higher than R (e.g. B > R + 25)
        $isBlue = ($origC.B -gt ($origC.R + 20))
        
        if ($isBlue -and $diff -gt 60) {
            # Compute alpha smoothly for antialiasing
            $alpha = [Math]::Min(255, [Math]::Max(0, [int]($diff * 1.5)))
            $newC = [System.Drawing.Color]::FromArgb($alpha, $origC.R, $origC.G, $origC.B)
            $cropped.SetPixel($x, $y, $newC)
        } else {
            # Completely transparent
            $cropped.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}

$cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$cropped.Dispose()
$bmp.Dispose()

Write-Output "Successfully saved cropped transparent logo to: $outPath ($cropW x $cropH)"
