import UIKit
import ObjectiveC

/// Detaches the "+" tab into its own glass button.
///
/// iOS 27 does this through `UITabBarController.prominentTabIdentifier`, which SwiftUI has
/// no modifier for yet — and SwiftUI clears it whenever it refreshes the tab bar. So the two
/// setters are swapped once at launch: whenever anything sets the prominent tab to nil, the
/// tab titled `addTitle` is substituted. On iOS 26 the tab's `.search` role detaches it.
enum ProminentTab {
    static let addTitle = "Add Catch"

    @MainActor static func install() {
        guard #available(iOS 27.0, *) else { return }
        swap(#selector(setter: UITabBarController.prominentTabIdentifier),
             #selector(UITabBarController.hs_setProminentTabIdentifier(_:)))
        swap(#selector(UITabBarController.setProminentTabIdentifier(_:animated:)),
             #selector(UITabBarController.hs_setProminentTabIdentifier(_:animated:)))
    }

    private static func swap(_ original: Selector, _ replacement: Selector) {
        guard let a = class_getInstanceMethod(UITabBarController.self, original),
              let b = class_getInstanceMethod(UITabBarController.self, replacement) else { return }
        method_exchangeImplementations(a, b)
    }
}

@available(iOS 27.0, *)
extension UITabBarController {
    fileprivate var hs_addTabIdentifier: String? {
        tabs.first { $0.title == ProminentTab.addTitle }?.identifier
    }

    // After the swap, calling hs_* invokes UIKit's original implementation.
    @objc fileprivate func hs_setProminentTabIdentifier(_ identifier: String?) {
        hs_setProminentTabIdentifier(identifier ?? hs_addTabIdentifier)
    }

    @objc fileprivate func hs_setProminentTabIdentifier(_ identifier: String?, animated: Bool) {
        hs_setProminentTabIdentifier(identifier ?? hs_addTabIdentifier, animated: animated)
    }
}
