import SwiftUI
import UIKit

/// iOS 27's `UITabBarController.prominentTabIdentifier` detaches a tab into its own glass
/// button. SwiftUI has no modifier for it yet, so this reaches the hosting tab bar controller
/// and marks the tab whose title matches. Harmless no-op if the lookup ever fails.
/// On iOS 26 the tab's `.search` role gives it the detached treatment instead.
private struct ProminentTabSetter: UIViewControllerRepresentable {
    let title: String

    func makeUIViewController(context: Context) -> Probe { Probe(title: title) }
    func updateUIViewController(_ vc: Probe, context: Context) { vc.apply() }

    final class Probe: UIViewController {
        let title_: String
        init(title: String) { title_ = title; super.init(nibName: nil, bundle: nil) }
        required init?(coder: NSCoder) { fatalError() }

        override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); apply() }

        func apply() {
            guard #available(iOS 27.0, *),
                  let tbc = tabBarController ?? findTabBarController(from: view.window?.rootViewController),
                  let tab = tbc.tabs.first(where: { $0.title == title_ }),
                  tbc.prominentTabIdentifier != tab.identifier else { return }
            tbc.prominentTabIdentifier = tab.identifier
        }

        private func findTabBarController(from vc: UIViewController?) -> UITabBarController? {
            guard let vc else { return nil }
            if let tbc = vc as? UITabBarController { return tbc }
            for child in vc.children { if let found = findTabBarController(from: child) { return found } }
            return findTabBarController(from: vc.presentedViewController)
        }
    }
}

extension View {
    /// Detach the tab with this title (iOS 27 prominent tab).
    func prominentTab(titled title: String) -> some View {
        background(ProminentTabSetter(title: title).frame(width: 0, height: 0).accessibilityHidden(true))
    }
}
