import Foundation
import Observation

/// Cross-tab navigation requests — currently incoming share/profile links.
@Observable
final class Router {
    /// Set by `.onOpenURL`; consumed (and cleared) by the Catches tab.
    var pendingLink: DeepLink?
}
