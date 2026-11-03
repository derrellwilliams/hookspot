import SwiftUI

/// The one glass recipe (web: `composes: glassSurface from shared.module.css`). Only for
/// chrome floating above content (toast) — content controls use tinted styles (Controls.swift).
/// Liquid Glass normally; solid surface when Reduce Transparency is on.
private struct GlassSurface<S: Shape>: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    let shape: S
    let interactive: Bool

    func body(content: Content) -> some View {
        if reduceTransparency {
            content.background(Theme.glassSolid, in: shape)
                .overlay(shape.stroke(Theme.darkBorder, lineWidth: 0.5))
        } else {
            content.glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        }
    }
}

extension View {
    func glassSurface<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        modifier(GlassSurface(shape: shape, interactive: interactive))
    }

    func glassSurface(cornerRadius: CGFloat = 20, interactive: Bool = false) -> some View {
        glassSurface(in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous), interactive: interactive)
    }

}
