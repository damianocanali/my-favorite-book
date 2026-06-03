// Native SwiftUI confetti — no third-party dependency. Used for the
// magical moment when a kid finishes their first book. Mount with
// `.overlay(Confetti(trigger: triggerCount))` and increment trigger
// to fire a fresh burst.
import SwiftUI

struct Confetti: View {
    /// Increment this to fire a new burst.
    let trigger: Int
    /// Number of pieces per burst.
    var count: Int = 70
    /// How long each piece falls before disappearing.
    var duration: Double = 2.6

    @State private var pieces: [Piece] = []

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(pieces) { p in
                    Rectangle()
                        .fill(p.color)
                        .frame(width: p.width, height: p.height)
                        .rotationEffect(.degrees(p.rotation))
                        .position(x: p.x, y: p.y)
                        .opacity(p.opacity)
                }
            }
            .allowsHitTesting(false)
            .onChange(of: trigger) { _, _ in
                Haptics.celebrate()
                burst(in: geo.size)
            }
        }
    }

    private func burst(in size: CGSize) {
        let palette: [Color] = [.yellow, .pink, .purple, .cyan, .green, .orange, .white]
        var new: [Piece] = []
        for _ in 0..<count {
            new.append(Piece(
                x: CGFloat.random(in: 0...size.width),
                y: -20,
                targetY: size.height + 40,
                width: CGFloat.random(in: 6...12),
                height: CGFloat.random(in: 10...18),
                rotation: Double.random(in: 0...360),
                spin: Double.random(in: -540...540),
                color: palette.randomElement()!,
                opacity: 1
            ))
        }
        pieces.append(contentsOf: new)
        for piece in new {
            withAnimation(.easeIn(duration: duration + Double.random(in: -0.4...0.4))) {
                if let i = pieces.firstIndex(where: { $0.id == piece.id }) {
                    pieces[i].y = piece.targetY
                    pieces[i].rotation += piece.spin
                }
            }
            withAnimation(.easeIn(duration: 0.6).delay(duration - 0.6)) {
                if let i = pieces.firstIndex(where: { $0.id == piece.id }) {
                    pieces[i].opacity = 0
                }
            }
        }
        let ids = new.map(\.id)
        DispatchQueue.main.asyncAfter(deadline: .now() + duration + 1.0) {
            pieces.removeAll { ids.contains($0.id) }
        }
    }

    struct Piece: Identifiable {
        let id = UUID()
        var x: CGFloat
        var y: CGFloat
        let targetY: CGFloat
        let width: CGFloat
        let height: CGFloat
        var rotation: Double
        let spin: Double
        let color: Color
        var opacity: Double
    }
}
