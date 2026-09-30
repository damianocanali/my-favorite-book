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
    /// The class account already sent to its home (Books) this launch.
    /// Lives here, outside the view tree, because the root is rebuilt on a
    /// language switch and must not yank the child back to Books then.
    @ObservationIgnored var studentHomeLandedFor: UUID?

    /// The full-screen sign-in flow. One cover, owned by the app root
    /// (MyBookLabApp), never a sheet: on iPad a tap outside a sheet
    /// dismissed it and lost everything typed. Every "Sign in" button and
    /// every gated action asks for it here.
    var signInPresented = false

    func presentSignIn() { signInPresented = true }
    func dismissSignIn() { signInPresented = false }
}
