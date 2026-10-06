$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'sprites\Sans.png'
$pikminSheetPath = Join-Path $root 'sprites\pikmine sprites.png'
$assetPath = Join-Path $root 'assets'

$extractor = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class SpriteSheetExtractor
{
    public static void Extract(string sourcePath, string outputPath, int x, int y, int width, int height)
    {
        using (var source = new Bitmap(sourcePath))
        using (var image = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(image))
        {
            graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
            graphics.PixelOffsetMode = PixelOffsetMode.Half;
            graphics.DrawImage(source, new Rectangle(0, 0, width, height),
                new Rectangle(x, y, width, height), GraphicsUnit.Pixel);

            int length = width * height;
            var background = new bool[length];
            var queue = new int[length];
            int tail = 0;

            for (int px = 0; px < width; px++)
            {
                EnqueueIfPaper(image, px, queue, ref tail, background, width);
                EnqueueIfPaper(image, (height - 1) * width + px, queue, ref tail, background, width);
            }
            for (int py = 1; py < height - 1; py++)
            {
                EnqueueIfPaper(image, py * width, queue, ref tail, background, width);
                EnqueueIfPaper(image, py * width + width - 1, queue, ref tail, background, width);
            }

            int head = 0;
            while (head < tail)
            {
                int i = queue[head++];
                int px = i % width;
                int py = i / width;
                if (px > 0) EnqueueIfPaper(image, i - 1, queue, ref tail, background, width);
                if (px + 1 < width) EnqueueIfPaper(image, i + 1, queue, ref tail, background, width);
                if (py > 0) EnqueueIfPaper(image, i - width, queue, ref tail, background, width);
                if (py + 1 < height) EnqueueIfPaper(image, i + width, queue, ref tail, background, width);
            }

            for (int py = 0; py < height; py++)
            for (int px = 0; px < width; px++)
            {
                int i = py * width + px;
                if (!background[i]) continue;
                Color pixel = image.GetPixel(px, py);
                int alpha = 255 - (pixel.R + pixel.G + pixel.B) / 3;
                image.SetPixel(px, py, Color.FromArgb(alpha, 0, 0, 0));
            }
            image.Save(outputPath, ImageFormat.Png);
        }
    }

    private static void EnqueueIfPaper(Bitmap image, int i, int[] queue, ref int tail, bool[] seen, int width)
    {
        if (seen[i]) return;
        int x = i % width;
        int y = i / width;
        Color p = image.GetPixel(x, y);
        if (p.R < 238 || p.G < 238 || p.B < 238) return;
        seen[i] = true;
        queue[tail++] = i;
    }
}
'@

$references = @(
    [System.Drawing.Bitmap].Assembly.Location,
    [System.Drawing.Color].Assembly.Location,
    [System.Runtime.GCSettings].Assembly.Location,
    (Join-Path (Split-Path ([System.Drawing.Bitmap].Assembly.Location)) 'System.Private.Windows.GdiPlus.dll'),
    (Join-Path (Split-Path ([System.Drawing.Bitmap].Assembly.Location)) 'System.Private.Windows.Core.dll')
)
Add-Type -TypeDefinition $extractor -ReferencedAssemblies $references
[SpriteSheetExtractor]::Extract($sourcePath, (Join-Path $assetPath 'sans-standing.png'), 0, 0, 240, 330)
[SpriteSheetExtractor]::Extract($sourcePath, (Join-Path $assetPath 'sans-attack-a.png'), 785, 795, 310, 330)
[SpriteSheetExtractor]::Extract($sourcePath, (Join-Path $assetPath 'sans-shrug.png'), 1747, 438, 253, 328)

[SpriteSheetExtractor]::Extract($pikminSheetPath, (Join-Path $assetPath 'pikmin-flower.png'), 235, 181, 25, 19)
$captainFrames = @(
    @{ Name = 'olimar-idle-1.png'; X = 16 },
    @{ Name = 'olimar-idle-2.png'; X = 52 },
    @{ Name = 'olimar-idle-3.png'; X = 88 },
    @{ Name = 'olimar-idle-4.png'; X = 124 },
    @{ Name = 'olimar-idle-5.png'; X = 160 }
)
foreach ($frame in $captainFrames) {
    [SpriteSheetExtractor]::Extract($pikminSheetPath, (Join-Path $assetPath $frame.Name), $frame.X, 309, 36, 55)
}
