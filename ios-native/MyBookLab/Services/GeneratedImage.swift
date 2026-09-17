// Images coming back from /api/generate-image and /api/generate-avatar
// are EITHER an https URL (when the server parked the PNG in Supabase
// Storage — the normal path, see api/_imageStore.js) OR a
// `data:image/...;base64,...` string (the fallback when the upload
// failed).
//
// Anything that renders a generated image has to handle both. Decoding
// only the data URL means the feature silently shows nothing on the
// happy path, which is exactly what happened to the photo-to-cartoon
// flow.
import SwiftUI

enum GeneratedImage {
    /// Synchronously decodes a `data:...;base64,...` string.
    /// Returns nil for an http(s) URL — use `load` for those.
    static func decodeDataURL(_ string: String) -> UIImage? {
        guard string.hasPrefix("data:") else { return nil }
        let parts = string.split(separator: ",", maxSplits: 1)
        guard parts.count == 2, let data = Data(base64Encoded: String(parts[1])) else { return nil }
        return UIImage(data: data)
    }

    /// Resolves either form to a UIImage, downloading when it's a URL.
    static func load(_ string: String) async -> UIImage? {
        if let inline = decodeDataURL(string) { return inline }
        guard let url = URL(string: string), url.scheme?.hasPrefix("http") == true else { return nil }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return UIImage(data: data)
        } catch {
            return nil
        }
    }
}

/// Renders a generated-image string in either form, with a placeholder
/// while a remote one loads.
struct GeneratedImageView<Placeholder: View>: View {
    let source: String?
    var contentMode: ContentMode = .fill
    @ViewBuilder var placeholder: () -> Placeholder

    var body: some View {
        if let source, let inline = GeneratedImage.decodeDataURL(source) {
            Image(uiImage: inline).resizable().aspectRatio(contentMode: contentMode)
        } else if let source, let url = URL(string: source), url.scheme?.hasPrefix("http") == true {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: contentMode)
                case .failure:
                    placeholder()
                default:
                    ProgressView().tint(.white)
                }
            }
        } else {
            placeholder()
        }
    }
}
