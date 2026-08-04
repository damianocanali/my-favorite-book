// Draw-your-own illustration. PencilKit gives us a real drawing surface
// (finger or Apple Pencil) with Apple's own tool picker, so there's no
// custom brush engine to maintain.
//
// The exported image is composited onto white at the same 3:2 shape the
// AI illustrations use, so a drawn page and a generated page lay out
// identically — in the reader and in the printed book.
import PencilKit
import SwiftUI

/// Matches the 768×512 that /api/generate-image returns, at 2x for print.
private let canvasAspect: CGFloat = 3.0 / 2.0
private let exportWidth: CGFloat = 1536
private let exportHeight: CGFloat = 1024

struct DrawingCanvasView: View {
    /// Existing artwork to start from, if the page already has a drawing.
    var onCancel: () -> Void
    var onSave: (UIImage) -> Void

    @State private var canvasView = PKCanvasView()
    @State private var isEmpty = true

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                VStack(spacing: 14) {
                    Text("Draw your picture!")
                        .font(.system(.title3, design: .rounded).bold())
                        .foregroundStyle(.white)

                    // The paper. Fixed aspect so what you draw is exactly
                    // what lands on the page — no surprise cropping.
                    PencilCanvas(canvasView: $canvasView, isEmpty: $isEmpty)
                        .aspectRatio(canvasAspect, contentMode: .fit)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(.white.opacity(0.25), lineWidth: 2)
                        )
                        .shadow(color: .black.opacity(0.4), radius: 12, y: 6)
                        .padding(.horizontal, 12)

                    Text("Use your finger or Apple Pencil ✏️")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))

                    Spacer(minLength: 0)
                }
                .padding(.top, 8)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { onCancel() }
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 16) {
                        Button {
                            canvasView.drawing = PKDrawing()
                            isEmpty = true
                            Haptics.tap()
                        } label: {
                            Image(systemName: "trash")
                        }
                        .disabled(isEmpty)
                        .accessibilityLabel("Clear drawing")

                        Button("Use it") {
                            Haptics.celebrate()
                            onSave(renderImage())
                        }
                        .bold()
                        .disabled(isEmpty)
                    }
                    .foregroundStyle(.white)
                }
            }
        }
    }

    /// Flatten the strokes onto white. PencilKit renders a transparent
    /// background, which would show as black once it hits the printed page.
    private func renderImage() -> UIImage {
        let size = CGSize(width: exportWidth, height: exportHeight)
        let bounds = canvasView.bounds
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))

            guard bounds.width > 0, bounds.height > 0 else { return }
            // Scale the on-screen drawing up to export resolution.
            let strokes = canvasView.drawing.image(from: bounds, scale: 1)
            strokes.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

/// Thin PKCanvasView wrapper. The tool picker is Apple's, so kids get
/// pens, crayon, marker and colours for free.
private struct PencilCanvas: UIViewRepresentable {
    @Binding var canvasView: PKCanvasView
    @Binding var isEmpty: Bool

    func makeUIView(context: Context) -> PKCanvasView {
        canvasView.drawingPolicy = .anyInput // finger works, not just Pencil
        canvasView.backgroundColor = .white
        canvasView.isOpaque = true
        canvasView.delegate = context.coordinator
        canvasView.tool = PKInkingTool(.pen, color: .black, width: 8)

        DispatchQueue.main.async {
            guard let window = canvasView.window else { return }
            let picker = PKToolPicker.shared(for: window)
            picker?.setVisible(true, forFirstResponder: canvasView)
            picker?.addObserver(canvasView)
            canvasView.becomeFirstResponder()
        }
        return canvasView
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(isEmpty: $isEmpty) }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        private let isEmpty: Binding<Bool>
        init(isEmpty: Binding<Bool>) { self.isEmpty = isEmpty }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            isEmpty.wrappedValue = canvasView.drawing.strokes.isEmpty
        }
    }
}
