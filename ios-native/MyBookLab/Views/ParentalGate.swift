// The "grown-up check" — a two-digit addition problem a young child
// can't solve, shown before anything a parent should be present for:
// the camera and photo library, and every purchase.
//
// App Store Guideline 3.1.1 / the Kids guidelines expect a gate before
// purchases in an app aimed at children, and our published privacy
// policy and App Review notes both state that one exists. Route every
// new purchase entry point through `.parentalGate(...)`.
//
// This replaces the two private copies that used to live in
// AvatarEditorView and CreateBookView.
import SwiftUI

struct ParentalGate: View {
    let onSuccess: () -> Void
    let onCancel: () -> Void

    // Two-digit operands so the answer isn't guessable and isn't
    // reachable by a child who only knows single-digit sums.
    @State private var a: Int = Int.random(in: 11...19)
    @State private var b: Int = Int.random(in: 11...19)
    @State private var answer: String = ""
    @State private var wrong = false

    var body: some View {
        VStack(spacing: 20) {
            Text("👋 Grown-up check")
                .font(.system(.title3, design: .rounded).bold())
            Text("Solve this so we know a grown-up is here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text("\(a) + \(b) = ?")
                .font(.system(.largeTitle, design: .rounded).bold())
                .accessibilityLabel("What is \(a) plus \(b)?")
            TextField("Answer", text: $answer)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .padding()
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 32)
            if wrong {
                Text("Try again.").foregroundStyle(.red).font(.footnote)
            }
            HStack(spacing: 12) {
                Button("Cancel", role: .cancel) { onCancel() }
                    .frame(maxWidth: .infinity).padding(12)
                Button("Continue") { submit() }
                    .frame(maxWidth: .infinity).padding(12)
                    .background(.purple, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 32)
            Spacer()
        }
        .padding(.top, 28)
        .presentationDetents([.medium])
    }

    private func submit() {
        if Int(answer.trimmingCharacters(in: .whitespaces)) == a + b {
            onSuccess()
        } else {
            wrong = true
            answer = ""
            // New numbers on every miss, so repeated guessing can't
            // converge on one answer.
            a = Int.random(in: 11...19)
            b = Int.random(in: 11...19)
        }
    }
}

extension View {
    /// Presents the grown-up check while `isPresented` is true, and runs
    /// `onPass` only once it has been solved.
    ///
    ///     .parentalGate(isPresented: $showGate) { await buy() }
    func parentalGate(isPresented: Binding<Bool>, onPass: @escaping () -> Void) -> some View {
        sheet(isPresented: isPresented) {
            ParentalGate(
                onSuccess: {
                    isPresented.wrappedValue = false
                    onPass()
                },
                onCancel: { isPresented.wrappedValue = false }
            )
        }
    }
}
