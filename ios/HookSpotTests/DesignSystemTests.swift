import Testing
@testable import HookSpot

@Suite struct PixelFishLoaderTests {
    @Test func easeInOutEndpoints() {
        #expect(abs(PixelFishLoader.cssEaseInOut(0)) < 1e-4)
        #expect(abs(PixelFishLoader.cssEaseInOut(1) - 1) < 1e-4)
        #expect(abs(PixelFishLoader.cssEaseInOut(0.5) - 0.5) < 1e-4)
    }

    @Test func keyframesMatchCSS() {
        // Tail group (index 11) has zero delay; at 6% of 2s it's at the flash peak.
        let peak = PixelFishLoader.frame(at: 0.12, index: 11)
        #expect(abs(peak.scale - 1.2) < 1e-3 && abs(peak.flash - 1) < 1e-3)
        let rest = PixelFishLoader.frame(at: 1.0, index: 11)
        #expect(rest == .init(opacity: 1, scale: 1, flash: 0))
        let dim = PixelFishLoader.frame(at: 0, index: 11)
        #expect(abs(dim.opacity - 0.14) < 1e-3)
        // Head (index 0) waits 11 × 90 ms showing its base style, like CSS fill-mode none.
        #expect(PixelFishLoader.frame(at: 0.5, index: 0) == .init(opacity: 1, scale: 1, flash: 0))
    }
}
