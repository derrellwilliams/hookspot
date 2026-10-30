import SwiftUI

/// Roboto / Roboto Condensed / Roboto Mono / Geist Pixel, bundled (Resources/Fonts, UIAppFonts).
/// Every style is `relativeTo:` a text style, so Dynamic Type still scales it.
enum Typography {
    enum Family: String {
        case sans = "Roboto"
        case condensed = "Roboto Condensed"
        case mono = "Roboto Mono"
        case display = "GeistPixel-Regular"
    }

    static func font(_ family: Family, _ size: CGFloat, _ weight: Font.Weight = .regular,
                     relativeTo style: Font.TextStyle = .body) -> Font {
        Font.custom(family.rawValue, size: size, relativeTo: style).weight(weight)
    }

    // Named styles (CSS values from the matching .module.css)
    static let wordmark = font(.display, 34, relativeTo: .largeTitle)
    static let title = font(.sans, 22, .bold, relativeTo: .title2)
    static let headline = font(.sans, 17, .semibold, relativeTo: .headline)
    static let body = font(.sans, 16, relativeTo: .body)
    static let cardSpecies = font(.sans, 16, .semibold, relativeTo: .headline)
    static let cardAngler = font(.condensed, 12, relativeTo: .caption)
    static let cardMeta = font(.mono, 11, relativeTo: .caption2)
    static let caption = font(.sans, 13, relativeTo: .footnote)
    static let label = font(.condensed, 13, .medium, relativeTo: .subheadline)
}
