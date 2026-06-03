// Subscription paywall. Shows the current offering's packages with
// magical card design, Apple's required auto-renewal disclosure, and
// Terms of Use + Privacy Policy links — all mandatory for App Store
// approval under guideline 3.1.2 (Subscriptions).
import SwiftUI
import RevenueCat

struct PaywallView: View {
    /// Where the paywall was opened from — drives the headline copy.
    /// `.celebration` is shown right after a kid saves their first book
    /// (peak emotional moment for the upsell); `.standard` is the
    /// regular entry from the account screen.
    enum Context { case standard, celebration }

    var context: Context = .standard

    @Environment(SubscriptionStore.self) private var subs
    @Environment(\.dismiss) private var dismiss

    @State private var purchasing: String?
    @State private var error: String?
    @State private var confettiTrigger = 0

    var body: some View {
        ZStack {
            CosmicBackground()
            Confetti(trigger: confettiTrigger).allowsHitTesting(false)
            ScrollView {
                VStack(spacing: 24) {
                    header
                    benefits
                    if let packages = subs.currentOffering?.availablePackages, !packages.isEmpty {
                        plans(packages: packages)
                    } else if subs.loading {
                        ProgressView().tint(.white).padding(.top, 24)
                    } else {
                        Text("No plans available right now. Try again in a moment.")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.7))
                            .padding(.top, 12)
                    }

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                            .padding(.horizontal)
                    }

                    legal

                    Button("Restore purchases") {
                        Task { await subs.restore() }
                    }
                    .foregroundStyle(.white.opacity(0.7))
                    .padding(.top, 4)
                }
                .padding(.bottom, 32)
                .padding(.top, 12)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }.foregroundStyle(.white)
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .task { await subs.refresh() }
        .onChange(of: subs.isPaid) { _, paid in
            if paid { dismiss() }
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(spacing: 8) {
            Text(context == .celebration ? "🎉" : "✨")
                .font(.system(size: 64))

            Text(context == .celebration
                 ? "Your first book is done!"
                 : "Unlock the full magic")
                .font(.system(size: 28, weight: .heavy, design: .rounded))
                .foregroundStyle(
                    LinearGradient(colors: [.cyan, .purple, .pink],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .multilineTextAlignment(.center)

            Text(context == .celebration
                 ? "Amazing work! Keep the magic going with unlimited books, illustrations, and printing."
                 : "More stories, more illustrations, more pages — and the same parent-safe Story Buddy.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .onAppear {
            if context == .celebration {
                // Fire a confetti burst on entry, paired with a success
                // haptic — the kid just finished a book and we want
                // this moment to feel like a reward, not a wall.
                confettiTrigger &+= 1
            }
        }
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 10) {
            benefit("📚", "Unlimited books")
            benefit("🎨", "Unlimited AI illustrations")
            benefit("🎙️", "Voice input & read aloud")
            benefit("👨‍👩‍👧", "Up to 4 kid profiles")
            benefit("📖", "Print real hardcover and softcover books")
        }
        .padding(20)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18))
        .padding(.horizontal)
    }

    private func benefit(_ emoji: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Text(emoji).font(.title3)
            Text(text).foregroundStyle(.white)
            Spacer()
        }
    }

    private func plans(packages: [Package]) -> some View {
        VStack(spacing: 12) {
            ForEach(packages, id: \.identifier) { pkg in
                planCard(package: pkg)
            }
        }
        .padding(.horizontal)
    }

    private func planCard(package: Package) -> some View {
        let isBest = package.packageType == .annual
        let savings = isBest ? "Best value" : nil

        return Button {
            Task { await purchase(package) }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(package.storeProduct.localizedTitle)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Spacer()
                    if let savings {
                        Text(savings)
                            .font(.caption.bold())
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(.yellow, in: Capsule())
                            .foregroundStyle(.black)
                    }
                }
                Text(package.storeProduct.localizedDescription)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(package.storeProduct.localizedPriceString)
                        .font(.system(.title3, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text(periodSuffix(package))
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
                if purchasing == package.identifier {
                    HStack {
                        ProgressView().tint(.white)
                        Text("Opening Apple Pay…")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 18)
                    .fill(isBest ? Color.purple.opacity(0.45) : Color.white.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .strokeBorder(isBest ? Color.white.opacity(0.7) : Color.clear, lineWidth: 1.5)
            )
            .shadow(color: isBest ? .purple.opacity(0.6) : .clear, radius: 16, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(purchasing != nil)
    }

    private func periodSuffix(_ package: Package) -> String {
        switch package.packageType {
        case .annual: return "/ year"
        case .monthly: return "/ month"
        case .weekly: return "/ week"
        case .lifetime: return "once"
        default: return ""
        }
    }

    private var legal: some View {
        VStack(spacing: 6) {
            Text("Subscription auto-renews unless canceled at least 24 hours before the end of the period. Manage or cancel in Settings → Apple ID → Subscriptions.")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.center)
            HStack(spacing: 14) {
                Link("Terms of Use", destination: URL(string: "https://mybooklab.app/terms")!)
                Link("Privacy Policy", destination: URL(string: "https://mybooklab.app/privacy")!)
            }
            .font(.caption2)
            .foregroundStyle(.white.opacity(0.65))
        }
        .padding(.horizontal, 28)
        .padding(.top, 4)
    }

    private func purchase(_ package: Package) async {
        purchasing = package.identifier
        error = nil
        defer { purchasing = nil }
        do { try await subs.purchase(package) }
        catch { self.error = "Couldn't complete purchase: \(error.localizedDescription)" }
    }
}
