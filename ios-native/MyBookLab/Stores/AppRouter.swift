// Tiny app-wide router. Owns the selected tab so any view in the tree
// can switch tabs programmatically (e.g. the hero landing's "Start a
// new book" button hands off to the Create tab).
import Observation
import SwiftUI
import UIKit

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
    /// Whether the cover is actually on screen (SignInFlowView reports it).
    /// `signInPresented` can be true while nothing shows — SwiftUI drops a
    /// presentation requested while another sheet is up — and then setting
    /// it to true again changes nothing. This is how that gets noticed.
    var signInShowing = false

    /// Where the flow is, held here rather than in the flow's own @State so
    /// a language switch (which rebuilds the flow) keeps the screen.
    var signInDoor: SignInDoor?
    /// On a class iPad: "Not in <class>?" showed the welcome screen.
    var signInWelcomeOverClass = false

    /// A guest chose "Explore first": don't push the welcome screen at them
    /// again when the app comes back to the front. Reset on any sign-in or
    /// sign-out.
    var guestExploring = false

    /// Bumped when the session ends. The root view is keyed on it, so the
    /// whole tree — and every sheet or cover a screen had open — is torn
    /// down, leaving nothing in the way of the sign-in cover.
    private(set) var sessionGeneration = 0

    func presentSignIn() {
        guestExploring = false
        if !signInPresented {
            signInDoor = nil
            signInWelcomeOverClass = false
            signInPresented = true
            scheduleVisibilityCheck()
        } else if !signInShowing {
            retries = 0
            retryPresentation()
        }
    }

    func dismissSignIn() {
        signInPresented = false
        signInDoor = nil
        signInWelcomeOverClass = false
    }

    /// "Explore first".
    func exploreAsGuest() {
        dismissSignIn()
        guestExploring = true
    }

    /// The signed-in person is gone (sign-out or an expired session).
    /// `stillSignedOut` is asked again after the pause: a class sign-in
    /// signs the previous person out first and the child in a moment later.
    func sessionEnded(stillSignedOut: @escaping @MainActor () -> Bool) {
        sessionGeneration += 1
        guestExploring = false
        // One beat for the rebuilt tree's presentations to finish going away.
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            if stillSignedOut() { self.presentSignIn() }
        }
    }

    /// Brought back to the front, signed out: recover a stuck request.
    func recheckSignIn(signedIn: Bool) {
        guard !signedIn, !guestExploring, !signInShowing else { return }
        presentSignIn()
    }

    private var retries = 0

    private func scheduleVisibilityCheck() {
        retries = 0
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(900))
            if self.signInPresented && !self.signInShowing { self.retryPresentation() }
        }
    }

    /// false → true on the next run loop, after dismissing whatever UIKit
    /// still has presented over the root.
    private func retryPresentation() {
        // Never while Apple / Google / Face ID has its own UI up.
        guard retries < 3, !signInShowing, AuthStore.shared.interactiveAuthInFlight == 0 else { return }
        retries += 1
        signInPresented = false
        Task { @MainActor in
            await self.dismissForeignPresentations()
            await Task.yield()
            self.signInPresented = true
            try? await Task.sleep(for: .milliseconds(900))
            if self.signInPresented && !self.signInShowing { self.retryPresentation() }
        }
    }

    /// The sign-in cover's hosting controller (SignInCoverMarker).
    @ObservationIgnored weak var signInHost: UIViewController?

    private func dismissForeignPresentations() async {
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController })
            .first,
              let presented = root.presentedViewController, !presented.isBeingDismissed
        else { return }
        // Re-checked right before dismissing: never the sign-in cover (or a
        // stack it is part of), never while it's reported on screen, never
        // during Apple / Google / Face ID sign-in.
        guard !signInShowing, AuthStore.shared.interactiveAuthInFlight == 0 else { return }
        var vc: UIViewController? = presented
        while let current = vc {
            if current === signInHost { return }
            vc = current.presentedViewController
        }
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            root.dismiss(animated: false) { done.resume() }
        }
    }
}

/// Invisible; records the sign-in cover's hosting (presented) controller in
/// AppRouter so the recovery can recognise it and leave it alone.
struct SignInCoverMarker: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> Marker { Marker() }
    func updateUIViewController(_ controller: Marker, context: Context) {}

    final class Marker: UIViewController {
        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            var top: UIViewController = self
            while let parent = top.parent { top = parent }
            AppRouter.shared.signInHost = top
        }
    }
}

enum SignInDoor: Hashable, Sendable { case student, family, teacher }
