// Avatar editor. Two paths:
//   1. Pick a photo (PhotosPicker) → resize to ~768px → POST as data
//      URL to /api/generate-avatar with sourceImage. Backend cartoonifies
//      via FLUX Kontext. Cartoon image is saved as the avatar; raw
//      photo is never persisted (matches the privacy-first design in
//      the web version).
//   2. Tap a fun emoji-only avatar (no photo, no cost).
//
// A parental-gate sheet is shown before camera/photo access — same
// safeguard the web app uses and what App Review expects for kids
// features that touch the camera.
import SwiftUI
import PhotosUI

struct AvatarEditorView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(CoinsStore.self) private var coins
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var sourceImage: UIImage?
    @State private var resultImage: UIImage?
    @State private var generating = false
    @State private var saving = false
    @State private var error: String?
    @State private var showingParentalGate = false
    @State private var pendingPhotoAction: (() -> Void)?
    @State private var savedAvatarSnapshot: String?  // remember initial value to detect changes
    @State private var selectedStyle: String = "cartoon"  // current art style — must be owned

    private let emojiOptions = ["🦊", "🐻", "🐰", "🦄", "🐉", "🦁", "🐱", "🐶", "🐢", "🦉", "🌟", "🌙", "✨", "🌈"]

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(spacing: 24) {
                    hero
                    if resultImage != nil {
                        saveButton
                    }
                    photoSection
                    artStyleSection
                    Divider().background(.white.opacity(0.15)).padding(.horizontal, 32)
                    emojiSection
                }
                .padding(.vertical, 12)
            }
        }
        .navigationTitle("Customize avatar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingParentalGate) {
            ParentalGate {
                showingParentalGate = false
                pendingPhotoAction?()
                pendingPhotoAction = nil
            } onCancel: {
                showingParentalGate = false
                pendingPhotoAction = nil
            }
        }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await loadAndCartoonify(item) }
        }
        .onAppear {
            // Remember whatever avatar was already saved so the editor
            // shows it as the current state. If we have a data: URL,
            // decode it into a UIImage so the hero shows the existing
            // avatar as the starting point.
            savedAvatarSnapshot = auth.avatarURL
            if resultImage == nil, let dataURL = auth.avatarURL,
               let img = decodeDataURL(dataURL) {
                resultImage = img
            }
        }
    }

    private var saveButton: some View {
        SparkleButton(action: { Task { await save() } }) {
            HStack {
                if saving { ProgressView().tint(.white) }
                Text(saving ? "Saving…" : "Save avatar")
            }
        }
        .disabled(saving)
        .padding(.horizontal)
    }

    // MARK: - Sections

    private var hero: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(.white.opacity(0.08))
                    .frame(width: 160, height: 160)
                if let img = resultImage {
                    Image(uiImage: img)
                        .resizable().aspectRatio(contentMode: .fill)
                        .frame(width: 160, height: 160)
                        .clipShape(Circle())
                } else {
                    Text("✨").font(.system(size: 64))
                }
            }
            .shadow(color: .purple.opacity(0.5), radius: 16, y: 6)
            if generating {
                HStack(spacing: 6) {
                    ProgressView().tint(.white)
                    Text("Drawing your cartoon…").foregroundStyle(.white)
                }
            }
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red.opacity(0.9))
            }
        }
    }

    private var photoSection: some View {
        VStack(spacing: 12) {
            Text("Turn your photo into a cartoon")
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
            Text("Your original photo is never saved. Only the cartoon stays.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.65))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            // Photo picker is gated by a parental math problem.
            Button {
                pendingPhotoAction = {
                    // Trigger PhotosPicker presentation by toggling a flag.
                    // We expose a hidden PhotosPicker below that takes
                    // selectedPhoto; tapping the gate-cleared button
                    // shouldn't re-present the picker on its own, so we
                    // present it programmatically via a state flag.
                    showPicker = true
                }
                showingParentalGate = true
            } label: {
                Label("Pick a photo", systemImage: "photo")
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(.purple.opacity(0.45), in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal)
            .photosPicker(isPresented: $showPicker, selection: $selectedPhoto, matching: .images)
        }
    }

    @State private var showPicker = false

    /// Art style picker — cartoon free + owned by default; everything
    /// else gated by the coin economy. Tapping a locked style takes
    /// the user to the Coin Store rather than blocking them silently.
    @ViewBuilder
    private var artStyleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Art style")
                    .font(.caption.bold())
                    .foregroundStyle(.white.opacity(0.7))
                    .textCase(.uppercase)
                Spacer()
                NavigationLink {
                    CoinStoreView()
                } label: {
                    Text("Unlock more →")
                        .font(.caption.bold())
                        .foregroundStyle(.yellow)
                }
            }
            .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    styleChip(id: "cartoon", label: "Cartoon", emoji: "🎨", owned: true)
                    ForEach(AvatarStyle.purchasable) { style in
                        styleChip(
                            id: style.id,
                            label: style.label,
                            emoji: style.emoji,
                            owned: coins.owns(style: style.id)
                        )
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    private func styleChip(id: String, label: String, emoji: String, owned: Bool) -> some View {
        let selected = selectedStyle == id
        return Button {
            guard owned else { return }   // locked styles route through Store
            selectedStyle = id
        } label: {
            VStack(spacing: 4) {
                ZStack(alignment: .topTrailing) {
                    Text(emoji).font(.system(size: 28))
                        .frame(width: 56, height: 56)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(selected ? Color.purple.opacity(0.5) : Color.white.opacity(0.08))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(selected ? Color.white : Color.clear, lineWidth: 2)
                        )
                    if !owned {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.white)
                            .padding(4)
                            .background(.black.opacity(0.6), in: Circle())
                            .offset(x: 4, y: -4)
                    }
                }
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(owned ? 1.0 : 0.5))
            }
        }
        .buttonStyle(.plain)
        .disabled(!owned)
    }

    private var emojiSection: some View {
        VStack(spacing: 12) {
            Text("Or pick a fun avatar")
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 12) {
                ForEach(emojiOptions, id: \.self) { e in
                    Button { selectEmoji(e) } label: {
                        Text(e)
                            .font(.system(size: 36))
                            .frame(width: 56, height: 56)
                            .background(.white.opacity(0.08), in: Circle())
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Actions

    private func selectEmoji(_ emoji: String) {
        // Render the emoji centered on a magical purple gradient, at
        // 256×256 — same size updateAvatar will save it at, so no
        // re-rasterization changes the framing.
        let size: CGFloat = 256
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        let img = renderer.image { ctx in
            // Gradient background — matches the cosmic kid-app palette.
            let cg = ctx.cgContext
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            let topColor = UIColor(red: 0.55, green: 0.30, blue: 0.95, alpha: 1).cgColor
            let bottomColor = UIColor(red: 0.95, green: 0.45, blue: 0.65, alpha: 1).cgColor
            if let gradient = CGGradient(colorsSpace: colorSpace,
                                         colors: [topColor, bottomColor] as CFArray,
                                         locations: [0, 1]) {
                cg.drawLinearGradient(
                    gradient,
                    start: CGPoint(x: 0, y: 0),
                    end: CGPoint(x: size, y: size),
                    options: []
                )
            }

            // Measure the emoji at the chosen font size, then place it
            // so its CENTER lands at the center of the canvas. This is
            // the reliable way to center color emojis — draw(in:)
            // ignores half the glyph's bounding box on many fonts.
            let fontSize: CGFloat = 170
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: fontSize)
            ]
            let str = NSAttributedString(string: emoji, attributes: attrs)
            let textSize = str.size()
            let origin = CGPoint(
                x: (size - textSize.width) / 2,
                y: (size - textSize.height) / 2
            )
            str.draw(at: origin)
        }
        resultImage = img
    }

    private func loadAndCartoonify(_ item: PhotosPickerItem) async {
        guard let token = auth.accessToken else { return }
        generating = true
        error = nil
        defer { generating = false }

        do {
            // Load the picked image data.
            guard let data = try await item.loadTransferable(type: Data.self),
                  let original = UIImage(data: data) else {
                self.error = "Couldn't read photo."
                return
            }
            sourceImage = original

            // Resize to ~768px and re-encode as JPEG (keeps the request body small).
            let resized = resize(original, maxDimension: 768)
            guard let jpeg = resized.jpegData(compressionQuality: 0.85) else {
                self.error = "Couldn't process photo."
                return
            }
            let dataUrl = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"

            let res = try await APIClient.shared.generateAvatar(
                .init(features: nil, artStyle: selectedStyle, sourceImage: dataUrl),
                bearerToken: token
            )
            // Backend returns a data URL — decode and display.
            if let img = decodeDataURL(res.image) {
                resultImage = img
                // TODO: sync to user_metadata avatar field
            } else {
                self.error = "Couldn't decode cartoon."
            }
        } catch {
            self.error = "Couldn't make your cartoon: \(error.localizedDescription)"
        }
    }

    private func resize(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let scale = min(1, maxDimension / max(image.size.width, image.size.height))
        if scale >= 1 { return image }
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: newSize)) }
    }

    private func decodeDataURL(_ dataUrl: String) -> UIImage? {
        let parts = dataUrl.split(separator: ",", maxSplits: 1)
        guard parts.count == 2, let data = Data(base64Encoded: String(parts[1])) else { return nil }
        return UIImage(data: data)
    }

    private func save() async {
        guard let img = resultImage else { return }
        saving = true
        error = nil
        defer { saving = false }
        do {
            try await auth.updateAvatar(img)
            Haptics.celebrate()
            dismiss()
        } catch {
            self.error = "Couldn't save: \(error.localizedDescription)"
        }
    }
}

// MARK: - Parental gate

private struct ParentalGate: View {
    let onSuccess: () -> Void
    let onCancel: () -> Void

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
                Button("Continue") {
                    if Int(answer) == a + b { onSuccess() }
                    else { wrong = true; answer = "" }
                }
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
}
