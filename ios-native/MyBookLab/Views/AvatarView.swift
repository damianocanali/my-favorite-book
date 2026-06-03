// Renders an avatar for a given URL string. Handles both base64 data
// URLs (what updateAvatar writes for inline avatars) and plain http
// URLs (what OAuth providers like Google return). Falls back to a
// nice gradient + initial when no avatar is set.
import SwiftUI

struct AvatarView: View {
    let urlString: String?
    let fallbackInitial: String?
    var size: CGFloat = 96

    var body: some View {
        ZStack {
            background

            if let image = inlineImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if let url = remoteURL {
                AsyncImage(url: url) { phase in
                    if let img = phase.image {
                        img.resizable().scaledToFill()
                    } else if phase.error == nil {
                        ProgressView().tint(.white)
                    } else {
                        initialOverlay
                    }
                }
            } else {
                initialOverlay
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(
            Circle().strokeBorder(.white.opacity(0.25), lineWidth: 2)
        )
        .shadow(color: .purple.opacity(0.5), radius: 16, y: 6)
    }

    private var background: some View {
        LinearGradient(
            colors: [
                Color(red: 0.55, green: 0.30, blue: 0.95),
                Color(red: 0.95, green: 0.45, blue: 0.65),
            ],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
    }

    private var initialOverlay: some View {
        Text(fallbackInitial ?? "✨")
            .font(.system(size: size * 0.45, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
    }

    /// Decodes a `data:image/...;base64,...` URL into a UIImage.
    private var inlineImage: UIImage? {
        guard let s = urlString, s.hasPrefix("data:") else { return nil }
        let parts = s.split(separator: ",", maxSplits: 1)
        guard parts.count == 2, let data = Data(base64Encoded: String(parts[1])) else { return nil }
        return UIImage(data: data)
    }

    private var remoteURL: URL? {
        guard let s = urlString, s.hasPrefix("http") else { return nil }
        return URL(string: s)
    }
}
