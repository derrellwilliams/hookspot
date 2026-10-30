import SwiftUI

/// Mirror of src/tokens.js / style.css custom properties. The single place colors live —
/// views use `Theme.*`, never inline hex (same rule as the web's .module.css files).
enum Theme {
    static let accent = Color(hex: 0x2563EB)
    static let accentBright = Color(hex: 0x7FB2FF)   // PixelFishLoader flash highlight
    static let iosBlue = Color(hex: 0x0A84FF)        // selected-control tint on glass

    static let darkBg = Color(hex: 0x1A1953)
    static let uiBg = Color(hex: 0x202020)
    static let darkSurface = Color(hex: 0x2C2C2E)
    static let darkBorder = Color(hex: 0x3A3A3C)
    static let darkText = Color(hex: 0xF4F4F5)
    static let darkMuted = Color(hex: 0xA1A1AA)

    /// Glass fallback when Reduce Transparency is on (--glass-tip-bg).
    static let glassSolid = Color(red: 22 / 255, green: 22 / 255, blue: 24 / 255, opacity: 0.96)
    static let avatarFallback = Color.white.opacity(0.08)

    // DitherMesh (src/components/DitherMesh.jsx)
    static let ditherBack = Color(hex: 0x1A1952)
    static let ditherFront = Color(hex: 0x2E2E76)

    // Skeleton shimmer stops (CatchGrid.module.css)
    static let skeletonBase = Color(hex: 0x1C1C20)
    static let skeletonHighlight = Color(hex: 0x222228)

    // Stats chart blues (src/stats.js BLUES)
    static let chartBlues: [Color] = [0x2563EB, 0x3B82F6, 0x60A5FA, 0x93C5FD, 0xBFDBFE].map { Color(hex: $0) }

    static let radius: CGFloat = 8
    static let cardRadius: CGFloat = 16
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }

    /// sRGB components for passing to Metal shaders without color-space conversion.
    var srgbComponents: SIMD4<Float> {
        let r = resolve(in: EnvironmentValues())
        return SIMD4(r.red, r.green, r.blue, r.opacity)
    }
}
