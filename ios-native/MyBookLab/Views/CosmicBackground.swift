// Magical galaxy backdrop used app-wide. Matches the web's
// src/components/layout/CosmicBackground.jsx vibe: deep purple
// gradient + twinkling stars + occasional drifting sparkles. Kids
// notice motion; the slow twinkle keeps the app feeling alive
// without becoming distracting.
import SwiftUI

struct CosmicBackground: View {
    var body: some View {
        // Purely decorative — VoiceOver skips it, AND all taps pass
        // through. Without allowsHitTesting(false) the drifting
        // sparkle Image views would catch taps that should reach the
        // text fields and buttons sitting on top of the background.
        backdrop
            .accessibilityHidden(true)
            .allowsHitTesting(false)
    }

    @ViewBuilder private var backdrop: some View {
        ZStack {
            // Deep galaxy gradient.
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.04, blue: 0.16),
                    Color(red: 0.10, green: 0.05, blue: 0.24),
                    Color(red: 0.18, green: 0.07, blue: 0.32),
                    Color(red: 0.11, green: 0.04, blue: 0.18),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Soft purple nebula glow blobs — float gently.
            NebulaBlob(color: .purple.opacity(0.35), offset: CGSize(width: -120, height: -200), size: 320, speed: 12)
            NebulaBlob(color: .pink.opacity(0.22), offset: CGSize(width: 140, height: 260), size: 280, speed: 14)
            NebulaBlob(color: .cyan.opacity(0.18), offset: CGSize(width: 60, height: -80), size: 220, speed: 16)

            TwinklingStarsLayer()
            DriftingSparklesLayer()
        }
        .ignoresSafeArea()
    }
}



// MARK: - Twinkling stars

// Pre-computed once so the per-frame Canvas closure is cheap.
private struct StarSeed {
    let xFraction: Double
    let yFraction: Double
    let baseRadius: Double
    let twinkleSpeed: Double
    let twinkleOffset: Double
    let isSparkle: Bool
}

private let starSeeds: [StarSeed] = {
    var rng = SplitMix64(seed: 42)
    let count = 70 // was 110 — fewer stars, big perf win, still feels rich
    return (0..<count).map { i in
        let x = Double(rng.next() % 10000) / 10000
        let y = Double(rng.next() % 10000) / 10000
        let baseRadius = 0.4 + Double(rng.next() % 100) / 100 * 1.6
        let twinkleSpeed = 0.5 + Double(rng.next() % 200) / 100
        let twinkleOffset = Double(rng.next() % 1000) / 1000 * .pi * 2
        return StarSeed(
            xFraction: x, yFraction: y,
            baseRadius: baseRadius,
            twinkleSpeed: twinkleSpeed,
            twinkleOffset: twinkleOffset,
            isSparkle: i % 23 == 0
        )
    }
}()

private struct TwinklingStarsLayer: View {
    var body: some View {
        // 12 fps is plenty for a slow twinkle and is ~4x cheaper than
        // 30 fps. Text input no longer competes with Canvas redraws.
        TimelineView(.animation(minimumInterval: 1.0/12.0, paused: false)) { ctx in
            Canvas { gfx, size in
                let t = ctx.date.timeIntervalSinceReferenceDate
                for s in starSeeds {
                    let twinkle = 0.4 + 0.6 * (0.5 + 0.5 * sin(t * s.twinkleSpeed + s.twinkleOffset))
                    let r = s.baseRadius * twinkle
                    let alpha = 0.25 + 0.7 * twinkle
                    let x = s.xFraction * size.width
                    let y = s.yFraction * size.height
                    if s.isSparkle {
                        let bigR = r * 3
                        gfx.fill(
                            sparklePath(at: CGPoint(x: x, y: y), radius: bigR),
                            with: .color(.white.opacity(alpha))
                        )
                    } else {
                        gfx.fill(
                            Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)),
                            with: .color(.white.opacity(alpha))
                        )
                    }
                }
            }
        }
    }

    private func sparklePath(at p: CGPoint, radius r: Double) -> Path {
        var path = Path()
        let points = 4
        for i in 0..<(points * 2) {
            let angle = Double(i) * .pi / Double(points)
            let dist = i.isMultiple(of: 2) ? r : r * 0.35
            let x = p.x + dist * cos(angle - .pi/2)
            let y = p.y + dist * sin(angle - .pi/2)
            if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
            else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Drifting sparkles (foreground, occasional)

private struct DriftingSparklesLayer: View {
    @State private var sparkles: [Drifter] = []

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(sparkles) { s in
                    Image(systemName: "sparkle")
                        .foregroundStyle(s.color)
                        .font(.system(size: s.size))
                        .position(x: s.x, y: s.y)
                        .opacity(s.opacity)
                        .rotationEffect(.degrees(s.rotation))
                }
            }
            .onAppear { schedule(in: geo.size) }
        }
    }

    private func schedule(in size: CGSize) {
        // 3.0 sec between spawns keeps the screen alive but doesn't
        // stack a dozen concurrent SwiftUI animations.
        Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { _ in
            spawn(in: size)
        }
        // Seed two immediately so the screen isn't empty on launch.
        for _ in 0..<2 { spawn(in: size) }
    }

    private func spawn(in size: CGSize) {
        let id = UUID()
        let startX = CGFloat.random(in: 0...size.width)
        let startY = size.height + 20
        let endY = -20.0
        let s = Drifter(
            id: id,
            x: startX,
            y: startY,
            size: CGFloat.random(in: 10...22),
            color: [.yellow, .pink, .purple, .cyan, .white].randomElement()!,
            opacity: 0,
            rotation: 0
        )
        sparkles.append(s)
        let duration = Double.random(in: 6...12)
        withAnimation(.linear(duration: duration)) {
            if let idx = sparkles.firstIndex(where: { $0.id == id }) {
                sparkles[idx].y = endY
                sparkles[idx].opacity = 0.85
                sparkles[idx].rotation = Double.random(in: -90...360)
            }
        }
        withAnimation(.easeIn(duration: 1.5).delay(duration - 1.5)) {
            if let idx = sparkles.firstIndex(where: { $0.id == id }) {
                sparkles[idx].opacity = 0
            }
        }
        Task {
            try? await Task.sleep(for: .seconds(duration + 0.5))
            sparkles.removeAll { $0.id == id }
        }
    }

    struct Drifter: Identifiable {
        let id: UUID
        var x: CGFloat
        var y: CGFloat
        let size: CGFloat
        let color: Color
        var opacity: Double
        var rotation: Double
    }
}

// MARK: - Nebula blob (slow drift)

private struct NebulaBlob: View {
    let color: Color
    let offset: CGSize
    let size: CGFloat
    let speed: Double

    @State private var drift: CGSize = .zero

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    gradient: Gradient(colors: [color, color.opacity(0)]),
                    center: .center, startRadius: 0, endRadius: size / 2
                )
            )
            .frame(width: size, height: size)
            .blur(radius: 40)
            .offset(x: offset.width + drift.width, y: offset.height + drift.height)
            .loopingAnimation(.easeInOut(duration: speed).repeatForever(autoreverses: true)) {
                drift = CGSize(width: 40, height: -30)
            }
    }
}

// MARK: - PRNG (stable star positions)

private struct SplitMix64 {
    var state: UInt64
    init(seed: UInt64) { self.state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}
