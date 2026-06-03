// Tiny app-wide router. Owns the selected tab so any view in the tree
// can switch tabs programmatically (e.g. the hero landing's "Start a
// new book" button hands off to the Create tab).
import Foundation
import Observation

enum AppTab: Int, Hashable, Sendable {
    case books = 0
    case gallery = 1
    case create = 2
    case orders = 3
    case account = 4
}

@Observable
@MainActor
final class AppRouter {
    static let shared = AppRouter()
    // Land on the middle Create tab — it greets the user with the
    // "My Book Lab" hero + subtitle and the Create-a-Book CTA.
    var selectedTab: AppTab = .create
}
