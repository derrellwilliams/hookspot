// Renders the Hook Spot app icon: PixelFishLoader's 12-pixel fish (white) on darkBg #1A1953.
//   swift ios/scripts/gen-app-icon.swift "$PWD/ios/HookSpot/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let unit = 32.0                    // 24-grid cell → px; fish spans 20×14 cells = 640×448
let ox = (1024.0 - 20 * unit) / 2 - 2 * unit
let oy = (1024.0 - 14 * unit) / 2 - 5 * unit
let rects: [(Double, Double, Double, Double)] = [
    (20, 9, 2, 6), (18, 15, 2, 2), (18, 7, 2, 2), (15, 10, 2, 2), (12, 17, 6, 2), (12, 5, 6, 2),
    (10, 15, 2, 2), (10, 7, 2, 2), (8, 13, 2, 2), (8, 9, 2, 2), (6, 11, 2, 2),
    (2, 7, 2, 10), (4, 9, 2, 2), (4, 13, 2, 2),
]
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.setFillColor(CGColor(srgbRed: 0x1A / 255.0, green: 0x19 / 255.0, blue: 0x53 / 255.0, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
ctx.setShouldAntialias(false)
for (x, y, w, h) in rects {
    // CG origin is bottom-left; the SVG grid is top-left.
    ctx.fill(CGRect(x: ox + x * unit, y: Double(size) - (oy + (y + h) * unit), width: w * unit, height: h * unit))
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote", url.path)
