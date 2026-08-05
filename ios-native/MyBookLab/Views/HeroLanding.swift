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
        GeometryReader { geo in
            // Roomy = genuinely an iPad (both dimensions large). iPhones in
            // landscape are wide but short, so gating on BOTH dimensions
            // keeps phone-landscape out of the iPad sizing branch.
            let isRegular = geo.size.width >= 700 && geo.size.height >= 700
            let isLandscape = geo.size.width > geo.size.height
            let m = heroMetrics(isRegular: isRegular, isLandscape: isLandscape)

            Group {
                if isLandscape {
                    HStack(spacing: 48) {
                        logoBlock(metrics: m)
                        textAndCTA(titleSize: m.title)
                    }
                } else {
                    VStack(spacing: 20) {
                        logoBlock(metrics: m)
                        textAndCTA(titleSize: m.title)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, 40)
        }
    }

    private struct HeroMetrics {
        let halo: CGFloat
        let haloEndRadius: CGFloat
        let logo: CGFloat
        let title: CGFloat
    }

    /// Sizes for the three layout regimes. iPhone portrait intentionally
    /// reproduces the pre-change sizes (halo 380 / logo 160 / title 56) so
    /// that layout is unchanged. iPad scales up; iPhone landscape scales
    /// down to fit the short screen.
    private func heroMetrics(isRegular: Bool, isLandscape: Bool) -> HeroMetrics {
        if isRegular {
            return HeroMetrics(halo: 480, haloEndRadius: 240, logo: 200, title: 72)
        } else if isLandscape {
            return HeroMetrics(halo: 300, haloEndRadius: 160, logo: 130, title: 44)
        } else {
            return HeroMetrics(halo: 380, haloEndRadius: 200, logo: 160, title: 56)
        }
    }

    @ViewBuilder
    private func logoBlock(metrics m: HeroMetrics) -> some View {
        ZStack {
            // Soft outer halo
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.purple.opacity(0.55), .clear],
                        center: .center,
                        startRadius: 10,
                        endRadius: m.haloEndRadius
                    )
                )
                .frame(width: m.halo, height: m.halo)
                .scaleEffect(logoPulse ? 1.05 : 0.95)
                .blur(radius: 8)

            Image("AppLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: m.logo, height: m.logo)
                .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                .shadow(color: .purple.opacity(0.7), radius: 28, y: 8)
                .scaleEffect(logoPulse ? 1.02 : 1.0)
        }
        .loopingAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: true)) {
            logoPulse = true
        }
    }

    @ViewBuilder
    private func textAndCTA(titleSize: CGFloat) -> some View {
        VStack(spacing: 20) {
            // Gradient wordmark
            Text("My Book Lab")
                .font(.system(size: titleSize, weight: .heavy, design: .rounded))
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
            .frame(maxWidth: 360)
            .padding(.horizontal, 32)
            .padding(.top, 12)
            .onAppear { startWiggle() }
        }
    }

    // Periodic book-emoji wobble to invite a tap. Subtle — every ~3
    // seconds the book gives a little wave.
    private func startWiggle() {
        Task { @MainActor in
            while true {
                try? await Task.sleep(for: .seconds(3.5))
                withAnimation(.interpolatingSpring(stiffness: 250, damping: 6)) {
                    ctaWiggle = 18
                }
                try? await Task.sleep(for: .milliseconds(250))
                withAnimation(.interpolatingSpring(stiffness: 250, damping: 8)) {
                    ctaWiggle = 0
                }
            }
        }
    }
}
