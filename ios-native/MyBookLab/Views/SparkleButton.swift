// Native port of src/components/ui/SparkleButton.jsx. A tappable button
// that emits a burst of sparkles on press — gives every primary action
// the magical kid-app feel the web app's SparkleButton brings.
import SwiftUI

struct SparkleButton<Label: View>: View {
    let action: () -> Void
    var style: Style = .primary
    var size: Size = .regular
    @ViewBuilder let label: () -> Label

    enum Style { case primary, secondary, accent }
    enum Size { case small, regular, large }

    @State private var sparkles: [Sparkle] = []
    @State private var pressed = false

    var body: some View {
        Button {
            Haptics.tap()
            burst()
            action()
        } label: {
            label()
                .font(size.font)
                .bold()
                .foregroundStyle(style.foreground)
                .padding(.horizontal, size.hPadding)
                .padding(.vertical, size.vPadding)
                .frame(maxWidth: .infinity)
                .background(style.background, in: Capsule())
                .overlay(Capsule().strokeBorder(style.border, lineWidth: 1.5))
                .shadow(color: style.glow, radius: pressed ? 4 : 14, y: pressed ? 2 : 6)
                .scaleEffect(pressed ? 0.95 : 1.0)
        }
        .buttonStyle(.plain)
        .pressGesture { isPressing in
            withAnimation(.spring(response: 0.25, dampingFraction: 0.55)) {
                pressed = isPressing
            }
        }
        .overlay {
            // Sparkles float upward then fade.
            ZStack {
                ForEach(sparkles) { s in
                    Image(systemName: "sparkle")
                        .foregroundStyle(s.color)
                        .font(.system(size: s.size))
                        .offset(x: s.x, y: s.y)
                        .opacity(s.opacity)
                        .rotationEffect(.degrees(s.rotation))
                }
            }
            .allowsHitTesting(false)
        }
    }

    private func burst() {
        let count = 7
        let new = (0..<count).map { i in
            Sparkle(
                x: CGFloat.random(in: -60...60),
                y: 8,
                targetY: CGFloat.random(in: -80 ... -30),
                size: CGFloat.random(in: 10...20),
                rotation: Double.random(in: 0...360),
                color: [.yellow, .pink, .purple, .cyan, .white].randomElement()!,
                delay: Double(i) * 0.02
            )
        }
        sparkles.append(contentsOf: new)
        for sparkle in new {
            withAnimation(.easeOut(duration: 0.7).delay(sparkle.delay)) {
                if let idx = sparkles.firstIndex(where: { $0.id == sparkle.id }) {
                    sparkles[idx].y = sparkle.targetY
                    sparkles[idx].opacity = 0
                    sparkles[idx].rotation += 180
                }
            }
        }
        // Clean up after the animation finishes.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            sparkles.removeAll { s in new.contains(where: { $0.id == s.id }) }
        }
    }

    struct Sparkle: Identifiable {
        let id = UUID()
        var x: CGFloat
        var y: CGFloat
        let targetY: CGFloat
        let size: CGFloat
        var rotation: Double
        let color: Color
        var opacity: Double = 1
        let delay: Double
    }
}

extension SparkleButton.Style {
    var background: AnyShapeStyle {
        switch self {
        case .primary:
            return AnyShapeStyle(LinearGradient(
                colors: [Color(red: 0.65, green: 0.34, blue: 0.95),
                         Color(red: 0.47, green: 0.20, blue: 0.83)],
                startPoint: .top, endPoint: .bottom))
        case .secondary:
            return AnyShapeStyle(Color.white.opacity(0.08))
        case .accent:
            return AnyShapeStyle(LinearGradient(
                colors: [Color(red: 1.00, green: 0.62, blue: 0.36),
                         Color(red: 0.96, green: 0.40, blue: 0.55)],
                startPoint: .top, endPoint: .bottom))
        }
    }
    var foreground: Color {
        switch self {
        case .primary, .accent: return .white
        case .secondary: return .white
        }
    }
    var border: Color {
        switch self {
        case .primary: return .white.opacity(0.3)
        case .secondary: return .white.opacity(0.35)
        case .accent: return .white.opacity(0.3)
        }
    }
    var glow: Color {
        switch self {
        case .primary: return .purple.opacity(0.55)
        case .secondary: return .clear
        case .accent: return .pink.opacity(0.55)
        }
    }
}

extension SparkleButton.Size {
    var font: Font {
        switch self {
        case .small: return .callout
        case .regular: return .body
        case .large: return .title3
        }
    }
    var hPadding: CGFloat {
        switch self { case .small: 16; case .regular: 22; case .large: 28 }
    }
    var vPadding: CGFloat {
        switch self { case .small: 10; case .regular: 14; case .large: 16 }
    }
}

// SwiftUI doesn't expose a clean press gesture; this is the tidiest way.
private extension View {
    func pressGesture(_ onChange: @escaping (Bool) -> Void) -> some View {
        simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in onChange(true) }
                .onEnded { _ in onChange(false) }
        )
    }
}
