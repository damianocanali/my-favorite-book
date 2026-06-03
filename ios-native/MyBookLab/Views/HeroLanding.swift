// The cosmic landing hero — logo + gradient wordmark + subtitle.
// Mirrors the web app's LandingPage hero block (the part above the
// CTA buttons). Used as the default state on the Bookshelf tab
// (both signed-out and empty-shelf) so the first thing the user
// sees feels like a magical invitation.
import SwiftUI

struct HeroLanding: View {
    var subtitle: String = "Create your own story in the stars ✨"
    /// Optional custom CTA action. When nil, the button switches to the
    /// Create tab (used on the Books landing). When provided (e.g. on
    /// the Create tab itself), it runs this instead — typically to
    /// start the wizard in place.
    var onCreate: (() -> Void)? = nil

    @Environment(AppRouter.self) private var router
    @State private var logoPulse = false
    @State private var ctaWiggle: Double = 0

    var body: some View {
        VStack(spacing: 20) {
            // Glowing logo
            ZStack {
                // Soft outer halo
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.purple.opacity(0.55), .clear],
                            center: .center,
                            startRadius: 10,
                            endRadius: 200
                        )
                    )
                    .frame(width: 380, height: 380)
                    .scaleEffect(logoPulse ? 1.05 : 0.95)
                    .blur(radius: 8)

                Image("AppLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 160, height: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                    .shadow(color: .purple.opacity(0.7), radius: 28, y: 8)
                    .scaleEffect(logoPulse ? 1.02 : 1.0)
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: true)) {
                    logoPulse = true
                }
            }

            // Gradient wordmark
            Text("My Book Lab")
                .font(.system(size: 56, weight: .heavy, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(red: 0.40, green: 0.85, blue: 1.00),   // sky blue
                            Color(red: 0.65, green: 0.55, blue: 1.00),   // periwinkle
                            Color(red: 0.85, green: 0.65, blue: 0.95),   // soft pink-violet
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: .purple.opacity(0.4), radius: 14, y: 4)
                .multilineTextAlignment(.center)
                .padding(.top, 8)

            Text(subtitle)
                .font(.system(.title3, design: .rounded))
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            SparkleButton(action: {
                if let onCreate {
                    onCreate()
                } else {
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.7)) {
                        router.selectedTab = .create
                    }
                }
            }, size: .large) {
                HStack(spacing: 8) {
                    Text("Create a Book")
                    Text("📖").rotationEffect(.degrees(ctaWiggle))
                }
            }
            .padding(.horizontal, 32)
            .padding(.top, 12)
            .onAppear { startWiggle() }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 40)
    }

    // Periodic book-emoji wobble to invite a tap. Subtle — every ~3
    // seconds the book gives a little wave.
    private func startWiggle() {
        Task { @MainActor in
            while true {
                try? await Task.sleep(nanoseconds: 3_500_000_000)
                withAnimation(.interpolatingSpring(stiffness: 250, damping: 6)) {
                    ctaWiggle = 18
                }
                try? await Task.sleep(nanoseconds: 250_000_000)
                withAnimation(.interpolatingSpring(stiffness: 250, damping: 8)) {
                    ctaWiggle = 0
                }
            }
        }
    }
}
