// Tiny app-wide router. Owns the selected tab so any view in the tree
// can switch tabs programmatically (e.g. the hero landing's "Start a
// new book" button hands off to the Create tab).
import Observation
import SwiftUI

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

    /// Where the sign-in flow is, held here rather than in the flow's own
    /// @State so a language switch (which rebuilds the view tree) keeps the
    /// screen.
    ///
    /// Sign-in is never presented (no sheet, no cover). Signed out, the
    /// app's root IS the sign-in flow (MyBookLabApp's AppRootView); a guest
    /// who chose "Explore first" gets the tabs, and their Account tab shows
    /// the same flow inline.
    var signInDoor: SignInDoor?
    /// On a class iPad: "Not in <class>?" showed the welcome screen.
    var signInWelcomeOverClass = false

    /// A guest chose "Explore first": the root shows the tabs instead of
    /// the sign-in flow. Reset on any sign-in or sign-out.
    var guestExploring = false

    /// A guest's "Sign in" button (Bookshelf, Create): the sign-in flow is
    /// inline in the Account tab, so go there. A door already in progress
    /// (and whatever was typed in it) is kept.
    func openSignIn() {
        selectedTab = .account
    }

    /// Signed in: the flow's screen state is spent.
    func signedIn() {
        guestExploring = false
        resetSignInFlow()
    }

    /// "Explore first".
    func exploreAsGuest() {
        resetSignInFlow()
        guestExploring = true
    }

    /// The signed-in person is gone (sign-out or an expired session). The
    /// root follows the session on its own, so there is nothing to present:
    /// the next person starts at the front door (on a class iPad, the
    /// class's name list).
    func sessionEnded() {
        guestExploring = false
        // On a class iPad the next child must never see the previous
        // child's check-in, break or "teacher is coming" screen.
        CheckInStore.shared.closeForSessionEnd()
        resetSignInFlow()
    }

    private func resetSignInFlow() {
        signInDoor = nil
        signInWelcomeOverClass = false
    }
}

enum SignInDoor: Hashable, Sendable { case student, family, teacher }
